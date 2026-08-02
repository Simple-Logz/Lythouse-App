// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { saveSettings } from '../workspace/releaseSettings'
import {
  X, ChevronLeft, ChevronRight, Check, Loader as Loader2, Lock, Package,
  Server, Boxes, Layers, Scale, GitBranch, ShieldCheck, SlidersHorizontal,
  FileText, Users
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────
// Create Project — a proper multi-step wizard modeled on Spacelift's Create
// Stack flow (Details → Connect source → Scope → Policies → Review), adapted
// to LytHouse's release-validation domain. Every choice is real: core fields
// are written to the projects table; scope + policy gates are persisted via
// the release-settings store that the workspace deploy gate actually reads.
// ─────────────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { id: 'github', name: 'GitHub', color: '#6e7681', ph: 'https://github.com/org/repo', svg: 'M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z' },
  { id: 'gitlab', name: 'GitLab', color: '#FC6D26', ph: 'https://gitlab.com/org/repo', svg: 'M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.386 9.45.044 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.625-8.444a.92.92 0 0 0 .33-1.023' },
  { id: 'bitbucket', name: 'Bitbucket', color: '#2684FF', ph: 'https://bitbucket.org/org/repo', svg: 'M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z' },
  { id: 'azure', name: 'Azure DevOps', color: '#0078D4', ph: 'https://dev.azure.com/org/project/_git/repo', svg: 'M0 17.182L2.538 20l8.347-7.767V20L24 12.909 13.2 4v3.636z' },
  { id: 'selfhosted', name: 'Self-hosted', color: '#8a909a', ph: 'https://git.yourcompany.com/org/repo', svg: 'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z' },
  { id: 'other', name: 'Other / HTTPS', color: '#8a909a', ph: 'https://your-git-host.com/org/repo', svg: 'M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1' },
]

const CHECKS = [
  { id: 'secrets', name: 'Secrets & credentials', desc: 'Detect hardcoded keys, tokens and passwords', icon: Lock },
  { id: 'dependencies', name: 'Dependencies & CVEs', desc: 'Audit packages for known vulnerabilities', icon: Package },
  { id: 'infra', name: 'Infrastructure & config', desc: 'Terraform, IaC and config drift', icon: Server },
  { id: 'containers', name: 'Container images', desc: 'Scan Dockerfiles and image layers', icon: Boxes },
  { id: 'kubernetes', name: 'Kubernetes manifests', desc: 'Validate manifests and policies', icon: Layers },
  { id: 'licenses', name: 'License compliance', desc: 'Flag risky or incompatible licenses', icon: Scale },
]

const STEPS = [
  { key: 'details', label: 'Details', sub: 'Name & workspace', icon: FileText },
  { key: 'source', label: 'Connect source', sub: 'Repository & branch', icon: GitBranch },
  { key: 'scope', label: 'Validation scope', sub: 'What to check', icon: ShieldCheck },
  { key: 'policies', label: 'Policies & gates', sub: 'Deployment rules', icon: SlidersHorizontal },
  { key: 'review', label: 'Review', sub: 'Confirm & create', icon: Check },
]

const CSS = `
.wz-ov{position:fixed;inset:0;z-index:110;display:flex;align-items:center;justify-content:center;padding:16px;background:color-mix(in srgb,#05070a 50%,transparent);backdrop-filter:blur(4px);animation:wz-fade .14s ease}
@keyframes wz-fade{from{opacity:0}to{opacity:1}}
@keyframes wz-in{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}
@keyframes wz-slide{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
/* Use the app's real theme tokens (defined on :root / :root[data-theme=dark]
   in AppShell) instead of a hardcoded local palette, so this matches the
   rest of the app and actually follows the light/dark toggle. */
.wz{
  width:min(96vw,860px);max-height:90vh;display:flex;background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:18px;overflow:hidden;box-shadow:0 30px 90px -18px rgba(4,8,14,.7);animation:wz-in .2s cubic-bezier(.2,.8,.2,1)}
.wz-rail{width:236px;flex-shrink:0;background:var(--lh-sidebar);border-right:1px solid var(--lh-border);padding:22px 16px;display:flex;flex-direction:column}
@media(max-width:680px){.wz-rail{display:none}}
.wz-rail-t{font-size:16px;font-weight:700;letter-spacing:-.02em;color:var(--lh-text);padding:0 8px 18px;display:flex;align-items:center;gap:8px}
.wz-rail-t .mk{width:24px;height:24px;border-radius:7px;background:var(--lh-accent);display:grid;place-items:center;color:var(--lh-accent-contrast)}
.wz-step{display:flex;align-items:center;gap:11px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:.13s}
.wz-step:hover{background:var(--lh-surface2)}
.wz-step .n{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:12.5px;font-weight:700;flex-shrink:0;background:var(--lh-surface2);color:var(--lh-text3);border:1px solid var(--lh-border);transition:.13s}
.wz-step.done .n{background:var(--lh-accent);color:var(--lh-accent-contrast);border-color:transparent}
.wz-step.cur .n{background:color-mix(in srgb,var(--lh-accent) 16%,transparent);color:var(--lh-accent);border-color:var(--lh-accent)}
.wz-step .l{font-size:13.5px;font-weight:600;color:var(--lh-text2)}
.wz-step .s{font-size:11.5px;color:var(--lh-text3);margin-top:1px}
.wz-step.cur .l{color:var(--lh-text)}
.wz-main{flex:1;min-width:0;display:flex;flex-direction:column}
.wz-top{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 6px}
.wz-top h2{font-size:19px;font-weight:700;letter-spacing:-.02em;color:var(--lh-text)}
.wz-top p{font-size:13px;color:var(--lh-text3);margin-top:2px}
.wz-x{width:32px;height:32px;border-radius:9px;border:1px solid var(--lh-border);background:var(--lh-surface);color:var(--lh-text2);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.wz-x:hover{background:var(--lh-surface2)}
.wz-body{flex:1;overflow-y:auto;padding:16px 22px 8px}
.wz-pane{animation:wz-slide .22s ease}
.wz-l{display:block;font-size:12.5px;font-weight:600;color:var(--lh-text2);margin:14px 0 6px}
.wz-l .req{color:#e5484d}
.wz-in{width:100%;font:inherit;font-size:14px;color:var(--lh-text);background:var(--lh-surface2);border:1px solid var(--lh-border);border-radius:10px;padding:10px 12px;outline:none;transition:.13s}
.wz-in:focus{border-color:var(--lh-accent);box-shadow:0 0 0 3px var(--lh-ring)}
.wz-in::placeholder{color:var(--lh-text3)}
textarea.wz-in{resize:vertical;min-height:64px}
.wz-prov{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
@media(max-width:520px){.wz-prov{grid-template-columns:repeat(2,1fr)}}
.wz-pv{display:flex;flex-direction:column;align-items:center;gap:7px;padding:13px 6px;border:1.5px solid var(--lh-border);border-radius:12px;background:var(--lh-surface2);cursor:pointer;transition:.13s}
.wz-pv:hover{border-color:var(--lh-border2)}
.wz-pv.on{border-color:var(--lh-accent);background:color-mix(in srgb,var(--lh-accent) 9%,transparent)}
.wz-pv .nm{font-size:11.5px;font-weight:600;color:var(--lh-text2)}
.wz-pv.on .nm{color:var(--lh-text)}
.wz-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.wz-chk{display:flex;align-items:center;gap:13px;padding:13px 15px;border:1.5px solid var(--lh-border);border-radius:12px;background:var(--lh-surface2);cursor:pointer;transition:.13s;margin-bottom:9px}
.wz-chk:hover{border-color:var(--lh-border2)}
.wz-chk.on{border-color:color-mix(in srgb,var(--lh-accent) 55%,transparent);background:color-mix(in srgb,var(--lh-accent) 8%,transparent)}
.wz-chk .ci{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;background:var(--lh-surface);color:var(--lh-text3);border:1px solid var(--lh-border)}
.wz-chk.on .ci{background:var(--lh-accent);color:var(--lh-accent-contrast);border-color:transparent}
.wz-chk .cn{font-size:13.5px;font-weight:600;color:var(--lh-text)}
.wz-chk .cd{font-size:12px;color:var(--lh-text3);margin-top:1px}
.wz-tick{width:22px;height:22px;border-radius:7px;border:1.5px solid var(--lh-border2);display:grid;place-items:center;flex-shrink:0;color:transparent;transition:.13s}
.wz-chk.on .wz-tick{background:var(--lh-accent);border-color:transparent;color:var(--lh-accent-contrast)}
.wz-pol{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border:1px solid var(--lh-border);border-radius:12px;background:var(--lh-surface2);margin-bottom:10px}
.wz-pol .pt{font-size:13.5px;font-weight:600;color:var(--lh-text)}
.wz-pol .pd{font-size:12px;color:var(--lh-text3);margin-top:2px;max-width:340px}
.wz-tog{width:42px;height:24px;border-radius:20px;background:var(--lh-border2);border:none;cursor:pointer;position:relative;flex-shrink:0;transition:.16s}
.wz-tog.on{background:var(--lh-accent)}
.wz-tog::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.16s}
.wz-tog.on::after{left:21px}
.wz-tog.lock{opacity:.55;cursor:not-allowed}
.wz-slider{width:100%;margin-top:6px;accent-color:var(--lh-accent)}
.wz-rng-v{font-size:13px;font-weight:700;color:var(--lh-accent);font-family:'JetBrains Mono',monospace}
.wz-sum{border:1px solid var(--lh-border);border-radius:12px;overflow:hidden}
.wz-sum-r{display:flex;gap:14px;padding:12px 15px;border-top:1px solid var(--lh-border);font-size:13.5px}
.wz-sum-r:first-child{border-top:none}
.wz-sum-r .k{width:120px;flex-shrink:0;color:var(--lh-text3);font-weight:500}
.wz-sum-r .v{color:var(--lh-text);font-weight:600;min-width:0}
.wz-tag{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:20px;background:color-mix(in srgb,var(--lh-accent) 12%,transparent);color:var(--lh-accent);margin:0 5px 5px 0}
.wz-err{margin:12px 0 0;padding:9px 13px;border-radius:10px;background:color-mix(in srgb,#e5484d 12%,transparent);border:1px solid color-mix(in srgb,#e5484d 34%,transparent);color:#e5484d;font-size:13px}
.wz-foot{display:flex;align-items:center;gap:10px;padding:15px 22px;border-top:1px solid var(--lh-border)}
.wz-count{font-size:12.5px;color:var(--lh-text3)}
.wz-btn{display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:13.5px;font-weight:600;padding:9px 16px;border-radius:10px;cursor:pointer;border:1px solid transparent;transition:.13s}
.wz-btn.pri{background:var(--lh-accent);color:var(--lh-accent-contrast)}
.wz-btn.pri:hover{filter:brightness(1.06)}.wz-btn.pri:disabled{opacity:.5;cursor:default;filter:none}
.wz-btn.gho{background:transparent;color:var(--lh-text2);border-color:var(--lh-border)}
.wz-btn.gho:hover{background:var(--lh-surface2);color:var(--lh-text)}
`

export function CreateProjectWizard({ open, onClose, workspaces, selectedWs, existingNames, onCreated }: {
  open: boolean; onClose: () => void; workspaces: { id: string; name: string }[];
  selectedWs: string; existingNames: string[]; onCreated: (p: any) => void;
}) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState({
    name: '', description: '', ws: selectedWs || workspaces[0]?.id || '',
    provider: 'github', gitUrl: '', gitBranch: 'main', repoFolder: '',
    visibility: 'public', token: '',
    checks: CHECKS.map((c) => c.id),
    blockOnHigh: false, deployGateReadiness: 70, requireApproval: true,
  })
  const set = (patch: any) => setF((p) => ({ ...p, ...patch }))

  useEffect(() => {
    if (open) { setStep(0); setError(''); setSaving(false); set({ ws: selectedWs || workspaces[0]?.id || '', name: '', description: '', gitUrl: '', gitBranch: 'main', repoFolder: '', visibility: 'public', token: '', checks: CHECKS.map((c) => c.id), blockOnHigh: false, deployGateReadiness: 70, requireApproval: true }) }
  }, [open]) // eslint-disable-line

  const provider = useMemo(() => PROVIDERS.find((p) => p.id === f.provider) || PROVIDERS[0], [f.provider])

  if (!open) return null

  const canNext = () => {
    if (step === 0) return f.name.trim() && f.ws
    if (step === 1) return f.gitUrl.trim() && (f.visibility === 'public' || f.token.trim())
    if (step === 2) return f.checks.length > 0
    return true
  }

  const guardNext = () => {
    setError('')
    if (step === 0) {
      if (!f.name.trim()) return setError('Give the project a name.')
      if (existingNames.map((n) => n.toLowerCase()).includes(f.name.trim().toLowerCase())) return setError(`A project named “${f.name.trim()}” already exists in this workspace.`)
      if (!f.ws) return setError('Select a workspace.')
    }
    if (step === 1) {
      if (!f.gitUrl.trim()) return setError('Enter the repository URL.')
      if (f.visibility === 'private' && !f.token.trim()) return setError('A personal access token is required for private repositories.')
    }
    if (step === 2 && f.checks.length === 0) return setError('Select at least one validation check.')
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const create = async () => {
    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('projects').insert({
      workspace_id: f.ws, name: f.name.trim(), description: f.description.trim() || null,
      git_url: f.gitUrl.trim(), git_branch: f.gitBranch.trim() || 'main',
      repo_folder: f.repoFolder.trim() || '', github_token: f.visibility === 'private' ? f.token.trim() : null,
      language: null, status: 'active',
    }).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    // Persist scope + policy gates so the workspace deploy gate honors them.
    try {
      saveSettings(data, {
        checks: f.checks, blockOnHigh: f.blockOnHigh,
        deployGateReadiness: Number(f.deployGateReadiness) || 0, requireApproval: f.requireApproval,
      })
    } catch {}
    setSaving(false)
    onCreated(data)
  }

  const toggleCheck = (id: string) => set({ checks: f.checks.includes(id) ? f.checks.filter((c: string) => c !== id) : [...f.checks, id] })
  const wsName = workspaces.find((w) => w.id === f.ws)?.name || '—'

  return (
    <div className="wz-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <style>{CSS}</style>
      <div className="wz" role="dialog" aria-label="Create project">
        {/* Rail */}
        <div className="wz-rail">
          <div className="wz-rail-t"><span className="mk"><ShieldCheck size={14} /></span>New project</div>
          {STEPS.map((s, i) => (
            <div key={s.key} className={`wz-step ${i === step ? 'cur' : i < step ? 'done' : ''}`} onClick={() => i < step && setStep(i)}>
              <span className="n">{i < step ? <Check size={14} /> : i + 1}</span>
              <div><div className="l">{s.label}</div><div className="s">{s.sub}</div></div>
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="wz-main">
          <div className="wz-top">
            <div><h2>{STEPS[step].label}</h2><p>{STEPS[step].sub}</p></div>
            <button className="wz-x" onClick={onClose}><X size={16} /></button>
          </div>

          <div className="wz-body">
            {/* STEP 0 — Details */}
            {step === 0 && (
              <div className="wz-pane">
                <label className="wz-l">Project name <span className="req">*</span></label>
                <input className="wz-in" autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="checkout-service" />
                <label className="wz-l">Description</label>
                <textarea className="wz-in" value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="What does this service do? (optional)" />
                <label className="wz-l">Workspace <span className="req">*</span></label>
                {workspaces.length === 0 ? (
                  <div className="wz-err" style={{ marginTop: 4 }}>No workspaces yet — create one under Workspaces first.</div>
                ) : (
                  <select className="wz-in" value={f.ws} onChange={(e) => set({ ws: e.target.value })}>
                    {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* STEP 1 — Connect source */}
            {step === 1 && (
              <div className="wz-pane">
                <label className="wz-l">Git provider</label>
                <div className="wz-prov">
                  {PROVIDERS.map((p) => (
                    <button type="button" key={p.id} className={`wz-pv ${f.provider === p.id ? 'on' : ''}`} onClick={() => set({ provider: p.id })}>
                      <svg viewBox="0 0 24 24" width="20" height="20" style={{ fill: f.provider === p.id ? p.color : 'var(--lh-text3)' }}><path d={p.svg} /></svg>
                      <span className="nm">{p.name}</span>
                    </button>
                  ))}
                </div>
                <label className="wz-l">Repository URL <span className="req">*</span></label>
                <input className="wz-in" value={f.gitUrl} onChange={(e) => set({ gitUrl: e.target.value })} placeholder={provider.ph} />
                <div className="wz-2">
                  <div><label className="wz-l">Branch</label><input className="wz-in" value={f.gitBranch} onChange={(e) => set({ gitBranch: e.target.value })} placeholder="main" /></div>
                  <div><label className="wz-l">Folder <span style={{ color: 'var(--lh-text3)', fontWeight: 400 }}>(optional)</span></label><input className="wz-in" value={f.repoFolder} onChange={(e) => set({ repoFolder: e.target.value })} placeholder="root" /></div>
                </div>
                <label className="wz-l">Visibility</label>
                <div className="wz-2">
                  <button type="button" className={`wz-pv ${f.visibility === 'public' ? 'on' : ''}`} style={{ flexDirection: 'row', justifyContent: 'center' }} onClick={() => set({ visibility: 'public', token: '' })}>Public</button>
                  <button type="button" className={`wz-pv ${f.visibility === 'private' ? 'on' : ''}`} style={{ flexDirection: 'row', justifyContent: 'center' }} onClick={() => set({ visibility: 'private' })}>Private</button>
                </div>
                {f.visibility === 'private' && (
                  <>
                    <label className="wz-l">Personal access token <span className="req">*</span></label>
                    <input className="wz-in" type="password" value={f.token} onChange={(e) => set({ token: e.target.value })} placeholder="ghp_xxxxxxxxxxxx" />
                  </>
                )}
              </div>
            )}

            {/* STEP 2 — Scope */}
            {step === 2 && (
              <div className="wz-pane">
                <p style={{ fontSize: 13, color: 'var(--lh-text3)', marginBottom: 12 }}>Choose what LytHouse validates on every release candidate. You can change this later in the project's settings.</p>
                {CHECKS.map((c) => {
                  const on = f.checks.includes(c.id)
                  return (
                    <div key={c.id} className={`wz-chk ${on ? 'on' : ''}`} onClick={() => toggleCheck(c.id)}>
                      <span className="ci"><c.icon size={17} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}><div className="cn">{c.name}</div><div className="cd">{c.desc}</div></div>
                      <span className="wz-tick"><Check size={14} /></span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* STEP 3 — Policies */}
            {step === 3 && (
              <div className="wz-pane">
                <p style={{ fontSize: 13, color: 'var(--lh-text3)', marginBottom: 12 }}>Deployment gates decide when a release is allowed to ship. These become the project's release policy.</p>
                <div className="wz-pol">
                  <div><div className="pt">Block on critical findings</div><div className="pd">Any unresolved critical finding always blocks deployment.</div></div>
                  <button className="wz-tog on lock" disabled title="Always enforced" />
                </div>
                <div className="wz-pol">
                  <div><div className="pt">Also block on high-severity</div><div className="pd">Treat high findings as blockers too, not just critical.</div></div>
                  <button className={`wz-tog ${f.blockOnHigh ? 'on' : ''}`} onClick={() => set({ blockOnHigh: !f.blockOnHigh })} />
                </div>
                <div className="wz-pol">
                  <div><div className="pt">Require approval to deploy</div><div className="pd">At least one recorded sign-off before shipping.</div></div>
                  <button className={`wz-tog ${f.requireApproval ? 'on' : ''}`} onClick={() => set({ requireApproval: !f.requireApproval })} />
                </div>
                <div className="wz-pol" style={{ display: 'block' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><div className="pt">Minimum readiness to deploy</div><div className="pd">Block deployment below this readiness score. 0 turns the gate off.</div></div>
                    <span className="wz-rng-v">{f.deployGateReadiness}%</span>
                  </div>
                  <input className="wz-slider" type="range" min={0} max={100} step={5} value={f.deployGateReadiness} onChange={(e) => set({ deployGateReadiness: Number(e.target.value) })} />
                </div>
              </div>
            )}

            {/* STEP 4 — Review */}
            {step === 4 && (
              <div className="wz-pane">
                <div className="wz-sum">
                  <div className="wz-sum-r"><span className="k">Project</span><span className="v">{f.name || '—'}</span></div>
                  {f.description && <div className="wz-sum-r"><span className="k">Description</span><span className="v" style={{ fontWeight: 400 }}>{f.description}</span></div>}
                  <div className="wz-sum-r"><span className="k">Workspace</span><span className="v">{wsName}</span></div>
                  <div className="wz-sum-r"><span className="k">Repository</span><span className="v" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, overflowWrap: 'anywhere' }}>{f.gitUrl || '—'} · {f.gitBranch}</span></div>
                  <div className="wz-sum-r"><span className="k">Validation</span><span className="v" style={{ fontWeight: 400 }}>{f.checks.map((id: string) => <span key={id} className="wz-tag">{CHECKS.find((c) => c.id === id)?.name}</span>)}</span></div>
                  <div className="wz-sum-r"><span className="k">Gates</span><span className="v" style={{ fontWeight: 400 }}>
                    <span className="wz-tag">Block critical</span>
                    {f.blockOnHigh && <span className="wz-tag">Block high</span>}
                    {f.requireApproval && <span className="wz-tag">Approval required</span>}
                    {f.deployGateReadiness > 0 && <span className="wz-tag">Readiness ≥ {f.deployGateReadiness}%</span>}
                  </span></div>
                </div>
              </div>
            )}

            {error && <div className="wz-err">{error}</div>}
          </div>

          <div className="wz-foot">
            {step > 0 ? <button className="wz-btn gho" onClick={() => { setError(''); setStep((s) => s - 1) }}><ChevronLeft size={15} />Back</button> : <button className="wz-btn gho" onClick={onClose}>Cancel</button>}
            <span className="wz-count" style={{ marginLeft: 'auto' }}>Step {step + 1} of {STEPS.length}</span>
            {step < STEPS.length - 1 ? (
              <button className="wz-btn pri" onClick={guardNext} disabled={!canNext()}>Continue<ChevronRight size={15} /></button>
            ) : (
              <button className="wz-btn pri" onClick={create} disabled={saving}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}Create project</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
