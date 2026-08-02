/*
# Close the remaining tenant-isolation gap left by 20260720000000_reenable_tenant_rls

## Why
The previous RLS-hardening migration (20260720000000_reenable_tenant_rls.sql)
fixed the core tables — workspaces, projects, validations, findings, deployments,
release_approvals, environment_connections — but its own comments explicitly
flag that it does NOT cover everything, and leaves a "templates" section with
one commented-out example rather than applying the fix. Every table below is
still sitting on its original policy from 20260715004519_server_validation_schema
and 20260714225817_add_enterprise_compliance_incidents_integrations_dora:

  FOR SELECT/INSERT/UPDATE/DELETE TO anon, authenticated USING (true)

That means, right now, ANY signed-in user — or anyone holding the public anon
key, no login required — can read, modify, or delete ANY workspace's:
  - server/infrastructure inventory (server_environments, server_targets,
    discovered_components, dependency_edges, connection_profiles,
    collector_registrations, collection_policies, environment_blueprints,
    application_groups, proposed_changes)
  - validation run history (validation_runs, validation_evidence,
    validation_findings, rollback_results, deployment_passports)
  - compliance scans, incidents, integrations (with stored credentials/config),
    DORA metrics, AI insights, environment drift records

This is a straightforward cross-tenant data leak, and it directly contradicts
the platform's own stated principle that every entity must be
"Environment-scoped — no global ambiguity." This migration finishes the job
the previous one started, using the identical is_workspace_member() /
is_workspace_admin() helpers it already defined.

## IMPORTANT
This file only edits the repo. It has NOT been applied to any live database —
apply it via the Supabase SQL editor (or `supabase db push` against the
correct linked project) and verify with two separate workspace accounts that
neither can see the other's data before treating this as fixed in production.
*/

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in (
        'server_environments','server_targets','connection_profiles',
        'collector_registrations','collection_policies','discovery_jobs',
        'discovered_components','dependency_edges','environment_blueprints',
        'application_groups','proposed_changes','validation_runs',
        'validation_evidence','validation_findings','rollback_results',
        'deployment_passports','compliance_scans','incidents','integrations',
        'dora_metrics','ai_insights','environment_drift'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table if exists public.server_environments    enable row level security;
alter table if exists public.server_targets         enable row level security;
alter table if exists public.connection_profiles    enable row level security;
alter table if exists public.collector_registrations enable row level security;
alter table if exists public.collection_policies    enable row level security;
alter table if exists public.discovery_jobs         enable row level security;
alter table if exists public.discovered_components  enable row level security;
alter table if exists public.dependency_edges       enable row level security;
alter table if exists public.environment_blueprints enable row level security;
alter table if exists public.application_groups     enable row level security;
alter table if exists public.proposed_changes       enable row level security;
alter table if exists public.validation_runs        enable row level security;
alter table if exists public.validation_evidence    enable row level security;
alter table if exists public.validation_findings    enable row level security;
alter table if exists public.rollback_results       enable row level security;
alter table if exists public.deployment_passports   enable row level security;
alter table if exists public.compliance_scans       enable row level security;
alter table if exists public.incidents              enable row level security;
alter table if exists public.integrations           enable row level security;
alter table if exists public.dora_metrics           enable row level security;
alter table if exists public.ai_insights            enable row level security;
alter table if exists public.environment_drift      enable row level security;

-- Every one of these tables carries its own workspace_id column, so the
-- pattern is uniform: workspace members get full read/write, everyone else
-- gets nothing, service-role Edge Functions bypass RLS as always.
create policy "server_environments_all_member" on public.server_environments for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "server_targets_all_member" on public.server_targets for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "connection_profiles_all_member" on public.connection_profiles for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "collector_registrations_all_member" on public.collector_registrations for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "collection_policies_all_member" on public.collection_policies for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "discovery_jobs_all_member" on public.discovery_jobs for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "discovered_components_all_member" on public.discovered_components for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "dependency_edges_all_member" on public.dependency_edges for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "environment_blueprints_all_member" on public.environment_blueprints for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "application_groups_all_member" on public.application_groups for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "proposed_changes_all_member" on public.proposed_changes for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "validation_runs_all_member" on public.validation_runs for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "validation_evidence_all_member" on public.validation_evidence for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "validation_findings_all_member" on public.validation_findings for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "rollback_results_all_member" on public.rollback_results for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "deployment_passports_all_member" on public.deployment_passports for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "compliance_scans_all_member" on public.compliance_scans for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "incidents_all_member" on public.incidents for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "integrations_all_member" on public.integrations for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "dora_metrics_all_member" on public.dora_metrics for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "ai_insights_all_member" on public.ai_insights for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "environment_drift_all_member" on public.environment_drift for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

/*
## After applying
1. Confirm the env_ingest collector Edge Function still writes successfully
   (it uses the service-role key, which bypasses RLS entirely — unaffected).
2. Sign in as a user in Workspace A, confirm you can see Workspace A's server
   environments / discovered components / findings as before.
3. Sign in as a user in Workspace B, confirm all of the above from Workspace A
   is now invisible (previously it would NOT have been).
4. If any authenticated table access breaks after this, it's almost certainly
   a workspace_id mismatch or a missing workspace_members row — check that
   before loosening the policy back up.
*/
