// @ts-nocheck
import{useEffect,useState,useCallback,useRef}from'react';
import{supabase}from'../lib/supabase';
import{useRouter}from'../lib/router';
import{PageHeader,Spinner,EmptyState,timeAgo}from'../lib/ui';
import{
  FileText,Plus,Sparkles,AlertTriangle,Clock,CheckCircle2,XCircle,
  GitBranch,BarChart3,Percent,Timer,RotateCcw,
}from'lucide-react';
import{generateDashboardRecommendations}from'../workspace/changeAI';
import{
  RISK_CLS,STATUS_CLS,STATUS_LABEL,ProjectReadyCard,
  MetricCard,RecentActivityFeed,UpcomingDeploymentsCard,RecentApprovalsCard,AIRecommendationsCard,
}from'./changeManagementUI';

// ── Change Management Hub — landing page ────────────────────────────────────
// Two states: an empty-state that turns "no change requests yet" into a
// real, actionable list of projects ready to draft from (grounded in each
// project's actual latest validation), and a populated dashboard once
// requests exist. Clicking "Generate change request" hands off to the AI
// Deployment Review Center at /change-management/:id — that page is where
// the actual analysis happens; this page stays a fast, glanceable landing
// spot, per explicit instruction to keep it mostly as-is.

function riskFromCounts(v:any):string{
  if(!v)return'unknown';
  if((v.critical_count||0)>0)return'critical';
  if((v.high_count||0)>0)return'high';
  if((v.medium_count||0)>0)return'medium';
  return'low';
}

export function ChangeManagementPage(){
  const{navigate}=useRouter();
  const[loading,setLoading]=useState(true);
  const[projects,setProjects]=useState<any[]>([]);
  const[requests,setRequests]=useState<any[]>([]);
  const[selProjectId,setSelProjectId]=useState('');
  const[context,setContext]=useState<{validation:any;findings:any[]}|null>(null);
  const[contextLoading,setContextLoading]=useState(false);
  const[generating,setGenerating]=useState(false);
  const[showNew,setShowNew]=useState(false);
  const[latestValidations,setLatestValidations]=useState<Record<string,any>>({});
  const[openFindingsByProject,setOpenFindingsByProject]=useState<Record<string,number>>({});
  const[draftingId,setDraftingId]=useState('');
  const[recs,setRecs]=useState<string[]>([]);
  const[recsLoading,setRecsLoading]=useState(false);
  const[recsUnavailable,setRecsUnavailable]=useState('');
  const recsRef=useRef(false);
  const wsId=()=>localStorage.getItem('sandbox.activeWs');

  const load=useCallback(async()=>{
    setLoading(true);
    const wid=wsId();if(!wid){setLoading(false);return;}
    const[pr,cr]=await Promise.all([
      supabase.from('projects').select('id,name,git_branch').eq('workspace_id',wid).order('name'),
      supabase.from('change_requests').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(100),
    ]);
    const projectList=pr.data??[];
    setProjects(projectList);
    setRequests(cr.data??[]);
    if(projectList.length){
      const ids=projectList.map((p:any)=>p.id);
      const[{data:vals},{data:openF}]=await Promise.all([
        supabase.from('validations').select('id,project_id,risk_score,severity,critical_count,high_count,medium_count,low_count,total_findings,commit_sha,completed_at,created_at').in('project_id',ids).eq('status','completed').order('completed_at',{ascending:false}),
        supabase.from('findings').select('project_id').eq('status','open').in('project_id',ids),
      ]);
      const byProject:Record<string,any>={};
      for(const v of vals??[]){if(!byProject[v.project_id])byProject[v.project_id]=v;}
      setLatestValidations(byProject);
      const openCounts:Record<string,number>={};
      for(const f of openF??[])openCounts[f.project_id]=(openCounts[f.project_id]||0)+1;
      setOpenFindingsByProject(openCounts);
    }else{
      setLatestValidations({});setOpenFindingsByProject({});
    }
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const loadContext=useCallback(async(projectId:string)=>{
    if(!projectId){setContext(null);return;}
    setContextLoading(true);
    const{data:validations}=await supabase.from('validations').select('*').eq('project_id',projectId).eq('status','completed').order('created_at',{ascending:false}).limit(1);
    const latest=validations?.[0]||null;
    let findings:any[]=[];
    if(latest){
      const{data}=await supabase.from('findings').select('*').eq('validation_id',latest.id).eq('status','open').in('severity',['critical','high']).order('severity');
      findings=data??[];
    }
    setContext({validation:latest,findings});
    setContextLoading(false);
  },[]);
  useEffect(()=>{if(selProjectId)loadContext(selProjectId);},[selProjectId,loadContext]);

  // Grounded, dynamic recommendations for the dashboard — computed once the
  // request list is loaded, from real aggregate stats only (see the evidence
  // object below). Runs once per page visit.
  useEffect(()=>{
    if(loading||recsRef.current||requests.length===0)return;
    recsRef.current=true;
    (async()=>{
      setRecsLoading(true);
      const now=Date.now();
      const withSnapshot=requests.filter((r:any)=>r.validation_snapshot?.risk_score!=null);
      const avgRisk=withSnapshot.length?Math.round(withSnapshot.reduce((s:number,r:any)=>s+r.validation_snapshot.risk_score,0)/withSnapshot.length):null;
      const pending=requests.filter((r:any)=>r.status==='pending_approval').map((r:any)=>({title:r.title,daysWaiting:Math.round((now-new Date(r.created_at).getTime())/86400000)}));
      const findingsByProject=Object.entries(openFindingsByProject).map(([pid,count])=>({project:projects.find((p:any)=>p.id===pid)?.name||pid,openFindings:count})).sort((a:any,b:any)=>b.openFindings-a.openFindings).slice(0,5);
      const evidence={
        totalChangeRequests:requests.length,
        statusCounts:{draft:requests.filter((r:any)=>r.status==='draft').length,pending_approval:requests.filter((r:any)=>r.status==='pending_approval').length,approved:requests.filter((r:any)=>r.status==='approved').length,rejected:requests.filter((r:any)=>r.status==='rejected').length,scheduled:requests.filter((r:any)=>r.status==='scheduled').length,completed:requests.filter((r:any)=>r.status==='completed').length,rolled_back:requests.filter((r:any)=>r.status==='rolled_back').length},
        averageRiskScore:avgRisk,
        pendingApprovalRequests:pending,
        projectsWithMostOpenFindings:findingsByProject,
      };
      const res=await generateDashboardRecommendations(evidence);
      if(res.ok)setRecs(res.data||[]);else setRecsUnavailable(res.error||'AI recommendations unavailable right now.');
      setRecsLoading(false);
    })();
  },[loading,requests,openFindingsByProject,projects]);

  // Shared drafting logic — takes whatever real validation/findings data is
  // available for a project and turns it into a change_requests row.
  const draftFromData=async(project:any,v:any,findings:any[])=>{
    const wid=wsId();if(!wid||!project)return null;
    const riskLevel=riskFromCounts(v);
    const scope=[...new Set(findings.map((f:any)=>f.category).filter(Boolean))];
    const summary=v
      ?`${project.name} (${project.git_branch||'main'}) — ${v.total_findings} finding${v.total_findings===1?'':'s'} from the latest validation (${v.critical_count} critical, ${v.high_count} high). Risk score ${v.risk_score??'—'}/100.`
      :`${project.name} (${project.git_branch||'main'}) — no completed validation yet. Run a validation before requesting sign-off on this change.`;
    const riskAssessment=findings.length
      ?findings.map((f:any)=>`${f.severity.toUpperCase()}: ${f.title}${f.recommendation?` — ${f.recommendation}`:''}`).join('\n')
      :'No open critical or high-severity findings at the time this plan was generated.';
    const rollbackPlan=`If issues surface after deployment, roll back by redeploying the last known-good commit${v?.commit_sha?` (previous validated commit: ${String(v.commit_sha).slice(0,10)})`:''} through your existing deployment pipeline. Re-run validation against the rolled-back state before closing the incident, and record the outcome in this change request's comments.`;
    const validationSnapshot=v?{risk_score:v.risk_score,severity:v.severity,total_findings:v.total_findings,critical_count:v.critical_count,high_count:v.high_count,medium_count:v.medium_count,low_count:v.low_count,commit_sha:v.commit_sha,completed_at:v.completed_at}:{};

    const{data,error}=await supabase.from('change_requests').insert({
      workspace_id:wid,project_id:project.id,validation_id:v?.id||null,
      title:`${project.name} — Production change (${new Date().toLocaleDateString()})`,
      environment:'production',risk_level:riskLevel,summary,scope,
      risk_assessment:riskAssessment,rollback_plan:rollbackPlan,
      validation_snapshot:validationSnapshot,status:'draft',
    }).select().single();
    return error?null:data;
  };

  const generatePlan=async()=>{
    const project=projects.find(p=>p.id===selProjectId);
    if(!project)return;
    setGenerating(true);
    const data=await draftFromData(project,context?.validation,context?.findings??[]);
    setGenerating(false);
    if(data)navigate('/change-management/'+data.id);
  };

  // One-click draft straight from a project card — reuses whatever
  // validation LytHouse already has on file, then hands off to the AI
  // Deployment Review Center to do the actual analysis.
  const quickDraft=async(project:any)=>{
    setDraftingId(project.id);
    const v=latestValidations[project.id]||null;
    let findings:any[]=[];
    if(v){
      const{data}=await supabase.from('findings').select('*').eq('validation_id',v.id).eq('status','open').in('severity',['critical','high']).order('severity');
      findings=data??[];
    }
    const cr=await draftFromData(project,v,findings);
    setDraftingId('');
    if(cr)navigate('/change-management/'+cr.id);
  };

  const projectName=(id:string)=>projects.find(p=>p.id===id)?.name||'—';

  const estWindowForProject=(projectId:string)=>{
    const done=requests.filter((r:any)=>r.project_id===projectId&&(r.status==='completed'||r.status==='rolled_back')&&r.scheduled_start&&r.scheduled_end);
    const mins=done.map((r:any)=>(new Date(r.scheduled_end).getTime()-new Date(r.scheduled_start).getTime())/60000).filter((m:number)=>m>0);
    if(!mins.length)return'No history';
    const avg=mins.reduce((a:number,b:number)=>a+b,0)/mins.length;
    return avg>=60?`~${(avg/60).toFixed(1)}h`:`~${Math.round(avg)}m`;
  };

  if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

  // ── Dashboard metrics (only meaningful once requests exist) ─────────────
  const withSnapshot=requests.filter((r:any)=>r.validation_snapshot?.risk_score!=null);
  const avgRisk=withSnapshot.length?Math.round(withSnapshot.reduce((s:number,r:any)=>s+r.validation_snapshot.risk_score,0)/withSnapshot.length):null;
  const terminal=requests.filter((r:any)=>r.status==='completed'||r.status==='rolled_back');
  const successRate=terminal.length?Math.round((requests.filter((r:any)=>r.status==='completed').length/terminal.length)*100):null;
  const rollbackRate=terminal.length?Math.round((requests.filter((r:any)=>r.status==='rolled_back').length/terminal.length)*100):null;
  const decided=requests.filter((r:any)=>r.decided_at);
  const avgApprovalMins=decided.length?decided.reduce((s:number,r:any)=>s+(new Date(r.decided_at).getTime()-new Date(r.created_at).getTime())/60000,0)/decided.length:null;
  const fmtMins=(m:number)=>m>=1440?`~${(m/1440).toFixed(1)}d`:m>=60?`~${(m/60).toFixed(1)}h`:`~${Math.round(m)}m`;

  const upcoming=requests.filter((r:any)=>r.status==='scheduled'&&r.scheduled_start&&new Date(r.scheduled_start).getTime()>Date.now()).sort((a:any,b:any)=>new Date(a.scheduled_start).getTime()-new Date(b.scheduled_start).getTime()).slice(0,5);
  const recentApprovals=requests.filter((r:any)=>r.decided_at).sort((a:any,b:any)=>new Date(b.decided_at).getTime()-new Date(a.decided_at).getTime()).slice(0,5);
  const activity=requests.flatMap((r:any)=>{
    const evs=[{id:r.id+'-c',label:`${r.title} was created`,at:r.created_at,icon:<FileText size={12}/>}];
    if(r.decided_at)evs.push({id:r.id+'-d',label:`${r.title} was ${r.status==='rejected'?'rejected':'approved'}`,at:r.decided_at,icon:r.status==='rejected'?<XCircle size={12}/>:<CheckCircle2 size={12}/>});
    if(r.status==='rolled_back')evs.push({id:r.id+'-r',label:`${r.title} was rolled back`,at:r.decided_at||r.created_at,icon:<RotateCcw size={12}/>});
    return evs;
  }).sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0,8);

  return<div>
    <PageHeader title="Change Management" description="An AI-assisted deployment planning hub — grounded in your project's real validation data, not a blank form."
      actions={<button onClick={()=>setShowNew(v=>!v)} className="btn-brand text-xs flex items-center gap-1.5"><Plus size={13}/>New change request</button>}
    />

    {showNew&&(
      <div className="card mb-5">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-navy-900"><Sparkles size={14} className="text-brand-600"/>Generate a change plan</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="label">Project</label>
            <select className="input" value={selProjectId} onChange={(e)=>setSelProjectId(e.target.value)}>
              <option value="">Select a project…</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={generatePlan} disabled={!selProjectId||generating||contextLoading} className="btn-brand text-xs flex items-center gap-1.5 disabled:opacity-50">
            {generating?<><Spinner size={12}/>Generating…</>:<><Sparkles size={12}/>Generate change request</>}
          </button>
        </div>

        {selProjectId&&!contextLoading&&(
          <div className="mt-3 rounded-xl border border-[#18181b] bg-gray-50 p-3.5 text-xs text-gray-600">
            {context?.validation?(
              <>Latest validation: <span className="font-semibold text-navy-800">{context.validation.risk_score??'—'}/100 risk</span> · {context.validation.critical_count} critical · {context.validation.high_count} high · validated {timeAgo(context.validation.completed_at||context.validation.created_at)}. You'll be taken straight to the AI review once it's drafted.</>
            ):(
              <span className="flex items-center gap-1.5 text-amber-600"><AlertTriangle size={13}/>No completed validation found for this project yet — run one first for the most accurate plan, or generate anyway with limited context.</span>
            )}
          </div>
        )}
        {selProjectId&&contextLoading&&<div className="mt-3 flex items-center gap-2 text-xs text-gray-400"><Spinner size={12}/>Loading validation context…</div>}
      </div>
    )}

    {requests.length===0?(
      <>
        <div className="card mb-5">
          <p className="mb-4 text-sm font-semibold text-navy-900">How the Change Management Hub works</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <HowStep icon={<GitBranch size={16}/>} title="1. We already track your risk" desc="Every project's latest validation — risk score, open findings, commit — is already in LytHouse."/>
            <HowStep icon={<Sparkles size={16}/>} title="2. AI reviews the deployment" desc="You land on a full AI Deployment Review — executive summary, impact analysis, and reviewer notes — generated from that real data."/>
            <HowStep icon={<CheckCircle2 size={16}/>} title="3. Route it for sign-off" desc="Send it to an approver, track the decision and real deployment outcome, and export a premium PDF for the record."/>
          </div>
        </div>

        {projects.length>0?(
          <>
            <p className="mb-3 text-sm font-semibold text-navy-900">Ready to draft, from your real validation data</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p:any)=>{
                const v=latestValidations[p.id]||null;
                const readiness=v?Math.max(0,100-(v.risk_score??0)):null;
                return<ProjectReadyCard key={p.id} project={p} validation={v}
                  openFindings={openFindingsByProject[p.id]||0} readinessPct={readiness}
                  estWindow={estWindowForProject(p.id)} onDraft={()=>quickDraft(p)} drafting={draftingId===p.id}/>;
              })}
            </div>
          </>
        ):(
          <EmptyState icon={<FileText size={22}/>} title="No projects connected yet" description="Connect a project first — LytHouse drafts change requests straight from its validation history, no typing required."/>
        )}
      </>
    ):(
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total requests" value={requests.length}/>
          <StatCard label="Pending approval" value={requests.filter((r:any)=>r.status==='pending_approval').length}/>
          <StatCard label="Approved" value={requests.filter((r:any)=>r.status==='approved').length}/>
          <StatCard label="Scheduled" value={requests.filter((r:any)=>r.status==='scheduled').length}/>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard icon={<BarChart3 size={12}/>} label="Avg. deployment risk" value={avgRisk===null?'—':`${avgRisk}/100`} sub={withSnapshot.length?`across ${withSnapshot.length} requests`:undefined}/>
          <MetricCard icon={<Percent size={12}/>} label="Success rate" value={successRate===null?'No data yet':`${successRate}%`} sub={terminal.length?`${terminal.length} completed changes`:'no completed changes yet'}/>
          <MetricCard icon={<Timer size={12}/>} label="Avg. approval time" value={avgApprovalMins===null?'No data yet':fmtMins(avgApprovalMins)} sub={decided.length?`across ${decided.length} decisions`:undefined}/>
          <MetricCard icon={<RotateCcw size={12}/>} label="Rollback rate" value={rollbackRate===null?'No data yet':`${rollbackRate}%`} sub={terminal.length?`${requests.filter((r:any)=>r.status==='rolled_back').length} of ${terminal.length} changes`:undefined}/>
        </div>

        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          <RecentActivityFeed items={activity}/>
          <AIRecommendationsCard items={recs} loading={recsLoading} unavailable={recsUnavailable}/>
        </div>
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          <UpcomingDeploymentsCard items={upcoming} onOpen={(id)=>navigate('/change-management/'+id)}/>
          <RecentApprovalsCard items={recentApprovals} onOpen={(id)=>navigate('/change-management/'+id)}/>
        </div>

        <p className="mb-3 text-sm font-semibold text-navy-900">Recent change requests</p>
        <div className="card p-0">
          <div className="divide-y divide-gray-100">
            {requests.map((r:any)=>(
              <button key={r.id} onClick={()=>navigate('/change-management/'+r.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${RISK_CLS[r.risk_level]||RISK_CLS.unknown}`}>
                  {r.status==='approved'||r.status==='completed'?<CheckCircle2 size={16}/>:r.status==='rejected'||r.status==='rolled_back'?<XCircle size={16}/>:r.status==='pending_approval'?<Clock size={16}/>:<FileText size={16}/>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900">{r.title}</p>
                  <p className="flex items-center gap-1 text-xs text-gray-500"><GitBranch size={10}/>{projectName(r.project_id)} · {timeAgo(r.created_at)}</p>
                </div>
                <span className={`chip ${STATUS_CLS[r.status]||STATUS_CLS.draft}`}>{STATUS_LABEL[r.status]||r.status}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    )}
  </div>;
}

function StatCard({label,value}:{label:string;value:number}){
  return<div className="card py-3.5">
    <p className="text-2xl font-bold text-navy-900">{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>;
}

function HowStep({icon,title,desc}:{icon:any;title:string;desc:string}){
  return<div className="flex gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
    <div>
      <p className="text-sm font-semibold text-navy-900">{title}</p>
      <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
    </div>
  </div>;
}
