// @ts-nocheck
import{useCallback,useEffect,useRef,useState}from'react';
import{supabase,anonKey,edgeFunctionUrl,type Finding,type Validation}from'../lib/supabase';
import{useAuth}from'../lib/auth';
import{Spinner}from'../lib/ui';
import{
  Shield,ShieldAlert,CheckCircle2,XCircle,AlertTriangle,Clock,
  Zap,GitBranch,GitPullRequest,Users,Play,RefreshCw,ChevronRight,
  ChevronDown,Sparkles,Activity,Server,Lock,Package,Layers,
  FileCode,MessageSquare,Ticket,RotateCcw,Check,X,
  Loader as Loader2,Copy,ExternalLink,Bell,ArrowRight,
  BarChart3,Eye,Settings,FolderOpen,Code2,Menu
}from'lucide-react';
import{CodeEditorPanel}from'./CodeEditorPanel';
import{FileExplorer}from'./FileExplorer';
import{TopologyView}from'./TopologyView';

function timeAgo(iso:string):string{
  const ms=Date.now()-new Date(iso).getTime();
  const m=Math.floor(ms/60000),h=Math.floor(m/60),d=Math.floor(h/24);
  if(m<1)return'just now';if(m<60)return`${m}m ago`;if(h<24)return`${h}h ago`;return`${d}d ago`;
}

type Stage='changes'|'validation'|'remediation'|'approvals'|'deployment'|'verification';

const STAGES:{id:Stage;label:string;icon:typeof Shield}[]=[
  {id:'changes',label:'Changes',icon:GitBranch},
  {id:'validation',label:'Validation',icon:Shield},
  {id:'remediation',label:'Remediation',icon:Zap},
  {id:'approvals',label:'Approvals',icon:Users},
  {id:'deployment',label:'Deployment',icon:Play},
  {id:'verification',label:'Verification',icon:CheckCircle2},
];

function toBiz(sev:string){
  if(sev==='critical')return{label:'Deployment Blocker',color:'text-red-700',bg:'bg-red-50',border:'border-red-300',dot:'bg-red-500'};
  if(sev==='high')return{label:'Needs Attention',color:'text-amber-700',bg:'bg-amber-50',border:'border-amber-300',dot:'bg-amber-500'};
  if(sev==='medium')return{label:'Recommendation',color:'text-blue-700',bg:'bg-blue-50',border:'border-blue-300',dot:'bg-blue-500'};
  return{label:'Informational',color:'text-gray-600',bg:'bg-gray-50',border:'border-gray-200',dot:'bg-gray-400'};
}

export function ReleaseWorkspace({projectId,project}:{projectId:string;project:any}){
  const{user,profile}=useAuth();
  const[stage,setStage]=useState<Stage>('validation');
  const[validations,setValidations]=useState<Validation[]>([]);
  const[findings,setFindings]=useState<Finding[]>([]);
  const[approvals,setApprovals]=useState<any[]>([]);
  const[connections,setConnections]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);
  const[expandedFinding,setExpandedFinding]=useState<string|null>(null);
  const[aiState,setAiState]=useState<Record<string,{explain?:string;fix?:string;loading?:string}>>({});
  const[advisorText,setAdvisorText]=useState('');
  const[loadingAdvisor,setLoadingAdvisor]=useState(false);
  const[chatMsg,setChatMsg]=useState('');
  const[chatHistory,setChatHistory]=useState<{role:'user'|'ai';text:string}[]>([]);
  const[chatLoading,setChatLoading]=useState(false);
  const[sidebarOpen,setSidebarOpen]=useState(true);
  const[editorOpen,setEditorOpen]=useState(false);
  const[editorPath,setEditorPath]=useState('');
  const[updatingFinding,setUpdatingFinding]=useState<string|null>(null);
  const chatEndRef=useRef<HTMLDivElement>(null);
  const wsId=localStorage.getItem('sandbox.activeWs')||'';

  const load=useCallback(async()=>{
    setLoading(true);
    const[vr,fr,ar,cr]=await Promise.all([
      supabase.from('validations').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(20),
      supabase.from('findings').select('*').eq('project_id',projectId).order('created_at',{ascending:false}),
      supabase.from('release_approvals').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(5),
      supabase.from('environment_connections').select('*').eq('project_id',projectId),
    ]);
    setValidations(vr.data??[]);
    setFindings(fr.data??[]);
    setApprovals(ar.data??[]);
    setConnections(cr.data??[]);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[chatHistory]);

  const runValidation=async()=>{
    if(running)return;
    setRunning(true);setStage('validation');
    try{
      const{data:v}=await supabase.from('validations').insert({
        project_id:projectId,workspace_id:wsId,status:'running',
        git_url:project.git_url,git_branch:project.git_branch||'main',
      }).select().single();
      if(v){
        setValidations(prev=>[v,...prev]);
        const res=await fetch(`${edgeFunctionUrl}/process-validation`,{
          method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
          body:JSON.stringify({validationId:v.id,projectId,gitUrl:project.git_url,branch:project.git_branch||'main',githubToken:project.github_token||null}),
        });
        await load();
      }
    }catch{}
    setRunning(false);
  };

  const callAI=async(id:string,type:'explain'|'fix',f:Finding)=>{
    setAiState(prev=>({...prev,[id]:{...prev[id],loading:type}}));
    const prompt=type==='explain'
      ?`Explain this security finding in plain business language. Include: what happened, why it matters, business impact, what to do next.\n\nFinding: ${f.title}\nDescription: ${f.description}\nFile: ${f.file_path||'unknown'}${f.line?`:${f.line}`:''}`
      :`Generate a complete, production-ready fix.\n\n1. PROBLEM: What is wrong\n2. FIX: Exact code change (before/after)\n3. FILES: Which files to change\n4. RISK: Risk of applying\n5. TIME: How long to fix\n\nFinding: ${f.title}\nFile: ${f.file_path||'unknown'}\nRecommendation: ${f.recommendation||f.description}`;
    try{
      const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({systemPrompt:'You are a senior DevSecOps engineer. Be specific and actionable.',messages:[{role:'user',content:prompt}]})});
      if(res.ok){const d=await res.json();setAiState(prev=>({...prev,[id]:{...prev[id],[type]:d.content,loading:undefined}}));}
    }catch{setAiState(prev=>({...prev,[id]:{...prev[id],loading:undefined}}));}
  };

  const getAdvisor=async()=>{
    setLoadingAdvisor(true);
    const latest=validations.find(v=>v.status==='completed');
    const open=findings.filter(f=>f.status==='open');
    try{
      const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({
          systemPrompt:'You are an AI Release Advisor. Be direct and decisive. 3-4 sentences max.',
          messages:[{role:'user',content:`Should we deploy "${project.name}" now?\nRisk: ${latest?.risk_score??'unknown'}/100\nOpen findings: ${open.length} (${open.filter(f=>f.severity==='critical').length} critical)\nApprovals: ${approvals.filter(a=>a.status==='approved').length}/${approvals.length || 3}\nGive: RECOMMENDATION (Deploy Now/Delay/Block), reason, and immediate next action.`}]
        })});
      if(res.ok){const d=await res.json();setAdvisorText(d.content||'');}
    }catch{}
    setLoadingAdvisor(false);
  };

  const sendChat=async()=>{
    if(!chatMsg.trim())return;
    const msg=chatMsg.trim();setChatMsg('');
    setChatHistory(prev=>[...prev,{role:'user',text:msg}]);
    setChatLoading(true);
    const latest=validations.find(v=>v.status==='completed');
    const open=findings.filter(f=>f.status==='open');
    try{
      const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({
          systemPrompt:`You are an AI Release Manager for "${project.name}". Current state: risk ${latest?.risk_score??'unknown'}/100, ${open.length} open findings, ${open.filter(f=>f.severity==='critical').length} critical. Be concise and direct.`,
          messages:[...chatHistory.map(m=>({role:m.role==='user'?'user':'assistant',content:m.text})),{role:'user',content:msg}]
        })});
      if(res.ok){const d=await res.json();setChatHistory(prev=>[...prev,{role:'ai',text:d.content||'No response.'}]);}
    }catch{setChatHistory(prev=>[...prev,{role:'ai',text:'Failed to connect.'}]);}
    setChatLoading(false);
  };

  const resolveFind=async(id:string)=>{
    setUpdatingFinding(id);
    await supabase.from('findings').update({status:'resolved',resolved_at:new Date().toISOString()}).eq('id',id);
    setFindings(prev=>prev.map(f=>f.id===id?{...f,status:'resolved'}:f));
    setUpdatingFinding(null);
  };

  const approveRelease=async(releaseId:string,role:string,decision:'approve'|'reject')=>{
    const release=approvals.find(a=>a.id===releaseId);
    if(!release)return;
    const newApproval={role,approver_name:profile?.full_name||profile?.email||'Unknown',
      approver_id:user?.id,approved_at:new Date().toISOString(),comment:''};
    const updated=decision==='approve'
      ?[...(release.approvals||[]).filter((a:any)=>a.role!==role),newApproval]
      :(release.approvals||[]).filter((a:any)=>a.role!==role);
    const allDone=['platform','security','product'].every(r=>updated.some((a:any)=>a.role===r));
    await supabase.from('release_approvals').update({approvals:updated,status:allDone?'approved':decision==='reject'?'rejected':'pending'}).eq('id',releaseId);
    await load();
  };

  const createRelease=async()=>{
    const name=`${project.name} — ${new Date().toLocaleDateString()}`;
    await supabase.from('release_approvals').insert({
      project_id:projectId,workspace_id:wsId,release_name:name,
      status:'pending',required_approvers:['platform','security','product'],approvals:[],
      validation_id:validations.find(v=>v.status==='completed')?.id||null,
    });
    await load();
    setStage('approvals');
  };

  if(loading)return<div className="flex justify-center py-16"><Spinner size={22}/></div>;

  const latest=validations.find(v=>v.status==='completed');
  const open=findings.filter(f=>f.status==='open');
  const critical=open.filter(f=>f.severity==='critical');
  const high=open.filter(f=>f.severity==='high');
  const resolved=findings.filter(f=>f.status==='resolved');
  const riskScore=latest?.risk_score??null;
  const readiness=riskScore!==null?Math.max(0,100-riskScore):null;
  const isBlocked=critical.length>0;
  const connected=connections.filter(c=>c.status==='connected');

  // Stage completion status
  const stageStatus:Record<Stage,'done'|'active'|'pending'>={
    changes:validations.length>0?'done':'pending',
    validation:validations.length>0?(critical.length===0?'done':'active'):'pending',
    remediation:critical.length===0&&high.length===0?'done':open.length>0?'active':'pending',
    approvals:approvals.some(a=>a.status==='approved')?'done':approvals.length>0?'active':'pending',
    deployment:'pending',
    verification:'pending',
  };

  return(
    <div className="flex h-full" style={{minHeight:'calc(100vh - 130px)'}}>

      {/* ── LEFT RAIL — Stage Navigation ─────────────────────────────────── */}
      <div className="w-48 shrink-0 border-r border-gray-100 bg-gray-50/50 flex flex-col py-4 px-2 gap-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mb-2">Release Stages</p>
        {STAGES.map((s,i)=>{
          const st=stageStatus[s.id];
          return(
            <button key={s.id} onClick={()=>setStage(s.id)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${stage===s.id?'bg-white text-navy-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700 hover:bg-white/60'}`}>
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${st==='done'?'bg-green-500 text-white':stage===s.id?'bg-brand-600 text-white':'bg-gray-200 text-gray-500'}`}>
                {st==='done'?<Check size={11}/>:i+1}
              </div>
              {s.label}
              {st==='active'&&stage!==s.id&&<span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"/>}
            </button>
          );
        })}

        <div className="mt-auto px-1 space-y-1 pt-4 border-t border-gray-200">
          <button onClick={()=>setStage('changes')} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs w-full ${stage==='changes'?'bg-white text-navy-900 shadow-sm border border-gray-200':'text-gray-500 hover:bg-white/60'}`}>
            <FolderOpen size={13}/>Files
          </button>
          <button className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs w-full text-gray-500 hover:bg-white/60`} onClick={()=>window.location.href=`/projects/${projectId}/settings`}>
            <Settings size={13}/>Settings
          </button>
        </div>
      </div>

      {/* ── CENTER — Main Workspace ──────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto">

        {/* Release Header — always visible */}
        <div className={`sticky top-0 z-20 border-b px-6 py-4 ${isBlocked?'bg-red-50 border-red-200':readiness!==null&&readiness>=80?'bg-green-50 border-green-200':'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-base font-bold text-navy-900 truncate">{project.name}</h1>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${isBlocked?'text-red-700 bg-red-100 border-red-300':readiness!==null&&readiness>=80?'text-green-700 bg-green-100 border-green-300':'text-amber-700 bg-amber-100 border-amber-300'}`}>
                    {isBlocked?'⛔ BLOCKED':readiness!==null&&readiness>=80?'✅ READY':'⚠ REVIEW'}
                  </span>
                  {readiness!==null&&<span className={`text-sm font-bold ${readiness>=80?'text-green-600':readiness>=60?'text-amber-600':'text-red-600'}`}>{readiness}% confidence</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><GitBranch size={10}/>{project.git_branch||'main'}</span>
                  <span>Production</span>
                  {latest&&<span>Last verified {timeAgo(latest.created_at)}</span>}
                  {connected.length>0&&<span className="flex items-center gap-1 text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-400"/>{connected.length} system{connected.length!==1?'s':''} connected</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={load} className="btn-secondary text-xs flex items-center gap-1.5"><RefreshCw size={12}/>Refresh</button>
              <button onClick={runValidation} disabled={running} className="btn-secondary text-xs flex items-center gap-1.5">
                {running?<><Loader2 size={12} className="animate-spin"/>Scanning…</>:<><Shield size={12}/>Revalidate</>}
              </button>
              {!isBlocked&&readiness!==null&&readiness>=80&&(
                <button className="btn-primary text-xs flex items-center gap-1.5"><Play size={12}/>Deploy</button>
              )}
              {approvals.length===0&&<button onClick={createRelease} className="btn-secondary text-xs flex items-center gap-1.5"><Users size={12}/>Request Approval</button>}
            </div>
          </div>
        </div>

        {/* Stage content */}
        <div className="px-6 py-5">

          {/* CHANGES */}
          {stage==='changes'&&(
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-navy-900 mb-1">What Changed</h2>
                <p className="text-sm text-gray-500">Everything that changed since the last successful release, including code, infrastructure, dependencies, and secrets.</p>
              </div>

              {validations.length===0?(
                <div className="card text-center py-12">
                  <GitBranch size={32} className="mx-auto text-gray-200 mb-3"/>
                  <p className="text-sm font-medium text-gray-600 mb-1">No validation history</p>
                  <p className="text-xs text-gray-400 mb-4">Run a validation to detect what changed in this repository.</p>
                  <button onClick={()=>{runValidation();setStage('validation');}} className="btn-primary"><Shield size={14}/>Run Validation</button>
                </div>
              ):(
                <div className="space-y-4">
                  {/* Top row — summary/metrics on the left, topology top-right */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      {/* Summary from latest scan */}
                      {latest?.summary&&(
                        <div className="card border-brand-200 bg-brand-50">
                          <p className="text-xs font-bold uppercase tracking-wide text-brand-700 mb-1 flex items-center gap-1.5"><Sparkles size={11}/>AI Change Summary</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{latest.summary}</p>
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          {label:'Files Scanned',value:latest?.total_findings!==undefined?`${latest.total_findings} issues found`:'—',icon:FileCode,color:'text-brand-600'},
                          {label:'Validation Status',value:latest?.status||'Never scanned',icon:Shield,color:latest?.status==='completed'?'text-green-600':'text-amber-600'},
                          {label:'Risk Score',value:riskScore!==null?`${riskScore}/100`:'—',icon:BarChart3,color:riskScore!==null&&riskScore<40?'text-green-600':riskScore!==null&&riskScore<70?'text-amber-600':'text-red-600'},
                        ].map(s=>(
                          <div key={s.label} className="card text-center py-4">
                            <s.icon size={20} className={`mx-auto mb-2 ${s.color}`}/>
                            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Topology — top right */}
                    <TopologyView projectId={projectId} project={project} compact onOpenFile={(p)=>{setEditorPath(p);setEditorOpen(true);}}/>
                  </div>

                  {/* File browser — expanded, full width */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-navy-900">Repository Files</h3>
                        <p className="text-xs text-gray-500">Browse and edit any file in this repository.</p>
                      </div>
                      <button onClick={()=>setEditorOpen(true)} className="btn-secondary text-xs flex items-center gap-1.5"><Code2 size={12}/>Open Editor</button>
                    </div>
                    <FileExplorer projectId={projectId} project={project} openFilePath={editorPath} highlightLine={null} onHighlightConsumed={()=>{}}/>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VALIDATION */}
          {stage==='validation'&&(
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-navy-900 mb-1">Validation Results</h2>
                  <p className="text-sm text-gray-500">Security scan results, policy checks, dependency audit, and infrastructure drift detection.</p>
                </div>
                <button onClick={runValidation} disabled={running} className="btn-primary text-sm shrink-0">
                  {running?<><Loader2 size={13} className="animate-spin"/>Scanning…</>:<><Shield size={13}/>{validations.length?'Re-scan':'Run Scan'}</>}
                </button>
              </div>

              {validations.length===0&&!running?(
                <div className="card text-center py-12">
                  <Shield size={36} className="mx-auto text-gray-200 mb-3"/>
                  <p className="text-sm font-medium text-gray-600 mb-4">No scans yet — run a validation to check this repository</p>
                  <button onClick={runValidation} className="btn-primary"><Shield size={14}/>Start Validation</button>
                </div>
              ):(
                <div className="space-y-3">
                  {/* Status banner */}
                  <div className={`rounded-2xl border-2 px-5 py-4 ${isBlocked?'border-red-300 bg-red-50':readiness!==null&&readiness>=80?'border-green-300 bg-green-50':'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className={`text-xl font-semibold ${isBlocked?'text-red-700':readiness!==null&&readiness>=80?'text-green-700':'text-amber-700'}`}>
                          {running?'Scanning repository…':isBlocked?`${critical.length} Deployment Blocker${critical.length!==1?'s':''}`:readiness!==null&&readiness>=80?'All checks passed':'Review before deploying'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {isBlocked?'Critical issues must be resolved before this release can proceed. Go to Remediation to fix them.':
                          readiness!==null&&readiness>=80?'No critical or high-severity issues found. You\'re clear to proceed to Approvals.':
                          `${high.length} high-severity issue${high.length!==1?'s':''} need review before deployment.`}
                        </p>
                      </div>
                      {readiness!==null&&<div className="text-center shrink-0"><div className={`text-4xl font-semibold ${readiness>=80?'text-green-600':readiness>=60?'text-amber-600':'text-red-600'}`}>{readiness}%</div><div className="text-xs text-gray-500">readiness</div></div>}
                    </div>
                    {(isBlocked||high.length>0)&&(
                      <div className="mt-3 pt-3 border-t border-black/10 flex gap-2">
                        <button onClick={()=>setStage('remediation')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${isBlocked?'bg-red-600 text-white hover:bg-red-700':'bg-amber-500 text-white hover:bg-amber-600'}`}>
                          <Zap size={11}/>Fix Issues in Remediation →
                        </button>
                      </div>
                    )}
                    {!isBlocked&&high.length===0&&readiness!==null&&(
                      <div className="mt-3 pt-3 border-t border-black/10 flex gap-2">
                        <button onClick={()=>setStage('approvals')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700">
                          <Users size={11}/>Proceed to Approvals →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dimension breakdown */}
                  {latest&&(
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        {label:'Security',score:Math.max(0,100-critical.filter(f=>f.category==='static_analysis').length*30-high.length*10),status:critical.length>0?'fail':high.length>0?'warn':'pass'},
                        {label:'Secrets',score:Math.max(0,100-open.filter(f=>f.category==='secret_scan').length*50),status:open.filter(f=>f.category==='secret_scan').length>0?'fail':'pass'},
                        {label:'Dependencies',score:Math.max(0,100-open.filter(f=>f.category==='dependency_audit'&&f.severity==='critical').length*30),status:open.filter(f=>f.category==='dependency_audit'&&f.severity==='critical').length>0?'fail':'pass'},
                        {label:'Code Quality',score:Math.max(0,100-open.filter(f=>f.category==='static_analysis').length*10),status:open.filter(f=>f.category==='static_analysis'&&f.severity==='critical').length>0?'fail':'pass'},
                        {label:'Infrastructure',score:Math.max(0,100-open.filter(f=>f.category==='configuration').length*15),status:open.filter(f=>f.category==='configuration').length>2?'fail':open.filter(f=>f.category==='configuration').length>0?'warn':'pass'},
                        {label:'Compliance',score:critical.length===0?95:40,status:critical.length>0?'fail':'pass'},
                      ].map(d=>(
                        <div key={d.label} className={`rounded-xl border px-3 py-3 ${d.status==='fail'?'border-red-200 bg-red-50':d.status==='warn'?'border-amber-200 bg-amber-50':'border-green-200 bg-green-50'}`}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-semibold text-gray-700">{d.label}</span>
                            <span className={`text-lg font-semibold ${d.status==='fail'?'text-red-600':d.status==='warn'?'text-amber-600':'text-green-600'}`}>{d.score}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-black/10"><div className={`h-1.5 rounded-full ${d.status==='fail'?'bg-red-500':d.status==='warn'?'bg-amber-500':'bg-green-500'}`} style={{width:`${d.score}%`}}/></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Scan history */}
                  {validations.length>1&&(
                    <div className="card">
                      <h3 className="text-sm font-semibold text-navy-900 mb-3">Scan History</h3>
                      <div className="space-y-1">
                        {validations.slice(0,5).map(v=>(
                          <div key={v.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 text-xs">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${v.status==='completed'&&v.critical_count===0?'bg-green-500':v.critical_count>0?'bg-red-500':'bg-amber-500'}`}/>
                            <span className="text-gray-600 flex-1">{v.status==='completed'?`${v.total_findings} findings · risk ${v.risk_score}/100`:`Status: ${v.status}`}</span>
                            <span className="text-gray-400">{timeAgo(v.created_at)}</span>
                            {v.risk_score!==null&&<span className={`font-bold ${v.risk_score<40?'text-green-600':v.risk_score<70?'text-amber-600':'text-red-600'}`}>{v.risk_score}/100</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* REMEDIATION */}
          {stage==='remediation'&&(
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-navy-900 mb-1">Remediation — Work Items</h2>
                  <p className="text-sm text-gray-500">Every finding is a tracked work item. Assign owners, generate AI fixes, create tickets, and verify resolution.</p>
                </div>
                <div className="flex items-center gap-2 text-sm shrink-0">
                  <span className="text-green-600 font-semibold">{resolved.length} resolved</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-red-600 font-semibold">{open.length} open</span>
                </div>
              </div>

              {findings.length===0?(
                <div className="card text-center py-10">
                  <CheckCircle2 size={28} className="mx-auto text-green-300 mb-2"/>
                  <p className="text-sm text-gray-500">No findings yet — run a validation first</p>
                </div>
              ):(
                <div className="space-y-2">
                  {findings.map(f=>{
                    const biz=toBiz(f.severity);
                    const isExp=expandedFinding===f.id;
                    const ai=aiState[f.id]||{};
                    return(
                      <div key={f.id} className={`rounded-xl border-2 overflow-hidden ${biz.border} ${f.status==='resolved'?'opacity-50':''}`}>
                        <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${biz.bg}`} onClick={()=>setExpandedFinding(isExp?null:f.id)}>
                          {isExp?<ChevronDown size={14} className="text-gray-400 shrink-0"/>:<ChevronRight size={14} className="text-gray-400 shrink-0"/>}
                          <span className={`w-2 h-2 rounded-full shrink-0 ${biz.dot}`}/>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${biz.bg} ${biz.color} ${biz.border}`}>{biz.label}</span>
                              <span className="text-sm font-semibold text-navy-900">{f.title}</span>
                            </div>
                            {f.file_path&&<p className="text-[10px] font-mono text-gray-400 mt-0.5 flex items-center gap-1"><FileCode size={9}/>{f.file_path.split('/').slice(-2).join('/')}{f.line?`:${f.line}`:''}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0" onClick={e=>e.stopPropagation()}>
                            {f.status==='open'&&<button onClick={()=>resolveFind(f.id)} disabled={updatingFinding===f.id} className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                              {updatingFinding===f.id?<Loader2 size={11} className="animate-spin"/>:<Check size={11}/>}Resolve
                            </button>}
                            {f.status==='resolved'&&<span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={12}/>Resolved</span>}
                          </div>
                        </div>
                        {isExp&&(
                          <div className="bg-white border-t border-gray-100 px-4 py-4 space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className={`rounded-lg border ${biz.border} ${biz.bg} px-3 py-2.5`}>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Why it matters</p>
                                <p className="text-sm text-gray-700">{f.description}</p>
                              </div>
                              <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Suggested fix</p>
                                <p className="text-sm text-gray-700">{f.recommendation||'Generate an AI fix below.'}</p>
                              </div>
                            </div>
                            {f.file_path&&(
                              <div className="flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2">
                                <FileCode size={12} className="text-gray-400 shrink-0"/>
                                <code className="text-xs text-green-400 flex-1">{f.file_path}{f.line?`:${f.line}`:''}</code>
                                <button onClick={()=>{setEditorPath(f.file_path!);setEditorOpen(true);}} className="text-xs text-brand-400 hover:text-brand-300 font-medium shrink-0">Open →</button>
                              </div>
                            )}
                            {ai.explain&&<div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3"><p className="text-[10px] font-bold text-purple-700 mb-1 flex items-center gap-1"><Sparkles size={10}/>AI Explanation</p><div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ai.explain}</div></div>}
                            {ai.fix&&<div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3"><p className="text-[10px] font-bold text-brand-700 mb-2 flex items-center gap-1"><Zap size={10}/>AI-Generated Fix</p><pre className="text-xs text-gray-800 whitespace-pre-wrap bg-white rounded-lg p-3 border border-brand-200 overflow-x-auto">{ai.fix}</pre><div className="flex gap-2 mt-2"><button className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700"><Zap size={11}/>Apply Fix</button><button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-50"><GitPullRequest size={11}/>Create PR</button></div></div>}
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                              <button onClick={()=>callAI(f.id,'explain',f)} disabled={!!ai.loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 disabled:opacity-50">{ai.loading==='explain'?<Loader2 size={11} className="animate-spin"/>:<Sparkles size={11}/>}Explain</button>
                              <button onClick={()=>callAI(f.id,'fix',f)} disabled={!!ai.loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 disabled:opacity-50">{ai.loading==='fix'?<Loader2 size={11} className="animate-spin"/>:<Zap size={11}/>}Generate AI Fix</button>
                              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100"><Ticket size={11}/>Create Ticket</button>
                              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100"><GitPullRequest size={11}/>Create PR</button>
                              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100"><MessageSquare size={11}/>Notify Slack</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {open.length===0&&findings.length>0&&(
                <div className="card border-2 border-green-200 bg-green-50 text-center py-6">
                  <CheckCircle2 size={28} className="mx-auto text-green-500 mb-2"/>
                  <p className="text-sm font-semibold text-green-700">All findings resolved</p>
                  <p className="text-xs text-green-600 mb-3">You're clear to proceed to Approvals</p>
                  <button onClick={()=>setStage('approvals')} className="btn-primary text-sm flex items-center gap-2 mx-auto"><Users size={13}/>Request Approvals →</button>
                </div>
              )}
            </div>
          )}

          {/* APPROVALS */}
          {stage==='approvals'&&(
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-navy-900 mb-1">Release Approvals</h2>
                  <p className="text-sm text-gray-500">Multi-team sign-off before deployment. Each approval is logged with timestamp and approver.</p>
                </div>
                {approvals.length===0&&<button onClick={createRelease} className="btn-primary text-sm shrink-0"><Users size={13}/>Request Approval</button>}
              </div>
              {approvals.length===0?(
                <div className="card text-center py-10">
                  <Users size={28} className="mx-auto text-gray-200 mb-3"/>
                  <p className="text-sm text-gray-500 mb-4">No approval workflows yet. Create one to get sign-off from Platform, Security, and Product teams.</p>
                  <button onClick={createRelease} className="btn-primary"><Users size={13}/>Create Approval Workflow</button>
                </div>
              ):(
                approvals.slice(0,3).map(release=>{
                  const approvedRoles=new Set((release.approvals||[]).map((a:any)=>a.role));
                  const allApproved=['platform','security','product'].every(r=>approvedRoles.has(r));
                  return(
                    <div key={release.id} className={`card border-2 ${allApproved?'border-green-300 bg-green-50':'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-navy-900">{release.release_name}</h3>
                          <p className="text-xs text-gray-500">{new Date(release.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${allApproved?'bg-green-100 text-green-700 border-green-300':release.status==='rejected'?'bg-red-100 text-red-700 border-red-300':'bg-amber-100 text-amber-700 border-amber-300'}`}>
                          {allApproved?'✓ Approved':release.status==='rejected'?'✗ Rejected':'⏳ Pending'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {[
                          {id:'platform',label:'Platform Engineering',desc:'Infrastructure and deployment readiness'},
                          {id:'security',label:'Security Team',desc:'Security posture and compliance'},
                          {id:'product',label:'Product Management',desc:'Business and feature readiness'},
                        ].map(role=>{
                          const approved=(release.approvals||[]).find((a:any)=>a.role===role.id);
                          return(
                            <div key={role.id} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${approved?'border-green-200 bg-green-50':'border-gray-200 bg-white'}`}>
                              <div>
                                <p className="text-sm font-medium text-navy-900">{role.label}</p>
                                {approved?<p className="text-xs text-green-600">✓ Approved by {approved.approver_name} · {timeAgo(approved.approved_at)}</p>:<p className="text-xs text-gray-400">{role.desc}</p>}
                              </div>
                              {!approved&&!allApproved&&release.status!=='rejected'&&(
                                <div className="flex gap-2 shrink-0">
                                  <button onClick={()=>approveRelease(release.id,role.id,'approve')} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 flex items-center gap-1"><Check size={11}/>Approve</button>
                                  <button onClick={()=>approveRelease(release.id,role.id,'reject')} className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"><X size={11}/></button>
                                </div>
                              )}
                              {approved&&<CheckCircle2 size={18} className="text-green-500 shrink-0"/>}
                            </div>
                          );
                        })}
                      </div>
                      {allApproved&&(
                        <div className="mt-4 pt-4 border-t border-green-200 flex gap-2">
                          <button onClick={()=>setStage('deployment')} className="btn-primary text-sm flex items-center gap-2"><Play size={13}/>Proceed to Deployment →</button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* DEPLOYMENT */}
          {stage==='deployment'&&(
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-navy-900 mb-1">Deployment</h2>
              <p className="text-sm text-gray-500">Monitor your deployment pipeline, build steps, and environment changes in real time.</p>
              <div className={`card border-2 text-center py-12 ${isBlocked?'border-red-200':'border-gray-200'}`}>
                {isBlocked?(
                  <>
                    <XCircle size={32} className="mx-auto text-red-400 mb-3"/>
                    <p className="text-sm font-semibold text-red-700 mb-1">Deployment Blocked</p>
                    <p className="text-xs text-red-600 mb-4">{critical.length} critical issue{critical.length!==1?'s':''} must be resolved before deploying</p>
                    <button onClick={()=>setStage('remediation')} className="btn-primary text-sm flex items-center gap-2 mx-auto"><Zap size={13}/>Fix Issues First →</button>
                  </>
                ):(
                  <>
                    <Play size={32} className="mx-auto text-green-400 mb-3"/>
                    <p className="text-sm font-semibold text-green-700 mb-1">Ready to Deploy</p>
                    <p className="text-xs text-gray-500 mb-4">Connect your CI/CD pipeline in Environment → Assets to trigger deployments from LytHouse and see real-time build logs here.</p>
                    <button className="btn-primary text-sm flex items-center gap-2 mx-auto"><Play size={13}/>Deploy to Production</button>
                  </>
                )}
              </div>
              {connected.length>0&&(
                <div className="card">
                  <h3 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2"><Activity size={14}/>Connected Deployment Systems</h3>
                  <div className="space-y-2">
                    {connected.map((c:any)=>(
                      <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <span className="text-sm text-gray-700">{c.source}</span>
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Check size={11}/>Connected</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VERIFICATION */}
          {stage==='verification'&&(
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-navy-900 mb-1">Post-Deployment Verification</h2>
              <p className="text-sm text-gray-500">After deployment, LytHouse automatically checks service health, error rates, and rollout status.</p>
              <div className="card text-center py-12">
                <CheckCircle2 size={32} className="mx-auto text-gray-200 mb-3"/>
                <p className="text-sm font-medium text-gray-500 mb-1">No active deployment to verify</p>
                <p className="text-xs text-gray-400">After you deploy, LytHouse will show service health, error rate changes, Kubernetes rollout status, and automatic rollback recommendations here.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL — Persistent Intelligence ────────────────────────── */}
      {sidebarOpen&&(
        <div className="w-72 shrink-0 border-l border-gray-100 bg-gray-50/30 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Sparkles size={11}/>AI Release Advisor</span>
            <button onClick={()=>setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={14}/></button>
          </div>

          <div className="p-4 space-y-4 flex-1">
            {/* Recommendation */}
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-3">
              {loadingAdvisor?(
                <div className="flex items-center gap-2 text-xs text-purple-600"><Loader2 size={12} className="animate-spin"/>Analyzing…</div>
              ):advisorText?(
                <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{advisorText}</div>
              ):(
                <div>
                  <p className="text-xs text-purple-600 mb-2">Get an AI-powered deployment recommendation</p>
                  <button onClick={getAdvisor} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700"><Sparkles size={11}/>Get Recommendation</button>
                </div>
              )}
              {advisorText&&<button onClick={getAdvisor} disabled={loadingAdvisor} className="mt-2 text-[10px] text-purple-500 hover:text-purple-700 underline">Refresh</button>}
            </div>

            {/* Remaining tasks */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Remaining Tasks</p>
              <div className="space-y-1.5">
                {[
                  {done:validations.length>0,label:'Run validation'},
                  {done:critical.length===0,label:`Resolve ${critical.length} blocker${critical.length!==1?'s':''}`},
                  {done:high.length===0,label:`Fix ${high.length} high-severity issue${high.length!==1?'s':''}`},
                  {done:approvals.some(a=>a.status==='approved'),label:'Get approvals'},
                ].filter(t=>!t.done).map((t,i)=>(
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-white border border-gray-100 rounded-lg px-3 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"/>
                    {t.label}
                  </div>
                ))}
                {critical.length===0&&high.length===0&&validations.length>0&&(
                  <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <CheckCircle2 size={12}/>All clear — ready to deploy
                  </div>
                )}
              </div>
            </div>

            {/* Live activity */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">Live Activity<span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"/></span></p>
              <div className="space-y-1.5">
                {[...validations.slice(0,3).map(v=>({time:v.created_at,text:`Validation ${v.status} · risk ${v.risk_score??'—'}/100`})),
                  ...findings.filter(f=>f.status==='resolved'&&f.resolved_at).slice(0,2).map(f=>({time:f.resolved_at!,text:`Resolved: ${f.title.slice(0,35)}`}))
                ].sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime()).slice(0,5).map((e,i)=>(
                  <div key={i} className="text-[11px] text-gray-600 flex gap-2">
                    <span className="text-gray-400 shrink-0">{timeAgo(e.time)}</span>
                    <span className="truncate">{e.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Chat */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Ask AI</p>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
                {chatHistory.length===0&&<p className="text-[11px] text-gray-400 italic">Ask anything: "Can we deploy tonight?" "What's the biggest risk?"</p>}
                {chatHistory.map((m,i)=>(
                  <div key={i} className={`text-[11px] rounded-lg px-2.5 py-2 ${m.role==='user'?'bg-brand-600 text-white ml-4':'bg-white border border-gray-100 text-gray-700 mr-4'}`}>
                    {m.text}
                  </div>
                ))}
                {chatLoading&&<div className="text-[11px] text-gray-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/>Thinking…</div>}
                <div ref={chatEndRef}/>
              </div>
              <div className="flex gap-1.5">
                <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendChat()} placeholder="Ask about this release…" className="input text-xs py-1.5 flex-1"/>
                <button onClick={sendChat} disabled={chatLoading||!chatMsg.trim()} className="px-2.5 py-1.5 bg-brand-600 text-white rounded-lg disabled:opacity-50"><ChevronRight size={13}/></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!sidebarOpen&&(
        <button onClick={()=>setSidebarOpen(true)} className="fixed right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-3 shadow-lg hover:bg-gray-50 transition-colors">
          <Sparkles size={14} className="text-purple-500"/>
          <span className="text-[10px] text-gray-500 vertical-lr" style={{writingMode:'vertical-lr'}}>AI Advisor</span>
        </button>
      )}

      {/* Code editor modal */}
      {editorOpen&&(
        <CodeEditorPanel
          projectId={projectId}
          project={project}
          initialPath={editorPath}
          highlightLine={null}
          findingContext={null}
          onClose={()=>{setEditorOpen(false);setEditorPath('');}}
        />
      )}
    </div>
  );
}
