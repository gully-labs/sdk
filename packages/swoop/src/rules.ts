/**
 * The ad rules (owner rule 2026-11-25, https://docs.swoopads.xyz/ad-rules/): "if it doesn't fit, don't run an ad there".
 * The same rules the hosted tag (swoopads.xyz/t.js 1.1+) and its unit page enforce, for the SDK's own units:
 *  - exact size: a unit is drawn only at one listed size (UNIT_SIZES) that fits its space, and only when the creative fits that
 *    size exactly (an image of the same shape and at least as big, text that is not cut); otherwise it takes no space at all
 *  - zero layout shift: a unit opens only while it is off screen (below the fold, or above it where the browser anchors scrolling)
 *    and closes the same way; only the reader's own Hide closes one in view
 *  - phones (<= 480 px wide): at most one unit in view; a unit within one screen of an open unit stays shut
 *  - never on money pages, sign-in pages, or pages and areas with forms (password, email, card, one-time-code fields,
 *    `data-swoop-no-ads`, or your own selector)
 *  - no overlays, pop-ups, interstitials, sticky or fixed units, sound or forced waits: images and text in the page flow only
 * Pure helpers plus one small open/close gate shared by every unit on the page. Browser only; nothing here runs on a server.
 */

/** The listed sizes, biggest first (the same list as the unit page and the docs). */
export const UNIT_SIZES = {
  banner: ['1200x400', '970x250', '728x90', '600x200', '468x60', '320x100', '320x50', '300x250'],
  text: ['728x90', '480x120', '320x140'],
  native: ['480x160', '320x140'],
} as const
export type SizeKind = keyof typeof UNIT_SIZES
export const ALL_SIZES: readonly string[] = [...new Set(Object.values(UNIT_SIZES).flat())]
export const MIN_WIDTH = 300

const words = (w: string) => new RegExp(`(^|[/#_.-])(${w})($|[/?_.-])`, 'i')
export const MONEY_PAGE = words('checkout|cart|pay|payment|payments|buy|sell|swap|trade|claim|claims|mint|bridge|withdraw|deposit|send|wallet')
export const SIGN_IN_PAGE = words('login|log-in|signin|sign-in|signup|sign-up|register|auth|oauth|password|reset|2fa|mfa|verify')
export const FORM_FIELDS = 'input[type=password],input[type=email],input[autocomplete^=cc-],input[autocomplete=one-time-code],[data-swoop-no-ads]'

export type RefusalReason = 'money_page' | 'sign_in_page' | 'form_on_page' | 'form_area' | 'overlay_position' | 'no_fit' | 'no_size' | 'size_mismatch' | 'format_not_allowed'

/** Parse "WxH". */
export function parseSize(s: string | null | undefined): [number, number] | null {
  const m = /^(\d{2,4})x(\d{2,4})$/.exec(s ?? '')
  return m ? [Number(m[1]), Number(m[2])] : null
}

/** The sizes a unit kind may take in `avail` px (and at most `cap`), biggest first; `want` keeps only that size. */
export function sizesFor(kind: SizeKind, avail: number, want?: string, cap?: number): [number, number][] {
  return UNIT_SIZES[kind]
    .filter((s) => !want || s === want)
    .map((s) => parseSize(s)!)
    .filter(([w]) => w <= avail && (!cap || w <= cap))
}

/** Why this element's page or place may not carry an ad (null = it may). `page` is the page kind the site says it is. */
export function refusal(el: Element, o: { page?: string; block?: string } = {}): RefusalReason | null {
  const d = el.ownerDocument
  const w = d.defaultView
  const where = (w?.location.pathname ?? '') + (w?.location.hash ?? '')
  const page = `/${o.page ?? ''}`
  if (MONEY_PAGE.test(where) || MONEY_PAGE.test(page)) return 'money_page'
  if (SIGN_IN_PAGE.test(where) || SIGN_IN_PAGE.test(page)) return 'sign_in_page'
  let extra = false
  try {
    extra = !!(o.block && d.querySelector(o.block))
  } catch {
    /* a bad selector blocks nothing extra */
  }
  if (d.querySelector(FORM_FIELDS) || extra) return 'form_on_page'
  if (el.closest('form,[data-swoop-no-ads]')) return 'form_area'
  for (let n: Element | null = el; n && n !== d.body; n = n.parentElement) {
    const p = w?.getComputedStyle(n).position
    if (p === 'fixed' || p === 'sticky') return 'overlay_position'
  }
  return null
}

/** A unit the gate opens and closes: its box (height 0 until open) and its height once open. */
export interface GatedUnit {
  box: HTMLElement
  h: number
  /** true once the gate opened it */
  open: boolean
  /** the unit wants to open (it fits) or to close (empty) */
  want: '' | 'open' | 'shut'
  onOpen(): void
  onShut(): void
  /** checked again just before opening (forms may have appeared) */
  refused?(): RefusalReason | null
}

const units = new Set<GatedUnit>()
let raf = 0
let listening = false

function anchors(): boolean {
  try {
    return CSS.supports('overflow-anchor', 'auto')
  } catch {
    return false
  }
}
/** Opening or closing now moves nothing the reader sees. */
function quiet(u: GatedUnit): boolean {
  const r = u.box.getBoundingClientRect()
  const vh = u.box.ownerDocument.defaultView?.innerHeight ?? 0
  return r.top >= vh || (r.bottom < 0 && anchors())
}
/** Phones: another open unit closer than one screen. */
function crowded(u: GatedUnit): boolean {
  const w = u.box.ownerDocument.defaultView
  if (!w || w.innerWidth > 480) return false
  const a = u.box.getBoundingClientRect()
  for (const o of units) {
    if (o === u || !o.open) continue
    const b = o.box.getBoundingClientRect()
    const gap = a.top >= b.bottom ? a.top - b.bottom : b.top - (a.top + u.h)
    if (gap < w.innerHeight) return true
  }
  return false
}
function settle() {
  raf = 0
  for (const u of units) {
    try {
      if (u.want === 'open' && !u.open) {
        if (u.refused?.()) {
          u.want = 'shut'
          u.onShut()
          continue
        }
        if (!crowded(u) && quiet(u)) {
          u.open = true
          u.box.style.height = `${u.h}px`
          u.onOpen()
        }
      } else if (u.want === 'shut' && u.open && quiet(u)) closeNow(u)
    } catch {
      /* one unit never stops the others */
    }
  }
}
function closeNow(u: GatedUnit) {
  u.open = false
  u.want = 'shut'
  u.box.style.height = '0px'
  u.box.style.display = 'none'
  u.onShut()
}
/** Look again soon (after a scroll, a resize or a change). */
export function recheck() {
  if (raf) return
  const w = typeof window === 'undefined' ? null : window
  if (!w) return
  raf = (w.requestAnimationFrame ? w.requestAnimationFrame.bind(w) : (f: () => void) => w.setTimeout(f, 16))(settle) as unknown as number
}
export const gate = {
  add(u: GatedUnit) {
    units.add(u)
    if (!listening && typeof window !== 'undefined') {
      listening = true
      window.addEventListener('scroll', recheck, { passive: true })
      window.addEventListener('resize', recheck)
    }
  },
  remove(u: GatedUnit) {
    units.delete(u)
    recheck()
  },
  /** the unit fits: open it as soon as that moves nothing */
  open(u: GatedUnit) {
    if (u.want === 'shut') return
    u.want = 'open'
    recheck()
  },
  /** the unit is empty: close at once if it is not open or the reader asked (`now`), else as soon as that moves nothing */
  shut(u: GatedUnit, now = false) {
    u.want = 'shut'
    if (!u.open || now || quiet(u)) return closeNow(u)
    recheck()
  },
  /** for tests */
  _units: units,
}
