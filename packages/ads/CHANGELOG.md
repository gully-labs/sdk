# Changelog

## 0.1.0-beta.0 - 2026-10-30

- First beta. Gully Ads is not live yet (`ADS_ENABLED=0` in production); published under the npm dist-tag `beta`.
- `<gully-ad-slot>` web component (Shadow DOM, `defineAdSlot()` plus the `@gullylabs/ads/define` side-effect entry).
- `@gullylabs/ads/react`: `AdSlot` wrapper (react is an optional peer).
- `GullyAds` client for `GET /v1/ads/serve`, `POST /v1/ads/events`, `GET /v1/ads/click/:serve`, `POST /v1/ads/hide`,
  `POST /v1/ads/report`, `GET /v1/ads/slots`.
- `@gullylabs/ads/server`: `signServeRequest` / `verifyServeRequest` (WebCrypto HMAC-SHA256), the Offerwall postback
  signature scheme applied to the serve query string. The placement secret never reaches the browser.
- Viewability (IntersectionObserver, 50% for `beacons.minVisibleMs`), one impression per serve, click via the server's
  `clickTrackUrl` redirect, collapse on no-fill, `ads_disabled` and 404.
