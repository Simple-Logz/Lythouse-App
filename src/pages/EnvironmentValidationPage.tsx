// @ts-nocheck
import { useMemo, useState } from 'react';
import {
  Plus, X, ShieldCheck, ShieldAlert, ShieldX, CircleCheck as CheckCircle2,
  Upload, Trash2, RefreshCw, Search, Layers, Cloud, Server, Link2,
  Copy, Check, ArrowRight, Radio, CircleAlert as AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../lib/ui';
import { COMPONENT_TYPES, typeOf, validateComponent, loadComponents, saveComponents } from '../workspace/envValidation';
import {
  PROVIDERS, providerOf, loadConnections, saveConnections, newConnection,
  collectorCommand, syncConnection,
} from '../workspace/envConnections';

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
      {openConn && <ConnectionDrawer conn={openConn} count={items.filter((i) => i.connectionId === openConn.id).length} syncing={syncing === openConn.id} onSync={() => sync(openConn)} onClose={() => setOpenConn(null)} onRemove=