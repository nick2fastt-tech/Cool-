// Episode 8 "The Escape": the street outside Aether Mart, the store inside, the city prison (cell block + outside),
// and extras for the night-time downtown (cars that get shoved, street lights that fall, the Soul Stealer's rooftop).
import * as THREE from 'three';
import { mat, mk, grp, rng, hash, canvasTex, clamp, lerp, smoothstep } from './util.js';
import { lights, box, plane, building, streetLamp, tree, buildCar } from './sets.js';
import * as TX from './textures.js';

const P = Math.PI;

// ------------------------------------------------------------------ helpers
// many copies of one shape with their own colours (cheap to draw)
function instances(parent, geo, material, items) {
  const im = new THREE.InstancedMesh(geo, material, items.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
  items.forEach((it, i) => {
    e.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0); q.setFromEuler(e);
    ps.set(it.x, it.y, it.z); sc.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    m4.compose(ps, q, sc); im.setMatrixAt(i, m4); im.setColorAt(i, c.set(it.c ?? 0xffffff));
  });
  im.castShadow = true; im.receiveShadow = true;
  parent.add(im);
  return im;
}
function sign(parent, text, w, h, pos, bg = '#123a7a', fg = '#ffffff', rot = [0, 0, 0], font) {
  const tex = TX.signTex(text, bg, fg, 1024, Math.round(1024 * h / w), font);
  return mk(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }), parent, pos, rot, null, false);
}
// a painted "inside the store" view for the shop windows
function storeWindowTex() {
  return canvasTex(512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f4f8ff'); g.addColorStop(1, '#d8e0ea');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; for (let x = 20; x < w; x += 120) c.fillRect(x, 8, 80, 8);
    const r = rng(8), cols = ['#3ad0a0', '#2f8cff', '#ff5a3a', '#ffd23f', '#b07aff', '#f2f2f2', '#5ac05a'];
    for (const sx of [10, 190, 370]) {
      c.fillStyle = '#9aa4b0'; c.fillRect(sx, 70, 130, 186);
      for (let row = 0; row < 4; row++) {
        c.fillStyle = '#c8ced6'; c.fillRect(sx, 100 + row * 40, 130, 5);
        for (let i = 0; i < 9; i++) { c.fillStyle = cols[Math.floor(r() * cols.length)]; const bh = 14 + r() * 16; c.fillRect(sx + 4 + i * 14, 100 + row * 40 - bh, 11, bh); }
      }
    }
  });
}

// ------------------------------------------------------------------ THE STREET OUTSIDE AETHER MART (afternoon)
// Sidewalk along x (z 0..4.2) with the store front at z = 0 facing +z, road z 4.2..12.2, far sidewalk beyond.
// Battle Wars HQ sits at the far end of the street (+x).
export function buildShopStreet() {
  const g = new THREE.Group();
  lights(g, { sunPos: [-16, 13, 18], target: [0, 0, 2], shadowSize: 22, sunI: 2.3, hemi: 1.15, sun: 0xffe4bc });
  const walk = new THREE.MeshStandardMaterial({ map: TX.sidewalkTex(), roughness: 0.9 }); walk.map.repeat.set(40, 1.4);
  plane(g, 160, 4.2, walk, [0, 0.004, 2.1]);
  const road = new THREE.MeshStandardMaterial({ map: TX.roadTex(), roughness: 0.9 }); road.map.repeat.set(16, 1);
  plane(g, 160, 8, road, [0, 0, 8.2]);
  const walk2 = new THREE.MeshStandardMaterial({ map: TX.sidewalkTex(), roughness: 0.9 }); walk2.map.repeat.set(40, 1.2);
  plane(g, 160, 3.4, walk2, [0, 0.004, 13.9]);
  plane(g, 300, 300, mat(0x7a8a6a, { r: 1 }), [0, -0.02, 0]);
  for (const z of [4.2, 12.2]) mk(new THREE.BoxGeometry(160, 0.1, 0.14), mat(0xcfcac0), g, [0, 0.05, z]);
  // --- the store
  const store = grp(g);
  box(store, 13, 6, 10, 0xe8e2d6, [0, 3, -5.2]);
  const wallM = mat(0xf2efe8, { r: 0.8 }), trimM = mat(0x2f6dff, { r: 0.4 });
  box(store, 4.8, 5.6, 0.4, 0, [-3.6, 2.8, -0.2], { material: wallM }); box(store, 4.8, 5.6, 0.4, 0, [3.6, 2.8, -0.2], { material: wallM });
  box(store, 2.4, 2.9, 0.4, 0, [0, 4.15, -0.2], { material: wallM });
  box(store, 13.2, 0.25, 0.6, 0, [0, 5.7, -0.1], { material: trimM });
  box(store, 13.2, 0.3, 0.5, 0, [0, 0.15, 0.05], { material: mat(0x5a6070, { r: 0.7 }) });
  // windows with the shop inside painted behind the glass
  const inside = new THREE.MeshBasicMaterial({ map: storeWindowTex() });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe2ff, transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0.6, depthWrite: false });
  for (const sd of [-1, 1]) {
    mk(new THREE.PlaneGeometry(3.6, 2.3), inside, store, [sd * 3.6, 1.75, 0.02], [0, 0, 0], null, false);
    mk(new THREE.PlaneGeometry(3.6, 2.3), glass, store, [sd * 3.6, 1.75, 0.05], [0, 0, 0], null, false);
    box(store, 3.8, 0.1, 0.12, 0x2a2e38, [sd * 3.6, 2.95, 0.05]); box(store, 3.8, 0.1, 0.12, 0x2a2e38, [sd * 3.6, 0.55, 0.05]);
    box(store, 0.08, 2.4, 0.12, 0x2a2e38, [sd * 3.6, 1.75, 0.06]);
  }
  sign(store, 'SALE!  MOPS 2 FOR 1', 1.6, 0.4, [-4.4, 2.5, 0.07], '#ffd23f', '#c0182a');
  sign(store, 'NEW: SUPER SPRAY', 1.5, 0.36, [4.4, 2.5, 0.07], '#3ad0a0', '#0b2a20');
  // entrance: a lit inside behind sliding glass doors
  box(store, 2.4, 2.6, 0.1, 0, [0, 1.3, -1.6], { material: new THREE.MeshBasicMaterial({ map: storeWindowTex() }) });
  for (const sd of [-1, 1]) box(store, 0.1, 2.7, 1.4, 0, [sd * 1.2, 1.35, -0.9], { material: wallM });
  box(store, 2.4, 0.1, 1.4, 0, [0, 2.75, -0.9], { material: wallM });
  plane(store, 2.4, 1.4, mat(0xd8dde4, { r: 0.6 }), [0, 0.01, -0.9]);
  const doors = [];
  for (const sd of [-1, 1]) {
    const d = grp(store, sd * 0.6, 0, 0.05);
    mk(new THREE.PlaneGeometry(1.15, 2.55), glass, d, [0, 1.3, 0], [0, 0, 0], null, false);
    box(d, 1.2, 0.08, 0.06, 0x2a2e38, [0, 2.6, 0]); box(d, 0.06, 2.6, 0.06, 0x2a2e38, [sd * 0.58, 1.3, 0]);
    doors.push({ d, sd });
  }
  // the big sign
  box(store, 7.4, 1.3, 0.25, 0, [0, 4.55, 0.18], { material: mat(0x123a7a, { r: 0.5 }) });
  const logo = canvasTex(1024, 180, (c, w, h) => {
    c.fillStyle = '#123a7a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.font = `120px ${TX.FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('AETHER MART', w / 2 - 40, h / 2 + 6);
    c.fillStyle = '#3ad0a0'; c.beginPath(); c.arc(w - 90, h / 2, 46, 0, 7); c.fill();
    c.fillStyle = '#ffffff'; c.font = 'bold 60px sans-serif'; c.fillText('✓', w - 90, h / 2 + 4);
  });
  mk(new THREE.PlaneGeometry(7.2, 1.2), new THREE.MeshBasicMaterial({ map: logo }), store, [0, 4.55, 0.32], [0, 0, 0], null, false);
  sign(store, 'CLEANING  •  HOME  •  SNACKS', 5.0, 0.36, [0, 3.62, 0.08], '#f2efe8', '#2a3a5a');
  // --- neighbours along the street, buildings across the street
  const cols = [0xd9c7a7, 0xc9d6e3, 0xe6b8a2, 0xbcd5c0, 0xd8d0e8, 0xf0dcb0, 0xb7c4d6];
  const R = rng(81);
  let x = 7;
  let i = 0;
  while (x < 66) { const w = 7 + R() * 5; building(g, x + w / 2, -7, w - 0.3, 14, 9 + R() * 12, cols[i % cols.length], 820 + i); x += w; i++; }
  x = -7;
  while (x > -70) { const w = 7 + R() * 5; building(g, x - w / 2, -7, w - 0.3, 14, 9 + R() * 12, cols[(i + 3) % cols.length], 840 + i); x -= w; i++; }
  x = -70;
  while (x < 66) { const w = 7 + R() * 5; building(g, x + w / 2, 22.2, w - 0.3, 13, 9 + R() * 14, cols[(i + 5) % cols.length], 860 + i, false, -1); x += w; i++; }
  for (let k = 0; k < 24; k++) building(g, -80 + k * 7 + R() * 3, -40 - R() * 10, 6, 6, 18 + R() * 26, [0xaebcd0, 0xbfc9d8, 0x9fb0c8][k % 3], 880 + k);
  // trees, lamps, a bench, a trash can
  for (const tx of [-17, -9, 9, 17, 27, 37]) tree(g, tx, 3.5, 0.95, tx + 400);
  for (const lx of [-22, -13, 13, 22, 32]) streetLamp(g, lx, 3.9, 1);
  const bench = grp(g, -12.5, 0, 3.3); bench.rotation.y = P;
  box(bench, 1.8, 0.08, 0.5, 0x8a5a32, [0, 0.45, 0]); box(bench, 1.8, 0.4, 0.06, 0x8a5a32, [0, 0.7, -0.22]);
  for (const sx of [-0.8, 0.8]) box(bench, 0.08, 0.45, 0.45, 0x2b2f36, [sx, 0.22, 0]);
  mk(new THREE.CylinderGeometry(0.28, 0.24, 0.85, 14), mat(0x2f6a4a, { r: 0.6 }), g, [7.5, 0.43, 3.6]);
  // --- Battle Wars HQ at the end of the street
  const hq = grp(g, 92, 0, 8.2); hq.rotation.y = -P / 2;
  const hqWall = mat(0xe8ecf3, { r: 0.6 }), navy = mat(0x1d2a7a, { r: 0.5 }), glow = mat(0x7fd4ff, { e: 0x2f8cff, ei: 0.9 });
  box(hq, 16, 10.8, 10, 0, [0, 5.4, 0], { material: hqWall });
  for (let f = 0; f < 3; f++) {
    box(hq, 15.2, 2.1, 0.1, 0, [0, 1.6 + f * 3.4, 5.02], { material: mat(0x6fa8d8, { r: 0.1, m: 0.6 }) });
    box(hq, 16.2, 0.35, 10.2, 0, [0, 3.0 + f * 3.4, 0], { material: navy }); box(hq, 16.25, 0.08, 10.25, 0, [0, 3.2 + f * 3.4, 0], { material: glow });
  }
  box(hq, 16.6, 0.5, 10.6, 0, [0, 10.95, 0], { material: navy });
  mk(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: TX.logoTex(1024, 256, '#0d1446') }), hq, [0, 12.4, 3.5], [0, 0, 0], null, false);
  box(hq, 9.3, 2.5, 0.2, 0, [0, 12.4, 3.38], { material: navy });
  plane(g, 24, 16, mat(0xc8c3ba, { r: 0.9 }), [92, 0.006, 8.2]);
  // --- the spilled cleaning supplies on the sidewalk
  const spill = grp(g, -9.6, 0, 2.3);
  const bottles = [[0.0, 0.0, 0.3, 0x3ad0a0], [0.5, 0.35, 2.1, 0x2f8cff], [-0.45, 0.4, -1.0, 0xff5a3a], [0.9, -0.3, 1.2, 0xffd23f]];
  for (const [bx, bz, ry, c] of bottles) { const b = grp(spill, bx, 0.06, bz); b.rotation.set(0, ry, P / 2); mk(new THREE.CylinderGeometry(0.06, 0.065, 0.24, 12), mat(c, { r: 0.35 }), b); mk(new THREE.CylinderGeometry(0.03, 0.04, 0.07, 8), mat(0xf2f2f2), b, [0, 0.15, 0]); }
  mk(new THREE.CircleGeometry(0.55, 20), mat(0x5ab8ff, { r: 0.05, m: 0.1, opacity: 0.75 }), spill, [0.25, 0.008, 0.1], [-P / 2, 0, 0], [1.3, 1, 1], false);
  for (const [sx, sz, ry] of [[-0.2, 0.7, 0.4], [-0.6, 0.0, 1.2], [1.3, 0.4, 2.0]]) box(spill, 0.14, 0.06, 0.09, 0xffd23f, [sx, 0.03, sz], { rot: [0, ry, 0] });
  for (const [sx, sz, ry] of [[0.2, -0.6, 0.3], [1.5, -0.2, 1.4]]) box(spill, 0.4, 0.04, 0.3, 0xf4f4f4, [sx, 0.02, sz], { rot: [0, ry, 0.05] });
  mk(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 8), mat(0x2f8cff, { r: 0.4 }), spill, [-0.9, 0.03, -0.4], [0, 0.7, P / 2]);
  mk(new THREE.CylinderGeometry(0.018, 0.018, 0.65, 8), mat(0x2f8cff, { r: 0.4 }), spill, [-1.3, 0.03, 0.3], [0, -0.5, P / 2]);
  return {
    name: 'shopSt', group: g, bg: TX.skyTex('#4f8fd8', '#a8d0f0', '#f4e8d8'), fog: [0xe0e8f0, 50, 170], exposure: 1.0,
    update(t, X) {
      const v = X.val;
      const op = v('mart.door', 0);
      for (const d of doors) d.d.position.x = d.sd * (0.6 + 1.1 * op);
      spill.visible = v('spill.vis', 1) > 0.5;
    },
  };
}

// ------------------------------------------------------------------ AETHER MART (inside)
// Floor x -8..8, z -12..4; entrance in the front wall (z = 4). Aisles at x ≈ -5.3 (cleaning), -0.6 (home), 4.7 (mops & buckets).
export function buildMart() {
  const g = new THREE.Group();
  lights(g, { sunPos: [2, 12, 4], target: [0, 0, -4], shadowSize: 14, sunI: 1.2, hemi: 1.35, sky: 0xf4f8ff, ground: 0x8a8a8a, rim: false });
  const fill = []; for (const [x, z] of [[-4, -3], [4, -3], [0, -9]]) { const l = new THREE.PointLight(0xf4f8ff, 12, 14, 1.2); l.position.set(x, 3.8, z); g.add(l); fill.push(l); }
  plane(g, 16, 16, new THREE.MeshStandardMaterial({ map: TX.floorTex('#e8eaee', '#d6dae0', 8), roughness: 0.35 }), [0, 0, -4]);
  const wallM = mat(0xf2f4f6, { r: 0.85 }), stripe = mat(0x2f6dff, { r: 0.5 });
  box(g, 16.4, 4.4, 0.3, 0, [0, 2.2, -12.15], { material: wallM, noShadow: true });
  for (const sd of [-1, 1]) box(g, 0.3, 4.4, 16.4, 0, [sd * 8.15, 2.2, -4], { material: wallM, noShadow: true });
  box(g, 6.8, 4.4, 0.3, 0, [-4.6, 2.2, 4.15], { material: wallM, noShadow: true }); box(g, 6.8, 4.4, 0.3, 0, [4.6, 2.2, 4.15], { material: wallM, noShadow: true });
  box(g, 2.4, 1.6, 0.3, 0, [0, 3.6, 4.15], { material: wallM, noShadow: true });
  box(g, 16.3, 0.2, 0.05, 0, [0, 1.2, -11.98], { material: stripe });
  plane(g, 16.6, 16.6, mat(0xf8f8f8, { side: THREE.DoubleSide }), [0, 4.4, -4], [P / 2, 0, 0], false);
  const panelM = mat(0xffffff, { e: 0xf4f8ff, ei: 1.3 });
  for (let z = -10; z <= 2; z += 4) for (const px of [-4.6, 0, 4.6]) box(g, 2.4, 0.06, 0.5, 0, [px, 4.36, z], { material: panelM, noShadow: true });
  // the street outside the front windows / doors
  const outside = mat(0xdfeeff, { e: 0xcfe4ff, ei: 0.9 });
  for (const sd of [-1, 1]) plane(g, 4.6, 2.4, outside, [sd * 4.4, 1.6, 4.0], [0, P, 0], false);
  plane(g, 2.4, 2.8, outside, [0, 1.4, 4.4], [0, P, 0], false);
  const doors = [];
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe2ff, transparent: true, opacity: 0.25, roughness: 0.04, metalness: 0.5, depthWrite: false, side: THREE.DoubleSide });
  for (const sd of [-1, 1]) { const d = grp(g, sd * 0.6, 0, 4.0); mk(new THREE.PlaneGeometry(1.15, 2.6), glass, d, [0, 1.3, 0], [0, 0, 0], null, false); box(d, 0.06, 2.6, 0.06, 0x2a2e38, [sd * 0.58, 1.3, 0]); doors.push({ d, sd }); }
  // --- shelving
  const metal = mat(0xd8dce2, { r: 0.4, m: 0.3 }), shelfM = mat(0xeef0f2, { r: 0.4 });
  const PAL = [0x3ad0a0, 0x2f8cff, 0xff5a3a, 0xffd23f, 0xb07aff, 0xf2f2f2, 0x5ac05a, 0xff8ad0];
  const bottles = [], jugs = [], boxes = [], towels = [], bags = [];
  const r = rng(13);
  function gondola(gx, z0, z1, kinds) {
    const len = z1 - z0, cz = (z0 + z1) / 2;
    box(g, 1.1, 0.15, len, 0, [gx, 0.075, cz], { material: metal });
    box(g, 0.08, 1.9, len, 0, [gx, 1.0, cz], { material: metal });
    for (const [sd, kind] of [[-1, kinds[0]], [1, kinds[1]]]) for (let lv = 0; lv < 4; lv++) {
      const y = 0.3 + lv * 0.45;
      box(g, 0.5, 0.03, len, 0, [gx + sd * 0.3, y, cz], { material: shelfM, noShadow: true });
      for (let zz = z0 + 0.2; zz < z1 - 0.1; zz += 0.22 + r() * 0.06) addProduct(kind, gx + sd * 0.32, y + 0.015, zz);
    }
  }
  function wallShelf(wx, z0, z1, sd, kind) {
    const cz = (z0 + z1) / 2, len = z1 - z0;
    box(g, 0.55, 2.2, len, 0, [wx, 1.1, cz], { material: mat(0xe0e4ea, { r: 0.6 }) });
    for (let lv = 0; lv < 4; lv++) { const y = 0.3 + lv * 0.48; box(g, 0.5, 0.03, len, 0, [wx + sd * 0.28, y, cz], { material: shelfM, noShadow: true }); for (let zz = z0 + 0.2; zz < z1 - 0.1; zz += 0.24 + r() * 0.06) addProduct(kind, wx + sd * 0.3, y + 0.015, zz); }
  }
  function addProduct(kind, x, y, z) {
    const c = PAL[Math.floor(r() * PAL.length)];
    if (kind === 'spray') bottles.push({ x, y: y + 0.11, z, c });
    else if (kind === 'jug') jugs.push({ x, y: y + 0.14, z, c, ry: r() * 0.3 });
    else if (kind === 'towel') towels.push({ x, y: y + 0.08, z, c: [0xf4f4f4, 0x9ad0ff, 0xffd0e0, 0xd0ffd8][Math.floor(r() * 4)] });
    else if (kind === 'box') boxes.push({ x, y: y + 0.12, z, c });
    else if (kind === 'bag') bags.push({ x, y: y + 0.16, z, c: [0xff3a3a, 0xffd23f, 0x2f8cff, 0x3ad06a, 0xff8a1a][Math.floor(r() * 5)], rz: (r() - 0.5) * 0.2 });
  }
  gondola(-3.0, -9.6, -2.4, ['spray', 'jug']);
  gondola(1.8, -9.6, -2.4, ['towel', 'box']);
  wallShelf(-7.75, -10.5, -1.5, 1, 'spray');
  wallShelf(7.75, -10.5, -4.6, -1, 'bag');
  instances(g, new THREE.CylinderGeometry(0.045, 0.05, 0.22, 10), mat(0xffffff, { r: 0.35 }), bottles);
  instances(g, new THREE.BoxGeometry(0.16, 0.28, 0.12), mat(0xffffff, { r: 0.5 }), jugs);
  instances(g, new THREE.BoxGeometry(0.3, 0.16, 0.2), mat(0xffffff, { r: 0.9 }), towels);
  instances(g, new THREE.BoxGeometry(0.2, 0.24, 0.16), mat(0xffffff, { r: 0.6 }), boxes);
  instances(g, new THREE.BoxGeometry(0.06, 0.32, 0.22), mat(0xffffff, { r: 0.3 }), bags);
  // the featured spray bottle Eric grabs (aisle 1, right gondola face)
  const spray = grp(g, -3.55, 1.23, -5.0);
  mk(new THREE.CylinderGeometry(0.05, 0.055, 0.2, 12), mat(0x3ad0a0, { r: 0.35 }), spray, [0, 0.1, 0]);
  mk(new THREE.CylinderGeometry(0.028, 0.035, 0.05, 10), mat(0xf2f2f2), spray, [0, 0.22, 0]);
  // mop bin + bucket pyramid at the back of aisle 3
  const mops = [];
  box(g, 0.9, 0.5, 0.6, 0x2f6dff, [5.6, 0.25, -10.9], { r: 0.5 });
  for (let k = 0; k < 5; k++) {
    const m = grp(g, 5.3 + (k % 3) * 0.28, 0, -10.75 - Math.floor(k / 3) * 0.25); m.rotation.set(0.05 * (k - 2), 0, 0.08 * (k - 2));
    mk(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 8), mat(0x2f8cff, { r: 0.4 }), m, [0, 1.15, 0]);
    mk(new THREE.SphereGeometry(0.09, 10, 8), mat(0xf2f0ea, { r: 0.9 }), m, [0, 0.42, 0], [0, 0, 0], [1, 1.3, 1]);
    mops.push(m);
  }
  const buckets = [];
  const bucketGeo = new THREE.CylinderGeometry(0.17, 0.13, 0.26, 18, 1, true);
  for (const [bx, by, bz, c] of [[3.5, 0.13, -10.9, 0x2f8cff], [3.9, 0.13, -10.9, 0xff5a3a], [4.3, 0.13, -10.9, 0xffd23f], [3.7, 0.39, -10.9, 0x3ad0a0], [4.1, 0.39, -10.9, 0x2f8cff], [3.9, 0.65, -10.9, 0xff5a3a]]) {
    const b = mk(bucketGeo, mat(c, { r: 0.45, side: THREE.DoubleSide }), g, [bx, by, bz]); buckets.push(b);
  }
  // hanging aisle signs
  for (const [sx, txt, bg] of [[-5.3, 'CLEANING', '#2f6dff'], [-0.6, 'HOME & TOWELS', '#3ad0a0'], [4.7, 'MOPS & BUCKETS', '#ff8a1a'], [7.0, 'SNACKS', '#e8402a']]) {
    for (const sd of [-1, 1]) sign(g, txt, 2.2, 0.5, [sx, 3.3, -6 + sd * 0.01], bg, '#ffffff', [0, sd > 0 ? 0 : P, 0]);
    mk(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4), mat(0x9a9a9a), g, [sx, 3.95, -6]);
  }
  // self checkout by the front
  const kiosks = [];
  for (const kx of [4.4, 6.2]) {
    const k = grp(g, kx, 0, 1.9);
    box(k, 0.9, 0.95, 0.6, 0x2a2e38, [0, 0.48, 0], { r: 0.5 });
    box(k, 0.7, 0.04, 0.5, 0xd8dce2, [0, 0.97, 0]);
    const scr = mk(new THREE.PlaneGeometry(0.42, 0.3), mat(0x2f8cff, { e: 0x3a9cff, ei: 0.9 }), k, [0, 1.35, -0.2], [0, P, 0], null, false);
    box(k, 0.46, 0.34, 0.05, 0x15161c, [0, 1.35, -0.18]);
    mk(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), mat(0x2a2e38), k, [0, 1.15, -0.15]);
    kiosks.push(scr);
  }
  sign(g, 'SELF CHECKOUT', 1.8, 0.4, [5.3, 2.7, 1.9], '#123a7a', '#ffffff', [0, P, 0]);
  plane(g, 2.2, 1.2, mat(0x2a3a5a, { r: 0.95 }), [0, 0.006, 3.2]);
  return {
    name: 'mart', group: g, bg: new THREE.Color(0xf4f8ff), exposure: 1.0,
    update(t, X) {
      const v = X.val;
      const op = v('mart.door', 0);
      for (const d of doors) d.d.position.x = d.sd * (0.6 + 1.1 * op);
      spray.visible = v('mart.sprayTaken', 0) < 0.5;
      mops[2].visible = v('mart.mopTaken', 0) < 0.5;
      buckets[5].visible = v('mart.bucketTaken', 0) < 0.5;
      const beep = v('mart.beep', 0);
      for (const s2 of kiosks) s2.material.emissiveIntensity = 0.9 + 0.8 * beep;
    },
  };
}

// ------------------------------------------------------------------ CITY PRISON: CELL BLOCK (night)
// Corridor along x (z 0..3.4); cells on the z < 0 side, 3 m wide, Fred's cell centred on x = 0.
// Guard station near x = 10, exit door at the corridor's end (x = 15.8).
export function buildPrison() {
  const g = new THREE.Group();
  g.add(new THREE.HemisphereLight(0x8a9ab0, 0x2a2a30, 0.7));
  const conc = new THREE.MeshStandardMaterial({ map: concreteTex(5, '#8a8c90'), roughness: 0.9 });
  const wallM = mat(0xb8bcc2, { r: 0.85 }), lowM = mat(0x4a5a5a, { r: 0.8 }), barM = mat(0x5a5e66, { m: 0.7, r: 0.35 });
  plane(g, 30, 7, conc, [2, 0, -0.1]);
  box(g, 30, 3.8, 0.3, 0, [2, 1.9, 3.55], { material: wallM, noShadow: true });
  box(g, 30, 1.2, 0.05, 0, [2, 0.6, 3.38], { material: lowM, noShadow: true });
  box(g, 0.3, 3.8, 7, 0, [-13.15, 1.9, 0.2], { material: wallM, noShadow: true });
  plane(g, 30, 7, mat(0x9a9ea4, { side: THREE.DoubleSide }), [2, 3.8, 0.2], [P / 2, 0, 0], false);
  // cells
  for (const cx of [-9, -6, -3, 0, 3, 6]) {
    box(g, 3.0, 3.8, 0.25, 0, [cx, 1.9, -3.1], { material: wallM, noShadow: true });
    box(g, 0.2, 3.8, 3.0, 0, [cx - 1.5, 1.9, -1.5], { material: wallM, noShadow: true });
    box(g, 2.2, 0.12, 0.6, 0x6a6e74, [cx, 0.45, -2.65], { m: 0.3 });
    for (const bx of [-0.9, 0.9]) box(g, 0.08, 0.45, 0.5, 0x5a5e66, [cx + bx, 0.22, -2.65]);
    // high barred window with moonlight
    mk(new THREE.PlaneGeometry(0.7, 0.45), mat(0x9ab8ff, { e: 0x6a8aff, ei: 1.2 }), g, [cx, 2.55, -2.96], [0, 0, 0], null, false);
    for (let k = 0; k < 4; k++) box(g, 0.03, 0.47, 0.04, 0, [cx - 0.26 + k * 0.17, 2.55, -2.94], { material: barM, noShadow: true });
    // front bars (Fred's cell door slides open)
    const isFred = cx === 0;
    const bars = isFred ? grp(g, 0, 0, 0) : g;
    for (let k = 0; k < 11; k++) mk(new THREE.CylinderGeometry(0.025, 0.025, 3.4, 8), barM, bars, [cx - 1.35 + k * 0.27, 1.7, 0]);
    for (const y of [0.15, 1.2, 3.3]) box(bars, 2.9, 0.06, 0.06, 0, [cx, y, 0], { material: barM });
    if (isFred) g.userData.cellDoor = bars;
  }
  box(g, 0.2, 3.8, 3.0, 0, [7.5, 1.9, -1.5], { material: wallM, noShadow: true });
  box(g, 8.3, 3.8, 0.3, 0, [11.8, 1.9, -0.15], { material: wallM, noShadow: true });
  const moon = new THREE.PointLight(0x7a9aff, 6, 5, 1.5); moon.position.set(0, 2.3, -2.4); g.add(moon);
  const shaft = mk(new THREE.BoxGeometry(0.6, 3.2, 0.4), new THREE.MeshBasicMaterial({ color: 0x9ab8ff, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }), g, [0, 1.4, -2.2], [0.5, 0, 0], null, false);
  shaft.castShadow = false;
  // signs, guard station, exit
  sign(g, 'CELL BLOCK C', 2.2, 0.45, [-3, 3.1, 3.39], '#2a3a3a', '#f2f2f2', [0, P, 0]);
  const desk = grp(g, 10.4, 0, 2.6);
  box(desk, 2.4, 1.0, 0.8, 0x3a3e46, [0, 0.5, 0]);
  for (let k = 0; k < 3; k++) { box(desk, 0.5, 0.36, 0.06, 0x101218, [-0.7 + k * 0.7, 1.25, 0.15]); mk(new THREE.PlaneGeometry(0.44, 0.3), mat(0x2a5a4a, { e: 0x3ac08a, ei: 0.6 }), desk, [-0.7 + k * 0.7, 1.25, 0.115], [0, P, 0], null, false); }
  const exit = grp(g, 15.8, 0, 1.7);
  const exitDoor = grp(exit, 0, 0, -1.0);
  box(exitDoor, 0.12, 2.5, 2.0, 0x5a6470, [0, 1.25, 1.0], { m: 0.4 });
  box(exitDoor, 0.14, 0.06, 0.4, 0xc0c4cc, [-0.07, 1.1, 1.7], { m: 0.7 });
  box(g, 0.3, 1.3, 3.4, 0, [16.0, 3.15, 1.7], { material: wallM, noShadow: true });
  mk(new THREE.PlaneGeometry(2.0, 2.5), mat(0x0a0e18, { e: 0x101830, ei: 0.6 }), g, [16.1, 1.25, 1.7], [0, -P / 2, 0], null, false);
  sign(g, 'EXIT', 0.8, 0.3, [15.7, 2.85, 1.7], '#0a5a2a', '#9affb0', [0, -P / 2, 0]);
  const exitGlow = new THREE.PointLight(0x5aff8a, 2, 3, 1.5); exitGlow.position.set(15.3, 2.8, 1.7); g.add(exitGlow);
  // ceiling lights (flicker) + alarm beacons
  const lampM = mat(0xfff8e8, { e: 0xfff0d0, ei: 1.6 }).clone();
  const lamps = [];
  for (const lx of [-8, -2, 4, 10]) { box(g, 1.4, 0.08, 0.3, 0, [lx, 3.74, 1.7], { material: lampM, noShadow: true }); const l = new THREE.PointLight(0xfff0d8, 14, 9, 1.3); l.position.set(lx, 3.4, 1.7); g.add(l); lamps.push(l); }
  const alarmM = mat(0xff2020, { e: 0xff1010, ei: 0.2 }).clone();
  const beacons = [];
  for (const bx of [-5, 3, 12]) { const b = grp(g, bx, 3.35, 3.3); mk(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 12), alarmM, b, [0, 0, 0]); beacons.push(b); }
  const alarmL = new THREE.PointLight(0xff2020, 0, 14, 1.2); alarmL.position.set(3, 3.0, 2.4); g.add(alarmL);
  const alarmL2 = new THREE.PointLight(0xff2020, 0, 12, 1.2); alarmL2.position.set(12, 3.0, 2.4); g.add(alarmL2);
  return {
    name: 'prison', group: g, bg: new THREE.Color(0x05060a), exposure: 1.2,
    update(t, X) {
      const v = X.val;
      const fl = v('prison.flicker', 0), dim = v('prison.dim', 0);
      const on = fl < 0.5 || hash(Math.floor(t * 16)) > 0.45;
      const k = (on ? 1 : 0.08) * (1 - 0.6 * dim);
      for (const l of lamps) l.intensity = 14 * k;
      lampM.emissiveIntensity = 1.6 * k;
      g.userData.cellDoor.position.x = 2.4 * v('cell.open', 0);
      exitDoor.rotation.y = -1.5 * v('prison.exit', 0);
      const al = v('prison.alarm', 0);
      const pulse = al > 0.5 ? (0.5 + 0.5 * Math.sin(t * 9)) : 0;
      alarmM.emissiveIntensity = 0.2 + 3 * pulse; alarmL.intensity = 30 * pulse; alarmL2.intensity = 24 * pulse;
      for (const b of beacons) b.rotation.y = t * 6;
    },
  };
}
function concreteTex(seed, base) {
  return canvasTex(256, 256, (c, w, h) => {
    const r = rng(seed); c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.05})`; c.fillRect(r() * w, r() * h, 3, 3); }
    c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 2; for (let x = 0; x <= w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  }, { repeat: [10, 3] });
}

// ------------------------------------------------------------------ CITY PRISON: OUTSIDE (night)
// Prison wall along x at z = 0 facing +z with the exit door at x = 0. Yard, fence with an open gate at z = 14,
// a guard tower with a sweeping searchlight, and the city lights far away (+z).
export function buildPrisonExt() {
  const g = new THREE.Group();
  g.add(new THREE.HemisphereLight(0x5a6a9a, 0x101016, 1.1));
  const moon = new THREE.DirectionalLight(0x9aaaff, 1.0); moon.position.set(-10, 22, 16); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 }); g.add(moon);
  const doorLamp = new THREE.PointLight(0xffd8a0, 22, 12, 1.3); doorLamp.position.set(0, 3.6, 1.2); g.add(doorLamp);
  plane(g, 120, 90, new THREE.MeshStandardMaterial({ map: concreteTex(9, '#3a3c42'), roughness: 0.9 }), [0, 0, 20]);
  const wallM = mat(0x8a8e96, { r: 0.9 });
  box(g, 18, 9, 1, 0, [-10.4, 4.5, -0.5], { material: wallM }); box(g, 18, 9, 1, 0, [10.4, 4.5, -0.5], { material: wallM });
  box(g, 2.8, 6.4, 1, 0, [0, 5.8, -0.5], { material: wallM });
  mk(new THREE.PlaneGeometry(2.8, 2.6), mat(0x0a0c12), g, [0, 1.3, -0.6], [0, 0, 0], null, false);
  const door = grp(g, -1.4, 0, 0);
  box(door, 1.4, 2.6, 0.1, 0x5a6470, [0.7, 1.3, 0], { m: 0.4 });
  box(g, 1.2, 0.18, 0.5, 0x2a2a30, [0, 3.7, 0.25], { m: 0.5 });
  mk(new THREE.SphereGeometry(0.12, 8, 6), mat(0xfff0c0, { e: 0xffd890, ei: 2 }), g, [0, 3.55, 0.4]);
  sign(g, 'AETHERFALL CITY PRISON', 7, 0.8, [-10, 7.4, 0.02], '#3a3e44', '#e8e8e8');
  for (let k = 0; k < 8; k++) { const wx = -18 + k * 5 + (k > 3 ? 1.6 : -1.6); for (const wy of [3.0, 6.0]) { box(g, 0.9, 0.7, 0.05, 0x10141c, [wx, wy, 0.02]); for (let b = 0; b < 3; b++) box(g, 0.03, 0.7, 0.04, 0x5a5e66, [wx - 0.25 + b * 0.25, wy, 0.06]); } }
  // fence with razor wire and an open gate
  const fenceM = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const postM = mat(0x6a6e74, { m: 0.6, r: 0.4 });
  for (const [x0, x1] of [[-30, -2.2], [2.2, 30]]) {
    plane(g, x1 - x0, 3.2, fenceM, [(x0 + x1) / 2, 1.6, 14], [0, 0, 0], false);
    for (let x = x0; x <= x1; x += 3) mk(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 8), postM, g, [x, 1.8, 14]);
    for (let x = x0; x < x1; x += 0.9) mk(new THREE.TorusGeometry(0.3, 0.015, 4, 12), postM, g, [x + 0.45, 3.65, 14], [0, P / 2 + 0.3, 0]);
  }
  const gate = grp(g, 2.2, 0, 14); gate.rotation.y = 1.3;
  box(gate, 4.2, 3.2, 0.06, 0, [-2.1, 1.6, 0], { material: fenceM }); box(gate, 4.2, 0.08, 0.08, 0, [-2.1, 3.2, 0], { material: postM });
  // guard tower + sweeping searchlight
  const tower = grp(g, -12, 0, 8);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mk(new THREE.CylinderGeometry(0.1, 0.12, 8, 8), postM, tower, [lx, 4, lz], [lz * 0.05, 0, -lx * 0.05]);
  box(tower, 3, 2.2, 3, 0x5a5e66, [0, 9.1, 0]); box(tower, 3.4, 0.2, 3.4, 0x3a3e44, [0, 10.3, 0]);
  mk(new THREE.PlaneGeometry(2.6, 1.0), mat(0xffe8b0, { e: 0xffd890, ei: 1.2 }), tower, [0, 9.3, 1.51], [0, 0, 0], null, false);
  const search = new THREE.SpotLight(0xfff4d8, 220, 50, 0.16, 0.5, 1.2); search.position.set(-12, 10.4, 9.4); g.add(search); g.add(search.target);
  const beam = mk(new THREE.ConeGeometry(2.2, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff4d8, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), g, [0, 0, 0], [0, 0, 0], null, false);
  beam.castShadow = false; beam.geometry.translate(0, -7, 0);
  // the city lights far away
  for (let k = 0; k < 22; k++) {
    const b = building(g, -70 + k * 6.5 + hash(k) * 3, 80 + hash(k * 3) * 14, 5, 6, 14 + hash(k * 7) * 30, [0x4a5468, 0x3a4458, 0x5a5468][k % 3], 950 + k, true, -1);
    const side = b.material[0]; side.color.setHex(0x4a5468); side.emissiveIntensity = 0.7;
  }
  mk(new THREE.SphereGeometry(150, 24, 12), new THREE.MeshBasicMaterial({ map: TX.skyTex('#02040e', '#0a1430', '#24305a'), side: THREE.BackSide, fog: false }), g, [0, 0, 0], [0, 0, 0], null, false);
  for (let i = 0; i < 90; i++) { const a = hash(i * 3.1) * P * 2, e = 0.2 + hash(i * 7.7) * 1.1; mk(new THREE.SphereGeometry(0.25, 4, 3), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false }), g, [Math.cos(a) * Math.cos(e) * 140, Math.sin(e) * 140, Math.sin(a) * Math.cos(e) * 140], [0, 0, 0], null, false); }
  return {
    name: 'prisonExt', group: g, bg: new THREE.Color(0x05070f), fog: [0x0a0e1c, 30, 110], exposure: 1.35,
    update(t, X) {
      const v = X.val;
      door.rotation.y = -1.6 * v('prisonExt.door', 0);
      const a = t * 0.45, tx = -6 + Math.sin(a) * 9, tz = 9 + Math.cos(a * 0.7) * 6;
      search.target.position.set(tx, 0, tz);
      const sp = search.position, dx = tx - sp.x, dy = -sp.y, dz = tz - sp.z, len = Math.hypot(dx, dy, dz);
      beam.position.set(sp.x, sp.y, sp.z); beam.scale.set(1, len / 14, 1);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    },
  };
}

// ------------------------------------------------------------------ NIGHT DOWNTOWN EXTRAS (added to the downtown set)
// Two cars that get shoved, two street lights that fall over, and the tall building whose roof the Soul Stealer uses.
export function buildDowntownExtras() {
  const g = new THREE.Group();
  const cars = {};
  for (const [name, color] of [['carA', 0xd02a2a], ['carB', 0xffc020]]) {
    const car = buildCar();
    car.traverse((o) => {
      if (!o.isMesh) return;
      const hex = o.material?.color?.getHex?.();
      if (hex === 0x1f55e0) o.material = mat(color, { r: 0.35, m: 0.3 });
      else if (hex === 0x7fd4ff) o.material = mat(0x2a2a30, { r: 0.5 });
      else if (hex === 0x2f8cff || o.material.map) o.visible = false;
    });
    const holder = grp(g); holder.add(car); cars[name] = { holder, car };
  }
  const lampsF = {};
  for (const name of ['lampA', 'lampB']) {
    const L = grp(g);
    const m = mat(0x2c3340, { r: 0.4, m: 0.5 });
    mk(new THREE.CylinderGeometry(0.08, 0.1, 5.0, 10), m, L, [0, 2.5, 0]);
    mk(new THREE.BoxGeometry(0.08, 0.08, 1.2), m, L, [0, 4.95, 0.6]);
    mk(new THREE.BoxGeometry(0.4, 0.14, 0.55), mat(0xfff4d0, { e: 0xffe6a0, ei: 1.4 }), L, [0, 4.86, 1.15]);
    lampsF[name] = L;
  }
  // the Soul Stealer's rooftop: a tall tower at the end of the cross street
  const tower = grp(g, 0, 0, -58);
  const tb = building(tower, 0, 0, 12, 12, 30, 0x5a5e6e, 777, true);
  const side = tb.material[0]; side.color.setHex(0x3a4254); side.emissiveIntensity = 0.5;
  box(tower, 12.4, 0.8, 0.3, 0x3a3e48, [0, 30.6, 6.05]); box(tower, 12.4, 0.8, 0.3, 0x3a3e48, [0, 30.6, -6.05]);
  box(tower, 0.3, 0.8, 12.4, 0x3a3e48, [6.05, 30.6, 0]); box(tower, 0.3, 0.8, 12.4, 0x3a3e48, [-6.05, 30.6, 0]);
  mk(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 14), mat(0x6a4a3a, { r: 0.8 }), tower, [-3.5, 32.6, -3], [0, 0, 0]);
  for (const [lx, lz] of [[-4.3, -2.2], [-2.7, -2.2], [-4.3, -3.8], [-2.7, -3.8]]) mk(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), mat(0x3a3e48), tower, [lx, 31.0, lz]);
  mk(new THREE.CylinderGeometry(0.05, 0.08, 6, 8), mat(0x8f99a6, { m: 0.7 }), tower, [4, 33.4, -3]);
  const blink = mk(new THREE.SphereGeometry(0.18, 8, 6), mat(0xff3030, { e: 0xff2020, ei: 2 }).clone(), tower, [4, 36.5, -3]);
  const roofGlow = new THREE.PointLight(0xa040ff, 0, 14, 1.3); roofGlow.position.set(0, 32.5, -52); g.add(roofGlow);
  const moonTex = canvasTex(256, 256, (c, w, h) => { const gr = c.createRadialGradient(128, 128, 60, 128, 128, 128); gr.addColorStop(0, 'rgba(235,240,255,1)'); gr.addColorStop(0.47, 'rgba(225,232,255,1)'); gr.addColorStop(0.5, 'rgba(160,180,255,0.45)'); gr.addColorStop(1, 'rgba(120,140,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(180,190,215,0.5)'; for (const [x, y, r] of [[100, 105, 14], [150, 140, 10], [118, 160, 8], [160, 100, 7]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } });
  const moon = mk(new THREE.PlaneGeometry(52, 52), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false }), g, [62, 66, -178], [0, 0, 0], null, false);
  moon.lookAt(0, 31, -50); moon.renderOrder = -1;
  return {
    group: g,
    update(t, X) {
      const v = X.val;
      for (const [name, c] of Object.entries(cars)) {
        c.holder.visible = v(`${name}.vis`, 1) > 0.5;
        c.holder.position.set(v(`${name}.x`, name === 'carA' ? 15 : 24), v(`${name}.lift`, 0), v(`${name}.z`, name === 'carA' ? -2.0 : 2.2));
        c.holder.rotation.set(0, v(`${name}.ry`, 0), v(`${name}.roll`, 0));
        c.car.position.y = Math.abs(Math.sin(v(`${name}.roll`, 0))) * 0.95;
      }
      for (const [name, L] of Object.entries(lampsF)) {
        L.visible = v(`${name}.vis`, 1) > 0.5;
        L.position.set(v(`${name}.x`, name === 'lampA' ? 12 : 20), 0, v(`${name}.z`, name === 'lampA' ? -4.6 : 4.6));
        const f = v(`${name}.fall`, 0);
        L.rotation.set(0, v(`${name}.ry`, name === 'lampA' ? 0 : P), -1.48 * f * f);
      }
      blink.material.emissiveIntensity = Math.sin(t * 3) > 0.6 ? 2.5 : 0.2;
      roofGlow.intensity = 20 * v('roof.glow', 0) * (0.8 + 0.2 * Math.sin(t * 4));
      moon.visible = v('sky.mode', 0) > 2.5;
    },
  };
}
