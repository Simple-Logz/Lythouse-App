-- Change Management
-- Adds a formal, workspace-scoped change-request record that sits in front of
-- a production deployment. Unlike release_approvals (which tracks security/
-- platform/product sign-off on a specific release), a change_request is the
-- broader "what is changing, why, what's the risk, how do we roll back"
-- record a team files before shipping to production — and it is auto-drafted
-- from the project's own real validation data (risk score, severity counts,
-- open critical/high findings) rather than requiring someone to type it from
-- scratch. Nothing here is fabricated: every field either comes straight
-- from an existing validations/findings row, or is left for the requester to
-- fill in themselves (e.g. scheduled window, decision note).

create table if not exists change_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  validation_id uuid references validations(id) on delete set null,
  title text not null,
  environment text not null default 'production',
  risk_level text not null default 'unknown' check (risk_level in ('low','medium','high','critical','unknown')),
  summary text,
  scope text[] not null default '{}',
  risk_assessment text,
  rollback_plan text,
  -- Frozen snapshot of the validation's numbers at the moment the plan was
  -- generated, so the PDF/report a superior approves stays accurate even if
  -- the underlying validation is re-run later.
  validation_snapshot jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','rejected','scheduled','completed','cancelled')),
  requested_by uuid default auth.uid() references auth.users(id) on delete set null,
  approver_name text,
  approver_email text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists change_request_comments (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references change_requests(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table change_requests enable row level security;
alter table change_request_comments enable row level security;

drop policy if exists "change_requests_member" on change_requests;
create policy "change_requests_member" on change_requests for all to authenticated
  using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));

drop policy if exists "change_request_comments_member" on change_request_comments;
create policy "change_request_comments_member" on change_request_comments for all to authenticated
  using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));

create index if not exists change_requests_workspace_idx on change_requests(workspace_id);
create index if not exists change_requests_project_idx on change_requests(project_id);
create index if not exists change_requests_status_idx on change_requests(status);
create index if not exists change_request_comments_cr_idx on change_request_comments(change_request_id);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists change_requests_set_updated_at on change_requests;
create trigger change_requests_set_updated_at before update on change_requests
  for each row execute function set_updated_at();
