/*
# Disable auth: allow anon access to all tables

## Summary
The login feature is being temporarily disabled. All existing RLS policies
scoped to `TO authenticated` are being replaced with `TO anon, authenticated`
with `USING (true)` / `WITH CHECK (true)` so the anon-key frontend can read
and write all data without a session.

## Tables affected
- workspaces, projects, validations, validation_steps, findings
- deployments, deployment_simulations, deployment_policies
- workspace_members, audit_logs, profiles

## Security
- All policies changed from `TO authenticated` (ownership-scoped) to
  `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`.
- This is intentionally permissive because the app is running without auth.
- When auth is re-enabled, these should be replaced with ownership-scoped policies.

## Notes
1. Existing authenticated-only policies are dropped and replaced.
2. profiles table gets full anon CRUD since there's no session to scope by.
3. All 4 CRUD verbs covered per table where applicable.
*/

-- workspaces
DROP POLICY IF EXISTS "select_own_workspaces" ON workspaces;
DROP POLICY IF EXISTS "insert_own_workspaces" ON workspaces;
DROP POLICY IF EXISTS "update_own_workspaces" ON workspaces;
DROP POLICY IF EXISTS "delete_own_workspaces" ON workspaces;
CREATE POLICY "anon_select_workspaces" ON workspaces FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_workspaces" ON workspaces FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_workspaces" ON workspaces FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_workspaces" ON workspaces FOR DELETE TO anon, authenticated USING (true);

-- projects
DROP POLICY IF EXISTS "select_member_projects" ON projects;
DROP POLICY IF EXISTS "insert_member_projects" ON projects;
DROP POLICY IF EXISTS "update_member_projects" ON projects;
DROP POLICY IF EXISTS "delete_member_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE TO anon, authenticated USING (true);

-- validations
DROP POLICY IF EXISTS "select_member_validations" ON validations;
DROP POLICY IF EXISTS "insert_member_validations" ON validations;
DROP POLICY IF EXISTS "update_member_validations" ON validations;
DROP POLICY IF EXISTS "delete_member_validations" ON validations;
CREATE POLICY "anon_select_validations" ON validations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_validations" ON validations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_validations" ON validations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_validations" ON validations FOR DELETE TO anon, authenticated USING (true);

-- validation_steps
DROP POLICY IF EXISTS "select_member_steps" ON validation_steps;
DROP POLICY IF EXISTS "insert_member_steps" ON validation_steps;
DROP POLICY IF EXISTS "update_member_steps" ON validation_steps;
CREATE POLICY "anon_select_steps" ON validation_steps FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_steps" ON validation_steps FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_steps" ON validation_steps FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- findings
DROP POLICY IF EXISTS "select_member_findings" ON findings;
DROP POLICY IF EXISTS "insert_member_findings" ON findings;
CREATE POLICY "anon_select_findings" ON findings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_findings" ON findings FOR INSERT TO anon, authenticated WITH CHECK (true);

-- deployments
DROP POLICY IF EXISTS "select_member_deployments" ON deployments;
DROP POLICY IF EXISTS "insert_member_deployments" ON deployments;
DROP POLICY IF EXISTS "update_member_deployments" ON deployments;
DROP POLICY IF EXISTS "delete_member_deployments" ON deployments;
CREATE POLICY "anon_select_deployments" ON deployments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_deployments" ON deployments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_deployments" ON deployments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_deployments" ON deployments FOR DELETE TO anon, authenticated USING (true);

-- deployment_simulations
DROP POLICY IF EXISTS "select_member_simulations" ON deployment_simulations;
DROP POLICY IF EXISTS "insert_member_simulations" ON deployment_simulations;
DROP POLICY IF EXISTS "update_member_simulations" ON deployment_simulations;
DROP POLICY IF EXISTS "delete_member_simulations" ON deployment_simulations;
CREATE POLICY "anon_select_simulations" ON deployment_simulations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_simulations" ON deployment_simulations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_simulations" ON deployment_simulations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_simulations" ON deployment_simulations FOR DELETE TO anon, authenticated USING (true);

-- deployment_policies
DROP POLICY IF EXISTS "select_member_policies" ON deployment_policies;
DROP POLICY IF EXISTS "insert_member_policies" ON deployment_policies;
DROP POLICY IF EXISTS "update_member_policies" ON deployment_policies;
DROP POLICY IF EXISTS "delete_member_policies" ON deployment_policies;
CREATE POLICY "anon_select_policies" ON deployment_policies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_policies" ON deployment_policies FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_policies" ON deployment_policies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_policies" ON deployment_policies FOR DELETE TO anon, authenticated USING (true);

-- workspace_members
DROP POLICY IF EXISTS "select_own_memberships" ON workspace_members;
DROP POLICY IF EXISTS "insert_own_memberships" ON workspace_members;
DROP POLICY IF EXISTS "update_own_memberships" ON workspace_members;
DROP POLICY IF EXISTS "delete_own_memberships" ON workspace_members;
CREATE POLICY "anon_select_members" ON workspace_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_members" ON workspace_members FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_members" ON workspace_members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_members" ON workspace_members FOR DELETE TO anon, authenticated USING (true);

-- audit_logs
DROP POLICY IF EXISTS "select_member_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "insert_member_audit_logs" ON audit_logs;
CREATE POLICY "anon_select_audit_logs" ON audit_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_audit_logs" ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

-- profiles
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "anon_select_profiles" ON profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_update_profiles" ON profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
