// T10 World - procedural hair. Three styles (short / medium / long) plus a
// shaved option, each fitted to the individual skull shape.
import * as THREE from '../../vendor/three.module.js';
import { clamp01, clampv, lerpv, smooth01, TAU, makeRng } from '../core/math.js';
import { hairTexture, hairAlphaTexture } from './textures.js';
import { settings } from '../core/settings.js';

export const HAIR_STYLES = [
  { id: 'short',  name: 'Short',  blurb: 'Cropped and clean.' },
  { id: 'medium', name: 'Medium', blurb: 'Swept, with volume.' },
  { id: 'long',   name: 'Long',   blurb: 'Falls past the shoulders.' },
  { id: 'shaved', name: 'Shaved', blurb: 'Down to the skin.' },
];

/**
 * Hairline height as a fraction of head span, per azimuth.
 * theta: 0 = front of the face, ±PI = back of the skull.
 */
function hairlineV(theta, style, rng, recede) {
  const a = Math.abs(theta);
  const front = Math.max(0, Math.cos(theta));
  // Front hairline sits above the brow; sides and back drop much lower.
  let v = 0.775 + recede * 0.085;
  if (a > 1.0) v = lerpv(0.775 + recede * 0.085, style === 'shaved' ? 0.48 : 0.44, clamp01((a - 1.0) / (Math.PI - 1.0)));
  // Temple recession — a widow's peak in the centre, higher at the corners.
  const temple = Math.exp(-Math.pow((a - 0.62) / 0.30, 2));
  v += temple * (0.038 + recede * 0.095) * front;
  const peak = Math.exp(-Math.pow(theta / 0.18, 2));
  v -= peak * 0.026 * front;
  // Sideburns in front of the ears.
  const burn = Math.exp(-Math.pow((a - 1.30) / 0.22, 2));
  v -= burn * (style === 'shaved' ? 0.018 : 0.050);
  return v;
}

/**
 * Outward thickness of the hair shell.
 * `t` runs 0 at the hairline to 1 at the crown; tapering it to near zero at the
 * hairline is what stops the cap reading as a helmet with a brim.
 */
function hairThickness(theta, v, style, t) {
  const back = Math.max(0, -Math.cos(theta));
  const front = Math.max(0, Math.cos(theta));
  const top = clamp01((v - 0.78) / 0.22);
  const rootTaper = 0.10 + 0.90 * smooth01(clamp01(t / 0.30));
  let base;
  if (style === 'shaved') base = 0.008;
  else if (style === 'short') base = 0.040 + top * 0.042 + back * 0.014;
  else if (style === 'medium') base = 0.060 + top * 0.090 + front * 0.030 * (1 - top) + back * 0.042;
  else base = 0.066 + top * 0.100 + back * 0.058;   // long
  return base * rootTaper;
}

/**
 * Build the hair cap: a shell over the skull clipped at the hairline.
 * Coordinates are relative to the head bone so the mesh can simply be parented.
 */
function buildCap(head, style, seed, recede) {
  const rings = settings.preset.humanSegments >= 12 ? 20 : 13;
  const segs = settings.preset.humanSegments >= 12 ? 28 : 18;
  const rng = makeRng(seed);
  const Rx = head.radii.x, Ry = head.radii.y, Rz = head.radii.z;
  const pos = [], uv = [], idx = [];
  const grid = [];
  let count = 0;

  for (let r = 0; r <= rings; r++) {
    const row = [];
    for (let s = 0; s <= segs; s++) {
      const theta = (s / segs) * TAU - Math.PI;
      const hl = hairlineV(theta, style, rng, recede);
      // Remap the ring index so r=0 sits exactly on the hairline and r=rings at the crown.
      const v = lerpv(hl, 1.0, r / rings);
      // Invert the head's own v->phi relation: v maps to y, y maps to phi.
      const y = (v * 2 - 1) * Ry;
      const sinPhi = Math.sqrt(Math.max(0, 1 - (y / Ry) * (y / Ry)));
      const th = hairThickness(theta, v, style, r / rings) * head.span;
      const x = Math.sin(theta) * sinPhi * (Rx + th);
      const z = Math.cos(theta) * sinPhi * (Rz + th);
      // Slight random clumping so the silhouette isn't a perfect dome.
      const jitter = style === 'shaved' ? 0 : (rng() - 0.5) * head.span * 0.012;
      pos.push(x + jitter * 0.5, y + th * 0.55 + jitter, z + head.z + jitter * 0.5);
      uv.push(s / segs * 3, v * 2.2);
      row.push(count++);
    }
    grid.push(row);
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = grid[r][s], b2 = grid[r][s + 1], c = grid[r + 1][s + 1], d = grid[r + 1][s];
      idx.push(a, b2, c, a, c, d);
    }
  }
  return { pos, uv, idx, count };
}

/** Falling hair: quads that hang from the hairline down the back and sides. */
function buildFall(head, style, seed, out) {
  if (style === 'short' || style === 'shaved') return;
  const rng = makeRng(seed + 7717);
  const Rx = head.radii.x, Ry = head.radii.y, Rz = head.radii.z;
  const strands = style === 'long' ? (settings.preset.humanSegments >= 12 ? 46 : 26) : (settings.preset.humanSegments >= 12 ? 26 : 15);
  const maxLen = style === 'long' ? head.span * 3.0 : head.span * 0.95;

  for (let i = 0; i < strands; i++) {
    // Distribute around the back half of the head.
    const t = i / (strands - 1);
    const theta = lerpv(-Math.PI, Math.PI, t);
    const backness = Math.max(0, -Math.cos(theta));
    if (backness < 0.12 && style === 'long') continue;
    if (style === 'medium' && Math.abs(theta) < 1.05) continue;

    const hl = hairlineV(theta, style, rng, 0);
    const y0 = (hl * 2 - 1) * Ry;
    const sinPhi = Math.sqrt(Math.max(0, 1 - (y0 / Ry) * (y0 / Ry)));
    const th = hairThickness(theta, hl, style, 0) * head.span;
    const ox = Math.sin(theta) * sinPhi * (Rx + th);
    const oz = Math.cos(theta) * sinPhi * (Rz + th) + head.z;

    const len = maxLen * (0.62 + rng() * 0.38) * (0.55 + backness * 0.45);
    const width = head.span * (style === 'long' ? 0.11 : 0.09) * (0.7 + rng() * 0.6);
    const segs = 6;
    const base = out.count;
    // Two columns of vertices swept downward with a slight outward curl.
    const tangentX = Math.cos(theta), tangentZ = -Math.sin(theta);
    for (let s = 0; s <= segs; s++) {
      const f = s / segs;
      const drop = len * f;
      const curl = Math.sin(f * Math.PI * 0.8) * head.span * 0.10 * (style === 'long' ? 1 : 0.55);
      const taper = 1 - f * 0.45;
      const cx = ox * (1 + f * 0.12) + Math.sin(theta) * curl;
      const cz = oz + Math.cos(theta) * curl * 0.7;
      const cy = y0 - drop + Math.sin(f * Math.PI) * head.span * 0.04;
      for (const side of [-1, 1]) {
        out.pos.push(cx + tangentX * width * taper * side, cy, cz + tangentZ * width * taper * side);
        out.uv.push(side > 0 ? 1 : 0, f * 2.5);
        out.count++;
      }
    }
    for (let s = 0; s < segs; s++) {
      const a = base + s * 2, b2 = a + 1, c = a + 3, d = a + 2;
      out.idx.push(a, b2, c, a, c, d);
      out.idx.push(a, c, b2, a, d, c);   // double-sided
    }
  }
}

/** Fringe / swept bangs across the forehead for the medium style. */
function buildFringe(head, style, seed, out) {
  if (style !== 'medium' && style !== 'long') return;
  const rng = makeRng(seed + 99991);
  const Rx = head.radii.x, Ry = head.radii.y, Rz = head.radii.z;
  const strands = settings.preset.humanSegments >= 12 ? 16 : 9;
  const sweep = rng() < 0.5 ? 1 : -1;
  for (let i = 0; i < strands; i++) {
    const t = i / (strands - 1);
    const theta = lerpv(-0.95, 0.95, t);
    const hl = hairlineV(theta, style, rng, 0);
    const y0 = (hl * 2 - 1) * Ry;
    const sinPhi = Math.sqrt(Math.max(0, 1 - (y0 / Ry) * (y0 / Ry)));
    const th = hairThickness(theta, hl, style, 0) * head.span;
    const ox = Math.sin(theta) * sinPhi * (Rx + th * 0.8);
    const oz = Math.cos(theta) * sinPhi * (Rz + th * 0.8) + head.z;
    const len = head.span * (style === 'long' ? 0.42 : 0.34) * (0.6 + rng() * 0.55);
    const width = head.span * 0.075 * (0.7 + rng() * 0.5);
    const segs = 4;
    const base = out.count;
    for (let s = 0; s <= segs; s++) {
      const f = s / segs;
      const cx = ox + sweep * f * head.span * 0.13;
      const cy = y0 - len * f + head.span * 0.02;
      const cz = oz + Math.sin(f * Math.PI * 0.5) * head.span * 0.03;
      for (const side of [-1, 1]) {
        out.pos.push(cx + side * width * (1 - f * 0.4), cy, cz + side * width * 0.2);
        out.uv.push(side > 0 ? 1 : 0, f * 2);
        out.count++;
      }
    }
    for (let s = 0; s < segs; s++) {
      const a = base + s * 2, b2 = a + 1, c = a + 3, d = a + 2;
      out.idx.push(a, b2, c, a, c, d);
      out.idx.push(a, c, b2, a, d, c);
    }
  }
}

/**
 * @param head { radii:{x,y,z}, span, z, boneWorldY } geometry info from buildBodyGeometry
 * @returns THREE.Mesh in head-bone local space, or null for bald
 */
export function buildHair(head, style, colorHex, seed, recede) {
  if (style === 'bald' || style === 'none') return null;
  const cap = buildCap(head, style, seed, recede || 0);
  const out = { pos: cap.pos, uv: cap.uv, idx: cap.idx, count: cap.count };
  buildFall(head, style, seed, out);
  buildFringe(head, style, seed, out);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setIndex(out.idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  // Shift into head-bone local space.
  g.translate(0, -head.boneLocalY, 0);

  const mat = new THREE.MeshStandardMaterial({
    map: hairTexture(colorHex, style),
    color: 0xffffff,
    roughness: 0.66,
    metalness: 0.0,
    side: THREE.DoubleSide,
    transparent: style === 'long' || style === 'medium',
    alphaTest: (style === 'long' || style === 'medium') ? 0.42 : 0,
    alphaMap: (style === 'long' || style === 'medium') ? hairAlphaTexture() : null,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'hair';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.hairStyle = style;
  return mesh;
}

/** Facial hair: a short shell over the jaw and upper lip. */
export function buildBeard(head, colorHex, amount, seed) {
  if (amount < 0.25) return null;
  const rings = 9, segs = 18;
  const Rx = head.radii.x, Ry = head.radii.y, Rz = head.radii.z;
  const pos = [], uv = [], idx = [];
  const grid = [];
  let count = 0;
  const full = clamp01((amount - 0.25) / 0.75);
  for (let r = 0; r <= rings; r++) {
    const row = [];
    const v = lerpv(0.10, 0.45 + full * 0.09, r / rings);
    for (let s = 0; s <= segs; s++) {
      const theta = lerpv(-1.45, 1.45, s / segs);
      const y = (v * 2 - 1) * Ry;
      const sinPhi = Math.sqrt(Math.max(0, 1 - (y / Ry) * (y / Ry)));
      const th = head.span * 0.016 * full;
      // Taper toward the top of the cheeks.
      const fade = clamp01(1 - Math.max(0, (v - 0.35) / 0.16));
      const jawTaper = 1 - Math.pow(clamp01((0.50 - v) / 0.50), 1.30) * 0.30;
      pos.push(
        Math.sin(theta) * sinPhi * (Rx * jawTaper + th * fade),
        y,
        Math.cos(theta) * sinPhi * (Rz * jawTaper + th * fade) + head.z
      );
      uv.push(s / segs * 2, v * 3);
      row.push(count++);
    }
    grid.push(row);
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = grid[r][s], b2 = grid[r][s + 1], c = grid[r + 1][s + 1], d = grid[r + 1][s];
      idx.push(a, b2, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.translate(0, -head.boneLocalY, 0);
  const mat = new THREE.MeshStandardMaterial({
    map: hairTexture(colorHex, 'beard'),
    roughness: 0.78, metalness: 0, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'beard';
  mesh.castShadow = true;
  return mesh;
}

/** Eyebrow ridges add depth the painted texture alone can't give at close range. */
export function buildBrows(head, colorHex, thickness) {
  const pos = [], uv = [], idx = [];
  let count = 0;
  const Rx = head.radii.x, Ry = head.radii.y, Rz = head.radii.z;
  const v = 0.648;
  for (const side of [-1, 1]) {
    const base = count;
    const segs = 7;
    for (let s = 0; s <= segs; s++) {
      const f = s / segs;
      const theta = side * lerpv(0.16, 0.74, f);
      const vy = v + Math.sin(f * Math.PI) * 0.013;
      const y = (vy * 2 - 1) * Ry;
      const sinPhi = Math.sqrt(Math.max(0, 1 - (y / Ry) * (y / Ry)));
      const th = head.span * 0.0035 * thickness;
      const taper = Math.sin(f * Math.PI) * 0.7 + 0.35;
      for (const h of [-1, 1]) {
        const yy = y + h * head.span * 0.0062 * thickness * taper;
        const sp = Math.sqrt(Math.max(0, 1 - (yy / Ry) * (yy / Ry)));
        pos.push(
          Math.sin(theta) * sp * (Rx + th),
          yy,
          Math.cos(theta) * sp * (Rz + th) + head.z
        );
        uv.push(f * 2, h > 0 ? 1 : 0);
        count++;
      }
    }
    for (let s = 0; s < segs; s++) {
      const a = base + s * 2, b2 = a + 1, c = a + 3, d = a + 2;
      idx.push(a, b2, c, a, c, d);
      idx.push(a, c, b2, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.translate(0, -head.boneLocalY, 0);
  const mat = new THREE.MeshStandardMaterial({
    map: hairTexture(colorHex, 'brow'),
    roughness: 0.75, metalness: 0, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'brows';
  return mesh;
}
