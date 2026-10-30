# @gullylabs/security

Typed client for the [Gully Security](https://gullysecurity.xyz) API and the official "Secured by GullySecurity"
badge as a web component (plus a React wrapper). Gully Security runs AI Security Scans of smart contracts on seven
mainnets and Gully Chain (485590), publishes reports and computes the Gully Score, a 0 to 100 reading of how a
contract is controlled, built from public evidence only.

No runtime dependencies. ESM and CommonJS. Node 18+ and modern browsers.

## Install

```sh
npm install @gullylabs/security
```

## 5-minute quickstart

Public reads work from anywhere (CORS is open on gullysecurity.xyz):

```ts
import { GullySecurity } from '@gullylabs/security'

const gs = new GullySecurity()

// The Gully Score of a contract on Gully Chain Testnet (chain id 485590, key "gully")
const score = await gs.score(485590, '0x1234567890abcdef1234567890abcdef12345678')
console.log(score.score, score.grade, score.links.page)
for (const c of score.components) console.log(c.label, c.available ? c.score : 'n/a', c.reason)

// Published reports, newest first, and the ones on a given contract
const reports = await gs.listReports()
const mine = await gs.findReports('base', '0x1234567890abcdef1234567890abcdef12345678')
if (mine[0]) {
  const full = await gs.getReport(mine[0].id)
  console.log(full.summary.text, full.summary.counts, gs.reportUrl(full.id))
}

// What the engine can run right now, the live feed, real counts
const engine = await gs.engine()
console.log(engine.state, engine.text, engine.uptime24h)
```

Starting a scan. The server keeps scans private to the browser that started them (a `gs_v` cookie it sets) and only
accepts the POST from its own origin, so this runs on gullysecurity.xyz itself, behind a same-origin proxy, or from
Node with the cookie carried by hand as below. Two scans a day are free; beyond that the server answers
`checkout-off` (402) and nothing is charged.

```ts
import { GullySecurity, isGullySecurityError } from '@gullylabs/security'

const gs = new GullySecurity()
try {
  const { scan, setCookie } = await gs.startScan({ kind: 'address', chain: 'gully', address: '0x1234567890abcdef1234567890abcdef12345678' }, { expectPriceUsd: 0 })
  // In Node, gs.cookie now holds the visitor cookie from setCookie; keep it to read this scan again later.
  const done = await gs.waitForScan(scan.id, { onUpdate: (s) => console.log(s.status, s.progress?.pct) })
  if (done.status === 'done' && done.report) {
    console.log(done.report.label, done.report.summary.counts)
    const published = await gs.publishScan(scan.id, true, { indexable: false })
    console.log(gs.reportUrl(published.id))
  } else {
    console.log(done.status, done.failure)
  }
} catch (e) {
  if (isGullySecurityError(e) && e.code === 'checkout-off') console.log('Free scans used; resets', e.quota?.resetsAt)
  else throw e
}
```

## The badge

The badge is the brand kit's own file, loaded by URL and never redrawn. By default it is read from
`https://gullysecurity.xyz/brand/badges/`, which serves the kit files byte for byte; the same files ship in this
package under `assets/` for anyone who prefers to host them (point `asset-base` at that folder, for example on
jsDelivr: `https://cdn.jsdelivr.net/npm/@gullylabs/security@0.1.0/assets`).

```html
<script type="module">
  import '@gullylabs/security/badge.js'   // defines <gully-security-badge>
</script>

<gully-security-badge chain="gully" address="0x1234567890abcdef1234567890abcdef12345678" theme="dark"></gully-security-badge>
```

Or define it yourself with defaults for every badge on the page:

```ts
import { defineSecurityBadge } from '@gullylabs/security'
defineSecurityBadge({ assetBase: 'https://cdn.jsdelivr.net/npm/@gullylabs/security@0.1.0/assets' })
```

The element links to the contract's published report when there is one, otherwise to its Gully Score page, and
shows a one-line caption with the score and the report date when the API has them. Without any data it still
renders the badge and says "Not scanned yet".

| Attribute | Values | Default |
|---|---|---|
| `chain` | `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bnb`, `avalanche`, `gully`, or a chain id (`485590`) | required |
| `address` | the contract address | required |
| `theme` | `dark`, `light` | `dark` |
| `size` | badge width, one of the kit's sizes: `142`, `214`, `285`, `356` (285:80 ratio) | `214` |
| `data` | what to read: `auto` (report, then score), `report`, `score`, `none` | `auto` |
| `href` | link target override | report page, else score page |
| `caption` | `show`, `hide` | `show` |
| `base-url` | the Gully Security origin | `https://gullysecurity.xyz` |
| `asset-base` | where the badge files live | `<base-url>/brand/badges` |

Events: `gully-security-badge:load` (`detail: { report, score }`) and `gully-security-badge:error`.

React:

```tsx
import { GullySecurityBadge, useGullyScore } from '@gullylabs/security/react'

<GullySecurityBadge chain={485590} address="0x1234567890abcdef1234567890abcdef12345678" theme="light" size={285} />

const { score, loading, error } = useGullyScore('gully', '0x1234567890abcdef1234567890abcdef12345678')
```

## API reference

`new GullySecurity({ baseUrl?, fetch?, timeoutMs?, headers?, cookie? })`. Every method takes a final
`{ signal?, timeoutMs? }`.

| Method | Endpoint | Notes |
|---|---|---|
| `listReports()` | `GET /api/security/reports` | published reports, newest first (200 max) |
| `getReport(id)` | `GET /api/security/reports/:id` | 404 `not-found` unless published |
| `findReports(chain, address)` | (filters `listReports`) | reports on one deployed contract |
| `reportUrl(id)`, `reportHtmlUrl(id)`, `reportBadgeUrl(id, { size, theme })` | `/reports/:id`, `.../report.html`, `.../badge.svg` | URLs only |
| `stats()` | `GET /api/security/stats` | scans per day, by severity, by chain, totals |
| `live()` | `GET /api/security/live` | last 30 scans, no ids |
| `engine()` | `GET /api/security/engine` | AI and static tools, queue, uptime history |
| `offer()` | `GET /api/security/offer` | tiers, prices, free quota, chains |
| `sample()` | `GET /api/security/sample` | the sample report on a fictional contract |
| `scoreIndex()` | `GET /api/score` | listed scores, chains, methodology |
| `scoreMethodology()` | `GET /api/score/methodology` | components, weights, rules |
| `score(chain, address)` | `GET /api/score/:chain/:address` | computed when stale; 6 computations per IP per minute, else `stale: true` or 429 |
| `scoreUrl()`, `scoreBadgeUrl()` | `/score/:chain/:address[/badge.svg]` | URLs only |
| `startScan(input, { expectPriceUsd })` | `POST /api/security/scans` | same-origin only; 402 `checkout-off`, 409 `price-changed`, 429 `too-many-active`, 503 `engine-unavailable` |
| `listScans()` | `GET /api/security/scans` | this visitor's scans and quota |
| `getScan(id)` | `GET /api/security/scans/:id` | with `report` once done, `failure` once failed |
| `waitForScan(id, { intervalMs, maxWaitMs, onUpdate })` | polls `getScan` | resolves on done, failed or cancelled |
| `getScanHtml(id)` | `GET /api/security/scans/:id/report.html` | print-ready HTML |
| `cancelScan(id)` | `POST /api/security/scans/:id/cancel` | 409 when finished |
| `publishScan(id, published, { indexable })` | `POST /api/security/scans/:id/publish` | snapshot goes public at `/reports/:id` |
| `requestReview({ tier, name, email, project, scope, ... })` | `POST /api/security/review-requests` | human Security Review quote |

Scan inputs: `{ kind: 'address', chain, address }`, `{ kind: 'github' | 'web2', repo, commit?, ref? }`,
`{ kind: 'upload', upload: { name, data } }` (base64 of a `.zip` of Solidity files or one `.sol`, 2 MB max).

Errors are `GullySecurityError` with `code` (the server's code such as `checkout-off`, else by status:
`not-found`, `rate-limited`, `invalid-request`, `conflict`, `server-error`; client-side: `invalid-input`,
`network`, `timeout`, `aborted`, `bad-response`), `status`, `body`, `quota` and `retryAfterSec`.

Helpers: `SECURITY_CHAINS`, `GULLY_CHAIN_ID` (485590), `resolveChain(keyOrId)`, `isAddress(x)`.

## Gully Chain

Gully Chain Testnet is chain id 485590, key `gully`. It has no source verification service yet, so a scan there
reads bytecode only (`mode: 'bytecode-only'`) and the Gully Score is built from on-chain reads; the API says so in
each component's `reason`.

```ts
const gs = new GullySecurity()
const { scan } = await gs.startScan({ kind: 'address', chain: 485590, address: '0x...' })
const s = await gs.score('gully', '0x...')
```

## Security notes

- Everything here is public, read-only data except the visitor's own scans, which the server ties to its `gs_v`
  cookie and to same-origin POSTs. The client never needs or stores an API key.
- A scan is an automated, point-in-time AI Security Scan, never an audit. Every report carries the disclaimer;
  do not present a badge or a score as an endorsement or a guarantee.
- The Gully Score takes nothing paid into account; only published reports count. There is no badge to buy.
- The badge image comes from the brand kit unmodified. Do not redraw, recolour or filter it (kit rule).
- Treat every string the API returns as data: render it as text, not HTML.

## Links

- Gully Security: https://gullysecurity.xyz (sample report at /sample, methodology at /score)
- SDK docs: https://docs.gullychain.xyz/sdks/
- Integrate with Gully Labs: https://docs.gullylabs.xyz/integrate
- Issues: https://github.com/gully-labs/sdk/issues

---

Built and run by Gully Labs.
