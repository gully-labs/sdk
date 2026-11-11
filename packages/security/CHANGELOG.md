# Changelog

## 0.1.0 - 2026-10-30

Initial release.

- `GullySecurity` client for the gullysecurity.xyz API: published reports, stats, live feed, engine status, offer,
  sample report, Gully Score (index, methodology, one contract), the visitor's scans (start, get, wait, cancel,
  publish, report HTML) and Security Review requests. Injectable fetch, `baseUrl`, timeouts, `AbortSignal`,
  typed `GullySecurityError`.
- `<gully-security-badge>` web component (`defineSecurityBadge()` or the side-effect entry
  `@gullylabs/security/badge.js`) showing the official "Secured by GullySecurity" badge from the brand kit,
  linking to the contract's published report or Gully Score page, with an optional status caption.
- React wrapper `@gullylabs/security/react`: `GullySecurityBadge`, `useGullyScore`.
- Gully Chain Testnet (485590, key `gully`) supported everywhere the API supports it.
