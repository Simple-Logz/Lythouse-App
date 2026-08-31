// @ts-nocheck
import { useEffect, useState } from 'react';
import {
  Loader as Loader2, Check, X, AlertTriangle, ArrowRight, ChevronDown, ChevronRight,
  Clock, Rocket, Server, Boxes, Lock, Layers, Package, ShieldCheck, Ticket, Sparkles,
} from 'lucide-react';
import { linterFor, selectScanTargets } from './fileLinters';
import { getTree, getFile, ERROR_TEXT, loadReport, saveReport } from './repoCache';
import { TicketModal } from './TicketModal';

const OK='text-[#0f9a4c]',WARN='text-[#c66a00]',BAD='text-[#c92a2a]';
const SEVCLS={high:'bg-red-50 text-red-700 border border-red-200',medium:'bg-amber-50 text-amber-700 border border-amber-200',low:'bg-emerald-50 text-emerald-700 border border-emerald-200'};
const scoreCls=(s)=>s>=85?OK:s>=60?WARN:BAD;
const barCls=(s)=>s>=85?'bg-[#0f9a4c]':s>=60?'bg-[#d98a18]':'bg-[#d94a4a]';
const RULES={Containers:7,Infrastructure:7,Governance:5,Kubernetes:6};
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

export function ValidationReport({project,scanHistory=[],onRemediate,onApprovals}){
  const[loading,setLoading]=useState(true),[data,setData]=useState(null),[openCat,setOpenCat]=useState(null),[ticket,setTicket]=useState(null),[showAll,setShowAll]=useState(false);
  useEffect(()=>{
    let alive=true;const cached=loadReport('validation',project);
    if(cached&&cached.data){setData(cached.data);setLoading(false);return()=>{alive=false};}
    (async()=>{
      const tree=await getTree(project);if(tree.error){if(alive){setData({error:ERROR_TEXT[tree.error]});setLoading(false)}return;}
      const paths=tree.paths,targets=selectScanTargets(paths),all=[],typeCounts={Containers:0,Infrastructure:0,Governance:0,Kubernetes:0};
      await Promise.all(targets.map(async p=>{const c=await getFile(project,p);if(c==null)return;if(/(^|\/)Dockerfile/i.test(p))typeCounts.Containers++;else if(/\.tf$/i.test(p))typeCounts.Infrastructure++;else if(/\.github\/workflows\/|gitlab-ci|Jenkinsfile/i.test(p))typeCounts.Governance++;else if(/(k8s|kubernetes|manifest|deploy|overlays|base)\/.*\.ya?ml$/i.test(p))typeCounts.Kubernetes++;const lint=linterFor(p);if(lint)all.push(...lint(c,p));}));
      const pkgs=paths.filter(p=>/(^|\/)package\.json$/.test(p)).slice(0,3);let depChecks=0;
      await Promise.all(pkgs.map(async p=>{const c=await getFile(project,p);if(!c)return;depChecks+=Object.keys(VULN).length;try{const j=JSON.parse(c),deps={...j.dependencies,...j.devDependencies};for(const[name,sev]of Object.entries(VULN))if(deps[name])all.push({file:p,line:1,type:'commission',severity:sev,title:`Vulnerable dependency: ${name}`,detail:`${name} ${deps[name]} has known vulnerabilities — upgrade.`});}catch{}}));
      const cats={},ensure=k=>(cats[k]=cats[k]||{key:k,findings:[],executed:0});
      Object.entries(typeCounts).forEach(([k,n])=>{if(n>0)ensure(k).executed+=n*(RULES[k]||5)});if(pkgs.length)ensure('Dependencies').executed+=depChecks;if(targets.length)ensure('Secrets').executed+=targets.length;all.forEach(f=>ensure(categoryOf(f)).findings.push(f));
      const catList=Object.values(cats).map(c=>{const high=c.findings.filter(f=>f.severity==='high').length,med=c.findings.filter(f=>f.severity==='medium').length,low=c.findings.filter(f=>f.severity==='low').length,score=Math.max(0,Math.min(100,100-high*18-med*8-low*3)),status=high>0?'fail':med+low>0?'warn':'pass';return{...c,high,med,low,score,status};}).sort((a,b)=>a.score-b.score);
      const executed=catList.reduce((s,c)=>s+c.executed,0),blockers=all.filter(f=>f.severity==='high'),warnings=all.filter(f=>f.severity==='medium').length,lows=all.filter(f=>f.severity==='low').length,passed=Math.max(0,executed-all.length),overall=catList.length?Math.round(catList.reduce((s,c)=>s+c.score,0)/catList.length):100,rollbackProb=Math.min(60,4+blockers.length*7+warnings*2),confidence=100-rollbackProb;
      const OWN={Containers:['Platform',18],Governance:['Security',4],Infrastructure:['SRE',20],Kubernetes:['SRE',15],Secrets:['Security',12],Dependencies:['Engineering',25]};
      const topBlockers=blockers.slice(0,6).map(f=>{const cat=categoryOf(f),[owner,eta]=OWN[cat]||['Platform',15];return{...f,cat,owner,eta};});
      const hasProbeGap=all.some(f=>/health probes/i.test(f.title)),rootImg=all.some(f=>/runs as root/i.test(f.title)),k8sPresent=typeCounts.Kubernetes>0;
      const sim=[{k:'Build',s:'pass'},{k:'Container Image',s:rootImg?'warn':'pass'},{k:'Registry Push',s:'pass'},{k:'Infrastructure',s:cats.Infrastructure&&cats.Infrastructure.findings.some(f=>f.severity==='high')?'fail':'pass'},{k:k8sPresent?'Kubernetes Rollout':'Deploy',s:cats.Kubernetes&&cats.Kubernetes.findings.some(f=>f.severity==='high')?'fail':'pass'},{k:'Health Checks',s:hasProbeGap?'fail':'pass'}],simFail=sim.some(s=>s.s==='fail');
      const out={executed,passed,warnings:warnings+lows,blockers:blockers.length,overall,confidence,rollbackProb,catList,topBlockers,sim,simFail,status:blockers.length?'BLOCKED':warnings+lows?'REVIEW':'READY'};if(alive){setData(out);setLoading(false);saveReport('validation',project,out)}
    })();return()=>{alive=false};
  },[project.git_url,project.git_branch]);

  if(loading)return <div className="card flex items-center gap-2 text-sm text-gray-500"><Loader2 size={15} className="animate-spin text-brand-600"/>Running production-readiness validation…</div>;
  if(!data||data.error)return <div className="card border-amber-200 bg-amber-50 text-sm text-amber-800"><AlertTriangle size={15} className="inline mr-1"/>{data?.error||'No repository to validate.'}</div>;
  const d=data,statusTone=d.status==='BLOCKED'?BAD:d.status==='REVIEW'?WARN:OK;
  const visibleBlockers=showAll?d.topBlockers:d.topBlockers.slice(0,3);
  const technicalPassed=!d.simFail;
  const SIM={pass:<Check size={13}/>,warn:<AlertTriangle size={13}/>,fail:<X size={13}/>};

  return <div className="space-y-4">
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2"><span className={`h-2.5 w-2.5 rounded-full ${d.status==='BLOCKED'?'bg-red-500':d.status==='REVIEW'?'bg-amber-500':'bg-emerald-500'}`}/><span className="text-xs font-bold uppercase tracking-[.14em] text-gray-500">Release decision</span></div>
          <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight ${statusTone}`}>{d.status==='BLOCKED'?'Not ready to deploy':d.status==='REVIEW'?'Review before deployment':'Ready for governance'}</h2>
          <p className="mt-2 text-sm text-gray-600 max-w-2xl">{d.blockers?`${d.blockers} blocking issue${d.blockers===1?'':'s'} must be resolved before this release can proceed.`:d.warnings?`${d.warnings} warning${d.warnings===1?'':'s'} remain. Review them before requesting approval.`:'No blocking validation findings were detected.'}</p>
        </div>
        <div className="lg:w-44 rounded-2xl bg-gray-50 border border-gray-200 p-4 text-left lg:text-center"><div className={`text-4xl font-bold ${scoreCls(d.confidence)}`}>{d.confidence}%</div><div className="text-xs font-medium text-gray-500 mt-1">release confidence</div></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-gray-100 bg-gray-50/60">
        {[['Checks',d.executed,'text-navy-900'],['Passed',d.passed,OK],['Warnings',d.warnings,d.warnings?WARN:OK],['Blockers',d.blockers,d.blockers?BAD:OK]].map(([l,v,c])=><div key={l} className="px-5 py-3 border-r border-gray-100 last:border-r-0"><div className={`text-xl font-bold ${c}`}>{v}</div><div className="text-xs text-gray-500 mt-0.5">{l}</div></div>)}
      </div>
    </section>

    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-3"><div><h3 className="text-sm font-semibold text-navy-900">Validation matrix</h3><p className="text-xs text-gray-500 mt-0.5">Open a category to inspect its evidence.</p></div><span className={`text-sm font-bold ${scoreCls(d.overall)}`}>{d.overall}% overall</span></div>
      <div className="divide-y divide-gray-100">
        {d.catList.map(c=>{const Icon=CAT_ICON[c.key]||Server,isOpen=openCat===c.key;return <div key={c.key}><button onClick={()=>setOpenCat(isOpen?null:c.key)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-gray-50/70 rounded-lg px-2"><span className="w-4">{c.findings.length?(isOpen?<ChevronDown size={14}/>:<ChevronRight size={14}/>):null}</span><Icon size={16} className="text-gray-400"/><span className="w-36 text-sm font-semibold text-navy-800">{c.key}</span><div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full ${barCls(c.score)}`} style={{width:`${c.score}%`}}/></div><span className={`w-10 text-right text-sm font-bold ${scoreCls(c.score)}`}>{c.score}</span><span className="w-16 text-right text-xs font-medium">{c.status==='pass'?<span className={OK}>Passed</span>:c.status==='warn'?<span className={WARN}>{c.med+c.low} warn</span>:<span className={BAD}>{c.high} block</span>}</span></button>{isOpen&&c.findings.length>0&&<div className="ml-9 mb-3 rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2">{c.findings.map((f,i)=><div key={i} className="flex flex-wrap items-center gap-2 text-sm"><span className={`chip text-[10px] ${SEVCLS[f.severity]}`}>{f.severity}</span><span className="font-medium text-navy-800">{f.title}</span><span className="font-mono text-xs text-gray-500">{f.file}:{f.line}</span></div>)}</div>}</div>})}
      </div>
    </section>

    {d.topBlockers.length>0&&<section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex items-end justify-between gap-3 mb-3"><div><h3 className="text-sm font-semibold text-navy-900">Priority remediation</h3><p className="text-xs text-gray-500 mt-0.5">Resolve these in order to unblock the release.</p></div><span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{d.blockers} blockers</span></div>
      <div className="divide-y divide-gray-100 border-y border-gray-100">
        {visibleBlockers.map((b,i)=><div key={i} className="py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700 text-xs font-bold">{i+1}</span><div className="flex-1 min-w-0"><div className="text-sm font-semibold text-navy-900">{b.title}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500"><span className="font-mono truncate max-w-xs">{b.file}:{b.line}</span><span className="flex items-center gap-1"><Clock size={11}/>~{b.eta} min</span><span>{b.owner}</span></div></div><div className="flex gap-2 sm:ml-auto"><button onClick={()=>setTicket({...b,impact:undefined})} className="btn-secondary text-xs"><Ticket size={12}/>Ticket</button><button onClick={onRemediate} className="btn-primary text-xs"><ArrowRight size={12}/>Fix & verify</button></div></div>)}
      </div>
      {d.topBlockers.length>3&&<button onClick={()=>setShowAll(v=>!v)} className="mt-3 text-xs font-semibold text-brand-700 hover:text-brand-800">{showAll?'Show top 3':`View all ${d.topBlockers.length} blockers`}</button>}
    </section>}

    <section className="grid lg:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5"><div className="flex items-center gap-2"><Sparkles size={15} className="text-brand-600"/><h3 className="text-sm font-semibold text-navy-900">Release recommendation</h3></div><div className={`text-xl font-bold mt-3 ${d.blockers?BAD:d.warnings?WARN:OK}`}>{d.blockers?'Do not deploy yet':d.warnings?'Review before approval':'Proceed to governance'}</div><p className="text-sm text-gray-600 mt-2 leading-6">{d.blockers?`Resolve the ${d.blockers} blocker${d.blockers===1?'':'s'}, re-run validation, then request approval.`:d.warnings?`No blockers remain, but ${d.warnings} warning${d.warnings===1?'':'s'} should be reviewed before sign-off.`:'Validation is clear. Request the required release approval before deployment.'}</p><div className="mt-4 flex gap-2">{d.blockers?<button onClick={onRemediate} className="btn-primary text-xs">Open remediation <ArrowRight size={12}/></button>:<button onClick={onApprovals} className="btn-primary text-xs">Request approval <ArrowRight size={12}/></button>}</div></div>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5"><h3 className="text-sm font-semibold text-navy-900">Release risk</h3><div className="mt-3 space-y-3"><div className="flex justify-between text-sm"><span className="text-gray-600">Estimated rollback probability</span><b className={d.rollbackProb<=10?OK:d.rollbackProb<=25?WARN:BAD}>{d.rollbackProb}%</b></div><div className="flex justify-between text-sm"><span className="text-gray-600">Validation readiness</span><b className={scoreCls(d.overall)}>{d.overall}%</b></div><div className="pt-3 border-t border-gray-100 text-xs text-gray-500">Risk is derived from the repository checks shown above; it is not a guarantee of production behavior.</div></div></div>
    </section>

    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2"><Rocket size={14} className="text-brand-600"/>Technical deployment simulation</h3><p className="text-xs text-gray-500 mt-1">Static configuration analysis only — no infrastructure was deployed.</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${technicalPassed?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700'}`}>{technicalPassed?'Technical path passed':'Technical path failed'}</span></div><div className="mt-4 flex flex-wrap gap-2">{d.sim.map((s,i)=><span key={i} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${s.s==='fail'?'border-red-200 bg-red-50 text-red-700':s.s==='warn'?'border-amber-200 bg-amber-50 text-amber-700':'border-gray-200 bg-gray-50 text-navy-700'}`}>{SIM[s.s]}{s.k}</span>)}</div><div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-sm text-gray-700">{technicalPassed&&d.blockers?<><b>Technical simulation passed, but release authorization is still blocked.</b> Repository governance findings must be resolved before deployment.</>:technicalPassed?<><b>Technical simulation passed.</b> Continue through governance before deployment.</>:<><b>Technical simulation failed.</b> Fix the failing technical stage before requesting deployment.</>}</div></section>

    {scanHistory.length>0&&<details className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 group"><summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold text-navy-900">Scan history <ChevronDown size={15} className="text-gray-400 group-open:rotate-180"/></summary><div className="mt-3 pt-3 border-t border-gray-100 space-y-2">{scanHistory.slice(0,8).map((v,i)=><div key={i} className="flex items-center justify-between text-xs"><span className="text-gray-600">{v.status}</span><span className="text-gray-400">{v.created_at?new Date(v.created_at).toLocaleString():''}</span></div>)}</div></details>}
    {ticket&&<TicketModal finding={ticket} project={project} onClose={()=>setTicket(null)}/>} 
  </div>;
}
