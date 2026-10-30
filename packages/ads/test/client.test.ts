// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { GullyAds } from '../src/client'
import { AD } from './fixtures'

const SITE_KEY = 'sk_test_0123456789abcdefghijkl'
const HEADERS = { 'x-gully-key': 'pk_test_site_000000000001', 'x-gully-timestamp': '1793361600', 'x-gully-nonce': 'nonce_test_0000000001', 'x-gully-signature': 'c4ed456aed1237e2be36ca1bf6ad384f63c8df46f62893fedea4ae10f3badefd' }


const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('GullyAds client', () => {
  it('refuses to be constructed with a secret', () => {
    expect(() => new GullyAds({ siteKey: SITE_KEY } as never)).toThrow(/never be given to the browser/)
  })

  it('serve: asks the signer for the canonical query, sends the four headers and never the key', async () => {
    const f = vi.fn<typeof fetch>(async (url) => (String(url).includes('/v1/ads/serve') ? json({ ads: [AD], reason: null }) : json({}, 500)))
    const signer = vi.fn(async (_query: string) => ({ headers: HEADERS }))
    const ads = new GullyAds({ fetch: f, getSignedServe: signer, siteId: 'pk_test_site_000000000001' })
    const r = await ads.serve({ slot: 'watch_rail', creator: 'channel:abc', content: 'vid_1', n: 1 })
    expect(r.ads[0]?.serve).toBe(AD.serve)
    expect(signer).toHaveBeenCalledWith('content=vid_1&creator=channel%3Aabc&n=1&slot=watch_rail')
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://offers.kre8.fun/v1/ads/serve?content=vid_1&creator=channel%3Aabc&n=1&slot=watch_rail')
    expect(init.headers).toMatchObject(HEADERS)
    expect(JSON.stringify([url, init])).not.toContain(SITE_KEY)
  })

  it('serve via signUrl: POSTs { query } to the publisher endpoint and uses the returned headers', async () => {
    const f = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url) === '/api/gully-ads/sign') {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toEqual({ query: 'n=1&slot=home_feed' })
        return json({ query: 'n=1&slot=home_feed', headers: HEADERS })
      }
      return json({ ads: [], reason: 'no_fill' })
    })
    const ads = new GullyAds({ fetch: f, signUrl: '/api/gully-ads/sign' })
    const r = await ads.serve({ slot: 'home_feed', n: 1 })
    expect(r).toMatchObject({ ads: [], reason: 'no_fill', status: 200 })
    expect((f.mock.calls[1] as [string, RequestInit])[1].headers).toMatchObject(HEADERS)
  })

  it('serve: a signer leaking an sk_ secret is rejected before any request leaves', async () => {
    const f = vi.fn<typeof fetch>(async () => json({ ads: [] }))
    const ads = new GullyAds({ fetch: f, getSignedServe: async () => ({ headers: { ...HEADERS, 'x-gully-signature': SITE_KEY } }) })
    await expect(ads.serve({ slot: 'home_feed' })).rejects.toThrow(/secret reached the browser/)
    expect(f).not.toHaveBeenCalled()
  })

  it('serve: 404 (ADS_ENABLED=0, route absent) collapses to ads_disabled; 200 ads_disabled passes through', async () => {
    const ads404 = new GullyAds({ fetch: (async () => new Response('{"error":"not found","code":"not_found"}', { status: 404 })) as unknown as typeof fetch })
    expect(await ads404.serve({ slot: 'home_feed' })).toEqual({ ads: [], reason: 'ads_disabled', status: 404 })
    const adsOff = new GullyAds({ fetch: (async () => json({ ads: [], reason: 'ads_disabled' })) as unknown as typeof fetch })
    expect(await adsOff.serve({ slot: 'home_feed' })).toMatchObject({ ads: [], reason: 'ads_disabled', status: 200 })
    const broken = new GullyAds({ fetch: (async () => json({ error: 'x' }, 500)) as unknown as typeof fetch })
    await expect(broken.serve({ slot: 'home_feed' })).rejects.toThrow(/serve failed: 500/)
  })

  it('impression and click beacons: POST beacons.events with keepalive, the server body shape', async () => {
    const f = vi.fn<typeof fetch>(async () => json({ counted: true, billed: '0.0005' }))
    const ads = new GullyAds({ fetch: f })
    expect(await ads.impression(AD, 1234)).toEqual({ counted: true, billed: '0.0005' })
    let [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(AD.beacons.events)
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(String(init.body))).toEqual({ serve: AD.serve, kind: 'impression', visibleMs: 1234 })
    await ads.click(AD)
    ;[url, init] = f.mock.calls[1] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({ serve: AD.serve, kind: 'click' })
    await ads.track('srv_abcdefghijklmnopqrstuv', 'complete')
    ;[url, init] = f.mock.calls[2] as unknown as [string, RequestInit]
    expect(url).toBe('https://offers.kre8.fun/v1/ads/events')
    await expect(ads.track('not-a-serve', 'click')).rejects.toThrow(/bad serve id/)
  })

  it('beacons fall back to sendBeacon when fetch throws', async () => {
    const beacon = vi.fn((_url: string | URL, _data?: BodyInit | null) => true)
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
    const ads = new GullyAds({ fetch: (async () => { throw new TypeError('network') }) as unknown as typeof fetch })
    expect(await ads.click(AD)).toBeNull()
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(beacon.mock.calls[0]![0]).toBe(AD.beacons.events)
  })

  it('hide and report use the creative beacons and the bearer token', async () => {
    const f = vi.fn<typeof fetch>(async (url) => (String(url).endsWith('/hide') ? json({ hidden: true, note: 'ok' }) : json({ reported: true, note: 'ok' })))
    const ads = new GullyAds({ fetch: f, token: () => 'tok_abc' })
    expect(await ads.hide(AD)).toEqual({ hidden: true, note: 'ok' })
    expect(await ads.report(AD, 'scam', 'fake wallet')).toEqual({ reported: true, note: 'ok' })
    const [hideUrl, hideInit] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(hideUrl).toBe(AD.beacons.hide)
    expect(hideInit.headers).toMatchObject({ authorization: 'Bearer tok_abc' })
    expect(JSON.parse(String(hideInit.body))).toEqual({ serve: AD.serve })
    const [repUrl, repInit] = f.mock.calls[1] as unknown as [string, RequestInit]
    expect(repUrl).toBe(AD.beacons.report)
    expect(JSON.parse(String(repInit.body))).toEqual({ serve: AD.serve, reason: 'scam', details: 'fake wallet' })
  })
})
