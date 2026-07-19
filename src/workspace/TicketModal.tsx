// @ts-nocheck
import { useState } from 'react';
import { X, Copy, Check, Loader as Loader2, Plug } from 'lucide-react';
import { edgeFunctionUrl, anonKey } from '../lib/supabase';
import { useRouter } from '../lib/router';
import { PROVIDERS, getCfg, isConnected } from '../lib/integrations';

const sevLabel = (s) => (s === 'high' ? 'Blocker / High' : s === 'medium' ? 'Needs Attention / Medium' : 'Low');
// Ticketing providers offered in the composer (create/post capable).
const TICKET_IDS = ['jira', 'azureboards', 'linear', 'github', 'servicenow', 'slack', 'msteams'];

export function TicketModal({ finding, project, onClose }) {
  const { navigate } = useRouter();
  const providers = PROVIDERS.filter((p) => TICKET_IDS.includes(p.id));
  const [provider, setProvider] = useState('jira');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState(`[${(finding.severity || 'medium').toUpperCase()}] ${finding.title}`);
  const [body, setBody] = useState(
    `Project: ${project?.name || '—'}\nFile: ${finding.file || '—'}${finding.line ? `:${finding.line}` : ''}\nSeverity: ${sevLabel(finding.severity)}\n${finding.owner ? `Suggested owner: ${finding.owner}\n` : ''}\n${finding.detail || finding.title}\n\nBusiness impact: ${finding.impact || 'Increases deployment risk.'}\n\nAcceptance criteria:\n- Resolve the issue in the referenced file\n- Re-run the Lythouse assessment and confirm it clears`
  );

  const P = providers.find((p) => p.id === provider);
  const connected = isConnected(provider);

  const copy = () => { navigator.clipboard?.writeText(`${title}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const goIntegrations = () => { onClose(); navigate('/integrations'); };

  const createTicket = async () => {
    setBusy(true); setResult(null);
    try {
      const cfg = { ...getCfg(provider) };
      if (provider === 'github' && project) { const m = (project.git_url || '').match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?(?:$|\/)/); if (m) { cfg.owner = m[1]; cfg.repo = m[2]; } }
      const res = await fetch(edgeFunctionUrl + '/create-ticket', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + anonKey, apikey: anonKey }, body: JSON.stringify({ provider, config: cfg, ticket: { title, body } }) });
      const d = await res.json().catch(() => ({ error: 'Unexpected response' }));
      if (!res.ok || d.error) throw new Error(d.error || `HTTP ${res.status}`);
      setResult({ url: d.url, posted: !d.url });
    } catch (e) { setResult({ error: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg animate-scale-in rounded-xl bg-white p-5 shadow-xl overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create ticket</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        {/* Provider picker with colored logos + connected dot */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {providers.map((p) => {
            const active = provider === p.id; const conn = isConnected(p.id);
            return (
              <button key={p.id} onClick={() => { setProvider(p.id); setResult(null); }} className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-2.5 transition-all ${active ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                {conn && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#0f9a4c]" title="Connected" />}
                <p.Logo s={22} />
                <span className={`text-[10px] font-medium leading-tight text-center ${active ? 'text-brand-700' : 'text-gray-600'}`}>{p.name}</span>
              </button>
            );
          })}
        </div>

        <label className="label">Title</label>
        <input className="input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="label">Description</label>
        <textarea className="input mb-3 font-mono text-xs" rows={7} value={body} onChange={(e) => setBody(e.target.value)} />

        {result?.url && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm"><span className="font-medium text-green-800">Ticket created.</span> <a href={result.url} target="_blank" rel="noreferrer" className="text-brand-700 font-semibold hover:underline">Open ticket →</a></div>}
        {result?.posted && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Posted to {P.name}.</div>}
        {result?.error && <div className="mb-3 rounded-lg border border-[#f5a3a3] bg-[#fde3e3] px-3 py-2 text-sm text-[#c0392b]">{result.error}</div>}

        {!connected ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-navy-800"><Plug size={15} className="text-brand-600" /><span><span className="font-semibold">{P.name}</span> isn’t connected yet.</span></div>
            <button onClick={goIntegrations} className="btn-primary text-sm shrink-0">Connect in Integrations →</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={createTicket} disabled={busy} className="btn-primary text-sm">{busy ? <Loader2 size={14} className="animate-spin" /> : <P.Logo s={14} />}Create in {P.name}</button>
            <button onClick={goIntegrations} className="btn-ghost text-xs">Manage connection</button>
            <button onClick={copy} className="btn-secondary text-sm ml-auto">{copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}Copy</button>
          </div>
        )}
      </div>
    </div>
  );
}
