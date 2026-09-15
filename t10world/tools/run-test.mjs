import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = process.argv[3] || path.resolve('.');
const PAGE = process.argv[2] || '/tools/test-human.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? '/index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found: ' + url); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon/i.test(t) && !/status of 404/.test(t)) consoleErrors.push('console: ' + t); });

await page.goto(`http://127.0.0.1:${port}${PAGE}`, { waitUntil: 'load' });
try {
  await page.waitForFunction(() => window.__results && window.__results.done, { timeout: 90000 });
} catch (e) {
  console.log('TIMEOUT waiting for test completion');
}
const results = await page.evaluate(() => window.__results);
console.log('--- LOGS ---');
for (const l of (results?.logs || [])) console.log(l);
if (results?.errors?.length) { console.log('--- ERRORS ---'); for (const e of results.errors) console.log(e); }
if (consoleErrors.length) { console.log('--- CONSOLE ---'); for (const e of consoleErrors) console.log(e); }
const ok = results && results.errors.length === 0 && consoleErrors.length === 0;
console.log(ok ? '\nRESULT: PASS' : '\nRESULT: FAIL');
if (process.env.SCREENSHOT) await page.screenshot({ path: process.env.SCREENSHOT });
await browser.close();
server.close();
process.exit(ok ? 0 : 1);
