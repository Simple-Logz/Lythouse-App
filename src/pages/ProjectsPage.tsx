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
    repo_folder:repoFolder.trim()||null,
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

<label className="label">Workspace <span className="text-danger-600">*</span></label>
<select className="input mb-3" value={selectedWs} onChange={e=>{setSelectedWs(e.target.value);localStorage.setItem('sandbox.activeWs',e.target.value);}}>
  {workspaces.length===0&&<option value="">No workspaces — create one first</option>}
  {workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
</select>
<label className="label">Name <span className="text-danger-600">*</span></label>
<input className="input mb-3" value={name} onChange={e=>{setName(e.target.value);setError('');}} placeholder="My project"/>

<label className="label">Description</label>
<textarea className="input mb-3" rows={2} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Optional"/>

<label className="label">Git URL <span className="text-danger-600">*</span></label>
<input className="input mb-3" value={gitUrl} onChange={e=>{setGitUrl(e.target.value);setError('');}} placeholder="https://github.com/org/repo"/>

<label className="label">Owner Email <span className="text-danger-600">*</span></label>
<input className="input mb-3" type="email" value={ownerEmail} onChange={e=>{setOwnerEmail(e.target.value);setError('');}} placeholder="owner@example.com"/>

<label className="label">GitHub Personal Access Token <span className="text-danger-600">*</span></label>
<input className="input mb-3" type="password" value={githubToken} onChange={e=>setGithubToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx"/>

<label className="label">Folder within branch <span className="text-gray-400 font-normal">(optional)</span></label>
<input className="input mb-3" value={repoFolder} onChange={e=>setRepoFolder(e.target.value)} placeholder="e.g. src — leave blank for root"/>

<label className="label">Git branch</label>
<input className="input mb-4" value={gitBranch} onChange={e=>setGitBranch(e.target.value)} placeholder="main"/>

<p className="text-xs text-gray-400 mb-4"><span className="text-danger-600">*</span> Required fields</p>

<div className="flex justify-end gap-2">
  <button onClick={resetForm} className="btn-secondary">Cancel</button>
  <button onClick={createProject} disabled={saving||!name.trim()} className="btn-primary">
    {saving?<Loader2 size={16} className="animate-spin"/>:<Plus size={16}/>} Create
  </button>
</div>
</div>
</div>
)}
</div>;
}