/*
# Fix circular RLS recursion between workspaces and workspace_members

## Problem
The SELECT policies on `workspaces` and `workspace_members` reference each
other, creating infinite recursion. PostgreSQL detects this and returns
zero rows for both tables — so the client sees no workspaces even though
they exist in the database.

## Fix
1. Create two SECURITY DEFINER functions that bypass RLS:
   - `is_workspace_member(ws_id, uid)` — checks workspace_membership
   - `is_workspace_owner(ws_id, uid)` — checks workspace ownership
2. Rewrite the `workspace_members` SELECT policy to use
   `is_workspace_owner()` instead of a subquery on `workspaces`.
3. Rewrite the `workspaces` SELECT policy to use `is_workspace_member()`
   instead of a subquery on `workspace_members`.

This breaks the circular dependency: the functions run with elevated
privileges and do not trigger RLS on the tables they query.

## Security
- Functions are SECURITY DEFINER, owned by the postgres role, and only
  perform read-only EXISTS checks — no data is leaked.
- All other policies remain unchanged.
*/

-- ===== SECURITY DEFINER HELPER FUNCTIONS =====
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(ws_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = ws_id AND owner_id = uid
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) TO authenticated;

-- ===== FIX workspaces SELECT policy =====
DROP POLICY IF EXISTS "select_own_workspaces" ON workspaces;
CREATE POLICY "select_own_workspaces" ON workspaces FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.is_workspace_member(id, auth.uid())
  );

-- ===== FIX workspace_members SELECT policy =====
DROP POLICY IF EXISTS "select_own_memberships" ON workspace_members;
CREATE POLICY "select_own_memberships" ON workspace_members FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_workspace_owner(workspace_id, auth.uid())
  );
