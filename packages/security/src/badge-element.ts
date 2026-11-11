// <gully-security-badge>: the official "Secured by GullySecurity" badge, linking to the contract's public page on
// gullysecurity.xyz. The badge image is the brand kit's own file (secured-by-gullysecurity-{dark|light}.svg),
// loaded by URL and never redrawn (kit rule 1). By default the files are read from gullysecurity.xyz/brand/badges/,
// where the site serves the same bytes; `asset-base` points elsewhere (for example this package's assets/ folder
// on a CDN).
//
// Attributes:
//   chain        chain key or id: ethereum, base, arbitrum, optimism, polygon, bnb, avalanche, gully (or 485590)
//   address      the contract address
//   theme        dark (default) | light
//   size         badge width in px, one of the kit's allowed sizes: 142 | 214 (default) | 285 | 356
//   data         what to read from the API: auto (default: published report, then Gully Score) | report | score | none
//   href         link target override (default: the published report page, else the Gully Score page)
//   base-url     the Gully Security origin (default https://gullysecurity.xyz)
//   asset-base   where the badge files live (default <base-url>/brand/badges)
//   caption      show | hide (default show): the one-line status under the badge
//
// Events: `gully-security-badge:load` with { detail: { report, score } } when data arrived, `:error` on failure.

import { GullySecurity, DEFAULT_BASE_URL } from './client'
import { isAddress, resolveChain } from './chains'
import type { GullyScore, ReportSummary } from './types'

export const BADGE_TAG = 'gully-security-badge'
/** The kit's allowed badge display widths (285:80 ratio). */
export const BADGE_SIZES = [142, 214, 285, 356] as const
export type BadgeSize = (typeof BADGE_SIZES)[number]
export type BadgeTheme = 'dark' | 'light'
export type BadgeData = 'auto' | 'report' | 'score' | 'none'

export const BADGE_FILES: Record<BadgeTheme, string> = {
  dark: 'secured-by-gullysecurity-dark.svg',
  light: 'secured-by-gullysecurity-light.svg',
}

export interface SecurityBadgeDefaults {
  baseUrl?: string
  /** Where the badge files live; default `<baseUrl>/brand/badges`. */
  assetBase?: string
  fetch?: typeof globalThis.fetch
}

export interface SecurityBadgeState {
  report: ReportSummary | null
  score: GullyScore | null
  error: string | null
}

const STYLE = `
:host { display: inline-block; line-height: 0; font: 12px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 6px; text-decoration: none; color: inherit; outline-offset: 3px; }
a:focus-visible { outline: 2px solid #F2B232; border-radius: 6px; }
img { display: block; border: 0; }
.cap { line-height: 1.3; color: #898781; white-space: nowrap; }
.cap b { font-weight: 600; }
:host([theme="light"]) .cap b { color: #16161A; }
:host(:not([theme="light"])) .cap b { color: #C9CACC; }
.cap .good { color: #0ca30c; }
.cap .warn { color: #d03b3b; }
.cap .gold { color: #F2B232; }
:host([theme="light"]) .cap .gold { color: #A86B0A; }
.cap .sev { color: #d03b3b; }
`

let defaults: Required<Pick<SecurityBadgeDefaults, 'baseUrl'>> & SecurityBadgeDefaults = { baseUrl: DEFAULT_BASE_URL }

const ATTRS = ['chain', 'address', 'theme', 'size', 'data', 'href', 'base-url', 'asset-base', 'caption']

// Without a DOM (Node, SSR) the class still loads; it is only constructed by customElements in a browser.
const Base: typeof HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement)

/** A `<gully-security-badge>` element. Exported for typing and for defining under another tag name. */
export class GullySecurityBadgeElement extends Base {
  static get observedAttributes(): string[] {
    return ATTRS
  }

  private root: ShadowRoot
  private seq = 0
  /** The last data read for this chain/address (null before the first load). */
  state: SecurityBadgeState = { report: null, score: null, error: null }

  constructor() {
    super()
    this.root = this.attachShadow({ mode: 'open' })
  }

  connectedCallback(): void {
    this.render()
    void this.load()
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return
    this.render()
    void this.load()
  }

  /* ---------------------------------------------------------- derived --- */

  get baseUrl(): string {
    return (this.getAttribute('base-url') || defaults.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
  }
  get assetBase(): string {
    return (this.getAttribute('asset-base') || defaults.assetBase || `${this.baseUrl}/brand/badges`).replace(/\/+$/, '')
  }
  get theme(): BadgeTheme {
    return this.getAttribute('theme') === 'light' ? 'light' : 'dark'
  }
  get size(): BadgeSize {
    const n = Number(this.getAttribute('size'))
    return (BADGE_SIZES as readonly number[]).includes(n) ? (n as BadgeSize) : 214
  }
  get dataMode(): BadgeData {
    const d = this.getAttribute('data')
    return d === 'report' || d === 'score' || d === 'none' ? d : 'auto'
  }
  /** The badge image URL: the kit file for the theme, unmodified. */
  get imageUrl(): string {
    return `${this.assetBase}/${BADGE_FILES[this.theme]}`
  }
  private target(): { chainKey: string; address: string } | null {
    const c = resolveChain(this.getAttribute('chain') ?? '')
    const a = this.getAttribute('address') ?? ''
    return c && isAddress(a) ? { chainKey: c.key, address: a.toLowerCase() } : null
  }
  /** Where the badge links: `href` attribute, else the published report, else the Gully Score page, else the site. */
  get linkUrl(): string {
    const h = this.getAttribute('href')
    if (h) return h
    const t = this.target()
    if (!t) return `${this.baseUrl}/`
    if (this.state.report) return `${this.baseUrl}/reports/${encodeURIComponent(this.state.report.id)}`
    return `${this.baseUrl}/score/${t.chainKey}/${t.address}`
  }

  /* ------------------------------------------------------------- data --- */

  /** Re-reads the published report and the Gully Score for the current chain/address. */
  async load(): Promise<void> {
    const my = ++this.seq
    const t = this.target()
    const mode = this.dataMode
    this.state = { report: null, score: null, error: null }
    if (!t || mode === 'none') return this.render()
    const client = new GullySecurity({ baseUrl: this.baseUrl, fetch: defaults.fetch, timeoutMs: 15_000 })
    const want = { report: mode === 'auto' || mode === 'report', score: mode === 'auto' || mode === 'score' }
    const [rep, sc] = await Promise.all([
      want.report ? client.findReports(t.chainKey, t.address).then((r) => r[0] ?? null, () => null) : Promise.resolve(null),
      want.score ? client.score(t.chainKey, t.address).then((s) => s, () => null) : Promise.resolve(null),
    ])
    if (my !== this.seq) return
    const nothing = want.report && want.score && !rep && !sc
    this.state = { report: rep, score: sc, error: nothing ? 'No published report or score was read.' : null }
    this.render()
    this.dispatchEvent(new CustomEvent(this.state.error ? `${BADGE_TAG}:error` : `${BADGE_TAG}:load`, { detail: { report: rep, score: sc }, bubbles: true, composed: true }))
  }

  /* ----------------------------------------------------------- render --- */

  private render(): void {
    const w = this.size
    const h = Math.round((w * 80) / 285)
    const t = this.target()
    const label = this.ariaText()
    const showCap = this.getAttribute('caption') !== 'hide'
    const a = el('a', { href: this.linkUrl, target: '_blank', rel: 'noopener noreferrer', 'aria-label': label })
    a.appendChild(el('img', { src: this.imageUrl, width: String(w), height: String(h), alt: 'Secured by GullySecurity', loading: 'lazy', decoding: 'async' }))
    if (showCap && t) {
      const cap = el('span', { class: 'cap', 'aria-hidden': 'true' })
      cap.innerHTML = this.captionHtml()
      a.appendChild(cap)
    }
    const style = document.createElement('style')
    style.textContent = STYLE
    this.root.replaceChildren(style, a)
  }

  private captionHtml(): string {
    const { report, score } = this.state
    const parts: string[] = []
    if (score && typeof score.score === 'number') {
      const tone = score.score >= 80 ? 'good' : score.score >= 40 ? 'gold' : 'warn'
      parts.push(`Gully Score <b class="${tone}">${score.score} ${esc(score.grade ?? '')}</b>`)
    }
    if (report) {
      const c = report.counts
      const bad = c ? (c.critical ?? 0) + (c.high ?? 0) : 0
      parts.push(`Report published ${esc(dateOf(report.publishedAt))}${c ? ` (<span class="${bad ? 'sev' : ''}">${bad} critical/high</span>)` : ''}`)
    }
    if (!parts.length) parts.push(this.dataMode === 'none' ? 'View on Gully Security' : score && score.score === null ? 'Gully Score: not enough public data yet' : 'Not scanned yet. View on Gully Security')
    return parts.join(' &middot; ')
  }

  private ariaText(): string {
    const t = this.target()
    const chain = resolveChain(this.getAttribute('chain') ?? '')?.name
    const where = t ? ` for ${short(t.address)}${chain ? ` on ${chain}` : ''}` : ''
    const { report, score } = this.state
    const bits: string[] = []
    if (score && typeof score.score === 'number') bits.push(`Gully Score ${score.score} out of 100, ${score.grade}`)
    if (report) bits.push(`report published ${dateOf(report.publishedAt)}`)
    return `Secured by GullySecurity${where}${bits.length ? `: ${bits.join(', ')}` : ''}. Opens gullysecurity.xyz in a new tab.`
  }
}

/**
 * Defines `<gully-security-badge>` (once). Pass defaults for every badge on the page: `baseUrl`, `assetBase`
 * (where the kit's badge files live) and `fetch`. Safe to call in SSR (no-op without a DOM).
 */
export function defineSecurityBadge(options: SecurityBadgeDefaults = {}, tag: string = BADGE_TAG): void {
  defaults = { ...defaults, ...options, baseUrl: (options.baseUrl ?? defaults.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '') }
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return
  if (!customElements.get(tag)) customElements.define(tag, GullySecurityBadgeElement)
}

/* -------------------------------------------------------------- helpers --- */

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`
function dateOf(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

declare global {
  interface HTMLElementTagNameMap {
    'gully-security-badge': GullySecurityBadgeElement
  }
}
