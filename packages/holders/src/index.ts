/**
 * @gullylabs/holders — a typed client for the Gully Labs Holder Map API, plus a React component.
 *
 * Who holds a token and how the biggest wallets are connected. https://docs.gullylabs.xyz/holder-map-integrate
 *
 * No dependencies. Works anywhere `fetch` exists: browsers, Node 18+, Bun, Deno, edge runtimes.
 */

/** The chains the Holder Map runs on. */
export type HolderChain = 'robinhood' | 'bsc' | 'base' | 'hyperevm' | 'solana'

export const HOLDER_CHAINS: readonly HolderChain[] = ['robinhood', 'bsc', 'base', 'hyperevm', 'solana']

/** What a map was drawn for: a DeepCore launch, or a stock token the tracker follows. */
export type HolderMapKind = 'stock' | 'deepcore-launch' | (string & {})

export interface HolderChainInfo {
  key: HolderChain
  id: number | 'solana'
  name: string
}

/** What an address is, when a source says so. Pools, locks, burn and exchanges are never counted as wallets. */
export interface HolderLabel {
  kind: 'deployer' | 'pool' | 'lock' | 'burn' | 'token' | 'deepcore' | 'router' | 'gully' | 'exchange' | 'known' | (string & {})
  name: string
}

export interface HolderNode {
  /** The wallet address (lower case on EVM chains). */
  id: string
  short: string
  rank: number
  /** Balance in token units. */
  balance: number
  /** Share of the supply (or of the listed holders, see `holders.sharesOf`), 0 to 100. */
  pct: number | null
  label: HolderLabel | null
  /** Whether the address is a contract, when known. */
  contract: boolean | null
  /** The id of the cluster this wallet belongs to, or null. */
  cluster: string | null
  /** For example `deployer`, `sniper`, `bundled`, `funded-by-deployer`. */
  flags: string[]
  url: string
  /** Stock tokens only: the balance at the real share price, in USD. */
  valueAtFairUsd?: number
  premiumUsd?: number | null
  boughtGapPct?: number | null
}

export interface HolderLink {
  source: string
  target: string
  transfers: number
  pct: number | null
  kind: 'transfer' | 'funding' | 'via'
}

export interface HolderCluster {
  id: string
  wallets: string[]
  count: number
  pct: number | null
  hasDeployer: boolean
}

export interface HolderForensics {
  deployer: string | null
  launchBlock: number | null
  firstTradeBlock: number | null
  bundled: { wallets: number; pct: number | null; firstBlockBuyers: number }
  funded: { wallets: number; pct: number | null; coinChecked: boolean; coinNote: string | null }
  deployerPct: number | null
  liquidity: { locked: boolean | null; locker: string | null; since: string | null }
  buyers: number
  snipers: { wallets: number; pct: number | null; blocks: number }
  riskLine: string
}

export interface HolderFair {
  fair: number
  onchain: number | null
  gapPct: number | null
  status: string
  top10ValueAtFairUsd: number
  top10PremiumUsd: number | null
  buyersAvgGapPct: number | null
  buyers: number
}

export interface HolderTimelineFrame {
  block: number
  at: string | null
  /** Share of each of the first `holders.graph` nodes, in node order. */
  pcts: number[]
  top10Pct: number | null
  holders: number | null
}

export interface HolderFlow {
  from: string
  to: string
  side: 'mint' | 'burn' | 'buy' | 'sell' | 'transfer'
  pct: number | null
  units: number
  block: number
  at: string | null
  tx: string | null
}

export interface HolderHiddenLink {
  via: string
  short: string
  url: string
  connects: string[]
  transfers: number
}

/** What the caller's plan includes. */
export interface HolderFeatures {
  replay: boolean
  csv: boolean
  alerts: boolean
  holders: number
  liveMinutes: number | null
  gated: boolean
}

/** A finished map: `state` is "ok". */
export interface HolderMapOk {
  state: 'ok'
  kind: HolderMapKind
  chain: HolderChainInfo
  token: { address: string; symbol: string | null; name: string | null; decimals: number; supply: number | null; url: string }
  /** When the map was built (ISO time). Maps are cached for at least five minutes. */
  asOf: string
  sources: unknown
  holders: { count: number | null; shown: number; graph: number; sharesOf: 'total supply' | 'listed holders'; partial: unknown }
  tier: 'free' | 'pro'
  locked: string[]
  nodes: HolderNode[]
  links: HolderLink[]
  clusters: HolderCluster[]
  legend: { kind: string; text: string }[]
  summary: { top10Pct: number | null; largestCluster: { pct: number | null; wallets: number } | null; line: string; plain: string[] }
  forensics: HolderForensics | null
  fair: HolderFair | null
  timeline: { basis: string; frames: HolderTimelineFrame[] } | null
  recentFlows: HolderFlow[]
  hidden: HolderHiddenLink[]
  health: Record<string, unknown> | null
  deployerHistory: Record<string, unknown> | null
  crossToken: Record<string, unknown> | null
  live: { supported: boolean; cursor: number | null }
  features: HolderFeatures
  /** Present when a cached map is served while a rebuild is busy. */
  cached?: boolean
  stale?: boolean
}

/** A map the server could not draw. `reason` is plain words fit to show a user. */
export interface HolderMapNotOk {
  state: 'unavailable' | 'not-found' | 'busy' | 'error'
  reason: string
  chain?: HolderChainInfo
  token?: { address: string; symbol?: string | null }
  kind?: HolderMapKind
  /** unavailable only: the chain's holder source is not set up yet. */
  comingSoon?: boolean
  asOf?: string
}

export type HolderMap = HolderMapOk | HolderMapNotOk

/** True when the map was drawn. Narrows the type. */
export const isMapOk = (m: HolderMap): m is HolderMapOk => m.state === 'ok'

export interface HoldersClientOptions {
  /** An API key from https://developers.gullylabs.xyz raises the rate limit and unlocks plan features. */
  apiKey?: string
  /** Defaults to https://gullylabs.xyz */
  baseUrl?: string
  /** Bring your own fetch (tests, proxies). Defaults to the global one. */
  fetch?: typeof fetch
  /** Per-request timeout. Defaults to 20 s (a new map can take a few seconds to build). */
  timeoutMs?: number
}

/** The API answered with an error status that carries no map, or did not answer in time. */
export class HoldersApiError extends Error {
  readonly status: number
  /** Seconds to wait before retrying, on a 429. */
  readonly retryAfter: number | null
  constructor(message: string, status: number, retryAfter: number | null = null) {
    super(message)
    this.name = 'HoldersApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

export const DEFAULT_BASE_URL = 'https://gullylabs.xyz'

const TOKEN_RE = /^[A-Za-z0-9]{1,64}$/

function check(chain: string, token: string): void {
  if (!(HOLDER_CHAINS as readonly string[]).includes(chain) && !/^\d{1,10}$/.test(chain)) throw new TypeError(`Unknown chain "${chain}". Use one of ${HOLDER_CHAINS.join(', ')}.`)
  if (!TOKEN_RE.test(token)) throw new TypeError('token must be an address or a ticker: 1 to 64 letters and digits.')
}

/** The framed Holder Map for a token: https://gullylabs.xyz/embed/holders/:chain/:token */
export function embedUrl(chain: string, token: string, baseUrl: string = DEFAULT_BASE_URL): string {
  check(chain, token)
  return `${baseUrl.replace(/\/+$/, '')}/embed/holders/${chain}/${token}`
}

export function createHoldersClient(options: HoldersClientOptions = {}) {
  const base = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 20_000
  if (typeof doFetch !== 'function') throw new Error('No fetch available: pass options.fetch')
  let rateLimit: { limit: number; remaining: number; resetSeconds: number | null } | null = null

  async function request(path: string, accept: string): Promise<Response> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    let res: Response
    try {
      res = await doFetch(base + path, {
        headers: { accept, ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}) },
        signal: ctrl.signal,
      })
    } catch (e) {
      throw new HoldersApiError(ctrl.signal.aborted ? `No answer within ${timeoutMs} ms` : `Network error: ${(e as Error).message}`, 0)
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
    return res
  }

  const retryAfter = (res: Response) => {
    const v = res.headers.get('retry-after')
    return v === null || v === '' ? null : Number(v)
  }

  return {
    /**
     * The Holder Map of a token. `chain` is a chain key (robinhood, bsc, base, hyperevm, solana) and `token` an
     * address, or a ticker the tracker follows. Resolves with the server's answer even when the map could not be
     * drawn (check `state`, or use `isMapOk`). Throws HoldersApiError on a rate limit, a bad request or no answer.
     */
    async getMap(chain: HolderChain | (string & {}), token: string): Promise<HolderMap> {
      check(chain, token)
      const res = await request(`/api/holders/${chain}/${token}`, 'application/json')
      let body: unknown = null
      try {
        body = await res.json()
      } catch {
        /* not JSON */
      }
      const state = (body as { state?: unknown } | null)?.state
      if (typeof state === 'string' && ['ok', 'unavailable', 'not-found', 'busy', 'error'].includes(state)) return body as HolderMap
      const message = (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`
      throw new HoldersApiError(message, res.status, retryAfter(res))
    },

    /** The holder list as CSV text. Needs a plan that includes it (HoldersApiError 403 otherwise). */
    async getCsv(chain: HolderChain | (string & {}), token: string): Promise<string> {
      check(chain, token)
      const res = await request(`/api/holders/${chain}/${token}.csv`, 'text/csv')
      if (!res.ok) {
        let message = `HTTP ${res.status}`
        try {
          const b = (await res.json()) as { error?: string }
          if (b?.error) message = b.error
        } catch {
          /* not JSON */
        }
        throw new HoldersApiError(message, res.status, retryAfter(res))
      }
      return res.text()
    },

    /** The share card: a 1200 x 630 PNG for any `<img>`, `og:image` or link badge. No request is made. */
    cardUrl(chain: HolderChain | (string & {}), token: string): string {
      check(chain, token)
      return `${base}/api/holders/${chain}/${token}/card.png`
    },

    /** The framed map, for your own iframe. No request is made. */
    embedUrl(chain: HolderChain | (string & {}), token: string): string {
      return embedUrl(chain, token, base)
    },

    /** The full map page on gullylabs.xyz. No request is made. */
    pageUrl(chain: HolderChain | (string & {}), token: string): string {
      check(chain, token)
      return `${base}/holders/${chain}/${token}`
    },

    /** The rate limit the last response reported, or null before the first call. */
    get rateLimit() {
      return rateLimit
    },
  }
}

export type HoldersClient = ReturnType<typeof createHoldersClient>
