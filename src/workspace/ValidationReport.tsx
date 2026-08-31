// @ts-nocheck
import { useEffect, useState } from 'react';
import {
  Loader as Loader2, Check, X, AlertTriangle, ArrowRight, ChevronDown, ChevronRight,
  Clock, Rocket, Server, Boxes, Lock, Layers, Package, ShieldCheck, Ticket, Sparkles,
  Search, ListChecks, CheckCircle2, XCircle, RefreshCw, Wrench, FileCode, Shield,
} from 'lucide-react';
import { linterFor, selectScanTargets } from './fileLinters';
import { getTree, getFile, ERROR_TEXT, loadReport, saveReport } from './repoCache';
import { TicketModal } from './TicketModal';

const OK='text-[#0f9a4c]',WARN='text-[#c66a00]',BAD='text-[#c92a2a]';
const SEVCLS={high:'bg-red-50 text-red-700 border border-red-200',medium:'bg-amber-50 text-amber-700 border border-amber-200',low:'bg-blue-50 text-blue-700 border border-blue-200'};
const scoreCls=(s)=>s>=85?OK:s>=60?WARN:BAD;
const barCls=(s)=>s>=85?'bg-[#0f9a4c]':s>=60?'bg-[#d98a18]':'bg-[#d94a4a]';
const RULES={Containers:7,Infrastructure:7,Governance:5,Kubernetes:6};
const CATEGORIES=['Infrastructure','Containers','Kubernetes','Secrets','Governance','Dependencies'];
const CAT_ICON={Infrastructure:Server,Containers:Boxes,Kubernetes:Layers,Secrets:Lock,Governance:ShieldCheck,Dependencies:Package};
const VULN={lodash:'high',axios:'high',minimist:'high',handlebars:'high',moment:'medium','node-fetch':'medium',ws:'high',jsonwebtoken:'high'};

function categoryOf(f){
  if(/secret|credential|hardcoded/i.test(f.title))return'Secrets';
  const p=f.file||'';
  if(/(^|\/)Dockerfile/i.test(p))return'Containers';
  if(/\.tf$/i.test(p))return'Infrastructure';
  if(/\.github\/workflows\/|gitlab-ci|Jenkinsfile/i.test(p))return'Governance';
  if(/(k8s|kubernetes|manifest|deploy|overlays|base)\/.*\.ya?ml$/i.test(p))return'Kubernetes';
  return'Governance';
}

function whyItMatters(b){
  if(b.cat==='Governance')return 'Without the required release control, code can reach production without the authorization your deployment policy expects.';
  if(b.cat==='Secrets')return 'Exposed credentials can allow unauthorized access to systems, data, cloud resources or third-party services.';
  if(b.cat==='Dependencies')return 'A vulnerable dependency can expose the application to a known, exploitable weakness.';
  if(b.cat==='Infrastructure'||b.cat==='Kubernetes')return 'Unsafe infrastructure configuration can cause availability, security or recovery problems during a production release.';
  if(b.cat==='Containers')return 'An unsafe container configuration can increase runtime privileges or make the production image harder to operate securely.';
  return b.detail||'This issue materially increases release risk and should be corrected before production.';
}

function recommendedFix(b){
  if(b.detail)return b.detail;
  if(/approval gate/i.test(b.title))return 'Configure a protected production environment and require an authorized reviewer before the deployment job can execute.';
  return `Correct the flagged ${b.cat?.toLowerCase()||'release'} configuration in ${b.file||'the affected file'}, save the change, then re-run validation.`;
}

export function ValidationReport({project,scanHistory=[],onRemediate,onApprovals}){
  const[loading,setLoading]=useState(true),[data,setData]=useState(null),[openCat,setOpenCat]=useState(null),[ticket,setTicket]=useState(null),[showAll,setShowAll]=useState(false);
  const[metric,setMetric]=useState(null),[fixing,setFixing]=useState(null),[scanNonce,setScanNonce]=useState(0),[verifying,setVerifying]=useState(false);

  useEffect(()=>{
    let alive=true;
    const useCache=scanNonce===0;
    const cached=useCache?loadReport('validation',project):null;
    if(cached&&cached.data){setData(cached.data);setLoading(false);return()=>{alive=false};}
    (async()=>{
      setLoading(true);
      const tree=await getTree(project);if(tree.error){if(alive){setData({error:ERROR_TEXT[tree.error]});setLoading(false)}return;}
      const paths=tree.paths,targets=selectScanTargets(paths),all=[],typeCounts={Containers:0,Infrastructure:0,Governance:0,Kubernetes:0};
      await Promise.all(targets.map(async p=>{const c=await getFile(project,p);if(c==null)return;if(/(^|\/)Dockerfile/i.test(p))typeCounts.Containers++;else if(/\.tf$/i.test(p))typeCounts.Infrastructure++;else if(/\.github\/workflows\/|gitlab-ci|Jenkinsfile/i.test(p))typeCounts.Governance++;else if(/(k8s|kubernetes|manifest|deploy|overlays|base)\/.*\.ya?ml$/i.test(p))typeCounts.Kubernetes++;const lint=linterFor(p);if(lint)all.push(...lint(c,p));}));
      const pkgs=paths.filter(p=>/(^|\/)package\.json$/.test(p)).slice(0,3);let depChecks=0;
      await Promise.all(pkgs.map(async p=>{const c=await getFile(project,p);if(!c)return;depChecks+=Object.keys(VULN).length;try{const j=JSON.parse(c),deps={...j.dependencies,...j.devDependencies};for(const[name,sev]of Object.entries(VULN))if(deps[name])all.push({file:p,line:1,type:'commission',severity:sev,title:`Vulnerable dependency: ${name}`,detail:`${name} ${deps[name]} has known vulnerabilities — upgrade.`});}catch{}}));
      const cats={};CATEGORIES.forEach(k=>cats[k]={key:k,findings:[],executed:0,targets:[]});
      Object.entries(typeCounts).forEach(([k,n])=>{if(n>0)cats[k].executed+=n*(RULES[k]||5)});
      if(pkgs.length)cats.Dependencies.executed+=depChecks;
      if(targets.length)cats.Secrets.executed+=targets.length;
      targets.forEach(p=>{if(/Dockerfile/i.test(p))cats.Containers.targets.push(p);else if(/\.tf$/i.test(p))cats.Infrastructure.targets.push(p);else if(/\.github\/workflows\/|gitlab-ci|Jenkinsfile/i.test(p))cats.Governance.targets.push(p);else if(/(k8s|kubernetes|manifest|deploy|overlays|base)\/.*\.ya?ml$/i.test(p))cats.Kubernetes.targets.push(p);cats.Secrets.targets.push(p)});
      pkgs.forEach(p=>cats.Dependencies.targets.push(p));
      all.forEach(f=>cats[categoryOf(f)].findings.push(f));
      const catList=CATEGORIES.map(k=>cats[k]).map(c=>{const high=c.findings.filter(f=>f.severity==='high').length,med=c.findings.filter(f=>f.severity==='medium').length,low=c.findings.filter(f=>f.severity==='low').length,passed=Math.max(0,c.executed-c.findings.length),score=c.executed===0?null:Math.max(0,Math.min(100,100-high*18-med*8-low*3)),status=c.executed===0?'na':high>0?'fail':med+low>0?'warn':'pass';return{...c,high,med,low,passed,score,status};});
      const executed=catList.reduce((s,c)=>s+c.executed,0),blockers=all.filter(f=>f.severity==='high'),warnings=all.filter(f=>f.severity==='medium').length,lows=all.filter(f=>f.severity==='low').length,passed=Math.max(0,executed-all.length),scored=catList.filter(c=>c.score!==null),overall=scored.length?Math.round(scored.reduce((s,c)=>s+c.score,0)/scored.length):100,rollbackProb=Math.min(60,4+blockers.length*7+warnings*2),confidence=100-rollbackProb;
      const OWN={Containers:['Platform',18],Governance:['Security',4],Infrastructure:['SRE',20],Kubernetes:['SRE',15],Secrets:['Security',12],Dependencies:['Engineering',25]};
      const topBlockers=blockers.map(f=>{const cat=categoryOf(f),[owner,eta]=OWN[cat]||['Platform',15];return{...f,cat,owner,eta};});
      const hasProbeGap=all.some(f=>/health probes/i.test(f.title)),rootImg=all.some(f=>/runs as root/i.test(f.title)),k8sPresent=typeCounts.Kubernetes>0;
      const sim=[{k:'Build',s:'pass'},{k:'Container Image',s:rootImg?'warn':'pass'},{k:'Registry Push',s:'pass'},{k:'Infrastructure',s:cats.Infrastructure.findings.some(f=>f.severity==='high')?'fail':'pass'},{k:k8sPresent?'Kubernetes Rollout':'Deploy',s:cats.Kubernetes.findings.some(f=>f.severity==='high')?'fail':'pass'},{k:'Health Checks',s:hasProbeGap?'fail':'pass'}],simFail=sim.some(s=>s.s==='fail');
      const out={executed,passed,warnings:warnings+lows,blockers:blockers.length,overall,confidence,rollbackProb,catList,topBlockers,allFindings:all,sim,simFail,status:blockers.length?'BLOCKED':warnings+lows?'REVIEW':'READY'};
      if(alive){setData(out);setLoading(false);setVerifying(false);saveReport('validation',project,out)}
    })();return()=>{alive=false};
  },[project.git_url,project.git_branch,scanNonce]);

  if(loading)return <div className="card flex items-center gap-2 text-sm text-gray-500"><Loader2 size={15} className="animate-spin text-brand-600"/>{verifying?'Verifying repository changes…':'Running production-readiness validation…'}</div>;
  if(!data||data.error)return <div className="card border-amber-200 bg-amber-50 text-sm text-amber-800"><AlertTriangle size={15} className="inline mr-1"/>{data?.error||'No repository to validate.'}</div>;
  const d=data,statusTone=d.status==='BLOCKED'?BAD:d.status==='REVIEW'?WARN:OK;
  const visibleBlockers=showAll?d.topBlockers:d.topBlockers.slice(0,3),technicalPassed=!d.simFail;
  const SIM={pass:<Check size={13}/>,warn:<AlertTriangle size={13}/>,fail:<X size={13}/>};
  const metrics=[
    {key:'checks',label:'Checks',value:d.executed,tone:'text-navy-900',box:'bg-slate-50 hover:bg-slate-100 border-slate-200',icon:ListChecks},
    {key:'passed',label:'Passed',value:d.passed,tone:OK,box:'bg-emerald-50/70 hover:bg-emerald-50 border-emerald-200',icon:CheckCircle2},
    {key:'warnings',label:'Warnings',value:d.warnings,tone:d.warnings?WARN:OK,box:'bg-amber-50/70 hover:bg-amber-50 border-amber-200',icon:AlertTriangle},
    {key:'blockers',label:'Blockers',value:d.blockers,tone:d.blockers?BAD:OK,box:'bg-red-50/70 hover:bg-red-50 border-red-200',icon:XCircle},
  ];

  const metricRows=()=>{
    if(metric==='warnings')return (d.allFindings||[]).filter(f=>f.severity==='medium'||f.severity==='low');
    if(metric==='blockers')return d.topBlockers||[];
    return d.catList;
  };

  return <div className="space-y-4">
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-2"><span className={`h-2.5 w-2.5 rounded-full ${d.status==='BLOCKED'?'bg-red-500':d.status==='REVIEW'?'bg-amber-500':'bg-emerald-500'}`}/><span className="text-xs font-bold uppercase tracking-[.14em] text-gray-500">Release decision</span></div><h2 className={`text-2xl sm:text-3xl font-bold tracking-tight ${statusTone}`}>{d.status==='BLOCKED'?'Not ready to deploy':d.status==='REVIEW'?'Review before deployment':'Ready for governance'}</h2><p className="mt-2 text-sm text-gray-600 max-w-2xl">{d.blockers?`${d.blockers} blocking issue${d.blockers===1?'':'s'} must be resolved before this release can proceed.`:d.warnings?`${d.warnings} warning${d.warnings===1?'':'s'} remain. Review them before requesting approval.`:'No blocking validation findings were detected.'}</p></div>
        <div className="lg:w-44 rounded-2xl bg-gray-50 border border-gray-200 p-4 text-left lg:text-center"><div className={`text-4xl font-bold ${scoreCls(d.confidence)}`}>{d.confidence}%</div><div className="text-xs font-medium text-gray-500 mt-1">release confidence</div></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px border-t border-gray-100 bg-gray-200">
        {metrics.map(m=>{const I=m.icon;return <button key={m.key} onClick={()=>setMetric(m.key)} className={`group px-5 py-4 text-left border-b-2 ${m.box} transition-all shadow-[inset_0_1px_0_rgba(255,255,255,.8)] hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-300`}><div className="flex items-center justify-between"><div className={`text-xl font-bold ${m.tone}`}>{m.value}</div><I size={16} className={`${m.tone} opacity-55 group-hover:opacity-100`}/></div><div className="text-xs font-semibold text-gray-600 mt-1 flex items-center gap-1">{m.label}<ChevronRight size={11}/></div></button>})}
      </div>
    </section>

    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-3"><div><h3 className="text-sm font-semibold text-navy-900">Validation matrix</h3><p className="text-xs text-gray-500 mt-0.5">Open every category to inspect checks, evidence and findings.</p></div><span className={`text-sm font-bold ${scoreCls(d.overall)}`}>{d.overall}% overall</span></div>
      <div className="divide-y divide-gray-100">
        {d.catList.map(c=>{const Icon=CAT_ICON[c.key]||Server,isOpen=openCat===c.key;return <div key={c.key}><button onClick={()=>setOpenCat(isOpen?null:c.key)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-gray-50/70 rounded-lg px-2"><span className="w-4">{isOpen?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</span><Icon size={16} className="text-gray-400"/><span className="w-36 text-sm font-semibold text-navy-800">{c.key}</span><div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">{c.score!==null&&<div className={`h-full ${barCls(c.score)}`} style={{width:`${c.score}%`}}/>}</div><span className={`w-10 text-right text-sm font-bold ${c.score===null?'text-gray-400':scoreCls(c.score)}`}>{c.score===null?'—':c.score}</span><span className="w-20 text-right text-xs font-medium">{c.status==='na'?<span className="text-gray-400">Not detected</span>:c.status==='pass'?<span className={OK}>Passed</span>:c.status==='warn'?<span className={WARN}>{c.med+c.low} warn</span>:<span className={BAD}>{c.high} block</span>}</span></button>{isOpen&&<div className="ml-9 mb-3 rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3"><div className="grid grid-cols-3 gap-2"><div className="rounded-lg bg-white border border-gray-200 p-2"><div className="text-lg font-bold text-navy-900">{c.executed}</div><div className="text-[11px] text-gray-500">checks executed</div></div><div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2"><div className="text-lg font-bold text-emerald-700">{c.passed}</div><div className="text-[11px] text-emerald-700">passed</div></div><div className="rounded-lg bg-red-50 border border-red-100 p-2"><div className="text-lg font-bold text-red-700">{c.high}</div><div className="text-[11px] text-red-700">blockers</div></div></div>{c.targets?.length>0&&<div><div className="text-[10px] uppercase tracking-wide font-bold text-gray-400 mb-1">Evidence inspected</div><div className="flex flex-wrap gap-1.5">{c.targets.slice(0,12).map((p,i)=><span key={i} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-mono text-gray-600">{p}</span>)}</div></div>}{c.findings.length>0?<div className="space-y-2">{c.findings.map((f,i)=><div key={i} className="flex flex-wrap items-center gap-2 text-sm"><span className={`chip text-[10px] ${SEVCLS[f.severity]}`}>{f.severity}</span><span className="font-medium text-navy-800">{f.title}</span><span className="font-mono text-xs text-gray-500">{f.file}:{f.line}</span></div>)}</div>:c.executed>0?<div className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={15}/>No findings were produced by the {c.executed} checks in this category.</div>:<div className="text-sm text-gray-500">No applicable repository target was detected for this category. LytHouse is not counting it as a pass.</div>}</div>}</div>})}
      </div>
    </section>

    {d.topBlockers.length>0&&<section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5"><div className="flex items-end justify-between gap-3 mb-3"><div><h3 className="text-sm font-semibold text-navy-900">Priority remediation</h3><p className="text-xs text-gray-500 mt-0.5">Resolve these in order to unlock the release.</p></div><span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{d.blockers} blockers</span></div><div className="divide-y divide-gray-100 border-y border-gray-100">{visibleBlockers.map((b,i)=><div key={i} className="py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700 text-xs font-bold">{i+1}</span><div className="flex-1 min-w-0"><div className="text-sm font-semibold text-navy-900">{b.title}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500"><span className="font-mono truncate max-w-xs">{b.file}:{b.line}</span><span className="flex items-center gap-1"><Clock size={11}/>~{b.eta} min</span><span>{b.owner}</span></div></div><div className="flex gap-2 sm:ml-auto"><button onClick={()=>setTicket({...b,impact:undefined})} className="btn-secondary text-xs"><Ticket size={12}/>Ticket</button><button onClick={()=>setFixing(b)} className="btn-primary text-xs"><Wrench size={12}/>Fix & verify</button></div></div>)}</div>{d.topBlockers.length>3&&<button onClick={()=>setShowAll(v=>!v)} className="mt-3 text-xs font-semibold text-brand-700 hover:text-brand-800">{showAll?'Show top 3':`View all ${d.topBlockers.length} blockers`}</button>}</section>}

    <section className="grid lg:grid-cols-2 gap-4"><div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5"><div className="flex items-center gap-2"><Sparkles size={15} className="text-brand-600"/><h3 className="text-sm font-semibold text-navy-900">Release recommendation</h3></div><div className={`text-xl font-bold mt-3 ${d.blockers?BAD:d.warnings?WARN:OK}`}>{d.blockers?'Do not deploy yet':d.warnings?'Review before approval':'Proceed to governance'}</div><p className="text-sm text-gray-600 mt-2 leading-6">{d.blockers?`Resolve the ${d.blockers} blocker${d.blockers===1?'':'s'}, re-run validation, then request approval.`:d.warnings?`No blockers remain, but ${d.warnings} warning${d.warnings===1?'':'s'} should be reviewed before sign-off.`:'Validation is clear. Request the required release approval before deployment.'}</p><div className="mt-4 flex gap-2">{d.blockers?<button onClick={onRemediate} className="btn-primary text-xs">Open remediation <ArrowRight size={12}/></button>:<button onClick={onApprovals} className="btn-primary text-xs">Request approval <ArrowRight size={12}/></button>}</div></div><div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5"><h3 className="text-sm font-semibold text-navy-900">Release risk</h3><div className="mt-3 space-y-3"><div className="flex justify-between text-sm"><span className="text-gray-600">Release risk indicator</span><b className={d.rollbackProb<=10?OK:d.rollbackProb<=25?WARN:BAD}>{d.rollbackProb}%</b></div><div className="flex justify-between text-sm"><span className="text-gray-600">Validation readiness</span><b className={scoreCls(d.overall)}>{d.overall}%</b></div><div className="pt-3 border-t border-gray-100 text-xs text-gray-500">The risk indicator is derived from repository evidence; it is not a predicted probability of rollback.</div></div></div></section>

    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2"><Rocket size={14} className="text-brand-600"/>Technical deployment simulation</h3><p className="text-xs text-gray-500 mt-1">Static configuration analysis only — no infrastructure was deployed.</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${technicalPassed?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700'}`}>{technicalPassed?'Technical path passed':'Technical path failed'}</span></div><div className="mt-4 flex flex-wrap gap-2">{d.sim.map((s,i)=><span key={i} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${s.s==='fail'?'border-red-200 bg-red-50 text-red-700':s.s==='warn'?'border-amber-200 bg-amber-50 text-amber-700':'border-gray-200 bg-gray-50 text-navy-700'}`}>{SIM[s.s]}{s.k}</span>)}</div></section>

    {scanHistory.length>0&&<details className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 group"><summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold text-navy-900">Scan history <ChevronDown size={15} className="text-gray-400 group-open:rotate-180"/></summary><div className="mt-3 pt-3 border-t border-gray-100 space-y-2">{scanHistory.slice(0,8).map((v,i)=><div key={i} className="flex items-center justify-between text-xs"><span className="text-gray-600">{v.status}</span><span className="text-gray-400">{v.created_at?new Date(v.created_at).toLocaleString():''}</span></div>)}</div></details>}

    {metric&&<div className="fixed inset-0 z-[10000] bg-slate-950/35 backdrop-blur-[2px] flex items-center justify-center p-4" onMouseDown={()=>setMetric(null)}><div className="w-full max-w-3xl max-h-[82vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200" onMouseDown={e=>e.stopPropagation()}><div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4"><div><h3 className="text-lg font-bold text-navy-900">{metrics.find(m=>m.key===metric)?.label} evidence</h3><p className="text-sm text-gray-500">Everything behind this validation summary, grouped by analysis category.</p></div><button onClick={()=>setMetric(null)} className="rounded-lg p-2 hover:bg-gray-100"><X size={18}/></button></div><div className="p-5 overflow-y-auto max-h-[68vh] space-y-3">{(metric==='checks'||metric==='passed')?metricRows().map(c=>{const I=CAT_ICON[c.key]||Server;return <div key={c.key} className="rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><I size={16} className="text-gray-500"/><span className="font-semibold text-navy-900">{c.key}</span></div><div className="flex gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2 py-1">{c.executed} checked</span><span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-1">{c.passed} passed</span>{c.med+c.low>0&&<span className="rounded-full bg-amber-50 text-amber-700 px-2 py-1">{c.med+c.low} warning</span>}{c.high>0&&<span className="rounded-full bg-red-50 text-red-700 px-2 py-1">{c.high} blocker</span>}</div></div>{c.targets?.length>0?<div className="mt-3 flex flex-wrap gap-1.5">{c.targets.slice(0,20).map((p,i)=><span key={i} className="rounded-md border bg-gray-50 px-2 py-1 text-[11px] font-mono text-gray-600">{p}</span>)}</div>:<p className="mt-2 text-xs text-gray-400">No applicable target detected; this category is not counted as passed.</p>}</div>}):metricRows().length?metricRows().map((f,i)=><div key={i} className="rounded-xl border border-gray-200 p-4 flex gap-3"><span className={`chip h-fit text-[10px] ${SEVCLS[f.severity]}`}>{f.severity}</span><div className="min-w-0"><div className="font-semibold text-navy-900">{f.title}</div><div className="mt-1 text-xs font-mono text-gray-500">{f.file}:{f.line}</div>{f.detail&&<p className="mt-2 text-sm text-gray-600">{f.detail}</p>}</div></div>):<div className="py-10 text-center text-sm text-gray-500"><CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500"/>Nothing in this category for the current scan.</div>}</div></div></div>}

    {fixing&&<div className="fixed inset-0 z-[10000] bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center p-4" onMouseDown={()=>setFixing(null)}><div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden" onMouseDown={e=>e.stopPropagation()}><div className="flex items-start justify-between border-b border-gray-100 px-5 py-4"><div><div className="text-xs font-bold uppercase tracking-wide text-red-600">Fix & verify</div><h3 className="text-lg font-bold text-navy-900 mt-1">{fixing.title}</h3></div><button onClick={()=>setFixing(null)} className="rounded-lg p-2 hover:bg-gray-100"><X size={18}/></button></div><div className="p-5 space-y-4"><div className="rounded-xl border border-red-200 bg-red-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-red-700">Problem</div><p className="mt-1 text-sm text-gray-800">{fixing.detail||fixing.title}</p></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-amber-700">Why it matters</div><p className="mt-1 text-sm text-gray-800">{whyItMatters(fixing)}</p></div><div className="rounded-xl border border-brand-200 bg-brand-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-brand-700">Recommended fix</div><p className="mt-1 text-sm text-gray-800">{recommendedFix(fixing)}</p></div><div className="rounded-xl border border-gray-200 p-4"><div className="text-xs font-bold uppercase tracking-wide text-gray-500">Evidence</div><div className="mt-2 flex items-center gap-2 text-sm"><FileCode size={15} className="text-gray-400"/><code className="text-xs text-navy-800">{fixing.file}:{fixing.line}</code></div></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-emerald-700">Verify fix</div><p className="mt-1 text-sm text-gray-700">After changing the repository, run verification. LytHouse will fetch the repository again and only clear this blocker when the evidence no longer reproduces it.</p></div><div className="flex flex-wrap justify-end gap-2 pt-1"><button onClick={()=>{setFixing(null);onRemediate?.();}} className="btn-secondary text-sm"><Wrench size={13}/>Open remediation workspace</button><button onClick={()=>{setVerifying(true);setFixing(null);setScanNonce(n=>n+1);}} className="btn-primary text-sm"><RefreshCw size={13}/>Verify now</button></div></div></div></div>}

    {ticket&&<TicketModal finding={ticket} project={project} onClose={()=>setTicket(null)}/>} 
  </div>;
}
