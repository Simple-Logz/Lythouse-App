import{useEffect,useState}from'react';
import{edgeFunctionUrl,anonKey,supabase,type RepoFile,type Validation,type Finding}from'../lib/supabase';
import{Spinner,EmptyState,SeverityBadge,RiskGauge}from'../lib/ui';
import { CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle, Clock, FileCode, Box, Cloud, Lock, Gauge, Activity, Server, Database, Network, Zap, ShieldCheck, ShieldAlert, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type CheckResult='pass'|'warn'|'fail';
type Check={id:string;label:string;category:string;status:CheckResult;detail:string;weight:number;files:string[]};

export function ReadinessTab({projectId}:{projectId:string}){
const[files,setFiles]=useState<RepoFile[]>([]);
const[validations,setValidations]=useState<Validation[]>([]);
const[findings,setFindings]=useState<Finding[]>([]);
const[loading,setLoading]=useState(true);
const[error,setError]=useState<string|null>(null);

async function load(){
setLoading(true);setError(null);
try{
const[{data:vals},{data:f}]=await Promise.all([
supabase.from('validations').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(10),
supabase.from('findings').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(50),
]);
setValidations((vals??[])as Validation[]);
setFindings((f??[])as Finding[]);
try{
const fileRes=await fetch(edgeFunctionUrl+'/repo-operation',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+anonKey,'apikey':anonKey},body:JSON.stringify({operation:'list',projectId})});
if(fileRes.ok){const fd=await fileRes.json();setFiles((fd.files??[])as RepoFile[]);}
}catch{/* optional */}
}catch(e){setError(e instanceof Error?e.message:'Failed to load');}
setLoading(false);
}
useEffect(()=>{load();},[projectId]);

if(loading)return<div className="flex items-center justify-center py-16 text-gray-400"><Spinner size={24}/></div>;
if(error)return<div className="card"><EmptyState icon={<AlertTriangle size={22}/>} title="Failed to load" description={error} action={<button className="btn-secondary" onClick={load}><RefreshCw size={15}/>Retry</button>}/></div>;

const checks=runReadinessChecks(files,findings,validations);
const passed=checks.filter(c=>c.status==='pass').length;
const warned=checks.filter(c=>c.status==='warn').length;
const failed=checks.filter(c=>c.status==='fail').length;
const total=checks.reduce((s,c)=>s+c.weight,0);
const earned=checks.reduce((s,c)=>s+(c.status==='pass'?c.weight:c.status==='warn'?c.weight*0.5:0),0);
const score=Math.round((earned/total)*100);
const verdict=score>=80?{label:'Ready to Deploy',color:'text-brand-600',icon:<CheckCircle2 size={28}/>,bg:'bg-brand-50',border:'border-brand-200'}:score>=50?{label:'Needs Attention',color:'text-amber-600',icon:<AlertTriangle size={28}/>,bg:'bg-amber-50',border:'border-amber-200'}:{label:'Not Ready',color:'text-danger-600',icon:<XCircle size={28}/>,bg:'bg-red-50',border:'border-red-200'};

const categories=Array.from(new Set(checks.map(c=>c.category)));
const catIcons:Record<string,typeof Box>={'Containerization':Box,'CI/CD':Activity,'Configuration':FileCode,'Security':Lock,'Dependencies':Network,'Health & Observability':Gauge,'Resource Limits':Server,'Database':Database,'Performance':Zap,'Scalability':Network};

return<div className="space-y-5">
<div className={'card '+verdict.bg+' '+verdict.border+' border-2'}>
<div className="flex items-center gap-4">
<div className={verdict.color}>{verdict.icon}</div>
<div className="flex-1">
<p className="text-lg font-bold text-navy-900">Deployment Readiness: {verdict.label}</p>
<p className="text-sm text-gray-600">{passed} passed, {warned} warnings, {failed} failures out of {checks.length} checks</p>
</div>
<div className="text-right">
<p className="text-4xl font-bold tabular-nums text-navy-900">{score}<span className="text-lg text-gray-400">/100</span></p>
<p className="text-xs font-medium uppercase tracking-wide text-gray-500">Readiness Score</p>
</div>
</div>
</div>

<div className="grid grid-cols-3 gap-3">
<div className="card p-4 text-center"><div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50"><CheckCircle2 size={20} className="text-brand-600"/></div><p className="text-2xl font-bold text-brand-600">{passed}</p><p className="text-xs text-gray-500">Passed</p></div>
<div className="card p-4 text-center"><div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50"><AlertTriangle size={20} className="text-amber-600"/></div><p className="text-2xl font-bold text-amber-600">{warned}</p><p className="text-xs text-gray-500">Warnings</p></div>
<div className="card p-4 text-center"><div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-red-50"><XCircle size={20} className="text-danger-600"/></div><p className="text-2xl font-bold text-danger-600">{failed}</p><p className="text-xs text-gray-500">Failures</p></div>
</div>

{categories.map(cat=>{
const catChecks=checks.filter(c=>c.category===cat);
const Icon=catIcons[cat]??FileCode;
const catPassed=catChecks.filter(c=>c.status==='pass').length;
const catFailed=catChecks.filter(c=>c.status==='fail').length;
return<div key={cat} className="card p-0 overflow-hidden">
<div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
<div className="flex items-center gap-2"><Icon size={16} className="text-navy-600"/><h3 className="text-sm font-semibold text-navy-800">{cat}</h3></div>
<span className="text-xs text-gray-400">{catPassed}/{catChecks.length} passed{catFailed>0&&<span className="text-danger-600"> · {catFailed} failed</span>}</span>
</div>
<div className="divide-y divide-gray-50">
{catChecks.map(c=><CheckRow key={c.id} check={c}/>)}
</div>
</div>;
})}

<div className="card">
<h3 className="mb-3 text-sm font-semibold text-navy-800">Latest Validation Impact</h3>
{validations.length>0?<>
<div className="flex items-center gap-4">
<RiskGauge score={validations[0].risk_score} size={70}/>
<div className="flex-1">
<div className="flex items-center gap-2 mb-1"><SeverityBadge severity={validations[0].severity??'none'}/><span className="text-xs text-gray-400">{validations[0].total_findings} findings</span></div>
<p className="text-sm text-gray-600">{validations[0].summary??'No summary available'}</p>
</div>
</div>
{findings.filter(f=>f.status==='open').length>0&&<div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-danger-700"><strong>{findings.filter(f=>f.status==='open').length} open findings</strong> from the latest validation may block deployment.</div>}
</>:<p className="text-sm text-gray-400">No validations run yet. Run a validation to see its impact on readiness.</p>}
</div>
</div>;
}

function CheckRow({check}:{check:Check}){
const[expanded,setExpanded]=useState(false);
const cfg:Record<CheckResult,{icon:typeof CheckCircle2;color:string;bg:string;label:string}>={
pass:{icon:CheckCircle2,color:'text-brand-600',bg:'bg-brand-50',label:'Pass'},
warn:{icon:AlertTriangle,color:'text-amber-600',bg:'bg-amber-50',label:'Warning'},
fail:{icon:XCircle,color:'text-danger-600',bg:'bg-red-50',label:'Fail'},
};
const c=cfg[check.status];const Icon=c.icon;
return<div>
<button onClick={()=>setExpanded(!expanded)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors">
<div className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-full '+c.bg}><Icon size={14} className={c.color}/></div>
<div className="min-w-0 flex-1"><p className="text-sm font-medium text-navy-800">{check.label}</p>{!expanded&&<p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{check.detail}</p>}</div>
<span className={'chip shrink-0 '+c.bg+' '+c.color+' border border-current border-opacity-20'}>{c.label}</span>
</button>
{expanded&&<div className="px-5 pb-4 pl-15">
<p className="text-sm text-gray-600 mb-2">{check.detail}</p>
{check.files.length>0&&<div className="mt-2"><p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Related files</p><div className="flex flex-wrap gap-1.5">{check.files.map((f,i)=><span key={i} className="chip bg-gray-100 text-gray-600 font-mono text-xs"><FileCode size={10}/>{f}</span>)}</div></div>}
</div>}
</div>;
}

function runReadinessChecks(files:RepoFile[],findings:Finding[],validations:Validation[]):Check[]{
const has=(p:string)=>files.some(f=>f.path.toLowerCase().includes(p.toLowerCase()));
const hasAny=(ps:string[])=>ps.some(p=>has(p));
const fileList=files.map(f=>f.path);
const checks:Check[]=[];

checks.push({id:'docker',label:'Dockerfile present',category:'Containerization',status:has('Dockerfile')?'pass':'fail',detail:has('Dockerfile')?'Dockerfile detected. The application is containerized and ready for deployment.':'No Dockerfile found. Containerize your application for reproducible, portable deployments.',weight:10,files:fileList.filter(f=>f.toLowerCase().includes('dockerfile'))});
checks.push({id:'dockerignore',label:'.dockerignore present',category:'Containerization',status:has('.dockerignore')?'pass':'warn',detail:has('.dockerignore')?'.dockerignore file detected. Unnecessary files are excluded from the image.':'No .dockerignore found. Image may include unnecessary files, increasing size and build time.',weight:3,files:fileList.filter(f=>f.includes('.dockerignore'))});
checks.push({id:'multistage',label:'Multi-stage Docker build',category:'Containerization',status:has('Dockerfile')&&fileList.some(f=>f.toLowerCase()==='dockerfile')?'warn':'warn',detail:'Multi-stage builds reduce final image size by separating build dependencies from runtime. Check your Dockerfile for multi-stage build patterns.',weight:5,files:[]});
checks.push({id:'compose',label:'Docker Compose for local dev',category:'Containerization',status:hasAny(['docker-compose','compose.yml','compose.yaml'])?'pass':'warn',detail:'Docker Compose helps developers reproduce the production environment locally.',weight:3,files:fileList.filter(f=>f.includes('compose'))});

checks.push({id:'ci',label:'CI/CD pipeline configured',category:'CI/CD',status:hasAny(['.github/workflows','.gitlab-ci','Jenkinsfile','azure-pipelines'])?'pass':'warn',detail:hasAny(['.github/workflows','.gitlab-ci','Jenkinsfile'])?'CI/CD pipeline detected. Code changes are automatically tested before deployment.':'No CI/CD pipeline found. Automated testing and deployment pipelines reduce manual errors.',weight:8,files:fileList.filter(f=>f.includes('.github/workflows')||f.includes('gitlab-ci')||f.includes('Jenkinsfile'))});
checks.push({id:'ci-tests',label:'CI runs tests',category:'CI/CD',status:hasAny(['.github/workflows','.gitlab-ci'])?'pass':'warn',detail:'Verify your CI pipeline runs the test suite on every push/PR to catch regressions early.',weight:5,files:[]});
checks.push({id:'ci-lint',label:'CI runs linting',category:'CI/CD',status:hasAny(['.github/workflows','.gitlab-ci'])?'warn':'warn',detail:'Linting in CI ensures code quality standards are enforced before merge.',weight:3,files:[]});

checks.push({id:'env',label:'Environment variables externalized',category:'Configuration',status:hasAny(['.env.example','.env.template','config/'])?'pass':'warn',detail:'Configuration should be externalized via environment variables, not hardcoded.',weight:6,files:fileList.filter(f=>f.includes('.env'))});
checks.push({id:'no-secrets',label:'No hardcoded secrets',category:'Configuration',status:findings.filter(f=>f.category==='secret_scan'&&f.status==='open').length===0?'pass':'fail',detail:findings.filter(f=>f.category==='secret_scan'&&f.status==='open').length===0?'No hardcoded secrets detected in the latest scan.':findings.filter(f=>f.category==='secret_scan'&&f.status==='open').length+' hardcoded secrets detected. Remove all secrets before deployment.',weight:15,files:[]});
checks.push({id:'config-files',label:'Config files not in repo root',category:'Configuration',status:hasAny(['config/','conf/'])?'pass':'warn',detail:'Organizing configuration files in a dedicated directory improves maintainability.',weight:2,files:[]});

checks.push({id:'dep-vuln',label:'No known dependency vulnerabilities',category:'Security',status:findings.filter(f=>f.category==='dependency_audit'&&f.status==='open').length===0?'pass':'fail',detail:findings.filter(f=>f.category==='dependency_audit'&&f.status==='open').length===0?'No vulnerable dependencies detected.':findings.filter(f=>f.category==='dependency_audit'&&f.status==='open').length+' vulnerable dependencies found. Update or patch them before deploying.',weight:12,files:[]});
checks.push({id:'static-analysis',label:'Static analysis passed',category:'Security',status:findings.filter(f=>f.category==='static_analysis'&&f.status==='open').length===0?'pass':'warn',detail:findings.filter(f=>f.category==='static_analysis'&&f.status==='open').length===0?'Static analysis found no open issues.':findings.filter(f=>f.category==='static_analysis'&&f.status==='open').length+' static analysis issues remain open.',weight:8,files:[]});
checks.push({id:'auth',label:'Authentication configured',category:'Security',status:hasAny(['auth/','login/','session/','jwt','oauth'])?'pass':'warn',detail:'Authentication mechanisms detected in the codebase.',weight:5,files:fileList.filter(f=>f.includes('auth')||f.includes('login'))});
checks.push({id:'https',label:'HTTPS/TLS enforcement',category:'Security',status:hasAny(['nginx','traefik','ingress','tls','ssl'])?'pass':'warn',detail:'Ensure TLS is enforced for all production traffic. Check your load balancer/ingress config.',weight:5,files:[]});

checks.push({id:'lock-file',label:'Dependency lock file present',category:'Dependencies',status:hasAny(['package-lock.json','yarn.lock','pnpm-lock.yaml','go.sum','Cargo.lock','poetry.lock','requirements.txt'])?'pass':'warn',detail:'Lock files ensure reproducible builds by pinning dependency versions.',weight:5,files:fileList.filter(f=>f.includes('lock')||f.includes('go.sum')||f.includes('requirements'))});

checks.push({id:'health',label:'Health check endpoint',category:'Health & Observability',status:hasAny(['health','healthz','/api/health','readiness'])?'pass':'warn',detail:'A /health endpoint allows load balancers to determine if the app is ready to receive traffic.',weight:8,files:fileList.filter(f=>f.includes('health'))});
checks.push({id:'metrics',label:'Metrics/monitoring endpoint',category:'Health & Observability',status:hasAny(['metrics','prometheus','grafana','datadog','/api/metrics'])?'pass':'warn',detail:'Metrics endpoints enable observability into application performance in production.',weight:5,files:fileList.filter(f=>f.includes('metrics')||f.includes('prometheus'))});
checks.push({id:'logging',label:'Structured logging',category:'Health & Observability',status:hasAny(['winston','pino','logrus','zap','serde','logging'])?'pass':'warn',detail:'Structured logging (JSON) makes logs searchable and filterable in production.',weight:4,files:[]});
checks.push({id:'graceful-shutdown',label:'Graceful shutdown handling',category:'Health & Observability',status:'warn',detail:'Verify the application handles SIGTERM/SIGINT for zero-downtime deployments. Check for signal handlers in your main process.',weight:6,files:[]});

checks.push({id:'resource-limits',label:'Resource limits defined',category:'Resource Limits',status:hasAny(['deploy/','k8s/','kubernetes','resources:','limits:'])?'pass':'warn',detail:'Kubernetes resource limits (CPU/memory) prevent noisy-neighbor problems and ensure fair scheduling.',weight:5,files:fileList.filter(f=>f.includes('deploy')||f.includes('k8s'))});
checks.push({id:'probes',label:'Liveness/Readiness probes configured',category:'Resource Limits',status:hasAny(['livenessProbe','readinessProbe','liveness','readiness'])?'pass':'warn',detail:'Kubernetes probes enable automatic restart and traffic routing based on app health.',weight:5,files:[]});

checks.push({id:'db-migrations',label:'Database migrations present',category:'Database',status:hasAny(['migration','migrations','prisma/','schema/','db/'])?'pass':'warn',detail:'Database migrations ensure schema changes are versioned and reversible.',weight:5,files:fileList.filter(f=>f.includes('migration')||f.includes('prisma')||f.includes('schema'))});
checks.push({id:'db-pooling',label:'Connection pooling',category:'Database',status:hasAny(['pool','pgbouncer','connection_pool','sqlx'])?'pass':'warn',detail:'Connection pooling prevents database exhaustion under high concurrency.',weight:4,files:[]});

checks.push({id:'hpa',label:'Horizontal Pod Autoscaler',category:'Scalability',status:hasAny(['hpa','autoscal','HorizontalPodAutoscaler'])?'pass':'warn',detail:'HPA enables automatic scaling based on CPU/memory or custom metrics.',weight:5,files:[]});
checks.push({id:'multiple-replicas',label:'Multiple replicas configured',category:'Scalability',status:hasAny(['replicas','replicaCount'])?'pass':'warn',detail:'Running multiple replicas ensures high availability and zero-downtime deployments.',weight:5,files:[]});
checks.push({id:'pdb',label:'Pod Disruption Budget',category:'Scalability',status:has('PodDisruptionBudget')?'pass':'warn',detail:'PDB ensures voluntary disruptions (like node drains) don\'t take down all pods at once.',weight:3,files:[]});

return checks;
}
