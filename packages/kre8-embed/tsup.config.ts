import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      define: 'src/define.ts',
      react: 'src/react.tsx',
      client: 'src/client.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: false,
    target: 'es2020',
    treeshake: true,
    splitting: false,
    external: ['react', 'react/jsx-runtime'],
  },
  {
    // <script src="https://unpkg.com/@gullylabs/kre8-embed/dist/kre8-embed.global.js"> registers the elements and
    // exposes window.Kre8Embed
    entry: { 'kre8-embed': 'src/global.ts' },
    format: ['iife'],
    globalName: 'Kre8Embed',
    dts: false,
    clean: false,
    sourcemap: false,
    minify: true,
    target: 'es2020',
    outExtension: () => ({ js: '.global.js' }),
  },
])
