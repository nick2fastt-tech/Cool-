/**
 * Single-file build.
 *
 * Bundles the whole game - engine, simulation, UI, CSS - into one standalone
 * HTML file with no external requests at all. Textures and sounds are already
 * generated at runtime, so the result is genuinely self-contained: open it
 * from a phone's file manager, a USB stick or any static host and it plays.
 *
 * Output format is a classic IIFE rather than an ES module, because inline
 * module scripts are blocked when a page is opened over file://.
 *
 *   node scripts/build-single-file.mjs   (or: npm run build:single)
 */
import { build } from 'vite';
import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, '.singlefile-tmp');
const OUT = join(ROOT, 'hollow-shift.html');

await rm(TMP, { recursive: true, force: true });

await build({
  root: ROOT,
  configFile: false,
  logLevel: 'warn',
  base: './',
  build: {
    outDir: TMP,
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000, // inline anything that survives to assets/
    modulePreload: false,
    rollupOptions: {
      input: join(ROOT, 'index.html'),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'game.js',
        assetFileNames: 'game.[ext]',
      },
    },
  },
});

// entryFileNames/assetFileNames put the bundle at the output root.
const files = await readdir(TMP, { recursive: true });
const jsName = files.find((f) => f.endsWith('.js'));
const cssName = files.find((f) => f.endsWith('.css'));
if (!jsName) throw new Error(`no js chunk produced (saw: ${files.join(', ')})`);

const js = await readFile(join(TMP, jsName), 'utf8');
const css = cssName ? await readFile(join(TMP, cssName), 'utf8') : '';

// A literal </script> anywhere in the bundle would close the tag early.
const safeJs = js.replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="theme-color" content="#05060a" />
<meta name="description" content="Hollow Shift - survive six hours of the night shift at Bramble Bear's Pizza Depot." />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%2305060a'/%3E%3Ccircle cx='11' cy='14' r='3' fill='%23e0a545'/%3E%3Ccircle cx='21' cy='14' r='3' fill='%23e0a545'/%3E%3C/svg%3E" />
<title>HOLLOW SHIFT</title>
<style>${css}</style>
</head>
<body>
  <div id="app">
    <canvas id="stage"></canvas>
    <div id="ui-root"></div>
  </div>
  <script>${safeJs}</script>
</body>
</html>
`;

await writeFile(OUT, html);
await rm(TMP, { recursive: true, force: true });

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`hollow-shift.html  ${kb(Buffer.byteLength(html))}  (js ${kb(js.length)}, css ${kb(css.length)})`);
