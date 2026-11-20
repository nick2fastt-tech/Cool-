// The school building shell: floors, ceilings, walls, windows, lobby + grand stairs,
// the unfinished 2nd floor, corridor props and the brick exterior.
import * as THREE from 'three';
import { boxGeo, cylGeo } from '../engine/builder.js';
import * as L from './layout.js';
import { ROOMS } from '../config.js';

const H1 = L.CEIL;

/** Split a wall run [a0,a1] x [y0,y1] around openings. Returns [a,b,ya,yb] boxes. */
function segments(a0, a1, y0, y1, openings) {
  const out = [];
  const ops = openings.filter((o) => o.b > a0 && o.a < a1).sort((p, q) => p.a - q.a);
  let cur = a0;
  for (const o of ops) {
    const a = Math.max(o.a, a0);
    const b = Math.min(o.b, a1);
    if (a > cur) out.push([cur, a, y0, y1]);
    if (o.y0 > y0) out.push([a, b, y0, Math.min(o.y0, y1)]);
    if (o.y1 < y1) out.push([a, b, Math.max(o.y1, y0), y1]);
    cur = Math.max(cur, b);
  }
  if (cur < a1) out.push([cur, a1, y0, y1]);
  return out.filter((s) => s[1] - s[0] > 0.001 && s[3] - s[2] > 0.001);
}

export class SchoolBuilder {
  constructor(b, M, T) {
    this.b = b;
    this.M = M;
    this.T = T;
    this.clocks = [];
    this.lights = [];
    this.interactables = [];
    this.windowsGlass = [];
  }

  /**
   * Wall along X at z (thickness t) with per-side ranges.
   * sides.neg / sides.pos: [{a, b, zone, mat, y1?, y0?}]  (neg = -Z half, pos = +Z half)
   */
  wallX(x0, x1, z, t, y0, y1, openings, sides, collide = true) {
    const b = this.b;
    for (const [key, za, zb] of [['neg', z - t / 2, z], ['pos', z, z + t / 2]]) {
      for (const s of sides[key] || []) {
        const sy1 = s.y1 !== undefined ? s.y1 : y1;
        const sy0 = s.y0 !== undefined ? s.y0 : y0;
        for (const [a, bb, ya, yb] of segments(Math.max(s.a, x0), Math.min(s.b, x1), sy0, sy1, openings)) {
          b.box(s.mat, a, ya, za, bb, yb, zb, { zone: s.zone, cast: s.cast !== false });
        }
      }
    }
    if (collide) for (const [a, bb, ya, yb] of segments(x0, x1, y0, y1, openings)) b.physics.addCollider(a, z - t / 2, bb, z + t / 2, ya, yb, 'wall');
  }

  /** Wall along Z at x. sides.neg = -X half, sides.pos = +X half. Ranges in z. */
  wallZ(z0, z1, x, t, y0, y1, openings, sides, collide = true) {
    const b = this.b;
    for (const [key, xa, xb] of [['neg', x - t / 2, x], ['pos', x, x + t / 2]]) {
      for (const s of sides[key] || []) {
        const sy1 = s.y1 !== undefined ? s.y1 : y1;
        const sy0 = s.y0 !== undefined ? s.y0 : y0;
        for (const [a, bb, ya, yb] of segments(Math.max(s.a, z0), Math.min(s.b, z1), sy0, sy1, openings)) {
          b.box(s.mat, xa, ya, a, xb, yb, bb, { zone: s.zone, cast: s.cast !== false });
        }
      }
    }
    if (collide) for (const [a, bb, ya, yb] of segments(z0, z1, y0, y1, openings)) b.physics.addCollider(x - t / 2, a, x + t / 2, bb, ya, yb, 'wall');
  }

  /** Lower wall band + chair rail + baseboard along a straight wall face. */
  trim(zone, axis, fixed, a0, a1, facing, openings = [], { wainscot = true, h = 0.92 } = {}) {
    const { b, M } = this;
    const runs = segments(a0, a1, 0, 1, openings.map((o) => ({ ...o, y0: o.y0 > 0.5 ? 2 : 0, y1: 2 })));
    for (const [a, bb] of runs) {
      if (bb - a < 0.05) continue;
      const box = (mat, y0, y1, d0, d1, cast = false) => {
        if (axis === 'x') {
          const z0 = fixed + facing * d0, z1 = fixed + facing * d1;
          b.box(mat, a, y0, Math.min(z0, z1), bb, y1, Math.max(z0, z1), { zone, cast });
        } else {
          const x0 = fixed + facing * d0, x1 = fixed + facing * d1;
          b.box(mat, Math.min(x0, x1), y0, a, Math.max(x0, x1), y1, bb, { zone, cast });
        }
      };
      if (wainscot) {
        box(M.wallAccent, 0.1, h, 0, 0.012);
        box(M.woodMid, h, h + 0.06, 0, 0.025);
      }
      box(M.plasticBlack, 0, 0.1, 0, 0.016);
    }
  }

  ceiling(zone, x0, z0, x1, z1, y, { lights = null, mat = null } = {}) {
    const { b, M } = this;
    b.box(mat || M.ceiling, x0, y, z0, x1, y + 0.08, z1, { zone, cast: true, receive: true });
    if (lights) {
      for (const [lx, lz, w = 1.2, d = 0.6] of lights) {
        b.box(M.frame, lx - w / 2 - 0.035, y - 0.022, lz - d / 2 - 0.035, lx + w / 2 + 0.035, y, lz + d / 2 + 0.035, { zone, cast: false, faces: { py: false } });
        b.box(M.lightPanel, lx - w / 2, y - 0.03, lz - d / 2, lx + w / 2, y - 0.004, lz + d / 2, { zone, cast: false, receive: false, faces: { py: false } });
        this.lights.push({ x: lx, y: y - 0.05, z: lz, zone });
      }
    }
  }

  floor(zone, mat, x0, z0, x1, z1, y = 0) {
    this.b.box(mat, x0, y - 0.12, z0, x1, y, z1, { zone, cast: false });
  }

  picture(tex, zone, cx, cy, cz, w, h, facing, opts = {}) {
    const m = this.M.picture(tex, opts);
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -2;
    const off = 0.004;
    const d = { px: [off, 0, 0], nx: [-off, 0, 0], pz: [0, 0, off], nz: [0, 0, -off], py: [0, off, 0] }[facing];
    this.b.decal(m, cx + d[0], cy + d[1], cz + d[2], w, h, facing, { zone });
  }

  /** Poster with a thin frame. */
  poster(kind, zone, cx, cy, cz, facing, w = 0.62, h = 0.85) {
    const tex = this.T.posterTex(kind);
    const { b, M } = this;
    const d = 0.015;
    const n = { px: [1, 0], nx: [-1, 0], pz: [0, 1], nz: [0, -1] }[facing];
    if (n[0] !== 0) b.box(M.black, cx, cy - h / 2 - 0.02, cz - w / 2 - 0.02, cx + n[0] * d, cy + h / 2 + 0.02, cz + w / 2 + 0.02, { zone, cast: false });
    else b.box(M.black, cx - w / 2 - 0.02, cy - h / 2 - 0.02, cz, cx + w / 2 + 0.02, cy + h / 2 + 0.02, cz + n[1] * d, { zone, cast: false });
    this.picture(tex, zone, cx + n[0] * d, cy, cz + n[1] * d, w, h, facing);
  }

  clock(zone, x, y, z, facing) {
    const { b, M } = this;
    const n = { px: [1, 0, 0], nx: [-1, 0, 0], pz: [0, 0, 1], nz: [0, 0, -1] }[facing];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], 0, n[2]));
    m.compose(new THREE.Vector3(x + n[0] * 0.03, y, z + n[2] * 0.03), q, new THREE.Vector3(1, 1, 1));
    b.geom(M.black, cylGeo(0.2, 0.2, 0.06, 28), m, { zone, cast: false });
    this.picture(this.T.clockFaceTex, zone, x + n[0] * 0.061, y, z + n[2] * 0.061, 0.36, 0.36, facing, { rough: 0.3 });
    this.clocks.push({ x: x + n[0] * 0.075, y, z: z + n[2] * 0.075, nx: n[0], nz: n[2], zone });
  }

  /** A real window opening's inside parts (frame, glass, sill, blinds) on an X-aligned wall. */
  windowX(zone, x0, x1, zWall, y0, y1, inward, { blinds = true, outerZone = 'exterior', t = 0.3 } = {}) {
    const { b, M } = this;
    const zIn = zWall; // inner face
    const zOut = zWall - inward * t;
    const fz0 = Math.min(zIn, zOut), fz1 = Math.max(zIn, zOut);
    const f = 0.06;
    b.box(M.frame, x0, y0, fz0, x1, y0 + f, fz1, { zone, cast: true });
    b.box(M.frame, x0, y1 - f, fz0, x1, y1, fz1, { zone, cast: true });
    b.box(M.frame, x0, y0, fz0, x0 + f, y1, fz1, { zone, cast: true });
    b.box(M.frame, x1 - f, y0, fz0, x1, y1, fz1, { zone, cast: true });
    const mx = (x0 + x1) / 2;
    b.box(M.frame, mx - 0.03, y0, fz0 + 0.06, mx + 0.03, y1, fz1 - 0.06, { zone, cast: true });
    const gz = zWall - inward * t * 0.5;
    b.box(M.glass, x0 + f, y0 + f, gz - 0.006, x1 - f, y1 - f, gz + 0.006, { zone, cast: false, receive: false });
    // inner sill
    b.box(M.plasticWhite, x0 - 0.06, y0 - 0.04, Math.min(zIn, zIn + inward * 0.16), x1 + 0.06, y0 + 0.01, Math.max(zIn, zIn + inward * 0.16), { zone, cast: true });
    // outer sill
    b.box(M.concrete, x0 - 0.05, y0 - 0.08, Math.min(zOut, zOut - inward * 0.06), x1 + 0.05, y0, Math.max(zOut, zOut - inward * 0.06), { zone: outerZone, cast: true });
    if (blinds) {
      const bz = zIn + inward * 0.05;
      b.box(M.blinds, x0 + 0.02, y1 - 0.42, Math.min(bz, bz + inward * 0.012), x1 - 0.02, y1 - 0.02, Math.max(bz, bz + inward * 0.012), { zone, cast: true });
      b.box(M.frame, x0 + 0.02, y1 - 0.06, Math.min(bz, bz + inward * 0.05), x1 - 0.02, y1, Math.max(bz, bz + inward * 0.05), { zone, cast: false });
    }
  }

  windowZ(zone, z0, z1, xWall, y0, y1, inward, { blinds = true, outerZone = 'exterior', t = 0.3 } = {}) {
    const { b, M } = this;
    const xIn = xWall;
    const xOut = xWall - inward * t;
    const fx0 = Math.min(xIn, xOut), fx1 = Math.max(xIn, xOut);
    const f = 0.06;
    b.box(M.frame, fx0, y0, z0, fx1, y0 + f, z1, { zone });
    b.box(M.frame, fx0, y1 - f, z0, fx1, y1, z1, { zone });
    b.box(M.frame, fx0, y0, z0, fx1, y1, z0 + f, { zone });
    b.box(M.frame, fx0, y0, z1 - f, fx1, y1, z1, { zone });
    const mz = (z0 + z1) / 2;
    b.box(M.frame, fx0 + 0.06, y0, mz - 0.03, fx1 - 0.06, y1, mz + 0.03, { zone });
    const gx = xWall - inward * t * 0.5;
    b.box(M.glass, gx - 0.006, y0 + f, z0 + f, gx + 0.006, y1 - f, z1 - f, { zone, cast: false, receive: false });
    b.box(M.plasticWhite, Math.min(xIn, xIn + inward * 0.16), y0 - 0.04, z0 - 0.06, Math.max(xIn, xIn + inward * 0.16), y0 + 0.01, z1 + 0.06, { zone });
    b.box(M.concrete, Math.min(xOut, xOut - inward * 0.06), y0 - 0.08, z0 - 0.05, Math.max(xOut, xOut - inward * 0.06), y0, z1 + 0.05, { zone: outerZone });
    if (blinds) {
      const bx = xIn + inward * 0.05;
      b.box(M.blinds, Math.min(bx, bx + inward * 0.012), y1 - 0.42, z0 + 0.02, Math.max(bx, bx + inward * 0.012), y1 - 0.02, z1 - 0.02, { zone });
    }
  }

  /** Facade-only window picture (for unbuilt floors / closed rooms). */
  fakeWindow(kind, x, y, z, facing, w = 1.8, h = 1.5) {
    const { b, M } = this;
    const n = { px: [1, 0], nx: [-1, 0], pz: [0, 1], nz: [0, -1] }[facing];
    const tex = kind === 'plastic' ? this.T.windowPlasticTex : this.T.windowBlindsTex;
    // recess frame
    if (n[0] === 0) b.box(M.concrete, x - w / 2 - 0.05, y - h / 2 - 0.1, z, x + w / 2 + 0.05, y - h / 2 - 0.02, z + n[1] * 0.08, { zone: 'exterior' });
    else b.box(M.concrete, x, y - h / 2 - 0.1, z - w / 2 - 0.05, x + n[0] * 0.08, y - h / 2 - 0.02, z + w / 2 + 0.05, { zone: 'exterior' });
    this.picture(tex, 'exterior', x, y, z, w, h, facing, { rough: 0.25 });
  }

  /** Door frame (both faces) for an opening. */
  doorFrame(d, t = 0.2) {
    const { b, M } = this;
    const hw = d.w / 2, ft = 0.06, H = L.DOOR_H;
    const mat = d.glass ? M.frameDark : M.frame;
    if (d.axis === 'x') {
      const z0 = d.z - t / 2 - 0.02, z1 = d.z + t / 2 + 0.02;
      b.box(mat, d.x - hw - ft, 0, z0, d.x - hw, H + ft, z1, { zone: 'global' });
      b.box(mat, d.x + hw, 0, z0, d.x + hw + ft, H + ft, z1, { zone: 'global' });
      b.box(mat, d.x - hw - ft, H, z0, d.x + hw + ft, H + ft, z1, { zone: 'global' });
    } else {
      const x0 = d.x - t / 2 - 0.02, x1 = d.x + t / 2 + 0.02;
      b.box(mat, x0, 0, d.z - hw - ft, x1, H + ft, d.z - hw, { zone: 'global' });
      b.box(mat, x0, 0, d.z + hw, x1, H + ft, d.z + hw + ft, { zone: 'global' });
      b.box(mat, x0, H, d.z - hw - ft, x1, H + ft, d.z + hw + ft, { zone: 'global' });
    }
  }

  // ===================================================================== build
  build() {
    this.floorsAndCeilings();
    this.corridorWalls();
    this.northRoomsShell();
    this.southShell();
    this.exteriorWalls();
    this.lobby();
    this.secondFloor();
    this.corridorProps();
    this.roof();
    this.groundRegions();
    for (const d of L.DOORS) this.doorFrame(d, d.room === 'exit' || d.room === 'front' ? 0.3 : 0.2);
  }

  floorsAndCeilings() {
    const { M } = this;
    // corridor
    this.floor('corridor', M.floorTile, 0, -2, 60, 2);
    const corLights = [];
    for (let x = 2.5; x < 59; x += 3.2) corLights.push([x, 0, 1.2, 0.6]);
    this.ceiling('corridor', 0, -2, 60, 2, H1, { lights: corLights });
    // accent stripes
    const stripe = this.M.navy;
    for (const z of [-1.3, 1.3]) this.b.box(stripe, 0.3, 0, z - 0.09, 59.7, 0.004, z + 0.09, { zone: 'corridor', cast: false });
    // north classrooms
    for (const r of L.NORTH_ROOMS) {
      const zone = 'r' + r.id;
      this.floor(zone, M.floorTile, r.x0, -11, r.x1, -2);
      const lights = [];
      for (const lx of [r.x0 + 2.6, r.x0 + 5.2, r.x0 + 7.8]) for (const lz of [-8.7, -4.6]) lights.push([lx, lz, 0.6, 1.2]);
      this.ceiling(zone, r.x0, -11, r.x1, -2, H1, { lights });
    }
    // science
    this.floor('r104', M.floorTile, L.SCI.x0, 2, L.SCI.x1, 11);
    const sl = [];
    for (const lx of [36.4, 39, 41.6]) for (const lz of [4.4, 8.6]) sl.push([lx, lz, 0.6, 1.2]);
    this.ceiling('r104', L.SCI.x0, 2, L.SCI.x1, 11, H1, { lights: sl });
    // library
    this.floor('r106', M.carpetBlue, L.LIB.x0, 2, L.LIB.x1, 20);
    const ll = [];
    for (const lx of [48.5, 52, 55.5, 58.5]) for (const lz of [4.5, 8.5, 12.5]) ll.push([lx, lz, 1.2, 0.6]);
    for (const lx of [48.5, 52]) ll.push([lx, 17.5, 1.2, 0.6]);
    ll.push([57, 17.5, 1.2, 0.6]);
    this.ceiling('r106', L.LIB.x0, 2, L.LIB.x1, 20, L.LIB.ceil, { lights: ll });
  }

  corridorWalls() {
    const { M } = this;
    const doorOps = (z) => L.DOORS.filter((d) => d.axis === 'x' && d.z === z).map((d) => ({ a: d.x - d.w / 2, b: d.x + d.w / 2, y0: 0, y1: L.DOOR_H }));
    // north corridor wall (z=-2)
    const nOps = doorOps(-2);
    this.wallX(0, 60, -2, 0.2, 0, H1 + 0.1, nOps, {
      pos: [{ a: 0, b: 60, zone: 'corridor', mat: M.wall }],
      neg: L.NORTH_ROOMS.map((r) => ({ a: r.x0, b: r.x1, zone: 'r' + r.id, mat: M.wall })),
    });
    // south corridor wall (z=2) with the lobby opening (20..32)
    const sOps = doorOps(2);
    this.wallX(0, 20, 2, 0.2, 0, L.AUD.ceil + 0.05, sOps, {
      neg: [{ a: 0, b: 20, zone: 'corridor', mat: M.wall, y1: H1 + 0.1 }],
      pos: [{ a: 0, b: 18, zone: 'r102', mat: M.plasterDark, y0: -1.1 }],
    });
    this.wallX(32, 60, 2, 0.2, 0, H1 + 0.7, sOps, {
      neg: [{ a: 32, b: 60, zone: 'corridor', mat: M.wall, y1: H1 + 0.1 }],
      pos: [
        { a: 34, b: 44, zone: 'r104', mat: M.wall, y1: H1 + 0.1 },
        { a: 46, b: 60, zone: 'r106', mat: M.wallWarm, y1: L.LIB.ceil + 0.1 },
      ],
    });
    // lobby-side returns of the corridor wall at the opening edges
    this.b.box(M.wall, 19.9, 0, 1.9, 20.1, H1, 2.1, { zone: 'corridor' });
    this.b.box(M.wall, 31.9, 0, 1.9, 32.1, H1, 2.1, { zone: 'corridor' });
    // trims along corridor
    this.trim('corridor', 'x', -1.9, 0, 60, 1, nOps, { wainscot: false });
    this.trim('corridor', 'x', 1.9, 0, 20, -1, sOps, { wainscot: false });
    this.trim('corridor', 'x', 1.9, 32, 60, -1, sOps, { wainscot: false });
  }

  northRoomsShell() {
    const { M } = this;
    for (const r of L.NORTH_ROOMS) {
      const zone = 'r' + r.id;
      this.wallZ(-11, -2, r.x0, 0.2, 0, H1 + 0.1, [], { pos: [{ a: -11, b: -2, zone, mat: M.wall }] });
      this.wallZ(-11, -2, r.x1, 0.2, 0, H1 + 0.1, [], { neg: [{ a: -11, b: -2, zone, mat: M.wall }] });
      const dOps = [{ a: r.door - L.DOOR_W / 2, b: r.door + L.DOOR_W / 2, y0: 0, y1: L.DOOR_H }];
      this.trim(zone, 'x', -2.1, r.x0 + 0.1, r.x1 - 0.1, -1, dOps);
      this.trim(zone, 'z', r.x0 + 0.1, -11, -2.1, 1);
      this.trim(zone, 'z', r.x1 - 0.1, -11, -2.1, -1);
      const wOps = [r.x0 + 2.5, r.x0 + 5, r.x0 + 7.5].map((c) => ({ a: c - 0.9, b: c + 0.9, y0: 1.0, y1: 2.6 }));
      this.trim(zone, 'x', -11, r.x0 + 0.1, r.x1 - 0.1, 1, wOps);
    }
  }

  southShell() {
    const { M } = this;
    // Auditorium side walls
    this.wallZ(2, 20, 18, 0.2, -1.1, L.AUD.ceil + 0.05, [], { neg: [{ a: 2, b: 20, zone: 'r102', mat: M.plasterDark }] });
    // Lobby side walls (double height)
    this.wallZ(2, 20, 20, 0.2, 0, L.ROOF + 0.05, [], { pos: [{ a: 2, b: 20, zone: 'lobby', mat: M.wall }] });
    this.wallZ(2, 20, 32, 0.2, 0, L.ROOF + 0.05, [], { neg: [{ a: 2, b: 20, zone: 'lobby', mat: M.wall }] });
    // Science side walls
    this.wallZ(2, 11, 34, 0.2, 0, H1 + 0.1, [], { pos: [{ a: 2, b: 11, zone: 'r104', mat: M.wall }] });
    this.wallZ(2, 11, 44, 0.2, 0, H1 + 0.1, [], { neg: [{ a: 2, b: 11, zone: 'r104', mat: M.wall }] });
    this.trim('r104', 'z', 34.1, 2.1, 11, 1);
    this.trim('r104', 'z', 43.9, 2.1, 11, -1);
    this.trim('r104', 'x', 2.1, 34.1, 43.9, 1, [{ a: L.SCI.door - L.DOOR_W / 2, b: L.SCI.door + L.DOOR_W / 2, y0: 0, y1: 2 }]);
    // Science south wall (to courtyard) with windows
    const sciWin = [36.5, 39, 41.5].map((c) => ({ a: c - 0.9, b: c + 0.9, y0: 1.0, y1: 2.6 }));
    this.wallX(34, 44, 11.15, 0.3, 0, L.ROOF + 1.0, sciWin, {
      neg: [{ a: 34.1, b: 43.9, zone: 'r104', mat: M.wall, y1: H1 + 0.1 }],
      pos: [{ a: 33.7, b: 44.3, zone: 'exterior', mat: M.brick }],
    });
    this.trim('r104', 'x', 11, 34.1, 43.9, -1, sciWin);
    for (const c of [36.5, 39, 41.5]) this.windowX('r104', c - 0.9, c + 0.9, 11, 1.0, 2.6, -1);
    // Library west wall
    this.wallZ(2, 20, 46, 0.2, 0, L.LIB.ceil + 0.1, [], { pos: [{ a: 2, b: 20, zone: 'r106', mat: M.wallWarm }] });
    this.trim('r106', 'z', 46.1, 2.1, 20, 1, [], { wainscot: true });
    this.trim('r106', 'x', 2.1, 46.1, 60, 1, [{ a: L.LIB.door - 0.95, b: L.LIB.door + 0.95, y0: 0, y1: 2 }]);
    // Principal's office walls (inside library)
    const O = L.OFFICE;
    const offDoor = { a: O.doorZ - L.DOOR_W / 2, b: O.doorZ + L.DOOR_W / 2, y0: 0, y1: L.DOOR_H };
    const offWin = { a: 17.9, b: 19.5, y0: 1.0, y1: 2.3 };
    this.wallZ(O.z0, 20, O.x0, 0.16, 0, L.LIB.ceil + 0.05, [offDoor, offWin], {
      neg: [{ a: O.z0, b: 20, zone: 'r106', mat: M.wallWarm }],
      pos: [{ a: O.z0, b: 20, zone: 'r106', mat: M.plasterGreen }],
    });
    const offWin2 = { a: 55.6, b: 58.6, y0: 1.0, y1: 2.3 };
    this.wallX(O.x0 - 0.08, 60, O.z0, 0.16, 0, L.LIB.ceil + 0.05, [offWin2], {
      neg: [{ a: O.x0 - 0.08, b: 60, zone: 'r106', mat: M.wallWarm }],
      pos: [{ a: O.x0, b: 60, zone: 'r106', mat: M.plasterGreen }],
    });
    // interior office windows (glass both sides)
    const b = this.b;
    b.box(M.glass, O.x0 - 0.005, 1.0, offWin.a, O.x0 + 0.005, 2.3, offWin.b, { zone: 'r106', cast: false, receive: false });
    b.box(M.frame, O.x0 - 0.09, 0.97, offWin.a - 0.04, O.x0 + 0.09, 1.0, offWin.b + 0.04, { zone: 'r106' });
    b.box(M.frame, O.x0 - 0.09, 2.3, offWin.a - 0.04, O.x0 + 0.09, 2.33, offWin.b + 0.04, { zone: 'r106' });
    b.box(M.glass, offWin2.a, 1.0, O.z0 - 0.005, offWin2.b, 2.3, O.z0 + 0.005, { zone: 'r106', cast: false, receive: false });
    b.box(M.frame, offWin2.a - 0.04, 0.97, O.z0 - 0.09, offWin2.b + 0.04, 1.0, O.z0 + 0.09, { zone: 'r106' });
    b.box(M.frame, offWin2.a - 0.04, 2.3, O.z0 - 0.09, offWin2.b + 0.04, 2.33, O.z0 + 0.09, { zone: 'r106' });
    // office blinds half-down (privacy!)
    b.box(M.blinds, O.x0 + 0.06, 1.55, offWin.a + 0.02, O.x0 + 0.075, 2.28, offWin.b - 0.02, { zone: 'r106' });
    b.box(M.blinds, offWin2.a + 0.02, 1.7, O.z0 + 0.06, offWin2.b - 0.02, 2.28, O.z0 + 0.075, { zone: 'r106' });
  }

  exteriorWalls() {
    const { M } = this;
    const top = L.ROOF + 1.0; // parapet top
    // ---- north facade z=-11 (wall z -11.3..-11)
    const nWin = [];
    for (const r of L.NORTH_ROOMS) for (const c of [r.x0 + 2.5, r.x0 + 5, r.x0 + 7.5]) nWin.push({ a: c - 0.9, b: c + 0.9, y0: 1.0, y1: 2.6, c, room: r.id });
    this.wallX(-0.3, 60.3, -11.15, 0.3, 0, top, nWin, {
      pos: L.NORTH_ROOMS.map((r) => ({ a: r.x0 + 0.1, b: r.x1 - 0.1, zone: 'r' + r.id, mat: M.wall, y1: H1 + 0.1 })),
      neg: [{ a: -0.3, b: 60.3, zone: 'exterior', mat: M.brick }],
    });
    for (const w of nWin) this.windowX('r' + w.room, w.a, w.b, -11, 1.0, 2.6, 1);
    for (const x of [26, 29, 32.5, 49, 52.5, 56]) this.fakeWindow('blinds', x, 1.8, -11.3, 'nz');
    for (let x = 4; x <= 57; x += 3.8) this.fakeWindow('plastic', x, 5.6, -11.3, 'nz');

    // ---- west facade x=0 (wall x -0.3..0)
    const west = L.DOORS.find((d) => d.id === 'dWest');
    const wOps = [{ a: west.z - west.w / 2, b: west.z + west.w / 2, y0: 0, y1: L.DOOR_H }, { a: -0.9, b: 0.9, y0: 2.45, y1: 3.15 }];
    this.wallZ(-11.3, 20.3, -0.15, 0.3, -1.1, top, wOps, {
      pos: [
        { a: -1.9, b: 1.9, zone: 'corridor', mat: M.wall, y0: 0, y1: H1 + 0.1 },
        { a: 2.1, b: 20, zone: 'r102', mat: M.plasterDark, y1: L.AUD.ceil + 0.05 },
      ],
      neg: [{ a: -11.3, b: 20.3, zone: 'exterior', mat: M.brick, y0: 0 }],
    });
    this.windowZ('corridor', -0.9, 0.9, 0, 2.45, 3.15, 1, { blinds: false });
    for (let z = -8; z <= 18; z += 4) this.fakeWindow('plastic', -0.3, 5.6, z, 'nx');

    // ---- east facade x=60 (wall 60..60.3)
    const east = L.DOORS.find((d) => d.id === 'dEast');
    const libE = [{ a: 4.0, b: 6.4 }, { a: 9.6, b: 12.0 }];
    const eOps = [
      { a: east.z - east.w / 2, b: east.z + east.w / 2, y0: 0, y1: L.DOOR_H },
      { a: -0.9, b: 0.9, y0: 2.45, y1: 3.15 },
      ...libE.map((w) => ({ ...w, y0: 1.0, y1: 2.8 })),
    ];
    this.wallZ(-11.3, 20.3, 60.15, 0.3, 0, top, eOps, {
      neg: [
        { a: -1.9, b: 1.9, zone: 'corridor', mat: M.wall, y1: H1 + 0.1 },
        { a: 2.1, b: 20, zone: 'r106', mat: M.wallWarm, y1: L.LIB.ceil + 0.1 },
      ],
      pos: [{ a: -11.3, b: 20.3, zone: 'exterior', mat: M.brick }],
    });
    this.windowZ('corridor', -0.9, 0.9, 60, 2.45, 3.15, -1, { blinds: false });
    for (const w of libE) this.windowZ('r106', w.a, w.b, 60, 1.0, 2.8, -1);
    for (let z = -8; z <= 18; z += 4) if (Math.abs(z) > 1.5) this.fakeWindow('plastic', 60.3, 5.6, z, 'px');
    this.fakeWindow('blinds', 60.3, 1.8, -6.5, 'px');

    // ---- south facade z=20 (wall 20..20.3), lobby is a glass curtain wall
    const libS = [{ a: 47.4, b: 49.8 }, { a: 50.6, b: 53.0 }, { a: 55.8, b: 58.2 }];
    const sOps = [
      { a: 20, b: 32, y0: 0, y1: 7.2 },
      { a: 34, b: 44, y0: 1.0, y1: top + 1 },
      ...libS.map((w) => ({ ...w, y0: 1.0, y1: 2.8 })),
    ];
    this.wallX(-0.3, 60.3, 20.15, 0.3, -1.1, top, sOps, {
      neg: [
        { a: 0, b: 17.9, zone: 'r102', mat: M.plasterDark, y1: L.AUD.ceil + 0.05 },
        { a: 46.1, b: 60, zone: 'r106', mat: M.wallWarm, y0: 0, y1: L.LIB.ceil + 0.1 },
      ],
      pos: [{ a: -0.3, b: 60.3, zone: 'exterior', mat: M.brick, y0: 0 }],
    });
    for (const w of libS) this.windowX('r106', w.a, w.b, 20, 1.0, 2.8, -1);
    for (const x of [48.6, 51.8, 57]) this.fakeWindow('plastic', x, 5.6, 20.3, 'pz');
    // courtyard: brick side walls + low wall + fence
    const b = this.b;
    b.box(M.brick, 33.7, 0, 11.3, 34.0, top, 20.3, { zone: 'exterior', collide: true });
    b.box(M.brick, 44.0, 0, 11.3, 44.3, top, 20.3, { zone: 'exterior', collide: true });
    for (let z = 13; z <= 19; z += 3) {
      this.fakeWindow('blinds', 34.0, 1.8, z, 'px', 1.4, 1.3);
      this.fakeWindow('blinds', 44.0, 1.8, z, 'nx', 1.4, 1.3);
    }
    for (let x = 34.5; x <= 43.6; x += 0.9) b.box(M.frameDark, x - 0.03, 1.0, 20.12, x + 0.03, 2.1, 20.18, { zone: 'exterior' });
    b.box(M.frameDark, 34, 2.05, 20.11, 44, 2.11, 20.19, { zone: 'exterior' });
    b.box(M.frameDark, 34, 1.5, 20.12, 44, 1.54, 20.18, { zone: 'exterior' });
    // big mural on the auditorium facade
    this.picture(this.T.facadeSignTex, 'exterior', 9, 4.4, 20.3, 13, 1.6, 'pz', { rough: 0.6, transparent: true });
    this.picture(this.T.auditoriumWordTex, 'exterior', 9, 2.4, 20.3, 9, 1.1, 'pz', { rough: 0.6, transparent: true });
  }

  lobby() {
    const { b, M, T } = this;
    const LB = L.LOBBY;
    this.floor('lobby', M.terrazzo, LB.x0, 2, LB.x1, 20);
    this.picture(T.emblemTex, 'lobby', 26, 0.002, 11.6, 4.6, 4.6, 'py', { rough: 0.35, transparent: true });
    // atrium ceiling + pendant lights
    b.box(M.plaster, LB.x0, L.ROOF - 0.05, LB.balconyZ, LB.x1, L.ROOF + 0.05, 20, { zone: 'lobby' });
    for (const [px, pz] of [[24, 9], [28, 9], [24, 15], [28, 15]]) {
      b.box(M.metalDark, px - 0.015, 6.0, pz - 0.015, px + 0.015, L.ROOF - 0.05, pz + 0.015, { zone: 'lobby', cast: false });
      const m = new THREE.Matrix4().makeTranslation(px, 5.9, pz);
      b.geom(M.metalDark, cylGeo(0.12, 0.55, 0.32, 24, true), m, { zone: 'lobby', cast: false });
      b.geom(M.lampGlow, new THREE.CircleGeometry(0.53, 24).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(px, 5.75, pz), { zone: 'lobby', cast: false });
      this.lights.push({ x: px, y: 5.7, z: pz, zone: 'lobby', warm: true });
    }
    // balcony slab (underside = lobby ceiling below)
    b.box(M.plaster, LB.x0 + 0.1, H1, 2, LB.x1 - 0.1, L.FLOOR2_Y - 0.02, LB.balconyZ, { zone: 'lobby', collide: false });
    b.box(M.terrazzo, LB.x0 + 0.1, L.FLOOR2_Y - 0.02, 2, LB.x1 - 0.1, L.FLOOR2_Y, LB.balconyZ, { zone: 'floor2', cast: false });
    for (const lx of [24.5, 27.5, 30.5]) {
      b.box(M.lightPanel, lx - 0.6, H1 - 0.03, 3.6, lx + 0.6, H1, 4.2, { zone: 'lobby', cast: false, receive: false });
      this.lights.push({ x: lx, y: H1 - 0.05, z: 3.9, zone: 'lobby' });
    }
    b.box(M.plasterDark, LB.x0 + 0.1, H1, LB.balconyZ, LB.x1 - 0.1, L.FLOOR2_Y, LB.balconyZ + 0.02, { zone: 'lobby' });
    // ---- grand staircase (24 steps)
    const steps = 24, rise = L.FLOOR2_Y / steps, run = (LB.stairZBot - LB.stairZTop) / steps;
    for (let i = 0; i < steps; i++) {
      const zf = LB.stairZBot - i * run;
      b.box(M.terrazzo, LB.stairX0, 0, zf - run, LB.stairX1, (i + 1) * rise, zf, { zone: 'lobby', faces: { nx: false } });
      b.box(M.metalDark, LB.stairX0, (i + 1) * rise - 0.02, zf - 0.03, LB.stairX1, (i + 1) * rise + 0.002, zf + 0.002, { zone: 'lobby', cast: false });
    }
    // stringer (side face of the stair block)
    b.box(M.plaster, LB.stairX1, 0, LB.stairZTop, LB.stairX1 + 0.04, L.FLOOR2_Y - 0.1, LB.stairZBot - 3.4, { zone: 'lobby' });
    // floor-1 blocker at the stair top end (under the balcony)
    b.physics.addCollider(LB.stairX0, LB.stairZTop - 0.2, LB.stairX1, LB.stairZTop, 0, H1, 'stairs');
    // stair railing (glass + sloped handrail) on the open side
    const rx = LB.stairX1 + 0.02;
    const len = Math.hypot(LB.stairZBot - LB.stairZTop, L.FLOOR2_Y);
    const ang = Math.atan2(L.FLOOR2_Y, LB.stairZBot - LB.stairZTop);
    const midZ = (LB.stairZBot + LB.stairZTop) / 2, midY = L.FLOOR2_Y / 2;
    const rail = (mat, w, h, off, depth) => {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(rx, midY + off, midZ),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(ang, 0, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      b.geom(mat, boxGeo(depth, h, w), m, { zone: 'lobby', cast: mat !== M.glass, receive: mat !== M.glass });
    };
    rail(M.glass, len - 0.3, 0.9, 0.55, 0.02);
    rail(M.steel, len - 0.2, 0.05, 1.05, 0.06);
    b.physics.addCollider(rx - 0.08, LB.stairZTop, rx + 0.08, LB.stairZBot - 0.45, -1, 6, 'rail');
    for (let k = 0; k <= 6; k++) {
      const z = LB.stairZTop + 0.2 + k * ((LB.stairZBot - LB.stairZTop - 0.6) / 6);
      const yb = (L.FLOOR2_Y * (LB.stairZBot - z)) / (LB.stairZBot - LB.stairZTop);
      b.box(M.steel, rx - 0.025, yb, z - 0.025, rx + 0.025, yb + 1.05, z + 0.025, { zone: 'lobby' });
    }
    // balcony railing along z = 5.8
    const by = L.FLOOR2_Y;
    b.box(M.glass, LB.stairX1, by, LB.balconyZ - 0.01, LB.x1 - 0.1, by + 1.0, LB.balconyZ + 0.01, { zone: 'floor2', cast: false, receive: false });
    b.box(M.steel, LB.stairX1, by + 1.0, LB.balconyZ - 0.03, LB.x1 - 0.1, by + 1.06, LB.balconyZ + 0.03, { zone: 'floor2' });
    for (let x = LB.stairX1; x <= LB.x1 - 0.1; x += 1.6) b.box(M.steel, x - 0.025, by, LB.balconyZ - 0.025, x + 0.025, by + 1.0, LB.balconyZ + 0.025, { zone: 'floor2' });
    b.physics.addCollider(LB.stairX1 - 0.05, LB.balconyZ - 0.08, LB.x1, LB.balconyZ + 0.08, H1 + 0.1, 7, 'rail');
    // ---- glass curtain wall + entrance
    const zW = 20.15;
    for (let x = 20.0; x <= 32.01; x += 2) b.box(M.frameDark, x - 0.06, 0, zW - 0.12, x + 0.06, 7.2, zW + 0.12, { zone: 'exterior' });
    for (const y of [0, 2.55, 5.0, 7.1]) b.box(M.frameDark, 20, y, zW - 0.1, 32, y + 0.1, zW + 0.1, { zone: 'exterior' });
    const door = L.DOORS.find((d) => d.id === 'dFront');
    const dx0 = door.x - door.w / 2, dx1 = door.x + door.w / 2;
    const glassPanes = [[20.06, dx0 - 0.06, 0.1, 2.55], [dx1 + 0.06, 31.94, 0.1, 2.55], [20.06, 31.94, 2.65, 5.0], [20.06, 31.94, 5.1, 7.1]];
    for (const [a, c, y0, y1] of glassPanes) b.box(M.glass, a, y0, zW - 0.008, c, y1, zW + 0.008, { zone: 'exterior', cast: false, receive: false });
    b.physics.addCollider(20, 19.9, 32, 20.4, 0, 7.2, 'glass');
    // canopy + sign
    b.box(M.concrete, 21.4, 3.0, 20.3, 30.6, 3.32, 24.2, { zone: 'exterior' });
    b.box(M.navy, 21.4, 3.32, 24.1, 30.6, 3.9, 24.3, { zone: 'exterior' });
    this.picture(T.canopySignTex, 'exterior', 26, 3.61, 24.3, 8.8, 0.55, 'pz', { rough: 0.5, emissive: 0.15, transparent: true });
    for (const x of [22.0, 30.0]) {
      const m = new THREE.Matrix4().makeTranslation(x, 1.5, 23.7);
      b.geom(M.white, cylGeo(0.16, 0.16, 3.0, 16), m, { zone: 'exterior', collide: true });
    }
    for (const [lx, lz] of [[24, 22], [28, 22]]) b.geom(M.outdoorGlow, new THREE.CircleGeometry(0.22, 16).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(lx, 2.99, lz), { zone: 'exterior', cast: false });
    // ---- furnishings
    this.picture(T.welcomeBannerTex, 'corridor', 28, 2.88, -1.9, 7.2, 0.8, 'pz', { rough: 0.6 });
    this.picture(T.muralTex, 'lobby', LB.x0 + 0.1, 5.6, 13.5, 8, 1.4, 'px', { rough: 0.7 });
    this.picture(T.directoryTex, 'lobby', LB.x1 - 0.1, 1.65, 6.6, 0.8, 1.2, 'nx', { rough: 0.5 });
    b.box(M.navy, LB.x1 - 0.12, 0.98, 6.12, LB.x1 - 0.1, 2.32, 7.08, { zone: 'lobby', cast: false });
    this.clock('lobby', LB.x1 - 0.1, 3.0, 11.6, 'nx');
    for (const z0 of [8.6, 13.4]) this.bench('lobby', LB.x1 - 0.55, z0, 'z');
    for (const [px, pz] of [[21.0, 18.9], [31.0, 18.9], [31.2, 3.0]]) this.planter('lobby', px, pz, 0.38, 1.6);
    // trophy case on the north corridor wall facing the lobby
    this.trophyCase(24.6, 31.4);
  }

  bench(zone, x, z0, axis) {
    const { b, M } = this;
    const len = 2.2;
    for (let k = 0; k < 4; k++) {
      if (axis === 'z') b.box(M.woodMid, x - 0.25 + k * 0.13, 0.44, z0, x - 0.25 + k * 0.13 + 0.11, 0.48, z0 + len, { zone });
    }
    for (const dz of [0.15, len - 0.15]) b.box(M.metalDark, x - 0.24, 0, z0 + dz - 0.03, x + 0.26, 0.44, z0 + dz + 0.03, { zone });
    b.physics.addCollider(x - 0.27, z0, x + 0.27, z0 + len, 0, 0.5, 'bench');
  }

  planter(zone, x, z, r, h) {
    const { b, M } = this;
    b.geom(M.ceramic, cylGeo(r, r * 0.8, 0.6, 16), new THREE.Matrix4().makeTranslation(x, 0.3, z), { zone, collide: true });
    b.geom(M.soil, new THREE.CircleGeometry(r * 0.92, 16).rotateX(-Math.PI / 2), new THREE.Matrix4().makeTranslation(x, 0.58, z), { zone, cast: false });
    const leaf = new THREE.IcosahedronGeometry(1, 1);
    const rand = (k) => Math.abs(Math.sin(x * 12.9898 + z * 78.233 + k * 37.719)) % 1;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rr = k === 0 ? 0 : r * 0.55;
      const s = 0.22 + rand(k) * 0.12;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x + Math.cos(a) * rr, 0.6 + h * (0.45 + rand(k + 9) * 0.45), z + Math.sin(a) * rr),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(k + 3), rand(k + 5) * 3, 0)),
        new THREE.Vector3(s, s * 1.5, s),
      );
      b.geom(k % 2 ? M.plantDark : M.plantGreen, leaf, m, { zone });
    }
    b.box(M.woodDark, x - 0.03, 0.55, z - 0.03, x + 0.03, 0.6 + h * 0.6, z + 0.03, { zone });
  }

  trophyCase(x0, x1) {
    const { b, M } = this;
    const z0 = -1.9, z1 = -1.42, zone = 'corridor';
    b.box(M.woodDark, x0, 0, z0, x1, 0.8, z1, { zone, collide: true });
    b.box(M.woodDark, x0, 2.2, z0, x1, 2.3, z1, { zone });
    b.box(M.felt, x0, 0.8, z0, x1, 2.2, z0 + 0.02, { zone, cast: false });
    for (const x of [x0, x1 - 0.05]) b.box(M.woodDark, x, 0.8, z0, x + 0.05, 2.2, z1, { zone });
    b.box(M.glass, x0 + 0.05, 0.8, z1 - 0.01, x1 - 0.05, 2.2, z1, { zone, cast: false, receive: false });
    b.box(M.glass, x0 + 0.05, 1.45, z0 + 0.02, x1 - 0.05, 1.47, z1 - 0.02, { zone, cast: false, receive: false });
    b.physics.addCollider(x0, z0, x1, z1, 0, 2.3, 'case');
    const cup = (x, y, z, s, mat) => {
      b.geom(mat, cylGeo(0.05 * s, 0.07 * s, 0.05 * s, 12), new THREE.Matrix4().makeTranslation(x, y + 0.025 * s, z), { zone, cast: false });
      b.geom(mat, cylGeo(0.012 * s, 0.012 * s, 0.12 * s, 8), new THREE.Matrix4().makeTranslation(x, y + 0.11 * s, z), { zone, cast: false });
      b.geom(mat, cylGeo(0.1 * s, 0.03 * s, 0.16 * s, 16), new THREE.Matrix4().makeTranslation(x, y + 0.25 * s, z), { zone, cast: false });
      b.geom(mat, new THREE.TorusGeometry(0.045 * s, 0.01 * s, 6, 12), new THREE.Matrix4().makeTranslation(x - 0.1 * s, y + 0.27 * s, z), { zone, cast: false });
      b.geom(mat, new THREE.TorusGeometry(0.045 * s, 0.01 * s, 6, 12), new THREE.Matrix4().makeTranslation(x + 0.1 * s, y + 0.27 * s, z), { zone, cast: false });
    };
    let k = 0;
    for (let x = x0 + 0.5; x < x1 - 0.3; x += 0.75) {
      cup(x, 0.8, -1.66, 1.4 + (k % 3) * 0.35, k % 4 === 1 ? M.silver : M.gold);
      cup(x + 0.35, 1.47, -1.66, 1.0 + (k % 2) * 0.3, k % 3 === 0 ? M.silver : M.gold);
      k++;
    }
  }

  secondFloor() {
    const { b, M, T } = this;
    const F = L.FLOOR2, y = L.FLOOR2_Y, zone = 'floor2';
    b.box(M.concrete, F.x0, y - 0.4, -2.1, F.x1, y, 2.1, { zone, cast: true });
    // ceiling: exposed roof deck, joists, duct
    b.box(M.concrete, F.x0, L.ROOF - 0.02, -2.1, F.x1, L.ROOF + 0.1, 2.1, { zone });
    for (let x = F.x0 + 0.6; x < F.x1; x += 1.2) b.box(M.metalGrey, x - 0.04, L.ROOF - 0.35, -2.1, x + 0.04, L.ROOF - 0.02, 2.1, { zone, cast: false });
    const duct = new THREE.Matrix4().compose(new THREE.Vector3((F.x0 + F.x1) / 2, L.ROOF - 0.7, -1.0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1));
    b.geom(M.steel, cylGeo(0.28, 0.28, F.x1 - F.x0, 16), duct, { zone, cast: false });
    // work lights
    for (let x = F.x0 + 2; x < F.x1; x += 5) {
      b.box(M.metalDark, x - 0.005, L.ROOF - 1.3, 0.6 - 0.005, x + 0.005, L.ROOF - 0.35, 0.6 + 0.005, { zone, cast: false });
      b.geom(M.lampGlow, new THREE.SphereGeometry(0.09, 12, 8), new THREE.Matrix4().makeTranslation(x, L.ROOF - 1.38, 0.6), { zone, cast: false });
      b.geom(M.metalDark, cylGeo(0.04, 0.16, 0.16, 12, true), new THREE.Matrix4().makeTranslation(x, L.ROOF - 1.3, 0.6), { zone, cast: false });
      this.lights.push({ x, y: L.ROOF - 1.4, z: 0.6, zone, warm: true });
    }
    // stud walls (unfinished) along z=-2 and z=+2
    const studWall = (zc, x0, x1, drywallFrom = null, drywallTo = null) => {
      b.box(M.studs, x0, y, zc - 0.05, x1, y + 0.05, zc + 0.05, { zone, cast: false });
      b.box(M.studs, x0, L.ROOF - 0.05, zc - 0.05, x1, L.ROOF, zc + 0.05, { zone, cast: false });
      for (let x = x0; x <= x1 + 0.001; x += 0.41) b.box(M.studs, x - 0.02, y, zc - 0.045, x + 0.02, L.ROOF, zc + 0.045, { zone, cast: false });
      if (drywallFrom !== null) b.box(M.drywall, drywallFrom, y, zc - 0.07, drywallTo, y + 2.4, zc - 0.055, { zone, cast: false });
      b.box(M.plastic, x0, y, zc + 0.08, x1, L.ROOF, zc + 0.081, { zone, cast: false, receive: false });
    };
    studWall(-2.0, F.x0, F.x1, 24, 29.6);
    studWall(2.0, F.x0, 20.0);
    studWall(2.0, 32.0, F.x1);
    b.physics.addCollider(F.x0, -2.15, F.x1, -1.9, y - 0.4, L.ROOF, 'studs');
    b.physics.addCollider(F.x0, 1.9, 20.0, 2.15, y - 0.4, L.ROOF, 'studs');
    b.physics.addCollider(32.0, 1.9, F.x1, 2.15, y - 0.4, L.ROOF, 'studs');
    // plastic sheeting end walls
    for (const x of [F.x0 + 0.05, F.x1 - 0.05]) b.box(M.plastic, x - 0.005, y, -2.0, x + 0.005, L.ROOF, 2.0, { zone, cast: false, receive: false });
    // barriers at both ends of the walkable part
    for (const [x, dir] of [[F.walkX0, -1], [F.walkX1, 1]]) {
      this.barrier(x, -1.95, 1.95, zone);
      b.physics.addCollider(x - 0.15, -2.1, x + 0.15, 2.1, y - 0.4, y + 3, 'barrier');
      this.picture(T.constructionSignTex, zone, x - dir * 0.13, y + 1.6, 0, 1.1, 1.1, dir < 0 ? 'px' : 'nx', { rough: 0.6 });
      this.interactables.push({ type: 'info', x: x - dir * 0.3, y: y + 1.2, z: 0, radius: 1.3, reach: 2.6, label: 'Read sign', msg: 'The 2nd floor is still under construction &mdash; it\'s coming in a future update!', icon: 'info' });
      // construction clutter beyond
      const cx = x + dir * 2.5;
      this.ladder(cx, -1.2, zone);
      this.bucket(cx + dir * 1.2, 1.2, zone);
      this.bucket(cx + dir * 1.5, 0.8, zone);
      b.box(M.drywall, cx + dir * 3 - 0.6, y, -0.4, cx + dir * 3 + 0.6, y + 0.25, 0.8, { zone });
      b.box(M.osb, cx + dir * 3 - 0.62, y + 0.25, -0.42, cx + dir * 3 + 0.62, y + 0.28, 0.82, { zone });
      this.barrierSawhorse(cx + dir * 5, 0.6, zone);
    }
    // caution tape across walkable ends
    for (const x of [F.walkX0 + 0.08, F.walkX1 - 0.08]) {
      b.box(M.hazard, x - 0.005, y + 0.95, -1.9, x + 0.005, y + 1.03, 1.9, { zone, cast: false });
    }
    // floor-2 ground regions
    b.physics.addGroundFlat(F.walkX0 - 0.2, -1.95, F.walkX1 + 0.2, 1.95, y, 'floor2');
    b.physics.addGroundFlat(L.LOBBY.x0 + 0.1, 1.9, L.LOBBY.x1 - 0.1, L.LOBBY.balconyZ, y, 'floor2');
    // walls for the floor-2 walkable area above lobby side walls (keep player in)
    b.physics.addCollider(L.LOBBY.x0 - 0.1, 2.0, L.LOBBY.x0 + 0.1, L.LOBBY.balconyZ, y, L.ROOF, 'wall');
    b.physics.addCollider(L.LOBBY.x1 - 0.1, 2.0, L.LOBBY.x1 + 0.1, L.LOBBY.balconyZ, y, L.ROOF, 'wall');
  }

  barrier(x, z0, z1, zone) {
    const { b, M } = this;
    const y = L.FLOOR2_Y;
    b.box(M.hazard, x - 0.03, y + 0.75, z0, x + 0.03, y + 0.95, z1, { zone });
    b.box(M.hazard, x - 0.03, y + 0.35, z0, x + 0.03, y + 0.5, z1, { zone });
    for (const z of [z0 + 0.15, (z0 + z1) / 2, z1 - 0.15]) {
      b.box(M.plasticOrange, x - 0.18, y, z - 0.04, x + 0.18, y + 0.06, z + 0.04, { zone });
      b.box(M.plasticWhite, x - 0.03, y, z - 0.03, x + 0.03, y + 1.0, z + 0.03, { zone });
    }
  }

  barrierSawhorse(x, z, zone) {
    const { b, M } = this;
    const y = L.FLOOR2_Y;
    b.box(M.hazard, x - 0.03, y + 0.8, z - 0.7, x + 0.03, y + 0.98, z + 0.7, { zone });
    for (const dz of [-0.6, 0.6]) {
      b.boxT(M.plasticOrange, x - 0.12, y + 0.45, z + dz, 0.04, 0.95, 0.06, 0, { zone, rz: 0.25 });
      b.boxT(M.plasticOrange, x + 0.12, y + 0.45, z + dz, 0.04, 0.95, 0.06, 0, { zone, rz: -0.25 });
    }
  }

  ladder(x, z, zone) {
    const { b, M } = this;
    const y = L.FLOOR2_Y;
    for (const dz of [-0.22, 0.22]) {
      b.boxT(M.plasticOrange, x - 0.35, y + 1.0, z + dz, 0.05, 2.1, 0.06, 0, { zone, rz: 0.17 });
      b.boxT(M.plasticOrange, x + 0.35, y + 1.0, z + dz, 0.05, 2.1, 0.06, 0, { zone, rz: -0.17 });
    }
    for (let k = 1; k < 7; k++) {
      const yy = y + k * 0.28, w = 0.7 - k * 0.05;
      b.box(M.metalGrey, x - w / 2 - 0.02, yy, z - 0.22, x - w / 2 + 0.02, yy + 0.03, z + 0.22, { zone });
    }
  }

  bucket(x, z, zone) {
    const { b, M } = this;
    const y = L.FLOOR2_Y;
    b.geom(M.plasticWhite, cylGeo(0.15, 0.13, 0.36, 14), new THREE.Matrix4().makeTranslation(x, y + 0.18, z), { zone });
    b.geom(M.plasticBlue, new THREE.CircleGeometry(0.15, 14).rotateX(-Math.PI / 2), new THREE.Matrix4().makeTranslation(x, y + 0.361, z), { zone });
  }

  corridorProps() {
    const { b, M, T } = this;
    const zone = 'corridor';
    // lockers
    const runsN = [[0.6, 9.5], [11.6, 21.5], [31.6, 32.8], [33.6, 43.5], [45.6, 59.4]];
    const runsS = [[0.6, 7.3], [10.6, 19.6], [32.4, 34.9], [36.7, 47.8], [51.1, 59.4]];
    const lockerRun = (x0, x1, zWall, dir) => {
      const n = Math.floor((x1 - x0) / 0.3);
      if (n < 2) return;
      const w = n * 0.3, sx = (x0 + x1) / 2 - w / 2;
      const zf = zWall + dir * 0.42;
      b.box(M.plasticBlack, sx, 0, Math.min(zWall, zf - dir * 0.03), sx + w, 0.1, Math.max(zWall, zf - dir * 0.03), { zone });
      b.box(M.lockerBody, sx, 0.1, Math.min(zWall, zf), sx + w, 1.92, Math.max(zWall, zf), { zone });
      for (let i = 0; i < n; i++) {
        const cx = sx + i * 0.3 + 0.15;
        b.decal(M.lockerFront, cx, 1.01, zf + dir * 0.002, 0.292, 1.78, dir > 0 ? 'pz' : 'nz', { zone });
      }
      b.physics.addCollider(sx, Math.min(zWall, zf), sx + w, Math.max(zWall, zf), 0, 1.92, 'lockers');
    };
    for (const [a, c] of runsN) lockerRun(a, c, -1.9, 1);
    for (const [a, c] of runsS) lockerRun(a, c, 1.9, -1);
    // bulletin boards + posters above lockers
    const bb = (x, z, facing, seed) => {
      const tex = T.bulletinTex(seed);
      const n = facing === 'pz' ? 1 : -1;
      b.box(M.woodMid, x - 1.32, 2.06, z, x + 1.32, 2.94, z + n * 0.03, { zone, cast: false });
      this.picture(tex, zone, x, 2.5, z + n * 0.031, 2.5, 0.8, facing);
    };
    bb(5.2, -1.9, 'pz', 1);
    bb(16.5, -1.9, 'pz', 2);
    bb(39.2, -1.9, 'pz', 3);
    bb(52.4, -1.9, 'pz', 4);
    bb(14.5, 1.9, 'nz', 5);
    bb(42, 1.9, 'nz', 6);
    bb(55.2, 1.9, 'nz', 7);
    this.poster('kind', zone, 9.0, 2.45, -1.9, 'pz', 0.5, 0.68);
    this.poster('spirit', zone, 20.2, 2.45, -1.9, 'pz', 0.5, 0.68);
    this.poster('showcase', zone, 4.0, 2.45, 1.9, 'nz', 0.5, 0.68);
    this.poster('read', zone, 47.2, 2.45, 1.9, 'nz', 0.5, 0.68);
    this.poster('cell', zone, 37.2, 2.45, 1.9, 'nz', 0.5, 0.68);
    this.poster('kind', zone, 58.4, 2.45, -1.9, 'pz', 0.5, 0.68);
    this.poster('periodic', zone, 47.0, 2.45, -1.9, 'pz', 0.5, 0.68);
    // clocks
    this.clock(zone, 12.7, 2.55, -1.9, 'pz');
    this.clock(zone, 34.0, 2.55, -1.9, 'pz');
    this.clock(zone, 45.0, 2.55, 1.9, 'nz');
    // exit signs
    for (const [x, facing] of [[0.02, 'px'], [59.98, 'nx']]) {
      b.box(M.white, x - 0.02, 2.35, -0.32, x + 0.02, 2.6, 0.32, { zone, cast: false });
      this.picture(T.exitTex, zone, x + (facing === 'px' ? 0.02 : -0.02), 2.475, 0, 0.6, 0.22, facing, { emissive: 1.2, rough: 0.3 });
    }
    for (const x of [16, 44]) {
      b.box(M.metalDark, x - 0.01, 3.1, -0.01, x + 0.01, H1, 0.01, { zone, cast: false });
      b.box(M.white, x - 0.02, 2.82, -0.33, x + 0.02, 3.1, 0.33, { zone, cast: false });
      this.picture(T.exitTex, zone, x + 0.021, 2.96, 0, 0.6, 0.22, 'px', { emissive: 1.2, rough: 0.3 });
      this.picture(T.exitTex, zone, x - 0.021, 2.96, 0, 0.6, 0.22, 'nx', { emissive: 1.2, rough: 0.3 });
    }
    // water fountain (north wall)
    const fx = 33.2;
    b.box(M.steel, fx - 0.35, 0.65, -1.9, fx + 0.35, 0.95, -1.5, { zone });
    b.box(M.steel, fx - 0.2, 0.35, -1.9, fx + 0.2, 0.65, -1.75, { zone });
    b.box(M.metalDark, fx - 0.28, 0.93, -1.82, fx + 0.28, 0.955, -1.56, { zone, cast: false });
    b.box(M.chrome, fx - 0.02, 0.95, -1.7, fx + 0.02, 1.0, -1.66, { zone, cast: false });
    b.box(M.chrome, fx + 0.36, 0.78, -1.75, fx + 0.38, 0.84, -1.6, { zone, cast: false });
    b.physics.addCollider(fx - 0.36, -1.9, fx + 0.36, -1.5, 0, 0.96, 'fountain');
    this.interactables.push({ type: 'fountain', x: fx, y: 1.0, z: -1.62, radius: 0.5, reach: 1.9, label: 'Drink water' });
    // trash cans
    for (const [tx, tz, z2] of [[31.4, 5.2, 'lobby'], [0.32, -1.45, zone], [59.7, -1.45, zone]]) {
      b.geom(M.metalGrey, cylGeo(0.22, 0.2, 0.75, 16), new THREE.Matrix4().makeTranslation(tx, 0.375, tz), { zone: z2, collide: true });
      b.geom(M.metalDark, cylGeo(0.235, 0.235, 0.04, 16), new THREE.Matrix4().makeTranslation(tx, 0.77, tz), { zone: z2 });
    }
    // fire extinguisher cabinet
    b.box(M.red, 31.86, 1.1, 16.5, 31.9, 1.8, 17.0, { zone: 'lobby', cast: false });
    // room plates + projecting flag signs
    for (const d of L.DOORS) {
      const room = ROOMS[d.room];
      if (!room || d.axis !== 'x') continue;
      const s = Math.sign(d.z); // -1 north wall, +1 south wall
      const facing = s < 0 ? 'pz' : 'nz';
      const latchX = d.x + (d.double ? -d.w / 2 - 0.42 : d.hinge === 'max' ? -0.85 : 0.85);
      const zf = d.z - s * 0.1;
      b.box(M.navy, latchX - 0.17, 1.38, zf, latchX + 0.17, 1.62, zf - s * 0.012, { zone, cast: false });
      this.picture(T.roomPlateTex(room.id), zone, latchX, 1.5, zf - s * 0.013, 0.32, 0.16, facing);
      // projecting sign
      const fxs = d.x + (d.double ? d.w / 2 + 0.35 : d.hinge === 'max' ? 0.75 : -0.75);
      const zc = d.z - s * 0.42;
      b.box(M.metalDark, fxs - 0.015, 2.62, d.z - s * 0.1, fxs + 0.015, 2.66, d.z - s * 0.74, { zone, cast: false });
      b.box(M.navy, fxs - 0.012, 2.38, zc - 0.31, fxs + 0.012, 2.62, zc + 0.31, { zone, cast: false });
      this.picture(T.flagSignTex(room.id), zone, fxs + 0.013, 2.5, zc, 0.6, 0.19, 'px', { rough: 0.5 });
      this.picture(T.flagSignTex(room.id), zone, fxs - 0.013, 2.5, zc, 0.6, 0.19, 'nx', { rough: 0.5 });
    }
  }

  roof() {
    const { b, M } = this;
    b.box(M.concrete, -0.3, L.ROOF, -11.3, 60.3, L.ROOF + 0.4, 11.3, { zone: 'exterior' });
    b.box(M.concrete, -0.3, L.ROOF, 11.3, 33.7, L.ROOF + 0.4, 20.3, { zone: 'exterior' });
    b.box(M.concrete, 44.3, L.ROOF, 11.3, 60.3, L.ROOF + 0.4, 20.3, { zone: 'exterior' });
    const top = L.ROOF + 1.0;
    const cap = (x0, z0, x1, z1) => b.box(M.concrete, x0, top, z0, x1, top + 0.12, z1, { zone: 'exterior', cast: false });
    cap(-0.4, -11.4, 60.4, -11.0);
    cap(-0.4, 20.0, 60.4, 20.4);
    cap(-0.4, -11.4, 0.0, 20.4);
    cap(60.0, -11.4, 60.4, 20.4);
    // rooftop units
    for (const [x, z] of [[10, -5], [30, -6], [50, -4]]) {
      b.box(M.metalGrey, x - 1.2, L.ROOF + 0.4, z - 0.9, x + 1.2, L.ROOF + 1.6, z + 0.9, { zone: 'exterior' });
      b.geom(M.metalDark, cylGeo(0.5, 0.5, 0.1, 18), new THREE.Matrix4().makeTranslation(x + 0.4, L.ROOF + 1.65, z), { zone: 'exterior', cast: false });
    }
  }

  groundRegions() {
    const P = this.b.physics;
    // 1st floor (everything except the auditorium bowl)
    P.addGroundFlat(-0.2, -11, 60.2, 2.0, 0, 'f1');
    P.addGroundFlat(19.9, 1.9, 34.1, 20.3, 0, 'f1');
    P.addGroundFlat(33.9, 1.9, 60.2, 20.0, 0, 'f1');
    // auditorium: back aisle, sloped seating, front floor, stage + side steps
    const A = L.AUD;
    P.addGroundFlat(A.x0, 1.9, A.x1, A.backAisleZ, 0, 'aud');
    P.addGroundRamp(A.x0, A.backAisleZ, A.x1, A.slopeZ1, 'z', 0, A.frontY, 'aud');
    P.addGroundFlat(A.x0, A.slopeZ1, A.x1, A.stageZ, A.frontY, 'aud');
    P.addGroundFlat(A.x0, A.stageZ, A.x1, A.z1, A.stageY, 'stage');
    P.addGroundRamp(0.6, A.slopeZ1, 2.0, A.stageZ, 'z', A.frontY, A.stageY, 'aud');
    P.addGroundRamp(15.9, A.slopeZ1, 17.3, A.stageZ, 'z', A.frontY, A.stageY, 'aud');
    // grand staircase
    const LB = L.LOBBY;
    P.addGroundRamp(LB.stairX0, LB.stairZTop, LB.stairX1, LB.stairZBot, 'z', L.FLOOR2_Y, 0, 'stairs');
    // stage front (blocks walking from the front floor onto the stage except via the steps)
    P.addCollider(0, A.stageZ, 0.6, A.stageZ + 0.15, A.frontY - 0.1, A.stageY, 'stage');
    P.addCollider(2.0, A.stageZ, 15.9, A.stageZ + 0.15, A.frontY - 0.1, A.stageY, 'stage');
    P.addCollider(17.3, A.stageZ, 17.9, A.stageZ + 0.15, A.frontY - 0.1, A.stageY, 'stage');
  }
}
