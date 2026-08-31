-- Launch architecture hardening: canonical plan entitlements, project analytics and durable validation jobs.
create table if not exists public.plan_feature_entitlements (
  plan_id text not null,
  feature_key text not null,
  enabled boolean not null default true,
  primary key (plan_id, feature_key)
);

alter table public.plan_feature_entitlements enable row level security;
drop policy if exists "entitlements readable" on public.plan_feature_entitlements;
create policy "entitlements readable" on public.plan_feature_entitlements for select to authenticated using (true);

insert into public.plan_feature_entitlements(plan_id,feature_key,enabled) values
('free','github_sync',true),('free','core_validation',true),('free','ai_analysis',true),('free','validation_history',true),
('developer','github_sync',true),('developer','core_validation',true),('developer','ai_analysis',true),('developer','analytics',true),('developer','validation_history',true),('developer','api_testing',true),('developer','load_testing',true),('developer','environment_drift',true),('developer','deployment_simulation',true),
('enterprise','github_sync',true),('enterprise','core_validation',true),('enterprise','ai_analysis',true),('enterprise','analytics',true),('enterprise','validation_history',true),('enterprise','api_testing',true),('enterprise','load_testing',true),('enterprise','environment_drift',true),('enterprise','deployment_simulation',true),('enterprise','change_management',true),('enterprise','approvals',true),('enterprise','audit_log',true),('enterprise','advanced_integrations',true),('enterprise','team_roles',true),('enterprise','priority_support',true)
on conflict(plan_id,feature_key) do update set enabled=excluded.enabled;

create or replace function public.workspace_has_feature(p_workspace uuid, p_feature text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.plan_feature_entitlements e
    where e.plan_id = coalesce((select wp.plan_id::text from public.workspace_plans wp where wp.workspace_id=p_workspace limit 1),'free')
      and e.feature_key=p_feature and e.enabled=true
  );
$$;
revoke all on function public.workspace_has_feature(uuid,text) from public;
grant execute on function public.workspace_has_feature(uuid,text) to authenticated, service_role;

create table if not exists public.project_analytics (
  workspace_id uuid not null,
  project_id uuid primary key,
  validations_total bigint not null default 0,
  validations_completed bigint not null default 0,
  validations_failed bigint not null default 0,
  latest_risk_score numeric,
  latest_severity text,
  latest_validation_id uuid,
  critical_open bigint not null default 0,
  high_open bigint not null default 0,
  last_analyzed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.project_analytics enable row level security;
drop policy if exists "members read project analytics" on public.project_analytics;
create policy "members read project analytics" on public.project_analytics for select to authenticated using (
  exists(select 1 from public.workspace_members m where m.workspace_id=project_analytics.workspace_id and m.user_id=auth.uid())
);

create or replace function public.refresh_project_analytics(p_project uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_workspace uuid;
begin
  select workspace_id into v_workspace from public.projects where id=p_project;
  if v_workspace is null then return; end if;
  insert into public.project_analytics(workspace_id,project_id,validations_total,validations_completed,validations_failed,latest_risk_score,latest_severity,latest_validation_id,critical_open,high_open,last_analyzed_at,updated_at)
  select v_workspace,p_project,
    count(*),count(*) filter(where v.status='completed'),count(*) filter(where v.status='failed'),
    (array_agg(v.risk_score order by v.created_at desc) filter(where v.status='completed'))[1],
    (array_agg(v.severity order by v.created_at desc) filter(where v.status='completed'))[1],
    (array_agg(v.id order by v.created_at desc) filter(where v.status='completed'))[1],
    (select count(*) from public.findings f where f.project_id=p_project and f.severity='critical' and coalesce(f.status,'open')<>'resolved'),
    (select count(*) from public.findings f where f.project_id=p_project and f.severity='high' and coalesce(f.status,'open')<>'resolved'),
    max(v.completed_at),now()
  from public.validations v where v.project_id=p_project
  on conflict(project_id) do update set
    workspace_id=excluded.workspace_id,validations_total=excluded.validations_total,validations_completed=excluded.validations_completed,
    validations_failed=excluded.validations_failed,latest_risk_score=excluded.latest_risk_score,latest_severity=excluded.latest_severity,
    latest_validation_id=excluded.latest_validation_id,critical_open=excluded.critical_open,high_open=excluded.high_open,
    last_analyzed_at=excluded.last_analyzed_at,updated_at=now();
end $$;

create or replace function public.sync_project_analytics_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.refresh_project_analytics(coalesce(new.project_id,old.project_id)); return coalesce(new,old); end $$;
drop trigger if exists validations_sync_project_analytics on public.validations;
create trigger validations_sync_project_analytics after insert or update or delete on public.validations for each row execute function public.sync_project_analytics_trigger();
drop trigger if exists findings_sync_project_analytics on public.findings;
create trigger findings_sync_project_analytics after insert or update or delete on public.findings for each row execute function public.sync_project_analytics_trigger();

create table if not exists public.validation_jobs (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, project_id uuid not null, validation_id uuid not null unique,
  status text not null default 'queued' check(status in('queued','running','completed','failed')),
  attempts int not null default 0, max_attempts int not null default 3, available_at timestamptz not null default now(),
  locked_at timestamptz, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists validation_jobs_queue_idx on public.validation_jobs(status,available_at);
alter table public.validation_jobs enable row level security;
drop policy if exists "members read validation jobs" on public.validation_jobs;
create policy "members read validation jobs" on public.validation_jobs for select to authenticated using (
 exists(select 1 from public.workspace_members m where m.workspace_id=validation_jobs.workspace_id and m.user_id=auth.uid())
);
