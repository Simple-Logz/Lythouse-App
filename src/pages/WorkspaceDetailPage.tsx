import{useEffect,useState,useCallback}from'react';
import{supabase,type Project,type Validation,type WorkspacePlan,PLANS,type PlanId}from'../lib/supabase';
import{PageHeader,Spinner,EmptyState,StatusBadge,SeverityBadge,RiskGauge,timeAgo,toast}from'../lib/ui';
import{Link,useRouter}from'../lib/router';
import{FolderGit2,Users,ShieldCheck,ShieldAlert,Plus,Settings,Boxes,Activity,AlertTriangle,CheckCircle2,TrendingUp,Play,ArrowRight,Sparkles}from'lucide-react';

type Tab='overview'|'projects'|'members'|'settings';

export function WorkspaceDetailPage({workspaceId}:{workspaceId:string}){
  const{navigate}=useRouter();
  const[loading,setLoading]=useState(true);
  const[workspace,setWorkspace]=useState<any>(null);
  const[projects,setProjects]=useState<Project[]>([]);
  const[validations,setValidations]=useState<Validation[]>([]);
  const[members,setMembers]=useState<any[]>([]);
  const[plan,setPlan]=useState<WorkspacePlan|null>(null);
  const[tab,setTab]=useState<Tab>('overview');
  const[wsName,setWsName]=useState('');
  const[wsDesc,setWsDesc]=useState('');
  const[saving,setSaving]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    const[wsRes,prRes,vlRes,mbRes,plRes]=await Promise.all([
      supabase.from('workspaces').select('*').eq('id',workspaceId).single(),
      supabase.from('projects').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
      supabase.from('validations').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(10),
      supabase.from('workspace_members').select('*').eq('workspace_id',workspaceId),
      supabase.from('workspace_plans').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(1),
    ]);
    if(wsRes.error){setLoading(false);return;}
    setWorkspace(wsRes.data);
    setWsName(wsRes.data.name);
    setWsDesc(wsRes.data.description||'');
    setProjects(prRes.data??[]);
    setValidations(vlRes.data??[]);
    const mData=mbRes.data??[];
    if(mData.length>0){
      const{data:profiles}=await supabase.from('profiles').select('id,email,full_name').in('id',mData.map((m:any)=>m.user_id));
      const pMap=Object.fromEntries((profiles??[]).map((p:any)=>[p.id,p]));
      setMembers(mData.map((m:any)=>({...m,profile:pMap[m.user_id]??null})));
    }
    setPlan(plRes.data?.[0]??null);
    setLoading(false);
  },[workspaceId]);

  useEffect(()=>{
    localStorage.setItem('sandbox.activeWs',workspaceId);
    load();
  },[load,workspaceId]);

  const saveSettings=async()=>{
    setSaving(true);
    await supabase.from('workspaces').update({name:wsName.trim(),description:wsDesc.trim()||null}).eq('id',workspaceId);
    setWorkspace((w:any)=>({...w,name:wsName.trim(),description:wsDesc.trim()||null}));
    setSaving(false);
  };

  if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;
  if(!workspace)return<div className="p-8 text-center text-gray-500">Workspace not found.</div>;

  const planId=(plan?.plan_id as PlanId)??'free';
  const planInfo=PLANS[planId];
  const openFindings=validations.reduce((a,v)=>a+(v.critical_count+v.high_count),0);
  const avgRisk=validations.filter(v=>v.risk_score!==null).length>0
    ?Math.round(validations.filter(v=>v.risk_score!==null).reduce((a,v)=>a+(v.risk_score??0),0)/validations.filter(v=>v.risk_score!==null).length)
    :null;

  const TABS=[
    {id:'overview',label:'Overview',icon:Activity},
    {id:'projects',label:`Projects (${projects.length})`,icon:FolderGit2},
    {id:'members',label:`Members (${members.length})`,icon:Users},
    {id:'settings',label:'Settings',icon:Settings},
  ];

  return(
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Boxes size={22}/>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-navy-900">{workspace.name}</h1>
                <span className={`chip border ${planInfo.badge}`}><Sparkles size={11}/>{planInfo.name}</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{workspace.description||'No description'} · Created {new Date(workspace.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <Link to="/workspaces" className="btn-secondary text-sm">← All workspaces</Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-[#71717a]">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as Tab)} className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab===t.id?'tab-active':'tab-inactive'}`}>
            <t.icon size={15}/>{t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab==='overview'&&(
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              {label:'Projects',value:projects.length,icon:FolderGit2,color:'bg-blue-50 text-blue-600'},
              {label:'Validations',value:validations.length,icon:ShieldCheck,color:'bg-brand-50 text-brand-600'},
              {label:'Avg Risk Score',value:avgRisk!==null?avgRisk:'—',icon:Activity,color:avgRisk!==null&&avgRisk>70?'bg-red-50 text-danger-600':avgRisk!==null&&avgRisk>40?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'},
              {label:'Members',value:members.length,icon:Users,color:'bg-purple-50 text-purple-600'},
            ].map(s=>(
              <div key={s.label} className="card flex items-center gap-3 py-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.color}`}><s.icon size={18}/></div>
                <div>
                  <p className="text-2xl font-bold text-navy-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Deployment readiness */}
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${openFindings>0?'border-amber-200 bg-amber-50':'border-green-200 bg-green-50'}`}>
            {openFindings>0?<AlertTriangle size={17} className="text-amber-600 shrink-0"/>:<CheckCircle2 size={17} className="text-green-600 shrink-0"/>}
            <div>
              <p className={`text-sm font-semibold ${openFindings>0?'text-amber-800':'text-green-800'}`}>
                {openFindings>0?`${openFindings} critical/high findings need attention`:'No critical findings — workspace looks healthy'}
              </p>
              <p className={`text-xs mt-0.5 ${openFindings>0?'text-amber-600':'text-green-600'}`}>
                {validations.length>0?`Based on ${validations.length} validation run${validations.length!==1?'s':''}. Last run ${timeAgo(validations[0].created_at)}.`:'No validations run yet.'}
              </p>
            </div>
          </div>

          {/* Recent projects */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-navy-900">Projects</h2>
              <button onClick={()=>setTab('projects')} className="text-sm text-brand-600 hover:underline">View all →</button>
            </div>
            {projects.length===0
              ?<div className="card text-center py-8">
                <FolderGit2 size={28} className="mx-auto text-gray-300 mb-3"/>
                <p className="text-sm font-medium text-gray-600">No projects yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Connect a repository to start scanning</p>
                <Link to="/projects" className="btn-primary text-sm inline-flex"><Plus size={14}/>New project</Link>
              </div>
              :<div className="grid gap-3 sm:grid-cols-2">
                {projects.slice(0,4).map(p=>(
                  <Link key={p.id} to={`/projects/${p.id}`} className="card hover:shadow-md transition-all hover:-translate-y-0.5 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><FolderGit2 size={16}/></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{p.git_url||'No repo connected'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="chip bg-green-50 text-green-700 border border-green-200 capitalize">{p.status}</span>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-gray-300 shrink-0 mt-1"/>
                  </Link>
                ))}
              </div>
            }
          </div>

          {/* Recent validations */}
          {validations.length>0&&(
            <div>
              <h2 className="text-base font-semibold text-navy-900 mb-3">Recent Validations</h2>
              <div className="card p-0 divide-y divide-gray-100">
                {validations.slice(0,5).map(v=>(
                  <div key={v.id} className="flex items-center gap-3 px-4 py-3">
                    <StatusBadge status={v.status}/>
                    {v.severity&&<SeverityBadge severity={v.severity}/>}
                    <span className="text-sm text-gray-600 flex-1">{v.total_findings} findings</span>
                    <RiskGauge score={v.risk_score} size={40}/>
                    <span className="text-xs text-gray-400">{timeAgo(v.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Projects tab */}
      {tab==='projects'&&(
        <div>
          <div className="flex justify-end mb-4">
            <Link to="/projects" className="btn-primary"><Plus size={15}/>New project</Link>
          </div>
          {projects.length===0
            ?<EmptyState icon={<FolderGit2 size={22}/>} title="No projects yet" description="Create a project to connect a repository and start validating." action={<Link to="/projects" className="btn-primary"><Plus size={15}/>New project</Link>}/>
            :<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map(p=>(
                <Link key={p.id} to={`/projects/${p.id}`} className="card hover:shadow-md transition-all hover:-translate-y-0.5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><FolderGit2 size={18}/></div>
                    <span className="chip bg-green-50 text-green-700 border border-green-200 capitalize">{p.status}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-navy-900">{p.name}</h3>
                  {p.description&&<p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
                  <p className="text-xs text-gray-400 mt-2 truncate font-mono">{p.git_url||'No repo'}</p>
                </Link>
              ))}
            </div>
          }
        </div>
      )}

      {/* Members tab */}
      {tab==='members'&&(
        <div>
          <div className="flex justify-end mb-4">
            <Link to="/team" className="btn-primary"><Users size={15}/>Manage team</Link>
          </div>
          {members.length===0
            ?<EmptyState icon={<Users size={22}/>} title="No members" description="Invite team members from the Team page."/>
            :<div className="card p-0 divide-y divide-gray-100">
              {members.map(m=>(
                <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-sm font-bold">
                    {(m.profile?.full_name||m.profile?.email||'?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy-900">{m.profile?.full_name||m.profile?.email||m.user_id.slice(0,8)}</p>
                    {m.profile?.email&&<p className="text-xs text-gray-500">{m.profile.email}</p>}
                  </div>
                  <span className="chip bg-gray-100 text-gray-600 border border-[#71717a] capitalize">{m.role}</span>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* Settings tab */}
      {tab==='settings'&&(
        <div className="card max-w-lg">
          <h2 className="text-base font-semibold text-navy-900 mb-4">Workspace Settings</h2>
          <label className="label">Name</label>
          <input className="input mb-3" value={wsName} onChange={e=>setWsName(e.target.value)}/>
          <label className="label">Description</label>
          <textarea className="input mb-5" rows={3} value={wsDesc} onChange={e=>setWsDesc(e.target.value)} placeholder="What is this workspace for?"/>
          <div className="flex gap-2">
            <button onClick={saveSettings} disabled={saving||!wsName.trim()} className="btn-primary">
              {saving?'Saving…':'Save changes'}
            </button>
          </div>
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Workspace ID</p>
            <p className="text-xs text-gray-500 font-mono">{workspaceId}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 mt-3">Slug</p>
            <p className="text-xs text-gray-500 font-mono">{workspace.slug}</p>
          </div>
          <div className="mt-8 pt-6 border-t border-red-100">
            <h3 className="text-sm font-semibold text-danger-600 mb-1">Danger Zone</h3>
            <p className="text-xs text-gray-500 mb-3">Deleting this workspace permanently removes all projects, validations, and findings. This cannot be undone.</p>
            <button onClick={async()=>{
              if(!confirm(`Delete workspace "${workspace.name}"? This will permanently delete all projects and data inside it.`))return;
              const confirmed=prompt(`Type the workspace name "${workspace.name}" to confirm deletion:`);
              if(confirmed!==workspace.name){toast('Name did not match. Workspace not deleted.','error');return;}
              await supabase.from('workspaces').delete().eq('id',workspaceId);
              localStorage.removeItem('sandbox.activeWs');
              navigate('/workspaces');
            }} className="px-4 py-2 text-sm font-medium text-danger-600 border border-red-200 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">
              Delete workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
