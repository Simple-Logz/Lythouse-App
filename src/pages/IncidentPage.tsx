// @ts-nocheck
import { useEffect, useState } from 'react';
import { supabase, type Incident, type Project, type Severity } from '../lib/supabase';
import { PageHeader, Spinner, EmptyState, SeverityBadge, Breadcrumb, timeAgo } from '../lib/ui';
import { useRouter } from '../lib/router';
import { OctagonAlert as AlertOctagon, Plus, X, Loader as Loader2 } from 'lucide-react';

const STATUS_CLS: Record<string, string> = {
  open: 'bg-red-50 text-danger-600 border border-red-200',
  investigating: 'bg-amber-50 text-amber-600 border border-amber-200',
  resolved: 'bg-brand-50 text-brand-700 border border-brand-200',
  closed: 'bg-gray-100 text-gray-500 border border-[#71717a]',
};

function IncidentPage() {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const wsId = () => localStorage.getItem('sandbox.activeWs');

  const load = async () => {
    setLoading(true);
    const wid = wsId();
    if (!wid) { setLoading(false); return; }
    const [incRes, projRes] = await Promise.all([
      supabase.from('incidents').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }),
      supabase.from('projects').select('id,name').eq('workspace_id', wid),
    ]);
    if (incRes.error) console.error('IncidentPage load error:', incRes.error);
    setIncidents(incRes.data ?? []);
    setProjects(projRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createIncident = async () => {
    const wid = wsId();
    if (!wid || !title.trim()) return;
    setSaving(true); setError('');
    const { data, error } = await supabase.from('incidents').insert({
      workspace_id: wid,
      project_id: projectId || null,
      title: title.trim(),
      description: description.trim(),
      severity,
      status: 'open',
    }).select().single();
    if (error) { setError(error.message); setSaving(false); return; }
    setIncidents(prev => [data, ...prev]);
    setTitle(''); setDescription(''); setSeverity('medium'); setProjectId('');
    setCreating(false); setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>;

  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Track and manage security incidents across your workspace."
        breadcrumb={<Breadcrumb items={[{ label: 'Settings', to: '/settings' }, { label: 'Incidents' }]} />}
        actions={<button onClick={() => setCreating(true)} className="btn-primary"><Plus size={16} /> New incident</button>}
      />

      {incidents.length === 0 ? (
        <EmptyState icon={<AlertOctagon size={22} />} title="No incidents recorded" description="Log a new incident to start tracking its resolution." action={<button onClick={() => setCreating(true)} className="btn-primary"><Plus size={16} /> New incident</button>} />
      ) : (
        <div className="card divide-y divide-gray-100 p-0">
          {incidents.map(inc => (
            <div key={inc.id} className="flex items-start justify-between px-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-navy-900">{inc.title}</h3>
                  <SeverityBadge severity={inc.severity} />
                  <span className={`chip capitalize ${STATUS_CLS[inc.status] ?? STATUS_CLS.open}`}>{inc.status}</span>
                </div>
                {inc.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{inc.description}</p>}
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                  <span>Opened {timeAgo(inc.created_at)}</span>
                  {inc.resolved_at && <span>· Resolved {timeAgo(inc.resolved_at)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreating(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New incident</h2>
              <button onClick={() => setCreating(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-danger-600">{error}</div>}
            <label className="label">Title</label>
            <input className="input mb-3" value={title} onChange={e => setTitle(e.target.value)} placeholder="Production outage" />
            <label className="label">Description</label>
            <textarea className="input mb-3" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What happened?" />
            <label className="label">Severity</label>
            <select className="input mb-3" value={severity} onChange={e => setSeverity(e.target.value as Severity)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <label className="label">Project (optional)</label>
            <select className="input mb-4" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">No specific project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="btn-secondary">Cancel</button>
              <button onClick={createIncident} disabled={saving || !title.trim()} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IncidentPage;
