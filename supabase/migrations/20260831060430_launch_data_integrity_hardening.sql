-- Production launch hardening: tenant persistence, RLS, and project/workspace integrity.
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;

revoke all on function public.bootstrap_user_workspace(text) from public, anon;
grant execute on function public.bootstrap_user_workspace(text) to authenticated;
revoke all on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
revoke all on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
revoke all on function public.create_deployment_for_approved_change(uuid,text) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
alter function public.handle_new_user() set search_path = public;

-- Remove duplicate broad policies left by earlier launch migrations. The canonical
-- workspace-specific policies remain in force.
drop policy if exists lythouse_launch_workspace_access on public.projects;
drop policy if exists lythouse_launch_workspace_access on public.validations;
drop policy if exists lythouse_launch_workspace_access on public.environments;
drop policy if exists lythouse_launch_workspace_access on public.usage_events;
drop policy if exists lythouse_launch_workspace_access on public.audit_events;

-- A project may never become detached from its workspace. Existing production
-- data was checked before this constraint was applied and contained zero null/orphan rows.
alter table public.projects alter column workspace_id set not null;

create or replace function public.enforce_validation_project_workspace()
returns trigger language plpgsql set search_path=public as $$
declare v_project_workspace uuid;
begin
 select p.workspace_id into v_project_workspace from public.projects p where p.id=new.project_id;
 if v_project_workspace is null then raise exception 'project does not exist or has no workspace'; end if;
 if new.workspace_id is distinct from v_project_workspace then raise exception 'validation workspace must match project workspace'; end if;
 return new;
end $$;

drop trigger if exists validations_project_workspace_guard on public.validations;
create trigger validations_project_workspace_guard
before insert or update of project_id,workspace_id on public.validations
for each row execute function public.enforce_validation_project_workspace();
revoke all on function public.enforce_validation_project_workspace() from public, anon, authenticated;
