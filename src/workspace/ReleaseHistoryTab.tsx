import{useCallback,useEffect,useState}from'react';
import{supabase,type Finding,type Validation}from'../lib/supabase';
import{Spinner,EmptyState}from'../lib/ui';
import{Clock,CheckCircle2,XCircle,RotateCcw,BarChart3,ChevronDown,ChevronRight,Plus,Loader as Loader2}from'lucide-react';
import{useAuth}from'../lib/auth';

type RH={id:string;project_id:string;workspace_id:string;release_name:string;version:string|null;environment:string;status:string;risk_score:number|null;readiness_score:number|null;deployment_time_ms:number|null;approved_by:string[];rollback_available:boolean;rollback_version:string|null;findings_at_release:number;created_at:string;completed_at:string|null;};

export function ReleaseHistoryTab({projectId,workspaceId}:{projectId:string;workspaceId:string;}){
  const{user,profile}=useAuth();
  const[history,setHistory]=useState<RH[]>([]);
  const[validations,setValidations]=useState<Validation[]>([]);
  const[findings,setFindings]=useState<Finding[]>([]);
  const[loading,setLoading]=useState(true);
  const[expanded,setExpanded]=useState<string|null>(null);
  const[creating,setCreating]=useState(false);
  const[relName,setRelName]=useState('');
  const[relVersion,setRelVersion]=useState('');
  const[relEnv,setRelEnv]=useState('production');
  const[saving,setSaving]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    const[hr,vr,fr]=await Promise.all([
      supabase.from('release_history').select('*').eq('project_id',projectId).order('created_at',{ascending:false}),
      supabase.from('validations').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(5),
      supabase.from('findings').select('*').eq('project_id',projectId),
    ]);
    setHistory((hr.data??[]) as RH[]);
    setValidations((vr.data??[]) as Validation[]);
    setFindings((fr.data??[]) as Finding[]);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{load();},[load]);

  const recordRelease=async()=>{
    if(!relName.trim())return;
    setSaving(true);
    const latest=validations.find(v=>v.status==='completed');
    const openFindings=findings.filter(f=>f.status==='open').length;
    const readiness=latest?Math.max(0,100-(latest.risk_score??50)):0;
    const{data}=await supabase.from('release_history').insert({
      project_id:projectId,workspace_id:workspaceId,
      release_name:relName.trim(),version:relVersion.trim()||null,
      environment:relEnv,status:'deployed',
      risk_score:latest?.risk_score??null,readiness_score:readiness,
      approved_by:[profile?.full_name||profile?.email||user?.email||'Unknown'],
      rollback_available:true,findings_at_release:openFindings,
      completed_at:new Date().toISOString(),
    }).select().single();
    if(data)setHistory(prev=>[data as RH,...prev]);
    setRelName('');setRelVersion('');setRelEnv('production');setCreating(false);setSaving(false);
  };

  if(loading)return<div className="flex justify-center py-16"><Spinner size={22}/></div>;

  const successCount=history.filter(h=>h.status==='deployed').length;
  const rollbackCount=history.filter(h=>h.status==='rolled_back').length;
  const successRate=history.length>0?Math.round((successCount/history.length)*100):0;

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-navy-900">Release History</h2>
          <p className="text-xs text-gray-500 mt-0.5">Complete audit trail of all deployments, rollbacks, and outcomes</p>
        </div>
        <button onClick={()=>setCreating(true)} className="btn-primary text-sm"><Plus size={14}/>Record Release</button>
      </div>

      {/* Stats */}
      {history.length>0&&(
        <div className="grid grid-cols-3 gap-3">
          {[
            {label:'Total Releases',value:history.length,color:'text-navy-900'},
            {label:'Success Rate',value:`${successRate}%`,color:successRate>=80?'text-green-600':'text-amber-600'},
            {label:'Rollbacks',value:rollbackCount,color:rollbackCount>0?'text-red-600':'text-green-600'},
          ].map(s=>(
            <div key={s.label} className="card py-3 text-center">
              <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {creating&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setCreating(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Record Deployment</h3>
            <label className="label">Release name</label>
            <input autoFocus className="input mb-3" value={relName} onChange={e=>setRelName(e.target.value)} placeholder="e.g. Payments API v2.4.1"/>
            <label className="label">Version <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input mb-3" value={relVersion} onChange={e=>setRelVersion(e.target.value)} placeholder="v2.4.1"/>
            <label className="label">Environment</label>
            <select className="input mb-4" value={relEnv} onChange={e=>setRelEnv(e.target.value)}>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="preview">Preview</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setCreating(false)} className="btn-secondary">Cancel</button>
              <button onClick={recordRelease} disabled={saving||!relName.trim()} className="btn-primary">
                {saving?<Loader2 size={14} className="animate-spin"/>:<Plus size={14}/>}Record
              </button>
            </div>
          </div>
        </div>
      )}

      {history.length===0?(
        <EmptyState icon={<BarChart3 size={28}/>} title="No release history yet" description="Record your first deployment to start tracking release history, rollbacks, and deployment outcomes." action={<button onClick={()=>setCreating(true)} className="btn-primary text-sm"><Plus size={14}/>Record Release</button>}/>
      ):(
        <div className="space-y-3">
          {history.map(h=>{
            const isOpen=expanded===h.id;
            const statusIcon=h.status==='deployed'?<CheckCircle2 size={16} className="text-green-600"/>:h.status==='rolled_back'?<RotateCcw size={16} className="text-amber-600"/>:h.status==='failed'?<XCircle size={16} className="text-red-600"/>:<Clock size={16} className="text-gray-400"/>;
            return(
              <div key={h.id} className={`card p-0 overflow-hidden border-2 ${h.status==='deployed'?'border-green-200':h.status==='rolled_back'?'border-amber-200':h.status==='failed'?'border-red-200':'border-[#d4d4d8]'}`}>
                <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50" onClick={()=>setExpanded(isOpen?null:h.id)}>
                  {isOpen?<ChevronDown size={15} className="text-gray-400"/>:<ChevronRight size={15} className="text-gray-400"/>}
                  {statusIcon}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-navy-900">{h.release_name}</span>
                      {h.version&&<span className="chip bg-gray-100 text-gray-600 border border-[#d4d4d8] text-xs">{h.version}</span>}
                      <span className={`chip text-xs border capitalize ${h.environment==='production'?'bg-red-50 text-red-600 border-red-200':h.environment==='staging'?'bg-amber-50 text-amber-600 border-amber-200':'bg-blue-50 text-blue-600 border-blue-200'}`}>{h.environment}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>{new Date(h.created_at).toLocaleString()}</span>
                      {h.risk_score!==null&&<span>Risk: {h.risk_score}/100</span>}
                      <span>{h.findings_at_release} open findings at release</span>
                    </div>
                  </div>
                  {h.readiness_score!==null&&(
                    <div className="text-right shrink-0">
                      <div className={`text-lg font-semibold ${h.readiness_score>=75?'text-green-600':h.readiness_score>=50?'text-amber-600':'text-red-600'}`}>{h.readiness_score}%</div>
                      <div className="text-[10px] text-gray-400">readiness</div>
                    </div>
                  )}
                </div>

                {isOpen&&(
                  <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                      {[
                        {label:'Status',value:h.status.replace('_',' '),color:h.status==='deployed'?'text-green-600':h.status==='rolled_back'?'text-amber-600':'text-red-600'},
                        {label:'Risk Score',value:h.risk_score!==null?`${h.risk_score}/100`:'—',color:'text-gray-700'},
                        {label:'Open Findings',value:h.findings_at_release,color:h.findings_at_release>0?'text-amber-600':'text-green-600'},
                        {label:'Rollback Available',value:h.rollback_available?'Yes':'No',color:h.rollback_available?'text-green-600':'text-red-600'},
                      ].map(d=>(
                        <div key={d.label} className="rounded-lg bg-white border border-[#d4d4d8] p-2.5 text-center">
                          <div className={`font-bold capitalize ${d.color}`}>{d.value}</div>
                          <div className="text-gray-400 mt-0.5">{d.label}</div>
                        </div>
                      ))}
                    </div>
                    {h.approved_by&&h.approved_by.length>0&&(
                      <div className="text-xs text-gray-600">
                        <span className="font-semibold">Approved by:</span> {h.approved_by.join(', ')}
                      </div>
                    )}
                    {h.rollback_version&&(
                      <div className="flex items-center gap-2 text-xs">
                        <RotateCcw size={12} className="text-amber-500"/>
                        <span className="text-gray-600">Rollback version: <strong>{h.rollback_version}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
