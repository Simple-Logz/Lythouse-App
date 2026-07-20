// @ts-nocheck
import { useMemo, useState } from 'react';
import {
  Plus, X, ShieldCheck, ShieldAlert, ShieldX, CircleCheck as CheckCircle2,
  Upload, ArrowRight, Trash2, RefreshCw, Search, TriangleAlert as AlertTriangle,
  Layers,
} from 'lucide-react';
import { PageHeader } from '../lib/ui';
import { COMPONENT_TYPES, typeOf, validateComponent, loadComponents, saveComponents } from '../workspace/envValidation';

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
const scoreColor = (s) => s >= 85 ? 'text-[#0f9a4c]' : s >= 60 ? 'text-[#b06a00]' : 'text-[#d61f1f]';
const uid = () => Math.random().toString(36).slice(2, 10);

export function EnvironmentValidationPage() {
  const wid = typeof localStorage !== 'undefined' ? localStorage.getItem('sandbox.activeWs') : null;
  const [items, setItems] = useState(() => loadComponents(wid));
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');

  const persist = (next) => { setItems(next); saveComponents(wid, next); };

  const addComponent = (comp) => {
    const res = validateComponent(comp);
    const rec = { id: uid(), ...comp, ...res, validatedAt: Date.now() };
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

  const summary = useMemo(() => {
    const s = { total: items.length, validated: 0, issues: 0, blocked: 0, posture: 0 };
    items.forEach((i) => { s[i.status] = (s[i.status] || 0) + 1; });
    s.posture = items.length ? Math.round(items.reduce((a, i) => a + i.score, 0) / items.length) : null;
    return s;
  }, [items]);

  const filtered = items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()) || typeOf(i.type).label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Environment Validation"
        description="Validate the infrastructure & configuration behind your release — Kubernetes, Terraform, IAM, networking, containers, APIs and more — with real static checks."
        actions={<button onClick={() => setAdding(true)} className="btn-primary text-sm"><Plus size={15} />Add component</button>}
      />

      {/* summary */}
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

      {items.length === 0 ? (
        <div className="card text-center py-16">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Layers size={26} /></div>
          <h3 className="text-base font-semibold text-navy-900">No components yet</h3>
          <p className="mt-1.5 text-sm text-gray-500 max-w-md mx-auto">Add a Kubernetes manifest, a Terraform file, an IAM policy, a security-group config, a Dockerfile or an API spec — LytHouse validates it against real security &amp; reliability checks.</p>
          <button onClick={() => setAdding(true)} className="btn-primary text-sm mt-5 mx-auto"><Plus size={15} />Add your first component</button>
        </div>
      ) : (
        <>
          <div className="relative mb-4 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search components…" className="input pl-9 py-2" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => {
              const T = typeOf(c.type); const st = STATUS[c.status]; const Icon = T.icon; const StIcon = st.icon;
              return (
                <button key={c.id} onClick={() => setSelected(c)} className="card !p-4 text-left hover:shadow-lift hover:border-brand-200 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shrink-0"><Icon size={17} /></span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${st.b} ${st.t}`}><StIcon size={11} />{st.label}</span>
                  </div>
                  <div className="mt-2.5 font-semibold text-navy-900 truncate">{c.name}</div>
                  <div className="text-xs text-gray-400">{T.label}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{c.findings.length} finding{c.findings.length === 1 ? '' : 's'}</span>
                    <span className={`text-lg font-bold ${scoreColor(c.score)}`}>{c.score}<span className="text-xs text-gray-400 font-semibold">/100</span></span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <p className="text-[11px] text-gray-400 mt-6">Components and results are stored in your browser for now. Live cloud connections (read-only AWS/GCP/Azure/Kubernetes) are on the roadmap and require server-side credential handling.</p>

      {adding && <AddDrawer onClose={() => setAdding(false)} onAdd={addComponent} />}
      {selected && <DetailDrawer comp={selected} onClose={() => setSelected(null)} onRevalidate={revalidate} onRemove={remove} />}
    </div>
  );
}

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
          <h2 className="text-base font-bold text-navy-900">Add component</h2>
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

function DetailDrawer({ comp, onClose, onRevalidate, onRemove }) {
  const T = typeOf(comp.type); const st = STATUS[comp.status]; const Icon = T.icon;
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const findings = [...comp.findings].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shrink-0"><Icon size={17} /></span>
            <div className="min-w-0"><div className="font-bold text-navy-900 truncate">{comp.name}</div><div className="text-xs text-gray-400">{T.label}</div></div>
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
                {findings.map((f, i) => {
                  const sv = SEV[f.severity] || SEV.low;
                  return (
                    <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sv.b} ${sv.t}`}><span className={`w-1.5 h-1.5 rounded-full ${sv.d}`} />{sv.label}</span>
                        <span className="text-sm font-semibold text-navy-900">{f.title}</span>
                        {f.line ? <span className="text-[11px] text-gray-400 ml-auto font-mono">line {f.line}</span> : null}
                      </div>
                      <p className="text-xs text-gray-600 mt-1.5 leading-snug">{f.detail}</p>
                    </div>
                  );
                })}
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
