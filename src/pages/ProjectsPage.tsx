// @ts-nocheck
import{useEffect,useState}from'react';
import{supabase,edgeFunctionUrl,anonKey,type Project}from'../lib/supabase';
import{PageHeader,EmptyState,Spinner}from'../lib/ui';
import{useRouter,Link}from'../lib/router';
import{PinButton}from'../lib/pins';
import{useRole}from'../lib/useRole';
import{useAuth}from'../lib/auth';
import { FolderGit2, Plus, X, GitFork as Github, Loader as Loader2, Search, ChevronRight } from 'lucide-react';
import { CreateProjectWizard } from './CreateProjectWizard';

const hostFrom=(u:string)=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch{return u;}};

export function ProjectsPage(){
const{navigate}=useRouter();
const{user}=useAuth();
const perms=useRole();
const canCreate=perms.can('projects.create');
const[loading,setLoading]=useState(true);
const[projects,setProjects]=useState<Project[]>([]);
const[q,setQ]=useState('');
const[creating,setCreating]=useState(false);
const[name,setName]=useState('');
const[desc,setDesc]=useState('');
const[gitUrl,setGitUrl]=useState('');
const[gitBranch,setGitBranch]=useState('main');
const[repoFolder,setRepoFolder]=useState('');
const[gitProvider,setGitProvider]=useState('github');
const[repoVisibility,setRepoVisibility]=useState<'public'|'private'>('public');
const[githubToken,setGithubToken]=useState('');
const[saving,setSaving]=useState(false);
const[error,setError]=useState('');
const[workspaces,setWorkspaces]=useState<{id:string;name:string}[]>([]);
const[selectedWs,setSelectedWs]=useState(localStorage.getItem('sandbox.activeWs')||'');

// ── GitHub import ──────────────────────────────────────────────
const[importing,setImporting]=useState(false);
const[ghToken,setGhToken]=useState('');
const[ghConnecting,setGhConnecting]=useState(false);
const[ghError,setGhError]=useState('');
const[ghUser,setGhUser]=useState<any>(null);
const[repos,setRepos]=useState<any[]>([]);
const[repoSearch,setRepoSearch]=useState('');
const[importingId,setImportingId]=useState<number|string>('');
const[showToken,setShowToken]=useState(false);
const GH_CLIENT_ID=(import.meta as any).env?.VITE_GITHUB_CLIENT_ID as string|undefined;

// Which of the two import paths is showing, and the workspace this import
// should land in (scoped to the modal — doesn't change the page's active
// workspace, only which one the new project gets created under).
const[importTab,setImportTab]=useState<'manual'|'browse'>('manual');
const[importWs,setImportWs]=useState('');
const[manName,setManName]=useState('');
const[manGitUrl,setManGitUrl]=useState('');
const[manBranch,setManBranch]=useState('main');
const[manFolder,setManFolder]=useState('');
const[manToken,setManToken]=useState('');
const[manSaving,setManSaving]=useState(false);
const[manError,setManError]=useState('');
const manDerivedName=manGitUrl.trim().replace(/\.git$/,'').replace(/\/+$/,'').split('/').filter(Boolean).pop()||'';

const wsId=()=>selectedWs||localStorage.getItem('sandbox.activeWs')||'';

// Kick off the GitHub OAuth login redirect
const loginWithGithub=()=>{
  if(!GH_CLIENT_ID){setImporting(true);setShowToken(true);setGhError('GitHub login isn’t configured yet — paste a token below, or ask an admin to set up the OAuth app.');return;}
  const redirect=window.location.origin+window.location.pathname;
  sessionStorage.setItem('gh_oauth_redirect',redirect);
  const scope=encodeURIComponent('repo read:org');
  window.location.href=`https://github.com/login/oauth/authorize?client_id=${GH_CLIENT_ID}&scope=${scope}&redirect_uri=${encodeURIComponent(redirect)}`;
};

// Fetch the user + repos for a given access token (OAuth or PAT)
const connectWithToken=async(tok:string)=>{
  setGhConnecting(true);setGhError('');
  try{
    const h={Authorization:'Bearer '+tok.trim(),Accept:'application/vnd.github+json'};
    const ur=await fetch('https://api.github.com/user',{headers:h});
    if(!ur.ok)throw new Error(ur.status===401?'That login/token is invalid or expired.':'GitHub returned '+ur.status);
    const user=await ur.json();
    const rr=await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',{headers:h});
    if(!rr.ok)throw new Error('Connected, but could not load your repositories.');
    const list=await rr.json();
    setGhToken(tok);setGhUser(user);setRepos(Array.isArray(list)?list:[]);
  }catch(e:any){setGhError(e?.message||'Failed to connect to GitHub.');}
  finally{setGhConnecting(false);}
};

const connectGithub=()=>{
  if(!ghToken.trim()){setGhError('Please paste a GitHub token first.');return;}
  connectWithToken(ghToken);
};

// Deep-link from the command palette (⌘K → New Project) opens the create form.
useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  if(params.get('new')==='1'){setCreating(true);window.history.replaceState({},'',window.location.pathname);}
},[]);

// Default the import modal's workspace picker to whatever's currently active.
useEffect(()=>{
  if(importing&&!importWs)setImportWs(wsId());
},[importing]); // eslint-disable-line react-hooks/exhaustive-deps

// After the OAuth redirect back, exchange ?code= for a token
useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const code=params.get('code');
  const redirect=sessionStorage.getItem('gh_oauth_redirect');
  if(!code||!redirect)return;
  sessionStorage.removeItem('gh_oauth_redirect');
  window.history.replaceState({},'',window.location.pathname);
  setImporting(true);setGhConnecting(true);setGhError('');
  (async()=>{
    try{
      const r=await fetch(edgeFunctionUrl+'/github-oauth',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+anonKey,apikey:anonKey},body:JSON.stringify({code,redirect_uri:redirect})});
      const d=await r.json();
      if(!r.ok||!d.access_token)throw new Error(d.error||'GitHub login failed.');
      await connectWithToken(d.access_token);
    }catch(e:any){setGhError(e?.message||'GitHub login failed.');setGhConnecting(false);}
  })();
},[]);

const importRepo=async(repo:any)=>{
  const wid=importWs||wsId();
  if(!wid){setGhError('Select a workspace first (create one under Workspaces).');return;}
  if(projects.find(p=>p.name.trim().toLowerCase()===String(repo.name).toLowerCase())){setGhError(`A project named "${repo.name}" already exists in this workspace.`);return;}
  setImportingId(repo.id);setGhError('');
  const{data,error}=await supabase.from('projects').insert({
    workspace_id:wid,
    name:repo.name,
    description:repo.description||null,
    git_url:repo.clone_url||repo.html_url,
    git_branch:repo.default_branch||'main',
    repo_folder:'',
    github_token:repo.private?ghToken.trim():null,
    language:repo.language||null,
    status:'active',
  }).select().single();
  if(error){setGhError(error.message);setImportingId('');return;}
  setProjects(prev=>[data,...prev]);
  resetImport();
  navigate(`/projects/${data.id}`);
};

// Manual path: paste a repo URL directly (any git host) instead of browsing
// a GitHub-account repo list — same projects-table insert the wizard and
// the browse-flow both use, just entered by hand.
const importManual=async()=>{
  const wid=importWs;
  if(!wid){setManError('Select a workspace first (create one under Workspaces).');return;}
  if(!manGitUrl.trim()){setManError('Enter the repository URL.');return;}
  const finalName=(manName.trim()||manDerivedName).trim();
  if(!finalName){setManError('Could not determine a project name from that URL — enter one above.');return;}
  if(projects.find(p=>p.name.trim().toLowerCase()===finalName.toLowerCase())){setManError(`A project named "${finalName}" already exists in this workspace.`);return;}
  setManSaving(true);setManError('');
  const{data,error}=await supabase.from('projects').insert({
    workspace_id:wid,
    name:finalName,
    description:null,
    git_url:manGitUrl.trim(),
    git_branch:manBranch.trim()||'main',
    repo_folder:manFolder.trim()||'',
    github_token:manToken.trim()||null,
    language:null,
    status:'active',
  }).select().single();
  if(error){setManError(error.message);setManSaving(false);return;}
  setProjects(prev=>[data,...prev]);
  setManSaving(false);
  resetImport();
  navigate(`/projects/${data.id}`);
};

const resetImport=()=>{setImporting(false);setGhToken('');setGhError('');setGhUser(null);setRepos([]);setRepoSearch('');setImportingId('');setShowToken(false);setImportTab('manual');setManName('');setManGitUrl('');setManBranch('main');setManFolder('');setManToken('');setManError('');setManSaving(false);};

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
    language:null,
    status:'active',
  }).select().single();
  if(error){
    setError(error.message);
    setSaving(false);
    return;
  }
  setProjects(prev=>[data,...prev]);
  setName('');setDesc('');setGitUrl('');setGitBranch('main');setRepoFolder('');setGithubToken('');setCreating(false);
  setSaving(false);
};

const resetForm=()=>{setCreating(false);setName('');setDesc('');setGitUrl('');setGitBranch('main');setRepoFolder('');setGithubToken('');setError('');};

if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

const filtered=projects.filter(p=>!q||p.name.toLowerCase().includes(q.toLowerCase())||(p.description||'').toLowerCase().includes(q.toLowerCase()));

return<div>
<PageHeader title="Projects" description="Every repository connected to LytHouse for pre-deployment validation." actions={
<div className="flex items-center gap-2">
{canCreate&&<button onClick={()=>setImporting(true)} className="btn-secondary"><Github size={16}/> Import from GitHub</button>}
{canCreate&&<button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/> New project</button>}
</div>
}/>

{projects.length===0
?<EmptyState icon={<FolderGit2 size={22}/>} title="No projects yet" description={canCreate?"Connect a repository to start running pre-deployment validations.":"No projects yet. Ask a workspace admin or developer to add one."} action={canCreate?<div className="flex gap-2"><button onClick={()=>setImporting(true)} className="btn-secondary"><Github size={16}/> Import from GitHub</button><button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/> New project</button></div>:undefined}/>
:<>
  <div className="mb-4 flex items-center gap-3">
    <div className="relative min-w-0 flex-1 max-w-xs">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search projects…" className="input pl-9"/>
    </div>
    <span className="shrink-0 text-xs text-gray-400">{filtered.length} project{filtered.length!==1?'s':''}</span>
  </div>
  {filtered.length===0
  ?<div className="card py-14 text-center text-sm text-gray-400">No projects match “{q}”.</div>
  :<div className="card overflow-hidden p-0">
    <div className="hidden items-center gap-4 border-b border-gray-100 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:flex">
      <span className="w-10 shrink-0"></span><span className="flex-1">Project</span><span className="w-40 shrink-0">Repository</span><span className="w-24 shrink-0">Status</span><span className="w-5 shrink-0"></span>
    </div>
    <div className="divide-y divide-gray-100">
      {filtered.map(p=>(
        <Link key={p.id} to={`/projects/${p.id}`} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-gray-50/70">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><FolderGit2 size={18}/></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-navy-900">{p.name}</span>
              {p.language&&<span className="chip border border-[#d4d4d8] bg-gray-100 text-[11px] text-gray-600">{p.language}</span>}
            </div>
            {p.description&&<p className="mt-0.5 truncate text-xs text-gray-400">{p.description}</p>}
          </div>
          <div className="hidden w-40 shrink-0 sm:block">
            {p.git_url
              ?<span className="flex items-center gap-1.5 truncate text-xs text-gray-500"><Github size={13} className="shrink-0 text-gray-400"/><span className="truncate">{hostFrom(p.git_url)}</span></span>
              :<span className="text-xs text-gray-300">—</span>}
            {p.git_branch&&<span className="mt-0.5 block font-mono text-[11px] text-gray-400">{p.git_branch}</span>}
          </div>
          <span className="w-24 shrink-0"><span className="chip border border-brand-200 bg-brand-50 capitalize text-brand-700">{p.status}</span></span>
          <PinButton item={{type:'project',id:p.id,label:p.name,to:`/projects/${p.id}`}}/>
          <ChevronRight size={16} className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-500"/>
        </Link>
      ))}
    </div>
  </div>}
</>}

{importing&&(
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={resetImport}>
<div className="w-full max-w-lg animate-scale-in rounded-xl bg-white p-5 shadow-xl overflow-y-auto max-h-[90vh]" onClick={e=>e.stopPropagation()}>
<div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-semibold flex items-center gap-2"><Github size={18}/>Import from GitHub</h2><button onClick={resetImport} className="btn-ghost p-1"><X size={16}/></button></div>
<p className="text-sm text-gray-500 mb-4">Import a repository as a project — paste a URL directly, or browse your GitHub account.</p>

<label className="label">Workspace {workspaces.length>1&&<span className="text-danger-600">*</span>}</label>
{workspaces.length===0
  ?<div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">No workspaces yet — <Link to="/workspaces" onClick={resetImport} className="underline font-medium">create one</Link> first.</div>
  :<select className="input mb-3" value={importWs} onChange={e=>setImportWs(e.target.value)}>
    {workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
  </select>}

<div className="mb-4 flex rounded-lg border border-[#d4d4d8] p-0.5 text-xs font-semibold">
  <button onClick={()=>setImportTab('manual')} className={`flex-1 rounded-md py-1.5 transition-colors ${importTab==='manual'?'bg-navy-900 text-white':'text-gray-500 hover:text-navy-900'}`}>Enter repository details</button>
  <button onClick={()=>setImportTab('browse')} className={`flex-1 rounded-md py-1.5 transition-colors ${importTab==='browse'?'bg-navy-900 text-white':'text-gray-500 hover:text-navy-900'}`}>Browse GitHub</button>
</div>

{importTab==='manual'?(
  <>
    {manError&&<div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-danger-600">{manError}</div>}
    <label className="label">Repository URL <span className="text-danger-600">*</span></label>
    <input className="input mb-3" value={manGitUrl} onChange={e=>{setManGitUrl(e.target.value);setManError('');}} placeholder="https://github.com/org/repo" onKeyDown={e=>{if(e.key==='Enter')importManual();}}/>
    <label className="label">Project name <span className="text-gray-400 font-normal">(optional — defaults to the repo name)</span></label>
    <input className="input mb-3" value={manName} onChange={e=>setManName(e.target.value)} placeholder={manDerivedName||'my-project'}/>
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div><label className="label">Branch</label><input className="input" value={manBranch} onChange={e=>setManBranch(e.target.value)} placeholder="main"/></div>
      <div><label className="label">Subfolder <span className="text-gray-400 font-normal">(optional)</span></label><input className="input" value={manFolder} onChange={e=>setManFolder(e.target.value)} placeholder="root"/></div>
    </div>
    <label className="label">Personal access token <span className="text-gray-400 font-normal">(optional — required for private repos)</span></label>
    <input className="input mb-1" type="password" value={manToken} onChange={e=>setManToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx"/>
    <p className="text-xs text-gray-400 mb-3">Token needs <span className="font-medium">repo</span> access. <a href="https://github.com/settings/tokens/new?scopes=repo&description=Lythouse" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Create one →</a></p>
    {user?.email&&<p className="text-xs text-gray-400 mb-1">Managed by <span className="font-medium text-gray-600">{user.email}</span> — the account you're signed in with.</p>}
    <div className="flex justify-end gap-2 mt-3">
      <button onClick={resetImport} className="btn-secondary">Cancel</button>
      <button onClick={importManual} disabled={manSaving||!manGitUrl.trim()||!importWs} className="btn-primary">{manSaving?<Loader2 size={16} className="animate-spin"/>:<Github size={16}/>} Import repository</button>
    </div>
  </>
):(
  <>
    {ghError&&<div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-danger-600">{ghError}</div>}
    {!ghUser?(
      <>
        <button onClick={loginWithGithub} disabled={ghConnecting} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1f2328] px-4 py-3 text-sm font-semibold text-white hover:bg-[#32383f] transition-colors disabled:opacity-60">
          {ghConnecting?<Loader2 size={16} className="animate-spin"/>:<Github size={16}/>} Continue with GitHub
        </button>
        <p className="text-xs text-gray-400 mt-2 text-center">You'll sign in on GitHub, then pick a repository to import.</p>

        <div className="my-4 flex items-center gap-3"><div className="h-px flex-1 bg-gray-200"/><span className="text-xs text-gray-400">or</span><div className="h-px flex-1 bg-gray-200"/></div>

        {!showToken?(
          <button onClick={()=>setShowToken(true)} className="w-full text-center text-xs text-gray-500 hover:text-gray-700 underline">Advanced: use a personal access token instead</button>
        ):(
          <>
            <label className="label">GitHub Personal Access Token</label>
            <input className="input mb-1" type="password" value={ghToken} onChange={e=>{setGhToken(e.target.value);setGhError('');}} placeholder="ghp_xxxxxxxxxxxx" onKeyDown={e=>{if(e.key==='Enter')connectGithub();}}/>
            <p className="text-xs text-gray-400 mb-3">Token needs <span className="font-medium">repo</span> access. <a href="https://github.com/settings/tokens/new?scopes=repo&description=Lythouse" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Create one →</a></p>
            <div className="flex justify-end gap-2">
              <button onClick={resetImport} className="btn-secondary">Cancel</button>
              <button onClick={connectGithub} disabled={ghConnecting||!ghToken.trim()} className="btn-primary">{ghConnecting?<Loader2 size={16} className="animate-spin"/>:<Github size={16}/>} Connect</button>
            </div>
          </>
        )}
      </>
    ):(
      <>
        <div className="mb-3 flex items-center justify-between rounded-lg bg-brand-50 border border-brand-200 px-3 py-2">
          <span className="text-sm text-brand-700 flex items-center gap-2">{ghUser.avatar_url&&<img src={ghUser.avatar_url} alt="" className="w-5 h-5 rounded-full"/>}Connected as <span className="font-semibold">@{ghUser.login}</span></span>
          <button onClick={()=>{setGhUser(null);setRepos([]);setRepoSearch('');}} className="text-xs text-gray-500 hover:text-gray-700 underline">Switch</button>
        </div>
        <input className="input mb-3" value={repoSearch} onChange={e=>setRepoSearch(e.target.value)} placeholder="Search your repositories…"/>
        <div className="space-y-1.5 max-h-[46vh] overflow-y-auto -mx-1 px-1">
          {repos.filter(r=>r.full_name?.toLowerCase().includes(repoSearch.toLowerCase())).map(r=>(
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#d4d4d8] px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/40 transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-navy-900 truncate">{r.name}</span>
                  <span className={`chip text-[10px] ${r.private?'bg-amber-50 text-amber-700 border border-amber-200':'bg-gray-100 text-gray-500 border border-[#d4d4d8]'}`}>{r.private?'private':'public'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  <span className="truncate">{r.full_name}</span>
                  {r.language&&<span className="shrink-0">· {r.language}</span>}
                </div>
              </div>
              <button onClick={()=>importRepo(r)} disabled={!!importingId} className="btn-primary text-xs shrink-0">{importingId===r.id?<Loader2 size={13} className="animate-spin"/>:<Plus size={13}/>} Import</button>
            </div>
          ))}
          {repos.length===0&&<p className="text-sm text-gray-400 py-6 text-center">No repositories found for this account.</p>}
          {repos.length>0&&repos.filter(r=>r.full_name?.toLowerCase().includes(repoSearch.toLowerCase())).length===0&&<p className="text-sm text-gray-400 py-6 text-center">No repositories match "{repoSearch}".</p>}
        </div>
      </>
    )}
  </>
)}
</div>
</div>
)}

<CreateProjectWizard
  open={creating}
  onClose={()=>setCreating(false)}
  workspaces={workspaces}
  selectedWs={selectedWs}
  existingNames={projects.map(p=>p.name)}
  onCreated={(data)=>{setProjects(prev=>[data,...prev]);setCreating(false);navigate(`/projects/${data.id}`);}}
/>
</div>;
}
