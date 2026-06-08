import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: '/',
  publicDir: 'public',
  // Build web workers as ES modules. Some transitive deps (e.g. the geotiff
  // worker pulled in via maplibre-gl-components) use top-level await, which is
  // unsupported in the default 'iife' worker format.
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist-examples',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        basic: resolve(__dirname, 'examples/basic/index.html'),
        react: resolve(__dirname, 'examples/react/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // maplibre-gl-components lazily imports these optional converter deps,
      // which are not installed. The examples never trigger those code paths,
      // so alias them to an empty stub to satisfy import resolution.
      shpjs: resolve(__dirname, 'examples/empty-module.ts'),
      '@duckdb/duckdb-wasm': resolve(__dirname, 'examples/empty-module.ts'),
    },
  },
});
