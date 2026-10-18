// Full pipeline for one episode: synthesize audio, render video, then make the final MP4.
// Series standard (from Episode 3): one 1080p file rendered natively at 1920x1080.
// --2k renders at 2560x1440 instead; --all-sizes (with --2k) also writes 1080p and 720p copies.
// Usage: node tools/build.mjs --ep <episode-id> [--skip-render] [--all-sizes] [--workers 4] [--crf 20]
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = (f) => process.argv.includes(f);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });

const EP = arg('ep', 's1e1-be-ready');
const { META, buildEpisode } = await import(`../episodes/${EP}.js`);
const duration = buildEpisode().duration;
const build = path.join(root, 'build', EP);
const outDir = path.join(root, 'output', EP);
fs.mkdirSync(outDir, { recursive: true });

const [RW, RH] = has('--2k') ? ['2560', '1440'] : ['1920', '1080'];
run('node', ['tools/audio.mjs', '--ep', EP]);
if (!has('--skip-render')) run('node', ['tools/render.mjs', '--ep', EP, '--workers', arg('workers', '4'), '--w', RW, '--h', RH, '--out', `build/${EP}/video.mp4`]);

const SIZES = has('--2k') ? (has('--all-sizes') ? [['2K', 2560, 1440], ['1080p', 1920, 1080], ['720p', 1280, 720]] : [['2K', 2560, 1440]]) : [['1080p', 1920, 1080]];
for (const [label, w, h] of SIZES) {
  const out = path.join(outDir, `${META.file}_${label}.mp4`);
  run('ffmpeg', ['-loglevel', 'error', '-y',
    '-i', `build/${EP}/video.mp4`, '-i', `build/${EP}/audio.wav`, '-i', `build/${EP}/captions.srt`,
    '-map', '0:v', '-map', '1:a', '-map', '2:s',
    '-vf', `scale=${w}:${h}:flags=lanczos`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', arg('crf', '20'), '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng',
    '-metadata', `title=${META.title}`,
    '-t', String(duration), out]);
  console.log(`done: ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
}
