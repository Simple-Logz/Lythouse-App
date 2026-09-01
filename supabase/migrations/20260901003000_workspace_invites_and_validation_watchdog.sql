-- Production reconciliation for real workspace invitations and validation lifecycle.
create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.workspace_members wm where wm.workspace_id=target_workspace and wm.user_id=auth.uid() and wm.role in ('owner','admin'));
$$;
revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

update public.workspace_members set role='developer' where role='member';
update public.workspace_members set role='viewer' where role not in ('owner','admin','developer','approver','viewer');
alter table public.workspace_members alter column role set default 'developer';

create table if not exists public.workspace_invitations(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 email text not null, role text not null default 'developer' check(role in('admin','developer','approver','viewer')),
 token text not null unique default encode(gen_random_bytes(24),'hex'), status text not null default 'pending' check(status in('pending','accepted','declined','revoked','expired')),
 invited_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '7 days'), accepted_at timestamptz);
create unique index if not exists workspace_invitations_unique_pending on public.workspace_invitations(workspace_id,lower(email)) where status='pending';
alter table public.workspace_invitations enable row level security;
grant select,insert,update,delete on public.workspace_invitations to authenticated;
revoke all on public.workspace_invitations from anon;
drop policy if exists "invites_admin_all" on public.workspace_invitations;
create policy "invites_admin_all" on public.workspace_invitations for all to authenticated using(public.is_workspace_admin(workspace_id)) with check(public.is_workspace_admin(workspace_id));
drop policy if exists "invites_invitee_read" on public.workspace_invitations;
create policy "invites_invitee_read" on public.workspace_invitations for select to authenticated using(lower(email)=lower(coalesce(auth.jwt()->>'email','')));

create or replace function public.accept_invitation(invite_token text) returns uuid language plpgsql security definer set search_path=public as $$
declare inv public.workspace_invitations%rowtype; caller_email text:=lower(coalesce(auth.jwt()->>'email',''));
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select * into inv from public.workspace_invitations where token=invite_token for update;
 if not found then raise exception 'Invitation not found'; end if;
 if inv.status<>'pending' then raise exception 'Invitation is no longer pending'; end if;
 if inv.expires_at<now() then update public.workspace_invitations set status='expired' where id=inv.id; raise exception 'Invitation has expired'; end if;
 if caller_email='' or caller_email<>lower(inv.email) then raise exception 'This invitation was sent to a different email address'; end if;
 insert into public.workspace_members(workspace_id,user_id,role) values(inv.workspace_id,auth.uid(),inv.role) on conflict(workspace_id,user_id) do update set role=excluded.role;
 update public.workspace_invitations set status='accepted',accepted_at=now() where id=inv.id;
 return inv.workspace_id;
end $$;
revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

update public.validations set status='failed',completed_at=coalesce(completed_at,now()),duration_ms=coalesce(duration_ms,greatest(0,(extract(epoch from(coalesce(completed_at,now())-created_at))*1000)::int)),summary=case when coalesce(summary,'')='' then 'Validation did not complete within the execution window and was finalized as failed.' else summary end where status='running' and created_at<now()-interval '15 minutes';
create or replace function public.finalize_stale_validations(max_age interval default interval '15 minutes') returns integer language plpgsql security definer set search_path=public as $$
declare n integer; begin
 update public.validations set status='failed',completed_at=coalesce(completed_at,now()),duration_ms=coalesce(duration_ms,greatest(0,(extract(epoch from(coalesce(completed_at,now())-created_at))*1000)::int)),summary=case when coalesce(summary,'')='' then 'Validation exceeded the execution window and was finalized as failed.' else summary end where status='running' and created_at<now()-max_age;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.finalize_stale_validations(interval) from public;
grant execute on function public.finalize_stale_validations(interval) to service_role;
