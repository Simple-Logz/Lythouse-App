// @ts-nocheck
import { useEffect, useState } from 'react';
import { supabase, type ComplianceScan, type ComplianceFramework, type Project } from '../lib/supabase';
import { PageHeader, Spinner, EmptyState, StatusBadge, Breadcrumb } from '../lib/ui';
import { useRouter } from '../lib/router';
import { ClipboardCheck, Plus, X, Loader as Loader2, CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react';

const FRAMEWORKS: ComplianceFramework[] = ['SOC2', 'HIPAA', 'PCI-DSS', 'GDPR', 'ISO27001'];

const FRAMEWORK_CLS: Record<ComplianceFramework, string> = {
  SOC2: 'bg-brand-50 text-brand-700 border border-brand-200',
  HIPAA: 'bg-blue-50 text-blue-600 border border-blue-200',
  'PCI-DSS': 'bg-amber-50 text-amber-600 border border-amber-200',
  GDPR: 'bg-purple-50 text-purple-600 border border-purple-200',
  ISO27001: 'bg-navy-50 text-navy-700 border border-navy-200',
};

function scoreColor(score: number) {
  return score >= 85 ? 'text-brand-600' : score >= 70 ? 'text-amber-600' : 'text-danger-600';
}

function CompliancePage() {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [scans, setScans] = useState<ComplianceScan[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [framework, setFramework] = useState<ComplianceFramework>('SOC2');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const wsId = () => localStorage.getItem('sandbox.activeWs');

  const load = async () => {
    setLoading(true);
    const wid = wsId();
    if (!wid) { setLoading(false); return; }
    const [scansRes, projRes] = await Promise.all([
      supabase.from('compliance_scans').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }),
      supabase.from('projects').select('id,name').eq('workspace_id', wid),
    ]);
    if (scansRes.error) console.error('CompliancePage load error:', scansRes.error);
    setScans(scansRes.data ?? []);
    setProjects(projRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createScan = async () => {
    const wid = wsId();
    if (!wid || !projectId) return;
    setSaving(true); setError('');
    const { data, error } = await supabase.from('compliance_scans').insert({
      workspace_id: wid, project_id: projectId, framework, status: 'pending',
      overall_score: 0, total_controls: 0, passed_controls: 0, failed_controls: 0,
      warnings: 0, controls: [], evidence: [], recommendations: [],
    }).select().single();
    if (error) { setError(error.message); setSaving(false); return; }
    setScans(prev => [data, ...prev]);
    setCreating(false); setProjectId(''); setFramework('SOC2');
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>;

  return (
    <div>
      <PageHeader
        title="Compliance"
        description="Run and track compliance scans against security frameworks."
        breadcrumb={<Breadcrumb items={[{ label: 'Settings', to: '/settings' }, { label: 'Compliance' }]} />}
        actions={<button onClick={() => setCreating(true)} className="btn-primary"><Plus size={16} /> New scan</button>}
      />

      {scans.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={22} />} title="No compliance scans yet" description="Run a scan against SOC2, HIPAA, PCI-DSS, GDPR, or ISO27001." action={<button onClick={() => setCreating(true)} className="btn-primary"><Plus size={16} /> New scan</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scans.map(s => (
            <div key={s.id} className="card">
              <div className="flex items-center justify-between">
                <span className={`chip font-semibold ${FRAMEWORK_CLS[s.framework]}`}>{s.framework}</span>
                <StatusBadge status={s.status === 'scanning' ? 'running' : s.status === 'completed' ? 'completed' : s.status === 'failed' ? 'failed' : 'pending'} />
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className={`text-3xl font-bold tabular-nums ${scoreColor(s.overall_score)}`}>{s.overall_score}</span>
                <span className="mb-1 text-sm text-gray-400">/100</span>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-brand-600"><CheckCircle2 size={14} /> {s.passed_controls} passed</span>
                <span className="flex items-center gap-1 text-danger-600"><XCircle size={14} /> {s.failed_controls} failed</span>
                <span className="text-gray-400">{s.total_controls} total</span>
              </div>
              <p className="mt-3 text-xs text-gray-400">Scanned {new Date(s.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreating(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New compliance scan</h2>
              <button onClick={() => setCreating(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-danger-600">{error}</div>}
            <label className="label">Framework</label>
            <select className="input mb-3" value={framework} onChange={e => setFramework(e.target.value as ComplianceFramework)}>
              {FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <label className="label">Project</label>
            <select className="input mb-4" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">Select a project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="btn-secondary">Cancel</button>
              <button onClick={createScan} disabled={saving || !projectId} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Start scan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompliancePage;
