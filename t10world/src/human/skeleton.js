// T10 World - parametric humanoid skeleton.
// Joint positions are computed from body parameters (height, build, gender, limb
// ratios), so every character gets a genuinely different rig rather than one
// skeleton scaled up and down.
import * as THREE from '../../vendor/three.module.js';
import { clamp01, clampv, lerpv, DEG } from '../core/math.js';

/** Height limits from the design brief, in meters. */
export const HEIGHT_RANGE = {
  male:   { min: 1.5494, max: 2.4384 },  // 5'1" .. 8'0"
  female: { min: 1.3462, max: 1.8796 },  // 4'5" .. 6'2"
};

export const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'];

/**
 * Default body parameters. `weight` and `muscle` are 0..1 sliders;
 * everything else is a multiplier around 1.0.
 */
export function defaultBodyParams(gender) {
  const female = gender === 'female';
  return {
    gender: female ? 'female' : 'male',
    height: female ? 1.65 : 1.78,
    weight: 0.5,
    muscle: female ? 0.35 : 0.45,
    shoulderWidth: 1.0,
    hipWidth: 1.0,
    legLength: 1.0,
    armLength: 1.0,
    neckLength: 1.0,
    headSize: 1.0,
    bustSize: female ? 0.5 : 0.0,
    posture: 0.0,      // -1 slouched .. +1 upright
    footSize: 1.0,
    handSize: 1.0,
  };
}

/**
 * Compute world-space rest joint positions for a T-pose.
 * Returns a flat map of joint name -> THREE.Vector3, plus derived measurements
 * the mesh builder needs (radii, widths).
 */
export function computeProportions(p) {
  const female = p.gender === 'female';
  const H = p.height;
  const w = clamp01(p.weight);
  const m = clamp01(p.muscle);

  // Canonical 7.5-head figure, adjusted by parameters.
  const headH = H * 0.1315 * p.headSize;
  const eyeLine = H * 0.935;
  const chinY = H - headH * 1.02;
  const neckTopY = chinY - H * 0.014 * p.neckLength;
  const neckBaseY = neckTopY - H * 0.031 * p.neckLength;
  const shoulderY = neckBaseY - H * 0.003;
  const chestY = H * (female ? 0.725 : 0.735);
  const waistY = H * (female ? 0.625 : 0.615);
  const hipY = H * 0.53;
  const crotchY = H * (0.485 - (p.legLength - 1) * 0.06);

  // Widths. Male shoulders are wider relative to hips; female the inverse.
  const shoulderHalf = H * (female ? 0.098 : 0.115) * p.shoulderWidth * (1 + m * 0.10 + w * 0.05);
  const hipHalf = H * (female ? 0.086 : 0.079) * p.hipWidth * (1 + w * 0.17);
  const waistHalf = H * (female ? 0.058 : 0.067) * (1 + w * 0.42 - m * 0.03);
  const chestHalf = H * (female ? 0.079 : 0.090) * (1 + m * 0.13 + w * 0.16);

  // Leg chain
  const legTotal = (crotchY) * 1.0;
  const thighLen = legTotal * 0.54;
  const shinLen = legTotal * 0.42;
  const ankleY = legTotal - thighLen - shinLen;
  const kneeY = crotchY - thighLen;
  const footLen = H * 0.152 * p.footSize;
  const footH = H * 0.038 * p.footSize;

  // Arm chain
  const armSpan = H * 0.445 * p.armLength;
  const upperArmLen = armSpan * 0.40;
  const forearmLen = armSpan * 0.36;
  const handLen = armSpan * 0.215 * p.handSize;

  const shoulderX = shoulderHalf * 0.98;
  const armY = shoulderY - H * 0.034;   // glenohumeral joint sits ~5cm below the acromion

  const J = {};
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  J.root = V(0, 0, 0);
  J.hips = V(0, hipY, 0);
  J.spine = V(0, lerpv(hipY, waistY, 0.75), p.posture * -0.004 * H);
  J.chest = V(0, chestY, p.posture * -0.006 * H);
  J.neck = V(0, neckBaseY, p.posture * 0.010 * H);
  J.head = V(0, neckTopY, p.posture * 0.004 * H);
  J.headTop = V(0, H, 0);
  J.jaw = V(0, chinY + headH * 0.30, headH * 0.16);

  const eyeSep = headH * 0.145;   // ~6.3cm interpupillary on an adult head
  J.eyeL = V(eyeSep, eyeLine, headH * 0.30);
  J.eyeR = V(-eyeSep, eyeLine, headH * 0.30);

  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R';
    J['clavicle' + S] = V(s * H * 0.022, shoulderY - H * 0.004, 0);
    J['upperArm' + S] = V(s * shoulderX, armY, 0);
    J['lowerArm' + S] = V(s * (shoulderX + upperArmLen), armY, 0);
    J['hand' + S] = V(s * (shoulderX + upperArmLen + forearmLen), armY, 0);
    J['handEnd' + S] = V(s * (shoulderX + upperArmLen + forearmLen + handLen), armY, 0);

    // Fingers fan out from the palm. Index ..pinky sit along Z; thumb juts forward.
    const palmW = handLen * 0.50;
    const fingerSpread = [-0.28, -0.095, 0.095, 0.27];
    const fingerLen = [0.50, 0.55, 0.51, 0.40];
    for (let f = 1; f < 5; f++) {
      const base = V(
        s * (shoulderX + upperArmLen + forearmLen + handLen * 0.48),
        armY + palmW * fingerSpread[f - 1] * 0.18,
        palmW * fingerSpread[f - 1]
      );
      const L = handLen * fingerLen[f - 1];
      J[FINGER_NAMES[f] + S + '1'] = base;
      J[FINGER_NAMES[f] + S + '2'] = V(base.x + s * L * 0.55, base.y, base.z);
      J[FINGER_NAMES[f] + S + '3'] = V(base.x + s * L, base.y, base.z);
    }
    const thumbBase = V(
      s * (shoulderX + upperArmLen + forearmLen + handLen * 0.16),
      armY - palmW * 0.10,
      palmW * 0.62
    );
    J['thumb' + S + '1'] = thumbBase;
    J['thumb' + S + '2'] = V(thumbBase.x + s * handLen * 0.24, thumbBase.y, thumbBase.z + handLen * 0.18);
    J['thumb' + S + '3'] = V(thumbBase.x + s * handLen * 0.42, thumbBase.y, thumbBase.z + handLen * 0.30);

    const legX = s * hipHalf * 0.55;
    J['upperLeg' + S] = V(legX, crotchY + H * 0.045, 0);
    J['lowerLeg' + S] = V(legX, kneeY, H * 0.004);
    J['foot' + S] = V(legX, ankleY + footH * 0.92, 0);
    J['toe' + S] = V(legX, footH * 0.42, footLen * 0.46);
    J['toeEnd' + S] = V(legX, footH * 0.30, footLen * 0.72);
  }

  return {
    joints: J,
    measure: {
      height: H, headH, chinY, neckBaseY, shoulderY, chestY, waistY, hipY, crotchY,
      shoulderHalf, hipHalf, waistHalf, chestHalf,
      thighLen, shinLen, upperArmLen, forearmLen, handLen, footLen, footH,
      eyeLine, eyeSep,
      // Limb radii used by the mesh builder.
      neckR: H * (female ? 0.0265 : 0.0305) * (1 + w * 0.12),
      thighR: H * (female ? 0.0455 : 0.0435) * (1 + w * 0.34 + m * 0.14),
      kneeR: H * 0.0400 * (1 + w * 0.18 + m * 0.05),
      calfR: H * (female ? 0.0345 : 0.0355) * (1 + w * 0.22 + m * 0.18),
      ankleR: H * 0.0215 * (1 + w * 0.12),
      upperArmR: H * (female ? 0.0245 : 0.0285) * (1 + w * 0.22 + m * 0.26),
      elbowR: H * 0.0238 * (1 + w * 0.12 + m * 0.06),
      forearmR: H * (female ? 0.0215 : 0.0245) * (1 + w * 0.18 + m * 0.20),
      wristR: H * 0.0178 * (1 + w * 0.10),
      handThick: H * 0.0092 * p.handSize,
      fingerR: H * 0.0049 * p.handSize * (1 + w * 0.12),
      bust: p.bustSize,
      female, weight: w, muscle: m,
    },
    params: p,
  };
}

/** Bone graph: [name, parentName]. Order matters — parents precede children. */
export const BONE_GRAPH = (() => {
  const g = [
    ['root', null],
    ['hips', 'root'],
    ['spine', 'hips'],
    ['chest', 'spine'],
    ['neck', 'chest'],
    ['head', 'neck'],
    ['jaw', 'head'],
    ['eyeL', 'head'],
    ['eyeR', 'head'],
  ];
  for (const S of ['L', 'R']) {
    g.push(['clavicle' + S, 'chest']);
    g.push(['upperArm' + S, 'clavicle' + S]);
    g.push(['lowerArm' + S, 'upperArm' + S]);
    g.push(['hand' + S, 'lowerArm' + S]);
    for (const f of FINGER_NAMES) {
      g.push([f + S + '1', 'hand' + S]);
      g.push([f + S + '2', f + S + '1']);
      g.push([f + S + '3', f + S + '2']);
    }
    g.push(['upperLeg' + S, 'hips']);
    g.push(['lowerLeg' + S, 'upperLeg' + S]);
    g.push(['foot' + S, 'lowerLeg' + S]);
    g.push(['toe' + S, 'foot' + S]);
  }
  return g;
})();

/** Same graph minus finger joints — used for distant NPCs on low quality. */
export const BONE_GRAPH_SIMPLE = BONE_GRAPH.filter(([n]) => !FINGER_NAMES.some((f) => n.startsWith(f)));

/**
 * Build a THREE.Skeleton from computed proportions.
 * Returns { bones, boneMap, skeleton, root, boneIndex } where boneIndex maps
 * name -> index for skin weight assignment.
 */
export function buildSkeleton(prop, opts) {
  opts = opts || {};
  const graph = opts.fingers === false ? BONE_GRAPH_SIMPLE : BONE_GRAPH;
  const J = prop.joints;
  const bones = [];
  const boneMap = {};
  const boneIndex = {};

  for (let i = 0; i < graph.length; i++) {
    const [name, parentName] = graph[i];
    const bone = new THREE.Bone();
    bone.name = name;
    const world = J[name] || new THREE.Vector3();
    const parentWorld = parentName ? (J[parentName] || new THREE.Vector3()) : new THREE.Vector3();
    bone.position.copy(world).sub(parentWorld);
    bone.userData.restWorld = world.clone();
    bone.userData.restLocal = bone.position.clone();
    if (parentName) boneMap[parentName].add(bone);
    bones.push(bone);
    boneMap[name] = bone;
    boneIndex[name] = i;
  }

  const skeleton = new THREE.Skeleton(bones);
  return { bones, boneMap, boneIndex, skeleton, root: bones[0] };
}

/** Reset every bone to its bind pose. */
export function resetPose(boneMap) {
  for (const name in boneMap) {
    const b = boneMap[name];
    b.position.copy(b.userData.restLocal);
    b.quaternion.identity();
    b.scale.set(1, 1, 1);
  }
}

/**
 * Two-bone IK in the plane defined by a pole direction. Used for feet on uneven
 * ground and for hands reaching door handles / steering wheels.
 */
const _ikA = new THREE.Vector3(), _ikB = new THREE.Vector3(), _ikC = new THREE.Vector3();
const _ikDir = new THREE.Vector3(), _ikPole = new THREE.Vector3(), _ikAxis = new THREE.Vector3();
const _ikQ = new THREE.Quaternion(), _ikM = new THREE.Matrix4();

export function solveTwoBoneIK(rootBone, midBone, endBone, targetWorld, poleWorld, weight) {
  weight = weight == null ? 1 : clamp01(weight);
  if (weight <= 0.001) return;

  rootBone.updateWorldMatrix(true, false);
  _ikA.setFromMatrixPosition(rootBone.matrixWorld);
  midBone.updateWorldMatrix(false, false);
  _ikB.setFromMatrixPosition(midBone.matrixWorld);
  endBone.updateWorldMatrix(false, false);
  _ikC.setFromMatrixPosition(endBone.matrixWorld);

  const lenAB = _ikA.distanceTo(_ikB);
  const lenBC = _ikB.distanceTo(_ikC);
  const maxLen = (lenAB + lenBC) * 0.999;
  _ikDir.copy(targetWorld).sub(_ikA);
  let lenAT = _ikDir.length();
  if (lenAT < 1e-5) return;
  const clampedLen = clampv(lenAT, Math.abs(lenAB - lenBC) + 1e-4, maxLen);
  _ikDir.multiplyScalar(clampedLen / lenAT);
  lenAT = clampedLen;

  // Law of cosines for the knee/elbow bend.
  const cosA = clampv((lenAB * lenAB + lenAT * lenAT - lenBC * lenBC) / (2 * lenAB * lenAT), -1, 1);
  const angleA = Math.acos(cosA);

  _ikPole.copy(poleWorld).sub(_ikA);
  _ikAxis.copy(_ikDir).normalize().cross(_ikPole).normalize();
  if (!isFinite(_ikAxis.x) || _ikAxis.lengthSq() < 1e-8) _ikAxis.set(1, 0, 0);

  // Aim root at the target, then swing out by angleA toward the pole.
  const targetDir = _ikDir.clone().normalize();
  const bendDir = targetDir.clone().applyAxisAngle(_ikAxis, -angleA);
  applyAimRotation(rootBone, _ikB.clone().sub(_ikA).normalize(), bendDir, weight);

  // Re-evaluate the mid joint after the root moved, then aim it at the target.
  rootBone.updateWorldMatrix(true, true);
  _ikB.setFromMatrixPosition(midBone.matrixWorld);
  _ikC.setFromMatrixPosition(endBone.matrixWorld);
  const curDir = _ikC.clone().sub(_ikB).normalize();
  const wantDir = targetWorld.clone().sub(_ikB).normalize();
  applyAimRotation(midBone, curDir, wantDir, weight);
  midBone.updateWorldMatrix(false, true);
}

/** Rotate a bone so `fromDirWorld` points along `toDirWorld`, blended by weight. */
export function applyAimRotation(bone, fromDirWorld, toDirWorld, weight) {
  _ikQ.setFromUnitVectors(fromDirWorld, toDirWorld);
  if (weight < 1) _ikQ.slerp(new THREE.Quaternion(), 1 - weight);
  // Convert the world-space delta into the bone's parent space.
  const parent = bone.parent;
  if (parent) {
    _ikM.extractRotation(parent.matrixWorld);
    const parentQ = new THREE.Quaternion().setFromRotationMatrix(_ikM);
    const inv = parentQ.clone().invert();
    const localDelta = inv.clone().multiply(_ikQ).multiply(parentQ);
    bone.quaternion.premultiply(localDelta);
  } else {
    bone.quaternion.premultiply(_ikQ);
  }
}

/** Human-readable summary used by T10 when describing a character. */
export function describeBuild(params) {
  const w = params.weight;
  const m = params.muscle;
  let build = 'average';
  if (w < 0.28 && m < 0.4) build = 'slim';
  else if (w < 0.32 && m > 0.6) build = 'lean and athletic';
  else if (m > 0.72) build = 'muscular';
  else if (w > 0.74) build = 'heavy-set';
  else if (w > 0.6) build = 'stocky';
  else if (w < 0.38) build = 'slender';
  return build;
}
