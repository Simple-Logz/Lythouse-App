import{useEffect,useState}from'react';
import type{ReactNode}from'react';
import{ShieldCheck,ShieldAlert,ShieldX,TriangleAlert as AlertTriangle,Check,X,Loader as Loader2,ChevronRight,Info,CheckCircle2,XCircle}from'lucide-react';
import type{Severity,ValidationStatus,StepStatus,FindingStatus}from'./supabase';
import{useRouter}from'./router';

// ---- Toast notifications --------------------------------------------------
// A small in-app replacement for window.alert(). Native alert() blocks the
// tab, can't be styled, and looks out of place next to the rest of the UI.
// Call toast('message', 'error'|'success'|'info') from anywhere; mount
// <ToastHost/> once near the app root (already done in App.tsx).
type ToastKind='info'|'success'|'error';
type ToastItem={id:number;message:string;kind:ToastKind};
let toastItems:ToastItem[]=[];
let toastListeners:((items:ToastItem[])=>void)[]=[];
let toastId=0;
function emitToasts(){toastListeners.forEach(l=>l(toastItems));}
export function toast(message:string,kind:ToastKind='info'){
  const id=++toastId;
  toastItems=[...toastItems,{id,message,kind}];
  emitToasts();
  setTimeout(()=>{toastItems=toastItems.filter(t=>t.id!==id);emitToasts();},5000);
}
export function ToastHost(){
  const[items,setItems]=useState<ToastItem[]>(toastItems);
  useEffect(()=>{toastListeners.push(setItems);return()=>{toastListeners=toastListeners.filter(l=>l!==setItems);};},[]);
  if(!items.length)return null;
  const icon=(k:ToastKind)=>k==='success'?<CheckCircle2 size={16} className="text-green-600 shrink-0"/>:k==='error'?<XCircle size={16} className="text-danger-600 shrink-0"/>:<Info size={16} className="text-blue-600 shrink-0"/>;
  const cls=(k:ToastKind)=>k==='success'?'border-green-200 bg-green-50 text-green-800':k==='error'?'border-red-200 bg-red-50 text-danger-700':'border-blue-200 bg-blue-50 text-blue-800';
  return<div className="fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2">
    {items.map(t=>(
      <div key={t.id} className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg animate-scale-in ${cls(t.kind)}`}>
        {icon(t.kind)}
        <span className="flex-1 leading-snug">{t.message}</span>
        <button onClick={()=>{toastItems=toastItems.filter(x=>x.id!==t.id);emitToasts();}} className="shrink-0 text-current opacity-60 transition-opacity hover:opacity-100"><X size={14}/></button>
      </div>
    ))}
  </div>;
}

// A tiny hover/focus info affordance. Sits inline next to a label; on hover
// (or keyboard focus / tap) reveals a small popover explaining the term.
// Used sparingly — only where a metric or label isn't self-explanatory.
export function InfoHint({text,align='center',className=''}:{text:string;align?:'center'|'right';className?:string}){
return<span tabIndex={0} className={`group/hint relative inline-flex items-center align-middle outline-none ${className}`}>
<Info size={12} className="text-gray-400 transition-colors group-hover/hint:text-brand-600 group-focus/hint:text-brand-600 cursor-help"/>
<span className={`pointer-events-none absolute top-full z-40 mt-1.5 hidden w-56 rounded-lg bg-navy-900 px-3 py-2 text-[11px] font-normal leading-snug text-white shadow-xl group-hover/hint:block group-focus/hint:block ${align==='right'?'right-0':'left-1/2 -translate-x-1/2'}`}>{text}</span>
</span>;
}

export function Logo({size=26}:{size?:number}){
return<div className="flex items-center gap-2.5 select-none">
<div className="flex items-center justify-center rounded-xl bg-brand-600" style={{width:size,height:size}}>
<ShieldCheck size={size*0.56} className="text-white" strokeWidth={2.4}/></div>
<span className="text-[17px] font-bold tracking-tight text-navy-900">Lyt<span className="text-brand-600">House</span></span></div>;
}
export function Spinner({size=16,className=''}:{size?:number;className?:string}){return<Loader2 size={size} className={'animate-spin '+className}/>;}
export function StatusBadge({status}:{status:ValidationStatus|StepStatus}){
const m:Record<string,{label:string;cls:string}>={pending:{label:'Pending',cls:'bg-gray-100 text-gray-600 border border-[#d4d4d8]'},running:{label:'Running',cls:'bg-brand-50 text-brand-700 border border-brand-200'},completed:{label:'Completed',cls:'bg-brand-50 text-brand-700 border border-brand-200'},failed:{label:'Failed',cls:'bg-red-50 text-danger-600 border border-red-200'},skipped:{label:'Skipped',cls:'bg-gray-100 text-gray-500 border border-[#d4d4d8]'}};
const s=m[status]??m.pending;
const dot=status==='running'?<Spinner size={10}/>:<span className={'inline-block h-2 w-2 rounded-full '+(status==='completed'?'bg-brand-500':status==='failed'?'bg-danger-500':'bg-gray-400')}/>;
return<span className={'chip '+s.cls}>{dot}{s.label}</span>;
}
export function SeverityBadge({severity}:{severity:Severity|string}){
const m:Record<string,{label:string;cls:string;icon:ReactNode}>={critical:{label:'Critical',cls:'bg-red-50 text-danger-600 border border-red-200',icon:<ShieldX size={11}/>},high:{label:'High',cls:'bg-amber-50 text-amber-600 border border-amber-200',icon:<ShieldAlert size={11}/>},medium:{label:'Medium',cls:'bg-blue-50 text-blue-600 border border-blue-200',icon:<AlertTriangle size={11}/>},low:{label:'Low',cls:'bg-gray-100 text-gray-600 border border-[#d4d4d8]',icon:<Check size={11}/>},none:{label:'Clean',cls:'bg-brand-50 text-brand-700 border border-brand-200',icon:<ShieldCheck size={11}/>}};
const s=m[severity]??m.low;return<span className={'chip '+s.cls}>{s.icon}{s.label}</span>;
}
export function FindingStatusBadge({status}:{status:FindingStatus}){
const m:Record<string,{label:string;cls:string}>={open:{label:'Open',cls:'bg-red-50 text-danger-600 border border-red-200'},resolved:{label:'Resolved',cls:'bg-brand-50 text-brand-700 border border-brand-200'},ignored:{label:'Ignored',cls:'bg-gray-100 text-gray-500 border border-[#d4d4d8]'}};
const s=m[status]??m.open;return<span className={'chip '+s.cls}>{s.label}</span>;
}
export function RiskGauge({score,size=130}:{score:number|null;size?:number}){
// No score → a clean neutral ring with a dash, legible at any size.
if(score===null)return<div className="flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[#d4d4d8] text-gray-300" style={{width:size,height:size}} title="No score — validation didn't complete"><span className="font-bold leading-none" style={{fontSize:Math.max(12,size*0.3)}}>–</span></div>;
const c=Math.max(0,Math.min(100,score)),st=Math.max(3,size*0.09),r=size/2-st-2,cir=2*Math.PI*r,o=cir-(c/100)*cir;
// Semantic traffic-light colors (explicit hex so the theme remap can't flatten them).
const col=c>=75?'#dc2626':c>=50?'#ea580c':c>=25?'#f59e0b':'#12a150';
const lbl=c>=75?'Critical':c>=50?'Elevated':c>=25?'Moderate':'Low';
// Only show the text label when the gauge is big enough for it to fit.
const showLabel=size>=72;
const fs=showLabel?size*0.3:size*0.42;
return<div className="relative flex shrink-0 items-center justify-center" style={{width:size,height:size}} title={`Risk ${c}/100 · ${lbl}`}>
<svg width={size} height={size} className="-rotate-90"><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#eef0f2" strokeWidth={st}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={st} strokeLinecap="round" strokeDasharray={cir} strokeDashoffset={o} style={{transition:'stroke-dashoffset 1s ease,stroke 0.4s'}}/></svg>
<div className="absolute inset-0 flex flex-col items-center justify-center">
<span className="font-bold tabular-nums leading-none" style={{color:col,fontSize:fs}}>{c}</span>
{showLabel&&<span className="mt-1 font-semibold uppercase tracking-wide text-gray-500" style={{fontSize:Math.max(9,size*0.09)}}>{lbl}</span>}</div></div>;
}
export function StepIcon({status,icon}:{status:StepStatus;icon:ReactNode}){
const b='flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2';
if(status==='completed')return<div className={b+' border-brand-500 bg-brand-500 text-white'}><Check size={15} strokeWidth={3}/></div>;
if(status==='running')return<div className={b+' border-brand-500 bg-white text-brand-500'}><Spinner size={15}/></div>;
if(status==='failed')return<div className={b+' border-danger-500 bg-danger-500 text-white'}><X size={15} strokeWidth={3}/></div>;
return<div className={b+' border-[#d4d4d8] bg-white text-gray-400'}>{icon}</div>;
}
export function EmptyState({icon,title,description,action}:{icon:ReactNode;title:string;description:string;action?:ReactNode}){
return<div className="flex flex-col items-center justify-center px-6 py-20 text-center">
<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 border border-[#d4d4d8] text-gray-400">{icon}</div>
<h3 className="text-base font-semibold text-navy-900">{title}</h3>
<p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500">{description}</p>
{action&&<div className="mt-6">{action}</div>}</div>;
}
export function PageHeader({title,description,actions,breadcrumb}:{title:string;description?:string;actions?:ReactNode;breadcrumb?:ReactNode}){
return<div className="mb-7">{breadcrumb&&<div className="mb-3">{breadcrumb}</div>}
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
<div><h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>{description&&<p className="mt-1 text-sm text-gray-500">{description}</p>}</div>
{actions&&<div className="flex items-center gap-2">{actions}</div>}</div></div>;
}
export function Breadcrumb({items}:{items:{label:string;to?:string}[]}){
const{navigate}=useRouter();
return<nav className="flex items-center gap-1.5 text-sm">{items.map((it,i)=><span key={i} className="flex items-center gap-1.5">{i>0&&<ChevronRight size={14} className="text-gray-300"/>}{it.to?<button onClick={()=>navigate(it.to!)} className="text-gray-500 hover:text-navy-900 transition-colors">{it.label}</button>:<span className="font-medium text-navy-800">{it.label}</span>}</span>)}</nav>;
}
export function timeAgo(iso:string):string{
const d=new Date(iso),s=Math.floor((Date.now()-d.getTime())/1000);
if(s<60)return'just now';
const m=Math.floor(s/60);if(m<60)return m+'m ago';
const h=Math.floor(m/60);if(h<24)return h+'h ago';
const da=Math.floor(h/24);if(da<30)return da+'d ago';
const mo=Math.floor(da/30);if(mo<12)return mo+'mo ago';
return Math.floor(mo/12)+'y ago';
}
export function fmtDuration(ms:number|null):string{
if(ms===null)return'\u2014';
if(ms<1000)return ms+'ms';
return(ms/1000).toFixed(1)+'s';
}
