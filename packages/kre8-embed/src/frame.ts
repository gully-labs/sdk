/**
 * Mounts one sandboxed kre8 iframe and wires the message protocol. Framework-free; the web components and the React
 * wrapper both use it.
 *
 * Sandbox: `allow-scripts` (the player / bridge), `allow-same-origin` (the page keeps its kre8.fun origin so the host
 * can check event.origin and the coin card can refresh from its own .json), `allow-popups` +
 * `allow-popups-to-escape-sandbox` (the "Trade / Listen / Watch on kre8" links open a normal new tab). No forms, no
 * top navigation, no pointer lock, no downloads, no modals. The host never passes cookies, tokens or wallet state;
 * the only things in the URL are the kind, the id, the host origin and a random nonce.
 */
import { acceptEmbedEvent, isSafeOpenHref, type EmbedMessage } from './protocol'
import { buildEmbedSrc, EMBED_SIZE, newNonce, type EmbedKind } from './url'

export const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
export const IFRAME_REFERRER_POLICY = 'strict-origin-when-cross-origin'
const PLAYER_ALLOW = 'autoplay; encrypted-media; fullscreen; picture-in-picture'

export interface FrameOptions {
  kind: EmbedKind
  id: string
  embedOrigin: string
  /** the host document's origin (defaults to window.location.origin) */
  parentOrigin?: string
  title?: string
  /** called for every accepted message */
  onMessage?: (m: EmbedMessage) => void
  /** the element whose height follows the embed (defaults to the iframe itself) */
  autoHeight?: boolean
  /** injectable for tests */
  win?: Window
  doc?: Document
}

export interface FrameHandle {
  iframe: HTMLIFrameElement
  nonce: string
  src: string
  /** feed a message event by hand (tests, custom transports) */
  handle: (ev: MessageEvent | { origin: string; data: unknown; source?: unknown }) => EmbedMessage | null
  destroy: () => void
}

/** Create the iframe (not yet attached) and the window listener. Returns the handle; call destroy() when done. */
export function createEmbedFrame(o: FrameOptions): FrameHandle {
  const win = o.win ?? window
  const doc = o.doc ?? win.document
  const parentOrigin = o.parentOrigin ?? win.location.origin
  const nonce = newNonce()
  const src = buildEmbedSrc({ kind: o.kind, id: o.id, embedOrigin: o.embedOrigin, parentOrigin, nonce })
  const size = EMBED_SIZE[o.kind]

  const iframe = doc.createElement('iframe')
  iframe.src = src
  iframe.title = o.title ?? defaultTitle(o.kind)
  iframe.setAttribute('sandbox', IFRAME_SANDBOX)
  iframe.setAttribute('referrerpolicy', IFRAME_REFERRER_POLICY)
  iframe.setAttribute('loading', 'lazy')
  iframe.setAttribute('allow', o.kind === 'coin' ? '' : PLAYER_ALLOW)
  if (o.kind !== 'coin') iframe.setAttribute('allowfullscreen', '')
  iframe.setAttribute('scrolling', 'no')
  iframe.width = String(size.width)
  iframe.height = String(size.height)
  iframe.style.border = '0'
  iframe.style.display = 'block'
  iframe.style.width = '100%'
  iframe.style.maxWidth = '100%'
  iframe.style.height = `${size.height}px`
  iframe.style.colorScheme = 'dark'

  const autoHeight = o.autoHeight ?? (o.kind === 'coin' || o.kind === 'track')

  const handle = (ev: { origin: string; data: unknown; source?: unknown }): EmbedMessage | null => {
    const m = acceptEmbedEvent(ev, o.embedOrigin, nonce, iframe.contentWindow ?? undefined)
    if (!m) return null
    if (m.type === 'open' && !isSafeOpenHref(m.href, o.embedOrigin)) return null
    if ((m.type === 'resize' || m.type === 'ready') && autoHeight) {
      iframe.style.height = `${m.height}px`
      iframe.height = String(m.height)
    }
    o.onMessage?.(m)
    return m
  }
  const listener = (ev: MessageEvent) => {
    handle(ev)
  }
  win.addEventListener('message', listener)

  return {
    iframe,
    nonce,
    src,
    handle,
    destroy: () => {
      win.removeEventListener('message', listener)
      iframe.remove()
    },
  }
}

export function defaultTitle(kind: EmbedKind): string {
  switch (kind) {
    case 'coin':
      return 'Coin on kre8'
    case 'track':
      return 'Track on kre8'
    case 'video':
      return 'Video on kre8'
    case 'short':
      return 'Short on kre8'
    case 'live':
      return 'Live on kre8'
  }
}

/** Open a kre8 page in a new tab without a window reference or referrer (every money action goes through here). */
export function openKre8(url: string, embedOrigin: string, win: Window = window): boolean {
  if (!isSafeOpenHref(url, embedOrigin)) return false
  const w = win.open(url, '_blank', 'noopener,noreferrer')
  // some browsers hand back the window despite noopener; cut the link anyway
  if (w) {
    try {
      w.opener = null
    } catch {
      /* cross-origin: already detached */
    }
  }
  return true
}
