-- Change Management Hub: AI insight fields + real outcome tracking.
--
-- These columns hold the OUTPUT of the change-request-ai edge function, which
-- grounds everything it writes strictly in the change request's own real
-- validation/findings/history rows (see that function for the evidence it is
-- given — it is never allowed to invent findings, services, or numbers).
-- NULL/empty means "not generated yet" or "AI unavailable" — the UI must say
-- so plainly rather than fabricate content when these are empty.
alter table change_requests
  add column if not exists ai_summary text,
  add column if not exists ai_impact jsonb not null default '[]',
  add column if not exists ai_risk_contributors jsonb not null default '[]',
  add column if not exists ai_reviewer_comments jsonb not null default '[]',
  add column if not exists ai_rollback jsonb not null default '{}',
  add column if not exists ai_generated_at timestamptz,
  -- Bumped on every field edit so the exported PDF can show a real version
  -- number instead of a fabricated one.
  add column if not exists revision integer not null default 1;

-- Post-deployment outcome tracking. Without this, "previous similar changes"
-- has no real way to answer "was a rollback required?" — it would have to be
-- guessed. Adding 'rolled_back' as a real terminal status lets a user close
-- the loop on a change after it ships, and every future "previous changes"
-- list is then backed by an actual recorded outcome.
alter table change_requests drop constraint if exists change_requests_status_check;
alter table change_requests add constraint change_requests_status_check
  check (status in ('draft','pending_approval','approved','rejected','scheduled','completed','rolled_back','cancelled'));
