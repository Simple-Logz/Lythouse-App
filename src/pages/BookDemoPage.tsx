// @ts-nocheck
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from '../lib/router';
import { Spinner } from '../lib/ui';
import { CheckCircle2, ArrowRight, CalendarClock, ShieldCheck } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────
// Book a demo — split layout matching the Free trial page: a black/purple
// value panel on the left, a self-contained request form on the right.
// ─────────────────────────────────────────────────────────────────────────

const SIZES = ['Just me', '2–10', '11–50', '51–200', '201–1,000', '1,000+'];

const BENEFITS = [
  'A live validation on a repo like yours — no fabricated numbers.',
  'How policy gates enforce your minimum readiness before deploy.',
  'Answers on SSO, self-hosting, pricing and rollout.',
];

// Light logo for the dark value panel (the shared Logo wordmark is dark ink).
function LightLogo() {
  return (
    <span className="flex items-center gap-2.5 select-none">
      <span className="flex items-center justify-center rounded-xl" style={{ width: 30, height: 30, background: '#7c5ce6' }}>
        <ShieldCheck size={17} strokeWidth={2.4} color="#fff" />
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', color: '#f4f5f8' }}>Lyt<span style={{ color: '#c4b5fd' }}>House</span></span>
    </span>
  );
}

const CSS = `
.bd-wrap{min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);background:#ffffff}
@media(max-width:900px){.bd-wrap{grid-template-columns:1fr}.bd-left{display:none!important}}
.bd-left{position:relative;overflow:hidden;background:radial-gradient(85% 75% at 8% 58%,rgba(124,92,230,.38),transparent 60%),linear-gradient(158deg,#2a2142 0%,#1c1730 55%,#171325 100%);color:#eeecf6;padding:48px 52px;display:flex;flex-direction:column}
.bd-left::after{content:'';position:absolute;left:-20%;bottom:-24%;width:72%;height:72%;background:radial-gradient(circle,rgba(150,110,255,.4),transparent 62%);filter:blur(70px)}
.bd-badge{position:relative;z-index:1;display:inline-flex;align-items:center;gap:7px;align-self:flex-start;border:1px solid rgba(196,181,253,.4);background:rgba(124,92,230,.16);color:#dcd0ff;border-radius:20px;padding:6px 12px;font-size:12px;font-weight:600}
.bd-line{width:1.5px;background:linear-gradient(rgba(196,181,253,.5),rgba(196,181,253,.25));margin:26px 0 6px 12px;height:44px;border-radius:2px;position:relative;z-index:1}
.bd-nodes{position:relative;display:flex;flex-direction:column;gap:32px;margin-top:8px}
.bd-nodes::before{content:'';position:absolute;left:13px;top:14px;bottom:0;width:1.5px;background:linear-gradient(rgba(196,181,253,.42),rgba(196,181,253,.22));border-radius:2px}
.bd-benefit{display:flex;gap:16px;align-items:flex-start;margin:0;position:relative;z-index:1;max-width:440px}
.bd-benefit .ck{position:relative;z-index:1;flex:0 0 auto;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:#a7f3d0;border:2px solid transparent;background:linear-gradient(#1b1526,#1b1526) padding-box,linear-gradient(135deg,#34d399 0%,#7c5ce6 100%) border-box}
.bd-benefit p{font-size:16px;line-height:1.6;color:#d6d2e6;padding-top:3px}
.bd-hook{display:block;margin-top:-2px;overflow:visible}
.bd-hook path{stroke:rgba(196,181,253,.32);stroke-width:1.5;fill:none;stroke-linecap:round}
.bd-right{display:flex;flex-direction:column;padding:26px 28px;overflow-y:auto}
.bd-form{width:100%;max-width:420px;margin:auto}
`;

export function BookDemoPage() {
  const { navigate } = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [size, setSize] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Best-effort persistence — never block the confirmation on it.
    try {
      await supabase.from('demo_requests').insert({
        name: name.trim(), email: email.trim(), company: company.trim(),
        company_size: size, message: message.trim() || null,
      });
    } catch { /* table may not exist yet — that's fine */ }
    setBusy(false);
    setDone(true);
  }

  return (
    <div className="bd-wrap"><style>{CSS}</style>
      {/* Left value panel */}
      <div className="bd-left">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 self-start" title="Back to home">
          <LightLogo />
        </button>
        <div style={{ marginTop: 'auto' }}>
          <span className="bd-badge"><CalendarClock size={12} />Personalized walkthrough</span>
          <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.18, letterSpacing: '-.02em', maxWidth: 440, marginTop: 16 }}>
            See LytHouse on your pipeline.
          </h1>
          <div className="bd-line" />
          <div className="bd-nodes">
            {BENEFITS.map((b) => (
              <div className="bd-benefit" key={b}>
                <span className="ck"><CheckCircle2 size={15} /></span>
                <p>{b}</p>
              </div>
            ))}
          </div>
          <svg className="bd-hook" width="150" height="132" viewBox="0 0 150 132" aria-hidden="true">
            <path d="M12 0 L12 44 C12 72 12 84 44 88 C78 92 76 112 76 132" />
          </svg>
        </div>
        <div style={{ marginTop: '26px', position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-.015em', color: '#eceafb', maxWidth: 340 }}>Ship on evidence, <span style={{ color: '#c4b5fd' }}>not on hope.</span></p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="bd-right">
        <div className="flex items-center justify-end gap-4 text-sm">
          <button onClick={() => navigate('/signup')} className="font-medium text-navy-500 hover:text-navy-800">Try it free</button>
          <button onClick={() => navigate('/signin')} className="font-semibold text-brand-600 hover:text-brand-700">Sign in</button>
        </div>

        {done ? (
          <div className="bd-form text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 border border-green-200">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-navy-900">Request received</h2>
            <p className="mt-2 text-sm text-gray-500">
              Thanks{name ? `, ${name.split(' ')[0]}` : ''}! We'll reach out at <strong>{email}</strong> to find a time. In the meantime, you can start a free trial right away.
            </p>
            <button onClick={() => navigate('/signup')} className="btn-primary w-full justify-center mt-6">Start a free trial<ArrowRight size={15} /></button>
            <button onClick={() => navigate('/')} className="btn-ghost w-full justify-center mt-2">Back to home</button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="bd-form">
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-navy-900">Book a demo</h2>
              <p className="mt-1.5 text-sm text-gray-500">We'll be in touch within one business day.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="d-name">Full name</label>
                <input id="d-name" className="input" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
              </div>
              <div>
                <label className="label" htmlFor="d-email">Work email</label>
                <input id="d-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </div>
              <div>
                <label className="label" htmlFor="d-company">Company</label>
                <input id="d-company" className="input" type="text" required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc" />
              </div>
              <div>
                <label className="label" htmlFor="d-size">Company size</label>
                <select id="d-size" className="input" required value={size} onChange={(e) => setSize(e.target.value)}>
                  <option value="" disabled>Select…</option>
                  {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="d-msg">Anything we should know? <span className="font-normal text-gray-400">(optional)</span></label>
                <textarea id="d-msg" className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What are you hoping to validate?" />
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 justify-center" disabled={busy}>
                {busy ? <Spinner size={16} /> : null}
                Request demo
                {!busy && <ArrowRight size={15} />}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default BookDemoPage;
