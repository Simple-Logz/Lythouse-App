import{RouterProvider,useRouter}from'./lib/router';
import{AppShell,usePlanId}from'./pages/AppShell';
import type{PlanId}from'./lib/supabase';
import{AuthPage}from'./pages/AuthPage';
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
import{useAuth}from'./lib/auth';
import{useIsMobile}from'./lib/useIsMobile';
import{MobileApp}from'./mobile/MobileApp';
import{MobilePreview}from'./mobile/MobilePreview';
import{DecisionPreview}from'./workspace/DecisionPreview';
import{LandingPage}from'./pages/LandingPage';
import{ResetPasswordPage}from'./pages/ResetPasswordPage';
import{LegalPage,LEGAL_ROUTES}from'./pages/LegalPage';
import{EnvironmentValidationPage}from'./pages/EnvironmentValidationPage';
import{DocsPage}from'./pages/DocsPage';
import{OnboardingPage}from'./pages/OnboardingPage';
import{CommandCenter}from'./pages/CommandCenter';
import{ExecutiveDashboard}from'./pages/ExecutiveDashboard';
import{WorkspaceDetailPage}from'./pages/WorkspaceDetailPage';
import{Spinner}from'./lib/ui';
import type{ReactNode}from'react';

// Shared route → page mapping, used by both the desktop shell and the mobile app
// so every feature on the web is reachable on mobile too (no missing screens).
export function pageForPath(path:string,planId:PlanId):ReactNode{
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
else if(seg[0]==='environment')c=<EnvironmentValidationPage/>;
else if(seg[0]==='docs')c=<DocsPage/>;
else if(seg[0]==='settings')c=<SettingsPage/>;
else if(seg[0]==='workspaces')c=seg[1]?<WorkspaceDetailPage workspaceId={seg[1]}/>:<WorkspacesPage/>;
else if(seg[0]==='executive')c=<ExecutiveDashboard/>;
else if(seg[0]==='command-center')c=<CommandCenter/>;
else if(seg[0]==='onboarding')c=<OnboardingPage/>;
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
return c;
}

function Routes(){
const{path}=useRouter();
const planId=usePlanId();
return<AppShell>{pageForPath(path,planId)}</AppShell>;
}

function AuthGate(){
const{session,loading}=useAuth();
const{path}=useRouter();
const isMobile=useIsMobile();
// TEMP: design previews without auth.
if(path==='/__mpreview')return<MobilePreview/>;
if(path==='/__dpreview'){const D=DecisionPreview;return<D/>;}
if(path==='/__envpreview')return<div className="min-h-screen bg-[#f4f3f0]"><div className="mx-auto max-w-7xl px-4 py-8"><EnvironmentValidationPage/></div></div>;
// Password recovery lands here (with a temporary recovery session) — render
// regardless of auth state.
if(path==='/reset-password')return<ResetPasswordPage/>;
// Public legal/trust pages (accessible signed-in or out).
{const seg0=path.split('/').filter(Boolean)[0];if(LEGAL_ROUTES.includes(seg0))return<LegalPage doc={seg0}/>;}
if(loading)return(
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-3">
      <Spinner size={28}/>
      <p className="text-sm text-gray-500">Loading LytHouse…</p>
    </div>
  </div>
);
if(!session){
  // Unauthenticated: the marketing cover page is the front door. The auth form
  // only appears when the visitor explicitly heads to sign in / sign up.
  const authPaths=['/signin','/signup','/auth','/login'];
  if(authPaths.includes(path))return<AuthPage initialMode={path==='/signup'?'signup':'signin'}/>;
  return<LandingPage/>;
}
// Phones get the dedicated mobile app; desktop keeps the full workspace.
// renderPage lets the mobile app open any real page too (full feature parity).
if(isMobile)return<MobileApp renderPage={(p:string)=>pageForPath(p,'free')}/>;
return<Routes/>;
}

export function App(){return<RouterProvider><AuthGate/></RouterProvider>;}
