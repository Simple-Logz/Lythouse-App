/*
# Fix circular RLS on projects, validations, validation_steps, findings

## Problem
Same circular recursion issue as workspaces/workspace_members. The SELECT
policies on projects, validations, validation_steps, and findings all use
subqueries against `workspaces` which in turn checks `workspace_members`.
With the workspaces SELECT policy now using `is_workspace_member()` (a
SECURITY DEFINER function), the recursion is already broken for direct
workspace queries. But the policies on projects/validations/etc still
use subqueries against `workspaces` — which now resolve without recursion
since the workspaces policy no longer references workspace_members in a
subquery.

However, to be safe and performant, we rewrite these policies to use the
`is_workspace_member()` and `is_workspace_owner()` helper functions
directly, eliminating all nested subqueries against `workspaces`.

## Security
- All policies still enforce workspace membership/ownership.
- No change to INSERT/UPDATE/DELETE policies (they use the same pattern
  but were not causing the recursion — only SELECT was).
*/

-- ===== projects SELECT =====
DROP POLICY IF EXISTS "select_member_projects" ON projects;
CREATE POLICY "select_member_projects" ON projects FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_owner(workspace_id, auth.uid())
    OR public.is_workspace_member(workspace_id, auth.uid())
  );

-- ===== validations SELECT =====
DROP POLICY IF EXISTS "select_member_validations" ON validations;
CREATE POLICY "select_member_validations" ON validations FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_owner(workspace_id, auth.uid())
    OR public.is_workspace_member(workspace_id, auth.uid())
  );

-- ===== validation_steps SELECT =====
DROP POLICY IF EXISTS "select_member_steps" ON validation_steps;
CREATE POLICY "select_member_steps" ON validation_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM validations v
      WHERE v.id = validation_steps.validation_id
        AND (
          public.is_workspace_owner(v.workspace_id, auth.uid())
          OR public.is_workspace_member(v.workspace_id, auth.uid())
        )
    )
  );

-- ===== findings SELECT =====
DROP POLICY IF EXISTS "select_member_findings" ON findings;
CREATE POLICY "select_member_findings" ON findings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM validations v
      WHERE v.id = findings.validation_id
        AND (
          public.is_workspace_owner(v.workspace_id, auth.uid())
          OR public.is_workspace_member(v.workspace_id, auth.uid())
        )
    )
  );

-- ===== deployments SELECT =====
DROP POLICY IF EXISTS "select_member_deployments" ON deployments;
CREATE POLICY "select_member_deployments" ON deployments FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_owner(workspace_id, auth.uid())
    OR public.is_workspace_member(workspace_id, auth.uid())
  );

-- ===== deployment_simulations SELECT =====
DROP POLICY IF EXISTS "select_member_simulations" ON deployment_simulations;
CREATE POLICY "select_member_simulations" ON deployment_simulations FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_owner(workspace_id, auth.uid())
    OR public.is_workspace_member(workspace_id, auth.uid())
  );

-- ===== deployment_policies SELECT =====
DROP POLICY IF EXISTS "select_member_policies" ON deployment_policies;
CREATE POLICY "select_member_policies" ON deployment_policies FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_owner(workspace_id, auth.uid())
    OR public.is_workspace_member(workspace_id, auth.uid())
  );

-- ===== audit_logs SELECT =====
DROP POLICY IF EXISTS "select_member_audit_logs" ON audit_logs;
CREATE POLICY "select_member_audit_logs" ON audit_logs FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_owner(workspace_id, auth.uid())
    OR public.is_workspace_member(workspace_id, auth.uid())
  );
