/**
 * build-single.mjs
 * ----------------
 * Bundles the entire client — all modules AND Three.js — into one self-contained
 * `novaverse.html` that runs offline from a plain file:// open (no server, no
 * internet, no import map). Handy for sharing a single downloadable build.
 *
 * Usage:  npm run build:single
 *
 * The multi-file source remains the canonical project; this is just a packager.
 */

import esbuild from 'esbuild';
import { readFileSync, writeFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 1. Bundle src/main.js (+ three) into one minified IIFE.
const result = await esbuild.build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020'],
  legalComments: 'none',
  write: false,
});
const js = result.outputFiles[0].text;

// 2. Inline the stylesheet + the boot markup around the bundle.
const css = readFileSync(join(root, 'src/ui/styles.css'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="theme-color" content="#0b1020" />
<title>NovaVerse</title>
<style>
${css}
</style>
</head>
<body>
<canvas id="game-canvas"></canvas>
<div id="ui-root"></div>
<div id="boot">
  <div class="boot-logo">NOVA<span>VERSE</span></div>
  <div class="boot-bar"><div class="boot-bar-fill" id="boot-bar-fill"></div></div>
  <div class="boot-hint" id="boot-hint">Warming up the engine…</div>
  <div class="boot-error" id="boot-error"></div>
</div>
<script>
window.addEventListener('error', function (e) { var el = document.getElementById('boot-error'); if (el) el.textContent = 'Startup error: ' + (e.message || e.error); });
window.addEventListener('unhandledrejection', function (e) { var el = document.getElementById('boot-error'); if (el) el.textContent = 'Startup error: ' + ((e.reason && e.reason.message) || e.reason); });
</script>
<script>
${js}
</script>
</body>
</html>`;

const out = join(root, 'novaverse.html');
writeFileSync(out, html);
console.log(`novaverse.html written: ${(statSync(out).size / 1024).toFixed(0)} KB`);
