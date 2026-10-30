/**
 * @gullylabs/ads/server: runs on the publisher's backend (Node 18+, Deno, Bun, Cloudflare Workers; WebCrypto only).
 *
 * Signature scheme = the Gully Offerwall S2S signature, applied to the serve query string. Mirrors
 * gully-labs/gully-offerwall `api/src/crypto.ts`:
 *
 *   hex HMAC-SHA256(secret, `${timestamp}.${nonce}.${rawBody}`)
 *   Headers: X-Gully-Key, X-Gully-Timestamp (unix seconds), X-Gully-Nonce (16-64 url-safe chars), X-Gully-Signature.
 *   POSTBACK_WINDOW_SECONDS = 300
 *
 * and the verifier `Offerwall.postback` in `api/src/offerwall.ts` (header presence, nonce regex, constant-time hex compare,
 * 5-minute window, nonce never reused). For a serve request `rawBody` is the query string after `?` (a GET has no body).
 * The key id is the placement's publishable key `pk_…`, the secret is the placement secret `sk_…` (shown once when the
 * placement is created, `createPlacement` / `rotatePlacementSecret` in api/src/offerwall.ts).
 */
import { canonicalServeQuery, NONCE } from './canonical'
import type { ServeQuery, ServeSignatureHeaders, SignedServe } from './types'

export { canonicalServeQuery } from './canonical'
export type { ServeQuery, ServeSignatureHeaders, SignedServe } from './types'

/** `POSTBACK_WINDOW_SECONDS` in api/src/crypto.ts */
export const SERVE_SIGNATURE_WINDOW_SECONDS = 300

const enc = new TextEncoder()

function subtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (!c?.subtle) throw new Error('@gullylabs/ads/server needs WebCrypto (globalThis.crypto.subtle): Node 18+, Deno, Bun or Workers')
  return c.subtle
}

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

/** hex HMAC-SHA256(secret, message), same bytes as `hmacHex` in api/src/crypto.ts (utf8 secret and message). */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await subtle().importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await subtle().sign('HMAC', key, enc.encode(message)))
}

/** `signPostback(secret, timestamp, nonce, rawBody)` of api/src/crypto.ts, with the query string as the body. */
export const serveMessage = (timestamp: number, nonce: string, query: string) => `${timestamp}.${nonce}.${query}`

/** 18 random bytes as base64url: 24 chars, inside the server's 16-64 url-safe window. */
export function randomNonce(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (!c?.getRandomValues) throw new Error('WebCrypto getRandomValues is required')
  const bytes = c.getRandomValues(new Uint8Array(18))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface SignServeOptions {
  /** the placement's publishable key `pk_…` (public; goes in X-Gully-Key) */
  siteId: string
  /** the placement secret `sk_…`: server only, never ship it to a browser */
  siteKey: string
  /** the serve query: either the object (canonicalised here) or the exact string the browser will send */
  query: ServeQuery | string
  /** unix seconds; defaults to now */
  timestamp?: number
  /** 16-64 url-safe chars; defaults to a random 24-char nonce */
  nonce?: string
}

/**
 * Sign one serve request. Returns the four headers the browser attaches to `GET /v1/ads/serve?<query>`.
 * Each result is single-use (the verifier stores the nonce) and valid for 5 minutes.
 */
export async function signServeRequest(o: SignServeOptions): Promise<SignedServe> {
  if (!o.siteId) throw new Error('siteId (placement publishable key) is required')
  if (!o.siteKey) throw new Error('siteKey (placement secret) is required')
  const query = typeof o.query === 'string' ? o.query.replace(/^\?/, '') : canonicalServeQuery(o.query)
  const timestamp = o.timestamp ?? Math.floor(Date.now() / 1000)
  const nonce = o.nonce ?? randomNonce()
  if (!NONCE.test(nonce)) throw new Error('nonce must be 16-64 url-safe characters')
  const signature = await hmacSha256Hex(o.siteKey, serveMessage(timestamp, nonce, query))
  const headers: ServeSignatureHeaders = {
    'x-gully-key': o.siteId,
    'x-gully-timestamp': String(timestamp),
    'x-gully-nonce': nonce,
    'x-gully-signature': signature,
  }
  return { query, headers, timestamp, nonce, signature }
}

/**
 * A ready-made handler body for the publisher's sign endpoint: give it the JSON the browser posted (`{ query }`)
 * and return the result as JSON. The browser-side `GullyAds({ signUrl })` speaks exactly this.
 */
export function createServeSigner(o: { siteId: string; siteKey: string; allowSlots?: string[] }) {
  return async (body: unknown): Promise<SignedServe> => {
    const q = (body as { query?: unknown } | null)?.query
    if (typeof q !== 'string' || q.length === 0 || q.length > 2048) throw new Error('body.query (string) is required')
    if (o.allowSlots) {
      const slot = new URLSearchParams(q).get('slot') ?? ''
      if (!o.allowSlots.includes(slot)) throw new Error(`slot "${slot}" is not allowed on this site`)
    }
    return signServeRequest({ siteId: o.siteId, siteKey: o.siteKey, query: q })
  }
}

/** constant-time hex compare, `safeEqualHex` in api/src/crypto.ts */
export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]*$/i.test(a) || !/^[0-9a-f]*$/i.test(b)) return false
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export type VerifyFailure = 'bad_postback' | 'stale' | 'replay'

export interface VerifyServeOptions {
  /** request headers (lower-cased names, as Node/Fetch give them) */
  headers: Record<string, string | string[] | undefined> | Headers
  /** the raw query string after `?`, exactly as received */
  query: string
  /** the secret for a key id, or null when unknown */
  secretFor: (keyId: string) => Promise<string | null> | string | null
  /** store the nonce; return false if it was seen before (replay). Optional: without it replays are not detected. */
  rememberNonce?: (keyId: string, nonce: string) => Promise<boolean> | boolean
  now?: () => number
}

export type VerifyResult = { ok: true; keyId: string; timestamp: number; nonce: string } | { ok: false; code: VerifyFailure; error: string }

/**
 * The verifier, ported from `Offerwall.postback` (api/src/offerwall.ts): same checks, same order, same error codes.
 * Use it on the Offerwall API (or any relay) to verify what `signServeRequest` produced.
 */
export async function verifyServeRequest(o: VerifyServeOptions): Promise<VerifyResult> {
  const h = (k: string): string | undefined => {
    if (o.headers instanceof Headers) return o.headers.get(k) ?? undefined
    const v = o.headers[k] ?? o.headers[k.toLowerCase()]
    return Array.isArray(v) ? v[0] : v
  }
  const key = h('x-gully-key')
  const ts = Number(h('x-gully-timestamp'))
  const nonce = h('x-gully-nonce') ?? ''
  const sig = h('x-gully-signature') ?? ''
  if (!key || !Number.isFinite(ts) || !NONCE.test(nonce)) return { ok: false, code: 'bad_postback', error: 'missing postback headers' }
  const secret = await o.secretFor(key)
  if (!secret) return { ok: false, code: 'bad_postback', error: 'unknown postback key' }
  const expected = await hmacSha256Hex(secret, serveMessage(ts, nonce, o.query.replace(/^\?/, '')))
  if (!safeEqualHex(expected, sig)) return { ok: false, code: 'bad_postback', error: 'bad signature' }
  const nowSec = (o.now ?? Date.now)() / 1000
  if (Math.abs(nowSec - ts) > SERVE_SIGNATURE_WINDOW_SECONDS) return { ok: false, code: 'stale', error: 'timestamp outside the 5 minute window' }
  if (o.rememberNonce && !(await o.rememberNonce(key, nonce))) return { ok: false, code: 'replay', error: 'nonce already used (replay)' }
  return { ok: true, keyId: key, timestamp: ts, nonce }
}
