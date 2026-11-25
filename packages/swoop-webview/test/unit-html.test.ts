// @vitest-environment jsdom
// The one part of swoop-webview that can run here: unit.html. The Swift, Kotlin and C# samples are NOT compiled in this repository.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, '../unit.html'), 'utf8')
const inline = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!

// the page adds a window message listener on every load: remove them between tests
const listeners: [string, EventListenerOrEventListenerObject][] = []
const realAdd = window.addEventListener.bind(window)
window.addEventListener = ((t: string, f: EventListenerOrEventListenerObject, o?: boolean | AddEventListenerOptions) => {
  if (t === 'message') listeners.push([t, f])
  realAdd(t, f, o)
}) as typeof window.addEventListener
afterEach(() => {
  for (const [t, f] of listeners.splice(0)) window.removeEventListener(t, f)
})

function load(bridge: 'ios' | 'android' | 'unity' | 'none', values = { SPOT: 'pk_demo123', UNIT: 'banner', THEME: 'dark', SLOT: '' }) {
  document.head.innerHTML = ''
  document.body.innerHTML = '<div id="swoop"></div>'
  const sent: unknown[] = []
  const w = window as unknown as Record<string, unknown>
  delete w.webkit
  delete w.SwoopBridge
  delete w.Unity
  if (bridge === 'ios') w.webkit = { messageHandlers: { swoop: { postMessage: (s: string) => sent.push(JSON.parse(s)) } } }
  if (bridge === 'android') w.SwoopBridge = { post: (s: string) => sent.push(JSON.parse(s)) }
  if (bridge === 'unity') w.Unity = { call: (s: string) => sent.push(JSON.parse(s)) }
  let code = inline
  for (const [k, v] of Object.entries(values)) code = code.split(`{{${k}}}`).join(v)
  new Function(code)()
  return sent
}
const msg = (data: unknown, origin = 'https://offers.kre8.fun') => window.dispatchEvent(new MessageEvent('message', { data, origin }))

describe('swoop-webview unit.html', () => {
  it('asks for the hosted tag with the values the app filled in, and nothing else', () => {
    load('none')
    const s = document.head.querySelector('script')!
    expect(s.src).toBe('https://swoopads.xyz/t.js')
    expect(s.getAttribute('data-spot')).toBe('pk_demo123')
    expect(s.getAttribute('data-unit')).toBe('banner')
    expect(s.getAttribute('data-theme')).toBe('dark')
    expect(s.getAttribute('data-target')).toBe('#swoop')
    expect(s.hasAttribute('data-slot')).toBe(false)
    expect(html).not.toMatch(/localStorage|document\.cookie|XMLHttpRequest|fetch\(/)
  })
  for (const b of ['ios', 'android', 'unity'] as const) {
    it(`forwards height and state to the ${b} bridge, and ignores other origins and odd messages`, () => {
      const sent = load(b)
      msg({ type: 'swoop:height', id: 'x', h: 120 })
      msg({ type: 'swoop:state', id: 'x', state: 'filled' })
      msg({ type: 'swoop:state', id: 'x', state: 'empty', reason: 'no_fill' })
      msg({ type: 'swoop:height', h: 5 }, 'https://evil.example')
      msg('text')
      msg(null)
      msg({ type: 'other' })
      expect(sent).toEqual([
        { type: 'height', h: 120 },
        { type: 'state', state: 'filled', reason: null },
        { type: 'state', state: 'empty', reason: 'no_fill' },
      ])
    })
  }
  it('says empty (offline) when the tag cannot load, and never throws without a bridge', () => {
    const sent = load('android')
    document.head.querySelector('script')!.dispatchEvent(new Event('error'))
    expect(sent).toEqual([{ type: 'state', state: 'empty', reason: 'offline' }])
    load('none')
    expect(() => msg({ type: 'swoop:height', h: 10 })).not.toThrow()
  })
  it('forwards the exact fitted size from tag 1.1 (swoop:fit) as the height and width to give the view', () => {
    const sent = load('ios')
    msg({ type: 'swoop:fit', id: 'x', w: 320, h: 100 })
    expect(sent).toEqual([{ type: 'height', h: 100, w: 320 }])
  })
  it('caps a huge height at 1200', () => {
    const sent = load('ios')
    msg({ type: 'swoop:height', h: 99999 })
    expect(sent).toEqual([{ type: 'height', h: 1200 }])
  })
})
