import{useEffect,useState}from'react';
import{supabase,type DeploymentPolicy}from'../lib/supabase';
import{PageHeader,Spinner}from'../lib/ui';
import{Shield,Save,Loader as Loader2,Check}from'lucide-react';

const DEFAULTS:Omit<DeploymentPolicy,'id'|'workspace_id'|'updated_by'|'updated_at'>={
max_risk_score:60,block_critical:true,block_high:true,require_approval:false,auto_deploy_on_pass:false,cooldown_minutes:30,
};

export function PolicyPage(){
const[loading,setLoading]=useState(true);
const[saving,setSaving]=useState(false);
const[policy,setPolicy]=useState<DeploymentPolicy|null>(null);
const[saved,setSaved]=useState(false);
const[form,setForm]=useState({...DEFAULTS});

const wsId=()=>localStorage.getItem('sandbox.activeWs');

const load=async()=>{
  setLoading(true);
  const wid=wsId();
  if(!wid){setLoading(false);return;}
  const{data,error}=await supabase.from('deployment_policy').select('*').eq('workspace_id',wid).order('updated_at',{ascending:false}).limit(1);
  if(error)console.error('PolicyPage load error:',error);
  const p=data?.[0]??null;
  setPolicy(p);
  if(p)setForm({max_risk_score:p.max_risk_score,block_critical:p.block_critical,block_high:p.block_high,require_approval:p.require_approval,auto_deploy_on_pass:p.auto_deploy_on_pass,cooldown_minutes:p.cooldown_minutes});
  setLoading(false);
};

useEffect(()=>{load();},[]);

const save=async()=>{
  const wid=wsId();
  if(!wid)return;
  setSaving(true);setSaved(false);
  if(policy){
    const{error}=await supabase.from('deployment_policy').update({
      max_risk_score:form.max_risk_score,block_critical:form.block_critical,block_high:form.block_high,
      require_approval:form.require_approval,auto_deploy_on_pass:form.auto_deploy_on_pass,cooldown_minutes:form.cooldown_minutes,
      updated_at:new Date().toISOString(),
    }).eq('id',policy.id);
    if(error){console.error(error);setSaving(false);return;}
  }else{
    const{data,error}=await supabase.from('deployment_policy').insert({
      workspace_id:wid,...form,
    }).select().single();
    if(error){console.error(error);setSaving(false);return;}
    setPolicy(data);
  }
  setSaving(false);setSaved(true);
  setTimeout(()=>setSaved(false),2500);
};

if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

const Toggle=({label,desc,checked,onChange}:{label:string;desc:string;checked:boolean;onChange:(v:boolean)=>void})=>(
<div className="flex items-start justify-between gap-4 border-b border-gray-100 py-4 last:border-0">
<div><p className="text-sm font-medium text-navy-900">{label}</p><p className="mt-0.5 text-xs text-gray-500">{desc}</p></div>
<button onClick={()=>onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked?'bg-brand-600':'bg-gray-200'}`}>
<span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked?'translate-x-5':'translate-x-0.5'}`}/>
</button>
</div>
);

return<div>
<PageHeader title="Deployment Policies" description="Control how deployments are gated by risk and approval rules." actions={
<button onClick={save} disabled={saving} className="btn-primary">{saving?<Loader2 size={16} className="animate-spin"/>:saved?<Check size={16}/>:<Save size={16}/>} {saved?'Saved':'Save'}</button>
}/>

<div className="grid gap-6 lg:grid-cols-3">
<div className="card lg:col-span-2">
<div className="mb-4 flex items-center gap-2"><Shield size={18} className="text-brand-600"/><h2 className="text-base font-semibold text-navy-900">Risk Gates</h2></div>
<label className="label">Max Risk Score (0–100)</label>
<input type="number" min={0} max={100} className="input mb-1" value={form.max_risk_score} onChange={e=>setForm(f=>({...f,max_risk_score:Math.max(0,Math.min(100,Number(e.target.value)||0))}))}/>
<p className="mb-4 text-xs text-gray-500">Deployments with a risk score above this threshold will be blocked.</p>
<Toggle label="Block Critical findings" desc="Block deployments when critical-severity findings are present." checked={form.block_critical} onChange={v=>setForm(f=>({...f,block_critical:v}))}/>
<Toggle label="Block High findings" desc="Block deployments when high-severity findings are present." checked={form.block_high} onChange={v=>setForm(f=>({...f,block_high:v}))}/>
<Toggle label="Require manual approval" desc="Require a human to approve every deployment before it proceeds." checked={form.require_approval} onChange={v=>setForm(f=>({...f,require_approval:v}))}/>
<Toggle label="Auto-deploy on pass" desc="Automatically deploy when a validation passes all gates." checked={form.auto_deploy_on_pass} onChange={v=>setForm(f=>({...f,auto_deploy_on_pass:v}))}/>
<label className="label mt-4">Cooldown (minutes)</label>
<input type="number" min={0} className="input" value={form.cooldown_minutes} onChange={e=>setForm(f=>({...f,cooldown_minutes:Math.max(0,Number(e.target.value)||0)}))}/>
<p className="mt-1 text-xs text-gray-500">Minimum time between deployments to the same environment.</p>
</div>

<div className="card">
<h2 className="text-base font-semibold text-navy-900">Summary</h2>
<p className="mt-2 text-sm text-gray-500">These rules apply to every deployment in this workspace.</p>
<div className="mt-4 space-y-2 text-sm">
<div className="flex justify-between"><span className="text-gray-500">Max risk score</span><span className="font-semibold text-navy-900">{form.max_risk_score}</span></div>
<div className="flex justify-between"><span className="text-gray-500">Block critical</span><span className={`font-semibold ${form.block_critical?'text-danger-600':'text-gray-400'}`}>{form.block_critical?'Yes':'No'}</span></div>
<div className="flex justify-between"><span className="text-gray-500">Block high</span><span className={`font-semibold ${form.block_high?'text-amber-600':'text-gray-400'}`}>{form.block_high?'Yes':'No'}</span></div>
<div className="flex justify-between"><span className="text-gray-500">Require approval</span><span className={`font-semibold ${form.require_approval?'text-brand-700':'text-gray-400'}`}>{form.require_approval?'Yes':'No'}</span></div>
<div className="flex justify-between"><span className="text-gray-500">Auto-deploy</span><span className={`font-semibold ${form.auto_deploy_on_pass?'text-brand-700':'text-gray-400'}`}>{form.auto_deploy_on_pass?'Yes':'No'}</span></div>
<div className="flex justify-between"><span className="text-gray-500">Cooldown</span><span className="font-semibold text-navy-900">{form.cooldown_minutes} min</span></div>
</div>
</div>
</div>
</div>;
}
