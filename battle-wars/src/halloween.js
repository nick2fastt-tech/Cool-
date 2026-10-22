// Episode 4 (Halloween) locations: the bedroom, the Halloween store, Newark's house (outside) and the party room.
// Plus shared decorations (jack-o'-lanterns, webs, string lights, ghosts) and costumed background guests.
import * as THREE from 'three';
import { mat, mk, grp, rng, canvasTex, clamp, smoothstep, lerp, noise1, roundRect } from './util.js';
import * as TX from './textures.js';
import { lights, box, plane, streetLamp, tree } from './sets.js';
import { buildHero, ACTIONS, EXPRESSIONS, pose, blendPose } from './characters.js';

const P = Math.PI;

// ------------------------------------------------------------------ textures
function webTex() {
  return canvasTex(256, 256, (ctx, w) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
    const n = 9, cx = 0, cy = 0;
    for (let i = 0; i <= n; i++) { const a = (i / n) * P / 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(Math.cos(a) * w * 1.1, Math.sin(a) * w * 1.1); ctx.stroke(); }
    ctx.lineWidth = 1.4;
    for (let r = 30; r < w; r += 28) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) { const a = (i / n) * P / 2; const rr = r + 6 * Math.sin(i * 2.1 + r); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? ctx.quadraticCurveTo((x + Math.cos(a - 0.1) * rr * 0.96) / 2 + x / 2 - x / 2, y, x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
  });
}
function pumpkinFaceTex(seed = 1) {
  return canvasTex(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffe060';
    const R = rng(seed);
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(64 + sx * 18, 38); ctx.lineTo(64 + sx * 34, 62); ctx.lineTo(64 + sx * 6, 62); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(72, 78); ctx.lineTo(56, 78); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, 86);
    for (let i = 0; i <= 8; i++) ctx.lineTo(24 + i * 10, i % 2 ? 98 + R() * 4 : 86);
    ctx.lineTo(104, 104); ctx.quadraticCurveTo(64, 124, 24, 104); ctx.closePath(); ctx.fill();
  });
}
function clockTex() {
  const tex = canvasTex(256, 128, () => {});
  const { ctx } = tex.userData;
  tex.draw = (on) => {
    ctx.fillStyle = '#0b0b10'; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = on ? '#ff3030' : '#5a1010';
    ctx.shadowColor = '#ff2020'; ctx.shadowBlur = on ? 16 : 0;
    ctx.font = `bold 92px ${TX.UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('8:00', 112, 66);
    ctx.font = `bold 30px ${TX.UI_FONT}`; ctx.fillText('AM', 222, 92);
    ctx.shadowBlur = 0; tex.needsUpdate = true;
  };
  tex.draw(true);
  return tex;
}
function boxArtTex(title, c1, c2, fg = '#fff') {
  return canvasTex(128, 192, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg; ctx.font = `30px ${TX.FONT}`; ctx.textAlign = 'center';
    title.split('\n').forEach((l, i) => ctx.fillText(l, w / 2, 50 + i * 34));
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(w / 2, h * 0.72, 26, 0, 7); ctx.fill();
  });
}
function bannerTex(text, bg, fg, w = 1024, h = 160) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 64) { ctx.fillStyle = i % 128 ? '#ff8a1a' : '#8a3ad0'; ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 64, 0); ctx.lineTo(i + 32, 24); ctx.fill(); }
    ctx.fillStyle = fg; ctx.font = `${h * 0.5}px ${TX.FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff8a1a'; ctx.shadowBlur = 18; ctx.fillText(text, w / 2, h * 0.6);
  });
}

// ------------------------------------------------------------------ decorations
const ORANGE = 0xff8a1a, PURPLE = 0x9a4ae0;
export function jackOLantern(g, x, y, z, s = 1, ry = 0, seed = 1) {
  const p = grp(g, x, y, z); p.rotation.y = ry; p.scale.setScalar(s);
  const skin = mat(0xff7a14, { r: 0.6 });
  for (let i = 0; i < 7; i++) { const a = (i / 7) * P * 2; mk(new THREE.SphereGeometry(0.16, 14, 10), skin, p, [Math.sin(a) * 0.09, 0.17, Math.cos(a) * 0.09], [0, a, 0], [0.62, 0.9, 1]); }
  const face = mk(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshBasicMaterial({ map: pumpkinFaceTex(seed), transparent: true }), p, [0, 0.17, 0.215], [0, 0, 0], null, false);
  face.material.alphaTest = 0;
  mk(new THREE.SphereGeometry(0.11, 10, 8), mat(0xffd040, { e: 0xffa020, ei: 1.4 }), p, [0, 0.17, 0.11]);
  mk(new THREE.CylinderGeometry(0.02, 0.03, 0.08, 6), mat(0x3a6a2a), p, [0, 0.36, 0], [0.2, 0, 0.1]);
  return p;
}
function plainPumpkin(g, x, y, z, s = 1) {
  const p = grp(g, x, y, z); p.scale.setScalar(s);
  const skin = mat(0xff7a14, { r: 0.6 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * P * 2; mk(new THREE.SphereGeometry(0.15, 12, 8), skin, p, [Math.sin(a) * 0.08, 0.15, Math.cos(a) * 0.08], [0, a, 0], [0.62, 0.9, 1]); }
  mk(new THREE.CylinderGeometry(0.02, 0.03, 0.07, 6), mat(0x3a6a2a), p, [0, 0.32, 0]);
  return p;
}
const WEB = { tex: null };
function web(g, pos, rot, size = 1.2) {
  WEB.tex ||= webTex();
  return mk(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: WEB.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }), g, pos, rot, null, false);
}
// bulbs strung between points; returns the materials so the set can twinkle them
function stringLights(g, pts, colors = [ORANGE, PURPLE], sag = 0.18, per = 1) {
  const mats = colors.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, roughness: 0.4 }));
  const wire = mat(0x101010);
  const bulb = new THREE.SphereGeometry(0.045, 8, 6);
  let k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
    const n = Math.max(3, Math.round(a.distanceTo(b) * 2.2 * per));
    for (let j = 0; j <= n; j++) {
      const u = j / n, p = a.clone().lerp(b, u); p.y -= Math.sin(u * P) * sag;
      mk(bulb, mats[k++ % mats.length], g, [p.x, p.y, p.z], [0, 0, 0], null, false);
    }
    const mid = a.clone().lerp(b, 0.5); mid.y -= sag * 0.9;
    const len = a.distanceTo(b);
    const w = mk(new THREE.CylinderGeometry(0.006, 0.006, len, 4), wire, g, [mid.x, mid.y, mid.z], [0, 0, 0], null, false);
    w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  return mats;
}
function inflatableGhost(g, x, y, z, s = 1) {
  const p = grp(g, x, y, z); p.scale.setScalar(s);
  const w = mat(0xf6f6fb, { r: 0.5 });
  mk(new THREE.SphereGeometry(0.45, 22, 16), w, p, [0, 0.45, 0], [0, 0, 0], [1, 1.1, 0.9]);
  mk(new THREE.CylinderGeometry(0.44, 0.55, 0.6, 20, 1, true), mat(0xf6f6fb, { r: 0.5, side: THREE.DoubleSide }), p, [0, 0.05, 0], [0, 0, 0], [1, 1, 0.85]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * P * 2; mk(new THREE.SphereGeometry(0.13, 10, 8), w, p, [Math.sin(a) * 0.46, -0.25, Math.cos(a) * 0.4]); }
  for (const sd of [1, -1]) { mk(new THREE.SphereGeometry(0.15, 12, 8), w, p, [sd * 0.5, 0.25, 0.05], [0, 0, sd * 0.6], [0.6, 1.2, 0.6]); mk(new THREE.SphereGeometry(0.065, 10, 8), mat(0x111111), p, [sd * 0.14, 0.58, 0.36], [0, 0, 0], [0.8, 1.2, 0.5]); }
  mk(new THREE.SphereGeometry(0.08, 10, 8), mat(0x111111), p, [0, 0.36, 0.38], [0, 0, 0], [1, 1.3, 0.5]);
  return p;
}
function bat(g, x, y, z, s = 1, ry = 0) {
  const b = grp(g, x, y, z); b.rotation.y = ry; b.scale.setScalar(s);
  const m = mat(0x111116, { r: 0.7, side: THREE.DoubleSide });
  mk(new THREE.SphereGeometry(0.06, 8, 6), m, b, [0, 0, 0], [0, 0, 0], [1, 1.2, 0.8]);
  for (const sd of [1, -1]) {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.2, 0.08); shape.lineTo(0.26, -0.02); shape.lineTo(0.2, -0.03); shape.lineTo(0.15, -0.08); shape.lineTo(0.1, -0.03); shape.lineTo(0.05, -0.07); shape.closePath();
    const wing = mk(new THREE.ShapeGeometry(shape), m, b, [sd * 0.03, 0, 0], [0, sd > 0 ? 0 : P, 0], null, false);
    b.userData[sd > 0 ? 'wr' : 'wl'] = wing;
  }
  return b;
}
function gravestone(g, x, z, ry = 0, text = 'RIP') {
  const s = grp(g, x, 0, z); s.rotation.y = ry;
  const stone = mat(0x7a7f88, { r: 0.9 });
  mk(new THREE.BoxGeometry(0.7, 0.8, 0.16), stone, s, [0, 0.4, 0]);
  mk(new THREE.CylinderGeometry(0.35, 0.35, 0.16, 16, 1, false, 0, P), stone, s, [0, 0.8, 0], [P / 2, 0, P / 2]);
  mk(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: TX.signTex(text, '#7a7f88', '#2a2d33', 256, 128), roughness: 0.9 }), s, [0, 0.62, 0.081], [0, 0, 0], null, false);
  return s;
}
function balloons(g, x, y, z) {
  const b = grp(g, x, y, z);
  [[0, 0, 0, ORANGE], [0.22, 0.12, 0.05, 0x15151a], [-0.2, 0.16, -0.04, PURPLE], [0.05, 0.32, 0.08, ORANGE]].forEach(([dx, dy, dz, c]) => {
    mk(new THREE.SphereGeometry(0.17, 14, 10), mat(c, { r: 0.25 }), b, [dx, dy, dz], [0, 0, 0], [1, 1.18, 1]);
    mk(new THREE.CylinderGeometry(0.003, 0.003, 0.9, 3), mat(0xdddddd), b, [dx * 0.5, dy - 0.6, dz * 0.5], [0, 0, 0], null, false);
  });
  return b;
}

// ------------------------------------------------------------------ background guests
const GUEST_LOOKS = [
  { hair: 'wavy', hairColor: 0x2a1a10, skin: 0xe0ac86, shirt: 0x15101e, pants: 0x15101e, extras: ['witchHat'] },
  { hair: null, hairColor: 0xd0a040, skin: 0xf0c09a, shirt: 0xf4f4f8, pants: 0xf4f4f8, extras: ['ghostSheet'] },
  { hair: 'wavy', hairColor: 0x15100c, skin: 0x8a5a3c, shirt: 0x2a6a3a, pants: 0x1a1a22, extras: ['pumpkinHead'] },
  { hair: 'tall', hairColor: 0x3a2a1a, skin: 0xd8a07a, shirt: 0xb0101e, pants: 0x111114, extras: ['horns'] },
  { hair: 'wavy', hairColor: 0x8a3a1a, skin: 0xf2c4a0, shirt: 0x15151a, pants: 0x15151a, extras: ['catEars'] },
  { hair: 'spiky', hairColor: 0x15100c, skin: 0xa8734f, shirt: 0x5a3ad0, pants: 0x2a2a3a, extras: ['crown'] },
  { hair: 'wavy', hairColor: 0x4a2a14, skin: 0xe8b28c, shirt: 0x8a5a2e, pants: 0x3a5a8a, extras: ['cowboyHat'] },
  { hair: 'tall', hairColor: 0x15151a, skin: 0xc48a62, shirt: 0xff7a1a, pants: 0x111114, extras: ['witchHat'] },
  { hair: 'spiky', hairColor: 0x6a3a1e, skin: 0xe9b48f, shirt: 0x2f6a8a, pants: 0x1a1a22, extras: ['catEars'] },
  { hair: 'wavy', hairColor: 0x15100c, skin: 0x7a4a30, shirt: 0x15151a, pants: 0x15151a, extras: ['horns'] },
  { hair: 'spiky', hairColor: 0xb0b0b8, skin: 0xf0c4a0, shirt: 0x4a8a3a, pants: 0x2a2a1a, extras: ['pumpkinHead'] },
  { hair: 'wavy', hairColor: 0x5a2a10, skin: 0xd8a07a, shirt: 0x8a3ad0, pants: 0x2a1a3a, extras: ['crown'] },
  { hair: null, hairColor: 0x2a1a10, skin: 0xe0ac86, shirt: 0xf4f4f8, pants: 0xf4f4f8, extras: ['ghostSheet'] },
  { hair: 'spiky', hairColor: 0x15100c, skin: 0x9a6a48, shirt: 0x1a3a6a, pants: 0x111114, extras: ['cowboyHat'] },
];
function makeGuest(parent, i, look = GUEST_LOOKS[i % GUEST_LOOKS.length], extra = {}) {
  const h = buildHero({ name: `guest${i}`, seed: 20 + i, scale: 0.8 + 0.08 * ((i * 7) % 3), browColor: 0x1a120c, eyeColor: 0x2a1a10, casual: true, emblem: false, bareHands: true, boot: 0x1a1a1a, belt: 0x1a1a1a, skinDark: look.skin, ...look, ...extra });
  parent.add(h.root);
  return h;
}
// pose + face a background character with one of the action library moves
function animGuest(h, act, a, t, expr = 'happy') {
  const A = ACTIONS[act] ?? ACTIONS.idle;
  h.applyPose(pose(A.f(a, t, { seed: h.seed })));
  const bp = (t + h.seed * 1.37) % 4.3;
  h.applyFace(EXPRESSIONS[expr] ?? EXPRESSIONS.happy, 0, bp < 0.14 ? Math.sin((bp / 0.14) * P) : 0, { x: 0, y: 0 });
}

// ------------------------------------------------------------------ BEDROOM (Red Team HQ, morning)
export function buildBedroom() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [-1, 6, -9], target: [0, 0, 0], shadowSize: 7, sunI: 1.5, hemi: 0.85, sky: 0xfff0e0, ground: 0x6a5a4a, rimColor: 0xffd2a0, rimI: 0.6, rimPos: [4, 4, 6] });
  const fill = new THREE.PointLight(0xffe2c0, 6, 10, 1.4); fill.position.set(0, 2.8, 1.5); g.add(fill);
  plane(g, 10, 8, new THREE.MeshStandardMaterial({ map: TX.planksTex('#b88a5c', '#a87c50'), roughness: 0.75 }), [0, 0, 0.4]);
  const wall = mat(0xc9c2dc, { r: 0.9 });
  box(g, 10, 3.2, 0.2, 0, [0, 1.6, -3.6], { material: wall, noShadow: true });
  box(g, 10, 3.2, 0.2, 0, [0, 1.6, 4.4], { material: wall, noShadow: true });
  box(g, 0.2, 3.2, 8, 0, [-5, 1.6, 0.4], { material: wall, noShadow: true });
  box(g, 0.2, 3.2, 8, 0, [5, 1.6, 0.4], { material: wall, noShadow: true });
  box(g, 10, 0.1, 8, 0, [0, 3.22, 0.4], { material: mat(0xeeeaf6), noShadow: true });
  box(g, 10, 0.14, 0.06, 0x7a5a8a, [0, 0.07, -3.48], { noShadow: true });
  // window with morning light + curtains
  const win = plane(g, 1.9, 1.3, new THREE.MeshStandardMaterial({ color: 0xffe8c0, emissive: 0xffe0b0, emissiveIntensity: 1.1 }), [-0.4, 1.95, -3.49], [0, 0, 0], false);
  box(g, 2.1, 0.08, 0.1, 0xf4f0e8, [-0.4, 1.28, -3.45]);
  box(g, 0.06, 1.35, 0.06, 0xf4f0e8, [-0.4, 1.95, -3.47]);
  for (const sd of [-1, 1]) box(g, 0.5, 1.7, 0.06, 0x8a3ad0, [-0.4 + sd * 1.15, 1.9, -3.42], { round: 0.02 });
  stringLights(g, [[-1.6, 2.75, -3.42], [0.8, 2.75, -3.42]], [ORANGE, PURPLE], 0.12);
  for (const [x, y] of [[2.2, 2.4], [2.6, 2.1], [3.0, 2.5], [-2.6, 2.5], [-3.1, 2.2]]) bat(g, x, y, -3.46, 1.2, 0);
  // beds
  const bed = (x, cover) => {
    const b = grp(g, x, 0, -2.3);
    box(b, 1.25, 0.32, 2.25, 0x6a4a32, [0, 0.2, 0], { round: 0.03 });
    box(b, 1.3, 0.9, 0.12, 0x6a4a32, [0, 0.5, -1.12], { round: 0.03 });
    box(b, 1.15, 0.2, 2.1, 0xf4f2ee, [0, 0.46, 0], { round: 0.05 });
    box(b, 0.75, 0.14, 0.38, 0xffffff, [0, 0.62, -0.82], { round: 0.06 });
    const blanket = grp(b, 0, 0.86, 0.5);
    const cm = mat(cover, { r: 0.85 });
    box(blanket, 1.3, 0.07, 1.0, 0, [0, 0, 0], { material: cm, round: 0.03 });
    for (const sd of [-1, 1]) box(blanket, 0.05, 0.36, 1.0, 0, [sd * 0.64, -0.17, 0], { material: cm, round: 0.02 });
    const lump = mk(new THREE.CapsuleGeometry(0.2, 1.2, 4, 10), mat(cover, { r: 0.85 }), b, [0, 0.72, -0.25], [P / 2, 0, 0], [1.3, 1, 0.6]);
    lump.visible = false;
    return { b, blanket, lump };
  };
  const bedF = bed(-2.6, 0x3a5aa8), bedA = bed(2.45, 0xa8303a);
  // nightstand + clock + mini pumpkin
  box(g, 0.55, 0.6, 0.5, 0x6a4a32, [1.45, 0.3, -3.05], { round: 0.03 });
  const ctex = clockTex();
  const clock = grp(g, 1.38, 0.66, -3.0);
  box(clock, 0.32, 0.14, 0.14, 0x15151c, [0, 0.07, 0], { round: 0.03 });
  plane(clock, 0.28, 0.1, new THREE.MeshBasicMaterial({ map: ctex }), [0, 0.075, 0.071], [0, 0, 0], false);
  jackOLantern(g, 1.62, 0.6, -3.08, 0.32, -0.3, 3);
  box(g, 0.55, 0.6, 0.5, 0x6a4a32, [-1.3, 0.3, -3.05], { round: 0.03 });
  mk(new THREE.CylinderGeometry(0.07, 0.1, 0.25, 12), mat(0xf0e0c0), g, [-1.3, 0.72, -3.05]);
  mk(new THREE.ConeGeometry(0.15, 0.15, 14, 1, true), mat(0xffe8c0, { e: 0xffd090, ei: 0.5, side: THREE.DoubleSide }), g, [-1.3, 0.9, -3.05]);
  // mirror, dresser, door, rug, posters
  box(g, 0.08, 1.6, 0.8, 0x3a2a20, [-4.88, 1.6, 0.9]);
  plane(g, 0.7, 1.5, new THREE.MeshStandardMaterial({ color: 0xc8dcea, metalness: 0.2, roughness: 0.15, emissive: 0x6a7a8a, emissiveIntensity: 0.6 }), [-4.83, 1.6, 0.9], [0, P / 2, 0], false);
  box(g, 0.6, 0.9, 1.4, 0x6a4a32, [-4.6, 0.45, -0.7], { round: 0.03 });
  jackOLantern(g, -4.6, 0.9, -0.4, 0.35, P / 2, 5);
  box(g, 0.1, 2.3, 1.1, 0x5a3a2a, [4.9, 1.15, 1.9]);
  box(g, 0.12, 0.08, 0.08, 0xd8b040, [4.82, 1.1, 1.5], { m: 0.7 });
  mk(new THREE.CylinderGeometry(1.6, 1.6, 0.02, 30), mat(0x5a4a7a, { r: 1 }), g, [0, 0.01, 0.6], [0, 0, 0], [1.3, 1, 0.8]);
  for (const [z, t, c1, c2] of [[-1.5, 'BE READY!', '#ff8a3d', '#5a1a0a'], [1.2, 'TEAMWORK', '#c03040', '#300a10']]) mk(new THREE.PlaneGeometry(0.9, 1.25), new THREE.MeshStandardMaterial({ map: TX.posterTex(t, c1, c2), roughness: 0.8 }), g, [4.88, 1.9, z], [0, -P / 2, 0], null, false);
  web(g, [-4.88, 2.85, -3.38], [0, P / 4, 0], 0.9);
  return {
    name: 'bedroom', group: g, bg: new THREE.Color(0x101010), exposure: 1.05,
    update(t, X) {
      const v = X.val;
      const ring = v('alarm.ring', 0) > 0.5;
      ctex.draw(!ring || Math.sin(t * 12) > -0.3);
      // blankets: 0 = over the legs, 1 = pulled over the head
      for (const [k, bd] of [['flare', bedF], ['aaron', bedA]]) {
        const c = v(`blanket.${k}`, 0), off = v(`blanket.${k}.off`, 0);
        bd.blanket.scale.z = lerp(1, 1.95, c);
        bd.blanket.position.z = lerp(0.5, 0.02, c) + off * 0.4;
        bd.blanket.position.y = 0.86 + 0.08 * c;
        bd.blanket.visible = off < 0.99;
        bd.lump.visible = v(`blanket.${k}.lump`, 0) > 0.5;
      }
      win.material.emissiveIntensity = 1.1;
    },
  };
}

// ------------------------------------------------------------------ HALLOWEEN STORE
function skeletonFigure(g) {
  const sk = grp(g);
  const bone = mat(0xf2eee0, { r: 0.6 });
  const pelvis = grp(sk, 0, 0.95, 0);
  mk(new THREE.TorusGeometry(0.11, 0.035, 6, 14), bone, pelvis, [0, 0, 0], [P / 2, 0, 0], [1, 0.7, 1]);
  const spine = grp(pelvis, 0, 0.05, 0);
  mk(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), bone, spine, [0, 0.25, -0.02]);
  for (let i = 0; i < 5; i++) mk(new THREE.TorusGeometry(0.13 - Math.abs(i - 1.5) * 0.015, 0.016, 5, 16, P * 1.6), bone, spine, [0, 0.2 + i * 0.07, 0], [P / 2, 0, P * 0.7]);
  const head = grp(spine, 0, 0.6, 0);
  mk(new THREE.SphereGeometry(0.13, 16, 12), bone, head, [0, 0.08, 0], [0, 0, 0], [0.95, 1.05, 1]);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2020, emissiveIntensity: 0 });
  for (const sd of [1, -1]) mk(new THREE.SphereGeometry(0.035, 8, 6), eyeM, head, [sd * 0.045, 0.1, 0.105]);
  const jaw = grp(head, 0, 0.0, 0.02);
  mk(new THREE.BoxGeometry(0.15, 0.04, 0.1), bone, jaw, [0, -0.02, 0.04]);
  const arms = {};
  for (const sd of [1, -1]) {
    const sh = grp(spine, sd * 0.16, 0.5, 0);
    mk(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 5), bone, sh, [0, -0.15, 0]);
    const el = grp(sh, 0, -0.3, 0);
    mk(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 5), bone, el, [0, -0.14, 0]);
    mk(new THREE.SphereGeometry(0.035, 6, 5), bone, el, [0, -0.3, 0]);
    arms[sd] = { sh, el };
    const leg = grp(pelvis, sd * 0.08, -0.05, 0);
    mk(new THREE.CylinderGeometry(0.022, 0.022, 0.45, 5), bone, leg, [0, -0.22, 0]);
    mk(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 5), bone, leg, [0, -0.66, 0]);
    mk(new THREE.BoxGeometry(0.06, 0.03, 0.12), bone, leg, [0, -0.89, 0.03]);
  }
  mk(new THREE.CylinderGeometry(0.25, 0.28, 0.05, 18), mat(0x2a2a2a), sk, [0, 0.025, 0]);
  return { sk, head, jaw, arms, spine, eyeM };
}
export function buildStore() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [2, 9, 4], target: [0, 0, 0], shadowSize: 9, sunI: 1.1, hemi: 0.95, sky: 0xfff4e8, ground: 0x5a4a5a, rimColor: 0xff9a40, rimI: 0.5, rimPos: [0, 4, 8] });
  const warm = new THREE.PointLight(0xff9a40, 8, 12, 1.5); warm.position.set(-3, 3.2, 1); g.add(warm);
  const cool = new THREE.PointLight(0xb070ff, 7, 12, 1.5); cool.position.set(3.5, 3.2, -2); g.add(cool);
  plane(g, 16, 12, new THREE.MeshStandardMaterial({ map: TX.floorTex('#3a3440', '#6a5a70', 8), roughness: 0.5 }), [0, 0, 0]);
  const wall = mat(0x3a2a48, { r: 0.9 });
  box(g, 16, 4, 0.2, 0, [0, 2, -5.6], { material: wall, noShadow: true });
  box(g, 0.2, 4, 12, 0, [-7.6, 2, 0], { material: wall, noShadow: true });
  box(g, 0.2, 4, 12, 0, [7.6, 2, 0], { material: wall, noShadow: true });
  box(g, 16, 0.15, 12, 0, [0, 4.0, 0], { material: mat(0x1a1420), noShadow: true });
  // front wall with glass doors
  for (const x of [-4.8, 4.8]) box(g, 6.2, 4, 0.2, 0, [x, 2, 5.6], { material: wall, noShadow: true });
  box(g, 3.4, 1.2, 0.2, 0, [0, 3.4, 5.6], { material: wall, noShadow: true });
  for (const x of [-0.8, 0.8]) plane(g, 1.5, 2.7, new THREE.MeshStandardMaterial({ color: 0x9ac4e0, transparent: true, opacity: 0.35, roughness: 0.1, emissive: 0x2a3a5a, emissiveIntensity: 0.6 }), [x, 1.4, 5.55], [0, P, 0], false);
  // fluorescent panels
  for (const [x, z] of [[-3.5, -2], [3.5, -2], [-3.5, 2.5], [3.5, 2.5]]) box(g, 1.6, 0.06, 0.5, 0xffffff, [x, 3.93, z], { e: 0xfff4e0, ei: 1.0, noShadow: true });
  // sign
  mk(new THREE.PlaneGeometry(6, 1.0), new THREE.MeshBasicMaterial({ map: bannerTex('SPOOKY SUPPLY CO.', '#15101e', '#ffb050') }), g, [0, 3.35, -5.48], [0, 0, 0], null, false);
  // mask wall (back)
  const maskCols = [0x4a7a3a, 0xf2eee0, 0xb0101e, 0x8a3ad0, 0xff8a1a, 0x3a3a48];
  for (let i = 0; i < 12; i++) {
    const x = -5 + (i % 6) * 2.0, y = 1.4 + Math.floor(i / 6) * 0.9;
    const m = grp(g, x, y, -5.42);
    mk(new THREE.SphereGeometry(0.22, 14, 10, -P / 2, P, 0, P), mat(maskCols[i % 6], { r: 0.8 }), m, [0, 0, 0], [0, 0, 0], [1, 1.2, 0.6]);
    for (const sd of [1, -1]) mk(new THREE.CircleGeometry(0.045, 10), mat(0x111111), m, [sd * 0.08, 0.06, 0.135], [0, 0, 0], null, false);
    mk(new THREE.BoxGeometry(0.1, 0.03, 0.02), mat(0x111111), m, [0, -0.1, 0.13]);
  }
  box(g, 12.5, 0.08, 0.3, 0x5a4a3a, [0, 0.95, -5.35]);
  // candy shelves on the left wall
  const candyCols = [0xff5aa0, 0xffd040, 0x5ad0ff, 0xff8a1a, 0x9a4ae0, 0x5ac05a, 0xd02a2a];
  for (let s = 0; s < 4; s++) {
    box(g, 0.5, 0.05, 5, 0x6a5a4a, [-7.25, 0.4 + s * 0.6, -1.5]);
    for (let i = 0; i < 12; i++) box(g, 0.32, 0.38, 0.32, candyCols[(i + s * 3) % 7], [-7.25, 0.62 + s * 0.6, -3.7 + i * 0.4], { round: 0.03, r: 0.5 });
  }
  // aisle shelf unit with candy bags
  const aisle = grp(g, -3.6, 0, -2.4);
  box(aisle, 0.6, 1.8, 3.4, 0x4a3a4a, [0, 0.9, 0]);
  for (let s = 0; s < 3; s++) for (let i = 0; i < 7; i++) for (const sd of [-1, 1]) box(aisle, 0.12, 0.34, 0.36, candyCols[(i * 2 + s + (sd > 0 ? 3 : 0)) % 7], [sd * 0.36, 0.35 + s * 0.55, -1.4 + i * 0.46], { round: 0.03 });
  // costume racks
  const costumeCols = [0x15151a, 0x6a1430, 0x52c04a, 0x2f6dff, 0xff8a1a, 0x8a3ad0, 0xf4f4f8, 0xd02a2a];
  for (const [rx, rz, n0] of [[0.4, -1.2, 0], [3.8, -1.2, 3]]) {
    const r = grp(g, rx, 0, rz);
    const metal = mat(0xb0b4bc, { m: 0.8, r: 0.3 });
    for (const sd of [-1, 1]) mk(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8), metal, r, [sd * 1.3, 0.9, 0]);
    mk(new THREE.CylinderGeometry(0.025, 0.025, 2.7, 8), metal, r, [0, 1.78, 0], [0, 0, P / 2]);
    for (let i = 0; i < 9; i++) {
      const x = -1.15 + i * 0.29, c = costumeCols[(i + n0) % costumeCols.length];
      mk(new THREE.CapsuleGeometry(0.15, 0.7, 4, 10), mat(c, { r: 0.85 }), r, [x, 1.15, 0], [0, P / 2, 0], [1, 1, 0.35]);
      mk(new THREE.TorusGeometry(0.05, 0.006, 4, 10, P), metal, r, [x, 1.72, 0], [0, P / 2, 0]);
    }
  }
  // checkout counter + register
  const counter = grp(g, -4.6, 0, 2.6);
  box(counter, 0.9, 1.0, 3.0, 0x2a1a30, [0, 0.5, 0], { round: 0.03 });
  box(counter, 1.0, 0.06, 3.1, 0x9a8a9a, [0, 1.03, 0]);
  box(counter, 0.4, 0.28, 0.45, 0x2a2a32, [0, 1.2, -0.6], { round: 0.03 });
  mk(new THREE.PlaneGeometry(0.3, 0.16), mat(0x3fd2ff, { e: 0x3fd2ff, ei: 0.9 }), counter, [0.21, 1.27, -0.6], [0, P / 2, 0], null, false);
  for (let i = 0; i < 5; i++) box(counter, 0.22, 0.18, 0.22, candyCols[i], [0.05, 1.15, 0.2 + i * 0.25], { round: 0.03 });
  const pile = grp(counter, 0.1, 1.06, 0.9); pile.visible = false;
  box(pile, 0.4, 0.08, 0.5, 0x0b0b10, [0, 0.04, 0]); box(pile, 0.3, 0.12, 0.3, 0x52c04a, [0, 0.14, 0.05], { round: 0.04 }); box(pile, 0.2, 0.14, 0.2, 0xff5aa0, [-0.1, 0.27, -0.1], { round: 0.03 });
  const pizzaBox = box(counter, 0.5, 0.06, 0.5, 0xe8dcc4, [0.1, 1.42, 0.9]); pizzaBox.visible = false;
  // plastic pumpkin display near the door (Greg bumps it)
  const disp = grp(g, 3.3, 0, 3.7);
  box(disp, 1.4, 0.4, 1.0, 0x2a1a30, [0, 0.2, 0], { round: 0.02 });
  const dispP = [];
  [[-0.4, 0.4, -0.2], [0, 0.4, -0.2], [0.4, 0.4, -0.2], [-0.4, 0.4, 0.2], [0, 0.4, 0.2], [0.4, 0.4, 0.2], [-0.2, 0.68, 0], [0.2, 0.68, 0], [0, 0.94, 0]].forEach(([x, y, z], i) => dispP.push({ p: jackOLantern(disp, x, y, z, 0.85, 0.3 * (i % 3) - 0.3, i + 7), x, y, z }));
  // the motion-activated skeleton by the entrance
  const S = skeletonFigure(g);
  S.sk.position.set(1.7, 0, 4.4);
  // decorations
  stringLights(g, [[-7.4, 3.6, -5.3], [-2, 3.5, -5.3], [2, 3.6, -5.3], [7.4, 3.5, -5.3]], [ORANGE, PURPLE, 0x5aff8a], 0.2);
  stringLights(g, [[-7.4, 3.5, 5.3], [-1.8, 3.5, 5.3]], [ORANGE, PURPLE], 0.15);
  const bats = [];
  for (let i = 0; i < 8; i++) bats.push(bat(g, -5 + i * 1.4, 3.3 - (i % 3) * 0.2, -0.5 + ((i * 5) % 7) * 0.6, 1.6, i));
  web(g, [-7.45, 3.5, -5.45], [0, P / 4, 0], 1.6);
  web(g, [7.45, 3.5, -5.45], [0, -P / 4, P / 2], 1.6);
  inflatableGhost(g, 6.4, 2.6, -4.2, 1.1);
  jackOLantern(g, -6.6, 0, 4.8, 0.9, -0.6, 11); jackOLantern(g, 6.7, 0, -1.0, 1.0, -P / 2, 12);
  for (const [x, z] of [[6.9, 1.5], [6.9, 3.2]]) mk(new THREE.PlaneGeometry(1.1, 1.5), new THREE.MeshStandardMaterial({ map: TX.posterTex('SALE!', '#ff8a1a', '#3a0a40'), roughness: 0.8 }), g, [7.48, 1.9, z], [0, -P / 2, 0], null, false);
  // shoppers + cashier
  const shoppers = [
    { h: makeGuest(g, 0, { hair: 'wavy', hairColor: 0x2a1a10, skin: 0xe0ac86, shirt: 0x3a6a8a, pants: 0x1a1a22 }), x: -2.2, z: -3.6, ry: P, act: 'look' },
    { h: makeGuest(g, 1, { hair: 'spiky', hairColor: 0xd0a040, skin: 0xf0c09a, shirt: 0xd02a2a, pants: 0x2a2a3a }), x: 5.4, z: -0.4, ry: -P / 2, act: 'look' },
    { h: makeGuest(g, 2, { hair: 'tall', hairColor: 0x15100c, skin: 0x8a5a3c, shirt: 0x5ac05a, pants: 0x1a1a22 }), x: -6.3, z: -0.6, ry: -P / 2, act: 'look' },
    { h: makeGuest(g, 3, { hair: 'wavy', hairColor: 0x5a2a10, skin: 0xd8a07a, shirt: 0xff8a1a, pants: 0x15151a, extras: ['witchHat'] }), x: 2.0, z: -4.4, ry: P, act: 'idle' },
    { h: makeGuest(g, 4, { hair: 'spiky', hairColor: 0x15100c, skin: 0xa8734f, shirt: 0x8a3ad0, pants: 0x15151a, extras: ['catEars'] }), x: -5.4, z: 2.4, ry: P / 2, act: 'idle' },
  ];
  for (const s of shoppers) { s.h.root.position.set(s.x, 0, s.z); s.h.root.rotation.y = s.ry; }
  return {
    name: 'store', group: g, bg: new THREE.Color(0x0a0810), exposure: 1.05,
    update(t, X) {
      const v = X.val;
      // skeleton: idle leaning, then the pop (arms up, jaw open, red eyes, spins toward the door)
      const pop = v('skel.pop', 0), shake = v('skel.shake', 0);
      S.sk.rotation.y = lerp(-1.2, -0.25, pop) + 0.08 * Math.sin(t * 25) * shake;
      S.sk.position.x = 1.7 - 0.35 * pop;
      S.spine.rotation.x = lerp(0.05, -0.15, pop);
      S.head.rotation.z = 0.25 * (1 - pop) + 0.12 * Math.sin(t * 9) * pop;
      S.jaw.rotation.x = 0.5 * pop * (0.6 + 0.4 * Math.abs(Math.sin(t * 14)));
      for (const sd of [1, -1]) { S.arms[sd].sh.rotation.set(-2.4 * pop, 0, sd * (0.15 + 0.5 * pop)); S.arms[sd].el.rotation.x = -0.9 * pop; }
      S.eyeM.emissiveIntensity = 2.0 * pop;
      // the pumpkin display wobbles when Greg backs into it
      const wob = v('store.wobble', 0);
      dispP.forEach((d, i) => { d.p.rotation.z = Math.sin(t * 18 + i) * 0.25 * wob; d.p.position.y = d.y + Math.abs(Math.sin(t * 18 + i * 2)) * 0.06 * wob; });
      pile.visible = v('store.pile', 0) > 0.5; pizzaBox.visible = v('store.pizza', 0) > 0.5;
      bats.forEach((b, i) => { const f = Math.sin(t * 8 + i) * 0.5; b.userData.wr.rotation.y = f; b.userData.wl.rotation.y = P - f; b.position.y += Math.sin(t * 2 + i) * 0.001; });
      for (const s of shoppers) animGuest(s.h, s.act, t + s.x, t, 'neutral');
    },
  };
}

// ------------------------------------------------------------------ NEWARK'S HOUSE (outside, night)
function windowGlowTex(seed) {
  return canvasTex(128, 128, (ctx) => {
    const R = rng(seed);
    const gr = ctx.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#ffb060'); gr.addColorStop(1, R() < 0.5 ? '#ff7a20' : '#a050ff');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(30,10,30,0.55)';
    for (let i = 0; i < 3; i++) { const x = 15 + R() * 90; ctx.beginPath(); ctx.arc(x, 85, 12, 0, 7); ctx.fill(); ctx.fillRect(x - 13, 92, 26, 40); }
    ctx.fillStyle = '#2a1a14'; ctx.fillRect(60, 0, 8, 128); ctx.fillRect(0, 60, 128, 8);
  });
}
export function buildNewarkExt() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [-8, 12, 10], target: [0, 0, -4], shadowSize: 12, sun: 0x8aa0ff, sunI: 0.55, hemi: 0.35, sky: 0x3a4a8a, ground: 0x1a1a20, rimColor: 0xff9a40, rimI: 0.5, rimPos: [0, 3, -4] });
  const porchL = new THREE.PointLight(0xffa050, 14, 10, 1.4); porchL.position.set(0, 2.9, -4.6); g.add(porchL);
  const purpL = new THREE.PointLight(0xa050ff, 12, 14, 1.3); purpL.position.set(-4.5, 1.2, -2.5); g.add(purpL);
  const streetL = new THREE.PointLight(0xffd8a8, 9, 14, 1.3); streetL.position.set(0.5, 3.2, 7.5); g.add(streetL);
  const purpR = new THREE.PointLight(0xa050ff, 12, 14, 1.3); purpR.position.set(4.5, 1.2, -2.5); g.add(purpR);
  // ground: lawn, path, sidewalk, street
  plane(g, 40, 14, mat(0x1e3a22, { r: 1 }), [0, 0, -1]);
  plane(g, 1.6, 10.5, mat(0x6a6460, { r: 0.9 }), [0, 0.01, 0.4]);
  plane(g, 40, 2.4, new THREE.MeshStandardMaterial({ map: TX.sidewalkTex(), roughness: 0.9 }), [0, 0.015, 6.6]);
  plane(g, 40, 8, new THREE.MeshStandardMaterial({ map: TX.roadTex(), roughness: 0.9 }), [0, 0.005, 11.8]);
  // house
  const siding = mat(0x2a2236, { r: 0.85 }), trim = mat(0xe8e0d4, { r: 0.7 });
  box(g, 14, 6.6, 8, 0, [0, 3.3, -10], { material: siding });
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 6.0, 2.8, 4, 1), mat(0x15121c, { r: 0.8 }));
  roof.position.set(0, 8.0, -10); roof.rotation.y = P / 4; roof.scale.set(1.68, 1, 0.98); g.add(roof);
  box(g, 14.2, 0.15, 0.2, 0, [0, 6.6, -5.95], { material: trim });
  const winMats = [];
  for (const [x, y] of [[-5, 1.7], [-2.6, 1.7], [2.6, 1.7], [5, 1.7], [-5, 4.6], [-1.8, 4.6], [1.8, 4.6], [5, 4.6]]) {
    const m = new THREE.MeshStandardMaterial({ map: windowGlowTex(Math.round(x * 3 + y)), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 });
    m.emissiveMap = m.map; m.emissiveIntensity = 1.1; winMats.push(m);
    plane(g, 1.4, 1.5, m, [x, y, -5.99], [0, 0, 0], false);
    box(g, 1.6, 0.1, 0.12, 0, [x, y - 0.8, -5.93], { material: trim });
  }
  // porch, steps, columns, door
  box(g, 5, 0.4, 1.6, 0x3a3038, [0, 0.2, -5.2]);
  for (let i = 0; i < 2; i++) box(g, 2.0, 0.2, 0.35, 0x4a4048, [0, 0.1 + i * 0.0, -4.25 + 0.0 * i], { noShadow: false });
  box(g, 5.2, 0.15, 1.8, 0x2a2228, [0, 3.0, -5.2]);
  for (const x of [-2.3, 2.3]) mk(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 10), trim, g, [x, 1.7, -4.5]);
  box(g, 1.5, 2.5, 0.12, 0x1a1010, [0, 1.65, -5.98]);
  const door = grp(g, -0.6, 0.4, -5.9);
  box(door, 1.2, 2.3, 0.08, 0x8a2a1a, [0.6, 1.15, 0], { round: 0.02 });
  box(door, 0.08, 0.08, 0.08, 0xd8b040, [1.05, 1.1, 0.06], { m: 0.7 });
  const doorway = plane(g, 1.2, 2.3, new THREE.MeshBasicMaterial({ color: 0xffa050 }), [0, 1.55, -5.97], [0, 0, 0], false);
  mk(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0xff8a2a }), g, [0, 3.6, -5.98], [0, 0, 0], null, false);
  // decorations: pumpkins on the path, gravestones, string lights, inflatable ghost, purple spot cones
  for (const z of [-3.4, -1.6, 0.2, 2.0, 3.8]) for (const sd of [-1, 1]) jackOLantern(g, sd * 1.15, 0, z, 1.1, sd * 0.4, Math.round(z * 3 + sd));
  for (const sd of [-1, 1]) for (const dz of [0]) { jackOLantern(g, sd * 1.4, 0.4, -4.8 + dz, 1.2, 0, 4 + sd); }
  [[-4.2, -2.4, 0.2, 'RIP'], [-6.0, 0.2, -0.2, 'BOO'], [-3.4, 1.6, 0.1, 'RIP'], [4.4, -1.8, -0.2, 'RIP'], [6.0, 0.8, 0.25, 'BOO'], [3.6, 2.2, -0.1, 'RIP']].forEach(([x, z, ry, txt]) => gravestone(g, x, z, ry, txt));
  stringLights(g, [[-7, 6.5, -5.85], [-3.5, 6.5, -5.85], [0, 6.5, -5.85], [3.5, 6.5, -5.85], [7, 6.5, -5.85]], [ORANGE, PURPLE], 0.25);
  stringLights(g, [[-2.5, 2.95, -4.35], [2.5, 2.95, -4.35]], [ORANGE, PURPLE], 0.2);
  const ghost = inflatableGhost(g, 5.6, 0.6, -3.0, 1.4);
  ghost.rotation.y = -0.5;
  const coneM = new THREE.MeshBasicMaterial({ color: 0xa050ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const sd of [-1, 1]) {
    mk(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 12), mat(0x1a1a1a), g, [sd * 4.6, 0.12, -2.6]);
    const c = mk(new THREE.ConeGeometry(1.6, 6.5, 24, 1, true), coneM, g, [sd * 3.2, 3.2, -4.6], [0, 0, 0], null, false);
    c.rotation.set(0.45, 0, sd * 0.38);
  }
  tree(g, -9, -3, 1.6, 5); tree(g, 9.5, -2.5, 1.7, 8); tree(g, -12, 2, 1.4, 9); tree(g, 12, 1.5, 1.5, 3);
  streetLamp(g, 5.5, 6.0, 1); streetLamp(g, -7.5, 6.0, 1);
  // neighbours' houses in the dark
  for (const [x, w, c] of [[-20, 9, 0x1a1a28], [20, 10, 0x221a26]]) box(g, w, 5, 7, c, [x, 2.5, -9]);
  // moon + stars
  mk(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d8 }), g, [-22, 26, -60], [0, 0, 0], null, false);
  const sp = []; const R = rng(77);
  for (let i = 0; i < 300; i++) { const a = R() * P - P / 2, e = 0.15 + R() * 1.2; sp.push(Math.sin(a) * 90, Math.sin(e) * 90, -Math.cos(a) * 90 * Math.cos(e)); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true })));
  // a few guests arriving / chatting on the lawn
  const guests = [
    { h: makeGuest(g, 5), x: -2.6, z: -3.2, ry: 0.6, act: 'idle' },
    { h: makeGuest(g, 2), x: -3.4, z: -2.4, ry: 2.2, act: 'laugh' },
    { h: makeGuest(g, 7), x: 3.0, z: -3.6, ry: -1.4, act: 'idle' },
  ];
  for (const s of guests) { s.h.root.position.set(s.x, 0, s.z); s.h.root.rotation.y = s.ry; }
  return {
    name: 'newarkExt', group: g, bg: new THREE.Color(0x0a1028), fog: [0x0a1028, 25, 80], exposure: 1.1,
    update(t, X) {
      const v = X.val;
      door.rotation.y = -1.6 * v('nk.door', 0);
      doorway.visible = v('nk.door', 0) > 0.05;
      const beat = Math.abs(Math.sin(t * P * 2.0));
      winMats.forEach((m, i) => { m.emissiveIntensity = 0.9 + 0.35 * (i % 2 ? beat : 1 - beat) * v('nk.party', 1); });
      purpL.intensity = 10 + 4 * beat; purpR.intensity = 10 + 4 * (1 - beat);
      ghost.position.y = 0.6 + 0.08 * Math.sin(t * 1.3);
      const gv = v('nk.guests', 1) > 0.5;
      for (const s of guests) { s.h.root.visible = gv; if (gv) animGuest(s.h, s.act, t + s.x, t, 'happy'); }
    },
  };
}

// ------------------------------------------------------------------ PARTY ROOM (inside Newark's house)
// Guests have an audience spot (talent show) and a dance spot; `party.mode` 0 = show, 1 = dance.
export const PARTY_STAGE = { x: 0, z: -5.4, top: 0.5, front: -4.2, stepsX: -3.75 };
export function buildParty() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [4, 10, 6], target: [0, 0, -2], shadowSize: 10, sun: 0xd8c8ff, sunI: 0.7, hemi: 0.45, sky: 0x7a5aa8, ground: 0x2a1a20, rimColor: 0xff8a40, rimI: 0.8, rimPos: [0, 4, -8] });
  const cOrange = new THREE.PointLight(0xff8a30, 14, 14, 1.3); cOrange.position.set(-4.5, 3.4, 1); g.add(cOrange);
  const cPurple = new THREE.PointLight(0xa050ff, 14, 14, 1.3); cPurple.position.set(4.5, 3.4, 1); g.add(cPurple);
  const cBlue = new THREE.PointLight(0x4a8aff, 0, 12, 1.3); cBlue.position.set(0, 3.6, 3.5); g.add(cBlue);
  const spot = new THREE.SpotLight(0xfff0d8, 0, 18, 0.5, 0.5, 1.2); spot.position.set(0, 4.0, 1.5); spot.target.position.set(0, 0.5, -5.2); g.add(spot); g.add(spot.target);
  plane(g, 16, 14, new THREE.MeshStandardMaterial({ map: TX.planksTex('#4a3a3a', '#3e3030'), roughness: 0.6 }), [0, 0, 0]);
  const wall = mat(0x2a1a3a, { r: 0.9 });
  box(g, 16, 4.4, 0.2, 0, [0, 2.2, -7.0], { material: wall, noShadow: true });
  box(g, 16, 4.4, 0.2, 0, [0, 2.2, 7.0], { material: wall, noShadow: true });
  box(g, 0.2, 4.4, 14, 0, [-8, 2.2, 0], { material: wall, noShadow: true });
  box(g, 0.2, 4.4, 14, 0, [8, 2.2, 0], { material: wall, noShadow: true });
  box(g, 16, 0.15, 14, 0, [0, 4.4, 0], { material: mat(0x150c1e), noShadow: true });
  // stage, curtain, banner, steps, mic stand
  const st = PARTY_STAGE;
  box(g, 6.6, st.top, 2.6, 0x1a1018, [0, st.top / 2, -5.5], { round: 0.03 });
  box(g, 6.7, 0.06, 0.08, 0xff8a1a, [0, st.top, st.front], { e: 0xff6a00, ei: 0.8, noShadow: true });
  for (let i = 0; i < 2; i++) box(g, 0.9, 0.25 * (i + 1) - 0.001, 0.5, 0x2a1a24, [st.stepsX, 0.125 * (i + 1), -4.9 + 0.0], { noShadow: true });
  box(g, 0.9, 0.25, 0.5, 0x2a1a24, [st.stepsX + 0.0, 0.125, -4.4]);
  const curtain = new THREE.MeshStandardMaterial({ color: 0x5a1a7a, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 14; i++) mk(new THREE.CylinderGeometry(0.28, 0.28, 3.6, 10, 1, true, 0, P), curtain, g, [-3.4 + i * 0.52, 2.3, -6.75], [0, P, 0]);
  mk(new THREE.PlaneGeometry(6.2, 0.95), new THREE.MeshBasicMaterial({ map: bannerTex('HALLOWEEN TALENT SHOW', '#15101e', '#ffd080') }), g, [0, 3.75, -6.38], [0, 0, 0], null, false);
  const micStand = grp(g, -2.6, st.top, -4.6);
  mk(new THREE.CylinderGeometry(0.15, 0.18, 0.03, 14), mat(0x15151a), micStand, [0, 0.015, 0]);
  mk(new THREE.CylinderGeometry(0.012, 0.012, 1.35, 6), mat(0x2a2a30, { m: 0.7 }), micStand, [0, 0.68, 0]);
  const micHead = mk(new THREE.SphereGeometry(0.035, 10, 8), mat(0x9a9aa8, { m: 0.8, r: 0.3 }), micStand, [0, 1.38, 0.03]);
  jackOLantern(g, -2.9, st.top, -4.55, 1.2, 0.3, 21); jackOLantern(g, 2.9, st.top, -4.55, 1.2, -0.3, 22);
  // floating symbol above the stage (Aaron's act)
  const symbol = mk(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: TX.emblemTex('#7fd4ff', '#e8f7ff'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), g, [0, 3.0, -5.2], [0, 0, 0], null, false);
  // DJ booth + DJ
  const dj = grp(g, 5.4, 0, -3.4); dj.rotation.y = -0.9;
  box(dj, 1.8, 1.0, 0.8, 0x15101e, [0, 0.5, 0], { round: 0.04 });
  const djPanel = mk(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: bannerTex('DJ SPOOKS', '#1a0a2a', '#7fd4ff', 512, 192) }), dj, [0, 0.55, 0.41], [0, 0, 0], null, false);
  for (const sd of [-1, 1]) { mk(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20), mat(0x111111), dj, [sd * 0.45, 1.02, -0.05]); mk(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), mat(0xff8a1a, { e: 0xff6a00, ei: 0.8 }), dj, [sd * 0.45, 1.05, -0.05]); }
  for (const sd of [-1, 1]) box(dj, 0.5, 1.4, 0.5, 0x0e0e12, [sd * 1.3, 0.7, -0.2], { round: 0.04 });
  const djGuy = makeGuest(dj, 30, { hair: 'spiky', hairColor: 0x15100c, skin: 0x7a4a30, shirt: 0x2a6a8a, pants: 0x15151a, extras: ['headphones'] });
  djGuy.root.position.set(0, 0, -0.75);
  // snack table (left wall) with pumpkins that get blown off
  const table = grp(g, -6.6, 0, 0.6);
  box(table, 1.1, 0.06, 3.6, 0xff8a1a, [0, 0.82, 0], { r: 0.7 });
  box(table, 1.05, 0.8, 3.55, 0x15101e, [0, 0.4, 0], { r: 0.9 });
  const snackCols = [0xffd040, 0xd02a2a, 0x8a3ad0, 0x5ac05a, 0xff5aa0];
  for (let i = 0; i < 5; i++) { mk(new THREE.CylinderGeometry(0.2, 0.14, 0.12, 16), mat(0xf4f4f8), table, [0.1, 0.91, -1.4 + i * 0.6]); for (let j = 0; j < 5; j++) mk(new THREE.IcosahedronGeometry(0.04, 0), mat(snackCols[(i + j) % 5]), table, [0.1 + Math.sin(j * 2) * 0.08, 0.98, -1.4 + i * 0.6 + Math.cos(j * 2) * 0.08]); }
  const blown = [jackOLantern(g, -6.4, 0.85, -0.9, 0.9, 0.6, 31), jackOLantern(g, -6.5, 0.85, 1.0, 0.8, 0.9, 32), jackOLantern(g, -6.3, 0.85, 2.1, 0.75, 1.2, 33)];
  const blownBase = blown.map((b) => b.position.clone());
  // dance floor tiles
  const tiles = [];
  for (let ix = 0; ix < 6; ix++) for (let iz = 0; iz < 5; iz++) {
    const m = new THREE.MeshStandardMaterial({ color: 0x1a1a22, emissive: 0x000000, roughness: 0.3 });
    tiles.push({ m, ix, iz });
    mk(new THREE.PlaneGeometry(0.98, 0.98), m, g, [-2.5 + ix, 0.012, -1.6 + iz], [-P / 2, 0, 0], null, false).receiveShadow = true;
  }
  // decorations
  const lm = [
    ...stringLights(g, [[-7.9, 4.1, -6.8], [-7.9, 4.1, 0], [-7.9, 4.1, 6.8]], [ORANGE, PURPLE], 0.25),
    ...stringLights(g, [[7.9, 4.1, -6.8], [7.9, 4.1, 0], [7.9, 4.1, 6.8]], [PURPLE, ORANGE], 0.25),
    ...stringLights(g, [[-6, 4.2, -2], [0, 4.2, 0.5], [6, 4.2, -2]], [ORANGE, PURPLE, 0x4a8aff], 0.6),
    ...stringLights(g, [[-6, 4.2, 4], [0, 4.2, 2.5], [6, 4.2, 4]], [PURPLE, ORANGE, 0x4a8aff], 0.6),
  ];
  for (const [x, z] of [[-7.6, -6.6], [7.6, -6.6], [-7.6, 6.6], [7.6, 6.6]]) web(g, [x, 3.7, z], [0, x < 0 ? (z < 0 ? P / 4 : 3 * P / 4) : (z < 0 ? -P / 4 : -3 * P / 4), 0], 1.5);
  balloons(g, -4.6, 2.2, -6.7); balloons(g, 4.6, 2.2, -6.7); balloons(g, -7.7, 2.0, -3.5); balloons(g, 7.7, 2.0, 2.5);
  inflatableGhost(g, -6.8, 2.8, 5.4, 1.0);
  const batsP = []; for (let i = 0; i < 7; i++) batsP.push(bat(g, -5 + i * 1.7, 3.6 - (i % 2) * 0.3, 1 + ((i * 3) % 5) - 2, 1.8, i));
  jackOLantern(g, 7.2, 0, 5.8, 1.3, -2.2, 41); jackOLantern(g, -7.2, 0, -6.0, 1.1, 0.8, 42);
  // guests
  const showSpots = [[-1.3, -2.5], [1.3, -2.6], [2.4, -2.4], [3.4, -2.7], [-1.0, -1.3], [1.2, -1.4], [2.3, -1.2], [3.5, -1.3], [-1.6, -0.2], [1.4, 0.0], [2.6, 0.2], [3.8, 0.1], [4.6, -2.0], [-0.6, 0.9]];
  // dancers ring the floor (back and sides) so the team has the middle
  const danceSpots = Array.from({ length: 14 }, (_, i) => { const a = (150 + (i / 13) * 240) * P / 180; return [0.4 + 3.4 * Math.cos(a) + 0.3 * Math.sin(i * 3), 1.0 + 3.1 * Math.sin(a)]; });
  // ghost-sheet guests (1, 12) are tall and bright: keep them at the back so they never fill the foreground
  [[1, 6], [12, 7]].forEach(([a, b]) => { [danceSpots[a], danceSpots[b]] = [danceSpots[b], danceSpots[a]]; });
  [[1, 12], [12, 11]].forEach(([a, b]) => { [showSpots[a], showSpots[b]] = [showSpots[b], showSpots[a]]; });
  const guests = GUEST_LOOKS.map((look, i) => ({ h: makeGuest(g, 40 + i, look), i, show: showSpots[i], dance: danceSpots[i] }));
  return {
    name: 'party', group: g, bg: new THREE.Color(0x0a0612), exposure: 1.1,
    refs: { micHead },
    update(t, X) {
      const v = X.val;
      const mode = clamp(v('party.mode', 0)), show = 1 - mode;
      const beat = t * 2.0; // 120 bpm
      const pulse = Math.pow(Math.abs(Math.sin(beat * P)), 4);
      // lights: dim + stage spotlight during the show, colourful during the dance
      spot.intensity = 60 * show * v('stage.spot', 1);
      cOrange.intensity = lerp(6, 10 + 8 * pulse, mode); cPurple.intensity = lerp(6, 10 + 8 * (1 - pulse), mode);
      cBlue.intensity = 10 * mode * (0.5 + 0.5 * Math.sin(t * 3));
      cOrange.position.x = -4.5 + 2 * Math.sin(t * 0.9) * mode; cPurple.position.x = 4.5 - 2 * Math.sin(t * 0.8) * mode;
      L.hemi.intensity = lerp(0.6, 0.55, mode);
      for (const tl of tiles) {
        const k = (tl.ix + tl.iz + Math.floor(beat)) % 3;
        const c = k === 0 ? 0xff8a1a : k === 1 ? 0x9a4ae0 : 0x4a8aff;
        tl.m.emissive.set(c); tl.m.emissiveIntensity = mode * (0.25 + 0.75 * ((tl.ix * 3 + tl.iz + Math.floor(beat * 2)) % 2 ? pulse : 0.3));
      }
      lm.forEach((m, i) => { m.emissiveIntensity = 1.2 + 0.8 * Math.sin(t * 3 + i); });
      // Aaron's floating symbol
      const sym = v('stage.symbol', 0);
      symbol.material.opacity = sym; symbol.scale.setScalar(0.6 + 0.4 * sym + 0.05 * Math.sin(t * 6)); symbol.rotation.z = t * 0.6; symbol.visible = sym > 0.01;
      // pumpkins blown off the snack table by Eric's wings
      const bl = v('party.blow', 0);
      blown.forEach((b, i) => {
        const k = clamp(bl * 1.3 - i * 0.12);
        const base = blownBase[i];
        b.position.set(base.x + 1.6 * k * (1 + i * 0.3), base.y + 1.2 * Math.sin(k * P) - 0.85 * smoothstep(0.5, 1, k) + (k >= 1 ? 0 : 0), base.z + (i - 1) * 0.9 * k);
        b.rotation.set(2.5 * k * (i + 1), 0.6 + i * 0.3, 1.8 * k);
      });
      batsP.forEach((b, i) => { const f = Math.sin(t * 8 + i) * 0.5; b.userData.wr.rotation.y = f; b.userData.wl.rotation.y = P - f; });
      // guests
      const cheer = v('party.cheer', 0), gasp = v('party.gasp', 0);
      for (const G of guests) {
        const [sx, sz] = G.show, [dx, dz] = G.dance;
        const x = lerp(sx, dx, smoothstep(0, 1, mode)), z = lerp(sz, dz, smoothstep(0, 1, mode));
        G.h.root.position.set(x, 0, z);
        const faceStage = Math.atan2(0 - x, -5.4 - z);
        G.h.root.rotation.y = lerp(faceStage, faceStage + Math.sin(t * 0.7 + G.i) * 0.8 + G.i, mode);
        let act = 'idle', expr = 'happy';
        if (mode > 0.5) act = G.i % 4 === 1 ? 'cheerJump' : 'dance';
        else if (gasp > 0.5) { act = 'gasp'; expr = 'surprised'; }
        else if (cheer > 0.5) act = G.i % 3 === 0 ? 'cheerJump' : 'clap';
        animGuest(G.h, act, t * (1 + (G.i % 3) * 0.05) + G.i * 0.37, t, expr);
      }
      animGuest(djGuy, mode > 0.5 ? 'dance' : 'idle', t + 3, t, 'grin');
      djGuy.J.sh.R.rotation.x = -1.0; djGuy.J.el.R.rotation.x = -1.2 - 0.3 * Math.sin(t * 6);
    },
  };
}
