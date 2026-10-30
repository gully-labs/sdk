// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAds } from '../src/client'
import { defineAdSlot, GullyAdSlot } from '../src/slot'
import type { AdCreative, ServeSignatureHeaders } from '../src/types'
import { AD } from './fixtures'

const SITE_KEY = 'sk_test_0123456789abcdefghijkl'
const HEADERS = { 'x-gully-key': 'pk_test_site_000000000001', 'x-gully-timestamp': '1793361600', 'x-gully-nonce': 'nonce_test_0000000001', 'x-gully-signature': 'c4ed456aed1237e2be36ca1bf6ad384f63c8df46f62893fedea4ae10f3badefd' }
const json = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

/** IntersectionObserver mock: tests drive visibility with `io.show(el, ratio)` */
type Cb = (entries: Partial<IntersectionObserverEntry>[]) => void
const observers = new Map<Element, Cb>()
class IO {
  constructor(private cb: Cb) {}
  observe(el: Element) {
    observers.set(el, this.cb)
  }
  disconnect() {
    for (const [el, cb] of observers) if (cb === this.cb) observers.delete(el)
  }
  unobserve() {}
}
const show = (el: Element, ratio: number) => observers.get(el)?.([{ isIntersecting: ratio > 0, intersectionRatio: ratio }])

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>
let signer: ReturnType<typeof vi.fn<(query: string) => Promise<{ headers: ServeSignatureHeaders }>>>
let serveBody: unknown = { ads: [AD], reason: null }
let serveStatus = 200

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IntersectionObserver', IO)
  observers.clear()
  serveBody = { ads: [AD], reason: null }
  serveStatus = 200
  fetchMock = vi.fn<typeof fetch>(async (url) => {
    const u = String(url)
    if (u.includes('/v1/ads/serve')) return serveStatus === 404 ? json({ error: 'not found', code: 'not_found' }, 404) : json(serveBody, serveStatus)
    if (u.endsWith('/v1/ads/events')) return json({ counted: true })
    if (u.endsWith('/v1/ads/hide')) return json({ hidden: true, note: '' })
    return json({}, 500)
  })
  signer = vi.fn(async (_query: string) => ({ headers: HEADERS }))
  configureAds({ fetch: fetchMock, getSignedServe: signer, signUrl: undefined })
  defineAdSlot()
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const mount = async (attrs: Record<string, string> = { slot: 'watch_rail', site: 'pk_test_site_000000000001', creator: 'channel:abc', content: 'vid_1' }) => {
  const el = document.createElement('gully-ad-slot') as GullyAdSlot
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  const events: string[] = []
  for (const t of ['gully-ad:fill', 'gully-ad:empty', 'gully-ad:impression', 'gully-ad:click', 'gully-ad:error']) el.addEventListener(t, () => events.push(t))
  document.body.append(el)
  await flush()
  return { el, events }
}

const eventPosts = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/v1/ads/events')).map((c) => JSON.parse(String((c[1] as RequestInit).body)))

describe('<gully-ad-slot>', () => {
  it('renders the creative in a shadow root with Ad label, https links only, rel noopener sponsored', async () => {
    const { el, events } = await mount()
    expect(events).toEqual(['gully-ad:fill'])
    expect(el.getAttribute('data-state')).toBe('filled')
    expect(signer).toHaveBeenCalledWith('content=vid_1&creator=channel%3Aabc&n=1&slot=watch_rail')
    const root = el.shadowRoot!
    expect(root.querySelector('.tag')!.textContent).toContain('Ad')
    expect(root.querySelector('.tag')!.textContent).toContain('Sponsored')
    expect(root.querySelector('h3')!.textContent).toBe(AD.headline)
    const links = Array.from(root.querySelectorAll('a'))
    expect(links.length).toBeGreaterThan(0)
    for (const a of links) {
      expect(a.getAttribute('href')).toBe(AD.clickTrackUrl) // the server counts the click and 302s to clickUrl
      expect(a.target).toBe('_blank')
      expect(a.rel).toBe('noopener sponsored')
    }
    expect(root.querySelector('img')!.getAttribute('src')).toBe(AD.imageUrl)
    // the browser side never saw the key
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(SITE_KEY)
    expect(el.outerHTML).not.toContain(SITE_KEY)
  })

  it('sanitises: no HTML injection, no javascript: or http: URLs', async () => {
    const evil: AdCreative = {
      ...AD,
      headline: '<img src=x onerror=alert(1)>Hi',
      body: '<script>alert(1)</script>',
      clickTrackUrl: 'javascript:alert(1)',
      clickUrl: 'http://insecure.example/',
      imageUrl: 'http://insecure.example/x.png',
    }
    serveBody = { ads: [evil], reason: null }
    const { el } = await mount()
    const root = el.shadowRoot!
    expect(root.querySelector('script')).toBeNull()
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('a')).toBeNull()
    expect(root.querySelector('h3')!.textContent).toBe('<img src=x onerror=alert(1)>Hi')
    expect(root.querySelector('h3')!.children.length).toBe(0)
    expect(root.querySelector('p')!.textContent).toBe('<script>alert(1)</script>')
  })

  it('impression: 50% visible for minVisibleMs, once per serve, with visibleMs', async () => {
    const { el, events } = await mount()
    show(el, 0.3)
    vi.advanceTimersByTime(2000)
    expect(eventPosts()).toEqual([]) // below 50%
    show(el, 0.6)
    vi.advanceTimersByTime(600)
    show(el, 0) // scrolled away before 1 s
    vi.advanceTimersByTime(2000)
    expect(eventPosts()).toEqual([])
    show(el, 1)
    vi.advanceTimersByTime(1000)
    await flush()
    expect(eventPosts()).toEqual([{ serve: AD.serve, kind: 'impression', visibleMs: 1000 }])
    expect(events.filter((e) => e === 'gully-ad:impression')).toHaveLength(1)
    // more visibility changes never send a second impression
    show(el, 0)
    show(el, 1)
    vi.advanceTimersByTime(5000)
    await flush()
    expect(eventPosts()).toHaveLength(1)
    const init = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/v1/ads/events'))![1] as RequestInit
    expect(init.keepalive).toBe(true)
  })

  it('video creatives wait for the 2 s minVisibleMs the server sends', async () => {
    serveBody = { ads: [{ ...AD, type: 'video', beacons: { ...AD.beacons, minVisibleMs: 2000 } }], reason: null }
    const { el } = await mount()
    show(el, 1)
    vi.advanceTimersByTime(1500)
    expect(eventPosts()).toEqual([])
    vi.advanceTimersByTime(500)
    await flush()
    expect(eventPosts()[0]).toMatchObject({ kind: 'impression', visibleMs: 2000 })
  })

  it('click: emits gully-ad:click; the link itself is the server click redirect', async () => {
    const { el, events } = await mount()
    const a = el.shadowRoot!.querySelector('a.cta') as HTMLAnchorElement
    a.addEventListener('click', (e) => e.preventDefault()) // jsdom: do not navigate
    a.click()
    expect(events).toContain('gully-ad:click')
    expect(a.href).toBe(AD.clickTrackUrl)
  })

  it('collapses on 404 (Gully Ads off), on an empty answer and on error', async () => {
    serveStatus = 404
    let m = await mount()
    expect(m.events).toEqual(['gully-ad:empty'])
    expect(m.el.hasAttribute('hidden')).toBe(true)
    expect(m.el.getAttribute('data-state')).toBe('empty')
    expect(m.el.shadowRoot!.childNodes.length).toBe(0)

    serveStatus = 200
    serveBody = { ads: [], reason: 'ads_disabled' }
    m = await mount()
    expect(m.el.getAttribute('data-state')).toBe('empty')

    serveBody = { ads: [], reason: 'no_fill' }
    m = await mount()
    expect(m.el.getAttribute('data-state')).toBe('empty')

    serveStatus = 500
    m = await mount()
    expect(m.events).toEqual(['gully-ad:error', 'gully-ad:empty'])
    expect(eventPosts()).toEqual([])
  })

  it('Hide posts to beacons.hide and collapses', async () => {
    const { el } = await mount()
    const hide = Array.from(el.shadowRoot!.querySelectorAll('button')).find((b) => b.textContent === 'Hide')!
    hide.click()
    await flush()
    expect(fetchMock.mock.calls.some((c) => String(c[0]) === AD.beacons.hide)).toBe(true)
    expect(el.getAttribute('data-state')).toBe('empty')
  })

  it('does nothing without a slot attribute', async () => {
    const { el, events } = await mount({ site: 'pk_x' })
    expect(events).toEqual(['gully-ad:empty'])
    expect(el.hasAttribute('hidden')).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
