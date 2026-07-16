/**
 * Physics.js
 * ----------
 * A deliberately small, mobile-friendly collision world. It supports:
 *   - solid axis-aligned box colliders (platforms, walls, crates)
 *   - an optional ground height function (for terrain/heightfields)
 *   - capsule-vs-box resolution with grounding detection
 *   - trigger volumes that fire enter/exit callbacks (lava, checkpoints, portals)
 *
 * This is not a full rigid-body engine — it's exactly what a character-driven
 * sandbox needs, and it stays cheap enough for dozens of players at 60 FPS.
 */

import * as THREE from 'three';

let _idCounter = 1;

export class PhysicsWorld {
  constructor() {
    /** @type {Array<{id:number, box:THREE.Box3, mesh?:THREE.Object3D}>} */
    this.solids = [];
    /** @type {Array<{id:number, box:THREE.Box3, onEnter?:Function, onExit?:Function, tag:string, _inside:Set<number>}>} */
    this.triggers = [];
    /** Optional (x,z) -> y ground height. Defaults to flat y=0. */
    this.groundHeight = null;
  }

  addSolid(box, mesh) {
    const entry = { id: _idCounter++, box: box.clone(), mesh };
    this.solids.push(entry);
    return entry.id;
  }

  /** Register a solid from a mesh's world-space bounding box. */
  addSolidFromMesh(mesh) {
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    return this.addSolid(box, mesh);
  }

  removeSolid(id) {
    const i = this.solids.findIndex((s) => s.id === id);
    if (i >= 0) this.solids.splice(i, 1);
  }

  /** Update a moving platform's collider to match its current transform. */
  updateSolid(id, box) {
    const s = this.solids.find((s) => s.id === id);
    if (s) s.box.copy(box);
  }

  addTrigger(box, { tag = 'trigger', onEnter, onExit } = {}) {
    const entry = { id: _idCounter++, box: box.clone(), tag, onEnter, onExit, _inside: new Set() };
    this.triggers.push(entry);
    return entry.id;
  }
  removeTrigger(id) {
    const i = this.triggers.findIndex((t) => t.id === id);
    if (i >= 0) this.triggers.splice(i, 1);
  }
  clearTriggers() {
    this.triggers.length = 0;
  }

  clear() {
    this.solids.length = 0;
    this.triggers.length = 0;
    this.groundHeight = null;
  }

  /**
   * Resolve a capsule (approximated as an AABB) against all solids and ground.
   * Mutates `pos` and `vel` in place.
   *
   * @param {THREE.Vector3} pos  feet position (bottom-centre of the capsule)
   * @param {THREE.Vector3} vel  velocity (units/sec)
   * @param {number} radius
   * @param {number} height
   * @param {number} dt
   * @returns {{grounded:boolean}}
   */
  resolveCapsule(pos, vel, radius, height, dt) {
    // Integrate.
    pos.addScaledVector(vel, dt);

    let grounded = false;

    // --- Ground / terrain ---------------------------------------------------
    const groundY = this.groundHeight ? this.groundHeight(pos.x, pos.z) : 0;
    if (pos.y <= groundY) {
      pos.y = groundY;
      if (vel.y < 0) vel.y = 0;
      grounded = true;
    }

    // --- Solid boxes --------------------------------------------------------
    // Build the player's current AABB (feet at pos.y).
    const min = new THREE.Vector3(pos.x - radius, pos.y, pos.z - radius);
    const max = new THREE.Vector3(pos.x + radius, pos.y + height, pos.z + radius);

    for (const s of this.solids) {
      const b = s.box;
      if (max.x <= b.min.x || min.x >= b.max.x) continue;
      if (max.y <= b.min.y || min.y >= b.max.y) continue;
      if (max.z <= b.min.z || min.z >= b.max.z) continue;

      // Overlap on each axis; resolve along the smallest penetration.
      const px = Math.min(max.x - b.min.x, b.max.x - min.x);
      const py = Math.min(max.y - b.min.y, b.max.y - min.y);
      const pz = Math.min(max.z - b.min.z, b.max.z - min.z);

      if (py <= px && py <= pz) {
        // Vertical resolution.
        const feetCloserToTop = Math.abs(pos.y - b.max.y) < Math.abs(pos.y + height - b.min.y);
        if (feetCloserToTop && vel.y <= 0) {
          pos.y = b.max.y; // land on top
          vel.y = 0;
          grounded = true;
        } else if (vel.y > 0) {
          pos.y = b.min.y - height; // bonk head
          vel.y = 0;
        }
      } else if (px <= pz) {
        pos.x += pos.x < (b.min.x + b.max.x) / 2 ? -px : px;
        vel.x = 0;
      } else {
        pos.z += pos.z < (b.min.z + b.max.z) / 2 ? -pz : pz;
        vel.z = 0;
      }
      // Refresh AABB after a resolve so subsequent boxes test the new position.
      min.set(pos.x - radius, pos.y, pos.z - radius);
      max.set(pos.x + radius, pos.y + height, pos.z + radius);
    }

    this._processTriggers(min, max);
    return { grounded };
  }

  _processTriggers(min, max) {
    for (const tr of this.triggers) {
      const b = tr.box;
      const overlap =
        max.x > b.min.x && min.x < b.max.x &&
        max.y > b.min.y && min.y < b.max.y &&
        max.z > b.min.z && min.z < b.max.z;
      const wasInside = tr._inside.has(0); // single local player uses key 0
      if (overlap && !wasInside) {
        tr._inside.add(0);
        tr.onEnter?.(tr);
      } else if (!overlap && wasInside) {
        tr._inside.delete(0);
        tr.onExit?.(tr);
      }
    }
  }
}
