/**
 * @gullylabs/ads (beta): Gully Ads publisher SDK.
 * Browser-safe entry: the client, the <gully-ad-slot> element (not registered until defineAdSlot()) and the types.
 * Signing lives in '@gullylabs/ads/server' and must stay on your backend.
 */
export { GullyAds, GullyAdsError, AdsDisabledError, configureAds, adsConfig } from './client'
export type { GullyAdsOptions, AdsConfig } from './client'
export { GullyAdSlot, defineAdSlot, AD_SLOT_TAG } from './slot'
export type { AdSlotEventMap } from './slot'
export { canonicalServeQuery, DEFAULT_BASE_URL } from './canonical'
export { safeHttpsUrl, safeText } from './sanitize'
export type * from './types'
