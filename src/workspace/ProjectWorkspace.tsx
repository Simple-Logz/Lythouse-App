import{useEffect,useState,useRef}from'react';
import{useRouter}from'../lib/router';
import{supabase,type Project,type Validation,type ValidationStep,type Finding,type Severity}from'../lib/supabase';
import{PageHeader,Spinner,EmptyState,StatusBadge,SeverityBadge,FindingStatusBadge,RiskGauge,Breadcrumb,timeAgo,fmtDuration}from'../lib/ui';
import{FolderGit2,GitFork,GitBranch,Code,Boxes,ShieldCheck,ShieldAlert,ChevronDown,ChevronRight,Save,Check,Loader as Loader2,FileSearch,Settings as Cog,Sparkles,Play,AlertTriangle,RefreshCw,Network,Package,FlaskConical,Gauge,GitMerge}from'lucide-react';
import AIAssistantTab from'./AIAssistantTab';
import{FindingsTab}from'./FindingsTab';
import{ReadinessTab}from'./ReadinessTab';
import{TopologyView}from'./TopologyView';
import{DryRunTab}from'./DryRunTab';
import{DependenciesTab}from'./DependenciesTab';
import{DriftTab}from'./DriftTab';

type Tab='validations'|'findings'|'readiness'|'topology'|'dependencies'|'simulator'|'ai-assistant'|'settings';
const TABS:{id:Tab;label:string;icon:typeof ShieldCheck}[]=[
{id:'validations',label:'Validations',icon:ShieldCheck},
{id:'findings',label:'Findings',icon:ShieldAlert},
{id:'readiness',label:'Readiness',icon:Gauge},
{id:'topology',label:'Topology',icon:Network},
{id:'dependencies',label:'Dependencies',icon:Package},
{id:'simulator',label:'Simulator',icon:FlaskConical},
{id:'ai-assistant',label:'AI Assistant',icon:Sparkles},
{id:'settings',label:'Settings',icon:Cog},
];
const SEV_ORDER:Severity[]=['critical','high','medium','low'];
const SEV_FILTER:(Severity|'all')[]=['all',...SEV_ORDER];

const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function ProjectWorkspace({projectId}:{projectId:string}){
const{navigate}=useRouter();
const[loading,setLoading]=useState(true);
const[project,setProject]=useState<Project|null>(null);
const[tab,setTab]=useState<Tab>('validations');
const[validations,setValidations]=useState<Validation[]>([]);
const[stepsByVid,setStepsByVid]=useState<Record<string,ValidationStep[]>>({});
const[expandedVid,setExpandedVid]=useState<string|null>(null);
const[findings,setFindings]=useState<Finding[]>([]);
const[sevFilter,setSevFilter]=useState<Severity|'all'>('all');
const[saving,setSaving]=useState(false);
const[saved,setSaved]=useState(false);
const[form,setForm]=useState({name:'',description:'',git_url:'',git_branch:'',language:'',framework:''});
const[running,setRunning]=useState(false);
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

{/* Metadata */}
<div className="card mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <Meta icon={<GitFork size={14}/>} label="Git URL" value={project.git_url||'—'}/>
  <Meta icon={<GitBranch size={14}/>} label="Branch" value={project.git_branch||'—'}/>
  <Meta icon={<Code size={14}/>} label="Language" value={project.language||'—'}/>
  <Meta icon={<Boxes size={14}/>} label="Framework" value={project.framework||'—'}/>
  <Meta icon={<FolderGit2 size={14}/>} label="Created" value={new Date(project.created_at).toLocaleDateString()}/>
  <Meta icon={<ShieldCheck size={14}/>} label="Status" value={<span className="capitalize">{project.status}</span>}/>
</div>

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
  <div className="space-y-4">
    {/* What to do next */}
    {validations.length>0&&(()=>{
      const latest=validations[0];
      const isComplete=latest.status==='completed';
      const hasIssues=latest.critical_count>0||latest.high_count>0;
      return<div className={`rounded-xl border px-5 py-4 ${latest.critical_count>0?'border-red-200 bg-red-50':latest.high_count>0?'border-amber-200 bg-amber-50':isComplete?'border-green-200 bg-green-50':'border-brand-200 bg-brand-50'}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-sm font-bold ${latest.critical_count>0?'text-danger-600':latest.high_count>0?'text-amber-700':isComplete?'text-green-700':'text-brand-700'}`}>
              {latest.status==='pending'||latest.status==='running'?'Validation in progress…':
               latest.critical_count>0?`⛔ ${latest.critical_count} critical issue${latest.critical_count!==1?'s':''} — do not deploy`:
               latest.high_count>0?`⚠ ${latest.high_count} high-severity issue${latest.high_count!==1?'s':''} — review before deploying`:
               latest.total_findings>0?`${latest.total_findings} findings — low risk, safe to deploy with caution`:
               '✓ Clean scan — safe to deploy'}
            </p>
            <p className={`text-xs mt-1 ${latest.critical_count>0?'text-red-600':latest.high_count>0?'text-amber-600':isComplete?'text-green-600':'text-brand-600'}`}>
              {hasIssues?'Go to Findings tab to see what needs fixing and resolve each issue.':isComplete?'All checks passed. You can proceed with deployment.':'Scanning your repository…'}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {hasIssues&&<button onClick={()=>setTab('findings')} className="btn-primary text-xs">View findings →</button>}
            {isComplete&&!hasIssues&&<button className="btn-primary text-xs">Deploy now</button>}
            <button onClick={runValidation} disabled={running} className="btn-secondary text-xs">
              {running?<RefreshCw size={13} className="animate-spin"/>:<Play size={13}/>}Re-scan
            </button>
          </div>
        </div>
      </div>;
    })()}

    {validations.length===0
    ?<EmptyState icon={<ShieldCheck size={22}/>} title="No validations yet" description="Run a validation to scan your repository for security issues, exposed secrets, and vulnerable dependencies. Results appear here in real time." action={<button onClick={runValidation} disabled={running} className="btn-primary"><Play size={15}/>Run Validation</button>}/>
    :<div className="space-y-3">
      {validations.map(v=>{
        const open=expandedVid===v.id;
        const isLive=v.status==='running'||v.status==='pending';
        const verdict=v.critical_count>0?{label:'Do not deploy',color:'text-danger-600',bg:'bg-red-50 border-red-200'}:
          v.high_count>0?{label:'Review required',color:'text-amber-600',bg:'bg-amber-50 border-amber-200'}:
          v.status==='completed'?{label:'Safe to deploy',color:'text-green-600',bg:'bg-green-50 border-green-200'}:
          {label:'In progress',color:'text-brand-600',bg:'bg-brand-50 border-brand-200'};
        return<div key={v.id} className="card p-0 overflow-hidden">
          <button onClick={()=>toggleVid(v.id)} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 transition-colors">
            {open?<ChevronDown size={16} className="text-gray-400"/>:<ChevronRight size={16} className="text-gray-400"/>}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={v.status}/>
                <span className={`chip border text-xs ${verdict.bg} ${verdict.color}`}>{verdict.label}</span>
                {v.severity&&<SeverityBadge severity={v.severity}/>}
                <span className="chip bg-gray-50 text-gray-600 border border-gray-200">{v.total_findings} findings</span>
                {isLive&&<span className="flex items-center gap-1 text-xs text-brand-600"><RefreshCw size={11} className="animate-spin"/>Live</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                {v.critical_count>0&&<span className="text-danger-600 font-semibold">● {v.critical_count} critical</span>}
                {v.high_count>0&&<span className="text-amber-600 font-semibold">● {v.high_count} high</span>}
                {v.medium_count>0&&<span className="text-blue-500">● {v.medium_count} medium</span>}
                {v.low_count>0&&<span className="text-gray-400">● {v.low_count} low</span>}
                <span>· {timeAgo(v.created_at)}</span>
                {v.duration_ms&&<span>· {fmtDuration(v.duration_ms)}</span>}
              </div>
              {v.summary&&<p className="mt-1.5 text-xs text-gray-500 line-clamp-2 italic">"{v.summary}"</p>}
            </div>
            <div className="flex items-center gap-3">
              {v.status==='completed'&&v.total_findings>0&&(
                <button onClick={e=>{e.stopPropagation();setTab('findings');}} className="text-xs text-brand-600 hover:underline font-medium">Fix issues →</button>
              )}
              <RiskGauge score={v.risk_score} size={56}/>
            </div>
          </button>
          {open&&(
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
              {(stepsByVid[v.id]??[]).length===0
                ?<p className="py-3 text-sm text-gray-400">{isLive?'Scan starting — steps will appear here…':'No step detail available for this run.'}</p>
                :<div className="space-y-2">
                  {(stepsByVid[v.id]??[]).map(s=>(
                    <div key={s.id} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${s.status==='completed'?'bg-green-50 border-green-100':s.status==='failed'?'bg-red-50 border-red-100':'bg-white border-gray-100'}`}>
                      <StatusBadge status={s.status}/>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-navy-900">{s.name}</p>
                        {s.detail&&<p className="mt-0.5 text-xs text-gray-500">{s.detail}</p>}
                        {s.status==='failed'&&<p className="mt-1 text-xs text-danger-600 font-medium">→ Go to Findings to resolve this issue</p>}
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">{fmtDuration(s.duration_ms)}</span>
                    </div>
                  ))}
                  {v.status==='completed'&&v.total_findings>0&&(
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-xs text-gray-500">{v.total_findings} issue{v.total_findings!==1?'s':''} found that need your attention.</p>
                      <button onClick={()=>setTab('findings')} className="btn-primary text-xs">Resolve findings →</button>
                    </div>
                  )}
                </div>}
            </div>
          )}
        </div>;
      })}
    </div>}
  </div>
)}

{tab==='findings'&&(
  <FindingsTab
    projectId={projectId}
    onOpenFile={(path,line)=>console.log('open file',path,line)}
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
