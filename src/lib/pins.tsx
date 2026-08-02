// ── Pins ──────────────────────────────────────────────────────────────────
// A lightweight, device-local favourites system. Users pin the workspaces,
// projects, findings, stacks and environments they care about; pinned items
// surface in a "Pinned" group at the top of the sidebar for one-click return.
//
// Storage is localStorage (instant, no backend, no migration). A tiny pub/sub
// keeps every mounted component — cards and the sidebar — in perfect sync the
// moment anything is pinned or unpinned, including across browser tabs.
import { useEffect, useState } from 'react'
import { Pin } from 'lucide-react'

export type PinType = 'workspace' | 'project' | 'finding' | 'stack' | 'environment'
export interface PinItem {
  type: PinType
  id: string
  label: string
  to: string      // route to navigate to when clicked
  sub?: string    // optional secondary label
}

const KEY = 'lh.pins'
const subs = new Set<() => void>()

function read(): PinItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function write(items: PinItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {}
  subs.forEach(f => f())
}

export function isPinned(type: PinType, id: string) {
  return read().some(p => p.type === type && p.id === id)
}
export function togglePin(item: PinItem) {
  const cur = read()
  const i = cur.findIndex(p => p.type === item.type && p.id === item.id)
  if (i >= 0) cur.splice(i, 1)
  else cur.unshift(item)   // newest pins first
  write(cur)
}
export function removePin(type: PinType, id: string) {
  write(read().filter(p => !(p.type === type && p.id === id)))
}
export function pinKey(type: PinType, id: string) { return `${type}:${id}` }

/** Live list of all pins — re-renders on any pin change (this tab or another). */
export function usePins(): PinItem[] {
  const [, bump] = useState(0)
  useEffect(() => {
    const f = () => bump(n => n + 1)
    subs.add(f)
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) f() }
    window.addEventListener('storage', onStorage)
    return () => { subs.delete(f); window.removeEventListener('storage', onStorage) }
  }, [])
  return read()
}
/** Live boolean for a single item. */
export function usePinnedState(type: PinType, id: string) {
  const pins = usePins()
  return pins.some(p => p.type === type && p.id === id)
}

// One-time style injection so the button looks identical on every page,
// regardless of that page's own styling system.
let styled = false
function ensureStyles() {
  if (styled || typeof document === 'undefined') return
  styled = true
  const el = document.createElement('style')
  el.id = 'lh-pin-styles'
  el.textContent = `
  .lh-pin{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:8px;border:1px solid transparent;background:transparent;color:#9aa0b4;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent;transition:transform .15s cubic-bezier(.2,.8,.2,1),color .15s,background .15s,border-color .15s}
  .lh-pin:hover{background:rgba(124,92,230,.10);color:#7c5ce6;border-color:rgba(124,92,230,.22)}
  .lh-pin:active{transform:scale(.86)}
  .lh-pin:focus-visible{outline:2px solid rgba(124,92,230,.5);outline-offset:1px}
  .lh-pin svg{transition:transform .18s cubic-bezier(.2,.8,.2,1)}
  .lh-pin.on{color:#7c5ce6}
  .lh-pin.on svg{fill:#7c5ce6;transform:rotate(-32deg)}
  .lh-pin.on:hover{background:rgba(124,92,230,.14)}
  :root[data-theme="dark"] .lh-pin,.dark .lh-pin{color:#8b8ba3}
  :root[data-theme="dark"] .lh-pin:hover,.dark .lh-pin:hover{color:#c4b5fd;background:rgba(167,139,250,.14);border-color:rgba(167,139,250,.30)}
  :root[data-theme="dark"] .lh-pin.on,.dark .lh-pin.on{color:#a78bfa}
  :root[data-theme="dark"] .lh-pin.on svg,.dark .lh-pin.on svg{fill:#a78bfa}
  `
  document.head.appendChild(el)
}

/**
 * Drop-in pin toggle. Renders as a <span role="button"> (not a <button>) so it
 * can live safely inside cards that are themselves <a>/<button> without invalid
 * DOM nesting. Stops propagation so pinning never triggers the card's click.
 */
export function PinButton({ item, size = 15, className = '' }: { item: PinItem; size?: number; className?: string }) {
  ensureStyles()
  const pinned = usePinnedState(item.type, item.id)
  const act = (e: any) => { e.preventDefault(); e.stopPropagation(); togglePin(item) }
  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={pinned}
      aria-label={pinned ? 'Unpin' : 'Pin'}
      title={pinned ? 'Unpin' : 'Pin'}
      onClick={act}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') act(e) }}
      className={`lh-pin ${pinned ? 'on' : ''} ${className}`}
    >
      <Pin size={size} strokeWidth={2} />
    </span>
  )
}
