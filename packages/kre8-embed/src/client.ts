/**
 * Read-only client for kre8's public data, no iframe, no auth. Two services, both public:
 *
 *  - Gully Chain indexer (gully-ops l3/indexer, CORS *): `GET /tokens/:addr`, `GET /tokens/:addr/candles?tf=&limit=`,
 *    `GET /tokens`, `GET /head` (same calls as gully-street src/lib/indexerApi.ts).
 *  - kre8 social API (gully-street services/social, API.md): `GET /v1/tracks/:id`, `GET /v1/tracks/:id/plays?days=`,
 *    `GET /v1/creators/:address`, `GET /v1/creators/:address/tracks`, `GET /v1/creators/trending?limit=`,
 *    `GET /v1/profiles/:address`. Its CORS allowlist is kre8.fun and app.gullychain.xyz only, so call these from a
 *    server (Node 18+) or through your own proxy; from a third-party browser page they are blocked.
 *  - kre8 app host: `GET /embed/coin/:addr.json` (CORS *), the coin card's own numbers.
 *
 * Every response is validated; a field the server did not send is null, never guessed.
 */
import { DEFAULT_INDEXER_URL, DEFAULT_SOCIAL_URL, GULLY_CHAIN_ID, resolveEmbedOrigin, type EmbedOriginOptions } from './origins'
import { isCoinAddress, isTrackId } from './url'

export type FetchLike = (input: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

export interface Kre8ClientOptions extends EmbedOriginOptions {
  indexerUrl?: string
  socialUrl?: string
  fetch?: FetchLike
  timeoutMs?: number
}

export type WindowKey = 'm5' | 'h1' | 'h6' | 'h24'

export interface Kre8Coin {
  chainId: number
  address: string
  name: string
  symbol: string
  decimals: number
  source: string | null
  creator: string | null
  launchedAt: number | null
  priceUsd: number | null
  priceEth: number | null
  marketCapUsd: number | null
  fdvUsd: number | null
  liquidityUsd: number | null
  volume24hUsd: number | null
  holders: number | null
  /** % price change per window */
  change: Record<WindowKey, number | null>
  /** ipfs CID of the icon (Gully Core launches); resolve through https://ipfs.gullylabs.xyz/ipfs/<cid> */
  iconCid: string | null
  iconUrl: string | null
  graduated: boolean | null
  /** the kre8 page */
  url: string
}

export interface Kre8Candle {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface Kre8CoinCard {
  address: string | null
  name: string
  symbol: string
  priceUsd: number | null
  marketCapUsd: number | null
  change24h: number | null
  spark: number[]
  chainId: number
}

export interface Kre8Track {
  id: string
  owner: string
  title: string
  genre: string | null
  mood: string | null
  description: string | null
  cover: string | null
  durationMs: number | null
  plays: number
  createdAt: number | null
  status: string | null
  url: string
}

export interface Kre8Creator {
  address: string
  enabled: boolean
  headline: string | null
  bio: string | null
  theme: string | null
  accent: string | null
  banner: string | null
  links: { label: string; url: string }[]
  url: string
}

export interface Kre8Profile {
  address: string
  followers: number
  following: number
  posts: number
  points: number
  verified: boolean
  official: boolean
}

export interface Kre8TrendingCreator {
  address: string
  plays7d: number
  tips7d: number
  tippers7d: number
  tracks: number
  score: number
}

export class Kre8ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message)
    this.name = 'Kre8ApiError'
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const addr = (v: unknown): string | null => (isCoinAddress(v) ? v.toLowerCase() : null)
const WKEYS: readonly WindowKey[] = ['m5', 'h1', 'h6', 'h24']
const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/
const GULLY_IPFS_GATEWAY = 'https://ipfs.gullylabs.xyz/ipfs/'

const normalizeBase = (u: string, name: string): string => {
  const t = u.trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^\s/]+/.test(t)) throw new Error(`kre8-embed: ${name} must be an http(s) URL`)
  return t
}

/** A `/tokens/:addr` answer ({ token: row } or a bare row) -> Kre8Coin, null for an unknown token. Pure. */
export function parseCoin(j: unknown, appOrigin: string): Kre8Coin | null {
  const root = obj(j)
  const t = obj(root.token ?? root)
  const a = addr(t.address)
  if (!a) return null
  const change = obj(t.change)
  const iconCid = str(t.iconCid)
  return {
    chainId: GULLY_CHAIN_ID,
    address: a,
    name: typeof t.name === 'string' ? t.name.slice(0, 64) : '',
    symbol: typeof t.symbol === 'string' ? t.symbol.slice(0, 16) : '',
    decimals: Number.isInteger(t.decimals) ? (t.decimals as number) : 18,
    source: str(t.source),
    creator: addr(t.creator),
    launchedAt: num(t.launchedAt ?? t.createdAt),
    priceUsd: num(t.priceUsd),
    priceEth: num(t.priceEth),
    marketCapUsd: num(t.marketCapUsd),
    fdvUsd: num(t.fdvUsd),
    liquidityUsd: num(t.liquidityUsd),
    volume24hUsd: num(t.volume24hUsd),
    holders: num(t.holders),
    change: Object.fromEntries(WKEYS.map((k) => [k, num(change[k])])) as Record<WindowKey, number | null>,
    iconCid,
    iconUrl: iconCid && CID.test(iconCid) ? GULLY_IPFS_GATEWAY + iconCid : null,
    graduated: typeof t.graduated === 'boolean' ? t.graduated : null,
    url: `${appOrigin}/token/${a}`,
  }
}

/** `/tokens/:addr/candles` -> candles oldest first, only rows with a positive close. Pure. */
export function parseCandles(j: unknown): Kre8Candle[] {
  return arr(obj(j).candles)
    .map((c) => {
      const o = obj(c)
      return { t: num(o.t ?? o.time) ?? 0, o: num(o.o ?? o.open) ?? 0, h: num(o.h ?? o.high) ?? 0, l: num(o.l ?? o.low) ?? 0, c: num(o.c ?? o.close) ?? 0, v: num(o.v ?? o.volume) ?? 0 }
    })
    .filter((c) => c.t > 0 && c.c > 0)
    .sort((a, b) => a.t - b.t)
}

/** `/embed/coin/:addr.json` -> the card's numbers. Pure. */
export function parseCoinCard(j: unknown): Kre8CoinCard {
  const o = obj(j)
  return {
    address: addr(o.address),
    name: typeof o.name === 'string' ? o.name : '',
    symbol: typeof o.symbol === 'string' ? o.symbol : '',
    priceUsd: num(o.priceUsd),
    marketCapUsd: num(o.marketCapUsd),
    change24h: num(o.change24h),
    spark: arr(o.spark).map(num).filter((v): v is number => v !== null),
    chainId: GULLY_CHAIN_ID,
  }
}

/** A social `Track` -> Kre8Track (public fields only), null when the id is missing. Pure. */
export function parseTrack(j: unknown, appOrigin: string): Kre8Track | null {
  const t = obj(j)
  const id = str(t.id)
  const owner = addr(t.owner)
  if (!id || !isTrackId(id) || !owner) return null
  const audio = obj(t.audio)
  return {
    id,
    owner,
    title: typeof t.title === 'string' ? t.title : '',
    genre: str(t.genre),
    mood: str(t.mood),
    description: str(t.description),
    cover: str(t.cover),
    durationMs: num(audio.durationMs),
    plays: num(t.plays) ?? 0,
    createdAt: num(t.createdAt),
    status: str(t.status),
    url: `${appOrigin}/track/${encodeURIComponent(id)}`,
  }
}

/** A social `Creator` -> Kre8Creator, null when not a creator page. Pure. */
export function parseCreator(j: unknown, appOrigin: string): Kre8Creator | null {
  const c = obj(j)
  const a = addr(c.address)
  if (!a) return null
  return {
    address: a,
    enabled: c.enabled === true,
    headline: str(c.headline),
    bio: str(c.bio),
    theme: str(c.theme),
    accent: str(c.accent),
    banner: str(c.banner),
    links: arr(c.links)
      .map((l) => obj(l))
      .filter((l) => typeof l.label === 'string' && typeof l.url === 'string' && /^https:\/\//.test(l.url))
      .map((l) => ({ label: l.label as string, url: l.url as string })),
    url: `${appOrigin}/address/${a}`,
  }
}

/** A social `Profile` -> Kre8Profile. Pure. */
export function parseProfile(j: unknown): Kre8Profile | null {
  const p = obj(j)
  const a = addr(p.address)
  if (!a) return null
  return {
    address: a,
    followers: num(p.followers) ?? 0,
    following: num(p.following) ?? 0,
    posts: num(p.posts) ?? 0,
    points: num(p.points) ?? 0,
    verified: !!p.verified,
    official: p.official === true,
  }
}

export interface Kre8Client {
  readonly indexerUrl: string
  readonly socialUrl: string
  readonly appOrigin: string
  /** indexer `/tokens/:addr`; null for an unknown coin */
  coin(address: string): Promise<Kre8Coin | null>
  /** indexer `/tokens` (every indexed coin; the app's screener rows) */
  coins(): Promise<Kre8Coin[]>
  /** indexer `/tokens/:addr/candles?tf=&limit=` (tf: 1m 5m 15m 1h 4h 1d) */
  candles(address: string, tf?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d', limit?: number): Promise<Kre8Candle[]>
  /** kre8 `/embed/coin/:addr.json`: the coin card's numbers and 24h sparkline */
  coinCard(address: string): Promise<Kre8CoinCard | null>
  /** social `/v1/tracks/:id`; null when unknown or taken down */
  track(id: string): Promise<Kre8Track | null>
  /** social `/v1/tracks/:id/plays?days=` -> zero-filled plays per UTC day */
  trackPlays(id: string, days?: number): Promise<{ plays: number; series: { day: number; plays: number }[] }>
  /** social `/v1/creators/:address` */
  creator(address: string): Promise<Kre8Creator | null>
  /** social `/v1/creators/:address/tracks` */
  creatorTracks(address: string): Promise<Kre8Track[]>
  /** social `/v1/creators/trending?limit=` (7 day window) */
  trendingCreators(limit?: number): Promise<Kre8TrendingCreator[]>
  /** social `/v1/profiles/:address` */
  profile(address: string): Promise<Kre8Profile | null>
}

/** A read-only client for kre8's public data. `fetch` is injectable (tests, custom agents). */
export function createKre8Client(opts: Kre8ClientOptions = {}): Kre8Client {
  const indexerUrl = normalizeBase(opts.indexerUrl ?? DEFAULT_INDEXER_URL, 'indexerUrl')
  const socialUrl = normalizeBase(opts.socialUrl ?? DEFAULT_SOCIAL_URL, 'socialUrl')
  const appOrigin = resolveEmbedOrigin(opts)
  const timeoutMs = opts.timeoutMs ?? 8000
  const f: FetchLike = opts.fetch ?? ((input, init) => fetch(input, { ...init, credentials: 'omit', redirect: 'error' }))

  async function get(url: string, allow404 = true): Promise<unknown> {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = ac ? setTimeout(() => ac.abort(), timeoutMs) : null
    try {
      const r = await f(url, { signal: ac?.signal, headers: { accept: 'application/json' } })
      if (r.status === 404 && allow404) return null
      if (!r.ok) throw new Kre8ApiError(`kre8-embed: ${url} answered ${r.status}`, r.status, url)
      return await r.json()
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  const coinPath = (address: string) => {
    if (!isCoinAddress(address)) throw new Error('kre8-embed: coin address must be a 0x address')
    return address.toLowerCase()
  }
  const trackPath = (id: string) => {
    if (!isTrackId(id)) throw new Error('kre8-embed: track id is not valid')
    return encodeURIComponent(id)
  }

  return {
    indexerUrl,
    socialUrl,
    appOrigin,
    async coin(address) {
      const j = await get(`${indexerUrl}/tokens/${coinPath(address)}`)
      return j === null ? null : parseCoin(j, appOrigin)
    },
    async coins() {
      const j = await get(`${indexerUrl}/tokens`)
      return arr(obj(j).tokens)
        .map((t) => parseCoin(t, appOrigin))
        .filter((t): t is Kre8Coin => t !== null)
    },
    async candles(address, tf = '15m', limit = 96) {
      const n = Math.min(2000, Math.max(1, Math.floor(limit)))
      const j = await get(`${indexerUrl}/tokens/${coinPath(address)}/candles?tf=${tf}&interval=${tf}&limit=${n}`)
      return j === null ? [] : parseCandles(j)
    },
    async coinCard(address) {
      const j = await get(`${appOrigin}/embed/coin/${coinPath(address)}.json`)
      return j === null ? null : parseCoinCard(j)
    },
    async track(id) {
      const url = `${socialUrl}/v1/tracks/${trackPath(id)}`
      try {
        const j = await get(url)
        return j === null ? null : parseTrack(j, appOrigin)
      } catch (e) {
        if (e instanceof Kre8ApiError && e.status === 451) return null
        throw e
      }
    },
    async trackPlays(id, days = 30) {
      const d = Math.min(90, Math.max(1, Math.floor(days)))
      const j = obj(await get(`${socialUrl}/v1/tracks/${trackPath(id)}/plays?days=${d}`))
      return {
        plays: num(j.plays) ?? 0,
        series: arr(j.series)
          .map((s) => obj(s))
          .map((s) => ({ day: num(s.day) ?? 0, plays: num(s.plays) ?? 0 }))
          .filter((s) => s.day > 0),
      }
    },
    async creator(address) {
      const j = await get(`${socialUrl}/v1/creators/${coinPath(address)}`)
      return j === null ? null : parseCreator(j, appOrigin)
    },
    async creatorTracks(address) {
      const j = await get(`${socialUrl}/v1/creators/${coinPath(address)}/tracks`)
      return arr(obj(j).items)
        .map((t) => parseTrack(t, appOrigin))
        .filter((t): t is Kre8Track => t !== null)
    },
    async trendingCreators(limit = 10) {
      const n = Math.min(30, Math.max(1, Math.floor(limit)))
      const j = await get(`${socialUrl}/v1/creators/trending?limit=${n}`)
      return arr(obj(j).items)
        .map((i) => obj(i))
        .filter((i) => isCoinAddress(i.address))
        .map((i) => ({ address: (i.address as string).toLowerCase(), plays7d: num(i.plays7d) ?? 0, tips7d: num(i.tips7d) ?? 0, tippers7d: num(i.tippers7d) ?? 0, tracks: num(i.tracks) ?? 0, score: num(i.score) ?? 0 }))
    },
    async profile(address) {
      const j = await get(`${socialUrl}/v1/profiles/${coinPath(address)}`)
      return j === null ? null : parseProfile(j)
    },
  }
}
