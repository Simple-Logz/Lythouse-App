create table if not exists public.github_app_installations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  installation_id bigint not null,
  account_login text not null,
  account_type text,
  repository_selection text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, installation_id)
);

alter table public.github_app_installations enable row level security;
revoke all on public.github_app_installations from anon;
grant select on public.github_app_installations to authenticated;

create policy github_app_installations_member_read on public.github_app_installations
for select to authenticated using (public.is_workspace_member(workspace_id));

alter table public.projects add column if not exists github_installation_id bigint;
alter table public.projects add column if not exists github_repository_id bigint;
alter table public.projects add column if not exists github_repository_full_name text;

comment on column public.projects.github_token is 'LEGACY ONLY: deprecated. New GitHub connections must use GitHub App installations; remove after existing connections are migrated.';
comment on table public.github_app_installations is 'GitHub App installation metadata only. No installation access token or GitHub private key is stored here.';
