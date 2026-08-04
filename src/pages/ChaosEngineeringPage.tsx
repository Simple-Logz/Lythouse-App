import{useState}from'react';
import{PageHeader,EmptyState}from'../lib/ui';
import{Zap,Plus,X,Loader as Loader2,AlertTriangle,CheckCircle2,RefreshCw,Database,Server,Globe,Cpu,WifiOff,MemoryStick as HardDrive}from'lucide-react';

type ScenarioId='db-failure'|'pod-failure'|'region-failover'|'latency-injection'|'dns-failure'|'memory-leak'|'cpu-spike'|'network-packet-loss';
type RunStatus='idle'|'running'|'completed'|'failed';

const SCENARIOS:{id:ScenarioId;label:string;desc:string;icon:typeof Database;risk:'low'|'medium'|'high'|'critical';}[]=[
  {id:'db-failure',label:'Database Failure',desc:'Simulate primary database unavailability and validate failover to replica.',icon:Database,risk:'high'},
  {id:'pod-failure',label:'Kubernetes Pod Failures',desc:'Kill random pods and validate service recovery and auto-healing.',icon:Server,risk:'medium'},
  {id:'region-failover',label:'Cloud Region Failover',desc:'Simulate a full region outage and validate cross-region traffic routing.',icon:Globe,risk:'critical'},
  {id:'latency-injection',label:'Latency Injection',desc:'Add artificial network latency to downstream services and measure degradation.',icon:RefreshCw,risk:'low'},
  {id:'dns-failure',label:'DNS Failure',desc:'Simulate DNS resolution failures for internal and external services.',icon:WifiOff,risk:'medium'},
  {id:'memory-leak',label:'Memory Leak Simulation',desc:'Gradually increase memory consumption and validate OOM recovery.',icon:HardDrive,risk:'high'},
  {id:'cpu-spike',label:'CPU Spike',desc:'Spike CPU utilization to 95% and validate autoscaling response.',icon:Cpu,risk:'medium'},
  {id:'network-packet-loss',label:'Network Packet Loss',desc:'Introduce packet loss at 5%, 10%, and 25% and measure error rates.',icon:WifiOff,risk:'medium'},
];

const RISK_COLORS={low:'bg-green-50 text-green-700 border-green-200',medium:'bg-amber-50 text-amber-700 border-amber-200',high:'bg-red-50 text-danger-600 border-red-200',critical:'bg-red-100 text-red-800 border-red-300'};

type ChaosRun={id:string;scenario:ScenarioId;status:RunStatus;duration:number;recoveryTime:number|null;passed:boolean|null;findings:string[];createdAt:string;};

export function ChaosEngineeringPage(){
  // Sample entries so the page isn't empty on first visit — no scenarios have
  // actually run yet. New runs below are simulated too (see the banner).
  const[runs,setRuns]=useState<ChaosRun[]>([
    {id:'1',scenario:'pod-failure',status:'completed',duration:120,recoveryTime:18,passed:true,findings:['Pod recovered in 18s (within 30s SLA)','HPA scaled from 2→4 replicas during failure'],createdAt:new Date(Date.now()-3600000).toISOString()},
    {id:'2',scenario:'latency-injection',status:'completed',duration:300,recoveryTime:null,passed:false,findings:['P99 latency exceeded 2000ms at 200ms injection','Retry storms detected — circuit breaker not configured'],createdAt:new Date(Date.now()-86400000).toISOString()},
  ]);
  const[creating,setCreating]=useState(false);
  const[selected,setSelected]=useState<ScenarioId|null>(null);
  const[form,setForm]=useState({duration:'120',intensity:'medium',dryRun:false,namespace:'default',targetService:''});
  const[saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));

  const runScenario=async()=>{
    if(!selected)return;
    setSaving(true);
    await new Promise(r=>setTimeout(r,600));
    const run:ChaosRun={id:Date.now().toString(),scenario:selected,status:'running',duration:+form.duration,recoveryTime:null,passed:null,findings:[],createdAt:new Date().toISOString()};
    setRuns(p=>[run,...p]);setCreating(false);setSaving(false);
    setTimeout(()=>{
      const ok=Math.random()>0.3;
      const recovery=Math.floor(Math.random()*60+10);
      setRuns(p=>p.map(r=>r.id===run.id?{...r,status:'completed',recoveryTime:ok?recovery:null,passed:ok,findings:ok?[`Service recovered in ${recovery}s`,`No data loss detected`,`Alerting triggered within 8s`]:['Recovery exceeded SLA threshold','Circuit breaker not configured','Alert took 45s to fire — exceeds 30s target']}:r));
    },+form.duration*50);
  };

  const scenario=(id:ScenarioId)=>SCENARIOS.find(s=>s.id===id)!;

  return<div>
  <PageHeader title="Chaos Engineering" description="Validate resilience and recovery behaviour by deliberately injecting failures into your systems." actions={<button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/>Run scenario</button>}/>

  <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5"/>
    <div className="text-sm text-amber-800"><strong>Controlled environment only — and currently simulated.</strong> Scenarios are designed for staging and pre-production; never run against live production without a verified rollback plan. Runs you launch here return simulated outcomes for demonstration — real fault injection against connected infrastructure is on the roadmap.</div>
  </div>

  {/* scenario catalogue */}
  <div className="mb-8">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Available Scenarios</h2>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {SCENARIOS.map(s=>(
        <div key={s.id} className="card hover:shadow-md transition-all cursor-pointer" onClick={()=>{setSelected(s.id);setCreating(true);}}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600"><s.icon size={18}/></div>
            <span className={`chip border text-xs ${RISK_COLORS[s.risk]}`}>{s.risk}</span>
          </div>
          <h3 className="text-sm font-semibold text-navy-900 mb-1">{s.label}</h3>
          <p className="text-xs text-gray-500 line-clamp-2">{s.desc}</p>
        </div>
      ))}
    </div>
  </div>

  {/* run history */}
  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Run History</h2>
  {runs.length===0
  ?<EmptyState icon={<Zap size={22}/>} title="No chaos runs yet" description="Select a scenario above to start validating your system's resilience."/>
  :<div className="space-y-3">
    {runs.map(run=>{
      const sc=scenario(run.scenario);
      return<div key={run.id} className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600"><sc.icon size={18}/></div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-sm text-navy-900">{sc.label}</span>
                <span className={`chip border text-xs ${RISK_COLORS[sc.risk]}`}>{sc.risk}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>Duration: {run.duration}s</span>
                {run.recoveryTime!==null&&<span>Recovery: {run.recoveryTime}s</span>}
                <span>{new Date(run.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
          {run.status==='completed'&&(run.passed
            ?<div className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle2 size={16}/>Passed</div>
            :<div className="flex items-center gap-1.5 text-danger-600 text-sm font-medium"><AlertTriangle size={16}/>Failed</div>
          )}
          {run.status==='running'&&<div className="flex items-center gap-1.5 text-blue-600 text-sm"><Loader2 size={14} className="animate-spin"/>Running…</div>}
        </div>
        {run.findings.length>0&&(
          <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
            {run.findings.map((f,i)=>(
              <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${run.passed?'bg-green-50 text-green-700':'bg-red-50 text-danger-600'}`}>
                {run.passed?<CheckCircle2 size={12} className="mt-0.5 shrink-0"/>:<AlertTriangle size={12} className="mt-0.5 shrink-0"/>}{f}
              </div>
            ))}
          </div>
        )}
      </div>;
    })}
  </div>}

  {creating&&(
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>{setCreating(false);setSelected(null);}}>
  <div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-6 shadow-xl" onClick={e=>e.stopPropagation()}>
    <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Configure Scenario</h2><button onClick={()=>{setCreating(false);setSelected(null);}} className="btn-ghost p-1"><X size={16}/></button></div>
    <div className="mb-4">
      <label className="label">Scenario</label>
      <select className="input" value={selected??''} onChange={e=>setSelected(e.target.value as ScenarioId)}>
        <option value="">Select a scenario…</option>
        {SCENARIOS.map(s=><option key={s.id} value={s.id}>{s.label} ({s.risk} risk)</option>)}
      </select>
    </div>
    {selected&&<div className="mb-4 rounded-lg bg-gray-50 border border-[#18181b] px-3 py-2.5 text-xs text-gray-600">{scenario(selected).desc}</div>}
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Duration (seconds)</label><input className="input" type="number" value={form.duration} onChange={e=>f('duration',e.target.value)}/></div>
        <div><label className="label">Intensity</label>
          <select className="input" value={form.intensity} onChange={e=>f('intensity',e.target.value)}>
            <option>low</option><option>medium</option><option>high</option>
          </select>
        </div>
      </div>
      <div><label className="label">Namespace</label><input className="input" value={form.namespace} onChange={e=>f('namespace',e.target.value)} placeholder="default"/></div>
      <div><label className="label">Target service (optional)</label><input className="input" value={form.targetService} onChange={e=>f('targetService',e.target.value)} placeholder="Leave blank to target all"/></div>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input type="checkbox" checked={form.dryRun} onChange={e=>setForm(p=>({...p,dryRun:e.target.checked}))}/> Dry run (plan only — no changes applied)
      </label>
    </div>
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={()=>{setCreating(false);setSelected(null);}} className="btn-secondary">Cancel</button>
      <button onClick={runScenario} disabled={saving||!selected} className="btn-primary">{saving?<Loader2 size={16} className="animate-spin"/>:<Zap size={16}/>}{form.dryRun?'Run dry run':'Run scenario'}</button>
    </div>
  </div>
  </div>
  )}
  </div>;
}