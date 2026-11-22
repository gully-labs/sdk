// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { loadTag, mountUnit, unitUrl } from '../src/unit'

const API = 'https://offers.kre8.fun'
const send = (data: unknown, source: unknown, origin = API) => window.dispatchEvent(new MessageEvent('message', { data, source: source as Window, origin }))

afterEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  delete (window as unknown as { Swoop?: unknown }).Swoop
})

describe('unitUrl', () => {
  it('builds the unit page address and drops anything that is not a valid value', () => {
    expect(unitUrl({ spot: 'pk_demo123', unit: 'banner', theme: 'dark' }, 'x1')).toBe(`${API}/widget/unit?id=x1&unit=banner&theme=dark&spot=pk_demo123&slot=watch_rail`)
    const u = new URL(unitUrl({ spot: '"><x', unit: 'zzz' as never, theme: 'neon' as never, slot: 'Bad Slot', baseUrl: 'https://example.test/' }))
    expect(u.origin).toBe('https://example.test')
    expect(u.searchParams.get('unit')).toBe('native')
    expect(u.searchParams.get('theme')).toBe('auto')
    expect(u.searchParams.get('slot')).toBe('home_feed')
    expect(u.searchParams.has('spot')).toBe(false)
  })
})

describe('mountUnit', () => {
  it('adds a sandboxed frame, follows height messages from the unit and ignores anything else', () => {
    const el = document.createElement('div')
    document.body.append(el)
    const states: string[] = []
    const h = mountUnit(el, { spot: 'pk_demo123', unit: 'text', onState: (s) => states.push(s) })!
    expect(h.frame.getAttribute('sandbox')).toContain('allow-scripts')
    expect(h.frame.getAttribute('sandbox')).not.toContain('allow-top-navigation')
    const id = new URL(h.frame.src).searchParams.get('id')
    const win = h.frame.contentWindow
    send({ type: 'swoop:height', id, h: 140 }, win)
    expect(h.frame.style.height).toBe('140px')
    send({ type: 'swoop:height', id, h: 9999 }, win)
    expect(h.frame.style.height).toBe('1200px')
    send({ type: 'swoop:height', id, h: 5 }, win, 'https://evil.example')
    send({ type: 'swoop:height', id, h: 5 }, window)
    send({ type: 'swoop:height', id: 'other', h: 5 }, win)
    expect(h.frame.style.height).toBe('1200px')
    send({ type: 'swoop:state', id, state: 'filled' }, win)
    send({ type: 'swoop:state', id, state: 'viewed' }, win)
    expect(states).toEqual(['filled', 'viewed'])
    send({ type: 'swoop:height', id, h: 0 }, win)
    expect(h.frame.style.display).toBe('none')
    h.destroy()
    expect(el.querySelector('iframe')).toBeNull()
  })

  it('never throws: no element, a throwing callback, a bad base address', () => {
    expect(mountUnit(null)).toBeNull()
    expect(mountUnit({} as HTMLElement)).toBeNull()
    expect(mountUnit(document.createElement('div'), { baseUrl: 'not a url' })).toBeNull()
    const el = document.createElement('div')
    const h = mountUnit(el, {
      onState: () => {
        throw new Error('mine')
      },
    })!
    const id = new URL(h.frame.src).searchParams.get('id')
    expect(() => send({ type: 'swoop:state', id, state: 'filled' }, h.frame.contentWindow)).not.toThrow()
    h.destroy()
  })

  it('stores nothing and sets no cookies', () => {
    const el = document.createElement('div')
    const h = mountUnit(el, { spot: 'pk_demo123' })!
    expect(document.cookie).toBe('')
    expect(localStorage.length).toBe(0)
    h.destroy()
  })
})

describe('loadTag', () => {
  it('injects the hosted tag with an integrity hash when given, and resolves null when it cannot load', async () => {
    const p = loadTag({ integrity: 'sha384-abc' })
    const s = document.head.querySelector('script')!
    expect(s.src).toBe('https://swoopads.xyz/t.js')
    expect(s.integrity).toBe('sha384-abc')
    expect(s.crossOrigin).toBe('anonymous')
    s.onerror?.(new Event('error'))
    expect(await p).toBeNull()
    ;(window as unknown as { Swoop: unknown }).Swoop = { version: '1' }
    expect(await loadTag()).toEqual({ version: '1' })
  })
})
