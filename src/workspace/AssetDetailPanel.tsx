import{useState,useEffect}from'react';
import{supabase,anonKey,edgeFunctionUrl}from'../lib/supabase';
import{X,RefreshCw,CheckCircle2,AlertTriangle,Clock,Activity,Shield,Zap,Eye,BarChart3,List,ChevronRight,ExternalLink,Loader as Loader2,Bell,BellOff,AlertCircle,Wifi,WifiOff,Trash2}from'lucide-react';

type Connection={id:string;source:string;status:string;config:Record<string,string>;last_synced_at:string|null;created_at:string;};

type AssetEvent={time:string;type:'change'|'validation'|'finding'|'drift'|'sync';message:string;severity:'low'|'medium'|'high';};

// Simulate asset-specific monitoring data based on what the asset reports
function getAssetStats(source:string,config:Record<string,string>){
  // These pull from real config to show meaningful data
  const stats:Record<string,{label:string;value:string;color:string}[]>={
    github:[
      {label:'Repository',value:config.url?.split('github.com/')[1]||'—',color:'text-gray-700'},
      {label:'Branch monitored',value:'main',color:'text-brand-600'},
      {label:'Watching events',value:'Pushes, PRs, Secrets',color:'text-gray-600'},
      {label:'Auto-revalidation',value:'On every push',color:'text-green-600'},
    ],
    aws:[
      {label:'Account region',value:config.region||'us-east-1',color:'text-gray-700'},
      {label:'Monitoring',value:'IAM, Security Groups, S3, CloudTrail',color:'text-gray-600'},
      {label:'Drift detection',value:'Enabled',color:'text-green-600'},
      {label:'Access Key',value:config.access_key?config.access_key.slice(0,8)+'…':'—',color:'text-gray-400'},
    ],
    kubernetes:[
      {label:'Cluster',value:config.cluster_url?.replace('https://','').split(':')[0]||'—',color:'text-gray-700'},
      {label:'Namespace',value:config.namespace||'default',color:'text-brand-600'},
      {label:'Watching',value:'Deployments, Secrets, ConfigMaps, Pods',color:'text-gray-600'},
      {label:'Sync frequency',value:'Every 60 seconds',color:'text-green-600'},
    ],
    slack:[
      {label:'Channel',value:config.channel||'#deployments',color:'text-brand-600'},
      {label:'Alerts',value:'Deployment events, Findings, Approvals',color:'text-gray-600'},
      {label:'Webhook',value:'Active',color:'text-green-600'},
    ],
    jira:[
      {label:'Instance',value:config.url?.replace('https://','').split('/')[0]||'—',color:'text-gray-700'},
      {label:'User',value:config.email||'—',color:'text-gray-600'},
      {label:'Integration',value:'Findings → Jira issues',color:'text-green-600'},
    ],
    datadog:[
      {label:'Site',value:config.site||'datadoghq.com',color:'text-gray-700'},
      {label:'Monitoring',value:'APM, Infrastructure, Monitors, SLOs',color:'text-gray-600'},
      {label:'Alert integration',value:'Active incidents block deployment',color:'text-amber-600'},
    ],
  };
  return stats[source]||[
    {label:'Source',value:source,color:'text-gray-700'},
    {label:'Status',value:'Monitoring active',color:'text-green-600'},
    {label:'Integration',value:'Changes trigger revalidation',color:'text-brand-600'},
  ];
}

const ASSET_WATCH_DETAIL:Record<string,{item:string;description:string;impact:string}[]>={
  github:[
    {item:'Push events',description:'Every commit pushed to the monitored branch',impact:'Triggers automatic validation scan'},
    {item:'Pull Requests',description:'PR opened, updated, merged or closed',impact:'Validates PR changes before merge'},
    {item:'Secret scanning',description:'Exposed credentials in code or commits',impact:'Creates critical deployment blocker immediately'},
    {item:'Workflow runs',description:'GitHub Actions CI/CD pipeline outcomes',impact:'Failed pipelines block deployment approval'},
    {item:'Branch protection',description:'Changes to branch protection rules',impact:'Policy compliance revalidation'},
  ],
  aws:[
    {item:'IAM changes',description:'Role policies, user permissions, access keys',impact:'Security revalidation triggered immediately'},
    {item:'Security Groups',description:'Inbound/outbound rule modifications',impact:'Network security finding created if exposure detected'},
    {item:'CloudTrail',description:'API calls and account activity audit log',impact:'Suspicious activity flags as high-severity finding'},
    {item:'S3 Buckets',description:'Bucket policy changes, public access settings',impact:'Public bucket exposure creates critical blocker'},
    {item:'EC2 / Lambda',description:'Instance state changes, function updates',impact:'Topology updated, readiness recalculated'},
  ],
  kubernetes:[
    {item:'Deployments',description:'New deployments, rollouts, rollbacks',impact:'Topology and release history updated automatically'},
    {item:'Secrets',description:'Kubernetes secret creation, modification, deletion',impact:'Secret changes trigger secrets validation scan'},
    {item:'ConfigMaps',description:'Application configuration changes',impact:'Configuration drift detected and reported'},
    {item:'Pod health',description:'CrashLoopBackOff, OOMKilled, Pending states',impact:'Unhealthy pods block deployment approval'},
    {item:'RBAC',description:'Role and role binding changes',impact:'Security posture revalidated immediately'},
  ],
  slack:[
    {item:'Deployment alerts',description:'Real-time notification on every deployment event',impact:'Team is always informed'},
    {item:'Finding notifications',description:'Critical and high findings sent immediately',impact:'Engineers notified without checking dashboard'},
    {item:'Approval requests',description:'Interactive approval buttons in Slack',impact:'Approvals can be done from Slack'},
    {item:'War Room updates',description:'Live release status during active deployments',impact:'Full team visibility during releases'},
  ],
};

export function AssetDetailPanel({connection,assetMeta,onClose,onDisconnect,onRetest}:{
  connection:Connection;
  assetMeta:{label:string;icon:string;category:string;watches:string[];impact:string;fields?:any[]};
  onClose:()=>void;
  onDisconnect:(id:string)=>void;
  onRetest:(id:string)=>void;
}){
  const[view,setView]=useState<'simple'|'detailed'>('simple');
  const[retesting,setRetesting]=useState(false);
  const[retestResult,setRetestResult]=useState<{ok:boolean;msg:string}|null>(null);
  const[events]=useState<AssetEvent[]>([
    {time:connection.last_synced_at||connection.created_at,type:'sync',message:`${assetMeta.label} connected and monitoring started`,severity:'low'},
  ]);

  const retest=async()=>{
    setRetesting(true);setRetestResult(null);
    try{
      const res=await fetch(`${edgeFunctionUrl}/test-connection`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({source:connection.source,config:connection.config}),
      });
      const d=await res.json();
      setRetestResult({ok:d.success,msg:d.success?(d.message+(d.details?' — '+d.details:'')):`Failed: ${d.message}`});
      if(d.success){
        await supabase.from('environment_connections').update({last_synced_at:new Date().toISOString()}).eq('id',connection.id);
      }
    }catch(e:any){setRetestResult({ok:false,msg:'Network error: '+e.message});}
    setRetesting(false);
    onRetest(connection.id);
  };

  const stats=getAssetStats(connection.source,connection.config);
  const watchDetail=ASSET_WATCH_DETAIL[connection.source]||assetMeta.watches.map(w=>({item:w,description:`Monitors ${w.toLowerCase()} for changes`,impact:'Changes trigger revalidation'}));

  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          <span className="text-3xl">{assetMeta.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-navy-900">{assetMeta.label}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${connection.status==='connected'?'text-green-700 bg-green-50 border-green-200':'text-gray-500 bg-gray-50 border-gray-200'}`}>
                {connection.status==='connected'?<><CheckCircle2 size={10}/>Connected</>:<><WifiOff size={10}/>Disconnected</>}
              </span>
            </div>
            <p className="text-xs text-gray-500">{assetMeta.category} · {connection.last_synced_at?`Last synced ${new Date(connection.last_synced_at).toLocaleString()}`:'Never synced'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><X size={18}/></button>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2 px-6 pt-4 shrink-0">
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button onClick={()=>setView('simple')} className={'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 '+(view==='simple'?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700')}>
              <Eye size={12}/>Simple
            </button>
            <button onClick={()=>setView('detailed')} className={'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 '+(view==='detailed'?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700')}>
              <List size={12}/>Detailed
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={retest} disabled={retesting} className="btn-secondary text-xs flex items-center gap-1.5">
              {retesting?<><Loader2 size={12} className="animate-spin"/>Testing…</>:<><RefreshCw size={12}/>Test Connection</>}
            </button>
            <button onClick={()=>{if(confirm(`Disconnect ${assetMeta.label}?`))onDisconnect(connection.id);}} className="btn-secondary text-xs text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-1.5">
              <Trash2 size={12}/>Disconnect
            </button>
          </div>
        </div>

        {/* Retest result */}
        {retestResult&&(
          <div className={`mx-6 mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${retestResult.ok?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-600'}`}>
            {retestResult.ok?<CheckCircle2 size={13}/>:<AlertTriangle size={13}/>}
            {retestResult.msg}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {view==='simple'&&(
            <>
              {/* What it does */}
              <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-700 mb-2 flex items-center gap-1.5"><Zap size={11}/>Business Impact</p>
                <p className="text-sm text-gray-700">{assetMeta.impact}</p>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {stats.map((s,i)=>(
                  <div key={i} className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className={`text-sm font-semibold truncate ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Currently watching */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Currently monitoring</p>
                <div className="flex flex-wrap gap-2">
                  {assetMeta.watches.map(w=>(
                    <span key={w} className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400"/>
                      {w}
                    </span>
                  ))}
                </div>
              </div>

              {/* Activity */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Recent activity</p>
                <div className="space-y-2">
                  {events.map((e,i)=>(
                    <div key={i} className="flex items-start gap-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
                      <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${e.severity==='high'?'bg-red-400':e.severity==='medium'?'bg-amber-400':'bg-green-400'}`}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700">{e.message}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{new Date(e.time).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 text-center py-1">More events will appear as {assetMeta.label} reports changes</p>
                </div>
              </div>
            </>
          )}

          {view==='detailed'&&(
            <>
              {/* Full watch breakdown */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">What LytHouse monitors — full breakdown</p>
                <div className="space-y-2">
                  {watchDetail.map((w,i)=>(
                    <div key={i} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-green-400 mt-1.5 shrink-0"/>
                        <div>
                          <p className="text-sm font-semibold text-navy-900">{w.item}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{w.description}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Zap size={10} className="text-brand-500"/>
                            <p className="text-xs text-brand-600 font-medium">{w.impact}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connection details (masked) */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Connection details</p>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
                  {Object.entries(connection.config).map(([k,v])=>(
                    <div key={k} className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-gray-500 capitalize">{k.replace(/_/g,' ')}</span>
                      <span className="font-mono text-gray-700 text-right truncate max-w-xs">
                        {k.toLowerCase().includes('secret')||k.toLowerCase().includes('password')||k.toLowerCase().includes('key')||k.toLowerCase().includes('token')
                          ?'•'.repeat(Math.min(String(v).length,20))
                          :String(v).length>40?String(v).slice(0,40)+'…':String(v)}
                      </span>
                    </div>
                  ))}
                  <p className="text-[10px] text-gray-400 pt-1">Credentials are encrypted at rest. Secrets are never displayed in full.</p>
                </div>
              </div>

              {/* Integration diagram */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">How it integrates</p>
                <div className="flex items-start gap-2 overflow-x-auto pb-2">
                  {[
                    {label:assetMeta.label,icon:assetMeta.icon,desc:'Source system'},
                    {label:'Change detected',icon:'🔔',desc:'LytHouse watches for events'},
                    {label:'Revalidation',icon:'⚡',desc:'Automatic scan triggered'},
                    {label:'Readiness update',icon:'📊',desc:'Score recalculated'},
                    {label:'Team notified',icon:'💬',desc:'Findings + alerts sent'},
                  ].map((step,i,arr)=>(
                    <div key={i} className="flex items-center gap-2 shrink-0">
                      <div className="text-center">
                        <div className="text-xl mb-1">{step.icon}</div>
                        <p className="text-[10px] font-semibold text-navy-900 w-16 text-center leading-tight">{step.label}</p>
                        <p className="text-[9px] text-gray-400 w-16 text-center leading-tight mt-0.5">{step.desc}</p>
                      </div>
                      {i<arr.length-1&&<ChevronRight size={14} className="text-gray-300 shrink-0 mt-1"/>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Connected since */}
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center gap-3">
                <Clock size={14} className="text-gray-400"/>
                <div>
                  <p className="text-xs font-medium text-gray-700">Connected since {new Date(connection.created_at).toLocaleString()}</p>
                  {connection.last_synced_at&&<p className="text-xs text-gray-400">Last successful sync: {new Date(connection.last_synced_at).toLocaleString()}</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
