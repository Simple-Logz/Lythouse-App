-- Atomic queue claim for isolated validation workers. Service role only.
create or replace function public.claim_validation_jobs(p_limit int default 1)
returns setof public.validation_jobs
language plpgsql security definer set search_path=public as $$
begin
 return query
 with picked as (
  select id from public.validation_jobs
  where status='queued' and available_at<=now() and attempts<max_attempts
  order by available_at,created_at
  for update skip locked limit greatest(1,least(p_limit,10))
 ), updated as (
  update public.validation_jobs j set status='running',locked_at=now(),attempts=j.attempts+1,updated_at=now()
  from picked where j.id=picked.id returning j.*
 ) select * from updated;
end $$;
revoke all on function public.claim_validation_jobs(int) from public,authenticated;
grant execute on function public.claim_validation_jobs(int) to service_role;

create or replace function public.finish_validation_job(p_job uuid,p_success boolean,p_error text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.validation_jobs set status=case when p_success then 'completed' else case when attempts<max_attempts then 'queued' else 'failed' end end,
 last_error=case when p_success then null else left(p_error,1000) end,available_at=case when p_success then available_at else now()+make_interval(mins=>least(30,greatest(1,attempts*2))) end,
 locked_at=null,updated_at=now() where id=p_job;
end $$;
revoke all on function public.finish_validation_job(uuid,boolean,text) from public,authenticated;
grant execute on function public.finish_validation_job(uuid,boolean,text) to service_role;
