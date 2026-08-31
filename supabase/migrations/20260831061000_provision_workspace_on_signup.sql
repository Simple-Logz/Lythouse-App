create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_ws uuid; v_name text; v_slug text;
begin
 insert into public.profiles(id,full_name,company,email) values(new.id,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'company',new.email) on conflict(id) do update set email=excluded.email;
 v_name:=coalesce(nullif(trim(new.raw_user_meta_data->>'company'),''),nullif(trim(new.raw_user_meta_data->>'full_name'),''),'My Workspace');
 v_slug:=trim(both '-' from regexp_replace(lower(v_name),'[^a-z0-9]+','-','g'))||'-'||substr(replace(new.id::text,'-',''),1,8);
 insert into public.organizations(name,slug,owner_id) values(v_name,v_slug,new.id) returning id into v_org;
 insert into public.organization_members(organization_id,user_id,role) values(v_org,new.id,'owner');
 insert into public.workspaces(organization_id,name,slug,owner_id) values(v_org,v_name,v_slug,new.id) returning id into v_ws;
 insert into public.workspace_members(workspace_id,user_id,role) values(v_ws,new.id,'owner');
 insert into public.workspace_plans(workspace_id,plan_id,status) values(v_ws,'free','active') on conflict(workspace_id) do nothing;
 return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
