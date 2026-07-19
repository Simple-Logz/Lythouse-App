/*
# Re-enable authenticated, tenant-scoped Row-Level Security

## Why
A previous migration (20260714011944_disable_auth_allow_anon_access) opened every
table to `anon` with `USING (true)` so the demo could run without login. In that
state anyone holding the public anon key can read/write/delete ALL data across
ALL workspaces. This migration replaces those permissive policies with
authenticated, workspace-membership-scoped policies so each organization can
only see and modify its own data.

## Model
- A user "belongs to" a workspace via `workspace_members (workspace_id, user_id, role)`.
- Tables that carry `workspace_id` are scoped directly.
- Child tables (validation_steps, findings) are scoped through their parent.
- `profiles` is scoped to the row owner (`id = auth.uid()`).
- Billing (`workspace_plans`) is READ-only to members; writes happen only via
  Edge Functions using the service-role key (which bypasses RLS).

## IMPORTANT — apply to a STAGING/branch Supabase first
Test the full signup -> create workspace -> add project -> run validation flow
before applying to production. Table/column names below follow the app's schema;
verify against your actual database. Adjust any table this migration doesn't
cover (compliance_scans, incidents, integrations, release_approvals,
environment_connections, server_* — templates included at the bottom).
*/

-- ─────────────────────────────────────────────────────────────────────────
-- Membership helper (SECURITY DEFINER bypasses RLS → no recursion on
-- workspace_members, which is the classic circular-RLS trap).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

-- Helper to drop every existing policy on a table (clears the anon USING(true) set)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in (
        'workspaces','workspace_members','workspace_plans','projects','validations',
        'validation_steps','findings','deployments','deployment_simulations',
        'deployment_policies','audit_logs','profiles','release_approvals',
        'environment_connections','compliance_scans','incidents','integrations',
        'server_environments','server_targets'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Ensure RLS is enabled on every scoped table
alter table if exists public.workspaces            enable row level security;
alter table if exists public.workspace_members     enable row level security;
alter table if exists public.workspace_plans       enable row level security;
alter table if exists public.projects              enable row level security;
alter table if exists public.validations           enable row level security;
alter table if exists public.validation_steps      enable row level security;
alter table if exists public.findings              enable row level security;
alter table if exists public.deployments           enable row level security;
alter table if exists public.deployment_simulations enable row level security;
alter table if exists public.deployment_policies   enable row level security;
alter table if exists public.audit_logs            enable row level security;
alter table if exists public.profiles              enable row level security;
alter table if exists public.release_approvals     enable row level security;
alter table if exists public.environment_connections enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- profiles — each user owns their own row
-- ─────────────────────────────────────────────────────────────────────────
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- workspaces — members read; owner creates; admins update/delete
-- ─────────────────────────────────────────────────────────────────────────
create policy "workspaces_select_member" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy "workspaces_insert_owner"  on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy "workspaces_update_admin"  on public.workspaces for update to authenticated using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));
create policy "workspaces_delete_owner"  on public.workspaces for delete to authenticated using (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- workspace_members — members see the roster; the workspace owner can add
-- themselves (bootstrap) and admins manage the rest.
-- ─────────────────────────────────────────────────────────────────────────
create policy "members_select" on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members_insert" on public.workspace_members for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
  or public.is_workspace_admin(workspace_id)
);
create policy "members_update" on public.workspace_members for update to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy "members_delete" on public.workspace_members for delete to authenticated using (public.is_workspace_admin(workspace_id) or user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- workspace_plans — members READ; writes only via service role (Edge Functions)
-- ─────────────────────────────────────────────────────────────────────────
create policy "plans_select_member" on public.workspace_plans for select to authenticated using (public.is_workspace_member(workspace_id));
-- (no insert/update/delete policy for authenticated → only service role can write billing)

-- ─────────────────────────────────────────────────────────────────────────
-- Generic workspace-scoped tables (have a workspace_id column)
-- ─────────────────────────────────────────────────────────────────────────
-- projects
create policy "projects_all_member" on public.projects for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
-- validations
create policy "validations_all_member" on public.validations for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
-- deployments
create policy "deployments_all_member" on public.deployments for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
-- deployment_simulations
create policy "sims_all_member" on public.deployment_simulations for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
-- deployment_policies
create policy "depol_all_member" on public.deployment_policies for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
-- audit_logs (members read; inserts allowed for members; no update/delete)
create policy "audit_select_member" on public.audit_logs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "audit_insert_member" on public.audit_logs for insert to authenticated with check (public.is_workspace_member(workspace_id));
-- release_approvals
create policy "approvals_all_member" on public.release_approvals for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
-- environment_connections
create policy "envconn_all_member" on public.environment_connections for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- ─────────────────────────────────────────────────────────────────────────
-- Child tables scoped through their parent (no workspace_id of their own)
-- ─────────────────────────────────────────────────────────────────────────
-- validation_steps -> validations.workspace_id
create policy "steps_all_member" on public.validation_steps for all to authenticated
  using (exists (select 1 from public.validations v where v.id = validation_id and public.is_workspace_member(v.workspace_id)))
  with check (exists (select 1 from public.validations v where v.id = validation_id and public.is_workspace_member(v.workspace_id)));
-- findings -> projects.workspace_id
create policy "findings_all_member" on public.findings for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id)));

/*
## Templates for the remaining enterprise tables (uncomment + verify columns)
-- compliance_scans, incidents, integrations, server_environments, server_targets
-- each has a workspace_id, so the pattern is identical:

-- alter table public.integrations enable row level security;
-- drop policy if exists "<old anon policy>" on public.integrations;
-- create policy "integrations_all_member" on public.integrations for all to authenticated
--   using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

## After applying
1. Sign up a fresh user -> confirm a workspace is created and they can see it.
2. Create a second user in a second workspace -> confirm neither can read the
   other's projects/findings/validations (try via the Supabase SQL editor with
   `set role authenticated; set request.jwt.claims ...`, or just log in as each).
3. Confirm Edge Functions (service role) can still write workspace_plans and
   process validations.
*/
