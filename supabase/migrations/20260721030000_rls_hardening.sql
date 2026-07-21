/*
# RLS hardening for enterprise / server-validation tables + role-scoped writes

## What
1. For every listed table that EXISTS and carries a `workspace_id` column, enable
   RLS, drop any leftover permissive (anon USING(true)) policies, and add a single
   workspace-member-scoped ALL policy. This closes the tables the original
   re-enable migration left as templates (compliance_scans, incidents, integrations,
   dora_metrics, environment_drift, ai_insights, and the whole server_* /
   validation_* / discovery set).
2. Role-scoped tightening (task: RBAC in RLS):
   - deployment_policies: members read; only owner/admin write.
   - integrations: members read; only owner/admin write (they can hold secrets).
   - is_workspace_approver() helper for approve-gated flows.

Idempotent and safe to re-run. Apply to staging and re-run the tenant-isolation
test before production.
*/

-- Approver capability helper (owner/admin implicitly can approve too).
create or replace function public.is_workspace_approver(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
      and m.role in ('owner','admin','approver')
  );
$$;
revoke all on function public.is_workspace_approver(uuid) from public;
grant execute on function public.is_workspace_approver(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Generic member-scoped RLS for every enterprise/server table with a
--    workspace_id column. Runs only for tables that actually exist and have
--    the column, so it's safe across environments.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  tbls text[] := array[
    'compliance_scans','incidents','integrations','dora_metrics','environment_drift',
    'ai_insights','deployment_simulations','environment_connections',
    'server_environments','server_targets','connection_profiles','collector_registrations',
    'collection_policies','discovery_jobs','discovered_components','dependency_edges',
    'environment_blueprints','application_groups','proposed_changes','validation_runs',
    'validation_evidence','validation_findings','rollback_results','deployment_passports',
    'release_approvals'
  ];
  pol record;
begin
  foreach t in array tbls loop
    -- table must exist and have a workspace_id column
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'workspace_id'
    ) then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- drop every existing policy on the table (clears anon USING(true) leftovers)
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    -- single member-scoped ALL policy
    execute format($f$
      create policy "%1$s_all_member" on public.%1$I for all to authenticated
        using (public.is_workspace_member(workspace_id))
        with check (public.is_workspace_member(workspace_id))
    $f$, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Role-scoped overrides for sensitive tables (members read / admins write)
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  -- deployment_policies
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='deployment_policies' and column_name='workspace_id') then
    execute 'alter table public.deployment_policies enable row level security';
    execute 'drop policy if exists "depol_all_member" on public.deployment_policies';
    execute 'drop policy if exists "dp_member" on public.deployment_policies';
    execute 'drop policy if exists "deployment_policies_all_member" on public.deployment_policies';
    execute 'create policy "depol_select_member" on public.deployment_policies for select to authenticated using (public.is_workspace_member(workspace_id))';
    execute 'create policy "depol_write_admin" on public.deployment_policies for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))';
  end if;

  -- integrations (may store tokens): members read, admins write
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='integrations' and column_name='workspace_id') then
    execute 'alter table public.integrations enable row level security';
    execute 'drop policy if exists "integrations_all_member" on public.integrations';
    execute 'create policy "integrations_select_member" on public.integrations for select to authenticated using (public.is_workspace_member(workspace_id))';
    execute 'create policy "integrations_write_admin" on public.integrations for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))';
  end if;
end $$;
