import{useEffect,useState}from'react';
import{supabase,type Project}from'../lib/supabase';
import{PageHeader,EmptyState,Spinner}from'../lib/ui';
import{useRouter,Link}from'../lib/router';
import { FolderGit2, Plus, X, GitFork as Github, Loader as Loader2 } from 'lucide-react';

export function ProjectsPage(){
const{navigate}=useRouter();
const[loading,setLoading]=useState(true);
const[projects,setProjects]=useState<Project[]>([]);
const[creating,setCreating]=useState(false);
const[name,setName]=useState('');
const[desc,setDesc]=useState('');
const[gitUrl,setGitUrl]=useState('');
const[gitBranch,setGitBranch]=useState('main');
const[repoFolder,setRepoFolder]=useState('');
const[gitProvider,setGitProvider]=useState('github');
const[repoVisibility,setRepoVisibility]=useState<'public'|'private'>('public');
const[githubToken,setGithubToken]=useState('');
const[ownerEmail,setOwnerEmail]=useState('');
const[saving,setSaving]=useState(false);
const[error,setError]=useState('');
const[workspaces,setWorkspaces]=useState<{id:string;name:string}[]>([]);
const[selectedWs,setSelectedWs]=useState(localStorage.getItem('sandbox.activeWs')||'');

const wsId=()=>selectedWs||localStorage.getItem('sandbox.activeWs')||'';

const load=async()=>{
  setLoading(true);
  const wid=wsId();
  if(!wid){setLoading(false);return;}
  const{data,error}=await supabase.from('projects').select('*').eq('workspace_id',wid).order('created_at',{ascending:false});
  if(error){console.error('ProjectsPage load error:',error);}
  setProjects(data??[]);
  setLoading(false);
};

useEffect(()=>{
  load();
  // Load all workspaces for the selector
  supabase.from('workspaces').select('id,name').order('created_at',{ascending:false}).then(({data})=>{
    setWorkspaces(data??[]);
    if(!selectedWs&&data&&data.length>0){
      setSelectedWs(data[0].id);
    }
  });
},[]);

const createProject=async()=>{
  const wid=wsId();
  if(!wid||!name.trim())return;

  // Validate required fields
  if(!gitUrl.trim()){setError('Git URL is required.');return;}
  if(!ownerEmail.trim()){setError('Owner email is required.');return;}
  const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if(!emailRe.test(ownerEmail.trim())){setError('Please enter a valid email address.');return;}

  // Check for duplicate project name within this workspace
  const duplicate=projects.find(p=>p.name.trim().toLowerCase()===name.trim().toLowerCase());
  if(duplicate){setError(`A project named "${name.trim()}" already exists in this workspace.`);return;}

  setSaving(true);setError('');
  const{data,error}=await supabase.from('projects').insert({
    workspace_id:wid,
    name:name.trim(),
    description:desc.trim()||null,
    git_url:gitUrl.trim(),
    git_branch:gitBranch.trim()||'main',
    repo_folder:repoFolder.trim()||'',
    github_token:githubToken.trim()||null,
    language:ownerEmail.trim(),
    status:'active',
  }).select().single();
  if(error){
    setError(error.message);
    setSaving(false);
    return;
  }
  setProjects(prev=>[data,...prev]);
  setName('');setDesc('');setGitUrl('');setGitBranch('main');setRepoFolder('');setGithubToken('');setOwnerEmail('');setCreating(false);
  setSaving(false);
};

const resetForm=()=>{setCreating(false);setName('');setDesc('');setGitUrl('');setGitBranch('main');setRepoFolder('');setGithubToken('');setOwnerEmail('');setError('');};

if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

return<div>
<PageHeader title="Projects" description="Manage your validation projects." actions={
<button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/> New project</button>
}/>

{projects.length===0
?<EmptyState icon={<FolderGit2 size={22}/>} title="No projects yet" description="Create your first project to start running pre-change validations." action={<button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/> New project</button>}/>
:<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
{projects.map(p=>(
<Link key={p.id} to={`/projects/${p.id}`} className="card group transition-all hover:shadow-md hover:-translate-y-0.5">
<div className="flex items-start justify-between">
<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><FolderGit2 size={20}/></div>
{p.git_url&&<Github size={16} className="text-gray-300"/>}
</div>
<h3 className="mt-3 text-base font-semibold text-navy-900">{p.name}</h3>
{p.description&&<p className="mt-1 line-clamp-2 text-sm text-gray-500">{p.description}</p>}
<div className="mt-3 flex items-center gap-2">
{p.language&&<span className="chip bg-gray-50 text-gray-600 border border-gray-200 text-xs">{p.language}</span>}
<span className="chip bg-brand-50 text-brand-700 border border-brand-200 capitalize">{p.status}</span>
</div>
</Link>
))}
</div>}

{creating&&(
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={resetForm}>
<div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-5 shadow-xl overflow-y-auto max-h-[90vh]" onClick={e=>e.stopPropagation()}>
<div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">New project</h2><button onClick={resetForm} className="btn-ghost p-1"><X size={16}/></button></div>
{error&&<div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-danger-600">{error}</div>}

<label className="label">Name <span className="text-danger-600">*</span></label>
<input className="input mb-3" value={name} onChange={e=>{setName(e.target.value);setError('');}} placeholder="My project"/>

<label className="label">Description</label>
<textarea className="input mb-3" rows={2} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Optional"/>

<label className="label">Repository provider <span className="text-danger-600">*</span></label>
<div className="grid grid-cols-3 gap-2 mb-3">
{[
  {id:'github',name:'GitHub',color:'#24292e',bg:'#f6f8fa',border:'#d0d7de',svg:'M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z'},
  {id:'gitlab',name:'GitLab',color:'#FC6D26',bg:'#fdf6f0',border:'#FC6D26',svg:'M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.386 9.45.044 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.625-8.444a.92.92 0 0 0 .33-1.023'},
  {id:'bitbucket',name:'Bitbucket',color:'#0052CC',bg:'#f0f4ff',border:'#0052CC',svg:'M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z'},
  {id:'azure',name:'Azure DevOps',color:'#0078D4',bg:'#f0f8ff',border:'#0078D4',svg:'M0 17.182L2.538 20l8.347-7.767V20L24 12.909 13.2 4v3.636z'},
  {id:'onprem-git',name:'Self-hosted Git',color:'#6B7280',bg:'#f9fafb',border:'#d1d5db',svg:'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z'},
  {id:'other',name:'Other / HTTPS',color:'#374151',bg:'#f9fafb',border:'#d1d5db',svg:'M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1'},
].map(p=>(
  <button type="button" key={p.id} onClick={()=>setGitProvider(p.id)} className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-2.5 transition-all text-center ${gitProvider===p.id?`border-[${p.border}] bg-[${p.bg}]`:'border-gray-200 bg-white hover:border-gray-300'}`} style={gitProvider===p.id?{borderColor:p.color,background:p.bg}:{}} >
    <svg viewBox="0 0 24 24" className="w-5 h-5" style={{fill:gitProvider===p.id?p.color:'#9CA3AF'}}><path d={p.svg}/></svg>
    <span className="text-[10px] font-medium leading-tight" style={{color:gitProvider===p.id?p.color:'#6B7280'}}>{p.name}</span>
  </button>
))}
</div>
<label className="label">Repository URL <span className="text-danger-600">*</span></label>
<input className="input mb-3" value={gitUrl} onChange={e=>{setGitUrl(e.target.value);setError('');}} placeholder={
  gitProvider==='github'?'https://github.com/org/repo':
  gitProvider==='gitlab'?'https://gitlab.com/org/repo':
  gitProvider==='bitbucket'?'https://bitbucket.org/org/repo':
  gitProvider==='azure'?'https://dev.azure.com/org/project/_git/repo':
  gitProvider==='onprem-git'?'https://git.yourcompany.com/org/repo':
  'https://your-repo-url.com/org/repo'
}/>

<label className="label">Owner Email <span className="text-danger-600">*</span></label>
<input className="input mb-3" type="email" value={ownerEmail} onChange={e=>{setOwnerEmail(e.target.value);setError('');}} placeholder="owner@example.com"/>

<label className="label">Repository visibility</label>
<div className="grid grid-cols-2 gap-2 mb-3">
  <button type="button" onClick={()=>{setRepoVisibility('public');setGithubToken('');}} className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-medium transition-all ${repoVisibility==='public'?'border-brand-500 bg-brand-50 text-brand-700':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
    Public
  </button>
  <button type="button" onClick={()=>setRepoVisibility('private')} className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-medium transition-all ${repoVisibility==='private'?'border-brand-500 bg-brand-50 text-brand-700':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    Private
  </button>
</div>

{repoVisibility==='private'&&(
  <>
    <label className="label">Personal Access Token <span className="text-danger-600">*</span></label>
    <input className="input mb-1" type="password" value={githubToken} onChange={e=>setGithubToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx"/>
    <p className="text-xs text-gray-400 mb-3">Required for private repositories. <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Create a token →</a></p>
  </>
)}
{repoVisibility==='public'&&(
  <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
    Public repositories don't require a token.
  </p>
)}

<label className="label">Folder within branch <span className="text-gray-400 font-normal">(optional)</span></label>
<input className="input mb-3" value={repoFolder} onChange={e=>setRepoFolder(e.target.value)} placeholder="e.g. src — leave blank for root"/>

<label className="label">Git branch</label>
<input className="input mb-4" value={gitBranch} onChange={e=>setGitBranch(e.target.value)} placeholder="main"/>

<label className="label">Workspace <span className="text-danger-600">*</span></label>
{workspaces.length===0?(
  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 flex items-center justify-between">
    <span>No workspaces yet.</span>
    <a href="/workspaces" className="font-semibold underline text-amber-700 ml-2">Create one →</a>
  </div>
):(
  <select className="input mb-4" value={selectedWs} onChange={e=>{setSelectedWs(e.target.value);localStorage.setItem('sandbox.activeWs',e.target.value);}}>
    {workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
  </select>
)}

<p className="text-xs text-gray-400 mb-4"><span className="text-danger-600">*</span> Required fields</p>

<div className="flex justify-end gap-2">
  <button onClick={resetForm} className="btn-secondary">Cancel</button>
  <button onClick={createProject} disabled={saving||!name.trim()||!selectedWs} className="btn-primary">
    {saving?<Loader2 size={16} className="animate-spin"/>:<Plus size={16}/>} Create
  </button>
</div>
</div>
</div>
)}
</div>;
}