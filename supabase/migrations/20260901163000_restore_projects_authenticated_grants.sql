-- Restore Data API privileges required by the authenticated LytHouse project flow.
-- RLS remains authoritative: authenticated users can only access projects in
-- workspaces allowed by lythouse_projects_workspace_access.

grant select, insert, update, delete on table public.projects to authenticated;
grant all on table public.projects to service_role;

-- Projects are never directly accessible to signed-out clients.
revoke select, insert, update, delete on table public.projects from anon;
