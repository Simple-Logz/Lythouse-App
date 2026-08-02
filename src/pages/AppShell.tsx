// @ts-nocheck
import { useEffect, useState, type ReactNode, createContext, useContext } from 'react'
import {
  LayoutDashboard, ChartBar as BarChart3, FolderGit2, Server, Boxes, LogOut, BookOpen,
  Menu, Sparkles, Scale, Rocket, Compass, ShieldCheck, Zap, Activity, GitBranch,
  Plug, Bug, ClipboardCheck, FileWarning, ScrollText, Users, CreditCard, Settings as SettingsIcon,
  Building2, Layers, Workflow, ChevronsUpDown, Check, Plus, Pin, X
} from 'lucide-react'
import { supabase, type Workspace, type Organization, type WorkspacePlan, type PlanId, PLANS } from '../lib/supabase'
import { usePins, removePin, pinKey, type PinType } from '../lib/pins'
import { useRouter, Link } from '../lib/router'
import { useAuth } from '../lib/auth'
import { CommandPalette } from './CommandPalette'
import { AskAiPanel } from './AskAiPanel'

const PlanContext = createContext<PlanId>('free')
export function usePlanId(): PlanId { return useContext(PlanContext) }

// Flat, labeled sections (template style) — every item routes to a real page.
const SECTIONS = [
  { key: 'platform', label: 'Platform', items: [
    { label: 'Documentation', to: '/docs', icon: Compass },
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Projects', to: '/projects', icon: FolderGit2 },
    { label: 'Stacks', to: '/stacks', icon: Layers },
    { label: 'Workspaces', to: '/workspaces', icon: Building2 },
  ] },
  { key: 'rel', label: 'Release Intelligence', items: [
    { label: 'Release Pipeline', to: '/pipeline', icon: Workflow },
    { label: 'Executive View', to: '/executive', icon: BarChart3 },
    { label: 'Deployments', to: '/deployments', icon: Rocket },
    { label: 'Deployment Simulator', to: '/simulator', icon: Zap },
    { label: 'Analytics', to: '/analytics', icon: Activity },
    { label: 'Policy Studio', to: '/policies', icon: ShieldCheck },
  ] },
  { key: 'env', label: 'Environment Validation', items: [
    { label: 'Environment', to: '/environment', icon: Server },
    { label: 'Integrations', to: '/integrations', icon: Plug },
    { label: 'Plugins', to: '/plugins', icon: Boxes },
  ] },
  { key: 'ai', label: 'AI Remediation', items: [
    { label: 'Findings', to: '/findings', icon: Bug },
  ] },
  { key: 'gov', label: 'Governance', items: [
    { label: 'Approvals', to: '/approvals', icon: ClipboardCheck },
    { label: 'Compliance', to: '/compliance', icon: Scale },
    { label: 'Incidents', to: '/incidents', icon: FileWarning },
    { label: 'Audit', to: '/audit', icon: ScrollText },
  ] },
  { key: 'org', label: 'Organization', items: [
    { label: 'Organizations', to: '/organizations', icon: Building2 },
    { label: 'Team', to: '/team', icon: Users },
    { label: 'Plans', to: '/plans', icon: CreditCard },
    { label: 'Settings', to: '/settings', icon: SettingsIcon },
  ] },
]
const PIN_ICONS: Record<PinType, any> = {
  workspace: Building2, project: FolderGit2, finding: Bug, stack: Layers, environment: Server,
}
const TITLES: Record<string, string> = {
  '/dashboard': 'Overview', '/executive': 'Executive View', '/projects': 'Projects',
  '/deployments': 'Deployments', '/simulator': 'Deployment Simulator', '/analytics': 'Analytics',
  '/policies': 'Policy Studio', '/environment': 'Environment Validation', '/integrations': 'Integrations',
  '/findings': 'Findings', '/approvals': 'Approvals', '/compliance': 'Compliance', '/incidents': 'Incidents', '/audit': 'Audit',
  '/workspaces': 'Workspaces', '/organizations': 'Organizations', '/team': 'Team', '/plans': 'Plans', '/settings': 'Settings', '/docs': 'Documentation',
  '/stacks': 'Stacks', '/plugins': 'Plugins', '/pipeline': 'Release Pipeline',
}

const CSS = `
:root{
  --lh-bg:#fbfaff;--lh-surface:#ffffff;--lh-surface2:#f4f2fb;--lh-sidebar:#faf9ff;
  --lh-border:#e9e6f2;--lh-border2:#ded9ec;--lh-text:#15171a;--lh-text2:#5b616b;--lh-text3:#8a909a;
  --lh-accent:#7c5ce6;--lh-accent-weak:#ece8ff;--lh-accent-contrast:#ffffff;--lh-ring:rgba(124,92,230,.22);
}
:root[data-theme="dark"]{
  --lh-bg:#1b1826;--lh-surface:#232030;--lh-surface2:#2a2639;--lh-sidebar:#181523;
  --lh-border:#383048;--lh-border2:#463d5a;--lh-text:#eeecf6;--lh-text2:#a9a5bb;--lh-text3:#746f88;
  --lh-accent:#a78bfa;--lh-accent-weak:rgba(167,139,250,.15);--lh-accent-contrast:#ffffff;--lh-ring:rgba(167,139,250,.30);
}
.lh-app{min-height:100vh;background:var(--lh-bg);color:var(--lh-text)}
/* Light theme: a soft lavender/sky/pink gradient field across the whole app so
   the color shows around and behind the white cards (Dash-style airy backdrop). */
:root[data-theme="light"] .lh-app{
  background:
    radial-gradient(1150px 560px at 10% -10%, rgba(167,139,250,.22), transparent 60%),
    radial-gradient(950px 520px at 100% -4%, rgba(147,197,253,.20), transparent 55%),
    radial-gradient(1000px 640px at 62% 112%, rgba(240,171,214,.18), transparent 55%),
    #fbfaff;
  background-attachment:fixed;
}
.lh-sb{background:var(--lh-sidebar);border-right:1px solid var(--lh-border);display:flex;flex-direction:column;height:100%}
.lh-brand{display:flex;align-items:center;gap:9px;padding:14px 16px;font-weight:700;font-size:16px;letter-spacing:-.02em}
.lh-mk{width:27px;height:27px;border-radius:7px;background:var(--lh-accent);display:grid;place-items:center;color:var(--lh-accent-contrast)}
.lh-wswrap{position:relative;margin:0 12px 6px}
.lh-ws{width:100%;display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid var(--lh-border);border-radius:9px;background:var(--lh-surface);font-size:13px;font-family:inherit;color:var(--lh-text);cursor:pointer;text-align:left;transition:.12s}
.lh-ws:hover{background:var(--lh-surface2);border-color:var(--lh-border2)}
.lh-ws-org{margin-top:2px;background:var(--lh-accent-weak);border-color:color-mix(in srgb,var(--lh-accent) 32%,transparent)}
.lh-ws-org:hover{border-color:var(--lh-accent)}
.lh-ws-org .wa{background:var(--lh-accent);color:var(--lh-accent-contrast)}
.lh-ws-current{cursor:default;background:var(--lh-surface2);border-color:transparent}
.lh-ws-current:hover{background:var(--lh-surface2);border-color:transparent}
.lh-cur-dot{margin-left:auto;flex-shrink:0;width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px color-mix(in srgb,#34d399 22%,transparent)}
.lh-ws .wa{width:22px;height:22px;border-radius:6px;background:var(--lh-accent-weak);color:var(--lh-accent);display:grid;place-items:center;font-weight:700;font-size:11px;flex-shrink:0}
.lh-ws .wn{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lh-ws .cv{color:var(--lh-text3);flex-shrink:0}
.lh-wsm-ov{position:fixed;inset:0;z-index:39}
.lh-wsm{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:40;background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:11px;box-shadow:0 22px 54px -18px rgba(4,8,14,.55);padding:6px;animation:lh-pop .14s ease}
.lh-wsm-h{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--lh-text3);padding:6px 8px 5px}
.lh-wsm-i{display:flex;align-items:center;gap:9px;width:100%;padding:8px;border-radius:8px;cursor:pointer;border:none;background:transparent;font-family:inherit;font-size:13px;color:var(--lh-text);text-align:left}
.lh-wsm-i:hover{background:var(--lh-surface2)}
.lh-wsm-i.sub{padding-left:20px;font-size:12.5px}
.lh-wsm-i .wa{width:22px;height:22px;border-radius:6px;background:var(--lh-accent-weak);color:var(--lh-accent);display:grid;place-items:center;font-weight:700;font-size:11px;flex-shrink:0}
.lh-wsm-i .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.lh-wsm-i.add{color:var(--lh-accent);font-weight:600}
.lh-wsm-i.add .ic{width:22px;height:22px;border-radius:6px;border:1px dashed var(--lh-border2);display:grid;place-items:center;flex-shrink:0}
.lh-wsm-sep{height:1px;background:var(--lh-border);margin:6px 4px}
.lh-orgov{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:16px;background:color-mix(in srgb,#05070a 45%,transparent);backdrop-filter:blur(3px)}
.lh-orgm{width:min(94vw,420px);background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:16px;padding:22px;box-shadow:0 30px 80px -20px rgba(4,8,14,.6)}
.lh-orgm h3{font-size:17px;font-weight:700;color:var(--lh-text)}
.lh-orgm p{font-size:13px;color:var(--lh-text3);margin-top:3px}
.lh-orgm input{width:100%;margin-top:14px;background:var(--lh-surface2);border:1px solid var(--lh-border);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;color:var(--lh-text);outline:none}
.lh-orgm input:focus{border-color:var(--lh-accent)}
.lh-orgm .row{display:flex;gap:9px;margin-top:16px;justify-content:flex-end}
.lh-orgm .b{border-radius:10px;padding:9px 16px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;border:1px solid var(--lh-border);background:transparent;color:var(--lh-text2)}
.lh-orgm .b.pri{background:var(--lh-accent);color:var(--lh-accent-contrast);border-color:transparent}
.lh-orgm .b:disabled{opacity:.5;cursor:default}
.lh-chip{font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:20px;background:var(--lh-accent-weak);color:var(--lh-accent);border:1px solid var(--lh-border);flex-shrink:0}
.lh-nav{flex:1;overflow-y:auto;padding:8px 10px 12px}
.lh-sec{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--lh-text3);padding:14px 11px 6px}
.lh-sec.col{display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;font-family:inherit;cursor:pointer;transition:.12s}
.lh-sec.col:hover{color:var(--lh-text2)}
.lh-sec .cv{margin-left:auto;transition:transform .17s;transform:rotate(0deg)}
.lh-sec.col.open .cv{transform:rotate(90deg)}
.lh-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;font-size:13.5px;color:var(--lh-text2);font-weight:500;cursor:pointer;transition:.12s;text-decoration:none}
.lh-item:hover{background:var(--lh-surface2);color:var(--lh-text)}
.lh-item.active{background:var(--lh-accent-weak);color:var(--lh-text);font-weight:600}
.lh-item .ic{color:var(--lh-text3);flex-shrink:0}
.lh-item.active .ic{color:var(--lh-accent)}
.lh-pinrow{padding-right:6px}
.lh-pinrow .lh-pinlabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lh-pinrow .lh-unpin{margin-left:auto;flex-shrink:0;display:grid;place-items:center;width:22px;height:22px;border-radius:6px;border:none;background:transparent;color:var(--lh-text3);cursor:pointer;opacity:0;transform:translateX(2px);transition:.14s}
.lh-pinrow:hover .lh-unpin{opacity:1;transform:none}
.lh-pinrow .lh-unpin:hover{background:var(--lh-border);color:var(--lh-text)}
.lh-pinrow .ic{color:var(--lh-accent)}
.lh-sec-empty{font-size:12px;color:var(--lh-text3);padding:4px 11px 8px;line-height:1.5}
.lh-foot{border-top:1px solid var(--lh-border);padding:10px 12px}
.lh-user{display:flex;align-items:center;gap:9px;padding:4px}
.lh-ua{width:30px;height:30px;border-radius:50%;background:var(--lh-accent);color:var(--lh-accent-contrast);display:grid;place-items:center;font-weight:700;font-size:12px;overflow:hidden;flex-shrink:0}
.lh-un{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lh-ue{font-size:11px;color:var(--lh-text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lh-iconbtn{width:34px;height:34px;border-radius:8px;border:1px solid var(--lh-border);background:var(--lh-surface);color:var(--lh-text);cursor:pointer;display:grid;place-items:center;flex-shrink:0}
.lh-iconbtn:hover{background:var(--lh-surface2)}
.lh-tb{position:sticky;top:0;z-index:10;height:56px;display:flex;align-items:center;gap:12px;padding:0 22px;border-bottom:1px solid var(--lh-border);background:color-mix(in srgb,var(--lh-bg) 86%,transparent);backdrop-filter:blur(10px)}
.lh-title{font-size:16px;font-weight:600;letter-spacing:-.01em}
.lh-search{align-items:center;gap:8px;width:260px;padding:7px 11px;border:1px solid var(--lh-border);border-radius:9px;background:var(--lh-surface);color:var(--lh-text3);font-size:13px}
.lh-kbd{margin-left:auto;font-size:11px;border:1px solid var(--lh-border);border-radius:5px;padding:1px 5px;font-family:'JetBrains Mono',monospace}
.lh-search{cursor:pointer;transition:.14s}
.lh-search:hover{border-color:var(--lh-border2);background:var(--lh-surface2);color:var(--lh-text2)}
.lh-item,.lh-gp{position:relative}
.lh-item.active::before{content:'';position:absolute;left:-10px;top:50%;transform:translateY(-50%);width:3px;height:15px;border-radius:3px;background:var(--lh-accent);animation:lh-pop .22s cubic-bezier(.2,.8,.2,1)}
@keyframes lh-pop{from{opacity:0;transform:translateY(-50%) scaleY(.4)}to{opacity:1;transform:translateY(-50%) scaleY(1)}}
@keyframes lh-page{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
.lh-page{animation:lh-page .26s cubic-bezier(.2,.8,.2,1)}
.lh-iconbtn{transition:.14s}
.lh-iconbtn:active{transform:scale(.93)}

/* ── AI ambient glow (Spacelift-style depth) ── */
/* Soft gradient aurora — pastel lavender/sky/pink blooms on the light theme
   (Dash-style), a deeper slate glow when toggled to dark. */
.lh-aurora{position:fixed;inset:-25%;z-index:0;pointer-events:none;overflow:hidden;opacity:1;transition:opacity .8s}
.lh-blob{position:absolute;width:46vw;height:46vw;border-radius:50%;filter:blur(120px);will-change:transform}
.lh-blob.b1{background:radial-gradient(circle,rgba(167,139,250,.34),transparent 60%);top:-12%;left:-6%;animation:lh-f1 24s ease-in-out infinite alternate}
.lh-blob.b2{background:radial-gradient(circle,rgba(147,197,253,.28),transparent 62%);top:-8%;right:-6%;animation:lh-f2 29s ease-in-out infinite alternate}
.lh-blob.b3{background:radial-gradient(circle,rgba(240,171,214,.30),transparent 60%);bottom:-20%;left:36%;animation:lh-f3 26s ease-in-out infinite alternate}
:root[data-theme="dark"] .lh-blob.b1{background:radial-gradient(circle,rgba(124,92,230,.32),transparent 60%)}
:root[data-theme="dark"] .lh-blob.b2{background:radial-gradient(circle,rgba(90,108,140,.20),transparent 62%)}
:root[data-theme="dark"] .lh-blob.b3{background:radial-gradient(circle,rgba(150,120,220,.24),transparent 60%)}
/* thin gradient hairline across the very top (Spacelift-style) */
.lh-topline{position:fixed;top:0;left:0;right:0;height:2px;z-index:70;opacity:0;background:linear-gradient(90deg,#7c5ce6,#a78bfa 45%,#e0a6d8 75%,#7c5ce6);background-size:200% 100%;animation:lh-slide 12s linear infinite}
:root[data-theme="dark"] .lh-topline{opacity:1}
@keyframes lh-slide{to{background-position:200% 0}}
@keyframes lh-f1{to{transform:translate(14%,20%) scale(1.18)}}
@keyframes lh-f2{to{transform:translate(-16%,12%) scale(1.12)}}
@keyframes lh-f3{to{transform:translate(10%,-14%) scale(1.22)}}
:root[data-theme="dark"] .lh-sb{background:color-mix(in srgb,var(--lh-sidebar) 82%,transparent);backdrop-filter:blur(12px)}
:root[data-theme="dark"] .lh-mk{box-shadow:0 0 20px -3px color-mix(in srgb,var(--lh-accent) 75%,transparent)}
:root[data-theme="dark"] .lh-item.active{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--lh-accent) 22%,transparent),0 6px 22px -9px color-mix(in srgb,var(--lh-accent) 55%,transparent)}
.lh-shell-body{position:relative;z-index:1}
/* Floating Ask-AI launcher */
.lh-ai{position:fixed;right:22px;bottom:22px;z-index:60;display:inline-flex;align-items:center;gap:8px;padding:11px 17px;border-radius:30px;background:var(--lh-accent);color:var(--lh-accent-contrast);border:none;cursor:pointer;font-family:inherit;font-weight:600;font-size:13.5px;box-shadow:0 10px 34px -8px color-mix(in srgb,var(--lh-accent) 70%,transparent);transition:.15s}
.lh-ai:hover{filter:brightness(1.07);transform:translateY(-1px)}
.lh-ai::before{content:'';position:absolute;inset:-5px;border-radius:34px;background:var(--lh-accent);opacity:.3;filter:blur(12px);z-index:-1;animation:lh-pulse 2.6s ease-in-out infinite}
@keyframes lh-pulse{0%,100%{opacity:.22;transform:scale(1)}50%{opacity:.46;transform:scale(1.07)}}
.lh-ai .sp{animation:lh-spin 6s linear infinite}
@keyframes lh-spin{to{transform:rotate(360deg)}}
@media(max-width:640px){.lh-ai span.tx{display:none}.lh-ai{padding:13px;border-radius:50%}}
`

function Brand() {
  return (
    <div className="lh-brand">
      <span className="lh-mk"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v18M12 3 7 9M12 3l5 6"/><circle cx="12" cy="15" r="2.3" fill="currentColor" stroke="none"/></svg></span>
      LytHouse
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { path, navigate } = useRouter()
  const { user, profile, signOut } = useAuth()
  const [activeWs, setActiveWs] = useState<Workspace | null>(null)
  const [orgList, setOrgList] = useState<Organization[]>([])
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null)
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)
  const [orgSwitchOpen, setOrgSwitchOpen] = useState(false)
  const [wsList, setWsList] = useState<Workspace[]>([])
  const [wsMenuOpen, setWsMenuOpen] = useState(false)
  const [modal, setModal] = useState<null | 'org' | 'ws'>(null)
  const [modalName, setModalName] = useState('')
  const [modalBusy, setModalBusy] = useState(false)

  const switchWorkspace = (id: string) => { localStorage.setItem('sandbox.activeWs', id); window.location.assign('/dashboard') }
  const switchOrganization = (id: string) => { localStorage.setItem('sandbox.activeOrg', id); localStorage.removeItem('sandbox.activeWs'); window.location.assign('/dashboard') }
  const createEntity = async () => {
    const name = modalName.trim(); if (!name) return
    setModalBusy(true)
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Date.now()
    if (modal === 'org') {
      const { data, error } = await supabase.from('organizations').insert({ name, slug }).select().single()
      if (error || !data) { setModalBusy(false); return }
      try { await supabase.from('organization_members').insert({ organization_id: data.id }) } catch {}
      localStorage.setItem('sandbox.activeOrg', data.id); localStorage.removeItem('sandbox.activeWs')
      window.location.assign('/dashboard')
    } else {
      const payload: any = { name, slug }
      if (activeOrg) payload.organization_id = activeOrg.id
      const { data, error } = await supabase.from('workspaces').insert(payload).select().single()
      if (error || !data) { setModalBusy(false); return }
      localStorage.setItem('sandbox.activeWs', data.id)
      window.location.assign('/dashboard')
    }
  }
  const [plan, setPlan] = useState<WorkspacePlan | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('lh.theme') as 'light' | 'dark') || 'light')
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  const [openSec, setOpenSec] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('lh.nav') || '{}') } catch { return {} }
  })
  const toggleSec = (k: string) => setOpenSec((o) => { const n = { ...o, [k]: o[k] === false ? true : false }; try { localStorage.setItem('lh.nav', JSON.stringify(n)) } catch {}; return n })
  const pins = usePins()

  const isPathActive = (to: string) => path === to || path.startsWith(to + '/')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault(); setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    // Drive the app's existing page-level dark styles too, so every page
    // flips with the shell — not just the frame.
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('lh.theme', theme)
  }, [theme])

  useEffect(() => {
    (async () => {
      // Organizations — the top-level tenant. Defensive: the table may not exist
      // yet (before the migration is run), in which case we just skip the org layer.
      let orgs: Organization[] = []
      try { const { data } = await supabase.from('organizations').select('*').order('created_at'); orgs = data || [] } catch {}
      let curOrg: Organization | null = null
      if (orgs.length) {
        setOrgList(orgs)
        const savedOrg = localStorage.getItem('sandbox.activeOrg')
        curOrg = orgs.find((o) => o.id === savedOrg) ?? orgs[0]
        setActiveOrg(curOrg)
        localStorage.setItem('sandbox.activeOrg', curOrg.id)
      }
      // Workspaces — scoped to the active organization when one exists.
      const { data: ws } = await supabase.from('workspaces').select('*').order('created_at')
      if (!ws?.length) return
      const scoped = curOrg ? ws.filter((w) => !w.organization_id || w.organization_id === curOrg!.id) : ws
      const list = scoped.length ? scoped : ws
      setWsList(list)
      const savedId = localStorage.getItem('sandbox.activeWs')
      const active = list.find((w) => w.id === savedId) ?? list[0]
      setActiveWs(active)
      localStorage.setItem('sandbox.activeWs', active.id)
    })()
  }, [])

  useEffect(() => {
    if (!activeWs) return
    setPlan(null)
    supabase.from('workspace_plans').select('*').eq('workspace_id', activeWs.id).order('created_at', { ascending: false }).limit(1).then(({ data }) => data?.[0] && setPlan(data[0]))
  }, [activeWs])

  const planId: PlanId = (plan?.plan_id as PlanId) ?? 'free'
  const planInfo = PLANS[planId]
  const pageTitle = TITLES[Object.keys(TITLES).find((k) => isPathActive(k)) || ''] || 'LytHouse'
  const go = () => setMobileOpen(false)

  const Sidebar = (
    <div className="lh-sb">
      <Brand />
      {/* Organizations — pinned to the very top for one-click switching, shown
          even before any org exists so it's always easy to find. */}
      <div className="lh-wswrap">
        <button className="lh-ws lh-ws-org" onClick={() => { setOrgMenuOpen((v) => !v); setWsMenuOpen(false) }} title="Switch organization">
          <span className="wa"><Building2 size={14} /></span>
          <span className="wn">Organizations</span>
          <ChevronsUpDown size={14} className="cv" />
        </button>
        {orgMenuOpen && (() => {
          const others = orgList.filter((o) => !activeOrg || o.id !== activeOrg.id)
          return (
            <>
              <div className="lh-wsm-ov" onClick={() => { setOrgMenuOpen(false); setOrgSwitchOpen(false) }} />
              <div className="lh-wsm">
                {/* current organization — click to reveal the others to switch to */}
                <button className="lh-wsm-i" onClick={() => setOrgSwitchOpen((v) => !v)}>
                  <span className="wa">{activeOrg ? (activeOrg.name || 'O').charAt(0).toUpperCase() : <Building2 size={12} />}</span>
                  <span className="nm">{activeOrg ? activeOrg.name : 'No organization selected'}</span>
                  <ChevronsUpDown size={14} style={{ color: 'var(--lh-text3)', flexShrink: 0 }} />
                </button>
                {orgSwitchOpen && (
                  others.length ? others.map((o) => (
                    <button key={o.id} className="lh-wsm-i sub" onClick={() => switchOrganization(o.id)}>
                      <span className="wa" style={{ background: 'transparent', border: '1px solid var(--lh-border)', color: 'var(--lh-text3)' }}>{(o.name || 'O').charAt(0).toUpperCase()}</span>
                      <span className="nm">{o.name}</span>
                    </button>
                  )) : <div style={{ padding: '2px 12px 8px 40px', fontSize: 12, color: 'var(--lh-text3)' }}>No other organizations</div>
                )}
                <div className="lh-wsm-sep" />
                <button className="lh-wsm-i add" onClick={() => { setOrgMenuOpen(false); setOrgSwitchOpen(false); setModalName(''); setModal('org') }}>
                  <span className="ic"><Plus size={13} /></span>Create organization
                </button>
                <button className="lh-wsm-i" onClick={() => { setOrgMenuOpen(false); setOrgSwitchOpen(false); navigate('/organizations') }}>
                  <span className="wa" style={{ background: 'transparent', border: '1px solid var(--lh-border)', color: 'var(--lh-text3)' }}><Building2 size={12} /></span>Manage organizations
                </button>
              </div>
            </>
          )
        })()}
      </div>
      {/* Static readout of the organization the user is currently in — no
          button, no dropdown, just reflects the active tenant. */}
      <div className="lh-wswrap" style={{ marginTop: -2 }}>
        <div className="lh-ws lh-ws-current" title={activeOrg ? `You are in ${activeOrg.name}` : 'No organization selected'}>
          <span className="wa">{activeOrg ? (activeOrg.name || 'O').charAt(0).toUpperCase() : <Building2 size={13} />}</span>
          <span className="wn">{activeOrg ? activeOrg.name : 'No organization yet'}</span>
          {activeOrg && <span className="lh-cur-dot" title="Current organization" />}
        </div>
      </div>
      {activeWs && (
        <div className="lh-wswrap" style={{ marginTop: -2 }}>
          <button className="lh-ws" onClick={() => { setWsMenuOpen((v) => !v); setOrgMenuOpen(false) }} title="Switch workspace">
            <span className="wa" style={{ background: 'transparent', border: '1px solid var(--lh-border)', color: 'var(--lh-text3)' }}><Layers size={12} /></span>
            <span className="wn">{activeWs.name}</span>
            <span className="lh-chip">{planInfo.name}</span>
            <ChevronsUpDown size={14} className="cv" />
          </button>
          {wsMenuOpen && (
            <>
              <div className="lh-wsm-ov" onClick={() => setWsMenuOpen(false)} />
              <div className="lh-wsm">
                <div className="lh-wsm-h">{activeOrg ? `Workspaces in ${activeOrg.name}` : 'Workspaces'}</div>
                {wsList.map((w) => (
                  <button key={w.id} className="lh-wsm-i" onClick={() => (w.id === activeWs.id ? setWsMenuOpen(false) : switchWorkspace(w.id))}>
                    <span className="wa" style={{ background: 'transparent', border: '1px solid var(--lh-border)', color: 'var(--lh-text3)' }}><Layers size={12} /></span>
                    <span className="nm">{w.name}</span>
                    {w.id === activeWs.id && <Check size={15} style={{ color: 'var(--lh-accent)', flexShrink: 0 }} />}
                  </button>
                ))}
                <div className="lh-wsm-sep" />
                <button className="lh-wsm-i add" onClick={() => { setWsMenuOpen(false); setModalName(''); setModal('ws') }}>
                  <span className="ic"><Plus size={13} /></span>Create workspace
                </button>
                <button className="lh-wsm-i" onClick={() => { setWsMenuOpen(false); navigate('/workspaces') }}>
                  <span className="wa" style={{ background: 'transparent', border: '1px solid var(--lh-border)', color: 'var(--lh-text3)' }}><Building2 size={12} /></span>Manage workspaces
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <nav className="lh-nav">
        {pins.length > 0 && (() => {
          const open = openSec['pinned'] !== false
          return (
            <div>
              <button className={`lh-sec col ${open ? 'open' : ''}`} onClick={() => toggleSec('pinned')}>
                <Pin size={11} style={{ marginRight: 2 }} /> Pinned
                <svg className="cv" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6"/></svg>
              </button>
              {open && pins.map((p) => {
                const Icon = PIN_ICONS[p.type] || FolderGit2
                return (
                  <Link key={pinKey(p.type, p.id)} to={p.to} onClick={go} className={`lh-item lh-pinrow ${isPathActive(p.to) ? 'active' : ''}`}>
                    <Icon size={16} className="ic" />
                    <span className="lh-pinlabel">{p.label}</span>
                    <span
                      role="button" tabIndex={0} title="Unpin" aria-label={`Unpin ${p.label}`}
                      className="lh-unpin"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePin(p.type, p.id) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); removePin(p.type, p.id) } }}
                    ><X size={13} /></span>
                  </Link>
                )
              })}
            </div>
          )
        })()}
        {SECTIONS.map((s) => {
          const open = openSec[s.key] !== false
          return (
            <div key={s.key}>
              <button className={`lh-sec col ${open ? 'open' : ''}`} onClick={() => toggleSec(s.key)}>
                {s.label}<svg className="cv" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6"/></svg>
              </button>
              {open && s.items.map((i) => (
                <Link key={i.to} to={i.to} onClick={go} className={`lh-item ${isPathActive(i.to) ? 'active' : ''}`}>
                  <i.icon size={16} className="ic" /> {i.label}
                </Link>
              ))}
            </div>
          )
        })}
      </nav>
      <div className="lh-foot">
        <div className="lh-user">
          <span className="lh-ua">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="lh-un">{profile?.full_name || 'My Account'}</div>
            <div className="lh-ue">{user?.email || ''}</div>
          </div>
          <button onClick={() => signOut()} title="Sign out" className="lh-iconbtn" style={{ width: 30, height: 30 }}><LogOut size={14} /></button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="lh-app">
      <style>{CSS}</style>
      <div className="lh-topline" aria-hidden="true" />
      <div className="lh-aurora" aria-hidden="true"><span className="lh-blob b1" /><span className="lh-blob b2" /><span className="lh-blob b3" /></div>
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 lg:block">{Sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed left-0 top-0 z-50 h-screen w-64 transition-transform lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>{Sidebar}</aside>
      <div className="lg:pl-64 lh-shell-body">
        <header className="lh-tb">
          <button onClick={() => setMobileOpen(true)} className="lh-iconbtn lg:hidden"><Menu size={18} /></button>
          <span className="lh-title">{pageTitle}</span>
          <button type="button" className="lh-search hidden md:flex" onClick={() => setPaletteOpen(true)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>Search…<span className="lh-kbd">⌘K</span></button>
          <button className="lh-iconbtn md:hidden" title="Search" onClick={() => setPaletteOpen(true)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></button>
          <div style={{ flex: 1 }} />
          <button className="lh-iconbtn" title="Toggle theme" onClick={toggleTheme}>
            {theme === 'dark'
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
          </button>
          <button className="lh-iconbtn" title="Notifications"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg></button>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8" style={{ color: 'var(--lh-text)' }}>
          <div key={path.split('/').slice(0, 2).join('/')} className="lh-page">
            <PlanContext.Provider value={planId}>{children}</PlanContext.Provider>
          </div>
        </main>
      </div>
      <button className="lh-ai" onClick={() => setAiOpen(true)} title="Ask LytHouse AI">
        <Sparkles size={16} className="sp" /><span className="tx">Ask AI</span>
      </button>
      <AskAiPanel open={aiOpen} onClose={() => setAiOpen(false)} />
      {modal && (
        <div className="lh-orgov" onClick={() => !modalBusy && setModal(null)}>
          <div className="lh-orgm" onClick={(e) => e.stopPropagation()}>
            <h3>{modal === 'org' ? 'Create organization' : 'Create workspace'}</h3>
            <p>{modal === 'org'
              ? 'A new top-level tenant — its own workspaces, projects, team and data. Switch between organizations anytime.'
              : `A workspace inside ${activeOrg?.name || 'your organization'} — group related projects and validations.`}</p>
            <input autoFocus value={modalName} onChange={(e) => setModalName(e.target.value)} placeholder={modal === 'org' ? 'Acme Inc' : 'Platform Team'} onKeyDown={(e) => { if (e.key === 'Enter') createEntity() }} />
            <div className="row">
              <button className="b" onClick={() => setModal(null)} disabled={modalBusy}>Cancel</button>
              <button className="b pri" onClick={createEntity} disabled={modalBusy || !modalName.trim()}>{modalBusy ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignOut={() => signOut()}
      />
    </div>
  )
}
