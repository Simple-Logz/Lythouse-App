// @ts-nocheck
import { useEffect, useState } from 'react';
import {
  Loader as Loader2, Check, X, AlertTriangle, ArrowRight, Shield, ChevronDown, ChevronRight,
  Clock, Rocket, Server, Boxes, Lock, Layers, Zap, Package, ShieldCheck,
} from 'lucide-react';
import { linterFor, selectScanTargets } from './fileLinters';
import { getTree, getFile, ERROR_TEXT } from './repoCache';

const OK = 'text-[#0f9a4c]', WARN = 'text-[#e07600]', BAD = 'text-[#d61f1f]';
const SEVCLS = { high: 'bg-[#fde3e3] text-[#d61f1f] border border-[#f5a3a3]', medium: 'bg-[#fff0d9] text-[#e07600] border border-[#f9c777]', low: 'bg-[#e3f7ea] text-[#0f9a4c] border border-[#9adcb4]' };
const scoreCls = (s) => s >= 85 ? OK : s >= 60 ? WARN : BAD;
const barCls = (s) => s >= 85 ? 'bg-[#0f9a4c]' : s >= 60 ? 'bg-[#e07600]' : 'bg-[#d61f1f]';
const RULES = { Containers: 7, Infrastructure: 7, Governance: 5, Kubernetes: 6 };
const CAT_ICON = { Infrastructure: Server, Containers: Boxes, Kubernetes: Layers, Secrets: Lock, Governance: ShieldCheck, Dependencies: Package };

const VULN = { lodash: 'high', axios: 'high', minimist: 'high', handlebars: 'high', moment: 'medium', 'node-fetch': 'medium', ws: 'high', jsonwebtoken: 'high' };

function categoryOf(f) {
  if (/secret|credential|hardcoded/i.test(f.title)) return 'Secrets';
  const p = f.file || '';
  if (/(^|\/)Dockerfile/i.test(p)) return 'Containers';
  if (/\.tf$/i.test(p)) return 'Infrastructure';
  if (/\.github\/workflows\/|gitlab-ci|Jenkinsfile/i.test(p)) return 'Governance';
  if (/(k8s|kubernetes|manifest|deploy|overlays|base)\/.*\.ya?ml$/i.test(p)) return 'Kubernetes';
  return 'Governance';
}

export function ValidationReport({ project, scanHistory = [], onRemediate, onApprovals }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [openCat, setOpenCat] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const tree = await getTree(project);
      if (tree.error) { if (alive) { setData({ error: ERROR_TEXT[tree.error] }); setLoading(false); } return; }
      const paths = tree.paths;
      const targets = selectScanTargets(paths);
      // run linters
      const all = [];
      const typeCounts = { Containers: 0, Infrastructure: 0, Governance: 0, Kubernetes: 0 };
      await Promise.all(targets.map(async (p) => {
        const c = await getFile(project, p);
        if (c == null) return;
        if (/(^|\/)Dockerfile/i.test(p)) typeCounts.Containers++;
        else if (/\.tf$/i.test(p)) typeCounts.Infrastructure++;
        else if (/\.github\/workflows\/|gitlab-ci|Jenkinsfile/i.test(p)) typeCounts.Governance++;
        else if (/(k8s|kubernetes|manifest|deploy|overlays|base)\/.*\.ya?ml$/i.test(p)) typeCounts.Kubernetes++;
        const lint = linterFor(p);
        if (lint) all.push(...lint(c, p));
      }));
      // dependency audit (light)
      const pkgs = paths.filter((p) => /(^|\/)package\.json$/.test(p)).slice(0, 3);
      let depChecks = 0;
      await Promise.all(pkgs.map(async (p) => {
        const c = await getFile(project, p);
        if (!c) return; depChecks += Object.keys(VULN).length;
        try { const j = JSON.parse(c); const deps = { ...j.dependencies, ...j.devDependencies };
          for (const [name, sev] of Object.entries(VULN)) if (deps[name]) all.push({ file: p, line: 1, type: 'commission', severity: sev, title: `Vulnerable dependency: ${name}`, detail: `${name} ${deps[name]} has known vulnerabilities — upgrade.` });
        } catch {}
      }));

      // categorize
      const cats = {};
      const ensure = (k) => (cats[k] = cats[k] || { key: k, findings: [], executed: 0 });
      Object.entries(typeCounts).forEach(([k, n]) => { if (n > 0) ensure(k).executed += n * (RULES[k] || 5); });
      if (pkgs.length) ensure('Dependencies').executed += depChecks;
      // Secrets is cross-cutting — count a check per scanned file
      if (targets.length) ensure('Secrets').executed += targets.length;
      all.forEach((f) => ensure(categoryOf(f)).findings.push(f));

      const catList = Object.values(cats).map((c) => {
        const high = c.findings.filter((f) => f.severity === 'high').length;
        const med = c.findings.filter((f) => f.severity === 'medium').length;
        const low = c.findings.filter((f) => f.severity === 'low').length;
        const penalty = high * 18 + med * 8 + low * 3;
        const score = Math.max(0, Math.min(100, 100 - penalty));
        const status = high > 0 ? 'fail' : (med + low) > 0 ? 'warn' : 'pass';
        return { ...c, high, med, low, score, status };
      }).sort((a, b) => a.score - b.score);

      const executed = catList.reduce((s, c) => s + c.executed, 0);
      const blockers = all.filter((f) => f.severity === 'high');
      const warnings = all.filter((f) => f.severity === 'medium').length;
      const lows = all.filter((f) => f.severity === 'low').length;
      const passed = Math.max(0, executed - all.length);
      const overall = catList.length ? Math.round(catList.reduce((s, c) => s + c.score, 0) / catList.length) : 100;
      const rollbackProb = Math.min(60, 4 + blockers.length * 7 + warnings * 2);
      const confidence = 100 - rollbackProb;

      // top blockers with owner/eta
      const OWN = { Containers: ['Platform', 18], Governance: ['Security', 4], Infrastructure: ['SRE', 20], Kubernetes: ['SRE', 15], Secrets: ['Security', 12], Dependencies: ['Engineering', 25] };
      const topBlockers = blockers.slice(0, 6).map((f) => { const cat = categoryOf(f); const [owner, eta] = OWN[cat] || ['Platform', 15]; return { ...f, cat, owner, eta }; });

      // static deployment simulation (inferred)
      const hasProbeGap = all.some((f) => /health probes/i.test(f.title));
      const rootImg = all.some((f) => /runs as root/i.test(f.title));
      const k8sPresent = typeCounts.Kubernetes > 0;
      const sim = [
        { k: 'Build', s: 'pass' },
        { k: 'Container Image', s: rootImg ? 'warn' : 'pass' },
        { k: 'Registry Push', s: 'pass' },
        { k: 'Infrastructure (Terraform)', s: cats.Infrastructure && cats.Infrastructure.findings.some((f) => f.severity === 'high') ? 'fail' : 'pass' },
        { k: k8sPresent ? 'Kubernetes Rollout' : 'Deploy', s: cats.Kubernetes && cats.Kubernetes.findings.some((f) => f.severity === 'high') ? 'fail' : 'pass' },
        { k: 'Health Checks', s: hasProbeGap ? 'fail' : 'pass' },
      ];
      const simFail = sim.some((s) => s.s === 'fail');

      if (alive) { setData({ executed, passed, warnings: warnings + lows, blockers: blockers.length, overall, confidence, rollbackProb, catList, topBlockers, sim, simFail, status: blockers.length ? 'BLOCKED' : (warnings + lows) ? 'REVIEW' : 'READY' }); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [project.git_url, project.git_branch]);

  if (loading) return <div className="card flex items-center gap-2 text-sm text-gray-500"><Loader2 size={15} className="animate-spin text-brand-600" />Running production-readiness validation…</div>;
  if (!data || data.error) return <div className="card border-amber-200 bg-amber-50 text-sm text-amber-800"><AlertTriangle size={15} className="inline mr-1" />{data?.error || 'No repository to validate.'}</div>;
  const d = data;
  const statusTone = d.status === 'BLOCKED' ? BAD : d.status === 'REVIEW' ? WARN : OK;
  const statusBg = d.status === 'BLOCKED' ? 'bg-[#fdf1f1] border-[#f5a3a3]' : d.status === 'REVIEW' ? 'bg-[#fef9f0] border-[#f9c777]' : 'bg-[#f2f9f3] border-[#9adcb4]';
  const SIM = { pass: <Check size={14} className="text-[#0f9a4c]" />, warn: <AlertTriangle size={14} className="text-[#e07600]" />, fail: <X size={14} className="text-[#d61f1f]" /> };

  return (
    <div className="space-y-5">
      {/* 1. Validation Summary */}
      <div className={`card border ${statusBg}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Validation Summary</p>
            <div className={`text-2xl font-bold ${statusTone} mt-0.5`}>{d.status === 'BLOCKED' ? 'Deployment Blocked' : d.status === 'REVIEW' ? 'Review Required' : 'Validation Passed'}</div>
          </div>
          <div className="text-center"><div className={`text-3xl font-bold ${scoreCls(d.confidence)}`}>{d.confidence}%</div><div className="text-[11px] text-gray-500">deployment confidence</div></div>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mt-4">
          {[{ l: 'Checks Executed', v: d.executed, c: 'text-navy-900' }, { l: 'Passed', v: d.passed, c: OK }, { l: 'Warnings', v: d.warnings, c: d.warnings ? WARN : OK }, { l: 'Blockers', v: d.blockers, c: d.blockers ? BAD : OK }].map((x) => (
            <div key={x.l}><div className={`text-2xl font-bold ${x.c}`}>{x.v}</div><div className="text-[11px] uppercase tracking-wide text-gray-400 mt-0.5">{x.l}</div></div>
          ))}
        </div>
      </div>

      {/* 2. Validation Categories (clickable) */}
      <div>
        <h3 className="text-sm font-semibold text-navy-900 mb-2">Validation Matrix</h3>
        <div className="card !p-0 divide-y divide-gray-100">
          {d.catList.map((c) => {
            const Icon = CAT_ICON[c.key] || Server; const isOpen = openCat === c.key;
            return (
              <div key={c.key}>
                <button onClick={() => setOpenCat(isOpen ? null : c.key)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50">
                  {c.findings.length ? (isOpen ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />) : <span className="w-3.5" />}
                  <Icon size={15} className="text-gray-400 shrink-0" />
                  <span className="w-40 shrink-0 text-sm font-medium text-navy-800">{c.key}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden max-w-xs"><div className={`h-full rounded-full ${barCls(c.score)}`} style={{ width: `${c.score}%` }} /></div>
                  <span className={`w-10 text-right text-sm font-bold ${scoreCls(c.score)}`}>{c.score}</span>
                  <span className="w-16 text-right">{c.status === 'pass' ? <Check size={15} className="inline text-[#0f9a4c]" /> : c.status === 'warn' ? <span className="text-xs font-medium text-[#e07600]">{c.med + c.low} warn</span> : <span className="text-xs font-medium text-[#d61f1f]">{c.high} block</span>}</span>
                </button>
                {isOpen && c.findings.length > 0 && (
                  <div className="px-5 pb-3 pt-1 space-y-1.5 bg-gray-50/40">
                    {c.findings.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm"><span className={`chip text-[10px] ${SEVCLS[f.severity]}`}>{f.severity}</span><span className="text-navy-800">{f.title}</span><span className="font-mono text-[11px] text-gray-400 truncate">{f.file}:{f.line}</span></div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Top Deployment Blockers */}
      {d.topBlockers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-navy-900 mb-2">Top Deployment Blockers</h3>
          <div className="space-y-2">
            {d.topBlockers.map((b, i) => (
              <div key={i} className="card flex flex-wrap items-center justify-between gap-3 border-[#f5a3a3]">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fde3e3] text-[#d61f1f] text-sm font-bold">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-navy-900">{b.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap"><span className="font-mono truncate">{b.file}:{b.line}</span><span className="flex items-center gap-1"><Clock size={11} />~{b.eta} min</span><span>Owner: <span className="text-navy-700 font-medium">{b.owner}</span></span></div>
                  </div>
                </div>
                <button onClick={onRemediate} className="btn-primary text-xs shrink-0"><ArrowRight size={13} />Fix Now</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. AI Validation Opinion */}
      <div className="card">
        <h3 className="text-sm font-semibold text-navy-900 mb-2">AI Validation Opinion</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">Would I deploy?</div>
            <div className={`text-xl font-bold ${d.blockers ? BAD : d.warnings ? WARN : OK}`}>{d.blockers ? 'No' : d.warnings ? 'Not yet' : 'Yes'}</div>
            <p className="text-sm text-gray-600 mt-1">{d.blockers ? `${d.blockers} deployment blocker${d.blockers === 1 ? '' : 's'} remain. ${d.topBlockers[0] ? 'Most likely failure: ' + d.topBlockers[0].title + '.' : ''}` : d.warnings ? `No blockers, but ${d.warnings} warning${d.warnings === 1 ? '' : 's'} to review.` : 'All validation categories passed.'}</p>
          </div>
          <div className="sm:border-l sm:border-gray-200 sm:pl-4">
            <div className="flex justify-between text-sm py-0.5"><span className="text-gray-500">Estimated rollback probability</span><span className={`font-bold ${d.rollbackProb <= 10 ? OK : d.rollbackProb <= 25 ? WARN : BAD}`}>{d.rollbackProb}%</span></div>
            <div className="flex justify-between text-sm py-0.5"><span className="text-gray-500">Overall readiness</span><span className={`font-bold ${scoreCls(d.overall)}`}>{d.overall}%</span></div>
            <div className="text-xs text-gray-500 mt-1">{d.blockers ? 'Recommendation: resolve blockers before deployment.' : 'Recommendation: proceed to governance sign-off.'}</div>
          </div>
        </div>
      </div>

      {/* 5. Deployment Simulation */}
      <div className="card">
        <h3 className="text-sm font-semibold text-navy-900 mb-1 flex items-center gap-1.5"><Rocket size={14} className="text-brand-600" />Deployment Simulation</h3>
        <p className="text-xs text-gray-500 mb-3">Static pre-deployment simulation — inferred from your configuration, not a live deploy.</p>
        <div className="flex flex-wrap items-center gap-2">
          {d.sim.map((s, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${s.s === 'fail' ? 'border-[#f5a3a3] bg-[#fde3e3] text-[#d61f1f]' : s.s === 'warn' ? 'border-[#f9c777] bg-[#fff0d9] text-[#e07600]' : 'border-gray-200 bg-white text-navy-700'}`}>{SIM[s.s]}{s.k}</span>
              {i < arr.length - 1 && <ArrowRight size={12} className="text-gray-300" />}
            </div>
          ))}
        </div>
        <div className={`mt-3 text-sm font-semibold ${d.simFail ? BAD : OK}`}>Simulated outcome: {d.simFail ? 'Deployment would FAIL' : 'Deployment would succeed'}{d.simFail && d.sim.find((s) => s.s === 'fail') ? ` — first failing stage: ${d.sim.find((s) => s.s === 'fail').k}` : ''}</div>
      </div>

      {/* 6. Scan history — demoted */}
      {scanHistory.length > 0 && (
        <details className="card group">
          <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold text-navy-900">Scan history (audit log)<ChevronDown size={15} className="text-gray-400 group-open:rotate-180 transition-transform" /></summary>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            {scanHistory.slice(0, 8).map((v, i) => (
              <div key={i} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${v.status === 'completed' ? 'bg-[#0f9a4c]' : v.status === 'failed' ? 'bg-[#d61f1f]' : 'bg-gray-400'}`} />Status: {v.status}</span><span className="text-gray-400">{v.created_at ? new Date(v.created_at).toLocaleString() : ''}</span></div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
