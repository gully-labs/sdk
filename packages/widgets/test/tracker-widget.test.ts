// Offline: fetch is a stub, so nothing leaves the machine.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createTrackerClient, GullyApiError, isTrusted, type TrackerRow } from '../src/tracker'
import { widgetAttributes, DEFAULT_SCRIPT } from '../src/widget'
import * as root from '../src/index'

const row = (ticker: string, gapPct: number | null, status: TrackerRow['status'] = 'premium') =>
  ({ chain: 'robinhood', ticker, name: ticker, status, gapPct, onchain: gapPct === null ? null : 1, fair: 1 }) as unknown as TrackerRow

test('tracker: widestGaps keeps trusted rows, largest absolute gap first, and reads the rate limit', async () => {
  let url = ''
  const c = createTrackerClient({
    fetch: (async (u: string) => {
      url = u
      return new Response(JSON.stringify({ rows: [row('A', 1), row('B', -3), row('C', null, 'thin'), row('D', 2)] }), { headers: { 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '58' } })
    }) as unknown as typeof fetch,
  })
  const r = await c.widestGaps(2)
  assert.equal(url, 'https://gullylabs.xyz/api/tracker')
  assert.deepEqual(r.map((x) => x.ticker), ['B', 'D'])
  assert.ok(r.every(isTrusted))
  assert.deepEqual(c.rateLimit, { limit: 60, remaining: 58, resetSeconds: null })
})

test('tracker: an error status is a GullyApiError with the server message and Retry-After', async () => {
  const c = createTrackerClient({ apiKey: 'gl_test', fetch: (async () => new Response(JSON.stringify({ error: 'slow down' }), { status: 429, headers: { 'retry-after': '7' } })) as unknown as typeof fetch })
  await assert.rejects(c.getTracker(), (e: any) => e instanceof GullyApiError && e.status === 429 && e.retryAfter === 7 && e.message === 'slow down')
})

test('widget: data attributes for templating', () => {
  assert.deepEqual(widgetAttributes({ type: 'badge', ticker: 'nvda', chain: 'robinhood', theme: 'light', limit: 3 }), {
    'data-gully-widget': 'badge', 'data-ticker': 'NVDA', 'data-chain': 'robinhood', 'data-theme': 'light', 'data-limit': '3',
  })
  assert.equal(DEFAULT_SCRIPT, 'https://gullylabs.xyz/widget.js')
})

test('root entry re-exports the three clients', () => {
  assert.equal(typeof root.createTrackerClient, 'function')
  assert.equal(typeof root.createHoldersClient, 'function')
  assert.equal(typeof root.mountWidget, 'function')
})
