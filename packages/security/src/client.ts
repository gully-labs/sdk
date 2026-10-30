// A typed client for the Gully Security API at gullysecurity.xyz. No runtime dependencies; fetch is injectable.
//
// Public reads (CORS open, cached by the server for 30 s, 600 per IP per hour):
//   GET /api/security/reports, /reports/:id, /reports/:id/report.html, /reports/:id/badge.svg
//   GET /api/security/stats, /live, /engine, /offer, /sample, /sample/report.html
//   GET /api/score, /api/score/methodology, /api/score/:chain/:address  (6 computations per IP per minute)
// The visitor's scans (same-origin only on the server: POSTs need `X-Requested-With: gully` and the `gs_v` cookie
// the server sets; so from a browser these work on gullysecurity.xyz itself or through a same-origin proxy, and
// from Node when the cookie jar is carried by hand, see `cookie`):
//   GET|POST /api/security/scans, GET /api/security/scans/:id, /events (SSE), POST /cancel, /publish
//   POST /api/security/review-requests

import { type ChainRef, isAddress, resolveChain, type SecurityChain } from './chains'
import { codeForStatus, GullySecurityError } from './errors'
import type { EngineStatus, GullyScore, LiveFeed, Offer, PublishedReport, Quota, ReportSummary, ReviewRequest, ScanReport, ScanView, ScoreIndex, ScoreMethodology, SecurityStats } from './types'

export const DEFAULT_BASE_URL = 'https://gullysecurity.xyz'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface GullySecurityOptions {
  /** The Gully Security origin; default `https://gullysecurity.xyz`. */
  baseUrl?: string
  /** A fetch implementation; default `globalThis.fetch`. */
  fetch?: FetchLike
  /** Per-request timeout in milliseconds; default 20000. 0 disables it. */
  timeoutMs?: number
  /** Extra headers on every request. */
  headers?: Record<string, string>
  /**
   * Cookie header to send with scan requests (Node only; browsers manage cookies themselves). The server identifies
   * the visitor who owns a scan by its `gs_v` cookie: read it from `setCookie` after `startScan` and pass it back.
   */
  cookie?: string
}

export interface RequestOptions {
  signal?: AbortSignal
  /** Overrides the client's timeout for this call. */
  timeoutMs?: number
}

export type AddressScanInput = { kind: 'address'; chain: ChainRef; address: string }
export type RepoScanInput = { kind: 'github' | 'web2'; repo: string; commit?: string | null; ref?: string | null }
export type UploadScanInput = { kind: 'upload'; upload: { name: string; /** base64 of a .zip of Solidity files or a .sol file */ data: string } }
export type StartScanInput = AddressScanInput | RepoScanInput | UploadScanInput

export interface StartScanOptions extends RequestOptions {
  /** The price you expect (0 for a free scan). The server answers 409 `price-changed` when it differs. */
  expectPriceUsd?: number
}

export interface StartScanResult {
  scan: ScanView
  /** True when an identical scan was already running for this visitor and was returned instead. */
  duplicate: boolean
  /** The `Set-Cookie` header the server sent (the visitor cookie), when readable. Keep it for later calls in Node. */
  setCookie: string | null
}

export interface WaitOptions extends RequestOptions {
  /** Poll interval in milliseconds; default 3000. */
  intervalMs?: number
  /** Give up after this many milliseconds; default 15 minutes. */
  maxWaitMs?: number
  /** Called with every view read while waiting. */
  onUpdate?: (scan: ScanView) => void
}

export interface BadgeUrlOptions {
  size?: 'S' | 'M' | 'L'
  theme?: 'dark' | 'light'
}

const join = (base: string, path: string) => base.replace(/\/+$/, '') + path

export class GullySecurity {
  readonly baseUrl: string
  private readonly fetchFn: FetchLike
  private readonly timeoutMs: number
  private readonly headers: Record<string, string>
  cookie: string | null

  constructor(options: GullySecurityOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    const f = options.fetch ?? (globalThis.fetch as FetchLike | undefined)
    if (typeof f !== 'function') throw new GullySecurityError('No fetch available: pass one in options.fetch.', { code: 'invalid-input' })
    this.fetchFn = f
    this.timeoutMs = options.timeoutMs ?? 20_000
    this.headers = { ...(options.headers ?? {}) }
    this.cookie = options.cookie ?? null
  }

  /* ------------------------------------------------------------ URLs --- */

  /** The public page of a published report. */
  reportUrl(id: string): string {
    return `${this.baseUrl}/reports/${encodeURIComponent(id)}`
  }
  /** The print-ready HTML of a published report. */
  reportHtmlUrl(id: string): string {
    return `${this.baseUrl}/api/security/reports/${encodeURIComponent(id)}/report.html`
  }
  /** The server-drawn "GullySecurity | Scanned <date>" SVG for a published report. */
  reportBadgeUrl(id: string, opts: BadgeUrlOptions = {}): string {
    return `${this.baseUrl}/api/security/reports/${encodeURIComponent(id)}/badge.svg${query(opts)}`
  }
  /** The Gully Score page of a contract. */
  scoreUrl(chain: ChainRef, address: string): string {
    const c = this.chain(chain)
    return `${this.baseUrl}/score/${c.key}/${address.toLowerCase()}`
  }
  /** The server-drawn "Gully Score | 82 Strong" SVG (shows the stored score; a page view computes it first). */
  scoreBadgeUrl(chain: ChainRef, address: string, opts: BadgeUrlOptions = {}): string {
    const c = this.chain(chain)
    return `${this.baseUrl}/score/${c.key}/${address.toLowerCase()}/badge.svg${query(opts)}`
  }

  /* ------------------------------------------------------- public reads --- */

  /** Published reports, newest first (at most 200). */
  async listReports(opts: RequestOptions = {}): Promise<ReportSummary[]> {
    const r = await this.json<{ reports: ReportSummary[] }>('GET', '/api/security/reports', opts)
    return r.reports
  }

  /** One published report (404 `not-found` unless published). */
  async getReport(id: string, opts: RequestOptions = {}): Promise<PublishedReport> {
    const r = await this.json<{ report: PublishedReport }>('GET', `/api/security/reports/${encodeURIComponent(id)}`, opts)
    return r.report
  }

  /** The published reports on a deployed contract, newest first (filtered from `listReports`). */
  async findReports(chain: ChainRef, address: string, opts: RequestOptions = {}): Promise<ReportSummary[]> {
    const c = this.chain(chain)
    const a = this.address(address)
    return (await this.listReports(opts)).filter((r) => r.input.kind === 'address' && r.input.chain === c.key && r.input.address === a)
  }

  /** Real counts: scans per day (30 days), findings by severity, scans per chain, totals. */
  stats(opts: RequestOptions = {}): Promise<SecurityStats> {
    return this.json('GET', '/api/security/stats', opts)
  }

  /** The last 30 scans as the live feed shows them (no ids, no code). */
  live(opts: RequestOptions = {}): Promise<LiveFeed> {
    return this.json('GET', '/api/security/live', opts)
  }

  /** What the engine can run right now (AI review, static tools, queue) with its uptime history. */
  engine(opts: RequestOptions = {}): Promise<EngineStatus> {
    return this.json('GET', '/api/security/engine', opts)
  }

  /** The tiers, prices, free quota, chains and checkout state (with the caller's quota when the cookie is sent). */
  offer(opts: RequestOptions = {}): Promise<Offer> {
    return this.json('GET', '/api/security/offer', opts, { cookie: true })
  }

  /** The SAMPLE report on a fictional contract (`sample: true`). */
  async sample(opts: RequestOptions = {}): Promise<ScanReport & { sample: true }> {
    const r = await this.json<{ report: ScanReport & { sample: true } }>('GET', '/api/security/sample', opts)
    return r.report
  }

  /* ------------------------------------------------------- Gully Score --- */

  /** The listed scores, best first, with the chains and the methodology. */
  scoreIndex(opts: RequestOptions = {}): Promise<ScoreIndex> {
    return this.json('GET', '/api/score', opts)
  }

  /** The components, weights, sources and rules of the Gully Score. */
  scoreMethodology(opts: RequestOptions = {}): Promise<ScoreMethodology> {
    return this.json('GET', '/api/score/methodology', opts)
  }

  /**
   * One contract's Gully Score, computed when missing or older than 6 hours (6 computations per IP per minute;
   * beyond that a stored score comes back `stale: true`, or 429 `rate-limited` when there is none).
   * 404 `not-found` when there is no contract at the address.
   */
  async score(chain: ChainRef, address: string, opts: RequestOptions = {}): Promise<GullyScore> {
    const c = this.chain(chain)
    const a = this.address(address)
    return this.json('GET', `/api/score/${c.key}/${a}`, opts)
  }

  /* --------------------------------------------------- the visitor's scans --- */

  /**
   * Starts an AI Security Scan. Free up to the daily quota (2 a day by default); beyond it the server answers
   * 402 `checkout-off` (paid scans are not on sale yet; nothing is charged). 429 `too-many-active` while one of
   * this visitor's scans still runs. Same-origin only on the server (see the file header).
   */
  async startScan(input: StartScanInput, opts: StartScanOptions = {}): Promise<StartScanResult> {
    const body: Record<string, unknown> = { input: this.normaliseInput(input) }
    if (input.kind === 'upload') body.upload = input.upload
    if (opts.expectPriceUsd !== undefined) body.expect = { priceUsd: opts.expectPriceUsd }
    const { data, response } = await this.request<{ scan: ScanView & { duplicate?: boolean } }>('POST', '/api/security/scans', opts, { body, cookie: true })
    const setCookie = readSetCookie(response)
    if (setCookie && !this.cookie) this.cookie = setCookie.split(';')[0]
    return { scan: data.scan, duplicate: !!data.scan.duplicate || response.status === 200, setCookie }
  }

  /** This visitor's scans, newest first, with the quota. */
  listScans(opts: RequestOptions = {}): Promise<{ scans: ScanView[]; quota: Quota }> {
    return this.json('GET', '/api/security/scans', opts, { cookie: true })
  }

  /** One of this visitor's scans, with its report once done (404 `not-found` for another visitor's scan). */
  async getScan(id: string, opts: RequestOptions = {}): Promise<ScanView> {
    const r = await this.json<{ scan: ScanView }>('GET', `/api/security/scans/${encodeURIComponent(id)}`, opts, { cookie: true })
    return r.scan
  }

  /** The print-ready HTML of one of this visitor's scans (404 until it has a report). */
  async getScanHtml(id: string, opts: RequestOptions = {}): Promise<string> {
    const { response } = await this.request<unknown>('GET', `/api/security/scans/${encodeURIComponent(id)}/report.html`, opts, { cookie: true, raw: true })
    return response.text()
  }

  /** Polls `getScan` until the scan is done, failed or cancelled. */
  async waitForScan(id: string, opts: WaitOptions = {}): Promise<ScanView> {
    const interval = Math.max(500, opts.intervalMs ?? 3_000)
    const deadline = Date.now() + (opts.maxWaitMs ?? 15 * 60_000)
    for (;;) {
      const scan = await this.getScan(id, opts)
      opts.onUpdate?.(scan)
      if (scan.status === 'done' || scan.status === 'failed' || scan.status === 'cancelled') return scan
      if (Date.now() + interval > deadline) throw new GullySecurityError(`Scan ${id} did not finish within the wait limit.`, { code: 'timeout' })
      await sleep(interval, opts.signal)
    }
  }

  /** Cancels a running scan (409 `conflict` when it has already finished). */
  async cancelScan(id: string, opts: RequestOptions = {}): Promise<ScanView> {
    const r = await this.json<{ scan: ScanView }>('POST', `/api/security/scans/${encodeURIComponent(id)}/cancel`, opts, { body: {}, cookie: true })
    return r.scan
  }

  /**
   * Publishes (or unpublishes) a finished scan's report at `/reports/<id>`. A snapshot without draft PoC code goes
   * public; `indexable` lets search engines index it. 409 `conflict` unless the scan is done with a report.
   */
  async publishScan(id: string, published: boolean, opts: RequestOptions & { indexable?: boolean } = {}): Promise<ScanView> {
    const body: Record<string, unknown> = { published }
    if (published && opts.indexable !== undefined) body.indexable = opts.indexable
    const r = await this.json<{ scan: ScanView }>('POST', `/api/security/scans/${encodeURIComponent(id)}/publish`, opts, { body, cookie: true })
    return r.scan
  }

  /** Asks for a human Security Review (or an Audit) quote. 5 per IP per hour, 3 per email per day. */
  async requestReview(req: ReviewRequest, opts: RequestOptions = {}): Promise<{ id: string; tier: 'review' | 'audit'; status: string }> {
    const r = await this.json<{ request: { id: string; tier: 'review' | 'audit'; status: string } }>('POST', '/api/security/review-requests', opts, { body: req })
    return r.request
  }

  /* ---------------------------------------------------------- internals --- */

  private chain(ref: ChainRef): SecurityChain {
    const c = resolveChain(ref)
    if (!c) throw new GullySecurityError(`Unknown chain "${String(ref)}". Gully Security covers: ethereum, base, arbitrum, optimism, polygon, bnb, avalanche, gully (485590).`, { code: 'invalid-input' })
    return c
  }

  private address(a: string): string {
    if (!isAddress(a)) throw new GullySecurityError('The contract address must be 0x followed by 40 hex characters.', { code: 'invalid-input' })
    return a.toLowerCase()
  }

  private normaliseInput(input: StartScanInput): Record<string, unknown> {
    if (input.kind === 'address') return { kind: 'address', chain: this.chain(input.chain).key, address: this.address(input.address) }
    if (input.kind === 'github' || input.kind === 'web2') {
      if (typeof input.repo !== 'string' || !input.repo.trim()) throw new GullySecurityError('Give a public GitHub repository as owner/name or its URL.', { code: 'invalid-input' })
      return { kind: input.kind, repo: input.repo.trim(), ...(input.commit ? { commit: input.commit } : {}), ...(input.ref ? { ref: input.ref } : {}) }
    }
    if (input.kind === 'upload') {
      if (!input.upload || typeof input.upload.name !== 'string' || typeof input.upload.data !== 'string') throw new GullySecurityError('An upload needs { name, data } with data as base64.', { code: 'invalid-input' })
      return { kind: 'upload' }
    }
    throw new GullySecurityError('Pick what to scan: address, github, upload or web2.', { code: 'invalid-input' })
  }

  private async json<T>(method: 'GET' | 'POST', path: string, opts: RequestOptions, extra: { body?: unknown; cookie?: boolean } = {}): Promise<T> {
    return (await this.request<T>(method, path, opts, extra)).data
  }

  private async request<T>(method: 'GET' | 'POST', path: string, opts: RequestOptions, extra: { body?: unknown; cookie?: boolean; raw?: boolean } = {}): Promise<{ data: T; response: Response }> {
    const headers: Record<string, string> = { accept: extra.raw ? 'text/html, */*' : 'application/json', ...this.headers }
    if (method === 'POST') {
      headers['content-type'] = 'application/json'
      headers['x-requested-with'] = 'gully'
    }
    if (extra.cookie && this.cookie) headers.cookie = this.cookie
    const { signal, cleanup } = withTimeout(opts.signal, opts.timeoutMs ?? this.timeoutMs)
    let response: Response
    try {
      response = await this.fetchFn(join(this.baseUrl, path), { method, headers, signal, ...(extra.body !== undefined ? { body: JSON.stringify(extra.body) } : {}) })
    } catch (e) {
      cleanup()
      if (opts.signal?.aborted) throw new GullySecurityError('The request was aborted.', { code: 'aborted', cause: e })
      if ((e as { name?: string })?.name === 'AbortError' || (e as { name?: string })?.name === 'TimeoutError') throw new GullySecurityError(`The request to ${path} timed out.`, { code: 'timeout', cause: e })
      throw new GullySecurityError(`Gully Security could not be reached (${(e as Error)?.message ?? e}).`, { code: 'network', cause: e })
    }
    cleanup()
    if (extra.raw) {
      if (!response.ok) throw await errorFrom(response, path)
      return { data: undefined as T, response }
    }
    let data: unknown
    const text = await response.text()
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      throw new GullySecurityError(`Gully Security answered ${response.status} with a body that is not JSON.`, { code: 'bad-response', status: response.status, body: text.slice(0, 500) })
    }
    if (!response.ok) throw errorFromBody(response, data, path)
    if (data === null || typeof data !== 'object') throw new GullySecurityError(`Gully Security answered ${response.status} with an unexpected body.`, { code: 'bad-response', status: response.status, body: data })
    return { data: data as T, response }
  }
}

/** Shorthand: `createClient({ baseUrl })`. */
export const createClient = (options?: GullySecurityOptions) => new GullySecurity(options)

/* -------------------------------------------------------------- helpers --- */

function query(opts: BadgeUrlOptions): string {
  const p = new URLSearchParams()
  if (opts.size) p.set('size', opts.size)
  if (opts.theme) p.set('theme', opts.theme)
  const s = p.toString()
  return s ? `?${s}` : ''
}

function readSetCookie(response: Response): string | null {
  try {
    return response.headers?.get?.('set-cookie') ?? null
  } catch {
    return null
  }
}

async function errorFrom(response: Response, path: string): Promise<GullySecurityError> {
  let data: unknown = null
  try {
    const t = await response.text()
    data = t ? JSON.parse(t) : null
  } catch {
    /* not JSON */
  }
  return errorFromBody(response, data, path)
}

function errorFromBody(response: Response, data: unknown, path: string): GullySecurityError {
  const d = (data && typeof data === 'object' ? data : {}) as { error?: unknown; code?: unknown; quota?: Quota }
  const code = typeof d.code === 'string' && d.code ? d.code : codeForStatus(response.status)
  const message = typeof d.error === 'string' && d.error ? d.error : `Gully Security answered ${response.status} for ${path}.`
  const ra = Number(response.headers?.get?.('retry-after'))
  return new GullySecurityError(message, { code, status: response.status, body: data, quota: d.quota ?? null, retryAfterSec: Number.isFinite(ra) && ra > 0 ? ra : null })
}

function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal | undefined; cleanup: () => void } {
  if (!ms || ms <= 0) return { signal, cleanup: () => {} }
  if (typeof AbortController === 'undefined') return { signal, cleanup: () => {} }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(new DOMExceptionLike('The request timed out.', 'TimeoutError')), ms)
  const onAbort = () => ctl.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: ctl.signal,
    cleanup: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

class DOMExceptionLike extends Error {
  constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new GullySecurityError('The wait was aborted.', { code: 'aborted' }))
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new GullySecurityError('The wait was aborted.', { code: 'aborted' }))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
