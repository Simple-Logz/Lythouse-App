import{useCallback,useEffect,useState}from'react';
import{supabase,anonKey,edgeFunctionUrl}from'../lib/supabase';
import{useAuth}from'../lib/auth';
import{Spinner}from'../lib/ui';
import{Clock,Shield,Package,Users,Plus,ChevronDown,ChevronRight,Loader as Loader2,Check,X,FileText,Sparkles}from'lucide-react';

type Approval={role:string;approver_name:string;approver_id:string;approved_at:string;comment:string;};
type ReleaseApproval={id:string;project_id:string;workspace_id:string;validation_id:string|null;release_name:string;status:string;required_approvers:string[];approvals:Approval[];created_by:string|null;created_at:string;completed_at:string|null;};

const APPROVER_ROLES=[
  {id:'platform',label:'Platform Engineering',icon:Package,color:'text-blue-600',bg:'bg-blue-50',border:'border-blue-200',desc:'Infrastructure and deployment readiness'},
  {id:'security',label:'Security Team',icon:Shield,color:'text-red-600',bg:'bg-red-50',border:'border-red-200',desc:'Security posture and compliance'},
  {id:'product',label:'Product Management',icon:Users,color:'text-purple-600',bg:'bg-purple-50',border:'border-purple-200',desc:'Business and feature readiness'},
];

export function ReleaseApprovalCenter({projectId,workspaceId,validationId,latestRiskScore}:{projectId:string;workspaceId:string;validationId?:string|null;latestRiskScore?:number|null;}){
  const{user,profile}=useAuth();
  const[approvals,setApprovals]=useState<ReleaseApproval[]>([]);
  const[loading,setLoading]=useState(true);
  const[creating,setCreating]=useState(false);
  const[releaseName,setReleaseName]=useState('');
  const[saving,setSaving]=useState(false);
  const[expanded,setExpanded]=useState<string|null>(null);
  const[commenting,setCommenting]=useState<{id:string;role:string}|null>(null);
  const[comment,setComment]=useState('');
  const[submitting,setSubmitting]=useState(false);
  const[aiAdvisory,setAiAdvisory]=useState<Record<string,string>>({});
  const[loadingAdvisory,setLoadingAdvisory]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    const{data}=await supabase.from('release_approvals').select('*').eq('project_id',projectId).order('created_at',{ascending:false});
    setApprovals((data??[]) as ReleaseApproval[]);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{load();},[load]);

  const createRelease=async()=>{
    if(!releaseName.trim())return;
    setSaving(true);
    const{data,error}=await supabase.from('release_approvals').insert({
      project_id:projectId,workspace_id:workspaceId,
      validation_id:validationId||null,
      release_name:releaseName.trim(),
      status:'pending',
      required_approvers:['platform','security','product'],
      approvals:[],
    }).select().single();
    if(!error&&data){
      setApprovals(prev=>[data as ReleaseApproval,...prev]);
      setExpanded(data.id);
    }
    setReleaseName('');setCreating(false);setSaving(false);
  };

  const submitApproval=async(releaseId:string,role:string,decision:'approve'|'reject')=>{
    if(!user)return;
    setSubmitting(true);
    const release=approvals.find(a=>a.id===releaseId);
    if(!release){setSubmitting(false);return;}
    const newApproval:Approval={
      role,approver_name:profile?.full_name||profile?.email||user.email||'Unknown',
      approver_id:user.id,approved_at:new Date().toISOString(),
      comment:comment||'',
    };
    const existingApprovals=(release.approvals||[]).filter((a:Approval)=>a.role!==role);
    const updatedApprovals=decision==='approve'?[...existingApprovals,newApproval]:existingApprovals;
    const allApproved=release.required_approvers.every(r=>updatedApprovals.some((a:Approval)=>a.role===r));
    const newStatus=decision==='reject'?'rejected':allApproved?'approved':'pending';
    const{data}=await supabase.from('release_approvals').update({
      approvals:updatedApprovals,status:newStatus,
      completed_at:newStatus!=='pending'?new Date().toISOString():null,
    }).eq('id',releaseId).select().single();
    if(data){setApprovals(prev=>prev.map(a=>a.id===releaseId?data as ReleaseApproval:a));}
    setCommenting(null);setComment('');setSubmitting(false);
  };

  const getAIAdvisory=async(releaseId:string,relName:string)=>{
    setLoadingAdvisory(releaseId);
    try{
      const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({
          systemPrompt:'You are an AI deployment advisor for an enterprise release management platform. Be concise and decisive.',
          messages:[{role:'user',content:`Should we approve release "${relName}" for deployment? Risk score: ${latestRiskScore??'unknown'}/100. Provide: 1) RECOMMENDATION (Deploy Now/Delay/Block), 2) REASONING (2-3 sentences), 3) KEY RISKS (bullet points), 4) REQUIRED ACTIONS before deployment.`}]
        })
      });
      if(res.ok){const d=await res.json();setAiAdvisory(prev=>({...prev,[releaseId]:d.content}));}
    }catch{}
    setLoadingAdvisory(null);
  };

  if(loading)return<div className="flex justify-center py-10"><Spinner size={20}/></div>;

  return(
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-navy-900">Release Approval Center</h2>
          <p className="text-xs text-gray-500 mt-0.5">Multi-team approval workflow with complete audit trail</p>
        </div>
        <button onClick={()=>setCreating(true)} className="btn-primary text-sm"><Plus size={14}/>New Release</button>
      </div>

      {/* Create release modal */}
      {creating&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setCreating(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Create Release for Approval</h3>
            <p className="text-xs text-gray-500 mb-4">This will initiate approval workflows for Platform, Security, and Product teams.</p>
            <label className="label">Release name</label>
            <input autoFocus className="input mb-4" value={releaseName} onChange={e=>setReleaseName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createRelease()} placeholder="e.g. v2.4.1 — Payments API Update"/>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setCreating(false)} className="btn-secondary">Cancel</button>
              <button onClick={createRelease} disabled={saving||!releaseName.trim()} className="btn-primary">
                {saving?<Loader2 size={14} className="animate-spin"/>:<Plus size={14}/>}Create
              </button>
            </div>
          </div>
        </div>
      )}

      {approvals.length===0&&(
        <div className="card text-center py-12">
          <Shield size={36} className="mx-auto text-gray-200 mb-3"/>
          <h3 className="text-sm font-semibold text-navy-900 mb-1">No releases pending approval</h3>
          <p className="text-xs text-gray-500 mb-4">Create a release to initiate the multi-team approval workflow before deployment.</p>
          <button onClick={()=>setCreating(true)} className="btn-primary text-sm"><Plus size={14}/>Create Release</button>
        </div>
      )}

      {approvals.map(release=>{
        const isOpen=expanded===release.id;
        const approvedRoles=new Set((release.approvals||[]).map((a:Approval)=>a.role));
                const allApproved=release.required_approvers.every(r=>approvedRoles.has(r));
        const isRejected=release.status==='rejected';

        return(
          <div key={release.id} className={`card p-0 overflow-hidden border-2 ${allApproved?'border-green-300':isRejected?'border-red-300':'border-[#18181b]'}`}>
            {/* Release header */}
            <div className={`flex items-center gap-3 px-5 py-4 cursor-pointer ${allApproved?'bg-green-50':isRejected?'bg-red-50':'bg-white'}`} onClick={()=>setExpanded(isOpen?null:release.id)}>
              {isOpen?<ChevronDown size={16} className="text-gray-400"/>:<ChevronRight size={16} className="text-gray-400"/>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-navy-900">{release.release_name}</h3>
                  <span className={`chip border text-xs font-semibold ${allApproved?'bg-green-100 text-green-700 border-green-300':isRejected?'bg-red-100 text-red-700 border-red-300':'bg-amber-100 text-amber-700 border-amber-300'}`}>
                    {allApproved?'✓ Approved':isRejected?'✗ Rejected':'⏳ Pending'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span><Clock size={10} className="inline mr-1"/>{new Date(release.created_at).toLocaleString()}</span>
                  <span>{(release.approvals||[]).length}/{release.required_approvers.length} approvals</span>
                </div>
              </div>
              {/* Approval progress */}
              <div className="flex items-center gap-1">
                {APPROVER_ROLES.map(role=>{
                  const approved=approvedRoles.has(role.id);
                  return<div key={role.id} title={role.label} className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${approved?'bg-green-500 border-green-500 text-white':'border-gray-300 bg-white text-gray-400'}`}>
                    {approved?<Check size={12}/>:<role.icon size={11}/>}
                  </div>;
                })}
              </div>
            </div>

            {isOpen&&(
              <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 space-y-4">
                {/* AI Advisory */}
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-purple-600"/>
                      <span className="text-xs font-bold uppercase tracking-wide text-purple-700">AI Deployment Advisor</span>
                    </div>
                    {!aiAdvisory[release.id]&&(
                      <button onClick={()=>getAIAdvisory(release.id,release.release_name)} disabled={loadingAdvisory===release.id} className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50">
                        {loadingAdvisory===release.id?<Loader2 size={11} className="animate-spin"/>:<Sparkles size={11}/>}Get AI Advice
                      </button>
                    )}
                  </div>
                  {aiAdvisory[release.id]?(
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiAdvisory[release.id]}</div>
                  ):(
                    <p className="text-xs text-purple-600/70">Click "Get AI Advice" for an AI-powered deployment recommendation based on current risk score and findings.</p>
                  )}
                </div>

                {/* Approval gates */}
                <div className="space-y-3">
                  {APPROVER_ROLES.map(role=>{
                    const existingApproval=(release.approvals||[]).find((a:Approval)=>a.role===role.id);
                    const isApproved=!!existingApproval;
                    const isCommentingThis=commenting?.id===release.id&&commenting?.role===role.id;

                    return(
                      <div key={role.id} className={`rounded-xl border ${isApproved?'border-green-200 bg-green-50':'border-[#18181b] bg-white'} p-4`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 ${isApproved?'bg-green-100 border-green-300 text-green-600':`${role.bg} ${role.border} ${role.color}`}`}>
                              {isApproved?<Check size={18}/>:<role.icon size={18}/>}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-navy-900">{role.label}</p>
                              <p className="text-xs text-gray-500">{role.desc}</p>
                              {isApproved&&<p className="text-xs text-green-600 mt-0.5">✓ Approved by {existingApproval.approver_name} · {new Date(existingApproval.approved_at).toLocaleString()}</p>}
                              {existingApproval?.comment&&<p className="text-xs text-gray-500 mt-1 italic">"{existingApproval.comment}"</p>}
                            </div>
                          </div>
                          {!isApproved&&!isRejected&&!isCommentingThis&&(
                            <div className="flex gap-2">
                              <button onClick={()=>setCommenting({id:release.id,role:role.id})} className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700"><Check size={12}/>Approve</button>
                              <button onClick={async()=>{setComment('REJECTED');await submitApproval(release.id,role.id,'reject');}} className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"><X size={12}/>Reject</button>
                            </div>
                          )}
                        </div>

                        {isCommentingThis&&(
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add approval comment (optional)…" className="input text-sm resize-none mb-2" rows={2}/>
                            <div className="flex gap-2">
                              <button onClick={()=>submitApproval(release.id,role.id,'approve')} disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700 disabled:opacity-50">
                                {submitting?<Loader2 size={12} className="animate-spin"/>:<Check size={12}/>}Confirm Approval
                              </button>
                              <button onClick={()=>{setCommenting(null);setComment('');}} className="btn-secondary text-xs">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Audit log */}
                {(release.approvals||[]).length>0&&(
                  <div className="rounded-xl border border-[#18181b] bg-white p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5"><FileText size={12}/>Audit Trail</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500"/>
                        <span className="text-gray-400 font-mono">{new Date(release.created_at).toLocaleString()}</span>
                        <span>Release created</span>
                      </div>
                      {(release.approvals||[]).map((a:Approval,i:number)=>(
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500"/>
                          <span className="text-gray-400 font-mono">{new Date(a.approved_at).toLocaleString()}</span>
                          <span><strong>{a.approver_name}</strong> approved as {a.role}{a.comment&&a.comment!=='REJECTED'?` — "${a.comment}"`:''}</span>
                        </div>
                      ))}
                      {allApproved&&<div className="flex items-center gap-2 text-xs font-semibold text-green-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-600"/>
                        <span>All approvals received — Release approved for deployment</span>
                      </div>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
