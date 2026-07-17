import{useEffect,useState,useRef}from'react';
import{useRouter}from'../lib/router';
import{supabase,type Project,type Validation,type ValidationStep,type Finding,type Severity}from'../lib/supabase';
import{PageHeader,Spinner,EmptyState,StatusBadge,SeverityBadge,FindingStatusBadge,RiskGauge,Breadcrumb,timeAgo,fmtDuration}from'../lib/ui';
import{FolderGit2,GitFork,GitBranch,Code,Boxes,ShieldCheck,ShieldAlert,ChevronDown,ChevronRight,Save,Check,Loader as Loader2,FileSearch,Settings as Cog,Sparkles,Play,AlertTriangle,RefreshCw,Network,Package,FlaskConical,Gauge,GitMerge,FolderOpen,Code2}from'lucide-react';
import AIAssistantTab from'./AIAssistantTab';
import{FindingsTab}from'./FindingsTab';
import{ReadinessTab}from'./ReadinessTab';
import{TopologyView}from'./TopologyView';
import{DryRunTab}from'./DryRunTab';
import{DependenciesTab}from'./DependenciesTab';
import{DriftTab}from'./DriftTab';
import{FileExplorer}from'./FileExplorer';
import{CodeEditorPanel}from'./CodeEditorPanel';

type Tab='validations'|'findings'|'readiness'|'topology'|'dependencies'|'simulator'|'ai-assistant'|'files'|'settings';
const TABS:{id:Tab;label:string;icon:typeof ShieldCheck;group:string}[]=[
{id:'files',label:'Files',icon:FolderOpen,group:'Repository'},
{id:'validations',label:'Validations',icon:ShieldCheck,group:'Security'},
{id:'findings',label:'Findings',icon:ShieldAlert,group:'Security'},
{id:'readiness',label:'Readiness',icon:Gauge,group:'Security'},
{id:'dependencies',label:'Dependencies',icon:Package,group:'Security'},
{id:'topology',label:'Topology',icon:Network,group:'Intelligence'},
{id:'simulator',label:'Simulator',icon:FlaskConical,group:'Intelligence'},
{id:'ai-assistant',label:'AI Assistant',icon:Sparkles,group:'Intelligence'},
{id:'settings',label:'Settings',icon:Cog,group:'Config'},
];
const SEV_ORDER:Severity[]=['critical','high','medium','low'];
const SEV_FILTER:(Severity|'all')[]=['all',...SEV_ORDER];

const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function ProjectWorkspace({projectId}:{projectId:string}){
const{navigate}=useRouter();
const[loading,setLoading]=useState(true);
const[project,setProject]=useState<Project|null>(null);
const[tab,setTab]=useState<Tab>('files');
const[validations,setValidations]=useState<Validation[]>([]);
const[stepsByVid,setStepsByVid]=useState<Record<string,ValidationStep[]>>({});
const[expandedVid,setExpandedVid]=useState<string|null>(null);
const[findings,setFindings]=useState<Finding[]>([]);
const[sevFilter,setSevFilter]=useState<Severity|'all'>('all');
const[saving,setSaving]=useState(false);
const[saved,setSaved]=useState(false);
const[form,setForm]=useState({name:'',description:'',git_url:'',git_branch:'',language:'',framework:''});
const[running,setRunning]=useState(false);
const[openFilePath,setOpenFilePath]=useState<string|null>(null);
const[highlightLine,setHighlightLine]=useState<number|null>(null);
const[editorOpen,setEditorOpen]=useState(false);
const[findingContext,setFindingContext]=useState<{title:string;recommendation:string;line?:number;file?:string}|null>(null);
const[runError,setRunError]=useState('');
const[activeRunId,setActiveRunId]=useState<string|null>(null);
const pollRef=useRef<ReturnType<typeof setInterval>|null>(null);

const load=async()=>{
  setLoading(true);
  const[pRes,vRes,fRes]=await Promise.all([
    supabase.from('projects').select('*').eq('id',projectId).single(),
    supabase.from('validations').select('*').eq('project_id',projectId).order('created_at',{ascending:false}),
    supabase.from('findings').select('*').eq('project_id',projectId).order('created_at',{ascending:false}),
  ]);
  if(pRes.error){console.error('ProjectWorkspace load project:',pRes.error);setLoading(false);return;}
  setProject(pRes.data);
  setForm({
    name:pRes.data.name??'',description:pRes.data.description??'',
    git_url:pRes.data.git_url??'',git_branch:pRes.data.git_branch??'main',
    language:pRes.data.language??'',framework:pRes.data.framework??'',
  });
  setValidations(vRes.data??[]);
  setFindings(fRes.data??[]);
  setLoading(false);
};

const toggleVid=async(vid:string)=>{
  if(expandedVid===vid){setExpandedVid(null);return;}
  setExpandedVid(vid);
  if(!stepsByVid[vid]){
    const{data}=await supabase.from('validation_steps').select('*').eq('validation_id',vid).order('step_index',{ascending:true});
    setStepsByVid(prev=>({...prev,[vid]:data??[]}));
  }
};

const pollValidation=async(validationId:string)=>{
  const{data:v}=await supabase.from('validations').select('*').eq('id',validationId).single();
  if(!v)return;
  setValidations(prev=>prev.map(x=>x.id===validationId?v:x));
  // Also refresh steps if expanded
  const{data:steps}=await supabase.from('validation_steps').select('*').eq('validation_id',validationId).order('step_index',{ascending:true});
  if(steps)setStepsByVid(prev=>({...prev,[validationId]:steps}));
  if(v.status==='completed'||v.status==='failed'){
    if(pollRef.current)clearInterval(pollRef.current);
    setRunning(false);
    setActiveRunId(null);
    // Refresh findings
    const{data:fRes}=await supabase.from('findings').select('*').eq('project_id',projectId).order('created_at',{ascending:false});
    setFindings(fRes??[]);
    if(v.status==='completed'){setTab('validations');}
  }
};

const runValidation=async()=>{
  if(!project)return;
  if(!project.git_url){setRunError('This project has no Git URL configured. Add one in Settings.');return;}
  if(!project.github_token){setRunError('No GitHub Personal Access Token configured for this project. Edit the project in Settings to add one.');return;}
  setRunning(true);setRunError('');

  // Create a validation record
  const wid=localStorage.getItem('sandbox.activeWs');
  const{data:v,error:vErr}=await supabase.from('validations').insert({
    project_id:projectId,
    workspace_id:wid,
    status:'pending',
    trigger:'manual',
    total_findings:0,
    critical_count:0,
    high_count:0,
    medium_count:0,
    low_count:0,
  }).select().single();

  if(vErr||!v){
    setRunError('Failed to create validation record: '+(vErr?.message??'unknown error'));
    setRunning(false);
    return;
  }

  // Add to list immediately so user sees it
  setValidations(prev=>[v,...prev]);
  setExpandedVid(v.id);
  setActiveRunId(v.id);
  setTab('validations');

  // Call the edge function
  try{
    const res=await fetch(`${SUPABASE_URL}/functions/v1/process-validation`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${SUPABASE_ANON_KEY}`,
        'apikey':SUPABASE_ANON_KEY,
      },
      body:JSON.stringify({validationId:v.id}),
    });

    if(!res.ok){
      const errText=await res.text();
      console.error('Edge function error:',errText);
      // Still poll — the function may have updated the validation status itself
    }
  }catch(e:any){
    console.error('Failed to call edge function:',e);
    setRunError('Could not reach the validation service. Check your internet connection.');
    setRunning(false);
    return;
  }

  // Poll every 2 seconds for status updates
  pollRef.current=setInterval(()=>pollValidation(v.id),2000);
};

const save=async()=>{
  if(!project)return;
  setSaving(true);setSaved(false);
  const{error}=await supabase.from('projects').update({
    name:form.name.trim(),description:form.description.trim()||null,
    git_url:form.git_url.trim()||null,git_branch:form.git_branch.trim()||'main',
    language:form.language.trim()||null,framework:form.framework.trim()||null,
  }).eq('id',project.id);
  if(error){console.error('ProjectWorkspace save:',error);setSaving(false);return;}
  setProject({...project,
    name:form.name.trim(),description:form.description.trim()||null,
    git_url:form.git_url.trim(),git_branch:form.git_branch.trim(),
    language:form.language.trim()||null,framework:form.framework.trim()||null,
  });
  setSaving(false);setSaved(true);
  setTimeout(()=>setSaved(false),2500);
};

useEffect(()=>{load();},[projectId]);
useEffect(()=>()=>{if(pollRef.current)clearInterval(pollRef.current);},[]);

if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;
if(!project)return<EmptyState icon={<FolderGit2 size={22}/>} title="Project not found" description="This project may have been deleted or you lack access."/>;

const filteredFindings=sevFilter==='all'?findings:findings.filter(f=>f.severity===sevFilter);
const hasToken=!!(project as any).github_token;
const hasGitUrl=!!project.git_url;

return<div>
<PageHeader title={project.name} description={project.description??'No description provided.'}
  breadcrumb={<Breadcrumb items={[{label:'Projects',to:'/projects'},{label:project.name}]}/>}
  actions={
    <div className="flex items-center gap-2">
      <span className="chip bg-brand-50 text-brand-700 border border-brand-200 capitalize">{project.status}</span>
      <button
        onClick={runValidation}
        disabled={running}
        className="btn-primary flex items-center gap-1.5"
        title={!hasGitUrl?'Add a Git URL in Settings first':!hasToken?'Add a GitHub token in Settings first':'Run validation now'}
      >
        {running
          ?<><Loader2 size={15} className="animate-spin"/>Running…</>
          :<><Play size={15}/>Run Validation</>
        }
      </button>
    </div>
  }/>

{/* Run error banner */}
{runError&&(
  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
    <AlertTriangle size={16} className="shrink-0 text-danger-600 mt-0.5"/>
    <div className="flex-1 text-sm text-danger-600">{runError}</div>
    <button onClick={()=>setRunError('')} className="text-red-400 hover:text-danger-600 text-xs">Dismiss</button>
  </div>
)}

{/* Missing config warning */}
{(!hasGitUrl||!hasToken)&&(
  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
    <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5"/>
    <p className="text-sm text-amber-800">
      {!hasGitUrl&&!hasToken?'This project needs a Git URL and GitHub Personal Access Token to run validations.':
       !hasGitUrl?'Add a Git URL in Settings to enable validation.':
       'Add a GitHub Personal Access Token in Settings to enable validation.'}
      {' '}<button onClick={()=>setTab('settings')} className="underline font-medium">Open Settings →</button>
    </p>
  </div>
)}

{/* Active run status bar */}
{running&&activeRunId&&(
  <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
    <Loader2 size={15} className="animate-spin text-brand-600 shrink-0"/>
    <p className="text-sm text-brand-700 font-medium">Validation running — scanning your repository…</p>
    <span className="ml-auto text-xs text-brand-500">Updating live</span>
  </div>
)}

{/* Metadata — hide on full-screen tabs */}
{tab!=='ai-assistant'&&tab!=='files'&&<div className="card mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <Meta icon={<GitFork size={14}/>} label="Git URL" value={project.git_url||'—'}/>
  <Meta icon={<GitBranch size={14}/>} label="Branch" value={project.git_branch||'—'}/>
  <Meta icon={<Code size={14}/>} label="Language" value={project.language||'—'}/>
  <Meta icon={<Boxes size={14}/>} label="Framework" value={project.framework||'—'}/>
  <Meta icon={<FolderGit2 size={14}/>} label="Created" value={new Date(project.created_at).toLocaleDateString()}/>
  <Meta icon={<ShieldCheck size={14}/>} label="Status" value={<span className="capitalize">{project.status}</span>}/>
</div>}

{/* Tabs */}
<div className="mb-5 flex gap-1 border-b border-gray-200">
{TABS.map(t=>(
  <button key={t.id} onClick={()=>setTab(t.id)} className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab===t.id?'tab-active':'tab-inactive'}`}>
    <t.icon size={15}/>{t.label}
    {t.id==='findings'&&findings.length>0&&<span className="ml-1 rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{findings.length}</span>}
  </button>
))}
</div>

{tab==='validations'&&(
  <div className="space-y-5">
    {/* Deployment decision — the only thing that matters */}
    <div className={`rounded-2xl border-2 px-6 py-5 ${
      running?'border-brand-300 bg-brand-50':
      validations.length===0?'border-gray-200 bg-gray-50':
      validations[0]?.critical_count>0?'border-red-300 bg-red-50':
      validations[0]?.high_count>0?'border-amber-300 bg-amber-50':
      validations[0]?.status==='completed'?'border-green-300 bg-green-50':
      'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-black ${
            running?'bg-brand-100 text-brand-600':
            validations.length===0?'bg-gray-100 text-gray-400':
            validations[0]?.critical_count>0?'bg-red-100 text-danger-600':
            validations[0]?.high_count>0?'bg-amber-100 text-amber-600':
            validations[0]?.status==='completed'?'bg-green-100 text-green-600':
            'bg-gray-100 text-gray-400'
          }`}>
            {running?'⟳':validations.length===0?'–':
             validations[0]?.critical_count>0?'⛔':
             validations[0]?.high_count>0?'⚠':
             validations[0]?.status==='completed'?'✓':'–'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy-900">
              {running?'Scanning your repository…':
               validations.length===0?'No scans yet':
               validations[0]?.critical_count>0?'Do not deploy — critical issues found':
               validations[0]?.high_count>0?`Review before deploying — ${validations[0].high_count} high severity issue${validations[0].high_count!==1?'s':''}`:
               validations[0]?.status==='completed'?'Safe to deploy — all checks passed':
               validations[0]?.status==='failed'?'Scan failed':'Scanning…'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {running?'Checking for secrets, vulnerabilities, and security issues across all files.':
               validations.length===0?'Run a scan to find security issues, exposed secrets, and vulnerable dependencies before deploying.':
               validations[0]?.critical_count>0?`Found ${validations[0].critical_count} critical issue${validations[0].critical_count!==1?'s':''} that must be fixed before this code goes to production. Go to Findings to resolve them.`:
               validations[0]?.high_count>0?`Found ${validations[0].high_count} high-severity issue${validations[0].high_count!==1?'s':''}. Review and resolve in the Findings tab before deploying to production.`:
               validations[0]?.status==='completed'?`Scanned ${validations[0].total_findings===0?'all files':'all files'} — no issues blocking deployment. Risk score: ${validations[0].risk_score??'—'}/100.`:
               'Scan in progress…'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {validations[0]?.risk_score!==null&&validations.length>0&&<RiskGauge score={validations[0]?.risk_score} size={72}/>}
          <div className="flex gap-2">
            {validations.length>0&&validations[0]?.total_findings>0&&(
              <button onClick={()=>setTab('findings')} className="btn-primary text-sm">View findings →</button>
            )}
            <button onClick={runValidation} disabled={running} className="btn-secondary text-sm">
              {running?<><RefreshCw size={14} className="animate-spin"/>Scanning…</>:<><Play size={14}/>{validations.length>0?'Re-scan':'Run scan'}</>}
            </button>
          </div>
        </div>
      </div>

      {/* What was scanned */}
      {validations.length>0&&validations[0]?.summary&&(
        <div className="mt-4 pt-4 border-t border-black/10">
          <p className="text-sm text-gray-600 italic">"{validations[0].summary}"</p>
        </div>
      )}
    </div>

    {/* Findings breakdown — only show if there are findings */}
    {validations.length>0&&validations[0]?.total_findings>0&&(
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {label:'Critical',count:validations[0].critical_count,color:'text-danger-600',bg:'bg-red-50',border:'border-red-200',action:()=>{setSevFilter('critical' as any);setTab('findings');}},
          {label:'High',count:validations[0].high_count,color:'text-amber-600',bg:'bg-amber-50',border:'border-amber-200',action:()=>{setSevFilter('high' as any);setTab('findings');}},
          {label:'Medium',count:validations[0].medium_count,color:'text-blue-600',bg:'bg-blue-50',border:'border-blue-200',action:()=>{setSevFilter('medium' as any);setTab('findings');}},
          {label:'Low',count:validations[0].low_count,color:'text-gray-600',bg:'bg-gray-50',border:'border-gray-200',action:()=>{setSevFilter('low' as any);setTab('findings');}},
        ].map(s=>(
          <button key={s.label} onClick={s.action} className={`card border ${s.border} ${s.bg} hover:shadow-md transition-all text-left`}>
            <div className={`text-3xl font-black tabular-nums ${s.color}`}>{s.count}</div>
            <div className="text-xs font-semibold text-gray-500 mt-1">{s.label} severity</div>
            {s.count>0&&<div className="text-xs text-gray-400 mt-0.5">Click to view →</div>}
          </button>
        ))}
      </div>
    )}

    {/* What to do next — clear action plan */}
    {validations.length>0&&validations[0]?.status==='completed'&&(
      <div className="card">
        <h3 className="text-sm font-semibold text-navy-900 mb-3">What to do next</h3>
        <div className="space-y-2">
          {validations[0].critical_count>0&&(
            <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <span className="text-danger-600 font-bold text-sm shrink-0">1.</span>
              <div>
                <p className="text-sm font-semibold text-danger-600">Fix {validations[0].critical_count} critical issue{validations[0].critical_count!==1?'s':''} immediately</p>
                <p className="text-xs text-red-600/70 mt-0.5">Critical findings are deployment blockers. Open the Findings tab, expand each critical finding, use "Generate Fix" to get AI-written code fixes, apply them, then re-scan.</p>
                <button onClick={()=>setTab('findings')} className="mt-2 text-xs font-semibold text-danger-600 underline">Go to Findings →</button>
              </div>
            </div>
          )}
          {validations[0].high_count>0&&(
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <span className="text-amber-600 font-bold text-sm shrink-0">{validations[0].critical_count>0?'2.':'1.'}</span>
              <div>
                <p className="text-sm font-semibold text-amber-700">Review {validations[0].high_count} high-severity issue{validations[0].high_count!==1?'s':''}</p>
                <p className="text-xs text-amber-600/70 mt-0.5">High findings should be fixed before deploying to production. Each finding has a recommended fix and an AI-generated code fix you can apply immediately.</p>
                <button onClick={()=>setTab('findings')} className="mt-2 text-xs font-semibold text-amber-700 underline">Review findings →</button>
              </div>
            </div>
          )}
          {validations[0].critical_count===0&&validations[0].high_count===0&&validations[0].total_findings>0&&(
            <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
              <span className="text-blue-600 font-bold text-sm shrink-0">1.</span>
              <div>
                <p className="text-sm font-semibold text-blue-700">Address {validations[0].total_findings} low/medium finding{validations[0].total_findings!==1?'s':''} when possible</p>
                <p className="text-xs text-blue-600/70 mt-0.5">These are not deployment blockers but should be addressed over time to keep your risk score low.</p>
              </div>
            </div>
          )}
          {validations[0].critical_count===0&&validations[0].high_count===0&&(
            <div className="flex items-start gap-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
              <span className="text-green-600 font-bold text-sm shrink-0">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-700">You're clear to deploy</p>
                <p className="text-xs text-green-600/70 mt-0.5">No critical or high-severity issues found. Run the Deployment Simulator for a final pre-flight check before pushing to production.</p>
                <button onClick={()=>setTab('simulator')} className="mt-2 text-xs font-semibold text-green-700 underline">Run simulator →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Scan history */}
    {validations.length>1&&(
      <div className="card">
        <h3 className="text-sm font-semibold text-navy-900 mb-3">Scan history</h3>
        <div className="space-y-1">
          {validations.map((v,i)=>(
            <div key={v.id} onClick={()=>toggleVid(v.id)} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors">
              <StatusBadge status={v.status}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  {v.critical_count>0&&<span className="text-danger-600 font-semibold text-xs">● {v.critical_count} crit</span>}
                  {v.high_count>0&&<span className="text-amber-600 font-semibold text-xs">● {v.high_count} high</span>}
                  {v.critical_count===0&&v.high_count===0&&v.status==='completed'&&<span className="text-green-600 text-xs">✓ Clean</span>}
                  <span className="text-gray-400 text-xs">{timeAgo(v.created_at)} · {fmtDuration(v.duration_ms)}</span>
                </div>
              </div>
              <RiskGauge score={v.risk_score} size={40}/>
            </div>
          ))}
        </div>
      </div>
    )}

    {validations.length===0&&!running&&(
      <div className="card text-center py-10">
        <ShieldCheck size={40} className="mx-auto text-gray-300 mb-3"/>
        <p className="text-sm font-medium text-gray-600 mb-1">No scans have been run yet</p>
        <p className="text-xs text-gray-400 mb-4">Click "Run scan" to check this repository for security issues, exposed secrets, and vulnerable dependencies.</p>
        <button onClick={runValidation} className="btn-primary"><Play size={15}/>Run first scan</button>
      </div>
    )}
  </div>
)}

{tab==='findings'&&(
  <FindingsTab
    projectId={projectId}
    onOpenFile={(path,line,ctx)=>{setOpenFilePath(path);setHighlightLine(line??null);setFindingContext(ctx??null);setEditorOpen(true);}}
    onRunValidation={runValidation}
  />
)}

{tab==='readiness'&&(<ReadinessTab projectId={projectId}/>)}
{tab==='topology'&&project&&(<TopologyView projectId={projectId} project={project} onOpenFile={(path)=>console.log('open',path)}/>)}
{tab==='dependencies'&&(<DependenciesTab projectId={projectId}/>)}
{tab==='simulator'&&(<DryRunTab projectId={projectId} workspaceId={localStorage.getItem('sandbox.activeWs')??''}/>)}
{tab==='ai-assistant'&&(
<AIAssistantTab projectId={projectId} workspaceId={localStorage.getItem('sandbox.activeWs')??''}/>
)}
{tab==='files'&&project&&(
<div>
  <div className="mb-6 flex items-start justify-between">
    <div>
      <div className="flex items-center gap-2 mb-1">
        <FolderOpen size={18} className="text-brand-600"/>
        <h2 className="text-base font-semibold text-navy-900">Repository Files</h2>
        <span className="chip bg-gray-100 text-gray-500 border border-gray-200 text-xs">{project.git_branch||'main'}</span>
      </div>
      <p className="text-sm text-gray-500">Connected to <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{project.git_url}</span></p>
    </div>
    <button onClick={()=>setEditorOpen(true)} className="btn-primary flex items-center gap-2">
      <Code2 size={15}/>Open Code Editor
    </button>
  </div>

  {/* File grid preview */}
  <div className="card">
    <FileExplorer
      projectId={projectId}
      project={project}
      openFilePath={openFilePath}
      highlightLine={highlightLine}
      onHighlightConsumed={()=>setHighlightLine(null)}
    />
  </div>
</div>
)}

{tab==='settings'&&(
  <div className="card max-w-2xl">
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2"><Cog size={18} className="text-brand-600"/><h2 className="text-base font-semibold text-navy-900">Project settings</h2></div>
      <button onClick={save} disabled={saving||!form.name.trim()} className="btn-primary">
        {saving?<Loader2 size={16} className="animate-spin"/>:saved?<Check size={16}/>:<Save size={16}/>} {saved?'Saved':'Save changes'}
      </button>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">Name</label>
        <input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Project name"/>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Description</label>
        <textarea className="input" rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What is this project?"/>
      </div>
      <div>
        <label className="label">Git URL</label>
        <input className="input" value={form.git_url} onChange={e=>setForm({...form,git_url:e.target.value})} placeholder="https://github.com/org/repo"/>
      </div>
      <div>
        <label className="label">Git branch</label>
        <input className="input" value={form.git_branch} onChange={e=>setForm({...form,git_branch:e.target.value})} placeholder="main"/>
      </div>
      <div>
        <label className="label">Language</label>
        <input className="input" value={form.language} onChange={e=>setForm({...form,language:e.target.value})} placeholder="TypeScript"/>
      </div>
      <div>
        <label className="label">Framework</label>
        <input className="input" value={form.framework} onChange={e=>setForm({...form,framework:e.target.value})} placeholder="React"/>
      </div>
    </div>
  </div>
)}
{editorOpen&&project&&(
<CodeEditorPanel
  projectId={projectId}
  project={project}
  initialFile={openFilePath}
  initialLine={highlightLine}
  findingContext={findingContext}
  onClose={()=>{setEditorOpen(false);setFindingContext(null);}}
/>
)}
{editorOpen&&project&&(
<CodeEditorPanel
  projectId={projectId}
  project={project}
  initialFile={openFilePath}
  initialLine={highlightLine}
  findingContext={findingContext}
  onClose={()=>{setEditorOpen(false);setFindingContext(null);}}
/>
)}
</div>;
}

function Meta({icon,label,value}:{icon:React.ReactNode;label:string;value:React.ReactNode}){
return<div className="flex items-start gap-2.5">
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400">{icon}</div>
  <div className="min-w-0">
    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
    <p className="mt-0.5 truncate text-sm font-medium text-navy-900">{value}</p>
  </div>
</div>;
}
