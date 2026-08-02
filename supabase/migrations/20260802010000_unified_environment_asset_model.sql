/*
# Unified Environment / Asset / Dependency / Change Event model

## Why
The app has grown two disconnected data silos:
  1. The git/project world (projects, validations, findings) — the main
     product surface today.
  2. The "server validation" world (server_environments, server_targets,
     discovered_components, dependency_edges) — a real, token-collector-fed
     infra inventory, but scoped only to on-prem/server discovery and never
     joined to #1.

This migration introduces the unified domain model — Environment, Asset,
Dependency, Change Event, linked to the existing Finding — as real new
tables, and backfills them from the real data already in both silos. It is
purely ADDITIVE: nothing existing is dropped, renamed, or altered in a
breaking way, so every current page keeps working exactly as it does today
while the new model comes online underneath it.

## What this does NOT do
It does not add live AWS/Azure/GCP/Kubernetes ingestion — there's no real
cloud account connected yet, so there's nothing real to backfill from. Those
connectors get their own asset rows (source='aws' etc.) once they exist and
actually poll something. This migration only unifies data that's already
real: your git projects and your server-collector inventory.

## Verifying after you apply this
1. `select kind, source, count(*) from assets group by 1,2;` — should show a
   `repository`/`git` row per project you have, plus `server`/`server_collector`
   rows for anything discovered_components already had.
2. `select * from asset_impact('<some asset id>');` — walks the real
   dependency graph outward from that asset.
3. Confirm existing pages (Projects, Findings, server validation) are
   unaffected — they still read the original tables directly.
*/

-- ─────────────────────────────────────────────────────────────────────────
-- environments — generic logical/physical boundary. Unifies the concept
-- server_environments already had with the (currently implicit) production
-- environment every git project ships into.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.environments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  kind text not null default 'production'
    check (kind in ('production','staging','development','multi_cloud','on_prem','kubernetes_cluster','business_unit','other')),
  status text not null default 'active'
    check (status in ('provisioning','active','degraded','maintenance','suspended','decommissioned')),
  source text not null default 'manual'
    check (source in ('git','server_collector','aws','azure','gcp','kubernetes','manual')),
  owner text,
  tags jsonb not null default '{}'::jsonb,
  server_environment_id uuid references server_environments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists environments_workspace_idx on public.environments(workspace_id);
create unique index if not exists environments_server_env_unique on public.environments(server_environment_id) where server_environment_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- assets — any identifiable technical component. Unifies projects
-- (repositories) and discovered_components/server_targets (infra) under one
-- schema, without touching either source table.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  environment_id uuid not null references environments(id) on delete cascade,
  kind text not null
    check (kind in ('repository','microservice','container_image','k8s_deployment','database','vm','api_gateway','terraform_module','saas_integration','load_balancer','storage_bucket','function','server','other')),
  name text not null,
  status text not null default 'discovered'
    check (status in ('discovered','registered','active','modified','deprecated','failed','retired')),
  source text not null default 'manual'
    check (source in ('git','server_collector','aws','azure','gcp','kubernetes','manual')),
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  project_id uuid references projects(id) on delete cascade,
  server_target_id uuid references server_targets(id) on delete cascade,
  discovered_component_id uuid references discovered_components(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assets_workspace_idx on public.assets(workspace_id);
create index if not exists assets_environment_idx on public.assets(environment_id);
create unique index if not exists assets_project_unique on public.assets(project_id) where project_id is not null;
create unique index if not exists assets_component_unique on public.assets(discovered_component_id) where discovered_component_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- asset_dependencies — directional, version-aware graph edges between
-- assets. Mirrors dependency_edges' shape but operates on the unified
-- asset id space instead of discovered_components only, so a git repo can
-- depend on a discovered database, not just component-to-component.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.asset_dependencies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  environment_id uuid references environments(id) on delete cascade,
  source_asset_id uuid not null references assets(id) on delete cascade,
  target_asset_id uuid not null references assets(id) on delete cascade,
  relationship_type text not null default 'depends_on'
    check (relationship_type in ('depends_on','contains','communicates_with','deployed_to','configured_by','references')),
  status text not null default 'detected'
    check (status in ('detected','verified','suspected','broken','degraded','resolved')),
  evidence jsonb not null default '{}'::jsonb,
  confidence numeric,
  human_confirmed boolean not null default false,
  dependency_edge_id uuid references dependency_edges(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint asset_dependencies_no_self_loop check (source_asset_id <> target_asset_id)
);
create index if not exists asset_deps_workspace_idx on public.asset_dependencies(workspace_id);
create index if not exists asset_deps_source_idx on public.asset_dependencies(source_asset_id);
create index if not exists asset_deps_target_idx on public.asset_dependencies(target_asset_id);
create unique index if not exists asset_deps_edge_unique on public.asset_dependencies(dependency_edge_id) where dependency_edge_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- change_events — any detected modification: a git commit, a deploy, an
-- infra change, a config update. validations already IS a change event for
-- the git world; this table generalizes the concept and links back to it
-- rather than duplicating its data.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.change_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  environment_id uuid references environments(id) on delete cascade,
  asset_id uuid references assets(id) on delete cascade,
  source text not null default 'manual'
    check (source in ('git_commit','git_pr_merge','deployment','config_change','scaling_event','security_policy_update','infra_change','manual')),
  title text not null,
  description text,
  external_ref text,
  status text not null default 'detected'
    check (status in ('detected','ingested','analyzing','evaluated','approved','rejected','deployed','rolled_back')),
  validation_id uuid references validations(id) on delete set null,
  deployment_id uuid references deployments(id) on delete set null,
  triggered_by uuid references profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  evaluated_at timestamptz
);
create index if not exists change_events_workspace_idx on public.change_events(workspace_id);
create index if not exists change_events_asset_idx on public.change_events(asset_id);
create unique index if not exists change_events_validation_unique on public.change_events(validation_id) where validation_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- findings — link into the unified model. Additive/nullable: every existing
-- read/write of findings that doesn't know about these columns keeps working
-- unchanged.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.findings
  add column if not exists asset_id uuid references assets(id) on delete set null,
  add column if not exists environment_id uuid references environments(id) on delete set null,
  add column if not exists change_event_id uuid references change_events(id) on delete set null,
  add column if not exists dependency_path jsonb;

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — workspace-membership-scoped from the start (unlike the tables fixed
-- in the previous two migrations, these never had an open anon policy).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.environments       enable row level security;
alter table public.assets             enable row level security;
alter table public.asset_dependencies enable row level security;
alter table public.change_events      enable row level security;

create policy "environments_all_member" on public.environments for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "assets_all_member" on public.assets for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "asset_dependencies_all_member" on public.asset_dependencies for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "change_events_all_member" on public.change_events for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- ─────────────────────────────────────────────────────────────────────────
-- Backfill — real data only, nothing invented. Every insert below is a
-- direct, honest mapping from a row that already exists.
-- ─────────────────────────────────────────────────────────────────────────

-- 1) One environment per server_environments row (1:1, source='server_collector').
insert into public.environments (workspace_id, name, kind, status, source, owner, server_environment_id, created_at, updated_at)
select se.workspace_id, se.name,
  case
    when se.environment_type ilike '%prod%' then 'production'
    when se.environment_type ilike '%stag%' then 'staging'
    when se.environment_type ilike '%dev%'  then 'development'
    else 'on_prem'
  end,
  'active', 'server_collector', se.owner, se.id, se.created_at, se.updated_at
from public.server_environments se
where not exists (select 1 from public.environments e where e.server_environment_id = se.id);

-- 2) One default "Production" git environment per workspace that has projects.
insert into public.environments (workspace_id, name, kind, status, source)
select w.id, w.name || ' — Production', 'production', 'active', 'git'
from public.workspaces w
where exists (select 1 from public.projects p where p.workspace_id = w.id)
  and not exists (select 1 from public.environments e where e.workspace_id = w.id and e.source = 'git');

-- 3) Assets from projects, into that default git environment.
insert into public.assets (workspace_id, environment_id, kind, name, status, source, external_id, project_id, created_at)
select p.workspace_id, e.id, 'repository', p.name,
  case when p.status = 'active' then 'active' else 'registered' end,
  'git', p.git_url, p.id, p.created_at
from public.projects p
join public.environments e on e.workspace_id = p.workspace_id and e.source = 'git'
where not exists (select 1 from public.assets a where a.project_id = p.id);

-- 4) Assets from discovered_components, into the matching server_collector environment.
insert into public.assets (workspace_id, environment_id, kind, name, status, source, external_id, server_target_id, discovered_component_id, metadata, created_at)
select dc.workspace_id, e.id,
  case
    when dc.component_type ilike '%data%base%' or dc.component_type ilike '%db%' then 'database'
    when dc.component_type ilike '%container%' then 'container_image'
    when dc.component_type ilike '%virtual%' or dc.component_type ilike '%vm%' then 'vm'
    when dc.component_type ilike '%service%' then 'microservice'
    when dc.component_type ilike '%load%balanc%' then 'load_balancer'
    else 'server'
  end,
  dc.name, 'discovered', 'server_collector', dc.id::text, dc.server_target_id, dc.id, coalesce(dc.evidence, '{}'::jsonb), dc.created_at
from public.discovered_components dc
join public.environments e on e.server_environment_id = dc.environment_id
where not exists (select 1 from public.assets a where a.discovered_component_id = dc.id);

-- 5) asset_dependencies from dependency_edges (component ids -> asset ids).
insert into public.asset_dependencies (workspace_id, environment_id, source_asset_id, target_asset_id, relationship_type, evidence, human_confirmed, dependency_edge_id, created_at)
select de.workspace_id, e.id, sa.id, ta.id, de.relationship_type, coalesce(de.evidence, '{}'::jsonb), de.human_confirmed, de.id, de.created_at
from public.dependency_edges de
join public.environments e on e.server_environment_id = de.environment_id
join public.assets sa on sa.discovered_component_id = de.source_component_id
join public.assets ta on ta.discovered_component_id = de.target_component_id
where sa.id <> ta.id
  and not exists (select 1 from public.asset_dependencies ad where ad.dependency_edge_id = de.id);

-- 6) change_events from validations (each validation run IS a change event
-- for the git world).
insert into public.change_events (workspace_id, environment_id, asset_id, source, title, description, external_ref, status, validation_id, created_at, evaluated_at)
select v.workspace_id, e.id, a.id,
  'manual',
  'Validation — ' || p.name,
  v.summary,
  v.commit_sha,
  case v.status
    when 'completed' then 'evaluated'
    when 'failed' then 'evaluated'
    when 'running' then 'analyzing'
    else 'detected'
  end,
  v.id, v.created_at, v.completed_at
from public.validations v
join public.projects p on p.id = v.project_id
join public.assets a on a.project_id = p.id
join public.environments e on e.workspace_id = v.workspace_id and e.source = 'git'
where not exists (select 1 from public.change_events ce where ce.validation_id = v.id);

-- 7) Link existing findings to the new model.
update public.findings f
set asset_id = a.id, environment_id = a.environment_id
from public.assets a
where a.project_id = f.project_id and f.asset_id is null;

update public.findings f
set change_event_id = ce.id
from public.change_events ce
where ce.validation_id = f.validation_id and f.change_event_id is null;

-- ─────────────────────────────────────────────────────────────────────────
-- asset_impact() — real dependency-graph traversal: "what breaks if this
-- asset changes?" Walks asset_dependencies outward, cycle-safe, depth-capped.
-- Tenant-checked internally (verifies the caller is a member of the starting
-- asset's workspace) since it's SECURITY DEFINER and callable by any
-- authenticated user with any asset id.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.asset_impact(start_asset_id uuid, max_depth int default 5)
returns table(asset_id uuid, depth int, path uuid[])
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  start_ws uuid;
begin
  select workspace_id into start_ws from public.assets where id = start_asset_id;
  if start_ws is null or not public.is_workspace_member(start_ws) then
    return;
  end if;

  return query
  with recursive impact as (
    select ad.target_asset_id as asset_id, 1 as depth, array[ad.source_asset_id, ad.target_asset_id] as path
    from public.asset_dependencies ad
    where ad.source_asset_id = start_asset_id and ad.status <> 'resolved'
    union all
    select ad.target_asset_id, impact.depth + 1, impact.path || ad.target_asset_id
    from public.asset_dependencies ad
    join impact on ad.source_asset_id = impact.asset_id
    where impact.depth < max_depth
      and ad.status <> 'resolved'
      and not (ad.target_asset_id = any(impact.path))
  )
  select distinct on (i.asset_id) i.asset_id, i.depth, i.path
  from impact i
  order by i.asset_id, i.depth;
end;
$$;
revoke all on function public.asset_impact(uuid, int) from public;
grant execute on function public.asset_impact(uuid, int) to authenticated;

/*
## After applying
1. Re-run the "verifying" queries at the top of this file.
2. Nothing in the app changes visibly yet — no page reads these tables. The
   next step is wiring real UI/queries against them (topology view, impact
   analysis on the findings/release pages) and building the AWS connector
   that will populate assets with source='aws' once real credentials exist.
*/
