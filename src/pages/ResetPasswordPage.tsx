// @ts-nocheck
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useRouter } from '../lib/router';
import { Logo, Spinner } from '../lib/ui';
import { Lock, Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const { navigate } = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) {
      setError(/session|expired|token/i.test(error) ? 'This reset link has expired or was already used. Request a new one from the sign-in page.' : error);
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-[#71717a]">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <button onClick={() => navigate('/')} title="Home"><Logo size={28} /></button>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#71717a] bg-white p-8 shadow-soft">
          {done ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><CheckCircle2 size={24} /></div>
              <h1 className="text-lg font-bold text-navy-900">Password updated</h1>
              <p className="text-sm text-gray-500 mt-1">Your password has been changed. You can now sign in with it.</p>
              <button onClick={() => navigate('/signin')} className="btn-primary text-sm mt-5 mx-auto">Go to sign in<ArrowRight size={15} /></button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold text-navy-900">Set a new password</h1>
              <p className="text-sm text-gray-500 mt-1">Choose a new password for your LytHouse account.</p>
              <form onSubmit={submit} className="mt-5 space-y-3">
                <div>
                  <label className="label">New password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-9 pr-10" placeholder="At least 8 characters" autoFocus />
                    <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>
                </div>
                <div>
                  <label className="label">Confirm password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input pl-9" placeholder="Re-enter password" />
                  </div>
                </div>
                {error && <p className="text-sm text-[#dc2626]">{error}</p>}
                <button type="submit" disabled={busy} className="btn-primary text-sm w-full justify-center">{busy ? <Spinner size={15} /> : 'Update password'}</button>
              </form>
              <button onClick={() => navigate('/signin')} className="text-xs text-brand-600 hover:underline mt-4 block mx-auto">Back to sign in</button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
export default ResetPasswordPage;
