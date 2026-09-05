-- Lythouse Analysis Platform: durable control-plane primitives.
-- Analysis runs create stage jobs; workers lease jobs and persist evidence/results.

create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  validation_id uuid references public.validations(id) on delete cascade,
  stage text not null check (stage in ('understand','investigate','resolve')),
  status text not null default 'queued' check (status in ('queued','leased','running','completed','failed','cancelled')),
  priority integer not null default 50,
  attempt integer not null default 0,
  max_attempts integer not null default 3,
  worker_id text,
  lease_expires_at timestamptz,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (analysis_run_id, stage)
);

create index if not exists analysis_jobs_claim_idx on public.analysis_jobs(status, available_at, priority desc, created_at);
create index if not exists analysis_jobs_run_idx on public.analysis_jobs(analysis_run_id, created_at);

create table if not exists public.intelligence_relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  source_component_id uuid references public.application_components(id) on delete cascade,
  target_component_id uuid references public.application_components(id) on delete cascade,
  relationship_type text not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence integer check (confidence between 0 and 100),
  created_at timestamptz not null default now()
);
create index if not exists intelligence_relationships_run_idx on public.intelligence_relationships(analysis_run_id, relationship_type);

create table if not exists public.intelligence_findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  validation_id uuid references public.validations(id) on delete cascade,
  domain text not null check (domain in ('Code','Infrastructure','DevOps','QA','Cost','Dependencies','Vendor Intelligence')),
  disposition text not null default 'guided_fix' check (disposition in ('fix_in_lythouse','guided_fix','create_incident')),
  status text not null default 'risk' check (status in ('pass','risk','opportunity','needs_investigation','not_evaluated')),
  severity text check (severity in ('low','medium','high','critical')),
  title text not null,
  observation text not null,
  inference text,
  why_it_matters text,
  production_impact text,
  business_impact text,
  recommendation text,
  verification text,
  evidence jsonb not null default '[]'::jsonb,
  external_sources jsonb not null default '[]'::jsonb,
  confidence integer check (confidence between 0 and 100),
  created_at timestamptz not null default now()
);
create index if not exists intelligence_findings_run_domain_idx on public.intelligence_findings(analysis_run_id, domain, severity);

alter table public.analysis_jobs enable row level security;
alter table public.intelligence_relationships enable row level security;
alter table public.intelligence_findings enable row level security;

-- Members may read their workspace's analysis state. Writes are performed by trusted server workers.
drop policy if exists analysis_jobs_member_read on public.analysis_jobs;
create policy analysis_jobs_member_read on public.analysis_jobs for select using (
  exists(select 1 from public.workspace_members wm where wm.workspace_id=analysis_jobs.workspace_id and wm.user_id=auth.uid())
);
drop policy if exists intelligence_relationships_member_read on public.intelligence_relationships;
create policy intelligence_relationships_member_read on public.intelligence_relationships for select using (
  exists(select 1 from public.workspace_members wm where wm.workspace_id=intelligence_relationships.workspace_id and wm.user_id=auth.uid())
);
drop policy if exists intelligence_findings_member_read on public.intelligence_findings;
create policy intelligence_findings_member_read on public.intelligence_findings for select using (
  exists(select 1 from public.workspace_members wm where wm.workspace_id=intelligence_findings.workspace_id and wm.user_id=auth.uid())
);
