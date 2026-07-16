/**
 * Environment.js
 * --------------
 * Reusable procedural scenery builders shared by the lobby and game worlds:
 * ground, low-poly trees, a reflective-ish water plane, distant mountains, and
 * scattered rocks. Everything is instanced or merged where possible to keep
 * draw calls (and battery use) low on mobile.
 */

import * as THREE from 'three';

export const Environment = {
  /** Flat grass ground with a subtle noise tint. Returns the mesh. */
  ground(size = 200, color = 0x4a8c3f) {
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * A cluster of low-poly trees as a single instanced mesh (trunk) + instanced
   * foliage. `count` trees scattered within `radius`, avoiding a central clear
   * zone of `clearRadius`.
   */
  trees(count = 60, radius = 90, clearRadius = 18) {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 });
    const leafGeo = new THREE.ConeGeometry(1.6, 3, 7);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 1 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
    trunks.castShadow = leaves.castShadow = true;
    const m = new THREE.Matrix4();

    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 20) {
      const a = Math.random() * Math.PI * 2;
      const r = clearRadius + Math.random() * (radius - clearRadius);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const s = 0.8 + Math.random() * 0.9;
      m.makeScale(s, s, s);
      m.setPosition(x, s, z);
      trunks.setMatrixAt(placed, m);
      m.setPosition(x, 2 * s + 1, z);
      leaves.setMatrixAt(placed, m);
      placed++;
    }
    trunks.count = leaves.count = placed;
    trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true;
    group.add(trunks, leaves);
    return group;
  },

  /** A translucent, gently animated water plane. Call update(dt) each frame. */
  water(size = 60, y = -0.5) {
    const geo = new THREE.PlaneGeometry(size, size, 24, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a7fb8,
      transparent: true,
      opacity: 0.8,
      roughness: 0.2,
      metalness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    const base = geo.attributes.position.array.slice();
    mesh.update = (t) => {
      const pos = geo.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 1] = Math.sin(base[i] * 0.4 + t) * 0.15 + Math.cos(base[i + 2] * 0.3 + t) * 0.15;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    };
    return mesh;
  },

  /** A ring of distant mountains (billboards would be cheaper; cones read well). */
  mountains(count = 14, distance = 160) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6d7b8d, roughness: 1, flatShading: true });
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const h = 30 + Math.random() * 40;
      const geo = new THREE.ConeGeometry(h * 0.7, h, 5);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.cos(a) * distance, h / 2 - 4, Math.sin(a) * distance);
      m.rotation.y = Math.random() * Math.PI;
      group.add(m);
    }
    return group;
  },

  /** Scattered rocks for detail. */
  rocks(count = 20, radius = 80) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 1, flatShading: true });
    for (let i = 0; i < count; i++) {
      const geo = new THREE.IcosahedronGeometry(0.4 + Math.random() * 1.2, 0);
      const m = new THREE.Mesh(geo, mat);
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * radius;
      m.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
      m.castShadow = m.receiveShadow = true;
      group.add(m);
    }
    return group;
  },
};
