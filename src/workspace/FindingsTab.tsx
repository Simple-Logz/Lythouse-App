import{useCallback,useEffect,useState}from'react';
import{supabase,type Finding,type FindingStatus,anonKey,edgeFunctionUrl}from'../lib/supabase';
import{Spinner,EmptyState,SeverityBadge,FindingStatusBadge}from'../lib/ui';
import{ShieldAlert,Check,EyeOff,FileCode,AlertTriangle,ChevronRight,ChevronDown,RefreshCw,ShieldCheck,Wrench,Lock,Package,Code2,X,Play,Sparkles,Copy,CheckCircle2,TrendingDown,Loader as Loader2}from'lucide-react';

type Props={projectId:string;onOpenFile:(path:string,line?:number,ctx?:{title:string;recommendation:string;line?:number;file?:string}|null)=>void;onRunValidation?:()=>void;};
type StatusFilter='all'|FindingStatus;
type SevFilter='all'|'critical'|'high'|'medium'|'low';

const CATEGORY_LABELS:Record<string,{label:string;icon:typeof Code2;color:string}>={
  secret_scan:{label:'Secrets & Credentials',icon:Lock,color:'text-red-600'},
  static_analysis:{label:'Code Security',icon:Code2,color:'text-amber-600'},
  dependency_audit:{label:'Dependency Vulnerabilities',icon:Package,color:'text-blue-600'},
  configuration:{label:'Configuration Issues',icon:ShieldAlert,color:'text-purple-600'},
};
const SEV_ORDER:{[k:string]:number}={critical:0,high:1,medium:2,low:3};

function getCategoryMeta(cat:string){
  return CATEGORY_LABELS[cat]??{label:cat.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),icon:ShieldAlert,color:'text-gray-500'};
}

function getPriorityMessage(findings:Finding[]):{message:string;sub:string;color:string}|null{
  const open=findings.filter(f=>f.status==='open');
  const crit=open.filter(f=>f.severity==='critical');
  const high=open.filter(f=>f.severity==='high');
  if(open.length===0)return null;
  if(crit.length>0)return{
    message:`Fix ${crit.length} critical issue${crit.length!==1?'s':''} before deploying`,
    sub:`Start with: "${crit[0].title}" — resolving critical findings blocks the most risk.`,
    color:'border-red-200 bg-red-50 text-danger-600'
  };
  if(high.length>0)return{
    message:`${high.length} high-severity issue${high.length!==1?'s':''} need review`,
    sub:`Fixing these will significantly improve your deployment readiness score.`,
    color:'border-amber-200 bg-amber-50 text-amber-700'
  };
  return{
    message:`${open.length} open finding${open.length!==1?'s':''} — low priority`,
    sub:'No critical or high findings. These are informational and can be addressed over time.',
    color:'border-blue-200 bg-blue-50 text-blue-700'
  };
}

export function FindingsTab({projectId,onOpenFile,onRunValidation}:Props){
  const[findings,setFindings]=useState<Finding[]>([]);
  const[loading,setLoading]=useState(true);
  const[expanded,setExpanded]=useState<string|null>(null);
  const[statusFilter,setStatusFilter]=useState<StatusFilter>('open');
  const[sevFilter,setSevFilter]=useState<SevFilter>('all');
  const[updating,setUpdating]=useState<string|null>(null);
  const[generatingFix,setGeneratingFix]=useState<string|null>(null);
  const[generatedFixes,setGeneratedFixes]=useState<Record<string,string>>({});
  const[copied,setCopied]=useState<string|null>(null);

  const fetchFindings=useCallback(async()=>{
    setLoading(true);
    const{data}=await supabase.from('findings').select('*').eq('project_id',projectId).order('created_at',{ascending:false});
    setFindings((data??[]) as Finding[]);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{fetchFindings();},[fetchFindings]);

  const updateStatus=useCallback(async(id:string,status:FindingStatus)=>{
    setUpdating(id);
    await supabase.from('findings').update({status,resolved_at:status==='resolved'?new Date().toISOString():null}).eq('id',id);
    setFindings(prev=>prev.map(f=>f.id===id?{...f,status,resolved_at:status==='resolved'?new Date().toISOString():null}:f));
    setUpdating(null);
  },[]);

  const generateFix=async(f:Finding)=>{
    if(generatedFixes[f.id])return;
    setGeneratingFix(f.id);
    try{
      const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({
          systemPrompt:`You are a senior software engineer. Generate a concrete, copy-pasteable fix for a security finding. Be direct and specific. Return ONLY the fix — no explanation, no markdown fences, just the code or command the developer should run or apply.`,
          messages:[{role:'user',content:`Finding: ${f.title}\nDescription: ${f.description||''}\nFile: ${f.file_path||'unknown'}${f.line?`:${f.line}`:''}\nRecommendation: ${f.recommendation||''}\n\nProvide the exact fix code or command to resolve this.`}]
        })
      });
      if(res.ok){const d=await res.json();setGeneratedFixes(prev=>({...prev,[f.id]:d.content||'No fix generated.'}));}
      else{setGeneratedFixes(prev=>({...prev,[f.id]:'Failed to generate fix. Check that the ai-chat edge function is deployed.'}));}
    }catch{setGeneratedFixes(prev=>({...prev,[f.id]:'Failed to connect to AI service.'}));}
    setGeneratingFix(null);
  };

  const copyFix=async(id:string,text:string)=>{
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(()=>setCopied(null),2000);
  };

  const open=findings.filter(f=>f.status==='open');
  const resolved=findings.filter(f=>f.status==='resolved');
  const priority=getPriorityMessage(findings);

  const filtered=findings
    .filter(f=>(statusFilter==='all'||f.status===statusFilter))
    .filter(f=>(sevFilter==='all'||f.severity===sevFilter))
    .sort((a,b)=>(SEV_ORDER[a.severity]??9)-(SEV_ORDER[b.severity]??9));

  const grouped=filtered.reduce((acc,f)=>{
    if(!acc[f.category])acc[f.category]=[];
    acc[f.category].push(f);
    return acc;
  },{} as Record<string,Finding[]>);

  if(loading)return<div className="flex justify-center py-20"><Spinner size={22}/></div>;

  return(
    <div className="space-y-5">
      {/* Priority action banner */}
      {priority&&(
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${priority.color}`}>
          <AlertTriangle size={17} className="shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="text-sm font-semibold">{priority.message}</p>
            <p className="text-xs opacity-80 mt-0.5">{priority.sub}</p>
          </div>
        </div>
      )}

      {/* Resolution progress */}
      {findings.length>0&&(
        <div className="card py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resolution Progress</p>
            <p className="text-xs text-gray-500">{resolved.length} of {findings.length} resolved</p>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-2 rounded-full bg-green-500 transition-all" style={{width:`${findings.length>0?Math.round((resolved.length/findings.length)*100):0}%`}}/>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{open.length} open</span>
            <span className="text-green-600 font-medium">{resolved.length} resolved</span>
          </div>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {label:'Critical',value:findings.filter(f=>f.status==='open'&&f.severity==='critical').length,color:'text-danger-600',bg:'bg-red-50',border:'border-red-200',f:()=>{setSevFilter('critical');setStatusFilter('open');}},
          {label:'High',value:findings.filter(f=>f.status==='open'&&f.severity==='high').length,color:'text-amber-600',bg:'bg-amber-50',border:'border-amber-200',f:()=>{setSevFilter('high');setStatusFilter('open');}},
          {label:'Open',value:open.length,color:'text-navy-900',bg:'bg-gray-50',border:'border-gray-200',f:()=>{setSevFilter('all');setStatusFilter('open');}},
          {label:'Resolved',value:resolved.length,color:'text-green-600',bg:'bg-green-50',border:'border-green-200',f:()=>{setSevFilter('all');setStatusFilter('resolved');}},
        ].map(c=>(
          <button key={c.label} onClick={c.f} className={`card flex items-center justify-between py-3 px-4 border ${c.border} ${c.bg} hover:opacity-80 transition-opacity text-left`}>
            <div>
              <div className={`text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</div>
              <div className="text-xs font-medium text-gray-500 mt-0.5">{c.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {(['all','open','resolved','ignored'] as StatusFilter[]).map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${statusFilter===s?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{s==='all'?'All':s}</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {(['all','critical','high','medium','low'] as SevFilter[]).map(s=>(
            <button key={s} onClick={()=>setSevFilter(s)} className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${sevFilter===s?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{s==='all'?'All severity':s}</button>
          ))}
        </div>
        <button onClick={fetchFindings} className="btn-secondary text-xs ml-auto"><RefreshCw size={13}/>Refresh</button>
      </div>

      {filtered.length>0&&<p className="text-xs text-gray-400">Showing {filtered.length} of {findings.length} findings</p>}

      {/* Empty state */}
      {filtered.length===0?(
        <EmptyState
          icon={<ShieldCheck size={26}/>}
          title={findings.length===0?'No findings yet':'No findings match your filters'}
          description={findings.length===0?'Run a validation to scan this project. Findings will appear here with recommended fixes.':'Try changing the filters above.'}
          action={findings.length===0&&onRunValidation?<button onClick={onRunValidation} className="btn-primary"><Play size={15}/>Run Validation</button>:undefined}
        />
      ):(
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat,items])=>{
            const meta=getCategoryMeta(cat);
            const CatIcon=meta.icon;
            const catResolved=items.filter(f=>f.status==='resolved').length;
            return(
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <CatIcon size={15} className={meta.color}/>
                  <h3 className="text-sm font-semibold text-navy-900">{meta.label}</h3>
                  <span className="chip bg-gray-100 text-gray-500 border border-gray-200">{items.length}</span>
                  {catResolved>0&&<span className="chip bg-green-50 text-green-700 border border-green-200 ml-1"><CheckCircle2 size={10}/>{catResolved} resolved</span>}
                </div>
                <div className="space-y-1.5">
                  {items.map(f=>{
                    const isOpen=expanded===f.id;
                    const hasGeneratedFix=!!generatedFixes[f.id];
                    return(
                      <div key={f.id} className={`rounded-xl border overflow-hidden transition-all ${f.status==='resolved'?'opacity-60 border-gray-200':f.severity==='critical'?'border-red-200':f.severity==='high'?'border-amber-200':'border-gray-200'}`}>
                        <button className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/80 ${isOpen?'bg-gray-50':''}`} onClick={()=>setExpanded(isOpen?null:f.id)}>
                          {isOpen?<ChevronDown size={14} className="shrink-0 text-gray-400"/>:<ChevronRight size={14} className="shrink-0 text-gray-400"/>}
                          <SeverityBadge severity={f.severity}/>
                          <span className="flex-1 text-sm font-medium text-navy-900 text-left">{f.title}</span>
                          {f.file_path&&<span className="hidden sm:flex items-center gap-1 text-xs text-gray-400 font-mono"><FileCode size={11}/>{f.file_path.split('/').slice(-2).join('/')}{f.line?`:${f.line}`:''}</span>}
                          <FindingStatusBadge status={f.status}/>
                        </button>

                        {isOpen&&(
                          <div className="border-t border-gray-100 bg-white px-4 py-4 space-y-4">
                            {/* What was detected */}
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">What was detected</p>
                              <p className="text-sm text-gray-700 leading-relaxed">{f.description||'No description available.'}</p>
                            </div>

                            {/* File location */}
                            {f.file_path&&(
                              <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                                <FileCode size={14} className="text-gray-400 shrink-0"/>
                                <code className="text-xs text-navy-800 flex-1">{f.file_path}{f.line?`:${f.line}`:''}</code>
                                <button onClick={()=>onOpenFile(f.file_path??'',f.line??undefined,{title:f.title,recommendation:f.recommendation||'',line:f.line??undefined,file:f.file_path??undefined})} className="text-xs text-brand-600 hover:underline font-medium">View file →</button>
                              </div>
                            )}

                            {/* Recommended fix */}
                            {f.recommendation&&(
                              <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Wrench size={13} className="text-brand-600"/>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Recommended Fix</p>
                                </div>
                                <p className="text-sm text-brand-900 leading-relaxed">{f.recommendation}</p>
                              </div>
                            )}

                            {/* AI Generated Fix */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                  <Sparkles size={13} className="text-brand-600"/>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">AI-Generated Fix</p>
                                </div>
                                {!hasGeneratedFix&&(
                                  <button onClick={()=>generateFix(f)} disabled={generatingFix===f.id} className="btn-secondary text-xs">
                                    {generatingFix===f.id?<><Loader2 size={12} className="animate-spin"/>Generating…</>:<><Sparkles size={12}/>Generate fix</>}
                                  </button>
                                )}
                                {hasGeneratedFix&&(
                                  <button onClick={()=>copyFix(f.id,generatedFixes[f.id])} className="btn-secondary text-xs">
                                    {copied===f.id?<><Check size={12}/>Copied!</>:<><Copy size={12}/>Copy fix</>}
                                  </button>
                                )}
                              </div>
                              {hasGeneratedFix?(
                                <pre className="bg-gray-900 text-green-400 rounded-lg px-4 py-3 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{generatedFixes[f.id]}</pre>
                              ):(
                                <p className="text-xs text-gray-400 italic">Click "Generate fix" to get AI-written code you can apply immediately.</p>
                              )}
                            </div>

                            {/* Confidence */}
                            {f.confidence!==null&&(
                              <div className="flex items-center gap-3">
                                <p className="text-xs text-gray-400">Detection confidence</p>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 rounded-full bg-gray-200">
                                    <div className={`h-1.5 rounded-full ${f.confidence>80?'bg-green-500':f.confidence>60?'bg-amber-400':'bg-red-400'}`} style={{width:`${f.confidence}%`}}/>
                                  </div>
                                  <span className="text-xs font-semibold text-navy-800">{Math.round(f.confidence)}%</span>
                                </div>
                              </div>
                            )}

                            {/* Step by step fix guidance */}
                            {f.status!=='resolved'&&(
                              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">How to fix this</p>
                                {[
                                  f.file_path?`1. Open ${f.file_path}${f.line?` at line ${f.line}`:''}`:null,
                                  f.recommendation?`2. ${f.recommendation}`:null,
                                  '3. Save the file and click "Mark as resolved" below',
                                  '4. Run a new validation to confirm the issue is gone',
                                ].filter(Boolean).map((step,i)=>(
                                  <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                    <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-[10px] mt-0.5">{i+1}</span>
                                    <span>{(step as string).replace(/^\d+\.\s*/,'')}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                              {f.file_path&&(
                                <button onClick={()=>onOpenFile(f.file_path??'',f.line??undefined,{title:f.title,recommendation:f.recommendation||'',line:f.line??undefined,file:f.file_path??undefined})} className="btn-secondary text-xs">
                                  <FileCode size={13}/>Open file{f.line?` (line ${f.line})`:''}
                                </button>
                              )}
                              {f.status!=='resolved'&&(
                                <button onClick={()=>updateStatus(f.id,'resolved')} disabled={updating===f.id} className="btn-primary text-xs">
                                  {updating===f.id?<RefreshCw size={13} className="animate-spin"/>:<Check size={13}/>}Mark as resolved
                                </button>
                              )}
                              {f.status!=='ignored'&&f.status!=='resolved'&&(
                                <button onClick={()=>updateStatus(f.id,'ignored')} disabled={updating===f.id} className="btn-secondary text-xs">
                                  <EyeOff size={13}/>Accept risk
                                </button>
                              )}
                              {f.status==='resolved'&&(
                                <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                                  <CheckCircle2 size={14}/>Resolved — risk score improved
                                </div>
                              )}
                              {f.status!=='open'&&(
                                <button onClick={()=>updateStatus(f.id,'open')} disabled={updating===f.id} className="btn-ghost text-xs ml-auto">
                                  <RefreshCw size={13}/>Reopen
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
