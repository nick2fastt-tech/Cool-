// Doors: animated leaves with colliders. Classroom doors open with the Use button
// (NPCs open them too); exits and the principal's office are locked in the demo.
import * as THREE from 'three';
import { boxGeo } from '../engine/builder.js';
import { DOOR_H } from './layout.js';

const OPEN = 1.62; // ~93 degrees

function leafGroup(M, w, kind) {
  const g = new THREE.Group();
  const H = DOOR_H - 0.03;
  const t = kind === 'glass' ? 0.05 : 0.045;
  const add = (mat, x, y, z, sx, sy, sz, cast = true) => {
    const m = new THREE.Mesh(boxGeo(sx, sy, sz), mat);
    m.position.set(x, y, z);
    m.castShadow = false;
    m.receiveShadow = cast;
    g.add(m);
    return m;
  };
  const x0 = 0.015, x1 = w - 0.015;
  const cx = (x0 + x1) / 2, lw = x1 - x0;
  if (kind === 'glass') {
    add(M.frameDark, cx, 0.06, 0, lw, 0.12, t);
    add(M.frameDark, cx, H - 0.06, 0, lw, 0.12, t);
    add(M.frameDark, x0 + 0.05, H / 2, 0, 0.1, H, t);
    add(M.frameDark, x1 - 0.05, H / 2, 0, 0.1, H, t);
    add(M.glass, cx, H / 2, 0, lw - 0.2, H - 0.24, 0.012, false);
    add(M.chrome, x1 - 0.16, 1.05, 0.06, 0.03, 0.9, 0.03);
    add(M.chrome, x1 - 0.16, 1.05, -0.06, 0.03, 0.9, 0.03);
  } else if (kind === 'metal') {
    add(M.metalGrey, cx, H / 2, 0, lw, H, t);
    add(M.chrome, cx, 1.0, 0.06, lw - 0.2, 0.06, 0.05);
    add(M.steel, cx, 0.12, 0.026, lw - 0.06, 0.24, 0.006);
  } else {
    add(M.woodDoor, cx, H / 2, 0, lw, H, t);
    // narrow frosted window
    const wx = x0 + lw * 0.68;
    add(M.frame, wx, 1.55, 0, 0.2, 0.84, t + 0.012);
    add(M.glassFrosted, wx, 1.55, 0, 0.14, 0.76, t + 0.02, false);
    // lever handles both sides
    const hx = x1 - 0.09;
    for (const s of [1, -1]) {
      add(M.chrome, hx, 1.0, s * 0.04, 0.06, 0.06, 0.04);
      add(M.chrome, hx - 0.06, 1.0, s * 0.065, 0.14, 0.025, 0.025);
      add(M.steel, cx, 0.13, s * 0.0235, lw - 0.04, 0.26, 0.004, false);
    }
  }
  return g;
}

export class Doors {
  constructor(scene, physics, M) {
    this.scene = scene;
    this.physics = physics;
    this.M = M;
    this.list = [];
    this.audio = null;
    this.onChange = null;
  }

  create(spec) {
    const d = { spec, id: spec.id, room: spec.room, locked: spec.locked || null, leaves: [], t: 0, target: 0, idle: 0, rattle: 0, openedBy: null };
    const kind = spec.glass ? 'glass' : spec.locked === 'exit' ? 'metal' : 'wood';
    const hw = spec.w / 2;
    const defs = [];
    if (spec.double) {
      defs.push({ hingeSide: 'min', w: hw });
      defs.push({ hingeSide: 'max', w: hw });
    } else defs.push({ hingeSide: spec.hinge || 'min', w: spec.w });
    for (const def of defs) {
      let hx, hz, closed;
      if (spec.axis === 'x') {
        hz = spec.z;
        hx = def.hingeSide === 'min' ? spec.x - hw : spec.x + hw;
        closed = def.hingeSide === 'min' ? 0 : Math.PI;
      } else {
        hx = spec.x;
        hz = def.hingeSide === 'min' ? spec.z - hw : spec.z + hw;
        closed = def.hingeSide === 'min' ? -Math.PI / 2 : Math.PI / 2;
      }
      let s;
      if (spec.axis === 'x') s = -spec.into * Math.sign(Math.cos(closed));
      else s = -spec.into * Math.sign(Math.sin(closed));
      const pivot = new THREE.Group();
      pivot.position.set(hx, 0, hz);
      pivot.rotation.y = closed;
      const leaf = leafGroup(this.M, def.w, kind);
      pivot.add(leaf);
      this.scene.add(pivot);
      const L = { pivot, closed, open: closed + s * OPEN, w: def.w, hx, hz };
      // colliders: closed (across the opening) and open (along the swung leaf)
      const tipC = { x: hx + Math.cos(closed) * def.w, z: hz - Math.sin(closed) * def.w };
      L.colClosed = this.physics.addCollider(Math.min(hx, tipC.x) - 0.03, Math.min(hz, tipC.z) - 0.03, Math.max(hx, tipC.x) + 0.03, Math.max(hz, tipC.z) + 0.03, 0, DOOR_H, 'door');
      const tipO = { x: hx + Math.cos(L.open) * def.w, z: hz - Math.sin(L.open) * def.w };
      L.colOpen = this.physics.addCollider(Math.min(hx, tipO.x) - 0.04, Math.min(hz, tipO.z) - 0.04, Math.max(hx, tipO.x) + 0.04, Math.max(hz, tipO.z) + 0.04, 0, DOOR_H, 'door');
      L.colOpen.enabled = false;
      d.leaves.push(L);
    }
    d.center = { x: spec.x, y: 1.1, z: spec.z };
    this.list.push(d);
    return d;
  }

  get(id) {
    return this.list.find((d) => d.id === id);
  }

  forRoom(room) {
    return this.list.find((d) => d.room === room);
  }

  isOpen(d) {
    return d.t > 0.02 || d.target > 0;
  }

  open(d, by = 'npc') {
    if (d.locked || d.target === 1) return false;
    d.target = 1;
    d.idle = 0;
    d.openedBy = by;
    if (this.audio) this.audio.doorOpen();
    if (this.onChange) this.onChange(d);
    return true;
  }

  close(d) {
    if (d.target === 0) return false;
    d.target = 0;
    if (this.onChange) this.onChange(d);
    return true;
  }

  toggle(d) {
    if (d.locked) {
      d.rattle = 0.45;
      if (this.audio) this.audio.locked();
      return 'locked';
    }
    if (d.target === 1) {
      this.close(d);
      return 'closed';
    }
    this.open(d, 'player');
    return 'opened';
  }

  /** actors: array of {x, z} positions (player + NPCs) used for auto-close. */
  update(dt, actors) {
    for (const d of this.list) {
      const prevT = d.t;
      if (d.t !== d.target) {
        const sp = d.target > d.t ? 2.4 : 2.0;
        d.t = d.target > d.t ? Math.min(d.target, d.t + dt * sp) : Math.max(d.target, d.t - dt * sp);
        if (d.t === 0 && prevT > 0 && this.audio) this.audio.doorClose();
      }
      let wobble = 0;
      if (d.rattle > 0) {
        d.rattle = Math.max(0, d.rattle - dt);
        wobble = Math.sin(d.rattle * 60) * 0.03 * (d.rattle / 0.45);
      }
      const e = d.t < 0.5 ? 2 * d.t * d.t : 1 - Math.pow(-2 * d.t + 2, 2) / 2;
      for (const L of d.leaves) {
        L.pivot.rotation.y = L.closed + (L.open - L.closed) * e + wobble * Math.sign(L.open - L.closed);
        L.colClosed.enabled = d.t < 0.04;
        L.colOpen.enabled = d.t > 0.96;
      }
      // auto close after nobody has been near for a while
      if (d.target === 1 && d.t >= 1) {
        let near = false;
        for (let i = 0; i < actors.length; i++) {
          const a = actors[i];
          const dx = a.x - d.center.x, dz = a.z - d.center.z;
          if (dx * dx + dz * dz < 2.4 * 2.4) { near = true; break; }
        }
        d.idle = near ? 0 : d.idle + dt;
        if (d.idle > (d.openedBy === 'player' ? 12 : 5)) this.close(d);
      }
    }
  }

  /** Can this door close right now without hitting someone standing in the swing? */
  clearToClose(d, actors) {
    for (const a of actors) {
      const dx = a.x - d.center.x, dz = a.z - d.center.z;
      if (dx * dx + dz * dz < 1.2 * 1.2) return false;
    }
    return true;
  }
}
