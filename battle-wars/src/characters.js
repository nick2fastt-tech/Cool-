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
  lieBack: { f: (a, t) => ({ lean: -1.52, y: -0.8, aLF: 2.9, aRF: 2.9, aLO: 0.55, aRO: 0.55, eL: 2.3, eR: 2.3, hdN: 0.35, lRF: 0.3, kR: 0.6, fL: 0.4, fR: 0.2, spF: 0.02 * S(t * 1.2) }) },
  lieSide: { f: (a, t) => ({ tilt: 1.5, y: -0.78, lLF: 0.7, kL: 1.1, lRF: 0.8, kR: 1.2, aLF: 0.9, eL: 1.6, aLT: 0.5, aRF: 0.5, eR: 1.0, hdT: -0.3, spF: 0.15 + 0.02 * S(t * 1.2) }) },
  sitFloor: { sit: true, gest: true, f: (a, t) => ({ y: -0.8, lLF: 1.5, lRF: 1.45, kL: 0.15, kR: 0.25, spF: 0.12, aLO: 0.35, aRO: 0.35, aLF: 0.35, aRF: 0.35, eL: 0.3, eR: 0.3, aLT: -0.4, aRT: -0.4 }) },
  jumpScare: { f: (a) => { const k = 1 - smoothstep(0.4, 1.2, a); return { y: 0.12 * Math.abs(S(a * 9)) * k, aLF: 2.3 * k + 0.3 * S(a * 17), aRF: 2.1 * k - 0.3 * S(a * 17), aLO: 1.0 * k + 0.1, aRO: 1.0 * k + 0.1, eL: 0.4, eR: 0.4, spF: -0.15 * k, lLF: 0.6 * k, kL: 0.9 * k, hdN: -0.2 * k }; } },
  write: { sit: true, f: (a, t) => ({ ...sitLegs, spF: 0.3, aLF: 0.75, aLT: 0.6, eL: 1.35, aRF: 0.85, aRT: 0.45, eR: 1.45 + 0.08 * S(t * 15), aRO: 0.05 * S(t * 7), hdN: 0.38 }) },
  readBook: { upper: true, gest: true, f: (a, t) => ({ aLF: 1.0, aLT: 0.7, eL: 1.6, aRF: 0.65, aRT: 0.35, eR: 1.25, hdN: 0.3, aLO: 0.05, aRO: 0.1 }) },
  flameHand: { upper: true, f: (a, t) => { const k = smoothstep(0, 0.35, a); return { aRF: 1.15 * k, aRO: 0.25, eR: 1.3 * k, aRT: -0.5 * k, aLO: 0.15, eL: 0.25, hdN: 0.05 }; } },
  perform: { f: (a, t) => ({ aLF: 2.2 + 0.2 * S(a * 2), aRF: 2.5 + 0.15 * S(a * 2.3), aLO: 0.95, aRO: 1.1, eL: 0.3, eR: 0.2, spF: -0.15, hdN: -0.25, lLF: 0.3, lRF: -0.2, kR: 0.1 }) },
  orate: { gest: false, f: (a, t) => ({ aRF: 1.7 + 0.25 * S(a * 1.6), aRO: 0.7, eR: 0.3, aLF: 0.3, aLT: 1.0, eL: 1.7, spF: -0.08, hdN: -0.15, lLF: 0.25, lRF: -0.15 }) },
  bow: { f: (a) => { const k = smoothstep(0, 0.5, a) - smoothstep(1.4, 2.0, a); return { spF: 0.85 * k, lean: 0.15 * k, hdN: 0.3 * k, aRF: 0.9 * k, aRT: 1.0, eR: 1.4 * k, aLF: -0.45 * k, aLO: 0.3 }; } },
  stifleLaugh: { f: (a, t) => ({ aRF: 1.45, aRT: 1.15, eR: 2.25, hdN: 0.18, spF: 0.12 + 0.04 * Math.abs(S(a * 14)), aLF: 0.5, aLT: 1.1, eL: 1.3 }) },
  scan: { upper: true, f: (a, t) => ({ aRF: 0.95, eR: 1.2, aRT: 0.35, aLF: 0.75, aLT: 0.65, eL: 1.3, hdN: 0.35 + 0.03 * S(t * 2), aLO: 0.05, aRO: 0.05 }) },
  slapTable: { f: (a) => { const k = smoothstep(0.12, 0.26, a); return { aRF: 2.3 - 1.45 * k, eR: 0.2, aRO: 0.15, spF: 0.1 + 0.2 * k, aLO: 0.2, eL: 0.3, lean: 0.05 * k }; } },
  holdCase: { upper: true, f: (a, t) => ({ aLF: 0.55, aRF: 0.55, aLT: 0.45, aRT: 0.45, eL: 1.05, eR: 1.05, hdN: 0.2 }) },
  pocket: { f: (a, t) => ({ aLF: 0.9, aLT: 1.2, eL: 1.65, aRF: 1.15, aRT: 0.95, eR: 1.5, hdN: 0.45, spF: 0.12, hdY: 0.15 * S(t * 3) }) },
  dive: { f: (a) => ({ lean: 0.7, spF: 0.35, kL: 1.4, kR: 1.0, lLF: 1.2, lRF: 0.3, aLF: 1.7, aRF: 1.7, eL: 0.2, eR: 0.2, y: -0.35 }) },
  crouchHide: { gest: true, f: (a, t) => ({ lLF: 1.3, kL: 2.0, lRF: 1.3, kR: 2.0, y: -0.45, spF: 0.3, aLF: 0.8, aRF: 0.8, eL: 1.3, eR: 1.3, aLT: 0.5, aRT: 0.5, hdN: -0.1 + 0.05 * S(t * 3) }) },
  swingPipe: { f: (a) => { const p = clamp(a / 0.6, 0, 1); const k = smoothstep(0.2, 0.6, p); return { aRF: 1.35, aRO: 1.1 - 1.8 * k, eR: 0.3, spT: -0.6 + 1.2 * k, aLF: 0.9, aLO: -0.2, aLT: 1.0, eL: 1.2, lLF: 0.4, kL: 0.3, lRF: -0.3, kR: 0.2 }; } },
  blockPipe: { f: (a, t) => ({ aLF: 1.6, aRF: 1.6, aLO: 0.3, aRO: 0.3, eL: 1.25, eR: 1.25, aLT: 1.0, aRT: 1.0, lean: -0.12, y: -0.06, lLF: 0.4, kL: 0.4, lRF: -0.4, kR: 0.3 }) },
  reachWall: { f: (a) => { const k = smoothstep(0, 0.7, a); return { aRF: 1.45 * k, aRO: 0.45 * k, eR: 0.1, spS: 0.12 * k, lean: 0.06 * k, hdN: 0.05, aLO: 0.15 }; } },
  powerFist: { f: (a, t) => ({ aRF: 0.95, eR: 2.0, aRO: 0.1, aRT: 0.4, aLF: 0.6, eL: 1.7, aLT: 0.4, lLF: 0.35, lRF: -0.35, kL: 0.3, kR: 0.3, y: -0.05 + 0.01 * S(t * 20), spF: 0.12, hdN: 0.1 }) },
  punch: { f: (a) => { const k = smoothstep(0, 0.12, a) - smoothstep(0.55, 0.9, a); return { aRF: 0.95 + 0.65 * k, eR: 2.0 - 1.95 * k, aRO: 0.1, spT: -0.35 + 0.8 * k, lean: 0.25 * k, aLF: 0.6, eL: 1.7, lLF: 0.55, kL: 0.4, lRF: -0.45, kR: 0.2 }; } },
  groundPound: { f: (a) => { const k = smoothstep(0, 0.35, a); return { y: -0.4 * k, lLF: 1.2 * k, kL: 1.8 * k, lRF: 0.2, kR: 1.6 * k, spF: 0.65 * k, aRF: 0.95 * k, eR: 0.1, aRO: 0.05, aLF: -0.5 * k, aLO: 0.6 * k, hdN: -0.2 * k }; } },
  eatBar: { upper: true, f: (a) => { const c = (a % 2.2) / 2.2, bite = smoothstep(0.1, 0.25, c) - smoothstep(0.4, 0.55, c); return { aRF: 0.9 + 0.35 * bite, aRT: 1.0, eR: 1.6 + 0.6 * bite, hdN: 0.05, aLO: 0.12, eL: 0.2 }; } },
  clapSlow: { f: (a) => { const s = Math.abs(S(a * 3.2)); return { aLF: 1.1, aRF: 1.1, aLT: 1.25, aRT: 1.25, eL: 1.25, eR: 1.25, aLO: 0.2 - 0.22 * s, aRO: 0.2 - 0.22 * s, hdT: 0.15 }; } },
  raiseItem: { f: (a) => { const k = smoothstep(0, 0.5, a); return { aRF: 1.85 * k, eR: 0.45, aRT: -0.35, aRO: 0.1, hdN: -0.18 * k, aLO: 0.12 }; } },
  giveItem: { f: (a) => { const k = smoothstep(0, 0.5, a); return { aRF: 1.3 * k, eR: 0.3, aRT: -0.6 * k, aRO: 0.0, spF: 0.12 * k, hdN: 0.15, aLO: 0.12 }; } },
  lookHand: { f: (a, t) => ({ aRF: 0.95, eR: 1.15, aRT: -0.5, hdN: 0.42, spF: 0.08, aLO: 0.12 }) },
  fistsClench: { gest: true, f: (a, t) => ({ aLO: 0.18, aRO: 0.18, eL: 0.5, eR: 0.5, aLF: 0.12, aRF: 0.12, spF: 0.05, y: 0.004 * S(t * 30) }) },
  armsOut: { f: (a) => { const k = smoothstep(0, 0.25, a); return { aLO: 1.3 * k, aRO: 1.3 * k, aLF: 0.6 * k, aRF: 0.6 * k, eL: 0.2, eR: 0.2, spF: -0.2 * k, hdN: -0.3 * k, lean: -0.1 * k }; } },
  lookUp: { gest: true, f: (a, t) => ({ hdN: -0.4, aLO: 0.12, aRO: 0.12, eL: 0.2, eR: 0.2 }) },
  kneel: { f: (a, t) => ({ y: -0.42, lLF: 1.45, kL: 1.5, lRF: -0.15, kR: 2.2, fR: 0.6, spF: 0.3 + 0.04 * S(t * 4), aLF: 0.5, eL: 0.6, aRF: 0.7, eR: 0.6, hdN: 0.15 }) },
  blastPose: { f: (a, t) => { const k = smoothstep(0, 0.2, a); return { aLF: 1.5 * k, aRF: 1.5 * k, aLO: 0.1, aRO: 0.1, aLT: 0.2, aRT: 0.2, eL: 0.15, eR: 0.15, lean: 0.12 * k, lLF: 0.5, kL: 0.4, lRF: -0.45, kR: 0.25, y: -0.06 + 0.01 * S(t * 30), hdN: -0.05 }; } },
  oneHandBlast: { f: (a) => { const k = smoothstep(0, 0.15, a); return { aRF: 1.5 * k, aRO: 0.05, eR: 0.1, aLF: 0.4, eL: 1.2, aLO: 0.2, lean: 0.1 * k, lLF: 0.45, kL: 0.35, lRF: -0.4, kR: 0.2, spT: -0.2 * k }; } },
  grabArm: { f: (a) => { const k = smoothstep(0, 0.3, a); return { aRF: 1.25 * k, eR: 0.35, aRO: -0.05, aLF: 1.1 * k, eL: 0.5, lean: 0.12 * k, lLF: 0.4, kL: 0.3, lRF: -0.3 }; } },
  chargeHand: { f: (a, t) => { const k = smoothstep(0, 0.4, a); return { aRF: 1.45 * k, eR: 0.1, aRO: 0.0, aLO: 0.15, eL: 0.3, y: 0.01 * S(t * 25), spF: 0.05, hdN: 0.05 }; } },
  freezeStep: { f: () => ({ lLF: 0.5, kL: 0.2, lRF: -0.45, kR: 0.7, aLF: -0.4, aRF: 0.45, eL: 0.3, eR: 0.3, aLO: 0.1, aRO: 0.1, y: -0.01 }) },
  freezeStand: { f: () => ({ aRF: 0.8, eR: 0.9, aLO: 0.15, eL: 0.3, lLO: 0.1, lRO: 0.1, hdN: 0.05 }) },
  struggle: { f: (a, t) => ({ aLO: 0.35 + 0.08 * S(t * 23), aRO: 0.35 + 0.08 * S(t * 19), aLF: 0.4, aRF: 0.4, eL: 1.1, eR: 1.1, spF: 0.2, hdN: 0.15, y: 0.008 * S(t * 31), lLO: 0.12, lRO: 0.12 }) },
  tumble: { f: (a) => { const k = 1 - smoothstep(0.3, 1.1, a); return { y: -0.78 * k, lean: -1.2 * k, lLF: 0.9 * k, kL: 0.8 * k, lRF: 0.5 * k, kR: 1.0 * k, aLO: 1.0 * k, aRO: 1.0 * k, aLF: 1.2 * k, aRF: 0.8 * k, hdN: 0.3 * k }; } },
  crouchTreat: { f: (a, t) => ({ lLF: 1.3, kL: 2.0, lRF: 1.2, kR: 2.1, y: -0.46, spF: 0.35, aRF: 1.05, eR: 0.3, aRO: 0.0, aLF: 0.6, eL: 1.0, hdN: 0.3 }) },
  throwUp: { f: (a) => { const k = smoothstep(0, 0.25, a); return { aRF: 2.8 * k, aLF: 2.6 * k, aLO: 0.4, aRO: 0.4, eL: 0.2, eR: 0.2, spF: -0.15 * k, hdN: -0.3 * k, y: 0.05 * k }; } },
  touchHair: { f: (a) => { const k = smoothstep(0, 0.4, a); return { aRF: 2.5 * k, eR: 1.9 * k, aRT: 0.7, aRO: 0.3, hdN: -0.1 * k, aLO: 0.15, eL: 0.3 }; } },
  liftHand: { f: (a) => { const k = smoothstep(0, 0.35, a); return { aRF: 1.2 * k, eR: 0.6, aRT: -0.6 * k, aLO: 0.12, eL: 0.25, hdN: 0.2 }; } },
  facepalm: { f: (a) => { const k = smoothstep(0, 0.35, a); return { aRF: 1.55 * k, aRT: 1.0 * k, aRO: -0.1, eR: 2.35 * k, hdN: 0.35 * k, spF: 0.12 * k, aLO: 0.12, eL: 0.2 }; } },
  leanTable: { gest: true, f: (a, t) => ({ lean: 0.05, spF: 0.32, aLF: 0.85, aRF: 0.85, eL: 0.2, eR: 0.2, aLO: 0.22, aRO: 0.22, hdN: 0.15 + 0.02 * S(t * 1.5), lLO: 0.1, lRO: 0.1 }) },
  sitSleep: { sit: true, f: (a, t) => ({ ...sitLegs, spF: 0.35 + 0.03 * S(t * 1.1), hdN: 0.55 + 0.05 * S(t * 1.1), hdT: 0.2, aLF: 0.4, aRF: 0.4, aLT: 0.9, aRT: 0.9, eL: 1.3, eR: 1.3, aLO: 0.08, aRO: 0.08 }) },
  sitWake: { sit: true, gest: true, f: (a, t) => { const k = smoothstep(0, 0.8, a); return { ...sitLegs, spF: 0.35 - 0.3 * k, hdN: 0.55 - 0.5 * k, hdT: 0.2 - 0.25 * k, aLF: 0.4, aRF: 0.4 + 0.3 * k, aLT: 0.9, aRT: 0.9 - 0.6 * k, eL: 1.3, eR: 1.3 - 0.3 * k, aLO: 0.08, aRO: 0.08 + 0.2 * k }; } },
  // --- Episode 4 (Halloween)
  sitBed: { sit: true, gest: true, f: (a, t, c) => ({ y: -0.62, lLF: 1.5, lRF: 1.5, kL: 0.05, kR: 0.08, fL: 0.3, fR: 0.3, spF: 0.12 + 0.02 * S(t * 1.3), aLF: 0.3, aRF: 0.3, eL: 0.6, eR: 0.6, aLO: 0.15, aRO: 0.15 }) },
  sitStretch: { sit: true, f: (a) => { const k = smoothstep(0, 0.6, a) - smoothstep(1.8, 2.6, a); return { y: -0.62, lLF: 1.5, lRF: 1.5, kL: 0.05, kR: 0.08, fL: 0.3, fR: 0.3, spF: 0.12 - 0.3 * k, aLF: 0.3 + 2.6 * k, aRF: 0.3 + 2.6 * k, aLO: 0.15 + 0.3 * k, aRO: 0.15 + 0.3 * k, eL: 0.6 - 0.4 * k, eR: 0.6 - 0.4 * k, hdN: -0.35 * k }; } },
  stretch: { f: (a) => { const k = smoothstep(0, 0.6, a) - smoothstep(1.6, 2.4, a); return { spF: -0.2 * k, aLF: 2.8 * k, aRF: 2.8 * k, aLO: 0.15 + 0.25 * k, aRO: 0.15 + 0.25 * k, eL: 0.3, eR: 0.3, hdN: -0.3 * k, y: 0.01 * k }; } },
  lieSleep: { f: (a, t) => ({ lean: -1.52, y: -0.8, aLF: 0.15, aRF: 0.15, aLO: 0.12, aRO: 0.12, eL: 0.3, eR: 0.3, hdN: 0.3, lLO: 0.05, lRO: 0.05, spF: 0.015 * S(t * 1.1) }) },
  lieSlap: { f: (a) => { const k = smoothstep(0, 0.25, a), hit = smoothstep(0.25, 0.4, a); return { lean: -1.52, y: -0.8, aLF: 0.15, aLO: 0.12, eL: 0.3, aRO: 0.12 + 1.35 * k, aRF: 0.5 * k - 0.4 * hit, eR: 0.3 + 0.4 * k, hdN: 0.3, hdY: -0.4 * k }; } },
  boo: { f: (a) => { const k = smoothstep(0, 0.18, a); return { aLF: 1.9 * k, aRF: 1.9 * k, aLO: 0.35, aRO: 0.35, eL: 1.1 * k, eR: 1.1 * k, lean: 0.12 * k, spF: 0.15 * k, lLF: 0.4, kL: 0.4, lRF: -0.3, kR: 0.2, hdN: -0.1 }; } },
  holdUpBoth: { f: (a) => { const k = smoothstep(0, 0.4, a); return { aLF: 2.3 * k, aRF: 2.3 * k, aLO: 0.3, aRO: 0.3, eL: 0.3, eR: 0.3, hdN: -0.25 * k, spF: -0.05 }; } },
  showItem: { upper: true, f: (a) => { const k = smoothstep(0, 0.4, a); return { aLF: 1.0 * k, aRF: 1.0 * k, aLO: 0.2, aRO: 0.2, aLT: 0.3, aRT: 0.3, eL: 0.6, eR: 0.6, hdN: 0.15 }; } },
  phone: { upper: true, gest: true, f: (a, t) => ({ aRF: 0.95, eR: 1.45, aRT: 0.55, aRO: 0.0, aLO: 0.12, eL: 0.25, hdN: 0.35 + 0.02 * S(t * 2) }) },
  mic: { upper: true, f: (a, t) => ({ aRF: 1.05, eR: 2.05, aRT: 0.75, aRO: 0.1, aLF: 0.35 + 0.2 * S(t * 1.3), aLO: 0.5, eL: 0.5, spF: -0.03 }) },
  micPresent: { upper: true, f: (a, t) => { const k = smoothstep(0, 0.4, a); return { aRF: 1.05, eR: 2.05, aRT: 0.75, aRO: 0.1, aLF: 1.2 * k, aLO: 1.0 * k, eL: 0.15, spT: 0.2 * k, hdY: 0.2 * k }; } },
  welcome: { gest: false, f: (a, t) => { const k = smoothstep(0, 0.4, a); return { aLF: 0.7 * k, aRF: 0.7 * k, aLO: 0.9 * k, aRO: 0.9 * k, eL: 0.3, eR: 0.3, aLT: -0.6 * k, aRT: -0.6 * k, spF: -0.05, hdT: 0.08 * S(t * 2) }; } },
  wave: { upper: true, f: (a, t) => ({ aRF: 2.4, aRO: 0.6, eR: 0.5 + 0.45 * S(a * 9), aLO: 0.12, eL: 0.2, hdT: 0.1 }) },
  clap: { gest: false, f: (a, t, c) => { const s = Math.abs(S(a * 7 + c.seed)); return { aLF: 1.15, aRF: 1.15, aLT: 1.25, aRT: 1.25, eL: 1.2, eR: 1.2, aLO: 0.22 - 0.24 * s, aRO: 0.22 - 0.24 * s, y: 0.01 * s, hdN: -0.05 }; } },
  cheerJump: { f: (a, t, c) => { const s = Math.abs(S(a * 6 + c.seed)); return { aLF: 2.5, aRF: 2.5, aLO: 0.7, aRO: 0.7, eL: 0.3, eR: 0.3, y: 0.06 * s, kL: 0.25 * (1 - s), kR: 0.25 * (1 - s), hdN: -0.2 }; } },
  sitSlide: { sit: true, f: (a, t) => { const k = smoothstep(0, 1.2, a); return { ...sitLegs, y: -0.3 - 0.3 * k, lean: -0.35 * k, lLF: 1.55 - 0.5 * k, lRF: 1.55 - 0.6 * k, kL: 1.5 - 0.6 * k, kR: 1.5 - 0.5 * k, spF: -0.15 + 0.1 * Math.abs(S(a * 13)), hdN: -0.3, aLF: 0.6, aLT: 1.1, eL: 1.3, aRF: 0.8, aRT: 1.0, eR: 1.6, aLO: 0.1, aRO: 0.1 }; } },
  beeDance: { f: (a, t) => {
    const n1 = noise1(a * 9), n2 = noise1(a * 11 + 4), n3 = noise1(a * 7 + 9);
    return { aLF: 1.6 + 1.0 * n1, aRF: 1.6 + 1.0 * n2, aLO: 0.6 + 0.6 * n3, aRO: 0.6 - 0.6 * n1, eL: 1.0 + 0.8 * n2, eR: 1.0 + 0.8 * n3, aLT: 0.6 * n1, aRT: 0.6 * n2,
      y: 0.05 * Math.abs(S(a * 10)), kL: 0.4 + 0.4 * Math.max(0, S(a * 10)), kR: 0.4 + 0.4 * Math.max(0, -S(a * 10)), lLF: 0.5 * Math.max(0, S(a * 10)), lRF: 0.5 * Math.max(0, -S(a * 10)),
      spT: 0.4 * n3, spS: 0.25 * n1, hdN: 0.2 * n2, hdY: 0.5 * n1, hdT: 0.2 * n3 };
  } },
  courtDance: { f: (a, t) => {
    const b = a * P * 1.6, sw = S(b);
    return { aRF: 2.3 + 0.2 * sw, aRO: 0.9, eR: 0.9, aRT: -0.4, aLF: 0.2, aLO: 0.45, aLT: 1.0, eL: 1.5, spT: 0.25 * sw, spS: 0.08 * sw, twist: 0.35 * sw,
      lLF: 0.45 * Math.max(0, sw), lRF: 0.45 * Math.max(0, -sw), fL: 0.4 * Math.max(0, sw), fR: 0.4 * Math.max(0, -sw), y: 0.03 * Math.abs(sw), hdN: -0.2, hdT: 0.15 * sw };
  } },
  plateBalance: { f: (a, t) => { const w = S(a * 6), w2 = S(a * 9 + 1); return { aRF: 1.0 + 0.25 * w, eR: 1.3 + 0.2 * w2, aRT: 0.3, aRO: 0.1, aLF: 0.4 + 0.6 * w2, aLO: 1.2 + 0.3 * w, eL: 0.4, lean: 0.06 * w, tilt: 0.12 * w2, hdN: 0.1, kL: 0.3, kR: 0.3, y: -0.04 }; } },
  catchItem: { f: (a) => { const k = smoothstep(0, 0.2, a); return { aLF: 1.35 * k, aRF: 1.35 * k, aLO: 0.05, aRO: 0.05, eL: 0.5, eR: 0.5, lean: 0.25 * k, spF: 0.25 * k, lLF: 0.6 * k, kL: 0.5 * k, lRF: -0.4 * k, hdN: 0.15 }; } },
  fireRings: { f: (a, t) => { const k = smoothstep(0, 0.5, a); return { aRF: 1.4 * k, aRO: 0.6 * k, eR: 0.5, aLF: 1.4 * k, aLO: 0.6 * k, eL: 0.5, spF: -0.08, hdN: -0.1, lLF: 0.3, lRF: -0.2 }; } },
  conjure: { f: (a, t) => ({ aLF: 1.1, aRF: 1.1, aLO: 0.55 + 0.1 * S(t * 3), aRO: 0.55 + 0.1 * S(t * 3 + 1), aLT: -0.7, aRT: -0.7, eL: 0.6, eR: 0.6, hdN: -0.15, spF: -0.04 }) },
  sweepUp: { f: (a) => { const k = smoothstep(0, 0.5, a); return { aRF: 2.6 * k, aRO: 0.4, eR: 0.15, aLO: 0.3 + 0.4 * k, eL: 0.2, spF: -0.1 * k, hdN: -0.35 * k }; } },
  sweepTable: { f: (a, t) => ({ lean: 0.08, spF: 0.42, aRF: 1.0, eR: 0.4, aRO: 0.15 + 0.35 * S(a * 7), aLF: 0.9, eL: 0.6, aLO: 0.2, hdN: 0.35, kL: 0.2, kR: 0.2 }) },
  look: { gest: true, f: (a, t, c) => ({ spF: 0.02, aLO: 0.12, aRO: 0.12, eL: 0.18, eR: 0.18, hdN: 0.25 }) },
  gasp: { f: (a) => { const k = smoothstep(0, 0.2, a); return { aLF: 1.3 * k, aRF: 1.3 * k, aLT: 1.2, aRT: 1.2, eL: 2.1 * k, eR: 2.1 * k, lean: -0.1 * k, hdN: -0.1 }; } },
  // --- Episode 5 (Behemoth Awakens)
  fly: { f: (a, t) => ({ lean: 1.35, aLF: 2.85, aRF: 2.6, aLO: 0.12, aRO: 0.25, eL: 0.05, eR: 0.35, hdN: -1.0, lLF: -0.08, lRF: 0.12, kL: 0.1, kR: 0.35, spF: -0.1 + 0.02 * S(t * 3), y: 0.02 * S(t * 2.5) }) },
  hover: { gest: true, f: (a, t) => ({ aLO: 0.55, aRO: 0.55, aLF: 0.2, aRF: 0.2, eL: 0.3, eR: 0.3, lLF: 0.15, lRF: -0.05, kL: 0.35, kR: 0.5, fL: 0.4, fR: 0.4, spF: 0.04 + 0.02 * S(t * 2), y: 0.03 * S(t * 2.2) }) },
  stretchArms: { f: (a, t) => ({ lean: 1.2, aLF: 1.6, aRF: 1.6, aLO: 0.9, aRO: 0.9, eL: 0.0, eR: 0.0, hdN: -0.8, lLF: 0.1, lRF: -0.1, kL: 0.3, kR: 0.4, y: 0.02 * S(t * 3) }) },
  flail: { f: (a, t) => ({ lean: 0.4 * S(a * 5), aLF: 2.2 + 0.6 * S(a * 17), aRF: 2.0 - 0.6 * S(a * 15), aLO: 0.9, aRO: 0.9, eL: 0.5, eR: 0.5, lLF: 0.6 * S(a * 13), lRF: -0.6 * S(a * 13), kL: 0.6, kR: 0.6, hdN: -0.2 }) },
  heroLand: { f: (a) => { const k = 1 - smoothstep(0.5, 1.4, a); return { y: -0.45 * k - 0.02, lLF: 1.45 * k + 0.1, kL: 1.6 * k, lRF: -0.2 * k, kR: 2.0 * k, fR: 0.6 * k, spF: 0.4 * k, aRF: 0.4 * k, eR: 0.2, aRO: 0.1, aLF: -0.2 * k, aLO: 0.9 * k, eL: 0.2, hdN: -0.3 * k }; } },
  liftOver: { f: (a, t) => { const k = smoothstep(0, 0.4, a); return { aLF: 2.9 * k, aRF: 2.9 * k, aLO: 0.35, aRO: 0.35, eL: 0.25, eR: 0.25, lLF: 0.4, lRF: -0.3, kL: 0.4, kR: 0.25, y: -0.06 * k + 0.01 * S(t * 25), spF: -0.12 * k, hdN: -0.35 * k }; } },
  throwOver: { f: (a) => { const k = smoothstep(0, 0.12, a), b = smoothstep(0.12, 0.35, a); return { aLF: 2.9 - 1.6 * b, aRF: 2.9 - 1.6 * b, aLO: 0.35, aRO: 0.35, eL: 0.25, eR: 0.25, lean: 0.25 * b, spF: -0.15 * k + 0.4 * b, lLF: 0.7, kL: 0.5, lRF: -0.5, kR: 0.2, y: -0.06, hdN: -0.2 }; } },
  carried: { f: (a, t) => ({ lean: 1.4, aLF: 2.7, aRF: 2.7, aLO: 0.3, aRO: 0.3, eL: 0.1, eR: 0.1, hdN: -1.0, lLF: 0.1, lRF: -0.1, kL: 0.2, kR: 0.3, spF: 0.02 * S(t * 9) }) },
  climb: { f: (a, t) => { const c = S(a * 6); return { lean: 0.55, spF: 0.3, aLF: 2.2 + 0.5 * c, aRF: 2.2 - 0.5 * c, aLO: 0.3, aRO: 0.3, eL: 0.6 - 0.4 * c, eR: 0.6 + 0.4 * c, lLF: 1.0 + 0.5 * c, lRF: 1.0 - 0.5 * c, kL: 1.4, kR: 1.4, y: -0.35, hdN: -0.5 }; } },
  heave: { f: (a, t) => ({ aLF: 2.75, aRF: 2.75, aLO: 0.25 + 0.05 * S(t * 31), aRO: 0.25 + 0.05 * S(t * 29), eL: 0.6, eR: 0.6, lean: -0.2, spF: -0.25, lLF: 0.6, kL: 0.8, lRF: -0.3, kR: 0.5, y: -0.12 + 0.012 * S(t * 33), hdN: -0.3 }) },
  holdHigh: { f: (a, t) => { const k = smoothstep(0, 0.4, a); return { aLF: 2.8 * k, aRF: 2.8 * k, aLO: 0.4, aRO: 0.4, eL: 0.35, eR: 0.35, spF: -0.1 * k, hdN: -0.45 * k, lLO: 0.12, lRO: 0.12 }; } },
  cover: { f: (a, t) => ({ aLF: 1.6, aRF: 1.6, aLT: 1.1, aRT: 1.1, eL: 2.0, eR: 2.0, aLO: 0.1, aRO: 0.1, spF: 0.3, hdN: 0.35, lean: 0.1, kL: 0.4, kR: 0.4, lLF: 0.3, y: -0.08 }) },
  knockBack: { f: (a) => { const k = 1 - smoothstep(0.2, 0.9, a); return { lean: -0.9 * k, spF: -0.3 * k, aLF: 1.5 * k, aRF: 1.4 * k, aLO: 1.1 * k + 0.1, aRO: 1.1 * k + 0.1, eL: 0.5, eR: 0.5, lLF: 0.8 * k, kL: 0.5 * k, lRF: 0.4 * k, kR: 0.7 * k, hdN: 0.4 * k, y: -0.2 * k }; } },
  getUp: { f: (a) => { const k = 1 - smoothstep(0, 1.6, a); return { y: -0.45 * k, lLF: 1.3 * k, kL: 1.8 * k, lRF: 0.4 * k, kR: 1.4 * k, spF: 0.5 * k + 0.1, aLF: 0.7 * k, aRF: 1.0 * k, eL: 0.6, eR: 0.5, aLO: 0.2, aRO: 0.2, hdN: 0.2 * k }; } },
  reachTremble: { f: (a, t) => { const k = smoothstep(0, 0.5, a); return { aRF: 1.45 * k + 0.05 * S(t * 37), aRO: 0.05, eR: 0.15 + 0.06 * S(t * 41), aLO: 0.25, aLF: 0.3, eL: 0.6, spF: 0.15, lean: 0.06, hdN: 0.05, lLF: 0.45, kL: 0.5, lRF: -0.3, kR: 0.3, y: -0.08 + 0.01 * S(t * 30) }; } },
  brushOff: { f: (a, t) => { const s2 = S(a * 9); return { aRF: 0.9 + 0.2 * s2, aRT: 1.0, eR: 1.4 + 0.2 * s2, aRO: -0.05, aLF: 0.3, aLO: 0.2, eL: 0.4, hdN: 0.4, spF: 0.15 }; } },
  sitSlump: { sit: true, gest: true, f: (a, t) => ({ ...sitLegs, y: -0.4, lean: -0.3, spF: -0.25, aLF: 0.2, aRF: 0.2, aLO: 0.7, aRO: 0.7, eL: 0.4, eR: 0.4, hdN: -0.15, lLF: 1.2, lRF: 1.25, kL: 1.1, kR: 1.15 }) },
  raiseHand: { gest: false, f: (a) => { const k = smoothstep(0, 0.3, a); return { aRF: 2.85 * k, aRO: 0.15, eR: 0.15, aLO: 0.12, eL: 0.2, hdN: -0.05 }; } },
  powerFail: { f: (a, t) => { const k = smoothstep(0, 0.3, a); return { aLF: 1.2 * k, aRF: 1.2 * k, aLO: 0.5 * k, aRO: 0.5 * k, eL: 0.4, eR: 0.4, spF: 0.1, lLF: 0.3, lRF: -0.25, kL: 0.3, kR: 0.25, y: -0.04 + 0.006 * S(t * 30), hdN: -0.05 }; } },
  doubleOver: { f: (a, t) => ({ spF: 0.6, hdN: 0.25, aLF: 0.9, aRF: 0.9, aLT: 0.8, aRT: 0.8, eL: 0.5, eR: 0.5, lLF: 0.3, kL: 0.5, kR: 0.4, y: -0.1, lean: 0.12 + 0.03 * S(t * 3) }) },
  pointMap: { gest: false, f: (a, t) => { const k = smoothstep(0, 0.4, a); return { lean: 0.05, spF: 0.3, aRF: 1.0 + 0.1 * k, aRO: 0.0, eR: 0.15, aLF: 0.85, aLO: 0.22, eL: 0.2, hdN: 0.2, lLO: 0.1, lRO: 0.1 }; } },
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
  sleep: { smile: 0, open: 0, brow: -0.01, tilt: 0, lid: 0.95, wide: 1 },
  serious: { smile: -0.1, open: 0, brow: -0.012, tilt: 0.2, lid: 0.2, wide: 1 },
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
  const iris = mat(cfg.eyeColor, { r: 0.3 }).clone();
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
  F.iris = iris;
  return F;
}

function buildHair(head, cfg, hc, r) {
  const R = rng(cfg.seed * 97 + 13);
  const m = mat(cfg.hairColor, { r: 0.7 }).clone();
  cfg._hairMat = m;
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
    const bm = cfg.streakColor && Math.abs(x - 0.12) < 0.05 ? mat(cfg.streakColor, { r: 0.6 }) : m;
    const mesh = mk(new THREE.ConeGeometry(r * 0.2, len, 7), bm, g, [base.x + d.x * len * 0.35, base.y + d.y * len * 0.35, base.z + d.z * len * 0.35]);
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
  const accent = mat(cfg.accent ?? 0x2f6dff, { r: 0.4, e: cfg.accentGlow ?? 0x0b2a90, ei: 0.6 }).clone();
  const pad = mat(cfg.pad ?? 0x2747c7, { r: 0.35 });
  const glove = (cfg.bareHands ? mat(cfg.skin, { r: 0.55 }) : mat(cfg.glove ?? 0x151d55, { r: 0.6 })).clone();
  const boot = mat(cfg.boot ?? 0x2850d0, { r: 0.4 });
  const sole = mat(0x0d1030, { r: 0.8 });
  const skin = mat(cfg.skin, { r: 0.55 });
  const pants = cfg.pants ? mat(cfg.pants, { r: 0.7 }) : suit;
  const emb = cfg.emblem === false ? null : new THREE.MeshBasicMaterial({ map: emblemTex(cfg.emblemGlow, cfg.emblemCore), transparent: true });

  const body = grp(root);
  body.scale.setScalar(cfg.scale ?? 0.86);
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
  if (cfg.coat) {
    const coat = mat(cfg.coat, { r: 0.75 });
    // long coat body, flared skirt down to the shins, popped collar and lapels
    mk(new THREE.CapsuleGeometry(0.185, 0.24, 6, 18), coat, spine, [0, 0.25, 0], [0, 0, 0], [1.25, 1, 0.86]);
    const skirt = new THREE.LatheGeometry([[0.24, 0.12], [0.26, 0], [0.3, -0.3], [0.34, -0.6], [0.36, -0.72]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
    mk(skirt, mat(cfg.coat, { r: 0.75, side: THREE.DoubleSide }), hips, [0, 0, 0], [0, 0, 0], [1, 1, 0.8]);
    for (const sd of [1, -1]) {
      mk(new THREE.BoxGeometry(0.1, 0.2, 0.03), coat, spine, [sd * 0.1, 0.56, -0.02], [-0.25, 0, sd * -0.35]);
      mk(new THREE.BoxGeometry(0.07, 0.36, 0.02), mat(cfg.coatDark ?? 0x0c0c10, { r: 0.7 }), spine, [sd * 0.07, 0.3, 0.155], [0, 0, sd * 0.25]);
      if (cfg.coatTrim) mk(new THREE.BoxGeometry(0.015, 0.36, 0.022), mat(cfg.coatTrim, { r: 0.5, e: cfg.coatTrim, ei: 0.4 }), spine, [sd * 0.1, 0.3, 0.158], [0, 0, sd * 0.25]);
    }
    mk(new THREE.BoxGeometry(0.06, 0.04, 0.02), mat(0x9a9aa0, { m: 0.7 }), hips, [0, 0.07, 0.15]);
  }
  // neck + head
  const neck = grp(spine, 0, 0.52, 0);
  mk(new THREE.CylinderGeometry(0.055, 0.06, 0.12, 12), skin, neck, [0, 0.03, 0]);
  const head = grp(neck, 0, 0.06, 0); J.head = head;
  const r = 0.2, hc = 0.2;
  mk(new THREE.SphereGeometry(r, 32, 24), skin, head, [0, hc, 0], [0, 0, 0], [0.95, 1.07, 1.0]);
  // jaw/cheeks for a softer face shape
  const face = cfg.face === 'greg' ? buildGregFace(head, hc, r) : buildFace(head, cfg, hc, r);
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
    if (cfg.armband && side === 'L') mk(new THREE.CylinderGeometry(0.079, 0.079, 0.07, 14), mat(cfg.armband, { r: 0.5, e: cfg.armband, ei: 0.25 }), sh, [0, -0.17, 0]);
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

  const extras = buildExtras(cfg, J, neck, hc, r);
  const base = { hair: cfg._hairMat ? cfg._hairMat.color.clone() : null, accent: accent.color.clone(), accentE: accent.emissive.clone(), glove: glove.color.clone(), iris: face.iris.color.clone() };
  const BLUE = new THREE.Color(0x4aa8ff), PURPLE = new THREE.Color(0xb050ff), DARKP = new THREE.Color(0x2a0a3a), REDEYE = new THREE.Color(0xff1a1a);
  const hero = {
    // power glows driven by tracks: hair/suit turning blue, eyes and gloves turning purple
    applyGlow(g) {
      if (cfg._hairMat) {
        cfg._hairMat.color.copy(base.hair).lerp(BLUE, g.hair * 0.85);
        cfg._hairMat.emissive.copy(BLUE).multiplyScalar(g.hair * 0.45);
      }
      accent.color.copy(base.accent).lerp(BLUE, g.suit);
      accent.emissive.copy(base.accentE).lerp(BLUE, g.suit);
      accent.emissiveIntensity = 0.6 + g.suit * 1.2;
      face.iris.color.copy(base.iris).lerp(PURPLE, g.eyes);
      face.iris.emissive.copy(PURPLE).multiplyScalar(g.eyes * 1.4);
      glove.color.copy(base.glove).lerp(DARKP, g.glove);
      glove.emissive.copy(PURPLE).multiplyScalar(g.glove * 0.6);
      // red power eyes (Greg) and dimmed accents after the power drain
      if (g.red > 0) { face.iris.color.lerp(REDEYE, g.red); face.iris.emissive.copy(REDEYE).multiplyScalar(g.red * 2.2); }
      const dim = 1 - 0.85 * (g.dim ?? 0);
      accent.emissiveIntensity *= dim;
      if (extras.armorGlow) { extras.armorGlow.emissiveIntensity = (1.2 + g.suit * 1.0) * dim * (g.flicker ? (0.35 + 0.65 * g.flicker) : 1); }
    },
    name: cfg.name, root, J, face, cfg, seed: cfg.seed ?? 1,
    extras,
    // costume pieces that move: the monster mask (0 off, 1 on the face, 2 pushed up)
    applyExtras(x) { if (extras.mask) { const m = x.mask ?? 0; extras.mask.visible = m > 0.5; const up = m > 1.5 ? 1 : 0; extras.maskPivot.rotation.x = -2.4 * up; extras.maskPivot.position.set(0, extras.maskHc + 0.05 * up, -0.03 * up); } if (extras.milk) extras.milk.visible = (x.milk ?? 0) > 0.5; if (extras.slimeParts) for (const m of extras.slimeParts) m.visible = (x.slime ?? 0) > 0.5; if (extras.scuffs) for (const m of extras.scuffs) m.visible = (x.scuff ?? 0) > 0.5; },
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
      // Greg's line eyes vanish if fully squinted, so he only half-squints
      const lid = cfg.face === 'greg' ? clamp(1 - e.lid * 0.45 - blink, 0.08, 1.2) : clamp(1 - e.lid - blink, 0.06, 1.2);
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

// Costume pieces added on top of a hero: cfg.extras = ['cape', 'ruff', ...]
function buildExtras(cfg, J, neck, hc, r) {
  const ex = { mask: null, maskY: 0 };
  const list = cfg.extras ?? [];
  const has = (k) => list.includes(k);
  const head = J.head;
  if (has('cape')) {
    const out = mat(0x0b0b10, { r: 0.55 }), inn = mat(0xb0101e, { r: 0.45, side: THREE.BackSide });
    const geo = new THREE.CylinderGeometry(0.2, 0.44, 1.18, 22, 1, true, P * 0.6, P * 0.8);
    const c = grp(J.spine, 0, 0.47, -0.02);
    mk(geo, out, c, [0, -0.59, -0.03]); mk(geo, inn, c, [0, -0.59, -0.03]);
    for (const sd of [1, -1]) mk(new THREE.BoxGeometry(0.15, 0.24, 0.015), mat(0xb0101e, { r: 0.45, side: THREE.DoubleSide }), c, [sd * 0.1, 0.12, -0.12], [-0.35, sd * 0.55, sd * 0.1]);
    mk(new THREE.SphereGeometry(0.025, 10, 8), mat(0xd8b040, { m: 0.7, r: 0.3 }), c, [0, 0.02, 0.14]);
  }
  if (has('ruff')) {
    const w = mat(0xf6f2ea, { r: 0.8 });
    mk(new THREE.TorusGeometry(0.105, 0.045, 10, 28), w, neck, [0, 0.0, 0], [P / 2, 0, 0], [1, 1, 0.7]);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * P * 2; mk(new THREE.SphereGeometry(0.045, 8, 6), w, neck, [Math.sin(a) * 0.13, 0.0, Math.cos(a) * 0.13], [0, 0, 0], [1, 0.55, 1]); }
  }
  if (has('medallion')) {
    const gold = mat(0xe0b040, { m: 0.8, r: 0.3, e: 0x402a00, ei: 0.4 });
    mk(new THREE.TorusGeometry(0.15, 0.008, 6, 30, P), gold, J.spine, [0, 0.44, 0.07], [P * 0.62, 0, 0]);
    mk(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 16), gold, J.spine, [0, 0.31, 0.155], [P / 2, 0, 0]);
  }
  if (has('shoulderCape')) {
    const m = mat(cfg.capeColor ?? 0x6a1430, { r: 0.6, side: THREE.DoubleSide });
    mk(new THREE.CylinderGeometry(0.2, 0.3, 0.55, 16, 1, true, P * 0.55, P * 0.9), m, J.spine, [0, 0.2, -0.02]);
  }
  if (has('bowtie')) {
    const o = mat(cfg.bowColor ?? 0xff7a1a, { r: 0.5 });
    for (const sd of [1, -1]) mk(new THREE.ConeGeometry(0.03, 0.06, 8), o, neck, [sd * 0.03, 0.0, 0.065], [0, 0, sd * P / 2]);
    mk(new THREE.SphereGeometry(0.014, 8, 6), o, neck, [0, 0, 0.068]);
  }
  if (has('topHat')) {
    const h = grp(head, 0, hc + r * 0.98, -0.01); h.rotation.set(-0.08, 0, 0.1);
    const blk = mat(0x111114, { r: 0.4 });
    mk(new THREE.CylinderGeometry(0.27, 0.27, 0.015, 26), blk, h, [0, 0, 0]);
    mk(new THREE.CylinderGeometry(0.15, 0.165, 0.32, 24), blk, h, [0, 0.16, 0]);
    mk(new THREE.CylinderGeometry(0.168, 0.168, 0.05, 24), mat(cfg.bowColor ?? 0xff7a1a, { r: 0.5, e: 0x401800, ei: 0.4 }), h, [0, 0.04, 0]);
  }
  if (has('witchHat')) {
    const h = grp(head, 0, hc + r * 0.95, -0.02); h.rotation.set(-0.12, 0, 0.12);
    const m = mat(0x15101e, { r: 0.6 });
    mk(new THREE.CylinderGeometry(0.33, 0.33, 0.012, 24), m, h, [0, 0, 0]);
    const cone = mk(new THREE.ConeGeometry(0.17, 0.5, 18), m, h, [0, 0.25, 0]); cone.rotation.x = -0.15;
    mk(new THREE.CylinderGeometry(0.172, 0.172, 0.05, 18), mat(0x8a3ad0, { r: 0.5 }), h, [0, 0.04, 0]);
  }
  if (has('catEars')) for (const sd of [1, -1]) {
    mk(new THREE.ConeGeometry(0.07, 0.13, 4), mat(0x15151a, { r: 0.7 }), head, [sd * 0.12, hc + r * 1.05, 0.0], [0, 0, sd * -0.35]);
  }
  if (has('horns')) for (const sd of [1, -1]) {
    mk(new THREE.ConeGeometry(0.035, 0.12, 10), mat(0xd02030, { r: 0.4, e: 0x400000, ei: 0.5 }), head, [sd * 0.1, hc + r * 1.0, 0.05], [0.2, 0, sd * -0.4]);
  }
  if (has('crown')) {
    const gold = mat(0xf0c040, { m: 0.85, r: 0.25 });
    const c = grp(head, 0, hc + r * 0.95, 0);
    mk(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 20, 1, true), mat(0xf0c040, { m: 0.85, r: 0.25, side: THREE.DoubleSide }), c, [0, 0.02, 0]);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * P * 2; mk(new THREE.ConeGeometry(0.03, 0.08, 6), gold, c, [Math.sin(a) * 0.15, 0.09, Math.cos(a) * 0.15]); }
  }
  if (has('cowboyHat')) {
    const h = grp(head, 0, hc + r * 0.92, 0); const m = mat(0x8a5a2e, { r: 0.8 });
    mk(new THREE.CylinderGeometry(0.33, 0.33, 0.015, 24), m, h, [0, 0, 0], [0, 0, 0], [1, 1, 0.85]);
    mk(new THREE.CylinderGeometry(0.15, 0.17, 0.16, 20), m, h, [0, 0.08, 0]);
  }
  if (has('headphones')) {
    const m = mat(0x1a1a22, { r: 0.4 }), g = mat(0x3fd2ff, { e: 0x3fd2ff, ei: 1.0 });
    mk(new THREE.TorusGeometry(0.21, 0.018, 6, 24, P), m, head, [0, hc + 0.02, 0], [0, P / 2, 0]);
    for (const sd of [1, -1]) { mk(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16), m, head, [sd * 0.2, hc, 0], [0, 0, P / 2]); mk(new THREE.CylinderGeometry(0.05, 0.05, 0.052, 16), g, head, [sd * 0.205, hc, 0], [0, 0, P / 2]); }
  }
  if (has('pumpkinHead')) {
    const pm = mat(0xff8a1a, { r: 0.6 }), glow = mat(0xffd040, { e: 0xffa020, ei: 1.6 });
    const ph = grp(head, 0, hc + 0.01, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * P * 2; mk(new THREE.SphereGeometry(r * 0.75, 14, 10), pm, ph, [Math.sin(a) * r * 0.45, 0, Math.cos(a) * r * 0.45], [0, a, 0], [0.6, 1.05, 1]); }
    mk(new THREE.CylinderGeometry(0.025, 0.035, 0.09, 8), mat(0x3a6a2a), ph, [0, r * 1.1, 0]);
    for (const sd of [1, -1]) mk(new THREE.ConeGeometry(0.04, 0.05, 3), glow, ph, [sd * 0.08, 0.05, r * 1.05], [P / 2, 0, 0]);
    mk(new THREE.BoxGeometry(0.16, 0.035, 0.02), glow, ph, [0, -0.07, r * 1.04]);
  }
  if (has('ghostSheet')) {
    const w = mat(0xf4f4f8, { r: 0.9, side: THREE.DoubleSide });
    const prof = [[0.0, 0.42], [0.16, 0.38], [0.24, 0.25], [0.27, 0.0], [0.33, -0.5], [0.42, -1.05], [0.45, -1.1]].map(([x, y]) => new THREE.Vector2(x, y));
    mk(new THREE.LatheGeometry(prof, 24), w, J.spine, [0, 0.62, 0]);
    for (const sd of [1, -1]) mk(new THREE.CircleGeometry(0.04, 12), mat(0x111111, { side: THREE.DoubleSide }), J.spine, [sd * 0.08, 0.88, 0.235], [-0.3, 0, 0], [0.8, 1.2, 1]);
  }
  if (has('monsterMask')) {
    const fur = mat(0x4a7a3a, { r: 0.95 }), dark = mat(0x2a4a22, { r: 0.95 });
    const m = grp(head, 0, 0, 0); ex.mask = m; ex.maskY = 0;
    const pivot = grp(m, 0, hc, 0); ex.maskPivot = pivot; ex.maskHc = hc;
    mk(new THREE.SphereGeometry(r * 1.13, 24, 16, -P * 0.62, P * 1.24, 0, P), fur, pivot, [0, 0, 0.0], [0, 0, 0], [1, 1.04, 1.05]);
    for (let i = 0; i < 12; i++) { const a = -1 + (i / 11) * 2; mk(new THREE.ConeGeometry(0.03, 0.09, 6), dark, pivot, [Math.sin(a) * r * 1.05, r * 0.95 + 0.04 * Math.cos(i), Math.cos(a) * r * 0.55], [0.3, 0, -a * 0.5]); }
    for (const sd of [1, -1]) {
      mk(new THREE.ConeGeometry(0.035, 0.16, 8), mat(0xe8e0c8, { r: 0.5 }), pivot, [sd * 0.13, r * 1.0, 0.06], [0.3, 0, sd * -0.5]);
      mk(new THREE.SphereGeometry(0.045, 12, 10), mat(0xffe040, { e: 0xffc000, ei: 0.8 }), pivot, [sd * 0.08, 0.05, r * 1.08]);
      mk(new THREE.SphereGeometry(0.02, 8, 6), mat(0x111111), pivot, [sd * 0.08, 0.05, r * 1.08 + 0.035]);
    }
    for (let i = 0; i < 6; i++) mk(new THREE.ConeGeometry(0.018, 0.05, 5), mat(0xffffff, { r: 0.4 }), pivot, [-0.1 + i * 0.04, -0.09, r * 1.06], [P, 0, 0]);
    mk(new THREE.TorusGeometry(0.11, 0.02, 6, 16, P), mat(0x1a0a0a), pivot, [0, -0.07, r * 1.02], [0, 0, P]);
    m.visible = false;
  }
  if (has('dino')) {
    const g = mat(0x52c04a, { r: 0.55 }), belly = mat(0xd8f0a0, { r: 0.6 }), spike = mat(0x2f8a2f, { r: 0.5 });
    mk(new THREE.SphereGeometry(0.3, 24, 18), g, J.spine, [0, 0.2, -0.02], [0, 0, 0], [1.15, 1.32, 1.05]);
    mk(new THREE.SphereGeometry(0.22, 18, 14), belly, J.spine, [0, 0.14, 0.12], [0, 0, 0], [1.05, 1.3, 0.75]);
    const tail = grp(J.hips, 0, -0.05, -0.2);
    for (let i = 0; i < 5; i++) mk(new THREE.SphereGeometry(0.16 - i * 0.025, 14, 10), g, tail, [0, -0.06 * i, -0.13 * i], [0, 0, 0], [1, 0.85, 1.25]);
    for (let i = 0; i < 6; i++) mk(new THREE.ConeGeometry(0.05, 0.1, 6), spike, J.spine, [0, 0.52 - i * 0.12, -0.32 + 0.02 * Math.abs(i - 2)], [-0.5 - i * 0.12, 0, 0]);
    const hood = grp(head, 0, hc, 0);
    mk(new THREE.SphereGeometry(r * 1.2, 22, 16), g, hood, [0, r * 0.62, -0.02], [0, 0, 0], [1.0, 0.72, 1.1]);
    mk(new THREE.SphereGeometry(r * 0.85, 18, 12), g, hood, [0, r * 0.72, r * 0.9], [0, 0, 0], [0.85, 0.55, 1.0]);
    for (let i = 0; i < 7; i++) { const a = -0.8 + (i / 6) * 1.6; mk(new THREE.ConeGeometry(0.016, 0.045, 5), mat(0xffffff, { r: 0.4 }), hood, [Math.sin(a) * r * 0.7, r * 0.42, r * 0.9 + Math.cos(a) * r * 0.55], [P, 0, 0]); }
    for (const sd of [1, -1]) {
      mk(new THREE.SphereGeometry(0.05, 12, 10), mat(0xffffff, { r: 0.3 }), hood, [sd * 0.09, r * 1.22, r * 0.45]);
      mk(new THREE.SphereGeometry(0.025, 8, 6), mat(0x111111), hood, [sd * 0.09, r * 1.24, r * 0.45 + 0.035]);
      mk(new THREE.SphereGeometry(0.012, 6, 5), mat(0x1a5a1a), hood, [sd * 0.04, r * 0.92, r * 1.62]);
    }
    for (let i = 0; i < 3; i++) mk(new THREE.ConeGeometry(0.05, 0.1, 6), spike, hood, [0, r * 1.38 - i * 0.04, -0.02 - i * 0.12], [-0.4 - i * 0.4, 0, 0]);
  }
  if (has('armor')) {
    // Episode 5 upgraded uniform: chest plate, bigger shoulder guards, forearm guards with glowing strips
    const steel = mat(cfg.armorColor ?? 0x9fb4d8, { r: 0.28, m: 0.65 });
    const glowA = mat(cfg.accent ?? 0x7fe0ff, { r: 0.3, e: cfg.accentGlow ?? 0x2fc0ff, ei: 1.2 }).clone();
    ex.armorGlow = glowA;
    mk(new RoundedBoxGeometry(0.3, 0.2, 0.06, 2, 0.025), steel, J.spine, [0, 0.34, 0.125], [-0.08, 0, 0]);
    mk(new THREE.BoxGeometry(0.2, 0.014, 0.012), glowA, J.spine, [0, 0.27, 0.16]);
    mk(new THREE.BoxGeometry(0.012, 0.12, 0.012), glowA, J.spine, [0, 0.36, 0.158]);
    for (const [side, sd] of [['L', 1], ['R', -1]]) {
      mk(new RoundedBoxGeometry(0.15, 0.06, 0.19, 2, 0.025), steel, J.sh[side], [sd * 0.025, 0.035, 0], [0, 0, sd * -0.3]);
      mk(new THREE.BoxGeometry(0.15, 0.012, 0.012), glowA, J.sh[side], [sd * 0.03, 0.005, 0.095], [0, 0, sd * -0.3]);
      mk(new RoundedBoxGeometry(0.1, 0.13, 0.1, 2, 0.02), steel, J.el[side], [0, -0.15, 0.01]);
      mk(new THREE.BoxGeometry(0.012, 0.11, 0.012), glowA, J.el[side], [0, -0.15, 0.062]);
      mk(new RoundedBoxGeometry(0.11, 0.1, 0.06, 2, 0.02), steel, J.kn[side], [0, -0.0, 0.085]);
    }
  }
  if (has('slime')) {
    // Greg after his trip through Behemoth's mouth
    const sl = mat(0xb050ff, { r: 0.1, m: 0.1, e: 0x6a10c0, ei: 0.6, opacity: 0.85 });
    ex.slime = grp(J.hips);
    const R2 = rng(cfg.seed * 13 + 5);
    const parts = [[J.head, 0, 0.32, 0, 0.1], [J.head, 0.1, 0.25, 0.12, 0.06], [J.head, -0.12, 0.2, 0.1, 0.05], [J.spine, 0.08, 0.35, 0.16, 0.08], [J.spine, -0.1, 0.2, 0.17, 0.07], [J.spine, 0.05, 0.1, -0.16, 0.09], [J.sh.L, 0, -0.15, 0.06, 0.06], [J.sh.R, 0, -0.1, 0.06, 0.07], [J.el.L, 0, -0.1, 0.05, 0.05], [J.el.R, 0, -0.18, 0.05, 0.06], [J.kn.L, 0, -0.15, 0.06, 0.06], [J.hips, 0.1, -0.02, 0.12, 0.07]];
    ex.slimeParts = [];
    for (const [par, x, y, z, r0] of parts) {
      const m = mk(new THREE.SphereGeometry(r0, 10, 8), sl, par, [x, y, z], [0, 0, 0], [1.3, 0.7 + R2() * 0.4, 1.1], false);
      m.visible = false; ex.slimeParts.push(m);
      const d = mk(new THREE.SphereGeometry(r0 * 0.4, 8, 6), sl, par, [x + 0.02, y - r0 * 0.9, z + 0.01], [0, 0, 0], [0.8, 1.6, 0.8], false);
      d.visible = false; ex.slimeParts.push(d);
    }
  }
  if (has('scuffs')) {
    ex.scuffs = [];
    const dirt = mat(0x2a2620, { r: 1, opacity: 0.55 });
    for (const [par, x, y, z, r0, ry] of [[J.spine, 0.06, 0.18, 0.143, 0.035, 0], [J.spine, -0.09, 0.36, 0.14, 0.025, 0], [J.kn.L, 0, -0.2, 0.08, 0.03, 0], [J.el.R, 0, -0.08, 0.062, 0.022, 0], [J.hips, -0.1, -0.02, 0.125, 0.03, 0]]) {
      const m = mk(new THREE.CircleGeometry(r0, 10), dirt, par, [x, y, z], [0, ry, 0], [1.4, 1, 1], false); m.visible = false; ex.scuffs.push(m);
    }
  }
  if (has('milkStain')) {
    ex.milk = grp(J.spine, 0.03, 0.27, 0.142);
    for (const [x, y, r] of [[0, 0, 0.07], [0.05, -0.06, 0.04], [-0.04, -0.08, 0.035], [0.02, -0.12, 0.025], [-0.06, 0.03, 0.03]]) mk(new THREE.CircleGeometry(r, 14), mat(0xf8f8ff, { r: 0.25 }), ex.milk, [x, y, 0.002], [0, 0, 0], null, false);
    ex.milk.visible = false;
  }
  return ex;
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

function buildGregFace(head, hc, r) {
  const black = mat(0x050505, { r: 0.3 }).clone();
  const eyes = [];
  for (const sd of [1, -1]) {
    const eg = grp(head, sd * r * 0.32, hc + r * 0.12, r * 0.94);
    eg.rotation.y = sd * 0.32;
    const eye = grp(eg);
    mk(new THREE.CapsuleGeometry(r * 0.07, r * 0.32, 4, 8), black, eye, [0, 0, 0], [0, 0, 0], [1.1, 1, 1.5], false);
    eyes.push({ eg, eye, ir: new THREE.Group() });
  }
  const dummy = () => new THREE.Group();
  return { eyes, brows: [], smile: dummy(), open: dummy(), mg: dummy(), iris: black };
}

// Soul Stealer: tall hooded villain with glowing red eyes and a red symbol in his palm.
export function buildSoulStealer(symbolTex) {
  const root = new THREE.Group();
  const cloth = mat(0x15101e, { r: 0.92 });
  const trim = mat(0x5a0a14, { r: 0.6, e: 0x400008, ei: 0.6 });
  const body = grp(root);
  const prof = [[0.62, 0], [0.58, 0.3], [0.48, 0.8], [0.36, 1.3], [0.33, 1.6], [0.4, 1.78], [0.18, 1.9], [0.0, 1.92]].map(([x, y]) => new THREE.Vector2(x, y));
  const cloakGeo = new THREE.LatheGeometry(prof, 32);
  const base = Float32Array.from(cloakGeo.attributes.position.array);
  mk(cloakGeo, cloth, body);
  mk(new THREE.TorusGeometry(0.6, 0.025, 6, 32), trim, body, [0, 0.03, 0], [P / 2, 0, 0]);
  for (const sd of [1, -1]) mk(new THREE.BoxGeometry(0.04, 1.2, 0.02), trim, body, [sd * 0.12, 1.0, 0.43], [-0.17, 0, sd * 0.05]);
  // hood
  const hood = grp(body, 0, 2.02, 0);
  mk(new THREE.SphereGeometry(0.34, 24, 18, P * 0.62, P * 1.76, 0, P * 0.78), mat(0x1c1426, { r: 0.9, side: THREE.DoubleSide }), hood, [0, 0, 0], [0, 0, 0], [1, 1.15, 1.05]);
  mk(new THREE.ConeGeometry(0.12, 0.3, 10), mat(0x1c1426, { r: 0.9 }), hood, [0, 0.32, -0.1], [-0.5, 0, 0]);
  mk(new THREE.SphereGeometry(0.27, 20, 14), new THREE.MeshBasicMaterial({ color: 0x020104 }), hood, [0, -0.02, 0.04], [0, 0, 0], [1, 1.1, 0.9]);
  const glowTex = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const eyes = [];
  for (const sd of [1, -1]) {
    const e = grp(hood, sd * 0.09, 0.0, 0.29);
    const em = new THREE.MeshBasicMaterial({ color: 0xff3030 });
    mk(new THREE.SphereGeometry(0.035, 12, 8), em, e, [0, 0, 0], [0, 0, 0], [1.3, 1, 0.5], false);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.z = 0.03; e.add(glow);
    eyes.push({ e, glow, em });
  }
  // arms: sleeves flaring toward the hands
  const arms = {};
  for (const [side, sd] of [['L', 1], ['R', -1]]) {
    const sh = grp(body, sd * 0.36, 1.68, 0); sh.rotation.order = 'ZXY';
    mk(new THREE.CylinderGeometry(0.15, 0.08, 0.75, 14, 1, true), mat(0x15101e, { r: 0.92, side: THREE.DoubleSide }), sh, [0, -0.36, 0]);
    const hand = grp(sh, 0, -0.74, 0);
    mk(new THREE.SphereGeometry(0.065, 12, 10), mat(0x3a3040, { r: 0.6 }), hand, [0, 0, 0], [0, 0, 0], [0.9, 1.1, 0.7]);
    for (let i = 0; i < 4; i++) mk(new THREE.CapsuleGeometry(0.014, 0.06, 3, 6), mat(0x3a3040, { r: 0.6 }), hand, [(i - 1.5) * 0.025, -0.07, 0.01]);
    arms[side] = { sh, hand };
  }
  const symbol = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), new THREE.MeshBasicMaterial({ map: symbolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  root.add(symbol);
  const palmGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  root.add(palmGlow);
  const palmLight = new THREE.PointLight(0xff2030, 0, 5, 1.5); palmLight.position.y = 0.2; arms.R.hand.add(palmLight);
  const faceLight = new THREE.PointLight(0xff2030, 0, 2.5, 2); faceLight.position.set(0, 2.0, 0.6); body.add(faceLight);
  // hood of swirling smoke
  const smokeM = new THREE.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 1, transparent: true, opacity: 0.38, depthWrite: false });
  const smoke = [];
  for (let i = 0; i < 26; i++) { const m = mk(new THREE.IcosahedronGeometry(1, 1), smokeM, root, [0, 0, 0], [0, 0, 0], null, false); smoke.push(m); }
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 16, -P / 2.6, P / 1.3, P * 0.18, P * 0.62), new THREE.MeshBasicMaterial({ color: 0xa050ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  shield.position.set(0, 1.25, 0.2); root.add(shield);
  const charge = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshBasicMaterial({ color: 0xc070ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  root.add(charge);
  const chargeLight = new THREE.PointLight(0xa040ff, 0, 5, 1.6); charge.add(chargeLight);
  const red = new THREE.Color(0xff3030), violet = new THREE.Color(0xc060ff), tmpC = new THREE.Color();
  const eyeMats = [];
  const handPos = new THREE.Vector3();
  return {
    name: 'soul', root,
    // st: { t, eyes 0..1, palm 0..1, raise 0..1, lookUp 0..1, talk }
    update(st) {
      const t = st.t;
      body.position.y = 0.04 * Math.sin(t * 1.3);
      const a = cloakGeo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        const y = base[i + 1], k = Math.max(0, 1 - y / 1.2);
        const th = Math.atan2(base[i + 2], base[i]);
        const w = 1 + 0.05 * k * Math.sin(th * 5 + t * 2.2);
        a[i] = base[i] * w; a[i + 2] = base[i + 2] * w;
      }
      cloakGeo.attributes.position.needsUpdate = true;
      cloakGeo.computeVertexNormals();
      const vi = st.violet ?? 0;
      tmpC.copy(red).lerp(violet, vi);
      for (const e of eyes) { e.em.color.copy(tmpC); e.glow.material.color.copy(tmpC); }
      palmGlow.material.color.copy(tmpC);
      faceLight.color.copy(tmpC);
      const dz = clamp(st.dissolve ?? 0);
      body.scale.set(1 - 0.5 * dz, 1 - 0.85 * dz, 1 - 0.5 * dz);
      body.rotation.x = (st.lean ?? 0);
      smokeM.opacity = 0.38 * (1 - dz * 0.6) + 0.2 * dz * (1 - dz) * 4;
      smoke.forEach((m, i) => {
        const h1 = Math.sin(i * 91.7) * 0.5 + 0.5, h2 = Math.sin(i * 37.3) * 0.5 + 0.5;
        const a = h1 * P * 2 + t * (0.6 + h2 * 0.8) * (i % 2 ? 1 : -1);
        const rr = (0.32 + 0.25 * h2) * (1 + dz * 3);
        const y = (i < 14 ? 2.0 + (h2 - 0.5) * 0.5 : 0.15 + h2 * 0.6) * (1 - 0.7 * dz) + dz * h1 * 1.5;
        m.position.set(Math.cos(a) * rr * (i < 14 ? 1 : 1.9), y, Math.sin(a) * rr * (i < 14 ? 1 : 1.9));
        m.scale.setScalar((0.12 + 0.1 * h1) * (1 + 0.15 * Math.sin(t * 2 + i)) * (1 + dz * 2.5));
      });
      const sh = st.shield ?? 0, crk = st.crack ?? 0;
      shield.visible = sh > 0.01;
      shield.material.opacity = sh * 0.35 * (crk > 0 ? (Math.sin(t * 47) > 0 ? 1 : 0.35) : (0.85 + 0.15 * Math.sin(t * 6)));
      shield.scale.setScalar(1 + crk * 0.04 * Math.sin(t * 61));
            const cg = st.charge ?? 0;
      charge.visible = cg > 0.01;
      if (charge.visible) {
        arms.R.hand.updateWorldMatrix(true, false);
        arms.R.hand.getWorldPosition(handPos); root.worldToLocal(handPos);
        charge.position.set(handPos.x, handPos.y + 0.05, handPos.z + 0.12);
        charge.scale.setScalar(cg * (0.8 + 0.25 * Math.sin(t * 25)));
        chargeLight.intensity = cg * 5;
      }
      const ey = clamp(st.eyes, 0, 1.4);
      for (const e of eyes) { e.e.scale.set(1, Math.max(0.05, ey), 1); e.glow.material.opacity = Math.min(1, ey) * (0.8 + 0.2 * Math.sin(t * 9)) + (st.talk ?? 0) * 0.3; e.glow.scale.setScalar(0.6 + ey * 0.6); }
      faceLight.intensity = ey * 1.2;
      hood.rotation.x = -0.45 * st.lookUp + 0.04 * Math.sin(t * 0.9) - (st.talk ?? 0) * 0.04;
      hood.rotation.y = 0.05 * Math.sin(t * 0.5);
      const r = st.raise;
      arms.R.sh.rotation.set(-1.25 * r, 0, -0.12 - 0.15 * r);
      arms.R.hand.rotation.set(-0.35 * r + P * 0.0, 0, 0);
      arms.L.sh.rotation.set(-0.1, 0, 0.12);
      arms.R.hand.updateWorldMatrix(true, false);
      arms.R.hand.getWorldPosition(handPos);
      root.worldToLocal(handPos);
      symbol.position.set(handPos.x, handPos.y + 0.22 + 0.03 * Math.sin(t * 2), handPos.z + 0.05);
      palmGlow.position.set(handPos.x, handPos.y + 0.15, handPos.z + 0.02);
      symbol.scale.setScalar(Math.max(0.001, st.palm) * 1.2);
      symbol.rotation.z = t * 0.8;
      symbol.material.opacity = Math.min(1, st.palm) * (0.85 + 0.15 * Math.sin(t * 11));
      palmGlow.material.opacity = Math.min(1, st.palm) * 0.9;
      palmGlow.scale.setScalar(0.5 + st.palm);
      palmLight.intensity = st.palm * 6;
      palmLight.color.copy(tmpC);
    },
  };
}

// Red Team uniforms (Episode 2 onward): same suit design, red and black with glowing red piping.
const RED_SUIT = { suit: 0x8e1622, suitDark: 0x2a0a10, accent: 0xff3b3b, accentGlow: 0x8a0010, pad: 0xc0202e, boot: 0xa01824, glove: 0x2a0a10, belt: 0x1a0608, emblemGlow: '#ff8a8a', emblemCore: '#fff0f0' };
// Episode 4 outfits (picked per scene with the `${name}.outfit` track)
export const OUTFITS = {
  pj: {
    aaron: { casual: true, emblem: false, shirt: 0x9aa3ae, pants: 0x3a414e, boot: 0x2a3140, sleeves: 'short', bareHands: true, belt: 0x3a414e },
    flare: { casual: true, emblem: false, shirt: 0x3d5fb8, pants: 0x3d5fb8, boot: 0x6a3a2a, bareHands: true, belt: 0x34509a },
  },
  party: {
    aaron: { casual: true, emblem: false, shirt: 0x15151c, pants: 0x15151c, boot: 0x0d0d10, belt: 0x0d0d10, glove: 0x15151c, extras: ['cape'] },
    flare: { casual: true, emblem: false, shirt: 0x6a1430, pants: 0x2a1a2a, boot: 0x2a1a14, belt: 0xd8b040, coat: 0x6a1430, coatDark: 0xd8b040, coatTrim: 0xe0c050, glove: 0xf6f2ea, extras: ['ruff', 'medallion'] },
    greg: { casual: true, coat: null, armband: null, coatTrim: null, shirt: 0x52c04a, pants: 0x52c04a, boot: 0x3a9a34, belt: 0x52c04a, extras: ['dino'] },
  },
};

// Episode 5: upgraded blue uniforms (brighter glowing accents + armor pieces)
const BLUE2 = { suit: 0x2340b8, suitDark: 0x0e1a5a, accent: 0x8fe8ff, accentGlow: 0x2fc8ff, pad: 0x3460e8, boot: 0x2a56d8, glove: 0x0e1a5a, belt: 0x0b1240, emblemGlow: '#8fe8ff', emblemCore: '#f0fbff', armorColor: 0xb4c4e4 };
export const COSTUMES = {
  blue2: {
    aaron: BLUE2, flare: BLUE2, eric: BLUE2,
    leon: { ...BLUE2, suit: 0x18215e, suitDark: 0x0e133a, accent: 0xf2b632, accentGlow: 0xb07a00, pad: 0x24359a, armorColor: 0xc8b47a },
    greg: { coatTrim: 0x5fd8ff, armband: 0x3fa8ff },
  },
  red: {
    aaron: RED_SUIT, flare: RED_SUIT, eric: RED_SUIT,
    leon: { ...RED_SUIT, suit: 0x6e0f18, accent: 0xf2b632, accentGlow: 0x7a4a00, pad: 0x9a1824 },
    greg: { coatTrim: 0xd02030, armband: 0xd02030 },
  },
};

// Props held in a hand. Hand-local axes: -y runs toward the fingers.
export function buildProp(kind) {
  const g = new THREE.Group();
  if (kind === 'notebook') {
    mk(new THREE.BoxGeometry(0.17, 0.025, 0.22), mat(0x6a2a1a, { r: 0.8 }), g, [0, 0, 0]);
    mk(new THREE.BoxGeometry(0.16, 0.027, 0.21), mat(0xf4efe0, { r: 0.9 }), g, [0.005, 0, 0]);
    g.position.set(0, -0.08, 0.09); g.rotation.set(0.2, 0, 0);
  } else if (kind === 'pen') {
    mk(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), mat(0x1a1a1a), g, [0, 0, 0], [P / 2, 0, 0]);
    g.position.set(0, -0.07, 0.07);
  } else if (kind === 'scanner') {
    mk(new RoundedBoxGeometry(0.12, 0.04, 0.18, 2, 0.01), mat(0x2b2f3a, { r: 0.4, m: 0.5 }), g, [0, 0, 0]);
    mk(new THREE.PlaneGeometry(0.09, 0.12), mat(0x3fd2ff, { e: 0x3fd2ff, ei: 1.2 }), g, [0, 0.022, 0.0], [-P / 2, 0, 0], null, false);
    g.userData.screen = g.children[1];
    g.position.set(0, -0.09, 0.07); g.rotation.set(0.5, 0, 0);
  } else if (kind === 'pipe') {
    mk(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 10), mat(0x7a7f88, { r: 0.4, m: 0.7 }), g, [0, 0, 0.25], [P / 2, 0, 0]);
    g.position.set(0, -0.06, 0.0);
  } else if (kind === 'case') {
    mk(new RoundedBoxGeometry(0.55, 0.36, 0.14, 2, 0.02), mat(0xc0c6d0, { r: 0.25, m: 0.8 }), g, [0, 0, 0]);
    mk(new THREE.BoxGeometry(0.5, 0.02, 0.145), mat(0xff3040, { e: 0xff1030, ei: 0.8 }), g, [0, 0.05, 0]);
    g.position.set(0.15, -0.12, 0.22); g.rotation.set(0, 0, 0);
  } else if (kind === 'diamond') {
    mk(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: 0xff3040, emissive: 0xff1030, emissiveIntensity: 1.6, roughness: 0.1, metalness: 0.2 }), g, [0, 0, 0], [0, 0, 0], [1, 1.4, 1], false);
    g.position.set(0, -0.11, 0.04);
  } else if (kind === 'bar') {
    mk(new THREE.BoxGeometry(0.05, 0.14, 0.02), mat(0x2fa84f, { r: 0.5 }), g, [0, 0, 0]);
    g.position.set(0, -0.1, 0.04);
  } else if (kind === 'buzzer') {
    mk(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), mat(0x333333), g, [0, 0, 0]);
    mk(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), mat(0xff3030, { e: 0xff2020, ei: 0.8 }), g, [0, 0.02, 0]);
    g.position.set(0, -0.08, 0.04);
  } else if (kind === 'phone') {
    mk(new RoundedBoxGeometry(0.075, 0.015, 0.15, 2, 0.008), mat(0x1a1a22, { r: 0.3, m: 0.4 }), g, [0, 0, 0]);
    mk(new THREE.PlaneGeometry(0.065, 0.13), mat(0xff9a3a, { e: 0xff8a2a, ei: 0.9 }), g, [0, 0.009, 0], [-P / 2, 0, 0], null, false);
    g.position.set(0, -0.08, 0.06); g.rotation.set(0.9, 0, 0);
  } else if (kind === 'bowl') {
    mk(new THREE.SphereGeometry(0.15, 18, 10, 0, P * 2, P / 2, P / 2), mat(0xd02a2a, { r: 0.5, side: THREE.DoubleSide }), g, [0, 0.0, 0]);
    for (let i = 0; i < 14; i++) mk(new THREE.IcosahedronGeometry(0.03, 0), mat(0xfff4d0, { r: 0.9 }), g, [Math.sin(i * 2.4) * 0.09 * (i % 3) / 2, 0.0 + 0.02 * (i % 2), Math.cos(i * 2.4) * 0.09 * (i % 3) / 2]);
    g.position.set(0, -0.1, 0.12); g.rotation.set(0, 0, 0);
  } else if (kind === 'towels') {
    mk(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16), mat(0xffffff, { r: 0.9 }), g, [0, 0, 0], [0, 0, P / 2]);
    g.position.set(0, -0.08, 0.05);
  } else if (kind === 'capeFold') {
    mk(new THREE.BoxGeometry(0.3, 0.04, 0.4), mat(0x0b0b10, { r: 0.6 }), g, [0, 0, 0.1], [0, 0, 0]);
    mk(new THREE.BoxGeometry(0.3, 0.005, 0.4), mat(0xb0101e, { r: 0.5 }), g, [0, 0.023, 0.1]);
    g.position.set(0, -0.08, 0.08); g.rotation.set(1.2, 0, 0);
  } else if (kind === 'dinoPack') {
    mk(new THREE.SphereGeometry(0.26, 16, 12), mat(0x52c04a, { r: 0.6 }), g, [0, 0, 0.12], [0, 0, 0], [1.1, 0.45, 1.25]);
    for (const sd of [1, -1]) mk(new THREE.SphereGeometry(0.035, 8, 6), mat(0xffffff), g, [sd * 0.08, 0.1, 0.36]);
    mk(new THREE.ConeGeometry(0.06, 0.25, 8), mat(0x52c04a, { r: 0.6 }), g, [0, -0.02, -0.22], [-P / 2, 0, 0]);
    g.position.set(0, -0.14, 0.1); g.rotation.set(1.4, 0, 0);
  } else if (kind === 'maskHeld') {
    mk(new THREE.SphereGeometry(0.2, 16, 12, -P * 0.6, P * 1.2, 0, P), mat(0x4a7a3a, { r: 0.95 }), g, [0, 0, 0]);
    for (const sd of [1, -1]) mk(new THREE.SphereGeometry(0.04, 10, 8), mat(0xffe040, { e: 0xffc000, ei: 0.8 }), g, [sd * 0.07, 0.04, 0.19]);
    g.position.set(0, -0.12, 0.12); g.rotation.set(-0.4, 0, 0);
  } else if (kind === 'candy') {
    mk(new THREE.SphereGeometry(0.035, 10, 8), mat(0xff5aa0, { r: 0.3 }), g, [0, 0, 0]);
    for (const sd of [1, -1]) mk(new THREE.ConeGeometry(0.025, 0.04, 6), mat(0xff5aa0, { r: 0.3 }), g, [sd * 0.045, 0, 0], [0, 0, sd * P / 2]);
    g.position.set(0, -0.09, 0.05);
  } else if (kind === 'plate') {
    mk(new THREE.CylinderGeometry(0.17, 0.14, 0.02, 22), mat(0xffffff, { r: 0.4 }), g, [0, 0, 0]);
    const c = [0xff8a1a, 0x8a3ad0, 0xffd040, 0x5ac05a, 0xd02a2a];
    for (let i = 0; i < 9; i++) mk(new THREE.IcosahedronGeometry(0.035, 0), mat(c[i % 5], { r: 0.6 }), g, [Math.sin(i * 2.3) * 0.09, 0.03 + 0.02 * (i % 3), Math.cos(i * 2.3) * 0.09]);
    g.position.set(0, -0.08, 0.14); g.rotation.set(0, 0, 0);
  } else if (kind === 'pizza') {
    mk(new THREE.CircleGeometry(0.16, 3, -P / 6 + P / 2, P / 3), mat(0xe0602a, { side: THREE.DoubleSide }), g, [0, 0, 0]);
    mk(new THREE.BoxGeometry(0.17, 0.02, 0.025), mat(0xd8a050), g, [0, 0.155, 0]);
    g.position.set(0, -0.13, 0.08); g.rotation.set(0.4, 0, 0);
  } else if (kind === 'mic') {
    mk(new THREE.CylinderGeometry(0.018, 0.012, 0.16, 10), mat(0x1a1a22, { r: 0.3, m: 0.6 }), g, [0, 0, 0]);
    mk(new THREE.SphereGeometry(0.03, 12, 10), mat(0x9a9aa8, { r: 0.3, m: 0.8 }), g, [0, 0.09, 0]);
    g.position.set(0, -0.06, 0.04); g.rotation.set(-0.3, 0, 0);
  } else if (kind === 'clock') {
    mk(new RoundedBoxGeometry(0.16, 0.08, 0.09, 2, 0.02), mat(0x1a1a22, { r: 0.4 }), g, [0, 0, 0]);
    g.position.set(0, -0.08, 0.06);
  }
  return g;
}

// A small dog (and Eric's bird-dog transformation when bird = true).
export function buildDog(bird = false) {
  const root = new THREE.Group();
  const fur = bird ? mat(0x2f6dff, { r: 0.5, e: 0x1a4cff, ei: 0.5 }) : mat(0xc8904e, { r: 0.85 });
  const fur2 = bird ? mat(0x8fd4ff, { r: 0.4, e: 0x3fa0ff, ei: 0.6 }) : mat(0xf0e0c8, { r: 0.85 });
  const dark = mat(0x1a1210, { r: 0.4 });
  const S = bird ? 1.7 : 1;
  const body = grp(root, 0, 0.32 * S, 0);
  body.scale.setScalar(S);
  mk(new THREE.CapsuleGeometry(0.13, 0.28, 6, 14), fur, body, [0, 0, 0], [P / 2, 0, 0]);
  mk(new THREE.CapsuleGeometry(0.1, 0.18, 4, 10), fur2, body, [0, -0.05, 0.06], [P / 2, 0, 0], [1, 1, 0.8]);
  mk(new THREE.TorusGeometry(0.09, 0.018, 6, 16), mat(0xd02030, { r: 0.5 }), body, [0, 0.07, 0.2], [P / 2 - 0.4, 0, 0]);
  const head = grp(body, 0, 0.14, 0.26);
  mk(new THREE.SphereGeometry(0.12, 16, 12), fur, head, [0, 0, 0]);
  mk(new THREE.CapsuleGeometry(0.055, 0.08, 4, 10), fur2, head, [0, -0.03, 0.11], [P / 2, 0, 0]);
  mk(new THREE.SphereGeometry(0.028, 10, 8), dark, head, [0, -0.01, 0.2]);
  const jaw = grp(head, 0, -0.06, 0.08);
  mk(new THREE.BoxGeometry(0.08, 0.02, 0.1), mat(0x8a3030), jaw, [0, 0, 0.03]);
  for (const sd of [1, -1]) {
    mk(new THREE.SphereGeometry(0.022, 10, 8), dark, head, [sd * 0.05, 0.04, 0.1]);
    mk(new THREE.SphereGeometry(0.008, 6, 4), mat(0xffffff, { basic: true }), head, [sd * 0.05 + 0.006, 0.05, 0.12]);
    const ear = mk(new THREE.SphereGeometry(0.06, 10, 8), bird ? fur2 : mat(0x8a5a2e, { r: 0.85 }), head, [sd * 0.1, 0.03, -0.02], [0, 0, sd * 0.5], [0.4, 1.1, 0.7]);
  }
  const tail = grp(body, 0, 0.06, -0.26);
  mk(new THREE.CapsuleGeometry(0.025, 0.14, 4, 8), fur, tail, [0, 0.07, -0.02], [-0.6, 0, 0]);
  const legs = [];
  for (const [x, z] of [[0.07, 0.15], [-0.07, 0.15], [0.07, -0.15], [-0.07, -0.15]]) {
    const l = grp(body, x, -0.05, z);
    mk(new THREE.CapsuleGeometry(0.03, 0.16, 4, 8), fur, l, [0, -0.11, 0]);
    mk(new THREE.SphereGeometry(0.035, 8, 6), fur2, l, [0, -0.21, 0.01]);
    legs.push(l);
  }
  const wings = [];
  if (bird) {
    const feather = mat(0x6fc4ff, { r: 0.3, e: 0x2f8cff, ei: 1.1, side: THREE.DoubleSide });
    for (const sd of [1, -1]) {
      const w = grp(body, sd * 0.1, 0.08, 0.02);
      for (let i = 0; i < 6; i++) {
        const f = mk(new THREE.ConeGeometry(0.05, 0.36 - i * 0.03, 6), feather, w, [sd * (0.1 + i * 0.07), 0.02 - i * 0.012, -0.03 * i], [0, 0, sd * (-P / 2 + 0.15 * i)], [1, 1, 0.3], false);
      }
      wings.push({ w, sd });
    }
    const glow = new THREE.PointLight(0x4aa8ff, 3, 4, 1.6); glow.position.set(0, 0.2, 0); body.add(glow);
  }
  return {
    root,
    // st: { t, act, a (seconds in act), speed, phase }
    update(st) {
      const { t, a } = st;
      const act = st.act ?? 'idle';
      const walk = Math.min(1, (st.speed ?? 0) / 0.6);
      const ph = st.phase ?? 0;
      body.rotation.set(0, 0, 0); body.position.y = 0.32 * S; head.rotation.set(0, 0, 0); jaw.rotation.x = 0;
      legs.forEach((l, i) => { l.rotation.set(Math.sin(ph + (i % 2 ? P : 0) + (i > 1 ? P : 0)) * 0.6 * walk, 0, 0); });
      tail.rotation.set(0, Math.sin(t * 14) * 0.6, 0);
      if (act === 'sit') { const k = Math.min(1, a * 4); body.rotation.x = -0.6 * k; body.position.y = (0.32 - 0.1 * k) * S; legs[2].rotation.x = -1.2 * k + 0.6 * k; legs[3].rotation.x = -0.6 * k; legs[0].rotation.x = 0.6 * k; legs[1].rotation.x = 0.6 * k; head.rotation.x = 0.4 * k; }
      if (act === 'paw') { const k = Math.min(1, a * 4); body.rotation.x = -0.6; body.position.y = 0.22 * S; legs[0].rotation.x = -1.3 * k + 0.1 * Math.sin(t * 8); legs[1].rotation.x = 0.6; legs[2].rotation.x = -0.6; legs[3].rotation.x = -0.6; head.rotation.x = 0.3; }
      if (act === 'roll') { const k = Math.min(1, a / 1.0); body.rotation.z = k * P * 2; body.position.y = (0.32 - 0.12 * Math.sin(k * P)) * S; legs.forEach((l) => { l.rotation.x = 0.8 * Math.sin(k * P); }); }
      if (act === 'bark') { jaw.rotation.x = Math.abs(Math.sin(a * 16)) * 0.5; head.rotation.x = -0.15 * Math.abs(Math.sin(a * 16)); }
      if (act === 'sniff') { head.rotation.x = 0.5 + 0.1 * Math.sin(t * 20); }
      if (act === 'float') { legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 6 + i) * 0.5; }); tail.rotation.y = Math.sin(t * 20) * 0.9; }
      if (act === 'fly') { legs.forEach((l, i) => { l.rotation.x = 0.7; }); jaw.rotation.x = Math.abs(Math.sin(t * 9)) * 0.3; }
      for (const w of wings) w.w.rotation.z = w.sd * (0.3 + 0.7 * Math.sin(t * 14));
    },
  };
}

// The huge shadow behind the Soul Stealer (Episode 3 ending).
export function buildShadow() {
  const root = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x050308, roughness: 1, transparent: true, opacity: 0.92 });
  mk(new THREE.ConeGeometry(2.6, 7.5, 24, 1, true), m, root, [0, 3.7, 0], [0, 0, 0], null, false);
  mk(new THREE.SphereGeometry(1.3, 20, 14), m, root, [0, 7.6, 0], [0, 0, 0], [1, 1.1, 1], false);
  for (const sd of [1, -1]) mk(new THREE.ConeGeometry(0.5, 2.4, 8), m, root, [sd * 1.1, 8.6, 0], [0, 0, sd * -0.5], null, false);
  const eyes = [];
  for (const sd of [1, -1]) eyes.push(mk(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0 }), root, [sd * 0.42, 7.7, 1.15], [0, 0, 0], [1.6, 0.6, 0.5], false));
  return { root, update(t, eyesK) { eyes.forEach((e) => { e.material.opacity = eyesK; }); root.rotation.y = 0.05 * Math.sin(t * 0.4); } };
}

// Character colours / builds (matched to the reference sheet)
export const CAST = {
  aaron: { name: 'aaron', seed: 1, hair: 'spiky', hairColor: 0x6b3a1e, browColor: 0x4a2612, skin: 0xe9b48f, skinDark: 0xdc9f79, eyeColor: 0x5a3416 },
  flare: { name: 'flare', seed: 2, hair: 'tall', hairColor: 0x17120f, browColor: 0x120d0a, skin: 0xe6b18a, skinDark: 0xd99f77, eyeColor: 0x3b2414 },
  eric: { name: 'eric', seed: 3, hair: 'wavy', hairColor: 0x4e3020, browColor: 0x3a2216, skin: 0xe8b28c, skinDark: 0xd99e78, eyeColor: 0x4a2c16 },
  leon: { name: 'leon', seed: 5, scale: 0.93, hair: 'spiky', hairColor: 0x2a211c, streakColor: 0xb8b8bc, browColor: 0x1e1612, skin: 0xd9a07a, skinDark: 0xc98e68, eyeColor: 0x3a2412, suit: 0x18215e, suitDark: 0x0e133a, accent: 0xf2b632, accentGlow: 0x7a4a00, pad: 0x1f2f8a, boot: 0x1a2a7a },
  greg: { name: 'greg', seed: 6, face: 'greg', skin: 0xf2f2f4, skinDark: 0xe6e6ea, eyeColor: 0x000000, casual: true, emblem: false, shirt: 0x141418, pants: 0x101014, boot: 0x0c0c10, glove: 0xf2f2f4, coat: 0x18181c, coatDark: 0x0a0a0c, belt: 0x0a0a0a },
  newark: { name: 'newark', seed: 11, scale: 0.9, hair: 'wavy', hairColor: 0x15100c, browColor: 0x15100c, skin: 0xa8734f, skinDark: 0x966442, eyeColor: 0x2a1a10, casual: true, emblem: false, shirt: 0xff7a1a, pants: 0x141418, boot: 0x0e0e12, belt: 0x0e0e12, coat: 0x16161a, coatDark: 0xff7a1a, coatTrim: 0xff8a2a, bareHands: true, extras: ['topHat', 'bowtie'] },
  barista: { name: 'barista', seed: 4, hair: 'wavy', hairColor: 0x2b1d14, skin: 0xc98d68, skinDark: 0xb87d5a, eyeColor: 0x2d1a10, casual: true, emblem: false, shirt: 0xf4f1ea, pants: 0x4a3a2c, apron: 0x2f7d4f, boot: 0x2a2420, bareHands: true, sleeves: 'short' },
};
