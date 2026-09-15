// T10 World - procedural character animation.
// No animation clips: every pose is computed from the locomotion phase and a
// per-character motion profile, then blended. That gives each human a distinct
// walk and keeps transitions continuous instead of snapping between clips.
import * as THREE from '../../vendor/three.module.js';
import { clamp01, clampv, lerpv, smooth01, damp, wrapAngle, TAU, DEG, makeRng, noise1 } from '../core/math.js';
import { solveTwoBoneIK } from './skeleton.js';

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

/** Per-character motion personality. Two people never move quite the same. */
export function makeMotionProfile(rng, params) {
  const female = params.gender === 'female';
  const heightFactor = params.height / (female ? 1.65 : 1.78);
  return {
    strideScale: rng.range(0.86, 1.16),
    cadenceScale: rng.range(0.92, 1.10) / Math.sqrt(heightFactor),
    armSwing: rng.range(0.62, 1.32),
    armBend: rng.range(0.5, 1.5),
    bounce: rng.range(0.7, 1.3),
    hipSway: (female ? rng.range(0.9, 1.7) : rng.range(0.4, 1.0)),
    shoulderRoll: rng.range(0.4, 1.5),
    lean: rng.range(0.6, 1.4),
    toeOut: rng.range(-0.06, 0.22),
    bowLeg: rng.range(-0.035, 0.05),
    headBob: rng.range(0.5, 1.4),
    headTilt: rng.range(-0.05, 0.05),
    swagger: rng.range(0, 1),
    energy: rng.range(0.7, 1.25),
    idleShiftRate: rng.range(0.05, 0.16),
    blinkRate: rng.range(0.16, 0.34),
    gazeRate: rng.range(0.25, 0.7),
    breathRate: rng.range(0.20, 0.30),
    phase: rng() * TAU,
    limp: rng.chance(0.06) ? rng.range(0.1, 0.3) : 0,
    armsCrossed: rng.chance(0.12),
    handsInPockets: rng.chance(0.14),
  };
}

export const STATES = {
  IDLE: 'idle', WALK: 'walk', RUN: 'run', SPRINT: 'sprint', JUMP: 'jump', FALL: 'fall',
  LAND: 'land', CROUCH: 'crouch', SIT: 'sit', DRIVE: 'drive', TALK: 'talk', USE: 'use',
  CLIMB: 'climb', SWIM: 'swim', GETUP: 'getup', LIE: 'lie', DANCE: 'dance', WAVE: 'wave',
  PHONE: 'phone', EAT: 'eat', EXERCISE: 'exercise', CARRY: 'carry', AIM: 'aim', DEAD: 'dead',
  SALUTE: 'salute', CLAP: 'clap', POINT: 'point', CHEER: 'cheer', THINK: 'think',
  STRETCH: 'stretch', BOW: 'bow',
};

export class HumanAnimator {
  constructor(rig, prop, profile) {
    this.rig = rig;                 // { boneMap, face, proportions }
    this.bones = rig.boneMap;
    this.prop = prop;
    this.profile = profile;
    this.state = STATES.IDLE;
    this.prevState = STATES.IDLE;
    this.stateTime = 0;
    this.blend = 1;

    this.phase = profile.phase;
    this.speed = 0;
    this.targetSpeed = 0;
    this.turnRate = 0;
    this.grounded = true;
    this.verticalVel = 0;

    // Additive layer state
    this.breathT = Math.random() * 10;
    this.blinkTimer = 1 + Math.random() * 3;
    this.blinkValue = 0;
    this.blinkPhase = 0;
    this.gazeTimer = 0;
    this.gazeTarget = new THREE.Vector2(0, 0);
    this.gazeCurrent = new THREE.Vector2(0, 0);
    this.lookAtWorld = null;
    this.lookWeight = 0;
    this.headYaw = 0; this.headPitch = 0;
    this.jawOpen = 0; this.jawTarget = 0;
    this.talking = false;
    this.talkT = 0;
    this.browRaise = 0;
    this.mouthSmile = 0;

    this.idleShiftT = Math.random() * 10;
    this.idleVariant = 0;
    this.idleVariantTimer = 4 + Math.random() * 8;

    this.hipsOffset = new THREE.Vector3();
    this.hipsExtraRot = new THREE.Euler();
    this.footIK = { enabled: true, L: 0, R: 0, targetL: new THREE.Vector3(), targetR: new THREE.Vector3(), normalL: new THREE.Vector3(0, 1, 0), normalR: new THREE.Vector3(0, 1, 0) };
    this.groundSampler = null;       // (x, z) => { y, normal }
    this.lastFootY = { L: 0, R: 0 };
    this.footPlant = { L: 0, R: 0 };
    this.onFootstep = null;
    this._stepFlag = { L: false, R: false };

    this.handTargets = { L: null, R: null };   // world-space IK targets (steering wheel, door)
    this.handWeights = { L: 0, R: 0 };

    // Cached rest quaternions for blending.
    this._target = {};
    for (const name in this.bones) this._target[name] = new THREE.Quaternion();
    this._rate = 14;
  }

  setState(state, opts) {
    if (this.state === state) return;
    this.prevState = this.state;
    this.state = state;
    this.stateTime = 0;
    this.stateOpts = opts || {};
  }

  setLookTarget(worldPos, weight) {
    this.lookAtWorld = worldPos;
    this.lookWeight = weight == null ? 1 : clamp01(weight);
  }

  setTalking(v, intensity) {
    this.talking = v;
    this.talkIntensity = intensity == null ? 1 : intensity;
  }

  /** Main entry. `move` = { speed, turnRate, grounded, verticalVel }. */
  update(dt, move, rootObject) {
    dt = Math.min(dt, 0.1);
    this.stateTime += dt;
    const p = this.profile;

    this.speed = damp(this.speed, move.speed, 0.0008, dt);
    this.turnRate = damp(this.turnRate, move.turnRate || 0, 0.002, dt);
    this.grounded = move.grounded;
    this.verticalVel = move.verticalVel || 0;

    // ---- Locomotion phase ------------------------------------------------
    const legLen = this.prop.measure.crotchY;
    const strideLen = legLen * 0.92 * p.strideScale * (1 + this.speed * 0.055);
    if (this.isLocomotion()) {
      const cadence = (this.speed / Math.max(0.2, strideLen)) * p.cadenceScale;
      this.phase += cadence * dt;
      this.phase %= 1;
      if (this.phase < 0) this.phase += 1;
    } else if (this.state === STATES.IDLE) {
      this.phase = damp(this.phase, Math.round(this.phase * 4) / 4, 0.02, dt);
    }

    // ---- Build the target pose ------------------------------------------
    this.resetTarget();
    switch (this.state) {
      case STATES.WALK: case STATES.RUN: case STATES.SPRINT: this.poseLocomotion(dt); break;
      case STATES.JUMP: this.poseJump(dt); break;
      case STATES.FALL: this.poseFall(dt); break;
      case STATES.LAND: this.poseLand(dt); break;
      case STATES.CROUCH: this.poseCrouch(dt); break;
      case STATES.SIT: this.poseSit(dt); break;
      case STATES.DRIVE: this.poseDrive(dt); break;
      case STATES.CLIMB: this.poseClimb(dt); break;
      case STATES.SWIM: this.poseSwim(dt); break;
      case STATES.LIE: this.poseLie(dt); break;
      case STATES.GETUP: this.poseGetUp(dt); break;
      case STATES.DANCE: this.poseDance(dt); break;
      case STATES.WAVE: this.poseWave(dt); break;
      case STATES.PHONE: this.posePhone(dt); break;
      case STATES.EAT: this.poseEat(dt); break;
      case STATES.EXERCISE: this.poseExercise(dt); break;
      case STATES.CARRY: this.poseCarry(dt); break;
      case STATES.USE: this.poseUse(dt); break;
      case STATES.SALUTE: this.poseSalute(dt); break;
      case STATES.CLAP: this.poseClap(dt); break;
      case STATES.POINT: this.posePoint(dt); break;
      case STATES.CHEER: this.poseCheer(dt); break;
      case STATES.THINK: this.poseThink(dt); break;
      case STATES.STRETCH: this.poseStretch(dt); break;
      case STATES.BOW: this.poseBow(dt); break;
      case STATES.DEAD: this.poseDead(dt); break;
      default: this.poseIdle(dt); break;
    }

    // ---- Additive layers -------------------------------------------------
    this.applyBreathing(dt);
    this.applyTurnLean(dt);
    if (this.rig.facial !== false) {
      this.applyBlink(dt);
      this.applyGaze(dt);
      this.applyTalk(dt);
    }
    this.applyLookAt(dt);

    // ---- Commit: slerp bones toward the target pose ------------------------
    const rate = 1 - Math.exp(-this._rate * dt);
    for (const name in this.bones) {
      const b = this.bones[name];
      const t = this._target[name];
      if (!t) continue;
      b.quaternion.slerp(t, rate);
    }

    // Hips translation (bob, sway, crouch offsets).
    const hips = this.bones.hips;
    if (hips) {
      const rest = hips.userData.restLocal;
      hips.position.x = damp(hips.position.x, rest.x + this.hipsOffset.x, 0.0005, dt);
      hips.position.y = damp(hips.position.y, rest.y + this.hipsOffset.y, 0.0005, dt);
      hips.position.z = damp(hips.position.z, rest.z + this.hipsOffset.z, 0.0005, dt);
    }

    // ---- IK passes --------------------------------------------------------
    if (rootObject) {
      rootObject.updateMatrixWorld(true);
      if (this.footIK.enabled && this.groundSampler && this.isGroundedState()) this.applyFootIK(rootObject, dt);
      if (this.handTargets.L || this.handTargets.R) this.applyHandIK(rootObject);
    }

    this.detectFootsteps();
  }

  isLocomotion() { return this.state === STATES.WALK || this.state === STATES.RUN || this.state === STATES.SPRINT; }
  isGroundedState() {
    return this.state !== STATES.JUMP && this.state !== STATES.FALL && this.state !== STATES.SIT &&
      this.state !== STATES.DRIVE && this.state !== STATES.SWIM && this.state !== STATES.LIE &&
      this.state !== STATES.CLIMB && this.state !== STATES.DEAD;
  }

  resetTarget() {
    for (const name in this._target) this._target[name].identity();
    this.hipsOffset.set(0, 0, 0);
    this.eyeSquint = 0;
  }

  /** Set a target bone rotation (replaces). Angles in radians. */
  set(name, x, y, z, order) {
    const t = this._target[name];
    if (!t) return;
    _e.set(x || 0, y || 0, z || 0, order || 'XYZ');
    t.setFromEuler(_e);
  }
  /** Add a rotation on top of whatever the pose set. */
  add(name, x, y, z, order) {
    const t = this._target[name];
    if (!t) return;
    _e.set(x || 0, y || 0, z || 0, order || 'XYZ');
    _q.setFromEuler(_e);
    t.multiply(_q);
  }

  // =========================================================================
  // Poses
  // =========================================================================

  poseIdle(dt) {
    const p = this.profile;
    this._rate = 6;
    this.idleShiftT += dt * p.idleShiftRate;
    this.idleVariantTimer -= dt;
    if (this.idleVariantTimer <= 0) {
      this.idleVariantTimer = 5 + Math.random() * 10;
      this.idleVariant = Math.floor(Math.random() * 3);
    }
    const t = this.idleShiftT;
    // Slow weight shift from one leg to the other.
    const shift = Math.sin(t * TAU * 0.35) * 0.5 + Math.sin(t * TAU * 0.13) * 0.25;
    const sway = Math.sin(t * TAU * 0.21) * 0.6;

    this.hipsOffset.x = shift * this.prop.measure.height * 0.011;
    this.hipsOffset.y = -Math.abs(shift) * this.prop.measure.height * 0.004;

    this.set('hips', 0, shift * 0.05, -shift * 0.045);
    this.set('spine', 0.012, -shift * 0.03, shift * 0.03);
    this.set('chest', 0.006, sway * 0.04, shift * 0.018);
    this.set('neck', -0.02, sway * 0.05, -shift * 0.02);
    this.set('head', 0.01 + p.headTilt, sway * 0.07, p.headTilt);

    // Arms hang with a natural inward rotation, elbows slightly bent.
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      const armSwing = Math.sin(t * TAU * 0.29 + (s > 0 ? 0 : 1.4)) * 0.03;
      if (p.armsCrossed && this.idleVariant === 1) {
        this.set('clavicle' + S, 0, 0, -s * 0.06);
        this.set('upperArm' + S, 0.35, -s * 0.55, -s * (1.16 - 0.25));
        this.set('lowerArm' + S, 0, -s * 1.55, 0);
      } else if (p.handsInPockets && this.idleVariant === 2) {
        this.set('clavicle' + S, 0, 0, -s * 0.04);
        this.set('upperArm' + S, 0.16, s * 0.10, -s * 1.18);
        this.set('lowerArm' + S, 0, -s * 0.72, 0);
      } else {
        this.set('clavicle' + S, 0, 0, -s * 0.03 + shift * 0.02 * s);
        this.set('upperArm' + S, 0.03 + armSwing, s * 0.08, -s * (1.30 - shift * 0.03 * s));
        this.set('lowerArm' + S, 0, -s * (0.22 + p.armBend * 0.10), 0);
      }
      this.set('hand' + S, 0, 0, s * 0.06);
      this.relaxFingers(S, 0.52);
    }

    // Weight-bearing leg straight, other slightly bent and turned out.
    const bearing = shift > 0 ? 'L' : 'R';
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      const isFree = S !== bearing;
      const free = isFree ? Math.abs(shift) : 0;
      this.set('upperLeg' + S, -free * 0.10, s * (p.toeOut * 0.6 + free * 0.10), s * p.bowLeg);
      this.set('lowerLeg' + S, free * 0.22, 0, 0);
      this.set('foot' + S, -free * 0.10, s * p.toeOut, 0);
      this.set('toe' + S, 0, 0, 0);
    }
  }

  poseLocomotion(dt) {
    const p = this.profile;
    this._rate = 18;
    const spd = this.speed;
    const run = clamp01((spd - 2.1) / 2.4);
    const sprint = clamp01((spd - 4.6) / 2.6);
    const walkAmt = 1 - run;
    const ph = this.phase * TAU;

    // Amplitudes ramp continuously from walk through sprint.
    const thighAmp = lerpv(0.40, lerpv(0.70, 0.88, sprint), run) * p.strideScale;
    const kneeAmp = lerpv(0.95, lerpv(1.85, 2.25, sprint), run);
    const armAmp = lerpv(0.34, lerpv(0.85, 1.15, sprint), run) * p.armSwing;
    const elbowBase = lerpv(0.30, lerpv(1.30, 1.65, sprint), run) * p.armBend;
    const bounce = lerpv(0.014, lerpv(0.030, 0.042, sprint), run) * p.bounce;
    const lean = lerpv(0.03, lerpv(0.16, 0.30, sprint), run) * p.lean;
    const swayAmt = lerpv(0.075, 0.045, run) * p.hipSway;

    // Vertical bob peaks twice per cycle; lateral sway once.
    this.hipsOffset.y = (-Math.abs(Math.cos(ph)) * bounce + bounce * 0.42) * this.prop.measure.height;
    this.hipsOffset.x = Math.sin(ph) * swayAmt * this.prop.measure.height * 0.12;
    this.hipsOffset.z = -lean * this.prop.measure.height * 0.03;

    const pelvisYaw = Math.sin(ph) * lerpv(0.10, 0.18, run);
    const pelvisRoll = -Math.sin(ph) * swayAmt * 0.5;
    this.set('hips', lean * 0.45, pelvisYaw, pelvisRoll);
    this.set('spine', lean * 0.30, -pelvisYaw * 0.55, -pelvisRoll * 0.4);
    this.set('chest', lean * 0.22, -pelvisYaw * 0.85 * p.shoulderRoll, -pelvisRoll * 0.3);
    this.set('neck', -lean * 0.42, pelvisYaw * 0.25, 0);
    this.set('head', -lean * 0.24 + Math.sin(ph * 2) * 0.02 * p.headBob, pelvisYaw * 0.18, p.headTilt);

    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      // Right leg is half a cycle behind the left.
      const legPh = ph + (S === 'L' ? 0 : Math.PI);
      const limp = (S === 'L' && p.limp) ? p.limp : 0;

      const swing = Math.sin(legPh);
      const thigh = swing * thighAmp * (1 - limp * 0.5);
      // Knee flexes during swing and absorbs on contact.
      const kneeSwing = Math.max(0, -Math.cos(legPh)) * kneeAmp * 0.55;
      const kneeStance = Math.max(0, Math.sin(legPh + Math.PI * 0.35)) * lerpv(0.12, 0.34, run);
      const knee = kneeSwing + kneeStance + limp * 0.3;

      this.set('upperLeg' + S, -thigh, s * p.toeOut * 0.5, s * p.bowLeg);
      this.set('lowerLeg' + S, knee, 0, 0);
      // Ankle: toe-off at the back, heel-strike at the front.
      const ankle = -swing * lerpv(0.30, 0.45, run) + Math.max(0, Math.cos(legPh)) * lerpv(0.18, 0.40, run);
      this.set('foot' + S, ankle, s * p.toeOut, 0);
      this.set('toe' + S, Math.max(0, -Math.cos(legPh)) * lerpv(0.15, 0.55, run), 0, 0);

      // Arms counter-swing.
      const armPh = legPh + Math.PI;
      const armSwing = Math.sin(armPh) * armAmp;
      this.set('clavicle' + S, 0, -Math.sin(armPh) * 0.06 * p.shoulderRoll, -s * 0.03);
      this.set('upperArm' + S,
        armSwing,
        s * (0.10 + run * 0.14),
        -s * (1.30 - lerpv(0.10, 0.42, run) - Math.max(0, armSwing) * 0.10)
      );
      this.set('lowerArm' + S, 0, -s * (elbowBase + Math.max(0, -armSwing) * 0.35), 0);
      this.set('hand' + S, Math.sin(armPh) * 0.12, 0, s * 0.06);
      this.relaxFingers(S, lerpv(0.38, 0.72, run));
    }
  }

  poseJump(dt) {
    this._rate = 16;
    const t = clamp01(this.stateTime / 0.35);
    const tuck = Math.sin(t * Math.PI) * 0.6 + 0.25;
    this.hipsOffset.y = -tuck * this.prop.measure.height * 0.012;
    this.set('hips', 0.08, 0, 0);
    this.set('spine', 0.10, 0, 0);
    this.set('chest', 0.06, 0, 0);
    this.set('neck', -0.10, 0, 0);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('upperLeg' + S, -0.55 * tuck, s * 0.08, s * 0.05);
      this.set('lowerLeg' + S, 0.95 * tuck, 0, 0);
      this.set('foot' + S, 0.35, s * 0.06, 0);
      this.set('upperArm' + S, -1.05 * tuck, s * 0.25, -s * 0.75);
      this.set('lowerArm' + S, 0, -s * 0.5, 0);
      this.relaxFingers(S, 0.5);
    }
  }

  poseFall(dt) {
    this._rate = 9;
    const wind = Math.sin(this.stateTime * 7) * 0.08;
    const fast = clamp01(-this.verticalVel / 14);
    this.set('hips', -0.05, 0, 0);
    this.set('spine', -0.08, wind * 0.3, 0);
    this.set('chest', -0.05, -wind * 0.3, 0);
    this.set('neck', 0.10, 0, 0);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('upperLeg' + S, -0.28 + wind * 0.2 * s, s * 0.14, s * 0.10);
      this.set('lowerLeg' + S, 0.55 + fast * 0.3, 0, 0);
      this.set('foot' + S, 0.25, s * 0.08, 0);
      this.set('upperArm' + S, -1.5 - fast * 0.6, s * 0.4, -s * 0.45);
      this.set('lowerArm' + S, 0, -s * 0.7, 0);
      this.relaxFingers(S, 0.3);
    }
  }

  poseLand(dt) {
    this._rate = 20;
    const t = clamp01(this.stateTime / 0.30);
    const absorb = Math.sin((1 - t) * Math.PI * 0.5);
    this.hipsOffset.y = -absorb * this.prop.measure.height * 0.075;
    this.set('hips', absorb * 0.22, 0, 0);
    this.set('spine', absorb * 0.18, 0, 0);
    this.set('chest', absorb * 0.10, 0, 0);
    this.set('neck', -absorb * 0.24, 0, 0);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('upperLeg' + S, -absorb * 0.75, s * 0.12, s * 0.07);
      this.set('lowerLeg' + S, absorb * 1.45, 0, 0);
      this.set('foot' + S, -absorb * 0.55, s * 0.08, 0);
      this.set('upperArm' + S, -absorb * 0.45, s * 0.22, -s * (1.1 - absorb * 0.35));
      this.set('lowerArm' + S, 0, -s * (0.35 + absorb * 0.6), 0);
      this.relaxFingers(S, 0.45);
    }
  }

  poseCrouch(dt) {
    this._rate = 12;
    const moving = clamp01(this.speed / 1.6);
    const ph = this.phase * TAU;
    this.hipsOffset.y = -this.prop.measure.height * 0.18;
    this.hipsOffset.z = this.prop.measure.height * 0.02;
    this.set('hips', 0.30, Math.sin(ph) * 0.06 * moving, 0);
    this.set('spine', 0.18, 0, 0);
    this.set('chest', 0.10, 0, 0);
    this.set('neck', -0.34, 0, 0);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      const legPh = ph + (S === 'L' ? 0 : Math.PI);
      const sw = Math.sin(legPh) * 0.30 * moving;
      this.set('upperLeg' + S, -1.05 - sw, s * 0.20, s * 0.10);
      this.set('lowerLeg' + S, 1.75 + Math.max(0, -Math.cos(legPh)) * 0.4 * moving, 0, 0);
      this.set('foot' + S, -0.55, s * 0.12, 0);
      this.set('upperArm' + S, -0.22, s * 0.16, -s * 1.02);
      this.set('lowerArm' + S, 0, -s * 0.85, 0);
      this.relaxFingers(S, 0.5);
    }
  }

  poseSit(dt) {
    this._rate = 8;
    const t = this.stateTime;
    const idle = Math.sin(t * 0.7) * 0.02;
    this.hipsOffset.y = -this.prop.measure.crotchY * 0.985;
    this.hipsOffset.z = -this.prop.measure.height * 0.035;
    this.set('hips', -0.10, 0, 0);
    this.set('spine', 0.06 + idle, 0, 0);
    this.set('chest', 0.04, idle * 1.5, 0);
    this.set('neck', -0.05, idle * 2, 0);
    this.set('head', 0.02, idle * 2.5, this.profile.headTilt);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('upperLeg' + S, -1.52, s * 0.16, s * 0.06);
      this.set('lowerLeg' + S, 1.48, 0, 0);
      this.set('foot' + S, 0.10, s * 0.10, 0);
      this.set('upperArm' + S, 0.22, s * 0.10, -s * 1.16);
      this.set('lowerArm' + S, 0, -s * 0.92, 0);
      this.set('hand' + S, 0.2, 0, 0);
      this.relaxFingers(S, 0.5);
    }
  }

  poseDrive(dt) {
    this._rate = 10;
    const steer = this.stateOpts && this.stateOpts.steer ? this.stateOpts.steer : 0;
    this.hipsOffset.y = -this.prop.measure.crotchY * 0.97;
    this.hipsOffset.z = -this.prop.measure.height * 0.02;
    this.set('hips', -0.18, 0, 0);
    this.set('spine', 0.10, -steer * 0.05, 0);
    this.set('chest', 0.04, -steer * 0.10, 0);
    this.set('neck', -0.06, steer * 0.12, 0);
    this.set('head', 0.0, steer * 0.18, 0);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('upperLeg' + S, -1.36, s * 0.20, s * 0.08);
      this.set('lowerLeg' + S, 1.15, 0, 0);
      this.set('foot' + S, 0.28, s * 0.10, 0);
      // Hands at ten-and-two, rotating with the wheel.
      const wheelAngle = steer * 0.9;
      this.set('clavicle' + S, 0, 0, -s * 0.08);
      this.set('upperArm' + S, -0.72 + wheelAngle * s * 0.35, s * 0.30, -s * 0.62);
      this.set('lowerArm' + S, 0, -s * 1.22, -wheelAngle * 0.3);
      this.set('hand' + S, 0, 0, s * 0.25);
      this.gripFingers(S, 0.85);
    }
  }

  poseClimb(dt) {
    this._rate = 12;
    const ph = this.stateTime * 2.2;
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      const o = S === 'L' ? 0 : Math.PI;
      const reach = Math.sin(ph + o) * 0.5 + 0.5;
      this.set('upperArm' + S, -2.30 + reach * 0.55, s * 0.30, -s * 0.30);
      this.set('lowerArm' + S, 0, -s * (0.35 + reach * 0.5), 0);
      this.gripFingers(S, 0.9);
      this.set('upperLeg' + S, -0.55 - (1 - reach) * 0.55, s * 0.22, s * 0.10);
      this.set('lowerLeg' + S, 0.85 + (1 - reach) * 0.65, 0, 0);
      this.set('foot' + S, 0.25, s * 0.10, 0);
    }
    this.set('hips', 0.10, 0, 0);
    this.set('spine', 0.12, 0, 0);
    this.set('neck', -0.28, 0, 0);
  }

  poseSwim(dt) {
    this._rate = 8;
    const ph = this.stateTime * 2.6;
    this.set('hips', -1.30, 0, 0);       // body goes horizontal
    this.set('spine', 0.10, Math.sin(ph) * 0.12, 0);
    this.set('chest', 0.08, -Math.sin(ph) * 0.14, 0);
    this.set('neck', 0.55, 0, 0);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      const o = S === 'L' ? 0 : Math.PI;
      this.set('upperArm' + S, -1.2 + Math.sin(ph + o) * 1.5, s * 0.35, -s * 0.5);
      this.set('lowerArm' + S, 0, -s * 0.45, 0);
      this.set('upperLeg' + S, Math.sin(ph * 1.6 + o) * 0.35, s * 0.08, s * 0.04);
      this.set('lowerLeg' + S, 0.3 + Math.max(0, Math.sin(ph * 1.6 + o)) * 0.5, 0, 0);
      this.set('foot' + S, 0.5, s * 0.08, 0);
      this.relaxFingers(S, 0.15);
    }
  }

  poseLie(dt) {
    this._rate = 7;
    const breathe = Math.sin(this.stateTime * 1.1) * 0.02;
    this.set('hips', -1.53, 0, 0.06);
    this.set('spine', 0.04 + breathe, 0, -0.04);
    this.set('chest', 0.06, 0, 0);
    this.set('neck', 0.28, 0.10, 0);
    this.set('head', 0.12, 0.14, 0);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('upperArm' + S, 0.30, s * 0.20, -s * 1.24);
      this.set('lowerArm' + S, 0, -s * 0.35, 0);
      this.set('upperLeg' + S, -0.10, s * 0.10, s * 0.10);
      this.set('lowerLeg' + S, 0.20 + (S === 'L' ? 0.25 : 0), 0, 0);
      this.set('foot' + S, 0.30, s * 0.20, 0);
      this.relaxFingers(S, 0.3);
    }
  }

  /** Getting up off the street — the game's opening move. */
  poseGetUp(dt) {
    this._rate = 9;
    const T = clamp01(this.stateTime / 3.4);
    // Phase 1: roll to side. Phase 2: push up to hands and knees. Phase 3: stand.
    const a = clamp01(T / 0.30);
    const b = clamp01((T - 0.28) / 0.36);
    const c = clamp01((T - 0.62) / 0.38);
    const ea = smooth01(a), eb = smooth01(b), ec = smooth01(c);

    const lieRot = lerpv(-1.53, -0.75, eb);
    const hipRot = lerpv(lieRot, 0, ec);
    this.hipsOffset.y = lerpv(
      lerpv(-this.prop.measure.hipY * 0.94, -this.prop.measure.hipY * 0.55, eb),
      0, ec
    );
    this.set('hips', hipRot, lerpv(0.15 * ea, 0, ec), lerpv(0.10 * ea, 0, ec));
    this.set('spine', lerpv(0.20 * eb, 0.05, ec), 0, 0);
    this.set('chest', lerpv(0.16 * eb, 0.02, ec), 0, 0);
    this.set('neck', lerpv(lerpv(0.30, -0.30, eb), -0.03, ec), 0, 0);

    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      // Hands push against the ground, then swing down.
      const push = eb * (1 - ec);
      this.set('upperArm' + S, lerpv(lerpv(0.3, -1.25, ea), lerpv(-0.55, 0.05, ec), eb), s * (0.2 + push * 0.25), -s * lerpv(1.24, 0.95, push));
      this.set('lowerArm' + S, 0, -s * lerpv(0.35, 1.0, push * (1 - ec)) , 0);
      this.relaxFingers(S, lerpv(0.3, 0.05, push));
      // Legs tuck under, then straighten.
      const tuck = eb * (1 - ec);
      this.set('upperLeg' + S, lerpv(lerpv(-0.10, -1.40, tuck), 0, ec), s * 0.14, s * 0.08);
      this.set('lowerLeg' + S, lerpv(lerpv(0.20, 1.85, tuck), 0.03, ec), 0, 0);
      this.set('foot' + S, lerpv(0.30, 0, ec), s * 0.1, 0);
    }
  }

  poseDance(dt) {
    this._rate = 14;
    const t = this.stateTime * 3.4;
    const bob = Math.sin(t * 2);
    this.hipsOffset.y = bob * this.prop.measure.height * 0.022 - this.prop.measure.height * 0.012;
    this.hipsOffset.x = Math.sin(t) * this.prop.measure.height * 0.022;
    this.set('hips', 0.04, Math.sin(t) * 0.30, -Math.sin(t) * 0.18);
    this.set('spine', 0.05, -Math.sin(t) * 0.18, Math.sin(t) * 0.12);
    this.set('chest', 0.02, Math.sin(t + 0.6) * 0.26, -Math.sin(t) * 0.10);
    this.set('neck', -0.05, Math.sin(t + 1.1) * 0.18, 0);
    this.set('head', Math.sin(t * 2) * 0.10, Math.sin(t + 1.4) * 0.22, Math.sin(t) * 0.08);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      const o = S === 'L' ? 0 : Math.PI * 0.6;
      this.set('upperArm' + S, -1.1 + Math.sin(t + o) * 0.85, s * (0.3 + Math.sin(t * 0.7) * 0.3), -s * (0.55 + Math.sin(t + o) * 0.3));
      this.set('lowerArm' + S, 0, -s * (1.1 + Math.sin(t * 1.3 + o) * 0.5), 0);
      this.relaxFingers(S, 0.25);
      this.set('upperLeg' + S, Math.sin(t + o) * 0.22, s * 0.16, s * 0.08);
      this.set('lowerLeg' + S, 0.15 + Math.max(0, Math.sin(t + o)) * 0.45, 0, 0);
      this.set('foot' + S, -0.08, s * 0.14, 0);
    }
  }

  poseWave(dt) {
    this.poseIdle(dt);
    this._rate = 12;
    const t = this.stateTime * 6.5;
    const S = 'R', s = -1;
    const up = clamp01(this.stateTime / 0.35) * clamp01((2.2 - this.stateTime) / 0.4);
    this.set('clavicle' + S, 0, 0, -s * 0.12 * up);
    this.set('upperArm' + S, -0.35 * up, s * 0.25 * up, -s * (1.30 - 0.95 * up));
    this.set('lowerArm' + S, 0, -s * (0.25 + 1.05 * up), 0);
    this.set('hand' + S, 0, 0, s * (0.1 + Math.sin(t) * 0.55 * up));
    this.relaxFingers(S, 0.05);
  }

  posePhone(dt) {
    this.poseIdle(dt);
    this._rate = 9;
    const toEar = this.stateOpts && this.stateOpts.toEar;
    const S = 'R', s = -1;
    if (toEar) {
      this.set('clavicle' + S, 0, 0, -s * 0.10);
      this.set('upperArm' + S, -0.62, s * 0.52, -s * 0.72);
      this.set('lowerArm' + S, 0, -s * 2.05, 0);
      this.set('hand' + S, 0.2, 0, s * 0.3);
      this.gripFingers(S, 0.8);
      this.set('head', 0.04, s * 0.10, s * 0.14);
    } else {
      // Looking down at the screen — the universal pose.
      for (const side of ['L', 'R']) {
        const ss = side === 'L' ? 1 : -1;
        this.set('upperArm' + side, -0.50, ss * 0.28, -ss * 0.88);
        this.set('lowerArm' + side, 0, -ss * 1.35, 0);
        this.set('hand' + side, 0.15, 0, ss * 0.2);
        this.gripFingers(side, 0.55);
      }
      this.set('neck', 0.30, 0, 0);
      this.set('head', 0.22, 0, 0);
      this.set('chest', 0.05, 0, 0);
    }
  }

  poseEat(dt) {
    this.poseSit(dt);
    this._rate = 8;
    const t = this.stateTime * 1.4;
    const bite = Math.max(0, Math.sin(t));
    const S = 'R', s = -1;
    this.set('upperArm' + S, -0.35 - bite * 0.55, s * 0.30, -s * 0.85);
    this.set('lowerArm' + S, 0, -s * (1.1 + bite * 0.85), 0);
    this.gripFingers(S, 0.7);
    this.jawTarget = bite * 0.35;
  }

  poseExercise(dt) {
    this._rate = 16;
    const t = this.stateTime * 2.6;
    const rep = Math.sin(t) * 0.5 + 0.5;
    this.hipsOffset.y = -rep * this.prop.measure.height * 0.10;
    this.set('hips', rep * 0.30, 0, 0);
    this.set('spine', rep * 0.12, 0, 0);
    this.set('neck', -rep * 0.20, 0, 0);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('upperLeg' + S, -rep * 1.25, s * 0.22, s * 0.10);
      this.set('lowerLeg' + S, rep * 2.0, 0, 0);
      this.set('foot' + S, -rep * 0.45, s * 0.12, 0);
      this.set('upperArm' + S, -0.55 - rep * 0.55, s * 0.28, -s * 0.85);
      this.set('lowerArm' + S, 0, -s * (0.9 + rep * 0.4), 0);
      this.relaxFingers(S, 0.6);
    }
  }

  poseCarry(dt) {
    const moving = this.speed > 0.4;
    if (moving) this.poseLocomotion(dt); else this.poseIdle(dt);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('upperArm' + S, -0.85, s * 0.30, -s * 0.72);
      this.set('lowerArm' + S, 0, -s * 1.42, 0);
      this.set('hand' + S, 0.1, 0, s * 0.12);
      this.gripFingers(S, 0.75);
    }
    this.set('chest', 0.06, 0, 0);
  }

  poseUse(dt) {
    this.poseIdle(dt);
    this._rate = 11;
    const reach = clamp01(this.stateTime / 0.4) * clamp01((1.6 - this.stateTime) / 0.4);
    const S = (this.stateOpts && this.stateOpts.hand) || 'R';
    const s = S === 'L' ? 1 : -1;
    this.set('clavicle' + S, 0, -s * 0.10 * reach, -s * 0.08 * reach);
    this.set('upperArm' + S, -1.15 * reach, s * 0.18, -s * (1.30 - 1.05 * reach));
    this.set('lowerArm' + S, 0, -s * (0.25 + 0.55 * reach), 0);
    this.set('hand' + S, 0, 0, s * 0.1);
    this.relaxFingers(S, 0.15 + reach * 0.4);
    this.set('chest', 0.03, -s * 0.10 * reach, 0);
  }

  poseDead(dt) {
    this._rate = 3;
    this.poseLie(dt);
    this.set('neck', 0.45, 0.35, 0);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('upperArm' + S, 0.15, s * 0.45, -s * 1.05);
      this.relaxFingers(S, 0.5);
    }
  }

  poseSalute(dt) {
    this.poseIdle(dt);
    this._rate = 12;
    const up = clamp01(this.stateTime / 0.35);
    const S = 'R', s = -1;
    this.set('clavicle' + S, 0, 0, -s * 0.14 * up);
    this.set('upperArm' + S, -0.30 * up, s * 0.62 * up, -s * (1.30 - 0.78 * up));
    this.set('lowerArm' + S, 0, -s * (0.25 + 1.72 * up), 0);
    this.set('hand' + S, -0.35 * up, 0, s * 0.18);
    this.relaxFingers(S, 0.04);
    this.add('spine', -0.04 * up, 0, 0);
    this.add('head', -0.05 * up, 0, 0);
  }

  poseClap(dt) {
    this.poseIdle(dt);
    this._rate = 20;
    const t = this.stateTime * 6.2;
    const clap = Math.abs(Math.sin(t));
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('clavicle' + S, 0, -s * 0.06, -s * 0.05);
      this.set('upperArm' + S, -0.72, s * (0.52 - clap * 0.30), -s * 0.70);
      this.set('lowerArm' + S, 0, -s * (1.55 + clap * 0.22), 0);
      this.set('hand' + S, 0, 0, s * 0.1);
      this.relaxFingers(S, 0.10);
    }
    this.add('chest', 0.03 * clap, 0, 0);
    // Hands meeting is what sells it — fire the sound on the closing frame.
    if (this.onClap && clap > 0.94 && !this._clapFlag) { this._clapFlag = true; this.onClap(); }
    if (clap < 0.5) this._clapFlag = false;
  }

  posePoint(dt) {
    this.poseIdle(dt);
    this._rate = 11;
    const up = clamp01(this.stateTime / 0.30);
    const S = (this.stateOpts && this.stateOpts.hand) || 'R';
    const s = S === 'L' ? 1 : -1;
    this.set('clavicle' + S, 0, -s * 0.12 * up, -s * 0.06 * up);
    this.set('upperArm' + S, -1.35 * up, s * 0.12, -s * (1.30 - 1.18 * up));
    this.set('lowerArm' + S, 0, -s * 0.16, 0);
    this.set('hand' + S, 0, 0, s * 0.05);
    // Index finger out, the rest curled.
    const names = ['index', 'middle', 'ring', 'pinky'];
    for (let i = 0; i < names.length; i++) {
      const curl = i === 0 ? 0.02 : 0.95;
      this.set(names[i] + S + '1', 0, -s * curl * 0.75, 0);
      this.set(names[i] + S + '2', 0, -s * curl * 0.95, 0);
      this.set(names[i] + S + '3', 0, -s * curl * 0.70, 0);
    }
    this.set('thumb' + S + '1', 0, -s * 0.5, s * 0.35);
    this.add('chest', 0, -s * 0.12 * up, 0);
  }

  poseCheer(dt) {
    this.poseIdle(dt);
    this._rate = 14;
    const t = this.stateTime * 5.0;
    const pump = Math.sin(t) * 0.5 + 0.5;
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('clavicle' + S, 0, 0, -s * 0.16);
      this.set('upperArm' + S, -0.25, s * 0.30, -s * (0.20 - pump * 0.16));
      this.set('lowerArm' + S, 0, -s * (0.35 + pump * 0.45), 0);
      this.relaxFingers(S, 0.95);
    }
    this.hipsOffset.y = pump * this.prop.measure.height * 0.012;
    this.add('spine', -0.10 * pump, 0, 0);
    this.add('head', -0.16 * pump, 0, 0);
    this.jawTarget = 0.22 * pump;
  }

  poseThink(dt) {
    this.poseIdle(dt);
    this._rate = 7;
    const t = this.stateTime;
    const sway = Math.sin(t * 0.8) * 0.05;
    const S = 'R', s = -1;
    this.set('clavicle' + S, 0, 0, -s * 0.06);
    this.set('upperArm' + S, -0.52, s * 0.44, -s * 0.86);
    this.set('lowerArm' + S, 0, -s * 2.10, 0);
    this.set('hand' + S, 0.28, 0, s * 0.22);
    this.relaxFingers(S, 0.45);
    // Other arm folded to support the elbow.
    this.set('upperArmL', 0.22, 0.30, -1.02);
    this.set('lowerArmL', 0, -1.35, 0);
    this.relaxFingers('L', 0.35);
    this.add('neck', 0.14, sway, 0);
    this.add('head', 0.10, sway * 1.4, 0.06);
    this.eyeSquint = 0.18;
  }

  poseStretch(dt) {
    this.poseIdle(dt);
    this._rate = 8;
    const t = clamp01(this.stateTime / 1.6);
    const reach = Math.sin(t * Math.PI);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('clavicle' + S, 0, 0, -s * 0.18 * reach);
      this.set('upperArm' + S, -0.30 * reach, s * 0.12, -s * (1.30 - 1.24 * reach));
      this.set('lowerArm' + S, 0, -s * (0.22 - 0.18 * reach), 0);
      this.relaxFingers(S, 0.10);
    }
    this.add('spine', -0.16 * reach, 0, 0);
    this.add('chest', -0.12 * reach, 0, 0);
    this.add('neck', 0.22 * reach, 0, 0);
    this.hipsOffset.y = reach * this.prop.measure.height * 0.010;
    this.jawTarget = Math.max(this.jawTarget, reach * 0.30);
    this.eyeSquint = reach * 0.75;
  }

  poseBow(dt) {
    this.poseIdle(dt);
    this._rate = 9;
    const t = clamp01(this.stateTime / 1.1);
    const b = Math.sin(t * Math.PI) * 0.95;
    this.set('hips', b * 0.30, 0, 0);
    this.set('spine', b * 0.45, 0, 0);
    this.set('chest', b * 0.28, 0, 0);
    this.set('neck', b * 0.22, 0, 0);
    this.set('head', b * 0.14, 0, 0);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      this.set('upperArm' + S, -b * 0.35, s * 0.10, -s * (1.26 - b * 0.10));
      this.set('lowerArm' + S, 0, -s * (0.22 + b * 0.30), 0);
      this.relaxFingers(S, 0.25);
      this.set('upperLeg' + S, b * 0.18, s * 0.10, s * 0.05);
    }
  }

  /** Finger curl: 0 = straight, 1 = fist. */
  relaxFingers(S, amount) {
    const names = ['index', 'middle', 'ring', 'pinky'];
    for (let i = 0; i < names.length; i++) {
      const curl = amount * (0.85 + i * 0.08);
      const s = S === 'L' ? 1 : -1;
      this.set(names[i] + S + '1', 0, -s * curl * 0.75, 0);
      this.set(names[i] + S + '2', 0, -s * curl * 0.95, 0);
      this.set(names[i] + S + '3', 0, -s * curl * 0.70, 0);
    }
    const s = S === 'L' ? 1 : -1;
    this.set('thumb' + S + '1', 0, -s * amount * 0.25, s * 0.35);
    this.set('thumb' + S + '2', 0, -s * amount * 0.45, 0);
    this.set('thumb' + S + '3', 0, -s * amount * 0.40, 0);
  }
  gripFingers(S, amount) { this.relaxFingers(S, 0.55 + amount * 0.55); }

  // =========================================================================
  // Additive layers
  // =========================================================================

  applyBreathing(dt) {
    this.breathT += dt * this.profile.breathRate * (1 + this.speed * 0.13);
    const b = Math.sin(this.breathT * TAU);
    const depth = 0.0075 * (1 + this.speed * 0.30);
    this.add('chest', -b * depth * 1.4, 0, 0);
    this.add('spine', -b * depth * 0.5, 0, 0);
    const chest = this.bones.chest;
    if (chest) {
      const s = 1 + b * depth * 1.8;
      chest.scale.set(s, 1 + b * depth * 0.6, s);
    }
    // Shoulders rise slightly on the inhale.
    this.add('clavicleL', 0, 0, -b * depth * 0.8);
    this.add('clavicleR', 0, 0, b * depth * 0.8);
  }

  applyTurnLean(dt) {
    const lean = clampv(this.turnRate * 0.20, -0.22, 0.22) * clamp01(this.speed / 2.5);
    this.add('hips', 0, 0, lean * 0.4);
    this.add('spine', 0, 0, lean * 0.35);
    this.add('chest', 0, -lean * 0.25, lean * 0.3);
    this.add('neck', 0, -lean * 0.35, 0);
  }

  applyBlink(dt) {
    const face = this.rig.face;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = (1 / this.profile.blinkRate) * (0.55 + Math.random() * 0.9);
      this.blinkPhase = 1;
      // Occasional double blink.
      if (Math.random() < 0.18) this.blinkTimer = 0.22;
    }
    if (this.blinkPhase > 0) {
      this.blinkPhase -= dt / 0.115;
      const t = clamp01(this.blinkPhase);
      // Fast close, slower open.
      this.blinkValue = t > 0.55 ? (1 - t) / 0.45 : t / 0.55;
      this.blinkValue = clamp01(this.blinkValue);
      if (this.blinkPhase <= 0) this.blinkValue = 0;
    }
    if (!face) return;
    const close = Math.max(this.blinkValue, this.eyeSquint || 0);
    if (face.lidUpperL) face.lidUpperL.rotation.x = close * 1.62;
    if (face.lidUpperR) face.lidUpperR.rotation.x = close * 1.62;
    if (face.lidLowerL) face.lidLowerL.rotation.x = -close * 0.42;
    if (face.lidLowerR) face.lidLowerR.rotation.x = -close * 0.42;
  }

  applyGaze(dt) {
    const face = this.rig.face;
    this.gazeTimer -= dt;
    if (this.gazeTimer <= 0) {
      this.gazeTimer = (1 / this.profile.gazeRate) * (0.4 + Math.random() * 1.6);
      // Saccades are small and quick; occasionally a bigger glance.
      const big = Math.random() < 0.22;
      this.gazeTarget.set(
        (Math.random() - 0.5) * (big ? 0.55 : 0.20),
        (Math.random() - 0.5) * (big ? 0.30 : 0.12)
      );
    }
    // Saccades snap, they don't glide.
    this.gazeCurrent.x = damp(this.gazeCurrent.x, this.gazeTarget.x, 0.000002, dt);
    this.gazeCurrent.y = damp(this.gazeCurrent.y, this.gazeTarget.y, 0.000002, dt);
    if (!face) return;
    const yaw = this.gazeCurrent.x + (this.eyeLookYaw || 0);
    const pitch = this.gazeCurrent.y + (this.eyeLookPitch || 0);
    if (face.eyeL) { face.eyeL.rotation.y = yaw; face.eyeL.rotation.x = pitch; }
    if (face.eyeR) { face.eyeR.rotation.y = yaw; face.eyeR.rotation.x = pitch; }
  }

  applyTalk(dt) {
    if (this.talking) {
      this.talkT += dt * (7 + Math.random() * 5);
      // Layered sine + noise reads as syllables rather than a metronome.
      const syl = Math.abs(Math.sin(this.talkT * 0.9)) * 0.6 + noise1(this.talkT * 1.7, 31) * 0.5;
      this.jawTarget = clamp01(syl) * 0.38 * (this.talkIntensity || 1);
      this.browRaise = damp(this.browRaise, noise1(this.talkT * 0.35, 77) * 0.5, 0.02, dt);
    } else {
      this.jawTarget = damp(this.jawTarget, 0, 0.001, dt);
      this.browRaise = damp(this.browRaise, 0, 0.01, dt);
    }
    this.jawOpen = damp(this.jawOpen, this.jawTarget, 0.0005, dt);
    if (this.bones.jaw) {
      _e.set(this.jawOpen, 0, 0);
      this.bones.jaw.quaternion.setFromEuler(_e);
    }
    const face = this.rig.face;
    if (face && face.brows) face.brows.position.y = (face.browRestY || 0) + this.browRaise * this.prop.measure.headH * 0.012;
  }

  applyLookAt(dt) {
    if (!this.lookAtWorld || this.lookWeight <= 0.01) {
      this.headYaw = damp(this.headYaw, 0, 0.004, dt);
      this.headPitch = damp(this.headPitch, 0, 0.004, dt);
      this.eyeLookYaw = damp(this.eyeLookYaw || 0, 0, 0.004, dt);
      this.eyeLookPitch = damp(this.eyeLookPitch || 0, 0, 0.004, dt);
    } else {
      const head = this.bones.head;
      if (!head) return;
      head.updateWorldMatrix(true, false);
      _v.setFromMatrixPosition(head.matrixWorld);
      _v2.copy(this.lookAtWorld).sub(_v);
      // Convert into the character's local frame.
      const root = this.rig.root || head;
      const rootQ = new THREE.Quaternion();
      (this.rig.rootObject || root).getWorldQuaternion(rootQ);
      _v2.applyQuaternion(rootQ.invert());
      const yaw = Math.atan2(_v2.x, _v2.z);
      const pitch = -Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z));
      // Humans turn the head only so far before the eyes do the rest.
      const clampedYaw = clampv(yaw, -1.15, 1.15) * this.lookWeight;
      const clampedPitch = clampv(pitch, -0.55, 0.60) * this.lookWeight;
      this.headYaw = damp(this.headYaw, clampedYaw, 0.0025, dt);
      this.headPitch = damp(this.headPitch, clampedPitch, 0.0025, dt);
      this.eyeLookYaw = damp(this.eyeLookYaw || 0, clampv(yaw - this.headYaw, -0.5, 0.5), 0.00001, dt);
      this.eyeLookPitch = damp(this.eyeLookPitch || 0, clampv(pitch - this.headPitch, -0.3, 0.3), 0.00001, dt);
    }
    // Split the turn between neck and head so it doesn't look like an owl.
    this.add('neck', this.headPitch * 0.38, this.headYaw * 0.42, 0);
    this.add('head', this.headPitch * 0.62, this.headYaw * 0.58, 0);
    this.add('chest', 0, this.headYaw * 0.14, 0);
  }

  // =========================================================================
  // IK
  // =========================================================================

  applyFootIK(rootObject, dt) {
    const m = this.prop.measure;
    for (const S of ['L', 'R']) {
      const hip = this.bones['upperLeg' + S];
      const knee = this.bones['lowerLeg' + S];
      const foot = this.bones['foot' + S];
      if (!hip || !knee || !foot) continue;
      foot.updateWorldMatrix(true, false);
      _v.setFromMatrixPosition(foot.matrixWorld);
      const ground = this.groundSampler(_v.x, _v.z);
      if (!ground) continue;
      const desiredY = ground.y + m.footH * 0.62;
      // Only lift the foot; never push it through the floor.
      const lift = desiredY - _v.y;
      const w = clamp01(this.isLocomotion() ? clamp01(1 - Math.abs(lift) / (m.height * 0.25)) : 1) * 0.85;
      if (Math.abs(lift) < 0.0015 || w < 0.02) continue;
      const target = _v.clone();
      target.y += lift;
      // Knee pole: forward and slightly outward from the hip.
      hip.updateWorldMatrix(true, false);
      const hipPos = new THREE.Vector3().setFromMatrixPosition(hip.matrixWorld);
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(rootObject.quaternion);
      const side = new THREE.Vector3(S === 'L' ? 1 : -1, 0, 0).applyQuaternion(rootObject.quaternion);
      const pole = hipPos.clone().add(fwd.multiplyScalar(m.height * 0.55)).add(side.multiplyScalar(m.height * 0.06));
      solveTwoBoneIK(hip, knee, foot, target, pole, w);
      // Roll the foot to match the ground normal.
      if (ground.normal) {
        const up = ground.normal;
        const tilt = Math.atan2(up.z, up.y) * 0.5;
        const roll = -Math.atan2(up.x, up.y) * 0.5;
        _e.set(tilt, 0, roll);
        _q.setFromEuler(_e);
        foot.quaternion.multiply(_q);
      }
    }
  }

  applyHandIK(rootObject) {
    for (const S of ['L', 'R']) {
      const target = this.handTargets[S];
      const w = this.handWeights[S];
      if (!target || w <= 0.01) continue;
      const shoulder = this.bones['upperArm' + S];
      const elbow = this.bones['lowerArm' + S];
      const hand = this.bones['hand' + S];
      if (!shoulder || !elbow || !hand) continue;
      shoulder.updateWorldMatrix(true, false);
      const sp = new THREE.Vector3().setFromMatrixPosition(shoulder.matrixWorld);
      const down = new THREE.Vector3(0, -1, 0);
      const out = new THREE.Vector3(S === 'L' ? 1 : -1, 0, 0).applyQuaternion(rootObject.quaternion);
      const pole = sp.clone().add(down.multiplyScalar(this.prop.measure.height * 0.35)).add(out.multiplyScalar(this.prop.measure.height * 0.18));
      solveTwoBoneIK(shoulder, elbow, hand, target, pole, w);
    }
  }

  /** Fire footstep callbacks when a foot passes through the bottom of its arc. */
  detectFootsteps() {
    if (!this.onFootstep || !this.isLocomotion()) { this._stepFlag.L = this._stepFlag.R = false; return; }
    const ph = this.phase;
    for (const S of ['L', 'R']) {
      const legPh = (ph + (S === 'L' ? 0 : 0.5)) % 1;
      // Contact happens around phase 0.25 of each leg's own cycle.
      const contact = legPh > 0.20 && legPh < 0.34;
      if (contact && !this._stepFlag[S]) {
        this._stepFlag[S] = true;
        this.onFootstep(S, this.speed);
      } else if (!contact) {
        this._stepFlag[S] = false;
      }
    }
  }
}
