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
const[expanded,setExpanded]=useState<string|null>(null);
const[polling,setPolling]=useState<string|null>(null);

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
?<EmptyState icon={<FlaskConical size={22}/>} title="No simulations yet" description="Run a deployment simulation to predict risk scores, blast radius, and affected services before deploying." action={<button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/> New simulation</button>}/>
:<div className="space-y-4">
{simulations.map(s=>{
const isRunning=s.status==='running'||s.status==='pending';
const isDone=s.status==='completed';
const isFailed=s.status==='failed';
const isExpanded=expanded===s.id;
const verdict=isDone?(s.predicted_risk_score??0)<40?'go':(s.predicted_risk_score??0)<70?'conditional':'no-go':null;
const verdictStyle=verdict==='go'?'border-green-200 bg-green-50 text-green-700':verdict==='conditional'?'border-amber-200 bg-amber-50 text-amber-700':verdict==='no-go'?'border-red-200 bg-red-50 text-danger-600':'border-gray-200 bg-gray-50 text-gray-600';
return<div key={s.id} className="card p-0 overflow-hidden">
<button onClick={()=>setExpanded(isExpanded?null:s.id)} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 transition-colors">
{isExpanded?<ChevronDown size={16} className="text-gray-400"/>:<ChevronRight size={16} className="text-gray-400"/>}
<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><FlaskConical size={20}/></div>
<div className="flex-1 min-w-0">
<div className="flex flex-wrap items-center gap-2 mb-1">
<span className="text-sm font-semibold text-navy-900">{s.project_name??'Unknown project'}</span>
<span className={`chip border text-xs ${ENV_COLORS[s.environment]??'bg-gray-100 text-gray-600 border-gray-200'}`}>{s.environment}</span>
{isRunning&&<span className="flex items-center gap-1 text-xs text-brand-600"><RefreshCw size={11} className="animate-spin"/>Analyzing…</span>}
{isDone&&verdict&&<span className={`chip border text-xs font-semibold uppercase ${verdictStyle}`}>{verdict==='go'?'✓ Safe to deploy':verdict==='conditional'?'⚠ Review required':'⛔ Do not deploy'}</span>}
{isFailed&&<span className="chip border text-xs bg-red-50 text-danger-600 border-red-200">Failed</span>}
</div>
{isDone&&(
<div className="flex flex-wrap gap-3 text-xs text-gray-500">
{s.predicted_risk_score!==null&&<span>Risk score: <strong className={`${(s.predicted_risk_score??0)>70?'text-danger-600':(s.predicted_risk_score??0)>40?'text-amber-600':'text-green-600'}`}>{s.predicted_risk_score}/100</strong></span>}
{s.blast_radius&&<span>Blast radius: <strong className="text-navy-900 capitalize">{s.blast_radius}</strong></span>}
{s.confidence&&<span>Confidence: <strong className="text-navy-900">{s.confidence}%</strong></span>}
</div>
)}
</div>
{isDone&&s.predicted_risk_score!==null&&(
<div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${(s.predicted_risk_score??0)>70?'bg-red-50 text-danger-600':(s.predicted_risk_score??0)>40?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'}`}>
{s.predicted_risk_score}
</div>
)}
</button>

{isExpanded&&isDone&&(
<div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4 space-y-4">
{/* Verdict */}
<div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${verdictStyle}`}>
{verdict==='go'?<CheckCircle2 size={17} className="shrink-0 mt-0.5"/>:verdict==='no-go'?<AlertTriangle size={17} className="shrink-0 mt-0.5"/>:<Zap size={17} className="shrink-0 mt-0.5"/>}
<div>
<p className="text-sm font-bold">{verdict==='go'?'Safe to deploy to '+s.environment:verdict==='conditional'?'Conditional — review before deploying':'Do not deploy — risk too high'}</p>
<p className="text-xs mt-0.5 opacity-80">{s.impact_summary||'Simulation complete. Review results below.'}</p>
</div>
</div>

{/* Risk breakdown */}
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
{[
['Predicted Risk',`${s.predicted_risk_score??'—'}/100`,(s.predicted_risk_score??0)>70?'text-danger-600':(s.predicted_risk_score??0)>40?'text-amber-600':'text-green-600'],
['Blast Radius',s.blast_radius?s.blast_radius.charAt(0).toUpperCase()+s.blast_radius.slice(1):'—',s.blast_radius==='critical'?'text-danger-600':s.blast_radius==='large'?'text-amber-600':'text-green-600'],
['Confidence',s.confidence?`${s.confidence}%`:'—','text-navy-900'],
['Severity',s.predicted_severity?s.predicted_severity.charAt(0).toUpperCase()+s.predicted_severity.slice(1):'None',s.predicted_severity==='critical'?'text-danger-600':s.predicted_severity==='high'?'text-amber-600':'text-green-600'],
].map(([label,val,color])=>(
<div key={label as string} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-center">
<p className={`text-lg font-bold ${color}`}>{val}</p>
<p className="text-xs text-gray-500 mt-0.5">{label}</p>
</div>
))}
</div>

{/* Affected services */}
{s.affected_services&&s.affected_services.length>0&&(
<div>
<p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Affected Services</p>
<div className="flex flex-wrap gap-2">
{s.affected_services.map((svc:string)=>(
<span key={svc} className="chip bg-gray-100 text-gray-700 border border-gray-200">{svc}</span>
))}
</div>
</div>
)}

{/* Rollback plan */}
{s.rollback_plan&&(
<div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
<p className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-1">Rollback Plan</p>
<p className="text-sm text-brand-900">{s.rollback_plan}</p>
</div>
)}
</div>
)}

{isExpanded&&isRunning&&(
<div className="border-t border-gray-100 bg-gray-50/50 px-4 py-6 text-center">
<RefreshCw size={20} className="animate-spin text-brand-500 mx-auto mb-2"/>
<p className="text-sm text-gray-600">Analyzing your deployment…</p>
<p className="text-xs text-gray-400 mt-1">This takes about 10-15 seconds</p>
</div>
)}
</div>;
})}
</div>}
</div>;
}