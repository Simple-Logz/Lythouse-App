-- Environment connections: inventory pushed by the read-only collector.
--
-- The connection TOKEN is the capability. This table is written and read ONLY
-- by the environment-ingest Edge Function (service role); it filters strictly by
-- the presented token, so one workspace cannot read another's inventory.
--
-- RLS is enabled with NO policies for anon/authenticated: the anon and
-- authenticated roles get zero direct access. Only the service role (used by the
-- Edge Function) can touch it. This holds even though the app ships the public
-- anon key — the token check happens server-side in the function.
--
-- NOTE: this table stores infrastructure INVENTORY (policy JSON, firewall rules,
-- manifests), never cloud credentials. The collector authenticates to the cloud
-- locally and transmits only results.

create table if not exists public.env_ingest (
  token       text primary key,
  provider    text not null default 'unknown',
  components  jsonb not null default '[]'::jsonb,
  synced_at   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- Only well-formed collector tokens (lhc_...) may be stored.
alter table public.env_ingest
  add constraint env_ingest_token_fmt check (token ~ '^lhc_[a-z0-9]{8,64}$');

alter table public.env_ingest enable row level security;

-- Intentionally NO policies for anon/authenticated → no direct client access.
-- The environment-ingest function uses the service role, which bypasses RLS,
-- and enforces token-scoping itself.
revoke all on public.env_ingest from anon, authenticated;
