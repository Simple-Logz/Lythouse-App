// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { supabase, anonKey, edgeFunctionUrl } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Spinner } from '../lib/ui'
import { Link, useRouter } from '../lib/router'
import {
  Check, AlertTriangle, XCircle, Lock, Users, Server, Layers,
  ShieldCheck, ChevronRight, Play, RefreshCw, Loader as Loader2,
  GitBranch, ArrowRight, Clock, Activity, ChevronDown,
  UserPlus, Circle, CheckCircle2, Rocket, BarChart3, Gauge
} from 'lucide-react'

// Deterministic, transparent confidence — from real signals only.
function computeConfidence(latest, critical, high, pendingApprovals, validationsRun) {
  if (!validationsRun || latest?.risk_score == null) return null
  let c = 100 - latest.risk_score
  c -= critical.length * 25
  c -= high.length * 8
  c -= pendingApprovals.length * 6
  return Math.max(5, Math.min(98, Math.round(c)))
}

function timeAgo(iso: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`; return `${d}d ago`
}

const CSS = `
.dv{max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
.dv .ok{--c:var(--lh-accent)}
.dv .warn{--c:#d08a1a}.dv .bad{--c:#e5484d}.dv .off{--c:var(--lh-text3)}
:root[data-theme="dark"] .dv .warn{--c:#e6b23d}:root[data-theme="dark"] .dv .bad{--c:#ff6166}
.dv-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}
.dv-h1{font-size:30px;font-weight:700;letter-spacing:-.025em;color:var(--lh-text);line-height:1.1}
.dv-sub{font-size:14.5px;color:var(--lh-text2);margin-top:6px;max-width:560px;line-height:1.45}
.dv-tools{display:flex;align-items:center;gap:10px;flex-shrink:0}
.dv-sel{position:relative;display:flex;align-items:center}
.dv-sel select{appearance:none;-webkit-appearance:none;font:inherit;font-size:13.5px;font-weight:500;color:var(--lh-text);background:var(--lh-surface);border:0.5px solid var(--lh-border);border-radius:10px;padding:9px 34px 9px 13px;cursor:pointer;max-width:210px}
.dv-sel .cv{position:absolute;right:11px;pointer-events:none;color:var(--lh-text3)}
.dv-run{display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600;color:var(--lh-accent-contrast);background:var(--lh-accent);border:none;border-radius:10px;padding:9px 16px;cursor:pointer;transition:.14s}
.dv-run:hover{filter:brightness(1.05)}.dv-run:active{transform:scale(.97)}.dv-run:disabled{opacity:.6;cursor:default}
.dv-card{background:var(--lh-surface);border:0.5px solid var(--lh-border);border-radius:14px}
.dv-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media(max-width:900px){.dv-kpis{grid-template-columns:repeat(2,1fr)}}
.kpi{padding:18px 20px;display:flex;flex-direction:column;gap:3px;transition:.15s;text-decoration:none}
a.kpi:hover{border-color:var(--lh-border2);transform:translateY(-1px)}
.kpi .kl{font-size:13px;color:var(--lh-text2);font-weight:500}
.kpi .kv{font-size:34px;font-weight:700;letter-spacing:-.03em;color:var(--lh-text);line-height:1.05;margin-top:4px}
.kpi .ks{font-size:12.5px;color:var(--lh-text3);margin-top:2px}
.kpi .ks b{color:var(--c);font-weight:600}
.dv-grid2{display:grid;grid-template-columns:1.55fr 1fr;gap:16px}
@media(max-width:900px){.dv-grid2{grid-template-columns:1fr}}
.rc-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:0.5px solid var(--lh-border)}
.rc-title{font-size:15px;font-weight:600;color:var(--lh-text);display:flex;align-items:center;gap:7px;min-width:0}
.rc-title .mono{font-family:'JetBrains Mono',monospace;font-weight:500;color:var(--lh-text2);font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 11px;border-radius:20px;background:color-mix(in srgb,var(--c) 13%,transparent);color:var(--c);border:1px solid color-mix(in srgb,var(--c) 30%,transparent);flex-shrink:0}
.pill .pd{width:6px;height:6px;border-radius:50%;background:var(--c)}
.rc-body{padding:20px;display:flex;gap:22px;align-items:center}
@media(max-width:520px){.rc-body{flex-direction:column;align-items:flex-start}}
.ring{position:relative;width:104px;height:104px;flex-shrink:0}
.ring .num{position:absolute;inset:0;display:grid;place-items:center;font-size:26px;font-weight:700;color:var(--lh-text);letter-spacing:-.02em}
.checks{display:flex;flex-direction:column;gap:11px;min-width:0}
.chk{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--lh-text)}
.chk .cb{width:20px;height:20px;border-radius:6px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 15%,transparent);color:var(--c);flex-shrink:0}
.rc-meta{display:grid;grid-template-columns:repeat(4,1fr);border-top:0.5px solid var(--lh-border)}
@media(max-width:520px){.rc-meta{grid-template-columns:repeat(2,1fr)}}
.rc-meta .m{padding:14px 20px;border-right:0.5px solid var(--lh-border)}
.rc-meta .m:last-child{border-right:none}
.rc-meta .ml{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--lh-text3)}
.rc-meta .mv{font-size:14px;font-weight:600;color:var(--lh-text);margin-top:3px}
.rc-meta .mv.mono{font-family:'JetBrains Mono',monospace;font-weight:500}
.rc-foot{display:flex;gap:10px;padding:15px 20px;border-top:0.5px solid var(--lh-border)}
.btn-a{display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600;padding:9px 16px;border-radius:10px;cursor:pointer;text-decoration:none;transition:.14s}
.btn-a.pri{background:var(--lh-accent);color:var(--lh-accent-contrast);border:1px solid transparent}
.btn-a.pri:hover{filter:brightness(1.05)}
.btn-a.gho{background:transparent;color:var(--lh-text2);border:0.5px solid var(--lh-border)}
.btn-a.gho:hover{background:var(--lh-surface2);color:var(--lh-text)}
.pos-row{display:flex;align-items:center;gap:13px;padding:13px 18px;border-top:0.5px solid var(--lh-border)}
.pos-row:first-of-type{border-top:none}
.pos-ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 14%,transparent);color:var(--c);flex-shrink:0}
.pos-tx{min-width:0;flex:1}
.pos-tx .pn{font-size:14px;font-weight:600;color:var(--lh-text)}
.pos-tx .ps{font-size:12px;color:var(--lh-text3);margin-top:1px}
.pos-st{font-size:12.5px;font-weight:600;color:var(--c);flex-shrink:0}
.pos-st.mono{font-family:'JetBrains Mono',monospace;font-size:12px}
.sec-h{display:flex;align-items:center;justify-content:space-between;padding:15px 20px;border-bottom:0.5px solid var(--lh-border)}
.sec-h .st{font-size:15px;font-weight:600;color:var(--lh-text)}
.sec-h a{font-size:12.5px;color:var(--lh-text2);text-decoration:none;font-weight:500}
.sec-h a:hover{color:var(--lh-accent)}
.act-row{display:flex;align-items:flex-start;gap:12px;padding:13px 20px;border-top:0.5px solid var(--lh-border)}
.act-row:first-of-type{border-top:none}
.act-dot{width:9px;height:9px;border-radius:50%;background:var(--c);margin-top:5px;flex-shrink:0;box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 18%,transparent)}
.act-tx{flex:1;min-width:0}
.act-tx .al{font-size:13.5px;color:var(--lh-text);line-height:1.35}
.act-tx .at{font-size:11.5px;color:var(--lh-text3);margin-top:1px}
.dv-empty{padding:34px 20px;text-align:center;color:var(--lh-text3);font-size:13.5px}

/* Row of state-summary / mission / team widgets — the "arriving somewhere"
   layer: quantified per-category tiles rather than one flat empty state. */
.dv-grid3{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:16px}
@media(max-width:1000px){.dv-grid3{grid-template-columns:1fr}}
.dv-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:18px 20px}
@media(max-width:480px){.dv-tiles{grid-template-columns:repeat(2,1fr)}}
.dv-tile{border:0.5px solid var(--lh-border);border-radius:11px;padding:12px 13px;display:flex;flex-direction:column;gap:6px;text-decoration:none;transition:.14s}
.dv-tile:hover{border-color:var(--lh-border2);background:var(--lh-surface2)}
.dv-tile .tt{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--lh-text2)}
.dv-tile .td{width:7px;height:7px;border-radius:50%;background:var(--c);flex-shrink:0}
.dv-tile .tv{font-size:24px;font-weight:700;color:var(--lh-text);letter-spacing:-.02em}
.miss{padding:6px 20px 16px}
.miss-bar{height:6px;border-radius:20px;background:var(--lh-border);overflow:hidden;margin:2px 20px 4px}
.miss-bar i{display:block;height:100%;background:var(--lh-accent);border-radius:20px;transition:width .5s cubic-bezier(.2,.8,.2,1)}
.miss-sum{padding:12px 20px 2px;font-size:12.5px;color:var(--lh-text3);display:flex;align-items:center;justify-content:space-between}
.miss-row{display:flex;align-items:center;gap:10px;padding:10px 20px;text-decoration:none;border-top:0.5px solid var(--lh-border);transition:.12s}
.miss-row:first-child{border-top:none}
.miss-row:hover{background:var(--lh-surface2)}
.miss-row .mi{flex-shrink:0;color:var(--lh-text3)}
.miss-row.done .mi{color:#34d399}
.miss-row .ml2{flex:1;font-size:13.5px;color:var(--lh-text);font-weight:500}
.miss-row.done .ml2{color:var(--lh-text3);text-decoration:line-through;text-decoration-color:var(--lh-border2)}
.miss-row .mc{flex-shrink:0;color:var(--lh-text3)}
.team-body{padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.team-count{display:flex;align-items:center;gap:12px}
.team-avs{display:flex}
.team-avs span{width:30px;height:30px;border-radius:50%;background:var(--lh-accent-weak);color:var(--lh-accent);display:grid;place-items:center;font-size:12px;font-weight:700;border:2px solid var(--lh-surface);margin-left:-8px}
.team-avs span:first-child{margin-left:0}
.team-num{font-size:22px;font-weight:700;color:var(--lh-text);letter-spacing:-.02em}
.team-lbl{font-size:12px;color:var(--lh-text3)}
.team-pend{font-size:12.5px;color:var(--lh-text2);display:flex;align-items:center;gap:6px}
`

function Ring({ value }: { value: number | null }) {
  const r = 44, c = 2 * Math.PI * r
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  const off = c * (1 - pct / 100)
  const stroke = value == null ? 'var(--lh-border2)' : pct >= 80 ? 'var(--lh-accent)' : pct >= 55 ? '#d08a1a' : '#e5484d'
  return (
    <div className="ring">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--lh-border)" strokeWidth="8" />
        <circle cx="52" cy="52" r={r} fill="none" stroke={stroke} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 52 52)"
          style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <span className="num">{value == null ? '—' : value}</span>
    </div>
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
  const { navigate } = useRouter()
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [ws, setWs] = useState<any>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [validations, setValidations] = useState<any[]>([])
  const [findings, setFindings] = useState<any[]>([])
  const [approvals, setApprovals] = useState<any[]>([])
  const [connections, setConnections] = useState<any[]>([])
  const [selProj, setSelProj] = useState<string>('')
  const [vCounts, setVCounts] = useState({ completed: 0, running: 0, failed: 0, total: 0 })
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [pendingInviteCount, setPendingInviteCount] = useState(0)
  const [memberInitials, setMemberInitials] = useState<string[]>([])
  const wsId = () => localStorage.getItem('sandbox.activeWs')

  const load = useCallback(async () => {
    const wid = wsId()
    if (!wid) { setLoading(false); return }
    const [wr, pr, vl, fn, ap, ec, vTotal, vDone, vRun, vFail, mem, inv, memRows] = await Promise.all([
      supabase.from('workspaces').select('name').eq('id', wid).single(),
      supabase.from('projects').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }),
      supabase.from('validations').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }).limit(50),
      supabase.from('findings').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }),
      supabase.from('release_approvals').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }).limit(10),
      supabase.from('environment_connections').select('*').eq('workspace_id', wid),
      // Real, un-truncated counts — separate from the 50-row sample above so
      // the state tiles reflect the whole workspace, not just recent runs.
      supabase.from('validations').select('id', { count: 'exact', head: true }).eq('workspace_id', wid),
      supabase.from('validations').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'completed'),
      supabase.from('validations').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'running'),
      supabase.from('validations').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'failed'),
      supabase.from('workspace_members').select('id', { count: 'exact', head: true }).eq('workspace_id', wid),
      supabase.from('workspace_invitations').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'pending'),
      supabase.from('workspace_members').select('user_id').eq('workspace_id', wid).order('created_at', { ascending: true }).limit(4),
    ])
    setWs(wr.data)
    setProjects(pr.data ?? [])
    setValidations(vl.data ?? [])
    setFindings(fn.data ?? [])
    setApprovals(ap.data ?? [])
    setConnections(ec.data ?? [])
    setVCounts({ total: vTotal.count ?? 0, completed: vDone.count ?? 0, running: vRun.count ?? 0, failed: vFail.count ?? 0 })
    setMemberCount(mem.count ?? null)
    setPendingInviteCount(inv.count ?? 0)
    // Real initials for the team widget — no placeholder A/B/C/D letters.
    const memberIds = (memRows.data ?? []).map((m: any) => m.user_id).filter(Boolean)
    if (memberIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id,full_name,email').in('id', memberIds)
      const byId = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]))
      setMemberInitials(memberIds.map((id: string) => {
        const p = byId[id]
        const name = p?.full_name?.trim() || p?.email || ''
        return name ? name.charAt(0).toUpperCase() : '?'
      }))
    } else {
      setMemberInitials([])
    }
    setSelProj((p) => p || (pr.data?.[0]?.id ?? ''))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const runValidation = async () => {
    const proj = projects.find((p) => p.id === selProj) || projects[0]
    if (!proj || running) return
    setRunning(true)
    const wid = wsId()
    const { data: v } = await supabase.from('validations').insert({
      project_id: proj.id, workspace_id: wid, status: 'running', trigger: 'manual',
    }).select().single()
    if (v) {
      try {
        await fetch(`${edgeFunctionUrl}/process-validation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}`, apikey: anonKey },
          body: JSON.stringify({ validationId: v.id, projectId: proj.id, gitUrl: proj.git_url, branch: proj.git_branch || 'main', githubToken: proj.github_token || null }),
        })
      } catch {}
    }
    await load()
    setRunning(false)
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>

  // ─── Real-data computed values ──────────────────────────────────────────
  const cat = (re: RegExp) => (f: any) => re.test(`${f.category || ''} ${f.title || ''}`)
  const open = findings.filter((f) => f.status === 'open')
  const critical = open.filter((f) => f.severity === 'critical')
  const high = open.filter((f) => f.severity === 'high')
  const latest = validations.find((v) => v.status === 'completed')
  const pendingApprovals = approvals.filter((a) => a.status === 'pending')
  const rejected = approvals.filter((a) => a.status === 'rejected')
  const connected = connections.filter((c) => c.status === 'connected')
  const featured = projects.find((p) => p.id === selProj) || projects[0] || null
  const confidence = computeConfidence(latest, critical, high, pendingApprovals, validations.length)
  const riskScore = latest?.risk_score ?? null
  const readiness = riskScore !== null ? Math.max(0, 100 - riskScore) : null
  const isBlocked = critical.length > 0
  const approvedRoles = featured
    ? (approvals.find((a) => a.project_id === featured.id)?.approvals || [])
    : []
  const featApproval = featured ? approvals.find((a) => a.project_id === featured.id) : null
  const totalRoles = 3
  const approvedCount = new Set((featApproval?.approvals || []).map((a: any) => a.role)).size
  const deployGated = isBlocked || (riskScore !== null && readiness < 60)
  const waitingSignoffs = pendingApprovals.reduce((n, a) => n + Math.max(0, totalRoles - new Set((a.approvals || []).map((x: any) => x.role)).size), 0)

  const riskLabel = riskScore === null ? '—' : riskScore < 40 ? 'Low' : riskScore < 70 ? 'Medium' : 'High'

  // KPI cards (all real)
  const kpis = [
    {
      label: 'Releases pending decision', value: pendingApprovals.length,
      parts: pendingApprovals.length === 0 && rejected.length === 0
        ? [{ t: 'All decisions made', tone: 'off' }]
        : [rejected.length ? { t: `${rejected.length} blocked`, tone: 'bad' } : null, pendingApprovals.length ? { t: `${pendingApprovals.length} need review`, tone: 'warn' } : null].filter(Boolean),
      to: '/approvals',
    },
    {
      label: 'Open findings', value: open.length,
      parts: open.length === 0
        ? [{ t: 'All clear', tone: 'ok' }]
        : [critical.length ? { t: `${critical.length} critical`, tone: 'bad' } : null, high.length ? { t: `${high.length} high`, tone: 'warn' } : null, (!critical.length && !high.length) ? { t: `${open.length} to review`, tone: 'off' } : null].filter(Boolean),
      to: '/findings',
    },
    {
      label: 'Environments validated', value: `${connected.length}/${connections.length || 0}`,
      parts: connections.length === 0
        ? [{ t: 'None connected yet', tone: 'off' }]
        : connected.length < connections.length
          ? [{ t: `${(connections.find((c) => c.status !== 'connected')?.source || 'One')} not connected`, tone: 'warn' }]
          : [{ t: 'All connected', tone: 'ok' }],
      to: '/environment',
    },
    {
      label: 'Approvals waiting', value: waitingSignoffs,
      parts: waitingSignoffs === 0 ? [{ t: 'Nothing waiting', tone: 'off' }] : [{ t: 'sign-offs needed', tone: 'warn' }],
      to: '/approvals',
    },
  ]

  // Release status pill
  const status = projects.length === 0 ? { t: 'No project', tone: 'off' }
    : validations.length === 0 ? { t: 'Not validated', tone: 'off' }
      : isBlocked ? { t: 'Blocked', tone: 'bad' }
        : deployGated ? { t: 'Review', tone: 'warn' }
          : readiness !== null && readiness >= 80 ? { t: 'Deploy now', tone: 'ok' }
            : { t: 'Review', tone: 'warn' }

  const checks = [
    { ok: critical.length === 0, on: 'All blockers cleared', off: `${critical.length} blocker${critical.length !== 1 ? 's' : ''} to resolve` },
    { ok: approvedCount >= totalRoles, on: `${approvedCount} of ${totalRoles} approvals in`, off: `${approvedCount} of ${totalRoles} approvals in` },
    { ok: !deployGated, on: 'Production gate satisfied', off: 'Production gate not satisfied' },
  ]

  // Environment posture — derived from real finding categories + connections
  const kubeConn = connected.some((c) => (c.source || '').includes('kubernetes'))
  const secretF = open.filter(cat(/secret|credential|token|password/i))
  const iamF = open.filter(cat(/iam|permission|policy|access|role|privilege/i))
  const serverF = open.filter(cat(/server|host|os|patch|hardening/i))
  const certF = open.filter(cat(/cert|tls|ssl|expir/i))
  const postureRows = [
    { icon: Lock, name: 'Secrets', ok: secretF.length === 0, sub: secretF.length ? `${secretF.length} to rotate` : 'No exposed secrets', st: secretF.length ? 'Review' : 'Clean' },
    { icon: Users, name: 'IAM', ok: iamF.length === 0, sub: iamF.length ? `${iamF.length} policy issue${iamF.length !== 1 ? 's' : ''}` : 'Least-privilege', st: iamF.length ? 'Review' : 'Clean' },
    { icon: Layers, name: 'Kubernetes', ok: kubeConn, off: !kubeConn, sub: kubeConn ? 'Connected · monitoring' : 'Not connected', st: kubeConn ? 'Healthy' : 'Not connected' },
    { icon: Server, name: 'Servers', ok: serverF.length === 0, sub: serverF.length ? `${serverF.length} to patch` : 'Baseline applied', st: serverF.length ? 'Review' : 'Hardened' },
    { icon: ShieldCheck, name: 'Certificates', ok: certF.length === 0, sub: certF.length ? `${certF.length} expiring` : 'None expiring', st: certF.length ? 'Review' : 'Valid' },
  ]
  const postureFindings = secretF.length + iamF.length + serverF.length + certF.length

  // Recent activity — real events
  const activity = [
    ...validations.slice(0, 6).map((v) => ({
      time: v.created_at,
      label: v.status === 'completed' ? `Validation completed — ${v.total_findings ?? 0} findings, risk ${v.risk_score ?? '—'}/100` : `Validation ${v.status}`,
      tone: v.status === 'completed' && (v.critical_count ?? 0) === 0 ? 'ok' : (v.critical_count ?? 0) > 0 ? 'bad' : 'warn',
    })),
    ...findings.filter((f) => f.status === 'resolved' && f.resolved_at).slice(0, 4).map((f) => ({ time: f.resolved_at, label: `Resolved — ${f.title}`, tone: 'ok' })),
    ...approvals.flatMap((a) => (a.approvals || []).map((ap: any) => ({ time: ap.approved_at, label: `${ap.approver_name || 'A team member'} approved as ${ap.role}`, tone: 'ok' }))),
  ].filter((e) => e.time).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6)

  const wsName = ws?.name || 'your workspace'

  // Getting-started missions — every step reflects a real, checkable fact
  // about this workspace (no fabricated timers or progress percentages).
  const missions = [
    { label: 'Connect your first project', done: projects.length > 0, to: '/projects', icon: GitBranch },
    { label: 'Run your first validation', done: vCounts.total > 0, to: '/projects', icon: Rocket },
    { label: 'Connect an environment', done: connections.length > 0, to: '/environment', icon: Server },
    { label: 'Invite a teammate', done: (memberCount ?? 0) > 1, to: '/team', icon: UserPlus },
  ]
  const missionsDone = missions.filter((m) => m.done).length

  // Validation-run state tiles — mirrors the "which of my runs need me"
  // pattern, driven entirely by real counts fetched above.
  const vOther = Math.max(0, vCounts.total - vCounts.completed - vCounts.running - vCounts.failed)
  const vTiles = [
    { label: 'Completed', value: vCounts.completed, tone: 'ok', to: '/runs?status=completed' },
    { label: 'Running', value: vCounts.running, tone: 'warn', to: '/runs?status=running' },
    { label: 'Failed', value: vCounts.failed, tone: 'bad', to: '/runs?status=failed' },
    { label: 'Other', value: vOther, tone: 'off', to: '/runs' },
  ]

  return (
    <div className="dv">
      <style>{CSS}</style>

      {/* Header */}
      <div className="dv-head">
        <div>
          <h1 className="dv-h1">Overview</h1>
          <p className="dv-sub">Release health across {wsName}. Everything you need to answer: can we ship?</p>
        </div>
        <div className="dv-tools">
          {projects.length > 0 && (
            <label className="dv-sel">
              <select value={selProj} onChange={(e) => setSelProj(e.target.value)}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <ChevronDown size={15} className="cv" />
            </label>
          )}
          <button className="dv-run" onClick={runValidation} disabled={running || projects.length === 0}>
            {running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {running ? 'Validating…' : 'Run validation'}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="dv-kpis">
        {kpis.map((k) => (
          <Link to={k.to} key={k.label} className="dv-card kpi">
            <span className="kl">{k.label}</span>
            <span className="kv">{k.value}</span>
            <span className="ks">
              {k.parts.map((p: any, i: number) => (
                <span key={i} className={p.tone}>{i > 0 && ' · '}<b>{p.t}</b></span>
              ))}
            </span>
          </Link>
        ))}
      </div>

      {/* Validation runs / Getting started / Team — real state, quantified */}
      <div className="dv-grid3">
        <div className="dv-card">
          <div className="rc-top">
            <div className="rc-title"><BarChart3 size={15} style={{ color: 'var(--lh-text3)' }} /> Validation runs</div>
            <Link to="/runs" style={{ fontSize: 12.5, color: 'var(--lh-text2)', fontWeight: 500, textDecoration: 'none' }}>View all runs</Link>
          </div>
          {vCounts.total === 0 ? (
            <div className="dv-empty">No validations run yet. They'll appear here the moment you run one.</div>
          ) : (
            <div className="dv-tiles">
              {vTiles.map((t) => (
                <Link to={t.to} key={t.label} className={`dv-tile ${t.tone}`}>
                  <span className="tt"><span className="td" />{t.label}</span>
                  <span className="tv">{t.value}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="dv-card">
          <div className="rc-top">
            <div className="rc-title"><Gauge size={15} style={{ color: 'var(--lh-text3)' }} /> Getting started</div>
          </div>
          <div className="miss-sum"><span>{missionsDone} of {missions.length} complete</span></div>
          <div className="miss-bar"><i style={{ width: `${(missionsDone / missions.length) * 100}%` }} /></div>
          <div className="miss">
            {missions.map((m) => (
              <Link to={m.to} key={m.label} className={`miss-row ${m.done ? 'done' : ''}`}>
                <span className="mi">{m.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}</span>
                <span className="ml2">{m.label}</span>
                {!m.done && <ChevronRight size={14} className="mc" />}
              </Link>
            ))}
          </div>
        </div>

        <div className="dv-card">
          <div className="rc-top">
            <div className="rc-title"><Users size={15} style={{ color: 'var(--lh-text3)' }} /> Team &amp; access</div>
          </div>
          <div className="team-body">
            <div className="team-count">
              <div className="team-avs">
                {memberInitials.map((ch, i) => <span key={i}>{ch}</span>)}
              </div>
              <div>
                <div className="team-num">{memberCount ?? 0}</div>
                <div className="team-lbl">{memberCount === 1 ? 'member' : 'members'} in {wsName}</div>
              </div>
            </div>
            {pendingInviteCount > 0 && (
              <div className="team-pend"><Clock size={13} /> {pendingInviteCount} pending invitation{pendingInviteCount !== 1 ? 's' : ''}</div>
            )}
            <Link to="/team" className="btn-a pri" style={{ justifyContent: 'center' }}><UserPlus size={14} /> Invite teammate</Link>
          </div>
        </div>
      </div>

      {/* Latest release + Environment posture */}
      <div className="dv-grid2">
        {/* Latest release */}
        <div className="dv-card">
          <div className="rc-top">
            <div className="rc-title">
              Latest release <span className="mono">· {featured ? featured.name : 'no project'}</span>
            </div>
            <span className={`pill ${status.tone}`}>{status.tone === 'ok' && <span className="pd" />}{status.t}</span>
          </div>
          {featured ? (
            <>
              <div className="rc-body">
                <Ring value={confidence} />
                <div className="checks">
                  {checks.map((c, i) => (
                    <div className={`chk ${c.ok ? 'ok' : 'warn'}`} key={i}>
                      <span className="cb">{c.ok ? <Check size={13} /> : <AlertTriangle size={12} />}</span>
                      {c.ok ? c.on : c.off}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rc-meta">
                <div className="m"><div className="ml">Environment</div><div className="mv">Production</div></div>
                <div className="m"><div className="ml">Risk</div><div className="mv">{riskLabel}{riskScore !== null ? ` · ${riskScore}` : ''}</div></div>
                <div className="m"><div className="ml">Branch</div><div className="mv mono">{featured.git_branch || 'main'}</div></div>
                <div className="m"><div className="ml">Owner</div><div className="mv">{featured.owner || 'Platform'}</div></div>
              </div>
              <div className="rc-foot">
                <Link to={`/projects/${featured.id}`} className="btn-a pri">Open release <ChevronRight size={15} /></Link>
                <Link to="/findings" className="btn-a gho">View findings</Link>
              </div>
            </>
          ) : (
            <div className="dv-empty">
              No projects yet. <Link to="/projects" style={{ color: 'var(--lh-accent)', fontWeight: 600 }}>Connect a repository</Link> to start validating releases.
            </div>
          )}
        </div>

        {/* Environment posture */}
        <div className="dv-card">
          <div className="rc-top">
            <div className="rc-title">Environment posture</div>
            <span className={`pill ${postureFindings ? 'warn' : 'ok'}`}>{postureFindings ? `${postureFindings} finding${postureFindings !== 1 ? 's' : ''}` : 'All clear'}</span>
          </div>
          {postureRows.map((r) => (
            <div className={`pos-row ${r.off ? 'off' : r.ok ? 'ok' : 'warn'}`} key={r.name}>
              <span className="pos-ic">{r.off ? <r.icon size={15} /> : r.ok ? <Check size={15} /> : <AlertTriangle size={14} />}</span>
              <div className="pos-tx"><div className="pn">{r.name}</div><div className="ps">{r.sub}</div></div>
              <span className="pos-st mono">{r.st}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="dv-card">
        <div className="sec-h"><span className="st">Recent activity</span><Link to="/audit">View all</Link></div>
        {activity.length === 0 ? (
          <div className="dv-empty">No activity yet. Run a validation to see events here.</div>
        ) : activity.map((e, i) => (
          <div className={`act-row ${e.tone}`} key={i}>
            <span className="act-dot" />
            <div className="act-tx"><div className="al">{e.label}</div><div className="at">{timeAgo(e.time)}</div></div>
          </div>
        ))}
      </div>
    </div>
  )
}
