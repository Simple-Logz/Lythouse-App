import{useEffect,useState}from'react';
import{supabase,type Project,type Validation,type Finding}from'../lib/supabase';
import{PageHeader,Spinner,EmptyState,StatusBadge,SeverityBadge,FindingStatusBadge,timeAgo}from'../lib/ui';
import{Link}from'../lib/router';
import{LayoutDashboard,FolderGit2,ShieldCheck,ShieldAlert,Gauge,Clock,AlertTriangle,CheckCircle2,XCircle,TrendingUp,TrendingDown,Minus}from'lucide-react';

type Stat={label:string;value:string|number;icon:typeof FolderGit2;color:string;sub?:string;}
type VRow=Validation&{project_name?:string;}
type FRow=Finding&{project_name?:string;}

export function DashboardPage(){
const[loading,setLoading]=useState(true);
const[projects,setProjects]=useState<Project[]>([]);
const[validations,setValidations]=useState<VRow[]>([]);
const[findings,setFindings]=useState<FRow[]>([]);
const[allFindings,setAllFindings]=useState<Finding[]>([]);

const wsId=()=>localStorage.getItem('sandbox.activeWs');

const load=async()=>{
  setLoading(true);
  const wid=wsId();
  if(!wid){setLoading(false);return;}
  const[pr,vl,fn,af]=await Promise.all([
    supabase.from('projects').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}),
    supabase.from('validations').select('*,projects(name)').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(20),
    supabase.from('findings').select('*,projects(name)').eq('status','open').order('created_at',{ascending:false}).limit(10),
    supabase.from('findings').select('severity,status,category,project_id').order('created_at',{ascending:false}),
  ]);
  setProjects(pr.data??[]);
  const vrows=(vl.data??[]).map((r:any)=>({...r,project_name:r.projects?.name}))as VRow[];
  setValidations(vrows);
  // filter findings to this workspace via project
  const projectIds=new Set((pr.data??[]).map((p:any)=>p.id));
  const fdata=(fn.data??[]).filter((f:any)=>projectIds.has(f.project_id));
  setFindings(fdata.map((f:any)=>({...f,project_name:f.projects?.name}))as FRow[]);
  setAllFindings((af.data??[]).filter((f:any)=>projectIds.has(f.project_id)) as Finding[]);
  setLoading(false);
};

useEffect(()=>{load();},[]);

if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

// Real computed metrics
const openFindings=allFindings.filter(f=>f.status==='open');
const critical=openFindings.filter(f=>f.severity==='critical');
const high=openFindings.filter(f=>f.severity==='high');
const completedVals=validations.filter(v=>v.status==='completed');
const failedVals=validations.filter(v=>v.status==='failed');
const scored=completedVals.filter(v=>v.risk_score!==null);
const avgRisk=scored.length?Math.round(scored.reduce((s,v)=>s+(v.risk_score??0),0)/scored.length):0;
const latestRisk=scored[0]?.risk_score??null;
const prevRisk=scored[1]?.risk_score??null;
const riskTrend=latestRisk!==null&&prevRisk!==null?latestRisk-prevRisk:null;
const passRate=completedVals.length>0?Math.round(((completedVals.length-failedVals.length)/completedVals.length)*100):null;

// Deployment readiness verdict
const verdict=critical.length>0?'No-Go':high.length>2?'Conditional':openFindings.length>10?'Conditional':'Ready';
const verdictColor=verdict==='Ready'?'bg-green-50 text-green-700 border-green-200':verdict==='No-Go'?'bg-red-50 text-danger-600 border-red-200':'bg-amber-50 text-amber-700 border-amber-200';
const VerdictIcon=verdict==='Ready'?CheckCircle2:verdict==='No-Go'?XCircle:AlertTriangle;

// Category breakdown
const categories=Object.entries(
  openFindings.reduce((acc,f)=>{acc[f.category]=(acc[f.category]??0)+1;return acc;},{} as Record<string,number>)
).sort((a,b)=>b[1]-a[1]);

const stats:Stat[]=[
  {label:'Projects',value:projects.length,icon:FolderGit2,color:'bg-blue-50 text-blue-600'},
  {label:'Validations Run',value:validations.length,icon:LayoutDashboard,color:'bg-brand-50 text-brand-600',sub:passRate!==null?`${passRate}% pass rate`:undefined},
  {label:'Open Findings',value:openFindings.length,icon:ShieldAlert,color:critical.length>0?'bg-red-50 text-danger-600':'bg-amber-50 text-amber-600',sub:`${critical.length} critical · ${high.length} high`},
  {label:'Avg Risk Score',value:avgRisk>0?avgRisk:'—',icon:Gauge,color:avgRisk>70?'bg-red-50 text-danger-600':avgRisk>40?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600',sub:riskTrend!==null?`${riskTrend>0?'↑':'↓'} ${Math.abs(riskTrend)} from last run`:undefined},
];

return<div>
<PageHeader title="Dashboard" description="Real-time overview of your validation activity and deployment risk posture."/>

{/* Deployment readiness banner */}
<div className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 ${verdictColor}`}>
  <VerdictIcon size={18} className="shrink-0"/>
  <div>
    <p className="text-sm font-semibold">Deployment Readiness: {verdict}</p>
    <p className="text-xs opacity-80 mt-0.5">
      {verdict==='Ready'?`${openFindings.length} open findings — none blocking deployment.`:
       verdict==='No-Go'?`${critical.length} critical finding${critical.length!==1?'s':''} must be resolved before deploying to production.`:
       `${high.length} high-severity findings. Review before deploying.`}
    </p>
  </div>
  {riskTrend!==null&&(
    <div className="ml-auto flex items-center gap-1.5 text-sm font-medium">
      {riskTrend>0?<TrendingUp size={16}/>:riskTrend<0?<TrendingDown size={16}/>:<Minus size={16}/>}
      Risk {riskTrend>0?'increasing':'decreasing'}
    </div>
  )}
</div>

{/* Stat cards */}
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
{stats.map(s=>(
  <div key={s.label} className="card">
    <div className="flex items-center justify-between">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}><s.icon size={18}/></div>
      <span className="text-3xl font-bold tabular-nums text-navy-900">{s.value}</span>
    </div>
    <p className="mt-3 text-sm font-medium text-gray-600">{s.label}</p>
    {s.sub&&<p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
  </div>
))}
</div>

<div className="grid gap-6 lg:grid-cols-3 mb-6">
  {/* Finding breakdown */}
  <div className="card">
    <h2 className="text-sm font-semibold text-navy-900 mb-3">Findings by Category</h2>
    {categories.length===0
      ?<p className="text-sm text-gray-400">No open findings.</p>
      :<div className="space-y-2">
        {categories.map(([cat,count])=>{
          const pct=Math.round((count/openFindings.length)*100);
          const label=cat.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
          return<div key={cat}>
            <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{label}</span><span className="font-semibold">{count}</span></div>
            <div className="h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-brand-500" style={{width:`${pct}%`}}/></div>
          </div>;
        })}
      </div>
    }
  </div>

  {/* Severity breakdown */}
  <div className="card">
    <h2 className="text-sm font-semibold text-navy-900 mb-3">Severity Distribution</h2>
    {openFindings.length===0
      ?<p className="text-sm text-gray-400">No open findings.</p>
      :<div className="space-y-3">
        {[
          ['Critical',critical.length,'bg-red-500','text-danger-600'],
          ['High',high.length,'bg-amber-500','text-amber-600'],
          ['Medium',openFindings.filter(f=>f.severity==='medium').length,'bg-blue-400','text-blue-600'],
          ['Low',openFindings.filter(f=>f.severity==='low').length,'bg-gray-300','text-gray-500'],
        ].map(([label,count,barColor,textColor])=>{
          const pct=openFindings.length>0?Math.round((+count/openFindings.length)*100):0;
          return<div key={label as string}>
            <div className="flex justify-between text-xs mb-1"><span className={`font-medium ${textColor}`}>{label}</span><span className="text-gray-600">{count} ({pct}%)</span></div>
            <div className="h-1.5 rounded-full bg-gray-100"><div className={`h-1.5 rounded-full ${barColor}`} style={{width:`${pct}%`}}/></div>
          </div>;
        })}
      </div>
    }
  </div>

  {/* Validation pass rate */}
  <div className="card">
    <h2 className="text-sm font-semibold text-navy-900 mb-3">Validation Health</h2>
    {validations.length===0
      ?<p className="text-sm text-gray-400">No validations yet. Run a validation from a project to see data here.</p>
      :<div className="space-y-3">
        {[
          ['Completed',completedVals.length,'text-green-600'],
          ['Failed',failedVals.length,'text-danger-600'],
          ['Running',validations.filter(v=>v.status==='running').length,'text-brand-600'],
          ['Pending',validations.filter(v=>v.status==='pending').length,'text-gray-500'],
        ].map(([label,count,color])=>(
          <div key={label as string} className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{label}</span>
            <span className={`font-semibold ${color}`}>{count}</span>
          </div>
        ))}
        {passRate!==null&&(
          <div className="border-t border-gray-100 pt-3">
            <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Pass rate</span><span className="font-semibold text-navy-900">{passRate}%</span></div>
            <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-green-500" style={{width:`${passRate}%`}}/></div>
          </div>
        )}
      </div>
    }
  </div>
</div>

<div className="grid gap-6 lg:grid-cols-2">
  {/* Recent validations */}
  <div>
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold text-navy-900">Recent Validations</h2>
      <Link to="/projects" className="text-sm font-medium text-brand-600 hover:underline">View projects</Link>
    </div>
    {validations.length===0
      ?<div className="card"><EmptyState icon={<ShieldCheck size={22}/>} title="No validations yet" description="Open a project and click Run Validation to start scanning."/></div>
      :<div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="px-4 py-3 font-medium">Project</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Risk</th>
            <th className="px-4 py-3 font-medium">Findings</th>
            <th className="px-4 py-3 font-medium">When</th>
          </tr></thead>
          <tbody>
          {validations.slice(0,8).map(v=>(
            <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
              <td className="px-4 py-3 font-medium text-navy-800 max-w-[120px] truncate">{v.project_name??'—'}</td>
              <td className="px-4 py-3"><StatusBadge status={v.status}/></td>
              <td className="px-4 py-3">
                {v.risk_score!==null
                  ?<span className={`font-semibold tabular-nums ${v.risk_score>70?'text-danger-600':v.risk_score>40?'text-amber-600':'text-green-600'}`}>{v.risk_score}</span>
                  :<span className="text-gray-400">—</span>}
              </td>
              <td className="px-4 py-3">
                <span className="text-gray-700">{v.total_findings}</span>
                {v.critical_count>0&&<span className="ml-1 text-xs text-danger-600">({v.critical_count} crit)</span>}
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">{timeAgo(v.created_at)}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>}
  </div>

  {/* Critical & high open findings */}
  <div>
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold text-navy-900">Open Findings — Triage</h2>
      <span className="text-xs text-gray-400">{openFindings.length} total open</span>
    </div>
    {findings.length===0
      ?<div className="card"><EmptyState icon={<ShieldCheck size={22}/>} title="No open findings" description={validations.length>0?"All findings resolved. Good shape for deployment.":"Run a validation to surface findings."}/></div>
      :<div className="space-y-2">
        {findings.slice(0,6).map(f=>(
          <div key={f.id} className="card flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <SeverityBadge severity={f.severity}/>
                <h3 className="text-sm font-semibold text-navy-900 truncate">{f.title}</h3>
              </div>
              <p className="text-xs text-gray-500 truncate">{f.project_name??'—'}{f.file_path?` · ${f.file_path}`:''}</p>
              {(f as any).recommendation&&<p className="text-xs text-brand-600 mt-1 line-clamp-1">→ {(f as any).recommendation}</p>}
            </div>
            <FindingStatusBadge status={f.status}/>
          </div>
        ))}
        {openFindings.length>6&&<p className="text-xs text-center text-gray-400 py-1">+{openFindings.length-6} more — open a project to view all</p>}
      </div>}
  </div>
</div>
</div>;
}
