# @gullylabs/holders

The [Gully Labs Holder Map](https://gullylabs.xyz/holders) for your app: who holds a token and how the biggest wallets are connected. A typed API client with no dependencies, and a React component that frames the live map.

```sh
npm install @gullylabs/holders
```

## Client

```ts
import { createHoldersClient, isMapOk } from '@gullylabs/holders'

const holders = createHoldersClient() // no key needed; { apiKey } raises the rate limit

const map = await holders.getMap('base', '0x…') // an address, or a ticker the tracker follows
if (isMapOk(map)) {
  console.log(map.summary.line) // "Top 10 wallets hold 41.2%; …"
  for (const w of map.nodes.slice(0, 5)) console.log(w.rank, w.short, w.pct)
} else {
  console.log(map.state, map.reason) // 'unavailable' | 'not-found' | 'busy' | 'error'
}

holders.cardUrl('base', '0x…') // 1200 x 630 share card PNG, for og:image or a link badge
```

`getMap` resolves with the server's answer when a map could not be drawn (check `state`) and throws `HoldersApiError` for a rate limit, a bad request or no answer. `getCsv` needs a plan that includes the CSV export. `embedUrl` and `pageUrl` build the framed and full-page addresses. Chains: `robinhood`, `bsc`, `base`, `hyperevm`, `solana`.

## React

```tsx
import { HolderMap } from '@gullylabs/holders/react'

<HolderMap chain="base" token="0x…" height={640} />
```

The component frames `gullylabs.xyz/embed/holders/:chain/:token`. The map reads its own data inside the frame, so your page makes no requests for it. `height` is 360 to 2000 (default 760). A "Powered by Gully Labs" credit always shows. If your Content Security Policy restricts frames, add `frame-src https://gullylabs.xyz`.

## Launchpads

To get a launchpad's launches recognised by the Holder Map, see https://docs.gullylabs.xyz/holder-map-integrate.
