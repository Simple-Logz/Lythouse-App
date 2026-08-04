// @ts-nocheck
// LytHouse Documentation — a real, teaching docs site: a fixed top bar, a
// grouped left navigation with scroll-spy + filter, a focused content column,
// and a right-hand "On this page" table of contents with a Copy-for-LLM action.
// Content is honest to how LytHouse actually works.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, GitBranch, Cloud, Gauge, ShieldCheck, Wand as Wand2,
  Terminal, ArrowRight, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle,
  Lock, Rocket, Copy, Check, Info, Search, CircleHelp as HelpCircle, Menu, X, Sun, Moon,
} from 'lucide-react';
import { Link, useRouter } from '../lib/router';
import { useAuth } from '../lib/auth';

// ── Navigation model (also drives scroll-spy and the right-hand TOC) ──
const NAV = [
  {
    group: 'Getting started',
    items: [
      { id: 'overview', label: 'Overview', icon: BookOpen },
      { id: 'how', label: 'How it works', icon: Gauge },
      { id: 'concepts', label: 'Core concepts', icon: BookOpen },
    ],
  },
  {
    group: 'Guides',
    items: [
      { id: 'connect-repo', label: 'Connect a repository', icon: GitBranch },
      { id: 'connect-env', label: 'Connect an environment', icon: Cloud },
      { id: 'decision', label: 'Read a release decision', icon: Gauge },
      { id: 'policy', label: 'Policy gates', icon: ShieldCheck },
      { id: 'remediate', label: 'Auto-remediation', icon: Wand2 },
    ],
  },
  {
    group: 'Reference',
    items: [
      { id: 'collector', label: 'Collector reference', icon: Terminal },
      { id: 'security', label: 'Security & honesty', icon: Lock },
      { id: 'faq', label: 'FAQ', icon: HelpCircle },
    ],
  },
];
const FLAT = NAV.flatMap((g) => g.items);

// ── Small content primitives ──
function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { try { navigator.clipboard?.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {} };
  return (
    <div className="relative my-4">
      <pre className="rounded-xl bg-[#0f1116] text-gray-100 text-[12.5px] leading-relaxed p-4 overflow-x-auto no-scrollbar"><code>{children}</code></pre>
      <button onClick={copy} className="absolute top-2.5 right-2.5 rounded-md bg-white/10 hover:bg-white/20 p-1.5 text-gray-200">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
    </div>
  );
}
function Callout({ icon: Icon = Info, tone = 'brand', children }) {
  const tones = {
    brand: 'border-brand-200 bg-brand-50 text-brand-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    ok: 'border-green-200 bg-green-50 text-green-700',
  };
  return <div className={`my-4 flex gap-2.5 rounded-xl border p-3.5 text-[13px] leading-relaxed ${tones[tone]}`}><Icon size={16} className="mt-0.5 shrink-0" /><div>{children}</div></div>;
}
function H({ children, icon: Icon }) {
  return <h2 className="flex items-center gap-2 text-[22px] font-bold tracking-tight text-navy-900 mb-3">{Icon && <Icon size={19} className="text-brand-600" />}{children}</h2>;
}
const P = ({ children }) => <p className="text-[14.5px] text-gray-700 leading-[1.75] mb-3.5">{children}</p>;

// ── The pipeline diagram (our own — the six stages, as a flow) ──
function PipelineDiagram() {
  const node = (x, y, w, label, hi) => (
    <g>
      <rect x={x} y={y} width={w} height="42" rx="10"
        fill={hi ? '#7c5ce6' : '#f5f3ff'} stroke={hi ? '#7c5ce6' : '#c4b5fd'} strokeWidth="1.5" />
      <text x={x + w / 2} y={y + 26} textAnchor="middle" fontSize="13" fontWeight="600" fill={hi ? '#ffffff' : '#26222e'} fontFamily="Inter, sans-serif">{label}</text>
    </g>
  );
  return (
    <div className="my-5 rounded-2xl border border-[#71717a] bg-gradient-to-b from-[#faf9ff] to-white p-4">
      <svg viewBox="0 0 760 384" width="100%" className="mx-auto max-w-[680px]">
        <defs>
          <marker id="ah" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0 0l6 3-6 3z" fill="#a79fc0" /></marker>
        </defs>
        {/* connectors */}
        <g fill="none" stroke="#c3bcd6" strokeWidth="1.6" markerEnd="url(#ah)">
          <path d="M380 60 C300 74, 190 78, 152 90" />
          <path d="M380 60 C460 74, 570 78, 608 90" />
          <path d="M150 134 C240 150, 320 156, 372 166" />
          <path d="M610 134 C520 150, 440 156, 388 166" />
          <path d="M380 208 L380 236" />
          <path d="M380 282 C380 296, 380 300, 380 312" />
          <path d="M150 282 C240 300, 300 306, 356 316" />
          <path d="M610 282 C520 300, 460 306, 404 316" />
        </g>
        {node(305, 18, 150, 'Release candidate')}
        {node(75, 92, 150, 'Your code (repo)')}
        {node(535, 92, 150, 'Your environment')}
        {node(305, 166, 150, 'Validation')}
        {node(305, 240, 150, 'Findings + posture')}
        {node(75, 240, 150, 'Approvals')}
        {node(535, 240, 150, 'Policy gates')}
        {node(285, 316, 190, 'Release decision', true)}
      </svg>
      <p className="text-center text-[12px] text-gray-400 mt-1">Code and environment feed validation; findings, approvals and gates converge into one decision.</p>
    </div>
  );
}

export function DocsPage() {
  const { navigate } = useRouter();
  const { session } = useAuth();
  // Follow the app theme (lh.theme) instead of being locked to dark, with a toggle.
  const [dark, setDark] = useState(() => (localStorage.getItem('lh.theme') || 'light') === 'dark');
  const toggleTheme = () => {
    const next = !dark; setDark(next);
    const t = next ? 'dark' : 'light'; const r = document.documentElement;
    r.classList.toggle('dark', next); r.setAttribute('data-theme', t); r.style.colorScheme = t;
    try { localStorage.setItem('lh.theme', t); } catch {}
  };
  const contentRef = useRef(null);
  const [active, setActive] = useState('overview');
  const [q, setQ] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setNavOpen(false);
  };

  // Scroll-spy: highlight the section nearest the top of the viewport.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-72px 0px -70% 0px', threshold: 0 },
    );
    FLAT.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const copyForLLM = () => {
    const text = contentRef.current?.innerText || '';
    try { navigator.clipboard?.writeText(`# LytHouse Documentation\n\n${text}`); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };

  const filtered = useMemo(() => {
    if (!q.trim()) return NAV;
    const t = q.toLowerCase();
    return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(t)) })).filter((g) => g.items.length);
  }, [q]);

  const NavTree = (
    <nav className="px-3 py-4">
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter docs…"
          className="w-full rounded-lg border border-[#71717a] bg-gray-50 py-2 pl-8 pr-3 text-[13px] text-navy-900 placeholder:text-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
      </div>
      {filtered.map((g) => (
        <div key={g.group} className="mb-4">
          <div className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">{g.group}</div>
          {g.items.map((it) => {
            const Ic = it.icon;
            const on = active === it.id;
            return (
              <button key={it.id} onClick={() => scrollTo(it.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13.5px] text-left transition-colors ${on ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-600 hover:bg-gray-100 hover:text-navy-900'}`}>
                <Ic size={15} className={on ? 'text-brand-600' : 'text-gray-400'} />{it.label}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className={dark ? 'dark min-h-screen text-[#eeecf6]' : 'min-h-screen bg-white text-navy-900'} style={dark ? { background: 'linear-gradient(180deg,#211c30 0%,#171324 55%)' } : undefined}>
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-[#71717a] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1400px] items-center gap-3 px-4">
          <button onClick={() => setNavOpen((v) => !v)} className="lg:hidden rounded-lg border border-[#71717a] p-2 text-gray-600"><Menu size={16} /></button>
          <Link to="/" className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600"><ShieldCheck size={16} className="text-white" strokeWidth={2.4} /></span><span className="text-[16px] font-bold tracking-tight">Lyt<span className="text-brand-600">House</span></span></Link>
          <span className="ml-1.5 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Docs</span>
          <div className="flex-1" />
          <button onClick={toggleTheme} title="Toggle light / dark" className="grid h-9 w-9 place-items-center rounded-lg border border-[#71717a] text-navy-600 hover:bg-gray-50">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          {session ? (
            <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(120deg,#8b6ef2,#7c5ce6)' }}>Back to app<ArrowRight size={14} /></button>
          ) : (
            <>
              <button onClick={() => navigate('/signin')} className="hidden sm:inline text-sm font-semibold text-navy-700 hover:text-brand-700">Sign in</button>
              <button onClick={() => navigate('/signup')} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(120deg,#8b6ef2,#7c5ce6)' }}>Start free<ArrowRight size={14} /></button>
            </>
          )}
        </div>
      </header>

      {/* Mobile nav drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#71717a] px-4 py-3"><span className="font-bold">Documentation</span><button onClick={() => setNavOpen(false)}><X size={18} /></button></div>
            {NavTree}
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-[256px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)_248px]">
        {/* Left nav */}
        <aside className="hidden lg:block border-r border-[#71717a]">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">{NavTree}</div>
        </aside>

        {/* Content */}
        <main className="min-w-0 px-6 pb-24 pt-20 sm:px-10">
          <div ref={contentRef} className="mx-auto max-w-3xl">
            <div className="mb-8">
              <div className="text-xs font-semibold text-brand-600">Getting started</div>
              <h1 className="mt-1 text-4xl font-bold tracking-tight">LytHouse Documentation</h1>
              <p className="mt-3 text-[15px] text-gray-500 leading-relaxed">Everything you need to understand and operate LytHouse — the concepts, the pipeline, and step-by-step guides for every feature.</p>
            </div>

            <section id="overview" className="scroll-mt-24 mb-12">
              <H icon={BookOpen}>Overview</H>
              <P>LytHouse answers one question that most teams answer with a gut feeling: <b>is this release safe to ship?</b> It replaces the guesswork with evidence — by reading your code, validating the live environment you deploy to, and enforcing the rules your team and your auditors require, before anything reaches production.</P>
              <P>To do that, LytHouse works from two inputs you connect once. <b>Your code</b> — a GitHub repository that LytHouse reads, understands, and scans for security and reliability problems. And <b>your environment</b> — the cloud or on-prem infrastructure you deploy to (AWS, Google Cloud, Azure, or your own servers), from which LytHouse pulls the live components and validates them against the same checks.</P>
              <Callout tone="brand" icon={Rocket}>New to LytHouse? The fastest path is to connect a repository (<Link to="/projects" className="underline font-medium">Projects</Link>) and connect an environment (<Link to="/environment" className="underline font-medium">Environment</Link>). Everything else builds on those two connections.</Callout>
            </section>

            <section id="how" className="scroll-mt-24 mb-12">
              <H icon={Gauge}>How it works — the pipeline</H>
              <P>Every release moves through six stages. You can think of LytHouse as an assembly line where each stage adds a layer of confidence — and where two inputs (your code and your environment) converge on a single, defensible decision.</P>
              <PipelineDiagram />
              <P><b>1. Discover.</b> When you connect a repository, Discovery reads the codebase and builds an understanding of the application — its languages, structure, dependencies, and infrastructure files. Nothing is judged yet; LytHouse first learns what it's looking at.</P>
              <P><b>2. Validate.</b> Deterministic checks (not AI) scan the code and the connected environment for concrete problems: hard-coded secrets, over-permissive IAM, open ports, missing resource limits, insecure server settings, and more. Each problem becomes a <i>finding</i> with a severity.</P>
              <P><b>3. Decide.</b> LytHouse combines the findings, the required approvals, and your policy gates into a single <i>release decision</i> — a clear go, delay, or block, with the reasons spelled out. The AI explains and prioritizes; it never invents the verdict.</P>
              <P><b>4. Enforce.</b> Policy gates turn your rules ("no criticals", "two approvals") into hard blocks. A release that fails a gate cannot proceed, no matter who clicks the button.</P>
              <P><b>5. Remediate.</b> For any finding, the AI can generate a concrete fix and open a pull request — closing the loop instead of just reporting a problem.</P>
              <P><b>6. Prove.</b> Every scan, decision, approval, and gate is written to the audit log and can be exported as evidence, so you can show exactly what was checked and when.</P>
            </section>

            <section id="concepts" className="scroll-mt-24 mb-12">
              <H icon={BookOpen}>Core concepts</H>
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
                <div key={term} className="rounded-xl border border-[#71717a] bg-white p-4 mb-2.5">
                  <div className="font-semibold text-navy-900 text-[14px]">{term}</div>
                  <div className="text-[13px] text-gray-600 leading-[1.6] mt-1">{def}</div>
                </div>
              ))}
            </section>

            <section id="connect-repo" className="scroll-mt-24 mb-12">
              <H icon={GitBranch}>Guide: Connect a repository</H>
              <P>A repository is LytHouse's view of your code. Connecting one lets Discovery understand the app and lets Validation scan it for problems.</P>
              <P><b>Step 1.</b> Go to <Link to="/projects" className="text-brand-600 underline font-medium">Projects</Link> and choose <i>Import from GitHub</i>. Authorize LytHouse to read the repository (read-only access is enough for scanning).</P>
              <P><b>Step 2.</b> Pick the repository and branch you release from — usually <code className="rounded bg-gray-100 px-1 py-0.5 text-[12px]">main</code>.</P>
              <P><b>Step 3.</b> LytHouse runs Discovery, then a first validation pass. Within a minute you'll see the app's inventory and its first findings.</P>
              <Callout tone="warn" icon={AlertTriangle}>Scanning a private repo needs the GitHub authorization above. A public repo can be scanned without a token, but connecting the account gives you continuous re-scans on every push.</Callout>
            </section>

            <section id="connect-env" className="scroll-mt-24 mb-12">
              <H icon={Cloud}>Guide: Connect an environment</H>
              <P>An environment is where your code actually runs. Connecting one lets LytHouse validate the <i>live</i> infrastructure, not just the code that describes it.</P>
              <P><b>Step 1.</b> Go to <Link to="/environment" className="text-brand-600 underline font-medium">Environment</Link> and click <i>Connect a source</i>. Pick where your infrastructure runs — AWS, Google Cloud, Azure, or on-prem — and name the connection.</P>
              <P><b>Step 2.</b> LytHouse gives you a one-line command to run the <b>collector</b>. You run it on a machine that already has read-only access to that environment (a laptop, a CI runner, a bastion). The collector reads your inventory and pushes only the results back.</P>
              <P><b>Step 3.</b> Return to the connection and click <i>Check for sync</i>. Your live components appear as cards, each validated and scored, exactly like a scanned file.</P>
              <Callout tone="brand" icon={Lock}>Your cloud credentials never reach LytHouse. The collector runs where those credentials already live and transmits only the resulting inventory. See the <button onClick={() => scrollTo('collector')} className="underline font-medium">Collector reference</button> below for the exact commands.</Callout>
            </section>

            <section id="decision" className="scroll-mt-24 mb-12">
              <H icon={Gauge}>Guide: Read a release decision</H>
              <P>Open any project and go to its <b>AI Release Review</b>. The decision card at the top is the heart of LytHouse.</P>
              <P>It shows a single verdict — <b>proceed</b>, <b>delay</b>, or <b>block</b> — with the reasons underneath: how many blockers remain, which approvals are outstanding, and which policy gates pass or fail. Because the verdict is computed from those inputs, it never contradicts them: if there's an unresolved critical finding and a gate that forbids criticals, the decision is <i>block</i>, and it says exactly why.</P>
              <P>Expand the full analysis to see the findings, the validated controls, and the projected impact. The Dashboard also surfaces the current decision at a glance, but the project's AI Release Review is where the complete reasoning lives.</P>
            </section>

            <section id="policy" className="scroll-mt-24 mb-12">
              <H icon={ShieldCheck}>Guide: Policy gates</H>
              <P>Policy gates are how you encode "we don't ship if…". Go to <Link to="/policies" className="text-brand-600 underline font-medium">Policy Studio</Link> to create them. A gate is a condition evaluated against a release — for example:</P>
              <P>• <b>Zero critical findings</b> — block if any critical is unresolved.<br />• <b>Required approvals</b> — block until N named approvers sign off.<br />• <b>Minimum environment posture</b> — block if the connected environment scores below a threshold.</P>
              <P>When a gate fails, the release decision becomes <i>block</i> and the gate is named as the reason. Gates apply to everyone — they can't be clicked past — which is what makes them useful for compliance.</P>
            </section>

            <section id="remediate" className="scroll-mt-24 mb-12">
              <H icon={Wand2}>Guide: Auto-remediation</H>
              <P>Finding a problem is only half the job. In a project's AI Release Review, open a finding and choose <i>Generate fix</i>.</P>
              <P>The AI reads the actual configuration behind the finding and produces a concrete change — the corrected IAM policy, the tightened security-group rule, the added resource limits — not vague advice. Where a repository is connected, it can open that change as a pull request for your team to review and merge.</P>
              <Callout tone="ok" icon={CheckCircle2}>The fix is grounded in your real config, and you always review it before it lands. LytHouse proposes; you approve.</Callout>
            </section>

            <section id="collector" className="scroll-mt-24 mb-12">
              <H icon={Terminal}>Collector reference</H>
              <P>The collector is a read-only agent that connects a live environment to LytHouse. You run it where your credentials already live; it performs only read-only calls through the CLIs you already trust and pushes the resulting inventory.</P>
              <P>Grab the exact command (with your connection token) from <b>Environment → your connection</b>. It looks like this:</P>
              <CodeBlock>{`npx @lythouse/collector \\
  --provider aws \\
  --token <your-connection-token> \\
  --endpoint <your-lythouse-ingest-url>`}</CodeBlock>
              <Callout tone="warn" icon={AlertTriangle}>The published <code>@lythouse/collector</code> package isn't on npm yet. Until it is, run the collector from the repo instead:
                <CodeBlock>{`node agent/lythouse-collector.mjs \\
  --provider gcp --token <token> --endpoint <url>`}</CodeBlock>
              </Callout>
              <P>What each provider reads (read-only), using the CLI you already have authenticated:</P>
              <div className="overflow-x-auto no-scrollbar my-3">
                <table className="w-full text-[13px] border border-[#71717a] rounded-xl overflow-hidden">
                  <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr><th className="p-2.5 font-semibold">Provider</th><th className="p-2.5 font-semibold">CLI</th><th className="p-2.5 font-semibold">Pulls</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="p-2.5 font-medium">AWS</td><td className="p-2.5"><code>aws</code></td><td className="p-2.5 text-gray-600">IAM policies, security groups</td></tr>
                    <tr><td className="p-2.5 font-medium">Google Cloud</td><td className="p-2.5"><code>gcloud</code></td><td className="p-2.5 text-gray-600">IAM bindings, firewall rules</td></tr>
                    <tr><td className="p-2.5 font-medium">Azure</td><td className="p-2.5"><code>az</code></td><td className="p-2.5 text-gray-600">RBAC assignments, network security groups</td></tr>
                    <tr><td className="p-2.5 font-medium">On-prem</td><td className="p-2.5"><code>ssh</code> / <code>kubectl</code> / files</td><td className="p-2.5 text-gray-600">Server &amp; OS configs, self-hosted Kubernetes, IaC &amp; config files</td></tr>
                  </tbody>
                </table>
              </div>
              <P>Run it on a schedule (a cron job or CI step) to keep LytHouse's view of your environment continuously current — each run replaces the previous inventory for that connection.</P>
            </section>

            <section id="security" className="scroll-mt-24 mb-12">
              <H icon={Lock}>Security & honesty model</H>
              <P><b>Credentials never leave your side.</b> LytHouse does not store your cloud keys. The collector runs where your credentials already are and sends only the inventory it reads.</P>
              <P><b>Deterministic detection, AI reasoning.</b> The actual checks that find problems are fixed rules, not a language model — so "is this port open?" is a reliable yes/no. The AI sits on top: it explains findings, prioritizes them against your release, and writes fixes. It never detects, invents, or overrides a finding or a decision.</P>
              <P><b>Nothing fabricated.</b> If a number can't be computed from real data, LytHouse doesn't show it. Confidence, posture, and decisions are all derived from actual findings and rules — never guessed.</P>
            </section>

            <section id="faq" className="scroll-mt-24 mb-8">
              <H icon={HelpCircle}>FAQ</H>
              {[
                ['Does LytHouse need write access to my repo?', 'No — scanning only needs read access. Write access is only used if you ask it to open a remediation pull request, and even then you review and merge it yourself.'],
                ['Do I have to give LytHouse my cloud password?', 'No. The collector runs on your side using credentials you already have, and only the resulting inventory is sent. See the Collector reference above.'],
                ['Is the release decision made by the AI?', 'No. The decision is computed deterministically from findings, approvals, and policy gates. The AI only explains and prioritizes it.'],
                ['Can I stop a release even if the checks pass?', 'Yes — approvals and policy gates are enforced regardless of the automated checks, so a required approver or a failing gate always blocks a release.'],
                ['What happens if I connect a repo but no environment?', 'You still get code scanning and release decisions based on the code. Connecting an environment adds live-infrastructure validation on top.'],
              ].map(([q2, a]) => (
                <div key={q2} className="rounded-xl border border-[#71717a] bg-white p-4 mb-2.5">
                  <div className="font-semibold text-navy-900 text-[14px]">{q2}</div>
                  <div className="text-[13px] text-gray-600 leading-[1.6] mt-1">{a}</div>
                </div>
              ))}
            </section>

            <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-4">This documentation describes LytHouse as it works today. Features marked as roadmap elsewhere in the app (e.g. the published collector package, hosted cloud connectors) are noted where relevant.</p>
          </div>
        </main>

        {/* Right TOC */}
        <aside className="hidden xl:block">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto px-4 py-6">
            <button onClick={copyForLLM} className="mb-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#7c5ce6] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6a48cf]">
              {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied!' : 'Copy for LLM'}
            </button>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">On this page</div>
            <nav className="space-y-0.5 border-l border-[#71717a]">
              {FLAT.map((s) => (
                <button key={s.id} onClick={() => scrollTo(s.id)}
                  className={`-ml-px block w-full border-l-2 pl-3 py-1 text-left text-[12.5px] transition-colors ${active === s.id ? 'border-brand-500 font-semibold text-brand-700' : 'border-transparent text-gray-500 hover:text-navy-900'}`}>
                  {s.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}
export default DocsPage;
