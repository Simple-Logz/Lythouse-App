import{useState}from'react';
import{PageHeader,EmptyState}from'../lib/ui';
import{Activity,Plus,X,Loader as Loader2,Zap,Users,Clock,Target,AlertTriangle,CheckCircle2,BarChart3,HelpCircle}from'lucide-react';


function Tip({text}:{text:string}){
  const[show,setShow]=useState(false);
  return<span className="relative inline-flex ml-1 align-middle group">
    <button type="button" onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)} onClick={()=>setShow(s=>!s)} className="text-gray-400 hover:text-brand-500 transition-colors">
      <HelpCircle size={13}/>
    </button>
    {show&&<span className="absolute z-50 w-60 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 shadow-xl leading-relaxed" style={{top:'1.6rem',left:'50%',transform:'translateX(-50%)',whiteSpace:'normal'}}>
      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45 block"/>
      {text}
    </span>}
  </span>;
}

type TestStatus='idle'|'running'|'completed'|'failed';
type TestRun={id:string;name:string;concurrentUsers:number;targetRps:number;duration:number;latencySla:number;status:TestStatus;p95:number|null;p99:number|null;actualRps:number|null;errorRate:number|null;createdAt:string;};

const MOCK_RUNS:TestRun[]=[
  {id:'1',name:'Production Baseline',concurrentUsers:500,targetRps:2000,duration:300,latencySla:200,status:'completed',p95:142,p99:198,actualRps:1987,errorRate:0.12,createdAt:new Date(Date.now()-3600000*2).toISOString()},
  {id:'2',name:'Peak Traffic Simulation',concurrentUsers:2000,targetRps:8000,duration:600,latencySla:300,status:'completed',p95:287,p99:412,actualRps:7640,errorRate:1.4,createdAt:new Date(Date.now()-3600000*24).toISOString()},
  {id:'3',name:'API Stress Ramp',concurrentUsers:5000,targetRps:15000,duration:900,latencySla:500,status:'failed',p95:null,p99:null,actualRps:null,errorRate:null,createdAt:new Date(Date.now()-3600000*48).toISOString()},
];

export function LoadTestingPage(){
  const[runs,setRuns]=useState<TestRun[]>(MOCK_RUNS);
  const[creating,setCreating]=useState(false);
  const[form,setForm]=useState({name:'',concurrentUsers:'500',targetRps:'2000',duration:'300',latencySla:'200',rampUp:'60',rampDown:'30',region:'us-east-1',authType:'none',jwtToken:'',chaos:false});
  const[saving,setSaving]=useState(false);
  const[expanded,setExpanded]=useState<string|null>(null);

  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));

  const startTest=async()=>{
    setSaving(true);
    await new Promise(r=>setTimeout(r,800));
    const run:TestRun={
      id:Date.now().toString(),name:form.name||'Untitled Test',
      concurrentUsers:+form.concurrentUsers,targetRps:+form.targetRps,
      duration:+form.duration,latencySla:+form.latencySla,
      status:'running',p95:null,p99:null,actualRps:null,errorRate:null,
      createdAt:new Date().toISOString(),
    };
    setRuns(p=>[run,...p]);
    setCreating(false);setSaving(false);
    setTimeout(()=>setRuns(p=>p.map(r=>r.id===run.id?{...r,status:'completed',p95:Math.round(Math.random()*200+80),p99:Math.round(Math.random()*300+150),actualRps:Math.round(+form.targetRps*(0.9+Math.random()*0.1)),errorRate:+(Math.random()*2).toFixed(2)}:r)),4000);
  };

  const statusColor=(s:TestStatus)=>s==='completed'?'bg-green-50 text-green-700 border-green-200':s==='running'?'bg-blue-50 text-blue-700 border-blue-200':s==='failed'?'bg-red-50 text-danger-600 border-red-200':'bg-gray-50 text-gray-600 border-gray-200';

  return<div>
  <PageHeader title="Load Testing" description="Simulate concurrent users and validate performance under expected and peak load." actions={<button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/>New load test</button>}/>

  {/* summary strip */}
  <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
    {[['Total Runs',runs.length,BarChart3,'bg-blue-50 text-blue-600'],['Completed',runs.filter(r=>r.status==='completed').length,CheckCircle2,'bg-green-50 text-green-600'],['Running',runs.filter(r=>r.status==='running').length,Activity,'bg-brand-50 text-brand-600'],['Failed',runs.filter(r=>r.status==='failed').length,AlertTriangle,'bg-red-50 text-danger-600']].map(([l,v,I,c]:any)=>(
      <div key={l} className="card flex items-center gap-3 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c}`}><I size={16}/></div>
        <div><p className="text-xl font-bold text-navy-900">{v}</p><p className="text-xs text-gray-500">{l}</p></div>
      </div>
    ))}
  </div>

  {runs.length===0
  ?<EmptyState icon={<Activity size={22}/>} title="No load tests yet" description="Configure and run your first load test to validate performance under traffic." action={<button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/>New load test</button>}/>
  :<div className="space-y-3">
    {runs.map(run=>(
      <div key={run.id} className="card p-0 overflow-hidden">
        <button onClick={()=>setExpanded(expanded===run.id?null:run.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Zap size={18}/></div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-navy-900 text-sm">{run.name}</span>
              <span className={`chip border text-xs ${statusColor(run.status)}`}>{run.status==='running'?'Running…':run.status.charAt(0).toUpperCase()+run.status.slice(1)}</span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Users size={11}/>{run.concurrentUsers.toLocaleString()} users</span>
              <span className="flex items-center gap-1"><Target size={11}/>{run.targetRps.toLocaleString()} RPS target</span>
              <span className="flex items-center gap-1"><Clock size={11}/>{run.duration}s</span>
            </div>
          </div>
          {run.status==='completed'&&(
            <div className="hidden sm:flex gap-4 text-right">
              <div><p className="text-xs text-gray-400">P95</p><p className="text-sm font-semibold text-navy-900">{run.p95}ms</p></div>
              <div><p className="text-xs text-gray-400">P99</p><p className="text-sm font-semibold text-navy-900">{run.p99}ms</p></div>
              <div><p className="text-xs text-gray-400">Actual RPS</p><p className="text-sm font-semibold text-navy-900">{run.actualRps?.toLocaleString()}</p></div>
              <div><p className="text-xs text-gray-400">Error Rate</p><p className={`text-sm font-semibold ${(run.errorRate??0)>1?'text-danger-600':'text-green-600'}`}>{run.errorRate}%</p></div>
            </div>
          )}
          {run.status==='running'&&<div className="flex items-center gap-2 text-xs text-blue-600"><Activity size={14} className="animate-pulse"/>Live</div>}
        </button>
        {expanded===run.id&&run.status==='completed'&&(
          <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
              {[['P95 Latency',`${run.p95}ms`,run.p95!>run.latencySla],['P99 Latency',`${run.p99}ms`,run.p99!>run.latencySla],['Actual RPS',run.actualRps?.toLocaleString()+'',false],['Error Rate',`${run.errorRate}%`,(run.errorRate??0)>1]].map(([l,v,warn]:any)=>(
                <div key={l} className={`rounded-lg border p-3 ${warn?'border-red-200 bg-red-50':'border-gray-200 bg-white'}`}>
                  <p className="text-xs text-gray-500">{l}</p>
                  <p className={`text-lg font-bold ${warn?'text-danger-600':'text-navy-900'}`}>{v}</p>
                </div>
              ))}
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm ${(run.p95??0)<=run.latencySla?'border-green-200 bg-green-50 text-green-700':'border-red-200 bg-red-50 text-danger-600'}`}>
              {(run.p95??0)<=run.latencySla?'✓ Latency SLA met — P95 within target':'⚠ Latency SLA breached — P95 exceeded the {run.latencySla}ms target'}
            </div>
          </div>
        )}
      </div>
    ))}
  </div>}

  {creating&&(
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setCreating(false)}>
  <div className="w-full max-w-lg animate-scale-in rounded-xl bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]" onClick={e=>e.stopPropagation()}>
    <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">Configure Load Test</h2><button onClick={()=>setCreating(false)} className="btn-ghost p-1"><X size={16}/></button></div>
    <div className="space-y-3">
      <div><label className="label">Test name<Tip text="A name to identify this test run later. Example: 'Black Friday Simulation' or 'Production Baseline'."/></label><input className="input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. Production Baseline"/></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Concurrent users<Tip text="How many people using your app at the same time. 500 means 500 users hitting your server simultaneously."/></label><input className="input" type="number" value={form.concurrentUsers} onChange={e=>f('concurrentUsers',e.target.value)} placeholder="500"/></div>
        <div><label className="label">Target RPS<Tip text="Requests Per Second — how many times per second your server is hit. 2000 RPS is a heavy load for most apps."/></label><input className="input" type="number" value={form.targetRps} onChange={e=>f('targetRps',e.target.value)} placeholder="2000"/></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Duration (seconds)<Tip text="How long the test runs. 300 seconds = 5 minutes. Longer tests reveal problems that only appear under sustained load."/></label><input className="input" type="number" value={form.duration} onChange={e=>f('duration',e.target.value)} placeholder="300"/></div>
        <div><label className="label">Latency SLA (ms)<Tip text="Your speed promise. 200ms means 95% of requests must respond within 200 milliseconds. If they don't, the test fails."/></label><input className="input" type="number" value={form.latencySla} onChange={e=>f('latencySla',e.target.value)} placeholder="200"/></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Ramp-up (seconds)<Tip text="How gradually users are added at the start. 60 seconds means traffic builds slowly over 1 minute, mimicking real traffic patterns."/></label><input className="input" type="number" value={form.rampUp} onChange={e=>f('rampUp',e.target.value)} placeholder="60"/></div>
        <div><label className="label">Ramp-down (seconds)<Tip text="How gradually traffic reduces at the end. Helps detect memory leaks that only appear when load drops."/></label><input className="input" type="number" value={form.rampDown} onChange={e=>f('rampDown',e.target.value)} placeholder="30"/></div>
      </div>
      <div><label className="label">Region<Tip text="Where the simulated traffic comes from. Choose the region closest to your real users for the most accurate results."/></label>
        <select className="input" value={form.region} onChange={e=>f('region',e.target.value)}>
          {['us-east-1','us-west-2','eu-west-1','eu-central-1','ap-southeast-1','ap-northeast-1'].map(r=><option key={r}>{r}</option>)}
        </select>
      </div>
      <div><label className="label">Authentication<Tip text="Most enterprise APIs require a login token. This lets the load test authenticate as a real user so it can access protected endpoints."/></label>
        <select className="input" value={form.authType} onChange={e=>f('authType',e.target.value)}>
          <option value="none">None</option><option value="jwt">JWT / Bearer Token</option><option value="api-key">API Key</option><option value="oauth">OAuth 2.0 Client Credentials</option>
        </select>
      </div>
      {form.authType==='jwt'&&<div><label className="label">JWT Token</label><input className="input" type="password" value={form.jwtToken} onChange={e=>f('jwtToken',e.target.value)} placeholder="eyJ..."/></div>}
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input type="checkbox" checked={form.chaos} onChange={e=>setForm(p=>({...p,chaos:e.target.checked}))}/> Inject chaos during test<Tip text="Deliberately introduces problems (CPU spikes, network delays) during the test to see if your app recovers gracefully under stress."/>
      </label>
    </div>
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={()=>setCreating(false)} className="btn-secondary">Cancel</button>
      <button onClick={startTest} disabled={saving} className="btn-primary">{saving?<Loader2 size={16} className="animate-spin"/>:<Zap size={16}/>}Start test</button>
    </div>
  </div>
  </div>
  )}
  </div>;
}