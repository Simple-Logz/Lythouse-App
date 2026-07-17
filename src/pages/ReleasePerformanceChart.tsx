// @ts-nocheck
import{useMemo,useState}from'react';
import{BarChart,Bar,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer}from'recharts';
import{type Validation,type Project}from'../lib/supabase';
import{TrendingUp,TrendingDown,Minus,Download,Filter,ChevronRight,X,Clock,Shield,AlertTriangle,CheckCircle2}from'lucide-react';

type TimeRange='7d'|'30d'|'3m'|'6m'|'1y';
type Grouping='day'|'week'|'month';
type ChartType='bar'|'line';

type DataPoint={
  label:string;date:Date;
  passed:number;failed:number;blocked:number;rolledBack:number;total:number;
  successRate:number;avgReadiness:number;
  releases:{id:string;name:string;project:string;status:string;environment:string;risk:number|null;created_at:string;}[];
};

const RANGE_DAYS:Record<TimeRange,number>={'7d':7,'30d':30,'3m':90,'6m':180,'1y':365};

function formatLabel(date:Date,grouping:Grouping):string{
  if(grouping==='day')return date.toLocaleDateString([],{month:'short',day:'numeric'});
  if(grouping==='week'){
    const end=new Date(date);end.setDate(end.getDate()+6);
    return`${date.toLocaleDateString([],{month:'short',day:'numeric'})}–${end.toLocaleDateString([],{day:'numeric'})}`;
  }
  return date.toLocaleDateString([],{month:'short',year:'2-digit'});
}

function getPeriodKey(date:Date,grouping:Grouping):string{
  if(grouping==='day')return date.toISOString().slice(0,10);
  if(grouping==='week'){
    const d=new Date(date);d.setDate(d.getDate()-d.getDay());
    return d.toISOString().slice(0,10);
  }
  return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

function CustomTooltip({active,payload,label}:any){
  if(!active||!payload||!payload.length)return null;
  const d=payload[0]?.payload as DataPoint;
  if(!d)return null;
  return(
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 min-w-52">
      <p className="text-sm font-bold text-navy-900 mb-2">{d.label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-6"><span className="text-gray-500">Total</span><strong>{d.total}</strong></div>
        <div className="flex justify-between gap-6"><span className="text-green-600">Passed</span><strong className="text-green-600">{d.passed}</strong></div>
        <div className="flex justify-between gap-6"><span className="text-red-500">Failed</span><strong className="text-red-500">{d.failed}</strong></div>
        <div className="flex justify-between gap-6"><span className="text-amber-500">Blocked</span><strong className="text-amber-500">{d.blocked}</strong></div>
        <div className="flex justify-between gap-6"><span className="text-purple-500">Rolled Back</span><strong className="text-purple-500">{d.rolledBack}</strong></div>
        <div className="border-t border-gray-100 mt-2 pt-2">
          <div className="flex justify-between gap-6"><span className="text-gray-500">Success Rate</span><strong className={d.successRate>=80?'text-green-600':d.successRate>=60?'text-amber-600':'text-red-600'}>{d.successRate}%</strong></div>
          <div className="flex justify-between gap-6"><span className="text-gray-500">Avg Readiness</span><strong>{d.avgReadiness}%</strong></div>
        </div>
      </div>
    </div>
  );
}

export function ReleasePerformanceChart({validations,projects}:{validations:Validation[];projects:Project[];}){
  const[range,setRange]=useState<TimeRange>('30d');
  const[grouping,setGrouping]=useState<Grouping>('day');
  const[chartType,setChartType]=useState<ChartType>('bar');
  const[projectFilter,setProjectFilter]=useState<string>('all');
  const[envFilter,setEnvFilter]=useState<string>('all');
  const[selectedPoint,setSelectedPoint]=useState<DataPoint|null>(null);

  const projectMap=useMemo(()=>Object.fromEntries(projects.map(p=>[p.id,p.name])),[projects]);

  const data=useMemo(():DataPoint[]=>{
    const now=new Date();
    const cutoff=new Date(now);cutoff.setDate(cutoff.getDate()-RANGE_DAYS[range]);

    const filtered=validations.filter(v=>{
      const d=new Date(v.created_at);
      if(d<cutoff)return false;
      if(projectFilter!=='all'&&v.project_id!==projectFilter)return false;
      return true;
    });

    // Group by period
    const map=new Map<string,DataPoint>();

    // Create all period buckets
    const d=new Date(cutoff);
    while(d<=now){
      const key=getPeriodKey(d,grouping);
      if(!map.has(key)){
        map.set(key,{label:formatLabel(new Date(d),grouping),date:new Date(d),passed:0,failed:0,blocked:0,rolledBack:0,total:0,successRate:0,avgReadiness:0,releases:[]});
      }
      if(grouping==='day')d.setDate(d.getDate()+1);
      else if(grouping==='week')d.setDate(d.getDate()+7);
      else d.setMonth(d.getMonth()+1);
    }

    // Fill data
    filtered.forEach(v=>{
      const key=getPeriodKey(new Date(v.created_at),grouping);
      const pt=map.get(key);
      if(!pt)return;
      pt.total++;
      if(v.status==='completed'&&v.critical_count===0)pt.passed++;
      else if(v.status==='failed')pt.failed++;
      else if(v.status==='completed'&&v.critical_count>0)pt.blocked++;
      const readiness=v.risk_score!==null?Math.max(0,100-v.risk_score):0;
      pt.avgReadiness=Math.round((pt.avgReadiness*(pt.releases.length)+readiness)/(pt.releases.length+1));
      pt.releases.push({id:v.id,name:`Validation ${v.id.slice(0,6)}`,project:projectMap[v.project_id]||'Unknown',status:v.status,environment:'production',risk:v.risk_score,created_at:v.created_at});
    });

    // Compute success rates
    map.forEach(pt=>{
      pt.successRate=pt.total>0?Math.round((pt.passed/pt.total)*100):0;
    });

    // Only return periods with data or the last N periods
    const all=Array.from(map.values());
    // Remove trailing empty periods but keep some context
    return all;
  },[validations,range,grouping,projectFilter,projectMap]);

  // Filter out entirely empty periods unless range is short
  const chartData=useMemo(()=>{
    if(range==='7d')return data;
    // Remove leading/trailing zeros but keep internal zeros
    let start=data.findIndex(d=>d.total>0);
    if(start===-1)return data.slice(-7);
    start=Math.max(0,start-1);
    return data.slice(start);
  },[data,range]);

  // Period comparison
  const{current,previous,changePct}=useMemo(()=>{
    const half=Math.floor(chartData.length/2);
    const curr=chartData.slice(half).reduce((s,d)=>s+d.total,0);
    const prev=chartData.slice(0,half).reduce((s,d)=>s+d.total,0);
    const chg=prev>0?Math.round(((curr-prev)/prev)*100):0;
    return{current:curr,previous:prev,changePct:chg};
  },[chartData]);

  const totalInRange=chartData.reduce((s,d)=>s+d.total,0);
  const totalPassed=chartData.reduce((s,d)=>s+d.passed,0);
  const overallSuccessRate=totalInRange>0?Math.round((totalPassed/totalInRange)*100):0;

  const exportCSV=()=>{
    const rows=[['Period','Total','Passed','Failed','Blocked','Success Rate','Avg Readiness'],...chartData.map(d=>[d.label,d.total,d.passed,d.failed,d.blocked,d.successRate+'%',d.avgReadiness+'%'])];
    const csv=rows.map(r=>r.join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='release-performance.csv';a.click();
    URL.revokeObjectURL(url);
  };

  return(
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500"/>Release Performance Trends
          </h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="font-semibold text-navy-900 text-base">{totalInRange} deployments</span>
            {changePct!==0&&(
              <span className={`flex items-center gap-1 font-medium ${changePct>0?'text-green-600':'text-red-500'}`}>
                {changePct>0?<TrendingUp size={12}/>:changePct<0?<TrendingDown size={12}/>:<Minus size={12}/>}
                {Math.abs(changePct)}% vs previous period
              </span>
            )}
            <span>Success rate: <strong className={overallSuccessRate>=80?'text-green-600':overallSuccessRate>=60?'text-amber-600':'text-red-600'}>{overallSuccessRate}%</strong></span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            {(['7d','30d','3m','6m','1y'] as TimeRange[]).map(r=>(
              <button key={r} onClick={()=>setRange(r)} className={'px-2.5 py-1 rounded-md text-xs font-medium transition-colors '+(range===r?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700')}>
                {r==='7d'?'7D':r==='30d'?'30D':r==='3m'?'3M':r==='6m'?'6M':'1Y'}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            {(['day','week','month'] as Grouping[]).map(g=>(
              <button key={g} onClick={()=>setGrouping(g)} className={'px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors '+(grouping===g?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700')}>{g}</button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            {(['bar','line'] as ChartType[]).map(t=>(
              <button key={t} onClick={()=>setChartType(t)} className={'px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors '+(chartType===t?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700')}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} className="input text-xs py-1.5 h-auto flex-1" style={{minWidth:120,maxWidth:200}}>
          <option value="all">All Projects</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0"><Download size={12}/>Export CSV</button>
      </div>

      {/* Chart */}
      {chartData.every(d=>d.total===0)?(
        <div className="flex items-center justify-center h-48 text-sm text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
          No deployment data for this period
        </div>
      ):(
        <ResponsiveContainer width="100%" height={260}>
          {chartType==='bar'?(
            <BarChart data={chartData} margin={{top:5,right:30,left:0,bottom:5}} barCategoryGap="30%" onClick={d=>d?.activePayload&&setSelectedPoint(d.activePayload[0]?.payload)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
              <XAxis dataKey="label" tick={{fontSize:10,fill:'#9ca3af'}} axisLine={false} tickLine={false} interval="preserveStartEnd" padding={{left:10,right:10}}/>
              <YAxis tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend iconSize={10} iconType="circle" wrapperStyle={{fontSize:11}}/>
              <Bar dataKey="passed" name="Passed" fill="#22c55e" stackId="a" radius={[0,0,0,0]}/>
              <Bar dataKey="blocked" name="Blocked" fill="#f59e0b" stackId="a"/>
              <Bar dataKey="failed" name="Failed" fill="#ef4444" stackId="a"/>
              <Bar dataKey="rolledBack" name="Rolled Back" fill="#a855f7" stackId="a" radius={[3,3,0,0]}/>
            </BarChart>
          ):(
            <LineChart data={chartData} margin={{top:5,right:30,left:0,bottom:5}} onClick={d=>d?.activePayload&&setSelectedPoint(d.activePayload[0]?.payload)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
              <XAxis dataKey="label" tick={{fontSize:10,fill:'#9ca3af'}} axisLine={false} tickLine={false} interval="preserveStartEnd" padding={{left:10,right:10}}/>
              <YAxis tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend iconSize={10} iconType="circle" wrapperStyle={{fontSize:11}}/>
              <Line dataKey="passed" name="Passed" stroke="#22c55e" strokeWidth={2} dot={{r:3}} activeDot={{r:5}}/>
              <Line dataKey="blocked" name="Blocked" stroke="#f59e0b" strokeWidth={2} dot={{r:3}}/>
              <Line dataKey="failed" name="Failed" stroke="#ef4444" strokeWidth={2} dot={{r:3}}/>
              <Line dataKey="successRate" name="Success Rate %" stroke="#6366f1" strokeWidth={2} dot={{r:3}} strokeDasharray="4 2"/>
            </LineChart>
          )}
        </ResponsiveContainer>
      )}

      {/* Drill-down panel */}
      {selectedPoint&&(
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-navy-900">{selectedPoint.label} — Release Detail</h4>
            <button onClick={()=>setSelectedPoint(null)} className="btn-ghost p-1"><X size={14}/></button>
          </div>
          {selectedPoint.releases.length===0?(
            <p className="text-sm text-gray-400">No releases in this period.</p>
          ):(
            <div className="space-y-1.5">
              {selectedPoint.releases.map((r,i)=>(
                <div key={i} className="flex items-center gap-3 rounded-lg bg-white border border-gray-200 px-3 py-2.5 text-xs">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${r.status==='completed'?'bg-green-500':r.status==='failed'?'bg-red-500':'bg-amber-500'}`}/>
                  <span className="font-medium text-navy-900 flex-1 truncate">{r.project}</span>
                  <span className="capitalize text-gray-500">{r.status}</span>
                  <span className="text-gray-400">{r.environment}</span>
                  {r.risk!==null&&<span className={`font-semibold ${r.risk>70?'text-red-600':r.risk>40?'text-amber-600':'text-green-600'}`}>{r.risk}/100</span>}
                  <span className="text-gray-400">{new Date(r.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
