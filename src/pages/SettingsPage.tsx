import{useEffect,useState}from'react';
import{supabase,type Workspace,type WorkspacePlan,type PlanId,PLANS}from'../lib/supabase';
import{PageHeader,Spinner}from'../lib/ui';
import{Settings,Save,Loader as Loader2,Check,User,Bell,Shield,Globe}from'lucide-react';

export function SettingsPage(){
const[loading,setLoading]=useState(true);
const[saving,setSaving]=useState(false);
const[saved,setSaved]=useState(false);
const[workspace,setWorkspace]=useState<Workspace|null>(null);
const[name,setName]=useState('');
const[desc,setDesc]=useState('');
const[plan,setPlan]=useState<WorkspacePlan|null>(null);
const[email,setEmail]=useState('');

const wsId=()=>localStorage.getItem('sandbox.activeWs');

const load=async()=>{
  setLoading(true);
  const wid=wsId();
  if(!wid){setLoading(false);return;}
  const[ws,pl]=await Promise.all([
    supabase.from('workspaces').select('*').eq('id',wid).single(),
    supabase.from('workspace_plans').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(1),
  ]);
  if(ws.error)console.error(ws.error);
  setWorkspace(ws.data??null);
  setName(ws.data?.name??'');
  setDesc(ws.data?.description??'');
  if(pl.data?.[0])setPlan(pl.data[0]);
  // Try to load user email from auth session
  supabase.auth.getSession().then(({data})=>{setEmail(data.session?.user?.email??'');});
  setLoading(false);
};

useEffect(()=>{load();},[]);

const save=async()=>{
  const wid=wsId();
  if(!wid||!workspace)return;
  setSaving(true);setSaved(false);
  const{error}=await supabase.from('workspaces').update({
    name:name.trim(),description:desc.trim()||null,
  }).eq('id',wid);
  if(error){console.error(error);setSaving(false);return;}
  setWorkspace({...workspace,name:name.trim(),description:desc.trim()||null});
  setSaving(false);setSaved(true);
  setTimeout(()=>setSaved(false),2500);
};

if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

const planId=(plan?.plan_id as PlanId)??'free';
const planInfo=PLANS[planId];

return<div>
<PageHeader title="Settings" description="Manage your workspace, profile, and preferences." actions={
<button onClick={save} disabled={saving||!name.trim()} className="btn-primary">{saving?<Loader2 size={16} className="animate-spin"/>:saved?<Check size={16}/>:<Save size={16}/>} {saved?'Saved':'Save changes'}</button>
}/>

<div className="grid gap-6 lg:grid-cols-2">
<div className="card">
<div className="mb-4 flex items-center gap-2"><Settings size={18} className="text-brand-600"/><h2 className="text-base font-semibold text-navy-900">Workspace</h2></div>
<label className="label">Workspace name</label>
<input className="input mb-4" value={name} onChange={e=>setName(e.target.value)} placeholder="My workspace"/>
<label className="label">Description</label>
<textarea className="input" rows={3} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What is this workspace for?"/>
{workspace&&<p className="mt-3 text-xs text-gray-400">Created {new Date(workspace.created_at).toLocaleDateString()} · slug: {workspace.slug}</p>}
</div>

<div className="space-y-6">
<div className="card">
<div className="mb-4 flex items-center gap-2"><User size={18} className="text-brand-600"/><h2 className="text-base font-semibold text-navy-900">Profile</h2></div>
<div className="space-y-3">
<div className="flex items-center justify-between"><span className="text-sm text-gray-500">Email</span><span className="text-sm font-medium text-navy-900">{email||'Not signed in'}</span></div>
<div className="flex items-center justify-between"><span className="text-sm text-gray-500">Role</span><span className="chip bg-brand-50 text-brand-700 border border-brand-200">Owner</span></div>
</div>
</div>

<div className="card">
<div className="mb-4 flex items-center gap-2"><Shield size={18} className="text-brand-600"/><h2 className="text-base font-semibold text-navy-900">Plan</h2></div>
<div className="flex items-center justify-between">
<span className={`chip border ${planInfo.badge}`}>{planInfo.name}</span>
<span className="text-sm text-gray-500">${planInfo.price}/mo</span>
</div>
<p className="mt-2 text-xs text-gray-500">Manage your plan on the <span className="font-medium text-brand-600">Plans</span> page.</p>
</div>
</div>

<div className="card lg:col-span-2">
<div className="mb-4 flex items-center gap-2"><Bell size={18} className="text-brand-600"/><h2 className="text-base font-semibold text-navy-900">Preferences</h2></div>
<div className="grid gap-4 sm:grid-cols-2">
<div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
<div><p className="text-sm font-medium text-navy-900">Email notifications</p><p className="mt-0.5 text-xs text-gray-500">Receive validation results and alerts via email.</p></div>
<span className="chip bg-brand-50 text-brand-700 border border-brand-200"><Check size={11}/>Enabled</span>
</div>
<div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
<div><p className="text-sm font-medium text-navy-900">Critical alerts</p><p className="mt-0.5 text-xs text-gray-500">Get notified immediately for critical findings.</p></div>
<span className="chip bg-brand-50 text-brand-700 border border-brand-200"><Check size={11}/>Enabled</span>
</div>
<div className="flex items-start justify-between gap-4">
<div><p className="text-sm font-medium text-navy-900">Weekly digest</p><p className="mt-0.5 text-xs text-gray-500">A summary of validation activity every Monday.</p></div>
<span className="chip bg-gray-100 text-gray-500 border border-gray-200">Disabled</span>
</div>
<div className="flex items-start justify-between gap-4">
<div><p className="text-sm font-medium text-navy-900">Timezone</p><p className="mt-0.5 text-xs text-gray-500">Used for scheduling and reporting.</p></div>
<span className="chip bg-gray-100 text-gray-600 border border-gray-200"><Globe size={11}/>UTC</span>
</div>
</div>
</div>
</div>
</div>;
}
