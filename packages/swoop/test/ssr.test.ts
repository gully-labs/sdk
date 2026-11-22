// @vitest-environment node
// Importing the package on a server (Next.js, Remix, plain Node) must not throw: no HTMLElement there.
import { describe, expect, it } from 'vitest'

describe('server-side import', () => {
  it('loads the main and define entries without a DOM', async () => {
    expect(typeof (globalThis as { HTMLElement?: unknown }).HTMLElement).toBe('undefined')
    const m = await import('../src/index')
    expect(typeof m.GullyAdSlot).toBe('function')
    const d = await import('../src/define')
    expect(d.defineAdSlot()).toBe('gully-ad-slot')
  })
})
