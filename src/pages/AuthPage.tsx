import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { Logo, Spinner } from '../lib/ui';
import { ShieldCheck, GitBranch, ScanLine, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = mode === 'signin' ? await signIn(email, password) : await signUp(email, password, fullName);
    setBusy(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <header className="border-b border-gray-150">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo size={26} />
          <div className="text-sm text-gray-500">
            {mode === 'signin' ? (
              <>Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(null); }} className="font-semibold text-brand-600 hover:text-brand-700">Sign up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('signin'); setError(null); }} className="font-semibold text-brand-600 hover:text-brand-700">Sign in</button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-12 lg:grid-cols-2 lg:py-20">
        {/* Left: value prop */}
        <div className="flex flex-col justify-center">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700">
            <CheckCircle2 size={13} /> Pre-deployment validation engine
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-navy-900">
            Catch risks before<br />they reach production.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-gray-600">
            Sandbox.ai scans your code and configuration before every deployment —
            surfacing risk scores, severity flags, and fix recommendations so your
            team ships with confidence.
          </p>
          <div className="mt-10 space-y-4">
            {[
              { icon: <GitBranch size={16} />, t: 'Connect any git repository', d: 'GitHub, GitLab, Bitbucket — any branch, any folder.' },
              { icon: <ScanLine size={16} />, t: 'AI pre-deployment analysis', d: 'Security, performance, config, and dependency checks.' },
              { icon: <ShieldCheck size={16} />, t: 'Risk score per validation', d: 'A single number your CTO can trust before approve.' },
            ].map((f) => (
              <div key={f.t} className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 border border-brand-200 text-brand-600">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy-900">{f.t}</p>
                  <p className="text-sm text-gray-500">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex items-center gap-4 text-xs font-medium text-gray-400">
            <span>SOC 2 Type II</span>
            <span className="h-3 w-px bg-gray-200" />
            <span>GDPR Ready</span>
            <span className="h-3 w-px bg-gray-200" />
            <span>99.9% Uptime</span>
          </div>
        </div>

        {/* Right: form */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-[400px] animate-fade-in">
            <div className="card p-8 shadow-pop">
              <h2 className="text-xl font-bold tracking-tight text-navy-900">
                {mode === 'signin' ? 'Sign in' : 'Create your account'}
              </h2>
              <p className="mt-1.5 text-sm text-gray-500">
                {mode === 'signin' ? 'Welcome back to Sandbox.' : 'Start validating deployments in minutes.'}
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="label" htmlFor="fullName">Full name</label>
                    <input id="fullName" className="input" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ada Lovelace" autoFocus />
                  </div>
                )}
                <div>
                  <label className="label" htmlFor="email">Work email</label>
                  <input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoFocus={mode === 'signin'} />
                </div>
                <div>
                  <label className="label" htmlFor="password">Password</label>
                  <input id="password" className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-danger-600 animate-fade-in-fast">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" className="btn-primary w-full py-3 text-sm" disabled={busy}>
                  {busy ? <Spinner size={16} /> : null}
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                  {!busy && <ArrowRight size={15} className="opacity-80" />}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-gray-400">
                By continuing you agree to the Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
