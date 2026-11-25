# Changelog

## 0.2.0 - 2026-11-25 (not published)

- The ad rules (owner rule 2026-11-25, https://docs.swoopads.xyz/ad-rules/), the same as the hosted tag 1.1.0:
  `mountUnit` sends the space it has (`aw`) and an optional exact `size`, keeps the unit at height 0 until the unit page says the
  creative fits that size exactly, and opens it only while it is off screen; at most one unit in view on phones; nothing on
  money, sign-in or form pages, in forms, or in fixed or sticky containers (`refusal`); `block` adds your own selector.
- `<swoop-ad-slot>` / `<gully-ad-slot>` need `size="WxH"` (a listed size the space can hold), draw at exactly that size, refuse a
  creative that does not fit it (image of another shape, text that would be cut), refuse video and audio, and open the same way.
- New exports: `UNIT_SIZES`, `ALL_SIZES`, `sizesFor`, `parseSize`, `refusal`.
- Breaking: the old `swoop:height` protocol of tag 1.0.0 is gone from `mountUnit` (the unit page keeps 1.0.0 units empty).

## 0.1.0 - 2026-11-22

- Renamed from `@gullylabs/ads` to `@swoopads/sdk` (Swoop Ads). `@gullylabs/ads` stays as a thin package that re-exports this one.
- New: `mountUnit`, `unitUrl`, `loadTag` and `<SwoopUnit>` (React): sponsor units with no backend and no cookies (banner, text, native;
  light, dark or auto), the same unit the hosted tag https://swoopads.xyz/t.js draws.
- New: `<swoop-ad-slot>` (the same element as `<gully-ad-slot>`), `SwoopAds` (alias of `GullyAds`).

## 0.1.0-beta.0 - 2026-10-30

- First beta. Gully Ads is not live yet; published under the npm dist-tag `beta`.
- `<gully-ad-slot>` web component (Shadow DOM, `defineAdSlot()` plus the `@swoopads/sdk/define` side-effect entry).
- `@swoopads/sdk/react`: `AdSlot` wrapper (react is an optional peer).
- `GullyAds` client for `GET /v1/ads/serve`, `POST /v1/ads/events`, `GET /v1/ads/click/:serve`, `POST /v1/ads/hide`,
  `POST /v1/ads/report`, `GET /v1/ads/slots`.
- `@swoopads/sdk/server`: `signServeRequest` / `verifyServeRequest` (WebCrypto HMAC-SHA256), the Offerwall postback
  signature scheme applied to the serve query string. The placement secret never reaches the browser.
- Viewability (IntersectionObserver, 50% for `beacons.minVisibleMs`), one impression per serve, click via the server's
  `clickTrackUrl` redirect, collapse on no-fill, `ads_disabled` and 404.
- Safe to import on a server (SSR): the element class only touches the DOM in a browser.
