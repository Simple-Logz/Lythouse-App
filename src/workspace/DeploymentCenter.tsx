import{useCallback,useEffect,useState}from'react';
import{supabase,type Finding,type Validation,anonKey,edgeFunctionUrl}from'../lib/supabase';
import{useAuth}from'../lib/auth';
import{Spinner}from'../lib/ui';
import{
  ShieldCheck,ShieldAlert,AlertTriangle,CheckCircle2,XCircle,Clock,
  Users,Zap,GitPullRequest,Ticket,MessageSquare,RefreshCw,Play,
  ChevronDown,ChevronRight,Sparkles,ArrowRight,Eye,EyeOff,
  Activity,Lock,Package,Code2,Settings,Bell,User,
  Loader as Loader2,Copy,Check,X,RotateCcw,Flag,
  TrendingUp,TrendingDown,Minus,BarChart3,FileCode,ExternalLink
}from'lucide-react';

// ─── Business language mapping ────────────────────────────────────────────────
type BusinessSeverity='blocker'|'attention'|'recommendation'|'informational';

function toBusiness(sev:string):BusinessSeverity{
  if(sev==='critical')return'blocker';
  if(sev==='high')return'attention';
  if(sev==='medium')return'recommendation';
  return'informational';
}

const BIZ_META:Record<BusinessSeverity,{label:string;color:string;bg:string;border:string;icon:typeof XCircle}> = {
  blocker:{label:'Deployment Blocker',color:'text-red-700',bg:'bg-red-50',border:'border-red-300',icon:XCircle},
  attention:{label:'Needs Attention',color:'text-amber-700',bg:'bg-amber-50',border:'border-amber-300',icon:AlertTriangle},
  recommendation:{label:'Recommendation',color:'text-blue-700',bg:'bg-blue-50',border:'border-blue-300',icon:Flag},
  informational:{label:'Informational',color:'text-gray-600',bg:'bg-gray-50',border:'border-gray-200',icon:Eye},
};

// ─── Readiness dimensions ─────────────────────────────────────────────────────
type ReadinessDimension={label:string;score:number;status:'pass'|'warn'|'fail';detail:string;};

function computeReadiness(findings:Finding[],validations:Validation[]):{overall:number;dimensions:ReadinessDimension[];status:'blocked'|'approved'|'pending'}{
  if(validations.length===0)return{overall:0,dimensions:[],status:'pending'};

  const latest=validations.find(v=>v.status==='completed');
  if(!latest)return{overall:0,dimensions:[],status:'pending'};

  // Use the ACTUAL risk score from the validation engine, not open findings count
  // Risk score is 0-100 where higher = more risk, so readiness = 100 - risk
  const actualRisk=latest.risk_score??50;
  const baseReadiness=Math.max(0,100-actualRisk);

  // Open findings penalise further
  const open=findings.filter(f=>f.status==='open');
  const critical=open.filter(f=>f.severity==='critical');
  const high=open.filter(f=>f.severity==='high');
  const secrets=open.filter(f=>f.category==='secret_scan'&&f.status==='open');
  const deps=open.filter(f=>f.category==='dependency_audit');
  const infra=open.filter(f=>f.category==='configuration');
  const code=open.filter(f=>f.category==='static_analysis');

  // Each dimension uses a mix of actual scan data + open findings
  const secScore=Math.max(0,baseReadiness-critical.filter(f=>f.category==='static_analysis').length*20);
  const secretScore=Math.max(0,100-secrets.length*60);
  const depScore=Math.max(0,baseReadiness-deps.filter(f=>f.severity==='critical').length*25-deps.filter(f=>f.severity==='high').length*10);
  const codeScore=Math.max(0,baseReadiness-code.filter(f=>f.severity==='critical').length*20);
  const infraScore=Math.max(0,100-infra.length*15);
  const complianceScore=critical.length===0&&secrets.length===0?Math.min(100,baseReadiness+10):Math.max(0,baseReadiness-30);

  const dimensions:ReadinessDimension[]=[
    {label:'Security',score:secScore,status:critical.length>0?'fail':high.length>0?'warn':'pass',detail:critical.length>0?`${critical.length} critical issue${critical.length!==1?'s':''} blocking deployment`:high.length>0?`${high.length} high-severity issues need review`:`Risk score: ${actualRisk}/100`},
    {label:'Secrets & Credentials',score:secretScore,status:secrets.length>0?'fail':'pass',detail:secrets.length>0?`${secrets.length} exposed secret${secrets.length!==1?'s':''} detected — immediate action required`:'No exposed credentials found'},
    {label:'Dependencies',score:depScore,status:deps.filter(f=>f.severity==='critical').length>0?'fail':deps.filter(f=>f.severity==='high').length>0?'warn':'pass',detail:deps.length>0?`${deps.length} vulnerable dependenc${deps.length!==1?'ies':'y'} detected`:'Dependency audit passed'},
    {label:'Code Quality',score:codeScore,status:code.filter(f=>f.severity==='critical').length>0?'fail':code.filter(f=>f.severity==='high').length>0?'warn':'pass',detail:code.length>0?`${code.length} code issue${code.length!==1?'s':''} flagged`:'Static analysis passed'},
    {label:'Infrastructure',score:infraScore,status:infra.length>2?'fail':infra.length>0?'warn':'pass',detail:infra.length>0?`${infra.length} configuration issue${infra.length!==1?'s':''} found`:'Configuration looks healthy'},
    {label:'Compliance',score:complianceScore,status:critical.length>0||secrets.length>0?'fail':'pass',detail:critical.length>0||secrets.length>0?'Compliance blocked by unresolved critical issues':'Compliance posture is acceptable'},
  ];

  // Overall = weighted average anchored to actual risk score
  const dimAvg=Math.round(dimensions.reduce((s,d)=>s+d.score,0)/dimensions.length);
  // Blend 60% dimension average with 40% base readiness from actual scan
  const overall=Math.round(dimAvg*0.6+baseReadiness*0.4);
  const status=critical.length>0||secrets.length>0?'blocked':overall>=75?'approved':'blocked';
  return{overall,dimensions,status};
}

function estimateFixTime(findings:Finding[]):string{
  const open=findings.filter(f=>f.status==='open');
  const mins=open.reduce((t,f)=>t+(f.severity==='critical'?60:f.severity==='high'?30:f.severity==='medium'?15:5),0);
  if(mins<60)return`~${mins}m`;
  if(mins<480)return`~${Math.round(mins/60)}h`;
  return`~${Math.round(mins/480)}d`;
}

// ─── Work Item (Finding as a tracked task) ────────────────────────────────────
type WorkItemState={
  owner:string;
  eta:string;
  ticketUrl:string|null;
  prUrl:string|null;
  aiExplanation:string|null;
  aiFix:string|null;
  loadingExplain:boolean;
  loadingFix:boolean;
  loadingTicket:boolean;
};

function WorkItem({f,projectId,project,onStatusChange,onOpenFile}:{f:Finding;projectId:string;project:any;onStatusChange:(id:string,status:any)=>void;onOpenFile:(path:string,line?:number)=>void}){
  const[open,setOpen]=useState(false);
  const[state,setState]=useState<WorkItemState>({owner:'',eta:'',ticketUrl:null,prUrl:null,aiExplanation:null,aiFix:null,loadingExplain:false,loadingFix:false,loadingTicket:false});
  const[copied,setCopied]=useState(false);
  const biz=toBusiness(f.severity);
  const meta=BIZ_META[biz];
  const Icon=meta.icon;

  const callAI=async(prompt:string):Promise<string>=>{
    const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
      body:JSON.stringify({systemPrompt:`You are an expert DevSecOps engineer and release manager. Be concise, specific, and actionable. Format responses clearly.`,messages:[{role:'user',content:prompt}]})
    });
    if(!res.ok)return'AI service unavailable.';
    const d=await res.json();return d.content||'No response.';
  };

  const explain=async()=>{
    setState(s=>({...s,loadingExplain:true}));
    const text=await callAI(`Explain this security finding in clear business language. Include: what happened, why it matters to the business, what code is affected, CVEs if relevant, OWASP reference if applicable, executive summary in 1 sentence.

Finding: ${f.title}
Description: ${f.description}
File: ${f.file_path||'unknown'}${f.line?`:${f.line}`:''}
Category: ${f.category}
Severity: ${f.severity}`);
    setState(s=>({...s,aiExplanation:text,loadingExplain:false}));
  };

  const generateFix=async()=>{
    setState(s=>({...s,loadingFix:true}));
    const text=await callAI(`Generate a complete, production-ready fix for this security finding. Include:
1. PROBLEM: What exactly is wrong
2. RECOMMENDATION: What to change
3. FILES TO MODIFY: List of files
4. CODE FIX: The exact code change (before/after)
5. RISK: Risk of applying this fix
6. TESTS: What tests should pass after fixing
7. ESTIMATED FIX TIME: How long this should take

Finding: ${f.title}
Description: ${f.description}
File: ${f.file_path||'unknown'}${f.line?`:${f.line}`:''}
Recommendation: ${f.recommendation||'See description'}`);
    setState(s=>({...s,aiFix:text,loadingFix:false}));
  };

  const createTicket=async()=>{
    setState(s=>({...s,loadingTicket:true}));
    // Create a GitHub issue via repo-operation if available
    try{
      const res=await fetch(`${edgeFunctionUrl}/repo-operation`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({operation:'create_issue',projectId,title:`[${biz.toUpperCase()}] ${f.title}`,body:`## Security Finding\n\n**Category:** ${f.category}\n**Severity:** ${f.severity}\n**File:** ${f.file_path||'N/A'}${f.line?`:${f.line}`:''}\n\n## Description\n${f.description}\n\n## Recommended Fix\n${f.recommendation||'See AI-generated fix.'}\n\n---\n*Created by LytHouse Release Management Platform*`})
      });
      if(res.ok){const d=await res.json();if(d.url)setState(s=>({...s,ticketUrl:d.url,loadingTicket:false}));else setState(s=>({...s,loadingTicket:false}));}
      else setState(s=>({...s,loadingTicket:false}));
    }catch{setState(s=>({...s,loadingTicket:false}));}
  };

  return(
    <div className={`rounded-xl border-2 overflow-hidden transition-all ${meta.border} ${f.status==='resolved'?'opacity-50':''}`}>
      {/* Header row */}
      <div className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer ${meta.bg} hover:brightness-[0.98]`} onClick={()=>setOpen(o=>!o)}>
        {open?<ChevronDown size={16} className="shrink-0 text-gray-500 mt-0.5"/>:<ChevronRight size={16} className="shrink-0 text-gray-500 mt-0.5"/>}
        <Icon size={16} className={`shrink-0 mt-0.5 ${meta.color}`}/>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color} ${meta.border}`}>{meta.label}</span>
            <span className="text-sm font-semibold text-navy-900">{f.title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {f.file_path&&<span className="flex items-center gap-1 font-mono"><FileCode size={10}/>{f.file_path.split('/').slice(-2).join('/')}{f.line?`:${f.line}`:''}</span>}
            <span className="flex items-center gap-1"><Clock size={10}/>{biz==='blocker'?'~1h':biz==='attention'?'~30m':biz==='recommendation'?'~15m':'~5m'} to fix</span>
            {state.owner&&<span className="flex items-center gap-1"><User size={10}/>{state.owner}</span>}
            {state.ticketUrl&&<a href={state.ticketUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="flex items-center gap-1 text-brand-600 hover:underline"><ExternalLink size={10}/>Ticket</ a>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" onClick={e=>e.stopPropagation()}>
          {f.status==='open'&&<button onClick={()=>onStatusChange(f.id,'resolved')} className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Check size={11}/>Resolve</button>}
          {f.status==='resolved'&&<span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 size={13}/>Resolved</span>}
          {f.status==='open'&&<button onClick={()=>onStatusChange(f.id,'ignored')} className="px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100">Ignore</button>}
        </div>
      </div>

      {/* Expanded detail */}
      {open&&(
        <div className="bg-white border-t border-gray-100 px-4 py-4 space-y-4">
          {/* Business impact */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className={`rounded-lg border ${meta.border} ${meta.bg} px-3 py-2.5`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Why it matters</p>
              <p className="text-sm text-gray-700">{f.description}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Suggested fix</p>
              <p className="text-sm text-gray-700">{f.recommendation||'Generate an AI fix below.'}</p>
            </div>
          </div>

          {/* File link */}
          {f.file_path&&(
            <div className="flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2">
              <FileCode size={13} className="text-gray-400 shrink-0"/>
              <code className="text-xs text-green-400 flex-1">{f.file_path}{f.line?`:${f.line}`:''}</code>
              <button onClick={()=>onOpenFile(f.file_path!,f.line??undefined)} className="text-xs text-brand-400 hover:text-brand-300 font-medium">Open in editor →</button>
            </div>
          )}

          {/* AI Explanation */}
          {state.aiExplanation&&(
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-purple-600"/>
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">AI Explanation</p>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{state.aiExplanation}</div>
            </div>
          )}

          {/* AI Fix */}
          {state.aiFix&&(
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-brand-600"/>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">AI-Generated Fix</p>
                </div>
                <button onClick={async()=>{await navigator.clipboard.writeText(state.aiFix!);setCopied(true);setTimeout(()=>setCopied(false),2000);}} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  {copied?<><Check size={11}/>Copied</>:<><Copy size={11}/>Copy fix</>}
                </button>
              </div>
              <pre className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed bg-white rounded-lg p-3 border border-brand-200 overflow-x-auto">{state.aiFix}</pre>
              <div className="flex gap-2 mt-3">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700"><Zap size={12}/>Apply Fix</button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"><GitPullRequest size={12}/>Create Pull Request</button>
              </div>
            </div>
          )}

          {/* Assign owner */}
          <div className="flex items-center gap-2">
            <User size={13} className="text-gray-400 shrink-0"/>
            <input value={state.owner} onChange={e=>setState(s=>({...s,owner:e.target.value}))} placeholder="Assign owner (email or name)" className="input text-xs py-1.5 flex-1"/>
            <input value={state.eta} onChange={e=>setState(s=>({...s,eta:e.target.value}))} placeholder="ETA (e.g. 2026-07-20)" className="input text-xs py-1.5 w-36"/>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
            <button onClick={explain} disabled={state.loadingExplain} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-50">
              {state.loadingExplain?<Loader2 size={12} className="animate-spin"/>:<Sparkles size={12}/>}Explain
            </button>
            <button onClick={generateFix} disabled={state.loadingFix} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 transition-colors disabled:opacity-50">
              {state.loadingFix?<Loader2 size={12} className="animate-spin"/>:<Zap size={12}/>}Generate AI Fix
            </button>
            <button onClick={createTicket} disabled={state.loadingTicket} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors disabled:opacity-50">
              {state.loadingTicket?<Loader2 size={12} className="animate-spin"/>:<Ticket size={12}/>}Create Ticket
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors">
              <GitPullRequest size={12}/>Create PR
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors">
              <MessageSquare size={12}/>Notify Slack
            </button>
            {f.file_path&&<button onClick={()=>onOpenFile(f.file_path!,f.line??undefined)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors">
              <FileCode size={12}/>Open File
            </button>}
            {f.status!=='open'&&<button onClick={()=>onStatusChange(f.id,'open')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 ml-auto">
              <RotateCcw size={12}/>Reopen
            </button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Activity Timeline ────────────────────────────────────────────────────────
function ActivityTimeline({validations,findings}:{validations:Validation[];findings:Finding[]}){
  const events=[
    ...validations.map(v=>({time:v.created_at,type:v.status==='completed'?'validated':'scanning',label:v.status==='completed'?`Validation completed — ${v.total_findings} finding${v.total_findings!==1?'s':''} (Risk: ${v.risk_score??'—'}/100)`:'Validation started',color:'text-brand-600',bg:'bg-brand-100'})),
    ...findings.filter(f=>f.status==='resolved'&&f.resolved_at).map(f=>({time:f.resolved_at!,type:'resolved',label:`Resolved: ${f.title}`,color:'text-green-600',bg:'bg-green-100'})),
  ].sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime()).slice(0,8);

  if(events.length===0)return null;
  return(
    <div className="card">
      <h3 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2"><Activity size={15} className="text-brand-600"/>Activity Timeline</h3>
      <div className="space-y-2">
        {events.map((e,i)=>(
          <div key={i} className="flex items-start gap-3 text-xs">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${e.bg}`}/>
            <span className="text-gray-400 shrink-0 font-mono">{new Date(e.time).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
            <span className="text-gray-700">{e.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main DeploymentCenter ────────────────────────────────────────────────────
export function DeploymentCenter({projectId,project,onRunValidation,onOpenFile,running}:{projectId:string;project:any;onRunValidation:()=>void;onOpenFile:(path:string,line?:number)=>void;running:boolean;}){
  const[findings,setFindings]=useState<Finding[]>([]);
  const[validations,setValidations]=useState<Validation[]>([]);
  const[loading,setLoading]=useState(true);
  const[filter,setFilter]=useState<BusinessSeverity|'all'|'resolved'>('all');
  const[view,setView]=useState<'deployment'|'workitems'|'timeline'>('deployment');

  const load=useCallback(async()=>{
    setLoading(true);
    const[fr,vr]=await Promise.all([
      supabase.from('findings').select('*').eq('project_id',projectId).order('created_at',{ascending:false}),
      supabase.from('validations').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(20),
    ]);
    setFindings((fr.data??[]) as Finding[]);
    setValidations((vr.data??[]) as Validation[]);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{load();},[load]);

  const updateStatus=async(id:string,status:any)=>{
    await supabase.from('findings').update({status,resolved_at:status==='resolved'?new Date().toISOString():null}).eq('id',id);
    setFindings(prev=>prev.map(f=>f.id===id?{...f,status,resolved_at:status==='resolved'?new Date().toISOString():null}:f));
  };

  if(loading)return<div className="flex justify-center py-20"><Spinner size={24}/></div>;

  const{overall,dimensions,status}=computeReadiness(findings,validations);
  const open=findings.filter(f=>f.status==='open');
  const blockers=open.filter(f=>f.severity==='critical');
  const attention=open.filter(f=>f.severity==='high');
  const resolved=findings.filter(f=>f.status==='resolved');
  const fixTime=estimateFixTime(findings);
  const latest=validations.find(v=>v.status==='completed');

  const filteredFindings=findings.filter(f=>{
    if(filter==='resolved')return f.status==='resolved';
    if(filter==='all')return f.status==='open';
    return f.status==='open'&&toBusiness(f.severity)===filter;
  });

  const statusConfig={
    blocked:{label:'Deployment Blocked',color:'text-red-700',bg:'bg-red-50',border:'border-red-300',icon:'⛔'},
    approved:{label:'Approved to Deploy',color:'text-green-700',bg:'bg-green-50',border:'border-green-300',icon:'✅'},
    pending:{label:'Run Validation First',color:'text-gray-600',bg:'bg-gray-50',border:'border-gray-300',icon:'○'},
  };
  const sc=statusConfig[status];

  return(
    <div className="space-y-5">
      {/* View switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {[{id:'deployment',label:'Deployment Center'},{id:'workitems',label:`Work Items (${open.length})`},{id:'timeline',label:'Timeline'}].map(v=>(
            <button key={v.id} onClick={()=>setView(v.id as any)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view===v.id?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{v.label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary text-xs"><RefreshCw size={13}/>Refresh</button>
          <button onClick={onRunValidation} disabled={running} className="btn-primary text-xs">
            {running?<><Loader2 size={13} className="animate-spin"/>Validating…</>:<><Play size={13}/>{validations.length>0?'Revalidate':'Run Validation'}</>}
          </button>
        </div>
      </div>

      {/* ── DEPLOYMENT CENTER VIEW ── */}
      {view==='deployment'&&(
        <div className="space-y-5">
          {/* Main status card */}
          <div className={`rounded-2xl border-2 ${sc.border} ${sc.bg} px-6 py-5`}>
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="text-4xl">{sc.icon}</div>
                <div>
                  <h2 className={`text-2xl font-semibold ${sc.color}`}>{sc.label}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {status==='blocked'?`${blockers.length} deployment blocker${blockers.length!==1?'s':''} must be resolved before this release can proceed.`:
                     status==='approved'?'All checks passed. This release is cleared for deployment.':
                     'No validation data yet. Run a validation to get your deployment status.'}
                  </p>
                  {status!=='pending'&&(
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Clock size={11}/><strong>Est. fix time:</strong> {fixTime}</span>
                      {latest&&<span className="flex items-center gap-1"><Activity size={11}/><strong>Last scan:</strong> {new Date(latest.created_at).toLocaleString()}</span>}
                      <span className="flex items-center gap-1"><BarChart3 size={11}/><strong>Risk score:</strong> {latest?.risk_score??'—'}/100</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center shrink-0">
                <div className={`text-5xl font-semibold ${overall>=80?'text-green-600':overall>=50?'text-amber-600':'text-red-600'}`}>{overall}%</div>
                <div className="text-xs text-gray-500 font-medium mt-1">Release Readiness</div>
              </div>
            </div>

            {/* Recommended actions */}
            {status!=='pending'&&(
              <div className="mt-5 pt-4 border-t border-black/10">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Recommended Actions</p>
                <div className="flex flex-wrap gap-2">
                  {blockers.length>0&&<button onClick={()=>{setView('workitems');setFilter('blocker');}} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">⛔ Fix {blockers.length} Blocker{blockers.length!==1?'s':''} First</button>}
                  {attention.length>0&&<button onClick={()=>{setView('workitems');setFilter('attention');}} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600">⚠ Review {attention.length} Issue{attention.length!==1?'s':''}</button>}
                  <button onClick={onRunValidation} disabled={running} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700 disabled:opacity-50"><RefreshCw size={12}/>Revalidate</button>
                  {status==='approved'&&<button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700"><CheckCircle2 size={12}/>Approve Deployment</button>}
                </div>
              </div>
            )}
          </div>

          {/* Release Readiness breakdown */}
          {validations.length>0&&(
            <div className="card">
              <h3 className="text-sm font-semibold text-navy-900 mb-4">Release Readiness Breakdown</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dimensions.map(d=>(
                  <div key={d.label} className={`rounded-xl border px-3 py-3 ${d.status==='fail'?'border-red-200 bg-red-50':d.status==='warn'?'border-amber-200 bg-amber-50':'border-green-200 bg-green-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700">{d.label}</span>
                      <span className={`text-lg font-semibold ${d.status==='fail'?'text-red-600':d.status==='warn'?'text-amber-600':'text-green-600'}`}>{d.score}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-black/10 mb-2">
                      <div className={`h-1.5 rounded-full transition-all ${d.status==='fail'?'bg-red-500':d.status==='warn'?'bg-amber-500':'bg-green-500'}`} style={{width:`${d.score}%`}}/>
                    </div>
                    <p className="text-xs text-gray-600">{d.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick stats */}
          {findings.length>0&&(
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {label:'Deployment Blockers',value:blockers.length,color:'text-red-600',bg:'bg-red-50',border:'border-red-200',onClick:()=>{setView('workitems');setFilter('blocker');}},
                {label:'Needs Attention',value:attention.length,color:'text-amber-600',bg:'bg-amber-50',border:'border-amber-200',onClick:()=>{setView('workitems');setFilter('attention');}},
                {label:'Recommendations',value:findings.filter(f=>f.status==='open'&&f.severity==='medium').length,color:'text-blue-600',bg:'bg-blue-50',border:'border-blue-200',onClick:()=>{setView('workitems');setFilter('recommendation');}},
                {label:'Resolved',value:resolved.length,color:'text-green-600',bg:'bg-green-50',border:'border-green-200',onClick:()=>{setView('workitems');setFilter('resolved');}},
              ].map(s=>(
                <button key={s.label} onClick={s.onClick} className={`card border ${s.border} ${s.bg} hover:shadow-md transition-all text-left`}>
                  <div className={`text-3xl font-semibold tabular-nums ${s.color}`}>{s.value}</div>
                  <div className="text-xs font-medium text-gray-600 mt-1">{s.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Click to view →</div>
                </button>
              ))}
            </div>
          )}

          {validations.length===0&&(
            <div className="card text-center py-12">
              <ShieldCheck size={44} className="mx-auto text-gray-200 mb-4"/>
              <h3 className="text-base font-semibold text-navy-900 mb-2">Run your first validation</h3>
              <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">LytHouse will scan your repository for security issues, exposed secrets, and vulnerable dependencies, then give you a deployment decision.</p>
              <button onClick={onRunValidation} disabled={running} className="btn-primary"><Play size={15}/>Start validation</button>
            </div>
          )}
        </div>
      )}

      {/* ── WORK ITEMS VIEW ── */}
      {view==='workitems'&&(
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
              {[
                {id:'all',label:'All Open'},
                {id:'blocker',label:'Blockers'},
                {id:'attention',label:'Needs Attention'},
                {id:'recommendation',label:'Recommendations'},
                {id:'informational',label:'Informational'},
                {id:'resolved',label:'Resolved'},
              ].map(f=>(
                <button key={f.id} onClick={()=>setFilter(f.id as any)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter===f.id?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{f.label}</button>
              ))}
            </div>
            <span className="text-xs text-gray-400 ml-auto">{filteredFindings.length} item{filteredFindings.length!==1?'s':''}</span>
          </div>

          {filteredFindings.length===0?(
            <div className="card text-center py-10">
              <CheckCircle2 size={32} className="mx-auto text-green-400 mb-3"/>
              <p className="text-sm font-medium text-gray-600">{filter==='resolved'?'No resolved items yet':'No items in this category'}</p>
              {filter==='all'&&validations.length===0&&<button onClick={onRunValidation} disabled={running} className="btn-primary mt-4"><Play size={14}/>Run Validation</button>}
            </div>
          ):(
            <div className="space-y-3">
              {filteredFindings.map(f=>(
                <WorkItem key={f.id} f={f} projectId={projectId} project={project} onStatusChange={updateStatus} onOpenFile={onOpenFile}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TIMELINE VIEW ── */}
      {view==='timeline'&&(
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-navy-900 mb-4">Release Workflow</h3>
            <div className="flex items-center gap-0 overflow-x-auto pb-2">
              {['Import Repo','Validate','Prioritize','Assign','AI Fix','PR','Revalidate','Deploy Approval','Deploy'].map((step,i,arr)=>{
                const done=i===0||(i===1&&validations.length>0)||(i===2&&findings.length>0);
                return<div key={step} className="flex items-center shrink-0">
                  <div className={`flex flex-col items-center gap-1 px-3`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${done?'bg-brand-600 text-white':'bg-gray-100 text-gray-400'}`}>{done?'✓':i+1}</div>
                    <span className="text-[10px] text-gray-500 text-center whitespace-nowrap">{step}</span>
                  </div>
                  {i<arr.length-1&&<div className={`h-0.5 w-4 ${done?'bg-brand-400':'bg-gray-200'} shrink-0`}/>}
                </div>;
              })}
            </div>
          </div>
          <ActivityTimeline validations={validations} findings={findings}/>
        </div>
      )}
    </div>
  );
}
