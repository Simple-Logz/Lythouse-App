import{RouterProvider,useRouter}from'./lib/router';
import{AppShell,usePlanId}from'./pages/AppShell';
import{ProjectsPage}from'./pages/ProjectsPage';
import{ProjectWorkspace}from'./workspace/ProjectWorkspace';
import{DashboardPage}from'./pages/DashboardPage';
import{DeploymentsPage}from'./pages/DeploymentsPage';
import{SimulatorPage}from'./pages/SimulatorPage';
import{AnalyticsPage}from'./pages/AnalyticsPage';
import{PolicyPage}from'./pages/PolicyPage';
import{AuditLogPage}from'./pages/AuditLogPage';
import{TeamPage}from'./pages/TeamPage';
import{SettingsPage}from'./pages/SettingsPage';
import{PlansPage}from'./pages/PlansPage';
import{WorkspacesPage}from'./pages/WorkspacesPage';
import CompliancePage from'./pages/CompliancePage';
import IncidentPage from'./pages/IncidentPage';
import IntegrationsPage from'./pages/IntegrationsPage';
import{ServerValidationPage}from'./pages/server-validation/ServerValidationPage';
import{EnvWizard}from'./pages/server-validation/EnvWizard';
import{EnvDetailPage}from'./pages/server-validation/EnvDetailPage';
import{ValidationRunPage}from'./pages/server-validation/ValidationRunPage';
import{PassportPage}from'./pages/server-validation/PassportPage';
import{LoadTestingPage}from'./pages/LoadTestingPage';
import{ApiTestingPage}from'./pages/ApiTestingPage';
import{ChaosEngineeringPage}from'./pages/ChaosEngineeringPage';
import type{ReactNode}from'react';

function Routes(){
const{path}=useRouter();
const planId=usePlanId();
const seg=path.split('/').filter(Boolean);
let c:ReactNode;
if(!seg.length||seg[0]==='dashboard')c=<DashboardPage/>;
else if(seg[0]==='projects')c=seg[1]?<ProjectWorkspace projectId={seg[1]}/>:<ProjectsPage/>;
else if(seg[0]==='deployments')c=<DeploymentsPage/>;
else if(seg[0]==='simulator')c=<SimulatorPage/>;
else if(seg[0]==='analytics')c=<AnalyticsPage/>;
else if(seg[0]==='policies')c=<PolicyPage/>;
else if(seg[0]==='audit')c=<AuditLogPage/>;
else if(seg[0]==='team')c=<TeamPage/>;
else if(seg[0]==='plans')c=<PlansPage/>;
else if(seg[0]==='compliance')c=<CompliancePage/>;
else if(seg[0]==='incidents')c=<IncidentPage/>;
else if(seg[0]==='integrations')c=<IntegrationsPage/>;
else if(seg[0]==='settings')c=<SettingsPage/>;
else if(seg[0]==='workspaces')c=<WorkspacesPage/>;
else if(seg[0]==='load-testing')c=<LoadTestingPage/>;
else if(seg[0]==='api-testing')c=<ApiTestingPage/>;
else if(seg[0]==='chaos')c=<ChaosEngineeringPage/>;
else if(seg[0]==='server-validation'){
  if(!seg[1])c=<ServerValidationPage planId={planId}/>;
  else if(seg[1]==='new')c=<EnvWizard planId={planId}/>;
  else if(seg[1]==='runs'&&seg[2])c=<ValidationRunPage runId={seg[2]}/>;
  else if(seg[1]==='passports')c=seg[2]?<PassportPage runId={seg[2]}/>:<PassportPage/>;
  else c=<EnvDetailPage envId={seg[1]} planId={planId}/>;
}
else c=<DashboardPage/>;
return<AppShell>{c}</AppShell>;
}
export function App(){return<RouterProvider><Routes/></RouterProvider>;}