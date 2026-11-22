import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    server: 'src/server.ts',
    react: 'src/react.tsx',
    define: 'src/define.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  target: 'es2020',
  treeshake: true,
  external: ['react', 'react/jsx-runtime'],
})
