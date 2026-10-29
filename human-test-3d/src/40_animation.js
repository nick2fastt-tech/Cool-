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
  zombie: { crouch: 0.07, spine: 0.22, chest: 0.12, head: 0.28, lean: 0.06 }
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

// --- two-bone IK ---------------------------------------------------------------------
const _ikD = new V3(), _ikP = new V3(), _ikE = new V3(), _ikU1 = new V3(), _ikU2 = new V3(), _ikN = new V3(), _ikT = new V3();
function solveTwoBone(root, target, pole, L1, L2, bindDir, bindHinge, q1, q2, minBend = 0.02) {
  _ikD.subVectors(target, root);
  let dist = _ikD.length();
  if (dist < 1e-6) { _ikD.set(0, -1, 0); dist = 1e-6; } else _ikD.multiplyScalar(1 / dist);
  const maxR = (L1 + L2) * (1 - 0.0005 - minBend * 0.01), minR = Math.abs(L1 - L2) + 0.01;
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
    this.locomotion(dt, root, env, P);
    // 2) postures
    this.applyPosture(P, dt);
    // 3) upper body
    this.applyUpper(P, dt, root);
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
  locomotion(dt, root, env, P) {
    const rig = this.rig, npc = this.npc, pers = npc.personality;
    const spd = this.speed;
    const zomb = this.zombie;
    const run = smoothstep(2.2, 4.2, spd) * (1 - zomb);
    const moving = spd > 0.12;
    const stride = rig.legLen * (0.75 + 0.6 * Math.min(spd, 6)) * lerp(1, 0.8, zomb);
    const freq = Math.max(0.55, spd / Math.max(0.3, stride)) * pers.cadence * lerp(1, 0.85, zomb);
    const duty = lerp(lerp(0.62, 0.36, run), 0.7, zomb);
    if (moving) this.phase = (this.phase + freq * dt) % 1;
    const yaw = root.yaw;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    // per-foot update
    const T = moving ? 1 / freq : 0.4;
    for (let s = 0; s < 2; s++) {
      const f = this.feet[s], sg = SIDE_SIGN[s];
      const lat = this.stance * 0.5 * (1 + zomb * 0.3);
      const idealX = root.pos.x + cy * sg * lat, idealZ = root.pos.z - sy * sg * lat;
      if (moving) {
        const ph = (this.phase + s * 0.5) % 1;
        const inSwing = ph >= duty;
        if (inSwing) {
          const sw = (ph - duty) / (1 - duty);
          if (!f.swing) { f.swing = true; f.from.copy(f.pos); f.idleStep = false; f.h = lerp(0.075, 0.2, run) * pers.stepLift * lerp(1, 0.4, zomb) * (1 - 0.6 * this.limp[s]); }
          // predicted landing: under hip at mid-stance of next stance phase
          const tLand = (1 - sw) * (1 - duty) * T + duty * T * 0.5;
          f.to.set(idealX + this.vel.x * tLand, 0, idealZ + this.vel.z * tLand);
          f.to.y = env.groundHeight(f.to.x, f.to.z);
          const e = sw * sw * (3 - 2 * sw);
          f.pos.lerpVectors(f.from, f.to, e);
          f.pos.y += f.h * Math.sin(Math.PI * Math.min(1, sw * 1.15));
          f.pitch = lerp(0.55 * (1 - zomb * 0.7), -0.25 * (1 - zomb), smoothstep(0.0, 0.8, sw)); // toe-off -> heel strike
          f.yaw = yaw;
        } else {
          if (f.swing) { f.swing = false; f.pos.copy(f.to); f.landT = 0; }
          f.landT += dt;
          const st = ph / duty;
          f.pitch = lerp(-0.2 * (1 - zomb), 0, smoothstep(0, 0.25, st)) + lerp(0, 0.4, smoothstep(0.72, 1.0, st)) * (1 - zomb * 0.7);
          f.yaw = angleDamp(f.yaw, yaw, 4, dt);
        }
      } else {
        // idle: finish swings and step when far from ideal
        if (f.swing) {
          f.t += dt / f.dur;
          const e = smooth01(f.t);
          f.pos.lerpVectors(f.from, f.to, e); f.pos.y += f.h * Math.sin(Math.PI * Math.min(1, f.t));
          f.pitch = lerp(f.pitch, 0, 0.2);
          if (f.t >= 1) { f.swing = false; f.pos.copy(f.to); }
        } else {
          f.pitch = damp(f.pitch, 0, 8, dt);
          f.pos.y = env.groundHeight(f.pos.x, f.pos.z);
        }
      }
    }
    if (!moving) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0 && !this.feet[0].swing && !this.feet[1].swing) {
        // choose foot farthest from ideal
        let worst = -1, wd = 0.15;
        for (let s = 0; s < 2; s++) {
          const sg = SIDE_SIGN[s], f = this.feet[s];
          const lat = this.stance * 0.5;
          const ix = root.pos.x + cy * sg * lat, iz = root.pos.z - sy * sg * lat;
          const d = Math.hypot(f.pos.x - ix, f.pos.z - iz) + Math.abs(wrapAngle(f.yaw - yaw)) * 0.25;
          if (d > wd) { wd = d; worst = s; }
        }
        if (worst >= 0) {
          const f = this.feet[worst], sg = SIDE_SIGN[worst];
          const lat = this.stance * 0.5;
          f.swing = true; f.t = 0; f.dur = 0.32 * pers.animSpeed; f.h = 0.06; f.from.copy(f.pos);
          f.to.set(root.pos.x + cy * sg * lat, 0, root.pos.z - sy * sg * lat); f.to.y = env.groundHeight(f.to.x, f.to.z);
          f.yaw = yaw;
          this.stepTimer = 0.18;
        }
      }
    }
    // pelvis & spine
    const ph = this.phase;
    const bobA = moving ? lerp(0.022, 0.045, run) * pers.bounce : 0;
    const cb = Math.cos(4 * Math.PI * (ph - duty * 0.5));
    const bob = moving ? bobA * 0.5 * lerp(cb - 1, -cb - 1, run) : 0;
    // idle weight shift
    this.weightTimer -= dt;
    if (this.weightTimer <= 0) { this.weightShiftTarget = (Math.random() - 0.5) * 2 * pers.fidget; this.weightTimer = 3 + Math.random() * 6; }
    this.weightShift = damp(this.weightShift, moving ? 0 : this.weightShiftTarget, 1.5, dt);
    const sway = moving ? Math.sin(TAU * ph) * lerp(0.022, 0.012, run) * (1 + zomb * 2.5) : this.weightShift * 0.035;
    // to character space (root local): feet
    const lean = (0.03 + 0.14 * run + 0.06 * zomb) * pers.leanMul;
    P.hipsOff.set(sway, bob, 0.0);
    P.hipsRot.set(lean * 0.6, moving ? Math.sin(TAU * ph) * lerp(0.09, 0.16, run) * (1 - zomb * 0.5) : 0, moving ? -Math.sin(TAU * ph) * 0.035 * (1 + zomb * 2) : -this.weightShift * 0.05);
    P.spine.set(lean * 0.5 + pers.slouch * 0.5, -P.hipsRot.y * 0.5, -P.hipsRot.z * 0.4);
    P.chest.set(lean * 0.3 + pers.slouch * 0.4, -P.hipsRot.y * 0.55, -P.hipsRot.z * 0.3);
    P.neck.set(-lean * 0.4, 0, 0); P.head.set(-lean * 0.5 + pers.headTilt, 0, zomb * 0.25 * Math.sin(this.time * 0.7));
    // feet in root space
    const iy = -yaw; const ciy = Math.cos(iy), siy = Math.sin(iy);
    let minHipY = 1e9;
    for (let s = 0; s < 2; s++) {
      const f = this.feet[s], fp = P.foot[s];
      const dx = f.pos.x - root.pos.x, dz = f.pos.z - root.pos.z;
      fp.pos.set(dx * ciy + dz * siy, f.pos.y - root.pos.y, -dx * siy + dz * ciy);
      fp.pos.y += rig.ankleY + (f.pitch > 0 ? Math.sin(f.pitch) * 0.075 * rig.H : Math.sin(-f.pitch) * 0.03 * rig.H);
      fp.pitch = f.pitch; fp.yaw = wrapAngle(f.yaw - yaw); fp.roll = 0;
      fp.pole.set(Math.sin(fp.yaw) + SIDE_SIGN[s] * 0.12, 0, Math.cos(fp.yaw));
      // max hip height to reach this foot (keep slight knee bend)
      const hj = rig.bindPos[SB('thigh', s)];
      const hx = fp.pos.x - (hj.x + P.hipsOff.x), hz = fp.pos.z - hj.z;
      const reach = rig.legLen * 0.985;
      const vy = Math.sqrt(Math.max(0, reach * reach - hx * hx - hz * hz));
      minHipY = Math.min(minHipY, fp.pos.y + vy - (hj.y - rig.hipsHeight));
    }
    const standY = rig.hipsHeight;
    const target = standY + P.hipsOff.y - 0.012 * rig.H;
    if (target > minHipY) P.hipsOff.y -= (target - minHipY);
    // arm swing
    for (let s = 0; s < 2; s++) {
      const sg = SIDE_SIGN[s];
      const sw = moving ? (s === 0 ? -1 : 1) * Math.cos(TAU * ph) : 0;
      const amp = lerp(0.20, 0.32, run) * pers.armSwing * clamp(spd / 1.2, 0, 1) * (1 - zomb);
      const base = run > 0.01 ? this.armPose('hang', s).lerp(this.armPose('run', s), run) : this.armPose('hang', s);
      base.pos.z += sw * amp * this.L;
      base.pos.y += Math.abs(sw) * amp * 0.25 * this.L;
      base.pos.x += sg * (moving ? 0.0 : 0.0);
      P.hand[s].copy(base);
      P.clav[s].set(0, 0, 0);
    }
    P.jaw = 0; P.look = 1;
    if (moving) this.stateName = zomb > 0.5 ? 'zombieWalk' : (run > 0.5 ? 'run' : (spd > 1.6 ? 'jog' : 'walk'));
    else if (!this.clip) this.stateName = 'idle';
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
    if (c.zombie) { Pc.head.z += Math.sin(c.t * 7) * 0.12; Pc.spine.y += Math.sin(c.t * 3.3) * 0.08; }
    P.copy(Pc);
    if (c.t >= c.dur) {
      const done = c.onDone; this.clip = null;
      if (done) done();
    }
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
      solveTwoBone(X[th], fp.pos, fp.pole, rig.thighLen, rig.shinLen, _v1.set(0, -1, 0), rig.kneeAxis, _q1, _q2, 0.02);
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
