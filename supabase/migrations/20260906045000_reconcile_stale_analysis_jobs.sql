create or replace function public.reconcile_stale_analysis_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with exhausted as (
    update public.analysis_jobs
    set status='failed',
        error=coalesce(error,'{}'::jsonb) || jsonb_build_object('message','Worker lease expired after maximum attempts','reconciled',true),
        completed_at=coalesce(completed_at,now()),
        lease_expires_at=null,
        updated_at=now()
    where status in ('leased','running')
      and lease_expires_at < now()
      and attempt >= max_attempts
    returning analysis_run_id
  ), failed_runs as (
    update public.analysis_runs r
    set status='failed',
        completed_at=coalesce(r.completed_at,now()),
        error=coalesce(r.error,'{}'::jsonb) || jsonb_build_object('message','Analysis worker exhausted retries after lease expiry','reconciled',true)
    where r.id in (select analysis_run_id from exhausted)
    returning r.id
  )
  select count(*) into v_count from failed_runs;
  return coalesce(v_count,0);
end;
$$;

revoke all on function public.reconcile_stale_analysis_jobs() from public, anon, authenticated;
grant execute on function public.reconcile_stale_analysis_jobs() to service_role;
