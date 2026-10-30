<!-- gully-header:start -->
<p align="center">
  <a href="https://docs.gullylabs.xyz/sdk">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/gully-labs-logo.png">
      <img alt="Gully Labs" src=".github/assets/gully-labs-logo-on-light.png" width="300">
    </picture>
  </a>
</p>

<p align="center"><b>You Think It, We Ship It.</b></p>

<p align="center">Typed client for the stock token tracker API and the embeddable widget (React + vanilla). MIT.</p>

<p align="center">
  <a href="https://gullylabs.xyz"><img src="https://img.shields.io/badge/gullylabs.xyz-00D2FF?style=for-the-badge&labelColor=06050D&logo=googlechrome&logoColor=06050D" alt="Website"></a>
  <a href="https://docs.gullylabs.xyz/sdk"><img src="https://img.shields.io/badge/docs.gullylabs.xyz/sdk-0B0A16?style=for-the-badge&labelColor=06050D&logo=googlechrome&logoColor=00D2FF" alt="App"></a>
  <a href="https://docs.gullylabs.xyz"><img src="https://img.shields.io/badge/Docs-0B0A16?style=for-the-badge&labelColor=06050D&logo=readthedocs&logoColor=00D2FF" alt="Docs"></a>
  <a href="https://discord.com/invite/tY2ErsNNBp"><img src="https://img.shields.io/badge/Discord-0B0A16?style=for-the-badge&labelColor=06050D&logo=discord&logoColor=5865F2" alt="Discord"></a>
  <a href="https://x.com/Gully_Labs"><img src="https://img.shields.io/badge/@Gully__Labs-0B0A16?style=for-the-badge&labelColor=06050D&logo=x&logoColor=white" alt="X"></a>
</p>

<p align="center"><sub>Built and run by <a href="https://gullylabs.xyz">Gully Labs</a>. You Think It, We Ship It.</sub></p>

---
<!-- gully-header:end -->

# Gully Labs SDKs

The Gully Labs packages on npm, all under the `@gullylabs` scope. Every package: ESM + CommonJS builds with TypeScript types, MIT, semver 0.x, a 5-minute quickstart in its README, a CHANGELOG, and a `files` allowlist (no tests, no secrets). Releases are tagged `<package>@<version>` and published with npm provenance by `.github/workflows/release.yml`.

| Package | What it is | Repo |
|---|---|---|
| [`@gullylabs/widgets`](packages/widgets) | Stock token tracker client, Holder Map client + `<HolderMap>` (Gully Chain included), the tracker widget + `<GullyWidget>`. Replaces `@gullylabs/tracker`, `@gullylabs/holders`, `@gullylabs/widget`. | here |
| [`@gullylabs/security`](packages/security) | Gully Security scan-a-token API client and the "Secured by Gully Security" badge web component. | here |
| [`@gullylabs/kre8-embed`](packages/kre8-embed) | kre8.fun embeds: coin card, Drop / track player and "Back this" button as sandboxed-iframe web components with a React wrapper. | here |
| [`@gullylabs/ads`](packages/ads) | Gully Ads publisher SDK (beta): ad slot component, signed serve requests, impression and click reporting. | here |
| `@gullylabs/chain` | Gully Chain SDK: chain objects, addresses, ABIs, launchpad, swap, names, accounts, bridge, indexer, CLI. | [gullychain-sdk](https://github.com/gully-labs/gullychain-sdk) |
| `@gullylabs/id` | Gully ID client: passkey and email sign-in, Sign in with Gully (OIDC + PKCE). | [gully-id](https://github.com/gully-labs/gully-id) `sdk/` |
| `@gullylabs/pay` | Gully Pay SDK: x402 client, Agent Wallets, MCP server, wallet and verification helpers. | [gull-pay](https://github.com/gully-labs/gull-pay) `packages/pay-sdk` |

Integrate in 5 minutes: https://docs.gullylabs.xyz/integrate (Gully Labs) and https://docs.gullychain.xyz/sdks/ (Gully Chain builders).

## Quick start

```ts
import { createHoldersClient, isMapOk } from '@gullylabs/widgets/holders'

const map = await createHoldersClient().getMap('gully', '0x...') // Gully Chain, no key needed
if (isMapOk(map)) console.log(map.summary.line)
```

```tsx
import { GullyWidget } from '@gullylabs/widgets/widget/react'

export const Nvda = () => <GullyWidget type="badge" ticker="NVDA" chain="robinhood" />
```

## Develop

Each package is self-contained: `cd packages/<name> && npm install && npm test && npm run build`. `npm pack --dry-run` shows exactly what would ship.

## Release

1. Bump `version` in the package's `package.json` and add a `CHANGELOG.md` entry.
2. Merge to `main`, then `git tag <package>@<version> && git push --tags` (for example `widgets@0.1.0`). Prerelease versions (`0.1.0-beta.0`) publish under the `beta` dist-tag.
3. `.github/workflows/release.yml` builds, tests and runs `npm publish --provenance --access public` with the `NPM_TOKEN` secret.

MIT. Built and run by [Gully Labs](https://gullylabs.xyz).
