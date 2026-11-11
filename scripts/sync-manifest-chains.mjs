// Refreshes scripts/gullycore-chains.json from the public Gully Core manifest (chain ids, names, status).
// Usage: node scripts/sync-manifest-chains.mjs   (the manifest-sync tests read the snapshot; GULLY_LIVE=1 reads it live)
import { writeFileSync } from 'node:fs'

const SOURCE = 'https://gullycore.xyz/manifest.json'
const m = await (await fetch(SOURCE)).json()
const out = {
  source: SOURCE,
  generated: new Date().toISOString().slice(0, 10),
  chains: m.chains.map((c) => ({ chainId: c.chainId, key: c.key, name: c.name, kind: c.kind, status: c.status })),
}
writeFileSync(new URL('./gullycore-chains.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.log(`${out.chains.length} chains written`)
