// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gate, refusal, sizesFor, UNIT_SIZES } from '../src/rules'
import { loadTag, mountUnit, unitUrl } from '../src/unit'

const API = 'https://offers.kre8.fun'
const send = (data: unknown, source: unknown, origin = API) => window.dispatchEvent(new MessageEvent('message', { data, source: source as Window, origin }))
const tick = () => new Promise((r) => setTimeout(r, 30))

/** jsdom draws nothing: every element is `width` wide; each unit box sits at a top we choose (default below the fold). */
const tops = new Map<Element, number>()
function layout({ width = 800, inner = 700, innerW = 1280, top = 2000 } = {}) {
  tops.clear()
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width })
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const t = tops.has(this) ? tops.get(this)! : top
    const h = parseFloat(this.style.height) || 0
    return { top: t, bottom: t + h, left: 0, right: width, width, height: h, x: 0, y: t, toJSON() {} } as DOMRect
  }
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: inner })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: innerW })
}
const boxOf = (el: Element) => el.querySelector('iframe')!.parentElement as HTMLElement
const idOf = (f: HTMLIFrameElement) => new URL(f.src).searchParams.get('id')

beforeEach(() => layout())
afterEach(() => {
  for (const u of [...gate._units]) gate.remove(u)
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  delete (window as unknown as { Swoop?: unknown }).Swoop
})

describe('rules', () => {
  it('lists the same sizes as the unit page and picks the biggest that fits', () => {
    expect(UNIT_SIZES.text).toEqual(['728x90', '480x120', '320x140'])
    expect(sizesFor('banner', 500)).toEqual([[468, 60], [320, 100], [320, 50], [300, 250]])
    expect(sizesFor('native', 400)).toEqual([[320, 140]])
    expect(sizesFor('text', 800, '480x120')).toEqual([[480, 120]])
    expect(sizesFor('text', 290)).toEqual([])
  })
  it('refuses forms, form areas, fixed and sticky containers and your own selector', () => {
    document.body.innerHTML = '<div id="a"></div>'
    const a = document.getElementById('a')!
    expect(refusal(a)).toBeNull()
    expect(refusal(a, { page: 'checkout' })).toBe('money_page')
    expect(refusal(a, { page: 'login' })).toBe('sign_in_page')
    document.body.insertAdjacentHTML('beforeend', '<div class="cart"></div>')
    expect(refusal(a, { block: '.cart' })).toBe('form_on_page')
    document.body.insertAdjacentHTML('beforeend', '<input type="password">')
    expect(refusal(a)).toBe('form_on_page')
    document.body.innerHTML = '<form><div id="b"></div></form><div style="position:sticky"><div id="c"></div></div>'
    expect(refusal(document.getElementById('b')!)).toBe('form_area')
    expect(refusal(document.getElementById('c')!)).toBe('overlay_position')
  })
})

describe('unitUrl', () => {
  it('builds the unit page address with the space, the size and the page path in the fragment', () => {
    expect(unitUrl({ spot: 'pk_demo123', unit: 'banner', theme: 'dark', size: '728x90' }, 'x1', 800, '/post/1')).toBe(`${API}/widget/unit?id=x1&aw=800&unit=banner&theme=dark&size=728x90&spot=pk_demo123&slot=watch_rail#loc=%2Fpost%2F1`)
    const u = new URL(unitUrl({ spot: '"><x', unit: 'zzz' as never, theme: 'neon' as never, slot: 'Bad Slot', size: 'big', baseUrl: 'https://example.test/' }))
    expect(u.origin).toBe('https://example.test')
    expect(u.searchParams.get('unit')).toBe('native')
    expect(u.searchParams.get('theme')).toBe('auto')
    expect(u.searchParams.get('slot')).toBe('home_feed')
    expect(u.searchParams.has('spot')).toBe(false)
    expect(u.searchParams.has('size')).toBe(false)
  })
})

describe('mountUnit', () => {
  it('a hidden zero-height sandboxed frame that opens at the exact fitted size only while off screen', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    const states: string[] = []
    const h = mountUnit(el, { spot: 'pk_demo123', unit: 'text', onState: (s) => states.push(s) })!
    expect(h.frame.getAttribute('sandbox')).toContain('allow-scripts')
    expect(h.frame.getAttribute('sandbox')).not.toContain('allow-top-navigation')
    expect(h.frame.getAttribute('allow')).toBe("autoplay 'none'")
    expect(new URL(h.frame.src).searchParams.get('aw')).toBe('800')
    const box = boxOf(el)
    expect(box.style.height).toBe('0px')
    tops.set(box, 100) // in view
    const id = idOf(h.frame)
    const win = h.frame.contentWindow
    send({ type: 'swoop:fit', id, w: 728, h: 90 }, win, 'https://evil.example')
    send({ type: 'swoop:fit', id, w: 728, h: 90 }, window)
    send({ type: 'swoop:fit', id: 'other', w: 728, h: 90 }, win)
    send({ type: 'swoop:fit', id, w: 728, h: 90 }, win)
    await tick()
    expect(box.style.height).toBe('0px') // in view: opening would push the page
    tops.set(box, 1500)
    window.dispatchEvent(new Event('scroll'))
    await tick()
    expect(box.style.height).toBe('90px')
    expect(box.style.width).toBe('728px')
    expect(h.frame.style.visibility).toBe('visible')
    send({ type: 'swoop:state', id, state: 'viewed' }, win)
    expect(states).toEqual(['waiting', 'filled', 'viewed'])
    send({ type: 'swoop:state', id, state: 'empty', reason: 'hidden' }, win)
    expect(box.style.display).toBe('none')
    expect(el.getAttribute('data-swoop-reason')).toBe('hidden')
    h.destroy()
    expect(el.querySelector('iframe')).toBeNull()
  })

  it('a size the space cannot hold is not drawn; a phone shows one unit per screen', async () => {
    const a = document.createElement('div')
    document.body.append(a)
    const h = mountUnit(a, { unit: 'banner' })!
    send({ type: 'swoop:fit', id: idOf(h.frame), w: 970, h: 250 }, h.frame.contentWindow) // wider than 800
    await tick()
    expect(a.getAttribute('data-swoop-reason')).toBe('size_mismatch')
    h.destroy()

    layout({ width: 360, innerW: 390 })
    const [x, y] = [document.createElement('div'), document.createElement('div')]
    document.body.append(x, y)
    const hx = mountUnit(x, { unit: 'text' })!
    const hy = mountUnit(y, { unit: 'text' })!
    tops.set(boxOf(x), 900)
    tops.set(boxOf(y), 1300)
    send({ type: 'swoop:fit', id: idOf(hx.frame), w: 320, h: 140 }, hx.frame.contentWindow)
    send({ type: 'swoop:fit', id: idOf(hy.frame), w: 320, h: 140 }, hy.frame.contentWindow)
    await tick()
    expect(boxOf(x).style.height).toBe('140px')
    expect(boxOf(y).style.height).toBe('0px')
  })

  it('draws nothing on a form page, in a form, in a sticky bar, or in a space narrower than the smallest size', () => {
    for (const [html, reason] of [
      ['<input type="email"><div id="a"></div>', 'form_on_page'],
      ['<form><div id="a"></div></form>', 'form_area'],
      ['<div style="position:fixed"><div id="a"></div></div>', 'overlay_position'],
    ]) {
      document.body.innerHTML = html
      const el = document.getElementById('a')!
      expect(mountUnit(el)).toBeNull()
      expect(el.getAttribute('data-swoop-reason')).toBe(reason)
    }
    document.body.innerHTML = '<div id="a"></div>'
    expect(mountUnit(document.getElementById('a')!, { page: 'claim' })).toBeNull()
    layout({ width: 250 })
    expect(mountUnit(document.getElementById('a')!)).toBeNull()
    expect(document.getElementById('a')!.getAttribute('data-swoop-reason')).toBe('no_fit')
  })

  it('never throws: no element, a throwing callback, a bad base address; stores nothing', () => {
    expect(mountUnit(null)).toBeNull()
    expect(mountUnit({} as HTMLElement)).toBeNull()
    expect(mountUnit(document.createElement('div'), { baseUrl: 'not a url' })).toBeNull()
    const el = document.createElement('div')
    document.body.append(el)
    const h = mountUnit(el, {
      onState: () => {
        throw new Error('mine')
      },
    })!
    expect(() => send({ type: 'swoop:state', id: idOf(h.frame), state: 'viewed' }, h.frame.contentWindow)).not.toThrow()
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
