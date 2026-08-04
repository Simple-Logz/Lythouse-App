import{useEffect,useState}from'react';
import{supabase,type WorkspacePlan,type PlanId,PLANS}from'../lib/supabase';
import{PageHeader,Spinner}from'../lib/ui';
import{useRole}from'../lib/useRole';
import{startCheckout,openBillingPortal,isSelfServe}from'../lib/billing';
import{Check,Loader as Loader2,Sparkles,Crown,Zap,Building2,CreditCard,AlertTriangle}from'lucide-react';

const FEATURES:Record<PlanId,string[]>={
free:['1 project','5 validations / month','Basic risk scoring','Community support'],
developer:['Unlimited projects','Unlimited validations','AI blast radius analysis','Deployment simulator','Slack & GitHub integrations','Email support'],
enterprise:['Everything in Developer','SSO / SAML','Custom compliance frameworks','Dedicated collector','Audit log export','Priority support & SLA'],
};
const ICONS:Record<PlanId,typeof Sparkles>={free:Sparkles,developer:Zap,enterprise:Crown};
const ORDER:PlanId[]=['free','developer','enterprise'];

export function PlansPage(){
const perms=useRole();
const canManage=perms.can('billing.manage');
const[loading,setLoading]=useState(true);
const[plan,setPlan]=useState<WorkspacePlan|null>(null);
const[busy,setBusy]=useState<PlanId|'portal'|null>(null);
const[error,setError]=useState('');
const[notice,setNotice]=useState('');
const[hover,setHover]=useState<PlanId|null>(null);

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

useEffect(()=>{load();
  const params=new URLSearchParams(window.location.search);
  const c=params.get('checkout');
  if(c==='success')setNotice('Payment received — your plan will update momentarily.');
  else if(c==='cancelled')setNotice('Checkout cancelled. No changes were made.');
},[]);

const choose=async(planId:PlanId)=>{
  const wid=wsId();
  if(!wid)return;
  setError('');
  if(!canManage){setError('Only workspace owners and admins can change billing.');return;}
  try{
    if(planId==='enterprise'&&!isSelfServe('enterprise')){
      window.location.href='mailto:sales@lythouse.ai?subject=LytHouse%20Enterprise';
      return;
    }
    setBusy(planId);
    const url=await startCheckout(planId,wid);
    window.location.href=url;
  }catch(e:any){
    setError(e.message||'Could not start checkout.');
    setBusy(null);
  }
};

const manageBilling=async()=>{
  const wid=wsId();
  if(!wid)return;
  setError('');
  try{
    setBusy('portal');
    const url=await openBillingPortal(wid);
    window.location.href=url;
  }catch(e:any){
    setError(e.message||'Could not open the billing portal.');
    setBusy(null);
  }
};

if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

const currentId=(plan?.plan_id as PlanId)??'free';
const hasSubscription=!!plan?.stripe_subscription_id;

return<div>
<PageHeader title="Plans" description="Choose the plan that fits your team."
  actions={hasSubscription&&canManage?(
    <button onClick={manageBilling} disabled={busy!==null} className="btn-secondary">
      {busy==='portal'?<Loader2 size={15} className="animate-spin"/>:<CreditCard size={15}/>}Manage billing
    </button>
  ):null}
/>

{notice&&(
  <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
    <Sparkles size={16}/>{notice}
  </div>
)}
{error&&(
  <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger-600">
    <AlertTriangle size={16}/>{error}
  </div>
)}
{!canManage&&wsId()&&(
  <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#18181b] bg-gray-50 px-4 py-3">
    <AlertTriangle size={16} className="text-gray-400 shrink-0 mt-0.5"/>
    <div className="text-sm text-gray-600">You're viewing plans in read-only mode. Only workspace owners and admins can change billing.</div>
  </div>
)}
{plan?.cancel_at_period_end&&(
  <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5"/>
    <div className="text-sm text-amber-800">Your subscription is set to cancel{plan.current_period_end?` on ${new Date(plan.current_period_end).toLocaleDateString()}`:' at the end of the current period'}. Reactivate anytime from Manage billing.</div>
  </div>
)}

<div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
{ORDER.map(id=>{
  const info=PLANS[id];
  const features=FEATURES[id];
  const Icon=ICONS[id];
  const isCurrent=id===currentId;
  const isEnterprise=id==='enterprise';
  const isFree=id==='free';
  const dark=hover===id; // the hovered card goes black + purple; the rest stay light
  return(
    <div key={id}
      onMouseEnter={()=>setHover(id)} onMouseLeave={()=>setHover(null)}
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-200 ${dark?'text-white -translate-y-1':`bg-white text-navy-900 ${isCurrent?'border-brand-400 ring-1 ring-brand-300':'border-[#18181b]'}`}`}
      style={dark?{background:'linear-gradient(165deg,#1c1433 0%,#0b0812 100%)',borderColor:'rgba(124,92,230,.55)',boxShadow:'0 30px 70px -28px rgba(124,92,230,.6)'}:undefined}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
          style={dark?{background:'rgba(255,255,255,.1)',color:'#c4b5fd'}:{background:'#ece8ff',color:'#7c5ce6'}}><Icon size={20}/></div>
        {isCurrent&&<span className={`chip ${dark?'bg-white/15 text-white border border-white/25':'bg-brand-50 text-brand-700 border border-brand-200'}`}><Check size={11}/>Current</span>}
      </div>
      <h2 className={`text-lg font-bold ${dark?'text-white':'text-navy-900'}`}>{info.name}</h2>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-3xl font-bold tabular-nums ${dark?'text-white':'text-navy-900'}`}>${info.price}</span>
        <span className={`text-sm ${dark?'text-white/55':'text-gray-500'}`}>/mo</span>
      </div>
      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((f,i)=>(
        <li key={i} className={`flex items-start gap-2 text-sm ${dark?'text-white/85':'text-gray-600'}`}>
        <Check size={15} className={`mt-0.5 shrink-0 ${dark?'text-brand-300':'text-brand-600'}`}/>{f}
        </li>
        ))}
      </ul>
      {isCurrent?(
        <button disabled className={`mt-6 w-full cursor-default rounded-xl border px-4 py-2.5 text-sm font-semibold ${dark?'border-white/25 text-white':'border-gray-300 text-navy-700'}`}>Current plan</button>
      ):isFree?(
        hasSubscription&&canManage?(
          <button onClick={manageBilling} disabled={busy!==null} className={`mt-6 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold ${dark?'border-white/25 text-white':'border-gray-300 text-navy-700 hover:bg-gray-50'}`}>Downgrade via billing</button>
        ):(
          <button disabled className={`mt-6 w-full cursor-default rounded-xl border px-4 py-2.5 text-sm font-semibold ${dark?'border-white/20 text-white/70':'border-[#18181b] text-gray-400'}`}>Free forever</button>
        )
      ):(
        <button onClick={()=>choose(id)} disabled={!canManage||busy!==null} className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{background:'linear-gradient(120deg,#8b6ef2,#7c5ce6)',boxShadow:'0 10px 26px -10px rgba(124,92,230,.65)'}}>
          {busy===id?<Loader2 size={16} className="animate-spin"/>:isEnterprise&&!isSelfServe('enterprise')?<><Building2 size={16}/> Contact sales</>:<><Sparkles size={16}/> Upgrade</>}
        </button>
      )}
    </div>
  );
})}
</div>

<p className="mt-6 text-center text-xs text-gray-400">Prices in USD. Cancel anytime. Enterprise plans include custom onboarding. Secure payments by Stripe.</p>
</div>;
}
