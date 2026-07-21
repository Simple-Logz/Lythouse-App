/*
# Five-role model + real workspace invitations

## Roles
Standardizes workspace_members.role on: owner | admin | developer | approver | viewer.
Legacy 'member' rows are migrated to 'developer'. A CHECK constraint enforces the set.

## Invitations
Adds a pending-invitation flow so you can invite someone who does NOT yet have a
LytHouse account. An admin/owner creates a `workspace_invitations` row (RLS-guarded);
the invitee accepts via the `accept_invitation(token)` SECURITY DEFINER RPC, which
inserts the membership after verifying the token, expiry, and that the caller's email
matches the invite. Apply to a staging branch and run the signup->invite->accept flow
before production.
*/

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Migrate legacy roles and constrain the set
-- ─────────────────────────────────────────────────────────────────────────
update public.workspace_members set role = 'developer' where role = 'member';
update public.workspace_members set role = 'viewer'
  where role not in ('owner','admin','developer','approver','viewer');

alter table public.workspace_members alter column role set default 'developer';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_members_role_check'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_role_check
      check (role in ('owner','admin','developer','approver','viewer'));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Invitations table
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'developer'
    check (role in ('admin','developer','approver','viewer')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','revoked','expired')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);
create index if not exists workspace_invitations_ws_idx on public.workspace_invitations(workspace_id);
create index if not exists workspace_invitations_email_idx on public.workspace_invitations(lower(email));
-- Only one live pending invite per (workspace, email).
create unique index if not exists workspace_invitations_unique_pending
  on public.workspace_invitations(workspace_id, lower(email)) where status = 'pending';

alter table public.workspace_invitations enable row level security;

-- Admins/owners of the workspace manage its invitations.
drop policy if exists "invites_admin_all" on public.workspace_invitations;
create policy "invites_admin_all" on public.workspace_invitations for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- An invitee may READ invitations addressed to their own email (to see/accept them).
drop policy if exists "invites_invitee_read" on public.workspace_invitations;
create policy "invites_invitee_read" on public.workspace_invitations for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. accept_invitation(token) — SECURITY DEFINER so it can create the member
--    row after validating the token, expiry, and caller email.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.workspace_invitations%rowtype;
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into inv from public.workspace_invitations
    where token = invite_token for update;

  if not found then
    raise exception 'Invitation not found';
  end if;
  if inv.status <> 'pending' then
    raise exception 'Invitation is no longer pending';
  end if;
  if inv.expires_at < now() then
    update public.workspace_invitations set status = 'expired' where id = inv.id;
    raise exception 'Invitation has expired';
  end if;
  if caller_email = '' or caller_email <> lower(inv.email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  update public.workspace_invitations
    set status = 'accepted', accepted_at = now()
    where id = inv.id;

  return inv.workspace_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

-- Convenience: list pending invitations addressed to the current user (used by
-- the in-app "you've been invited" banner). SECURITY DEFINER keeps the lookup
-- simple regardless of per-row RLS.
create or replace function public.my_pending_invitations()
returns table (token text, workspace_id uuid, workspace_name text, role text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.token, i.workspace_id, w.name, i.role, i.expires_at
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.status = 'pending'
    and i.expires_at > now()
    and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
revoke all on function public.my_pending_invitations() from public;
grant execute on function public.my_pending_invitations() to authenticated;
