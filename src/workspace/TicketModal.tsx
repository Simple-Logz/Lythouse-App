// @ts-nocheck
import { useState } from 'react';
import { X, Copy, Check, ExternalLink, Loader as Loader2, Settings } from 'lucide-react';
import { edgeFunctionUrl, anonKey } from '../lib/supabase';

const LS_KEY = 'lh_integrations_v2';
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
const save = (v) => { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {} };
const sevLabel = (s) => (s === 'high' ? 'Blocker / High' : s === 'medium' ? 'Needs Attention / Medium' : 'Low');

// ── Brand logos ───────────────────────────────────────────────────────────
const JiraLogo = ({ s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24"><path fill="#2684FF" d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0z" /></svg>
);
const SlackLogo = ({ s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 122.8 122.8"><path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z" fill="#E01E5A" /><path d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#E01E5A" /><path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z" fill="#36C5F0" /><path d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36C5F0" /><path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z" fill="#2EB67D" /><path d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2EB67D" /><path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z" fill="#ECB22E" /><path d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ECB22E" /></svg>
);
const LinearLogo = ({ s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24"><path fill="#5E6AD2" d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.628 0 24 5.373 24 12.01c0 3.68-1.657 6.977-4.267 9.178L2.886 4.18ZM1.056 6.35 17.66 22.94c-.633.301-1.3.541-1.993.714L.343 8.348c.176-.694.418-1.362.714-1.998Zm-.849 4.317 13.128 13.125c-.898.148-1.803.174-2.688.078L.129 13.348a12.05 12.05 0 0 1 .077-2.681Zm.633 5.399 4.746 4.743a12.056 12.056 0 0 1-4.746-4.743Z" /></svg>
);
const ServiceNowLogo = ({ s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#62D84E" /><circle cx="12" cy="12" r="5.4" fill="none" stroke="#0b3d1f" strokeWidth="2.4" /></svg>
);

const PROVIDERS = {
  jira: { name: 'Jira', Logo: JiraLogo, fields: [{ k: 'site', label: 'Site URL', ph: 'https://you.atlassian.net' }, { k: 'email', label: 'Email' }, { k: 'token', label: 'API token', type: 'password' }, { k: 'projectKey', label: 'Project key', ph: 'ENG' }, { k: 'assigneeAccountId', label: 'Assignee account ID (optional)' }] },
  slack: { name: 'Slack', Logo: SlackLogo, fields: [{ k: 'webhook', label: 'Incoming webhook URL', ph: 'https://hooks.slack.com/services/...' }] },
  servicenow: { name: 'ServiceNow', Logo: ServiceNowLogo, fields: [{ k: 'instance', label: 'Instance URL', ph: 'https://org.service-now.com' }, { k: 'user', label: 'User' }, { k: 'password', label: 'Password', type: 'password' }] },
  linear: { name: 'Linear', Logo: LinearLogo, fields: [{ k: 'apiKey', label: 'API key', type: 'password' }, { k: 'teamId', label: 'Team ID' }] },
};

export function TicketModal({ finding, project, onClose }) {
  const [cfg, setCfg] = useState(load());
  const [provider, setProvider] = useState('jira');
  const [showCfg, setShowCfg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {url, error, posted}
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState(`[${(finding.severity || 'medium').toUpperCase()}] ${finding.title}`);
  const [body, setBody] = useState(
    `Project: ${project?.name || '—'}\nFile: ${finding.file || '—'}${finding.line ? `:${finding.line}` : ''}\nSeverity: ${sevLabel(finding.severity)}\n${finding.owner ? `Suggested owner: ${finding.owner}\n` : ''}\n${finding.detail || finding.title}\n\nBusiness impact: ${finding.impact || 'Increases deployment risk.'}\n\nAcceptance criteria:\n- Resolve the issue in the referenced file\n- Re-run the Lythouse assessment and confirm it clears`
  );

  const P = PROVIDERS[provider];
  const pcfg = cfg[provider] || {};
  const required = P.fields.filter((f) => !/optional/i.test(f.label || ''));
  const configured = required.every((f) => (pcfg[f.k] || '').trim());

  const setField = (k, v) => { const next = { ...cfg, [provider]: { ...pcfg, [k]: v } }; setCfg(next); save(next); };
  const copy = () => { navigator.clipboard?.writeText(`${title}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const createTicket = async () => {
    if (!configured) { setShowCfg(true); return; }
    setBusy(true); setResult(null);
    try {
      const res = await fetch(edgeFunctionUrl + '/create-ticket', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + anonKey, apikey: anonKey }, body: JSON.stringify({ provider, config: pcfg, ticket: { title, body } }) });
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

        {/* Provider picker with colored logos */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {Object.entries(PROVIDERS).map(([key, p]) => {
            const active = provider === key;
            return (
              <button key={key} onClick={() => { setProvider(key); setResult(null); }} className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-2.5 transition-all ${active ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <p.Logo s={22} />
                <span className={`text-[11px] font-medium ${active ? 'text-brand-700' : 'text-gray-600'}`}>{p.name}</span>
              </button>
            );
          })}
        </div>

        <label className="label">Title</label>
        <input className="input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="label">Description</label>
        <textarea className="input mb-3 font-mono text-xs" rows={7} value={body} onChange={(e) => setBody(e.target.value)} />

        {/* Config (shown when missing or toggled) */}
        {(showCfg || !configured) && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
            <p className="text-xs text-gray-500 flex items-center gap-1.5"><P.Logo s={13} />Connect {P.name} — stored in this browser.</p>
            {P.fields.map((f) => (
              <div key={f.k}>
                <label className="text-[11px] font-medium text-gray-600">{f.label}</label>
                <input type={f.type || 'text'} className="input !py-1.5 text-xs" value={pcfg[f.k] || ''} placeholder={f.ph || ''} onChange={(e) => setField(f.k, e.target.value)} />
              </div>
            ))}
          </div>
        )}

        {result?.url && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm"><span className="font-medium text-green-800">Ticket created.</span> <a href={result.url} target="_blank" rel="noreferrer" className="text-brand-700 font-semibold hover:underline">Open ticket →</a></div>}
        {result?.posted && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Posted to {P.name}.</div>}
        {result?.error && (
          <div className="mb-3 rounded-lg border border-[#f5a3a3] bg-[#fde3e3] px-3 py-2 text-sm text-[#c0392b]">
            {result.error}
            <div className="text-xs text-[#c0392b]/80 mt-1">If the create-ticket function isn’t deployed yet, use Copy and paste it into {P.name}.</div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={createTicket} disabled={busy} className="btn-primary text-sm">{busy ? <Loader2 size={14} className="animate-spin" /> : <P.Logo s={14} />}Create in {P.name}</button>
          <button onClick={() => setShowCfg((s) => !s)} className="btn-ghost text-sm"><Settings size={14} />Connection</button>
          <button onClick={copy} className="btn-secondary text-sm ml-auto">{copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}Copy</button>
        </div>
      </div>
    </div>
  );
}
