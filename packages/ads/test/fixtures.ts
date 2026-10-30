import type { AdCreative } from '../src/types'

/** one banner creative as `Ads.serve` returns it (api/src/ads.ts) */
export const AD: AdCreative = {
  serve: 'srv_abcdefghijklmnopqrstuv',
  label: 'Sponsored',
  whyLabel: 'Why this ad?',
  type: 'banner',
  slot: 'watch_rail',
  advertiser: 'Gully Racer',
  house: false,
  headline: 'Race on Gully Chain',
  body: 'Free to play.',
  cta: 'Play now',
  clickUrl: 'https://racer.gullystudio.xyz/',
  clickTrackUrl: 'https://offers.kre8.fun/v1/ads/click/srv_abcdefghijklmnopqrstuv',
  imageUrl: 'https://offers.kre8.fun/v1/ads/files/img_1',
  video: null,
  audio: null,
  presentedBy: null,
  playlistId: null,
  artist: null,
  mention: null,
  placement: null,
  why: "You're seeing this because ads for Watch: Sponsored row.",
  beacons: { events: 'https://offers.kre8.fun/v1/ads/events', hide: 'https://offers.kre8.fun/v1/ads/hide', report: 'https://offers.kre8.fun/v1/ads/report', minVisibleMs: 1000 },
}
