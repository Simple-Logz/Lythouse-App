create or replace function public.create_organization_with_workspace(p_name text, p_description text default null)
returns table(organization_id uuid, workspace_id uuid)
language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_org uuid; v_ws uuid; v_name text; v_slug text;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 v_name:=coalesce(nullif(trim(p_name),''),'New Organization');
 v_slug:=trim(both '-' from regexp_replace(lower(v_name),'[^a-z0-9]+','-','g')); if v_slug='' then v_slug:='organization'; end if;
 v_slug:=v_slug||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
 insert into public.organizations(name,slug,description,owner_id) values(v_name,v_slug,nullif(trim(p_description),''),v_user) returning id into v_org;
 insert into public.organization_members(organization_id,user_id,role) values(v_org,v_user,'owner') on conflict do nothing;
 insert into public.workspaces(organization_id,name,slug,owner_id) values(v_org,v_name||' Workspace',v_slug||'-workspace',v_user) returning id into v_ws;
 insert into public.workspace_members(workspace_id,user_id,role) values(v_ws,v_user,'owner') on conflict do nothing;
 insert into public.workspace_plans(workspace_id,plan_id,status) values(v_ws,'free','active') on conflict (workspace_id) do nothing;
 organization_id:=v_org; workspace_id:=v_ws; return next;
end $$;
revoke all on function public.create_organization_with_workspace(text,text) from public,anon;
grant execute on function public.create_organization_with_workspace(text,text) to authenticated;

create or replace function public.create_workspace(p_organization_id uuid,p_name text,p_description text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_ws uuid; v_slug text; v_name text;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 if p_organization_id is null or not public.is_org_member(p_organization_id) then raise exception 'organization access denied'; end if;
 v_name:=coalesce(nullif(trim(p_name),''),'New Workspace');
 v_slug:=trim(both '-' from regexp_replace(lower(v_name),'[^a-z0-9]+','-','g')); if v_slug='' then v_slug:='workspace'; end if;
 v_slug:=v_slug||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
 insert into public.workspaces(organization_id,name,slug,description,owner_id) values(p_organization_id,v_name,v_slug,nullif(trim(p_description),''),v_user) returning id into v_ws;
 insert into public.workspace_members(workspace_id,user_id,role) values(v_ws,v_user,'owner') on conflict do nothing;
 insert into public.workspace_plans(workspace_id,plan_id,status) values(v_ws,'free','active') on conflict (workspace_id) do nothing;
 return v_ws;
end $$;
revoke all on function public.create_workspace(uuid,text,text) from public,anon;
grant execute on function public.create_workspace(uuid,text,text) to authenticated;
