import{useEffect,useState}from'react';
import{supabase,type Deployment}from'../lib/supabase';
import{PageHeader,Spinner,EmptyState,StatusBadge,timeAgo}from'../lib/ui';
import{Rocket,Server,Globe}from'lucide-react';

type DRow=Deployment&{project_name?:string;}

const ENV_COLORS:Record<string,string>={
production:'bg-red-50 text-danger-600 border-red-200',
staging:'bg-amber-50 text-amber-600 border-amber-200',
preview:'bg-blue-50 text-blue-600 border-blue-200',
};

export function DeploymentsPage(){
const[loading,setLoading]=useState(true);
const[deployments,setDeployments]=useState<DRow[]>([]);

const wsId=()=>localStorage.getItem('sandbox.activeWs');

const load=async()=>{
  setLoading(true);
  const wid=wsId();
  if(!wid){setLoading(false);return;}
  const{data,error}=await supabase.from('deployments').select('*,projects(name)').eq('workspace_id',wid).order('created_at',{ascending:false});
  if(error)console.error('DeploymentsPage load error:',error);
  setDeployments((data??[]).map((r:any)=>({...r,project_name:(r as any).projects?.name}))as DRow[]);
  setLoading(false);
};

useEffect(()=>{load();},[]);

if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

return<div>
<PageHeader title="Deployments" description="Track all deployments across your workspace environments."/>

{deployments.length===0
?<EmptyState icon={<Rocket size={22}/>} title="No deployments yet" description="Deployments triggered from validated changes will appear here."/>
:<div className="space-y-3">
{deployments.map(d=>(
<div key={d.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
<div className="flex items-center gap-3">
<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Rocket size={20}/></div>
<div>
<h3 className="text-sm font-semibold text-navy-900">{d.project_name??'Unknown project'}</h3>
<div className="mt-1 flex items-center gap-2">
<span className={`chip border ${ENV_COLORS[d.environment]??'bg-gray-100 text-gray-600 border-[#d4d4d8]'}`}><Globe size={11}/>{d.environment}</span>
<StatusBadge status={(d.status as any)??'pending'}/>
</div>
</div>
</div>
<div className="flex items-center gap-4 text-sm text-gray-500">
<div className="flex items-center gap-1.5"><Server size={13} className="text-gray-400"/>{d.config_overrides&&Object.keys(d.config_overrides).length?`${Object.keys(d.config_overrides).length} overrides`:'No overrides'}</div>
<span>{timeAgo(d.created_at)}</span>
</div>
</div>
))}
</div>}
</div>;
}
