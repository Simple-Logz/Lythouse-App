import { useEffect, useMemo, useState } from 'react';
import { supabase, type AuditLog } from '../lib/supabase';
import { PageHeader, Spinner, EmptyState, Breadcrumb, timeAgo } from '../lib/ui';
import { useRouter } from '../lib/router';
import { ScrollText, Download, ListFilter as Filter } from 'lucide-react';

export function AuditLogPage() {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actionFilter, setActionFilter] = useState('all');

  const wsId = () => localStorage.getItem('sandbox.activeWs');

  const load = async () => {
    setLoading(true);
    const wid = wsId();
    if (!wid) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('workspace_id', wid)
      .order('created_at', { ascending: false });
    if (error) console.error('AuditLogPage load error:', error);
    setLogs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const actions = useMemo(() => {
    const set = new Set(logs.map(l => l.action));
    return ['all', ...Array.from(set).sort()];
  }, [logs]);

  const filtered = actionFilter === 'all' ? logs : logs.filter(l => l.action === actionFilter);

  const exportCsv = () => {
    const rows = [['action', 'entity_type', 'entity_id', 'created_at', 'metadata']];
    filtered.forEach(l => rows.push([
      l.action,
      l.entity_type ?? '',
      l.entity_id ?? '',
      l.created_at,
      JSON.stringify(l.metadata ?? {}),
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'audit-logs.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>;

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Every action taken across this workspace."
        breadcrumb={<Breadcrumb items={[{ label: 'Settings', to: '/settings' }, { label: 'Audit Log' }]} />}
        actions={<button onClick={exportCsv} disabled={!filtered.length} className="btn-secondary"><Download size={16} /> Export</button>}
      />

      <div className="mb-4 flex items-center gap-2">
        <Filter size={15} className="text-gray-400" />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="input max-w-xs">
          {actions.map(a => <option key={a} value={a}>{a === 'all' ? 'All actions' : a}</option>)}
        </select>
        <span className="text-sm text-gray-500">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ScrollText size={22} />} title="No audit entries" description="Actions performed in this workspace will appear here." />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#a1a1aa] bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Entity</th>
                  <th className="px-4 py-3 font-medium">Entity ID</th>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3"><span className="chip bg-brand-50 text-brand-700 border border-brand-200 font-mono text-xs">{l.action}</span></td>
                    <td className="px-4 py-3 text-gray-600">{l.entity_type ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{l.entity_id ? l.entity_id.slice(0, 8) : '—'}</td>
                    <td className="px-4 py-3 text-gray-500" title={l.created_at}>{timeAgo(l.created_at)}</td>
                    <td className="px-4 py-3">
                      {l.metadata && Object.keys(l.metadata).length > 0 ? (
                        <pre className="max-w-md overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-600">{JSON.stringify(l.metadata, null, 2)}</pre>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
