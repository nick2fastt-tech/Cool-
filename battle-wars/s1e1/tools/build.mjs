// Full pipeline: synthesize audio, render video, then mux everything into the final MP4.
// Usage: node tools/build.mjs [--skip-render] [--workers 4]
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = (f) => process.argv.includes(f);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });

run('node', ['tools/audio.mjs']);
if (!has('--skip-render')) run('node', ['tools/render.mjs', '--workers', arg('workers', '4'), '--out', 'build/video.mp4']);

const out = path.join(root, 'Battle_Wars_S1E1_Be_Ready.mp4');
run('ffmpeg', ['-loglevel', 'error', '-y',
  '-i', 'build/video.mp4', '-i', 'build/audio.wav', '-i', 'build/captions.srt',
  '-map', '0:v', '-map', '1:a', '-map', '2:s',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', arg('crf', '21'), '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-metadata:s:s:0', 'title=English',
  '-metadata', 'title=Battle Wars - S1E1 - Be Ready!',
  '-t', String(450), out]);
console.log(`done: ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
