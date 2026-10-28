<!-- gully-header:start -->
<p align="center">
  <a href="https://docs.gullylabs.xyz/sdk">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/gully-labs-logo.png">
      <img alt="Gully Labs" src=".github/assets/gully-labs-logo-on-light.png" width="300">
    </picture>
  </a>
</p>

<p align="center"><b>You Think It, We Ship It.</b></p>

<p align="center">Typed client for the stock token tracker API and the embeddable widget (React + vanilla). MIT.</p>

<p align="center">
  <a href="https://gullylabs.xyz"><img src="https://img.shields.io/badge/gullylabs.xyz-00D2FF?style=for-the-badge&labelColor=06050D&logo=googlechrome&logoColor=06050D" alt="Website"></a>
  <a href="https://docs.gullylabs.xyz/sdk"><img src="https://img.shields.io/badge/docs.gullylabs.xyz/sdk-0B0A16?style=for-the-badge&labelColor=06050D&logo=googlechrome&logoColor=00D2FF" alt="App"></a>
  <a href="https://docs.gullylabs.xyz"><img src="https://img.shields.io/badge/Docs-0B0A16?style=for-the-badge&labelColor=06050D&logo=readthedocs&logoColor=00D2FF" alt="Docs"></a>
  <a href="https://discord.com/invite/tY2ErsNNBp"><img src="https://img.shields.io/badge/Discord-0B0A16?style=for-the-badge&labelColor=06050D&logo=discord&logoColor=5865F2" alt="Discord"></a>
  <a href="https://x.com/Gully_Labs"><img src="https://img.shields.io/badge/@Gully__Labs-0B0A16?style=for-the-badge&labelColor=06050D&logo=x&logoColor=white" alt="X"></a>
</p>

<p align="center"><sub>Built and run by <a href="https://gullylabs.xyz">Gully Labs</a>. You Think It, We Ship It.</sub></p>

---
<!-- gully-header:end -->

# Gully Labs SDK

Build on the Gully Labs stock token tracker: every tokenised stock on Robinhood Chain and BNB Chain, priced from its deepest pool on chain against its Chainlink fair price, refreshed every minute.

| Package | What it is |
|---|---|
| [`@gullylabs/tracker`](packages/tracker) | A typed client for the tracker API. No dependencies; runs in browsers, Node 18+, Bun, Deno and edge runtimes. |
| [`@gullylabs/widget`](packages/widget) | The embeddable widget (ticker, badge, table) with a loader and a React component. |
| [`@gullylabs/holders`](packages/holders) | A typed client for the Holder Map API (who holds a token, wallet clusters) and a React component that frames the map. |


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


<!-- gully-footer:start -->
---

<p align="center">
  <a href="https://gullylabs.xyz">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/powered-by-gully-labs-dark-2x.png">
      <img alt="Powered by Gully Labs" src=".github/assets/powered-by-gully-labs-light-2x.png" width="254" height="64">
    </picture>
  </a>
</p>
<!-- gully-footer:end -->
