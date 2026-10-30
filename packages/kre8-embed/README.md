# @gullylabs/kre8-embed

Put kre8.fun on your own site: a Gully Chain coin card with a live sparkline, a track / video / Shorts / live player and a "Back this" button. Each card and player renders inside a sandboxed iframe served from kre8.fun, so your page never runs kre8 code, never holds a wallet or a session, and never moves money. Ships as web components, a React wrapper and a read-only data client.

- `<kre8-coin-card coin="0x...">`: name, ticker, icon, price, market cap, 24h change and a 24h sparkline for a coin on Gully Chain (chain id 485590), refreshed every 30 seconds.
- `<kre8-player track="..." | video="..." | short="..." | live="...">`: the kre8 player with "Listen / Watch on kre8".
- `<kre8-back-button creator="alice.gully">`: "Back this" opens the creator's kre8 page in a new tab.
- `createKre8Client()`: raw public data (coins, candles, tracks, creators, profiles) for your own UI.

## Install

```sh
npm install @gullylabs/kre8-embed
```

Node 18+ for the client; any evergreen browser for the elements. React is an optional peer (18+).

## 5-minute quickstart

### Script tag (no build step)

```html
<script src="https://unpkg.com/@gullylabs/kre8-embed/dist/kre8-embed.global.js" defer></script>

<kre8-coin-card coin="0x1234567890abcdef1234567890abcdef12345678"></kre8-coin-card>
<kre8-player track="trk_ab12CD34"></kre8-player>
<kre8-back-button creator="alice.gully"></kre8-back-button>
```

The script registers the three elements and exposes everything else as `window.Kre8Embed`.

### npm + React

```tsx
import { Kre8CoinCard, Kre8Player, Kre8BackButton } from '@gullylabs/kre8-embed/react'

export function Sidebar() {
  return (
    <>
      <Kre8CoinCard coin="0x1234567890abcdef1234567890abcdef12345678" onReady={(m) => console.log('card height', m.height)} />
      <Kre8Player track="trk_ab12CD34" />
      <Kre8BackButton creator="alice.gully" label="Back Alice" onBack={({ href }) => console.log('opened', href)} />
    </>
  )
}
```

### npm, plain DOM

```ts
import '@gullylabs/kre8-embed/define' // registers the elements once
// or: import { defineKre8Embeds } from '@gullylabs/kre8-embed'; defineKre8Embeds()

document.body.insertAdjacentHTML('beforeend', '<kre8-coin-card coin="0x..."></kre8-coin-card>')
```

### Raw data, no iframe

```ts
import { createKre8Client } from '@gullylabs/kre8-embed'

const kre8 = createKre8Client()
const coin = await kre8.coin('0x1234567890abcdef1234567890abcdef12345678') // indexer /tokens/:addr
const candles = await kre8.candles(coin!.address, '15m', 96)               // indexer /tokens/:addr/candles
const card = await kre8.coinCard(coin!.address)                            // kre8.fun /embed/coin/:addr.json
const track = await kre8.track('trk_ab12CD34')                             // social /v1/tracks/:id (server side)
```

## Elements

Attributes shared by every element:

| Attribute | Default | What |
|---|---|---|
| `origin` | `https://kre8.fun` | Where the embed is loaded from. Only `https://kre8.fun`, `https://www.kre8.fun` and `https://app.gullychain.xyz` are accepted; anything else renders an error, never an iframe. |
| `dev-origin` | none | Explicit development override: `http://localhost:<port>`, `http://127.0.0.1:<port>` or any `https://` origin (a staging kre8). Wins over `origin`. |

### `<kre8-coin-card>`

| Attribute | Required | What |
|---|---|---|
| `coin` | yes | The coin's address on Gully Chain (`0x` + 40 hex). |
| `title` | no | The iframe's accessible title (default "Coin on kre8"). |

Page: `https://kre8.fun/embed/coin/<address>`. The card is 100% wide (designed for 320 to 480 px), resizes itself to its content and refreshes price, market cap, 24h change and the sparkline every 30 seconds from `/embed/coin/<address>.json`. The "Trade on kre8" button opens the coin page in a new tab. Unknown coins show "This coin is not on kre8."

### `<kre8-player>`

| Attribute | Required | What |
|---|---|---|
| `track` | one of | A creator track id (8 to 24 URL-safe characters). 480 x 152. |
| `video` | one of | A Gully Video title id. 640 x 360. |
| `short` | one of | A Short id. 360 x 640. |
| `live` | one of | A live stream id. 640 x 360. |
| `title` | no | The iframe's accessible title. |
| `drop` | reserved | kre8 has no Drop entity today; setting `drop` renders "Drops are not on kre8 yet" and loads nothing. It is reserved so a future page can light it up without a breaking change. |

Set exactly one of `track`, `video`, `short`, `live`. Pages: `https://kre8.fun/embed/<kind>/<id>` (the same players kre8's Share sheet and oEmbed hand out). Playback of members-only or paid titles is not possible in an embed: the player says so and sends people to kre8.

### `<kre8-back-button>`

| Attribute | Required | What |
|---|---|---|
| `creator` | yes | A `.gully` handle (`alice`, `alice.gully`, `@alice`) or a `0x` wallet address. |
| `label` | no | Button text (default "Back this"). |
| `size` | no | `sm` (36 px), `md` (44 px, default), `lg` (52 px). |
| `disabled` | no | Disables the button. |

This one renders on your page, not in an iframe: a kit-styled yellow pill with the kre8 icon. A click opens `https://kre8.fun/@<handle>` (or `/address/<0x>`) in a new tab with `noopener,noreferrer` and emits `kre8-back`. Tips, memberships and coin buys happen there, signed in on kre8. Keeping the button on your page keeps the click's user activation, so browsers never block the new tab.

### Events

All events are `CustomEvent`s that bubble and are composed; `detail` is the message.

| Event | Elements | `detail` |
|---|---|---|
| `kre8-ready` | coin card, player | `{ type: 'ready', kind, id, height }` |
| `kre8-resize` | coin card, player | `{ type: 'resize', height }` |
| `kre8-open` | coin card, player | `{ type: 'open', href }` when a link inside the embed opened a kre8 page |
| `kre8-error` | all | `{ message }` (bad attributes, unknown item, foreign origin) |
| `kre8-back` | back button | `{ creator, href }` |

Properties: `element.src` (the iframe URL in use), `element.embedOrigin`, `backButton.href`, `backButton.activate()`.

## postMessage protocol and security model

Everything an embed knows is in its URL: `https://kre8.fun/embed/<kind>/<id>?origin=<your page's origin>&nonce=<16 random chars>`. No cookies, tokens, wallet addresses or user data are passed in, and the embed pages have none to pass out (they are served with `Content-Security-Policy: default-src 'none'; script-src 'self'; ...`, have no sign-in and no wallet code).

The iframe is created with

```
sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
referrerpolicy="strict-origin-when-cross-origin" loading="lazy" title="..."
```

No `allow-forms`, `allow-top-navigation`, `allow-modals`, `allow-downloads` or `allow-pointer-lock`. `allow-same-origin` keeps the page's kre8.fun origin so your page can verify where messages come from and so the coin card can refresh from its own `.json`. Players get `allow="autoplay; encrypted-media; fullscreen; picture-in-picture"`; the coin card gets `allow=""`.

Messages flow one way, embed to host. The page's `bridge.js` posts only when both `origin` and `nonce` were in its URL, always with `targetOrigin` set to that origin (never `*`), and it handles no incoming messages at all, so nothing on your page can steer it. The host accepts a message only when all of these hold:

1. `event.origin` equals the embed origin the iframe was loaded from (exact string match).
2. `event.source` is that iframe's window.
3. `nonce` equals this element's nonce (a fresh 16-character random id per instance).
4. The body is `{ kre8: 1, v: 1, nonce, type, ... }` with one of these shapes:

| `type` | Fields | Host behaviour |
|---|---|---|
| `ready` | `kind`, `id`, `height` (1..4000) | hides the loading state, sets the height (coin card, track) |
| `resize` | `height` (1..4000) | sets the height (coin card, track) |
| `open` | `href` | emits `kre8-open` only if `href` is on the embed origin; the link itself opened the tab |
| `error` | `message` (<= 500 chars) | shows the message in the kit fallback, emits `kre8-error` |

Anything else is dropped silently. Money never moves on your page: the only outbound actions are links inside the iframe and the Back button, and both open kre8.fun in a new tab with `noopener`.

## Data client

`createKre8Client({ indexerUrl?, socialUrl?, origin?, devOrigin?, fetch?, timeoutMs? })` talks to three public services, read-only, with `credentials: 'omit'`:

| Method | Calls | Notes |
|---|---|---|
| `coin(address)` | indexer `GET /tokens/:addr` | price, market cap, FDV, liquidity, 24h volume, holders, % change per window, icon CID (resolved through `https://ipfs.gullylabs.xyz/ipfs/`) |
| `coins()` | indexer `GET /tokens` | every indexed coin |
| `candles(address, tf, limit)` | indexer `GET /tokens/:addr/candles` | `tf`: 1m 5m 15m 1h 4h 1d; limit <= 2000 |
| `coinCard(address)` | kre8.fun `GET /embed/coin/:addr.json` | the card's numbers and 24h sparkline (CORS `*`) |
| `track(id)` | social `GET /v1/tracks/:id` | public fields; null when unknown or taken down |
| `trackPlays(id, days)` | social `GET /v1/tracks/:id/plays?days=` | plays per UTC day, 1..90 days |
| `creator(address)` | social `GET /v1/creators/:address` | creator page settings and https links |
| `creatorTracks(address)` | social `GET /v1/creators/:address/tracks` | |
| `trendingCreators(limit)` | social `GET /v1/creators/trending?limit=` | 7-day window, <= 30 |
| `profile(address)` | social `GET /v1/profiles/:address` | followers, following, posts, points, verified, official |

Defaults: `https://indexer.gullychain.xyz` (CORS `*`, usable from any browser page) and `https://social.kre8.fun`. The social API's CORS allowlist is kre8.fun and app.gullychain.xyz only, so call its methods from a server (Node 18+) or through your own proxy. Fields the server did not send come back as `null`; nothing is estimated.

## Links

- Gully Chain SDKs: https://docs.gullychain.xyz/sdks/
- Integrate with Gully Labs: https://docs.gullylabs.xyz/integrate
- kre8.fun: https://kre8.fun
- Issues: https://github.com/gully-labs/sdk/issues

## License

MIT. Built and run by Gully Labs.
