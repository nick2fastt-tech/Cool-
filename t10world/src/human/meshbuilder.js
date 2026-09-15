// T10 World - skinned mesh accumulator.
// Collects positions/uvs/skin weights from many parametric parts into one
// BufferGeometry with material groups, so a whole human is a single draw call.
import * as THREE from '../../vendor/three.module.js';
import { TAU, clamp01 } from '../core/math.js';

export class SkinnedMeshBuilder {
  constructor() {
    this.pos = [];
    this.uv = [];
    this.skinIndex = [];
    this.skinWeight = [];
    this.index = [];
    this.groups = [];      // { start, count, materialIndex }
    this._groupStart = 0;
    this._groupMaterial = 0;
  }

  get vertexCount() { return this.pos.length / 3; }

  beginGroup(materialIndex) {
    this.flushGroup();
    this._groupStart = this.index.length;
    this._groupMaterial = materialIndex;
  }

  flushGroup() {
    const count = this.index.length - this._groupStart;
    if (count > 0) this.groups.push({ start: this._groupStart, count, materialIndex: this._groupMaterial });
    this._groupStart = this.index.length;
  }

  /**
   * weights: array of up to 4 [boneIndex, weight] pairs. Normalized here so
   * callers can pass rough numbers.
   */
  vertex(x, y, z, u, v, weights) {
    this.pos.push(x, y, z);
    this.uv.push(u, v);
    let i0 = 0, i1 = 0, i2 = 0, i3 = 0;
    let w0 = 0, w1 = 0, w2 = 0, w3 = 0;
    if (weights && weights.length) {
      let total = 0;
      for (let i = 0; i < weights.length && i < 4; i++) total += weights[i][1];
      if (total <= 0) total = 1;
      if (weights[0]) { i0 = weights[0][0]; w0 = weights[0][1] / total; }
      if (weights[1]) { i1 = weights[1][0]; w1 = weights[1][1] / total; }
      if (weights[2]) { i2 = weights[2][0]; w2 = weights[2][1] / total; }
      if (weights[3]) { i3 = weights[3][0]; w3 = weights[3][1] / total; }
    } else {
      w0 = 1;
    }
    this.skinIndex.push(i0, i1, i2, i3);
    this.skinWeight.push(w0, w1, w2, w3);
    return this.vertexCount - 1;
  }

  tri(a, b, c) { this.index.push(a, b, c); }
  quad(a, b, c, d) { this.index.push(a, b, c, a, c, d); }

  /**
   * Loft a tube through a list of cross-sections.
   * Each section: { center: Vec3, shape(theta) -> {x, z} offsets, weights, v }
   * `closeStart`/`closeEnd` cap the tube with a fan.
   */
  tube(sections, segments, opts) {
    opts = opts || {};
    const uScale = opts.uScale != null ? opts.uScale : 1;
    const uOffset = opts.uOffset != null ? opts.uOffset : 0;
    const rings = [];
    for (let s = 0; s < sections.length; s++) {
      const sec = sections[s];
      const ring = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const theta = t * TAU;
        const off = sec.shape(theta, sec);
        const x = sec.center.x + off.x;
        const y = sec.center.y + (off.y || 0);
        const z = sec.center.z + off.z;
        ring.push(this.vertex(x, y, z, uOffset + t * uScale, sec.v, sec.weights));
      }
      rings.push(ring);
    }
    for (let s = 0; s < rings.length - 1; s++) {
      const a = rings[s], b = rings[s + 1];
      for (let i = 0; i < segments; i++) {
        this.quad(a[i], a[i + 1], b[i + 1], b[i]);
      }
    }
    if (opts.capStart) this.capRing(sections[0], rings[0], segments, -1);
    if (opts.capEnd) this.capRing(sections[sections.length - 1], rings[rings.length - 1], segments, 1);
    return rings;
  }

  capRing(sec, ring, segments, dir) {
    const c = this.vertex(sec.center.x, sec.center.y, sec.center.z, 0.5, sec.v, sec.weights);
    for (let i = 0; i < segments; i++) {
      if (dir > 0) this.tri(ring[i], ring[i + 1], c);
      else this.tri(ring[i + 1], ring[i], c);
    }
  }

  /** Ellipsoid blob — ears, breasts, muscle bulges, animal parts. */
  blob(center, radii, segments, rings, weights, uvRect, deform) {
    const idx = [];
    for (let r = 0; r <= rings; r++) {
      const phi = (r / rings) * Math.PI;
      const row = [];
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * TAU;
        let x = Math.sin(phi) * Math.sin(theta);
        let y = Math.cos(phi);
        let z = Math.sin(phi) * Math.cos(theta);
        let px = x * radii.x, py = y * radii.y, pz = z * radii.z;
        if (deform) {
          const d = deform(px, py, pz, theta, phi);
          px = d.x; py = d.y; pz = d.z;
        }
        const u = uvRect ? uvRect[0] + (s / segments) * uvRect[2] : s / segments;
        const v = uvRect ? uvRect[1] + (1 - r / rings) * uvRect[3] : 1 - r / rings;
        row.push(this.vertex(center.x + px, center.y + py, center.z + pz, u, v, weights));
      }
      idx.push(row);
    }
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segments; s++) {
        // Wound so the face normal points away from the centre.
        this.quad(idx[r][s], idx[r + 1][s], idx[r + 1][s + 1], idx[r][s + 1]);
      }
    }
    return idx;
  }

  /** Rounded box — palms, shoe soles, props. */
  roundedBox(center, size, radius, weights, uvRect, segments) {
    segments = segments || 3;
    const hx = size.x * 0.5 - radius, hy = size.y * 0.5 - radius, hz = size.z * 0.5 - radius;
    const rings = segments * 2;
    const segs = segments * 4;
    const idx = [];
    for (let r = 0; r <= rings; r++) {
      const phi = (r / rings) * Math.PI;
      const row = [];
      for (let s = 0; s <= segs; s++) {
        const theta = (s / segs) * TAU;
        const sx = Math.sin(phi) * Math.sin(theta);
        const sy = Math.cos(phi);
        const sz = Math.sin(phi) * Math.cos(theta);
        const px = Math.sign(sx) * Math.min(Math.abs(sx) * (hx + radius), hx) + sx * radius * 0.999;
        const py = Math.sign(sy) * Math.min(Math.abs(sy) * (hy + radius), hy) + sy * radius * 0.999;
        const pz = Math.sign(sz) * Math.min(Math.abs(sz) * (hz + radius), hz) + sz * radius * 0.999;
        const u = uvRect ? uvRect[0] + (s / segs) * uvRect[2] : s / segs;
        const v = uvRect ? uvRect[1] + (1 - r / rings) * uvRect[3] : 1 - r / rings;
        row.push(this.vertex(center.x + px, center.y + py, center.z + pz, u, v, weights));
      }
      idx.push(row);
    }
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) this.quad(idx[r][s], idx[r + 1][s], idx[r + 1][s + 1], idx[r][s + 1]);
    }
    return idx;
  }

  build(opts) {
    opts = opts || {};
    this.flushGroup();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.skinWeight, 4));
    g.setIndex(this.index);
    for (const grp of this.groups) g.addGroup(grp.start, grp.count, grp.materialIndex);
    g.computeVertexNormals();
    if (opts.smoothNormals) smoothWeldedNormals(g, opts.weldEpsilon || 0.0015);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/**
 * Average normals across coincident vertices so lofted seams (where a tube
 * wraps around, or two parts meet) don't show as hard creases on skin.
 */
export function smoothWeldedNormals(geometry, eps) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const count = pos.count;
  const map = new Map();
  const inv = 1 / eps;
  for (let i = 0; i < count; i++) {
    const key = Math.round(pos.getX(i) * inv) + '_' + Math.round(pos.getY(i) * inv) + '_' + Math.round(pos.getZ(i) * inv);
    let list = map.get(key);
    if (!list) { list = []; map.set(key, list); }
    list.push(i);
  }
  for (const list of map.values()) {
    if (list.length < 2) continue;
    let nx = 0, ny = 0, nz = 0;
    for (const i of list) { nx += nrm.getX(i); ny += nrm.getY(i); nz += nrm.getZ(i); }
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const i of list) nrm.setXYZ(i, nx, ny, nz);
  }
  nrm.needsUpdate = true;
}

/** Circular cross-section with optional elliptical radii. */
export function circleShape(rx, rz) {
  return (theta) => ({ x: Math.sin(theta) * rx, z: Math.cos(theta) * rz });
}

/**
 * Torso cross-section: an ellipse modulated by belly, glute, bust and back
 * shaping so the body reads as a person rather than a stack of cylinders.
 */
export function torsoShape(opts) {
  const rx = opts.rx, rz = opts.rz;
  const belly = opts.belly || 0;
  const glute = opts.glute || 0;
  const bust = opts.bust || 0;
  const bustSep = opts.bustSep != null ? opts.bustSep : 0.42;
  const flatten = opts.flatten || 0;
  const lat = opts.lat || 0;
  // Drops the sides of a ring below its centre — used to slope the trapezius
  // from the neck down to the shoulder instead of leaving a flat shelf.
  const drop = opts.shoulderDrop || 0;
  return (theta) => {
    const s = Math.sin(theta), c = Math.cos(theta);
    let x = s * rx, z = c * rz;
    const y = drop ? -drop * Math.pow(Math.abs(s), 1.25) : 0;
    // Front (c>0) belly bulge.
    if (belly !== 0 && c > 0) z += belly * Math.pow(c, 1.6) * rz;
    // Back (c<0) glute / spine shaping.
    if (glute !== 0 && c < 0) z -= glute * Math.pow(-c, 1.5) * rz;
    // Two bust lobes either side of centre-front.
    if (bust > 0) {
      const d1 = theta - bustSep, d2 = theta - (TAU - bustSep);
      const lobe = Math.exp(-(d1 * d1) * 7) + Math.exp(-(d2 * d2) * 7);
      z += bust * lobe * rz * 0.85;
      x += bust * lobe * Math.sign(s) * rx * 0.12;
    }
    // Slight lateral flattening at the sides (ribs aren't round).
    if (flatten > 0) x *= 1 - flatten * Math.pow(Math.abs(s), 2) * 0.28;
    // Lat spread at the upper back.
    if (lat > 0 && c < 0) x *= 1 + lat * Math.abs(s) * 0.22;
    return { x, y, z };
  };
}

/** Tapered limb profile with a subtle muscle belly bulge. */
export function limbShape(r, bulge, flat) {
  return (theta) => {
    const s = Math.sin(theta), c = Math.cos(theta);
    const rr = r * (1 + (bulge || 0) * Math.max(0, -c) * 0.35);
    return { x: s * rr * (1 - (flat || 0) * 0.15), z: c * rr };
  };
}
