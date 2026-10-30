# @gullylabs/ads

> **Beta: Gully Ads is not live yet.** Production runs with `ADS_ENABLED=0`, so `GET /v1/ads/serve` answers
> `{ ads: [], reason: "ads_disabled" }` (or 404 on older deploys) and every slot collapses. The package is published
> under the npm dist-tag `beta`; install it with `@beta`. The API shapes below are the server's as of 2026-10-30
> (gully-labs/gully-offerwall `api/src/ads.ts`, `api/src/ads-routes.ts`).

Publisher SDK for **Gully Ads**, the contextual, tracker-free ad network of the Gully Chain app ([kre8.fun](https://kre8.fun)),
built into the Gully Offerwall service. Shows Gully Ads creatives on your site or app, counts viewable impressions and
clicks, and keeps your placement secret on your server.

```sh
npm install @gullylabs/ads@beta
```

Four entries:

| Entry | Runs in | What |
|---|---|---|
| `@gullylabs/ads` | browser | `GullyAds` client, `GullyAdSlot` element class, `defineAdSlot()`, types |
| `@gullylabs/ads/define` | browser | side-effect import: registers `<gully-ad-slot>` |
| `@gullylabs/ads/react` | browser (React 18+) | `<AdSlot />` wrapper (react is an optional peer) |
| `@gullylabs/ads/server` | Node 18+, Deno, Bun, Workers | `signServeRequest`, `createServeSigner`, `verifyServeRequest` (WebCrypto) |

## 5-minute quickstart

You need a **placement** from the Offerwall publisher dashboard (`https://offers.kre8.fun/dashboard/`): its publishable
key `pk_…` (public, the site id) and its secret `sk_…` (shown once; keep it in your server's secrets, never in a bundle).

### 1. A sign route on your backend

Express:

```ts
import express from 'express'
import { createServeSigner } from '@gullylabs/ads/server'

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
import { createServeSigner } from '@gullylabs/ads/server'

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
  import '@gullylabs/ads/define'
</script>

<gully-ad-slot slot="watch_rail" site="pk_your_placement" sign-url="/api/gully-ads/sign"
  creator="channel:ch_123" content="vid_456"></gully-ad-slot>
```

Or configure once and leave the attributes to the slot itself:

```ts
import { configureAds, defineAdSlot } from '@gullylabs/ads'

configureAds({ siteId: 'pk_your_placement', signUrl: '/api/gully-ads/sign' })
defineAdSlot()
```

React:

```tsx
import { AdSlot } from '@gullylabs/ads/react'

<AdSlot slot="home_feed" site="pk_your_placement" signUrl="/api/gully-ads/sign" topic="gaming"
  onImpression={(ad, ms) => console.log('viewed', ad.serve, ms)} />
```

The element renders nothing and sets `hidden` when there is no ad (no fill, members / ad-free viewers, paid content,
Gully Ads off), so it never leaves an empty box.

## The signing scheme, and why the key stays on the server

The Offerwall's 2026-10 security review found that `GET /v1/ads/serve` trusts the `creator` named by the client, so
anyone could point creator earnings at their own wallet (`docs/security-review-2026-10.md`, finding 2). The fix the
review calls for is a signed serve request: only a publisher holding the placement secret can name a creator.

This SDK uses the Offerwall's **existing** server-to-server signature, the one its postbacks and reward callbacks already
use (`api/src/crypto.ts` `signPostback`, verified in `api/src/offerwall.ts` `Offerwall.postback`), applied to the serve
query string:

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
Offerwall's `signPostback` on a fixed vector and on random inputs.

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
import { GullyAds } from '@gullylabs/ads'

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
