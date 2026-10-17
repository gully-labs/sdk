import { useEffect, useRef } from 'react'
import { loadWidget, widgetAttributes, type WidgetOptions } from './index.js'

export interface GullyWidgetProps extends WidgetOptions {
  /** Load widget.js from your own host instead of gullylabs.xyz. */
  scriptSrc?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * <GullyWidget type="badge" ticker="NVDA" chain="robinhood" />
 * Renders the live Gully Labs tracker widget. Changing a prop mounts a fresh widget.
 */
export function GullyWidget({ scriptSrc, className, style, ...options }: GullyWidgetProps) {
  const host = useRef<HTMLDivElement>(null)
  const key = JSON.stringify(options)
  useEffect(() => {
    const parent = host.current
    if (!parent) return
    let alive = true
    // The widget draws into a shadow root on its element, so a new option set gets a new element.
    const el = document.createElement('div')
    for (const [k, v] of Object.entries(widgetAttributes(options))) el.setAttribute(k, v)
    parent.replaceChildren(el)
    loadWidget(scriptSrc)
      .then(() => alive && window.GullyWidget?.scan())
      .catch(() => {
        if (alive) el.textContent = 'The Gully Labs widget could not be loaded.'
      })
    return () => {
      alive = false
      parent.replaceChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, scriptSrc])
  return <div ref={host} className={className} style={style} />
}

export default GullyWidget
