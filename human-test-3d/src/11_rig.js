// ============================================================================
// Reusable character rig: bone hierarchy + proportion-driven bind pose
// Character space: origin on the floor between the feet, +Y up, +Z forward,
// +X = character's LEFT. All bones have identity rotation in the bind pose.
// ============================================================================
const BONE_NAMES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'jaw', 'eye_L', 'eye_R', 'lid_L', 'lid_R',
  'clavicle_L', 'upperarm_L', 'forearm_L', 'hand_L', 'fingers1_L', 'fingers2_L', 'thumb_L',
  'clavicle_R', 'upperarm_R', 'forearm_R', 'hand_R', 'fingers1_R', 'fingers2_R', 'thumb_R',
  'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R', 'hair'];
const B = {};
BONE_NAMES.forEach((n, i) => { B[n] = i; });
const BONE_PARENT_NAME = {
  hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head', eye_L: 'head', eye_R: 'head',
  lid_L: 'head', lid_R: 'head', clavicle_L: 'chest', upperarm_L: 'clavicle_L', forearm_L: 'upperarm_L', hand_L: 'forearm_L',
  fingers1_L: 'hand_L', fingers2_L: 'fingers1_L', thumb_L: 'hand_L', clavicle_R: 'chest', upperarm_R: 'clavicle_R',
  forearm_R: 'upperarm_R', hand_R: 'forearm_R', fingers1_R: 'hand_R', fingers2_R: 'fingers1_R', thumb_R: 'hand_R',
  thigh_L: 'hips', shin_L: 'thigh_L', foot_L: 'shin_L', thigh_R: 'hips', shin_R: 'thigh_R', foot_R: 'shin_R', hair: 'head'
};
const BONE_PARENT = BONE_NAMES.map(n => n === 'root' ? -1 : B[BONE_PARENT_NAME[n]]);
const NUM_BONES = BONE_NAMES.length;
const SIDE_SIGN = [1, -1];          // 0 = Left (+X), 1 = Right (-X)
const SIDE_SUFFIX = ['_L', '_R'];
function SB(name, side) { return B[name + SIDE_SUFFIX[side]]; }

// Hit regions (precise, assigned per vertex)
const REGION = {
  HEAD: 0, NECK: 1, UPPER_CHEST: 2, TORSO: 3, ABDOMEN: 4, PELVIS: 5,
  L_UPPER_ARM: 6, L_FOREARM: 7, L_HAND: 8, R_UPPER_ARM: 9, R_FOREARM: 10, R_HAND: 11,
  L_THIGH: 12, L_LOWER_LEG: 13, L_FOOT: 14, R_THIGH: 15, R_LOWER_LEG: 16, R_FOOT: 17
};
const REGION_NAMES = ['Head', 'Neck', 'Upper Chest', 'Torso', 'Abdomen', 'Pelvis',
  'Left Upper Arm', 'Left Forearm', 'Left Hand', 'Right Upper Arm', 'Right Forearm', 'Right Hand',
  'Left Thigh', 'Left Lower Leg', 'Left Foot', 'Right Thigh', 'Right Lower Leg', 'Right Foot'];
const REGION_DAMAGE_MUL = [3.6, 2.0, 1.45, 1.25, 1.1, 1.0, 0.55, 0.45, 0.35, 0.55, 0.45, 0.35, 0.65, 0.5, 0.35, 0.65, 0.5, 0.35];
const REGION_COUNT = REGION_NAMES.length;
function sideRegion(base, side) { // base: 'UPPER_ARM' etc.
  return REGION[(side === 0 ? 'L_' : 'R_') + base];
}

// Build the rig specification from an appearance (all measurements in meters, character space)
function buildRigSpec(app) {
  const H = app.height, bd = app.body, male = app.male;
  const r = { H, male };
  r.sole = app.shoes.def.sole * clamp(H / 1.75, 0.9, 1.1);
  r.sHead = Math.sqrt(H / 1.75) * bd.headScale * (male ? 1.0 : 0.955);
  const legK = bd.legRatio, armK = bd.armRatio;
  r.footLen = 0.152 * H;
  r.ankleY = r.sole + 0.039 * H;
  r.shinLen = 0.240 * H * legK;
  r.thighLen = 0.232 * H * legK;
  r.kneeY = r.ankleY + r.shinLen;
  r.hipJY = r.kneeY + r.thighLen;
  r.legLen = r.shinLen + r.thighLen;
  r.crown = H + r.sole;
  r.eyeY = r.crown - 0.118 * r.sHead;
  r.headCenter = new V3(0, r.eyeY, 0.010 * r.sHead);
  r.headJ = new V3(0, r.eyeY - 0.050 * r.sHead, r.headCenter.z - 0.028 * r.sHead);
  r.neckLen = 0.064 * r.sHead * bd.neck;
  r.neckBaseY = r.headJ.y - r.neckLen;
  r.crotchY = r.hipJY - 0.036 * H;
  r.shoulderY = r.neckBaseY - 0.056 * H;
  r.shoulderHalf = (male ? 0.0995 : 0.0915) * H * Math.pow(bd.shoulder, 0.6);
  r.hipHalf = (male ? 0.0505 : 0.0555) * H * Math.pow(bd.hip, 0.5);
  r.armAngle = 62 * DEG; // relaxed A-pose: 62 degrees below horizontal
  r.upperArmLen = 0.186 * H * armK;
  r.forearmLen = 0.146 * H * armK;
  r.palmLen = 0.058 * H * armK;
  r.fingerLen = 0.048 * H * armK;
  r.handLen = r.palmLen + r.fingerLen;

  // per-side arm frame in bind pose: d = along arm, e1 = thumb side (+Z), e2 = palm normal
  r.armDir = [0, 1].map(s => new V3(SIDE_SIGN[s] * Math.cos(r.armAngle), -Math.sin(r.armAngle), 0));
  r.armE1 = [new V3(0, 0, 1), new V3(0, 0, 1)];
  r.armE2 = [0, 1].map(s => new V3().crossVectors(r.armDir[s], r.armE1[s]).multiplyScalar(SIDE_SIGN[s]).normalize());
  // elbow hinge axis (forearm bends toward +Z, thumb side): h = d x bendDir
  r.elbowAxis = [0, 1].map(s => new V3().crossVectors(r.armDir[s], new V3(0, 0, 1)).normalize());
  r.kneeAxis = new V3(1, 0, 0); // (0,-1,0) x (0,0,-1)

  const pos = new Array(NUM_BONES);
  const sp = (x, y, z) => new V3(x, y, z);
  pos[B.root] = sp(0, 0, 0);
  pos[B.hips] = sp(0, r.hipJY + 0.035 * H, 0.0);
  pos[B.spine] = sp(0, r.hipJY + 0.105 * H, -0.010 * H);
  pos[B.chest] = sp(0, r.hipJY + 0.205 * H, -0.012 * H);
  pos[B.neck] = sp(0, r.neckBaseY, -0.014 * H);
  pos[B.head] = r.headJ.clone();
  pos[B.jaw] = r.headCenter.clone().add(sp(0, -0.030, -0.014).multiplyScalar(r.sHead));
  const F = app.face;
  r.eyeLocal = sp(0.0315 + 0.0018 * F.eyeSpacing, 0.0, 0.068);
  r.eyeRadius = 0.0118 * (1 + 0.04 * F.eyeSize);
  for (let s = 0; s < 2; s++) {
    const sg = SIDE_SIGN[s];
    const eye = r.headCenter.clone().add(sp(sg * r.eyeLocal.x, r.eyeLocal.y, r.eyeLocal.z).multiplyScalar(r.sHead));
    pos[SB('eye', s)] = eye;
    pos[SB('lid', s)] = eye.clone();
    const d = r.armDir[s], e1 = r.armE1[s], e2 = r.armE2[s];
    pos[SB('clavicle', s)] = sp(sg * 0.014 * H, r.neckBaseY - 0.030 * H, 0.010 * H);
    const sh = sp(sg * r.shoulderHalf, r.shoulderY, 0);
    pos[SB('upperarm', s)] = sh;
    const el = sh.clone().addScaledVector(d, r.upperArmLen);
    pos[SB('forearm', s)] = el;
    const wr = el.clone().addScaledVector(d, r.forearmLen);
    pos[SB('hand', s)] = wr;
    const kn = wr.clone().addScaledVector(d, r.palmLen);
    pos[SB('fingers1', s)] = kn;
    pos[SB('fingers2', s)] = kn.clone().addScaledVector(d, r.fingerLen * 0.48);
    pos[SB('thumb', s)] = wr.clone().addScaledVector(d, 0.010 * H).addScaledVector(e1, 0.0135 * H).addScaledVector(e2, 0.0045 * H);
    pos[SB('thigh', s)] = sp(sg * r.hipHalf, r.hipJY, 0);
    pos[SB('shin', s)] = sp(sg * r.hipHalf, r.kneeY, 0);
    pos[SB('foot', s)] = sp(sg * r.hipHalf, r.ankleY, 0);
  }
  pos[B.hair] = r.headCenter.clone().add(sp(0, 0.03, -0.085).multiplyScalar(r.sHead));
  r.bindPos = pos;
  // local offsets (bind) relative to parent
  r.localOffset = pos.map((p, i) => BONE_PARENT[i] < 0 ? p.clone() : p.clone().sub(pos[BONE_PARENT[i]]));
  // useful derived
  r.hipsHeight = pos[B.hips].y;
  r.standHipsY = pos[B.hips].y;
  r.mass = clamp(70 * Math.pow(H / 1.75, 2.4) * bd.massMul * (male ? 1.0 : 0.86), 42, 140);
  return r;
}
HT.buildRigSpec = buildRigSpec;
