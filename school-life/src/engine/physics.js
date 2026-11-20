// Simple, fast physics for a first-person school: axis-aligned colliders with a
// vertical range (so floors don't block each other) and ground regions (flat or ramps).

export class Physics {
  constructor(cell = 2) {
    this.cell = cell;
    this.colliders = [];
    this.grid = new Map();
    this.ground = [];
    this._cand = new Set();
  }

  addCollider(x0, z0, x1, z1, y0 = 0, y1 = 3, tag = null) {
    const c = {
      x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1),
      y0: Math.min(y0, y1), y1: Math.max(y0, y1), enabled: true, tag,
    };
    this.colliders.push(c);
    const s = this.cell;
    for (let ix = Math.floor(c.x0 / s); ix <= Math.floor(c.x1 / s); ix++) {
      for (let iz = Math.floor(c.z0 / s); iz <= Math.floor(c.z1 / s); iz++) {
        const k = ix * 73856093 ^ iz * 19349663;
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(c);
      }
    }
    return c;
  }

  addGroundFlat(x0, z0, x1, z1, y, tag = null) {
    const g = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), type: 0, y, tag };
    this.ground.push(g);
    return g;
  }

  /** Ramp: height h0 at the min edge of `axis`, h1 at the max edge. */
  addGroundRamp(x0, z0, x1, z1, axis, h0, h1, tag = null) {
    const g = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), type: axis === 'x' ? 1 : 2, h0, h1, tag };
    this.ground.push(g);
    return g;
  }

  static heightOf(g, x, z) {
    if (g.type === 0) return g.y;
    if (g.type === 1) return g.h0 + (g.h1 - g.h0) * ((x - g.x0) / (g.x1 - g.x0));
    return g.h0 + (g.h1 - g.h0) * ((z - g.z0) / (g.z1 - g.z0));
  }

  /** Highest ground under (x,z) that is not above yRef + stepUp. Returns null if none. */
  groundAt(x, z, yRef, stepUp = 0.42) {
    let best = -Infinity;
    for (let i = 0; i < this.ground.length; i++) {
      const g = this.ground[i];
      if (x < g.x0 || x > g.x1 || z < g.z0 || z > g.z1) continue;
      const h = Physics.heightOf(g, x, z);
      if (h <= yRef + stepUp && h > best) best = h;
    }
    return best === -Infinity ? null : best;
  }

  regionAt(x, z, yRef, stepUp = 0.42) {
    let best = null;
    let bh = -Infinity;
    for (const g of this.ground) {
      if (x < g.x0 || x > g.x1 || z < g.z0 || z > g.z1) continue;
      const h = Physics.heightOf(g, x, z);
      if (h <= yRef + stepUp && h > bh) { bh = h; best = g; }
    }
    return best;
  }

  candidates(x, z, r) {
    const s = this.cell;
    const set = this._cand;
    set.clear();
    for (let ix = Math.floor((x - r) / s); ix <= Math.floor((x + r) / s); ix++) {
      for (let iz = Math.floor((z - r) / s); iz <= Math.floor((z + r) / s); iz++) {
        const arr = this.grid.get(ix * 73856093 ^ iz * 19349663);
        if (arr) for (let i = 0; i < arr.length; i++) set.add(arr[i]);
      }
    }
    return set;
  }

  /** Push a vertical capsule (circle in XZ) out of colliders. Mutates pos. */
  collide(pos, radius, height, footLift = 0.3) {
    const yb = pos.y + footLift;
    const yt = pos.y + height;
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      const cand = this.candidates(pos.x, pos.z, radius + 0.1);
      for (const c of cand) {
        if (!c.enabled || c.y1 <= yb || c.y0 >= yt) continue;
        const cx = pos.x < c.x0 ? c.x0 : pos.x > c.x1 ? c.x1 : pos.x;
        const cz = pos.z < c.z0 ? c.z0 : pos.z > c.z1 ? c.z1 : pos.z;
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          const push = (radius - d) / d;
          pos.x += dx * push;
          pos.z += dz * push;
        } else {
          const l = pos.x - c.x0, r = c.x1 - pos.x, t = pos.z - c.z0, b = c.z1 - pos.z;
          const m = Math.min(l, r, t, b);
          if (m === l) pos.x = c.x0 - radius;
          else if (m === r) pos.x = c.x1 + radius;
          else if (m === t) pos.z = c.z0 - radius;
          else pos.z = c.z1 + radius;
        }
        moved = true;
        hit = true;
      }
      if (!moved) break;
    }
    return hit;
  }

  /** True if a circle at (x,z) overlaps any enabled collider in the vertical range. */
  blocked(x, z, y, radius, height, footLift = 0.3) {
    const cand = this.candidates(x, z, radius + 0.1);
    for (const c of cand) {
      if (!c.enabled || c.y1 <= y + footLift || c.y0 >= y + height) continue;
      const cx = x < c.x0 ? c.x0 : x > c.x1 ? c.x1 : x;
      const cz = z < c.z0 ? c.z0 : z > c.z1 ? c.z1 : z;
      if ((x - cx) ** 2 + (z - cz) ** 2 < radius * radius) return true;
    }
    return false;
  }
}
