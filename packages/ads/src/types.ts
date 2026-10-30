/**
 * Types mirrored from the Gully Offerwall API (gully-labs/gully-offerwall, api/src/ads.ts and api/src/ads-pricing.ts).
 * Field names are the server's; nothing here is invented.
 */

/** Slot ids: `SLOTS` in api/src/ads-pricing.ts (also published at GET /v1/ads/slots). */
export type AdSlotName =
  | 'watch_preroll'
  | 'watch_midroll'
  | 'live_preroll'
  | 'watch_pause'
  | 'audio_spot'
  | 'sponsored_station'
  | 'sponsored_playlist'
  | 'live_show_mention'
  | 'featured_artist'
  | 'home_feed'
  | 'phone_feed'
  | 'shorts_feed'
  | 'watch_rail'
  | 'listen_rail'
  | 'launch_rail'
  | 'creator_page'
  | 'live_overlay'
  | 'home_hero'
  | 'creator_of_week'
  | 'featured_launch'
  | (string & {})

export type AdType = 'video' | 'audio' | 'sponsored_post' | 'banner' | 'sponsorship' | 'featured' | 'quest'

/** `CONTENT_PRICES` in api/src/ads-pricing.ts */
export type ContentPrice = 'free' | 'members' | 'rent' | 'collectors' | 'ppv'

/** `serveQuery` in api/src/ads.ts: the query string of GET /v1/ads/serve. */
export interface ServeQuery {
  slot: AdSlotName
  page?: string
  topic?: string
  /** wallet, Gully ID or `channel:<id>`; pays the creator share */
  creator?: string
  content?: string
  member?: boolean
  gated?: boolean
  access?: string
  adFree?: boolean
  contentPrice?: ContentPrice
  durationSec?: number
  listenedSecSinceLastSpot?: number
  /** 1 to 3 ads */
  n?: number
}

export interface AdBeacons {
  events: string
  hide: string
  report: string
  /** display 1000 ms, video/audio 2000 ms (`LIMITS.minVisibleMs`) */
  minVisibleMs: number
}

export interface AdVideo {
  assetId: string
  durationSec: number
  skipAfterSec: number
  playbackUrl: string | null
}

export interface AdAudio {
  assetId: string
  durationSec: number
  skippable: boolean
  playbackUrl: string | null
}

/** One ad of `GET /v1/ads/serve` (`ads.push({...})` in `Ads.serve`, api/src/ads.ts). */
export interface AdCreative {
  /** one-time serve id `srv_…`: the impression/click token */
  serve: string
  label: string
  whyLabel: string
  type: AdType
  slot: AdSlotName
  advertiser: string
  house: boolean
  headline: string
  body: string
  cta: string
  /** the advertiser's https landing page */
  clickUrl: string
  /** `${publicUrl}/v1/ads/click/${serve}`: counts the click server-side and 302s to clickUrl */
  clickTrackUrl: string
  imageUrl: string | null
  video: AdVideo | null
  audio: AdAudio | null
  presentedBy: string | null
  playlistId: string | null
  artist: string | null
  mention: string | null
  placement: { atSec: number } | null
  why: string
  beacons: AdBeacons
}

/** `none(reason)` / `no_fill` / `ads_disabled` reasons the server returns alongside an empty `ads` array. */
export type NoFillReason =
  | 'member'
  | 'ad_free'
  | 'members_only'
  | 'gated'
  | 'paid_content'
  | 'content_price_required'
  | 'too_short'
  | 'content_required'
  | 'bot'
  | 'creator_off'
  | 'rate'
  | 'overlay_cooldown'
  | 'per_content'
  | 'listen_cap'
  | 'no_fill'
  | 'ads_disabled'
  | 'not_found'
  | (string & {})

export interface ServeResponse {
  ads: AdCreative[]
  reason: NoFillReason | null
  retryAfterSec?: number
  /** HTTP status the SDK saw (404 when Gully Ads is off and the route does not exist) */
  status?: number
}

/** `eventBody.kind` in api/src/ads.ts */
export type AdEventKind = 'impression' | 'click' | 'complete' | 'skip'

export interface TrackResult {
  counted: boolean
  reason?: string
  billed?: string
}

/** `REPORT_REASONS` in api/src/ads.ts */
export type ReportReason = 'misleading' | 'scam' | 'offensive' | 'sexual' | 'illegal' | 'wrong_label' | 'too_loud' | 'other'

/**
 * The four headers of the Offerwall S2S signature (api/src/crypto.ts, `signPostback` doc comment):
 * X-Gully-Key, X-Gully-Timestamp (unix seconds), X-Gully-Nonce (16-64 url-safe chars), X-Gully-Signature (hex HMAC-SHA256).
 */
export interface ServeSignatureHeaders extends Record<string, string> {
  'x-gully-key': string
  'x-gully-timestamp': string
  'x-gully-nonce': string
  'x-gully-signature': string
}

export interface SignedServe {
  /** the exact query string that was signed; the browser must send it unchanged */
  query: string
  headers: ServeSignatureHeaders
  timestamp: number
  nonce: string
  signature: string
}

/** The browser asks the publisher's own backend for this; the backend holds the secret. */
export type GetSignedServe = (query: string) => Promise<SignedServe | { headers: ServeSignatureHeaders }>
