// Season 2 animation: new walk / run / sprint cycles and the new moves.
// Pose keys are the same as Season 1 (characters.js POSE_KEYS), so all old actions still work.
import { pose, blendPose } from './characters.js';
import { clamp, smoothstep } from './util.js';

const S = Math.sin, C = Math.cos, P = Math.PI;
const pos = (v) => Math.max(0, v);

// walk: heel strike and toe-off, hips that turn with the stepping leg while the shoulders turn the other way,
// a small bob at mid-stance and arms that bend more on the forward swing.
// run: a flight phase, high knees, pumping bent arms and a forward lean. sprint: everything bigger.
export function locomotionS2(phase, run, sprint = 0) {
  const s = S(phase), c = C(phase), s2 = S(phase * 2);
  const wk = {
    lLF: 0.46 * s + 0.04, lRF: -0.46 * s + 0.04,
    kL: 0.1 + 0.85 * Math.pow(pos(c), 1.3) + 0.08 * pos(-c) * pos(s), kR: 0.1 + 0.85 * Math.pow(pos(-c), 1.3) + 0.08 * pos(c) * pos(-s),
    fL: -0.2 * pos(s) + 0.3 * pos(-s) * pos(c), fR: -0.2 * pos(-s) + 0.3 * pos(s) * pos(-c),
    aLF: -0.36 * s, aRF: 0.36 * s, eL: 0.22 + 0.3 * pos(-s), eR: 0.22 + 0.3 * pos(s), aLO: 0.1, aRO: 0.1, aLT: 0.1, aRT: 0.1,
    y: -0.022 + 0.032 * Math.abs(c), twist: 0.1 * s, spT: -0.17 * s, tilt: 0.035 * s, spS: -0.02 * s,
    spF: 0.04, hdN: 0.03 + 0.015 * s2, hdY: 0.05 * s, lean: 0.02,
  };
  const rn = {
    lLF: 0.95 * s + 0.28, lRF: -0.95 * s + 0.28,
    kL: 0.32 + 1.45 * Math.pow(pos(c), 1.15), kR: 0.32 + 1.45 * Math.pow(pos(-c), 1.15),
    fL: -0.35 * s + 0.2, fR: 0.35 * s + 0.2,
    aLF: -0.95 * s + 0.25, aRF: 0.95 * s + 0.25, eL: 1.45 + 0.25 * pos(-s), eR: 1.45 + 0.25 * pos(s), aLO: 0.16, aRO: 0.16, aLT: 0.25, aRT: 0.25,
    y: -0.035 + 0.085 * Math.abs(c), lean: 0.2, spF: 0.12, twist: 0.13 * s, spT: -0.24 * s, tilt: 0.03 * s,
    hdN: -0.12, hdY: 0.06 * s,
  };
  const sp = {
    lLF: 1.15 * s + 0.3, lRF: -1.15 * s + 0.3,
    kL: 0.4 + 1.75 * Math.pow(pos(c), 1.1), kR: 0.4 + 1.75 * Math.pow(pos(-c), 1.1),
    fL: -0.4 * s + 0.25, fR: 0.4 * s + 0.25,
    aLF: -1.25 * s + 0.35, aRF: 1.25 * s + 0.35, eL: 1.7, eR: 1.7, aLO: 0.12, aRO: 0.12, aLT: 0.3, aRT: 0.3,
    y: -0.05 + 0.11 * Math.abs(c), lean: 0.36, spF: 0.18, twist: 0.15 * s, spT: -0.3 * s,
    hdN: -0.3, hdY: 0.05 * s,
  };
  const a = blendPose(pose(wk), pose(rn), run);
  return sprint > 0 ? blendPose(a, pose(sp), sprint) : a;
}

const k0 = (a, d = 0.3) => smoothstep(0, d, a);
export const S2_ACTIONS = {
  tugS2: { f: (a, t, c) => ({ aLF: 1.3, aRF: 1.25, aLO: 0.05, aRO: 0.05, aLT: 0.5, aRT: 0.5, eL: 0.35, eR: 0.4, lean: -0.32 + 0.05 * S(t * 9 + c.seed), spF: 0.1, lLF: 0.55, kL: 0.55, lRF: -0.35, kR: 0.25, fR: 0.2, y: -0.09 + 0.01 * S(t * 17), hdN: 0.15, spT: 0.06 * S(t * 7) }) },
  carryS2: { upper: true, f: (a) => ({ aLF: 0.85, aRF: 0.85, aLT: 0.75, aRT: 0.75, eL: 1.2, eR: 1.2, aLO: 0.05, aRO: 0.05, spF: -0.06, hdN: 0.05 }) },
  carryBig: { upper: true, f: (a) => { const k = k0(a, 0.4); return { aLF: 2.65 * k, aRF: 2.65 * k, aLO: 0.35, aRO: 0.35, eL: 0.55, eR: 0.55, spF: -0.1 * k, hdN: -0.25 * k }; } },
  hugTurkey: { upper: true, f: (a, t) => ({ aLF: 0.65, aRF: 0.65, aLT: 1.05, aRT: 1.05, eL: 1.95, eR: 1.95, spF: 0.16, hdN: 0.2, spT: 0.12 * S(t * 2) }) },
  catchS2: { f: (a) => { const k = k0(a, 0.18); return { aLF: 1.95 * k, aRF: 1.95 * k, aLO: 0.25, aRO: 0.25, eL: 0.25, eR: 0.25, lean: 0.12 * k, spF: -0.1 * k, y: 0.06 * S(clamp(a / 0.5) * P), lLF: 0.4 * k, kL: 0.5 * k, lRF: -0.2, hdN: -0.3 * k }; } },
  grabS2: { f: (a) => { const k = k0(a, 0.15); return { aLF: 1.35 * k, aRF: 1.4 * k, aLT: 0.4, aRT: 0.4, eL: 0.25, eR: 0.2, lean: 0.25 * k, spF: 0.25 * k, lLF: 0.6 * k, kL: 0.5 * k, lRF: -0.4 * k, kR: 0.2, y: -0.05 * k, hdN: 0.1 }; } },
  slipS2: { f: (a, t) => { const k = k0(a, 0.35); return { lean: -0.55 * k, lLF: 1.3 * k, kL: 0.2, lRF: 0.6 * k, kR: 0.5 * k, y: -0.25 * k, aLF: 1.4 + 0.6 * S(t * 18), aRF: 1.2 - 0.6 * S(t * 18), aLO: 1.0, aRO: 1.0, eL: 0.4, eR: 0.4, hdN: -0.25, spF: 0.15 }; } },
  flailS2: { f: (a, t) => ({ aLF: 1.6 + 1.2 * S(t * 14), aRF: 1.6 - 1.2 * S(t * 14), aLO: 0.8, aRO: 0.8, eL: 0.5, eR: 0.5, hdT: 0.15 * S(t * 9), y: 0.03 * Math.abs(S(t * 14)), kL: 0.2 * Math.abs(S(t * 14)), kR: 0.2 * Math.abs(C(t * 14)) }) },
  pushCart: { upper: true, f: (a, t) => ({ aLF: 0.95, aRF: 0.95, aLT: 0.25, aRT: 0.25, eL: 0.55, eR: 0.55, aLO: 0.05, aRO: 0.05, spF: 0.22, hdN: -0.1 }) },
  toastS2: { upper: true, f: (a) => { const k = k0(a, 0.4); return { aRF: 1.75 * k, eR: 0.85, aRT: 0.25, aRO: 0.15, aLO: 0.12, eL: 0.25, hdN: -0.12 * k }; } },
  heartS2: { upper: true, gest: false, f: (a, t) => { const k = k0(a, 0.4); return { aRF: 0.95 * k, aRT: 1.25 * k, eR: 2.05 * k, aRO: 0.0, aLO: 0.12, eL: 0.25, hdN: 0.08 * k, hdT: 0.06 * S(t * 1.2) }; } },
  thankHands: { upper: true, f: (a, t) => { const k = k0(a, 0.4); return { aLF: 0.9 * k, aRF: 0.9 * k, aLT: 1.2 * k, aRT: 1.2 * k, eL: 1.85 * k, eR: 1.85 * k, aLO: 0.05, aRO: 0.05, hdN: 0.12 * k }; } },
  highFive: { upper: true, f: (a) => { const k = k0(a, 0.2), hit = smoothstep(0.25, 0.35, a) - smoothstep(0.5, 0.8, a); return { aRF: 2.45 * k, aRO: 0.35 - 0.2 * hit, eR: 0.25, aLO: 0.12, eL: 0.25, spT: -0.2 * hit, hdN: -0.15 }; } },
  panting: { f: (a, t) => ({ spF: 0.7 + 0.05 * S(t * 7), lean: 0.1, lLF: 0.35, lRF: 0.3, kL: 0.35, kR: 0.4, aLF: 0.95, aRF: 0.95, aLT: 0.2, aRT: 0.2, eL: 0.25, eR: 0.25, aLO: 0.15, aRO: 0.15, y: -0.07, hdN: -0.45 }) },
  carveS2: { upper: true, f: (a, t) => ({ aLF: 0.8, aLT: 0.6, eL: 1.2, aRF: 0.95, aRT: 0.3, eR: 0.9 + 0.35 * S(t * 9), aRO: 0.1 + 0.05 * S(t * 9), spF: 0.3, hdN: 0.35 }) },
  stopS2: { upper: true, f: (a) => { const k = k0(a, 0.2); return { aRF: 1.5 * k, eR: 0.15, aRT: 0.0, aRO: 0.1, aLO: 0.12, eL: 0.25, spF: -0.05 * k, hdN: -0.05 }; } },
  presentS2: { upper: true, f: (a) => { const k = k0(a, 0.35); return { aLF: 0.7 * k, aRF: 0.7 * k, aLO: 0.5 * k, aRO: 0.5 * k, eL: 0.8, eR: 0.8, aLT: -0.6 * k, aRT: -0.6 * k, spF: -0.04, hdT: 0.08 }; } },
  determinedS2: { gest: true, f: (a, t) => ({ aLO: 0.22, aRO: 0.22, aLF: 0.1, aRF: 0.1, eL: 0.45, eR: 0.45, lLO: 0.12, lRO: 0.12, spF: -0.06, hdN: -0.06, y: 0.004 * S(t * 2) }) },
  lookAroundS2: { gest: true, f: (a, t) => ({ hdY: 0.55 * S(a * 1.5), hdN: 0.05, aLO: 0.12, aRO: 0.12, eL: 0.2, eR: 0.2, spT: 0.12 * S(a * 1.5) }) },
  jumpS2: { f: (a) => { const u = clamp(a / 0.75), h = S(u * P); return { y: 0.55 * h - 0.12 * (1 - h) * (u < 0.15 || u > 0.9 ? 1 : 0), lLF: 0.9 * h, kL: 1.4 * h, lRF: 0.7 * h, kR: 1.5 * h, aLF: 2.3 * h, aRF: 2.3 * h, aLO: 0.5, aRO: 0.5, eL: 0.3, eR: 0.3, hdN: -0.2 * h }; } },
  stretchReach: { upper: true, f: (a) => { const k = k0(a, 0.25); return { aRF: 1.55 * k, eR: 0.0, aRO: 0.0, aRT: 0.1, aLO: 0.2, eL: 0.4, spF: 0.08 * k, spT: -0.25 * k, hdN: 0.05 }; } },
  stretchBoth: { upper: true, f: (a) => { const k = k0(a, 0.25); return { aLF: 1.55 * k, aRF: 1.55 * k, eL: 0, eR: 0, aLO: 0.05, aRO: 0.05, spF: 0.08 * k }; } },
  sitTable: { sit: true, gest: true, f: (a, t, c) => ({ y: -0.42, lLF: 1.5, lRF: 1.5, kL: 1.45, kR: 1.5, fL: -0.05, fR: -0.05, spF: 0.12 + 0.02 * S(t * 1.3 + c.seed), aLF: 0.55, aRF: 0.55, aLT: 0.5, aRT: 0.5, eL: 1.2, eR: 1.2, aLO: 0.1, aRO: 0.1 }) },
  sitToast: { sit: true, f: (a) => { const k = k0(a, 0.4); return { y: -0.42, lLF: 1.5, lRF: 1.5, kL: 1.45, kR: 1.5, spF: 0.02, aRF: 1.75 * k, eR: 0.8, aRT: 0.2, aLF: 0.5, aLT: 0.5, eL: 1.2, aLO: 0.1, hdN: -0.1 * k }; } },
  sitHeart: { sit: true, f: (a, t) => { const k = k0(a, 0.4); return { y: -0.42, lLF: 1.5, lRF: 1.5, kL: 1.45, kR: 1.5, spF: 0.08, aRF: 0.95 * k, aRT: 1.25 * k, eR: 2.05 * k, aLF: 0.5, aLT: 0.5, eL: 1.2, aLO: 0.1, hdN: 0.06 * k }; } },
  sitEatS2: { sit: true, f: (a, t, c) => { const cy = ((a + c.seed) % 2.4) / 2.4, bite = smoothstep(0.15, 0.3, cy) - smoothstep(0.45, 0.6, cy); return { y: -0.42, lLF: 1.5, lRF: 1.5, kL: 1.45, kR: 1.5, spF: 0.2 - 0.06 * bite, aLF: 0.55, aLT: 0.5, eL: 1.2, aRF: 0.7 + 0.5 * bite, aRT: 0.6, eR: 1.4 + 0.6 * bite, hdN: 0.15 - 0.1 * bite }; } },
  sitLaughS2: { sit: true, f: (a, t) => ({ y: -0.42, lLF: 1.5, lRF: 1.5, kL: 1.45, kR: 1.5, spF: -0.12 + 0.1 * Math.abs(S(a * 12)), hdN: -0.3, aLF: 0.6, aLT: 1.1, eL: 1.3, aRF: 0.8, aRT: 1.0, eR: 1.6, aLO: 0.1, aRO: 0.1 }) },
  sitFull: { sit: true, f: (a, t) => ({ y: -0.48, lean: -0.15, lLF: 1.35, lRF: 1.4, kL: 1.3, kR: 1.35, spF: -0.15 + 0.015 * S(t * 1.4), aLF: 0.4, aRF: 0.4, aLT: 1.2, aRT: 1.2, eL: 1.6, eR: 1.6, aLO: 0.1, aRO: 0.1, hdN: -0.1, hdT: 0.12 }) },
  sneakS2: { upper: true, f: (a, t) => ({ spF: 0.32, aLF: 0.6, aRF: 0.6, eL: 1.3, eR: 1.3, aLO: 0.2, aRO: 0.2, hdN: -0.25, hdY: 0.25 * S(a * 1.3) }) },
  kneelS2: { f: (a, t) => ({ y: -0.4, lLF: 1.4, kL: 1.45, lRF: -0.1, kR: 2.1, fR: 0.5, spF: 0.15, aLF: 0.5, eL: 0.5, aRF: 0.6, eR: 0.6, hdN: 0.1 }) },
  spinS2: { f: (a) => ({ twist: a * P * 3.2, aLO: 1.2, aRO: 1.2, eL: 0.3, eR: 0.3, y: 0.02 * S(a * 10) }) },
  driveS2: { sit: true, f: (a, t) => ({ y: -0.42, lLF: 1.45, lRF: 1.45, kL: 1.4, kR: 1.4, aLF: 1.2, aRF: 1.2, eL: 0.6, eR: 0.6, aLT: 0.3, aRT: 0.3, spF: 0.05, spT: 0.1 * S(t * 1.5) }) },
};
