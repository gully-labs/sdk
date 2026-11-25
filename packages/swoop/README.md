# @swoopads/sdk

Formerly `@gullylabs/ads`. The Swoop Ads SDK for creators' sites and apps: Swoop Ads connects creators with sponsors.
Creators earn from what they make; sponsors pay to be seen next to it. Everything is counted in USD, with no cookies and
no trackers.

> **Early preview on the Gully Chain testnet.** Sponsor units stay hidden until sponsors run. Nothing here is real money yet.
> This package is built from source in the repo and is not on npm until the owner publishes it (2FA).

```sh
npm install @swoopads/sdk
```

## The one-minute way: a unit, no backend

```ts
import { mountUnit } from '@swoopads/sdk'

const unit = mountUnit(document.getElementById('sponsor'), { spot: 'pk_your_spot_key', unit: 'native', size: '480x160', theme: 'auto' })
// unit.destroy() removes it; unit.refresh() asks for another ad
```

React:

```tsx
import { SwoopUnit } from '@swoopads/sdk/react'

<SwoopUnit spot="pk_your_spot_key" unit="banner" theme="dark" onState={(s) => console.log(s)} />
```

Or skip the package and paste the hosted tag, which does the same: `<script src="https://swoopads.xyz/t.js" data-spot="pk_your_spot_key" data-unit="native" async></script>`.
See https://docs.swoopads.xyz/tag/ for options, sizes and the pinned, hash-checked address.

What a unit does: it adds one sandboxed iframe from the Swoop Ads service that shows a card labelled **Sponsored** with
Why this ad, Hide and Report; counts a view once half of it has been on screen for a second; collapses to nothing when
there is no ad (or the page kind is a money page such as `checkout`); and never throws into your page. `unitUrl(options)`
gives the address it loads, `loadTag()` injects the hosted tag.

| Option | Values | Default |
|---|---|---|
| `spot` | your public Spot key `pk_…` (safe in a page) | none |
| `unit` | `banner`, `text`, `native` | `native` |
| `theme` | `light`, `dark`, `auto` | `auto` |
| `slot` | which sponsor spot to fill | `watch_rail` (banner), `home_feed` |
| `size` | the exact size: banner `1200x400` `970x250` `728x90` `600x200` `468x60` `320x100` `320x50` `300x250`, text `728x90` `480x120` `320x140`, native `480x160` `320x140` | the biggest listed size that fits the element |
| `width` | the widest size it may take, px | the element's width |
| `block` | a CSS selector: when it matches anything on the page, no unit is drawn | none |
| `page`, `creator`, `content`, `topic` | context for the pick; `page` keeps ads off money pages | `article` |

### The ad rules (https://docs.swoopads.xyz/ad-rules/)

Every unit from this package follows them, the same as the hosted tag 1.1+: drawn at one listed size exactly, or not at all (a
creative that does not fit the size is not drawn and the element takes no space); opens only while it is off screen, so the page
never moves (only the reader's own Hide closes one in view); at most one unit in view on a phone (480 px wide or less); never on
pages where money moves or sign-in pages (by the address and `page`), on pages with password, email, card or one-time-code
fields, inside a form, inside a fixed or sticky container, or where `block` / `data-swoop-no-ads` say so; images and text only,
no sound, no pop-ups, no overlays. `<swoop-ad-slot>` needs a `size` attribute for the same reason. The reason a unit stayed
empty is in `data-swoop-reason` (`mountUnit`) or `data-reason` (`<swoop-ad-slot>`).

## The signed way (your own backend)

The rest of this page is the signed serve client, the `<swoop-ad-slot>` element (older name `<gully-ad-slot>`) and the
server helper. Use it when you draw the ad yourself.

## 5-minute quickstart

You need a **placement** from the Offerwall publisher dashboard (`https://offers.kre8.fun/dashboard/`): its publishable
key `pk_…` (public, the site id) and its secret `sk_…` (shown once; keep it in your server's secrets, never in a bundle).

### 1. A sign route on your backend

Express:

```ts
import express from 'express'
import { createServeSigner } from '@swoopads/sdk/server'

const sign = createServeSigner({
  siteId: process.env.GULLY_ADS_SITE_ID!, // pk_…
  siteKey: process.env.GULLY_ADS_SITE_KEY!, // sk_…  (server only)
  allowSlots: ['watch_rail', 'home_feed'], // optional: the slots your pages use
})

const app = express()
app.use(express.json())
app.post('/api/gully-ads/sign', async (req, res) => {
  try {
    res.json(await sign(req.body)) // { query, headers, timestamp, nonce, signature }
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})
```

Next.js route handler (`app/api/gully-ads/sign/route.ts`, works on the edge runtime too):

```ts
import { createServeSigner } from '@swoopads/sdk/server'

const sign = createServeSigner({ siteId: process.env.GULLY_ADS_SITE_ID!, siteKey: process.env.GULLY_ADS_SITE_KEY! })

export async function POST(req: Request) {
  try {
    return Response.json(await sign(await req.json()))
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 })
  }
}
```

### 2. The slot on the page

```html
<script type="module">
  import '@swoopads/sdk/define'
</script>

<gully-ad-slot slot="watch_rail" site="pk_your_placement" sign-url="/api/gully-ads/sign"
  creator="channel:ch_123" content="vid_456"></gully-ad-slot>
```

Or configure once and leave the attributes to the slot itself:

```ts
import { configureAds, defineAdSlot } from '@swoopads/sdk'

configureAds({ siteId: 'pk_your_placement', signUrl: '/api/gully-ads/sign' })
defineAdSlot()
```

React:

```tsx
import { AdSlot } from '@swoopads/sdk/react'

<AdSlot slot="home_feed" site="pk_your_placement" signUrl="/api/gully-ads/sign" topic="gaming"
  onImpression={(ad, ms) => console.log('viewed', ad.serve, ms)} />
```

The element renders nothing and sets `hidden` when there is no ad (no fill, members / ad-free viewers, paid content,
Gully Ads off), so it never leaves an empty box.

## The signing scheme, and why the key stays on the server

A serve request names the creator who earns from the slot, so it is signed: only a publisher holding the placement
secret can name a creator, and the secret never reaches the browser.

This SDK uses the Gully Offerwall's server-to-server signature, the same one its postbacks and reward callbacks use,
applied to the serve query string:

```
message   = `${timestamp}.${nonce}.${query}`        query = the string after "?" (keys sorted by the SDK)
signature = hex( HMAC-SHA256( sk_secret, message ) )

X-Gully-Key:        pk_…  (placement publishable key = the site id)
X-Gully-Timestamp:  unix seconds; accepted within 300 s either way
X-Gully-Nonce:      16-64 url-safe chars, single use (replay -> 409)
X-Gully-Signature:  the hex HMAC
```

`signServeRequest` produces it with WebCrypto; `verifyServeRequest` is the verifier ported line for line (same checks,
same order, same error codes `bad_postback` / `stale` / `replay`). The tests prove the SDK signature equals the
Offerwall's own signer on a fixed vector and on random inputs.

Why the browser never sees `sk_…`: anything in a bundle is public, and the secret authorises **who gets paid**. So the
browser builds the query, posts it to *your* `sign-url`, gets back the four headers, and sends the serve request itself.
The serve must come from the viewer's browser: the server ties each serve to a daily hash of ip + user agent
(`Ads.viewer`) and rejects impressions from any other viewer (`viewer_mismatch`), so a server-side proxy would not be
counted. `GullyAds` throws if it is constructed with a `siteKey`, and refuses a signer response that contains one.

**Server status.** The signed-serve check is not merged in the Offerwall yet (the review lists it as "Open (design)";
the live API still accepts unsigned serves and ignores these headers). Headers from a third-party origin also need the
API's CORS allow-list to include your origin and the `X-Gully-*` headers. Until both land, the SDK works unsigned (omit
`sign-url`) and `creator` attribution should not be relied on.

## Attributes

| Attribute | React prop | Serve query | Notes |
|---|---|---|---|
| `slot` | `slot` | `slot` | required; one of the slot ids in `GET /v1/ads/slots` (`watch_rail`, `home_feed`, `creator_page`, `shorts_feed`, ...) |
| `site` | `site` | (X-Gully-Key) | your placement `pk_…` |
| `sign-url` | `signUrl` | | your backend route: `POST { query }` -> `SignedServe` |
| `base-url` | `baseUrl` | | API origin, default `https://offers.kre8.fun` |
| `page` | `page` | `page` | page type slug (`watch`, `listen`, `home`, ...) |
| `topic` | `topic` | `topic` | topic slug; topic-targeted campaigns need it |
| `creator` | `creator` | `creator` | wallet, Gully ID or `channel:<id>`; pays the creator's share |
| `content` | `content` | `content` | video / track / stream id |
| `content-price` | `contentPrice` | `contentPrice` | `free \| members \| rent \| collectors \| ppv`; media slots only fill on `free` |
| `duration-sec` | `durationSec` | `durationSec` | hosting video length (mid-roll needs > 600) |
| `member`, `ad-free`, `gated` | same | `member`, `adFree`, `gated` | boolean flags: present = no ads for this viewer / content |
| `access` | `access` | `access` | `members` for members-only content |
| `label` | `label` | | the small label before "Sponsored" (default `Ad`) |

The element always requests `n=1`. Events bubble as `gully-ad:fill`, `gully-ad:empty` (`detail.reason`, `detail.status`),
`gully-ad:impression` (`detail.visibleMs`), `gully-ad:click`, `gully-ad:error`; the React wrapper exposes them as
`onFill`, `onEmpty`, `onImpression`, `onClick`, `onError`. `element.ad` is the current creative, `element.load()` reloads.

## Rendering and reporting

- **Safe rendering.** Creatives become DOM nodes with `textContent`: no HTML from the server is ever injected. Only
  `https:` URLs are used for images and links. Links open in a new tab with `rel="noopener sponsored"`. The card shows
  `Ad`, the server's `label` (`Sponsored`), the advertiser, "Why this ad?" (the server's `why` text) and "Hide".
  Video and audio creatives are shown as a card linking out (no autoplay media in this version).
- **Impressions.** An `IntersectionObserver` waits until the slot is at least 50% visible for `beacons.minVisibleMs`
  (1000 ms display, 2000 ms video/audio, the server's `LIMITS.minVisibleMs`), then posts once per serve to
  `beacons.events` (`POST /v1/ads/events { serve, kind: "impression", visibleMs }`) with `fetch(..., { keepalive })`,
  falling back to `navigator.sendBeacon`. The serve id `srv_…` is the token the server issued with the creative; the
  server counts it once (`duplicate`), within 1 h of the serve (`expired`), from the same viewer only.
- **Clicks.** Every link points at the creative's `clickTrackUrl` (`GET /v1/ads/click/:serve`): the server counts the
  click and 302s to the advertiser, so clicks are counted even when the page is unloading. `GullyAds.click(ad)` posts
  `{ serve, kind: "click" }` for custom renderers; `complete(ad)` / `skip(ad)` exist for media.
- **Hide / Report.** `POST /v1/ads/hide { serve }` and `POST /v1/ads/report { serve, reason, details? }`
  (reasons: `misleading | scam | offensive | sexual | illegal | wrong_label | too_loud | other`). Pass the viewer's
  Gully ID bearer token (`token` option) to hide for good instead of for the day.

## Client API

```ts
import { GullyAds } from '@swoopads/sdk'

const ads = new GullyAds({ siteId: 'pk_…', signUrl: '/api/gully-ads/sign' }) // or getSignedServe: async (query) => ({ headers })
const { ads: list, reason } = await ads.serve({ slot: 'home_feed', topic: 'gaming', n: 2 })
await ads.impression(list[0], 1200)
await ads.hide(list[0])
await ads.report(list[0], 'misleading')
await ads.slots() // slot definitions, media numbers, report reasons, price floors
```

`serve()` returns `{ ads: [], reason: 'ads_disabled', status: 404 }` when the route is absent; other non-2xx answers throw
`GullyAdsError`. `canonicalServeQuery(q)` is exported so you can sign the exact string the client will send.

## Links

- SDK docs: https://docs.gullychain.xyz/sdks/
- Integrate with Gully Labs: https://docs.gullylabs.xyz/integrate
- Gully Ads dashboard (advertisers, creators): https://offers.kre8.fun/ads/
- Source and issues: https://github.com/gully-labs/sdk

MIT. Built and run by Gully Labs.
