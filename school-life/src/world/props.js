// Furniture prototypes. Each prototype is a list of parts in local space (facing -Z),
// placed many times into the static batches.
import * as THREE from 'three';
import { boxGeo, cylGeo } from '../engine/builder.js';
import { mulberry32 } from '../engine/textures.js';

const boxCache = new Map();
export function getBox(sx, sy, sz) {
  const k = sx.toFixed(4) + ',' + sy.toFixed(4) + ',' + sz.toFixed(4);
  let g = boxCache.get(k);
  if (!g) {
    g = boxGeo(sx, sy, sz);
    boxCache.set(k, g);
  }
  return g;
}

const _root = new THREE.Matrix4();
const _tmp = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

export class Proto {
  constructor() {
    this.parts = [];
  }

  box(mat, cx, cy, cz, sx, sy, sz, rx = 0, ry = 0, rz = 0, cast = true) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
    this.parts.push({ mat, geo: getBox(sx, sy, sz), m, cast });
    return this;
  }

  geo(mat, geo, m, cast = true) {
    this.parts.push({ mat, geo, m, cast });
    return this;
  }

  place(b, zone, x, y, z, yaw = 0, { cast = true, scale = 1 } = {}) {
    _p.set(x, y, z);
    _q.setFromEuler(_e.set(0, yaw, 0));
    _s.set(scale, scale, scale);
    _root.compose(_p, _q, _s);
    for (const pt of this.parts) {
      _tmp.multiplyMatrices(_root, pt.m);
      b.geom(pt.mat, pt.geo, _tmp, { zone, cast: cast && pt.cast });
    }
  }
}

/** AABB of a local rectangle (lx0..lx1, lz0..lz1) rotated by yaw and translated. */
export function footprint(x, z, yaw, lx0, lz0, lx1, lz1) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [lx, lz] of [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]]) {
    // rotation about Y: x' = x cos + z sin ; z' = -x sin + z cos
    const wx = x + lx * c + lz * s;
    const wz = z - lx * s + lz * c;
    x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
  }
  return [x0, z0, x1, z1];
}

export function makeProtos(M) {
  const P = {};
  const legs = (p, mat, w, d, h, r = 0.013, inset = 0.03) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.geo(mat, cylGeo(r, r, h, 8), new THREE.Matrix4().makeTranslation(sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset)));
  };

  // Student desk + chair. Origin = chair seat centre on the floor; desk in front (-Z).
  P.deskSet = new Proto()
    .box(M.woodLight, 0, 0.72, -0.45, 0.62, 0.025, 0.5)
    .box(M.metalGrey, 0, 0.62, -0.47, 0.58, 0.012, 0.42)
    .box(M.metalGrey, 0, 0.65, -0.68, 0.58, 0.07, 0.012)
    .box(M.metalGrey, -0.286, 0.65, -0.47, 0.012, 0.07, 0.42)
    .box(M.metalGrey, 0.286, 0.65, -0.47, 0.012, 0.07, 0.42);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.deskSet.geo(M.metalGrey, cylGeo(0.013, 0.013, 0.7, 8), new THREE.Matrix4().makeTranslation(sx * 0.27, 0.35, -0.45 + sz * 0.21));
  P.deskSet
    .box(M.plasticBlue, 0, 0.45, 0.02, 0.42, 0.03, 0.4)
    .box(M.plasticBlue, 0, 0.72, 0.21, 0.4, 0.3, 0.025, -0.12)
    .box(M.chrome, -0.19, 0.6, 0.2, 0.02, 0.3, 0.02, -0.12)
    .box(M.chrome, 0.19, 0.6, 0.2, 0.02, 0.3, 0.02, -0.12);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.deskSet.geo(M.chrome, cylGeo(0.011, 0.011, 0.45, 8), new THREE.Matrix4().makeTranslation(sx * 0.18, 0.225, 0.02 + sz * 0.17));

  // Teacher desk (front = -Z side faces the students when yawed)
  P.teacherDesk = new Proto()
    .box(M.woodMid, 0, 0.75, 0, 1.5, 0.04, 0.75)
    .box(M.woodDark, -0.72, 0.37, 0, 0.04, 0.73, 0.72)
    .box(M.woodDark, 0.72, 0.37, 0, 0.04, 0.73, 0.72)
    .box(M.woodDark, 0, 0.42, -0.34, 1.4, 0.62, 0.03)
    .box(M.woodDark, 0.45, 0.4, 0.05, 0.5, 0.66, 0.6)
    .box(M.metalGrey, 0.45, 0.62, 0.36, 0.2, 0.02, 0.02)
    .box(M.metalGrey, 0.45, 0.4, 0.36, 0.2, 0.02, 0.02)
    .box(M.paper, -0.35, 0.785, 0.05, 0.3, 0.03, 0.22, 0, 0.15)
    .geo(M.red, new THREE.SphereGeometry(0.045, 14, 10), new THREE.Matrix4().makeTranslation(0.15, 0.815, -0.1))
    .geo(M.plantDark, cylGeo(0.004, 0.004, 0.03, 4), new THREE.Matrix4().makeTranslation(0.15, 0.865, -0.1))
    .geo(M.white, cylGeo(0.04, 0.035, 0.1, 12), new THREE.Matrix4().makeTranslation(-0.6, 0.82, 0.1));

  P.officeChair = new Proto()
    .box(M.plasticBlack, 0, 0.48, 0, 0.5, 0.08, 0.48)
    .box(M.plasticBlack, 0, 0.85, 0.24, 0.46, 0.55, 0.06, -0.08)
    .geo(M.chrome, cylGeo(0.025, 0.025, 0.4, 8), new THREE.Matrix4().makeTranslation(0, 0.24, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    P.officeChair.box(M.chrome, Math.cos(a) * 0.15, 0.04, Math.sin(a) * 0.15, 0.3, 0.03, 0.04, 0, -a);
  }

  // Lab stool + lab table
  P.stool = new Proto().geo(M.plasticBlack, cylGeo(0.17, 0.17, 0.05, 16), new THREE.Matrix4().makeTranslation(0, 0.65, 0));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.stool.box(M.chrome, sx * 0.1, 0.32, sz * 0.1, 0.02, 0.66, 0.02, sz * 0.08, 0, -sx * 0.08);
  P.stool.geo(M.chrome, new THREE.TorusGeometry(0.13, 0.008, 6, 20).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(0, 0.25, 0));
  P.labTable = new Proto()
    .box(M.labTop, 0, 0.9, 0, 1.3, 0.04, 0.62)
    .box(M.white, 0, 0.45, 0.08, 1.24, 0.86, 0.42)
    .box(M.metalGrey, -0.3, 0.6, -0.135, 0.2, 0.015, 0.012)
    .box(M.metalGrey, 0.3, 0.6, -0.135, 0.2, 0.015, 0.012)
    .box(M.chrome, 0.5, 0.97, 0.22, 0.03, 0.1, 0.03)
    .box(M.chrome, 0.5, 1.02, 0.18, 0.025, 0.025, 0.1);

  // Auditorium seat (cushion down) — origin at the seat front/centre on the floor, facing -Z
  P.audSeat = new Proto()
    .box(M.velvet, 0, 0.44, -0.02, 0.5, 0.09, 0.46, 0.06)
    .box(M.velvet, 0, 0.78, 0.24, 0.5, 0.62, 0.09, -0.16)
    .box(M.plasticBlack, 0, 0.78, 0.29, 0.52, 0.64, 0.03, -0.16)
    .box(M.plasticBlack, -0.27, 0.62, 0.05, 0.05, 0.06, 0.48)
    .box(M.metalDark, -0.27, 0.3, 0.12, 0.04, 0.6, 0.32);
  P.audArmEnd = new Proto().box(M.plasticBlack, 0, 0.62, 0.05, 0.05, 0.06, 0.48).box(M.metalDark, 0, 0.3, 0.12, 0.04, 0.6, 0.32);

  // Library table + wooden chair
  P.libTable = new Proto().box(M.woodMid, 0, 0.74, 0, 1.8, 0.05, 0.9);
  legs(P.libTable, M.woodDark, 1.8, 0.9, 0.72, 0.03, 0.08);
  P.libTable.box(M.woodDark, 0, 0.66, 0, 1.6, 0.08, 0.04);
  P.woodChair = new Proto().box(M.woodMid, 0, 0.46, 0, 0.44, 0.04, 0.42).box(M.woodMid, 0, 0.8, 0.19, 0.42, 0.08, 0.03).box(M.woodMid, 0, 0.62, 0.19, 0.42, 0.04, 0.03);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.woodChair.box(M.woodDark, sx * 0.19, sz > 0 ? 0.42 : 0.23, sz * 0.18, 0.035, sz > 0 ? 0.84 : 0.46, 0.035);

  // Sofa (3 seats, 2.1 wide) and armchair, facing -Z, origin at front centre on the floor
  const sofa = (w, mat) => {
    const p = new Proto()
      .box(mat, 0, 0.22, 0.05, w, 0.26, 0.85)
      .box(mat, 0, 0.62, 0.38, w, 0.6, 0.2, -0.08)
      .box(mat, -w / 2 - 0.08, 0.45, 0.05, 0.18, 0.5, 0.85)
      .box(mat, w / 2 + 0.08, 0.45, 0.05, 0.18, 0.5, 0.85);
    const n = Math.round(w / 0.7);
    for (let i = 0; i < n; i++) p.box(mat, -w / 2 + (i + 0.5) * (w / n), 0.4, -0.02, w / n - 0.03, 0.12, 0.7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(M.woodDark, sx * (w / 2 + 0.1), 0.04, 0.05 + sz * 0.35, 0.05, 0.08, 0.05);
    return p;
  };
  P.sofa = sofa(2.1, M.fabricTeal);
  P.armchair = sofa(0.72, M.fabricMustard);
  P.coffeeTable = new Proto().box(M.woodMid, 0, 0.42, 0, 1.2, 0.05, 0.6);
  legs(P.coffeeTable, M.woodDark, 1.2, 0.6, 0.4, 0.025, 0.06);
  P.beanbag = new Proto().geo(M.fabricPurple, new THREE.SphereGeometry(0.45, 16, 12), new THREE.Matrix4().compose(new THREE.Vector3(0, 0.3, 0.05), new THREE.Quaternion(), new THREE.Vector3(1, 0.62, 1)));
  P.floorLamp = new Proto()
    .geo(M.metalDark, cylGeo(0.15, 0.17, 0.03, 16), new THREE.Matrix4().makeTranslation(0, 0.015, 0))
    .geo(M.metalDark, cylGeo(0.012, 0.012, 1.5, 8), new THREE.Matrix4().makeTranslation(0, 0.77, 0))
    .geo(M.lampGlow, cylGeo(0.14, 0.22, 0.3, 18, true), new THREE.Matrix4().makeTranslation(0, 1.6, 0), false);

  P.monitor = new Proto()
    .box(M.plasticBlack, 0, 0.25, 0, 0.56, 0.34, 0.03)
    .box(M.screen, 0, 0.25, -0.016, 0.52, 0.3, 0.004)
    .box(M.plasticBlack, 0, 0.06, 0.02, 0.05, 0.12, 0.05)
    .box(M.plasticBlack, 0, 0.005, 0.02, 0.22, 0.01, 0.16)
    .box(M.plasticBlack, 0, 0.008, -0.22, 0.42, 0.015, 0.14);

  P.podium = new Proto()
    .box(M.woodDark, 0, 0.55, 0, 0.6, 1.1, 0.45)
    .box(M.woodMid, 0, 1.13, 0.02, 0.66, 0.05, 0.5, 0.25)
    .box(M.gold, 0, 0.7, -0.226, 0.3, 0.3, 0.004)
    .geo(M.metalDark, cylGeo(0.006, 0.006, 0.3, 6), new THREE.Matrix4().compose(new THREE.Vector3(0.15, 1.3, -0.1), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0, 0)), new THREE.Vector3(1, 1, 1)));

  P.piano = new Proto()
    .box(M.pianoBlack, 0, 0.82, 0.2, 1.5, 0.3, 1.4)
    .box(M.pianoBlack, -0.32, 1.45, 0.42, 0.06, 0.9, 1.0, 0, 0, 0.0)
    .box(M.white, 0, 0.72, -0.56, 1.3, 0.04, 0.16)
    .box(M.pianoBlack, 0, 0.76, -0.6, 1.3, 0.02, 0.08)
    .box(M.pianoBlack, 0, 0.45, -0.25, 0.15, 0.06, 0.15);
  for (const [sx, sz] of [[-0.65, -0.45], [0.65, -0.45], [0, 0.8]]) P.piano.geo(M.pianoBlack, cylGeo(0.05, 0.04, 0.68, 10), new THREE.Matrix4().makeTranslation(sx, 0.34, sz));
  for (let i = 0; i < 14; i++) P.piano.box(M.pianoBlack, -0.6 + i * 0.09 + 0.045, 0.75, -0.6, 0.04, 0.025, 0.08);

  P.filing = new Proto().box(M.metalGrey, 0, 0.66, 0, 0.46, 1.32, 0.6);
  for (let i = 0; i < 4; i++) P.filing.box(M.chrome, 0, 0.25 + i * 0.32, -0.305, 0.14, 0.02, 0.02);

  P.globe = new Proto()
    .geo(M.woodDark, cylGeo(0.12, 0.15, 0.04, 16), new THREE.Matrix4().makeTranslation(0, 0.02, 0))
    .geo(M.woodDark, cylGeo(0.015, 0.015, 0.75, 8), new THREE.Matrix4().makeTranslation(0, 0.4, 0))
    .geo(M.plasticBlue, new THREE.SphereGeometry(0.2, 20, 14), new THREE.Matrix4().makeTranslation(0, 0.95, 0))
    .geo(M.gold, new THREE.TorusGeometry(0.22, 0.008, 6, 28), new THREE.Matrix4().compose(new THREE.Vector3(0, 0.95, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0.4)), new THREE.Vector3(1, 1, 1)));
  return P;
}

/** Book geometry: unit box, spine (front, -Z) gets the whole spine texture, others a white spot. */
let bookGeoCache = null;
export function bookGeo() {
  if (bookGeoCache) return bookGeoCache;
  const g = new THREE.BoxGeometry(1, 1, 1);
  const uv = g.attributes.uv;
  const n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    if (n.getZ(i) < -0.5) continue; // spine keeps 0..1
    uv.setXY(i, 0.5, 0.55);
  }
  g.translate(0, 0.5, 0);
  bookGeoCache = g;
  return g;
}

const BOOK_COLORS = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085, 0xd35400, 0x2c3e50, 0xe74c3c, 0x1abc9c, 0x7f8c8d, 0xf1c40f, 0x6d4c41, 0x3949ab, 0xad1457];

/**
 * Bookshelf: x,z = centre of the front face on the floor; facing direction yaw (front = -Z local).
 */
export function bookshelf(b, M, zone, x, z, yaw, w, h, d, rows, seed = 1, { back = true, doubleSided = false } = {}) {
  const rand = mulberry32(seed);
  const p = new Proto();
  const t = 0.025;
  p.box(M.woodMid, -w / 2 + t / 2, h / 2, d / 2, t, h, d)
    .box(M.woodMid, w / 2 - t / 2, h / 2, d / 2, t, h, d)
    .box(M.woodMid, 0, h - t / 2, d / 2, w, t, d)
    .box(M.woodDark, 0, 0.05, d / 2, w - 2 * t, 0.1, d);
  if (back) p.box(M.woodDark, 0, h / 2, d - 0.006, w - 2 * t, h - 0.02, 0.012);
  const shelfH = (h - 0.12) / rows;
  for (let r = 1; r < rows; r++) p.box(M.woodMid, 0, 0.1 + r * shelfH, d / 2, w - 2 * t, 0.022, d);
  p.place(b, zone, x, 0, z, yaw);
  const g = bookGeo();
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  const sides = doubleSided ? [1, -1] : [1];
  for (const side of sides) {
    for (let r = 0; r < rows; r++) {
      const yb = 0.1 + r * shelfH + 0.011;
      let lx = -w / 2 + t + 0.01;
      while (lx < w / 2 - t - 0.05) {
        const bw = 0.022 + rand() * 0.03;
        const bh = Math.min(shelfH - 0.04, 0.17 + rand() * 0.12);
        const bd = Math.min(d / (doubleSided ? 2 : 1) - 0.03, 0.15 + rand() * 0.07);
        if (rand() < 0.06) { lx += bw + 0.02; continue; }
        const tilt = rand() < 0.04 ? 0.25 : 0;
        const lz = side > 0 ? 0.012 + bd / 2 : d - 0.012 - bd / 2;
        const cx = lx + bw / 2;
        const wx = x + cx * c + lz * s;
        const wz = z - cx * s + lz * c;
        q.setFromEuler(new THREE.Euler(0, yaw + (side > 0 ? 0 : Math.PI), tilt));
        m.compose(new THREE.Vector3(wx, yb, wz), q, new THREE.Vector3(bw, bh, bd));
        col.setHex(BOOK_COLORS[(rand() * BOOK_COLORS.length) | 0]).multiplyScalar(0.75 + rand() * 0.35);
        b.geom(M.books, g, m, { zone, color: col, cast: false });
        lx += bw + 0.002 + (tilt ? 0.02 : 0);
      }
    }
  }
}
