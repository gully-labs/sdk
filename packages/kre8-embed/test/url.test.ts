import { describe, expect, it } from 'vitest'
import { ALLOWED_EMBED_ORIGINS, DEFAULT_EMBED_ORIGIN, isDevOrigin, originOf, resolveEmbedOrigin } from '../src/origins'
import { backUrl, buildEmbedSrc, coinUrl, EMBED_SIZE, isCreatorRef, isValidEmbedId, kitIconUrl, newNonce } from '../src/url'

const COIN = '0x' + 'Ab'.repeat(20)

describe('embed origins', () => {
  it('defaults to kre8.fun and accepts only the allowlist', () => {
    expect(resolveEmbedOrigin()).toBe(DEFAULT_EMBED_ORIGIN)
    expect(resolveEmbedOrigin({ origin: '' })).toBe('https://kre8.fun')
    expect(resolveEmbedOrigin({ origin: 'https://kre8.fun/' })).toBe('https://kre8.fun')
    expect(resolveEmbedOrigin({ origin: 'https://app.gullychain.xyz/embed/x' })).toBe('https://app.gullychain.xyz')
    for (const o of ALLOWED_EMBED_ORIGINS) expect(resolveEmbedOrigin({ origin: o })).toBe(o)
    expect(() => resolveEmbedOrigin({ origin: 'https://evil.example' })).toThrow(/origin must be one of/)
    expect(() => resolveEmbedOrigin({ origin: 'https://kre8.fun.evil.example' })).toThrow()
    expect(() => resolveEmbedOrigin({ origin: 'http://kre8.fun' })).toThrow()
    expect(() => resolveEmbedOrigin({ origin: 'javascript:alert(1)' })).toThrow()
  })
  it('dev override: http localhost / 127.0.0.1 or https only, and it must be explicit', () => {
    expect(resolveEmbedOrigin({ devOrigin: 'http://localhost:5173/' })).toBe('http://localhost:5173')
    expect(resolveEmbedOrigin({ devOrigin: 'http://127.0.0.1:4361' })).toBe('http://127.0.0.1:4361')
    expect(resolveEmbedOrigin({ devOrigin: 'https://staging.example' })).toBe('https://staging.example')
    expect(() => resolveEmbedOrigin({ devOrigin: 'http://evil.example' })).toThrow(/dev origin/)
    expect(() => resolveEmbedOrigin({ devOrigin: 'file:///x' })).toThrow()
    expect(isDevOrigin('http://localhost:3000')).toBe(true)
    expect(isDevOrigin('http://localhost:3000/')).toBe(false) // not an origin
    expect(originOf('ftp://x')).toBeNull()
    expect(originOf('https://kre8.fun/a?b')).toBe('https://kre8.fun')
  })
})

describe('buildEmbedSrc', () => {
  const nonce = 'n0nce_12345678'
  it('builds the page URL with the parent origin and nonce, encoded', () => {
    const src = buildEmbedSrc({ kind: 'coin', id: COIN, embedOrigin: 'https://kre8.fun', parentOrigin: 'https://blog.example', nonce })
    expect(src).toBe(`https://kre8.fun/embed/coin/${COIN.toLowerCase()}?origin=https%3A%2F%2Fblog.example&nonce=${nonce}`)
    const t = buildEmbedSrc({ kind: 'track', id: 'trk_ab12CD34', embedOrigin: 'https://kre8.fun', parentOrigin: 'http://localhost:8080', nonce })
    expect(t).toBe(`https://kre8.fun/embed/track/trk_ab12CD34?origin=http%3A%2F%2Flocalhost%3A8080&nonce=${nonce}`)
    expect(buildEmbedSrc({ kind: 'live', id: 'live1', embedOrigin: 'https://app.gullychain.xyz', parentOrigin: 'https://a.b', nonce })).toContain('/embed/live/live1?')
  })
  it('refuses bad ids, nonces and parent origins instead of guessing', () => {
    expect(() => buildEmbedSrc({ kind: 'coin', id: 'frog', embedOrigin: 'https://kre8.fun', parentOrigin: 'https://a.b', nonce })).toThrow(/invalid coin id/)
    expect(() => buildEmbedSrc({ kind: 'track', id: 'short', embedOrigin: 'https://kre8.fun', parentOrigin: 'https://a.b', nonce })).toThrow(/invalid track id/)
    expect(() => buildEmbedSrc({ kind: 'video', id: '../x', embedOrigin: 'https://kre8.fun', parentOrigin: 'https://a.b', nonce })).toThrow()
    expect(() => buildEmbedSrc({ kind: 'coin', id: COIN, embedOrigin: 'https://kre8.fun', parentOrigin: 'https://a.b', nonce: 'short' })).toThrow(/nonce/)
    expect(() => buildEmbedSrc({ kind: 'coin', id: COIN, embedOrigin: 'https://kre8.fun', parentOrigin: 'https://a.b/path', nonce })).toThrow(/parent origin/)
    expect(() => buildEmbedSrc({ kind: 'coin', id: COIN, embedOrigin: 'https://kre8.fun', parentOrigin: 'null', nonce })).toThrow(/parent origin/)
    expect(() => buildEmbedSrc({ kind: 'drop' as never, id: 'x', embedOrigin: 'https://kre8.fun', parentOrigin: 'https://a.b', nonce })).toThrow(/unknown kind/)
  })
  it('id rules follow the server', () => {
    expect(isValidEmbedId('coin', COIN)).toBe(true)
    expect(isValidEmbedId('track', 'a'.repeat(8))).toBe(true)
    expect(isValidEmbedId('track', 'a'.repeat(25))).toBe(false)
    expect(isValidEmbedId('short', 'x')).toBe(true)
    expect(isValidEmbedId('video', 'a b')).toBe(false)
    expect(isCreatorRef('alice')).toBe(true)
    expect(isCreatorRef('@alice.gully')).toBe(true)
    expect(isCreatorRef(COIN)).toBe(true)
    expect(isCreatorRef('a/b')).toBe(false)
    expect(EMBED_SIZE.short).toEqual({ width: 360, height: 640 })
  })
  it('nonces are 16 url-safe chars and differ', () => {
    const a = newNonce()
    expect(a).toMatch(/^[A-Za-z0-9_-]{16}$/)
    expect(newNonce()).not.toBe(a)
  })
})

describe('kre8 links', () => {
  it('coin, back and kit asset URLs stay on the embed origin', () => {
    expect(coinUrl('https://kre8.fun', COIN)).toBe(`https://kre8.fun/token/${COIN.toLowerCase()}?utm_source=embed&utm_medium=embed&utm_campaign=kre8-embed&utm_content=coin`)
    expect(backUrl('https://kre8.fun', '@Alice.gully')).toBe('https://kre8.fun/@alice?utm_source=embed&utm_medium=embed&utm_campaign=kre8-embed&utm_content=back')
    expect(backUrl('https://kre8.fun', 'alice')).toContain('/@alice?')
    expect(backUrl('https://kre8.fun', COIN)).toBe(`https://kre8.fun/address/${COIN.toLowerCase()}?utm_source=embed&utm_medium=embed&utm_campaign=kre8-embed&utm_content=back`)
    expect(() => backUrl('https://kre8.fun', 'not valid!')).toThrow()
    expect(kitIconUrl('https://kre8.fun')).toBe('https://kre8.fun/embed/brand/kre8-icon-128.png')
  })
})
