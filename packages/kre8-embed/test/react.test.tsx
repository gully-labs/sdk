// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Kre8BackButton, Kre8CoinCard, Kre8Player } from '../src/react'

const COIN = '0x' + 'ab'.repeat(20)

describe('React wrapper', () => {
  it('renders the custom elements with their attributes', () => {
    expect(renderToStaticMarkup(createElement(Kre8CoinCard, { coin: COIN, title: 'FROG' }))).toBe(`<kre8-coin-card coin="${COIN}" title="FROG"></kre8-coin-card>`)
    expect(renderToStaticMarkup(createElement(Kre8Player, { track: 'trk_12345678', devOrigin: 'http://localhost:4361' }))).toBe('<kre8-player track="trk_12345678" dev-origin="http://localhost:4361"></kre8-player>')
    expect(renderToStaticMarkup(createElement(Kre8Player, { live: 'live1', className: 'x' }))).toBe('<kre8-player live="live1" class="x"></kre8-player>')
    expect(renderToStaticMarkup(createElement(Kre8BackButton, { creator: 'alice.gully', label: 'Back Alice', size: 'lg', disabled: true }))).toBe('<kre8-back-button creator="alice.gully" label="Back Alice" size="lg" disabled=""></kre8-back-button>')
  })
})
