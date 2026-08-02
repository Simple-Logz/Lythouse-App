// @ts-nocheck
// Project Integrations — connect ticketing/collaboration tools to THIS project,
// then create and assign tickets to teammates without leaving LytHouse. Built on
// the shared integrations registry (PROVIDERS) and the create-ticket backend.
import { useEffect, useState } from 'react';
import { supabase, edgeFunctionUrl, anonKey } from '../lib/supabase';
import { PROVIDERS, getCfg, saveOne, removeOne, isConnected } from '../lib/integrations';
import { Plus, X, Check, Trash2, TicketPlus, Settings as Cog, Loader as Loader2, ChevronDown, Plug } from 'lucide-react';

function TicketComposer({ providerId, project, members, onClose }) {
  const p = PROVIDERS.find((x) => x.id === providerId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [assignee, setAssignee] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true); setResult(null);
    try {
      const cfg = { ...getCfg(providerId) };
      if (providerId === 'github' && project) { const m = (project.git_url || '').match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?(?:$|\/)/); if (m) { cfg.owner = m[1]; cfg.repo = m[2]; } }
      const who = members.find((x) => x.id === assignee);
      const fullBody = `${body}${who ? `\n\nAssigned to: ${who.name} <${who.email}>` : ''}\n\nProject: ${project?.name || '—'}`;
      const res = await fetch(edgeFunctionUrl + '/create-ticket', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + anonKey, apikey: anonKey }, body: JSON.stringify({ provider: providerId, config: cfg, ticket: { title, body: fullBody, assignee: who?.email } }) });
      const d = await res.json().catch(() => ({ error: 'Unexpected response' }));
      if (!res.ok || d.error) throw new Error(d.error || `HTTP ${res.status}`);
      setResult({ url: d.url, posted: !d.url });
    } catch (e) { setResult({ error: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg animate-scale-in rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5"><p.Logo s={22} /><h2 className="text-lg font-semibold text-navy-900">Create ticket in {p.name}</h2></div>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <label className="label">Title</label>
        <input className="input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary of the work" autoFocus />
        <label className="label">Description</label>
        <textarea className="input mb-3" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What needs to happen, and any context…" />
        <label className="label">Assign to</label>
        <select className="input mb-4" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.email ? ` · ${m.email}` : ''}</option>)}
        </select>
        {result?.url && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm"><span className="font-medium text-green-800">Ticket created.</span> <a href={result.url} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">Open ticket →</a></div>}
        {result?.posted && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Posted to {p.name}.</div>}
        {result?.error && <div className="mb-3 rounded-lg border border-[#f5a3a3] bg-[#fde3e3] px-3 py-2 text-sm text-[#c0392b]">{result.error}</div>}
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Close</button>
          <button onClick={create} disabled={busy || !title.trim()} className="btn-primary text-sm">{busy ? <Loader2 size={14} className="animate-spin" /> : <TicketPlus size={14} />}Create ticket</button>
        </div>
      </div>
    </div>
  );
}

export function ProjectIntegrationsPage({ projectId, workspaceId, project }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [configFor, setConfigFor] = useState(null);
  const [form, setForm] = useState({});
  const [ticketFor, setTicketFor] = useState(null);
  const [members, setMembers] = useState([]);
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      const { data: mem } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspaceId);
      const ids = (mem || []).map((m) => m.user_id).filter(Boolean);
      if (!ids.length) { setMembers([]); return; }
      const { data: profs } = await supabase.from('profiles').select('id,email,full_name').in('id', ids);
      setMembers((profs || []).map((p) => ({ id: p.id, name: p.full_name || p.email || 'Teammate', email: p.email })));
    })();
  }, [workspaceId]);

  const connected = PROVIDERS.filter((p) => isConnected(p.id));

  const openConfig = (id) => { setForm({ ...getCfg(id) }); setConfigFor(id); setMenuOpen(false); };
  const saveConfig = () => { saveOne(configFor, form); setConfigFor(null); refresh(); };
  const remove = (id) => { removeOne(id); refresh(); };

  const cfgProvider = configFor ? PROVIDERS.find((x) => x.id === configFor) : null;

  return (
    <div className="mx-auto max-w-5xl">
      {/* header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-navy-900"><Plug size={20} className="text-brand-600" />Integrations</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-600">Connect ticketing and collaboration tools to this project. Configure once, then create and assign tickets to your team — Jira, ServiceNow, Linear, GitHub, Slack and more — without leaving LytHouse.</p>
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen((v) => !v)} className="btn-primary flex items-center gap-1.5"><Plus size={14} />Add integration<ChevronDown size={14} /></button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-30 mt-2 max-h-[62vh] w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-lift">
                <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Choose an app</div>
                {PROVIDERS.map((p) => {
                  const conn = isConnected(p.id);
                  return (
                    <button key={p.id} onClick={() => openConfig(p.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gray-50">
                      <p.Logo s={18} /><span className="flex-1 text-sm font-medium text-navy-900">{p.name}</span>{conn && <Check size={14} className="text-green-500" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* connected list */}
      {connected.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
          <Plug size={26} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">No integrations connected yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-gray-400">Use <b>Add integration</b> to connect a ticketing or chat tool. Then create and assign tickets to your team right from this project.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {connected.map((p) => (
            <div key={p.id} className="card flex flex-col">
              <div className="flex items-center gap-3">
                <p.Logo s={26} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-navy-900">{p.name}</div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-green-600"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Connected</div>
                </div>
              </div>
              <p className="mt-2.5 flex-1 text-xs leading-relaxed text-gray-500">{p.blurb}</p>
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => setTicketFor(p.id)} className="btn-primary flex-1 justify-center text-sm"><TicketPlus size={14} />Create ticket</button>
                <button onClick={() => openConfig(p.id)} title="Configure" className="btn-secondary text-sm"><Cog size={14} /></button>
                <button onClick={() => remove(p.id)} title="Remove" className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* config modal */}
      {cfgProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfigFor(null)}>
          <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2.5"><cfgProvider.Logo s={24} /><h2 className="text-lg font-semibold text-navy-900">Connect {cfgProvider.name}</h2></div>
              <button onClick={() => setConfigFor(null)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <p className="mb-4 text-xs text-gray-500">{cfgProvider.blurb}</p>
            {cfgProvider.fields.map((f) => (
              <div key={f.k} className="mb-3">
                <label className="label">{f.label}{f.optional ? <span className="font-normal text-gray-400"> (optional)</span> : null}</label>
                <input className="input" type={f.type || 'text'} placeholder={f.ph || ''} value={form[f.k] || ''} onChange={(e) => setForm((s) => ({ ...s, [f.k]: e.target.value }))} />
              </div>
            ))}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setConfigFor(null)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={saveConfig} className="btn-primary text-sm"><Check size={14} />Add integration</button>
            </div>
          </div>
        </div>
      )}

      {/* ticket composer */}
      {ticketFor && <TicketComposer providerId={ticketFor} project={project} members={members} onClose={() => setTicketFor(null)} />}
    </div>
  );
}
export default ProjectIntegrationsPage;
