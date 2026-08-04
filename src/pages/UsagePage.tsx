// @ts-nocheck
import { useEffect, useState } from 'react'
import { supabase, type WorkspacePlan, type PlanId, PLANS } from '../lib/supabase'
import { PageHeader, Spinner } from '../lib/ui'
import { Link } from '../lib/router'
import { FolderGit2, ShieldCheck, Users, Bug, ArrowUpRight, Gauge } from 'lucide-react'

// Real, hard-coded plan limits — mirrors the same numbers already shown on
// the Plans page (FEATURES: '1 project', '5 validations / month' for Free;
// unlimited for Developer/Enterprise). No invented ceilings.
const LIMITS: Record<PlanId, { projects: number | null; validationsPerMonth: number | null; members: number | null }> = {
  free: { projects: 1, validationsPerMonth: 5, members: 3 },
  developer: { projects: null, validationsPerMonth: null, members: null },
  enterprise: { projects: null, validationsPerMonth: null, members: null },
}

const CSS = `
.us-wrap{max-width:1000px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.us-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media(max-width:800px){.us-grid{grid-template-columns:1fr}}
.us-card{background:var(--lh-surface);border:0.5px solid var(--lh-border);border-radius:14px;padding:18px 20px}
.us-top{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:600;color:var(--lh-text2)}
.us-top .ic{color:var(--lh-accent)}
.us-val{display:flex;align-items:baseline;gap:6px;margin-top:10px}
.us-num{font-size:30px;font-weight:700;color:var(--lh-text);letter-spacing:-.03em}
.us-cap{font-size:13px;color:var(--lh-text3);font-weight:500}
.us-bar{height:6px;border-radius:20px;background:var(--lh-border);overflow:hidden;margin-top:12px}
.us-bar i{display:block;height:100%;border-radius:20px;background:var(--lh-accent);transition:width .5s cubic-bezier(.2,.8,.2,1)}
.us-bar i.hot{background:#e5484d}
.us-note{font-size:11.5px;color:var(--lh-text3);margin-top:8px}
.us-plan{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.us-plan-name{font-size:16px;font-weight:700;color:var(--lh-text)}
.us-plan-sub{font-size:12.5px;color:var(--lh-text3);margin-top:2px}
.us-upgrade{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--lh-accent-contrast);background:var(--lh-accent);border-radius:9px;padding:9px 15px;text-decoration:none}
.us-list{display:flex;flex-direction:column}
.us-row{display:flex;align-items:center;justify-content:space-between;padding:11px 20px;border-top:0.5px solid var(--lh-border);font-size:13.5px}
.us-row:first-child{border-top:none}
.us-row .rl{color:var(--lh-text2)}
.us-row .rv{color:var(--lh-text);font-weight:600}
`

function Meter({ label, icon: Icon, used, limit, note }: any) {
  const unlimited = limit == null
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100))
  const hot = !unlimited && pct >= 90
  return (
    <div className="us-card">
      <div className="us-top"><Icon size={15} className="ic" />{label}</div>
      <div className="us-val">
        <span className="us-num">{used}</span>
        <span className="us-cap">{unlimited ? 'unlimited' : `of ${limit}`}</span>
      </div>
      {!unlimited && <div className="us-bar"><i className={hot ? 'hot' : ''} style={{ width: `${pct}%` }} /></div>}
      {note && <div className="us-note">{note}</div>}
    </div>
  )
}

export function UsagePage() {
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<WorkspacePlan | null>(null)
  const [projectCount, setProjectCount] = useState(0)
  const [monthValidations, setMonthValidations] = useState(0)
  const [monthPassed, setMonthPassed] = useState(0)
  const [monthFailed, setMonthFailed] = useState(0)
  const [memberCount, setMemberCount] = useState(0)
  const [openFindings, setOpenFindings] = useState(0)
  const [resolvedThisMonth, setResolvedThisMonth] = useState(0)

  const wsId = () => localStorage.getItem('sandbox.activeWs')

  useEffect(() => {
    (async () => {
      const wid = wsId()
      if (!wid) { setLoading(false); return }
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
      const iso = monthStart.toISOString()
      const [pl, pc, vc, vp, vf, mc, of, rf] = await Promise.all([
        supabase.from('workspace_plans').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }).limit(1),
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('workspace_id', wid),
        supabase.from('validations').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).gte('created_at', iso),
        supabase.from('validations').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'completed').gte('created_at', iso),
        supabase.from('validations').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'failed').gte('created_at', iso),
        supabase.from('workspace_members').select('id', { count: 'exact', head: true }).eq('workspace_id', wid),
        supabase.from('findings').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'open'),
        supabase.from('findings').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'resolved').gte('resolved_at', iso),
      ])
      setPlan(pl.data?.[0] ?? null)
      setProjectCount(pc.count ?? 0)
      setMonthValidations(vc.count ?? 0)
      setMonthPassed(vp.count ?? 0)
      setMonthFailed(vf.count ?? 0)
      setMemberCount(mc.count ?? 0)
      setOpenFindings(of.count ?? 0)
      setResolvedThisMonth(rf.count ?? 0)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>

  const planId: PlanId = (plan?.plan_id as PlanId) ?? 'free'
  const planInfo = PLANS[planId]
  const limits = LIMITS[planId] ?? LIMITS.free
  const monthLabel = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="us-wrap">
      <style>{CSS}</style>
      <PageHeader title="Usage" description={`Real consumption for this workspace against your ${planInfo.name} plan — no estimates.`} />

      <div className="us-card us-plan">
        <div>
          <div className="us-plan-name">{planInfo.name} plan</div>
          <div className="us-plan-sub">Usage shown resets monthly for validations; projects and members are current totals.</div>
        </div>
        {planId === 'free' && (
          <Link to="/plans" className="us-upgrade">Upgrade plan <ArrowUpRight size={14} /></Link>
        )}
      </div>

      <div className="us-grid">
        <Meter label="Projects" icon={FolderGit2} used={projectCount} limit={limits.projects} note={limits.projects != null ? 'Connect via Projects → Import from GitHub.' : undefined} />
        <Meter label={`Validations · ${monthLabel}`} icon={ShieldCheck} used={monthValidations} limit={limits.validationsPerMonth} note={`${monthPassed} completed · ${monthFailed} failed this month`} />
        <Meter label="Team members" icon={Users} used={memberCount} limit={limits.members} note={memberCount > 0 ? undefined : 'Invite teammates from Team.'} />
      </div>

      <div className="us-card" style={{ padding: 0 }}>
        <div style={{ padding: '15px 20px', borderBottom: '0.5px solid var(--lh-border)', fontSize: 15, fontWeight: 600, color: 'var(--lh-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gauge size={15} style={{ color: 'var(--lh-text3)' }} /> Findings snapshot
        </div>
        <div className="us-list">
          <div className="us-row"><span className="rl">Open findings across all projects</span><span className="rv">{openFindings}</span></div>
          <div className="us-row"><span className="rl">Resolved this month</span><span className="rv">{resolvedThisMonth}</span></div>
        </div>
      </div>
    </div>
  )
}
