import { describe, expect, it } from 'vitest'
import { createKre8Client, Kre8ApiError, parseCoin, parseTrack, type FetchLike } from '../src/client'

const COIN = '0x' + 'c0'.repeat(20)
const ALICE = '0x' + 'a1'.repeat(20)

const routes: Record<string, { status: number; body: unknown }> = {
  [`https://indexer.gullychain.xyz/tokens/${COIN}`]: {
    status: 200,
    body: { head: { block: 10 }, token: { address: COIN, symbol: 'FROG', name: 'Frog Coin', decimals: 18, source: 'gully-core', creator: ALICE, launchedAt: 1761000000, priceUsd: 0.00123, priceEth: '0.0000005', marketCapUsd: 1230000, fdvUsd: null, liquidityUsd: 5000, volume24hUsd: 100, holders: 42, change: { m5: 0, h1: null, h6: 1.5, h24: 4.2 }, iconCid: 'bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy', graduated: false } },
  },
  [`https://indexer.gullychain.xyz/tokens/${COIN}/candles?tf=15m&interval=15m&limit=3`]: { status: 200, body: { tf: '15m', candles: [{ t: 3, o: 1, h: 1, l: 1, c: 1.5, v: 0 }, { t: 1, c: 1 }, { t: 2, c: 0 }, { time: 4, close: 2, volume: 3 }] } },
  'https://indexer.gullychain.xyz/tokens': { status: 200, body: { tokens: [{ address: COIN, symbol: 'FROG' }, { address: 'nope' }] } },
  [`https://kre8.fun/embed/coin/${COIN}.json`]: { status: 200, body: { address: COIN, name: 'Frog Coin', symbol: 'FROG', priceUsd: 0.00123, marketCapUsd: 1230000, change24h: 4.2, spark: [1, 2, 'x', 1.5], chainId: 485590 } },
  'https://social.kre8.fun/v1/tracks/trk_12345678': {
    status: 200,
    body: { id: 'trk_12345678', owner: ALICE, title: 'First light', genre: 'Lo-fi', mood: null, description: '', cover: 'https://social.kre8.fun/m/abc.webp', audio: { file: 'x.mp3', durationMs: 184000, status: 'ready' }, peaks: [1, 2], plays: 12, tips: { count: 1, total: '1000000' }, createdAt: 1761000000, status: 'published' },
  },
  'https://social.kre8.fun/v1/tracks/trk_12345678/plays?days=7': { status: 200, body: { plays: 12, series: [{ day: 1761000000, plays: 5 }, { day: 1761086400, plays: 7 }, { day: 'x', plays: 1 }] } },
  'https://social.kre8.fun/v1/tracks/trk_takendown': { status: 451, body: { error: 'taken down' } },
  [`https://social.kre8.fun/v1/creators/${ALICE}`]: { status: 200, body: { address: ALICE, enabled: true, theme: 'night', accent: 'yellow', banner: null, headline: 'Lo-fi from the gully', bio: 'hi', links: [{ label: 'Site', url: 'https://alice.example' }, { label: 'bad', url: 'javascript:1' }], blocks: [], top8: [] } },
  [`https://social.kre8.fun/v1/profiles/${ALICE}`]: { status: 200, body: { address: ALICE, followers: 10, following: 2, posts: 3, points: 100, early: true, verified: { x_handle: 'alice' }, official: false } },
  'https://social.kre8.fun/v1/creators/trending?limit=2': { status: 200, body: { items: [{ address: ALICE, plays7d: 50, tips7d: 2, tippers7d: 2, tipsTotal7d: '3000000', tracks: 4, accent: 'yellow', score: 70 }, { address: 'junk' }], window: '7d' } },
}

const calls: string[] = []
const stubFetch: FetchLike = async (url) => {
  calls.push(url)
  const r = routes[url]
  if (!r) return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body }
}

describe('createKre8Client', () => {
  const c = createKre8Client({ fetch: stubFetch })

  it('uses the public defaults and validates options', () => {
    expect(c.indexerUrl).toBe('https://indexer.gullychain.xyz')
    expect(c.socialUrl).toBe('https://social.kre8.fun')
    expect(c.appOrigin).toBe('https://kre8.fun')
    expect(() => createKre8Client({ indexerUrl: 'ftp://x' })).toThrow(/indexerUrl/)
    expect(() => createKre8Client({ origin: 'https://evil.example' })).toThrow(/origin/)
    expect(createKre8Client({ devOrigin: 'http://localhost:4361', fetch: stubFetch }).appOrigin).toBe('http://localhost:4361')
  })

  it('coin: indexer /tokens/:addr parsed, nulls kept, icon through the Gully gateway', async () => {
    const coin = await c.coin(COIN.toUpperCase().replace('0X', '0x'))
    expect(calls[calls.length - 1]).toBe(`https://indexer.gullychain.xyz/tokens/${COIN}`)
    expect(coin).toMatchObject({ chainId: 485590, address: COIN, name: 'Frog Coin', symbol: 'FROG', decimals: 18, source: 'gully-core', creator: ALICE, priceUsd: 0.00123, priceEth: 0.0000005, marketCapUsd: 1230000, fdvUsd: null, holders: 42, graduated: false, url: `https://kre8.fun/token/${COIN}` })
    expect(coin!.change).toEqual({ m5: 0, h1: null, h6: 1.5, h24: 4.2 })
    expect(coin!.iconUrl).toBe('https://ipfs.gullylabs.xyz/ipfs/bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy')
    expect(await c.coin('0x' + '99'.repeat(20))).toBeNull()
    await expect(c.coin('frog')).rejects.toThrow(/0x address/)
    expect(parseCoin({ token: { address: 'nope' } }, 'https://kre8.fun')).toBeNull()
  })

  it('candles: sorted, zero closes dropped, both field spellings', async () => {
    expect(await c.candles(COIN, '15m', 3)).toEqual([
      { t: 1, o: 0, h: 0, l: 0, c: 1, v: 0 },
      { t: 3, o: 1, h: 1, l: 1, c: 1.5, v: 0 },
      { t: 4, o: 0, h: 0, l: 0, c: 2, v: 3 },
    ])
  })

  it('coins and coinCard', async () => {
    const all = await c.coins()
    expect(all.length).toBe(1)
    expect(all[0]!.symbol).toBe('FROG')
    expect(await c.coinCard(COIN)).toEqual({ address: COIN, name: 'Frog Coin', symbol: 'FROG', priceUsd: 0.00123, marketCapUsd: 1230000, change24h: 4.2, spark: [1, 2, 1.5], chainId: 485590 })
  })

  it('tracks: public fields only, 451 (taken down) is null, plays series zero-filled rows kept', async () => {
    const t = await c.track('trk_12345678')
    expect(t).toEqual({ id: 'trk_12345678', owner: ALICE, title: 'First light', genre: 'Lo-fi', mood: null, description: null, cover: 'https://social.kre8.fun/m/abc.webp', durationMs: 184000, plays: 12, createdAt: 1761000000, status: 'published', url: 'https://kre8.fun/track/trk_12345678' })
    expect(JSON.stringify(t)).not.toContain('peaks')
    expect(await c.track('trk_takendown')).toBeNull()
    expect(await c.trackPlays('trk_12345678', 7)).toEqual({ plays: 12, series: [{ day: 1761000000, plays: 5 }, { day: 1761086400, plays: 7 }] })
    await expect(c.track('x')).rejects.toThrow(/track id/)
    expect(parseTrack({ id: 'trk_12345678' }, 'https://kre8.fun')).toBeNull()
  })

  it('creators, profiles, trending', async () => {
    const cr = await c.creator(ALICE)
    expect(cr).toEqual({ address: ALICE, enabled: true, headline: 'Lo-fi from the gully', bio: 'hi', theme: 'night', accent: 'yellow', banner: null, links: [{ label: 'Site', url: 'https://alice.example' }], url: `https://kre8.fun/address/${ALICE}` })
    expect(await c.profile(ALICE)).toEqual({ address: ALICE, followers: 10, following: 2, posts: 3, points: 100, verified: true, official: false })
    expect(await c.trendingCreators(2)).toEqual([{ address: ALICE, plays7d: 50, tips7d: 2, tippers7d: 2, tracks: 4, score: 70 }])
    expect(await c.creatorTracks(ALICE)).toEqual([])
  })

  it('non-404 failures surface as Kre8ApiError', async () => {
    const failing = createKre8Client({ fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }) })
    await expect(failing.coin(COIN)).rejects.toBeInstanceOf(Kre8ApiError)
    await expect(failing.coin(COIN)).rejects.toMatchObject({ status: 503 })
  })
})
