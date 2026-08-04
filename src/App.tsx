// @ts-nocheck
import{Suspense,lazy}from'react';
import{RouterProvider,useRouter}from'./lib/router';
import{AppShell,usePlanId}from'./pages/AppShell';
import type{PlanId}from'./lib/supabase';
import{AuthPage}from'./pages/AuthPage';
import{useAuth}from'./lib/auth';
import{useIsMobile}from'./lib/useIsMobile';
import{MobileApp}from'./mobile/MobileApp';
import{LandingPage}from'./pages/LandingPage';
import{LegalPage,LEGAL_ROUTES}from'./pages/LegalPage';
import{AcceptInvitePage,takePendingInvite}from'./pages/AcceptInvitePage';
import{Spinner,ToastHost}from'./lib/ui';
import type{ReactNode}from'react';

// Route-level pages are code-split: a phone (or a fresh desktop load) only
// has to fetch the app shell plus whichever single page is actually open,
// instead of every feature in the product bundled into one multi-megabyte
// file. This is what was making first load (and every full page nav on a
// slow connection) feel frozen/unresponsive on mobile.
const ProjectsPage=lazy(()=>import('./pages/ProjectsPage').then(m=>({default:m.ProjectsPage})));
const ProjectWorkspace=lazy(()=>import('./workspace/ProjectWorkspace').then(m=>({default:m.ProjectWorkspace})));
const DashboardPage=lazy(()=>import('./pages/DashboardPage').then(m=>({default:m.DashboardPage})));
const DeploymentsPage=lazy(()=>import('./pages/DeploymentsPage').then(m=>({default:m.DeploymentsPage})));
const SimulatorPage=lazy(()=>import('./pages/SimulatorPage').then(m=>({default:m.SimulatorPage})));
const AnalyticsPage=lazy(()=>import('./pages/AnalyticsPage').then(m=>({default:m.AnalyticsPage})));
const PolicyPage=lazy(()=>import('./pages/PolicyPage').then(m=>({default:m.PolicyPage})));
const AuditLogPage=lazy(()=>import('./pages/AuditLogPage').then(m=>({default:m.AuditLogPage})));
const TeamPage=lazy(()=>import('./pages/TeamPage').then(m=>({default:m.TeamPage})));
const SettingsPage=lazy(()=>import('./pages/SettingsPage').then(m=>({default:m.SettingsPage})));
const PlansPage=lazy(()=>import('./pages/PlansPage').then(m=>({default:m.PlansPage})));
const UsagePage=lazy(()=>import('./pages/UsagePage').then(m=>({default:m.UsagePage})));
const RunsPage=lazy(()=>import('./pages/RunsPage').then(m=>({default:m.RunsPage})));
const WorkspacesPage=lazy(()=>import('./pages/WorkspacesPage').then(m=>({default:m.WorkspacesPage})));
const OrganizationsPage=lazy(()=>import('./pages/OrganizationsPage').then(m=>({default:m.OrganizationsPage})));
const CompliancePage=lazy(()=>import('./pages/CompliancePage'));
const IncidentPage=lazy(()=>import('./pages/IncidentPage'));
const IntegrationsPage=lazy(()=>import('./pages/IntegrationsPage'));
const ServerValidationPage=lazy(()=>import('./pages/server-validation/ServerValidationPage').then(m=>({default:m.ServerValidationPage})));
const EnvWizard=lazy(()=>import('./pages/server-validation/EnvWizard').then(m=>({default:m.EnvWizard})));
const EnvDetailPage=lazy(()=>import('./pages/server-validation/EnvDetailPage').then(m=>({default:m.EnvDetailPage})));
const ValidationRunPage=lazy(()=>import('./pages/server-validation/ValidationRunPage').then(m=>({default:m.ValidationRunPage})));
const PassportPage=lazy(()=>import('./pages/server-validation/PassportPage').then(m=>({default:m.PassportPage})));
const LoadTestingPage=lazy(()=>import('./pages/LoadTestingPage').then(m=>({default:m.LoadTestingPage})));
const ApiTestingPage=lazy(()=>import('./pages/ApiTestingPage').then(m=>({default:m.ApiTestingPage})));
const ChaosEngineeringPage=lazy(()=>import('./pages/ChaosEngineeringPage').then(m=>({default:m.ChaosEngineeringPage})));
const MobilePreview=lazy(()=>import('./mobile/MobilePreview').then(m=>({default:m.MobilePreview})));
const DecisionPreview=lazy(()=>import('./workspace/DecisionPreview').then(m=>({default:m.DecisionPreview})));
const FreeTrialPage=lazy(()=>import('./pages/FreeTrialPage').then(m=>({default:m.FreeTrialPage})));
const BookDemoPage=lazy(()=>import('./pages/BookDemoPage').then(m=>({default:m.BookDemoPage})));
const ResetPasswordPage=lazy(()=>import('./pages/ResetPasswordPage').then(m=>({default:m.ResetPasswordPage})));
const EnvironmentValidationPage=lazy(()=>import('./pages/EnvironmentValidationPage').then(m=>({default:m.EnvironmentValidationPage})));
const DocsPage=lazy(()=>import('./pages/DocsPage').then(m=>({default:m.DocsPage})));
const OnboardingPage=lazy(()=>import('./pages/OnboardingPage').then(m=>({default:m.OnboardingPage})));
const FindingsPage=lazy(()=>import('./pages/FindingsPage').then(m=>({default:m.FindingsPage})));
const ApprovalsPage=lazy(()=>import('./pages/ApprovalsPage').then(m=>({default:m.ApprovalsPage})));
const ChangeManagementPage=lazy(()=>import('./pages/ChangeManagementPage').then(m=>({default:m.ChangeManagementPage})));
const ChangeRequestDetailPage=lazy(()=>import('./pages/ChangeRequestDetailPage').then(m=>({default:m.ChangeRequestDetailPage})));
const StacksPage=lazy(()=>import('./pages/StacksPage').then(m=>({default:m.StacksPage})));
const ReleasePipelinePage=lazy(()=>import('./pages/ReleasePipelinePage').then(m=>({default:m.ReleasePipelinePage})));
const PluginsPage=lazy(()=>import('./pages/PluginsPage').then(m=>({default:m.PluginsPage})));
const CommandCenter=lazy(()=>import('./pages/CommandCenter').then(m=>({default:m.CommandCenter})));
const ExecutiveDashboard=lazy(()=>import('./pages/ExecutiveDashboard').then(m=>({default:m.ExecutiveDashboard})));
const WorkspaceDetailPage=lazy(()=>import('./pages/WorkspaceDetailPage').then(m=>({default:m.WorkspaceDetailPage})));

function PageFallback(){
  return<div className="flex justify-center py-24"><Spinner size={28}/></div>;
}

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
else if(seg[0]==='findings')c=<FindingsPage/>;
else if(seg[0]==='approvals')c=<ApprovalsPage/>;
else if(seg[0]==='change-management')c=seg[1]?<ChangeRequestDetailPage id={seg[1]}/>:<ChangeManagementPage/>;
else if(seg[0]==='stacks')c=<StacksPage/>;
else if(seg[0]==='pipeline')c=<ReleasePipelinePage/>;
else if(seg[0]==='plugins')c=<PluginsPage/>;
else if(seg[0]==='team')c=<TeamPage/>;
else if(seg[0]==='plans')c=<PlansPage/>;
else if(seg[0]==='usage')c=<UsagePage/>;
else if(seg[0]==='runs')c=<RunsPage/>;
else if(seg[0]==='compliance')c=<CompliancePage/>;
else if(seg[0]==='incidents')c=<IncidentPage/>;
else if(seg[0]==='integrations')c=<IntegrationsPage/>;
else if(seg[0]==='environment')c=<EnvironmentValidationPage/>;
else if(seg[0]==='docs')c=<DocsPage/>;
else if(seg[0]==='settings')c=<SettingsPage/>;
else if(seg[0]==='workspaces')c=seg[1]?<WorkspaceDetailPage workspaceId={seg[1]}/>:<WorkspacesPage/>;
else if(seg[0]==='organizations')c=<OrganizationsPage/>;
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
return<Suspense fallback={<PageFallback/>}>{c}</Suspense>;
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
if(path==='/__mpreview')return<Suspense fallback={<PageFallback/>}><MobilePreview/></Suspense>;
if(path==='/__dpreview'){const D=DecisionPreview;return<Suspense fallback={<PageFallback/>}><D/></Suspense>;}
if(path==='/__envpreview')return<div className="min-h-screen bg-[#f4f3f0]"><div className="mx-auto max-w-7xl px-4 py-8"><Suspense fallback={<PageFallback/>}><EnvironmentValidationPage/></Suspense></div></div>;
// Password recovery lands here (with a temporary recovery session) — render
// regardless of auth state.
if(path==='/reset-password')return<Suspense fallback={<PageFallback/>}><ResetPasswordPage/></Suspense>;
// Public legal/trust pages (accessible signed-in or out).
{const seg0=path.split('/').filter(Boolean)[0];if(LEGAL_ROUTES.includes(seg0))return<LegalPage doc={seg0}/>;}
// Documentation is a standalone microsite with its own chrome — never nest it
// inside the app shell (that produced a broken double-sidebar layout).
{const seg0=path.split('/').filter(Boolean)[0];if(seg0==='docs')return<Suspense fallback={<PageFallback/>}><DocsPage/></Suspense>;}
if(loading)return(
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-3">
      <Spinner size={28}/>
      <p className="text-sm text-gray-500">Loading LytHouse…</p>
    </div>
  </div>
);
// Invitation acceptance link — works signed-in or out (the page prompts for
// auth when needed and resumes automatically).
{const seg=path.split('/').filter(Boolean);if(seg[0]==='invite'&&seg[1])return<AcceptInvitePage token={seg[1]}/>;}
if(!session){
  // Unauthenticated: the marketing cover page is the front door. Free trial and
  // Book a demo get dedicated pages; the auth form is only for sign in.
  if(path==='/signup'||path==='/trial'||path==='/free-trial')return<Suspense fallback={<PageFallback/>}><FreeTrialPage/></Suspense>;
  if(path==='/demo'||path==='/book-demo')return<Suspense fallback={<PageFallback/>}><BookDemoPage/></Suspense>;
  if(path==='/docs')return<Suspense fallback={<PageFallback/>}><DocsPage/></Suspense>;
  if(path==='/plans'||path==='/pricing')return<div className="min-h-screen bg-[#fbfaff]"><div className="mx-auto max-w-6xl px-5 py-12"><Suspense fallback={<PageFallback/>}><PlansPage/></Suspense></div></div>;
  const authPaths=['/signin','/auth','/login'];
  if(authPaths.includes(path))return<AuthPage initialMode='signin'/>;
  return<LandingPage/>;
}
// Just signed in with a pending invite waiting? Resume acceptance.
{const pending=takePendingInvite();if(pending&&!path.startsWith('/invite/')){window.history.replaceState({},'',`/invite/${pending}`);return<AcceptInvitePage token={pending}/>;}}
// Phones get the dedicated mobile app; desktop keeps the full workspace.
// renderPage lets the mobile app open any real page too (full feature parity).
if(isMobile)return<MobileApp renderPage={(p:string)=>pageForPath(p,'free')}/>;
return<Routes/>;
}

export function App(){return<RouterProvider><AuthGate/><ToastHost/></RouterProvider>;}
