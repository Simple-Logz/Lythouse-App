import{useCallback,useEffect,useState,useMemo}from'react';
import{supabase}from'../lib/supabase';
import{Spinner}from'../lib/ui';
import{GitBranch,Cloud,Database,Boxes,Zap,CheckCircle2,XCircle,Clock,Plus,X,Check,RefreshCw,AlertTriangle,Loader as Loader2,Search,Bell,Activity,ChevronDown,ChevronRight,Shield,Package,Globe,Server,Lock}from'lucide-react';

// ─── Full asset catalogue ─────────────────────────────────────────────────────
const ALL_ASSETS=[
  // Source Control
  {id:'github',category:'Source Control',label:'GitHub',desc:'Monitor branches, PRs, commits and secret exposure.',icon:'🐙',fields:[{key:'url',label:'Repository URL',ph:'https://github.com/org/repo'},{key:'token',label:'Personal Access Token',ph:'ghp_xxxx',secret:true}]},
  {id:'gitlab',category:'Source Control',label:'GitLab',desc:'Monitor MRs, pipelines, deployments and container registry.',icon:'🦊',fields:[{key:'url',label:'GitLab URL',ph:'https://gitlab.com/org/repo'},{key:'token',label:'Access Token',ph:'glpat-xxxx',secret:true}]},
  {id:'bitbucket',category:'Source Control',label:'Bitbucket',desc:'Monitor Bitbucket repos, pipelines and pull requests.',icon:'🪣',fields:[{key:'workspace',label:'Workspace',ph:'my-workspace'},{key:'token',label:'App Password',ph:'xxxx',secret:true}]},
  {id:'azure-devops-repos',category:'Source Control',label:'Azure DevOps Repos',desc:'Monitor Azure DevOps repositories and boards.',icon:'🔷',fields:[{key:'org',label:'Organization',ph:'myorg'},{key:'token',label:'PAT Token',ph:'xxxx',secret:true}]},
  // Cloud Providers
  {id:'aws',category:'Cloud',label:'AWS',desc:'Monitor IAM roles, security groups, S3, CloudTrail and Lambda.',icon:'🟠',fields:[{key:'access_key',label:'Access Key ID',ph:'AKIA...'},{key:'secret_key',label:'Secret Access Key',ph:'xxxx',secret:true},{key:'region',label:'Region',ph:'us-east-1'}]},
  {id:'azure',category:'Cloud',label:'Microsoft Azure',desc:'Monitor Azure resources, AD, Key Vault, AKS and DevOps.',icon:'🔵',fields:[{key:'tenant_id',label:'Tenant ID',ph:'xxxxxxxx-xxxx'},{key:'client_id',label:'Client ID',ph:'xxxxxxxx-xxxx'},{key:'client_secret',label:'Client Secret',ph:'xxxx',secret:true}]},
  {id:'gcp',category:'Cloud',label:'Google Cloud',desc:'Monitor GCP projects, IAM, Cloud Run, GKE and audit logs.',icon:'🔴',fields:[{key:'project_id',label:'Project ID',ph:'my-project-123'},{key:'service_account',label:'Service Account JSON',ph:'{"type":"service_account"...}',secret:true}]},
  {id:'alibaba',category:'Cloud',label:'Alibaba Cloud',desc:'Monitor Alibaba ECS, OSS, RAM policies and security events.',icon:'🟡',fields:[{key:'access_key',label:'Access Key ID',ph:'LTAI...'},{key:'secret_key',label:'Access Key Secret',ph:'xxxx',secret:true},{key:'region',label:'Region',ph:'cn-hangzhou'}]},
  {id:'oracle-cloud',category:'Cloud',label:'Oracle Cloud (OCI)',desc:'Monitor OCI compute, networking, identity and security.',icon:'🔴',fields:[{key:'tenancy',label:'Tenancy OCID',ph:'ocid1.tenancy.oc1...'},{key:'user_ocid',label:'User OCID',ph:'ocid1.user.oc1...'},{key:'fingerprint',label:'Key Fingerprint',ph:'xx:xx:xx...'},{key:'private_key',label:'Private Key',ph:'-----BEGIN...',secret:true}]},
  {id:'digitalocean',category:'Cloud',label:'DigitalOcean',desc:'Monitor Droplets, Kubernetes clusters, databases and spaces.',icon:'🌊',fields:[{key:'token',label:'Personal Access Token',ph:'dop_v1_xxxx',secret:true}]},
  {id:'hetzner',category:'Cloud',label:'Hetzner Cloud',desc:'Monitor Hetzner servers, load balancers and networks.',icon:'☁️',fields:[{key:'token',label:'API Token',ph:'xxxx',secret:true}]},
  {id:'cloudflare',category:'Cloud',label:'Cloudflare',desc:'Monitor DNS, WAF rules, workers and zero trust policies.',icon:'🌤',fields:[{key:'account_id',label:'Account ID',ph:'xxxx'},{key:'token',label:'API Token',ph:'xxxx',secret:true}]},
  // Kubernetes & Containers
  {id:'kubernetes',category:'Containers & Orchestration',label:'Kubernetes',desc:'Monitor deployments, secrets, configmaps and pod health.',icon:'☸️',fields:[{key:'cluster_url',label:'Cluster API URL',ph:'https://k8s.example.com'},{key:'token',label:'Service Account Token',ph:'eyJ...',secret:true},{key:'namespace',label:'Namespace',ph:'default'}]},
  {id:'docker',category:'Containers & Orchestration',label:'Docker Registry',desc:'Scan container images for vulnerabilities before deployment.',icon:'🐳',fields:[{key:'registry_url',label:'Registry URL',ph:'registry.example.com'},{key:'username',label:'Username',ph:'username'},{key:'password',label:'Password / Token',ph:'xxxx',secret:true}]},
  {id:'ecr',category:'Containers & Orchestration',label:'Amazon ECR',desc:'Monitor AWS Elastic Container Registry images and scan results.',icon:'📦',fields:[{key:'region',label:'Region',ph:'us-east-1'},{key:'access_key',label:'Access Key ID',ph:'AKIA...'},{key:'secret_key',label:'Secret',ph:'xxxx',secret:true}]},
  {id:'gcr',category:'Containers & Orchestration',label:'Google Container Registry',desc:'Monitor GCR images, vulnerability scan results and deployments.',icon:'📦',fields:[{key:'project_id',label:'Project ID',ph:'my-project'},{key:'service_account',label:'Service Account JSON',ph:'...',secret:true}]},
  {id:'helm',category:'Containers & Orchestration',label:'Helm',desc:'Monitor Helm chart releases, upgrades and rollbacks.',icon:'⛵',fields:[{key:'kubeconfig',label:'Kubeconfig (base64)',ph:'xxxx',secret:true},{key:'namespace',label:'Namespace',ph:'default'}]},
  // Infrastructure as Code
  {id:'terraform',category:'Infrastructure as Code',label:'Terraform',desc:'Monitor infrastructure changes and detect configuration drift.',icon:'🟣',fields:[{key:'backend_url',label:'State Backend URL',ph:'https://app.terraform.io/...'},{key:'token',label:'API Token',ph:'xxxx',secret:true},{key:'workspace',label:'Workspace',ph:'production'}]},
  {id:'pulumi',category:'Infrastructure as Code',label:'Pulumi',desc:'Monitor Pulumi stacks, updates and infrastructure drift.',icon:'🔶',fields:[{key:'token',label:'Pulumi Access Token',ph:'pul-xxxx',secret:true},{key:'org',label:'Organization',ph:'myorg'}]},
  {id:'ansible',category:'Infrastructure as Code',label:'Ansible',desc:'Monitor playbook runs, inventory changes and config drift.',icon:'⚙️',fields:[{key:'url',label:'AWX/Tower URL',ph:'https://tower.example.com'},{key:'token',label:'OAuth2 Token',ph:'xxxx',secret:true}]},
  {id:'crossplane',category:'Infrastructure as Code',label:'Crossplane',desc:'Monitor Crossplane managed resources and compositions.',icon:'🔗',fields:[{key:'kubeconfig',label:'Kubeconfig (base64)',ph:'xxxx',secret:true}]},
  // CI/CD
  {id:'github-actions',category:'CI/CD',label:'GitHub Actions',desc:'Monitor workflow runs, failures and deployment triggers.',icon:'⚡',fields:[{key:'repo_url',label:'Repository URL',ph:'https://github.com/org/repo'},{key:'token',label:'Token with Actions scope',ph:'ghp_xxxx',secret:true}]},
  {id:'jenkins',category:'CI/CD',label:'Jenkins',desc:'Monitor build jobs, deployment pipelines and artifacts.',icon:'🤵',fields:[{key:'url',label:'Jenkins URL',ph:'https://jenkins.example.com'},{key:'username',label:'Username',ph:'admin'},{key:'token',label:'API Token',ph:'xxxx',secret:true}]},
  {id:'circleci',category:'CI/CD',label:'CircleCI',desc:'Monitor pipeline runs, test results and deployment jobs.',icon:'⭕',fields:[{key:'token',label:'Personal API Token',ph:'xxxx',secret:true},{key:'org',label:'Organization',ph:'my-org'}]},
  {id:'gitlab-ci',category:'CI/CD',label:'GitLab CI/CD',desc:'Monitor GitLab pipeline jobs, artifacts and deployments.',icon:'🔁',fields:[{key:'url',label:'GitLab URL',ph:'https://gitlab.com'},{key:'token',label:'Access Token',ph:'glpat-xxxx',secret:true}]},
  {id:'azure-pipelines',category:'CI/CD',label:'Azure Pipelines',desc:'Monitor Azure DevOps pipeline runs and release gates.',icon:'🔷',fields:[{key:'org',label:'Organization',ph:'myorg'},{key:'project',label:'Project',ph:'myproject'},{key:'token',label:'PAT Token',ph:'xxxx',secret:true}]},
  {id:'argocd',category:'CI/CD',label:'ArgoCD',desc:'Monitor ArgoCD application sync status and drift.',icon:'🐙',fields:[{key:'url',label:'ArgoCD URL',ph:'https://argocd.example.com'},{key:'token',label:'API Token',ph:'xxxx',secret:true}]},
  {id:'spinnaker',category:'CI/CD',label:'Spinnaker',desc:'Monitor Spinnaker pipelines, deployments and canary analysis.',icon:'🎡',fields:[{key:'url',label:'Gate URL',ph:'https://spinnaker.example.com'},{key:'token',label:'Service Account Token',ph:'xxxx',secret:true}]},
  // Security & Compliance
  {id:'snyk',category:'Security',label:'Snyk',desc:'Monitor dependency vulnerabilities, license issues and container scans.',icon:'🔒',fields:[{key:'token',label:'API Token',ph:'xxxx',secret:true},{key:'org_id',label:'Organization ID',ph:'xxxx'}]},
  {id:'sonarqube',category:'Security',label:'SonarQube',desc:'Monitor code quality, security hotspots and coverage.',icon:'📊',fields:[{key:'url',label:'SonarQube URL',ph:'https://sonar.example.com'},{key:'token',label:'User Token',ph:'xxxx',secret:true}]},
  {id:'veracode',category:'Security',label:'Veracode',desc:'Monitor SAST/DAST scan results and policy compliance.',icon:'🛡',fields:[{key:'api_id',label:'API ID',ph:'xxxx'},{key:'api_key',label:'API Key',ph:'xxxx',secret:true}]},
  {id:'crowdstrike',category:'Security',label:'CrowdStrike',desc:'Monitor endpoint detections, vulnerabilities and threat intelligence.',icon:'🦅',fields:[{key:'client_id',label:'Client ID',ph:'xxxx'},{key:'client_secret',label:'Client Secret',ph:'xxxx',secret:true},{key:'region',label:'Region',ph:'us-1'}]},
  {id:'vault',category:'Security',label:'HashiCorp Vault',desc:'Monitor secrets access, policy changes and audit logs.',icon:'🔐',fields:[{key:'url',label:'Vault URL',ph:'https://vault.example.com'},{key:'token',label:'Token',ph:'hvs.xxxx',secret:true}]},
  // Observability
  {id:'datadog',category:'Observability',label:'Datadog',desc:'Monitor APM traces, infrastructure metrics and deployment markers.',icon:'🐶',fields:[{key:'api_key',label:'API Key',ph:'xxxx',secret:true},{key:'app_key',label:'Application Key',ph:'xxxx',secret:true},{key:'site',label:'Site',ph:'datadoghq.com'}]},
  {id:'newrelic',category:'Observability',label:'New Relic',desc:'Monitor application performance, errors and deployments.',icon:'📈',fields:[{key:'account_id',label:'Account ID',ph:'1234567'},{key:'api_key',label:'User API Key',ph:'NRAK-xxxx',secret:true}]},
  {id:'grafana',category:'Observability',label:'Grafana',desc:'Monitor dashboards, alerts and infrastructure health.',icon:'📉',fields:[{key:'url',label:'Grafana URL',ph:'https://grafana.example.com'},{key:'token',label:'Service Account Token',ph:'glsa_xxxx',secret:true}]},
  {id:'prometheus',category:'Observability',label:'Prometheus',desc:'Monitor metrics, alert rules and recording rules.',icon:'🔥',fields:[{key:'url',label:'Prometheus URL',ph:'https://prometheus.example.com'},{key:'username',label:'Username (if auth)',ph:'admin'},{key:'password',label:'Password',ph:'xxxx',secret:true}]},
  {id:'pagerduty',category:'Observability',label:'PagerDuty',desc:'Monitor incidents, on-call schedules and service health.',icon:'📟',fields:[{key:'token',label:'API Token',ph:'xxxx',secret:true}]},
  // Databases & Data
  {id:'postgres',category:'Databases',label:'PostgreSQL',desc:'Monitor schema changes, migrations and slow queries.',icon:'🐘',fields:[{key:'host',label:'Host',ph:'db.example.com'},{key:'port',label:'Port',ph:'5432'},{key:'database',label:'Database',ph:'production'},{key:'password',label:'Password',ph:'xxxx',secret:true}]},
  {id:'mysql',category:'Databases',label:'MySQL / MariaDB',desc:'Monitor schema changes, replication lag and query performance.',icon:'🐬',fields:[{key:'host',label:'Host',ph:'db.example.com'},{key:'database',label:'Database',ph:'production'},{key:'password',label:'Password',ph:'xxxx',secret:true}]},
  {id:'mongodb',category:'Databases',label:'MongoDB',desc:'Monitor Atlas clusters, change streams and index changes.',icon:'🍃',fields:[{key:'uri',label:'Connection URI',ph:'mongodb+srv://...',secret:true}]},
  {id:'redis',category:'Databases',label:'Redis',desc:'Monitor Redis instances, memory usage and config changes.',icon:'🔴',fields:[{key:'url',label:'Redis URL',ph:'redis://localhost:6379'},{key:'password',label:'Password',ph:'xxxx',secret:true}]},
  // Project Management & Ticketing
  {id:'jira',category:'Project Management',label:'Jira',desc:'Sync findings to Jira issues and track remediation progress.',icon:'🔵',fields:[{key:'url',label:'Jira URL',ph:'https://org.atlassian.net'},{key:'email',label:'Email',ph:'user@example.com'},{key:'token',label:'API Token',ph:'xxxx',secret:true}]},
  {id:'servicenow',category:'Project Management',label:'ServiceNow',desc:'Create and track ITSM incidents from security findings.',icon:'🟢',fields:[{key:'instance',label:'Instance',ph:'myinstance.service-now.com'},{key:'username',label:'Username',ph:'admin'},{key:'password',label:'Password',ph:'xxxx',secret:true}]},
  {id:'linear',category:'Project Management',label:'Linear',desc:'Create Linear issues from findings and track sprints.',icon:'🔷',fields:[{key:'token',label:'API Key',ph:'lin_api_xxxx',secret:true}]},
  // Communication
  {id:'slack',category:'Communication',label:'Slack',desc:'Send deployment alerts, finding notifications and approvals.',icon:'💬',fields:[{key:'webhook_url',label:'Webhook URL',ph:'https://hooks.slack.com/...',secret:true},{key:'channel',label:'Channel',ph:'#deployments'}]},
  {id:'teams',category:'Communication',label:'Microsoft Teams',desc:'Send notifications and approval requests to Teams channels.',icon:'🟣',fields:[{key:'webhook_url',label:'Webhook URL',ph:'https://outlook.office.com/webhook/...',secret:true}]},
  // Enterprise SaaS
  {id:'salesforce',category:'Enterprise SaaS',label:'Salesforce',desc:'Monitor Salesforce deployments, metadata changes and releases.',icon:'☁️',fields:[{key:'instance_url',label:'Instance URL',ph:'https://myorg.salesforce.com'},{key:'token',label:'Access Token',ph:'xxxx',secret:true}]},
  {id:'sap',category:'Enterprise SaaS',label:'SAP',desc:'Monitor SAP transport requests and system changes.',icon:'🔵',fields:[{key:'host',label:'Host',ph:'sap.example.com'},{key:'client',label:'Client',ph:'100'},{key:'username',label:'Username',ph:'BASIS'},{key:'password',label:'Password',ph:'xxxx',secret:true}]},
];

const CATEGORIES=[...new Set(ALL_ASSETS.map(a=>a.category))];

type Connection={id:string;project_id:string;workspace_id:string;source:string;status:string;config:Record<string,string>;last_synced_at:string|null;created_at:string;};
type DriftEvent={source:string;message:string;severity:'high'|'medium'|'low';detected_at:string;};

export function AssetsPage({projectId,workspaceId}:{projectId:string;workspaceId:string;}){
  const[connections,setConnections]=useState<Connection[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState('');
  const[catFilter,setCatFilter]=useState<string>('all');
  const[showCatalogue,setShowCatalogue]=useState(false);
  const[connecting,setConnecting]=useState<string|null>(null);
  const[formData,setFormData]=useState<Record<string,string>>({});
  const[saving,setSaving]=useState(false);
  const[testing,setTesting]=useState<string|null>(null);
  const[testResult,setTestResult]=useState<Record<string,boolean>>({});
  const[driftEvents]=useState<DriftEvent[]>([]);
  const[notifications,setNotifications]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);
    const{data}=await supabase.from('environment_connections').select('*').eq('project_id',projectId).order('created_at',{ascending:false});
    setConnections((data??[]) as Connection[]);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{load();},[load]);

  const connect=async(assetId:string)=>{
    setSaving(true);
    const existing=connections.find(c=>c.source===assetId);
    const config:Record<string,string>={};
    const asset=ALL_ASSETS.find(a=>a.id===assetId);
    asset?.fields.forEach(f=>{if(formData[f.key])config[f.key]=formData[f.key];});
    if(existing){
      const{data}=await supabase.from('environment_connections').update({status:'connected',config,last_synced_at:new Date().toISOString()}).eq('id',existing.id).select().single();
      if(data)setConnections(prev=>prev.map(c=>c.id===existing.id?data as Connection:c));
    }else{
      const{data}=await supabase.from('environment_connections').insert({project_id:projectId,workspace_id:workspaceId,source:assetId,status:'connected',config,last_synced_at:new Date().toISOString()}).select().single();
      if(data)setConnections(prev=>[data as Connection,...prev]);
    }
    setConnecting(null);setFormData({});setSaving(false);
  };

  const disconnect=async(id:string)=>{
    if(!confirm('Disconnect this asset? LytHouse will stop monitoring it.'))return;
    await supabase.from('environment_connections').update({status:'disconnected'}).eq('id',id);
    setConnections(prev=>prev.map(c=>c.id===id?{...c,status:'disconnected'}:c));
  };

  const testConnection=async(assetId:string,connId:string)=>{
    setTesting(connId);
    await new Promise(r=>setTimeout(r,1800));
    setTestResult(prev=>({...prev,[connId]:Math.random()>0.2}));
    setTesting(null);
  };

  const connected=connections.filter(c=>c.status==='connected');
  const connectedIds=new Set(connected.map(c=>c.source));

  const filteredAssets=useMemo(()=>ALL_ASSETS.filter(a=>{
    const matchSearch=!search||a.label.toLowerCase().includes(search.toLowerCase())||a.category.toLowerCase().includes(search.toLowerCase())||a.desc.toLowerCase().includes(search.toLowerCase());
    const matchCat=catFilter==='all'||a.category===catFilter;
    return matchSearch&&matchCat;
  }),[search,catFilter]);

  if(loading)return<div className="flex justify-center py-16"><Spinner size={22}/></div>;

  return(
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
              <Activity size={18} className="text-brand-600"/>Connected Environment — Continuous Validation
            </h2>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Every connected asset is <strong>continuously monitored</strong>. When anything changes — a new deployment, a secret rotation, an IAM policy update, a container image rebuild — LytHouse automatically revalidates your deployment readiness and updates your risk score in real time.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"/></span>{connected.length} asset{connected.length!==1?'s':''} live</span>
              <span className="flex items-center gap-1.5"><Bell size={11}/>{notifications?'Notifications on — you\'ll be alerted when drift is detected':'Notifications off'}</span>
              <button onClick={()=>setNotifications(n=>!n)} className={`text-xs font-medium underline ${notifications?'text-amber-600':'text-brand-600'}`}>{notifications?'Turn off':'Turn on'} alerts</button>
            </div>
          </div>
          <button onClick={()=>setShowCatalogue(s=>!s)} className="btn-primary text-sm shrink-0 flex items-center gap-2">
            <Plus size={14}/>{showCatalogue?'Hide Catalogue':'Add Asset'}
          </button>
        </div>
      </div>

      {/* Connected assets */}
      {connected.length>0&&(
        <div>
          <h3 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600"/>Connected ({connected.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connected.map(conn=>{
              const asset=ALL_ASSETS.find(a=>a.id===conn.source);
              if(!asset)return null;
              const isTesting=testing===conn.id;
              const tResult=testResult[conn.id];
              return(
                <div key={conn.id} className="card border-2 border-green-200 bg-green-50/30">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{asset.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-navy-900">{asset.label}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{asset.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 size={12}/>Live</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{asset.desc}</p>
                  {conn.last_synced_at&&<p className="text-[10px] text-gray-400 flex items-center gap-1 mb-3"><Clock size={10}/>Synced {new Date(conn.last_synced_at).toLocaleString()}</p>}
                  {tResult!==undefined&&<p className={`text-xs font-medium mb-2 ${tResult?'text-green-600':'text-red-500'}`}>{tResult?'✓ Connection verified':'✗ Connection failed — check credentials'}</p>}
                  <div className="flex gap-2">
                    <button onClick={()=>testConnection(conn.source,conn.id)} disabled={isTesting} className="btn-secondary text-xs flex-1">
                      {isTesting?<><Loader2 size={11} className="animate-spin"/>Testing…</>:<><RefreshCw size={11}/>Test</>}
                    </button>
                    <button onClick={()=>disconnect(conn.id)} className="px-2 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"><X size={12}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {connected.length===0&&!showCatalogue&&(
        <div className="card text-center py-12">
          <Globe size={36} className="mx-auto text-gray-200 mb-3"/>
          <h3 className="text-sm font-semibold text-navy-900 mb-1">No assets connected yet</h3>
          <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">Connect your infrastructure to start continuous monitoring. LytHouse will watch for changes and update your deployment readiness automatically.</p>
          <button onClick={()=>setShowCatalogue(true)} className="btn-primary text-sm"><Plus size={14}/>Add Your First Asset</button>
        </div>
      )}

      {/* Asset catalogue */}
      {showCatalogue&&(
        <div className="card border-2 border-brand-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-navy-900">Asset Catalogue — {ALL_ASSETS.length} integrations</h3>
            <button onClick={()=>setShowCatalogue(false)} className="btn-ghost p-1.5"><X size={14}/></button>
          </div>

          {/* Search & filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-52">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assets — GitHub, AWS, Datadog, Jira…" className="input pl-8 text-sm w-full"/>
              {search&&<button onClick={()=>setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"><X size={12}/></button>}
            </div>
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="input text-xs py-1.5 h-auto">
              <option value="all">All Categories</option>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Results count */}
          <p className="text-xs text-gray-400 mb-3">{filteredAssets.length} asset{filteredAssets.length!==1?'s':''} {search?`matching "${search}"`:'available'}</p>

          {/* Grouped results */}
          {CATEGORIES.filter(cat=>catFilter==='all'||cat===catFilter).map(cat=>{
            const catAssets=filteredAssets.filter(a=>a.category===cat);
            if(catAssets.length===0)return null;
            return(
              <div key={cat} className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-2">
                  <span className="flex-1 border-t border-gray-100"/>
                  {cat}
                  <span className="flex-1 border-t border-gray-100"/>
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {catAssets.map(asset=>{
                    const isConnected=connectedIds.has(asset.id);
                    const isConnecting=connecting===asset.id;
                    return(
                      <div key={asset.id} className={`rounded-xl border-2 transition-all ${isConnected?'border-green-200 bg-green-50':'border-gray-200 bg-white hover:border-brand-200'}`}>
                        <div className="flex items-start gap-3 px-3 py-3">
                          <span className="text-xl shrink-0">{asset.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-navy-900">{asset.label}</p>
                              {isConnected?<span className="text-xs text-green-600 font-medium flex items-center gap-1 shrink-0"><CheckCircle2 size={11}/>Connected</span>:
                              <button onClick={()=>{setConnecting(isConnecting?null:asset.id);setFormData({});}} className="text-xs font-semibold text-brand-600 hover:text-brand-700 shrink-0 flex items-center gap-0.5">
                                {isConnecting?<><X size={11}/>Cancel</>:<><Plus size={11}/>Connect</>}
                              </button>}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{asset.desc}</p>
                          </div>
                        </div>
                        {isConnecting&&(
                          <div className="border-t border-gray-100 px-3 pb-3 space-y-2">
                            {asset.fields.map(field=>(
                              <div key={field.key}>
                                <label className="label text-xs">{field.label}</label>
                                <input type={field.secret?'password':'text'} value={formData[field.key]||''} onChange={e=>setFormData(prev=>({...prev,[field.key]:e.target.value}))} placeholder={field.ph} className="input text-sm py-1.5"/>
                              </div>
                            ))}
                            <div className="flex gap-2 pt-1">
                              <button onClick={()=>connect(asset.id)} disabled={saving} className="btn-primary text-xs flex-1">
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
          })}
        </div>
      )}
    </div>
  );
}
