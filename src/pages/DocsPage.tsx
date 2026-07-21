// @ts-nocheck
// "How LytHouse Works" — the in-app Getting Started / documentation home.
// A real page (not a mockup): explains the flow, the core concepts, and gives
// a quickstart that links to the actual product pages.
import {
  GitBranch, Cloud, Gauge, ShieldCheck, Wand as Wand2, FileCheck,
  ArrowRight, BookOpen, Rocket, CircleCheck as CheckCircle2, Layers, Radio,
} from 'lucide-react';
import { PageHeader } from '../lib/ui';
import { Link } from '../lib/router';

const STEPS = [
  { icon: GitBranch, title: 'Connect a repository', body: 'Point LytHouse at your GitHub repo. Discovery reads it and understands your application before any release decision is made.', to: '/projects', cta: 'Open Projects' },
  { icon: Cloud, title: 'Connect an environment', body: 'Run the read-only collector where your cloud credentials already live. LytHouse pulls the live components — your keys never leave your side.', to: '/environment', cta: 'Open Environment' },
  { icon: Gauge, title: 'Get a release decision', body: 'Deterministic checks find the facts; the AI explains them, ties them to your change, and gives a clear go / delay call.', to: '/dashboard', cta: 'See a decision' },
  { icon: ShieldCheck, title: 'Enforce a policy gate', body: 'Policy Studio turns rules like "2 approvals + zero criticals" into gates that actually block a release until they pass.', to: '/policies', cta: 'Open Policy Studio' },
  { icon: Wand2, title: 'Auto-remediate', body: 'The AI writes the fix for a finding — from a misconfigured IAM policy to an open port — and opens a pull request.', to: '/projects', cta: 'Try remediation' },
  { icon: FileCheck, title: 'Prove it', body: 'Every decision, approval, and gate lands in the audit log and exports as evidence auditors accept.', to: '/audit', cta: 'View audit log' },
];

const CONCEPTS = [
  { term: 'Release Decision', def: 'LytHouse\'s go / delay / block recommendation for a release, computed from validations, approvals, and policy gates — never invented by the model.' },
  { term: 'Finding', def: 'A single issue detected by a deterministic check (a secret, a wildcard IAM grant, an open port). The AI explains and fixes findings; it does not invent them.' },
  { term: 'Policy Gate', def: 'A rule that must pass before a release proceeds — e.g. required approvals, zero critical findings, or a minimum environment posture.' },
  { term: 'Component', def: 'One piece of your infrastructure LytHouse validates — an IAM policy, a security group, a Kubernetes workload, a container image, a server.' },
  { term: 'Collector', def: 'A read-only agent you run where your credentials already live. It pulls live inventory and pushes only results — LytHouse never stores your cloud keys.' },
  { term: 'Posture', def: 'A 0–100 score for a component or the whole environment, based on the severity of its open findings.' },
];

export function DocsPage() {
  return (
    <div>
      <PageHeader
        title="How LytHouse Works"
        description="LytHouse decides whether a release is safe to ship — by understanding your code, validating your live environment, and enforcing the gates your team and auditors require."
        breadcrumb={<span className="text-xs text-gray-400">Getting Started · Overview</span>}
      />

      {/* intro banner */}
      <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-[#f7f5ff] to-white p-5 mb-8 flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shrink-0"><Rocket size={17} /></span>
        <div>
          <div className="font-bold text-navy-900">New here? Start with the two connections.</div>
          <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">LytHouse needs two things to work: your <b>code</b> (a repository) and your <b>environment</b> (cloud or on-prem). Connect both, and every release gets an evidence-backed decision.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link to="/projects" className="btn-primary text-sm">Connect a repository</Link>
            <Link to="/environment" className="btn-ghost text-sm border border-brand-200">Connect an environment<ArrowRight size={14} /></Link>
          </div>
        </div>
      </div>

      {/* the flow */}
      <div className="flex items-center gap-2 mb-3">
        <Layers size={15} className="text-brand-500" />
        <h2 className="text-sm font-bold text-navy-900">The flow, end to end</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-10">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="card !p-4 flex flex-col">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shrink-0"><Icon size={17} /></span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Step {i + 1}</span>
              </div>
              <div className="font-semibold text-navy-900">{s.title}</div>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed flex-1">{s.body}</p>
              <Link to={s.to} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">{s.cta}<ArrowRight size={12} /></Link>
            </div>
          );
        })}
      </div>

      {/* core concepts */}
      <div className="flex items-center gap-2 mb-3">
        <BookOpen size={15} className="text-brand-500" />
        <h2 className="text-sm font-bold text-navy-900">Core concepts</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 mb-10">
        {CONCEPTS.map((c) => (
          <div key={c.term} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="font-semibold text-navy-900 text-sm">{c.term}</div>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{c.def}</p>
          </div>
        ))}
      </div>

      {/* quickstart checklist */}
      <div className="flex items-center gap-2 mb-3">
        <Radio size={15} className="text-brand-500" />
        <h2 className="text-sm font-bold text-navy-900">Quickstart checklist</h2>
      </div>
      <div className="card !p-5 mb-6">
        <ol className="space-y-3">
          {[
            { t: 'Connect your GitHub repository', to: '/projects' },
            { t: 'Run Discovery so LytHouse understands the app', to: '/projects' },
            { t: 'Connect an environment and run the collector', to: '/environment' },
            { t: 'Set a policy gate for your release', to: '/policies' },
            { t: 'Invite your team and assign approvers', to: '/team' },
          ].map((x, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-600 shrink-0"><CheckCircle2 size={14} /></span>
              <span className="text-sm text-gray-700 flex-1">{x.t}</span>
              <Link to={x.to} className="text-xs font-medium text-brand-600 hover:underline shrink-0 inline-flex items-center gap-1">Go<ArrowRight size={12} /></Link>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-[11px] text-gray-400">This is the honest model: deterministic checks find the facts, the AI reasons over them, and policy gates enforce your rules. LytHouse never fabricates a decision or a finding.</p>
    </div>
  );
}
export default DocsPage;
