// @ts-nocheck
import { useState } from 'react'

const CSS = `
.plg{max-width:1100px;margin:0 auto}
.plg h1{font-size:29px;font-weight:700;letter-spacing:-.025em;color:var(--lh-text)}
.plg .sub{font-size:14.5px;color:var(--lh-text2);margin-top:6px}
.plg-note{background:var(--lh-accent-weak);border:1px solid color-mix(in srgb,var(--lh-accent) 28%,transparent);color:var(--lh-text2);border-radius:12px;padding:12px 15px;font-size:13.5px;margin:20px 0;line-height:1.55}
.plg-note b{color:var(--lh-text)}
.plg-feat{background:var(--lh-surface);border:0.5px solid var(--lh-border);border-radius:14px;padding:22px;display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:center;margin-bottom:22px}
@media(max-width:760px){.plg-feat{grid-template-columns:1fr}}
.plg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:1000px){.plg-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:620px){.plg-grid{grid-template-columns:1fr}}
.plg-card{background:var(--lh-surface);border:0.5px solid var(--lh-border);border-radius:14px;padding:18px;display:flex;flex-direction:column}
.plg-top{display:flex;align-items:flex-start;justify-content:space-between}
.plg-logo{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:12px;flex-shrink:0}
.plg-badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px}
.plg-name{font-size:15px;font-weight:700;color:var(--lh-text);margin-top:13px}
.plg-desc{font-size:12.5px;color:var(--lh-text3);margin-top:5px;line-height:1.5;flex:1}
.plg-btn{margin-top:14px;width:100%;justify-content:center;display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;padding:9px 12px;border-radius:10px;cursor:pointer;border:1px solid transparent;font-family:inherit}
.plg-btn.pri{background:var(--lh-accent);color:var(--lh-accent-contrast)}
.plg-btn.gho{background:transparent;color:var(--lh-text2);border-color:var(--lh-border)}
.plg-term{background:#0a0c10;border:1px solid #1c222c;border-radius:11px;padding:14px 15px;font-family:'JetBrains Mono',monospace;font-size:12.5px;line-height:1.75;color:#c7d0dc}
.plg-term .pr{color:#2fd4b4}.plg-term .cm{color:#5a616c}.plg-term .ok{color:#7ee2c9}
`
const PLUGINS = [
  { n: 'LytHouse CLI', c: '#0f9e88', l: '⌘', d: 'Run validations from your terminal or any CI.', s: 'Building next' },
  { n: 'GitHub Action', c: '#24292f', l: 'GH', d: 'Gate every pull request on a validation.', s: 'Building next' },
  { n: 'VS Code Extension', c: '#007ACC', l: 'VS', d: 'Inline findings and one-click fixes in your editor.', s: 'On the roadmap' },
  { n: 'JetBrains Plugin', c: '#1a1a1a', l: 'JB', d: 'Validation inside IntelliJ, GoLand and PyCharm.', s: 'On the roadmap' },
  { n: 'GitLab CI', c: '#FC6D26', l: 'GL', d: 'Drop-in job that blocks merges on blockers.', s: 'On the roadmap' },
  { n: 'CircleCI Orb', c: '#161616', l: 'CI', d: 'Run validations as a native pipeline step.', s: 'On the roadmap' },
  { n: 'Chrome Extension', c: '#4285F4', l: 'C', d: 'Readiness badges on GitHub / GitLab PRs.', s: 'On the roadmap' },
  { n: 'Neovim Plugin', c: '#57A143', l: 'N', d: 'Findings in your quickfix list.', s: 'On the roadmap' },
]

export function PluginsPage() {
  const [wait, setWait] = useState('')
  return (
    <div className="plg"><style>{CSS}</style>
      <div><h1>Plugins</h1><div className="sub">Bring LytHouse into your editor, terminal and CI. Install once, validate everywhere.</div></div>
      <div className="plg-note"><b>These plugins are on our roadmap.</b> Nothing here is downloadable yet — we're building the CLI and GitHub Action first. Join the waitlist and we'll let you know the moment one ships.</div>
      <div className="plg-feat">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span className="plg-logo" style={{ background: '#0f9e88', fontSize: 20 }}>⌘</span>
            <div><div style={{ fontSize: 17, fontWeight: 700, color: 'var(--lh-text)' }}>LytHouse CLI</div><div style={{ fontSize: 12.5, color: 'var(--lh-text3)' }}>The fastest way to validate from anywhere.</div></div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--lh-text2)', margin: '14px 0', lineHeight: 1.6 }}>Run validations, stream results, and gate deploys from your terminal or any CI system. macOS, Linux and Windows.</p>
          <button className="plg-btn pri" style={{ width: 'auto', padding: '9px 16px' }} onClick={() => setWait('LytHouse CLI')}>Join the waitlist</button>
        </div>
        <div className="plg-term"><span className="pr">$</span> brew install lythouse<br /><span className="cm"># or</span><br /><span className="pr">$</span> npm i -g @lythouse/cli<br /><br /><span className="pr">$</span> lythouse validate<br /><span className="ok">✓ readiness 88/100 — cleared to deploy</span></div>
      </div>
      <div className="plg-grid">
        {PLUGINS.map((p) => (
          <div className="plg-card" key={p.n}>
            <div className="plg-top">
              <span className="plg-logo" style={{ background: p.c }}>{p.l}</span>
              <span className="plg-badge" style={{ background: p.s === 'Building next' ? 'color-mix(in srgb,var(--lh-accent) 15%,transparent)' : 'color-mix(in srgb,#d08a1a 16%,transparent)', color: p.s === 'Building next' ? 'var(--lh-accent)' : '#d08a1a' }}>{p.s}</span>
            </div>
            <div className="plg-name">{p.n}</div>
            <div className="plg-desc">{p.d}</div>
            <button className={`plg-btn ${p.s === 'Building next' ? 'pri' : 'gho'}`} onClick={() => setWait(p.n)}>Join the waitlist</button>
          </div>
        ))}
      </div>
      {wait && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--lh-surface)', border: '0.5px solid var(--lh-border)', borderRadius: 12, padding: '12px 18px', boxShadow: '0 24px 64px -16px rgba(0,0,0,.5)', fontSize: 13.5, color: 'var(--lh-text)', zIndex: 100 }} onAnimationEnd={() => {}}>
          ✓ Added to the {wait} waitlist <button onClick={() => setWait('')} style={{ marginLeft: 10, background: 'none', border: 'none', color: 'var(--lh-text3)', cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  )
}
