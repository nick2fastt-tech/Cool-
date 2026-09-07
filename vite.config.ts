import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
  server: { host: true, port: 5173 },
  test: {
    // The simulation suite and the difficulty sweep both run on `npm test`.
    include: ['tests/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
