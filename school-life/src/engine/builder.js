// Static geometry batcher. Everything that never moves is appended into one big
// buffer per (zone, material) so the whole school renders in very few draw calls.
import * as THREE from 'three';
import { Physics } from './physics.js';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m3 = new THREE.Matrix3();

class Batch {
  constructor(mat, zone, cast, receive) {
    this.mat = mat;
    this.zone = zone;
    this.cast = cast;
    this.receive = receive;
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
    this.count = 0;
  }
}

/** Box geometry whose UVs are in meters (so tiling textures keep their real-world size). */
export function boxGeo(sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.attributes.uv;
  const n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    let w, h;
    if (ax > 0.5) { w = sz; h = sy; } else if (ay > 0.5) { w = sx; h = sz; } else { w = sx; h = sy; }
    uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  }
  return g;
}

export function cylGeo(rt, rb, h, seg = 12, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = g.attributes.uv;
  const circ = Math.PI * (rt + rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
  return g;
}

export class Builder {
  constructor() {
    this.batches = new Map();
    this.physics = new Physics();
    this.zones = new Map();
    this.meshes = [];
    this.stats = { tris: 0, batches: 0 };
  }

  zoneGroup(name) {
    let g = this.zones.get(name);
    if (!g) {
      g = new THREE.Group();
      g.name = 'zone:' + name;
      this.zones.set(name, g);
    }
    return g;
  }

  batch(mat, zone = 'global', cast = true, receive = true) {
    const key = zone + '|' + mat.uuid + '|' + (cast ? 1 : 0) + (receive ? 1 : 0);
    let b = this.batches.get(key);
    if (!b) {
      b = new Batch(mat, zone, cast, receive);
      this.batches.set(key, b);
    }
    return b;
  }

  /**
   * Axis-aligned box from min/max corners. World-space UVs (meters) so textures line up
   * across neighbouring boxes. o: { zone, cast, receive, collide, faces, color, uvOffset }
   */
  box(mat, x0, y0, z0, x1, y1, z1, o = {}) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    const b = this.batch(mat, o.zone, o.cast !== false, o.receive !== false);
    const f = o.faces || null;
    const col = o.color || null;
    const uo = o.uvOffset || 0;
    const face = (name, nx, ny, nz, corners, uvs) => {
      if (f && f[name] === false) return;
      const base = b.count;
      for (let i = 0; i < 4; i++) {
        b.pos.push(corners[i][0], corners[i][1], corners[i][2]);
        b.nor.push(nx, ny, nz);
        b.uv.push(uvs[i][0] + uo, uvs[i][1]);
        if (col) b.col.push(col.r, col.g, col.b);
      }
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      b.count += 4;
    };
    // +X
    face('px', 1, 0, 0, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[-z1, y0], [-z0, y0], [-z0, y1], [-z1, y1]]);
    // -X
    face('nx', -1, 0, 0, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]]);
    // +Y
    face('py', 0, 1, 0, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [[x0, -z1], [x1, -z1], [x1, -z0], [x0, -z0]]);
    // -Y
    face('ny', 0, -1, 0, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
    // +Z
    face('pz', 0, 0, 1, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
    // -Z
    face('nz', 0, 0, -1, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [[-x1, y0], [-x0, y0], [-x0, y1], [-x1, y1]]);

    if (o.collide) this.physics.addCollider(x0, z0, x1, z1, y0, y1, o.tag || null);
  }

  /** Append any BufferGeometry transformed by `matrix` (uses the geometry's own UVs). */
  geom(mat, geometry, matrix, o = {}) {
    const g = geometry.index ? geometry : geometry;
    const b = this.batch(mat, o.zone, o.cast !== false, o.receive !== false);
    const P = g.attributes.position;
    const N = g.attributes.normal;
    const U = g.attributes.uv;
    const C = g.attributes.color;
    _m3.getNormalMatrix(matrix);
    const base = b.count;
    const col = o.color || null;
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(matrix);
      b.pos.push(_v.x, _v.y, _v.z);
      if (N) {
        _n.fromBufferAttribute(N, i).applyMatrix3(_m3).normalize();
        b.nor.push(_n.x, _n.y, _n.z);
      } else b.nor.push(0, 1, 0);
      if (U) b.uv.push(U.getX(i) * (o.uvScale || 1), U.getY(i) * (o.uvScale || 1));
      else b.uv.push(0, 0);
      if (col) b.col.push(col.r, col.g, col.b);
      else if (C) b.col.push(C.getX(i), C.getY(i), C.getZ(i));
    }
    if (g.index) {
      const I = g.index;
      for (let i = 0; i < I.count; i++) b.idx.push(base + I.getX(i));
    } else {
      for (let i = 0; i < P.count; i++) b.idx.push(base + i);
    }
    b.count += P.count;
    if (o.collide) {
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox.clone().applyMatrix4(matrix);
      this.physics.addCollider(bb.min.x, bb.min.z, bb.max.x, bb.max.z, bb.min.y, bb.max.y, o.tag || null);
    }
  }

  /** Box with arbitrary position/size/rotation (rotation in radians, Y then X then Z). */
  boxT(mat, cx, cy, cz, sx, sy, sz, ry = 0, o = {}) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(cx, cy, cz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, ry, o.rz || 0, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    this.geom(mat, boxGeo(sx, sy, sz), m, o);
  }

  /** A flat picture (poster, sign, decal) facing a direction: 'px','nx','pz','nz','py'. */
  decal(mat, cx, cy, cz, w, h, facing, o = {}) {
    const b = this.batch(mat, o.zone, false, o.receive !== false);
    const up = new THREE.Vector3(0, 1, 0);
    const n = { px: [1, 0, 0], nx: [-1, 0, 0], pz: [0, 0, 1], nz: [0, 0, -1], py: [0, 1, 0], ny: [0, -1, 0] }[facing];
    const N = new THREE.Vector3(n[0], n[1], n[2]);
    let R, U;
    if (facing === 'py') { R = new THREE.Vector3(1, 0, 0); U = new THREE.Vector3(0, 0, -1); }
    else if (facing === 'ny') { R = new THREE.Vector3(1, 0, 0); U = new THREE.Vector3(0, 0, 1); }
    else { R = new THREE.Vector3().crossVectors(up, N).normalize(); U = up.clone(); }
    if (o.rot) { R.applyAxisAngle(N, o.rot); U.applyAxisAngle(N, o.rot); }
    const C = new THREE.Vector3(cx, cy, cz);
    const hw = w / 2, hh = h / 2;
    const corners = [
      C.clone().addScaledVector(R, -hw).addScaledVector(U, -hh),
      C.clone().addScaledVector(R, hw).addScaledVector(U, -hh),
      C.clone().addScaledVector(R, hw).addScaledVector(U, hh),
      C.clone().addScaledVector(R, -hw).addScaledVector(U, hh),
    ];
    const uvs = o.uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
    const base = b.count;
    for (let i = 0; i < 4; i++) {
      b.pos.push(corners[i].x, corners[i].y, corners[i].z);
      b.nor.push(N.x, N.y, N.z);
      b.uv.push(uvs[i][0], uvs[i][1]);
      if (o.color) b.col.push(o.color.r, o.color.g, o.color.b);
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    b.count += 4;
  }

  build(scene) {
    for (const b of this.batches.values()) {
      if (b.count === 0) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      if (b.mat.vertexColors) {
        if (b.col.length !== b.count * 3) {
          const fill = new Array(b.count * 3).fill(1);
          for (let i = 0; i < b.col.length; i++) fill[i] = b.col[i];
          b.col = fill;
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      }
      g.setIndex(b.count > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const mesh = new THREE.Mesh(g, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.name = b.zone + ':' + (b.mat.name || 'mat');
      this.zoneGroup(b.zone).add(mesh);
      this.meshes.push(mesh);
      this.stats.tris += b.idx.length / 3;
      this.stats.batches++;
      b.pos = b.nor = b.uv = b.col = b.idx = null;
    }
    this.batches.clear();
    for (const g of this.zones.values()) scene.add(g);
  }
}
