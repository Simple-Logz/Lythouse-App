import { useMemo, useState } from 'react';
import { Activity, Boxes, CircleDollarSign, Code2, GitBranch, PackageSearch, Server, Sparkles, TestTube2 } from 'lucide-react';

const DOMAINS = [
  ['Overview', Sparkles],
  ['Code', Code2],
  ['Infrastructure', Server],
  ['DevOps', GitBranch],
  ['QA', TestTube2],
  ['Cost', CircleDollarSign],
  ['Dependencies', PackageSearch],
  ['Vendor Intelligence', Boxes],
] as const;

export function AnalysisExperience({ project, result, onRunAnalysis }: any) {
  const [active, setActive] = useState('Overview');
  const facts = useMemo(() => {
    if (!result) return [];
    return [
      result.appType && { label: 'Application', value: result.appType },
      result.counts?.files != null && { label: 'Repository files', value: result.counts.files.toLocaleString() },
      result.services != null && { label: 'Services detected', value: result.services },
      result.ci && result.ci !== '—' && { label: 'Delivery', value: result.ci },
    ].filter(Boolean);
  }, [result]);

  const domainCopy: Record<string, string> = {
    Code: 'Code structure, application behavior, security-sensitive paths and implementation risks.',
    Infrastructure: 'Infrastructure-as-code, cloud configuration, containers, orchestration and production topology.',
    DevOps: 'Build, release, CI/CD, deployment controls, rollback readiness and delivery risk.',
    QA: 'Test coverage signals, validation gaps and release confidence evidence.',
    Cost: 'Evidence-backed cost drivers and optimization opportunities. Unsupported estimates are never invented.',
    Dependencies: 'Runtime and build dependencies, version exposure, compatibility and supply-chain intelligence.',
    'Vendor Intelligence': 'External platform, framework and vendor lifecycle intelligence relevant to this application.',
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-5 md:px-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600"><Activity size={14}/> Lythouse Intelligence</div>
          <h2 className="mt-2 text-xl md:text-2xl font-bold text-slate-950">Before you deploy, know what you don't know.</h2>
          <p className="mt-1 text-sm text-slate-500">{project?.name || 'Connected repository'} · application-wide pre-deployment intelligence</p>
        </div>
        <button onClick={onRunAnalysis} className="btn-primary whitespace-nowrap"><Sparkles size={16}/> Run Analysis</button>
      </div>

      <div className="px-4 pt-4 md:px-7 overflow-x-auto">
        <div className="flex min-w-max gap-1 border-b border-slate-200">
          {DOMAINS.map(([name, Icon]) => (
            <button key={name} onClick={() => setActive(name)} className={`flex items-center gap-2 px-3 py-3 text-sm font-semibold border-b-2 transition ${active === name ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
              <Icon size={15}/>{name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 md:p-7">
        {active === 'Overview' ? <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {facts.map((f: any) => <div key={f.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{f.label}</p><p className="mt-2 text-lg font-bold text-slate-950">{f.value}</p></div>)}
          </div>
          <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
            <p className="font-bold text-slate-950">Analysis pipeline</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                ['01 · Understand', 'Build the Lythouse Application Model from repository evidence.'],
                ['02 · Investigate', 'Correlate evidence across code, infrastructure, delivery, QA, cost and dependencies.'],
                ['03 · Resolve', 'Turn consequential findings into a Lythouse fix, guided fix, or incident.'],
              ].map(([t,d]) => <div key={t} className="rounded-lg bg-white border border-indigo-100 p-4"><p className="text-sm font-bold text-indigo-700">{t}</p><p className="mt-1 text-sm text-slate-600">{d}</p></div>)}
            </div>
          </div>
        </> : <div className="min-h-[220px] flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <div className="max-w-xl"><p className="text-lg font-bold text-slate-950">{active} Intelligence</p><p className="mt-2 text-sm leading-6 text-slate-600">{domainCopy[active]}</p><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Results are populated from verified analysis evidence</p></div>
        </div>}
      </div>
    </section>
  );
}
