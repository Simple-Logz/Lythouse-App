-- Canonical release lifecycle: one authoritative object links validation, policy,
-- approval, change and deployment evidence for an enterprise release.
create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  environment_id uuid references public.environments(id) on delete set null,
  commit_sha text,
  branch text not null default 'main',
  status text not null default 'discovered' check (status in ('discovered','validating','blocked','remediating','awaiting_approval','approved','deploying','deployed','failed','cancelled')),
  decision text not null default 'pending' check (decision in ('pending','pass','warn','block')),
  risk_score integer check (risk_score is null or risk_score between 0 and 100),
  readiness_score integer check (readiness_score is null or readiness_score between 0 and 100),
  blocker_count integer not null default 0 check (blocker_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  approved_at timestamptz, deployed_at timestamptz
);
create index if not exists releases_workspace_created_idx on public.releases(workspace_id,created_at desc);
create index if not exists releases_project_created_idx on public.releases(project_id,created_at desc);
create index if not exists releases_status_idx on public.releases(workspace_id,status);
alter table public.releases enable row level security;
drop policy if exists releases_workspace_access on public.releases;
create policy releases_workspace_access on public.releases for all to authenticated using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));
grant select,insert,update,delete on public.releases to authenticated;
grant all on public.releases to service_role;
revoke all on public.releases from anon;

alter table public.validations add column if not exists release_id uuid references public.releases(id) on delete set null;
alter table public.change_requests add column if not exists release_id uuid references public.releases(id) on delete set null;
alter table public.policy_evaluations add column if not exists release_id uuid references public.releases(id) on delete set null;
alter table public.approvals add column if not exists release_id uuid references public.releases(id) on delete set null;
alter table public.deployments add column if not exists release_id uuid references public.releases(id) on delete set null;
create index if not exists validations_release_idx on public.validations(release_id);
create index if not exists change_requests_release_idx on public.change_requests(release_id);
create index if not exists policy_evaluations_release_idx on public.policy_evaluations(release_id);
create index if not exists approvals_release_idx on public.approvals(release_id);
create index if not exists deployments_release_idx on public.deployments(release_id);

with inserted as (
 insert into public.releases(workspace_id,project_id,commit_sha,branch,status,decision,risk_score,readiness_score,blocker_count,warning_count,created_by,created_at,updated_at)
 select v.workspace_id,v.project_id,v.commit_sha,coalesce(p.git_branch,'main'),
  case when v.status='running' then 'validating' when v.status='failed' then 'failed' when coalesce(v.critical_count,0)+coalesce(v.high_count,0)>0 then 'blocked' else 'discovered' end,
  case when coalesce(v.critical_count,0)+coalesce(v.high_count,0)>0 then 'block' when coalesce(v.medium_count,0)+coalesce(v.low_count,0)>0 then 'warn' when v.status='completed' then 'pass' else 'pending' end,
  v.risk_score,case when v.risk_score is null then null else greatest(0,100-v.risk_score) end,
  coalesce(v.critical_count,0)+coalesce(v.high_count,0),coalesce(v.medium_count,0)+coalesce(v.low_count,0),v.created_by,v.created_at,coalesce(v.completed_at,v.created_at)
 from public.validations v join public.projects p on p.id=v.project_id where v.release_id is null
 returning id,workspace_id,project_id,created_at
), rr as (select *,row_number() over(partition by workspace_id,project_id,created_at order by id) rn from inserted),
rv as (select id,workspace_id,project_id,created_at,row_number() over(partition by workspace_id,project_id,created_at order by id) rn from public.validations where release_id is null)
update public.validations v set release_id=r.id from rv join rr r using(workspace_id,project_id,created_at,rn) where v.id=rv.id;
update public.change_requests c set release_id=v.release_id from public.validations v where c.release_id is null and c.validation_id=v.id and v.release_id is not null;
update public.policy_evaluations p set release_id=v.release_id from public.validations v where p.release_id is null and p.validation_id=v.id and v.release_id is not null;
update public.deployments d set release_id=v.release_id from public.validations v where d.release_id is null and d.validation_id=v.id and v.release_id is not null;
update public.approvals a set release_id=c.release_id from public.change_requests c where a.release_id is null and a.change_request_id=c.id and c.release_id is not null;
