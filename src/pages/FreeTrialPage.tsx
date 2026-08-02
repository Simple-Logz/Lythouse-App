// @ts-nocheck
import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { anonKey } from '../lib/supabase';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
import { useRouter } from '../lib/router';
import { Spinner } from '../lib/ui';
import { CheckCircle2, AlertTriangle, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';

// Light logo for the dark value panel (the shared Logo wordmark is dark ink).
function LightLogo() {
  return (
    <span className="flex items-center gap-2.5 select-none">
      <span className="flex items-center justify-center rounded-xl" style={{ width: 30, height: 30, background: '#565d7d' }}>
        <ShieldCheck size={17} strokeWidth={2.4} color="#fff" />
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', color: '#f4f5f8' }}>Lyt<span style={{ color: '#aeb3c8' }}>House</span></span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Free trial — a dedicated, Spacelift-style sign-up experience. A dark value
// panel on the left, and on the right a form that starts a workspace: account
// name + company size + the person's details, or one-click social sign-up.
// ─────────────────────────────────────────────────────────────────────────

const COMPANY_SIZES = ['Just me', '2–10', '11–50', '51–200', '201–1,000', '1,000+'];

// Brand marks for the social sign-up row.
const PROVIDERS = [
  {
    id: 'github', name: 'GitHub', bg: '#1f2328', fg: '#ffffff',
    svg: 'M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z',
  },
  {
    id: 'gitlab', name: 'GitLab', bg: '#fc6d26', fg: '#ffffff',
    svg: 'M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.386 9.45.044 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.625-8.444a.92.92 0 0 0 .33-1.023',
  },
  {
    id: 'google', name: 'Google', bg: '#ffffff', fg: '#000000', border: true,
    multi: [
      { d: 'M23.52 12.273c0-.851-.076-1.67-.218-2.455H12v4.642h6.458a5.52 5.52 0 0 1-2.394 3.622v3.01h3.878c2.269-2.088 3.578-5.162 3.578-8.82z', f: '#4285F4' },
      { d: 'M12 24c3.24 0 5.956-1.075 7.942-2.908l-3.878-3.01c-1.075.72-2.45 1.146-4.064 1.146-3.125 0-5.77-2.11-6.714-4.948H1.276v3.11A11.995 11.995 0 0 0 12 24z', f: '#34A853' },
      { d: 'M5.286 14.28A7.213 7.213 0 0 1 4.91 12c0-.79.136-1.558.376-2.28V6.61H1.276A11.995 11.995 0 0 0 0 12c0 1.936.464 3.768 1.276 5.39l4.01-3.11z', f: '#FBBC05' },
      { d: 'M12 4.773c1.762 0 3.344.606 4.588 1.795l3.44-3.44C17.952 1.19 15.236 0 12 0A11.995 11.995 0 0 0 1.276 6.61l4.01 3.11C6.23 6.883 8.875 4.773 12 4.773z', f: '#EA4335' },
    ],
  },
  {
    id: 'azure', name: 'Microsoft', bg: '#ffffff', fg: '#000000', border: true,
    multi: [
      { d: 'M0 0h11.4v11.4H0z', f: '#F25022' },
      { d: 'M12.6 0H24v11.4H12.6z', f: '#7FBA00' },
      { d: 'M0 12.6h11.4V24H0z', f: '#00A4EF' },
      { d: 'M12.6 12.6H24V24H12.6z', f: '#FFB900' },
    ],
  },
];

const BENEFITS = [
  'Validate every release against your policies before it ever reaches production.',
  'Connect any Git repo — GitHub, GitLab, Bitbucket — in one governed workflow.',
  'Real checks for secrets, CVEs, containers and config drift — no fabricated metrics.',
];

const CSS = `
.ft-wrap{min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);background:#ffffff}
@media(max-width:900px){.ft-wrap{grid-template-columns:1fr}.ft-left{display:none!important}}
.ft-left{position:relative;overflow:hidden;background:radial-gradient(85% 75% at 8% 58%,rgba(124,92,230,.38),transparent 60%),linear-gradient(158deg,#2a2142 0%,#1c1730 55%,#171325 100%);color:#eeecf6;padding:48px 52px;display:flex;flex-direction:column}
.ft-left::after{content:'';position:absolute;left:-20%;bottom:-24%;width:72%;height:72%;background:radial-gradient(circle,rgba(150,110,255,.4),transparent 62%);filter:blur(70px)}
.ft-line{width:1.5px;background:linear-gradient(rgba(196,181,253,.5),rgba(196,181,253,.25));margin:30px 0 6px 12px;flex:0 0 auto;height:46px;border-radius:2px}
.ft-nodes{position:relative;display:flex;flex-direction:column;gap:32px;margin-top:8px}
.ft-nodes::before{content:'';position:absolute;left:13px;top:14px;bottom:0;width:1.5px;background:linear-gradient(rgba(196,181,253,.42),rgba(196,181,253,.22));border-radius:2px}
.ft-benefit{display:flex;gap:16px;align-items:flex-start;margin:0;position:relative;z-index:1;max-width:440px}
.ft-benefit .ck{position:relative;z-index:1;flex:0 0 auto;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:#a7f3d0;border:2px solid transparent;background:linear-gradient(#1b1526,#1b1526) padding-box,linear-gradient(135deg,#34d399 0%,#7c5ce6 100%) border-box}
.ft-benefit p{font-size:16px;line-height:1.6;color:#d6d2e6;padding-top:3px}
.ft-hook{display:block;margin-top:-2px;overflow:visible}
.ft-hook path{stroke:rgba(196,181,253,.32);stroke-width:1.5;fill:none;stroke-linecap:round}
.ft-right{display:flex;flex-direction:column;padding:26px 28px;overflow-y:auto}
.ft-form{width:100%;max-width:404px;margin:auto}
.ft-soc{display:flex;flex-direction:column;gap:9px;margin-top:20px}
.ft-sbtn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:44px;border-radius:10px;font-size:14px;font-weight:600;color:#fff;border:none;cursor:pointer;font-family:inherit;transition:.14s;position:relative}
.ft-sbtn:hover{filter:brightness(1.06)}
.ft-sbtn.lt{color:#1f2328;border:1px solid #e2e5ea;background:#fff}
.ft-sbtn.lt:hover{background:#f7f8fa;filter:none}
.ft-sbtn .ico{position:absolute;left:15px;display:grid;place-items:center}
.ft-div{display:flex;align-items:center;gap:12px;margin:22px 0 4px;color:#9aa0ab;font-size:12px;font-weight:600;letter-spacing:.02em}
.ft-div::before,.ft-div::after{content:'';flex:1;height:1px;background:#e7e9ec}
.ft-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:440px){.ft-row2{grid-template-columns:1fr}}
`;

export function FreeTrialPage() {
  const { signUp, signInWithProvider } = useAuth();
  const { navigate } = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [account, setAccount] = useState('');
  const [size, setSize] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Which social providers are actually enabled on the Supabase project. Null
  // until we've asked; a provider set to false is intercepted before redirect.
  const [providers, setProviders] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    let ok = true;
    fetch(`${SUPA_URL}/auth/v1/settings`, { headers: { apikey: anonKey } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (ok && d?.external) setProviders(d.external); })
      .catch(() => {});
    return () => { ok = false; };
  }, []);

  const notEnabledMsg = (id: string) =>
    `${PROVIDERS.find((p) => p.id === id)?.name} sign-in isn't enabled on this project yet. An admin can turn it on in Supabase → Authentication → Providers. For now, sign up with email below.`;

  async function onOAuth(id: string) {
    setError(null);
    // If we know the provider is off, show a clean message instead of sending
    // the browser to Supabase's raw error page.
    if (providers && providers[id] === false) { setError(notEnabledMsg(id)); return; }
    setOauthBusy(id);
    const res = await signInWithProvider(id as any);
    if (res.error) {
      setOauthBusy('');
      setError(/not enabled|Unsupported provider/i.test(res.error) ? notEnabledMsg(id) : res.error);
    }
    // On success the browser redirects to the provider; nothing more to do here.
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signUp(email, password, fullName, {
        account_name: account.trim(),
        company_size: size,
      });
      setBusy(false);
      if (res.error) {
        let msg = res.error;
        if (msg === 'EMAIL_CONFIRMATION_REQUIRED') { setDone(true); return; }
        if (/already registered|already exists/i.test(msg)) msg = 'An account with this email already exists. Try signing in instead.';
        else if (/password/i.test(msg)) msg = 'Password must be at least 6 characters.';
        else if (msg === '{}' || msg.length < 3) msg = 'Something went wrong. Please try again.';
        setError(msg);
      }
      // On success with confirmation disabled, the auth state change routes on.
    } catch (err: any) {
      setBusy(false);
      setError(err?.message || 'Unexpected error. Please try again.');
    }
  }

  return (
    <div className="ft-wrap"><style>{CSS}</style>
      {/* Left value panel */}
      <div className="ft-left">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 self-start" title="Back to home">
          <LightLogo />
        </button>
        <div style={{ marginTop: 'auto' }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.18, letterSpacing: '-.02em', maxWidth: 440 }}>
            One place to validate every release before it ships.
          </h1>
          <div className="ft-line" />
          <div className="ft-nodes">
            {BENEFITS.map((b) => (
              <div className="ft-benefit" key={b}>
                <span className="ck"><CheckCircle2 size={15} /></span>
                <p>{b}</p>
              </div>
            ))}
          </div>
          <svg className="ft-hook" width="150" height="132" viewBox="0 0 150 132" aria-hidden="true">
            <path d="M12 0 L12 44 C12 72 12 84 44 88 C78 92 76 112 76 132" />
          </svg>
        </div>
        <div style={{ marginTop: '26px', position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-.015em', color: '#eceafb', maxWidth: 340 }}>Ship on evidence, <span style={{ color: '#c4b5fd' }}>not on hope.</span></p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="ft-right">
        <div className="flex items-center justify-end gap-4 text-sm">
          <button onClick={() => navigate('/demo')} className="font-medium text-navy-500 hover:text-navy-800">Book a demo</button>
          <button onClick={() => navigate('/signin')} className="font-semibold text-brand-600 hover:text-brand-700">Sign in</button>
        </div>

        {done ? (
          <div className="ft-form text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 border border-green-200">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-navy-900">Check your email</h2>
            <p className="mt-2 text-sm text-gray-500">
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate <strong>{account || 'your workspace'}</strong> and start your trial.
            </p>
            <button onClick={() => navigate('/signin')} className="btn-primary w-full justify-center mt-6">Back to sign in</button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="ft-form">
            <div className="mb-1">
              <h2 className="text-2xl font-bold tracking-tight text-navy-900">Start your free trial</h2>
              <p className="mt-1.5 text-sm text-gray-500">No credit card required. Be validating in minutes.</p>
            </div>

            {/* Social sign-up */}
            <div className="ft-soc">
              {PROVIDERS.map((p) => {
                const off = providers && providers[p.id] === false;
                return (
                  <button type="button" key={p.id} disabled={!!oauthBusy}
                    onClick={() => onOAuth(p.id)}
                    title={off ? 'Not enabled on this project yet' : undefined}
                    className={`ft-sbtn ${p.border ? 'lt' : ''}`}
                    style={{ ...(p.border ? {} : { background: p.bg, color: p.fg }), ...(off ? { opacity: 0.5 } : {}) }}>
                    <span className="ico">
                      {oauthBusy === p.id ? <Spinner size={16} /> : (
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                          {p.multi
                            ? p.multi.map((m, i) => <path key={i} d={m.d} fill={m.f} />)
                            : <path d={p.svg} fill={p.fg} />}
                        </svg>
                      )}
                    </span>
                    Continue with {p.name}
                    {off && <span style={{ position: 'absolute', right: 14, fontSize: 11, fontWeight: 700, opacity: 0.8 }}>Soon</span>}
                  </button>
                );
              })}
            </div>

            <div className="ft-div">or sign up with email</div>

            <div className="ft-row2 mt-3">
              <div>
                <label className="label" htmlFor="ft-name">Full name</label>
                <input id="ft-name" className="input" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ada Lovelace" />
              </div>
              <div>
                <label className="label" htmlFor="ft-email">Work email</label>
                <input id="ft-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </div>
            </div>

            <div className="mt-3">
              <label className="label" htmlFor="ft-account">Account name</label>
              <input id="ft-account" className="input" type="text" required value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Acme Inc" />
              <p className="mt-1 text-xs text-gray-400">This becomes your team's workspace. You can change it later.</p>
            </div>

            <div className="ft-row2 mt-3">
              <div>
                <label className="label" htmlFor="ft-size">Company size</label>
                <select id="ft-size" className="input" required value={size} onChange={(e) => setSize(e.target.value)}>
                  <option value="" disabled>Select…</option>
                  {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ft-pw">Password</label>
                <div className="relative">
                  <input id="ft-pw" className="input pr-10" type={showPw ? 'text' : 'password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6+ characters" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-danger-600">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /><span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-2.5 justify-center mt-4" disabled={busy}>
              {busy ? <Spinner size={16} /> : null}
              Start free trial
              {!busy && <ArrowRight size={15} />}
            </button>

            <p className="mt-4 text-center text-xs text-gray-400">
              By starting a trial you agree to the{' '}
              <button type="button" onClick={() => navigate('/terms')} className="text-brand-600 underline">Terms</button> and{' '}
              <button type="button" onClick={() => navigate('/privacy')} className="text-brand-600 underline">Privacy Policy</button>.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default FreeTrialPage;
