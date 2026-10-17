// Renders the episode to video segments with several headless Chromium workers in parallel.
// Usage: node tools/render.mjs [--from 0] [--to 450] [--fps 24] [--workers 3] [--w 1280 --h 720] [--out build/video.mp4]
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = +arg('fps', 24), W = +arg('w', 1280), H = +arg('h', 720), WORKERS = +arg('workers', 3);
const from = +arg('from', 0), to = +arg('to', 450);
const out = path.resolve(root, arg('out', 'build/video.mp4'));
const segDir = path.join(path.dirname(out), 'segments');
fs.mkdirSync(segDir, { recursive: true });

const port = 8300 + Math.floor(Math.random() * 500);
const srv = await serve(root, port);
const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
const total = f1 - f0;
const chunk = Math.ceil(total / WORKERS);
let done = 0;
const t0 = Date.now();

async function worker(id, a, b) {
  const seg = path.join(segDir, `seg_${String(id).padStart(2, '0')}.mp4`);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.error(`[w${id}]`, e.message));
  await page.goto(`http://localhost:${port}/player.html?render&w=${W}&h=${H}`);
  await page.waitForFunction('window.ready', null, { timeout: 120000 });
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) {
    const d = await page.evaluate((t) => window.renderFrame(t, 0.93), f / FPS);
    const buf = Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
    if (done % 240 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${done}/${total} frames  ${(done / el).toFixed(2)} fps  eta ${((total - done) / (done / el) / 60).toFixed(1)} min`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  return seg;
}

const jobs = [];
for (let i = 0; i < WORKERS; i++) {
  const a = f0 + i * chunk, b = Math.min(f1, a + chunk);
  if (a < b) jobs.push(worker(i, a, b));
}
const segs = await Promise.all(jobs);
srv.close();
const list = path.join(segDir, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]);
console.log(`video written: ${out}  (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
