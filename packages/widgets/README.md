# @gullylabs/widgets

Gully Labs data clients and embeds in one package:

| Entry | What it is |
|---|---|
| `@gullylabs/widgets/holders` | Typed client for the [Holder Map](https://holdermaps.xyz) API: who holds a token and how the biggest wallets are connected. Chains: `gully` (Gully Chain, 485590), `robinhood`, `bsc`, `base`, `hyperevm`, `solana`. |
| `@gullylabs/widgets/holders/react` | `<HolderMap>`: frames the live map. |
| `@gullylabs/widgets/tracker` | Typed client for the [stock token tracker](https://gullylabs.xyz/tracker): every tokenised stock on Robinhood Chain and BNB Chain against its Chainlink fair price. |
| `@gullylabs/widgets/widget` | Loader for the tracker widget (ticker, badge, table). React: `@gullylabs/widgets/widget/react`. |
| `@gullylabs/widgets` | All three clients. `@gullylabs/widgets/react`: both components. |

No runtime dependencies. ESM and CommonJS builds with TypeScript types. Works anywhere `fetch` exists: browsers, Node 18+, Bun, Deno, edge runtimes.

It replaces `@gullylabs/holders`, `@gullylabs/tracker` and `@gullylabs/widget` (same APIs; only the import path changes).

## 5-minute quickstart

```sh
npm install @gullylabs/widgets
```

1. Read the holders of a Gully Chain token (no key needed):

```ts
import { createHoldersClient, isMapOk } from '@gullylabs/widgets/holders'

const holders = createHoldersClient() // { apiKey } raises the rate limit
const map = await holders.getMap('gully', '0x9665E20624F3a896067d75e51645e7E73FC35c48')
if (isMapOk(map)) console.log(map.summary.line)
else console.log(map.state, map.reason) // 'unavailable' | 'not-found' | 'busy' | 'error'

holders.cardUrl('gully', '0x...') // 1200 x 630 share card PNG for og:image
```

2. Show the map in a React app:

```tsx
import { HolderMap } from '@gullylabs/widgets/holders/react'

export const Holders = () => <HolderMap chain="gully" token="0x..." height={640} />
```

3. Put the live stock gap ticker on any page:

```tsx
import { GullyWidget } from '@gullylabs/widgets/widget/react'

<GullyWidget type="ticker" />
<GullyWidget type="badge" ticker="NVDA" chain="robinhood" />
```

```ts
import { createTrackerClient } from '@gullylabs/widgets/tracker'

const tracker = createTrackerClient()
for (const s of await tracker.widestGaps(5)) console.log(s.ticker, s.gapPct.toFixed(2) + '%')
```

No build step? `<div data-gully-widget="ticker"></div><script src="https://gullylabs.xyz/widget.js" async></script>`.

## Holder Map client

`getMap(chain, token)` resolves with the server's answer even when a map could not be drawn (check `state` or use `isMapOk`) and throws `HoldersApiError` for a rate limit, a bad request or no answer. `getCsv` needs a plan that includes the CSV export. `cardUrl`, `embedUrl` and `pageUrl` build addresses without a request. `<HolderMap>` frames `gullylabs.xyz/embed/holders/:chain/:token`; the map reads its own data inside the frame. Height 360 to 2000 (default 760). If your Content Security Policy restricts frames, add `frame-src https://gullylabs.xyz`. To get a launchpad's launches recognised, see https://docs.gullylabs.xyz/holder-map-integrate.

## Tracker client

```ts
const tracker = createTrackerClient({ apiKey: process.env.GULLY_API_KEY }) // key optional
await tracker.getTracker()                    // chains, rows, rules, sources
await tracker.getStock('robinhood', 'NVDA')   // one row, or null
await tracker.getRows({ status: ['premium', 'discount'] })
await tracker.widestGaps(5, 'bsc')            // trusted gaps, largest first
await tracker.getHistory('robinhood', 'NVDA') // 7 days of { time, gapPct, onchain, fair }
const stop = tracker.watch((t) => console.log(t.generatedAt))
tracker.rateLimit                             // { limit, remaining, resetSeconds }
```

| Field | Meaning |
|---|---|
| `fair` | Chainlink price in USD (on BNB Chain times the token's on-chain multiplier). |
| `onchain` | Price in the token's deepest pool, read from the pool contract. |
| `gapPct` | `(onchain - fair) / fair x 100`. |
| `status` | `in-line` under 1 %, `drifting` 1-2 %, `premium` / `discount` 2 % or more; `thin` under $10K of pool depth (not trusted); `no-pool`, `pool-unreadable`, `feed-unreadable` when a price could not be read. |

A price that cannot be read is `null`, never zero. Every failure is a `GullyApiError` with `status` (0 for a network error or timeout) and `retryAfter` on a 429. Limits: 60 calls a minute per IP with no key, 600 with a key from https://app.gullylabs.xyz.

## Widget options

| Option | Values | Default |
|---|---|---|
| `type` | `ticker`, `badge`, `table` | `ticker` |
| `chain` | `all`, `robinhood`, `bsc` | `all` |
| `ticker` | a stock, e.g. `NVDA` (badge only) | - |
| `theme` | `dark`, `light` | `dark` |
| `limit` | number of stocks (ticker, table) | all / 5 |
| `api` | another tracker deployment | `https://gullylabs.xyz` |

Self-hosting: copy `node_modules/@gullylabs/widgets/widget.js` to your site and pass its URL as the last argument of `mountWidget` (or `scriptSrc` on the React component).

## Migrating from the old packages

| Old | New |
|---|---|
| `@gullylabs/holders` | `@gullylabs/widgets/holders` |
| `@gullylabs/holders/react` | `@gullylabs/widgets/holders/react` |
| `@gullylabs/tracker` | `@gullylabs/widgets/tracker` |
| `@gullylabs/widget` | `@gullylabs/widgets/widget` |
| `@gullylabs/widget/react` | `@gullylabs/widgets/widget/react` |

## Links

- Integrate every Gully SDK in 5 minutes: https://docs.gullylabs.xyz/integrate and, for Gully Chain builders, https://docs.gullychain.xyz/sdks/
- API reference: https://docs.gullylabs.xyz/api

MIT. Built and run by [Gully Labs](https://gullylabs.xyz).
