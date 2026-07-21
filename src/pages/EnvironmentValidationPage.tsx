// @ts-nocheck
import { useMemo, useState } from 'react';
import {
  Plus, X, ShieldCheck, ShieldAlert, ShieldX, CircleCheck as CheckCircle2,
  Upload, Trash2, RefreshCw, Search, Layers, Cloud, Server, Link2,
  Copy, Check, ArrowRight, Radio, CircleAlert as AlertCircle,
  Sparkles, Wand as Wand2, MessageSquareText,
} from 'lucide-react';
import { PageHeader } from '../lib/ui';
import { COMPONENT_TYPES, typeOf, validateComponent, loadComponents, saveComponents } from '../workspace/envValidation';
import {
  PROVIDERS, providerOf, loadConnections, saveConnections, newConnection,
  collectorCommand, syncConnection,
} from '../workspace/envConnections';
import { analyzePosture, explainFinding, generateFix } from '../workspace/envAI';

const SEV = {
  critical: { t: 'text-[#b3261e]', b: 'bg-[#fde3e3] border-[#f5a3a3]', d: 'bg-[#dc2626]', label: 'Critical' },
  high: { t: 'text-[#d61f1f]', b: 'bg-[#fde3e3] border-[#f5a3a3]', d: 'bg-[#dc2626]', label: 'High' },
  medium: { t: 'text-[#b06a00]', b: 'bg-[#fff7e9] border-[#f9c777]', d: 'bg-[#e07600]', label: 'Medium' },
  low: { t: 'text-[#4c5372]', b: 'bg-gray-50 border-gray-200', d: 'bg-gray-400', label: 'Low' },
};
const STATUS = {
  validated: { t: 'text-[#0f7a3c]', b: 'bg-[#e3f7ea] border-[#9adcb4]', icon: ShieldCheck, label: 'Validated' },
  issues: { t: 'text-[#b06a00]', b: 'bg-[#fff7e9] border-[#f9c777]', icon: ShieldAlert, label: 'Needs attention' },
  blocked: { t: 'text-[#b3261e]', b: 'bg-[#fde3e3] border-[#f5a3a3]', icon: ShieldX, label: 'Blocked' },
};
const CONN_STATUS = {
  awaiting: { t: 'text-[#b06a00]', b: 'bg-[#fff7e9] border-[#f9c777]', label: 'Awaiting first sync' },
  connected: { t: 'text-[#0f7a3c]', b: 'bg-[#e3f7ea] border-[#9adcb4]', label: 'Connected' },
  error: { t: 'text-[#b3261e]', b: 'bg-[#fde3e3] border-[#f5a3a3]', label: 'Sync error' },
};
const scoreColor = (s) => s >= 85 ? 'text-[#0f9a4c]' : s >= 60 ? 'text-[#b06a00]' : 'text-[#d61f1f]';
const uid = () => Math.random().toString(36).slice(2, 10);
const timeAgo = (ts) => {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export function EnvironmentValidationPage() {
  const wid = typeof localStorage !== 'undefined' ? localStorage.getItem('sandbox.activeWs') : null;
  const [items, setItems] = useState(() => loadComponents(wid));
  const [conns, setConns] = useState(() => loadConnections(wid));
  const [connecting, setConnecting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(null);
  const [openConn, setOpenConn] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [q, setQ] = useState('');

  const persist = (next) => { setItems(next); saveComponents(wid, next); };
  const persistConns = (next) => { setConns(next); saveConnections(wid, next); };

  const addComponent = (comp) => {
    const res = validateComponent(comp);
    const rec = { id: uid(), source: 'manual', ...comp, ...res, validatedAt: Date.now() };
    persist([rec, ...items]);
    setAdding(false);
    setSelected(rec);
  };
  const revalidate = (rec) => {
    const res = validateComponent(rec);
    const updated = { ...rec, ...res, validatedAt: Date.now() };
    persist(items.map((i) => (i.id === rec.id ? updated : i)));
    setSelected(updated);
  };
  const remove = (id) => { persist(items.filter((i) => i.id !== id)); setSelected(null); };

  const createConnection = (providerId, name) => {
    const c = newConnection(providerId, name);
    persistConns([c, ...conns]);
    setConnecting(false);
    setOpenConn(c);
  };
  const removeConnection = (id) => {
    persistConns(conns.filter((c) => c.id !== id));
    persist(items.filter((i) => i.connectionId !== id));
    setOpenConn(null);
  };
  const sync = async (conn) => {
    setSyncing(conn.id);
    try {
      const { components, syncedAt } = await syncConnection(conn);
      // Replace this connection's discovered components with the fresh pull.
      const others = items.filter((i) => i.connectionId !== conn.id);
      persist([...components, ...others]);
      const updated = { ...conn, status: components.length ? 'connected' : conn.status, lastSyncAt: syncedAt, componentCount: components.length, error: null };
      persistConns(conns.map((c) => (c.id === conn.id ? updated : c)));
      if (openConn?.id === conn.id) setOpenConn(updated);
    } catch (e) {
      const updated = { ...conn, status: 'error', error: e.message };
      persistConns(conns.map((c) => (c.id === conn.id ? updated : c)));
      if (openConn?.id === conn.id) setOpenConn(updated);
    } finally {
      setSyncing(null);
    }
  };

  const summary = useMemo(() => {
    const s = { total: items.length, validated: 0, issues: 0, blocked: 0, posture: 0 };
    items.forEach((i) => { s[i.status] = (s[i.status] || 0) + 1; });
    s.posture = items.length ? Math.round(items.reduce((a, i) => a + i.score, 0) / items.length) : null;
    return s;
  }, [items]);

  const filtered = items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()) || typeOf(i.type).label.toLowerCase().includes(q.toLowerCase()));
  const hasAnything = conns.length > 0 || items.length > 0;

  return (
    <div>
      <PageHeader
        title="Environment"
        description="Connect your live cloud and on-prem environments. LytHouse pulls the real components — IAM, networking, workloads, images, servers — and validates them against the same checks that gate your releases."
        actions={
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setAdding(true)} className="btn-ghost text-sm whitespace-nowrap"><Plus size={15} />Add manually</button>
            <button onClick={() => setConnecting(true)} className="btn-primary text-sm whitespace-nowrap"><Link2 size={15} />Connect a source</button>
          </div>
        }
      />

      {/* posture summary */}
      {hasAnything && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-6">
          {[
            { l: 'Components', v: summary.total, c: 'text-navy-900' },
            { l: 'Validated', v: summary.validated, c: 'text-[#0f9a4c]' },
            { l: 'Needs attention', v: summary.issues, c: 'text-[#b06a00]' },
            { l: 'Blocked', v: summary.blocked, c: 'text-[#d61f1f]' },
            { l: 'Overall posture', v: summary.posture != null ? `${summary.posture}` : '—', c: summary.posture != null ? scoreColor(summary.posture) : 'text-gray-400', suf: summary.posture != null ? '/100' : '' },
          ].map((x) => (
            <div key={x.l} className="card !p-4">
              <div className={`text-3xl font-bold ${x.c}`}>{x.v}<span className="text-base text-gray-400 font-semibold">{x.suf || ''}</span></div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-0.5">{x.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* AI posture analysis — grounded on the deterministic findings */}
      {items.length > 0 && <AiPostureCard items={items} />}

      {/* connected sources */}
      {conns.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Radio size={15} className="text-brand-500" />
            <h2 className="text-sm font-bold text-navy-900">Connected sources</h2>
            <span className="text-xs text-gray-400">({conns.length})</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {conns.map((c) => {
              const P = providerOf(c.provider); const cs = CONN_STATUS[c.status] || CONN_STATUS.awaiting; const Icon = P.icon;
              const count = items.filter((i) => i.connectionId === c.id).length;
              return (
                <button key={c.id} onClick={() => setOpenConn(c)} className="card !p-4 text-left hover:shadow-lift hover:border-brand-200 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${P.accent}1a`, color: P.accent }}><Icon size={17} /></span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cs.b} ${cs.t}`}>{c.status === 'connected' ? <span className="w-1.5 h-1.5 rounded-full bg-[#0f9a4c]" /> : c.status === 'error' ? <AlertCircle size={11} /> : <span className="w-1.5 h-1.5 rounded-full bg-[#e07600]" />}{cs.label}</span>
                  </div>
                  <div className="mt-2.5 font-semibold text-navy-900 truncate">{c.name}</div>
                  <div className="text-xs text-gray-400">{P.label}</div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-gray-500">{count} component{count === 1 ? '' : 's'}</span>
                    <span className="text-gray-400">synced {timeAgo(c.lastSyncAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* empty state → connect-first */}
      {!hasAnything && (
        <div className="card !p-8">
          <div className="text-center max-w-lg mx-auto">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Link2 size={26} /></div>
            <h3 className="text-lg font-bold text-navy-900">Connect your environment</h3>
            <p className="mt-1.5 text-sm text-gray-500">Pick where your infrastructure runs. A read-only collector pulls the live components and LytHouse validates them — your cloud credentials never leave your side.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 mt-6 max-w-2xl mx-auto">
            {PROVIDERS.map((p) => {
              const Icon = p.icon;
              return (
                <button key={p.id} onClick={() => setConnecting(p.id)} className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4 text-left hover:border-brand-300 hover:shadow-soft transition-all">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${p.accent}1a`, color: p.accent }}><Icon size={20} /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">{p.label}<ArrowRight size={13} className="text-gray-300" /></span>
                    <span className="block text-[12px] text-gray-500 leading-snug mt-0.5">{p.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">Prefer to check a single file? <button onClick={() => setAdding(true)} className="text-brand-600 hover:underline font-medium">Add a component manually</button>.</p>
        </div>
      )}

      {/* components */}
      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-brand-500" />
              <h2 className="text-sm font-bold text-navy-900">Components</h2>
              <span className="text-xs text-gray-400">({items.length})</span>
            </div>
            <div className="relative max-w-xs w-full sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search components…" className="input pl-9 py-2" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => {
              const T = typeOf(c.type); const st = STATUS[c.status]; const Icon = T.icon; const StIcon = st.icon;
              const src = c.source && c.source !== 'manual' ? providerOf(c.source) : null;
              return (
                <button key={c.id} onClick={() => setSelected(c)} className="card !p-4 text-left hover:shadow-lift hover:border-brand-200 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shrink-0"><Icon size={17} /></span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${st.b} ${st.t}`}><StIcon size={11} />{st.label}</span>
                  </div>
                  <div className="mt-2.5 font-semibold text-navy-900 truncate">{c.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    {src ? <span className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium" style={{ backgroundColor: `${src.accent}14`, color: src.accent }}>{src.short}</span> : <span className="text-gray-300">Manual</span>}
                    <span>·</span><span>{T.label}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{c.findings.length} finding{c.findings.length === 1 ? '' : 's'}</span>
                    <span className={`text-lg font-bold ${scoreColor(c.score)}`}>{c.score}<span className="text-xs text-gray-400 font-semibold">/100</span></span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 mt-8 max-w-3xl">
        LytHouse never stores your cloud credentials. The read-only collector runs where your credentials already live (a laptop, CI runner, bastion or on-prem host) and pushes only the resulting inventory. Connections and results are held in your workspace; live continuous sync runs through the collector.
      </p>

      {connecting && <ConnectDrawer initial={typeof connecting === 'string' ? connecting : null} onClose={() => setConnecting(false)} onCreate={createConnection} />}
      {openConn && <ConnectionDrawer conn={openConn} count={items.filter((i) => i.connectionId === openConn.id).length} syncing={syncing === openConn.id} onSync={() => sync(openConn)} onClose={() => setOpenConn(null)} onRemove={removeConnection} />}
      {adding && <AddDrawer onClose={() => setAdding(false)} onAdd={addComponent} />}
      {selected && <DetailDrawer comp={selected} onClose={() => setSelected(null)} onRevalidate={revalidate} onRemove={remove} />}
    </div>
  );
}

// ── AI posture analysis ──────────────────────────────────────────────────────
// Sends ONLY the deterministic findings to Claude and asks it to assess,
// prioritise, and give a deploy call. It never detects — it reasons on top.
function AiPostureCard({ items }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const run = async () => { setLoading(true); setText(''); const r = await analyzePosture(items); setText(r); setLoading(false); };
  return (
    <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-[#f7f5ff] to-white p-5 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shrink-0"><Sparkles size={17} /></span>
          <div className="min-w-0">
            <div className="font-bold text-navy-900">AI environment analysis</div>
            <div className="text-xs text-gray-500">Reasons over your validated components — what to fix first, and whether it's safe to deploy.</div>
          </div>
        </div>
        <button onClick={run} disabled={loading} className="btn-primary text-sm shrink-0">{loading ? <><RefreshCw size={14} className="animate-spin" />Analyzing…</> : <><Sparkles size={14} />{text ? 'Re-analyze' : 'Analyze'}</>}</button>
      </div>
      {text && (
        <div className="mt-4 rounded-xl bg-white border border-gray-200 p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{text}</div>
      )}
      {!text && !loading && (
        <p className="mt-3 text-[11px] text-gray-400">The AI only sees findings already detected by LytHouse's checks — it explains and prioritises them, it does not invent new ones.</p>
      )}
    </div>
  );
}

// ── Connect a source ─────────────────────────────────────────────────────────
function ConnectDrawer({ initial, onClose, onCreate }) {
  const [provider, setProvider] = useState(initial || 'aws');
  const [name, setName] = useState('');
  const P = providerOf(provider);
  const Icon = P.icon;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-navy-900">Connect a source</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <p className="label">Where does this environment run?</p>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => {
                const PIcon = p.icon; const on = provider === p.id;
                return (
                  <button key={p.id} onClick={() => setProvider(p.id)} className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${on ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${p.accent}1a`, color: p.accent }}><PIcon size={16} /></span>
                    <span className="min-w-0"><span className="block text-sm font-semibold text-navy-900">{p.short}</span><span className="block text-[11px] text-gray-500 leading-tight">{p.label}</span></span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${P.accent}1a`, color: P.accent }}><Icon size={16} /></span>
              <div><div className="text-sm font-semibold text-navy-900">{P.label}</div><div className="text-[11px] text-gray-500">What LytHouse pulls</div></div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {P.pulls.map((x) => <span key={x} className="chip border border-gray-200 bg-gray-50 text-[11px] text-gray-600">{x}</span>)}
            </div>
          </div>

          <div>
            <label className="label">Name this connection</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={`e.g. Production ${P.short}`} />
          </div>

          <div className="rounded-xl bg-[#f6f5ff] border border-brand-100 p-3.5">
            <p className="text-xs font-semibold text-brand-700 mb-1.5">How the connection works</p>
            <ol className="space-y-1.5">
              {P.setup.map((s, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-gray-600 leading-snug">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white text-[9px] font-bold mt-0.5">{i + 1}</span>{s}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="border-t border-gray-100 p-4 flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button onClick={() => onCreate(provider, name)} className="btn-primary text-sm"><Link2 size={14} />Create connection</button>
        </div>
      </div>
    </div>
  );
}

// ── Connection detail (token + collector command + sync) ─────────────────────
function ConnectionDrawer({ conn, count, syncing, onSync, onClose, onRemove }) {
  const P = providerOf(conn.provider); const Icon = P.icon;
  const cs = CONN_STATUS[conn.status] || CONN_STATUS.awaiting;
  const cmd = collectorCommand(conn);
  const [copied, setCopied] = useState(false);
  const copy = () => { try { navigator.clipboard?.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${P.accent}1a`, color: P.accent }}><Icon size={17} /></span>
            <div className="min-w-0"><div className="font-bold text-navy-900 truncate">{conn.name}</div><div className="text-xs text-gray-400">{P.label}</div></div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className={`rounded-2xl border p-4 flex items-center justify-between ${cs.b}`}>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Status</div>
              <div className={`text-lg font-bold ${cs.t}`}>{cs.label}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-navy-900">{count}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">components</div>
            </div>
          </div>

          {conn.status === 'error' && conn.error && (
            <div className="rounded-xl border border-[#f5a3a3] bg-[#fde3e3] p-3 text-sm text-[#b3261e] flex items-start gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0" />{conn.error} — this is expected until the collector has run and the ingest backend is deployed.</div>
          )}

          {conn.status === 'awaiting' && (
            <div className="rounded-xl border border-[#f9c777] bg-[#fff7e9] p-3 text-[12px] text-[#8a5a00] leading-snug">
              No sync yet. Run the collector command below from a machine that already has read-only access to this environment. It pulls the live inventory and pushes it here — then hit “Check for sync”.
            </div>
          )}

          <div>
            <p className="label">Run the collector</p>
            <div className="rounded-xl bg-[#0f1222] p-3.5 font-mono text-[11px] text-gray-100 leading-relaxed relative">
              <button onClick={copy} className="absolute top-2.5 right-2.5 rounded-md bg-white/10 hover:bg-white/20 p-1.5 text-gray-200 transition">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
              <span className="text-gray-500 select-none">$ </span>{cmd}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">The token identifies this connection — it is not a cloud credential. Your AWS/GCP/Azure keys stay on the machine running the collector.</p>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-navy-900 mb-2">This connection validates</p>
            <div className="flex flex-wrap gap-1.5">
              {P.pulls.map((x) => <span key={x} className="chip border border-gray-200 bg-gray-50 text-[11px] text-gray-600">{x}</span>)}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 p-4 flex items-center justify-between shrink-0">
          <button onClick={() => onRemove(conn.id)} className="btn-ghost text-sm text-[#dc2626]"><Trash2 size={14} />Disconnect</button>
          <button onClick={onSync} disabled={syncing} className="btn-primary text-sm">{syncing ? <><RefreshCw size={14} className="animate-spin" />Checking…</> : <><RefreshCw size={14} />Check for sync</>}</button>
        </div>
      </div>
    </div>
  );
}

// ── Manual add (secondary path) ──────────────────────────────────────────────
function AddDrawer({ onClose, onAdd }) {
  const [type, setType] = useState('kubernetes');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const T = typeOf(type);
  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { setContent(String(r.result || '')); if (!name) setName(f.name); }; r.readAsText(f);
  };
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100 shrink-0">
          <div><h2 className="text-base font-bold text-navy-900">Add a component manually</h2><p className="text-[11px] text-gray-400">Check a single config file offline — no connection needed.</p></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <p className="label">Component type</p>
            <div className="grid grid-cols-2 gap-2">
              {COMPONENT_TYPES.map((t) => {
                const Icon = t.icon; const on = type === t.id;
                return (
                  <button key={t.id} onClick={() => setType(t.id)} className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${on ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${on ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'}`}><Icon size={16} /></span>
                    <span className="min-w-0"><span className="block text-sm font-semibold text-navy-900">{t.label}</span><span className="block text-[11px] text-gray-500 leading-tight">{t.hint}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={`e.g. production ${T.label.toLowerCase()}`} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Configuration</label>
              <label className="text-xs text-brand-600 hover:underline cursor-pointer inline-flex items-center gap-1"><Upload size={12} />Upload file<input type="file" className="hidden" onChange={onFile} /></label>
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} className="input font-mono text-xs leading-relaxed" placeholder={`Paste your ${T.label} config here…\n\n${T.sample}`} />
          </div>
        </div>
        <div className="border-t border-gray-100 p-4 flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button onClick={() => onAdd({ type, name: name.trim() || `${T.label}`, content })} disabled={!content.trim()} className="btn-primary text-sm"><ShieldCheck size={14} />Validate component</button>
        </div>
      </div>
    </div>
  );
}

// ── A single finding, with grounded AI explain / fix ─────────────────────────
function FindingRow({ comp, finding: f }) {
  const sv = SEV[f.severity] || SEV.low;
  const [explain, setExplain] = useState('');
  const [fix, setFix] = useState('');
  const [busy, setBusy] = useState('');
  const doExplain = async () => { setBusy('explain'); setExplain(await explainFinding(comp, f)); setBusy(''); };
  const doFix = async () => { setBusy('fix'); setFix(await generateFix(comp, f)); setBusy(''); };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sv.b} ${sv.t}`}><span className={`w-1.5 h-1.5 rounded-full ${sv.d}`} />{sv.label}</span>
        <span className="text-sm font-semibold text-navy-900">{f.title}</span>
        {f.line ? <span className="text-[11px] text-gray-400 ml-auto font-mono">line {f.line}</span> : null}
      </div>
      <p className="text-xs text-gray-600 mt-1.5 leading-snug">{f.detail}</p>
      <div className="flex items-center gap-2 mt-2.5">
        <button onClick={doExplain} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50">
          {busy === 'explain' ? <RefreshCw size={11} className="animate-spin" /> : <MessageSquareText size={11} />}Explain
        </button>
        <button onClick={doFix} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50">
          {busy === 'fix' ? <RefreshCw size={11} className="animate-spin" /> : <Wand2 size={11} />}Generate fix
        </button>
      </div>
      {explain && <div className="mt-2 rounded-lg bg-[#f7f5ff] border border-brand-100 p-2.5 text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap"><span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-600 mb-1"><Sparkles size={10} />AI explanation</span><br />{explain}</div>}
      {fix && <div className="mt-2 rounded-lg bg-[#0f1222] p-2.5 text-[11px] text-gray-100 leading-relaxed whitespace-pre-wrap font-mono"><span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-300 mb-1"><Wand2 size={10} />AI-generated fix</span><br />{fix}</div>}
    </div>
  );
}

// ── Component detail ─────────────────────────────────────────────────────────
function DetailDrawer({ comp, onClose, onRevalidate, onRemove }) {
  const T = typeOf(comp.type); const st = STATUS[comp.status]; const Icon = T.icon;
  const src = comp.source && comp.source !== 'manual' ? providerOf(comp.source) : null;
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const findings = [...comp.findings].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shrink-0"><Icon size={17} /></span>
            <div className="min-w-0"><div className="font-bold text-navy-900 truncate">{comp.name}</div><div className="flex items-center gap-1.5 text-xs text-gray-400">{src ? <span className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium" style={{ backgroundColor: `${src.accent}14`, color: src.accent }}>{src.short}</span> : <span>Manual</span>}<span>·</span>{T.label}</div></div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className={`rounded-2xl border p-4 flex items-center justify-between ${st.b}`}>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Validation status</div>
              <div className={`text-xl font-bold ${st.t}`}>{st.label}</div>
            </div>
            <div className="text-right"><div className={`text-3xl font-bold ${scoreColor(comp.score)}`}>{comp.score}</div><div className="text-[10px] uppercase tracking-wide text-gray-400">posture / 100</div></div>
          </div>

          {findings.length === 0 ? (
            <div className="rounded-xl border border-[#9adcb4] bg-[#e3f7ea] p-4 flex items-center gap-2 text-sm text-[#0f7a3c]"><CheckCircle2 size={16} />No issues detected — this component passed all checks.</div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-navy-900 mb-2">{findings.length} finding{findings.length === 1 ? '' : 's'}</p>
              <div className="space-y-2">
                {findings.map((f, i) => <FindingRow key={i} comp={comp} finding={f} />)}
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 p-4 flex items-center justify-between shrink-0">
          <button onClick={() => onRemove(comp.id)} className="btn-ghost text-sm text-[#dc2626]"><Trash2 size={14} />Remove</button>
          <button onClick={() => onRevalidate(comp)} className="btn-primary text-sm"><RefreshCw size={14} />Re-validate</button>
        </div>
      </div>
    </div>
  );
}
export default EnvironmentValidationPage;
