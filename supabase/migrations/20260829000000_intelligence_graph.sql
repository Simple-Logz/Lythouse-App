create extension if not exists pgcrypto;

create table if not exists public.system_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  entity_key text not null,
  entity_type text not null check (entity_type in ('application','service','api','database','queue','external_service','infrastructure','pipeline','identity','environment','configuration')),
  name text not null,
  environment text,
  source_path text,
  attributes jsonb not null default '{}'::jsonb,
  confidence integer not null default 70 check (confidence between 0 and 100),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(project_id, entity_key)
);

create table if not exists public.system_relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  from_entity_id uuid not null references public.system_entities(id) on delete cascade,
  to_entity_id uuid not null references public.system_entities(id) on delete cascade,
  relationship_type text not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence integer not null default 70 check (confidence between 0 and 100),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(project_id, from_entity_id, to_entity_id, relationship_type)
);

create table if not exists public.validation_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  validation_id uuid not null,
  finding_id uuid,
  entity_id uuid references public.system_entities(id) on delete set null,
  evidence_type text not null,
  evidence_state text not null check (evidence_state in ('confirmed','inferred','not_detected','insufficient_evidence')),
  title text not null,
  source_path text,
  source_line integer,
  excerpt_hash text,
  details jsonb not null default '{}'::jsonb,
  confidence integer not null default 70 check (confidence between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists idx_system_entities_project on public.system_entities(project_id, entity_type);
create index if not exists idx_system_relationships_project on public.system_relationships(project_id);
create index if not exists idx_validation_evidence_validation on public.validation_evidence(validation_id, evidence_state);

alter table public.system_entities enable row level security;
alter table public.system_relationships enable row level security;
alter table public.validation_evidence enable row level security;

create policy "workspace members read system entities" on public.system_entities for select using (
  exists(select 1 from public.workspace_members wm where wm.workspace_id=system_entities.workspace_id and wm.user_id=auth.uid())
);
create policy "workspace members read system relationships" on public.system_relationships for select using (
  exists(select 1 from public.workspace_members wm where wm.workspace_id=system_relationships.workspace_id and wm.user_id=auth.uid())
);
create policy "workspace members read validation evidence" on public.validation_evidence for select using (
  exists(select 1 from public.workspace_members wm where wm.workspace_id=validation_evidence.workspace_id and wm.user_id=auth.uid())
);

revoke insert, update, delete on public.system_entities from anon, authenticated;
revoke insert, update, delete on public.system_relationships from anon, authenticated;
revoke insert, update, delete on public.validation_evidence from anon, authenticated;
