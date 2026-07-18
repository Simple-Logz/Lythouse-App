// @ts-nocheck
import{useCallback,useEffect,useState}from'react';
import{supabase,anonKey,edgeFunctionUrl}from'../lib/supabase';
import{useAuth}from'../lib/auth';
import{Spinner}from'../lib/ui';
import{Link}from'../lib/router';
import{
  CheckCircle2,XCircle,AlertTriangle,Clock,Shield,Zap,
  RefreshCw,Play,ChevronRight,Sparkles,GitBranch,
  Activity,Server,Lock,Package,Layers,ArrowRight,
  Check,Users,GitPullRequest,BarChart3,Loader as Loader2,
  GitCommit,Box,TrendingUp,Bell,User,ExternalLink
}from'lucide-react';

function timeAgo(iso:string):string{
  const ms=Date.now()-new Date(iso).getTime();
  const m=Math.floor(ms/60000),h=Math.floor(m/60),d=Math.floor(h/24);
  if(m<1)return'just now';if(m<60)return`${m}m ago`;
  if(h<24)return`${h}h ago`;return`${d}d ago`;
}

function formatTime(iso:string):string{
  return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}

export function DashboardPage(){
  const{user,profile}=useAuth();
  const[loading,setLoading]=useState(true);
  const[projects,setProjects]=useState<any[]>([]);
  const[validations,setValidations]=useState<any[]>([]);
  const[findings,setFindings]=useState<any[]>([]);
  const[approvals,setApprovals]=useState<any[]>([]);
  const[connections,setConnections]=useState<any[]>([]);
  const[aiRec,setAiRec]=useState<{decision:string;confidence:number;reasons:string[];nextStep:string;etaMinutes:number}|null>(null);
  const[loadingAI,setLoadingAI]=useState(false);
  const wsId=()=>localStorage.getItem('sandbox.activeWs');

  const load=useCallback(async()=>{
    setLoading(true);
    const wid=wsId();
    if(!wid){setLoading(false);return;}
    const[pr,vl,fn,ap,ec]=await Promise.all([
      supabase.from('projects').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}),
      supabase.from('validations').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(50),
      supabase.from('findings').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}),
      supabase.from('release_approvals').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(5),
      supabase.from('environment_connections').select('*').eq('workspace_id',wid),
    ]);
    setProjects(pr.data??[]);
    setValidations(vl.data??[]);
    setFindings(fn.data??[]);
    setApprovals(ap.data??[]);
    setConnections(ec.data??[]);
    setLoading(false);
  },[]);

  useEffect(()=>{load();},[load]);

  const getAIRec=useCallback(async(open:any[],latest:any,pendingApprovals:any[],connectedSystems:any[])=>{
    setLoadingAI(true);
    const critical=open.filter(f=>f.severity==='critical');
    const high=open.filter(f=>f.severity==='high');
    try{
      const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({
          systemPrompt:'You are an AI Release Advisor. Respond ONLY with valid JSON. No markdown, no explanation outside JSON.',
          messages:[{role:'user',content:`Analyze and return JSON only:
{"decision":"DEPLOY NOW|DELAY|DO NOT DEPLOY","confidence":0-100,"reasons":["reason1","reason2","reason3"],"nextStep":"single most important action","etaMinutes":number}

Context:
- Risk score: ${latest?.risk_score??'none'}/100
- Critical blockers: ${critical.length}
- High severity: ${high.length}
- Pending approvals: ${pendingApprovals.length}
- Validations run: ${validations.length}
- Connected systems: ${connectedSystems.length}`}]
        })
      });
      if(res.ok){
        const d=await res.json();
        try{
          const text=d.content?.replace(/```json|```/g,'').trim();
          const parsed=JSON.parse(text);
          setAiRec(parsed);
        }catch{
          // Fallback structured recommendation
          const isBlocked=critical.length>0;
          setAiRec({
            decision:isBlocked?'DO NOT DEPLOY':high.length>0?'DELAY':validations.length===0?'DELAY':'DEPLOY NOW',
            confidence:isBlocked?15:high.length>0?55:validations.length===0?30:88,
            reasons:isBlocked?[`${critical.length} critical blocker${critical.length!==1?'s':''} unresolved`,pendingApprovals.length>0?`${pendingApprovals.length} approval${pendingApprovals.length!==1?'s':''} pending`:'Recent validation failed','Deployment gate blocked'].filter(Boolean)
              :high.length>0?[`${high.length} high-severity issue${high.length!==1?'s':''} needs review`,pendingApprovals.length>0?`${pendingApprovals.length} approval pending`:'All blockers cleared'].filter(Boolean)
              :validations.length===0?['No validation has been run','Cannot assess risk without a scan','Connect repository and run scan first']
              :['All blockers resolved','Validation passed','Ready to proceed'],
            nextStep:isBlocked?'Fix critical blockers in Remediation':high.length>0?'Review high-severity findings':validations.length===0?'Run your first validation':'Proceed to deployment',
            etaMinutes:isBlocked?open.reduce((t,f)=>t+(f.severity==='critical'?60:f.severity==='high'?30:10),0)/60|0:high.length>0?30:5,
          });
        }
      }
    }catch{}
    setLoadingAI(false);
  },[validations]);

  useEffect(()=>{
    if(!loading&&projects.length>0){
      const open=findings.filter(f=>f.status==='open');
      const latest=validations.find(v=>v.status==='completed');
      const pendingApprovals=approvals.filter(a=>a.status==='pending');
      const connectedSystems=connections.filter(c=>c.status==='connected');
      getAIRec(open,latest,pendingApprovals,connectedSystems);
    }
  },[loading]);

  if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

  // ─── Computed ─────────────────────────────────────────────────────────────
  const latest=validations.find(v=>v.status==='completed');
  const open=findings.filter(f=>f.status==='open');
  const critical=open.filter(f=>f.severity==='critical');
  const high=open.filter(f=>f.severity==='high');
  const resolved=findings.filter(f=>f.status==='resolved');
  const riskScore=latest?.risk_score??null;
  const readiness=riskScore!==null?Math.max(0,100-riskScore):null;
  const isBlocked=critical.length>0;
  const pendingApprovals=approvals.filter(a=>a.status==='pending');
  const latestProject=projects[0];
  const connectedSystems=connections.filter(c=>c.status==='connected');
  const successRate=validations.length>0?Math.round((validations.filter(v=>v.status==='completed'&&v.critical_count===0).length/validations.length)*100):0;
  const noData=projects.length===0||validations.length===0;

  // My tasks
  const myTasks=[
    ...pendingApprovals.map(a=>({label:`Approve release: ${a.release_name}`,type:'approval',link:`/projects/${a.project_id}`,urgent:true})),
    ...critical.slice(0,2).map(f=>({label:`Fix: ${f.title.slice(0,40)}`,type:'fix',link:`/projects/${f.project_id}`,urgent:true})),
    ...validations.length===0?[{label:'Run first validation scan',type:'validation',link:latestProject?`/projects/${latestProject.id}`:'/projects',urgent:false}]:[],
  ].slice(0,4);

  // Timeline
  const timeline=[
    ...validations.slice(0,5).map(v=>({
      time:v.created_at,label:v.status==='completed'?`Validation completed — ${v.total_findings} findings, risk ${v.risk_score}/100`:`Validation ${v.status}`,
      status:v.status==='completed'&&v.critical_count===0?'ok':v.critical_count>0?'blocked':'running',
    })),
    ...findings.filter(f=>f.status==='resolved'&&f.resolved_at).slice(0,3).map(f=>({
      time:f.resolved_at,label:`Fixed: ${f.title}`,status:'ok',
    })),
    ...approvals.flatMap(a=>(a.approvals||[]).map((ap:any)=>({
      time:ap.approved_at,label:`${ap.approver_name} approved as ${ap.role}`,status:'ok',
    }))),
  ].sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime()).slice(0,6);

  // What changed
  const lastValidation=validations[1];
  const recentFindings=findings.filter(f=>{
    if(!latest)return false;
    return new Date(f.created_at)>new Date(latest.created_at);
  });

  // Decision colors
  const decisionCfg:{[k:string]:{bg:string;border:string;color:string;dot:string}}={
    'DEPLOY NOW':{bg:'bg-green-50',border:'border-green-300',color:'text-green-700',dot:'bg-green-500'},
    'DELAY':{bg:'bg-amber-50',border:'border-amber-300',color:'text-amber-700',dot:'bg-amber-500'},
    'DO NOT DEPLOY':{bg:'bg-red-50',border:'border-red-300',color:'text-red-700',dot:'bg-red-500'},
  };
  const dc=decisionCfg[aiRec?.decision||'']||{bg:'bg-gray-50',border:'border-gray-200',color:'text-gray-700',dot:'bg-gray-400'};

  return(
    <div className="space-y-4 max-w-7xl mx-auto">

      {/* ══ ROW 1 — AI Decision + Single CTA ══════════════════════════════ */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* ①  AI Decision Block */}
        <div className={`lg:col-span-2 rounded-2xl border-2 ${dc.border} ${dc.bg} px-6 py-5`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {/* Decision */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={13} className="text-purple-500 shrink-0"/>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">AI Recommendation</span>
                  {loadingAI&&<Loader2 size={11} className="animate-spin text-gray-400"/>}
                </div>
                {loadingAI&&!aiRec?(
                  <div className="space-y-2">
                    <div className="h-8 bg-gray-200 animate-pulse rounded-lg w-48"/>
                    <div className="h-4 bg-gray-100 animate-pulse rounded w-32"/>
                  </div>
                ):(
                  <h1 className={`text-3xl font-semibold tracking-tight ${dc.color}`}>
                    {aiRec?.decision||(!noData?isBlocked?'DO NOT DEPLOY':'DEPLOY NOW':'GET STARTED')}
                  </h1>
                )}
                {aiRec&&(
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold text-gray-600">Confidence</span>
                    <span className={`text-xl font-semibold ${aiRec.confidence>=80?'text-green-600':aiRec.confidence>=60?'text-amber-600':'text-red-600'}`}>{aiRec.confidence}%</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden max-w-24">
                      <div className={`h-1.5 rounded-full transition-all ${aiRec.confidence>=80?'bg-green-500':aiRec.confidence>=60?'bg-amber-500':'bg-red-500'}`} style={{width:`${aiRec.confidence}%`}}/>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="shrink-0 flex flex-col gap-2 items-end">
              {latestProject&&(
                aiRec?.decision==='DEPLOY NOW'?(
                  <Link to={`/projects/${latestProject.id}`} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors shadow-sm"><Play size={15}/>Deploy Now</Link>
                ):(
                  <Link to={`/projects/${latestProject.id}`} className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-colors shadow-sm"><ChevronRight size={15}/>Open Release</Link>
                )
              )}
              {!latestProject&&(
                <Link to="/projects" className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700"><Play size={15}/>Add Project</Link>
              )}
            </div>
          </div>

          {/* Reasons */}
          {aiRec?.reasons?.length>0&&(
            <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {aiRec.reasons.slice(0,3).map((r:string,i:number)=>(
                <div key={i} className="flex items-start gap-2 text-xs text-gray-700 bg-white/60 rounded-lg px-3 py-2 border border-black/5">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${dc.dot}`}/>
                  {r}
                </div>
              ))}
            </div>
          )}

          {/* Next step + ETA */}
          {aiRec&&(
            <div className="mt-4 pt-4 border-t border-black/10 flex items-center justify-between gap-4">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <ArrowRight size={14} className={`${dc.color} shrink-0 mt-0.5`}/>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Next Action — </span>
                  <span className="text-sm font-semibold text-navy-900">{aiRec.nextStep}</span>
                </div>
              </div>
              {aiRec.etaMinutes>0&&(
                <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                  <Clock size={12}/>~{aiRec.etaMinutes<60?`${aiRec.etaMinutes}m`:`${Math.round(aiRec.etaMinutes/60)}h`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ② My Tasks */}
        <div className="card flex flex-col">
          <h2 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
            <User size={14} className="text-brand-600"/>Your Actions
            {myTasks.filter(t=>t.urgent).length>0&&<span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">{myTasks.filter(t=>t.urgent).length}</span>}
          </h2>
          {myTasks.length===0?(
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-4">
                <CheckCircle2 size={24} className="mx-auto text-green-400 mb-2"/>
                <p className="text-xs text-gray-500">No actions needed right now</p>
              </div>
            </div>
          ):(
            <div className="space-y-2 flex-1">
              {myTasks.map((t,i)=>(
                <Link key={i} to={t.link} className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-all hover:shadow-sm ${t.urgent?'border-red-200 bg-red-50 hover:border-red-300':'border-gray-200 bg-white hover:border-brand-200'}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${t.urgent?'bg-red-500':'bg-gray-300'}`}/>
                  <span className={`text-xs font-medium flex-1 ${t.urgent?'text-red-700':'text-gray-700'}`}>{t.label}</span>
                  <ChevronRight size={13} className="text-gray-300 shrink-0"/>
                </Link>
              ))}
            </div>
          )}
          {latestProject&&myTasks.length>0&&(
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-500">Est. time to clear</span>
              <span className="font-bold text-navy-900">~{myTasks.length*3}m</span>
            </div>
          )}
        </div>
      </div>

      {/* ══ ROW 2 — Blockers + Current Release + What Changed ═══════════════ */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* ③ Deployment Blockers — highest urgency */}
        <div className={`card border-2 ${isBlocked?'border-red-300':high.length>0?'border-amber-200':'border-green-200'}`}>
          <h2 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isBlocked?'text-red-700':high.length>0?'text-amber-700':'text-green-700'}`}>
            {isBlocked?<XCircle size={14}/>:high.length>0?<AlertTriangle size={14}/>:<CheckCircle2 size={14}/>}
            {isBlocked?`${critical.length} Blocker${critical.length!==1?'s':''}`:high.length>0?`${high.length} Need${high.length!==1?'':'s'} Attention`:'All Clear'}
          </h2>
          {isBlocked||high.length>0?(
            <div className="space-y-2">
              {[...critical,...high].slice(0,3).map((f:any)=>(
                <div key={f.id} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${f.severity==='critical'?'border-red-200 bg-red-50':'border-amber-200 bg-amber-50'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${f.severity==='critical'?'bg-red-500':'bg-amber-500'}`}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-navy-900 truncate">{f.title}</p>
                    {f.file_path&&<p className="text-[10px] font-mono text-gray-400 truncate">{f.file_path.split('/').pop()}</p>}
                  </div>
                  {latestProject&&(
                    <Link to={`/projects/${latestProject.id}`} className="shrink-0 px-2 py-1 bg-brand-600 text-white rounded-lg text-[10px] font-bold hover:bg-brand-700">Fix</Link>
                  )}
                </div>
              ))}
              {critical.length+high.length>3&&<p className="text-[10px] text-gray-400 text-center">+{critical.length+high.length-3} more</p>}
            </div>
          ):(
            <div className="text-center py-6">
              <CheckCircle2 size={24} className="mx-auto text-green-400 mb-2"/>
              <p className="text-xs text-green-600 font-medium">No blockers — clear to deploy</p>
              {validations.length===0&&<p className="text-[10px] text-gray-400 mt-1">Run a validation to confirm</p>}
            </div>
          )}
        </div>

        {/* ④ Current Release — operational feel */}
        <div className="card">
          <h2 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
            <GitBranch size={14} className="text-brand-600"/>Current Release
          </h2>
          {latestProject?(
            <div className="space-y-2.5">
              {[
                {label:'Release',value:latestProject.name,bold:true},
                {label:'Environment',value:'Production',color:'text-red-600 font-semibold'},
                {label:'Branch',value:latestProject.git_branch||'main',color:'text-brand-600'},
                {label:'Approvals',value:`${approvals.filter(a=>a.status==='approved').length}/${Math.max(approvals.length,3)}`,color:approvals.some(a=>a.status==='approved')?'text-green-600':'text-amber-600'},
                {label:'Blockers',value:critical.length,color:critical.length>0?'text-red-600 font-bold':'text-green-600'},
                {label:'ETA',value:aiRec?.etaMinutes?`~${aiRec.etaMinutes}m`:'—',color:'text-gray-700'},
                {label:'Owner',value:'Platform Team',color:'text-gray-600'},
              ].map(row=>(
                <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-400 shrink-0">{row.label}</span>
                  <span className={`font-medium text-right ${row.color||'text-navy-900'} ${row.bold?'font-bold text-sm':''} truncate max-w-36`}>{String(row.value)}</span>
                </div>
              ))}
              <Link to={`/projects/${latestProject.id}`} className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors">
                Open Release Workspace <ChevronRight size={12}/>
              </Link>
            </div>
          ):(
            <div className="text-center py-6">
              <p className="text-xs text-gray-400 mb-3">No projects yet</p>
              <Link to="/projects" className="btn-primary text-xs">Add Project</Link>
            </div>
          )}
        </div>

        {/* ⑤ What Changed */}
        <div className="card">
          <h2 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
            <GitCommit size={14} className="text-brand-600"/>What Changed
          </h2>
          {validations.length===0?(
            <div className="text-center py-6">
              <p className="text-xs text-gray-400">Run a validation to see what changed</p>
            </div>
          ):(
            <div className="space-y-2">
              {[
                {icon:Shield,label:'Validation scans',value:validations.length,color:'text-brand-600'},
                {icon:AlertTriangle,label:'New findings',value:findings.length,color:findings.length>0?'text-amber-600':'text-green-600'},
                {icon:CheckCircle2,label:'Resolved',value:resolved.length,color:'text-green-600'},
                {icon:Lock,label:'Secrets issues',value:open.filter(f=>f.category==='secret_scan').length,color:open.filter(f=>f.category==='secret_scan').length>0?'text-red-600':'text-green-600'},
                {icon:Package,label:'Dependency issues',value:open.filter(f=>f.category==='dependency_audit').length,color:open.filter(f=>f.category==='dependency_audit').length>0?'text-amber-600':'text-green-600'},
                {icon:Layers,label:'Connected systems',value:connectedSystems.length,color:connectedSystems.length>0?'text-brand-600':'text-gray-400'},
              ].map(row=>(
                <div key={row.label} className="flex items-center gap-2.5 py-1">
                  <row.icon size={13} className={row.color}/>
                  <span className="text-xs text-gray-600 flex-1">{row.label}</span>
                  <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[10px] text-gray-400">Overall risk</span>
                <span className={`text-sm font-semibold ${riskScore!==null&&riskScore<40?'text-green-600':riskScore!==null&&riskScore<70?'text-amber-600':'text-red-600'}`}>
                  {riskScore!==null?`${riskScore}/100`:'—'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ ROW 3 — Timeline + Production Health ════════════════════════════ */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* ⑥ Deployment Timeline — tells a story */}
        <div className="lg:col-span-3 card">
          <h2 className="text-sm font-semibold text-navy-900 mb-4 flex items-center gap-2"><Activity size={14} className="text-brand-600"/>Deployment Timeline</h2>
          {timeline.length===0?(
            <div className="text-center py-8">
              <Activity size={24} className="mx-auto text-gray-200 mb-2"/>
              <p className="text-xs text-gray-400 mb-3">No activity yet</p>
              {latestProject&&<Link to={`/projects/${latestProject.id}`} className="btn-primary text-xs">Run Validation</Link>}
            </div>
          ):(
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-4 bottom-4 w-px bg-gray-100"/>
              <div className="space-y-0">
                {timeline.map((e,i)=>(
                  <div key={i} className="flex items-start gap-3 py-3 relative">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-white z-10 ${e.status==='ok'?'border-green-200':e.status==='blocked'?'border-red-200':'border-brand-200'}`}>
                      {e.status==='ok'?<Check size={12} className="text-green-600"/>:e.status==='blocked'?<XCircle size={12} className="text-red-500"/>:<RefreshCw size={12} className="text-brand-600 animate-spin"/>}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm text-navy-900 leading-tight">{e.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatTime(e.time)} · {timeAgo(e.time)}</p>
                    </div>
                  </div>
                ))}
                {/* Waiting indicator */}
                {pendingApprovals.length>0&&(
                  <div className="flex items-start gap-3 py-3 relative">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-amber-300 bg-amber-50 z-10">
                      <Clock size={12} className="text-amber-600"/>
                    </div>
                    <div className="pt-1">
                      <p className="text-sm text-amber-700 font-medium">Waiting for approval</p>
                      <p className="text-[10px] text-amber-500">{pendingApprovals[0]?.release_name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ⑦ Production Health — clickable, actionable */}
        <div className="lg:col-span-2 card">
          <h2 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
            <Server size={14} className="text-brand-600"/>Production Health
          </h2>
          <div className="space-y-1.5">
            {[
              {label:'Kubernetes',status:connectedSystems.find(c=>c.source==='kubernetes')?'healthy':open.filter(f=>f.category==='configuration').length>2?'warning':'unknown',detail:connectedSystems.find(c=>c.source==='kubernetes')?'Connected · Monitoring':'Not connected'},
              {label:'Secrets',status:open.filter(f=>f.category==='secret_scan').length>0?'warning':'healthy',detail:open.filter(f=>f.category==='secret_scan').length>0?`${open.filter(f=>f.category==='secret_scan').length} rotation${open.filter(f=>f.category==='secret_scan').length!==1?'s':''} required`:'All secrets clean'},
              {label:'Dependencies',status:open.filter(f=>f.category==='dependency_audit'&&f.severity==='critical').length>0?'warning':'healthy',detail:open.filter(f=>f.category==='dependency_audit').length>0?`${open.filter(f=>f.category==='dependency_audit').length} vulnerable`:'Dependencies clean'},
              {label:'CI/CD Pipeline',status:connectedSystems.find(c=>['github-actions','jenkins','circleci'].includes(c.source))?'healthy':'unknown',detail:connectedSystems.find(c=>['github-actions','jenkins','circleci'].includes(c.source))?'Pipeline connected':'Not connected'},
              {label:'Container Registry',status:connectedSystems.find(c=>['docker-hub','ecr','acr','gcr'].includes(c.source))?'healthy':'unknown',detail:connectedSystems.find(c=>['docker-hub','ecr','acr','gcr'].includes(c.source))?'Registry connected':'Not connected'},
              {label:'Compliance',status:critical.length===0?'healthy':'warning',detail:critical.length>0?`${critical.length} policy violation${critical.length!==1?'s':''}`:'All checks passing'},
            ].map(h=>(
              <Link key={h.label} to={latestProject?`/projects/${latestProject.id}`:'/projects'} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all hover:shadow-sm group cursor-pointer ${h.status==='healthy'?'border-green-100 bg-green-50/50 hover:border-green-200':h.status==='warning'?'border-amber-200 bg-amber-50 hover:border-amber-300':'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${h.status==='healthy'?'bg-green-500':h.status==='warning'?'bg-amber-500':'bg-gray-400'}`}/>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-navy-900">{h.label}</p>
                  <p className={`text-[10px] ${h.status==='warning'?'text-amber-600':h.status==='healthy'?'text-green-600':'text-gray-400'}`}>{h.detail}</p>
                </div>
                <span className={`text-[10px] font-bold capitalize shrink-0 ${h.status==='healthy'?'text-green-600':h.status==='warning'?'text-amber-600':'text-gray-400'}`}>
                  {h.status==='healthy'?'Healthy':h.status==='warning'?'Warning':'Unknown'}
                </span>
                <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors"/>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ══ ROW 4 — Executive Metrics bar ═══════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          {label:'Success Rate',value:`${successRate}%`,color:successRate>=90?'text-green-600':successRate>=70?'text-amber-600':'text-red-600',link:'/executive'},
          {label:'Total Scans',value:validations.length,color:'text-navy-900',link:latestProject?`/projects/${latestProject.id}`:'/projects'},
          {label:'Open Issues',value:open.length,color:open.length>0?'text-amber-600':'text-green-600',link:latestProject?`/projects/${latestProject.id}`:'/projects'},
          {label:'Resolved',value:resolved.length,color:'text-green-600',link:latestProject?`/projects/${latestProject.id}`:'/projects'},
          {label:'Systems',value:connectedSystems.length,color:connectedSystems.length>0?'text-brand-600':'text-gray-400',link:latestProject?`/projects/${latestProject.id}`:'/projects'},
        ].map(m=>(
          <Link key={m.label} to={m.link} className="card py-3 text-center hover:shadow-md transition-all hover:border-brand-200 border border-transparent">
            <div className={`text-2xl font-semibold ${m.color}`}>{m.value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">{m.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
