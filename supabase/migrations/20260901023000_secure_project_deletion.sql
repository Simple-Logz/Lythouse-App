create or replace function public.delete_project(p_project_id uuid, p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  select role into v_role from public.workspace_members where workspace_id=v_project.workspace_id and user_id=auth.uid();
  if coalesce(v_role,'') not in ('owner','admin') then raise exception 'Only workspace owners and admins can delete projects'; end if;
  if p_confirmation is distinct from v_project.name then raise exception 'Project name confirmation does not match'; end if;
  insert into public.audit_events(workspace_id,project_id,actor_id,action,entity_type,entity_id,metadata)
  values(v_project.workspace_id,v_project.id,auth.uid(),'project.deleted','project',v_project.id,jsonb_build_object('project_name',v_project.name,'git_url',v_project.git_url));
  delete from public.projects where id=v_project.id;
  return jsonb_build_object('deleted',true,'project_id',v_project.id,'project_name',v_project.name);
end;
$$;
revoke all on function public.delete_project(uuid,text) from public, anon;
grant execute on function public.delete_project(uuid,text) to authenticated;
