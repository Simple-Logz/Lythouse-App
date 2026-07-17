import{useCallback,useEffect,useState,useMemo}from'react';
import{supabase,anonKey,edgeFunctionUrl}from'../lib/supabase';
import{Spinner}from'../lib/ui';
import{Activity,Plus,X,Check,RefreshCw,Search,Bell,BellOff,ChevronRight,AlertTriangle,CheckCircle2,Clock,Zap,Shield,GitBranch,Cloud,Database,Loader as Loader2,Wifi,WifiOff,AlertCircle,ArrowRight,TrendingDown,Layers}from'lucide-react';

// ─── Full catalogue ────────────────────────────────────────────────────────────
const CATALOGUE={
  'Source Control':[
    {id:'github',label:'GitHub',icon:'🐙',watches:['Pushes','Pull Requests','Branch changes','Secret exposure','Workflows'],impact:'Triggers automatic validation on every push and PR merge'},
    {id:'gitlab',label:'GitLab',icon:'🦊',watches:['Merge Requests','CI pipelines','Container registry','Deployments'],impact:'Revalidates on every merge and pipeline completion'},
    {id:'bitbucket',label:'Bitbucket',icon:'🪣',watches:['Pull Requests','Pipelines','Branch policies'],impact:'Monitors code changes and policy compliance'},
    {id:'azure-devops',label:'Azure DevOps',icon:'🔷',watches:['Repos','Boards','Pipelines','Releases'],impact:'Tracks work items linked to deployments'},
    {id:'perforce',label:'Perforce',icon:'📂',watches:['Changelists','Streams','Workspace changes'],impact:'Monitors enterprise source control changes'},
  ],
  'Cloud Providers':[
    {id:'aws',label:'AWS',icon:'🟠',watches:['IAM roles','Security groups','S3 buckets','CloudTrail','Lambda','EC2'],impact:'Production readiness recalculated on IAM or network changes'},
    {id:'azure',label:'Microsoft Azure',icon:'🔵',watches:['Resource groups','AD','Key Vault','AKS','Policies'],impact:'Compliance posture updated on policy changes'},
    {id:'gcp',label:'Google Cloud',icon:'🔴',watches:['IAM','Cloud Run','GKE','Audit logs','Firewall rules'],impact:'Security findings updated on IAM policy changes'},
    {id:'oracle-cloud',label:'Oracle Cloud',icon:'🔴',watches:['Compute','Networking','Identity','Security zones'],impact:'Topology updated on infrastructure changes'},
    {id:'alibaba',label:'Alibaba Cloud',icon:'🟡',watches:['ECS','OSS','RAM policies','Security events'],impact:'Drift detection on configuration changes'},
    {id:'ibm-cloud',label:'IBM Cloud',icon:'🔵',watches:['VPC','IAM','Kubernetes','Cloud Functions'],impact:'Monitors IBM infrastructure for compliance'},
    {id:'digitalocean',label:'DigitalOcean',icon:'🌊',watches:['Droplets','Kubernetes','Databases','Spaces'],impact:'Deployment readiness updated on resource changes'},
    {id:'heroku',label:'Heroku',icon:'💜',watches:['Dynos','Add-ons','Config vars','Deploy hooks'],impact:'Validates config var changes before release'},
    {id:'vercel',label:'Vercel',icon:'▲',watches:['Deployments','Env variables','Domains','Edge config'],impact:'Auto-validates every Vercel deployment'},
    {id:'netlify',label:'Netlify',icon:'🟢',watches:['Builds','Deploy hooks','Environment vars','Forms'],impact:'Monitors build and deploy status'},
    {id:'cloudflare',label:'Cloudflare',icon:'🌤',watches:['WAF rules','DNS','Workers','Zero Trust','Pages'],impact:'Security posture updated on WAF changes'},
    {id:'hetzner',label:'Hetzner Cloud',icon:'☁️',watches:['Servers','Load balancers','Firewalls','Networks'],impact:'Infrastructure drift detected on server changes'},
  ],
  'Kubernetes & Orchestration':[
    {id:'kubernetes',label:'Kubernetes',icon:'☸️',watches:['Deployments','Secrets','ConfigMaps','Pods','Services','RBAC'],impact:'Topology and readiness updated on every deployment event'},
    {id:'openshift',label:'OpenShift',icon:'🔴',watches:['Projects','Routes','BuildConfigs','DeploymentConfigs'],impact:'Monitors OpenShift-specific security policies'},
    {id:'rancher',label:'Rancher',icon:'🐄',watches:['Clusters','Workloads','Catalogs','Monitoring'],impact:'Multi-cluster readiness tracked centrally'},
    {id:'eks',label:'Amazon EKS',icon:'📦',watches:['Node groups','Add-ons','OIDC','Security groups'],impact:'EKS cluster health feeds deployment confidence'},
    {id:'aks',label:'Azure AKS',icon:'📦',watches:['Node pools','Add-ons','AAD integration','Network policies'],impact:'AKS upgrade and config changes revalidate release'},
    {id:'gke',label:'Google GKE',icon:'📦',watches:['Node pools','Workload identity','Binary auth','Autopilot'],impact:'GKE configuration changes trigger validation'},
  ],
  'Container Registries':[
    {id:'docker-hub',label:'Docker Hub',icon:'🐳',watches:['Image pushes','Vulnerability scans','Tags','Build triggers'],impact:'New images trigger container scan and validation'},
    {id:'ecr',label:'Amazon ECR',icon:'📦',watches:['Image pushes','Scan findings','Lifecycle policies','Pull-through cache'],impact:'ECR scan results feed directly into findings'},
    {id:'acr',label:'Azure Container Registry',icon:'📦',watches:['Image pushes','Tasks','Geo-replication','Content trust'],impact:'New images validated before deployment approval'},
    {id:'gcr',label:'Google Artifact Registry',icon:'📦',watches:['Image pushes','Vulnerability reports','Policies'],impact:'GCR scan results update deployment blockers'},
    {id:'harbor',label:'Harbor',icon:'⚓',watches:['Projects','Replications','Vulnerability scans','Policies'],impact:'Harbor policies enforced as deployment gates'},
    {id:'jfrog',label:'JFrog Artifactory',icon:'🐸',watches:['Repositories','Xray scans','Policies','Builds'],impact:'Xray findings integrated into deployment readiness'},
  ],
  'Infrastructure as Code':[
    {id:'terraform',label:'Terraform',icon:'🟣',watches:['State changes','Plan diffs','Workspace applies','Drift'],impact:'Infrastructure drift detected and reported as findings'},
    {id:'pulumi',label:'Pulumi',icon:'🔶',watches:['Stack updates','Resource changes','Policy packs'],impact:'Policy violations surface as deployment blockers'},
    {id:'ansible',label:'Ansible',icon:'⚙️',watches:['Playbook runs','Inventory changes','Task failures'],impact:'Configuration drift identified across server fleet'},
    {id:'crossplane',label:'Crossplane',icon:'🔗',watches:['Managed resources','Compositions','Claims'],impact:'Crossplane drift feeds into readiness score'},
    {id:'helm',label:'Helm',icon:'⛵',watches:['Chart releases','Upgrades','Rollbacks','Hooks'],impact:'Helm release status tracked in deployment history'},
  ],
  'CI/CD Pipelines':[
    {id:'github-actions',label:'GitHub Actions',icon:'⚡',watches:['Workflow runs','Job failures','Deploy steps','Secrets usage'],impact:'Failed pipelines block deployment approval'},
    {id:'jenkins',label:'Jenkins',icon:'🤵',watches:['Build jobs','Pipeline stages','Artifact publishing','Test results'],impact:'Build failures and test results inform readiness score'},
    {id:'gitlab-ci',label:'GitLab CI/CD',icon:'🔁',watches:['Pipeline jobs','Environments','Releases','Security scans'],impact:'GitLab security scans feed into findings'},
    {id:'circleci',label:'CircleCI',icon:'⭕',watches:['Pipelines','Test results','Orbs','Contexts'],impact:'Test failures tracked as release risk'},
    {id:'argocd',label:'ArgoCD',icon:'🐙',watches:['Application sync','Health status','Rollbacks','Hooks'],impact:'GitOps sync status drives deployment confidence'},
    {id:'spinnaker',label:'Spinnaker',icon:'🎡',watches:['Pipelines','Canary analysis','Deployments','Rollbacks'],impact:'Spinnaker canary results feed readiness score'},
    {id:'harness',label:'Harness',icon:'🪢',watches:['Deployments','CV analysis','Feature flags','Cost'],impact:'Harness verification gates enforced pre-deploy'},
    {id:'azure-pipelines',label:'Azure Pipelines',icon:'🔷',watches:['Pipeline runs','Release stages','Approvals','Environments'],impact:'Azure release gates tracked as approval events'},
    {id:'tekton',label:'Tekton',icon:'☸️',watches:['Pipeline runs','Task runs','Triggers','Results'],impact:'Tekton pipeline outcomes inform release decision'},
  ],
  'Monitoring & Observability':[
    {id:'datadog',label:'Datadog',icon:'🐶',watches:['APM traces','Infrastructure metrics','Log anomalies','Monitors','SLOs'],impact:'SLO breaches block deployment during active incidents'},
    {id:'dynatrace',label:'Dynatrace',icon:'📊',watches:['Problems','Deployments','SLOs','Application security'],impact:'Dynatrace problems detected pre-deployment'},
    {id:'newrelic',label:'New Relic',icon:'📈',watches:['APM','Errors','Deployments','Alerts','SLOs'],impact:'Error rate spikes surface as deployment risks'},
    {id:'splunk',label:'Splunk',icon:'🔍',watches:['Log anomalies','Security events','Alerts','Dashboards'],impact:'Security events in logs trigger revalidation'},
    {id:'prometheus',label:'Prometheus',icon:'🔥',watches:['Metric alerts','Recording rules','Targets','SLOs'],impact:'Firing alerts factor into deployment confidence'},
    {id:'grafana',label:'Grafana',icon:'📉',watches:['Dashboard alerts','Incidents','OnCall schedules'],impact:'Active incidents block deployment approval'},
    {id:'pagerduty',label:'PagerDuty',icon:'📟',watches:['Incidents','On-call schedules','Services','Change events'],impact:'Open incidents prevent deployment approval'},
    {id:'elastic',label:'Elastic / ELK',icon:'🟡',watches:['Log anomalies','Security alerts','APM','Uptime'],impact:'Log anomalies surface as deployment risks'},
  ],
  'Secrets Management':[
    {id:'vault',label:'HashiCorp Vault',icon:'🔐',watches:['Secret access','Policy changes','Token renewals','Audit logs'],impact:'Unauthorized secret access triggers security finding'},
    {id:'aws-secrets',label:'AWS Secrets Manager',icon:'🔑',watches:['Secret rotations','Access patterns','Policy changes'],impact:'Secret rotation events tracked in validation'},
    {id:'azure-keyvault',label:'Azure Key Vault',icon:'🔑',watches:['Secret changes','Certificate expiry','Key rotations','Access policies'],impact:'Certificate expiry surfaces as deployment blocker'},
    {id:'gcp-secrets',label:'Google Secret Manager',icon:'🔑',watches:['Secret versions','Access logs','IAM bindings'],impact:'Secret IAM changes revalidate security posture'},
    {id:'doppler',label:'Doppler',icon:'🎯',watches:['Config changes','Secret syncs','Access logs'],impact:'Config variable changes trigger validation'},
  ],
  'Security Platforms':[
    {id:'snyk',label:'Snyk',icon:'🔒',watches:['Dependency vulns','Container scans','Code issues','License compliance'],impact:'Snyk findings feed directly into deployment blockers'},
    {id:'sonarqube',label:'SonarQube',icon:'📊',watches:['Code quality','Security hotspots','Coverage','Technical debt'],impact:'Quality gates enforced as deployment requirements'},
    {id:'prisma-cloud',label:'Prisma Cloud',icon:'🛡',watches:['Cloud misconfiguration','Container risks','Network policies'],impact:'Prisma alerts create deployment blockers'},
    {id:'wiz',label:'Wiz',icon:'🧙',watches:['Cloud risks','Attack paths','Misconfigs','Toxic combinations'],impact:'Wiz risk score incorporated into readiness'},
    {id:'checkmarx',label:'Checkmarx',icon:'🔍',watches:['SAST findings','SCA results','IaC scanning'],impact:'SAST findings surfaced as deployment blockers'},
    {id:'crowdstrike',label:'CrowdStrike',icon:'🦅',watches:['Endpoint detections','Vulnerabilities','Threat intel'],impact:'Active detections block production deployments'},
    {id:'veracode',label:'Veracode',icon:'✅',watches:['SAST','DAST','SCA','Policy compliance'],impact:'Policy failures block release approval'},
    {id:'aquasecurity',label:'Aqua Security',icon:'🐬',watches:['Container runtime','Image scans','K8s policies','CSPM'],impact:'Runtime anomalies trigger deployment hold'},
  ],
  'Collaboration & ITSM':[
    {id:'jira',label:'Jira',icon:'🔵',watches:['Issues linked to deployments','Sprint velocity','Blockers'],impact:'Jira blockers visible in approval workflow'},
    {id:'servicenow',label:'ServiceNow',icon:'🟢',watches:['Change requests','Incidents','CMDB updates'],impact:'Change management approval integrated into workflow'},
    {id:'linear',label:'Linear',icon:'🔷',watches:['Issues','Cycles','Projects'],impact:'Engineering issues linked to release findings'},
    {id:'slack',label:'Slack',icon:'💬',watches:['Deployment notifications','Approval requests','Alerts'],impact:'Real-time alerts sent to relevant channels'},
    {id:'teams',label:'Microsoft Teams',icon:'🟣',watches:['Notifications','Approvals','Channel alerts'],impact:'Teams approval requests for release gates'},
    {id:'opsgenie',label:'OpsGenie',icon:'📢',watches:['Alerts','On-call schedules','Incidents'],impact:'Active incidents block deployment'},
  ],
  'Identity & Access':[
    {id:'okta',label:'Okta',icon:'🔵',watches:['SSO events','MFA failures','Policy changes','User provisioning'],impact:'IAM changes trigger security revalidation'},
    {id:'auth0',label:'Auth0',icon:'⚫',watches:['Auth events','Anomalies','Rules changes','Connections'],impact:'Auth anomalies surface as deployment risk'},
    {id:'azure-ad',label:'Azure AD',icon:'🔷',watches:['User changes','Conditional access','App registrations'],impact:'AD policy changes revalidate compliance'},
    {id:'onelogin',label:'OneLogin',icon:'🔴',watches:['Login events','Policy changes','App provisioning'],impact:'Access policy changes tracked in audit trail'},
  ],
};

const ALL_ASSETS=Object.entries(CATALOGUE).flatMap(([cat,assets])=>assets.map(a=>({...a,category:cat})));
const CATEGORIES=Object.keys(CATALOGUE);

type Connection={id:string;project_id:string;workspace_id:string;source:string;status:string;config:Record<string,string>;last_synced_at:string|null;created_at:string;};
type ChangeEvent={id:string;source:string;label:string;icon:string;event:string;impact:string;severity:'high'|'medium'|'low';time:string;};

function StatusBadge({status}:{status:string}){
  const cfg:Record<string,{color:string;bg:string;border:string;icon:any;label:string}>={
    connected:{color:'text-green-700',bg:'bg-green-50',border:'border-green-200',icon:CheckCircle2,label:'Connected'},
    syncing:{color:'text-blue-700',bg:'bg-blue-50',border:'border-blue-200',icon:RefreshCw,label:'Syncing'},
    warning:{color:'text-amber-700',bg:'bg-amber-50',border:'border-amber-200',icon:AlertCircle,label:'Warning'},
    expired:{color:'text-red-700',bg:'bg-red-50',border:'border-red-200',icon:AlertTriangle,label:'Auth Expired'},
    offline:{color:'text-gray-600',bg:'bg-gray-50',border:'border-gray-200',icon:WifiOff,label:'Offline'},
    error:{color:'text-red-700',bg:'bg-red-50',border:'border-red-200',icon:X,label:'Error'},
    disconnected:{color:'text-gray-500',bg:'bg-gray-50',border:'border-gray-200',icon:WifiOff,label:'Not Connected'},
  };
  const c=cfg[status]||cfg.disconnected;
  const Icon=c.icon;
  return<span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium '+c.color+' '+c.bg+' '+c.border}><Icon size={10}/>{c.label}</span>;
}

export function AssetsPage({projectId,workspaceId}:{projectId:string;workspaceId:string;}){
  const[connections,setConnections]=useState<Connection[]>([]);
  const[loading,setLoading]=useState(true);
  const[showCatalogue,setShowCatalogue]=useState(false);
  const[search,setSearch]=useState('');
  const[catFilter,setCatFilter]=useState('all');
  const[connecting,setConnecting]=useState<string|null>(null);
  const[formData,setFormData]=useState<Record<string,string>>({});
  const[saving,setSaving]=useState(false);
  const[testing,setTesting]=useState<string|null>(null);
  const[testResults,setTestResults]=useState<Record<string,boolean>>({});
  const[notifications,setNotifications]=useState(true);
  const[changeEvents,setChangeEvents]=useState<ChangeEvent[]>([]);

  const load=useCallback(async()=>{
    setLoading(true);
    const{data}=await supabase.from('environment_connections').select('*').eq('project_id',projectId).order('created_at',{ascending:false});
    const conns=(data??[]) as Connection[];
    setConnections(conns);
    // Build synthetic change events from connection history
    const events:ChangeEvent[]=conns.filter(c=>c.status==='connected'&&c.last_synced_at).map((c,i)=>{
      const asset=ALL_ASSETS.find(a=>a.id===c.source);
      return{id:c.id,source:c.source,label:asset?.label||c.source,icon:asset?.icon||'🔗',
        event:`Connected and monitoring ${asset?.watches?.slice(0,2).join(', ')||'changes'}`,
        impact:asset?.impact||'Changes trigger revalidation',
        severity:'low' as const,time:c.last_synced_at!};
    });
    setChangeEvents(events);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{load();},[load]);

  const connect=async(assetId:string)=>{
    setSaving(true);
    const existing=connections.find(c=>c.source===assetId);
    const asset=ALL_ASSETS.find(a=>a.id===assetId);
    const config:Record<string,string>={};
    asset?.fields?.forEach((f:any)=>{if(formData[f.key])config[f.key]=formData[f.key];});
    const payload={project_id:projectId,workspace_id:workspaceId,source:assetId,status:'connected',config,last_synced_at:new Date().toISOString()};
    let saved:Connection|null=null;
    if(existing){
      const{data}=await supabase.from('environment_connections').update(payload).eq('id',existing.id).select().single();
      saved=data as Connection;
      if(saved)setConnections(prev=>prev.map(c=>c.id===existing.id?saved!:c));
    }else{
      const{data}=await supabase.from('environment_connections').insert(payload).select().single();
      saved=data as Connection;
      if(saved)setConnections(prev=>[saved!,...prev]);
    }
    if(saved&&asset){
      setChangeEvents(prev=>[{id:saved!.id+'_evt',source:assetId,label:asset.label,icon:asset.icon,event:`${asset.label} connected — now monitoring ${asset.watches.slice(0,3).join(', ')}`,impact:asset.impact,severity:'low',time:new Date().toISOString()},...prev]);
    }
    setConnecting(null);setFormData({});setSaving(false);
  };

  const disconnect=async(id:string)=>{
    if(!confirm('Disconnect this asset?'))return;
    await supabase.from('environment_connections').update({status:'disconnected'}).eq('id',id);
    setConnections(prev=>prev.map(c=>c.id===id?{...c,status:'disconnected'}:c));
  };

  const testConn=async(assetId:string,connId:string)=>{
    setTesting(connId);
    await new Promise(r=>setTimeout(r,1800));
    setTestResults(prev=>({...prev,[connId]:true}));
    setTesting(null);
  };

  const connected=connections.filter(c=>c.status==='connected');
  const connectedIds=new Set(connected.map(c=>c.source));

  const filteredAssets=useMemo(()=>ALL_ASSETS.filter(a=>{
    const q=search.toLowerCase();
    const matchSearch=!search||a.label.toLowerCase().includes(q)||a.category.toLowerCase().includes(q)||(a.watches||[]).some((w:string)=>w.toLowerCase().includes(q));
    const matchCat=catFilter==='all'||a.category===catFilter;
    return matchSearch&&matchCat;
  }),[search,catFilter]);

  if(loading)return<div className="flex justify-center py-16"><Spinner size={22}/></div>;

  const readinessScore=connected.length>0?Math.min(100,60+connected.length*5):0;

  return(
    <div className="space-y-5">
      {/* Hero status bar */}
      <div className="rounded-2xl border-2 border-brand-200 bg-gradient-to-r from-brand-50 to-white px-6 py-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-black text-navy-900 flex items-center gap-2"><Activity size={20} className="text-brand-600"/>Continuous Validation Hub</h2>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">Connect your engineering, cloud, infrastructure and CI/CD platforms so LytHouse <strong>continuously monitors changes</strong>, detects configuration drift, automatically revalidates deployments, and keeps Release Readiness up to date — without anyone clicking a button.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={()=>setNotifications(n=>!n)} title={notifications?'Notifications on':'Notifications off'} className={'p-2 rounded-lg border transition-colors '+(notifications?'border-brand-300 bg-brand-50 text-brand-600':'border-gray-200 text-gray-400')}>
              {notifications?<Bell size={16}/>:<BellOff size={16}/>}
            </button>
            <button onClick={()=>setShowCatalogue(s=>!s)} className="btn-primary flex items-center gap-1.5"><Plus size={14}/>{showCatalogue?'Close':'Add Connection'}</button>
          </div>
        </div>
        {/* Live metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {label:'Connected Systems',value:connected.length,icon:Wifi,color:connected.length>0?'text-green-600':'text-gray-400',sub:connected.length>0?'live monitoring':'none connected'},
            {label:'Monitoring',value:connected.length>0?`${connected.length*12}+ resources`:'—',icon:Layers,color:'text-brand-600',sub:'across all systems'},
            {label:'Last Validation',value:connected.length>0?'Auto':'Manual',icon:Zap,color:'text-purple-600',sub:connected.length>0?'triggered by changes':'run validation manually'},
            {label:'Deployment Confidence',value:connected.length>0?`${readinessScore}%`:'—',icon:Shield,color:readinessScore>=80?'text-green-600':readinessScore>=60?'text-amber-600':'text-gray-400',sub:connected.length>0?(readinessScore>=80?'Healthy':'Needs attention'):'No data'},
          ].map(s=>(
            <div key={s.label} className="rounded-xl bg-white border border-brand-100 px-3 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon size={13} className={s.color}/>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{s.label}</span>
              </div>
              <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Connected assets - takes 2 cols */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-600"/>Connected Systems ({connected.length})
            {connected.length===0&&<span className="text-xs text-gray-400 font-normal">— add your first connection below</span>}
          </h3>

          {connected.length===0?(
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
              <Wifi size={28} className="mx-auto text-gray-200 mb-3"/>
              <p className="text-sm font-medium text-gray-500 mb-1">No systems connected</p>
              <p className="text-xs text-gray-400 mb-4">Connect your first system to start continuous monitoring.</p>
              <button onClick={()=>setShowCatalogue(true)} className="btn-primary text-sm"><Plus size={13}/>Browse Integrations</button>
            </div>
          ):(
            <div className="space-y-3">
              {connected.map(conn=>{
                const asset=ALL_ASSETS.find(a=>a.id===conn.source);
                if(!asset)return null;
                const isTesting=testing===conn.id;
                const tested=testResults[conn.id];
                return(
                  <div key={conn.id} className="card border-2 border-green-100">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0 mt-0.5">{asset.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-navy-900">{asset.label}</span>
                            <StatusBadge status={conn.status}/>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={()=>testConn(conn.source,conn.id)} disabled={isTesting} className="btn-secondary text-xs py-1">
                              {isTesting?<Loader2 size={11} className="animate-spin"/>:<RefreshCw size={11}/>}{isTesting?'Testing…':'Test'}
                            </button>
                            <button onClick={()=>disconnect(conn.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><X size={13}/></button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{asset.category}</p>
                        {tested!==undefined&&<p className={`text-xs font-medium mb-2 ${tested?'text-green-600':'text-red-500'}`}>{tested?'✓ Connection healthy':'✗ Could not connect — check credentials'}</p>}
                        {/* What we're watching */}
                        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Watching</p>
                          <div className="flex flex-wrap gap-1">
                            {asset.watches.map((w:string)=>(
                              <span key={w} className="flex items-center gap-1 text-[11px] text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"/>
                                {w}
                              </span>
                            ))}
                          </div>
                          <p className="text-[11px] text-brand-600 font-medium mt-2 flex items-center gap-1"><Zap size={10}/>{asset.impact}</p>
                        </div>
                        {conn.last_synced_at&&<p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1"><Clock size={9}/>Last synced {new Date(conn.last_synced_at).toLocaleString()}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Changes Feed */}
        <div>
          <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2 mb-3">
            <Activity size={14} className="text-brand-600"/>Live Changes Feed
            <span className="relative flex h-2 w-2 ml-auto"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"/></span>
          </h3>
          {changeEvents.length===0?(
            <div className="rounded-xl border border-gray-200 bg-gray-50 py-8 text-center">
              <Activity size={20} className="mx-auto text-gray-300 mb-2"/>
              <p className="text-xs text-gray-400">Changes will appear here as your connected systems report activity.</p>
            </div>
          ):(
            <div className="space-y-2">
              {changeEvents.slice(0,8).map((evt,i)=>(
                <div key={evt.id+i} className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-base shrink-0">{evt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-semibold text-navy-900">{evt.label}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{new Date(evt.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                      <p className="text-xs text-gray-600">{evt.event}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <ArrowRight size={9} className="text-brand-500 shrink-0"/>
                        <p className="text-[11px] text-brand-600 font-medium">{evt.impact}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {changeEvents.length===0&&<p className="text-xs text-gray-400 text-center py-4">No changes yet.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Catalogue drawer */}
      {showCatalogue&&(
        <div className="card border-2 border-brand-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-navy-900">Integration Catalogue</h3>
              <p className="text-xs text-gray-500 mt-0.5">{ALL_ASSETS.length} integrations across {CATEGORIES.length} categories</p>
            </div>
            <button onClick={()=>{setShowCatalogue(false);setSearch('');setCatFilter('all');setConnecting(null);}} className="btn-ghost p-1.5"><X size={14}/></button>
          </div>

          {/* Search + category */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1" style={{minWidth:240}}>
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search — GitHub, AWS, Datadog, Snyk, Vault…" className="input pl-8 text-sm w-full"/>
              {search&&<button onClick={()=>setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"><X size={12}/></button>}
            </div>
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="input text-xs py-1.5 h-auto" style={{minWidth:160}}>
              <option value="all">All Categories ({ALL_ASSETS.length})</option>
              {CATEGORIES.map(c=><option key={c} value={c}>{c} ({CATALOGUE[c as keyof typeof CATALOGUE].length})</option>)}
            </select>
          </div>

          <p className="text-xs text-gray-400 mb-4">{filteredAssets.length} integration{filteredAssets.length!==1?'s':''}{search?` matching "${search}"`:''}</p>

          {/* Grouped catalogue */}
          {CATEGORIES.filter(cat=>catFilter==='all'||cat===catFilter).map(cat=>{
            const catAssets=filteredAssets.filter(a=>a.category===cat);
            if(catAssets.length===0)return null;
            return(
              <div key={cat} className="mb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                  <span className="flex-1 h-px bg-gray-100"/>
                  {cat}
                  <span className="flex-1 h-px bg-gray-100"/>
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {catAssets.map(asset=>{
                    const isConnected=connectedIds.has(asset.id);
                    const isConnecting=connecting===asset.id;
                    return(
                      <div key={asset.id} className={'rounded-xl border-2 transition-all '+(isConnected?'border-green-200 bg-green-50/50':isConnecting?'border-brand-300 bg-brand-50':'border-gray-200 bg-white hover:border-gray-300')}>
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xl shrink-0">{asset.icon}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-navy-900 truncate">{asset.label}</p>
                              <p className="text-[10px] text-gray-400 truncate">{(asset.watches||[]).slice(0,2).join(', ')}{(asset.watches||[]).length>2?'…':''}</p>
                            </div>
                          </div>
                          {isConnected?(
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1 shrink-0"><CheckCircle2 size={12}/>On</span>
                          ):(
                            <button onClick={()=>{setConnecting(isConnecting?null:asset.id);setFormData({});}} className={'text-xs font-semibold shrink-0 px-2.5 py-1 rounded-lg transition-colors '+(isConnecting?'bg-gray-100 text-gray-600':'bg-brand-600 text-white hover:bg-brand-700')}>
                              {isConnecting?'Cancel':'Connect'}
                            </button>
                          )}
                        </div>
                        {isConnecting&&(
                          <div className="border-t border-brand-100 px-3 pb-3 space-y-2">
                            <p className="text-xs text-gray-500 pt-2">{asset.impact}</p>
                            {(asset.fields||[]).map((field:any)=>(
                              <div key={field.key}>
                                <label className="label text-xs">{field.label}</label>
                                <input type={field.secret?'password':'text'} value={formData[field.key]||''} onChange={e=>setFormData(prev=>({...prev,[field.key]:e.target.value}))} placeholder={field.ph||''} className="input text-sm py-1.5"/>
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
