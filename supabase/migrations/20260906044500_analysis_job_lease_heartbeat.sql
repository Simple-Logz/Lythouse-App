-- Allow a worker that still owns a running job to extend its lease while a long analysis stage is active.
create or replace function public.renew_analysis_job_lease(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.analysis_jobs
  set lease_expires_at = now() + make_interval(secs => greatest(60, least(p_lease_seconds, 3600))),
      updated_at = now()
  where id = p_job_id
    and worker_id = p_worker_id
    and status in ('leased','running');
  return found;
end;
$$;

revoke all on function public.renew_analysis_job_lease(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.renew_analysis_job_lease(uuid,text,integer) to service_role;
