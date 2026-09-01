import{PageHeader,EmptyState}from'../lib/ui';
import{Activity,AlertTriangle,Lock,Server}from'lucide-react';

export function LoadTestingPage(){
return <div>
<PageHeader title="Load Testing" description="Validate performance under expected and peak traffic using controlled, authorized execution."/>
<div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
<Lock size={18} className="text-amber-700 shrink-0 mt-0.5"/>
<div className="text-sm text-amber-900"><strong>Live execution is not enabled yet.</strong> LytHouse no longer generates sample or randomized performance results. Load generation will only run through a controlled executor after target ownership is verified, with hard concurrency and duration limits, rate limiting, cancellation and auditing.</div>
</div>
<div className="grid gap-4 sm:grid-cols-3 mb-6">
<div className="card"><Server size={18} className="text-brand-600 mb-2"/><p className="font-semibold text-sm">Verified targets only</p><p className="text-xs text-gray-500 mt-1">Traffic will only be sent to explicitly authorized endpoints.</p></div>
<div className="card"><Activity size={18} className="text-brand-600 mb-2"/><p className="font-semibold text-sm">Bounded execution</p><p className="text-xs text-gray-500 mt-1">Real runs require enforced rate, concurrency, duration and cancellation controls.</p></div>
<div className="card"><AlertTriangle size={18} className="text-brand-600 mb-2"/><p className="font-semibold text-sm">Real evidence only</p><p className="text-xs text-gray-500 mt-1">P95, P99, throughput and error rate will be shown only when measured by the executor.</p></div>
</div>
<EmptyState icon={<Activity size={22}/>} title="No verified load-test runs" description="Results will appear here only after a real controlled executor completes an authorized test. LytHouse does not display simulated performance numbers."/>
</div>;
}
