import{useCallback,useEffect,useState}from'react';
import{supabase,type Finding,type FindingStatus}from'../lib/supabase';
import{Spinner,EmptyState,SeverityBadge,FindingStatusBadge}from'../lib/ui';
import{ShieldAlert,Check,EyeOff,FileCode,AlertTriangle,ChevronRight,ChevronDown,RefreshCw,ShieldCheck,Wrench,Bug,Lock,Package,Code2,X,Play}from'lucide-react';

type Props={projectId:string;onOpenFile:(path:string,line?:number)=>void;onRunValidation?:()=>void;};
type StatusFilter='all'|FindingStatus;
type SevFilter='all'|'critical'|'high'|'medium'|'low';
type CategoryFilter='all'|string;

const CATEGORY_LABELS:Record<string,{label:string;icon:typeof Bug;color:string}> = {
  secret_scan:{label:'Secrets & Credentials',icon:Lock,color:'text-red-600'},
  static_analysis:{label:'Code Security',icon:Code2,color:'text-amber-600'},
  dependency_audit:{label:'Dependency Vulnerabilities',icon:Package,color:'text-blue-600'},
  configuration:{label:'Configuration',icon:ShieldAlert,color:'text-purple-600'},
};

const SEV_ORDER:{[k:string]:number}={critical:0,high:1,medium:2,low:3};

function getCategoryMeta(cat:string){
  return CATEGORY_LABELS[cat]??{label:cat.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),icon:Bug,color:'text-gray-500'};
}

export function FindingsTab({projectId,onOpenFile,onRunValidation}:Props){
  const[findings,setFindings]=useState<Finding[]>([]);
  const[loading,setLoading]=useState(true);
  const[expanded,setExpanded]=useState<string|null>(null);
  const[statusFilter,setStatusFilter]=useState<StatusFilter>('open');
  const[sevFilter,setSevFilter]=useState<SevFilter>('all');
  const[catFilter,setCatFilter]=useState<CategoryFilter>('all');
  const[updating,setUpdating]=useState<string|null>(null);

  const fetchFindings=useCallback(async()=>{
    setLoading(true);
    const{data,error}=await supabase.from('findings').select('*').eq('project_id',projectId).order('created_at',{ascending:false});
    if(!error&&data)setFindings(data as Finding[]);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{fetchFindings();},[fetchFindings]);

  const updateStatus=useCallback(async(id:string,status:FindingStatus)=>{
    setUpdating(id);
    await supabase.from('findings').update({status,resolved_at:status==='resolved'?new Date().toISOString():null}).eq('id',id);
    setFindings(prev=>prev.map(f=>f.id===id?{...f,status,resolved_at:status==='resolved'?new Date().toISOString():null}:f));
    setUpdating(null);
  },[]);

  // Counts from all findings
  const open=findings.filter(f=>f.status==='open');
  const critical=open.filter(f=>f.severity==='critical');
  const high=open.filter(f=>f.severity==='high');
  const resolved=findings.filter(f=>f.status==='resolved');
  const ignored=findings.filter(f=>f.status==='ignored');

  // Categories present
  const categories=[...new Set(findings.map(f=>f.category))];

  // Filtered and sorted
  const filtered=findings
    .filter(f=>(statusFilter==='all'||f.status===statusFilter))
    .filter(f=>(sevFilter==='all'||f.severity===sevFilter))
    .filter(f=>(catFilter==='all'||f.category===catFilter))
    .sort((a,b)=>(SEV_ORDER[a.severity]??9)-(SEV_ORDER[b.severity]??9));

  // Group by category for display
  const grouped=filtered.reduce((acc,f)=>{
    if(!acc[f.category])acc[f.category]=[];
    acc[f.category].push(f);
    return acc;
  },{} as Record<string,Finding[]>);

  // Deployment readiness
  const verdict=critical.length>0?'No-Go':high.length>2?'Review Required':open.length>0?'Conditional':'Ready to Deploy';
  const verdictStyle=critical.length>0?'border-red-200 bg-red-50 text-danger-600':high.length>2?'border-amber-200 bg-amber-50 text-amber-700':open.length>0?'border-blue-200 bg-blue-50 text-blue-700':'border-green-200 bg-green-50 text-green-700';
  const VerdictIcon=critical.length>0?X:open.length===0?ShieldCheck:AlertTriangle;

  if(loading)return<div className="flex justify-center py-20"><Spinner size={22}/></div>;

  return(
    <div className="space-y-5">

      {/* Deployment verdict banner */}
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${verdictStyle}`}>
        <VerdictIcon size={17} className="shrink-0"/>
        <div className="flex-1">
          <p className="text-sm font-semibold">Deployment Verdict: {verdict}</p>
          <p className="text-xs opacity-75 mt-0.5">
            {critical.length>0?`${critical.length} critical issue${critical.length!==1?'s':''} must be resolved before deploying.`:
             high.length>2?`${high.length} high-severity issues found. Review before deploying to production.`:
             open.length>0?`${open.length} open finding${open.length!==1?'s':''} — none are blocking deployment.`:
             'All findings resolved. Project is clean for deployment.'}
          </p>
        </div>
        {findings.length===0&&onRunValidation&&(
          <button onClick={onRunValidation} className="btn-primary text-xs shrink-0"><Play size={13}/>Run Validation</button>
        )}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {label:'Critical',value:critical.length,color:'text-danger-600',bg:'bg-red-50',border:'border-red-200',filter:()=>{setSevFilter('critical');setStatusFilter('open');}},
          {label:'High',value:high.length,color:'text-amber-600',bg:'bg-amber-50',border:'border-amber-200',filter:()=>{setSevFilter('high');setStatusFilter('open');}},
          {label:'Open',value:open.length,color:'text-navy-900',bg:'bg-gray-50',border:'border-gray-200',filter:()=>{setSevFilter('all');setStatusFilter('open');}},
          {label:'Resolved',value:resolved.length,color:'text-green-600',bg:'bg-green-50',border:'border-green-200',filter:()=>{setSevFilter('all');setStatusFilter('resolved');}},
        ].map(c=>(
          <button key={c.label} onClick={c.filter} className={`card flex items-center justify-between py-3 px-4 border ${c.border} ${c.bg} hover:opacity-80 transition-opacity text-left`}>
            <div>
              <div className={`text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</div>
              <div className="text-xs font-medium text-gray-500 mt-0.5">{c.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status pills */}
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {(['all','open','resolved','ignored'] as StatusFilter[]).map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${statusFilter===s?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
              {s==='all'?'All':s}
            </button>
          ))}
        </div>

        {/* Severity pills */}
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {(['all','critical','high','medium','low'] as SevFilter[]).map(s=>(
            <button key={s} onClick={()=>setSevFilter(s)} className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${sevFilter===s?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
              {s==='all'?'All severity':s}
            </button>
          ))}
        </div>

        {/* Category filter */}
        {categories.length>1&&(
          <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="input text-xs py-1.5 h-auto">
            <option value="all">All categories</option>
            {categories.map(c=><option key={c} value={c}>{getCategoryMeta(c).label}</option>)}
          </select>
        )}

        <button onClick={fetchFindings} className="btn-secondary text-xs ml-auto">
          <RefreshCw size={13}/>Refresh
        </button>
      </div>

      {/* Results count */}
      {findings.length>0&&(
        <p className="text-xs text-gray-400">
          Showing {filtered.length} of {findings.length} findings
          {statusFilter!=='all'?` · ${statusFilter}`:''}
          {sevFilter!=='all'?` · ${sevFilter}`:''}
        </p>
      )}

      {/* Empty state */}
      {filtered.length===0?(
        <EmptyState
          icon={<ShieldCheck size={26}/>}
          title={findings.length===0?'No findings yet':'No findings match your filters'}
          description={findings.length===0?'Run a validation to scan this project for security issues, exposed secrets, and vulnerable dependencies.':'Try changing the filters above to see more results.'}
          action={findings.length===0&&onRunValidation?<button onClick={onRunValidation} className="btn-primary"><Play size={15}/>Run Validation</button>:undefined}
        />
      ):(
        /* Grouped by category */
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat,items])=>{
            const meta=getCategoryMeta(cat);
            const CatIcon=meta.icon;
            return(
              <div key={cat}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-2">
                  <CatIcon size={15} className={meta.color}/>
                  <h3 className="text-sm font-semibold text-navy-900">{meta.label}</h3>
                  <span className="chip bg-gray-100 text-gray-500 border border-gray-200">{items.length}</span>
                </div>

                <div className="space-y-1.5">
                  {items.map(f=>{
                    const isOpen=expanded===f.id;
                    return(
                      <div key={f.id} className={`rounded-xl border overflow-hidden transition-all ${f.severity==='critical'?'border-red-200':f.severity==='high'?'border-amber-200':'border-gray-200'}`}>
                        {/* Row */}
                        <button className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/80 ${isOpen?'bg-gray-50':''}`} onClick={()=>setExpanded(isOpen?null:f.id)}>
                          {isOpen?<ChevronDown size={14} className="shrink-0 text-gray-400"/>:<ChevronRight size={14} className="shrink-0 text-gray-400"/>}
                          <SeverityBadge severity={f.severity}/>
                          <span className="flex-1 text-sm font-medium text-navy-900 text-left">{f.title}</span>
                          {f.file_path&&(
                            <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400 font-mono">
                              <FileCode size={11}/>{f.file_path.split('/').slice(-2).join('/')}{f.line?`:${f.line}`:''}
                            </span>
                          )}
                          <FindingStatusBadge status={f.status}/>
                        </button>

                        {/* Expanded detail */}
                        {isOpen&&(
                          <div className="border-t border-gray-100 bg-white px-4 py-4 space-y-4">

                            {/* What was detected */}
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">What was detected</p>
                              <p className="text-sm text-gray-700 leading-relaxed">{f.description}</p>
                            </div>

                            {/* File location */}
                            {f.file_path&&(
                              <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                                <FileCode size={14} className="text-gray-400 shrink-0"/>
                                <code className="text-xs text-navy-800 flex-1">{f.file_path}{f.line?`:${f.line}`:''}</code>
                                <button onClick={()=>onOpenFile(f.file_path??'',f.line??undefined)} className="text-xs text-brand-600 hover:underline font-medium">Open file</button>
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

                            {/* Actions */}
                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
                              {f.file_path&&(
                                <button onClick={()=>onOpenFile(f.file_path??'',f.line??undefined)} className="btn-secondary text-xs">
                                  <FileCode size={13}/>View in editor
                                </button>
                              )}
                              {f.status!=='resolved'&&(
                                <button onClick={()=>updateStatus(f.id,'resolved')} disabled={updating===f.id} className="btn-primary text-xs">
                                  {updating===f.id?<RefreshCw size={13} className="animate-spin"/>:<Check size={13}/>}Mark resolved
                                </button>
                              )}
                              {f.status!=='ignored'&&f.status!=='resolved'&&(
                                <button onClick={()=>updateStatus(f.id,'ignored')} disabled={updating===f.id} className="btn-secondary text-xs">
                                  <EyeOff size={13}/>Ignore
                                </button>
                              )}
                              {f.status!=='open'&&(
                                <button onClick={()=>updateStatus(f.id,'open')} disabled={updating===f.id} className="btn-ghost text-xs">
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
