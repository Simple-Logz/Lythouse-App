/*
# Enterprise Feature Tables: Compliance, Incidents, Integrations, DORA Metrics, AI Insights

## Overview
Adds 6 new tables to support enterprise-grade features for the Sandbox.ai platform:
1. compliance_scans - Regulatory compliance scanning (SOC2, HIPAA, PCI-DSS, GDPR)
2. incidents - Incident response tracking with root cause and post-mortem
3. integrations - Third-party service integrations (Slack, PagerDuty, Jira, etc.)
4. dora_metrics - DORA metrics tracking (deployment frequency, lead time, MTTR, change failure rate)
5. environment_drift - Environment configuration drift detection
6. ai_insights - AI-generated deployment intelligence insights

## New Tables

### compliance_scans
- id (uuid PK)
- workspace_id (uuid FK to workspaces)
- project_id (uuid FK to projects)
- framework (text) - 'SOC2' | 'HIPAA' | 'PCI-DSS' | 'GDPR' | 'ISO27001'
- status (text) - 'pending' | 'scanning' | 'completed' | 'failed'
- overall_score (int) - 0-100 compliance score
- total_controls (int)
- passed_controls (int)
- failed_controls (int)
- warnings (int)
- controls (jsonb) - array of control results
- evidence (jsonb) - evidence files and references
- recommendations (jsonb)
- created_at, completed_at (timestamptz)

### incidents
- id (uuid PK)
- workspace_id (uuid FK to workspaces)
- project_id (uuid FK to projects, nullable)
- title (text)
- severity (text) - 'sev1' | 'sev2' | 'sev3' | 'sev4'
- status (text) - 'open' | 'investigating' | 'identified' | 'resolved' | 'postmortem'
- environment (text) - 'production' | 'staging' | 'preview'
- detected_by (text) - 'ai' | 'manual' | 'monitor' | 'alert'
- root_cause (text, nullable)
- impact_summary (text, nullable)
- affected_services (jsonb) - array of service names
- timeline (jsonb) - array of timeline events
- postmortem (text, nullable)
- resolution_actions (jsonb)
- started_at (timestamptz)
- resolved_at (timestamptz, nullable)
- created_at, updated_at (timestamptz)

### integrations
- id (uuid PK)
- workspace_id (uuid FK to workspaces)
- type (text) - 'slack' | 'pagerduty' | 'jira' | 'github_actions' | 'jenkins' | 'argocd' | 'datadog' | 'sentry' | 'webhook'
- name (text)
- status (text) - 'connected' | 'disconnected' | 'error'
- config (jsonb) - integration-specific configuration
- events (jsonb) - array of subscribed event types
- last_sync_at (timestamptz, nullable)
- created_at, updated_at (timestamptz)

### dora_metrics
- id (uuid PK)
- workspace_id (uuid FK to workspaces)
- project_id (uuid FK to projects, nullable)
- metric_date (date)
- deployment_frequency (numeric) - deployments per day
- lead_time_hours (numeric) - lead time for changes in hours
- mttr_hours (numeric) - mean time to recovery in hours
- change_failure_rate (numeric) - 0-1 percentage
- total_deployments (int)
- failed_deployments (int)
- successful_deployments (int)
- elite (boolean) - whether DORA elite status achieved
- created_at (timestamptz)

### environment_drift
- id (uuid PK)
- workspace_id (uuid FK to workspaces)
- project_id (uuid FK to projects)
- source_env (text) - 'production' | 'staging' | 'preview'
- target_env (text)
- status (text) - 'scanning' | 'completed' | 'failed'
- drift_score (int) - 0-100, higher = more drift
- drift_items (jsonb) - array of drift details
- config_diff (jsonb) - configuration differences
- created_at, completed_at (timestamptz)

### ai_insights
- id (uuid PK)
- workspace_id (uuid FK to workspaces)
- project_id (uuid FK to projects, nullable)
- type (text) - 'risk_prediction' | 'pattern_analysis' | 'recommendation' | 'anomaly' | 'trend'
- title (text)
- content (text)
- confidence (numeric) - 0-1
- severity (text) - 'info' | 'low' | 'medium' | 'high' | 'critical'
- category (text)
- actionable (boolean)
- action_taken (text, nullable)
- created_at (timestamptz)

## Security
- RLS enabled on all tables
- CRUD policies for anon + authenticated (single-tenant, no auth)
- All tables use USING(true) / WITH CHECK(true) since data is intentionally shared

## Notes
1. All tables reference workspaces for multi-workspace scoping
2. JSONB columns store flexible structured data (controls, timeline, drift items, etc.)
3. Timestamps use timestamptz with defaults
4. All FKs use ON DELETE CASCADE for clean workspace/project deletion
*/

-- compliance_scans
CREATE TABLE IF NOT EXISTS compliance_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  framework text NOT NULL DEFAULT 'SOC2',
  status text NOT NULL DEFAULT 'pending',
  overall_score int DEFAULT 0,
  total_controls int DEFAULT 0,
  passed_controls int DEFAULT 0,
  failed_controls int DEFAULT 0,
  warnings int DEFAULT 0,
  controls jsonb DEFAULT '[]'::jsonb,
  evidence jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE compliance_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_compliance_scans" ON compliance_scans;
CREATE POLICY "anon_select_compliance_scans" ON compliance_scans FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_compliance_scans" ON compliance_scans;
CREATE POLICY "anon_insert_compliance_scans" ON compliance_scans FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_compliance_scans" ON compliance_scans;
CREATE POLICY "anon_update_compliance_scans" ON compliance_scans FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_compliance_scans" ON compliance_scans;
CREATE POLICY "anon_delete_compliance_scans" ON compliance_scans FOR DELETE
  TO anon, authenticated USING (true);

-- incidents
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'sev3',
  status text NOT NULL DEFAULT 'open',
  environment text DEFAULT 'production',
  detected_by text NOT NULL DEFAULT 'ai',
  root_cause text,
  impact_summary text,
  affected_services jsonb DEFAULT '[]'::jsonb,
  timeline jsonb DEFAULT '[]'::jsonb,
  postmortem text,
  resolution_actions jsonb DEFAULT '[]'::jsonb,
  started_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_incidents" ON incidents;
CREATE POLICY "anon_select_incidents" ON incidents FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_incidents" ON incidents;
CREATE POLICY "anon_insert_incidents" ON incidents FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_incidents" ON incidents;
CREATE POLICY "anon_update_incidents" ON incidents FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_incidents" ON incidents;
CREATE POLICY "anon_delete_incidents" ON incidents FOR DELETE
  TO anon, authenticated USING (true);

-- integrations
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb DEFAULT '{}'::jsonb,
  events jsonb DEFAULT '[]'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_integrations" ON integrations;
CREATE POLICY "anon_select_integrations" ON integrations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_integrations" ON integrations;
CREATE POLICY "anon_insert_integrations" ON integrations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_integrations" ON integrations;
CREATE POLICY "anon_update_integrations" ON integrations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_integrations" ON integrations;
CREATE POLICY "anon_delete_integrations" ON integrations FOR DELETE
  TO anon, authenticated USING (true);

-- dora_metrics
CREATE TABLE IF NOT EXISTS dora_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  deployment_frequency numeric DEFAULT 0,
  lead_time_hours numeric DEFAULT 0,
  mttr_hours numeric DEFAULT 0,
  change_failure_rate numeric DEFAULT 0,
  total_deployments int DEFAULT 0,
  failed_deployments int DEFAULT 0,
  successful_deployments int DEFAULT 0,
  elite boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dora_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_dora_metrics" ON dora_metrics;
CREATE POLICY "anon_select_dora_metrics" ON dora_metrics FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_dora_metrics" ON dora_metrics;
CREATE POLICY "anon_insert_dora_metrics" ON dora_metrics FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_dora_metrics" ON dora_metrics;
CREATE POLICY "anon_update_dora_metrics" ON dora_metrics FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_dora_metrics" ON dora_metrics;
CREATE POLICY "anon_delete_dora_metrics" ON dora_metrics FOR DELETE
  TO anon, authenticated USING (true);

-- environment_drift
CREATE TABLE IF NOT EXISTS environment_drift (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_env text NOT NULL DEFAULT 'production',
  target_env text NOT NULL DEFAULT 'staging',
  status text NOT NULL DEFAULT 'scanning',
  drift_score int DEFAULT 0,
  drift_items jsonb DEFAULT '[]'::jsonb,
  config_diff jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE environment_drift ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_environment_drift" ON environment_drift;
CREATE POLICY "anon_select_environment_drift" ON environment_drift FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_environment_drift" ON environment_drift;
CREATE POLICY "anon_insert_environment_drift" ON environment_drift FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_environment_drift" ON environment_drift;
CREATE POLICY "anon_update_environment_drift" ON environment_drift FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_environment_drift" ON environment_drift;
CREATE POLICY "anon_delete_environment_drift" ON environment_drift FOR DELETE
  TO anon, authenticated USING (true);

-- ai_insights
CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'recommendation',
  title text NOT NULL,
  content text NOT NULL,
  confidence numeric DEFAULT 0.5,
  severity text DEFAULT 'info',
  category text,
  actionable boolean DEFAULT false,
  action_taken text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_insights" ON ai_insights;
CREATE POLICY "anon_select_ai_insights" ON ai_insights FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ai_insights" ON ai_insights;
CREATE POLICY "anon_insert_ai_insights" ON ai_insights FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ai_insights" ON ai_insights;
CREATE POLICY "anon_update_ai_insights" ON ai_insights FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ai_insights" ON ai_insights;
CREATE POLICY "anon_delete_ai_insights" ON ai_insights FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_compliance_scans_workspace ON compliance_scans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_compliance_scans_project ON compliance_scans(project_id);
CREATE INDEX IF NOT EXISTS idx_incidents_workspace ON incidents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_incidents_project ON incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_integrations_workspace ON integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dora_metrics_workspace ON dora_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dora_metrics_project ON dora_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_environment_drift_workspace ON environment_drift(workspace_id);
CREATE INDEX IF NOT EXISTS idx_environment_drift_project ON environment_drift(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_workspace ON ai_insights(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_project ON ai_insights(project_id);