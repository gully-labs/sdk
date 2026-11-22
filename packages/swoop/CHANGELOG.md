# Changelog

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
