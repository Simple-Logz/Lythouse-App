import { useEffect, useState, type ReactNode, createContext, useContext } from 'react'
import { LayoutDashboard, FolderGit2, Rocket, FlaskConical, ChartBar as BarChart3, Shield, Users, ScrollText, Settings, Boxes, ChevronDown, Menu, Sparkles, ShieldCheck, ShieldAlert, OctagonAlert as AlertOctagon, Webhook, Network, Scale, Server, Lock, Search, FileCheck, CirclePlay as PlayCircle, Activity, Zap, LogOut, BookOpen } from 'lucide-react'
import { supabase, type Workspace, type WorkspacePlan, type PlanId, PLANS } from '../lib/supabase'
import { useRouter, Link } from '../lib/router'
import { useAuth } from '../lib/auth'
import { Logo } from '../lib/ui'

const PlanContext = createContext<PlanId>('free')
export function usePlanId(): PlanId { return useContext(PlanContext) }

type NavLeaf = { label: string; to: string; icon: typeof LayoutDashboard }
type NavSection = { section: string; items: NavLeaf[] }

// Grouped, intent-based navigation (Infisical-style sections): the things you
// use daily sit up top, the things you configure once sink to the bottom.
const NAV: NavSection[] = [
  { section: 'Getting Started', items: [
    { label: 'How LytHouse Works', to: '/docs', icon: BookOpen },
  ] },
  { section: 'Overview', items: [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Executive View', to: '/executive', icon: BarChart3 },
  ] },
  { section: 'Release Intelligence', items: [
    { label: 'Projects', to: '/projects', icon: FolderGit2 },
    { label: 'Policy Studio', to: '/policies', icon: ShieldCheck },
  ] },
  { section: 'Environment', items: [
    { label: 'Environment', to: '/environment', icon: Server },
    { label: 'Integrations', to: '/integrations', icon: Webhook },
  ] },
  { section: 'Workspace', items: [
    { label: 'Workspaces', to: '/workspaces', icon: Boxes },
    { label: 'Team', to: '/team', icon: Users },
    { label: 'Plans', to: '/plans', icon: Sparkles },
    { label: 'Settings', to: '/settings', icon: Settings },
  ] },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { path } = useRouter()
  const { user, profile, signOut } = useAuth()
  const [activeWs, setActiveWs] = useState<Workspace | null>(null)
  const [plan, setPlan] = useState<WorkspacePlan | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    supabase.from('workspaces').select('*').order('created_at').then(({ data }) => {
      if (!data?.length) return
      const savedId = localStorage.getItem('sandbox.activeWs')
      const ws = data.find((w) => w.id === savedId) ?? data[0]
      setActiveWs(ws)
      localStorage.setItem('sandbox.activeWs', ws.id)
    })
  }, [])

  useEffect(() => {
    if (!activeWs) return
    setPlan(null)
    supabase.from('workspace_plans').select('*').eq('workspace_id', activeWs.id).order('created_at', { ascending: false }).limit(1).then(({ data }) => data?.[0] && setPlan(data[0]))
  }, [activeWs])

  const planId: PlanId = (plan?.plan_id as PlanId) ?? 'free'
  const planInfo = PLANS[planId]
  const isPathActive = (to: string) => path === to || path.startsWith(to + '/')

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-gray-200 px-5"><Logo /></div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV.map((sec) => (
          <div key={sec.section} className="pt-4 first:pt-0">
            <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">{sec.section}</div>
            <div className="space-y-0.5">
              {sec.items.map((n) => {
                const active = isPathActive(n.to)
                return <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`} onClick={() => setMobileOpen(false)}><n.icon size={16} /> {n.label}</Link>
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-gray-200 p-3 space-y-2">
        {activeWs && (
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5"><Sparkles size={11} className="text-brand-500"/><span className={`chip border text-xs ${planInfo.badge}`}>{planInfo.name}</span></div>
              <p className="mt-0.5 truncate text-xs text-gray-500">{activeWs.name}</p>
            </div>
            {planId !== 'enterprise' && <Link to="/plans" className="text-xs font-medium text-brand-600 hover:underline shrink-0">Upgrade</Link>}
          </div>
        )}
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold overflow-hidden">
            {profile?.avatar_url
              ?<img src={profile.avatar_url} alt="Avatar" className="h-8 w-8 object-cover rounded-full"/>
              :(profile?.full_name||user?.email||'U').charAt(0).toUpperCase()
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-navy-900">{profile?.full_name||'My Account'}</p>
            <p className="truncate text-xs text-gray-400">{user?.email||''}</p>
          </div>
          <button onClick={()=>signOut()} title="Sign out" className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <LogOut size={14}/>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f6f5f2]">
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 border-r border-gray-200 bg-white lg:block">{Sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed left-0 top-0 z-50 h-screen w-64 border-r border-gray-200 bg-white transition-transform lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>{Sidebar}</aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/80 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="btn-ghost p-2"><Menu size={18} /></button>
          <Logo size={22} />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8"><PlanContext.Provider value={planId}>{children}</PlanContext.Provider></main>
      </div>
    </div>
  )
}