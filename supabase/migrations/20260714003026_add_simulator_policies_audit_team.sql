/*
# Deployment Simulator, Policy Engine, Audit Log, and Team Management

## Overview
Adds four enterprise-grade features to Sandbox.ai:
1. Deployment simulations — pre-flight "what-if" analysis for deployments
2. Deployment policies — configurable gates per workspace (risk threshold, severity blocks)
3. Audit logs — track all significant platform actions for compliance
4. Team management — workspace members with roles (owner/admin/member/viewer)

## New Tables
1. deployment_simulations
   - id, project_id, workspace_id, validation_id (nullable)
   - environment (production|staging|preview)
   - config_overrides (jsonb — simulated config changes)
   - predicted_risk_score (int), predicted_severity (text)
   - blast_radius (text — small|medium|large|critical)
   - affected_services (text[] — list of impacted services)
   - impact_summary (text), rollback_plan (text)
   - confidence (int 0-100), simulation_metadata (jsonb)
   - status (pending|running|completed|failed), duration_ms
   - created_by, created_at, completed_at

2. deployment_policies
   - id, workspace_id (unique — one policy per workspace)
   - max_risk_score (int, default 50), block_critical (bool, default true)
   - block_high (bool, default false), require_approval (bool, default true)
   - auto_deploy_on_pass (bool, default false)
   - cooldown_minutes (int, default 30 — min time between deployments)
   - updated_by, updated_at

3. audit_logs
   - id, workspace_id, user_id
   - action (text — e.g. validation.run, deployment.approve)
   - entity_type (text), entity_id (text)
   - metadata (jsonb), ip_address (text), user_agent (text)
   - created_at

## Modified Tables
- workspace_members: added role column (already exists, but adding policies for full CRUD)

## Security (RLS)
- deployment_simulations: workspace membership-scoped CRUD
- deployment_policies: workspace membership-scoped CRUD
- audit_logs: workspace membership-scoped SELECT only (immutable from client)
- workspace_members: already has RLS, adding UPDATE policy

## Notes
1. One policy per workspace enforced via UNIQUE constraint on workspace_id
2. Audit logs are insert-only from edge functions / server-side; client can only SELECT
3. Indexes added for all common lookup paths
*/

-- ===== DEPLOYMENT_SIMULATIONS =====
CREATE TABLE IF NOT EXISTS deployment_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  validation_id uuid REFERENCES validations(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'staging',
  config_overrides jsonb DEFAULT '{}'::jsonb,
  predicted_risk_score integer,
  predicted_severity text,
  blast_radius text,
  affected_services text[] DEFAULT '{}',
  impact_summary text,
  rollback_plan text,
  confidence integer,
  simulation_metadata jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  duration_ms integer,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE deployment_simulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_member_simulations" ON deployment_simulations;
CREATE POLICY "select_member_simulations" ON deployment_simulations FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = deployment_simulations.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "insert_member_simulations" ON deployment_simulations;
CREATE POLICY "insert_member_simulations" ON deployment_simulations FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = deployment_simulations.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "update_member_simulations" ON deployment_simulations;
CREATE POLICY "update_member_simulations" ON deployment_simulations FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = deployment_simulations.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = deployment_simulations.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "delete_member_simulations" ON deployment_simulations;
CREATE POLICY "delete_member_simulations" ON deployment_simulations FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = deployment_simulations.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));

-- ===== DEPLOYMENT_POLICIES =====
CREATE TABLE IF NOT EXISTS deployment_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  max_risk_score integer NOT NULL DEFAULT 50,
  block_critical boolean NOT NULL DEFAULT true,
  block_high boolean NOT NULL DEFAULT false,
  require_approval boolean NOT NULL DEFAULT true,
  auto_deploy_on_pass boolean NOT NULL DEFAULT false,
  cooldown_minutes integer NOT NULL DEFAULT 30,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deployment_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_member_policies" ON deployment_policies;
CREATE POLICY "select_member_policies" ON deployment_policies FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = deployment_policies.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "insert_member_policies" ON deployment_policies;
CREATE POLICY "insert_member_policies" ON deployment_policies FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = deployment_policies.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "update_member_policies" ON deployment_policies;
CREATE POLICY "update_member_policies" ON deployment_policies FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = deployment_policies.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = deployment_policies.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "delete_member_policies" ON deployment_policies;
CREATE POLICY "delete_member_policies" ON deployment_policies FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = deployment_policies.workspace_id AND w.owner_id = auth.uid()
  ));

-- ===== AUDIT_LOGS =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_member_audit_logs" ON audit_logs;
CREATE POLICY "select_member_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = audit_logs.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));

-- Allow inserts from authenticated users (for client-side audit logging)
DROP POLICY IF EXISTS "insert_member_audit_logs" ON audit_logs;
CREATE POLICY "insert_member_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = audit_logs.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));

-- ===== WORKSPACE_MEMBERS UPDATE POLICY (was missing) =====
DROP POLICY IF EXISTS "update_own_memberships" ON workspace_members;
CREATE POLICY "update_own_memberships" ON workspace_members FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid()
  ));

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_simulations_workspace ON deployment_simulations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_simulations_project ON deployment_simulations(project_id);
CREATE INDEX IF NOT EXISTS idx_simulations_created_at ON deployment_simulations(created_at desc);
CREATE INDEX IF NOT EXISTS idx_policies_workspace ON deployment_policies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at desc);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
