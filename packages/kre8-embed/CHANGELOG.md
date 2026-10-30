# Changelog

## 0.1.0 - 2026-10-30

- First release of `@gullylabs/kre8-embed`.
- Web components `<kre8-coin-card>`, `<kre8-player>` and `<kre8-back-button>`, each with Shadow DOM, kre8 kit tokens and a kit loading state.
- Coin cards and players render inside a sandboxed iframe served from kre8.fun (`/embed/coin/:address`, `/embed/track/:id`, `/embed/video/:id`, `/embed/short/:id`, `/embed/live/:id`); the host page only receives `ready`, `resize`, `open` and `error` messages, checked against the exact kre8 origin and a per-instance nonce.
- `<kre8-back-button>` opens the creator's kre8 page in a new tab (`noopener,noreferrer`); no money moves on the host page.
- `createKre8Client()`: a read-only client for the public Gully Chain indexer and kre8 social API (coins, candles, tracks, creators, profiles).
- React wrapper (`@gullylabs/kre8-embed/react`), a side-effect `define` entry and an IIFE build for a `<script>` tag.
- ESM and CommonJS builds with TypeScript types for every entry.
