// Use-button targets: doors, seats and fun objects. Picks what you're looking at.
import * as L from '../world/layout.js';
import { BOOK_TITLES } from './lessons.js';

export class Interactions {
  constructor(world) {
    this.items = [];
    this.grid = new Map();
    this.cell = 3;
    for (const d of world.doors.list) {
      const r = d.room;
      const zones = typeof r === 'number' ? ['corridor', 'r' + r] : r === 'office' ? ['r106'] : r === 'front' ? ['lobby'] : ['corridor'];
      this.add({ type: 'door', door: d, x: d.center.x, y: 1.1, z: d.center.z, radius: d.spec.w > 1.2 ? 0.95 : 0.55, reach: 2.4, zones });
    }
    for (const s of world.seats) {
      this.add({ type: 'seat', seat: s, x: s.x, y: s.y + s.seatH + 0.15, z: s.z, radius: s.type === 'sofa' ? 0.3 : 0.27, reach: s.type === 'aud' ? 3.8 : 2.5, zones: ['r' + s.room] });
    }
    for (const it of world.interactables) {
      const zone = L.zoneAt(it.x, it.y, it.z);
      this.add({ ...it, zones: [zone === 'office' ? 'r106' : zone] });
    }
  }

  add(it) {
    this.items.push(it);
    const k = Math.floor(it.x / this.cell) + ',' + Math.floor(it.z / this.cell);
    let a = this.grid.get(k);
    if (!a) { a = []; this.grid.set(k, a); }
    a.push(it);
  }

  /** Best target in front of the camera. cam: {x,y,z}, dir: unit vector. */
  pick(cam, dir, zone, maxAngle = 0.36) {
    const z = zone === 'office' ? 'r106' : zone;
    let best = null;
    let bestScore = Infinity;
    const cx = Math.floor(cam.x / this.cell), cz = Math.floor(cam.z / this.cell);
    for (let i = cx - 2; i <= cx + 2; i++) {
      for (let j = cz - 2; j <= cz + 2; j++) {
        const arr = this.grid.get(i + ',' + j);
        if (!arr) continue;
        for (const it of arr) {
          if (!it.zones.includes(z)) continue;
          const dx = it.x - cam.x, dy = it.y - cam.y, dz = it.z - cam.z;
          const dist = Math.hypot(dx, dy, dz);
          const flat = Math.hypot(dx, dz);
          if (flat - it.radius > it.reach) continue;
          const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / Math.max(dist, 1e-4);
          const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
          const allow = Math.atan2(it.radius, Math.max(dist, 0.3)) + maxAngle * (it.type === 'seat' ? 0.7 : 1);
          if (ang > allow) continue;
          const score = ang + dist * 0.04 + (it.type === 'seat' ? 0.05 : 0);
          if (score < bestScore) { bestScore = score; best = it; }
        }
      }
    }
    return best;
  }

  label(it, ctx) {
    switch (it.type) {
      case 'door': {
        const d = it.door;
        if (d.locked === 'exit') return 'Locked';
        if (d.locked === 'office') return "Principal's Office (locked)";
        return d.target === 1 ? 'Close door' : 'Open door';
      }
      case 'seat':
        if (it.seat.occupant && it.seat.occupant !== 'player') return 'Seat taken';
        return 'Sit down';
      default:
        return it.label || 'Use';
    }
  }

  ready(it) {
    if (it.type === 'seat') return !it.seat.occupant;
    return true;
  }

  bookTitle() {
    return BOOK_TITLES[(Math.random() * BOOK_TITLES.length) | 0];
  }
}
