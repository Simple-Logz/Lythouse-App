// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { supabase, type Deployment, type Project, type Validation, type Finding } from '../lib/supabase';
import { Link } from '../lib/router';
import { EmptyState, Spinner, SeverityBadge, RiskGauge, timeAgo } from '../lib/ui';
import {
  ArrowLeft, Rocket, Check, X, ShieldCheck, ShieldAlert,
  AlertTriangle, FileCode2, Lightbulb, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'Pending Review', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  approved: { label: 'Approved', cls: 'bg-brand-50 text-brand-700 border border-brand-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-danger-600 border border-red-200' },
  deployed: { label: 'Deployed', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
};

const ENV_CONFIG: Record<string, string> = {
  production: 'bg-red-50 text-danger-600 border border-red-200',
  staging: 'bg-amber-50 text-amber-700 border border-amber-200',
  preview: 'bg-blue-50 text-blue-700 border border-blue-200',
};

export function DeploymentDetailPage({ deploymentId }: { deploymentId: string }) {
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: dep } = await supabase.from('deployments').select('*').eq('id', deploymentId).maybeSingle();
    if (!dep) { setLoading(false); return; }
    const d = dep as Deployment;
    setDeployment(d);
    const [{ data: proj }, { data: val }, { data: fnds }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', d.project_id).maybeSingle(),
      supabase.from('validations').select('*').eq('id', d.validation_id).maybeSingle(),
      supabase.from('findings').select('*').eq('validation_id', d.validation_id).order('created_at', { ascending: true }),
    ]);
    setProject(proj as Project | null);
    setValidation(val as Validation | null);
    setFindings((fnds ?? []) as Finding[]);
    setLoading(false);
  }, [deploymentId]);

  useEffect(() => { load(); }, [load]);

  async function submitReview(decision: 'approve' | 'reject') {
    if (!deployment) return;
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('deployments').update({
      status: decision === 'approve' ? 'approved' : 'rejected',
      reviewed_by: userData.user?.id ?? null,
      review_comment: comment || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', deployment.id);
    setBusy(false);
    setAction(null);
    setComment('');
    load();
  }

  async function markDeployed() {
    if (!deployment) return;
    setBusy(true);
    await supabase.from('deployments').update({ status: 'deployed', deployed_at: new Date().toISOString() }).eq('id', deployment.id);
    setBusy(false);
    load();
  }

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400"><Spinner size={22} /></div>;
  if (!deployment) {
    return <div className="card"><EmptyState icon={<AlertTriangle size={22} />} title="Deployment not found" description="This deployment may have been deleted or you don't have access." action={<Link to="/deployments" className="btn-primary">Back to deployments</Link>} /></div>;
  }

  const sc = STATUS_CONFIG[deployment.status] ?? STATUS_CONFIG.pending_review;
  const sevOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  const sortedFindings = [...findings].sort((a, b) => (sevOrder[b.severity as keyof typeof sevOrder] ?? 0) - (sevOrder[a.severity as keyof typeof sevOrder] ?? 0));

  return (
    <>
      <Link to="/deployments" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-navy-900">
        <ArrowLeft size={14} /> Deployments
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">{project?.name ?? 'Unknown'} — {deployment.environment}</h1>
            <span className={`chip ${sc.cls}`}>{sc.label}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Requested {timeAgo(deployment.created_at)}
            {validation?.commit_sha && <> · Commit <span className="font-mono">{validation.commit_sha.slice(0, 7)}</span></>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Gate status */}
          <div className={`card p-6 ${deployment.gate_passed ? 'border-brand-200' : 'border-red-200'}`}>
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${deployment.gate_passed ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-danger-600'}`}>
                {deployment.gate_passed ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-navy-900">{deployment.gate_passed ? 'Deployment gate passed' : 'Deployment gate blocked'}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {deployment.gate_passed
                    ? 'Validation risk score is below 50 and no critical findings were detected. This deployment is cleared for review.'
                    : 'Validation risk score is 50 or above, or critical findings were detected. Review with extra caution before approving.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                  <GateMetric label="Risk score" value={validation?.risk_score ?? '—'} ok={(validation?.risk_score ?? 0) < 50} />
                  <GateMetric label="Critical findings" value={validation?.critical_count ?? 0} ok={(validation?.critical_count ?? 0) === 0} />
                  <GateMetric label="Total findings" value={validation?.total_findings ?? 0} ok={true} />
                </div>
              </div>
            </div>
          </div>

          {/* Validation summary */}
          {validation?.summary && (
            <div className="card p-6">
              <h3 className="mb-2 text-sm font-bold text-navy-900">AI validation summary</h3>
              <p className="text-sm leading-relaxed text-gray-600">{validation.summary}</p>
              {validation.risk_score !== null && (
                <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-4">
                  <RiskGauge score={validation.risk_score} size={80} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Risk assessment</p>
                    {validation.severity && <div className="mt-1.5"><SeverityBadge severity={validation.severity} /></div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Findings */}
          {findings.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-4">
                <h3 className="text-sm font-bold text-navy-900">Findings ({findings.length})</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {sortedFindings.map((f) => (
                  <div key={f.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 ${f.severity === 'critical' ? 'text-danger-600' : f.severity === 'high' ? 'text-amber-600' : f.severity === 'medium' ? 'text-blue-600' : 'text-gray-400'}`}>
                        <ShieldAlert size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-navy-900">{f.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-2xs text-gray-500">
                          <SeverityBadge severity={f.severity} />
                          <span className="chip bg-gray-50 text-navy-600 border border-[#18181b]">{f.category.replace('_', ' ')}</span>
                          {f.file_path && <span className="flex items-center gap-1 font-mono text-gray-400"><FileCode2 size={10} /> {f.file_path}{f.line ? `:${f.line}` : ''}</span>}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.description}</p>
                        {f.recommendation && (
                          <div className="mt-2 flex gap-2 rounded-lg border border-brand-200 bg-brand-50/60 p-2.5">
                            <Lightbulb size={13} className="mt-0.5 shrink-0 text-brand-600" />
                            <p className="text-sm text-navy-700">{f.recommendation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Review panel */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-bold text-navy-900">Review actions</h3>

            {deployment.status === 'pending_review' && !action && (
              <div className="space-y-2">
                <button onClick={() => setAction('approve')} className="btn-primary w-full justify-center"><Check size={16} /> Approve deployment</button>
                <button onClick={() => setAction('reject')} className="btn-danger w-full justify-center"><X size={16} /> Reject deployment</button>
                <p className="pt-2 text-center text-xs text-gray-400">Gate: {deployment.gate_passed ? 'Passed' : 'Blocked — review with caution'}</p>
              </div>
            )}

            {deployment.status === 'pending_review' && action && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                  {action === 'approve' ? <CheckCircle2 size={16} className="text-brand-600" /> : <XCircle size={16} className="text-danger-600" />}
                  {action === 'approve' ? 'Approve' : 'Reject'} deployment
                </div>
                <textarea className="input min-h-[88px] resize-none" placeholder={action === 'approve' ? 'Optional comment for the approval…' : 'Reason for rejection (recommended)…'} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => setAction(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
                  <button onClick={() => submitReview(action)} className={`flex-1 justify-center ${action === 'approve' ? 'btn-primary' : 'btn-danger'}`} disabled={busy}>
                    {busy ? <Loader2 size={15} className="animate-spin" /> : action === 'approve' ? <Check size={15} /> : <X size={15} />}
                    Confirm {action === 'approve' ? 'approve' : 'reject'}
                  </button>
                </div>
              </div>
            )}

            {deployment.status === 'approved' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
                  <CheckCircle2 size={16} /> Approved {deployment.reviewed_at && timeAgo(deployment.reviewed_at)}
                </div>
                {deployment.review_comment && (
                  <div className="rounded-xl border border-gray-150 bg-gray-50/50 px-4 py-3">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-gray-400">Review comment</p>
                    <p className="mt-1 text-sm text-navy-700">{deployment.review_comment}</p>
                  </div>
                )}
                <button onClick={markDeployed} className="btn-primary w-full justify-center" disabled={busy}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} Mark as deployed
                </button>
              </div>
            )}

            {deployment.status === 'rejected' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-danger-600">
                  <XCircle size={16} /> Rejected {deployment.reviewed_at && timeAgo(deployment.reviewed_at)}
                </div>
                {deployment.review_comment && (
                  <div className="rounded-xl border border-gray-150 bg-gray-50/50 px-4 py-3">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-gray-400">Rejection reason</p>
                    <p className="mt-1 text-sm text-navy-700">{deployment.review_comment}</p>
                  </div>
                )}
              </div>
            )}

            {deployment.status === 'deployed' && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
                <Rocket size={16} /> Deployed {deployment.deployed_at && timeAgo(deployment.deployed_at)}
              </div>
            )}
          </div>

          {/* Deployment info */}
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-bold text-navy-900">Deployment info</h3>
            <div className="space-y-3 text-sm">
              <InfoRow label="Environment" value={<span className={`chip ${ENV_CONFIG[deployment.environment] ?? ENV_CONFIG.staging}`}>{deployment.environment}</span>} />
              <InfoRow label="Project" value={project?.name ?? '—'} />
              <InfoRow label="Branch" value={<span className="font-mono">{project?.git_branch ?? '—'}</span>} />
              <InfoRow label="Commit" value={<span className="font-mono">{validation?.commit_sha?.slice(0, 7) ?? '—'}</span>} />
              <InfoRow label="Requested" value={timeAgo(deployment.created_at)} />
              {deployment.reviewed_at && <InfoRow label="Reviewed" value={timeAgo(deployment.reviewed_at)} />}
              {deployment.deployed_at && <InfoRow label="Deployed" value={timeAgo(deployment.deployed_at)} />}
            </div>
            {validation && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <Link to={`/validations/${validation.id}`} className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
                  View validation <ArrowLeft size={13} className="rotate-180" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function GateMetric({ label, value, ok }: { label: string; value: string | number; ok: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={ok ? 'text-brand-600' : 'text-danger-600'}>{ok ? <Check size={13} /> : <X size={13} />}</span>
      <span className="text-gray-500">{label}:</span>
      <span className={`font-semibold tabular-nums ${ok ? 'text-navy-900' : 'text-danger-600'}`}>{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-navy-900">{value}</span>
    </div>
  );
}
