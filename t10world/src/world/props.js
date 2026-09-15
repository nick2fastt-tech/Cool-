// T10 World - street furniture, trees and park fittings. Everything here is
// batched or instanced; individual props only become real objects when the
// player can interact with them.
import * as THREE from '../../vendor/three.module.js';
import { makeRng, clamp01, lerpv, TAU } from '../core/math.js';
import { boxUV, cylinderUV, prism, transformed } from './geomutils.js';
import {
  metalMaterial, paintedMaterial, concreteMaterial, emissiveMaterial,
  foliageMaterial, barkMaterial, glassMaterial,
} from './materials.js';
import { settings } from '../core/settings.js';

export const TREE_KINDS = [
  { id: 'oak',    leaf: 0x4f7a37, bark: 0x5a4632, h: [7, 13],  spread: [3.4, 5.6], layers: 4, conical: false },
  { id: 'maple',  leaf: 0x6a8c35, bark: 0x60493a, h: [6, 11],  spread: [3.0, 4.8], layers: 3, conical: false },
  { id: 'pine',   leaf: 0x2f5a3a, bark: 0x4a3a2a, h: [9, 18],  spread: [2.2, 3.6], layers: 5, conical: true },
  { id: 'palm',   leaf: 0x4f8a45, bark: 0x7a6a4a, h: [7, 13],  spread: [2.6, 4.0], layers: 1, conical: false, palm: true },
  { id: 'birch',  leaf: 0x7a9a44, bark: 0xd4d0c4, h: [7, 12],  spread: [2.2, 3.4], layers: 3, conical: false },
  { id: 'willow', leaf: 0x5f7f3a, bark: 0x54463a, h: [8, 12],  spread: [4.2, 6.4], layers: 3, conical: false, droop: true },
];

/** Tree geometry built once per kind/size bucket, then instanced across a chunk. */
const treeCache = new Map();
export function treeGeometry(kindIndex, sizeBucket) {
  const key = kindIndex + ':' + sizeBucket;
  if (treeCache.has(key)) return treeCache.get(key);
  const kind = TREE_KINDS[kindIndex % TREE_KINDS.length];
  const rng = makeRng(kindIndex * 7717 + sizeBucket * 131);
  const t = lerpv(0.2, 1.0, sizeBucket / 3);
  const h = lerpv(kind.h[0], kind.h[1], t);
  const spread = lerpv(kind.spread[0], kind.spread[1], t);

  const trunkGeos = [];
  const leafGeos = [];
  const trunkR = h * 0.035;
  trunkGeos.push(transformed(cylinderUV(trunkR * 0.7, trunkR, h * (kind.palm ? 0.92 : 0.62), 7, 1.4, 3), 0, h * (kind.palm ? 0.46 : 0.31), 0, 0));

  if (kind.palm) {
    // Palm: a crown of long drooping fronds.
    const fronds = 9;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * TAU + rng.range(-0.2, 0.2);
      const len = spread * rng.range(0.85, 1.2);
      const g = new THREE.PlaneGeometry(len, len * 0.30, 3, 1);
      g.rotateX(-Math.PI / 2);
      g.translate(len * 0.5, 0, 0);
      g.rotateZ(rng.range(-0.45, -0.12));
      g.rotateY(a);
      g.translate(0, h * 0.92, 0);
      leafGeos.push(g);
    }
  } else if (kind.conical) {
    for (let i = 0; i < kind.layers; i++) {
      const f = i / (kind.layers - 1);
      const r = spread * (1 - f * 0.72);
      const y = h * (0.38 + f * 0.56);
      const g = new THREE.ConeGeometry(r, h * 0.30, 8, 1, true);
      g.translate(0, y, 0);
      leafGeos.push(g);
    }
  } else {
    // Broadleaf: overlapping blobs give a full canopy without heavy geometry.
    const blobs = kind.layers + 2;
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * TAU;
      const rr = spread * rng.range(0.42, 0.62);
      const dist = spread * rng.range(0.0, 0.42);
      const y = h * lerpv(0.62, 0.95, rng());
      const g = new THREE.SphereGeometry(rr, 7, 5);
      g.scale(1, kind.droop ? 0.78 : 0.86, 1);
      g.translate(Math.cos(a) * dist, y, Math.sin(a) * dist);
      leafGeos.push(g);
    }
    if (kind.droop) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const g = new THREE.PlaneGeometry(0.5, h * 0.36, 1, 2);
        g.translate(0, -h * 0.18, 0);
        g.rotateY(a);
        g.translate(Math.cos(a) * spread * 0.72, h * 0.74, Math.sin(a) * spread * 0.72);
        leafGeos.push(g);
      }
    }
  }
  const result = { trunk: trunkGeos, leaves: leafGeos, height: h, spread, kind };
  treeCache.set(key, result);
  return result;
}

export function treeMaterials(kindIndex) {
  const kind = TREE_KINDS[kindIndex % TREE_KINDS.length];
  return { bark: barkMaterial(kind.bark), leaf: foliageMaterial(kind.leaf, kindIndex) };
}

// ---------------------------------------------------------------------------
// Street furniture
// ---------------------------------------------------------------------------

export function addStreetLight(batcher, x, z, rot, out, style) {
  const pole = metalMaterial(0x4d5256, 0.55);
  const h = style === 'highway' ? 11 : 8.2;
  batcher.add(pole, transformed(cylinderUV(0.09, 0.14, h, 8, 1, 2), x, h / 2, z, 0));
  batcher.add(concreteMaterial(0x8d8a84), transformed(cylinderUV(0.26, 0.32, 0.4, 8, 1, 1), x, 0.2, z, 0));
  // Arm + head
  const armLen = 1.9;
  const ax = x + Math.cos(rot) * armLen * 0.5, az = z + Math.sin(rot) * armLen * 0.5;
  batcher.add(pole, transformed(boxUV(armLen, 0.12, 0.12, 1, 1), ax, h - 0.18, az, rot));
  const hx = x + Math.cos(rot) * armLen, hz = z + Math.sin(rot) * armLen;
  batcher.add(pole, transformed(boxUV(0.85, 0.18, 0.42, 1, 1), hx, h - 0.34, hz, rot));
  batcher.add(emissiveMaterial(0xffe2b0, 1.1), transformed(boxUV(0.72, 0.08, 0.34, 1, 1), hx, h - 0.46, hz, rot));
  if (out) out.lights.push({ x: hx, y: h - 0.5, z: hz, color: 0xffd9a0, intensity: 1.5, distance: 22, streetLight: true });
}

export function addTrafficLight(batcher, x, z, rot, out) {
  const pole = metalMaterial(0x33383c, 0.6);
  const h = 5.6;
  batcher.add(pole, transformed(cylinderUV(0.09, 0.12, h, 8, 1, 2), x, h / 2, z, 0));
  const arm = 3.4;
  const ax = x + Math.cos(rot) * arm * 0.5, az = z + Math.sin(rot) * arm * 0.5;
  batcher.add(pole, transformed(boxUV(arm, 0.1, 0.1, 1, 1), ax, h - 0.2, az, rot));
  const hx = x + Math.cos(rot) * arm, hz = z + Math.sin(rot) * arm;
  batcher.add(pole, transformed(boxUV(0.34, 0.95, 0.3, 1, 1), hx, h - 0.75, hz, rot));
  // Lenses are separate so the signal system can toggle them.
  const lights = [];
  for (let i = 0; i < 3; i++) {
    const colors = [0xff2a2a, 0xffb020, 0x28d24a];
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: colors[i], emissiveIntensity: 0, roughness: 0.4 })
    );
    mesh.position.set(hx + Math.sin(rot) * 0.17, h - 0.42 - i * 0.30, hz + Math.cos(rot) * 0.17);
    lights.push(mesh);
  }
  // Pedestrian signal
  batcher.add(pole, transformed(boxUV(0.28, 0.34, 0.22, 1, 1), x + Math.cos(rot) * 0.25, 2.8, z + Math.sin(rot) * 0.25, rot));
  return lights;
}

export function addBench(batcher, x, z, rot) {
  const wood = paintedMaterial(0x7a5a3c, 0.85);
  const metal = metalMaterial(0x3a3f43, 0.6);
  for (let i = 0; i < 4; i++) {
    batcher.add(wood, transformed(boxUV(1.9, 0.06, 0.13, 1, 1), x, 0.46, z - 0.22 + i * 0.145, rot));
  }
  for (let i = 0; i < 3; i++) {
    const g = boxUV(1.9, 0.13, 0.06, 1, 1);
    g.rotateX(-0.22);
    batcher.add(wood, transformed(g, x, 0.62 + i * 0.145, z - 0.30, rot));
  }
  for (const sx of [-0.82, 0.82]) {
    batcher.add(metal, transformed(boxUV(0.09, 0.46, 0.55, 1, 1), x + sx * Math.cos(rot), 0.23, z + sx * Math.sin(rot), rot));
    batcher.add(metal, transformed(boxUV(0.09, 0.42, 0.09, 1, 1), x + sx * Math.cos(rot), 0.68, z + sx * Math.sin(rot) - 0.30, rot));
  }
}

export function addTrashCan(batcher, x, z) {
  batcher.add(metalMaterial(0x3f4a42, 0.7), transformed(cylinderUV(0.30, 0.26, 0.86, 10, 1, 1), x, 0.43, z, 0));
  batcher.add(metalMaterial(0x2c332e, 0.6), transformed(cylinderUV(0.33, 0.33, 0.08, 10, 1, 1), x, 0.9, z, 0));
}

export function addHydrant(batcher, x, z) {
  const red = paintedMaterial(0xc0392b, 0.6);
  batcher.add(red, transformed(cylinderUV(0.13, 0.16, 0.62, 8, 1, 1), x, 0.31, z, 0));
  batcher.add(red, transformed(new THREE.SphereGeometry(0.14, 8, 6), x, 0.66, z, 0));
  batcher.add(red, transformed(cylinderUV(0.07, 0.07, 0.36, 6, 1, 1), x, 0.42, z, 0, { x: 1, y: 1, z: 1 }));
}

export function addBusStop(batcher, x, z, rot, out) {
  const metal = metalMaterial(0x4a5054, 0.5);
  batcher.add(glassMaterial(0x6b7d88, 0.28), transformed(boxUV(3.6, 2.2, 0.08, 2, 2), x, 1.3, z - 0.7, rot));
  batcher.add(metal, transformed(boxUV(3.8, 0.12, 1.6, 2, 2), x, 2.5, z, rot));
  for (const sx of [-1.75, 1.75]) {
    batcher.add(metal, transformed(boxUV(0.09, 2.5, 0.09, 1, 1), x + sx * Math.cos(rot), 1.25, z + sx * Math.sin(rot), rot));
  }
  addBench(batcher, x, z - 0.35, rot);
  batcher.add(emissiveMaterial(0xdff0ff, 0.7), transformed(boxUV(0.7, 1.0, 0.06, 1, 1), x + 1.5 * Math.cos(rot), 1.5, z + 1.5 * Math.sin(rot), rot));
  if (out) out.lights.push({ x, y: 2.4, z, color: 0xdff0ff, intensity: 0.6, distance: 8 });
}

export function addATM(batcher, x, z, rot, out) {
  batcher.add(paintedMaterial(0x2c3e50, 0.5), transformed(boxUV(0.9, 1.9, 0.5, 1, 1), x, 0.95, z, rot));
  batcher.add(emissiveMaterial(0x35c17a, 1.0), transformed(boxUV(0.5, 0.36, 0.06, 1, 1), x + Math.sin(rot) * 0.27, 1.35, z + Math.cos(rot) * 0.27, rot));
  if (out) out.lights.push({ x, y: 1.6, z, color: 0x35c17a, intensity: 0.5, distance: 5 });
}

export function addMailbox(batcher, x, z, rot) {
  batcher.add(paintedMaterial(0x2f5aa0, 0.6), transformed(boxUV(0.55, 1.05, 0.45, 1, 1), x, 0.72, z, rot));
  batcher.add(metalMaterial(0x4a4f53, 0.6), transformed(cylinderUV(0.06, 0.06, 0.4, 6, 1, 1), x, 0.2, z, 0));
}

export function addPlanter(batcher, x, z, rng) {
  batcher.add(concreteMaterial(0xa8a49b), transformed(boxUV(1.3, 0.55, 1.3, 2, 2), x, 0.27, z, 0));
  batcher.add(foliageMaterial(0x4e7a38, 5), transformed(new THREE.SphereGeometry(0.55, 7, 5), x, 0.85, z, 0, { x: 1, y: 0.7, z: 1 }));
}

export function addSignpost(batcher, x, z, rot, name) {
  batcher.add(metalMaterial(0x6a7075, 0.5), transformed(cylinderUV(0.045, 0.05, 2.9, 6, 1, 1), x, 1.45, z, 0));
  batcher.add(paintedMaterial(0x2e7a4f, 0.6), transformed(boxUV(1.5, 0.28, 0.05, 1, 1), x, 2.75, z, rot));
  batcher.add(paintedMaterial(0x2e7a4f, 0.6), transformed(boxUV(0.05, 0.28, 1.5, 1, 1), x, 2.45, z, rot));
}

export function addParkingMeter(batcher, x, z, rot) {
  batcher.add(metalMaterial(0x5a5f63, 0.5), transformed(cylinderUV(0.05, 0.06, 1.15, 6, 1, 1), x, 0.58, z, 0));
  batcher.add(paintedMaterial(0x30353a, 0.5), transformed(boxUV(0.2, 0.32, 0.14, 1, 1), x, 1.3, z, rot));
}

export function addFireEscape(batcher, x, z, rot, floors) {
  const metal = metalMaterial(0x3a3f43, 0.7);
  for (let i = 1; i <= floors; i++) {
    const y = i * 3.4;
    batcher.add(metal, transformed(boxUV(3.0, 0.08, 1.2, 2, 2), x, y, z, rot));
    batcher.add(metal, transformed(boxUV(3.0, 0.9, 0.06, 2, 2), x + Math.sin(rot) * 0.55, y + 0.45, z + Math.cos(rot) * 0.55, rot));
    const g = boxUV(0.9, 0.06, 3.0, 2, 2);
    g.rotateX(0.85);
    batcher.add(metal, transformed(g, x + 1.0, y + 1.7, z, rot));
  }
}

export function addPicnicTable(batcher, x, z, rot) {
  const wood = paintedMaterial(0x8a6a44, 0.88);
  batcher.add(wood, transformed(boxUV(1.7, 0.08, 0.85, 1, 1), x, 0.74, z, rot));
  for (const sz of [-0.62, 0.62]) {
    batcher.add(wood, transformed(boxUV(1.7, 0.07, 0.3, 1, 1), x - sz * Math.sin(rot), 0.45, z + sz * Math.cos(rot), rot));
  }
  for (const sx of [-0.7, 0.7]) {
    const g = boxUV(0.08, 0.8, 1.5, 1, 1);
    batcher.add(wood, transformed(g, x + sx * Math.cos(rot), 0.38, z + sx * Math.sin(rot), rot));
  }
}

export function addPlayground(batcher, x, z, rng) {
  const frame = paintedMaterial(0xd94f3d, 0.6);
  const frame2 = paintedMaterial(0x2f7fb8, 0.6);
  batcher.add(paintedMaterial(0xa87a52, 0.95), transformed(boxUV(14, 0.06, 12, 4, 4), x, 0.03, z, 0));
  // Swing set
  for (const sx of [-1, 1]) {
    const g = cylinderUV(0.07, 0.07, 3.4, 6, 1, 1);
    g.rotateZ(sx * 0.28);
    batcher.add(frame, transformed(g, x + sx * 1.5, 1.6, z - 2.5, 0));
  }
  batcher.add(frame, transformed(boxUV(3.4, 0.1, 0.1, 1, 1), x, 3.1, z - 2.5, 0));
  for (const sx of [-0.8, 0.8]) {
    batcher.add(metalMaterial(0x888888, 0.5), transformed(boxUV(0.03, 1.9, 0.03, 1, 1), x + sx, 2.1, z - 2.5, 0));
    batcher.add(paintedMaterial(0x2c2f33, 0.7), transformed(boxUV(0.45, 0.06, 0.2, 1, 1), x + sx, 1.16, z - 2.5, 0));
  }
  // Slide + platform
  batcher.add(frame2, transformed(boxUV(2.2, 0.12, 2.2, 2, 2), x + 3, 1.6, z + 2, 0));
  for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    batcher.add(frame2, transformed(boxUV(0.12, 1.6, 0.12, 1, 1), x + 3 + ox, 0.8, z + 2 + oz, 0));
  }
  const slide = boxUV(0.9, 0.08, 3.4, 2, 2);
  slide.rotateX(-0.48);
  batcher.add(paintedMaterial(0xf0c040, 0.55), transformed(slide, x + 3, 0.95, z + 4.0, 0));
}

export function addBasketballCourt(batcher, x, z, rot) {
  batcher.add(paintedMaterial(0x4a5560, 0.9), transformed(boxUV(15, 0.06, 26, 6, 6), x, 0.03, z, rot));
  const line = paintedMaterial(0xe4e0d4, 0.85);
  batcher.add(line, transformed(boxUV(14.4, 0.02, 0.12, 1, 1), x, 0.07, z, rot));
  const ring = new THREE.TorusGeometry(1.8, 0.06, 6, 24);
  ring.rotateX(-Math.PI / 2);
  batcher.add(line, transformed(ring, x, 0.07, z, rot));
  for (const sz of [-1, 1]) {
    const px = x - Math.sin(rot) * sz * 12, pz = z + Math.cos(rot) * sz * 12;
    batcher.add(metalMaterial(0x6a7075, 0.5), transformed(cylinderUV(0.09, 0.11, 3.3, 8, 1, 1), px, 1.65, pz, 0));
    batcher.add(paintedMaterial(0xf2f0ea, 0.5), transformed(boxUV(1.8, 1.1, 0.06, 1, 1), px, 3.3, pz + sz * 0.4, rot));
    const hoop = new THREE.TorusGeometry(0.23, 0.02, 5, 12);
    hoop.rotateX(-Math.PI / 2);
    batcher.add(paintedMaterial(0xd94f3d, 0.5), transformed(hoop, px, 3.05, pz + sz * 0.7, 0));
  }
}

export function addFountain(batcher, x, z, out) {
  batcher.add(concreteMaterial(0xc2bcb0), transformed(cylinderUV(3.4, 3.6, 0.7, 20, 4, 2), x, 0.35, z, 0));
  batcher.add(new THREE.MeshStandardMaterial({ color: 0x2b6a86, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }),
    transformed(cylinderUV(3.1, 3.1, 0.06, 20, 4, 1), x, 0.62, z, 0));
  batcher.add(concreteMaterial(0xcdc7ba), transformed(cylinderUV(0.35, 0.55, 1.6, 12, 2, 2), x, 0.8, z, 0));
  batcher.add(concreteMaterial(0xcdc7ba), transformed(cylinderUV(1.2, 1.0, 0.2, 14, 2, 1), x, 1.7, z, 0));
  if (out) out.lights.push({ x, y: 0.8, z, color: 0x7fd8ff, intensity: 0.7, distance: 9 });
}

/** Parked car shells — cheap filler so streets never look empty. */
export function addParkedCar(batcher, x, z, rot, rng) {
  const colors = [0x8a2b2b, 0x2b4a7a, 0x2f2f33, 0xd8d5cd, 0x37613f, 0x8a7a2b, 0x6a6f74, 0xb5541f];
  const body = paintedMaterial(rng.pick(colors), 0.35);
  const glass = glassMaterial(0x2a3540, 0.6);
  const tyre = paintedMaterial(0x18191b, 0.9);
  const w = 1.84, l = 4.4, h = 0.78;
  batcher.add(body, transformed(boxUV(w, h, l, 2, 2), x, 0.62, z, rot));
  batcher.add(body, transformed(boxUV(w * 0.88, 0.62, l * 0.48, 2, 2), x, 1.30, z - 0.14, rot));
  batcher.add(glass, transformed(boxUV(w * 0.90, 0.5, l * 0.46, 2, 2), x, 1.32, z - 0.14, rot));
  for (const [ox, oz] of [[-0.86, 1.36], [0.86, 1.36], [-0.86, -1.42], [0.86, -1.42]]) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const g = cylinderUV(0.33, 0.33, 0.22, 10, 1, 1);
    g.rotateZ(Math.PI / 2);
    batcher.add(tyre, transformed(g, x + ox * c - oz * s, 0.33, z + ox * s + oz * c, rot));
  }
  batcher.add(emissiveMaterial(0xffeccc, 0.25), transformed(boxUV(w * 0.74, 0.14, 0.08, 1, 1), x - Math.sin(rot) * l * 0.5, 0.68, z + Math.cos(rot) * l * 0.5, rot));
  batcher.add(emissiveMaterial(0xff3020, 0.25), transformed(boxUV(w * 0.74, 0.12, 0.08, 1, 1), x + Math.sin(rot) * l * 0.5, 0.70, z - Math.cos(rot) * l * 0.5, rot));
}

export function addRock(batcher, x, y, z, scale, rng) {
  const g = new THREE.IcosahedronGeometry(scale, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = 0.7 + rng() * 0.6;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * 0.7, pos.getZ(i) * f);
  }
  g.computeVertexNormals();
  if (!g.attributes.uv) {
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) * 0.3; uv[i * 2 + 1] = pos.getZ(i) * 0.3; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  batcher.add(concreteMaterial(0x7a756c), transformed(g, x, y + scale * 0.35, z, rng() * TAU));
}

export function addFence(batcher, ax, az, bx, bz, color) {
  const mat = paintedMaterial(color || 0xd6d2c8, 0.85);
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  const rot = Math.atan2(dz, dx);
  const posts = Math.max(2, Math.round(len / 2.2));
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    batcher.add(mat, transformed(boxUV(0.10, 1.15, 0.10, 1, 1), ax + dx * t, 0.58, az + dz * t, 0));
  }
  for (const y of [0.45, 0.95]) {
    batcher.add(mat, transformed(boxUV(len, 0.09, 0.05, 2, 1), (ax + bx) / 2, y, (az + bz) / 2, -rot));
  }
}

// ---------------------------------------------------------------------------
// Extended prop catalogue — everything T10 can conjure into the world.
// ---------------------------------------------------------------------------

export function addTrafficCone(batcher, x, z) {
  batcher.add(paintedMaterial(0xe8621f, 0.7), transformed(new THREE.ConeGeometry(0.22, 0.62, 10), x, 0.31, z, 0));
  batcher.add(paintedMaterial(0xe8621f, 0.7), transformed(boxUV(0.46, 0.05, 0.46, 1, 1), x, 0.03, z, 0));
  batcher.add(paintedMaterial(0xf0f0ea, 0.6), transformed(new THREE.ConeGeometry(0.155, 0.10, 10), x, 0.40, z, 0));
}

export function addBarrier(batcher, x, z, rot) {
  const white = paintedMaterial(0xe4e2da, 0.7), red = paintedMaterial(0xc0392b, 0.7);
  for (let i = 0; i < 4; i++) {
    batcher.add(i % 2 ? red : white, transformed(boxUV(0.5, 0.22, 0.12, 1, 1), x + (i - 1.5) * 0.5 * Math.cos(rot), 0.92, z + (i - 1.5) * 0.5 * Math.sin(rot), rot));
  }
  batcher.add(white, transformed(boxUV(2.1, 0.14, 0.12, 2, 1), x, 0.55, z, rot));
  for (const sx of [-1, 1]) {
    batcher.add(metalMaterial(0x6a7075, 0.5), transformed(boxUV(0.08, 1.0, 0.5, 1, 1), x + sx * 1.0 * Math.cos(rot), 0.5, z + sx * 1.0 * Math.sin(rot), rot));
  }
}

export function addDumpster(batcher, x, z, rot) {
  const m = paintedMaterial(0x2f6a4a, 0.75);
  batcher.add(m, transformed(boxUV(1.9, 1.1, 1.2, 2, 2), x, 0.62, z, rot));
  batcher.add(paintedMaterial(0x24503a, 0.7), transformed(boxUV(1.95, 0.1, 1.25, 2, 2), x, 1.20, z, rot));
  for (const sx of [-1, 1]) {
    batcher.add(paintedMaterial(0x1a1b1d, 0.9), transformed(cylinderUV(0.14, 0.14, 0.08, 8, 1, 1), x + sx * 0.8 * Math.cos(rot), 0.14, z + sx * 0.8 * Math.sin(rot), Math.PI / 2));
  }
}

export function addCrate(batcher, x, z, rot, scale) {
  const s = scale || 1;
  batcher.add(paintedMaterial(0x9a7a52, 0.9), transformed(boxUV(0.8 * s, 0.8 * s, 0.8 * s, 1, 1), x, 0.4 * s, z, rot));
  batcher.add(paintedMaterial(0x7a5e3c, 0.9), transformed(boxUV(0.84 * s, 0.07 * s, 0.07 * s, 1, 1), x, 0.4 * s, z + 0.41 * s, rot));
}

export function addBarrel(batcher, x, z, color) {
  batcher.add(paintedMaterial(color || 0xb5451f, 0.7), transformed(cylinderUV(0.30, 0.30, 0.88, 12, 2, 2), x, 0.44, z, 0));
  for (const y of [0.24, 0.64]) {
    batcher.add(metalMaterial(0x8a8f94, 0.5), transformed(cylinderUV(0.315, 0.315, 0.05, 12, 2, 1), x, y, z, 0));
  }
}

export function addPallet(batcher, x, z, rot) {
  const m = paintedMaterial(0x8a7050, 0.92);
  for (let i = 0; i < 5; i++) batcher.add(m, transformed(boxUV(1.2, 0.04, 0.16, 1, 1), x, 0.16, z + (i - 2) * 0.25, rot));
  for (const sz of [-0.5, 0, 0.5]) batcher.add(m, transformed(boxUV(1.2, 0.1, 0.1, 1, 1), x, 0.07, z + sz, rot));
}

export function addBollard(batcher, x, z) {
  batcher.add(metalMaterial(0x3a3f43, 0.5), transformed(cylinderUV(0.10, 0.12, 0.95, 10, 1, 1), x, 0.47, z, 0));
  batcher.add(paintedMaterial(0xd8d5cd, 0.6), transformed(cylinderUV(0.105, 0.105, 0.10, 10, 1, 1), x, 0.82, z, 0));
}

export function addStatue(batcher, x, z, rot) {
  const stone = concreteMaterial(0xa8a49b);
  batcher.add(stone, transformed(boxUV(1.6, 0.9, 1.6, 2, 2), x, 0.45, z, rot));
  batcher.add(concreteMaterial(0x98948b), transformed(boxUV(1.2, 0.3, 1.2, 2, 2), x, 1.02, z, rot));
  const bronze = metalMaterial(0x6a5a34, 0.45);
  batcher.add(bronze, transformed(cylinderUV(0.22, 0.28, 1.5, 10, 1, 2), x, 1.9, z, 0));
  batcher.add(bronze, transformed(new THREE.SphereGeometry(0.26, 10, 8), x, 2.82, z, 0));
  for (const sx of [-1, 1]) {
    const arm = cylinderUV(0.09, 0.09, 0.9, 8, 1, 1);
    arm.rotateZ(sx * 0.9);
    batcher.add(bronze, transformed(arm, x + sx * 0.32, 2.3, z, 0));
  }
}

export function addFlagpole(batcher, x, z) {
  batcher.add(metalMaterial(0xd0d4d8, 0.3), transformed(cylinderUV(0.06, 0.09, 9, 8, 1, 3), x, 4.5, z, 0));
  batcher.add(concreteMaterial(0xa8a49b), transformed(cylinderUV(0.35, 0.42, 0.4, 10, 1, 1), x, 0.2, z, 0));
  batcher.add(paintedMaterial(0xc0392b, 0.85), transformed(boxUV(1.5, 0.9, 0.03, 1, 1), x + 0.78, 8.1, z, 0));
}

export function addVendingMachine(batcher, x, z, rot, out) {
  batcher.add(paintedMaterial(0xc0392b, 0.5), transformed(boxUV(1.0, 1.9, 0.72, 1, 1), x, 0.95, z, rot));
  batcher.add(glassMaterial(0x2a3540, 0.5), transformed(boxUV(0.66, 1.25, 0.06, 1, 1), x + Math.sin(rot) * 0.37, 1.15, z + Math.cos(rot) * 0.37, rot));
  batcher.add(emissiveMaterial(0xfff0c0, 0.9), transformed(boxUV(0.7, 0.18, 0.05, 1, 1), x + Math.sin(rot) * 0.38, 1.82, z + Math.cos(rot) * 0.38, rot));
  if (out) out.lights.push({ x, y: 1.9, z, color: 0xfff0c0, intensity: 0.5, distance: 5 });
}

export function addNewsBox(batcher, x, z, rot) {
  batcher.add(paintedMaterial(0x2f5aa0, 0.6), transformed(boxUV(0.55, 1.0, 0.45, 1, 1), x, 0.62, z, rot));
  batcher.add(glassMaterial(0x50606b, 0.4), transformed(boxUV(0.42, 0.34, 0.05, 1, 1), x + Math.sin(rot) * 0.24, 0.92, z + Math.cos(rot) * 0.24, rot));
  batcher.add(metalMaterial(0x5a5f63, 0.5), transformed(boxUV(0.08, 0.3, 0.08, 1, 1), x, 0.16, z, rot));
}

export function addBikeRack(batcher, x, z, rot) {
  const m = metalMaterial(0x7a8085, 0.45);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.TorusGeometry(0.34, 0.035, 6, 14, Math.PI);
    batcher.add(m, transformed(g, x + (i - 1.5) * 0.7 * Math.cos(rot), 0.34, z + (i - 1.5) * 0.7 * Math.sin(rot), rot));
  }
}

export function addPhoneBooth(batcher, x, z, rot, out) {
  batcher.add(paintedMaterial(0xc0392b, 0.5), transformed(boxUV(1.0, 2.4, 1.0, 1, 1), x, 1.2, z, rot));
  batcher.add(glassMaterial(0x5b7b8c, 0.35), transformed(boxUV(0.82, 1.7, 0.86, 1, 1), x, 1.35, z, rot));
  batcher.add(emissiveMaterial(0xfff4d8, 0.9), transformed(boxUV(0.9, 0.22, 0.9, 1, 1), x, 2.32, z, rot));
  if (out) out.lights.push({ x, y: 2.2, z, color: 0xfff4d8, intensity: 0.8, distance: 6 });
}

export function addTent(batcher, x, z, rot, color) {
  batcher.add(paintedMaterial(color || 0x3f7a52, 0.88), transformed(prism(2.6, 1.7, 3.0, 3, 3), x, 0, z, rot));
  batcher.add(paintedMaterial(0x2a2d31, 0.9), transformed(boxUV(0.9, 1.0, 0.04, 1, 1), x, 0.5, z + 1.5 * Math.cos(rot), rot));
}

export function addCampfire(batcher, x, z, out) {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    batcher.add(concreteMaterial(0x6a6258), transformed(new THREE.DodecahedronGeometry(0.18, 0), x + Math.cos(a) * 0.55, 0.12, z + Math.sin(a) * 0.55, a));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const log = cylinderUV(0.06, 0.08, 0.9, 6, 1, 1);
    log.rotateZ(1.1);
    batcher.add(barkMaterial(0x5a4632), transformed(log, x + Math.cos(a) * 0.16, 0.24, z + Math.sin(a) * 0.16, a));
  }
  batcher.add(emissiveMaterial(0xff7a20, 2.2), transformed(new THREE.ConeGeometry(0.26, 0.6, 7), x, 0.42, z, 0));
  if (out) out.lights.push({ x, y: 0.7, z, color: 0xff8830, intensity: 2.4, distance: 14 });
}

export function addUmbrella(batcher, x, z, color) {
  batcher.add(metalMaterial(0x9aa0a4, 0.4), transformed(cylinderUV(0.04, 0.05, 2.3, 6, 1, 1), x, 1.15, z, 0));
  batcher.add(paintedMaterial(color || 0xd94f3d, 0.8), transformed(new THREE.ConeGeometry(1.5, 0.55, 10), x, 2.35, z, 0));
  batcher.add(concreteMaterial(0x8d8a84), transformed(cylinderUV(0.35, 0.4, 0.12, 10, 1, 1), x, 0.06, z, 0));
}

export function addLadder(batcher, x, z, rot, h) {
  const m = metalMaterial(0xaab0b4, 0.4);
  const H = h || 4;
  for (const sx of [-0.22, 0.22]) {
    batcher.add(m, transformed(boxUV(0.05, H, 0.05, 1, 1), x + sx * Math.cos(rot), H / 2, z + sx * Math.sin(rot), rot));
  }
  for (let i = 0; i < Math.floor(H / 0.35); i++) {
    batcher.add(m, transformed(boxUV(0.5, 0.04, 0.04, 1, 1), x, 0.25 + i * 0.35, z, rot));
  }
}

export function addGenerator(batcher, x, z, rot) {
  batcher.add(paintedMaterial(0xd8a020, 0.6), transformed(boxUV(1.3, 0.9, 0.8, 1, 1), x, 0.48, z, rot));
  batcher.add(metalMaterial(0x4a4f53, 0.6), transformed(cylinderUV(0.06, 0.06, 0.5, 6, 1, 1), x + 0.5, 1.15, z, 0));
  batcher.add(paintedMaterial(0x2a2d31, 0.8), transformed(boxUV(1.35, 0.12, 0.85, 1, 1), x, 0.05, z, rot));
}

export function addSatelliteDish(batcher, x, z, rot) {
  batcher.add(metalMaterial(0x8a8f94, 0.5), transformed(cylinderUV(0.06, 0.08, 1.2, 6, 1, 1), x, 0.6, z, 0));
  const dish = new THREE.SphereGeometry(0.85, 12, 8, 0, TAU, 0, Math.PI * 0.42);
  dish.rotateX(Math.PI * 0.72);
  batcher.add(paintedMaterial(0xe0ddd4, 0.55), transformed(dish, x, 1.35, z, rot));
  batcher.add(metalMaterial(0x6a7075, 0.4), transformed(cylinderUV(0.04, 0.04, 0.7, 6, 1, 1), x, 1.5, z + 0.4, 0));
}

export function addSwingSet(batcher, x, z, rot) { addPlayground(batcher, x, z, makeRng(7)); }

export function addStreetSign(batcher, x, z, rot, color) {
  batcher.add(metalMaterial(0x6a7075, 0.5), transformed(cylinderUV(0.045, 0.05, 2.6, 6, 1, 1), x, 1.3, z, 0));
  batcher.add(paintedMaterial(color || 0xc0392b, 0.6), transformed(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 8), x, 2.5, z, rot, { x: 1, y: 1, z: 1 }));
}

export function addPottedTree(batcher, x, z, rng) {
  batcher.add(concreteMaterial(0x9a6a4a), transformed(cylinderUV(0.42, 0.34, 0.55, 12, 2, 1), x, 0.28, z, 0));
  batcher.add(barkMaterial(0x5a4632), transformed(cylinderUV(0.07, 0.09, 1.4, 7, 1, 2), x, 1.2, z, 0));
  batcher.add(foliageMaterial(0x4e7a38, 11), transformed(new THREE.SphereGeometry(0.75, 8, 6), x, 2.1, z, 0, { x: 1, y: 0.85, z: 1 }));
}

export function addSolarPanel(batcher, x, z, rot) {
  const p = boxUV(2.0, 0.08, 1.2, 2, 2);
  p.rotateX(-0.5);
  batcher.add(paintedMaterial(0x1b2a44, 0.25), transformed(p, x, 0.9, z, rot));
  for (const sx of [-0.8, 0.8]) {
    batcher.add(metalMaterial(0x9aa0a4, 0.5), transformed(boxUV(0.06, 0.9, 0.06, 1, 1), x + sx * Math.cos(rot), 0.45, z + sx * Math.sin(rot), rot));
  }
}

export function addBoat(batcher, x, z, rot, color) {
  const hull = boxUV(1.8, 0.55, 4.6, 2, 2);
  batcher.add(paintedMaterial(color || 0xe8e6e0, 0.5), transformed(hull, x, 0.3, z, rot));
  batcher.add(paintedMaterial(0x8a7050, 0.85), transformed(boxUV(1.5, 0.08, 3.8, 2, 2), x, 0.58, z, rot));
  batcher.add(metalMaterial(0xd0d4d8, 0.3), transformed(cylinderUV(0.05, 0.06, 4.0, 6, 1, 2), x, 2.5, z, 0));
}
