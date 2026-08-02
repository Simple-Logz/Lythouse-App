-- ══════════════════════════════════════════════════════════════════════════
-- Organizations — the top-level tenant. Full hierarchy:
--     Organization → Workspace → Project → Stack
-- Each organization is fully isolated: the same features, its own data.
-- Workspaces now belong to an organization. Mirrors the workspaces + RLS model.
--
-- HOW TO APPLY: paste this whole file into the Supabase SQL editor and run it
-- once. Safe to re-run (idempotent).
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Organizations table (mirrors workspaces).
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- 2. Membership — who can access an organization (mirrors workspace_members).
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz default now(),
  unique(organization_id, user_id)
);

-- 3. Link every workspace to an organization.
alter table public.workspaces
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

-- 4. Backfill — give each existing workspace owner a default organization and
--    attach their workspaces to it, registering them as the org owner.
do $$
declare w record; new_org uuid;
begin
  for w in (
    select distinct owner_id from public.workspaces
    where organization_id is null and owner_id is not null
  ) loop
    insert into public.organizations (name, slug, owner_id)
      values ('My Organization', 'org-' || substr(w.owner_id::text, 1, 8), w.owner_id)
      on conflict (slug) do nothing
      returning id into new_org;
    if new_org is null then
      select id into new_org from public.organizations where owner_id = w.owner_id order by created_at limit 1;
    end if;
    insert into public.organization_members (organization_id, user_id, role)
      values (new_org, w.owner_id, 'owner') on conflict do nothing;
    update public.workspaces set organization_id = new_org
      where owner_id = w.owner_id and organization_id is null;
  end loop;
end $$;

-- 5. Row-Level Security — members read; owner creates; owner manages.
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;

drop policy if exists "orgs_select_member" on public.organizations;
drop policy if exists "orgs_insert_owner"  on public.organizations;
drop policy if exists "orgs_update_owner"  on public.organizations;
drop policy if exists "orgs_delete_owner"  on public.organizations;

create policy "orgs_select_member" on public.organizations for select to authenticated
  using (owner_id = auth.uid()
         or id in (select organization_id from public.organization_members where user_id = auth.uid()));
create policy "orgs_insert_owner"  on public.organizations for insert to authenticated
  with check (owner_id = auth.uid());
create policy "orgs_update_owner"  on public.organizations for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "orgs_delete_owner"  on public.organizations for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "org_members_select" on public.organization_members;
drop policy if exists "org_members_insert" on public.organization_members;
create policy "org_members_select" on public.organization_members for select to authenticated
  using (user_id = auth.uid()
         or organization_id in (select id from public.organizations where owner_id = auth.uid()));
create policy "org_members_insert" on public.organization_members for insert to authenticated
  with check (user_id = auth.uid()
              or organization_id in (select id from public.organizations where owner_id = auth.uid()));
