// @ts-nocheck
import { useEffect, useState } from 'react';
import { Loader as Loader2, ChevronRight, ChevronDown, FileCode, AlertTriangle, Check, Copy, Ticket } from 'lucide-react';
import { linterFor, selectScanTargets } from './fileLinters';
import { getFile, loadReport, saveReport } from './repoCache';

const SEV = {
  high: 'bg-[#fde3e3] text-[#d61f1f] border border-[#f5a3a3]',
  medium: 'bg-[#fff0d9] text-[#e07600] border border-[#f9c777]',
  low: 'bg-[#e3f7ea] text-[#0f9a4c] border border-[#9adcb4]',
};
const rank = { high: 0, medium: 1, low: 2 };

export function DetailedFindings({ project, paths, onTicket }) {
  const [loading, setLoading] = useState(true);
  const [byFile, setByFile] = useState([]);
  const [open, setOpen] = useState({});
  const [partial, setPartial] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    let alive = true;
    const cached = loadReport('findings', project);
    if (cached && cached.data) { setByFile(cached.data.byFile || []); setPartial(!!cached.data.partial); setLoading(false); return () => { alive = false; }; }
    (async () => {
      if (!paths?.length) { setLoading(false); return; }
      const targets = selectScanTargets(paths);
      const groups = []; let failures = 0;
      const results = await Promise.all(targets.map(async (p) => {
        const content = await getFile(project, p);
        if (content == null) { failures++; return null; }
        const linter = linterFor(p);
        const findings = linter ? linter(content, p) : [];
        return findings.length ? { file: p, findings: findings.sort((a, b) => rank[a.severity] - rank[b.severity]) } : null;
      }));
      if (!alive) return;
      results.filter(Boolean).forEach((g) => groups.push(g));
      groups.sort((a, b) => b.findings.length - a.findings.length);
      const isPartial = failures > targets.length / 2;
      setByFile(groups); setPartial(isPartial); setLoading(false);
      if (!isPartial) saveReport('findings', project, { byFile: groups, partial: isPartial });
    })();
    return () => { alive = false; };
  }, [project.git_url, project.git_branch, paths]);

  if (loading) return <div className="card flex items-center gap-2 text-sm text-gray-500"><Loader2 size={15} className="animate-spin text-brand-600" />Scanning files for line-level issues…</div>;
  if (!byFile.length) return <div className="card flex items-center gap-2 text-sm text-green-700"><Check size={15} />No file-level issues detected in the scanned infrastructure & config files.</div>;

  const total = byFile.reduce((s, g) => s + g.findings.length, 0);

  const copyTicket = (f) => {
    const text = `[${f.severity.toUpperCase()}] ${f.title}\nFile: ${f.file}:${f.line}\nType: ${f.type === 'omission' ? 'Missing (omission)' : 'Misconfiguration (commission)'}\n\n${f.detail}\n\nAcceptance criteria: resolve the issue in ${f.file} and re-run the Lythouse assessment.`;
    navigator.clipboard?.writeText(text); setCopied(f.file + f.line + f.title); setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-navy-900">Detailed Findings — by file</h3>
        <span className="text-xs text-gray-500">{total} issue{total === 1 ? '' : 's'} across {byFile.length} file{byFile.length === 1 ? '' : 's'}</span>
      </div>
      {partial && <p className="text-[11px] text-amber-600 mb-2">Some files couldn't be read (GitHub rate limit on public repos) — results may be partial.</p>}
      <div className="card !p-0 divide-y divide-gray-100">
        {byFile.map((g) => {
          const isOpen = open[g.file];
          const worst = g.findings[0]?.severity;
          return (
            <div key={g.file}>
              <button onClick={() => setOpen((o) => ({ ...o, [g.file]: !o[g.file] }))} className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50">
                {isOpen ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                <FileCode size={14} className="text-gray-400 shrink-0" />
                <span className="font-mono text-xs text-navy-800 truncate flex-1">{g.file}</span>
                <span className={`chip text-[10px] ${SEV[worst]}`}>{g.findings.length}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-3 pt-1 space-y-2 bg-gray-50/40">
                  {g.findings.map((f, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`chip text-[10px] ${SEV[f.severity]}`}>{f.severity}</span>
                          <span className="chip text-[10px] bg-gray-100 text-gray-600 border border-gray-200">{f.type === 'omission' ? 'Omission' : 'Commission'}</span>
                          <span className="text-sm font-medium text-navy-800">{f.title}</span>
                          <span className="text-[11px] text-gray-400">line {f.line}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 leading-snug">{f.detail}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => copyTicket(f)} title="Copy as ticket" className="btn-ghost !px-2 !py-1 text-xs">{copied === f.file + f.line + f.title ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}</button>
                        {onTicket && <button onClick={() => onTicket(f)} title="Create ticket" className="btn-ghost !px-2 !py-1 text-xs"><Ticket size={13} /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
