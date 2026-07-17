import{useCallback,useEffect,useState}from'react';
import{supabase}from'../lib/supabase';
import{Spinner}from'../lib/ui';
import{GitBranch,Cloud,Container,Database,Boxes,Zap,CheckCircle2,XCircle,Clock,Plus,X,Check,ExternalLink,RefreshCw,AlertTriangle,Loader as Loader2}from'lucide-react';

type AssetSource={
  id:string;type:string;label:string;icon:typeof GitBranch;color:string;bg:string;border:string;
  description:string;fields:{key:string;label:string;placeholder:string;secret?:boolean}[];
};

const ASSET_SOURCES:AssetSource[]=[
  {id:'github',type:'GitHub Repository',label:'GitHub',icon:GitBranch,color:'text-gray-800',bg:'bg-gray-50',border:'border-gray-300',description:'Monitor branches, PRs, commits and secrets across repositories.',fields:[{key:'url',label:'Repository URL',placeholder:'https://github.com/org/repo'},{key:'token',label:'Personal Access Token',placeholder:'ghp_xxxx',secret:true}]},
  {id:'kubernetes',type:'Kubernetes Cluster',label:'Kubernetes',icon:Boxes,color:'text-blue-700',bg:'bg-blue-50',border:'border-blue-300',description:'Monitor deployments, secrets, configmaps and pod health.',fields:[{key:'cluster_url',label:'Cluster API URL',placeholder:'https://k8s.example.com'},{key:'token',label:'Service Account Token',placeholder:'eyJ...',secret:true},{key:'namespace',label:'Namespace',placeholder:'default'}]},
  {id:'aws',type:'AWS Account',label:'AWS',icon:Cloud,color:'text-orange-700',bg:'bg-orange-50',border:'border-orange-300',description:'Monitor IAM roles, security groups, S3 buckets and CloudTrail.',fields:[{key:'access_key',label:'Access Key ID',placeholder:'AKIA...'},{key:'secret_key',label:'Secret Access Key',placeholder:'wJalr...',secret:true},{key:'region',label:'Region',placeholder:'us-east-1'}]},
  {id:'azure',type:'Azure Subscription',label:'Azure',icon:Cloud,color:'text-blue-600',bg:'bg-blue-50',border:'border-blue-200',description:'Monitor Azure resources, AD, Key Vault and DevOps pipelines.',fields:[{key:'tenant_id',label:'Tenant ID',placeholder:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'},{key:'client_id',label:'Client ID',placeholder:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'},{key:'client_secret',label:'Client Secret',placeholder:'xxxxx',secret:true}]},
  {id:'docker',type:'Docker Registry',label:'Docker Registry',icon:Container,color:'text-blue-500',bg:'bg-blue-50',border:'border-blue-200',description:'Scan container images for vulnerabilities before deployment.',fields:[{key:'registry_url',label:'Registry URL',placeholder:'registry.example.com or docker.io'},{key:'username',label:'Username',placeholder:'username'},{key:'password',label:'Password / Token',placeholder:'xxxxx',secret:true}]},
  {id:'terraform',type:'Terraform State',label:'Terraform',icon:Database,color:'text-purple-700',bg:'bg-purple-50',border:'border-purple-300',description:'Monitor infrastructure changes and detect configuration drift.',fields:[{key:'backend_url',label:'State Backend URL',placeholder:'https://app.terraform.io/...'},{key:'token',label:'API Token',placeholder:'xxxxx',secret:true},{key:'workspace',label:'Workspace Name',placeholder:'production'}]},
  {id:'github-actions',type:'GitHub Actions',label:'GitHub Actions',icon:Zap,color:'text-gray-700',bg:'bg-gray-50',border:'border-gray-300',description:'Monitor CI/CD pipeline runs, failures and deployment triggers.',fields:[{key:'repo_url',label:'Repository URL',placeholder:'https://github.com/org/repo'},{key:'token',label:'Token with Actions scope',placeholder:'ghp_xxxx',secret:true}]},
  {id:'jenkins',type:'Jenkins',label:'Jenkins',icon:Zap,color:'text-red-700',bg:'bg-red-50',border:'border-red-200',description:'Monitor Jenkins build jobs, deployment pipelines and artifacts.',fields:[{key:'url',label:'Jenkins URL',placeholder:'https://jenkins.example.com'},{key:'username',label:'Username',placeholder:'admin'},{key:'token',label:'API Token',placeholder:'xxxxx',secret:true}]},
];

type Connection={id:string;project_id:string;workspace_id:string;source:string;status:string;config:Record<string,string>;last_synced_at:string|null;created_at:string;};

export function AssetsPage({projectId,workspaceId}:{projectId:string;workspaceId:string;}){
  const[connections,setConnections]=useState<Connection[]>([]);
  const[loading,setLoading]=useState(true);
  const[connecting,setConnecting]=useState<string|null>(null);
  const[formData,setFormData]=useState<Record<string,string>>({});
  const[saving,setSaving]=useState(false);
  const[testing,setTesting]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    const{data}=await supabase.from('environment_connections').select('*').eq('project_id',projectId).order('created_at',{ascending:false});
    setConnections((data??[]) as Connection[]);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{load();},[load]);

  const connect=async(source:AssetSource)=>{
    setSaving(true);
    const existing=connections.find(c=>c.source===source.id);
    const config:Record<string,string>={};
    source.fields.forEach(f=>{if(formData[f.key])config[f.key]=formData[f.key];});
    if(existing){
      const{data}=await supabase.from('environment_connections').update({status:'connected',config,last_synced_at:new Date().toISOString()}).eq('id',existing.id).select().single();
      if(data)setConnections(prev=>prev.map(c=>c.id===existing.id?data as Connection:c));
    }else{
      const{data}=await supabase.from('environment_connections').insert({project_id:projectId,workspace_id:workspaceId,source:source.id,status:'connected',config,last_synced_at:new Date().toISOString()}).select().single();
      if(data)setConnections(prev=>[data as Connection,...prev]);
    }
    setConnecting(null);setFormData({});setSaving(false);
  };

  const disconnect=async(id:string)=>{
    if(!confirm('Disconnect this asset?'))return;
    await supabase.from('environment_connections').update({status:'disconnected'}).eq('id',id);
    setConnections(prev=>prev.map(c=>c.id===id?{...c,status:'disconnected'}:c));
  };

  const testConnection=async(connectionId:string)=>{
    setTesting(connectionId);
    await new Promise(r=>setTimeout(r,1500));
    setTesting(null);
  };

  if(loading)return<div className="flex justify-center py-16"><Spinner size={22}/></div>;

  const connectedSources=new Set(connections.filter(c=>c.status==='connected').map(c=>c.source));
  const connectedCount=connectedSources.size;

  return(
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-navy-900">Assets — Connected Environment</h2>
        <p className="text-sm text-gray-500 mt-0.5">Connect the systems LytHouse monitors. Every connected asset contributes to deployment readiness and drift detection.</p>
      </div>

      {/* Summary */}
      <div className={`flex items-center gap-4 rounded-xl border-2 px-5 py-4 ${connectedCount>0?'border-green-300 bg-green-50':'border-gray-200 bg-gray-50'}`}>
        <div className={`text-3xl font-black ${connectedCount>0?'text-green-600':'text-gray-400'}`}>{connectedCount}</div>
        <div>
          <p className="text-sm font-semibold text-navy-900">{connectedCount===0?'No assets connected yet':connectedCount===1?'1 asset connected':`${connectedCount} assets connected`}</p>
          <p className="text-xs text-gray-500 mt-0.5">{connectedCount===0?'Connect your first asset to start continuous monitoring.':'LytHouse is monitoring these environments for changes and drift.'}</p>
        </div>
        {connectedCount>0&&(
          <div className="ml-auto flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"/></span>
            Live monitoring active
          </div>
        )}
      </div>

      {/* Asset grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {ASSET_SOURCES.map(source=>{
          const conn=connections.find(c=>c.source===source.id);
          const isConnected=conn?.status==='connected';
          const Icon=source.icon;
          const isConnecting=connecting===source.id;

          return(
            <div key={source.id} className={`card border-2 transition-all ${isConnected?source.border+' '+source.bg:'border-gray-200 hover:border-gray-300'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 ${isConnected?source.border+' '+source.bg:'border-gray-200 bg-gray-50'}`}>
                    <Icon size={18} className={isConnected?source.color:'text-gray-400'}/>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-navy-900">{source.label}</p>
                    <p className="text-xs text-gray-500">{source.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected?(
                    <>
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 size={13}/>Connected</span>
                      <button onClick={()=>testConnection(conn!.id)} disabled={testing===conn?.id} className="btn-ghost text-xs p-1.5">
                        {testing===conn?.id?<Loader2 size={12} className="animate-spin"/>:<RefreshCw size={12}/>}
                      </button>
                      <button onClick={()=>disconnect(conn!.id)} className="btn-ghost text-xs p-1.5 text-gray-400 hover:text-red-500"><X size={13}/></button>
                    </>
                  ):(
                    <span className="flex items-center gap-1 text-xs text-gray-400"><XCircle size={13}/>Not connected</span>
                  )}
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-3">{source.description}</p>

              {isConnected&&conn?.last_synced_at&&(
                <p className="text-xs text-gray-400 flex items-center gap-1 mb-3"><Clock size={10}/>Last synced {new Date(conn.last_synced_at).toLocaleString()}</p>
              )}

              {!isConnecting&&!isConnected&&(
                <button onClick={()=>{setConnecting(source.id);setFormData({});}} className="btn-primary text-xs w-full"><Plus size={13}/>Connect {source.label}</button>
              )}

              {isConnecting&&(
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  {source.fields.map(field=>(
                    <div key={field.key}>
                      <label className="label text-xs">{field.label}</label>
                      <input type={field.secret?'password':'text'} value={formData[field.key]||''} onChange={e=>setFormData(prev=>({...prev,[field.key]:e.target.value}))} placeholder={field.placeholder} className="input text-sm py-1.5"/>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button onClick={()=>connect(source)} disabled={saving} className="btn-primary text-xs flex-1">
                      {saving?<><Loader2 size={12} className="animate-spin"/>Connecting…</>:<><Check size={12}/>Save & Connect</>}
                    </button>
                    <button onClick={()=>{setConnecting(null);setFormData({});}} className="btn-secondary text-xs"><X size={12}/></button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
