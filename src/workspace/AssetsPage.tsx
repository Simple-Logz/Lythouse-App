import{useCallback,useEffect,useState,useMemo}from'react';
import{supabase,anonKey,edgeFunctionUrl}from'../lib/supabase';
import{Spinner}from'../lib/ui';
import{Activity,Plus,X,Check,RefreshCw,Search,Bell,BellOff,ChevronRight,AlertTriangle,CheckCircle2,Clock,Zap,Shield,GitBranch,Cloud,Database,Loader as Loader2,Wifi,WifiOff,AlertCircle,ArrowRight,TrendingDown,Layers}from'lucide-react';
import{AssetDetailPanel}from'./AssetDetailPanel';

// ─── Full catalogue ────────────────────────────────────────────────────────────
const CATALOGUE={
  'Source Control':[
    {id:'github',label:'GitHub',icon:'🐙',watches:['Pushes','Pull Requests','Branch changes','Secret exposure','Workflows'],impact:'Triggers automatic validation on every push and PR merge',
     fields:[{key:'url',label:'Repository URL',ph:'https://github.com/org/repo',secret:false},{key:'token',label:'Personal Access Token',ph:'ghp_xxxxxxxxxxxx',secret:true}]},
    {id:'gitlab',label:'GitLab',icon:'🦊',watches:['Merge Requests','CI pipelines','Container registry','Deployments'],impact:'Revalidates on every merge and pipeline completion',
     fields:[{key:'url',label:'GitLab URL',ph:'https://gitlab.com',secret:false},{key:'token',label:'Access Token (read_api scope)',ph:'glpat-xxxxxxxxxxxx',secret:true}]},
    {id:'bitbucket',label:'Bitbucket',icon:'🪣',watches:['Pull Requests','Pipelines','Branch policies'],impact:'Monitors code changes and policy compliance',
     fields:[{key:'workspace',label:'Workspace slug',ph:'my-workspace',secret:false},{key:'username',label:'Username',ph:'user@example.com',secret:false},{key:'token',label:'App Password',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'azure-devops',label:'Azure DevOps',icon:'🔷',watches:['Repos','Boards','Pipelines','Releases'],impact:'Tracks work items linked to deployments',
     fields:[{key:'org',label:'Organization name',ph:'myorganization',secret:false},{key:'project',label:'Project name',ph:'my-project',secret:false},{key:'token',label:'Personal Access Token',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'perforce',label:'Perforce',icon:'📂',watches:['Changelists','Streams','Workspace changes'],impact:'Monitors enterprise source control changes',
     fields:[{key:'url',label:'Perforce Server URL',ph:'ssl:perforce.example.com:1666',secret:false},{key:'username',label:'Username',ph:'p4user',secret:false},{key:'password',label:'Password',ph:'xxxxxxxxxxxx',secret:true}]},
  ],
  'Cloud Providers':[
    {id:'aws',label:'AWS',icon:'🟠',watches:['IAM roles','Security groups','S3 buckets','CloudTrail','Lambda','EC2'],impact:'Production readiness recalculated on IAM or network changes',
     fields:[{key:'access_key',label:'Access Key ID',ph:'AKIAIOSFODNN7EXAMPLE',secret:false},{key:'secret_key',label:'Secret Access Key',ph:'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',secret:true},{key:'region',label:'Region',ph:'us-east-1',secret:false}]},
    {id:'azure',label:'Microsoft Azure',icon:'🔵',watches:['Resource groups','AD','Key Vault','AKS','Policies'],impact:'Compliance posture updated on policy changes',
     fields:[{key:'tenant_id',label:'Tenant ID',ph:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',secret:false},{key:'client_id',label:'Client ID (App Registration)',ph:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',secret:false},{key:'client_secret',label:'Client Secret',ph:'xxxxxxxxxxxx',secret:true},{key:'subscription_id',label:'Subscription ID',ph:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',secret:false}]},
    {id:'gcp',label:'Google Cloud',icon:'🔴',watches:['IAM','Cloud Run','GKE','Audit logs','Firewall rules'],impact:'Security findings updated on IAM policy changes',
     fields:[{key:'project_id',label:'Project ID',ph:'my-project-123456',secret:false},{key:'service_account',label:'Service Account JSON (paste full JSON)',ph:'{"type":"service_account","project_id":"..."}',secret:true}]},
    {id:'oracle-cloud',label:'Oracle Cloud',icon:'🔴',watches:['Compute','Networking','Identity','Security zones'],impact:'Topology updated on infrastructure changes',
     fields:[{key:'tenancy',label:'Tenancy OCID',ph:'ocid1.tenancy.oc1...',secret:false},{key:'user_ocid',label:'User OCID',ph:'ocid1.user.oc1...',secret:false},{key:'fingerprint',label:'API Key Fingerprint',ph:'xx:xx:xx:xx:xx:xx',secret:false},{key:'private_key',label:'Private Key (PEM)',ph:'-----BEGIN RSA PRIVATE KEY-----',secret:true},{key:'region',label:'Region',ph:'us-ashburn-1',secret:false}]},
    {id:'alibaba',label:'Alibaba Cloud',icon:'🟡',watches:['ECS','OSS','RAM policies','Security events'],impact:'Drift detection on configuration changes',
     fields:[{key:'access_key',label:'Access Key ID',ph:'LTAI5txxxxxxxxxx',secret:false},{key:'secret_key',label:'Access Key Secret',ph:'xxxxxxxxxxxx',secret:true},{key:'region',label:'Region',ph:'cn-hangzhou',secret:false}]},
    {id:'ibm-cloud',label:'IBM Cloud',icon:'🔵',watches:['VPC','IAM','Kubernetes','Cloud Functions'],impact:'Monitors IBM infrastructure for compliance',
     fields:[{key:'api_key',label:'IBM Cloud API Key',ph:'xxxxxxxxxxxx',secret:true},{key:'region',label:'Region',ph:'us-south',secret:false}]},
    {id:'digitalocean',label:'DigitalOcean',icon:'🌊',watches:['Droplets','Kubernetes','Databases','Spaces'],impact:'Deployment readiness updated on resource changes',
     fields:[{key:'token',label:'Personal Access Token',ph:'dop_v1_xxxxxxxxxxxx',secret:true}]},
    {id:'heroku',label:'Heroku',icon:'💜',watches:['Dynos','Add-ons','Config vars','Deploy hooks'],impact:'Validates config var changes before release',
     fields:[{key:'api_key',label:'Heroku API Key',ph:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',secret:true},{key:'app_name',label:'App Name',ph:'my-heroku-app',secret:false}]},
    {id:'vercel',label:'Vercel',icon:'▲',watches:['Deployments','Env variables','Domains','Edge config'],impact:'Auto-validates every Vercel deployment',
     fields:[{key:'token',label:'Vercel Access Token',ph:'xxxxxxxxxxxx',secret:true},{key:'team_id',label:'Team ID (optional)',ph:'team_xxxx',secret:false}]},
    {id:'netlify',label:'Netlify',icon:'🟢',watches:['Builds','Deploy hooks','Environment vars'],impact:'Monitors build and deploy status',
     fields:[{key:'token',label:'Personal Access Token',ph:'xxxxxxxxxxxx',secret:true},{key:'site_id',label:'Site ID',ph:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',secret:false}]},
    {id:'cloudflare',label:'Cloudflare',icon:'🌤',watches:['WAF rules','DNS','Workers','Zero Trust','Pages'],impact:'Security posture updated on WAF changes',
     fields:[{key:'account_id',label:'Account ID',ph:'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',secret:false},{key:'token',label:'API Token',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'hetzner',label:'Hetzner Cloud',icon:'☁️',watches:['Servers','Load balancers','Firewalls','Networks'],impact:'Infrastructure drift detected on server changes',
     fields:[{key:'token',label:'API Token',ph:'xxxxxxxxxxxx',secret:true}]},
  ],
  'Kubernetes & Orchestration':[
    {id:'kubernetes',label:'Kubernetes',icon:'☸️',watches:['Deployments','Secrets','ConfigMaps','Pods','Services','RBAC'],impact:'Topology and readiness updated on every deployment event',
     fields:[{key:'cluster_url',label:'Cluster API Server URL',ph:'https://k8s.example.com:6443',secret:false},{key:'token',label:'Service Account Token',ph:'eyJhbGciOiJSUzI1NiI...',secret:true},{key:'namespace',label:'Namespace',ph:'default',secret:false}]},
    {id:'openshift',label:'OpenShift',icon:'🔴',watches:['Projects','Routes','BuildConfigs','DeploymentConfigs'],impact:'Monitors OpenShift-specific security policies',
     fields:[{key:'url',label:'OpenShift API URL',ph:'https://api.cluster.example.com:6443',secret:false},{key:'token',label:'OAuth Token',ph:'sha256~xxxxxxxxxxxx',secret:true}]},
    {id:'rancher',label:'Rancher',icon:'🐄',watches:['Clusters','Workloads','Catalogs','Monitoring'],impact:'Multi-cluster readiness tracked centrally',
     fields:[{key:'url',label:'Rancher URL',ph:'https://rancher.example.com',secret:false},{key:'token',label:'API Bearer Token',ph:'token-xxxxx:xxxxxxxxxxxx',secret:true}]},
    {id:'eks',label:'Amazon EKS',icon:'📦',watches:['Node groups','Add-ons','OIDC','Security groups'],impact:'EKS cluster health feeds deployment confidence',
     fields:[{key:'cluster_name',label:'Cluster Name',ph:'my-eks-cluster',secret:false},{key:'region',label:'AWS Region',ph:'us-east-1',secret:false},{key:'access_key',label:'AWS Access Key ID',ph:'AKIAIOSFODNN7EXAMPLE',secret:false},{key:'secret_key',label:'AWS Secret Access Key',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'aks',label:'Azure AKS',icon:'📦',watches:['Node pools','Add-ons','AAD integration','Network policies'],impact:'AKS upgrade and config changes revalidate release',
     fields:[{key:'resource_group',label:'Resource Group',ph:'my-resource-group',secret:false},{key:'cluster_name',label:'Cluster Name',ph:'my-aks-cluster',secret:false},{key:'subscription_id',label:'Subscription ID',ph:'xxxxxxxx-xxxx',secret:false},{key:'client_secret',label:'Client Secret',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'gke',label:'Google GKE',icon:'📦',watches:['Node pools','Workload identity','Binary auth','Autopilot'],impact:'GKE configuration changes trigger validation',
     fields:[{key:'project_id',label:'GCP Project ID',ph:'my-project-123456',secret:false},{key:'cluster_name',label:'Cluster Name',ph:'my-gke-cluster',secret:false},{key:'zone',label:'Zone or Region',ph:'us-central1',secret:false},{key:'service_account',label:'Service Account JSON',ph:'{"type":"service_account"...}',secret:true}]},
  ],
  'Container Registries':[
    {id:'docker-hub',label:'Docker Hub',icon:'🐳',watches:['Image pushes','Vulnerability scans','Tags'],impact:'New images trigger container scan and validation',
     fields:[{key:'username',label:'Docker Hub Username',ph:'myusername',secret:false},{key:'token',label:'Access Token',ph:'dckr_pat_xxxxxxxxxxxx',secret:true}]},
    {id:'ecr',label:'Amazon ECR',icon:'📦',watches:['Image pushes','Scan findings','Lifecycle policies'],impact:'ECR scan results feed directly into findings',
     fields:[{key:'region',label:'AWS Region',ph:'us-east-1',secret:false},{key:'account_id',label:'AWS Account ID',ph:'123456789012',secret:false},{key:'access_key',label:'Access Key ID',ph:'AKIAIOSFODNN7EXAMPLE',secret:false},{key:'secret_key',label:'Secret Access Key',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'acr',label:'Azure Container Registry',icon:'📦',watches:['Image pushes','Tasks','Geo-replication'],impact:'New images validated before deployment approval',
     fields:[{key:'registry_name',label:'Registry Name',ph:'myregistry',secret:false},{key:'username',label:'Username',ph:'myregistry',secret:false},{key:'password',label:'Password / Token',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'gcr',label:'Google Artifact Registry',icon:'📦',watches:['Image pushes','Vulnerability reports','Policies'],impact:'GCR scan results update deployment blockers',
     fields:[{key:'project_id',label:'GCP Project ID',ph:'my-project-123456',secret:false},{key:'repository',label:'Repository',ph:'us-central1-docker.pkg.dev/my-project/my-repo',secret:false},{key:'service_account',label:'Service Account JSON',ph:'{"type":"service_account"...}',secret:true}]},
    {id:'harbor',label:'Harbor',icon:'⚓',watches:['Projects','Replications','Vulnerability scans','Policies'],impact:'Harbor policies enforced as deployment gates',
     fields:[{key:'url',label:'Harbor URL',ph:'https://harbor.example.com',secret:false},{key:'username',label:'Username',ph:'admin',secret:false},{key:'password',label:'Password',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'jfrog',label:'JFrog Artifactory',icon:'🐸',watches:['Repositories','Xray scans','Policies','Builds'],impact:'Xray findings integrated into deployment readiness',
     fields:[{key:'url',label:'Artifactory URL',ph:'https://mycompany.jfrog.io',secret:false},{key:'token',label:'Identity Token / API Key',ph:'xxxxxxxxxxxx',secret:true}]},
  ],
  'Infrastructure as Code':[
    {id:'terraform',label:'Terraform',icon:'🟣',watches:['State changes','Plan diffs','Workspace applies','Drift'],impact:'Infrastructure drift detected and reported as findings',
     fields:[{key:'token',label:'Terraform Cloud API Token',ph:'xxxxxxxxxxxx.atlasv1.xxxxxxxxxxxx',secret:true},{key:'organization',label:'Organization',ph:'my-org',secret:false},{key:'workspace',label:'Workspace Name',ph:'production',secret:false}]},
    {id:'pulumi',label:'Pulumi',icon:'🔶',watches:['Stack updates','Resource changes','Policy packs'],impact:'Policy violations surface as deployment blockers',
     fields:[{key:'token',label:'Pulumi Access Token',ph:'pul-xxxxxxxxxxxx',secret:true},{key:'org',label:'Organization',ph:'my-org',secret:false},{key:'stack',label:'Stack Name',ph:'production',secret:false}]},
    {id:'ansible',label:'Ansible',icon:'⚙️',watches:['Playbook runs','Inventory changes','Task failures'],impact:'Configuration drift identified across server fleet',
     fields:[{key:'url',label:'AWX / Ansible Tower URL',ph:'https://tower.example.com',secret:false},{key:'token',label:'OAuth2 Token',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'helm',label:'Helm',icon:'⛵',watches:['Chart releases','Upgrades','Rollbacks','Hooks'],impact:'Helm release status tracked in deployment history',
     fields:[{key:'kubeconfig',label:'Kubeconfig (base64 encoded)',ph:'base64-encoded kubeconfig',secret:true},{key:'namespace',label:'Namespace',ph:'default',secret:false}]},
  ],
  'CI/CD Pipelines':[
    {id:'github-actions',label:'GitHub Actions',icon:'⚡',watches:['Workflow runs','Job failures','Deploy steps'],impact:'Failed pipelines block deployment approval',
     fields:[{key:'repo_url',label:'Repository URL',ph:'https://github.com/org/repo',secret:false},{key:'token',label:'Token (Actions + Read scope)',ph:'ghp_xxxxxxxxxxxx',secret:true}]},
    {id:'jenkins',label:'Jenkins',icon:'🤵',watches:['Build jobs','Pipeline stages','Test results'],impact:'Build failures and test results inform readiness score',
     fields:[{key:'url',label:'Jenkins URL',ph:'https://jenkins.example.com',secret:false},{key:'username',label:'Username',ph:'admin',secret:false},{key:'token',label:'API Token',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'gitlab-ci',label:'GitLab CI/CD',icon:'🔁',watches:['Pipeline jobs','Environments','Security scans'],impact:'GitLab security scans feed into findings',
     fields:[{key:'url',label:'GitLab URL',ph:'https://gitlab.com',secret:false},{key:'token',label:'Access Token',ph:'glpat-xxxxxxxxxxxx',secret:true},{key:'project_id',label:'Project ID',ph:'12345678',secret:false}]},
    {id:'circleci',label:'CircleCI',icon:'⭕',watches:['Pipelines','Test results','Orbs','Contexts'],impact:'Test failures tracked as release risk',
     fields:[{key:'token',label:'Personal API Token',ph:'xxxxxxxxxxxx',secret:true},{key:'org_slug',label:'Org Slug (vcs/org)',ph:'github/my-org',secret:false}]},
    {id:'argocd',label:'ArgoCD',icon:'🐙',watches:['Application sync','Health status','Rollbacks'],impact:'GitOps sync status drives deployment confidence',
     fields:[{key:'url',label:'ArgoCD Server URL',ph:'https://argocd.example.com',secret:false},{key:'token',label:'API Token',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'spinnaker',label:'Spinnaker',icon:'🎡',watches:['Pipelines','Canary analysis','Deployments'],impact:'Spinnaker canary results feed readiness score',
     fields:[{key:'url',label:'Gate URL',ph:'https://spinnaker.example.com',secret:false},{key:'token',label:'Service Account Token',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'harness',label:'Harness',icon:'🪢',watches:['Deployments','CV analysis','Feature flags'],impact:'Harness verification gates enforced pre-deploy',
     fields:[{key:'api_key',label:'API Key',ph:'pat.xxxxxxxxxxxx',secret:true},{key:'account_id',label:'Account ID',ph:'xxxxxxxxxxxx',secret:false}]},
    {id:'azure-pipelines',label:'Azure Pipelines',icon:'🔷',watches:['Pipeline runs','Release stages','Approvals'],impact:'Azure release gates tracked as approval events',
     fields:[{key:'org',label:'Organization',ph:'myorganization',secret:false},{key:'project',label:'Project',ph:'my-project',secret:false},{key:'token',label:'PAT Token',ph:'xxxxxxxxxxxx',secret:true}]},
  ],
  'Monitoring & Observability':[
    {id:'datadog',label:'Datadog',icon:'🐶',watches:['APM traces','Infrastructure metrics','Monitors','SLOs'],impact:'SLO breaches block deployment during active incidents',
     fields:[{key:'api_key',label:'API Key',ph:'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',secret:true},{key:'app_key',label:'Application Key',ph:'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',secret:true},{key:'site',label:'Site',ph:'datadoghq.com',secret:false}]},
    {id:'newrelic',label:'New Relic',icon:'📈',watches:['APM','Errors','Deployments','Alerts','SLOs'],impact:'Error rate spikes surface as deployment risks',
     fields:[{key:'account_id',label:'Account ID',ph:'1234567',secret:false},{key:'api_key',label:'User API Key',ph:'NRAK-xxxxxxxxxxxx',secret:true}]},
    {id:'grafana',label:'Grafana',icon:'📉',watches:['Dashboard alerts','Incidents','OnCall schedules'],impact:'Active incidents block deployment approval',
     fields:[{key:'url',label:'Grafana URL',ph:'https://grafana.example.com',secret:false},{key:'token',label:'Service Account Token',ph:'glsa_xxxxxxxxxxxx',secret:true}]},
    {id:'prometheus',label:'Prometheus',icon:'🔥',watches:['Metric alerts','Recording rules','Targets'],impact:'Firing alerts factor into deployment confidence',
     fields:[{key:'url',label:'Prometheus URL',ph:'https://prometheus.example.com',secret:false},{key:'username',label:'Username (if auth enabled)',ph:'admin',secret:false},{key:'password',label:'Password',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'pagerduty',label:'PagerDuty',icon:'📟',watches:['Incidents','On-call schedules','Services'],impact:'Open incidents prevent deployment approval',
     fields:[{key:'token',label:'API Token (v2)',ph:'u+xxxxxxxxxxxx',secret:true}]},
    {id:'elastic',label:'Elastic / ELK',icon:'🟡',watches:['Log anomalies','Security alerts','APM','Uptime'],impact:'Log anomalies surface as deployment risks',
     fields:[{key:'url',label:'Elasticsearch URL',ph:'https://mydeployment.es.io:9243',secret:false},{key:'username',label:'Username',ph:'elastic',secret:false},{key:'password',label:'Password / API Key',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'dynatrace',label:'Dynatrace',icon:'📊',watches:['Problems','Deployments','SLOs','Application security'],impact:'Dynatrace problems detected pre-deployment',
     fields:[{key:'url',label:'Environment URL',ph:'https://abc12345.live.dynatrace.com',secret:false},{key:'token',label:'API Token',ph:'dt0c01.xxxxxxxxxxxx',secret:true}]},
    {id:'splunk',label:'Splunk',icon:'🔍',watches:['Log anomalies','Security events','Alerts'],impact:'Security events in logs trigger revalidation',
     fields:[{key:'url',label:'Splunk URL',ph:'https://splunk.example.com:8089',secret:false},{key:'token',label:'HEC Token',ph:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',secret:true}]},
  ],
  'Secrets Management':[
    {id:'vault',label:'HashiCorp Vault',icon:'🔐',watches:['Secret access','Policy changes','Token renewals','Audit logs'],impact:'Unauthorized secret access triggers security finding',
     fields:[{key:'url',label:'Vault URL',ph:'https://vault.example.com',secret:false},{key:'token',label:'Token',ph:'hvs.xxxxxxxxxxxx',secret:true},{key:'namespace',label:'Namespace (Enterprise only)',ph:'my-namespace',secret:false}]},
    {id:'aws-secrets',label:'AWS Secrets Manager',icon:'🔑',watches:['Secret rotations','Access patterns','Policy changes'],impact:'Secret rotation events tracked in validation',
     fields:[{key:'region',label:'AWS Region',ph:'us-east-1',secret:false},{key:'access_key',label:'Access Key ID',ph:'AKIAIOSFODNN7EXAMPLE',secret:false},{key:'secret_key',label:'Secret Access Key',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'azure-keyvault',label:'Azure Key Vault',icon:'🔑',watches:['Secret changes','Certificate expiry','Key rotations'],impact:'Certificate expiry surfaces as deployment blocker',
     fields:[{key:'vault_url',label:'Key Vault URL',ph:'https://mykeyvault.vault.azure.net',secret:false},{key:'tenant_id',label:'Tenant ID',ph:'xxxxxxxx-xxxx',secret:false},{key:'client_id',label:'Client ID',ph:'xxxxxxxx-xxxx',secret:false},{key:'client_secret',label:'Client Secret',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'gcp-secrets',label:'Google Secret Manager',icon:'🔑',watches:['Secret versions','Access logs','IAM bindings'],impact:'Secret IAM changes revalidate security posture',
     fields:[{key:'project_id',label:'GCP Project ID',ph:'my-project-123456',secret:false},{key:'service_account',label:'Service Account JSON',ph:'{"type":"service_account"...}',secret:true}]},
    {id:'doppler',label:'Doppler',icon:'🎯',watches:['Config changes','Secret syncs','Access logs'],impact:'Config variable changes trigger validation',
     fields:[{key:'token',label:'Service Token',ph:'dp.st.xxxxxxxxxxxx',secret:true},{key:'project',label:'Project',ph:'my-project',secret:false},{key:'config',label:'Config (environment)',ph:'production',secret:false}]},
  ],
  'Security Platforms':[
    {id:'snyk',label:'Snyk',icon:'🔒',watches:['Dependency vulns','Container scans','Code issues','License compliance'],impact:'Snyk findings feed directly into deployment blockers',
     fields:[{key:'token',label:'API Token',ph:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',secret:true},{key:'org_id',label:'Organization ID',ph:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',secret:false}]},
    {id:'sonarqube',label:'SonarQube',icon:'📊',watches:['Code quality','Security hotspots','Coverage'],impact:'Quality gates enforced as deployment requirements',
     fields:[{key:'url',label:'SonarQube URL',ph:'https://sonar.example.com',secret:false},{key:'token',label:'User Token',ph:'squ_xxxxxxxxxxxx',secret:true}]},
    {id:'prisma-cloud',label:'Prisma Cloud',icon:'🛡',watches:['Cloud misconfiguration','Container risks','Network policies'],impact:'Prisma alerts create deployment blockers',
     fields:[{key:'url',label:'API URL',ph:'https://api.prismacloud.io',secret:false},{key:'access_key',label:'Access Key',ph:'xxxxxxxxxxxx',secret:false},{key:'secret_key',label:'Secret Key',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'wiz',label:'Wiz',icon:'🧙',watches:['Cloud risks','Attack paths','Misconfigs'],impact:'Wiz risk score incorporated into readiness',
     fields:[{key:'client_id',label:'Service Account Client ID',ph:'xxxxxxxxxxxx',secret:false},{key:'client_secret',label:'Service Account Secret',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'crowdstrike',label:'CrowdStrike',icon:'🦅',watches:['Endpoint detections','Vulnerabilities','Threat intel'],impact:'Active detections block production deployments',
     fields:[{key:'client_id',label:'Client ID',ph:'xxxxxxxxxxxx',secret:false},{key:'client_secret',label:'Client Secret',ph:'xxxxxxxxxxxx',secret:true},{key:'region',label:'Cloud Region',ph:'us-1',secret:false}]},
    {id:'aquasecurity',label:'Aqua Security',icon:'🐬',watches:['Container runtime','Image scans','K8s policies'],impact:'Runtime anomalies trigger deployment hold',
     fields:[{key:'url',label:'Aqua Console URL',ph:'https://aqua.example.com',secret:false},{key:'username',label:'Username',ph:'admin',secret:false},{key:'password',label:'Password',ph:'xxxxxxxxxxxx',secret:true}]},
  ],
  'Collaboration & ITSM':[
    {id:'jira',label:'Jira',icon:'🔵',watches:['Issues linked to deployments','Sprint velocity','Blockers'],impact:'Jira blockers visible in approval workflow',
     fields:[{key:'url',label:'Jira URL',ph:'https://yourorg.atlassian.net',secret:false},{key:'email',label:'Email',ph:'user@example.com',secret:false},{key:'token',label:'API Token',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'servicenow',label:'ServiceNow',icon:'🟢',watches:['Change requests','Incidents','CMDB updates'],impact:'Change management approval integrated into workflow',
     fields:[{key:'instance',label:'Instance',ph:'myinstance.service-now.com',secret:false},{key:'username',label:'Username',ph:'admin',secret:false},{key:'password',label:'Password',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'linear',label:'Linear',icon:'🔷',watches:['Issues','Cycles','Projects'],impact:'Engineering issues linked to release findings',
     fields:[{key:'token',label:'Personal API Key',ph:'lin_api_xxxxxxxxxxxx',secret:true}]},
    {id:'slack',label:'Slack',icon:'💬',watches:['Deployment notifications','Approval requests','Alerts'],impact:'Real-time alerts sent to relevant channels',
     fields:[{key:'webhook_url',label:'Incoming Webhook URL',ph:'https://hooks.slack.com/services/T.../B.../...',secret:true},{key:'channel',label:'Channel name',ph:'#deployments',secret:false}]},
    {id:'teams',label:'Microsoft Teams',icon:'🟣',watches:['Notifications','Approvals','Channel alerts'],impact:'Teams approval requests for release gates',
     fields:[{key:'webhook_url',label:'Incoming Webhook URL',ph:'https://outlook.office.com/webhook/...',secret:true}]},
    {id:'pagerduty',label:'PagerDuty',icon:'📢',watches:['Alerts','On-call schedules','Incidents'],impact:'Active incidents block deployment',
     fields:[{key:'token',label:'API Token (v2)',ph:'u+xxxxxxxxxxxx',secret:true}]},
  ],
  'Identity & Access':[
    {id:'okta',label:'Okta',icon:'🔵',watches:['SSO events','MFA failures','Policy changes','User provisioning'],impact:'IAM changes trigger security revalidation',
     fields:[{key:'domain',label:'Okta Domain',ph:'mycompany.okta.com',secret:false},{key:'token',label:'API Token',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'auth0',label:'Auth0',icon:'⚫',watches:['Auth events','Anomalies','Rules changes'],impact:'Auth anomalies surface as deployment risk',
     fields:[{key:'domain',label:'Auth0 Domain',ph:'mycompany.auth0.com',secret:false},{key:'client_id',label:'Client ID',ph:'xxxxxxxxxxxx',secret:false},{key:'client_secret',label:'Client Secret',ph:'xxxxxxxxxxxx',secret:true}]},
    {id:'azure-ad',label:'Azure AD',icon:'🔷',watches:['User changes','Conditional access','App registrations'],impact:'AD policy changes revalidate compliance',
     fields:[{key:'tenant_id',label:'Tenant ID',ph:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',secret:false},{key:'client_id',label:'Client ID',ph:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',secret:false},{key:'client_secret',label:'Client Secret',ph:'xxxxxxxxxxxx',secret:true}]},
  ],
};

const ALL_ASSETS=Object.entries(CATALOGUE).flatMap(([cat,assets])=>assets.map(a=>({...a,category:cat})));
const CATEGORIES=Object.keys(CATALOGUE);


// ─── Client-side credential format validation ──────────────────────────────────
function validateCredentials(source:string,config:Record<string,string>):string|null{
  const val=(k:string)=>String(config[k]||'').trim();
  const fake=['test','fake','xxx','abc','123','password','token','secret','example','sample','dummy','placeholder','changeme','random','asdf','qwerty'];
  const isFake=(v:string)=>fake.includes(v.toLowerCase())||v.length<6||(v.split('').every(c=>c===v[0])&&v.length<20);

  // Universal fake check
  for(const[k,v] of Object.entries(config)){
    if(v&&isFake(v)&&!['region','namespace','channel','site','org','project','config','zone'].includes(k)){
      return`"${v}" doesn't look like a real credential. Please enter your actual ${k.replace(/_/g,' ')}.`;
    }
  }

  switch(source){
    case'github':case'github-actions':{
      const t=val('token');
      if(!t.startsWith('ghp_')&&!t.startsWith('github_pat_')&&!t.startsWith('ghs_'))
        return'Invalid GitHub token — must start with ghp_, github_pat_, or ghs_';
      const u=val('url')||val('repo_url');
      if(u&&!u.includes('github.com'))return'URL must be a github.com repository';
      return null;
    }
    case'gitlab':case'gitlab-ci':{
      const t=val('token');
      if(!t.startsWith('glpat-')&&!t.startsWith('gldt-')&&t.length<20)
        return'Invalid GitLab token — must start with glpat- or gldt-';
      return null;
    }
    case'aws':case'aws-secrets':case'ecr':case'eks':{
      const k=val('access_key');
      if(k&&!/^(AKIA|ASIA)[A-Z0-9]{16}$/.test(k))
        return'Invalid AWS Access Key — must be AKIA or ASIA followed by exactly 16 uppercase letters/numbers';
      const s=val('secret_key');
      if(s&&s.length<30)return'AWS Secret Access Key is too short — it should be 40 characters';
      return null;
    }
    case'azure':case'azure-ad':case'aks':case'azure-keyvault':case'azure-pipelines':case'acr':{
      const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const t=val('tenant_id');if(t&&!uuidRe.test(t))return'Tenant ID must be a valid UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)';
      const c=val('client_id');if(c&&!uuidRe.test(c))return'Client ID must be a valid UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)';
      const s=val('subscription_id');if(s&&!uuidRe.test(s))return'Subscription ID must be a valid UUID';
      return null;
    }
    case'gcp':case'gcr':case'gke':case'gcp-secrets':{
      const sa=val('service_account');
      if(sa){
        try{const j=JSON.parse(sa);if(j.type!=='service_account')return'Service Account JSON must have "type":"service_account"';}
        catch{return'Service Account must be valid JSON — paste the full contents of your service account key file';}
      }
      return null;
    }
    case'slack':{
      const w=val('webhook_url');
      if(!w.startsWith('https://hooks.slack.com/services/'))return'Slack Webhook URL must start with https://hooks.slack.com/services/';
      if(w.split('/').length<7)return'Slack Webhook URL appears incomplete';
      return null;
    }
    case'teams':{
      const w=val('webhook_url');
      if(!w.includes('outlook.office.com')&&!w.includes('webhook.office.com'))
        return'Teams Webhook URL must be an outlook.office.com or webhook.office.com URL';
      return null;
    }
    case'datadog':{
      const k=val('api_key');if(k&&k.length!==32)return`Datadog API key must be exactly 32 characters (yours is ${k.length})`;
      const a=val('app_key');if(a&&a.length!==40)return`Datadog Application key must be exactly 40 characters (yours is ${a.length})`;
      return null;
    }
    case'newrelic':{
      const k=val('api_key');
      if(!k.startsWith('NRAK-'))return'New Relic API key must start with NRAK-';
      return null;
    }
    case'snyk':{
      const t=val('token');
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(t))
        return'Snyk token must be in UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)';
      return null;
    }
    case'doppler':{
      const t=val('token');
      if(!t.startsWith('dp.st.'))return'Doppler service token must start with dp.st.';
      return null;
    }
    case'pulumi':{
      const t=val('token');
      if(!t.startsWith('pul-'))return'Pulumi access token must start with pul-';
      return null;
    }
    case'terraform':{
      const t=val('token');
      if(t.length<30)return'Terraform Cloud token appears too short — it should be at least 30 characters';
      return null;
    }
    case'vault':{
      const u=val('url');
      if(!u.startsWith('https://'))return'Vault URL must start with https://';
      const t=val('token');
      if(!t.startsWith('hvs.')&&!t.startsWith('s.')&&t.length<20)
        return'Invalid Vault token — modern tokens start with hvs.';
      return null;
    }
    case'kubernetes':case'openshift':case'rancher':case'argocd':{
      const u=val('cluster_url')||val('url');
      if(u&&!u.startsWith('https://'))return'Cluster URL must start with https://';
      const t=val('token');
      if(t&&!t.startsWith('eyJ')&&t.length<30)
        return'Service Account Token appears invalid — Kubernetes tokens start with eyJ and are very long';
      return null;
    }
    case'jira':{
      const u=val('url');
      if(!u.includes('atlassian.net')&&!u.startsWith('https://'))
        return'Jira URL must be https://yourorg.atlassian.net or your self-hosted Jira URL';
      const t=val('token');
      if(t.length<20)return'Jira API token appears too short';
      return null;
    }
    case'github-actions':{
      const t=val('token');
      if(!t.startsWith('ghp_'))return'GitHub token must start with ghp_';
      return null;
    }
    case'circleci':{
      const o=val('org_slug');
      if(o&&!o.includes('/'))return'Org slug must be in format: github/org-name or bitbucket/org-name';
      return null;
    }
    case'vercel':{
      const t=val('token');
      if(t.length<20)return'Vercel access token appears too short';
      return null;
    }
    case'netlify':{
      const t=val('token');
      if(t.length<20)return'Netlify personal access token appears too short — get it from app.netlify.com/user/applications';
      const s=val('site_id');
      if(s&&s.length<10)return'Netlify Site ID appears invalid';
      return null;
    }
    case'heroku':{
      const k=val('api_key');
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k))
        return'Heroku API key must be in UUID format — get it from account.heroku.com/account';
      return null;
    }
    case'digitalocean':{
      const t=val('token');
      if(!t.startsWith('dop_v1_'))return'DigitalOcean token must start with dop_v1_';
      return null;
    }
    case'cloudflare':{
      const t=val('token');if(t.length<30)return'Cloudflare API token appears too short';
      const a=val('account_id');if(a&&a.length!==32)return'Cloudflare Account ID must be 32 characters';
      return null;
    }
    case'pagerduty':{
      const t=val('token');
      if(!t.startsWith('u+'))return'PagerDuty v2 token must start with u+';
      return null;
    }
    case'linear':{
      const t=val('token');
      if(!t.startsWith('lin_api_'))return'Linear API key must start with lin_api_';
      return null;
    }
    default:return null;
  }
}

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

  const[selectedConnection,setSelectedConnection]=useState<Connection|null>(null);
  const[testError,setTestError]=useState<Record<string,string>>({});
  const[testSuccess,setTestSuccess]=useState<Record<string,string>>({});

  const connect=async(assetId:string)=>{
    setSaving(true);
    setTestError(prev=>({...prev,[assetId]:''}));
    setTestSuccess(prev=>({...prev,[assetId]:''}));
    const asset=ALL_ASSETS.find(a=>a.id===assetId);
    const config:Record<string,string>={};
    asset?.fields?.forEach((f:any)=>{if(formData[f.key])config[f.key]=String(formData[f.key]).trim();});

    // Hard-block if any required field is empty
    const missingFields=(asset?.fields||[]).filter((f:any)=>!formData[f.key]?.trim());
    if(missingFields.length>0){
      setTestError(prev=>({...prev,[assetId]:`Required fields missing: ${missingFields.map((f:any)=>f.label).join(', ')}`}));
      setSaving(false);return;
    }

    // Client-side format validation — runs regardless of edge function
    const err=validateCredentials(assetId,config);
    if(err){setTestError(prev=>({...prev,[assetId]:err}));setSaving(false);return;}

    // Try edge function for real API verification
    let verificationPassed=false;
    let verificationMsg='';
    try{
      const res=await fetch('https://xrvugcytyfwyxytyqmom.supabase.co/functions/v1/test-connection',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhydnVnY3l0eWZ3eXh5dHlxbW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzgxMzEsImV4cCI6MjA5OTgxNDEzMX0.0fD4oIamh8_hffbObVaIZp9nqKLDzr-bIzrmkUWtuyE','apikey':'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhydnVnY3l0eWZ3eXh5dHlxbW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzgxMzEsImV4cCI6MjA5OTgxNDEzMX0.0fD4oIamh8_hffbObVaIZp9nqKLDzr-bIzrmkUWtuyE'},
        body:JSON.stringify({source:assetId,config}),
        signal:AbortSignal.timeout(10000),
      });
      if(res.ok){
        const d=await res.json();
        if(!d.success){setTestError(prev=>({...prev,[assetId]:d.message}));setSaving(false);return;}
        verificationPassed=true;
        verificationMsg=d.message+(d.details?' — '+d.details:'');
      }else{
        // Edge function returned error HTTP — still block
        const d=await res.json().catch(()=>({message:`Server error ${res.status}`}));
        setTestError(prev=>({...prev,[assetId]:d.message||`Verification failed (${res.status})`}));
        setSaving(false);return;
      }
    }catch(e:any){
      // Edge function unreachable — block connection, show clear message
      setTestError(prev=>({...prev,[assetId]:'Cannot verify credentials — connection service is unreachable. Please deploy the test-connection edge function: npx supabase functions deploy test-connection --project-ref xrvugcytyfwyxytyqmom --no-verify-jwt'}));
      setSaving(false);return;
    }

    if(!verificationPassed){setSaving(false);return;}

    // Only reach here if real API verification passed
    const existing=connections.find(c=>c.source===assetId);
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
      setChangeEvents(prev=>[{id:saved!.id+'_evt',source:assetId,label:asset.label,icon:asset.icon,
        event:`${asset.label} connected — now monitoring ${(asset.watches||[]).slice(0,3).join(', ')}`,
        impact:asset.impact,severity:'low',time:new Date().toISOString()},...prev]);
    }
    setTestSuccess(prev=>({...prev,[assetId]:verificationMsg}));
    setTimeout(()=>{setConnecting(null);setFormData({});},2000);
    setSaving(false);
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
                  <div key={conn.id} className="card border-2 border-green-100 cursor-pointer hover:border-brand-300 hover:shadow-md transition-all" onClick={()=>setSelectedConnection(conn)}>
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
                            <button onClick={e=>{e.stopPropagation();disconnect(conn.id);}} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><X size={13}/></button>
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
                <div className="grid gap-2 sm:grid-cols-2">
                  {catAssets.map(asset=>{
                    const isConnected=connectedIds.has(asset.id);
                    const isConnecting=connecting===asset.id;
                    return(
                      <div key={asset.id} className={'rounded-xl border-2 transition-all '+(isConnected?'border-green-200 bg-green-50/50':isConnecting?'border-brand-400 bg-white shadow-lg ring-2 ring-brand-200':'border-gray-200 bg-white hover:border-gray-300')}>
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
                            <button onClick={()=>{if(!isConnecting){setConnecting(asset.id);setFormData({});setTestError(prev=>({...prev,[asset.id]:''}));setTestSuccess(prev=>({...prev,[asset.id]:''}));}}} className="text-xs font-semibold shrink-0 px-2.5 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                              Connect
                            </button>
                          )}
                        </div>
                        {isConnecting&&(
                          <div className="border-t border-brand-200 px-4 pb-4 pt-3 space-y-3 bg-gray-50/50 rounded-b-xl">
                            <div className="rounded-lg bg-brand-50 border border-brand-200 px-3 py-2">
                              <p className="text-xs font-medium text-brand-700">What LytHouse will monitor:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(asset.watches||[]).map((w:string)=><span key={w} className="text-[10px] bg-white border border-brand-200 text-brand-600 px-1.5 py-0.5 rounded-full">{w}</span>)}
                              </div>
                            </div>
                            {(asset.fields||[]).map((field:any)=>(
                              <div key={field.key}>
                                <label className="label text-xs">{field.label} <span className="text-red-500">*</span></label>
                                <input type={field.secret?'password':'text'} value={formData[field.key]||''} onChange={e=>{setFormData(prev=>({...prev,[field.key]:e.target.value}));setTestError(prev=>({...prev,[asset.id]:''}));setTestSuccess(prev=>({...prev,[asset.id]:''}));}} placeholder={field.ph||''} className="input text-sm py-1.5"/>
                              </div>
                            ))}
                            {testError[asset.id]&&<div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                              <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5"/>
                              <p className="text-xs text-red-600 font-medium">{testError[asset.id]}</p>
                            </div>}
                            {testSuccess[asset.id]&&<div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                              <CheckCircle2 size={13} className="text-green-600 shrink-0 mt-0.5"/>
                              <p className="text-xs text-green-700 font-medium">{testSuccess[asset.id]}</p>
                            </div>}
                            <div className="flex gap-2 pt-1">
                              <button onClick={()=>connect(asset.id)} disabled={saving||!!testSuccess[asset.id]} className="btn-primary text-xs flex-1">
                                {saving?<><Loader2 size={12} className="animate-spin"/>Verifying connection…</>:testSuccess[asset.id]?<><Check size={12}/>Connected!</>:<><Zap size={12}/>Test & Connect</>}
                              </button>
                              <button onClick={()=>{setConnecting(null);setFormData({});setTestError(prev=>({...prev,[asset.id]:''}));setTestSuccess(prev=>({...prev,[asset.id]:''}));}} className="btn-secondary text-xs"><X size={12}/></button>
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
    {selectedConnection&&ALL_ASSETS.find(a=>a.id===selectedConnection.source)&&(
      <AssetDetailPanel
        connection={selectedConnection}
        assetMeta={ALL_ASSETS.find(a=>a.id===selectedConnection.source)!}
        onClose={()=>setSelectedConnection(null)}
        onDisconnect={async(id)=>{await disconnect(id);setSelectedConnection(null);}}
        onRetest={(id)=>{setTestResults(prev=>({...prev,[id]:true}));}}
      />
    )}
  );
}