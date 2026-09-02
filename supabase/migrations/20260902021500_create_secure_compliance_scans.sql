-- Production compliance scan persistence.
-- The Compliance UI already reads/writes public.compliance_scans; this migration
-- makes that contract explicit and scopes all access to workspace membership.

create table if not exists public.compliance_scans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  framework text not null default 'SOC2' check (framework in ('SOC2','HIPAA','PCI-DSS','GDPR','ISO27001')),
  status text not null default 'pending' check (status in ('pending','scanning','completed','failed')),
  overall_score integer not null default 0 check (overall_score between 0 and 100),
  total_controls integer not null default 0 check (total_controls >= 0),
  passed_controls integer not null default 0 check (passed_controls >= 0),
  failed_controls integer not null default 0 check (failed_controls >= 0),
  warnings integer not null default 0 check (warnings >= 0),
  controls jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists compliance_scans_workspace_created_idx
  on public.compliance_scans(workspace_id, created_at desc);
create index if not exists compliance_scans_project_idx
  on public.compliance_scans(project_id);

alter table public.compliance_scans enable row level security;
revoke all on public.compliance_scans from anon;
grant select, insert, update, delete on public.compliance_scans to authenticated;

drop policy if exists compliance_scans_member_select on public.compliance_scans;
create policy compliance_scans_member_select
on public.compliance_scans for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = compliance_scans.workspace_id
    and wm.user_id = auth.uid()
));

drop policy if exists compliance_scans_member_insert on public.compliance_scans;
create policy compliance_scans_member_insert
on public.compliance_scans for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = compliance_scans.workspace_id
      and wm.user_id = auth.uid()
  )
  and exists (
    select 1 from public.projects p
    where p.id = compliance_scans.project_id
      and p.workspace_id = compliance_scans.workspace_id
  )
);

drop policy if exists compliance_scans_member_update on public.compliance_scans;
create policy compliance_scans_member_update
on public.compliance_scans for update to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = compliance_scans.workspace_id
    and wm.user_id = auth.uid()
))
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = compliance_scans.workspace_id
      and wm.user_id = auth.uid()
  )
  and exists (
    select 1 from public.projects p
    where p.id = compliance_scans.project_id
      and p.workspace_id = compliance_scans.workspace_id
  )
);

drop policy if exists compliance_scans_admin_delete on public.compliance_scans;
create policy compliance_scans_admin_delete
on public.compliance_scans for delete to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = compliance_scans.workspace_id
    and wm.user_id = auth.uid()
    and wm.role in ('owner','admin')
));
