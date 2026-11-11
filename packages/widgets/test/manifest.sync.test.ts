// The Holder Map's Gully Chain key must point at the Gully Chain testnet of the public Gully Core manifest
// (snapshot in scripts/gullycore-chains.json; GULLY_LIVE=1 compares against https://gullycore.xyz/manifest.json).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import snapshot from '../../../scripts/gullycore-chains.json'
import { HOLDER_CHAINS } from '../src/holders'

describe('Gully Core manifest sync', () => {
  it('`gully` is Gully Chain testnet 485590; no Gully Chain mainnet id is presented', async () => {
    const m: { chainId: number; kind: string }[] = process.env.GULLY_LIVE === '1' ? (await (await fetch(snapshot.source)).json()).chains : snapshot.chains
    expect(HOLDER_CHAINS).toContain('gully')
    expect(m.find((c) => c.chainId === 485590)?.kind).toBe('testnet')
    for (const f of ['holders.ts', 'tracker.ts', 'widget.ts']) {
      expect(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')).not.toMatch(/\b48559\b/)
    }
  })
})
