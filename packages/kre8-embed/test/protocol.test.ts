import { describe, expect, it } from 'vitest'
import { acceptEmbedEvent, isSafeOpenHref, parseEmbedMessage } from '../src/protocol'

const NONCE = 'abcdefgh12345678'
const msg = (extra: Record<string, unknown>) => ({ kre8: 1, v: 1, nonce: NONCE, ...extra })

describe('parseEmbedMessage', () => {
  it('accepts the four shapes', () => {
    expect(parseEmbedMessage(msg({ type: 'ready', kind: 'coin', id: '0xabc', height: 230.2 }), NONCE)).toEqual({ type: 'ready', kind: 'coin', id: '0xabc', height: 231 })
    expect(parseEmbedMessage(msg({ type: 'ready', kind: 'unavailable', id: '', height: 120 }), NONCE)).toEqual({ type: 'ready', kind: 'unavailable', id: '', height: 120 })
    expect(parseEmbedMessage(msg({ type: 'resize', height: 300 }), NONCE)).toEqual({ type: 'resize', height: 300 })
    expect(parseEmbedMessage(msg({ type: 'open', href: 'https://kre8.fun/token/0x1' }), NONCE)).toEqual({ type: 'open', href: 'https://kre8.fun/token/0x1' })
    expect(parseEmbedMessage(msg({ type: 'error', message: 'nope' }), NONCE)).toEqual({ type: 'error', message: 'nope' })
  })
  it('rejects the wrong nonce, version, marker, type or field types', () => {
    expect(parseEmbedMessage(msg({ type: 'resize', height: 300, nonce: 'other_nonce_1234' }), NONCE)).toBeNull()
    expect(parseEmbedMessage({ ...msg({ type: 'resize', height: 300 }), v: 2 }, NONCE)).toBeNull()
    expect(parseEmbedMessage({ ...msg({ type: 'resize', height: 300 }), kre8: true }, NONCE)).toBeNull()
    expect(parseEmbedMessage(msg({ type: 'navigate', url: 'x' }), NONCE)).toBeNull()
    expect(parseEmbedMessage(msg({ type: 'resize', height: '300' }), NONCE)).toBeNull()
    expect(parseEmbedMessage(msg({ type: 'resize', height: 0 }), NONCE)).toBeNull()
    expect(parseEmbedMessage(msg({ type: 'resize', height: 99999 }), NONCE)).toBeNull()
    expect(parseEmbedMessage(msg({ type: 'ready', kind: 'wallet', id: 'x', height: 10 }), NONCE)).toBeNull()
    expect(parseEmbedMessage(msg({ type: 'open', href: 'x'.repeat(3000) }), NONCE)).toBeNull()
    expect(parseEmbedMessage(msg({ type: 'error', message: 5 }), NONCE)).toBeNull()
    expect(parseEmbedMessage('string', NONCE)).toBeNull()
    expect(parseEmbedMessage(null, NONCE)).toBeNull()
    expect(parseEmbedMessage([msg({ type: 'resize', height: 1 })], NONCE)).toBeNull()
  })
})

describe('acceptEmbedEvent', () => {
  const data = msg({ type: 'resize', height: 200 })
  it('needs the exact embed origin', () => {
    expect(acceptEmbedEvent({ origin: 'https://kre8.fun', data }, 'https://kre8.fun', NONCE)).toEqual({ type: 'resize', height: 200 })
    expect(acceptEmbedEvent({ origin: 'https://kre8.fun.evil.example', data }, 'https://kre8.fun', NONCE)).toBeNull()
    expect(acceptEmbedEvent({ origin: 'http://kre8.fun', data }, 'https://kre8.fun', NONCE)).toBeNull()
    expect(acceptEmbedEvent({ origin: 'null', data }, 'https://kre8.fun', NONCE)).toBeNull()
    expect(acceptEmbedEvent({ origin: 'https://www.kre8.fun', data }, 'https://kre8.fun', NONCE)).toBeNull()
  })
  it('needs this instance nonce and, when known, the iframe window as source', () => {
    expect(acceptEmbedEvent({ origin: 'https://kre8.fun', data }, 'https://kre8.fun', 'another_nonce_12')).toBeNull()
    const frameWindow = {}
    expect(acceptEmbedEvent({ origin: 'https://kre8.fun', data, source: frameWindow }, 'https://kre8.fun', NONCE, frameWindow)).not.toBeNull()
    expect(acceptEmbedEvent({ origin: 'https://kre8.fun', data, source: {} }, 'https://kre8.fun', NONCE, frameWindow)).toBeNull()
  })
})

describe('isSafeOpenHref', () => {
  it('only kre8 pages on the embed origin', () => {
    expect(isSafeOpenHref('https://kre8.fun/s/t/0x1?utm_source=embed', 'https://kre8.fun')).toBe(true)
    expect(isSafeOpenHref('https://evil.example/kre8.fun', 'https://kre8.fun')).toBe(false)
    expect(isSafeOpenHref('javascript:alert(1)', 'https://kre8.fun')).toBe(false)
    expect(isSafeOpenHref('//kre8.fun/x', 'https://kre8.fun')).toBe(false)
    expect(isSafeOpenHref('https://kre8.fun@evil.example/', 'https://kre8.fun')).toBe(false)
  })
})
