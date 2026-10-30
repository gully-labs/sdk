// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { BACK_BUTTON_TAG, COIN_CARD_TAG, defineKre8Embeds, Kre8BackButtonElement, Kre8CoinCardElement, Kre8PlayerElement, PLAYER_TAG } from '../src/elements'
import { createEmbedFrame, IFRAME_SANDBOX, openKre8 } from '../src/frame'

const COIN = '0x' + 'cd'.repeat(20)
const tick = () => new Promise((r) => setTimeout(r, 0))

/** a message event as the browser would deliver it from the iframe */
function deliver(iframe: HTMLIFrameElement, origin: string, data: unknown) {
  const ev = new MessageEvent('message', { data, origin, source: iframe.contentWindow ?? undefined })
  window.dispatchEvent(ev)
}
const nonceOf = (src: string) => new URL(src).searchParams.get('nonce')!
const body = (nonce: string, extra: Record<string, unknown>) => ({ kre8: 1, v: 1, nonce, ...extra })

beforeAll(() => defineKre8Embeds())
afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('defineKre8Embeds', () => {
  it('registers the three tags once', () => {
    expect(customElements.get(COIN_CARD_TAG)).toBe(Kre8CoinCardElement)
    expect(customElements.get(PLAYER_TAG)).toBe(Kre8PlayerElement)
    expect(customElements.get(BACK_BUTTON_TAG)).toBe(Kre8BackButtonElement)
    expect(() => defineKre8Embeds()).not.toThrow()
  })
})

describe('<kre8-coin-card>', () => {
  it('mounts a sandboxed, lazy iframe from kre8.fun with the host origin and a nonce, behind a kit placeholder', async () => {
    const el = document.createElement(COIN_CARD_TAG)
    el.setAttribute('coin', COIN)
    document.body.append(el)
    await tick()
    const root = el.shadowRoot!
    const iframe = root.querySelector('iframe')!
    expect(iframe).toBeTruthy()
    const src = new URL(iframe.src)
    expect(src.origin).toBe('https://kre8.fun')
    expect(src.pathname).toBe(`/embed/coin/${COIN}`)
    expect(src.searchParams.get('origin')).toBe(window.location.origin)
    expect(src.searchParams.get('nonce')).toMatch(/^[A-Za-z0-9_-]{16}$/)
    expect(iframe.getAttribute('sandbox')).toBe(IFRAME_SANDBOX)
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-top-navigation')
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-forms')
    expect(iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
    expect(iframe.getAttribute('loading')).toBe('lazy')
    expect(iframe.getAttribute('allow')).toBe('')
    expect(iframe.title).toBe('Coin on kre8')
    // the placeholder uses the kit icon served from kre8.fun, never a redrawn logo
    const ph = root.querySelector('.ph')!
    expect(ph.querySelector('img')!.src).toBe('https://kre8.fun/embed/brand/kre8-icon-128.png')
    expect(ph.textContent).toContain('Loading from kre8')
    expect(root.querySelector('style')!.textContent).toContain('--k8-yellow:#FFE81A')
  })

  it('handles ready / resize / open / error from the exact origin and nonce only', async () => {
    const el = document.createElement(COIN_CARD_TAG) as Kre8CoinCardElement
    el.setAttribute('coin', COIN)
    const seen: string[] = []
    for (const n of ['kre8-ready', 'kre8-resize', 'kre8-open', 'kre8-error']) el.addEventListener(n, (e) => seen.push(`${n}:${JSON.stringify((e as CustomEvent).detail)}`))
    document.body.append(el)
    await tick()
    const iframe = el.shadowRoot!.querySelector('iframe')!
    const nonce = nonceOf(iframe.src)
    // foreign origin, right nonce: ignored
    deliver(iframe, 'https://evil.example', body(nonce, { type: 'resize', height: 999 }))
    // right origin, wrong nonce: ignored
    deliver(iframe, 'https://kre8.fun', body('wrong_nonce_abcd', { type: 'resize', height: 998 }))
    // right origin, right nonce, bad schema: ignored
    deliver(iframe, 'https://kre8.fun', body(nonce, { type: 'resize', height: 'tall' }))
    expect(seen).toEqual([])
    expect(iframe.style.height).toBe('236px')
    // the real thing
    deliver(iframe, 'https://kre8.fun', body(nonce, { type: 'ready', kind: 'coin', id: COIN, height: 240 }))
    deliver(iframe, 'https://kre8.fun', body(nonce, { type: 'resize', height: 260 }))
    expect(iframe.style.height).toBe('260px')
    expect(iframe.getAttribute('height')).toBe('260')
    expect(el.shadowRoot!.querySelector('.ph')!.classList.contains('off')).toBe(true)
    // open: only kre8 hrefs come through
    deliver(iframe, 'https://kre8.fun', body(nonce, { type: 'open', href: 'https://evil.example/' }))
    deliver(iframe, 'https://kre8.fun', body(nonce, { type: 'open', href: `https://kre8.fun/token/${COIN}` }))
    deliver(iframe, 'https://kre8.fun', body(nonce, { type: 'error', message: 'This coin is not on kre8.' }))
    expect(seen).toEqual([
      `kre8-ready:{"type":"ready","kind":"coin","id":"${COIN}","height":240}`,
      'kre8-resize:{"type":"resize","height":260}',
      `kre8-open:{"type":"open","href":"https://kre8.fun/token/${COIN}"}`,
      'kre8-error:{"type":"error","message":"This coin is not on kre8."}',
    ])
    expect(el.shadowRoot!.querySelector('.ph')!.textContent).toContain('This coin is not on kre8.')
    // after removal the listener is gone
    el.remove()
    deliver(iframe, 'https://kre8.fun', body(nonce, { type: 'resize', height: 300 }))
    expect(iframe.style.height).toBe('260px')
  })

  it('refuses a foreign origin attribute and a bad coin, and honours dev-origin', async () => {
    const bad = document.createElement(COIN_CARD_TAG) as Kre8CoinCardElement
    bad.setAttribute('coin', COIN)
    bad.setAttribute('origin', 'https://evil.example')
    const errors: string[] = []
    bad.addEventListener('kre8-error', (e) => errors.push((e as CustomEvent).detail.message))
    document.body.append(bad)
    await tick()
    expect(bad.shadowRoot!.querySelector('iframe')).toBeNull()
    expect(errors[0]).toMatch(/origin must be one of/)

    const nocoin = document.createElement(COIN_CARD_TAG) as Kre8CoinCardElement
    nocoin.setAttribute('coin', 'frog')
    document.body.append(nocoin)
    await tick()
    expect(nocoin.shadowRoot!.querySelector('iframe')).toBeNull()
    expect(nocoin.shadowRoot!.querySelector('.ph.err')!.textContent).toContain('0x address')

    const dev = document.createElement(COIN_CARD_TAG) as Kre8CoinCardElement
    dev.setAttribute('coin', COIN)
    dev.setAttribute('dev-origin', 'http://localhost:4361')
    document.body.append(dev)
    await tick()
    expect(dev.src!.startsWith(`http://localhost:4361/embed/coin/${COIN}?`)).toBe(true)
    expect(dev.shadowRoot!.querySelector('.ph img')!.getAttribute('src')).toBe('http://localhost:4361/embed/brand/kre8-icon-128.png')
  })
})

describe('<kre8-player>', () => {
  it('track / video / short / live pick the right page and size; drop is a reserved, unavailable attribute', async () => {
    const t = document.createElement(PLAYER_TAG) as Kre8PlayerElement
    t.setAttribute('track', 'trk_12345678')
    document.body.append(t)
    await tick()
    const ti = t.shadowRoot!.querySelector('iframe')!
    expect(new URL(ti.src).pathname).toBe('/embed/track/trk_12345678')
    expect(ti.style.height).toBe('152px')
    expect(ti.getAttribute('allow')).toContain('autoplay')
    expect(ti.hasAttribute('allowfullscreen')).toBe(true)

    const s = document.createElement(PLAYER_TAG) as Kre8PlayerElement
    s.setAttribute('short', 'sh1')
    document.body.append(s)
    await tick()
    const si = s.shadowRoot!.querySelector('iframe')!
    expect(new URL(si.src).pathname).toBe('/embed/short/sh1')
    expect(si.style.height).toBe('640px')
    expect(si.title).toBe('Short on kre8')

    const d = document.createElement(PLAYER_TAG) as Kre8PlayerElement
    d.setAttribute('drop', 'drop1')
    document.body.append(d)
    await tick()
    expect(d.shadowRoot!.querySelector('iframe')).toBeNull()
    expect(d.shadowRoot!.querySelector('.ph.err')!.textContent).toContain('Drops are not on kre8 yet')

    const two = document.createElement(PLAYER_TAG) as Kre8PlayerElement
    two.setAttribute('track', 'trk_12345678')
    two.setAttribute('video', 'v1')
    document.body.append(two)
    await tick()
    expect(two.shadowRoot!.querySelector('.ph.err')!.textContent).toContain('only one')
  })

  it('remounts when the item attribute changes', async () => {
    const p = document.createElement(PLAYER_TAG) as Kre8PlayerElement
    p.setAttribute('video', 'vid1')
    document.body.append(p)
    await tick()
    const first = p.src!
    p.setAttribute('video', 'vid2')
    await tick()
    expect(p.src).not.toBe(first)
    expect(new URL(p.src!).pathname).toBe('/embed/video/vid2')
    expect(p.shadowRoot!.querySelectorAll('iframe').length).toBe(1)
  })
})

describe('<kre8-back-button>', () => {
  it('opens the creator page on kre8 in a new tab with noopener,noreferrer and emits kre8-back', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const b = document.createElement(BACK_BUTTON_TAG) as Kre8BackButtonElement
    b.setAttribute('creator', 'alice.gully')
    const backs: unknown[] = []
    b.addEventListener('kre8-back', (e) => backs.push((e as CustomEvent).detail))
    document.body.append(b)
    await tick()
    const button = b.shadowRoot!.querySelector('button')!
    expect(button.textContent).toContain('Back this')
    expect(button.querySelector('img')!.src).toBe('https://kre8.fun/embed/brand/kre8-icon-128.png')
    expect(button.disabled).toBe(false)
    expect(b.href).toBe('https://kre8.fun/@alice?utm_source=embed&utm_medium=embed&utm_campaign=kre8-embed&utm_content=back')
    button.click()
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith(b.href, '_blank', 'noopener,noreferrer')
    expect(backs).toEqual([{ creator: 'alice.gully', href: b.href }])
    // no iframe, no fetch, no wallet: the button lives on the host page
    expect(b.shadowRoot!.querySelector('iframe')).toBeNull()
  })
  it('wallet creators open /address/<0x>; a bad creator or foreign origin disables the button', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const b = document.createElement(BACK_BUTTON_TAG) as Kre8BackButtonElement
    b.setAttribute('creator', COIN.toUpperCase().replace('0X', '0x'))
    b.setAttribute('label', 'Support Alice')
    document.body.append(b)
    await tick()
    expect(b.href).toContain(`/address/${COIN}?`)
    expect(b.shadowRoot!.querySelector('button')!.textContent).toContain('Support Alice')
    b.setAttribute('creator', 'not valid!')
    await tick()
    expect(b.href).toBeNull()
    expect(b.shadowRoot!.querySelector('button')!.disabled).toBe(true)
    expect(b.activate()).toBe(false)
    b.setAttribute('creator', 'alice')
    b.setAttribute('origin', 'https://evil.example')
    await tick()
    expect(b.href).toBeNull()
    expect(b.activate()).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})

describe('createEmbedFrame / openKre8', () => {
  it('a window handed back despite noopener gets its opener cut; foreign URLs never open', () => {
    const fake = { opener: {} } as unknown as Window
    const open = vi.spyOn(window, 'open').mockReturnValue(fake)
    expect(openKre8('https://kre8.fun/@alice', 'https://kre8.fun')).toBe(true)
    expect((fake as unknown as { opener: unknown }).opener).toBeNull()
    expect(openKre8('https://evil.example/', 'https://kre8.fun')).toBe(false)
    expect(open).toHaveBeenCalledTimes(1)
  })
  it('the frame handle accepts a hand-fed event and destroy() removes the iframe', () => {
    const got: unknown[] = []
    const h = createEmbedFrame({ kind: 'track', id: 'trk_12345678', embedOrigin: 'https://kre8.fun', parentOrigin: 'https://blog.example', onMessage: (m) => got.push(m) })
    document.body.append(h.iframe)
    expect(h.src).toBe(`https://kre8.fun/embed/track/trk_12345678?origin=https%3A%2F%2Fblog.example&nonce=${h.nonce}`)
    expect(h.handle({ origin: 'https://kre8.fun', data: body(h.nonce, { type: 'resize', height: 180 }), source: h.iframe.contentWindow })).toEqual({ type: 'resize', height: 180 })
    expect(h.handle({ origin: 'https://kre8.fun', data: body(h.nonce, { type: 'resize', height: 180 }), source: window })).toBeNull()
    expect(h.iframe.style.height).toBe('180px')
    h.destroy()
    expect(document.body.querySelector('iframe')).toBeNull()
    expect(got.length).toBe(1)
  })
})
