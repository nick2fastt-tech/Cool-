// Character models (built from primitives), pose library, faces and the Water Guy.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, mk, grp, rng, clamp, lerp, smoothstep, noise1, canvasTex } from './util.js';
import { emblemTex } from './textures.js';

// ---------------------------------------------------------------- pose model
export const POSE_KEYS = ['y', 'lean', 'twist', 'tilt', 'spF', 'spT', 'spS', 'hdN', 'hdY', 'hdT',
  'aLF', 'aLO', 'aLT', 'eL', 'aRF', 'aRO', 'aRT', 'eR', 'lLF', 'lLO', 'kL', 'fL', 'lRF', 'lRO', 'kR', 'fR'];

export function pose(p = {}) {
  const o = {};
  for (const k of POSE_KEYS) o[k] = p[k] ?? 0;
  return o;
}
export function blendPose(a, b, w) {
  const o = {};
  for (const k of POSE_KEYS) o[k] = a[k] + (b[k] - a[k]) * w;
  return o;
}
const LEG_KEYS = ['y', 'lean', 'lLF', 'lLO', 'kL', 'fL', 'lRF', 'lRO', 'kR', 'fR'];

const S = Math.sin, C = Math.cos, P = Math.PI;
const sitLegs = { y: -0.3, lLF: 1.55, lRF: 1.55, kL: 1.5, kR: 1.5, lLO: 0.12, lRO: 0.12, fL: -0.1, fR: -0.1 };

// Each action: (a = seconds since action began, t = global time, c = ctx) -> partial pose.
// flags: upper => legs come from walking/running when moving. gest => talk gestures layered.
export const ACTIONS = {
  idle: { gest: true, f: (a, t, c) => ({ spF: 0.02 + 0.015 * S(t * 1.7 + c.seed), aLO: 0.12, aRO: 0.12, eL: 0.18, eR: 0.18, aLF: 0.04 * S(t * 1.1 + c.seed), aRF: 0.04 * S(t * 1.3 + c.seed + 1), lLO: 0.04, lRO: 0.04 }) },
  tired: { gest: true, f: (a, t, c) => ({ spF: 0.24, hdN: 0.25 + 0.03 * S(t), aLO: 0.06, aRO: 0.06, eL: 0.1, eR: 0.1, lean: 0.04, y: -0.02, lLO: 0.03, lRO: 0.03 }) },
  sigh: { f: (a) => { const k = smoothstep(0, 0.6, a) - smoothstep(0.8, 1.8, a) * 0.6; return { spF: 0.1 + 0.3 * k, hdN: 0.15 + 0.35 * k, aLO: 0.08, aRO: 0.08, y: -0.03 * k, lean: -0.05 + 0.1 * k }; } },
  handsHips: { gest: true, f: (a, t) => ({ aLO: 0.55, aRO: 0.55, aLF: -0.2, aRF: -0.2, aLT: 1.1, aRT: 1.1, eL: 1.5, eR: 1.5, spF: -0.04, lLO: 0.1, lRO: 0.1, hdT: 0.05 * S(t) }) },
  crossArms: { f: (a, t, c) => ({ aLF: 0.5, aRF: 0.55, aLO: -0.05, aRO: -0.05, aLT: 1.25, aRT: 1.25, eL: 1.85, eR: 1.85, spF: -0.03 + 0.01 * S(t * 1.5), lLO: 0.08, lRO: 0.08, hdT: 0.06 }) },
  point: { upper: true, f: (a, t) => { const k = smoothstep(0, 0.3, a); return { aRF: 1.45 * k, aRO: 0.12, eR: 0.08, aLO: 0.12, eL: 0.2, spT: -0.12 * k }; } },
  pointUp: { upper: true, f: (a) => { const k = smoothstep(0, 0.3, a); return { aRF: 2.1 * k, aRO: 0.2, eR: 0.1, aLO: 0.12, eL: 0.2 }; } },
  fistPump: { f: (a, t) => ({ aRF: 1.3 + 0.35 * S(a * 13), aRO: 0.35, eR: 2.0 + 0.3 * S(a * 13), aRT: 0.4, aLO: 0.2, eL: 0.4, spF: -0.06, y: 0.02 * Math.abs(S(a * 13)), hdN: -0.1 }) },
  cheer: { f: (a, t) => ({ aLF: 2.4, aRF: 2.4, aLO: 0.8, aRO: 0.8, eL: 0.25, eR: 0.25, y: 0.05 * Math.abs(S(a * 8)), hdN: -0.2, spF: -0.08, kL: 0.15 * Math.abs(S(a * 8)), kR: 0.15 * Math.abs(S(a * 8)) }) },
  dance: { f: (a, t) => {
    const b = a * P * 4; // 2 beats per second
    const move = Math.floor(a / 2) % 3;
    const bounce = Math.abs(S(b));
    const base = { y: -0.06 + 0.06 * bounce, kL: 0.3 + 0.25 * bounce, kR: 0.3 + 0.25 * bounce, lLF: 0.15, lRF: 0.15, fL: -0.15, fR: -0.15, hdN: 0.1 * S(b * 2), spS: 0.12 * S(b), twist: 0.3 * S(b / 2) };
    if (move === 0) return { ...base, aLF: 2.3 + 0.5 * S(b), aRF: 2.3 - 0.5 * S(b), aLO: 1.0, aRO: 1.0, eL: 1.2 + 0.6 * S(b), eR: 1.2 - 0.6 * S(b) }; // raise the roof
    if (move === 1) return { ...base, aLF: 1.5, aRF: 1.5, aLO: 0.9 + 0.5 * S(b), aRO: 0.9 - 0.5 * S(b), eL: 0.4, eR: 0.4, spT: 0.4 * S(b / 2), lLF: 0.6 * Math.max(0, S(b)), lRF: 0.6 * Math.max(0, -S(b)) }; // sprinkler kick
    return { ...base, aLF: 0.8 + 0.8 * S(b), aRF: 0.8 - 0.8 * S(b), aLO: 0.3, aRO: 0.3, eL: 1.6, eR: 1.6, lLF: 0.7 * Math.max(0, S(b)), lRF: 0.7 * Math.max(0, -S(b)), kL: 1.0 * Math.max(0, S(b)), kR: 1.0 * Math.max(0, -S(b)) }; // running man
  } },
  sitGame: { sit: true, f: (a, t) => ({ ...sitLegs, spF: 0.18 + 0.03 * S(t * 3), aLF: 0.75, aRF: 0.75, aLT: 0.7, aRT: 0.7, aLO: 0.08, aRO: 0.08, eL: 1.35 + 0.08 * S(t * 23), eR: 1.35 + 0.08 * S(t * 19 + 1), hdN: 0.05, spT: 0.08 * S(t * 2.3) }) },
  sitCheer: { sit: true, f: (a, t) => ({ ...sitLegs, spF: -0.12, aLF: 2.2 + 0.2 * S(a * 12), aRF: 2.2 - 0.2 * S(a * 12), aLO: 0.85, aRO: 0.85, eL: 0.5, eR: 0.5, hdN: -0.25, y: sitLegs.y + 0.03 * Math.abs(S(a * 12)) }) },
  sitRelax: { sit: true, gest: true, f: (a, t, c) => ({ ...sitLegs, spF: -0.08, aLF: 0.55, aRF: 0.55, aLO: 0.12, aRO: 0.12, eL: 0.7, eR: 0.7, hdN: 0.02 * S(t + c.seed) }) },
  sitEat: { sit: true, f: (a, t, c) => {
    const cyc = ((a + c.seed) % 3.4) / 3.4;
    const bite = smoothstep(0.1, 0.3, cyc) - smoothstep(0.45, 0.65, cyc);
    return { ...sitLegs, spF: 0.02 + 0.1 * bite, aLF: 0.5, aLO: 0.12, eL: 0.6, aRF: 0.75 + 0.45 * bite, aRO: 0.08, aRT: 0.5, eR: 1.4 + 0.75 * bite, hdN: 0.08 * bite };
  } },
  sitLaugh: { sit: true, f: (a, t) => ({ ...sitLegs, spF: -0.15 + 0.1 * Math.abs(S(a * 13)), hdN: -0.3, aLF: 0.6, aLT: 1.1, eL: 1.3, aRF: 0.8, aRT: 1.0, eR: 1.6, aLO: 0.1, aRO: 0.1, y: sitLegs.y + 0.02 * Math.abs(S(a * 13)) }) },
  lean: { f: (a, t) => ({ lean: 0.08, spF: 0.38, aLF: 0.95, aRF: 0.95, eL: 0.25, eR: 0.25, aLO: 0.18, aRO: 0.18, hdN: -0.25 + 0.04 * S(t * 2), lLO: 0.08, lRO: 0.08, lRF: -0.1, kR: 0.1 }) },
  stumble: { f: (a) => { const k = 1 - smoothstep(0.6, 1.4, a); return { lean: -0.3 * k, spF: -0.15 * k, aLF: 1.2 * k + 0.3 * S(a * 14) * k, aRF: 1.0 * k - 0.3 * S(a * 14) * k, aLO: 1.0 * k + 0.1, aRO: 1.1 * k + 0.1, eL: 0.4, eR: 0.4, lLF: 0.4 * k, kL: 0.3 * k, lRF: -0.2 * k, hdN: -0.2 * k }; } },
  brace: { f: (a, t) => ({ lean: 0.32, spF: 0.22, aLF: 1.35, aRF: 1.35, eL: 0.6 + 0.05 * S(t * 31), eR: 0.6 + 0.05 * S(t * 29), aLO: 0.18, aRO: 0.18, lLF: 0.6, kL: 0.65, lRF: -0.55, kR: 0.2, y: -0.09 + 0.01 * S(t * 33), hdN: -0.15 }) },
  throw: { f: (a) => {
    const p = (a % 0.85) / 0.85;
    const wind = smoothstep(0, 0.35, p), fling = smoothstep(0.35, 0.55, p), back = smoothstep(0.7, 1, p);
    const f = -0.9 * wind + 2.6 * fling - 1.7 * back * fling;
    return { aRF: f, aRO: 0.25, eR: 0.6 * (1 - fling), spT: -0.4 * wind + 0.7 * fling - 0.3 * back, lean: 0.1 * fling, aLF: 0.6, aLO: 0.3, eL: 0.8, lLF: 0.45, kL: 0.3, lRF: -0.35, kR: 0.15 };
  } },
  examine: { f: (a, t) => ({ lLF: 1.25, kL: 1.85, lRF: 0.25, kR: 2.25, fR: 0.6, y: -0.42, spF: 0.45, aLF: 0.6, eL: 0.9, aRF: 0.95, eR: 0.5, aLO: 0.1, aRO: 0.1, hdN: 0.3 + 0.05 * S(t * 2) }) },
  valve: { f: (a, t) => ({ aLF: 1.2, aRF: 1.2, aLO: 0.02, aRO: 0.02, aLT: 0.45, aRT: 0.45, eL: 0.75, eR: 0.75, lean: -0.12, spF: 0.08, spT: 0.18 * S(a * 4), lLO: 0.22, lRO: 0.22, lLF: 0.35, kL: 0.4, kR: 0.25, y: -0.06 + 0.012 * S(t * 37), hdN: -0.05 }) },
  valveTurn: { f: (a) => { const k = smoothstep(0, 0.5, a); return { aLF: 1.2 + 0.4 * k, aRF: 1.2 - 0.4 * k, aLO: 0.02, aRO: 0.02, aLT: 0.45, aRT: 0.45, eL: 0.75, eR: 0.75, lean: -0.15, spT: 0.5 * k, lLO: 0.22, lRO: 0.22, lLF: 0.35, kL: 0.4, kR: 0.25, y: -0.06 }; } },
  dodge: { f: (a) => ({ kL: 1.4, kR: 1.2, lLF: 0.9, lRF: 0.5, aLO: 1.3, aRO: 1.3, aLF: 0.4, aRF: 0.4, eL: 0.5, eR: 0.5, spF: 0.2, tilt: 0.3 * S(Math.min(a, 0.8) / 0.8 * P) }) },
  taunt: { upper: true, f: (a) => ({ aLF: 2.55 + 0.3 * S(a * 11), aRF: 2.55 - 0.3 * S(a * 11), aLO: 0.55, aRO: 0.55, eL: 0.3, eR: 0.3, hdN: -0.1 }) },
  yell: { upper: true, f: () => ({ aLF: 1.45, aRF: 1.45, aLT: 1.35, aRT: 1.35, eL: 2.25, eR: 2.25, aLO: -0.05, aRO: -0.05, spF: -0.1, hdN: -0.15 }) },
  checkWrist: { f: (a, t) => ({ aLF: 1.05, aLT: 1.25, eL: 1.75, aLO: 0.1, aRO: 0.12, eR: 0.2, hdN: 0.4, hdY: 0.25, spF: 0.06 }) },
  lookDown: { f: (a, t) => ({ hdN: 0.55, aLO: 0.45, aRO: 0.45, aLF: 0.3, aRF: 0.3, aLT: -0.5, aRT: -0.5, eL: 0.5, eR: 0.5, spF: 0.1 + 0.03 * S(t * 3) }) },
  laugh: { f: (a) => ({ spF: -0.12 + 0.12 * Math.abs(S(a * 13)), hdN: -0.3, aLF: 0.55, aLT: 1.2, eL: 1.35, aRF: 0.6, aRT: 1.1, eR: 1.5, aLO: 0.1, aRO: 0.1, y: 0.02 * Math.abs(S(a * 13)), kL: 0.1, kR: 0.1 }) },
  shrug: { gest: false, f: (a) => { const k = smoothstep(0, 0.35, a); return { aLO: 0.5 * k, aRO: 0.5 * k, aLF: 0.4 * k, aRF: 0.4 * k, eL: 1.3 * k, eR: 1.3 * k, aLT: -0.7 * k, aRT: -0.7 * k, hdT: 0.18 * k, y: 0.015 * k }; } },
  pay: { f: (a) => { const k = smoothstep(0, 0.5, a); return { aLF: 1.0 * k, eL: 0.35, aLO: 0.05, spF: 0.12 * k, aRO: 0.1, eR: 0.2 }; } },
  reach: { f: (a) => { const k = smoothstep(0, 0.6, a); return { aRF: 1.1 * k, aRO: 0.05, eR: 0.3, spF: 0.12 * k, aLO: 0.1, aLF: 0.5 * k, eL: 0.6 * k }; } },
  freeze: { f: () => ({ aRF: 1.1, aRO: 0.05, eR: 0.3, spF: 0.1, aLF: 0.5, eL: 0.6, aLO: 0.1 }) },
  dragging: { upper: true, f: (a, t) => ({ aRF: -0.7, aRO: 0.2, eR: 0.1, aLF: 0.8 * S(t * 16), eL: 1.2, lean: 0.25, spF: 0.1 }) },
  dragged: { upper: true, f: (a, t) => ({ aLF: 1.35, aLO: -0.05, eL: 0.05, aRF: 0.6 * S(t * 12), aRO: 0.5, eR: 0.6, lean: 0.25, spF: 0.1, hdN: -0.1 }) },
  holdDevice: { upper: true, f: (a, t) => ({ aRF: 0.9, eR: 1.1, aRT: 0.35, aRO: 0.05, aLO: 0.12, eL: 0.25, hdN: 0.18 }) },
  ready: { gest: true, f: (a, t) => ({ aLF: 0.65, eL: 1.9, aRF: 0.65, eR: 1.9, aLT: 0.4, aRT: 0.4, aLO: 0.15, aRO: 0.15, lLF: 0.3, lRF: -0.3, kL: 0.25, kR: 0.25, y: -0.04 + 0.01 * S(t * 4), spF: 0.08 }) },
  thumbsUp: { gest: false, f: (a) => { const k = smoothstep(0, 0.3, a); return { aRF: 1.2 * k, eR: 1.4 * k, aRT: 0.4, aRO: 0.15, aLO: 0.12, eL: 0.2 }; } },
  climb: { upper: false, f: (a, t) => ({}) },
};

export function locomotion(phase, run) {
  const s = S(phase), c = C(phase);
  const wk = {
    lLF: 0.5 * s, lRF: -0.5 * s,
    kL: 0.12 + 0.75 * Math.max(0, c), kR: 0.12 + 0.75 * Math.max(0, -c),
    fL: -0.15 * s, fR: 0.15 * s,
    aLF: -0.4 * s, aRF: 0.4 * s, eL: 0.3, eR: 0.3, aLO: 0.1, aRO: 0.1,
    y: -0.01 + 0.025 * Math.abs(c), spT: 0.08 * s, hdN: 0.02,
  };
  const rn = {
    lLF: 0.95 * s + 0.25, lRF: -0.95 * s + 0.25,
    kL: 0.25 + 1.45 * Math.max(0, c), kR: 0.25 + 1.45 * Math.max(0, -c),
    fL: -0.3 * s, fR: 0.3 * s,
    aLF: -0.95 * s, aRF: 0.95 * s, eL: 1.45, eR: 1.45, aLO: 0.12, aRO: 0.12,
    y: -0.04 + 0.07 * Math.abs(c), lean: 0.22, spT: 0.15 * s, hdN: -0.12,
  };
  return blendPose(pose(wk), pose(rn), run);
}

export const EXPRESSIONS = {
  neutral: { smile: 0.25, open: 0, brow: 0, tilt: 0, lid: 0, wide: 1 },
  happy: { smile: 1, open: 0.28, brow: 0.015, tilt: -0.1, lid: 0.12, wide: 1 },
  grin: { smile: 1, open: 0.45, brow: 0.02, tilt: -0.05, lid: 0.15, wide: 1 },
  smug: { smile: 0.8, open: 0, brow: 0.0, tilt: 0.12, lid: 0.25, wide: 1 },
  annoyed: { smile: -0.35, open: 0, brow: -0.01, tilt: 0.3, lid: 0.3, wide: 1 },
  tired: { smile: -0.25, open: 0, brow: -0.012, tilt: -0.15, lid: 0.5, wide: 1 },
  surprised: { smile: 0, open: 0.7, brow: 0.035, tilt: -0.2, lid: -0.1, wide: 1.15 },
  shocked: { smile: -0.3, open: 0.85, brow: 0.04, tilt: -0.25, lid: -0.15, wide: 1.2 },
  determined: { smile: 0.1, open: 0, brow: -0.008, tilt: 0.28, lid: 0.1, wide: 1 },
  worried: { smile: -0.4, open: 0.1, brow: 0.02, tilt: -0.35, lid: 0, wide: 1.05 },
  disgust: { smile: -0.7, open: 0.15, brow: -0.01, tilt: 0.2, lid: 0.35, wide: 1 },
  laugh: { smile: 1, open: 0.85, brow: 0.025, tilt: -0.2, lid: 0.6, wide: 1 },
  angry: { smile: -0.5, open: 0.2, brow: -0.015, tilt: 0.45, lid: 0.15, wide: 1 },
  mischief: { smile: 1, open: 0.2, brow: 0, tilt: 0.3, lid: 0.15, wide: 1 },
};

function blendExpr(a, b, w) {
  const o = {};
  for (const k in a) o[k] = a[k] + (b[k] - a[k]) * w;
  return o;
}

// ---------------------------------------------------------------- face pieces
function buildFace(head, cfg, hc, r) {
  const F = {};
  const skin = mat(cfg.skin, { r: 0.55 });
  const white = mat(0xffffff, { r: 0.3 });
  const iris = mat(cfg.eyeColor, { r: 0.3 });
  const black = mat(0x0b0b10, { r: 0.2 });
  const shine = mat(0xffffff, { basic: true });
  F.eyes = [];
  for (const s of [1, -1]) {
    const eg = grp(head, s * r * 0.37, hc + r * 0.1, r * 0.86);
    eg.rotation.y = s * 0.36;
    eg.rotation.x = -0.05;
    const eye = grp(eg);
    mk(new THREE.SphereGeometry(r * 0.27, 20, 14), white, eye, [0, 0, 0], [0, 0, 0], [0.82, 1.08, 0.45], false);
    const ir = grp(eye, 0, 0, r * 0.115);
    mk(new THREE.CircleGeometry(r * 0.19, 20), iris, ir, [0, -r * 0.01, 0], [0, 0, 0], null, false);
    mk(new THREE.CircleGeometry(r * 0.095, 16), black, ir, [0, -r * 0.01, 0.001], [0, 0, 0], null, false);
    mk(new THREE.CircleGeometry(r * 0.05, 12), shine, ir, [r * 0.06, r * 0.06, 0.002], [0, 0, 0], null, false);
    F.eyes.push({ eg, eye, ir });
  }
  F.brows = [];
  const browM = mat(cfg.browColor ?? cfg.hairColor, { r: 0.8 });
  for (const s of [1, -1]) {
    const bg = grp(head, s * r * 0.38, hc + r * 0.45, r * 0.93);
    bg.rotation.y = s * 0.36;
    mk(new THREE.CapsuleGeometry(r * 0.05, r * 0.3, 4, 8), browM, bg, [0, 0, 0], [0, 0, P / 2], [1, 1, 0.6], false);
    F.brows.push({ bg, s });
  }
  // nose + ears
  mk(new THREE.SphereGeometry(r * 0.12, 12, 10), mat(cfg.skinDark ?? cfg.skin, { r: 0.55 }), head, [0, hc - r * 0.12, r * 0.97], [0, 0, 0], [1, 0.85, 0.9]);
  for (const s of [1, -1]) mk(new THREE.SphereGeometry(r * 0.2, 12, 10), skin, head, [s * r * 0.93, hc + r * 0.02, -r * 0.02], [0, 0, 0], [0.45, 1, 0.75]);
  // mouth
  const mg = grp(head, 0, hc - r * 0.48, r * 0.86);
  mg.rotation.x = -0.32;
  const mouthDark = mat(0x5b1820, { r: 0.6 });
  F.smile = mk(new THREE.TorusGeometry(r * 0.24, r * 0.035, 6, 18, P), mat(0x6b2a2a, { r: 0.6 }), mg, [0, 0, 0.004], [0, 0, P], null, false);
  F.open = grp(mg, 0, r * 0.06, 0.006);
  mk(new THREE.CircleGeometry(r * 0.3, 20, P, P), mouthDark, F.open, [0, 0, 0], [0, 0, 0], null, false);
  mk(new THREE.PlaneGeometry(r * 0.46, r * 0.07), mat(0xffffff, { r: 0.4 }), F.open, [0, -r * 0.035, 0.001], [0, 0, 0], null, false);
  mk(new THREE.CircleGeometry(r * 0.15, 14, P, P), mat(0xd06a6a, { r: 0.6 }), F.open, [0, -r * 0.17, 0.001], [0, 0, 0], [1.3, 0.6, 1], false);
  F.mg = mg;
  return F;
}

function buildHair(head, cfg, hc, r) {
  const R = rng(cfg.seed * 97 + 13);
  const m = mat(cfg.hairColor, { r: 0.7 });
  const g = grp(head, 0, hc, 0);
  const cap = mk(new THREE.SphereGeometry(r * 1.07, 26, 16, 0, P * 2, 0, P * 0.5), m, g, [0, r * 0.06, -r * 0.06], [-0.62, 0, 0]);
  cap.scale.set(1.0, 1.03, 1.05);
  // back of head coverage
  mk(new THREE.SphereGeometry(r * 1.04, 20, 14, 0, P * 2, 0, P * 0.6), m, g, [0, -r * 0.05, -r * 0.12], [-1.35, 0, 0]);
  const up = new THREE.Vector3(0, 1, 0);
  const style = cfg.hair;
  const count = style === 'tall' ? 34 : style === 'wavy' ? 20 : 30;
  for (let i = 0; i < count; i++) {
    const az = R() * P * 2;
    const el = 0.25 + R() * 1.2; // elevation
    const n = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    if (n.z > 0.55 && n.y < 0.75) continue; // keep the face clear
    let d;
    if (style === 'tall') d = n.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, 0.75, -0.15));
    else if (style === 'wavy') d = n.clone().multiplyScalar(0.8).add(new THREE.Vector3(0, 0.25, -0.25));
    else d = n.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, 0.45, -0.3));
    d.x += (R() - 0.5) * 0.4; d.z += (R() - 0.5) * 0.3;
    d.normalize();
    const len = r * (style === 'tall' ? 0.75 + R() * 0.75 : style === 'wavy' ? 0.35 + R() * 0.35 : 0.6 + R() * 0.6);
    const rad = r * (style === 'wavy' ? 0.3 + R() * 0.12 : 0.24 + R() * 0.12);
    const pos = n.clone().multiplyScalar(r * 0.98).add(d.clone().multiplyScalar(len * 0.42));
    let mesh;
    if (style === 'wavy' && R() < 0.6) {
      mesh = mk(new THREE.SphereGeometry(rad * 1.1, 10, 8), m, g, [pos.x, pos.y, pos.z]);
      mesh.scale.set(1, 0.8, 1);
    } else {
      mesh = mk(new THREE.ConeGeometry(rad, len, 7), m, g, [pos.x, pos.y, pos.z]);
      mesh.quaternion.setFromUnitVectors(up, d);
    }
  }
  // bangs over the forehead
  const bangs = style === 'tall' ? [[-0.35, 0.3], [-0.12, 0.45], [0.12, 0.4], [0.33, 0.3], [0.0, 0.35]]
    : style === 'wavy' ? [[-0.3, 0.35], [-0.08, 0.5], [0.15, 0.45], [0.35, 0.3]]
      : [[-0.32, 0.35], [-0.1, 0.5], [0.12, 0.42], [0.34, 0.32], [0.22, 0.25]];
  for (const [x, k] of bangs) {
    const base = new THREE.Vector3(x * r, r * 0.9, r * 0.5);
    const d = new THREE.Vector3(x * 0.6 + (R() - 0.5) * 0.3, -0.3, 0.75 + k * 0.2).normalize();
    const len = r * (0.45 + R() * 0.25);
    const mesh = mk(new THREE.ConeGeometry(r * 0.2, len, 7), m, g, [base.x + d.x * len * 0.35, base.y + d.y * len * 0.35, base.z + d.z * len * 0.35]);
    mesh.quaternion.setFromUnitVectors(up, d);
  }
  // sideburns
  for (const s of [1, -1]) mk(new THREE.BoxGeometry(r * 0.12, r * 0.4, r * 0.2), m, g, [s * r * 0.92, -r * 0.05, r * 0.1]);
  return g;
}

// ---------------------------------------------------------------- hero rig
export function buildHero(cfg) {
  const root = new THREE.Group();
  root.name = cfg.name;
  const J = {};
  const suit = mat(cfg.suit ?? 0x1f2d8a, { r: 0.55 });
  const suitDark = mat(cfg.suitDark ?? 0x131a4d, { r: 0.6 });
  const accent = mat(cfg.accent ?? 0x2f6dff, { r: 0.4, e: cfg.accentGlow ?? 0x0b2a90, ei: 0.6 });
  const pad = mat(cfg.pad ?? 0x2747c7, { r: 0.35 });
  const glove = cfg.bareHands ? mat(cfg.skin, { r: 0.55 }) : mat(cfg.glove ?? 0x151d55, { r: 0.6 });
  const boot = mat(cfg.boot ?? 0x2850d0, { r: 0.4 });
  const sole = mat(0x0d1030, { r: 0.8 });
  const skin = mat(cfg.skin, { r: 0.55 });
  const pants = cfg.pants ? mat(cfg.pants, { r: 0.7 }) : suit;
  const emb = cfg.emblem === false ? null : new THREE.MeshBasicMaterial({ map: emblemTex(), transparent: true });

  const body = grp(root);
  body.scale.setScalar(0.86);
  const hips = grp(body, 0, 0.95, 0); J.hips = hips;
  mk(new RoundedBoxGeometry(0.36, 0.22, 0.24, 3, 0.07), pants, hips, [0, -0.03, 0]);
  // belt + pouches
  mk(new THREE.CylinderGeometry(0.2, 0.2, 0.075, 22), mat(cfg.belt ?? 0x10153a, { r: 0.5 }), hips, [0, 0.07, 0], [0, 0, 0], [1, 1, 0.7]);
  if (!cfg.casual) {
    mk(new RoundedBoxGeometry(0.1, 0.065, 0.03, 2, 0.01), accent, hips, [0, 0.07, 0.14]);
    for (const s of [1, -1]) {
      mk(new RoundedBoxGeometry(0.08, 0.09, 0.06, 2, 0.015), suitDark, hips, [s * 0.12, 0.04, 0.11]);
      mk(new RoundedBoxGeometry(0.07, 0.09, 0.07, 2, 0.015), suitDark, hips, [s * 0.19, 0.04, 0.02]);
    }
  }
  // spine / chest
  const spine = grp(hips, 0, 0.1, 0); J.spine = spine;
  const shirt = cfg.shirt ? mat(cfg.shirt, { r: 0.7 }) : suit;
  mk(new THREE.CapsuleGeometry(0.17, 0.22, 6, 18), shirt, spine, [0, 0.25, 0], [0, 0, 0], [1.22, 1, 0.8]);
  if (!cfg.casual) {
    // dark side panels + glowing piping
    for (const s of [1, -1]) {
      mk(new RoundedBoxGeometry(0.06, 0.34, 0.24, 2, 0.02), suitDark, spine, [s * 0.18, 0.2, 0]);
      mk(new THREE.BoxGeometry(0.012, 0.34, 0.012), accent, spine, [s * 0.155, 0.22, 0.125], [0, 0, s * 0.12]);
      // harness straps
      mk(new RoundedBoxGeometry(0.05, 0.46, 0.025, 2, 0.01), suitDark, spine, [s * 0.1, 0.24, 0.13], [0.06, 0, s * 0.05]);
    }
    mk(new THREE.BoxGeometry(0.26, 0.014, 0.012), accent, spine, [0, 0.4, 0.125]);
    if (emb) mk(new THREE.PlaneGeometry(0.085, 0.085), emb, spine, [0.0, 0.3, 0.141], [0, 0, 0], null, false);
  } else if (cfg.apron) {
    mk(new RoundedBoxGeometry(0.32, 0.5, 0.03, 2, 0.01), mat(cfg.apron, { r: 0.8 }), spine, [0, 0.12, 0.13]);
  }
  mk(new THREE.CylinderGeometry(0.085, 0.1, 0.08, 16), cfg.casual ? shirt : suitDark, spine, [0, 0.5, 0]);
  // neck + head
  const neck = grp(spine, 0, 0.52, 0);
  mk(new THREE.CylinderGeometry(0.055, 0.06, 0.12, 12), skin, neck, [0, 0.03, 0]);
  const head = grp(neck, 0, 0.06, 0); J.head = head;
  const r = 0.2, hc = 0.2;
  mk(new THREE.SphereGeometry(r, 32, 24), skin, head, [0, hc, 0], [0, 0, 0], [0.95, 1.07, 1.0]);
  // jaw/cheeks for a softer face shape
  const face = buildFace(head, cfg, hc, r);
  if (cfg.hair) buildHair(head, cfg, hc, r);

  // arms
  J.sh = {}; J.el = {}; J.hand = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const sh = grp(spine, s * 0.255, 0.42, 0); sh.rotation.order = 'ZXY';
    mk(new THREE.CapsuleGeometry(0.068, 0.2, 5, 12), shirt, sh, [0, -0.14, 0]);
    if (!cfg.casual) {
      mk(new RoundedBoxGeometry(0.13, 0.085, 0.16, 2, 0.035), pad, sh, [s * 0.02, -0.01, 0], [0, 0, s * -0.35]);
      if (emb) mk(new THREE.PlaneGeometry(0.07, 0.07), emb, sh, [s * 0.075, -0.07, 0], [0, s * P / 2, 0], null, false);
      mk(new THREE.BoxGeometry(0.01, 0.2, 0.014), accent, sh, [s * 0.066, -0.16, 0.02]);
    }
    const el = grp(sh, 0, -0.29, 0);
    mk(new THREE.CapsuleGeometry(0.06, 0.18, 5, 12), cfg.sleeves === 'short' ? skin : shirt, el, [0, -0.12, 0]);
    if (!cfg.casual) mk(new THREE.CylinderGeometry(0.066, 0.066, 0.06, 12), glove, el, [0, -0.21, 0]);
    if (side === 'L' && !cfg.casual) mk(new RoundedBoxGeometry(0.06, 0.08, 0.035, 2, 0.01), mat(0x0c1a3a, { r: 0.3, e: 0x29d6ff, ei: 0.35 }), el, [0, -0.15, 0.055]);
    const hand = grp(el, 0, -0.27, 0);
    mk(new THREE.SphereGeometry(0.062, 14, 10), glove, hand, [0, -0.03, 0], [0, 0, 0], [0.9, 1.2, 0.75]);
    mk(new THREE.CapsuleGeometry(0.02, 0.04, 3, 6), glove, hand, [s * -0.045, -0.02, 0.03], [0.6, 0, s * 0.6]);
    J.sh[side] = sh; J.el[side] = el; J.hand[side] = hand;
  }
  // legs
  J.hip = {}; J.kn = {}; J.an = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const hp = grp(hips, s * 0.1, -0.06, 0); hp.rotation.order = 'ZXY';
    mk(new THREE.CapsuleGeometry(0.09, 0.26, 5, 12), pants, hp, [0, -0.2, 0]);
    if (!cfg.casual) {
      mk(new RoundedBoxGeometry(0.07, 0.13, 0.11, 2, 0.02), suitDark, hp, [s * 0.09, -0.22, 0.02]);
      mk(new THREE.BoxGeometry(0.012, 0.3, 0.012), accent, hp, [s * 0.04, -0.2, 0.085], [0, 0, s * 0.05]);
    }
    const kn = grp(hp, 0, -0.42, 0);
    if (!cfg.casual) mk(new RoundedBoxGeometry(0.13, 0.15, 0.07, 2, 0.03), pad, kn, [0, -0.01, 0.07]);
    mk(new THREE.CapsuleGeometry(0.077, 0.26, 5, 12), pants, kn, [0, -0.19, 0]);
    const an = grp(kn, 0, -0.42, 0);
    mk(new RoundedBoxGeometry(0.15, 0.17, 0.27, 2, 0.05), boot, an, [0, 0.05, 0.04]);
    if (!cfg.casual) mk(new RoundedBoxGeometry(0.155, 0.05, 0.12, 2, 0.015), suitDark, an, [0, 0.13, 0.0]);
    mk(new RoundedBoxGeometry(0.16, 0.045, 0.29, 2, 0.015), sole, an, [0, -0.03, 0.045]);
    J.hip[side] = hp; J.kn[side] = kn; J.an[side] = an;
  }

  const hero = {
    name: cfg.name, root, J, face, cfg, seed: cfg.seed ?? 1,
    props: {},
    applyPose(p) {
      J.hips.position.y = 0.95 + p.y;
      J.hips.rotation.set(p.lean, p.twist, p.tilt);
      J.spine.rotation.set(p.spF, p.spT, p.spS);
      J.head.rotation.set(p.hdN, p.hdY, p.hdT);
      J.sh.L.rotation.set(-p.aLF, -p.aLT, p.aLO);
      J.sh.R.rotation.set(-p.aRF, p.aRT, -p.aRO);
      J.el.L.rotation.x = -p.eL; J.el.R.rotation.x = -p.eR;
      J.hip.L.rotation.set(-p.lLF, 0, p.lLO);
      J.hip.R.rotation.set(-p.lRF, 0, -p.lRO);
      J.kn.L.rotation.x = p.kL; J.kn.R.rotation.x = p.kR;
      J.an.L.rotation.x = p.fL; J.an.R.rotation.x = p.fR;
    },
    applyFace(e, talk, blink, look) {
      const lid = clamp(1 - e.lid - blink, 0.06, 1.2);
      for (const ey of face.eyes) {
        ey.eye.scale.set(e.wide, lid * e.wide, 1);
        ey.ir.position.x = (look?.x ?? 0) * 0.02;
        ey.ir.position.y = (look?.y ?? 0) * 0.02;
      }
      for (const b of face.brows) {
        b.bg.position.y = 0.2 + 0.2 * 0.45 + e.brow + (talk > 0.2 ? 0.006 : 0);
        b.bg.rotation.z = b.s * e.tilt;
      }
      const open = clamp(e.open + talk, 0, 1);
      face.open.visible = open > 0.06;
      face.open.scale.set(0.8 + 0.25 * Math.max(0, e.smile) - 0.3 * open * 0.3, open * 1.1, 1);
      face.smile.visible = open < 0.35;
      const sm = e.smile;
      face.smile.rotation.z = sm >= 0 ? P : 0;
      face.smile.position.y = sm >= 0 ? 0.012 : -0.018;
      face.smile.scale.set(0.55 + 0.35 * Math.abs(sm), 0.12 + 0.5 * Math.abs(sm), 1);
    },
  };
  return hero;
}

// Props held in hands.
export function attachProp(hero, side, mesh, pos = [0, -0.08, 0.05], rot = [0, 0, 0]) {
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  hero.J.hand[side].add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- Water Guy
export function buildWaterGuy() {
  const root = new THREE.Group();
  const flow = canvasTex(64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3aa8ff'; ctx.fillRect(0, 0, w, h);
    const R = rng(5);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(210,245,255,${0.15 + R() * 0.35})`;
      ctx.fillRect(R() * w, R() * h, 2 + R() * 4, 20 + R() * 60);
    }
  }, { repeat: [3, 1] });
  const water = new THREE.MeshStandardMaterial({ color: 0x8fd6ff, map: flow, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.86, emissive: 0x0b4fb0, emissiveIntensity: 0.45 });
  const body = grp(root);
  const prof = [[0.62, 0], [0.66, 0.04], [0.5, 0.1], [0.34, 0.3], [0.28, 0.55], [0.33, 0.82], [0.44, 1.02], [0.5, 1.22], [0.44, 1.4], [0.25, 1.52], [0.12, 1.58], [0.0, 1.6]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const torsoGeo = new THREE.LatheGeometry(prof, 30);
  const torso = mk(torsoGeo, water, body, [0, 0, 0], [0, 0, 0], null, true);
  torso.receiveShadow = false;
  const headG = grp(body, 0, 1.95, 0);
  const headGeo = new THREE.SphereGeometry(0.44, 30, 22);
  const head = mk(headGeo, water, headG, [0, 0, 0]);
  head.receiveShadow = false;
  const base = { torso: Float32Array.from(torsoGeo.attributes.position.array), head: Float32Array.from(headGeo.attributes.position.array) };
  // face
  const white = mat(0xffffff, { r: 0.2 });
  const dark = mat(0x061a44, { r: 0.4 });
  const eyes = [];
  for (const s of [1, -1]) {
    const eg = grp(headG, s * 0.16, 0.08, 0.36);
    eg.rotation.y = s * 0.3;
    const e = grp(eg);
    mk(new THREE.SphereGeometry(0.12, 18, 14), white, e, [0, 0, 0], [0, 0, 0], [1, 1, 0.55], false);
    const pu = mk(new THREE.SphereGeometry(0.055, 14, 10), dark, e, [0, -0.01, 0.055], [0, 0, 0], [1, 1, 0.5], false);
    mk(new THREE.SphereGeometry(0.018, 8, 6), mat(0xffffff, { basic: true }), pu, [0.02, 0.025, 0.04], [0, 0, 0], null, false);
    const brow = mk(new THREE.CapsuleGeometry(0.022, 0.13, 4, 8), dark, eg, [0, 0.16, 0.02], [0, 0, P / 2], null, false);
    eyes.push({ e, pu, brow, s });
  }
  const mg = grp(headG, 0, -0.16, 0.39);
  mg.rotation.x = -0.35;
  const smile = mk(new THREE.TorusGeometry(0.15, 0.022, 6, 20, P), dark, mg, [0, 0.02, 0.01], [0, 0, P], null, false);
  const open = grp(mg, 0, 0.03, 0.012);
  mk(new THREE.CircleGeometry(0.17, 20, P, P), dark, open, [0, 0, 0], [0, 0, 0], null, false);
  mk(new THREE.PlaneGeometry(0.24, 0.035), white, open, [0, -0.02, 0.002], [0, 0, 0], null, false);
  // arms: chains of spheres
  const arms = {};
  const sph = new THREE.SphereGeometry(1, 14, 10);
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const parts = [];
    for (let i = 0; i < 11; i++) { const m = mk(sph, water, body); m.receiveShadow = false; parts.push(m); }
    arms[side] = { parts, s };
  }
  const puddle = mk(new THREE.CircleGeometry(1, 32), new THREE.MeshStandardMaterial({ color: 0x5fc4ff, roughness: 0.05, transparent: true, opacity: 0.7, emissive: 0x0a3a90, emissiveIntensity: 0.3 }), root, [0, 0.025, 0], [-P / 2, 0, 0], null, false);
  puddle.receiveShadow = true;

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpP = new THREE.Vector3();
  function wobble(geo, baseArr, t, amp, freq) {
    const a = geo.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      const x = baseArr[i], y = baseArr[i + 1], z = baseArr[i + 2];
      const th = Math.atan2(z, x);
      const k = 1 + amp * (Math.sin(3 * th + y * 5 * freq - t * 6) * 0.6 + Math.sin(5 * th - y * 3 + t * 4.3) * 0.4);
      a[i] = x * k; a[i + 1] = y + amp * 0.3 * Math.sin(th * 2 + t * 5); a[i + 2] = z * k;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  return {
    name: 'water', root, body, headG, water, flow,
    // st: {t, scale, stretch, armL:[x,y,z], armR:[x,y,z], armThick, big, open, expr, lean, puddle, talk}
    update(st) {
      const t = st.t;
      flow.offset.y = -t * 0.6;
      body.scale.set(st.scale, st.scale * st.stretch, st.scale);
      body.rotation.x = st.lean ?? 0;
      body.rotation.z = st.tilt ?? 0;
      wobble(torsoGeo, base.torso, t, 0.05, 1);
      wobble(headGeo, base.head, t * 0.8, 0.025, 2);
      headG.position.y = 1.95 + 0.03 * Math.sin(t * 3);
      headG.rotation.z = 0.08 * Math.sin(t * 1.7) + (st.headTilt ?? 0);
      headG.rotation.x = st.headNod ?? 0;
      // face
      const ex = st.expr;
      for (const e of eyes) {
        const lid = ex === 'shocked' ? 1.25 : ex === 'angry' ? 0.75 : 1;
        e.e.scale.set(1, lid, 1);
        e.pu.scale.setScalar(ex === 'shocked' ? 0.7 : 1);
        e.brow.rotation.z = P / 2 + e.s * (ex === 'angry' ? -0.45 : ex === 'shocked' ? 0.2 : -0.25);
        e.brow.position.y = ex === 'shocked' ? 0.2 : 0.15;
      }
      const op = clamp((st.open ?? 0) + (st.talk ?? 0), 0, 1);
      open.visible = op > 0.06;
      open.scale.set(ex === 'mischief' ? 1.1 : 0.9, op, 1);
      smile.visible = op < 0.4;
      const sm = ex === 'shocked' || ex === 'angry' ? -0.6 : 1;
      smile.rotation.z = sm > 0 ? P : 0;
      smile.position.y = sm > 0 ? 0.02 : -0.03;
      smile.scale.set(1, sm > 0 ? 0.8 : 0.4, 1);
      // arms
      for (const side of ['L', 'R']) {
        const A = arms[side];
        const sh = tmpA.set(A.s * 0.44, 1.28, 0);
        const tgt = st[side === 'L' ? 'armL' : 'armR'];
        const end = tmpB.set(tgt[0], tgt[1], tgt[2]);
        const mid = tmpC.copy(sh).add(end).multiplyScalar(0.5);
        mid.y -= 0.25; mid.x += A.s * 0.2;
        const thick = side === 'R' ? (st.big ?? 1) : (st.bigL ?? 1);
        A.parts.forEach((m, i) => {
          const u = i / (A.parts.length - 1);
          const iu = 1 - u;
          tmpP.set(
            iu * iu * sh.x + 2 * iu * u * mid.x + u * u * end.x,
            iu * iu * sh.y + 2 * iu * u * mid.y + u * u * end.y,
            iu * iu * sh.z + 2 * iu * u * mid.z + u * u * end.z,
          );
          m.position.copy(tmpP);
          m.position.y += 0.02 * Math.sin(t * 7 + i);
          const rr = (i === A.parts.length - 1 ? 0.2 : 0.17 - u * 0.05) * thick;
          m.scale.setScalar(rr);
        });
      }
      const pu = (st.puddle ?? 1) * (1 + 0.05 * Math.sin(t * 5));
      puddle.scale.set(pu * st.scale * 1.1, pu * st.scale * 1.1, 1);
    },
  };
}

// Character colours / builds (matched to the reference sheet)
export const CAST = {
  aaron: { name: 'aaron', seed: 1, hair: 'spiky', hairColor: 0x6b3a1e, browColor: 0x4a2612, skin: 0xe9b48f, skinDark: 0xdc9f79, eyeColor: 0x5a3416 },
  flare: { name: 'flare', seed: 2, hair: 'tall', hairColor: 0x17120f, browColor: 0x120d0a, skin: 0xe6b18a, skinDark: 0xd99f77, eyeColor: 0x3b2414 },
  eric: { name: 'eric', seed: 3, hair: 'wavy', hairColor: 0x4e3020, browColor: 0x3a2216, skin: 0xe8b28c, skinDark: 0xd99e78, eyeColor: 0x4a2c16 },
  barista: { name: 'barista', seed: 4, hair: 'wavy', hairColor: 0x2b1d14, skin: 0xc98d68, skinDark: 0xb87d5a, eyeColor: 0x2d1a10, casual: true, emblem: false, shirt: 0xf4f1ea, pants: 0x4a3a2c, apron: 0x2f7d4f, boot: 0x2a2420, bareHands: true, sleeves: 'short' },
};
