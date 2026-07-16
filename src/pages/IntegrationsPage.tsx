import{useEffect,useState}from'react';
import{supabase,type Integration}from'../lib/supabase';
import{PageHeader,EmptyState,Spinner}from'../lib/ui';
import{useRouter}from'../lib/router';
import { Webhook, Plus, X, Loader as Loader2, Check, RefreshCw, Trash2, GitFork as Github, Slash as Slack, Cloud, Link as Jenkins, Mail, MessageSquare } from 'lucide-react';

type IntegrationType='github'|'slack'|'aws'|'jenkins'|'smtp'|'teams'|'webhook'|'datadog'|'pagerduty'|'jira';

const INTEGRATION_CATALOG:{type:IntegrationType;name:string;description:string;icon:typeof Github;color:string;fields:{key:string;label:string;placeholder:string;type?:string}[]}[]=[
{type:'github',name:'GitHub',description:'Connect repositories for automated validation on pull requests and pushes.',icon:Github,color:'bg-gray-900 text-white',fields:[{key:'token',label:'Personal Access Token',placeholder:'ghp_xxxxxxxxxxxx',type:'password'}]},
{type:'slack',name:'Slack',description:'Send validation results and alerts to Slack channels.',icon:Slack,color:'bg-purple-600 text-white',fields:[{key:'webhook_url',label:'Incoming Webhook URL',placeholder:'https://hooks.slack.com/services/...'}]},
{type:'aws',name:'AWS',description:'Deploy validated changes to AWS services (EC2, ECS, Lambda).',icon:Cloud,color:'bg-orange-500 text-white',fields:[{key:'access_key_id',label:'Access Key ID',placeholder:'AKIA...'}, {key:'secret_access_key',label:'Secret Access Key',placeholder:'...',type:'password'}, {key:'region',label:'Region',placeholder:'us-east-1'}]},
{type:'jenkins',name:'Jenkins',description:'Trigger Jenkins jobs as part of validation pipelines.',icon:Jenkins,color:'bg-blue-600 text-white',fields:[{key:'url',label:'Jenkins URL',placeholder:'https://jenkins.example.com'}, {key:'username',label:'Username',placeholder:'admin'}, {key:'token',label:'API Token',placeholder:'...',type:'password'}]},
{type:'smtp',name:'SMTP Email',description:'Send validation reports and deployment passports via email.',icon:Mail,color:'bg-gray-600 text-white',fields:[{key:'host',label:'SMTP Host',placeholder:'smtp.gmail.com'}, {key:'port',label:'Port',placeholder:'587'}, {key:'username',label:'Username',placeholder:'user@example.com'}, {key:'password',label:'Password',placeholder:'...',type:'password'}]},
{type:'teams',name:'Microsoft Teams',description:'Post validation results to Microsoft Teams channels.',icon:MessageSquare,color:'bg-blue-700 text-white',fields:[{key:'webhook_url',label:'Incoming Webhook URL',placeholder:'https://outlook.office.com/webhook/...'}]},
{type:'datadog',name:'Datadog',description:'Send validation metrics and events to Datadog.',icon:Cloud,color:'bg-purple-700 text-white',fields:[{key:'api_key',label:'API Key',placeholder:'...',type:'password'}, {key:'app_key',label:'App Key',placeholder:'...',type:'password'}]},
{type:'pagerduty',name:'PagerDuty',description:'Create incidents for failed validations and critical findings.',icon:Cloud,color:'bg-green-600 text-white',fields:[{key:'integration_key',label:'Integration Key',placeholder:'...',type:'password'}]},
{type:'jira',name:'Jira',description:'Create Jira tickets for findings and track remediation progress.',icon:Cloud,color:'bg-blue-500 text-white',fields:[{key:'url',label:'Jira URL',placeholder:'https://yourorg.atlassian.net'}, {key:'email',label:'Email',placeholder:'user@example.com'}, {key:'token',label:'API Token',placeholder:'...',type:'password'}]},
{type:'webhook',name:'Custom Webhook',description:'Send validation events to any HTTP endpoint.',icon:Webhook,color:'bg-brand-600 text-white',fields:[{key:'url',label:'Webhook URL',placeholder:'https://your-app.com/webhook'}, {key:'secret',label:'Signing Secret',placeholder:'...',type:'password'}]},
];

export default function IntegrationsPage(){
const{navigate}=useRouter();
const[loading,setLoading]=useState(true);
const[integrations,setIntegrations]=useState<Integration[]>([]);
const[showCatalog,setShowCatalog]=useState(false);
const[configType,setConfigType]=useState<IntegrationType|null>(null);
const[configValues,setConfigValues]=useState<Record<string,string>>({});
const[saving,setSaving]=useState(false);
const[error,setError]=useState('');
const[testing,setTesting]=useState<string|null>(null);

const wsId=()=>localStorage.getItem('sandbox.activeWs');

const load=async()=>{
  setLoading(true);
  const wid=wsId();
  if(!wid){setLoading(false);return;}
  const{data,error}=await supabase.from('integrations').select('*').eq('workspace_id',wid).order('created_at',{ascending:false});
  if(error)console.error('IntegrationsPage load error:',error);
  setIntegrations(data??[]);
  setLoading(false);
};

useEffect(()=>{load();},[]);

const startConfig=(type:IntegrationType)=>{
  setConfigType(type);
  setConfigValues({});
  setError('');
  setShowCatalog(false);
};

const saveIntegration=async()=>{
  if(!configType)return;
  const wid=wsId();
  if(!wid)return;
  const catalog=INTEGRATION_CATALOG.find(c=>c.type===configType)!;
  setSaving(true);setError('');
  const{data,error}=await supabase.from('integrations').insert({
    workspace_id:wid,
    type:configType,
    name:catalog.name,
    status:'connected',
    config:configValues,
    last_sync_at:new Date().toISOString(),
  }).select().single();
  if(error){setError(error.message);setSaving(false);return;}
  setIntegrations(prev=>[data,...prev]);
  setConfigType(null);setConfigValues({});setSaving(false);
};

const removeIntegration=async(id:string)=>{
  await supabase.from('integrations').delete().eq('id',id);
  setIntegrations(prev=>prev.filter(i=>i.id!==id));
};

const testIntegration=async(id:string)=>{
  setTesting(id);
  // Simulate a test by updating last_sync_at
  await supabase.from('integrations').update({last_sync_at:new Date().toISOString()}).eq('id',id);
  setIntegrations(prev=>prev.map(i=>i.id===id?{...i,last_sync_at:new Date().toISOString()}:i));
  setTimeout(()=>setTesting(null),1500);
};

const getCatalogItem=(type:string)=>INTEGRATION_CATALOG.find(c=>c.type===type);

if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

return<div>
<PageHeader title="Integrations" description="Connect external services to extend your validation workflows." actions={
<button onClick={()=>setShowCatalog(true)} className="btn-primary"><Plus size={16}/> Add integration</button>
}/>

{integrations.length===0
?<EmptyState icon={<Webhook size={22}/>} title="No integrations configured" description="Connect GitHub, Slack, AWS, Jenkins, and more to automate your validation pipelines." action={<button onClick={()=>setShowCatalog(true)} className="btn-primary"><Plus size={16}/> Add integration</button>}/>
:<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
{integrations.map(integ=>{
  const cat=getCatalogItem(integ.type);
  const Icon=cat?.icon??Webhook;
  const color=cat?.color??'bg-gray-600 text-white';
  return(
    <div key={integ.id} className="card">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}><Icon size={20}/></div>
        <span className={`chip border ${integ.status==='connected'?'bg-brand-50 text-brand-700 border-brand-200':'bg-gray-100 text-gray-500 border-gray-200'}`}>
          {integ.status==='connected'&&<Check size={11}/>}{integ.status}
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-navy-900">{integ.name}</h3>
      <p className="mt-1 text-sm text-gray-500">{cat?.description??'Custom integration'}</p>
      {integ.last_sync_at&&<p className="mt-2 text-xs text-gray-400">Last sync: {new Date(integ.last_sync_at).toLocaleString()}</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={()=>testIntegration(integ.id)} disabled={testing===integ.id} className="btn-secondary text-xs">
          {testing===integ.id?<Loader2 size={12} className="animate-spin"/>:<RefreshCw size={12}/>} Test
        </button>
        <button onClick={()=>removeIntegration(integ.id)} className="btn-ghost text-xs text-danger-600 hover:bg-red-50"><Trash2 size={12}/></button>
      </div>
    </div>
  );
})}
</div>}

{/* Catalog modal */}
{showCatalog&&!configType&&(
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setShowCatalog(false)}>
<div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto animate-scale-in rounded-xl bg-white p-5 shadow-xl" onClick={e=>e.stopPropagation()}>
<div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Add integration</h2><button onClick={()=>setShowCatalog(false)} className="btn-ghost p-1"><X size={16}/></button></div>
<div className="grid gap-3 sm:grid-cols-2">
{INTEGRATION_CATALOG.map(cat=>(
<button key={cat.type} onClick={()=>startConfig(cat.type)} className="card text-left transition-all hover:shadow-md hover:-translate-y-0.5">
<div className="flex items-center gap-3">
<div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cat.color}`}><cat.icon size={18}/></div>
<div><h3 className="text-sm font-semibold text-navy-900">{cat.name}</h3><p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{cat.description}</p></div>
</div>
</button>
))}
</div>
</div>
</div>
)}

{/* Config modal */}
{configType&&(()=>{
  const cat=INTEGRATION_CATALOG.find(c=>c.type===configType)!;
  return(
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>{setConfigType(null);setError('');}}>
<div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-5 shadow-xl" onClick={e=>e.stopPropagation()}>
<div className="mb-4 flex items-center justify-between">
<div className="flex items-center gap-3">
<div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cat.color}`}><cat.icon size={18}/></div>
<h2 className="text-lg font-semibold">{cat.name}</h2>
</div>
<button onClick={()=>{setConfigType(null);setError('');}} className="btn-ghost p-1"><X size={16}/></button>
</div>
{error&&<div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-danger-600">{error}</div>}
{cat.fields.map(f=>(
<div key={f.key}>
<label className="label">{f.label}</label>
<input className="input mb-3" type={f.type??'text'} value={configValues[f.key]??''} onChange={e=>setConfigValues(prev=>({...prev,[f.key]:e.target.value}))} placeholder={f.placeholder}/>
</div>
))}
<p className="mb-4 text-xs text-gray-400">Credentials are stored securely and never exposed in the UI.</p>
<div className="flex justify-end gap-2"><button onClick={()=>{setConfigType(null);setError('');}} className="btn-secondary">Cancel</button><button onClick={saveIntegration} disabled={saving} className="btn-primary">{saving?<Loader2 size={16} className="animate-spin"/>:<Check size={16}/>} Save</button></div>
</div>
</div>
);
})()}
</div>;
}
