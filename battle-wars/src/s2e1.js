// Season 2 Episode 1 "Thanksgiving": Gus's Market (inside + outside), the parade avenue, the HQ dining room + kitchen,
// Thanksgiving decorations for the living room, the new Season 2 intro title, and the turkey / cart objects.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, mk, grp, rng, hash, canvasTex, clamp, lerp, smoothstep, noise1, roundRect } from './util.js';
import { lights, box, plane, building, streetLamp } from './sets.js';
import * as TX from './textures.js';

const P = Math.PI, S = Math.sin, C = Math.cos;

function instances(parent, geo, material, items, shadow = true) {
  const im = new THREE.InstancedMesh(geo, material, Math.max(1, items.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
  items.forEach((it, i) => {
    e.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0); q.setFromEuler(e);
    ps.set(it.x, it.y, it.z); sc.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    m4.compose(ps, q, sc); im.setMatrixAt(i, m4); im.setColorAt(i, c.set(it.c ?? 0xffffff));
  });
  im.castShadow = shadow; im.receiveShadow = shadow;
  parent.add(im);
  return im;
}
const signM = (text, bg, fg, w, h, font) => new THREE.MeshBasicMaterial({ map: TX.signTex(text, bg, fg, 1024, Math.round(1024 * h / w), font) });
function sign(parent, text, w, h, pos, bg = '#1a5a2a', fg = '#ffffff', rot = [0, 0, 0], font) {
  return mk(new THREE.PlaneGeometry(w, h), signM(text, bg, fg, w, h, font), parent, pos, rot, null, false);
}

// ------------------------------------------------------------------ food + decor pieces
const LEAF_COLS = [0xd9531e, 0xe8a02a, 0xb83a1a, 0xf2c23a, 0x8a3a12];
export function pumpkin(parent, x, y, z, s = 1, c = 0xe8742a) {
  const g = grp(parent, x, y, z);
  const m = mat(c, { r: 0.55 });
  for (let i = 0; i < 8; i++) mk(new THREE.SphereGeometry(0.16 * s, 12, 10), m, g, [S(i / 8 * P * 2) * 0.09 * s, 0.13 * s, C(i / 8 * P * 2) * 0.09 * s], [0, 0, 0], [0.62, 0.85, 0.62]);
  mk(new THREE.CylinderGeometry(0.018 * s, 0.025 * s, 0.09 * s, 6), mat(0x4a6a2a, { r: 0.8 }), g, [0, 0.28 * s, 0], [0.2, 0, 0.15]);
  return g;
}
function garland(parent, x0, x1, y, z, sag = 0.3, rot = 0, n = 26, seed = 1) {
  const r = rng(seed);
  const g = grp(parent, 0, 0, 0); g.rotation.y = rot;
  const items = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, x = lerp(x0, x1, k), yy = y - S(k * P) * sag;
    items.push({ x, y: yy, z, rx: r() * 3, ry: r() * 3, rz: r() * 3, sx: 1, sy: 0.25, sz: 1, c: LEAF_COLS[Math.floor(r() * LEAF_COLS.length)] });
    items.push({ x: x + 0.06, y: yy - 0.05, z: z + 0.02, rx: r() * 3, ry: r() * 3, rz: r() * 3, sx: 0.8, sy: 0.25, sz: 0.8, c: LEAF_COLS[Math.floor(r() * LEAF_COLS.length)] });
  }
  instances(g, new THREE.SphereGeometry(0.1, 6, 4), mat(0xffffff, { r: 0.7 }), items, false);
  return g;
}
function bannerTex(text, bg = '#7a2a12', fg = '#ffe6a8') {
  return canvasTex(1024, 160, (ctx, w, h) => {
    const n = text.length; const fw = w / n;
    for (let i = 0; i < n; i++) {
      const x = i * fw;
      ctx.fillStyle = ['#c0441a', '#e08a22', '#8a2a10', '#d8a02a'][i % 4];
      ctx.beginPath(); ctx.moveTo(x + 4, 4); ctx.lineTo(x + fw - 4, 4); ctx.lineTo(x + fw / 2, h - 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = fg; ctx.font = `bold ${Math.round(fw * 0.62)}px Bangers, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text[i], x + fw / 2, h * 0.36);
    }
  });
}
function banner(parent, text, w, pos, rot = [0, 0, 0]) {
  const tex = bannerTex(text);
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
  return mk(new THREE.PlaneGeometry(w, w * 160 / 1024), m, parent, pos, rot, null, false);
}

// roast turkey / frozen turkey (about 0.45 m long), pies and dishes
export function buildTurkey(kind = 'roast') {
  const g = new THREE.Group();
  if (kind === 'frozen') {
    const net = canvasTex(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#f0e2cc'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(200,40,40,0.85)'; ctx.lineWidth = 3;
      for (let i = -w; i < w * 2; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, 0); ctx.stroke(); }
    }, { repeat: [2, 2] });
    const m = new THREE.MeshStandardMaterial({ map: net, roughness: 0.25, metalness: 0.05 });
    mk(new THREE.SphereGeometry(0.2, 24, 18), m, g, [0, 0.13, 0], [0, 0, 0], [1.15, 0.72, 0.92]);
    for (const s of [1, -1]) mk(new THREE.CapsuleGeometry(0.06, 0.12, 4, 10), m, g, [s * 0.1, 0.16, 0.17], [1.2, 0, s * 0.3]);
    mk(new RoundedBoxGeometry(0.16, 0.1, 0.004, 2, 0.01), new THREE.MeshBasicMaterial({ map: TX.signTex('TURKEY', '#ffd23a', '#7a1a10', 256, 160) }), g, [0, 0.2, 0.2], [-0.5, 0, 0], null, false);
  } else {
    const skin = new THREE.MeshStandardMaterial({ color: 0xc8762a, roughness: 0.35, metalness: 0.05, emissive: 0x3a1400, emissiveIntensity: 0.25 });
    mk(new THREE.SphereGeometry(0.2, 24, 18), skin, g, [0, 0.14, 0], [0, 0, 0], [1.15, 0.72, 0.92]);
    for (const s of [1, -1]) {
      mk(new THREE.CapsuleGeometry(0.06, 0.12, 4, 10), skin, g, [s * 0.12, 0.17, 0.16], [1.1, 0, s * 0.35]);
      mk(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 6), mat(0xf6efe0, { r: 0.6 }), g, [s * 0.16, 0.24, 0.27], [1.1, 0, s * 0.35]);
      mk(new THREE.SphereGeometry(0.05, 10, 8), skin, g, [s * 0.18, 0.12, -0.02], [0, 0, 0], [0.7, 0.5, 1.2]);
    }
    const plate = mk(new THREE.CylinderGeometry(0.34, 0.3, 0.03, 32), mat(0xf4f1ea, { r: 0.25 }), g, [0, 0.0, 0]);
    plate.name = 'plate';
    for (let i = 0; i < 8; i++) mk(new THREE.SphereGeometry(0.035, 8, 6), mat(i % 2 ? 0x5aa83a : 0xe85a2a, { r: 0.6 }), g, [C(i / 8 * P * 2) * 0.27, 0.03, S(i / 8 * P * 2) * 0.27]);
  }
  return g;
}
function pie(parent, x, y, z, c = 0xd88a2a) {
  const g = grp(parent, x, y, z);
  mk(new THREE.CylinderGeometry(0.15, 0.12, 0.05, 24), mat(0xe8c890, { r: 0.6 }), g, [0, 0.025, 0]);
  mk(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 24), mat(c, { r: 0.5 }), g, [0, 0.05, 0]);
  return g;
}
function dish(parent, x, y, z, c, kind = 'bowl') {
  const g = grp(parent, x, y, z);
  mk(new THREE.CylinderGeometry(0.14, 0.09, 0.08, 20), mat(0xf6f3ec, { r: 0.3 }), g, [0, 0.04, 0]);
  if (kind === 'mound') mk(new THREE.SphereGeometry(0.11, 14, 10), mat(c, { r: 0.7 }), g, [0, 0.07, 0], [0, 0, 0], [1, 0.6, 1]);
  else if (kind === 'corn') for (let i = 0; i < 3; i++) mk(new THREE.CapsuleGeometry(0.025, 0.12, 4, 8), mat(0xf2c83a, { r: 0.6 }), g, [-0.05 + i * 0.05, 0.09, 0], [0, 0, P / 2]);
  else mk(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 18), mat(c, { r: 0.5 }), g, [0, 0.075, 0]);
  return g;
}

// ------------------------------------------------------------------ Gus's Market (inside)
export function buildMarket() {
  const g = new THREE.Group();
  lights(g, { sunPos: [3, 14, 6], target: [0, 0, -2], shadowSize: 16, sunI: 1.1, hemi: 1.45, sky: 0xfff8ee, ground: 0x9a8a78, rim: false });
  for (const [x, z] of [[-4, 2], [4, 2], [0, -7]]) { const l = new THREE.PointLight(0xfff4e0, 14, 16, 1.2); l.position.set(x, 4.0, z); g.add(l); }
  plane(g, 18.4, 20.4, new THREE.MeshStandardMaterial({ map: TX.floorTex('#f2ece2', '#ddd3c2', 12), roughness: 0.3 }), [0, 0, -2]);
  const wallM = mat(0xf4ede0, { r: 0.85 }), greenM = mat(0x2f8a4a, { r: 0.6 });
  box(g, 18.4, 4.6, 0.3, 0, [0, 2.3, -12.15], { material: wallM, noShadow: true });
  for (const sd of [-1, 1]) box(g, 0.3, 4.6, 20.4, 0, [sd * 9.15, 2.3, -2], { material: wallM, noShadow: true });
  for (const sd of [-1, 1]) box(g, 7.6, 4.6, 0.3, 0, [sd * 5.3, 2.3, 8.15], { material: wallM, noShadow: true });
  box(g, 3.0, 1.6, 0.3, 0, [0, 3.8, 8.15], { material: wallM, noShadow: true });
  for (const z of [-12, 8]) box(g, 18.3, 0.35, 0.06, 0, [0, 1.1, z + (z < 0 ? 0.15 : -0.15)], { material: greenM });
  for (const sd of [-1, 1]) box(g, 0.06, 0.35, 20.3, 0, [sd * 8.98, 1.1, -2], { material: greenM });
  plane(g, 18.6, 20.6, mat(0xfbfaf6, { side: THREE.DoubleSide }), [0, 4.6, -2], [P / 2, 0, 0], false);
  const panelM = mat(0xffffff, { e: 0xfff6e8, ei: 1.3 });
  for (let z = -10; z <= 6; z += 4) for (const px of [-5.4, -1.8, 1.8, 5.4]) box(g, 1.6, 0.06, 0.5, 0, [px, 4.56, z], { material: panelM, noShadow: true });
  // windows + doors at the front, painted parking lot outside
  const outTex = canvasTex(512, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fd0ff'); gr.addColorStop(0.55, '#f8d8a8'); gr.addColorStop(0.56, '#6a6a70'); gr.addColorStop(1, '#4a4a50');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f2f2f2'; for (let x = 20; x < w; x += 60) c.fillRect(x, h * 0.7, 6, h * 0.3);
    for (let i = 0; i < 5; i++) { c.fillStyle = ['#d03a3a', '#3a6ad0', '#f2f2f2', '#3a3a3a', '#e8c23a'][i]; roundRect(c, 30 + i * 95, h * 0.6, 70, 34, 8); c.fill(); }
    c.fillStyle = '#c8501a'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(60 + i * 130, h * 0.42, 34, 0, P * 2); c.fill(); }
  });
  const outM = new THREE.MeshBasicMaterial({ map: outTex });
  for (const sd of [-1, 1]) plane(g, 6.2, 2.4, outM, [sd * 5.2, 1.7, 8.0], [0, P, 0], false);
  plane(g, 3.0, 3.0, outM, [0, 1.5, 8.35], [0, P, 0], false);
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.4, depthWrite: false, side: THREE.DoubleSide });
  const doors = [];
  for (const sd of [-1, 1]) { const d = grp(g, sd * 0.75, 0, 8.05); mk(new THREE.PlaneGeometry(1.45, 2.9), glass, d, [-sd * 0.0, 1.45, 0], [0, 0, 0], null, false); box(d, 0.06, 2.9, 0.06, 0x2a3a2a, [sd * 0.72, 1.45, 0]); doors.push({ d, sd }); }
  const openSign = sign(g, 'OPEN', 0.9, 0.4, [-0.75, 1.9, 7.98], '#1a8a3a', '#ffffff', [0, P, 0]);
  const closedSign = sign(g, 'CLOSED', 0.9, 0.4, [-0.75, 1.9, 7.98], '#c0202a', '#ffffff', [0, P, 0]);
  // store sign + Thanksgiving banner
  sign(g, "GUS'S MARKET", 5.0, 0.8, [0, 3.95, -11.98], '#2f8a4a', '#fff4d0');
  banner(g, 'HAPPY THANKSGIVING', 7.0, [0, 3.7, 4.0], [0, P, 0]);
  banner(g, 'HAPPY THANKSGIVING', 7.0, [0, 3.7, 4.02], [0, 0, 0]);
  garland(g, -9, 9, 4.3, -11.9, 0.35, 0, 40, 3);
  garland(g, -9, 9, 4.3, 7.9, 0.35, 0, 40, 5);
  // --- gondolas with products
  const metal = mat(0xd9dcd8, { r: 0.4, m: 0.3 }), shelfM = mat(0xf2f2ee, { r: 0.4 });
  const PAL = [0xd03a3a, 0x2f7ad0, 0xf2c23a, 0x3aa86a, 0xf27a2a, 0xf2f2f2, 0x8a4ad0, 0x6a3a1a];
  const gondolas = [];
  const R = rng(17);
  const GX = [-5.4, -1.8, 1.8, 5.4];
  for (const [gi, gx] of GX.entries()) {
    const gg = grp(g, gx, 0, -2.5);
    const len = 10;
    box(gg, 1.15, 0.14, len, 0, [0, 0.07, 0], { material: metal });
    box(gg, 0.07, 2.0, len, 0, [0, 1.05, 0], { material: metal });
    const boxes = [], cans = [];
    for (const sd of [-1, 1]) for (let lv = 0; lv < 4; lv++) {
      const y = 0.32 + lv * 0.46;
      box(gg, 0.5, 0.03, len, 0, [sd * 0.3, y - 0.02, 0], { material: shelfM, noShadow: true });
      box(gg, 0.02, 0.06, len, 0, [sd * 0.56, y + 0.0, 0], { material: mat(0x2f8a4a), noShadow: true });
      for (let z = -len / 2 + 0.2; z < len / 2 - 0.1;) {
        const kind = R();
        const c = PAL[Math.floor(R() * PAL.length)];
        if (kind < 0.55) { const w = 0.16 + R() * 0.12, h = 0.2 + R() * 0.16; for (let d = 0; d < 2; d++) boxes.push({ x: sd * (0.18 + d * 0.2), y: y + h / 2, z: z + w / 2, sx: 0.16, sy: h, sz: w, c }); z += w + 0.02; }
        else { const h = 0.12 + R() * 0.1; for (let d = 0; d < 2; d++) cans.push({ x: sd * (0.18 + d * 0.2), y: y + h / 2, z: z + 0.06, sx: 1, sy: h / 0.15, sz: 1, c }); z += 0.14; }
      }
    }
    instances(gg, new THREE.BoxGeometry(1, 1, 1), mat(0xffffff, { r: 0.55 }), boxes);
    instances(gg, new THREE.CylinderGeometry(0.055, 0.055, 0.15, 12), mat(0xffffff, { r: 0.35, m: 0.3 }), cans);
    gondolas.push(gg);
  }
  const aisleNames = ['BAKING + SPICES', 'CANNED FOOD', 'SNACKS + DRINKS'];
  for (let i = 0; i < 3; i++) { const x = (GX[i] + GX[i + 1]) / 2; sign(g, `AISLE ${i + 1}  ${aisleNames[i]}`, 2.4, 0.42, [x, 3.6, -2.5], '#2f8a4a', '#ffffff'); sign(g, `AISLE ${i + 1}  ${aisleNames[i]}`, 2.4, 0.42, [x, 3.6, -2.52], '#2f8a4a', '#ffffff', [0, P, 0]); }
  // --- the turkey freezer along the back wall
  const fz = grp(g, 0, 0, -10.9);
  box(fz, 9.0, 0.9, 1.4, 0, [0, 0.45, 0], { material: mat(0xf2f4f8, { r: 0.3, m: 0.2 }), round: 0.05 });
  box(fz, 8.8, 0.05, 1.2, 0, [0, 0.86, 0], { material: mat(0x9fd8ff, { e: 0x4ab8ff, ei: 0.25, r: 0.1 }), noShadow: true });
  mk(new THREE.PlaneGeometry(8.9, 0.45), glass, fz, [0, 1.12, 0.69], [0, 0, 0], null, false);
  for (const zz of [0.68, -0.68]) box(fz, 9.0, 0.08, 0.1, 0, [0, zz > 0 ? 1.36 : 1.0, zz], { material: mat(0xd8dce4, { m: 0.5, r: 0.3 }) });
  sign(fz, 'FRESH TURKEYS', 3.2, 0.7, [0, 2.4, -0.7], '#c0441a', '#fff4d0');
  const turkeyCut = canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) { c.fillStyle = ['#c0441a', '#e08a22', '#8a2a10', '#d8a02a'][i % 4]; c.beginPath(); c.ellipse(128, 150, 30, 110, (i - 3) * 0.32, 0, P * 2); c.fill(); }
    c.fillStyle = '#7a4a22'; c.beginPath(); c.ellipse(128, 170, 62, 58, 0, 0, P * 2); c.fill();
    c.beginPath(); c.arc(128, 100, 28, 0, P * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(120, 94, 8, 0, P * 2); c.arc(138, 94, 8, 0, P * 2); c.fill();
    c.fillStyle = '#000'; c.beginPath(); c.arc(121, 95, 4, 0, P * 2); c.arc(139, 95, 4, 0, P * 2); c.fill();
    c.fillStyle = '#f2b22a'; c.beginPath(); c.moveTo(124, 106); c.lineTo(140, 106); c.lineTo(132, 118); c.fill();
    c.fillStyle = '#d02a2a'; c.beginPath(); c.ellipse(140, 120, 5, 12, 0, 0, P * 2); c.fill();
  });
  const cutM = new THREE.MeshBasicMaterial({ map: turkeyCut, transparent: true, alphaTest: 0.1 });
  for (const sd of [-1, 1]) mk(new THREE.PlaneGeometry(1.4, 1.4), cutM, fz, [sd * 2.6, 2.4, -0.68], [0, 0, 0], null, false);
  const frozen = buildTurkey('frozen');
  const stock = [];
  for (let i = 0; i < 6; i++) { const t = frozen.clone(); t.position.set(-3.2 + i * 1.3, 0.88, 0); t.rotation.y = 0.3 * (i % 2 ? 1 : -1); fz.add(t); stock.push(t); }
  // --- checkout counters (front left) with registers; Gus works counter 1
  for (const [i, cx] of [-6.6, -3.6].entries()) {
    const ck = grp(g, cx, 0, 5.4);
    box(ck, 0.9, 0.95, 2.6, 0, [0, 0.475, 0], { material: mat(0x2f6a3a, { r: 0.5 }), round: 0.04 });
    box(ck, 0.7, 0.03, 2.0, 0, [0, 0.97, 0.15], { material: mat(0x1a1a1a, { r: 0.8 }) });
    box(ck, 0.4, 0.3, 0.35, 0, [0, 1.12, -1.0], { material: mat(0x2a2a30, { r: 0.4 }), round: 0.03 });
    box(ck, 0.32, 0.2, 0.03, 0, [0.0, 1.32, -0.86], { material: mat(0x0a1a12, { e: 0x3ad86a, ei: 0.6 }) });
    mk(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8), mat(0x9a9a9a, { m: 0.6 }), ck, [0.4, 1.9, -1.2]);
    sign(ck, `${i + 1}`, 0.4, 0.4, [0.4, 2.9, -1.2], '#2f8a4a', '#ffffff', [0, P / 2, 0]);
    const rack = grp(ck, -0.6, 0, 0.6);
    box(rack, 0.3, 1.2, 0.8, 0, [0, 0.6, 0], { material: metal });
    instances(rack, new THREE.BoxGeometry(0.06, 0.1, 0.02), mat(0xffffff, { r: 0.5 }), Array.from({ length: 24 }, (_, k) => ({ x: -0.16, y: 0.3 + (k % 4) * 0.25, z: -0.3 + Math.floor(k / 4) * 0.12, c: PAL[k % PAL.length] })), false);
  }
  // --- produce + seasonal display (front right): pumpkins, apples, corn, cranberries
  const prod = grp(g, 5.0, 0, 5.2);
  for (const [k, [x, z, c]] of [[-1.4, -0.6, 0xe8742a], [0, -0.6, 0xd02a2a], [1.4, -0.6, 0xf2c23a], [-1.4, 0.9, 0x8a1a2a], [0, 0.9, 0x9a7a4a], [1.4, 0.9, 0x5aa83a]].entries()) {
    box(prod, 1.25, 0.7, 1.25, 0, [x, 0.35, z], { material: mat(0x8a5a32, { r: 0.8 }), round: 0.03 });
    const items = [];
    const rr = rng(40 + k);
    for (let i = 0; i < 26; i++) items.push({ x: x + (rr() - 0.5) * 1.0, y: 0.75 + rr() * 0.12, z: z + (rr() - 0.5) * 1.0, sx: 1, sy: k === 2 ? 2.2 : 1, sz: 1, rz: k === 2 ? P / 2 : 0, ry: rr() * 3, c });
    if (k === 0) for (let i = 0; i < 5; i++) pumpkin(prod, x - 0.4 + (i % 3) * 0.4, 0.7, z - 0.3 + Math.floor(i / 3) * 0.55, 1.2);
    else instances(prod, new THREE.SphereGeometry(k === 3 ? 0.04 : 0.075, 10, 8), mat(0xffffff, { r: 0.45 }), items);
  }
  sign(prod, 'FALL HARVEST', 2.4, 0.5, [0, 2.2, -1.3], '#c0441a', '#fff4d0');
  for (const [x, z] of [[-2.4, 7.4], [2.4, 7.4]]) { box(g, 1.1, 0.5, 0.6, 0, [x, 0.25, z], { material: mat(0xd8b860, { r: 0.95 }) }); pumpkin(g, x, 0.5, z, 1.5); }
  // --- wall clocks (front wall facing in, back wall above the freezer)
  const clocks = [];
  const faceTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(128, 128, 124, 0, P * 2); c.fill();
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 10; c.stroke();
    c.fillStyle = '#1a1a1a'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) c.fillText(String(i), 128 + S(i / 12 * P * 2) * 95, 128 - C(i / 12 * P * 2) * 95);
  });
  for (const [pos, ry] of [[[3.2, 3.2, 7.98], P], [[5.2, 3.0, -11.98], 0]]) {
    const ck = grp(g, ...pos); ck.rotation.y = ry;
    mk(new THREE.CircleGeometry(0.45, 32), new THREE.MeshBasicMaterial({ map: faceTex }), ck, [0, 0, 0.01], [0, 0, 0], null, false);
    mk(new THREE.TorusGeometry(0.46, 0.04, 8, 32), mat(0x2f8a4a, { r: 0.4 }), ck, [0, 0, 0.01]);
    const hh = grp(ck, 0, 0, 0.03), mh = grp(ck, 0, 0, 0.035);
    mk(new THREE.BoxGeometry(0.035, 0.24, 0.01), mat(0x111111), hh, [0, 0.1, 0], [0, 0, 0], null, false);
    mk(new THREE.BoxGeometry(0.025, 0.36, 0.01), mat(0xc0202a), mh, [0, 0.16, 0], [0, 0, 0], null, false);
    clocks.push({ hh, mh });
  }
  // --- things that happen: the can pyramid, the spill, carts, a tipping shelf
  const canM = mat(0xc8402a, { r: 0.35, m: 0.4 });
  const cans = [];
  const CR = rng(77);
  const capX = -1.8, capZ = 3.25;
  box(g, 1.3, 0.2, 0.9, 0, [capX, 0.1, capZ], { material: mat(0x2f8a4a) });
  let ci = 0;
  for (let row = 0; row < 5; row++) for (let i = 0; i < 5 - row; i++) {
    const m = mk(new THREE.CylinderGeometry(0.07, 0.07, 0.17, 14), canM, g, [0, 0, 0]);
    const x0 = capX - (4 - row) * 0.075 + i * 0.15, y0 = 0.29 + row * 0.175;
    const ang = (CR() - 0.5) * 2.6, dist = 0.8 + CR() * 2.4;
    cans.push({ m, x0, y0, z0: capZ, x1: x0 + S(ang) * dist, z1: capZ + C(ang) * dist * 0.8 + 0.4, h: 0.4 + CR() * 0.8, sp: (CR() - 0.5) * 12, d: row * 0.05 + CR() * 0.08 });
    ci++;
  }
  const spill = mk(new THREE.CircleGeometry(1, 32), new THREE.MeshStandardMaterial({ color: 0x9a0a2a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.92 }), g, [0, 0.012, 0], [-P / 2, 0, 0], null, false);
  const jar = mk(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 14), mat(0x9a0a2a, { r: 0.2 }), g, [0, 0.07, 0], [0, 0, P / 2]);
  sign(g, 'CRANBERRY SAUCE', 1.2, 0.3, [-1.8, 1.35, 3.72], '#9a0a2a', '#ffffff');
  const carts = [];
  for (let i = 0; i < 3; i++) carts.push(buildCart(g, [0xd03a3a, 0x2f7ad0, 0xf2c23a][i]));
  return {
    name: 'market', group: g, bg: new THREE.Color(0xfbfaf6), exposure: 1.0,
    update(t, X) {
      const v = (n, d = 0) => X.val(n, d);
      const closed = v('mkt.closed', 0) > 0.5;
      openSign.visible = !closed; closedSign.visible = closed;
      const dk = v('mkt.door', 0);
      for (const d of doors) d.d.position.x = d.sd * (0.75 + 1.3 * dk);
      const nStock = Math.round(v('mkt.stock', 1));
      stock.forEach((s, i) => { s.visible = i < nStock; });
      const mins = v('mkt.clock', 40); // minutes after 2:00 PM
      const hrs = 2 + mins / 60;
      for (const c of clocks) { c.mh.rotation.z = -(mins % 60) / 60 * P * 2; c.hh.rotation.z = -(hrs % 12) / 12 * P * 2; }
      const cf = v('mkt.cans', 0);
      for (const c of cans) {
        const k = clamp((cf * 1.4 - c.d) / 1.0);
        const e = 1 - Math.pow(1 - k, 2);
        c.m.position.set(lerp(c.x0, c.x1, e), lerp(c.y0, 0.07, k * k) + S(k * P) * c.h * (1 - k * 0.3), lerp(c.z0, c.z1, e));
        c.m.rotation.set(k * c.sp * 0.3, 0, k > 0.98 ? P / 2 : k * c.sp);
      }
      const sp = v('mkt.spill', 0);
      spill.visible = sp > 0.01; spill.scale.set(sp * 1.3, sp * 0.9, 1); spill.position.set(v('spill.x', -0.2), 0.012, v('spill.z', 1.5));
      jar.visible = sp > 0.01; jar.position.set(v('spill.x', -0.2) + 0.5, 0.07, v('spill.z', 1.5) - 0.3);
      gondolas[2].rotation.z = v('mkt.tip', 0);
      gondolas[2].position.y = Math.sin(Math.abs(v('mkt.tip', 0))) * 0.0;
      carts.forEach((c, i) => {
        const vis = v(`cart${i + 1}.vis`, 0) > 0.5;
        c.visible = vis; if (!vis) return;
        c.position.set(v(`cart${i + 1}.x`), 0, v(`cart${i + 1}.z`)); c.rotation.set(0, v(`cart${i + 1}.ry`), v(`cart${i + 1}.tip`, 0));
      });
    },
  };
}
function buildCart(parent, color) {
  const g = grp(parent);
  const wire = mat(0xc8ccd2, { r: 0.3, m: 0.7 });
  const basket = new THREE.Group(); g.add(basket);
  const geo = new THREE.BoxGeometry(0.55, 0.42, 0.85, 4, 3, 6);
  const wm = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, wireframe: true, metalness: 0.7, roughness: 0.3 });
  mk(geo, wm, basket, [0, 0.82, 0], [0, 0, 0], null, false);
  box(basket, 0.55, 0.02, 0.85, 0, [0, 0.61, 0], { material: wire });
  box(basket, 0.6, 0.05, 0.05, 0, [0, 1.1, -0.48], { material: mat(color, { r: 0.4 }) });
  for (const [x, z] of [[-0.22, 0.32], [0.22, 0.32], [-0.22, -0.32], [0.22, -0.32]]) { mk(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), wire, g, [x, 0.33, z]); mk(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), mat(0x1a1a1a), g, [x, 0.05, z], [0, 0, P / 2]); }
  const items = [];
  const r = rng(color % 97);
  for (let i = 0; i < 6; i++) items.push({ x: (r() - 0.5) * 0.35, y: 0.72 + r() * 0.15, z: (r() - 0.5) * 0.6, sx: 0.14, sy: 0.18, sz: 0.12, ry: r() * 3, c: [0xd03a3a, 0x3aa86a, 0xf2c23a, 0xf2f2f2, 0x8a4ad0][i % 5] });
  instances(g, new THREE.BoxGeometry(1, 1, 1), mat(0xffffff, { r: 0.5 }), items);
  g.visible = false;
  return g;
}

// ------------------------------------------------------------------ Gus's Market (outside): street, parking, store front
export function buildMarketExt() {
  const g = new THREE.Group();
  lights(g, { sunPos: [-10, 16, 10], target: [0, 0, -4], shadowSize: 22, sunI: 2.2, sun: 0xffe2b8, hemi: 1.1, sky: 0xbfe0ff, ground: 0x8a7a68, rimPos: [8, 6, -10], rimColor: 0xffc890 });
  plane(g, 80, 80, mat(0x5a5a60, { r: 0.92 }), [0, 0, 0]);
  plane(g, 80, 9, new THREE.MeshStandardMaterial({ map: TX.floorTex('#b8b4ac', '#aaa69e', 20), roughness: 0.85 }), [0, 0.02, -6.5]);
  for (let x = -36; x <= 36; x += 3) box(g, 0.12, 0.012, 2.0, 0, [x, 0.02, 6], { material: mat(0xf2f2f2, { r: 0.6 }), noShadow: true });
  for (let x = -30; x <= 30; x += 6) box(g, 2.2, 0.012, 0.12, 0, [x, 0.02, 14], { material: mat(0xf2d84a, { r: 0.6 }), noShadow: true });
  // the store
  const st = grp(g, 0, 0, -11);
  box(st, 20, 6, 8, 0, [0, 3, -4], { material: mat(0xf2e6d2, { r: 0.85 }) });
  box(st, 20.4, 0.6, 8.4, 0, [0, 6.3, -4], { material: mat(0x2f8a4a, { r: 0.6 }) });
  box(st, 20.2, 0.45, 1.6, 0, [0, 3.4, 0.6], { material: mat(0x2f8a4a, { r: 0.6 }) });
  for (let i = 0; i < 10; i++) box(st, 2.0, 0.42, 0.02, 0, [-9 + i * 2.0, 3.12, 1.41], { material: mat(i % 2 ? 0xf2f2f2 : 0x2f8a4a, { r: 0.7 }), noShadow: true });
  const bigSign = sign(st, "GUS'S MARKET", 9.0, 1.6, [0, 5.0, 0.03], '#2f8a4a', '#fff4d0');
  const win = new THREE.MeshStandardMaterial({ color: 0xbfe0f0, roughness: 0.05, metalness: 0.6, emissive: 0x4a5a5a, emissiveIntensity: 0.4 });
  for (const sd of [-1, 1]) box(st, 6.6, 2.6, 0.06, 0, [sd * 5.6, 1.6, 0.02], { material: win, noShadow: true });
  const doorM = new THREE.MeshStandardMaterial({ color: 0xbfe0f0, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.8 });
  const dL = grp(st, -0.75, 0, 0.05), dR = grp(st, 0.75, 0, 0.05);
  box(dL, 1.45, 2.9, 0.05, 0, [0, 1.45, 0], { material: doorM, noShadow: true }); box(dR, 1.45, 2.9, 0.05, 0, [0, 1.45, 0], { material: doorM, noShadow: true });
  const openS = sign(st, 'OPEN', 0.9, 0.42, [-0.75, 1.9, 0.1], '#1a8a3a', '#ffffff'), closedS = sign(st, 'CLOSED', 0.9, 0.42, [-0.75, 1.9, 0.1], '#c0202a', '#ffffff');
  sign(st, 'HOURS TODAY: 8 AM - 3 PM  (THANKSGIVING)', 3.2, 0.4, [5.6, 3.05, 0.06], '#fff4d0', '#7a2a12');
  banner(st, 'HAPPY THANKSGIVING', 8.0, [0, 4.1, 1.45]);
  for (const x of [-9.3, -2.4, 2.4, 9.3]) { box(g, 1.1, 0.5, 0.6, 0, [x, 0.25, -9.2], { material: mat(0xd8b860, { r: 0.95 }) }); pumpkin(g, x, 0.5, -9.2, 1.6); pumpkin(g, x + 0.6, 0, -8.7, 1.2, 0xe89a2a); }
  // parked cars + autumn trees + neighbors
  for (const [x, z, c] of [[-14, 4, 0xd03a3a], [-8, 4, 0x3a6ad0], [9, 4, 0xf2f2f2], [15, 4, 0x2a2a2a]]) {
    const car = grp(g, x, 0, z);
    box(car, 1.9, 0.75, 4.2, 0, [0, 0.62, 0], { material: mat(c, { r: 0.25, m: 0.4 }), round: 0.2 });
    box(car, 1.7, 0.6, 2.2, 0, [0, 1.25, -0.2], { material: mat(0x9ab8d0, { r: 0.1, m: 0.6 }), round: 0.18 });
    for (const [wx, wz] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) mk(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 16), mat(0x151515, { r: 0.8 }), car, [wx, 0.36, wz], [0, 0, P / 2]);
  }
  const R = rng(5);
  for (const [x, z] of [[-24, -7], [-17, -2.5], [17, -2.5], [24, -7], [-30, 10], [30, 10]]) {
    mk(new THREE.CylinderGeometry(0.18, 0.26, 2.6, 8), mat(0x5a3a22, { r: 0.9 }), g, [x, 1.3, z]);
    for (let i = 0; i < 6; i++) mk(new THREE.IcosahedronGeometry(0.9 + R() * 0.6, 1), mat(LEAF_COLS[Math.floor(R() * 5)], { r: 0.85 }), g, [x + (R() - 0.5) * 1.6, 3.2 + R() * 1.4, z + (R() - 0.5) * 1.6]);
  }
  for (const [x, w, h, c] of [[-26, 10, 9, 0xb07a5a], [26, 10, 12, 0x8a9ab0], [-38, 10, 16, 0x9a8a7a], [38, 10, 10, 0xc0a080]]) building(g, x, -18, w, 8, h, c, Math.abs(x), false, 1);
  for (let i = 0; i < 6; i++) streetLamp(g, -25 + i * 10, -2.2, 1);
  const leaves = [];
  for (let i = 0; i < 40; i++) leaves.push({ x: (R() - 0.5) * 40, y: 0.03, z: -6 + (R() - 0.5) * 20, ry: R() * 3, sx: 1, sy: 0.15, sz: 0.6, c: LEAF_COLS[Math.floor(R() * 5)] });
  instances(g, new THREE.SphereGeometry(0.12, 6, 4), mat(0xffffff, { r: 0.8 }), leaves, false);
  return {
    name: 'marketExt', group: g, bg: new THREE.Color(0xa8d4ff), fog: [0xd8e8f8, 40, 120], exposure: 1.0,
    update(t, X) {
      const closed = X.val('mkt.closed', 0) > 0.5;
      openS.visible = !closed; closedS.visible = closed;
      const dk = X.val('mkt.door', 0);
      dL.position.x = -0.75 - 1.3 * dk; dR.position.x = 0.75 + 1.3 * dk;
      const sk = X.val('sky.sunset', 0);
      this.bg.setRGB(lerp(0.66, 0.98, sk), lerp(0.83, 0.62, sk), lerp(1.0, 0.45, sk));
    },
  };
}

// ------------------------------------------------------------------ the parade avenue (downtown, Thanksgiving parade)
export function buildAvenue() {
  const g = new THREE.Group();
  lights(g, { sunPos: [12, 20, 8], target: [0, 0, -10], shadowSize: 26, sunI: 2.3, sun: 0xfff0d8, hemi: 1.15, sky: 0xc8e4ff, ground: 0x7a7266 });
  plane(g, 14, 200, mat(0x4a4a52, { r: 0.9 }), [0, 0.0, -30]);
  for (let z = -120; z < 60; z += 6) box(g, 0.18, 0.012, 2.6, 0, [0, 0.02, z], { material: mat(0xf2d84a, { r: 0.6 }), noShadow: true });
  for (const sd of [-1, 1]) {
    plane(g, 6, 200, new THREE.MeshStandardMaterial({ map: TX.floorTex('#c8c4bc', '#b8b4ac', 60), roughness: 0.85 }), [sd * 10, 0.08, -30]);
    box(g, 0.3, 0.16, 200, 0, [sd * 7.05, 0.08, -30], { material: mat(0xb0aca4) });
  }
  const R = rng(9);
  const cols = [0xb07a5a, 0x8a9ab0, 0xc0a080, 0x9a8a9a, 0xd8c8a8, 0x7a8aa0];
  for (const sd of [-1, 1]) for (let z = -110, i = 0; z < 50; i++) {
    const w = 8 + R() * 6, h = 12 + R() * 22;
    building(g, sd * (13 + 5), z + w / 2, 10, w, h, cols[Math.floor(R() * cols.length)], i * 13 + (sd > 0 ? 3 : 0), false, -sd);
    z += w + 0.5;
  }
  // barricades + flags + lamp posts
  const barM = mat(0x2f6ad0, { r: 0.5 }), whiteM = mat(0xf2f2f2, { r: 0.5 });
  for (const sd of [-1, 1]) for (let z = -80; z < 30; z += 2.6) {
    if (Math.abs(z + 2) < 2.4 && sd < 0) continue; // a gap where the team crosses
    box(g, 0.06, 0.95, 2.3, 0, [sd * 7.5, 0.6, z], { material: barM, noShadow: true });
    box(g, 0.07, 0.15, 2.3, 0, [sd * 7.5, 0.95, z], { material: whiteM, noShadow: true });
    for (const dz of [-1, 1]) mk(new THREE.BoxGeometry(0.5, 0.05, 0.05), barM, g, [sd * 7.5, 0.1, z + dz * 1.0]);
  }
  for (const sd of [-1, 1]) for (let z = -90; z < 40; z += 12) { streetLamp(g, sd * 8.2, z, -sd); mk(new THREE.PlaneGeometry(0.9, 1.4), new THREE.MeshStandardMaterial({ color: [0xe8742a, 0xc0441a, 0xf2c23a][Math.abs(z) % 3], side: THREE.DoubleSide, roughness: 0.8 }), g, [sd * 8.2 - sd * 0.5, 3.2, z], [0, P / 2, 0], null, false); }
  banner(g, 'AETHERFALL THANKSGIVING PARADE', 12, [0, 7.5, -24]);
  banner(g, 'AETHERFALL THANKSGIVING PARADE', 12, [0, 7.5, -24.02], [0, P, 0]);
  for (const sd of [-1, 1]) mk(new THREE.CylinderGeometry(0.08, 0.08, 8, 8), mat(0x6a6a70, { m: 0.5 }), g, [sd * 6.2, 4, -24]);
  // the crowd behind the barricades (simple people that bob and wave)
  const crowd = [];
  const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.55, 4, 8), headGeo = new THREE.SphereGeometry(0.15, 10, 8);
  const bodies = new THREE.InstancedMesh(bodyGeo, mat(0xffffff, { r: 0.7 }), 180), heads = new THREE.InstancedMesh(headGeo, mat(0xffffff, { r: 0.55 }), 180);
  const SK = [0xf0c8a0, 0xd9a07a, 0xa8734f, 0x6a4028, 0xe8b890], SH = [0xd03a3a, 0x2f7ad0, 0xf2c23a, 0x3aa86a, 0xf27a2a, 0x8a4ad0, 0xf2f2f2, 0x2a2a30];
  const cc = new THREE.Color();
  let n = 0;
  for (const sd of [-1, 1]) for (let z = -78; z < 28 && n < 180; z += 0.75) for (let row = 0; row < 2 && n < 180; row++) {
    if (sd < 0 && Math.abs(z + 2) < 2.6) continue;
    crowd.push({ x: sd * (8.1 + row * 0.75 + R() * 0.25), z: z + R() * 0.4, ph: R() * 6, h: 0.85 + R() * 0.25, wave: R() > 0.7 });
    bodies.setColorAt(n, cc.set(SH[Math.floor(R() * SH.length)])); heads.setColorAt(n, cc.set(SK[Math.floor(R() * SK.length)]));
    n++;
  }
  bodies.count = heads.count = n;
  g.add(bodies); g.add(heads);
  // floats: a giant pumpkin float and a "pilgrim ship" float that roll slowly down the avenue
  const floats = [];
  const fl1 = grp(g);
  box(fl1, 4.2, 0.9, 7.0, 0, [0, 0.75, 0], { material: mat(0x7a3a12, { r: 0.7 }), round: 0.1 });
  box(fl1, 4.4, 0.25, 7.2, 0, [0, 0.25, 0], { material: mat(0x3a8a3a, { r: 0.9 }) });
  pumpkin(fl1, 0, 1.2, 0.4, 7.5);
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) pumpkin(fl1, sd * 1.6, 1.2, -2.6 + i * 2.6, 1.8, 0xe89a2a);
  floats.push(fl1);
  const fl2 = grp(g);
  box(fl2, 4.0, 0.8, 7.5, 0, [0, 0.7, 0], { material: mat(0x2f6ad0, { r: 0.6 }), round: 0.1 });
  mk(new THREE.CylinderGeometry(2.0, 1.6, 1.4, 16, 1, false, 0, P), mat(0x8a5a32, { r: 0.7 }), fl2, [0, 1.8, 0], [P / 2, P / 2, 0], [1, 1, 1.6]);
  mk(new THREE.CylinderGeometry(0.1, 0.1, 4.5, 8), mat(0x6a4a2a), fl2, [0, 3.8, 0]);
  mk(new THREE.PlaneGeometry(2.4, 2.0), new THREE.MeshStandardMaterial({ color: 0xf6efe0, side: THREE.DoubleSide, roughness: 0.9 }), fl2, [0, 4.2, 0.1], [0, P / 2, 0], null, false);
  floats.push(fl2);
  // the giant turkey balloon, held down by ropes
  const bal = grp(g);
  const bm = mat(0x8a4a22, { r: 0.35 }), fanCols = [0xc0441a, 0xe08a22, 0xf2c23a, 0x8a2a10, 0xd8a02a];
  const balBody = grp(bal, 0, 0, 0);
  mk(new THREE.SphereGeometry(2.2, 28, 20), bm, balBody, [0, 0, 0], [0, 0, 0], [1, 0.9, 1.1]);
  for (let i = 0; i < 9; i++) { const a = -1.2 + i * 0.3; mk(new THREE.SphereGeometry(1.0, 14, 10), mat(fanCols[i % 5], { r: 0.4 }), balBody, [S(a) * 2.4, 1.2 + C(a) * 1.9, -1.6], [0, 0, -a], [0.55, 1.8, 0.2]); }
  mk(new THREE.SphereGeometry(0.9, 18, 14), bm, balBody, [0, 1.6, 2.0]);
  for (const s of [1, -1]) { mk(new THREE.SphereGeometry(0.28, 12, 10), mat(0xffffff, { r: 0.2 }), balBody, [s * 0.38, 1.8, 2.75]); mk(new THREE.SphereGeometry(0.13, 10, 8), mat(0x111111, { r: 0.2 }), balBody, [s * 0.4, 1.82, 3.0]); }
  mk(new THREE.ConeGeometry(0.25, 0.6, 10), mat(0xf2b22a, { r: 0.4 }), balBody, [0, 1.45, 2.95], [P / 2, 0, 0]);
  mk(new THREE.SphereGeometry(0.2, 10, 8), mat(0xd02a2a, { r: 0.4 }), balBody, [0.25, 1.05, 2.8], [0, 0, 0], [0.7, 1.6, 0.7]);
  for (const s of [1, -1]) mk(new THREE.SphereGeometry(0.9, 14, 10), bm, balBody, [s * 2.0, -0.2, 0.2], [0, 0, s * 0.4], [0.4, 1.0, 1.1]);
  const ropes = [];
  const ropeM = new THREE.LineBasicMaterial({ color: 0xf2f2f2 });
  for (let i = 0; i < 4; i++) { const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const l = new THREE.Line(geo, ropeM); g.add(l); ropes.push(l); }
  const ropeAnch = [[-1.4, 1.2], [1.4, 1.2], [-1.4, -1.2], [1.4, -1.2]];
  // falling leaves
  const leafItems = []; for (let i = 0; i < 70; i++) leafItems.push({ x: 0, y: 0, z: 0, c: LEAF_COLS[i % 5] });
  const leafIM = instances(g, new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 }), leafItems, false);
  const leafSeeds = leafItems.map((_, i) => ({ x: (hash(i * 3.1) - 0.5) * 24, z: -60 + hash(i * 7.7) * 90, sp: 0.4 + hash(i * 1.3) * 0.5, ph: hash(i * 9.1) * 10 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  return {
    name: 'avenue', group: g, bg: new THREE.Color(0xa8d4ff), fog: [0xd8e8f8, 50, 160], exposure: 1.0,
    update(t, X) {
      const v = (nn, d = 0) => X.val(nn, d);
      const cheer = v('crowd.cheer', 0);
      crowd.forEach((c, i) => {
        const b = Math.abs(S(t * (3 + cheer * 5) + c.ph)) * (0.03 + cheer * 0.12);
        e.set(0, 0, 0.05 * S(t * 1.3 + c.ph)); q.setFromEuler(e); sc.set(1, c.h, 1);
        ps.set(c.x, 0.08 + 0.48 * c.h + b, c.z); m4.compose(ps, q, sc); bodies.setMatrixAt(i, m4);
        sc.set(1, 1, 1); ps.set(c.x, 0.08 + c.h * 1.02 + 0.12 + b, c.z); m4.compose(ps, q, sc); heads.setMatrixAt(i, m4);
      });
      bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
      floats.forEach((f, i) => { f.position.set(0, 0, v(`float${i + 1}.z`, -60 - i * 14)); });
      const bx = v('balloon.x', 0), by = v('balloon.y', 7), bz = v('balloon.z', -20), loose = v('balloon.loose', 0);
      bal.position.set(bx, by + 0.25 * S(t * 0.9), bz);
      bal.rotation.set(0.06 * S(t * 0.7) + v('balloon.rx', 0), v('balloon.ry', 0) + 0.05 * S(t * 0.5), 0.06 * S(t * 0.8) + v('balloon.rz', 0));
      bal.visible = v('balloon.vis', 1) > 0.5;
      ropes.forEach((l, i) => {
        const a = l.geometry.attributes.position;
        const [ax, az] = ropeAnch[i];
        const top = new THREE.Vector3(ax * 0.9, -1.6, az * 0.9).applyEuler(bal.rotation).add(bal.position);
        const gy = loose > 0.5 ? top.y - 4 - 1.5 * S(t * 3 + i) : 0.9;
        a.setXYZ(0, top.x, top.y, top.z);
        a.setXYZ(1, loose > 0.5 ? top.x + S(t * 2 + i) * 0.8 : bx + ax * 1.6, gy, loose > 0.5 ? top.z + C(t * 2 + i) * 0.8 : bz + az * 1.6);
        a.needsUpdate = true; l.visible = bal.visible;
      });
      leafSeeds.forEach((s, i) => {
        const yy = 12 - ((t * s.sp + s.ph * 3) % 12);
        e.set(t * 2 + s.ph, t * 1.3 + s.ph, 0); q.setFromEuler(e); sc.set(1, 1, 1);
        ps.set(s.x + S(t * 0.8 + s.ph) * 1.2, yy, s.z + C(t * 0.6 + s.ph)); m4.compose(ps, q, sc); leafIM.setMatrixAt(i, m4);
      });
      leafIM.instanceMatrix.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------ HQ dining room + kitchen (Thanksgiving dinner)
export function buildDining() {
  const g = new THREE.Group();
  lights(g, { sunPos: [8, 9, 6], target: [0, 0, 0], shadowSize: 12, sunI: 1.3, sun: 0xffc890, hemi: 1.05, sky: 0xffe6c8, ground: 0x6a4a3a, rimPos: [-6, 4, -6], rimColor: 0xffb070, rimI: 0.6 });
  const warm = []; for (const [x, z, i] of [[0, 1.0, 9], [-3, -3.5, 7], [3.5, -3.5, 7]]) { const l = new THREE.PointLight(0xffd0a0, i, 9, 1.4); l.position.set(x, 2.9, z); g.add(l); warm.push(l); }
  plane(g, 14, 11, new THREE.MeshStandardMaterial({ map: TX.floorTex('#9a6a42', '#8a5c38', 10), roughness: 0.55 }), [0, 0, -0.5]);
  const wallM = mat(0xf2e2c8, { r: 0.85 }), woodM = mat(0x7a4e2c, { r: 0.6 });
  box(g, 14, 3.4, 0.2, 0, [0, 1.7, -6.0], { material: wallM, noShadow: true });
  box(g, 0.2, 3.4, 11, 0, [-7.0, 1.7, -0.5], { material: wallM, noShadow: true });
  box(g, 0.2, 3.4, 11, 0, [7.0, 1.7, -0.5], { material: wallM, noShadow: true });
  box(g, 14, 3.4, 0.2, 0, [0, 1.7, 5.0], { material: wallM, noShadow: true });
  box(g, 14, 0.1, 11, 0, [0, 3.42, -0.5], { material: mat(0xfbf2e2), noShadow: true });
  for (const z of [-5.88, 4.88]) box(g, 13.9, 0.14, 0.05, 0, [0, 0.07, z], { material: woodM, noShadow: true });
  // big window on the right wall: sunset over Aetherfall
  const sunsetTex = canvasTex(512, 320, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a4a9a'); gr.addColorStop(0.45, '#e8724a'); gr.addColorStop(0.75, '#ffc86a'); gr.addColorStop(1, '#ffe0a0');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let x = 0; x < w;) { const bw = 20 + r() * 40, bh = 60 + r() * 150; c.fillStyle = '#2a2a4a'; c.fillRect(x, h - bh, bw, bh); c.fillStyle = 'rgba(255,220,140,0.9)'; for (let wy = h - bh + 8; wy < h - 6; wy += 12) for (let wx = x + 4; wx < x + bw - 4; wx += 9) if (r() > 0.55) c.fillRect(wx, wy, 4, 6); x += bw + 2; }
  });
  plane(g, 4.6, 2.2, new THREE.MeshBasicMaterial({ map: sunsetTex }), [6.88, 1.75, 0.6], [0, -P / 2, 0], false);
  box(g, 0.12, 2.4, 4.8, 0, [6.9, 1.75, 0.6], { material: mat(0xf8f2e8), noShadow: true });
  for (const z of [-0.95, 0.6, 2.15]) box(g, 0.14, 2.3, 0.08, 0, [6.85, 1.75, z], { material: mat(0xf8f2e8), noShadow: true });
  // fireplace on the left wall
  const fp = grp(g, -6.85, 0, 0.4);
  box(fp, 0.5, 1.4, 2.2, 0, [0, 0.7, 0], { material: mat(0x9a5a3a, { r: 0.9 }) });
  box(fp, 0.55, 0.12, 2.5, 0, [0.05, 1.42, 0], { material: woodM });
  box(fp, 0.3, 0.8, 1.2, 0, [0.12, 0.45, 0], { material: mat(0x1a0a06, { r: 1 }) });
  const fire = []; for (let i = 0; i < 5; i++) fire.push(mk(new THREE.ConeGeometry(0.12, 0.45, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffa030 : 0xff6a1a, transparent: true, opacity: 0.9 }), fp, [0.2, 0.3, -0.35 + i * 0.18], [0, 0, 0], null, false));
  const fireL = new THREE.PointLight(0xff8a3a, 4, 5, 1.5); fireL.position.set(0.8, 0.6, 0); fp.add(fireL);
  for (let i = 0; i < 3; i++) pumpkin(fp, 0.05, 1.48, -0.7 + i * 0.7, 0.9);
  // kitchen along the back wall: counters, upper cabinets, oven, fridge, island
  const cab = mat(0xf6f2ea, { r: 0.5 }), top = mat(0x2a2a30, { r: 0.25, m: 0.2 });
  box(g, 9.0, 0.92, 0.7, 0, [-1.0, 0.46, -5.5], { material: cab, round: 0.02 });
  box(g, 9.1, 0.05, 0.75, 0, [-1.0, 0.945, -5.48], { material: top });
  box(g, 9.0, 0.8, 0.4, 0, [-1.0, 2.5, -5.7], { material: cab, round: 0.02 });
  for (let i = 0; i < 9; i++) box(g, 0.02, 0.7, 0.01, 0, [-5.5 + i * 1.0, 0.46, -5.14], { material: mat(0xc8c0b0), noShadow: true });
  const oven = grp(g, 1.6, 0, -5.4);
  box(oven, 0.95, 0.9, 0.7, 0, [0, 0.45, 0], { material: mat(0x2a2a30, { r: 0.3, m: 0.6 }) });
  const ovenWin = box(oven, 0.6, 0.35, 0.02, 0, [0, 0.42, 0.36], { material: new THREE.MeshStandardMaterial({ color: 0x1a0a06, emissive: 0xff7a2a, emissiveIntensity: 0 }) });
  const ovenDoor = grp(oven, 0, 0.05, 0.36);
  box(ovenDoor, 0.92, 0.78, 0.05, 0, [0, 0.4, 0], { material: mat(0x3a3a40, { r: 0.3, m: 0.6 }) });
  box(ovenDoor, 0.6, 0.35, 0.02, 0, [0, 0.42, 0.03], { material: mat(0x0a0a0c, { r: 0.1 }) });
  box(ovenDoor, 0.6, 0.04, 0.05, 0, [0, 0.72, 0.06], { material: mat(0xc8c8c8, { m: 0.8 }) });
  const ovenL = new THREE.PointLight(0xff8a3a, 0, 3, 1.6); ovenL.position.set(0, 0.5, 0.8); oven.add(ovenL);
  box(g, 1.0, 2.1, 0.8, 0, [4.6, 1.05, -5.45], { material: mat(0xd8dce2, { r: 0.25, m: 0.5 }), round: 0.04 });
  box(g, 0.04, 0.6, 0.04, 0, [4.2, 1.4, -5.03], { material: mat(0x9a9aa2, { m: 0.8 }) });
  const island = grp(g, -1.2, 0, -2.9);
  box(island, 2.6, 0.92, 1.1, 0, [0, 0.46, 0], { material: mat(0x5a7a8a, { r: 0.5 }), round: 0.02 });
  box(island, 2.75, 0.06, 1.25, 0, [0, 0.95, 0], { material: mat(0xe8e4dc, { r: 0.2 }) });
  box(island, 0.6, 0.03, 0.45, 0, [-0.7, 0.995, 0.1], { material: mat(0xa8784a, { r: 0.6 }) });
  for (const [x, c] of [[0.6, 0xf2f2f2], [0.95, 0xe8742a]]) mk(new THREE.CylinderGeometry(0.11, 0.09, 0.12, 16), mat(c, { r: 0.4 }), island, [x, 1.04, -0.25]);
  const tray = box(island, 0.7, 0.04, 0.5, 0, [0.15, 0.995, 0.1], { material: mat(0xc0c4ca, { m: 0.7, r: 0.3 }) });
  // dining table set for Thanksgiving
  const tb = grp(g, 0, 0, 1.0);
  box(tb, 4.8, 0.08, 1.5, 0, [0, 0.76, 0], { material: woodM, round: 0.02 });
  box(tb, 4.9, 0.02, 1.62, 0, [0, 0.805, 0], { material: mat(0xf6efe0, { r: 0.85 }), noShadow: true });
  box(tb, 4.7, 0.022, 0.4, 0, [0, 0.818, 0], { material: mat(0xc0441a, { r: 0.85 }), noShadow: true });
  for (const [x, z] of [[-2.2, -0.6], [2.2, -0.6], [-2.2, 0.6], [2.2, 0.6]]) box(tb, 0.08, 0.74, 0.08, 0, [x, 0.37, z], { material: woodM });
  const seats = [];
  for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) seats.push([-1.65 + i * 1.1, sd * 1.15, sd > 0 ? P : 0]);
  seats.push([-2.95, 0, P / 2], [2.95, 0, -P / 2]);
  for (const [x, z, ry] of seats) {
    const ch = grp(tb, x, 0, z); ch.rotation.y = ry;
    box(ch, 0.5, 0.06, 0.5, 0, [0, 0.47, 0], { material: woodM, round: 0.02 });
    box(ch, 0.5, 0.6, 0.06, 0, [0, 0.8, -0.24], { material: woodM, round: 0.02 });
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(ch, 0.05, 0.46, 0.05, 0, [lx, 0.23, lz], { material: woodM });
    // place setting
    const ps = grp(tb, x * (Math.abs(x) > 2.5 ? 0.82 : 1), 0.82, z * 0.42);
    mk(new THREE.CylinderGeometry(0.15, 0.13, 0.015, 24), mat(0xffffff, { r: 0.25 }), ps, [0, 0.008, 0]);
    mk(new THREE.CylinderGeometry(0.035, 0.03, 0.14, 12), new THREE.MeshStandardMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.55, roughness: 0.05 }), ps, [0.2, 0.07, -Math.sign(z || 1) * 0.08]);
  }
  const food = grp(tb, 0, 0.82, 0);
  const roast = buildTurkey('roast'); roast.position.set(0, 0.01, 0); food.add(roast);
  const sides = grp(food);
  dish(sides, -0.9, 0, -0.2, 0xf6f0e0, 'mound'); dish(sides, 0.9, 0, 0.2, 0x9a0a2a); dish(sides, -1.5, 0, 0.25, 0, 'corn'); dish(sides, 1.5, 0, -0.25, 0x4a8a2a, 'mound');
  dish(sides, -0.5, 0, 0.35, 0xb07a3a, 'mound'); dish(sides, 0.5, 0, -0.35, 0xe8c070, 'mound');
  pie(sides, 2.0, 0, 0.2); pie(sides, -2.0, 0, -0.2, 0x5a2a1a);
  const flames = [];
  for (let i = 0; i < 3; i++) pumpkin(food, -0.25 + i * 0.25, 0, 0.55 * (i % 2 ? 1 : -1) * 0, 0.4);
  // decorations: banner, garlands, string lights
  banner(g, 'HAPPY THANKSGIVING', 6.0, [0, 3.0, -5.8]);
  garland(g, -7, 7, 3.3, 4.85, 0.3, 0, 36, 9);
  garland(g, -6.9, 6.9, 3.35, -5.85, 0.25, 0, 36, 11);
  const bulbs = []; for (let i = 0; i < 24; i++) { const k = i / 23; bulbs.push(mk(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: [0xffd06a, 0xff8a3a, 0xfff2c0][i % 3] }), g, [-6.8 + k * 13.6, 3.15 - S(k * P) * 0.35, 4.75], [0, 0, 0], null, false)); }
  return {
    name: 'dining', group: g, bg: new THREE.Color(0x2a1a12), exposure: 1.0,
    update(t, X) {
      const v = (n, d = 0) => X.val(n, d);
      food.visible = v('din.food', 1) > 0.5;
      roast.visible = v('din.turkey', 1) > 0.5;
      const eaten = v('din.eaten', 0);
      roast.scale.set(1, 1 - 0.45 * eaten, 1 - 0.2 * eaten);
      sides.visible = v('din.sides', 1) > 0.5;
      for (const [i, f] of fire.entries()) { f.scale.set(1, 0.8 + 0.4 * Math.abs(noise1(t * 6 + i * 3)), 1); }
      fireL.intensity = 3.5 + 1.2 * noise1(t * 8);
      flames.forEach((f, i) => f.scale.set(1, 1.6 + 0.4 * noise1(t * 9 + i), 1));
      const on = v('kit.oven', 0);
      ovenWin.material.emissiveIntensity = on * 1.2; ovenL.intensity = on * 3;
      ovenDoor.rotation.x = v('kit.ovenOpen', 0) * 1.4;
      tray.visible = v('kit.tray', 1) > 0.5;
      const night = v('din.night', 0);
      warm.forEach((l, i) => { l.intensity = (i === 0 ? 9 : 7) * (0.8 + 0.5 * night); });
      bulbs.forEach((b, i) => b.scale.setScalar(0.85 + 0.25 * S(t * 2 + i)));
    },
  };
}

// ------------------------------------------------------------------ Thanksgiving decorations for the HQ living room
export function buildThanksDecor() {
  const g = new THREE.Group();
  banner(g, 'HAPPY THANKSGIVING', 5.0, [0, 3.05, -4.66]);
  garland(g, -7.1, 7.1, 3.45, -4.66, 0.3, 0, 40, 21);
  garland(g, -7.1, 7.1, 3.45, 5.36, 0.3, 0, 40, 23);
  for (const [x, z, s] of [[-2.2, -4.2, 1.6], [-2.6, -3.9, 1.1], [2.2, -4.2, 1.5], [2.6, -3.9, 1.0], [5.9, 2.3, 1.4], [4.4, 2.2, 1.0]]) pumpkin(g, x, 0, z, s, s > 1.3 ? 0xe8742a : 0xe89a2a);
  const corn = grp(g, 0, 0.46, -0.85);
  mk(new THREE.ConeGeometry(0.18, 0.55, 14, 1, true), mat(0xc8a060, { r: 0.9, side: THREE.DoubleSide }), corn, [0.25, 0.12, 0], [0, 0, P / 2]);
  for (let i = 0; i < 6; i++) mk(new THREE.SphereGeometry(0.06, 8, 6), mat([0xd02a2a, 0xf2c23a, 0xe8742a, 0x5aa83a][i % 4], { r: 0.5 }), corn, [-0.08 - (i % 3) * 0.07, 0.08 + Math.floor(i / 3) * 0.08, (i % 2 - 0.5) * 0.12]);
  return g;
}

// ------------------------------------------------------------------ the Season 2 intro title
export function buildS2Title(font, TextGeometry) {
  const g = new THREE.Group();
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(2, 5, 9); g.add(key);
  const rimL = new THREE.PointLight(0xff7a2a, 0, 14, 1.4); rimL.position.set(-5, 1, 2); g.add(rimL);
  const rimR = new THREE.PointLight(0x4ab8ff, 0, 14, 1.4); rimR.position.set(5, 1, 2); g.add(rimR);
  g.add(new THREE.HemisphereLight(0x6f8fff, 0x101830, 0.55));
  const faceM = new THREE.MeshStandardMaterial({ color: 0xf2f8ff, metalness: 0.65, roughness: 0.18, emissive: 0x3a8cff, emissiveIntensity: 0.35 });
  const sideM = new THREE.MeshStandardMaterial({ color: 0x1f4fd8, metalness: 0.85, roughness: 0.22, emissive: 0x0a2a90, emissiveIntensity: 0.6 });
  const mkText = (txt, size, depth, mats) => {
    const geo = new TextGeometry(txt, { font, size, depth, curveSegments: 8, bevelEnabled: true, bevelThickness: depth * 0.28, bevelSize: size * 0.045, bevelSegments: 4 });
    geo.computeBoundingBox(); geo.center();
    return new THREE.Mesh(geo, mats);
  };
  const titleG = grp(g);
  const title = mkText('BATTLE WARS', 1.05, 0.42, [faceM, sideM]); titleG.add(title);
  const s2 = mkText('SEASON 2', 0.42, 0.16, [new THREE.MeshStandardMaterial({ color: 0xffe08a, metalness: 0.5, roughness: 0.25, emissive: 0xff9a1a, emissiveIntensity: 0.55 }), new THREE.MeshStandardMaterial({ color: 0x9a5a10, metalness: 0.7, roughness: 0.3 })]);
  s2.position.set(0, -1.15, 0.2); titleG.add(s2);
  const bb = new THREE.Box3().setFromObject(title); const halfW = (bb.max.x - bb.min.x) / 2;
  // background: dark blue with light rays and a floor glow
  const bgTex = canvasTex(1024, 512, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h * 0.55, 20, w / 2, h * 0.55, w * 0.6); gr.addColorStop(0, '#24408a'); gr.addColorStop(0.5, '#0c1640'); gr.addColorStop(1, '#03060f');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  mk(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: bgTex }), g, [0, 0, -8], [0, 0, 0], null, false);
  const rays = grp(g, 0, 0, -6);
  for (let i = 0; i < 14; i++) mk(new THREE.PlaneGeometry(0.6, 16), new THREE.MeshBasicMaterial({ color: 0x6ab0ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false }), rays, [0, 0, 0], [0, 0, (i / 14) * P], null, false);
  const floor = mk(new THREE.CircleGeometry(6, 48), new THREE.MeshBasicMaterial({ color: 0x2a6aff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }), g, [0, -1.9, 0], [-P / 2, 0, 0], null, false);
  // power streams out of both sides: fire (left, Flare), lightning-blue energy (right), plus green + gold sparks
  const N = 420;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dotTex = canvasTex(64, 64, (c, w, h) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.32, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.add(pts);
  const seeds = Array.from({ length: N }, (_, i) => ({ side: i % 2 ? 1 : -1, kind: i % 7 === 0 ? 2 : i % 5 === 0 ? 3 : (i % 2 ? 1 : 0), y: (hash(i * 1.7) - 0.5) * 1.3, sp: 4 + hash(i * 3.3) * 7, ph: hash(i * 9.1), spread: (hash(i * 5.5) - 0.5) * 2.2 }));
  const COLS = [[[1, 0.85, 0.3], [1, 0.35, 0.05]], [[0.75, 0.95, 1], [0.15, 0.5, 1]], [[0.6, 1, 0.6], [0.1, 0.8, 0.3]], [[1, 0.95, 0.6], [1, 0.75, 0.1]]];
  // lightning bolts on the right side
  const bolts = [];
  for (let b = 0; b < 4; b++) { const geo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 10 }, () => new THREE.Vector3())); const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xbfe6ff, transparent: true, blending: THREE.AdditiveBlending })); g.add(l); bolts.push(l); }
  return {
    name: 's2title', group: g, bg: new THREE.Color(0x03060f), exposure: 1.0,
    update(t, X) {
      const a = t - X.val('s2title.t0', 0);
      const rise = smoothstep(0.0, 1.6, a);
      titleG.position.y = lerp(-3.4, 0.25, 1 - Math.pow(1 - rise, 3)) + 0.05 * S(a * 1.6);
      titleG.rotation.x = lerp(0.6, 0, rise); titleG.rotation.y = 0.05 * S(a * 0.7);
      const pw = smoothstep(1.2, 1.8, a);
      s2.visible = a > 1.8; s2.scale.setScalar(smoothstep(1.8, 2.3, a) * (1 + 0.15 * Math.exp(-(a - 2.3) * 4) * (a > 2.3 ? 1 : 0)));
      faceM.emissiveIntensity = 0.35 + 0.6 * pw * (0.8 + 0.2 * S(a * 7));
      rimL.intensity = 30 * pw * (0.85 + 0.15 * noise1(a * 9)); rimR.intensity = 30 * pw * (0.8 + 0.2 * noise1(a * 13 + 4));
      rays.rotation.z = a * 0.15; rays.children.forEach((r) => { r.material.opacity = 0.03 + 0.07 * pw; });
      floor.material.opacity = 0.1 + 0.25 * rise;
      const ty = titleG.position.y;
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        const life = ((a * (0.55 + s.ph * 0.4) + s.ph) % 1);
        const on = pw > 0 && a > 1.2 + s.ph * 0.4;
        const d = life * s.sp;
        const x = s.side * (halfW + 0.2 + d);
        const wob = s.kind === 0 ? S(life * 14 + i) * 0.25 * life : s.kind === 1 ? (hash(Math.floor(a * 20) + i) - 0.5) * 0.25 : S(life * 9 + i) * 0.15;
        pos[i * 3] = on ? x : 0; pos[i * 3 + 1] = on ? ty + s.y * (0.5 + life * 1.4) + s.spread * life * life * 0.8 + wob : -50; pos[i * 3 + 2] = on ? 0.1 + (hash(i * 2.3) - 0.5) * 0.6 : 0;
        const kind = s.side < 0 ? (s.kind === 2 ? 3 : 0) : (s.kind === 2 ? 2 : 1);
        const [c0, c1] = COLS[kind];
        const f = 1 - life;
        col[i * 3] = lerp(c1[0], c0[0], f) * f * pw; col[i * 3 + 1] = lerp(c1[1], c0[1], f) * f * pw; col[i * 3 + 2] = lerp(c1[2], c0[2], f) * f * pw;
      }
      pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
      bolts.forEach((l, b) => {
        const p = l.geometry.attributes.position;
        const seg = Math.floor(a * 14) + b * 31;
        for (let k = 0; k < 10; k++) { const u = k / 9; p.setXYZ(k, halfW + 0.2 + u * (3.5 + b * 0.8), ty + (b - 1.5) * 0.3 + (k ? (hash(seg + k * 7.3) - 0.5) * 0.7 * u : 0), 0.2); }
        p.needsUpdate = true; l.visible = pw > 0.3 && hash(seg * 1.1) > 0.25; l.material.opacity = pw;
      });
    },
  };
}

// ------------------------------------------------------------------ the turkey that everybody wants (frozen, then roasted) + flying pies
export function buildS2E1Objects(scene) {
  const frozen = buildTurkey('frozen'), roast = buildTurkey('roast');
  roast.getObjectByName('plate').visible = true;
  const root = new THREE.Group(); root.add(frozen); root.add(roast); scene.add(root);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  return {
    update(t, X) {
      const v = (n, d = 0) => X.val(n, d);
      const vis = v('turkey.vis', 0) > 0.5;
      root.visible = vis; if (!vis) return;
      const kind = X.step('turkey.kind') ?? 'frozen';
      frozen.visible = kind === 'frozen'; roast.visible = kind !== 'frozen';
      roast.getObjectByName('plate').visible = kind === 'roastPlate';
      const hold = X.step('turkey.hold') ?? 'none';
      if (hold !== 'none' && X.visible(hold.split('.')[0])) {
        const [who, side] = hold.split('.');
        if (side === 'both') { tmp.copy(X.hand(who, 'L')).add(X.hand(who, 'R')).multiplyScalar(0.5); }
        else tmp.copy(X.hand(who, side));
        root.position.set(tmp.x, tmp.y - 0.14 + v('turkey.hdy', 0), tmp.z);
        root.rotation.set(v('turkey.rx', 0), v(`${who}.ry`, 0) + v('turkey.ry', 0), v('turkey.rz', 0));
      } else {
        root.position.set(v('turkey.x'), v('turkey.y'), v('turkey.z'));
        const sp = v('turkey.spin', 0);
        root.rotation.set(v('turkey.rx', 0) + sp * t * 1.3, v('turkey.ry', 0) + sp * t, v('turkey.rz', 0));
      }
      root.scale.setScalar(v('turkey.s', 1));
    },
  };
}
