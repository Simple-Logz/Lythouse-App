// @ts-nocheck
import {useCallback,useEffect,useMemo,useState} from 'react';
import {resolveActiveWorkspace,supabase} from '../lib/supabase';
import {PageHeader,Spinner} from '../lib/ui';
import {ShieldCheck,CheckCircle2,AlertTriangle,XCircle} from 'lucide-react';

const cls={pass:'bg-emerald-50 text-emerald-700 border-emerald-200',warn:'bg-amber-50 text-amber-700 border-amber-200',fail:'bg-red-50 text-red-700 border-red-200'};
const Icon=({result})=>result==='pass'?<CheckCircle2 size={15}/>:result==='warn'?<AlertTriangle size={15}/>:<XCircle size={15}/>;

export function PolicyPage(){
  const[loading,setLoading]=useState(true),[error,setError]=useState(''),[workspace,setWorkspace]=useState(null),[evaluations,setEvaluations]=useState([]),[projects,setProjects]=useState([]),[changes,setChanges]=useState([]);
  const load=useCallback(async()=>{setLoading(true);setError('');try{const ws=await resolveActiveWorkspace();setWorkspace(ws);const[e,p,c]=await Promise.all([
    supabase.from('policy_evaluations').select('id,workspace_id,project_id,change_request_id,validation_id,policy_key,result,evidence,created_at').eq('workspace_id',ws.id).order('created_at',{ascending:false}).limit(250),
    supabase.from('projects').select('id,name').eq('workspace_id',ws.id),
    supabase.from('change_requests').select('id,title,status').eq('workspace_id',ws.id)
  ]);const bad=[e,p,c].find(x=>x.error);if(bad?.error)throw bad.error;setEvaluations(e.data||[]);setProjects(p.data||[]);setChanges(c.data||[])}catch(e){setError(e?.message||'Policy evaluations could not be loaded.')}finally{setLoading(false)}},[]);
  useEffect(()=>{load();const changed=()=>load();window.addEventListener('lythouse:workspace-changed',changed);return()=>window.removeEventListener('lythouse:workspace-changed',changed)},[load]);
  const stats=useMemo(()=>({pass:evaluations.filter(x=>x.result==='pass').length,warn:evaluations.filter(x=>x.result==='warn').length,fail:evaluations.filter(x=>x.result==='fail').length}),[evaluations]);
  const projectName=id=>projects.find(p=>p.id===id)?.name||'Unknown project';const changeName=id=>changes.find(c=>c.id===id)?.title||'Change request';
  if(loading)return <div className="flex justify-center py-24"><Spinner size={28}/></div>;
  return <div><PageHeader title="Policy Evaluation" description="Database-backed deployment policy results produced from real validation and change-request evidence."/>
    {error&&<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">{[['Evaluations',evaluations.length],['Passed',stats.pass],['Warnings',stats.warn],['Blocked',stats.fail]].map(([l,v])=><div className="card" key={l}><div className="text-2xl font-bold">{v}</div><div className="text-xs text-gray-500 mt-1">{l}</div></div>)}</div>
    <div className="card"><div className="flex items-center gap-2 mb-4"><ShieldCheck size={18}/><h2 className="font-semibold">Policy evidence</h2><span className="text-xs text-gray-400">{workspace?.name}</span></div>
      {!evaluations.length?<div className="py-10 text-center text-sm text-gray-500">No policy evaluations exist in this workspace yet. Complete a validation and create a change request to produce deployment-gate evidence.</div>:
      <div className="divide-y">{evaluations.map(ev=><div key={ev.id} className="py-4 flex flex-col lg:flex-row lg:items-start gap-3 lg:justify-between"><div><div className="font-medium">{ev.policy_key}</div><div className="text-xs text-gray-500 mt-1">{projectName(ev.project_id)} · {changeName(ev.change_request_id)}</div><div className="text-xs text-gray-400 mt-1">{new Date(ev.created_at).toLocaleString()}</div>{ev.evidence&&Object.keys(ev.evidence).length>0&&<pre className="mt-2 text-[11px] whitespace-pre-wrap bg-gray-50 border rounded-lg p-2 max-w-3xl overflow-auto">{JSON.stringify(ev.evidence,null,2)}</pre>}</div><span className={`inline-flex items-center gap-1.5 self-start border rounded-full px-2.5 py-1 text-xs font-semibold ${cls[ev.result]||cls.warn}`}><Icon result={ev.result}/>{ev.result}</span></div>)}</div>}
    </div><p className="text-xs text-gray-400 mt-3">A failed policy evaluation is deployment-blocking. This screen no longer stores policy state in the browser.</p></div>;
}
