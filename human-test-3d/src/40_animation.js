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
  call: [{ pos: [0.10, -0.93, 0.07], pole: [0.25, 0, -1], pron: 0, flex: 0.12, dev: 0, fing: 0.35, thumb: 0.25 },
    { pos: [-0.07, 0.36, 0.07], pole: [1, -0.3, 0.1], pron: -1.4, flex: 0.45, dev: 0, fing: 0.62, thumb: 0.5 }],
  waveR: [{ pos: [0.10, -0.93, 0.07], pole: [0.25, 0, -1], pron: 0, flex: 0.12, dev: 0, fing: 0.35, thumb: 0.25 },
    { pos: [0.42, 0.32, 0.18], pole: [1, -1, -0.3], pron: -1.5, flex: -0.2, dev: 0, fing: 0.05, thumb: 0.1, wave: 1 }]
};
// facial expressions: [brow raise, inner brows (+ up / - knit), mouth corners (+ up / - down), brow asymmetry,
// lips stretched sideways, eyelids (- wide / + narrowed), jaw open]
const EXPRESSIONS = {
  neutral: [0, 0, 0.05, 0, 0, 0, 0],
  worried: [0.25, 0.55, -0.2, 0, 0.15, -0.03, 0],
  fear: [0.7, 0.9, -0.45, 0, 0.8, -0.1, 0.05],
  terror: [1, 1, -0.6, 0, 1, -0.14, 0.13],
  surprise: [1, 0.25, 0, 0, 0.1, -0.15, 0.14],
  pain: [-0.45, 0.75, -0.7, 0, 0.85, 0.25, 0.04],
  angry: [-0.8, -1, -0.4, 0, 0.4, 0.06, 0.02],
  friendly: [0.2, 0.05, 0.75, 0, 0.1, 0.06, 0],
  disgust: [-0.25, -0.35, -0.55, 0.4, 0.35, 0.1, 0.02],
  confused: [0.15, -0.25, -0.15, 0.85, 0, 0.02, 0.02],
  sick: [-0.1, 0.6, -0.35, 0, 0.1, 0.12, 0.02],
  discomfort: [-0.2, 0.45, -0.3, 0.15, 0.3, 0.1, 0],
  tired: [-0.15, 0.3, -0.25, 0, 0, 0.24, 0.03],
  ill: [-0.25, 0.65, -0.45, 0, 0.2, 0.28, 0.05],
  snarl: [-0.7, -0.6, -0.75, 0, 0.9, 0.05, 0],
  blank: [-0.2, 0, -0.3, 0, 0.2, 0, 0],
  slack: [0, 0, -0.2, 0, 0, 0, 0]
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
  phone: { layer: 'upper', blend: 0.6 }, scratch: { layer: 'upper', blend: 0.5 }, watch: { layer: 'upper', blend: 0.5 }, call: { layer: 'upper', blend: 0.5 },
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

const _qa = new QT(), _va = new V3(), _vb = new V3(), _vc = new V3(), _vd = new V3();


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

// --- vampires: movement personalities (posture, arms, speeds, idles) ----------------------
// hunch/crouch: posture overlay on the human gait; walk/run: m/s; stalkR: distance the rush starts from
const VAMP_STYLES = {
  aristocrat: { name: 'aristocrat', hunch: -0.06, crouch: 0.0, walk: 1.3, run: 5.6, arms: 'behind', stalkR: 3.2, cadence: 0.9, idles: ['poised', 'adjust', 'poised', 'scan'] },
  feral: { name: 'feral', hunch: 0.36, crouch: 0.075, walk: 1.65, run: 6.4, arms: 'claw', stalkR: 4.6, cadence: 1.12, twitch: true, idles: ['crouch', 'sniff', 'crouch', 'scan'] },
  stalker: { name: 'stalker', hunch: 0.18, crouch: 0.1, walk: 0.95, run: 5.9, arms: 'low', stalkR: 5.6, cadence: 0.95, idles: ['still', 'still', 'scan', 'sniff'] }
};
const VAMP_STYLE_NAMES = Object.keys(VAMP_STYLES);
// gait profiles: each character walks its own way (multipliers on the human gait)
// stride, stance width, toe-out (rad), swing height, vertical bob, pelvis roll / yaw, side sway, arm swing,
// forward lean (rad), landing foot pitch (hs: - heel first, + toe first), heavy: body dip on each landing
const GAITS = {
  // the containment doctor: long, unhurried, deliberate steps, upright, hardly any arm swing
  doctor: { stride: 1.12, width: 0.78, toeOut: 0.05, stepH: 0.7, bob: 0.3, roll: 0.35, yaw: 0.35, sway: 0.35, arm: 0.12, lean: -0.01, hs: -0.26, heavy: 0.5 },
  // the slasher: long, heavy, deliberate strides, arms nearly still, a dip on every footfall
  slasher: { stride: 1.2, width: 1.2, toeOut: 0.14, stepH: 0.8, bob: 1.0, roll: 0.5, yaw: 0.45, sway: 0.8, arm: 0.25, lean: 0.06, hs: -0.32, heavy: 1.4 },
  // the doll: short quick steps on stiff little legs, a wide side-to-side waddle, big arm pumps
  doll: { stride: 0.66, width: 1.5, toeOut: 0.32, stepH: 0.7, bob: 1.4, roll: 2.4, yaw: 1.4, sway: 2.2, arm: 1.8, lean: 0.07, hs: -0.1 },
  // vampires: the aristocrat glides on a narrow line, the feral one scurries low, the stalker creeps toe-first
  aristocrat: { stride: 1.14, width: 0.7, toeOut: 0.03, stepH: 0.85, bob: 0.22, roll: 0.4, yaw: 0.45, sway: 0.45, arm: 0.0, lean: -0.02, hs: -0.2 },
  feral: { stride: 0.82, width: 1.3, toeOut: 0.2, stepH: 0.95, bob: 0.75, roll: 0.75, yaw: 0.85, sway: 1.15, arm: 0.6, lean: 0.12, hs: -0.04 },
  stalker: { stride: 0.9, width: 0.92, toeOut: 0.07, stepH: 0.55, bob: 0.18, roll: 0.3, yaw: 0.3, sway: 0.35, arm: 0.3, lean: 0.03, hs: 0.2 }
};
// rising from the ground "like a board": the straight body pivots up about the heels (face-up bodies).
// Dense linear keys sample a smooth angle curve; rz moves the root forward so the heels stay planted.
function vampRiseKeys() {
  const r = 0.97, hold = 0.9, rise = 2.5, N = 14, keys = [];
  const pose = (t, a) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    return { t, hy: 0.15 * ca + 0.995 * sa, pitch: -1.5 * (1 - a / (Math.PI / 2)), sp: 0, ch: 0, hd: 0.08 * ca,
      feet: [[0.1, r * ca, -1.0 * ca], [-0.1, r * ca, -1.0 * ca]], rz: r * (1 - ca), knee: [0, 0, 1], hands: null, fing: 0.25 };
  };
  keys.push(pose(0, 0), pose(hold, 0));
  for (let i = 1; i <= N; i++) { const u = i / N; keys.push(pose(hold + rise * u, (Math.PI / 2) * smooth01(u))); }
  const end = pose(hold + rise + 0.6, Math.PI / 2); end.hd = -0.06; end.ch = -0.03; keys.push(end);
  return keys;
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
const _feedFK = [[0, 0], [0, 0], [0, 0]];
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
    this.vamp = 0; this.vampTarget = 0; this.vstyle = null; this.vStalk = 0; this.vStalkTarget = 0; // vampire body language
    this.hstyle = null; this.gripR = 0; // horror characters
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
      f.pos.y = env.groundHeight(f.pos.x, f.pos.z, rootPos.y + 0.1);
      f.swing = false; f.yaw = yaw; f.pitch = 0;
    }
    this.prevRootPos.copy(rootPos);
    this.initialized = true;
  }
  // the ground under the character moved (a train): move the planted feet and the velocity reference with it
  carry(dx, dy, dz) {
    for (let s = 0; s < 2; s++) {
      const f = this.feet[s];
      f.pos.x += dx; f.pos.y += dy; f.pos.z += dz;
      f.from.x += dx; f.from.y += dy; f.from.z += dz;
      f.to.x += dx; f.to.y += dy; f.to.z += dz;
    }
    this.prevRootPos.x += dx; this.prevRootPos.y += dy; this.prevRootPos.z += dz;
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
    this.vamp = damp(this.vamp, this.vampTarget, 2.2, dt);
    const po = this.posture; po.w = Math.min(1, po.w + dt / Math.max(0.05, po.dur));
    this.exertion = clamp(this.exertion + (this.speed > 2.5 ? dt * 0.12 : -dt * 0.05), 0, 1);
    this.updateSway(dt, root, env);
    // 1) base locomotion
    const P = this.P;
    if (this.crawl > 0.5 && !this.clip) this.crawlPose(dt, root, env, P);
    else {
      this.locomotion(dt, root, env, P);
      // 2) postures
      this.applyPosture(P, dt);
      // 3) upper body
      this.applyUpper(P, dt, root);
      // 3a) vampire posture and arm carriage
      if (this.vamp > 0.001) this.applyVampPosture(P, dt, root);
      // 3b) horror characters: doll waddle / slasher's heavy, leaning gait
      if (this.hstyle) this.applyHorrorPosture(P, dt, root);
    }
    // 3b) interactions (grapple / bite / struggle / feeding)
    if (this.action) this.applyAction(P, dt, root, env);
    // 4) clip
    if (this.clip) this.applyClip(dt, root, env, P);
    // a weapon in the right fist keeps the fingers closed around it
    if (this.gripR > 0) { const h = P.hand[1]; h.fing = lerp(h.fing, 0.97, this.gripR); h.thumb = lerp(h.thumb, 0.9, this.gripR); }
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
    // natural blinks: a quick close and a slower open, every 2-6 s; more often when talking or frightened,
    // sometimes twice in a row. (this.blink > 0 is a held close requested by other poses.)
    const fearK = this.npc.fear || 0;
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.nbT = 0;
      this.blinkT = (this.talking ? 1.6 + Math.random() * 2.4 : 2 + Math.random() * 4.2) * (1 - 0.45 * fearK);
      if (Math.random() < 0.14) this.blinkT = 0.3;
    }
    if (this.nbT != null) { this.nbT += dt; if (this.nbT > 0.18) this.nbT = null; }
    if (this.blink > 0) this.blink -= dt;
    this.breath += dt * TAU * (0.24 + this.exertion * 0.35 + fearK * 0.25);
    this.jaw = damp(this.jaw, this.jawTarget, 12, dt);
    this.updateExpression(dt);
  }
  // cloth and hair sway: a damped spring driven by the body's speed, acceleration and turning, plus the
  // wind outdoors. Free hems and hair ends (aFlex) follow it in the vertex shader.
  updateSway(dt, root, env) {
    const u = this.npc.material && this.npc.material.userData.u; if (!u || !u.uSway) return;
    const S = this.sway || (this.sway = { x: new V3(), v: new V3(), pv: new V3().copy(this.vel), t: new V3() });
    const c = Math.cos(root.yaw), s = Math.sin(root.yaw), idt = 1 / Math.max(dt, 1e-3);
    const ax = (this.vel.x - S.pv.x) * idt, az = (this.vel.z - S.pv.z) * idt; S.pv.copy(this.vel);
    const lvx = this.vel.x * c - this.vel.z * s, lvz = this.vel.x * s + this.vel.z * c;
    const lax = clamp(ax * c - az * s, -12, 12), laz = clamp(ax * s + az * c, -12, 12), spd = Math.hypot(lvx, lvz);
    const T = S.t.set(-lvx * 0.012 - lax * 0.005 - (this.yawRate || 0) * spd * 0.01, spd * 0.004, -lvz * 0.012 - laz * 0.005);
    const cur = env.current, w = cur && cur.outdoor && cur.windStrength != null ? cur.windStrength : 0;
    if (w > 0 && cur.windDir) { const wd = cur.windDir; T.x += (wd.x * c - wd.z * s) * w * 0.022; T.z += (wd.x * s + wd.z * c) * w * 0.022; }
    S.v.addScaledVector(T.sub(S.x), 70 * dt).multiplyScalar(Math.max(0, 1 - 9 * dt));
    S.x.addScaledVector(S.v, dt);
    if (S.x.lengthSq() > 0.0081) S.x.setLength(0.09);
    u.uSway.value.set(S.x.x, S.x.y, S.x.z, w * 0.7 + spd * 0.25);
  }
  // 0..1 lid closure from natural blinks and held closes
  blinkClose() {
    if (this.blink > 0) return 1;
    const t = this.nbT; if (t == null) return 0;
    return t < 0.06 ? t / 0.06 : t < 0.08 ? 1 : Math.max(0, 1 - (t - 0.08) / 0.1);
  }
  // which face to make, from what the character is doing (masked characters and vampires keep theirs)
  pickEmotion() {
    const n = this.npc, b = n.brain, ls = n.lifeState;
    if (this.hstyle || ls === 'vampire' || (n.vamp && n.vamp.state === 'turning')) return null;
    if (ls === 'dead' || ls === 'destroyed' || ls === 'reanimating') return 'slack';
    if (ls === 'zombie') {
      const a = this.action, at = a && !a.ending ? a.type : '';
      return at === 'bite' || at === 'scratch' || at === 'gutpunch' || at === 'notice' || at === 'feed' || (b && (b.state === 'zChase' || b.state === 'zGrab' || b.state === 'zPile')) ? 'snarl' : 'blank';
    }
    if (!b) return 'neutral';
    const st = b.state;
    if (n.grabbedBy || st === 'grabbed') return 'terror';
    if (n.cond && n.cond.state === 'unconscious') return 'slack';               // V1.15: out cold
    if (n.cond && (n.cond.state === 'waking' || n.cond.state === 'dazed') || st === 'dazed') return n.physMode === 'anim' ? 'tired' : 'pain';
    if (st === 'hurt' || st === 'seek' || n.physMode !== 'anim') return 'pain';
    if (st === 'flee' || st === 'cower' || st === 'handsUp' || st === 'dodge' || st === 'hide' || b.mesmerT > 0) return 'fear';
    if (st === 'help' || st === 'call') return 'worried';
    if (st === 'react') return 'surprise';
    if (st === 'fight') return 'angry';
    if (st === 'chat') return 'friendly';
    if (st === 'inspect') return 'disgust';
    if (b.puzzledT > 0) return 'confused';
    // infection: a wince with each bout of discomfort, then tired, then plainly ill
    const sk = this.sick || 0;
    if (sk > 0.01 && this.action && this.action.type === 'ill' && !this.action.ending) return sk < 0.3 ? 'discomfort' : 'ill';
    if (sk > 0.5) return 'ill';
    if (sk > 0.3) return 'tired';
    if (sk > 0.12) return 'sick';
    if (n.fear > 0.35) return 'worried';
    return 'neutral';
  }
  // blend toward the emotion's face; a startle (surprise) comes first when fear arrives out of calm
  updateExpression(dt) {
    const E = this.expr || (this.expr = { v: [0, 0, 0, 0, 0, 0, 0], tv: [0, 0, 0, 0, 0, 0, 0], cur: 'neutral', startle: 0, microT: 2 + Math.random() * 4, microK: 0, micro: 0, syl: 0, sylA: 0 });
    const em = this.pickEmotion();
    if (em !== E.cur) {
      if ((em === 'fear' || em === 'terror') && (E.cur === 'neutral' || E.cur === 'friendly' || E.cur === 'worried' || E.cur === 'confused')) E.startle = 0.45;
      E.cur = em;
    }
    if (E.startle > 0) E.startle -= dt;
    const T = E.startle > 0 ? EXPRESSIONS.surprise : (em ? EXPRESSIONS[em] : null), tv = E.tv;
    for (let i = 0; i < 7; i++) tv[i] = T ? T[i] : 0;
    // life in a calm face: a brief brow flash or a drifting half-smile now and then
    if (em === 'neutral' || em === 'friendly') {
      E.microT -= dt;
      if (E.microT <= 0) { E.microT = 2.5 + Math.random() * 5.5; E.micro = Math.random(); E.microK = 0.5 + Math.random() * 0.9; }
      if (E.microK > 0) { E.microK -= dt; const w = Math.min(1, E.microK * 3); if (E.micro < 0.35) tv[0] += 0.5 * w; else if (E.micro < 0.75) tv[2] += 0.3 * w; else tv[3] += (E.micro < 0.87 ? 0.35 : -0.35) * w; }
    }
    // talking: syllables on the jaw, short pauses between words, emphasis on the brows and lips
    let tj = 0, pk = 0;
    if (this.talking && em) {
      // V1.12 mouth shapes per syllable: closed (m/b/p), open (a), rounded (o/u, lips pushed forward), wide (e/i)
      E.syl -= dt;
      if (E.syl <= 0) {
        E.syl = 0.08 + Math.random() * 0.15; const r = Math.random();
        E.vis = r < 0.18 ? 0 : r < 0.42 ? 2 : r < 0.75 ? 1 : 3;
        E.sylA = E.vis === 0 ? 0 : E.vis === 1 ? 0.06 + Math.random() * 0.08 : E.vis === 2 ? 0.035 + Math.random() * 0.03 : 0.025 + Math.random() * 0.035;
        if (Math.random() < 0.12) tv[0] += 0.4;
      }
      tj = E.sylA; pk = E.vis === 2 ? 0.85 : 0;
      tv[4] += E.vis === 3 ? 0.7 : E.vis === 2 ? -0.3 : E.sylA * 1.6;
    }
    this.talkJaw = damp(this.talkJaw || 0, tj, 26, dt);
    E.pk = damp(E.pk || 0, pk, 22, dt);
    const k = 1 - Math.exp(-dt * (E.startle > 0 ? 18 : 6.5));
    for (let i = 0; i < 7; i++) E.v[i] += (tv[i] - E.v[i]) * k;
    const u = this.npc.material && this.npc.material.userData.u;
    if (u && u.uExpr) { u.uExpr.value.set(E.v[0], E.v[1], E.v[2], E.v[3]); u.uExpr2.value.x = E.v[4]; u.uExpr2.value.y = E.pk || 0; }
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
    const gp = !zs && this.gait ? this.gait : null; // character gait profile (vampire styles, doll, slasher)
    let stride = lg * (0.78 + 0.6 * Math.min(spd, 6)) * (gp ? gp.stride : 1);
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
    const toeOut = zs ? lerp(0.07, zs.toeOut, zomb) : (gp ? gp.toeOut : 0.075);
    const mirror = this.zMirror;
    const limpShift = zs ? zs.limp * 0.07 * zomb * (mirror ? -1 : 1) : 0;
    // --- per-foot ground track (world) -----------------------------------------------
    for (let s = 0; s < 2; s++) {
      const f = this.feet[s], sg = SIDE_SIGN[s];
      const zi = s ^ mirror;
      const drag = zs ? zs.drag[zi] * zomb : 0, stiff = zs ? zs.stiff[zi] * zomb : 0;
      const duty = clamp(duty0 + (zs ? (zi ? -1 : 1) * zs.limp * 0.1 * zomb : 0) - this.limp[s] * 0.08 + this.limp[1 - s] * 0.05, 0.3, 0.78);
      f.duty = duty; f.drag = drag; f.stiff = stiff;
      const lat = this.stance * 0.5 * lerp(0.66, 0.42, run) * (zs ? lerp(1, zs.width, zomb) : (npc.app.male ? 1 : 0.8)) * (gp ? gp.width : 1);
      const idealX = root.pos.x + cy * sg * lat, idealZ = root.pos.z - sy * sg * lat;
      const hsP = gp && gp.hs != null ? lerp(gp.hs, -0.1, run) : lerp(-0.26, -0.1, run) * (1 - drag) * (1 - stiff * 0.6);
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
    const rotA = lerp(0.075, 0.12, run) * wk * (zs ? lerp(1, 0.55, zomb) : 1) * (1 + fem * 0.15) * (gp ? gp.yaw : 1);
    const pelYaw = -Math.cos(TAU * ph) * rotA;
    const lurch = zs ? zs.lurch * zomb : 0;
    const rollA = (lerp(0.055, 0.03, run) * (1 + fem * 0.35) + lurch * 0.9) * wk * (gp ? gp.roll : 1);
    const pelRoll = Math.sin(TAU * (ph - 0.06)) * rollA;
    const swayA = (lerp(0.024, 0.01, run) * (1 + fem * 0.2) + lurch * 0.55) * wk * (gp ? gp.sway : 1);
    let sway = moving ? Math.sin(TAU * (ph - 0.04)) * swayA : this.weightShift * 0.035;
    if (zs && !moving) sway += Math.sin(this.time * 1.25 + mirror) * 0.03 * zomb * (zs.wobble ? 1.8 : 1);
    const hunch = zs ? zs.hunch * zomb : 0;
    const lean = (0.035 + 0.13 * run) * pers.leanMul + hunch * 0.25 + (gp ? gp.lean : 0);
    const zRoll = zs ? zs.roll * zomb * (mirror ? -1 : 1) : 0;
    P.hipsOff.set(sway, 0, 0);
    P.hipsRot.set(lean * 0.5 + 0.02 + this.accLean * 0.5, pelYaw, pelRoll + (moving ? 0 : -this.weightShift * 0.05) + zRoll * 0.4 + this.bank * 0.5);
    P.spine.set(lean * 0.35 + pers.slouch * 0.5 + hunch * 0.45 + this.accLean * 0.35, -pelYaw * 0.85, -pelRoll * 0.6 + zRoll * 0.4 + this.bank * 0.3);
    P.chest.set(lean * 0.2 + pers.slouch * 0.4 + hunch * 0.45, -pelYaw * 0.85, -pelRoll * 0.4 + zRoll * 0.3 - lurch * Math.sin(TAU * (ph - 0.1)) * 0.8 * wk);
    // head: stabilised for the living, lolling for the dead
    const trunkPitch = P.hipsRot.x + P.spine.x + P.chest.x;
    const chestYaw = pelYaw * (1 - 0.85 - 0.85);
    if (zs) {
      const loll = zs.headLoll * zomb, zv = this.zvar;
      // each zombie's own stance: a head tilt, one shoulder dropped, a little extra hunch
      if (zv && zv.hunch != null) { P.spine.x += zv.hunch * zomb * 0.5; P.chest.x += zv.hunch * zomb * 0.5; P.chest.z += zv.drop * zomb; }
      // turning: the head swings round first, the shoulders follow, the hips come last
      const yr = clamp(this.yawRate || 0, -3, 3) * zomb;
      P.chest.y += yr * 0.07; this.turnLead = damp(this.turnLead || 0, yr * 0.14, 6, dt);
      P.neck.set(-trunkPitch * 0.25 + loll * 0.3, -chestYaw * 0.5, 0);
      P.head.set(-trunkPitch * 0.25 + loll * 0.45 + pers.headTilt, -chestYaw * 0.5 + Math.sin(this.time * 0.9) * loll * 0.25 + (this.turnLead || 0), (mirror ? -1 : 1) * loll * 0.35 + Math.sin(this.time * 0.63) * loll * 0.3 + (zv && zv.tilt ? zv.tilt * zomb : 0));
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
    if (gp) { // glide (smooth, little bob) or bounce (exaggerated) around the running average height
      this.hipAvg = damp(this.hipAvg == null ? P.hipsOff.y : this.hipAvg, P.hipsOff.y, 2.5, dt);
      P.hipsOff.y = this.hipAvg + (P.hipsOff.y - this.hipAvg) * gp.bob;
      // heavy heel strikes: a short dip of the whole body as each foot lands
      if (gp.heavy && moving) for (let s = 0; s < 2; s++) { const f = this.feet[s]; if (!f.swing && f.landT < 0.18) P.hipsOff.y -= Math.sin(Math.PI * f.landT / 0.18) * 0.016 * gp.heavy * clamp(spd, 0, 2); }
    }
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
        const Hl = lg * lerp(0.17, 0.36, run) * pers.stepLift * (1 - f.drag * 0.88) * (1 - f.stiff * 0.7) * (1 - 0.45 * this.limp[s]) * (zs ? lerp(1, 0.75, zomb) : 1) * (gp ? gp.stepH : 1);
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
        const amp = lerp(0.2, 0.3, run) * pers.armSwing * clamp(spd / 1.3, 0, 1.15) * (gp ? gp.arm : 1);
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
    const f01 = clamp((c.t - k0.t) / (k1.t - k0.t), 0, 1), t = c.linear ? f01 : smooth01(f01);
    const rig = this.rig, H = rig.H, Lg = rig.legLen;
    // root motion (vampire board rise): the root slides forward under the pivoting body
    let rz = 0;
    if (k0.rz != null) {
      rz = lerp(k0.rz, k1.rz, t) * Lg;
      const d = rz - (c.rzPrev || 0); c.rzPrev = rz;
      root.pos.x += Math.sin(root.yaw) * d; root.pos.z += Math.cos(root.yaw) * d;
      root.pos.y = env.groundHeight(root.pos.x, root.pos.z);
    }
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
    if (c.vrise) { // the hands slowly flex and the jaw parts as the eyes ignite
      const k = clamp(c.t / c.dur, 0, 1);
      for (let s = 0; s < 2; s++) { Pc.hand[s].fing = 0.25 + 0.5 * smoothstep(0.05, 0.3, k) * (1 - smoothstep(0.85, 1, k)); Pc.hand[s].thumb = Pc.hand[s].fing * 0.8; }
      Pc.jaw = 0.04 + 0.2 * Math.sin(Math.PI * smoothstep(0.08, 0.6, k));
    }
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
    else if (a.type === 'zidle') this.poseZIdle(Pc, a, root);
    else if (a.type === 'vbite') this.poseVBite(Pc, a, root, dt);
    else if (a.type === 'vbiteDown') this.poseVBiteDown(Pc, a, root, dt);
    else if (a.type === 'drained') this.poseDrained(Pc, a, root, dt);
    else if (a.type === 'vturn') this.poseVTurn(Pc, a, root);
    else if (a.type === 'vhiss') this.poseVHiss(Pc, a, root);
    else if (a.type === 'vwipe') this.poseVWipe(Pc, a, root);
    else if (a.type === 'vidle') this.poseVIdle(Pc, a, root);
    else if (a.type === 'hlaugh') this.poseHLaugh(Pc, a, root);
    else if (a.type === 'gutpunch') this.poseGutPunch(Pc, a, root, dt);
    else if (a.type === 'gutted') this.poseGutted(Pc, a, root, dt);
    else if (a.type === 'ill') this.poseIll(Pc, a, root, dt);
    else if (a.type === 'sit') this.poseSit(Pc, a, root, dt);
    else if (a.type === 'tend') this.poseTend(Pc, a, root, dt);
    else if (a.type === 'ridehold') this.poseRideHold(Pc, a, root, dt);
    else if (a.type === 'htilt') this.poseHTilt(Pc, a, root);
    else if (a.type === 'hidle') this.poseHIdle(Pc, a, root);
    else if (a.type === 'didle') this.poseDIdle(Pc, a, root);
    else if (a.type === 'dinspect') this.poseDInspect(Pc, a, root);
    else if (a.type === 'dinject') this.poseDInject(Pc, a, root);
    else if (a.type === 'dtrigger') this.poseDTrigger(Pc, a, root);
    else if (a.type === 'drecall') this.poseDRecall(Pc, a, root);
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
    ha.fing = a.grip ? 0.97 : clipSample(K, u, 'fa'); ha.thumb = a.grip ? 0.9 : ha.fing * 0.8;
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
      else if (a.variant === 'pileBack') tb = v.boneWPos[SB('upperarm', s)];               // from behind: both shoulders
      else if (a.variant === 'pileSide') tb = s === 0 ? v.boneWPos[SB('upperarm', a.vs)] : v.boneWPos[SB('forearm', a.vs)]; // one side: arm
      else tb = v.boneWPos[SB('upperarm', 1 - s)];
      this.toRoot(tb, root, _va);
      const hp = P.hand[s];
      const rest = this.armPose('reach', s);
      hp.pos.copy(rest.pos); hp.posR.copy(_va); hp.posR.y -= 0.02; hp.posR.z -= 0.02; hp.space = reach;
      hp.pole.set(SIDE_SIGN[s], -0.7, -0.25); hp.pron = -0.9; hp.flex = 0.55; hp.fing = lerp(0.5, 0.92, reach); hp.thumb = hp.fing * 0.8;
    }
    const bp = a.variant === 'arm' ? v.boneWPos[SB('forearm', 1)] : a.variant === 'shoulder' ? v.boneWPos[SB('clavicle', 1)]
      : a.variant === 'pileBack' ? v.boneWPos[B.neck] : a.variant === 'pileSide' ? v.boneWPos[SB('upperarm', a.vs)] : v.boneWPos[B.neck];
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
    if (a.modeT <= 0) {
      a.prevMode = a.mode || 'push';
      const brave = this.npc.personality.bravery, pool = brave < 0.3 ? ['freeze', 'freeze', 'push', 'pull'] : brave > 0.7 ? ['shove', 'push', 'pull', 'block'] : ['push', 'pull', 'push', 'block', 'freeze', 'shove'];
      a.mode = a.forceMode || pool[Math.floor(Math.random() * pool.length)]; a.modeT = 0.7 + Math.random() * 0.8; a.mw = 0;
    }
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
      if (m === 'freeze') { // paralysed with fear: hands half-raised near the chest, shaking, face turned away
        for (let s = 0; s < 2; s++) { const hp = Q.hand[s], g2 = this.armPose('cover', s); g2.pos.y -= 0.25 * this.L; g2.pos.z -= 0.08 * this.L; hp.copy(g2); hp.pos.x += Math.sin(t * 31 + s) * 0.008; hp.fing = 0.7; }
        Q.chest.x += 0.08; Q.spine.x += 0.04; Q.head.x += 0.12; Q.hipsOff.y -= 0.03 * this.rig.legLen;
      }
      if (m === 'shove') { // both palms flat on the attacker's chest, arms locked, leaning back hard
        for (let s = 0; s < 2; s++) { const hp = Q.hand[s]; this.toRoot(z.boneWPos[B.chest], root, _va); hp.posR.copy(_va); hp.posR.x += SIDE_SIGN[s] * 0.11; hp.posR.z -= 0.02; hp.space = 1; hp.pron = -1.5; hp.flex = -1.0; hp.fing = 0.05; }
        Q.chest.x -= 0.22; Q.spine.x -= 0.12; Q.hipsOff.z -= 0.08;
      }
      if (a.armBite) { // the bitten forearm is dragged to the zombie's mouth; the free hand shoves at its face
        const ha = Q.hand[1]; this.toRoot(z.boneWPos[B.jaw], root, _va); ha.posR.copy(_va); ha.posR.y -= 0.05; ha.space = 1; ha.pron = -0.4; ha.fing = 0.5;
        const hf = Q.hand[0]; this.toRoot(z.boneWPos[B.head], root, _va); hf.posR.copy(_va); hf.posR.x += 0.05; hf.space = 1; hf.pron = -1.4; hf.flex = -0.8; hf.fing = 0.1;
        Q.chest.y -= away * 0.2;
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
    const sitBack = mode === 'chew' ? 1 : 0, S = H / 1.75;
    // where the mouth has to go (root space): the bite point, lifted off it between bites
    let tz = 0.42 * S, ty = 0.18;
    if (a.point) { this.toRoot(a.point, root, _va); tz = _va.z; ty = _va.y; }
    const tearUp = mode === 'tear' ? smooth01(Math.max(0, cyc - 0.4) / 0.3) * 0.12 : 0;
    const my = ty + 0.04 + (mode === 'chew' ? 0.32 : (1 - dip) * 0.09 + tearUp) + (mode === 'lean' ? 0.05 : 0);
    // a body down on the floor: sit back on the heels and fold over it (hands down, back arched)
    const low = clamp((0.42 * S - ty) / (0.22 * S), 0, 1);
    const hipJ = lerp(rig.thighLen * 0.82 + 0.07, rig.thighLen * 0.38 + 0.09 * S, Math.max(low, sitBack * 0.6));
    const hz = -0.06 - 0.08 * low - sitBack * 0.05, hy = hipJ + 0.035 * H;
    P.hipsOff.set(0, hy - rig.hipsHeight, hz);
    // reach: solve the torso pitch (shared by pelvis, spine, chest) and the neck bend so the mouth
    // meets the point, along the real spine segments (warm-started from last frame, a few Newton steps)
    const bp = rig.bindPos, l0 = bp[B.spine].y - bp[B.hips].y, l1 = bp[B.chest].y - bp[B.spine].y, l2 = bp[B.neck].y - bp[B.chest].y, l3 = bp[B.head].y - bp[B.neck].y;
    const mf = 0.09 * S, mu = -0.06 * S, wH = 0.33, wS = 0.3, F = _feedFK;
    const fk = (th, ph, o) => {
      const a0 = th * wH, a1 = a0 + th * wS, a2 = th, a3 = th + ph * 0.45, a4 = th + ph;
      o[0] = hz + l0 * Math.sin(a0) + l1 * Math.sin(a1) + l2 * Math.sin(a2) + l3 * Math.sin(a3) + mu * Math.sin(a4) + mf * Math.cos(a4);
      o[1] = hy + l0 * Math.cos(a0) + l1 * Math.cos(a1) + l2 * Math.cos(a2) + l3 * Math.cos(a3) + mu * Math.cos(a4) - mf * Math.sin(a4);
    };
    let th = a.rth != null ? a.rth : 1.0, ph = a.rph != null ? a.rph : 0.6;
    for (let it = 0; it < 5; it++) {
      fk(th, ph, F[0]); const ez = tz - F[0][0], ey = my - F[0][1];
      if (ez * ez + ey * ey < 1e-6) break;
      fk(th + 0.01, ph, F[1]); fk(th, ph + 0.01, F[2]);
      const j11 = (F[1][0] - F[0][0]) * 100, j21 = (F[1][1] - F[0][1]) * 100, j12 = (F[2][0] - F[0][0]) * 100, j22 = (F[2][1] - F[0][1]) * 100;
      const det = j11 * j22 - j12 * j21; if (Math.abs(det) < 1e-5) break;
      let dth = (j22 * ez - j12 * ey) / det, dph = (-j21 * ez + j11 * ey) / det;
      const m = Math.max(Math.abs(dth), Math.abs(dph)); if (m > 0.35) { dth *= 0.35 / m; dph *= 0.35 / m; }
      th = clamp(th + dth, 0, 1.8); ph = clamp(ph + dph, -0.2, 1.6);
    }
    a.rth = th; a.rph = ph;
    P.hipsRot.set(th * wH, 0, Math.sin(t * 0.9) * 0.04);
    P.spine.set(th * wS, Math.sin(t * 0.7) * 0.05, mode === 'lean' ? 0.12 : 0);
    P.chest.set(th * (1 - wH - wS), mode === 'chew' ? Math.sin(t * 0.8) * 0.15 : 0, Math.sin(t * 1.3) * 0.04);
    P.neck.set(ph * 0.45, 0, 0);
    P.head.set(ph * 0.55, (cyc > 0.3 && cyc < 0.5 && mode !== 'chew') ? Math.sin(t * 36) * 0.18 : (mode === 'chew' ? Math.sin(t * 1.1) * 0.5 : 0), 0.1);
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
  // standing-zombie idles: unsteady sway, lolling head, sniffing the air, reaching at nothing, shudder
  poseZIdle(P, a, root) {
    const t = a.t, u = clamp(t / (a.dur || 3), 0, 1), env = Math.sin(Math.PI * u), ph = a.ph || 0;
    if (a.mode === 'sway') {
      const sw = Math.sin(t * 1.25 + ph);
      P.hipsOff.x += sw * 0.035 * env; P.hipsRot.z += sw * 0.05 * env; P.spine.z -= sw * 0.07 * env; P.chest.z -= sw * 0.05 * env;
      P.head.z += Math.sin(t * 0.9 + ph + 1) * 0.18 * env; P.head.x += 0.08 * env;
    } else if (a.mode === 'loll') {
      P.head.x += 0.35 * env; P.neck.x += 0.15 * env; P.head.z += Math.sin(t * 0.55 + ph) * 0.3 * env; P.head.y += Math.sin(t * 0.37 + ph) * 0.25 * env;
      P.jaw = Math.max(P.jaw, 0.18 * env);
    } else if (a.mode === 'sniff') {
      P.head.x -= 0.3 * env; P.neck.x -= 0.15 * env; P.chest.x -= 0.05 * env;
      P.head.y += Math.sin(t * 1.6 + ph) * 0.45 * env; P.jaw = Math.max(P.jaw, (0.12 + 0.15 * Math.max(0, Math.sin(t * 7))) * env);
    } else if (a.mode === 'reach') {
      const s = a.side || 0, hp = P.hand[s], k = smooth01(Math.min(1, u * 2.2)) * (1 - smooth01(Math.max(0, (u - 0.7) / 0.3)));
      hp.pos.lerp(this.armPose('reach', s).pos, k * 0.85); hp.fing = lerp(hp.fing, 0.75, k);
      P.chest.y += SIDE_SIGN[s] * 0.12 * k; P.head.x -= 0.1 * k;
    } else if (a.mode === 'twitch') { // sudden jerks of the head and a shoulder, at uneven intervals
      const pulse = Math.pow(Math.max(0, Math.sin(t * 3.1 + ph) * Math.sin(t * 1.7 + ph * 2)), 6);
      P.head.y += pulse * 0.5 * Math.sign(Math.sin(ph * 5 + Math.floor(t * 1.3))) * env; P.head.z += pulse * 0.3 * env;
      P.clav[a.side || 0].z += pulse * 0.35 * env; P.chest.z += pulse * 0.06 * env;
    } else if (a.mode === 'chatter') { // the jaw working, teeth knocking, the head trembling
      P.jaw = Math.max(P.jaw, (0.08 + Math.abs(Math.sin(t * 13 + ph)) * 0.16) * env);
      P.head.y += Math.sin(t * 17 + ph) * 0.04 * env; P.head.x += 0.06 * env;
    } else if (a.mode === 'stagger') { // a lurch to one side and the catch
      const d = (a.side ? 1 : -1), k = Math.sin(Math.PI * clamp(u * 1.6, 0, 1));
      P.hipsOff.x += d * 0.06 * k; P.hipsRot.z += d * 0.08 * k; P.spine.z -= d * 0.12 * k; P.chest.z -= d * 0.08 * k; P.head.z += d * 0.2 * k;
      for (let s = 0; s < 2; s++) { const hp = P.hand[s]; hp.pos.lerp(this.armPose('flail', s).pos, k * (SIDE_SIGN[s] === d ? 0.6 : 0.3)); }
    } else if (a.mode === 'scratch') { // slow scratching at its own forearm
      const s = a.side || 0, hp = P.hand[s], o = P.hand[1 - s];
      this.chestLocal(SB('forearm', 1 - s), -SIDE_SIGN[s] * 0.02, -0.03, 0.06, _va);
      hp.pos.lerp(_va, env); hp.pos.y += Math.sin(t * 7 + ph) * 0.015 * env; hp.fing = lerp(hp.fing, 0.6 + 0.3 * Math.sin(t * 7), env);
      o.pos.lerp(this.armPose('hang', 1 - s).pos, 0.4 * env); o.pos.z += 0.12 * env;
      P.head.x += 0.22 * env; P.head.y += SIDE_SIGN[1 - s] * 0.2 * env;
    } else if (a.mode === 'lookround') { // a slow scan of the surroundings, head leading the shoulders
      const sw = Math.sin(t * 0.7 + ph);
      P.head.y += sw * 0.7 * env; P.neck.y += sw * 0.25 * env; P.chest.y += sw * 0.15 * env; P.head.x -= 0.08 * env;
    } else { // shudder
      const j = Math.sin(t * 31 + ph) * Math.max(0, Math.sin(t * 2.3 + ph));
      P.chest.x += j * 0.06 * env; P.head.y += j * 0.2 * env; P.head.z += j * 0.1 * env; P.hipsOff.x += j * 0.01 * env;
      for (let s = 0; s < 2; s++) P.hand[s].fing = clamp(P.hand[s].fing + Math.sin(t * 23 + s * 2) * 0.3 * env, 0, 1);
    }
  }
  // infected body seizing on the ground before it turns (used while ragdolled via springs too)
  poseConvulse(P, a, root) {
    const t = a.t;
    P.chest.x += Math.sin(t * 23) * 0.12; P.head.y += Math.sin(t * 31) * 0.3; P.head.x += Math.sin(t * 17) * 0.2;
    for (let s = 0; s < 2; s++) { const hp = P.hand[s]; hp.pos.y += Math.sin(t * 27 + s * 3) * 0.08; hp.fing = 0.5 + 0.5 * Math.sin(t * 19 + s); }
    P.jaw = 0.2 + Math.abs(Math.sin(t * 21)) * 0.25;
  }
  // ============================== vampires ==============================================
  // style posture over the human gait: crouch/hunch with a level, fixed gaze; arms by style
  applyVampPosture(P, dt, root) {
    const st = this.vstyle || VAMP_STYLES.aristocrat, w = this.vamp, lg = this.rig.legLen, L = this.L;
    const run = this.runBlend || 0, spd = this.speed, moving = this.moving;
    this.vStalk = damp(this.vStalk, this.vStalkTarget, 3, dt);
    const stalk = this.vStalk;
    const crouch = Math.max(0, st.crouch + stalk * 0.06) * (1 - run * 0.6);
    const hunch = (st.hunch + stalk * 0.16) * (1 - run * 0.4);
    P.hipsOff.y -= crouch * lg * w; P.hipsOff.z -= crouch * 0.3 * lg * w;
    const pel = (crouch * 0.7 + run * 0.14) * w;
    P.hipsRot.x += pel; P.spine.x += (hunch * 0.5 + run * 0.08) * w; P.chest.x += hunch * 0.45 * w;
    // the head stays level, locked forward: a predator's gaze
    const trunk = pel + (hunch * 0.95 + run * 0.08) * w;
    P.neck.x -= trunk * 0.38; P.head.x -= trunk * 0.42;
    if (st.hunch < 0) P.head.x -= 0.04 * w; // aristocrat: chin up
    // feral twitch of the head
    if (st.twitch) { this.vTwT = (this.vTwT || 0) - dt; if (this.vTwT <= 0) { this.vTwT = 0.6 + Math.random() * 2.2; this.kick(B.head, _va.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6)); } }
    const act = this.action, aw = w * (1 - (act && act.type !== 'vidle' ? smooth01(act.w) : 0));
    if (aw < 0.01) return;
    const swing = (s) => moving ? (s === 0 ? -1 : 1) * Math.cos(TAU * this.phase) : 0;
    for (let s = 0; s < 2; s++) {
      const sg = SIDE_SIGN[s], hp = P.hand[s];
      let tgt, k = 1;
      if (st.arms === 'behind') {        // hands clasped at the small of the back (in front under a cape); a full arm drive at a sprint
        k = 1 - smoothstep(1.9, 3.4, spd);
        if (this.npc.app.cape) { tgt = this.armPose('clasp', s); tgt.pos.z += 0.03 * L; } else { tgt = this.armPose('behind', s); tgt.pos.y += 0.06 * L; }
        tgt.fing = 0.45;
      } else if (st.arms === 'claw') {   // hands low and forward, fingers hooked, wrists cocked
        tgt = this.armPose('hang', s);
        const sw = swing(s);
        tgt.pos.z += (0.2 + sw * 0.18 * clamp(spd / 2, 0, 1)) * L; tgt.pos.y += (0.1 + Math.max(0, sw) * 0.12 + run * 0.12) * L; tgt.pos.x += sg * 0.07 * L;
        tgt.fing = 0.62 + 0.25 * Math.sin(this.time * 4.3 + s * 2); tgt.thumb = 0.55; tgt.flex = -0.45; tgt.pron = -0.3;
      } else {                           // 'low': loose arms carried slightly forward, fingers curled
        tgt = this.armPose('hang', s);
        const sw = swing(s);
        tgt.pos.z += (0.12 + sw * (0.08 + run * 0.26) * clamp(spd / 1.5, 0, 1)) * L; tgt.pos.y += (0.04 + Math.max(0, sw) * run * 0.22) * L; tgt.pos.x += sg * 0.03 * L;
        tgt.fing = 0.72; tgt.thumb = 0.5; tgt.flex = 0.25; tgt.pron = 0.15;
      }
      hp.lerp(tgt, aw * k);
    }
  }
  // chest-space landmark from the bind pose (throat, mouth)
  chestLocal(bone, x, y, z, out) {
    const r = this.rig, c = r.bindPos[B.chest], b = r.bindPos[bone], H = r.H;
    return out.set(b.x - c.x + x * H, b.y - c.y + y * H, b.z - c.z + z * H);
  }
  // standing bite: seize the victim, tilt into the neck, sink the fangs (snap event), then drink
  poseVBite(P, a, root, dt) {
    const v = a.target, t = a.t, side = a.side || 0, behind = a.variant === 'behind';
    const strike = t < 0.3 ? 0 : (t < 0.48 ? smooth01((t - 0.3) / 0.18) : 1);
    if (!a.snapped && t >= 0.46) { a.snapped = true; a.snapEvent = true; }
    const drink = a.snapped ? 1 : 0, gulp = Math.max(0, Math.sin(t * 4.6)) * drink;
    P.hipsRot.x += 0.05; P.spine.x += 0.06 + strike * 0.04; P.chest.x += 0.07 + strike * 0.07;
    if (v && !v.removed) {
      const vy = v.root.yaw, vsx = Math.cos(vy) * SIDE_SIGN[side], vsz = -Math.sin(vy) * SIDE_SIGN[side];
      const nk = v.boneWPos[B.neck], hd = v.boneWPos[B.head];
      const bp = _vb.set(nk.x * 0.55 + hd.x * 0.45 + vsx * 0.045, nk.y * 0.55 + hd.y * 0.45 - 0.01, nk.z * 0.55 + hd.z * 0.45 + vsz * 0.045);
      if (!behind) { bp.x += Math.sin(vy) * 0.02; bp.z += Math.cos(vy) * 0.02; }
      for (let s = 0; s < 2; s++) {
        const hp = P.hand[s];
        // front: one hand cradles the head (tilting it away), the other grips the shoulder; behind: both shoulders
        let tb;
        if (behind) tb = v.boneWPos[SB('upperarm', s)];
        else tb = s === side ? v.boneWPos[B.head] : v.boneWPos[SB('upperarm', side)];
        this.toRoot(tb, root, _va);
        if (!behind && s === side) { _va.x += SIDE_SIGN[s] * 0.06; _va.y += 0.02; _va.z -= 0.02; }
        else { _va.y -= 0.03; _va.z -= 0.02; _va.x += SIDE_SIGN[s] * 0.03; }
        hp.posR.copy(_va); hp.space = smooth01(Math.min(1, t / 0.32));
        hp.pole.set(SIDE_SIGN[s], -0.7, -0.3); hp.pron = -0.9; hp.flex = 0.35; hp.fing = lerp(0.4, 0.9, hp.space); hp.thumb = hp.fing * 0.8;
      }
      this.aimHead(P, root, bp, 0.55 + 0.4 * strike);
      // tilt the head along the neck; swallowing pulses once the fangs are in
      P.head.z += (behind ? -1 : 1) * SIDE_SIGN[side] * 0.3 * strike;
      P.neck.x += gulp * 0.05; P.head.x += gulp * 0.04;
    } else if (a.point) { // lunge at a point (the player): both hands reach, the head darts in
      for (let s = 0; s < 2; s++) {
        const hp = P.hand[s], r = this.armPose('reach', s);
        r.pos.y += 0.12 * this.L; r.pos.x -= SIDE_SIGN[s] * 0.08 * this.L; r.fing = 0.8; r.flex = 0.3;
        hp.lerp(r, smooth01(Math.min(1, t / 0.3)));
      }
      this.aimHead(P, root, a.point, 0.7);
      P.head.z += SIDE_SIGN[side] * 0.25 * strike;
      P.hipsOff.z += strike * 0.08 * (1 - smoothstep(0.7, 1.4, t));
    }
    P.jaw = t < 0.3 ? lerp(0.05, 0.55, smooth01(t / 0.3)) : (t < 0.5 ? lerp(0.55, 0.16, smooth01((t - 0.3) / 0.2)) : 0.16 + gulp * 0.05);
    P.look = 0;
  }
  // kneeling bite on someone lying on the ground: kneel at the shoulder, bend over the neck
  poseVBiteDown(P, a, root, dt) {
    const rig = this.rig, H = rig.H, t = a.t;
    const strike = t < 0.55 ? smooth01(t / 0.55) : 1;
    if (!a.snapped && t >= 0.6) { a.snapped = true; a.snapEvent = true; }
    const gulp = a.snapped ? Math.max(0, Math.sin(t * 4.6)) : 0;
    const hipJ = rig.thighLen * 0.8 + 0.07;
    P.hipsOff.set(0, hipJ + 0.035 * H - rig.hipsHeight, -0.05);
    P.hipsRot.set(0.48, 0, 0);
    P.spine.set(0.4 + strike * 0.1, 0, 0); P.chest.set(0.32 + strike * 0.14, 0, 0); P.neck.set(0.1, 0, 0); P.head.set(0.05, 0, 0);
    for (let s = 0; s < 2; s++) {
      const sg = SIDE_SIGN[s], fp = P.foot[s];
      fp.pos.set(sg * rig.hipHalf * 1.15, rig.ankleY * 0.3 + 0.1, -rig.shinLen * 0.86);
      fp.pitch = 1.25; fp.yaw = 0; fp.roll = 0; fp.pole.set(sg * 0.15, -0.5, 1);
      const hp = P.hand[s], tgt = s === 0 ? a.chest : a.ground;
      if (tgt) { this.toRoot(tgt, root, _va); hp.posR.copy(_va); hp.posR.y += 0.03; hp.space = smooth01(Math.min(1, t / 0.4)); }
      hp.pole.set(sg, -0.5, -0.5); hp.pron = -1.3; hp.flex = -0.6; hp.fing = 0.35; hp.thumb = 0.3;
    }
    if (a.point) this.aimHead(P, root, a.point, 0.95);
    P.neck.x += gulp * 0.05;
    P.jaw = t < 0.45 ? lerp(0.05, 0.5, smooth01(t / 0.45)) : (t < 0.65 ? lerp(0.5, 0.15, (t - 0.45) / 0.2) : 0.15 + gulp * 0.05);
    P.look = 0;
  }
  // the victim: a brief struggle, then going limp in the grip, head tilted away from the bite
  poseDrained(P, a, root, dt) {
    const vmp = a.target, t = a.t, k = clamp(a.drain || 0, 0, 1), side = a.side || 0, sg = SIDE_SIGN[side];
    const fight = 1 - smoothstep(0.12, 0.55, k);
    P.head.z -= sg * (0.28 + 0.22 * k); P.neck.z -= sg * 0.14; P.head.x += -0.12 * (1 - k) + 0.16 * k;
    P.hipsOff.y -= k * 0.1 * this.rig.legLen; P.hipsOff.z -= k * 0.03; P.spine.x += k * 0.08; P.chest.x += -0.1 * (1 - k) + 0.05 * k;
    P.chest.z += Math.sin(t * 6.3) * 0.06 * fight;
    for (let s = 0; s < 2; s++) {
      const hp = P.hand[s];
      if (fight > 0.02 && vmp && !vmp.removed) {
        if (!a.behind) { this.toRoot(s === 0 ? vmp.boneWPos[B.chest] : vmp.boneWPos[SB('upperarm', 0)], root, _va); _va.x += SIDE_SIGN[s] * 0.06; _va.y -= 0.05 + Math.sin(t * 8 + s * 2) * 0.03; }
        else { this.toRoot(vmp.boneWPos[SB('hand', s)], root, _va); }
        hp.posR.copy(_va); hp.space = fight;
        hp.pole.set(SIDE_SIGN[s], -0.8, -0.3); hp.pron = -1.3; hp.flex = a.behind ? 0.2 : -0.7; hp.fing = a.behind ? 0.7 : 0.2; hp.thumb = 0.3;
      } else hp.space = 0;
      const hang = this.armPose('hang', s);
      hp.pos.lerp(hang.pos, k); hp.fing = lerp(hp.fing, 0.25, k);
    }
    P.jaw = lerp(0.32 + Math.sin(t * 11) * 0.05, 0.1, k);
    if (k > 0.65) this.blink = Math.max(this.blink, 0.05);  // eyes falling shut
    P.look = 0;
  }
  // turning: clutch the throat and double over, arch back with arms flung wide, then settle
  poseVTurn(P, a, root) {
    const t = a.t, u = clamp(t / (a.dur || 4.4), 0, 1), lg = this.rig.legLen, L = this.L;
    const p1 = smoothstep(0.0, 0.1, u) * (1 - smoothstep(0.28, 0.4, u));
    const p2 = smoothstep(0.3, 0.42, u) * (1 - smoothstep(0.6, 0.76, u));
    const p3 = smoothstep(0.66, 0.85, u);
    const shake = Math.sin(t * 23) * 0.035 * (p1 + p2 * 0.6);
    P.hipsOff.y -= (p1 * 0.12 + p2 * 0.03 + p3 * 0.02) * lg;
    P.spine.x += p1 * 0.38 - p2 * 0.22; P.chest.x += p1 * 0.34 - p2 * 0.3 + shake;
    P.neck.x += p1 * 0.18 - p2 * 0.3; P.head.x += p1 * 0.22 - p2 * 0.42 + p3 * 0.08;
    P.head.y += Math.sin(t * 3.1) * 0.18 * p1; P.head.z += shake * 2.5;
    for (let s = 0; s < 2; s++) {
      const sg = SIDE_SIGN[s], hp = P.hand[s];
      this.chestLocal(B.neck, sg * 0.022, 0.035, 0.06, _va);
      hp.pos.lerp(_va, p1); hp.space = 0;
      const sc = this.shoulderC[s];
      _vb.set(sc.x + sg * 0.82 * L, sc.y + 0.32 * L, sc.z + 0.12 * L);
      hp.pos.lerp(_vb, p2);
      hp.pole.set(sg * (1 - p2), -0.6 + p2 * 0.2, -0.5 * p2 - 0.2); hp.pron = lerp(-1.0, -1.5, p2);
      hp.fing = lerp(lerp(0.75, 0.05, p2), 0.6, p3); hp.thumb = hp.fing * 0.7; hp.flex = lerp(0.3, -0.4, p2);
    }
    P.clav[0].z += p2 * 0.15; P.clav[1].z += p2 * 0.15;
    P.jaw = 0.12 * p1 + Math.sin(t * 13) * 0.05 * p1 + 0.62 * p2 + 0.06 * p3;
  }
  // threat display: crouch, shoulders up, clawed hands raised, jaw wide
  poseVHiss(P, a, root) {
    const u = clamp(a.t / (a.dur || 1.1), 0, 1), k = Math.sin(Math.PI * Math.min(1, u * 1.2)), L = this.L;
    P.hipsOff.y -= k * 0.06 * this.rig.legLen; P.chest.x += k * 0.12; P.neck.x -= k * 0.06; P.head.x -= k * 0.14;
    P.head.y += Math.sin(a.t * 17) * 0.035 * k;
    P.clav[0].z += k * 0.22; P.clav[1].z += k * 0.22;
    for (let s = 0; s < 2; s++) {
      const c = this.armPose('claw', s);
      c.pos.y -= 0.12 * L; c.pos.z -= 0.32 * L; c.pos.x += SIDE_SIGN[s] * 0.2 * L;
      c.fing = 0.78; c.thumb = 0.6; c.flex = -0.5;
      P.hand[s].lerp(c, k);
    }
    P.jaw = Math.max(P.jaw, 0.58 * k);
  }
  // after feeding: the back of the hand wipes the mouth
  poseVWipe(P, a, root) {
    const u = clamp(a.t / (a.dur || 1.3), 0, 1), s = a.side || 1, sg = SIDE_SIGN[s], hp = P.hand[s];
    const up = smoothstep(0.0, 0.3, u) * (1 - smoothstep(0.7, 1.0, u)), sw = smoothstep(0.3, 0.7, u);
    this.chestLocal(B.head, sg * lerp(0.05, -0.04, sw), -0.022, 0.085, _va);
    hp.pos.lerp(_va, up); hp.space *= 1 - up;
    hp.pole.set(sg, -1, -0.2); hp.pron = lerp(hp.pron, -1.6, up); hp.flex = lerp(hp.flex, 0.5, up); hp.fing = lerp(hp.fing, 0.6, up);
    P.head.x -= up * 0.12; P.head.y += (sw - 0.5) * 0.25 * up; P.jaw = 0.03;
  }
  // idles: poised scan, cuff adjust, feral crouch, sniffing the air, dead-still stalker
  poseVIdle(P, a, root) {
    const t = a.t, u = clamp(t / (a.dur || 4), 0, 1), env = Math.sin(Math.PI * u), ph = a.ph || 0, L = this.L;
    if (a.mode === 'poised' || a.mode === 'scan') {
      const k = a.mode === 'scan' ? 0.75 : 0.45;
      P.head.y += Math.sin(t * 0.5 + ph) * k * env; P.neck.y += Math.sin(t * 0.5 + ph) * k * 0.35 * env; P.chest.y += Math.sin(t * 0.5 + ph) * 0.06 * env;
    } else if (a.mode === 'adjust') { // straightens a cuff
      const s = a.side || 0, hp = P.hand[s], o = P.hand[1 - s];
      const k = smoothstep(0.05, 0.25, u) * (1 - smoothstep(0.75, 0.95, u));
      const op = this.armPose('hang', 1 - s); op.pos.set(-SIDE_SIGN[s] * 0.02, -0.12 * L - 0.1, 0.32 * L); op.pron = -1.3; op.fing = 0.3;
      o.lerp(op, k);
      _va.set(op.pos.x + SIDE_SIGN[s] * 0.06, op.pos.y + 0.02, op.pos.z + 0.02);
      hp.pos.lerp(_va, k); hp.space *= 1 - k; hp.fing = lerp(hp.fing, 0.55 + 0.2 * Math.sin(t * 9), k); hp.pron = lerp(hp.pron, -0.6, k);
      P.head.x += 0.28 * k; P.neck.x += 0.1 * k;
    } else if (a.mode === 'crouch') {
      P.hipsOff.y -= 0.1 * this.rig.legLen * env; P.hipsRot.x += 0.12 * env; P.spine.x += 0.14 * env; P.chest.x += 0.08 * env;
      P.neck.x -= 0.16 * env; P.head.x -= 0.2 * env; P.head.z += Math.sin(t * 1.3 + ph) * 0.38 * env;
      for (let s = 0; s < 2; s++) P.hand[s].fing = clamp(P.hand[s].fing + Math.sin(t * 5 + s * 2.4) * 0.3 * env, 0, 1);
    } else if (a.mode === 'sniff') {
      P.head.x -= 0.28 * env; P.neck.x -= 0.12 * env; P.chest.x -= 0.04 * env;
      P.head.y += Math.sin(t * 1.4 + ph) * 0.35 * env + Math.sin(t * 13) * 0.02 * env;
    } else { // 'still': utterly motionless; the head turns in small, deliberate steps
      const step = Math.round(Math.sin(t * 0.55 + ph) * 3) / 3;
      this.vHeadStep = damp(this.vHeadStep || 0, step, 6, 1 / 60);
      P.head.y += this.vHeadStep * 0.32 * env; P.neck.y += this.vHeadStep * 0.1 * env;
    }
  }
  // ============================== zombie gut punch ======================================
  // wind up, drive a fist into the victim's belly (hit event), dig, rip back out (rip event), then eat
  poseGutPunch(P, a, root, dt) {
    const v = a.target, t = a.t, L = this.L, s = 1, sg = SIDE_SIGN[s], sc = this.shoulderC[s];
    const wind = smoothstep(0, 0.35, t) * (1 - smoothstep(0.38, 0.5, t)), thrust = smoothstep(0.38, 0.5, t), rip = smoothstep(1.2, 1.4, t), eat = smoothstep(1.5, 1.8, t);
    if (!a.hitDone && t >= 0.48) { a.hitDone = true; a.hitEvent = true; }
    if (!a.ripDone && t >= 1.26) { a.ripDone = true; a.ripEvent = true; }
    const hp = P.hand[s], ho = P.hand[1 - s];
    // wind-up: fist pulled back by the hip, shoulders turned
    hp.pos.set(sc.x + sg * 0.12 * L, sc.y - 0.62 * L, sc.z - 0.28 * L); hp.space = 0; hp.fing = 0.9; hp.thumb = 0.8; hp.pron = -0.2; hp.flex = 0;
    P.chest.y += sg * 0.32 * wind; P.spine.y += sg * 0.12 * wind; P.chest.x -= 0.05 * wind;
    if (v && !v.removed) {
      // thrust into the abdomen, hold there while digging, then rip back toward the chest
      this.toRoot(v.boneWPos[B.spine], root, _va); _va.y -= 0.02; _va.z -= 0.04;
      const dig = thrust * (1 - rip);
      hp.posR.copy(_va); hp.posR.x += Math.sin(t * 23) * 0.012 * dig; hp.posR.y += Math.sin(t * 17) * 0.01 * dig;
      hp.space = dig; hp.pron = lerp(-0.2, -1.2, thrust); hp.flex = lerp(0, 0.5, dig); hp.fing = lerp(0.3, 0.95, rip);
      P.chest.y -= sg * 0.22 * thrust * (1 - rip); P.spine.x += 0.07 * dig; P.chest.x += 0.05 * dig; P.hipsOff.z += 0.04 * dig;
      // the other hand grips the victim's shoulder for leverage
      this.toRoot(v.boneWPos[SB('upperarm', s)], root, _va); ho.posR.copy(_va); ho.posR.y -= 0.03; ho.space = smooth01(Math.min(1, t / 0.4)) * (1 - eat);
      ho.pole.set(-sg, -0.7, -0.3); ho.pron = -0.9; ho.fing = 0.9; ho.thumb = 0.8;
      this.aimHead(P, root, v.boneWPos[B.chest], 0.25 * dig + 0.3);
      P.head.y -= sg * 0.25 * dig;   // face turned aside, not buried in the victim's chest
    }
    // pull back and lean away with the prize, then hand to mouth and chew
    if (rip > 0) { const back = _vb.set(sc.x - sg * 0.12 * L, sc.y - 0.18 * L, sc.z + 0.32 * L); hp.pos.copy(back); P.chest.x -= 0.1 * rip * (1 - eat); P.hipsOff.z -= 0.06 * rip; }
    if (eat > 0) { this.chestLocal(B.head, -sg * 0.015, -0.035, 0.07, _vb); hp.pos.lerp(_vb, eat); P.head.x += 0.2 * eat; P.neck.x += 0.1 * eat; }
    P.jaw = 0.12 + 0.25 * thrust * (1 - rip) + (eat > 0 ? Math.max(0, Math.sin(t * 9)) * 0.22 * eat : 0);
    P.look = 0;
  }
  // infection: discomfort, coughing, chills, swaying. Upper body only, so it plays over walking.
  poseIll(P, a, root, dt) {
    const t = a.t, m = a.mode, s = a.side != null ? a.side : 1, sg = SIDE_SIGN[s], hp = P.hand[s], ho = P.hand[1 - s];
    const env = smooth01(Math.min(1, t / 0.35)) * (a.dur ? 1 - smooth01((t - (a.dur - 0.45)) / 0.45) : 1);
    const toward = (h, x) => { h.pos.lerp(x, env); h.space *= 1 - env; };
    if (m === 'temple') { // a headache: fingers pressed to the temple, eyes screwed shut
      toward(hp, this.chestLocal(B.head, sg * 0.045, 0.02, 0.02, _va)); hp.pron = lerp(hp.pron, -1.7, env); hp.flex = lerp(hp.flex, 0.45, env); hp.fing = lerp(hp.fing, 0.3, env);
      P.head.x += 0.16 * env; P.head.z += sg * 0.12 * env; P.neck.x += 0.05 * env;
      this.blink = Math.max(this.blink, 0.03 * env);
    } else if (m === 'stomach') { // nausea: a hand pressed to the belly, curling over it
      toward(hp, this.chestLocal(B.spine, sg * 0.02, -0.01, 0.075, _va)); hp.pron = lerp(hp.pron, -1.2, env); hp.flex = lerp(hp.flex, 0.35, env); hp.fing = lerp(hp.fing, 0.55, env);
      P.spine.x += 0.12 * env; P.chest.x += 0.1 * env; P.head.x += 0.14 * env;
    } else if (m === 'neck') { // rubbing at the bite / the needle mark
      toward(hp, this.chestLocal(B.neck, sg * 0.035, 0.01, 0.015, _va)); hp.pos.y += Math.sin(t * 9) * 0.012 * env; hp.pron = lerp(hp.pron, -1.5, env); hp.fing = lerp(hp.fing, 0.4, env);
      P.head.z -= sg * 0.16 * env; P.head.y -= sg * 0.1 * env;
    } else if (m === 'shiver') { // chills: arms wrapped round the body, a fine tremor
      for (const [h, k] of [[hp, s], [ho, 1 - s]]) { const c = this.armPose('crossed', k); toward(h, c.pos); h.pole.lerp(c.pole, env); h.pron = lerp(h.pron, c.pron, env); h.fing = lerp(h.fing, 0.7, env); }
      const tr = Math.sin(t * 41) * 0.022 * env; P.chest.z += tr; P.neck.z -= tr * 0.7; P.spine.x += 0.06 * env; P.head.x += 0.06 * env;
      P.clav[0].z += 0.12 * env; P.clav[1].z += 0.12 * env;
    } else if (m === 'cough') { // a fist to the mouth, the chest jerking with each cough
      const n = a.n || 2, per = 0.42, ct = (t - 0.22) % per, on = t > 0.22 && t < 0.22 + n * per;
      const k = on ? Math.exp(-ct / 0.09) * smooth01(ct / 0.03) : 0;
      toward(hp, this.chestLocal(B.head, sg * 0.012, -0.04, 0.055, _va)); hp.fing = lerp(hp.fing, 0.95, env); hp.thumb = lerp(hp.thumb, 0.8, env); hp.pron = lerp(hp.pron, -1.4, env); hp.flex = lerp(hp.flex, 0.55, env);
      P.spine.x += (0.05 + 0.12 * k) * env; P.chest.x += (0.05 + 0.16 * k) * env; P.neck.x += 0.08 * k * env; P.head.x += (0.06 + 0.2 * k) * env;
      P.jaw = Math.max(P.jaw, 0.24 * k * env);
    } else if (m === 'sway') { // light-headed: the body sways, the arms drift out to catch the balance
      const sw = Math.sin(t * 2.3 + (a.ph || 0)) * env;
      P.hipsRot.z += sw * 0.05; P.spine.z -= sw * 0.09; P.chest.z -= sw * 0.07; P.head.z += sw * 0.14; P.head.x += 0.1 * env;
      hp.pos.x += sg * 0.07 * env; ho.pos.x -= sg * 0.07 * env;
    } else if (m === 'retch') { // bent over, hands toward the knees, mouth open
      const k = env * (0.75 + 0.25 * Math.sin(t * 5));
      P.spine.x += 0.28 * k; P.chest.x += 0.24 * k; P.head.x += 0.2 * k; P.neck.x += 0.08 * k;
      for (const [h, k2] of [[hp, s], [ho, 1 - s]]) { _vb.set(SIDE_SIGN[k2] * 0.11 * this.rig.H, -0.33 * this.rig.H, 0.16 * this.rig.H); toward(h, _vb); h.fing = lerp(h.fing, 0.5, env); }
      P.jaw = Math.max(P.jaw, 0.26 * env);
    } else if (m === 'stagger') { // the knees give for a moment: a dip and a lurch, an arm out to catch the balance
      const d = a.dur || 1.5, dip = Math.sin(clamp(t / Math.max(0.5, d - 0.2), 0, 1) * Math.PI) * env;
      P.hipsOff.y -= 0.075 * this.rig.legLen * dip; P.hipsRot.z += sg * 0.07 * dip;
      P.spine.x += 0.14 * dip; P.chest.x += 0.08 * dip; P.spine.z -= sg * 0.1 * dip; P.head.x += 0.16 * dip; P.head.z += sg * 0.12 * dip;
      hp.pos.x += sg * 0.12 * dip; hp.pos.y += 0.06 * dip; ho.pos.x -= sg * 0.05 * dip;
      this.blink = Math.max(this.blink, 0.02 * dip);
    } else if (m === 'loll') { // drowsy: the head drops and rolls, eyelids heavy
      P.head.x += (0.22 + Math.sin(t * 0.9) * 0.12) * env; P.head.z += Math.sin(t * 0.6 + (a.ph || 0)) * 0.24 * env; P.neck.x += 0.1 * env;
      this.blink = Math.max(this.blink, 0.012 * env);
    }
    P.look = Math.min(P.look, 1 - env * 0.7);
  }
  // the victim: doubles over the punch, clutches the belly, staggers when it is torn open
  poseGutted(P, a, root, dt) {
    const t = a.t, hit = smoothstep(a.hitT || 0.5, (a.hitT || 0.5) + 0.12, t), rip = smoothstep(a.ripT || 1.26, (a.ripT || 1.26) + 0.2, t);
    const lg = this.rig.legLen, shake = Math.sin(t * 29) * 0.03 * hit;
    P.spine.x += 0.3 * hit - 0.15 * rip; P.chest.x += 0.28 * hit - 0.2 * rip + shake; P.head.x += 0.25 * hit - 0.1 * rip;
    P.hipsOff.y -= (0.08 * hit + 0.05 * rip) * lg; P.hipsOff.z -= 0.12 * hit + 0.06 * rip;
    for (let s = 0; s < 2; s++) {
      const hp = P.hand[s], c = this.chestLocal(B.spine, SIDE_SIGN[s] * 0.035, -0.02, 0.09, _va);
      hp.pos.lerp(c, hit * (1 - rip * 0.4)); hp.space *= 1 - hit; hp.pron = lerp(hp.pron, -1.2, hit); hp.flex = lerp(hp.flex, 0.4, hit); hp.fing = lerp(hp.fing, 0.6, hit);
      const fl = this.armPose('flail', s); hp.pos.lerp(fl.pos, rip * 0.5);
    }
    P.jaw = Math.max(P.jaw, 0.35 * hit + 0.15 * rip);
    if (rip > 0.5) this.blink = Math.max(this.blink, 0.03);
    P.look = 0;
  }
  // ============================== sitting =================================================
  // the root stays at the stand-up spot in front of the seat; the hips go back and down onto it
  poseSit(P, a, root, dt) {
    const rig = this.rig, H = rig.H, t = a.t, seatH = a.seatH != null ? a.seatH : 0.45, depth = a.depth != null ? a.depth : 0.42;
    const hipY = seatH + 0.075 * (H / 1.75), standY = rig.bindPos[B.hips].y;
    P.hipsOff.set(0, hipY - standY, -depth); P.hipsRot.set(-0.12, 0, 0);
    P.spine.set(0.06 + (a.slouch || 0), 0, 0); P.chest.set(0.04, 0, 0); P.neck.set(0.05, 0, 0); P.head.set(0.02, 0, 0);
    const shin = rig.shinLen, footY = Math.max(rig.ankleY, seatH + 0.02 - shin - rig.ankleY * 0.2);
    const dangle = footY > rig.ankleY + 0.01;   // short legs (the doll) swing above the floor
    for (let s = 0; s < 2; s++) {
      const sg = SIDE_SIGN[s], fp = P.foot[s];
      const kneeOut = rig.hipHalf * (a.wide ? 1.9 : 1.15);
      fp.pos.set(sg * kneeOut, footY + (dangle ? Math.max(0, Math.sin(t * 2.4 + s * Math.PI)) * 0.05 : 0), -depth + rig.thighLen * 0.95 + (dangle ? 0.06 : 0.03));
      fp.pitch = dangle ? 0.5 : 0.05; fp.yaw = sg * 0.08; fp.roll = 0; fp.pole.set(sg * 0.15, 0.25, 1);
      const hp = P.hand[s];
      // hands resting on the thighs (or the mode's own pose)
      hp.posR.set(sg * (rig.hipHalf + 0.03), hipY + 0.06, -depth + rig.thighLen * 0.55); hp.space = 1;
      hp.pole.set(sg, -0.2, -0.6); hp.pron = -1.2; hp.flex = 0.25; hp.fing = 0.5; hp.thumb = 0.4;
    }
    const m = a.mode;
    if (m === 'phone') { const hp = P.hand[0]; hp.space = 0; hp.pos.copy(this.armPose('phone', 0).pos); hp.pron = -1.1; hp.flex = -0.2; hp.fing = 0.55; P.head.x += 0.35; P.neck.x += 0.12; }
    else if (m === 'doze') { P.head.x += 0.45 + Math.sin(t * 0.7) * 0.05; P.head.z += 0.15; P.neck.x += 0.15; this.blink = Math.max(this.blink, 0.05); }
    else if (m === 'arms') { for (let s = 0; s < 2; s++) { const hp = P.hand[s], c = this.armPose('crossed', s); hp.space = 0; hp.pos.copy(c.pos); hp.pole.copy(c.pole); hp.pron = c.pron; hp.fing = 0.6; } P.chest.x -= 0.04; }
    else if (m === 'look') { P.head.y += Math.sin(t * 0.4 + (a.ph || 0)) * 0.6; P.neck.y += Math.sin(t * 0.4 + (a.ph || 0)) * 0.2; }
    else if (m === 'lean') { P.spine.x += 0.22; P.chest.x += 0.12; for (let s = 0; s < 2; s++) { const hp = P.hand[s]; hp.posR.set(SIDE_SIGN[s] * 0.06, hipY + 0.12, -depth + rig.thighLen * 0.85); } P.head.x -= 0.1; }
    P.look = m === 'doze' ? 0 : 1;
  }
  // V1.15 kneeling beside someone on the ground: a hand on their chest and one on the shoulder, a gentle
  // shake, now and then a hand to their face to feel for breath; leaning over them, looking at them
  poseTend(P, a, root, dt) {
    const rig = this.rig, H = rig.H, S = H / 1.75, t = a.t;
    let tx = 0, ty = 0.15, tz = 0.45 * S;
    if (a.point) { this.toRoot(a.point, root, _va); tx = _va.x; ty = _va.y; tz = _va.z; }
    const hy = rig.thighLen * 0.62 + 0.09 * S + 0.035 * H, hz = -0.08 * S;
    P.hipsOff.set(0, hy - rig.hipsHeight, hz);
    const reachZ = Math.max(0.15, tz - hz), th = clamp(0.25 + (0.62 * S - ty) * 0.55 + (reachZ - 0.45 * S) * 0.6, 0.2, 0.95);
    P.hipsRot.set(th * 0.3, 0, Math.sin(t * 0.8) * 0.02); P.spine.set(th * 0.32, 0, 0); P.chest.set(th * 0.38, 0, 0);
    P.neck.set(0.12, 0, 0); P.head.set(0.18, 0, 0);
    for (let s = 0; s < 2; s++) {
      const sg = SIDE_SIGN[s], fp = P.foot[s];
      fp.pos.set(sg * rig.hipHalf * 1.2, rig.ankleY * 0.3 + 0.1, -rig.shinLen * 0.86 + hz * 0.5);
      fp.pitch = 1.25; fp.yaw = 0; fp.roll = 0; fp.pole.set(sg * 0.15, -0.5, 1);
    }
    const cyc = t % 6.5, face = cyc > 3.8 && cyc < 5.6 ? smooth01(Math.min(1, (cyc - 3.8) / 0.4)) * (1 - smooth01(Math.max(0, (cyc - 5.2) / 0.4))) : 0;
    const shake = cyc < 1.6 ? Math.sin(t * 9) * 0.018 : 0;
    for (let s = 0; s < 2; s++) {
      const hp = P.hand[s], sg = SIDE_SIGN[s];
      hp.posR.set(tx + sg * 0.13 * S, ty + 0.06, tz - 0.05 + (s === 1 ? shake : 0));
      if (s === 1 && face > 0 && a.head) { this.toRoot(a.head, root, _vb); hp.posR.lerp(_vb.setY(_vb.y + 0.05), face * 0.85); }
      hp.space = 1; hp.pole.set(sg, -0.5, -0.5); hp.pron = -1.3; hp.flex = 0.25; hp.fing = 0.35; hp.thumb = 0.45;
    }
    P.look = 1;
  }
  // standing in a moving train: one hand up on the grab rail, feet apart
  poseRideHold(P, a, root, dt) {
    const s = a.side || 1, hp = P.hand[s], L = this.L, sc = this.shoulderC[s];
    hp.pos.set(sc.x + SIDE_SIGN[s] * 0.08 * L, sc.y + 0.82 * L, sc.z + 0.12 * L); hp.space = 0; hp.pron = -1.4; hp.flex = -0.1; hp.fing = 0.9; hp.thumb = 0.85;
    const sway = Math.sin(a.t * 1.7) * 0.03 * (a.moving ? 1 : 0.2);
    P.hipsRot.z += sway; P.spine.z -= sway * 0.6; P.head.z += sway * 0.4;
  }
  // ============================== horror characters ======================================
  applyHorrorPosture(P, dt, root) {
    const L = this.L, spd = this.speed, moving = this.moving, ph = this.phase, run = this.runBlend || 0;
    const wk = moving ? clamp(spd / 1.2, 0, 1) : 0;
    const act = this.action, aw = 1 - (act && act.type !== 'hidle' && act.type !== 'didle' ? smooth01(act.w) : 0);
    if (this.hstyle === 'doctor') return this.doctorPosture(P, dt, root, aw, wk, moving, ph);
    if (this.hstyle === 'doll') {
      // stiff little legs: a side-to-side waddle, head bobbing, arms swinging straight from the shoulder
      const sw = Math.sin(TAU * ph);
      P.hipsOff.x += sw * 0.008 * wk; P.spine.z -= sw * 0.07 * wk; P.chest.z -= sw * 0.05 * wk;
      P.head.z += sw * 0.09 * wk; P.head.x += Math.abs(sw) * 0.05 * wk - 0.04;
      P.chest.x += run * 0.12; P.spine.x += run * 0.08;
      for (let s = 0; s < 2; s++) {
        const sg = SIDE_SIGN[s], hp = P.hand[s], swc = moving ? (s === 0 ? -1 : 1) * Math.cos(TAU * ph) : 0;
        let t;
        if (s === 1) { // knife hand: carried forward at waist height, blade up and out
          t = this.armPose('hang', s);
          t.pos.set(this.shoulderC[s].x + sg * 0.06 * L, this.shoulderC[s].y - 0.5 * L + Math.max(0, swc) * 0.08 * L, this.shoulderC[s].z + (0.42 + swc * 0.1 * wk) * L);
          t.pole.set(sg * 0.8, -0.6, -0.4); t.pron = -0.4; t.flex = -0.2;
        } else {
          t = this.armPose('hang', s);
          t.pos.z += swc * (0.32 + run * 0.15) * L * wk; t.pos.x += sg * 0.06 * L; t.pos.y += Math.abs(swc) * 0.12 * L * wk;
          t.fing = 0.25; t.flex = 0;
        }
        hp.lerp(t, aw);
      }
    } else if (this.hstyle === 'slasher') {
      // heavy, deliberate: shoulders rounded forward, head down and level, a slow arm swing
      P.spine.x += 0.06; P.chest.x += 0.1; P.neck.x += 0.12; P.head.x -= 0.1;
      P.clav[0].x += 0.12; P.clav[1].x += 0.12;
      P.hipsRot.x += run * 0.12; P.chest.x += run * 0.1;
      P.chest.y += Math.sin(TAU * ph) * 0.05 * wk;
      for (let s = 0; s < 2; s++) {
        const sg = SIDE_SIGN[s], hp = P.hand[s], swc = moving ? (s === 0 ? -1 : 1) * Math.cos(TAU * ph) : 0;
        const t = this.armPose('hang', s);
        if (s === 1) { t.pos.z += (0.1 + swc * 0.08 * wk) * L; t.pos.x += sg * 0.06 * L; t.pron = -0.2; } // machete low, blade forward
        else { t.pos.z += swc * (0.14 + run * 0.3) * L * wk; t.pos.y += Math.max(0, swc) * run * 0.2 * L; t.fing = 0.55; }
        hp.lerp(t, aw * 0.85);
      }
    }
  }
  // doll: a nasty little laugh - shoulders shaking, head thrown back, knife raised
  poseHLaugh(P, a, root) {
    const u = clamp(a.t / (a.dur || 1.6), 0, 1), k = Math.sin(Math.PI * Math.min(1, u * 1.3)), sh = Math.sin(a.t * 26) * k;
    P.chest.x -= 0.18 * k; P.head.x -= 0.32 * k; P.neck.x -= 0.1 * k; P.chest.x += sh * 0.05; P.head.x += sh * 0.06;
    P.clav[0].z += (0.15 + sh * 0.12) * k; P.clav[1].z += (0.15 + sh * 0.12) * k;
    const hp = P.hand[1], c = this.armPose('hang', 1), L = this.L;
    c.pos.set(this.shoulderC[1].x - 0.05 * L, this.shoulderC[1].y + 0.25 * L, this.shoulderC[1].z + 0.35 * L); c.pole.set(-1, -0.8, -0.2); c.pron = -1.2;
    hp.lerp(c, k);
    P.jaw = Math.max(P.jaw, (0.18 + 0.12 * Math.max(0, Math.sin(a.t * 26))) * k);
  }
  // slasher: the slow head tilt on spotting someone
  poseHTilt(P, a, root) {
    const u = clamp(a.t / (a.dur || 1.5), 0, 1), k = smoothstep(0, 0.35, u) * (1 - smoothstep(0.75, 1, u));
    P.head.z += (a.dir || 1) * 0.42 * k; P.neck.z += (a.dir || 1) * 0.12 * k; P.head.x -= 0.06 * k;
  }
  poseHIdle(P, a, root) {
    const t = a.t, u = clamp(t / (a.dur || 4), 0, 1), env = Math.sin(Math.PI * u), ph = a.ph || 0;
    if (a.mode === 'look') { P.head.y += Math.sin(t * 0.8 + ph) * 0.6 * env; P.neck.y += Math.sin(t * 0.8 + ph) * 0.2 * env; }
    else if (a.mode === 'tap') { // doll: taps the flat of the knife against the other palm
      const L = this.L, hk = P.hand[1], ho = P.hand[0];
      const c = this.armPose('hang', 0); c.pos.set(this.shoulderC[0].x - 0.15 * L, this.shoulderC[0].y - 0.55 * L, this.shoulderC[0].z + 0.4 * L); c.pron = -1.4; c.fing = 0.1;
      ho.lerp(c, env);
      const k2 = this.armPose('hang', 1); k2.pos.set(this.shoulderC[1].x + 0.1 * L, this.shoulderC[1].y - 0.45 * L + Math.abs(Math.sin(t * 5)) * 0.08 * L, this.shoulderC[1].z + 0.42 * L); k2.pron = -0.2;
      hk.lerp(k2, env); P.head.x += 0.18 * env;
    } else { // 'breathe': heavy breathing, shoulders rising
      const b = Math.sin(t * 2.2) * 0.5 + 0.5;
      P.chest.x -= b * 0.04 * env; P.clav[0].z += b * 0.08 * env; P.clav[1].z += b * 0.08 * env; P.head.x += 0.04 * env;
    }
  }
  // ============================== the containment doctor ======================================
  // Very upright, the beak carried forward; the left hand rests in the small of the back and the right
  // holds the injector at the waist, needle down. The head moves in slow scans with held, bird-like tilts.
  doctorPosture(P, dt, root, aw, wk, moving, ph) {
    const L = this.L, dv = this.dvar || (this.dvar = { ph: Math.random() * 10, tiltT: 1, tilt: 0, goal: 0 });
    P.spine.x -= 0.03; P.chest.x -= 0.05; P.neck.x += 0.12; P.head.x -= 0.03;
    P.clav[0].x -= 0.05; P.clav[1].x -= 0.05;
    dv.tiltT -= dt;
    if (dv.tiltT <= 0) { dv.goal = Math.random() < 0.45 ? (Math.random() < 0.5 ? -1 : 1) * (0.16 + Math.random() * 0.2) : 0; dv.tiltT = 1.4 + Math.random() * 3.2; }
    dv.tilt = damp(dv.tilt, dv.goal, 3.5, dt);
    const free = 1 - (this.lookW || 0);
    const scan = Math.sin(this.time * 0.37 + dv.ph) * 0.32 + Math.sin(this.time * 0.13 + dv.ph * 2) * 0.18;
    P.head.y += scan * free * 0.75; P.neck.y += scan * free * 0.25; P.head.z += dv.tilt;
    // the stride: barely any sway, the coat-tails do the moving
    P.chest.y += Math.sin(TAU * ph) * 0.025 * wk;
    const sw = moving ? Math.cos(TAU * ph) : 0;
    const hl = this.armPose('behind', 0); hl.pos.x -= 0.03 * L; hl.pos.y += Math.abs(sw) * 0.01 * L;
    P.hand[0].lerp(hl, aw);
    const hr = this.armPose('hang', 1), sc = this.shoulderC[1];
    hr.pos.set(sc.x - 0.03 * L, sc.y - 0.62 * L + Math.max(0, sw) * 0.02 * L, sc.z + (0.36 + sw * 0.05 * wk) * L);
    hr.pole.set(-0.35, 0, -1); hr.pron = -0.1; hr.flex = 0.15;
    P.hand[1].lerp(hr, aw);
  }
  // idles: hands clasped behind the back; tugging a glove cuff snug; counting the vials on the belt; stock-still
  poseDIdle(P, a, root) {
    const t = a.t, u = clamp(t / (a.dur || 4), 0, 1), env = smoothstep(0, 0.16, u) * (1 - smoothstep(0.84, 1, u)), L = this.L, rig = this.rig;
    if (a.mode === 'behind') {
      for (let s = 0; s < 2; s++) { const c = this.armPose('behind', s); c.pos.x -= SIDE_SIGN[s] * 0.03 * L; P.hand[s].lerp(c, env); }
      P.chest.x -= 0.05 * env; P.head.x -= 0.04 * env; P.hipsRot.z += Math.sin(t * 0.6 + (a.ph || 0)) * 0.012 * env;
    } else if (a.mode === 'glove') {
      const sc = this.shoulderC[1], hr = this.armPose('hang', 1);
      hr.pos.set(sc.x + 0.14 * L, sc.y - 0.5 * L, sc.z + 0.44 * L); hr.pole.set(-0.6, -0.3, -1); hr.pron = -0.9; hr.flex = 0.2;
      P.hand[1].lerp(hr, env);
      const tug = Math.max(0, Math.sin(t * 6.5)) * (Math.sin(t * 0.9 + 1) > -0.4 ? 1 : 0);
      const hl = this.armPose('hang', 0);
      hl.pos.set(hr.pos.x + 0.01, hr.pos.y + 0.035, hr.pos.z - 0.075 - tug * 0.03); hl.pole.set(0.8, -0.3, -0.7); hl.pron = -1.25; hl.flex = 0.35; hl.fing = 0.78; hl.thumb = 0.85;
      P.hand[0].lerp(hl, env);
      P.head.x += 0.3 * env; P.neck.x += 0.12 * env; P.head.y -= 0.14 * env; P.head.z += 0.1 * env;
    } else if (a.mode === 'vials') {
      const H = rig.H, sk = H / 1.75, y = rig.crotchY + 0.375 * (rig.neckBaseY - rig.crotchY), k = Math.floor(t * 0.9) % 3, th = 0.6 + k * 0.16;
      const hl = this.armPose('hang', 0);
      hl.posR.set(Math.sin(th) * 0.2 * sk + 0.03, y + 0.06 * sk + Math.abs(Math.sin(t * 2.8)) * 0.012, Math.cos(th) * 0.15 * sk + 0.05);
      hl.space = 1; hl.pole.set(1, -0.2, -0.8); hl.pron = -1.0; hl.flex = 0.45; hl.fing = 0.45 + 0.25 * Math.sin(t * 2.8); hl.thumb = 0.5;
      P.hand[0].lerp(hl, env);
      P.head.x += 0.5 * env; P.neck.x += 0.16 * env; P.head.y += 0.36 * env; P.chest.y += 0.08 * env;
    } else { // 'still': rigid; the head moves in small sudden steps
      const step = Math.round(Math.sin(t * 0.7 + (a.ph || 0)) * 2.5) / 2.5;
      this.dHeadStep = damp(this.dHeadStep || 0, step, 9, 1 / 60);
      P.head.y += this.dHeadStep * 0.42 * env; P.head.z += Math.abs(this.dHeadStep) * 0.2 * env; P.neck.y += this.dHeadStep * 0.12 * env;
    }
  }
  // inspection: the injector up beside the beak, the glass flicked twice, a bead squeezed from the needle.
  // Targets are in root space (looking at the injector pitches the chest, which must not move the hand).
  poseDInspect(P, a, root) {
    const t = a.t, dur = a.dur || 4.4, rig = this.rig, sk = rig.H / 1.75;
    const up = smoothstep(0.05, 0.85, t) * (1 - smoothstep(dur - 0.9, dur - 0.1, t));
    const hx = -0.1 * sk, hy = rig.eyeY - 0.05 * sk, hz = 0.27 * sk;
    const hr = this.armPose('hang', 1);
    hr.posR.set(hx, hy, hz); hr.space = 1; hr.pole.set(-0.7, -1, 0.1); hr.pron = a.pron != null ? a.pron : -1.5; hr.flex = 0.1;
    hr.thumb = 0.5 + 0.5 * smoothstep(2.5, 2.75, t) * (1 - smoothstep(3.0, 3.3, t));
    P.hand[1].lerp(hr, up);
    if (!a.squirt && t > 2.7) a.squirt = 1;
    // the left hand comes up beside the barrel and flicks it with a fingertip
    const near = smoothstep(0.9, 1.4, t) * (1 - smoothstep(2.4, 2.9, t));
    const flick = Math.exp(-Math.pow((t - 1.65) / 0.06, 2)) + Math.exp(-Math.pow((t - 2.1) / 0.06, 2));
    const hl = this.armPose('hang', 0);
    hl.posR.set(hx + 0.075 * sk, hy - 0.05 * sk, hz + 0.01 * sk); hl.space = 1; hl.pole.set(0.8, -1, 0); hl.pron = -1.3; hl.flex = -0.2 - flick * 0.5; hl.fing = 0.75 - flick * 0.7; hl.thumb = 0.7;
    P.hand[0].lerp(hl, near * up);
    const c = Math.cos(root.yaw), s = Math.sin(root.yaw);
    _vc.set(root.pos.x + hx * c + hz * s, root.pos.y + hy, root.pos.z - hx * s + hz * c);
    this.aimHead(P, root, _vc, 0.8 * up);
    P.head.z += (a.dir || 1) * 0.2 * up;
  }
  // the injection: a hand clamps the subject's shoulder, the needle hand rises, drives down into the neck
  // (or the upper arm), holds while the thumb presses the plunger, and withdraws
  poseDInject(P, a, root) {
    const v = a.target; if (!v || v.removed) return;
    const t = a.t, L = this.L, sk = this.rig.H / 1.75, sc = this.shoulderC[1];
    const reach = smoothstep(0, 0.45, t) * (1 - smoothstep(2.5, 3.0, t));
    const k1 = smoothstep(0.25, 0.85, t) * (1 - smoothstep(2.45, 2.95, t)), k2 = smoothstep(0.85, 1.02, t) * (1 - smoothstep(2.0, 2.4, t));
    if (!a.hit && t >= 1.02) a.hit = 1;
    const hl = P.hand[0];
    this.toRoot(v.boneWPos[SB('upperarm', 1)], root, _va);
    hl.posR.copy(_va); hl.posR.y += 0.05 * sk; hl.space = reach; hl.pole.set(0.9, -0.5, -0.4); hl.pron = lerp(hl.pron, -1.5, reach); hl.flex = lerp(hl.flex, 0.5, reach); hl.fing = lerp(hl.fing, 0.85, reach); hl.thumb = lerp(hl.thumb, 0.7, reach);
    // wound up: fist high beside the head, needle pointing down
    const hr = P.hand[1], wu = this.Pa.hand[1];
    wu.copy(hr); wu.pos.set(sc.x - 0.1 * L, sc.y + 0.08 * L, sc.z + 0.3 * L); wu.space = 0; wu.pole.set(-1, -0.7, -0.5); wu.pron = 0.15; wu.flex = 0.25;
    hr.lerp(wu, k1);
    // the strike: the needle tip is placed on the side of the neck (or the outside of the upper arm) and
    // driven in a little; the wrist target is solved back from the tip using last frame's hand orientation
    const npc = this.npc, rig = this.rig, hb = SB('hand', 1), vy = v.root.yaw;
    const lx = Math.cos(vy), lz = -Math.sin(vy);                         // the subject's left, in world space
    const tdx = root.pos.x - v.root.pos.x, tdz = root.pos.z - v.root.pos.z, tl = Math.hypot(tdx, tdz) || 1;
    const tb = a.region === 'arm' ? v.boneWPos[SB('upperarm', 0)] : v.boneWPos[B.neck], vs = v.rig.H / 1.75;
    if (a.region === 'arm') _vb.set(tb.x + lx * 0.055 * vs + tdx / tl * 0.02, tb.y - 0.075 * vs, tb.z + lz * 0.055 * vs + tdz / tl * 0.02);
    else _vb.set(tb.x + lx * 0.032 * vs + tdx / tl * 0.045 * vs, tb.y + 0.035 * vs, tb.z + lz * 0.032 * vs + tdz / tl * 0.045 * vs);
    a.point = a.point || new V3(); a.point.copy(_vb);
    _vc.set(0, 0, 0).addScaledVector(rig.armDir[1], rig.palmLen * 0.62).addScaledVector(rig.armE2[1], 0.006 + 0.008 * sk).addScaledVector(rig.armE1[1], -0.13 * sk).applyQuaternion(npc.boneWRot[hb]);
    const dn = _vd.copy(rig.armE1[1]).negate().applyQuaternion(npc.boneWRot[hb]), dep = 0.016 * smoothstep(1.0, 1.25, t);
    _vb.addScaledVector(dn, dep).sub(_vc);                                 // world wrist target
    this.toRoot(_vb, root, _vb);
    const st = this.Pb.hand[1]; st.copy(hr);
    st.posR.copy(_vb); st.space = 1; st.pole.set(-1, -0.6, -0.3); st.pron = 0.5; st.flex = 0.8;
    st.thumb = 0.5 + 0.5 * smoothstep(1.15, 1.8, t);
    hr.lerp(st, k2);
    P.spine.x += 0.05 * k2; P.chest.x += 0.08 * Math.max(k1 * 0.5, k2); P.head.z -= 0.15 * k2;
    this.aimHead(P, root, a.point, 0.75 * Math.max(k1, k2));
  }
  // the trigger: the left hand rises toward an infected subject, palm out, and slowly closes into a fist
  // (mode 'point': the same arm, hand flat, a short jab toward whoever his zombies are to take)
  poseDTrigger(P, a, root) {
    const s = a.target, t = a.t, L = this.L, dur = a.dur || 3.4, sc = this.shoulderC[0], point = a.mode === 'point';
    const up = smoothstep(0.1, 0.75, t) * (1 - smoothstep(dur - 1.0, dur - 0.1, t));
    const close = point ? 0 : smoothstep(0.95, 1.95, t), jab = point ? Math.exp(-Math.pow((t - 1.05) / 0.14, 2)) : 0;
    if (!a.fire && t >= (point ? 1.0 : 1.95)) a.fire = 1;
    let yaw = 0;
    if (s && !s.removed) { this.toRoot(s.boneWPos[B.chest], root, _va); yaw = clamp(Math.atan2(_va.x, _va.z), -0.8, 0.8); }
    const hl = this.armPose('hang', 0), tremble = close > 0 && close < 1 ? Math.sin(t * 40) * 0.004 : 0;
    const reach = (point ? 0.86 + 0.08 * jab : 0.82) * L;
    hl.pos.set(sc.x + Math.sin(yaw) * reach - 0.06 * L, sc.y + (point ? 0.04 : 0.1) * L + tremble, sc.z + Math.cos(yaw) * reach);
    hl.pole.set(0.7, -1, -0.2); hl.pron = -1.45; hl.dev = 0;
    if (point) { hl.flex = 0.05; hl.fing = 0.08; hl.thumb = 0.35; }
    else { hl.flex = lerp(-0.8, 0.15, close); hl.fing = lerp(0.02, 1, close); hl.thumb = lerp(0.05, 0.95, close); }
    P.hand[0].lerp(hl, up);
    P.chest.y += yaw * 0.35 * up; P.neck.y += yaw * 0.25 * up; P.head.y += yaw * 0.25 * up;
    P.head.z += (a.dir || 1) * 0.32 * up; P.head.x += 0.14 * close * up; P.chest.x -= 0.05 * up;
  }
  // calling his zombies back: the left hand up in front, palm up, fingers beckoning
  poseDRecall(P, a, root) {
    const t = a.t, L = this.L, dur = a.dur || 2.4, sc = this.shoulderC[0];
    const up = smoothstep(0.05, 0.5, t) * (1 - smoothstep(dur - 0.6, dur - 0.05, t));
    const hl = this.armPose('hang', 0), curl = 0.5 + 0.5 * Math.sin(t * 7.5);
    hl.pos.set(sc.x + 0.02 * L, sc.y - 0.3 * L, sc.z + 0.72 * L);
    hl.pole.set(0.8, -1, -0.3); hl.pron = a.pron != null ? a.pron : 1.8; hl.flex = -0.25 + 0.55 * curl; hl.fing = 0.1 + 0.75 * curl; hl.thumb = 0.3;
    P.hand[0].lerp(hl, up);
    P.head.z += 0.22 * up; P.head.x -= 0.05 * up; P.chest.x -= 0.03 * up;
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
    const zv = this.zombie > 0 && this.zvar ? this.zvar : null;
    // (the doctor's jaw stays shut inside the rigid hood)
    const ex = this.expr ? this.expr.v : null;
    this.setLocalEuler(B.jaw, this.hstyle === 'doctor' ? 0 : clamp(P.jaw + this.jaw + (zv ? (zv.jawRest || 0) * this.zombie : 0) + (this.sick || 0) * 0.04 + (ex ? ex[6] : 0) + (this.talkJaw || 0), 0, 0.45), 0, 0);
    this.saccadeT -= dt;
    if (this.saccadeT <= 0) { this.saccade.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.08, 0); this.saccadeT = 0.4 + Math.random() * 2; }
    this.eyeYaw = damp(this.eyeYaw, (this.eyeYawT || 0) + this.saccade.x, 25, dt);
    this.eyePitch = damp(this.eyePitch, (this.eyePitchT || 0) + this.saccade.y, 25, dt);
    const dead = npc.lifeState === 'dead' || npc.lifeState === 'destroyed';
    for (let s = 0; s < 2; s++) {
      this.setLocalEuler(SB('eye', s), this.eyePitch, this.eyeYaw, 0);
      const lidClose = dead ? 0.55 : this.blinkClose() * 0.62 + (ex ? ex[5] : 0) + (this.zombie ? (zv && zv.lid != null ? zv.lid : 0.1) * this.zombie : 0) + (this.sick || 0) * 0.2;
      this.setLocalEuler(SB('lid', s), clamp(lidClose, -0.17, 0.62), 0, 0);
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
