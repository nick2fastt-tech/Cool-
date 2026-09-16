// T10 World - procedural clothing. Three outfits per gender (as specified),
// plus a base layer and shoes. Garments are skinned to the same skeleton and
// lofted from the wearer's own measurements, so they fit any body.
import * as THREE from '../../vendor/three.module.js';
import { SkinnedMeshBuilder, torsoShape, limbShape } from './meshbuilder.js';
import { fabricTexture, fabricRoughness } from './textures.js';
import { clamp01, clampv, lerpv, smooth01, TAU, makeRng } from '../core/math.js';
import { settings } from '../core/settings.js';

/** Interpolate the body silhouette at an arbitrary height. */
function bodyProfileAtY(y, m, bustAmt, bellyAmt, gluteAmt) {
  const levels = [
    { y: m.crotchY - m.height * 0.02, rx: m.hipHalf * 0.84, dr: 0.80, belly: bellyAmt * 0.35, glute: gluteAmt * 0.5, bust: 0 },
    { y: m.hipY, rx: m.hipHalf, dr: 0.76, belly: bellyAmt * 0.7, glute: gluteAmt * 0.82, bust: 0 },
    { y: m.waistY, rx: m.waistHalf, dr: 0.75, belly: bellyAmt * 0.92, glute: 0.06, bust: 0 },
    { y: m.chestY, rx: m.chestHalf, dr: 0.70, belly: 0, glute: 0, bust: bustAmt },
    { y: m.shoulderY, rx: m.shoulderHalf * 0.90, dr: 0.62, belly: 0, glute: 0, bust: bustAmt * 0.3 },
    { y: m.neckBaseY + m.height * 0.008, rx: m.neckR * 1.5, dr: 0.94, belly: 0, glute: 0, bust: 0 },
  ];
  if (y <= levels[0].y) return levels[0];
  if (y >= levels[levels.length - 1].y) return levels[levels.length - 1];
  for (let i = 0; i < levels.length - 1; i++) {
    const a = levels[i], b = levels[i + 1];
    if (y <= b.y) {
      const t = (y - a.y) / Math.max(1e-6, b.y - a.y);
      return {
        y, rx: lerpv(a.rx, b.rx, t), dr: lerpv(a.dr, b.dr, t),
        belly: lerpv(a.belly, b.belly, t), glute: lerpv(a.glute, b.glute, t),
        bust: lerpv(a.bust, b.bust, t),
      };
    }
  }
  return levels[levels.length - 1];
}

/** Bone weights for a torso vertex at height y. */
function torsoWeightsAt(y, m, BI) {
  if (y <= m.hipY) return [[BI('hips'), 1]];
  if (y <= m.waistY) {
    const t = (y - m.hipY) / Math.max(1e-6, m.waistY - m.hipY);
    return [[BI('hips'), 1 - t], [BI('spine'), t]];
  }
  if (y <= m.chestY) {
    const t = (y - m.waistY) / Math.max(1e-6, m.chestY - m.waistY);
    return [[BI('spine'), 1 - t], [BI('chest'), t]];
  }
  if (y <= m.neckBaseY) {
    const t = clamp01((y - m.chestY) / Math.max(1e-6, m.neckBaseY - m.chestY));
    return [[BI('chest'), 1 - t * 0.35], [BI('neck'), t * 0.35]];
  }
  return [[BI('neck'), 1]];
}

/** ---- Torso garment (tee, tank, hoodie, crop top, dress) ---- */
function buildTorsoPiece(b, piece, prop, BI, segments) {
  const m = prop.measure;
  const bustAmt = m.female ? m.bust * 0.85 : 0;
  const bellyAmt = clampv((m.weight - 0.42) * 0.85, -0.05, 0.42);
  const gluteAmt = 0.18 + m.weight * 0.30 + (m.female ? 0.12 : 0);

  const yTop = piece.yTop(m);
  const yBot = piece.yBottom(m);
  const inflateBase = piece.inflate * m.height;
  const steps = Math.max(6, Math.round((yTop - yBot) / (m.height * 0.035)));
  const sections = [];

  const sectionAt = (y, v, extraInflate, rxOverride) => {
    const pr = bodyProfileAtY(y, m, bustAmt, bellyAmt, gluteAmt);
    const rx = rxOverride != null ? rxOverride : pr.rx + inflateBase + (extraInflate || 0);
    return {
      center: new THREE.Vector3(0, y, 0),
      v, weights: torsoWeightsAt(y, m, BI),
      shape: torsoShape({
        rx, rz: rxOverride != null ? rxOverride * 0.9 : pr.rx * pr.dr + inflateBase + (extraInflate || 0),
        belly: pr.belly, glute: pr.glute * (piece.kind === 'dress' ? 0.4 : 0.8),
        bust: pr.bust, flatten: 0.2,
      }),
    };
  };

  // Start just inside the body so the bottom edge reads as a hem, not a cut.
  const hemPr = bodyProfileAtY(yBot, m, bustAmt, bellyAmt, gluteAmt);
  sections.push(sectionAt(yBot + m.height * 0.004, -0.05, 0, Math.max(hemPr.rx * 0.97, hemPr.rx + inflateBase - m.height * 0.004)));
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const y = lerpv(yBot, yTop, f);
    // Flare (dresses, hoodie hems) opens the bottom outward.
    const flare = piece.flare ? piece.flare * Math.pow(1 - f, 2.0) * m.height * 0.14 : 0;
    sections.push(sectionAt(y, f * 2, flare));
  }

  // A crew neckline continues the tube up and inward across the shoulders,
  // which is exactly the shape of a t-shirt yoke.
  if (piece.neckline === 'crew') {
    // Rise steeply from the acromion to the neck so the yoke slopes like cloth
    // over a trapezius instead of sitting as a flat annulus.
    const neckR = m.neckR * 1.34 + inflateBase;
    const shoulderPr = bodyProfileAtY(yTop, m, bustAmt, bellyAmt, gluteAmt);
    const topRx = shoulderPr.rx + inflateBase;
    sections.push(sectionAt(yTop + m.height * 0.012, 2.05, 0, lerpv(topRx, neckR, 0.30)));
    sections.push(sectionAt(m.neckBaseY + m.height * 0.010, 2.12, 0, lerpv(topRx, neckR, 0.72)));
    sections.push(sectionAt(m.neckBaseY + m.height * 0.024, 2.2, 0, neckR));
  }
  b.tube(sections, segments, {});

  // Strap tops (tanks, dresses) get real shoulder straps instead of a collar.
  if (piece.neckline === 'strap') {
    const strapR = m.height * (piece.strapWidth || 0.010);
    const pr = bodyProfileAtY(yTop, m, bustAmt, bellyAmt, gluteAmt);
    const rx = pr.rx + inflateBase;
    const rz = pr.rx * pr.dr + inflateBase;
    const shoulderY = m.shoulderY + m.height * 0.004;
    for (const sgn of [1, -1]) {
      const x = sgn * rx * 0.58;
      const pts = [
        new THREE.Vector3(x, yTop - m.height * 0.010, rz * 0.72),
        new THREE.Vector3(sgn * rx * 0.70, lerpv(yTop, shoulderY, 0.55), rz * 0.42),
        new THREE.Vector3(sgn * rx * 0.76, shoulderY, 0),
        new THREE.Vector3(sgn * rx * 0.70, lerpv(yTop, shoulderY, 0.55), -rz * 0.45),
        new THREE.Vector3(x, yTop - m.height * 0.010, -rz * 0.76),
      ];
      const samples = pts.map((pos, i) => ({
        pos, v: i / (pts.length - 1),
        weights: [[BI('chest'), 0.75], [BI('neck'), 0.25]],
        shape: limbShape(strapR * (i === 0 || i === 4 ? 1.25 : 1.0), 0),
      }));
      orientedTubeInto(b, samples, Math.max(5, Math.round(segments * 0.5)));
    }
  }
  return sections;
}

/** ---- Sleeves ---- */
function buildSleeve(b, piece, prop, BI, segments, side) {
  if (!piece.sleeves || piece.sleeves === 'none') return;
  const m = prop.measure, J = prop.joints;
  const S = side;
  const sh = J['upperArm' + S], el = J['lowerArm' + S], wr = J['hand' + S];
  const inflate = piece.inflate * m.height * 1.25;
  const end = piece.sleeves === 'long' ? 1.0 : piece.sleeves === 'threequarter' ? 0.55 : 0.36;

  const pts = [];
  // The shoulder cap starts inside the torso and is wide enough to meet it.
  // A narrow cap sitting on the joint leaves a notch at the deltoid, which is
  // the first thing you notice on a wide-shouldered figure.
  pts.push({ pos: sh.clone().lerp(el, -0.52), r: m.upperArmR * 1.05 + inflate * 0.6, w: [[BI('chest'), 0.85], [BI('upperArm' + S), 0.15]] });
  pts.push({ pos: sh.clone().lerp(el, -0.24), r: m.upperArmR * 1.32 + inflate, w: [[BI('chest'), 0.6], [BI('upperArm' + S), 0.4]] });
  pts.push({ pos: sh.clone().lerp(el, -0.06), r: m.upperArmR * 1.20 + inflate, w: [[BI('upperArm' + S), 0.7], [BI('chest'), 0.3]] });
  pts.push({ pos: sh.clone().lerp(el, 0.06), r: m.upperArmR * 1.16 + inflate, w: [[BI('upperArm' + S), 0.9], [BI('chest'), 0.1]] });
  if (end <= 0.42) {
    pts.push({ pos: sh.clone().lerp(el, end * 0.6), r: m.upperArmR * 1.18 + inflate, w: [[BI('upperArm' + S), 1]] });
    pts.push({ pos: sh.clone().lerp(el, end), r: m.upperArmR * 1.22 + inflate, w: [[BI('upperArm' + S), 1]] });
  } else {
    pts.push({ pos: sh.clone().lerp(el, 0.5), r: m.upperArmR * 1.12 + inflate, w: [[BI('upperArm' + S), 1]] });
    pts.push({ pos: el.clone(), r: m.elbowR * 1.25 + inflate, w: [[BI('upperArm' + S), 0.45], [BI('lowerArm' + S), 0.55]] });
    if (end >= 0.9) {
      pts.push({ pos: el.clone().lerp(wr, 0.5), r: m.forearmR * 1.15 + inflate, w: [[BI('lowerArm' + S), 1]] });
      pts.push({ pos: el.clone().lerp(wr, 0.94), r: m.wristR * 1.30 + inflate * 0.8, w: [[BI('lowerArm' + S), 0.85], [BI('hand' + S), 0.15]] });
    } else {
      pts.push({ pos: el.clone().lerp(wr, (end - 0.5) * 2), r: m.forearmR * 1.2 + inflate, w: [[BI('lowerArm' + S), 1]] });
    }
  }
  const lastSleeve = pts[pts.length - 1];
  pts.push({ pos: lastSleeve.pos.clone(), r: Math.max(lastSleeve.r * 0.72, lastSleeve.r - inflate * 2.0), w: lastSleeve.w });
  const samples = pts.map((p, i) => ({
    pos: p.pos, v: i / (pts.length - 1) * 1.5, weights: p.w, shape: limbShape(p.r, 0),
  }));
  orientedTubeInto(b, samples, Math.max(6, Math.round(segments * 0.8)));
}

/** ---- Trousers / shorts / leggings ---- */
function buildBottomPiece(b, piece, prop, BI, segments) {
  const m = prop.measure, J = prop.joints;
  const bellyAmt = clampv((m.weight - 0.42) * 0.85, -0.05, 0.42);
  const gluteAmt = 0.18 + m.weight * 0.30 + (m.female ? 0.12 : 0);
  const inflate = piece.inflate * m.height;

  // Waistband down to the crotch.
  const yTop = piece.yTop(m);
  // The seat is capped at the crotch; that cap has to sit low enough and
  // narrow enough to be buried where the two leg tubes overlap, or it shows
  // between the thighs as a flat dark panel.
  const yBot = m.crotchY - m.height * 0.030;
  const steps = 6;
  const sections = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const y = lerpv(yBot, yTop, f);
    const pr = bodyProfileAtY(y, m, 0, bellyAmt, gluteAmt);
    // Pinch the seat in toward the crotch so the legs read as legs and the
    // garment doesn't end in a skirt-wide hem.
    const pinch = lerpv(0.70, 1.0, smooth01(clamp01(f / 0.55)));
    sections.push({
      center: new THREE.Vector3(0, y, 0),
      v: f, weights: torsoWeightsAt(y, m, BI),
      shape: torsoShape({
        rx: pr.rx * pinch + inflate * pinch, rz: pr.rx * pr.dr * pinch + inflate * pinch,
        belly: pr.belly * 0.8, glute: pr.glute, flatten: 0.15,
      }),
    });
  }
  // Cap the crotch so you can't see up inside the garment between the thighs.
  b.tube(sections, segments, { capStart: true });

  // Legs.
  for (const S of ['L', 'R']) {
    const hip = J['upperLeg' + S], knee = J['lowerLeg' + S], ankle = J['foot' + S];
    const legEnd = piece.legEnd;   // 0 = hip, 1 = ankle
    const pts = [];
    pts.push({ pos: hip.clone().lerp(knee, -0.22), r: m.thighR * 1.00 + inflate * 0.7, w: [[BI('upperLeg' + S), 0.30], [BI('hips'), 0.70]] });
    pts.push({ pos: hip.clone().lerp(knee, -0.06), r: m.thighR * 1.04 + inflate, w: [[BI('upperLeg' + S), 0.55], [BI('hips'), 0.45]] });
    pts.push({ pos: hip.clone().lerp(knee, 0.10), r: m.thighR * 1.03 + inflate, w: [[BI('upperLeg' + S), 0.85], [BI('hips'), 0.15]] });
    if (legEnd <= 0.5) {
      const e = legEnd / 0.5;
      pts.push({ pos: hip.clone().lerp(knee, e * 0.8), r: m.thighR * (1.0 - e * 0.12) + inflate * (1 + (piece.legFlare || 0) * 0.5), w: [[BI('upperLeg' + S), 1]] });
      pts.push({ pos: hip.clone().lerp(knee, e), r: m.thighR * (0.98 - e * 0.14) + inflate * (1.05 + (piece.legFlare || 0) * 0.8), w: [[BI('upperLeg' + S), 1]] });
    } else {
      pts.push({ pos: hip.clone().lerp(knee, 0.55), r: m.thighR * 0.88 + inflate, w: [[BI('upperLeg' + S), 1]] });
      pts.push({ pos: knee.clone(), r: m.kneeR * 1.20 + inflate, w: [[BI('upperLeg' + S), 0.45], [BI('lowerLeg' + S), 0.55]] });
      const e = (legEnd - 0.5) / 0.5;
      pts.push({ pos: knee.clone().lerp(ankle, e * 0.55), r: m.calfR * 1.06 + inflate, w: [[BI('lowerLeg' + S), 1]] });
      pts.push({ pos: knee.clone().lerp(ankle, e), r: (e > 0.85 ? m.ankleR * 1.35 : m.calfR * 0.95) + inflate * (1 + (piece.legFlare || 0)), w: [[BI('lowerLeg' + S), 1]] });
    }
    // Roll the hem back inside the leg: an open tube end shows its own interior
    // and reads as torn cloth.
    const lastLeg = pts[pts.length - 1];
    pts.push({ pos: lastLeg.pos.clone(), r: Math.max(lastLeg.r * 0.70, lastLeg.r - inflate * 2.2), w: lastLeg.w });
    const samples = pts.map((p, i) => ({ pos: p.pos, v: i / (pts.length - 1) * 2, weights: p.w, shape: limbShape(p.r, 0) }));
    orientedTubeInto(b, samples, Math.max(6, Math.round(segments * 0.85)));
  }
}

/** Shared oriented-tube helper (same framing rules as the body builder). */
function orientedTubeInto(b, samples, segments) {
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3(), normal = new THREE.Vector3(), binormal = new THREE.Vector3();
  const rings = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const prev = samples[Math.max(0, i - 1)], next = samples[Math.min(samples.length - 1, i + 1)];
    tangent.copy(next.pos).sub(prev.pos);
    if (tangent.lengthSq() < 1e-10) tangent.set(0, 1, 0);
    tangent.normalize();
    if (Math.abs(tangent.y) > 0.92) normal.set(0, 0, 1).cross(tangent).normalize();
    else normal.copy(up).cross(tangent).normalize();
    binormal.copy(tangent).cross(normal).normalize();
    const ring = [];
    for (let j = 0; j <= segments; j++) {
      const t = j / segments, theta = t * TAU;
      const off = s.shape(theta, s);
      ring.push(b.vertex(
        s.pos.x + normal.x * off.x + binormal.x * off.z,
        s.pos.y + normal.y * off.x + binormal.y * off.z,
        s.pos.z + normal.z * off.x + binormal.z * off.z,
        t * 1.5, s.v, s.weights
      ));
    }
    rings.push(ring);
  }
  // Right-handed frame, so wound the opposite way to SkinnedMeshBuilder.tube.
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], c = rings[i + 1];
    for (let j = 0; j < segments; j++) b.quad(a[j], c[j], c[j + 1], a[j + 1]);
  }
  return rings;
}

/** Hood lying on the shoulders behind the neck. */
function buildHood(b, prop, BI, segments, inflate) {
  const m = prop.measure;
  const cy = m.neckBaseY + m.height * 0.012;
  const r = m.neckR * 2.6 + inflate * m.height;
  b.blob(
    new THREE.Vector3(0, cy, -m.chestHalf * 0.42),
    { x: r * 1.05, y: r * 0.85, z: r * 0.80 },
    Math.max(8, segments), Math.max(6, Math.round(segments * 0.6)),
    [[BI('chest'), 0.55], [BI('neck'), 0.45]],
    null,
    (px, py, pz) => ({ x: px, y: py * (pz < 0 ? 1.15 : 0.7), z: pz * (pz < 0 ? 1.2 : 0.5) })
  );
}

// ---------------------------------------------------------------------------
// Outfit catalogue — three per gender, as specified.
// ---------------------------------------------------------------------------
export const OUTFITS = {
  female: [
    {
      id: 'f_crop_denim', name: 'Crop Tee & Denim Shorts',
      blurb: 'White crop tee, cuffed denim shorts, white sneakers.',
      pieces: [
        { type: 'top', kind: 'crop', fabric: 'cotton', color: 0xf3f1ec, inflate: 0.0070, sleeves: 'short',
          yTop: (m) => m.shoulderY, yBottom: (m) => m.waistY + m.height * 0.030, neckline: 'crew' },
        { type: 'bottom', kind: 'shorts', fabric: 'denim', color: 0x4a5c74, inflate: 0.0072,
          yTop: (m) => m.hipY + m.height * 0.030, legEnd: 0.26, legFlare: 0.22 },
      ],
      shoes: { kind: 'sneaker', color: 0xf2f0ea, accent: 0xdedad2 },
    },
    {
      id: 'f_tank_leggings', name: 'Tank & Leggings',
      blurb: 'Fitted tank, full-length leggings, running shoes.',
      pieces: [
        { type: 'top', kind: 'tank', fabric: 'lycra', color: 0x2c3440, inflate: 0.0062, sleeves: 'none',
          yTop: (m) => m.chestY + m.height * 0.036, yBottom: (m) => m.hipY + m.height * 0.010,
          neckline: 'strap', strapWidth: 0.0075 },
        { type: 'bottom', kind: 'leggings', fabric: 'lycra', color: 0x1d2128, inflate: 0.0064,
          yTop: (m) => m.waistY + m.height * 0.010, legEnd: 0.98 },
      ],
      shoes: { kind: 'runner', color: 0x22262e, accent: 0xd2456a },
    },
    {
      id: 'f_dress', name: 'Summer Dress',
      blurb: 'Sleeveless dress above the knee, flat sandals.',
      pieces: [
        { type: 'top', kind: 'dress', fabric: 'cotton', color: 0xc75f7a, inflate: 0.0070, sleeves: 'none',
          yTop: (m) => m.chestY + m.height * 0.040, yBottom: (m) => m.crotchY - m.height * 0.080,
          neckline: 'strap', strapWidth: 0.0090, flare: 0.30 },
      ],
      shoes: { kind: 'sandal', color: 0x6a4a34, accent: 0x4a3222 },
    },
    {
      id: 'f_hoodie_jeans', name: 'Hoodie & Jeans',
      blurb: 'Oversized hoodie, high-waisted jeans, canvas trainers.',
      pieces: [
        { type: 'top', kind: 'hoodie', fabric: 'knit', color: 0x5b6472, inflate: 0.0128, sleeves: 'long',
          yTop: (m) => m.shoulderY + m.height * 0.004, yBottom: (m) => m.hipY - m.height * 0.010,
          neckline: 'crew', hood: true },
        { type: 'bottom', kind: 'jeans', fabric: 'denim', color: 0x2f3c4e, inflate: 0.0074,
          yTop: (m) => m.waistY + m.height * 0.012, legEnd: 0.97, legFlare: 0.06 },
      ],
      shoes: { kind: 'sneaker', color: 0x1f2329, accent: 0xe4e0d6 },
    },
    {
      id: 'f_blouse_culottes', name: 'Blouse & Culottes',
      blurb: 'Tucked blouse, wide cropped culottes, flat shoes.',
      pieces: [
        { type: 'top', kind: 'tee', fabric: 'cotton', color: 0xeae4d8, inflate: 0.0078, sleeves: 'short',
          yTop: (m) => m.shoulderY, yBottom: (m) => m.waistY - m.height * 0.004, neckline: 'crew' },
        { type: 'bottom', kind: 'skirt', fabric: 'cotton', color: 0x3c3a4a, inflate: 0.0082,
          yTop: (m) => m.waistY + m.height * 0.006, legEnd: 0.42, legFlare: 0.55 },
      ],
      shoes: { kind: 'sandal', color: 0x2b2830, accent: 0x191720 },
    },
    {
      id: 'f_jacket_cargo', name: 'Jacket & Cargos',
      blurb: 'Zipped work jacket, cargo trousers, heavy boots.',
      pieces: [
        { type: 'top', kind: 'hoodie', fabric: 'denim', color: 0x3e4a44, inflate: 0.0132, sleeves: 'long',
          yTop: (m) => m.shoulderY + m.height * 0.004, yBottom: (m) => m.hipY + m.height * 0.004,
          neckline: 'crew' },
        { type: 'bottom', kind: 'joggers', fabric: 'cotton', color: 0x4a4636, inflate: 0.0108,
          yTop: (m) => m.waistY - m.height * 0.002, legEnd: 0.95, legFlare: 0.14 },
      ],
      shoes: { kind: 'boot', color: 0x2a2520, accent: 0x15120f },
    },
  ],
  male: [
    {
      id: 'm_tee_shorts', name: 'Tee & Shorts',
      blurb: 'Plain white tee, dark shorts, white sneakers.',
      pieces: [
        { type: 'top', kind: 'tee', fabric: 'cotton', color: 0xf1efe9, inflate: 0.0092, sleeves: 'short',
          yTop: (m) => m.shoulderY, yBottom: (m) => m.hipY + m.height * 0.016, neckline: 'crew' },
        { type: 'bottom', kind: 'shorts', fabric: 'cotton', color: 0x2a2f36, inflate: 0.0088,
          yTop: (m) => m.waistY - m.height * 0.004, legEnd: 0.36, legFlare: 0.26 },
      ],
      shoes: { kind: 'sneaker', color: 0xefece5, accent: 0xd8d4cb },
    },
    {
      id: 'm_tank_jeans', name: 'Tank & Jeans',
      blurb: 'Ribbed tank, straight-leg jeans, work boots.',
      pieces: [
        { type: 'top', kind: 'tank', fabric: 'knit', color: 0xd8d4c8, inflate: 0.0058, sleeves: 'none',
          yTop: (m) => m.chestY + m.height * 0.038, yBottom: (m) => m.hipY + m.height * 0.004,
          neckline: 'strap', strapWidth: 0.0105 },
        { type: 'bottom', kind: 'jeans', fabric: 'denim', color: 0x39485c, inflate: 0.0082,
          yTop: (m) => m.waistY - m.height * 0.008, legEnd: 0.97, legFlare: 0.10 },
      ],
      shoes: { kind: 'boot', color: 0x51392a, accent: 0x33241a },
    },
    {
      id: 'm_hoodie_joggers', name: 'Hoodie & Joggers',
      blurb: 'Heavy hoodie with the hood down, tapered joggers.',
      pieces: [
        { type: 'top', kind: 'hoodie', fabric: 'knit', color: 0x3c4450, inflate: 0.0135, sleeves: 'long',
          yTop: (m) => m.shoulderY + m.height * 0.004, yBottom: (m) => m.hipY - m.height * 0.004,
          neckline: 'crew', hood: true },
        { type: 'bottom', kind: 'joggers', fabric: 'knit', color: 0x2b3038, inflate: 0.0105,
          yTop: (m) => m.waistY, legEnd: 0.93, legFlare: -0.05 },
      ],
      shoes: { kind: 'sneaker', color: 0x2c2f35, accent: 0xb8b2a6 },
    },
    {
      id: 'm_shirt_chinos', name: 'Shirt & Chinos',
      blurb: 'Open button-down over a tee, chinos, leather shoes.',
      pieces: [
        { type: 'top', kind: 'hoodie', fabric: 'cotton', color: 0x58697d, inflate: 0.0120, sleeves: 'long',
          yTop: (m) => m.shoulderY + m.height * 0.002, yBottom: (m) => m.hipY + m.height * 0.010,
          neckline: 'crew' },
        { type: 'bottom', kind: 'jeans', fabric: 'cotton', color: 0x8a7f6a, inflate: 0.0086,
          yTop: (m) => m.waistY - m.height * 0.006, legEnd: 0.96, legFlare: 0.08 },
      ],
      shoes: { kind: 'boot', color: 0x3a2b21, accent: 0x241a14 },
    },
    {
      id: 'm_track', name: 'Track Suit',
      blurb: 'Zip-up track top and matching bottoms, running shoes.',
      pieces: [
        { type: 'top', kind: 'hoodie', fabric: 'lycra', color: 0x223347, inflate: 0.0108, sleeves: 'long',
          yTop: (m) => m.shoulderY + m.height * 0.003, yBottom: (m) => m.hipY, neckline: 'crew' },
        { type: 'bottom', kind: 'joggers', fabric: 'lycra', color: 0x1b2634, inflate: 0.0092,
          yTop: (m) => m.waistY, legEnd: 0.96, legFlare: -0.04 },
      ],
      shoes: { kind: 'runner', color: 0x20242b, accent: 0x3fb37a },
    },
    {
      id: 'm_vest_cargo', name: 'Vest & Cargos',
      blurb: 'Work vest over bare arms, cargo trousers, heavy boots.',
      pieces: [
        { type: 'top', kind: 'tank', fabric: 'knit', color: 0x6e6a5c, inflate: 0.0062, sleeves: 'none',
          yTop: (m) => m.chestY + m.height * 0.040, yBottom: (m) => m.hipY + m.height * 0.006,
          neckline: 'strap', strapWidth: 0.0125 },
        { type: 'bottom', kind: 'joggers', fabric: 'cotton', color: 0x4f4a3a, inflate: 0.0110,
          yTop: (m) => m.waistY - m.height * 0.002, legEnd: 0.95, legFlare: 0.15 },
      ],
      shoes: { kind: 'boot', color: 0x2e2620, accent: 0x191411 },
    },
  ],
};

/** Always-present base layer so a character is never bare. */
export const BASE_LAYER = {
  female: [
    { type: 'bottom', kind: 'briefs', fabric: 'lycra', color: 0x2a2d33, inflate: 0.0030,
      yTop: (m) => m.hipY + m.height * 0.018, legEnd: 0.11 },
    { type: 'top', kind: 'bra', fabric: 'lycra', color: 0x2a2d33, inflate: 0.0030,
      yTop: (m) => m.chestY + m.height * 0.032, yBottom: (m) => m.chestY - m.height * 0.030,
      neckline: 'strap', strapWidth: 0.0050, sleeves: 'none' },
  ],
  male: [
    { type: 'bottom', kind: 'briefs', fabric: 'lycra', color: 0x24272c, inflate: 0.0034,
      yTop: (m) => m.hipY + m.height * 0.016, legEnd: 0.17 },
  ],
};

/**
 * Build one garment layer as a SkinnedMesh geometry + materials.
 * Each piece gets its own material group so a tee and jeans can differ.
 */
export function buildGarment(prop, boneIndex, pieces, opts) {
  opts = opts || {};
  const segments = Math.max(6, opts.segments || settings.preset.humanSegments);
  const BI = (n) => (boneIndex[n] != null ? boneIndex[n] : 0);
  const b = new SkinnedMeshBuilder();
  const materials = [];

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    b.beginGroup(i);
    if (piece.type === 'top') {
      buildTorsoPiece(b, piece, prop, BI, segments);
      buildSleeve(b, piece, prop, BI, segments, 'L');
      buildSleeve(b, piece, prop, BI, segments, 'R');
      if (piece.hood) buildHood(b, prop, BI, segments, piece.inflate);
    } else if (piece.type === 'bottom') {
      buildBottomPiece(b, piece, prop, BI, segments);
    }
    const tex = fabricTexture(piece.fabric, piece.color);
    tex.repeat.set(2.5, 2.5);
    materials.push(new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      roughness: fabricRoughness(piece.fabric),
      metalness: piece.fabric === 'leather' ? 0.06 : 0.0,
      side: THREE.DoubleSide,
    }));
  }

  const geometry = b.build({ smoothNormals: true, weldEpsilon: prop.measure.height * 0.0008 });
  return { geometry, materials };
}

// ---------------------------------------------------------------------------
// Shoes — separate rigid meshes parented to the foot bones.
// ---------------------------------------------------------------------------
export function buildShoe(prop, spec, side) {
  const m = prop.measure, J = prop.joints;
  const ankle = J['foot' + side];
  const len = m.footLen, h = m.footH;
  const kind = spec.kind || 'sneaker';
  const group = new THREE.Group();
  group.name = 'shoe' + side;

  const soleH = kind === 'boot' ? h * 0.42 : kind === 'runner' ? h * 0.46 : h * 0.34;
  const upperH = kind === 'boot' ? h * 1.75 : kind === 'sandal' ? h * 0.30 : h * 1.05;
  const width = len * 0.190;

  const soleMat = new THREE.MeshStandardMaterial({ color: spec.accent, roughness: 0.9, metalness: 0 });
  const upperMat = new THREE.MeshStandardMaterial({
    map: fabricTexture(kind === 'boot' ? 'leather' : kind === 'sandal' ? 'leather' : 'nylon', spec.color),
    roughness: kind === 'boot' ? 0.5 : 0.72, metalness: 0,
  });

  // Sole: a slightly tapered slab following the footprint.
  const sole = new THREE.Mesh(roundedSlab(len * 1.20, soleH, width * 2.05, soleH * 0.45), soleMat);
  sole.position.set(0, -h * 0.62 + soleH * 0.5, len * 0.215);
  sole.rotation.y = 0;
  group.add(sole);

  if (kind !== 'sandal') {
    // Upper: toe box + instep.
    const toeBox = new THREE.Mesh(roundedSlab(len * 0.66, upperH * 0.80, width * 1.90, upperH * 0.40), upperMat);
    toeBox.position.set(0, -h * 0.62 + soleH + upperH * 0.34, len * 0.47);
    group.add(toeBox);

    const instep = new THREE.Mesh(roundedSlab(len * 0.50, upperH * 1.05, width * 1.78, upperH * 0.38), upperMat);
    instep.position.set(0, -h * 0.62 + soleH + upperH * 0.48, len * 0.08);
    group.add(instep);

    const heelH = kind === 'boot' ? upperH * 2.1 : upperH * 1.05;
    const heel = new THREE.Mesh(roundedSlab(len * 0.34, heelH, width * 1.7, upperH * 0.36), upperMat);
    heel.position.set(0, -h * 0.62 + soleH + heelH * 0.5, -len * 0.16);
    group.add(heel);

    if (kind === 'sneaker' || kind === 'runner') {
      // Laces panel.
      const lace = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.9, upperH * 0.12, len * 0.34),
        new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.85 })
      );
      lace.position.set(0, -h * 0.62 + soleH + upperH * 0.96, len * 0.19);
      group.add(lace);
      // Midsole stripe.
      const stripe = new THREE.Mesh(
        roundedSlab(len * 1.16, soleH * 0.4, width * 2.08, soleH * 0.2),
        new THREE.MeshStandardMaterial({ color: spec.accent, roughness: 0.7 })
      );
      stripe.position.set(0, -h * 0.62 + soleH * 0.92, len * 0.215);
      group.add(stripe);
    }
  } else {
    // Sandal straps.
    const strapMat = upperMat;
    for (const [z, w] of [[len * 0.40, width * 1.7], [len * 0.12, width * 1.5]]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.16, len * 0.09), strapMat);
      strap.position.set(0, -h * 0.60 + soleH + h * 0.20, z);
      group.add(strap);
    }
    const heelStrap = new THREE.Mesh(new THREE.BoxGeometry(width * 1.4, h * 0.9, len * 0.07), strapMat);
    heelStrap.position.set(0, -h * 0.60 + soleH + h * 0.45, -len * 0.22);
    group.add(heelStrap);
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // Positioned relative to the foot bone.
  group.userData.footOffset = new THREE.Vector3(0, 0, 0);
  return group;
}

/** Box with rounded edges along X/Z — used for shoe parts and props. */
function roundedSlab(length, height, width, radius) {
  const g = new THREE.BoxGeometry(width, height, length, 2, 1, 3);
  const pos = g.attributes.position;
  const hx = width * 0.5, hz = length * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    // Pinch the corners inward to fake a chamfer.
    const cx = Math.abs(x) / hx, cz = Math.abs(z) / hz;
    if (cx > 0.5 && cz > 0.5) {
      pos.setX(i, x * (1 - (cx - 0.5) * (cz - 0.5) * 0.7));
      pos.setZ(i, z * (1 - (cx - 0.5) * (cz - 0.5) * 0.4));
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Look up an outfit by index or id. */
export function getOutfit(gender, ref) {
  const list = OUTFITS[gender] || OUTFITS.male;
  if (typeof ref === 'number') return list[((ref % list.length) + list.length) % list.length];
  return list.find((o) => o.id === ref) || list[0];
}

export function outfitCount(gender) { return (OUTFITS[gender] || OUTFITS.male).length; }
