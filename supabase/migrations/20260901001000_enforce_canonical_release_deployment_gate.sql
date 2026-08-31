-- Enforce the canonical release as the authoritative production gate.
create or replace function public.create_deployment_for_approved_change(p_change uuid, p_provider text default null)
returns uuid language plpgsql security definer set search_path='public' as $$
declare c public.change_requests; r public.releases; approved_count integer; unresolved_approvals integer; bad boolean; d uuid;
begin
 select * into c from public.change_requests where id=p_change and public.is_workspace_member(workspace_id);
 if c.id is null then raise exception 'change not found'; end if;
 if c.release_id is null then raise exception 'canonical release required'; end if;
 select * into r from public.releases where id=c.release_id and workspace_id=c.workspace_id and project_id=c.project_id;
 if r.id is null then raise exception 'release not found'; end if;
 if coalesce(r.blocker_count,0)>0 or r.decision='block' then raise exception 'release is blocked'; end if;
 if r.status not in ('awaiting_approval','approved') then raise exception 'release is not ready for approval'; end if;
 select count(*) filter(where status='approved'),count(*) filter(where status in ('pending','rejected')) into approved_count,unresolved_approvals from public.approvals where change_request_id=p_change;
 if approved_count<1 then raise exception 'approved decision required'; end if;
 if unresolved_approvals>0 then raise exception 'all requested approvals must be resolved and approved'; end if;
 select exists(select 1 from public.policy_evaluations where change_request_id=p_change and result='fail') into bad;
 if bad then raise exception 'blocking policy failure'; end if;
 select id into d from public.deployments where change_request_id=p_change and status in ('pending','running') order by created_at desc limit 1;
 if d is not null then return d; end if;
 insert into public.deployments(workspace_id,project_id,environment_id,change_request_id,validation_id,release_id,status,provider,deployed_by,started_at)
 values(c.workspace_id,c.project_id,c.environment_id,c.id,c.validation_id,c.release_id,'running',coalesce(p_provider,'manual'),auth.uid(),now()) returning id into d;
 update public.change_requests set status='approved',updated_at=now() where id=p_change;
 update public.releases set status='deploying',approved_at=coalesce(approved_at,now()),updated_at=now() where id=c.release_id;
 insert into public.usage_events(workspace_id,user_id,project_id,event_type,quantity,metadata) values(c.workspace_id,auth.uid(),c.project_id,'deployment.execution',1,jsonb_build_object('deployment_id',d,'change_request_id',p_change,'release_id',c.release_id));
 insert into public.audit_events(workspace_id,project_id,actor_id,action,entity_type,entity_id,metadata) values(c.workspace_id,c.project_id,auth.uid(),'deployment.started','deployment',d::text,jsonb_build_object('change_request_id',p_change,'release_id',c.release_id,'provider',coalesce(p_provider,'manual')));
 return d;
end $$;

create or replace function public.sync_release_from_approval_decision() returns trigger language plpgsql security definer set search_path='public' as $$
declare pending_count integer; rejected_count integer; approved_count integer;
begin
 if new.release_id is null then return new; end if;
 select count(*) filter(where status='pending'),count(*) filter(where status='rejected'),count(*) filter(where status='approved') into pending_count,rejected_count,approved_count from public.approvals where release_id=new.release_id;
 if rejected_count>0 then update public.releases set status='blocked',decision='block',updated_at=now() where id=new.release_id;
 elsif pending_count=0 and approved_count>0 then update public.releases set status='approved',approved_at=coalesce(approved_at,now()),updated_at=now() where id=new.release_id and blocker_count=0 and decision<>'block';
 else update public.releases set status='awaiting_approval',updated_at=now() where id=new.release_id and blocker_count=0 and decision<>'block'; end if;
 return new;
end $$;
drop trigger if exists approvals_sync_release_decision on public.approvals;
create trigger approvals_sync_release_decision after insert or update of status on public.approvals for each row execute function public.sync_release_from_approval_decision();

create or replace function public.sync_release_from_deployment() returns trigger language plpgsql security definer set search_path='public' as $$
begin
 if new.release_id is null then return new; end if;
 update public.releases set status=case when new.status in ('succeeded','completed','success') then 'deployed' when new.status in ('failed','cancelled') then 'deployment_failed' when new.status='running' then 'deploying' else status end,
 deployed_at=case when new.status in ('succeeded','completed','success') then coalesce(new.completed_at,now()) else deployed_at end,updated_at=now() where id=new.release_id;
 return new;
end $$;
drop trigger if exists deployments_sync_release on public.deployments;
create trigger deployments_sync_release after insert or update of status on public.deployments for each row execute function public.sync_release_from_deployment();