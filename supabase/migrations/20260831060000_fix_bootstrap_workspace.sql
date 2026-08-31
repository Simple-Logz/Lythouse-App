-- Fix all ambiguous OUT-parameter references in bootstrap_user_workspace.
create or replace function public.bootstrap_user_workspace(p_name text default null)
returns table(organization_id uuid, workspace_id uuid)
language plpgsql security definer set search_path=public as $$
#variable_conflict use_column
declare v_user uuid:=auth.uid(); v_org uuid; v_ws uuid; v_name text; v_slug text;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 select wm.workspace_id into v_ws from public.workspace_members as wm where wm.user_id=v_user order by wm.created_at asc limit 1;
 if v_ws is not null then select w.organization_id into v_org from public.workspaces as w where w.id=v_ws; organization_id:=v_org; workspace_id:=v_ws; return next; return; end if;
 select om.organization_id into v_org from public.organization_members as om where om.user_id=v_user order by om.created_at asc limit 1;
 if v_org is null then select o.id into v_org from public.organizations as o where o.owner_id=v_user order by o.created_at asc limit 1; end if;
 v_name:=coalesce(nullif(trim(p_name),''),'My Workspace'); v_slug:=trim(both '-' from regexp_replace(lower(v_name),'[^a-z0-9]+','-','g')); if v_slug='' then v_slug:='workspace'; end if; v_slug:=v_slug||'-'||substr(replace(v_user::text,'-',''),1,8);
 if v_org is null then insert into public.organizations(name,slug,owner_id) values(v_name,v_slug,v_user) returning id into v_org; end if;
 insert into public.organization_members(organization_id,user_id,role) values(v_org,v_user,'owner') on conflict do nothing;
 select w.id into v_ws from public.workspaces as w where w.organization_id=v_org and w.owner_id=v_user order by w.created_at asc limit 1;
 if v_ws is null then insert into public.workspaces(organization_id,name,slug,owner_id) values(v_org,v_name,v_slug,v_user) returning id into v_ws; end if;
 insert into public.workspace_members(workspace_id,user_id,role) values(v_ws,v_user,'owner') on conflict do nothing;
 if not exists(select 1 from public.workspace_plans as wp where wp.workspace_id=v_ws) then insert into public.workspace_plans(workspace_id,plan_id,status) values(v_ws,'free','active'); end if;
 organization_id:=v_org; workspace_id:=v_ws; return next;
end $$;
revoke all on function public.bootstrap_user_workspace(text) from public;
grant execute on function public.bootstrap_user_workspace(text) to authenticated;
