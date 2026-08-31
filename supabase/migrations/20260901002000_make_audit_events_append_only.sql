-- Enterprise audit evidence is append-only for authenticated users.
revoke all privileges on table public.audit_events from anon;
revoke update, delete, truncate on table public.audit_events from authenticated;
grant select, insert on table public.audit_events to authenticated;
grant all privileges on table public.audit_events to service_role;

alter table public.audit_events enable row level security;

drop policy if exists audit_events_member_select on public.audit_events;
create policy audit_events_member_select on public.audit_events for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists audit_events_member_insert on public.audit_events;
create policy audit_events_member_insert on public.audit_events for insert to authenticated with check (public.is_workspace_member(workspace_id) and actor_id=auth.uid());