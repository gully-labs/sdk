// The chain kre8 coins live on must match the public Gully Core manifest (snapshot in scripts/gullycore-chains.json;
// GULLY_LIVE=1 compares against https://gullycore.xyz/manifest.json itself).
import { describe, expect, it } from 'vitest'
import snapshot from '../../../scripts/gullycore-chains.json'
import { GULLY_CHAIN_ID } from '../src/origins'

describe('Gully Core manifest sync', () => {
  it('GULLY_CHAIN_ID is the Gully Chain testnet of the manifest', async () => {
    const m: { chainId: number; kind: string }[] = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.GULLY_LIVE === '1' ? (await (await fetch(snapshot.source)).json()).chains : snapshot.chains
    expect(GULLY_CHAIN_ID).toBe(485590)
    expect(m.find((c) => c.chainId === GULLY_CHAIN_ID)?.kind).toBe('testnet')
  })
})
