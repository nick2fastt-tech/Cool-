// Synthesizes the whole soundtrack (music + sound effects + footsteps) from the episode timeline.
// No samples, no voices: everything is generated here.
// Usage: node tools/audio.mjs --ep <episode-id>   ->  build/<ep>/audio.wav + build/<ep>/captions.srt
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evalTrack, buildGaitTables, gaitAt } from '../src/director.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argi = process.argv.indexOf('--ep');
const EP = argi > 0 ? process.argv[argi + 1] : 's1e1-be-ready';
const { buildEpisode } = await import(`../episodes/${EP}.js`);
const OUT = path.join(root, 'build', EP);
const SR = 48000;
const T = buildEpisode();
const N = Math.ceil(T.duration * SR) + SR;
const L = new Float32Array(N), R = new Float32Array(N);
const music = { L: new Float32Array(N), R: new Float32Array(N) };

// ------------------------------------------------------------ helpers
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TAU = Math.PI * 2;

function put(buf, t, pan = 0, vol = 1, dst = { L, R }) {
  const i0 = Math.round(t * SR);
  const gl = vol * Math.cos((pan + 1) * Math.PI / 4) * 1.414, gr = vol * Math.sin((pan + 1) * Math.PI / 4) * 1.414;
  for (let i = 0; i < buf.length; i++) {
    const k = i0 + i;
    if (k < 0 || k >= N) continue;
    dst.L[k] += buf[i] * gl; dst.R[k] += buf[i] * gr;
  }
}
const make = (dur, fn) => { const n = Math.floor(dur * SR); const b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = fn(i / SR, i, dur); return b; };
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
function lowpass(buf, cutoff) {
  const out = new Float32Array(buf.length);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    const c = typeof cutoff === 'function' ? cutoff(i / SR) : cutoff;
    const a = 1 - Math.exp(-TAU * c / SR);
    y += a * (buf[i] - y); out[i] = y;
  }
  return out;
}
function highpass(buf, cutoff) { const lp = lowpass(buf, cutoff); return buf.map((v, i) => v - lp[i]); }
function bandpass(buf, lo, hi) { return lowpass(highpass(buf, lo), hi); }
function mix(...bufs) { const n = Math.max(...bufs.map((b) => b.length)); const o = new Float32Array(n); for (const b of bufs) for (let i = 0; i < b.length; i++) o[i] += b[i]; return o; }
function sweep(dur, f0, f1, shape = 'sine', ampEnv = (t) => 1) {
  let ph = 0;
  return make(dur, (t) => {
    const f = f0 * Math.pow(f1 / f0, t / dur);
    ph += f / SR;
    const p = ph % 1;
    const v = shape === 'sine' ? Math.sin(TAU * p) : shape === 'square' ? (p < 0.5 ? 1 : -1) : shape === 'saw' ? 2 * p - 1 : 1 - 4 * Math.abs(p - 0.5);
    return v * ampEnv(t);
  });
}
const nbuf = (dur, e) => make(dur, (t) => noise() * e(t));
function partials(dur, freqs, decay, amps) { return make(dur, (t) => freqs.reduce((s, f, i) => s + Math.sin(TAU * f * t) * (amps ? amps[i] : 1 / (i + 1)) * Math.exp(-t / (decay * (1 - i * 0.12))), 0)); }
function ks(freq, dur, bright = 0.5, decay = 0.996) {
  const n = Math.floor(dur * SR), p = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(p).map(() => noise());
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const k = i % p;
    const v = line[k];
    out[i] = v;
    const nv = decay * (bright * v + (1 - bright) * last);
    last = v;
    line[k] = (nv + line[(k + 1) % p]) * 0.5;
  }
  return out;
}

// ------------------------------------------------------------ sound effects
const SFX = {
  birds: () => mix(...Array.from({ length: 7 }, (_, i) => { const s = sweep(0.12, 3200 + rnd() * 1500, 4200 + rnd() * 1500, 'sine', (t) => Math.sin(Math.PI * t / 0.12) * 0.25); const pad = new Float32Array(Math.floor((i * 0.35 + rnd() * 0.2) * SR)); return Float32Array.from([...pad, ...s]); })),
  doorBell: () => mix(partials(1.6, [1320, 3640, 7120], 0.5, [0.5, 0.2, 0.08]), Float32Array.from([...new Float32Array(Math.floor(0.18 * SR)), ...partials(1.4, [1100, 3030, 5940], 0.45, [0.45, 0.18, 0.07])])),
  doorBang: () => mix(sweep(0.35, 120, 45, 'sine', (t) => env(t, 0.002, 0.12) * 0.9), lowpass(nbuf(0.3, (t) => env(t, 0.001, 0.05)), 1800)),
  doorOpen: () => lowpass(sweep(0.6, 180, 260, 'saw', (t) => Math.sin(Math.PI * t / 0.6) * 0.25 * (0.6 + 0.4 * Math.sin(t * 90))), 1200),
  cupSet: () => mix(partials(0.25, [2400, 5100], 0.05, [0.3, 0.1]), lowpass(nbuf(0.05, (t) => env(t, 0.001, 0.01) * 0.3), 4000)),
  cupDrop: () => mix(partials(0.3, [2100, 4700, 6900], 0.06, [0.3, 0.15, 0.05]), bandpass(nbuf(0.6, (t) => env(t, 0.003, 0.15) * 0.9), 300, 2500), sweep(0.2, 200, 60, 'sine', (t) => env(t, 0.002, 0.06) * 0.5)),
  sigh: () => bandpass(nbuf(1.3, (t) => Math.sin(Math.PI * Math.min(1, t / 1.3)) ** 1.5 * 0.6), 300, 1400),
  whoosh: () => lowpass(highpass(nbuf(0.7, (t) => Math.sin(Math.PI * t / 0.7) ** 2 * 0.8), 400), (t) => 3000 - 2400 * (t / 0.7)),
  titleHit: () => mix(sweep(1.4, 90, 32, 'sine', (t) => env(t, 0.003, 0.45)), lowpass(nbuf(1.6, (t) => env(t, 0.002, 0.35) * 0.8), 5000), partials(1.5, [220, 330, 440, 660], 0.6, [0.15, 0.1, 0.08, 0.05])),
  carArrive: () => {
    const d = 3.0;
    const eng = lowpass(sweep(d, 55, 95, 'saw', (t) => Math.min(1, t * 2) * (t < 2.0 ? 0.5 : 0.5 * Math.exp(-(t - 2.0) * 3))), 500);
    const whine = sweep(d, 300, 520, 'sine', (t) => (t < 2.0 ? 0.06 : 0.06 * Math.exp(-(t - 2) * 4)));
    return mix(eng, whine);
  },
  skid: () => bandpass(nbuf(0.9, (t) => Math.sin(Math.PI * t / 0.9) * 0.6 * (0.7 + 0.3 * Math.sin(t * 160))), 1500, 4000),
  carDoor: () => mix(sweep(0.25, 140, 60, 'sine', (t) => env(t, 0.002, 0.07) * 0.8), lowpass(nbuf(0.1, (t) => env(t, 0.001, 0.02) * 0.5), 2500)),
  gamePew: () => sweep(0.14, 1800, 260, 'square', (t) => env(t, 0.002, 0.06) * 0.18),
  gameWin: () => mix(...[72, 76, 79, 84].map((m, i) => Float32Array.from([...new Float32Array(Math.floor(i * 0.11 * SR)), ...sweep(0.3, mtof(m), mtof(m), 'square', (t) => env(t, 0.005, 0.12) * 0.15)]))),
  thud: () => sweep(0.2, 110, 50, 'sine', (t) => env(t, 0.002, 0.06) * 0.6),
  alarmBeep: () => mix(sweep(0.18, 880, 880, 'square', (t) => (t < 0.16 ? 0.12 : 0)), Float32Array.from([...new Float32Array(Math.floor(0.22 * SR)), ...sweep(0.18, 660, 660, 'square', (t) => (t < 0.16 ? 0.12 : 0))])),
  zoomBeep: () => mix(sweep(1.4, 300, 1600, 'sine', (t) => 0.15 * Math.sin(Math.PI * t / 1.4)), ...[0, 1, 2, 3].map((i) => Float32Array.from([...new Float32Array(Math.floor((0.3 + i * 0.3) * SR)), ...sweep(0.07, 2000, 2000, 'sine', () => 0.15)]))),
  rumble: () => mix(lowpass(nbuf(2.4, (t) => Math.min(1, t / 1.5) * 1.6), 120), sweep(2.4, 38, 50, 'sine', (t) => Math.min(1, t / 1.5) * 0.6 * (0.7 + 0.3 * Math.sin(t * 40)))),
  boom: () => mix(sweep(1.8, 70, 28, 'sine', (t) => env(t, 0.003, 0.5) * 1.1), lowpass(nbuf(2.2, (t) => env(t, 0.002, 0.45) * 1.2), (t) => 3000 * Math.exp(-t * 2) + 150)),
  gush: () => bandpass(nbuf(2.2, (t) => Math.min(1, t * 8) * Math.exp(-t * 0.6) * (0.7 + 0.3 * Math.sin(t * 23)) * 0.9), 500, 3500),
  swirl: () => bandpass(nbuf(2.6, (t) => Math.sin(Math.PI * t / 2.6) * 0.7), (t) => 400 + 300 * Math.sin(t * 9), (t) => 2000 + 1200 * Math.sin(t * 9)),
  splash: () => mix(highpass(nbuf(0.5, (t) => env(t, 0.003, 0.1) * 0.8), 700), ...Array.from({ length: 5 }, () => Float32Array.from([...new Float32Array(Math.floor(rnd() * 0.25 * SR)), ...sweep(0.06, 400 + rnd() * 500, 1200 + rnd() * 900, 'sine', (t) => env(t, 0.002, 0.02) * 0.2)]))),
  splashLand: () => mix(SFX.splash(), sweep(0.4, 120, 50, 'sine', (t) => env(t, 0.002, 0.1) * 0.7), highpass(nbuf(0.9, (t) => env(t, 0.003, 0.25) * 0.6), 500)),
  bigSplash: () => mix(highpass(nbuf(1.2, (t) => env(t, 0.004, 0.3) * 1.0), 400), sweep(0.5, 100, 45, 'sine', (t) => env(t, 0.002, 0.15) * 0.7), SFX.splash()),
  floodRush: () => bandpass(nbuf(3.5, (t) => Math.min(1, t / 0.8) * Math.min(1, (3.5 - t) / 1) * 0.7 * (0.8 + 0.2 * Math.sin(t * 13))), 300, 2500),
  clank: () => mix(partials(0.6, [420, 1035, 1730, 2560, 3420], 0.12, [0.35, 0.25, 0.2, 0.12, 0.08]), highpass(nbuf(0.05, (t) => env(t, 0.001, 0.01) * 0.6), 2000)),
  waveWhoosh: () => lowpass(nbuf(1.3, (t) => (t / 1.3) ** 2 * 1.1), (t) => 400 + 2000 * (t / 1.3)),
  waveCrash: () => mix(bandpass(nbuf(2.0, (t) => env(t, 0.01, 0.5) * 1.1), 250, 4500), sweep(0.6, 90, 40, 'sine', (t) => env(t, 0.003, 0.18) * 0.8)),
  splashShot: () => mix(sweep(0.18, 260, 900, 'sine', (t) => env(t, 0.01, 0.06) * 0.35), highpass(nbuf(0.25, (t) => env(t, 0.005, 0.08) * 0.4), 1200)),
  growRumble: () => mix(sweep(2.0, 40, 90, 'saw', (t) => Math.min(1, t) * 0.25).map((v) => v), lowpass(nbuf(2.0, (t) => Math.min(1, t) * 0.8), 200)),
  valveCreak: () => lowpass(make(1.5, (t) => { const f = 140 + 30 * Math.sin(t * 13) + 15 * noise(); return ((t * f) % 1 < 0.5 ? 1 : -1) * 0.18 * Math.sin(Math.PI * t / 1.5) * (0.5 + 0.5 * Math.sin(t * 37)); }), 1600),
  clunk: () => mix(sweep(0.5, 95, 55, 'sine', (t) => env(t, 0.002, 0.15)), partials(0.5, [310, 760, 1290], 0.1, [0.35, 0.2, 0.1]), lowpass(nbuf(0.1, (t) => env(t, 0.001, 0.02) * 0.6), 3000)),
  shrink: () => sweep(1.7, 900, 110, 'sine', (t) => 0.35 * (1 - t / 1.7) * (0.6 + 0.4 * Math.sin(t * 50))),
  slide: () => mix(sweep(0.9, 500, 1100, 'sine', (t) => 0.14 * Math.sin(Math.PI * t / 0.9) * (1 + 0.3 * Math.sin(t * 60))), highpass(nbuf(0.9, (t) => 0.25 * Math.sin(Math.PI * t / 0.9)), 1500)),
  bonk: () => mix(sweep(0.25, 620, 300, 'sine', (t) => env(t, 0.002, 0.06) * 0.6), sweep(0.6, 200, 200, 'sine', (t) => env(t, 0.01, 0.15) * 0.25 * Math.sin(t * 120))),
  splashSteps: () => mix(...Array.from({ length: 6 }, (_, i) => Float32Array.from([...new Float32Array(Math.floor(i * 0.22 * SR)), ...highpass(nbuf(0.12, (t) => env(t, 0.002, 0.03) * 0.5), 900)]))),
  beep: () => mix(sweep(0.08, 2200, 2200, 'sine', () => 0.2), Float32Array.from([...new Float32Array(Math.floor(0.13 * SR)), ...sweep(0.1, 2900, 2900, 'sine', () => 0.2)])),
  stampede: () => mix(...Array.from({ length: 12 }, (_, i) => Float32Array.from([...new Float32Array(Math.floor(i * 0.13 * SR)), ...sweep(0.12, 120, 55, 'sine', (t) => env(t, 0.002, 0.04) * (0.3 + i * 0.05))]))),
  pizzaBox: () => mix(bandpass(nbuf(0.12, (t) => env(t, 0.002, 0.03) * 0.6), 400, 2000), Float32Array.from([...new Float32Array(Math.floor(0.25 * SR)), ...bandpass(nbuf(0.15, (t) => env(t, 0.002, 0.04) * 0.5), 300, 1800)])),
  blip: () => mix(sweep(0.25, 1760, 1760, 'sine', (t) => env(t, 0.005, 0.07) * 0.3), Float32Array.from([...new Float32Array(Math.floor(0.18 * SR)), ...sweep(0.25, 1760, 1760, 'sine', (t) => env(t, 0.005, 0.07) * 0.12)])),
  snore: () => mix(...[0, 1.1].map((d) => Float32Array.from([...new Float32Array(Math.floor(d * SR)), ...lowpass(make(0.8, (t) => (((90 + 20 * Math.sin(t * 4)) * t) % 1 < 0.5 ? 1 : -1) * Math.sin(Math.PI * t / 0.8) * 0.12 + noise() * 0.05 * Math.sin(Math.PI * t / 0.8)), 500)]))),
  holoChime: () => mix(...[76, 83, 88].map((m, i) => Float32Array.from([...new Float32Array(Math.floor(i * 0.12 * SR)), ...partials(1.2, [mtof(m), mtof(m) * 2.01], 0.4, [0.18, 0.06])]))),
  drone: () => lowpass(make(3.2, (t) => (Math.sin(TAU * 55 * t) + 0.5 * Math.sin(TAU * 82.4 * t) + 0.3 * (2 * ((55.3 * t) % 1) - 1)) * Math.sin(Math.PI * t / 3.2) * 0.35), 600),
  reactorFlash: () => mix(sweep(0.5, 220, 880, 'saw', (t) => env(t, 0.01, 0.15) * 0.15), highpass(nbuf(0.4, (t) => env(t, 0.002, 0.08) * 0.4), 3000)),
  powerDown: () => mix(lowpass(sweep(2.0, 240, 30, 'saw', (t) => 0.4 * (1 - t / 2.0)), 900), sweep(2.0, 120, 25, 'sine', (t) => 0.5 * (1 - t / 2.0)), Float32Array.from([...new Float32Array(Math.floor(1.9 * SR)), ...SFX.clunk()])),
  electricSlam: () => mix(sweep(1.4, 90, 30, 'sine', (t) => env(t, 0.002, 0.4) * 1.1), lowpass(nbuf(1.2, (t) => env(t, 0.001, 0.3)), 6000), highpass(make(1.6, (t) => (rnd() < 0.08 ? noise() : 0) * Math.exp(-t * 1.6) * 1.2), 2500), partials(1.4, [110, 165, 220], 0.5, [0.2, 0.12, 0.08])),
  rumbleDeep: () => mix(lowpass(nbuf(4.0, (t) => Math.sin(Math.PI * t / 4.0) * 1.4), 90), sweep(4.0, 30, 38, 'sine', (t) => Math.sin(Math.PI * t / 4.0) * 0.5)),
  drip: () => mix(sweep(0.08, 900, 2200, 'sine', (t) => env(t, 0.002, 0.03) * 0.3), Float32Array.from([...new Float32Array(Math.floor(0.25 * SR)), ...sweep(0.08, 900, 2200, 'sine', (t) => env(t, 0.002, 0.03) * 0.08)])),
  eyesOpen: () => mix(lowpass(nbuf(1.2, (t) => (t / 1.2) * Math.exp(-Math.max(0, t - 0.9) * 8) * 0.8), (t) => 200 + 1800 * t), sweep(1.4, 70, 140, 'saw', (t) => Math.min(1, t * 3) * Math.exp(-t * 1.5) * 0.25), partials(1.6, [440, 466, 659], 0.6, [0.08, 0.06, 0.05])),
  symbolGlow: () => mix(...[0, 1, 2, 3, 4].map((i) => Float32Array.from([...new Float32Array(Math.floor(i * 0.07 * SR)), ...sweep(0.9, 400 * (1 + i * 0.25), 1600 * (1 + i * 0.25), 'sine', (t) => Math.sin(Math.PI * t / 0.9) * 0.07)])), lowpass(nbuf(1.2, (t) => Math.sin(Math.PI * t / 1.2) * 0.3), 1200)),
  warHit: () => mix(SFX.boom(), partials(2.5, [73.4, 110, 146.8, 220], 0.9, [0.3, 0.2, 0.15, 0.08])),
  alarmKlaxon: () => lowpass(make(0.9, (t) => (((t < 0.45 ? 520 : 440) * t) % 1 < 0.5 ? 1 : -1) * 0.16 * Math.min(1, t * 30) * Math.min(1, (0.9 - t) * 20)), 2200),
  computerBeep: () => mix(sweep(0.12, 1320, 1320, 'sine', () => 0.18), Float32Array.from([...new Float32Array(Math.floor(0.16 * SR)), ...sweep(0.16, 990, 990, 'sine', (t) => 0.18 * Math.min(1, (0.16 - t) * 30))])),
  buzzer: () => lowpass(make(0.7, (t) => (((120 * t) % 1) < 0.5 ? 1 : -1) * 0.4 * (0.7 + 0.3 * Math.sin(t * 300)) * Math.min(1, (0.7 - t) * 20)), 3000),
  slap: () => mix(highpass(nbuf(0.12, (t) => env(t, 0.001, 0.02) * 1.0), 800), sweep(0.15, 180, 90, 'sine', (t) => env(t, 0.001, 0.04) * 0.6)),
  powerUp: () => mix(lowpass(sweep(1.4, 40, 260, 'saw', (t) => 0.35 * Math.min(1, t * 2)), 1000), sweep(1.4, 60, 180, 'sine', (t) => 0.3 * Math.min(1, t))),
  doorSlide: () => mix(lowpass(nbuf(1.2, (t) => Math.sin(Math.PI * t / 1.2) * 0.5), 600), sweep(1.2, 90, 70, 'saw', (t) => Math.sin(Math.PI * t / 1.2) * 0.1), Float32Array.from([...new Float32Array(Math.floor(1.1 * SR)), ...SFX.carDoor()])),
  dripEcho: () => mix(SFX.drip(), Float32Array.from([...new Float32Array(Math.floor(0.4 * SR)), ...SFX.drip().map((v) => v * 0.4)]), Float32Array.from([...new Float32Array(Math.floor(0.8 * SR)), ...SFX.drip().map((v) => v * 0.15)])),
  bookThump: () => mix(sweep(0.15, 160, 80, 'sine', (t) => env(t, 0.001, 0.04) * 0.6), bandpass(nbuf(0.08, (t) => env(t, 0.001, 0.02) * 0.4), 300, 2000)),
  blipRed: () => mix(...[0, 0.18, 0.36].map((d) => Float32Array.from([...new Float32Array(Math.floor(d * SR)), ...sweep(0.1, 1600, 1600, 'sine', (t) => env(t, 0.003, 0.04) * 0.25)]))),
  groan: () => lowpass(sweep(0.9, 180, 120, 'saw', (t) => Math.sin(Math.PI * t / 0.9) * 0.15), 700),
  pageFlip: () => highpass(nbuf(0.12, (t) => Math.sin(Math.PI * t / 0.12) * 0.35), 2000),
  scribble: () => bandpass(nbuf(0.4, (t) => (0.5 + 0.5 * Math.sin(t * 60)) * 0.25), 2000, 6000),
  flameIgnite: () => mix(lowpass(highpass(nbuf(0.9, (t) => env(t, 0.02, 0.3) * 0.9), 200), (t) => 800 + 3000 * Math.exp(-t * 3)), highpass(make(1.0, (t) => (rnd() < 0.03 ? noise() : 0) * Math.exp(-t * 2)), 1500)),
  fireCrackle: () => mix(lowpass(nbuf(3.0, (t) => Math.min(1, t * 2, (3 - t) * 2) * 0.25), 900), highpass(make(3.0, (t) => (rnd() < 0.015 ? noise() * 0.7 : 0) * Math.min(1, t * 2, (3 - t) * 2)), 1200)),
  metalCrash: () => mix(partials(1.4, [180, 433, 712, 1190, 1677], 0.35, [0.4, 0.3, 0.22, 0.15, 0.1]), lowpass(nbuf(1.0, (t) => env(t, 0.002, 0.25) * 0.9), 4000), sweep(0.5, 90, 40, 'sine', (t) => env(t, 0.002, 0.15) * 0.8)),
  buttonClick: () => mix(highpass(nbuf(0.03, (t) => env(t, 0.001, 0.005) * 0.6), 3000), sweep(0.05, 1800, 1800, 'square', (t) => env(t, 0.001, 0.01) * 0.1)),
  whisper: () => bandpass(nbuf(2.4, (t) => Math.sin(Math.PI * t / 2.4) * (0.4 + 0.3 * Math.sin(t * 9)) * 0.7), (t) => 1200 + 600 * Math.sin(t * 5), (t) => 4000 + 1000 * Math.sin(t * 5)),
  energyCharge: () => mix(sweep(1.0, 120, 900, 'saw', (t) => (t / 1.0) * 0.12), lowpass(nbuf(1.0, (t) => (t / 1.0) * 0.4), (t) => 300 + 2500 * t)),
  darkBlast: () => mix(sweep(0.5, 900, 120, 'saw', (t) => env(t, 0.005, 0.15) * 0.3), lowpass(nbuf(0.5, (t) => env(t, 0.002, 0.15) * 0.7), 2500), sweep(0.5, 300, 60, 'sine', (t) => env(t, 0.003, 0.15) * 0.4)),
  blastImpact: () => mix(SFX.boom().map((v) => v * 0.7), lowpass(nbuf(0.8, (t) => env(t, 0.002, 0.2) * 0.5), 5000)),
  slideScrape: () => bandpass(nbuf(0.7, (t) => Math.sin(Math.PI * t / 0.7) * 0.6), 600, 3500),
  pipeClang: () => partials(1.0, [520, 1310, 2140, 3020], 0.25, [0.4, 0.25, 0.15, 0.1]),
  crystalHum: () => mix(partials(2.0, [330, 495, 660], 1.0, [0.08, 0.05, 0.04]), make(2.0, (t) => Math.sin(TAU * 110 * t) * 0.06 * Math.sin(Math.PI * t / 2))),
  crystalPower: () => mix(sweep(1.2, 200, 1600, 'saw', (t) => Math.sin(Math.PI * t / 1.2) * 0.15), SFX.symbolGlow(), sweep(0.8, 80, 40, 'sine', (t) => env(t, 0.01, 0.3) * 0.6)),
  punchHit: () => mix(sweep(0.4, 140, 45, 'sine', (t) => env(t, 0.001, 0.1) * 1.1), lowpass(nbuf(0.3, (t) => env(t, 0.001, 0.05) * 1.0), 3500), highpass(nbuf(0.06, (t) => env(t, 0.001, 0.01) * 0.6), 4000)),
  energyWave: () => mix(lowpass(nbuf(2.0, (t) => env(t, 0.05, 0.6) * 1.0), (t) => 2500 * Math.exp(-t * 1.5) + 200), sweep(2.0, 220, 40, 'saw', (t) => env(t, 0.05, 0.5) * 0.25), sweep(1.5, 60, 30, 'sine', (t) => env(t, 0.01, 0.5) * 0.7)),
  shockwave: () => mix(SFX.boom(), sweep(0.8, 400, 60, 'saw', (t) => env(t, 0.002, 0.2) * 0.25)),
  smokeDissolve: () => lowpass(nbuf(2.6, (t) => Math.sin(Math.PI * Math.min(1, t / 2.6)) * 0.55 * Math.exp(-t * 0.4)), (t) => 3000 * Math.exp(-t) + 300),
  breathing: () => mix(...[0, 1.1].map((d) => Float32Array.from([...new Float32Array(Math.floor(d * SR)), ...bandpass(nbuf(0.8, (t) => Math.sin(Math.PI * t / 0.8) * 0.3), 400, 2500)]))),
  clink: () => partials(0.5, [2800, 4100, 6300], 0.12, [0.2, 0.1, 0.05]),
  blackPulse: () => mix(sweep(1.6, 55, 55, 'sine', (t) => Math.sin(Math.PI * t / 1.6) * 0.4 * (0.5 + 0.5 * Math.sin(t * 12))), partials(1.6, [233, 277], 0.8, [0.06, 0.05])),
  echo: () => new Float32Array(10),
  claps: () => mix(...[0, 0.55, 1.1, 1.65].map((d) => Float32Array.from([...new Float32Array(Math.floor(d * SR)), ...highpass(nbuf(0.06, (t) => env(t, 0.001, 0.012) * 0.6), 1200)]))),
  sneakyClick: () => mix(highpass(nbuf(0.02, (t) => env(t, 0.001, 0.004) * 0.5), 3000), Float32Array.from([...new Float32Array(Math.floor(0.08 * SR)), ...highpass(nbuf(0.02, (t) => env(t, 0.001, 0.004) * 0.4), 3000)])),
  teleport: () => mix(sweep(0.9, 200, 3000, 'saw', (t) => env(t, 0.02, 0.3) * 0.2), highpass(nbuf(1.0, (t) => env(t, 0.01, 0.3) * 0.7), 1500), sweep(1.0, 80, 30, 'sine', (t) => env(t, 0.005, 0.3) * 0.8)),
  cutBlack: () => sweep(0.8, 60, 35, 'sine', (t) => env(t, 0.005, 0.3) * 0.5),
};
const sfxCache = {};
for (const e of T.sfx) {
  const fn = SFX[e.name];
  if (!fn) { console.warn('missing sfx', e.name); continue; }
  const reps = e.repeat ?? 1;
  for (let r = 0; r < reps; r++) {
    seed = 999 + Math.floor(e.t * 100) + r;
    const buf = (reps > 1 || !sfxCache[e.name]) ? fn() : sfxCache[e.name];
    sfxCache[e.name] = buf;
    put(buf, e.t + r * (e.every ?? 0), (rnd() - 0.5) * 0.4, e.vol * 0.9);
  }
}

// ------------------------------------------------------------ footsteps from the animation
const setAt = (t) => { let s = T.sets[0].set; for (const e of T.sets) if (e.t0 <= t) s = e.set; return s; };
const gait = buildGaitTables(T, ['aaron', 'flare', 'eric', 'barista', 'leon', 'greg'], 1 / 96);
const step = { soft: sweep(0.09, 140, 70, 'sine', (t) => env(t, 0.002, 0.025) * 0.5), tap: highpass(nbuf(0.04, (t) => env(t, 0.001, 0.008) * 0.25), 2500) };
for (const c of Object.keys(gait)) {
  const tab = gait[c];
  let lastStep = -1;
  for (let i = 1; i < tab.phase.length; i++) {
    const t = i * tab.dt;
    const st = Math.floor(tab.phase[i] / Math.PI);
    if (st !== lastStep && lastStep >= 0) {
      const vis = (evalTrack(T.tracks[`${c}.vis`], t) ?? 0) > 0.5;
      const set = setAt(t);
      const sp = tab.speed[i];
      if (vis && sp > 0.3 && !['title', 'black'].includes(set)) {
        const vol = Math.min(1, 0.35 + sp * 0.15);
        put(step.soft, t, (st % 2 ? -0.15 : 0.15), vol);
        put(step.tap, t, 0, vol * (set === 'control' ? 1.2 : 0.8));
        const flood = evalTrack(T.tracks.flood, t) ?? 0;
        if (set === 'city' && flood > 0.08) { seed = i; put(highpass(nbuf(0.14, (tt) => env(tt, 0.002, 0.04) * 0.35), 900), t, 0, vol); }
      }
    }
    lastStep = st;
  }
}
// reactor hum + cavern wind
for (let t = 0; t < T.duration; t += 0.5) {
  const set = setAt(t);
  seed = Math.floor(t * 10) + 7;
  if (set === 'reactor') {
    const pw = evalTrack(T.tracks['reactor.power'], t) ?? 1;
    if (pw > 0.02) put(make(0.6, (tt) => (Math.sin(TAU * 60 * (t + tt)) * 0.6 + Math.sin(TAU * 120 * (t + tt)) * 0.3 + Math.sin(TAU * 180 * (t + tt)) * 0.1) * Math.sin(Math.PI * tt / 0.6) * 0.16 * pw), t, 0, 1);
  } else if (set === 'cavern') {
    put(lowpass(nbuf(0.6, (tt) => Math.sin(Math.PI * tt / 0.6) * 0.18), 350), t, (rnd() - 0.5) * 0.6, 1);
  }
}
// constant water ambience while the hydrant gushes / city flooded
for (let t = 0; t < T.duration; t += 0.5) {
  const flow = evalTrack(T.tracks['hyd.flow'], t) ?? 0;
  const flood = evalTrack(T.tracks.flood, t) ?? 0;
  if (setAt(t) !== 'city') continue;
  const amt = flow * 0.5 + flood * 0.3;
  if (amt < 0.02) continue;
  seed = Math.floor(t * 10);
  put(bandpass(nbuf(0.6, (tt) => Math.sin(Math.PI * tt / 0.6) * amt), 400, 3000), t, (rnd() - 0.5) * 0.3, 0.6);
}

// ------------------------------------------------------------ music
const kick = sweep(0.3, 150, 42, 'sine', (t) => env(t, 0.001, 0.09));
const snare = mix(highpass(nbuf(0.2, (t) => env(t, 0.001, 0.05) * 0.6), 1500), sweep(0.12, 220, 160, 'sine', (t) => env(t, 0.001, 0.04) * 0.4));
const clap = highpass(nbuf(0.18, (t) => (env(t, 0.001, 0.01) + env(Math.max(0, t - 0.012), 0.001, 0.01) + env(Math.max(0, t - 0.025), 0.001, 0.04)) * 0.35), 900);
const hat = highpass(nbuf(0.05, (t) => env(t, 0.001, 0.012) * 0.3), 7000);
const shaker = highpass(nbuf(0.08, (t) => Math.sin(Math.PI * t / 0.08) * 0.15), 5000);
const CH = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom: [0, 4, 7, 10], pow: [0, 7, 12] };

function tone(freq, dur, kind, vol) {
  if (kind === 'pluck') return ks(freq, dur + 0.4, 0.5, 0.995).map((v, i) => v * vol * Math.min(1, (dur + 0.4 - i / SR) * 8));
  if (kind === 'marimba') return make(dur + 0.3, (t) => (Math.sin(TAU * freq * t) + 0.3 * Math.sin(TAU * freq * 4 * t) * Math.exp(-t * 30)) * Math.exp(-t * 6) * vol);
  if (kind === 'bell') return make(dur + 0.6, (t) => (Math.sin(TAU * freq * t) + 0.4 * Math.sin(TAU * freq * 2.76 * t)) * Math.exp(-t * 3.5) * vol);
  if (kind === 'bass') return lowpass(make(dur, (t) => (2 * ((freq * t) % 1) - 1) * Math.min(1, t * 200) * Math.min(1, (dur - t) * 40) * vol), 380 + freq * 2);
  if (kind === 'sub') return make(dur, (t) => Math.sin(TAU * freq * t) * Math.min(1, t * 200) * Math.min(1, (dur - t) * 30) * vol);
  if (kind === 'tuba') return lowpass(make(dur, (t) => ((freq * t) % 1 < 0.5 ? 1 : -1) * Math.min(1, t * 60) * Math.exp(-t * 3) * vol), 600);
  if (kind === 'lead') return lowpass(make(dur, (t) => { const f = freq * (1 + 0.006 * Math.sin(TAU * 5.5 * t) * Math.min(1, t * 3)); return (((f * t) % 1 < 0.5 ? 1 : -1) * 0.6 + (2 * ((f * t * 1.003) % 1) - 1) * 0.4) * Math.min(1, t * 80) * Math.min(1, (dur - t) * 20) * vol; }), 3200);
  if (kind === 'brass') return lowpass(make(dur, (t) => (2 * ((freq * t) % 1) - 1 + 2 * ((freq * 1.004 * t) % 1) - 1) * 0.5 * Math.min(1, t * 25) * Math.min(1, (dur - t) * 15) * vol), (t) => 800 + 2500 * Math.min(1, t * 6));
  if (kind === 'pad') return lowpass(make(dur, (t) => ((2 * ((freq * t) % 1) - 1) + (2 * ((freq * 1.007 * t) % 1) - 1) + (2 * ((freq * 0.995 * t) % 1) - 1)) / 3 * Math.min(1, t / 0.4) * Math.min(1, (dur - t) / 0.3) * vol), 1400);
  if (kind === 'stab') return lowpass(make(dur, (t) => (2 * ((freq * t) % 1) - 1) * Math.exp(-t * 9) * vol), 2500);
  if (kind === 'pizz') return make(dur + 0.2, (t) => Math.sin(TAU * freq * t + Math.sin(TAU * freq * 2 * t) * Math.exp(-t * 20)) * Math.exp(-t * 9) * vol);
  return make(dur, (t) => Math.sin(TAU * freq * t) * vol);
}

// Song styles: chords (root midi + quality, one per bar), drum grid (16 steps), bass rhythm, lead melody
const STYLES = {
  morning: { bpm: 96, key: 60, prog: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']], drums: { shaker: 'x.x.x.x.x.x.x.x.' }, bass: 'x.......x.......', bassKind: 'sub', comp: { kind: 'pluck', rhythm: 'x..x..x...x..x..', vol: 0.18 }, lead: { kind: 'bell', notes: [76, -1, 79, -1, 81, -1, 79, 76, 74, -1, 72, -1, 74, -1, -1, -1], vol: 0.07 } },
  theme: { bpm: 140, key: 62, prog: [[0, 'min'], [-4, 'maj'], [-2, 'maj'], [-5, 'maj']], drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, bass: 'x.xx.xx.x.xx.xx.', bassKind: 'bass', comp: { kind: 'brass', rhythm: 'x.....x.....x...', vol: 0.09, len: 0.18 }, lead: { kind: 'lead', notes: [74, -1, 74, 77, -1, 76, 74, -1, 72, -1, 72, 74, -1, 76, -1, -1, 81, -1, 79, 77, -1, 76, 74, -1, 76, -1, -1, -1, 73, -1, -1, -1], vol: 0.11 } },
  hq: { bpm: 112, key: 60, prog: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']], drums: { kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x...x...x...x.' }, bass: 'x..x..x.x..x..x.', bassKind: 'sub', comp: { kind: 'marimba', rhythm: 'x.xx.x.xx.x.x.xx', vol: 0.12, arp: true }, lead: null },
  dance: { bpm: 124, key: 57, prog: [[0, 'min7'], [5, 'dom']], drums: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.' }, bass: 'x..x.x..x..x.xx.', bassKind: 'bass', comp: { kind: 'stab', rhythm: '..x...x...x..x..', vol: 0.08 }, lead: null },
  mystery: { bpm: 88, key: 57, prog: [[0, 'min'], [-4, 'maj'], [-7, 'min'], [-5, 'maj']], drums: { hat: 'x...x...x...x...' }, bass: 'x.......x.......', bassKind: 'sub', pad: 0.06, comp: { kind: 'bell', rhythm: 'x.......x...x...', vol: 0.06, arp: true }, lead: null },
  drive: { bpm: 132, key: 64, prog: [[0, 'min'], [-4, 'maj'], [-2, 'maj'], [0, 'min']], drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx' }, bass: 'xxxxxxxxxxxxxxxx', bassKind: 'bass', comp: { kind: 'stab', rhythm: 'x.....x.....x...', vol: 0.07 }, lead: null },
  villain: { bpm: 104, key: 52, prog: [[0, 'min'], [1, 'maj'], [0, 'min'], [-1, 'dom']], drums: { kick: 'x.......x.......', snare: '....x.......x...' }, bass: 'x...x...x...x...', bassKind: 'tuba', comp: { kind: 'pizz', rhythm: '..x...x...x...x.', vol: 0.12 }, lead: null },
  action: { bpm: 150, key: 64, prog: [[0, 'min'], [-4, 'maj'], [-2, 'maj'], [-1, 'maj']], drums: { kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'x.xxx.xxx.xxx.xx' }, bass: 'x.xxx.xxx.xxx.xx', bassKind: 'bass', pad: 0.035, comp: { kind: 'brass', rhythm: 'x..x..x.........', vol: 0.07, len: 0.15 }, lead: { kind: 'lead', notes: [76, -1, 79, -1, 83, -1, 81, 79, 76, -1, -1, -1, 74, 76, 78, -1], vol: 0.06 } },
  tense: { bpm: 140, key: 62, prog: [[0, 'min'], [1, 'maj'], [0, 'min'], [3, 'maj']], drums: { kick: 'x...x...x...x...', hat: 'x.x.x.x.x.x.x.x.', snare: '............x...' }, bass: 'x.x.x.x.x.x.x.x.', bassKind: 'bass', pad: 0.05, comp: { kind: 'pluck', rhythm: 'xxxxxxxxxxxxxxxx', vol: 0.07, arp: true }, lead: null },
  comedy: { bpm: 120, key: 65, prog: [[0, 'maj'], [-1, 'dom'], [-3, 'min'], [-5, 'dom']], drums: { kick: 'x.......x.......', snare: '....x.......x...' }, bass: 'x...x...x...x...', bassKind: 'tuba', comp: { kind: 'pizz', rhythm: 'x.x.x.x.x.x.x.x.', vol: 0.11, arp: true }, lead: null },
  victory: { bpm: 130, key: 60, prog: [[0, 'maj'], [5, 'maj'], [7, 'maj'], [0, 'maj']], drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, bass: 'x.x.x.x.x.x.x.x.', bassKind: 'bass', comp: { kind: 'brass', rhythm: 'x.....x.x.......', vol: 0.1, len: 0.25 }, lead: { kind: 'lead', notes: [72, -1, 76, -1, 79, -1, 84, -1, -1, -1, 79, -1, 84, -1, -1, -1], vol: 0.09 } },
  ominous: { bpm: 70, key: 50, prog: [[0, 'min'], [-4, 'maj'], [1, 'maj'], [0, 'min']], drums: { kick: 'x.........x.....' }, bass: 'x...............', bassKind: 'sub', pad: 0.07, comp: { kind: 'bell', rhythm: 'x.......x.......', vol: 0.05, arp: true }, lead: null },
  darkTheme: { bpm: 140, key: 50, prog: [[0, 'min'], [-2, 'maj'], [-4, 'maj'], [-5, 'maj']], drums: { kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, bass: 'x.xx.xx.x.xx.xx.', bassKind: 'bass', pad: 0.05, comp: { kind: 'brass', rhythm: 'x.....x.....x...', vol: 0.1, len: 0.2 }, lead: null },
  soul: { bpm: 60, key: 45, prog: [[0, 'min'], [1, 'maj']], drums: { kick: 'x...............' }, bass: 'x...............', bassKind: 'sub', pad: 0.08, comp: null, lead: null },
  adventure: { bpm: 96, key: 50, prog: [[0, 'min'], [-2, 'maj'], [-4, 'maj'], [-2, 'maj']], drums: { kick: 'x.......x.......', hat: '..x...x...x...x.', snare: '....x.......x...' }, bass: 'x..x....x..x....', bassKind: 'sub', pad: 0.035, comp: { kind: 'pluck', rhythm: 'x.x...x.x.x...x.', vol: 0.08, arp: true }, lead: null },
  sad: { bpm: 66, key: 57, prog: [[0, 'min'], [-4, 'maj'], [-9, 'maj'], [-2, 'maj']], drums: {}, bass: 'x...............', bassKind: 'sub', pad: 0.07, comp: { kind: 'bell', rhythm: 'x...x...x...x...', vol: 0.06, arp: true }, lead: null },
  heroic: { bpm: 140, key: 57, prog: [[0, 'min'], [-4, 'maj'], [-2, 'maj'], [-5, 'maj']], drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, bass: 'x.x.x.x.x.x.x.x.', bassKind: 'bass', pad: 0.04, comp: { kind: 'brass', rhythm: 'x.....x.x.......', vol: 0.1, len: 0.25 }, lead: { kind: 'lead', notes: [69, -1, 72, -1, 76, -1, 74, 72, 74, -1, -1, -1, 72, 71, 69, -1], vol: 0.08 } },
  chill: { bpm: 84, key: 53, prog: [[0, 'maj7'], [-1, 'min7'], [-3, 'min7'], [-5, 'maj7']], drums: { kick: 'x.........x.....', snare: '....x.......x...', hat: '..x...x...x...x.' }, bass: 'x.......x..x....', bassKind: 'sub', comp: { kind: 'marimba', rhythm: 'x...x.x...x...x.', vol: 0.1 }, lead: null },
};

function renderMusic(name, t0, t1, vol, fadeIn, fadeOut) {
  const st = STYLES[name];
  if (!st || t1 <= t0) return;
  const tmp = { L: new Float32Array(Math.ceil((t1 - t0 + 2) * SR)), R: new Float32Array(Math.ceil((t1 - t0 + 2) * SR)) };
  const sixteenth = 60 / st.bpm / 4;
  const steps = Math.ceil((t1 - t0) / sixteenth);
  const putT = (buf, t, pan, v) => put(buf, t, pan, v, { L: tmp.L, R: tmp.R });
  const cache = {};
  const memo = (k, fn) => (cache[k] ||= fn());
  for (let s = 0; s < steps; s++) {
    const t = s * sixteenth;
    const bar = Math.floor(s / 16), pos = s % 16;
    const [rootOff, q] = st.prog[bar % st.prog.length];
    const root = st.key + rootOff;
    const chord = CH[q].map((n) => root + n);
    const d = st.drums;
    if (d.kick?.[pos] === 'x') putT(kick, t, 0, 0.55);
    if (d.snare?.[pos] === 'x') putT(snare, t, 0.05, 0.4);
    if (d.clap?.[pos] === 'x') putT(clap, t, -0.05, 0.5);
    if (d.hat?.[pos] === 'x') putT(hat, t, 0.3, 0.35);
    if (d.shaker?.[pos] === 'x') putT(shaker, t, -0.3, 0.4);
    if (st.bass[pos] === 'x') {
      const oct = st.bassKind === 'bass' && pos % 4 === 2 ? 12 : 0;
      const f = mtof(root - 24 + oct);
      putT(memo(`b${root}${oct}`, () => tone(f, sixteenth * 1.8, st.bassKind, 0.32)), t, 0, 1);
    }
    if (st.comp && st.comp.rhythm[pos] === 'x') {
      const notes = st.comp.arp ? [chord[(s / 2 | 0) % chord.length] + 12] : chord.map((n) => n + 12);
      for (const [i, n] of notes.entries()) putT(memo(`c${n}`, () => tone(mtof(n), (st.comp.len ?? 0.3) / (st.bpm / 120), st.comp.kind, st.comp.vol)), t, (i - 1) * 0.3, 1);
    }
    if (st.pad && pos === 0) for (const [i, n] of chord.entries()) putT(memo(`p${n}`, () => tone(mtof(n), sixteenth * 16, 'pad', st.pad)), t, (i - 1) * 0.5, 1);
    if (st.lead) {
      const notes = st.lead.notes;
      const idx = (s / 2 | 0) % notes.length;
      if (s % 2 === 0 && notes[idx] > 0 && bar % 4 >= 1) {
        let len = 1; while (notes[(idx + len) % notes.length] === -1 && len < 4) len++;
        putT(memo(`l${notes[idx]}${len}`, () => tone(mtof(notes[idx]), len * sixteenth * 2 * 0.95, st.lead.kind, st.lead.vol)), t, 0.1, 1);
      }
    }
  }
  const i0 = Math.round(t0 * SR), n = Math.round((t1 - t0) * SR);
  for (let i = 0; i < n + Math.round(fadeOut * SR); i++) {
    const tt = i / SR;
    let g = vol * Math.min(1, fadeIn > 0 ? tt / fadeIn : 1);
    if (tt > t1 - t0) g *= Math.max(0, 1 - (tt - (t1 - t0)) / Math.max(0.01, fadeOut));
    const k = i0 + i;
    if (k >= N || i >= tmp.L.length) break;
    music.L[k] += tmp.L[i] * g; music.R[k] += tmp.R[i] * g;
  }
}
const cues = [...T.music].sort((a, b) => a.t - b.t);
cues.forEach((c, i) => {
  const next = cues[i + 1];
  const end = next ? next.t : T.duration;
  if (c.name === 'none') return;
  const fadeOut = next ? Math.max(0.05, next.fade ?? 0.5) : 1.5;
  console.log(`music ${c.name} ${c.t.toFixed(1)} -> ${end.toFixed(1)}`);
  renderMusic(c.name, c.t, end, c.vol * 0.75, c.fade ?? 0.3, fadeOut);
});

// ------------------------------------------------------------ mixdown
let peak = 0;
const fadeEnd = (i) => { const t = i / SR; return t > T.duration - 1.5 ? Math.max(0, (T.duration - t) / 1.5) : 1; };
for (let i = 0; i < N; i++) {
  const g = fadeEnd(i);
  L[i] = Math.tanh((L[i] + music.L[i]) * 0.9) * g;
  R[i] = Math.tanh((R[i] + music.R[i]) * 0.9) * g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / Math.max(peak, 1e-6);
const outLen = Math.round(T.duration * SR);
const data = Buffer.alloc(outLen * 4);
for (let i = 0; i < outLen; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), i * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24);
hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'audio.wav'), Buffer.concat([hdr, data]));

// ------------------------------------------------------------ captions file (soft subtitles)
const NAMES = { aaron: 'AARON', flare: 'FLARE', eric: 'ERIC', water: 'WATER GUY', barista: 'BARISTA', leon: 'LEON', greg: 'GREG', soul: 'SOUL STEALER' };
const ts = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const srt = [...T.captions].sort((a, b) => a.t0 - b.t0).map((c, i) => `${i + 1}\n${ts(c.t0)} --> ${ts(c.t1)}\n${c.sound ? `[${c.text}]` : `${c.label ?? NAMES[c.who]}: ${c.text}`}\n`).join('\n');
fs.writeFileSync(path.join(OUT, 'captions.srt'), srt);
console.log('audio + captions written, peak', peak.toFixed(2));
