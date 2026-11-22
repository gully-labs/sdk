/**
 * Sponsor units without a backend: the same thing the Swoop tag (https://swoopads.xyz/t.js) does, as a typed function.
 * `mountUnit(element, { spot: 'pk_…', unit: 'native' })` adds one sandboxed iframe that shows a labelled sponsored card, counts a
 * view after half of it has been on screen long enough, and collapses when there is nothing to show.
 * No cookies, no storage, no third-party requests, and it never throws into your page.
 */
import { DEFAULT_BASE_URL } from './canonical'

export type UnitKind = 'banner' | 'text' | 'native'
export type UnitTheme = 'light' | 'dark' | 'auto'
export type UnitState = 'filled' | 'viewed' | 'empty'

export interface UnitOptions {
  /** your public Spot key `pk_…` (safe in a page). Without one the unit only shows on Swoop's own pages. */
  spot?: string
  /** default `native` */
  unit?: UnitKind
  /** default `auto` (follows the reader's colours) */
  theme?: UnitTheme
  /** which sponsor spot to fill (default: banner `watch_rail`, others `home_feed`) */
  slot?: string
  /** widest it may grow, in px (120 to 1200; default banner 970, others 480) */
  width?: number
  /** what kind of page this is (`article`, `home`, ...). Pages where money moves (`checkout`, `buy`, `claim`...) never show ads. */
  page?: string
  creator?: string
  content?: string
  topic?: string
  /** API origin (default https://offers.kre8.fun) */
  baseUrl?: string
  onState?: (state: UnitState, detail: { reason?: string }) => void
}

export interface UnitHandle {
  readonly element: HTMLElement
  readonly frame: HTMLIFrameElement
  refresh(): void
  destroy(): void
}

const WIDTH: Record<UnitKind, number> = { banner: 970, text: 480, native: 480 }
const DEFAULT_SLOT: Record<UnitKind, string> = { banner: 'watch_rail', text: 'home_feed', native: 'home_feed' }
const KEY = /^pk_[A-Za-z0-9_-]{6,80}$/
const SLOT = /^[a-z0-9_]{2,32}$/
let seq = 0

/** The address of the unit page for these options (what the iframe loads). Pure. */
export function unitUrl(o: UnitOptions = {}, id = 'u'): string {
  const unit: UnitKind = o.unit && o.unit in WIDTH ? o.unit : 'native'
  const theme: UnitTheme = o.theme === 'light' || o.theme === 'dark' ? o.theme : 'auto'
  const q = new URLSearchParams({ id, unit, theme })
  if (o.spot && KEY.test(o.spot)) q.set('spot', o.spot)
  q.set('slot', o.slot && SLOT.test(o.slot) ? o.slot : DEFAULT_SLOT[unit])
  for (const k of ['page', 'creator', 'content', 'topic'] as const) if (o[k]) q.set(k, String(o[k]).slice(0, 128))
  return `${(o.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')}/widget/unit?${q.toString()}`
}

/** Add one unit inside `element`. Returns null (and does nothing) when it cannot, for example on a server. */
export function mountUnit(element: HTMLElement | null | undefined, o: UnitOptions = {}): UnitHandle | null {
  try {
    if (typeof window === 'undefined' || !element || element.nodeType !== 1) return null
    const base = (o.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    const origin = new URL(base).origin
    const unit: UnitKind = o.unit && o.unit in WIDTH ? o.unit : 'native'
    const id = `swsdk${++seq}${Math.floor(Math.random() * 1e6).toString(36)}`
    const width = Math.round(Number(o.width)) || WIDTH[unit]
    const doc = element.ownerDocument
    const frame = doc.createElement('iframe')
    frame.src = unitUrl(o, id)
    frame.title = 'Sponsored'
    frame.loading = 'lazy'
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')
    frame.setAttribute('referrerpolicy', 'strict-origin')
    frame.setAttribute('scrolling', 'no')
    frame.style.cssText = `display:block;border:0;width:100%;max-width:${Math.max(120, Math.min(width, 1200))}px;height:0;margin:0 auto;overflow:hidden;background:transparent`
    const post = (m: Record<string, unknown>) => {
      try {
        frame.contentWindow?.postMessage(m, origin)
      } catch {
        /* the frame is gone */
      }
    }
    const onMessage = (e: MessageEvent) => {
      try {
        const m = e.data as { type?: string; id?: string; h?: number; state?: string; reason?: string } | null
        if (!m || typeof m !== 'object' || m.id !== id || e.origin !== origin || e.source !== frame.contentWindow) return
        if (m.type === 'swoop:height') {
          const h = Math.max(0, Math.min(Number(m.h) || 0, 1200))
          frame.style.height = `${h}px`
          frame.style.display = h ? 'block' : 'none'
        } else if (m.type === 'swoop:state') {
          const s = String(m.state).slice(0, 12) as UnitState
          element.setAttribute('data-swoop-state', s)
          o.onState?.(s, { reason: m.reason ? String(m.reason).slice(0, 40) : undefined })
        }
      } catch {
        /* a callback of yours threw: the unit carries on */
      }
    }
    window.addEventListener('message', onMessage)
    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((list) => {
        const e = list[list.length - 1]
        if (e) post({ type: 'swoop:visible', v: e.isIntersecting && e.intersectionRatio >= 0.5 })
      }, { threshold: [0, 0.5, 1] })
      io.observe(frame)
    }
    element.appendChild(frame)
    return {
      element,
      frame,
      refresh() {
        try {
          frame.src = frame.src
        } catch {
          /* ignore */
        }
      },
      destroy() {
        try {
          window.removeEventListener('message', onMessage)
          io?.disconnect()
          frame.remove()
        } catch {
          /* ignore */
        }
      },
    }
  } catch {
    return null
  }
}

/** Inject the hosted tag (https://swoopads.xyz/t.js) once. Resolves with `window.Swoop` or null if it cannot load. */
export function loadTag(o: { src?: string; integrity?: string } = {}): Promise<unknown | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  const w = window as unknown as { Swoop?: unknown }
  if (w.Swoop) return Promise.resolve(w.Swoop)
  return new Promise((resolve) => {
    try {
      const s = document.createElement('script')
      s.src = o.src ?? 'https://swoopads.xyz/t.js'
      if (o.integrity) {
        s.integrity = o.integrity
        s.crossOrigin = 'anonymous'
      }
      s.async = true
      s.onload = () => resolve(w.Swoop ?? null)
      s.onerror = () => resolve(null)
      document.head.appendChild(s)
    } catch {
      resolve(null)
    }
  })
}
