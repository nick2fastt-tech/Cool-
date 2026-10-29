// ============================================================================
// HUMAN TEST 3D — core utilities (math, RNG, events, pools, logging)
// ============================================================================
'use strict';

const HT = {};                 // global namespace (exposed as window.HT3D for debugging)
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const V3 = THREE.Vector3, QT = THREE.Quaternion, M4 = THREE.Matrix4;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function invLerp(a, b, v) { return (v - a) / (b - a); }
function remap(v, a, b, c, d) { return c + (d - c) * clamp01((v - a) / (b - a)); }
function smoothstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function smooth01(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
function damp(cur, target, lambda, dt) { return lerp(cur, target, 1 - Math.exp(-lambda * dt)); }
function wrapAngle(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
function angleDamp(a, b, lambda, dt) { return a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt)); }
function gauss(x, mu, sigma) { const d = (x - mu) / sigma; return Math.exp(-0.5 * d * d); }
function sign(v) { return v < 0 ? -1 : 1; }
function fmt(v, d = 2) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
function pad3(n) { return String(n).padStart(3, '0'); }
function nowMs() { return performance.now(); }

// --- deterministic hashing / RNG -------------------------------------------
function hash32(a, b) {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ ((b >>> 0) + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
class RNG {
  constructor(seed) { this.seed = (seed >>> 0); this.s = this.seed ^ 0xa5a5a5a5; }
  next() {
    let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
  chance(p) { return this.next() < p; }
  normal(mean = 0, sd = 1) {
    let u = 0; while (u === 0) u = this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }
  weighted(list) { // [[weight, value], ...]
    let total = 0; for (const e of list) total += e[0];
    let r = this.next() * total;
    for (const e of list) { r -= e[0]; if (r <= 0) return e[1]; }
    return list[list.length - 1][1];
  }
  fork(salt) { return new RNG(hash32(this.seed, typeof salt === 'string' ? hashString(salt) : salt)); }
}
const GlobalRNG = new RNG((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
function newSeed() { return (GlobalRNG.next() * 0xffffffff) >>> 0; }

// Cheap value noise (deterministic, used by procedural textures/terrain)
function hash2(ix, iy) { return (hash32(ix * 374761393 + 1, iy * 668265263 + 7) & 0xffff) / 65535; }
function valueNoise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
function fbm2(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * valueNoise2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
function noise3(x, y, z) { // smooth-ish 3D noise from 2D slices
  return (valueNoise2(x + z * 1.7, y - z * 0.9) + valueNoise2(y * 1.3 - 7.1, z * 1.1 + x * 0.6)) * 0.5;
}

// --- events -----------------------------------------------------------------
const Events = {
  _h: Object.create(null),
  on(type, fn) { (this._h[type] || (this._h[type] = [])).push(fn); return fn; },
  off(type, fn) { const l = this._h[type]; if (!l) return; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
  emit(type, data) {
    const l = this._h[type]; if (!l) return;
    for (let i = 0; i < l.length; i++) {
      try { l[i](data); } catch (e) { reportError(e, 'event:' + type); }
    }
  }
};

// --- object pool -------------------------------------------------------------
class Pool {
  constructor(create, reset, prealloc = 0) {
    this.create = create; this.reset = reset; this.free = []; this.created = 0; this.inUse = 0;
    for (let i = 0; i < prealloc; i++) { this.free.push(create()); this.created++; }
  }
  acquire() {
    this.inUse++;
    if (this.free.length) return this.free.pop();
    this.created++; return this.create();
  }
  release(o) { if (!o) return; this.inUse--; if (this.reset) this.reset(o); this.free.push(o); }
}

// --- error reporting -----------------------------------------------------------
const ErrorLog = [];
function reportError(err, where) {
  const msg = (err && err.message) ? err.message : String(err);
  ErrorLog.push({ t: Date.now(), where, msg, stack: err && err.stack });
  if (ErrorLog.length > 50) ErrorLog.shift();
  try { console.error('[HT3D]', where, err); } catch (e) { /* ignore */ }
  try { if (HT.log) HT.log('error', `${where}: ${msg}`); } catch (e) { /* ignore */ }
}

// --- temp math objects (avoid GC in hot loops) -------------------------------------
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3(), _v5 = new V3(), _v6 = new V3();
const _q1 = new QT(), _q2 = new QT(), _q3 = new QT();
const _m1 = new M4(), _m2 = new M4();
const UP = new V3(0, 1, 0), FWD = new V3(0, 0, 1), LEFT = new V3(1, 0, 0);

// Rotation that maps orthonormal frame (a1,b1) to (a2,b2). a,b need not be exactly orthogonal.
const _fm1 = new M4(), _fm2 = new M4(), _fa = new V3(), _fb = new V3(), _fc = new V3();
function frameQuat(a1, b1, a2, b2, out) {
  _fa.copy(a1).normalize(); _fc.crossVectors(_fa, b1).normalize(); _fb.crossVectors(_fc, _fa);
  _fm1.makeBasis(_fa, _fb, _fc);
  _fa.copy(a2).normalize(); _fc.crossVectors(_fa, b2);
  if (_fc.lengthSq() < 1e-10) { _fc.set(0, 0, 1).cross(_fa); if (_fc.lengthSq() < 1e-8) _fc.set(1, 0, 0).cross(_fa); }
  _fc.normalize(); _fb.crossVectors(_fc, _fa);
  _fm2.makeBasis(_fa, _fb, _fc);
  _fm1.transpose(); // inverse of rotation
  _fm2.multiply(_fm1);
  return out.setFromRotationMatrix(_fm2);
}
function quatFromEuler(x, y, z, out, order = 'XYZ') {
  return out.setFromEuler(_eul.set(x, y, z, order));
}
const _eul = new THREE.Euler();
function quatAxisAngle(axis, ang, out) { return out.setFromAxisAngle(axis, ang); }
// rotation vector (axis * angle) -> quaternion
function quatFromRotVec(v, out) {
  const a = v.length();
  if (a < 1e-9) return out.set(0, 0, 0, 1);
  const s = Math.sin(a * 0.5) / a;
  return out.set(v.x * s, v.y * s, v.z * s, Math.cos(a * 0.5));
}
function yawFromQuat(q) {
  _v6.set(0, 0, 1).applyQuaternion(q);
  return Math.atan2(_v6.x, _v6.z);
}
function colorHex(hex) { return new THREE.Color(hex); }
function colorLerp(c1, c2, t, out) { return (out || new THREE.Color()).copy(c1).lerp(c2, t); }

HT.util = { clamp, lerp, smoothstep, RNG, hash32, frameQuat };
HT.log = (type, text) => { try { console.log('[HT3D ' + type + ']', text); } catch (e) { /* ignore */ } };
HT.toast = () => { };
if (typeof window !== 'undefined') window.HT3D = HT;
if (typeof window !== 'undefined') window.HT3D.errors = ErrorLog;
