// @ts-nocheck
// LytHouse Documentation — a real, teaching docs page: overview, how the
// pipeline works, core concepts explained in depth, step-by-step guides, the
// collector reference, the security/honesty model, and an FAQ. In-page TOC uses
// scrollIntoView (not hash anchors) so it doesn't fight the hash router.
import { useState } from 'react';
import {
  BookOpen, GitBranch, Cloud, Gauge, ShieldCheck, Wand as Wand2, FileCheck,
  Terminal, ArrowRight, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle,
  Lock, Rocket, Copy, Check, Info,
} from 'lucide-react';
import { PageHeader } from '../lib/ui';
import { Link } from '../lib/router';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'how', label: 'How it works' },
  { id: 'concepts', label: 'Core concepts' },
  { id: 'connect-repo', label: 'Guide: Connect a repository' },
  { id: 'connect-env', label: 'Guide: Connect an environment' },
  { id: 'decision', label: 'Guide: Read a release decision' },
  { id: 'policy', label: 'Guide: Policy gates' },
  { id: 'remediate', label: 'Guide: Auto-remediation' },
  { id: 'collector', label: 'Collector reference' },
  { id: 'security', label: 'Security & honesty model' },
  { id: 'faq', label: 'FAQ' },
];

function Code({ children }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { try { navigator.clipboard?.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {} };
  return (
    <div className="relative my-3">
      <pre className="rounded-xl bg-[#0f1116] text-gray-100 text-[12.5px] leading-relaxed p-4 overflow-x-auto no-scrollbar"><code>{children}</code></pre>
      <button onClick={copy} className="absolute top-2.5 right-2.5 rounded-md bg-white/10 hover:bg-white/20 p-1.5 text-gray-200">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
    </div>
  );
}
function Callout({ icon: Icon = Info, tone = 'brand', children }) {
  const tones = {
    brand: 'border-brand-100 bg-[#f7f5ff] text-brand-700',
    warn: 'border-[#f9c777] bg-[#fff7e9] text-[#8a5a00]',
    ok: 'border-[#9adcb4] bg-[#e3f7ea] text-[#0f7a3c]',
  };
  return <div className={`my-4 flex gap-2.5 rounded-xl border p-3.5 text-[13px] leading-relaxed ${tones[tone]}`}><Icon size={16} className="mt-0.5 shrink-0" /><div>{children}</div></div>;
}
function H({ id, children, icon: Icon }) {
  return <h2 id={id} className="scroll-mt-6 flex items-center gap-2 text-lg font-bold text-navy-900 mb-3 pt-2">{Icon && <Icon size={18} className="text-brand-600" />}{children}</h2>;
}
const P = ({ children }) => <p className="text-[14px] text-gray-700 leading-[1.7] mb-3">{children}</p>;

export function DocsPage() {
  const scrollTo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div>
      <PageHeader
        title="Documentation"
        description="Everything you need to understand and operate LytHouse — the concepts, the pipeline, and step-by-step guides for every feature."
        breadcrumb={<span className="text-xs text-gray-400">Getting Started · Documentation</span>}
      />

      <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
        {/* Table of contents */}
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-3">On this page</div>
            <nav className="space-y-0.5">
              {SECTIONS.map((s) => (
                <button key={s.id} onClick={() => scrollTo(s.id)} className="block w-full text-left rounded-lg px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-100 hover:text-navy-900 transition">{s.label}</button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 max-w-3xl">

          {/* Overview */}
          <section className="mb-10">
            <H id="overview" icon={BookOpen}>Overview</H>
            <P>LytHouse answers one question that most teams answer with a gut feeling: <b>is this release safe to ship?</b> It replaces the guesswork with evidence — by reading your code, validating the live environment you deploy to, and enforcing the rules your team and your auditors require, before anything reaches production.</P>
            <P>To do that, LytHouse works from two inputs you connect once:</P>
            <P><b>Your code</b> — a GitHub repository. LytHouse reads it, understands the application, and scans it for security and reliability problems.</P>
            <P><b>Your environment</b> — the cloud or on-prem infrastructure you deploy to (AWS, Google Cloud, Azure, or your own servers). LytHouse pulls the live components — IAM policies, security groups, workloads, images, servers — and validates them against the same checks.</P>
            <Callout tone="brand" icon={Rocket}>New to LytHouse? The fastest path is to connect a repository (<Link to="/projects" className="underline font-medium">Projects</Link>) and connect an environment (<Link to="/environment" className="underline font-medium">Environment</Link>). Everything else builds on those two connections.</Callout>
          </section>

          {/* How it works */}
          <section className="mb-10">
            <H id="how" icon={Gauge}>How it works — the pipeline</H>
            <P>Every release moves through six stages. You can think of LytHouse as an assembly line where each stage adds a layer of confidence:</P>
            <P><b>1. Discover.</b> When you connect a repository, Discovery reads the codebase and builds an understanding of the application — its languages, structure, dependencies, and infrastructure files. Nothing is judged yet; LytHouse first learns what it's looking at.</P>
            <P><b>2. Validate.</b> Deterministic checks (not AI) scan the code and the connected environment for concrete problems: hard-coded secrets, over-permissive IAM, open ports, missing resource limits, insecure server settings, and more. Each problem becomes a <i>finding</i> with a severity.</P>
            <P><b>3. Decide.</b> LytHouse combines the findings, the required approvals, and your policy gates into a single <i>release decision</i> — a clear go, delay, or block, with the reasons spelled out. The AI explains and prioritizes; it never invents the verdict.</P>
            <P><b>4. Enforce.</b> Policy gates turn your rules ("no criticals", "two approvals") into hard blocks. A release that fails a gate cannot proceed, no matter who clicks the button.</P>
            <P><b>5. Remediate.</b> For any finding, the AI can generate a concrete fix and open a pull request — closing the loop instead of just reporting a problem.</P>
            <P><b>6. Prove.</b> Every scan, decision, approval, and gate is written to the audit log and can be exported as evidence, so you can show exactly what was checked and when.</P>
          </section>

          {/* Core concepts */}
          <section className="mb-10">
            <H id="concepts" icon={BookOpen}>Core concepts</H>
            <P>These are the terms you'll see throughout LytHouse. Understanding them makes the rest of the product obvious.</P>
            {[
              ['Discovery', 'The read-only pass that reads your repository and builds an understanding of the application before any judgement. It answers "what is this app?" so later stages have context.'],
              ['Finding', 'A single, concrete problem detected by a deterministic check — a hard-coded secret, a wildcard IAM grant, a port open to the internet. Findings are facts, not opinions: the AI explains and fixes them but never invents them.'],
              ['Severity', 'How dangerous a finding is: critical, high, medium, or low. Critical and high are the ones that typically block a release.'],
              ['Component', 'One piece of your infrastructure that LytHouse validates — an IAM policy, a security group, a Kubernetes workload, a container image, a server config, an API spec.'],
              ['Posture', 'A 0–100 score for a component or the whole environment, computed from the severity and count of its open findings. 100 means clean; lower means more or worse findings.'],
              ['Release Decision', 'LytHouse’s go / delay / block recommendation for a release, computed from validations, approvals, and policy gates. It is deterministic — the same inputs always produce the same verdict.'],
              ['Policy Gate', 'A rule that must pass before a release proceeds — e.g. "zero critical findings", "two approvals", or "environment posture above 80". Gates turn intentions into enforced blocks.'],
              ['Collector', 'A small read-only agent you run where your cloud credentials already live. It pulls your live inventory and pushes only the results to LytHouse — your credentials never leave your side.'],
              ['Auto-Remediation', 'The AI-generated fix for a finding, delivered as a concrete change (and, where possible, a pull request) rather than just advice.'],
              ['Audit Log', 'The immutable, timestamped record of every action — scans, decisions, approvals, gates — used as evidence that the checks actually happened.'],
            ].map(([term, def]) => (
              <div key={term} className="rounded-xl border border-gray-200 bg-white p-4 mb-2.5">
                <div className="font-semibold text-navy-900 text-[14px]">{term}</div>
                <div className="text-[13px] text-gray-600 leading-[1.6] mt-1">{def}</div>
              </div>
            ))}
          </section>

          {/* Guide: connect repo */}
          <section className="mb-10">
            <H id="connect-repo" icon={GitBranch}>Guide: Connect a repository</H>
            <P>A repository is LytHouse's view of your code. Connecting one lets Discovery understand the app and lets Validation scan it for problems.</P>
            <P><b>Step 1.</b> Go to <Link to="/projects" className="text-brand-600 underline font-medium">Projects</Link> and choose <i>Import from GitHub</i>. Authorize LytHouse to read the repository (read-only access is enough for scanning).</P>
            <P><b>Step 2.</b> Pick the repository and branch you release from — usually <code className="rounded bg-gray-100 px-1 py-0.5 text-[12px]">main</code>.</P>
            <P><b>Step 3.</b> LytHouse runs Discovery, then a first validation pass. Within a minute you'll see the app's inventory and its first findings.</P>
            <Callout tone="warn" icon={AlertTriangle}>Scanning a private repo needs the GitHub authorization above. A public repo can be scanned without a token, but connecting the account gives you continuous re-scans on every push.</Callout>
          </section>

          {/* Guide: connect env */}
          <section className="mb-10">
            <H id="connect-env" icon={Cloud}>Guide: Connect an environment</H>
            <P>An environment is where your code actually runs. Connecting one lets LytHouse validate the <i>live</i> infrastructure, not just the code that describes it.</P>
            <P><b>Step 1.</b> Go to <Link to="/environment" className="text-brand-600 underline font-medium">Environment</Link> and click <i>Connect a source</i>. Pick where your infrastructure runs — AWS, Google Cloud, Azure, or on-prem — and name the connection.</P>
            <P><b>Step 2.</b> LytHouse gives you a one-line command to run the <b>collector</b>. You run it on a machine that already has read-only access to that environment (a laptop, a CI runner, a bastion). The collector reads your inventory and pushes only the results back.</P>
            <P><b>Step 3.</b> Return to the connection and click <i>Check for sync</i>. Your live components appear as cards, each validated and scored, exactly like a scanned file.</P>
            <Callout tone="brand" icon={Lock}>Your cloud credentials never reach LytHouse. The collector runs where those credentials already live and transmits only the resulting inventory. See the <button onClick={() => scrollTo('collector')} className="underline font-medium">Collector reference</button> below for the exact commands.</Callout>
          </section>

          {/* Guide: decision */}
          <section className="mb-10">
            <H id="decision" icon={Gauge}>Guide: Read a release decision</H>
            <P>Open any project and go to its <b>AI Release Review</b>. The decision card at the top is the heart of LytHouse.</P>
            <P>It shows a single verdict — <b>proceed</b>, <b>delay</b>, or <b>block</b> — with the reasons underneath: how many blockers remain, which approvals are outstanding, and which policy gates pass or fail. Because the verdict is computed from those inputs, it never contradicts them: if there's an unresolved critical finding and a gate that forbids criticals, the decision is <i>block</i>, and it says exactly why.</P>
            <P>Expand the full analysis to see the findings, the validated controls, and the projected impact. The Dashboard also surfaces the current decision at a glance, but the project's AI Release Review is where the complete reasoning lives.</P>
          </section>

          {/* Guide: policy */}
          <section className="mb-10">
            <H id="policy" icon={ShieldCheck}>Guide: Policy gates</H>
            <P>Policy gates are how you encode "we don't ship if…". Go to <Link to="/policies" className="text-brand-600 underline font-medium">Policy Studio</Link> to create them.</P>
            <P>A gate is a condition evaluated against a release — for example:</P>
            <P>• <b>Zero critical findings</b> — block if any critical is unresolved.<br />• <b>Required approvals</b> — block until N named approvers sign off.<br />• <b>Minimum environment posture</b> — block if the connected environment scores below a threshold.</P>
            <P>When a gate fails, the release decision becomes <i>block</i> and the gate is named as the reason. Gates apply to everyone — they can't be clicked past — which is what makes them useful for compliance.</P>
          </section>

          {/* Guide: remediate */}
          <section className="mb-10">
            <H id="remediate" icon={Wand2}>Guide: Auto-remediation</H>
            <P>Finding a problem is only half the job. In a project's AI Release Review, open a finding and choose <i>Generate fix</i>.</P>
            <P>The AI reads the actual configuration behind the finding and produces a concrete change — the corrected IAM policy, the tightened security-group rule, the added resource limits — not vague advice. Where a repository is connected, it can open that change as a pull request for your team to review and merge.</P>
            <Callout tone="ok" icon={CheckCircle2}>The fix is grounded in your real config, and you always review it before it lands. LytHouse proposes; you approve.</Callout>
          </section>

          {/* Collector reference */}
          <section className="mb-10">
            <H id="collector" icon={Terminal}>Collector reference</H>
            <P>The collector is a read-only agent that connects a live environment to LytHouse. You run it where your credentials already live; it performs only read-only calls through the CLIs you already trust and pushes the resulting inventory.</P>
            <P>Grab the exact command (with your connection token) from <b>Environment → your connection</b>. It looks like this:</P>
            <Code>{`npx @lythouse/collector \\
  --provider aws \\
  --token <your-connection-token> \\
  --endpoint <your-lythouse-ingest-url>`}</Code>
            <Callout tone="warn" icon={AlertTriangle}>The published <code>@lythouse/collector</code> package isn't on npm yet. Until it is, run the collector from the repo instead:
              <Code>{`node agent/lythouse-collector.mjs \\
  --provider gcp --token <token> --endpoint <url>`}</Code>
            </Callout>
            <P>What each provider reads (read-only), using the CLI you already have authenticated:</P>
            <div className="overflow-x-auto no-scrollbar my-3">
              <table className="w-full text-[13px] border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50 text-gray-500 text-left">
                  <tr><th className="p-2.5 font-semibold">Provider</th><th className="p-2.5 font-semibold">CLI</th><th className="p-2.5 font-semibold">Pulls</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="p-2.5 font-medium">AWS</td><td className="p-2.5"><code>aws</code></td><td className="p-2.5 text-gray-600">IAM policies, security groups</td></tr>
                  <tr><td className="p-2.5 font-medium">Google Cloud</td><td className="p-2.5"><code>gcloud</code></td><td className="p-2.5 text-gray-600">IAM bindings, firewall rules</td></tr>
                  <tr><td className="p-2.5 font-medium">Azure</td><td className="p-2.5"><code>az</code></td><td className="p-2.5 text-gray-600">RBAC assignments, network security groups</td></tr>
                  <tr><td className="p-2.5 font-medium">On-prem</td><td className="p-2.5"><code>kubectl</code> / files</td><td className="p-2.5 text-gray-600">Server configs, self-hosted Kubernetes</td></tr>
                </tbody>
              </table>
            </div>
            <P>Run it on a schedule (a cron job or CI step) to keep LytHouse's view of your environment continuously current — each run replaces the previous inventory for that connection.</P>
          </section>

          {/* Security & honesty */}
          <section className="mb-10">
            <H id="security" icon={Lock}>Security & honesty model</H>
            <P><b>Credentials never leave your side.</b> LytHouse does not store your cloud keys. The collector runs where your credentials already are and sends only the inventory it reads.</P>
            <P><b>Deterministic detection, AI reasoning.</b> The actual checks that find problems are fixed rules, not a language model — so "is this port open?" is a reliable yes/no. The AI sits on top: it explains findings, prioritizes them against your release, and writes fixes. It never detects, invents, or overrides a finding or a decision.</P>
            <P><b>Nothing fabricated.</b> If a number can't be computed from real data, LytHouse doesn't show it. Confidence, posture, and decisions are all derived from actual findings and rules — never guessed.</P>
          </section>

          {/* FAQ */}
          <section className="mb-6">
            <H id="faq" icon={Info}>FAQ</H>
            {[
              ['Does LytHouse need write access to my repo?', 'No — scanning only needs read access. Write access is only used if you ask it to open a remediation pull request, and even then you review and merge it yourself.'],
              ['Do I have to give LytHouse my cloud password?', 'No. The collector runs on your side using credentials you already have, and only the resulting inventory is sent. See the Collector reference above.'],
              ['Is the release decision made by the AI?', 'No. The decision is computed deterministically from findings, approvals, and policy gates. The AI only explains and prioritizes it.'],
              ['Can I stop a release even if the checks pass?', 'Yes — approvals and policy gates are enforced regardless of the automated checks, so a required approver or a failing gate always blocks a release.'],
              ['What happens if I connect a repo but no environment?', 'You still get code scanning and release decisions based on the code. Connecting an environment adds live-infrastructure validation on top.'],
            ].map(([q, a]) => (
              <div key={q} className="rounded-xl border border-gray-200 bg-white p-4 mb-2.5">
                <div className="font-semibold text-navy-900 text-[14px]">{q}</div>
                <div className="text-[13px] text-gray-600 leading-[1.6] mt-1">{a}</div>
              </div>
            ))}
          </section>

          <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-4">This documentation describes LytHouse as it works today. Features marked as roadmap elsewhere in the app (e.g. the published collector package, hosted cloud connectors) are noted where relevant.</p>
        </div>
      </div>
    </div>
  );
}
export default DocsPage;
