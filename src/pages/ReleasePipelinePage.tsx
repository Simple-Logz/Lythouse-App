// @ts-nocheck
// Release Pipeline — how a release moves from commit to deploy, PLUS a real
// activity feed: your workspace's actual recent validations run through the
// actual gate thresholds configured for the workspace (deployment_policies),
// so this answers "what happened to my releases and why" instead of just
// illustrating the concept.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PageHeader, Spinner, timeAgo } from '../lib/ui';
import { Link } from '../lib/router';
import {
  GitBranch, ScanLine, Radar, ShieldCheck, Rocket, XCircle, CircleCheck as CheckCircle2,
  Key, Package, Lock, Boxes, SlidersHorizontal, Gauge, ChevronDown, ChevronRight,
  Loader as Loader2, AlertTriangle,
} from 'lucide-react';

function Node({ icon: Icon, title, sub, tone = 'default' }) {
  const tones = {
    default: 'border-gray-200 bg-white',
    trigger: 'border-brand-200 bg-brand-50/50',
    decision: 'border-brand-300 bg-brand-50/70',
  };
  return (
    <div className={`mx-auto w-full max-w-sm rounded-2xl border p-4 shadow-soft ${tones[tone]}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon size={18} /></span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-navy-900">{title}</div>
          <div className="text-[12px] text-gray-500">{sub}</div>
        </div>
      </div>
    </div>
  );
}

function Conn({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-5 w-px bg-brand-200" />
      {label && <span className="my-0.5 rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">{label}</span>}
      <div className="h-5 w-px bg-brand-200" />
    </div>
  );
}

const CHECKS = [
  { icon: Key, label: 'Secrets' },
  { icon: Package, label: 'Dependencies' },
  { icon: Lock, label: 'IAM & config' },
  { icon: Boxes, label: 'Containers' },
];

// Fallback thresholds when a workspace hasn't configured deployment_policies
// yet — matches the defaults PoliciesPage.tsx writes on first save, so the
// gate verdicts shown here don't disagree with what the workspace will get
// once it's explicitly configured.
const DEFAULT_POLICY = { max_risk_score: 50, block_critical: true, block_high: false, require_approval: false };

function verdictFor(v, policy) {
  if (v.status !== 'completed') return { label: v.status === 'failed' ? 'Failed' : 'Running', blocked: null, reasons: [] };
  const reasons = [];
  if (policy.block_critical && v.critical_count > 0) reasons.push(`${v.critical_count} critical finding${v.critical_count === 1 ? '' : 's'}`);
  if (policy.block_high && v.high_count > 0) reasons.push(`${v.high_count} high-severity finding${v.high_count === 1 ? '' : 's'}`);
  if (v.risk_score != null && v.risk_score > policy.max_risk_score) reasons.push(`risk score ${v.risk_score} exceeds the ${policy.max_risk_score} threshold`);
  return { label: reasons.length ? 'Blocked' : 'Cleared', blocked: reasons.length > 0, reasons };
}

export function ReleasePipelinePage() {
  const [loading, setLoading] = useState(true);
  const [validations, setValidations] = useState([]);
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [policyIsDefault, setPolicyIsDefault] = useState(true);
  const [showDiagram, setShowDiagram] = useState(false);

  useEffect(() => {
    (async () => {
      const wid = localStorage.getItem('sandbox.activeWs') || '';
      if (!wid) { setLoading(false); return; }
      const [vs, pol] = await Promise.all([
        supabase.from('validations').select('*,projects(name)').eq('workspace_id', wid).order('created_at', { ascending: false }).limit(12),
        supabase.from('deployment_policies').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }).limit(1),
      ]);
      setValidations((vs.data ?? []).map((r) => ({ ...r, project_name: r.projects?.name })));
      if (pol.data?.[0]) { setPolicy(pol.data[0]); setPolicyIsDefault(false); }
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Release Pipeline"
        description="Your workspace's recent releases, run through the actual gate thresholds configured for this workspace."
        breadcrumb={<span className="text-xs text-gray-400">Release Intelligence · Release Pipeline</span>}
      />

      <button onClick={() => setShowDiagram((v) => !v)} className="mb-5 flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-navy-900 transition-colors">
        {showDiagram ? <ChevronDown size={14} /> : <ChevronRight size={14} />} How the pipeline works
      </button>

      {showDiagram && (
      <div className="mx-auto mb-10 max-w-3xl">
        <Node icon={GitBranch} title="Trigger" sub="A new commit or pull request" tone="trigger" />
        <Conn />
        <Node icon={ScanLine} title="Discover" sub="Read the repo — understand what changed" />
        <Conn label="then validate" />

        {/* Validate group — parallel checks */}
        <div className="mx-auto w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Radar size={18} /></span>
            <div>
              <div className="text-sm font-bold text-navy-900">Validate</div>
              <div className="text-[12px] text-gray-500">Deterministic checks run in parallel — no fabricated numbers</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {CHECKS.map((c) => (
              <div key={c.label} className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-center">
                <c.icon size={17} className="text-brand-600" />
                <span className="text-[12px] font-medium text-navy-800">{c.label}</span>
                <CheckCircle2 size={13} className="text-green-500" />
              </div>
            ))}
          </div>
        </div>

        <Conn />
        <Node icon={Gauge} title="Findings & posture" sub="Severity-weighted readiness score" />
        <Conn />
        <Node icon={SlidersHorizontal} title="Policy gates" sub="Enforce your rules — zero criticals, required approvals…" tone="decision" />

        {/* fork connector */}
        <svg width="240" height="40" viewBox="0 0 240 40" className="mx-auto" fill="none">
          <path d="M120 0 V14" stroke="#c4b5fd" strokeWidth="1.5" />
          <path d="M120 14 C120 30 64 22 64 40" stroke="#c4b5fd" strokeWidth="1.5" />
          <path d="M120 14 C120 30 176 22 176 40" stroke="#c4b5fd" strokeWidth="1.5" />
        </svg>

        {/* outcomes */}
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#f3c0c4] bg-[#fdeef0] p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fadadd] text-[#d3495a]"><XCircle size={17} /></span>
              <div><div className="text-sm font-bold text-navy-900">Blocked</div><div className="text-[12px] text-[#a23b48]">A failed gate stops the release</div></div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#a6e3c3] bg-[#e6f8ee] p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c9f0d9] text-[#12874e]"><Rocket size={17} /></span>
              <div><div className="text-sm font-bold text-navy-900">Deploy</div><div className="text-[12px] text-[#12874e]">Approved &amp; gated — cleared to ship</div></div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">This is the general shape every release runs through. The gates below are evaluated against your workspace's actual policy thresholds.</p>
      </div>
      )}

      {policyIsDefault && !loading && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="shrink-0" />
          <span>No deployment policy configured for this workspace yet — showing results against default thresholds (block on critical findings, max risk score 50). <Link to="/policies" className="font-medium underline">Configure real gate thresholds</Link>.</span>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <GitBranch size={16} className="text-gray-400" />
        <h2 className="text-sm font-bold text-navy-900">Recent releases</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 justify-center text-sm text-gray-400"><Loader2 size={16} className="animate-spin" /> Loading releases…</div>
      ) : validations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center">
          <Rocket size={22} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-navy-900">No releases yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-gray-400">Run a validation on one of your projects and it will show up here, gated against your policy thresholds.</p>
          <Link to="/projects" className="mt-4 inline-block rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800">Go to Projects</Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {validations.map((v) => {
            const verdict = verdictFor(v, policy);
            const isBlocked = verdict.blocked === true;
            const isCleared = verdict.blocked === false;
            return (
              <Link
                key={v.id}
                to={`/projects/${v.project_id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-3.5 shadow-sm transition-colors hover:border-gray-200"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    isBlocked ? 'bg-[#fbe0df] text-[#b3261e]' : isCleared ? 'bg-[#c9f0d9] text-[#12874e]' : verdict.label === 'Failed' ? 'bg-[#fbe0df] text-[#b3261e]' : 'bg-[#e9e6f2] text-gray-500'
                  }`}>
                    {isBlocked ? <XCircle size={16} /> : isCleared ? <CheckCircle2 size={16} /> : verdict.label === 'Failed' ? <XCircle size={16} /> : <Loader2 size={16} className="animate-spin" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                      <span className="truncate">{v.project_name || 'Unknown project'}</span>
                      {v.commit_sha && <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-500">{String(v.commit_sha).slice(0, 7)}</span>}
                    </div>
                    <div className="mt-0.5 text-[12px] text-gray-400">
                      {v.trigger || 'manual'} · {timeAgo(v.created_at)}
                      {v.risk_score != null && <> · risk score {v.risk_score}</>}
                      {(v.critical_count > 0 || v.high_count > 0) && (
                        <> · {[v.critical_count > 0 && `${v.critical_count} critical`, v.high_count > 0 && `${v.high_count} high`].filter(Boolean).join(', ')}</>
                      )}
                    </div>
                    {verdict.reasons.length > 0 && (
                      <div className="mt-1 text-[11px] text-[#b3261e]">Blocked: {verdict.reasons.join('; ')}</div>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                  isBlocked ? 'bg-[#fbe0df] text-[#b3261e]' : isCleared ? 'bg-[#c9f0d9] text-[#12874e]' : verdict.label === 'Failed' ? 'bg-[#fbe0df] text-[#b3261e]' : 'bg-[#e9e6f2] text-gray-500'
                }`}>{verdict.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default ReleasePipelinePage;
