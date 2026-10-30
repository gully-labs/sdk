/**
 * Embed page URLs and kre8 links. The id rules are the server's (gully-street services/social src/share.ts ID_RULES
 * and src/lib/router.ts): a coin is a 0x address, a track id is 8..24 URL-safe chars, video / short / live ids are
 * 1..64 URL-safe chars, a creator is a 0x address or a .gully handle.
 */
import { GULLY_CHAIN_ID } from './origins'

export type EmbedKind = 'coin' | 'track' | 'video' | 'short' | 'live'
export const EMBED_KINDS: readonly EmbedKind[] = ['coin', 'track', 'video', 'short', 'live']

/** Default iframe sizes (players: gully-street services/social src/growth.ts EMBED_SIZE; the coin card resizes itself). */
export const EMBED_SIZE: Record<EmbedKind, { width: number; height: number }> = {
  coin: { width: 360, height: 236 },
  track: { width: 480, height: 152 },
  video: { width: 640, height: 360 },
  short: { width: 360, height: 640 },
  live: { width: 640, height: 360 },
}

const ADDR = /^0x[0-9a-fA-F]{40}$/
const TRACK = /^[A-Za-z0-9_-]{8,24}$/
const VIDEO = /^[A-Za-z0-9_-]{1,64}$/
const HANDLE = /^[a-z0-9-]{1,63}(\.gully)?$/i
const NONCE = /^[A-Za-z0-9_-]{8,64}$/

export const isCoinAddress = (v: unknown): v is string => typeof v === 'string' && ADDR.test(v)
export const isTrackId = (v: unknown): v is string => typeof v === 'string' && TRACK.test(v)
export const isVideoId = (v: unknown): v is string => typeof v === 'string' && VIDEO.test(v)
export const isHandle = (v: unknown): v is string => typeof v === 'string' && HANDLE.test(v)
/** a creator reference: 0x address or .gully handle (with or without the suffix, "@" allowed) */
export const isCreatorRef = (v: unknown): v is string => typeof v === 'string' && (ADDR.test(v) || HANDLE.test(v.replace(/^@/, '')))
export const isNonce = (v: unknown): v is string => typeof v === 'string' && NONCE.test(v)

/** Is `id` a valid id for `kind`? Pure. */
export function isValidEmbedId(kind: EmbedKind, id: unknown): id is string {
  switch (kind) {
    case 'coin':
      return isCoinAddress(id)
    case 'track':
      return isTrackId(id)
    case 'video':
    case 'short':
    case 'live':
      return isVideoId(id)
  }
}

/** A fresh per-instance nonce (16 URL-safe chars). Uses crypto when there is one. */
export function newNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  const bytes = new Uint8Array(16)
  const c = typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function' ? globalThis.crypto : null
  if (c) c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  let out = ''
  for (const b of bytes) out += alphabet.charAt(b & 63)
  return out
}

export interface EmbedSrcOptions {
  kind: EmbedKind
  id: string
  /** the kre8 origin the page is served from (resolveEmbedOrigin) */
  embedOrigin: string
  /** the host page's origin: the only origin the embed will post messages to */
  parentOrigin: string
  nonce: string
}

/**
 * `https://kre8.fun/embed/<kind>/<id>?origin=<parent>&nonce=<nonce>`. Throws on a bad id, origin or nonce rather than
 * building a URL that could hit the wrong page. Pure.
 */
export function buildEmbedSrc(o: EmbedSrcOptions): string {
  if (!EMBED_KINDS.includes(o.kind)) throw new Error(`kre8-embed: unknown kind ${String(o.kind)}`)
  if (!isValidEmbedId(o.kind, o.id)) throw new Error(`kre8-embed: invalid ${o.kind} id`)
  if (!isNonce(o.nonce)) throw new Error('kre8-embed: invalid nonce')
  let parent: URL
  try {
    parent = new URL(o.parentOrigin)
  } catch {
    throw new Error('kre8-embed: parent origin must be an absolute origin')
  }
  if (parent.origin !== o.parentOrigin || (parent.protocol !== 'https:' && parent.protocol !== 'http:')) throw new Error('kre8-embed: parent origin must be an http(s) origin')
  const id = o.kind === 'coin' ? o.id.toLowerCase() : o.id
  const u = new URL(`${o.embedOrigin}/embed/${o.kind}/${encodeURIComponent(id)}`)
  u.searchParams.set('origin', o.parentOrigin)
  u.searchParams.set('nonce', o.nonce)
  return u.toString()
}

const UTM = 'utm_source=embed&utm_medium=embed&utm_campaign=kre8-embed'

/** The kre8 page of a coin (`/token/<address>`). Pure. */
export function coinUrl(embedOrigin: string, address: string): string {
  if (!isCoinAddress(address)) throw new Error('kre8-embed: invalid coin address')
  return `${embedOrigin}/token/${address.toLowerCase()}?${UTM}&utm_content=coin`
}

/**
 * The kre8 page where a creator can be backed: `/@<handle>` for a .gully name, `/address/<0x>` for a wallet
 * (gully-street src/lib/router.ts). Every money action (tips, memberships, coins) happens there, signed in on kre8,
 * never on the host page. Pure.
 */
export function backUrl(embedOrigin: string, creator: string): string {
  const c = creator.trim().replace(/^@/, '')
  // plain regex tests: the `v is string` guards would narrow `c` to never after the first return
  if (ADDR.test(c)) return `${embedOrigin}/address/${c.toLowerCase()}?${UTM}&utm_content=back`
  if (HANDLE.test(c)) return `${embedOrigin}/@${encodeURIComponent(c.toLowerCase().replace(/\.gully$/, ''))}?${UTM}&utm_content=back`
  throw new Error('kre8-embed: creator must be a 0x address or a .gully handle')
}

/** The kre8 kit logo files served byte-identical from the app host (gully-street services/social src/embed.ts). */
export const kitIconUrl = (embedOrigin: string) => `${embedOrigin}/embed/brand/kre8-icon-128.png`
export const kitWordmarkUrl = (embedOrigin: string) => `${embedOrigin}/embed/brand/kre8-wordmark-128h.png`

export { GULLY_CHAIN_ID }
