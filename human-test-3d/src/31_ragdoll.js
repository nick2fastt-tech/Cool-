// ============================================================================
// Ragdoll: 16 capsule bodies + 15 joints generated from a character rig.
// Kinematic while animated (bodies follow bones, push props/ragdolls),
// dynamic when ragdolled (bones follow bodies).
// ============================================================================
const RAG = {
  PELVIS: 0, SPINE: 1, CHEST: 2, HEAD: 3, UARM_L: 4, FARM_L: 5, HAND_L: 6, UARM_R: 7, FARM_R: 8, HAND_R: 9,
  THIGH_L: 10, SHIN_L: 11, FOOT_L: 12, THIGH_R: 13, SHIN_R: 14, FOOT_R: 15
};
const RAG_COUNT = 16;
const RAG_NAMES = ['Pelvis', 'Abdomen', 'Chest', 'Head', 'L Upper Arm', 'L Forearm', 'L Hand', 'R Upper Arm', 'R Forearm', 'R Hand', 'L Thigh', 'L Shin', 'L Foot', 'R Thigh', 'R Shin', 'R Foot'];
const RAG_BONE = [B.hips, B.spine, B.chest, B.head, B.upperarm_L, B.forearm_L, B.hand_L, B.upperarm_R, B.forearm_R, B.hand_R, B.thigh_L, B.shin_L, B.foot_L, B.thigh_R, B.shin_R, B.foot_R];
const RAG_MASS = [0.142, 0.139, 0.216, 0.081, 0.028, 0.016, 0.006, 0.028, 0.016, 0.006, 0.100, 0.0465, 0.0145, 0.100, 0.0465, 0.0145];
const REGION_TO_RAG = [RAG.HEAD, RAG.HEAD, RAG.CHEST, RAG.CHEST, RAG.SPINE, RAG.PELVIS, RAG.UARM_L, RAG.FARM_L, RAG.HAND_L, RAG.UARM_R, RAG.FARM_R, RAG.HAND_R,
  RAG.THIGH_L, RAG.SHIN_L, RAG.FOOT_L, RAG.THIGH_R, RAG.SHIN_R, RAG.FOOT_R];
// bone -> ragdoll body index (for bones directly driven)
const BONE_TO_RAG = new Int8Array(NUM_BONES).fill(-1);
RAG_BONE.forEach((b, i) => { BONE_TO_RAG[b] = i; });

function quatFromXY(X, Y, out) {
  const Z = new V3().crossVectors(X, Y).normalize();
  const Yo = new V3().crossVectors(Z, X).normalize();
  _m2.makeBasis(X.clone().normalize(), Yo, Z);
  return (out || new QT()).setFromRotationMatrix(_m2);
}
function anyPerp(v, hint) {
  const h = hint && Math.abs(hint.dot(v)) < 0.9 ? hint : (Math.abs(v.y) < 0.9 ? UP : FWD);
  return new V3().copy(h).addScaledVector(v, -h.dot(v)).normalize();
}

class Ragdoll {
  constructor(npc) {
    this.npc = npc; this.physKind = 'npc';
    this.bodies = []; this.joints = []; this.canSleep = true; this.asleep = false; this.sleepTimer = 0;
    this.dynamic = false; this.detached = new Uint8Array(RAG_COUNT);
    const rig = npc.rig, H = rig.H, P = rig.bindPos, S = rig.sHead;
    const bd = npc.app.body;
    const mk = new V3();
    const defs = [];
    const hipsY = P[B.hips].y;
    const thick = (1 + 0.08 * bd.fat);
    // capsule endpoints in bind CS + radius
    defs[RAG.PELVIS] = { a: new V3(-0.042 * H, hipsY - 0.004 * H, 0), b: new V3(0.042 * H, hipsY - 0.004 * H, 0), r: 0.060 * H * thick };
    const spY = P[B.spine].y + 0.035 * H;
    defs[RAG.SPINE] = { a: new V3(-0.036 * H, spY, 0.004 * H), b: new V3(0.036 * H, spY, 0.004 * H), r: 0.056 * H * thick * Math.pow(bd.waist, 0.5) };
    const chY = P[B.chest].y + 0.055 * H;
    defs[RAG.CHEST] = { a: new V3(-0.042 * H * bd.shoulder, chY, 0.002 * H), b: new V3(0.042 * H * bd.shoulder, chY, 0.002 * H), r: 0.062 * H * Math.pow(bd.chest, 0.5) };
    const hc = rig.headCenter;
    defs[RAG.HEAD] = { a: new V3(0, hc.y - 0.06 * S, hc.z + 0.004 * S), b: new V3(0, hc.y + 0.03 * S, hc.z - 0.008 * S), r: 0.083 * S };
    for (let s = 0; s < 2; s++) {
      const d = rig.armDir[s];
      const sh = P[SB('upperarm', s)], el = P[SB('forearm', s)], wr = P[SB('hand', s)];
      const o = s === 0 ? 0 : 3;
      defs[RAG.UARM_L + o] = { a: sh.clone().addScaledVector(d, 0.012 * H), b: el.clone().addScaledVector(d, -0.008 * H), r: 0.027 * H * Math.pow(bd.muscle, 0.6) };
      defs[RAG.FARM_L + o] = { a: el.clone().addScaledVector(d, 0.006 * H), b: wr.clone().addScaledVector(d, -0.006 * H), r: 0.021 * H };
      defs[RAG.HAND_L + o] = { a: wr.clone().addScaledVector(d, 0.016 * H), b: wr.clone().addScaledVector(d, 0.078 * H), r: 0.0175 * H };
      const hp = P[SB('thigh', s)], kn = P[SB('shin', s)], an = P[SB('foot', s)];
      const lo = s === 0 ? 0 : 3;
      defs[RAG.THIGH_L + lo] = { a: hp.clone().add(mk.set(0, -0.012 * H, 0.004 * H)), b: kn.clone().add(mk.set(0, 0.012 * H, 0.003 * H)), r: 0.044 * H * Math.pow(bd.limb, 0.5) };
      defs[RAG.SHIN_L + lo] = { a: kn.clone().add(mk.set(0, -0.012 * H, 0)), b: an.clone().add(mk.set(0, 0.012 * H, -0.002 * H)), r: 0.031 * H };
      defs[RAG.FOOT_L + lo] = { a: new V3(an.x, rig.sole + 0.022 * H, an.z - 0.022 * H), b: new V3(an.x, rig.sole + 0.02 * H, an.z + 0.098 * H), r: 0.022 * H };
    }
    this.defs = defs;
    const massScale = Settings.data.physics.massScale;
    const total = rig.mass * massScale;
    this.totalMass = total;
    this.bindPos = []; this.bindRot = []; this.boneOff = [];
    for (let i = 0; i < RAG_COUNT; i++) {
      const df = defs[i];
      const dir = new V3().subVectors(df.b, df.a);
      const len = dir.length(); dir.normalize();
      const hh = Math.max(0.001, len / 2);
      const body = new RBody({ type: SHAPE.CAPSULE, r: df.r, hh }, total * RAG_MASS[i]);
      body.owner = this; body.index = i; body.friction = 0.75; body.restitution = 0.05;
      body.linDamp = 0.05; body.angDamp = 0.25;
      body.tag = 'npc';
      const c = new V3().addVectors(df.a, df.b).multiplyScalar(0.5);
      const hint = Math.abs(dir.z) > 0.8 ? UP : FWD;
      const q = frameQuat(UP, FWD, dir, hint, new QT());
      this.bindPos.push(c); this.bindRot.push(q);
      // vector from bone origin to body center in bone-local (bind) coords
      this.boneOff.push(c.clone().sub(P[RAG_BONE[i]]));
      body.pos.copy(c); body.rot.copy(q); body.prevPos.copy(c); body.prevRot.copy(q);
      body.kinematic = true;
      this.bodies.push(body);
    }
    // joints ---------------------------------------------------------------
    const J = (pi, ci, pivot, type, o) => {
      let qP, qC;
      if (type === 'hinge') {
        const X = o.axis.clone().normalize();
        const Y = o.dir.clone().addScaledVector(X, -o.dir.dot(X)).normalize();
        qP = quatFromXY(X, Y); qC = qP.clone();
      } else {
        const Xc = o.dir.clone().normalize();
        const Xp = (o.cone || o.dir).clone().normalize();
        const Yc = anyPerp(Xc, o.ref || FWD);
        const qmin = new QT().setFromUnitVectors(Xc, Xp);
        const Yp = Yc.clone().applyQuaternion(qmin);
        qC = quatFromXY(Xc, Yc); qP = quatFromXY(Xp, Yp);
      }
      const bp = this.bindPos[pi], bq = this.bindRot[pi], cp = this.bindPos[ci], cq = this.bindRot[ci];
      const iqp = bq.clone().invert(), iqc = cq.clone().invert();
      const lp0 = pivot.clone().sub(bp).applyQuaternion(iqp), lq0 = iqp.clone().multiply(qP);
      const lp1 = pivot.clone().sub(cp).applyQuaternion(iqc), lq1 = iqc.clone().multiply(qC);
      const j = new Joint(type === 'hinge' ? 'hinge' : 'spherical', this.bodies[pi], this.bodies[ci], lp0, lq0, lp1, lq1);
      if (o.swing != null) { j.hasSwing = true; j.minSwing = o.swingMin != null ? o.swingMin : (type === 'hinge' ? -o.swing : 0); j.maxSwing = o.swing; }
      if (o.twist != null) { j.hasTwist = true; j.minTwist = -o.twist; j.maxTwist = o.twist; }
      j.rotDamping = o.damp || 4; j.baseDamp = j.rotDamping;
      j.owner = this; j.enabled = false;
      this.joints.push(j);
      return j;
    };
    J(RAG.PELVIS, RAG.SPINE, P[B.spine], 'spherical', { dir: UP, swing: 0.42, twist: 0.32, damp: 9 });
    J(RAG.SPINE, RAG.CHEST, P[B.chest], 'spherical', { dir: UP, swing: 0.38, twist: 0.32, damp: 9 });
    J(RAG.CHEST, RAG.HEAD, P[B.neck], 'spherical', { dir: UP, cone: new V3(0, 1, 0.12), swing: 0.8, twist: 0.95, damp: 6 });
    for (let s = 0; s < 2; s++) {
      const sg = SIDE_SIGN[s], o = s === 0 ? 0 : 3, d = rig.armDir[s];
      J(RAG.CHEST, RAG.UARM_L + o, P[SB('upperarm', s)], 'spherical', { dir: d, cone: new V3(0.495 * sg, -0.275, 0.824), swing: 1.92, twist: 1.0, damp: 3 });
      J(RAG.UARM_L + o, RAG.FARM_L + o, P[SB('forearm', s)], 'hinge', { axis: rig.elbowAxis[s], dir: d, swing: 2.5, swingMin: -0.04, damp: 2.5 });
      J(RAG.FARM_L + o, RAG.HAND_L + o, P[SB('hand', s)], 'spherical', { dir: d, swing: 1.0, twist: 0.7, damp: 1.5 });
      J(RAG.PELVIS, RAG.THIGH_L + o, P[SB('thigh', s)], 'spherical', { dir: new V3(0, -1, 0), cone: new V3(0.12 * sg, -0.7, 0.62), swing: 1.35, twist: 0.5, damp: 5 });
      J(RAG.THIGH_L + o, RAG.SHIN_L + o, P[SB('shin', s)], 'hinge', { axis: rig.kneeAxis, dir: new V3(0, -1, 0), swing: 2.6, swingMin: -0.03, damp: 3 });
      J(RAG.SHIN_L + o, RAG.FOOT_L + o, P[SB('foot', s)], 'hinge', { axis: rig.kneeAxis, dir: new V3(0, 0, 1), swing: 0.7, swingMin: -0.35, damp: 2 });
    }
    // self-collision pairs
    const sp = [];
    const arms = [[RAG.FARM_L, RAG.HAND_L], [RAG.FARM_R, RAG.HAND_R]];
    for (const [fa, ha] of arms) for (const t of [RAG.PELVIS, RAG.SPINE, RAG.CHEST, RAG.HEAD, RAG.THIGH_L, RAG.THIGH_R, RAG.SHIN_L, RAG.SHIN_R]) { sp.push([fa, t]); sp.push([ha, t]); }
    sp.push([RAG.FARM_L, RAG.FARM_R], [RAG.HAND_L, RAG.HAND_R], [RAG.FARM_L, RAG.HAND_R], [RAG.HAND_L, RAG.FARM_R]);
    sp.push([RAG.UARM_L, RAG.HEAD], [RAG.UARM_R, RAG.HEAD]);
    sp.push([RAG.SHIN_L, RAG.SHIN_R], [RAG.FOOT_L, RAG.FOOT_R], [RAG.SHIN_L, RAG.FOOT_R], [RAG.FOOT_L, RAG.SHIN_R], [RAG.THIGH_L, RAG.SHIN_R], [RAG.SHIN_L, RAG.THIGH_R]);
    this.selfPairs = sp;
  }
  addToWorld(world) {
    for (const b of this.bodies) world.addBody(b);
    for (const j of this.joints) world.addJoint(j);
    world.owners.add(this);
    this.world = world;
  }
  removeFromWorld() {
    const w = this.world; if (!w) return;
    for (const b of this.bodies) w.removeBody(b);
    for (const j of this.joints) w.removeJoint(j);
    w.removeOwner(this);
    this.world = null;
  }
  // bone world transform -> body target (kinematic)
  setFromBones(boneWPos, boneWRot, teleport) {
    for (let i = 0; i < RAG_COUNT; i++) {
      if (this.detached[i]) continue; // severed parts simulate freely
      const bi = RAG_BONE[i];
      const q = _q1.multiplyQuaternions(boneWRot[bi], this.bindRot[i]);
      const p = _v1.copy(this.boneOff[i]).applyQuaternion(boneWRot[bi]).add(boneWPos[bi]);
      const b = this.bodies[i];
      b.setKinematicTarget(p, q);
      if (teleport) { b.pos.copy(p); b.rot.copy(q); b.prevPos.copy(p); b.prevRot.copy(q); b.kinPrevPos.copy(p); b.kinPrevRot.copy(q); }
    }
  }
  // body -> bone world transform for driven bones
  boneWorldFromBody(i, outPos, outRot) {
    const b = this.bodies[i];
    _q2.copy(this.bindRot[i]).invert();
    outRot.multiplyQuaternions(b.rot, _q2);
    outPos.copy(this.boneOff[i]).applyQuaternion(outRot).negate().add(b.pos);
  }
  setDynamic(on, deadDamping) {
    this.dynamic = on;
    for (const b of this.bodies) {
      if (on) {
        if (b.kinematic) { b.vel.copy(b.kinVel); b.omega.copy(b.kinOmega); b.kinematic = false; }
        b.sleeping = false;
      } else if (!this.detached[b.index]) { b.kinematic = true; b.sleeping = false; b.vel.set(0, 0, 0); b.omega.set(0, 0, 0); }
    }
    this.asleep = false; this.sleepTimer = 0;
    const tone = Settings.data.physics.muscleTone;
    for (const j of this.joints) {
      const free = this.detached[j.b0.index] && this.detached[j.b1.index];
      j.enabled = (on || free) && !j.broken;
      j.rotDamping = j.baseDamp * (deadDamping || free ? 0.35 + tone * 0.5 : 0.7 + tone * 1.4);
    }
  }
  applyImpulseAt(i, impulse, point) {
    const b = this.bodies[i];
    if (!this.dynamic || !this.world) return;
    this.world.applyImpulse(b, impulse, point);
  }
  centerOfMass(out) {
    out.set(0, 0, 0); let m = 0;
    for (const b of this.bodies) { out.addScaledVector(b.pos, b.mass); m += b.mass; }
    return out.multiplyScalar(1 / m);
  }
  maxSpeed() { let v = 0; for (const b of this.bodies) v = Math.max(v, b.vel.length()); return v; }
}
HT.Ragdoll = Ragdoll;
