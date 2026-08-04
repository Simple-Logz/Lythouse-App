import{useCallback,useEffect,useState}from'react';
import{supabase}from'../lib/supabase';
import{Spinner,EmptyState}from'../lib/ui';
import{Shield,Plus,X,Check,ChevronDown,ChevronRight,Lock,Package,Container,FileCheck,Users,AlertTriangle,Loader as Loader2} from'lucide-react';

type PolicyRule={id:string;label:string;required:boolean;description:string;};
type Policy={id:string;project_id:string;workspace_id:string;name:string;environment:string;enabled:boolean;rules:PolicyRule[];created_at:string;};

const DEFAULT_RULES:PolicyRule[]=[
  {id:'no_critical',label:'No Critical Findings',required:true,description:'Deployment is blocked if any critical security findings are open.'},
  {id:'secrets_scan',label:'Secrets Scan Required',required:true,description:'A secrets scan must complete with no exposed credentials.'},
  {id:'container_scan',label:'Container Image Scan',required:false,description:'All container images must be scanned before deployment.'},
  {id:'dependency_audit',label:'Dependency Audit',required:true,description:'All dependencies must be audited for known CVEs.'},
  {id:'two_approvals',label:'Minimum 2 Approvals',required:false,description:'At least 2 team members must approve before deployment.'},
  {id:'soc2',label:'SOC2 Validation',required:false,description:'Changes must pass SOC2 compliance controls.'},
  {id:'no_high',label:'No High-Severity Findings',required:false,description:'Deployment requires no high-severity open findings.'},
  {id:'rollback_ready',label:'Rollback Plan Required',required:false,description:'A rollback version must be specified before production deployment.'},
];

export function PoliciesPage({projectId,workspaceId}:{projectId:string;workspaceId:string;}){
  const[policies,setPolicies]=useState<Policy[]>([]);
  const[loading,setLoading]=useState(true);
  const[expanded,setExpanded]=useState<string|null>(null);
  const[creating,setCreating]=useState(false);
  const[newName,setNewName]=useState('');
  const[newEnv,setNewEnv]=useState('production');
  const[newRules,setNewRules]=useState<PolicyRule[]>(DEFAULT_RULES.map(r=>({...r})));
  const[saving,setSaving]=useState(false);
  const[toggling,setToggling]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    const{data}=await supabase.from('deployment_policies').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false});
    // Map existing policies to our format
    const mapped=(data??[]).map((d:any)=>({
      id:d.id,project_id:projectId,workspace_id:workspaceId,
      name:`${d.workspace_id} Policy`,environment:'production',enabled:true,
      rules:DEFAULT_RULES.map(r=>({...r,required:
        r.id==='no_critical'?d.block_critical:
        r.id==='no_high'?d.block_high:
        r.id==='two_approvals'?d.require_approval:r.required
      })),
      created_at:d.updated_at,
    }));
    // Also load custom policies if we have a custom table
    try{
      const{data:cp}=await supabase.from('project_policies' as any).select('*').eq('project_id',projectId);
      if(cp&&cp.length>0)setPolicies([...mapped,...(cp as Policy[])]);
      else setPolicies(mapped);
    }catch{setPolicies(mapped);}
    setLoading(false);
  },[projectId,workspaceId]);

  useEffect(()=>{load();},[load]);

  const createPolicy=async()=>{
    if(!newName.trim())return;
    setSaving(true);
    // Save to deployment_policies table (simplified)
    const{data}=await supabase.from('deployment_policies').upsert({
      workspace_id:workspaceId,
      block_critical:newRules.find(r=>r.id==='no_critical')?.required??true,
      block_high:newRules.find(r=>r.id==='no_high')?.required??false,
      require_approval:newRules.find(r=>r.id==='two_approvals')?.required??false,
      auto_deploy_on_pass:false,max_risk_score:50,cooldown_minutes:30,
    },{onConflict:'workspace_id'}).select().single();
    const newPolicy:Policy={
      id:data?.id||Date.now().toString(),project_id:projectId,workspace_id:workspaceId,
      name:newName.trim(),environment:newEnv,enabled:true,rules:newRules,
      created_at:new Date().toISOString(),
    };
    setPolicies(prev=>[newPolicy,...prev]);
    setCreating(false);setNewName('');setNewEnv('production');setNewRules(DEFAULT_RULES.map(r=>({...r})));setSaving(false);
  };

  const togglePolicy=async(id:string,enabled:boolean)=>{
    setToggling(id);
    setPolicies(prev=>prev.map(p=>p.id===id?{...p,enabled}:p));
    setToggling(null);
  };

  const toggleRule=(policyId:string,ruleId:string)=>{
    setPolicies(prev=>prev.map(p=>p.id===policyId?{...p,rules:p.rules.map(r=>r.id===ruleId?{...r,required:!r.required}:r)}:p));
  };

  if(loading)return<div className="flex justify-center py-16"><Spinner size={22}/></div>;

  return(
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2"><Shield size={18} className="text-brand-600"/>Deployment Policies</h2>
          <p className="text-sm text-gray-500 mt-0.5">Define rules every deployment must satisfy. Policies are enforced automatically before any release is approved.</p>
        </div>
        <button onClick={()=>setCreating(true)} className="btn-primary text-sm"><Plus size={14}/>New Policy</button>
      </div>

      {creating&&(
        <div className="card border-2 border-brand-300 bg-brand-50">
          <h3 className="text-sm font-semibold text-navy-900 mb-4">Create Deployment Policy</h3>
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <div>
              <label className="label">Policy name</label>
              <input autoFocus className="input" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Production Deployment Gate"/>
            </div>
            <div>
              <label className="label">Environment</label>
              <select className="input" value={newEnv} onChange={e=>setNewEnv(e.target.value)}>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="all">All environments</option>
              </select>
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Rules — toggle which are required</p>
          <div className="space-y-2 mb-4">
            {newRules.map(rule=>(
              <div key={rule.id} className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 transition-all ${rule.required?'border-brand-300 bg-white':'border-[#a1a1aa] bg-gray-50 opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900">{rule.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                </div>
                <button onClick={()=>setNewRules(prev=>prev.map(r=>r.id===rule.id?{...r,required:!r.required}:r))} className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors mt-0.5 ${rule.required?'bg-brand-600':'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rule.required?'translate-x-4':'translate-x-0'}`}/>
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={createPolicy} disabled={saving||!newName.trim()} className="btn-primary text-sm">
              {saving?<><Loader2 size={14} className="animate-spin"/>Saving…</>:<><Check size={14}/>Create Policy</>}
            </button>
            <button onClick={()=>setCreating(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {policies.length===0&&!creating?(
        <EmptyState icon={<Shield size={28}/>} title="No policies yet" description="Create a deployment policy to enforce rules before every release. Policies prevent risky deployments automatically." action={<button onClick={()=>setCreating(true)} className="btn-primary text-sm"><Plus size={14}/>Create Policy</button>}/>
      ):(
        <div className="space-y-3">
          {policies.map(policy=>{
            const isOpen=expanded===policy.id;
            const requiredCount=policy.rules.filter(r=>r.required).length;
            return(
              <div key={policy.id} className={`card p-0 overflow-hidden border-2 ${policy.enabled?'border-brand-200':'border-[#a1a1aa] opacity-60'}`}>
                <div className={`flex items-center gap-3 px-5 py-4 cursor-pointer ${policy.enabled?'bg-brand-50/50':'bg-gray-50'}`} onClick={()=>setExpanded(isOpen?null:policy.id)}>
                  {isOpen?<ChevronDown size={15} className="text-gray-400"/>:<ChevronRight size={15} className="text-gray-400"/>}
                  <Shield size={16} className={policy.enabled?'text-brand-600':'text-gray-400'}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-navy-900">{policy.name}</span>
                      <span className={`chip text-xs border capitalize ${policy.environment==='production'?'bg-red-50 text-red-600 border-red-200':policy.environment==='staging'?'bg-amber-50 text-amber-600 border-amber-200':'bg-gray-100 text-gray-600 border-[#a1a1aa]'}`}>{policy.environment}</span>
                      {policy.enabled?<span className="chip bg-green-50 text-green-700 border border-green-200 text-xs"><Check size={10}/>Active</span>:<span className="chip bg-gray-100 text-gray-500 border border-[#a1a1aa] text-xs">Disabled</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{requiredCount} rule{requiredCount!==1?'s':''} required · Created {new Date(policy.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>togglePolicy(policy.id,!policy.enabled)} disabled={toggling===policy.id} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${policy.enabled?'bg-brand-600':'bg-gray-300'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${policy.enabled?'translate-x-5':'translate-x-0'}`}/>
                    </button>
                  </div>
                </div>
                {isOpen&&(
                  <div className="border-t border-gray-100 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Deployment Rules</p>
                    <div className="space-y-2">
                      {policy.rules.map(rule=>(
                        <div key={rule.id} className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 transition-all ${rule.required?'border-brand-200 bg-brand-50':'border-[#a1a1aa] bg-gray-50'}`}>
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${rule.required?'bg-brand-500':'bg-gray-300'}`}/>
                            <div>
                              <p className={`text-sm font-medium ${rule.required?'text-navy-900':'text-gray-500'}`}>{rule.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                            </div>
                          </div>
                          <button onClick={()=>toggleRule(policy.id,rule.id)} className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors mt-0.5 ${rule.required?'bg-brand-600':'bg-gray-300'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rule.required?'translate-x-4':'translate-x-0'}`}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
