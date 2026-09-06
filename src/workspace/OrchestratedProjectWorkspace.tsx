// @ts-nocheck
import{useCallback,useEffect,useRef,useState}from'react';
import{ProjectWorkspace as LegacyProjectWorkspace}from'./ProjectWorkspace';
import{supabase,edgeFunctionUrl}from'../lib/supabase';

const terminal=new Set(['completed','failed']);
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

export function ProjectWorkspace({projectId}:{projectId:string}){
 const[rootKey,setRootKey]=useState(0),[status,setStatus]=useState<any>(null),[error,setError]=useState(''),[running,setRunning]=useState(false);
 const host=useRef<HTMLDivElement|null>(null);
 const relabel=useCallback(()=>{const buttons=host.current?.querySelectorAll('button')||[];for(const b of Array.from(buttons) as HTMLButtonElement[]){if(b.textContent?.includes('Rebuild Intelligence')){for(const n of Array.from(b.childNodes)){if(n.nodeType===Node.TEXT_NODE&&n.textContent?.includes('Rebuild Intelligence'))n.textContent=n.textContent.replace('Rebuild Intelligence','Run Analysis')}b.setAttribute('data-lythouse-run-analysis','true')}}},[]);
 useEffect(()=>{relabel();const o=new MutationObserver(relabel);if(host.current)o.observe(host.current,{subtree:true,childList:true,characterData:true});return()=>o.disconnect()},[relabel,rootKey]);
 const authHeaders=async()=>{const{data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Please sign in again to run analysis.');return{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':import.meta.env.VITE_SUPABASE_ANON_KEY||''}};
 const poll=useCallback(async()=>{const headers=await authHeaders();for(let i=0;i<120;i++){const r=await fetch(`${edgeFunctionUrl}/analysis-status`,{method:'POST',headers,body:JSON.stringify({projectId})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'Could not read analysis status.');setStatus(b);if(terminal.has(b.status)){if(b.status==='failed')throw new Error(b.error?.message||b.error||'Analysis failed.');setRootKey(k=>k+1);return}await sleep(2000)}throw new Error('Analysis is still running. Open Runs & Analysis Control Plane to continue tracking it.')},[projectId]);
 const run=useCallback(async()=>{if(running)return;setRunning(true);setError('');setStatus({status:'queueing',stages:{understand:'queueing',investigate:'blocked',resolve:'blocked'}});try{const headers=await authHeaders();const r=await fetch(`${edgeFunctionUrl}/analysis-orchestrator`,{method:'POST',headers,body:JSON.stringify({projectId})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'Could not queue analysis.');setStatus({...b,stages:{understand:b.stage||'queued',investigate:'blocked',resolve:'blocked'}});await poll()}catch(e:any){setError(e?.message||'Analysis failed.')}finally{setRunning(false)}},[projectId,poll,running]);
 const capture=(e:any)=>{const button=e.target?.closest?.('button[data-lythouse-run-analysis="true"]');if(!button)return;e.preventDefault();e.stopPropagation();run()};
 const stages=status?.stages||status?.config?.stages||{};
 return <div ref={host} onClickCapture={capture}>
  {(running||status||error)&&<div className="mx-5 lg:mx-8 mt-4 rounded-2xl border bg-white shadow-sm p-4">
   <div className="flex flex-wrap items-center gap-3"><div><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Analysis Control Plane</div><div className="text-sm font-semibold mt-1">{error?'Analysis needs attention':running?'Analysis in progress':status?.status==='completed'?'Analysis completed':'Analysis status'}</div></div>{status?.analysisRunId&&<code className="ml-auto text-[10px] text-slate-400">Run {String(status.analysisRunId).slice(0,12)}</code>}</div>
   <div className="grid grid-cols-3 gap-2 mt-3">{['understand','investigate','resolve'].map((s,i)=>{const v=stages[s]||(i===0&&running?'running':'blocked');return <div key={s} className="rounded-xl border px-3 py-2"><div className="text-[10px] uppercase text-slate-400">{i+1}. {s}</div><div className="text-xs font-semibold capitalize mt-1">{v}</div></div>})}</div>
   {error&&<div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"><b>Analysis failed:</b> {error}</div>}
   {running&&<div className="mt-3 text-[11px] text-slate-500">Orchestrator → Queue → Worker → Understand → Investigate → Resolve. This page is polling the live analysis run.</div>}
  </div>}
  <LegacyProjectWorkspace key={rootKey} projectId={projectId}/>
 </div>
}
