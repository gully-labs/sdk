import { describe, expect, it, vi } from 'vitest'
import { GullySecurity, GullySecurityError, GULLY_CHAIN_ID, isGullySecurityError, resolveChain, SECURITY_CHAINS } from '../src/index'

type Route = (url: URL, init: RequestInit) => { status?: number; body?: unknown; headers?: Record<string, string>; text?: string }

function stubFetch(route: Route) {
  const calls: { url: URL; init: RequestInit }[] = []
  const fetch = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input)
    calls.push({ url, init })
    const r = route(url, init)
    const text = r.text ?? (r.body === undefined ? '' : JSON.stringify(r.body))
    return new Response(text, { status: r.status ?? 200, headers: { 'content-type': 'application/json', ...(r.headers ?? {}) } })
  })
  return { fetch, calls }
}

const ADDR = '0x1234567890AbCdEf1234567890aBcDeF12345678'

describe('chains', () => {
  it('supports Gully Chain by key and id', () => {
    expect(resolveChain('gully')?.chainId).toBe(GULLY_CHAIN_ID)
    expect(resolveChain(485590)?.key).toBe('gully')
    expect(resolveChain('485590')?.name).toBe('Gully Chain Testnet')
    expect(resolveChain('solana')).toBeNull()
    expect(SECURITY_CHAINS.map((c) => c.key)).toContain('base')
  })
})

describe('public reads', () => {
  it('lists and filters published reports', async () => {
    const reports = [
      { id: 'sec_a', input: { kind: 'address', chain: 'gully', address: ADDR.toLowerCase() }, publishedAt: '2026-10-29T00:00:00Z', url: '/reports/sec_a', counts: { critical: 0, high: 1, medium: 0, low: 0, info: 2 } },
      { id: 'sec_b', input: { kind: 'github', repo: 'o/r', commit: null, ref: 'HEAD' }, publishedAt: '2026-10-28T00:00:00Z', url: '/reports/sec_b' },
    ]
    const { fetch, calls } = stubFetch(() => ({ body: { reports } }))
    const c = new GullySecurity({ fetch })
    expect(await c.listReports()).toHaveLength(2)
    const mine = await c.findReports(485590, ADDR)
    expect(mine.map((r) => r.id)).toEqual(['sec_a'])
    expect(calls[0].url.href).toBe('https://gullysecurity.xyz/api/security/reports')
    expect((calls[0].init.headers as Record<string, string>).accept).toBe('application/json')
    expect(calls[0].init.method).toBe('GET')
  })

  it('reads one report and builds its URLs', async () => {
    const { fetch, calls } = stubFetch(() => ({ body: { report: { id: 'sec_x', title: 't', findings: [] } } }))
    const c = new GullySecurity({ fetch, baseUrl: 'https://example.test/' })
    const r = await c.getReport('sec_x')
    expect(r.id).toBe('sec_x')
    expect(calls[0].url.pathname).toBe('/api/security/reports/sec_x')
    expect(c.reportUrl('sec_x')).toBe('https://example.test/reports/sec_x')
    expect(c.reportHtmlUrl('sec_x')).toBe('https://example.test/api/security/reports/sec_x/report.html')
    expect(c.reportBadgeUrl('sec_x', { size: 'L', theme: 'light' })).toBe('https://example.test/api/security/reports/sec_x/badge.svg?size=L&theme=light')
  })

  it('throws not-found for an unpublished report', async () => {
    const { fetch } = stubFetch(() => ({ status: 404, body: { error: 'No published report has that address. The owner may have taken it down.' } }))
    const c = new GullySecurity({ fetch })
    const e = await c.getReport('sec_nope').catch((x) => x)
    expect(isGullySecurityError(e)).toBe(true)
    expect(e.code).toBe('not-found')
    expect(e.status).toBe(404)
    expect(e.message).toMatch(/No published report/)
  })

  it('reads stats, live, engine, offer and sample from their paths', async () => {
    const seen: string[] = []
    const { fetch } = stubFetch((u) => {
      seen.push(u.pathname)
      if (u.pathname === '/api/security/sample') return { body: { report: { id: 'scn_SAMPLE', sample: true } } }
      return { body: { generatedAt: 'x', totals: {}, state: 'online', offer: {}, scans: [] } }
    })
    const c = new GullySecurity({ fetch })
    await c.stats()
    await c.live()
    await c.engine()
    await c.offer()
    expect((await c.sample()).sample).toBe(true)
    expect(seen).toEqual(['/api/security/stats', '/api/security/live', '/api/security/engine', '/api/security/offer', '/api/security/sample'])
  })
})

describe('Gully Score', () => {
  it('reads a score on Gully Chain, lower-casing the address', async () => {
    const { fetch, calls } = stubFetch(() => ({ body: { chainId: 485590, chainKey: 'gully', address: ADDR.toLowerCase(), score: 72, grade: 'Fair', stale: false } }))
    const c = new GullySecurity({ fetch })
    const s = await c.score('gully', ADDR)
    expect(s.score).toBe(72)
    expect(calls[0].url.pathname).toBe(`/api/score/gully/${ADDR.toLowerCase()}`)
    expect(c.scoreUrl(485590, ADDR)).toBe(`https://gullysecurity.xyz/score/gully/${ADDR.toLowerCase()}`)
    expect(c.scoreBadgeUrl('gully', ADDR, { theme: 'dark' })).toBe(`https://gullysecurity.xyz/score/gully/${ADDR.toLowerCase()}/badge.svg?theme=dark`)
  })

  it('reads the index and methodology', async () => {
    const { fetch, calls } = stubFetch((u) => ({ body: u.pathname.endsWith('methodology') ? { version: 1, components: [] } : { scores: [], chains: [], methodology: {} } }))
    const c = new GullySecurity({ fetch })
    expect((await c.scoreIndex()).scores).toEqual([])
    expect((await c.scoreMethodology()).version).toBe(1)
    expect(calls.map((x) => x.url.pathname)).toEqual(['/api/score', '/api/score/methodology'])
  })

  it('rejects a bad chain or address before any request', async () => {
    const { fetch } = stubFetch(() => ({ body: {} }))
    const c = new GullySecurity({ fetch })
    await expect(c.score('solana', ADDR)).rejects.toMatchObject({ code: 'invalid-input' })
    await expect(c.score('base', '0xnope')).rejects.toMatchObject({ code: 'invalid-input' })
    await expect(c.score('base', '0x' + '0'.repeat(40))).rejects.toMatchObject({ code: 'invalid-input' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps 429 to rate-limited with Retry-After', async () => {
    const { fetch } = stubFetch(() => ({ status: 429, body: { error: 'Too many scores are being worked out right now. Try again in a minute.' }, headers: { 'retry-after': '60' } }))
    const e = await new GullySecurity({ fetch }).score('base', ADDR).catch((x) => x)
    expect(e.code).toBe('rate-limited')
    expect(e.retryAfterSec).toBe(60)
  })
})

describe('scans', () => {
  it('starts an address scan on Gully Chain with the same-origin header and keeps the visitor cookie', async () => {
    const { fetch, calls } = stubFetch(() => ({ status: 201, body: { scan: { id: 'sec_1', status: 'queued', input: { kind: 'address', chain: 'gully', address: ADDR.toLowerCase() } } }, headers: { 'set-cookie': 'gs_v=abc123; Path=/; HttpOnly' } }))
    const c = new GullySecurity({ fetch })
    const r = await c.startScan({ kind: 'address', chain: 485590, address: ADDR }, { expectPriceUsd: 0 })
    expect(r.scan.id).toBe('sec_1')
    expect(r.duplicate).toBe(false)
    expect(r.setCookie).toMatch(/^gs_v=abc123/)
    const h = calls[0].init.headers as Record<string, string>
    expect(h['x-requested-with']).toBe('gully')
    expect(h['content-type']).toBe('application/json')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ input: { kind: 'address', chain: 'gully', address: ADDR.toLowerCase() }, expect: { priceUsd: 0 } })
    expect(c.cookie).toBe('gs_v=abc123')
    await c.getScan('sec_1')
    expect((calls[1].init.headers as Record<string, string>).cookie).toBe('gs_v=abc123')
    expect(calls[1].init.method).toBe('GET')
  })

  it('reports a duplicate (200) start', async () => {
    const { fetch } = stubFetch(() => ({ status: 200, body: { scan: { id: 'sec_1', status: 'analysing', duplicate: true } } }))
    const r = await new GullySecurity({ fetch }).startScan({ kind: 'github', repo: 'gully-labs/sdk' })
    expect(r.duplicate).toBe(true)
  })

  it('surfaces checkout-off (402) with the quota', async () => {
    const quota = { freePerDay: 2, used: 2, left: 0, resetsAt: '2026-10-31T00:00:00.000Z', nextPriceUsd: 99, active: 0, maxActive: 1 }
    const { fetch } = stubFetch(() => ({ status: 402, body: { error: 'Your 2 free scans for today are used.', code: 'checkout-off', quota, checkout: { enabled: false, url: null } } }))
    const e = await new GullySecurity({ fetch }).startScan({ kind: 'address', chain: 'base', address: ADDR }).catch((x) => x)
    expect(e).toBeInstanceOf(GullySecurityError)
    expect(e.code).toBe('checkout-off')
    expect(e.status).toBe(402)
    expect(e.quota).toEqual(quota)
  })

  it('surfaces price-changed, too-many-active and engine-unavailable codes', async () => {
    for (const [status, code] of [[409, 'price-changed'], [429, 'too-many-active'], [503, 'engine-unavailable']] as const) {
      const { fetch } = stubFetch(() => ({ status, body: { error: 'x', code } }))
      const e = await new GullySecurity({ fetch }).startScan({ kind: 'address', chain: 'base', address: ADDR }).catch((x) => x)
      expect(e.code).toBe(code)
      expect(e.status).toBe(status)
    }
  })

  it('refuses an upload without data before sending', async () => {
    const { fetch } = stubFetch(() => ({ body: {} }))
    // @ts-expect-error missing upload bytes on purpose
    await expect(new GullySecurity({ fetch }).startScan({ kind: 'upload' })).rejects.toMatchObject({ code: 'invalid-input' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('waits for a scan to finish', async () => {
    let n = 0
    const { fetch } = stubFetch(() => ({ body: { scan: { id: 'sec_1', status: ++n < 3 ? 'analysing' : 'done', progress: { pct: n * 30, message: '' }, report: n >= 3 ? { id: 'scn_1' } : null } } }))
    const seen: string[] = []
    const scan = await new GullySecurity({ fetch, cookie: 'gs_v=abc' }).waitForScan('sec_1', { intervalMs: 500, onUpdate: (s) => seen.push(s.status) })
    expect(scan.status).toBe('done')
    expect(scan.report).toEqual({ id: 'scn_1' })
    expect(seen).toEqual(['analysing', 'analysing', 'done'])
  })

  it('gives up waiting after maxWaitMs', async () => {
    const { fetch } = stubFetch(() => ({ body: { scan: { id: 'sec_1', status: 'queued' } } }))
    await expect(new GullySecurity({ fetch }).waitForScan('sec_1', { intervalMs: 500, maxWaitMs: 100 })).rejects.toMatchObject({ code: 'timeout' })
  })

  it('cancels and publishes', async () => {
    const { fetch, calls } = stubFetch(() => ({ body: { scan: { id: 'sec_1', status: 'done', published: true, publicUrl: '/reports/sec_1' } } }))
    const c = new GullySecurity({ fetch })
    await c.cancelScan('sec_1')
    const s = await c.publishScan('sec_1', true, { indexable: true })
    expect(s.publicUrl).toBe('/reports/sec_1')
    expect(calls[0].url.pathname).toBe('/api/security/scans/sec_1/cancel')
    expect(calls[1].url.pathname).toBe('/api/security/scans/sec_1/publish')
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ published: true, indexable: true })
  })

  it('reads a scan report as HTML', async () => {
    const { fetch } = stubFetch(() => ({ text: '<!doctype html><h1>Report</h1>', headers: { 'content-type': 'text/html' } }))
    expect(await new GullySecurity({ fetch }).getScanHtml('sec_1')).toMatch(/<h1>Report<\/h1>/)
  })

  it('lists scans with the quota and requests a review', async () => {
    const { fetch, calls } = stubFetch((u) => (u.pathname.endsWith('review-requests') ? { status: 201, body: { request: { id: 'rr_1', tier: 'review', status: 'new' } } } : { body: { scans: [], quota: { left: 2 } } }))
    const c = new GullySecurity({ fetch })
    expect((await c.listScans()).quota.left).toBe(2)
    const r = await c.requestReview({ tier: 'review', name: 'Ada', email: 'ada@example.com', project: 'Vault', scope: 'Review the vault and its strategies please.' })
    expect(r.id).toBe('rr_1')
    expect((calls[1].init.headers as Record<string, string>)['x-requested-with']).toBe('gully')
  })
})

describe('transport errors', () => {
  it('wraps a network failure', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    const e = await new GullySecurity({ fetch }).stats().catch((x) => x)
    expect(e.code).toBe('network')
    expect(e.status).toBeNull()
  })

  it('reports a non-JSON body', async () => {
    const { fetch } = stubFetch(() => ({ text: '<html>cloudflare</html>', status: 502 }))
    const e = await new GullySecurity({ fetch }).stats().catch((x) => x)
    expect(e.code).toBe('bad-response')
    expect(e.status).toBe(502)
  })

  it('honours an AbortSignal', async () => {
    const fetch = vi.fn((_: string, init: RequestInit = {}) => new Promise<Response>((_r, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))))
    const ctl = new AbortController()
    const p = new GullySecurity({ fetch }).stats({ signal: ctl.signal })
    ctl.abort()
    await expect(p).rejects.toMatchObject({ code: 'aborted' })
  })

  it('times out', async () => {
    const fetch = vi.fn((_: string, init: RequestInit = {}) => new Promise<Response>((_r, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('t'), { name: 'AbortError' })))))
    await expect(new GullySecurity({ fetch, timeoutMs: 20 }).stats()).rejects.toMatchObject({ code: 'timeout' })
  })

  it('needs a fetch', () => {
    const saved = globalThis.fetch
    // @ts-expect-error removing fetch on purpose
    globalThis.fetch = undefined
    try {
      expect(() => new GullySecurity()).toThrow(GullySecurityError)
    } finally {
      globalThis.fetch = saved
    }
  })
})
