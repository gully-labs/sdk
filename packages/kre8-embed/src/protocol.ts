/**
 * The postMessage protocol between an embed page (kre8.fun /embed/*, bridge.js) and the host page. One direction only:
 * the embed posts, the host listens. Every message is `{ kre8: 1, v: 1, nonce, type, ... }`, posted with targetOrigin =
 * the host page's origin (never '*'). The host accepts a message only when
 *   1. event.origin is exactly the embed origin it loaded the iframe from,
 *   2. event.source is that iframe's window (when known),
 *   3. the nonce is this instance's nonce,
 *   4. the body matches one of the four shapes below.
 * The host never sends anything into the iframe; there is nothing to send.
 */
import { EMBED_KINDS, type EmbedKind } from './url'

export const PROTOCOL_VERSION = 1

export type EmbedMessage =
  | { type: 'ready'; kind: EmbedKind | 'unavailable'; id: string; height: number }
  | { type: 'resize'; height: number }
  | { type: 'open'; href: string }
  | { type: 'error'; message: string }

const MAX_HEIGHT = 4000

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const height = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= MAX_HEIGHT ? Math.ceil(v) : null)

/** The message a raw `event.data` carries for `nonce`, or null when it is anything else. Pure, never throws. */
export function parseEmbedMessage(data: unknown, nonce: string): EmbedMessage | null {
  if (!isObj(data)) return null
  if (data.kre8 !== 1 || data.v !== PROTOCOL_VERSION) return null
  if (typeof data.nonce !== 'string' || data.nonce !== nonce) return null
  switch (data.type) {
    case 'ready': {
      const h = height(data.height)
      const kind = data.kind
      const id = data.id
      if (h === null || typeof id !== 'string' || id.length > 128) return null
      if (kind !== 'unavailable' && !(EMBED_KINDS as readonly unknown[]).includes(kind)) return null
      return { type: 'ready', kind: kind as EmbedKind | 'unavailable', id, height: h }
    }
    case 'resize': {
      const h = height(data.height)
      return h === null ? null : { type: 'resize', height: h }
    }
    case 'open':
      return typeof data.href === 'string' && data.href.length <= 2048 ? { type: 'open', href: data.href } : null
    case 'error':
      return typeof data.message === 'string' && data.message.length <= 500 ? { type: 'error', message: data.message } : null
    default:
      return null
  }
}

export interface MessageEventLike {
  origin: string
  data: unknown
  source?: unknown
}

/**
 * Accept a `message` event for one embed instance: exact origin match, same window as the iframe (when the iframe has
 * one), this instance's nonce, valid schema. Null for everything else. Pure, never throws.
 */
export function acceptEmbedEvent(ev: MessageEventLike, expectedOrigin: string, nonce: string, frameWindow?: unknown): EmbedMessage | null {
  if (typeof ev.origin !== 'string' || ev.origin !== expectedOrigin) return null
  if (frameWindow && ev.source !== frameWindow) return null
  return parseEmbedMessage(ev.data, nonce)
}

/** An `open` href is honoured only when it points at the embed origin itself (a kre8 page). Pure. */
export function isSafeOpenHref(href: string, embedOrigin: string): boolean {
  try {
    const u = new URL(href)
    return u.origin === embedOrigin && u.protocol === new URL(embedOrigin).protocol
  } catch {
    return false
  }
}
