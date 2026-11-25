/**
 * @swoopads/sdk: the Swoop Ads SDK for creators' sites and apps (formerly @gullylabs/ads).
 * Browser-safe entry: the client, the <gully-ad-slot> element (not registered until defineAdSlot()) and the types.
 * Signing lives in '@swoopads/sdk/server' and must stay on your backend.
 */
export { GullyAds, GullyAdsError, AdsDisabledError, configureAds, adsConfig } from './client'
export type { GullyAdsOptions, AdsConfig } from './client'
/** the same client under the Swoop name */
export { GullyAds as SwoopAds } from './client'
export { GullyAdSlot, defineAdSlot, AD_SLOT_TAG } from './slot'
export type { AdSlotEventMap } from './slot'
export { canonicalServeQuery, DEFAULT_BASE_URL } from './canonical'
export { safeHttpsUrl, safeText } from './sanitize'
export type * from './types'
export { mountUnit, unitUrl, loadTag } from './unit'
export { UNIT_SIZES, ALL_SIZES, refusal, sizesFor, parseSize } from './rules'
export type { SizeKind, RefusalReason } from './rules'
export type { UnitKind, UnitTheme, UnitState, UnitOptions, UnitHandle } from './unit'
