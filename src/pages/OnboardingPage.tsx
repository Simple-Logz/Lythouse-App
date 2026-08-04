import{useState}from'react';
import{supabase}from'../lib/supabase';
import{useAuth}from'../lib/auth';
import{Logo,Spinner}from'../lib/ui';
import{useRouter}from'../lib/router';
import{FolderGit2,Users,ShieldCheck,ArrowRight,Check,Loader as Loader2}from'lucide-react';

type Step='workspace'|'project'|'done';

export function OnboardingPage(){
  const{user,profile}=useAuth();
  const{navigate}=useRouter();
  const[step,setStep]=useState<Step>('workspace');
  const[wsName,setWsName]=useState(()=>localStorage.getItem('lh.pendingAccount')||'');
  const[wsDesc,setWsDesc]=useState('');
  const[projName,setProjName]=useState('');
  const[gitUrl,setGitUrl]=useState('');
  const[gitBranch,setGitBranch]=useState('main');
  const[token,setToken]=useState('');
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const[wsId,setWsId]=useState('');
  const[skipProject,setSkipProject]=useState(false);

  const createWorkspace=async()=>{
    if(!wsName.trim())return;
    setSaving(true);setError('');
    const slug=wsName.trim().toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-');
    const{data,error}=await supabase.from('workspaces').insert({
      name:wsName.trim(),
      slug:`${slug}-${Date.now()}`,
      description:wsDesc.trim()||null,
    }).select().single();
    if(error){setError(error.message);setSaving(false);return;}
    localStorage.setItem('sandbox.activeWs',data.id);
    setWsId(data.id);
    setStep('project');
    setSaving(false);
  };

  const createProject=async()=>{
    if(!projName.trim()||!wsId)return;
    setSaving(true);setError('');
    const{error}=await supabase.from('projects').insert({
      workspace_id:wsId,
      name:projName.trim(),
      git_url:gitUrl.trim()||'',
      git_branch:gitBranch.trim()||'main',
      repo_folder:'',
      github_token:token.trim()||null,
      status:'active',
    });
    if(error){setError(error.message);setSaving(false);return;}
    setStep('done');
    setSaving(false);
  };

  const finish=()=>navigate('/dashboard');

  const STEPS=[{id:'workspace',label:'Workspace'},{id:'project',label:'First project'},{id:'done',label:'Ready'}];
  const stepIdx=STEPS.findIndex(s=>s.id===step);

  return(
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-[#71717a] px-6 py-4">
        <Logo size={26}/>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Progress */}
          <div className="mb-8 flex items-center gap-0">
            {STEPS.map((s,i)=>(
              <div key={s.id} className="flex items-center flex-1">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${i<stepIdx?'bg-brand-600 text-white':i===stepIdx?'bg-brand-600 text-white ring-4 ring-brand-100':'bg-gray-200 text-gray-500'}`}>
                  {i<stepIdx?<Check size={14}/>:i+1}
                </div>
                <div className="ml-2 flex-1">
                  <p className={`text-xs font-medium ${i<=stepIdx?'text-navy-900':'text-gray-400'}`}>{s.label}</p>
                </div>
                {i<STEPS.length-1&&<div className={`h-px w-8 ${i<stepIdx?'bg-brand-600':'bg-gray-200'}`}/>}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-[#71717a] p-8 shadow-sm">
            {step==='workspace'&&(
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 mb-5"><Users size={22}/></div>
                <h1 className="text-xl font-bold text-navy-900 mb-1">Create your workspace</h1>
                <p className="text-sm text-gray-500 mb-6">A workspace is where your team collaborates on projects and validations.</p>
                {error&&<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger-600">{error}</div>}
                <label className="label">Workspace name <span className="text-danger-600">*</span></label>
                <input className="input mb-3" value={wsName} onChange={e=>setWsName(e.target.value)} placeholder="e.g. Acme Engineering" autoFocus onKeyDown={e=>e.key==='Enter'&&createWorkspace()}/>
                <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <input className="input mb-6" value={wsDesc} onChange={e=>setWsDesc(e.target.value)} placeholder="What does your team work on?"/>
                <button onClick={createWorkspace} disabled={saving||!wsName.trim()} className="btn-primary w-full py-2.5">
                  {saving?<Loader2 size={16} className="animate-spin"/>:<>Continue<ArrowRight size={15}/></>}
                </button>
              </>
            )}

            {step==='project'&&(
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 mb-5"><FolderGit2 size={22}/></div>
                <h1 className="text-xl font-bold text-navy-900 mb-1">Connect your first project</h1>
                <p className="text-sm text-gray-500 mb-6">Connect a Git repository to start scanning for risks before deployment.</p>
                {error&&<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger-600">{error}</div>}
                <label className="label">Project name <span className="text-danger-600">*</span></label>
                <input className="input mb-3" value={projName} onChange={e=>setProjName(e.target.value)} placeholder="My App" autoFocus/>
                <label className="label">GitHub repository URL</label>
                <input className="input mb-3" value={gitUrl} onChange={e=>setGitUrl(e.target.value)} placeholder="https://github.com/org/repo"/>
                <label className="label">Branch</label>
                <input className="input mb-3" value={gitBranch} onChange={e=>setGitBranch(e.target.value)} placeholder="main"/>
                <label className="label">GitHub Personal Access Token</label>
                <input className="input mb-6" type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx"/>
                <div className="flex flex-col gap-2">
                  <button onClick={createProject} disabled={saving||!projName.trim()} className="btn-primary w-full py-2.5">
                    {saving?<Loader2 size={16} className="animate-spin"/>:<>Create project<ArrowRight size={15}/></>}
                  </button>
                  <button onClick={()=>setStep('done')} className="btn-secondary w-full py-2.5 text-gray-500">Skip for now</button>
                </div>
              </>
            )}

            {step==='done'&&(
              <div className="text-center py-4">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 border-2 border-green-200">
                  <ShieldCheck size={30} className="text-green-600"/>
                </div>
                <h1 className="text-xl font-bold text-navy-900 mb-2">You're all set!</h1>
                <p className="text-sm text-gray-500 mb-8">Your workspace is ready. Start by running a validation on your project to see your deployment risk score.</p>
                <button onClick={finish} className="btn-primary w-full py-2.5">
                  Go to dashboard<ArrowRight size={15}/>
                </button>
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">You can change all of this later in Settings.</p>
        </div>
      </div>
    </div>
  );
}
