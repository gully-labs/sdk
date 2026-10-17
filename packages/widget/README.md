# @gullylabs/widget

The [Gully Labs stock token tracker](https://gullylabs.xyz/tracker) on any page: a scrolling ticker, a one-stock badge with a 24-hour gap chart, or a sortable table of the widest gaps. Real logos, live every minute, drawn in its own shadow root so it never clashes with your styles.

```sh
npm install @gullylabs/widget
```

## React

```tsx
import { GullyWidget } from '@gullylabs/widget/react'

<GullyWidget type="ticker" />
<GullyWidget type="badge" ticker="NVDA" chain="robinhood" />
<GullyWidget type="table" limit={5} theme="light" />
```

## Any framework

```ts
import { mountWidget } from '@gullylabs/widget'

await mountWidget(document.getElementById('gaps')!, { type: 'table', chain: 'bsc', limit: 5 })
```

## Options

| Option | Values | Default |
|---|---|---|
| `type` | `ticker`, `badge`, `table` | `ticker` |
| `chain` | `all`, `robinhood`, `bsc` | `all` |
| `ticker` | a stock, e.g. `NVDA` (badge only) | — |
| `theme` | `dark`, `light` | `dark` |
| `limit` | number of stocks (ticker, table) | all / 5 |
| `api` | another tracker deployment | `https://gullylabs.xyz` |

## Self-hosting the script

By default the loader uses `https://gullylabs.xyz/widget.js`. To serve it yourself, copy `node_modules/@gullylabs/widget/widget.js` to your site and pass its URL as the last argument of `mountWidget`, or `scriptSrc` on the React component. The file is ASCII-only, so it works whatever charset your server sends.

No code at all? See the builder at https://gullylabs.xyz/widget · Guide: https://docs.gullylabs.xyz/widget · MIT
