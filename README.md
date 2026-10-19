<!-- gully-header:start -->
<a href="https://gullylabs.xyz/tracker"><img src="https://gullylabs.xyz/social/og-tracker.png" alt="Gully Labs" width="100%"></a>

<p align="center">
  <a href="https://gullylabs.xyz"><img src="https://img.shields.io/badge/gullylabs.xyz-E8C060?style=for-the-badge&labelColor=0B0E13&logo=googlechrome&logoColor=E8C060" alt="Website"></a>
  <a href="https://x.com/Gully_Labs"><img src="https://img.shields.io/badge/@Gully__Labs-0B0E13?style=for-the-badge&labelColor=0B0E13&logo=x&logoColor=white" alt="X"></a>
  <a href="https://t.me/peddlesnews"><img src="https://img.shields.io/badge/Telegram-0B0E13?style=for-the-badge&labelColor=0B0E13&logo=telegram&logoColor=26A5E4" alt="Telegram"></a>
  <a href="https://docs.gullylabs.xyz"><img src="https://img.shields.io/badge/Docs-0B0E13?style=for-the-badge&labelColor=0B0E13&logo=readthedocs&logoColor=E8C060" alt="Docs"></a>
  <a href="https://blog.gullylabs.xyz"><img src="https://img.shields.io/badge/Blog-0B0E13?style=for-the-badge&labelColor=0B0E13&logo=ghost&logoColor=E8C060" alt="Blog"></a>
  <a href="https://github.com/gully-labs"><img src="https://img.shields.io/badge/GitHub-0B0E13?style=for-the-badge&labelColor=0B0E13&logo=github&logoColor=white" alt="GitHub"></a>
</p>

<p align="center"><b>Typed tools for the Gully Labs stock token tracker: an API client and an embeddable widget.</b></p>

<p align="center"><sub>Part of <a href="https://gullylabs.xyz">Gully Labs</a>, a blockchain development company that builds, launches and runs its own Web3 projects.</sub></p>

---
<!-- gully-header:end -->
# Gully Labs SDK

Build on the Gully Labs stock token tracker: every tokenised stock on Robinhood Chain and BNB Chain, priced from its deepest pool on chain against its Chainlink fair price, refreshed every minute.

| Package | What it is |
|---|---|
| [`@gullylabs/tracker`](packages/tracker) | A typed client for the tracker API. No dependencies; runs in browsers, Node 18+, Bun, Deno and edge runtimes. |
| [`@gullylabs/widget`](packages/widget) | The embeddable widget (ticker, badge, table) with a loader and a React component. |
| [`@gullylabs/holders`](packages/holders) | A typed client for the Holder Map API (who holds a token, wallet clusters) and a React component that frames the map. Not published to npm yet. |


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

Anonymous calls get 60 a minute per IP. A key from the [Gully Labs app](https://app.gullylabs.xyz) (sign in with your wallet, no form) gets 600:

```ts
const tracker = createTrackerClient({ apiKey: process.env.GULLY_API_KEY })
```

## Links

- API reference: https://docs.gullylabs.xyz/api
- Methodology: https://docs.gullylabs.xyz/methodology
- Live tracker: https://gullylabs.xyz/tracker
- X: [@Gully_Labs](https://x.com/Gully_Labs)

Information only, not investment advice. MIT licensed.
