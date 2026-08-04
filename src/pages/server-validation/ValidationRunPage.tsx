import { useEffect, useState } from 'react';
import {
  supabase,
  type ValidationRun,
  type ValidationEvidence,
  type ValidationFinding,
  type RollbackResult,
  type DeploymentPassport,
  type ProposedChange,
  type EnvironmentBlueprint,
  type ServerEnvironment,
  type Verdict,
  type ValidationRunStatus,
  VALIDATION_STEPS,
} from '../../lib/supabase';
import { PageHeader, Spinner, EmptyState, Breadcrumb, SeverityBadge, StatusBadge, timeAgo } from '../../lib/ui';
import { useRouter } from '../../lib/router';
import { CirclePlay as PlayCircle, Check, X, ChevronRight, ShieldCheck, ShieldAlert, ShieldX, FileText, RotateCcw, Boxes, Lightbulb, ArrowLeft, Download, TriangleAlert as AlertTriangle, Wrench } from 'lucide-react';

const TERMINAL_STATUSES: ValidationRunStatus[] = ['completed', 'failed', 'cancelled'];

function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return <span className="chip bg-gray-100 text-gray-500 border border-[#71717a]">No verdict</span>;
  const m: Record<Verdict, { label: string; cls: string; icon: typeof ShieldCheck }> = {
    approved: { label: 'Approved', cls: 'bg-brand-50 text-brand-700 border border-brand-200', icon: ShieldCheck },
    conditionally_approved: { label: 'Conditionally Approved', cls: 'bg-blue-50 text-blue-600 border border-blue-200', icon: ShieldCheck },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-danger-600 border border-red-200', icon: ShieldX },
    inconclusive: { label: 'Inconclusive', cls: 'bg-gray-100 text-gray-500 border border-[#71717a]', icon: ShieldAlert },
  };
  const v = m[verdict];
  const Icon = v.icon;
  return <span className={`chip ${v.cls}`}><Icon size={13} /> {v.label}</span>;
}

function ConfidenceBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-sm text-gray-400">—</span>;
  const c = Math.max(0, Math.min(100, score));
  const col = c >= 75 ? 'bg-brand-500' : c >= 50 ? 'bg-blue-500' : c >= 25 ? 'bg-amber-500' : 'bg-danger-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${col}`} style={{ width: `${c}%` }} />
      </div>
      <span className="text-sm font-semibold tabular-nums text-navy-900">{c}%</span>
    </div>
  );
}

function StepTracker({ currentStep, status }: { currentStep: number; status: string }) {
  const isTerminal = TERMINAL_STATUSES.includes(status as ValidationRunStatus);
  const isFailed = status === 'failed';
  return (
    <div className="card">
      <h3 className="mb-4 text-sm font-semibold text-navy-900">Validation Pipeline</h3>
      <div className="space-y-0">
        {VALIDATION_STEPS.map((step, i) => {
          const stepNum = i + 1;
          const completed = isTerminal ? stepNum <= currentStep || (isTerminal && !isFailed) : stepNum < currentStep;
          const running = !isTerminal && stepNum === currentStep;
          const failed = isFailed && stepNum === currentStep;
          const cls = completed
            ? 'border-brand-500 bg-brand-500 text-white'
            : running
            ? 'border-brand-500 bg-white text-brand-500'
            : failed
            ? 'border-danger-500 bg-danger-500 text-white'
            : 'border-[#71717a] bg-white text-gray-400';
          return (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${cls}`}>
                {completed ? <Check size={13} strokeWidth={3} /> : failed ? <X size={13} strokeWidth={3} /> : running ? <Spinner size={13} /> : <span className="text-xs font-semibold">{stepNum}</span>}
              </div>
              <span className={`text-sm ${completed || running ? 'font-medium text-navy-900' : 'text-gray-400'}`}>{step}</span>
              {running && <span className="ml-auto text-xs text-brand-600">in progress…</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ValidationRunPage({ runId }: { runId: string }) {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [change, setChange] = useState<ProposedChange | null>(null);
  const [blueprint, setBlueprint] = useState<EnvironmentBlueprint | null>(null);
  const [env, setEnv] = useState<ServerEnvironment | null>(null);
  const [findings, setFindings] = useState<ValidationFinding[]>([]);
  const [evidence, setEvidence] = useState<ValidationEvidence[]>([]);
  const [rollback, setRollback] = useState<RollbackResult | null>(null);
  const [passport, setPassport] = useState<DeploymentPassport | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    const { data: runData, error: runErr } = await supabase
      .from('validation_runs').select('*').eq('id', runId).single();
    if (runErr || !runData) { setError(runErr?.message ?? 'Run not found'); setLoading(false); return; }
    const r = runData as ValidationRun;
    setRun(r);

    const [chRes, bpRes, envRes, fRes, evRes, rbRes, ppRes] = await Promise.all([
      supabase.from('proposed_changes').select('*').eq('id', r.proposed_change_id).single(),
      supabase.from('environment_blueprints').select('*').eq('id', r.blueprint_id).single(),
      supabase.from('server_environments').select('*').eq('id', r.environment_id).single(),
      supabase.from('validation_findings').select('*').eq('run_id', runId).order('created_at', { ascending: false }),
      supabase.from('validation_evidence').select('*').eq('run_id', runId).order('created_at', { ascending: false }),
      supabase.from('rollback_results').select('*').eq('run_id', runId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('deployment_passports').select('*').eq('run_id', runId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (chRes.data) setChange(chRes.data as ProposedChange);
    if (bpRes.data) setBlueprint(bpRes.data as EnvironmentBlueprint);
    if (envRes.data) setEnv(envRes.data as ServerEnvironment);
    setFindings((fRes.data ?? []) as ValidationFinding[]);
    setEvidence((evRes.data ?? []) as ValidationEvidence[]);
    if (rbRes.data) setRollback(rbRes.data as RollbackResult);
    if (ppRes.data) setPassport(ppRes.data as DeploymentPassport);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // Poll if not terminal
  useEffect(() => {
    if (!run || TERMINAL_STATUSES.includes(run.status as ValidationRunStatus)) return;
    const interval = setInterval(() => { load(); }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.status]);

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>;
  if (error || !run) return (
    <EmptyState
      icon={<AlertTriangle size={22} />}
      title="Validation run not found"
      description={error || 'The requested run does not exist or has been deleted.'}
      action={<button onClick={() => navigate('/server-validation')} className="btn-primary"><ArrowLeft size={16} /> Back to environments</button>}
    />
  );

  const isRunning = !TERMINAL_STATUSES.includes(run.status as ValidationRunStatus);

  return (
    <div>
      <PageHeader
        title={`Validation Run`}
        description={env ? `${env.name} · ${run.run_type} run` : `Run ${run.id.slice(0, 8)}`}
        breadcrumb={
          <Breadcrumb items={[
            { label: 'Server Validation', to: '/server-validation' },
            ...(env ? [{ label: env.name, to: `/server-validation/${env.id}` }] : []),
            { label: 'Run' },
          ]} />
        }
        actions={
          passport ? (
            <button onClick={() => navigate(`/server-validation/passports/${runId}`)} className="btn-secondary">
              <FileText size={16} /> View Passport
            </button>
          ) : undefined
        }
      />

      {/* Header summary */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isRunning ? 'bg-blue-50 text-blue-600' : run.status === 'completed' ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-danger-600'}`}>
                <PlayCircle size={22} />
              </div>
              <div>
                <VerdictBadge verdict={run.verdict} />
                <p className="mt-1 text-xs text-gray-400">Started {run.started_at ? timeAgo(run.started_at) : '—'} · Created {timeAgo(run.created_at)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Confidence</p>
              <div className="mt-1"><ConfidenceBar score={run.confidence_score} /></div>
            </div>
          </div>
          {run.completed_at && (
            <p className="mt-3 text-xs text-gray-400">Completed {timeAgo(run.completed_at)}</p>
          )}
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Run Status</p>
          <div className="mt-2"><StatusBadge status={run.status === 'queued' ? 'pending' : run.status === 'completed' ? 'completed' : run.status === 'failed' ? 'failed' : 'running'} /></div>
          <p className="mt-3 text-xs text-gray-400">Step {run.current_step ?? 0} of {run.total_steps ?? 14}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Step tracker */}
        <div className="lg:col-span-1">
          <StepTracker currentStep={run.current_step ?? 0} status={run.status} />
        </div>

        {/* Right: Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Proposed change */}
          {change && (
            <div className="card">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900"><Boxes size={16} /> Proposed Change</h3>
              <div className="flex items-center gap-2 mb-2">
                <span className="chip bg-gray-100 text-gray-600 border border-[#71717a] capitalize">{change.change_type}</span>
                {change.artifact_name && <span className="chip bg-blue-50 text-blue-600 border border-blue-200">{change.artifact_name}</span>}
              </div>
              <p className="text-sm text-gray-600">{change.change_description}</p>
            </div>
          )}

          {/* AI Verdict */}
          {run.ai_summary && (
            <div className="card">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900"><Lightbulb size={16} /> AI Verdict</h3>
              <p className="text-sm leading-relaxed text-gray-600">{run.ai_summary}</p>
              {run.ai_root_cause && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Root Cause</p>
                  <p className="mt-1 text-sm text-gray-600">{run.ai_root_cause}</p>
                </div>
              )}
              {run.ai_remediation_steps && run.ai_remediation_steps.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Remediation Steps</p>
                  <ol className="mt-2 list-inside list-decimal space-y-1">
                    {run.ai_remediation_steps.map((s, i) => <li key={i} className="text-sm text-gray-600">{s}</li>)}
                  </ol>
                </div>
              )}
              {run.ai_affected_components && run.ai_affected_components.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Affected Components</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {run.ai_affected_components.map((c, i) => <span key={i} className="chip bg-amber-50 text-amber-600 border border-amber-200">{c}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Findings */}
          {findings.length > 0 && (
            <div className="card">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900"><ShieldAlert size={16} /> Findings ({findings.length})</h3>
              <div className="space-y-3">
                {findings.map(f => (
                  <div key={f.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <h4 className="text-sm font-semibold text-navy-900">{f.title}</h4>
                    </div>
                    <p className="mt-1.5 text-sm text-gray-500">{f.description}</p>
                    {f.remediation_steps && f.remediation_steps.length > 0 && (
                      <div className="mt-2">
                        <p className="flex items-center gap-1 text-xs font-medium text-gray-400"><Wrench size={11} /> Remediation</p>
                        <ul className="mt-1 list-inside list-disc space-y-0.5">
                          {f.remediation_steps.map((s, i) => <li key={i} className="text-sm text-gray-600">{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {evidence.length > 0 && (
            <div className="card">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900"><FileText size={16} /> Evidence ({evidence.length})</h3>
              <div className="space-y-2">
                {evidence.map(ev => (
                  <div key={ev.id} className="flex items-start justify-between rounded-lg border border-gray-100 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="chip bg-gray-100 text-gray-600 border border-[#71717a]">{ev.evidence_type}</span>
                        {ev.cited_in_verdict && <span className="chip bg-brand-50 text-brand-700 border border-brand-200">Cited</span>}
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{ev.source}</p>
                      {ev.content && Object.keys(ev.content).length > 0 && (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-50 p-2 text-xs text-gray-600">{JSON.stringify(ev.content, null, 2)}</pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rollback result */}
          {rollback && (
            <div className="card">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900"><RotateCcw size={16} /> Rollback Result</h3>
              <div className="flex items-center gap-2 mb-3">
                <span className="chip bg-gray-100 text-gray-600 border border-[#71717a] capitalize">{rollback.rollback_method}</span>
                <StatusBadge status={rollback.status === 'completed' ? 'completed' : rollback.status === 'failed' ? 'failed' : 'running'} />
              </div>
              {rollback.baseline_tests_after_rollback && Object.keys(rollback.baseline_tests_after_rollback).length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Baseline Tests After Rollback</p>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-gray-50 p-2 text-xs text-gray-600">{JSON.stringify(rollback.baseline_tests_after_rollback, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          {/* Passport link */}
          {passport && (
            <div className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><FileText size={18} /></div>
                <div>
                  <h4 className="text-sm font-semibold text-navy-900">Deployment Passport</h4>
                  <p className="text-xs text-gray-400">Verdict: {passport.verdict} · {passport.confidence_score}% confidence</p>
                </div>
              </div>
              <button onClick={() => navigate(`/server-validation/passports/${runId}`)} className="btn-secondary">
                View <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
