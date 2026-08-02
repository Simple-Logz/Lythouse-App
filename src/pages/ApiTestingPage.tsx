import{useState}from'react';
import{PageHeader,EmptyState}from'../lib/ui';
import{Network,Plus,X,Loader as Loader2,CheckCircle2,AlertTriangle,Lock,Zap,FileCode2,Globe,FlaskConical}from'lucide-react';

type ScanStatus='idle'|'running'|'completed'|'failed';
type ApiScan={id:string;name:string;baseUrl:string;status:ScanStatus;endpointsFound:number|null;passed:number|null;failed:number|null;securityScore:number|null;owaspResults?:boolean[];createdAt:string;};

// Sample entries so the page isn't empty on first visit. No live scanner is
// wired up yet — see the notice below the page header.
const SAMPLE_SCANS:ApiScan[]=[
  {id:'1',name:'Production API (sample)',baseUrl:'https://api.yourapp.com',status:'completed',endpointsFound:42,passed:38,failed:4,securityScore:87,createdAt:new Date(Date.now()-7200000).toISOString()},
  {id:'2',name:'Staging v2 (sample)',baseUrl:'https://staging-api.yourapp.com',status:'completed',endpointsFound:38,passed:38,failed:0,securityScore:96,createdAt:new Date(Date.now()-86400000).toISOString()},
];

const OWASP_CHECKS=['Broken Object Level Authorization','Broken Authentication','Excessive Data Exposure','Lack of Resources & Rate Limiting','Broken Function Level Authorization','Mass Assignment','Security Misconfiguration','Injection','Improper Assets Management','Insufficient Logging & Monitoring'];

export function ApiTestingPage(){
  const[scans,setScans]=useState<ApiScan[]>(SAMPLE_SCANS);
  const[creating,setCreating]=useState(false);
  const[form,setForm]=useState({name:'',baseUrl:'',authType:'none',token:'',clientId:'',clientSecret:'',openApiUrl:'',timeout:'30',retries:'2',tlsVerify:true,rateLimitTest:true,schemaValidation:true});
  const[saving,setSaving]=useState(false);
  const[expanded,setExpanded]=useState<string|null>(null);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));

  const startScan=async()=>{
    if(!form.baseUrl.trim())return;
    setSaving(true);
    await new Promise(r=>setTimeout(r,700));
    const scan:ApiScan={id:Date.now().toString(),name:form.name||form.baseUrl,baseUrl:form.baseUrl,status:'running',endpointsFound:null,passed:null,failed:null,securityScore:null,createdAt:new Date().toISOString()};
    setScans(p=>[scan,...p]);setCreating(false);setSaving(false);
    setTimeout(()=>{
      const ep=Math.floor(Math.random()*30)+10;
      const fail=Math.floor(Math.random()*5);
      const owaspResults=OWASP_CHECKS.map(()=>Math.random()>0.15);
      setScans(p=>p.map(s=>s.id===scan.id?{...s,status:'completed',endpointsFound:ep,passed:ep-fail,failed:fail,securityScore:Math.floor(Math.random()*20+78),owaspResults}:s));
    },5000);
  };

  const scoreColor=(s:number)=>s>=90?'text-green-600':s>=70?'text-amber-600':'text-danger-600';

  return<div>
  <PageHeader title="API Testing" description="Discover, authenticate, and validate your APIs against OWASP security standards and OpenAPI contracts." actions={<button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/>New API scan</button>}/>

  <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
    <FlaskConical size={18} className="text-amber-600 shrink-0 mt-0.5"/>
    <div className="text-sm text-amber-800"><strong>Preview mode.</strong> Scans here are simulated for demonstration — no requests are sent to your API yet. Live OWASP scanning against a real base URL is on the roadmap; treat these numbers as a UI preview, not a security result.</div>
  </div>

  <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
    {[['Total Scans',scans.length,Globe,'bg-blue-50 text-blue-600'],['Endpoints Found',scans.reduce((a,s)=>a+(s.endpointsFound??0),0),Network,'bg-brand-50 text-brand-600'],['Issues Found',scans.reduce((a,s)=>a+(s.failed??0),0),AlertTriangle,'bg-red-50 text-danger-600'],['Avg Security Score',scans.filter(s=>s.securityScore!==null).length?Math.round(scans.filter(s=>s.securityScore!==null).reduce((a,s)=>a+(s.securityScore??0),0)/scans.filter(s=>s.securityScore!==null).length):0,Lock,'bg-green-50 text-green-600']].map(([l,v,I,c]:any)=>(
      <div key={l} className="card flex items-center gap-3 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c}`}><I size={16}/></div>
        <div><p className="text-xl font-bold text-navy-900">{v}{l==='Avg Security Score'?'%':''}</p><p className="text-xs text-gray-500">{l}</p></div>
      </div>
    ))}
  </div>

  {scans.length===0
  ?<EmptyState icon={<Network size={22}/>} title="No API scans yet" description="Configure your API base URL and run an automated security and contract scan." action={<button onClick={()=>setCreating(true)} className="btn-primary"><Plus size={16}/>New API scan</button>}/>
  :<div className="space-y-3">
    {scans.map(scan=>(
      <div key={scan.id} className="card p-0 overflow-hidden">
        <button onClick={()=>setExpanded(expanded===scan.id?null:scan.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Network size={18}/></div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-navy-900 text-sm">{scan.name}</span>
              <span className={`chip border text-xs ${scan.status==='completed'?'bg-green-50 text-green-700 border-green-200':scan.status==='running'?'bg-blue-50 text-blue-700 border-blue-200':'bg-red-50 text-danger-600 border-red-200'}`}>{scan.status==='running'?'Scanning…':scan.status.charAt(0).toUpperCase()+scan.status.slice(1)}</span>
            </div>
            <p className="text-xs text-gray-400 font-mono">{scan.baseUrl}</p>
          </div>
          {scan.status==='completed'&&(
            <div className="hidden sm:flex gap-4 text-right">
              <div><p className="text-xs text-gray-400">Endpoints</p><p className="text-sm font-semibold text-navy-900">{scan.endpointsFound}</p></div>
              <div><p className="text-xs text-gray-400">Passed</p><p className="text-sm font-semibold text-green-600">{scan.passed}</p></div>
              <div><p className="text-xs text-gray-400">Failed</p><p className={`text-sm font-semibold ${scan.failed!>0?'text-danger-600':'text-green-600'}`}>{scan.failed}</p></div>
              <div><p className="text-xs text-gray-400">Security</p><p className={`text-sm font-semibold ${scoreColor(scan.securityScore??0)}`}>{scan.securityScore}%</p></div>
            </div>
          )}
        </button>
        {expanded===scan.id&&scan.status==='completed'&&(
          <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">OWASP API Security Checks</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {OWASP_CHECKS.map((check,i)=>{
                const ok=scan.owaspResults?scan.owaspResults[i]:true;
                return<div key={check} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${ok?'border-green-200 bg-green-50':'border-red-200 bg-red-50'}`}>
                  {ok?<CheckCircle2 size={13} className="text-green-600 shrink-0"/>:<AlertTriangle size={13} className="text-danger-600 shrink-0"/>}
                  <span className={ok?'text-green-700':'text-danger-600'}>{check}</span>
                </div>;
              })}
            </div>
          </div>
        )}
      </div>
    ))}
  </div>}

  {creating&&(
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setCreating(false)}>
  <div className="w-full max-w-lg animate-scale-in rounded-xl bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]" onClick={e=>e.stopPropagation()}>
    <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">Configure API Scan</h2><button onClick={()=>setCreating(false)} className="btn-ghost p-1"><X size={16}/></button></div>
    <div className="space-y-3">
      <div><label className="label">Scan name</label><input className="input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. Production API"/></div>
      <div><label className="label">Base URL</label><input className="input" value={form.baseUrl} onChange={e=>f('baseUrl',e.target.value)} placeholder="https://api.yourapp.com"/></div>
      <div><label className="label">OpenAPI / Swagger URL (optional)</label><input className="input" value={form.openApiUrl} onChange={e=>f('openApiUrl',e.target.value)} placeholder="https://api.yourapp.com/openapi.json"/></div>
      <div><label className="label">Authentication</label>
        <select className="input" value={form.authType} onChange={e=>f('authType',e.target.value)}>
          <option value="none">None</option><option value="bearer">Bearer Token</option><option value="api-key">API Key</option><option value="oauth">OAuth 2.0 Client Credentials</option><option value="mtls">mTLS</option>
        </select>
      </div>
      {form.authType==='bearer'&&<div><label className="label">Bearer Token</label><input className="input" type="password" value={form.token} onChange={e=>f('token',e.target.value)} placeholder="eyJ..."/></div>}
      {form.authType==='oauth'&&<><div><label className="label">Client ID</label><input className="input" value={form.clientId} onChange={e=>f('clientId',e.target.value)}/></div><div><label className="label">Client Secret</label><input className="input" type="password" value={form.clientSecret} onChange={e=>f('clientSecret',e.target.value)}/></div></>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Timeout (s)</label><input className="input" type="number" value={form.timeout} onChange={e=>f('timeout',e.target.value)}/></div>
        <div><label className="label">Retries</label><input className="input" type="number" value={form.retries} onChange={e=>f('retries',e.target.value)}/></div>
      </div>
      <div className="space-y-2">
        {[['tlsVerify','Verify TLS certificates'],['rateLimitTest','Test rate limiting behaviour'],['schemaValidation','Validate against OpenAPI schema']].map(([k,l])=>(
          <label key={k} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input type="checkbox" checked={!!(form as any)[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.checked}))}/>{l}
          </label>
        ))}
      </div>
    </div>
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={()=>setCreating(false)} className="btn-secondary">Cancel</button>
      <button onClick={startScan} disabled={saving||!form.baseUrl.trim()} className="btn-primary">{saving?<Loader2 size={16} className="animate-spin"/>:<Zap size={16}/>}Start scan</button>
    </div>
  </div>
  </div>
  )}
  </div>;
}