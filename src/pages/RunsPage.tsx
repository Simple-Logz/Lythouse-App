// @ts-nocheck
// Real, filterable list of every validation run in the workspace — the
// "Runs" table that was previously only summarized on the Dashboard and
// aggregated in Analytics. Every field shown (status, risk, duration,
// commit, trigger) comes straight off the `validations` row; nothing here
// is invented or simulated.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase, type Validation } from '../lib/supabase'
import { PageHeader, Spinner, fmtDuration } from '../lib/ui'
import { Link } from '../lib/router'
import {
  GitCommitHorizontal, ChevronDown, X, ListFilter, Calendar,
  ShieldCheck, RefreshCw, GitBranch, ChevronLeft, ChevronRight
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
/* Same ink-black border color as the rest of the app (--lh-border, set in
   AppShell), at the normal 1px weight everything else uses — the previous
   1.5px was heavier than intended. */
.rn-bar{display:flex;flex-wrap:wrap;align-items:center;gap:11px;background:var(--lh-surface);border:0.5px solid var(--lh-border);border-radius:14px;padding:13px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.rn-lbl{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lh-text);display:flex;align-items:center;gap:5px;margin-right:-2px}
.rn-lbl svg{color:var(--lh-text2)}
.rn-chips{display:flex;gap:6px;flex-wrap:wrap}
.rn-chip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;padding:6px 12px;border-radius:20px;border:0.5px solid var(--lh-border);background:var(--lh-surface);color:var(--lh-text2);cursor:pointer;transition:.12s;font-family:inherit}
.rn-chip .cd{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.55}
.rn-chip.on{color:var(--c);border-color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}
.rn-chip.on .cd{opacity:1}
.rn-sel{display:flex;align-items:center;gap:6px;position:relative}
.rn-sel select{appearance:none;-webkit-appearance:none;font:inherit;font-size:13px;font-weight:600;color:var(--lh-text);background:var(--lh-surface);border:0.5px solid var(--lh-border);border-radius:9px;padding:7px 28px 7px 11px;cursor:pointer;max-width:200px}
.rn-sel svg{position:absolute;right:8px;pointer-events:none;color:var(--lh-text2)}
/* Single-calendar range picker — replaces the old two-native-datetime-input
   layout ("mm/dd/yyyy to mm/dd/yyyy" as two separate pickers). One popover,
   one month grid, click a start day then an end day to select the range. */
.rn-custom-trig{display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12.5px;font-weight:600;color:var(--lh-text);background:var(--lh-surface);border:0.5px solid var(--lh-border);border-radius:9px;padding:7px 11px;cursor:pointer}
.rn-custom-trig:hover{border-color:var(--lh-border2)}
.rn-cal-wrap{position:relative}
/* z-index above AppShell's floating "Ask AI" button (.lh-ai, z-index:60) —
   the popover previously sat at z-index:40, so on shorter viewports where
   its bottom edge landed near the bottom-right corner, the Ask AI button
   rendered on top of it, visually slicing off the Apply/Clear row. The
   overlay goes just under the popover so an outside click over the Ask AI
   button's spot simply closes the calendar instead of also opening the AI
   panel underneath. */
.rn-cal-ov{position:fixed;inset:0;z-index:61}
/* position:fixed + top/left set in JS (clamped to the viewport against the
   trigger's real bounding rect) instead of position:absolute anchored to
   the trigger — a plain absolute popover could get sliced off by an
   ancestor's overflow or simply render past the edge of a narrow viewport.
   transition is just a quick fade-in once JS has placed it; it starts
   opacity:0 off-screen for one frame while it measures itself. */
.rn-cal-pop{position:fixed;z-index:62;background:var(--lh-surface);border:0.5px solid var(--lh-border);border-radius:14px;box-shadow:0 22px 54px -18px rgba(4,8,14,.35);padding:14px;width:296px;transition:opacity .1s ease-out}
.rn-cal-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.rn-cal-hd .mo{font-size:13.5px;font-weight:700;color:var(--lh-text)}
.rn-cal-hd button{display:grid;place-items:center;width:26px;height:26px;border-radius:7px;border:none;background:none;color:var(--lh-text2);cursor:pointer}
.rn-cal-hd button:hover{background:var(--lh-surface2);color:var(--lh-text)}
.rn-cal-wd{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px}
.rn-cal-wd span{font-size:10.5px;font-weight:700;color:var(--lh-text3);text-align:center;padding:4px 0}
.rn-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.rn-cal-day{position:relative;aspect-ratio:1;display:grid;place-items:center;font-size:12.5px;font-weight:500;color:var(--lh-text);background:none;border:none;border-radius:8px;cursor:pointer;font-family:inherit}
.rn-cal-day:hover{background:var(--lh-surface2)}
.rn-cal-day.empty{cursor:default;visibility:hidden}
.rn-cal-day.inrange{background:var(--lh-accent-weak);border-radius:0}
.rn-cal-day.start{background:var(--lh-accent);color:var(--lh-accent-contrast);border-radius:8px 0 0 8px}
.rn-cal-day.end{background:var(--lh-accent);color:var(--lh-accent-contrast);border-radius:0 8px 8px 0}
.rn-cal-day.start.end{border-radius:8px}
.rn-cal-times{display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:0.5px solid var(--lh-border)}
.rn-cal-times .fld{flex:1;display:flex;flex-direction:column;gap:3px}
.rn-cal-times label{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--lh-text3)}
.rn-cal-times input{font:inherit;font-size:12.5px;color:var(--lh-text);background:var(--lh-surface2);border:0.5px solid var(--lh-border);border-radius:7px;padding:5px 7px;width:100%}
.rn-cal-ft{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px}
.rn-cal-ft button{font:inherit;font-size:12.5px;font-weight:700;border-radius:8px;padding:7px 12px;cursor:pointer;border:none}
.rn-cal-ft .clr{background:none;color:var(--lh-text2)}
.rn-cal-ft .clr:hover{color:var(--lh-text)}
.rn-cal-ft .app{background:var(--lh-accent);color:var(--lh-accent-contrast)}
.rn-cal-ft .app:disabled{opacity:.5;cursor:default}
.rn-spacer{flex:1}
.rn-clear{font-size:12.5px;font-weight:700;color:var(--lh-text);background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:inherit}
.rn-clear:hover{color:var(--lh-accent)}
.rn-count{font-size:12.5px;font-weight:600;color:var(--lh-text2)}
.rn-card{background:var(--lh-surface);border:0.5px solid var(--lh-border);border-radius:14px;overflow:hidden}
.rn-grp-h{padding:10px 18px;background:var(--lh-surface2);border-bottom:0.5px solid var(--lh-border);font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--lh-text3);display:flex;align-items:center;justify-content:space-between}
.rn-row{display:grid;grid-template-columns:1.7fr .9fr 1fr .9fr .8fr .9fr;gap:12px;align-items:center;padding:12px 18px;border-top:0.5px solid var(--lh-border);text-decoration:none;transition:.12s}
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
.rn-empty .ic{width:52px;height:52px;border-radius:14px;background:var(--lh-surface2);border:0.5px solid var(--lh-border);display:grid;place-items:center;margin:0 auto 14px;color:var(--lh-text3)}
.rn-empty h3{font-size:15px;font-weight:600;color:var(--lh-text);margin-bottom:4px}
.rn-empty p{font-size:13px;max-width:360px;margin:0 auto}
`

function toneFor(status: string) {
  return status === 'completed' ? 'ok' : status === 'running' ? 'warn' : status === 'failed' ? 'bad' : 'off'
}
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const fmtDateLabel = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// One month grid, click a start day then an end day to select a range —
// replaces the previous two-separate-native-datetime-input layout.
// Positioned as position:fixed and placed in JS against the trigger's real
// on-screen rect (measured after mount, then clamped to the viewport) so it
// always renders fully on-screen — it no longer depends on a parent's
// overflow/scroll behavior and can't get sliced off on narrow screens the
// way a plain CSS-anchored `position:absolute` popover was.
function DateRangeCalendar({ from, to, anchor, onApply, onClose }: { from: string; to: string; anchor: DOMRect | null; onApply: (from: string, to: string) => void; onClose: () => void }) {
  const initFrom = from ? startOfDay(new Date(from)) : null
  const initTo = to ? startOfDay(new Date(to)) : null
  const [viewMonth, setViewMonth] = useState(() => initFrom || new Date())
  const [pendingFrom, setPendingFrom] = useState<Date | null>(initFrom)
  const [pendingTo, setPendingTo] = useState<Date | null>(initTo)
  const [fromTime, setFromTime] = useState(() => from ? new Date(from).toTimeString().slice(0, 5) : '00:00')
  const [toTime, setToTime] = useState(() => to ? new Date(to).toTimeString().slice(0, 5) : '23:59')
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; visible: boolean }>({ top: -9999, left: -9999, visible: false })

  useLayoutEffect(() => {
    const pad = 12
    const el = popRef.current
    const w = el?.offsetWidth ?? 296
    const h = el?.offsetHeight ?? 420
    const a = anchor
    let left = a ? a.left : pad
    let top = a ? a.bottom + 8 : pad
    if (left + w > window.innerWidth - pad) left = window.innerWidth - w - pad
    if (left < pad) left = pad
    if (a && top + h > window.innerHeight - pad) {
      const above = a.top - h - 8
      top = above >= pad ? above : Math.max(pad, window.innerHeight - h - pad)
    }
    setPos({ top, left, visible: true })
  }, [anchor])

  const year = viewMonth.getFullYear(), month = viewMonth.getMonth()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const startPad = new Date(year, month, 1).getDay()
  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)]

  const pickDay = (d: number | null) => {
    if (!d) return
    const picked = new Date(year, month, d)
    if (!pendingFrom || pendingTo || picked < pendingFrom) { setPendingFrom(picked); setPendingTo(null) }
    else { setPendingTo(picked) }
  }

  const apply = () => {
    if (!pendingFrom) return
    const [fh, fm] = fromTime.split(':').map(Number)
    const from2 = new Date(pendingFrom); from2.setHours(fh || 0, fm || 0, 0, 0)
    const [th, tm] = toTime.split(':').map(Number)
    const to2 = new Date(pendingTo || pendingFrom); to2.setHours(th ?? 23, tm ?? 59, 59, 999)
    onApply(from2.toISOString(), to2.toISOString())
  }

  // Rendered via a portal straight onto document.body — not just fixed
  // positioning. AppShell wraps all page content in `.lh-shell-body`, which
  // sets `position:relative;z-index:1`, creating its own stacking context.
  // Inside that context no z-index (even 62) can ever outrank a sibling
  // like the floating Ask AI button (z-index:60) that lives outside it —
  // the whole `.lh-shell-body` subtree is capped at z-index:1 from the
  // browser's perspective. Portaling out of that subtree entirely is what
  // actually fixes it, not raising the number further.
  return createPortal(
    <>
      <div className="rn-cal-ov" onClick={onClose} />
      <div
        ref={popRef}
        className="rn-cal-pop"
        style={{ top: pos.top, left: pos.left, opacity: pos.visible ? 1 : 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rn-cal-hd">
          <button onClick={() => setViewMonth(new Date(year, month - 1, 1))}><ChevronLeft size={15} /></button>
          <span className="mo">{viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setViewMonth(new Date(year, month + 1, 1))}><ChevronRight size={15} /></button>
        </div>
        <div className="rn-cal-wd">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="rn-cal-grid">
          {cells.map((d, i) => {
            if (!d) return <button key={i} className="rn-cal-day empty" disabled />
            const cellDate = new Date(year, month, d)
            const isStart = sameDay(cellDate, pendingFrom)
            const isEnd = sameDay(cellDate, pendingTo)
            const inRange = !!pendingFrom && !!pendingTo && cellDate > pendingFrom && cellDate < pendingTo
            return (
              <button key={i} className={`rn-cal-day ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${inRange ? 'inrange' : ''}`} onClick={() => pickDay(d)}>{d}</button>
            )
          })}
        </div>
        <div className="rn-cal-times">
          <div className="fld"><label>From time</label><input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} /></div>
          <div className="fld"><label>To time</label><input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} /></div>
        </div>
        <div className="rn-cal-ft">
          <button className="clr" onClick={() => { setPendingFrom(null); setPendingTo(null) }}>Clear</button>
          <button className="app" disabled={!pendingFrom} onClick={apply}>Apply range</button>
        </div>
      </div>
    </>,
    document.body
  )
}
// 'off' used to reuse the same pale grey as the unselected-chip state, which
// made the Pending chip's selected/unselected look nearly identical. Bold
// near-black instead — distinct, and matches the toolbar's new ink-black
// border treatment.
function colorForTone(tone: string) {
  return tone === 'ok' ? 'var(--lh-accent)' : tone === 'warn' ? '#d08a1a' : tone === 'bad' ? '#e5484d' : 'var(--lh-text)'
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
  const [calOpen, setCalOpen] = useState(false)
  const [calAnchor, setCalAnchor] = useState<DOMRect | null>(null)
  const calTrigRef = useRef<HTMLButtonElement>(null)
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
  const clearFilters = () => { setStatusOn(new Set(STATUS_OPTS.map((s) => s.id))); setProjectId('all'); setRangeId('all'); setCustomFrom(''); setCustomTo(''); setCalOpen(false) }

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
            <button key={s.id} className={`rn-chip ${statusOn.has(s.id) ? 'on' : ''}`} style={{ '--c': colorForTone(s.tone) } as any} onClick={() => toggleStatus(s.id)}>
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
          <div className="rn-cal-wrap">
            <button
              type="button"
              ref={calTrigRef}
              className="rn-custom-trig"
              onClick={() => { setCalAnchor(calTrigRef.current?.getBoundingClientRect() ?? null); setCalOpen((v) => !v) }}
            >
              <Calendar size={13} />
              {customFrom && customTo ? `${fmtDateLabel(new Date(customFrom))} – ${fmtDateLabel(new Date(customTo))}` : 'Select dates'}
              <ChevronDown size={13} />
            </button>
            {calOpen && (
              <DateRangeCalendar
                from={customFrom}
                to={customTo}
                anchor={calAnchor}
                onApply={(f, t) => { setCustomFrom(f); setCustomTo(t); setCalOpen(false) }}
                onClose={() => setCalOpen(false)}
              />
            )}
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
                  <span className={`rn-pill ${toneFor(r.status)}`} style={{ '--c': colorForTone(toneFor(r.status)) } as any}>
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
