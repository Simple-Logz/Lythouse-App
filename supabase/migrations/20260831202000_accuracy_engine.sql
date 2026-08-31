-- Evidence & Accuracy Engine: measurable confidence, traceability and user feedback.
create table if not exists public.finding_evidence (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, project_id uuid not null, validation_id uuid not null, finding_id uuid not null,
 detector text not null, detector_version text, evidence_type text not null default 'code', file_path text, line_start int, line_end int,
 redacted_excerpt text, evidence_hash text, deterministic boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists finding_evidence_finding_idx on public.finding_evidence(finding_id);
alter table public.finding_evidence enable row level security;
create policy "members read finding evidence" on public.finding_evidence for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=finding_evidence.workspace_id and m.user_id=auth.uid()));

create table if not exists public.finding_verifications (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, project_id uuid not null, validation_id uuid not null, finding_id uuid not null,
 verifier text not null, verifier_version text, verdict text not null check(verdict in('confirmed','likely','needs_review','rejected')),
 rationale text, confidence numeric check(confidence between 0 and 100), created_at timestamptz not null default now()
);
alter table public.finding_verifications enable row level security;
create policy "members read finding verifications" on public.finding_verifications for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=finding_verifications.workspace_id and m.user_id=auth.uid()));

create table if not exists public.finding_feedback (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, project_id uuid not null, validation_id uuid not null, finding_id uuid not null,
 user_id uuid not null default auth.uid(), verdict text not null check(verdict in('confirmed','false_positive','unsure')), note text, created_at timestamptz not null default now(),
 unique(finding_id,user_id)
);
alter table public.finding_feedback enable row level security;
create policy "members read finding feedback" on public.finding_feedback for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=finding_feedback.workspace_id and m.user_id=auth.uid()));
create policy "members write own finding feedback" on public.finding_feedback for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.workspace_members m where m.workspace_id=finding_feedback.workspace_id and m.user_id=auth.uid()));
create policy "members update own finding feedback" on public.finding_feedback for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

alter table public.findings add column if not exists confidence_tier text;
alter table public.findings add column if not exists verification_status text;
alter table public.findings add column if not exists evidence_count int not null default 0;

create table if not exists public.accuracy_benchmark_runs (
 id uuid primary key default gen_random_uuid(), benchmark_version text not null, detector_version text, total_expected int not null default 0,total_reported int not null default 0,
 true_positive int not null default 0,false_positive int not null default 0,false_negative int not null default 0,precision numeric,recall numeric,f1 numeric,
 high_critical_precision numeric,evidence_traceability numeric,created_at timestamptz not null default now()
);
alter table public.accuracy_benchmark_runs enable row level security;
-- Benchmark results are service-only; no authenticated read policy by default.

create or replace function public.accuracy_metrics(p_workspace uuid)
returns table(confirmed bigint,false_positives bigint,unsure bigint,feedback_total bigint,observed_precision numeric)
language sql stable security definer set search_path=public as $$
 select count(*) filter(where verdict='confirmed'),count(*) filter(where verdict='false_positive'),count(*) filter(where verdict='unsure'),count(*),
 case when count(*) filter(where verdict in('confirmed','false_positive'))=0 then null else round(100.0*count(*) filter(where verdict='confirmed')/count(*) filter(where verdict in('confirmed','false_positive')),2) end
 from public.finding_feedback where workspace_id=p_workspace;
$$;
revoke all on function public.accuracy_metrics(uuid) from public;
grant execute on function public.accuracy_metrics(uuid) to authenticated,service_role;
