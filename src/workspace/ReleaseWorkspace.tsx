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
import{RepoDiscovery}from'./RepoDiscovery';
import{ValidationReport}from'./ValidationReport';
import{FileBrowser}from'./FileBrowser';
import{WorkspaceSettings}from'./WorkspaceSettings';
import{loadSettings}from'./releaseSettings';

function timeAgo(iso:string):string{
  const ms=Date.now()-new Date(iso).getTime();
  const m=Math.floor(ms/60000),h=Math.floor(m/60),d=Math.floor(h/24);
  if(m<1)return'just now';if(m<60)return`${m}m ago`;if(h<24)return`${h}h ago`;return`${d}d ago`;
}

type Stage='changes'|'validation'|'remediation'|'approvals'|'deployment'|'verification';

const STAGES:{id:Stage;label:string;sub:string;icon:typeof Shield}[]=[
  {id:'changes',label:'Discovery',sub:'What changed',icon:GitBranch},
  {id:'validation',label:'Validation',sub:'Is it safe?',icon:Shield},
  {id:'remediation',label:'Remediation',sub:'Fix blockers',icon:Zap},
  {id:'approvals',label:'Governance',sub:'Sign-off',icon:Users},
  {id:'deployment',label:'Deployment',sub:'Ship it',icon:Play},
  {id:'verification',label:'Observability',sub:'Verify live',icon:CheckCircle2},
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
  const[filesDrawerOpen,setFilesDrawerOpen]=useState(false);
  const[fileBrowserOpen,setFileBrowserOpen]=useState(false);
  const[settingsOpen,setSettingsOpen]=useState(false);
  const[settings,setSettings]=useState(()=>loadSettings(project));
  const[advisorForced,setAdvisorForced]=useState(false);
  const askAdvisor=()=>{setAdvisorForced(true);setSidebarOpen(true);getAdvisor();};
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
      const{data:v,error:insErr}=await supabase.from('validations').insert({
        project_id:projectId,workspace_id:wsId,status:'running',trigger:'manual',
      }).select().single();
      if(insErr||!v){console.error('Validation insert failed:',insErr);alert('Could not start validation: '+(insErr?.message||'unknown error'));setRunning(false);return;}
      setValidations(prev=>[v,...prev]);
      try{
        await fetch(`${edgeFunctionUrl}/process-validation`,{
          method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
          body:JSON.stringify({validationId:v.id,projectId,gitUrl:project.git_url,branch:project.git_branch||'main',githubToken:project.github_token||null}),
        });
      }catch(fnErr){console.error('process-validation call failed:',fnErr);}
      await load();
    }catch(e){console.error('runValidation error:',e);}
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
  // ── Deployment policy gate (from Release Settings) ──
  const anyApprovedNow=approvals.some(a=>a.status==='approved');
  const policyReasons=[
    ...(isBlocked?[`${critical.length} critical finding${critical.length!==1?'s':''} must be resolved`]:[]),
    ...(settings.blockOnHigh&&high.length>0?[`${high.length} high-severity finding${high.length!==1?'s':''} block deployment (policy)`]:[]),
    ...(settings.deployGateReadiness>0&&readiness!==null&&readiness<settings.deployGateReadiness?[`Readiness ${readiness}% is below the required ${settings.deployGateReadiness}%`]:[]),
    ...(settings.requireApproval&&!anyApprovedNow?['At least one release approval is required']:[]),
  ];
  const deployGated=policyReasons.length>0;

  // Stage completion status
  // Nothing is "done" until a COMPLETED assessment exists — so every
  // un-assessed project shows the same clean numbered rail (1..6).
  const hasAssessment=validations.some(v=>v.status==='completed');
  const stageStatus:Record<Stage,'done'|'active'|'pending'>=hasAssessment?{
    changes:'done',
    validation:critical.length===0?'done':'active',
    remediation:critical.length===0&&high.length===0?'done':open.length>0?'active':'pending',
    approvals:approvals.some(a=>a.status==='approved')?'done':approvals.length>0?'active':'pending',
    deployment:'pending',
    verification:'pending',
  }:{
    changes:'active',
    validation:'pending',
    remediation:'pending',
    approvals:'pending',
    deployment:'pending',
    verification:'pending',
  };

  return(
    <div className="flex flex-col lg:flex-row h-full" style={{minHeight:'calc(100vh - 130px)'}}>

      {/* ── STAGE NAV — left rail on desktop, horizontal scroller on mobile ── */}
      <div className="w-full lg:w-48 shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gray-50/60 flex flex-row lg:flex-col py-2 lg:py-4 px-2 gap-1.5 lg:gap-1 overflow-x-auto lg:overflow-visible no-scrollbar">
        <p className="hidden lg:block text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mb-2">Release Stages</p>
        {STAGES.map((s,i)=>{
          const st=stageStatus[s.id];
          return(
            <button key={s.id} onClick={()=>setStage(s.id)} className={`shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left border ${stage===s.id?'bg-[#f97316]/10 text-[#c2560c] border-[#fb923c]/40':'border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/60'}`}>
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${stage===s.id?'bg-[#f97316]/80 text-white':st==='done'?'bg-green-500 text-white':'bg-gray-200 text-gray-500'}`}>
                {stage===s.id?i+1:st==='done'?<Check size={11}/>:i+1}
              </div>
              <span className="min-w-0 flex-1">
                <span className="block leading-tight">{s.label}</span>
                <span className={`block text-[10px] font-normal leading-tight ${stage===s.id?'text-[#ea7a00]/80':'text-gray-400'}`}>{s.sub}</span>
              </span>
              {stage===s.id?<span className="w-1.5 h-1.5 rounded-full bg-[#f97316]/80 shrink-0"/>:st==='active'?<span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"/>:null}
            </button>
          );
        })}

        <div className="shrink-0 flex items-center lg:mt-auto border-l lg:border-l-0 lg:border-t border-gray-200 pl-1.5 lg:pl-0 lg:px-1 lg:pt-4">
          <button className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs whitespace-nowrap w-auto lg:w-full text-gray-500 hover:bg-white/60`} onClick={()=>setSettingsOpen(true)}>
            <Settings size={13}/>Settings
          </button>
        </div>
      </div>

      {/* ── CENTER — Main Workspace ──────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto">

        {/* Release Header — always visible */}
        <div className={`sticky top-0 z-20 border-b px-6 py-4 ${isBlocked?'bg-red-50 border-red-200':readiness!==null&&readiness>=80?'bg-green-50 border-green-200':'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h1 className="text-base font-bold text-navy-900 truncate">{project.name}</h1>
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
              <button onClick={()=>setFileBrowserOpen(true)} className="btn-primary text-xs flex items-center gap-1.5"><FolderOpen size={12}/>Edit Files</button>
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

          {/* UNDERSTAND — AI Release Review */}
          {stage==='changes'&&(()=>{
            // ── Decision inputs (all from real data) ──────────────────────
            const blockers=critical.length;
            const needsAttention=high.length;
            const recommendations=open.filter(f=>f.severity==='medium'||f.severity==='low').length;
            const healthy=resolved.length;
            const verdict=validations.length===0?{text:'NOT ASSESSED',tone:'gray'}
              :isBlocked?{text:'DO NOT DEPLOY',tone:'red'}
              :needsAttention>0?{text:'REVIEW REQUIRED',tone:'amber'}
              :readiness!==null&&readiness>=80?{text:'READY TO DEPLOY',tone:'green'}
              :{text:'REVIEW REQUIRED',tone:'amber'};
            const toneCls={red:'text-red-600',amber:'text-amber-600',green:'text-green-600',gray:'text-gray-400'}[verdict.tone];
            const toneBg={red:'bg-red-50 border-red-200',amber:'bg-amber-50 border-amber-200',green:'bg-green-50 border-green-200',gray:'bg-gray-50 border-gray-200'}[verdict.tone];
            const topReason=critical[0]?.title||high[0]?.title||latest?.summary||null;
            const estFixMin=blockers*8+needsAttention*4+recommendations*2;
            const nextStep=validations.length===0?{label:'Run Validation',go:()=>{runValidation();setStage('validation');}}
              :blockers>0?{label:'Resolve blockers',go:()=>setStage('remediation')}
              :needsAttention>0?{label:'Review findings',go:()=>setStage('validation')}
              :{label:'Request approval',go:()=>setStage('approvals')};
            // ── Change areas (from real finding categories) ───────────────
            const areaRisk=(fs)=>fs.some(f=>f.severity==='critical'||f.severity==='high')?{t:'HIGH RISK',c:'text-red-600',bg:'bg-red-50 border-red-200'}
              :fs.some(f=>f.severity==='medium')?{t:'MEDIUM',c:'text-amber-600',bg:'bg-amber-50 border-amber-200'}
              :fs.length>0?{t:'LOW RISK',c:'text-brand-700',bg:'bg-brand-50 border-brand-200'}
              :{t:'SAFE',c:'text-green-600',bg:'bg-green-50 border-green-200'};
            const AREAS=[
              {key:'Code',icon:Code2,match:/code|logic|quality|lint|test|style/i},
              {key:'Infrastructure',icon:Server,match:/infra|terraform|k8s|kubernet|network|cloud|config/i},
              {key:'Dependencies',icon:Package,match:/depend|package|librar|cve|vuln/i},
              {key:'Containers',icon:Layers,match:/container|docker|image/i},
              {key:'Secrets',icon:Lock,match:/secret|credential|password|token|env/i},
            ].map(a=>{const fs=open.filter(f=>a.match.test(f.category||''));return{...a,count:fs.length,risk:areaRisk(fs)};});
            const overallRisk=isBlocked?{t:'HIGH',c:'text-red-600'}:needsAttention>0?{t:'MEDIUM',c:'text-amber-600'}:{t:'LOW',c:'text-green-600'};
            const secretsArea=AREAS.find(a=>a.key==='Secrets'); const infraArea=AREAS.find(a=>a.key==='Infrastructure');
            // ── Decision: recommendation + status checklist ───────────────
            const anyApproved=approvals.some(a=>a.status==='approved');
            const cleanReady=validations.length>0&&!isBlocked&&needsAttention===0&&readiness!==null&&readiness>=80;
            const decision=validations.length===0?{text:'NOT ASSESSED',tone:'gray'}
              :isBlocked?{text:'DO NOT DEPLOY',tone:'red'}
              :needsAttention>0?{text:'REVIEW REQUIRED',tone:'amber'}
              :cleanReady&&anyApproved?{text:'APPROVED',tone:'green'}
              :cleanReady?{text:'READY FOR APPROVAL',tone:'green'}
              :{text:'REVIEW REQUIRED',tone:'amber'};
            const dTone={red:'text-red-600',amber:'text-amber-600',green:'text-green-600',gray:'text-gray-400'}[decision.tone];
            const dBg={red:'bg-red-50 border-red-200',amber:'bg-amber-50 border-amber-200',green:'bg-green-50 border-green-200',gray:'bg-gray-50 border-gray-200'}[decision.tone];
            const checklist=[
              {label:'Validation Passed',ok:validations.length>0&&latest?.status==='completed'&&!isBlocked},
              {label:'Infrastructure Healthy',ok:infraArea?.count===0},
              {label:'No Deployment Blockers',ok:blockers===0},
              {label:'Secrets Verified',ok:secretsArea?.count===0},
            ];
            const pendingLabel=validations.length===0?'Run AI Release Review':blockers>0?'Blocker resolution':needsAttention>0?'Findings review':!anyApproved?'Security approval':null;
            // ── Giant next action ─────────────────────────────────────────
            const nextAction=validations.length===0?{title:'Run AI Release Review',time:'~2 min',cta:'Start Validation',go:()=>{runValidation();setStage('validation');}}
              :blockers>0?{title:`Resolve ${critical[0]?.title||'deployment blocker'}`,time:`~${estFixMin||6} min`,cta:'Generate AI Fix',go:()=>setStage('remediation')}
              :needsAttention>0?{title:'Review flagged findings',time:`~${estFixMin||4} min`,cta:'Review Findings',go:()=>setStage('validation')}
              :!anyApproved?{title:'Request Security Approval',time:'~4 min',cta:'Request Approval',go:()=>{if(approvals.length===0)createRelease();setStage('approvals');}}
              :{title:'Deploy to Production',time:'~3 min',cta:'Deploy',go:()=>setStage('deployment')};
            const watching=connected.map(c=>c.name||c.type).filter(Boolean).slice(0,3);
            // ── Briefing narrative ────────────────────────────────────────
            const hr=new Date().getHours();
            const greeting=hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
            const firstName=(profile?.full_name||profile?.email||'').split(/[@ ]/)[0];
            const codeArea=AREAS.find(a=>a.key==='Code'); const depsArea=AREAS.find(a=>a.key==='Dependencies'); const contArea=AREAS.find(a=>a.key==='Containers');
            const briefLines=[
              {ok:(codeArea?.count||0)===0,text:'Code quality looks healthy.',bad:`${codeArea?.count} code issue${codeArea?.count===1?'':'s'} to review.`},
              {ok:(infraArea?.count||0)===0,text:'Infrastructure matches production.',bad:`${infraArea?.count} infrastructure issue${infraArea?.count===1?'':'s'} flagged.`},
              {ok:(infraArea?.count||0)===0,text:'No configuration drift detected.',bad:'Configuration drift detected.'},
              {ok:(contArea?.count||0)===0,text:'Container images passed verification.',bad:`${contArea?.count} container issue${contArea?.count===1?'':'s'} found.`},
              {ok:(secretsArea?.count||0)===0,text:'Secrets are secure.',bad:`${secretsArea?.count} secret issue${secretsArea?.count===1?'':'s'} detected.`},
              {ok:true,text:'Rollback is available.',bad:'Rollback is available.'},
            ];
            // Evidence the AI used
            const evidence=[
              {src:'GitHub',val:`${latest?.total_findings??0} findings analyzed`,ok:true},
              {src:'Kubernetes',val:(infraArea?.count||0)===0?'Healthy':`${infraArea?.count} flagged`,ok:(infraArea?.count||0)===0},
              {src:'Terraform',val:(infraArea?.count||0)===0?'No drift':'Drift detected',ok:(infraArea?.count||0)===0},
              {src:'Dependencies',val:(depsArea?.count||0)===0?'Verified':`${depsArea?.count} flagged`,ok:(depsArea?.count||0)===0},
              {src:'Docker',val:(contArea?.count||0)===0?'Verified':`${contArea?.count} flagged`,ok:(contArea?.count||0)===0},
              {src:'Policies',val:anyApproved?'Satisfied':'1 approval missing',ok:anyApproved},
            ];
            // Blockers requiring attention (real findings + governance)
            const attention=[
              ...critical.map(f=>({title:f.title,owner:'Platform Team',risk:'High',action:'Generate AI Fix',go:()=>setStage('remediation')})),
              ...high.slice(0,3).map(f=>({title:f.title,owner:'Engineering',risk:'Medium',action:'Review finding',go:()=>setStage('validation')})),
              ...(!anyApproved&&validations.length>0&&!isBlocked?[{title:'Security approval not received',owner:'Platform Team',risk:'Blocking',action:'Request Approval',go:()=>{if(approvals.length===0)createRelease();setStage('approvals');}}]:[]),
            ];
            // Compact change list
            const changed=[
              {n:codeArea?.count||0,label:'code issues flagged'},
              {n:depsArea?.count||0,label:'dependencies flagged'},
              {n:infraArea?.count||0,label:'infrastructure changes'},
              {n:contArea?.count||0,label:'container image'},
              {n:secretsArea?.count||0,label:'secret changes'},
            ];
            // ── Project Overview (pre-assessment reality) ─────────────────
            const isConn=(...s:string[])=>connected.some(c=>s.includes(c.source));
            const hasRepo=!!project.git_url||isConn('github','gitlab','bitbucket');
            const overview=[
              {k:'Repository',icon:GitBranch,ok:hasRepo},
              {k:'Environment',icon:Server,ok:isConn('kubernetes','aws','gcp','azure')},
              {k:'Kubernetes',icon:Layers,ok:isConn('kubernetes')},
              {k:'AWS',icon:Server,ok:isConn('aws')},
              {k:'Terraform',icon:Layers,ok:isConn('terraform')},
              {k:'CI/CD',icon:Zap,ok:isConn('github-actions','gitlab-ci','jenkins','circleci')},
            ];
            const connectedCount=overview.filter(o=>o.ok).length;

            return(
            <div className="space-y-5">

              {/* ── Live status strip ────────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {running?(
                  <span className="inline-flex items-center gap-1.5 font-medium text-brand-700"><Loader2 size={12} className="animate-spin"/>Analyzing release… gathering evidence</span>
                ):!latest?(
                  <span className="inline-flex items-center gap-1.5 font-medium text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-gray-400"/>Not yet analyzed</span>
                ):(
                  <span className="inline-flex items-center gap-1.5 font-medium text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>Continuously monitoring</span>
                )}
                {watching.length>0&&<span className="text-gray-500">Watching {watching.join(' · ')}</span>}
                {latest&&<span className="text-gray-400">Last checked {timeAgo(latest.created_at)}</span>}
              </div>

              {/* Discovery always shows the live AI Release Review (decision-first
                  report + continuous change window). The greeting briefing below
                  is retained but no longer shown here. */}
              <RepoDiscovery
                project={project}
                hadFailure={validations.some(v=>v.status==='failed')}
                onRunValidation={()=>{runValidation();setStage('validation');}}
                onConnect={()=>{window.location.href=`/projects/${projectId}`;}}
              />

              {false&&(
                <>
                  {/* ── 1. AI RELEASE BRIEFING (the decision) ────────────── */}
                  <div className={`card border ${dBg}`}>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1.5"><Sparkles size={12}/>AI Release Briefing</p>
                    <h2 className="text-xl font-bold text-navy-900">{greeting}{firstName?`, ${firstName}`:''}.</h2>
                    <p className="text-sm text-gray-600 mt-0.5">Release candidate <span className="font-semibold text-navy-800">{project.name}</span> · {project.git_branch||'main'} → Production. Here's what I found.</p>

                    <ul className="mt-4 space-y-1.5">
                      {briefLines.map((l,i)=>(
                        <li key={i} className="flex items-center gap-2 text-sm">
                          {l.ok?<CheckCircle2 size={16} className="text-green-500 shrink-0"/>:<AlertTriangle size={16} className="text-amber-500 shrink-0"/>}
                          <span className={l.ok?'text-navy-800':'text-amber-800'}>{l.ok?l.text:l.bad}</span>
                        </li>
                      ))}
                    </ul>

                    {attention.length>0&&(
                      <div className="mt-4 rounded-xl bg-white/70 border border-gray-200 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{attention.length===1?'One issue remains':`${attention.length} issues remain`}</p>
                        <p className="text-sm font-semibold text-navy-900">{attention[0].title}.</p>
                      </div>
                    )}

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">Recommendation</div>
                        <div className={`text-lg font-bold ${dTone}`}>{isBlocked||!anyApproved||needsAttention>0?'Do not deploy yet':'Cleared to deploy'}</div>
                        {readiness!==null&&<div className="text-xs text-gray-500 mt-0.5">{readiness}% confidence</div>}
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">Estimated time to release</div>
                        <div className="text-lg font-bold text-navy-900">{nextAction.time}{!anyApproved&&!isBlocked?' after approval':''}</div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200/70 flex flex-wrap items-center gap-2">
                      <button onClick={nextAction.go} className="btn-primary text-sm"><ArrowRight size={14}/>{nextAction.cta}</button>
                      <button onClick={askAdvisor} className="btn-secondary text-sm"><Sparkles size={13}/>Explain Decision</button>
                    </div>
                  </div>

                  {/* ── 2. WHY I MADE THIS RECOMMENDATION (evidence) ─────── */}
                  <div>
                    <h3 className="text-base font-semibold text-navy-900 mb-2">Why I made this recommendation</h3>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                      {evidence.map(e=>(
                        <div key={e.src} className="card !p-3">
                          <div className="text-xs font-semibold text-navy-900">{e.src}</div>
                          <div className={`text-xs mt-1 flex items-center gap-1 ${e.ok?'text-green-600':'text-amber-600'}`}>
                            {e.ok?<Check size={12}/>:<AlertTriangle size={12}/>}{e.val}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Evidence is drawn from the latest analysis. Commit- and package-level detail deepens once a Git provider is linked.</p>
                  </div>

                  {/* ── 3. WHAT REQUIRES YOUR ATTENTION (blockers only) ─── */}
                  <div>
                    <h3 className="text-base font-semibold text-navy-900 mb-2">What requires your attention</h3>
                    {attention.length===0?(
                      <div className="card flex items-center gap-2 text-sm text-green-700 bg-green-50 border-green-200"><CheckCircle2 size={16}/>Nothing is blocking this release.</div>
                    ):(
                      <div className="space-y-2">
                        {attention.map((a,i)=>(
                          <div key={i} className="card flex flex-wrap items-center justify-between gap-3 border-amber-200">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2"><span className={`chip text-[10px] ${a.risk==='Blocking'||a.risk==='High'?'bg-red-50 text-red-700 border border-red-200':'bg-amber-50 text-amber-700 border border-amber-200'}`}>{a.risk}</span><span className="text-sm font-semibold text-navy-900">{a.title}</span></div>
                              <div className="text-xs text-gray-500 mt-1">Owner <span className="text-navy-700 font-medium">{a.owner}</span></div>
                            </div>
                            <button onClick={a.go} className="btn-primary text-xs shrink-0"><ArrowRight size={13}/>{a.action}</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── 4. WHAT CHANGED (compact) ────────────────────────── */}
                  <div>
                    <h3 className="text-sm font-semibold text-navy-900 mb-2">What changed</h3>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
                      {changed.map((c,i)=>(<span key={i}>{c.n===0&&(c.label==='secret changes')?'No secret changes':`${c.n} ${c.label}`}</span>))}
                    </div>
                  </div>

                  {/* ── 5. AFTER DEPLOYMENT (confidence) ─────────────────── */}
                  <div>
                    <h3 className="text-sm font-semibold text-navy-900 mb-2">What happens after deployment</h3>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                      {[
                        {k:'Rollback Ready',v:'Yes',c:'text-green-600'},
                        {k:'Last Stable',v:latest?.commit_sha?latest.commit_sha.slice(0,7):'—',c:'text-navy-900'},
                        {k:'Est. Rollback',v:'~90 sec',c:'text-navy-900'},
                        {k:'Monitoring',v:'Enabled',c:'text-green-600'},
                      ].map(x=>(
                        <div key={x.k} className="card !p-3"><div className="text-xs uppercase tracking-wide text-gray-400">{x.k}</div><div className={`text-base font-bold ${x.c}`}>{x.v}</div></div>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">After deploy, Lythouse verifies deployment health automatically and can roll back to the last stable version.</p>
                  </div>

                  {/* ── Technical details — secondary ────────────────────── */}
                  <details className="card group">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <div className="flex items-center gap-2"><FolderOpen size={16} className="text-gray-400"/><span className="text-sm font-semibold text-navy-900">Technical details — repository files</span></div>
                      <ChevronDown size={16} className="text-gray-400 group-open:rotate-180 transition-transform"/>
                    </summary>
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      <div className="flex justify-end"><button onClick={()=>setEditorOpen(true)} className="btn-secondary text-xs flex items-center gap-1.5"><Code2 size={12}/>Open Editor</button></div>
                      <FileExplorer projectId={projectId} project={project} openFilePath={editorPath} highlightLine={null} onHighlightConsumed={()=>{}}/>
                    </div>
                  </details>
                </>
              )}
            </div>
            );
          })()}

          {/* VALIDATION */}
          {stage==='validation'&&(
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-navy-900 mb-1">Production-Readiness Validation</h2>
                  <p className="text-sm text-gray-500">Line-level checks across infrastructure, containers, Kubernetes, secrets, dependencies and governance — with a simulated deployment.</p>
                </div>
                <button onClick={runValidation} disabled={running} className="btn-secondary text-sm shrink-0">
                  {running?<><Loader2 size={13} className="animate-spin"/>Re-scanning…</>:<><RefreshCw size={13}/>Re-run backend scan</>}
                </button>
              </div>
              <ValidationReport project={project} scanHistory={validations} onRemediate={()=>setStage('remediation')} onApprovals={()=>setStage('approvals')}/>
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

              {/* what this stage is for */}
              <div className="card border-brand-200 bg-brand-50/50">
                <p className="text-sm font-semibold text-navy-900 flex items-center gap-1.5"><Users size={14} className="text-brand-600"/>Why this stage exists</p>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  Validation proves the release is <em>technically</em> safe; Governance is the <span className="font-medium text-navy-800">human sign-off</span> that it's a business-approved decision. Before code ships to production, the accountable teams each confirm the release is ready from their angle — so no single person can push to prod alone, and there's an auditable record of who approved what and when.
                </p>
                <div className="grid gap-2 sm:grid-cols-3 mt-3">
                  {[
                    {t:'Platform Engineering',d:'Confirms infrastructure, capacity and the deployment path are ready.'},
                    {t:'Security Team',d:'Confirms no unresolved security or compliance risk is shipping.'},
                    {t:'Product Management',d:'Confirms the change is the right thing to release to customers now.'},
                  ].map(x=>(
                    <div key={x.t} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-navy-800">{x.t}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{x.d}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-3">How it works: request approval to open a sign-off record, each team presses <span className="font-medium text-navy-700">Approve</span> (logged with their name and timestamp) or rejects with a reason. Once all three approve, the release is cleared and Deployment unlocks. You can make an approval mandatory to deploy in <span className="font-medium text-navy-700">Settings → Deployment policy</span>.</p>
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
              <div className={`card border-2 text-center py-12 ${deployGated?'border-red-200':'border-gray-200'}`}>
                {deployGated?(
                  <>
                    <XCircle size={32} className="mx-auto text-red-400 mb-3"/>
                    <p className="text-sm font-semibold text-red-700 mb-1">Deployment Blocked by Policy</p>
                    <ul className="text-xs text-red-600 mb-4 inline-block text-left space-y-0.5">
                      {policyReasons.map((r,i)=>(<li key={i} className="flex items-start gap-1.5"><XCircle size={11} className="shrink-0 mt-0.5"/>{r}</li>))}
                    </ul>
                    <div><button onClick={()=>setStage(isBlocked||(settings.blockOnHigh&&high.length>0)?'remediation':'approvals')} className="btn-primary text-sm flex items-center gap-2 mx-auto"><Zap size={13}/>{isBlocked||(settings.blockOnHigh&&high.length>0)?'Fix Issues First':'Resolve Requirements'} →</button></div>
                    <p className="text-[11px] text-gray-400 mt-3">These gates come from Release Settings — adjust them via Settings if they don't match your policy.</p>
                  </>
                ):(
                  <>
                    <Play size={32} className="mx-auto text-green-400 mb-3"/>
                    <p className="text-sm font-semibold text-green-700 mb-1">Ready to Deploy</p>
                    <p className="text-xs text-gray-500 mb-4">All release policy gates are satisfied. Connect your CI/CD pipeline in Environment → Assets to trigger deployments from LytHouse and see real-time build logs here.</p>
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
      {sidebarOpen&&(stage!=='changes'||advisorForced)&&(
        <div className="w-72 shrink-0 border-l border-gray-100 bg-gray-50/30 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Sparkles size={11}/>AI Release Advisor</span>
            <button onClick={()=>{setSidebarOpen(false);setAdvisorForced(false);}} className="text-gray-400 hover:text-gray-600 p-1"><X size={14}/></button>
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

      {!sidebarOpen&&stage!=='changes'&&(
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
      {fileBrowserOpen&&<FileBrowser project={project} onClose={()=>setFileBrowserOpen(false)}/>}
      {settingsOpen&&<WorkspaceSettings project={project} onClose={()=>setSettingsOpen(false)} onSaved={({repoChanged})=>{setSettings(loadSettings(project));if(repoChanged)load();}}/>}
    </div>
  );
}
