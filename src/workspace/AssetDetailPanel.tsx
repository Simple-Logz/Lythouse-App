import{useEffect,useState,useCallback}from'react';
import{supabase,anonKey}from'../lib/supabase';
import{X,RefreshCw,CheckCircle2,AlertTriangle,Clock,ExternalLink,Loader as Loader2,Eye,List,ChevronRight,Trash2,Zap,GitBranch,GitPullRequest,Activity,Shield,AlertCircle,CheckCircle,XCircle,Play,Package}from'lucide-react';

const EDGE='https://xrvugcytyfwyxytyqmom.supabase.co/functions/v1';

type Connection={id:string;source:string;status:string;config:Record<string,string>;last_synced_at:string|null;created_at:string;};

function StateIcon({state,size=12}:{state:string;size?:number}){
  const s=state?.toLowerCase();
  if(['ready','success','passed','ok','published','resolved','active'].includes(s))return<CheckCircle size={size} className="text-green-500"/>;
  if(['building','enqueued','running','loading','pending','acknowledged'].includes(s))return<Loader2 size={size} className="text-blue-500 animate-spin"/>;
  if(['error','failed','failure','critical','triggered'].includes(s))return<XCircle size={size} className="text-red-500"/>;
  if(['warning','warn','degraded','alert'].includes(s))return<AlertTriangle size={size} className="text-amber-500"/>;
  return<Activity size={size} className="text-gray-400"/>;
}

function StateBadge({state}:{state:string}){
  const s=state?.toLowerCase();
  const ok=['ready','success','passed','ok','published','resolved','active'];
  const building=['building','enqueued','running','pending','loading'];
  const bad=['error','failed','failure','critical','triggered'];
  const warn=['warning','warn','degraded','alert'];
  const cls=ok.includes(s)?'bg-green-50 text-green-700 border-green-200':
    building.includes(s)?'bg-blue-50 text-blue-700 border-blue-200':
    bad.includes(s)?'bg-red-50 text-red-700 border-red-200':
    warn.includes(s)?'bg-amber-50 text-amber-700 border-amber-200':
    'bg-gray-50 text-gray-600 border-[#a1a1aa]';
  return<span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium capitalize ${cls}`}><StateIcon state={state} size={10}/>{state||'unknown'}</span>;
}

function timeAgo(iso:string):string{
  const ms=Date.now()-new Date(iso).getTime();
  const m=Math.floor(ms/60000);const h=Math.floor(m/60);const d=Math.floor(h/24);
  if(m<1)return'just now';if(m<60)return`${m}m ago`;if(h<24)return`${h}h ago`;return`${d}d ago`;
}

// ─── Source-specific data renderers ──────────────────────────────────────────
function NetlifyData({data}:{data:any}){
  return<div className="space-y-4">
    {data.user&&<div className="flex items-center gap-3 rounded-xl bg-teal-50 border border-teal-200 px-4 py-3">
      {data.user.avatar&&<img src={data.user.avatar} className="w-9 h-9 rounded-full border border-teal-200"/>}
      <div><p className="text-sm font-semibold text-navy-900">{data.user.name}</p><p className="text-xs text-gray-500">{data.user.email}</p></div>
      <div className="ml-auto text-right"><p className="text-2xl font-semibold text-teal-600">{data.totalSites}</p><p className="text-xs text-gray-500">total sites</p></div>
    </div>}
    <div className="grid grid-cols-3 gap-2">
      {[{l:'Ready',v:data.summary?.healthy,c:'text-green-600',bg:'bg-green-50',b:'border-green-200'},
        {l:'Building',v:data.summary?.building,c:'text-blue-600',bg:'bg-blue-50',b:'border-blue-200'},
        {l:'Failed',v:data.summary?.failed,c:'text-red-600',bg:'bg-red-50',b:'border-red-200'}].map(s=>(
        <div key={s.l} className={`rounded-xl border ${s.b} ${s.bg} px-3 py-3 text-center`}>
          <div className={`text-2xl font-semibold ${s.c}`}>{s.v||0}</div>
          <div className="text-xs text-gray-500">{s.l}</div>
        </div>
      ))}
    </div>
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your Sites</p>
      <div className="space-y-2">
        {data.sites?.map((site:any)=>(
          <div key={site.id} className="rounded-xl border border-[#a1a1aa] bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-sm font-semibold text-navy-900">{site.name}</p>
                {site.url&&<a href={site.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1">{site.url}<ExternalLink size={10}/></a>}
              </div>
              <StateBadge state={site.state}/>
            </div>
            {site.lastDeploy&&<div className="rounded-lg bg-gray-50 px-3 py-2 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Last deploy:</span>
                <StateBadge state={site.lastDeploy.state}/>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-gray-600 truncate max-w-xs">{site.lastDeploy.title}</span>
                <span className="text-gray-400 shrink-0 ml-2">{site.lastDeploy.createdAt?timeAgo(site.lastDeploy.createdAt):''}</span>
              </div>
              {site.lastDeploy.branch&&<div className="flex items-center gap-1 text-gray-500"><GitBranch size={10}/>{site.lastDeploy.branch}</div>}
              {site.lastDeploy.deployTime&&<div className="text-gray-400">Deploy time: {site.lastDeploy.deployTime}s</div>}
              {site.lastDeploy.errorMessage&&<div className="text-red-600 font-medium">Error: {site.lastDeploy.errorMessage}</div>}
            </div>}
          </div>
        ))}
      </div>
    </div>
  </div>;
}

function GitHubData({data}:{data:any}){
  return<div className="space-y-4">
    <div className="rounded-xl bg-gray-900 text-white px-4 py-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold">{data.repo?.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{data.repo?.description||'No description'}</p>
        </div>
        <a href={data.repo?.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white"><ExternalLink size={14}/></a>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400">
        {data.repo?.language&&<span>🔤 {data.repo.language}</span>}
        <span>⭐ {data.repo?.stars}</span>
        <span>🍴 {data.repo?.forks}</span>
        <span>🐛 {data.repo?.openIssues} issues</span>
        <span className="capitalize">{data.repo?.visibility}</span>
        {data.repo?.lastPush&&<span>Pushed {timeAgo(data.repo.lastPush)}</span>}
      </div>
    </div>
    {data.recentRuns?.length>0&&<div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Recent Workflow Runs</p>
      <div className="space-y-1.5">
        {data.recentRuns.map((r:any,i:number)=>(
          <div key={i} className="flex items-center gap-3 rounded-lg border border-[#a1a1aa] px-3 py-2">
            <StateIcon state={r.conclusion||r.status} size={14}/>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-navy-900 truncate">{r.name}</p>
              <p className="text-[10px] text-gray-400">{r.branch} · {r.createdAt?timeAgo(r.createdAt):''}</p>
            </div>
            <StateBadge state={r.conclusion||r.status||'unknown'}/>
            {r.url&&<a href={r.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-600"><ExternalLink size={12}/></a>}
          </div>
        ))}
      </div>
    </div>}
    {data.recentCommits?.length>0&&<div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Recent Commits</p>
      <div className="space-y-1.5">
        {data.recentCommits.map((c:any,i:number)=>(
          <div key={i} className="flex items-start gap-3 rounded-lg border border-[#a1a1aa] px-3 py-2">
            <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 shrink-0 font-mono">{c.sha}</code>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-navy-900 truncate">{c.message}</p>
              <p className="text-[10px] text-gray-400">{c.author} · {c.date?timeAgo(c.date):''}</p>
            </div>
          </div>
        ))}
      </div>
    </div>}
    {data.openPRs?.length>0&&<div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Open Pull Requests ({data.openPRs.length})</p>
      <div className="space-y-1.5">
        {data.openPRs.map((pr:any)=>(
          <div key={pr.number} className="flex items-center gap-2 rounded-lg border border-[#a1a1aa] px-3 py-2">
            <GitPullRequest size={13} className="text-purple-500 shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-navy-900 truncate">{pr.title}</p>
              <p className="text-[10px] text-gray-400">#{pr.number} · {pr.author} · {pr.branch}</p>
            </div>
            {pr.draft&&<span className="text-[10px] text-gray-400 border border-[#a1a1aa] px-1.5 py-0.5 rounded">Draft</span>}
            <a href={pr.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-600 shrink-0"><ExternalLink size={11}/></a>
          </div>
        ))}
      </div>
    </div>}
  </div>;
}

function VercelData({data}:{data:any}){
  return<div className="space-y-4">
    {data.user&&<div className="flex items-center gap-3 rounded-xl bg-black text-white px-4 py-3">
      <span className="text-2xl">▲</span>
      <div><p className="text-sm font-semibold">{data.user.name}</p><p className="text-xs text-gray-400">{data.user.email}</p></div>
      <div className="ml-auto text-right"><p className="text-2xl font-semibold">{data.totalProjects}</p><p className="text-xs text-gray-400">projects</p></div>
    </div>}
    {data.recentDeploys?.length>0&&<div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Recent Deployments</p>
      <div className="space-y-2">
        {data.recentDeploys.map((d:any,i:number)=>(
          <div key={i} className="rounded-xl border border-[#a1a1aa] px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-navy-900">{d.name}</p>
              <StateBadge state={d.state||'unknown'}/>
            </div>
            {d.url&&<a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1">{d.url}<ExternalLink size={10}/></a>}
            <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-400">
              {d.branch&&<span className="flex items-center gap-1"><GitBranch size={9}/>{d.branch}</span>}
              {d.commit&&<span className="truncate max-w-xs">{d.commit}</span>}
              {d.target&&<span className="capitalize">{d.target}</span>}
              {d.createdAt&&<span>{timeAgo(d.createdAt)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>}
  </div>;
}

function GenericData({data,source}:{data:any;source:string}){
  return<div className="space-y-4">
    <div className="rounded-xl border border-[#a1a1aa] bg-gray-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Live Data from {source}</p>
      <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(data,null,2)}</pre>
    </div>
  </div>;
}

function renderData(source:string,data:any){
  if(!data)return null;
  switch(source){
    case'netlify':return<NetlifyData data={data}/>;
    case'github':case'github-actions':return<GitHubData data={data}/>;
    case'vercel':return<VercelData data={data}/>;
    default:return<GenericData data={data} source={source}/>;
  }
}

export function AssetDetailPanel({connection,assetMeta,onClose,onDisconnect,onRetest}:{
  connection:Connection;
  assetMeta:{label:string;icon:string;category:string;watches:string[];impact:string;fields?:any[]};
  onClose:()=>void;
  onDisconnect:(id:string)=>void;
  onRetest:(id:string)=>void;
}){
  const[view,setView]=useState<'live'|'details'>('live');
  const[liveData,setLiveData]=useState<any>(null);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState<string|null>(null);
  const[lastFetched,setLastFetched]=useState<Date|null>(null);

  const fetchData=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const res=await fetch(`${EDGE}/fetch-asset-data`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({source:connection.source,config:connection.config}),
      });
      const d=await res.json();
      if(d.success){setLiveData(d.data);setLastFetched(new Date());}
      else setError(d.error||'Failed to fetch data');
    }catch(e:any){setError('Could not reach data service — deploy the fetch-asset-data edge function');}
    setLoading(false);
  },[connection.source,connection.config]);

  useEffect(()=>{fetchData();},[fetchData]);

  // Auto-refresh every 60s
  useEffect(()=>{
    const t=setInterval(fetchData,60000);
    return()=>clearInterval(t);
  },[fetchData]);

  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{maxHeight:'90vh'}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          <span className="text-3xl">{assetMeta.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-navy-900">{assetMeta.label}</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border text-green-700 bg-green-50 border-green-200">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"/></span>
                Live
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{assetMeta.category}</span>
              {lastFetched&&<span>· Updated {timeAgo(lastFetched.toISOString())}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={fetchData} disabled={loading} title="Refresh" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
              <RefreshCw size={16} className={loading?'animate-spin':''}/>
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><X size={16}/></button>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-gray-100 shrink-0">
          <div className="flex gap-1 rounded-lg border border-[#a1a1aa] bg-gray-50 p-1">
            <button onClick={()=>setView('live')} className={'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 '+(view==='live'?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700')}>
              <Activity size={12}/>Live Data
            </button>
            <button onClick={()=>setView('details')} className={'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 '+(view==='details'?'bg-white text-navy-900 shadow-sm':'text-gray-500 hover:text-gray-700')}>
              <List size={12}/>Connection Details
            </button>
          </div>
          <button onClick={()=>{if(confirm(`Disconnect ${assetMeta.label}?`)){onDisconnect(connection.id);}}} className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 size={12}/>Disconnect
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {view==='live'&&(
            <div>
              {loading&&!liveData&&(
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={28} className="animate-spin text-brand-600"/>
                  <p className="text-sm text-gray-500">Fetching live data from {assetMeta.label}…</p>
                </div>
              )}
              {error&&(
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-sm font-semibold text-red-700">Could not load live data</p>
                      <p className="text-xs text-red-600 mt-1">{error}</p>
                      {error.includes('deploy')&&<div className="mt-3 rounded-lg bg-red-100 px-3 py-2">
                        <p className="text-xs font-mono text-red-800">npx supabase functions deploy fetch-asset-data --project-ref xrvugcytyfwyxytyqmom --no-verify-jwt</p>
                      </div>}
                      <button onClick={fetchData} className="mt-3 btn-secondary text-xs flex items-center gap-1.5"><RefreshCw size={11}/>Retry</button>
                    </div>
                  </div>
                </div>
              )}
              {liveData&&(
                <div>
                  {loading&&<div className="flex items-center gap-2 text-xs text-gray-400 mb-3"><Loader2 size={11} className="animate-spin"/>Refreshing…</div>}
                  {renderData(connection.source,liveData)}
                  <p className="text-[10px] text-gray-300 text-center mt-4">Auto-refreshes every 60 seconds</p>
                </div>
              )}
            </div>
          )}

          {view==='details'&&(
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Currently monitoring</p>
                <div className="flex flex-wrap gap-2">
                  {assetMeta.watches.map(w=>(
                    <span key={w} className="flex items-center gap-1.5 text-xs bg-white border border-[#a1a1aa] text-gray-600 px-3 py-1.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"/>{w}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-700 mb-1 flex items-center gap-1.5"><Zap size={11}/>Impact on deployment readiness</p>
                <p className="text-sm text-gray-700">{assetMeta.impact}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Stored credentials</p>
                <div className="rounded-xl border border-[#a1a1aa] bg-gray-50 px-4 py-3 space-y-2">
                  {Object.entries(connection.config).filter(([,v])=>v).map(([k,v])=>(
                    <div key={k} className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-gray-500 capitalize shrink-0">{k.replace(/_/g,' ')}</span>
                      <span className="font-mono text-gray-700 text-right truncate">
                        {['secret','password','key','token','private'].some(s=>k.toLowerCase().includes(s))
                          ?'•'.repeat(Math.min(String(v).length,24))
                          :String(v).length>50?String(v).slice(0,50)+'…':String(v)}
                      </span>
                    </div>
                  ))}
                  <p className="text-[10px] text-gray-400 pt-1 border-t border-[#a1a1aa]">Secrets are never shown in full and are encrypted at rest.</p>
                </div>
              </div>
              <div className="rounded-xl border border-[#a1a1aa] bg-white px-4 py-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Connected</span><span className="text-gray-700">{new Date(connection.created_at).toLocaleString()}</span></div>
                {connection.last_synced_at&&<div className="flex justify-between"><span className="text-gray-500">Last synced</span><span className="text-gray-700">{new Date(connection.last_synced_at).toLocaleString()}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Source ID</span><span className="font-mono text-gray-400">{connection.id.slice(0,12)}…</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
