// Runs against the live API (one call per test, well inside the anonymous 60/min).
// Set GULLY_BASE_URL to test another deployment.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTrackerClient, GullyApiError, isTrusted } from '../dist/index.js'

const client = createTrackerClient({ baseUrl: process.env.GULLY_BASE_URL })

test('reads the tracker with every documented field', async () => {
  const t = await client.getTracker()
  assert.ok(Array.isArray(t.rows) && t.rows.length > 0)
  for (const k of ['chain', 'ticker', 'name', 'status', 'logo', 'chainLogo']) assert.ok(k in t.rows[0], k)
  assert.ok(client.rateLimit && client.rateLimit.limit >= 60)
})

test('widestGaps returns trusted rows, largest first', async () => {
  const rows = await client.widestGaps(5)
  assert.ok(rows.every(isTrusted))
  for (let i = 1; i < rows.length; i++) assert.ok(Math.abs(rows[i - 1].gapPct) >= Math.abs(rows[i].gapPct))
})

test('history comes back as dated points, oldest first', async () => {
  const pts = await client.getHistory('robinhood', 'nvda')
  assert.ok(Array.isArray(pts))
  if (pts.length > 1) assert.ok(pts[0].time <= pts[pts.length - 1].time)
  if (pts.length) assert.ok(pts[0].time instanceof Date && typeof pts[0].gapPct === 'number')
})

test('an unknown stock is null, a bad key is a GullyApiError', async () => {
  assert.equal(await client.getStock('robinhood', 'NOTASTOCK'), null)
  const bad = createTrackerClient({ apiKey: 'gl_live_definitely_not_a_key', baseUrl: process.env.GULLY_BASE_URL })
  await assert.rejects(bad.getTracker(), (e) => e instanceof GullyApiError && e.status === 401)
})
