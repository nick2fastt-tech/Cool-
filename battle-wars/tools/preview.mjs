// Contact sheet of frames for checking shots quickly.
// Usage: node tools/preview.mjs <episode-id> <from> <to> <step> [out.jpg]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [ep, a, b, step, outArg] = process.argv.slice(2);
const out = path.resolve(outArg || 'tmp/sheet.jpg');
const dir = path.join(root, 'tmp', 'frames_' + path.basename(out, '.jpg'));
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const port = 8000 + Math.floor(Math.random() * 1500);
const srv = await serve(root, port);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.error('ERR', e.message));
await page.goto(`http://localhost:${port}/player.html?render&w=640&h=360&ep=${ep}`);
await page.waitForFunction('window.ready', null, { timeout: 120000 });
// <from> may also be a comma-separated list of times (then <to> and <step> are ignored)
const times = [];
if (String(a).includes(',')) times.push(...a.split(',').map(Number));
else for (let t = +a; t <= +b + 1e-6; t += +step) times.push(t);
let i = 0;
for (const t of times) {
  const d = await page.evaluate((t) => window.renderFrame(t, 0.8), t);
  fs.writeFileSync(path.join(dir, `${String(i++).padStart(3, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
}
await browser.close(); srv.close();
execSync(`ffmpeg -loglevel error -y -i ${dir}/%03d.jpg -vf "drawtext=text='%{n}':x=8:y=8:fontsize=28:fontcolor=yellow:box=1:boxcolor=black,tile=4x4" ${out.replace(/\.jpg$/, '_%d.jpg')}`);
console.log('sheets', out.replace(/\.jpg$/, '_N.jpg'), i, 'frames,', Math.ceil(i / 16), 'sheets');
