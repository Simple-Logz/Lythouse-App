// @ts-nocheck
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../lib/ui';
import { ShieldCheck, Check, X } from 'lucide-react';
import { RULE_CATALOG, loadPolicies, savePolicy, evaluateProject } from '../workspace/policyEngine';

// Policy-as-Code Studio — org-defined deployment rules, evaluated live against
// every analyzed project.
export function PolicyPage() {
  const [policies, setPolicies] = useState(loadPolicies());
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    (async () => {
      const wid = localStorage.getItem('sandbox.activeWs') || '';
      const q = wid ? supabase.from('projects').select('*').eq('workspace_id', wid) : supabase.from('projects').select('*');
      const { data } = await q; setProjects((data || []).map((p) => ({ p, ev: evaluateProject(p) })));
    })();
  }, []);

  const refresh = () => setPolicies(loadPolicies());
  const toggle = (id, enabled) => { savePolicy(id, { enabled }); refresh(); };
  const setThreshold = (id, threshold) => { savePolicy(id, { threshold: Number(threshold) }); refresh(); };

  // recompute project evaluations when policies change
  useEffect(() => { setProjects((prev) => prev.map(({ p }) => ({ p, ev: evaluateProject(p) }))); }, [policies]);

  const analyzed = projects.filter((x) => x.ev.analyzed);
  const totalChecks = analyzed.reduce((s, x) => s + x.ev.results.length, 0);
  const violations = analyzed.reduce((s, x) => s + x.ev.fail, 0);
  const compliance = totalChecks ? Math.round(((totalChecks - violations) / totalChecks) * 100) : null;

  return (
    <div>
      <PageHeader title="Policy-as-Code Studio" description="Define your organization's deployment rules once — LytHouse enforces them across every project." />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        {[
          { l: 'Active Rules', v: policies.filter((p) => p.enabled).length },
          { l: 'Projects Evaluated', v: analyzed.length },
          { l: 'Violations', v: violations, c: violations ? '#d61f1f' : '#0f9a4c' },
          { l: 'Compliance', v: compliance == null ? '—' : `${compliance}%`, c: compliance == null ? '#9ca3af' : compliance >= 80 ? '#0f9a4c' : compliance >= 60 ? '#e07600' : '#d61f1f' },
        ].map((x) => (<div key={x.l} className="card"><div className="text-2xl font-bold" style={{ color: x.c || '#1f2937' }}>{x.v}</div><div className="text-xs text-gray-500 mt-1">{x.l}</div></div>))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Rule catalog */}
        <div>
          <h3 className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-1.5"><ShieldCheck size={15} className="text-brand-600" />Deployment Rules</h3>
          <div className="card !p-0 divide-y divide-gray-100">
            {policies.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-navy-800">{p.label}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{p.category}</div>
                  {p.id === 'min-readiness' && p.enabled && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">Threshold
                      <input type="number" min="0" max="100" value={p.threshold} onChange={(e) => setThreshold(p.id, e.target.value)} className="input !w-16 !py-1 text-xs" />%
                    </div>
                  )}
                </div>
                <button onClick={() => toggle(p.id, !p.enabled)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${p.enabled ? 'bg-brand-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${p.enabled ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Rules are stored for your organization and evaluated against each project's latest analysis. Custom rule authoring is on the roadmap.</p>
        </div>

        {/* Compliance by project */}
        <div>
          <h3 className="text-sm font-semibold text-navy-900 mb-2">Compliance by Project</h3>
          {projects.length === 0 ? <div className="card text-sm text-gray-500">No projects yet.</div> : (
            <div className="space-y-2">
              {projects.map(({ p, ev }) => (
                <div key={p.id} className="card">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-navy-900">{p.name}</span>
                    {!ev.analyzed ? <span className="chip text-[10px] bg-gray-100 text-gray-500 border border-[#a1a1aa]">not analyzed</span>
                      : ev.fail === 0 ? <span className="chip text-[10px] bg-[#e3f7ea] text-[#0f9a4c] border border-[#9adcb4]">compliant</span>
                        : <span className="chip text-[10px] bg-[#fde3e3] text-[#d61f1f] border border-[#f5a3a3]">{ev.fail} violation{ev.fail === 1 ? '' : 's'}</span>}
                  </div>
                  {ev.analyzed && ev.fail > 0 && (
                    <ul className="mt-2 space-y-1">
                      {ev.results.filter((r) => !r.pass).map((r) => (
                        <li key={r.id} className="flex items-start gap-1.5 text-xs text-gray-600"><X size={13} className="text-[#d61f1f] shrink-0 mt-0.5" />{r.label}<span className="text-gray-400"> — {r.detail}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
