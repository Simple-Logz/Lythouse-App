import{useEffect,useState}from'react';
import{supabase,type DeploymentSimulation,type Project}from'../lib/supabase';
import{PageHeader,Spinner,EmptyState,RiskGauge,StatusBadge}from'../lib/ui';
import{FlaskConical,Plus,X,Loader as Loader2,Activity,Boxes}from'lucide-react';

type SRow=DeploymentSimulation&{project_name?:string;}

const ENV_COLORS:Record<string,string>={
production:'bg-red-50 text-danger-600 border-red-200',
staging:'bg-amber-50 text-amber-600 border-amber-200',
preview:'bg-blue-50 text-blue-600 border-blue-200',
};
const BLAST_COLORS:Record<string,string>={
small:'bg-brand-50 text-brand-700 border-brand-200',
medium:'bg-blue-50 text-blue-600 border-blue-200',
large:'bg-amber-50 text-amber-600 border-amber-200',
critical:'bg-red-50 text-danger-600 border-red-200',
};

export function SimulatorPage(){
const[loading,setLoading]=useState(true);
const[simulations,setSimulations]=useState<SRow[]>([]);
const[projects,setProjects]=useState<Project[]>([]);
const[creating,setCreating]=useState(false);
const[selProject,setSelProject]=useState('');
const[selEnv,setSelEnv]=useState<DeploymentSimulation['environment']>('staging');
const[overrides,setOverrides]=useState('');
const[saving,setSaving]=useState(false);
const[error,setError]=useState('');

const wsId=()=>localStorage.getItem('sandbox.activeWs');

const load=async()=>{
  setLoading(true);
  const wid=wsId();
  if(!wid){setLoading(false);return;}
  const[sm,pr]=await Promise.all([
    supabase.from('deployment_simulations').select('*,projects(name)').eq('workspace_id',wid).order('created_at',{ascending:false}),
    supabase.from('projects').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}),
  ]);
  if(sm.error)console.error(sm.error);
  if(pr.error)console.error(pr.error);
  setSimulations((sm.data??[]).map((r:any)=>({...r,project_name:(r as any).projects?.name}))as SRow[]);
  setProjects(pr.data??[]);
  setLoading(false);
};

useEffect(()=>{load();},[]);

const createSimulation=async()=>{
  const wid=wsId();
  if(!wid||!selProject){setError('Select a project');return;}
  setSaving(true);setError('');
  let cfg:Record<string,unknown>={};
  try{cfg=overrides.trim()?JSON.parse(overrides):{};}catch{setError('Config overrides must be valid JSON');setSaving(false);return;}
  const{data,error}=await supabase.from('deployment_simulations').insert({
    workspace_id:wid,project_id:selProject,environment:selEnv,config_overrides:cfg,
    affected_services:[],simulation_metadata:{},status:'pending',
  }).select().single();
  if(error){setError(error.message);setSaving(false);return;}
  const proj=projects.find(p=>p.id===selProject);
  setSimulations(prev=>[{...data,project_name:proj?.name},...prev]);
  setCreating(false);setSelProject('');setOverrides('');setSaving(false);
};

if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

return<div>
<PageHeader title="Deployment Simulator" description="Simulate deployments to predict risk and blast radius before shipping." actions={
<button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/> New simulation</button>
}/>

{simulations.length===0
?<EmptyState icon={<FlaskConical size={22}/>} title="No simulations yet" description="Run a deployment simulation to predict risk scores, blast radius, and affected services." action={<button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/> New simulation</button>}/>
:<div className="grid gap-4 lg:grid-cols-2">
{simulations.map(s=>(
<div key={s.id} className="card">
<div className="flex items-start justify-between">
<div className="flex items-center gap-3">
<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><FlaskConical size={20}/></div>
<div>
<h3 className="text-sm font-semibold text-navy-900">{s.project_name??'Unknown'}</h3>
<div className="mt-1 flex items-center gap-2">
<span className={`chip border ${ENV_COLORS[s.environment]??''}`}>{s.environment}</span>
<StatusBadge status={s.status}/>
</div>
</div>
</div>
<RiskGauge score={s.predicted_risk_score} size={80}/>
</div>
<div className="mt-4 grid grid-cols-2 gap-3">
<div className="rounded-lg bg-gray-50 p-3">
<p className="text-xs font-medium uppercase tracking-wide text-gray-400">Blast Radius</p>
{s.blast_radius
?<span className={`chip mt-1 border ${BLAST_COLORS[s.blast_radius]??''}`}>{s.blast_radius}</span>
:<span className="mt-1 block text-sm text-gray-400">—</span>}
</div>
<div className="rounded-lg bg-gray-50 p-3">
<p className="text-xs font-medium uppercase tracking-wide text-gray-400">Affected Services</p>
{s.affected_services.length
?<div className="mt-1 flex flex-wrap gap-1">{s.affected_services.slice(0,3).map((sv,i)=><span key={i} className="chip bg-white text-gray-600 border border-gray-200"><Boxes size={10}/>{sv}</span>)}{s.affected_services.length>3&&<span className="text-xs text-gray-400">+{s.affected_services.length-3}</span>}</div>
:<span className="mt-1 block text-sm text-gray-400">None</span>}
</div>
</div>
{s.impact_summary&&<p className="mt-3 text-sm text-gray-500">{s.impact_summary}</p>}
</div>
))}
</div>}

{creating&&(
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setCreating(false)}>
<div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-5 shadow-xl" onClick={e=>e.stopPropagation()}>
<div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">New simulation</h2><button onClick={()=>setCreating(false)} className="btn-ghost p-1"><X size={16}/></button></div>
{error&&<div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-danger-600">{error}</div>}
<label className="label">Project</label>
<select className="input mb-3" value={selProject} onChange={e=>setSelProject(e.target.value)}>
<option value="">Select a project…</option>
{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
</select>
<label className="label">Environment</label>
<select className="input mb-3" value={selEnv} onChange={e=>setSelEnv(e.target.value as any)}>
<option value="production">Production</option><option value="staging">Staging</option><option value="preview">Preview</option>
</select>
<label className="label">Config overrides (JSON)</label>
<textarea className="input mb-4" rows={4} value={overrides} onChange={e=>setOverrides(e.target.value)} placeholder='{"replicas":3}'/>
<div className="flex justify-end gap-2"><button onClick={()=>setCreating(false)} className="btn-secondary">Cancel</button><button onClick={createSimulation} disabled={saving||!selProject} className="btn-primary">{saving?<Loader2 size={16} className="animate-spin"/>:<Activity size={16}/>} Run</button></div>
</div>
</div>
)}
</div>;
}
