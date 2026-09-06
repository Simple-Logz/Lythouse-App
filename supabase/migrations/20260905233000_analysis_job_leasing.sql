-- Atomic queue leasing for Lythouse analysis workers.
-- Worker-only RPCs are explicitly revoked from browser roles.

create or replace function public.lease_analysis_job(p_worker_id text, p_lease_seconds integer default 900)
returns setof public.analysis_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.analysis_jobs%rowtype;
begin
  select * into v_job
  from public.analysis_jobs
  where attempt < max_attempts
    and available_at <= now()
    and (
      status = 'queued'
      or (status in ('leased','running') and lease_expires_at < now())
    )
  order by priority desc, created_at asc
  for update skip locked
  limit 1;

  if v_job.id is null then return; end if;

  update public.analysis_jobs
  set status = 'leased',
      worker_id = p_worker_id,
      lease_expires_at = now() + make_interval(secs => greatest(60, p_lease_seconds)),
      attempt = attempt + 1,
      started_at = coalesce(started_at, now()),
      updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return next v_job;
end;
$$;

create or replace function public.finish_analysis_job(p_job_id uuid, p_worker_id text, p_output jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.analysis_jobs
  set status='completed', output=coalesce(p_output,'{}'::jsonb), completed_at=now(), lease_expires_at=null, updated_at=now()
  where id=p_job_id and worker_id=p_worker_id and status in ('leased','running');
  return found;
end;
$$;

create or replace function public.fail_analysis_job(p_job_id uuid, p_worker_id text, p_error jsonb, p_retry_seconds integer default 30)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.analysis_jobs
  set status=case when attempt < max_attempts then 'queued' else 'failed' end,
      error=coalesce(p_error,'{}'::jsonb),
      available_at=case when attempt < max_attempts then now()+make_interval(secs=>greatest(1,p_retry_seconds)) else available_at end,
      lease_expires_at=null,
      worker_id=case when attempt < max_attempts then null else worker_id end,
      completed_at=case when attempt < max_attempts then null else now() end,
      updated_at=now()
  where id=p_job_id and worker_id=p_worker_id and status in ('leased','running');
  return found;
end;
$$;

revoke all on function public.lease_analysis_job(text,integer) from public, anon, authenticated;
revoke all on function public.finish_analysis_job(uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.fail_analysis_job(uuid,text,jsonb,integer) from public, anon, authenticated;
grant execute on function public.lease_analysis_job(text,integer) to service_role;
grant execute on function public.finish_analysis_job(uuid,text,jsonb) to service_role;
grant execute on function public.fail_analysis_job(uuid,text,jsonb,integer) to service_role;
