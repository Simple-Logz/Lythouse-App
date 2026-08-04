// @ts-nocheck
import{useEffect,useState}from'react';
import{edgeFunctionUrl,anonKey,supabase,type RepoFile,type Finding}from'../lib/supabase';
import{Spinner,EmptyState,SeverityBadge}from'../lib/ui';
import { Package, TriangleAlert as AlertTriangle, ShieldCheck, ShieldAlert, ShieldX, RefreshCw, CircleCheck as CheckCircle2, Circle as XCircle, FileCode, GitBranch, Lock, Cpu, HardDrive, Clock, TrendingUp, TrendingDown, Minus, PackageCheck, PackageX, Package as PackageAlert } from 'lucide-react';

type DepInfo={name:string;version:string;source:string;vulnerable:boolean;severity:'low'|'medium'|'high'|'critical'|null;cve:string|null;fixVersion:string|null;file:string;outdated:boolean;latestVersion:string|null;type:'runtime'|'dev'|'unknown'};

export function DependenciesTab({projectId}:{projectId:string}){
const[deps,setDeps]=useState<DepInfo[]>([]);
const[files,setFiles]=useState<RepoFile[]>([]);
const[loading,setLoading]=useState(true);
const[error,setError]=useState<string|null>(null);
const[filter,setFilter]=useState<'all'|'vulnerable'|'outdated'>('all');

async function load(){
setLoading(true);setError(null);
try{
const fileRes=await fetch(edgeFunctionUrl+'/repo-operation',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+anonKey,'apikey':anonKey},body:JSON.stringify({operation:'list',projectId})});
if(!fileRes.ok)throw new Error('Failed to fetch repo files');
const fd=await fileRes.json();
const fileList=(fd.files??[])as RepoFile[];
setFiles(fileList);
let parsedDeps:DepInfo[]=[];
try{
const contentRes=await fetch(edgeFunctionUrl+'/repo-operation',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+anonKey,'apikey':anonKey},body:JSON.stringify({operation:'read',projectId,path:'package.json'})});
if(contentRes.ok){const cd=await contentRes.json();parsedDeps=parsePackageJson(cd.content??'');}}
catch{}
if(parsedDeps.length===0){
try{
const contentRes=await fetch(edgeFunctionUrl+'/repo-operation',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+anonKey,'apikey':anonKey},body:JSON.stringify({operation:'read',projectId,path:'go.mod'})});
if(contentRes.ok){const cd=await contentRes.json();parsedDeps=parseGoMod(cd.content??'');}}
catch{}
}
if(parsedDeps.length===0){
try{
const contentRes=await fetch(edgeFunctionUrl+'/repo-operation',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+anonKey,'apikey':anonKey},body:JSON.stringify({operation:'read',projectId,path:'requirements.txt'})});
if(contentRes.ok){const cd=await contentRes.json();parsedDeps=parseRequirements(cd.content??'');}}
catch{}
}
const{data:findings}=await supabase.from('findings').select('*').eq('project_id',projectId).eq('category','dependency_audit').order('created_at',{ascending:false});
if(findings&&findings.length>0){parsedDeps=applyVulnerabilities(parsedDeps,findings as Finding[]);}
setDeps(parsedDeps);
}catch(e){setError(e instanceof Error?e.message:'Failed to load');}
setLoading(false);
}
useEffect(()=>{load();},[projectId]);

if(loading)return<div className="flex items-center justify-center py-16 text-gray-400"><Spinner size={24}/></div>;
if(error)return<div className="card"><EmptyState icon={<AlertTriangle size={22}/>} title="Failed to load" description={error} action={<button className="btn-secondary" onClick={load}><RefreshCw size={15}/>Retry</button>}/></div>;

const vulnerable=deps.filter(d=>d.vulnerable);
const outdated=deps.filter(d=>d.outdated);
const healthy=deps.filter(d=>!d.vulnerable&&!d.outdated);
const filtered=filter==='all'?deps:filter==='vulnerable'?vulnerable:outdated;
const critical=vulnerable.filter(d=>d.severity==='critical').length;
const high=vulnerable.filter(d=>d.severity==='high').length;
const medium=vulnerable.filter(d=>d.severity==='medium').length;
const low=vulnerable.filter(d=>d.severity==='low').length;
const healthScore=deps.length>0?Math.round(((deps.length-vulnerable.length-outdated.length*0.5)/deps.length)*100):100;

return<div className="space-y-5">
<div className="grid grid-cols-4 gap-3">
<div className="card p-4"><div className="flex items-center gap-2 mb-1"><Package size={16} className="text-navy-600"/><p className="text-xs font-medium text-gray-500">Total Dependencies</p></div><p className="text-2xl font-bold text-navy-900">{deps.length}</p></div>
<div className="card p-4"><div className="flex items-center gap-2 mb-1"><ShieldAlert size={16} className="text-danger-600"/><p className="text-xs font-medium text-gray-500">Vulnerable</p></div><p className="text-2xl font-bold text-danger-600">{vulnerable.length}</p></div>
<div className="card p-4"><div className="flex items-center gap-2 mb-1"><Clock size={16} className="text-amber-600"/><p className="text-xs font-medium text-gray-500">Outdated</p></div><p className="text-2xl font-bold text-amber-600">{outdated.length}</p></div>
<div className="card p-4"><div className="flex items-center gap-2 mb-1"><ShieldCheck size={16} className="text-brand-600"/><p className="text-xs font-medium text-gray-500">Health Score</p></div><p className="text-2xl font-bold text-brand-600">{healthScore}<span className="text-sm text-gray-400">/100</span></p></div>
</div>

{vulnerable.length>0&&<div className="card p-0 overflow-hidden">
<div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
<div className="flex items-center gap-2"><ShieldX size={18} className="text-danger-600"/><h3 className="text-sm font-semibold text-navy-800">Vulnerability Summary</h3></div>
</div>
<div className="grid grid-cols-4 gap-0 divide-x divide-gray-100">
{[{label:'Critical',count:critical,color:'text-danger-600',bg:'bg-red-50',icon:ShieldX},{label:'High',count:high,color:'text-amber-600',bg:'bg-amber-50',icon:ShieldAlert},{label:'Medium',count:medium,color:'text-blue-600',bg:'bg-blue-50',icon:AlertTriangle},{label:'Low',count:low,color:'text-gray-600',bg:'bg-gray-50',icon:ShieldCheck}].map(s=><div key={s.label} className={'p-4 text-center '+s.bg}><s.icon size={18} className={'mx-auto mb-1 '+s.color}/><p className={'text-xl font-bold '+s.color}>{s.count}</p><p className="text-xs text-gray-500">{s.label}</p></div>)}
</div>
</div>}

<div className="flex items-center gap-2">
<button onClick={()=>setFilter('all')} className={'chip border '+(filter==='all'?'bg-brand-50 text-brand-700 border-brand-200':'bg-white text-gray-500 border-[#d4d4d8] hover:bg-gray-50')}>All ({deps.length})</button>
<button onClick={()=>setFilter('vulnerable')} className={'chip border '+(filter==='vulnerable'?'bg-red-50 text-danger-600 border-red-200':'bg-white text-gray-500 border-[#d4d4d8] hover:bg-gray-50')}>Vulnerable ({vulnerable.length})</button>
<button onClick={()=>setFilter('outdated')} className={'chip border '+(filter==='outdated'?'bg-amber-50 text-amber-600 border-amber-200':'bg-white text-gray-500 border-[#d4d4d8] hover:bg-gray-50')}>Outdated ({outdated.length})</button>
<button onClick={load} className="btn-ghost ml-auto"><RefreshCw size={15}/>Refresh</button>
</div>

{deps.length===0?<div className="card"><EmptyState icon={<Package size={22}/>} title="No dependencies detected" description="We couldn't find a package.json, go.mod, or requirements.txt. Make sure your dependency file exists in the repo." action={<button className="btn-secondary" onClick={load}><RefreshCw size={15}/>Retry</button>}/></div>:
<div className="card p-0 overflow-hidden">
<table className="w-full">
<thead><tr className="border-b border-gray-100 bg-gray-50">
<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Package</th>
<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Current</th>
<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Latest</th>
<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Vulnerability</th>
<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
</tr></thead>
<tbody className="divide-y divide-gray-50">
{filtered.map((d,i)=><tr key={i} className="hover:bg-gray-50 transition-colors">
<td className="px-4 py-3"><div className="flex items-center gap-2"><Package size={14} className="text-gray-400 shrink-0"/><div><p className="text-sm font-medium text-navy-800">{d.name}</p><p className="text-xs text-gray-400">{d.source}</p></div></div></td>
<td className="px-4 py-3"><span className="font-mono text-sm text-navy-700">{d.version}</span></td>
<td className="px-4 py-3">{d.latestVersion?<span className={'font-mono text-sm '+(d.outdated?'text-amber-600':'text-brand-600')}>{d.latestVersion}</span>:<span className="text-sm text-gray-400">\u2014</span>}</td>
<td className="px-4 py-3">{d.vulnerable?<span className="chip bg-red-50 text-danger-600 border border-red-200"><ShieldX size={11}/>Vulnerable</span>:d.outdated?<span className="chip bg-amber-50 text-amber-600 border border-amber-200"><Clock size={11}/>Outdated</span>:<span className="chip bg-brand-50 text-brand-700 border border-brand-200"><CheckCircle2 size={11}/>Healthy</span>}</td>
<td className="px-4 py-3">{d.vulnerable?<div><div className="flex items-center gap-1.5"><SeverityBadge severity={d.severity??'low'}/></div>{d.cve&&<p className="mt-0.5 font-mono text-xs text-gray-400">{d.cve}</p>}{d.fixVersion&&<p className="mt-0.5 text-xs text-brand-600">Fix in {d.fixVersion}</p>}</div>:<span className="text-sm text-gray-400">\u2014</span>}</td>
<td className="px-4 py-3"><span className={'chip '+(d.type==='runtime'?'bg-navy-50 text-navy-600':'bg-gray-100 text-gray-500')}>{d.type}</span></td>
</tr>)}
</tbody></table>
</div>}

{deps.length>0&&<div className="card">
<h3 className="mb-3 text-sm font-semibold text-navy-800">Dependency Health Insights</h3>
<div className="space-y-2">
{vulnerable.length>0&&<InsightRow icon={<ShieldAlert size={16} className="text-danger-600"/>} color="text-danger-700" text={vulnerable.length+' vulnerable packages found. Update to fixed versions before deploying to production.'}/>}
{outdated.length>0&&<InsightRow icon={<Clock size={16} className="text-amber-600"/>} color="text-amber-700" text={outdated.length+' packages are outdated. Consider upgrading to reduce security risk and get latest features.'}/>}
{healthy.length>0&&<InsightRow icon={<ShieldCheck size={16} className="text-brand-600"/>} color="text-brand-700" text={healthy.length+' packages are healthy and up to date.'}/>}
{deps.length>0&&vulnerable.length===0&&outdated.length===0&&<InsightRow icon={<CheckCircle2 size={16} className="text-brand-600"/>} color="text-brand-700" text="All dependencies are healthy. No action needed."/>}
</div>
</div>}
</div>;
}

function InsightRow({icon,color,text}:{icon:React.ReactNode;color:string;text:string}){
return<div className={'flex items-start gap-2 text-sm '+color}>{icon}<p>{text}</p></div>;
}

function parsePackageJson(content:string):DepInfo[]{
try{const pkg=JSON.parse(content);const deps:DepInfo[]=[];
const rt=pkg.dependencies??{};const dv=pkg.devDependencies??{};
for(const[name,version]of Object.entries(rt)){deps.push({name,version:version.replace(/[\^~]/g,''),source:'package.json',vulnerable:false,severity:null,cve:null,fixVersion:null,file:'package.json',outdated:false,latestVersion:null,type:'runtime'});}
for(const[name,version]of Object.entries(dv)){deps.push({name,version:version.replace(/[\^~]/g,''),source:'package.json (dev)',vulnerable:false,severity:null,cve:null,fixVersion:null,file:'package.json',outdated:false,latestVersion:null,type:'dev'});}
return deps;}catch{return[];}
}
function parseGoMod(content:string):DepInfo[]{
const deps:DepInfo[]=[];const lines=content.split('\n');
for(const line of lines){const m=line.match(/^\s*(require\s+)?(\S+)\s+(v[\d.]+)/);if(m&&m[2]&&m[3]){deps.push({name:m[2],version:m[3],source:'go.mod',vulnerable:false,severity:null,cve:null,fixVersion:null,file:'go.mod',outdated:false,latestVersion:null,type:'runtime'});}}
return deps;
}
function parseRequirements(content:string):DepInfo[]{
const deps:DepInfo[]=[];const lines=content.split('\n');
for(const line of lines){const m=line.match(/^([a-zA-Z0-9_-]+)([><=]+)?([\d.]+)/);if(m){deps.push({name:m[1],version:m[3],source:'requirements.txt',vulnerable:false,severity:null,cve:null,fixVersion:null,file:'requirements.txt',outdated:false,latestVersion:null,type:'runtime'});}}
return deps;
}
function applyVulnerabilities(deps:DepInfo[],findings:Finding[]):DepInfo[]{
return deps.map(d=>{const match=findings.find(f=>d.name.toLowerCase()===f.title.toLowerCase()||f.title.toLowerCase().includes(d.name.toLowerCase()));
if(match){return{...d,vulnerable:true,severity:match.severity,cve:match.description.match(/CVE-\d{4}-\d+/)?.[0]??null,fixVersion:match.recommendation?.match(/[\d.]+/)?.[0]??null};}
return d;});
}
