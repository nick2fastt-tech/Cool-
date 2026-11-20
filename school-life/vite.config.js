import { defineConfig } from 'vite';

// SINGLE=1 builds one JS bundle for the standalone HTML file (see scripts/make-single-html.cjs).
const single = process.env.SINGLE === '1';

export default defineConfig({
  base: './',
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
    outDir: single ? 'dist-single' : 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: single
          ? undefined
          : (id) => {
            if (id.includes('node_modules/three')) return 'three';
            return undefined;
          },
      },
    },
  },
});
