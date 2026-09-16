// T10 World - core math, deterministic RNG, noise, curves
import * as THREE from '../../vendor/three.module.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function clampv(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerpv(a, b, t) { return a + (b - a) * t; }
export function invLerp(a, b, v) { return b === a ? 0 : (v - a) / (b - a); }
export function remap(v, a, b, c, d) { return c + (d - c) * clamp01(invLerp(a, b, v)); }
export function smooth01(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
/** GLSL-style smoothstep: 0 below edge0, 1 above edge1, eased between. */
export function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1e-6));
  return t * t * (3 - 2 * t);
}
export function smoother01(t) { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); }
export function pingPong(t, len) { const l = len * 2; const m = ((t % l) + l) % l; return m > len ? l - m : m; }
export function wrapAngle(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
export function angleLerp(a, b, t) { return a + wrapAngle(b - a) * clamp01(t); }
// Frame-rate independent exponential smoothing. `rate` = fraction remaining after 1s.
export function damp(cur, target, rate, dt) { return target + (cur - target) * Math.pow(rate, dt); }
export function dampAngle(cur, target, rate, dt) { return wrapAngle(target + wrapAngle(cur - target) * Math.pow(rate, dt)); }
export function moveToward(cur, target, maxDelta) {
  const d = target - cur;
  if (Math.abs(d) <= maxDelta) return target;
  return cur + Math.sign(d) * maxDelta;
}

/** Mulberry32: tiny, fast, deterministic PRNG. */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const fn = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.range = (lo, hi) => lo + fn() * (hi - lo);
  fn.int = (lo, hi) => Math.floor(lo + fn() * (hi - lo + 1));
  fn.pick = (arr) => arr[Math.floor(fn() * arr.length) % arr.length];
  fn.chance = (p) => fn() < p;
  fn.sign = () => (fn() < 0.5 ? -1 : 1);
  // Bell-ish distribution, mean 0.5 — good for human variation.
  fn.bell = () => (fn() + fn() + fn()) / 3;
  fn.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(fn() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  fn.weighted = (entries) => {
    // entries: [[value, weight], ...]
    let total = 0;
    for (const e of entries) total += e[1];
    let r = fn() * total;
    for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  };
  return fn;
}

/** Hash a string to a 32-bit seed. */
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic hash of integer coordinates -> [0,1). Used for stable chunk content. */
export function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + (seed || 0) * 1442695040888963407) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function hash3(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + (seed || 0) * 97) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Classic value noise with smooth interpolation; cheap and plenty for terrain. */
export function valueNoise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smoother01(xf), v = smoother01(yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return lerpv(lerpv(a, b, u), lerpv(c, d, u), v);
}

/** Fractal brownian motion over value noise. Returns roughly [0,1]. */
export function fbm2(x, y, octaves, seed, lacunarity, gain) {
  lacunarity = lacunarity || 2.0;
  gain = gain || 0.5;
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, y * freq, (seed || 0) + i * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged noise — good for mountains / rocky countryside. */
export function ridged2(x, y, octaves, seed) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise2(x * freq, y * freq, (seed || 0) + i * 733) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Cheap 1D noise for wind gusts, engine jitter, camera shake. */
export function noise1(t, seed) {
  const i = Math.floor(t);
  const f = smoother01(t - i);
  return lerpv(hash2(i, 0, seed), hash2(i + 1, 0, seed), f);
}

/** Catmull-Rom through a list of Vector3 — used for roads and paths. */
export function catmullRom(points, t) {
  const n = points.length;
  if (n === 0) return new THREE.Vector3();
  if (n === 1) return points[0].clone();
  const ft = clamp01(t) * (n - 1);
  const i = Math.min(Math.floor(ft), n - 2);
  const f = ft - i;
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(n - 1, i + 2)];
  const f2 = f * f, f3 = f2 * f;
  return new THREE.Vector3(
    0.5 * ((2 * p1.x) + (-p0.x + p2.x) * f + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f3),
    0.5 * ((2 * p1.y) + (-p0.y + p2.y) * f + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f3),
    0.5 * ((2 * p1.z) + (-p0.z + p2.z) * f + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * f2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * f3)
  );
}

/** Distance from point to segment in the XZ plane. */
export function distToSeg2D(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = clamp01(t);
  const cx = ax + dx * t, cz = az + dz * t;
  return { dist: Math.hypot(px - cx, pz - cz), t, x: cx, z: cz };
}

/** English plural for reply text: "3 benches", not "3 benchs". */
const IRREGULAR_PLURALS = {
  person: 'people', man: 'men', woman: 'women', child: 'children',
  foot: 'feet', tooth: 'teeth', mouse: 'mice', goose: 'geese', ox: 'oxen',
  sheep: 'sheep', deer: 'deer', fish: 'fish',
};

export function plural(word, n) {
  if (n === 1) return word;
  const irr = IRREGULAR_PLURALS[word.toLowerCase()];
  if (irr) return word[0] === word[0].toUpperCase() ? irr[0].toUpperCase() + irr.slice(1) : irr;
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + 'es';
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  return word + 's';
}

/** Human-readable height formatting, e.g. 1.83 -> 6'0". */
export function metersToFeetInches(m) {
  const totalIn = m / 0.0254;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  return ft + "'" + inch + '"';
}
export function feetInchesToMeters(ft, inch) { return (ft * 12 + inch) * 0.0254; }

/** Reusable scratch vectors so hot loops never allocate. */
export const scratch = {
  v1: new THREE.Vector3(), v2: new THREE.Vector3(), v3: new THREE.Vector3(),
  v4: new THREE.Vector3(), v5: new THREE.Vector3(),
  q1: new THREE.Quaternion(), q2: new THREE.Quaternion(),
  m1: new THREE.Matrix4(), m2: new THREE.Matrix4(),
  e1: new THREE.Euler(), c1: new THREE.Color(), c2: new THREE.Color(),
};
