// T10 World - parametric human body geometry.
// Builds a single SkinnedMesh from the proportions in skeleton.js: a lofted
// torso, sculpted head, tapered limbs, hands with individual fingers and
// anatomically shaped feet.
import * as THREE from '../../vendor/three.module.js';
import { SkinnedMeshBuilder, torsoShape, limbShape } from './meshbuilder.js';
import { FINGER_NAMES } from './skeleton.js';
import { clamp01, clampv, lerpv, smooth01, TAU } from '../core/math.js';

export const MAT_SKIN = 0;
export const MAT_HEAD = 1;

/**
 * The face texture is painted with features at fixed v positions. The head
 * geometry's own landmarks sit elsewhere, so remap geometric v -> texture v.
 * Pairs: [geometric, painted].
 */
const FACE_V_MAP = [
  [0.000, 0.195],   // bottom of the head volume, hidden inside the neck
  [0.105, 0.250],   // chin
  [0.226, 0.315],   // mouth
  [0.346, 0.392],   // nostrils
  [0.566, 0.578],   // eye line
  [0.646, 0.625],   // brow
  [0.773, 0.760],   // hairline
  [1.000, 1.000],   // crown
];
function faceV(vGeo) {
  for (let i = 0; i < FACE_V_MAP.length - 1; i++) {
    const a = FACE_V_MAP[i], b = FACE_V_MAP[i + 1];
    if (vGeo <= b[0]) {
      const t = (vGeo - a[0]) / Math.max(1e-6, b[0] - a[0]);
      return lerpv(a[1], b[1], clamp01(t));
    }
  }
  return 1;
}

/** Horizontal face UV: near-planar across the face, wrapping around the back. */
const FACE_U_SCALE = 0.229;
function faceU(theta) {
  const a = Math.abs(theta);
  if (a <= Math.PI * 0.5) return 0.5 + FACE_U_SCALE * Math.sin(theta);
  const t = (a - Math.PI * 0.5) / (Math.PI * 0.5);
  return 0.5 + Math.sign(theta) * (FACE_U_SCALE + t * (0.5 - FACE_U_SCALE));
}

function gauss(x, sigma) { const t = x / sigma; return Math.exp(-t * t); }
function band(v, lo, hi) {
  if (v <= lo || v >= hi) return 0;
  const t = (v - lo) / (hi - lo);
  return Math.sin(t * Math.PI);
}

export function defaultFaceParams(gender) {
  const female = gender === 'female';
  return {
    headWidth: 1.0, headDepth: 1.0,
    jawWidth: female ? 0.9 : 1.05, jawAngle: female ? 0.9 : 1.1,
    chinLength: 1.0, chinPoint: female ? 0.9 : 1.05, chinCleft: 0,
    cheekbone: female ? 1.05 : 0.95, cheekFullness: female ? 1.0 : 0.9,
    browRidge: female ? 0.45 : 1.0, foreheadSlope: female ? 0.35 : 0.6, foreheadHeight: 1.0,
    noseSize: 1.0, noseWidth: female ? 0.9 : 1.05, noseBridge: 1.0, noseTip: 0.0, noseHook: 0.0,
    eyeSize: 1.0, eyeSpacing: 1.0, eyeDepth: 1.0, eyeTilt: 0.0,
    mouthWidth: 1.0, lipFullness: female ? 0.62 : 0.45,
    earSize: 1.0, earStick: 0.35,
    occiput: 1.0, neckThickness: 1.0,
  };
}

/**
 * Sculpt the head. The base is an ellipsoid spanning from inside the neck
 * (v=0) to the crown (v=1); every feature below is an additive displacement so
 * they compose without fighting each other.
 *
 * Landmarks: chin 0.136 | mouth 0.253 | nose base 0.369 | eyes 0.582 |
 * brow 0.659 | hairline 0.781 | crown 1.0
 */
function sculptHead(x, y, z, v, theta, R, f, m) {
  const headH = m.headH;
  let dx = 0, dy = 0, dz = 0;
  const front = Math.max(0, Math.cos(theta));
  const back = Math.max(0, -Math.cos(theta));
  const sideness = Math.abs(Math.sin(theta));
  const sx = Math.sign(x) || 1;

  // --- Neck blend: below the jaw the volume collapses to roughly neck width so
  // it disappears inside the neck tube instead of hanging as a floating ball.
  if (v < 0.200) {
    const t = 1 - smooth01(v / 0.200);
    const targetScale = (m.neckR * 1.02) / Math.max(1e-5, R.Rx);
    const k = lerpv(1, targetScale, t);
    dx += x * (k - 1);
    dz += z * (k - 1);
    dz -= t * headH * 0.046;                    // the throat sits behind the chin
    dy += t * headH * 0.02;
  }

  // --- Jaw: narrows to about two-thirds of the cheekbone width at the chin.
  if (v < 0.50) {
    const t = Math.pow(clamp01((0.50 - v) / 0.50), 1.30);
    const narrow = 0.295 * t / Math.max(0.55, f.jawWidth);
    dx -= x * narrow;
    dz -= z * narrow * 0.42;
    // Keep a real jaw corner below the ear rather than tapering to a cone.
    const corner = band(v, 0.14, 0.50) * gauss(Math.abs(theta) - 1.22, 0.46);
    dx += sx * corner * headH * 0.052 * f.jawWidth;
    dz -= back * corner * headH * 0.010;
  }

  // --- Chin ---------------------------------------------------------------
  const chinT = band(v, 0.01, 0.27);
  if (chinT > 0) {
    const c = gauss(theta, 0.48);
    dz += c * chinT * headH * 0.074 * f.chinPoint;
    dy -= c * chinT * headH * 0.028 * (f.chinLength - 1);
    if (f.chinCleft > 0) dz -= gauss(theta, 0.075) * chinT * headH * 0.016 * f.chinCleft;
  }

  // --- Cheeks and cheekbones ----------------------------------------------
  const cbT = band(v, 0.44, 0.64);
  if (cbT > 0) {
    const cb = gauss(Math.abs(theta) - 0.80, 0.32);
    dx += sx * cbT * cb * headH * 0.030 * f.cheekbone;
    dz += front * cbT * cb * headH * 0.012 * f.cheekbone;
  }
  const cfT = band(v, 0.23, 0.50);
  if (cfT > 0) {
    const cf = gauss(Math.abs(theta) - 0.64, 0.38);
    dz += front * cfT * cf * headH * 0.024 * f.cheekFullness * (0.6 + m.weight * 0.9);
    dx += sx * cfT * cf * headH * 0.013 * (0.4 + m.weight);
  }

  // --- Brow ridge ----------------------------------------------------------
  const browT = band(v, 0.58, 0.72);
  if (browT > 0) {
    const bw = gauss(Math.abs(theta) - 0.38, 0.32) + gauss(theta, 0.17) * 0.45;
    dz += front * browT * bw * headH * 0.028 * f.browRidge;
    dy += browT * bw * headH * 0.003 * f.browRidge;
  }

  // --- Eye sockets ---------------------------------------------------------
  const eyeTheta = 0.58 * f.eyeSpacing;
  const socket = band(v, 0.48, 0.65) * (gauss(theta - eyeTheta, 0.23) + gauss(theta + eyeTheta, 0.23));
  if (socket > 0) dz -= front * socket * headH * 0.034 * f.eyeDepth;
  // The nasal bridge between the sockets stays proud.
  const bridgeT = band(v, 0.50, 0.72);
  if (bridgeT > 0) dz += front * bridgeT * gauss(theta, 0.145) * headH * 0.028 * f.noseBridge;

  // --- Nose ----------------------------------------------------------------
  // Explicit profile: the root is shallow, the tip projects hard, then it tucks
  // back under. A single smooth bump reads as a swollen forehead, not a nose.
  if (v > 0.270 && v < 0.740) {
    let nv;
    if (v >= 0.395) nv = clamp01((0.740 - v) / 0.345) * clamp01((0.740 - v) / 0.345);
    else nv = smooth01(clamp01((v - 0.270) / 0.115));
    if (v >= 0.395 && v <= 0.450) nv = Math.max(nv, 0.94);      // hold the tip
    const sigma = lerpv(0.225, 0.118, clamp01((v - 0.34) / 0.36)) * f.noseWidth;
    const g = gauss(theta, sigma);
    dz += front * g * headH * (0.018 + 0.150 * nv) * f.noseSize;
    // Nostril wings flare just above the lip.
    const wingT = band(v, 0.295, 0.430);
    if (wingT > 0) {
      const wg = gauss(Math.abs(theta) - 0.195 * f.noseWidth, 0.095);
      dx += sx * wingT * wg * headH * 0.034 * f.noseWidth;
      dz += front * wingT * wg * headH * 0.020;
    }
    // Under-nose tuck so the tip has a defined underside.
    const tuckT = band(v, 0.310, 0.380);
    if (tuckT > 0) dz -= front * gauss(theta, sigma * 1.2) * tuckT * headH * 0.030;
    const tipT = band(v, 0.355, 0.480) * g;
    if (tipT > 0) {
      dy -= tipT * headH * 0.022 * f.noseTip;
      dz += tipT * headH * 0.018 * f.noseHook;
    }
  }

  // --- Mouth ---------------------------------------------------------------
  const lipT = band(v, 0.175, 0.295);
  if (lipT > 0) {
    const lw = gauss(theta, 0.28 * f.mouthWidth);
    dz += front * lipT * lw * headH * 0.034 * (0.55 + f.lipFullness);
    // Corners tuck back so the mouth isn't a ring around the head.
    dz -= front * lipT * (gauss(theta - 0.33 * f.mouthWidth, 0.085) + gauss(theta + 0.33 * f.mouthWidth, 0.085)) * headH * 0.014;
  }
  const philT = band(v, 0.255, 0.335);
  if (philT > 0) dz -= front * philT * gauss(theta, 0.05) * headH * 0.010;

  // --- Cranium -------------------------------------------------------------
  if (v > 0.73) {
    const t = (v - 0.73) / 0.27;
    dz -= back * t * headH * 0.016 * f.occiput;
    dx += sx * t * (1 - t) * headH * 0.012 * sideness;   // slight parietal bulge
  }
  // Forehead slope: brow forward, hairline set back.
  if (v > 0.65) {
    const t = clamp01((v - 0.65) / 0.30);
    dz -= front * t * t * headH * 0.042 * f.foreheadSlope;
  }
  // Temple hollow above the cheekbone.
  const templeT = band(v, 0.61, 0.83);
  if (templeT > 0) dx -= sx * templeT * gauss(Math.abs(theta) - 1.18, 0.40) * headH * 0.015;

  return { x: x + dx, y: y + dy, z: z + dz };
}

/** Build a tube along an arbitrary polyline with per-sample frames. */
function orientedTube(b, samples, segments, materialUV) {
  const rings = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    tangent.copy(next.pos).sub(prev.pos);
    if (tangent.lengthSq() < 1e-10) tangent.set(0, 1, 0);
    tangent.normalize();
    // Stable frame: prefer world up unless the limb is nearly vertical.
    if (Math.abs(tangent.y) > 0.92) normal.set(0, 0, 1).cross(tangent).normalize();
    else normal.copy(up).cross(tangent).normalize();
    binormal.copy(tangent).cross(normal).normalize();

    const ring = [];
    for (let j = 0; j <= segments; j++) {
      const t = j / segments;
      const theta = t * TAU;
      const off = s.shape(theta, s);
      const px = s.pos.x + normal.x * off.x + binormal.x * off.z;
      const py = s.pos.y + normal.y * off.x + binormal.y * off.z;
      const pz = s.pos.z + normal.z * off.x + binormal.z * off.z;
      ring.push(b.vertex(px, py, pz, t * (materialUV ? materialUV.uScale : 1), s.v, s.weights));
    }
    rings.push(ring);
  }
  // The (normal, binormal, tangent) frame here is right-handed, the opposite of
  // the implicit frame in SkinnedMeshBuilder.tube, so the winding is reversed.
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], c = rings[i + 1];
    for (let j = 0; j < segments; j++) b.quad(a[j], c[j], c[j + 1], a[j + 1]);
  }
  return rings;
}

function capRingFan(b, ring, center, segments, v, weights, flip) {
  const c = b.vertex(center.x, center.y, center.z, 0.5, v, weights);
  for (let i = 0; i < segments; i++) {
    if (flip) b.tri(ring[i + 1], ring[i], c);
    else b.tri(ring[i], ring[i + 1], c);
  }
}

/**
 * Build the complete body geometry.
 * @returns { geometry, headCenter, headSpan, eyeRadius }
 */
export function buildBodyGeometry(prop, boneIndex, face, opts) {
  opts = opts || {};
  const segments = Math.max(6, opts.segments || 12);
  const limbSegments = Math.max(5, Math.round(segments * 0.8));
  const J = prop.joints;
  const m = prop.measure;
  const p = prop.params;
  const b = new SkinnedMeshBuilder();
  const BI = (n) => (boneIndex[n] != null ? boneIndex[n] : boneIndex.hips || 0);
  const W = (pairs) => pairs.map(([n, w]) => [BI(n), w]);

  const female = m.female;
  const weight = m.weight;
  const muscle = m.muscle;
  const H = m.height;

  // =========================================================================
  // TORSO — lofted cross-sections from crotch to the base of the neck.
  // =========================================================================
  b.beginGroup(MAT_SKIN);
  const bellyAmt = clampv((weight - 0.42) * 0.85, -0.05, 0.42);
  const gluteAmt = 0.18 + weight * 0.30 + (female ? 0.12 : 0.0);
  const bustAmt = female ? m.bust * 0.85 : 0;

  const torsoDefs = [
    // [y, halfWidth, depthRatio, weights, belly, glute, bust, flatten, lat]
    { y: m.crotchY - H * 0.012, rx: m.hipHalf * 0.86, dr: 0.80, w: [['hips', 1]], belly: bellyAmt * 0.35, glute: gluteAmt * 0.55 },
    { y: m.crotchY + H * 0.030, rx: m.hipHalf * 0.99, dr: 0.78, w: [['hips', 1]], belly: bellyAmt * 0.5, glute: gluteAmt },
    { y: m.hipY, rx: m.hipHalf, dr: 0.76, w: [['hips', 0.85], ['spine', 0.15]], belly: bellyAmt * 0.7, glute: gluteAmt * 0.82 },
    { y: lerpv(m.hipY, m.waistY, 0.5), rx: lerpv(m.hipHalf, m.waistHalf, 0.62), dr: 0.74, w: [['hips', 0.42], ['spine', 0.58]], belly: bellyAmt, glute: gluteAmt * 0.3 },
    { y: m.waistY, rx: m.waistHalf, dr: 0.75, w: [['spine', 0.85], ['chest', 0.15]], belly: bellyAmt * 0.92, glute: 0.06, flatten: 0.3 },
    { y: lerpv(m.waistY, m.chestY, 0.5), rx: lerpv(m.waistHalf, m.chestHalf, 0.66), dr: 0.72, w: [['spine', 0.45], ['chest', 0.55]], belly: bellyAmt * 0.45, flatten: 0.34, lat: muscle * 0.6 },
    { y: m.chestY, rx: m.chestHalf, dr: 0.70, w: [['chest', 1]], bust: bustAmt, flatten: 0.36, lat: muscle * 0.8 },
    { y: lerpv(m.chestY, m.shoulderY, 0.55), rx: m.chestHalf * 1.02, dr: 0.68, w: [['chest', 1]], bust: bustAmt * 0.45, flatten: 0.30, lat: muscle * 0.7 },
    { y: m.shoulderY, rx: m.shoulderHalf * 0.90, dr: 0.60, w: [['chest', 0.85], ['neck', 0.15]], flatten: 0.16, shoulderDrop: H * 0.024, lat: muscle * 0.4 },
    { y: m.neckBaseY + H * 0.008, rx: m.neckR * 1.44, dr: 0.94, w: [['neck', 0.62], ['chest', 0.38]] },
  ];

  const torsoSections = torsoDefs.map((d, i) => ({
    center: new THREE.Vector3(0, d.y, 0),
    v: i / (torsoDefs.length - 1),
    weights: W(d.w),
    shape: torsoShape({
      rx: d.rx, rz: d.rx * d.dr,
      belly: d.belly || 0, glute: d.glute || 0, bust: d.bust || 0,
      flatten: d.flatten || 0, lat: d.lat || 0, shoulderDrop: d.shoulderDrop || 0,
    }),
  }));
  const torsoRings = b.tube(torsoSections, segments, { capStart: true });

  // Neck
  const neckSections = [
    { center: new THREE.Vector3(0, m.neckBaseY - H * 0.008, 0), v: 0, weights: W([['neck', 0.55], ['chest', 0.45]]), shape: limbShape(m.neckR * 1.32 * face.neckThickness, 0) },
    { center: new THREE.Vector3(0, lerpv(m.neckBaseY, m.chinY, 0.35), J.neck.z * 0.5), v: 0.4, weights: W([['neck', 1]]), shape: limbShape(m.neckR * face.neckThickness, 0) },
    { center: new THREE.Vector3(0, m.chinY - m.headH * 0.10, J.head.z * 0.9), v: 0.8, weights: W([['neck', 0.45], ['head', 0.55]]), shape: limbShape(m.neckR * 1.04 * face.neckThickness, 0) },
    { center: new THREE.Vector3(0, m.chinY - m.headH * 0.015, J.head.z * 0.8), v: 1.0, weights: W([['neck', 0.18], ['head', 0.82]]), shape: limbShape(m.neckR * 0.98 * face.neckThickness, 0) },
  ];
  b.tube(neckSections, segments);

  // =========================================================================
  // ARMS
  // =========================================================================
  for (const S of ['L', 'R']) {
    const sgn = S === 'L' ? 1 : -1;
    const sh = J['upperArm' + S], el = J['lowerArm' + S], wr = J['hand' + S];
    const cl = J['clavicle' + S];

    // Deltoid cap blends the arm into the shoulder.
    b.blob(
      new THREE.Vector3(sgn * (m.shoulderHalf * 0.78), sh.y + m.upperArmR * 0.12, 0),
      { x: m.upperArmR * 1.34, y: m.upperArmR * 1.16, z: m.upperArmR * 1.22 },
      segments, Math.max(4, Math.round(segments * 0.5)),
      W([['upperArm' + S, 0.62], ['chest', 0.38]])
    );

    const armSamples = [];
    const armPts = [
      { t: 0.0, from: sh, to: el, r: m.upperArmR * 1.18, w: [['upperArm' + S, 0.72], ['chest', 0.28]] },
      { t: 0.22, from: sh, to: el, r: m.upperArmR * (1 + muscle * 0.22), w: [['upperArm' + S, 1]] },
      { t: 0.6, from: sh, to: el, r: m.upperArmR * (0.94 + muscle * 0.10), w: [['upperArm' + S, 1]] },
      { t: 0.92, from: sh, to: el, r: m.elbowR * 1.08, w: [['upperArm' + S, 0.62], ['lowerArm' + S, 0.38]] },
      { t: 1.0, from: sh, to: el, r: m.elbowR, w: [['upperArm' + S, 0.42], ['lowerArm' + S, 0.58]] },
      { t: 0.10, from: el, to: wr, r: m.forearmR * (1.02 + muscle * 0.2), w: [['lowerArm' + S, 1]] },
      { t: 0.45, from: el, to: wr, r: m.forearmR * (0.88 + muscle * 0.1), w: [['lowerArm' + S, 1]] },
      { t: 0.78, from: el, to: wr, r: m.wristR * 1.18, w: [['lowerArm' + S, 0.9], ['hand' + S, 0.1]] },
      { t: 1.0, from: el, to: wr, r: m.wristR, w: [['lowerArm' + S, 0.45], ['hand' + S, 0.55]] },
    ];
    for (let i = 0; i < armPts.length; i++) {
      const a = armPts[i];
      const pos = a.from.clone().lerp(a.to, a.t);
      armSamples.push({
        pos, v: i / (armPts.length - 1),
        weights: W(a.w),
        shape: limbShape(a.r, muscle * 0.5),
      });
    }
    orientedTube(b, armSamples, limbSegments);

    // ---- Hand: palm + five fingers ----
    const handDir = new THREE.Vector3(sgn, 0, 0);
    const palmCenter = wr.clone().add(handDir.clone().multiplyScalar(m.handLen * 0.26));
    b.roundedBox(
      palmCenter,
      { x: m.handLen * 0.56, y: m.handThick * 1.85, z: m.handLen * 0.52 },
      m.handThick * 0.80,
      W([['hand' + S, 1]]),
      null, 3
    );

    const hasFingers = boneIndex[FINGER_NAMES[1] + S + '1'] != null;
    const fingerSegs = Math.max(4, Math.round(limbSegments * 0.55));
    for (let fi = 0; fi < FINGER_NAMES.length; fi++) {
      const fname = FINGER_NAMES[fi];
      const j1 = J[fname + S + '1'], j2 = J[fname + S + '2'], j3 = J[fname + S + '3'];
      if (!j1) continue;
      const bw = hasFingers
        ? [[[fname + S + '1', 1]], [[fname + S + '2', 1]], [[fname + S + '3', 1]]]
        : [[['hand' + S, 1]], [['hand' + S, 1]], [['hand' + S, 1]]];
      const rBase = m.fingerR * (fi === 0 ? 1.28 : fi === 4 ? 0.82 : 1.0);
      const samples = [
        { pos: j1.clone().lerp(j2, -0.25), r: rBase * 1.12, w: hasFingers ? [[fname + S + '1', 0.5], ['hand' + S, 0.5]] : [['hand' + S, 1]] },
        { pos: j1.clone(), r: rBase, w: bw[0] },
        { pos: j1.clone().lerp(j2, 0.6), r: rBase * 0.95, w: bw[0] },
        { pos: j2.clone(), r: rBase * 0.90, w: hasFingers ? [[fname + S + '1', 0.4], [fname + S + '2', 0.6]] : [['hand' + S, 1]] },
        { pos: j2.clone().lerp(j3, 0.6), r: rBase * 0.84, w: bw[1] },
        { pos: j3.clone(), r: rBase * 0.76, w: hasFingers ? [[fname + S + '2', 0.4], [fname + S + '3', 0.6]] : [['hand' + S, 1]] },
        { pos: j3.clone().add(j3.clone().sub(j2).normalize().multiplyScalar(rBase * 0.9)), r: rBase * 0.42, w: bw[2] },
      ];
      const fs = samples.map((s, i) => ({
        pos: s.pos, v: i / (samples.length - 1),
        weights: W(s.w), shape: limbShape(s.r, 0),
      }));
      const rings = orientedTube(b, fs, fingerSegs);
      capRingFan(b, rings[rings.length - 1], samples[samples.length - 1].pos, fingerSegs, 1, W(bw[2]), sgn < 0);
    }
  }

  // =========================================================================
  // LEGS
  // =========================================================================
  for (const S of ['L', 'R']) {
    const sgn = S === 'L' ? 1 : -1;
    const hip = J['upperLeg' + S], knee = J['lowerLeg' + S], ankle = J['foot' + S];
    const legPts = [
      { t: -0.08, from: hip, to: knee, r: m.thighR * 1.14, w: [['upperLeg' + S, 0.55], ['hips', 0.45]] },
      { t: 0.06, from: hip, to: knee, r: m.thighR * 1.08, w: [['upperLeg' + S, 0.82], ['hips', 0.18]] },
      { t: 0.32, from: hip, to: knee, r: m.thighR * (0.98 + muscle * 0.12), w: [['upperLeg' + S, 1]] },
      { t: 0.68, from: hip, to: knee, r: m.thighR * 0.80, w: [['upperLeg' + S, 1]] },
      { t: 0.94, from: hip, to: knee, r: m.kneeR * 1.06, w: [['upperLeg' + S, 0.6], ['lowerLeg' + S, 0.4]] },
      { t: 1.0, from: hip, to: knee, r: m.kneeR, w: [['upperLeg' + S, 0.4], ['lowerLeg' + S, 0.6]] },
      { t: 0.16, from: knee, to: ankle, r: m.calfR * (1.0 + muscle * 0.2), w: [['lowerLeg' + S, 1]] },
      { t: 0.40, from: knee, to: ankle, r: m.calfR * (0.92 + muscle * 0.08), w: [['lowerLeg' + S, 1]] },
      { t: 0.72, from: knee, to: ankle, r: m.ankleR * 1.35, w: [['lowerLeg' + S, 1]] },
      { t: 1.0, from: knee, to: ankle, r: m.ankleR, w: [['lowerLeg' + S, 0.5], ['foot' + S, 0.5]] },
    ];
    const samples = legPts.map((a, i) => ({
      pos: a.from.clone().lerp(a.to, a.t),
      v: i / (legPts.length - 1),
      weights: W(a.w),
      // Calf muscle sits at the back of the lower leg.
      shape: limbShape(a.r, (i >= 6 && i <= 7) ? 0.5 + muscle * 0.5 : muscle * 0.3),
    }));
    orientedTube(b, samples, limbSegments);

    // ---- Foot: arch, heel, toe box ----
    const toe = J['toe' + S];
    const fw = m.footLen * 0.30;
    const footSamples = [
      { pos: new THREE.Vector3(ankle.x, ankle.y - m.footH * 0.22, ankle.z - m.footLen * 0.24), rx: fw * 0.72, rz: m.footH * 0.62, w: [['foot' + S, 1]] },
      { pos: new THREE.Vector3(ankle.x, ankle.y - m.footH * 0.52, ankle.z - m.footLen * 0.10), rx: fw * 0.82, rz: m.footH * 0.70, w: [['foot' + S, 1]] },
      { pos: new THREE.Vector3(ankle.x, ankle.y - m.footH * 0.60, ankle.z + m.footLen * 0.14), rx: fw * 0.92, rz: m.footH * 0.60, w: [['foot' + S, 1]] },
      { pos: new THREE.Vector3(ankle.x, ankle.y - m.footH * 0.62, toe.z), rx: fw * 1.0, rz: m.footH * 0.48, w: [['foot' + S, 0.45], ['toe' + S, 0.55]] },
      { pos: new THREE.Vector3(ankle.x, ankle.y - m.footH * 0.62, m.footLen * 0.62), rx: fw * 0.92, rz: m.footH * 0.36, w: [['toe' + S, 1]] },
      { pos: new THREE.Vector3(ankle.x, ankle.y - m.footH * 0.60, m.footLen * 0.70), rx: fw * 0.55, rz: m.footH * 0.22, w: [['toe' + S, 1]] },
    ];
    const fs = footSamples.map((s, i) => ({
      pos: s.pos, v: i / (footSamples.length - 1), weights: W(s.w),
      shape: (theta) => {
        // Flat sole, rounded top.
        const sx = Math.sin(theta), sz = Math.cos(theta);
        const z = sz > 0 ? sz * s.rz : sz * s.rz * 0.62;   // flatten the underside
        return { x: sx * s.rx, z };
      },
    }));
    const footRings = orientedTube(b, fs, limbSegments);
    capRingFan(b, footRings[footRings.length - 1], footSamples[footSamples.length - 1].pos, limbSegments, 1, W([['toe' + S, 1]]), false);
    capRingFan(b, footRings[0], footSamples[0].pos, limbSegments, 0, W([['foot' + S, 1]]), true);

    // Individual toes at higher detail levels.
    if (opts.toes) {
      for (let t = 0; t < 5; t++) {
        const tx = ankle.x + (sgn) * (t - 2) * m.footLen * 0.058;
        const r = m.footLen * (0.040 - t * 0.004);
        const len = m.footLen * (0.085 - t * 0.010);
        b.blob(
          new THREE.Vector3(tx, ankle.y - m.footH * 0.60, m.footLen * (0.70 + (t === 0 ? 0.02 : -t * 0.012))),
          { x: r, y: r * 0.85, z: len },
          Math.max(5, Math.round(limbSegments * 0.6)), 4,
          W([['toe' + S, 1]])
        );
      }
    }
  }

  // =========================================================================
  // HEAD
  // =========================================================================
  b.beginGroup(MAT_HEAD);
  const headBottom = m.chinY - m.headH * 0.12;
  const headSpan = H - headBottom;
  const headCY = headBottom + headSpan * 0.5;
  const hz = J.head.z;
  const Rx = m.headH * 0.385 * face.headWidth;
  const Ry = headSpan * 0.5;
  const Rz = m.headH * 0.432 * face.headDepth;
  const headRings = Math.max(14, Math.round(segments * 1.6));
  const headSegs = Math.max(12, Math.round(segments * 1.5));
  const headW = W([['head', 1]]);
  const headNeckW = W([['head', 0.55], ['neck', 0.45]]);

  const hgrid = [];
  for (let r = 0; r <= headRings; r++) {
    const phi = (r / headRings) * Math.PI;      // 0 = crown
    const row = [];
    for (let s = 0; s <= headSegs; s++) {
      // theta measured from the front (+Z), positive toward +X (character's left)
      const theta = (s / headSegs) * TAU - Math.PI;
      const sx = Math.sin(phi) * Math.sin(theta);
      const sy = Math.cos(phi);
      const sz = Math.sin(phi) * Math.cos(theta);
      let x = sx * Rx, y = sy * Ry, z = sz * Rz;
      const vGeo = clamp01((y + Ry) / (Ry * 2));
          const sc = sculptHead(x, y, z, vGeo, theta, { Rx, Ry, Rz }, face, m);
      const wy = headCY + sc.y;
      const vFinal = clamp01((wy - headBottom) / headSpan);
      row.push(b.vertex(
        sc.x, wy, sc.z + hz,
        faceU(theta), faceV(vFinal),
        vFinal < 0.20 ? headNeckW : headW
      ));
    }
    hgrid.push(row);
  }
  for (let r = 0; r < headRings; r++) {
    for (let s = 0; s < headSegs; s++) {
      // Rings run crown -> chin and segments run with +theta, so this order is
      // what puts the outward normal on the outside of the skull.
      b.quad(hgrid[r][s], hgrid[r + 1][s], hgrid[r + 1][s + 1], hgrid[r][s + 1]);
    }
  }

  // Ears
  const earY = headBottom + headSpan * 0.500;
  const earSize = m.headH * 0.098 * face.earSize;
  for (const sgn of [1, -1]) {
    b.blob(
      new THREE.Vector3(sgn * Rx * 0.92, earY, hz - Rz * 0.09),
      { x: earSize * 0.30 * (1 + face.earStick), y: earSize, z: earSize * 0.62 },
      Math.max(7, Math.round(segments * 0.7)), Math.max(5, Math.round(segments * 0.5)),
      headW,
      [0.86, 0.40, 0.10, 0.18],
      (px, py, pz) => {
        // Flatten against the skull and hollow the concha.
        const hollow = 1 - 0.45 * Math.exp(-((py / earSize) * (py / earSize)) * 3.2);
        return { x: px * hollow, y: py, z: pz * (0.82 + 0.3 * Math.abs(py / earSize)) };
      }
    );
  }

  const geometry = b.build({ smoothNormals: true, weldEpsilon: H * 0.0006 });
  return {
    geometry,
    headBottom, headSpan, headCenterY: headCY,
    headRadii: { x: Rx, y: Ry, z: Rz },
    headZ: hz,
    eyeRadius: m.headH * 0.052 * face.eyeSize,
  };
}

/**
 * Eyeball geometry with a planar UV projection so the painted iris lands dead
 * centre on the front of the sphere.
 */
export function buildEyeGeometry(radius, segments) {
  const g = new THREE.SphereGeometry(radius, segments || 18, segments || 14);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    uv.setXY(i, 0.5 + n.x * 0.621, 0.5 + n.y * 0.621);
  }
  uv.needsUpdate = true;
  return g;
}

/**
 * Eyelid shells. `upper` covers the top of the eyeball; rotating it about X
 * closes the eye. Slightly larger than the eyeball so it never z-fights.
 */
export function buildEyelidGeometry(radius, upper, segments) {
  const r = radius * 1.045;
  const g = upper
    ? new THREE.SphereGeometry(r, segments || 16, Math.max(6, Math.round((segments || 16) * 0.5)), 0, TAU, 0, Math.PI * 0.46)
    : new THREE.SphereGeometry(r, segments || 16, Math.max(5, Math.round((segments || 16) * 0.35)), 0, TAU, Math.PI * 0.63, Math.PI * 0.37);
  return g;
}

/** Tear-duct / eye-water sheen used only at high quality. */
export function buildEyeWetGeometry(radius, segments) {
  return new THREE.SphereGeometry(radius * 1.02, segments || 14, segments || 10, 0, TAU, 0, Math.PI * 0.55);
}
