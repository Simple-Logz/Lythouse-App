// @ts-nocheck
// Ask LytHouse AI — a real chat popup (separate from the ⌘K command palette).
// Users type a question and get an answer from the ai-chat edge function.
import { useState, useRef, useEffect } from 'react';
import { edgeFunctionUrl, anonKey, supabase } from '../lib/supabase';
import { Sparkles, X, ArrowUp } from 'lucide-react';

const SYSTEM = `You are the LytHouse assistant — an expert release-validation and DevSecOps advisor. Be concise, specific, and friendly. LytHouse validates releases before they deploy: it reads repositories, runs deterministic security checks (secrets, CVEs via OSV, insecure code patterns), enforces policy gates, and produces a clear go / delay / block release decision with evidence. Never fabricate metrics or invent findings. When the CONTEXT below contains the user's real data, answer specifically from it (cite the actual finding, file, or score). If the answer isn't in the context or the data, say so and suggest where in LytHouse to look.`;

// Pull the active workspace's latest completed validation + top open findings so
// the assistant answers from the user's REAL data, not generically.
async function loadContext(): Promise<string> {
  try {
    const wid = localStorage.getItem('sandbox.activeWs');
    if (!wid) return '';
    const { data: vals } = await supabase.from('validations')
      .select('*').eq('workspace_id', wid).eq('status', 'completed')
      .order('created_at', { ascending: false }).limit(1);
    const v = vals?.[0];
    if (!v) return '\n\nCONTEXT: The active workspace has no completed validations yet. Encourage the user to run a validation on a project.';
    let proj = '';
    try { const { data: p } = await supabase.from('projects').select('name').eq('id', v.project_id).single(); proj = p?.name || ''; } catch { /* ignore */ }
    const { data: findings } = await supabase.from('findings')
      .select('severity,category,title,file_path,line,status')
      .eq('validation_id', v.id).eq('status', 'open')
      .order('created_at', { ascending: false }).limit(15);
    const lines = (findings || []).map((f: any) => `  - [${f.severity}] ${f.title}${f.file_path ? ` (${f.file_path}${f.line ? ':' + f.line : ''})` : ''} — ${f.category}`);
    return `\n\nCONTEXT (the user's real LytHouse data — answer from this):\n`
      + `Latest validation${proj ? ` for project "${proj}"` : ''}: risk score ${v.risk_score ?? '—'}/100, severity ${v.severity ?? '—'}, ${v.total_findings ?? 0} findings (${v.critical_count ?? 0} critical, ${v.high_count ?? 0} high, ${v.medium_count ?? 0} medium, ${v.low_count ?? 0} low).\n`
      + `Verdict summary: ${v.summary || '(none)'}\n`
      + (lines.length ? `Top open findings:\n${lines.join('\n')}` : 'No open findings on the latest validation.');
  } catch { return ''; }
}

const CSS = `
.ai-panel{position:fixed;right:22px;bottom:84px;z-index:65;width:min(92vw,384px);height:min(72vh,552px);display:flex;flex-direction:column;background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:18px;box-shadow:0 34px 90px -24px rgba(4,8,14,.55);overflow:hidden;animation:ai-in .18s ease}
@keyframes ai-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
.ai-hd{display:flex;align-items:center;gap:10px;padding:13px 15px;border-bottom:1px solid var(--lh-border)}
.ai-hd .mk{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#8b6ef2,#6a48cf);color:#fff;display:grid;place-items:center;flex-shrink:0}
.ai-hd .t{font-size:14px;font-weight:700;color:var(--lh-text);line-height:1.1}
.ai-hd .s{font-size:11px;color:var(--lh-text3)}
.ai-x{margin-left:auto;width:28px;height:28px;border-radius:7px;border:1px solid var(--lh-border);background:transparent;color:var(--lh-text2);display:grid;place-items:center;cursor:pointer}
.ai-x:hover{background:var(--lh-surface2)}
.ai-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.ai-msg{max-width:88%;padding:9px 12px;border-radius:13px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.ai-msg.u{align-self:flex-end;background:var(--lh-accent);color:var(--lh-accent-contrast);border-bottom-right-radius:4px}
.ai-msg.a{align-self:flex-start;background:var(--lh-surface2);color:var(--lh-text);border:1px solid var(--lh-border);border-bottom-left-radius:4px}
.ai-dots span{display:inline-block;width:6px;height:6px;margin:0 1.5px;border-radius:50%;background:var(--lh-text3);animation:ai-b 1s infinite}
.ai-dots span:nth-child(2){animation-delay:.15s}.ai-dots span:nth-child(3){animation-delay:.3s}
@keyframes ai-b{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.ai-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px}
.ai-chip{font-size:12px;padding:6px 10px;border-radius:16px;border:1px solid var(--lh-border);background:var(--lh-surface2);color:var(--lh-text2);cursor:pointer}
.ai-chip:hover{border-color:var(--lh-accent);color:var(--lh-text)}
.ai-foot{padding:11px;border-top:1px solid var(--lh-border);display:flex;gap:8px;align-items:flex-end}
.ai-in{flex:1;background:var(--lh-surface2);border:1px solid var(--lh-border);border-radius:11px;padding:9px 12px;font:inherit;font-size:13.5px;color:var(--lh-text);outline:none;resize:none;max-height:96px;line-height:1.45}
.ai-in::placeholder{color:var(--lh-text3)}
.ai-in:focus{border-color:var(--lh-accent)}
.ai-send{width:38px;height:38px;flex:0 0 auto;border-radius:11px;background:var(--lh-accent);color:var(--lh-accent-contrast);border:none;cursor:pointer;display:grid;place-items:center}
.ai-send:disabled{opacity:.45;cursor:default}
`;

const STARTERS = [
  'What does a release decision mean?',
  'How do policy gates work?',
  'How do I connect a repository?',
];

export function AskAiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState([
    { role: 'assistant', content: "Hi! I'm the LytHouse assistant. Ask me anything about your releases, findings, or how to validate — I'll help." },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const ctxRef = useRef('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 60); }, [open]);
  // Refresh the grounding context each time the panel opens.
  useEffect(() => { if (open) { loadContext().then((c) => { ctxRef.current = c; }); } }, [open]);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [msgs, busy]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next = [...msgs, { role: 'user', content: q }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch(`${edgeFunctionUrl}/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}`, apikey: anonKey },
        body: JSON.stringify({ systemPrompt: SYSTEM + ctxRef.current, messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok) throw new Error('bad');
      const d = await res.json();
      setMsgs((m) => [...m, { role: 'assistant', content: d.content || 'No response.' }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: "I couldn't reach the AI service just now — please try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="ai-panel"><style>{CSS}</style>
      <div className="ai-hd">
        <span className="mk"><Sparkles size={16} /></span>
        <div>
          <div className="t">Ask LytHouse AI</div>
          <div className="s">Release & security assistant</div>
        </div>
        <button className="ai-x" onClick={onClose} aria-label="Close"><X size={15} /></button>
      </div>

      <div className="ai-body" ref={bodyRef}>
        {msgs.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role === 'user' ? 'u' : 'a'}`}>{m.content}</div>
        ))}
        {busy && <div className="ai-msg a"><span className="ai-dots"><span></span><span></span><span></span></span></div>}
      </div>

      {msgs.length <= 1 && !busy && (
        <div className="ai-chips">
          {STARTERS.map((s) => <button key={s} className="ai-chip" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}

      <div className="ai-foot">
        <textarea
          ref={inputRef} className="ai-in" rows={1} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask anything about your releases…" />
        <button className="ai-send" onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send"><ArrowUp size={17} /></button>
      </div>
    </div>
  );
}

export default AskAiPanel;
