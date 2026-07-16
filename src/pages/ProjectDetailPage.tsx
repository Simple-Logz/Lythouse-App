import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase, type Project, type Validation, type ValidationStep, type Finding } from '../lib/supabase';
import { useRouter } from '../lib/router';
import { PageHeader, Breadcrumb, EmptyState, Spinner, StatusBadge, SeverityBadge, RiskGauge, StepIcon, timeAgo, fmtDuration } from '../lib/ui';
import { Play, X, GitBranch, Folder, Github, FileCode, TriangleAlert as AlertTriangle, ShieldCheck, Search, Zap, Brain, FileSearch, GitCompare, Key } from 'lucide-react';

const SI: Record<string, typeof Search> = { secret_scan: Search, static_analysis: FileSearch, dependency_audit: Zap, ai_review: Brain, diff_analysis: GitCompare };

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const { navigate } = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRun, setShowRun] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: proj }, { data: vals }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
        supabase.from('validations').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      ]);
      setProject(proj as Project | null);
      setValidations((vals ?? []) as Validation[]);
    } catch (e) { console.error('Project detail error:', e); }
    setLoading(false);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  // Poll for updates when any validation is pending or running
  useEffect(() => {
    const hasActive = validations.some(v => v.status === 'pending' || v.status === 'running');
    if (!hasActive) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from('validations').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
      if (data) setValidations(data as Validation[]);
    }, 3000);
    return () => clearInterval(interval);
  }, [validations, projectId]);

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400"><Spinner size={22} /></div>;
  if (!project) return <div className="card"><EmptyState icon={<AlertTriangle size={22} />} title="Project not found" description="This project may have been deleted." action={<button className="btn-primary" onClick={() => navigate('/projects')}>Back to projects</button>} /></div>;

  return (
    <>
      <PageHeader title={project.name} description={project.description ?? undefined} breadcrumb={<Breadcrumb items={[{ label: 'Projects', to: '/projects' }, { label: project.name }]} />} actions={<button className="btn-primary" onClick={() => setShowRun(true)}><Play size={15} /> Run validation</button>} />
      <div className="card mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="flex items-center gap-2.5 text-sm"><Github size={15} className="text-gray-400" /><div><p className="text-xs text-gray-400">Repository</p><p className="truncate font-medium text-navy-800">{project.git_url}</p></div></div>
        <div className="flex items-center gap-2.5 text-sm"><GitBranch size={15} className="text-gray-400" /><div><p className="text-xs text-gray-400">Branch</p><p className="font-medium text-navy-800">{project.git_branch}</p></div></div>
        <div className="flex items-center gap-2.5 text-sm"><Folder size={15} className="text-gray-400" /><div><p className="text-xs text-gray-400">Folder</p><p className="font-medium text-navy-800">{project.repo_folder}</p></div></div>
        <div className="flex items-center gap-2.5 text-sm"><Key size={15} className="text-gray-400" /><div><p className="text-xs text-gray-400">GitHub Token</p>{project.github_token ? <span className="font-medium text-brand-600">Configured</span> : <span className="font-medium text-amber-600">Missing</span>}</div></div>
      </div>
      {!project.github_token && <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"><AlertTriangle size={16} /> No GitHub token set for this project. Validations will fail to read your repository. Delete and recreate the project with a token.</div>}
      {validations.length === 0 ? <div className="card"><EmptyState icon={<ShieldCheck size={22} />} title="No validations yet" description="Run your first AI-powered pre-deployment validation to check for security risks." action={<button className="btn-primary" onClick={() => setShowRun(true)}><Play size={15} /> Run validation</button>} /></div>
      : <div className="space-y-4">{validations.map(v => <ValCard key={v.id} v={v} />)}</div>}
      {showRun && <RunModal projectId={projectId} workspaceId={project.workspace_id} hasToken={!!project.github_token} onClose={() => setShowRun(false)} onCreated={() => { setShowRun(false); load(); }} />}
    </>
  );
}

function ValCard({ v }: { v: Validation }) {
  const [expanded, setExpanded] = useState(false);
  const [steps, setSteps] = useState<ValidationStep[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loaded, setLoaded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadDetail() {
    try {
      const [{ data: s }, { data: f }] = await Promise.all([
        supabase.from('validation_steps').select('*').eq('validation_id', v.id).order('step_index', { ascending: true }),
        supabase.from('findings').select('*').eq('validation_id', v.id).order('created_at', { ascending: false }),
      ]);
      setSteps((s ?? []) as ValidationStep[]); setFindings((f ?? []) as Finding[]);
    } catch (e) { console.error('ValCard error:', e); }
    setLoaded(true);
  }

  // Poll for step updates while validation is active
  useEffect(() => {
    if (v.status !== 'pending' && v.status !== 'running') return;
    if (!expanded) return;
    pollRef.current = setInterval(async () => {
      const [{ data: s }, { data: f }] = await Promise.all([
        supabase.from('validation_steps').select('*').eq('validation_id', v.id).order('step_index', { ascending: true }),
        supabase.from('findings').select('*').eq('validation_id', v.id).order('created_at', { ascending: false }),
      ]);
      setSteps((s ?? []) as ValidationStep[]); setFindings((f ?? []) as Finding[]);
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [v.id, v.status, expanded]);

  return (
    <div className="card overflow-hidden">
      <button onClick={() => { setExpanded(!expanded); if (!expanded && !loaded) loadDetail(); }} className="flex w-full items-center gap-4 p-5 text-left">
        <RiskGauge score={v.risk_score} size={64} />
        <div className="flex-1">
          <div className="flex items-center gap-2"><StatusBadge status={v.status} /><SeverityBadge severity={v.severity ?? 'none'} /><span className="text-xs text-gray-400">{timeAgo(v.created_at)}</span></div>
          {v.summary && <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">{v.summary}</p>}
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-400"><span>{v.total_findings} findings</span>{v.critical_count > 0 && <span className="text-danger-600">{v.critical_count} critical</span>}{v.high_count > 0 && <span className="text-amber-600">{v.high_count} high</span>}<span>{fmtDuration(v.duration_ms)}</span></div>
        </div>
      </button>
      {expanded && loaded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {steps.length > 0 && <div className="mb-5"><h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Validation Steps</h4><div className="space-y-3">{steps.map(s => { const Icon = SI[s.key] ?? FileCode; return <div key={s.id} className="flex items-start gap-3"><StepIcon status={s.status} icon={<Icon size={14} />} /><div className="flex-1 pt-1"><div className="flex items-center justify-between"><p className="text-sm font-medium text-navy-800">{s.name}</p>{s.duration_ms !== null && <span className="text-xs text-gray-400">{fmtDuration(s.duration_ms)}</span>}</div>{s.detail && <p className="mt-0.5 text-xs text-gray-500">{s.detail}</p>}</div></div>; })}</div></div>}
          {findings.length > 0 && <div><h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Findings ({findings.length})</h4><div className="space-y-2">{findings.map(f => <div key={f.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3"><div className="flex items-center justify-between"><p className="text-sm font-medium text-navy-800">{f.title}</p><SeverityBadge severity={f.severity} /></div><p className="mt-1 text-xs text-gray-500">{f.description}</p>{f.file_path && <p className="mt-1.5 font-mono text-xs text-gray-400">{f.file_path}{f.line !== null && `:${f.line}`}</p>}{f.recommendation && <p className="mt-1.5 text-xs text-brand-700"><strong>Fix:</strong> {f.recommendation}</p>}</div>)}</div></div>}
          {findings.length === 0 && steps.length > 0 && steps.every(s => s.status === 'completed') && <div className="flex items-center gap-2 text-sm text-brand-600"><ShieldCheck size={15} /> No security findings detected.</div>}
        </div>
      )}
    </div>
  );
}

function RunModal({ projectId, workspaceId, hasToken, onClose, onCreated }: { projectId: string; workspaceId: string; hasToken: boolean; onClose: () => void; onCreated: () => void }) {
  const [commitSha, setCommitSha] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);

    // Create the validation record
    const { data, error: insertErr } = await supabase.from('validations').insert({ project_id: projectId, workspace_id: workspaceId, status: 'pending', trigger: 'manual', commit_sha: commitSha || null, total_findings: 0, critical_count: 0, high_count: 0, medium_count: 0, low_count: 0 }).select('*').single();
    if (insertErr) { setError(insertErr.message); setBusy(false); return; }

    // Trigger the edge function to process it
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      await fetch(`${supabaseUrl}/functions/v1/process-validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({ validationId: data.id }),
      });
    } catch (e) {
      console.error('Failed to trigger processing — validation will remain pending:', e);
    }

    setBusy(false);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm animate-fade-in-fast" onClick={onClose}>
      <div className="card w-full max-w-md p-7 shadow-pop animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold tracking-tight text-navy-900">Run validation</h2><button onClick={onClose} className="btn-ghost p-1.5"><X size={17} /></button></div>
        {!hasToken && <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700"><AlertTriangle size={14} /> No GitHub token set. The validation will fail to read your repo.</div>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div><label className="label" htmlFor="commit">Commit SHA <span className="text-gray-400 normal-case tracking-normal">(optional)</span></label><input id="commit" className="input font-mono" value={commitSha} onChange={e => setCommitSha(e.target.value)} placeholder="abc1234" /></div>
          {error && <p className="text-sm text-danger-600 animate-fade-in-fast">{error}</p>}
          <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" disabled={busy}>{busy ? <Spinner size={15} /> : null} Run validation</button></div>
        </form>
      </div>
    </div>
  );
}
