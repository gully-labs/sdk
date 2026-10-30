/**
 * Which origins an embed may be loaded from. The embed pages live on the kre8 app host (kre8.fun; app.gullychain.xyz is
 * the older alias of the same app, see gully-street src/config/serviceHosts.ts). A host page can pick one of these or,
 * explicitly, a development origin (http://localhost:<port>, http://127.0.0.1:<port> or any https origin). Nothing else.
 */
export const DEFAULT_EMBED_ORIGIN = 'https://kre8.fun'

export const ALLOWED_EMBED_ORIGINS: readonly string[] = ['https://kre8.fun', 'https://www.kre8.fun', 'https://app.gullychain.xyz']

/** Gully Chain testnet, the only chain kre8 coins live on today. */
export const GULLY_CHAIN_ID = 485590

/** Public read-only APIs the data client talks to (gully-street src/lib/indexerApi.ts, src/config/serviceHosts.ts). */
export const DEFAULT_INDEXER_URL = 'https://indexer.gullychain.xyz'
export const DEFAULT_SOCIAL_URL = 'https://social.kre8.fun'

/** The origin part of a URL string, or null when it is not an absolute http(s) URL. Pure. */
export function originOf(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  let u: URL
  try {
    u = new URL(value.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  return u.origin
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** An origin a developer may point the embeds at: http on localhost / 127.0.0.1, or any https origin. Pure. */
export function isDevOrigin(origin: string): boolean {
  const o = originOf(origin)
  if (!o || o !== origin) return false
  const u = new URL(o)
  return u.protocol === 'https:' || LOCAL_HOSTS.has(u.hostname)
}

export interface EmbedOriginOptions {
  /** one of ALLOWED_EMBED_ORIGINS (default https://kre8.fun) */
  origin?: string | null
  /** an explicit development origin (http://localhost:5173 ...). Wins over `origin` when set. */
  devOrigin?: string | null
}

/**
 * The origin to load embed pages from and to accept messages from. Throws on anything outside the allowlist, so a typo
 * or an injected attribute can never point the iframe at a foreign site. Pure.
 */
export function resolveEmbedOrigin(opts: EmbedOriginOptions = {}): string {
  if (opts.devOrigin) {
    const dev = originOf(opts.devOrigin)
    if (!dev || !isDevOrigin(dev)) throw new Error(`kre8-embed: dev origin must be http://localhost[:port], http://127.0.0.1[:port] or an https origin, got ${String(opts.devOrigin)}`)
    return dev
  }
  if (opts.origin === undefined || opts.origin === null || opts.origin === '') return DEFAULT_EMBED_ORIGIN
  const o = originOf(opts.origin)
  if (!o || !ALLOWED_EMBED_ORIGINS.includes(o)) throw new Error(`kre8-embed: origin must be one of ${ALLOWED_EMBED_ORIGINS.join(', ')}, got ${String(opts.origin)}`)
  return o
}
