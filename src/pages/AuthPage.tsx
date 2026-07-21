import{useState,type FormEvent}from'react';
import{useAuth}from'../lib/auth';
import{useRouter}from'../lib/router';
import{Logo,Spinner}from'../lib/ui';
import{ShieldCheck,GitBranch,ScanLine,AlertTriangle,ArrowRight,CheckCircle2,Eye,EyeOff}from'lucide-react';

export function AuthPage({initialMode='signin'}:{initialMode?:'signin'|'signup'}={}){
  const{signIn,signUp,resetPassword,resendVerification}=useAuth();
  const{navigate}=useRouter();
  const[mode,setMode]=useState<'signin'|'signup'|'forgot'>(initialMode);
  const[resendState,setResendState]=useState<'idle'|'sending'|'sent'|'error'>('idle');
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[fullName,setFullName]=useState('');
  const[showPassword,setShowPassword]=useState(false);
  const[error,setError]=useState<string|null>(null);
  const[busy,setBusy]=useState(false);
  const[done,setDone]=useState(false);
  const[doneKind,setDoneKind]=useState<'signup'|'reset'>('signup');

  async function onSubmit(e:FormEvent){
    e.preventDefault();
    setError(null);
    setBusy(true);
    if(mode==='forgot'){
      const res=await resetPassword(email);
      setBusy(false);
      if(res.error){setError(res.error);return;}
      setDoneKind('reset');setDone(true);
      return;
    }
    try{
      const res=mode==='signin'?await signIn(email,password):await signUp(email,password,fullName);
      setBusy(false);
      if(res.error){
        let msg='Something went wrong. Please try again.';
        if(typeof res.error==='string') msg=res.error;
        else if(typeof res.error==='object'&&res.error!==null){
          msg=(res.error as any).message||(res.error as any).error_description||JSON.stringify(res.error);
        }
        if(msg==='EMAIL_CONFIRMATION_REQUIRED'){setDoneKind('signup');setDone(true);return;}
        if(msg.includes('Invalid login credentials')||msg.includes('invalid_credentials')) msg='Incorrect email or password. Please try again.';
        else if(msg.includes('already registered')||msg.includes('already exists')) msg='An account with this email already exists. Try signing in instead.';
        else if(msg.toLowerCase().includes('password')) msg='Password must be at least 6 characters.';
        else if(msg==='{}'||msg.length<3) msg='Authentication error. Please try again.';
        setError(msg);
      } else if(mode==='signup'){
        setDoneKind('signup');setDone(true);
      }
    }catch(err:any){
      setBusy(false);
      setError(err?.message||'Unexpected error. Please try again.');
    }
  }

  const switchMode=(m:'signin'|'signup'|'forgot')=>{setMode(m);setError(null);setDone(false);setPassword('');setFullName('');setResendState('idle');};

  async function onResend(){
    setResendState('sending');
    const res=await resendVerification(email);
    setResendState(res.error?'error':'sent');
  }

  return(
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button onClick={()=>navigate('/')} className="flex items-center gap-2" title="Back to home"><Logo size={28}/></button>
          <div className="text-sm text-gray-500">
            {mode==='signin'
              ?<>No account? <button onClick={()=>switchMode('signup')} className="font-semibold text-brand-600 hover:text-brand-700">Sign up free</button></>
              :<>Have an account? <button onClick={()=>switchMode('signin')} className="font-semibold text-brand-600 hover:text-brand-700">Sign in</button></>
            }
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-5xl grid gap-12 lg:grid-cols-2 lg:items-center">

          {/* Left: value prop */}
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
              <CheckCircle2 size={12}/> Pre-deployment intelligence platform
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-navy-900">
              Ship with confidence.<br/>
              <span className="text-brand-600">Every deployment.</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-gray-600 max-w-md">
              LytHouse scans your repositories before every deployment — surfacing security risks, vulnerable dependencies, and configuration issues so your team never ships broken code to production.
            </p>

            <div className="mt-8 space-y-4">
              {[
                {icon:<GitBranch size={16}/>,t:'Connect any Git repository',d:'GitHub, GitLab, Bitbucket — any branch, any folder.'},
                {icon:<ScanLine size={16}/>,t:'AI-powered pre-deployment scanning',d:'Secrets, CVEs, static analysis, and dependency audits in one run.'},
                {icon:<ShieldCheck size={16}/>,t:'Risk score before every deploy',d:'A single readiness verdict your team can act on immediately.'},
              ].map(f=>(
                <div key={f.t} className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 border border-brand-200 text-brand-600">{f.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{f.t}</p>
                    <p className="text-sm text-gray-500">{f.d}</p>
                  </div>
                </div>
              ))}
            </div>


          </div>

          {/* Right: form */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[400px]">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

                {done?(
                  <div className="text-center py-4">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 border border-green-200">
                      <CheckCircle2 size={28} className="text-green-600"/>
                    </div>
                    <h2 className="text-lg font-bold text-navy-900">Check your email</h2>
                    <p className="mt-2 text-sm text-gray-500">{doneKind==='reset'
                      ?<>We sent a password-reset link to <strong>{email}</strong>. Click it to choose a new password.</>
                      :<>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</>}</p>
                    {doneKind==='signup'&&(
                      <div className="mt-4">
                        <p className="text-xs text-gray-400">Didn't get it? Check spam, or resend below.</p>
                        {resendState==='sent'
                          ?<p className="mt-2 text-sm text-green-600 flex items-center justify-center gap-1.5"><CheckCircle2 size={14}/>Confirmation email resent.</p>
                          :<button onClick={onResend} disabled={resendState==='sending'} className="mt-2 btn-secondary w-full justify-center">
                            {resendState==='sending'?<Spinner size={14}/>:null}Resend confirmation email
                          </button>}
                        {resendState==='error'&&<p className="mt-2 text-xs text-danger-600">Couldn't resend just now — try again in a moment.</p>}
                      </div>
                    )}
                    <button onClick={()=>switchMode('signin')} className="mt-6 btn-primary w-full justify-center">Back to sign in</button>
                  </div>
                ):(
                  <>
                    <div className="mb-6">
                      <h2 className="text-xl font-bold text-navy-900">
                        {mode==='signin'?'Welcome back':mode==='forgot'?'Reset your password':'Create your account'}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {mode==='signin'?'Sign in to your LytHouse workspace.':mode==='forgot'?"Enter your email and we'll send you a reset link.":'Start catching deployment risks in minutes.'}
                      </p>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-4">
                      {mode==='signup'&&(
                        <div>
                          <label className="label" htmlFor="fullName">Full name</label>
                          <input id="fullName" className="input" type="text" required value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Ada Lovelace" autoFocus/>
                        </div>
                      )}
                      <div>
                        <label className="label" htmlFor="email">Work email</label>
                        <input id="email" className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" autoFocus={mode!=='signup'}/>
                      </div>
                      {mode!=='forgot'&&(
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="label mb-0" htmlFor="password">Password</label>
                          {mode==='signin'&&<button type="button" onClick={()=>switchMode('forgot')} className="text-xs text-brand-600 hover:underline">Forgot password?</button>}
                        </div>
                        <div className="relative">
                          <input id="password" className="input pr-10" type={showPassword?'text':'password'} required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='signup'?'At least 6 characters':'Your password'}/>
                          <button type="button" onClick={()=>setShowPassword(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showPassword?<EyeOff size={15}/>:<Eye size={15}/>}
                          </button>
                        </div>
                      </div>
                      )}

                      {error&&(
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-danger-600">
                          <AlertTriangle size={14} className="mt-0.5 shrink-0"/>
                          <span>{error}</span>
                        </div>
                      )}

                      <button type="submit" className="btn-primary w-full py-2.5 justify-center" disabled={busy}>
                        {busy?<Spinner size={16}/>:null}
                        {mode==='signin'?'Sign in':mode==='forgot'?'Send reset link':'Create account'}
                        {!busy&&<ArrowRight size={15}/>}
                      </button>
                      {mode==='forgot'&&<button type="button" onClick={()=>switchMode('signin')} className="text-xs text-brand-600 hover:underline block mx-auto">Back to sign in</button>}
                    </form>

                    {mode==='signup'&&(
                      <p className="mt-5 text-center text-xs text-gray-400">
                        By creating an account you agree to the <button type="button" onClick={()=>navigate('/terms')} className="text-brand-600 underline">Terms of Service</button> and <button type="button" onClick={()=>navigate('/privacy')} className="text-brand-600 underline">Privacy Policy</button>.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Social proof */}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
