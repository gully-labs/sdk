/**
 * Creatives are rendered as DOM nodes with textContent, never as HTML. URLs are accepted only when they parse and use
 * https (the server already enforces https for clickUrl; this is the browser-side backstop).
 */

export function safeHttpsUrl(u: unknown): string | null {
  if (typeof u !== 'string' || u.length === 0 || u.length > 2048) return null
  try {
    const url = new URL(u)
    if (url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

/** Plain text for a label or line: control characters stripped, length bounded. */
export function safeText(s: unknown, max: number): string {
  if (typeof s !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
}
