// @ts-nocheck
import{useEffect,useState}from'react';
import{supabase,edgeFunctionUrl,anonKey}from'../lib/supabase';
import{useAuth}from'../lib/auth';
import{PageHeader,Spinner,toast}from'../lib/ui';
import{User,Bell,Shield,Globe,Key,Palette,Save,Check,Loader as Loader2,Eye,EyeOff,AlertTriangle,Monitor,Moon,Sun,Camera,Upload,Download,Trash2}from'lucide-react';

type NotifPref={email_validations:boolean;email_critical:boolean;email_digest:boolean;email_deployments:boolean;};
type AppPref={theme:'light'|'dark'|'system';timezone:string;language:string;};

const TIMEZONES=['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Paris','Europe/Berlin','Asia/Tokyo','Asia/Singapore','Asia/Lagos','Africa/Johannesburg','Australia/Sydney'];
const LANGUAGES=['English','French','German','Spanish','Portuguese','Mandarin','Japanese'];

export function SettingsPage(){
  const{user,profile,refreshProfile}=useAuth();
  const[loading,setLoading]=useState(false);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState('');
  const[tab,setTab]=useState<'profile'|'notifications'|'security'|'appearance'>('profile');

  // Profile
  const[fullName,setFullName]=useState('');
  const[avatarUrl,setAvatarUrl]=useState('');
  const[uploadingAvatar,setUploadingAvatar]=useState(false);

  const uploadAvatar=async(file:File)=>{
    if(!user)return;
    if(file.size>2*1024*1024){toast('Image must be under 2MB.','error');return;}
    if(!file.type.startsWith('image/')){toast('Please upload an image file.','error');return;}
    setUploadingAvatar(true);
    try{
      const ext=file.name.split('.').pop();
      const path=`avatars/${user.id}.${ext}`;
      const{error:upErr}=await supabase.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type});
      if(upErr){
        // Storage bucket may not exist - use base64 fallback
        const reader=new FileReader();
        reader.onload=async(e)=>{
          const base64=e.target?.result as string;
          setAvatarUrl(base64);
          await supabase.from('profiles').update({avatar_url:base64}).eq('id',user.id);
          await refreshProfile();
          setUploadingAvatar(false);
        };
        reader.readAsDataURL(file);
        return;
      }
      const{data}=supabase.storage.from('avatars').getPublicUrl(path);
      const url=data.publicUrl+'?t='+Date.now();
      setAvatarUrl(url);
      await supabase.from('profiles').update({avatar_url:url}).eq('id',user.id);
      await refreshProfile();
    }catch(e){console.error(e);}
    setUploadingAvatar(false);
  };

  // Notifications
  const[notif,setNotif]=useState<NotifPref>({
    email_validations:true,email_critical:true,email_digest:false,email_deployments:true,
  });

  // Appearance
  const[appPref,setAppPref]=useState<AppPref>({theme:'light',timezone:'UTC',language:'English'});

  // Security
  const[currentPw,setCurrentPw]=useState('');
  const[newPw,setNewPw]=useState('');
  const[confirmPw,setConfirmPw]=useState('');
  const[showPw,setShowPw]=useState(false);
  const[pwError,setPwError]=useState('');
  const[pwSuccess,setPwSuccess]=useState(false);

  useEffect(()=>{
    if(profile){
      setFullName(profile.full_name||'');
      setAvatarUrl(profile.avatar_url||'');
    }
    // Load saved preferences from localStorage
    try{
      const saved=localStorage.getItem('lythouse.notif');
      if(saved)setNotif(JSON.parse(saved));
      const savedApp=localStorage.getItem('lythouse.appPref');
      if(savedApp){
        const parsed=JSON.parse(savedApp);
        setAppPref(parsed);
        // Apply saved theme immediately
        const root=document.documentElement;
        if(parsed.theme==='dark'){root.classList.add('dark');root.style.colorScheme='dark';}
        else if(parsed.theme==='light'){root.classList.remove('dark');root.style.colorScheme='light';}
        else{
          const prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
          if(prefersDark){root.classList.add('dark');root.style.colorScheme='dark';}
          else{root.classList.remove('dark');root.style.colorScheme='light';}
        }
      }
    }catch{}
  },[profile]);

  const saveProfile=async()=>{
    setSaving(true);setSaved('');
    await supabase.from('profiles').update({full_name:fullName.trim()||null,avatar_url:avatarUrl.trim()||null}).eq('id',user!.id);
    await refreshProfile();
    setSaving(false);setSaved('profile');
    setTimeout(()=>setSaved(''),2500);
  };

  const saveNotifications=()=>{
    localStorage.setItem('lythouse.notif',JSON.stringify(notif));
    setSaved('notif');
    setTimeout(()=>setSaved(''),2500);
  };

  const applyTheme=(theme:'light'|'dark'|'system')=>{
    const root=document.documentElement;
    const resolved:'light'|'dark' = theme==='system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')
      : theme;
    // Drive BOTH systems used across the app: the `.dark` class (page utilities)
    // and the `data-theme` attribute (the app-shell --lh tokens), plus persist to
    // `lh.theme` — the key the shell reads — so the switch sticks everywhere.
    root.classList.toggle('dark', resolved==='dark');
    root.setAttribute('data-theme', resolved);
    root.style.colorScheme=resolved;
    try{ localStorage.setItem('lh.theme', resolved); }catch{}
  };

  const saveAppearance=()=>{
    localStorage.setItem('lythouse.appPref',JSON.stringify(appPref));
    applyTheme(appPref.theme);
    setSaved('appearance');
    setTimeout(()=>setSaved(''),2500);
  };

  const setTheme=(theme:'light'|'dark'|'system')=>{
    setAppPref(p=>({...p,theme}));
    applyTheme(theme);
  };

  // Data export — gather everything this user can see and download it as JSON.
  const[exporting,setExporting]=useState(false);
  const exportData=async()=>{
    if(!user)return;
    setExporting(true);
    try{
      const wid=localStorage.getItem('sandbox.activeWs');
      const bundle:Record<string,unknown>={exported_at:new Date().toISOString(),account:{id:user.id,email:user.email,created_at:user.created_at}};
      const[{data:profileRow}]=await Promise.all([
        supabase.from('profiles').select('*').eq('id',user.id).maybeSingle(),
      ]);
      bundle.profile=profileRow;
      const{data:memberships}=await supabase.from('workspace_members').select('*').eq('user_id',user.id);
      bundle.memberships=memberships;
      if(wid){
        const[pr,va,fi,pl]=await Promise.all([
          supabase.from('projects').select('*').eq('workspace_id',wid),
          supabase.from('validations').select('*').eq('workspace_id',wid),
          supabase.from('findings').select('*').eq('workspace_id',wid),
          supabase.from('workspace_plans').select('*').eq('workspace_id',wid),
        ]);
        bundle.active_workspace={id:wid,projects:pr.data,validations:va.data,findings:fi.data,plan:pl.data};
      }
      const blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download=`lythouse-export-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    }catch(e){console.error(e);toast('Export failed. Please try again.','error');}
    setExporting(false);
  };

  // Account deletion — routed through the delete-account edge function.
  const[deleting,setDeleting]=useState(false);
  const deleteAccount=async()=>{
    if(!confirm('This permanently deletes your account and any workspaces you solely own. This cannot be undone. Continue?'))return;
    const typed=prompt('Type DELETE to confirm.');
    if(typed!=='DELETE')return;
    setDeleting(true);
    try{
      const{data:{session}}=await supabase.auth.getSession();
      const res=await fetch(`${edgeFunctionUrl}/delete-account`,{
        method:'POST',
        headers:{'Content-Type':'application/json',apikey:anonKey,Authorization:`Bearer ${session?.access_token??anonKey}`},
        body:JSON.stringify({confirm:'DELETE'}),
      });
      const json=await res.json().catch(()=>({}));
      if(!res.ok){toast(json.error||'Could not delete account.','error');setDeleting(false);return;}
      await supabase.auth.signOut();
      window.location.href='/';
    }catch(e:any){toast(e.message||'Could not delete account.','error');setDeleting(false);}
  };

  const changePassword=async()=>{
    setPwError('');setPwSuccess(false);
    if(newPw.length<6){setPwError('Password must be at least 6 characters.');return;}
    if(newPw!==confirmPw){setPwError('Passwords do not match.');return;}
    setSaving(true);
    const{error}=await supabase.auth.updateUser({password:newPw});
    setSaving(false);
    if(error){setPwError(error.message);return;}
    setPwSuccess(true);setCurrentPw('');setNewPw('');setConfirmPw('');
    setTimeout(()=>setPwSuccess(false),3000);
  };

  const TABS=[
    {id:'profile',label:'Profile',icon:User},
    {id:'notifications',label:'Notifications',icon:Bell},
    {id:'appearance',label:'Appearance',icon:Palette},
    {id:'security',label:'Security',icon:Shield},
  ];

  return<div>
    <PageHeader title="Account Settings" description="Manage your personal account, notifications, and security preferences."/>

    {/* Tabs */}
    <div className="mb-6 flex gap-1 border-b border-[#18181b] overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
      {TABS.map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id as any)} className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${tab===t.id?'tab-active':'tab-inactive'}`}>
          <t.icon size={15}/>{t.label}
        </button>
      ))}
    </div>

    {/* Profile tab */}
    {tab==='profile'&&(
      <div className="max-w-xl space-y-6">
        <div className="card">
          <h2 className="text-base font-semibold text-navy-900 mb-4 flex items-center gap-2"><User size={17} className="text-brand-600"/>Personal information</h2>

          {/* Avatar upload */}
          <div className="flex items-center gap-5 mb-5 pb-5 border-b border-gray-100">
            <div className="relative group shrink-0">
              {avatarUrl?(
                <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-full object-cover border-2 border-[#18181b]"/>
              ):(
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-3xl font-bold border-2 border-[#18181b]">
                  {(fullName||user?.email||'U').charAt(0).toUpperCase()}
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {uploadingAvatar?<Loader2 size={20} className="text-white animate-spin"/>:<Camera size={20} className="text-white"/>}
                <input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)uploadAvatar(f);}}/>
              </label>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy-900">{fullName||'No name set'}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-1">Member since {user?.created_at?new Date(user.created_at).toLocaleDateString():'—'}</p>
              <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline cursor-pointer font-medium">
                <Upload size={12}/>{uploadingAvatar?'Uploading…':'Upload photo'}
                <input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)uploadAvatar(f);}}/>
              </label>
              {avatarUrl&&<button onClick={async()=>{setAvatarUrl('');await supabase.from('profiles').update({avatar_url:null}).eq('id',user!.id);await refreshProfile();}} className="ml-3 text-xs text-gray-400 hover:text-danger-600">Remove</button>}
            </div>
          </div>

          <label className="label">Full name</label>
          <input className="input mb-4" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name"/>

          <label className="label">Email address</label>
          <input value={user?.email||''} disabled className="input mb-4 opacity-60 cursor-not-allowed"/>
          <p className="text-xs text-gray-400 mb-4">Email changes require verification. Contact support to update your email.</p>

          <label className="label">Job title <span className="text-gray-400 font-normal">(optional)</span></label>
          <input className="input mb-4" placeholder="e.g. Senior DevOps Engineer"/>

          <button onClick={saveProfile} disabled={saving} className="btn-primary">
            {saving?<Loader2 size={15} className="animate-spin"/>:saved==='profile'?<Check size={15}/>:<Save size={15}/>}
            {saved==='profile'?'Saved!':'Save profile'}
          </button>
        </div>

        {/* Account info */}
        <div className="card">
          <h2 className="text-base font-semibold text-navy-900 mb-4 flex items-center gap-2"><Key size={17} className="text-brand-600"/>Account details</h2>
          <div className="space-y-3">
            {[
              ['User ID',user?.id?.slice(0,8)+'…','font-mono text-xs'],
              ['Account created',user?.created_at?new Date(user.created_at).toLocaleDateString():'—',''],
              ['Email confirmed',user?.email_confirmed_at?'Yes':'No',''],
              ['Auth provider','Email / Password',''],
            ].map(([label,value,cls])=>(
              <div key={label as string} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={`text-sm font-medium text-navy-900 ${cls}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* Notifications tab */}
    {tab==='notifications'&&(
      <div className="max-w-xl space-y-6">
        <div className="card">
          <h2 className="text-base font-semibold text-navy-900 mb-1 flex items-center gap-2"><Bell size={17} className="text-brand-600"/>Email notifications</h2>
          <p className="text-xs text-gray-500 mb-5">Choose which events send you an email. Sent to {user?.email}.</p>
          <div className="space-y-4">
            {[
              {key:'email_validations',label:'Validation completed',desc:'Get notified when a validation scan finishes — pass or fail.'},
              {key:'email_critical',label:'Critical findings detected',desc:'Immediate alert when a critical security issue is found in any project.'},
              {key:'email_deployments',label:'Deployment cleared',desc:'Notify me when a project passes all checks and is cleared for deployment.'},
              {key:'email_digest',label:'Weekly digest',desc:'A Monday morning summary of all validation activity across your workspace.'},
            ].map(n=>(
              <div key={n.key} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-navy-900">{n.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.desc}</p>
                </div>
                <button onClick={()=>setNotif(p=>({...p,[n.key]:!p[n.key as keyof NotifPref]}))} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${notif[n.key as keyof NotifPref]?'bg-brand-600':'bg-gray-200'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${notif[n.key as keyof NotifPref]?'translate-x-5':'translate-x-0'}`}/>
                </button>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100">
            <button onClick={saveNotifications} className="btn-primary">
              {saved==='notif'?<><Check size={15}/>Saved!</>:<><Save size={15}/>Save preferences</>}
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-navy-900 mb-1 flex items-center gap-2"><Bell size={17} className="text-brand-600"/>In-app notifications</h2>
          <p className="text-xs text-gray-500 mb-4">These appear inside LytHouse while you're working.</p>
          <div className="space-y-3">
            {[
              ['Validation progress updates','Show live progress while a scan is running',true],
              ['Risk score changes','Alert when a project risk score changes significantly',true],
              ['Team member activity','Show when teammates run validations or resolve findings',false],
            ].map(([label,desc,on])=>(
              <div key={label as string} className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-navy-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <div className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent ${on?'bg-brand-600':'bg-gray-200'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${on?'translate-x-5':'translate-x-0'}`}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* Appearance tab */}
    {tab==='appearance'&&(
      <div className="max-w-xl space-y-6">
        <div className="card">
          <h2 className="text-base font-semibold text-navy-900 mb-4 flex items-center gap-2"><Palette size={17} className="text-brand-600"/>Theme</h2>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[{id:'light',label:'Light',icon:Sun},{id:'dark',label:'Dark',icon:Moon},{id:'system',label:'System',icon:Monitor}].map(t=>(
              <button key={t.id} onClick={()=>setTheme(t.id as any)} className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${appPref.theme===t.id?'border-brand-500 bg-brand-50':'border-[#18181b] hover:border-gray-300'}`}>
                <t.icon size={20} className={appPref.theme===t.id?'text-brand-600':'text-gray-400'}/>
                <span className={`text-sm font-medium ${appPref.theme===t.id?'text-brand-700':'text-gray-600'}`}>{t.label}</span>
              </button>
            ))}
          </div>

          <label className="label">Timezone</label>
          <select className="input mb-4" value={appPref.timezone} onChange={e=>setAppPref(p=>({...p,timezone:e.target.value}))}>
            {TIMEZONES.map(tz=><option key={tz}>{tz}</option>)}
          </select>

          <label className="label">Language</label>
          <select className="input mb-5" value={appPref.language} onChange={e=>setAppPref(p=>({...p,language:e.target.value}))}>
            {LANGUAGES.map(l=><option key={l}>{l}</option>)}
          </select>

          <button onClick={saveAppearance} className="btn-primary">
            {saved==='appearance'?<><Check size={15}/>Saved!</>:<><Save size={15}/>Save preferences</>}
          </button>
        </div>
      </div>
    )}

    {/* Security tab */}
    {tab==='security'&&(
      <div className="max-w-xl space-y-6">
        <div className="card">
          <h2 className="text-base font-semibold text-navy-900 mb-1 flex items-center gap-2"><Key size={17} className="text-brand-600"/>Change password</h2>
          <p className="text-xs text-gray-500 mb-5">Use a strong password of at least 8 characters.</p>

          {pwError&&<div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-danger-600"><AlertTriangle size={14}/>{pwError}</div>}
          {pwSuccess&&<div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700"><Check size={14}/>Password updated successfully.</div>}

          <label className="label">New password</label>
          <div className="relative mb-3">
            <input className="input pr-10" type={showPw?'text':'password'} value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="At least 6 characters"/>
            <button type="button" onClick={()=>setShowPw(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
            </button>
          </div>

          <label className="label">Confirm new password</label>
          <input className="input mb-5" type={showPw?'text':'password'} value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} placeholder="Repeat new password"/>

          <button onClick={changePassword} disabled={saving||!newPw||!confirmPw} className="btn-primary">
            {saving?<Loader2 size={15} className="animate-spin"/>:<Shield size={15}/>}Update password
          </button>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-navy-900 mb-1 flex items-center gap-2"><Shield size={17} className="text-brand-600"/>Active sessions</h2>
          <p className="text-xs text-gray-500 mb-4">Devices currently signed in to your account.</p>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Monitor size={18} className="text-gray-400"/>
              <div>
                <p className="text-sm font-medium text-navy-900">Current session</p>
                <p className="text-xs text-gray-500">Browser · {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            <span className="chip bg-green-50 text-green-700 border border-green-200">Active</span>
          </div>
          <button onClick={async()=>{await supabase.auth.signOut();}} className="mt-4 text-sm text-danger-600 hover:underline">Sign out of all sessions</button>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-navy-900 mb-1 flex items-center gap-2"><Download size={17} className="text-brand-600"/>Export your data</h2>
          <p className="text-xs text-gray-500 mb-4">Download a JSON copy of your profile, memberships, and your active workspace's projects, validations, and findings.</p>
          <button onClick={exportData} disabled={exporting} className="btn-secondary">
            {exporting?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>}{exporting?'Preparing…':'Download my data'}
          </button>
        </div>

        <div className="card border-red-100">
          <h2 className="text-sm font-semibold text-danger-600 mb-1 flex items-center gap-2"><AlertTriangle size={15}/>Danger Zone</h2>
          <p className="text-xs text-gray-500 mb-3">Permanently delete your account and any workspaces you solely own. This cannot be undone. If you own a workspace with other members, transfer or remove them first.</p>
          <button onClick={deleteAccount} disabled={deleting} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-danger-600 border border-red-200 rounded-lg bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50">
            {deleting?<Loader2 size={15} className="animate-spin"/>:<Trash2 size={15}/>}Delete account
          </button>
        </div>
      </div>
    )}
  </div>;
}
