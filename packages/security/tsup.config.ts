import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    badge: 'src/badge.ts',
    react: 'src/react.tsx',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  target: 'es2020',
  treeshake: true,
  splitting: false,
  external: ['react'],
})
