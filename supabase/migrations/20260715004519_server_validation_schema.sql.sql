/*
# Server Validation Schema — Phase 1

## Summary
Implements the full data model for the Server-Based Validation capability
described in the SANDBOX AI specification. This adds a parallel onboarding
path alongside the existing Git-repository import flow.

## New Tables (16 total)

1. server_environments — Top-level container for a connected server environment
2. server_targets — Individual servers/VMs registered to an environment
3. connection_profiles — Connection method + credential reference for each target
4. collector_registrations — Agent/collector enrollment and check-in tracking
5. collection_policies — What data may/may not be collected from targets
6. discovery_jobs — Async discovery job state and progress
7. discovered_components — Raw components found during discovery
8. dependency_edges — Relationships between discovered components
9. environment_blueprints — Immutable, versioned environment snapshots
10. application_groups — Logical application boundaries (AI-inferred + human-confirmed)
11. proposed_changes — A proposed release/infra change submitted for validation
12. validation_runs — Pre-change validation job with verdict + confidence
13. validation_evidence — Evidence records cited by the AI verdict
14. validation_findings — Failures with severity, evidence refs, remediation
15. rollback_results — Rollback test outcome per validation run
16. deployment_passports — Human-readable deployment approval document

## Security
- RLS enabled on all tables.
- App runs without auth — policies use TO anon, authenticated with USING(true).
- When auth is re-enabled, replace with workspace-scoped ownership checks.

## Notes
1. All tables use workspace_id for tenant isolation.
2. Foreign keys cascade on workspace deletion where appropriate.
3. JSONB columns store structured evidence/metadata.
4. Status enums use text with CHECK constraints for flexibility.
*/

-- 1. server_environments
CREATE TABLE IF NOT EXISTS server_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  business_unit text,
  owner text,
  environment_type text NOT NULL DEFAULT 'production',
  location text,
  expected_server_count int DEFAULT 0,
  primary_purpose text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE server_environments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_server_environments" ON server_environments;
CREATE POLICY "anon_select_server_environments" ON server_environments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_server_environments" ON server_environments;
CREATE POLICY "anon_insert_server_environments" ON server_environments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_server_environments" ON server_environments;
CREATE POLICY "anon_update_server_environments" ON server_environments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_server_environments" ON server_environments;
CREATE POLICY "anon_delete_server_environments" ON server_environments FOR DELETE TO anon, authenticated USING (true);

-- 2. server_targets
CREATE TABLE IF NOT EXISTS server_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES server_environments(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  hostname text NOT NULL,
  ip text,
  os_platform text NOT NULL DEFAULT 'linux',
  server_role text,
  port_override int,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE server_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_server_targets" ON server_targets;
CREATE POLICY "anon_select_server_targets" ON server_targets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_server_targets" ON server_targets;
CREATE POLICY "anon_insert_server_targets" ON server_targets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_server_targets" ON server_targets;
CREATE POLICY "anon_update_server_targets" ON server_targets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_server_targets" ON server_targets;
CREATE POLICY "anon_delete_server_targets" ON server_targets FOR DELETE TO anon, authenticated USING (true);

-- 3. connection_profiles
CREATE TABLE IF NOT EXISTS connection_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES server_environments(id) ON DELETE CASCADE,
  server_target_id uuid REFERENCES server_targets(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('agent','ssh','winrm','collector','offline')),
  credential_ref_id text,
  bastion_host text,
  bastion_port int,
  auth_type text,
  last_tested_at timestamptz,
  test_result text,
  test_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE connection_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_connection_profiles" ON connection_profiles;
CREATE POLICY "anon_select_connection_profiles" ON connection_profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_connection_profiles" ON connection_profiles;
CREATE POLICY "anon_insert_connection_profiles" ON connection_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_connection_profiles" ON connection_profiles;
CREATE POLICY "anon_update_connection_profiles" ON connection_profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_connection_profiles" ON connection_profiles;
CREATE POLICY "anon_delete_connection_profiles" ON connection_profiles FOR DELETE TO anon, authenticated USING (true);

-- 4. collector_registrations
CREATE TABLE IF NOT EXISTS collector_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES server_environments(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collector_id text NOT NULL,
  enrollment_token_hash text,
  machine_identity_jwt text,
  agent_version text,
  os text,
  hostname text,
  last_checkin_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE collector_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_collector_registrations" ON collector_registrations;
CREATE POLICY "anon_select_collector_registrations" ON collector_registrations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_collector_registrations" ON collector_registrations;
CREATE POLICY "anon_insert_collector_registrations" ON collector_registrations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_collector_registrations" ON collector_registrations;
CREATE POLICY "anon_update_collector_registrations" ON collector_registrations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_collector_registrations" ON collector_registrations;
CREATE POLICY "anon_delete_collector_registrations" ON collector_registrations FOR DELETE TO anon, authenticated USING (true);

-- 5. collection_policies
CREATE TABLE IF NOT EXISTS collection_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES server_environments(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  default_categories text[] NOT NULL DEFAULT '{}',
  optional_categories text[] NOT NULL DEFAULT '{}',
  never_categories text[] NOT NULL DEFAULT '{}',
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE collection_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_collection_policies" ON collection_policies;
CREATE POLICY "anon_select_collection_policies" ON collection_policies FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_collection_policies" ON collection_policies;
CREATE POLICY "anon_insert_collection_policies" ON collection_policies FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_collection_policies" ON collection_policies;
CREATE POLICY "anon_update_collection_policies" ON collection_policies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_collection_policies" ON collection_policies;
CREATE POLICY "anon_delete_collection_policies" ON collection_policies FOR DELETE TO anon, authenticated USING (true);

-- 6. discovery_jobs
CREATE TABLE IF NOT EXISTS discovery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES server_environments(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  component_count int DEFAULT 0,
  group_suggestion_count int DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE discovery_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_discovery_jobs" ON discovery_jobs;
CREATE POLICY "anon_select_discovery_jobs" ON discovery_jobs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_discovery_jobs" ON discovery_jobs;
CREATE POLICY "anon_insert_discovery_jobs" ON discovery_jobs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_discovery_jobs" ON discovery_jobs;
CREATE POLICY "anon_update_discovery_jobs" ON discovery_jobs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_discovery_jobs" ON discovery_jobs;
CREATE POLICY "anon_delete_discovery_jobs" ON discovery_jobs FOR DELETE TO anon, authenticated USING (true);

-- 7. discovered_components
CREATE TABLE IF NOT EXISTS discovered_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES discovery_jobs(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES server_environments(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  server_target_id uuid REFERENCES server_targets(id) ON DELETE SET NULL,
  component_type text NOT NULL,
  name text NOT NULL,
  evidence jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE discovered_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_discovered_components" ON discovered_components;
CREATE POLICY "anon_select_discovered_components" ON discovered_components FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_discovered_components" ON discovered_components;
CREATE POLICY "anon_insert_discovered_components" ON discovered_components FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_discovered_components" ON discovered_components;
CREATE POLICY "anon_update_discovered_components" ON discovered_components FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_discovered_components" ON discovered_components;
CREATE POLICY "anon_delete_discovered_components" ON discovered_components FOR DELETE TO anon, authenticated USING (true);

-- 8. dependency_edges
CREATE TABLE IF NOT EXISTS dependency_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES server_environments(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_component_id uuid NOT NULL REFERENCES discovered_components(id) ON DELETE CASCADE,
  target_component_id uuid NOT NULL REFERENCES discovered_components(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  evidence jsonb DEFAULT '{}'::jsonb,
  human_confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE dependency_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_dependency_edges" ON dependency_edges;
CREATE POLICY "anon_select_dependency_edges" ON dependency_edges FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_dependency_edges" ON dependency_edges;
CREATE POLICY "anon_insert_dependency_edges" ON dependency_edges FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_dependency_edges" ON dependency_edges;
CREATE POLICY "anon_update_dependency_edges" ON dependency_edges FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_dependency_edges" ON dependency_edges;
CREATE POLICY "anon_delete_dependency_edges" ON dependency_edges FOR DELETE TO anon, authenticated USING (true);

-- 9. environment_blueprints
CREATE TABLE IF NOT EXISTS environment_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES server_environments(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version text NOT NULL DEFAULT '1.0',
  capture_method text NOT NULL DEFAULT 'agent',
  capture_timestamp timestamptz DEFAULT now(),
  is_stale boolean DEFAULT false,
  component_count int DEFAULT 0,
  app_group_count int DEFAULT 0,
  dependency_count int DEFAULT 0,
  known_gaps jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE environment_blueprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_environment_blueprints" ON environment_blueprints;
CREATE POLICY "anon_select_environment_blueprints" ON environment_blueprints FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_environment_blueprints" ON environment_blueprints;
CREATE POLICY "anon_insert_environment_blueprints" ON environment_blueprints FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_environment_blueprints" ON environment_blueprints;
CREATE POLICY "anon_update_environment_blueprints" ON environment_blueprints FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_environment_blueprints" ON environment_blueprints;
CREATE POLICY "anon_delete_environment_blueprints" ON environment_blueprints FOR DELETE TO anon, authenticated USING (true);

-- 10. application_groups
CREATE TABLE IF NOT EXISTS application_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid REFERENCES environment_blueprints(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES server_environments(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  component_ids uuid[] NOT NULL DEFAULT '{}',
  human_confirmed boolean DEFAULT false,
  business_context text,
  ai_confidence numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE application_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_application_groups" ON application_groups;
CREATE POLICY "anon_select_application_groups" ON application_groups FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_application_groups" ON application_groups;
CREATE POLICY "anon_insert_application_groups" ON application_groups FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_application_groups" ON application_groups;
CREATE POLICY "anon_update_application_groups" ON application_groups FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_application_groups" ON application_groups;
CREATE POLICY "anon_delete_application_groups" ON application_groups FOR DELETE TO anon, authenticated USING (true);

-- 11. proposed_changes
CREATE TABLE IF NOT EXISTS proposed_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES server_environments(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  change_description text NOT NULL,
  artifact_name text,
  artifact_type text,
  artifact_ref text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE proposed_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_proposed_changes" ON proposed_changes;
CREATE POLICY "anon_select_proposed_changes" ON proposed_changes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_proposed_changes" ON proposed_changes;
CREATE POLICY "anon_insert_proposed_changes" ON proposed_changes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_proposed_changes" ON proposed_changes;
CREATE POLICY "anon_update_proposed_changes" ON proposed_changes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_proposed_changes" ON proposed_changes;
CREATE POLICY "anon_delete_proposed_changes" ON proposed_changes FOR DELETE TO anon, authenticated USING (true);

-- 12. validation_runs
CREATE TABLE IF NOT EXISTS validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES environment_blueprints(id) ON DELETE CASCADE,
  proposed_change_id uuid NOT NULL REFERENCES proposed_changes(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES server_environments(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'queued',
  confidence_score int,
  verdict text,
  ai_summary text,
  ai_root_cause text,
  ai_remediation_steps jsonb DEFAULT '[]'::jsonb,
  ai_affected_components jsonb DEFAULT '[]'::jsonb,
  passport_summary text,
  current_step int DEFAULT 0,
  total_steps int DEFAULT 14,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE validation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_validation_runs" ON validation_runs;
CREATE POLICY "anon_select_validation_runs" ON validation_runs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_validation_runs" ON validation_runs;
CREATE POLICY "anon_insert_validation_runs" ON validation_runs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_validation_runs" ON validation_runs;
CREATE POLICY "anon_update_validation_runs" ON validation_runs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_validation_runs" ON validation_runs;
CREATE POLICY "anon_delete_validation_runs" ON validation_runs FOR DELETE TO anon, authenticated USING (true);

-- 13. validation_evidence
CREATE TABLE IF NOT EXISTS validation_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  source text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  cited_in_verdict boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE validation_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_validation_evidence" ON validation_evidence;
CREATE POLICY "anon_select_validation_evidence" ON validation_evidence FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_validation_evidence" ON validation_evidence;
CREATE POLICY "anon_insert_validation_evidence" ON validation_evidence FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_validation_evidence" ON validation_evidence;
CREATE POLICY "anon_update_validation_evidence" ON validation_evidence FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_validation_evidence" ON validation_evidence;
CREATE POLICY "anon_delete_validation_evidence" ON validation_evidence FOR DELETE TO anon, authenticated USING (true);

-- 14. validation_findings
CREATE TABLE IF NOT EXISTS validation_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  component_id uuid,
  title text NOT NULL,
  description text NOT NULL,
  evidence_ids uuid[] NOT NULL DEFAULT '{}',
  remediation_steps jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE validation_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_validation_findings" ON validation_findings;
CREATE POLICY "anon_select_validation_findings" ON validation_findings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_validation_findings" ON validation_findings;
CREATE POLICY "anon_insert_validation_findings" ON validation_findings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_validation_findings" ON validation_findings;
CREATE POLICY "anon_update_validation_findings" ON validation_findings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_validation_findings" ON validation_findings;
CREATE POLICY "anon_delete_validation_findings" ON validation_findings FOR DELETE TO anon, authenticated USING (true);

-- 15. rollback_results
CREATE TABLE IF NOT EXISTS rollback_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES validation_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rollback_method text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  baseline_tests_after_rollback jsonb DEFAULT '{}'::jsonb,
  evidence jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE rollback_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_rollback_results" ON rollback_results;
CREATE POLICY "anon_select_rollback_results" ON rollback_results FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_rollback_results" ON rollback_results;
CREATE POLICY "anon_insert_rollback_results" ON rollback_results FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_rollback_results" ON rollback_results;
CREATE POLICY "anon_update_rollback_results" ON rollback_results FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_rollback_results" ON rollback_results;
CREATE POLICY "anon_delete_rollback_results" ON rollback_results FOR DELETE TO anon, authenticated USING (true);

-- 16. deployment_passports
CREATE TABLE IF NOT EXISTS deployment_passports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES validation_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  verdict text,
  confidence_score int,
  blueprint_version text,
  human_readable_summary text,
  expires_at timestamptz,
  signature text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE deployment_passports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_deployment_passports" ON deployment_passports;
CREATE POLICY "anon_select_deployment_passports" ON deployment_passports FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_deployment_passports" ON deployment_passports;
CREATE POLICY "anon_insert_deployment_passports" ON deployment_passports FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_deployment_passports" ON deployment_passports;
CREATE POLICY "anon_update_deployment_passports" ON deployment_passports FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_deployment_passports" ON deployment_passports;
CREATE POLICY "anon_delete_deployment_passports" ON deployment_passports FOR DELETE TO anon, authenticated USING (true);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_server_environments_workspace ON server_environments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_server_targets_env ON server_targets(environment_id);
CREATE INDEX IF NOT EXISTS idx_connection_profiles_env ON connection_profiles(environment_id);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_env ON discovery_jobs(environment_id);
CREATE INDEX IF NOT EXISTS idx_discovered_components_job ON discovered_components(job_id);
CREATE INDEX IF NOT EXISTS idx_env_blueprints_env ON environment_blueprints(environment_id);
CREATE INDEX IF NOT EXISTS idx_validation_runs_env ON validation_runs(environment_id);
CREATE INDEX IF NOT EXISTS idx_validation_runs_workspace ON validation_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_validation_evidence_run ON validation_evidence(run_id);
CREATE INDEX IF NOT EXISTS idx_validation_findings_run ON validation_findings(run_id);
