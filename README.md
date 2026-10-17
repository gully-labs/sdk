<a href="https://gullylabs.xyz/tracker"><img src="https://gullylabs.xyz/social/og-tracker.png" alt="Gully Labs stock token tracker" width="100%"></a>

# Gully Labs SDK

Build on the Gully Labs stock token tracker: every tokenised stock on Robinhood Chain and BNB Chain, priced from its deepest pool on chain against its Chainlink fair price, refreshed every minute.

| Package | What it is |
|---|---|
| [`@gullylabs/tracker`](packages/tracker) | A typed client for the tracker API. No dependencies; runs in browsers, Node 18+, Bun, Deno and edge runtimes. |
| [`@gullylabs/widget`](packages/widget) | The embeddable widget (ticker, badge, table) with a loader and a React component. |

## Quick start

```ts
import { createTrackerClient } from '@gullylabs/tracker'

const tracker = createTrackerClient() // 60 calls a minute, no key needed

const widest = await tracker.widestGaps(5)
for (const s of widest) console.log(s.ticker, s.chain, s.gapPct.toFixed(2) + '%')
```

```tsx
import { GullyWidget } from '@gullylabs/widget/react'

export const Nvda = () => <GullyWidget type="badge" ticker="NVDA" chain="robinhood" />
```

No build step? One script tag does the same:

```html
<div data-gully-widget="ticker"></div>
<script src="https://gullylabs.xyz/widget.js" async></script>
```

## Limits and keys

Anonymous calls get 60 a minute per IP. A key from the [developer portal](https://developers.gullylabs.xyz) (sign in with your wallet, no form) gets 600:

```ts
const tracker = createTrackerClient({ apiKey: process.env.GULLY_API_KEY })
```

## Links

- API reference: https://docs.gullylabs.xyz/api
- Methodology: https://docs.gullylabs.xyz/methodology
- Live tracker: https://gullylabs.xyz/tracker
- X: [@Gully_Labs](https://x.com/Gully_Labs)

Information only, not investment advice. MIT licensed.
