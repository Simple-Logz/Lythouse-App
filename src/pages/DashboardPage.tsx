// @ts-nocheck
import{useCallback,useEffect,useState,useRef}from'react';
import{supabase,anonKey,edgeFunctionUrl}from'../lib/supabase';
import{useAuth}from'../lib/auth';
import{Spinner}from'../lib/ui';
import{Link}from'../lib/router';
import{
  CheckCircle2,XCircle,AlertTriangle,Clock,Shield,Zap,
  RefreshCw,Play,ChevronRight,Sparkles,GitBranch,
  Activity,Server,Database,Cloud,Lock,Package,
  TrendingUp,TrendingDown,BarChart3,Loader as Loader2,
  ArrowRight,Check,Users,GitPullRequest,Layers
}from'lucide-react';

function timeAgo(iso:string):string{
  const ms=Date.now()-new Date(iso).getTime();
  const m=Math.floor(ms/60000),h=Math.floor(m/60),d=Math.floor(h/24);
  if(m<1)return'just now';if(m<60)return`${m}m ago`;if(h<24)return`${h}h ago`;return`${d}d ago`;
}

export function DashboardPage(){
  const{user,profile}=useAuth();
  const[loading,setLoading]=useState(true);
  const[projects,setProjects]=useState<any[]>([]);
  const[validations,setValidations]=useState<any[]>([]);
  const[findings,setFindings]=useState<any[]>([]);
  const[approvals,setApprovals]=useState<any[]>([]);
  const[aiSummary,setAiSummary]=useState('');
  const[loadingAI,setLoadingAI]=useState(false);
  const[connections,setConnections]=useState<any[]>([]);
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

  const getAISummary=async()=>{
    setLoadingAI(true);
    const latest=validations.find(v=>v.status==='completed');
    const openFindings=findings.filter(f=>f.status==='open');
    const critical=openFindings.filter(f=>f.severity==='critical');
    const pendingApprovals=approvals.filter(a=>a.status==='pending');
    try{
      const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({
          systemPrompt:'You are an AI Release Advisor. Write a concise 3-4 sentence daily summary for a VP Engineering. Be specific, direct, and action-oriented. No bullet points. Plain sentences only.',
          messages:[{role:'user',content:`Generate today's deployment summary:
Projects: ${projects.length}
Latest risk score: ${latest?.risk_score??'no scan'}/100
Open findings: ${openFindings.length} (${critical.length} critical)
Pending approvals: ${pendingApprovals.length}
Connected systems: ${connections.filter(c=>c.status==='connected').length}
Recent validations: ${validations.slice(0,3).map(v=>`${v.status} (risk:${v.risk_score})`).join(', ')||'none'}`}]
        })
      });
      if(res.ok){const d=await res.json();setAiSummary(d.content||'');}
    }catch{}
    setLoadingAI(false);
  };

  useEffect(()=>{if(!loading&&projects.length>0)getAISummary();},[loading]);

  if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

  // Computed values
  const latest=validations.find(v=>v.status==='completed');
  const openFindings=findings.filter(f=>f.status==='open');
  const critical=openFindings.filter(f=>f.severity==='critical');
  const high=openFindings.filter(f=>f.severity==='high');
  const riskScore=latest?.risk_score??null;
  const readiness=riskScore!==null?Math.max(0,100-riskScore):null;
  const isBlocked=critical.length>0;
  const pendingApprovals=approvals.filter(a=>a.status==='pending');
  const latestProject=projects[0];
  const successRate=validations.length>0?Math.round((validations.filter(v=>v.status==='completed'&&v.critical_count===0).length/validations.length)*100):0;
  const connectedSystems=connections.filter(c=>c.status==='connected');

  // Timeline events
  const timeline=[
    ...validations.slice(0,6).map(v=>({
      time:v.created_at,
      icon:v.status==='completed'?Check:RefreshCw,
      color:v.status==='completed'&&v.critical_count===0?'text-green-600':v.critical_count>0?'text-red-500':'text-brand-600',
      text:v.status==='completed'?`Validation completed — ${v.total_findings} finding${v.total_findings!==1?'s':''}, risk ${v.risk_score}/100`:`Validation ${v.status}`,
      sub:v.summary||null,
    })),
    ...findings.filter(f=>f.status==='resolved'&&f.resolved_at).slice(0,3).map(f=>({
      time:f.resolved_at,icon:Check,color:'text-green-600',
      text:`Finding resolved: ${f.title}`,sub:null,
    })),
  ].sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime()).slice(0,8);

  // Production health derived from connected systems + findings
  const healthItems=[
    {label:'Kubernetes',status:connectedSystems.find(c=>c.source==='kubernetes')?'healthy':'unknown'},
    {label:'Database',status:findings.find(f=>f.status==='open'&&f.category==='configuration'&&f.title?.toLowerCase().includes('db'))?'warning':'healthy'},
    {label:'CI/CD',status:connectedSystems.find(c=>['github-actions','jenkins','circleci'].includes(c.source))?'healthy':'unknown'},
    {label:'Secrets',status:findings.find(f=>f.status==='open'&&f.category==='secret_scan')?'warning':'healthy'},
    {label:'Infrastructure',status:isBlocked?'warning':'healthy'},
    {label:'Container Registry',status:connectedSystems.find(c=>['docker-hub','ecr','acr','gcr'].includes(c.source))?'healthy':'unknown'},
  ];

  const noData=projects.length===0;

  return(
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* SECTION 1 — AI Release Advisor (hero) */}
      <div className={`rounded-2xl border-2 px-6 py-6 ${isBlocked?'border-red-300 bg-red-50':readiness!==null&&readiness>=80?'border-green-300 bg-green-50':'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-5 flex-1 min-w-0">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl border-2 ${isBlocked?'border-red-300 bg-red-100':readiness!==null&&readiness>=80?'border-green-300 bg-green-100':'border-gray-300 bg-white'}`}>
              {noData?'🚀':isBlocked?'⛔':readiness!==null&&readiness>=80?'✅':'⚠️'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5"><Sparkles size={11}/>AI Release Advisor</span>
              </div>
              <h1 className={`text-2xl font-black mb-1 ${isBlocked?'text-red-700':readiness!==null&&readiness>=80?'text-green-700':'text-navy-900'}`}>
                {noData?`Welcome, ${profile?.full_name?.split(' ')[0]||'there'}`:
                 isBlocked?'Deployment Blocked — Action Required':
                 readiness!==null&&readiness>=80?'Ready to Deploy':
                 readiness!==null?'Review Before Deploying':
                 'Run a Validation First'}
              </h1>
              {!noData&&readiness!==null&&(
                <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
                  <span className={`font-bold text-lg ${readiness>=80?'text-green-600':readiness>=60?'text-amber-600':'text-red-600'}`}>
                    {readiness}% confidence
                  </span>
                  {riskScore!==null&&<span className="text-gray-500">Risk: {riskScore}/100</span>}
                  {critical.length>0&&<span className="text-red-600 font-semibold">{critical.length} blocker{critical.length!==1?'s':''}</span>}
                  {latest&&<span className="text-gray-400 text-xs">Last scan {timeAgo(latest.created_at)}</span>}
                </div>
              )}
              {/* Checklist */}
              {!noData&&(
                <div className="flex flex-wrap gap-3">
                  {[
                    {label:'No critical findings',ok:critical.length===0},
                    {label:'No high-severity issues',ok:high.length===0},
                    {label:'Secrets clean',ok:!findings.find(f=>f.status==='open'&&f.category==='secret_scan')},
                    {label:'Validation run',ok:validations.length>0},
                    {label:'Systems connected',ok:connectedSystems.length>0},
                  ].map(c=>(
                    <span key={c.label} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${c.ok?'bg-green-50 text-green-700 border-green-200':'bg-gray-100 text-gray-400 border-gray-200'}`}>
                      {c.ok?<Check size={11}/>:<XCircle size={11}/>}{c.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Right side */}
          <div className="shrink-0 flex flex-col gap-2 items-end">
            {noData?(
              <Link to="/projects" className="btn-primary flex items-center gap-2"><Play size={15}/>Add First Project</Link>
            ):(
              <>
                {latestProject&&<Link to={`/projects/${latestProject.id}`} className="btn-primary flex items-center gap-2 text-sm"><ChevronRight size={15}/>Review Release</Link>}
                {!isBlocked&&readiness!==null&&readiness>=80&&<button className="btn-secondary text-sm flex items-center gap-2 text-green-700 border-green-300 bg-green-50 hover:bg-green-100"><Zap size={14}/>Deploy Now</button>}
              </>
            )}
          </div>
        </div>

        {/* AI Summary */}
        <div className="mt-5 pt-4 border-t border-black/10">
          <div className="flex items-start gap-2">
            <Sparkles size={14} className="text-purple-500 shrink-0 mt-0.5"/>
            {loadingAI?(
              <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={13} className="animate-spin"/>AI is analyzing your environment…</div>
            ):aiSummary?(
              <p className="text-sm text-gray-700 leading-relaxed">{aiSummary}</p>
            ):(
              <p className="text-sm text-gray-400 italic">Add a project and run a validation to get AI-powered deployment insights.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* SECTION 2+3 — Current Release + Timeline (left 2 cols) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Current Release */}
          {latestProject&&(
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-navy-900 flex items-center gap-2"><GitBranch size={14} className="text-brand-600"/>Current Release</h2>
                <Link to={`/projects/${latestProject.id}`} className="text-xs text-brand-600 hover:underline flex items-center gap-1">Open project<ChevronRight size={12}/></Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {label:'Project',value:latestProject.name,color:'text-navy-900 font-bold'},
                  {label:'Branch',value:latestProject.git_branch||'main',color:'text-brand-600'},
                  {label:'Environment',value:'Production',color:'text-gray-700'},
                  {label:'Status',value:latestProject.status,color:'text-green-600 capitalize'},
                ].map(s=>(
                  <div key={s.label} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className={`text-sm truncate ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              {pendingApprovals.length>0&&(
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
                  <Users size={14} className="text-amber-600 shrink-0"/>
                  <p className="text-sm text-amber-700"><strong>{pendingApprovals.length} approval{pendingApprovals.length!==1?'s':''} pending</strong> — {pendingApprovals[0]?.release_name}</p>
                  <Link to={`/projects/${latestProject.id}`} className="ml-auto text-xs text-amber-700 font-semibold underline shrink-0">Review →</Link>
                </div>
              )}
            </div>
          )}

          {/* SECTION 4 — Deployment Blockers */}
          {(critical.length>0||high.length>0)&&(
            <div className="card border-2 border-red-200">
              <h2 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500"/>
                {critical.length>0?`${critical.length} Deployment Blocker${critical.length!==1?'s':''}`:
                 `${high.length} High-Severity Issue${high.length!==1?'s':''}`}
              </h2>
              <div className="space-y-2">
                {[...critical,...high].slice(0,4).map(f=>(
                  <div key={f.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${f.severity==='critical'?'border-red-200 bg-red-50':'border-amber-200 bg-amber-50'}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${f.severity==='critical'?'bg-red-500':'bg-amber-500'}`}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy-900">{f.title}</p>
                      {f.file_path&&<p className="text-xs text-gray-500 font-mono mt-0.5">{f.file_path.split('/').slice(-2).join('/')}</p>}
                    </div>
                    {latestProject&&(
                      <Link to={`/projects/${latestProject.id}`} className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium">
                        <Zap size={11}/>Fix
                      </Link>
                    )}
                  </div>
                ))}
                {critical.length+high.length>4&&(
                  <p className="text-xs text-gray-400 text-center">+{critical.length+high.length-4} more findings in project</p>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3 — Deployment Timeline */}
          <div className="card">
            <h2 className="text-sm font-semibold text-navy-900 mb-4 flex items-center gap-2"><Activity size={14} className="text-brand-600"/>Deployment Timeline</h2>
            {timeline.length===0?(
              <div className="text-center py-8">
                <Activity size={24} className="mx-auto text-gray-200 mb-2"/>
                <p className="text-sm text-gray-400">No activity yet — run a validation to see your deployment timeline</p>
                {latestProject&&<Link to={`/projects/${latestProject.id}`} className="mt-3 btn-primary text-sm inline-flex items-center gap-1.5"><Play size={13}/>Run Validation</Link>}
              </div>
            ):(
              <div className="relative space-y-0">
                {timeline.map((e,i)=>(
                  <div key={i} className="flex items-start gap-3 py-2.5 relative">
                    {i<timeline.length-1&&<div className="absolute left-4 top-7 bottom-0 w-px bg-gray-100"/>}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-white z-10 ${e.color==='text-green-600'?'border-green-200':e.color==='text-red-500'?'border-red-200':'border-brand-200'}`}>
                      <e.icon size={13} className={e.color}/>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm text-navy-900">{e.text}</p>
                      {e.sub&&<p className="text-xs text-gray-400 mt-0.5 italic truncate">"{e.sub}"</p>}
                      <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(e.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* SECTION 5 — Production Health */}
          <div className="card">
            <h2 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2"><Server size={14} className="text-brand-600"/>Production Health</h2>
            <div className="space-y-2">
              {healthItems.map(h=>(
                <div key={h.label} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-700">{h.label}</span>
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                    h.status==='healthy'?'text-green-700 bg-green-50 border-green-200':
                    h.status==='warning'?'text-amber-700 bg-amber-50 border-amber-200':
                    'text-gray-500 bg-gray-50 border-gray-200'
                  }`}>
                    {h.status==='healthy'?<Check size={10}/>:h.status==='warning'?<AlertTriangle size={10}/>:<Clock size={10}/>}
                    {h.status==='healthy'?'Healthy':h.status==='warning'?'Warning':'Unknown'}
                  </span>
                </div>
              ))}
            </div>
            {connectedSystems.length===0&&(
              <p className="text-[10px] text-gray-400 text-center mt-3 border-t border-gray-100 pt-3">Connect systems in Environment → Assets for live health monitoring</p>
            )}
          </div>

          {/* SECTION 6 — Environment Activity */}
          <div className="card">
            <h2 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
              <Activity size={14} className="text-brand-600"/>Environment Activity
              <span className="relative flex h-1.5 w-1.5 ml-auto"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"/></span>
            </h2>
            {connectedSystems.length===0?(
              <div className="text-center py-4">
                <p className="text-xs text-gray-400">Connect your infrastructure in<br/>Environment → Assets to see live activity</p>
              </div>
            ):(
              <div className="space-y-2">
                {connectedSystems.slice(0,5).map((c:any,i:number)=>(
                  <div key={i} className="flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"/>
                    <p className="text-xs text-gray-700 flex-1">{c.source} monitoring active</p>
                    <span className="text-[10px] text-gray-400 shrink-0">{c.last_synced_at?timeAgo(c.last_synced_at):'just connected'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 9 — Executive Metrics */}
          <div className="card">
            <h2 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-brand-600"/>Executive Metrics</h2>
            <div className="space-y-3">
              {[
                {label:'Deployment Success Rate',value:`${successRate}%`,color:successRate>=90?'text-green-600':successRate>=70?'text-amber-600':'text-red-600'},
                {label:'Total Validations',value:validations.length,color:'text-navy-900'},
                {label:'Issues Resolved',value:findings.filter(f=>f.status==='resolved').length,color:'text-green-600'},
                {label:'Avg Risk Score',value:validations.filter(v=>v.risk_score!==null).length>0?Math.round(validations.filter(v=>v.risk_score!==null).reduce((s:number,v:any)=>s+(v.risk_score||0),0)/validations.filter(v=>v.risk_score!==null).length)+'/100':'—',color:'text-navy-900'},
                {label:'Systems Connected',value:connectedSystems.length,color:connectedSystems.length>0?'text-brand-600':'text-gray-400'},
              ].map(m=>(
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{m.label}</span>
                  <span className={`text-sm font-bold ${m.color}`}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick navigation */}
          <div className="card">
            <h2 className="text-sm font-semibold text-navy-900 mb-3">Quick Actions</h2>
            <div className="space-y-1">
              {[
                {label:'View all projects',to:'/projects',icon:GitBranch},
                {label:'Executive dashboard',to:'/executive',icon:BarChart3},
                ...(latestProject?[
                  {label:'Deployment Center',to:`/projects/${latestProject.id}`,icon:Shield},
                  {label:'Connect systems',to:`/projects/${latestProject.id}`,icon:Layers},
                ]:[]),
              ].map(a=>(
                <Link key={a.label} to={a.to} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                  <a.icon size={14} className="text-gray-400 group-hover:text-brand-600 transition-colors"/>
                  <span className="text-sm text-gray-700 group-hover:text-navy-900 transition-colors">{a.label}</span>
                  <ChevronRight size={13} className="ml-auto text-gray-300 group-hover:text-brand-500 transition-colors"/>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
