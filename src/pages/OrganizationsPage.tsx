// @ts-nocheck
// Organizations — the top-level tenant. Create, configure and switch between
// organizations. Each is fully isolated: its own workspaces, projects and data.
import { useEffect, useState } from 'react';
import { supabase, type Organization } from '../lib/supabase';
import { PageHeader, Spinner, EmptyState } from '../lib/ui';
import { Building2, Plus, Check, X, ArrowRight, Settings as Cog } from 'lucide-react';

export function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const activeId = localStorage.getItem('sandbox.activeOrg');

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('organizations').select('*').order('created_at');
      if (error) { setNeedsMigration(true); setOrgs([]); }
      else setOrgs(data || []);
    } catch { setNeedsMigration(true); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setName(''); setDesc(''); setCreating(true); };
  const openEdit = (o: Organization) => { setEditing(o); setName(o.name); setDesc(o.description || ''); setCreating(true); };

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    if (editing) {
      await supabase.from('organizations').update({ name: name.trim(), description: desc.trim() || null }).eq('id', editing.id);
      setCreating(false); setBusy(false); load();
    } else {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Date.now();
      const { data, error } = await supabase.from('organizations').insert({ name: name.trim(), slug, description: desc.trim() || null }).select().single();
      setBusy(false);
      if (error || !data) { setNeedsMigration(true); setCreating(false); return; }
      try { await supabase.from('organization_members').insert({ organization_id: data.id }); } catch {}
      localStorage.setItem('sandbox.activeOrg', data.id); localStorage.removeItem('sandbox.activeWs');
      window.location.assign('/dashboard');
    }
  };

  const switchTo = (id: string) => { localStorage.setItem('sandbox.activeOrg', id); localStorage.removeItem('sandbox.activeWs'); window.location.assign('/dashboard'); };

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>;

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Your top-level tenants. Each organization is fully isolated — its own workspaces, projects, team and data."
        actions={<button onClick={openCreate} className="btn-primary"><Plus size={16} /> New organization</button>}
      />

      {needsMigration && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <b>One-time setup needed.</b> The organizations layer needs its database tables. Run the migration
          <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs">supabase/migrations/20260724000000_organizations.sql</code>
          in your Supabase SQL editor, then reload this page.
        </div>
      )}

      {orgs.length === 0 && !needsMigration ? (
        <EmptyState icon={<Building2 size={22} />} title="No organizations yet" description="Create your first organization to start. Workspaces, projects and stacks all live inside an organization." action={<button onClick={openCreate} className="btn-primary"><Plus size={16} /> New organization</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((o) => {
            const active = o.id === activeId;
            return (
              <div key={o.id} className={`card flex flex-col ${active ? 'ring-2 ring-brand-400' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 font-bold">{(o.name || 'O').charAt(0).toUpperCase()}</span>
                  {active && <span className="chip bg-brand-50 text-brand-700 border border-brand-200"><Check size={11} />Active</span>}
                </div>
                <h2 className="mt-3 text-lg font-bold text-navy-900">{o.name}</h2>
                <p className="mt-1 flex-1 text-sm text-gray-500">{o.description || 'No description yet.'}</p>
                <div className="mt-4 flex items-center gap-2">
                  {active
                    ? <button disabled className="btn-secondary flex-1 cursor-default justify-center">Current organization</button>
                    : <button onClick={() => switchTo(o.id)} className="btn-primary flex-1 justify-center">Switch to<ArrowRight size={14} /></button>}
                  <button onClick={() => openEdit(o)} title="Configure" className="btn-secondary"><Cog size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreating(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-navy-900">{editing ? 'Configure organization' : 'New organization'}</h2>
              <button onClick={() => setCreating(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <label className="label">Name</label>
            <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc" autoFocus />
            <label className="label">Description <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea className="input mb-4" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this organization is for…" />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setCreating(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={busy || !name.trim()} className="btn-primary">{busy ? <Spinner size={14} /> : <Check size={14} />}{editing ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default OrganizationsPage;
