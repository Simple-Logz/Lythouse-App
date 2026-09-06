-- Durable wake-up mechanism for queued analysis jobs.
-- pg_cron is intentionally not assumed to exist on every environment. This function
-- is the stable database-side readiness primitive that a Supabase scheduled invocation
-- or pg_cron task can call without bypassing queue leasing semantics.

create or replace function public.analysis_jobs_ready(p_limit integer default 25)
returns table(id uuid, analysis_run_id uuid, available_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select j.id, j.analysis_run_id, j.available_at
  from public.analysis_jobs j
  where j.status = 'queued'
    and coalesce(j.available_at, now()) <= now()
  order by j.priority desc, j.available_at asc nulls first, j.created_at asc
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.analysis_jobs_ready(integer) from public, anon, authenticated;
grant execute on function public.analysis_jobs_ready(integer) to service_role;

create index if not exists idx_analysis_jobs_ready
  on public.analysis_jobs(status, available_at, priority desc)
  where status = 'queued';
