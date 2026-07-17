import{useEffect,useState,useRef}from'react';
import{useRouter}from'../lib/router';
import{supabase,type Project,type Validation,type ValidationStep,type Finding,type Severity}from'../lib/supabase';
import{PageHeader,Spinner,EmptyState,StatusBadge,SeverityBadge,FindingStatusBadge,RiskGauge,Breadcrumb,timeAgo,fmtDuration}from'../lib/ui';
import{FolderGit2,GitFork,GitBranch,Code,Boxes,ShieldCheck,ShieldAlert,ChevronDown,ChevronRight,Save,Check,Loader as Loader2,FileSearch,Settings as Cog,Sparkles,Play,AlertTriangle,RefreshCw,Network,Package,FlaskConical,Gauge,GitMerge,FolderOpen,Code2,Activity,BarChart3}from'lucide-react';
import AIAssistantTab from'./AIAssistantTab';
import{DeploymentCenter}from'./DeploymentCenter';
import{ReleaseApprovalCenter}from'./ReleaseApprovalCenter';
import{ReleaseWarRoom}from'./ReleaseWarRoom';
import{ReleaseHistoryTab}from'./ReleaseHistoryTab';
import{FindingsTab}from'./FindingsTab';
import{ReadinessTab}from'./ReadinessTab';
import{TopologyView}from'./TopologyView';
import{DryRunTab}from'./DryRunTab';
import{DependenciesTab}from'./DependenciesTab';
import{DriftTab}from'./DriftTab';
import{FileExplorer}from'./FileExplorer';
import{CodeEditorPanel}from'./CodeEditorPanel';

type Tab='deployment'|'approvals'|'war-room'|'history'|'readiness'|'topology'|'dependencies'|'simulator'|'ai-assistant'|'files'|'settings';
const TABS:{id:Tab;label:string;icon:typeof ShieldCheck;group:string}[]=[
{id:'files',label:'Files',icon:FolderOpen,group:'Repository'},
{id:'deployment',label:'Deployment Center',icon:ShieldCheck,group:'Release'},
{id:'approvals',label:'Approvals',icon:ShieldAlert,group:'Release'},
{id:'war-room',label:'War Room',icon:Activity,group:'Release'},
{id:'history',label:'Release History',icon:BarChart3,group:'Release'},
{id:'readiness',label:'Readiness',icon:Gauge,group:'Release'},
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
const[creatorName,setCreatorName]=useState<string>('');
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
    if(v.status==='completed'){setTab('deployment');}
  }
};

const runValidation=async()=>{
  if(!project)return;
  if(!project.git_url){setRunError('This project has no Git URL configured. Add one in Settings.');return;}
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
  setTab('deployment');

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
{!hasGitUrl&&(
  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
    <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5"/>
    <p className="text-sm text-amber-800">
      {!hasGitUrl?'Add a Git URL in Settings to enable validation.':
       'Add a Git URL in Settings to connect your repository.'}
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
  <Meta icon={<GitFork size={14}/>} label="Git URL" value={<span className="truncate font-mono text-xs">{project.git_url||'—'}</span>}/>
  <Meta icon={<GitBranch size={14}/>} label="Branch" value={project.git_branch||'main'}/>
  <Meta icon={<Code size={14}/>} label="Language" value={project.language||(validations.find(v=>v.status==='completed')?.summary?.match(/language[:\s]+(\w+)/i)?.[1])||'Auto-detecting…'}/>
  <Meta icon={<Boxes size={14}/>} label="Framework" value={project.framework||'—'}/>
  <Meta icon={<FolderGit2 size={14}/>} label="Owner" value={creatorName||'—'}/>
  <Meta icon={<ShieldCheck size={14}/>} label="Status" value={<span className="capitalize text-green-600 font-semibold">{project.status}</span>}/>
</div>}

{/* Tabs */}
<div className="mb-5 border-b border-gray-200">
<div className="flex items-end gap-0 flex-wrap">
{[
  {label:'Files',tabs:TABS.filter(t=>t.group==='Repository')},
  {label:'Release',tabs:TABS.filter(t=>t.group==='Release')},
  {label:'Security',tabs:TABS.filter(t=>t.group==='Security')},
  {label:'Intelligence',tabs:TABS.filter(t=>t.group==='Intelligence')},
  {label:'Settings',tabs:TABS.filter(t=>t.group==='Config')},
].filter(g=>g.tabs.length>0).map(g=>{
  const active=g.tabs.find(t=>t.id===tab);
  const isActive=!!active;
  if(g.tabs.length===1){
    const t=g.tabs[0];
    return<button key={t.id} onClick={()=>setTab(t.id)} className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab===t.id?'tab-active':'tab-inactive'}`}><t.icon size={14}/>{t.label}</button>;
  }
  return<div key={g.label} className="relative group/dd">
    <button className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${isActive?'tab-active':'tab-inactive'}`}>
      {active?<active.icon size={14}/>:<g.tabs[0].icon size={14}/>}
      {isActive?active?.label:g.label}
      <ChevronDown size={11} className="opacity-50"/>
    </button>
    <div className="absolute left-0 top-full z-40 hidden group-hover/dd:block bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 min-w-[200px]">
      {g.tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${tab===t.id?'text-brand-600 font-semibold bg-brand-50':'text-gray-700'}`}>
        <t.icon size={14} className={tab===t.id?'text-brand-600':'text-gray-400'}/>{t.label}
        {tab===t.id&&<Check size={12} className="ml-auto text-brand-600"/>}
      </button>)}
    </div>
  </div>;
})}
</div>

{tab==='deployment'&&project&&(
<DeploymentCenter
  projectId={projectId}
  project={project}
  onRunValidation={runValidation}
  onOpenFile={(path,line)=>{setOpenFilePath(path);setHighlightLine(line??null);setFindingContext(null);setEditorOpen(true);}}
  running={running}
/>
)}
{tab==='readiness'&&(<ReadinessTab projectId={projectId}/>)}
{tab==='topology'&&project&&(<TopologyView projectId={projectId} project={project} onOpenFile={(path)=>{setOpenFilePath(path);setHighlightLine(null);setFindingContext(null);setEditorOpen(true);}}/>)}
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

{tab==='approvals'&&project&&(
<ReleaseApprovalCenter
  projectId={projectId}
  workspaceId={localStorage.getItem('sandbox.activeWs')??''}
  validationId={validations[0]?.id??null}
  latestRiskScore={validations.find(v=>v.status==='completed')?.risk_score??null}
/>
)}
{tab==='war-room'&&project&&(
<ReleaseWarRoom
  projectId={projectId}
  workspaceId={localStorage.getItem('sandbox.activeWs')??''}
  project={project}
  onRunValidation={runValidation}
  running={running}
/>
)}
{tab==='history'&&(
<ReleaseHistoryTab
  projectId={projectId}
  workspaceId={localStorage.getItem('sandbox.activeWs')??''}
/>
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
