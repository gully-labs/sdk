import type { Quota } from './types'

/**
 * Codes the server sends (`code` in the JSON error body), plus the client's own:
 *   checkout-off        free scans for today are used; paid scans are not on sale yet (402, nothing charged)
 *   price-changed       the price moved between asking and confirming (409, `quota` attached)
 *   too-many-active     a scan from this visitor is still running (429)
 *   engine-unavailable  the scan engine cannot run that kind of scan right now (503)
 *   rate-limited        any other 429
 *   not-found, invalid-request, forbidden, conflict, gone, too-large, server-error   by HTTP status
 *   invalid-input       rejected by the client before anything was sent
 *   network, timeout, aborted, bad-response   transport problems
 */
export type GullySecurityErrorCode =
  | 'checkout-off'
  | 'price-changed'
  | 'too-many-active'
  | 'engine-unavailable'
  | 'rate-limited'
  | 'not-found'
  | 'invalid-request'
  | 'payment-required'
  | 'forbidden'
  | 'conflict'
  | 'gone'
  | 'too-large'
  | 'server-error'
  | 'http-error'
  | 'invalid-input'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'bad-response'
  | (string & {})

export interface GullySecurityErrorInit {
  code: GullySecurityErrorCode
  status?: number | null
  body?: unknown
  quota?: Quota | null
  retryAfterSec?: number | null
  cause?: unknown
}

export class GullySecurityError extends Error {
  readonly code: GullySecurityErrorCode
  /** HTTP status, or null when no response arrived (network, timeout, aborted, invalid-input). */
  readonly status: number | null
  /** The parsed response body, when there was one. */
  readonly body: unknown
  /** The visitor's quota, sent with checkout-off and price-changed. */
  readonly quota: Quota | null
  /** Seconds from a Retry-After header, when the server sent one. */
  readonly retryAfterSec: number | null

  constructor(message: string, init: GullySecurityErrorInit) {
    super(message)
    this.name = 'GullySecurityError'
    this.code = init.code
    this.status = init.status ?? null
    this.body = init.body
    this.quota = init.quota ?? null
    this.retryAfterSec = init.retryAfterSec ?? null
    if (init.cause !== undefined) (this as { cause?: unknown }).cause = init.cause
  }
}

export const isGullySecurityError = (e: unknown): e is GullySecurityError => e instanceof GullySecurityError

const BY_STATUS: Record<number, GullySecurityErrorCode> = {
  400: 'invalid-request',
  402: 'payment-required',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  410: 'gone',
  413: 'too-large',
  429: 'rate-limited',
}

export function codeForStatus(status: number): GullySecurityErrorCode {
  return BY_STATUS[status] ?? (status >= 500 ? 'server-error' : 'http-error')
}
