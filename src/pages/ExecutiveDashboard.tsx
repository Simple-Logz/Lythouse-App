import{useEffect,useState,useCallback}from'react';
import{supabase,type Project,type Validation,type Finding}from'../lib/supabase';
import{Spinner}from'../lib/ui';
import{TrendingUp,TrendingDown,Shield,Clock,CheckCircle2,XCircle,AlertTriangle,BarChart3,Users,Zap,Activity,Target,ArrowRight,Search,X}from'lucide-react';
import{Link}from'../lib/router';

type TeamRisk={project_name:string;project_id:string;risk_score:number;critical:number;high:number;last_scan:string;};

export function ExecutiveDashboard(){
  const[loading,setLoading]=useState(true);
  const[projectSearch,setProjectSearch]=useState('');
  const[riskFilter,setRiskFilter]=useState<Set<string>>(new Set());
  const[envFilter,setEnvFilter]=useState<string>('all');
  const[showFilters,setShowFilters]=useState(false);
  const[projects,setProjects]=useState<Project[]>([]);
  const[validations,setValidations]=useState<Validation[]>([]);
  const[findings,setFindings]=useState<Finding[]>([]);
  const[workspaces,setWorkspaces]=useState<{id:string;name:string}[]>([]);
  const[creators,setCreators]=useState<{id:string;name:string}[]>([]);
  const[wsFilter,setWsFilter]=useState<string>('all');
  const[ownerFilter,setOwnerFilter]=useState<string>('all');

  const wsId=()=>localStorage.getItem('sandbox.activeWs');

  const load=useCallback(async()=>{
    setLoading(true);
    const wid=wsId();
    if(!wid){setLoading(false);return;}
    const[pr,vl,fn,ws]=await Promise.all([
      supabase.from('projects').select('*').eq('workspace_id',wid),
      supabase.from('validations').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(100),
      supabase.from('findings').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}),
      supabase.from('workspaces').select('id,name'),
    ]);
    setProjects(pr.data??[]);
    setWorkspaces(ws.data??[]);
    // Load creator profiles for all projects
    const creatorIds=[...new Set((pr.data??[]).map((p:any)=>p.created_by).filter(Boolean))];
    if(creatorIds.length>0){
      const{data:profiles}=await supabase.from('profiles').select('id,full_name,email').in('id',creatorIds);
      setCreators((profiles??[]).map((p:any)=>({id:p.id,name:p.full_name||p.email||'Unknown'})));
    }
    setValidations(vl.data??[]);
    setFindings(fn.data??[]);
    setLoading(false);
  },[]);

  useEffect(()=>{load();},[load]);

  if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

  // Real computed metrics
  const completed=validations.filter(v=>v.status==='completed');
  const failed=validations.filter(v=>v.status==='failed');
  const successRate=validations.length>0?Math.round((completed.length/validations.length)*100):0;
  const openCritical=findings.filter(f=>f.status==='open'&&f.severity==='critical');
  const resolved=findings.filter(f=>f.status==='resolved');
  const avgRisk=completed.length>0?Math.round(completed.reduce((s,v)=>s+(v.risk_score??0),0)/completed.length):0;

  // Average time to production (time between validation created and completed)
  const avgTimeMs=completed.filter(v=>v.completed_at).reduce((s,v)=>{
    const ms=new Date(v.completed_at!).getTime()-new Date(v.created_at).getTime();
    return s+ms;
  },0)/(completed.filter(v=>v.completed_at).length||1);
  const avgTimeSec=Math.round(avgTimeMs/1000);
  const avgTimeDisplay=avgTimeSec<60?`${avgTimeSec}s`:avgTimeSec<3600?`${Math.round(avgTimeSec/60)}m`:`${Math.round(avgTimeSec/3600)}h`;

  // Deployment trends — last 7 days
  const now=new Date();
  const days=Array.from({length:7},(_,i)=>{
    const d=new Date(now);d.setDate(d.getDate()-i);
    return d.toISOString().slice(0,10);
  }).reverse();
  const trendData=days.map(day=>({
    day:day.slice(5),
    scans:validations.filter(v=>v.created_at.slice(0,10)===day).length,
    passed:validations.filter(v=>v.created_at.slice(0,10)===day&&v.status==='completed'&&(v.critical_count===0)).length,
    failed:validations.filter(v=>v.created_at.slice(0,10)===day&&(v.status==='failed'||v.critical_count>0)).length,
  }));
  const maxScans=Math.max(...trendData.map(d=>d.scans),1);

  // Team/project risk ranking
  const projectRisks=projects.map(p=>{
    const pv=completed.filter(v=>v.project_id===p.id);
    const latest=pv[0];
    const pf=findings.filter(f=>f.project_id===p.id&&f.status==='open');
    return{
      project_name:p.name,project_id:p.id,
      workspace_id:p.workspace_id,
      created_by:p.created_by,
      risk_score:latest?.risk_score??0,
      critical:pf.filter(f=>f.severity==='critical').length,
      high:pf.filter(f=>f.severity==='high').length,
      last_scan:latest?.created_at??p.created_at,
    };
  }).sort((a,b)=>b.risk_score-a.risk_score);

  // Resolution rate trend
  const resolutionRate=findings.length>0?Math.round((resolved.length/findings.length)*100):0;

  return(
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {label:'Deployment Success Rate',value:`${successRate}%`,sub:`${completed.length} of ${validations.length} scans passed`,icon:Target,color:'text-green-600',bg:'bg-green-50',border:'border-green-200',trend:successRate>=80?'up':'down'},
          {label:'Avg Scan Time',value:avgTimeDisplay,sub:'Time to complete validation',icon:Clock,color:'text-blue-600',bg:'bg-blue-50',border:'border-blue-200',trend:'neutral'},
          {label:'Critical Blockers',value:openCritical.length,sub:`Across ${projects.length} project${projects.length!==1?'s':''}`,icon:AlertTriangle,color:openCritical.length>0?'text-red-600':'text-green-600',bg:openCritical.length>0?'bg-red-50':'bg-green-50',border:openCritical.length>0?'border-red-200':'border-green-200',trend:openCritical.length>0?'down':'up'},
          {label:'Avg Risk Score',value:`${avgRisk}/100`,sub:`${resolutionRate}% findings resolved`,icon:Shield,color:avgRisk>70?'text-red-600':avgRisk>40?'text-amber-600':'text-green-600',bg:avgRisk>70?'bg-red-50':avgRisk>40?'bg-amber-50':'bg-green-50',border:avgRisk>70?'border-red-200':avgRisk>40?'border-amber-200':'border-green-200',trend:avgRisk<50?'up':'down'},
        ].map(kpi=>(
          <div key={kpi.label} className={`card border-2 ${kpi.border} ${kpi.bg}`}>
            <div className="flex items-start justify-between mb-2">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${kpi.border} bg-white`}>
                <kpi.icon size={18} className={kpi.color}/>
              </div>
              {kpi.trend==='up'?<TrendingUp size={16} className="text-green-500"/>:kpi.trend==='down'?<TrendingDown size={16} className="text-red-400"/>:<Activity size={16} className="text-gray-400"/>}
            </div>
            <div className={`text-3xl font-black tabular-nums ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs font-semibold text-gray-700 mt-1">{kpi.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Deployment Trend Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-navy-900 mb-4 flex items-center gap-2"><BarChart3 size={15} className="text-brand-600"/>Deployment Trends — Last 7 Days</h3>
          {trendData.every(d=>d.scans===0)?(
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">No scan activity in the last 7 days</div>
          ):(
            <div className="flex items-end gap-2 h-32">
              {trendData.map((d,i)=>(
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end gap-0.5" style={{height:96}}>
                    {d.passed>0&&<div className="w-full rounded-t bg-green-400 transition-all" style={{height:`${(d.passed/maxScans)*80}px`,minHeight:d.passed>0?4:0}}/>}
                    {d.failed>0&&<div className="w-full rounded-t bg-red-400 transition-all" style={{height:`${(d.failed/maxScans)*80}px`,minHeight:d.failed>0?4:0}}/>}
                    {d.scans===0&&<div className="w-full rounded bg-gray-100" style={{height:4}}/>}
                  </div>
                  <span className="text-[10px] text-gray-500">{d.day}</span>
                  {d.scans>0&&<span className="text-[10px] font-bold text-navy-900">{d.scans}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400"/>Passed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-400"/>Critical/Failed</span>
          </div>
        </div>

        {/* Findings breakdown */}
        <div className="card">
          <h3 className="text-sm font-semibold text-navy-900 mb-4 flex items-center gap-2"><Shield size={15} className="text-brand-600"/>Security Posture</h3>
          <div className="space-y-3">
            {[
              {label:'Critical',count:findings.filter(f=>f.severity==='critical'&&f.status==='open').length,total:findings.filter(f=>f.severity==='critical').length,color:'bg-red-500'},
              {label:'High',count:findings.filter(f=>f.severity==='high'&&f.status==='open').length,total:findings.filter(f=>f.severity==='high').length,color:'bg-amber-500'},
              {label:'Medium',count:findings.filter(f=>f.severity==='medium'&&f.status==='open').length,total:findings.filter(f=>f.severity==='medium').length,color:'bg-blue-500'},
              {label:'Low',count:findings.filter(f=>f.severity==='low'&&f.status==='open').length,total:findings.filter(f=>f.severity==='low').length,color:'bg-gray-400'},
            ].map(s=>(
              <div key={s.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700">{s.label}</span>
                  <span className="text-gray-500">{s.count} open / {s.total} total</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-2 rounded-full ${s.color} transition-all`} style={{width:s.total>0?`${(s.count/s.total)*100}%`:'0%'}}/>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Overall resolution rate</span>
                <span className={`font-bold text-lg ${resolutionRate>=70?'text-green-600':resolutionRate>=40?'text-amber-600':'text-red-600'}`}>{resolutionRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 mt-1 overflow-hidden">
                <div className="h-2 rounded-full bg-green-500 transition-all" style={{width:`${resolutionRate}%`}}/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projects by Risk */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2"><AlertTriangle size={15} className="text-brand-600"/>Projects by Deployment Risk</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={projectSearch} onChange={e=>setProjectSearch(e.target.value)} placeholder="Search projects…" className="input pl-8 pr-8 py-1.5 text-sm w-44"/>
              {projectSearch&&<button onClick={()=>setProjectSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12}/></button>}
            </div>
            <button onClick={()=>setShowFilters(f=>!f)} className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors '+(showFilters||riskFilter.size>0?'border-brand-500 bg-brand-50 text-brand-700':'border-gray-200 text-gray-600 hover:bg-gray-50')}>
              <Users size={12}/>Filters{riskFilter.size>0?` (${riskFilter.size})`:''}
            </button>
            {(riskFilter.size>0||projectSearch||wsFilter!=='all'||ownerFilter!=='all')&&<button onClick={()=>{setRiskFilter(new Set());setProjectSearch('');setWsFilter('all');setOwnerFilter('all');}} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear all</button>}
          </div>
        </div>
        {showFilters&&(
          <div className="mb-4 p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Risk Level (select multiple)</p>
              <div className="flex flex-wrap gap-2">
                {[{id:'critical',label:'Critical',color:'bg-red-100 text-red-700 border-red-300'},{id:'high',label:'High',color:'bg-orange-100 text-orange-700 border-orange-300'},{id:'medium',label:'Medium',color:'bg-amber-100 text-amber-700 border-amber-300'},{id:'low',label:'Low',color:'bg-green-100 text-green-700 border-green-300'}].map(r=>(
                  <button key={r.id} onClick={()=>{const n=new Set(riskFilter);n.has(r.id)?n.delete(r.id):n.add(r.id);setRiskFilter(n);}} className={'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all '+(riskFilter.has(r.id)?r.color+' ring-2 ring-offset-1 ring-current':'border-gray-200 bg-white text-gray-600 hover:bg-gray-100')}>
                    {riskFilter.has(r.id)?'✓ ':''}{r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Has Blockers</p>
              <div className="flex flex-wrap gap-2">
                {[{id:'has-critical',label:'Has Critical Issues'},{id:'has-high',label:'Has High Issues'},{id:'no-issues',label:'Clean (No Issues)'}].map(r=>(
                  <button key={r.id} onClick={()=>{const n=new Set(riskFilter);n.has(r.id)?n.delete(r.id):n.add(r.id);setRiskFilter(n);}} className={'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all '+(riskFilter.has(r.id)?'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-offset-1 ring-brand-400':'border-gray-200 bg-white text-gray-600 hover:bg-gray-100')}>
                    {riskFilter.has(r.id)?'✓ ':''}{r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Scan Status</p>
              <div className="flex flex-wrap gap-2">
                {[{id:'never-scanned',label:'Never Scanned'},{id:'scanned-today',label:'Scanned Today'},{id:'stale',label:'Stale (7+ days)'}].map(r=>(
                  <button key={r.id} onClick={()=>{const n=new Set(riskFilter);n.has(r.id)?n.delete(r.id):n.add(r.id);setRiskFilter(n);}} className={'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all '+(riskFilter.has(r.id)?'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-offset-1 ring-brand-400':'border-gray-200 bg-white text-gray-600 hover:bg-gray-100')}>
                    {riskFilter.has(r.id)?'✓ ':''}{r.label}
                  </button>
                ))}
              </div>
            </div>
            {workspaces.length>1&&<div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Workspace</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={()=>setWsFilter('all')} className={'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all '+(wsFilter==='all'?'border-brand-500 bg-brand-50 text-brand-700':'border-gray-200 bg-white text-gray-600 hover:bg-gray-100')}>All Workspaces</button>
                {workspaces.map(w=>(
                  <button key={w.id} onClick={()=>setWsFilter(w.id)} className={'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all '+(wsFilter===w.id?'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-offset-1 ring-brand-400':'border-gray-200 bg-white text-gray-600 hover:bg-gray-100')}>
                    {wsFilter===w.id?'✓ ':''}{w.name}
                  </button>
                ))}
              </div>
            </div>}
            {creators.length>1&&<div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Project Owner</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={()=>setOwnerFilter('all')} className={'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all '+(ownerFilter==='all'?'border-brand-500 bg-brand-50 text-brand-700':'border-gray-200 bg-white text-gray-600 hover:bg-gray-100')}>All Owners</button>
                {creators.map(c=>(
                  <button key={c.id} onClick={()=>setOwnerFilter(c.id)} className={'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all '+(ownerFilter===c.id?'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-offset-1 ring-brand-400':'border-gray-200 bg-white text-gray-600 hover:bg-gray-100')}>
                    {ownerFilter===c.id?'✓ ':''}{c.name}
                  </button>
                ))}
              </div>
            </div>}
          </div>
        )}
        {projectRisks.length===0?(
          <p className="text-sm text-gray-400 py-4 text-center">No projects yet</p>
        ):(
          <div className="divide-y divide-gray-100">
            {projectRisks.filter(p=>{
  const matchSearch=!projectSearch||p.project_name.toLowerCase().includes(projectSearch.toLowerCase());
  if(!matchSearch)return false;
  if(riskFilter.size===0)return true;
  const riskChecks=[];
  if(riskFilter.has('critical'))riskChecks.push(p.critical>0);
  if(riskFilter.has('high'))riskChecks.push(p.risk_score>70);
  if(riskFilter.has('medium'))riskChecks.push(p.risk_score>40&&p.risk_score<=70);
  if(riskFilter.has('low'))riskChecks.push(p.risk_score<=40);
  if(riskFilter.has('has-critical'))riskChecks.push(p.critical>0);
  if(riskFilter.has('has-high'))riskChecks.push(p.high>0);
  if(riskFilter.has('no-issues'))riskChecks.push(p.critical===0&&p.high===0);
  const now=new Date();const lastScan=new Date(p.last_scan);const daysSince=Math.floor((now.getTime()-lastScan.getTime())/(1000*60*60*24));
  if(riskFilter.has('never-scanned'))riskChecks.push(p.risk_score===0);
  if(riskFilter.has('scanned-today'))riskChecks.push(daysSince===0);
  if(riskFilter.has('stale'))riskChecks.push(daysSince>=7);
  return riskChecks.some(Boolean);
  const matchWs=wsFilter==='all'||p.workspace_id===wsFilter;
  const matchOwner=ownerFilter==='all'||p.created_by===ownerFilter;
  return matchWs&&matchOwner;
}).map((p,i)=>(
              <div key={p.project_id} className="flex items-center gap-4 py-3">
                <span className="text-sm font-bold text-gray-400 w-5">{i+1}</span>
                <div className="flex-1 min-w-0">
                  <Link to={`/projects/${p.project_id}`} className="text-sm font-semibold text-navy-900 hover:text-brand-600 transition-colors">{p.project_name}</Link>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {p.critical>0&&<span className="text-red-600 font-semibold">● {p.critical} critical</span>}
                    {p.high>0&&<span className="text-amber-600 font-semibold">● {p.high} high</span>}
                    <span>Last scan {new Date(p.last_scan).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-2 rounded-full transition-all ${p.risk_score>70?'bg-red-500':p.risk_score>40?'bg-amber-500':'bg-green-500'}`} style={{width:`${p.risk_score}%`}}/>
                  </div>
                  <span className={`text-sm font-black w-12 text-right ${p.risk_score>70?'text-red-600':p.risk_score>40?'text-amber-600':'text-green-600'}`}>{p.risk_score}/100</span>
                  <Link to={`/projects/${p.project_id}`} className="btn-ghost text-xs p-1.5"><ArrowRight size={14}/></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h3 className="text-sm font-semibold text-navy-900 mb-4 flex items-center gap-2"><Activity size={15} className="text-brand-600"/>Recent Validation Activity</h3>
        {validations.length===0?(
          <p className="text-sm text-gray-400 py-4 text-center">No validations yet</p>
        ):(
          <div className="divide-y divide-gray-100">
            {validations.slice(0,8).map(v=>{
              const proj=projects.find(p=>p.id===v.project_id);
              return(
                <div key={v.id} className="flex items-center gap-3 py-2.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${v.status==='completed'&&v.critical_count===0?'bg-green-500':v.status==='completed'?'bg-amber-500':'bg-red-500'}`}/>
                  <span className="text-sm text-gray-700 flex-1 truncate">{proj?.name||'Unknown project'}</span>
                  <span className={`text-xs font-semibold ${v.risk_score!==null&&v.risk_score>70?'text-red-600':v.risk_score!==null&&v.risk_score>40?'text-amber-600':'text-green-600'}`}>{v.risk_score!==null?`${v.risk_score}/100`:'—'}</span>
                  <span className="text-xs text-gray-400">{new Date(v.created_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
