// T10 World - geometry helpers: UV-baked primitives and a merger so a whole
// city block collapses into a handful of draw calls.
import * as THREE from '../../vendor/three.module.js';

/**
 * Merge geometries that share an attribute layout into one indexed geometry.
 * Simpler than the three.js addon and tailored to what the world builder emits
 * (position / normal / uv, indexed).
 */
export function mergeGeometries(geometries) {
  if (!geometries.length) return null;
  if (geometries.length === 1) return geometries[0];
  let vertexCount = 0, indexCount = 0;
  for (const g of geometries) {
    vertexCount += g.attributes.position.count;
    indexCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vertexCount * 3);
  const nrm = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const idx = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  let vo = 0, io = 0;
  for (const g of geometries) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    pos.set(p.array.subarray(0, p.count * 3), vo * 3);
    if (n) nrm.set(n.array.subarray(0, n.count * 3), vo * 3);
    if (u) uv.set(u.array.subarray(0, u.count * 2), vo * 2);
    if (g.index) {
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      io += gi.length;
    } else {
      for (let i = 0; i < p.count; i++) idx[io + i] = i + vo;
      io += p.count;
    }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/** Box with UVs scaled to world units so the texture tiles consistently. */
export function boxUV(w, h, d, tileW, tileH) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z (4 verts each).
  const spans = [
    [d, h], [d, h],
    [w, d], [w, d],
    [w, h], [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const su = spans[f][0] / tileW;
    const sv = spans[f][1] / (f === 2 || f === 3 ? tileW : tileH);
    for (let i = 0; i < 4; i++) {
      const vi = f * 4 + i;
      uv.setXY(vi, uv.getX(vi) * su, uv.getY(vi) * sv);
    }
  }
  uv.needsUpdate = true;
  return g;
}

/** Plane laid flat on the ground with world-scaled UVs. */
export function groundPlane(w, d, tile, segments) {
  const g = new THREE.PlaneGeometry(w, d, segments || 1, segments || 1);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile), uv.getY(i) * (d / tile));
  uv.needsUpdate = true;
  return g;
}

/** A flat quad between two points with a given width — roads, paths, stripes. */
export function ribbon(ax, az, bx, bz, width, y, tileLen, tileW) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  const px = -uz * width * 0.5, pz = ux * width * 0.5;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array([
    ax + px, y, az + pz,
    ax - px, y, az - pz,
    bx - px, y, bz - pz,
    bx + px, y, bz + pz,
  ]);
  const nrm = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const vlen = len / (tileLen || 12);
  const uwid = width / (tileW || width);
  const uv = new Float32Array([0, 0, uwid, 0, uwid, vlen, 0, vlen]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  return g;
}

/** Extruded prism used for pitched roofs, awnings and ramps. */
export function prism(w, h, d, tileW, tileH) {
  const hw = w / 2, hd = d / 2;
  const verts = [
    // front triangle
    -hw, 0, hd, hw, 0, hd, 0, h, hd,
    // back triangle
    -hw, 0, -hd, 0, h, -hd, hw, 0, -hd,
    // left slope
    -hw, 0, hd, 0, h, hd, 0, h, -hd, -hw, 0, -hd,
    // right slope
    hw, 0, hd, hw, 0, -hd, 0, h, -hd, 0, h, hd,
    // bottom
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
  ];
  const slope = Math.hypot(w / 2, h);
  const uvs = [
    0, 0, w / tileW, 0, w / tileW * 0.5, h / tileH,
    0, 0, w / tileW * 0.5, h / tileH, w / tileW, 0,
    0, 0, slope / tileW, 0, slope / tileW, d / tileH, 0, d / tileH,
    0, 0, 0, d / tileH, slope / tileW, d / tileH, slope / tileW, 0,
    0, 0, w / tileW, 0, w / tileW, d / tileH, 0, d / tileH,
  ];
  const idx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 6, 8, 9, 10, 11, 12, 10, 12, 13, 14, 15, 16, 14, 16, 17];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Cylinder with world-scaled UVs — poles, trunks, tanks. */
export function cylinderUV(rTop, rBottom, h, segments, tileW, tileH) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments || 10, 1, false);
  const uv = g.attributes.uv;
  const circ = Math.PI * (rTop + rBottom);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (circ / (tileW || 1)), uv.getY(i) * (h / (tileH || 1)));
  uv.needsUpdate = true;
  return g;
}

export function transformed(geometry, x, y, z, rotY, scale) {
  const g = geometry.clone();
  if (scale) g.scale(scale.x || 1, scale.y || 1, scale.z || 1);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

/** Collect geometry per material and emit merged meshes. */
export class GeometryBatcher {
  constructor() { this.groups = new Map(); }
  add(material, geometry) {
    let list = this.groups.get(material);
    if (!list) { list = []; this.groups.set(material, list); }
    list.push(geometry);
  }
  build(parent, opts) {
    opts = opts || {};
    const meshes = [];
    for (const [mat, list] of this.groups) {
      const merged = mergeGeometries(list);
      if (!merged) continue;
      for (const g of list) if (g !== merged) g.dispose();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = opts.castShadow !== false;
      mesh.receiveShadow = opts.receiveShadow !== false;
      if (opts.name) mesh.name = opts.name;
      if (parent) parent.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }
}

export function disposeGroup(group) {
  group.traverse((o) => {
    if (o.isMesh || o.isInstancedMesh) {
      if (o.geometry) o.geometry.dispose();
      // Materials are shared across the world and cached — never disposed here.
    }
  });
  if (group.parent) group.parent.remove(group);
  group.clear();
}
