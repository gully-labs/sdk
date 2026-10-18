// Offline: fetch is a stub, so nothing leaves the machine.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHoldersClient, embedUrl, isMapOk, HoldersApiError } from '../dist/index.js'
import { HolderMap } from '../dist/react.js'

const TOKEN = '0x' + 'ab'.repeat(20)
const reply = (status, body, headers = {}) => async (url, init) => {
  reply.last = { url: String(url), init }
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers })
}

test('getMap calls /api/holders/:chain/:token and returns an ok map', async () => {
  const c = createHoldersClient({ fetch: reply(200, { state: 'ok', nodes: [], token: { address: TOKEN } }, { 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '59' }) })
  const m = await c.getMap('base', TOKEN)
  assert.equal(reply.last.url, `https://gullylabs.xyz/api/holders/base/${TOKEN}`)
  assert.equal(reply.last.init.headers.authorization, undefined)
  assert.ok(isMapOk(m))
  assert.deepEqual(c.rateLimit, { limit: 60, remaining: 59, resetSeconds: null })
})

test('an API key is sent as a bearer token to the chosen base URL', async () => {
  const c = createHoldersClient({ apiKey: 'gl_live_x', baseUrl: 'https://example.test/', fetch: reply(200, { state: 'ok' }) })
  await c.getMap('robinhood', 'NVDA')
  assert.equal(reply.last.url, 'https://example.test/api/holders/robinhood/NVDA')
  assert.equal(reply.last.init.headers.authorization, 'Bearer gl_live_x')
})

test('states without a map are returned, not thrown (404 not-found, 200 unavailable, 429 busy)', async () => {
  for (const [status, state] of [[404, 'not-found'], [200, 'unavailable'], [429, 'busy'], [502, 'error']]) {
    const m = await createHoldersClient({ fetch: reply(status, { state, reason: 'why' }) }).getMap('bsc', TOKEN)
    assert.equal(m.state, state)
    assert.equal(isMapOk(m), false)
    assert.equal(m.reason, 'why')
  }
})

test('an error with no map throws HoldersApiError with the status and Retry-After', async () => {
  const c = createHoldersClient({ fetch: reply(429, { error: 'Rate limit exceeded' }, { 'retry-after': '12' }) })
  await assert.rejects(c.getMap('base', TOKEN), (e) => e instanceof HoldersApiError && e.status === 429 && e.retryAfter === 12 && /Rate limit/.test(e.message))
  await assert.rejects(createHoldersClient({ fetch: reply(400, { error: 'Give a token address or a tracked stock ticker.' }) }).getMap('base', TOKEN), (e) => e.status === 400)
  await assert.rejects(createHoldersClient({ fetch: async () => { throw new Error('offline') } }).getMap('base', TOKEN), (e) => e.status === 0 && /offline/.test(e.message))
})

test('getCsv returns text; a 403 is a HoldersApiError', async () => {
  assert.equal(await createHoldersClient({ fetch: reply(200, 'rank,address\n1,0x1\n') }).getCsv('base', TOKEN), 'rank,address\n1,0x1\n')
  assert.equal(reply.last.url, `https://gullylabs.xyz/api/holders/base/${TOKEN}.csv`)
  await assert.rejects(createHoldersClient({ fetch: reply(403, { error: 'Pro plan', locked: 'csv' }) }).getCsv('base', TOKEN), (e) => e.status === 403)
})

test('cardUrl, embedUrl and pageUrl build addresses without any request', () => {
  const c = createHoldersClient({ fetch: async () => assert.fail('no request expected') })
  assert.equal(c.cardUrl('base', TOKEN), `https://gullylabs.xyz/api/holders/base/${TOKEN}/card.png`)
  assert.equal(c.embedUrl('solana', 'So11111111111111111111111111111111111111112'), 'https://gullylabs.xyz/embed/holders/solana/So11111111111111111111111111111111111111112')
  assert.equal(c.pageUrl('robinhood', 'NVDA'), 'https://gullylabs.xyz/holders/robinhood/NVDA')
  assert.equal(embedUrl('bsc', 'NVDA', 'https://example.test/'), 'https://example.test/embed/holders/bsc/NVDA')
})

test('bad chain or token is rejected before anything is requested', async () => {
  const c = createHoldersClient({ fetch: async () => assert.fail('no request expected') })
  await assert.rejects(c.getMap('nope', TOKEN), TypeError)
  await assert.rejects(c.getMap('base', '../x'), TypeError)
  assert.throws(() => c.cardUrl('base', 'a b'), TypeError)
})

test('<HolderMap> renders the embed iframe with the widget defaults and clamps height', () => {
  const el = HolderMap({ chain: 'base', token: TOKEN })
  assert.equal(el.type, 'iframe')
  assert.equal(el.props.src, `https://gullylabs.xyz/embed/holders/base/${TOKEN}`)
  assert.equal(el.props.style.height, 760)
  assert.equal(el.props.loading, 'lazy')
  assert.equal(HolderMap({ chain: 'base', token: TOKEN, height: 500 }).props.style.height, 500)
  assert.equal(HolderMap({ chain: 'base', token: TOKEN, height: 100 }).props.style.height, 760)
  assert.match(HolderMap({ chain: 'nope', token: TOKEN }).props.children, /Holder Map/)
})
