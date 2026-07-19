import { useEffect, useState, type ReactNode, createContext, useContext } from 'react'
import { LayoutDashboard, FolderGit2, Rocket, FlaskConical, ChartBar as BarChart3, Shield, Users, ScrollText, Settings, Boxes, ChevronDown, Menu, Sparkles, ShieldCheck, ShieldAlert, OctagonAlert as AlertOctagon, Webhook, Network, Scale, Server, Lock, Search, FileCheck, CirclePlay as PlayCircle, Activity, Zap, LogOut } from 'lucide-react'
import { supabase, type Workspace, type WorkspacePlan, type PlanId, PLANS } from '../lib/supabase'
import { useRouter, Link } from '../lib/router'
import { useAuth } from '../lib/auth'
import { Logo } from '../lib/ui'

const PlanContext = createContext<PlanId>('free')
export function usePlanId(): PlanId { return useContext(PlanContext) }

type NavLeaf = { label: string; to: string; icon: typeof LayoutDashboard }
type NavGroup = { label: string; icon: typeof LayoutDashboard; children: NavLeaf[] }
type NavItem = NavLeaf | NavGroup
function isGroup(n: NavItem): n is NavGroup { return (n as NavGroup).children !== undefined }

const NAV: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Command Center', to: '/executive', icon: BarChart3 },
  { label: 'Projects', to: '/projects', icon: FolderGit2 },
  { label: 'Policy Studio', to: '/policies', icon: ShieldCheck },
  { label: 'Workspaces', to: '/workspaces', icon: Boxes },
  { label: 'Team', to: '/team', icon: Users },
  { label: 'Plans', to: '/plans', icon: Sparkles },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { path } = useRouter()
  const { user, profile, signOut } = useAuth()
  const [activeWs, setActiveWs] = useState<Workspace | null>(null)
  const [plan, setPlan] = useState<WorkspacePlan | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const groups: Record<string, boolean> = {}
    for (const n of NAV) {
      if (isGroup(n) && n.children.some(c => path === c.to || path.startsWith(c.to + '/'))) groups[n.label] = true
    }
    return groups
  })

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
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {NAV.map((n) => {
          if (isGroup(n)) {
            const isOpen = openGroups[n.label] ?? false
            const hasActive = n.children.some(c => isPathActive(c.to))
            return (
              <div key={n.label}>
                <button onClick={() => setOpenGroups(p => ({ ...p, [n.label]: !isOpen }))} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${hasActive ? 'text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <n.icon size={16} /> {n.label}
                  {n.label === 'Server Validation' && planId === 'free' && <Lock size={12} className="text-gray-400" />}
                  <ChevronDown size={14} className={`ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 pl-3">
                    {n.children.map(c => {
                      const active = isPathActive(c.to)
                      return <Link key={c.to} to={c.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`} onClick={() => setMobileOpen(false)}><c.icon size={15} /> {c.label}</Link>
                    })}
                  </div>
                )}
              </div>
            )
          }
          const active = isPathActive(n.to)
          return <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`} onClick={() => setMobileOpen(false)}><n.icon size={16} /> {n.label}</Link>
        })}
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
    <div className="min-h-screen bg-gray-50">
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