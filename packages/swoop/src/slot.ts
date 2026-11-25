/**
 * <gully-ad-slot slot="watch_rail" site="pk_…" size="728x90"></gully-ad-slot>
 *
 * Requests one creative through the signed serve request, renders it inside a Shadow DOM with images and links only, at exactly
 * the `size` you give (one of the listed sizes), counts the impression once it has been at least 50% visible for
 * `beacons.minVisibleMs`, and takes no space on no-fill, `ads_disabled`, a 404 or anything that breaks the ad rules (./rules.ts,
 * docs.swoopads.xyz/ad-rules): no size or a size the space cannot hold, a creative that does not fit the size exactly, video or
 * audio, a money, sign-in or form page, a fixed or sticky container. The slot opens only while it is off screen (zero layout
 * shift), and on phones only one screen away from any other open Swoop unit.
 */
import { adsConfig, GullyAds } from './client'
import { ALL_SIZES, gate, parseSize, refusal, type GatedUnit } from './rules'
import { safeHttpsUrl, safeText } from './sanitize'
import type { AdCreative, ServeQuery, ServeResponse } from './types'

export const AD_SLOT_TAG = 'gully-ad-slot'

const ATTRS = ['slot', 'site', 'size', 'block', 'page', 'topic', 'creator', 'content', 'content-price', 'duration-sec', 'n', 'base-url', 'sign-url', 'label', 'member', 'ad-free', 'gated', 'access'] as const

const CSS = `
:host{display:block;box-sizing:border-box;overflow:hidden;height:0;font:14px/1.35 Inter,system-ui,sans-serif;color:inherit}
:host([data-state="empty"]),:host([hidden]){display:none}
*{box-sizing:border-box}
.card{position:relative;display:flex;gap:10px;overflow:hidden;border:1px solid rgba(127,127,127,.25);border-radius:10px;padding:8px;background:inherit}
.card.banner{display:block;padding:0;border:0}
.banner img{display:block;width:100%;height:100%;border-radius:10px}
.banner .tag{position:absolute;top:6px;left:6px;background:Canvas;color:CanvasText;border-radius:4px;padding:1px 5px;opacity:.9}
.banner .row{position:absolute;bottom:6px;right:6px;background:Canvas;color:CanvasText;border-radius:4px;padding:1px 6px;opacity:.9}
.thumb{display:block;flex:none;border-radius:8px}
.col{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 auto}
.tag{display:flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.7;white-space:nowrap;overflow:hidden}
.tag b{border:1px solid currentColor;border-radius:4px;padding:0 4px;font-weight:600}
h3{margin:0;font-size:14px;line-height:1.3;max-height:2.6em;overflow:hidden;flex:0 1 auto;min-height:0}
p{margin:0;opacity:.85;overflow:hidden;flex:0 1 auto;min-height:0}
.foot{display:flex;align-items:center;gap:10px;margin-top:auto;flex:none}
a{color:inherit;text-decoration:none}
a.cta{display:inline-block;padding:4px 10px;border-radius:999px;background:#10b981;color:#0b0f0e;font-weight:600;white-space:nowrap}
.row{display:flex;gap:10px;font-size:11px;opacity:.6;margin-left:auto;white-space:nowrap}
.row button{all:unset;cursor:pointer;text-decoration:underline}
.why{position:absolute;inset:0;padding:8px;font-size:12px;background:Canvas;color:CanvasText;overflow:hidden}
.why[hidden]{display:none}
`

export interface AdSlotEventMap {
  'gully-ad:fill': CustomEvent<{ ad: AdCreative }>
  'gully-ad:empty': CustomEvent<{ reason: string; status?: number }>
  'gully-ad:impression': CustomEvent<{ ad: AdCreative; visibleMs: number }>
  'gully-ad:click': CustomEvent<{ ad: AdCreative }>
  'gully-ad:error': CustomEvent<{ error: unknown }>
}

/** SSR-safe base: Node has no HTMLElement, so importing the package on a server must not throw. */
const SlotBase: typeof HTMLElement = typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement

export class GullyAdSlot extends SlotBase {
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
  /** the open/close gate entry (rules.ts): this element is the box, height 0 until it may open */
  private g: GatedUnit | null = null
  private why = ''

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
    if (this.g) gate.remove(this.g)
    this.g = null
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

  /** The listed size this slot is drawn at, or why it cannot be drawn at all. */
  private sizeOrReason(): [number, number] | string {
    const size = this.attr('size')
    const wh = size && ALL_SIZES.includes(size) ? parseSize(size) : null
    if (!wh) return 'no_size'
    const avail = this.parentElement?.clientWidth || this.clientWidth || this.getBoundingClientRect().width
    return wh[0] <= avail ? wh : 'no_fit'
  }

  private async doLoad() {
    this.stopWatching()
    this.ad = null
    this.impressionSent = false
    const q = this.serveQuery()
    if (!q.slot) return this.empty('no_slot')
    const refused = refusal(this, { page: q.page, block: this.attr('block') })
    if (refused) return this.empty(refused)
    const wh = this.sizeOrReason()
    if (typeof wh === 'string') return this.empty(wh)
    let res: ServeResponse
    try {
      res = await this.client().serve(q)
    } catch (error) {
      this.emit('gully-ad:error', { error })
      return this.empty('error')
    }
    const ad = res.ads[0]
    if (!ad || !ad.serve) return this.empty(res.reason ?? 'no_fill', res.status)
    // images and text only: no video, no sound in a slot (the ad rules)
    if (ad.video || ad.audio || ad.type === 'video' || ad.type === 'audio') return this.empty('format_not_allowed')
    const img = safeHttpsUrl(ad.imageUrl) ? await loadImage(this.ownerDocument, safeHttpsUrl(ad.imageUrl)!) : null
    if (safeHttpsUrl(ad.imageUrl) && !img) return this.empty('image_error')
    if (!this.connected) return
    if (!this.render(ad, wh[0], wh[1], img)) return this.empty('size_mismatch')
    this.ad = ad
    this.setAttribute('data-state', 'waiting')
    this.removeAttribute('hidden')
    if (this.g) gate.remove(this.g)
    const g: GatedUnit = {
      box: this,
      h: wh[1],
      open: false,
      want: '',
      refused: () => refusal(this, { page: q.page, block: this.attr('block') }),
      onOpen: () => {
        this.setAttribute('data-state', 'filled')
        this.emit('gully-ad:fill', { ad })
        this.watch(ad)
      },
      onShut: () => this.collapse(this.why || 'refused'),
    }
    this.g = g
    gate.add(g)
    gate.open(g)
  }

  /** No ad here. An open slot in view waits (content hidden) until closing it moves nothing, unless the reader asked (`now`). */
  private empty(reason: string, status?: number, now = false) {
    this.why = reason
    this.stopWatching()
    if (this.g?.open && !now) {
      this.root.replaceChildren()
      this.status = status
      return gate.shut(this.g)
    }
    if (this.g) {
      this.g.want = 'shut'
      this.g.open = false
    }
    this.status = status
    this.collapse(reason)
  }
  private status: number | undefined
  private collapse(reason: string) {
    this.root.replaceChildren()
    this.style.height = '0px'
    this.setAttribute('data-state', 'empty')
    this.setAttribute('data-reason', reason)
    this.setAttribute('hidden', '')
    this.emit('gully-ad:empty', { reason, status: this.status })
  }

  private emit<K extends keyof AdSlotEventMap>(type: K, detail: AdSlotEventMap[K]['detail']) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
  }

  /**
   * DOM only, textContent only: no HTML from the creative ever reaches innerHTML. Draws the card at exactly w x h and says whether
   * it fits: an image the shape of the box (and at least as big) fills it; any other image keeps its shape at the box height beside
   * the text (at most 45% of the width); text that would be cut does not fit. False = draw nothing.
   */
  private render(ad: AdCreative, w: number, h: number, img: HTMLImageElement | null): boolean {
    const d = this.ownerDocument
    const style = d.createElement('style')
    style.textContent = CSS
    const card = d.createElement('div')
    card.className = 'card'
    card.style.width = `${w}px`
    card.style.height = `${h}px`
    card.setAttribute('role', 'complementary')
    card.setAttribute('aria-label', 'Advertisement')

    const tag = d.createElement('div')
    tag.className = 'tag'
    const b = d.createElement('b')
    b.textContent = this.attr('label') ?? 'Ad'
    tag.append(b, d.createTextNode(safeText(ad.label, 24) || 'Sponsored'))
    const adv = safeText(ad.advertiser, 40)
    if (adv) tag.append(d.createTextNode(` · ${adv}`))

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

    const row = d.createElement('div')
    row.className = 'row'
    const why = d.createElement('button')
    why.type = 'button'
    why.textContent = safeText(ad.whyLabel, 24) || 'Why this ad?'
    const whyText = d.createElement('div')
    whyText.className = 'why'
    whyText.hidden = true
    whyText.textContent = safeText(ad.why, 400)
    whyText.addEventListener('click', () => (whyText.hidden = true))
    why.addEventListener('click', () => (whyText.hidden = !whyText.hidden))
    const hide = d.createElement('button')
    hide.type = 'button'
    hide.textContent = 'Hide'
    hide.addEventListener('click', () => {
      void this.client().hide(ad).catch(() => null)
      this.empty('hidden', undefined, true)
    })
    row.append(why, hide)

    const ratio = img ? img.naturalWidth / img.naturalHeight : 0
    if (img && img.naturalWidth >= w && Math.abs(ratio - w / h) <= 0.01 * (w / h)) {
      card.classList.add('banner')
      const i = d.createElement('img')
      i.src = img.src
      i.alt = safeText(ad.headline, 70)
      i.width = w
      i.height = h
      i.referrerPolicy = 'no-referrer'
      card.append(link(i), tag, row, whyText)
    } else {
      if (img) {
        const th = h - 16
        const tw = Math.round(th * ratio)
        if (!(tw > 0 && tw <= 0.45 * w && img.naturalHeight >= th)) return false
        const t = d.createElement('img')
        t.className = 'thumb'
        t.src = img.src
        t.alt = ''
        t.width = tw
        t.height = th
        t.referrerPolicy = 'no-referrer'
        card.append(link(t))
      }
      const col = d.createElement('div')
      col.className = 'col'
      const hd = d.createElement('h3')
      hd.className = 'fit'
      hd.textContent = safeText(ad.headline, 70)
      col.append(tag, link(hd))
      const body = safeText(ad.body, 200)
      if (body) {
        const p = d.createElement('p')
        p.className = 'fit'
        p.textContent = body
        col.append(p)
      }
      const by = safeText(ad.presentedBy, 40)
      if (by) {
        const p = d.createElement('p')
        p.className = 'fit'
        p.textContent = `Presented by ${by}`
        col.append(p)
      }
      const foot = d.createElement('div')
      foot.className = 'foot'
      if (href) {
        const a = d.createElement('a')
        a.className = 'cta'
        a.href = href
        a.target = '_blank'
        a.rel = 'noopener sponsored'
        a.textContent = safeText(ad.cta, 24) || 'Learn more'
        a.addEventListener('click', () => this.emit('gully-ad:click', { ad }))
        foot.append(a)
      }
      foot.append(row)
      col.append(foot)
      card.append(col, whyText)
    }
    this.root.replaceChildren(style, card)
    if (card.scrollWidth > w + 1 || card.scrollHeight > h + 1) return false
    for (const el of Array.from(card.querySelectorAll<HTMLElement>('.fit'))) if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) return false
    return true
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

/** Load an image off screen to read its natural size (null when it fails). */
function loadImage(d: Document, src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const Img = (d.defaultView as unknown as { Image: typeof Image } | null)?.Image ?? Image
      const i = new Img()
      i.referrerPolicy = 'no-referrer'
      i.decoding = 'async'
      i.onload = () => resolve(i)
      i.onerror = () => resolve(null)
      i.src = src
    } catch {
      resolve(null)
    }
  })
}

/** Register the element (idempotent). Returns the tag name. */
export function defineAdSlot(tag: string = AD_SLOT_TAG): string {
  if (typeof customElements === 'undefined') return tag
  if (!customElements.get(tag)) customElements.define(tag, GullyAdSlot)
  return tag
}
