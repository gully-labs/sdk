/**
 * The web components. Each has a Shadow DOM styled with the kre8 Night Stage tokens (GRAPHICS/kre8_brand_kit
 * code/tokens.css): bg #0A0D14, surface #0E1420, line #1E2634, text #F4EDDD, yellow #FFE81A only as a fill with ink
 * #0B0F18 on it, Poppins display, Manrope body, IBM Plex Mono for labels. The loading state shows the kit icon PNG
 * served byte-identical from kre8.fun (/embed/brand/kre8-icon-128.png); nothing is redrawn.
 *
 *   <kre8-coin-card coin="0x..."></kre8-coin-card>
 *   <kre8-player track="..."></kre8-player>   (or video / short / live; drop is reserved, see README)
 *   <kre8-back-button creator="alice.gully"></kre8-back-button>
 *
 * Events on the host element (CustomEvent, bubbles, composed): kre8-ready, kre8-resize, kre8-open, kre8-error, kre8-back.
 */
import { createEmbedFrame, openKre8, type FrameHandle } from './frame'
import { resolveEmbedOrigin } from './origins'
import type { EmbedMessage } from './protocol'
import { backUrl, EMBED_SIZE, isCreatorRef, isValidEmbedId, kitIconUrl, type EmbedKind } from './url'

export const COIN_CARD_TAG = 'kre8-coin-card'
export const PLAYER_TAG = 'kre8-player'
export const BACK_BUTTON_TAG = 'kre8-back-button'

/** SSR-safe base: in Node there is no HTMLElement, so the class is only a shell until it runs in a browser. */
const HostBase: typeof HTMLElement = typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement

const TOKENS = `:host{--k8-bg:#0A0D14;--k8-surface:#0E1420;--k8-surface2:#131A28;--k8-line:#1E2634;--k8-text:#F4EDDD;--k8-text2:#B9BFCC;--k8-text3:#6E7688;--k8-yellow:#FFE81A;--k8-ink:#0B0F18;--k8-down:#D8705F;--k8-r-card:19px;--k8-r-pill:999px;--k8-font-sans:"Manrope",system-ui,sans-serif;--k8-font-display:"Poppins",var(--k8-font-sans);--k8-font-mono:"IBM Plex Mono",ui-monospace,monospace;display:block;max-width:100%;color:var(--k8-text);font-family:var(--k8-font-sans)}
:host([hidden]){display:none}
*{box-sizing:border-box}
.wrap{position:relative;border-radius:var(--k8-r-card);overflow:hidden;background:var(--k8-bg)}
iframe{display:block;border:0;width:100%}
.ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:var(--k8-surface);border:1px solid var(--k8-line);border-radius:var(--k8-r-card);color:var(--k8-text3);font:500 10px/1.4 var(--k8-font-mono);letter-spacing:.14em;text-transform:uppercase;transition:opacity .25s ease}
.ph img{width:40px;height:40px;border-radius:12px}
.ph.off{opacity:0;pointer-events:none}
.ph.err{color:var(--k8-text2);text-transform:none;letter-spacing:0;font:500 13px/1.4 var(--k8-font-sans);padding:16px;text-align:center}
.ph.err a{color:var(--k8-yellow);font-weight:700;text-decoration:none}
@media (prefers-reduced-motion:reduce){.ph{transition:none}}`

const BUTTON_CSS = `${TOKENS}
:host{display:inline-block}
button{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 18px;border:0;border-radius:var(--k8-r-pill);background:var(--k8-yellow);color:var(--k8-ink);font:700 14px/1 var(--k8-font-sans);cursor:pointer;position:relative;overflow:hidden;white-space:nowrap}
button img{width:18px;height:18px;border-radius:5px}
button .arrow{display:inline-block;transition:transform .2s cubic-bezier(.2,.9,.25,1.15)}
button:hover .arrow{transform:translateX(4px)}
button:focus-visible{outline:2px solid var(--k8-text);outline-offset:2px}
button:disabled{opacity:.5;cursor:not-allowed}
:host([size="sm"]) button{height:36px;padding:0 14px;font-size:13px}
:host([size="lg"]) button{height:52px;padding:0 22px;font-size:15px}
@media (prefers-reduced-motion:reduce){button .arrow{transition:none}}`

function emit(el: HTMLElement, name: string, detail: unknown) {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
}

/** Shared iframe host: subclasses say which kind / id the attributes describe. */
abstract class Kre8FrameElement extends HostBase {
  static get observedAttributes() {
    return ['origin', 'dev-origin', 'title', 'coin', 'track', 'video', 'short', 'live', 'drop']
  }
  protected frame: FrameHandle | null = null
  private root: ShadowRoot | null = null
  private wrap: HTMLDivElement | null = null
  private ph: HTMLDivElement | null = null

  /** the kind and id the current attributes describe, or an error message */
  protected abstract target(): { kind: EmbedKind; id: string } | { error: string }

  get embedOrigin(): string {
    return resolveEmbedOrigin({ origin: this.getAttribute('origin'), devOrigin: this.getAttribute('dev-origin') })
  }

  /** the iframe src in use (null before connect / on error) */
  get src(): string | null {
    return this.frame?.src ?? null
  }

  connectedCallback() {
    if (!this.root) {
      this.root = this.attachShadow({ mode: 'open' })
      const style = document.createElement('style')
      style.textContent = TOKENS
      this.wrap = document.createElement('div')
      this.wrap.className = 'wrap'
      this.ph = document.createElement('div')
      this.ph.className = 'ph'
      this.ph.setAttribute('aria-live', 'polite')
      this.wrap.append(this.ph)
      this.root.append(style, this.wrap)
    }
    this.mount()
  }

  disconnectedCallback() {
    this.unmount()
  }

  attributeChangedCallback() {
    if (this.isConnected && this.root) this.mount()
  }

  private unmount() {
    this.frame?.destroy()
    this.frame = null
  }

  private placeholder(kind: EmbedKind | null, text: string, err = false) {
    const ph = this.ph
    if (!ph || !this.wrap) return
    ph.className = err ? 'ph err' : 'ph'
    ph.replaceChildren()
    let origin: string | null = null
    try {
      origin = this.embedOrigin
    } catch {
      origin = null
    }
    if (origin) {
      const img = document.createElement('img')
      img.src = kitIconUrl(origin)
      img.alt = ''
      img.setAttribute('aria-hidden', 'true')
      ph.append(img)
    }
    const span = document.createElement('span')
    span.textContent = text
    ph.append(span)
    const h = kind ? EMBED_SIZE[kind].height : 120
    this.wrap.style.minHeight = `${h}px`
  }

  private mount() {
    this.unmount()
    if (!this.wrap || !this.ph) return
    const t = this.target()
    let origin: string
    try {
      origin = this.embedOrigin
    } catch (e) {
      this.placeholder(null, (e as Error).message, true)
      emit(this, 'kre8-error', { message: (e as Error).message })
      return
    }
    if ('error' in t) {
      this.placeholder(null, t.error, true)
      emit(this, 'kre8-error', { message: t.error })
      return
    }
    this.placeholder(t.kind, 'Loading from kre8')
    const ph = this.ph
    const frame = createEmbedFrame({
      kind: t.kind,
      id: t.id,
      embedOrigin: origin,
      title: this.getAttribute('title') ?? undefined,
      onMessage: (m: EmbedMessage) => {
        if (m.type === 'ready') {
          ph.classList.add('off')
          this.wrap!.style.minHeight = ''
          emit(this, 'kre8-ready', m)
        } else if (m.type === 'resize') emit(this, 'kre8-resize', m)
        else if (m.type === 'open') emit(this, 'kre8-open', m)
        else if (m.type === 'error') {
          this.placeholder(t.kind, m.message, true)
          emit(this, 'kre8-error', m)
        }
      },
    })
    this.frame = frame
    this.wrap.insertBefore(frame.iframe, ph)
  }
}

/** `<kre8-coin-card coin="0x...">`: a Gully Chain coin's name, ticker, icon, price, market cap, 24h change and 24h sparkline. */
export class Kre8CoinCardElement extends Kre8FrameElement {
  protected target() {
    const coin = this.getAttribute('coin')
    if (!coin) return { error: 'Set coin="0x..." (a Gully Chain coin address).' }
    if (!isValidEmbedId('coin', coin)) return { error: 'coin must be a 0x address.' }
    return { kind: 'coin' as const, id: coin }
  }
}

const PLAYER_ATTRS: readonly EmbedKind[] = ['track', 'video', 'short', 'live']

/** `<kre8-player track="..." | video="..." | short="..." | live="...">`: the kre8 player for one item. */
export class Kre8PlayerElement extends Kre8FrameElement {
  protected target() {
    const set = PLAYER_ATTRS.filter((k) => this.hasAttribute(k))
    if (set.length > 1) return { error: 'Set only one of track, video, short or live.' }
    const kind = set[0]
    if (!kind) {
      if (this.hasAttribute('drop')) return { error: 'Drops are not on kre8 yet. Use track, video, short or live.' }
      return { error: 'Set track="...", video="...", short="..." or live="...".' }
    }
    const id = this.getAttribute(kind) ?? ''
    if (!isValidEmbedId(kind, id)) return { error: `${kind} id is not valid.` }
    return { kind, id }
  }
}

/**
 * `<kre8-back-button creator="alice.gully">`: "Back this" opens the creator's kre8 page in a new tab (noopener,
 * noreferrer). It renders on the host page (no iframe): the click keeps its user activation, so the new tab is never
 * blocked, and no money or sign-in ever touches the host page.
 */
export class Kre8BackButtonElement extends HostBase {
  static get observedAttributes() {
    return ['creator', 'label', 'origin', 'dev-origin', 'size', 'disabled']
  }
  private root: ShadowRoot | null = null
  private button: HTMLButtonElement | null = null

  get embedOrigin(): string {
    return resolveEmbedOrigin({ origin: this.getAttribute('origin'), devOrigin: this.getAttribute('dev-origin') })
  }

  /** the kre8 URL the button opens, or null while the attributes are not valid */
  get href(): string | null {
    const creator = this.getAttribute('creator')
    if (!creator || !isCreatorRef(creator)) return null
    try {
      return backUrl(this.embedOrigin, creator)
    } catch {
      return null
    }
  }

  connectedCallback() {
    if (!this.root) {
      this.root = this.attachShadow({ mode: 'open' })
      const style = document.createElement('style')
      style.textContent = BUTTON_CSS
      this.button = document.createElement('button')
      this.button.type = 'button'
      this.button.addEventListener('click', () => this.activate())
      this.root.append(style, this.button)
    }
    this.render()
  }

  attributeChangedCallback() {
    if (this.root) this.render()
  }

  /** What a click does: opens kre8 in a new tab (noopener) and emits kre8-back. Returns false when nothing opened. */
  activate(): boolean {
    const url = this.href
    if (!url) return false
    let origin: string
    try {
      origin = this.embedOrigin
    } catch {
      return false
    }
    const opened = openKre8(url, origin)
    if (opened) emit(this, 'kre8-back', { creator: this.getAttribute('creator'), href: url })
    return opened
  }

  private render() {
    const b = this.button
    if (!b) return
    b.replaceChildren()
    const url = this.href
    b.disabled = !url || this.hasAttribute('disabled')
    b.setAttribute('aria-label', `${this.getAttribute('label') ?? 'Back this'} on kre8`)
    if (url) {
      const img = document.createElement('img')
      img.src = kitIconUrl(this.embedOrigin)
      img.alt = ''
      img.setAttribute('aria-hidden', 'true')
      b.append(img)
    }
    const label = document.createElement('span')
    label.textContent = url ? (this.getAttribute('label') ?? 'Back this') : 'Set creator'
    const arrow = document.createElement('span')
    arrow.className = 'arrow'
    arrow.setAttribute('aria-hidden', 'true')
    arrow.textContent = '→'
    b.append(label, arrow)
  }
}

/** Register the three elements (safe to call twice; a no-op outside a browser). */
export function defineKre8Embeds(): void {
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return
  if (!customElements.get(COIN_CARD_TAG)) customElements.define(COIN_CARD_TAG, Kre8CoinCardElement)
  if (!customElements.get(PLAYER_TAG)) customElements.define(PLAYER_TAG, Kre8PlayerElement)
  if (!customElements.get(BACK_BUTTON_TAG)) customElements.define(BACK_BUTTON_TAG, Kre8BackButtonElement)
}

declare global {
  interface HTMLElementTagNameMap {
    'kre8-coin-card': Kre8CoinCardElement
    'kre8-player': Kre8PlayerElement
    'kre8-back-button': Kre8BackButtonElement
  }
}
