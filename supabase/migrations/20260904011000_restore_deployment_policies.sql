-- Restore the deployment policy relation required by Release Pipeline and Policies UI.
-- Idempotent so production environments that already have the relation can apply safely.
create table if not exists public.deployment_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  block_critical boolean not null default true,
  block_high boolean not null default false,
  require_approval boolean not null default false,
  auto_deploy_on_pass boolean not null default false,
  max_risk_score integer not null default 50 check (max_risk_score between 0 and 100),
  cooldown_minutes integer not null default 30 check (cooldown_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

alter table public.deployment_policies enable row level security;
grant select, insert, update, delete on public.deployment_policies to authenticated;

-- Use the canonical tenant-membership helper already used throughout Lythouse.
drop policy if exists deployment_policies_member_select on public.deployment_policies;
create policy deployment_policies_member_select on public.deployment_policies
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists deployment_policies_member_insert on public.deployment_policies;
create policy deployment_policies_member_insert on public.deployment_policies
for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists deployment_policies_member_update on public.deployment_policies;
create policy deployment_policies_member_update on public.deployment_policies
for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists deployment_policies_member_delete on public.deployment_policies;
create policy deployment_policies_member_delete on public.deployment_policies
for delete to authenticated using (public.is_workspace_member(workspace_id));

create index if not exists deployment_policies_workspace_idx on public.deployment_policies(workspace_id);

-- Ask PostgREST to reload its schema after the migration.
notify pgrst, 'reload schema';
