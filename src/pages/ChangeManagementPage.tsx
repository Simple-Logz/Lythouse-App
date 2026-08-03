// @ts-nocheck
import{useEffect,useState,useCallback}from'react';
import{supabase}from'../lib/supabase';
import{useAuth}from'../lib/auth';
import{PageHeader,Spinner,EmptyState,timeAgo}from'../lib/ui';
import{
  FileText,Plus,Sparkles,ShieldCheck,AlertTriangle,Clock,CheckCircle2,XCircle,
  Download,MessageSquare,Send,Calendar,GitBranch,ChevronLeft,X,
}from'lucide-react';
import{jsPDF}from'jspdf';

// ── Change Management ──────────────────────────────────────────────────────
// A formal record filed before a production deployment: what's changing, the
// risk, the rollback plan, and who signed off. Unlike release_approvals
// (security/platform/product sign-off on one specific release), this is the
// broader "here's the change, here's the evidence, here's how we undo it if
// it goes wrong" document a team sends up the chain — and it is auto-drafted
// from the project's own real validation + findings data rather than typed
// from scratch. Anything the data can't tell us (schedule, who approves,
// decision notes) is left for a human to fill in, never invented.

const RISK_CLS: Record<string,string> = {
  critical:'bg-red-50 text-danger-600 border border-red-200',
  high:'bg-amber-50 text-amber-600 border border-amber-200',
  medium:'bg-brand-50 text-brand-700 border border-brand-200',
  low:'bg-green-50 text-green-700 border border-green-200',
  unknown:'bg-gray-100 text-gray-500 border border-gray-200',
};
const STATUS_CLS: Record<string,string> = {
  draft:'bg-gray-100 text-gray-600 border border-gray-200',
  pending_approval:'bg-amber-50 text-amber-600 border border-amber-200',
  approved:'bg-green-50 text-green-700 border border-green-200',
  rejected:'bg-red-50 text-danger-600 border border-red-200',
  scheduled:'bg-blue-50 text-blue-600 border border-blue-200',
  completed:'bg-brand-50 text-brand-700 border border-brand-200',
  cancelled:'bg-gray-100 text-gray-500 border border-gray-200',
};
const STATUS_LABEL: Record<string,string> = {
  draft:'Draft',pending_approval:'Pending approval',approved:'Approved',rejected:'Rejected',
  scheduled:'Scheduled',completed:'Completed',cancelled:'Cancelled',
};

function riskFromCounts(v:any):string{
  if(!v)return'unknown';
  if((v.critical_count||0)>0)return'critical';
  if((v.high_count||0)>0)return'high';
  if((v.medium_count||0)>0)return'medium';
  return'low';
}

// Draws the report as a PDF using LytHouse's own in-app brand mark (a
// rounded shield-check glyph + wordmark) — the same mark rendered by
// <Logo/> elsewhere in the product, not a fabricated company logo.
function downloadChangePlanPdf(cr:any, projectName:string, findings:any[]){
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const pw=doc.internal.pageSize.getWidth();
  let y=0;

  // Header band
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

  section('Summary',cr.summary);
  section('Scope of change',(cr.scope&&cr.scope.length?cr.scope:['General']).map((s:string)=>`• ${s}`).join('\n'));
  section('Risk assessment',cr.risk_assessment);
  section('Rollback plan',cr.rollback_plan);

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
  const{user,profile}=useAuth();
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
  const wsId=()=>localStorage.getItem('sandbox.activeWs');

  const load=useCallback(async()=>{
    setLoading(true);
    const wid=wsId();if(!wid){setLoading(false);return;}
    const[pr,cr]=await Promise.all([
      supabase.from('projects').select('id,name,git_branch').eq('workspace_id',wid).order('name'),
      supabase.from('change_requests').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(100),
    ]);
    setProjects(pr.data??[]);
    setRequests(cr.data??[]);
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

  const generatePlan=async()=>{
    const wid=wsId();const project=projects.find(p=>p.id===selProjectId);
    if(!wid||!project)return;
    setGenerating(true);
    const v=context?.validation;
    const findings=context?.findings??[];
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
    setGenerating(false);
    if(!error&&data){
      await load();
      setActive(data);setShowNew(false);
    }
  };

  const openRequest=async(cr:any)=>{
    setActive(cr);
    const{data}=await supabase.from('change_request_comments').select('*').eq('change_request_id',cr.id).order('created_at');
    setComments(data??[]);
  };

  const saveField=async(patch:Record<string,any>)=>{
    if(!active)return;
    setSaving(true);
    const{data}=await supabase.from('change_requests').update(patch).eq('id',active.id).select().single();
    if(data){setActive(data);setRequests(rs=>rs.map(r=>r.id===data.id?data:r));}
    setSaving(false);
  };

  const decide=async(status:'approved'|'rejected',note:string)=>{
    await saveField({status,decided_by:user?.id||null,decided_at:new Date().toISOString(),decision_note:note||null});
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

  if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

  // ── Detail view ──────────────────────────────────────────────────────────
  if(active){
    const relatedFindings=active.risk_assessment&&context?.validation?.id===active.validation_id?(context.findings??[]):[];
    return<div className="max-w-3xl">
      <button onClick={()=>setActive(null)} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-navy-700"><ChevronLeft size={14}/>Back to change requests</button>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h1 className="text-lg font-bold text-navy-900">{active.title}</h1>
            <p className="mt-1 text-xs text-gray-500">{projectName(active.project_id)} · {active.environment} · requested {timeAgo(active.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`chip ${RISK_CLS[active.risk_level]||RISK_CLS.unknown}`}>{(active.risk_level||'unknown').toUpperCase()} risk</span>
            <span className={`chip ${STATUS_CLS[active.status]||STATUS_CLS.draft}`}>{STATUS_LABEL[active.status]||active.status}</span>
          </div>
        </div>

        <div className="space-y-5 py-5">
          <Field label="Summary" value={active.summary} onSave={(v)=>saveField({summary:v})} disabled={saving}/>
          <div>
            <label className="label">Scope of change</label>
            <div className="flex flex-wrap gap-1.5">
              {(active.scope||[]).length===0&&<span className="text-xs text-gray-400">General</span>}
              {(active.scope||[]).map((s:string)=><span key={s} className="chip bg-gray-100 text-gray-600 border border-gray-200">{s}</span>)}
            </div>
          </div>
          <Field label="Risk assessment" value={active.risk_assessment} onSave={(v)=>saveField({risk_assessment:v})} multiline disabled={saving}/>
          <Field label="Rollback plan" value={active.rollback_plan} onSave={(v)=>saveField({rollback_plan:v})} multiline disabled={saving}/>

          {active.validation_snapshot&&Object.keys(active.validation_snapshot).length>0&&(
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Validation snapshot</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-4">
                <div><span className="font-semibold text-navy-800">{active.validation_snapshot.risk_score??'—'}</span>/100 risk</div>
                <div><span className="font-semibold text-navy-800">{active.validation_snapshot.critical_count??0}</span> critical</div>
                <div><span className="font-semibold text-navy-800">{active.validation_snapshot.high_count??0}</span> high</div>
                <div><span className="font-semibold text-navy-800">{active.validation_snapshot.total_findings??0}</span> total findings</div>
              </div>
            </div>
          )}

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

          {active.status==='pending_approval'&&(
            <DecisionBar onDecide={decide}/>
          )}
          {active.decided_at&&(
            <div className="rounded-xl border border-gray-200 p-3 text-xs text-gray-600">
              {STATUS_LABEL[active.status]} on {new Date(active.decided_at).toLocaleString()}{active.decision_note?` — “${active.decision_note}”`:''}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          {active.status==='draft'&&(
            <button onClick={()=>saveField({status:'pending_approval'})} className="btn-brand text-xs flex items-center gap-1.5"><Send size={12}/>Send for approval</button>
          )}
          <button onClick={()=>downloadChangePlanPdf(active,projectName(active.project_id),relatedFindings)} className="btn-secondary text-xs flex items-center gap-1.5"><Download size={12}/>Download PDF report</button>
        </div>
      </div>

      <div className="card mt-4">
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
    </div>;
  }

  // ── List view ────────────────────────────────────────────────────────────
  return<div>
    <PageHeader title="Change Management" description="File a formal change request before every production deployment — auto-drafted from your project's real validation data."
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
              <>Latest validation: <span className="font-semibold text-navy-800">{context.validation.risk_score??'—'}/100 risk</span> · {context.validation.critical_count} critical · {context.validation.high_count} high · validated {timeAgo(context.validation.completed_at||context.validation.created_at)}. The plan below will be drafted from this data.</>
            ):(
              <span className="flex items-center gap-1.5 text-amber-600"><AlertTriangle size={13}/>No completed validation found for this project yet — run one first for the most accurate plan, or generate anyway with limited context.</span>
            )}
          </div>
        )}
        {selProjectId&&contextLoading&&<div className="mt-3 flex items-center gap-2 text-xs text-gray-400"><Spinner size={12}/>Loading validation context…</div>}
      </div>
    )}

    {requests.length===0?(
      <EmptyState icon={<FileText size={22}/>} title="No change requests yet" description="Start one above — LytHouse drafts the summary, risk assessment, and rollback plan from your project's real validation data so nobody has to write it from scratch." action={<button onClick={()=>setShowNew(true)} className="btn-primary">New change request</button>}/>
    ):(
      <div className="card p-0">
        <div className="divide-y divide-gray-100">
          {requests.map((r:any)=>(
            <button key={r.id} onClick={()=>openRequest(r)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${RISK_CLS[r.risk_level]||RISK_CLS.unknown}`}>
                {r.status==='approved'?<CheckCircle2 size={16}/>:r.status==='rejected'?<XCircle size={16}/>:r.status==='pending_approval'?<Clock size={16}/>:<FileText size={16}/>}
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
