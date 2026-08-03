// @ts-nocheck
import{useEffect,useState,useCallback}from'react';
import{supabase,edgeFunctionUrl,anonKey}from'../lib/supabase';
import{useAuth}from'../lib/auth';
import{PageHeader,Spinner,EmptyState,timeAgo}from'../lib/ui';
import{
  FileText,Plus,Sparkles,AlertTriangle,Clock,CheckCircle2,XCircle,
  Download,MessageSquare,Send,Calendar,GitBranch,ChevronLeft,X,
}from'lucide-react';
import{jsPDF}from'jspdf';
import{
  RISK_CLS,STATUS_CLS,STATUS_LABEL,
  ExecutiveSummaryCard,ImpactAnalysisCard,RiskAssessmentCard,ReadinessChecklist,
  RollbackPlanCard,DeploymentTimeline,WhatsChangingCard,PreviousChangesCard,
  ReviewerCommentsCard,ProjectReadyCard,
}from'./changeManagementUI';

// ── Change Management Hub ───────────────────────────────────────────────────
// A formal record filed before a production deployment: what's changing, the
// risk, the rollback plan, and who signed off. Unlike release_approvals
// (security/platform/product sign-off on one specific release), this is the
// broader "here's the change, here's the evidence, here's how we undo it if
// it goes wrong" document a team sends up the chain.
//
// Two layers of intelligence, both grounded in real data, never fabricated:
//  1. Deterministic — drafted straight from the project's own validation,
//     findings, and validation_steps rows (riskFromCounts, draftFromData).
//  2. AI-assisted — the change-request-ai edge function explains, prioritises
//     and phrases that same real evidence (executive summary, impact
//     analysis, risk contributors, reviewer comments, rollback plan). It
//     never invents a finding, service, or number that isn't already in the
//     database; see that function's system prompt for the ground rules.

function riskFromCounts(v:any):string{
  if(!v)return'unknown';
  if((v.critical_count||0)>0)return'critical';
  if((v.high_count||0)>0)return'high';
  if((v.medium_count||0)>0)return'medium';
  return'low';
}

// Renders the exported report: a premium cover page followed by the full
// evidence record. Uses LytHouse's own in-app brand mark, never a fabricated
// company logo, and only claims "Prepared by LytHouse AI" when AI content
// actually exists on the record.
function downloadChangePlanPdf(cr:any, projectName:string, findings:any[]){
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight();

  // ── Cover page ────────────────────────────────────────────────────────
  doc.setFillColor(15,15,23);doc.rect(0,0,pw,ph,'F');
  doc.setFillColor(124,92,230);doc.roundedRect(pw/2-24,100,48,48,12,12,'F');
  doc.setDrawColor(255,255,255);doc.setLineWidth(3);
  doc.line(pw/2-13,124,pw/2-4,134);doc.line(pw/2-4,134,pw/2+14,110);
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(15);
  doc.text('LytHouse',pw/2,172,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(170,165,200);
  doc.text('CHANGE MANAGEMENT REPORT',pw/2,188,{align:'center'});

  doc.setFont('helvetica','bold');doc.setFontSize(24);doc.setTextColor(255,255,255);
  const titleLines=doc.splitTextToSize(cr.title||'Change request',pw-140);
  let cy=250;
  for(const ln of titleLines){doc.text(ln,pw/2,cy,{align:'center'});cy+=30;}

  const riskColorMap:Record<string,[number,number,number]>={critical:[220,38,38],high:[217,119,6],medium:[124,92,230],low:[16,163,74],unknown:[110,110,125]};
  const rc=riskColorMap[cr.risk_level]||riskColorMap.unknown;
  doc.setFillColor(rc[0],rc[1],rc[2]);doc.roundedRect(pw/2-58,cy+14,116,26,13,13,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.setTextColor(255,255,255);
  doc.text(`${(cr.risk_level||'unknown').toUpperCase()} RISK`,pw/2,cy+31,{align:'center'});

  const coverRows:[string,string][]=[
    ['Project',projectName],
    ['Environment',cr.environment],
    ['Deployment window',cr.scheduled_start?`${new Date(cr.scheduled_start).toLocaleString()}  →  ${cr.scheduled_end?new Date(cr.scheduled_end).toLocaleString():'—'}`:'Not yet scheduled'],
    ['Approval status',STATUS_LABEL[cr.status]||cr.status],
    ['Prepared by',cr.ai_summary?'LytHouse AI (grounded in real validation data)':'LytHouse'],
    ['Date generated',new Date().toLocaleString()],
    ['Version',`v${cr.revision||1}`],
  ];
  let ry=cy+78;
  doc.setFont('helvetica','normal');doc.setFontSize(9.5);
  for(const[label,value]of coverRows){
    doc.setTextColor(150,145,175);doc.text(label.toUpperCase(),pw/2-165,ry);
    doc.setTextColor(240,240,245);
    const lines=doc.splitTextToSize(String(value),280);
    doc.text(lines,pw/2-15,ry);
    ry+=Math.max(17,lines.length*12.5);
  }
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(120,115,145);
  doc.text('Generated automatically by LytHouse, grounded in this project\'s real validation data.',pw/2,ph-40,{align:'center'});

  // ── Content pages ─────────────────────────────────────────────────────
  doc.addPage();
  let y=0;
  doc.setFillColor(20,20,30);doc.rect(0,0,pw,86,'F');
  doc.setFillColor(124,92,230);doc.roundedRect(40,24,38,38,10,10,'F');
  doc.setDrawColor(255,255,255);doc.setLineWidth(2.4);
  doc.line(51,44,58,52);doc.line(58,52,68,36);
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(18);
  doc.text('LytHouse',92,42);
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(200,195,230);
  doc.text('Change Management Report',92,60);
  doc.setFontSize(8);doc.setTextColor(160,160,180);
  doc.text(`Generated ${new Date().toLocaleString()}`,pw-40,60,{align:'right'});

  y=120;
  const left=40,right=pw-40,width=right-left;
  doc.setTextColor(20,20,30);doc.setFont('helvetica','bold');doc.setFontSize(16);
  doc.text(cr.title||'Change request',left,y);
  y+=22;

  doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(90,90,105);
  doc.text(`Project: ${projectName}`,left,y);
  doc.text(`Environment: ${cr.environment}`,left+220,y);
  y+=16;
  doc.text(`Status: ${STATUS_LABEL[cr.status]||cr.status}`,left,y);
  doc.text(`Risk level: ${(cr.risk_level||'unknown').toUpperCase()}`,left+220,y);
  y+=16;
  doc.text(`Requested: ${cr.created_at?new Date(cr.created_at).toLocaleString():'—'}`,left,y);
  y+=24;

  const section=(title:string,body:string)=>{
    if(y>760){doc.addPage();y=50;}
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(20,20,30);
    doc.text(title,left,y);y+=16;
    doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(60,60,75);
    const lines=doc.splitTextToSize(body||'—',width);
    for(const ln of lines){
      if(y>780){doc.addPage();y=50;}
      doc.text(ln,left,y);y+=13.5;
    }
    y+=12;
  };

  if(cr.ai_summary)section('AI executive summary',cr.ai_summary);
  section('Summary',cr.summary);
  section('Scope of change',(cr.scope&&cr.scope.length?cr.scope:['General']).map((s:string)=>`• ${s}`).join('\n'));
  if(cr.ai_impact&&cr.ai_impact.length)section('Impact analysis',cr.ai_impact.map((i:any)=>`• ${i.component}: ${i.reason}`).join('\n'));
  section('Risk assessment',cr.risk_assessment);
  section('Rollback plan',cr.rollback_plan);
  if(cr.ai_rollback&&cr.ai_rollback.steps&&cr.ai_rollback.steps.length){
    const rb=cr.ai_rollback;
    section('AI-drafted rollback detail',
      rb.steps.map((s:string,i:number)=>`${i+1}. ${s}`).join('\n')+
      (rb.estimated_duration?`\n\nEstimated duration: ${rb.estimated_duration}`:'')+
      (rb.dependencies?.length?`\nDependencies: ${rb.dependencies.join(', ')}`:'')+
      (rb.approvals_required?.length?`\nApprovals required: ${rb.approvals_required.join(', ')}`:''));
  }
  if(cr.ai_reviewer_comments&&cr.ai_reviewer_comments.length)section('AI reviewer comments',cr.ai_reviewer_comments.map((c:string)=>`• ${c}`).join('\n'));

  if(cr.validation_snapshot&&Object.keys(cr.validation_snapshot).length){
    const s=cr.validation_snapshot;
    section('Validation snapshot (at time of drafting)',
      `Risk score: ${s.risk_score??'—'}/100  ·  Findings: ${s.total_findings??0} total (${s.critical_count??0} critical, ${s.high_count??0} high, ${s.medium_count??0} medium, ${s.low_count??0} low)\nCommit: ${s.commit_sha?String(s.commit_sha).slice(0,10):'—'}  ·  Validated: ${s.completed_at?new Date(s.completed_at).toLocaleString():'—'}`);
  }

  if(findings&&findings.length){
    section('Open critical / high findings referenced',
      findings.map((f:any)=>`• [${f.severity.toUpperCase()}] ${f.title}${f.recommendation?` — ${f.recommendation}`:''}`).join('\n'));
  }

  if(cr.scheduled_start||cr.scheduled_end){
    section('Scheduled window',
      `${cr.scheduled_start?new Date(cr.scheduled_start).toLocaleString():'—'}  →  ${cr.scheduled_end?new Date(cr.scheduled_end).toLocaleString():'—'}`);
  }

  section('Approval',
    `Sent to: ${cr.approver_name||'—'}${cr.approver_email?` (${cr.approver_email})`:''}\nDecision: ${cr.decided_at?`${STATUS_LABEL[cr.status]||cr.status} on ${new Date(cr.decided_at).toLocaleString()}`:'Not yet decided'}${cr.decision_note?`\nNote: ${cr.decision_note}`:''}`);

  doc.save(`${(cr.title||'change-request').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.pdf`);
}

export function ChangeManagementPage(){
  const{user}=useAuth();
  const[loading,setLoading]=useState(true);
  const[projects,setProjects]=useState<any[]>([]);
  const[requests,setRequests]=useState<any[]>([]);
  const[selProjectId,setSelProjectId]=useState('');
  const[context,setContext]=useState<{validation:any;findings:any[]}|null>(null);
  const[contextLoading,setContextLoading]=useState(false);
  const[generating,setGenerating]=useState(false);
  const[active,setActive]=useState<any|null>(null);
  const[comments,setComments]=useState<any[]>([]);
  const[commentText,setCommentText]=useState('');
  const[saving,setSaving]=useState(false);
  const[showNew,setShowNew]=useState(false);
  const[latestValidations,setLatestValidations]=useState<Record<string,any>>({});
  const[openFindingsByProject,setOpenFindingsByProject]=useState<Record<string,number>>({});
  const[draftingId,setDraftingId]=useState('');
  const[activeSteps,setActiveSteps]=useState<any[]>([]);
  const[activeFindings,setActiveFindings]=useState<any[]>([]);
  const[stepsLoading,setStepsLoading]=useState(false);
  const[aiLoading,setAiLoading]=useState(false);
  const[aiUnavailable,setAiUnavailable]=useState('');
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

  // Fetches the real validation pipeline steps + full finding list behind a
  // change request, used by the readiness checklist / what's-changing / risk
  // cards in the detail view. A no-op if the change request has no linked
  // validation (nothing to show, and we say so rather than invent it).
  const loadActiveExtras=async(cr:any)=>{
    setActiveSteps([]);setActiveFindings([]);setAiUnavailable('');
    if(!cr.validation_id)return;
    setStepsLoading(true);
    const[{data:steps},{data:finds}]=await Promise.all([
      supabase.from('validation_steps').select('*').eq('validation_id',cr.validation_id).order('step_index'),
      supabase.from('findings').select('*').eq('validation_id',cr.validation_id).order('severity'),
    ]);
    setActiveSteps(steps??[]);setActiveFindings(finds??[]);
    setStepsLoading(false);
  };

  // Calls the change-request-ai edge function, which grounds everything it
  // generates in this change request's own real validation/findings/history
  // — see that function for the "never invent" contract. Merges whatever it
  // returns onto the active record; if AI is unavailable or fails, surfaces
  // that honestly instead of showing fabricated text.
  const generateInsights=async(crId:string)=>{
    setAiLoading(true);setAiUnavailable('');
    try{
      const res=await fetch(`${edgeFunctionUrl}/change-request-ai`,{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${anonKey}`,apikey:anonKey},
        body:JSON.stringify({change_request_id:crId}),
      });
      const d=await res.json();
      if(d.error){
        setAiUnavailable(d.message||'AI insights are unavailable right now.');
      }else{
        setActive((a:any)=>a&&a.id===crId?{...a,...d}:a);
        setRequests((rs:any[])=>rs.map(r=>r.id===crId?{...r,...d}:r));
      }
    }catch(e:any){
      setAiUnavailable('AI service unreachable: '+(e.message||'unknown error'));
    }
    setAiLoading(false);
  };

  // Shared drafting logic — takes whatever real validation/findings data is
  // available for a project and turns it into a change_requests row. Used by
  // both the "Generate from latest validation" panel and the one-click
  // "Generate change request" action on each project card.
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
    if(data){
      await load();
      setActive(data);setShowNew(false);
      loadActiveExtras(data);
      generateInsights(data.id);
    }
  };

  // One-click draft straight from a project card — reuses whatever
  // validation LytHouse already has on file rather than making the user
  // open the panel and re-select the same project. Automatically kicks off
  // AI analysis on the freshly drafted request.
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
    if(cr){
      await load();
      setActive(cr);
      loadActiveExtras(cr);
      generateInsights(cr.id);
    }
  };

  const openRequest=async(cr:any)=>{
    setActive(cr);
    const{data}=await supabase.from('change_request_comments').select('*').eq('change_request_id',cr.id).order('created_at');
    setComments(data??[]);
    loadActiveExtras(cr);
  };

  const saveField=async(patch:Record<string,any>)=>{
    if(!active)return;
    setSaving(true);
    const{data}=await supabase.from('change_requests').update({...patch,revision:(active.revision||1)+1}).eq('id',active.id).select().single();
    if(data){setActive(data);setRequests(rs=>rs.map(r=>r.id===data.id?data:r));}
    setSaving(false);
  };

  const decide=async(status:'approved'|'rejected',note:string)=>{
    await saveField({status,decided_by:user?.id||null,decided_at:new Date().toISOString(),decision_note:note||null});
  };

  const markOutcome=async(status:'completed'|'rolled_back')=>{
    await saveField({status});
  };

  const addComment=async()=>{
    if(!active||!commentText.trim())return;
    const wid=wsId();
    const{data}=await supabase.from('change_request_comments').insert({
      change_request_id:active.id,workspace_id:wid,body:commentText.trim(),
    }).select().single();
    if(data){setComments(c=>[...c,data]);setCommentText('');}
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

  // ── Detail view ──────────────────────────────────────────────────────────
  if(active){
    const relatedFindings=activeFindings.filter((f:any)=>f.status==='open'&&(f.severity==='critical'||f.severity==='high'));
    const previous=requests.filter((r:any)=>r.project_id===active.project_id&&r.id!==active.id).slice(0,5);
    return<div className="max-w-4xl">
      <button onClick={()=>setActive(null)} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-navy-700"><ChevronLeft size={14}/>Back to change requests</button>

      <div className="card mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-navy-900">{active.title}</h1>
            <p className="mt-1 text-xs text-gray-500">{projectName(active.project_id)} · {active.environment} · requested {timeAgo(active.created_at)} · v{active.revision||1}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`chip ${RISK_CLS[active.risk_level]||RISK_CLS.unknown}`}>{(active.risk_level||'unknown').toUpperCase()} risk</span>
            <span className={`chip ${STATUS_CLS[active.status]||STATUS_CLS.draft}`}>{STATUS_LABEL[active.status]||active.status}</span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <ExecutiveSummaryCard cr={active} onGenerate={()=>generateInsights(active.id)} loading={aiLoading} unavailable={aiUnavailable}/>

        <div className="grid gap-5 lg:grid-cols-2">
          <RiskAssessmentCard cr={active}/>
          <ReadinessChecklist cr={active} steps={activeSteps} stepsLoading={stepsLoading}/>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <ImpactAnalysisCard cr={active} onGenerate={()=>generateInsights(active.id)} loading={aiLoading}/>
          <WhatsChangingCard steps={activeSteps} findings={activeFindings}/>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <DeploymentTimeline cr={active}/>
          <PreviousChangesCard items={previous} loading={false}/>
        </div>

        <RollbackPlanCard cr={active} onGenerate={()=>generateInsights(active.id)} loading={aiLoading}/>
        <ReviewerCommentsCard cr={active} onGenerate={()=>generateInsights(active.id)} loading={aiLoading}/>

        <div className="card">
          <p className="mb-3.5 text-sm font-semibold text-navy-900">Change details</p>
          <div className="space-y-5">
            <Field label="Summary" value={active.summary} onSave={(v)=>saveField({summary:v})} disabled={saving}/>
            <div>
              <label className="label">Scope of change</label>
              <div className="flex flex-wrap gap-1.5">
                {(active.scope||[]).length===0&&<span className="text-xs text-gray-400">General</span>}
                {(active.scope||[]).map((s:string)=><span key={s} className="chip bg-gray-100 text-gray-600 border border-gray-200">{s}</span>)}
              </div>
            </div>
            <Field label="Risk assessment (editable record)" value={active.risk_assessment} onSave={(v)=>saveField({risk_assessment:v})} multiline disabled={saving}/>
            <Field label="Rollback plan (editable record)" value={active.rollback_plan} onSave={(v)=>saveField({rollback_plan:v})} multiline disabled={saving}/>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label flex items-center gap-1"><Calendar size={12}/>Scheduled start</label>
                <input type="datetime-local" className="input" defaultValue={active.scheduled_start?.slice(0,16)||''} onBlur={(e)=>saveField({scheduled_start:e.target.value||null})}/>
              </div>
              <div>
                <label className="label flex items-center gap-1"><Calendar size={12}/>Scheduled end</label>
                <input type="datetime-local" className="input" defaultValue={active.scheduled_end?.slice(0,16)||''} onBlur={(e)=>saveField({scheduled_end:e.target.value||null})}/>
              </div>
              <div>
                <label className="label">Approver name</label>
                <input className="input" defaultValue={active.approver_name||''} placeholder="e.g. VP Engineering" onBlur={(e)=>saveField({approver_name:e.target.value||null})}/>
              </div>
              <div>
                <label className="label">Approver email</label>
                <input className="input" defaultValue={active.approver_email||''} placeholder="approver@company.com" onBlur={(e)=>saveField({approver_email:e.target.value||null})}/>
              </div>
            </div>
          </div>
        </div>

        {active.status==='pending_approval'&&(
          <DecisionBar onDecide={decide}/>
        )}
        {active.decided_at&&(
          <div className="rounded-xl border border-gray-200 p-3 text-xs text-gray-600">
            {STATUS_LABEL[active.status]} on {new Date(active.decided_at).toLocaleString()}{active.decision_note?` — "${active.decision_note}"`:''}
          </div>
        )}
        {active.status==='approved'&&(
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3.5">
            <p className="mr-auto text-xs font-medium text-green-700">Approved — once it ships, record the real outcome so future "previous changes" history stays accurate.</p>
            <button onClick={()=>markOutcome('completed')} className="btn-secondary text-xs flex items-center gap-1.5"><CheckCircle2 size={12}/>Mark completed</button>
            <button onClick={()=>markOutcome('rolled_back')} className="btn-secondary text-xs flex items-center gap-1.5"><XCircle size={12}/>Mark rolled back</button>
          </div>
        )}

        <div className="card">
          <div className="flex flex-wrap items-center gap-2">
            {active.status==='draft'&&(
              <button onClick={()=>saveField({status:'pending_approval'})} className="btn-brand text-xs flex items-center gap-1.5"><Send size={12}/>Send for approval</button>
            )}
            <button onClick={()=>downloadChangePlanPdf(active,projectName(active.project_id),relatedFindings)} className="btn-secondary text-xs flex items-center gap-1.5"><Download size={12}/>Download PDF report</button>
          </div>
        </div>

        <div className="card">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-navy-900"><MessageSquare size={14}/>Discussion</p>
          <div className="space-y-3">
            {comments.length===0&&<p className="text-xs text-gray-400">No comments yet — coordinate the change with your team here.</p>}
            {comments.map((c:any)=>(
              <div key={c.id} className="rounded-xl bg-gray-50 px-3.5 py-2.5">
                <p className="text-sm text-navy-800">{c.body}</p>
                <p className="mt-1 text-[11px] text-gray-400">{timeAgo(c.created_at)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={commentText} onChange={(e)=>setCommentText(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')addComment();}} className="input" placeholder="Add a note for your team…"/>
            <button onClick={addComment} className="btn-secondary text-xs shrink-0">Post</button>
          </div>
        </div>
      </div>
    </div>;
  }

  // ── List view ────────────────────────────────────────────────────────────
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
            {generating?<><Spinner size={12}/>Generating…</>:<><Sparkles size={12}/>Generate from latest validation</>}
          </button>
        </div>

        {selProjectId&&!contextLoading&&(
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-xs text-gray-600">
            {context?.validation?(
              <>Latest validation: <span className="font-semibold text-navy-800">{context.validation.risk_score??'—'}/100 risk</span> · {context.validation.critical_count} critical · {context.validation.high_count} high · validated {timeAgo(context.validation.completed_at||context.validation.created_at)}. The plan below will be drafted from this data, then AI-analyzed automatically.</>
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
            <HowStep icon={<Sparkles size={16}/>} title="2. AI drafts and analyzes" desc="A full change request is drafted, then AI generates an executive summary, impact analysis, and reviewer notes from that same real data."/>
            <HowStep icon={<Send size={16}/>} title="3. Route it for sign-off" desc="Send it to an approver, track the decision and real deployment outcome, and export a premium PDF for the record."/>
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
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total requests" value={requests.length}/>
          <StatCard label="Pending approval" value={requests.filter((r:any)=>r.status==='pending_approval').length}/>
          <StatCard label="Approved" value={requests.filter((r:any)=>r.status==='approved').length}/>
          <StatCard label="Scheduled" value={requests.filter((r:any)=>r.status==='scheduled').length}/>
        </div>
        <div className="card p-0">
          <div className="divide-y divide-gray-100">
            {requests.map((r:any)=>(
              <button key={r.id} onClick={()=>openRequest(r)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50">
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

function Field({label,value,onSave,multiline,disabled}:{label:string;value:string;onSave:(v:string)=>void;multiline?:boolean;disabled?:boolean}){
  const[v,setV]=useState(value||'');
  useEffect(()=>{setV(value||'');},[value]);
  const Tag:any=multiline?'textarea':'input';
  return<div>
    <label className="label">{label}</label>
    <Tag className="input" rows={multiline?5:undefined} value={v} disabled={disabled}
      onChange={(e:any)=>setV(e.target.value)} onBlur={()=>{if(v!==value)onSave(v);}}/>
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

function DecisionBar({onDecide}:{onDecide:(status:'approved'|'rejected',note:string)=>void}){
  const[note,setNote]=useState('');
  return<div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
    <p className="mb-2 text-xs font-semibold text-amber-700">This change is awaiting a decision.</p>
    <input value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Decision note (optional)" className="input mb-2"/>
    <div className="flex gap-2">
      <button onClick={()=>onDecide('approved',note)} className="btn-brand text-xs flex items-center gap-1.5"><CheckCircle2 size={12}/>Approve</button>
      <button onClick={()=>onDecide('rejected',note)} className="btn-secondary text-xs flex items-center gap-1.5"><X size={12}/>Reject</button>
    </div>
  </div>;
}
