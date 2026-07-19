// @ts-nocheck
import { useRef, useState } from 'react';
import { Logo } from '../lib/ui';
import { useRouter } from '../lib/router';

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
import {
  ShieldCheck, GitBranch, ScanLine, Users, Rocket, Activity, CheckCircle2,
  ArrowRight, Zap, Lock, TrendingUp,
} from 'lucide-react';

export function LandingPage() {
  const { navigate } = useRouter();
  const go = (to) => () => navigate(to);

  const NavLink = ({ children, href = '#' }) => (
    <a href={href} className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors">{children}</a>
  );

  return (
    <div className="min-h-screen bg-white text-navy-900">
      {/* announcement bar */}
      <div className="bg-brand-500 text-white text-sm font-medium text-center py-2.5 px-4">
        New — continuous release validation that watches your repo for you.
      </div>

      {/* nav */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <Logo size={26} />
          <nav className="hidden md:flex items-center gap-7">
            <NavLink href="#product">Product</NavLink>
            <NavLink href="#how">How it works</NavLink>
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#security">Security</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={go('/signin')} className="text-sm font-semibold text-navy-800 hover:text-brand-700 transition-colors">Sign in</button>
            <button onClick={go('/signup')} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 transition-colors shadow-sm">Get started</button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-700"><Zap size={12} />AI Release Decisions</span>
          <h1 className="mt-5 text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">Ship with confidence.</h1>
          <p className="mt-5 text-lg text-navy-500 leading-relaxed max-w-lg">LytHouse reads your repository, validates every release against your policies, and tells you — in plain language — whether it's safe to deploy. No guesswork, no fabricated metrics.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={go('/signup')} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white hover:bg-brand-700 transition-colors shadow-sm">Start free<ArrowRight size={16} /></button>
            <button onClick={go('/signin')} className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-bold text-navy-800 hover:bg-gray-50 transition-colors">Sign in</button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-navy-400">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-brand-500" />Connect a GitHub repo in seconds</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-brand-500" />No credit card required</span>
          </div>
        </div>

        {/* product preview card — swivels toward the cursor in 3D */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-tr from-brand-200 to-transparent rounded-[2rem] blur-2xl opacity-70" />
          <Tilt
            baseRx={6} baseRy={-12} max={9}
            className="relative rounded-2xl border border-gray-200 bg-white p-5"
            style={{ boxShadow: '0 2px 4px rgba(16,24,40,.06), 0 24px 48px -12px rgba(16,24,40,.28), -18px 30px 60px -20px rgba(124,58,237,.32)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-navy-400">Release Decision</span>
              <span className="chip text-[10px] bg-[#e3f7ea] text-[#0f9a4c] border border-[#9adcb4]">CLEARED</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-[#12a150]">Cleared for Release</div>
            <p className="text-xs text-navy-400 mt-0.5">Release candidate · Cloud-Native Microservices</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                { l: 'Release Readiness', v: '92%', c: 'text-[#12a150]' },
                { l: 'Deployment Confidence', v: '88%', c: 'text-[#12a150]' },
                { l: 'Blocking Issues', v: '0', c: 'text-[#12a150]' },
                { l: 'Time to Ready', v: '—', c: 'text-navy-900' },
              ].map((x) => (
                <div key={x.l} className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2">
                  <div className={`text-xl font-bold ${x.c}`}>{x.v}</div>
                  <div className="text-[10px] uppercase tracking-wide text-navy-400 mt-0.5">{x.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5">
              {['Container images drop root privileges.', 'Production deploys require an approval gate.', 'CI runs automated security scanning.'].map((t) => (
                <div key={t} className="flex items-center gap-2 text-xs text-navy-700"><CheckCircle2 size={14} className="text-brand-500 shrink-0" />{t}</div>
              ))}
            </div>
          </Tilt>
        </div>
      </section>

      {/* logos / trust strip */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-navy-300 text-sm font-semibold">
          <span>Built for teams shipping to production every day</span>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
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
            <Tilt key={f.t} max={6} className="rounded-2xl border border-gray-200 bg-white p-6 hover:border-brand-200 [box-shadow:0_1px_2px_rgba(16,24,40,.05),0_10px_20px_-8px_rgba(16,24,40,.12)] hover:[box-shadow:0_10px_20px_rgba(16,24,40,.10),0_30px_48px_-16px_rgba(124,58,237,.30)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [box-shadow:inset_0_1px_0_rgba(255,255,255,.6),0_4px_10px_-2px_rgba(124,58,237,.35)]"><f.icon size={18} /></span>
              <h3 className="mt-4 text-lg font-bold">{f.t}</h3>
              <p className="mt-1.5 text-sm text-navy-500 leading-relaxed">{f.d}</p>
            </Tilt>
          ))}
        </div>
      </section>

      {/* feature band */}
      <section id="features" className="bg-brand-600 text-white">
        <div className="mx-auto max-w-6xl px-5 py-20 grid lg:grid-cols-3 gap-8">
          {[
            { icon: ShieldCheck, t: 'Honest by design', d: 'Every score is computed from real signals in your repo — never fabricated telemetry.' },
            { icon: TrendingUp, t: 'Decision-first', d: 'Open a release and immediately see the call: cleared, review, or blocked — and why.' },
            { icon: Lock, t: 'Policy as code', d: 'Encode your deployment rules once and let LytHouse enforce them on every release.' },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl bg-white/5 p-5 transition-transform duration-300 ease-out hover:-translate-y-1 [box-shadow:inset_0_1px_0_rgba(255,255,255,.12),0_16px_30px_-14px_rgba(0,0,0,.5)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 [box-shadow:inset_0_1px_0_rgba(255,255,255,.25)]"><f.icon size={20} /></span>
              <h3 className="mt-4 text-xl font-bold">{f.t}</h3>
              <p className="mt-2 text-sm text-white/80 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="security" className="mx-auto max-w-6xl px-5 py-24 text-center">
        <h2 className="text-4xl font-bold tracking-tight">Ready to ship with confidence?</h2>
        <p className="mt-3 text-navy-500 max-w-lg mx-auto">Create an account, connect a repository, and get your first AI release decision in minutes.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button onClick={go('/signup')} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-7 py-3.5 text-sm font-bold text-white hover:bg-brand-700 transition-colors shadow-sm">Get started free<ArrowRight size={16} /></button>
          <button onClick={go('/signin')} className="rounded-xl border border-gray-300 px-7 py-3.5 text-sm font-bold text-navy-800 hover:bg-gray-50 transition-colors">Sign in</button>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-gray-100">
        <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size={24} />
          <p className="text-xs text-navy-400">© {2026} LytHouse. Ship with confidence.</p>
          <div className="flex items-center gap-5 text-xs text-navy-500">
            <button onClick={go('/signin')} className="hover:text-brand-700">Sign in</button>
            <button onClick={go('/signup')} className="hover:text-brand-700">Get started</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
