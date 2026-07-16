/**
 * Particles.js
 * ------------
 * A pooled particle system for one-shot bursts (jumps, checkpoint hits, kills,
 * nitro, etc.). Uses a single THREE.Points object per pool with pre-allocated
 * buffers — no per-particle object churn, which keeps GC pauses off the frame.
 */

import * as THREE from 'three';

export class ParticleBurst {
  /**
   * @param {THREE.Scene} scene
   * @param {number} max  maximum simultaneous particles in this pool
   */
  constructor(scene, max = 300) {
    this.max = max;
    this.count = 0;

    const positions = new Float32Array(max * 3);
    const colors = new Float32Array(max * 3);
    this._vel = new Float32Array(max * 3);
    this._life = new Float32Array(max);
    this._maxLife = new Float32Array(max);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.mat = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /**
   * Spawn `n` particles at a point with a color and outward speed.
   * @param {THREE.Vector3} origin
   * @param {number} color  hex color
   * @param {number} n
   * @param {number} speed
   * @param {number} life   seconds
   */
  burst(origin, color, n = 20, speed = 4, life = 0.8) {
    const c = new THREE.Color(color);
    const pos = this.geo.attributes.position.array;
    const col = this.geo.attributes.color.array;
    for (let i = 0; i < n && this.count < this.max; i++) {
      const idx = this.count++;
      const o = idx * 3;
      pos[o] = origin.x;
      pos[o + 1] = origin.y;
      pos[o + 2] = origin.z;
      // Random spherical direction.
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5)
        .normalize()
        .multiplyScalar(speed * (0.5 + Math.random()));
      this._vel[o] = dir.x;
      this._vel[o + 1] = dir.y;
      this._vel[o + 2] = dir.z;
      col[o] = c.r;
      col[o + 1] = c.g;
      col[o + 2] = c.b;
      this._life[idx] = life;
      this._maxLife[idx] = life;
    }
  }

  update(dt) {
    const pos = this.geo.attributes.position.array;
    const col = this.geo.attributes.color.array;
    for (let i = 0; i < this.count; i++) {
      this._life[i] -= dt;
      if (this._life[i] <= 0) {
        // Swap-remove with the last active particle to keep the buffer packed.
        const last = --this.count;
        this._copy(pos, col, last, i);
        this._life[i] = this._life[last];
        this._maxLife[i] = this._maxLife[last];
        i--;
        continue;
      }
      const o = i * 3;
      this._vel[o + 1] -= 9.8 * dt; // gravity
      pos[o] += this._vel[o] * dt;
      pos[o + 1] += this._vel[o + 1] * dt;
      pos[o + 2] += this._vel[o + 2] * dt;
    }
    this.geo.setDrawRange(0, this.count);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  _copy(pos, col, from, to) {
    const f = from * 3;
    const t = to * 3;
    for (let k = 0; k < 3; k++) {
      pos[t + k] = pos[f + k];
      col[t + k] = col[f + k];
      this._vel[t + k] = this._vel[f + k];
    }
  }
}
