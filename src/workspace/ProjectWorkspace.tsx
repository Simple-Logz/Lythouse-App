// @ts-nocheck
import{useCallback,useEffect,useState}from'react';
import{supabase,anonKey,edgeFunctionUrl,type Project}from'../lib/supabase';
import{Spinner}from'../lib/ui';
import{Link}from'../lib/router';
import{ChevronRight,Settings,ArrowLeft,Network}from'lucide-react';
import{ReleaseWorkspace}from'./ReleaseWorkspace';
import{AssetsPage}from'./AssetsPage';
import{PoliciesPage}from'./PoliciesPage';
import{TopologyView}from'./TopologyView';
import{CodeEditorPanel}from'./CodeEditorPanel';

export function ProjectWorkspace({projectId}:{projectId:string}){
  const[project,setProject]=useState<Project|null>(null);
  const[loading,setLoading]=useState(true);
  const[view,setView]=useState<'workspace'|'topology'|'assets'|'policies'|'settings'>('workspace');
  const wsId=localStorage.getItem('sandbox.activeWs')||'';

  const load=useCallback(async()=>{
    setLoading(true);
    const{data}=await supabase.from('projects').select('*').eq('id',projectId).single();
    setProject(data as Project|null);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{load();},[load]);

  if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;
  if(!project)return<div className="text-center py-16"><p className="text-gray-500">Project not found.</p><Link to="/projects" className="text-brand-600 hover:underline text-sm">← Back to projects</Link></div>;

  return(
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-white shrink-0">
        <Link to="/projects" className="text-gray-400 hover:text-gray-600 transition-colors"><ArrowLeft size={16}/></Link>
        <Link to="/projects" className="text-sm text-gray-400 hover:text-gray-600">Projects</Link>
        <ChevronRight size={14} className="text-gray-300"/>
        <span className="text-sm font-semibold text-navy-900">{project.name}</span>
        <div className="ml-auto flex items-center gap-1">
          {[
            {id:'workspace',label:'AI Release Review'},
            {id:'topology',label:'Topology',icon:Network},
            {id:'assets',label:'Environment'},
            {id:'policies',label:'Policies'},
            {id:'settings',label:'Settings',icon:Settings},
          ].map(v=>(
            <button key={v.id} onClick={()=>setView(v.id as any)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view===v.id?'bg-brand-50 text-brand-700 border border-brand-200':'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {v.icon&&<v.icon size={12}/>}{v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {view==='workspace'&&<ReleaseWorkspace projectId={projectId} project={project}/>}
        {view==='topology'&&(
          <div className="p-6 overflow-y-auto h-full">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-navy-900">Application Topology</h2>
              <p className="text-sm text-gray-500">A diagram of what your app looks like — services, data stores, and how they connect — inferred from the repository.</p>
            </div>
            <TopologyView projectId={projectId} project={project} onOpenFile={()=>setView('workspace')}/>
          </div>
        )}
        {view==='assets'&&<div className="p-6 overflow-y-auto h-full"><AssetsPage projectId={projectId} workspaceId={wsId}/></div>}
        {view==='policies'&&<div className="p-6 overflow-y-auto h-full"><PoliciesPage projectId={projectId} workspaceId={wsId}/></div>}
        {view==='settings'&&(
          <div className="p-6 overflow-y-auto h-full max-w-2xl">
            <h2 className="text-base font-semibold text-navy-900 mb-6">Project Settings</h2>
            <ProjectSettings project={project} onSaved={load}/>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectSettings({project,onSaved}:{project:Project;onSaved:()=>void}){
  const[form,setForm]=useState({
    name:project.name||'',description:project.description||'',
    git_url:project.git_url||'',git_branch:project.git_branch||'main',
    language:project.language||'',framework:project.framework||'',
    github_token:project.github_token||'',
  });
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);

  const save=async()=>{
    setSaving(true);
    await supabase.from('projects').update(form).eq('id',project.id);
    setSaved(true);setTimeout(()=>setSaved(false),2000);
    setSaving(false);onSaved();
  };

  return(
    <div className="space-y-4">
      {[
        {label:'Project Name',key:'name',ph:'My Project'},
        {label:'Description',key:'description',ph:'Optional description'},
        {label:'Git URL',key:'git_url',ph:'https://github.com/org/repo'},
        {label:'Branch',key:'git_branch',ph:'main'},
        {label:'Language',key:'language',ph:'TypeScript'},
        {label:'Framework',key:'framework',ph:'React'},
      ].map(f=>(
        <div key={f.key}>
          <label className="label">{f.label}</label>
          <input className="input" value={(form as any)[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}/>
        </div>
      ))}
      <div>
        <label className="label">GitHub Token <span className="text-gray-400 font-normal">(for private repos)</span></label>
        <input className="input" type="password" value={form.github_token} onChange={e=>setForm(p=>({...p,github_token:e.target.value}))} placeholder="ghp_xxxxxxxxxxxx"/>
      </div>
      <button onClick={save} disabled={saving} className="btn-primary">
        {saving?'Saving…':saved?'✓ Saved':'Save Changes'}
      </button>
    </div>
  );
}
