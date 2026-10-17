// Renders the episode to video with several headless Chromium workers in parallel.
// Work is split into small chunks (default 240 frames); each finished chunk is its own
// complete MP4, so a crash or restart only loses the chunks in progress. Re-running the same
// command resumes and skips chunks that are already done.
// Usage: node tools/render.mjs --ep <episode-id> [--from 0] [--to <end s>] [--ranges "a-b,c-d" (frames)]
//        [--fps 24] [--workers 4] [--w 2560 --h 1440] [--chunk 240] [--out build/<ep>/video.mp4]
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const EP = arg('ep', 's1e1-be-ready');
const FPS = +arg('fps', 24), W = +arg('w', 2560), H = +arg('h', 1440), WORKERS = +arg('workers', 4), CHUNK = +arg('chunk', 240);
const { buildEpisode } = await import(`../episodes/${EP}.js`);
const duration = buildEpisode().duration;
const out = path.resolve(root, arg('out', `build/${EP}/video.mp4`));
const chunkDir = path.join(path.dirname(out), `chunks_${W}x${H}`);
fs.mkdirSync(chunkDir, { recursive: true });

// frame ranges to render, half-open [a, b)
let ranges;
if (arg('ranges')) ranges = arg('ranges').split(',').map((r) => r.split('-').map(Number));
else ranges = [[Math.round(+arg('from', 0) * FPS), Math.round(+arg('to', duration) * FPS)]];
const chunks = [];
for (const [a, b] of ranges) for (let f = a; f < b; f += CHUNK) chunks.push([f, Math.min(b, f + CHUNK)]);
const chunkFile = ([a, b]) => path.join(chunkDir, `f${String(a).padStart(6, '0')}-${String(b).padStart(6, '0')}.mp4`);
const todo = chunks.filter((c) => !fs.existsSync(chunkFile(c)));
const total = todo.reduce((s, [a, b]) => s + b - a, 0);
console.log(`${chunks.length} chunks, ${chunks.length - todo.length} already done, ${total} frames to render`);

const port = 8300 + Math.floor(Math.random() * 1500);
const srv = await serve(root, port);
let done = 0, nextLog = 240;
const t0 = Date.now();
const queue = [...todo];

async function worker(id) {
  if (!queue.length) return;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.error(`[w${id}]`, e.message));
  await page.goto(`http://localhost:${port}/player.html?render&w=${W}&h=${H}&ep=${EP}`);
  await page.waitForFunction('window.ready', null, { timeout: 120000 });
  while (queue.length) {
    const c = queue.shift();
    const [a, b] = c;
    const tmp = chunkFile(c).replace(/\.mp4$/, '.part.mp4');
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const d = await page.evaluate((t) => window.renderFrame(t, 0.93), f / FPS);
      const buf = Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      done++;
      if (done >= nextLog) {
        nextLog += 240;
        const el = (Date.now() - t0) / 1000;
        console.log(`${done}/${total} frames  ${(done / el).toFixed(2)} fps  eta ${((total - done) / (done / el) / 60).toFixed(1)} min`);
      }
    }
    ff.stdin.end();
    const code = await new Promise((r) => ff.on('close', r));
    if (code === 0) fs.renameSync(tmp, chunkFile(c));
  }
  await browser.close();
}

await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));
srv.close();
const missing = chunks.filter((c) => !fs.existsSync(chunkFile(c)));
if (missing.length) { console.error(`missing ${missing.length} chunks - run again to resume`); process.exit(1); }
if (!process.argv.includes('--no-concat')) {
  const list = path.join(chunkDir, 'list.txt');
  fs.writeFileSync(list, chunks.map((c) => `file '${chunkFile(c)}'`).join('\n'));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]);
  console.log(`video written: ${out}  (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
} else console.log('chunks complete');
