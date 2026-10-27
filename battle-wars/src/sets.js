// Environments. Each set: { group, update(t, ctx), bg, fog, exposure }
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, mk, grp, rng, canvasTex, clamp, smoothstep, lerp, roundRect } from './util.js';
import * as TX from './textures.js';

const P = Math.PI;

export function lights(g, o) {
  const hemi = new THREE.HemisphereLight(o.sky ?? 0xdfeeff, o.ground ?? 0x6b6155, o.hemi ?? 1.2);
  g.add(hemi);
  const sun = new THREE.DirectionalLight(o.sun ?? 0xfff2dd, o.sunI ?? 2.4);
  sun.position.set(...(o.sunPos ?? [8, 14, 8]));
  sun.target.position.set(...(o.target ?? [0, 0, 0]));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = o.shadowSize ?? 14;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 60 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  g.add(sun); g.add(sun.target);
  if (o.rim !== false) {
    const rim = new THREE.DirectionalLight(o.rimColor ?? 0xa8d4ff, o.rimI ?? 0.9);
    rim.position.set(...(o.rimPos ?? [-6, 5, -8]));
    g.add(rim);
  }
  return { hemi, sun };
}

export function box(parent, w, h, d, color, pos, o = {}) {
  const geo = o.round ? new RoundedBoxGeometry(w, h, d, 2, o.round) : new THREE.BoxGeometry(w, h, d);
  const m = mk(geo, o.material ?? mat(color, o), parent, pos, o.rot ?? [0, 0, 0]);
  if (o.noShadow) m.castShadow = false;
  return m;
}

export function plane(parent, w, h, material, pos, rot = [-P / 2, 0, 0], shadow = true) {
  const m = mk(new THREE.PlaneGeometry(w, h), material, parent, pos, rot, null, false);
  m.receiveShadow = shadow;
  return m;
}

// ------------------------------------------------------------------ city pieces
export function streetLamp(g, x, z, face = 1) {
  const m = mat(0x2c3340, { r: 0.4, m: 0.5 });
  mk(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 10), m, g, [x, 2.1, z]);
  mk(new THREE.BoxGeometry(0.08, 0.08, 1.0), m, g, [x, 4.15, z + face * 0.5]);
  mk(new THREE.BoxGeometry(0.35, 0.12, 0.5), mat(0xfff4d0, { e: 0xffe6a0, ei: 0.4 }), g, [x, 4.08, z + face * 1.0]);
}
export function tree(g, x, z, s = 1, seed = 1) {
  const r = rng(seed);
  mk(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 1.6 * s, 8), mat(0x6b4a2e), g, [x, 0.8 * s, z]);
  const leaf = mat([0x4caf50, 0x43a047, 0x5cbf60][Math.floor(r() * 3)], { r: 0.8 });
  for (let i = 0; i < 4; i++) mk(new THREE.IcosahedronGeometry((0.6 + r() * 0.35) * s, 1), leaf, g, [x + (r() - 0.5) * 0.8 * s, (2.0 + r() * 0.7) * s, z + (r() - 0.5) * 0.8 * s]);
  mk(new THREE.CylinderGeometry(0.55 * s, 0.6 * s, 0.35, 12), mat(0x8d8a84), g, [x, 0.17, z]);
}
export function building(g, x, z, w, d, h, color, seed, lit = false, front = 1) {
  const tex = TX.windowsTex(seed, color, lit);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 6)));
  const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: lit ? 0xffffff : 0x000000, emissiveMap: lit ? tex : null, emissiveIntensity: lit ? 0.35 : 0 });
  const plain = mat(color, { r: 0.85 });
  const mats = [side, side, plain, plain, side, side];
  const b = mk(new THREE.BoxGeometry(w, h, d), mats, g, [x, h / 2, z]);
  b.castShadow = true;
  // roof trim
  mk(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), mat(0x5d6470, { r: 0.7 }), g, [x, h + 0.17, z]);
  return b;
}
function shopFront(g, x, z, w, color, label, front = 1, seed = 1) {
  const r = rng(seed);
  building(g, x, z - front * 0.0, w, 6, 4.2, color, seed, false);
  // awning
  const aw = mk(new THREE.BoxGeometry(w * 0.85, 0.12, 1.4), mat([0xe53935, 0x1e88e5, 0x43a047, 0xfb8c00][Math.floor(r() * 4)], { r: 0.7 }), g, [x, 3.0, z + front * 3.6], [front * 0.25, 0, 0]);
  const sign = new THREE.MeshBasicMaterial({ map: TX.signTex(label, '#fff8e8', '#2b2b2b', 512, 96) });
  mk(new THREE.PlaneGeometry(w * 0.7, 0.55), sign, g, [x, 3.6, z + front * 3.02], [0, front > 0 ? 0 : P, 0], null, false);
  mk(new THREE.PlaneGeometry(w * 0.6, 1.8), mat(0x9fd3f0, { r: 0.1, m: 0.3, e: 0x203040 }), g, [x, 1.2, z + front * 3.02], [0, front > 0 ? 0 : P, 0], null, false);
}

export function buildBarricade() {
  const g = new THREE.Group();
  const stripes = new THREE.MeshStandardMaterial({ map: TX.stripesTex(), roughness: 0.6 });
  box(g, 1.5, 0.28, 0.08, 0, [0, 0.95, 0], { material: stripes });
  box(g, 1.5, 0.28, 0.08, 0, [0, 0.5, 0], { material: stripes });
  const leg = mat(0xe8e8e8, { r: 0.5, m: 0.3 });
  for (const s of [-0.65, 0.65]) {
    mk(new THREE.BoxGeometry(0.07, 1.15, 0.07), leg, g, [s, 0.57, 0.12], [0.2, 0, 0]);
    mk(new THREE.BoxGeometry(0.07, 1.15, 0.07), leg, g, [s, 0.57, -0.12], [-0.2, 0, 0]);
    mk(new THREE.BoxGeometry(0.12, 0.05, 0.6), mat(0x333333), g, [s, 0.03, 0]);
  }
  const lamp = mk(new THREE.SphereGeometry(0.07, 10, 8), mat(0xff8a00, { e: 0xff6a00, ei: 1.2 }), g, [0.6, 1.16, 0]);
  g.userData.lamp = lamp;
  return g;
}

export function buildCar() {
  const g = new THREE.Group();
  const blue = mat(0x1f55e0, { r: 0.25, m: 0.35 });
  const dark = mat(0x101522, { r: 0.4 });
  const glass = mat(0x1b2a3c, { r: 0.05, m: 0.6 });
  box(g, 4.3, 0.75, 1.95, 0, [0, 0.72, 0], { material: blue, round: 0.25 });
  box(g, 2.3, 0.7, 1.75, 0, [-0.25, 1.35, 0], { material: glass, round: 0.22 });
  box(g, 2.1, 0.08, 1.6, 0, [-0.25, 1.72, 0], { material: blue, round: 0.04 });
  // light bar
  box(g, 0.8, 0.12, 0.3, 0, [-0.25, 1.82, 0], { material: mat(0x2f8cff, { e: 0x2f8cff, ei: 1.3 }), round: 0.04 });
  // stripe + logo
  box(g, 4.32, 0.08, 1.97, 0, [0, 0.8, 0], { material: mat(0x7fd4ff, { e: 0x2a8cff, ei: 0.6 }) });
  const logo = new THREE.MeshBasicMaterial({ map: TX.logoTex(512, 128), transparent: true });
  for (const s of [1, -1]) mk(new THREE.PlaneGeometry(1.8, 0.45), logo, g, [0.1, 0.58, s * 0.985], [0, s > 0 ? 0 : P, 0], null, false);
  const wheels = [];
  for (const [x, z] of [[1.35, 0.9], [-1.35, 0.9], [1.35, -0.9], [-1.35, -0.9]]) {
    const w = grp(g, x, 0.4, z);
    mk(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 18), dark, w, [0, 0, 0], [P / 2, 0, 0]);
    mk(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 12), mat(0xc9d2dc, { m: 0.8, r: 0.3 }), w, [0, 0, 0], [P / 2, 0, 0]);
    wheels.push(w);
  }
  for (const z of [0.6, -0.6]) {
    mk(new THREE.BoxGeometry(0.05, 0.16, 0.42), mat(0xffffee, { e: 0xffffcc, ei: 1.0 }), g, [2.16, 0.82, z]);
    mk(new THREE.BoxGeometry(0.05, 0.14, 0.4), mat(0xff3030, { e: 0xff2020, ei: 0.8 }), g, [-2.16, 0.82, z]);
  }
  g.userData.wheels = wheels;
  return g;
}

function hydrant(g) {
  const h = grp(g);
  const red = mat(0xd62b20, { r: 0.4, m: 0.2 });
  mk(new THREE.CylinderGeometry(0.2, 0.24, 0.12, 16), red, h, [0, 0.06, 0]);
  mk(new THREE.CylinderGeometry(0.16, 0.18, 0.6, 16), red, h, [0, 0.4, 0]);
  mk(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), red, h, [0, 0.7, 0]);
  mk(new THREE.SphereGeometry(0.16, 16, 10, 0, P * 2, 0, P / 2), red, h, [0, 0.72, 0]);
  mk(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6), mat(0xe8c040, { m: 0.6 }), h, [0, 0.9, 0]);
  for (const s of [1, -1]) mk(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 12), red, h, [s * 0.2, 0.45, 0], [0, 0, P / 2]);
  mk(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12), red, h, [0, 0.45, 0.18], [P / 2, 0, 0]);
  return h;
}

function valve(g) {
  const v = grp(g);
  const pipe = mat(0x6d7884, { r: 0.4, m: 0.6 });
  mk(new THREE.CylinderGeometry(0.09, 0.11, 0.9, 12), pipe, v, [0, 0.45, 0]);
  mk(new THREE.BoxGeometry(0.28, 0.24, 0.24), pipe, v, [0, 0.95, 0]);
  const wheel = grp(v, 0, 0.95, 0.2);
  const yellow = mat(0xffc21a, { r: 0.4, m: 0.3 });
  mk(new THREE.TorusGeometry(0.28, 0.035, 8, 24), yellow, wheel);
  for (let i = 0; i < 4; i++) mk(new THREE.BoxGeometry(0.56, 0.035, 0.035), yellow, wheel, [0, 0, 0], [0, 0, (i * P) / 4]);
  mk(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), yellow, wheel, [0, 0, 0], [P / 2, 0, 0]);
  v.userData.wheel = wheel;
  return v;
}

// ------------------------------------------------------------------ CITY STREET
export function buildCity(fx) {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [10, 18, 12], target: [0, 0, 0], shadowSize: 18, sunI: 2.6, hemi: 1.25 });
  const road = new THREE.MeshStandardMaterial({ map: TX.roadTex(), roughness: 0.9 });
  road.map.repeat.set(16, 1);
  plane(g, 140, 8, road, [0, 0, 0]);
  const cross = new THREE.MeshStandardMaterial({ color: 0x3d4048, roughness: 0.9 });
  plane(g, 8, 140, cross, [16, 0.002, 0]);
  const walk = new THREE.MeshStandardMaterial({ map: TX.sidewalkTex(), roughness: 0.9 });
  walk.map.repeat.set(35, 1.5);
  for (const z of [-5.75, 5.75]) plane(g, 140, 3.5, walk, [0, 0.004, z]);
  plane(g, 140, 40, mat(0x8f9a7a, { r: 1 }), [0, -0.01, -27]);
  plane(g, 140, 40, mat(0x8f9a7a, { r: 1 }), [0, -0.01, 27]);
  // curbs
  for (const z of [-4.05, 4.05]) mk(new THREE.BoxGeometry(140, 0.08, 0.12), mat(0xcfcac0), g, [0, 0.04, z]);
  // crosswalk
  for (let i = 0; i < 8; i++) plane(g, 0.5, 2.4, mat(0xf0f0f0, { r: 0.8 }), [11 - 0, 0.006, -3.5 + i * 1.0], [-P / 2, 0, P / 2]);
  // buildings
  const cols = [0xd9c7a7, 0xc9d6e3, 0xe6b8a2, 0xbcd5c0, 0xd8d0e8, 0xf0dcb0, 0xb7c4d6];
  const r = rng(42);
  for (const side of [-1, 1]) {
    let x = -55;
    let i = 0;
    while (x < 60) {
      const w = 6 + r() * 5;
      if (x + w / 2 > 11 && x - w / 2 < 21) { x = 21 + w / 2; continue; }
      const h = 7 + r() * 16;
      const shop = r() < 0.35 && Math.abs(x) < 30;
      const labels = ['BAKERY', 'GAMES', 'BOOKS', 'PIZZA', 'TOYS', 'COMICS', 'MUSIC'];
      if (shop) shopFront(g, x, side * 10.5, w - 0.4, cols[i % cols.length], labels[Math.floor(r() * labels.length)], -side, i + 50);
      else building(g, x, side * 11.5, w - 0.4, 7 + r() * 3, h, cols[i % cols.length], i * 7 + (side > 0 ? 100 : 0));
      x += w; i++;
    }
  }
  // skyline far away
  for (let i = 0; i < 26; i++) {
    const x = -70 + i * 6 + r() * 3, z = -45 - r() * 15;
    building(g, x, z, 5 + r() * 4, 6, 18 + r() * 30, [0xaebcd0, 0xbfc9d8, 0x9fb0c8][i % 3], 300 + i);
  }
  for (let x = -40; x < 50; x += 12) { streetLamp(g, x, -4.6, 1); streetLamp(g, x + 6, 4.6, -1); }
  for (let x = -34; x < 50; x += 12) { tree(g, x, -6.4, 1, x + 99); tree(g, x + 6, 6.4, 1, x + 77); }
  // traffic lights at intersection
  for (const [x, z] of [[11.5, -4.5], [20.5, 4.5]]) {
    mk(new THREE.CylinderGeometry(0.08, 0.08, 4, 8), mat(0x2b2f36), g, [x, 2, z]);
    box(g, 0.35, 0.95, 0.3, 0x1c1f24, [x, 4.2, z]);
    mk(new THREE.SphereGeometry(0.1, 10, 8), mat(0x30ff60, { e: 0x30ff60, ei: 1 }), g, [x, 3.95, z + (z < 0 ? 0.16 : -0.16)]);
  }
  // hero props
  const hyd = hydrant(g); hyd.position.set(0, 0, -4.7);
  const val = valve(g); val.position.set(1.5, 0, -4.9);
  const drain = plane(g, 0.9, 0.5, new THREE.MeshStandardMaterial({ map: canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#222'; c.fillRect(0, 0, w, h); c.fillStyle = '#555'; for (let i = 0; i < 8; i++) c.fillRect(8 + i * 15, 6, 8, h - 12); }), roughness: 0.6, metalness: 0.5 }), [3.6, 0.008, -3.6]);
  const cover = grp(g); box(cover, 1.1, 0.06, 0.7, 0xffcc1a, [0, 0.03, 0], { round: 0.02 });
  box(cover, 1.0, 0.065, 0.12, 0x1a1a1a, [0, 0.032, 0]);
  const rune = plane(g, 3.2, 3.2, new THREE.MeshBasicMaterial({ map: TX.runeTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), [0, 0.03, -1.4]);
  const car = buildCar(); g.add(car);
  const barrs = [];
  for (let i = 0; i < 6; i++) { const b = buildBarricade(); b.rotation.y = P / 2; g.add(b); barrs.push(b); }
  const barrZ = [-3.4, -2.05, -0.7, 0.65, 2.0, 3.35];

  return {
    name: 'city', group: g, bg: TX.skyTex('#3f8fe0', '#9fd0f5', '#e8f4ff'), fog: [0xcfe4f5, 40, 140], exposure: 1.0,
    refs: { car, hyd, val, rune, cover, barrs, sun: L.sun },
    update(t, X) {
      const v = X.val;
      // car
      car.position.set(v('car.x', -40), 0, v('car.z', 1.6));
      car.rotation.y = v('car.ry', 0);
      const spin = v('car.x', -40) / 0.4;
      for (const w of car.userData.wheels) w.rotation.z = -spin;
      car.visible = v('car.vis', 1) > 0.5;
      // hydrant shake
      const sh = v('hyd.shake', 0);
      hyd.position.x = Math.sin(t * 60) * 0.03 * sh;
      hyd.rotation.z = Math.sin(t * 47) * 0.05 * sh;
      val.userData.wheel.rotation.z = v('valve.rot', 0);
      rune.material.opacity = clamp(v('rune', 0) * (0.75 + 0.25 * Math.sin(t * 8)), 0, 1);
      rune.position.set(v('water.x', 0), 0.03, v('water.z', -1.4));
      rune.rotation.z = t * 0.4;
      cover.visible = v('cover', 0) > 0.001;
      cover.position.set(3.6, lerp(1.6, 0.0, clamp(v('cover', 0))), -3.6);
      // barricades: thrown from Eric toward their slot
      const bx = 6.0, shake = v('barr.shake', 0);
      barrs.forEach((b, i) => {
        const k = v(`barr${i}`, 0);
        b.visible = k > 0.001;
        const sx = v('barr.sx', 7.2), sz = v('barr.sz', 0), sy = 1.3;
        const tx = bx, tz = barrZ[i];
        b.position.set(lerp(sx, tx, k), lerp(sy, 0, k) + Math.sin(k * P) * 1.6, lerp(sz, tz, k));
        b.rotation.set(Math.sin(t * 40 + i) * 0.04 * shake, P / 2 + (1 - k) * 3, Math.sin(t * 33 + i * 2) * 0.05 * shake);
        b.position.x += Math.sin(t * 25 + i * 3) * 0.04 * shake;
        b.userData.lamp.material.emissiveIntensity = 0.6 + 0.6 * (Math.sin(t * 6 + i) > 0 ? 1 : 0);
      });
    },
  };
}

// ------------------------------------------------------------------ COFFEE SHOP
export function buildCoffee() {
  const g = new THREE.Group();
  lights(g, { sunPos: [-8, 10, 6], target: [0, 0, -1], shadowSize: 9, sunI: 1.6, hemi: 0.9, sky: 0xfff3e0, ground: 0x6b5040, rimColor: 0xffd7a8 });
  for (const x of [-2.2, 0, 2.2]) {
    const pl = new THREE.PointLight(0xffc98a, 6, 7, 1.6); pl.position.set(x, 2.8, -1.8); g.add(pl);
    mk(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 4), mat(0x222222), g, [x, 3.35, -1.8]);
    mk(new THREE.ConeGeometry(0.25, 0.3, 16, 1, true), mat(0x2f4f3f, { side: THREE.DoubleSide }), g, [x, 2.85, -1.8]);
    mk(new THREE.SphereGeometry(0.08, 10, 8), mat(0xfff0c0, { e: 0xffd890, ei: 2 }), g, [x, 2.75, -1.8]);
  }
  const floor = new THREE.MeshStandardMaterial({ map: TX.planksTex('#a8743f', '#9a6a39'), roughness: 0.7 });
  plane(g, 13, 10, floor, [0, 0, 0]);
  const wall = mat(0xf1e0c4, { r: 0.9 });
  const wallDark = mat(0x5b3f2b, { r: 0.8 });
  box(g, 13, 3.8, 0.2, 0, [0, 1.9, -4.6], { material: wall, noShadow: true });
  box(g, 13, 3.8, 0.2, 0, [0, 1.9, 4.9], { material: wall, noShadow: true });
  box(g, 13, 1.0, 0.22, 0, [0, 0.5, -4.55], { material: wallDark });
  // left wall with door gap (z 0.25..1.35)
  box(g, 0.2, 3.8, 4.6, 0, [-6.1, 1.9, -2.05], { material: wall, noShadow: true });
  box(g, 0.2, 3.8, 3.8, 0, [-6.1, 1.9, 3.25], { material: wall, noShadow: true });
  box(g, 0.2, 1.5, 1.1, 0, [-6.1, 3.05, 0.8], { material: wall, noShadow: true });
  plane(g, 1.1, 2.3, mat(0xcfefff, { e: 0xbfe6ff, ei: 0.9 }), [-6.25, 1.15, 0.8], [0, P / 2, 0], false);
  const door = grp(g, -6.05, 0, 0.25);
  box(door, 0.08, 2.25, 1.08, 0, [0, 1.13, 0.55], { material: mat(0x2f6b4f, { r: 0.6 }) });
  box(door, 0.1, 1.2, 0.7, 0, [0, 1.4, 0.55], { material: mat(0xbfe7ff, { r: 0.05, m: 0.3, e: 0x406070, ei: 0.5 }) });
  mk(new THREE.CylinderGeometry(0.025, 0.025, 0.25, 8), mat(0xd9b24a, { m: 0.8 }), door, [0.08, 1.05, 0.95], [0, 0, P / 2]);
  // window on left wall + right wall
  plane(g, 2.2, 1.4, mat(0xcfefff, { e: 0xbfe6ff, ei: 0.8 }), [-5.99, 1.9, -2.6], [0, P / 2, 0], false);
  box(g, 0.2, 3.8, 10, 0, [6.1, 1.9, 0], { material: wall, noShadow: true });
  plane(g, 3.4, 1.8, mat(0xcfefff, { e: 0xbfe6ff, ei: 0.8 }), [5.99, 1.9, 0.4], [0, -P / 2, 0], false);
  // menu board + shelves
  const menu = new THREE.MeshStandardMaterial({ map: TX.menuTex(), roughness: 0.8 });
  box(g, 3.0, 1.85, 0.06, 0, [0, 2.65, -4.48], { material: menu });
  for (const y of [1.55, 2.0]) {
    box(g, 2.0, 0.05, 0.3, 0x7a5232, [-3.6, y, -4.35]);
    for (let i = 0; i < 5; i++) mk(new THREE.CylinderGeometry(0.07, 0.06, 0.14, 10), mat([0xe85a4f, 0xf2c14e, 0x4fb3e8, 0xf4f4f4, 0x6bc06b][i]), g, [-4.4 + i * 0.4, y + 0.1, -4.35]);
  }
  // counter
  const wood = mat(0x7a4b2a, { r: 0.6 });
  box(g, 5.4, 1.0, 0.8, 0, [0, 0.5, -2.3], { material: wood, round: 0.03 });
  box(g, 5.6, 0.08, 0.95, 0, [0, 1.04, -2.3], { material: mat(0xe9e4dc, { r: 0.25 }), round: 0.02 });
  for (let i = 0; i < 6; i++) box(g, 0.05, 0.85, 0.02, 0x5c381f, [-2.3 + i * 0.92, 0.5, -1.89]);
  // espresso machine, register, pastry case
  box(g, 0.8, 0.55, 0.5, 0xb9c2cc, [-1.55, 1.35, -2.5], { round: 0.05, m: 0.7, r: 0.25 });
  box(g, 0.45, 0.3, 0.38, 0x3b3f48, [-2.45, 1.23, -2.45], { round: 0.03 });
  box(g, 0.4, 0.2, 0.05, 0x40e080, [-2.45, 1.45, -2.3], { e: 0x20a050, ei: 0.6 });
  box(g, 1.2, 0.45, 0.6, 0xd8f0ff, [-0.4, 1.31, -2.35], { opacity: 0.35, r: 0.05 });
  for (let i = 0; i < 4; i++) mk(new THREE.SphereGeometry(0.1, 10, 8), mat(0xc58a4a), g, [-0.8 + i * 0.27, 1.17, -2.35], [0, 0, 0], [1, 0.6, 1]);
  // tables
  for (const [x, z] of [[3.4, 1.6], [3.6, -0.6], [-3.2, 2.6]]) {
    mk(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 20), mat(0xf4efe6), g, [x, 0.78, z]);
    mk(new THREE.CylinderGeometry(0.05, 0.05, 0.76, 8), mat(0x333333), g, [x, 0.39, z]);
    for (const a of [0.4, 2.5, 4.4]) {
      const cx = x + Math.cos(a) * 0.85, cz = z + Math.sin(a) * 0.85;
      box(g, 0.42, 0.06, 0.42, 0x2f6b4f, [cx, 0.48, cz]);
      box(g, 0.42, 0.5, 0.05, 0x2f6b4f, [cx + Math.cos(a) * 0.2, 0.75, cz + Math.sin(a) * 0.2], { rot: [0, -a + P / 2, 0] });
    }
  }
  // plants
  for (const [x, z] of [[5.4, -4], [-5.4, -4], [5.4, 3.8]]) {
    mk(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 12), mat(0xc0603a), g, [x, 0.25, z]);
    for (let i = 0; i < 3; i++) mk(new THREE.IcosahedronGeometry(0.35, 1), mat(0x3f9f4f, { r: 0.8 }), g, [x + (i - 1) * 0.15, 0.8 + i * 0.2, z]);
  }
  // cup + money props
  const cup = grp(g);
  mk(new THREE.CylinderGeometry(0.06, 0.045, 0.16, 14), mat(0xffffff, { r: 0.4 }), cup, [0, 0.08, 0]);
  mk(new THREE.CylinderGeometry(0.062, 0.062, 0.05, 14), mat(0x8a5a32), cup, [0, 0.09, 0]);
  mk(new THREE.CylinderGeometry(0.064, 0.064, 0.02, 14), mat(0x3b2416), cup, [0, 0.17, 0]);
  const spill = plane(g, 1, 1, new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.15, transparent: true, opacity: 0.9 }), [0, 0.006, 0]);
  const bill = plane(g, 0.2, 0.1, mat(0x7fc77f, { r: 0.8, side: THREE.DoubleSide }), [0.55, 1.085, -2.0]);

  return {
    name: 'coffee', group: g, bg: new THREE.Color(0x2a1d14), exposure: 1.05,
    refs: { cup, door },
    update(t, X) {
      const v = X.val;
      door.rotation.y = -v('door', 0) * 1.6;
      cup.visible = v('cup.vis', 0) > 0.5;
      cup.position.set(v('cup.x', 0.2), v('cup.y', 1.08), v('cup.z', -2.05));
      cup.rotation.set(v('cup.rx', 0), 0, v('cup.rz', 0));
      const sp = v('spill', 0);
      spill.visible = sp > 0.01;
      spill.scale.set(0.05 + sp * 0.7, 0.05 + sp * 0.5, 1);
      spill.position.set(v('spill.x', 0.4), 0.006, v('spill.z', -1.75));
      bill.visible = v('bill', 0) > 0.5;
    },
  };
}

// ------------------------------------------------------------------ HQ EXTERIOR
export function buildHQExterior() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [12, 16, 14], target: [0, 3, -6], shadowSize: 20, sunI: 2.5 });
  const road = new THREE.MeshStandardMaterial({ map: TX.roadTex(), roughness: 0.9 }); road.map.repeat.set(10, 1);
  plane(g, 100, 8, road, [0, 0, 6]);
  const walk = new THREE.MeshStandardMaterial({ map: TX.sidewalkTex(), roughness: 0.9 }); walk.map.repeat.set(25, 1);
  plane(g, 100, 3, walk, [0, 0.004, 0.5]);
  plane(g, 100, 40, mat(0x86a06a, { r: 1 }), [0, -0.01, -20]);
  plane(g, 100, 30, mat(0x86a06a, { r: 1 }), [0, -0.01, 25]);
  // plaza
  plane(g, 16, 6, mat(0xc8c3ba, { r: 0.9 }), [0, 0.006, -2]);
  // the headquarters: three floors
  const hq = grp(g, 0, 0, -9);
  const wallM = mat(0xe8ecf3, { r: 0.6 });
  const navy = mat(0x1d2a7a, { r: 0.5 });
  const glow = mat(0x7fd4ff, { e: 0x2f8cff, ei: 0.9 });
  const glassDay = new THREE.MeshStandardMaterial({ color: 0x6fa8d8, roughness: 0.08, metalness: 0.6, emissive: 0xffc070, emissiveIntensity: 0 });
  box(hq, 16, 10.8, 10, 0, [0, 5.4, 0], { material: wallM });
  for (let f = 0; f < 3; f++) {
    box(hq, 15.2, 2.1, 0.1, 0, [0, 1.6 + f * 3.4, 5.02], { material: glassDay });
    box(hq, 16.2, 0.35, 10.2, 0, [0, 3.0 + f * 3.4, 0], { material: navy });
    box(hq, 16.25, 0.08, 10.25, 0, [0, 3.2 + f * 3.4, 0], { material: glow });
    for (let i = 0; i < 6; i++) box(hq, 0.2, 2.1, 0.2, 0, [-7.5 + i * 3, 1.6 + f * 3.4, 5.08], { material: navy });
  }
  box(hq, 2.4, 2.6, 0.3, 0, [0, 1.3, 5.1], { material: mat(0x10183f, { r: 0.3 }) });
  box(hq, 16.6, 0.5, 10.6, 0, [0, 10.95, 0], { material: navy });
  const sign = new THREE.MeshBasicMaterial({ map: TX.logoTex(1024, 256, '#0d1446') });
  mk(new THREE.PlaneGeometry(9, 2.25), sign, hq, [0, 12.4, 3.5], [0, 0, 0], null, false);
  box(hq, 9.3, 2.5, 0.2, 0, [0, 12.4, 3.38], { material: navy });
  // dish + antenna
  mk(new THREE.SphereGeometry(1.1, 18, 10, 0, P * 2, 0, P / 2.5), mat(0xdfe5ee, { side: THREE.DoubleSide, m: 0.4 }), hq, [-5, 12.2, -1.5], [-0.9, 0.4, 0]);
  mk(new THREE.CylinderGeometry(0.06, 0.08, 4, 8), mat(0x8f99a6, { m: 0.7 }), hq, [5.5, 13.2, -2]);
  const beacon = mk(new THREE.SphereGeometry(0.16, 10, 8), mat(0xff3030, { e: 0xff2020, ei: 2 }), hq, [5.5, 15.25, -2]);
  // neighbours, trees, lamps
  building(g, -19, -10, 10, 9, 14, 0xd2c4a8, 9);
  building(g, 19, -10, 10, 9, 17, 0xbfcfe0, 10);
  const centerG = grp(g); // centre trees + lamp can be cleared for wide plaza staging (Episode 5)
  for (let i = 0; i < 6; i++) tree(i === 2 || i === 3 ? centerG : g, -12 + i * 4.8 + (i > 2 ? 0 : 0), -0.8, 0.9, i * 13 + 2);
  for (let x = -24; x <= 24; x += 12) streetLamp(x === 0 ? centerG : g, x, 1.9, 1);
  const car = buildCar(); g.add(car);
  // Episode 5: front doors that swing open (and get bashed by Leon), a balcony, a distant skyline
  const doors = [];
  for (const sd of [-1, 1]) {
    const pv = grp(hq, sd * 1.2, 0, 5.28);
    box(pv, 1.18, 2.55, 0.1, 0, [-sd * 0.59, 1.28, 0], { material: mat(0x2a3a8a, { r: 0.35, m: 0.3 }) });
    box(pv, 0.9, 1.6, 0.11, 0, [-sd * 0.59, 1.45, 0], { material: mat(0x8fc8f0, { r: 0.05, m: 0.4, e: 0x1a3060, ei: 0.4 }) });
    box(pv, 0.06, 0.4, 0.14, 0, [-sd * 1.05, 1.25, 0.04], { material: mat(0xd8d8e0, { m: 0.7 }) });
    doors.push(pv);
  }
  const balc = grp(hq, 4.5, 6.6, 5.6);
  box(balc, 4.2, 0.2, 1.5, 0, [0, 0, 0], { material: navy });
  box(balc, 4.2, 0.9, 0.05, 0, [0, 0.55, 0.72], { material: mat(0xbfe6ff, { r: 0.05, m: 0.2, opacity: 0.4 }) });
  box(balc, 4.25, 0.06, 0.1, 0, [0, 1.0, 0.72], { material: glow });
  balc.visible = false;
  const skyline = grp(g); skyline.visible = false;
  { const R = rng(808); for (let i = 0; i < 22; i++) building(skyline, -75 + i * 7 + R() * 2, 62 + R() * 18, 6 + R() * 3, 8, 16 + R() * 34, [0xaebcd0, 0xbfc9d8, 0x9fb0c8, 0xc9d6e3][i % 4], 950 + i); }
  const skyDay = TX.skyTex('#3f8fe0', '#9fd0f5', '#e8f4ff');
  const skyShade = TX.skyTex('#33405a', '#5d6d88', '#8e9db4');
  const skyNight = TX.skyTex('#03050f', '#0a1230', '#1a2650');
  const skyEve = TX.skyTex('#2b2f6e', '#c4608a', '#ffb070');
  return {
    name: 'hqExt', group: g, bg: skyDay, fog: [0xcfe4f5, 50, 140], exposure: 1.0,
    refs: { car },
    update(t, X) {
      const v = X.val;
      const eve = v('evening', 0), shade = v('ufo.shade', 0), night = v('night', 0) > 0.5;
      X.scene.background = night ? skyNight : eve > 0.5 ? skyEve : shade > 0.5 ? skyShade : skyDay;
      X.scene.fog.color.set(night ? 0x0d1430 : eve > 0.5 ? 0xe09a88 : shade > 0.5 ? 0x8a96aa : 0xcfe4f5);
      L.sun.color.set(night ? 0x8a9aff : eve > 0.5 ? 0xff9a5a : 0xfff2dd);
      L.sun.intensity = night ? 0.35 : (eve > 0.5 ? 1.1 : 2.5) * (1 - 0.72 * shade);
      L.sun.position.set(eve > 0.5 ? -18 : 12, eve > 0.5 ? 5 : 16, 14);
      L.hemi.intensity = night ? 0.3 : (eve > 0.5 ? 0.55 : 1.2) * (1 - 0.4 * shade);
      const dk = v('hq.doors', 0), br = v('hq.doorBroken', 0);
      doors[0].rotation.set(0, -dk * 1.45, 0); doors[1].rotation.set(0, dk * 1.45 + br * 0.25, -br * 0.18);
      doors[1].position.y = -br * 0.25;
      balc.visible = v('hq.balcony', 0) > 0.5;
      centerG.visible = v('hq.clear', 0) < 0.5;
      skyline.visible = v('hq.skyline', 0) > 0.5;
      glassDay.emissiveIntensity = night ? 1.1 : eve > 0.5 ? 0.85 : 0;
      glassDay.color.set(night || eve > 0.5 ? 0x3a3550 : 0x6fa8d8);
      beacon.material.emissiveIntensity = Math.sin(t * 4) > 0 ? 2.5 : 0.2;
      car.position.set(v('hcar.x', -40), 0, v('hcar.z', 5.5));
      for (const w of car.userData.wheels) w.rotation.z = -v('hcar.x', -40) / 0.4;
      car.visible = v('hcar.vis', 1) > 0.5;
    },
  };
}

// ------------------------------------------------------------------ dynamic screens
function tvGame() {
  const tex = canvasTex(512, 288, () => {});
  const { ctx } = tex.userData;
  tex.draw = (t, win, off, boss = 0, hp = 0.1, paused = 0, hit = 0, fall = -1) => {
    const w = 512, h = 288;
    if (off) { ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, w, h); tex.needsUpdate = true; return; }
    if (fall >= 0) {
      // a platformer: the hero runs to a cliff edge... and falls
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#5ac8ff'); sky.addColorStop(1, '#c8f0ff');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { const cx = ((i * 150 - t * 15) % 600 + 600) % 600 - 50; ctx.beginPath(); ctx.arc(cx, 50 + (i % 2) * 20, 22, 0, 7); ctx.arc(cx + 24, 46 + (i % 2) * 20, 18, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#3aa84a'; ctx.fillRect(0, 200, 300, 14); ctx.fillStyle = '#8a5a2e'; ctx.fillRect(0, 214, 300, 80);
      ctx.fillStyle = '#3aa84a'; ctx.fillRect(400, 200, 112, 14); ctx.fillStyle = '#8a5a2e'; ctx.fillRect(400, 214, 112, 80);
      ctx.fillStyle = '#ffd040'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(430 + i * 25, 170, 8, 0, 7); ctx.fill(); }
      const run = Math.min(1, fall * 2.2), drop = Math.max(0, fall * 2.2 - 1);
      const px = 60 + run * 255, py = 176 + drop * drop * 260;
      ctx.fillStyle = '#b07a44'; ctx.fillRect(px - 12, py, 24, 24); ctx.beginPath(); ctx.arc(px, py - 8, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#6dd86a'; ctx.fillRect(px - 6, py - 12, 4, 4); ctx.fillRect(px + 3, py - 12, 4, 4);
      ctx.fillStyle = '#fff'; ctx.font = `26px ${TX.FONT}`; ctx.fillText('LEVEL 9  ·  LIVES 1', 14, 30);
      if (fall > 0.75) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ff4a4a'; ctx.font = `64px ${TX.FONT}`; ctx.textAlign = 'center'; ctx.fillText('GAME OVER', w / 2, h / 2 + 22); ctx.textAlign = 'left'; }
      tex.needsUpdate = true; return;
    }
    if (boss > 0.5) {
      // SLAUGHTER: a cartoon knight vs. a giant armored boss
      const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#3a0a14'); bg.addColorStop(1, '#120408');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2a0a10'; for (let i = 0; i < 6; i++) ctx.fillRect(i * 95 - 10, 70 + (i % 2) * 20, 40, 220);
      ctx.fillStyle = '#5a1a20'; ctx.fillRect(0, 238, w, 50);
      const bx = 330 + Math.sin(t * 1.6) * 18, by = 150 + Math.abs(Math.sin(t * 3.2)) * -6;
      const fl = paused ? 0 : (Math.sin(t * 7) > 0.7 ? 1 : 0) || hit;
      ctx.fillStyle = fl ? '#ffffff' : '#4a4a5a';
      ctx.fillRect(bx - 55, by - 40, 110, 120); ctx.fillRect(bx - 75, by - 30, 25, 80); ctx.fillRect(bx + 50, by - 30, 25, 80);
      ctx.fillStyle = fl ? '#ffffff' : '#3a3a48'; ctx.beginPath(); ctx.arc(bx, by - 60, 36, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff2a2a'; ctx.fillRect(bx - 20, by - 66, 14, 8); ctx.fillRect(bx + 6, by - 66, 14, 8);
      ctx.fillStyle = '#8a8a9a'; ctx.fillRect(bx - 4, by - 104, 8, 22); ctx.fillRect(bx + 72, by - 120, 10, 150);
      ctx.fillStyle = '#c0c0d0'; ctx.beginPath(); ctx.moveTo(bx + 77, by - 150); ctx.lineTo(bx + 90, by - 120); ctx.lineTo(bx + 64, by - 120); ctx.fill();
      const kx = 140 + Math.sin(t * 5) * 30 * (paused ? 0 : 1), ky = 205;
      ctx.fillStyle = '#4aa8ff'; ctx.fillRect(kx - 14, ky - 30, 28, 40); ctx.beginPath(); ctx.arc(kx, ky - 42, 13, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe36a'; ctx.save(); ctx.translate(kx + 16, ky - 20); ctx.rotate(paused ? -0.6 : -0.6 + Math.sin(t * 14) * 0.9); ctx.fillRect(0, -3, 50, 6); ctx.restore();
      if (!paused && Math.sin(t * 7) > 0.7) { ctx.fillStyle = '#ffe36a'; ctx.font = `34px ${TX.FONT}`; ctx.fillText('HIT!', bx - 30, by - 110); }
      ctx.fillStyle = '#111'; ctx.fillRect(96, 14, 320, 26);
      ctx.fillStyle = '#ff2a3a'; ctx.fillRect(100, 18, 312 * hp, 18);
      ctx.fillStyle = '#ffd0d0'; ctx.font = `20px ${TX.FONT}`; ctx.textAlign = 'center'; ctx.fillText('THE IRON TYRANT', w / 2, 62); ctx.textAlign = 'left';
      ctx.fillStyle = '#ff4a4a'; ctx.font = `26px ${TX.FONT}`; ctx.fillText('SLAUGHTER', 12, h - 12);
      if (paused) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ffffff'; ctx.font = `64px ${TX.FONT}`; ctx.textAlign = 'center'; ctx.fillText('PAUSED', w / 2, h / 2 + 22); ctx.textAlign = 'left'; }
      tex.needsUpdate = true; return;
    }
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#ff9a5a'); sky.addColorStop(1, '#5b2a6e');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a1840';
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 70 - ((t * 20) % 70), 150 - (i % 3) * 25, 50, 200);
    // targets (cartoon robots)
    for (let i = 0; i < 3; i++) {
      const x = 80 + i * 160 + Math.sin(t * 2 + i) * 40, y = 170 + Math.cos(t * 3 + i) * 10;
      const hit = Math.sin(t * 1.3 + i * 2) > 0.85;
      ctx.fillStyle = hit ? '#ffffff' : '#7cf07c';
      ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(x - 10, y - 6, 6, 6); ctx.fillRect(x + 4, y - 6, 6, 6);
    }
    // blaster
    ctx.fillStyle = '#3a6dff';
    ctx.beginPath(); ctx.moveTo(300, 288); ctx.lineTo(340, 210); ctx.lineTo(380, 220); ctx.lineTo(380, 288); ctx.fill();
    if (Math.sin(t * 9) > 0.6) { ctx.fillStyle = '#ffe36a'; ctx.beginPath(); ctx.arc(345, 205, 14, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    const cx = 256 + Math.sin(t * 1.7) * 60, cy = 150 + Math.cos(t * 2.1) * 20;
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.moveTo(cx - 24, cy); ctx.lineTo(cx + 24, cy); ctx.moveTo(cx, cy - 24); ctx.lineTo(cx, cy + 24); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `28px ${TX.FONT}`; ctx.fillText(`SCORE ${Math.floor(1200 + t * 37)}`, 16, 34);
    if (win > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffe14a'; ctx.font = `${70 + 10 * Math.sin(t * 8)}px ${TX.FONT}`; ctx.textAlign = 'center';
      ctx.fillText('YOU WIN!', w / 2, h / 2 + 20); ctx.textAlign = 'left';
    }
    tex.needsUpdate = true;
  };
  return tex;
}

function cityMap() {
  const tex = canvasTex(1024, 512, () => {});
  const { ctx } = tex.userData;
  const hyd = [[180, 120], [300, 360], [520, 220], [700, 140], [820, 380], [430, 430], [620, 300], [260, 230]];
  tex.draw = (t, mode, zoom, blip) => {
    const w = 1024, h = 512;
    if (mode >= 2) {
      // security camera grid
      ctx.fillStyle = '#04070f'; ctx.fillRect(0, 0, w, h);
      const names = ['CAM 01  CITY CENTER', 'CAM 02  PARK', 'CAM 03  HQ ENTRANCE', 'CAM 04  DOWNTOWN', 'CAM 05  BRIDGE', 'CAM 06  ALLEY 7'];
      for (let i = 0; i < 6; i++) {
        const cx = 12 + (i % 3) * 337, cy = 12 + Math.floor(i / 3) * 250, cw = 325, ch = 238;
        const gr = ctx.createLinearGradient(0, cy, 0, cy + ch); gr.addColorStop(0, i === 5 ? '#0a0c18' : '#2a3a5a'); gr.addColorStop(1, i === 5 ? '#050608' : '#1a2230');
        ctx.fillStyle = gr; ctx.fillRect(cx, cy, cw, ch);
        const R = (k) => { const x = Math.sin((i * 13 + k) * 12.9898) * 43758.5453; return x - Math.floor(x); };
        for (let b = 0; b < 7; b++) { ctx.fillStyle = i === 5 ? '#14101a' : '#3a4a6a'; const bh = 60 + R(b) * 120; ctx.fillRect(cx + b * 48, cy + ch - bh, 40, bh); }
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = cy; y < cy + ch; y += 4) ctx.fillRect(cx, y + ((t * 60) % 4), cw, 1);
        ctx.fillStyle = '#9fd0ff'; ctx.font = `16px ${TX.UI_FONT}`; ctx.fillText(names[i], cx + 10, cy + 22);
        if (Math.sin(t * 4 + i) > 0) { ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(cx + cw - 22, cy + 17, 6, 0, 7); ctx.fill(); ctx.fillText('REC', cx + cw - 62, cy + 22); }
        ctx.strokeStyle = '#2f8cff'; ctx.lineWidth = 2; ctx.strokeRect(cx, cy, cw, ch);
      }
      tex.needsUpdate = true; return;
    }
    ctx.save();
    ctx.fillStyle = '#04122b'; ctx.fillRect(0, 0, w, h);
    const z = 1 + zoom * 1.4;
    ctx.translate(w / 2, h / 2); ctx.scale(z, z); ctx.translate(-w / 2 - zoom * 40, -h / 2 + zoom * 20);
    ctx.strokeStyle = '#123a74'; ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = '#2f8cff'; ctx.lineWidth = 7;
    for (const y of [96, 256, 416]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (const x of [192, 512, 832]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    // water pipes
    ctx.strokeStyle = mode >= 1 ? 'rgba(80,255,160,0.5)' : 'rgba(80,200,255,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(100, 300); ctx.lineTo(512, 256); ctx.lineTo(900, 300); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(470, 215, 84, 84);
    ctx.fillStyle = '#9fd0ff'; ctx.font = `22px ${TX.UI_FONT}`; ctx.fillText('CITY CENTER', 450, 205);
    for (const [i, [x, y]] of hyd.entries()) {
      if (mode >= 1) { ctx.fillStyle = '#3dff8a'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); continue; }
      const on = Math.sin(t * 7 + i * 1.7) > -0.2;
      ctx.fillStyle = on ? '#ff3b3b' : '#7a1010';
      ctx.beginPath(); ctx.arc(x, y, 10 + (on ? 4 * Math.sin(t * 10 + i) : 0), 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(255,60,60,${0.5 - ((t * 0.8 + i * 0.13) % 1) * 0.5})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 10 + ((t * 0.8 + i * 0.13) % 1) * 40, 0, 7); ctx.stroke();
    }
    if (mode < 1) {
      // moving signal through the pipes toward the city center
      const k = (t * 0.12) % 1;
      const sx = lerp(100, 512, k), sy = lerp(300, 256, k);
      ctx.fillStyle = '#ff2020'; ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.arc(sx, sy, 14 + 4 * Math.sin(t * 12), 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    }
    if (blip > 0) {
      ctx.fillStyle = `rgba(80,200,255,${blip})`; ctx.shadowColor = '#4fd0ff'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(760, 200, 8, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.restore();
    // HUD
    ctx.fillStyle = mode >= 1 ? '#3dff8a' : '#ff4a4a';
    ctx.font = `30px ${TX.FONT}`;
    ctx.fillText(mode >= 1 ? 'ALL SYSTEMS NORMAL' : 'WARNING: WATER PRESSURE ANOMALY', 24, 40);
    ctx.fillStyle = '#9fd0ff'; ctx.font = `20px ${TX.UI_FONT}`;
    ctx.fillText('AETHERFALL CITY - WATER GRID', 24, h - 20);
    tex.needsUpdate = true;
  };
  return tex;
}

function dataScreen(seed) {
  const tex = canvasTex(384, 256, () => {});
  const { ctx } = tex.userData;
  tex.draw = (t, mode) => {
    ctx.fillStyle = '#051632'; ctx.fillRect(0, 0, 384, 256);
    ctx.fillStyle = '#9fd0ff'; ctx.font = `22px ${TX.FONT}`; ctx.fillText(seed === 1 ? 'PIPE PRESSURE' : 'HYDRANT STATUS', 16, 30);
    for (let i = 0; i < 8; i++) {
      const v = mode >= 1 ? 0.35 + 0.05 * Math.sin(t + i) : 0.4 + 0.5 * Math.abs(Math.sin(t * 3 + i * 1.3 + seed));
      ctx.fillStyle = v > 0.75 ? '#ff4a4a' : mode >= 1 ? '#3dff8a' : '#2f8cff';
      ctx.fillRect(20 + i * 44, 230 - v * 170, 30, v * 170);
    }
    tex.needsUpdate = true;
  };
  return tex;
}

// ------------------------------------------------------------------ HQ LIVING ROOM (floor 1)
export function couch(g, x, z, ry) {
  const c = grp(g, x, 0, z); c.rotation.y = ry;
  const m = mat(0x3b4fa8, { r: 0.85 });
  const m2 = mat(0x2f3f8a, { r: 0.85 });
  box(c, 3.0, 0.26, 1.0, 0, [0, 0.14, 0], { material: m2, round: 0.06 });
  for (const s of [-0.72, 0.72]) box(c, 1.42, 0.18, 0.92, 0, [s, 0.36, 0.02], { material: m, round: 0.08 });
  box(c, 3.0, 0.8, 0.28, 0, [0, 0.62, -0.48], { material: m2, round: 0.1 });
  for (const s of [-1.45, 1.45]) box(c, 0.25, 0.55, 1.0, 0, [s, 0.36, 0], { material: m2, round: 0.08 });
  return c;
}

// small Halloween helpers for the living room (the full set lives in halloween.js)
function hwWeb(g, pos, rot, size = 1.4) {
  const tex = canvasTex(256, 256, (ctx, w) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * P / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * w * 1.1, Math.sin(a) * w * 1.1); ctx.stroke(); }
    ctx.lineWidth = 1.3;
    for (let r = 28; r < w; r += 30) { ctx.beginPath(); for (let i = 0; i <= 8; i++) { const a = (i / 8) * P / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
  });
  return mk(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }), g, pos, rot, null, false);
}
function hwString(g, pts) {
  const mats = [0xff8a1a, 0x9a4ae0].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.5 }));
  const geo = new THREE.SphereGeometry(0.045, 8, 6);
  let k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
    const n = Math.round(a.distanceTo(b) * 2.2);
    for (let j = 0; j <= n; j++) { const u = j / n, p = a.clone().lerp(b, u); p.y -= Math.sin(u * P) * 0.2; mk(geo, mats[k++ % 2], g, [p.x, p.y, p.z], [0, 0, 0], null, false); }
  }
  return mats;
}
function hwPumpkin(g, x, y, z, s, ry) {
  const p = grp(g, x, y, z); p.scale.setScalar(s); p.rotation.y = ry;
  const skin = mat(0xff7a14, { r: 0.6 });
  for (let i = 0; i < 7; i++) { const a = (i / 7) * P * 2; mk(new THREE.SphereGeometry(0.16, 14, 10), skin, p, [Math.sin(a) * 0.09, 0.17, Math.cos(a) * 0.09], [0, a, 0], [0.62, 0.9, 1]); }
  const glow = mat(0xffe060, { e: 0xffb020, ei: 1.6 });
  for (const sd of [1, -1]) mk(new THREE.ConeGeometry(0.035, 0.05, 3), glow, p, [sd * 0.06, 0.21, 0.205], [P / 2, 0, 0]);
  mk(new THREE.BoxGeometry(0.13, 0.03, 0.02), glow, p, [0, 0.12, 0.205]);
  mk(new THREE.CylinderGeometry(0.02, 0.03, 0.08, 6), mat(0x3a6a2a), p, [0, 0.36, 0]);
}
function hwGhost(g, x, y, z) {
  const p = grp(g, x, y, z);
  const w = mat(0xf6f6fb, { r: 0.5 });
  mk(new THREE.SphereGeometry(0.42, 20, 14), w, p, [0, 0.3, 0], [0, 0, 0], [1, 1.1, 0.9]);
  mk(new THREE.CylinderGeometry(0.41, 0.55, 0.6, 18, 1, true), mat(0xf6f6fb, { r: 0.5, side: THREE.DoubleSide }), p, [0, -0.08, 0], [0, 0, 0], [1, 1, 0.85]);
  for (const sd of [1, -1]) mk(new THREE.SphereGeometry(0.06, 10, 8), mat(0x111111), p, [0.35, 0.42, sd * 0.13], [0, 0, 0], [0.5, 1.2, 0.8]);
  mk(new THREE.SphereGeometry(0.075, 10, 8), mat(0x111111), p, [0.36, 0.22, 0], [0, 0, 0], [0.5, 1.3, 1]);
  return p;
}

export function buildLiving() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [-10, 9, 6], target: [0, 0, 0], shadowSize: 9, sunI: 1.7, hemi: 0.95, sky: 0xeaf2ff, ground: 0x6a5a4a });
  const lamp = new THREE.PointLight(0xffc27a, 0, 9, 1.5); lamp.position.set(-3.4, 2.0, 1.6); g.add(lamp);
  const tvLight = new THREE.PointLight(0x8fb8ff, 3, 6, 1.6); tvLight.position.set(0, 1.6, -3.2); g.add(tvLight);
  const floor = new THREE.MeshStandardMaterial({ map: TX.planksTex('#c69a6a', '#b98d5f'), roughness: 0.7 });
  plane(g, 15, 11, floor, [0, 0, 0]);
  const wall = mat(0xd5def0, { r: 0.9 });
  box(g, 15, 3.6, 0.2, 0, [0, 1.8, -4.8], { material: wall, noShadow: true });
  box(g, 15, 3.6, 0.2, 0, [0, 1.8, 5.5], { material: wall, noShadow: true });
  box(g, 0.2, 3.6, 11, 0, [-7.2, 1.8, 0], { material: wall, noShadow: true });
  box(g, 0.2, 3.6, 11, 0, [7.2, 1.8, 0], { material: wall, noShadow: true });
  box(g, 15, 0.1, 11, 0, [0, 3.62, 0.35], { material: mat(0xeef2fa), noShadow: true });
  for (const [x, t] of [[-3, 'HEROES'], [3, 'ACTION']]) mk(new THREE.PlaneGeometry(1.0, 1.4), new THREE.MeshStandardMaterial({ map: TX.posterTex(t, '#3a8a5a', '#0b2a20'), roughness: 0.8 }), g, [x, 2.0, 5.38], [0, P, 0], null, false);
  box(g, 2.4, 0.9, 0.5, 0x3a2c22, [-1, 0.45, 5.15], { round: 0.03 });
  for (let i = 0; i < 4; i++) mk(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 10), mat(0xffc21a, { m: 0.7, r: 0.3 }), g, [-1.8 + i * 0.5, 1.05, 5.15]);
  box(g, 15, 0.12, 0.25, 0, [0, 0.06, -4.68], { material: mat(0x1d2a7a) });
  box(g, 15, 0.08, 0.22, 0, [0, 2.6, -4.68], { material: mat(0x7fd4ff, { e: 0x2f8cff, ei: 0.7 }) });
  // window on left wall
  const cityView = TX.cityViewTex();
  const win = plane(g, 3.2, 1.8, new THREE.MeshStandardMaterial({ color: 0xffffff, map: cityView, emissive: 0xffffff, emissiveMap: cityView, emissiveIntensity: 0.8 }), [-7.08, 1.8, -1.5], [0, P / 2, 0], false);
  for (const [y, h, z, d] of [[2.72, 0.08, -1.5, 3.36], [0.88, 0.08, -1.5, 3.36], [1.8, 1.9, -3.14, 0.08], [1.8, 1.9, 0.14, 0.08], [1.8, 1.84, -1.5, 0.05]]) box(g, 0.06, h, d, 0x2a3550, [-7.04, y, z]);
  // TV
  box(g, 3.5, 2.0, 0.12, 0x0b0d12, [0, 1.75, -4.62], { round: 0.03 });
  const tv = tvGame();
  const tvScreen = plane(g, 3.3, 1.85, new THREE.MeshBasicMaterial({ map: tv }), [0, 1.75, -4.55], [0, 0, 0], false);
  box(g, 3.2, 0.5, 0.6, 0x3a2c22, [0, 0.25, -4.35], { round: 0.03 });
  // couch, table, rug
  couch(g, 0, 0.75, P);
  mk(new THREE.CylinderGeometry(2.6, 2.6, 0.02, 32), mat(0x9a4f4f, { r: 1 }), g, [0, 0.01, -0.4], [0, 0, 0], [1, 1, 0.7]);
  const ctable = grp(g);
  box(ctable, 2.0, 0.08, 0.9, 0x7a5232, [0, 0.42, -0.85], { round: 0.03 });
  for (const [x, z] of [[-0.9, -1.2], [0.9, -1.2], [-0.9, -0.5], [0.9, -0.5]]) box(ctable, 0.07, 0.4, 0.07, 0x5a3a22, [x, 0.2, z]);
  // posters
  for (const [x, t, c1, c2] of [[-4.2, 'TEAMWORK', '#2f6dff', '#0b1440'], [4.0, 'BE READY!', '#ff8a3d', '#5a1a0a']]) {
    mk(new THREE.PlaneGeometry(1.0, 1.4), new THREE.MeshStandardMaterial({ map: TX.posterTex(t, c1, c2), roughness: 0.8 }), g, [x, 2.0, -4.68], [0, 0, 0], null, false);
  }
  // lamp + plant + arcade
  mk(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), mat(0x333333), g, [-3.4, 0.8, 1.6]);
  mk(new THREE.ConeGeometry(0.35, 0.4, 16, 1, true), mat(0xfff0d0, { e: 0xffd090, ei: 0.6, side: THREE.DoubleSide }), g, [-3.4, 1.75, 1.6]);
  box(g, 0.9, 1.9, 0.8, 0x1d2a7a, [-5.8, 0.95, -3.7], { round: 0.05 });
  plane(g, 0.7, 0.55, new THREE.MeshBasicMaterial({ color: 0x3fd2ff }), [-5.8, 1.45, -3.29], [-0.2, 0, 0], false);
  mk(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 12), mat(0xffffff), g, [5.6, 0.25, -4]);
  for (let i = 0; i < 3; i++) mk(new THREE.IcosahedronGeometry(0.38, 1), mat(0x3f9f4f, { r: 0.8 }), g, [5.6 + (i - 1) * 0.15, 0.85 + i * 0.22, -4]);
  // stairs up (right side), rising toward -z
  const stairM = mat(0x8a6a4a, { r: 0.7 });
  for (let i = 0; i < 10; i++) box(g, 1.3, 0.3, 0.45, 0, [5.0, 0.15 + i * 0.3, 1.6 - i * 0.45], { material: stairM });
  box(g, 0.08, 1.0, 5.0, 0x1d2a7a, [4.3, 2.0, -0.6], { rot: [0.585, 0, 0] });
  // door left
  box(g, 0.1, 2.3, 1.2, 0x1d2a7a, [-7.08, 1.15, 2.6]);
  // Episode 5: night lighting + the reinforced steel table for the crown
  const ceil = new THREE.PointLight(0xffe0b8, 0, 12, 1.3); ceil.position.set(-1.5, 3.2, 0); g.add(ceil);
  const steel = grp(g, -3.6, 0, -1.7); steel.visible = false;
  const sm = mat(0x6a7486, { r: 0.35, m: 0.7 }), sd = mat(0x3a4250, { r: 0.4, m: 0.6 });
  box(steel, 1.7, 0.12, 1.1, 0, [0, 0.9, 0], { material: sm, round: 0.02 });
  box(steel, 1.74, 0.03, 1.14, 0, [0, 0.83, 0], { material: mat(0x7fd4ff, { e: 0x2f8cff, ei: 0.9 }) });
  for (const [x, z] of [[-0.72, -0.42], [0.72, -0.42], [-0.72, 0.42], [0.72, 0.42]]) box(steel, 0.14, 0.84, 0.14, 0, [x, 0.42, z], { material: sd });
  box(steel, 1.5, 0.08, 0.08, 0, [0, 0.2, 0], { material: sd });
  for (const [x, z] of [[-0.75, -0.48], [0.75, -0.48], [-0.75, 0.48], [0.75, 0.48]]) mk(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8), mat(0xc8d0dc, { m: 0.8 }), steel, [x, 0.97, z]);
  // controller on couch + pizza
  const ctrl = grp(g); box(ctrl, 0.22, 0.05, 0.12, 0x222831, [0, 0, 0], { round: 0.02 });
  const pizza = grp(g, 0, 0.46, -0.85);
  const boxM = new THREE.MeshStandardMaterial({ map: TX.boxTopTex(), roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    box(pizza, 0.6, 0.07, 0.6, 0, [-0.35 + (i === 2 ? 0.7 : 0), 0.035 + (i === 1 ? 0.075 : 0), 0], { material: mat(0xe8dcc4) });
  }
  plane(pizza, 0.58, 0.58, boxM, [-0.35, 0.152, 0]);
  const open = mk(new THREE.CircleGeometry(0.27, 24), new THREE.MeshStandardMaterial({ map: TX.pizzaTex(), roughness: 0.7 }), pizza, [0.35, 0.075, 0], [-P / 2, 0, 0]);
  box(pizza, 0.6, 0.6, 0.02, 0xe8dcc4, [0.35, 0.36, -0.3], { rot: [-0.2, 0, 0] });

  // Halloween decorations (Episode 4)
  const hw = grp(g); hw.visible = false;
  for (const [pos, rot] of [[[-6.95, 3.35, -4.55], [0, P / 4, 0]], [[6.95, 3.35, -4.55], [0, -P / 4, P / 2]], [[-6.95, 3.35, 5.25], [0, 3 * P / 4, 0]], [[0, 3.5, -4.6], [0, 0, P * 0.75]]]) {
    hwWeb(hw, pos, rot);
  }
  const hwLights = [
    ...hwString(hw, [[-7.0, 3.3, -4.6], [-2.4, 3.3, -4.6], [2.4, 3.3, -4.6], [7.0, 3.3, -4.6]]),
    ...hwString(hw, [[-7.05, 3.3, -4.5], [-7.05, 3.3, 0.5], [-7.05, 3.3, 5.3]]),
    ...hwString(hw, [[7.05, 3.3, -4.5], [7.05, 3.3, 0.5], [7.05, 3.3, 5.3]]),
  ];
  for (const [x, z, ry] of [[-2.1, -4.25, 0.2], [2.1, -4.25, -0.2], [-0.4, 5.0, P]]) hwPumpkin(hw, x, z === 5.0 ? 0.9 : 0, z, z === 5.0 ? 0.8 : 1.1, ry);
  hwPumpkin(hw, 0.7, 0.46, -0.65, 0.55, 0.3);
  const ghost = hwGhost(hw, -6.6, 2.75, 2.6);
  // kitchen corner (back-left): counter, fridge, popcorn, cereal + milk
  const kit = grp(g); kit.visible = false;
  box(kit, 2.8, 0.92, 0.7, 0x4a3a5a, [-5.3, 0.46, 4.95], { round: 0.02 });
  box(kit, 2.9, 0.06, 0.76, 0xe8e4f0, [-5.3, 0.95, 4.95]);
  box(kit, 2.8, 0.7, 0.4, 0x4a3a5a, [-5.3, 2.5, 5.2], { round: 0.02 });
  box(kit, 0.85, 2.0, 0.75, 0xd8dde6, [-3.4, 1.0, 4.95], { round: 0.04, r: 0.3, m: 0.3 });
  box(kit, 0.04, 0.5, 0.04, 0x9a9aa8, [-3.75, 1.3, 4.56], { m: 0.7 });
  const bowl = grp(kit, -4.75, 0.98, 4.85);
  mk(new THREE.SphereGeometry(0.24, 18, 10, 0, P * 2, P / 2, P / 2), mat(0xd02a2a, { r: 0.5, side: THREE.DoubleSide }), bowl, [0, 0.24, 0], [0, 0, 0]);
  for (let i = 0; i < 26; i++) mk(new THREE.IcosahedronGeometry(0.045, 0), mat(0xfff4d0, { r: 0.9 }), bowl, [Math.sin(i * 2.4) * 0.16 * ((i % 4) / 4), 0.2 + 0.035 * (i % 3), Math.cos(i * 2.4) * 0.16 * ((i % 4) / 4)]);
  const bowlCereal = grp(bowl); bowlCereal.visible = false;
  for (let i = 0; i < 12; i++) mk(new THREE.TorusGeometry(0.02, 0.009, 4, 8), mat(0xd8a040), bowlCereal, [Math.sin(i * 1.7) * 0.12, 0.27, Math.cos(i * 1.7) * 0.12], [i, i * 2, 0]);
  const cereal = grp(kit, -5.55, 0.98, 4.95);
  const cerealBox = grp(cereal);
  box(cerealBox, 0.36, 0.5, 0.13, 0, [0, 0.25, 0], { material: new THREE.MeshStandardMaterial({ map: TX.posterTex('CRUNCH!', '#ffd040', '#d02a2a'), roughness: 0.8 }) });
  const milk = grp(kit, -5.55, 1.48, 4.95);
  const carton = grp(milk);
  box(carton, 0.16, 0.3, 0.16, 0xf6f6fa, [0, 0.15, 0]);
  box(carton, 0.165, 0.08, 0.165, 0x3a7ad0, [0, 0.16, 0]);
  mk(new THREE.ConeGeometry(0.115, 0.08, 4), mat(0xf6f6fa), carton, [0, 0.34, 0], [0, P / 4, 0]);
  const puddle = mk(new THREE.CircleGeometry(0.7, 24), mat(0xffffff, { r: 0.15 }), kit, [-4.9, 0.012, 4.2], [-P / 2, 0, 0], [1, 0.7, 1], false);
  const spill = grp(kit); spill.visible = false;
  const R = rng(9);
  for (let i = 0; i < 60; i++) mk(new THREE.TorusGeometry(0.025, 0.011, 4, 8), mat(0xd8a040), spill, [-5.2 + (R() - 0.5) * 2.0, 0.015, 4.1 + (R() - 0.5) * 1.3], [P / 2 + R(), R() * 3, 0], null, false);
  return {
    name: 'living', group: g, bg: new THREE.Color(0x101420), exposure: 1.05,
    refs: { ctrl, pizza },
    update(t, X) {
      const v = X.val;
      const eve = v('evening', 0), night = v('night', 0) > 0.5;
      L.sun.intensity = night ? 0.12 : eve > 0.5 ? 0.5 : 1.7;
      L.sun.color.set(night ? 0x8090ff : eve > 0.5 ? 0xff9a5a : 0xffffff);
      L.hemi.intensity = night ? 0.45 : eve > 0.5 ? 0.55 : 0.95;
      lamp.intensity = night ? 11 : eve > 0.5 ? 9 : 0;
      ceil.intensity = night ? 9 : 0;
      win.material.emissive.set(night ? 0x1a2a50 : eve > 0.5 ? 0xffb08a : 0xeef6ff);
      steel.visible = v('steelTable', 0) > 0.5;
      ctable.visible = v('table.held', 0) < 0.5;
      tv.draw(t, v('tv.win', 0), v('tv.off', 0) > 0.5, v('tv.boss', 0), v('tv.hp', 0.12), v('tv.paused', 0) > 0.5, v('tv.hit', 0) > 0.5, v('tv.fall', -1));
      const hal = v('halloween', 0) > 0.5;
      hw.visible = hal; kit.visible = v('kitchen', 0) > 0.5;
      if (hal) { lamp.color.set(0xff8a30); hwLights.forEach((m, i) => { m.emissiveIntensity = 1.1 + 0.7 * Math.sin(t * 2.5 + i); }); ghost.position.y = 2.75 + 0.06 * Math.sin(t * 1.4); ghost.rotation.z = 0.05 * Math.sin(t * 0.9); }
      if (kit.visible) {
        const f = v('milk.fall', 0);
        carton.rotation.z = -1.7 * smoothstep(0, 0.5, f); carton.position.set(0.5 * f, -0.48 * smoothstep(0.2, 1, f) * 1.0 - (f > 0.6 ? 0.98 * smoothstep(0.6, 1, f) : 0), -0.55 * smoothstep(0.4, 1, f));
        cerealBox.rotation.x = -1.45 * smoothstep(0.1, 0.6, f); cerealBox.position.z = -0.1 * smoothstep(0.1, 0.6, f);
        const pk = v('milk.puddle', 0); puddle.visible = pk > 0.01; puddle.scale.set(0.2 + 0.8 * pk, 0.14 + 0.56 * pk, 1);
        spill.visible = v('cereal.mess', 0) > 0.5; bowlCereal.visible = v('bowl.cereal', 0) > 0.5;
        bowl.visible = v('bowl.held', 0) < 0.5;
      }
      tvLight.intensity = v('tv.off', 0) > 0.5 ? 0 : 3;
      ctrl.visible = v('ctrl.couch', 0) > 0.5;
      ctrl.position.set(v('ctrl.x', 0.6), 0.47, 0.6);
      ctrl.rotation.y = 0.5;
      pizza.visible = v('pizza', 0) > 0.5;
    },
  };
}

// ------------------------------------------------------------------ CONTROLLER ROOM (floor 3)
export function buildControl() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [4, 9, 6], target: [0, 0, -1], shadowSize: 9, sunI: 1.4, hemi: 1.0, sky: 0x9fb8ff, ground: 0x202840, rimColor: 0x4fa8ff, rimI: 1.2 });
  const screenLight = new THREE.PointLight(0xff4040, 5, 9, 1.4); screenLight.position.set(0, 2.2, -2.8); g.add(screenLight);
  const fill = new THREE.PointLight(0xdfe8ff, 40, 14, 1.2); fill.position.set(0, 3.2, 2.5); g.add(fill);
  const floorTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#121a33'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1f5fbf'; c.lineWidth = 3; c.strokeRect(0, 0, w, h); }, { repeat: [8, 6] });
  plane(g, 14, 11, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0.3, emissive: 0x0a1a40, emissiveIntensity: 0.4 }), [0, 0, 0]);
  const wall = mat(0x1a2346, { r: 0.7 });
  box(g, 14, 4, 0.2, 0, [0, 2, -4.8], { material: wall, noShadow: true });
  box(g, 14, 4, 0.2, 0, [0, 2, 6.2], { material: wall, noShadow: true });
  box(g, 0.2, 4, 12, 0, [-6.9, 2, 0.6], { material: wall, noShadow: true });
  box(g, 0.2, 4, 12, 0, [6.9, 2, 0.6], { material: wall, noShadow: true });
  box(g, 14, 0.2, 12, 0, [0, 4.0, 0.6], { material: mat(0x10162e), noShadow: true });
  for (let i = 0; i < 5; i++) box(g, 1.6, 2.2, 0.3, 0x0f1a3a, [-5 + i * 2.5, 1.1, 5.95], { round: 0.04 });
  for (let i = 0; i < 4; i++) box(g, 0.1, 0.06, 10, 0x7fd4ff, [-4.5 + i * 3, 3.88, 0], { e: 0x2f8cff, ei: 1.2 });
  // big map screen
  const map = cityMap();
  box(g, 5.6, 2.9, 0.15, 0x05070f, [0, 2.15, -4.65], { round: 0.04 });
  plane(g, 5.4, 2.7, new THREE.MeshBasicMaterial({ map }), [0, 2.15, -4.56], [0, 0, 0], false);
  const ds = [dataScreen(1), dataScreen(2)];
  ds.forEach((d, i) => {
    const s = i ? 1 : -1;
    const sg = grp(g, s * 4.4, 2.1, -4.0); sg.rotation.y = -s * 0.5;
    box(sg, 2.3, 1.6, 0.12, 0x05070f, [0, 0, 0], { round: 0.03 });
    plane(sg, 2.15, 1.45, new THREE.MeshBasicMaterial({ map: d }), [0, 0, 0.07], [0, 0, 0], false);
  });
  // console desk
  box(g, 5.0, 0.9, 1.0, 0x24305e, [0, 0.45, -3.1], { round: 0.05 });
  box(g, 5.1, 0.1, 1.15, 0x3a4a8a, [0, 0.93, -3.1], { round: 0.03, rot: [0.12, 0, 0] });
  const R = rng(9);
  const btns = [];
  for (let i = 0; i < 18; i++) {
    const b = mk(new THREE.BoxGeometry(0.12, 0.04, 0.1), mat([0xff4040, 0x40ff80, 0x3fb0ff, 0xffd040][i % 4], { e: [0xff4040, 0x40ff80, 0x3fb0ff, 0xffd040][i % 4], ei: 0.6 }), g, [-2.2 + (i % 9) * 0.55, 1.0, -3.3 + Math.floor(i / 9) * 0.3], [0.12, 0, 0]);
    btns.push(b);
  }
  // chairs
  for (const x of [-1.2, 1.4]) {
    mk(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), mat(0x333333), g, [x, 0.25, -1.9]);
    box(g, 0.6, 0.12, 0.6, 0x111a3a, [x, 0.52, -1.9], { round: 0.04 });
    box(g, 0.6, 0.7, 0.1, 0x111a3a, [x, 0.9, -1.6], { round: 0.04 });
  }
  // stair door right
  box(g, 0.1, 2.4, 1.3, 0x0d1430, [6.82, 1.2, 1.4]);
  box(g, 0.12, 0.1, 1.3, 0x7fd4ff, [6.82, 2.45, 1.4], { e: 0x2f8cff, ei: 1 });
  // logo on wall
  mk(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: TX.logoTex(1024, 256), transparent: true }), g, [-3.5, 3.4, -4.69], [0, 0, 0], null, false);
  return {
    name: 'control', group: g, bg: new THREE.Color(0x05070f), exposure: 1.1,
    update(t, X) {
      const v = X.val;
      const mode = v('map.mode', 0);
      map.draw(t, mode, v('map.zoom', 0), v('map.blip', 0));
      ds.forEach((d) => d.draw(t, mode));
      screenLight.color.set(mode >= 1 ? 0x40ff9a : 0xff4040);
      screenLight.intensity = mode >= 1 ? 1.5 : 2.2 + 1.2 * Math.sin(t * 7);
      btns.forEach((b, i) => { b.material.emissiveIntensity = Math.sin(t * 3 + i * 1.7) > 0 ? 0.9 : 0.2; });
    },
  };
}

// ------------------------------------------------------------------ TITLE / CREDITS (3D logo)
export function buildTitle(font, TextGeometry) {
  const g = new THREE.Group();
  const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(3, 4, 8); g.add(key);
  const rim = new THREE.DirectionalLight(0x4fb0ff, 3); rim.position.set(-6, 2, -4); g.add(rim);
  const sweep = new THREE.PointLight(0x9fe0ff, 30, 12, 1.5); g.add(sweep);
  g.add(new THREE.HemisphereLight(0x6f8fff, 0x101830, 0.6));
  const metal = new THREE.MeshStandardMaterial({ color: 0x2f6dff, metalness: 0.8, roughness: 0.25, emissive: 0x0a2a90, emissiveIntensity: 0.5 });
  const face = new THREE.MeshStandardMaterial({ color: 0xdff3ff, metalness: 0.6, roughness: 0.2, emissive: 0x2f8cff, emissiveIntensity: 0.35 });
  const mkText = (txt, size, depth, m) => {
    const geo = new TextGeometry(txt, { font, size, depth, curveSegments: 6, bevelEnabled: true, bevelThickness: depth * 0.25, bevelSize: size * 0.04, bevelSegments: 3 });
    geo.computeBoundingBox(); geo.center();
    return new THREE.Mesh(geo, m);
  };
  const blueMats = [face, metal];
  const redMats = [new THREE.MeshStandardMaterial({ color: 0xffe0e0, metalness: 0.5, roughness: 0.2, emissive: 0xff2030, emissiveIntensity: 0.8 }), new THREE.MeshStandardMaterial({ color: 0xc0101c, metalness: 0.8, roughness: 0.25, emissive: 0x700008, emissiveIntensity: 0.7 })];
  const blueBg = new THREE.Color(0x050a24), redBg = new THREE.Color(0x120206);
  const title = mkText('BATTLE WARS', 1.0, 0.35, blueMats);
  g.add(title);
  const sub = mkText('BE READY!', 0.55, 0.22, [new THREE.MeshStandardMaterial({ color: 0xffd23a, metalness: 0.4, roughness: 0.3, emissive: 0xff7a00, emissiveIntensity: 0.4 }), new THREE.MeshStandardMaterial({ color: 0xff8a00, metalness: 0.5, roughness: 0.3 })]);
  sub.position.set(0, -1.2, 0.3);
  g.add(sub);
  const sub2 = mkText('THE RED DIAMOND HUNT', 0.5, 0.2, [new THREE.MeshStandardMaterial({ color: 0xffd0d0, metalness: 0.4, roughness: 0.3, emissive: 0xff2030, emissiveIntensity: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x9a0a14, metalness: 0.6, roughness: 0.3 })]);
  sub2.position.set(0, -1.2, 0.3);
  g.add(sub2);
  const sub3 = mkText("THE SOUL STEALER'S SECRET", 0.46, 0.18, [new THREE.MeshStandardMaterial({ color: 0xf0d8ff, metalness: 0.4, roughness: 0.3, emissive: 0xa040ff, emissiveIntensity: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x5a1a8a, metalness: 0.6, roughness: 0.3 })]);
  sub3.position.set(0, -1.2, 0.3);
  g.add(sub3);
  const sub4 = mkText('SPOOKY HALLOWEEN PARTY', 0.46, 0.18, [new THREE.MeshStandardMaterial({ color: 0xfff0c0, metalness: 0.4, roughness: 0.3, emissive: 0xff8a1a, emissiveIntensity: 0.7 }), new THREE.MeshStandardMaterial({ color: 0x5a1a8a, metalness: 0.6, roughness: 0.3 })]);
  sub4.position.set(0, -1.2, 0.3);
  g.add(sub4);
  const sub5 = mkText('BEHEMOTH AWAKENS', 0.5, 0.2, [new THREE.MeshStandardMaterial({ color: 0xf0d8ff, metalness: 0.4, roughness: 0.3, emissive: 0xb040ff, emissiveIntensity: 0.75 }), new THREE.MeshStandardMaterial({ color: 0x3a3f50, metalness: 0.8, roughness: 0.3 })]);
  sub5.position.set(0, -1.2, 0.3);
  g.add(sub5);
  const orangeMats = [new THREE.MeshStandardMaterial({ color: 0xffe0b0, metalness: 0.5, roughness: 0.2, emissive: 0xff7a10, emissiveIntensity: 0.8 }), new THREE.MeshStandardMaterial({ color: 0xd05a08, metalness: 0.8, roughness: 0.25, emissive: 0x602000, emissiveIntensity: 0.7 })];
  const hwBg = new THREE.Color(0x12061e);
  const emb = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({ map: TX.emblemTex(), transparent: true, opacity: 0.35, depthWrite: false }));
  emb.position.set(0, 0.2, -1.5);
  g.add(emb);
  // energy rays
  const rays = grp(g, 0, 0, -3);
  for (let i = 0; i < 16; i++) {
    const m = mk(new THREE.PlaneGeometry(0.5, 30), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x1d3fa8 : 0x0f2470, transparent: true, opacity: 0.6, depthWrite: false }), rays, [0, 0, 0], [0, 0, (i / 16) * P], null, false);
    m.geometry.translate(0, 15, 0);
  }
  return {
    name: 'title', group: g, bg: new THREE.Color(0x050a24), exposure: 1.0,
    update(t, X) {
      const v = X.val;
      const k = v('title.k', 0);
      const th = v('title.theme', 0), hw = th > 1.5, red = th > 0.5 && !hw;
      title.material = hw ? orangeMats : red ? redMats : blueMats;
      X.scene.background = hw ? hwBg : red ? redBg : blueBg;
      rays.children.forEach((m, i) => m.material.color.set(hw ? (i % 2 ? 0x5a1a8a : 0x8a3a0a) : red ? (i % 2 ? 0x8a0a16 : 0x3a0408) : (i % 2 ? 0x1d3fa8 : 0x0f2470)));
      rim.color.set(hw ? 0xa050ff : red ? 0xff3040 : 0x4fb0ff);
      sweep.color.set(hw ? 0xffa050 : red ? 0xff7070 : 0x9fe0ff);
      emb.visible = !red && !hw;
      title.scale.setScalar(Math.max(0.001, k));
      title.rotation.y = Math.max(0, 1 - k) * 1.2;
      title.position.x = red ? Math.sin(t * 61) * 0.03 * v('title.jolt', 0) : 0;
      const ks = v('title.sub', 0);
      const which = v('title.subText', 'BE READY!');
      sub.visible = which === 'BE READY!'; sub2.visible = which === 'THE RED DIAMOND HUNT'; sub3.visible = which === "THE SOUL STEALER'S SECRET"; sub4.visible = which === 'SPOOKY HALLOWEEN PARTY'; sub5.visible = which === 'BEHEMOTH AWAKENS';
      for (const m of [sub, sub2, sub3, sub4, sub5]) { m.scale.setScalar(Math.max(0.001, ks)); m.position.y = v('title.subY', -1.2); }
      title.position.y = v('title.y', 0.25);
      emb.material.opacity = 0.35 * k;
      rays.rotation.z = t * 0.15;
      sweep.position.set(Math.sin(t * 1.5) * 6, 1, 3);
    },
  };
}

// ------------------------------------------------------------------ HIDDEN REACTOR ROOM (below HQ)
function subwayMap() {
  const tex = canvasTex(1024, 576, () => {});
  const { ctx } = tex.userData;
  const lines = [
    { c: '#3fd2ff', p: [[60, 140], [300, 160], [520, 260], [760, 240], [980, 120]] },
    { c: '#7cf0ff', p: [[120, 480], [330, 380], [520, 260], [700, 420], [960, 470]] },
    { c: '#3fa8ff', p: [[520, 40], [520, 260], [560, 540]] },
  ];
  const gems = [[300, 160], [700, 420], [560, 470]];
  tex.draw = (t, on, mode = 1, energy = 4) => {
    const w = 1024, h = 576;
    ctx.clearRect(0, 0, w, h);
    if (on <= 0.01) { tex.needsUpdate = true; return; }
    ctx.globalAlpha = on;
    if (mode === 0 || mode === 2) {
      // energy status / warning display
      ctx.fillStyle = 'rgba(120,10,20,0.3)'; ctx.fillRect(0, 0, w, h);
      const blink = Math.sin(t * 6) > 0;
      ctx.fillStyle = '#ffb0b8'; ctx.font = `46px ${TX.FONT}`; ctx.textAlign = 'center';
      ctx.fillText(mode === 0 ? 'RED TEAM ENERGY RESERVES' : 'ALERT', w / 2, 80);
      if (mode === 0) {
        ctx.strokeStyle = '#ff6070'; ctx.lineWidth = 6; ctx.strokeRect(160, 200, 704, 110);
        ctx.fillStyle = blink ? '#ff2a3a' : '#a01020'; ctx.fillRect(170, 210, 684 * energy / 100, 90);
        ctx.font = `120px ${TX.FONT}`; ctx.fillStyle = blink ? '#ffffff' : '#ff8090'; ctx.fillText(`${Math.round(energy)}%`, w / 2, 450);
        ctx.font = `30px ${TX.UI_FONT}`; ctx.fillStyle = '#ffd0d4'; ctx.fillText('EMERGENCY POWER FAILURE IMMINENT', w / 2, 520);
      } else {
        ctx.font = `64px ${TX.FONT}`; ctx.fillStyle = blink ? '#e0b0ff' : '#a060ff';
        ctx.fillText('UNKNOWN ENERGY SIGNATURE', w / 2, 260);
        ctx.fillText('DETECTED BENEATH THE CITY', w / 2, 340);
        ctx.strokeStyle = '#c070ff'; ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(w / 2, 450, 20 + ((t * 60 + i * 30) % 90), 0, 7); ctx.stroke(); }
      }
      ctx.textAlign = 'left'; ctx.globalAlpha = 1; tex.needsUpdate = true; return;
    }
    ctx.fillStyle = 'rgba(20,90,140,0.25)'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(80,200,255,0.25)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (const l of lines) {
      ctx.strokeStyle = l.c; ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.shadowColor = l.c; ctx.shadowBlur = 14;
      ctx.beginPath(); l.p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = '#dff8ff';
      for (const [x, y] of l.p) { ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill(); }
    }
    for (const [i, [x, y]] of gems.entries()) {
      const p = 1 + 0.25 * Math.sin(t * 5 + i * 2);
      ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
      ctx.fillStyle = '#ff2a40'; ctx.shadowColor = '#ff2040'; ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(20, 0); ctx.lineTo(0, 26); ctx.lineTo(-20, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    const sy = (t * 140) % h;
    ctx.fillStyle = 'rgba(160,240,255,0.25)'; ctx.fillRect(0, sy, w, 6);
    ctx.fillStyle = '#bff3ff'; ctx.font = `34px ${TX.FONT}`; ctx.fillText('ABANDONED SUBWAY DISTRICT', 28, 50);
    ctx.fillStyle = '#ff6a7a'; ctx.font = `22px ${TX.UI_FONT}`; ctx.fillText('RED DIAMOND SIGNATURES: 3', 28, h - 24);
    ctx.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  return tex;
}

export function buildReactor() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [3, 9, 6], target: [0, 0, -1], shadowSize: 10, sunI: 0.7, hemi: 0.45, sky: 0x9fb0d0, ground: 0x201820, rimColor: 0xff5050, rimI: 0.8, rimPos: [0, 4, -8] });
  const fill = new THREE.PointLight(0xdde6ff, 22, 14, 1.3); fill.position.set(0, 3.4, 3.5); g.add(fill);
  const roomLights = [];
  for (const [x, z] of [[-3.5, -1], [3.5, -1], [-3.5, 3], [3.5, 3]]) {
    const pl = new THREE.PointLight(0xe8f0ff, 6, 8, 1.6); pl.position.set(x, 3.6, z); g.add(pl);
    const panel = box(g, 1.4, 0.06, 0.5, 0xffffff, [x, 3.95, z], { e: 0xe8f0ff, ei: 1.2, noShadow: true });
    roomLights.push({ pl, panel });
  }
  const reactorLight = new THREE.PointLight(0xff2a2a, 14, 12, 1.4); reactorLight.position.set(0, 2.2, -3.4); g.add(reactorLight);
  plane(g, 16, 13, new THREE.MeshStandardMaterial({ map: TX.metalFloorTex(), roughness: 0.6, metalness: 0.4 }), [0, 0, 0]);
  const wall = mat(0x2b2f38, { r: 0.85 });
  box(g, 16, 4.2, 0.3, 0, [0, 2.1, -6.6], { material: wall, noShadow: true });
  box(g, 16, 4.2, 0.3, 0, [0, 2.1, 6.6], { material: wall, noShadow: true });
  box(g, 0.3, 4.2, 13.2, 0, [-8, 2.1, 0], { material: wall, noShadow: true });
  box(g, 0.3, 4.2, 13.2, 0, [8, 2.1, 0], { material: wall, noShadow: true });
  box(g, 16, 0.2, 13.2, 0, [0, 4.1, 0], { material: mat(0x1a1d24), noShadow: true });
  // support beams + pipes + hazard stripes
  for (const x of [-5.5, 5.5]) for (const z of [-6.2, 6.2]) box(g, 0.5, 4.2, 0.5, 0x4a505c, [x, 2.1, z], { noShadow: true });
  const pipeM = mat(0x6a5a4a, { r: 0.5, m: 0.6 });
  for (const [y, z] of [[3.3, -6.3], [3.6, -6.25], [0.5, -6.3]]) mk(new THREE.CylinderGeometry(0.12, 0.12, 16, 12), pipeM, g, [0, y, z], [0, 0, P / 2]);
  for (const y of [1.2, 2.8]) mk(new THREE.CylinderGeometry(0.1, 0.1, 13, 12), pipeM, g, [-7.75, y, 0], [P / 2, 0, 0]);
  const stripes = new THREE.MeshStandardMaterial({ map: TX.stripesTex(), roughness: 0.7 });
  stripes.map.wrapS = THREE.RepeatWrapping; stripes.map.repeat.set(6, 1);
  plane(g, 6, 0.35, stripes, [0, 0.006, -1.9]);
  // the reactor
  const base = grp(g, 0, 0, -4.2);
  const steel = mat(0x7a808c, { r: 0.35, m: 0.8 });
  mk(new THREE.CylinderGeometry(1.7, 1.9, 0.6, 32), steel, base, [0, 0.3, 0]);
  mk(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 32), mat(0x3a3f4a, { r: 0.5, m: 0.6 }), base, [0, 0.75, 0]);
  const glass = new THREE.MeshStandardMaterial({ color: 0xff8080, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, emissive: 0xff1020, emissiveIntensity: 0.4 });
  mk(new THREE.CylinderGeometry(0.85, 0.85, 2.6, 32, 1, true), glass, base, [0, 2.2, 0]);
  const coreM = new THREE.MeshStandardMaterial({ color: 0xff3040, emissive: 0xff1030, emissiveIntensity: 2, roughness: 0.3 });
  const core = mk(new THREE.CylinderGeometry(0.38, 0.38, 2.5, 20), coreM, base, [0, 2.2, 0]);
  const rings = [];
  for (const y of [1.2, 2.2, 3.2]) rings.push(mk(new THREE.TorusGeometry(1.0, 0.07, 10, 40), steel, base, [0, y, 0], [P / 2, 0, 0]));
  mk(new THREE.CylinderGeometry(1.2, 0.9, 0.5, 32), steel, base, [0, 3.7, 0]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * P * 2; mk(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), steel, base, [Math.cos(a) * 0.95, 2.2, Math.sin(a) * 0.95]); }
  for (const sd of [-1, 1]) mk(new THREE.CylinderGeometry(0.14, 0.14, 2.4, 10), pipeM, base, [sd * 1.6, 1.8, 0.4], [0, 0, sd * 0.6]);
  // map table + hologram
  const table = grp(g, 0, 0, 0.2);
  mk(new THREE.CylinderGeometry(0.5, 0.7, 0.85, 20), mat(0x3a3f4a, { r: 0.5, m: 0.6 }), table, [0, 0.42, 0]);
  mk(new THREE.CylinderGeometry(1.3, 1.25, 0.12, 40), mat(0x262a34, { r: 0.3, m: 0.7 }), table, [0, 0.9, 0]);
  const rim = mk(new THREE.TorusGeometry(1.28, 0.03, 8, 48), mat(0x3fd2ff, { e: 0x3fd2ff, ei: 1.4 }), table, [0, 0.96, 0], [P / 2, 0, 0]);
  const beam = mk(new THREE.CylinderGeometry(1.15, 1.2, 1.1, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x3fd2ff, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), table, [0, 1.52, 0], [0, 0, 0], null, false);
  const map = subwayMap();
  const holo = mk(new THREE.PlaneGeometry(2.5, 1.4), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), table, [0, 2.05, 0], [-0.12, 0, 0], null, false);
  const holoLight = new THREE.PointLight(0x3fd2ff, 5, 4, 1.5); holoLight.position.set(0, 1.6, 0); table.add(holoLight);
  const gem = mk(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: 0xff3040, emissive: 0xff1030, emissiveIntensity: 1.5, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 }), table, [0, 1.3, 0], [0, 0, 0], [1, 1.4, 1], false);
  // crates for Greg
  const wood = mat(0x7a5a3a, { r: 0.8 });
  box(g, 1.1, 0.47, 0.8, 0, [-4.6, 0.235, -1.9], { material: wood, round: 0.02 });
  box(g, 1.0, 1.0, 1.0, 0, [-5.6, 0.5, -2.9], { material: wood, round: 0.02 });
  box(g, 0.8, 0.8, 0.8, 0, [-5.5, 1.4, -2.9], { material: mat(0x6a4c30, { r: 0.8 }), round: 0.02 });
  box(g, 1.0, 1.0, 1.0, 0, [-6.7, 0.5, -1.8], { material: wood, round: 0.02 });
  // control console on the right wall
  box(g, 2.6, 1.0, 0.7, 0x24305e, [6.6, 0.5, -2.2], { round: 0.04 });
  const scr = plane(g, 2.2, 1.0, new THREE.MeshBasicMaterial({ color: 0x0a2a4a }), [7.6, 2.0, -2.2], [0, -P / 2, 0], false);
  // Red Team HQ extras: lockers, Flare's desk, emergency beacons, tunnel door, prank buzzer
  const lockerM = mat(0x5a1018, { r: 0.5, m: 0.5 });
  for (let i = 0; i < 6; i++) {
    const z = -0.2 + i * 0.75;
    box(g, 0.6, 2.1, 0.7, 0, [7.5, 1.05, z], { material: lockerM, noShadow: true });
    for (let k = 0; k < 3; k++) box(g, 0.02, 0.04, 0.4, 0x2a0a0e, [7.19, 1.7 - k * 0.08, z]);
    box(g, 0.03, 0.12, 0.03, 0xc0c0c0, [7.19, 1.1, z + 0.25], { m: 0.8 });
  }
  const desk = grp(g, -5.2, 0, 2.4);
  box(desk, 0.8, 0.06, 1.5, 0x4a3a30, [0, 0.76, 0], { round: 0.01 });
  for (const [x, z] of [[-0.35, -0.68], [0.35, -0.68], [-0.35, 0.68], [0.35, 0.68]]) box(desk, 0.05, 0.75, 0.05, 0x222222, [x, 0.375, z]);
  box(desk, 0.22, 0.05, 0.3, 0xe0d8c8, [0.1, 0.815, 0.5], { r: 0.9 });
  mk(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 10), mat(0xc04040), desk, [0.15, 0.85, -0.5]);
  const chair = grp(g, -5.95, 0, 2.4);
  box(chair, 0.5, 0.06, 0.5, 0x222831, [0, 0.47, 0]);
  box(chair, 0.06, 0.6, 0.5, 0x222831, [-0.25, 0.78, 0]);
  mk(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), mat(0x333333), chair, [0, 0.22, 0]);
  const beacons = [];
  for (const [x, z, ry] of [[-7.8, -3.5, P / 2], [7.8, -4.2, -P / 2], [-7.8, 4.0, P / 2], [3.5, -6.45, 0]]) {
    const b = grp(g, x, 3.4, z); b.rotation.y = ry;
    mk(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 12), mat(0x333333), b, [0, -0.08, 0]);
    const dome = mk(new THREE.SphereGeometry(0.13, 12, 8, 0, P * 2, 0, P / 2), mat(0xff2020, { e: 0xff1010, ei: 1, opacity: 0.85 }), b, [0, 0, 0], [0, 0, 0], null, false);
    const beam = mk(new THREE.ConeGeometry(0.35, 1.6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), b, [0, 0, 0], [0, 0, P / 2], null, false);
    beam.geometry.translate(0, -0.8, 0);
    beacons.push({ b, dome, beam });
  }
  const alarmLight = new THREE.PointLight(0xff1010, 0, 18, 1.2); alarmLight.position.set(0, 3.5, 1); g.add(alarmLight);
  const doorFrame = grp(g, -4.6, 0, -6.4);
  box(doorFrame, 2.6, 3.0, 0.2, 0x3a3f4a, [0, 1.5, 0], { noShadow: true });
  const doorL = box(doorFrame, 1.1, 2.6, 0.12, 0x6a1018, [-0.55, 1.3, 0.12], { m: 0.6, r: 0.4 });
  const doorR = box(doorFrame, 1.1, 2.6, 0.12, 0x6a1018, [0.55, 1.3, 0.12], { m: 0.6, r: 0.4 });
  plane(doorFrame, 2.2, 2.6, new THREE.MeshBasicMaterial({ color: 0x030304 }), [0, 1.3, 0.09], [0, 0, 0], false);
  mk(new THREE.PlaneGeometry(1.8, 0.35), new THREE.MeshBasicMaterial({ map: TX.signTex('TO THE TUNNELS', '#2a0a0e', '#ff8a8a', 512, 96) }), doorFrame, [0, 2.9, 0.12], [0, 0, 0], null, false);
  const buzzer = grp(g);
  mk(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 14), mat(0x333333), buzzer, [0, 0.025, 0]);
  const buzzTop = mk(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 14), mat(0xff3030, { e: 0xff2020, ei: 0.5 }), buzzer, [0, 0.06, 0]);
  // lounge corner: couch facing a TV on the front wall
  couch(g, 5.4, 4.8, 0);
  box(g, 3.2, 1.8, 0.1, 0x0b0d12, [5.4, 1.75, 6.4], { round: 0.03, noShadow: true });
  const hqTv = tvGame();
  const hqTvScreen = plane(g, 3.0, 1.65, new THREE.MeshBasicMaterial({ map: hqTv }), [5.4, 1.75, 6.34], [0, P, 0], false);
  box(g, 2.4, 0.4, 0.5, 0x2a2024, [5.4, 0.2, 6.1], { round: 0.02 });
  // knocked-over mess after the fight
  const mess = grp(g);
  const mr = rng(88);
  for (let i = 0; i < 6; i++) box(mess, 0.6 + mr() * 0.4, 0.4 + mr() * 0.4, 0.5, 0x7a5a3a, [-3 + mr() * 6, 0.2, -1 + mr() * 4], { rot: [mr() * 0.6, mr() * 3, mr() * 0.8], round: 0.02 });
  rubble(mess, -1.5, 2.2, 8, mr, 2.5); rubble(mess, 2.0, -0.8, 8, mr, 2.5);
  const deskRefs = { desk, chair, beacons, alarmLight, doorL, doorR, buzzer, buzzTop, hqTv, mess };
  return {
    name: 'reactor', group: g, bg: new THREE.Color(0x07080c), exposure: 1.05,
    update(t, X) {
      const v = X.val;
      // power with a flicker on top
      const pw = v('reactor.power', 1);
      const fl = v('reactor.flicker', 0);
      const flick = fl > 0 ? (Math.sin(t * 37) * Math.sin(t * 23.3) > 0.1 ? 1 : 0.15) : 1;
      const p = clamp(pw * lerp(1, flick, fl) + v('reactor.flash', 0));
      coreM.emissiveIntensity = 0.15 + 2.4 * p * (0.85 + 0.15 * Math.sin(t * 6));
      glass.emissiveIntensity = 0.05 + 0.5 * p;
      reactorLight.intensity = 1 + 16 * p;
      core.scale.set(0.8 + 0.2 * p, 1, 0.8 + 0.2 * p);
      rings.forEach((r, i) => { r.rotation.z = t * (0.3 + 0.9 * p) * (i % 2 ? -1 : 1); });
      const rl = v('room.lights', 1);
      const rf = rl < 0.99 && rl > 0.01 ? (Math.sin(t * 41) > 0 ? 1 : 0.3) : 1;
      for (const r of roomLights) { r.pl.intensity = 6 * rl * rf; r.panel.material.emissiveIntensity = 1.2 * rl * rf; }
      fill.intensity = 6 + 16 * rl;
      L.hemi.intensity = 0.25 + 0.25 * rl;
      const ho = v('holo.on', 1);
      const hf = v('holo.glitch', 0) > 0 ? (Math.sin(t * 53) > -0.3 ? 1 : 0.2) : 1;
      map.draw(t, ho * hf, v('holo.mode', 1), v('hq.energy', 4));
      holoLight.intensity = 5 * ho * hf;
      beam.material.opacity = 0.08 * ho * hf;
      rim.material.emissiveIntensity = 0.3 + 1.1 * ho;
      const gd = v('holo.diamond', 0);
      gem.visible = gd > 0.01;
      gem.scale.set(gd, gd * 1.4, gd);
      gem.rotation.y = t * 1.4;
      gem.position.y = 1.3 + 0.05 * Math.sin(t * 2);
      scr.material.color.set(Math.sin(t * 2) > 0 ? 0x0a3a5a : 0x0a2a4a);
      deskRefs.hqTv.draw(t, 0, v('hq.tv', 0) < 0.5);
      deskRefs.mess.visible = v('hq.mess', 0) > 0.5;
      const pu = v('hq.purple', 0);
      if (pu > 0.01) {
        for (const r of roomLights) { r.pl.color.set(0xb050ff); r.panel.material.emissive.set(0xb050ff); }
        fill.color.set(0x9050ff); L.hemi.color.set(0x8a50ff);
      } else {
        for (const r of roomLights) { r.pl.color.set(0xe8f0ff); r.panel.material.emissive.set(0xffffff); }
        fill.color.set(0xdde6ff); L.hemi.color.set(0x9fb0d0);
      }
      const al = v('hq.alarm', 0);
      deskRefs.beacons.forEach((bc, i) => { bc.beam.rotation.y = t * 4 + i; bc.beam.visible = al > 0.01; bc.beam.material.opacity = 0.25 * al; bc.dome.material.emissiveIntensity = 0.2 + al * (Math.sin(t * 8 + i) > 0 ? 1.4 : 0.4); });
      deskRefs.alarmLight.intensity = al * (Math.sin(t * 8) > 0 ? 10 : 3);
      const dk = v('hq.door', 0);
      deskRefs.doorL.position.x = -0.55 - dk * 1.1; deskRefs.doorR.position.x = 0.55 + dk * 1.1;
      deskRefs.buzzer.visible = v('buzzer.vis', 0) > 0.5;
      deskRefs.buzzer.position.set(v('buzzer.x', 0), 0, v('buzzer.z', 0));
      const bz = v('buzzer.on', 0);
      deskRefs.buzzTop.material.emissiveIntensity = 0.5 + bz * 2;
      deskRefs.buzzer.position.x += bz * Math.sin(t * 90) * 0.01;
    },
  };
}

// ------------------------------------------------------------------ SOUL STEALER'S CAVERN (deep below)
export function buildCavern() {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0x8a4060, 0x0a0408, 0.9); g.add(hemi);
  const front = new THREE.PointLight(0xc0a0ff, 5, 9, 1.5); front.position.set(1.5, 3, 2.5); g.add(front);
  const daisFront = new THREE.PointLight(0xe0d0ff, 4, 6, 1.5); daisFront.position.set(0, 2.4, -0.4); g.add(daisFront);
  const key = new THREE.DirectionalLight(0xff6070, 0.6); key.position.set(-3, 8, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); g.add(key);
  const R = rng(77);
  const rock = new THREE.MeshStandardMaterial({ color: 0x2c2430, roughness: 0.95, flatShading: true });
  const groundGeo = new THREE.PlaneGeometry(40, 40, 50, 50);
  groundGeo.rotateX(-P / 2);
  const gp = groundGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i); const d = Math.hypot(x, z + 2); gp.setY(i, (d > 3 ? 0.25 * Math.sin(x * 0.9) * Math.cos(z * 0.7) + 0.15 * R() : 0)); }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, rock); ground.receiveShadow = true; g.add(ground);
  mk(new THREE.SphereGeometry(16, 24, 16, 0, P * 2, 0, P / 2), new THREE.MeshStandardMaterial({ color: 0x1a141e, roughness: 1, side: THREE.BackSide, flatShading: true }), g, [0, -1, -2], [0, 0, 0], [1, 0.62, 1], false);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * P * 2 + R() * 0.2, r = 9 + R() * 4;
    const m = mk(new THREE.DodecahedronGeometry(1.5 + R() * 2.2, 0), rock, g, [Math.cos(a) * r, R() * 2, -2 + Math.sin(a) * r], [R() * 3, R() * 3, R() * 3], [1, 1.2 + R(), 1]);
    m.castShadow = false;
  }
  for (let i = 0; i < 40; i++) {
    const a = R() * P * 2, r = 2 + R() * 9;
    mk(new THREE.ConeGeometry(0.15 + R() * 0.35, 1 + R() * 2.5, 6), rock, g, [Math.cos(a) * r, 8.6 - R() * 1.2, -2 + Math.sin(a) * r], [P, 0, 0], null, false);
  }
  // red diamond crystals
  const crystalM = new THREE.MeshStandardMaterial({ color: 0xff3040, emissive: 0xff1030, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92 });
  const clusters = [[-4.5, -5], [4.8, -4.5], [-6, 1], [6.2, 0.5], [-2.5, -7], [2.8, -7.2], [0, -8]];
  const crystalLights = [];
  for (const [cx, cz] of clusters) {
    for (let i = 0; i < 5; i++) {
      const h = 0.5 + R() * 1.2;
      mk(new THREE.OctahedronGeometry(0.25, 0), crystalM, g, [cx + (R() - 0.5) * 0.9, h * 0.35, cz + (R() - 0.5) * 0.9], [(R() - 0.5) * 0.7, R() * 3, (R() - 0.5) * 0.7], [1, h * 3, 1], false);
    }
    const pl = new THREE.PointLight(0xff2030, 6, 7, 1.6); pl.position.set(cx, 1.0, cz); g.add(pl); crystalLights.push(pl);
  }
  // dais
  mk(new THREE.CylinderGeometry(1.6, 2.0, 0.35, 10), mat(0x3a2e3e, { r: 0.9 }), g, [0, 0.17, -2]);
  const ring = plane(g, 3.6, 3.6, new THREE.MeshBasicMaterial({ map: TX.soulSymbolTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), [0, 0.37, -2]);
  // the Soul Stealer's hologram of the team
  const teamTex = canvasTex(512, 320, () => {});
  const teamHolo = mk(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ map: teamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), g, [0, 2.2, 0.2], [0, 0, 0], null, false);
  const drawTeam = (t) => {
    const c = teamTex.userData.ctx, w = 512, h = 320;
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(160,80,255,0.15)'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(200,140,255,0.9)'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
    const hairs = ['#3a2a20', '#6b3a1e', '#1a1210', '#ffffff', '#4e3020'];
    for (let i = 0; i < 5; i++) {
      const x = 70 + i * 92, y = 200 + 5 * Math.sin(t * 2 + i);
      c.fillStyle = i === 3 ? 'rgba(40,40,50,0.9)' : 'rgba(255,90,100,0.85)'; c.fillRect(x - 22, y - 40, 44, 90);
      c.fillStyle = i === 3 ? '#f2f2f4' : 'rgba(240,200,170,0.95)'; c.beginPath(); c.arc(x, y - 62, 22, 0, 7); c.fill();
      c.fillStyle = hairs[i]; if (i !== 3) { c.beginPath(); c.arc(x, y - 72, 20, P, 0); c.fill(); }
    }
    c.fillStyle = '#e0c0ff'; c.font = `26px ${TX.FONT}`; c.fillText('RED TEAM', 18, 34);
    c.fillStyle = `rgba(220,180,255,${0.15 + 0.1 * Math.sin(t * 40)})`; c.fillRect(0, (t * 120) % h, w, 4);
    teamTex.needsUpdate = true;
  };
  // drifting embers
  const embers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff5050 }), 160);
  g.add(embers);
  const mtx = new THREE.Matrix4();
  return {
    name: 'cavern', group: g, bg: new THREE.Color(0x050205), fog: [0x12040a, 6, 30], exposure: 1.1,
    update(t, X) {
      const v = X.val;
      const glow = v('cave.glow', 0.6);
      const vi = v('cave.violet', 0);
      crystalM.color.set(vi > 0.5 ? 0xb060ff : 0xff3040); crystalM.emissive.set(vi > 0.5 ? 0x7020d0 : 0xff1030);
      crystalLights.forEach((l) => l.color.set(vi > 0.5 ? 0x9040ff : 0xff2030));
      hemi.color.set(vi > 0.5 ? 0x5a3a8a : 0x8a4060);
      crystalM.emissiveIntensity = 0.4 + 1.4 * glow * (0.85 + 0.15 * Math.sin(t * 2));
      crystalLights.forEach((l, i) => { l.intensity = (2 + 6 * glow) * (0.8 + 0.2 * Math.sin(t * 1.7 + i)); });
      ring.material.opacity = v('cave.ring', 0) * (0.7 + 0.3 * Math.sin(t * 4));
      const th = v('cave.holo', 0);
      teamHolo.visible = th > 0.01;
      if (teamHolo.visible) { teamHolo.material.opacity = th * (Math.sin(t * 31) > -0.85 ? 1 : 0.4); drawTeam(t); }
      ring.rotation.z = -t * 0.3;
      for (let i = 0; i < 160; i++) {
        const h1 = Math.sin(i * 12.9898) * 43758.5453 % 1, h2 = Math.sin(i * 78.233) * 12345.678 % 1;
        const a = Math.abs(h1) * P * 2, r = 1.5 + Math.abs(h2) * 9;
        const y = ((t * (0.15 + Math.abs(h2) * 0.25) + Math.abs(h1) * 7) % 7);
        mtx.makeTranslation(Math.cos(a + t * 0.05) * r, y, -1.2 - Math.abs(Math.sin(a + t * 0.05)) * r * 0.8);
        embers.setMatrixAt(i, mtx);
      }
      embers.instanceMatrix.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------ shared underground pieces
function concreteTex(seed, base = '#5a5852', line = '#46443f') {
  const r = rng(seed);
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + r() * 0.06})`; c.fillRect(r() * w, r() * h, 2 + r() * 4, 2 + r() * 4); }
    c.strokeStyle = line; c.lineWidth = 3;
    for (let y = 0; y <= h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? 0 : 64; x <= w; x += 128) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 64); c.stroke(); }
    c.fillStyle = 'rgba(40,60,30,0.25)';
    for (let i = 0; i < 6; i++) c.fillRect(r() * w, h - 40 - r() * 40, 30 + r() * 60, 40 + r() * 40);
  }, { repeat: [1, 1] });
}

function rails(g, x0, x1, z, R) {
  const len = x1 - x0;
  const steel = mat(0x6a5a50, { r: 0.4, m: 0.7 });
  for (const dz of [-0.55, 0.55]) mk(new THREE.BoxGeometry(len, 0.1, 0.07), steel, g, [(x0 + x1) / 2, 0.12, z + dz]);
  const wood = mat(0x4a3a2c, { r: 0.9 });
  for (let x = x0 + 0.3; x < x1; x += 0.6) {
    if (R() < 0.12) continue;
    mk(new THREE.BoxGeometry(0.22, 0.08, 1.6), wood, g, [x, 0.04, z + (R() - 0.5) * 0.1], [0, (R() - 0.5) * 0.2, R() < 0.1 ? 0.2 : 0]);
  }
}

function rubble(g, x, z, n, R, spread = 1.2) {
  const m = mat(0x6e6a62, { r: 0.95 });
  for (let i = 0; i < n; i++) mk(new THREE.DodecahedronGeometry(0.08 + R() * 0.22, 0), m, g, [x + (R() - 0.5) * spread, 0.06, z + (R() - 0.5) * spread], [R() * 3, R() * 3, R() * 3]);
}

// A straight arched subway tunnel along x, centred on z.
function tunnelSegment(g, x0, x1, z, seed, opts = {}) {
  const R = rng(seed);
  const len = x1 - x0;
  const wallTex = concreteTex(seed); wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(len / 4, 3);
  const wall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, side: THREE.BackSide });
  const archGeo = new THREE.CylinderGeometry(3.0, 3.0, len, 32, 1, true, 0, P);
  archGeo.rotateZ(P / 2); // axis along x, the open side faces down
  const arch = new THREE.Mesh(archGeo, wall);
  arch.position.set((x0 + x1) / 2, 0.5, z);
  arch.receiveShadow = true;
  g.add(arch);
  for (const dz of [-2.95, 2.95]) box(g, len, 0.5, 0.1, 0, [(x0 + x1) / 2, 0.25, z + dz], { material: mat(0x4e4c46, { r: 0.95 }), noShadow: true });
  const groundTex = concreteTex(seed + 1, '#3e3b36', '#3a3732'); groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(len / 3, 2);
  plane(g, len, 6, new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }), [(x0 + x1) / 2, 0, z]);
  rails(g, x0, x1, z + 0.9, R);
  // walkway side
  box(g, len, 0.16, 1.2, 0x55524c, [(x0 + x1) / 2, 0.08, z - 1.9], { noShadow: true });
  // cables + lamps
  for (const y of [2.3, 2.4]) mk(new THREE.CylinderGeometry(0.025, 0.025, len, 6), mat(0x151515), g, [(x0 + x1) / 2, y, z - 2.62], [0, 0, P / 2]);
  const lamps = [];
  for (let x = x0 + 3; x < x1 - 1; x += 7) {
    const broken = R() < 0.3;
    const lm = box(g, 0.5, 0.18, 0.12, 0xfff0c8, [x, 2.05, z - 2.75], { e: broken ? 0x000000 : 0xffd890, ei: broken ? 0 : 1.2, noShadow: true });
    lamps.push({ lm, broken });
  }
  for (let i = 0; i < Math.round(len / 5); i++) rubble(g, x0 + R() * len, z + (R() - 0.5) * 4, 3 + Math.floor(R() * 4), R);
  const lights = [];
  const nl = opts.lights ?? 3;
  for (let i = 0; i < nl; i++) {
    const pl = new THREE.PointLight(opts.lightColor ?? 0xffd8a0, opts.lightI ?? 9, 13, 1.4);
    pl.position.set(x0 + (len * (i + 0.5)) / nl, 2.3, z - 1.4);
    g.add(pl); lights.push(pl);
  }
  return { lamps, lights };
}

function archHole(g, x, y, z, w, h, ry, color = 0x020203) {
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, P, 0, true); sh.lineTo(w / 2, 0); sh.lineTo(-w / 2, 0);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 16), new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
  return m;
}

// ------------------------------------------------------------------ ABANDONED SUBWAY TUNNELS
// Segment A (z=0): main tunnel ending at the fork (x=0).
// Segment B (z=30): Leon + Aaron's branch, ending at a narrow passage glowing red (x=0).
// Segment C (z=60): the way back out toward headquarters (light at x=0).
export function buildTunnels() {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0x8090a8, 0x201a14, 0.35); g.add(hemi);
  const segA = tunnelSegment(g, -40, 0, 0, 11);
  const segB = tunnelSegment(g, -30, 0, 30, 12, { lights: 2 });
  const segC = tunnelSegment(g, -30, 0, 60, 13, { lights: 2 });
  // fork wall with two openings
  box(g, 0.4, 3.6, 6.2, 0, [0.2, 1.8, 0], { material: mat(0x4a4842, { r: 0.95 }), noShadow: true });
  archHole(g, -0.01, 0, -1.4, 1.9, 2.6, -P / 2);
  archHole(g, -0.01, 0, 1.4, 1.9, 2.6, -P / 2);
  mk(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: TX.signTex('LINE B  <', '#20242a', '#e0e0d0', 512, 128) }), g, [-0.02, 2.95, -1.4], [0, -P / 2, 0], null, false);
  mk(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: TX.signTex('>  LINE C', '#20242a', '#e0e0d0', 512, 128) }), g, [-0.02, 2.95, 1.4], [0, -P / 2, 0], null, false);
  // narrow red passage at the end of B
  box(g, 0.4, 3.6, 6.2, 0, [0.2, 1.8, 30], { material: mat(0x4a4842, { r: 0.95 }), noShadow: true });
  archHole(g, -0.01, 0, 30, 0.9, 2.2, -P / 2, 0x3a0408);
  const redGlow = new THREE.PointLight(0xff2030, 6, 8, 1.5); redGlow.position.set(-0.8, 1.2, 30); g.add(redGlow);
  const redMist = mk(new THREE.PlaneGeometry(2.4, 2.6), new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }), g, [-0.05, 1.1, 30], [0, -P / 2, 0], null, false);
  // exit light at the end of C
  box(g, 0.4, 3.6, 6.2, 0, [0.2, 1.8, 60], { material: mat(0x4a4842, { r: 0.95 }), noShadow: true });
  archHole(g, -0.01, 0, 60, 2.2, 2.8, -P / 2, 0xfff4e0);
  const exitLight = new THREE.PointLight(0xfff0d8, 14, 14, 1.2); exitLight.position.set(-1.2, 1.6, 60); g.add(exitLight);
  // security-recording hologram projected from Leon's case
  const recTex = canvasTex(512, 384, () => {});
  const rec = mk(new THREE.PlaneGeometry(1.4, 1.05), new THREE.MeshBasicMaterial({ map: recTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), g, [0, 0, 0], [0, 0, 0], null, false);
  const drawRec = (t, zoom) => {
    const c = recTex.userData.ctx, w = 512, h = 384;
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(60,180,255,0.18)'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(120,220,255,0.9)'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#bff3ff'; c.font = `26px ${TX.FONT}`; c.fillText(zoom > 0.5 ? 'REC 01  -  ENHANCED' : 'REC 01  -  CHAMBER', 18, 34);
    c.save(); c.translate(w / 2, h * 0.62);
    const s = 1 + zoom * 1.6; c.scale(s, s); c.translate(zoom * 30, -zoom * 30);
    // pedestal
    c.fillStyle = 'rgba(150,230,255,0.6)'; c.fillRect(30, 40, 120, 22);
    for (let i = 0; i < 5; i++) { c.fillStyle = '#ff5a6a'; c.beginPath(); c.moveTo(45 + i * 22, 22); c.lineTo(53 + i * 22, 36); c.lineTo(45 + i * 22, 44); c.lineTo(37 + i * 22, 36); c.fill(); }
    // figure in uniform with spiky hair, slipping a diamond into his wrist guard
    c.fillStyle = 'rgba(255,120,130,0.85)'; c.fillRect(-60, -50, 46, 90);
    c.fillStyle = 'rgba(190,240,255,0.9)'; c.beginPath(); c.arc(-37, -72, 20, 0, 7); c.fill();
    c.fillStyle = 'rgba(160,110,80,0.95)';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-55 + i * 7, -82); c.lineTo(-50 + i * 7, -106 - (i % 2) * 6); c.lineTo(-45 + i * 7, -82); c.fill(); }
    const k = (t * 0.6) % 1;
    c.fillStyle = 'rgba(255,120,130,0.85)'; c.save(); c.translate(-14, -30); c.rotate(-0.6 + k * 0.9); c.fillRect(0, -6, 60, 12); c.restore();
    c.fillStyle = '#ff3040'; c.beginPath(); c.arc(-14 + Math.cos(-0.6 + k * 0.9) * 60, -30 + Math.sin(-0.6 + k * 0.9) * 60, 7, 0, 7); c.fill();
    c.restore();
    c.fillStyle = `rgba(160,240,255,${0.12 + 0.08 * Math.sin(t * 40)})`; c.fillRect(0, (t * 200) % h, w, 5);
    recTex.needsUpdate = true;
  };
  // a broken old train car in segment A
  const car = grp(g, -26, 0, 0.9);
  box(car, 7, 2.4, 2.4, 0x6a7078, [0, 1.45, 0], { r: 0.6, m: 0.4, round: 0.1 });
  for (let i = 0; i < 5; i++) box(car, 0.9, 0.7, 0.02, 0x1a2228, [-2.6 + i * 1.3, 1.8, -1.21]);
  box(car, 7.05, 0.15, 2.45, 0x8a2020, [0, 1.0, 0]);
  car.rotation.z = 0.05;
  return {
    name: 'tunnel', group: g, bg: new THREE.Color(0x050505), fog: [0x0a0a0c, 4, 32], exposure: 1.15,
    update(t, X) {
      const v = X.val;
      redMist.material.opacity = 0.2 + 0.1 * Math.sin(t * 3);
      redGlow.intensity = 5 + 2 * Math.sin(t * 3);
      const ro = v('rec.on', 0);
      rec.visible = ro > 0.01;
      if (rec.visible) {
        rec.position.set(v('rec.x', 0), 1.75 + 0.3 * v('rec.zoom', 0), v('rec.z', 0));
        rec.rotation.y = v('rec.ry', 0);
        rec.scale.setScalar(ro * (1 + 0.5 * v('rec.zoom', 0)));
        rec.material.opacity = ro * (Math.sin(t * 47) > -0.8 ? 1 : 0.5);
        drawRec(t, v('rec.zoom', 0));
      }
      const fl = v('tunnel.flicker', 0);
      for (const sg of [segA, segB, segC]) sg.lights.forEach((l, i) => { l.intensity = 9 * (fl > 0 && Math.sin(t * 31 + i * 7) > 0.6 ? 0.3 : 1); });
    },
  };
}

// ------------------------------------------------------------------ LOWER TUNNEL CHAMBER (broken machinery)
export function buildMachineRoom() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [4, 9, 5], target: [0, 0, -1], shadowSize: 9, sunI: 0.5, hemi: 0.35, sky: 0x8090a8, ground: 0x201a14, rim: false });
  const R = rng(21);
  const wt = concreteTex(31); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(4, 1.5);
  const wall = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95 });
  box(g, 16, 5, 0.3, 0, [0, 2.5, -6.2], { material: wall, noShadow: true });
  box(g, 16, 5, 0.3, 0, [0, 2.5, 6.2], { material: wall, noShadow: true });
  box(g, 0.3, 5, 12.4, 0, [-8, 2.5, 0], { material: wall, noShadow: true });
  box(g, 0.3, 5, 12.4, 0, [8, 2.5, 0], { material: wall, noShadow: true });
  box(g, 16, 0.3, 12.4, 0, [0, 5, 0], { material: mat(0x2a2824), noShadow: true });
  const gt = concreteTex(32, '#3e3b36', '#3a3732'); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(4, 3);
  plane(g, 16, 12.4, new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }), [0, 0, 0]);
  archHole(g, 0, 0, -6.04, 2.6, 3.2, 0);
  archHole(g, 7.84, 0, 2, 2.2, 2.8, -P / 2);
  // broken machines
  const metal = mat(0x5a6068, { r: 0.5, m: 0.6 }), rust = mat(0x7a4a2a, { r: 0.8, m: 0.3 });
  box(g, 2.4, 2.2, 1.4, 0, [-5.5, 1.1, -4.6], { material: metal, round: 0.05 });
  box(g, 1.6, 1.6, 1.2, 0, [-3.2, 0.8, -5.0], { material: rust, round: 0.05 });
  box(g, 1.2, 2.6, 1.0, 0, [5.6, 1.3, -4.8], { material: metal, round: 0.05 });
  for (const [x, y, z, r] of [[-5.5, 2.4, -3.85, 0.5], [-4.6, 1.2, -3.85, 0.35], [5.6, 2.0, -4.25, 0.3]]) mk(new THREE.TorusGeometry(r, 0.08, 8, 20), rust, g, [x, y, z]);
  for (let i = 0; i < 4; i++) mk(new THREE.CylinderGeometry(0.12, 0.12, 6, 10), metal, g, [-6 + i * 0.4, 3.8, 0], [P / 2, 0, 0]);
  mk(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), rust, g, [3.5, 0.4, -2.5], [0, 0.5, P / 2 - 0.15]);
  for (let i = 0; i < 8; i++) rubble(g, (R() - 0.5) * 13, (R() - 0.5) * 9, 4, R);
  // Greg's rock + the metal bin
  mk(new THREE.DodecahedronGeometry(0.55, 0), mat(0x6e6a62, { r: 0.95 }), g, [-1.6, 0.1, 1.2], [0.3, 0.6, 0], [1.1, 0.62, 0.9]);
  const bin = grp(g, 1.5, 0, 0.9);
  mk(new THREE.CylinderGeometry(0.32, 0.28, 0.65, 16, 1, true), mat(0x4a4e54, { r: 0.5, m: 0.7, side: THREE.DoubleSide }), bin, [0, 0.33, 0]);
  mk(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 16), mat(0x222222), bin, [0, 0.05, 0]);
  const lamps = [];
  for (const [x, z] of [[-3, -1], [3, -1], [0, 3]]) {
    const pl = new THREE.PointLight(0xffe0b0, 7, 11, 1.4); pl.position.set(x, 4.2, z); g.add(pl);
    const bulb = mk(new THREE.SphereGeometry(0.12, 10, 8), mat(0xfff0c0, { e: 0xffd890, ei: 1.5 }), g, [x, 4.5, z]);
    mk(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4), mat(0x111111), g, [x, 4.78, z]);
    lamps.push({ pl, bulb });
  }
  return {
    name: 'machines', group: g, bg: new THREE.Color(0x050505), fog: [0x0a0a0c, 6, 30], exposure: 1.15,
    update(t, X) {
      const v = X.val;
      const l = v('mach.lights', 1), fl = v('mach.flicker', 0);
      lamps.forEach((lp, i) => { const f = fl > 0 ? (Math.sin(t * 37 + i * 3) > 0.2 ? 1 : 0.1) : 1; lp.pl.intensity = 7 * l * f; lp.bulb.material.emissiveIntensity = 1.5 * l * f; });
      L.hemi.intensity = 0.15 + 0.2 * l;
    },
  };
}

// ------------------------------------------------------------------ ABANDONED SUBWAY PLATFORM
export function buildPlatform() {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0x8a90b0, 0x1a1418, 0.4); g.add(hemi);
  const R = rng(41);
  const wt = concreteTex(51, '#6a6a62', '#55554e'); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(6, 1.5);
  const wall = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.9 });
  // platform floor at y=0, track pit along z in [-6.5, -3]
  const ft = concreteTex(52, '#5a5650', '#4e4a44'); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(8, 2);
  plane(g, 30, 7.5, new THREE.MeshStandardMaterial({ map: ft, roughness: 0.95 }), [0, 0, 0.75]);
  box(g, 30, 0.12, 0.35, 0xd8c040, [0, 0.0, -2.85], { noShadow: true });
  box(g, 30, 1.2, 0.2, 0, [0, -0.6, -3.0], { material: mat(0x3a3a36), noShadow: true });
  plane(g, 30, 4, mat(0x2a2824, { r: 1 }), [0, -1.2, -5.0]);
  rails(grp(g, 0, -1.2, 0), -15, 15, -4.8, R);
  box(g, 30, 6, 0.3, 0, [0, 2.0, 4.6], { material: wall, noShadow: true });
  box(g, 30, 7, 0.3, 0, [0, 2.0, -7.2], { material: wall, noShadow: true });
  box(g, 0.3, 7, 12, 0, [-15, 2.0, -1.2], { material: wall, noShadow: true });
  box(g, 0.3, 7, 12, 0, [15, 2.0, -1.2], { material: wall, noShadow: true });
  box(g, 30, 0.3, 12, 0, [0, 5.2, -1.2], { material: mat(0x2a2824), noShadow: true });
  // wall tiles band + station sign
  box(g, 30, 0.6, 0.05, 0x8a2a2a, [0, 1.6, 4.43], { noShadow: true });
  mk(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: TX.signTex('AETHERFALL CENTRAL', '#f0ead8', '#2a2a2a', 768, 128) }), g, [-5, 2.6, 4.43], [0, P, 0], null, false);
  // pillars
  for (let x = -12; x <= 12; x += 4) box(g, 0.55, 5.2, 0.55, 0x8a8478, [x, 2.6, -1.6], { r: 0.9 });
  // broken train car in the pit
  const car = grp(g, 6, -1.2, -4.8);
  box(car, 9, 2.8, 2.6, 0x6a7078, [0, 1.6, 0], { r: 0.6, m: 0.4, round: 0.1 });
  for (let i = 0; i < 6; i++) box(car, 0.9, 0.8, 0.02, 0x10161a, [-3.6 + i * 1.4, 2.1, 1.31]);
  box(car, 9.05, 0.18, 2.65, 0x8a2020, [0, 1.15, 0]);
  car.rotation.z = -0.03;
  // fallen beam (Greg slides under) and debris
  mk(new THREE.BoxGeometry(0.25, 0.3, 4.5), mat(0x5a5048, { r: 0.6, m: 0.5 }), g, [1.5, 0.85, 0.6], [0.0, 0.0, 0.0]);
  for (const zz of [-1.4, 2.6]) mk(new THREE.BoxGeometry(0.4, 0.75, 0.4), mat(0x6e6a62), g, [1.5, 0.37, zz]);
  for (let i = 0; i < 8; i++) rubble(g, (R() - 0.5) * 24, R() * 3, 4, R);
  // the old machine with buttons
  const mach = grp(g, -4, 0, 3.9);
  box(mach, 1.4, 1.6, 0.8, 0x3a5a6a, [0, 0.8, 0], { round: 0.04 });
  box(mach, 1.0, 0.45, 0.05, 0x0a1a20, [0, 1.25, -0.41]);
  const btns = [];
  for (let i = 0; i < 6; i++) btns.push(box(mach, 0.11, 0.11, 0.06, [0xff3030, 0x30ff60, 0xffd030][i % 3], [-0.35 + (i % 3) * 0.35, 0.82 - Math.floor(i / 3) * 0.2, -0.42], { e: [0xff3030, 0x30ff60, 0xffd030][i % 3], ei: 0.4 }));
  // red crystal in the wall
  const crystal = mk(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0xff3040, emissive: 0xff1030, emissiveIntensity: 1.2, roughness: 0.1 }), g, [6, 1.3, 4.38], [0, 0, 0], [1, 1.5, 0.6], false);
  for (let i = 0; i < 4; i++) mk(new THREE.OctahedronGeometry(0.08, 0), crystal.material, g, [6 + (i - 1.5) * 0.18, 1.3 + Math.sin(i * 2) * 0.2, 4.4], [0, 0, i], [1, 1.6, 0.6], false);
  const crystalLight = new THREE.PointLight(0xff2030, 3, 4, 1.6); crystalLight.position.set(6, 1.3, 3.9); g.add(crystalLight);
  // the pipe on the floor (before Greg grabs it)
  const pipe = mk(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 10), mat(0x7a7f88, { r: 0.4, m: 0.7 }), g, [2.6, 0.04, 1.6], [P / 2, 0.6, P / 2]);
  // lamps
  const lamps = [];
  for (const x of [-9, -3, 3, 9]) {
    const pl = new THREE.PointLight(0xfff0d0, 7, 12, 1.4); pl.position.set(x, 4.3, 0.8); g.add(pl);
    const bulb = box(g, 1.2, 0.08, 0.3, 0xffffff, [x, 4.95, 0.8], { e: 0xfff0d0, ei: 1.4, noShadow: true });
    lamps.push({ pl, bulb });
  }
  const alarm = new THREE.PointLight(0xff1010, 0, 14, 1.3); alarm.position.set(-4, 2.8, 3); g.add(alarm);
  const violet = new THREE.PointLight(0x9040ff, 0, 12, 1.4); violet.position.set(-9, 2.5, 0.5); g.add(violet);
  return {
    name: 'platform', group: g, bg: new THREE.Color(0x040406), fog: [0x08080c, 6, 34], exposure: 1.15,
    update(t, X) {
      const v = X.val;
      const l = v('plat.lights', 1);
      lamps.forEach((lp) => { lp.pl.intensity = 7 * l; lp.bulb.material.emissiveIntensity = 1.4 * l; });
      hemi.intensity = 0.34 + 0.2 * l;
      const al = v('plat.alarm', 0);
      alarm.intensity = al * (Math.sin(t * 9) > 0 ? 8 : 0.5);
      btns.forEach((b, i) => { b.material.emissiveIntensity = al > 0 ? (Math.sin(t * 9 + i) > 0 ? 1.5 : 0.2) : 0.4 * l; });
      violet.intensity = v('plat.violet', 0) * (4 + Math.sin(t * 3));
      const cg = v('crystal.glow', 0);
      crystal.material.emissiveIntensity = 1.0 + 2 * cg + 0.2 * Math.sin(t * 4);
      crystalLight.intensity = 1.5 + 2.5 * cg;
      pipe.visible = v('pipe.world', 1) > 0.5;
      pipe.position.set(v('pipe.x', 2.6), 0.04, v('pipe.z', 1.6));
    },
  };
}

// ------------------------------------------------------------------ ANCIENT DIAMOND CHAMBER
export function buildDiamondChamber() {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0xd0c0b0, 0x201010, 0.7); g.add(hemi);
  const fillC = new THREE.PointLight(0xfff0e0, 22, 18, 1.2); fillC.position.set(0, 4.5, 4); g.add(fillC);
  const fillD = new THREE.PointLight(0xfff0e0, 14, 16, 1.2); fillD.position.set(0, 4.5, -5); g.add(fillD);
  const key = new THREE.DirectionalLight(0xffd0b0, 0.6); key.position.set(3, 9, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 }); g.add(key);
  const R = rng(61);
  const stoneTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#6a5040'; c.fillRect(0, 0, w, h);
    const r2 = rng(5);
    for (let y = 0; y < h; y += 42) for (let x = (y / 42) % 2 ? -30 : 0; x < w; x += 64) { c.fillStyle = `rgb(${90 + r2() * 30},${66 + r2() * 20},${50 + r2() * 15})`; c.fillRect(x + 2, y + 2, 60, 38); }
    c.strokeStyle = 'rgba(255,90,90,0.25)'; c.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const x = r2() * w, y = r2() * h; c.strokeRect(x, y, 18, 18); c.beginPath(); c.arc(x + 9, y + 9, 5, 0, 7); c.stroke(); }
  }, { repeat: [6, 2] });
  const wallM = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9, side: THREE.BackSide });
  mk(new THREE.CylinderGeometry(7.5, 7.5, 6, 40, 1, true), wallM, g, [0, 3, 0], [0, 0, 0], null, false);
  mk(new THREE.SphereGeometry(7.5, 32, 12, 0, P * 2, 0, P / 2), new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 1, side: THREE.BackSide }), g, [0, 6, 0], [0, 0, 0], [1, 0.4, 1], false);
  const ft = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#5a4436'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a2a22'; c.lineWidth = 4; for (let x = 0; x <= w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); c.beginPath(); c.moveTo(0, x); c.lineTo(w, x); c.stroke(); } }, { repeat: [6, 6] });
  plane(g, 15, 15, new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 }), [0, 0, 0]);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * P * 2 + P / 8; mk(new THREE.CylinderGeometry(0.4, 0.5, 6, 12), mat(0x7a5a46, { r: 0.85 }), g, [Math.cos(a) * 6.6, 3, Math.sin(a) * 6.6]); }
  archHole(g, 7.3, 0, 0, 2.2, 2.8, -P / 2);
  archHole(g, -7.3, 0, 0, 2.2, 2.8, P / 2);
  // pedestal with 12 diamonds and empty sockets
  const ped = grp(g, 0, 0, -1.5);
  const stone = mat(0x8a6a52, { r: 0.8 });
  mk(new THREE.CylinderGeometry(1.5, 1.7, 0.3, 24), stone, ped, [0, 0.15, 0]);
  mk(new THREE.CylinderGeometry(1.1, 1.3, 0.4, 24), stone, ped, [0, 0.5, 0]);
  mk(new THREE.CylinderGeometry(0.95, 1.0, 0.25, 24), stone, ped, [0, 0.82, 0]);
  const gemM = new THREE.MeshStandardMaterial({ color: 0xff3040, emissive: 0xff1030, emissiveIntensity: 1.4, roughness: 0.1, metalness: 0.2 });
  const gems = [];
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * P * 2, r = i % 2 ? 0.62 : 0.42;
    const pos = [Math.cos(a) * r, 1.05, Math.sin(a) * r];
    mk(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 8), mat(0x2a1a14), ped, [pos[0], 0.955, pos[2]]);
    if (i % 5 === 4) continue; // three empty sockets
    gems.push(mk(new THREE.OctahedronGeometry(0.09, 0), gemM, ped, pos, [0, a, 0], [1, 1.5, 1], false));
  }
  const black = mk(new THREE.DodecahedronGeometry(0.13, 0), new THREE.MeshStandardMaterial({ color: 0x0a0610, emissive: 0x7020c0, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.5 }), ped, [0, 1.08, 0], [0.3, 0.4, 0]);
  const blackLight = new THREE.PointLight(0x9040ff, 1.5, 3, 1.6); blackLight.position.set(0, 1.4, -1.5); g.add(blackLight);
  const gemLight = new THREE.PointLight(0xff3040, 4, 5, 1.6); gemLight.position.set(0, 1.5, -1.5); g.add(gemLight);
  // raised stone stage for Flare
  mk(new THREE.CylinderGeometry(1.3, 1.5, 0.6, 20), stone, g, [-3.6, 0.3, -3.2]);
  // braziers
  for (const [x, z] of [[3.8, -4.2], [-5.4, 1.5], [5.2, 2.6]]) {
    mk(new THREE.CylinderGeometry(0.3, 0.2, 0.9, 10), mat(0x3a2a20, { m: 0.5 }), g, [x, 0.45, z]);
    mk(new THREE.SphereGeometry(0.25, 10, 8), mat(0xff6020, { e: 0xff5010, ei: 2 }), g, [x, 0.95, z], [0, 0, 0], [1, 0.6, 1]);
    const pl = new THREE.PointLight(0xff8040, 4, 7, 1.6); pl.position.set(x, 1.4, z); g.add(pl);
  }
  return {
    name: 'chamber', group: g, bg: new THREE.Color(0x0a0505), fog: [0x140806, 8, 30], exposure: 1.1,
    update(t, X) {
      const v = X.val;
      const cnt = v('ped.count', 12);
      gems.forEach((m, i) => { m.visible = i < cnt; m.rotation.y = t * 0.6 + i; });
      gemM.emissiveIntensity = 1.2 + 0.3 * Math.sin(t * 2);
      gemLight.intensity = 1 + 2.5 * (cnt / 12);
      const bp = 0.5 + 0.5 * Math.sin(t * 3);
      black.material.emissiveIntensity = 0.3 + 1.0 * bp * v('black.glow', 1);
      blackLight.intensity = 0.8 + 2 * bp * v('black.glow', 1);
      black.visible = v('black.vis', 1) > 0.5;
    },
  };
}

// ------------------------------------------------------------------ CITY PARK
export function buildPark() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [-12, 16, 10], target: [0, 0, 0], shadowSize: 16, sunI: 2.4, hemi: 1.25, sky: 0xe6f2ff, ground: 0x6a8a4a });
  const R = rng(91);
  const grassTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5aa04a'; c.fillRect(0, 0, w, h);
    const r2 = rng(3);
    for (let i = 0; i < 2500; i++) { c.fillStyle = r2() < 0.5 ? 'rgba(40,110,40,0.35)' : 'rgba(140,200,90,0.3)'; c.fillRect(r2() * w, r2() * h, 2, 4); }
  }, { repeat: [14, 14] });
  plane(g, 120, 120, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }), [0, 0, 0]);
  // winding path
  const path = new THREE.MeshStandardMaterial({ color: 0xd9c8a0, roughness: 0.95 });
  for (let i = -14; i <= 14; i++) {
    const x = i * 1.6, z = Math.sin(i * 0.25) * 2.2;
    mk(new THREE.CylinderGeometry(1.5, 1.5, 0.02, 20), path, g, [x, 0.01, z], [0, 0, 0], [1, 1, 0.75], false).receiveShadow = true;
  }
  // pond
  mk(new THREE.CylinderGeometry(4, 4, 0.04, 40), mat(0x5ab0e8, { r: 0.05, m: 0.2, e: 0x1a4a80, ei: 0.2 }), g, [9, 0.02, -9], [0, 0, 0], [1.4, 1, 1], false);
  mk(new THREE.TorusGeometry(4, 0.2, 8, 40), mat(0xa09888), g, [9, 0.05, -9], [P / 2, 0, 0], [1.4, 1, 1]);
  // trees, benches, lamps, flowers
  const spots = [[-12, -7], [-6, -9], [2, -10], [-15, 6], [-8, 7], [4, 8], [12, 6], [16, -3], [-18, -2], [20, 10], [-22, 9], [24, -8]];
  spots.forEach(([x, z], i) => tree(g, x, z, 1.2 + R() * 0.5, i + 3));
  for (const [x, z, ry] of [[-4, 4.2, P], [6, -3.6, 0], [14, 3.6, P]]) {
    const b = grp(g, x, 0, z); b.rotation.y = ry;
    box(b, 1.8, 0.08, 0.5, 0x8a5a32, [0, 0.45, 0]);
    box(b, 1.8, 0.4, 0.06, 0x8a5a32, [0, 0.7, -0.22]);
    for (const sx of [-0.8, 0.8]) box(b, 0.08, 0.45, 0.45, 0x2b2f36, [sx, 0.22, 0]);
  }
  for (const x of [-10, 0, 10, 20]) streetLamp(g, x, 3.6, -1);
  const flowerCols = [0xff5a7a, 0xffd23f, 0xb07aff, 0xffffff];
  for (let i = 0; i < 60; i++) {
    const x = (R() - 0.5) * 40, z = (R() - 0.5) * 30;
    if (Math.abs(z - Math.sin(x / 1.6 * 0.25) * 2.2) < 2.4) continue;
    mk(new THREE.SphereGeometry(0.08, 6, 5), mat(flowerCols[i % 4]), g, [x, 0.12, z]);
    mk(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4), mat(0x3a8a3a), g, [x, 0.06, z]);
  }
  // city skyline beyond the park
  for (let i = 0; i < 18; i++) building(g, -50 + i * 6.5, -45 - R() * 6, 5 + R() * 2, 6, 14 + R() * 24, [0xc9d6e3, 0xd9c7a7, 0xb7c4d6][i % 3], 400 + i);
  // Flare's notebook flying through the air
  const book = grp(g);
  mk(new THREE.BoxGeometry(0.17, 0.025, 0.22), mat(0x6a2a1a, { r: 0.8 }), book);
  return {
    name: 'park', group: g, bg: TX.skyTex('#3f8fe0', '#9fd0f5', '#e8f4ff'), fog: [0xcfe4f5, 40, 120], exposure: 1.0,
    update(t, X) {
      const v = X.val;
      book.visible = v('book.vis', 0) > 0.5;
      book.position.set(v('book.x', 0), v('book.y', 0), v('book.z', 0));
      book.rotation.set(t * 7, t * 3, 0);
    },
  };
}
