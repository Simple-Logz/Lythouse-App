// @ts-nocheck
import { useState } from 'react';
import { X, Copy, Check, ExternalLink, Send, Settings } from 'lucide-react';

const LS_KEY = 'lh_integrations_v1';
function loadIntegrations() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } }
function saveIntegrations(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {} }

function sevLabel(s) { return s === 'high' ? 'Blocker / High' : s === 'medium' ? 'Needs Attention / Medium' : 'Low'; }

export function TicketModal({ finding, project, onClose }) {
  const [cfg, setCfg] = useState(loadIntegrations());
  const [showSettings, setShowSettings] = useState(false);
  const [title, setTitle] = useState(`[${(finding.severity || 'medium').toUpperCase()}] ${finding.title}`);
  const [body, setBody] = useState(
    `Project: ${project?.name || '—'}\nFile: ${finding.file || '—'}${finding.line ? `:${finding.line}` : ''}\nSeverity: ${sevLabel(finding.severity)}\nType: ${finding.type === 'omission' ? 'Missing (omission)' : finding.type === 'commission' ? 'Misconfiguration (commission)' : '—'}\n${finding.owner ? `Suggested owner: ${finding.owner}\n` : ''}${finding.eta ? `Estimated fix: ${finding.eta}${typeof finding.eta === 'number' ? ' min' : ''}\n` : ''}\nDescription:\n${finding.detail || finding.title}\n\nBusiness impact:\n${finding.impact || 'Increases operational/deployment risk.'}\n\nAcceptance criteria:\n- Resolve the issue in the referenced file\n- Re-run the Lythouse assessment and confirm the finding is cleared`
  );
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(null);

  const copy = () => { navigator.clipboard?.writeText(`${title}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const openJira = () => {
    copy();
    const base = (cfg.jira || '').replace(/\/$/, '');
    const url = base ? `${base}/secure/CreateIssue!default.jspa` : 'https://www.atlassian.com/software/jira';
    window.open(url, '_blank');
    setStatus('Ticket copied — paste it into the Jira create screen (assign the owner there).');
  };
  const openLinear = () => { copy(); window.open('https://linear.app/', '_blank'); setStatus('Ticket copied — paste it into Linear (Cmd/Ctrl+Shift+I for a new issue).'); };
  const openServiceNow = () => {
    copy();
    const base = (cfg.servicenow || '').replace(/\/$/, '');
    window.open(base ? `${base}/now/nav/ui/classic/params/target/incident.do` : 'https://www.servicenow.com/', '_blank');
    setStatus('Ticket copied — paste it into ServiceNow and assign an owner.');
  };
  const sendSlack = async () => {
    if (!cfg.slack) { setShowSettings(true); setStatus('Add your Slack incoming webhook in settings first.'); return; }
    try {
      await fetch(cfg.slack, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ text: `:rotating_light: *${title}*\n${body}` }) });
      setStatus('Sent to Slack (fire-and-forget — check the channel to confirm).');
    } catch { setStatus('Could not reach the Slack webhook.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg animate-scale-in rounded-xl bg-white p-5 shadow-xl overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">Create ticket</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSettings((s) => !s)} className="btn-ghost p-1" title="Integration settings"><Settings size={15} /></button>
            <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
          </div>
        </div>

        {showSettings && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
            <p className="text-xs text-gray-500">Configure once — stored in this browser. Full one-click create + assign requires connecting each tool's API (coming next).</p>
            {[
              { k: 'jira', label: 'Jira site URL', ph: 'https://yourcompany.atlassian.net' },
              { k: 'slack', label: 'Slack incoming webhook', ph: 'https://hooks.slack.com/services/...' },
              { k: 'servicenow', label: 'ServiceNow instance URL', ph: 'https://yourorg.service-now.com' },
              { k: 'linear', label: 'Linear workspace URL', ph: 'https://linear.app/yourteam' },
            ].map((f) => (
              <div key={f.k}>
                <label className="text-[11px] font-medium text-gray-600">{f.label}</label>
                <input className="input !py-1.5 text-xs" value={cfg[f.k] || ''} placeholder={f.ph} onChange={(e) => { const next = { ...cfg, [f.k]: e.target.value }; setCfg(next); saveIntegrations(next); }} />
              </div>
            ))}
          </div>
        )}

        <label className="label">Title</label>
        <input className="input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="label">Description</label>
        <textarea className="input mb-3 font-mono text-xs" rows={9} value={body} onChange={(e) => setBody(e.target.value)} />

        {status && <div className="mb-3 rounded-lg bg-brand-50 border border-brand-200 px-3 py-2 text-xs text-brand-800">{status}</div>}

        <div className="flex flex-wrap gap-2">
          <button onClick={copy} className="btn-secondary text-sm">{copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}Copy</button>
          <button onClick={openJira} className="btn-secondary text-sm"><ExternalLink size={13} />Jira</button>
          <button onClick={sendSlack} className="btn-secondary text-sm"><Send size={13} />Slack</button>
          <button onClick={openServiceNow} className="btn-secondary text-sm"><ExternalLink size={13} />ServiceNow</button>
          <button onClick={openLinear} className="btn-secondary text-sm"><ExternalLink size={13} />Linear</button>
        </div>
      </div>
    </div>
  );
}
