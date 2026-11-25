/**
 * Sponsor units without a backend: the same thing the Swoop tag (https://swoopads.xyz/t.js 1.1+) does, as a typed function.
 * `mountUnit(element, { spot: 'pk_…', unit: 'native', size: '480x160' })` adds one sandboxed iframe that shows a labelled sponsored
 * card at exactly one listed size, or nothing. It follows the ad rules (./rules.ts, docs.swoopads.xyz/ad-rules): exact size or no
 * unit, the page never moves (the unit opens only while off screen), one unit in view on phones, never on money, sign-in or form
 * pages, no sound, no overlays. No cookies, no storage, no third-party requests, and it never throws into your page.
 */
import { DEFAULT_BASE_URL } from './canonical'
import { gate, MIN_WIDTH, parseSize, refusal, type GatedUnit, type RefusalReason } from './rules'

export type UnitKind = 'banner' | 'text' | 'native'
export type UnitTheme = 'light' | 'dark' | 'auto'
export type UnitState = 'waiting' | 'filled' | 'viewed' | 'empty'

export interface UnitOptions {
  /** your public Spot key `pk_…` (safe in a page). Without one the unit only shows on Swoop's own pages. */
  spot?: string
  /** default `native` */
  unit?: UnitKind
  /** the exact size, one of UNIT_SIZES for the kind (default: the biggest listed size that fits the element) */
  size?: string
  /** default `auto` (follows the reader's colours) */
  theme?: UnitTheme
  /** which sponsor spot to fill (default: banner `watch_rail`, others `home_feed`) */
  slot?: string
  /** the widest size the unit may take, in px */
  width?: number
  /** what kind of page this is (`article`, `home`, ...). Pages where money moves and sign-in pages never show ads. */
  page?: string
  /** extra CSS selector: if it matches anything on the page, no unit is drawn (forms of your own, a checkout panel...) */
  block?: string
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

const KINDS: Record<UnitKind, 1> = { banner: 1, text: 1, native: 1 }
const DEFAULT_SLOT: Record<UnitKind, string> = { banner: 'watch_rail', text: 'home_feed', native: 'home_feed' }
const KEY = /^pk_[A-Za-z0-9_-]{6,80}$/
const SLOT = /^[a-z0-9_]{2,32}$/
let seq = 0

/** The address of the unit page for these options and this much space (what the iframe loads). Pure. */
export function unitUrl(o: UnitOptions = {}, id = 'u', aw = 1200, loc = ''): string {
  const unit: UnitKind = o.unit && o.unit in KINDS ? o.unit : 'native'
  const theme: UnitTheme = o.theme === 'light' || o.theme === 'dark' ? o.theme : 'auto'
  const q = new URLSearchParams({ id, aw: String(Math.floor(aw)), unit, theme })
  if (o.size && parseSize(o.size)) q.set('size', o.size)
  if (o.spot && KEY.test(o.spot)) q.set('spot', o.spot)
  q.set('slot', o.slot && SLOT.test(o.slot) ? o.slot : DEFAULT_SLOT[unit])
  for (const k of ['page', 'creator', 'content', 'topic'] as const) if (o[k]) q.set(k, String(o[k]).slice(0, 128))
  // the page path goes in the fragment: the unit page reads it to keep ads off money and sign-in pages; it is never sent to a server
  const hash = loc ? `#loc=${encodeURIComponent(loc.slice(0, 300))}` : ''
  return `${(o.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')}/widget/unit?${q.toString()}${hash}`
}

/** Add one unit inside `element`. Returns null (and draws nothing) when it cannot or must not, for example on a server or a form page. */
export function mountUnit(element: HTMLElement | null | undefined, o: UnitOptions = {}): UnitHandle | null {
  try {
    if (typeof window === 'undefined' || !element || element.nodeType !== 1) return null
    const base = (o.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    const origin = new URL(base).origin
    const say = (s: UnitState, reason?: string) => {
      element.setAttribute('data-swoop-state', s)
      if (reason) element.setAttribute('data-swoop-reason', reason)
      try {
        o.onState?.(s, { reason })
      } catch {
        /* your callback threw: the unit carries on */
      }
    }
    const aw = Math.floor(Math.min(element.clientWidth || element.getBoundingClientRect().width, Number(o.width) || 1200))
    const why: RefusalReason | null = refusal(element, o) ?? (aw < MIN_WIDTH ? 'no_fit' : null)
    if (why) {
      say('empty', why)
      return null
    }
    const id = `swsdk${++seq}${Math.floor(Math.random() * 1e6).toString(36)}`
    const doc = element.ownerDocument
    const box = doc.createElement('div')
    // floated while shut: an empty in-flow box would stop the margins around it collapsing, which shifts the page
    box.style.cssText = `float:left;overflow:hidden;margin:0 auto;height:0px;width:${aw}px`
    const frame = doc.createElement('iframe')
    const src = unitUrl(o, id, aw, window.location.pathname + window.location.hash)
    frame.title = 'Sponsored'
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')
    frame.setAttribute('allow', "autoplay 'none'")
    frame.setAttribute('referrerpolicy', 'strict-origin')
    frame.setAttribute('scrolling', 'no')
    frame.style.cssText = `display:block;border:0;visibility:hidden;background:transparent;height:600px;width:${aw}px`
    const post = (m: Record<string, unknown>) => {
      try {
        frame.contentWindow?.postMessage(m, origin)
      } catch {
        /* the frame is gone */
      }
    }
    const visible = () => {
      const r = box.getBoundingClientRect()
      const seen = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)
      post({ type: 'swoop:visible', v: g.open && !doc.hidden && seen >= g.h / 2 })
    }
    const g: GatedUnit = {
      box,
      h: 0,
      open: false,
      want: '',
      refused: () => refusal(element, o),
      onOpen() {
        frame.style.visibility = 'visible'
        say('filled')
        visible()
      },
      onShut() {
        frame.style.visibility = 'hidden'
        post({ type: 'swoop:visible', v: false })
        say('empty', reason)
      },
    }
    let reason = ''
    const shut = (r: string, now: boolean) => {
      reason = r
      frame.style.visibility = 'hidden'
      gate.shut(g, now)
    }
    const onMessage = (e: MessageEvent) => {
      try {
        const m = e.data as { type?: string; id?: string; w?: number; h?: number; state?: string; reason?: string } | null
        if (!m || typeof m !== 'object' || m.id !== id || e.origin !== origin || e.source !== frame.contentWindow) return
        if (m.type === 'swoop:fit') {
          // the unit page drew the creative at exactly this size; a size the space cannot hold, or a second size, closes it
          const fw = Number(m.w)
          const fh = Number(m.h)
          if (g.open || g.want || !(fw >= 120 && fw <= aw && fh >= 30 && fh <= 600)) return shut('size_mismatch', !g.open)
          g.h = fh
          box.style.width = frame.style.width = `${fw}px`
          frame.style.height = `${fh}px`
          gate.open(g)
        } else if (m.type === 'swoop:state') {
          const s = String(m.state).slice(0, 12)
          const r = m.reason ? String(m.reason).slice(0, 40) : 'no_fill'
          if (s === 'empty') shut(r, r === 'hidden' || r === 'reported' || !g.open)
          else if (s === 'viewed') say('viewed')
        }
      } catch {
        /* never into the page */
      }
    }
    window.addEventListener('message', onMessage)
    let io: IntersectionObserver | null = null
    let near: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      // load when within two screens; tell the unit page when half of the open unit is in view
      near = new IntersectionObserver((list) => {
        if (list.some((x) => x.isIntersecting) && !frame.src) frame.src = src
      }, { rootMargin: '200% 0px' })
      io = new IntersectionObserver(() => visible(), { threshold: [0, 0.5, 1] })
      near.observe(box)
      io.observe(box)
    } else frame.src = src
    box.append(frame)
    element.appendChild(box)
    gate.add(g)
    say('waiting')
    return {
      element,
      frame,
      refresh() {
        try {
          if (frame.src) frame.src = src
        } catch {
          /* ignore */
        }
      },
      destroy() {
        try {
          window.removeEventListener('message', onMessage)
          io?.disconnect()
          near?.disconnect()
          gate.remove(g)
          box.remove()
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
