// Room interiors: furniture, boards, posters, seats (with NPC walking routes) and teachers.
import * as THREE from 'three';
import { cylGeo } from '../engine/builder.js';
import { makeProtos, footprint, bookshelf, Proto } from './props.js';
import * as L from './layout.js';

const PI = Math.PI;
const FACE_NX = PI / 2; // facing -X
const FACE_PX = -PI / 2; // facing +X
const FACE_PZ = PI; // facing +Z
const FACE_NZ = 0; // facing -Z

export function yawToDir(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

export class RoomsBuilder {
  constructor(sb) {
    this.sb = sb; // SchoolBuilder (shared helpers: picture, poster, clock, planter)
    this.b = sb.b;
    this.M = sb.M;
    this.T = sb.T;
    this.P = makeProtos(this.M);
    this.seats = [];
    this.teachers = [];
    this.interactables = sb.interactables;
    this.wander = [];
  }

  seat(room, type, x, z, y, seatH, yaw, ax, az, path, extra = {}) {
    const s = { id: 's' + this.seats.length, room, type, x, z, y, seatH, yaw, ax, az, path, occupant: null, ...extra };
    this.seats.push(s);
    return s;
  }

  collide(x0, z0, x1, z1, y0, y1, tag = 'furniture') {
    this.b.physics.addCollider(x0, z0, x1, z1, y0, y1, tag);
  }

  build() {
    for (const r of L.NORTH_ROOMS) this.classroom(r);
    this.science();
    this.library();
    this.office();
    this.auditorium();
    return { seats: this.seats, teachers: this.teachers };
  }

  // ------------------------------------------------------------------ classrooms
  classroom(r) {
    const { b, M, P, sb, T } = this;
    const zone = 'r' + r.id;
    const x0 = r.x0, zc = -6.55;
    const cols = [-2, -1, 0, 1, 2].map((k) => zc + k * 1.6);
    const rows = [3.4, 4.8, 6.2, 7.6].map((d) => x0 + d);
    const backX = x0 + 8.9;
    const doorIn = L.doorPoints(r.id).in;
    for (let ri = 0; ri < rows.length; ri++) {
      for (let ci = 0; ci < cols.length; ci++) {
        const x = rows[ri], z = cols[ci];
        P.deskSet.place(b, zone, x, 0, z, FACE_NX);
        const fp = footprint(x, z, FACE_NX, -0.33, -0.72, 0.33, 0.24);
        this.collide(fp[0], fp[1], fp[2], fp[3], 0, 0.85);
        const az = ci < 4 ? z + 0.8 : z - 0.8;
        this.seat(r.id, 'desk', x, z, 0, 0.47, FACE_NX, x, az, [doorIn, { x: backX, z: doorIn.z - 0.6 }, { x: backX, z: az }, { x, z: az }]);
      }
    }
    // teacher desk + chair
    P.teacherDesk.place(b, zone, x0 + 1.65, 0, -9.35, FACE_PX);
    this.collide(x0 + 1.25, -10.1, x0 + 2.05, -8.6, 0, 0.8);
    P.officeChair.place(b, zone, x0 + 0.85, 0, -9.35, FACE_PX + 0.3);
    // board on the west wall
    const wx = x0 + 0.1;
    const tex = T.boardTex(r.id);
    b.box(r.board === 'white' ? M.frame : M.woodDark, wx, 0.86, zc - 1.9, wx + 0.04, 2.24, zc + 1.9, { zone, cast: false });
    sb.picture(tex, zone, wx + 0.041, 1.55, zc, 3.6, 1.2, 'px', { rough: r.board === 'white' ? 0.18 : 0.92 });
    b.box(r.board === 'white' ? M.frame : M.woodDark, wx, 0.88, zc - 1.9, wx + 0.1, 0.92, zc + 1.9, { zone, cast: false });
    for (let k = 0; k < 4; k++) b.box(r.board === 'white' ? [M.plasticBlue, M.plasticRed, M.plasticBlack, M.plasticGreen][k] : M.white, wx + 0.05, 0.92, zc - 1.2 + k * 0.12, wx + 0.075, 0.935, zc - 1.12 + k * 0.12, { zone, cast: false });
    sb.clock(zone, wx, 2.78, zc, 'px');
    // low cabinets under the windows
    b.box(M.woodMid, x0 + 1.4, 0, -10.98, x0 + 8.6, 0.85, -10.55, { zone });
    b.box(M.labTop, x0 + 1.38, 0.85, -11.0, x0 + 8.62, 0.88, -10.52, { zone, cast: false });
    this.collide(x0 + 1.4, -11, x0 + 8.6, -10.5, 0, 0.9);
    for (let k = 0; k < 6; k++) {
      const cx = x0 + 2.0 + k * 1.2;
      b.box(M.woodDark, cx - 0.5, 0.1, -10.552, cx + 0.5, 0.8, -10.548, { zone, cast: false });
      b.box(M.chrome, cx + 0.38, 0.6, -10.56, cx + 0.42, 0.7, -10.54, { zone, cast: false });
    }
    // back wall cubbies / bookcase
    bookshelf(b, M, zone, r.x1 - 0.47, -8.6, FACE_NX, 2.0, 1.4, 0.36, 3, r.id);
    this.collide(r.x1 - 0.48, -9.6, r.x1 - 0.1, -7.6, 0, 1.4);
    // posters
    const posters = { 101: ['shapes', 'times', 'kind'], 103: ['graph', 'times', 'shapes'], 105: ['parts', 'read', 'kind'] }[r.id];
    sb.poster(posters[0], zone, x0 + 3.6, 1.95, -2.1, 'nz');
    sb.poster(posters[1], zone, x0 + 6.0, 1.95, -2.1, 'nz');
    sb.poster(posters[2], zone, r.x1 - 0.1, 1.95, -5.2, 'nx');
    if (r.id === 105) {
      P.globe.place(b, zone, r.x1 - 0.55, 0, -10.0, 0);
      this.collide(r.x1 - 0.8, -10.3, r.x1 - 0.3, -9.7, 0, 1.2);
    } else {
      sb.planter(zone, r.x1 - 0.55, -10.15, 0.3, 1.1);
    }
    // teacher
    this.teachers.push({ room: r.id, x: x0 + 1.25, z: zc, yaw: FACE_PX, pace: [{ x: x0 + 1.25, z: zc - 1.4 }, { x: x0 + 1.25, z: zc + 1.4 }] });
  }

  // ------------------------------------------------------------------ science
  science() {
    const { b, M, P, sb, T } = this;
    const zone = 'r104';
    const S = L.SCI;
    const doorIn = L.doorPoints(104).in;
    const rowsX = [40.2, 38.5, 36.8];
    const tables = [3.85, 6.55, 9.25];
    for (const sx of rowsX) {
      for (const tz of tables) {
        P.labTable.place(b, zone, sx + 0.55, 0, tz, FACE_NX);
        this.collide(sx + 0.24, tz - 0.66, sx + 0.86, tz + 0.66, 0, 0.95);
        for (const dz of [-0.33, 0.33]) {
          P.stool.place(b, zone, sx, 0, tz + dz, 0);
          const az = tz + (dz > 0 ? 1.0 : -1.0);
          this.seat(104, 'stool', sx, tz + dz, 0, 0.67, FACE_PX, sx, az, [doorIn, { x: 35.2, z: Math.max(doorIn.z, 2.85) }, { x: 35.2, z: az }, { x: sx, z: az }]);
        }
      }
    }
    // demo bench with sink + plant + sun lamp
    b.box(M.white, 41.75, 0, 4.7, 42.45, 0.88, 8.4, { zone });
    b.box(M.labTop, 41.7, 0.88, 4.65, 42.5, 0.92, 8.45, { zone });
    this.collide(41.7, 4.65, 42.5, 8.45, 0, 0.95);
    b.box(M.steel, 41.85, 0.86, 7.4, 42.35, 0.921, 8.1, { zone, cast: false });
    b.box(M.metalDark, 41.9, 0.85, 7.45, 42.3, 0.9, 8.05, { zone, cast: false });
    b.box(M.chrome, 42.38, 0.92, 7.72, 42.42, 1.2, 7.78, { zone });
    b.box(M.chrome, 42.22, 1.17, 7.72, 42.42, 1.21, 7.78, { zone });
    b.geom(M.ceramic, cylGeo(0.12, 0.09, 0.2, 12), new THREE.Matrix4().makeTranslation(42.1, 1.02, 5.6), { zone });
    for (let k = 0; k < 4; k++) b.geom(k % 2 ? M.plantGreen : M.plantDark, new THREE.IcosahedronGeometry(0.1, 1), new THREE.Matrix4().compose(new THREE.Vector3(42.1 + Math.cos(k * 1.6) * 0.06, 1.22 + k * 0.03, 5.6 + Math.sin(k * 1.6) * 0.06), new THREE.Quaternion(), new THREE.Vector3(1, 1.4, 1)), { zone });
    b.geom(M.metalDark, cylGeo(0.008, 0.008, 1.2, 6), new THREE.Matrix4().makeTranslation(42.1, L.CEIL - 0.6, 5.6), { zone, cast: false });
    b.geom(M.lampGlow, new THREE.SphereGeometry(0.08, 14, 10), new THREE.Matrix4().makeTranslation(42.1, L.CEIL - 1.25, 5.6), { zone, cast: false });
    b.geom(M.metalDark, cylGeo(0.06, 0.2, 0.16, 16, true), new THREE.Matrix4().makeTranslation(42.1, L.CEIL - 1.2, 5.6), { zone, cast: false });
    // chalkboard on east wall
    const ex = S.x1 - 0.1;
    b.box(M.woodDark, ex - 0.04, 0.86, 6.55 - 1.9, ex, 2.24, 6.55 + 1.9, { zone, cast: false });
    sb.picture(T.boardTex(104), zone, ex - 0.041, 1.55, 6.55, 3.6, 1.2, 'nx', { rough: 0.92 });
    sb.clock(zone, ex, 2.78, 6.55, 'nx');
    // side counter with microscopes along the west wall
    b.box(M.white, 34.1, 0, 5.0, 34.7, 0.88, 10.6, { zone });
    b.box(M.labTop, 34.1, 0.88, 4.95, 34.75, 0.92, 10.65, { zone });
    this.collide(34.1, 4.95, 34.75, 10.65, 0, 0.95);
    for (const mz of [5.8, 7.2, 8.6]) {
      b.box(M.plasticBlack, 34.32, 0.92, mz - 0.08, 34.52, 0.95, mz + 0.08, { zone });
      b.boxT(M.plasticBlack, 34.42, 1.08, mz, 0.04, 0.3, 0.05, 0, { zone, rx: 0.2 });
      b.geom(M.chrome, cylGeo(0.022, 0.022, 0.16, 10), new THREE.Matrix4().compose(new THREE.Vector3(34.42, 1.2, mz - 0.04), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0, 0)), new THREE.Vector3(1, 1, 1)), { zone });
    }
    // terrarium
    b.box(M.glass, 34.2, 0.92, 9.6, 34.65, 1.3, 10.4, { zone, cast: false, receive: false });
    b.box(M.soil, 34.22, 0.92, 9.62, 34.63, 1.0, 10.38, { zone });
    // windowsill plants
    for (const px of [35.8, 37.2, 38.6, 40.0, 41.4, 42.6]) {
      b.geom(M.ceramic, cylGeo(0.08, 0.06, 0.14, 10), new THREE.Matrix4().makeTranslation(px, 1.08, 10.86), { zone });
      b.geom(M.plantGreen, new THREE.IcosahedronGeometry(0.11, 1), new THREE.Matrix4().compose(new THREE.Vector3(px, 1.24, 10.86), new THREE.Quaternion(), new THREE.Vector3(1, 1.3, 1)), { zone });
    }
    sb.poster('photosynthesis', zone, 39.0, 1.95, 2.1, 'pz', 0.72, 1.0);
    sb.poster('cell', zone, 41.6, 1.95, 2.1, 'pz');
    sb.poster('periodic', zone, 34.1, 2.0, 3.6, 'px');
    sb.planter(zone, 43.4, 10.4, 0.3, 1.3);
    this.teachers.push({ room: 104, x: 43.2, z: 6.55, yaw: FACE_NX, pace: [{ x: 43.2, z: 5.3 }, { x: 43.2, z: 7.9 }] });
  }

  // ------------------------------------------------------------------ library
  library() {
    const { b, M, P, sb, T } = this;
    const zone = 'r106';
    const doorIn = L.doorPoints(106).in;
    const hub = { x: 50.1, z: 5.0 };
    // reading tables
    for (const [cx, cz] of [[48.6, 8.5], [51.6, 8.5], [48.6, 12.0], [51.6, 12.0]]) {
      P.libTable.place(b, zone, cx, 0, cz, 0);
      this.collide(cx - 0.9, cz - 0.45, cx + 0.9, cz + 0.45, 0, 0.8);
      for (const dx of [-0.45, 0.45]) {
        for (const side of [-1, 1]) {
          const x = cx + dx, z = cz + side * 0.72;
          const yaw = side < 0 ? FACE_PZ : FACE_NZ;
          P.woodChair.place(b, zone, x, 0, z, yaw);
          const az = cz + side * 1.3;
          this.seat(106, 'chair', x, z, 0, 0.48, yaw, x, az, [doorIn, hub, { x: hub.x, z: az }, { x, z: az }]);
        }
      }
    }
    // lounge
    b.box(M.rug, 47.6, 0, 15.6, 52.4, 0.012, 19.0, { zone, cast: false });
    P.coffeeTable.place(b, zone, 50, 0, 17.4, 0);
    this.collide(49.4, 17.1, 50.6, 17.7, 0, 0.45);
    const lp = { x: 50.1, z: 14.6 };
    P.sofa.place(b, zone, 50, 0, 18.75, FACE_NZ);
    this.collide(48.85, 18.4, 51.15, 19.3, 0, 0.9);
    for (const dx of [-0.7, 0, 0.7]) this.seat(106, 'sofa', 50 + dx, 18.82, 0, 0.44, FACE_NZ, 50 + dx, 18.2, [doorIn, hub, lp, { x: 50 + dx, z: 16.4 }, { x: 50 + dx, z: 18.2 }]);
    P.armchair.place(b, zone, 47.85, 0, 17.4, FACE_PX);
    this.collide(47.4, 16.85, 48.3, 17.95, 0, 0.9);
    this.seat(106, 'armchair', 47.92, 17.4, 0, 0.44, FACE_PX, 48.6, 16.6, [doorIn, hub, lp, { x: 48.6, z: 15.6 }, { x: 48.6, z: 16.6 }]);
    P.armchair.place(b, zone, 52.15, 0, 17.4, FACE_NX);
    this.collide(51.7, 16.85, 52.6, 17.95, 0, 0.9);
    this.seat(106, 'armchair', 52.08, 17.4, 0, 0.44, FACE_NX, 51.4, 16.6, [doorIn, hub, lp, { x: 51.4, z: 15.6 }, { x: 51.4, z: 16.6 }]);
    for (const [bx, bz] of [[48.5, 15.75], [51.5, 15.75]]) {
      P.beanbag.place(b, zone, bx, 0, bz, 0);
      this.seat(106, 'beanbag', bx, bz, 0, 0.34, FACE_PZ, bx, bz - 0.8, [doorIn, hub, { x: hub.x, z: 14.2 }, { x: bx, z: 14.2 }, { x: bx, z: bz - 0.8 }]);
    }
    P.floorLamp.place(b, zone, 47.6, 0, 19.3, 0);
    sb.planter(zone, 53.2, 19.3, 0.3, 1.2);
    sb.planter(zone, 53.2, 15.4, 0.26, 1.0);
    // shelves along the corridor wall, west wall (lounge) and the stacks
    bookshelf(b, M, zone, 55.5, 2.47, FACE_PZ, 8.2, 2.2, 0.36, 6, 3, { back: false });
    this.collide(51.4, 2.1, 59.6, 2.5, 0, 2.2);
    bookshelf(b, M, zone, 46.47, 17.0, FACE_PX, 4.4, 2.0, 0.36, 5, 5, { back: false });
    this.collide(46.1, 14.8, 46.5, 19.2, 0, 2.0);
    let seed = 9;
    for (const sz of [4.9, 7.7, 10.5, 13.3]) {
      bookshelf(b, M, zone, 56.3, sz - 0.3, FACE_NZ, 4.2, 1.9, 0.6, 5, seed++, { back: false, doubleSided: true });
      this.collide(54.2, sz - 0.3, 58.4, sz + 0.3, 0, 1.9);
      this.interactables.push({ type: 'books', x: 54.2, y: 1.1, z: sz, radius: 0.5, reach: 2.2, label: 'Browse books' });
    }
    this.interactables.push({ type: 'books', x: 55.5, y: 1.3, z: 2.4, radius: 1.5, reach: 2.2, label: 'Browse books' });
    // circulation desk
    b.box(M.woodMid, 46.2, 0, 3.0, 47.95, 1.02, 3.45, { zone });
    b.box(M.woodMid, 47.5, 0, 3.45, 47.95, 1.02, 5.7, { zone });
    b.box(M.white, 46.15, 1.02, 2.95, 48.0, 1.06, 3.5, { zone });
    b.box(M.white, 47.45, 1.02, 3.45, 48.0, 1.06, 5.75, { zone });
    this.collide(46.15, 2.95, 48.0, 5.75, 0, 1.06);
    P.monitor.place(b, zone, 47.2, 1.06, 4.4, FACE_PX + 0.4);
    sb.poster('quiet', zone, 46.12, 2.3, 6.4, 'px');
    // computer station on the west wall
    b.box(M.woodMid, 46.1, 0.72, 7.2, 46.85, 0.76, 12.6, { zone });
    for (const tz of [7.4, 12.4]) b.box(M.woodDark, 46.2, 0, tz - 0.03, 46.8, 0.72, tz + 0.03, { zone });
    this.collide(46.1, 7.2, 46.85, 12.6, 0, 0.8);
    for (const mz of [8.0, 9.9, 11.8]) {
      P.monitor.place(b, zone, 46.45, 0.76, mz, FACE_PX);
      P.officeChair.place(b, zone, 47.25, 0, mz, FACE_PX);
      this.interactables.push({ type: 'computer', x: 46.5, y: 1.0, z: mz, radius: 0.35, reach: 2.0, label: 'Use computer' });
    }
    sb.picture(T.libraryWordTex, zone, 55.5, 3.12, 2.13, 4.2, 0.7, 'pz', { rough: 0.5, transparent: true });
    sb.poster('read', zone, 46.12, 2.75, 15.6, 'px', 0.5, 0.68);
    sb.clock(zone, 46.1, 2.8, 4.4, 'px');
    this.teachers.push({ room: 106, x: 46.9, z: 4.3, yaw: FACE_PX, pace: [{ x: 46.9, z: 3.9 }, { x: 46.9, z: 5.1 }], librarian: true });
  }

  office() {
    const { b, M, P, sb, T } = this;
    const zone = 'r106';
    const O = L.OFFICE;
    // desk (principal faces the door)
    b.box(M.woodDark, 57.0, 0.76, 16.6, 58.0, 0.8, 18.6, { zone });
    b.box(M.woodDark, 57.04, 0, 16.64, 57.96, 0.76, 16.84, { zone });
    b.box(M.woodDark, 57.04, 0, 18.36, 57.96, 0.76, 18.56, { zone });
    b.box(M.woodDark, 57.0, 0.1, 16.64, 57.06, 0.76, 18.56, { zone });
    b.box(M.gold, 56.97, 0.8, 17.3, 57.12, 0.86, 17.9, { zone, cast: false });
    P.officeChair.place(b, zone, 58.6, 0, 17.6, FACE_NX);
    P.monitor.place(b, zone, 57.6, 0.8, 18.1, FACE_NX + 0.5);
    P.woodChair.place(b, zone, 56.1, 0, 17.1, FACE_PX);
    P.woodChair.place(b, zone, 56.1, 0, 18.2, FACE_PX);
    bookshelf(b, M, zone, 59.62, 17.8, FACE_NX, 2.6, 2.2, 0.36, 5, 21, { back: false });
    P.filing.place(b, zone, 55.0, 0, 19.6, FACE_NZ);
    sb.planter(zone, 54.5, 15.5, 0.24, 1.0);
    // flag on a pole
    b.geom(M.gold, cylGeo(0.015, 0.015, 2.2, 8), new THREE.Matrix4().makeTranslation(59.4, 1.1, 15.6), { zone });
    b.box(M.navy, 59.39, 1.45, 15.62, 59.41, 2.05, 16.5, { zone, cast: false });
    sb.picture(T.diplomaTex, zone, 56.3, 1.9, 19.98, 0.5, 0.38, 'nz');
    sb.picture(T.diplomaTex, zone, 57.6, 1.9, 19.98, 0.5, 0.38, 'nz');
    // door plate on the library side
    b.box(M.navy, O.x0 - 0.09, 1.38, 17.55, O.x0 - 0.08, 1.62, 17.88, { zone, cast: false });
    sb.picture(T.principalPlateTex, zone, O.x0 - 0.091, 1.5, 17.715, 0.31, 0.2, 'nx');
  }

  // ------------------------------------------------------------------ auditorium
  auditorium() {
    const { b, M, P, sb, T } = this;
    const zone = 'r102';
    const A = L.AUD;
    const doorIn = L.doorPoints(102).in;
    const slopeY = (z) => (z <= A.backAisleZ ? 0 : z >= A.slopeZ1 ? A.frontY : (A.frontY * (z - A.backAisleZ)) / (A.slopeZ1 - A.backAisleZ));
    // floors
    b.box(M.carpetRed, A.x0, -0.12, 2.0, A.x1 - 0.1, 0, A.backAisleZ, { zone, cast: false });
    const len = Math.hypot(A.slopeZ1 - A.backAisleZ, A.frontY);
    const slope = new THREE.PlaneGeometry(A.x1 - 0.1 - A.x0, len, 1, 1);
    const uv = slope.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (A.x1 - A.x0), uv.getY(i) * len);
    const ang = Math.atan2(-A.frontY, A.slopeZ1 - A.backAisleZ);
    const sm = new THREE.Matrix4().compose(
      new THREE.Vector3((A.x0 + A.x1 - 0.1) / 2, A.frontY / 2, (A.backAisleZ + A.slopeZ1) / 2),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(ang - PI / 2, 0, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    b.geom(M.carpetRed, slope, sm, { zone, cast: false });
    b.box(M.carpetRed, A.x0, A.frontY - 0.12, A.slopeZ1, A.x1 - 0.1, A.frontY, A.stageZ, { zone, cast: false });
    // stage
    b.box(M.planksDark, A.x0, A.frontY, A.stageZ, A.x1 - 0.1, A.stageY - 0.04, A.z1, { zone });
    b.box(M.planks, A.x0, A.stageY - 0.04, A.stageZ, A.x1 - 0.1, A.stageY, A.z1, { zone });
    b.box(M.gold, A.x0 + 0.6, A.stageY - 0.06, A.stageZ - 0.02, A.x1 - 0.7, A.stageY - 0.03, A.stageZ, { zone, cast: false });
    // stage steps (visual)
    for (const [sx0, sx1] of [[0.6, 2.0], [15.9, 17.3]]) {
      for (let i = 0; i < 6; i++) {
        const z0 = A.slopeZ1 + i * ((A.stageZ - A.slopeZ1) / 6);
        b.box(M.planksDark, sx0, A.frontY, z0, sx1, A.frontY + (i + 1) * ((A.stageY - A.frontY) / 6), A.stageZ, { zone });
      }
      b.box(M.metalDark, sx0 - 0.04, A.frontY, A.slopeZ1, sx0, A.stageY + 0.9, A.stageZ, { zone });
      b.box(M.metalDark, sx1, A.frontY, A.slopeZ1, sx1 + 0.04, A.stageY + 0.9, A.stageZ, { zone });
    }
    this.collide(0.56, A.slopeZ1, 0.6, A.stageZ, A.frontY, A.stageY + 0.9, 'rail');
    this.collide(2.0, A.slopeZ1, 2.04, A.stageZ, A.frontY, A.stageY + 0.9, 'rail');
    this.collide(15.86, A.slopeZ1, 15.9, A.stageZ, A.frontY, A.stageY + 0.9, 'rail');
    this.collide(17.3, A.slopeZ1, 17.34, A.stageZ, A.frontY, A.stageY + 0.9, 'rail');
    // proscenium + curtains
    const pz = 16.25;
    b.box(M.plasterDark, A.x0, A.stageY, pz - 0.15, 2.2, A.ceil, pz + 0.15, { zone, collide: true });
    b.box(M.plasterDark, 15.7, A.stageY, pz - 0.15, A.x1 - 0.1, A.ceil, pz + 0.15, { zone, collide: true });
    b.box(M.plasterDark, 2.2, 5.3, pz - 0.15, 15.7, A.ceil, pz + 0.15, { zone });
    b.box(M.gold, 2.12, A.stageY, pz - 0.18, 2.22, 5.38, pz - 0.15, { zone, cast: false });
    b.box(M.gold, 15.68, A.stageY, pz - 0.18, 15.78, 5.38, pz - 0.15, { zone, cast: false });
    b.box(M.gold, 2.12, 5.3, pz - 0.18, 15.78, 5.38, pz - 0.15, { zone, cast: false });
    this.curtain(zone, M.velvet, 2.2, 4.3, pz + 0.25, A.stageY, 5.3, 7);
    this.curtain(zone, M.velvet, 13.6, 15.7, pz + 0.25, A.stageY, 5.3, 7);
    this.curtain(zone, M.velvet, 2.2, 15.7, pz + 0.2, 4.5, 5.3, 34);
    this.curtain(zone, M.velvetDark, 0.4, 17.4, 19.6, A.stageY, 6.4, 40);
    sb.picture(T.stageBannerTex, zone, 9, 3.7, 19.45, 6.4, 0.8, 'nz', { rough: 0.6 });
    // stage furniture
    P.podium.place(b, zone, 12.4, A.stageY, 17.3, FACE_NZ);
    this.collide(12.1, 17.07, 12.7, 17.53, A.stageY, A.stageY + 1.2);
    P.piano.place(b, zone, 5.2, A.stageY, 17.8, FACE_NZ + 0.35);
    this.collide(4.3, 17.0, 6.1, 18.8, A.stageY, A.stageY + 1.0);
    this.interactables.push({ type: 'piano', x: 5.0, y: A.stageY + 0.9, z: 17.2, radius: 0.6, reach: 2.2, label: 'Play piano' });
    for (const lx of [5.5, 9, 12.5]) b.geom(M.stageGlow, new THREE.CircleGeometry(1.5, 32).rotateX(-PI / 2), new THREE.Matrix4().makeTranslation(lx, A.stageY + 0.012, 17.6), { zone, cast: false, receive: false });
    // light bar + cans
    b.box(M.metalDark, 1.0, 6.18, 14.95, 17.0, 6.26, 15.05, { zone, cast: false });
    for (let lx = 2; lx <= 16; lx += 2) {
      b.geom(M.metalDark, cylGeo(0.11, 0.13, 0.32, 12), new THREE.Matrix4().compose(new THREE.Vector3(lx, 6.0, 15.1), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, 0, 0)), new THREE.Vector3(1, 1, 1)), { zone, cast: false });
      b.geom(M.lampGlow, new THREE.CircleGeometry(0.1, 12), new THREE.Matrix4().compose(new THREE.Vector3(lx, 5.88, 15.21), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7 + PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)), { zone, cast: false });
    }
    // ceiling + round lights
    b.box(M.plasterDark, A.x0, A.ceil, 2.0, A.x1, A.ceil + 0.1, A.z1, { zone });
    for (let lx = 2.5; lx < 17; lx += 3.2) for (let lz = 4; lz < 15; lz += 3.4) {
      b.geom(M.lightWarm, new THREE.CircleGeometry(0.28, 20).rotateX(PI / 2), new THREE.Matrix4().makeTranslation(lx, A.ceil - 0.01, lz), { zone, cast: false, receive: false });
      this.sb.lights.push({ x: lx, y: A.ceil - 0.05, z: lz, zone, warm: true });
    }
    // speakers + wall panels
    for (const sx of [1.1, 16.8]) b.box(M.plasticBlack, sx - 0.35, 5.0, 15.7, sx + 0.35, 6.0, 16.05, { zone });
    for (let pz2 = 4.5; pz2 < 14; pz2 += 2.4) {
      b.box(M.fabricPurple, A.x0, 2.0, pz2 - 0.9, A.x0 + 0.06, 4.2, pz2 + 0.9, { zone, cast: false });
      b.box(M.fabricPurple, A.x1 - 0.16, 2.0, pz2 - 0.9, A.x1 - 0.1, 4.2, pz2 + 0.9, { zone, cast: false });
    }
    sb.clock(zone, A.door, 3.6, 2.1, 'pz');
    sb.picture(T.exitTex, zone, 4.0, 2.5, 2.105, 0.6, 0.22, 'pz', { emissive: 1.2, rough: 0.3 });
    sb.picture(T.exitTex, zone, 14.0, 2.5, 2.105, 0.6, 0.22, 'pz', { emissive: 1.2, rough: 0.3 });
    // seats
    const aisleX = (8.35 + 9.55) / 2;
    const blocks = [[1.1, 8.35], [9.55, 16.8]];
    for (let k = 0; k < 9; k++) {
      const z = 4.6 + 1.05 * k;
      const fy = slopeY(z);
      for (const [bx0, bx1] of blocks) {
        const n = Math.floor((bx1 - bx0) / 0.6);
        const sx = (bx0 + bx1) / 2 - (n * 0.6) / 2;
        for (let i = 0; i < n; i++) {
          const x = sx + 0.3 + i * 0.6;
          P.audSeat.place(b, zone, x, fy, z, FACE_PZ);
          const az = z + 0.55;
          this.seat(102, 'aud', x, z, fy, 0.46, FACE_PZ, x, az, [doorIn, { x: aisleX, z: 3.4 }, { x: aisleX, z: az }, { x, z: az }]);
        }
        P.audArmEnd.place(b, zone, sx + 0.03, fy, z, FACE_PZ);
        this.collide(sx, z - 0.32, sx + n * 0.6, z + 0.22, fy - 0.2, fy + 1.05, 'seats');
      }
      // aisle step lights
      b.box(M.lampGlow, aisleX - 0.6, fy + 0.005, z + 0.5, aisleX - 0.52, fy + 0.02, z + 0.54, { zone, cast: false, receive: false });
      b.box(M.lampGlow, aisleX + 0.52, fy + 0.005, z + 0.5, aisleX + 0.6, fy + 0.02, z + 0.54, { zone, cast: false, receive: false });
    }
    this.teachers.push({ room: 102, x: 9, z: 17.0, yaw: FACE_NZ, pace: [{ x: 7.2, z: 17.0 }, { x: 10.8, z: 17.0 }], stage: true });
  }

  /** Velvet curtain with folds between x0..x1 at z, from y0 to y1. */
  curtain(zone, mat, x0, x1, z, y0, y1, folds) {
    const w = x1 - x0, h = y1 - y0;
    const g = new THREE.PlaneGeometry(w, h, folds * 6, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(((x + w / 2) / w) * folds * PI * 2) * 0.09);
    }
    g.computeVertexNormals();
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 1.5, uv.getY(i) * h);
    const m = new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PI, 0)), new THREE.Vector3(1, 1, 1));
    this.b.geom(mat, g, m, { zone });
    const m2 = new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, z + 0.02), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    this.b.geom(mat, g, m2, { zone, cast: false });
  }
}

export { Proto };
