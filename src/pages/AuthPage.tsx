import{useState,type FormEvent}from'react';
import{useAuth}from'../lib/auth';
import{useRouter}from'../lib/router';
import{Spinner}from'../lib/ui';
import{ShieldCheck,GitBranch,ScanLine,AlertTriangle,ArrowRight,CheckCircle2,Eye,EyeOff}from'lucide-react';

// Light logo for the dark value panel (the shared Logo wordmark is dark ink).
function LightLogo(){
  return(
    <span className="flex items-center gap-2.5 select-none">
      <span className="flex items-center justify-center rounded-xl" style={{width:30,height:30,background:'#7c5ce6'}}>
        <ShieldCheck size={17} strokeWidth={2.4} color="#fff"/>
      </span>
      <span style={{fontSize:18,fontWeight:700,letterSpacing:'-.02em',color:'#f4f5f8'}}>Lyt<span style={{color:'#c4b5fd'}}>House</span></span>
    </span>
  );
}

const FEATURES=[
  {Icon:GitBranch,t:'Connect any Git repository',d:'GitHub, GitLab, Bitbucket — any branch, any folder.'},
  {Icon:ScanLine,t:'AI-powered pre-deployment scanning',d:'Secrets, CVEs, static analysis, and dependency audits in one run.'},
  {Icon:ShieldCheck,t:'Risk score before every deploy',d:'A single readiness verdict your team can act on immediately.'},
];

const CSS=`
.au-wrap{min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);background:#ffffff}
@media(max-width:900px){.au-wrap{grid-template-columns:1fr}.au-left{display:none!important}}
.au-left{position:relative;overflow:hidden;background:radial-gradient(85% 75% at 8% 58%,rgba(124,92,230,.38),transparent 60%),linear-gradient(158deg,#2a2142 0%,#1c1730 55%,#171325 100%);color:#eeecf6;padding:48px 52px;display:flex;flex-direction:column}
.au-left::after{content:'';position:absolute;left:-20%;bottom:-24%;width:72%;height:72%;background:radial-gradient(circle,rgba(150,110,255,.4),transparent 62%);filter:blur(70px)}
.au-badge{position:relative;z-index:1;display:inline-flex;align-items:center;gap:7px;align-self:flex-start;border:1px solid rgba(196,181,253,.4);background:rgba(124,92,230,.16);color:#dcd0ff;border-radius:20px;padding:6px 12px;font-size:12px;font-weight:600}
.au-h{font-size:34px;font-weight:700;line-height:1.12;letter-spacing:-.02em;margin-top:16px;max-width:440px}
.au-line{width:1.5px;background:linear-gradient(rgba(196,181,253,.5),rgba(196,181,253,.25));margin:26px 0 6px 12px;height:40px;border-radius:2px}
.au-nodes{position:relative;display:flex;flex-direction:column;gap:32px;margin-top:8px}
.au-nodes::before{content:'';position:absolute;left:13px;top:14px;bottom:0;width:1.5px;background:linear-gradient(rgba(196,181,253,.42),rgba(196,181,253,.22));border-radius:2px}
.au-node{display:flex;gap:16px;align-items:flex-start;position:relative;z-index:1;max-width:440px}
.au-node .ic{position:relative;z-index:1;flex:0 0 auto;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:#a7f3d0;border:2px solid transparent;background:linear-gradient(#1b1526,#1b1526) padding-box,linear-gradient(135deg,#34d399 0%,#7c5ce6 100%) border-box}
.au-node .t{font-size:15.5px;font-weight:600;color:#f4f5f8}
.au-node .d{font-size:14px;color:#d6d2e6;margin-top:3px;line-height:1.6}
.au-hook{display:block;margin-top:-2px;overflow:visible}
.au-hook path{stroke:rgba(196,181,253,.32);stroke-width:1.5;fill:none;stroke-linecap:round}
.au-right{display:flex;flex-direction:column;padding:26px 28px;overflow-y:auto}
.au-form{width:100%;max-width:400px;margin:auto}
`;

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
    <div className="au-wrap"><style>{CSS}</style>
      {/* Left value panel — black + purple */}
      <div className="au-left">
        <button onClick={()=>navigate('/')} className="flex items-center gap-2 self-start" title="Back to home"><LightLogo/></button>
        <div style={{marginTop:'auto'}}>
          <span className="au-badge"><CheckCircle2 size={12}/>Pre-deployment intelligence platform</span>
          <h1 className="au-h">Ship with confidence.<br/><span style={{color:'#c4b5fd'}}>Every deployment.</span></h1>
          <div className="au-line"/>
          <div className="au-nodes">
            {FEATURES.map(f=>(
              <div className="au-node" key={f.t}>
                <span className="ic"><f.Icon size={13}/></span>
                <div><div className="t">{f.t}</div><div className="d">{f.d}</div></div>
              </div>
            ))}
          </div>
          <svg className="au-hook" width="150" height="132" viewBox="0 0 150 132" aria-hidden="true">
            <path d="M12 0 L12 44 C12 72 12 84 44 88 C78 92 76 112 76 132"/>
          </svg>
        </div>
        <div style={{marginTop:'26px',position:'relative',zIndex:1}}><p style={{fontSize:20,fontWeight:600,lineHeight:1.3,letterSpacing:'-.015em',color:'#eceafb',maxWidth:340}}>Ship on evidence, <span style={{color:'#c4b5fd'}}>not on hope.</span></p></div>
      </div>

      {/* Right form panel */}
      <div className="au-right">
        <div className="flex items-center justify-end text-sm text-gray-500">
          {mode==='signin'
            ?<span>No account?{' '}<button onClick={()=>switchMode('signup')} className="font-semibold text-brand-600 hover:text-brand-700">Sign up free</button></span>
            :<span>Have an account?{' '}<button onClick={()=>switchMode('signin')} className="font-semibold text-brand-600 hover:text-brand-700">Sign in</button></span>
          }
        </div>

        {done?(
          <div className="au-form text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 border border-green-200">
              <CheckCircle2 size={28} className="text-green-600"/>
            </div>
            <h2 className="text-xl font-bold text-navy-900">Check your email</h2>
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
          <div className="au-form">
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-navy-900">
                {mode==='signin'?'Welcome back':mode==='forgot'?'Reset your password':'Create your account'}
              </h2>
              <p className="mt-1.5 text-sm text-gray-500">
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
          </div>
        )}
      </div>
    </div>
  );
}
