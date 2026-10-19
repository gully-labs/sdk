# @gullylabs/tracker

A typed client for the [Gully Labs stock token tracker](https://gullylabs.xyz/tracker): every tokenised stock on Robinhood Chain and BNB Chain, priced from its deepest pool on chain against its Chainlink fair price.

No dependencies. Works anywhere `fetch` exists: browsers, Node 18+, Bun, Deno, edge runtimes.

```sh
npm install @gullylabs/tracker
```

## Use

```ts
import { createTrackerClient, isTrusted } from '@gullylabs/tracker'

const tracker = createTrackerClient({ apiKey: process.env.GULLY_API_KEY }) // key optional

const all = await tracker.getTracker()                 // everything: chains, rows, rules, sources
const nvda = await tracker.getStock('robinhood', 'NVDA') // one row, or null
const flagged = await tracker.getRows({ status: ['premium', 'discount'] })
const widest = await tracker.widestGaps(5, 'bsc')       // trusted gaps, largest first
const history = await tracker.getHistory('robinhood', 'NVDA') // 7 days, { time, gapPct, onchain, fair }

const stop = tracker.watch((t) => console.log(t.generatedAt), { onError: console.error })
// later: stop()

console.log(tracker.rateLimit) // { limit, remaining, resetSeconds } from the last response
```

### What a row means

| Field | Meaning |
|---|---|
| `fair` | Chainlink price in USD. On BNB Chain the feed prices the share, multiplied by the token's on-chain multiplier. |
| `onchain` | Price in the token's deepest pool, read from the pool contract. |
| `gapPct` | `(onchain − fair) / fair × 100`. |
| `status` | `in-line` under 1 %, `drifting` 1–2 %, `premium` / `discount` 2 % or more; `thin` when the pool holds under $10K (not trusted); `no-pool`, `pool-unreadable`, `feed-unreadable` when a price could not be read. |
| `logo`, `chainLogo` | Absolute image URLs for the stock and the chain. |

A price that cannot be read is `null`, never zero. `isTrusted(row)` keeps the rows the tracker itself would chart.

### Errors

Every failure is a `GullyApiError` with `status` (0 for a network error or timeout) and, on a 429, `retryAfter` in seconds.

## Limits

60 calls a minute per IP with no key; 600 with a key from https://app.gullylabs.xyz. The tracker refreshes every minute, so polling faster than that returns the same data.

Full reference: https://docs.gullylabs.xyz/api · MIT
