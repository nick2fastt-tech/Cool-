// ============================================================================
// Procedural animation: pose parameters -> IK pose solver -> bone rotations.
// Layers: locomotion (foot planting) + upper-body actions + body postures +
// full-body clips + additive (breathing, look-at, blink, hit springs) +
// ragdoll snapshot blending. Data-driven arm poses / postures / state table.
// ============================================================================

// --- Data: arm poses (relative to shoulder, in units of arm length L; x mirrored per side) ---
// pos: hand(wrist) position, pole: elbow pole direction (chest space), pron: forearm twist (rad),
// flex: wrist flexion, dev: wrist deviation, fing: finger curl 0..1, thumb: thumb curl 0..1
const ARM_POSES = {
  hang: { pos: [0.10, -0.93, 0.07], pole: [0.25, 0, -1], pron: 0.0, flex: 0.12, dev: 0, fing: 0.35, thumb: 0.25 },
  handsUp: { pos: [0.40, 0.48, 0.16], pole: [1, -1.2, -0.2], pron: -1.35, flex: -0.25, dev: 0, fing: 0.05, thumb: 0.1 },
  cover: { pos: [-0.12, 0.38, 0.36], pole: [0.6, -0.4, 0.8], pron: -0.6, flex: 0.2, dev: 0, fing: 0.4, thumb: 0.4 },
  guard: { pos: [-0.10, 0.08, 0.50], pole: [1, -1, 0.2], pron: -0.8, flex: 0.1, dev: 0, fing: 0.75, thumb: 0.6 },
  brace: { pos: [0.18, -0.25, 0.62], pole: [0.6, -1, 0.1], pron: -1.3, flex: -0.6, dev: 0, fing: 0.0, thumb: 0.1 },
  reach: { pos: [0.02, -0.06, 0.90], pole: [0.3, -1, 0.2], pron: -1.2, flex: 0.45, dev: 0, fing: 0.35, thumb: 0.3 },
  hips: { pos: [0.20, -0.62, 0.02], pole: [1, 0.1, -0.7], pron: -0.4, flex: 0.55, dev: 0.3, fing: 0.25, thumb: 0.1 },
  pockets: { pos: [0.06, -0.80, 0.14], pole: [1, 0, -0.8], pron: 0.3, flex: 0.35, dev: 0, fing: 0.5, thumb: 0.5 },
  behind: { pos: [-0.04, -0.74, -0.24], pole: [1, 0, 0.4], pron: 0.6, flex: 0.1, dev: 0, fing: 0.4, thumb: 0.4 },
  clasp: { pos: [-0.16, -0.78, 0.20], pole: [0.6, 0, -0.8], pron: -0.2, flex: 0.2, dev: 0, fing: 0.5, thumb: 0.4 },
  stretch: { pos: [0.18, 0.88, 0.05], pole: [1, -0.6, 0], pron: -1.2, flex: -0.3, dev: 0, fing: 0.1, thumb: 0.1 },
  flail: { pos: [0.55, 0.15, 0.25], pole: [0.3, -1, -0.3], pron: -0.8, flex: -0.3, dev: 0, fing: 0.0, thumb: 0.0 },
  run: { pos: [0.12, -0.52, 0.22], pole: [0.15, 0, -1], pron: 0.2, flex: 0.05, dev: 0, fing: 0.7, thumb: 0.6 },
  claw: { pos: [0.05, 0.05, 0.85], pole: [0.4, -1, 0.1], pron: -1.0, flex: 0.2, dev: 0, fing: 0.6, thumb: 0.5 },
  push: { pos: [0.05, 0.02, 0.88], pole: [0.8, -1, -0.2], pron: -1.4, flex: -0.9, dev: 0, fing: 0.0, thumb: 0.0 },
  // asymmetric poses: [left, right]
  crossed: [{ pos: [-0.30, -0.42, 0.24], pole: [1, -0.3, -0.4], pron: -0.3, flex: 0.1, dev: 0, fing: 0.6, thumb: 0.5 },
    { pos: [-0.26, -0.36, 0.30], pole: [1, -0.3, -0.4], pron: -0.3, flex: 0.1, dev: 0, fing: 0.6, thumb: 0.5 }],
  phone: [{ pos: [-0.08, -0.36, 0.42], pole: [0.4, -0.6, -0.8], pron: -1.1, flex: -0.2, dev: 0, fing: 0.55, thumb: 0.2 },
    { pos: [0.10, -0.93, 0.07], pole: [0.25, 0, -1], pron: 0, flex: 0.12, dev: 0, fing: 0.35, thumb: 0.25 }],
  scratch: [{ pos: [0.10, -0.93, 0.07], pole: [0.25, 0, -1], pron: 0, flex: 0.12, dev: 0, fing: 0.35, thumb: 0.25 },
    { pos: [0.05, 0.52, -0.02], pole: [1, -0.3, 0.1], pron: -0.6, flex: 0.4, dev: 0, fing: 0.45, thumb: 0.3 }],
  watch: [{ pos: [-0.12, -0.34, 0.36], pole: [0.6, -0.5, -0.6], pron: -1.6, flex: 0.0, dev: 0, fing: 0.6, thumb: 0.4 },
    { pos: [0.10, -0.93, 0.07], pole: [0.25, 0, -1], pron: 0, flex: 0.12, dev: 0, fing: 0.35, thumb: 0.25 }],
  waveR: [{ pos: [0.10, -0.93, 0.07], pole: [0.25, 0, -1], pron: 0, flex: 0.12, dev: 0, fing: 0.35, thumb: 0.25 },
    { pos: [0.42, 0.32, 0.18], pole: [1, -1, -0.3], pron: -1.5, flex: -0.2, dev: 0, fing: 0.05, thumb: 0.1, wave: 1 }]
};
// body postures (overlay): crouch (m), spine/chest/head pitch (rad, + = forward), stance width scale
const POSTURES = {
  stand: { crouch: 0, spine: 0, chest: 0, head: 0, lean: 0 },
  cower: { crouch: 0.34, spine: 0.42, chest: 0.3, head: 0.35, lean: 0.1 },
  flinch: { crouch: 0.12, spine: 0.2, chest: 0.15, head: 0.25, lean: 0.0 },
  alert: { crouch: 0.05, spine: 0.06, chest: 0.04, head: -0.05, lean: 0 },
  slouch: { crouch: 0.02, spine: 0.12, chest: 0.1, head: 0.12, lean: 0 },
  wounded: { crouch: 0.10, spine: 0.30, chest: 0.12, head: 0.2, lean: 0.05 },
  zombie: { crouch: 0.02, spine: 0.04, chest: 0.03, head: 0.04, lean: 0.02 },
  kneel: { crouch: 0, spine: 0, chest: 0, head: 0, lean: 0 }
};
// state table (configurable transitions / blend times)
const ANIM_STATES = {
  idle: { layer: 'base', blend: 0.45 }, walk: { layer: 'base', blend: 0.3 }, run: { layer: 'base', blend: 0.25 },
  zombieWalk: { layer: 'base', blend: 0.5 },
  hang: { layer: 'upper', blend: 0.45 }, handsUp: { layer: 'upper', blend: 0.3 }, cover: { layer: 'upper', blend: 0.14 },
  guard: { layer: 'upper', blend: 0.18 }, brace: { layer: 'upper', blend: 0.12 }, reach: { layer: 'upper', blend: 0.6 },
  hips: { layer: 'upper', blend: 0.6 }, pockets: { layer: 'upper', blend: 0.6 }, behind: { layer: 'upper', blend: 0.6 },
  clasp: { layer: 'upper', blend: 0.6 }, stretch: { layer: 'upper', blend: 0.8 }, crossed: { layer: 'upper', blend: 0.7 },
  phone: { layer: 'upper', blend: 0.6 }, scratch: { layer: 'upper', blend: 0.5 }, watch: { layer: 'upper', blend: 0.5 },
  waveR: { layer: 'upper', blend: 0.4 }, flail: { layer: 'upper', blend: 0.12 }, claw: { layer: 'upper', blend: 0.15 },
  push: { layer: 'upper', blend: 0.15 }, clutch: { layer: 'upper', blend: 0.2 },
  getUp: { layer: 'clip', blend: 0.0 }, zombieRise: { layer: 'clip', blend: 0.0 }
};
const IDLE_POSES = ['hang', 'hang', 'hang', 'hips', 'pockets', 'behind', 'clasp', 'crossed', 'phone', 'watch', 'scratch', 'stretch'];

// --- param containers ----------------------------------------------------------------
class HandP {
  constructor() { this.pos = new V3(); this.posR = new V3(); this.pole = new V3(0, 0, -1); this.space = 0; this.pron = 0; this.flex = 0; this.dev = 0; this.fing = 0.3; this.thumb = 0.3; }
  copy(o) { this.pos.copy(o.pos); this.posR.copy(o.posR); this.pole.copy(o.pole); this.space = o.space; this.pron = o.pron; this.flex = o.flex; this.dev = o.dev; this.fing = o.fing; this.thumb = o.thumb; return this; }
  lerp(o, t) {
    this.pos.lerp(o.pos, t); this.posR.lerp(o.posR, t); this.pole.lerp(o.pole, t); this.space = lerp(this.space, o.space, t); this.pron = lerp(this.pron, o.pron, t);
    this.flex = lerp(this.flex, o.flex, t); this.dev = lerp(this.dev, o.dev, t); this.fing = lerp(this.fing, o.fing, t); this.thumb = lerp(this.thumb, o.thumb, t); return this;
  }
}
class FootP {
  constructor() { this.pos = new V3(); this.pitch = 0; this.yaw = 0; this.roll = 0; this.pole = new V3(0, 0, 1); }
  copy(o) { this.pos.copy(o.pos); this.pitch = o.pitch; this.yaw = o.yaw; this.roll = o.roll; this.pole.copy(o.pole); return this; }
  lerp(o, t) { this.pos.lerp(o.pos, t); this.pitch = lerp(this.pitch, o.pitch, t); this.yaw = lerp(this.yaw, o.yaw, t); this.roll = lerp(this.roll, o.roll, t); this.pole.lerp(o.pole, t); return this; }
}
class PoseP {
  constructor() {
    this.hipsOff = new V3(); this.hipsRot = new V3(); this.spine = new V3(); this.chest = new V3(); this.neck = new V3(); this.head = new V3();
    this.hand = [new HandP(), new HandP()]; this.foot = [new FootP(), new FootP()]; this.clav = [new V3(), new V3()];
    this.jaw = 0; this.look = 1;
  }
  copy(o) {
    this.hipsOff.copy(o.hipsOff); this.hipsRot.copy(o.hipsRot); this.spine.copy(o.spine); this.chest.copy(o.chest); this.neck.copy(o.neck); this.head.copy(o.head);
    for (let s = 0; s < 2; s++) { this.hand[s].copy(o.hand[s]); this.foot[s].copy(o.foot[s]); this.clav[s].copy(o.clav[s]); }
    this.jaw = o.jaw; this.look = o.look; return this;
  }
  lerp(o, t) {
    this.hipsOff.lerp(o.hipsOff, t); this.hipsRot.lerp(o.hipsRot, t); this.spine.lerp(o.spine, t); this.chest.lerp(o.chest, t); this.neck.lerp(o.neck, t); this.head.lerp(o.head, t);
    for (let s = 0; s < 2; s++) { this.hand[s].lerp(o.hand[s], t); this.foot[s].lerp(o.foot[s], t); this.clav[s].lerp(o.clav[s], t); }
    this.jaw = lerp(this.jaw, o.jaw, t); this.look = lerp(this.look, o.look, t); return this;
  }
}

// --- get-up / rise clips: keyframes in root space ----------------------------------
// each key: t, hipsY (fraction of stand hips height), pitch (hips, + forward), spine, chest, head pitches,
// feet: [[x,z] per side as fraction of leg length, footPitch], knee poles, hands: [[x,y,z] root space (fractions of H)]
function getUpKeys(faceDown) {
  if (faceDown) return [
    { t: 0.0, hy: 0.16, pitch: 1.50, sp: 0.0, ch: 0.0, hd: -0.3, feet: [[0.12, -0.95, 1.2], [-0.12, -0.95, 1.2]], knee: [0, -1, 0.2], hands: [[0.17, 0.02, 0.33], [-0.17, 0.02, 0.33]], fing: 0.1 },
    { t: 0.55, hy: 0.24, pitch: 1.05, sp: -0.1, ch: -0.15, hd: -0.3, feet: [[0.12, -0.75, 1.0], [-0.12, -0.75, 1.0]], knee: [0, -1, 0.3], hands: [[0.16, 0.02, 0.36], [-0.16, 0.02, 0.36]], fing: 0.1 },
    { t: 1.05, hy: 0.38, pitch: 0.55, sp: 0.15, ch: 0.1, hd: -0.1, feet: [[0.11, 0.12, 0.0], [-0.11, -0.55, 1.1]], knee: [0, 0.2, 1], hands: [[0.14, 0.18, 0.25], [-0.14, 0.03, 0.30]], fing: 0.2 },
    { t: 1.6, hy: 0.72, pitch: 0.28, sp: 0.15, ch: 0.05, hd: 0.0, feet: [[0.11, 0.1, 0.0], [-0.11, -0.2, 0.4]], knee: [0, 0, 1], hands: [[0.13, 0.30, 0.16], [-0.14, 0.27, 0.08]], fing: 0.3 },
    { t: 2.2, hy: 1.0, pitch: 0.0, sp: 0.0, ch: 0.0, hd: 0.0, feet: [[0.1, 0.0, 0.0], [-0.1, 0.0, 0.0]], knee: [0, 0, 1], hands: null, fing: 0.35 }
  ];
  return [
    { t: 0.0, hy: 0.15, pitch: -1.50, sp: 0.0, ch: 0.0, hd: 0.25, feet: [[0.12, 0.95, -0.2], [-0.12, 0.95, -0.2]], knee: [0, 1, 0.1], hands: [[0.24, 0.02, -0.02], [-0.24, 0.02, -0.02]], fing: 0.2 },
    { t: 0.6, hy: 0.15, pitch: -0.15, sp: 0.2, ch: 0.15, hd: 0.1, feet: [[0.13, 0.62, -0.1], [-0.13, 0.62, -0.1]], knee: [0, 1, 0.2], hands: [[0.17, 0.02, -0.16], [-0.17, 0.02, -0.16]], fing: 0.2 },
    { t: 1.15, hy: 0.36, pitch: 0.55, sp: 0.25, ch: 0.15, hd: 0.0, feet: [[0.12, 0.10, 0.0], [-0.12, 0.10, 0.0]], knee: [0, 0.3, 1], hands: [[0.15, 0.02, 0.24], [-0.15, 0.02, 0.24]], fing: 0.15 },
    { t: 1.65, hy: 0.72, pitch: 0.3, sp: 0.15, ch: 0.05, hd: 0.0, feet: [[0.11, 0.04, 0.0], [-0.11, 0.04, 0.0]], knee: [0, 0, 1], hands: [[0.14, 0.30, 0.14], [-0.14, 0.30, 0.14]], fing: 0.3 },
    { t: 2.2, hy: 1.0, pitch: 0.0, sp: 0.0, ch: 0.0, hd: 0.0, feet: [[0.1, 0.0, 0.0], [-0.1, 0.0, 0.0]], knee: [0, 0, 1], hands: null, fing: 0.35 }
  ];
}

// --- gait data ----------------------------------------------------------------------
// Knee flexion targets (radians) from normal gait curves. Swing: walking peaks ~60 deg at ~30%
// of swing, running ~110 deg. Stance values bound the pelvis height over the loaded leg.
function gaitKneeSwing(sw, run) {
  const w = sw < 0.3 ? lerp(0.66, 1.06, smooth01(sw / 0.3)) : lerp(1.06, 0.05, smooth01((sw - 0.3) / 0.62));
  const r = sw < 0.42 ? lerp(0.6, 1.95, smooth01(sw / 0.42)) : lerp(1.95, 0.32, smooth01((sw - 0.42) / 0.58));
  return lerp(w, r, run);
}
function gaitKneeStance(st, run) {
  if (run >= 1) return st < 0.45 ? lerp(0.34, 0.74, smooth01(st / 0.45)) : lerp(0.74, 0.26, smooth01((st - 0.45) / 0.55));
  return st < 0.16 ? lerp(0.06, 0.27, smooth01(st / 0.16)) : (st < 0.5 ? lerp(0.27, 0.06, smooth01((st - 0.16) / 0.34)) : 0.06);
}
// Zombie gait styles: per-leg drag/stiffness (index 0 = "bad" leg before mirroring), limp, hunch,
// torso roll, lateral lurch, head loll, arm style, stride and cadence irregularity.
const ZOMBIE_GAITS = [
  { name: 'shambler', w: 18, drag: [0.9, 0.1], stiff: [0.75, 0.05], limp: 0.45, hunch: 0.36, roll: 0.16, lurch: 0.05, headLoll: 0.5, arms: 'hang', stride: 0.72, jitter: 0.22, width: 1.35, toeOut: 0.22, speed: 0.75 },
  { name: 'reacher', w: 15, drag: [0.25, 0.25], stiff: [0.3, 0.3], limp: 0.1, hunch: 0.22, roll: 0.05, lurch: 0.035, headLoll: 0.3, arms: 'reach', stride: 0.8, jitter: 0.14, width: 1.25, toeOut: 0.12, speed: 0.95 },
  { name: 'limper', w: 11, drag: [1.0, 0.0], stiff: [0.9, 0.0], limp: 0.7, hunch: 0.3, roll: -0.14, lurch: 0.08, headLoll: 0.4, arms: 'one', stride: 0.7, jitter: 0.2, width: 1.4, toeOut: 0.25, speed: 0.7 },
  { name: 'lurcher', w: 11, drag: [0.15, 0.15], stiff: [0.2, 0.2], limp: 0.05, hunch: 0.5, roll: 0.0, lurch: 0.065, headLoll: 0.25, arms: 'claw', stride: 0.85, jitter: 0.3, width: 1.2, toeOut: 0.1, speed: 1.15 },
  // sprinting infected: leans in, arms flailing, sprints at prey
  { name: 'runner', w: 12, drag: [0.05, 0.05], stiff: [0.08, 0.08], limp: 0.0, hunch: 0.42, roll: 0.0, lurch: 0.035, headLoll: 0.12, arms: 'flail', stride: 0.95, jitter: 0.22, width: 1.1, toeOut: 0.08, speed: 1.15, chase: 3.0 },
  // staggering, weaving, sometimes trips and falls
  { name: 'drunk', w: 10, drag: [0.3, 0.3], stiff: [0.15, 0.15], limp: 0.15, hunch: 0.22, roll: 0.1, lurch: 0.15, headLoll: 0.65, arms: 'hang', stride: 0.75, jitter: 0.38, width: 1.65, toeOut: 0.2, speed: 0.8, wobble: 1.1, stumble: 0.06 },
  // broken leg dragged sideways behind
  { name: 'dragger', w: 9, drag: [1.0, 0.0], stiff: [1.0, 0.1], limp: 0.85, hunch: 0.42, roll: 0.22, lurch: 0.09, headLoll: 0.45, arms: 'one', stride: 0.6, jitter: 0.15, width: 1.45, toeOut: 0.2, twist: [1.25, 0], speed: 0.6 },
  // drags itself along the floor
  { name: 'crawler', w: 6, drag: [1, 1], stiff: [1, 1], limp: 0, hunch: 0.3, roll: 0, lurch: 0, headLoll: 0.3, arms: 'hang', stride: 0.7, jitter: 0.2, width: 1.2, toeOut: 0.1, speed: 1.0, crawl: true },
  // spasms, head snaps, sudden lurches
  { name: 'twitcher', w: 8, drag: [0.2, 0.4], stiff: [0.2, 0.3], limp: 0.2, hunch: 0.3, roll: 0.06, lurch: 0.05, headLoll: 0.35, arms: 'claw', stride: 0.8, jitter: 0.45, width: 1.25, toeOut: 0.15, speed: 0.9, twitch: 1 }
];
if (HT.dev) { HT.dev.ZOMBIE_GAITS = ZOMBIE_GAITS; HT.dev.SB = SB; HT.dev.B = B; HT.dev.RAG = typeof RAG !== "undefined" ? RAG : null; }
function pickZombieGait() {
  let tot = 0; for (const z of ZOMBIE_GAITS) tot += z.w;
  let r = Math.random() * tot;
  for (const z of ZOMBIE_GAITS) { r -= z.w; if (r <= 0) return z; }
  return ZOMBIE_GAITS[0];
}
// --- zombie attack clips -------------------------------------------------------------
// Hand positions relative to the shoulder in arm-length units: x outward on that hand's side,
// y up, z forward. a = attacking hand, s = other hand (both = mirrored two-handed attack).
// ch/sp/hd = chest/spine/head [pitch, yaw toward the attacking side, roll]; hit = contact time.
const SCRATCH_CLIPS = {
  overhead: { dur: 1.0, hit: 0.55, keys: [
    { t: 0.0, a: [0.12, -0.7, 0.32], s: [0.06, -0.85, 0.15], ch: [0.1, 0, 0], sp: [0.05, 0, 0], hd: [0.05, 0, 0], fa: 0.55, fs: 0.4, jaw: 0.12, hips: 0 },
    { t: 0.3, a: [0.38, 0.42, -0.08], s: [0.12, -0.55, 0.32], ch: [-0.06, 0.32, 0.08], sp: [-0.03, 0.12, 0], hd: [-0.06, -0.12, 0], fa: 0.1, fs: 0.5, jaw: 0.38, hips: -0.02 },
    { t: 0.45, a: [0.2, 0.28, 0.5], s: [0.1, -0.55, 0.3], ch: [0.1, 0.05, 0], sp: [0.04, 0.02, 0], hd: [0.05, 0, 0], fa: 0.5, fs: 0.5, jaw: 0.3, hips: 0.03 },
    { t: 0.55, a: [-0.12, -0.22, 0.82], s: [0.18, -0.6, 0.12], ch: [0.26, -0.3, -0.07], sp: [0.1, -0.12, 0], hd: [0.16, 0.18, 0], fa: 0.92, fs: 0.5, jaw: 0.2, hips: 0.07 },
    { t: 0.72, a: [-0.34, -0.58, 0.45], s: [0.18, -0.7, 0.05], ch: [0.18, -0.34, -0.04], sp: [0.08, -0.12, 0], hd: [0.1, 0.12, 0], fa: 0.8, fs: 0.45, jaw: 0.15, hips: 0.04 },
    { t: 1.0, a: [0.12, -0.7, 0.32], s: [0.06, -0.85, 0.15], ch: [0.1, 0, 0], sp: [0.05, 0, 0], hd: [0.05, 0, 0], fa: 0.55, fs: 0.4, jaw: 0.12, hips: 0 }] },
  backhand: { dur: 0.85, hit: 0.46, keys: [
    { t: 0.0, a: [0.15, -0.6, 0.4], s: [0.1, -0.8, 0.2], ch: [0.08, 0, 0], sp: [0.04, 0, 0], hd: [0.04, 0, 0], fa: 0.5, fs: 0.45, jaw: 0.1, hips: 0 },
    { t: 0.32, a: [0.72, 0.02, 0.18], s: [0.0, -0.55, 0.42], ch: [0.0, 0.38, -0.06], sp: [0.0, 0.15, 0], hd: [0.0, -0.2, 0.05], fa: 0.2, fs: 0.6, jaw: 0.3, hips: -0.02 },
    { t: 0.46, a: [-0.2, -0.04, 0.78], s: [0.1, -0.62, 0.3], ch: [0.14, -0.32, 0.06], sp: [0.06, -0.14, 0], hd: [0.08, 0.2, -0.05], fa: 0.9, fs: 0.5, jaw: 0.22, hips: 0.05 },
    { t: 0.66, a: [-0.52, -0.16, 0.4], s: [0.12, -0.72, 0.2], ch: [0.1, -0.4, 0.04], sp: [0.05, -0.15, 0], hd: [0.06, 0.15, 0], fa: 0.75, fs: 0.45, jaw: 0.15, hips: 0.03 },
    { t: 1.0, a: [0.15, -0.6, 0.4], s: [0.1, -0.8, 0.2], ch: [0.08, 0, 0], sp: [0.04, 0, 0], hd: [0.04, 0, 0], fa: 0.5, fs: 0.45, jaw: 0.1, hips: 0 }] },
  double: { dur: 1.1, hit: 0.52, both: true, keys: [
    { t: 0.0, a: [0.1, -0.5, 0.55], ch: [0.12, 0, 0], sp: [0.06, 0, 0], hd: [0.05, 0, 0], fa: 0.55, jaw: 0.15, hips: 0 },
    { t: 0.3, a: [0.28, 0.32, 0.12], ch: [-0.1, 0, 0], sp: [-0.06, 0, 0], hd: [-0.12, 0, 0], fa: 0.15, jaw: 0.45, hips: -0.05 },
    { t: 0.52, a: [0.04, -0.12, 0.88], ch: [0.34, 0, 0], sp: [0.16, 0, 0], hd: [0.2, 0, 0], fa: 0.9, jaw: 0.25, hips: 0.12 },
    { t: 0.75, a: [0.14, -0.45, 0.5], ch: [0.22, 0, 0], sp: [0.1, 0, 0], hd: [0.12, 0, 0], fa: 0.85, jaw: 0.15, hips: 0.06 },
    { t: 1.0, a: [0.1, -0.5, 0.55], ch: [0.12, 0, 0], sp: [0.06, 0, 0], hd: [0.05, 0, 0], fa: 0.55, jaw: 0.15, hips: 0 }] },
  jab: { dur: 0.7, hit: 0.4, keys: [
    { t: 0.0, a: [0.1, -0.55, 0.45], s: [0.08, -0.8, 0.2], ch: [0.08, 0, 0], sp: [0.04, 0, 0], hd: [0.04, 0, 0], fa: 0.5, fs: 0.5, jaw: 0.12, hips: 0 },
    { t: 0.25, a: [0.22, -0.05, 0.12], s: [0.12, -0.7, 0.3], ch: [-0.04, 0.18, 0], sp: [0, 0.08, 0], hd: [-0.05, -0.08, 0], fa: 0.3, fs: 0.5, jaw: 0.3, hips: -0.03 },
    { t: 0.4, a: [0.02, 0.12, 0.95], s: [0.15, -0.68, 0.15], ch: [0.2, -0.12, 0], sp: [0.08, -0.06, 0], hd: [0.1, 0.06, 0], fa: 0.95, fs: 0.5, jaw: 0.4, hips: 0.08 },
    { t: 0.62, a: [0.08, -0.3, 0.6], s: [0.1, -0.75, 0.2], ch: [0.12, -0.05, 0], sp: [0.05, 0, 0], hd: [0.06, 0, 0], fa: 0.8, fs: 0.5, jaw: 0.2, hips: 0.03 },
    { t: 1.0, a: [0.1, -0.55, 0.45], s: [0.08, -0.8, 0.2], ch: [0.08, 0, 0], sp: [0.04, 0, 0], hd: [0.04, 0, 0], fa: 0.5, fs: 0.5, jaw: 0.12, hips: 0 }] }
};
const SCRATCH_NAMES = Object.keys(SCRATCH_CLIPS);
// where each swipe is steered on the victim around the contact frame (motion warping):
// bone (victim side mirrored), height offset, how far in front of the bone the hand stops, sideways bias
const SCRATCH_AIM = {
  overhead: { bone: 'clavicle', up: 0.05, back: 0.1, lat: 0 },
  backhand: { bone: 'chest', up: 0.03, back: 0.16, lat: 0.07 },
  double: { bone: 'upperarm', up: 0.03, back: 0.09, lat: 0 },
  jab: { bone: 'chest', up: -0.07, back: 0.17, lat: 0 }
};
function crv(a, b, c, d, t) { // Catmull-Rom on one component
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}
// sample a clip at normalised time u: returns { idx, f, k0, k1 } and fills out arrays via CR / smooth lerp
function clipSample(keys, u, field, out) {
  let i = 0; while (i < keys.length - 2 && keys[i + 1].t <= u) i++;
  const k0 = keys[i], k1 = keys[i + 1], f = clamp((u - k0.t) / Math.max(1e-4, k1.t - k0.t), 0, 1);
  const km = keys[Math.max(0, i - 1)], kp = keys[Math.min(keys.length - 1, i + 2)];
  const A = km[field], Bq = k0[field], Cq = k1[field], D = kp[field];
  if (Array.isArray(Bq)) { for (let j = 0; j < Bq.length; j++) out[j] = crv((A || Bq)[j], Bq[j], Cq[j], (D || Cq)[j], f); return out; }
  return lerp(Bq, Cq, smooth01(f));
}
const _kca = [0, 0, 0], _kcb = [0, 0, 0], _kcc = [0, 0, 0], _kcd = [0, 0, 0], _kce = [0, 0, 0];

const _qa = new QT(), _va = new V3();


// --- transformation rise: lying -> pushing up -> knees -> crouch -> upright, zombie posture
function zombieRiseKeys(faceDown) {
  const stand = { t: 5.4, hy: 0.96, pitch: 0.12, sp: 0.12, ch: 0.08, hd: 0.22, feet: [[0.1, 0.0, 0.0], [-0.1, 0.0, 0.0]], knee: [0, 0, 1], hands: null, fing: 0.55 };
  if (faceDown) return [
    { t: 0.0, hy: 0.16, pitch: 1.5, sp: 0.0, ch: 0.0, hd: -0.25, feet: [[0.12, -0.95, 1.2], [-0.12, -0.95, 1.2]], knee: [0, -1, 0.2], hands: [[0.24, 0.02, 0.36], [-0.24, 0.02, 0.35]], fing: 0.25 },
    { t: 0.8, hy: 0.16, pitch: 1.48, sp: 0.0, ch: -0.04, hd: -0.12, feet: [[0.12, -0.95, 1.2], [-0.13, -0.93, 1.2]], knee: [0, -1, 0.2], hands: [[0.18, 0.02, 0.34], [-0.17, 0.02, 0.33]], fing: 0.6 },
    { t: 1.6, hy: 0.24, pitch: 1.12, sp: -0.1, ch: -0.12, hd: 0.35, feet: [[0.12, -0.9, 1.2], [-0.12, -0.88, 1.2]], knee: [0, -1, 0.25], hands: [[0.16, 0.02, 0.38], [-0.16, 0.02, 0.37]], fing: 0.3 },
    { t: 2.5, hy: 0.33, pitch: 0.86, sp: 0.0, ch: 0.0, hd: 0.45, feet: [[0.12, -0.22, 1.0], [-0.12, -0.62, 1.2]], knee: [0, -0.3, 1], hands: [[0.15, 0.02, 0.32], [-0.15, 0.02, 0.33]], fing: 0.35 },
    { t: 3.3, hy: 0.4, pitch: 0.7, sp: 0.1, ch: 0.08, hd: 0.5, feet: [[0.12, -0.45, 1.2], [-0.12, -0.45, 1.2]], knee: [0, -0.2, 1], hands: [[0.15, 0.02, 0.28], [-0.15, 0.02, 0.28]], fing: 0.45 },
    { t: 4.1, hy: 0.55, pitch: 0.45, sp: 0.15, ch: 0.1, hd: 0.38, feet: [[0.11, 0.12, 0.0], [-0.11, -0.5, 1.1]], knee: [0, 0.2, 1], hands: [[0.16, 0.25, 0.18], [-0.16, 0.12, 0.2]], fing: 0.55 },
    { t: 4.8, hy: 0.8, pitch: 0.34, sp: 0.2, ch: 0.15, hd: 0.3, feet: [[0.11, 0.08, 0.0], [-0.11, -0.18, 0.3]], knee: [0, 0, 1], hands: null, fing: 0.55 },
    stand
  ];
  return [
    { t: 0.0, hy: 0.15, pitch: -1.5, sp: 0.0, ch: 0.0, hd: 0.25, feet: [[0.12, 0.95, -0.2], [-0.12, 0.95, -0.2]], knee: [0, 1, 0.1], hands: [[0.26, 0.02, -0.02], [-0.26, 0.02, -0.02]], fing: 0.25 },
    { t: 0.9, hy: 0.15, pitch: -1.46, sp: 0.02, ch: 0.04, hd: 0.12, feet: [[0.12, 0.94, -0.2], [-0.13, 0.92, -0.2]], knee: [0, 1, 0.1], hands: [[0.24, 0.02, -0.05], [-0.22, 0.02, -0.06]], fing: 0.62 },
    { t: 1.9, hy: 0.15, pitch: -0.35, sp: 0.15, ch: 0.1, hd: 0.55, feet: [[0.13, 0.65, -0.1], [-0.13, 0.62, -0.1]], knee: [0, 1, 0.2], hands: [[0.18, 0.02, -0.12], [-0.18, 0.02, -0.14]], fing: 0.3 },
    { t: 2.8, hy: 0.24, pitch: 0.3, sp: 0.25, ch: 0.2, hd: 0.45, feet: [[0.12, 0.25, 0.0], [-0.12, 0.42, 0.0]], knee: [0, 0.8, 0.6], hands: [[0.16, 0.02, 0.18], [-0.16, 0.02, 0.16]], fing: 0.35 },
    { t: 3.6, hy: 0.42, pitch: 0.55, sp: 0.2, ch: 0.12, hd: 0.45, feet: [[0.12, 0.1, 0.0], [-0.12, -0.25, 0.9]], knee: [0, 0.3, 1], hands: [[0.15, 0.04, 0.25], [-0.15, 0.04, 0.24]], fing: 0.45 },
    { t: 4.4, hy: 0.68, pitch: 0.4, sp: 0.2, ch: 0.12, hd: 0.35, feet: [[0.11, 0.06, 0.0], [-0.11, -0.12, 0.3]], knee: [0, 0, 1], hands: null, fing: 0.55 },
    stand
  ];
}

// --- two-bone IK ---------------------------------------------------------------------
const _ikD = new V3(), _ikP = new V3(), _ikE = new V3(), _ikU1 = new V3(), _ikU2 = new V3(), _ikN = new V3(), _ikT = new V3();
// soft: where the reach starts easing in (fraction of max reach); legs use a narrow zone so a
// standing knee keeps only a natural few degrees of bend instead of a visible crouch
function solveTwoBone(root, target, pole, L1, L2, bindDir, bindHinge, q1, q2, minBend = 0.02, soft = 0.94) {
  _ikD.subVectors(target, root);
  let dist = _ikD.length();
  if (dist < 1e-6) { _ikD.set(0, -1, 0); dist = 1e-6; } else _ikD.multiplyScalar(1 / dist);
  const maxR = (L1 + L2) * (1 - 0.0005 - minBend * 0.01), minR = Math.abs(L1 - L2) + 0.01;
  const ds = maxR * soft;
  if (dist > ds) dist = ds + (maxR - ds) * (1 - Math.exp(-(dist - ds) / (maxR - ds)));
  dist = clamp(dist, minR, maxR);
  _ikP.copy(pole).addScaledVector(_ikD, -pole.dot(_ikD));
  if (_ikP.lengthSq() < 1e-8) { _ikP.set(0, 0, 1).addScaledVector(_ikD, -_ikD.z); if (_ikP.lengthSq() < 1e-8) _ikP.set(1, 0, 0); }
  _ikP.normalize();
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  _ikE.copy(root).addScaledVector(_ikD, a).addScaledVector(_ikP, h);
  _ikU1.subVectors(_ikE, root).normalize();
  _ikT.copy(root).addScaledVector(_ikD, dist);
  _ikU2.subVectors(_ikT, _ikE).normalize();
  _ikN.crossVectors(_ikP, _ikD).normalize();
  frameQuat(bindDir, bindHinge, _ikU1, _ikN, q1);
  frameQuat(bindDir, bindHinge, _ikU2, _ikN, q2);
  return _ikE;
}

// --- hit reaction springs (additive local rotations) --------------------------------------
const SPRING_BONES = [B.spine, B.chest, B.neck, B.head, B.upperarm_L, B.upperarm_R, B.forearm_L, B.forearm_R, B.thigh_L, B.thigh_R, B.hips];
class HitSprings {
  constructor() { this.rot = SPRING_BONES.map(() => new V3()); this.vel = SPRING_BONES.map(() => new V3()); this.k = 70; this.c = 9; this.active = false; }
  kick(bone, angVel) {
    const i = SPRING_BONES.indexOf(bone); if (i < 0) return;
    this.vel[i].add(angVel); this.active = true;
  }
  update(dt) {
    if (!this.active) return;
    let any = false;
    const h = Math.min(dt, 1 / 30);
    for (let i = 0; i < this.rot.length; i++) {
      const r = this.rot[i], v = this.vel[i];
      v.addScaledVector(r, -this.k * h).multiplyScalar(Math.max(0, 1 - this.c * h));
      r.addScaledVector(v, h);
      if (r.lengthSq() > 1e-6 || v.lengthSq() > 1e-5) any = true; else { r.set(0, 0, 0); v.set(0, 0, 0); }
      if (r.length() > 0.9) r.setLength(0.9);
    }
    this.active = any;
  }
}

// ============================================================================
class Animator {
  constructor(npc) {
    this.npc = npc; this.rig = npc.rig;
    const rig = this.rig;
    this.L = rig.upperArmLen + rig.forearmLen;
    this.local = []; this.csRot = []; this.csPos = [];
    for (let i = 0; i < NUM_BONES; i++) { this.local.push(new QT()); this.csRot.push(new QT()); this.csPos.push(new V3()); }
    this.hipsLocalPos = new V3().copy(rig.localOffset[B.hips]);
    this.P = new PoseP(); this.Pa = new PoseP(); this.Pb = new PoseP(); this.Pc = new PoseP();
    // shoulder positions in chest space (bind)
    this.shoulderC = [0, 1].map(s => rig.bindPos[SB('upperarm', s)].clone().sub(rig.bindPos[B.chest]));
    this.flexAxis = [0, 1].map(s => new V3().crossVectors(rig.armDir[s], rig.armE2[s]).normalize());
    // locomotion state
    this.phase = 0; this.speed = 0; this.vel = new V3(); this.prevRootPos = new V3();
    this.feet = [0, 1].map(() => ({ pos: new V3(), from: new V3(), to: new V3(), swing: false, t: 0, dur: 0.4, h: 0.08, idleStep: false, yaw: 0, pitch: 0, landT: 0 }));
    this.stepTimer = 0;
    this.initialized = false;
    // layers
    this.upper = { cur: 'hang', prev: 'hang', w: 1, t: 0, dur: 0.4, clutchRegion: -1 };
    this.posture = { cur: 'stand', prev: 'stand', w: 1, dur: 0.4 };
    this.clip = null;   // { name, keys, t, dur, onDone }
    this.snapshot = null; // { local[], hipsPos, w, dur }
    this.springs = new HitSprings();
    // look-at
    this.lookTarget = new V3(); this.lookActive = false; this.lookDir = new V3(0, 0, 1); this.lookW = 0;
    this.eyeYaw = 0; this.eyePitch = 0; this.saccadeT = 0; this.saccade = new V3();
    // face
    this.blinkT = 2 + Math.random() * 3; this.blink = 0; this.jaw = 0; this.jawTarget = 0;
    this.breath = Math.random() * TAU;
    this.exertion = 0;
    // idle
    this.idleTimer = 4 + Math.random() * 6; this.idlePose = 'hang';
    this.weightShift = 0; this.weightShiftTarget = 0; this.weightTimer = 3;
    this.time = Math.random() * 100;
    this.stateName = 'idle';
    this.limp = [0, 0];
    this.zombie = 0; // 0..1 zombie motion style
    const zg = hash32(npc.app.seed, 4141);
    this.zstyle = ZOMBIE_GAITS[zg % 5]; this.zMirror = (zg >>> 8) & 1;
    this.moving = false; this.jitT = 0; this.jitK = 1; this.hipY = 0; this.hipYInit = false;
    this.crawl = 0; this.action = null;
    // hair spring
    this.hairTip = new V3(); this.hairPrev = new V3(); this.hairInit = false;
    this.handWave = 0;
    this.stance = 0.095 * rig.H * (npc.app.male ? 1.0 : 0.9);
  }
  // --- public control API ---
  setUpper(name, clutchRegion) {
    if (!ARM_POSES[name] && name !== 'clutch') name = 'hang';
    const u = this.upper;
    if (u.cur === name && (name !== 'clutch' || u.clutchRegion === clutchRegion)) return;
    u.prev = u.cur; u.prevRegion = u.clutchRegion; u.cur = name; u.w = 0; u.t = 0;
    u.dur = (ANIM_STATES[name] || { blend: 0.35 }).blend * this.npc.personality.animSpeed;
    if (name === 'clutch') u.clutchRegion = clutchRegion;
  }
  setPosture(name, dur) {
    const p = this.posture;
    if (p.cur === name) return;
    p.prev = p.cur; p.cur = name; p.w = 0; p.dur = dur || 0.35;
  }
  playClip(name, keys, onDone) {
    const dur = keys[keys.length - 1].t;
    this.clip = { name, keys, t: 0, dur, onDone };
    this.stateName = name;
  }
  // start blending from current (ragdoll) bone pose
  takeSnapshot(dur) {
    const npc = this.npc;
    const snap = { local: [], hipsPos: new V3(), w: 1, dur: dur || 0.45 };
    for (let i = 0; i < NUM_BONES; i++) snap.local.push(npc.bones[i].quaternion.clone());
    snap.hipsPos.copy(npc.bones[B.hips].position);
    this.snapshot = snap;
  }
  resetFeet(rootPos, yaw, env) {
    for (let s = 0; s < 2; s++) {
      const f = this.feet[s];
      const sg = SIDE_SIGN[s];
      f.pos.set(rootPos.x + Math.cos(yaw) * sg * this.stance * 0.5 * 1.0, 0, rootPos.z - Math.sin(yaw) * sg * this.stance * 0.5);
      f.pos.y = env.groundHeight(f.pos.x, f.pos.z);
      f.swing = false; f.yaw = yaw; f.pitch = 0;
    }
    this.prevRootPos.copy(rootPos);
    this.initialized = true;
  }
  lookAt(p, w = 1) { this.lookTarget.copy(p); this.lookActive = true; this.lookWTarget = w; }
  clearLook() { this.lookActive = false; }
  kick(bone, angVel) { this.springs.kick(bone, angVel); }

  // ============================================================================
  update(dt, root, env) {
    this.time += dt;
    const npc = this.npc, rig = this.rig;
    if (!this.initialized) this.resetFeet(root.pos, root.yaw, env);
    // velocity from root motion
    this.vel.subVectors(root.pos, this.prevRootPos).multiplyScalar(1 / Math.max(dt, 1e-4));
    this.vel.y = 0;
    if (this.vel.lengthSq() > 100) this.vel.setLength(10);
    this.prevRootPos.copy(root.pos);
    this.speed = damp(this.speed, this.vel.length(), 10, dt);
    // timers
    this.updateFace(dt);
    this.springs.update(dt);
    const u = this.upper; u.t += dt; u.w = Math.min(1, u.w + dt / Math.max(0.05, u.dur));
    const po = this.posture; po.w = Math.min(1, po.w + dt / Math.max(0.05, po.dur));
    this.exertion = clamp(this.exertion + (this.speed > 2.5 ? dt * 0.12 : -dt * 0.05), 0, 1);
    // 1) base locomotion
    const P = this.P;
    if (this.crawl > 0.5 && !this.clip) this.crawlPose(dt, root, env, P);
    else {
      this.locomotion(dt, root, env, P);
      // 2) postures
      this.applyPosture(P, dt);
      // 3) upper body
      this.applyUpper(P, dt, root);
    }
    // 3b) interactions (grapple / bite / struggle / feeding)
    if (this.action) this.applyAction(P, dt, root, env);
    // 4) clip
    if (this.clip) this.applyClip(dt, root, env, P);
    // 5) solve
    this.solve(P, root, dt);
    // 6) snapshot blend
    if (this.snapshot) {
      const sn = this.snapshot;
      sn.w -= dt / sn.dur;
      if (sn.w <= 0) this.snapshot = null;
      else {
        const w = smooth01(sn.w);
        for (let i = 1; i < NUM_BONES; i++) this.local[i].slerp(sn.local[i], w);
        this.hipsLocalPos.lerp(sn.hipsPos, w);
      }
    }
    // 7) write bones
    const bones = npc.bones;
    bones[0].position.copy(root.pos); bones[0].quaternion.setFromAxisAngle(UP, root.yaw);
    bones[B.hips].position.copy(this.hipsLocalPos);
    for (let i = 1; i < NUM_BONES; i++) bones[i].quaternion.copy(this.local[i]);
  }

  // --- face: blink, jaw, breathing --------------------------------------------------
  updateFace(dt) {
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.14; this.blinkT = 1.5 + Math.random() * 4.5; }
    if (this.blink > 0) this.blink -= dt;
    this.breath += dt * TAU * (0.24 + this.exertion * 0.35 + (this.npc.fear || 0) * 0.25);
    this.jaw = damp(this.jaw, this.jawTarget, 12, dt);
  }

  // --- locomotion -------------------------------------------------------------------
  // Foot-planting gait driven by normal-gait data: each foot alternates stance (planted in
  // world space, heel-strike -> flat -> heel-off -> toe-off roll) and swing (path to the
  // predicted landing spot). Knee flexion profiles set the swing foot height and bound the
  // pelvis height over the loaded legs (inverted-pendulum bob for walking, flight for running).
  locomotion(dt, root, env, P) {
    const rig = this.rig, npc = this.npc, pers = npc.personality;
    const zs = this.zombie > 0.01 ? this.zstyle : null;
    const zomb = zs ? this.zombie : 0;
    const spd = this.speed;
    const runT = zs ? smoothstep(1.7, 2.9, spd) * 0.85 : smoothstep(2.0, 3.8, spd);
    this.runBlend = damp(this.runBlend != null ? this.runBlend : runT, runT, 4.5, dt);
    const run = this.runBlend;
    const wasMoving = this.moving;
    const moving = this.moving = spd > (wasMoving ? 0.07 : 0.15);
    const lg = rig.legLen;
    let stride = lg * (0.78 + 0.6 * Math.min(spd, 6));
    if (zs) stride *= lerp(1, zs.stride, zomb);
    let freq = Math.max(0.5, spd / Math.max(0.3, stride)) * pers.cadence;
    if (zs && this.zvar) freq *= lerp(1, this.zvar.cadence, zomb);
    if (zs) {
      this.jitT -= dt;
      if (this.jitT <= 0) { this.jitT = 0.3 + Math.random() * 0.6; this.jitK = 1 + (Math.random() * 2 - 1) * zs.jitter; }
      freq *= lerp(1, this.jitK, zomb);
    }
    // step faster while turning so planted feet don't get left behind (no crossed legs)
    freq = Math.max(freq, 1.25 * clamp(Math.abs(this.yawRate || 0) / 1.6, 0, 1));
    const duty0 = lerp(0.61, 0.36, run);
    if (moving) this.phase = (this.phase + freq * dt) % 1;
    const yaw = root.yaw, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const T = 1 / freq;
    const yr = wrapAngle(yaw - (this.prevYaw != null ? this.prevYaw : yaw)) / Math.max(dt, 1e-4);
    this.prevYaw = yaw;
    this.yawRate = damp(this.yawRate || 0, clamp(yr, -6, 6), 12, dt);
    const H = rig.H, ha = rig.ankleY - rig.sole, db = 0.07 * H, dh = 0.024 * H, dtoe = 0.1 * H;
    const toeOut = zs ? lerp(0.07, zs.toeOut, zomb) : 0.075;
    const mirror = this.zMirror;
    const limpShift = zs ? zs.limp * 0.07 * zomb * (mirror ? -1 : 1) : 0;
    // --- per-foot ground track (world) -----------------------------------------------
    for (let s = 0; s < 2; s++) {
      const f = this.feet[s], sg = SIDE_SIGN[s];
      const zi = s ^ mirror;
      const drag = zs ? zs.drag[zi] * zomb : 0, stiff = zs ? zs.stiff[zi] * zomb : 0;
      const duty = clamp(duty0 + (zs ? (zi ? -1 : 1) * zs.limp * 0.1 * zomb : 0) - this.limp[s] * 0.08 + this.limp[1 - s] * 0.05, 0.3, 0.78);
      f.duty = duty; f.drag = drag; f.stiff = stiff;
      const lat = this.stance * 0.5 * lerp(0.66, 0.42, run) * (zs ? lerp(1, zs.width, zomb) : (npc.app.male ? 1 : 0.8));
      const idealX = root.pos.x + cy * sg * lat, idealZ = root.pos.z - sy * sg * lat;
      const hsP = lerp(-0.26, -0.1, run) * (1 - drag) * (1 - stiff * 0.6);
      const toP = lerp(0.6, 0.8, run) * (1 - drag * 0.55);
      f.hsP = hsP; f.toP = toP;
      if (moving) {
        if (!wasMoving && f.swing) { f.swing = false; f.pos.y = env.groundHeight(f.pos.x, f.pos.z); }
        const ph = (this.phase + (s === 1 ? 0.5 + limpShift : 0) + 2) % 1;
        if (ph >= duty) { // swing
          const sw = (ph - duty) / (1 - duty);
          if (!f.swing) { f.swing = true; f.idleStep = false; f.from.copy(f.pos); f.from.y = env.groundHeight(f.from.x, f.from.z); f.fromPitch = f.pitch; f.fromOff = f.pivotOff || 0; }
          const tLand = (1 - sw) * (1 - duty) * T + duty * T * 0.5;
          const yl = yaw + this.yawRate * tLand * 0.8;
          f.to.set(root.pos.x + Math.cos(yl) * sg * lat + this.vel.x * tLand, 0, root.pos.z - Math.sin(yl) * sg * lat + this.vel.z * tLand);
          // side-stepping / staggering: the swing foot never lands across the planted one
          const o = this.feet[1 - s];
          if (!o.swing) {
            const sepMin = lat * 0.9, rel = ((f.to.x - o.pos.x) * cy - (f.to.z - o.pos.z) * sy) * sg;
            if (rel < sepMin) { const k = Math.min(sepMin - rel, 0.35) * sg; f.to.x += cy * k; f.to.z -= sy * k; }
          }
          f.to.y = env.groundHeight(f.to.x, f.to.z);
          const e = smoothstep(0.0, 0.94, sw);
          f.pos.lerpVectors(f.from, f.to, e);
          // stiff legs swing out to the side (circumduction)
          const circ = Math.sin(Math.PI * sw) * stiff * 0.1;
          f.pos.x += cy * sg * circ; f.pos.z -= sy * sg * circ;
          f.pos.y = env.groundHeight(f.pos.x, f.pos.z);
          f.sw = sw;
          const p0 = f.fromPitch != null ? f.fromPitch : toP;
          f.pitch = lerp(p0, hsP, smoothstep(0.06, 0.86, sw));
          if (drag > 0.01) f.pitch = lerp(f.pitch, 0.42 + 0.1 * Math.sin(sw * 9), drag); // toes scrape the floor
          f.yaw = angleDamp(f.yaw, yaw + sg * (toeOut + (zs && zs.twist ? zs.twist[zi] * zomb : 0)), 10, dt);
          f.pivotOff = 0;
        } else { // stance
          const st = ph / duty;
          if (f.swing) { f.swing = false; f.pos.copy(f.to); f.landT = 0; }
          f.st = st; f.landT += dt;
          let pch = 0;
          if (st < 0.12) pch = lerp(hsP, 0, smooth01(st / 0.12));
          else if (st > 0.6) pch = lerp(0, toP, smooth01((st - 0.6) / 0.4));
          if (drag > 0.01) pch = lerp(pch, 0.12, drag * 0.6);
          f.pitch = pch;
          f.yaw = angleDamp(f.yaw, yaw + sg * (toeOut + (zs && zs.twist ? zs.twist[zi] * zomb : 0)), 3, dt);
        }
      } else {
        // idle: finish swings and step when far from the ideal stance
        if (f.swing) {
          if (wasMoving) { f.from.copy(f.pos); f.from.y = env.groundHeight(f.from.x, f.from.z); f.t = 0; f.dur = 0.22; f.h = 0.05; f.to.set(idealX, 0, idealZ); f.to.y = env.groundHeight(f.to.x, f.to.z); }
          f.t += dt / f.dur;
          const e = smooth01(f.t);
          f.pos.lerpVectors(f.from, f.to, e); f.lift = f.h * Math.sin(Math.PI * Math.min(1, f.t));
          f.pitch = lerp(f.pitch, Math.sin(Math.PI * Math.min(1, f.t)) * 0.25, 0.25);
          if (f.t >= 1) { f.swing = false; f.pos.copy(f.to); f.lift = 0; }
        } else {
          f.pitch = damp(f.pitch, 0, 8, dt); f.lift = 0;
          f.pos.y = env.groundHeight(f.pos.x, f.pos.z);
        }
      }
    }
    if (!moving) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0 && !this.feet[0].swing && !this.feet[1].swing) {
        let worst = -1, wd = 0.14;
        for (let s = 0; s < 2; s++) {
          const sg = SIDE_SIGN[s], f = this.feet[s];
          const lat = this.stance * 0.5;
          const ix = root.pos.x + cy * sg * lat, iz = root.pos.z - sy * sg * lat;
          const d = Math.hypot(f.pos.x - ix, f.pos.z - iz) + Math.abs(wrapAngle(f.yaw - yaw - sg * 0.1)) * 0.22;
          if (d > wd) { wd = d; worst = s; }
        }
        if (worst >= 0) {
          const f = this.feet[worst], sg = SIDE_SIGN[worst];
          const lat = this.stance * 0.5;
          f.swing = true; f.t = 0; f.dur = 0.3 * pers.animSpeed * (zs ? 1.5 : 1); f.h = zs ? 0.02 : 0.05; f.from.copy(f.pos);
          f.to.set(root.pos.x + cy * sg * lat, 0, root.pos.z - sy * sg * lat); f.to.y = env.groundHeight(f.to.x, f.to.z);
          f.yaw = yaw + sg * 0.1;
          this.stepTimer = 0.16;
        }
      }
    }
    // --- pelvis & trunk ------------------------------------------------------------------
    const ph = this.phase;
    const wk = moving ? clamp(spd / 1.1, 0, 1) : 0;
    this.weightTimer -= dt;
    if (this.weightTimer <= 0) { this.weightShiftTarget = (Math.random() - 0.5) * 2 * pers.fidget; this.weightTimer = 3 + Math.random() * 6; }
    this.weightShift = damp(this.weightShift, moving ? 0 : this.weightShiftTarget, 1.5, dt);
    const fem = npc.app.male ? 0 : 1;
    const accel = (spd - (this.prevSpd != null ? this.prevSpd : spd)) / Math.max(dt, 1e-4);
    this.prevSpd = spd;
    this.accLean = damp(this.accLean || 0, clamp(accel * 0.035, -0.12, 0.16), 6, dt);
    this.bank = damp(this.bank || 0, clamp(-(this.yawRate || 0) * spd * 0.035, -0.16, 0.16), 6, dt);
    const rotA = lerp(0.075, 0.12, run) * wk * (zs ? lerp(1, 0.55, zomb) : 1) * (1 + fem * 0.15);
    const pelYaw = -Math.cos(TAU * ph) * rotA;
    const lurch = zs ? zs.lurch * zomb : 0;
    const rollA = (lerp(0.055, 0.03, run) * (1 + fem * 0.35) + lurch * 0.9) * wk;
    const pelRoll = Math.sin(TAU * (ph - 0.06)) * rollA;
    const swayA = (lerp(0.024, 0.01, run) * (1 + fem * 0.2) + lurch * 0.55) * wk;
    let sway = moving ? Math.sin(TAU * (ph - 0.04)) * swayA : this.weightShift * 0.035;
    if (zs && !moving) sway += Math.sin(this.time * 1.25 + mirror) * 0.03 * zomb * (zs.wobble ? 1.8 : 1);
    const hunch = zs ? zs.hunch * zomb : 0;
    const lean = (0.035 + 0.13 * run) * pers.leanMul + hunch * 0.25;
    const zRoll = zs ? zs.roll * zomb * (mirror ? -1 : 1) : 0;
    P.hipsOff.set(sway, 0, 0);
    P.hipsRot.set(lean * 0.5 + 0.02 + this.accLean * 0.5, pelYaw, pelRoll + (moving ? 0 : -this.weightShift * 0.05) + zRoll * 0.4 + this.bank * 0.5);
    P.spine.set(lean * 0.35 + pers.slouch * 0.5 + hunch * 0.45 + this.accLean * 0.35, -pelYaw * 0.85, -pelRoll * 0.6 + zRoll * 0.4 + this.bank * 0.3);
    P.chest.set(lean * 0.2 + pers.slouch * 0.4 + hunch * 0.45, -pelYaw * 0.85, -pelRoll * 0.4 + zRoll * 0.3 - lurch * Math.sin(TAU * (ph - 0.1)) * 0.8 * wk);
    // head: stabilised for the living, lolling for the dead
    const trunkPitch = P.hipsRot.x + P.spine.x + P.chest.x;
    const chestYaw = pelYaw * (1 - 0.85 - 0.85);
    if (zs) {
      const loll = zs.headLoll * zomb;
      P.neck.set(-trunkPitch * 0.25 + loll * 0.3, -chestYaw * 0.5, 0);
      P.head.set(-trunkPitch * 0.25 + loll * 0.45 + pers.headTilt, -chestYaw * 0.5 + Math.sin(this.time * 0.9) * loll * 0.25, (mirror ? -1 : 1) * loll * 0.35 + Math.sin(this.time * 0.63) * loll * 0.3);
    } else {
      P.neck.set(-trunkPitch * 0.4, -chestYaw * 0.5, 0);
      P.head.set(-trunkPitch * 0.45 + pers.headTilt, -chestYaw * 0.5, 0);
    }
    // --- pelvis height from the loaded legs --------------------------------------------
    const L1 = rig.thighLen, L2 = rig.shinLen;
    const dist = (th) => Math.sqrt(L1 * L1 + L2 * L2 + 2 * L1 * L2 * Math.cos(th));
    quatFromEuler(P.hipsRot.x, P.hipsRot.y, P.hipsRot.z, _qa, 'YXZ');
    const hb = rig.bindPos[B.hips];
    const ciy = cy, siy = -sy;
    for (let s = 0; s < 2; s++) {
      const f = this.feet[s], fp = P.foot[s];
      const dx = f.pos.x - root.pos.x, dz = f.pos.z - root.pos.z;
      fp.pos.set(dx * ciy + dz * siy, f.pos.y - root.pos.y + rig.ankleY, -dx * siy + dz * ciy);
      fp.yaw = wrapAngle(f.yaw - yaw); fp.roll = 0; fp.pitch = f.pitch;
      // stance roll-over: pivot about the heel (toe up) or the ball of the foot (heel up)
      let offY = 0, offZ = 0;
      if (!f.swing || !moving) {
        const pp = f.pitch;
        if (pp > 0) { offY = ha * (Math.cos(pp) - 1) + db * Math.sin(pp); offZ = ha * Math.sin(pp) + db * (1 - Math.cos(pp)); }
        else if (pp < 0) { offY = ha * (Math.cos(pp) - 1) - dh * Math.sin(pp); offZ = ha * Math.sin(pp) + dh * (Math.cos(pp) - 1); }
        offY += f.lift || 0;
        f.pivotOff = offZ;
      } else {
        const sw = f.sw || 0, hs = f.hsP || 0;
        offZ = (f.fromOff || 0) * (1 - smoothstep(0, 0.35, sw)) + (ha * Math.sin(hs) + dh * (Math.cos(hs) - 1)) * smoothstep(0.75, 1, sw);
      }
      fp.pos.x += Math.sin(fp.yaw) * offZ; fp.pos.z += Math.cos(fp.yaw) * offZ; fp.pos.y += offY;
      fp.pole.set(Math.sin(fp.yaw) + SIDE_SIGN[s] * 0.12, 0, Math.cos(fp.yaw));
      // hip joint position in root space (for this pelvis orientation, height still unknown)
      const hj = rig.bindPos[SB('thigh', s)];
      _va.set(hj.x - hb.x, hj.y - hb.y, hj.z - hb.z).applyQuaternion(_qa);
      f.hjx = hb.x + P.hipsOff.x + _va.x; f.hjz = hb.z + P.hipsOff.z + _va.z; f.hjOffY = _va.y;
    }
    const standY = hb.y;
    let hipY = standY - (moving ? lerp(0.004, 0.075, run) * lg : 0.0012 * lg) - hunch * 0.06 * lg;
    if (moving && run > 0) hipY += run * (-Math.cos(4 * Math.PI * (ph - duty0 * 0.5))) * 0.032 * lg / 0.84;
    let bound = 1e9;
    for (let s = 0; s < 2; s++) {
      const f = this.feet[s], fp = P.foot[s];
      let load = 1, th = 0.06;
      if (moving) {
        if (f.swing) continue;
        const st = f.st || 0;
        load = smoothstep(0, 0.08, st) * (1 - smoothstep(0.86, 1.0, st));
        th = run > 0 ? lerp(gaitKneeStance(Math.min(st, 0.62), 0), gaitKneeStance(st, 1), run) : gaitKneeStance(Math.min(st, 0.62), 0);
        th = Math.max(th, f.stiff ? 0 : 0) + this.limp[s] * 0.15;
      }
      const hx = f.hjx - fp.pos.x, hz = f.hjz - fp.pos.z, h2 = hx * hx + hz * hz;
      const D = dist(th);
      let v = D * D - h2;
      if (v <= 0) { const Dm = lg * 0.995; v = Dm * Dm - h2; if (v <= 0) continue; } // out of reach: this foot can't carry the pelvis
      const b = fp.pos.y + Math.sqrt(v) - f.hjOffY;
      bound = Math.min(bound, lerp(Math.max(hipY, b), b, load));
    }
    if (bound < hipY) hipY = Math.max(bound, standY - lg * 0.22);
    if (!this.hipYInit) { this.hipY = hipY; this.hipYInit = true; }
    this.hipY = damp(this.hipY, hipY, moving ? 22 : 10, dt);
    P.hipsOff.y = this.hipY - standY;
    // --- swing foot height from the knee flexion profile -----------------------------------
    if (moving) {
      for (let s = 0; s < 2; s++) {
        const f = this.feet[s], fp = P.foot[s];
        if (!f.swing) continue;
        const sw = f.sw || 0;
        // lift curve above the ground path (walk ~17% of leg length early in swing, run ~42% heel kick);
        // the IK turns it into the natural knee bend (~60 deg walking, ~110 deg running)
        const peak = lerp(0.33, 0.42, run);
        const bump = sw < peak ? smooth01(sw / peak) : 1 - smooth01((sw - peak) / (1 - peak));
        const Hl = lg * lerp(0.17, 0.36, run) * pers.stepLift * (1 - f.drag * 0.88) * (1 - f.stiff * 0.7) * (1 - 0.45 * this.limp[s]) * (zs ? lerp(1, 0.75, zomb) : 1);
        const pTo = f.fromPitch != null ? f.fromPitch : f.toP;
        const offFrom = ha * (Math.cos(pTo) - 1) + db * Math.sin(Math.max(0, pTo));
        const offLand = ha * (Math.cos(f.hsP) - 1) - dh * Math.sin(Math.min(0, f.hsP));
        const gNow = f.pos.y - root.pos.y + rig.ankleY;
        let y = gNow + lerp(offFrom, offLand, smoothstep(0.0, 0.94, sw)) + Hl * bump;
        // never let the toe or heel go through the ground
        const pp = f.pitch;
        const lowRel = Math.min(-ha * Math.cos(pp) - dtoe * Math.sin(pp), -ha * Math.cos(pp) + dh * Math.sin(pp));
        const gy = f.pos.y - root.pos.y;
        y = Math.max(y, gy + 0.004 - lowRel);
        fp.pos.y = y;
      }
    }
    // --- arms ------------------------------------------------------------------------------
    const armStyle = zs && zomb > 0.5 ? zs.arms : null;
    for (let s = 0; s < 2; s++) {
      const sg = SIDE_SIGN[s];
      const swc = moving ? (s === 0 ? -1 : 1) * Math.cos(TAU * ph) : 0; // +1 = arm forward
      let st = armStyle;
      if (st === 'one') st = (s ^ mirror) ? 'reach' : 'hang';
      if (st === 'flail') {
        const base = this.armPose('claw', s);
        const k = Math.sin(TAU * ph + (s ? Math.PI : 0)) * clamp(spd / 2, 0.3, 1);
        base.pos.y += (0.18 + 0.2 * k) * this.L + hunch * 0.4 * this.L;
        base.pos.z += (0.02 + 0.14 * k) * this.L;
        base.pos.x += sg * (0.04 + 0.05 * Math.sin(this.time * 6.5 + s * 2)) * this.L;
        base.flex = 0.05; base.fing = 0.7 + 0.25 * Math.sin(this.time * 9 + s); base.thumb = 0.5;
        P.hand[s].copy(base);
        P.clav[s].set(0.15, 0, 0.12);
      } else if (st === 'reach' || st === 'claw') {
        const base = this.armPose(st === 'claw' ? 'claw' : 'reach', s);
        base.pos.y += (st === 'claw' ? 0.16 : 0.12) * this.L + hunch * 0.5 * this.L + Math.sin(TAU * ph + s * 1.7) * 0.05 * this.L * wk + Math.sin(this.time * 1.3 + s) * 0.03 * this.L;
        base.pos.z -= 0.05 * this.L - swc * 0.06 * this.L * wk;
        base.pos.x -= sg * 0.05 * this.L;
        base.flex = st === 'claw' ? 0.15 : 0.65; base.fing = st === 'claw' ? 0.6 + 0.25 * Math.sin(this.time * 5 + s * 2) : 0.5; base.thumb = 0.4;
        P.hand[s].copy(base);
        P.clav[s].set(0.12, 0, 0.05);
      } else if (st === 'hang') {
        // limp arms: lagging pendulum swing driven by the gait, shoulders slumped forward
        const base = this.armPose('hang', s);
        const pend = moving ? (s === 0 ? -1 : 1) * Math.cos(TAU * (ph - 0.14)) * 0.11 * this.L * wk : Math.sin(this.time * 0.8 + s) * 0.015 * this.L;
        base.pos.z += 0.07 * this.L + pend;
        base.pos.x -= sg * (0.02 * this.L - Math.sin(TAU * (ph - 0.1)) * 0.03 * this.L * wk * sg);
        base.pos.y += 0.01 * this.L;
        base.pron = 0.25; base.flex = 0.35; base.fing = 0.55; base.thumb = 0.3;
        P.hand[s].copy(base);
        P.clav[s].set(0.18, 0, -0.04);
      } else {
        const amp = lerp(0.2, 0.3, run) * pers.armSwing * clamp(spd / 1.3, 0, 1.15);
        const base = run > 0.01 ? this.armPose('hang', s).lerp(this.armPose('run', s), run) : this.armPose('hang', s);
        const fwd = Math.max(0, swc), back = Math.max(0, -swc);
        base.pos.z += swc * amp * this.L;
        base.pos.y += (fwd * lerp(0.42, 0.75, run) + back * 0.08) * amp * this.L;
        base.pos.x -= sg * fwd * amp * lerp(0.25, 0.45, run) * this.L;
        base.fing = lerp(base.fing, 0.7, run);
        P.hand[s].copy(base);
        P.clav[s].set(0, 0, 0);
      }
    }
    if (zs && zomb > 0.5) {
      const zv = this.zvar || { shoulder: 1, armPhase: 0, intensity: 1 };
      for (let s = 0; s < 2; s++) { // shoulders roll with the steps, hands never quite still
        P.clav[s].z += Math.sin(TAU * (ph + s * 0.5) + zv.armPhase) * 0.07 * zv.shoulder * wk + Math.sin(this.time * 0.7 + s * 2 + zv.armPhase) * 0.03;
        P.clav[s].x += Math.sin(TAU * ph + s * Math.PI) * 0.05 * zv.shoulder * wk;
        P.hand[s].fing = clamp(P.hand[s].fing + Math.sin(this.time * (1.1 + s * 0.37) + zv.armPhase) * 0.18, 0, 1);
      }
      // arms come up to grab as the zombie closes in on prey
      this.reachW = damp(this.reachW || 0, this.reachTarget || 0, 4, dt);
      if (this.reachW > 0.01) for (let s = 0; s < 2; s++) {
        const rp = this.armPose('reach', s);
        rp.pos.y += 0.08 * this.L + Math.sin(this.time * 3 + s * 1.9 + zv.armPhase) * 0.05 * this.L; rp.fing = 0.75 + 0.2 * Math.sin(this.time * 6 + s); rp.flex = 0.25;
        P.hand[s].lerp(rp, this.reachW);
      }
    }
    P.jaw = zs ? 0.1 * zomb + Math.max(0, Math.sin(this.time * 1.7)) * 0.06 * zomb : 0;
    P.look = 1;
    if (moving) this.stateName = zs ? (run > 0.4 ? 'zombieRun' : 'zombieWalk') : (run > 0.5 ? 'run' : (spd > 1.7 ? 'jog' : 'walk'));
    else if (!this.clip) this.stateName = zs ? 'zombieIdle' : 'idle';
  }
  // --- crawling (legs lost / crawler zombies) ---------------------------------------------
  // Prone body, hands planted in world space and pulled back while the body slides forward.
  crawlPose(dt, root, env, P) {
    const rig = this.rig, H = rig.H;
    const spd = this.speed, moving = spd > 0.04;
    const c = this.crawlState || (this.crawlState = { phase: 0, hands: [0, 1].map(() => ({ pos: new V3(), planted: false, init: false })) });
    const reach = 0.3 * H * 0.6, freq = clamp(spd / Math.max(0.12, reach), 0, 1.6);
    if (moving) c.phase = (c.phase + freq * dt) % 1;
    const yaw = root.yaw, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const shZ = (rig.shoulderY - rig.hipsHeight) * 0.98;   // shoulders ahead of the hips when prone
    const fwdX = sy, fwdZ = cy;
    const hy = 0.15 + 0.012 * Math.sin(c.phase * TAU * 2);
    P.hipsOff.set(Math.sin(c.phase * TAU) * 0.03, (hy - 1) * rig.hipsHeight, 0);
    P.hipsRot.set(1.45, Math.sin(c.phase * TAU) * 0.12, Math.sin(c.phase * TAU) * 0.1);
    P.spine.set(-0.12, -Math.sin(c.phase * TAU) * 0.1, 0); P.chest.set(-0.18, -Math.sin(c.phase * TAU) * 0.12, 0);
    P.neck.set(-0.35, 0, 0); P.head.set(-0.4, Math.sin(this.time * 0.8) * 0.15, 0);
    for (let s = 0; s < 2; s++) {
      const sg = SIDE_SIGN[s], h = c.hands[s];
      const ph = (c.phase + s * 0.5) % 1;
      const plant = ph < 0.6;
      const lat = 0.16 * H * 0.6;
      const reachZ = shZ + 0.24 * H, pullZ = shZ - 0.02 * H;
      const lx = cy * sg * lat, lz = -sy * sg * lat;
      if (!h.init) { h.pos.set(root.pos.x + lx + fwdX * reachZ, 0, root.pos.z + lz + fwdZ * reachZ); h.init = true; }
      const hp = P.hand[s];
      let wx, wy, wz;
      if (moving && plant) {
        if (!h.planted) { h.planted = true; }
        wx = h.pos.x; wz = h.pos.z; wy = env.groundHeight(wx, wz) + 0.025;
      } else {
        h.planted = false;
        const t = moving ? (ph - 0.6) / 0.4 : 1;
        const tx = root.pos.x + lx + fwdX * (moving ? lerp(pullZ, reachZ, smooth01(t)) : shZ + 0.12 * H);
        const tz = root.pos.z + lz + fwdZ * (moving ? lerp(pullZ, reachZ, smooth01(t)) : shZ + 0.12 * H);
        h.pos.set(tx, 0, tz);
        wx = tx; wz = tz; wy = env.groundHeight(tx, tz) + 0.025 + (moving ? Math.sin(Math.PI * t) * 0.09 : 0);
      }
      const dx = wx - root.pos.x, dz = wz - root.pos.z;
      hp.posR.set(dx * cy - dz * sy, wy - root.pos.y, dx * sy + dz * cy);
      hp.space = 1; hp.pole.set(sg * 0.9, 0.4, -0.3); hp.pron = -1.3; hp.flex = -0.4; hp.fing = plant ? 0.6 : 0.3; hp.thumb = 0.4;
      if (s === 1 && this.crawlAttack > 0) { const k = Math.sin(Math.PI * clamp(1 - this.crawlAttack / 0.55, 0, 1)); hp.posR.y += k * 0.28; hp.posR.z += k * 0.18; hp.fing = 0.9; }
      // legs drag behind (pointing back, knees down)
      const fp = P.foot[s];
      fp.pos.set(sg * rig.hipHalf * 1.3, rig.ankleY * 0.9, -rig.legLen * 0.97 + Math.sin((c.phase + s * 0.5) * TAU) * 0.03);
      fp.pitch = 1.35; fp.yaw = 0; fp.roll = 0; fp.pole.set(sg * 0.2, -1, -0.1);
      P.clav[s].set(0.1, 0, 0.05);
    }
    // keep the feet records near the body so standing up later is smooth
    for (let s = 0; s < 2; s++) { const f = this.feet[s]; f.pos.set(root.pos.x, env.groundHeight(root.pos.x, root.pos.z), root.pos.z); f.swing = false; }
    if (this.crawlAttack > 0) this.crawlAttack -= dt;
    P.jaw = 0.15 + Math.max(0, Math.sin(this.time * 1.5)) * 0.1; P.look = 0.6;
    this.stateName = 'crawl';
  }
  // arm pose (chest space hand params) from library
  armPose(name, s) {
    const tmp = s === 0 ? this._apL || (this._apL = new HandP()) : this._apR || (this._apR = new HandP());
    let d = ARM_POSES[name] || ARM_POSES.hang;
    if (Array.isArray(d)) d = d[s];
    const sg = SIDE_SIGN[s], L = this.L, sc = this.shoulderC[s];
    tmp.pos.set(sc.x + d.pos[0] * sg * L, sc.y + d.pos[1] * L, sc.z + d.pos[2] * L);
    tmp.pole.set(d.pole[0] * sg, d.pole[1], d.pole[2]);
    tmp.space = 0; tmp.pron = d.pron; tmp.flex = d.flex; tmp.dev = d.dev * sg; tmp.fing = d.fing; tmp.thumb = d.thumb;
    if (d.wave) { tmp.pos.x += Math.sin(this.time * 9) * 0.06 * L * sg; tmp.flex += Math.sin(this.time * 9) * 0.3; }
    return tmp;
  }
  applyPosture(P, dt) {
    const po = this.posture;
    const a = POSTURES[po.prev] || POSTURES.stand, b = POSTURES[po.cur] || POSTURES.stand;
    const w = smooth01(po.w);
    const crouch = lerp(a.crouch, b.crouch, w), sp = lerp(a.spine, b.spine, w), ch = lerp(a.chest, b.chest, w), hd = lerp(a.head, b.head, w), le = lerp(a.lean, b.lean, w);
    if (crouch > 0) P.hipsOff.y -= crouch * this.rig.legLen * 0.5;
    P.hipsOff.z -= crouch * 0.12;
    P.hipsRot.x += le; P.spine.x += sp; P.chest.x += ch; P.head.x += hd;
  }
  applyUpper(P, dt, root) {
    const u = this.upper;
    const w = smooth01(u.w);
    for (let s = 0; s < 2; s++) {
      const hp = P.hand[s];
      if (u.cur === 'hang' && (u.prev === 'hang' || w >= 1)) continue;  // locomotion arm swing stays
      const a = u.prev === 'hang' ? this.Pa.hand[s].copy(hp) : this.Pa.hand[s].copy(this.upperPose(u.prev, s, u.prevRegion, root));
      const b = u.cur === 'hang' ? this.Pb.hand[s].copy(hp) : this.Pb.hand[s].copy(this.upperPose(u.cur, s, u.clutchRegion, root));
      hp.copy(a).lerp(b, w);
    }
    // idle fidgets look
    if (u.cur === 'phone' || u.cur === 'watch') { P.head.x += 0.35 * w; P.neck.x += 0.15 * w; }
    if (u.cur === 'cover') { P.head.x += 0.2 * w; }
    if (u.cur === 'stretch') { P.chest.x -= 0.15 * w; P.head.x -= 0.25 * w; }
    if (u.cur === 'reach' || u.cur === 'claw') { P.chest.x += 0.06 * w; }
  }
  upperPose(name, s, region, root) {
    if (name === 'clutch' && region >= 0) {
      // hand goes to the injured region (opposite hand for arms)
      const tmp = this.armPose('hang', s);
      const reg = region;
      const isArm = reg >= 6 && reg <= 11;
      const regSide = (reg >= 6 && reg <= 8) || (reg >= 12 && reg <= 14) ? 0 : 1;
      const useHand = isArm ? 1 - regSide : (reg >= 12 ? regSide : s);
      if (s !== useHand && reg !== REGION.ABDOMEN && reg !== REGION.TORSO && reg !== REGION.UPPER_CHEST) return tmp;
      // target bone position in chest space
      const npc = this.npc;
      const bone = REGION_BONE[reg];
      const wp = npc.boneWorldPos(bone, _v4);
      const cs = this.toChestSpace(wp, root, _v5);
      tmp.pos.copy(cs);
      tmp.pos.z += 0.04; if (reg <= 5) { tmp.pos.x += SIDE_SIGN[s] * 0.06; tmp.pos.z += 0.06; }
      tmp.pole.set(SIDE_SIGN[s], -0.6, -0.3); tmp.pron = -0.9; tmp.flex = 0.3; tmp.fing = 0.6; tmp.thumb = 0.5;
      return tmp;
    }
    return this.armPose(name, s);
  }
  toChestSpace(worldP, root, out) {
    // world -> root space -> chest space using last frame chest transform
    const dx = worldP.x - root.pos.x, dy = worldP.y - root.pos.y, dz = worldP.z - root.pos.z;
    const c = Math.cos(-root.yaw), s = Math.sin(-root.yaw);
    out.set(dx * c + dz * s, dy, -dx * s + dz * c);
    out.sub(this.csPos[B.chest]);
    _q3.copy(this.csRot[B.chest]).invert();
    return out.applyQuaternion(_q3);
  }
  applyClip(dt, root, env, P) {
    const c = this.clip;
    c.t += dt * (c.speed || 1);
    const keys = c.keys;
    let i = 0; while (i < keys.length - 2 && keys[i + 1].t < c.t) i++;
    const k0 = keys[i], k1 = keys[i + 1];
    const t = smooth01((c.t - k0.t) / (k1.t - k0.t));
    const rig = this.rig, H = rig.H, Lg = rig.legLen;
    const Pc = this.Pc;
    Pc.copy(P);
    const hy = lerp(k0.hy, k1.hy, t);
    Pc.hipsOff.set(0, (hy - 1) * rig.hipsHeight, 0);
    Pc.hipsRot.set(lerp(k0.pitch, k1.pitch, t), 0, 0);
    Pc.spine.set(lerp(k0.sp, k1.sp, t), 0, 0); Pc.chest.set(lerp(k0.ch, k1.ch, t), 0, 0);
    Pc.neck.set(0, 0, 0); Pc.head.set(lerp(k0.hd, k1.hd, t), 0, 0);
    for (let s = 0; s < 2; s++) {
      const f0 = k0.feet[s], f1 = k1.feet[s];
      const fp = Pc.foot[s];
      fp.pos.set(lerp(f0[0], f1[0], t) * Lg, rig.ankleY, lerp(f0[1], f1[1], t) * Lg);
      const gx = root.pos.x, gz = root.pos.z;
      fp.pitch = lerp(f0[2], f1[2], t); fp.yaw = 0; fp.roll = 0;
      fp.pole.set(lerp(k0.knee[0], k1.knee[0], t) + SIDE_SIGN[s] * 0.1, lerp(k0.knee[1], k1.knee[1], t), lerp(k0.knee[2], k1.knee[2], t));
      // hands
      const hp = Pc.hand[s];
      const h0 = k0.hands ? k0.hands[s] : null, h1 = k1.hands ? k1.hands[s] : null;
      if (h0 && h1) { hp.posR.set(lerp(h0[0], h1[0], t) * H, lerp(h0[1], h1[1], t) * H + 0.02, lerp(h0[2], h1[2], t) * H); hp.space = 1; }
      else if (h0) { hp.posR.set(h0[0] * H, h0[1] * H + 0.02, h0[2] * H); hp.space = 1 - t; hp.pos.copy(this.armPose('hang', s).pos); }
      hp.pole.set(SIDE_SIGN[s] * 0.8, 0.2, -0.6); hp.pron = -1.2; hp.flex = -0.7; hp.fing = lerp(k0.fing, k1.fing, t); hp.thumb = 0.2;
    }
    if (c.zombie && !c.transform) { Pc.head.z += Math.sin(c.t * 7) * 0.12; Pc.spine.y += Math.sin(c.t * 3.3) * 0.08; }
    if (c.transform) {
      // irregular head jerks and twitching hands, strongest in the middle of the rise
      const k = clamp(c.t / c.dur, 0, 1), amp = 0.35 + 0.65 * Math.max(0, 1 - Math.abs(k - 0.5) * 1.7);
      const jerk = Math.max(0, Math.sin(c.t * 2.7 + 1.3)) ** 6;
      Pc.head.y += (Math.sin(c.t * 4.1) * 0.12 + jerk * 0.35 * Math.sign(Math.sin(c.t * 0.9))) * amp;
      Pc.head.z += Math.sin(c.t * 2.9 + 1) * 0.14 * amp; Pc.neck.x += Math.sin(c.t * 1.7) * 0.08 * amp;
      Pc.chest.z += Math.sin(c.t * 2.2) * 0.05 * amp; Pc.spine.y += Math.sin(c.t * 1.6 + 2) * 0.06 * amp;
      for (let s = 0; s < 2; s++) { const hp = Pc.hand[s]; hp.fing = clamp(hp.fing + Math.sin(c.t * 6.3 + s * 2.1) * 0.35 * amp, 0, 1); hp.thumb = hp.fing * 0.8; }
      Pc.jaw = 0.08 + Math.max(0, Math.sin(c.t * 3.3)) * 0.18 * amp;
    }
    P.copy(Pc);
    if (c.t >= c.dur) {
      const done = c.onDone; this.clip = null;
      this.takeSnapshot(c.transform ? 0.7 : 0.4); // blend into locomotion instead of popping
      if (done) done();
    }
  }

  // --- interaction poses --------------------------------------------------------------
  setAction(type, opts) {
    if (!type) { if (this.action) this.action.ending = true; return; }
    const prev = this.action;
    this.action = Object.assign({ type, t: 0, w: prev && !prev.ending ? prev.w : 0, ending: false, inT: 0.22, outT: 0.35 }, opts || {});
  }
  toRoot(w, root, out) {
    const dx = w.x - root.pos.x, dz = w.z - root.pos.z, c = Math.cos(root.yaw), s = Math.sin(root.yaw);
    return out.set(dx * c - dz * s, w.y - root.pos.y, dx * s + dz * c);
  }
  // point the face at a world position by turning chest, neck and head together (bite / feeding aim)
  aimHead(P, root, target, weight) {
    this.toRoot(target, root, _va);
    _va.sub(this.csPos[B.neck]);
    const yaw = Math.atan2(_va.x, _va.z), pitch = Math.atan2(-_va.y, Math.hypot(_va.x, _va.z) + 1e-4);
    const trunk = P.hipsRot.x + P.spine.x + P.chest.x + P.neck.x + P.head.x;
    const dp = clamp(pitch - trunk, -0.7, 1.1) * weight, dy = clamp(yaw, -1.1, 1.1) * weight;
    P.chest.y += dy * 0.3; P.neck.y += dy * 0.3; P.head.y += dy * 0.4;
    P.chest.x += dp * 0.2; P.neck.x += dp * 0.35; P.head.x += dp * 0.45;
  }
  applyAction(P, dt, root, env) {
    const a = this.action;
    a.t += dt;
    a.w = a.ending ? Math.max(0, a.w - dt / a.outT) : Math.min(1, a.w + dt / (a.type === 'feed' ? 0.6 : a.inT));
    if (a.ending && a.w <= 0) { this.action = null; return; }
    const Pc = this.Pc; Pc.copy(P);
    if (a.type === 'bite') this.poseBite(Pc, a, root, dt);
    else if (a.type === 'scratch') this.poseScratch(Pc, a, root);
    else if (a.type === 'struggle') this.poseStruggle(Pc, a, root, dt);
    else if (a.type === 'feed') this.poseFeed(Pc, a, root, env, dt);
    else if (a.type === 'recover') this.poseRecover(Pc, a, root);
    else if (a.type === 'balance') this.poseBalance(Pc, a, root);
    else if (a.type === 'notice') this.poseNotice(Pc, a, root);
    else if (a.type === 'convulse') this.poseConvulse(Pc, a, root);
    P.lerp(Pc, smooth01(a.w));
    if (!a.ending && a.dur && a.t >= a.dur) a.ending = true;
  }
  // hand target from clip coordinates (shoulder-relative, outward-positive) into chest space
  clipHand(hp, s, c, L) {
    const sg = SIDE_SIGN[s], sc = this.shoulderC[s];
    hp.pos.set(sc.x + c[0] * sg * L, sc.y + c[1] * L, sc.z + c[2] * L);
    hp.space = 0;
  }
  // zombie swipes: keyframed shoulder/elbow/wrist/torso/head motion with a contact event
  poseScratch(P, a, root) {
    const C = SCRATCH_CLIPS[a.clip] || SCRATCH_CLIPS.overhead, K = C.keys, L = this.L;
    const u = clamp(a.t / a.dur, 0, 1);
    const side = a.side, so = 1 - side, sg = SIDE_SIGN[side];
    const ha = P.hand[side], hs = P.hand[so];
    this.clipHand(ha, side, clipSample(K, u, 'a', _kca), L);
    ha.pole.set(sg * 1, -0.55, -0.45); ha.pron = -0.9; ha.flex = 0.15; ha.dev = 0;
    ha.fing = clipSample(K, u, 'fa'); ha.thumb = ha.fing * 0.8;
    if (C.both) { this.clipHand(hs, so, clipSample(K, u, 'a', _kcb), L); hs.fing = ha.fing; }
    else { this.clipHand(hs, so, clipSample(K, u, 's', _kcb), L); hs.fing = clipSample(K, u, 'fs'); }
    hs.pole.set(SIDE_SIGN[so] * 1, -0.55, -0.45); hs.pron = -0.6; hs.thumb = hs.fing * 0.8;
    const ch = clipSample(K, u, 'ch', _kcc), sp = clipSample(K, u, 'sp', _kcd), hd = clipSample(K, u, 'hd', _kce);
    const tw = C.both ? 0 : 1;
    P.chest.x += ch[0]; P.chest.y += sg * ch[1] * tw; P.chest.z += sg * ch[2] * tw;
    P.spine.x += sp[0]; P.spine.y += sg * sp[1] * tw;
    P.head.x += hd[0]; P.head.y += sg * hd[1] * tw; P.head.z += sg * hd[2] * tw;
    P.hipsOff.z += clipSample(K, u, 'hips'); P.hipsRot.x += clipSample(K, u, 'hips') * 0.8;
    P.jaw = clipSample(K, u, 'jaw');
    P.clav[side].set(0.15, 0, 0.1); P.clav[so].set(0.08, 0, 0);
    const v = a.target;
    if (v && !v.removed) {
      this.aimHead(P, root, v.boneWPos[B.head], 0.35);
      // motion warping: bend the strike toward the victim's body so the claw meets it at the contact frame
      const w = v.physMode === 'anim' ? (u < C.hit ? smoothstep(C.hit - 0.24, C.hit, u) : 1 - smoothstep(C.hit + 0.04, C.hit + 0.26, u)) * 0.8 : 0;
      if (w > 0.001) {
        const aim = SCRATCH_AIM[a.clip] || SCRATCH_AIM.jab;
        for (let k = 0; k < (C.both ? 2 : 1); k++) {
          const s = k === 0 ? side : so;
          this.toRoot(v.boneWPos[aim.bone === 'chest' ? B.chest : SB(aim.bone, 1 - s)], root, _va);
          const hd = Math.hypot(_va.x, _va.z);
          if (hd > 1e-3) { const back = Math.min(aim.back, hd * 0.5); _va.x -= _va.x / hd * back; _va.z -= _va.z / hd * back; }
          _va.y += aim.up; _va.x += SIDE_SIGN[s] * aim.lat;
          const hp = P.hand[s]; hp.posR.copy(_va); hp.space = w;
        }
      }
    }
    P.look = 0;
  }
  // zombie bite: reach, clamp the shoulders, lunge and bite (event), tear, chew; aims at the bite point
  poseBite(P, a, root, dt) {
    const v = a.target; if (!v || v.removed) return;
    // cycles: 'lunge' (bite lands on the snap frame), 'worry' (jaws locked, shaking), 'pause' (pull back, chew)
    const mkCyc = (kind) => kind === 'lunge' ? { kind, t: 0, dur: 1.0 + Math.random() * 0.4, snap: 0.3 + Math.random() * 0.1, snapped: false }
      : { kind, t: 0, dur: kind === 'worry' ? 0.8 + Math.random() * 0.4 : 0.7 + Math.random() * 0.4, snap: 99, snapped: true };
    if (!a.cyc) a.cyc = mkCyc('lunge');
    let c = a.cyc; c.t += dt;
    if (c.t >= c.dur) { const r = Math.random(); a.cyc = c = mkCyc(c.kind !== 'lunge' ? (r < 0.75 ? 'lunge' : 'worry') : (r < 0.4 ? 'lunge' : r < 0.72 ? 'worry' : 'pause')); }
    const cy = c.t / c.dur;
    if (!c.snapped && c.t >= c.snap) { c.snapped = true; a.snapEvent = true; }
    let lunge;
    if (c.kind === 'lunge') lunge = cy < 0.3 ? smooth01(cy / 0.3) : (cy < 0.55 ? 1 : 1 - smooth01((cy - 0.55) / 0.45) * 0.6);
    else if (c.kind === 'worry') lunge = 0.4 + 0.15 * Math.sin(cy * Math.PI);
    else lunge = 0.4 * (1 - Math.sin(cy * Math.PI) * 0.9);
    const reach = smooth01(Math.min(1, a.t / 0.28));
    P.hipsRot.x += 0.05; P.spine.x += 0.08 + lunge * 0.06; P.chest.x += 0.08 + lunge * 0.1;
    // hands: shoulders (front bite), shoulder + upper arm (side), or the raised forearm (arm bite)
    for (let s = 0; s < 2; s++) {
      let tb;
      if (a.variant === 'arm') tb = s === 0 ? v.boneWPos[SB('forearm', 1)] : v.boneWPos[SB('hand', 1)];
      else if (a.variant === 'shoulder') tb = s === 0 ? v.boneWPos[SB('upperarm', 1)] : v.boneWPos[SB('forearm', 1)];
      else tb = v.boneWPos[SB('upperarm', 1 - s)];
      this.toRoot(tb, root, _va);
      const hp = P.hand[s];
      const rest = this.armPose('reach', s);
      hp.pos.copy(rest.pos); hp.posR.copy(_va); hp.posR.y -= 0.02; hp.posR.z -= 0.02; hp.space = reach;
      hp.pole.set(SIDE_SIGN[s], -0.7, -0.25); hp.pron = -0.9; hp.flex = 0.55; hp.fing = lerp(0.5, 0.92, reach); hp.thumb = hp.fing * 0.8;
    }
    const bp = a.variant === 'arm' ? v.boneWPos[SB('forearm', 1)] : a.variant === 'shoulder' ? v.boneWPos[SB('clavicle', 1)] : v.boneWPos[B.neck];
    this.aimHead(P, root, bp, 0.85);
    if (c.kind === 'lunge') P.jaw = cy < 0.28 ? 0.45 : (cy < 0.38 ? lerp(0.45, 0.02, (cy - 0.28) / 0.1) : 0.04 + Math.max(0, Math.sin(a.t * 17)) * 0.05);
    else if (c.kind === 'worry') P.jaw = 0.03 + Math.max(0, Math.sin(a.t * 11)) * 0.04;
    else P.jaw = 0.06 + Math.max(0, Math.sin(a.t * 9)) * 0.2;
    P.neck.x += lunge * 0.12; P.head.x += lunge * 0.14;
    if (c.kind === 'lunge' && cy > 0.38 && cy < 0.66) { const sh = Math.sin(a.t * 36) * (1 - (cy - 0.38) / 0.28); P.head.y += sh * 0.16; P.chest.y += sh * 0.06; }
    else if (c.kind === 'worry') { const sh = Math.sin(a.t * 24) * Math.sin(cy * Math.PI); P.head.y += sh * 0.2; P.chest.y += sh * 0.08; P.head.z += sh * 0.06; }
    else if (c.kind === 'pause') { const k = Math.sin(cy * Math.PI); P.head.x -= k * 0.12; P.neck.x -= k * 0.06; P.head.y += Math.sin(a.t * 3.1) * 0.12 * k; }
    P.look = 0;
  }
  // victim: pushes the attacker off, twists and pulls away, or blocks with a forearm
  poseStruggle(P, a, root, dt) {
    const z = a.target; if (!z || z.removed) return;
    const t = a.t, away = a.away || 1;
    a.modeT = (a.modeT || 0) - dt;
    if (a.modeT <= 0) { a.prevMode = a.mode || 'push'; a.mode = a.forceMode || ['push', 'pull', 'push', 'block'][Math.floor(Math.random() * 4)]; a.modeT = 0.7 + Math.random() * 0.8; a.mw = 0; }
    a.mw = Math.min(1, (a.mw || 0) + dt / 0.3);
    const base = P.spine.x, Pm = this.Pb; Pm.copy(P);
    const mode = (m, Q) => {
      Q.spine.x -= 0.1; Q.chest.x -= 0.16 + Math.sin(t * 7) * 0.04; Q.chest.z += Math.sin(t * 6.3) * 0.09; Q.hipsRot.z += Math.sin(t * 5.1) * 0.04;
      for (let s = 0; s < 2; s++) {
        const hp = Q.hand[s];
        let tb = s === 0 ? z.boneWPos[B.chest] : z.boneWPos[B.head];
        if (m === 'pull' && s === 1) tb = z.boneWPos[SB('upperarm', 0)];
        this.toRoot(tb, root, _va);
        hp.posR.copy(_va); hp.posR.x += SIDE_SIGN[s] * 0.07; hp.posR.y += (s === 0 ? -0.04 : -0.1) + Math.sin(t * 9 + s * 2) * 0.03; hp.space = 1;
        hp.pole.set(SIDE_SIGN[s], -0.8, -0.3); hp.pron = -1.4; hp.flex = -0.8; hp.fing = 0.15; hp.thumb = 0.2;
      }
      if (m === 'pull') { Q.chest.y += away * 0.45; Q.spine.y += away * 0.25; Q.chest.x -= 0.12; Q.hipsOff.z -= 0.06; const hp = Q.hand[away > 0 ? 0 : 1]; hp.space = 0.3; }
      if (m === 'block') { // forearm up between the faces
        const hb = Q.hand[1]; hb.space = 0; hb.pos.copy(this.armPose('guard', 1).pos); hb.pos.z += 0.05; hb.pole.set(-1, -1, 0.2); hb.pron = -0.8; hb.fing = 0.75;
        Q.head.x += 0.1; Q.chest.x -= 0.05;
      }
      Q.head.x -= 0.22; Q.head.y += away * 0.55; Q.neck.y += away * 0.3; Q.head.z -= away * 0.12;
    };
    mode(a.mode, P);
    if (a.mw < 1 && a.prevMode && a.prevMode !== a.mode) { mode(a.prevMode, Pm); P.lerp(Pm, 1 - smooth01(a.mw)); }
    P.jaw = 0.36 + Math.sin(t * 13) * 0.06;
    P.look = 0;
  }
  // zombie eating a body: dive-and-tear, two-handed pulling, sitting back to chew (pauses), leaning on one arm
  poseFeed(P, a, root, env, dt) {
    const rig = this.rig, H = rig.H;
    a.modeT = (a.modeT || 0) - dt;
    if (a.modeT <= 0) {
      a.prevMode = a.mode || 'dive';
      const r = Math.random();
      a.mode = a.prevMode === 'chew' ? (r < 0.6 ? 'dive' : 'tear') : (r < 0.38 ? 'dive' : r < 0.62 ? 'tear' : r < 0.85 ? 'chew' : 'lean');
      a.modeT = a.mode === 'chew' ? 1.2 + Math.random() * 1.6 : 1.6 + Math.random() * 2.2;
      a.mt = 0; a.mw = 0; a.cycle = 1.5 + Math.random() * 0.8;
    }
    a.mt = (a.mt || 0) + dt; a.mw = Math.min(1, (a.mw || 0) + dt / 0.45);
    const Pm = this.Pb; Pm.copy(P);
    this.feedMode(P, a, a.mode, a.mt, root);
    if (a.mw < 1 && a.prevMode && a.prevMode !== a.mode) { this.feedMode(Pm, a, a.prevMode, a.mt + 2, root); P.lerp(Pm, 1 - smooth01(a.mw)); }
    // bite event for the AI (blood, chunks, sound) at the deepest point of a dive / tear
    const cyc = (a.mt / a.cycle) % 1;
    if ((a.mode === 'dive' || a.mode === 'tear') && cyc > 0.32 && (a.lastCyc || 0) <= 0.32) a.biteEvent = true;
    a.lastCyc = cyc;
  }
  feedMode(P, a, mode, t, root) {
    const rig = this.rig, H = rig.H;
    const cyc = (t / (a.cycle || 1.9)) % 1;
    const dip = cyc < 0.3 ? smooth01(cyc / 0.3) : (cyc < 0.5 ? 1 : 1 - smooth01((cyc - 0.5) / 0.5));
    const sitBack = mode === 'chew' ? 1 : 0;
    const hipJ = rig.thighLen * (0.82 - sitBack * 0.18) + 0.07;
    P.hipsOff.set(0, hipJ + 0.035 * H - rig.hipsHeight, -0.06 - sitBack * 0.05);
    P.hipsRot.set(0.45 - sitBack * 0.25, 0, Math.sin(t * 0.9) * 0.04);
    const lean = mode === 'chew' ? 0.15 : mode === 'lean' ? 0.32 : 0.42;
    P.spine.set(lean + dip * 0.06 * (1 - sitBack), Math.sin(t * 0.7) * 0.05, mode === 'lean' ? 0.12 : 0);
    P.chest.set(lean - 0.04 + dip * 0.1 * (1 - sitBack), mode === 'chew' ? Math.sin(t * 0.8) * 0.15 : 0, Math.sin(t * 1.3) * 0.04);
    P.neck.set(0.2 + dip * 0.2 * (1 - sitBack), 0, 0);
    P.head.set(0.2 + dip * 0.25 * (1 - sitBack) - sitBack * 0.25, (cyc > 0.3 && cyc < 0.5 && mode !== 'chew') ? Math.sin(t * 36) * 0.18 : (mode === 'chew' ? Math.sin(t * 1.1) * 0.5 : 0), 0.1);
    for (let s = 0; s < 2; s++) {
      const sg = SIDE_SIGN[s], fp = P.foot[s];
      fp.pos.set(sg * rig.hipHalf * 1.15, rig.ankleY * 0.3 + 0.1, -rig.shinLen * 0.86);
      fp.pitch = 1.25; fp.yaw = 0; fp.roll = 0; fp.pole.set(sg * 0.15, -0.5, 1);
    }
    const tgt = a.point, fh = a.hand || 0;
    for (let s = 0; s < 2; s++) {
      const hp = P.hand[s], sg = SIDE_SIGN[s];
      let toMouth = 0;
      if (mode === 'dive' && s === fh) toMouth = cyc > 0.42 ? smooth01((cyc - 0.42) / 0.18) * (1 - smooth01((cyc - 0.85) / 0.15)) : 0;
      if (mode === 'tear') toMouth = cyc > 0.45 ? smooth01((cyc - 0.45) / 0.2) * (1 - smooth01((cyc - 0.85) / 0.15)) * 0.6 : 0;
      if (mode === 'chew') toMouth = s === fh ? 0.9 : 0.15;
      if (mode === 'lean' && s !== fh) toMouth = 0;
      hp.pos.set(-sg * 0.03, 0.2, 0.17);
      if (tgt) {
        this.toRoot(tgt, root, _va);
        hp.posR.copy(_va); hp.posR.x += sg * (mode === 'lean' && s !== fh ? 0.24 : 0.13); hp.posR.y += 0.04 + (mode === 'tear' ? smooth01(Math.max(0, cyc - 0.4) / 0.3) * 0.12 : 0);
        if (mode === 'lean' && s !== fh) { hp.posR.z -= 0.15; hp.posR.y = 0.06 - root.pos.y + root.pos.y; }
        hp.space = 1 - toMouth;
      } else hp.space = 0;
      hp.pole.set(sg, -0.5, -0.5); hp.pron = -1.2; hp.flex = toMouth > 0.5 ? 0.7 : 0.3; hp.fing = lerp(0.8, 0.95, toMouth); hp.thumb = 0.7;
    }
    P.jaw = mode === 'chew' ? 0.05 + Math.max(0, Math.sin(t * 9)) * 0.22 : (cyc < 0.3 ? 0.4 : (cyc < 0.5 ? 0.05 + Math.max(0, Math.sin(t * 22)) * 0.1 : 0.06 + Math.max(0, Math.sin(t * 15)) * 0.16));
    P.look = mode === 'chew' ? 0.8 : 0.3;
  }
  // after an attack: half-step back, head shake, chewing
  poseRecover(P, a, root) {
    const u = clamp(a.t / (a.dur || 0.8), 0, 1), k = Math.sin(Math.PI * u);
    P.hipsOff.z -= k * 0.06; P.chest.x -= k * 0.08; P.head.y += Math.sin(a.t * 14) * 0.14 * (1 - u); P.head.x += k * 0.1;
    P.jaw = 0.06 + Math.max(0, Math.sin(a.t * 10)) * 0.2;
    for (let s = 0; s < 2; s++) { const hp = P.hand[s]; hp.pos.y -= k * 0.06; hp.fing = 0.6 + 0.3 * Math.sin(a.t * 8 + s); }
  }
  // catching balance after a lurch: arms flung out, torso tilting the other way
  poseBalance(P, a, root) {
    const u = clamp(a.t / (a.dur || 0.8), 0, 1), k = Math.sin(Math.PI * u), d = a.dir || 1;
    P.hipsRot.z += d * 0.08 * k; P.spine.z -= d * 0.12 * k; P.chest.z -= d * 0.1 * k; P.head.z += d * 0.15 * k;
    for (let s = 0; s < 2; s++) {
      const hp = P.hand[s], sg = SIDE_SIGN[s];
      const arm = this.armPose('flail', s);
      hp.pos.lerp(arm.pos, k * (sg === d ? 0.9 : 0.55)); hp.fing = lerp(hp.fing, 0.1, k);
    }
  }
  // noticing prey: hunch, head snaps forward, arms twitch up
  poseNotice(P, a, root) {
    const u = clamp(a.t / (a.dur || 0.6), 0, 1), k = Math.sin(Math.PI * Math.min(1, u * 1.3));
    P.chest.x += k * 0.1; P.neck.x -= k * 0.15; P.head.x -= k * 0.1; P.clav[0].z += k * 0.2; P.clav[1].z += k * 0.2;
    P.jaw = 0.1 + k * 0.35;
    for (let s = 0; s < 2; s++) { const hp = P.hand[s]; hp.pos.y += k * 0.08; hp.pos.z += k * 0.06; hp.fing = 0.4 + k * 0.5; }
  }
  // infected body seizing on the ground before it turns (used while ragdolled via springs too)
  poseConvulse(P, a, root) {
    const t = a.t;
    P.chest.x += Math.sin(t * 23) * 0.12; P.head.y += Math.sin(t * 31) * 0.3; P.head.x += Math.sin(t * 17) * 0.2;
    for (let s = 0; s < 2; s++) { const hp = P.hand[s]; hp.pos.y += Math.sin(t * 27 + s * 3) * 0.08; hp.fing = 0.5 + 0.5 * Math.sin(t * 19 + s); }
    P.jaw = 0.2 + Math.abs(Math.sin(t * 21)) * 0.25;
  }
  // --- solver -------------------------------------------------------------------------
  solve(P, root, dt) {
    const rig = this.rig, off = rig.localOffset;
    const L = this.local, R = this.csRot, X = this.csPos;
    const npc = this.npc;
    // root (character space identity)
    L[0].identity(); R[0].identity(); X[0].set(0, 0, 0);
    // hips
    quatFromEuler(P.hipsRot.x, P.hipsRot.y, P.hipsRot.z, L[B.hips], 'YXZ');
    this.hipsLocalPos.copy(off[B.hips]).add(P.hipsOff);
    R[B.hips].copy(L[B.hips]); X[B.hips].copy(this.hipsLocalPos);
    // breathing
    const br = Math.sin(this.breath) * (0.012 + this.exertion * 0.02);
    // spine chain
    this.setLocalEuler(B.spine, P.spine.x, P.spine.y, P.spine.z);
    this.setLocalEuler(B.chest, P.chest.x - br, P.chest.y, P.chest.z);
    // look-at
    let ny = 0, np = 0, hy = 0, hp = 0;
    const lw = P.look;
    this.lookW = damp(this.lookW, this.lookActive ? (this.lookWTarget || 1) : 0, 4, dt);
    if (this.lookW > 0.01) {
      // target in root space
      const t = this.lookTarget;
      const dx = t.x - root.pos.x, dy = t.y - root.pos.y, dz = t.z - root.pos.z;
      const c = Math.cos(-root.yaw), s = Math.sin(-root.yaw);
      _v1.set(dx * c + dz * s, dy, -dx * s + dz * c);
      // relative to neck in chest frame
      _v2.copy(off[B.neck]).applyQuaternion(R[B.chest]).add(X[B.chest]);
      _v1.sub(_v2);
      _q3.copy(R[B.chest]).invert(); _v1.applyQuaternion(_q3).normalize();
      this.lookDir.lerp(_v1, 1 - Math.exp(-7 * dt)).normalize();
      let yaw = Math.atan2(this.lookDir.x, this.lookDir.z), pitch = -Math.asin(clamp(this.lookDir.y, -1, 1));
      yaw = clamp(yaw, -1.25, 1.25); pitch = clamp(pitch, -0.6, 0.5);
      const w = this.lookW * lw;
      ny = yaw * 0.4 * w; np = pitch * 0.35 * w; hy = yaw * 0.6 * w; hp = pitch * 0.65 * w;
      this.eyeYawT = clamp(yaw - (ny + hy), -0.35, 0.35) * w; this.eyePitchT = clamp(pitch - (np + hp), -0.25, 0.25) * w;
    } else { this.eyeYawT = 0; this.eyePitchT = 0; }
    this.setLocalEuler(B.neck, P.neck.x + np, P.neck.y + ny, P.neck.z);
    this.setLocalEuler(B.head, P.head.x + hp, P.head.y + hy, P.head.z);
    // jaw, eyes, lids
    this.setLocalEuler(B.jaw, clamp(P.jaw + this.jaw, 0, 0.45), 0, 0);
    this.saccadeT -= dt;
    if (this.saccadeT <= 0) { this.saccade.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.08, 0); this.saccadeT = 0.4 + Math.random() * 2; }
    this.eyeYaw = damp(this.eyeYaw, (this.eyeYawT || 0) + this.saccade.x, 25, dt);
    this.eyePitch = damp(this.eyePitch, (this.eyePitchT || 0) + this.saccade.y, 25, dt);
    const dead = npc.lifeState === 'dead' || npc.lifeState === 'destroyed';
    for (let s = 0; s < 2; s++) {
      this.setLocalEuler(SB('eye', s), this.eyePitch, this.eyeYaw, 0);
      const lidClose = dead ? 0.55 : (this.blink > 0 ? 1 : 0) * 0.62 + (npc.fear ? -0.08 : 0) + (this.zombie ? 0.1 : 0);
      this.setLocalEuler(SB('lid', s), clamp(lidClose, -0.1, 0.62), 0, 0);
    }
    // hair bone (spring)
    this.solveHair(root, dt);
    // clavicles + arms
    for (let s = 0; s < 2; s++) {
      const hpm = P.hand[s];
      // target (wrist) in character space
      const tgt = _v3;
      tgt.copy(hpm.pos).applyQuaternion(R[B.chest]).add(X[B.chest]);
      if (hpm.space > 0) tgt.lerp(hpm.posR, hpm.space);
      // auto clavicle raise when hand above shoulder
      const shC = _v5.copy(off[SB('clavicle', s)]).applyQuaternion(R[B.chest]).add(X[B.chest]);
      const raise = clamp((tgt.y - shC.y) / this.L, 0, 1) * 0.28 + P.clav[s].z;
      const fwd = clamp((tgt.z - shC.z) / this.L, -0.5, 1) * 0.12 + P.clav[s].x;
      const sg = SIDE_SIGN[s];
      this.setLocalEuler(SB('clavicle', s), -fwd * 0.3, -fwd * 0.6 * sg, raise * sg);
      const ua = SB('upperarm', s), fa = SB('forearm', s), ha = SB('hand', s);
      this.updateCS(ua);
      const pole = _v6.copy(hpm.pole).applyQuaternion(R[B.chest]);
      solveTwoBone(X[ua], tgt, pole, rig.upperArmLen, rig.forearmLen, rig.armDir[s], rig.elbowAxis[s], _q1, _q2, 0.05);
      // pronation about forearm axis
      _v4.copy(rig.armDir[s]).applyQuaternion(_q2);
      quatAxisAngle(_v4, hpm.pron * -sg, _q3);
      _q2.premultiply(_q3);
      this.setCS(ua, _q1); this.setCS(fa, _q2);
      // hand
      quatAxisAngle(this.flexAxis[s], hpm.flex, _q1);
      quatAxisAngle(rig.armE2[s], hpm.dev * 0.5, _q2);
      L[ha].multiplyQuaternions(_q1, _q2); this.updateCS(ha);
      quatAxisAngle(this.flexAxis[s], hpm.fing * 1.25, L[SB('fingers1', s)]); this.updateCS(SB('fingers1', s));
      quatAxisAngle(this.flexAxis[s], hpm.fing * 1.45, L[SB('fingers2', s)]); this.updateCS(SB('fingers2', s));
      quatAxisAngle(this.flexAxis[s], hpm.thumb * 0.7, L[SB('thumb', s)]); this.updateCS(SB('thumb', s));
    }
    // legs
    for (let s = 0; s < 2; s++) {
      const fp = P.foot[s];
      const th = SB('thigh', s), sh = SB('shin', s), ft = SB('foot', s);
      this.updateCS(th);
      solveTwoBone(X[th], fp.pos, fp.pole, rig.thighLen, rig.shinLen, _v1.set(0, -1, 0), rig.kneeAxis, _q1, _q2, 0.02, 0.993);
      this.setCS(th, _q1); this.setCS(sh, _q2);
      // foot: yaw then pitch (toe down positive)
      quatFromEuler(fp.pitch, fp.yaw, fp.roll, _q3, 'YXZ');
      this.setCS(ft, _q3);
    }
    // additive hit springs
    const sp = this.springs;
    if (sp.active) {
      for (let i = 0; i < SPRING_BONES.length; i++) {
        const r = sp.rot[i]; if (r.lengthSq() < 1e-8) continue;
        quatFromRotVec(r, _q1);
        L[SPRING_BONES[i]].multiply(_q1);
      }
    }
  }
  setLocalEuler(i, x, y, z) {
    quatFromEuler(x, y, z, this.local[i], 'YXZ');
    this.updateCS(i);
  }
  updateCS(i) {
    const p = BONE_PARENT[i];
    this.csRot[i].multiplyQuaternions(this.csRot[p], this.local[i]);
    this.csPos[i].copy(this.rig.localOffset[i]).applyQuaternion(this.csRot[p]).add(this.csPos[p]);
  }
  setCS(i, q) {
    const p = BONE_PARENT[i];
    _q3.copy(this.csRot[p]).invert();
    this.local[i].multiplyQuaternions(_q3, q);
    this.csRot[i].copy(q);
    this.csPos[i].copy(this.rig.localOffset[i]).applyQuaternion(this.csRot[p]).add(this.csPos[p]);
  }
  solveHair(root, dt) {
    if (this.npc.app.hairStyle !== 'ponytail') { this.updateCS(B.hair); return; }
    // simple pendulum in world space
    const hb = B.hair;
    this.local[hb].identity(); this.updateCS(hb);
    const c = Math.cos(root.yaw), s = Math.sin(root.yaw);
    const cs = this.csPos[hb];
    const wx = root.pos.x + cs.x * c + cs.z * s, wy = root.pos.y + cs.y, wz = root.pos.z - cs.x * s + cs.z * c;
    const len = 0.2 * this.rig.sHead;
    if (!this.hairInit) { this.hairTip.set(wx, wy - len, wz - 0.02); this.hairPrev.copy(this.hairTip); this.hairInit = true; }
    const t = this.hairTip;
    const vx = (t.x - this.hairPrev.x) * 0.92, vy = (t.y - this.hairPrev.y) * 0.92, vz = (t.z - this.hairPrev.z) * 0.92;
    this.hairPrev.copy(t);
    t.x += vx; t.y += vy - 9.8 * dt * dt; t.z += vz;
    _v1.set(t.x - wx, t.y - wy, t.z - wz);
    // keep behind head
    const bx = -s, bz = -c; // backward dir in world
    const back = _v1.x * bx + _v1.z * bz;
    if (back < 0.02) { _v1.x += bx * (0.02 - back); _v1.z += bz * (0.02 - back); }
    _v1.setLength(len);
    t.set(wx + _v1.x, wy + _v1.y, wz + _v1.z);
    // convert to char-space direction, compute rotation from bind direction (down)
    _v2.set(_v1.x * c - _v1.z * s, _v1.y, _v1.x * s + _v1.z * c).normalize();
    _v3.set(0, -1, -0.15).normalize();
    _q1.setFromUnitVectors(_v3, _v2);
    this.setCS(hb, _q1);
  }
}
// region -> representative bone (for clutch gestures)
const REGION_BONE = [B.head, B.neck, B.chest, B.chest, B.spine, B.hips, B.upperarm_L, B.forearm_L, B.hand_L, B.upperarm_R, B.forearm_R, B.hand_R,
  B.thigh_L, B.shin_L, B.foot_L, B.thigh_R, B.shin_R, B.foot_R];
HT.Animator = Animator;
