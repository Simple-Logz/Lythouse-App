// @ts-nocheck
// Real, filterable list of every validation run in the workspace — the
// "Runs" table that was previously only summarized on the Dashboard and
// aggregated in Analytics. Every field shown (status, risk, duration,
// commit, trigger) comes straight off the `validations` row; nothing here
// is invented or simulated.
import { useEffect, useMemo, useState } from 'react'
import { supabase, type Validation } from '../lib/supabase'
import { PageHeader, Spinner, fmtDuration } from '../lib/ui'
import { Link } from '../lib/router'
import {
  GitCommitHorizontal, ChevronDown, X, ListFilter, Calendar,
  ShieldCheck, RefreshCw, GitBranch
} from 'lucide-react'

type Row = Validation & { project_name?: string; project_branch?: string }

const STATUS_OPTS = [
  { id: 'completed', label: 'Completed', tone: 'ok' },
  { id: 'running', label: 'Running', tone: 'warn' },
  { id: 'failed', label: 'Failed', tone: 'bad' },
  { id: 'pending', label: 'Pending', tone: 'off' },
] as const

const RANGE_PRESETS = [
  { id: 'all', label: 'All time', ms: null as number | null },
  { id: '1h', label: 'Last 1 hour', ms: 3600e3 },
  { id: '24h', label: 'Last 24 hours', ms: 86400e3 },
  { id: '7d', label: 'Last 7 days', ms: 7 * 86400e3 },
  { id: '30d', label: 'Last 30 days', ms: 30 * 86400e3 },
  { id: 'custom', label: 'Custom range', ms: null as number | null },
]

const GROUP_OPTS = [
  { id: 'none', label: "Don't group" },
  { id: 'status', label: 'Status' },
  { id: 'project', label: 'Project' },
  { id: 'trigger', label: 'Trigger' },
  { id: 'severity', label: 'Severity' },
]

const CSS = `
.rn-wrap{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.rn-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:14px;padding:12px 14px}
.rn-lbl{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--lh-text3);display:flex;align-items:center;gap:5px;margin-right:-2px}
.rn-chips{display:flex;gap:6px;flex-wrap:wrap}
.rn-chip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;padding:6px 11px;border-radius:20px;border:1px solid var(--lh-border);background:var(--lh-surface2);color:var(--lh-text3);cursor:pointer;transition:.12s;font-family:inherit}
.rn-chip .cd{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.55}
.rn-chip.on{color:var(--c);border-color:color-mix(in srgb,var(--c) 45%,transparent);background:color-mix(in srgb,var(--c) 12%,transparent)}
.rn-chip.on .cd{opacity:1}
.rn-sel{display:flex;align-items:center;gap:6px;position:relative}
.rn-sel select{appearance:none;-webkit-appearance:none;font:inherit;font-size:13px;font-weight:500;color:var(--lh-text);background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:9px;padding:7px 28px 7px 11px;cursor:pointer;max-width:200px}
.rn-sel svg{position:absolute;right:8px;pointer-events:none;color:var(--lh-text3)}
.rn-custom{display:flex;align-items:center;gap:6px}
.rn-custom input{font:inherit;font-size:12.5px;color:var(--lh-text);background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:8px;padding:5px 8px}
.rn-spacer{flex:1}
.rn-clear{font-size:12.5px;font-weight:600;color:var(--lh-text2);background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:inherit}
.rn-clear:hover{color:var(--lh-text)}
.rn-count{font-size:12.5px;color:var(--lh-text3)}
.rn-card{background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:14px;overflow:hidden}
.rn-grp-h{padding:10px 18px;background:var(--lh-surface2);border-bottom:1px solid var(--lh-border);font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--lh-text3);display:flex;align-items:center;justify-content:space-between}
.rn-row{display:grid;grid-template-columns:1.7fr .9fr 1fr .9fr .8fr .9fr;gap:12px;align-items:center;padding:12px 18px;border-top:1px solid var(--lh-border);text-decoration:none;transition:.12s}
.rn-row:first-child{border-top:none}
.rn-row:hover{background:var(--lh-surface2)}
.rn-row.hd{padding:8px 18px;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--lh-text3);border-top:none;cursor:default}
.rn-row.hd:hover{background:none}
@media(max-width:900px){.rn-row{grid-template-columns:1.6fr 1fr .9fr;}.rn-row>*:nth-child(4),.rn-row>*:nth-child(5),.rn-row>*:nth-child(6){display:none}}
.rn-proj{display:flex;flex-direction:column;gap:2px;min-width:0}
.rn-proj .pn{font-size:13.5px;font-weight:600;color:var(--lh-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rn-proj .ps{font-size:11.5px;color:var(--lh-text3);display:flex;align-items:center;gap:4px;font-family:'JetBrains Mono',monospace}
.rn-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:color-mix(in srgb,var(--c) 13%,transparent);color:var(--c);border:1px solid color-mix(in srgb,var(--c) 30%,transparent);width:fit-content}
.rn-pill .pd{width:6px;height:6px;border-radius:50%;background:var(--c)}
.rn-trig{font-size:12.5px;color:var(--lh-text2);text-transform:capitalize}
.rn-dur{font-size:12.5px;color:var(--lh-text2);font-family:'JetBrains Mono',monospace}
.rn-time{font-size:12.5px;color:var(--lh-text3);text-align:right}
.rn-empty{padding:56px 20px;text-align:center;color:var(--lh-text3)}
.rn-empty .ic{width:52px;height:52px;border-radius:14px;background:var(--lh-surface2);border:1px solid var(--lh-border);display:grid;place-items:center;margin:0 auto 14px;color:var(--lh-text3)}
.rn-empty h3{font-size:15px;font-weight:600;color:var(--lh-text);margin-bottom:4px}
.rn-empty p{font-size:13px;max-width:360px;margin:0 auto}
`

function toneFor(status: string) {
  return status === 'completed' ? 'ok' : status === 'running' ? 'warn' : status === 'failed' ? 'bad' : 'off'
}

export function RunsPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])

  const [statusOn, setStatusOn] = useState<Set<string>>(new Set(STATUS_OPTS.map((s) => s.id)))
  const [projectId, setProjectId] = useState('all')
  const [rangeId, setRangeId] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [groupBy, setGroupBy] = useState('none')

  const wsId = () => localStorage.getItem('sandbox.activeWs')

  // Deep-linkable filters — the Dashboard's state tiles link here with
  // ?status=completed (etc.) so clicking "Failed: 3" actually lands you on
  // the filtered list instead of the unfiltered one.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const st = params.get('status')
    if (st && STATUS_OPTS.some((s) => s.id === st)) setStatusOn(new Set([st]))
    const pj = params.get('project')
    if (pj) setProjectId(pj)
  }, [])

  useEffect(() => {
    (async () => {
      const wid = wsId()
      if (!wid) { setLoading(false); return }
      const [vr, pr] = await Promise.all([
        supabase.from('validations').select('*,projects(name,git_branch)').eq('workspace_id', wid).order('created_at', { ascending: false }),
        supabase.from('projects').select('id,name').eq('workspace_id', wid).order('name'),
      ])
      const mapped: Row[] = (vr.data ?? []).map((r: any) => ({
        ...r, project_name: r.projects?.name ?? 'Unknown project', project_branch: r.projects?.git_branch ?? 'main',
      }))
      setRows(mapped)
      setProjects(pr.data ?? [])
      setLoading(false)
    })()
  }, [])

  const toggleStatus = (id: string) => setStatusOn((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const filtersActive = statusOn.size !== STATUS_OPTS.length || projectId !== 'all' || rangeId !== 'all'
  const clearFilters = () => { setStatusOn(new Set(STATUS_OPTS.map((s) => s.id))); setProjectId('all'); setRangeId('all'); setCustomFrom(''); setCustomTo('') }

  const filtered = useMemo(() => {
    const preset = RANGE_PRESETS.find((r) => r.id === rangeId)
    const now = Date.now()
    const fromCustom = customFrom ? new Date(customFrom).getTime() : null
    const toCustom = customTo ? new Date(customTo).getTime() : null
    return rows.filter((r) => {
      if (!statusOn.has(r.status)) return false
      if (projectId !== 'all' && r.project_id !== projectId) return false
      const t = new Date(r.created_at).getTime()
      if (rangeId === 'custom') {
        if (fromCustom !== null && t < fromCustom) return false
        if (toCustom !== null && t > toCustom) return false
      } else if (preset?.ms != null) {
        if (now - t > preset.ms) return false
      }
      return true
    })
  }, [rows, statusOn, projectId, rangeId, customFrom, customTo])

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', rows: filtered }]
    const keyer = (r: Row) => groupBy === 'status' ? (STATUS_OPTS.find((s) => s.id === r.status)?.label ?? r.status)
      : groupBy === 'project' ? r.project_name
      : groupBy === 'trigger' ? (r.trigger || 'manual')
      : (r.severity || 'none')
    const map = new Map<string, Row[]>()
    for (const r of filtered) {
      const k = keyer(r) || 'Unknown'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    return Array.from(map.entries()).map(([key, rows]) => ({ key, rows }))
  }, [filtered, groupBy])

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>

  return (
    <div className="rn-wrap">
      <style>{CSS}</style>
      <PageHeader title="Runs" description="Every validation run across this workspace — filter by project, status, and time, or group them to spot patterns." />

      <div className="rn-bar">
        <span className="rn-lbl"><ListFilter size={12} /> Status</span>
        <div className="rn-chips">
          {STATUS_OPTS.map((s) => (
            <button key={s.id} className={`rn-chip ${statusOn.has(s.id) ? 'on' : ''}`} style={{ '--c': s.tone === 'ok' ? 'var(--lh-accent)' : s.tone === 'warn' ? '#d08a1a' : s.tone === 'bad' ? '#e5484d' : 'var(--lh-text3)' } as any} onClick={() => toggleStatus(s.id)}>
              <span className="cd" />{s.label}
            </button>
          ))}
        </div>

        <span className="rn-lbl">Project</span>
        <label className="rn-sel">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>

        <span className="rn-lbl"><Calendar size={12} /> Date range</span>
        <label className="rn-sel">
          <select value={rangeId} onChange={(e) => setRangeId(e.target.value)}>
            {RANGE_PRESETS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        {rangeId === 'custom' && (
          <div className="rn-custom">
            <input type="datetime-local" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span style={{ color: 'var(--lh-text3)', fontSize: 12 }}>to</span>
            <input type="datetime-local" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}

        <span className="rn-lbl">Group by</span>
        <label className="rn-sel">
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            {GROUP_OPTS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>

        <div className="rn-spacer" />
        {filtersActive && <button className="rn-clear" onClick={clearFilters}><X size={13} /> Clear filters</button>}
        <span className="rn-count">{filtered.length} of {rows.length} run{rows.length !== 1 ? 's' : ''}</span>
      </div>

      {rows.length === 0 ? (
        <div className="rn-card">
          <div className="rn-empty">
            <div className="ic"><ShieldCheck size={22} /></div>
            <h3>No runs yet</h3>
            <p>Validation runs will show up here the moment you trigger one from a project or the dashboard.</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rn-card">
          <div className="rn-empty">
            <div className="ic"><ListFilter size={22} /></div>
            <h3>No runs match these filters</h3>
            <p>Try widening the date range or clearing a filter.</p>
          </div>
        </div>
      ) : (
        <div className="rn-card">
          <div className="rn-row hd">
            <span>Project</span><span>Trigger</span><span>Commit</span><span>Status</span><span>Duration</span><span style={{ textAlign: 'right' }}>Started</span>
          </div>
          {groups.map((g) => (
            <div key={g.key || 'all'}>
              {g.key && (
                <div className="rn-grp-h"><span>{g.key}</span><span>{g.rows.length} run{g.rows.length !== 1 ? 's' : ''}</span></div>
              )}
              {g.rows.map((r) => (
                <Link to={`/projects/${r.project_id}`} key={r.id} className="rn-row">
                  <div className="rn-proj">
                    <span className="pn">{r.project_name}</span>
                    <span className="ps"><GitBranch size={10} />{r.project_branch}</span>
                  </div>
                  <span className="rn-trig">{r.trigger || 'manual'}</span>
                  <span className="rn-trig" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {r.commit_sha ? <><GitCommitHorizontal size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />{r.commit_sha.slice(0, 7)}</> : '—'}
                  </span>
                  <span className={`rn-pill ${toneFor(r.status)}`} style={{ '--c': toneFor(r.status) === 'ok' ? 'var(--lh-accent)' : toneFor(r.status) === 'warn' ? '#d08a1a' : toneFor(r.status) === 'bad' ? '#e5484d' : 'var(--lh-text3)' } as any}>
                    <span className="pd" />{STATUS_OPTS.find((s) => s.id === r.status)?.label ?? r.status}
                  </span>
                  <span className="rn-dur">{r.status === 'running' ? <RefreshCw size={12} className="animate-spin" style={{ display: 'inline' }} /> : fmtDuration(r.duration_ms)}</span>
                  <span className="rn-time">{new Date(r.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
