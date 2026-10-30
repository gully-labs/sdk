import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GullySecurityBadge } from '../src/react'

describe('GullySecurityBadge (React)', () => {
  it('renders the custom element with its attributes', () => {
    const html = renderToStaticMarkup(createElement(GullySecurityBadge, { chain: 485590, address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', theme: 'light', size: 285, data: 'score', assetBase: 'https://cdn.example/b' }))
    expect(html).toMatch(/^<gully-security-badge /)
    expect(html).toContain('chain="485590"')
    expect(html).toContain('theme="light"')
    expect(html).toContain('size="285"')
    expect(html).toContain('data="score"')
    expect(html).toContain('asset-base="https://cdn.example/b"')
  })
})
