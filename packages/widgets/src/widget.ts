/**
 * @gullylabs/widgets/widget — the Gully Labs tracker widget for any page, plus a React component.
 *
 * The widget itself is https://gullylabs.xyz/widget.js (also shipped in this package as
 * `@gullylabs/widgets/widget.js` for self-hosting). This module only loads it and mounts elements.
 */

export type WidgetType = 'ticker' | 'badge' | 'table'
export type WidgetChain = 'all' | 'robinhood' | 'bsc'

export interface WidgetOptions {
  type?: WidgetType
  /** Which chain's stocks to show. Defaults to all. */
  chain?: WidgetChain
  /** Badge only: the stock, e.g. NVDA. */
  ticker?: string
  theme?: 'dark' | 'light'
  /** Ticker and table: how many stocks. */
  limit?: number
  /** The API the widget reads. Defaults to https://gullylabs.xyz */
  api?: string
}

export const DEFAULT_SCRIPT = 'https://gullylabs.xyz/widget.js'

declare global {
  interface Window {
    GullyWidget?: { scan: () => void; version: string }
  }
}

let loading: Promise<void> | null = null

/** Loads widget.js once per page. Resolves when `window.GullyWidget` is ready. */
export function loadWidget(src: string = DEFAULT_SCRIPT): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.GullyWidget) return Promise.resolve()
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    const s = existing ?? document.createElement('script')
    s.addEventListener('load', () => resolve())
    s.addEventListener('error', () => {
      loading = null
      reject(new Error(`Could not load ${src}`))
    })
    if (!existing) {
      s.src = src
      s.async = true
      document.head.appendChild(s)
    }
  })
  return loading
}

/** The data-* attributes the widget reads, for any templating system. */
export function widgetAttributes(o: WidgetOptions = {}): Record<string, string> {
  const a: Record<string, string> = { 'data-gully-widget': o.type ?? 'ticker' }
  if (o.chain) a['data-chain'] = o.chain
  if (o.ticker) a['data-ticker'] = o.ticker.toUpperCase()
  if (o.theme) a['data-theme'] = o.theme
  if (o.limit) a['data-limit'] = String(o.limit)
  if (o.api) a['data-api'] = o.api
  return a
}

/** Mounts a widget into `el` (an element you own) and returns it. */
export async function mountWidget(el: HTMLElement, o: WidgetOptions = {}, src?: string): Promise<HTMLElement> {
  for (const [k, v] of Object.entries(widgetAttributes(o))) el.setAttribute(k, v)
  await loadWidget(src)
  window.GullyWidget?.scan()
  return el
}
