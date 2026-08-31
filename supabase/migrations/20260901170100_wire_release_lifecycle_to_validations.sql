-- Automatically attach every new validation to a canonical release and keep the
-- release decision synchronized with persisted validation evidence.
create or replace function public.attach_release_to_validation() returns trigger language plpgsql security definer set search_path=public as $$
declare rid uuid; br text;
begin
 if new.release_id is not null then return new; end if;
 select coalesce(git_branch,'main') into br from public.projects where id=new.project_id and workspace_id=new.workspace_id;
 if br is null then raise exception 'Project is not in validation workspace'; end if;
 insert into public.releases(workspace_id,project_id,commit_sha,branch,status,decision,risk_score,readiness_score,blocker_count,warning_count,created_by)
 values(new.workspace_id,new.project_id,new.commit_sha,br,case when new.status='running' then 'validating' when new.status='failed' then 'failed' else 'discovered' end,'pending',new.risk_score,case when new.risk_score is null then null else greatest(0,100-new.risk_score) end,coalesce(new.critical_count,0)+coalesce(new.high_count,0),coalesce(new.medium_count,0)+coalesce(new.low_count,0),new.created_by) returning id into rid;
 new.release_id:=rid; return new;
end $$;
create or replace function public.sync_release_from_validation() returns trigger language plpgsql security definer set search_path=public as $$
declare blockers integer; warnings integer; dec text; st text;
begin
 if new.release_id is null then return new; end if;
 blockers:=coalesce(new.critical_count,0)+coalesce(new.high_count,0); warnings:=coalesce(new.medium_count,0)+coalesce(new.low_count,0);
 dec:=case when blockers>0 then 'block' when warnings>0 then 'warn' when new.status='completed' then 'pass' else 'pending' end;
 st:=case when new.status='running' then 'validating' when new.status='failed' then 'failed' when blockers>0 then 'blocked' when new.status='completed' then 'awaiting_approval' else 'discovered' end;
 update public.releases set commit_sha=new.commit_sha,status=st,decision=dec,risk_score=new.risk_score,readiness_score=case when new.risk_score is null then null else greatest(0,100-new.risk_score) end,blocker_count=blockers,warning_count=warnings,updated_at=now() where id=new.release_id and workspace_id=new.workspace_id and project_id=new.project_id;
 return new;
end $$;
drop trigger if exists validations_attach_release on public.validations;
create trigger validations_attach_release before insert on public.validations for each row execute function public.attach_release_to_validation();
drop trigger if exists validations_sync_release on public.validations;
create trigger validations_sync_release after insert or update of status,commit_sha,risk_score,critical_count,high_count,medium_count,low_count,completed_at on public.validations for each row execute function public.sync_release_from_validation();

create or replace function public.propagate_release_from_change_request() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.release_id is null and new.validation_id is not null then select release_id into new.release_id from public.validations where id=new.validation_id; end if; return new; end $$;
drop trigger if exists change_requests_attach_release on public.change_requests;
create trigger change_requests_attach_release before insert or update of validation_id on public.change_requests for each row execute function public.propagate_release_from_change_request();
create or replace function public.propagate_release_from_approval() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.release_id is null and new.change_request_id is not null then select release_id into new.release_id from public.change_requests where id=new.change_request_id; end if; return new; end $$;
drop trigger if exists approvals_attach_release on public.approvals;
create trigger approvals_attach_release before insert or update of change_request_id on public.approvals for each row execute function public.propagate_release_from_approval();
