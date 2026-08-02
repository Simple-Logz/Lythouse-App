// @ts-nocheck
// Release Pipeline — a programmatic node-diagram view of how a release moves
// from commit to deploy: trigger → discover → validate (parallel checks) →
// findings → policy gates → decision (deploy / blocked). Static but domain-real.
import { PageHeader } from '../lib/ui';
import {
  GitBranch, ScanLine, Radar, ShieldCheck, Rocket, XCircle, CircleCheck as CheckCircle2,
  Key, Package, Lock, Boxes, SlidersHorizontal, Gauge,
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

export function ReleasePipelinePage() {
  return (
    <div>
      <PageHeader
        title="Release Pipeline"
        description="How a release moves from commit to deploy. Every stage runs automatically — and nothing ships until the gates pass."
        breadcrumb={<span className="text-xs text-gray-400">Release Intelligence · Release Pipeline</span>}
      />

      <div className="mx-auto max-w-3xl">
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

        <p className="mt-8 text-center text-xs text-gray-400">This is the workflow every release runs through. Configure the checks and gates in Policy Studio; connect a repository in Projects to see it run on real releases.</p>
      </div>
    </div>
  );
}
export default ReleasePipelinePage;
