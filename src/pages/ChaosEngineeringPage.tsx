import{PageHeader,EmptyState}from'../lib/ui';
import{Zap,AlertTriangle,Database,Server,Globe,Cpu,WifiOff,MemoryStick as HardDrive,Lock}from'lucide-react';

type ScenarioId='db-failure'|'pod-failure'|'region-failover'|'latency-injection'|'dns-failure'|'memory-leak'|'cpu-spike'|'network-packet-loss';
const SCENARIOS:{id:ScenarioId;label:string;desc:string;icon:typeof Database;risk:'low'|'medium'|'high'|'critical';}[]=[
{id:'db-failure',label:'Database Failure',desc:'Validate database failover after an authorized executor is connected.',icon:Database,risk:'high'},
{id:'pod-failure',label:'Kubernetes Pod Failures',desc:'Validate service recovery and auto-healing in an isolated environment.',icon:Server,risk:'medium'},
{id:'region-failover',label:'Cloud Region Failover',desc:'Validate cross-region routing with explicit infrastructure authorization.',icon:Globe,risk:'critical'},
{id:'latency-injection',label:'Latency Injection',desc:'Measure degradation from controlled network latency.',icon:Zap,risk:'low'},
{id:'dns-failure',label:'DNS Failure',desc:'Validate recovery from controlled DNS resolution failures.',icon:WifiOff,risk:'medium'},
{id:'memory-leak',label:'Memory Pressure',desc:'Validate recovery from controlled memory pressure.',icon:HardDrive,risk:'high'},
{id:'cpu-spike',label:'CPU Pressure',desc:'Validate autoscaling under controlled CPU pressure.',icon:Cpu,risk:'medium'},
{id:'network-packet-loss',label:'Network Packet Loss',desc:'Measure resilience under controlled packet loss.',icon:WifiOff,risk:'medium'},
];
const RISK_COLORS={low:'bg-green-50 text-green-700 border-green-200',medium:'bg-amber-50 text-amber-700 border-amber-200',high:'bg-red-50 text-danger-600 border-red-200',critical:'bg-red-100 text-red-800 border-red-300'};

export function ChaosEngineeringPage(){
return <div>
<PageHeader title="Chaos Engineering" description="Validate resilience through explicitly authorized fault injection in isolated environments."/>
<div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
<Lock size={18} className="text-amber-700 shrink-0 mt-0.5"/>
<div className="text-sm text-amber-900"><strong>Execution locked for safety.</strong> LytHouse will not fabricate chaos results or inject faults from the normal web application. Live execution will only be enabled through an isolated executor with verified target ownership, explicit authorization, hard safety limits, cancellation and an immutable audit trail.</div>
</div>
<div className="mb-8">
<h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Planned controlled scenarios</h2>
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
{SCENARIOS.map(s=><div key={s.id} className="card">
<div className="flex items-start justify-between mb-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600"><s.icon size={18}/></div><span className={`chip border text-xs ${RISK_COLORS[s.risk]}`}>{s.risk}</span></div>
<h3 className="text-sm font-semibold text-navy-900 mb-1">{s.label}</h3><p className="text-xs text-gray-500">{s.desc}</p>
</div>)}
</div>
</div>
<EmptyState icon={<AlertTriangle size={22}/>} title="No verified chaos runs" description="Results will appear here only after a real, authorized isolated executor completes a run. LytHouse does not display simulated resilience results."/>
</div>;
}
