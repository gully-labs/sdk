/**
 * @gullylabs/ads/react: <AdSlot slot="watch_rail" site="pk_…" signUrl="/api/gully-ads/sign" />
 * A thin wrapper over the <gully-ad-slot> web component. react is an optional peer dependency.
 */
import { createElement, useEffect, useRef, type CSSProperties } from 'react'
import { defineAdSlot, type AdSlotEventMap, type GullyAdSlot } from './slot'
import type { AdCreative, AdSlotName, ContentPrice } from './types'

export interface AdSlotProps {
  slot: AdSlotName
  /** placement publishable key `pk_…` */
  site?: string
  page?: string
  topic?: string
  creator?: string
  content?: string
  contentPrice?: ContentPrice
  durationSec?: number
  member?: boolean
  adFree?: boolean
  gated?: boolean
  access?: string
  /** Offerwall API origin (default https://offers.kre8.fun) */
  baseUrl?: string
  /** your sign endpoint: POST { query } -> SignedServe */
  signUrl?: string
  /** the small label in front of "Sponsored" (default "Ad") */
  label?: string
  className?: string
  style?: CSSProperties
  onFill?: (ad: AdCreative) => void
  onEmpty?: (reason: string, status?: number) => void
  onImpression?: (ad: AdCreative, visibleMs: number) => void
  onClick?: (ad: AdCreative) => void
  onError?: (error: unknown) => void
}

export function AdSlot(p: AdSlotProps) {
  const ref = useRef<GullyAdSlot | null>(null)
  useEffect(() => {
    defineAdSlot()
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const on = <K extends keyof AdSlotEventMap>(type: K, fn: (e: AdSlotEventMap[K]) => void) => {
      const h = fn as EventListener
      el.addEventListener(type, h)
      return () => el.removeEventListener(type, h)
    }
    const offs = [
      on('gully-ad:fill', (e) => p.onFill?.(e.detail.ad)),
      on('gully-ad:empty', (e) => p.onEmpty?.(e.detail.reason, e.detail.status)),
      on('gully-ad:impression', (e) => p.onImpression?.(e.detail.ad, e.detail.visibleMs)),
      on('gully-ad:click', (e) => p.onClick?.(e.detail.ad)),
      on('gully-ad:error', (e) => p.onError?.(e.detail.error)),
    ]
    return () => offs.forEach((off) => off())
  }, [p.onFill, p.onEmpty, p.onImpression, p.onClick, p.onError])

  const attrs: Record<string, string | undefined> = {
    slot: p.slot,
    site: p.site,
    page: p.page,
    topic: p.topic,
    creator: p.creator,
    content: p.content,
    'content-price': p.contentPrice,
    'duration-sec': p.durationSec === undefined ? undefined : String(p.durationSec),
    member: p.member ? '1' : undefined,
    'ad-free': p.adFree ? '1' : undefined,
    gated: p.gated ? '1' : undefined,
    access: p.access,
    'base-url': p.baseUrl,
    'sign-url': p.signUrl,
    label: p.label,
    class: p.className,
  }
  for (const k of Object.keys(attrs)) if (attrs[k] === undefined) delete attrs[k]
  return createElement('gully-ad-slot', { ref, style: p.style, ...attrs })
}

export { defineAdSlot } from './slot'
export type { AdCreative } from './types'
