// @ts-nocheck
import { useRef, useState, useEffect } from 'react';
import { Logo } from '../lib/ui';
import { useRouter } from '../lib/router';
import {
  ShieldCheck, GitBranch, ScanLine, Users, Rocket, Activity, CheckCircle2,
  ArrowRight, Zap, Lock, TrendingUp, Sparkles, ChevronLeft, ChevronRight, ExternalLink, ChevronDown,
  BookOpen, LifeBuoy, Mail, Info, Briefcase, Accessibility,
  Boxes, Layers, Package, Key, Network, Scale, Radar, XCircle, BadgeCheck, AlertTriangle,
  Cloud, MessageSquare, FileCode, LayoutDashboard, Check, Menu, X,
} from 'lucide-react';

// ── "Works with your stack" integration tiles (generic icons, honest set) ──
const INTEGRATIONS = [
  { icon: GitBranch, t: 'GitHub' }, { icon: GitBranch, t: 'GitLab' }, { icon: GitBranch, t: 'Bitbucket' },
  { icon: Cloud, t: 'AWS' }, { icon: Cloud, t: 'Google Cloud' }, { icon: Cloud, t: 'Azure' },
  { icon: Layers, t: 'Kubernetes' }, { icon: FileCode, t: 'Terraform' }, { icon: MessageSquare, t: 'Slack' },
];

// ── FAQ (honest, matches the docs) ──
const FAQ_ITEMS = [
  { q: 'Does LytHouse need write access to my repo?', a: 'No — scanning only needs read access. Write access is only used if you ask it to open a remediation pull request, and even then you review and merge it yourself.' },
  { q: 'Do I have to give LytHouse my cloud password?', a: 'No. The collector runs on your side using credentials you already have, and only the resulting inventory is sent — your keys never leave your environment.' },
  { q: 'Is the release decision made by the AI?', a: 'No. The decision is computed deterministically from findings, approvals, and policy gates. The AI only explains and prioritizes it — it never invents the verdict.' },
  { q: 'Can I stop a release even if the checks pass?', a: 'Yes. Approvals and policy gates are enforced regardless of the automated checks, so a required approver or a failing gate always blocks a release.' },
  { q: 'What if I connect a repo but no environment?', a: 'You still get code scanning and release decisions based on the code. Connecting an environment adds live-infrastructure validation on top.' },
];

// ── "Checks built in" bento tiles (our own check categories + icons) ──
const BENTO = [
  { icon: Key, t: 'Secrets' },
  { icon: Package, t: 'Dependencies & CVEs' },
  { icon: Lock, t: 'IAM & access' },
  { icon: Boxes, t: 'Containers' },
  { brand: true },
  { icon: Layers, t: 'Kubernetes' },
  { icon: Radar, t: 'Config drift' },
  { icon: Network, t: 'Open ports' },
  { icon: Scale, t: 'Licenses' },
];

// ── Two-audience split ──
const DEV_ITEMS = [
  { t: 'Reads your repository', d: 'Discovery understands the app before it judges it.' },
  { t: 'Real static checks', d: 'Secrets, CVEs, IaC and containers — no invented numbers.' },
  { t: 'Auto-fix pull requests', d: 'Grounded fixes you review and merge.' },
  { t: 'CLI & CI gates', d: 'Block merges from the pipeline you already run.' },
];
const SEC_ITEMS = [
  { t: 'Policy-as-code gates', d: 'Encode "we don\'t ship if…" and enforce it every release.' },
  { t: 'Audit evidence', d: 'Every scan, decision and approval, timestamped and exportable.' },
  { t: 'Compliance frameworks', d: 'Map findings to the controls your auditors ask for.' },
  { t: 'Approvals & SSO', d: 'Named sign-off and SAML/SSO for who can ship.' },
];

// ── Comparison table ──
const COMP_ROWS = [
  { f: 'Pre-deploy release decision', lh: ['ok', 'Built-in'], man: ['warn', 'Gut feeling'], scan: ['x', 'Not the job'] },
  { f: 'Honest, computed metrics', lh: ['ok', 'Never fabricated'], man: ['warn', 'Subjective'], scan: ['warn', 'Noisy scores'] },
  { f: 'Live environment validation', lh: ['ok', 'Code + cloud'], man: ['x', 'Manual'], scan: ['warn', 'Code only'] },
  { f: 'Policy gates enforced', lh: ['ok', 'Hard blocks'], man: ['x', 'Honor system'], scan: ['warn', 'Warnings'] },
  { f: 'Auto-remediation PRs', lh: ['ok', 'Grounded fixes'], man: ['x', 'You write them'], scan: ['x', 'Findings only'] },
  { f: 'Audit-ready evidence', lh: ['ok', 'Exportable log'], man: ['warn', 'Spreadsheets'], scan: ['warn', 'Report dumps'] },
];

// ── Nav dropdown menus ──
const PRODUCT_MENU = [
  { icon: ScanLine, t: 'Release validation', d: 'Real checks before every deploy', to: '#product' },
  { icon: GitBranch, t: 'Repo connections', d: 'GitHub, GitLab, Bitbucket & more', to: '/signup' },
  { icon: ShieldCheck, t: 'Policy gates', d: 'Enforce readiness & approvals', to: '#features' },
  { icon: Activity, t: 'Observability', d: 'Watch releases after they ship', to: '#how' },
];
const HOW_MENU = [
  { icon: GitBranch, t: 'Discovery', d: 'Understand what changed', to: '#how' },
  { icon: ScanLine, t: 'Validation', d: 'Static checks, no fake numbers', to: '#how' },
  { icon: Zap, t: 'Remediation', d: 'Safe fixes as pull requests', to: '#how' },
  { icon: Users, t: 'Governance', d: 'Multi-team sign-off', to: '#how' },
  { icon: Rocket, t: 'Deployment', d: 'Policy-gated releases', to: '#how' },
  { icon: Activity, t: 'Observability', d: 'Keep decisions valid', to: '#how' },
];
const FEAT_MENU = [
  { icon: ShieldCheck, t: 'Honest by design', d: 'Real signals, never fabricated', to: '#features' },
  { icon: TrendingUp, t: 'Decision-first', d: 'Cleared, review or blocked', to: '#features' },
  { icon: Lock, t: 'Policy as code', d: 'Rules enforced every release', to: '#features' },
];
const RESOURCES_MENU = [
  { icon: BookOpen, t: 'Documentation', d: 'Guides, API and setup', to: '/docs' },
  { icon: LifeBuoy, t: 'How it works', d: 'The six-stage flow', to: '#how' },
  { icon: ShieldCheck, t: 'Security', d: 'How we protect your data', to: '/security' },
];
const ABOUT_MENU = [
  { icon: Mail, t: 'Contact Us', d: 'Talk to the team', to: '/demo' },
  { icon: Info, t: 'About Us', d: 'What LytHouse stands for', to: '#features' },
  { icon: Briefcase, t: 'Careers', d: "We're growing — say hi", to: '/demo' },
  { icon: Accessibility, t: 'Accessibility', d: 'Our commitment', to: '/security' },
];

function NavMenu({ label, items, onGo }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] font-medium text-white/75 hover:text-white transition-colors">
        {label}<ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2">
          <div className="w-80 rounded-2xl p-2 border"
            style={{ background: 'linear-gradient(180deg,#2a2340,#1e1930)', borderColor: 'rgba(124,92,230,.30)', boxShadow: '0 26px 60px -18px rgba(0,0,0,.55)' }}>
            {items.map((it) => {
              const Ic = it.icon;
              return (
                <button key={it.t} onClick={onGo(it.to)} className="flex w-full items-start gap-3 rounded-xl p-3 text-left ring-1 ring-transparent transition-all hover:bg-white/[0.055] hover:ring-white/[0.07] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.11)]">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-300"><Ic size={16} /></span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{it.t}</span>
                    <span className="block text-xs text-white/65">{it.d}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Our own hand-drawn-style line infographics (ink outline + lavender fills) ──
const INK = '#26222e';
const svgBase = { fill: 'none', stroke: INK, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' };

// Shared dark-glass panel backdrop for the capability infographics — soft
// violet glow, hairline border and a faint grid, matching the hero aesthetic.
function IlloFrame({ id, children }: { id: string; children: any }) {
  return (
    <svg viewBox="0 0 240 152" width="100%" height="152" fill="none" aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#372c5e" /><stop offset="55%" stopColor="#2a2148" /><stop offset="100%" stopColor="#20193a" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="24%" r="66%">
          <stop offset="0%" stopColor="rgba(160,131,250,.55)" /><stop offset="100%" stopColor="rgba(124,92,230,0)" />
        </radialGradient>
        <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ddd0ff" /><stop offset="100%" stopColor="#8b6ef2" />
        </linearGradient>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9b7ef6" /><stop offset="100%" stopColor="#6a48cf" />
        </linearGradient>
        <radialGradient id={`${id}-orb`} cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#c3b0ff" /><stop offset="48%" stopColor="#8b6ef2" /><stop offset="100%" stopColor="#5f3fc4" />
        </radialGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,.16)" /><stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id={`${id}-ds`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="4.5" floodColor="#160e2b" floodOpacity="0.55" />
        </filter>
      </defs>
      <rect width="240" height="152" rx="16" fill={`url(#${id}-bg)`} />
      <rect width="240" height="152" rx="16" fill={`url(#${id}-glow)`} />
      <rect x="1" y="1" width="238" height="66" rx="15" fill={`url(#${id}-gloss)`} />
      {[60, 120, 180].map((x) => <line key={x} x1={x} y1="8" x2={x} y2="144" stroke="rgba(210,196,255,.09)" strokeWidth="1" />)}
      {[50, 100].map((y) => <line key={y} x1="10" y1={y} x2="230" y2={y} stroke="rgba(210,196,255,.07)" strokeWidth="1" />)}
      {children}
      <rect x="0.5" y="0.5" width="239" height="151" rx="15.5" fill="none" stroke="rgba(210,196,255,.24)" />
    </svg>
  );
}
const illoCss = `
  .il-flow{stroke-dasharray:2.5 7;animation:il-dash 2.6s linear infinite}
  .il-badge{transform-box:fill-box;transform-origin:center;animation:il-pop 4.5s ease-in-out infinite}
  .il-draw{stroke-dasharray:120;stroke-dashoffset:120;animation:il-draw 2.6s ease-out .2s forwards}
  .il-sweep{animation:il-sweep 3.4s ease-in-out infinite}
  .il-pulse{transform-box:fill-box;transform-origin:center;animation:il-pulse 3s ease-in-out infinite}
  @keyframes il-dash{to{stroke-dashoffset:-19}}
  @keyframes il-pop{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
  @keyframes il-draw{to{stroke-dashoffset:0}}
  @keyframes il-sweep{0%{transform:translateX(-40px);opacity:0}30%,70%{opacity:.6}100%{transform:translateX(210px);opacity:0}}
  @keyframes il-pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.18)}}
  @media (prefers-reduced-motion: reduce){.il-flow,.il-badge,.il-draw,.il-sweep,.il-pulse{animation:none;stroke-dashoffset:0}}
`;

// Connect any Git provider — a commit graph whose feature branch merges and clears.
function IlloConnect() {
  return (
    <IlloFrame id="cn">
      <style>{illoCss}</style>
      {/* PR card */}
      <g>
        <rect x="150" y="24" width="70" height="38" rx="9" fill="rgba(255,255,255,.05)" stroke="rgba(196,181,253,.28)" />
        <circle cx="163" cy="37" r="4" fill="none" stroke="url(#cn-line)" strokeWidth="1.6" />
        <path d="M163 41 v8" stroke="url(#cn-line)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="163" cy="51" r="2.2" fill="url(#cn-line)" />
        <path d="M176 33 h32 M176 41 h22 M176 49 h28" stroke="rgba(196,181,253,.4)" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* main branch */}
      <path d="M46 34 V118" stroke="url(#cn-line)" strokeWidth="1.7" opacity=".4" strokeLinecap="round" />
      <path className="il-flow" d="M46 34 V118" stroke="url(#cn-line)" strokeWidth="1.7" strokeLinecap="round" />
      {/* feature branch out and merge back down toward the check */}
      <path d="M46 60 C82 60 92 96 122 96 H150" stroke="url(#cn-line)" strokeWidth="1.7" opacity=".4" fill="none" strokeLinecap="round" />
      <path className="il-flow" d="M46 60 C82 60 92 96 122 96 H150" stroke="url(#cn-line)" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      {/* commit nodes */}
      {[[46, 34], [46, 118], [88, 78]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="6" fill="#221a3d" stroke="url(#cn-line)" strokeWidth="1.8" />
          <circle cx={x - 1.6} cy={y - 1.8} r="1.6" fill="rgba(255,255,255,.5)" />
        </g>
      ))}
      {/* cleared check badge at the merge */}
      <g className="il-badge">
        <circle cx="168" cy="96" r="22" fill="url(#cn-glow)" />
        <circle cx="168" cy="96" r="14.5" fill="url(#cn-orb)" stroke="rgba(221,208,255,.7)" strokeWidth="1" filter="url(#cn-ds)" />
        <ellipse cx="163.5" cy="90" rx="6.5" ry="3.4" fill="rgba(255,255,255,.4)" transform="rotate(-32 163.5 90)" />
        <path d="M161 96 l4.5 4.5 9 -10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </IlloFrame>
  );
}
// Six validation stages — a pipeline that fills as it clears, with a scan sweep.
function IlloStages() {
  const xs = [30, 66, 102, 138, 174, 210];
  return (
    <IlloFrame id="st">
      <style>{illoCss}</style>
      <clipPath id="st-clip"><rect x="0" y="0" width="240" height="152" rx="16" /></clipPath>
      <g clipPath="url(#st-clip)">
        <rect className="il-sweep" x="0" y="8" width="34" height="136" fill="url(#st-glow)" />
      </g>
      {/* rail */}
      <path d={`M${xs[0]} 80 H${xs[5]}`} stroke="url(#st-line)" strokeWidth="2" opacity=".32" strokeLinecap="round" />
      <path d={`M${xs[0]} 80 H${xs[2]}`} stroke="url(#st-line)" strokeWidth="2" strokeLinecap="round" />
      <path className="il-flow" d={`M${xs[0]} 80 H${xs[5]}`} stroke="url(#st-line)" strokeWidth="2" strokeLinecap="round" />
      {xs.map((x, i) => {
        const done = i < 3;
        const current = i === 3;
        return (
          <g key={x}>
            {current && <circle className="il-pulse" cx={x} cy="80" r="15" fill="none" stroke="url(#st-line)" strokeWidth="1.4" />}
            <circle cx={x} cy="80" r="11.5" fill={done ? 'url(#st-orb)' : '#251d40'} stroke={done ? 'rgba(221,208,255,.6)' : 'url(#st-line)'} strokeWidth={done ? 1 : 1.6} opacity={done ? 1 : current ? 1 : 0.75} filter={done ? 'url(#st-ds)' : undefined} />
            {done && <ellipse cx={x - 3.6} cy="75.5" rx="5" ry="2.6" fill="rgba(255,255,255,.42)" transform={`rotate(-32 ${x - 3.6} 75.5)`} />}
            {done && <path d={`M${x - 5} 80 l3.5 3.5 6.5 -7.5`} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
            {!done && <circle cx={x} cy="80" r="3" fill="url(#st-line)" opacity={current ? 1 : 0.4} />}
          </g>
        );
      })}
      {/* stage ticks under the rail */}
      {xs.map((x, i) => <rect key={`t${i}`} x={x - 9} y="104" width="18" height="3.5" rx="1.75" fill="rgba(196,181,253,.22)" />)}
    </IlloFrame>
  );
}
// Policy-as-code gates — policy lines compiled into an enforced shield.
function IlloGates() {
  return (
    <IlloFrame id="gt">
      <style>{illoCss}</style>
      {/* policy-as-code lines on the left */}
      {[[36, 44], [36, 58], [36, 72], [36, 86], [36, 100]].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="8" height="3.4" rx="1.7" fill="url(#gt-line)" opacity=".8" />
          <rect x={x + 12} y={y} width={[38, 26, 44, 20, 32][i]} height="3.4" rx="1.7" fill="rgba(196,181,253,.28)" />
        </g>
      ))}
      {/* connectors into the shield */}
      <path className="il-flow" d="M96 72 H128" stroke="url(#gt-line)" strokeWidth="1.6" strokeLinecap="round" />
      {/* shield */}
      <circle cx="176" cy="56" r="30" fill="url(#gt-glow)" opacity=".7" />
      <g className="il-badge">
        <path d="M176 30 l34 12 v22 c0 28 -20 41 -34 48 c-14 -7 -34 -20 -34 -48 V42 Z" fill="url(#gt-orb)" fillOpacity=".28" stroke="url(#gt-line)" strokeWidth="1.8" strokeLinejoin="round" filter="url(#gt-ds)" />
        <path d="M176 30 l34 12 v22 c0 3 -.3 5.6 -.8 8 C202 58 190 50 176 50 c-14 0 -26 8 -33.2 20 C142.3 67.6 142 65 142 62 V42 Z" fill="rgba(255,255,255,.10)" />
        <path className="il-draw" d="M160 74 l11 11 21 -24" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </IlloFrame>
  );
}
function IlloDashboard() {
  return (
    <svg viewBox="0 0 260 180" width="100%" height="170" {...svgBase} aria-hidden>
      <rect x="18" y="20" width="224" height="140" rx="12" fill="#fff" />
      <circle cx="34" cy="34" r="3" /><circle cx="46" cy="34" r="3" /><circle cx="58" cy="34" r="3" />
      <circle cx="66" cy="86" r="24" fill="#ece8ff" />
      <path d="M56 86l7 7 12-14" stroke="#7c5ce6" strokeWidth="3" />
      <path d="M110 66h96M110 86h72M110 106h84" />
      <path d="M110 132c18-22 34 4 52-16s30-6 44-14" stroke="#7c5ce6" />
      <circle cx="206" cy="60" r="20" fill="none" />
      <path d="M206 60V40a20 20 0 0 1 17 30z" fill="#7c5ce6" stroke="#7c5ce6" />
    </svg>
  );
}

const CAPS = [
  { illo: IlloConnect, t: 'Connect any Git provider', d: 'GitHub, GitLab, Bitbucket or self-hosted — any branch, any folder, in seconds.', to: '/signup' },
  { illo: IlloStages, t: 'Six validation stages', d: 'Discovery to observability — real static checks, never fabricated telemetry.', to: '#how' },
  { illo: IlloGates, t: 'Policy-as-code gates', d: 'Encode your minimum readiness and required approvals; we enforce them every release.', to: '#features' },
];

const SLIDES = [
  { tag: 'Product tour', illo: IlloDashboard, t: 'See a real release decision', d: 'Open a release and get the call — cleared, review, or blocked — with the evidence behind it, in plain language.', cta: 'Start free', to: '/signup' },
  { tag: 'How it works', illo: IlloGates, t: 'Policy gates, enforced automatically', d: 'Encode your minimum readiness and required approvals once. LytHouse blocks anything that falls short — no manual policing.', cta: 'How it works', to: '#how' },
];

// Cursor-driven 3D tilt: the card swivels a little toward the pointer and
// eases back to its resting angle when the cursor leaves.
function Tilt({ children, className = '', style = {}, baseRx = 0, baseRy = 0, max = 9 }) {
  const ref = useRef(null);
  const rest = `perspective(1400px) rotateX(${baseRx}deg) rotateY(${baseRy}deg)`;
  const [t, setT] = useState(rest);
  const onMove = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setT(`perspective(1400px) rotateX(${(baseRx - py * max * 2).toFixed(2)}deg) rotateY(${(baseRy + px * max * 2).toFixed(2)}deg)`);
  };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={() => setT(rest)}
      className={className}
      style={{ ...style, transform: t, transformStyle: 'preserve-3d', transition: 'transform .18s ease-out', willChange: 'transform' }}>
      {children}
    </div>
  );
}

// Real tool marks (simple-icons paths, 24×24) shown as chips feeding the check.
const BRAND = {
  github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .321.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  gitlab: 'm23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2055-6.748a.8574.8574 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0539.8585.8585 0 0 0-.3362.405L.4332 9.5065l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.0026.0021 4.9819 3.7307 2.4644 1.8654 1.5007 1.1341a1.0085 1.0085 0 0 0 1.2197 0l1.5007-1.1341 2.4644-1.8654 5.0034-3.7566.0053-.0035a6.0602 6.0602 0 0 0 2.0076-7.003z',
  azure: 'M5.483 21.3H24L14.025 4.013l-3.038 8.347 5.836 6.938L5.483 21.3zM13.23 2.7L6.105 8.677 0 19.253h5.505L13.23 2.7z',
};

// Isometric hero art: a "cleared" checkmark medallion floating above three
// glowing validation layers, with your tools (GitHub, GitLab, AWS, Azure)
// orbiting the check and feeding evidence into it along flowing connectors.
function HeroArt() {
  const plane = (cy: number, i: number) => (
    <g key={i} className="ha-layer" style={{ animationDelay: `${i * 0.5}s` }}>
      <path d={`M125 ${cy} L300 ${cy + 88} L300 ${cy + 108} L125 ${cy + 20} Z`} fill="rgba(124,92,230,.16)" stroke="rgba(196,181,253,.2)" />
      <path d={`M475 ${cy} L300 ${cy + 88} L300 ${cy + 108} L475 ${cy + 20} Z`} fill="rgba(74,40,140,.18)" stroke="rgba(196,181,253,.16)" />
      <path d={`M300 ${cy - 88} L475 ${cy} L300 ${cy + 88} L125 ${cy} Z`} fill="url(#hplane)" stroke="rgba(196,181,253,.5)" strokeWidth="1.2" />
    </g>
  );
  // A floating tool chip: frosted glass disc + logo, with a flowing connector
  // running back up to the check medallion at (300,120).
  const chip = (cx: number, cy: number, glyph: any, i: number) => (
    <g key={`c${i}`}>
      <line className="ha-flow" x1={cx} y1={cy} x2="300" y2="120" stroke="rgba(196,181,253,.32)" strokeWidth="1.4" strokeLinecap="round" />
      <g className="ha-chip" style={{ animationDelay: `${i * 0.9}s` }}>
        <circle cx={cx} cy={cy} r="27" fill="url(#hchip)" stroke="rgba(196,181,253,.4)" strokeWidth="1.1" />
        <circle cx={cx} cy={cy} r="27" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="2.4" />
        {glyph(cx, cy)}
      </g>
    </g>
  );
  const g = (path: string, fill: string, s = 1.08) => (cx: number, cy: number) => (
    <g transform={`translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})`}><path d={path} fill={fill} /></g>
  );
  const awsGlyph = (cx: number, cy: number) => (
    <g>
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize="15" fontWeight="800" fill="rgba(255,255,255,.94)" fontFamily="inherit" letterSpacing="-.6">aws</text>
      <path d={`M${cx - 12} ${cy + 8} q12 6.5 24 0`} stroke="#ff9900" strokeWidth="1.9" fill="none" strokeLinecap="round" />
      <path d={`M${cx + 9.5} ${cy + 5.2} l2.7 1.6 -1.5 2.6`} stroke="#ff9900" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
  return (
    <svg viewBox="0 0 600 540" width="100%" className="max-w-[540px]" fill="none" aria-hidden="true">
      <style>{`
        .ha-layer{transform-box:fill-box;transform-origin:center;animation:ha-breathe 5.6s ease-in-out infinite}
        .ha-medal{transform-box:fill-box;transform-origin:center;animation:ha-float 6.5s ease-in-out infinite}
        .ha-node{transform-box:fill-box;transform-origin:center;animation:ha-node 3s ease-in-out infinite}
        .ha-rise{transform-box:fill-box;transform-origin:center;animation:ha-rise 3.6s ease-in-out infinite}
        .ha-chip{transform-box:fill-box;transform-origin:center;animation:ha-chipfloat 7s ease-in-out infinite}
        .ha-flow{stroke-dasharray:2 7;animation:ha-dash 1.5s linear infinite}
        .ha-orbit{transform-box:fill-box;transform-origin:center;animation:ha-spin 22s linear infinite}
        .ha-spin1{transform-box:fill-box;transform-origin:center;animation:ha-spin360 2.1s cubic-bezier(.3,1.12,.4,1) .2s 1 both}
        @keyframes ha-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
        @keyframes ha-float{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-8px) rotate(3deg)}}
        @keyframes ha-node{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.14)}}
        @keyframes ha-rise{0%{transform:translateY(0);opacity:0}14%{opacity:.95}86%{opacity:.95}100%{transform:translateY(-286px);opacity:0}}
        @keyframes ha-chipfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes ha-dash{to{stroke-dashoffset:-18}}
        @keyframes ha-spin{to{transform:rotate(360deg)}}
        @keyframes ha-spin360{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion: reduce){.ha-layer,.ha-medal,.ha-node,.ha-rise,.ha-chip,.ha-flow,.ha-orbit,.ha-spin1{animation:none}}
      `}</style>
      <defs>
        <radialGradient id="hglow" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="rgba(124,92,230,.5)" />
          <stop offset="100%" stopColor="rgba(124,92,230,0)" />
        </radialGradient>
        <linearGradient id="hplane" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(167,139,250,.30)" />
          <stop offset="100%" stopColor="rgba(124,92,230,.08)" />
        </linearGradient>
        <linearGradient id="hmed" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b6ef2" />
          <stop offset="100%" stopColor="#6a48cf" />
        </linearGradient>
        <linearGradient id="hbeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(196,181,253,.55)" />
          <stop offset="100%" stopColor="rgba(196,181,253,0)" />
        </linearGradient>
        <linearGradient id="hchip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(60,50,96,.92)" />
          <stop offset="100%" stopColor="rgba(32,26,54,.92)" />
        </linearGradient>
      </defs>
      <ellipse cx="300" cy="290" rx="290" ry="240" fill="url(#hglow)" />
      <rect x="293" y="120" width="14" height="300" fill="url(#hbeam)" opacity="0.7" />
      {plane(360, 0)}
      {plane(300, 1)}
      {plane(240, 2)}
      {[[250, 234], [352, 234], [300, 208]].map(([x, y], i) => (
        <g key={`n${i}`} className="ha-node" style={{ animationDelay: `${i * 0.5}s` }}>
          <circle cx={x} cy={y} r="11" fill="#7c5ce6" stroke="rgba(196,181,253,.6)" />
          <path d={`M${x - 5} ${y} l3.5 3.5 6 -7`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      ))}
      {/* light rising up through the layers into the check */}
      <circle className="ha-rise" cx="300" cy="406" r="5" fill="#c4b5fd" style={{ animationDelay: '0s' }} />
      <circle className="ha-rise" cx="300" cy="406" r="4" fill="#a78bfa" style={{ animationDelay: '1.8s' }} />
      {/* tool chips orbiting the check, feeding evidence in */}
      {chip(158, 96, g(BRAND.github, 'rgba(255,255,255,.94)'), 0)}
      {chip(442, 96, g(BRAND.gitlab, 'rgba(255,255,255,.94)'), 1)}
      {chip(126, 214, awsGlyph, 2)}
      {chip(474, 214, g(BRAND.azure, '#4cc2ff', 1.04), 3)}
      {/* slowly rotating orbit ring for depth */}
      <circle className="ha-orbit" cx="300" cy="120" r="64" fill="none" stroke="rgba(196,181,253,.28)" strokeWidth="1.2" strokeDasharray="2 9" />
      <g className="ha-spin1">
        <g className="ha-medal">
          <circle cx="300" cy="120" r="78" fill="url(#hglow)" />
          <circle cx="300" cy="120" r="46" fill="url(#hmed)" stroke="rgba(196,181,253,.65)" strokeWidth="1.5" />
          <path d="M280 120 l13 13 l27 -30" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </g>
    </svg>
  );
}

// ── Animated product tour ───────────────────────────────────────────────────
// An autoplaying, looping walkthrough: a cursor glides across the app sidebar,
// clicks each feature, and the main panel animates the matching screen in.
// Pure CSS/JS — no video file, crisp at any size, on-brand.
const PT_NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'findings', label: 'Findings', icon: ScanLine },
  { id: 'validation', label: 'Validation', icon: ShieldCheck },
  { id: 'askai', label: 'Ask AI', icon: Sparkles },
  { id: 'policy', label: 'Policy gates', icon: GitBranch },
];
const PT_NAV_Y = [30, 41, 52, 63, 74]; // % from top — cursor + nav share these
const PT_STEP_MS = 3000;

const PT_CSS = `
.pt-wrap{position:relative}
.pt-glow{position:absolute;inset:-28px;border-radius:2.6rem;filter:blur(60px);opacity:.7;background:linear-gradient(120deg,rgba(167,139,250,.5),rgba(147,197,253,.32),rgba(240,171,214,.4))}
.pt-frame{position:relative;width:100%;aspect-ratio:16/10;border-radius:18px;overflow:hidden;border:1px solid rgba(196,181,253,.22);background:linear-gradient(180deg,#221b38 0%,#181325 100%);box-shadow:0 30px 70px -22px rgba(8,6,20,.7)}
.pt-top{height:34px;display:flex;align-items:center;gap:7px;padding:0 13px;border-bottom:1px solid rgba(196,181,253,.12);background:rgba(255,255,255,.03)}
.pt-dot{width:9px;height:9px;border-radius:50%}
.pt-url{margin-left:12px;height:19px;flex:1;max-width:280px;border-radius:6px;background:rgba(255,255,255,.06);display:flex;align-items:center;padding:0 9px;font-size:10.5px;color:#b7add9;font-family:'JetBrains Mono',monospace;gap:6px}
.pt-body{position:absolute;top:34px;left:0;right:0;bottom:0;display:flex}
.pt-sb{position:relative;width:27%;min-width:120px;border-right:1px solid rgba(196,181,253,.12);background:rgba(12,9,22,.4);padding-top:8px}
.pt-brand{display:flex;align-items:center;gap:7px;padding:6px 12px 12px;font-size:12.5px;font-weight:800;color:#efe9ff}
.pt-brand .m{width:18px;height:18px;border-radius:6px;background:linear-gradient(135deg,#8b6ef2,#6a48cf);display:grid;place-items:center}
.pt-nav{position:absolute;left:0;right:0;top:0;bottom:0}
.pt-ni{position:absolute;left:7%;right:7%;display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;font-size:11.5px;color:#a79fc4;transition:background .35s,color .35s;transform:translateY(-50%)}
.pt-ni.on{background:rgba(139,110,242,.20);color:#f3efff;font-weight:600;box-shadow:inset 0 0 0 1px rgba(167,139,250,.28)}
.pt-ni .ic{opacity:.85;flex-shrink:0}
.pt-main{position:relative;flex:1;overflow:hidden}
.pt-scene{position:absolute;inset:0;padding:16px 18px;opacity:0;transition:opacity .5s ease;pointer-events:none}
.pt-scene.on{opacity:1}
.pt-h{font-size:13.5px;font-weight:700;color:#efe9ff;letter-spacing:-.01em}
.pt-sub{font-size:10.5px;color:#9b93bd;margin-top:1px}
.pt-cursor{position:absolute;z-index:20;left:13%;top:33%;transition:left .85s cubic-bezier(.5,.05,.2,1),top .85s cubic-bezier(.5,.05,.2,1);pointer-events:none;filter:drop-shadow(0 3px 5px rgba(0,0,0,.5))}
.pt-ring{position:absolute;z-index:19;width:34px;height:34px;border-radius:50%;border:2px solid rgba(167,139,250,.9);left:13%;top:33%;transform:translate(-6px,-4px) scale(.2);opacity:0;transition:left .85s cubic-bezier(.5,.05,.2,1),top .85s cubic-bezier(.5,.05,.2,1)}
.pt-ring.click{animation:pt-click .6s ease-out}
@keyframes pt-click{0%{opacity:.9;transform:translate(-6px,-4px) scale(.2)}100%{opacity:0;transform:translate(-6px,-4px) scale(1.1)}}
/* scene bits */
.pt-verdict{display:flex;align-items:center;gap:14px;margin-top:12px;padding:14px;border-radius:13px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.25)}
.pt-vring{position:relative;width:58px;height:58px;flex-shrink:0}
.pt-vtxt .a{font-size:16px;font-weight:800;color:#5fe0a6}
.pt-vtxt .b{font-size:10.5px;color:#9b93bd;margin-top:2px}
.pt-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:12px}
.pt-tile{border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(196,181,253,.14);padding:9px 10px}
.pt-tile .n{font-size:17px;font-weight:800;color:#efe9ff}
.pt-tile .l{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#8f87b3;margin-top:1px}
.pt-row{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;background:rgba(255,255,255,.03);border:1px solid rgba(196,181,253,.1);margin-top:8px}
.pt-sev{font-size:8.5px;font-weight:800;letter-spacing:.04em;padding:2px 6px;border-radius:5px;flex-shrink:0}
.pt-row .t{font-size:11px;color:#e4e0f2;font-weight:600}
.pt-row .f{font-size:9.5px;color:#8f87b3;font-family:'JetBrains Mono',monospace;margin-left:auto;flex-shrink:0}
.pt-step{display:flex;align-items:center;gap:9px;padding:7px 2px;font-size:11px;color:#c9c3e0}
.pt-ck{width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,#34d399,#6a48cf);display:grid;place-items:center;flex-shrink:0}
.pt-spin{width:15px;height:15px;border-radius:50%;border:2px solid rgba(167,139,250,.3);border-top-color:#a78bfa;animation:pt-sp 1s linear infinite;flex-shrink:0}
@keyframes pt-sp{to{transform:rotate(360deg)}}
.pt-bub{max-width:82%;padding:8px 11px;border-radius:12px;font-size:11px;line-height:1.5;margin-top:9px}
.pt-bub.u{margin-left:auto;background:linear-gradient(135deg,#8b6ef2,#6a48cf);color:#fff;border-bottom-right-radius:4px}
.pt-bub.a{background:rgba(255,255,255,.05);border:1px solid rgba(196,181,253,.16);color:#e4e0f2;border-bottom-left-radius:4px}
.pt-typ span{display:inline-block;width:5px;height:5px;margin:0 1px;border-radius:50%;background:#a79fc4;animation:pt-ty 1s infinite}
.pt-typ span:nth-child(2){animation-delay:.15s}.pt-typ span:nth-child(3){animation-delay:.3s}
@keyframes pt-ty{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.pt-gate{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;background:rgba(255,255,255,.03);border:1px solid rgba(196,181,253,.1);margin-top:8px;font-size:11px;color:#e4e0f2;font-weight:600}
.pt-pass{margin-left:auto;font-size:8.5px;font-weight:800;color:#5fe0a6;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.3);padding:2px 7px;border-radius:5px}
@media (prefers-reduced-motion: reduce){.pt-cursor,.pt-ring{transition:none}.pt-scene{transition:none}}
`;

const SEV_STYLE = {
  Critical: { color: '#f2647a', bg: 'rgba(242,100,122,.14)' },
  High: { color: '#f0975a', bg: 'rgba(240,151,90,.14)' },
  Medium: { color: '#f0c24a', bg: 'rgba(240,194,74,.14)' },
};

function ProductTour() {
  const [step, setStep] = useState(0);
  const [scene, setScene] = useState(0);
  const [clickKey, setClickKey] = useState(0);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setStep((s) => (s + 1) % PT_NAV.length), PT_STEP_MS);
    return () => clearInterval(id);
  }, [reduced]);
  useEffect(() => {
    setClickKey((k) => k + 1);
    const t = setTimeout(() => setScene(step), 640);
    return () => clearTimeout(t);
  }, [step]);

  const cursorTop = `${PT_NAV_Y[step] + 3}%`;
  const active = PT_NAV[scene].id;

  return (
    <div className="pt-wrap"><style>{PT_CSS}</style>
      <div className="pt-glow" />
      <div className="pt-frame">
        <div className="pt-top">
          <span className="pt-dot" style={{ background: '#f2647a' }} />
          <span className="pt-dot" style={{ background: '#f0c24a' }} />
          <span className="pt-dot" style={{ background: '#5fe0a6' }} />
          <span className="pt-url"><span style={{ color: '#7d74a6' }}>app.lythouse.ai</span>/{active}</span>
        </div>
        <div className="pt-body">
          {/* sidebar */}
          <div className="pt-sb">
            <div className="pt-brand"><span className="m"><ShieldCheck size={11} color="#fff" /></span>LytHouse</div>
            <div className="pt-nav">
              {PT_NAV.map((n, i) => (
                <div key={n.id} className={`pt-ni ${active === n.id ? 'on' : ''}`} style={{ top: `${PT_NAV_Y[i]}%` }}>
                  <n.icon size={13} className="ic" />{n.label}
                </div>
              ))}
            </div>
          </div>
          {/* main */}
          <div className="pt-main">
            {/* Overview */}
            <div className={`pt-scene ${active === 'overview' ? 'on' : ''}`}>
              <div className="pt-h">Release Overview</div>
              <div className="pt-sub">Release candidate · Cloud-Native Microservices</div>
              <div className="pt-verdict">
                <div className="pt-vring">
                  <svg width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="24" fill="none" stroke="rgba(52,211,153,.18)" strokeWidth="5" /><circle cx="29" cy="29" r="24" fill="none" stroke="#34d399" strokeWidth="5" strokeLinecap="round" strokeDasharray="151" strokeDashoffset="18" transform="rotate(-90 29 29)" /></svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800, color: '#5fe0a6' }}>12</div>
                </div>
                <div className="pt-vtxt"><div className="a">Cleared to ship</div><div className="b">Risk score 12/100 · 0 blocking issues</div></div>
              </div>
              <div className="pt-tiles">
                {[['8', 'Projects'], ['3', 'Findings'], ['100%', 'Policies pass']].map(([n, l]) => (
                  <div className="pt-tile" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>
                ))}
              </div>
            </div>
            {/* Findings */}
            <div className={`pt-scene ${active === 'findings' ? 'on' : ''}`}>
              <div className="pt-h">Findings</div>
              <div className="pt-sub">Real static + dependency analysis · this release</div>
              {[['High', 'Vulnerable dependency: axios@0.21.0', 'package.json'], ['Medium', 'eval() usage', 'src/utils.ts:42'], ['High', 'CORS wildcard origin', 'server/app.ts:19']].map(([s, t, f]) => (
                <div className="pt-row" key={t}>
                  <span className="pt-sev" style={{ color: SEV_STYLE[s].color, background: SEV_STYLE[s].bg }}>{s.toUpperCase()}</span>
                  <span className="t">{t}</span><span className="f">{f}</span>
                </div>
              ))}
            </div>
            {/* Validation */}
            <div className={`pt-scene ${active === 'validation' ? 'on' : ''}`}>
              <div className="pt-h">Validation pipeline</div>
              <div className="pt-sub">Running real checks on the release candidate</div>
              <div style={{ marginTop: 10 }}>
                {['Repository fetch', 'Secret scanning', 'Static analysis', 'Dependency audit (OSV)'].map((s) => (
                  <div className="pt-step" key={s}><span className="pt-ck"><Check size={10} color="#fff" strokeWidth={3} /></span>{s}</div>
                ))}
                <div className="pt-step"><span className="pt-spin" />AI risk analysis…</div>
              </div>
            </div>
            {/* Ask AI */}
            <div className={`pt-scene ${active === 'askai' ? 'on' : ''}`}>
              <div className="pt-h">Ask LytHouse AI</div>
              <div className="pt-sub">Grounded in this release's real findings</div>
              <div className="pt-bub u">Is release #482 safe to ship?</div>
              <div className="pt-bub a">Yes — cleared. Risk 12/100, no critical or high findings block it. One medium (eval usage) is worth fixing but isn't a gate.</div>
              <div className="pt-bub a" style={{ width: 46 }}><span className="pt-typ"><span /><span /><span /></span></div>
            </div>
            {/* Policy */}
            <div className={`pt-scene ${active === 'policy' ? 'on' : ''}`}>
              <div className="pt-h">Policy gates</div>
              <div className="pt-sub">Your minimum readiness, enforced every release</div>
              {['No critical findings', 'Risk score under 40', 'Security approval present'].map((g) => (
                <div className="pt-gate" key={g}><ShieldCheck size={13} color="#5fe0a6" />{g}<span className="pt-pass">PASS</span></div>
              ))}
            </div>
            {/* cursor + click ring */}
            <div className="pt-ring" key={clickKey} style={{ left: '13%', top: cursorTop, animation: reduced ? 'none' : undefined }} />
            <svg className="pt-cursor" width="22" height="22" viewBox="0 0 24 24" style={{ left: '13%', top: cursorTop }}>
              <path d="M4 2.5 L4 19.5 L8.6 15.2 L11.5 21.3 L14 20.1 L11.1 14.1 L17 14.1 Z" fill="#fff" stroke="#3a2c62" strokeWidth="1" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { navigate } = useRouter();
  const go = (to) => () => navigate(to);
  const [email, setEmail] = useState('');
  const [slide, setSlide] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState(null);
  const startTrial = () => navigate('/signup');
  const goTo = (to) => () => { if (to.startsWith('#')) document.querySelector(to)?.scrollIntoView({ behavior: 'smooth' }); else navigate(to); };

  const NavLink = ({ children, href = '#' }) => (
    <a href={href} className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors">{children}</a>
  );
  // Lavender pill — the primary action across the page (glows on the dark canvas).
  const Dark = ({ children, onClick, className = '' }) => (
    <button onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 ${className}`} style={{ background: 'linear-gradient(120deg,#8b6ef2,#7c5ce6)', boxShadow: '0 8px 24px -8px rgba(124,92,230,.6)' }}>{children}</button>
  );

  return (
    <div className="dark relative min-h-screen overflow-x-hidden text-[#eeecf6]" style={{ background: 'linear-gradient(180deg,#1f1b2c 0%,#171423 100%)' }}>
      {/* soft gradient aurora wash behind the whole page */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Smaller blur radius under lg: a 120px blur on 3 full-viewport-fixed
            layers is expensive to recomposite on repaint, which shows up as
            scroll jank on phones. 60px reads almost identically but is much
            cheaper on mobile GPUs. */}
        <div className="absolute -top-40 left-1/2 h-[560px] w-[880px] -translate-x-1/2 rounded-full blur-[60px] lg:blur-[120px]"
          style={{ background: 'radial-gradient(closest-side, rgba(167,139,250,.42), transparent 70%)' }} />
        <div className="absolute -top-24 right-[6%] h-[420px] w-[420px] rounded-full blur-[60px] lg:blur-[120px]"
          style={{ background: 'radial-gradient(closest-side, rgba(147,197,253,.40), transparent 70%)' }} />
        <div className="absolute top-24 left-[4%] h-[420px] w-[420px] rounded-full blur-[60px] lg:blur-[120px]"
          style={{ background: 'radial-gradient(closest-side, rgba(240,171,214,.38), transparent 70%)' }} />
      </div>

      <div className="relative">
        {/* fixed frosted-glass pill nav — stays pinned to the top on scroll */}
        <div className="fixed inset-x-0 top-0 z-40 px-4 pt-3">
          <header
            className="mx-auto max-w-6xl rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md lg:backdrop-blur-xl backdrop-saturate-150"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,.7) inset, 0 10px 30px -10px rgba(16,24,40,.14), 0 24px 60px -24px rgba(124,92,230,.24)' }}>
            <div className="px-5 h-14 flex items-center justify-between">
              <Logo size={25} />
              <nav className="hidden lg:flex items-center gap-1">
                <NavMenu label="Product" items={PRODUCT_MENU} onGo={goTo} />
                <NavMenu label="How it works" items={HOW_MENU} onGo={goTo} />
                <NavMenu label="Resources" items={RESOURCES_MENU} onGo={goTo} />
                <NavMenu label="About" items={ABOUT_MENU} onGo={goTo} />
                <button onClick={goTo('/docs')} className="rounded-lg px-3 py-2 text-[15px] font-medium text-white/75 hover:text-white transition-colors">Docs</button>
                <button onClick={goTo('/plans')} className="rounded-lg px-3 py-2 text-[15px] font-medium text-white/75 hover:text-white transition-colors">Pricing</button>
              </nav>
              <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={go('/signin')} className="hidden sm:inline text-sm font-semibold text-navy-800 hover:text-brand-700 transition-colors px-1">Sign in</button>
                <button onClick={go('/demo')} className="hidden sm:inline-flex rounded-full border border-gray-300/80 bg-white/50 px-4 py-2 text-sm font-semibold text-navy-800 hover:bg-white transition-colors">Book a demo</button>
                <Dark onClick={go('/signup')}>Free trial</Dark>
                {/* Below lg the nav above is `hidden`, so this is the only way to
                    reach Product/How it works/Resources/About/Docs/Pricing on a
                    phone — previously there was no mobile equivalent at all. */}
                <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden -mr-1 rounded-lg p-2 text-navy-800" aria-label="Open menu"><Menu size={22} /></button>
              </div>
            </div>
          </header>
        </div>

        {/* mobile nav drawer — every link the desktop pill nav has, reachable below lg */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setMobileMenuOpen(false); setMobileSection(null); }} />
            <div className="absolute inset-x-3 top-3 max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#1f1b2c] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 h-14">
                <Logo size={22} />
                <button onClick={() => { setMobileMenuOpen(false); setMobileSection(null); }} className="p-2 text-white/70" aria-label="Close menu"><X size={20} /></button>
              </div>
              <div className="px-3 py-3">
                {[
                  { key: 'product', label: 'Product', items: PRODUCT_MENU },
                  { key: 'how', label: 'How it works', items: HOW_MENU },
                  { key: 'resources', label: 'Resources', items: RESOURCES_MENU },
                  { key: 'about', label: 'About', items: ABOUT_MENU },
                ].map((sec) => {
                  const isOpen = mobileSection === sec.key;
                  return (
                    <div key={sec.key} className="border-b border-white/10 last:border-b-0">
                      <button onClick={() => setMobileSection(isOpen ? null : sec.key)} className="flex w-full items-center justify-between px-3 py-3.5 text-left">
                        <span className="text-sm font-semibold text-white/90">{sec.label}</span>
                        <ChevronDown size={16} className={`text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="pb-2">
                          {sec.items.map((it) => (
                            <button key={it.t} onClick={() => { setMobileMenuOpen(false); setMobileSection(null); goTo(it.to)(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/85 hover:bg-white/5">
                              <it.icon size={16} className="shrink-0 text-white/50" /><span className="text-sm font-medium">{it.t}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="mt-2 border-t border-white/10 pt-2">
                  <button onClick={() => { setMobileMenuOpen(false); goTo('/docs')(); }} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/85 hover:bg-white/5">Docs</button>
                  <button onClick={() => { setMobileMenuOpen(false); goTo('/plans')(); }} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/85 hover:bg-white/5">Pricing</button>
                </div>
                <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
                  <button onClick={() => { setMobileMenuOpen(false); go('/signin')(); }} className="w-full rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-white/90">Sign in</button>
                  <button onClick={() => { setMobileMenuOpen(false); go('/demo')(); }} className="w-full rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-white/90">Book a demo</button>
                  <Dark onClick={() => { setMobileMenuOpen(false); go('/signup')(); }} className="w-full">Free trial</Dark>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* hero — text left, isometric validation art right */}
        <section className="mx-auto max-w-6xl px-5 pt-32 pb-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur"><Sparkles size={12} />AI release decisions</span>
              <h1 className="mt-6 text-5xl sm:text-6xl font-bold tracking-tight leading-[1.06]">
                Release validation that gets smarter with{' '}
                <span className="bg-gradient-to-r from-brand-600 via-brand-400 to-[#e79ad4] bg-clip-text text-transparent">every deploy.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-navy-400 leading-relaxed">
                LytHouse reads your repository, validates every release against your policies, and tells you — in plain language — whether it's safe to ship.
              </p>
              <div className="mt-8 flex max-w-md flex-col sm:flex-row items-stretch gap-2">
                <input
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') startTrial(); }}
                  type="email" placeholder="Enter your business email"
                  className="flex-1 rounded-full border border-gray-200 bg-white/80 px-5 py-3 text-sm text-navy-900 placeholder:text-gray-400 shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
                <Dark onClick={startTrial} className="px-6 py-3">Start free<ArrowRight size={15} /></Dark>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-navy-400">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-brand-500" />Connect a repo in seconds</span>
              </div>
            </div>
            <div className="relative flex justify-center lg:justify-end">
              <HeroArt />
            </div>
          </div>
        </section>

        {/* animated product tour — cursor navigates the app, screens animate in */}
        <section id="product" className="mx-auto max-w-4xl px-5 pb-28">
          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur"><Sparkles size={12} />Live product tour</span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">See it move through a real release</h2>
            <p className="mt-2 text-navy-400">Watch how your team navigates from the release verdict to findings, validation, AI answers and policy gates.</p>
          </div>
          <ProductTour />
        </section>

        {/* illustrated capabilities (rho-style stat/feature cards) */}
        <section className="mx-auto max-w-6xl px-5 pt-4 pb-24">
          <div className="grid gap-6 sm:grid-cols-3">
            {CAPS.map((c) => {
              const Illo = c.illo;
              return (
                <div key={c.t} className="rounded-3xl border border-gray-200/80 bg-white/85 p-7 backdrop-blur [box-shadow:0_1px_2px_rgba(16,24,40,.05),0_18px_40px_-24px_rgba(124,92,230,.35)]">
                  <div className="mb-4 overflow-hidden rounded-2xl"><Illo /></div>
                  <h3 className="text-2xl font-semibold tracking-tight">{c.t}</h3>
                  <p className="mt-2 text-sm text-navy-500 leading-relaxed">{c.d}</p>
                  <button onClick={goTo(c.to)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800">
                    <ExternalLink size={14} /><span className="underline decoration-brand-300 underline-offset-4">Learn more</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* trust strip */}
        <section className="border-y border-gray-100 bg-white/60 backdrop-blur">
          <div className="mx-auto max-w-6xl px-5 py-7 text-center text-sm font-semibold uppercase tracking-wide text-navy-300">
            Built for teams shipping to production every day
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="mx-auto max-w-6xl px-5 py-28">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight">From commit to confident deploy.</h2>
            <p className="mt-3 text-navy-500">Six clear stages take a release from "what changed?" to "shipped and verified" — with a human sign-off in between.</p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: GitBranch, t: 'Discovery', d: 'LytHouse reads your repo and builds a plain-language picture of what the release actually contains.' },
              { icon: ScanLine, t: 'Validation', d: 'Real static checks across containers, Kubernetes, CI, secrets and dependencies — no invented numbers.' },
              { icon: Zap, t: 'Remediation', d: 'Auto-generate safe fixes as pull requests, or hand guided recommendations to the right owner.' },
              { icon: Users, t: 'Governance', d: 'Multi-team sign-off before anything ships, logged with approver and timestamp.' },
              { icon: Rocket, t: 'Deployment', d: 'Policy gates enforce your minimum readiness and required approvals before deploy.' },
              { icon: Activity, t: 'Observability', d: 'Continuous watching detects new commits and tells you if your decision is still valid.' },
            ].map((f) => (
              <Tilt key={f.t} max={6} className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur p-6 hover:border-brand-200 [box-shadow:0_1px_2px_rgba(16,24,40,.05),0_10px_20px_-8px_rgba(16,24,40,.10)] hover:[box-shadow:0_10px_20px_rgba(16,24,40,.08),0_30px_48px_-16px_rgba(124,92,230,.28)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [box-shadow:inset_0_1px_0_rgba(255,255,255,.6),0_4px_10px_-2px_rgba(124,92,230,.30)]"><f.icon size={18} /></span>
                <h3 className="mt-4 text-lg font-bold">{f.t}</h3>
                <p className="mt-1.5 text-sm text-navy-500 leading-relaxed">{f.d}</p>
              </Tilt>
            ))}
          </div>
        </section>

        {/* product showcase — mockup on top, copy underneath */}
        <section className="mx-auto max-w-6xl px-5 py-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">See it in the flow of your work.</h2>
            <p className="mt-3 text-navy-400">From the terminal, to the release decision, to the fix — LytHouse shows up where your team already works.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Card 1 — terminal */}
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="p-5 pb-0">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141019]">
                  <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                    <span className="ml-2 text-[10px] text-white/40">terminal</span>
                  </div>
                  <div className="p-3.5 font-mono text-[11.5px] leading-relaxed">
                    <div className="text-white/85"><span className="text-brand-300">$</span> lythouse validate</div>
                    <div className="text-[#7ee2c9]">✓ Discovery complete — 3 services</div>
                    <div className="text-[#7ee2c9]">✓ 0 secrets · 0 critical CVEs</div>
                    <div className="text-[#7ee2c9]">✓ Policy gates passed</div>
                    <div className="mt-1 font-semibold text-brand-200">✓ readiness 88/100 — cleared to deploy</div>
                  </div>
                </div>
              </div>
              <div className="p-6" style={{ background: 'linear-gradient(180deg, rgba(124,92,230,.10), transparent)' }}>
                <h3 className="text-xl font-semibold text-white">Validate from your terminal or CI</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-400">Run the full pipeline anywhere with one command — and gate every deploy on the result.</p>
              </div>
            </div>

            {/* Card 2 — release decision */}
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="p-5 pb-0">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141019]">
                  <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                    <span className="ml-2 text-[10px] text-white/40">Release Review</span>
                  </div>
                  <div className="p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-white/40">Decision</span>
                      <span className="rounded-full bg-[#123a24] px-2 py-0.5 text-[10px] font-bold text-[#4ade80]">CLEARED</span>
                    </div>
                    <div className="mt-1.5 text-lg font-bold text-[#4ade80]">Cleared for Release</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5"><div className="text-base font-bold text-white">92%</div><div className="text-[9px] uppercase tracking-wide text-white/40">Readiness</div></div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5"><div className="text-base font-bold text-white">0</div><div className="text-[9px] uppercase tracking-wide text-white/40">Blockers</div></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6" style={{ background: 'linear-gradient(180deg, rgba(124,92,230,.10), transparent)' }}>
                <h3 className="text-xl font-semibold text-white">Get a clear release decision</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-400">Open a release and see the call — cleared, review, or blocked — with the evidence right beside it.</p>
              </div>
            </div>

            {/* Card 3 — fix */}
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="p-5 pb-0">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141019]">
                  <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                    <span className="ml-2 text-[10px] text-white/40">Findings</span>
                  </div>
                  <div className="p-3.5">
                    <div className="flex items-start gap-2 rounded-lg border border-[#e5737d]/30 bg-[#e5737d]/10 p-2.5">
                      <XCircle size={14} className="mt-0.5 shrink-0 text-[#e5737d]" />
                      <div><div className="text-[12px] font-semibold text-white">Hardcoded secret</div><div className="text-[10.5px] text-white/50">config/prod.ts:24</div></div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 text-[11px] text-[#7ee2c9]"><CheckCircle2 size={13} />Fix generated → pull request #142 opened</div>
                  </div>
                </div>
              </div>
              <div className="p-6" style={{ background: 'linear-gradient(180deg, rgba(124,92,230,.10), transparent)' }}>
                <h3 className="text-xl font-semibold text-white">Fix findings in a click</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-400">Turn any finding into a grounded pull request your team reviews and merges — no busywork.</p>
              </div>
            </div>
          </div>
        </section>

        {/* two-audience split */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Built for both sides of the release.</h2>
            <p className="mt-3 text-navy-400">Engineers get depth and control. Security and compliance get enforcement and evidence. One platform, one source of truth.</p>
          </div>
          <div className="relative grid gap-4 md:grid-cols-2">
            {/* center glow beam */}
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 md:block" style={{ background: 'linear-gradient(180deg,transparent,rgba(196,181,253,.5),transparent)' }} />
            {[
              { label: 'For engineers', items: DEV_ITEMS },
              { label: 'For security & compliance', items: SEC_ITEMS },
            ].map((col) => (
              <div key={col.label} className="rounded-3xl border border-white/10 p-7" style={{ background: 'linear-gradient(160deg,rgba(124,92,230,.10),rgba(255,255,255,.02))' }}>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-sm font-semibold text-white">
                  <BadgeCheck size={15} className="text-brand-300" />{col.label}
                </div>
                <div className="space-y-5">
                  {col.items.map((it) => (
                    <div key={it.t} className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-300" />
                      <div>
                        <div className="text-[15px] font-semibold text-white">{it.t}</div>
                        <div className="text-sm text-navy-400">{it.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* gradient feature band */}
        <section id="features" className="mx-auto max-w-6xl px-5 py-20">
          <div className="rounded-3xl px-8 py-14 text-white"
            style={{ background: 'linear-gradient(120deg, #7c5ce6 0%, #8b6ef2 45%, #c98fd8 100%)', boxShadow: '0 30px 60px -24px rgba(124,92,230,.5)' }}>
            <div className="grid lg:grid-cols-3 gap-8">
              {[
                { icon: ShieldCheck, t: 'Honest by design', d: 'Every score is computed from real signals in your repo — never fabricated telemetry.' },
                { icon: TrendingUp, t: 'Decision-first', d: 'Open a release and immediately see the call: cleared, review, or blocked — and why.' },
                { icon: Lock, t: 'Policy as code', d: 'Encode your deployment rules once and let LytHouse enforce them on every release.' },
              ].map((f) => (
                <div key={f.t} className="rounded-2xl bg-white/10 p-5 backdrop-blur transition-transform duration-300 ease-out hover:-translate-y-1 [box-shadow:inset_0_1px_0_rgba(255,255,255,.18)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 [box-shadow:inset_0_1px_0_rgba(255,255,255,.3)]"><f.icon size={20} /></span>
                  <h3 className="mt-4 text-xl font-bold">{f.t}</h3>
                  <p className="mt-2 text-sm text-white/85 leading-relaxed">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* comparison table */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">How LytHouse compares.</h2>
            <p className="mt-3 text-navy-400">Against a manual review process, or a generic code scanner that was never built to make a release decision.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-sm">
                  <th className="p-4 font-semibold text-white/70">Capability</th>
                  <th className="p-4 font-bold text-white" style={{ background: 'rgba(124,92,230,.10)' }}>
                    <span className="inline-flex items-center gap-1.5"><ShieldCheck size={16} className="text-brand-300" />LytHouse</span>
                  </th>
                  <th className="p-4 font-semibold text-white/70">Manual review</th>
                  <th className="p-4 font-semibold text-white/70">Generic scanner</th>
                </tr>
              </thead>
              <tbody>
                {COMP_ROWS.map((r, i) => {
                  const cell = ([s, label]) => (
                    <span className="inline-flex items-center gap-2 text-sm">
                      {s === 'ok' ? <CheckCircle2 size={16} className="text-brand-300 shrink-0" />
                        : s === 'warn' ? <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                        : <XCircle size={16} className="shrink-0 text-[#e5737d]" />}
                      <span className={s === 'ok' ? 'text-white' : 'text-navy-400'}>{label}</span>
                    </span>
                  );
                  return (
                    <tr key={r.f} className={i < COMP_ROWS.length - 1 ? 'border-b border-white/5' : ''}>
                      <td className="p-4 text-[14.5px] font-medium text-white/85">{r.f}</td>
                      <td className="p-4" style={{ background: 'rgba(124,92,230,.06)' }}>{cell(r.lh)}</td>
                      <td className="p-4">{cell(r.man)}</td>
                      <td className="p-4">{cell(r.scan)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-5 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Questions, answered.</h2>
            <p className="mt-3 text-navy-400">The things teams ask before they connect their first repo.</p>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((q, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="text-[15px] font-semibold text-white">{q.q}</span>
                  <ChevronDown size={18} className={`shrink-0 text-brand-300 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <div className="px-5 pb-5 text-sm leading-relaxed text-navy-400">{q.a}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* CTA banner */}
        <section id="security" className="mx-auto max-w-6xl px-5 py-24">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-3xl border border-brand-100 bg-white/70 px-8 py-10 backdrop-blur"
            style={{ boxShadow: '0 20px 50px -24px rgba(124,92,230,.35)' }}>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Ready to ship with confidence?</h2>
              <p className="mt-2 text-navy-500">Create an account, connect a repository, and get your first release decision in minutes.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Dark onClick={go('/signup')} className="px-6 py-3">Start free<ArrowRight size={15} /></Dark>
              <button onClick={go('/demo')} className="rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-navy-800 hover:bg-white transition-colors">Book a demo</button>
            </div>
          </div>
        </section>

        {/* footer */}
        <footer className="border-t border-gray-100">
          <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Logo size={24} />
            <p className="text-xs text-navy-400">© {2026} LytHouse. Ship with confidence.</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-500">
              <button onClick={go('/terms')} className="hover:text-brand-700">Terms</button>
              <button onClick={go('/privacy')} className="hover:text-brand-700">Privacy</button>
              <button onClick={go('/security')} className="hover:text-brand-700">Security</button>
              <button onClick={go('/signin')} className="hover:text-brand-700">Sign in</button>
              <button onClick={go('/signup')} className="hover:text-brand-700">Free trial</button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default LandingPage;
