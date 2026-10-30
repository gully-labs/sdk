// React wrapper (react is an optional peer dependency). `GullySecurityBadge` renders <gully-security-badge> and
// defines it on first mount; `useGullyScore` reads a contract's Gully Score.
import { createElement, useEffect, useState, type CSSProperties } from 'react'
import { BADGE_TAG, defineSecurityBadge, type BadgeData, type BadgeSize, type BadgeTheme, type SecurityBadgeDefaults } from './badge-element'
import { GullySecurity, type GullySecurityOptions } from './client'
import type { ChainRef } from './chains'
import type { GullyScore } from './types'
import { GullySecurityError } from './errors'

export interface GullySecurityBadgeProps extends SecurityBadgeDefaults {
  chain: ChainRef
  address: string
  theme?: BadgeTheme
  size?: BadgeSize
  data?: BadgeData
  href?: string
  caption?: 'show' | 'hide'
  className?: string
  style?: CSSProperties
}

/** The "Secured by GullySecurity" badge as a React component. */
export function GullySecurityBadge({ chain, address, theme = 'dark', size = 214, data, href, caption, className, style, baseUrl, assetBase, fetch }: GullySecurityBadgeProps) {
  useEffect(() => {
    defineSecurityBadge({ ...(baseUrl ? { baseUrl } : {}), ...(assetBase ? { assetBase } : {}), ...(fetch ? { fetch } : {}) })
  }, [baseUrl, assetBase, fetch])
  const attrs: Record<string, unknown> = { chain: String(chain), address, theme, size: String(size), class: className, style }
  if (data) attrs.data = data
  if (href) attrs.href = href
  if (caption) attrs.caption = caption
  if (baseUrl) attrs['base-url'] = baseUrl
  if (assetBase) attrs['asset-base'] = assetBase
  return createElement(BADGE_TAG, attrs)
}

export interface UseGullyScoreState {
  score: GullyScore | null
  loading: boolean
  error: GullySecurityError | null
}

/** Reads a contract's Gully Score; re-reads when chain or address change. */
export function useGullyScore(chain: ChainRef | null | undefined, address: string | null | undefined, options?: GullySecurityOptions): UseGullyScoreState {
  const [state, setState] = useState<UseGullyScoreState>({ score: null, loading: !!(chain && address), error: null })
  const baseUrl = options?.baseUrl
  useEffect(() => {
    if (!chain || !address) {
      setState({ score: null, loading: false, error: null })
      return
    }
    const ctl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    new GullySecurity(options)
      .score(chain, address, { signal: ctl.signal })
      .then((score) => !ctl.signal.aborted && setState({ score, loading: false, error: null }))
      .catch((e) => !ctl.signal.aborted && setState({ score: null, loading: false, error: e instanceof GullySecurityError ? e : new GullySecurityError(String(e?.message ?? e), { code: 'network', cause: e }) }))
    return () => ctl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [String(chain), address, baseUrl])
  return state
}
