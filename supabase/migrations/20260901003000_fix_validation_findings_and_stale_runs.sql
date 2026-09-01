-- Ensure validation jobs cannot remain queued/running indefinitely.
create or replace function public.fail_stale_validations(max_age interval default interval '15 minutes')
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  update public.validations
     set status='failed',
         completed_at=coalesce(completed_at,now()),
         duration_ms=coalesce(duration_ms,(extract(epoch from (now()-created_at))*1000)::bigint),
         summary=coalesce(nullif(summary,''),'Validation exceeded the execution window and was safely finalized as failed.')
   where status in ('queued','running') and created_at < now()-max_age;
  get diagnostics n=row_count;
  return n;
end $$;
revoke all on function public.fail_stale_validations(interval) from public;
grant execute on function public.fail_stale_validations(interval) to service_role;
