-- LytHouse Full Schema
-- Run this in your new Supabase SQL editor

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self" ON profiles FOR ALL USING (auth.uid()=id) WITH CHECK (auth.uid()=id);
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles(id,full_name,email)
  VALUES(NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- WORKSPACES
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspaces_owner" ON workspaces FOR ALL USING (auth.uid()=owner_id) WITH CHECK (auth.uid()=owner_id);
CREATE POLICY "workspaces_member_read" ON workspaces FOR SELECT USING (
  EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=workspaces.id AND user_id=auth.uid())
);

-- WORKSPACE MEMBERS
CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id,user_id)
);
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wm_member_read" ON workspace_members FOR SELECT USING (
  user_id=auth.uid() OR EXISTS(SELECT 1 FROM workspaces WHERE id=workspace_id AND owner_id=auth.uid())
);
CREATE POLICY "wm_owner_write" ON workspace_members FOR ALL USING (
  EXISTS(SELECT 1 FROM workspaces WHERE id=workspace_id AND owner_id=auth.uid())
);
CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id);

-- WORKSPACE GROUPS
CREATE TABLE IF NOT EXISTS workspace_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE workspace_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wg_member_read" ON workspace_groups FOR SELECT USING (
  EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=workspace_groups.workspace_id AND user_id=auth.uid())
);
CREATE POLICY "wg_owner_write" ON workspace_groups FOR ALL USING (
  EXISTS(SELECT 1 FROM workspaces WHERE id=workspace_groups.workspace_id AND owner_id=auth.uid())
);

-- WORKSPACE GROUP MEMBERS
CREATE TABLE IF NOT EXISTS workspace_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES workspace_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id,user_id)
);
ALTER TABLE workspace_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wgm_read" ON workspace_group_members FOR SELECT USING (
  EXISTS(SELECT 1 FROM workspace_groups wg JOIN workspace_members wm ON wm.workspace_id=wg.workspace_id WHERE wg.id=workspace_group_members.group_id AND wm.user_id=auth.uid())
);
CREATE POLICY "wgm_write" ON workspace_group_members FOR ALL USING (
  EXISTS(SELECT 1 FROM workspace_groups wg JOIN workspaces w ON w.id=wg.workspace_id WHERE wg.id=workspace_group_members.group_id AND w.owner_id=auth.uid())
);

-- WORKSPACE PLANS
CREATE TABLE IF NOT EXISTS workspace_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE workspace_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wp_member_read" ON workspace_plans FOR SELECT USING (
  EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=workspace_plans.workspace_id AND user_id=auth.uid())
);
CREATE POLICY "wp_owner_write" ON workspace_plans FOR ALL USING (
  EXISTS(SELECT 1 FROM workspaces WHERE id=workspace_plans.workspace_id AND owner_id=auth.uid())
);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  git_url text NOT NULL DEFAULT '',
  git_branch text NOT NULL DEFAULT 'main',
  repo_folder text NOT NULL DEFAULT '',
  github_token text,
  language text,
  framework text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_member" ON projects FOR ALL USING (
  EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=projects.workspace_id AND user_id=auth.uid())
);
CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects(workspace_id);

-- VALIDATIONS
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
ALTER TABLE validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "validations_member" ON validations FOR ALL USING (
  EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=validations.workspace_id AND user_id=auth.uid())
);
CREATE INDEX IF NOT EXISTS validations_project_idx ON validations(project_id);
CREATE INDEX IF NOT EXISTS validations_workspace_idx ON validations(workspace_id);

-- VALIDATION STEPS
CREATE TABLE IF NOT EXISTS validation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id uuid NOT NULL REFERENCES validations(id) ON DELETE CASCADE,
  step_index integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  detail text,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE validation_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vsteps_member" ON validation_steps FOR ALL USING (
  EXISTS(SELECT 1 FROM validations v JOIN workspace_members wm ON wm.workspace_id=v.workspace_id WHERE v.id=validation_steps.validation_id AND wm.user_id=auth.uid())
);
CREATE INDEX IF NOT EXISTS vsteps_validation_idx ON validation_steps(validation_id);

-- FINDINGS
CREATE TABLE IF NOT EXISTS findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  validation_id uuid REFERENCES validations(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium',
  category text NOT NULL DEFAULT 'static_analysis',
  status text NOT NULL DEFAULT 'open',
  file_path text,
  line integer,
  confidence numeric,
  recommendation text,
  raw_output jsonb,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "findings_member" ON findings FOR ALL USING (
  EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=findings.workspace_id AND user_id=auth.uid())
);
CREATE INDEX IF NOT EXISTS findings_project_idx ON findings(project_id);
CREATE INDEX IF NOT EXISTS findings_workspace_idx ON findings(workspace_id);
CREATE INDEX IF NOT EXISTS findings_status_idx ON findings(status);

-- DEPLOYMENTS
CREATE TABLE IF NOT EXISTS deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  validation_id uuid REFERENCES validations(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'staging',
  status text NOT NULL DEFAULT 'pending',
  config_overrides jsonb DEFAULT '{}',
  deployed_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deployments_member" ON deployments FOR ALL USING (
  EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=deployments.workspace_id AND user_id=auth.uid())
);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_member_read" ON audit_logs FOR SELECT USING (
  EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=audit_logs.workspace_id AND user_id=auth.uid())
);

-- DEPLOYMENT POLICIES
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
CREATE POLICY "dp_member" ON deployment_policies FOR ALL USING (
  EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=deployment_policies.workspace_id AND user_id=auth.uid())
);

-- INCIDENTS
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'sev3',
  status text NOT NULL DEFAULT 'open',
  environment text NOT NULL DEFAULT 'production',
  detected_by text NOT NULL DEFAULT 'manual',
  root_cause text,
  resolution text,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents_member" ON incidents FOR ALL USING (
  EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=incidents.workspace_id AND user_id=auth.uid())
);

-- AI INSIGHTS
CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'recommendation',
  title text NOT NULL,
  content text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_insights_member" ON ai_insights FOR ALL USING (
  EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=ai_insights.workspace_id AND user_id=auth.uid())
);

-- Auto-create workspace member record when workspace is created
CREATE OR REPLACE FUNCTION handle_new_workspace() RETURNS trigger AS $$
BEGIN
  INSERT INTO workspace_members(workspace_id,user_id,role)
  VALUES(NEW.id,NEW.owner_id,'owner')
  ON CONFLICT DO NOTHING;
  INSERT INTO workspace_plans(workspace_id,plan_id,status)
  VALUES(NEW.id,'free','active')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_workspace_created ON workspaces;
CREATE TRIGGER on_workspace_created AFTER INSERT ON workspaces FOR EACH ROW EXECUTE FUNCTION handle_new_workspace();
