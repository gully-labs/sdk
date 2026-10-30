/**
 * Browser-safe client for the public Gully Ads routes (api/src/ads-routes.ts, "the app (public, no trackers, no PII)"):
 *   GET  /v1/ads/serve?<query>      -> { ads, reason }
 *   POST /v1/ads/events             { serve, kind: impression|click|complete|skip, visibleMs }
 *   GET  /v1/ads/click/:serve       302 to the advertiser (counts the click)
 *   POST /v1/ads/hide               { serve }
 *   POST /v1/ads/report             { serve, reason, details? }
 *   GET  /v1/ads/slots
 *
 * This module never holds the placement secret. The serve signature comes from the publisher's backend through
 * `getSignedServe` or `signUrl`; see ./server.
 */
import { canonicalServeQuery, DEFAULT_BASE_URL, SERVE_ID } from './canonical'
import type { AdCreative, AdEventKind, GetSignedServe, ReportReason, ServeQuery, ServeResponse, ServeSignatureHeaders, TrackResult } from './types'

export interface GullyAdsOptions {
  /** Offerwall API origin. Default https://offers.kre8.fun */
  baseUrl?: string
  /** placement publishable key `pk_…` (public). Informational on the client; the signature carries it. */
  siteId?: string
  /** your backend signs the serve query (see @gullylabs/ads/server). Either this or `signUrl`. */
  getSignedServe?: GetSignedServe
  /** your endpoint: POST { query } -> SignedServe JSON (what `createServeSigner` returns) */
  signUrl?: string
  /** Gully ID bearer token of the signed-in viewer (hide / report only, like the app) */
  token?: string | (() => string | null | undefined)
  fetch?: typeof fetch
}

export class AdsDisabledError extends Error {
  status: number
  constructor(status: number) {
    super(`Gully Ads is not available (HTTP ${status})`)
    this.name = 'AdsDisabledError'
    this.status = status
  }
}

export class GullyAdsError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'GullyAdsError'
    this.status = status
    this.code = code
  }
}

export class GullyAds {
  readonly baseUrl: string
  readonly siteId?: string
  private readonly signer?: GetSignedServe
  private readonly token?: GullyAdsOptions['token']
  private readonly f: typeof fetch

  constructor(o: GullyAdsOptions = {}) {
    if ('siteKey' in o || 'secret' in o || 'secretKey' in o) {
      throw new Error('@gullylabs/ads: the placement secret (sk_…) must never be given to the browser client; sign on your server with @gullylabs/ads/server')
    }
    this.baseUrl = (o.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.siteId = o.siteId
    this.token = o.token
    this.f = o.fetch ?? ((...a) => fetch(...a))
    if (o.getSignedServe) this.signer = o.getSignedServe
    else if (o.signUrl) {
      const url = o.signUrl
      this.signer = async (query) => {
        const r = await this.f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }), credentials: 'same-origin' })
        if (!r.ok) throw new GullyAdsError(r.status, `sign endpoint ${url} answered ${r.status}`)
        return (await r.json()) as { headers: ServeSignatureHeaders }
      }
    }
  }

  /** The exact query string the serve request will carry (sorted keys). */
  query(q: ServeQuery): string {
    return canonicalServeQuery(q)
  }

  /**
   * Ask for ads. Must be called from the viewer's browser: the server ties the serve to a daily viewer hash of
   * ip + user agent (`Ads.viewer`, api/src/ads.ts) and later rejects impressions from any other viewer.
   * A 404 (route absent while ADS_ENABLED=0) becomes `{ ads: [], reason: 'ads_disabled', status: 404 }`.
   */
  async serve(q: ServeQuery): Promise<ServeResponse> {
    const query = canonicalServeQuery(q)
    const headers: Record<string, string> = { accept: 'application/json' }
    if (this.signer) {
      const s = await this.signer(query)
      const h = s.headers as Record<string, string>
      for (const k of ['x-gully-key', 'x-gully-timestamp', 'x-gully-nonce', 'x-gully-signature']) {
        if (typeof h[k] !== 'string' || !h[k]) throw new Error(`getSignedServe did not return header ${k}`)
        headers[k] = h[k]
      }
      if (/sk_[A-Za-z0-9_-]{10,}/.test(JSON.stringify(h))) throw new Error('@gullylabs/ads: a placement secret reached the browser; sign on the server and return only the headers')
    }
    const r = await this.f(`${this.baseUrl}/v1/ads/serve?${query}`, { method: 'GET', headers, cache: 'no-store' })
    if (r.status === 404) return { ads: [], reason: 'ads_disabled', status: 404 }
    if (!r.ok) throw new GullyAdsError(r.status, `serve failed: ${r.status}`)
    const body = (await r.json()) as ServeResponse
    return { ...body, ads: Array.isArray(body.ads) ? body.ads : [], status: r.status }
  }

  /** POST /v1/ads/events (fetch keepalive so it survives navigation; sendBeacon as fallback). */
  async track(ad: AdCreative | string, kind: AdEventKind, o: { visibleMs?: number; eventsUrl?: string } = {}): Promise<TrackResult | null> {
    const serve = typeof ad === 'string' ? ad : ad.serve
    if (!SERVE_ID.test(serve)) throw new Error('bad serve id')
    const url = o.eventsUrl ?? (typeof ad === 'string' ? undefined : ad.beacons?.events) ?? `${this.baseUrl}/v1/ads/events`
    const body = JSON.stringify(kind === 'impression' ? { serve, kind, visibleMs: Math.max(0, Math.floor(o.visibleMs ?? 0)) } : { serve, kind })
    try {
      const r = await this.f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
      if (!r.ok) return null
      return (await r.json()) as TrackResult
    } catch {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      }
      return null
    }
  }

  impression(ad: AdCreative, visibleMs: number) {
    return this.track(ad, 'impression', { visibleMs })
  }

  /** Click beacon for custom renderers. The web component instead links to `clickTrackUrl`, which counts server-side. */
  click(ad: AdCreative) {
    return this.track(ad, 'click')
  }

  complete(ad: AdCreative) {
    return this.track(ad, 'complete')
  }

  skip(ad: AdCreative) {
    return this.track(ad, 'skip')
  }

  /** POST /v1/ads/hide: hides the campaign for this viewer (for good when a Gully ID token is set). */
  async hide(ad: AdCreative | string): Promise<{ hidden: boolean; note: string }> {
    const serve = typeof ad === 'string' ? ad : ad.serve
    const url = (typeof ad === 'string' ? undefined : ad.beacons?.hide) ?? `${this.baseUrl}/v1/ads/hide`
    return this.post(url, { serve })
  }

  /** POST /v1/ads/report { serve, reason, details? } (also hides it). */
  async report(ad: AdCreative | string, reason: ReportReason, details = ''): Promise<{ reported: boolean; note: string }> {
    const serve = typeof ad === 'string' ? ad : ad.serve
    const url = (typeof ad === 'string' ? undefined : ad.beacons?.report) ?? `${this.baseUrl}/v1/ads/report`
    return this.post(url, { serve, reason, details: details.slice(0, 1000) })
  }

  /** GET /v1/ads/slots: slot definitions, media numbers, report reasons, floors. */
  async slots(): Promise<Record<string, unknown>> {
    const r = await this.f(`${this.baseUrl}/v1/ads/slots`, { headers: { accept: 'application/json' } })
    if (r.status === 404) throw new AdsDisabledError(404)
    if (!r.ok) throw new GullyAdsError(r.status, `slots failed: ${r.status}`)
    return (await r.json()) as Record<string, unknown>
  }

  private async post<T>(url: string, body: unknown): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    const t = typeof this.token === 'function' ? this.token() : this.token
    if (t) headers.authorization = `Bearer ${t}`
    const r = await this.f(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!r.ok) {
      let code: string | undefined
      try {
        code = ((await r.json()) as { code?: string }).code
      } catch {
        /* no body */
      }
      throw new GullyAdsError(r.status, `${url} answered ${r.status}`, code)
    }
    return (await r.json()) as T
  }
}

/** Process-wide defaults used by <gully-ad-slot> when an element does not set its own base-url / sign-url. */
export interface AdsConfig extends GullyAdsOptions {}
let shared: AdsConfig = {}
export function configureAds(c: AdsConfig) {
  shared = { ...shared, ...c }
}
export function adsConfig(): AdsConfig {
  return shared
}
