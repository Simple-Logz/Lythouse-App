create table if not exists public.api_test_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  name text,
  target_origin text not null,
  http_status integer,
  ok boolean,
  duration_ms integer,
  tls boolean not null default true,
  content_type text not null default '',
  error text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists api_test_runs_workspace_created_idx
  on public.api_test_runs(workspace_id, created_at desc);

alter table public.api_test_runs enable row level security;

create policy "workspace members can read api test runs"
  on public.api_test_runs for select to authenticated
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = api_test_runs.workspace_id
      and wm.user_id = auth.uid()
  ));

-- Execution records are written only by the server-side executor using the
-- service role. Authenticated clients intentionally receive no INSERT/UPDATE/
-- DELETE policy, making measured evidence immutable from the browser.
revoke insert, update, delete on public.api_test_runs from authenticated;
grant select on public.api_test_runs to authenticated;
