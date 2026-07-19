// @ts-nocheck
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PageHeader, Spinner } from '../lib/ui';
import { useRouter } from '../lib/router';
import { loadReport } from '../workspace/repoCache';
import { evaluateProject } from '../workspace/policyEngine';
import { ShieldCheck, ShieldAlert, ShieldX, TrendingUp, FolderGit2, AlertTriangle } from 'lucide-react';

const OK = '#0f9a4c', WARN = '#e07600', BAD = '#d61f1f';
const scoreColor = (s) => (s >= 80 ? OK : s >= 60 ? WARN : BAD);

export function CommandCenter() {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const wid = localStorage.getItem('sandbox.activeWs') || '';
      let projects = [];
      if (wid) { const { data } = await supabase.from('projects').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }); projects = data || []; }
      else { const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false }); projects = data || []; }
      const built = projects.map((p) => {
        const disc = loadReport('discovery', p)?.data;
        const pol = evaluateProject(p);
        return {
          project: p,
          analyzed: !!disc,
          readiness: disc?.overall ?? null,
          status: disc?.recommendation?.status || null,
          blockers: disc?.summary?.blockers ?? null,
          concerns: disc?.concerns || [],
          policyPass: pol.pass, policyFail: pol.fail, policyAnalyzed: pol.analyzed,
        };
      });
      setRows(built); setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>;

  const analyzed = rows.filter((r) => r.analyzed);
  const blocked = analyzed.filter((r) => r.status === 'BLOCKED').length;
  const avgReadiness = analyzed.length ? Math.round(analyzed.reduce((s, r) => s + (r.readiness || 0), 0) / analyzed.length) : null;
  const policyFailures = rows.reduce((s, r) => s + (r.policyFail || 0), 0);
  const policyTotal = rows.reduce((s, r) => s + (r.policyPass || 0) + (r.policyFail || 0), 0);
  const compliance = policyTotal ? Math.round(((policyTotal - policyFailures) / policyTotal) * 100) : null;
  const riskCount = {};
  analyzed.forEach((r) => r.concerns.forEach((c) => { if (c.sev === 'high' || c.sev === 'medium') riskCount[c.cat] = (riskCount[c.cat] || 0) + 1; }));
  const topRisks = Object.entries(riskCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const heatColor = (r) => r.readiness == null ? 'bg-gray-100 text-gray-400 border-gray-200' : r.status === 'BLOCKED' ? 'bg-[#fde3e3] text-[#d61f1f] border-[#f5a3a3]' : r.readiness >= 80 ? 'bg-[#e3f7ea] text-[#0f9a4c] border-[#9adcb4]' : 'bg-[#fff0d9] text-[#e07600] border-[#f9c777]';

  return (
    <div>
      <PageHeader title="Executive Command Center" description="Release readiness and risk across your entire engineering organization." />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-6">
        {[
          { l: 'Active Projects', v: rows.length, c: '#1f2937' },
          { l: 'Analyzed', v: analyzed.length, c: '#1f2937' },
          { l: 'Blocked', v: blocked, c: blocked ? BAD : OK },
          { l: 'Avg Readiness', v: avgReadiness == null ? '—' : `${avgReadiness}%`, c: avgReadiness == null ? '#9ca3af' : scoreColor(avgReadiness) },
          { l: 'Policy Compliance', v: compliance == null ? '—' : `${compliance}%`, c: compliance == null ? '#9ca3af' : scoreColor(compliance) },
        ].map((x) => (
          <div key={x.l} className="card"><div className="text-3xl font-bold" style={{ color: x.c }}>{x.v}</div><div className="text-xs text-gray-500 mt-1">{x.l}</div></div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-1.5"><TrendingUp size={15} className="text-brand-600" />Organization Risk Heat Map</h3>
          {rows.length === 0 ? <div className="card text-sm text-gray-500">No projects yet.</div> : (
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3">
              {rows.map((r) => (
                <button key={r.project.id} onClick={() => navigate(`/projects/${r.project.id}`)} className={`rounded-xl border p-3 text-left transition-all hover:shadow-md ${heatColor(r)}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold truncate text-navy-900">{r.project.name}</span>
                    {r.status === 'BLOCKED' ? <ShieldX size={15} /> : r.readiness >= 80 ? <ShieldCheck size={15} /> : r.readiness != null ? <ShieldAlert size={15} /> : <FolderGit2 size={15} className="text-gray-400" />}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{r.readiness == null ? '—' : `${r.readiness}%`}</span>
                    <span className="text-[11px] font-medium">{r.status || 'not analyzed'}</span>
                  </div>
                  {r.blockers > 0 && <div className="text-[11px] mt-0.5">{r.blockers} blocker{r.blockers === 1 ? '' : 's'}</div>}
                </button>
              ))}
            </div>
          )}
          {rows.some((r) => !r.analyzed) && <p className="text-[11px] text-gray-400 mt-2">Projects marked “not analyzed” haven’t had their Discovery report generated yet — open them once to populate.</p>}
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-1.5"><AlertTriangle size={15} className="text-[#e07600]" />Top Organizational Risks</h3>
            <div className="card">
              {topRisks.length ? (
                <ul className="space-y-2">
                  {topRisks.map(([cat, n]) => (
                    <li key={cat} className="flex items-center justify-between text-sm"><span className="text-navy-800">{cat}</span><span className="chip text-[10px] bg-[#fff0d9] text-[#e07600] border border-[#f9c777]">{n} project{n === 1 ? '' : 's'}</span></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-400">No risks across analyzed projects.</p>}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-1.5"><ShieldCheck size={15} className="text-brand-600" />Policy Compliance</h3>
            <button onClick={() => navigate('/policies')} className="card w-full text-left hover:shadow-md transition-all">
              <div className="flex items-baseline gap-2"><span className="text-3xl font-bold" style={{ color: compliance == null ? '#9ca3af' : scoreColor(compliance) }}>{compliance == null ? '—' : `${compliance}%`}</span><span className="text-xs text-gray-500">across {rows.length} projects</span></div>
              <div className="text-xs text-gray-500 mt-1">{policyFailures} policy violation{policyFailures === 1 ? '' : 's'} — manage rules in the Policy Studio →</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
