/**
 * Bundles the TypeScript server into a single runnable file.
 *
 * Node cannot strip the types in these modules on its own (the shared game
 * config uses const enums), so esbuild does one pass. Output is plain ESM with
 * `ws` left external, since it is a real dependency at runtime.
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['server/cli.ts'],
  outfile: 'server-dist/server.mjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external: ['ws'],
  logLevel: 'info',
});
