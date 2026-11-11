// Chain ids and names must match the public Gully Core manifest (snapshot in scripts/gullycore-chains.json;
// GULLY_LIVE=1 compares against https://gullycore.xyz/manifest.json itself).
import { describe, expect, it } from 'vitest'
import snapshot from '../../../scripts/gullycore-chains.json'
import { GULLY_CHAIN_ID, SECURITY_CHAINS } from '../src/chains'

type Chain = { chainId: number; name: string; kind: string; status: string }
const live = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.GULLY_LIVE === '1'
const chains = async (): Promise<Chain[]> => (live ? (await (await fetch(snapshot.source)).json()).chains : snapshot.chains)

describe('Gully Core manifest sync', () => {
  it('Gully Chain is the testnet 485590, and the mainnet id is not presented', async () => {
    const m = await chains()
    const t = m.find((c) => c.chainId === GULLY_CHAIN_ID)
    expect(t?.kind).toBe('testnet')
    expect(SECURITY_CHAINS.find((c) => c.chainId === GULLY_CHAIN_ID)).toMatchObject({ name: t?.name, testnet: true })
    expect(SECURITY_CHAINS.some((c) => c.chainId === 48559)).toBe(false)
  })

  it('every chain the package shares with the manifest has the manifest name and is not shown as live when it is not', async () => {
    const m = await chains()
    for (const c of SECURITY_CHAINS) {
      const mc = m.find((x) => x.chainId === c.chainId)
      if (!mc) continue
      expect(c.name).toBe(mc.name)
      expect(Boolean(c.testnet)).toBe(mc.kind === 'testnet')
    }
  })
})
