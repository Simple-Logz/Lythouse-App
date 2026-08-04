import { useEffect, useState, useCallback } from 'react';
import { supabase, type Validation, type ValidationStep, type Finding, type Project } from '../lib/supabase';
import { Link, useRouter } from '../lib/router';
import { RiskGauge, SeverityBadge, StatusBadge, EmptyState, Spinner, StepIcon, timeAgo, fmtDuration } from '../lib/ui';
import {
  ArrowLeft, GitBranch, ScanLine, Brain, Gauge, FileText, ChevronRight,
  ShieldAlert, AlertTriangle, ShieldCheck, Lightbulb, FileCode2, Activity, Rocket, X,
} from 'lucide-react';

const STEP_ICONS: Record<string, typeof GitBranch> = {
  fetch: GitBranch, scan: ScanLine, analyze: Brain, score: Gauge, report: FileText,
};

export function ValidationPage({ validationId }: { validationId: string }) {
  const { navigate } = useRouter();
  const [validation, setValidation] = useState<Validation | null>(null);
  const [steps, setSteps] = useState<ValidationStep[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFinding, setActiveFinding] = useState<string | null>(null);
  const [existingDeployment, setExistingDeployment] = useState<string | null>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);

  const load = useCallback(async () => {
    const { data: v } = await supabase.from('validations').select('*').eq('id', validationId).maybeSingle();
    if (!v) { setLoading(false); return; }
    const val = v as Validation;
    setValidation(val);
    const [{ data: s }, { data: f }, { data: proj }, { data: dep }] = await Promise.all([
      supabase.from('validation_steps').select('*').eq('validation_id', validationId).order('step_index', { ascending: true }),
      supabase.from('findings').select('*').eq('validation_id', validationId).order('created_at', { ascending: true }),
      supabase.from('projects').select('*').eq('id', val.project_id).maybeSingle(),
      supabase.from('deployments').select('id').eq('validation_id', validationId).maybeSingle(),
    ]);
    setSteps((s ?? []) as ValidationStep[]);
    setFindings((f ?? []) as Finding[]);
    setProject(proj as Project | null);
    setExistingDeployment(dep?.id ?? null);
    setLoading(false);
  }, [validationId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!validation || (validation.status !== 'running' && validation.status !== 'pending')) return;
    const interval = setInterval(() => { load(); }, 1500);
    return () => clearInterval(interval);
  }, [validation?.status, load]);

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400"><Spinner size={22} /></div>;

  if (!validation) {
    return <div className="card"><EmptyState icon={<AlertTriangle size={22} />} title="Validation not found" description="This validation may have been deleted or you don't have access." action={<Link to="/projects" className="btn-primary">Back to projects</Link>} /></div>;
  }

  const isRunning = validation.status === 'running' || validation.status === 'pending';
  const sevOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  const sortedFindings = [...findings].sort((a, b) => (sevOrder[b.severity as keyof typeof sevOrder] ?? 0) - (sevOrder[a.severity as keyof typeof sevOrder] ?? 0));

  return (
    <>
      <Link to={project ? `/projects/${project.id}` : '/projects'} className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-navy-900">
        <ArrowLeft size={14} /> {project?.name ?? 'Projects'}
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">
              {validation.commit_sha ? <span className="font-mono">{validation.commit_sha.slice(0, 7)}</span> : 'Validation'}
            </h1>
            <StatusBadge status={validation.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">{project?.name ?? 'Unknown'} · {timeAgo(validation.created_at)} · {fmtDuration(validation.duration_ms)}</p>
        </div>
        <div className="flex items-center gap-4">
          {validation.risk_score !== null && (
            <>
              <RiskGauge score={validation.risk_score} size={88} />
              {validation.severity && <SeverityBadge severity={validation.severity} />}
            </>
          )}
          {validation.status === 'completed' && (
            existingDeployment ? (
              <Link to={`/deployments/${existingDeployment}`} className="btn-secondary">
                <Rocket size={15} /> View deployment
              </Link>
            ) : (
              <button onClick={() => setShowDeployModal(true)} className="btn-primary">
                <Rocket size={15} /> Request deployment
              </button>
            )
          )}
        </div>
      </div>

      {validation.summary && (
        <div className="card mb-6 p-6 animate-fade-in">
          <div className="mb-2 flex items-center gap-2">
            <FileText size={14} className="text-brand-600" />
            <h3 className="text-sm font-bold text-navy-900">AI summary</h3>
          </div>
          <p className="text-sm leading-relaxed text-gray-600">{validation.summary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Pipeline steps */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <h3 className="mb-6 text-sm font-bold text-navy-900">Pipeline</h3>
            <div className="relative">
              {steps.map((step, i) => {
                const Icon = STEP_ICONS[step.key] ?? Activity;
                const isLast = i === steps.length - 1;
                const connectorColor = step.status === 'completed' ? 'bg-brand-500' : 'bg-gray-200';
                return (
                  <div key={step.id} className="relative flex gap-3.5 pb-7 last:pb-0">
                    {!isLast && <div className={`absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-0.5 ${connectorColor} transition-colors duration-500`} />}
                    <StepIcon status={step.status} icon={<Icon size={14} />} />
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-semibold ${step.status === 'pending' ? 'text-gray-400' : 'text-navy-900'}`}>{step.name}</p>
                        {step.duration_ms !== null && <span className="text-2xs text-gray-400 tabular-nums">{fmtDuration(step.duration_ms)}</span>}
                      </div>
                      {step.detail && <p className="mt-1 text-sm leading-relaxed text-gray-500">{step.detail}</p>}
                      {step.status === 'running' && <p className="mt-1 text-xs text-brand-600">Running…</p>}
                    </div>
                  </div>
                );
              })}
              {steps.length === 0 && isRunning && (
                <div className="flex items-center gap-2 text-sm text-gray-400"><Spinner size={15} /> Initializing pipeline…</div>
              )}
            </div>
          </div>
        </div>

        {/* Findings */}
        <div className="lg:col-span-3">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-bold text-navy-900">Findings <span className="ml-1 text-gray-400">({findings.length})</span></h3>
              {isRunning && <span className="flex items-center gap-1.5 text-xs text-brand-600"><Spinner size={11} /> Analyzing…</span>}
            </div>

            {findings.length === 0 && !isRunning && (
              <EmptyState icon={<ShieldCheck size={22} />} title="No findings" description="This validation completed with no issues detected. The deployment looks clean." />
            )}

            {findings.length === 0 && isRunning && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Spinner size={22} />
                <p className="mt-3 text-sm">Waiting for analysis results…</p>
              </div>
            )}

            {findings.length > 0 && (
              <div className="divide-y divide-gray-100">
                {sortedFindings.map((f) => (
                  <FindingRow key={f.id} finding={f} expanded={activeFinding === f.id} onToggle={() => setActiveFinding(activeFinding === f.id ? null : f.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeployModal && validation && project && (
        <DeployModal
          validation={validation}
          projectName={project.name}
          onClose={() => setShowDeployModal(false)}
          onCreated={(depId) => { setShowDeployModal(false); navigate(`/deployments/${depId}`); }}
        />
      )}
    </>
  );
}

function DeployModal({ validation, projectName, onClose, onCreated }: {
  validation: Validation;
  projectName: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [environment, setEnvironment] = useState<'staging' | 'production' | 'preview'>('staging');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gatePassed = (validation.risk_score ?? 0) < 50 && validation.critical_count === 0;

  async function submit() {
    setBusy(true);
    setError(null);
    const { data, error: insErr } = await supabase
      .from('deployments')
      .insert({
        validation_id: validation.id,
        project_id: validation.project_id,
        workspace_id: validation.workspace_id,
        environment,
        gate_passed: gatePassed,
      })
      .select('id')
      .single();
    setBusy(false);
    if (insErr) { setError(insErr.message); return; }
    onCreated(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm animate-fade-in-fast" onClick={onClose}>
      <div className="card w-full max-w-md p-7 shadow-pop animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-navy-900">Request deployment</h2>
            <p className="mt-0.5 text-sm text-gray-500">{projectName} · <span className="font-mono">{validation.commit_sha?.slice(0, 7) ?? '—'}</span></p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={17} /></button>
        </div>

        <div className="mb-5">
          <div className={`flex items-center gap-3 rounded-xl border p-4 ${gatePassed ? 'border-brand-200 bg-brand-50/60' : 'border-red-200 bg-red-50/60'}`}>
            {gatePassed ? <ShieldCheck size={20} className="shrink-0 text-brand-600" /> : <ShieldAlert size={20} className="shrink-0 text-danger-600" />}
            <div>
              <p className={`text-sm font-semibold ${gatePassed ? 'text-brand-700' : 'text-danger-600'}`}>
                {gatePassed ? 'Gate passed' : 'Gate blocked'}
              </p>
              <p className="text-xs text-gray-500">
                Risk score: {validation.risk_score ?? '—'} · Critical: {validation.critical_count}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5">
          <label className="label">Target environment</label>
          <div className="grid grid-cols-3 gap-2">
            {(['preview', 'staging', 'production'] as const).map((env) => (
              <button
                key={env}
                onClick={() => setEnvironment(env)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition-colors ${
                  environment === env
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-[#71717a] bg-white text-navy-600 hover:bg-gray-50'
                }`}
              >
                {env}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-danger-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={submit} className="btn-primary" disabled={busy}>
            {busy ? <Spinner size={15} /> : <Rocket size={15} />} Submit request
          </button>
        </div>
      </div>
    </div>
  );
}

function FindingRow({ finding, expanded, onToggle }: { finding: Finding; expanded: boolean; onToggle: () => void }) {
  const sevIcon = finding.severity === 'critical' ? <ShieldAlert size={14} /> : finding.severity === 'high' ? <ShieldAlert size={14} /> : finding.severity === 'medium' ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />;
  const sevText = finding.severity === 'critical' ? 'text-danger-600' : finding.severity === 'high' ? 'text-amber-600' : finding.severity === 'medium' ? 'text-blue-600' : 'text-gray-500';

  return (
    <div className="transition-colors hover:bg-gray-50/60">
      <button onClick={onToggle} className="flex w-full items-start gap-3 px-5 py-4 text-left">
        <span className={`mt-0.5 shrink-0 ${sevText}`}>{sevIcon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-900">{finding.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-2xs text-gray-500">
            <SeverityBadge severity={finding.severity} />
            <span className="chip bg-gray-50 text-navy-600 border border-[#71717a]">{finding.category.replace('_', ' ')}</span>
            {finding.file_path && <span className="flex items-center gap-1 font-mono text-gray-400"><FileCode2 size={10} /> {finding.file_path}{finding.line ? `:${finding.line}` : ''}</span>}
            {finding.confidence !== null && <span className="text-gray-400">conf {finding.confidence}%</span>}
          </div>
        </div>
        <ChevronRight size={15} className={`mt-1 shrink-0 text-gray-300 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="animate-fade-in px-5 pb-4 pl-[48px]">
          <p className="text-sm leading-relaxed text-gray-600">{finding.description}</p>
          {finding.recommendation && (
            <div className="mt-3 flex gap-2.5 rounded-xl border border-brand-200 bg-brand-50/60 p-3.5">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-brand-600" />
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-brand-700">Recommended fix</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-700">{finding.recommendation}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
