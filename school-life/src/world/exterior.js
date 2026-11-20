// Outside the school: ground, plaza, parking lot, road, bus, flag, trees, field, lamps.
import * as THREE from 'three';
import { cylGeo } from '../engine/builder.js';
import { mulberry32 } from '../engine/textures.js';

export function buildExterior(b, M, T) {
  const zone = 'exterior';
  const rand = mulberry32(2026);
  const out = { lamps: [], flag: null };
  const gy = -0.02;
  // grass around the footprint (the building has its own floors)
  b.box(M.grass, -160, gy - 0.2, -160, 220, gy, -11.3, { zone, cast: false });
  b.box(M.grass, -160, gy - 0.2, 20.3, 220, gy, 160, { zone, cast: false });
  b.box(M.grass, -160, gy - 0.2, -11.3, -0.3, gy, 20.3, { zone, cast: false });
  b.box(M.grass, 60.3, gy - 0.2, -11.3, 220, gy, 20.3, { zone, cast: false });
  // courtyard garden
  b.box(M.grass, 34.0, gy - 0.2, 11.3, 44.0, gy, 20.15, { zone, cast: false });
  b.box(M.sidewalk, 38.4, gy, 11.3, 39.6, 0.0, 20.15, { zone, cast: false });
  for (const [px, pz] of [[36, 14], [42, 14], [36, 18], [42, 18]]) {
    b.box(M.woodMid, px - 0.8, 0, pz - 0.6, px + 0.8, 0.4, pz + 0.6, { zone });
    b.box(M.soil, px - 0.72, 0.4, pz - 0.52, px + 0.72, 0.42, pz + 0.52, { zone, cast: false });
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(px - 0.5 + k * 0.25, 0.6, pz + (rand() - 0.5) * 0.5), new THREE.Quaternion(), new THREE.Vector3(1, 1.3, 1));
      b.geom(k % 2 ? M.plantGreen : M.plantDark, new THREE.IcosahedronGeometry(0.18, 1), m, { zone });
    }
  }
  tree(b, M, 39, 16.3, 5.0, rand, zone);
  // plaza + walkway + sidewalks
  b.box(M.sidewalk, 15, gy, 20.3, 37, 0.0, 30, { zone, cast: false });
  b.box(M.sidewalk, 24.6, gy, 30, 27.4, 0.0, 47, { zone, cast: false });
  b.box(M.sidewalk, -160, gy, 46.6, 220, 0.04, 49.4, { zone, cast: false });
  b.box(M.concrete, -160, 0.0, 49.4, 220, 0.16, 49.6, { zone, cast: false });
  // parking lot / bus loop
  b.box(M.asphalt, -12, gy, 32, 66, -0.005, 46.6, { zone, cast: false });
  for (let x = -8; x <= 62; x += 3) if (x < 22 || x > 30) b.box(M.white, x - 0.05, -0.004, 32.2, x + 0.05, 0.0, 36.6, { zone, cast: false });
  b.box(M.yellow, -10, -0.004, 41.8, 22, 0.0, 42.0, { zone, cast: false });
  // road
  b.box(M.asphalt, -160, gy, 49.6, 220, -0.005, 58.4, { zone, cast: false });
  for (let x = -150; x < 210; x += 6) b.box(M.yellow, x, -0.004, 53.92, x + 3, 0.0, 54.08, { zone, cast: false });
  b.box(M.sidewalk, -160, gy, 58.4, 220, 0.04, 61.2, { zone, cast: false });
  // crosswalk
  for (let x = 24; x < 28; x += 0.7) b.box(M.white, x, -0.004, 49.8, x + 0.4, 0.0, 58.2, { zone, cast: false });

  // bus
  schoolBus(b, M, T, 9, 39.2, zone);
  // a few parked cars
  const carCols = [M.plasticRed, M.plasticBlue, M.plasticWhite, M.metalGrey, M.plasticGreen];
  let ci = 0;
  for (const x of [35.5, 41.5, 47.5, 53.5, 59.5]) car(b, M, carCols[ci++ % carCols.length], x, 34.4, zone);

  // flagpole + flag
  b.geom(M.chrome, cylGeo(0.07, 0.1, 10, 12), new THREE.Matrix4().makeTranslation(39, 5, 26.5), { zone });
  b.geom(M.gold, new THREE.SphereGeometry(0.16, 12, 8), new THREE.Matrix4().makeTranslation(39, 10.08, 26.5), { zone });
  b.box(M.concrete, 37.9, 0, 25.4, 40.1, 0.25, 27.6, { zone });
  out.flag = { x: 39.08, y: 9.6, z: 26.5, w: 2.4, h: 1.5 };

  // monument sign
  b.box(M.brick, 22.5, 0, 31.2, 29.5, 1.5, 32.0, { zone, collide: false });
  b.box(M.concrete, 22.35, 1.5, 31.05, 29.65, 1.62, 32.15, { zone });
  const signMat = M.picture(T.canopySignTex, { rough: 0.5, transparent: true });
  b.decal(signMat, 26, 0.9, 32.006, 6.4, 0.55, 'pz', { zone });
  b.decal(signMat, 26, 0.9, 31.194, 6.4, 0.55, 'nz', { zone });
  for (let k = 0; k < 9; k++) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(22.8 + k * 0.8, 0.25, 32.5), new THREE.Quaternion(), new THREE.Vector3(1, 0.7, 1));
    b.geom(k % 2 ? M.plantGreen : M.plantDark, new THREE.IcosahedronGeometry(0.35, 1), m, { zone });
  }

  // bushes along the front of the building
  for (let x = 1; x < 60; x += 1.6) {
    if (x > 19 && x < 33) continue;
    if (x > 33.5 && x < 44.5) continue;
    const s = 0.45 + rand() * 0.25;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, s * 0.6, 21.0 + rand() * 0.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 3, 0)), new THREE.Vector3(s * 1.3, s, s));
    b.geom(rand() < 0.5 ? M.plantGreen : M.plantDark, new THREE.IcosahedronGeometry(1, 1), m, { zone });
  }
  // trees
  const spots = [];
  for (let x = -40; x <= 100; x += 9) if (x < -1 || x > 56) spots.push([x + rand() * 2, 30.8 + rand()]);
  for (let x = -40; x <= 100; x += 8) spots.push([x + rand() * 3, 64 + rand() * 4]);
  for (const [x, z] of [[-8, 4], [-12, -6], [-7, 14], [-18, 22], [68, 2], [72, -8], [67, 15], [78, 24], [-6, -18], [66, -20]]) spots.push([x, z]);
  for (let x = -30; x <= 90; x += 10) spots.push([x + rand() * 3, -66 - rand() * 6]);
  for (const [x, z] of spots) tree(b, M, x, z, 4.5 + rand() * 3, rand, zone);
  // distant forest ring
  for (let i = 0; i < 150; i++) {
    const a = (i / 150) * Math.PI * 2 + rand() * 0.03;
    const r = 120 + rand() * 40;
    const x = 30 + Math.cos(a) * r, z = 5 + Math.sin(a) * r;
    const h = 8 + rand() * 7;
    const col = new THREE.Color().setHSL(0.27 + rand() * 0.06, 0.45, 0.22 + rand() * 0.1);
    b.geom(M.leaves, new THREE.ConeGeometry(h * 0.32, h, 7), new THREE.Matrix4().makeTranslation(x, h / 2 + 1, z), { zone, cast: false, color: col });
  }

  // sports field behind the school
  b.box(M.grass, 4, gy, -58, 56, -0.01, -22, { zone, cast: false });
  const line = (x0, z0, x1, z1) => b.box(M.white, x0, -0.009, z0, x1, -0.004, z1, { zone, cast: false });
  line(6, -56.1, 54, -55.9); line(6, -24.1, 54, -23.9); line(5.9, -56, 6.1, -24); line(53.9, -56, 54.1, -24); line(29.9, -56, 30.1, -24);
  const circle = new THREE.RingGeometry(4.9, 5.1, 48).rotateX(-Math.PI / 2);
  b.geom(M.white, circle, new THREE.Matrix4().makeTranslation(30, -0.006, -40), { zone, cast: false });
  for (const x of [6, 54]) {
    const s = x < 30 ? 1 : -1;
    b.box(M.white, x - 0.05, 0, -41.8, x + 0.05, 2.4, -41.7, { zone });
    b.box(M.white, x - 0.05, 0, -38.3, x + 0.05, 2.4, -38.2, { zone });
    b.box(M.white, x - 0.05, 2.35, -41.8, x + 0.05, 2.45, -38.2, { zone });
    b.box(M.plastic, x - s * 0.9, 0, -41.75, x, 2.4, -38.25, { zone, cast: false, receive: false });
  }
  // fence around the field
  for (let x = 0; x <= 60; x += 2.5) b.box(M.metalGrey, x - 0.03, 0, -60.03, x + 0.03, 1.8, -59.97, { zone, cast: false });
  for (const y of [0.9, 1.75]) b.box(M.metalGrey, 0, y, -60.02, 60, y + 0.04, -59.98, { zone, cast: false });

  // street lamps
  for (let x = -30; x <= 90; x += 15) {
    b.geom(M.metalDark, cylGeo(0.07, 0.1, 6, 10), new THREE.Matrix4().makeTranslation(x, 3, 47.5), { zone });
    b.box(M.metalDark, x - 0.05, 5.9, 47.5, x + 0.05, 6.0, 48.8, { zone });
    b.box(M.metalDark, x - 0.25, 5.8, 48.5, x + 0.25, 5.95, 49.2, { zone });
    b.box(M.outdoorGlow, x - 0.2, 5.78, 48.55, x + 0.2, 5.8, 49.15, { zone, cast: false, receive: false });
    out.lamps.push({ x, y: 5.75, z: 48.85 });
  }
  // bike rack
  for (let k = 0; k < 5; k++) b.geom(M.chrome, new THREE.TorusGeometry(0.35, 0.025, 6, 16, Math.PI), new THREE.Matrix4().makeTranslation(17 + k * 0.6, 0.0, 26), { zone });
  return out;
}

export function tree(b, M, x, z, h, rand, zone) {
  const trunkH = h * 0.42;
  b.geom(M.trunk, cylGeo(0.12 * h / 5, 0.2 * h / 5, trunkH, 8), new THREE.Matrix4().makeTranslation(x, trunkH / 2, z), { zone });
  const blobs = 3 + ((rand() * 3) | 0);
  for (let i = 0; i < blobs; i++) {
    const r = h * (0.22 + rand() * 0.12);
    const col = new THREE.Color().setHSL(0.24 + rand() * 0.08, 0.45 + rand() * 0.2, 0.3 + rand() * 0.12);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x + (rand() - 0.5) * h * 0.35, trunkH + r * 0.7 + rand() * h * 0.25, z + (rand() - 0.5) * h * 0.35),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(), rand() * 3, rand())),
      new THREE.Vector3(r, r * (0.85 + rand() * 0.3), r),
    );
    b.geom(M.leaves, new THREE.IcosahedronGeometry(1, 1), m, { zone, color: col });
  }
}

function car(b, M, mat, x, z, zone) {
  b.box(mat, x - 0.95, 0.3, z - 2.1, x + 0.95, 0.95, z + 2.1, { zone });
  b.box(mat, x - 0.85, 0.95, z - 1.1, x + 0.85, 1.45, z + 1.2, { zone });
  b.box(M.glassDark, x - 0.86, 1.0, z - 1.0, x + 0.86, 1.4, z + 1.1, { zone, cast: false });
  for (const [dx, dz] of [[-0.85, -1.3], [0.85, -1.3], [-0.85, 1.35], [0.85, 1.35]]) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x + dx, 0.32, z + dz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1));
    b.geom(M.black, cylGeo(0.32, 0.32, 0.24, 14), m, { zone });
  }
  b.box(M.outdoorGlow, x - 0.8, 0.7, z - 2.11, x - 0.5, 0.82, z - 2.1, { zone, cast: false });
  b.box(M.outdoorGlow, x + 0.5, 0.7, z - 2.11, x + 0.8, 0.82, z - 2.1, { zone, cast: false });
}

function schoolBus(b, M, T, x, z, zone) {
  // front of the bus points +X
  const L2 = 5.4, W = 1.25;
  b.box(M.yellow, x - L2, 0.55, z - W, x + L2 - 1.4, 3.0, z + W, { zone });
  b.box(M.yellow, x + L2 - 1.4, 0.55, z - W + 0.08, x + L2, 1.55, z + W - 0.08, { zone });
  b.box(M.yellow, x - L2 + 0.05, 3.0, z - W + 0.1, x + L2 - 1.45, 3.12, z + W - 0.1, { zone });
  b.box(M.black, x - L2, 0.55, z - W - 0.02, x + L2, 0.75, z + W + 0.02, { zone, cast: false });
  b.box(M.black, x - L2, 1.55, z - W - 0.015, x + L2 - 1.4, 1.62, z + W + 0.015, { zone, cast: false });
  b.box(M.black, x - L2, 1.25, z - W - 0.015, x + L2 - 1.4, 1.3, z + W + 0.015, { zone, cast: false });
  // windows
  for (let k = 0; k < 8; k++) {
    const wx = x - L2 + 0.6 + k * 1.15;
    b.box(M.glassDark, wx, 1.8, z - W - 0.012, wx + 0.95, 2.6, z + W + 0.012, { zone, cast: false });
  }
  b.box(M.glassDark, x + L2 - 1.42, 1.75, z - W + 0.15, x + L2 - 1.38, 2.75, z + W - 0.15, { zone, cast: false });
  b.box(M.glassDark, x - L2 - 0.01, 1.8, z - W + 0.2, x - L2 + 0.01, 2.6, z + W - 0.2, { zone, cast: false });
  // grille, lights, bumper
  b.box(M.chrome, x + L2, 0.75, z - 0.6, x + L2 + 0.02, 1.4, z + 0.6, { zone, cast: false });
  b.box(M.black, x + L2 - 0.1, 0.4, z - W - 0.05, x + L2 + 0.12, 0.6, z + W + 0.05, { zone });
  for (const s of [-1, 1]) {
    b.box(M.outdoorGlow, x + L2 + 0.005, 1.15, z + s * 0.9 - 0.15, x + L2 + 0.03, 1.4, z + s * 0.9 + 0.15, { zone, cast: false });
    b.box(M.red, x - L2 - 0.03, 2.75, z + s * 0.85 - 0.12, x - L2, 2.95, z + s * 0.85 + 0.12, { zone, cast: false });
  }
  // stop arm
  b.box(M.red, x + 2.0, 1.85, z - W - 0.06, x + 2.45, 2.3, z - W - 0.04, { zone, cast: false });
  // wheels
  for (const [dx, dz] of [[-3.4, -W + 0.12], [-3.4, W - 0.12], [3.2, -W + 0.12], [3.2, W - 0.12]]) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x + dx, 0.5, z + dz), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1));
    b.geom(M.black, cylGeo(0.5, 0.5, 0.32, 18), m, { zone });
    b.geom(M.chrome, cylGeo(0.22, 0.22, 0.34, 12), m, { zone, cast: false });
  }
  // lettering
  const mat = M.picture(T.busTextTex, { rough: 0.5, transparent: true });
  b.decal(mat, x - 0.6, 2.82, z + W + 0.005, 6.4, 0.3, 'pz', { zone });
  b.decal(mat, x - 0.6, 2.82, z - W - 0.005, 6.4, 0.3, 'nz', { zone });
  b.physics.addCollider(x - L2, z - W, x + L2, z + W, 0, 3.1, 'bus');
}
