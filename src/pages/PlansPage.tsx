import{useEffect,useState}from'react';
import{supabase,type WorkspacePlan,type PlanId,PLANS}from'../lib/supabase';
import{PageHeader,Spinner}from'../lib/ui';
import{Check,Loader as Loader2,Sparkles,Crown,Zap,Building2}from'lucide-react';

const FEATURES:Record<PlanId,string[]>={
free:['1 project','5 validations / month','Basic risk scoring','Community support'],
developer:['Unlimited projects','Unlimited validations','AI blast radius analysis','Deployment simulator','Slack & GitHub integrations','Email support'],
enterprise:['Everything in Developer','SSO / SAML','Custom compliance frameworks','Dedicated collector','Audit log export','Priority support & SLA'],
};
const ICONS:Record<PlanId,typeof Sparkles>={free:Sparkles,developer:Zap,enterprise:Crown};
const ORDER:PlanId[]=['free','developer','enterprise'];

export function PlansPage(){
const[loading,setLoading]=useState(true);
const[plan,setPlan]=useState<WorkspacePlan|null>(null);
const[upgrading,setUpgrading]=useState<PlanId|null>(null);

const wsId=()=>localStorage.getItem('sandbox.activeWs');

const load=async()=>{
  setLoading(true);
  const wid=wsId();
  if(!wid){setLoading(false);return;}
  const{data,error}=await supabase.from('workspace_plans').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(1);
  if(error)console.error('PlansPage load error:',error);
  setPlan(data?.[0]??null);
  setLoading(false);
};

useEffect(()=>{load();},[]);

const upgrade=async(planId:PlanId)=>{
  const wid=wsId();
  if(!wid)return;
  setUpgrading(planId);
  if(plan){
    const{error}=await supabase.from('workspace_plans').update({plan_id:planId,updated_at:new Date().toISOString()}).eq('id',plan.id);
    if(error){console.error(error);setUpgrading(null);return;}
    setPlan({...plan,plan_id:planId});
  }else{
    const{data,error}=await supabase.from('workspace_plans').insert({
      workspace_id:wid,plan_id:planId,status:'active',
    }).select().single();
    if(error){console.error(error);setUpgrading(null);return;}
    setPlan(data);
  }
  setUpgrading(null);
};

if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

const currentId=(plan?.plan_id as PlanId)??'free';

return<div>
<PageHeader title="Plans" description="Choose the plan that fits your team."/>
<div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
  <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5"/>
  <div className="text-sm text-amber-800">
    <strong>Early access pricing coming soon.</strong> Stripe billing will be enabled at launch. For now, contact us to discuss enterprise pricing.
  </div>
</div>

<div className="grid gap-6 lg:grid-cols-3">
{ORDER.map(id=>{
  const info=PLANS[id];
  const features=FEATURES[id];
  const Icon=ICONS[id];
  const isCurrent=id===currentId;
  const isEnterprise=id==='enterprise';
  return(
    <div key={id} className={`card flex flex-col ${isCurrent?'ring-2 ring-brand-500':isEnterprise?'border-navy-800':''}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${info.color}`}><Icon size={20}/></div>
        {isCurrent&&<span className="chip bg-brand-50 text-brand-700 border border-brand-200"><Check size={11}/>Current</span>}
      </div>
      <h2 className="text-lg font-bold text-navy-900">{info.name}</h2>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums text-navy-900">${info.price}</span>
        <span className="text-sm text-gray-500">/mo</span>
      </div>
      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((f,i)=>(
        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
        <Check size={15} className="mt-0.5 shrink-0 text-brand-600"/>{f}
        </li>
        ))}
      </ul>
      <button onClick={()=>upgrade(id)} disabled={isCurrent||upgrading!==null} className={`mt-6 w-full ${isCurrent?'btn-secondary cursor-default':isEnterprise?'bg-navy-800 text-white hover:bg-navy-700 rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98] inline-flex items-center justify-center gap-1.5 disabled:opacity-50':'btn-primary'}`}>
        {upgrading===id?<Loader2 size={16} className="animate-spin"/>:isCurrent?'Current plan':isEnterprise?<><Building2 size={16}/> Contact sales</>:<><Sparkles size={16}/> Upgrade</>}
      </button>
    </div>
  );
})}
</div>

<p className="mt-6 text-center text-xs text-gray-400">Prices in USD. Cancel anytime. Enterprise plans include custom onboarding.</p>
</div>;
}
