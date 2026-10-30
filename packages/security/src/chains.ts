// The chains Gully Security scans and scores (gully-security server/security-contract.mjs SCAN_CHAINS and
// server/chains.mjs SCORE_CHAIN_LIST). Keys are what the API takes in paths and scan inputs.

export type SecurityChainKey = 'ethereum' | 'base' | 'arbitrum' | 'optimism' | 'polygon' | 'bnb' | 'avalanche' | 'gully'

export interface SecurityChain {
  key: SecurityChainKey
  chainId: number
  name: string
  testnet?: boolean
}

/** Gully Chain Testnet: chain id 485590, key `gully`. */
export const GULLY_CHAIN_ID = 485590

export const SECURITY_CHAINS: readonly SecurityChain[] = [
  { key: 'ethereum', chainId: 1, name: 'Ethereum' },
  { key: 'base', chainId: 8453, name: 'Base' },
  { key: 'arbitrum', chainId: 42161, name: 'Arbitrum One' },
  { key: 'optimism', chainId: 10, name: 'OP Mainnet' },
  { key: 'polygon', chainId: 137, name: 'Polygon' },
  { key: 'bnb', chainId: 56, name: 'BNB Chain' },
  { key: 'avalanche', chainId: 43114, name: 'Avalanche C-Chain' },
  { key: 'gully', chainId: GULLY_CHAIN_ID, name: 'Gully Chain Testnet', testnet: true },
]

/** A chain as callers name it: its key (`'gully'`), its id (`485590`) or the id as a string. */
export type ChainRef = SecurityChainKey | number | string

/** The supported chain for a key or id, or null. */
export function resolveChain(ref: ChainRef): SecurityChain | null {
  const s = String(ref ?? '').trim().toLowerCase()
  return SECURITY_CHAINS.find((c) => c.key === s || String(c.chainId) === s) ?? null
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

/** True for 0x followed by 40 hex characters, not the zero address. */
export function isAddress(a: unknown): a is string {
  return typeof a === 'string' && ADDRESS_RE.test(a) && !/^0x0{40}$/.test(a)
}
