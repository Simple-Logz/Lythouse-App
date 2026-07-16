/*
# Sandbox.ai core schema

## Overview
Creates the data model for Sandbox.ai — an AI-powered pre-deployment
validation platform. Users own workspaces, workspaces contain projects,
projects are linked to a git repository and run validations. Each
validation progresses through a pipeline of ordered steps and produces
AI-generated findings (risk scores, severity flags, fix recommendations).

## Tables
1. profiles — extends auth.users with display name + avatar url.
2. workspaces — top-level tenant an engineering team owns.
3. workspace_members — membership join (owner implicitly member).
4. projects — a deployable unit within a workspace, linked to a git repo.
   git_url, git_branch, repo_folder are all required.
5. validations — a single validation run for a project.
6. validation_steps — ordered pipeline steps within a validation.
7. findings — individual AI findings produced by a validation.

## Security (RLS)
- All tables enable RLS.
- profiles: self read/update.
- workspaces: owner-scoped CRUD via owner_id; members can read.
- workspace_members: members read; owner inserts/deletes.
- projects/validations/validation_steps/findings: access scoped to
  membership in the owning workspace via workspace_members existence.
- All policies use auth.uid() and target authenticated.
- Owner columns default to auth.uid() so client inserts that omit the
  owner field still satisfy WITH CHECK.

## Notes
1. Indexes added for common lookup paths.
2. validations.workspace_id denormalized from projects for cheap RLS.
3. Trigger on_auth_user_created auto-inserts a profile row on signup.
*/

-- ===== TABLES (created first so policy references resolve) =====

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  git_url text NOT NULL,
  git_branch text NOT NULL,
  repo_folder text NOT NULL,
  language text,
  framework text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  trigger text NOT NULL DEFAULT 'manual',
  commit_sha text,
  risk_score integer,
  severity text,
  summary text,
  total_findings integer NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  high_count integer NOT NULL DEFAULT 0,
  medium_count integer NOT NULL DEFAULT 0,
  low_count integer NOT NULL DEFAULT 0,
  duration_ms integer,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS validation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id uuid NOT NULL REFERENCES validations(id) ON DELETE CASCADE,
  step_index integer NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  detail text,
  duration_ms integer,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id uuid NOT NULL REFERENCES validations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  file_path text,
  line integer,
  recommendation text,
  confidence integer,
  created_at timestamptz DEFAULT now()
);

-- ===== RLS + POLICIES =====

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- workspaces
DROP POLICY IF EXISTS "select_own_workspaces" ON workspaces;
CREATE POLICY "select_own_workspaces" ON workspaces FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR EXISTS (
    SELECT 1 FROM workspace_members m WHERE m.workspace_id = workspaces.id AND m.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "insert_own_workspaces" ON workspaces;
CREATE POLICY "insert_own_workspaces" ON workspaces FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "update_own_workspaces" ON workspaces;
CREATE POLICY "update_own_workspaces" ON workspaces FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "delete_own_workspaces" ON workspaces;
CREATE POLICY "delete_own_workspaces" ON workspaces FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);

-- workspace_members
DROP POLICY IF EXISTS "select_own_memberships" ON workspace_members;
CREATE POLICY "select_own_memberships" ON workspace_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid()
  ));
DROP POLICY IF EXISTS "insert_own_memberships" ON workspace_members;
CREATE POLICY "insert_own_memberships" ON workspace_members FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid()
  ));
DROP POLICY IF EXISTS "delete_own_memberships" ON workspace_members;
CREATE POLICY "delete_own_memberships" ON workspace_members FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid()
  ));

-- projects
DROP POLICY IF EXISTS "select_member_projects" ON projects;
CREATE POLICY "select_member_projects" ON projects FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = projects.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "insert_member_projects" ON projects;
CREATE POLICY "insert_member_projects" ON projects FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = projects.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "update_member_projects" ON projects;
CREATE POLICY "update_member_projects" ON projects FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = projects.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = projects.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "delete_member_projects" ON projects;
CREATE POLICY "delete_member_projects" ON projects FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = projects.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));

-- validations
DROP POLICY IF EXISTS "select_member_validations" ON validations;
CREATE POLICY "select_member_validations" ON validations FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = validations.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "insert_member_validations" ON validations;
CREATE POLICY "insert_member_validations" ON validations FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = validations.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "update_member_validations" ON validations;
CREATE POLICY "update_member_validations" ON validations FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = validations.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = validations.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));
DROP POLICY IF EXISTS "delete_member_validations" ON validations;
CREATE POLICY "delete_member_validations" ON validations FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = validations.workspace_id
      AND (w.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
      ))
  ));

-- validation_steps
DROP POLICY IF EXISTS "select_member_steps" ON validation_steps;
CREATE POLICY "select_member_steps" ON validation_steps FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM validations v
    WHERE v.id = validation_steps.validation_id
      AND EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = v.workspace_id
          AND (w.owner_id = auth.uid() OR EXISTS (
            SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
          ))
      )
  ));
DROP POLICY IF EXISTS "insert_member_steps" ON validation_steps;
CREATE POLICY "insert_member_steps" ON validation_steps FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM validations v
    WHERE v.id = validation_steps.validation_id
      AND EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = v.workspace_id
          AND (w.owner_id = auth.uid() OR EXISTS (
            SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
          ))
      )
  ));
DROP POLICY IF EXISTS "update_member_steps" ON validation_steps;
CREATE POLICY "update_member_steps" ON validation_steps FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM validations v
    WHERE v.id = validation_steps.validation_id
      AND EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = v.workspace_id
          AND (w.owner_id = auth.uid() OR EXISTS (
            SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
          ))
      )
  ));

-- findings
DROP POLICY IF EXISTS "select_member_findings" ON findings;
CREATE POLICY "select_member_findings" ON findings FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM validations v
    WHERE v.id = findings.validation_id
      AND EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = v.workspace_id
          AND (w.owner_id = auth.uid() OR EXISTS (
            SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
          ))
      )
  ));
DROP POLICY IF EXISTS "insert_member_findings" ON findings;
CREATE POLICY "insert_member_findings" ON findings FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM validations v
    WHERE v.id = findings.validation_id
      AND EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = v.workspace_id
          AND (w.owner_id = auth.uid() OR EXISTS (
            SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = auth.uid()
          ))
      )
  ));

-- ===== AUTO PROFILE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at desc);
CREATE INDEX IF NOT EXISTS idx_validations_project ON validations(project_id);
CREATE INDEX IF NOT EXISTS idx_validations_workspace ON validations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_validations_created_at ON validations(created_at desc);
CREATE INDEX IF NOT EXISTS idx_validation_steps_validation ON validation_steps(validation_id);
CREATE INDEX IF NOT EXISTS idx_findings_validation ON findings(validation_id);
CREATE INDEX IF NOT EXISTS idx_findings_project ON findings(project_id);
