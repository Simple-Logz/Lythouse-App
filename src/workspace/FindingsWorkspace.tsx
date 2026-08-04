// @ts-nocheck
import{useCallback,useEffect,useState}from'react';
import{supabase,type Finding,type Validation,anonKey,edgeFunctionUrl}from'../lib/supabase';
import{useAuth}from'../lib/auth';
import{Spinner,EmptyState}from'../lib/ui';
import{ShieldAlert,Play,RefreshCw,Filter,Search,X,ChevronDown,ChevronRight,Sparkles,Zap,GitPullRequest,Ticket,MessageSquare,Check,EyeOff,RotateCcw,FileCode,Loader as Loader2,Copy,CheckCircle2,AlertTriangle,Clock,User,Flag}from'lucide-react';

type BizSev='blocker'|'attention'|'recommendation'|'informational';
const toBiz=(s:string):BizSev=>s==='critical'?'blocker':s==='high'?'attention':s==='medium'?'recommendation':'informational';
const BIZ={
  blocker:{label:'Deployment Blocker',color:'text-red-700',bg:'bg-red-50',border:'border-red-300',dot:'bg-red-500'},
  attention:{label:'Needs Attention',color:'text-amber-700',bg:'bg-amber-50',border:'border-amber-300',dot:'bg-amber-500'},
  recommendation:{label:'Recommendation',color:'text-blue-700',bg:'bg-blue-50',border:'border-blue-300',dot:'bg-blue-500'},
  informational:{label:'Informational',color:'text-gray-600',bg:'bg-gray-50',border:'border-[#a1a1aa]',dot:'bg-gray-400'},
};

type WorkItem=Finding&{owner?:string;eta?:string;};

export function FindingsWorkspace({projectId,onRunValidation,running,onOpenFile}:{projectId:string;onRunValidation:()=>void;running:boolean;onOpenFile:(path:string,line?:number)=>void;}){
  const{profile}=useAuth();
  const[findings,setFindings]=useState<WorkItem[]>([]);
  const[validations,setValidations]=useState<Validation[]>([]);
  const[loading,setLoading]=useState(true);
  const[expanded,setExpanded]=useState<string|null>(null);
  const[search,setSearch]=useState('');
  const[statusFilter,setStatusFilter]=useState<'open'|'resolved'|'all'>('open');
  const[sevFilter,setSevFilter]=useState<BizSev|'all'>('all');
  const[updating,setUpdating]=useState<string|null>(null);
  const[aiState,setAiState]=useState<Record<string,{explain?:string;fix?:string;loading?:string}>>({});
  const[copied,setCopied]=useState<string|null>(null);
  const[ownerMap,setOwnerMap]=useState<Record<string,{owner:string;eta:string}>>({});

  const load=useCallback(async()=>{
    setLoading(true);
    const[fr,vr]=await Promise.all([
      supabase.from('findings').select('*').eq('project_id',projectId).order('created_at',{ascending:false}),
      supabase.from('validations').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(5),
    ]);
    setFindings((fr.data??[]) as WorkItem[]);
    setValidations((vr.data??[]) as Validation[]);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{load();},[load]);

  const updateStatus=async(id:string,status:string)=>{
    setUpdating(id);
    await supabase.from('findings').update({status,resolved_at:status==='resolved'?new Date().toISOString():null}).eq('id',id);
    setFindings(prev=>prev.map(f=>f.id===id?{...f,status:status as any,resolved_at:status==='resolved'?new Date().toISOString():null}:f));
    setUpdating(null);
  };

  const callAI=async(id:string,type:'explain'|'fix',f:Finding)=>{
    setAiState(prev=>({...prev,[id]:{...prev[id],loading:type}}));
    const prompt=type==='explain'
      ?`Explain this security finding in business language:\n\nTitle: ${f.title}\nDescription: ${f.description}\nFile: ${f.file_path||'unknown'}${f.line?`:${f.line}`:''}\nCategory: ${f.category}\n\nInclude: what happened, why it matters to the business, CVEs if applicable, OWASP reference, 1-sentence executive summary.`
      :`Generate a complete fix for this security finding:\n\nTitle: ${f.title}\nDescription: ${f.description}\nFile: ${f.file_path||'unknown'}${f.line?`:${f.line}`:''}\nRecommendation: ${f.recommendation||'See description'}\n\nProvide: exact code fix (before/after), files to modify, risk of applying fix, tests to verify.`;
    try{
      const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({systemPrompt:'You are a senior DevSecOps engineer. Be specific and actionable.',messages:[{role:'user',content:prompt}]})
      });
      if(res.ok){const d=await res.json();setAiState(prev=>({...prev,[id]:{...prev[id],[type]:d.content,loading:undefined}}));}
      else setAiState(prev=>({...prev,[id]:{...prev[id],loading:undefined}}));
    }catch{setAiState(prev=>({...prev,[id]:{...prev[id],loading:undefined}}));}
  };

  const filtered=findings.filter(f=>{
    if(statusFilter!=='all'&&f.status!==statusFilter)return false;
    if(sevFilter!=='all'&&toBiz(f.severity)!==sevFilter)return false;
    if(search&&!f.title.toLowerCase().includes(search.toLowerCase())&&!f.file_path?.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  const blockers=findings.filter(f=>f.status==='open'&&f.severity==='critical');
  const attention=findings.filter(f=>f.status==='open'&&f.severity==='high');
  const resolved=findings.filter(f=>f.status==='resolved');
  const open=findings.filter(f=>f.status==='open');

  if(loading)return<div className="flex justify-center py-16"><Spinner size={22}/></div>;

  return(
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2"><ShieldAlert size={18} className="text-brand-600"/>Findings — Work Items</h2>
          <p className="text-sm text-gray-500 mt-0.5">Every finding is a tracked work item. Assign owners, generate fixes, create tickets, and verify resolution.</p>
        </div>
        <button onClick={onRunValidation} disabled={running} className="btn-primary text-sm shrink-0">
          {running?<><Loader2 size={13} className="animate-spin"/>Scanning…</>:<><Play size={13}/>Revalidate</>}
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {label:'Deployment Blockers',value:blockers.length,color:'text-red-600',bg:'bg-red-50',border:'border-red-200',onClick:()=>{setSevFilter('blocker');setStatusFilter('open');}},
          {label:'Needs Attention',value:attention.length,color:'text-amber-600',bg:'bg-amber-50',border:'border-amber-200',onClick:()=>{setSevFilter('attention');setStatusFilter('open');}},
          {label:'Total Open',value:open.length,color:'text-navy-900',bg:'bg-gray-50',border:'border-[#a1a1aa]',onClick:()=>{setSevFilter('all');setStatusFilter('open');}},
          {label:'Resolved',value:resolved.length,color:'text-green-600',bg:'bg-green-50',border:'border-green-200',onClick:()=>{setSevFilter('all');setStatusFilter('resolved');}},
        ].map(s=>(
          <button key={s.label} onClick={s.onClick} className={`card border ${s.border} ${s.bg} hover:shadow-md transition-all text-left`}>
            <div className={`text-3xl font-semibold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-xs font-medium text-gray-600 mt-1">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search findings…" className="input pl-8 text-sm w-full"/>
          {search&&<button onClick={()=>setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"><X size={12}/></button>}
        </div>
        <div className="flex gap-1 rounded-lg border border-[#a1a1aa] bg-gray-50 p-1">
          {(['open','all','resolved'] as const).map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} className={'px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors '+(statusFilter===s?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700')}>{s==='all'?'All':s}</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-[#a1a1aa] bg-gray-50 p-1">
          {([{id:'all',label:'All'},{id:'blocker',label:'Blockers'},{id:'attention',label:'Attention'},{id:'recommendation',label:'Recs'},{id:'informational',label:'Info'}] as const).map(s=>(
            <button key={s.id} onClick={()=>setSevFilter(s.id as any)} className={'px-3 py-1.5 rounded-md text-xs font-medium transition-colors '+(sevFilter===s.id?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700')}>{s.label}</button>
          ))}
        </div>
        <button onClick={load} className="btn-secondary text-xs"><RefreshCw size={12}/>Refresh</button>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {findings.length}</span>
      </div>

      {/* Resolution progress */}
      {findings.length>0&&(
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-2 rounded-full bg-green-500 transition-all" style={{width:`${findings.length>0?Math.round((resolved.length/findings.length)*100):0}%`}}/>
          </div>
          <span className="text-xs text-gray-500 shrink-0">{Math.round((resolved.length/Math.max(findings.length,1))*100)}% resolved</span>
        </div>
      )}

      {/* Empty state */}
      {filtered.length===0&&(
        <EmptyState icon={<ShieldAlert size={26}/>} title={findings.length===0?'No findings yet':'No findings match filters'} description={findings.length===0?'Run a validation to scan this project for security issues.':undefined} action={findings.length===0?<button onClick={onRunValidation} disabled={running} className="btn-primary"><Play size={14}/>Run Validation</button>:undefined}/>
      )}

      {/* Work items */}
      <div className="space-y-2">
        {filtered.map(f=>{
          const biz=toBiz(f.severity);
          const meta=BIZ[biz];
          const isOpen=expanded===f.id;
          const ai=aiState[f.id]||{};
          const owner=ownerMap[f.id];

          return(
            <div key={f.id} className={`rounded-xl border-2 overflow-hidden transition-all ${meta.border} ${f.status==='resolved'?'opacity-55':''}`}>
              {/* Item header */}
              <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:brightness-[0.98] ${meta.bg}`} onClick={()=>setExpanded(isOpen?null:f.id)}>
                {isOpen?<ChevronDown size={14} className="text-gray-400 shrink-0"/>:<ChevronRight size={14} className="text-gray-400 shrink-0"/>}
                <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`}/>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color} ${meta.border}`}>{meta.label}</span>
                    <span className="text-sm font-semibold text-navy-900">{f.title}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {f.file_path&&<span className="font-mono flex items-center gap-1"><FileCode size={10}/>{f.file_path.split('/').slice(-2).join('/')}{f.line?`:${f.line}`:''}</span>}
                    {owner?.owner&&<span className="flex items-center gap-1"><User size={10}/>{owner.owner}</span>}
                    {owner?.eta&&<span className="flex items-center gap-1"><Clock size={10}/>ETA: {owner.eta}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0" onClick={e=>e.stopPropagation()}>
                  {f.status==='open'?<>
                    <button onClick={()=>updateStatus(f.id,'resolved')} disabled={updating===f.id} className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">{updating===f.id?<Loader2 size={11} className="animate-spin"/>:<Check size={11}/>}Resolve</button>
                    <button onClick={()=>updateStatus(f.id,'ignored')} disabled={updating===f.id} className="px-2 py-1 text-xs text-gray-500 border border-[#a1a1aa] rounded-lg hover:bg-gray-100">Ignore</button>
                  </>:<span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 size={13}/>Resolved</span>}
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen&&(
                <div className="bg-white border-t border-gray-100 px-4 py-4 space-y-4">
                  {/* Description + recommendation */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className={`rounded-lg border ${meta.border} ${meta.bg} px-3 py-2.5`}>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Why it matters</p>
                      <p className="text-sm text-gray-700">{f.description||'No description.'}</p>
                    </div>
                    <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Suggested fix</p>
                      <p className="text-sm text-gray-700">{f.recommendation||'Generate an AI fix below.'}</p>
                    </div>
                  </div>

                  {/* File */}
                  {f.file_path&&(
                    <div className="flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2">
                      <FileCode size={13} className="text-gray-400 shrink-0"/>
                      <code className="text-xs text-green-400 flex-1">{f.file_path}{f.line?`:${f.line}`:''}</code>
                      <button onClick={()=>onOpenFile(f.file_path!,f.line??undefined)} className="text-xs text-brand-400 hover:text-brand-300 font-medium shrink-0">Open in editor →</button>
                    </div>
                  )}

                  {/* Assign */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input value={owner?.owner||''} onChange={e=>setOwnerMap(prev=>({...prev,[f.id]:{...(prev[f.id]||{}),owner:e.target.value,eta:prev[f.id]?.eta||''}}))} placeholder="Assign owner…" className="input pl-8 text-sm py-1.5"/>
                    </div>
                    <div className="relative w-40">
                      <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input value={owner?.eta||''} onChange={e=>setOwnerMap(prev=>({...prev,[f.id]:{...(prev[f.id]||{}),eta:e.target.value,owner:prev[f.id]?.owner||''}}))} placeholder="ETA…" className="input pl-8 text-sm py-1.5"/>
                    </div>
                  </div>

                  {/* AI Explain */}
                  {ai.explain&&(
                    <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-purple-700 mb-2 flex items-center gap-1.5"><Sparkles size={11}/>AI Explanation</p>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ai.explain}</div>
                    </div>
                  )}

                  {/* AI Fix */}
                  {ai.fix&&(
                    <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700 flex items-center gap-1.5"><Zap size={11}/>AI-Generated Fix</p>
                        <button onClick={async()=>{await navigator.clipboard.writeText(ai.fix!);setCopied(f.id);setTimeout(()=>setCopied(null),2000);}} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                          {copied===f.id?<><Check size={11}/>Copied</>:<><Copy size={11}/>Copy fix</>}
                        </button>
                      </div>
                      <pre className="text-xs text-gray-800 whitespace-pre-wrap bg-white rounded-lg p-3 border border-brand-200 overflow-x-auto">{ai.fix}</pre>
                      <div className="flex gap-2 mt-3">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700"><Zap size={12}/>Apply Fix</button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[#a1a1aa] text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50"><GitPullRequest size={12}/>Create PR</button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <button onClick={()=>callAI(f.id,'explain',f)} disabled={!!ai.loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 disabled:opacity-50">
                      {ai.loading==='explain'?<Loader2 size={12} className="animate-spin"/>:<Sparkles size={12}/>}{ai.explain?'Re-explain':'Explain'}
                    </button>
                    <button onClick={()=>callAI(f.id,'fix',f)} disabled={!!ai.loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 disabled:opacity-50">
                      {ai.loading==='fix'?<Loader2 size={12} className="animate-spin"/>:<Zap size={12}/>}{ai.fix?'Regenerate Fix':'Generate AI Fix'}
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#a1a1aa] bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100">
                      <Ticket size={12}/>Create Ticket
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#a1a1aa] bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100">
                      <GitPullRequest size={12}/>Create PR
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#a1a1aa] bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100">
                      <MessageSquare size={12}/>Notify Slack
                    </button>
                    <button onClick={onRunValidation} disabled={running} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#a1a1aa] bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100">
                      <RefreshCw size={12}/>Revalidate
                    </button>
                    {f.status!=='open'&&<button onClick={()=>updateStatus(f.id,'open')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#a1a1aa] text-gray-500 text-xs ml-auto hover:bg-gray-50">
                      <RotateCcw size={12}/>Reopen
                    </button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
