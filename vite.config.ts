import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      outDir: 'dist/types',
      rollupTypes: false,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // maplibre-gl-components lazily imports these optional converter deps,
      // which are not installed. The dev examples never trigger those code
      // paths, so alias them to an empty stub to satisfy import resolution.
      shpjs: resolve(__dirname, 'examples/empty-module.ts'),
      '@duckdb/duckdb-wasm': resolve(__dirname, 'examples/empty-module.ts'),
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        react: resolve(__dirname, 'src/react.ts'),
      },
      name: 'MapLibreUsgsLidar',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'mjs' : 'cjs';
        return `${entryName}.${ext}`;
      },
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'maplibre-gl',
        '@geoman-io/maplibre-geoman-free',
        'maplibre-gl-lidar',
        'maplibre-gl-geo-editor',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'maplibre-gl': 'maplibregl',
          '@geoman-io/maplibre-geoman-free': 'Geoman',
          'maplibre-gl-lidar': 'MapLibreLidar',
          'maplibre-gl-geo-editor': 'MapLibreGeoEditor',
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'maplibre-gl-usgs-lidar.css';
          return assetInfo.name || '';
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: false,
  },
});
