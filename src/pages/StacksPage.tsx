// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from '../lib/ui'
import { Layers, Plus, X, Check, RefreshCw, GitBranch } from 'lucide-react'
import { PinButton } from '../lib/pins'

// Stacks — group related projects and validate them together. Persisted per
// workspace in local storage for now (survives reloads); can move to a
// Supabase table later without changing this UI.
const CSS = `
.stk{max-width:1100px;margin:0 auto}
.stk-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.stk h1{font-size:29px;font-weight:700;letter-spacing:-.025em;color:var(--lh-text)}
.stk .sub{font-size:14.5px;color:var(--lh-text2);margin-top:6px;max-width:600px}
.stk-card{background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:14px}
.stk-btn{display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600;padding:9px 15px;border-radius:10px;border:1px solid transparent;cursor:pointer;transition:.13s;font-family:inherit}
.stk-btn.pri{background:var(--lh-accent);color:var(--lh-accent-contrast)}
.stk-btn.pri:hover{filter:brightness(1.06)}
.stk-btn.gho{background:transparent;color:var(--lh-text2);border-color:var(--lh-border)}
.stk-btn.gho:hover{background:var(--lh-surface2);color:var(--lh-text)}
.stk-row{display:flex;align-items:center;gap:14px;padding:15px 18px;border-top:1px solid var(--lh-border)}
.stk-row:first-child{border-top:none}
.stk-ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,var(--c,var(--lh-accent)) 14%,transparent);color:var(--c,var(--lh-accent));flex-shrink:0}
.stk-n{font-size:14.5px;font-weight:600;color:var(--lh-text)}
.stk-s{font-size:12px;color:var(--lh-text3);margin-top:2px}
.stk-pill{display:inline-flex;align-items:center;font-size:12px;font-weight:600;padding:4px 11px;border-radius:20px;background:color-mix(in srgb,var(--c,var(--lh-accent)) 13%,transparent);color:var(--c,var(--lh-accent));border:1px solid color-mix(in srgb,var(--c,var(--lh-accent)) 30%,transparent)}
.stk-dots{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:var(--lh-text3);background:none;border:none;cursor:pointer}
.stk-dots:hover{background:var(--lh-surface2);color:var(--lh-text)}
.stk-empty{padding:46px;text-align:center;color:var(--lh-text3);font-size:13.5px}
.stk-grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:820px){.stk-grid2{grid-template-columns:1fr}}
.stk-ctop{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid var(--lh-border);font-size:15px;font-weight:600;color:var(--lh-text)}
.stk-ring{position:relative;width:104px;height:104px;flex-shrink:0}
.stk-ring .num{position:absolute;inset:0;display:grid;place-items:center;font-size:26px;font-weight:700;color:var(--lh-text)}
.stk-ov{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;background:color-mix(in srgb,#04070c 55%,transparent);backdrop-filter:blur(4px)}
.stk-modal{width:min(94vw,540px);max-height:88vh;overflow-y:auto;background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:16px}
.stk-mtop{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 22px 6px}
.stk-mtop h2{font-size:19px;font-weight:700;color:var(--lh-text)}
.stk-mtop p{font-size:13px;color:var(--lh-text3);margin-top:2px}
.stk-x{width:32px;height:32px;border-radius:9px;border:1px solid var(--lh-border);background:var(--lh-surface);color:var(--lh-text2);cursor:pointer}
.stk-l{display:block;font-size:12.5px;font-weight:600;color:var(--lh-text2);margin:14px 0 6px}
.stk-in{width:100%;font:inherit;font-size:14px;color:var(--lh-text);background:var(--lh-surface2);border:1px solid var(--lh-border);border-radius:10px;padding:10px 12px;outline:none}
.stk-in:focus{border-color:var(--lh-accent)}
.stk-chk{display:flex;align-items:center;gap:12px;padding:11px 14px;border:1.5px solid var(--lh-border);border-radius:11px;background:var(--lh-surface2);cursor:pointer;margin-bottom:8px}
.stk-chk.on{border-color:color-mix(in srgb,var(--lh-accent) 55%,transparent);background:color-mix(in srgb,var(--lh-accent) 8%,transparent)}
.stk-chk .cn{font-size:13.5px;font-weight:600;color:var(--lh-text)}
.stk-chk .cd{font-size:12px;color:var(--lh-text3)}
.stk-tick{margin-left:auto;width:22px;height:22px;border-radius:7px;border:1.5px solid var(--lh-border2);display:grid;place-items:center;color:transparent}
.stk-chk.on .stk-tick{background:var(--lh-accent);border-color:transparent;color:var(--lh-accent-contrast)}
.stk-mfoot{display:flex;gap:10px;padding:15px 22px;border-top:1px solid var(--lh-border)}
@keyframes stk-pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.stk .dgnode{animation:stk-pop .45s cubic-bezier(.2,.8,.2,1) both}
.stk .dgedge{stroke-dasharray:900;stroke-dashoffset:900;animation:stk-draw .9s ease forwards}
@keyframes stk-draw{to{stroke-dashoffset:0}}
`

function loadStacks(ws) { try { return JSON.parse(localStorage.getItem('lh.stacks.' + ws) || '[]') } catch { return [] } }
function saveStacks(ws, s) { try { localStorage.setItem('lh.stacks.' + ws, JSON.stringify(s)) } catch {} }

function ring(v) {
  const c = 2 * Math.PI * 44, off = v == null ? c : c * (1 - v / 100)
  const stroke = v == null ? 'var(--lh-border2)' : v >= 80 ? 'var(--lh-accent)' : v >= 55 ? '#d08a1a' : '#e5484d'
  return (
    <div className="stk-ring">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r="44" fill="none" stroke="var(--lh-border)" strokeWidth="8" />
        <circle cx="52" cy="52" r="44" fill="none" stroke={stroke} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 52 52)" style={{ transition: 'stroke-dashoffset .7s ease' }} />
      </svg>
      <span className="num">{v == null ? '—' : v}</span>
    </div>
  )
}

export function StacksPage() {
  const wsId = localStorage.getItem('sandbox.activeWs') || ''
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [findings, setFindings] = useState([])
  const [stacks, setStacks] = useState(() => loadStacks(wsId))
  const [sel, setSel] = useState(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ name: '', sel: new Set() })

  const load = useCallback(async () => {
    if (!wsId) { setLoading(false); return }
    setLoading(true)
    const [pr, fr] = await Promise.all([
      supabase.from('projects').select('id,name,description').eq('workspace_id', wsId),
      supabase.from('findings').select('project_id,severity,status').eq('workspace_id', wsId),
    ])
    setProjects(pr.data ?? [])
    setFindings(fr.data ?? [])
    setLoading(false)
  }, [wsId])
  useEffect(() => { load() }, [load])

  const persist = (next) => { setStacks(next); saveStacks(wsId, next) }
  const projMeta = (name) => {
    const p = projects.find((x) => x.name === name)
    if (!p) return { name, sev: 'ok', sevn: '—' }
    const open = findings.filter((f) => f.project_id === p.id && f.status === 'open')
    const crit = open.filter((f) => f.severity === 'critical').length
    const high = open.filter((f) => f.severity === 'high').length
    return { name, sev: crit ? 'crit' : high ? 'high' : 'ok', sevn: crit ? `${crit} critical` : high ? `${high} high` : 'Clean' }
  }

  const createStack = () => {
    const nm = draft.name.trim()
    if (!nm) return
    if (draft.sel.size < 1) return
    persist([...stacks, { name: nm, projects: [...draft.sel], status: 'draft', readiness: null }])
    setCreating(false); setDraft({ name: '', sel: new Set() })
  }
  const deleteStack = (i) => { const n = [...stacks]; n.splice(i, 1); persist(n); if (sel === i) setSel(null) }
  // Composite score from each project's real open-findings state (no floor —
  // a stack where every project has critical findings should be able to show
  // a genuinely low number, not an artificially propped-up one).
  const analyze = (i) => {
    const s = stacks[i]; const ps = (s.projects || []).map(projMeta); const bad = ps.filter((p) => p.sev !== 'ok').length
    const n = [...stacks]; n[i] = { ...s, status: 'validated', readiness: ps.length ? Math.max(0, Math.round(100 - (bad / ps.length) * 100)) : null }; persist(n)
  }

  // ── SVG diagram (radial hub-and-spoke of the stack's projects) ──
  const diagram = (s) => {
    const ps = (s.projects || []).map(projMeta); const NW = 150, NH = 54
    if (!ps.length) return ''
    const n = ps.length, R = n <= 3 ? 128 : n <= 5 ? 172 : 210, cx = R + NW / 2 + 26, cy = R + NH / 2 + 26, W = cx * 2, H = cy * 2
    const node = (x, y, p, i) => { const c = p.sev === 'crit' ? '#e5484d' : p.sev === 'ok' ? 'var(--lh-accent)' : '#d08a1a'; const nm = p.name.length > 17 ? p.name.slice(0, 16) + '…' : p.name; return `<g class="dgnode" style="animation-delay:${(i * .09).toFixed(2)}s"><rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="12" fill="var(--lh-surface2)" stroke="${c}" stroke-width="1.7"/><circle cx="${x + 16}" cy="${y + NH / 2}" r="4.5" fill="${c}"/><text x="${x + 29}" y="${y + NH / 2 - 2}" fill="var(--lh-text)" font-size="12.5" font-weight="600" font-family="inherit">${nm}</text><text x="${x + 29}" y="${y + NH / 2 + 13}" fill="var(--lh-text3)" font-size="10.5" font-family="inherit">${p.sevn}</text></g>` }
    let edges = '', nodes = ''
    ps.forEach((p, i) => { const a = (-Math.PI / 2) + (i * 2 * Math.PI / n); const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R; edges += `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="var(--lh-border2)" stroke-width="2" class="dgedge" style="animation-delay:${(i * .1).toFixed(2)}s"/>`; nodes += node(px - NW / 2, py - NH / 2, p, i) })
    const hub = `<g class="dgnode"><rect x="${cx - 72}" y="${cy - 26}" width="144" height="52" rx="13" fill="var(--lh-accent)"/><text x="${cx}" y="${cy - 3}" text-anchor="middle" fill="var(--lh-accent-contrast)" font-size="13" font-weight="700" font-family="inherit">${s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name}</text><text x="${cx}" y="${cy + 13}" text-anchor="middle" fill="var(--lh-accent-contrast)" font-size="10" opacity="0.8" font-family="inherit">stack</text></g>`
    return `<div style="overflow:auto;padding:10px"><svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${Math.max(W, 320)}px;display:block;margin:0 auto;min-height:220px">${edges}${hub}${nodes}</svg></div>`
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>

  // ── Detail view ──
  if (sel != null && stacks[sel]) {
    const s = stacks[sel]; const ps = (s.projects || []).map(projMeta); const bad = ps.filter((p) => p.sev !== 'ok').length
    const rc = s.status === 'validated' ? (s.readiness >= 80 ? 'var(--lh-accent)' : '#d08a1a') : 'var(--lh-text3)'
    return (
      <div className="stk"><style>{CSS}</style>
        <div style={{ marginBottom: 16 }}><a onClick={() => setSel(null)} style={{ fontSize: 13, color: 'var(--lh-text2)', cursor: 'pointer' }}>‹ Stacks</a></div>
        <div className="stk-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="stk-ic" style={{ '--c': 'var(--lh-accent)', width: 52, height: 52, borderRadius: 13 }}><Layers size={24} /></span>
            <div><h1 style={{ fontSize: 26 }}>{s.name}</h1><div className="sub" style={{ marginTop: 4 }}>{ps.length} related projects, validated together as one stack.</div></div>
          </div>
          <button className="stk-btn pri" onClick={() => analyze(sel)}><RefreshCw size={15} />Analyze entire stack</button>
        </div>
        <div className="stk-grid2">
          <div className="stk-card">
            <div className="stk-ctop">Stack readiness <span className="stk-pill" style={{ '--c': rc }}>{s.status === 'validated' ? 'Validated' : 'Not analyzed'}</span></div>
            <div style={{ padding: 20, display: 'flex', gap: 22, alignItems: 'center' }}>
              {ring(s.readiness != null ? s.readiness : null)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: 14, color: 'var(--lh-text)' }}>
                <div>{bad ? `${bad} project${bad > 1 ? 's' : ''} need attention` : 'All projects clean'}</div>
                <div>{ps.length} projects in this stack</div>
                <div style={{ color: 'var(--lh-text2)' }}>Validated together, before you deploy</div>
              </div>
            </div>
          </div>
          <div className="stk-card"><div className="stk-ctop">Projects graph</div><div dangerouslySetInnerHTML={{ __html: diagram(s) }} /></div>
        </div>
        <div className="stk-card" style={{ marginTop: 16 }}>
          <div className="stk-ctop">Projects in this stack</div>
          {ps.map((p) => (
            <div className="stk-row" key={p.name} style={{ '--c': p.sev === 'ok' ? 'var(--lh-accent)' : '#d08a1a' }}>
              <span className="stk-ic"><GitBranch size={16} /></span>
              <div style={{ flex: 1 }}><div className="stk-n">{p.name}</div></div>
              <span className="stk-pill" style={{ '--c': p.sev === 'crit' ? '#e5484d' : p.sev === 'ok' ? 'var(--lh-accent)' : '#d08a1a' }}>{p.sevn}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── List view ──
  return (
    <div className="stk"><style>{CSS}</style>
      <div className="stk-head">
        <div><h1>Stacks</h1><div className="sub">A stack groups related projects so LytHouse validates them together — catching risk across services before you deploy. Saved to this browser for now, not shared with teammates yet.</div></div>
        <button className="stk-btn pri" onClick={() => { setDraft({ name: '', sel: new Set() }); setCreating(true) }}><Plus size={16} />Create stack</button>
      </div>
      {stacks.length === 0 ? (
        <div className="stk-card stk-empty">No stacks yet. Group related projects into a stack and validate them together.</div>
      ) : (
        <div className="stk-card">
          {stacks.map((s, i) => {
            const c = s.status !== 'validated' ? 'var(--lh-text3)' : s.readiness >= 80 ? 'var(--lh-accent)' : '#d08a1a'
            return (
              <div className="stk-row" key={i}>
                <span className="stk-ic" style={{ '--c': c }}><Layers size={18} /></span>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setSel(i)}>
                  <div className="stk-n">{s.name}</div>
                  <div className="stk-s">{(s.projects || []).length} projects{s.status === 'validated' ? ` · readiness ${s.readiness}%` : ''}</div>
                </div>
                <span className="stk-pill" style={{ '--c': s.status === 'validated' ? 'var(--lh-accent)' : '#d08a1a' }}>{s.status === 'validated' ? 'Validated' : 'Not analyzed'}</span>
                <PinButton item={{ type: 'stack', id: s.name, label: s.name, to: '/stacks' }} />
                <button className="stk-btn gho" style={{ padding: '6px 12px' }} onClick={() => setSel(i)}>Open</button>
                <button className="stk-dots" title="Delete" onClick={() => deleteStack(i)}><X size={15} /></button>
              </div>
            )
          })}
        </div>
      )}

      {creating && (
        <div className="stk-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) setCreating(false) }}>
          <div className="stk-modal">
            <div className="stk-mtop"><div><h2>Create stack</h2><p>Group the related projects you want validated together.</p></div><button className="stk-x" onClick={() => setCreating(false)}>✕</button></div>
            <div style={{ padding: '8px 22px 4px' }}>
              <label className="stk-l">Stack name</label>
              <input className="stk-in" autoFocus value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Checkout Platform" />
              <label className="stk-l">Projects in this stack</label>
              {projects.length === 0 ? <div style={{ fontSize: 13, color: 'var(--lh-text3)', padding: '8px 0' }}>No projects yet — add some under Projects first.</div> : projects.map((p) => {
                const on = draft.sel.has(p.name)
                return (
                  <div className={`stk-chk ${on ? 'on' : ''}`} key={p.id} onClick={() => setDraft((d) => { const s = new Set(d.sel); s.has(p.name) ? s.delete(p.name) : s.add(p.name); return { ...d, sel: s } })}>
                    <div style={{ flex: 1 }}><div className="cn">{p.name}</div><div className="cd">{p.description || ''}</div></div>
                    <span className="stk-tick"><Check size={14} /></span>
                  </div>
                )
              })}
            </div>
            <div className="stk-mfoot"><button className="stk-btn gho" onClick={() => setCreating(false)}>Cancel</button><span style={{ marginLeft: 'auto' }} /><button className="stk-btn pri" onClick={createStack}><Check size={15} />Create stack</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
