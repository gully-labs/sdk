/**
 * React wrapper (react is an optional peer). Each component renders the web component and registers the elements on
 * first mount, so `import '@gullylabs/kre8-embed/define'` is not needed. Events arrive as props.
 */
import { createElement, useEffect, useRef, type CSSProperties, type ReactElement } from 'react'
import { BACK_BUTTON_TAG, COIN_CARD_TAG, defineKre8Embeds, PLAYER_TAG, type Kre8BackButtonElement, type Kre8CoinCardElement, type Kre8PlayerElement } from './elements'
import type { EmbedMessage } from './protocol'

interface CommonProps {
  /** one of ALLOWED_EMBED_ORIGINS (default https://kre8.fun) */
  origin?: string
  /** explicit development origin (http://localhost:5173) */
  devOrigin?: string
  className?: string
  style?: CSSProperties
  id?: string
}

interface FrameProps extends CommonProps {
  title?: string
  onReady?: (m: Extract<EmbedMessage, { type: 'ready' }>) => void
  onResize?: (m: Extract<EmbedMessage, { type: 'resize' }>) => void
  onOpen?: (m: Extract<EmbedMessage, { type: 'open' }>) => void
  onError?: (m: { message: string }) => void
}

export interface Kre8CoinCardProps extends FrameProps {
  /** Gully Chain coin address */
  coin: string
}

export type Kre8PlayerProps = FrameProps & ({ track: string } | { video: string } | { short: string } | { live: string })

export interface Kre8BackButtonProps extends CommonProps {
  /** 0x address or .gully handle */
  creator: string
  /** button text (default "Back this") */
  label?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onBack?: (detail: { creator: string | null; href: string }) => void
}

type Handlers = Partial<Record<'kre8-ready' | 'kre8-resize' | 'kre8-open' | 'kre8-error' | 'kre8-back', (detail: unknown) => void>>

function useKre8Element<T extends HTMLElement>(handlers: Handlers) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    defineKre8Embeds()
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const offs = Object.entries(handlers)
      .filter((e): e is [string, (detail: unknown) => void] => typeof e[1] === 'function')
      .map(([name, fn]) => {
        const l = (ev: Event) => fn((ev as CustomEvent).detail)
        el.addEventListener(name, l)
        return () => el.removeEventListener(name, l)
      })
    return () => offs.forEach((off) => off())
  })
  return ref
}

const attrs = (p: CommonProps) => ({
  ...(p.origin ? { origin: p.origin } : {}),
  ...(p.devOrigin ? { 'dev-origin': p.devOrigin } : {}),
  ...(p.className ? { class: p.className } : {}),
  ...(p.style ? { style: p.style } : {}),
  ...(p.id ? { id: p.id } : {}),
})

/** `<Kre8CoinCard coin="0x..." />` */
export function Kre8CoinCard(p: Kre8CoinCardProps): ReactElement {
  const ref = useKre8Element<Kre8CoinCardElement>({
    'kre8-ready': p.onReady as Handlers['kre8-ready'],
    'kre8-resize': p.onResize as Handlers['kre8-resize'],
    'kre8-open': p.onOpen as Handlers['kre8-open'],
    'kre8-error': p.onError as Handlers['kre8-error'],
  })
  return createElement(COIN_CARD_TAG, { ref, coin: p.coin, ...(p.title ? { title: p.title } : {}), ...attrs(p) })
}

/** `<Kre8Player track="..." />` (or video / short / live) */
export function Kre8Player(p: Kre8PlayerProps): ReactElement {
  const ref = useKre8Element<Kre8PlayerElement>({
    'kre8-ready': p.onReady as Handlers['kre8-ready'],
    'kre8-resize': p.onResize as Handlers['kre8-resize'],
    'kre8-open': p.onOpen as Handlers['kre8-open'],
    'kre8-error': p.onError as Handlers['kre8-error'],
  })
  const item =
    'track' in p ? { track: p.track } : 'video' in p ? { video: p.video } : 'short' in p ? { short: p.short } : { live: p.live }
  return createElement(PLAYER_TAG, { ref, ...item, ...(p.title ? { title: p.title } : {}), ...attrs(p) })
}

/** `<Kre8BackButton creator="alice.gully" />`: opens the creator's kre8 page in a new tab (noopener). */
export function Kre8BackButton(p: Kre8BackButtonProps): ReactElement {
  const ref = useKre8Element<Kre8BackButtonElement>({ 'kre8-back': p.onBack as Handlers['kre8-back'] })
  return createElement(BACK_BUTTON_TAG, {
    ref,
    creator: p.creator,
    ...(p.label ? { label: p.label } : {}),
    ...(p.size ? { size: p.size } : {}),
    ...(p.disabled ? { disabled: '' } : {}),
    ...attrs(p),
  })
}

export { defineKre8Embeds }
