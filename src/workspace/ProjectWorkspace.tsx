// @ts-nocheck
import{useCallback,useEffect,useState}from'react';
import{supabase,type Project}from'../lib/supabase';
import{Spinner}from'../lib/ui';
import{Link}from'../lib/router';
import{ChevronRight,ChevronDown,Settings,ArrowLeft,Network,Sparkles,SlidersHorizontal,GitCompare,Shield,Code2,Server,Database,Activity,DollarSign,Boxes,Search}from'lucide-react';
import{ReleaseWorkspace}from'./ReleaseWorkspace';
import{ProjectIntegrationsPage}from'./ProjectIntegrationsPage';
import{PoliciesPage}from'./PoliciesPage';
import{TopologyView}from'./TopologyView';

const LENSES=[['Overview',Sparkles],['Architecture',Network],['Security',Shield],['Code',Code2],['DevOps',Boxes],['Infrastructure',Server],['Data',Database],['Reliability',Activity],['Cost',DollarSign]];
const DOMAINS=['Security','Code','DevOps','Infrastructure','Dependencies','Data','Networking','Reliability','Scalability','Cost'];

export function ProjectWorkspace({projectId}:{projectId:string}){
  const[project,setProject]=useState<Project|null>(null),[loading,setLoading]=useState(true);
  const[view,setView]=useState<'workspace'|'topology'|'assets'|'policies'|'settings'>('workspace');
  const[lens,setLens]=useState('Overview'),[advanced,setAdvanced]=useState(false),[depth,setDepth]=useState('Standard');
  const[selected,setSelected]=useState(()=>new Set(DOMAINS));
  const wsId=localStorage.getItem('sandbox.activeWs')||'';
  const load=useCallback(async()=>{setLoading(true);const{data}=await supabase.from('projects').select('*').eq('id',projectId).single();setProject(data as Project|null);setLoading(false)},[projectId]);
  useEffect(()=>{load()},[load]);
  const toggle=(d:string)=>setSelected(s=>{const n=new Set(s);n.has(d)?n.delete(d):n.add(d);return n});
  if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;
  if(!project)return<div className="text-center py-16"><p className="text-gray-500">Project not found.</p><Link to="/projects" className="text-brand-600 hover:underline text-sm">← Back to projects</Link></div>;
  return <div className="flex flex-col h-full bg-[#fafbfc]">
    <div className="sticky top-0 z-20 border-b border-gray-200 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 sm:px-6 py-2.5">
        <div className="flex items-center gap-2 min-w-0"><Link to="/projects" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={16}/></Link><span className="text-sm font-semibold text-navy-900 truncate">{project.name}</span><span className="hidden md:inline text-[11px] rounded-md bg-gray-100 px-2 py-1 text-gray-500">{project.git_branch||'main'}</span></div>
        <div className="sm:ml-auto flex gap-1 overflow-x-auto no-scrollbar">{[{id:'workspace',label:'Analysis Workspace'},{id:'topology',label:'Topology',icon:Network},{id:'assets',label:'Integrations'},{id:'policies',label:'Policies'},{id:'settings',label:'Settings',icon:Settings}].map(v=><button key={v.id} onClick={()=>setView(v.id as any)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${view===v.id?'bg-brand-50 text-brand-700 border border-brand-200':'text-gray-500 hover:bg-gray-50 border border-transparent'}`}>{v.icon&&<v.icon size={12}/>} {v.label}</button>)}</div>
      </div>
      {view==='workspace'&&<div className="px-4 sm:px-6 pb-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm"><button className="btn-primary text-xs"><Sparkles size={13}/> Smart Analysis</button><button onClick={()=>setAdvanced(v=>!v)} className="px-2 text-gray-500 hover:text-navy-900"><ChevronDown size={14}/></button></div>
          <button onClick={()=>setAdvanced(v=>!v)} className="btn-secondary text-xs"><SlidersHorizontal size={13}/> Targeted Analysis</button>
          <button className="btn-secondary text-xs" title="Compare the current state with a prior validation"><GitCompare size={13}/> Compare</button>
          <span className="ml-auto text-[11px] text-gray-400 hidden lg:inline">Evidence-first analysis · AI correlation · deterministic verification</span>
        </div>
        {advanced&&<div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 shadow-inner">
          <div className="flex flex-wrap items-center gap-3 mb-3"><span className="text-xs font-bold text-navy-900">Analysis Lab</span><label className="text-xs text-gray-500">Depth <select value={depth} onChange={e=>setDepth(e.target.value)} className="ml-1 rounded-md border border-gray-200 bg-white px-2 py-1"><option>Fast</option><option>Standard</option><option>Deep</option></select></label><span className="text-[11px] text-gray-400">Choose exactly what LytHouse should investigate.</span></div>
          <div className="flex flex-wrap gap-2">{DOMAINS.map(d=><button key={d} onClick={()=>toggle(d)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${selected.has(d)?'border-brand-200 bg-brand-50 text-brand-700':'border-gray-200 bg-white text-gray-400'}`}>{selected.has(d)?'✓ ':''}{d}</button>)}</div>
        </div>}
        <div className="flex gap-1 overflow-x-auto no-scrollbar border-t border-gray-100 pt-2">{LENSES.map(([name,I]:any)=><button key={name} onClick={()=>{setLens(name);if(name==='Architecture')setView('topology')}} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs whitespace-nowrap ${lens===name?'bg-navy-900 text-white':'text-gray-500 hover:bg-gray-100'}`}><I size={12}/>{name}</button>)}</div>
      </div>}
    </div>
    <div className="flex-1 min-h-0 overflow-hidden">
      {view==='workspace'&&<ReleaseWorkspace projectId={projectId} project={project}/>} 
      {view==='topology'&&<div className="p-6 overflow-y-auto h-full"><div className="mb-4"><h2 className="text-base font-semibold text-navy-900">Application Intelligence · Architecture</h2><p className="text-sm text-gray-500">Explore services, data stores and relationships inferred from repository evidence.</p></div><TopologyView projectId={projectId} project={project} onOpenFile={()=>setView('workspace')}/></div>}
      {view==='assets'&&<div className="p-6 overflow-y-auto h-full"><ProjectIntegrationsPage projectId={projectId} workspaceId={wsId} project={project}/></div>}
      {view==='policies'&&<div className="p-6 overflow-y-auto h-full"><PoliciesPage projectId={projectId} workspaceId={wsId}/></div>}
      {view==='settings'&&<div className="p-6 overflow-y-auto h-full max-w-2xl"><h2 className="text-base font-semibold text-navy-900 mb-6">Project Settings</h2><ProjectSettings project={project} onSaved={load}/></div>}
    </div>
  </div>;
}

function ProjectSettings({project,onSaved}:{project:Project;onSaved:()=>void}){
 const[form,setForm]=useState({name:project.name||'',description:project.description||'',git_url:project.git_url||'',git_branch:project.git_branch||'main',language:project.language||'',framework:project.framework||'',github_token:project.github_token||''}),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
 const save=async()=>{setSaving(true);await supabase.from('projects').update(form).eq('id',project.id);setSaved(true);setTimeout(()=>setSaved(false),2000);setSaving(false);onSaved()};
 return <div className="space-y-4">{[{label:'Project Name',key:'name',ph:'My Project'},{label:'Description',key:'description',ph:'Optional description'},{label:'Git URL',key:'git_url',ph:'https://github.com/org/repo'},{label:'Branch',key:'git_branch',ph:'main'},{label:'Language',key:'language',ph:'TypeScript'},{label:'Framework',key:'framework',ph:'React'}].map(f=><div key={f.key}><label className="label">{f.label}</label><input className="input" value={(form as any)[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}/></div>)}<div><label className="label">GitHub Token <span className="text-gray-400 font-normal">(legacy private-repo access)</span></label><input className="input" type="password" value={form.github_token} onChange={e=>setForm(p=>({...p,github_token:e.target.value}))}/></div><button onClick={save} disabled={saving} className="btn-primary">{saving?'Saving…':saved?'✓ Saved':'Save Changes'}</button></div>;
}
