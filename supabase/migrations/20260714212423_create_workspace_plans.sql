/*
# Create workspace_plans table

1. New Tables
- `workspace_plans` — Stores the subscription plan for each workspace.
  - `id` (uuid, primary key)
  - `workspace_id` (uuid, unique — one plan per workspace, references workspaces)
  - `plan_id` (text, not null — 'free', 'developer', or 'enterprise')
  - `status` (text, default 'active' — 'active', 'cancelled', 'trialing')
  - `trial_ends_at` (timestamptz, nullable)
  - `current_period_end` (timestamptz, nullable)
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

2. Security
- Enable RLS on `workspace_plans`.
- Allow anon + authenticated CRUD (single-tenant, no auth screen — all data is intentionally shared).
*/

CREATE TABLE IF NOT EXISTS workspace_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workspace_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_workspace_plans" ON workspace_plans;
CREATE POLICY "anon_select_workspace_plans" ON workspace_plans
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_workspace_plans" ON workspace_plans;
CREATE POLICY "anon_insert_workspace_plans" ON workspace_plans
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_workspace_plans" ON workspace_plans;
CREATE POLICY "anon_update_workspace_plans" ON workspace_plans
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_workspace_plans" ON workspace_plans;
CREATE POLICY "anon_delete_workspace_plans" ON workspace_plans
  FOR DELETE TO anon, authenticated USING (true);
