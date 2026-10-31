// Episode 7 "Western Disaster": the city bank, an abandoned street, the warehouse (inside + outside with
// police cars), a bird for Eric, park pigeons, and the clay creatures' extra bits (mound, chunks, puddle).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, mk, grp, rng, hash, canvasTex, clamp, lerp, smoothstep } from './util.js';
import { box, plane, building, streetLamp } from './sets.js';
import * as TX from './textures.js';

const P = Math.PI;

// ------------------------------------------------------------------ textures
function marbleTex() {
  return canvasTex(512, 512, (ctx, w, h) => {
    const r = rng(41), n = 4, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#d9d4ca' : '#b8b0a2'; ctx.fillRect(x * s, y * s, s, s);
      ctx.strokeStyle = 'rgba(120,110,100,0.25)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x * s + r() * s, y * s); ctx.bezierCurveTo(x * s + r() * s, y * s + s * 0.3, x * s + r() * s, y * s + s * 0.7, x * s + r() * s, y * s + s); ctx.stroke(); }
    }
    ctx.strokeStyle = '#8e877b'; ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke(); }
  }, { repeat: [5, 5] });
}
function concrete(seed, base, rep = [6, 6], cracks = 6) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const r = rng(seed);
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.05})`; ctx.fillRect(r() * w, r() * h, 3, 3); }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
    for (let i = 0; i < cracks; i++) {
      let x = r() * w, y = r() * h; ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  }, { repeat: rep });
}
function corrugatedTex(base = '#6a6f78', rep = [8, 1]) {
  return canvasTex(256, 256, (ctx, w, h) => {
    for (let x = 0; x < w; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, base); g.addColorStop(0.5, '#9aa0a8'); g.addColorStop(1, base);
      ctx.fillStyle = g; ctx.fillRect(x, 0, 16, h);
    }
    const r = rng(9);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(120,60,20,${0.08 + r() * 0.15})`; ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 6 + r() * 20, 10 + r() * 40, 0, 0, 7); ctx.fill(); }
  }, { repeat: rep });
}
function boardsTex() {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1a140e'; ctx.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(w / 2, 18 + i * 30); ctx.rotate((r() - 0.5) * 0.25);
      ctx.fillStyle = ['#6a4a2a', '#5a3e22', '#7a5532'][i % 3]; ctx.fillRect(-w * 0.55, -11, w * 1.1, 22);
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-w * 0.45, -2, 4, 4); ctx.fillRect(w * 0.42, -2, 4, 4);
      ctx.restore();
    }
  });
}
function paintingTex() {
  return canvasTex(256, 192, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f2b45a'); g.addColorStop(0.55, '#e8735a'); g.addColorStop(1, '#5a3a6a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(170, 80, 26, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a2a3a'; ctx.beginPath(); ctx.moveTo(0, 150); ctx.lineTo(70, 100); ctx.lineTo(130, 140); ctx.lineTo(200, 95); ctx.lineTo(256, 130); ctx.lineTo(256, 192); ctx.lineTo(0, 192); ctx.fill();
  });
}

// a sign whose text can change (e.g. the bank's clock); call .draw(text) once per frame, it only redraws on change
function liveSign(w, h, painter) {
  const tex = canvasTex(w, h, () => {});
  let last = null;
  tex.draw = (txt) => { if (txt === last) return; last = txt; painter(tex.userData.ctx, w, h, txt); tex.needsUpdate = true; };
  return tex;
}

// night version of a city building: unlit windows go dark blue-grey, lit ones still glow
function nightBuilding(g, x, z, w, d, h, color, seed, lit, front) {
  const b = building(g, x, z, w, d, h, color, seed, lit, front);
  const side = Array.isArray(b.material) ? b.material[0] : b.material;
  side.color.setHex(0x4a5468); if (lit) side.emissiveIntensity = 0.55;
  return b;
}

// ------------------------------------------------------------------ shared props
function goldBar(g, x, y, z, ry = 0) {
  const m = mat(0xffc93a, { r: 0.25, m: 0.85, e: 0x4a3000, ei: 0.4 });
  const geo = new THREE.CylinderGeometry(0.06, 0.085, 0.07, 4, 1); geo.rotateY(P / 4); geo.scale(1.9, 1, 0.9);
  return mk(geo, m, g, [x, y + 0.035, z], [0, ry, 0]);
}
function goldStack(g, x, z, rows = 3, ry = 0) {
  const s = grp(g, x, 0, z); s.rotation.y = ry;
  for (let r = 0; r < rows; r++) for (let i = 0; i < 4 - r; i++) for (let j = 0; j < 2; j++) goldBar(s, (i - (3 - r) / 2) * 0.24, r * 0.07, j * 0.16 - 0.08, r % 2 ? 0 : 0);
  return s;
}
function moneyBag(g, x, y, z, s = 1, ry = 0) {
  const b = grp(g, x, y, z); b.rotation.y = ry; b.scale.setScalar(s);
  const c = mat(0xc8b48a, { r: 0.9 });
  mk(new THREE.SphereGeometry(0.22, 16, 12), c, b, [0, 0.2, 0], [0, 0, 0], [1, 0.95, 1]);
  mk(new THREE.CylinderGeometry(0.06, 0.1, 0.12, 12), c, b, [0, 0.42, 0]);
  mk(new THREE.TorusGeometry(0.07, 0.015, 6, 14), mat(0x6a4a2a), b, [0, 0.4, 0], [P / 2, 0, 0]);
  const sign = new THREE.MeshBasicMaterial({ map: TX.signTex('$', '#c8b48a', '#2f6a2f', 128, 128), transparent: false });
  mk(new THREE.CircleGeometry(0.11, 20), sign, b, [0, 0.22, 0.215], [0, 0, 0], null, false);
  return b;
}
function crate(g, x, z, s = 1, ry = 0, y = 0) {
  const c = grp(g, x, y, z); c.rotation.y = ry;
  box(c, s, s, s, 0x8a6a42, [0, s / 2, 0], { r: 0.9 });
  const dark = mat(0x5a4228, { r: 0.9 });
  for (const sd of [1, -1]) { box(c, s * 1.02, s * 0.12, s * 1.02, 0, [0, s / 2 + sd * s * 0.38, 0], { material: dark }); }
  return c;
}
function barrel(g, x, z, color = 0x3a5a7a, tipped = false) {
  const b = mk(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 16), mat(color, { r: 0.6, m: 0.3 }), g, [x, tipped ? 0.32 : 0.45, z], [tipped ? P / 2 : 0, 0, tipped ? 0.3 : 0]);
  for (const y of [-0.3, 0.3]) mk(new THREE.TorusGeometry(0.32, 0.02, 6, 20), mat(0x1a1a1a, { m: 0.5 }), b, [0, y, 0], [P / 2, 0, 0]);
  return b;
}

// ------------------------------------------------------------------ THE CITY BANK (outside + inside in one place)
// Facade along x at z = 0 facing +z (the street). Lobby behind it: x -8..8, z -14..0. Storage room behind the
// back wall door: z -14..-19. Across the street (z 17..) a building whose roof (y 7) is Eric's lookout.
export function buildBank() {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0x5a6a9a, 0x0c0e16, 0.75); g.add(hemi);
  const moon = new THREE.DirectionalLight(0x9ab0ff, 0.7); moon.position.set(-10, 24, 18); g.add(moon);
  const street = [];
  for (const [x, z] of [[-6, 3.4], [7, 3.4], [-3, 15.4]]) { const l = new THREE.PointLight(0xffc880, 22, 13, 1.4); l.position.set(x, 4.0, z); g.add(l); street.push(l); }
  const upl = new THREE.SpotLight(0xffe0b0, 40, 14, 0.7, 0.6, 1.2); upl.position.set(0, 0.3, 4.5); upl.target.position.set(0, 6, 0); g.add(upl); g.add(upl.target);
  // ground: sidewalk, road, far sidewalk
  const swTex = TX.sidewalkTex(); swTex.repeat.set(16, 2);
  plane(g, 80, 4, new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.85, color: 0x9a9690 }), [0, 0.0, 2], [-P / 2, 0, 0]);
  const rd = TX.roadTex(); rd.repeat.set(8, 1);
  plane(g, 80, 10, new THREE.MeshStandardMaterial({ map: rd, roughness: 0.7, color: 0x8a8a90 }), [0, 0.0, 9], [-P / 2, 0, 0]);
  const sw2 = TX.sidewalkTex(); sw2.repeat.set(16, 2);
  plane(g, 80, 4, new THREE.MeshStandardMaterial({ map: sw2, roughness: 0.85, color: 0x9a9690 }), [0, 0.0, 16], [-P / 2, 0, 0]);
  box(g, 80, 0.12, 0.25, 0x6a6660, [0, 0.06, 4.0]); box(g, 80, 0.12, 0.25, 0x6a6660, [0, 0.06, 14.0]);
  // --- facade
  const stone = mat(0xcfc6b2, { r: 0.85 }), stoneD = mat(0xa89e88, { r: 0.85 });
  const wallT = 0.5;
  // pieces around the door gap (x -1.3..1.3, h 3.4) and window gaps (x ±(3.9..6.3), y 1.1..3.7)
  box(g, 18, 3.6, wallT, 0, [0, 5.7, -wallT / 2], { material: stone });
  box(g, 1.6, 1.1, wallT, 0, [0, 3.95, -wallT / 2], { material: stone });
  box(g, 2.6, 4.0, wallT, 0, [-2.6, 1.95, -wallT / 2], { material: stone }); box(g, 2.6, 4.0, wallT, 0, [2.6, 1.95, -wallT / 2], { material: stone });
  for (const sd of [-1, 1]) {
    box(g, 2.4, 1.1, wallT, 0, [sd * 5.1, 0.55, -wallT / 2], { material: stone });
    box(g, 2.4, 0.2, wallT, 0, [sd * 5.1, 3.8, -wallT / 2], { material: stone });
    box(g, 2.7, 4.0, wallT, 0, [sd * 7.65, 1.95, -wallT / 2], { material: stone });
    // window glass + frame + ledge (Eric perches on the right ledge)
    mk(new THREE.PlaneGeometry(2.4, 2.6), new THREE.MeshStandardMaterial({ color: 0x9ab8d0, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.4, depthWrite: false }), g, [sd * 5.1, 2.4, -0.05], [0, 0, 0], null, false);
    box(g, 2.6, 0.12, 0.45, 0, [sd * 5.1, 1.05, 0.15], { material: stoneD });
    box(g, 0.06, 2.6, 0.08, 0x3a3a40, [sd * 5.1, 2.4, -0.05], { m: 0.5 });
    box(g, 2.4, 0.06, 0.08, 0x3a3a40, [sd * 5.1, 2.4, -0.05], { m: 0.5 });
  }
  // columns + entablature + name
  for (const x of [-8.2, -2.0, 2.0, 8.2]) {
    mk(new THREE.CylinderGeometry(0.34, 0.38, 6.6, 18), stone, g, [x, 3.3, 0.8]);
    box(g, 0.95, 0.25, 0.95, 0, [x, 0.12, 0.8], { material: stoneD }); box(g, 0.95, 0.25, 0.95, 0, [x, 6.6, 0.8], { material: stoneD });
  }
  box(g, 18.6, 1.0, 1.8, 0, [0, 7.2, 0.5], { material: stoneD });
  const tri = new THREE.Shape(); tri.moveTo(-9.3, 0); tri.lineTo(9.3, 0); tri.lineTo(0, 1.6); tri.closePath();
  mk(new THREE.ExtrudeGeometry(tri, { depth: 1.6, bevelEnabled: false }), stone, g, [0, 7.7, -0.3]);
  const nameTex = TX.signTex('AETHERFALL CITY BANK', '#a89e88', '#2a2418', 1024, 96, '"Inter Display", sans-serif');
  mk(new THREE.PlaneGeometry(10, 0.9), new THREE.MeshStandardMaterial({ map: nameTex, roughness: 0.8 }), g, [0, 7.2, 1.42], [0, 0, 0], null, false);
  // the front doors (bank.door 0..1 swings them inward)
  const doors = [];
  for (const sd of [-1, 1]) {
    const hinge = grp(g, sd * 1.3, 0, -0.25);
    const d = box(hinge, 1.28, 3.35, 0.08, 0, [-sd * 0.64, 1.68, 0], { material: new THREE.MeshStandardMaterial({ color: 0x8ab0c8, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.5, depthWrite: false }) });
    d.castShadow = false;
    box(hinge, 1.28, 0.12, 0.1, 0xb08a3a, [-sd * 0.64, 0.06, 0], { m: 0.7, r: 0.3 }); box(hinge, 1.28, 0.12, 0.1, 0xb08a3a, [-sd * 0.64, 3.3, 0], { m: 0.7, r: 0.3 });
    box(hinge, 0.1, 3.35, 0.1, 0xb08a3a, [-sd * 1.23, 1.68, 0], { m: 0.7, r: 0.3 });
    box(hinge, 0.04, 0.5, 0.06, 0xd8b050, [-sd * 1.1, 1.3, 0.08], { m: 0.8, r: 0.3 });
    doors.push({ hinge, sd });
  }
  // digital time sign on a post by the entrance
  const clockTex = liveSign(512, 192, (c, w, h, txt) => {
    c.fillStyle = '#0a0606'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ff4a2a'; c.shadowColor = '#ff3010'; c.shadowBlur = 18; c.font = 'bold 120px "DejaVu Sans Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, w / 2, h / 2 + 6); c.shadowBlur = 0;
  });
  const post = grp(g, 4.4, 0, 2.6);
  mk(new THREE.CylinderGeometry(0.07, 0.08, 3.0, 10), mat(0x2c3340, { m: 0.5, r: 0.4 }), post, [0, 1.5, 0]);
  box(post, 1.5, 0.62, 0.18, 0x15161c, [0, 3.2, 0], { m: 0.4 });
  for (const sd of [1, -1]) mk(new THREE.PlaneGeometry(1.36, 0.5), new THREE.MeshBasicMaterial({ map: clockTex }), post, [0, 3.2, sd * 0.095], [0, sd > 0 ? 0 : P, 0], null, false);
  const bankTex = TX.signTex('BANK', '#123a7a', '#ffffff', 256, 96);
  mk(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshBasicMaterial({ map: bankTex }), post, [0, 3.72, 0.0], [0, 0, 0], null, false);
  for (const sd of [1, -1]) streetLamp(g, sd * 6.5 + (sd < 0 ? 0.5 : 0.5), 3.6, -1);
  streetLamp(g, -3, 14.6, 1);
  // neighbours
  nightBuilding(g, -16, -6, 12, 14, 13, 0x5a6070, 31, true);
  nightBuilding(g, 16, -6, 12, 14, 11, 0x6a5a58, 32, true);
  nightBuilding(g, 30, -6, 14, 14, 17, 0x4a5262, 33, false);
  nightBuilding(g, -30, -6, 14, 14, 15, 0x625a50, 34, true);
  // across the street: Eric's rooftop (x -9..1, roof y 7) + others
  nightBuilding(g, -4, 22, 10, 8, 7, 0x6a6258, 35, false);
  box(g, 10.3, 0.5, 0.3, 0x5d6470, [-4, 7.25, 17.9]);
  nightBuilding(g, 9, 22, 12, 8, 12, 0x505868, 36, true);
  nightBuilding(g, -18, 22, 14, 8, 14, 0x5a5050, 37, true);
  nightBuilding(g, 22, 22, 12, 8, 9, 0x6a6a72, 38, false);
  // night sky
  const sky = mk(new THREE.SphereGeometry(120, 24, 12), new THREE.MeshBasicMaterial({ map: TX.skyTex('#02040e', '#0a1430', '#1a2448'), side: THREE.BackSide, fog: false }), g, [0, 0, 0], [0, 0, 0], null, false);
  for (let i = 0; i < 120; i++) { const a = hash(i * 3.1) * P * 2, e = 0.15 + hash(i * 7.7) * 1.2; mk(new THREE.SphereGeometry(0.18 + hash(i) * 0.2, 4, 3), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false }), g, [Math.cos(a) * Math.cos(e) * 110, Math.sin(e) * 110, Math.sin(a) * Math.cos(e) * 110], [0, 0, 0], null, false); }
  sky.renderOrder = -1;

  // --- lobby (inside)
  const marble = new THREE.MeshStandardMaterial({ map: marbleTex(), roughness: 0.3, metalness: 0.05 });
  plane(g, 16, 14, marble, [0, 0.005, -7], [-P / 2, 0, 0]);
  const wallM = mat(0xe6dccb, { r: 0.85 }), trim = mat(0x7a5a3a, { r: 0.6 });
  box(g, 0.3, 5.6, 14, 0, [-8.15, 2.8, -7], { material: wallM, noShadow: true }); box(g, 0.3, 5.6, 14, 0, [8.15, 2.8, -7], { material: wallM, noShadow: true });
  // back wall with the storage-room doorway (x -1..1, h 2.6)
  box(g, 7.0, 5.6, 0.3, 0, [-4.5, 2.8, -14.15], { material: wallM }); box(g, 7.0, 5.6, 0.3, 0, [4.5, 2.8, -14.15], { material: wallM });
  box(g, 2.0, 3.0, 0.3, 0, [0, 4.1, -14.15], { material: wallM });
  plane(g, 16.6, 14.4, mat(0xd8cfbe, { r: 0.9, side: THREE.DoubleSide }), [0, 5.6, -7], [P / 2, 0, 0], false);
  box(g, 16, 0.18, 0.06, 0, [0, 0.09, -13.97], { material: trim });
  // teller counter (gap in the middle), glass partitions, rope posts
  const wood = mat(0x6a4426, { r: 0.55 }), top = mat(0xe8e0d0, { r: 0.25 });
  for (const sd of [-1, 1]) {
    box(g, 5.6, 1.1, 0.8, 0, [sd * 4.6, 0.55, -8], { material: wood, round: 0.03 });
    box(g, 5.8, 0.08, 1.0, 0, [sd * 4.6, 1.14, -8], { material: top });
    mk(new THREE.PlaneGeometry(5.6, 1.1), new THREE.MeshStandardMaterial({ color: 0xb8d8f0, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false }), g, [sd * 4.6, 1.75, -8], [0, 0, 0], null, false);
    for (let i = 0; i < 4; i++) box(g, 0.05, 1.1, 0.05, 0xb08a3a, [sd * (2.0 + i * 1.75), 1.75, -8], { m: 0.7, r: 0.3 });
    for (let i = 0; i < 3; i++) { const x = sd * (2.6 + i * 1.6); box(g, 0.6, 0.35, 0.4, 0x22252c, [x, 1.36, -8.25], { r: 0.4 }); }
  }
  for (const x of [-4.5, -2.5, 2.5, 4.5]) {
    mk(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 10), mat(0xd8b050, { m: 0.8, r: 0.3 }), g, [x, 0.48, -4.5]);
    mk(new THREE.SphereGeometry(0.06, 10, 8), mat(0xd8b050, { m: 0.8, r: 0.3 }), g, [x, 0.98, -4.5]);
  }
  for (const [a, b] of [[-4.5, -2.5], [2.5, 4.5]]) mk(new THREE.CylinderGeometry(0.025, 0.025, 2.0, 8), mat(0x8a1a2a, { r: 0.7 }), g, [(a + b) / 2, 0.8, -4.5], [0, 0, P / 2]);
  // security desk with monitors by the entrance
  const desk = grp(g, -5.6, 0, -2.6);
  box(desk, 1.8, 1.0, 0.8, 0, [0, 0.5, 0], { material: wood, round: 0.03 });
  for (let i = 0; i < 2; i++) { box(desk, 0.5, 0.36, 0.06, 0x101218, [-0.35 + i * 0.7, 1.25, -0.1], { r: 0.4 }); mk(new THREE.PlaneGeometry(0.44, 0.3), mat(0x2a4a5a, { e: 0x3a9ac0, ei: 0.5 }), desk, [-0.35 + i * 0.7, 1.25, -0.065], [0, 0, 0], null, false); }
  // plants, benches, wall posters
  for (const [x, z] of [[-7.4, -1.2], [7.4, -1.2], [-7.4, -13.2], [7.4, -13.2]]) {
    mk(new THREE.CylinderGeometry(0.3, 0.24, 0.55, 14), mat(0x8a5a3a), g, [x, 0.28, z]);
    mk(new THREE.IcosahedronGeometry(0.5, 1), mat(0x2f7a3a, { r: 0.8 }), g, [x, 0.95, z], [0, 0, 0], [1, 1.3, 1]);
  }
  box(g, 2.2, 0.45, 0.6, 0x3a2a20, [5.6, 0.25, -3.0], { round: 0.04 });
  // ceiling security lights (bank.flicker makes them stutter)
  const panelM = mat(0xeef6ff, { e: 0xdfeeff, ei: 1.2 });
  const panels = [];
  for (const [x, z] of [[-4, -3.5], [4, -3.5], [-4, -10.5], [4, -10.5], [0, -7]]) panels.push(box(g, 1.4, 0.06, 0.5, 0, [x, 5.55, z], { material: panelM, noShadow: true }));
  const sec = [];
  for (const [x, z] of [[-3.5, -4], [3.5, -4], [0, -11]]) { const l = new THREE.PointLight(0xcfe0ff, 16, 12, 1.4); l.position.set(x, 5.0, z); g.add(l); sec.push(l); }
  // wall security cameras with blinking red dots
  const camDot = mat(0xff2020, { e: 0xff2020, ei: 2 });
  const dots = [];
  for (const [x, z, ry] of [[-7.85, -1.0, P / 2 + 0.6], [7.85, -12.8, -P / 2 - 0.6]]) {
    const c = grp(g, x, 4.9, z); c.rotation.y = ry;
    box(c, 0.2, 0.18, 0.42, 0xdedede, [0, 0, 0.2], { r: 0.4 }); dots.push(mk(new THREE.SphereGeometry(0.025, 6, 5), camDot, c, [0.06, 0.05, 0.42]));
  }
  // the storage room door (vault.open 0..1) and the room behind it
  const vHinge = grp(g, -1.0, 0, -14.2);
  const steel = mat(0x9aa2ac, { m: 0.85, r: 0.3 });
  box(vHinge, 2.0, 2.6, 0.22, 0, [1.0, 1.3, 0], { material: steel });
  mk(new THREE.TorusGeometry(0.28, 0.04, 8, 24), mat(0xd8d8e0, { m: 0.9, r: 0.2 }), vHinge, [1.0, 1.35, 0.14]);
  for (let i = 0; i < 4; i++) mk(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 6), mat(0xd8d8e0, { m: 0.9, r: 0.2 }), vHinge, [1.0, 1.35, 0.14], [0, 0, i * P / 4]);
  box(vHinge, 0.5, 0.12, 0.05, 0x2a2a30, [1.0, 2.25, 0.13]);
  const room = mat(0x8a8e94, { r: 0.6, m: 0.3 });
  box(g, 6, 3.2, 0.2, 0, [0, 1.6, -19.1], { material: room }); box(g, 0.2, 3.2, 5, 0, [-3.0, 1.6, -16.6], { material: room }); box(g, 0.2, 3.2, 5, 0, [3.0, 1.6, -16.6], { material: room });
  plane(g, 6, 5, mat(0x6a6e74, { r: 0.7 }), [0, 0.006, -16.6], [-P / 2, 0, 0]);
  plane(g, 6, 5, mat(0x5a5e64, { side: THREE.DoubleSide }), [0, 3.2, -16.6], [P / 2, 0, 0], false);
  const shelves = mat(0x4a4e56, { m: 0.6, r: 0.4 });
  for (const sd of [-1, 1]) for (const y of [0.5, 1.2, 1.9]) box(g, 0.6, 0.05, 4.2, 0, [sd * 2.55, y, -16.8], { material: shelves });
  const loot = grp(g);
  for (const sd of [-1, 1]) {
    goldStack(loot, sd * 2.55, -15.6, 2).position.y = 0.53; goldStack(loot, sd * 2.55, -17.6, 2).position.y = 1.23;
    moneyBag(loot, sd * 2.55, 1.93, -16.4, 0.9); moneyBag(loot, sd * 2.55, 0.53, -17.9, 0.8);
  }
  const jewel = grp(loot, 0, 0, -18.4);
  box(jewel, 1.0, 1.0, 0.6, 0x3a2a4a, [0, 0.5, 0]); mk(new THREE.OctahedronGeometry(0.16, 0), mat(0x6af0ff, { e: 0x2ab0ff, ei: 0.8, r: 0.1, m: 0.3 }), jewel, [0, 1.2, 0]);
  const vaultLight = new THREE.PointLight(0xffe0a0, 6, 6, 1.5); vaultLight.position.set(0, 2.8, -16.6); g.add(vaultLight);
  // things Fred takes (hidden one by one: loot.taken 0..3)
  const takeables = [goldStack(g, 2.55, -16.6, 1), moneyBag(g, -2.55, 1.23, -15.6, 0.85), moneyBag(g, -2.55, 0.53, -16.6, 0.85)];
  takeables[0].position.y = 1.23;
  // the moving shadow of the invisible robber
  const shadowTex = canvasTex(128, 128, (c, w, h) => { const gr = c.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const ghost = mk(new THREE.PlaneGeometry(1.0, 2.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }), g, [0, 0.02, 0], [-P / 2, 0, 0], null, false);
  return {
    name: 'bank', group: g, bg: new THREE.Color(0x050814), fog: [0x0a1020, 18, 70], exposure: 1.3,
    update(t, X) {
      const v = X.val;
      clockTex.draw(v('bank.clock', '2:13 AM'));
      const open = v('bank.door', 0);
      for (const d of doors) d.hinge.rotation.y = d.sd * open * 1.4;
      vHinge.rotation.y = -v('vault.open', 0) * 1.6;
      const fl = v('bank.flicker', 0);
      const on = fl < 0.5 || hash(Math.floor(t * 14)) > 0.35;
      const k = on ? 1 : 0.12;
      for (const l of sec) l.intensity = 16 * k * v('bank.lights', 1);
      panelM.emissiveIntensity = 1.2 * k * v('bank.lights', 1);
      camDot.emissiveIntensity = Math.sin(t * 4) > 0 ? 2 : 0.1;
      const taken = v('loot.taken', 0);
      takeables.forEach((o, i) => { o.visible = taken < i + 0.5; });
      ghost.visible = v('ghost.vis', 0) > 0.5;
      if (ghost.visible) { ghost.position.set(v('ghost.x', 0), 0.02, v('ghost.z', 0)); ghost.rotation.z = v('ghost.ry', 0); }
      const ext = v('bank.inside', 0) > 0.5;
      for (const l of street) l.intensity = ext ? 6 : 22;
    },
  };
}

// ------------------------------------------------------------------ ABANDONED STREET (night)
// Street runs along z (+20 near .. -34 far), road x -5..5, sidewalks to ±7.5, empty buildings beyond.
export function buildOldStreet() {
  const g = new THREE.Group();
  g.add(new THREE.HemisphereLight(0x5a6a9a, 0x101016, 1.25));
  const wallL = new THREE.PointLight(0xffc890, 18, 10, 1.3); wallL.position.set(6.4, 3.4, -19.6); g.add(wallL);
  box(g, 0.5, 0.2, 0.3, 0x2a2a30, [7.3, 3.5, -19.6]);
  mk(new THREE.SphereGeometry(0.1, 8, 6), mat(0xfff0c0, { e: 0xffd890, ei: 2 }), g, [7.15, 3.35, -19.6]);
  const moon = new THREE.DirectionalLight(0x9aaaff, 1.2); moon.position.set(8, 20, 6); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 }); g.add(moon);
  const lamps = [];
  for (const [x, z] of [[-5.6, 4], [5.6, -10]]) { const l = new THREE.PointLight(0xffb870, 30, 16, 1.3); l.position.set(x + (x < 0 ? 1.0 : -1.0), 4.0, z); g.add(l); lamps.push(l); }
  const far = new THREE.PointLight(0x5a6aaa, 30, 30, 1.2); far.position.set(0, 6, -26); g.add(far);
  const asphalt = new THREE.MeshStandardMaterial({ map: concrete(12, '#2c2e34', [3, 8], 14), roughness: 0.75 });
  plane(g, 10, 70, asphalt, [0, 0, -7]);
  const sw = new THREE.MeshStandardMaterial({ map: concrete(13, '#5a5852', [1, 12], 10), roughness: 0.9 });
  for (const sd of [-1, 1]) { plane(g, 2.5, 70, sw, [sd * 6.25, 0.0, -7]); box(g, 0.2, 0.12, 70, 0x4a4844, [sd * 5.05, 0.06, -7]); }
  // potholes + faded lane line
  for (const [x, z, s] of [[1.6, -3, 0.8], [-2.2, -12, 1.1], [0.8, 6, 0.6], [-1.0, -20, 0.9]]) mk(new THREE.CircleGeometry(0.5, 16), mat(0x101114, { r: 0.6 }), g, [x, 0.004, z], [-P / 2, 0, 0], [s * 1.3, s, 1], false).receiveShadow = true;
  for (let z = 14; z > -32; z -= 4) if (hash(z) > 0.3) box(g, 0.14, 0.01, 1.6, 0xb8b090, [0, 0.008, z], { noShadow: true });
  // empty buildings, boarded up
  const boards = new THREE.MeshStandardMaterial({ map: boardsTex(), roughness: 0.9 });
  const cols = [0x4a4440, 0x3e4048, 0x524a42, 0x44403c, 0x3a3e44];
  let k = 0;
  for (const sd of [-1, 1]) for (let z = 16; z > -36; z -= 9) {
    const h = 8 + hash(z * 3 + sd) * 8;
    nightBuilding(g, sd * 12, z, 9, 8.6, h, cols[k++ % cols.length], 60 + k, false);
    // boarded ground-floor windows + a door
    for (const dz of [-2.4, 2.4]) mk(new THREE.PlaneGeometry(1.6, 1.4), boards, g, [sd * 7.48, 1.7, z + dz], [0, -sd * P / 2, 0], null, false);
    box(g, 0.08, 2.3, 1.2, 0x1a1612, [sd * 7.47, 1.15, z], { noShadow: true });
  }
  // broken / dark street lamps (two still work: oldSt.flicker)
  const bulbs = [];
  for (const [x, z] of [[-5.6, 4], [5.6, -10], [-5.6, -18], [5.6, 12], [5.6, -26]]) {
    const m = mat(0x2c3036, { r: 0.5, m: 0.5 });
    mk(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 10), m, g, [x, 2.2, z]);
    mk(new THREE.BoxGeometry(1.1, 0.08, 0.08), m, g, [x + (x < 0 ? 0.5 : -0.5), 4.35, z]);
    const lit = (x === -5.6 && z === 4) || (x === 5.6 && z === -10);
    bulbs.push(mk(new THREE.BoxGeometry(0.4, 0.12, 0.3), lit ? mat(0xffe0b0, { e: 0xffb060, ei: 1.6 }).clone() : mat(0x3a3a3a), g, [x + (x < 0 ? 1.0 : -1.0), 4.27, z]));
  }
  // junk: barrels, tires, crates, a wrecked car, a fence at the far end
  barrel(g, -4.4, -6, 0x5a3a2a); barrel(g, -4.0, -6.8, 0x3a4a5a, true); barrel(g, 4.3, 3, 0x4a5a3a);
  for (const [x, z] of [[4.6, -16], [4.3, -16.6]]) mk(new THREE.TorusGeometry(0.32, 0.12, 8, 16), mat(0x101010, { r: 0.8 }), g, [x, 0.12, z], [P / 2, 0, 0]);
  crate(g, -4.6, 9, 0.9, 0.3); crate(g, -4.4, 10.1, 0.7, -0.2);
  const wreck = grp(g, 3.3, 0, 8); wreck.rotation.y = 0.25;
  const rust = mat(0x6a3a22, { r: 0.85, m: 0.2 });
  box(wreck, 1.9, 0.7, 4.0, 0, [0, 0.55, 0], { material: rust, round: 0.15 });
  box(wreck, 1.7, 0.55, 2.0, 0, [0, 1.15, -0.3], { material: mat(0x2a2c30, { r: 0.4 }), round: 0.12 });
  for (const [x, z] of [[0.9, 1.3], [-0.9, 1.3], [0.9, -1.3]]) mk(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 14), mat(0x111111), wreck, [x, 0.3, z], [0, 0, P / 2]);
  const fence = mat(0x6a6e74, { m: 0.6, r: 0.4 });
  for (let x = -5; x <= 5; x += 2.5) mk(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), fence, g, [x, 1.2, -32]);
  mk(new THREE.PlaneGeometry(10, 2.2), new THREE.MeshStandardMaterial({ color: 0x8a8e94, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, wireframe: false }), g, [0, 1.2, -32], [0, 0, 0], null, false);
  // the clay pile the security camera saw (scene 4), outside the building on the right
  // (the creature's own mound handles that; nothing extra here)
  // night sky
  mk(new THREE.SphereGeometry(120, 24, 12), new THREE.MeshBasicMaterial({ map: TX.skyTex('#02040e', '#0a1430', '#141c3a'), side: THREE.BackSide, fog: false }), g, [0, 0, 0], [0, 0, 0], null, false);
  return {
    name: 'oldStreet', group: g, bg: new THREE.Color(0x05070f), fog: [0x0a0e1c, 16, 52], exposure: 1.45,
    update(t, X) {
      const v = X.val;
      const fl = v('oldSt.flicker', 1);
      const on = fl < 0.5 || hash(Math.floor(t * 9) + 3) > 0.15;
      lamps[1].intensity = 30 * (on ? 1 : 0.1);
      bulbs[1].material.emissiveIntensity = on ? 1.6 : 0.1;
    },
  };
}

// ------------------------------------------------------------------ WAREHOUSE (inside)
// Floor x -12..12, z -14..10; big door at the front (z 10) open between x -3..3. Loot pile at (0, -10).
export function buildWarehouse() {
  const g = new THREE.Group();
  g.add(new THREE.HemisphereLight(0x5a6a8a, 0x15120e, 0.75));
  const lamps = [];
  for (const [x, z] of [[-6, -6], [6, -6], [-6, 4], [6, 4], [0, -10]]) {
    const l = new THREE.PointLight(0xffc888, 26, 14, 1.3); l.position.set(x, 6.2, z); g.add(l); lamps.push(l);
    mk(new THREE.CylinderGeometry(0.01, 0.01, 2.2, 4), mat(0x222222), g, [x, 7.9, z]);
    mk(new THREE.ConeGeometry(0.45, 0.35, 16, 1, true), mat(0x2a3a2a, { m: 0.5, side: THREE.DoubleSide }), g, [x, 6.65, z], [P, 0, 0]);
    mk(new THREE.SphereGeometry(0.12, 10, 8), mat(0xfff0c0, { e: 0xffd890, ei: 2 }), g, [x, 6.5, z]);
  }
  const moonShaft = new THREE.DirectionalLight(0x8aa0ff, 0.6); moonShaft.position.set(-10, 16, 4); moonShaft.castShadow = true; moonShaft.shadow.mapSize.set(1024, 1024);
  Object.assign(moonShaft.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 }); g.add(moonShaft);
  const floor = new THREE.MeshStandardMaterial({ map: concrete(21, '#6a665e', [5, 5], 12), roughness: 0.8 });
  plane(g, 24, 24, floor, [0, 0, -2]);
  const wall = new THREE.MeshStandardMaterial({ map: corrugatedTex('#4a5058', [10, 1]), roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide });
  box(g, 0.3, 9, 24, 0, [-12.15, 4.5, -2], { material: wall, noShadow: true }); box(g, 0.3, 9, 24, 0, [12.15, 4.5, -2], { material: wall, noShadow: true });
  box(g, 24.6, 9, 0.3, 0, [0, 4.5, -14.15], { material: wall, noShadow: true });
  box(g, 9, 9, 0.3, 0, [-7.5, 4.5, 10.15], { material: wall, noShadow: true }); box(g, 9, 9, 0.3, 0, [7.5, 4.5, 10.15], { material: wall, noShadow: true });
  box(g, 6, 4.4, 0.3, 0, [0, 6.8, 10.15], { material: wall, noShadow: true });
  // half-open sliding door panel
  box(g, 3.2, 4.6, 0.14, 0x5a3a2a, [3.6, 2.3, 10.4], { r: 0.7 });
  // roof + trusses + columns
  plane(g, 24.6, 24.6, mat(0x2a2e34, { side: THREE.DoubleSide }), [0, 9, -2], [P / 2, 0, 0], false);
  const steelM = mat(0x3a4048, { m: 0.6, r: 0.45 });
  for (let z = -12; z <= 8; z += 5) { box(g, 24, 0.3, 0.2, 0, [0, 8.6, z], { material: steelM, noShadow: true }); for (let x = -10; x <= 10; x += 4) box(g, 0.08, 1.2, 0.08, 0, [x, 8.0, z], { material: steelM, rot: [0, 0, 0.6], noShadow: true }); }
  for (const x of [-8, 8]) for (const z of [-9, -1, 7]) box(g, 0.35, 9, 0.35, 0, [x, 4.5, z], { material: mat(0x7a2a1e, { r: 0.6, m: 0.3 }) });
  // high windows with moonlight shafts
  const shaftM = new THREE.MeshBasicMaterial({ color: 0x8aa8ff, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const z of [-9, -3, 3]) {
    mk(new THREE.PlaneGeometry(2.4, 1.4), mat(0x9ab0e0, { e: 0x5a70b0, ei: 0.8 }), g, [-11.98, 7.2, z], [0, P / 2, 0], null, false);
    const sh = mk(new THREE.BoxGeometry(2.2, 9, 1.3), shaftM, g, [-8.2, 3.7, z], [0, 0, -0.62], null, false); sh.castShadow = false;
  }
  // crates, pallets, barrels along the walls
  for (const [x, z, s, ry] of [[-10.6, -12.2, 1.4, 0.1], [-9.2, -12.4, 1.2, -0.2], [-10.4, -10.6, 1.2, 0.3], [-10.6, -12.2, 1.0, 0.5, 1.4], [10.4, -12, 1.5, -0.1], [10.6, -9.8, 1.2, 0.2], [10.5, 6.4, 1.3, 0], [9.0, 7.4, 1.0, 0.4], [-10.5, 6.6, 1.2, 0.1], [-10.6, 2.0, 1.0, 0.2]]) crate(g, x, z, s, ry);
  crate(g, -10.6, -12.2, 1.0, 0.5, 1.4);
  for (const [x, z, c] of [[10.8, -4, 0x3a5a7a], [10.6, -3.2, 0x7a3a2a], [-10.8, -5.5, 0x4a5a3a]]) barrel(g, x, z, c);
  for (const [x, z] of [[-6, 8.4], [7, -12.6]]) box(g, 1.4, 0.16, 1.2, 0x8a6a42, [x, 0.08, z], { r: 0.9 });
  // the stolen loot on a platform at the back
  const lootP = grp(g, 0, 0, -11);
  box(lootP, 4.4, 0.3, 2.4, 0x4a3a2a, [0, 0.15, 0], { r: 0.8 });
  goldStack(lootP, -1.2, 0.2, 3).position.y = 0.3; goldStack(lootP, 1.3, -0.4, 2).position.y = 0.3;
  moneyBag(lootP, 0.1, 0.3, 0.5, 1.0, 0.4); moneyBag(lootP, -0.4, 0.3, -0.6, 1.1); moneyBag(lootP, 1.6, 0.3, 0.6, 0.9, -0.5); moneyBag(lootP, -1.9, 0.3, -0.7, 0.8);
  const frame = grp(lootP, 0.3, 0.3, -0.9); frame.rotation.x = -0.15;
  box(frame, 1.5, 1.15, 0.08, 0xc8a040, [0, 0.62, 0], { m: 0.7, r: 0.3 });
  mk(new THREE.PlaneGeometry(1.3, 0.95), new THREE.MeshStandardMaterial({ map: paintingTex(), roughness: 0.8 }), frame, [0, 0.62, 0.045], [0, 0, 0], null, false);
  const trophy = grp(lootP, -1.0, 0.3, 0.8);
  const gold = mat(0xffcf4a, { m: 0.85, r: 0.25, e: 0x3a2400, ei: 0.4 });
  mk(new THREE.CylinderGeometry(0.14, 0.18, 0.12, 14), mat(0x2a2a2a), trophy, [0, 0.06, 0]);
  mk(new THREE.CylinderGeometry(0.03, 0.05, 0.25, 10), gold, trophy, [0, 0.24, 0]);
  mk(new THREE.SphereGeometry(0.17, 16, 10, 0, P * 2, 0, P / 2), gold, trophy, [0, 0.38, 0], [P, 0, 0]);
  mk(new THREE.OctahedronGeometry(0.2, 0), mat(0x6af0ff, { e: 0x2ab0ff, ei: 0.8, r: 0.1, m: 0.3 }), lootP, [1.4, 0.65, -0.5]);
  const lootLight = new THREE.PointLight(0xffd070, 4, 4, 1.5); lootLight.position.set(0, 1.4, -10); g.add(lootLight);
  return {
    name: 'warehouse', group: g, bg: new THREE.Color(0x05060a), fog: [0x0c0e14, 16, 40], exposure: 1.3,
    update(t, X) {
      const v = X.val;
      const heat = v('wh.heat', 0);
      for (const l of lamps) l.intensity = 26 * (1 - 0.15 * heat * (0.5 + 0.5 * Math.sin(t * 9)));
    },
  };
}

// ------------------------------------------------------------------ POLICE CAR (hollow cabin so someone can sit inside)
export function buildPoliceCar() {
  const g = new THREE.Group();
  const black = mat(0x15171c, { r: 0.3, m: 0.4 }), white = mat(0xf2f2f2, { r: 0.3, m: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ab0c8, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.5, depthWrite: false, side: THREE.DoubleSide });
  // lower body as a shell: floor, sides, hood, trunk
  box(g, 4.5, 0.12, 1.9, 0, [0, 0.42, 0], { material: black });
  for (const sd of [1, -1]) {
    box(g, 4.5, 0.62, 0.1, 0, [0, 0.78, sd * 0.92], { material: black, round: 0.04 });
    box(g, 1.5, 0.5, 0.11, 0, [-0.2, 0.84, sd * 0.925], { material: white });
  }
  box(g, 1.25, 0.64, 1.94, 0, [1.65, 0.78, 0], { material: black, round: 0.12 });
  box(g, 0.9, 0.64, 1.94, 0, [-1.8, 0.78, 0], { material: black, round: 0.12 });
  box(g, 1.2, 0.04, 1.9, 0, [1.65, 1.11, 0], { material: white });
  // cabin: roof, pillars, glass
  box(g, 2.2, 0.08, 1.78, 0, [-0.25, 1.78, 0], { material: white, round: 0.03 });
  for (const sd of [1, -1]) for (const x of [0.85, -0.25, -1.35]) box(g, 0.08, 0.7, 0.06, 0, [x, 1.43, sd * 0.86], { material: black });
  for (const sd of [1, -1]) mk(new THREE.PlaneGeometry(2.2, 0.66), glass, g, [-0.25, 1.43, sd * 0.875], [0, sd > 0 ? 0 : P, 0], null, false);
  mk(new THREE.PlaneGeometry(1.78, 0.72), glass, g, [0.95, 1.44, 0], [0, P / 2, -0.35], null, false);
  mk(new THREE.PlaneGeometry(1.78, 0.62), glass, g, [-1.45, 1.42, 0], [0, -P / 2, 0.4], null, false);
  // seats + cage between front and back
  const seat = mat(0x22242a, { r: 0.8 });
  box(g, 0.55, 0.3, 1.6, 0, [-0.85, 0.62, 0], { material: seat }); box(g, 0.15, 0.65, 1.6, 0, [-1.15, 1.0, 0], { material: seat });
  for (const z of [0.42, -0.42]) { box(g, 0.5, 0.25, 0.65, 0, [0.4, 0.6, z], { material: seat }); box(g, 0.12, 0.6, 0.65, 0, [0.15, 0.95, z], { material: seat }); }
  mk(new THREE.PlaneGeometry(1.7, 0.6), new THREE.MeshStandardMaterial({ color: 0x333333, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }), g, [-0.45, 1.35, 0], [0, P / 2, 0], null, false);
  // light bar
  const red = mat(0xff2a2a, { e: 0xff1010, ei: 0.3 }).clone(), blue = mat(0x2a6aff, { e: 0x1050ff, ei: 0.3 }).clone();
  box(g, 0.3, 0.12, 1.3, 0x222222, [-0.25, 1.88, 0]);
  box(g, 0.28, 0.13, 0.6, 0, [-0.25, 1.89, 0.33], { material: red }); box(g, 0.28, 0.13, 0.6, 0, [-0.25, 1.89, -0.33], { material: blue });
  // POLICE text
  const txt = new THREE.MeshBasicMaterial({ map: TX.signTex('POLICE', '#f2f2f2', '#15171c', 512, 128), transparent: false });
  for (const sd of [1, -1]) mk(new THREE.PlaneGeometry(1.2, 0.3), txt, g, [-0.2, 0.84, sd * 0.985], [0, sd > 0 ? 0 : P, 0], null, false);
  for (const [x, z] of [[1.45, 0.92], [-1.45, 0.92], [1.45, -0.92], [-1.45, -0.92]]) {
    mk(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18), mat(0x0c0c0e), g, [x, 0.36, z], [P / 2, 0, 0]);
    mk(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 12), mat(0xc0c4cc, { m: 0.8, r: 0.3 }), g, [x, 0.36, z], [P / 2, 0, 0]);
  }
  for (const z of [0.6, -0.6]) { mk(new THREE.BoxGeometry(0.05, 0.14, 0.38), mat(0xffffee, { e: 0xffffcc, ei: 1.2 }), g, [2.28, 0.82, z]); mk(new THREE.BoxGeometry(0.05, 0.12, 0.36), mat(0xff3030, { e: 0xff2020, ei: 0.9 }), g, [-2.27, 0.84, z]); }
  const lr = new THREE.PointLight(0xff2a2a, 0, 9, 1.5), lb = new THREE.PointLight(0x2a6aff, 0, 9, 1.5);
  lr.position.set(-0.25, 2.2, 0.6); lb.position.set(-0.25, 2.2, -0.6); g.add(lr); g.add(lb);
  const dome = new THREE.PointLight(0xffe8c8, 0, 2.6, 1.5); dome.position.set(-0.6, 1.62, 0.3); g.add(dome);
  return {
    root: g,
    update(t, on, phase = 0, domeOn = 0) {
      dome.intensity = domeOn * 2.2;
      const a = on > 0.5 ? (Math.sin((t + phase) * 9) > 0 ? 1 : 0) : 0, b = on > 0.5 ? 1 - a : 0;
      red.emissiveIntensity = 0.3 + a * 3.5; blue.emissiveIntensity = 0.3 + b * 3.5;
      lr.intensity = a * 14; lb.intensity = b * 14;
    },
  };
}

// ------------------------------------------------------------------ WAREHOUSE (outside, police arrive)
// Warehouse wall along x at z = 0 facing +z, big door x -3..3. Lot in front (z 0..24).
export function buildWarehouseExt() {
  const g = new THREE.Group();
  g.add(new THREE.HemisphereLight(0x5a6a9a, 0x121218, 1.35));
  const flood = new THREE.SpotLight(0xffe0b8, 120, 30, 0.9, 0.6, 1.2); flood.position.set(-6, 8.5, 1.2); flood.target.position.set(0, 0, 6); g.add(flood); g.add(flood.target);
  const moon = new THREE.DirectionalLight(0x9aaaff, 1.1); moon.position.set(-8, 20, 14); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 }); g.add(moon);
  const wallLamp = new THREE.PointLight(0xffc888, 26, 14, 1.3); wallLamp.position.set(0, 6.2, 1.5); g.add(wallLamp);
  plane(g, 70, 50, new THREE.MeshStandardMaterial({ map: concrete(31, '#34363c', [8, 6], 16), roughness: 0.75 }), [0, 0, 12]);
  const wall = new THREE.MeshStandardMaterial({ map: corrugatedTex('#4a5058', [14, 1]), roughness: 0.6, metalness: 0.3 });
  box(g, 13, 9, 0.4, 0, [-9.5, 4.5, -0.2], { material: wall }); box(g, 13, 9, 0.4, 0, [9.5, 4.5, -0.2], { material: wall });
  box(g, 6, 4.4, 0.4, 0, [0, 6.8, -0.2], { material: wall });
  box(g, 32, 0.4, 20, 0x2a2e34, [0, 9.1, -10]);
  box(g, 0.4, 9, 20, 0, [-16, 4.5, -10], { material: wall }); box(g, 0.4, 9, 20, 0, [16, 4.5, -10], { material: wall });
  plane(g, 6, 4.6, mat(0x050608), [0, 2.3, -1.5], [0, 0, 0], false);
  box(g, 3.2, 4.6, 0.14, 0x5a3a2a, [3.6, 2.3, 0.15], { r: 0.7 });
  box(g, 0.9, 0.12, 0.5, 0x2a2a30, [0, 6.4, 0.3], { m: 0.6 });
  mk(new THREE.SphereGeometry(0.14, 10, 8), mat(0xfff0c0, { e: 0xffd890, ei: 2 }), g, [0, 6.3, 0.45]);
  const sign = TX.signTex('WAREHOUSE 9', '#3a3e44', '#d8d8d8', 512, 96);
  mk(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.8 }), g, [-8, 6.8, 0.02], [0, 0, 0], null, false);
  // fence + lamp posts
  const fence = mat(0x6a6e74, { m: 0.6, r: 0.4 });
  for (let x = -20; x <= 20; x += 2.5) mk(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), fence, g, [x, 1.1, 25]);
  for (const x of [-20, 20]) for (let z = 0; z <= 25; z += 2.5) mk(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), fence, g, [x, 1.1, z]);
  // police cars + the horse trailer
  const cars = [buildPoliceCar(), buildPoliceCar()];
  cars[0].root.position.set(-4.5, 0, 7.5); cars[0].root.rotation.y = 0.35;
  cars[1].root.position.set(5.0, 0, 8.5); cars[1].root.rotation.y = P - 0.5;
  for (const c of cars) g.add(c.root);
  const trailer = grp(g, 11.5, 0, 4.5); trailer.rotation.y = -0.3;
  box(trailer, 2.0, 2.2, 4.2, 0x8a8e94, [0, 1.5, 0], { m: 0.4, r: 0.4, round: 0.1 });
  box(trailer, 1.9, 0.08, 2.2, 0x5a5e64, [0, 0.4, 2.9], { rot: [-0.32, 0, 0] });
  for (const z of [0.9, -0.9]) for (const sd of [1, -1]) mk(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14), mat(0x101010), trailer, [sd * 1.05, 0.34, z], [0, 0, P / 2]);
  mk(new THREE.SphereGeometry(120, 24, 12), new THREE.MeshBasicMaterial({ map: TX.skyTex('#02040e', '#0a1430', '#141c3a'), side: THREE.BackSide, fog: false }), g, [0, 0, 0], [0, 0, 0], null, false);
  return {
    name: 'whExt', group: g, bg: new THREE.Color(0x05070f), fog: [0x0a0e1c, 20, 60], exposure: 1.45, cars,
    update(t, X) {
      const v = X.val;
      cars.forEach((c, i) => {
        c.root.visible = v(`pcar${i}.vis`, 1) > 0.5;
        c.root.position.x = v(`pcar${i}.x`, i ? 5.0 : -4.5); c.root.position.z = v(`pcar${i}.z`, i ? 8.5 : 7.5); c.root.rotation.y = v(`pcar${i}.ry`, i ? P - 0.5 : 0.35);
        c.update(t, v('police.lights', 1), i * 0.17, v(`pcar${i}.dome`, 0));
      });
    },
  };
}

// ------------------------------------------------------------------ BIRDS
// Eric's bird form (green, with his brown tuft) and plain park pigeons.
export function buildBird(o = {}) {
  const root = new THREE.Group();
  const body = grp(root, 0, 0.12, 0);
  const bodyM = mat(o.body ?? 0x3fbf5f, { r: 0.6 }), wingM = mat(o.wing ?? 0x2a9a48, { r: 0.6 }), bellyM = mat(o.belly ?? 0xf2e08a, { r: 0.7 });
  mk(new THREE.SphereGeometry(0.1, 16, 12), bodyM, body, [0, 0, 0], [0, 0, 0], [0.9, 0.85, 1.25]);
  mk(new THREE.SphereGeometry(0.08, 14, 10), bellyM, body, [0, -0.025, 0.035], [0, 0, 0], [0.85, 0.8, 1.1]);
  const head = grp(body, 0, 0.08, 0.09);
  mk(new THREE.SphereGeometry(0.068, 16, 12), bodyM, head, [0, 0, 0]);
  mk(new THREE.ConeGeometry(0.022, 0.07, 8), mat(o.beak ?? 0xffa020, { r: 0.4 }), head, [0, -0.008, 0.08], [P / 2, 0, 0]);
  for (const sd of [1, -1]) {
    mk(new THREE.SphereGeometry(0.02, 10, 8), mat(0xffffff, { r: 0.3 }), head, [sd * 0.038, 0.02, 0.05]);
    mk(new THREE.SphereGeometry(0.011, 8, 6), mat(0x101010, { r: 0.2 }), head, [sd * 0.044, 0.022, 0.064]);
  }
  if (o.tuft) for (let i = 0; i < 4; i++) mk(new THREE.ConeGeometry(0.016, 0.06, 6), mat(o.tuft, { r: 0.7 }), head, [(i - 1.5) * 0.015, 0.07, -0.005 - i * 0.008], [-0.4 - i * 0.15, 0, (i - 1.5) * 0.25]);
  const wings = [];
  for (const sd of [1, -1]) {
    const w = grp(body, sd * 0.07, 0.03, 0.0);
    mk(new THREE.SphereGeometry(0.08, 12, 8), wingM, w, [sd * 0.07, 0, -0.02], [0, 0, 0], [1.1, 0.18, 0.8]);
    mk(new THREE.SphereGeometry(0.06, 10, 6), wingM, w, [sd * 0.15, 0, -0.04], [0, 0, 0], [0.9, 0.14, 0.6]);
    wings.push({ w, sd });
  }
  const tail = grp(body, 0, 0.0, -0.11);
  mk(new THREE.BoxGeometry(0.08, 0.012, 0.09), wingM, tail, [0, 0, -0.04], [0.2, 0, 0]);
  const legs = [];
  for (const sd of [1, -1]) { const l = grp(body, sd * 0.03, -0.07, 0.01); mk(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 5), mat(o.beak ?? 0xffa020), l, [0, -0.03, 0]); legs.push(l); }
  root.scale.setScalar(o.scale ?? 1);
  return {
    root, head,
    update({ t, act = 'perch', a = 0, speed = 0, seed = 0 }) {
      const flying = act === 'fly' || act === 'glide' || act === 'takeoff';
      const flap = act === 'fly' || act === 'takeoff' ? Math.sin(t * 26 + seed) : act === 'glide' ? 0.15 * Math.sin(t * 3) : 0;
      for (const { w, sd } of wings) { w.rotation.z = sd * (flying ? 0.9 * flap + 0.1 : -0.05); w.rotation.y = flying ? 0 : sd * 0.15; }
      body.rotation.x = flying ? -0.25 : 0;
      for (const l of legs) l.rotation.x = flying ? 1.2 : 0;
      body.position.y = 0.12 + (flying ? 0.02 * flap : 0);
      tail.rotation.x = flying ? -0.2 : 0.25 + 0.05 * Math.sin(t * 3 + seed);
      let hn = 0, hy = 0;
      if (act === 'perch') { hy = 0.6 * Math.sin(Math.floor((t + seed) * 0.8) * 2.3); hn = 0.05 * Math.sin(t * 2); }
      if (act === 'peck') { const k = Math.max(0, Math.sin((t + seed) * 5)); hn = 0.9 * k * k; body.rotation.x = 0.35 * k; }
      if (act === 'hop') { body.position.y = 0.12 + Math.abs(Math.sin((t + seed) * 7)) * 0.05; }
      if (act === 'look') { hn = -0.2; hy = 0.2 * Math.sin(t * 1.3); }
      if (act === 'shock') { hn = -0.35; body.position.y = 0.12 + 0.03 * Math.abs(Math.sin(a * 20)) * Math.max(0, 1 - a); for (const { w, sd } of wings) w.rotation.z = sd * 0.8; }
      head.rotation.set(hn, hy, 0);
    },
  };
}

// ------------------------------------------------------------------ CLAY CREATURE EXTRAS
// Per creature: a clay mound it rises out of, chunks it breaks into, and the puddle it melts into.
export function buildClayBits(color = 0x8a6a4e) {
  const root = new THREE.Group();
  const cm = mat(color, { r: 0.9 }), wet = mat(color, { r: 0.25, m: 0.1 });
  const mound = grp(root);
  mk(new THREE.SphereGeometry(0.55, 18, 10, 0, P * 2, 0, P / 2), cm, mound, [0, 0, 0], [0, 0, 0], [1, 0.6, 1]);
  for (let i = 0; i < 6; i++) { const a = i * 1.1; mk(new THREE.SphereGeometry(0.16 + hash(i) * 0.1, 10, 8), cm, mound, [Math.cos(a) * 0.42, 0.06, Math.sin(a) * 0.42]); }
  const chunks = [];
  const base = [[0, 1.5, 0], [0, 1.15, 0.02], [0, 0.95, 0], [0.24, 1.2, 0], [-0.24, 1.2, 0], [0.3, 0.9, 0.05], [-0.3, 0.9, 0.05], [0.1, 0.6, 0], [-0.1, 0.6, 0], [0.1, 0.25, 0], [-0.1, 0.25, 0], [0, 1.3, -0.08]];
  base.forEach((b, i) => {
    const s = i === 0 ? 0.17 : 0.09 + hash(i * 3.3) * 0.06;
    const m = mk(new THREE.DodecahedronGeometry(s, 0), cm, root, [0, 0, 0]);
    const a = hash(i * 7.1) * P * 2, r = 0.35 + hash(i * 2.3) * 0.75;
    chunks.push({ m, b, tgt: [Math.cos(a) * r, s * 0.6, Math.sin(a) * r], spin: hash(i * 5.5) * 6 });
  });
  const puddle = mk(new THREE.CylinderGeometry(0.6, 0.68, 0.06, 26), wet, root, [0, 0.03, 0]);
  puddle.receiveShadow = true;
  for (let i = 0; i < 4; i++) mk(new THREE.SphereGeometry(0.12, 10, 6), wet, puddle, [Math.cos(i * 1.7) * 0.4, 0.02, Math.sin(i * 1.7) * 0.4], [0, 0, 0], [1.4, 0.35, 1]);
  return {
    root,
    update({ x, z, ry, mound: mk2 = 0, crumble = 0, melt = 0, t = 0 }) {
      root.position.set(x, 0, z); root.rotation.y = ry;
      mound.visible = mk2 > 0.01; mound.scale.setScalar(Math.max(0.01, mk2)); mound.rotation.y = t * 0.1;
      const c = smoothstep(0, 1, clamp(crumble));
      for (const ch of chunks) {
        ch.m.visible = crumble > 0.02;
        if (!ch.m.visible) continue;
        ch.m.position.set(lerp(ch.b[0], ch.tgt[0], c), lerp(ch.b[1], ch.tgt[1], c) + Math.sin(c * P) * 0.35, lerp(ch.b[2], ch.tgt[2], c));
        ch.m.rotation.set(c * ch.spin, c * ch.spin * 0.7, 0);
      }
      puddle.visible = melt > 0.02;
      puddle.scale.set(0.3 + melt * 1.0, 1, 0.3 + melt * 1.0);
    },
  };
}
