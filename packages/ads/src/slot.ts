/**
 * <gully-ad-slot slot="watch_rail" site="pk_…"></gully-ad-slot>
 *
 * Requests one creative through the signed serve request, renders it inside a Shadow DOM with images and links only,
 * counts the impression once it has been at least 50% visible for `beacons.minVisibleMs`, and collapses on no-fill,
 * `ads_disabled` or a 404.
 */
import { adsConfig, GullyAds } from './client'
import { safeHttpsUrl, safeText } from './sanitize'
import type { AdCreative, ServeQuery, ServeResponse } from './types'

export const AD_SLOT_TAG = 'gully-ad-slot'

const ATTRS = ['slot', 'site', 'page', 'topic', 'creator', 'content', 'content-price', 'duration-sec', 'n', 'base-url', 'sign-url', 'label', 'member', 'ad-free', 'gated', 'access'] as const

const CSS = `
:host{display:block;box-sizing:border-box;font:14px/1.4 Inter,system-ui,sans-serif;color:inherit}
:host([data-state="empty"]),:host([hidden]){display:none}
.card{position:relative;display:grid;gap:8px;border:1px solid rgba(127,127,127,.25);border-radius:12px;padding:12px;background:inherit}
.tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.7}
.tag b{border:1px solid currentColor;border-radius:4px;padding:0 4px;font-weight:600}
img{display:block;width:100%;height:auto;border-radius:8px}
h3{margin:0;font-size:15px;line-height:1.3}
p{margin:0;opacity:.85}
a.cta{display:inline-block;justify-self:start;padding:6px 12px;border-radius:999px;background:#10b981;color:#0b0f0e;font-weight:600;text-decoration:none}
.row{display:flex;gap:10px;font-size:11px;opacity:.6}
.row button{all:unset;cursor:pointer;text-decoration:underline}
.why{font-size:11px;opacity:.7}
`

export interface AdSlotEventMap {
  'gully-ad:fill': CustomEvent<{ ad: AdCreative }>
  'gully-ad:empty': CustomEvent<{ reason: string; status?: number }>
  'gully-ad:impression': CustomEvent<{ ad: AdCreative; visibleMs: number }>
  'gully-ad:click': CustomEvent<{ ad: AdCreative }>
  'gully-ad:error': CustomEvent<{ error: unknown }>
}

export class GullyAdSlot extends HTMLElement {
  static get observedAttributes() {
    return [...ATTRS]
  }

  /** the creative currently shown */
  ad: AdCreative | null = null
  private root: ShadowRoot
  private io: IntersectionObserver | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private visibleSince = 0
  private impressionSent = false
  private loading: Promise<void> | null = null
  private connected = false

  constructor() {
    super()
    this.root = this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.connected = true
    void this.load()
  }

  disconnectedCallback() {
    this.connected = false
    this.stopWatching()
  }

  attributeChangedCallback(_name: string, oldV: string | null, newV: string | null) {
    if (this.connected && oldV !== newV && oldV !== null) void this.load()
  }

  private attr(name: string): string | undefined {
    const v = this.getAttribute(name)
    return v === null || v === '' ? undefined : v
  }

  private flag(name: string): boolean | undefined {
    const v = this.getAttribute(name)
    if (v === null) return undefined
    return v === '' || v === '1' || v === 'true'
  }

  /** the serve query this element sends */
  serveQuery(): ServeQuery {
    const num = (s: string | undefined) => (s === undefined || !Number.isFinite(Number(s)) ? undefined : Number(s))
    return {
      slot: this.attr('slot') ?? '',
      page: this.attr('page'),
      topic: this.attr('topic'),
      creator: this.attr('creator'),
      content: this.attr('content'),
      contentPrice: this.attr('content-price') as ServeQuery['contentPrice'],
      durationSec: num(this.attr('duration-sec')),
      n: 1,
      member: this.flag('member'),
      adFree: this.flag('ad-free'),
      gated: this.flag('gated'),
      access: this.attr('access'),
    }
  }

  private client(): GullyAds {
    const shared = adsConfig()
    return new GullyAds({
      ...shared,
      baseUrl: this.attr('base-url') ?? shared.baseUrl,
      siteId: this.attr('site') ?? shared.siteId,
      signUrl: this.attr('sign-url') ?? shared.signUrl,
      getSignedServe: this.attr('sign-url') ? undefined : shared.getSignedServe,
    })
  }

  /** (Re)load the creative. Safe to call again after changing attributes. */
  load(): Promise<void> {
    if (this.loading) return this.loading
    this.loading = this.doLoad().finally(() => (this.loading = null))
    return this.loading
  }

  private async doLoad() {
    this.stopWatching()
    this.ad = null
    this.impressionSent = false
    const q = this.serveQuery()
    if (!q.slot) return this.empty('no_slot')
    let res: ServeResponse
    try {
      res = await this.client().serve(q)
    } catch (error) {
      this.emit('gully-ad:error', { error })
      return this.empty('error')
    }
    const ad = res.ads[0]
    if (!ad || !ad.serve) return this.empty(res.reason ?? 'no_fill', res.status)
    this.ad = ad
    this.render(ad)
    this.setAttribute('data-state', 'filled')
    this.removeAttribute('hidden')
    this.emit('gully-ad:fill', { ad })
    this.watch(ad)
  }

  private empty(reason: string, status?: number) {
    this.root.replaceChildren()
    this.setAttribute('data-state', 'empty')
    this.setAttribute('hidden', '')
    this.emit('gully-ad:empty', { reason, status })
  }

  private emit<K extends keyof AdSlotEventMap>(type: K, detail: AdSlotEventMap[K]['detail']) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
  }

  /** DOM only, textContent only: no HTML from the creative ever reaches innerHTML. */
  private render(ad: AdCreative) {
    const d = this.ownerDocument
    const style = d.createElement('style')
    style.textContent = CSS
    const card = d.createElement('div')
    card.className = 'card'
    card.setAttribute('role', 'complementary')
    card.setAttribute('aria-label', 'Advertisement')

    const tag = d.createElement('div')
    tag.className = 'tag'
    const b = d.createElement('b')
    b.textContent = this.attr('label') ?? 'Ad'
    tag.append(b, d.createTextNode(safeText(ad.label, 24) || 'Sponsored'))
    const adv = safeText(ad.advertiser, 40)
    if (adv) tag.append(d.createTextNode(` · ${adv}`))
    card.append(tag)

    const href = safeHttpsUrl(ad.clickTrackUrl) ?? safeHttpsUrl(ad.clickUrl)
    const link = (child: HTMLElement) => {
      if (!href) return child
      const a = d.createElement('a')
      a.href = href
      a.target = '_blank'
      a.rel = 'noopener sponsored'
      a.addEventListener('click', () => this.emit('gully-ad:click', { ad }))
      a.append(child)
      return a
    }

    const img = safeHttpsUrl(ad.imageUrl)
    if (img) {
      const i = d.createElement('img')
      i.src = img
      i.alt = safeText(ad.headline, 70)
      i.loading = 'lazy'
      i.decoding = 'async'
      i.referrerPolicy = 'no-referrer'
      card.append(link(i))
    }
    const h = d.createElement('h3')
    h.textContent = safeText(ad.headline, 70)
    card.append(link(h))
    const body = safeText(ad.body, 200)
    if (body) {
      const p = d.createElement('p')
      p.textContent = body
      card.append(p)
    }
    const by = safeText(ad.presentedBy, 40)
    if (by) {
      const p = d.createElement('p')
      p.className = 'why'
      p.textContent = `Presented by ${by}`
      card.append(p)
    }
    if (href) {
      const a = d.createElement('a')
      a.className = 'cta'
      a.href = href
      a.target = '_blank'
      a.rel = 'noopener sponsored'
      a.textContent = safeText(ad.cta, 24) || 'Learn more'
      a.addEventListener('click', () => this.emit('gully-ad:click', { ad }))
      card.append(a)
    }

    const row = d.createElement('div')
    row.className = 'row'
    const why = d.createElement('button')
    why.type = 'button'
    why.textContent = safeText(ad.whyLabel, 24) || 'Why this ad?'
    const whyText = d.createElement('div')
    whyText.className = 'why'
    whyText.hidden = true
    whyText.textContent = safeText(ad.why, 400)
    why.addEventListener('click', () => (whyText.hidden = !whyText.hidden))
    const hide = d.createElement('button')
    hide.type = 'button'
    hide.textContent = 'Hide'
    hide.addEventListener('click', () => {
      void this.client().hide(ad).catch(() => null)
      this.stopWatching()
      this.empty('hidden')
    })
    row.append(why, hide)
    card.append(row, whyText)
    this.root.replaceChildren(style, card)
  }

  // ---------------------------------------------------------------- viewability

  private watch(ad: AdCreative) {
    const min = Math.max(0, Number(ad.beacons?.minVisibleMs) || 1000)
    if (typeof IntersectionObserver === 'undefined') {
      // no observer (old browser / jsdom): assume visible from now on
      this.visibleSince = Date.now()
      this.timer = setTimeout(() => this.fire(ad, min), min)
      return
    }
    this.io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1]
        if (!e) return
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          if (this.timer === null && !this.impressionSent) {
            this.visibleSince = Date.now()
            this.timer = setTimeout(() => this.fire(ad, min), min)
          }
        } else if (this.timer !== null) {
          clearTimeout(this.timer)
          this.timer = null
          this.visibleSince = 0
        }
      },
      { threshold: [0, 0.5, 1] },
    )
    this.io.observe(this)
  }

  private fire(ad: AdCreative, min: number) {
    this.timer = null
    if (this.impressionSent) return
    this.impressionSent = true
    const visibleMs = Math.max(min, Date.now() - (this.visibleSince || Date.now()))
    this.stopWatching()
    void this.client().impression(ad, visibleMs).catch(() => null)
    this.emit('gully-ad:impression', { ad, visibleMs })
  }

  private stopWatching() {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.io?.disconnect()
    this.io = null
  }
}

/** Register the element (idempotent). Returns the tag name. */
export function defineAdSlot(tag: string = AD_SLOT_TAG): string {
  if (typeof customElements === 'undefined') return tag
  if (!customElements.get(tag)) customElements.define(tag, GullyAdSlot)
  return tag
}
