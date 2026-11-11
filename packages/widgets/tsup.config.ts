import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    tracker: 'src/tracker.ts',
    holders: 'src/holders.ts',
    'holders-react': 'src/holders-react.tsx',
    widget: 'src/widget.ts',
    'widget-react': 'src/widget-react.tsx',
    react: 'src/react.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  target: 'es2020',
  treeshake: true,
  external: ['react', 'react/jsx-runtime'],
})
