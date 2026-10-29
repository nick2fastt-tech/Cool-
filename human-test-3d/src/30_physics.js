// ============================================================================
// XPBD rigid body physics (Müller et al. 2020 "Detailed Rigid Body Simulation
// with Extended Position Based Dynamics"). Deterministic fixed-step solver with
// substeps. Shapes: capsule (local Y axis), sphere, box. Joints: spherical with
// swing/twist limits, hinge with angle limits, world attachment (grab).
// ============================================================================
const SHAPE = { CAPSULE: 0, SPHERE: 1, BOX: 2 };
const _p1 = new V3(), _p2 = new V3(), _p3 = new V3(), _p4 = new V3(), _p5 = new V3(), _p6 = new V3(), _p7 = new V3(), _p8 = new V3();
const _pq1 = new QT(), _pq2 = new QT();

class RBody {
  constructor(shape, mass) {
    this.shape = shape;
    this.pos = new V3(); this.rot = new QT();
    this.prevPos = new V3(); this.prevRot = new QT();
    this.vel = new V3(); this.omega = new V3();
    this.invInertia = new V3();
    this.setMass(mass);
    this.kinematic = false; this.sleeping = false; this.inWorld = false;
    this.friction = 0.6; this.restitution = 0.1;
    this.owner = null; this.index = 0; this.selfMask = 0;
    this.aabbMin = new V3(); this.aabbMax = new V3();
    this.linDamp = 0.02; this.angDamp = 0.08;
    this.kinPrevPos = new V3(); this.kinPrevRot = new QT(); this.kinPos = new V3(); this.kinRot = new QT();
    this.kinVel = new V3(); this.kinOmega = new V3();
    this.impact = 0; this.impactPoint = new V3();
    this.tag = '';
  }
  setMass(m) {
    this.mass = m; this.invMass = m > 0 ? 1 / m : 0;
    const s = this.shape;
    let ix, iy, iz;
    if (s.type === SHAPE.CAPSULE) {
      const L = 2 * s.hh + s.r; const r2 = s.r * s.r;
      iy = 0.5 * m * r2; ix = iz = m * (3 * r2 + L * L) / 12;
    } else if (s.type === SHAPE.SPHERE) { ix = iy = iz = 0.4 * m * s.r * s.r; }
    else { const x = 2 * s.he.x, y = 2 * s.he.y, z = 2 * s.he.z; ix = m * (y * y + z * z) / 12; iy = m * (x * x + z * z) / 12; iz = m * (x * x + y * y) / 12; }
    this.invInertia.set(m > 0 ? 1 / ix : 0, m > 0 ? 1 / iy : 0, m > 0 ? 1 / iz : 0);
  }
  isDynamic() { return !this.kinematic && !this.sleeping && this.invMass > 0; }
  getInverseMass(normal, pos) {
    const n = _p1;
    if (pos === null) n.copy(normal); else n.subVectors(pos, this.pos).cross(normal);
    _pq1.copy(this.rot).invert(); n.applyQuaternion(_pq1);
    let w = n.x * n.x * this.invInertia.x + n.y * n.y * this.invInertia.y + n.z * n.z * this.invInertia.z;
    if (pos !== null) w += this.invMass;
    return w;
  }
  applyRotation(rot, scale) {
    const maxPhi = 0.5, phi = rot.length();
    if (phi * scale > maxPhi) scale = maxPhi / phi;
    _pq2.set(rot.x * scale, rot.y * scale, rot.z * scale, 0);
    _pq2.multiply(this.rot);
    const q = this.rot;
    q.set(q.x + 0.5 * _pq2.x, q.y + 0.5 * _pq2.y, q.z + 0.5 * _pq2.z, q.w + 0.5 * _pq2.w).normalize();
  }
  applyCorrection(corr, pos, velocityLevel) {
    const dq = _p2;
    if (pos === null) dq.copy(corr);
    else {
      if (velocityLevel) this.vel.addScaledVector(corr, this.invMass);
      else this.pos.addScaledVector(corr, this.invMass);
      dq.subVectors(pos, this.pos).cross(corr);
    }
    _pq1.copy(this.rot).invert(); dq.applyQuaternion(_pq1);
    dq.set(dq.x * this.invInertia.x, dq.y * this.invInertia.y, dq.z * this.invInertia.z);
    dq.applyQuaternion(this.rot);
    if (velocityLevel) this.omega.add(dq); else this.applyRotation(dq, 1);
  }
  integrate(h, g) {
    this.prevPos.copy(this.pos); this.prevRot.copy(this.rot);
    this.vel.addScaledVector(g, h);
    this.pos.addScaledVector(this.vel, h);
    this.applyRotation(this.omega, h);
  }
  updateVelocities(h) {
    this.vel.subVectors(this.pos, this.prevPos).multiplyScalar(1 / h);
    _pq2.copy(this.prevRot).invert().premultiply(this.rot);
    this.omega.set(_pq2.x * 2 / h, _pq2.y * 2 / h, _pq2.z * 2 / h);
    if (_pq2.w < 0) this.omega.negate();
    const ld = Math.max(0, 1 - this.linDamp * h), ad = Math.max(0, 1 - this.angDamp * h);
    this.vel.multiplyScalar(ld); this.omega.multiplyScalar(ad);
  }
  velocityAt(p, out) { // world velocity at world point p
    const v = this.kinematic ? this.kinVel : this.vel, w = this.kinematic ? this.kinOmega : this.omega;
    if (this.sleeping) return out.set(0, 0, 0);
    return out.subVectors(p, this.pos).crossVectors(w, out).add(v);
  }
  segment(a, b) { // capsule end points (world)
    const hh = this.shape.hh;
    a.set(0, -hh, 0).applyQuaternion(this.rot).add(this.pos);
    b.set(0, hh, 0).applyQuaternion(this.rot).add(this.pos);
  }
  computeAABB(pad) {
    const s = this.shape;
    if (s.type === SHAPE.SPHERE) { this.aabbMin.set(-s.r, -s.r, -s.r); this.aabbMax.set(s.r, s.r, s.r); }
    else if (s.type === SHAPE.CAPSULE) {
      _p3.set(0, s.hh, 0).applyQuaternion(this.rot);
      const ex = Math.abs(_p3.x) + s.r, ey = Math.abs(_p3.y) + s.r, ez = Math.abs(_p3.z) + s.r;
      this.aabbMin.set(-ex, -ey, -ez); this.aabbMax.set(ex, ey, ez);
    } else {
      _m1.makeRotationFromQuaternion(this.rot);
      const e = _m1.elements, h = s.he;
      const ex = Math.abs(e[0]) * h.x + Math.abs(e[4]) * h.y + Math.abs(e[8]) * h.z;
      const ey = Math.abs(e[1]) * h.x + Math.abs(e[5]) * h.y + Math.abs(e[9]) * h.z;
      const ez = Math.abs(e[2]) * h.x + Math.abs(e[6]) * h.y + Math.abs(e[10]) * h.z;
      this.aabbMin.set(-ex, -ey, -ez); this.aabbMax.set(ex, ey, ez);
    }
    this.aabbMin.add(this.pos).subScalar(pad); this.aabbMax.add(this.pos).addScalar(pad);
  }
  setKinematicTarget(p, q) { this.kinPos.copy(p); this.kinRot.copy(q); }
}

// ---------------------------------------------------------------------------------
function applyBodyPairCorrection(b0, b1, corr, compliance, dt, pos0, pos1, velocityLevel) {
  const C = corr.length();
  if (C < 1e-12) return 0;
  const n = _p4.copy(corr).multiplyScalar(1 / C);
  const w0 = b0 ? b0.getInverseMass(n, pos0) : 0;
  const w1 = b1 ? b1.getInverseMass(n, pos1) : 0;
  const w = w0 + w1;
  if (w === 0) return 0;
  const lambda = -C / (w + compliance / dt / dt);
  n.multiplyScalar(-lambda);
  if (b0) b0.applyCorrection(n, pos0, velocityLevel);
  if (b1) { n.multiplyScalar(-1); b1.applyCorrection(n, pos1, velocityLevel); }
  return -lambda;
}
const _la = new V3(), _lb = new V3(), _lcx = new V3(), _lq = new QT();
function limitAngle(b0, b1, n, a, b, minAngle, maxAngle, compliance, dt, maxCorr = Math.PI) {
  _lcx.crossVectors(a, b);
  let phi = Math.asin(clamp(_lcx.dot(n), -1, 1));
  if (a.dot(b) < 0) phi = Math.PI - phi;
  if (phi > Math.PI) phi -= TAU;
  if (phi < -Math.PI) phi += TAU;
  if (phi < minAngle || phi > maxAngle) {
    phi = clamp(phi, minAngle, maxAngle);
    _lq.setFromAxisAngle(n, phi);
    const omega = _la.copy(a).applyQuaternion(_lq).cross(b);
    const len = omega.length();
    if (len > maxCorr) omega.multiplyScalar(maxCorr / len);
    applyBodyPairCorrection(b0, b1, omega, compliance, dt, null, null, false);
    return true;
  }
  return false;
}
const _ax0 = new V3(), _ax1 = new V3(), _jn = new V3(), _jc = new V3();
function axis0(q, out) { return out.set(1, 0, 0).applyQuaternion(q); }
function axis1(q, out) { return out.set(0, 1, 0).applyQuaternion(q); }

class Joint {
  constructor(type, b0, b1, lp0, lq0, lp1, lq1) {
    this.type = type; // 'spherical' | 'hinge' | 'attach'
    this.b0 = b0; this.b1 = b1;
    this.lp0 = lp0.clone(); this.lq0 = lq0.clone(); this.lp1 = lp1.clone(); this.lq1 = lq1.clone();
    this.gp0 = new V3(); this.gq0 = new QT(); this.gp1 = new V3(); this.gq1 = new QT();
    this.compliance = 0; this.rotDamping = 0; this.posDamping = 0;
    this.hasSwing = false; this.minSwing = 0; this.maxSwing = 0; this.swingCompliance = 0;
    this.hasTwist = false; this.minTwist = 0; this.maxTwist = 0; this.twistCompliance = 0;
    this.enabled = true; this.owner = null;
  }
  updateGlobal() {
    const b0 = this.b0, b1 = this.b1;
    if (b0) { this.gp0.copy(this.lp0).applyQuaternion(b0.rot).add(b0.pos); this.gq0.multiplyQuaternions(b0.rot, this.lq0); }
    else { this.gp0.copy(this.lp0); this.gq0.copy(this.lq0); }
    if (b1) { this.gp1.copy(this.lp1).applyQuaternion(b1.rot).add(b1.pos); this.gq1.multiplyQuaternions(b1.rot, this.lq1); }
    else { this.gp1.copy(this.lp1); this.gq1.copy(this.lq1); }
  }
  dyn(b) { return b && !b.kinematic && !b.sleeping ? b : null; }
  solvePos(dt) {
    const b0 = this.dyn(this.b0), b1 = this.dyn(this.b1);
    if (!b0 && !b1) return;
    if (this.type === 'hinge') {
      this.updateGlobal();
      axis0(this.gq0, _ax0); axis0(this.gq1, _ax1);
      _jc.crossVectors(_ax0, _ax1);
      applyBodyPairCorrection(b0, b1, _jc, 0, dt, null, null, false);
      if (this.hasSwing) {
        this.updateGlobal();
        axis0(this.gq0, _jn);
        axis1(this.gq0, _ax0); axis1(this.gq1, _ax1);
        limitAngle(b0, b1, _jn, _ax0, _ax1, this.minSwing, this.maxSwing, this.swingCompliance, dt);
      }
    } else if (this.type === 'spherical') {
      if (this.hasSwing) {
        this.updateGlobal();
        axis0(this.gq0, _ax0); axis0(this.gq1, _ax1);
        _jn.crossVectors(_ax0, _ax1);
        if (_jn.lengthSq() > 1e-12) {
          _jn.normalize();
          limitAngle(b0, b1, _jn, _ax0, _ax1, this.minSwing, this.maxSwing, this.swingCompliance, dt);
        }
      }
      if (this.hasTwist) {
        this.updateGlobal();
        const n0 = axis0(this.gq0, _p5), n1 = axis0(this.gq1, _p6);
        _jn.addVectors(n0, n1);
        if (_jn.lengthSq() > 1e-12) {
          _jn.normalize();
          const a0 = axis1(this.gq0, _ax0); a0.addScaledVector(_jn, -_jn.dot(a0)).normalize();
          const a1 = axis1(this.gq1, _ax1); a1.addScaledVector(_jn, -_jn.dot(a1)).normalize();
          const maxCorr = n0.dot(n1) > -0.5 ? 2 * Math.PI : 1.0 * dt;
          limitAngle(b0, b1, _jn, a0, a1, this.minTwist, this.maxTwist, this.twistCompliance, dt, maxCorr);
        }
      }
    }
    // position
    this.updateGlobal();
    _jc.subVectors(this.gp1, this.gp0);
    applyBodyPairCorrection(b0, b1, _jc, this.compliance, dt, this.gp0, this.gp1, false);
  }
  solveVel(dt) {
    const b0 = this.dyn(this.b0), b1 = this.dyn(this.b1);
    if (!b0 && !b1) return;
    if (this.rotDamping > 0) {
      _jc.set(0, 0, 0);
      if (this.b0) _jc.sub(this.b0.sleeping ? _p7.set(0, 0, 0) : this.b0.omega);
      if (this.b1) _jc.add(this.b1.sleeping ? _p7.set(0, 0, 0) : this.b1.omega);
      _jc.multiplyScalar(Math.min(1, this.rotDamping * dt));
      applyBodyPairCorrection(b0, b1, _jc, 0, dt, null, null, true);
    }
    if (this.posDamping > 0) {
      this.updateGlobal();
      _jc.set(0, 0, 0);
      if (this.b0) _jc.sub(this.b0.velocityAt(this.gp0, _p7));
      if (this.b1) _jc.add(this.b1.velocityAt(this.gp1, _p8));
      _jc.multiplyScalar(Math.min(1, this.posDamping * dt));
      applyBodyPairCorrection(b0, b1, _jc, 0, dt, this.gp0, this.gp1, true);
    }
  }
}

// ---------------------------------------------------------------------------------
// Contacts
class Contact {
  constructor() { this.b0 = null; this.b1 = null; this.n = new V3(); this.r0 = new V3(); this.r1 = new V3(); this.lambdaN = 0; this.vnPrev = 0; this.mu = 0.6; this.e = 0.1; this.active = false; }
}

// closest points between segments p1q1 and p2q2 -> c1, c2 (Ericson)
function closestSegSeg(p1, q1, p2, q2, c1, c2) {
  const d1x = q1.x - p1.x, d1y = q1.y - p1.y, d1z = q1.z - p1.z;
  const d2x = q2.x - p2.x, d2y = q2.y - p2.y, d2z = q2.z - p2.z;
  const rx = p1.x - p2.x, ry = p1.y - p2.y, rz = p1.z - p2.z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) { s = t = 0; }
  else if (a <= 1e-9) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-9) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
      s = den !== 0 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  c1.set(p1.x + d1x * s, p1.y + d1y * s, p1.z + d1z * s);
  c2.set(p2.x + d2x * t, p2.y + d2y * t, p2.z + d2z * t);
}
function closestPtSeg(p, a, b, out) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  const t = l2 > 1e-12 ? clamp(((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2, 0, 1) : 0;
  return out.set(a.x + abx * t, a.y + aby * t, a.z + abz * t);
}

class PhysicsWorld {
  constructor() {
    this.bodies = []; this.joints = []; this.owners = new Set();
    this.gravity = new V3(0, -9.81, 0);
    this.substeps = 8; this.dt = 1 / 60;
    this.planes = []; this.heightfield = null; // fn(x,z)->h, normalFn(x,z,out)
    this.contacts = []; this.contactPool = []; this.pairs = [];
    this.friction = 0.6; this.restitution = 0.1;
    this.npcCollisions = true; this.selfCollisions = true; this.propCollisions = true;
    this.stats = { bodies: 0, awake: 0, contacts: 0, pairs: 0, ms: 0, steps: 0 };
    this.time = 0;
    this.onImpact = null; // callback(body, speed, point, otherBody)
  }
  addBody(b) { if (b.inWorld) return; b.inWorld = true; this.bodies.push(b); if (b.owner) this.owners.add(b.owner); }
  removeBody(b) {
    if (!b.inWorld) return; b.inWorld = false;
    const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1);
  }
  addJoint(j) { if (this.joints.indexOf(j) < 0) this.joints.push(j); }
  removeJoint(j) { const i = this.joints.indexOf(j); if (i >= 0) this.joints.splice(i, 1); }
  removeOwner(o) { this.owners.delete(o); }
  wakeOwner(o) {
    if (!o || !o.bodies) return;
    for (const b of o.bodies) if (b.sleeping) { b.sleeping = false; b.vel.set(0, 0, 0); b.omega.set(0, 0, 0); }
    o.sleepTimer = 0; o.asleep = false;
  }
  wakeAll() { for (const o of this.owners) this.wakeOwner(o); }
  // --- step ------------------------------------------------------------------
  // call once per rendered frame before running nSteps fixed steps (kinematic interpolation)
  beginFrame(nSteps, dt) {
    this.frameSteps = Math.max(1, nSteps); this.frameIndex = 0;
    const T = this.frameSteps * dt;
    for (const b of this.bodies) {
      if (!b.kinematic) continue;
      b.kinPrevPos.copy(b.pos); b.kinPrevRot.copy(b.rot);
      b.kinVel.subVectors(b.kinPos, b.kinPrevPos).multiplyScalar(1 / T);
      _pq2.copy(b.kinPrevRot).invert().premultiply(b.kinRot);
      b.kinOmega.set(_pq2.x * 2 / T, _pq2.y * 2 / T, _pq2.z * 2 / T);
      if (_pq2.w < 0) b.kinOmega.negate();
      if (b.kinVel.lengthSq() > 625 || b.kinOmega.lengthSq() > 2500) { b.kinVel.set(0, 0, 0); b.kinOmega.set(0, 0, 0); } // teleport
    }
  }
  step(dt) {
    const t0 = performance.now();
    this.dt = dt;
    if (!this.frameSteps || this.frameIndex >= this.frameSteps) this.beginFrame(1, dt);
    const n = Math.max(1, this.substeps | 0), h = dt / n;
    const bodies = this.bodies;
    const fs = this.frameSteps, fi = this.frameIndex;
    this.broadphase(dt);
    for (let s = 0; s < n; s++) {
      const a = (fi * n + s + 1) / (fs * n);
      for (const b of bodies) {
        if (b.kinematic) {
          b.prevPos.copy(b.pos); b.prevRot.copy(b.rot);
          b.pos.lerpVectors(b.kinPrevPos, b.kinPos, a); b.rot.slerpQuaternions(b.kinPrevRot, b.kinRot, a);
        } else if (!b.sleeping && b.invMass > 0) b.integrate(h, this.gravity);
      }
      for (const j of this.joints) if (j.enabled) j.solvePos(h);
      this.solveContacts(h);
      for (const b of bodies) if (!b.kinematic && !b.sleeping && b.invMass > 0) b.updateVelocities(h);
      this.solveContactVelocities(h);
      for (const j of this.joints) if (j.enabled) j.solveVel(h);
    }
    this.updateSleep(dt);
    this.frameIndex++;
    this.time += dt;
    let awake = 0; for (const b of bodies) if (!b.kinematic && !b.sleeping) awake++;
    this.stats.bodies = bodies.length; this.stats.awake = awake; this.stats.steps++;
    this.stats.ms = performance.now() - t0;
  }
  ownerKind(o) { return o ? o.physKind : ''; }
  broadphase(dt) {
    const pairs = this.pairs; pairs.length = 0;
    const bodies = this.bodies;
    for (const b of bodies) {
      const pad = b.kinematic ? 0.05 : 0.03 + b.vel.length() * dt * 1.5;
      b.computeAABB(pad);
    }
    // owner AABBs
    const owners = [];
    for (const o of this.owners) {
      if (!o.bodies || !o.bodies.length || !o.bodies[0].inWorld) continue;
      const mn = o.aabbMin || (o.aabbMin = new V3()), mx = o.aabbMax || (o.aabbMax = new V3());
      mn.set(1e9, 1e9, 1e9); mx.set(-1e9, -1e9, -1e9);
      let anyDyn = false;
      for (const b of o.bodies) { mn.min(b.aabbMin); mx.max(b.aabbMax); if (!b.kinematic && !b.sleeping) anyDyn = true; }
      o._anyDyn = anyDyn;
      owners.push(o);
    }
    for (let i = 0; i < owners.length; i++) {
      const A = owners[i];
      // self collision
      if (A._anyDyn && A.selfPairs && this.selfCollisions) {
        for (const pr of A.selfPairs) { const b0 = A.bodies[pr[0]], b1 = A.bodies[pr[1]]; const d0 = !b0.kinematic && !b0.sleeping, d1 = !b1.kinematic && !b1.sleeping; if ((d0 || d1) && !b0.noCollide && !b1.noCollide && aabbOverlap(b0, b1)) { if (d0) pairs.push(b0, b1); else pairs.push(b1, b0); } }
      }
      for (let k = i + 1; k < owners.length; k++) {
        const Bo = owners[k];
        if (!A._anyDyn && !Bo._anyDyn) continue;
        const ka = A.physKind, kb = Bo.physKind;
        if (!this.npcCollisions && ka === 'npc' && kb === 'npc') continue;
        if (!this.propCollisions && ((ka === 'prop' && kb === 'npc') || (ka === 'npc' && kb === 'prop'))) continue;
        if (A.noCollideWith === Bo || Bo.noCollideWith === A) continue;
        if (A.aabbMax.x < Bo.aabbMin.x || A.aabbMin.x > Bo.aabbMax.x || A.aabbMax.y < Bo.aabbMin.y || A.aabbMin.y > Bo.aabbMax.y || A.aabbMax.z < Bo.aabbMin.z || A.aabbMin.z > Bo.aabbMax.z) continue;
        for (const b0 of A.bodies) {
          for (const b1 of Bo.bodies) {
            const d0 = !b0.kinematic && !b0.sleeping, d1 = !b1.kinematic && !b1.sleeping;
            if (!d0 && !d1) continue;
            if (b0.noCollide || b1.noCollide) continue;
            if (aabbOverlap(b0, b1)) { if (d0) pairs.push(b0, b1); else pairs.push(b1, b0); }
          }
        }
      }
    }
    this.stats.pairs = pairs.length / 2;
  }
  // --- contacts ------------------------------------------------------------------
  getContact() { const c = this.contactPool.pop() || new Contact(); this.contacts.push(c); return c; }
  addContact(b0, b1, p0, p1, n) {
    // p0: point on b0 surface, p1: point on b1 (or static) surface, n from b1 toward b0
    const c = this.getContact();
    c.b0 = b0; c.b1 = b1; c.n.copy(n);
    _pq1.copy(b0.rot).invert();
    c.r0.subVectors(p0, b0.pos).applyQuaternion(_pq1);
    if (b1) { _pq1.copy(b1.rot).invert(); c.r1.subVectors(p1, b1.pos).applyQuaternion(_pq1); }
    else c.r1.copy(p1);
    c.mu = b1 ? Math.sqrt(b0.friction * b1.friction) : b0.friction * this.friction / 0.6;
    c.e = b1 ? Math.max(b0.restitution, b1.restitution) : Math.max(b0.restitution, this.restitution);
    c.lambdaN = 0; c.active = false;
    // pre-solve normal velocity
    const v0 = b0.velocityAt(p0, _p7);
    if (b1) v0.sub(b1.velocityAt(p1, _p8));
    c.vnPrev = v0.dot(n);
    return c;
  }
  generateContacts() {
    for (const c of this.contacts) this.contactPool.push(c);
    this.contacts.length = 0;
    const bodies = this.bodies;
    // static environment
    for (const b of bodies) {
      if (b.kinematic || b.sleeping || b.invMass === 0 || b.noCollide) continue;
      this.collideStatic(b);
    }
    const pairs = this.pairs;
    for (let i = 0; i < pairs.length; i += 2) this.collidePair(pairs[i], pairs[i + 1]);
  }
  collideStatic(b) {
    const s = b.shape;
    const pts = s.type === SHAPE.BOX ? boxCorners(b) : sphereCenters(b);
    const r = s.type === SHAPE.BOX ? 0 : s.r;
    for (const pl of this.planes) {
      for (const P of pts) {
        const dist = pl.n.dot(P) - pl.d - r;
        if (dist < 0) {
          const p0 = _p5.copy(P).addScaledVector(pl.n, -r);
          const p1 = _p6.copy(p0).addScaledVector(pl.n, -(pl.n.dot(p0) - pl.d));
          this.addContact(b, null, p0, p1, pl.n);
        }
      }
    }
    if (this.heightfield) {
      for (const P of pts) {
        const hgt = this.heightfield(P.x, P.z);
        if (P.y - r - hgt > 0.05) continue;
        const nrm = this.heightNormal(P.x, P.z, _p3);
        const d = nrm.x * P.x + nrm.y * hgt + nrm.z * P.z;
        const dist = nrm.dot(P) - d - r;
        if (dist < 0) {
          const p0 = _p5.copy(P).addScaledVector(nrm, -r);
          const p1 = _p6.copy(p0).addScaledVector(nrm, -(nrm.dot(p0) - d));
          this.addContact(b, null, p0, p1, nrm.clone());
        }
      }
    }
  }
  collidePair(b0, b1) {
    const s0 = b0.shape, s1 = b1.shape;
    const t0 = s0.type, t1 = s1.type;
    if (t0 !== SHAPE.BOX && t1 !== SHAPE.BOX) {
      // round shapes: capsule/sphere as segments
      const a0 = _p1c, c0 = _p2c, a1 = _p3c, c1 = _p4c;
      segOf(b0, a0, c0); segOf(b1, a1, c1);
      const q0 = _q0c, q1 = _q1c;
      closestSegSeg(a0, c0, a1, c1, q0, q1);
      const r = s0.r + s1.r;
      const dx = q0.x - q1.x, dy = q0.y - q1.y, dz = q0.z - q1.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= r * r) return;
      const d = Math.sqrt(d2);
      const n = _nC.set(dx, dy, dz);
      if (d < 1e-6) n.set(0, 1, 0); else n.multiplyScalar(1 / d);
      const p0 = _p5.copy(q0).addScaledVector(n, -s0.r);
      const p1 = _p6.copy(q1).addScaledVector(n, s1.r);
      this.addContact(b0, b1, p0, p1, n);
      return;
    }
    if (t0 === SHAPE.BOX && t1 === SHAPE.BOX) {
      for (const P of boxCorners(b0)) this.pointBox(b0, P, 0, b1, false);
      for (const P of boxCorners(b1)) this.pointBox(b1, P, 0, b0, true, b0);
      return;
    }
    // box vs round
    const box = t0 === SHAPE.BOX ? b0 : b1, rnd = t0 === SHAPE.BOX ? b1 : b0;
    const centers = sphereCenters(rnd, true);
    for (const P of centers) {
      if (rnd === b0) this.pointBox(rnd, P, rnd.shape.r, box, false);
      else this.pointBox(rnd, P, rnd.shape.r, box, true, b0);
    }
  }
  // sphere (center P, radius r) belonging to body 'pb' vs box 'bx'.
  // if swap: contact is generated with first body = dynamic one given as 'first'
  pointBox(pb, P, r, bx, swap, first) {
    const he = bx.shape.he;
    _pq1.copy(bx.rot).invert();
    const lp = _p7.subVectors(P, bx.pos).applyQuaternion(_pq1);
    const cx = clamp(lp.x, -he.x, he.x), cy = clamp(lp.y, -he.y, he.y), cz = clamp(lp.z, -he.z, he.z);
    let nx, ny, nz, dist;
    const inside = cx === lp.x && cy === lp.y && cz === lp.z;
    let cpx = cx, cpy = cy, cpz = cz;
    if (!inside) {
      nx = lp.x - cx; ny = lp.y - cy; nz = lp.z - cz;
      dist = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (dist >= r) return;
      nx /= dist; ny /= dist; nz /= dist;
    } else {
      const dxp = he.x - lp.x, dxn = he.x + lp.x, dyp = he.y - lp.y, dyn = he.y + lp.y, dzp = he.z - lp.z, dzn = he.z + lp.z;
      let m = dxp; nx = 1; ny = 0; nz = 0; cpx = he.x;
      if (dxn < m) { m = dxn; nx = -1; ny = 0; nz = 0; cpx = -he.x; cpy = lp.y; cpz = lp.z; }
      if (dyp < m) { m = dyp; nx = 0; ny = 1; nz = 0; cpx = lp.x; cpy = he.y; cpz = lp.z; }
      if (dyn < m) { m = dyn; nx = 0; ny = -1; nz = 0; cpx = lp.x; cpy = -he.y; cpz = lp.z; }
      if (dzp < m) { m = dzp; nx = 0; ny = 0; nz = 1; cpx = lp.x; cpy = lp.y; cpz = he.z; }
      if (dzn < m) { m = dzn; nx = 0; ny = 0; nz = -1; cpx = lp.x; cpy = lp.y; cpz = -he.z; }
      if (nx === 1) { cpy = lp.y; cpz = lp.z; }
      dist = -m;
    }
    // world normal (from box toward sphere)
    const n = _nC.set(nx, ny, nz).applyQuaternion(bx.rot);
    const pBox = _p8.set(cpx, cpy, cpz).applyQuaternion(bx.rot).add(bx.pos);
    const pSph = _p5.copy(P).addScaledVector(n, -r);
    const bxDyn = !bx.kinematic && !bx.sleeping;
    const pbDyn = !pb.kinematic && !pb.sleeping;
    if (pbDyn) this.addContact(pb, bx, pSph, pBox, n);
    else if (bxDyn) { n.negate(); this.addContact(bx, pb, pBox, pSph, n); }
  }
  heightNormal(x, z, out) { return this.heightNormalFn ? this.heightNormalFn(x, z, out) : out.set(0, 1, 0); }
  solveContacts(h) {
    this.generateContacts();
    const contacts = this.contacts;
    for (const c of contacts) {
      const b0 = c.b0, b1 = c.b1;
      const b1d = b1 && !b1.kinematic && !b1.sleeping && b1.invMass > 0 ? b1 : null;
      const P0 = _cp0.copy(c.r0).applyQuaternion(b0.rot).add(b0.pos);
      const P1 = b1 ? _cp1.copy(c.r1).applyQuaternion(b1.rot).add(b1.pos) : _cp1.copy(c.r1);
      const d = _cd.subVectors(P0, P1).dot(c.n);
      if (d >= 0) continue;
      c.active = true;
      const corr = _cc.copy(c.n).multiplyScalar(-d);
      c.lambdaN = applyBodyPairCorrection(b0, b1d, corr, 0, h, P0, P1, false);
      // static friction
      const P0n = _cp0.copy(c.r0).applyQuaternion(b0.rot).add(b0.pos);
      const P0p = _cp2.copy(c.r0).applyQuaternion(b0.prevRot).add(b0.prevPos);
      const dp = _cd.subVectors(P0n, P0p);
      if (b1 && !b1.sleeping) {
        const P1n = _cp1.copy(c.r1).applyQuaternion(b1.rot).add(b1.pos);
        const P1p = _cp3.copy(c.r1).applyQuaternion(b1.prevRot).add(b1.prevPos);
        dp.sub(P1n).add(P1p);
      }
      dp.addScaledVector(c.n, -dp.dot(c.n));
      const dpl = dp.length();
      if (dpl > 1e-9 && dpl < c.mu * 1.3 * (-d)) {
        dp.negate();
        applyBodyPairCorrection(b0, b1d, dp, 0, h, P0n, b1 ? _cp1 : null, false);
      }
    }
  }
  solveContactVelocities(h) {
    const g = this.gravity.length();
    for (const c of this.contacts) {
      if (!c.active) continue;
      const b0 = c.b0, b1 = c.b1;
      const b1d = b1 && !b1.kinematic && !b1.sleeping && b1.invMass > 0 ? b1 : null;
      const P0 = _cp0.copy(c.r0).applyQuaternion(b0.rot).add(b0.pos);
      const P1 = b1 ? _cp1.copy(c.r1).applyQuaternion(b1.rot).add(b1.pos) : _cp1.copy(c.r1);
      const v = b0.velocityAt(P0, _cv0);
      if (b1) v.sub(b1.velocityAt(P1, _cv1));
      const vn = v.dot(c.n);
      const vt = _cv1.copy(v).addScaledVector(c.n, -vn);
      const vtl = vt.length();
      const dv = _cdv.set(0, 0, 0);
      if (vtl > 1e-6) {
        const fn = Math.abs(c.lambdaN) / (h * h);
        dv.addScaledVector(vt, -Math.min(h * c.mu * fn, vtl) / vtl);
      }
      const e = Math.abs(vn) <= 2 * g * h ? 0 : c.e;
      dv.addScaledVector(c.n, -vn + Math.max(-e * c.vnPrev, 0));
      if (dv.lengthSq() > 1e-12) applyBodyPairCorrection(b0, b1d, dv, 0, h, P0, b1 ? P1 : null, true);
      // impact reporting (for audio/reactions)
      const imp = -c.vnPrev;
      if (imp > b0.impact) { b0.impact = imp; b0.impactPoint.copy(P0); b0.impactOther = b1; }
      if (b1 && imp > b1.impact) { b1.impact = imp; b1.impactPoint.copy(P1); b1.impactOther = b0; }
      // wake sleeping partner on strong contact
      if (b1 && b1.sleeping && Math.abs(c.vnPrev) > 0.8) this.wakeOwner(b1.owner);
    }
    this.stats.contacts = this.contacts.length;
  }
  updateSleep(dt) {
    for (const o of this.owners) {
      if (!o.bodies || !o.canSleep) continue;
      if (o.asleep) continue;
      let maxV = 0, maxW = 0, anyDyn = false;
      for (const b of o.bodies) {
        if (b.kinematic) continue; anyDyn = true;
        maxV = Math.max(maxV, b.vel.lengthSq()); maxW = Math.max(maxW, b.omega.lengthSq());
      }
      if (!anyDyn) continue;
      if (maxV < 0.06 * 0.06 && maxW < 0.25 * 0.25) {
        o.sleepTimer = (o.sleepTimer || 0) + dt;
        if (o.sleepTimer > 0.8 && !o.noSleep) {
          o.asleep = true;
          for (const b of o.bodies) if (!b.kinematic) { b.sleeping = true; b.vel.set(0, 0, 0); b.omega.set(0, 0, 0); }
        }
      } else o.sleepTimer = 0;
    }
  }
  // --- queries --------------------------------------------------------------------
  applyImpulse(b, impulse, point) {
    if (!b || b.kinematic || b.invMass === 0) return;
    if (b.sleeping) this.wakeOwner(b.owner);
    applyBodyPairCorrection(b, null, impulse, 0, 1, point || null, null, true);
  }
  // radial explosion impulse
  explosion(center, radius, strength, filterFn) {
    const hits = [];
    for (const b of this.bodies) {
      if (b.kinematic || b.invMass === 0) continue;
      if (filterFn && !filterFn(b)) continue;
      const d = b.pos.distanceTo(center);
      if (d > radius) continue;
      const f = Math.pow(1 - d / radius, 1.6);
      const dir = _p3.subVectors(b.pos, center); dir.y += 0.35 * dir.length() + 0.3; dir.normalize();
      const J = dir.multiplyScalar(strength * f * b.mass);
      this.applyImpulse(b, J, null);
      hits.push(b);
    }
    return hits;
  }
  // ray vs bodies: returns {body, dist, point, normal}
  raycast(origin, dir, maxDist, filterFn) {
    let best = null, bestT = maxDist;
    for (const b of this.bodies) {
      if (filterFn && !filterFn(b)) continue;
      const t = rayBody(origin, dir, b, bestT);
      if (t !== null && t < bestT) { bestT = t; best = b; }
    }
    if (!best) return null;
    const point = origin.clone().addScaledVector(dir, bestT);
    return { body: best, dist: bestT, point };
  }
}
const _p1c = new V3(), _p2c = new V3(), _p3c = new V3(), _p4c = new V3(), _q0c = new V3(), _q1c = new V3(), _nC = new V3();
const _cp0 = new V3(), _cp1 = new V3(), _cp2 = new V3(), _cp3 = new V3(), _cd = new V3(), _cc = new V3(), _cv0 = new V3(), _cv1 = new V3(), _cdv = new V3();
function aabbOverlap(a, b) {
  return !(a.aabbMax.x < b.aabbMin.x || a.aabbMin.x > b.aabbMax.x || a.aabbMax.y < b.aabbMin.y || a.aabbMin.y > b.aabbMax.y || a.aabbMax.z < b.aabbMin.z || a.aabbMin.z > b.aabbMax.z);
}
function segOf(b, a, c) {
  if (b.shape.type === SHAPE.SPHERE) { a.copy(b.pos); c.copy(b.pos); }
  else b.segment(a, c);
}
const _corners = []; for (let i = 0; i < 8; i++) _corners.push(new V3());
function boxCorners(b) {
  const he = b.shape.he;
  for (let i = 0; i < 8; i++) _corners[i].set(i & 1 ? he.x : -he.x, i & 2 ? he.y : -he.y, i & 4 ? he.z : -he.z).applyQuaternion(b.rot).add(b.pos);
  return _corners;
}
const _sc = [new V3(), new V3(), new V3()];
function sphereCenters(b, withMid) {
  if (b.shape.type === SHAPE.SPHERE) { _sc[0].copy(b.pos); return [_sc[0]]; }
  b.segment(_sc[0], _sc[1]);
  if (withMid) { _sc[2].addVectors(_sc[0], _sc[1]).multiplyScalar(0.5); return _sc; }
  return [_sc[0], _sc[1]];
}
// ray-shape intersection, returns t or null
const _rl = new V3(), _rd = new V3();
function rayBody(o, d, b, maxT) {
  const s = b.shape;
  if (s.type === SHAPE.SPHERE) return raySphere(o, d, b.pos, s.r, maxT);
  if (s.type === SHAPE.CAPSULE) { b.segment(_p1, _p2); return rayCapsule(o, d, _p1, _p2, s.r, maxT); }
  // box: to local
  _pq1.copy(b.rot).invert();
  _rl.subVectors(o, b.pos).applyQuaternion(_pq1); _rd.copy(d).applyQuaternion(_pq1);
  let tmin = 0, tmax = maxT;
  for (const ax of ['x', 'y', 'z']) {
    const he = s.he[ax];
    if (Math.abs(_rd[ax]) < 1e-9) { if (_rl[ax] < -he || _rl[ax] > he) return null; }
    else {
      let t1 = (-he - _rl[ax]) / _rd[ax], t2 = (he - _rl[ax]) / _rd[ax];
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
function raySphere(o, d, c, r, maxT) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
  if (cc > 0 && b > 0) return null;
  const disc = b * b - cc; if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  const tt = t < 0 ? 0 : t;
  return tt <= maxT ? tt : null;
}
function rayCapsule(o, d, a, b, r, maxT) {
  // test infinite cylinder then end spheres
  let best = null;
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
  const oax = o.x - a.x, oay = o.y - a.y, oaz = o.z - a.z;
  const baba = bax * bax + bay * bay + baz * baz;
  const bard = bax * d.x + bay * d.y + baz * d.z;
  const baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = d.x * oax + d.y * oay + d.z * oaz;
  const oaoa = oax * oax + oay * oay + oaz * oaz;
  const A = baba - bard * bard, Bq = baba * rdoa - baoa * bard, Cq = baba * oaoa - baoa * baoa - r * r * baba;
  const h = Bq * Bq - A * Cq;
  if (h >= 0 && A > 1e-12) {
    const t = (-Bq - Math.sqrt(h)) / A;
    const y = baoa + t * bard;
    if (y > 0 && y < baba && t >= 0 && t <= maxT) best = t;
  }
  const t1 = raySphere(o, d, a, r, maxT), t2 = raySphere(o, d, b, r, maxT);
  if (t1 !== null && (best === null || t1 < best)) best = t1;
  if (t2 !== null && (best === null || t2 < best)) best = t2;
  return best;
}
HT.PhysicsWorld = PhysicsWorld;
