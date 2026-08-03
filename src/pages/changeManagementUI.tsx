// @ts-nocheck
// Modular presentation components for the Change Management Hub.
// Kept in a companion file (rather than inline in ChangeManagementPage.tsx)
// so each piece is independently reusable and the parent page stays legible.
//
// HONESTY NOTE: every component here only ever renders fields that were
// actually returned by the database or the change-request-ai edge function.
// None of these components invent placeholder content — where there's
// nothing to show, they render an explicit "not generated yet" / "no data"
// state instead of a plausible-looking fake one.
import{Sparkles,ShieldAlert,GitBranch,Calendar,Clock,CheckCircle2,XCircle,AlertTriangle,MessageSquareWarning,RotateCcw,ListChecks,Layers,History}from'lucide-react';
import{RiskGauge,StepIcon,SeverityBadge,Spinner,timeAgo}from'../lib/ui';

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
  rolled_back:'bg-orange-50 text-orange-600 border border-orange-200',
  cancelled:'bg-gray-100 text-gray-500 border border-gray-200',
};
const STATUS_LABEL: Record<string,string> = {
  draft:'Draft',pending_approval:'Pending approval',approved:'Approved',rejected:'Rejected',
  scheduled:'Scheduled',completed:'Completed',rolled_back:'Rolled back',cancelled:'Cancelled',
};
export{RISK_CLS,STATUS_CLS,STATUS_LABEL};

// ── Section shell ────────────────────────────────────────────────────────
function Section({icon,title,action,children,muted}:{icon:any;title:string;action?:any;children:any;muted?:boolean}){
  return<div className={`card ${muted?'opacity-90':''}`}>
    <div className="mb-3.5 flex items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">{icon}{title}</p>
      {action}
    </div>
    {children}
  </div>;
}

function NotGenerated({onGenerate,loading,label}:{onGenerate:()=>void;loading:boolean;label:string}){
  return<div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3.5 py-3">
    <p className="text-xs text-gray-500">{label}</p>
    <button onClick={onGenerate} disabled={loading} className="btn-secondary text-xs shrink-0 flex items-center gap-1.5 disabled:opacity-50">
      {loading?<><Spinner size={11}/>Analyzing…</>:<><Sparkles size={11}/>Generate</>}
    </button>
  </div>;
}

// ── 1. AI Executive Summary ─────────────────────────────────────────────
export function ExecutiveSummaryCard({cr,onGenerate,loading,unavailable}:{cr:any;onGenerate:()=>void;loading:boolean;unavailable?:string}){
  return<Section icon={<Sparkles size={14} className="text-brand-600"/>} title="AI executive summary">
    {cr.ai_summary?(
      <p className="text-sm leading-relaxed text-navy-800">{cr.ai_summary}</p>
    ):unavailable?(
      <p className="flex items-start gap-1.5 text-xs text-amber-600"><AlertTriangle size={13} className="mt-0.5 shrink-0"/>{unavailable}</p>
    ):(
      <NotGenerated onGenerate={onGenerate} loading={loading} label="Generate a grounded executive summary from this change's validation data."/>
    )}
  </Section>;
}

// ── 2. AI Impact Analysis ───────────────────────────────────────────────
export function ImpactAnalysisCard({cr,onGenerate,loading}:{cr:any;onGenerate:()=>void;loading:boolean}){
  const items=cr.ai_impact||[];
  return<Section icon={<Layers size={14} className="text-brand-600"/>} title="Impact analysis">
    {cr.ai_generated_at?(
      items.length?(
        <div className="space-y-2.5">
          {items.map((it:any,i:number)=>(
            <div key={i} className="rounded-xl border border-gray-200 px-3.5 py-2.5">
              <p className="text-sm font-semibold text-navy-900">{it.component}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{it.reason}</p>
            </div>
          ))}
        </div>
      ):(
        <p className="text-xs text-gray-400">The scan data behind this change doesn't identify specific affected components — findings weren't tied to a distinct service or API.</p>
      )
    ):(
      <NotGenerated onGenerate={onGenerate} loading={loading} label="Identify affected components from this change's real scan data."/>
    )}
  </Section>;
}

// ── 3. Enhanced risk assessment ─────────────────────────────────────────
export function RiskAssessmentCard({cr}:{cr:any}){
  const snap=cr.validation_snapshot||{};
  const score=typeof snap.risk_score==='number'?snap.risk_score:null;
  const contributors=cr.ai_risk_contributors&&cr.ai_risk_contributors.length?cr.ai_risk_contributors:fallbackContributors(snap);
  return<Section icon={<ShieldAlert size={14} className="text-brand-600"/>} title="Risk assessment">
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <RiskGauge score={score} size={104}/>
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">High-risk contributors</p>
        {contributors.length?(
          <div className="space-y-2">
            {contributors.map((c:any,i:number)=>(
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"/>
                <span><span className="font-semibold text-navy-800">{c.label}</span> — <span className="text-gray-500">{c.reason}</span></span>
              </div>
            ))}
          </div>
        ):(
          <p className="text-xs text-gray-400">No elevated risk contributors — the source validation came back clean.</p>
        )}
      </div>
    </div>
  </Section>;
}
function fallbackContributors(snap:any){
  const out:{label:string;reason:string}[]=[];
  if(snap.critical_count>0)out.push({label:`${snap.critical_count} critical finding${snap.critical_count===1?'':'s'}`,reason:'Unresolved at time of drafting — highest-severity category.'});
  if(snap.high_count>0)out.push({label:`${snap.high_count} high-severity finding${snap.high_count===1?'':'s'}`,reason:'Unresolved at time of drafting.'});
  if(snap.medium_count>0)out.push({label:`${snap.medium_count} medium-severity finding${snap.medium_count===1?'':'s'}`,reason:'Lower urgency but contributes to the overall score.'});
  return out;
}

// ── 4. Deployment readiness checklist ───────────────────────────────────
export function ReadinessChecklist({cr,steps,stepsLoading}:{cr:any;steps:any[];stepsLoading:boolean}){
  const planChecks=[
    {label:'Rollback plan documented',ok:!!(cr.rollback_plan&&cr.rollback_plan.trim())},
    {label:'Deployment window scheduled',ok:!!(cr.scheduled_start&&cr.scheduled_end)},
    {label:'Approver assigned',ok:!!(cr.approver_name||cr.approver_email)},
  ];
  return<Section icon={<ListChecks size={14} className="text-brand-600"/>} title="Deployment readiness checklist">
    {stepsLoading?(
      <div className="flex items-center gap-2 py-4 text-xs text-gray-400"><Spinner size={12}/>Loading validation pipeline…</div>
    ):(
      <div className="space-y-2.5">
        {steps.map((s:any)=>(
          <ChecklistRow key={s.id} ok={s.status==='completed'} warn={s.status==='failed'} label={s.name} detail={s.detail}/>
        ))}
        {planChecks.map((c)=>(
          <ChecklistRow key={c.label} ok={c.ok} warn={!c.ok} label={c.label} detail={c.ok?undefined:'Not set yet — add it before sending for approval.'}/>
        ))}
      </div>
    )}
  </Section>;
}
function ChecklistRow({ok,warn,label,detail}:{ok:boolean;warn?:boolean;label:string;detail?:string}){
  return<div className="flex items-start gap-2.5">
    {ok?<CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600"/>:warn?<AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500"/>:<span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-gray-200"/>}
    <div className="min-w-0 flex-1">
      <p className={`text-sm ${ok?'text-navy-800':'text-navy-700'}`}>{label}</p>
      {detail&&<p className="mt-0.5 text-xs text-gray-400">{detail}</p>}
    </div>
  </div>;
}

// ── 5. AI rollback plan ─────────────────────────────────────────────────
export function RollbackPlanCard({cr,onGenerate,loading}:{cr:any;onGenerate:()=>void;loading:boolean}){
  const rb=cr.ai_rollback||{};
  const has=rb.steps&&rb.steps.length;
  return<Section icon={<RotateCcw size={14} className="text-brand-600"/>} title="Rollback plan">
    {has?(
      <div className="space-y-4">
        <ol className="space-y-1.5">
          {rb.steps.map((s:string,i:number)=>(
            <li key={i} className="flex gap-2 text-sm text-navy-800"><span className="font-semibold text-gray-400">{i+1}.</span>{s}</li>
          ))}
        </ol>
        <div className="grid gap-3 sm:grid-cols-2">
          {rb.estimated_duration&&<Meta label="Estimated duration" value={rb.estimated_duration} icon={<Clock size={12}/>}/>}
          {!!(rb.approvals_required&&rb.approvals_required.length)&&<Meta label="Approvals required" value={rb.approvals_required.join(', ')} icon={<CheckCircle2 size={12}/>}/>}
        </div>
        {!!(rb.dependencies&&rb.dependencies.length)&&<MetaList label="Dependencies" items={rb.dependencies}/>}
        {!!(rb.risks&&rb.risks.length)&&<MetaList label="Rollback risks" items={rb.risks} warn/>}
      </div>
    ):(
      <NotGenerated onGenerate={onGenerate} loading={loading} label="Draft a structured, DevOps-style rollback plan for this specific change."/>
    )}
  </Section>;
}
function Meta({label,value,icon}:{label:string;value:string;icon:any}){
  return<div className="rounded-lg bg-gray-50 px-3 py-2"><p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-gray-400">{icon}{label}</p><p className="mt-0.5 text-xs text-navy-800">{value}</p></div>;
}
function MetaList({label,items,warn}:{label:string;items:string[];warn?:boolean}){
  return<div><p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    <ul className="space-y-1">{items.map((it,i)=><li key={i} className={`flex gap-1.5 text-xs ${warn?'text-amber-700':'text-gray-600'}`}><span className="mt-0.5">{warn?'⚠':'•'}</span>{it}</li>)}</ul>
  </div>;
}

// ── 6. Deployment timeline ──────────────────────────────────────────────
export function DeploymentTimeline({cr}:{cr:any}){
  const terminal=cr.status==='completed'||cr.status==='rolled_back';
  const rejected=cr.status==='rejected';
  const cancelled=cr.status==='cancelled';
  const stages=[
    {key:'created',name:'Request created',done:true,detail:timeAgo(cr.created_at)},
    {key:'validated',name:'Validation completed',done:!!cr.validation_snapshot?.completed_at,detail:cr.validation_snapshot?.completed_at?timeAgo(cr.validation_snapshot.completed_at):'No validation attached'},
    {key:'approval',name:rejected?'Rejected':'Awaiting approval',done:['pending_approval','approved','scheduled','completed','rolled_back','rejected'].includes(cr.status),detail:cr.decided_at?timeAgo(cr.decided_at):undefined},
    {key:'scheduled',name:'Scheduled',done:!!(cr.scheduled_start),detail:cr.scheduled_start?new Date(cr.scheduled_start).toLocaleString():undefined},
    {key:'deployed',name:'Deployment',done:terminal,detail:undefined},
    {key:'monitoring',name:cr.status==='rolled_back'?'Rolled back':'Completed',done:terminal,detail:undefined},
  ];
  if(rejected||cancelled)return<Section icon={<Clock size={14} className="text-brand-600"/>} title="Deployment timeline">
    <div className="flex items-center gap-2 text-sm text-gray-500"><XCircle size={16} className="text-danger-500"/>{rejected?'This change was rejected — it will not proceed.':'This change was cancelled.'}</div>
  </Section>;
  return<Section icon={<Clock size={14} className="text-brand-600"/>} title="Deployment timeline">
    <div className="relative">
      {stages.map((s,i)=>{
        const isLast=i===stages.length-1;
        return<div key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
          {!isLast&&<div className={`absolute left-[9px] top-6 h-[calc(100%-1.25rem)] w-0.5 ${s.done?'bg-brand-500':'bg-gray-200'} transition-colors`}/>}
          <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${s.done?'bg-brand-500 text-white':'border-2 border-gray-200 bg-white'}`}>{s.done&&<CheckCircle2 size={12}/>}</span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm ${s.done?'font-semibold text-navy-900':'text-gray-400'}`}>{s.name}</p>
            {s.detail&&<p className="text-xs text-gray-400">{s.detail}</p>}
          </div>
        </div>;
      })}
    </div>
  </Section>;
}

// ── 7. What's changing ──────────────────────────────────────────────────
export function WhatsChangingCard({steps,findings}:{steps:any[];findings:any[]}){
  const byArea:Record<string,number>={};
  for(const f of findings){
    const p=f.file_path;
    const area=p?p.split('/').slice(0,-1).join('/')||p:f.category;
    byArea[area]=(byArea[area]||0)+1;
  }
  const areas=Object.entries(byArea).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const byCategory:Record<string,number>={};
  for(const f of findings)byCategory[f.category]=(byCategory[f.category]||0)+1;
  return<Section icon={<GitBranch size={14} className="text-brand-600"/>} title="What's changing">
    {steps.length===0&&findings.length===0?(
      <p className="text-xs text-gray-400">No validation is attached to this change yet, so there's nothing to summarize.</p>
    ):(
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(byCategory).map(([cat,count])=>(
            <div key={cat} className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <p className="text-lg font-bold text-navy-900">{count}</p>
              <p className="text-2xs text-gray-500">{cat.replace(/_/g,' ')}</p>
            </div>
          ))}
        </div>
        {areas.length>0&&(
          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-gray-400">Flagged areas</p>
            <div className="flex flex-wrap gap-1.5">
              {areas.map(([area,count])=><span key={area} className="chip bg-gray-100 text-gray-600 border border-gray-200 font-mono text-2xs">{area}/ <span className="font-sans font-semibold">×{count}</span></span>)}
            </div>
          </div>
        )}
        <p className="text-2xs leading-relaxed text-gray-400">Reflects the latest validation's scan scope and findings — LytHouse doesn't yet compute a full file-level git diff between deployments, so this isn't a commit-by-commit change list.</p>
      </div>
    )}
  </Section>;
}

// ── 8. Previous similar changes ─────────────────────────────────────────
export function PreviousChangesCard({items,loading}:{items:any[];loading:boolean}){
  return<Section icon={<History size={14} className="text-brand-600"/>} title="Previous changes for this project">
    {loading?(
      <div className="flex items-center gap-2 py-3 text-xs text-gray-400"><Spinner size={12}/>Loading history…</div>
    ):items.length===0?(
      <p className="text-xs text-gray-400">No prior change requests for this project yet — this will build a track record over time.</p>
    ):(
      <div className="divide-y divide-gray-100">
        {items.map((it:any)=>(
          <div key={it.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className={`chip shrink-0 ${RISK_CLS[it.risk_level]||RISK_CLS.unknown}`}>{(it.risk_level||'unknown').toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-navy-800">{it.title}</p>
              <p className="text-2xs text-gray-400">{timeAgo(it.created_at)}</p>
            </div>
            <span className={`chip shrink-0 ${STATUS_CLS[it.status]||STATUS_CLS.draft}`}>{STATUS_LABEL[it.status]||it.status}</span>
            <span className={`shrink-0 text-2xs font-medium ${it.status==='rolled_back'?'text-orange-600':it.status==='completed'?'text-green-600':'text-gray-300'}`}>
              {it.status==='rolled_back'?'Rollback: Yes':it.status==='completed'?'Rollback: No':'—'}
            </span>
          </div>
        ))}
      </div>
    )}
  </Section>;
}

// ── 9. AI reviewer comments ──────────────────────────────────────────────
export function ReviewerCommentsCard({cr,onGenerate,loading}:{cr:any;onGenerate:()=>void;loading:boolean}){
  const items=cr.ai_reviewer_comments||[];
  return<Section icon={<MessageSquareWarning size={14} className="text-brand-600"/>} title="AI reviewer comments">
    {cr.ai_generated_at?(
      items.length?(
        <div className="space-y-2">
          {items.map((c:string,i:number)=>(
            <div key={i} className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500"/>
              <p className="text-xs leading-relaxed text-amber-800">{c}</p>
            </div>
          ))}
        </div>
      ):(
        <p className="flex items-center gap-1.5 text-xs text-green-700"><CheckCircle2 size={13}/>No concerns flagged — this change looks clean going into review.</p>
      )
    ):(
      <NotGenerated onGenerate={onGenerate} loading={loading} label="Get a senior-engineer-style pre-approval review, grounded in this change's data."/>
    )}
  </Section>;
}

// ── 10. Beautiful project card (list view) ──────────────────────────────
export function ProjectReadyCard({project,validation,openFindings,readinessPct,estWindow,onDraft,drafting}:{project:any;validation:any;openFindings:number;readinessPct:number|null;estWindow:string;onDraft:()=>void;drafting:boolean}){
  const risk=validation?(validation.critical_count>0?'critical':validation.high_count>0?'high':validation.medium_count>0?'medium':'low'):'unknown';
  return<div className="group relative rounded-2xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:border-brand-200 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${RISK_CLS[risk]}`}><GitBranch size={17}/></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy-900">{project.name}</p>
          <p className="text-2xs text-gray-400">{validation?`Validated ${timeAgo(validation.completed_at||validation.created_at)}`:'No completed validation'}</p>
        </div>
      </div>
      {validation&&<RiskGauge score={validation.risk_score??null} size={44}/>}
    </div>
    <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center">
      <div><p className="text-sm font-bold text-navy-900">{readinessPct===null?'—':`${readinessPct}%`}</p><p className="text-2xs text-gray-400">Readiness</p></div>
      <div><p className="text-sm font-bold text-navy-900">{openFindings}</p><p className="text-2xs text-gray-400">Open findings</p></div>
      <div><p className="text-sm font-bold text-navy-900">{estWindow}</p><p className="text-2xs text-gray-400">Est. window</p></div>
    </div>
    <button onClick={onDraft} disabled={drafting} className="btn-brand mt-3.5 flex w-full items-center justify-center gap-1.5 text-xs disabled:opacity-50">
      {drafting?<><Spinner size={11}/>Drafting…</>:<><Sparkles size={11}/>Generate change request</>}
    </button>
  </div>;
}
