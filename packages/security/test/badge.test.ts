// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { BADGE_FILES, BADGE_TAG, defineSecurityBadge, GullySecurityBadgeElement } from '../src/index'

const ADDR = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const tick = () => new Promise((r) => setTimeout(r, 0))
async function settle(el: HTMLElement) {
  for (let i = 0; i < 20; i++) await tick()
  return el.shadowRoot!
}

type Reply = { status?: number; body: unknown }
function stub(by: (path: string) => Reply) {
  return vi.fn(async (input: string) => {
    const r = by(new URL(input).pathname)
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
}

const nothing = stub((p) => (p === '/api/security/reports' ? { body: { reports: [] } } : { status: 404, body: { error: 'There is no contract at this address on Base.' } }))

beforeAll(() => {
  defineSecurityBadge({ fetch: nothing })
})

function mount(attrs: Record<string, string>) {
  const el = document.createElement(BADGE_TAG)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  document.body.appendChild(el)
  return el
}

describe('<gully-security-badge>', () => {
  it('is defined once and is the exported class', () => {
    expect(customElements.get(BADGE_TAG)).toBe(GullySecurityBadgeElement)
    expect(() => defineSecurityBadge()).not.toThrow()
  })

  it('renders the official badge file by URL in shadow DOM, with an accessible link', async () => {
    const el = mount({ chain: 'gully', address: ADDR, 'data': 'none' })
    const root = await settle(el)
    const a = root.querySelector('a')!
    const img = root.querySelector('img')!
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    expect(a.getAttribute('aria-label')).toMatch(/^Secured by GullySecurity for 0xabcd\.\.\.abcd on Gully Chain Testnet/)
    expect(img.getAttribute('src')).toBe(`https://gullysecurity.xyz/brand/badges/${BADGE_FILES.dark}`)
    expect(img.getAttribute('alt')).toBe('Secured by GullySecurity')
    expect(img.getAttribute('width')).toBe('214')
    expect(img.getAttribute('height')).toBe('60')
    expect(root.querySelector('svg')).toBeNull()
    // no data read: links to the score page
    expect(a.getAttribute('href')).toBe(`https://gullysecurity.xyz/score/gully/${ADDR}`)
  })

  it('uses the light file, an allowed size and a custom asset base', async () => {
    const el = mount({ chain: '8453', address: ADDR, theme: 'light', size: '285', 'asset-base': 'https://cdn.example/assets/', data: 'none' })
    const root = await settle(el)
    const img = root.querySelector('img')!
    expect(img.getAttribute('src')).toBe(`https://cdn.example/assets/${BADGE_FILES.light}`)
    expect(img.getAttribute('width')).toBe('285')
    expect(img.getAttribute('height')).toBe('80')
  })

  it('falls back to the default size for an off-kit width', async () => {
    const root = await settle(mount({ chain: 'base', address: ADDR, size: '300', data: 'none' }))
    expect(root.querySelector('img')!.getAttribute('width')).toBe('214')
  })

  it('shows the Gully Score and links to the published report when both exist', async () => {
    defineSecurityBadge({
      fetch: stub((p) =>
        p === '/api/security/reports'
          ? { body: { reports: [{ id: 'sec_pub', input: { kind: 'address', chain: 'gully', address: ADDR }, publishedAt: '2026-10-29T12:00:00Z', url: '/reports/sec_pub', counts: { critical: 0, high: 0, medium: 1, low: 0, info: 0 } }] } }
          : { body: { chainId: 485590, chainKey: 'gully', address: ADDR, score: 84, grade: 'Strong', stale: false } },
      ),
    })
    const el = mount({ chain: 'gully', address: ADDR })
    const loaded = new Promise<CustomEvent>((r) => el.addEventListener(`${BADGE_TAG}:load`, (e) => r(e as CustomEvent), { once: true }))
    const root = await settle(el)
    const ev = await loaded
    expect(ev.detail.score.score).toBe(84)
    const a = root.querySelector('a')!
    expect(a.getAttribute('href')).toBe('https://gullysecurity.xyz/reports/sec_pub')
    expect(a.getAttribute('aria-label')).toMatch(/Gully Score 84 out of 100, Strong, report published 29 Oct 2026/)
    const cap = root.querySelector('.cap')!.textContent!
    expect(cap).toMatch(/Gully Score 84 Strong/)
    expect(cap).toMatch(/Report published 29 Oct 2026 \(0 critical\/high\)/)
    expect(root.querySelector('.cap .good')).not.toBeNull()
    defineSecurityBadge({ fetch: nothing })
  })

  it('degrades gracefully when nothing is published or scored', async () => {
    const el = mount({ chain: 'base', address: ADDR })
    const errored = new Promise<CustomEvent>((r) => el.addEventListener(`${BADGE_TAG}:error`, (e) => r(e as CustomEvent), { once: true }))
    const root = await settle(el)
    await errored
    expect(root.querySelector('.cap')!.textContent).toMatch(/Not scanned yet/)
    expect(root.querySelector('a')!.getAttribute('href')).toBe(`https://gullysecurity.xyz/score/base/${ADDR}`)
    expect(root.querySelector('img')).not.toBeNull()
  })

  it('does not call the API or show a caption without a valid target, and honours href and caption=hide', async () => {
    const fetch = vi.fn()
    defineSecurityBadge({ fetch: fetch as unknown as typeof globalThis.fetch })
    const root = await settle(mount({ chain: 'gully', address: '0xbad' }))
    expect(fetch).not.toHaveBeenCalled()
    expect(root.querySelector('.cap')).toBeNull()
    expect(root.querySelector('a')!.getAttribute('href')).toBe('https://gullysecurity.xyz/')
    const r2 = await settle(mount({ chain: 'gully', address: ADDR, href: 'https://my.site/security', caption: 'hide', data: 'none' }))
    expect(r2.querySelector('a')!.getAttribute('href')).toBe('https://my.site/security')
    expect(r2.querySelector('.cap')).toBeNull()
    defineSecurityBadge({ fetch: nothing })
  })

  it('re-renders when attributes change', async () => {
    const el = mount({ chain: 'gully', address: ADDR, data: 'none' })
    await settle(el)
    el.setAttribute('theme', 'light')
    const root = await settle(el)
    expect(root.querySelector('img')!.getAttribute('src')).toContain('light.svg')
  })
})
