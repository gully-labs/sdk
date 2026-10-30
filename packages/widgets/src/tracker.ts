/**
 * @gullylabs/widgets/tracker — a typed client for the Gully Labs stock token tracker API.
 *
 * Every tokenised stock on Robinhood Chain and BNB Chain, priced from its deepest pool on chain
 * against its Chainlink fair price. https://docs.gullylabs.xyz/api
 *
 * No dependencies. Works anywhere `fetch` exists: browsers, Node 18+, Bun, Deno, edge runtimes.
 */

export type TrackerStatus = 'premium' | 'discount' | 'drifting' | 'in-line' | 'thin' | 'no-pool' | 'pool-unreadable' | 'feed-unreadable'

export type ChainKey = 'robinhood' | 'bsc' | (string & {})

export interface TrackerPool {
  /** The venue's id, as DexScreener or GeckoTerminal names it. */
  dex: string
  labels: string[]
  /** The pool's other token, e.g. WETH or USDC. */
  against: string
  url: string
  pair: string
  liquidityUsd: number
  volume24hUsd: number
  pools: number
  totalLiquidityUsd: number
  totalVolume24hUsd: number
}

export interface TrackerRow {
  chain: ChainKey
  ticker: string
  name: string
  token: string
  feed: string
  /** Chainlink fair price in USD, or null when the feed could not be read. */
  fair: number | null
  feedPrices: 'tokenized-instrument' | 'underlying-share'
  /** bStocks: raw token = multiplier shares (ERC-8056). null where the chain has none. */
  multiplier: number | null
  feedUpdatedAt: string | null
  feedError: string | null
  /** Price in the deepest pool, in USD, or null when no pool could be read. */
  onchain: number | null
  /** (onchain − fair) / fair × 100, or null when either price is missing. */
  gapPct: number | null
  status: TrackerStatus
  pool: TrackerPool | null
  poolError: string | null
  /** The stock's logo, an absolute URL on gullylabs.xyz. */
  logo: string | null
  /** The chain's logo, an absolute URL on gullylabs.xyz. */
  chainLogo: string | null
  /** The pool read is the chain's last good one, served while every source is backing off. */
  poolStale?: boolean
}

export interface TrackerChain {
  key: ChainKey
  id: number
  name: string
  sessionOpen: boolean
  sessionName: string
  fairMethod: string
  poolsAsOf: string | null
  poolsStale: boolean
  poolSource: string | null
}

export interface Tracker {
  generatedAt: string
  chains: TrackerChain[]
  rules: { minLiquidityUsd: number; inLinePct: number; flagPct: number }
  sources: { fair: string; onchain: string; tables: string[] }
  rows: TrackerRow[]
}

export interface HistoryPoint {
  time: Date
  gapPct: number
  onchain: number
  fair: number
}

export interface RateLimit {
  limit: number
  remaining: number
  /** Seconds until the window resets, when the server says. */
  resetSeconds: number | null
}

export interface ClientOptions {
  /** An API key from https://app.gullylabs.xyz raises the limit from 60 to 600 calls a minute. */
  apiKey?: string
  /** Defaults to https://gullylabs.xyz */
  baseUrl?: string
  /** Bring your own fetch (tests, proxies). Defaults to the global one. */
  fetch?: typeof fetch
  /** Per-request timeout. Defaults to 15 s. */
  timeoutMs?: number
}

/** The API answered with an error status, or did not answer in time. */
export class GullyApiError extends Error {
  readonly status: number
  /** Seconds to wait before retrying, on a 429. */
  readonly retryAfter: number | null
  constructor(message: string, status: number, retryAfter: number | null = null) {
    super(message)
    this.name = 'GullyApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

/** A gap the tracker trusts: both prices read and the pool deep enough (not 'thin'). */
export function isTrusted(row: TrackerRow): row is TrackerRow & { gapPct: number; onchain: number; fair: number } {
  return row.gapPct !== null && row.onchain !== null && row.fair !== null && ['premium', 'discount', 'drifting', 'in-line'].includes(row.status)
}

export function createTrackerClient(options: ClientOptions = {}) {
  const base = (options.baseUrl ?? 'https://gullylabs.xyz').replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 15_000
  if (typeof doFetch !== 'function') throw new Error('No fetch available: pass options.fetch')
  let rateLimit: RateLimit | null = null

  async function get<T>(path: string): Promise<T> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    let res: Response
    try {
      res = await doFetch(base + path, {
        headers: { accept: 'application/json', ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}) },
        signal: ctrl.signal,
      })
    } catch (e) {
      throw new GullyApiError(ctrl.signal.aborted ? `No answer within ${timeoutMs} ms` : `Network error: ${(e as Error).message}`, 0)
    } finally {
      clearTimeout(timer)
    }
    const num = (h: string) => {
      const v = res.headers.get(h)
      return v === null || v === '' ? null : Number(v)
    }
    const limit = num('x-ratelimit-limit')
    const remaining = num('x-ratelimit-remaining')
    if (limit !== null && remaining !== null) rateLimit = { limit, remaining, resetSeconds: num('x-ratelimit-reset') }
    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const body = (await res.json()) as { error?: string }
        if (body?.error) message = body.error
      } catch {
        /* not JSON */
      }
      throw new GullyApiError(message, res.status, num('retry-after'))
    }
    return (await res.json()) as T
  }

  return {
    /** The whole tracker: every chain, every stock, the rules and the sources. */
    getTracker: () => get<Tracker>('/api/tracker'),

    /** Rows, optionally filtered. `trustedOnly` keeps gaps the tracker would chart. */
    async getRows(filter: { chain?: ChainKey; status?: TrackerStatus | TrackerStatus[]; trustedOnly?: boolean } = {}) {
      const t = await get<Tracker>('/api/tracker')
      const statuses = filter.status === undefined ? null : ([] as TrackerStatus[]).concat(filter.status)
      return t.rows.filter((r) => (!filter.chain || r.chain === filter.chain) && (!statuses || statuses.includes(r.status)) && (!filter.trustedOnly || isTrusted(r)))
    },

    /** One stock on one chain, or null when it is not tracked there. */
    async getStock(chain: ChainKey, ticker: string) {
      const t = await get<Tracker>('/api/tracker')
      return t.rows.find((r) => r.chain === chain && r.ticker === ticker.toUpperCase()) ?? null
    },

    /** The widest trusted gaps, largest first. */
    async widestGaps(count = 5, chain?: ChainKey) {
      const t = await get<Tracker>('/api/tracker')
      return t.rows
        .filter((r) => (!chain || r.chain === chain) && isTrusted(r))
        .sort((a, b) => Math.abs(b.gapPct!) - Math.abs(a.gapPct!))
        .slice(0, count)
    },

    /** Up to 7 days of 5-minute snapshots for one stock, oldest first. */
    async getHistory(chain: ChainKey, ticker: string): Promise<HistoryPoint[]> {
      const q = `/api/tracker/history?chain=${encodeURIComponent(chain)}&ticker=${encodeURIComponent(ticker.toUpperCase())}`
      const h = await get<{ points: [number, number, number, number][] }>(q)
      return (h.points ?? []).map(([t, gapPct, onchain, fair]) => ({ time: new Date(t * 1000), gapPct, onchain, fair }))
    },

    /**
     * Calls `onUpdate` now and then every `intervalMs` (default 60 s, the tracker's own refresh).
     * Errors go to `onError` and the watch keeps going. Returns a function that stops it.
     */
    watch(onUpdate: (t: Tracker) => void, { intervalMs = 60_000, onError }: { intervalMs?: number; onError?: (e: unknown) => void } = {}) {
      let stopped = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const tick = async () => {
        try {
          const t = await get<Tracker>('/api/tracker')
          if (!stopped) onUpdate(t)
        } catch (e) {
          if (!stopped) onError?.(e)
        }
        if (!stopped) timer = setTimeout(tick, Math.max(10_000, intervalMs))
      }
      void tick()
      return () => {
        stopped = true
        if (timer) clearTimeout(timer)
      }
    },

    /** The rate limit the last response reported, or null before the first call. */
    get rateLimit() {
      return rateLimit
    },
  }
}

export type TrackerClient = ReturnType<typeof createTrackerClient>
