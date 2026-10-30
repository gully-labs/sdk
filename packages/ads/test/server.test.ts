import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { canonicalServeQuery, createServeSigner, randomNonce, SERVE_SIGNATURE_WINDOW_SECONDS, signServeRequest, verifyServeRequest } from '../src/server'

/**
 * Fixture: the Offerwall's own signer, copied from gully-labs/gully-offerwall api/src/crypto.ts
 *   export const hmacHex = (secret, msg) => createHmac('sha256', secret).update(msg).digest('hex')
 *   export const signPostback = (secret, timestamp, nonce, rawBody) => hmacHex(secret, `${timestamp}.${nonce}.${rawBody}`)
 * The SDK's WebCrypto signature must equal this byte for byte.
 */
const hmacHex = (secret: string, msg: string) => createHmac('sha256', secret).update(msg).digest('hex')
const signPostback = (secret: string, timestamp: number, nonce: string, rawBody: string) => hmacHex(secret, `${timestamp}.${nonce}.${rawBody}`)

const SITE_ID = 'pk_test_site_000000000001'
const SITE_KEY = 'sk_test_0123456789abcdefghijkl'
const TS = 1793361600 // 2026-10-30T12:00:00Z
const NONCE = 'nonce_test_0000000001'
const QUERY = 'content=vid_1&creator=channel%3Aabc&n=1&slot=watch_rail'
// known vector, computed once with node:crypto for the values above
const VECTOR = 'c4ed456aed1237e2be36ca1bf6ad384f63c8df46f62893fedea4ae10f3badefd'

describe('serve request signing (Offerwall postback scheme over the query string)', () => {
  it('canonical query: sorted keys, booleans as 1/0, undefined dropped, URLSearchParams encoding', () => {
    expect(canonicalServeQuery({ slot: 'watch_rail', n: 1, creator: 'channel:abc', content: 'vid_1', topic: undefined })).toBe(QUERY)
    expect(canonicalServeQuery({ slot: 'shorts_feed', gated: true, member: false, page: 'shorts' })).toBe('gated=1&member=0&page=shorts&slot=shorts_feed')
  })

  it('matches the known vector and the ported offerwall signer', async () => {
    const s = await signServeRequest({ siteId: SITE_ID, siteKey: SITE_KEY, query: QUERY, timestamp: TS, nonce: NONCE })
    expect(s.signature).toBe(VECTOR)
    expect(s.signature).toBe(signPostback(SITE_KEY, TS, NONCE, QUERY))
    expect(s.headers).toEqual({
      'x-gully-key': SITE_ID,
      'x-gully-timestamp': String(TS),
      'x-gully-nonce': NONCE,
      'x-gully-signature': VECTOR,
    })
    expect(s.query).toBe(QUERY)
    // the object form canonicalises to the same string and so the same signature
    const o = await signServeRequest({ siteId: SITE_ID, siteKey: SITE_KEY, query: { slot: 'watch_rail', creator: 'channel:abc', content: 'vid_1', n: 1 }, timestamp: TS, nonce: NONCE })
    expect(o.signature).toBe(VECTOR)
  })

  it('agrees with the offerwall signer on random inputs', async () => {
    for (let i = 0; i < 20; i++) {
      const nonce = randomNonce()
      expect(nonce).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
      const q = canonicalServeQuery({ slot: 'home_feed', topic: `t${i}`, n: (i % 3) + 1 })
      const ts = TS + i * 7
      const s = await signServeRequest({ siteId: SITE_ID, siteKey: `sk_${i}_${nonce}`, query: q, timestamp: ts, nonce })
      expect(s.signature).toBe(signPostback(`sk_${i}_${nonce}`, ts, nonce, q))
    }
  })

  it('refuses a bad nonce and missing keys', async () => {
    await expect(signServeRequest({ siteId: SITE_ID, siteKey: SITE_KEY, query: QUERY, nonce: 'short' })).rejects.toThrow(/nonce/)
    await expect(signServeRequest({ siteId: '', siteKey: SITE_KEY, query: QUERY })).rejects.toThrow(/siteId/)
    await expect(signServeRequest({ siteId: SITE_ID, siteKey: '', query: QUERY })).rejects.toThrow(/siteKey/)
  })

  it('verifier: same checks as Offerwall.postback (headers, key, signature, 5-minute window, replay)', async () => {
    const seen = new Set<string>()
    const opts = {
      query: QUERY,
      secretFor: (k: string) => (k === SITE_ID ? SITE_KEY : null),
      rememberNonce: (k: string, n: string) => {
        const id = `${k}:${n}`
        if (seen.has(id)) return false
        seen.add(id)
        return true
      },
      now: () => TS * 1000 + 30_000,
    }
    const s = await signServeRequest({ siteId: SITE_ID, siteKey: SITE_KEY, query: QUERY, timestamp: TS, nonce: NONCE })
    expect(await verifyServeRequest({ ...opts, headers: s.headers })).toEqual({ ok: true, keyId: SITE_ID, timestamp: TS, nonce: NONCE })
    // replay of the same nonce
    expect(await verifyServeRequest({ ...opts, headers: s.headers })).toMatchObject({ ok: false, code: 'replay' })
    // Headers instance works too
    const s2 = await signServeRequest({ siteId: SITE_ID, siteKey: SITE_KEY, query: QUERY, timestamp: TS })
    expect((await verifyServeRequest({ ...opts, headers: new Headers(s2.headers) })).ok).toBe(true)
    // wrong secret
    expect(await verifyServeRequest({ ...opts, headers: s2.headers, secretFor: () => 'sk_wrong' })).toMatchObject({ ok: false, code: 'bad_postback', error: 'bad signature' })
    // unknown key
    expect(await verifyServeRequest({ ...opts, headers: { ...s2.headers, 'x-gully-key': 'pk_nobody' } })).toMatchObject({ ok: false, code: 'bad_postback', error: 'unknown postback key' })
    // missing header
    const { 'x-gully-nonce': _n, ...noNonce } = s2.headers
    expect(await verifyServeRequest({ ...opts, headers: noNonce as never })).toMatchObject({ ok: false, code: 'bad_postback', error: 'missing postback headers' })
    // query tampered after signing
    expect(await verifyServeRequest({ ...opts, headers: s2.headers, query: QUERY.replace('channel%3Aabc', '0x1111111111111111111111111111111111111111') })).toMatchObject({ ok: false, code: 'bad_postback' })
  })

  it('timestamp window is 300 s either way', async () => {
    expect(SERVE_SIGNATURE_WINDOW_SECONDS).toBe(300)
    const base = { query: QUERY, secretFor: () => SITE_KEY }
    const at = async (skew: number) => {
      const s = await signServeRequest({ siteId: SITE_ID, siteKey: SITE_KEY, query: QUERY, timestamp: TS })
      return verifyServeRequest({ ...base, headers: s.headers, now: () => (TS + skew) * 1000 })
    }
    expect((await at(299)).ok).toBe(true)
    expect((await at(-299)).ok).toBe(true)
    expect(await at(301)).toMatchObject({ ok: false, code: 'stale' })
    expect(await at(-600)).toMatchObject({ ok: false, code: 'stale' })
  })

  it('createServeSigner: the publisher route body, with an optional slot allow-list', async () => {
    const sign = createServeSigner({ siteId: SITE_ID, siteKey: SITE_KEY, allowSlots: ['watch_rail'] })
    const s = await sign({ query: QUERY })
    expect(s.headers['x-gully-key']).toBe(SITE_ID)
    expect(JSON.stringify(s)).not.toContain(SITE_KEY)
    await expect(sign({ query: 'slot=home_hero' })).rejects.toThrow(/not allowed/)
    await expect(sign({})).rejects.toThrow(/query/)
  })
})
