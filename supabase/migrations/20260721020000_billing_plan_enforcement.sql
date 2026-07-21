/*
# Billing columns + server-side plan enforcement

## What
1. Extends `workspace_plans` with the fields the Stripe webhook writes
   (stripe_subscription_id, current_period_end, cancel_at_period_end, updated_at,
   trial_ends_at) and a UNIQUE(workspace_id) constraint so the webhook can upsert.
2. Adds `current_plan(ws)` helper (SECURITY DEFINER).
3. Enforces Free-plan limits in the DB (not just hidden UI): max 1 project and
   5 validations per rolling 30 days. Paid plans are unlimited. Enforcement lives
   in BEFORE INSERT triggers so it holds regardless of client.

Apply to a staging branch and confirm the free->paid upgrade path before prod.
*/

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Extend workspace_plans
-- ─────────────────────────────────────────────────────────────────────────
alter table public.workspace_plans add column if not exists stripe_subscription_id text;
alter table public.workspace_plans add column if not exists current_period_end timestamptz;
alter table public.workspace_plans add column if not exists cancel_at_period_end boolean not null default false;
alter table public.workspace_plans add column if not exists trial_ends_at timestamptz;
alter table public.workspace_plans add column if not exists updated_at timestamptz not null default now();

-- Collapse any duplicate plan rows per workspace (keep the most recent) before
-- adding the unique constraint the webhook upsert relies on.
delete from public.workspace_plans a
using public.workspace_plans b
where a.workspace_id = b.workspace_id
  and a.created_at < b.created_at;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspace_plans_workspace_unique') then
    alter table public.workspace_plans
      add constraint workspace_plans_workspace_unique unique (workspace_id);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. current_plan(ws)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.current_plan(ws uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select plan_id from public.workspace_plans
       where workspace_id = ws
         and status in ('active','trialing')
       order by updated_at desc nulls last, created_at desc
       limit 1),
    'free'
  );
$$;
revoke all on function public.current_plan(uuid) from public;
grant execute on function public.current_plan(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Free-plan enforcement triggers
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan text := public.current_plan(NEW.workspace_id);
  n integer;
begin
  if plan = 'free' then
    select count(*) into n from public.projects where workspace_id = NEW.workspace_id;
    if n >= 1 then
      raise exception 'Free plan is limited to 1 project. Upgrade to add more.'
        using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_enforce_project_limit on public.projects;
create trigger trg_enforce_project_limit before insert on public.projects
  for each row execute function public.enforce_project_limit();

create or replace function public.enforce_validation_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan text := public.current_plan(NEW.workspace_id);
  n integer;
begin
  if plan = 'free' then
    select count(*) into n from public.validations
      where workspace_id = NEW.workspace_id
        and created_at > now() - interval '30 days';
    if n >= 5 then
      raise exception 'Free plan is limited to 5 validations per 30 days. Upgrade for unlimited runs.'
        using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_enforce_validation_limit on public.validations;
create trigger trg_enforce_validation_limit before insert on public.validations
  for each row execute function public.enforce_validation_limit();
