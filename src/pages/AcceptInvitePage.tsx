import{useEffect,useState,useCallback}from'react';
import{supabase}from'../lib/supabase';
import{useAuth}from'../lib/auth';
import{useRouter}from'../lib/router';
import{Logo,Spinner}from'../lib/ui';
import{ROLE_LABEL,type Role}from'../lib/roles';
import{CheckCircle2,AlertTriangle,UserPlus,LogIn}from'lucide-react';

const PENDING_KEY='lh.pendingInvite';

type InviteInfo={workspace_name:string;role:Role;email:string}|null;

export function AcceptInvitePage({token}:{token:string}){
  const{session,user}=useAuth();
  const{navigate}=useRouter();
  const[status,setStatus]=useState<'loading'|'need-auth'|'accepting'|'done'|'error'>('loading');
  const[error,setError]=useState('');
  const[info,setInfo]=useState<InviteInfo>(null);

  // Stash the token so we can resume after the user signs in.
  useEffect(()=>{try{localStorage.setItem(PENDING_KEY,token);}catch{/* ignore */}},[token]);

  const accept=useCallback(async()=>{
    setStatus('accepting');
    const{data,error:rpcErr}=await supabase.rpc('accept_invitation',{invite_token:token});
    if(rpcErr){setError(rpcErr.message||'Could not accept the invitation.');setStatus('error');return;}
    try{localStorage.removeItem(PENDING_KEY);}catch{/* ignore */}
    if(data)localStorage.setItem('sandbox.activeWs',data as string);
    setStatus('done');
    setTimeout(()=>navigate('/dashboard'),1500);
  },[token,navigate]);

  useEffect(()=>{
    if(!session){setStatus('need-auth');return;}
    // Look up a friendly summary (RLS lets the invitee read their own invite).
    (async()=>{
      const{data}=await supabase.from('workspace_invitations')
        .select('email,role,workspace_id,status,workspaces(name)')
        .eq('token',token).maybeSingle();
      if(data){
        setInfo({workspace_name:(data as any).workspaces?.name??'this workspace',role:data.role as Role,email:data.email});
      }
      accept();
    })();
  },[session,token,accept]);

  const goAuth=(mode:'signin'|'signup')=>navigate(mode==='signup'?'/signup':'/signin');

  return(
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button onClick={()=>navigate('/')} className="flex items-center gap-2"><Logo size={28}/></button>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          {status==='loading'&&<div className="py-8"><Spinner size={28}/></div>}

          {status==='need-auth'&&(
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 border border-brand-200"><UserPlus size={26} className="text-brand-600"/></div>
              <h1 className="text-lg font-bold text-navy-900">You've been invited to LytHouse</h1>
              <p className="mt-2 text-sm text-gray-500">Sign in or create an account with the email your invitation was sent to, and you'll join the workspace automatically.</p>
              <div className="mt-6 flex flex-col gap-2">
                <button onClick={()=>goAuth('signup')} className="btn-primary w-full justify-center"><UserPlus size={15}/>Create account</button>
                <button onClick={()=>goAuth('signin')} className="btn-secondary w-full justify-center"><LogIn size={15}/>I already have an account</button>
              </div>
            </>
          )}

          {status==='accepting'&&(
            <div className="py-6">
              <Spinner size={28}/>
              <p className="mt-3 text-sm text-gray-500">Joining {info?.workspace_name??'the workspace'}…</p>
            </div>
          )}

          {status==='done'&&(
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 border border-green-200"><CheckCircle2 size={28} className="text-green-600"/></div>
              <h1 className="text-lg font-bold text-navy-900">You're in!</h1>
              <p className="mt-2 text-sm text-gray-500">
                You joined {info?.workspace_name??'the workspace'}{info?` as ${ROLE_LABEL[info.role]}`:''}. Taking you to your dashboard…
              </p>
            </>
          )}

          {status==='error'&&(
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-200"><AlertTriangle size={26} className="text-danger-600"/></div>
              <h1 className="text-lg font-bold text-navy-900">Couldn't accept this invitation</h1>
              <p className="mt-2 text-sm text-gray-500">{error}</p>
              {user?.email&&<p className="mt-1 text-xs text-gray-400">You're signed in as {user.email}.</p>}
              <button onClick={()=>navigate('/dashboard')} className="mt-6 btn-secondary w-full justify-center">Go to dashboard</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Read + clear a stashed invite token (used to resume acceptance after login). */
export function takePendingInvite():string|null{
  try{const t=localStorage.getItem(PENDING_KEY);return t;}catch{return null;}
}
