import type { ServeQuery } from './types'

/**
 * The query string of GET /v1/ads/serve, built the same way in the browser (which sends it) and on the publisher's
 * server (which signs it): keys sorted, undefined dropped, booleans as 1/0 (the server's `flag` enum accepts
 * '0' | '1' | 'true' | 'false'), encoded by URLSearchParams. The signed message covers this exact string.
 */
export function canonicalServeQuery(q: ServeQuery): string {
  const pairs: [string, string][] = []
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue
    if (typeof v === 'boolean') pairs.push([k, v ? '1' : '0'])
    else pairs.push([k, String(v)])
  }
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return new URLSearchParams(pairs).toString()
}

/** `/^srv_[\w-]{10,40}$/` (`eventBody.serve`, api/src/ads.ts) */
export const SERVE_ID = /^srv_[\w-]{10,40}$/

/** `/^[A-Za-z0-9_-]{16,64}$/` (`Offerwall.postback`, api/src/offerwall.ts) */
export const NONCE = /^[A-Za-z0-9_-]{16,64}$/

export const DEFAULT_BASE_URL = 'https://offers.kre8.fun'
