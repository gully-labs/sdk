import { DEFAULT_BASE_URL, HOLDER_CHAINS, embedUrl, type HolderChain } from './index.js'

export interface HolderMapProps {
  chain: HolderChain
  /** A token address, or a ticker the tracker follows (for example NVDA). */
  token: string
  /** Frame height in pixels, 360 to 2000. Default 760. */
  height?: number
  /** Another Gully Labs deployment to frame. Defaults to https://gullylabs.xyz */
  baseUrl?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * <HolderMap chain="base" token="0x…" height={640} />
 * Frames the Gully Labs Holder Map (gullylabs.xyz/embed/holders). The map reads its own data inside the frame, so your
 * page makes no requests for it. A "Powered by Gully Labs" credit always shows. If your Content Security Policy
 * restricts frames, add `frame-src https://gullylabs.xyz`.
 */
export function HolderMap({ chain, token, height, baseUrl = DEFAULT_BASE_URL, className, style }: HolderMapProps) {
  if (!(HOLDER_CHAINS as readonly string[]).includes(chain) || !/^[A-Za-z0-9]{1,64}$/.test(token)) {
    return <div className={className} style={style}>Holder Map: set a supported chain and a token address or ticker.</div>
  }
  const h = typeof height === 'number' && height >= 360 && height <= 2000 ? height : 760
  return (
    <iframe
      src={embedUrl(chain, token, baseUrl)}
      title="Holder Map by Gully Labs"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      className={className}
      style={{ display: 'block', width: '100%', maxWidth: '100%', border: 0, borderRadius: 12, background: '#0d141c', height: h, ...style }}
    />
  )
}

export default HolderMap
