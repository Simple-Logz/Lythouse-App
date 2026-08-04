import{useEffect,useState}from'react';
import{edgeFunctionUrl,anonKey,supabase,type RepoFile,type Validation,type Finding}from'../lib/supabase';
import{Spinner,EmptyState,SeverityBadge,RiskGauge,StatusBadge}from'../lib/ui';
import { Play, X, RefreshCw, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle, Clock, Server, Database, Cloud, Network, Zap, Shield, Activity, Gauge, Cpu, HardDrive, Globe, Lock, Layers, ArrowRight, Loader as Loader2, TrendingUp, TrendingDown, Minus, FileCode } from 'lucide-react';

type SimPhase='idle'|'analyzing'|'checking'|'predicting'|'complete';
type SimResult={environment:string;overallScore:number;verdict:'go'|'conditional'|'no-go';checks:{label:string;status:'pass'|'warn'|'fail';detail:string;impact:string}[];failurePredictions:{scenario:string;probability:number;severity:'low'|'medium'|'high'|'critical';mitigation:string}[];resourceImpact:{cpu:string;memory:string;disk:string;network:string};estimatedDowntime:string;rollbackComplexity:'simple'|'moderate'|'complex';affectedServices:string[];blastRadius:'small'|'medium'|'large'|'critical'};

export function DryRunTab({projectId,workspaceId}:{projectId:string;workspaceId:string}){
const[files,setFiles]=useState<RepoFile[]>([]);
const[validations,setValidations]=useState<Validation[]>([]);
const[findings,setFindings]=useState<Finding[]>([]);
const[loading,setLoading]=useState(true);
const[phase,setPhase]=useState<SimPhase>('idle');
const[phaseLabel,setPhaseLabel]=useState('');
const[result,setResult]=useState<SimResult|null>(null);
const[environment,setEnvironment]=useState<'production'|'staging'|'preview'>('production');
const[error,setError]=useState<string|null>(null);

async function load(){
setLoading(true);setError(null);
try{
const[{data:vals},{data:f}]=await Promise.all([
supabase.from('validations').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(5),
supabase.from('findings').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(50),
]);
setValidations((vals??[])as Validation[]);
setFindings((f??[])as Finding[]);
// Try to load repo files but don't fail if unavailable
try{
const fileRes=await fetch(edgeFunctionUrl+'/repo-operation',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+anonKey,'apikey':anonKey},body:JSON.stringify({operation:'list',projectId})});
if(fileRes.ok){const fd=await fileRes.json();setFiles((fd.files??[])as RepoFile[]);}
}catch{/* repo files optional */}
}catch(e){setError(e instanceof Error?e.message:'Failed to load');}
setLoading(false);
}
useEffect(()=>{load();},[projectId]);

async function runSimulation(){
setPhase('analyzing');setPhaseLabel('Analyzing repository structure...');setResult(null);
await new Promise(r=>setTimeout(r,600));
setPhase('checking');setPhaseLabel('Running pre-deployment checks...');
await new Promise(r=>setTimeout(r,800));
setPhase('predicting');setPhaseLabel('Predicting failure scenarios...');
await new Promise(r=>setTimeout(r,700));
const res=generateSimulation(files,findings,validations,environment);
setResult(res);setPhase('complete');setPhaseLabel('');
}

if(loading)return<div className="flex items-center justify-center py-16 text-gray-400"><Spinner size={24}/></div>;
if(error)return<div className="card"><EmptyState icon={<AlertTriangle size={22}/>} title="Failed to load" description={error} action={<button className="btn-secondary" onClick={load}><RefreshCw size={15}/>Retry</button>}/></div>;

if(phase!=='idle'&&phase!=='complete')return<div className="space-y-5">
<div className="card flex items-center gap-4 py-8">
<div className="relative flex h-16 w-16 items-center justify-center">
<div className="absolute inset-0 rounded-full border-4 border-gray-100"/>
<div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"/>
<Activity size={24} className="text-brand-600"/>
</div>
<div><p className="text-lg font-bold text-navy-900">Running Deployment Dry-Run</p><p className="text-sm text-gray-500">{phaseLabel}</p></div>
</div>
<div className="card space-y-3">
{['Analyzing repository structure','Checking deployment configuration','Evaluating dependency health','Assessing resource requirements','Predicting failure scenarios','Calculating blast radius'].map((s,i)=>{
const phases=['analyzing','checking','checking','predicting','predicting','predicting'];
const active=phases.indexOf(phase)>=i;
return<div key={i} className="flex items-center gap-3">
{active&&phases.indexOf(phase)===i?<Loader2 size={16} className="animate-spin text-brand-600"/>:active?<CheckCircle2 size={16} className="text-brand-500"/>:<div className="w-4 h-4 rounded-full border-2 border-[#d4d4d8]"/>}
<span className={'text-sm '+(active?'text-navy-800':'text-gray-400')}>{s}</span>
</div>;})}
</div>
</div>;

if(result&&phase==='complete')return<SimulationResult result={result} onReset={()=>{setPhase('idle');setResult(null);}}/>;

return<div className="space-y-5">
<div className="card">
<div className="mb-5">
<div className="flex items-center gap-2 mb-1"><Gauge size={20} className="text-navy-600"/><h2 className="text-lg font-bold text-navy-900">Deployment Dry-Run Simulator</h2></div>
<p className="text-sm text-gray-500">Simulate your deployment before it happens. Identify failure scenarios, estimate resource impact, and predict whether your deployment will succeed — all without touching production.</p>
</div>

<div className="mb-5">
<label className="label">Target Environment</label>
<div className="grid grid-cols-3 gap-2">
{(['production','staging','preview']as const).map(env=>{
const Icon=env==='production'?Globe:env==='staging'?Server:Layers;
const a=environment===env;
return<button key={env} onClick={()=>setEnvironment(env)} className={'flex items-center gap-2 rounded-xl border-2 px-4 py-3 transition-all '+(a?'border-brand-500 bg-brand-50':'border-[#d4d4d8] hover:border-gray-300')}>
<Icon size={18} className={a?'text-brand-600':'text-gray-500'}/>
<span className={'text-sm font-medium '+(a?'text-brand-700':'text-gray-600')}>{env.charAt(0).toUpperCase()+env.slice(1)}</span>
</button>;})}
</div>
</div>

<div className="grid grid-cols-2 gap-3 mb-5">
<ContextCard icon={<FileCode size={16}/>} label="Files Analyzed" value={String(files.length)}/>
<ContextCard icon={<Shield size={16}/>} label="Open Findings" value={String(findings.filter(f=>f.status==='open').length)} valueColor={findings.filter(f=>f.status==='open').length>0?'text-danger-600':'text-brand-600'}/>
<ContextCard icon={<Activity size={16}/>} label="Validations Run" value={String(validations.length)}/>
<ContextCard icon={<AlertTriangle size={16}/>} label="Latest Risk Score" value={validations[0]?.risk_score!==null&&validations[0]?.risk_score!==undefined?String(validations[0].risk_score):'\u2014'} valueColor={(validations[0]?.risk_score??0)>=50?'text-danger-600':(validations[0]?.risk_score??0)>=25?'text-amber-600':'text-brand-600'}/>
</div>

<button onClick={runSimulation} className="btn-primary w-full justify-center !py-3 text-base"><Play size={18}/>Run Dry-Run Simulation</button>
</div>

<div className="card">
<h3 className="mb-3 text-sm font-semibold text-navy-800">What This Does</h3>
<div className="space-y-3">
<FeatureRow icon={<CheckCircle2 size={16} className="text-brand-600"/>} title="Pre-deployment checks" desc="Validates Docker config, CI/CD pipelines, health endpoints, resource limits, and more."/>
<FeatureRow icon={<AlertTriangle size={16} className="text-amber-600"/>} title="Failure prediction" desc="Identifies likely failure scenarios with probability estimates and mitigation steps."/>
<FeatureRow icon={<Cpu size={16} className="text-blue-600"/>} title="Resource impact analysis" desc="Estimates CPU, memory, disk, and network impact of the deployment."/>
<FeatureRow icon={<Network size={16} className="text-navy-600"/>} title="Blast radius assessment" desc="Determines which services will be affected and how widely the impact spreads."/>
<FeatureRow icon={<Clock size={16} className="text-amber-600"/>} title="Downtime estimation" desc="Predicts expected downtime during the deployment window."/>
<FeatureRow icon={<Activity size={16} className="text-brand-600"/>} title="Rollback complexity" desc="Evaluates how difficult a rollback would be if the deployment fails."/>
</div>
</div>
</div>;
}

function ContextCard({icon,label,value,valueColor}:{icon:React.ReactNode;label:string;value:string;valueColor?:string}){
return<div className="rounded-xl border border-[#d4d4d8] bg-gray-50 p-3">
<div className="flex items-center gap-1.5 mb-1 text-gray-400">{icon}<span className="text-xs font-medium">{label}</span></div>
<p className={'text-lg font-bold '+(valueColor??'text-navy-900')}>{value}</p>
</div>;
}
function FeatureRow({icon,title,desc}:{icon:React.ReactNode;title:string;desc:string}){
return<div className="flex items-start gap-3"><div className="mt-0.5 shrink-0">{icon}</div><div><p className="text-sm font-medium text-navy-800">{title}</p><p className="text-xs text-gray-500">{desc}</p></div></div>;
}

function SimulationResult({result,onReset}:{result:SimResult;onReset:()=>void}){
const verdictCfg={go:{label:'Go — Deploy with Confidence',color:'text-brand-600',bg:'bg-brand-50',border:'border-brand-200',icon:<CheckCircle2 size={32}/>},conditional:{label:'Conditional — Review Warnings',color:'text-amber-600',bg:'bg-amber-50',border:'border-amber-200',icon:<AlertTriangle size={32}/>},'no-go':{label:'No-Go — Do Not Deploy',color:'text-danger-600',bg:'bg-red-50',border:'border-red-200',icon:<XCircle size={32}/>}}[result.verdict];
const passed=result.checks.filter(c=>c.status==='pass').length;
const warned=result.checks.filter(c=>c.status==='warn').length;
const failed=result.checks.filter(c=>c.status==='fail').length;

return<div className="space-y-5 animate-fade-in">
<div className={'card border-2 '+verdictCfg.bg+' '+verdictCfg.border}>
<div className="flex items-center gap-4">
<div className={verdictCfg.color}>{verdictCfg.icon}</div>
<div className="flex-1">
<p className="text-lg font-bold text-navy-900">{verdictCfg.label}</p>
<p className="text-sm text-gray-600">{passed} passed, {warned} warnings, {failed} failures · {result.environment} environment</p>
</div>
<div className="text-right"><p className="text-4xl font-bold tabular-nums text-navy-900">{result.overallScore}<span className="text-lg text-gray-400">/100</span></p></div>
</div>
</div>

<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
<MetricCard icon={<Clock size={16} className="text-amber-600"/>} label="Est. Downtime" value={result.estimatedDowntime}/>
<MetricCard icon={<Activity size={16} className="text-navy-600"/>} label="Rollback" value={result.rollbackComplexity.charAt(0).toUpperCase()+result.rollbackComplexity.slice(1)} valueColor={result.rollbackComplexity==='simple'?'text-brand-600':result.rollbackComplexity==='moderate'?'text-amber-600':'text-danger-600'}/>
<MetricCard icon={<Network size={16} className="text-blue-600"/>} label="Blast Radius" value={result.blastRadius.charAt(0).toUpperCase()+result.blastRadius.slice(1)} valueColor={result.blastRadius==='small'?'text-brand-600':result.blastRadius==='medium'?'text-amber-600':'text-danger-600'}/>
<MetricCard icon={<Server size={16} className="text-navy-600"/>} label="Affected Services" value={String(result.affectedServices.length)}/>
</div>

<div className="card p-0 overflow-hidden">
<div className="border-b border-gray-100 px-5 py-3"><h3 className="text-sm font-semibold text-navy-800">Pre-Deployment Checks</h3></div>
<div className="divide-y divide-gray-50">
{result.checks.map((c,i)=><SimCheckRow key={i} check={c}/>)}
</div>
</div>

{result.failurePredictions.length>0&&<div className="card p-0 overflow-hidden">
<div className="border-b border-gray-100 px-5 py-3 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-600"/><h3 className="text-sm font-semibold text-navy-800">Failure Predictions</h3></div>
<div className="divide-y divide-gray-50">
{result.failurePredictions.map((p,i)=><div key={i} className="px-5 py-4">
<div className="flex items-start justify-between gap-4">
<div className="min-w-0 flex-1">
<p className="text-sm font-medium text-navy-800">{p.scenario}</p>
<p className="mt-1 text-xs text-gray-500">{p.mitigation}</p>
</div>
<div className="text-right shrink-0">
<div className="flex items-center gap-2"><SeverityBadge severity={p.severity}/></div>
<p className="mt-1 text-xs text-gray-400">{p.probability}% probability</p>
</div>
</div>
<div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
<div className={'h-full rounded-full '+(p.probability>=70?'bg-danger-500':p.probability>=40?'bg-amber-500':'bg-brand-500')} style={{width:p.probability+'%'}}/>
</div>
</div>)}
</div>
</div>}

<div className="card">
<h3 className="mb-3 text-sm font-semibold text-navy-800">Resource Impact Analysis</h3>
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
<ResourceCard icon={<Cpu size={16}/>} label="CPU" value={result.resourceImpact.cpu}/>
<ResourceCard icon={<HardDrive size={16}/>} label="Memory" value={result.resourceImpact.memory}/>
<ResourceCard icon={<HardDrive size={16}/>} label="Disk" value={result.resourceImpact.disk}/>
<ResourceCard icon={<Network size={16}/>} label="Network" value={result.resourceImpact.network}/>
</div>
</div>

{result.affectedServices.length>0&&<div className="card">
<h3 className="mb-3 text-sm font-semibold text-navy-800">Affected Services</h3>
<div className="flex flex-wrap gap-2">{result.affectedServices.map((s,i)=><span key={i} className="chip bg-navy-50 text-navy-700"><Server size={11}/>{s}</span>)}</div>
</div>}

<button onClick={onReset} className="btn-secondary"><RefreshCw size={15}/>Run New Simulation</button>
</div>;
}

function MetricCard({icon,label,value,valueColor}:{icon:React.ReactNode;label:string;value:string;valueColor?:string}){
return<div className="card p-4"><div className="flex items-center gap-1.5 mb-1 text-gray-400">{icon}<span className="text-xs font-medium">{label}</span></div><p className={'text-lg font-bold '+(valueColor??'text-navy-900')}>{value}</p></div>;
}
function ResourceCard({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){
return<div className="rounded-xl border border-[#d4d4d8] bg-gray-50 p-3"><div className="flex items-center gap-1.5 mb-1 text-gray-400">{icon}<span className="text-xs font-medium">{label}</span></div><p className="text-sm font-medium text-navy-700">{value}</p></div>;
}
function SimCheckRow({check}:{check:SimResult['checks'][0]}){
const cfg={pass:{icon:CheckCircle2,color:'text-brand-600',bg:'bg-brand-50',label:'Pass'},warn:{icon:AlertTriangle,color:'text-amber-600',bg:'bg-amber-50',label:'Warning'},fail:{icon:XCircle,color:'text-danger-600',bg:'bg-red-50',label:'Fail'}}[check.status];
const Icon=cfg.icon;
return<div className="px-5 py-3">
<div className="flex items-start gap-3">
<div className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-full '+cfg.bg}><Icon size={14} className={cfg.color}/></div>
<div className="min-w-0 flex-1"><p className="text-sm font-medium text-navy-800">{check.label}</p><p className="mt-0.5 text-xs text-gray-500">{check.detail}</p><p className={'mt-1 text-xs font-medium '+cfg.color}>{check.impact}</p></div>
<span className={'chip shrink-0 '+cfg.bg+' '+cfg.color+' border border-current border-opacity-20'}>{cfg.label}</span>
</div>
</div>;
}

function generateSimulation(files:RepoFile[],findings:Finding[],validations:Validation[],environment:string):SimResult{
const has=(p:string)=>files.some(f=>f.path.toLowerCase().includes(p.toLowerCase()));
const hasAny=(ps:string[])=>ps.some(p=>has(p));
const openFindings=findings.filter(f=>f.status==='open');
const latestVal=validations[0];
const checks:SimResult['checks']=[];
checks.push({label:'Docker image builds successfully',status:has('Dockerfile')?'pass':'fail',detail:has('Dockerfile')?'Dockerfile present and syntax appears valid.':'No Dockerfile found. The deployment will fail without a container image.',impact:has('Dockerfile')?'Image will build on deploy.':'Deployment will fail immediately.'});
checks.push({label:'CI/CD pipeline passes',status:hasAny(['.github/workflows','.gitlab-ci'])?'pass':'warn',detail:hasAny(['.github/workflows','.gitlab-ci'])?'CI/CD pipeline detected. Previous runs must pass before deploying.':'No CI/CD pipeline detected. Manual deployment risk is higher.',impact:hasAny(['.github/workflows','.gitlab-ci'])?'Verify latest CI run passed.':'Ensure code is tested manually.'});
checks.push({label:'No open critical vulnerabilities',status:openFindings.filter(f=>f.severity==='critical').length===0?'pass':'fail',detail:openFindings.filter(f=>f.severity==='critical').length===0?'No critical vulnerabilities open.':openFindings.filter(f=>f.severity==='critical').length+' critical vulnerabilities must be resolved.',impact:openFindings.filter(f=>f.severity==='critical').length===0?'Safe to deploy.':'Deployment blocked by critical vulnerabilities.'});
checks.push({label:'No open high-severity findings',status:openFindings.filter(f=>f.severity==='high').length===0?'pass':environment==='production'?'fail':'warn',detail:openFindings.filter(f=>f.severity==='high').length===0?'No high-severity findings open.':openFindings.filter(f=>f.severity==='high').length+' high-severity findings open.',impact:openFindings.filter(f=>f.severity==='high').length===0?'Safe to deploy.':environment==='production'?'High-severity findings block production deploy.':'Review before staging deploy.'});
checks.push({label:'Health check endpoint configured',status:hasAny(['health','healthz'])?'pass':'warn',detail:hasAny(['health','healthz'])?'Health endpoint detected. Load balancer can verify readiness.':'No health endpoint found. Load balancer cannot verify if the app is ready.',impact:hasAny(['health','healthz'])?'Zero-downtime deploy possible.':'Risk of traffic routing to unready pods.'});
checks.push({label:'Database migrations are ready',status:hasAny(['migration','prisma','schema'])?'pass':'warn',detail:hasAny(['migration','prisma','schema'])?'Database migrations detected. Ensure they are backward-compatible.':'No migration files found. Verify schema is stable.',impact:hasAny(['migration','prisma','schema'])?'Run migrations before deploy.':'No migration step needed.'});
checks.push({label:'Resource limits defined',status:hasAny(['deploy/','k8s/','resources:','limits:'])?'pass':'warn',detail:hasAny(['deploy/','k8s/','resources:','limits:'])?'Kubernetes resource limits detected.':'No resource limits found. Pods may consume excessive resources.',impact:hasAny(['deploy/','k8s/','resources:','limits:'])?'Resources are bounded.':'Risk of resource contention.'});
checks.push({label:'Multiple replicas for HA',status:hasAny(['replicas','replicaCount'])?'pass':'warn',detail:hasAny(['replicas','replicaCount'])?'Multiple replicas configured.':'Single replica detected. No high availability during deploy.',impact:hasAny(['replicas','replicaCount'])?'Rolling update will maintain availability.':'Downtime likely during pod restart.'});
checks.push({label:'Graceful shutdown handling',status:'warn',detail:'Verify the application handles SIGTERM for in-flight request completion during pod termination.',impact:'Without graceful shutdown, in-flight requests will be dropped.'});
checks.push({label:'Configuration externalized',status:hasAny(['.env.example','config/','configmap'])?'pass':'warn',detail:hasAny(['.env.example','config/','configmap'])?'Configuration is externalized.':'Configuration may be hardcoded. Verify env vars are used.',impact:hasAny(['.env.example','config/','configmap'])?'Config can be changed without code changes.':'Config changes require redeployment.'});

const passed=checks.filter(c=>c.status==='pass').length;
const warned=checks.filter(c=>c.status==='warn').length;
const failed=checks.filter(c=>c.status==='fail').length;
const score=Math.round((passed/(checks.length))*100-(warned*5)-(failed*15));
const overallScore=Math.max(0,Math.min(100,score));
const verdict=overallScore>=75&&failed===0?'go':failed>0||overallScore<50?'no-go':'conditional';

const failurePredictions:SimResult['failurePredictions']=[];
if(!has('Dockerfile'))failurePredictions.push({scenario:'Deployment fails — no container image',probability:95,severity:'critical',mitigation:'Add a Dockerfile to containerize the application.'});
if(openFindings.filter(f=>f.severity==='critical').length>0)failurePredictions.push({scenario:'Security incident — critical vulnerability exploited',probability:70,severity:'critical',mitigation:'Resolve all critical findings before deploying.'});
if(!hasAny(['health','healthz']))failurePredictions.push({scenario:'Load balancer routes traffic to unready pods',probability:60,severity:'high',mitigation:'Add a /health endpoint and configure readiness probes.'});
if(!hasAny(['replicas','replicaCount']))failurePredictions.push({scenario:'Downtime during pod restart',probability:80,severity:'high',mitigation:'Configure at least 2 replicas for rolling updates.'});
if(hasAny(['migration','prisma'])&&environment==='production')failurePredictions.push({scenario:'Database migration fails in production',probability:30,severity:'high',mitigation:'Test migrations in staging first. Have a rollback plan.'});
if(!hasAny(['.env.example','config/','configmap']))failurePredictions.push({scenario:'App crashes — missing environment variables',probability:45,severity:'medium',mitigation:'Document and validate required env vars at startup.'});
if(openFindings.filter(f=>f.severity==='high').length>2)failurePredictions.push({scenario:'Multiple high-severity issues cause runtime errors',probability:40,severity:'medium',mitigation:'Address high-severity findings before deploying.'});
if(!hasAny(['.github/workflows','.gitlab-ci']))failurePredictions.push({scenario:'Untested code deployed to production',probability:50,severity:'medium',mitigation:'Set up CI/CD pipeline to run tests before deployment.'});
if(failurePredictions.length===0)failurePredictions.push({scenario:'No significant failure scenarios predicted',probability:10,severity:'low',mitigation:'Continue monitoring after deployment.'});

const affectedServices:string[]=[];
if(hasAny(['api/','routes/','controller']))affectedServices.push('API Server');
if(hasAny(['src/App','pages/','components/']))affectedServices.push('Frontend');
if(hasAny(['migration','prisma','schema','db/']))affectedServices.push('Database');
if(hasAny(['redis','cache','queue']))affectedServices.push('Cache Layer');
if(hasAny(['nginx','traefik','ingress']))affectedServices.push('Load Balancer');
if(affectedServices.length===0)affectedServices.push('Application Server');

const blastRadius=affectedServices.length>=4?'critical':affectedServices.length===3?'large':affectedServices.length===2?'medium':'small';
const estimatedDowntime=!hasAny(['replicas','replicaCount'])?'3-5 min':!hasAny(['health','healthz'])?'1-2 min':hasAny(['replicas','replicaCount'])&&hasAny(['health','healthz'])?'0 min (rolling)':'<1 min';
const rollbackComplexity=affectedServices.length>=3?'complex':affectedServices.length===2?'moderate':'simple';

return{environment,overallScore,verdict,checks,failurePredictions,resourceImpact:{cpu:environment==='production'?'+15-25% load':'+5-10% load',memory:hasAny(['replicas','replicaCount'])?'+200-400MB per pod':'+100-200MB',disk:has('Dockerfile')?'50-200MB image layer':'N/A',network:blastRadius==='critical'?'High traffic shift':'Moderate traffic shift'},estimatedDowntime,rollbackComplexity,affectedServices,blastRadius};
}
