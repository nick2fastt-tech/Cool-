// Episode 6 ("The Power Returns"): the horse, Eric's cat form, the clay Behemoth figure,
// the Soul Stealer's underground lair (with the cage) and the night alley.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, mk, grp, rng, hash, canvasTex, clamp, lerp, smoothstep } from './util.js';
import { lights, box, plane } from './sets.js';
import * as TX from './textures.js';

const P = Math.PI;

// shared clay material so the figure on the ground and the one in the cowboy's hand glow together
export const clayMat = new THREE.MeshStandardMaterial({ color: 0x6e5644, roughness: 0.95, emissive: 0x2a8cff, emissiveIntensity: 0 });
// small lights that travel with a held figure; the alley set drives their brightness
export const clayLights = [];

// A little clay Behemoth: a coiled, tapering body with spines, a raised neck, a head and a tiny crown.
export function buildClayFigure(scale = 1, held = false) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const k = i / 18, a = k * P * 3.0, r = 0.06 * (1 - k * 0.6);
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.014 + k * 0.014, Math.sin(a) * r));
  }
  const e = pts[pts.length - 1];
  pts.push(new THREE.Vector3(e.x * 0.4, 0.055, e.z * 0.4 + 0.004), new THREE.Vector3(0, 0.095, 0.012), new THREE.Vector3(0, 0.12, 0.03));
  const curve = new THREE.CatmullRomCurve3(pts);
  const TS = 90, RS = 8, R0 = 0.016;
  const geo = new THREE.TubeGeometry(curve, TS, R0, RS, false);
  const pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  const taper = (u) => 0.3 + 0.7 * smoothstep(0, 0.35, u) - 0.25 * smoothstep(0.75, 1, u);
  for (let i = 0; i <= TS; i++) {
    curve.getPointAt(i / TS, c); const f = taper(i / TS);
    for (let j = 0; j <= RS; j++) { const n = i * (RS + 1) + j; v.fromBufferAttribute(pos, n).sub(c).multiplyScalar(f).add(c); pos.setXYZ(n, v.x, v.y, v.z); }
  }
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, clayMat));
  // spines along the back of the coil
  for (let i = 0; i < 9; i++) {
    const u = 0.22 + i * 0.065; curve.getPointAt(u, c);
    mk(new THREE.ConeGeometry(0.0055, 0.02, 4), clayMat, g, [c.x, c.y + R0 * taper(u) * 0.8, c.z]);
  }
  // head, looking forward and a little down
  curve.getPointAt(1, c); const tan = curve.getTangentAt(1);
  const hd = new THREE.Group(); hd.position.copy(c).addScaledVector(tan, 0.012); g.add(hd);
  hd.lookAt(hd.position.clone().add(new THREE.Vector3(tan.x, tan.y * 0.2 - 0.25, tan.z + 0.6)));
  mk(new THREE.SphereGeometry(0.02, 12, 10), clayMat, hd, [0, 0, 0.01], [0, 0, 0], [1, 0.8, 1.5]);
  mk(new THREE.SphereGeometry(0.013, 10, 8), clayMat, hd, [0, -0.007, 0.034], [0, 0, 0], [1, 0.7, 1.2]);
  for (const sd of [1, -1]) mk(new THREE.SphereGeometry(0.0045, 6, 5), mat(0x1a1410, { r: 0.6 }), hd, [sd * 0.012, 0.006, 0.026]);
  // tiny crown
  mk(new THREE.CylinderGeometry(0.012, 0.013, 0.006, 10), clayMat, hd, [0, 0.016, 0.004]);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * P * 2; mk(new THREE.ConeGeometry(0.0035, 0.012, 4), clayMat, hd, [Math.sin(a) * 0.011, 0.024, Math.cos(a) * 0.011 + 0.004]); }
  g.scale.setScalar(scale);
  if (held) { const l = new THREE.PointLight(0x3a8aff, 0, 1.6, 1.5); l.position.set(0, 0.16, 0.14); g.add(l); clayLights.push(l); }
  return g;
}

// ------------------------------------------------------------------ THE HORSE
export function buildHorse() {
  const root = new THREE.Group();
  const coat = mat(0x24170f, { r: 0.6 }), dark = mat(0x0c0806, { r: 0.7 }), hoofM = mat(0x161210, { r: 0.5 });
  const leather = mat(0x5a3418, { r: 0.6 }), blanket = mat(0x6a1a14, { r: 0.85 }), metalM = mat(0x9a9aa2, { r: 0.3, m: 0.8 });
  const body = grp(root, 0, 1.25, 0);
  mk(new THREE.CapsuleGeometry(0.36, 1.0, 8, 18), coat, body, [0, 0, 0], [P / 2, 0, 0], [1, 1.05, 1]);
  mk(new THREE.SphereGeometry(0.42, 18, 14), coat, body, [0, 0.02, 0.5], [0, 0, 0], [0.95, 1.05, 1]);
  mk(new THREE.SphereGeometry(0.44, 18, 14), coat, body, [0, 0.04, -0.5], [0, 0, 0], [1, 1.05, 1]);
  // saddle, blanket, stirrups
  box(body, 0.8, 0.04, 0.75, 0, [0, 0.4, 0.02], { material: blanket, round: 0.015 });
  box(body, 0.55, 0.12, 0.55, 0, [0, 0.45, 0.02], { material: leather, round: 0.05 });
  mk(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 8), leather, body, [0, 0.55, 0.26]);
  for (const sd of [1, -1]) {
    box(body, 0.03, 0.55, 0.05, 0, [sd * 0.4, 0.17, 0.02], { material: leather });
    box(body, 0.12, 0.03, 0.08, 0, [sd * 0.42, -0.12, 0.02], { material: metalM });
  }
  // neck + head
  const neck = grp(body, 0, 0.25, 0.72); neck.rotation.x = 0.75;
  mk(new THREE.CapsuleGeometry(0.17, 0.62, 6, 14), coat, neck, [0, 0.38, 0], [0, 0, 0], [0.9, 1, 1.15]);
  for (let i = 0; i < 7; i++) mk(new THREE.BoxGeometry(0.06, 0.16, 0.1), dark, neck, [0, 0.12 + i * 0.1, -0.16], [0.3, 0, 0]);
  const head = grp(neck, 0, 0.75, 0.05); head.rotation.x = 1.5;
  mk(new THREE.CapsuleGeometry(0.12, 0.42, 6, 12), coat, head, [0, 0.22, 0.02], [0, 0, 0], [0.9, 1, 1.05]);
  mk(new THREE.SphereGeometry(0.12, 12, 10), mat(0x1a110a, { r: 0.6 }), head, [0, 0.5, 0.02], [0, 0, 0], [0.9, 0.8, 1]);
  for (const sd of [1, -1]) {
    mk(new THREE.SphereGeometry(0.03, 10, 8), mat(0x050505, { r: 0.1 }), head, [sd * 0.11, 0.1, -0.04]);
    mk(new THREE.ConeGeometry(0.04, 0.13, 6), coat, head, [sd * 0.06, -0.06, -0.1], [-1.9, 0, sd * 0.3]);
    mk(new THREE.SphereGeometry(0.018, 6, 5), mat(0x050505), head, [sd * 0.05, 0.6, 0.0]);
    box(head, 0.01, 0.4, 0.015, 0, [sd * 0.115, 0.3, 0.05], { material: leather });
  }
  const jaw = grp(head, 0, 0.42, 0.07);
  mk(new THREE.BoxGeometry(0.12, 0.14, 0.05), mat(0x1a110a, { r: 0.6 }), jaw, [0, 0.06, -0.02]);
  // forelock
  mk(new THREE.BoxGeometry(0.08, 0.12, 0.04), dark, head, [0, 0.0, -0.12], [-0.4, 0, 0]);
  // legs
  const legs = [];
  for (const [x, z] of [[0.2, 0.55], [-0.2, 0.55], [0.2, -0.58], [-0.2, -0.58]]) {
    const up = grp(body, x, -0.15, z);
    mk(new THREE.CapsuleGeometry(0.1, 0.38, 4, 10), coat, up, [0, -0.25, 0]);
    const lo = grp(up, 0, -0.52, 0);
    mk(new THREE.CapsuleGeometry(0.055, 0.38, 4, 8), coat, lo, [0, -0.22, 0]);
    mk(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), hoofM, lo, [0, -0.47, 0.01]);
    legs.push({ up, lo, front: z > 0, sd: x > 0 ? 1 : -1 });
  }
  // strange glowing markings (Episode 7): stripes along the body, rings on the legs, eye glow
  const glowM = new THREE.MeshStandardMaterial({ color: 0x1a2a30, emissive: 0x2ad8ff, emissiveIntensity: 0, roughness: 0.4 });
  for (const sd of [1, -1]) {
    for (let i = 0; i < 4; i++) mk(new THREE.TorusGeometry(0.2 + i * 0.03, 0.012, 6, 20, P * 0.7), glowM, body, [sd * 0.33, 0.05, 0.45 - i * 0.3], [0, sd * P / 2, P * 0.15], [1, 1.3, 1], false);
    mk(new THREE.SphereGeometry(0.022, 8, 6), glowM, head, [sd * 0.115, 0.1, -0.025], [0, 0, 0], null, false);
  }
  for (const L of legs) mk(new THREE.TorusGeometry(0.075, 0.012, 6, 16), glowM, L.lo, [0, -0.3, 0], [P / 2, 0, 0], null, false);
  for (let i = 0; i < 5; i++) mk(new THREE.BoxGeometry(0.02, 0.1, 0.02), glowM, neck, [0, 0.15 + i * 0.12, 0.17], [0.3, 0, 0], null, false);
  // tail
  const tail = [];
  let parent = grp(body, 0, 0.22, -0.95);
  for (let i = 0; i < 6; i++) { const g = grp(parent, 0, i === 0 ? 0 : -0.12, 0); mk(new THREE.CapsuleGeometry(0.06 + i * 0.008, 0.12, 4, 8), dark, g, [0, -0.06, 0]); tail.push(g); parent = g; }
  // own copies of every material so the horse can fade out (invisibility) without touching anything else
  const fadeList = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material !== glowM) o.material = o.material.clone();
    fadeList.push({ m: o.material, em: o.material.emissive.clone() });
  });
  const TEAL = new THREE.Color(0x40e8ff);
  let lastA = 1;
  const fade = (al, t) => {
    if (al >= 0.999 && lastA >= 0.999) return;
    lastA = al;
    const sh = al < 0.999 ? Math.min(1, (1 - al) * 1.8) * (0.6 + 0.4 * Math.sin(t * 22)) : 0;
    for (const e of fadeList) {
      e.m.transparent = al < 0.999; e.m.opacity = al; e.m.depthWrite = al > 0.6;
      if (e.m !== glowM) e.m.emissive.copy(e.em).lerp(TEAL, sh * 0.3);
    }
  };
  return {
    root, head, neck,
    // st: { t, act, a, speed, phase }
    update(st) {
      const { t, a } = st, act = st.act ?? 'idle';
      const walk = clamp((st.speed ?? 0) / 1.2), trot = clamp(((st.speed ?? 0) - 1.6) / 2), ph = st.phase ?? 0;
      body.position.y = 1.25 + Math.abs(Math.sin(ph)) * 0.05 * walk + Math.abs(Math.sin(ph * 2)) * 0.06 * trot;
      body.rotation.set(0.02 * Math.sin(ph * 2) * walk, 0, 0);
      neck.rotation.x = 0.75 + 0.05 * Math.sin(ph * 2) * walk + 0.03 * Math.sin(t * 0.8);
      head.rotation.set(1.5, 0, 0); jaw.rotation.x = 0;
      legs.forEach((L, i) => {
        const off = (L.front ? 0 : P) + (L.sd > 0 ? 0 : P / 2);
        const s = Math.sin(ph + off);
        L.up.rotation.x = s * (0.45 * walk + 0.25 * trot);
        L.lo.rotation.x = Math.max(0, -Math.cos(ph + off)) * (0.7 * walk + 0.3 * trot) * (L.front ? -1 : 1) * -1;
      });
      tail.forEach((g, i) => { g.rotation.set(0.25 + 0.05 * Math.sin(t * 1.5 + i), 0.18 * Math.sin(t * 1.3 - i * 0.5) * (0.4 + walk), 0); });
      if (act === 'idle' || act === 'shift') {
        const k = act === 'shift' ? Math.max(0, Math.sin(a * 4)) : Math.max(0, Math.sin(t * 0.7) - 0.85) * 6;
        legs[2].up.rotation.x = -0.25 * k; legs[2].lo.rotation.x = 0.6 * k;
        if (act === 'shift') { legs[0].up.rotation.x = 0.2 * Math.max(0, Math.sin(a * 4 + 2)); }
      }
      if (act === 'snort') { const k = Math.sin(clamp(a / 0.8) * P); neck.rotation.x += -0.12 * k; head.rotation.x += 0.15 * k; }
      if (act === 'neigh') {
        const k = smoothstep(0, 0.3, a) * (1 - smoothstep(1.4, 2.0, a));
        neck.rotation.x += -0.45 * k; head.rotation.x += -0.5 * k; jaw.rotation.x = -0.5 * k * (0.7 + 0.3 * Math.sin(a * 30));
        body.rotation.x = -0.12 * k; body.position.y += 0.1 * k;
        legs[0].up.rotation.x = -0.9 * k; legs[0].lo.rotation.x = 1.2 * k; legs[1].up.rotation.x = -0.7 * k; legs[1].lo.rotation.x = 1.0 * k;
      }
      if (act === 'lookUp') { neck.rotation.x += -0.25; head.rotation.x += -0.2; }
      if (act === 'rear') {
        const k = smoothstep(0, 0.4, a) * (1 - smoothstep(1.6, 2.2, a));
        body.rotation.x = -0.55 * k; body.position.y += 0.35 * k; neck.rotation.x += -0.3 * k; head.rotation.x += -0.3 * k; jaw.rotation.x = -0.4 * k;
        legs[0].up.rotation.x = -1.1 * k + 0.3 * Math.sin(a * 12) * k; legs[0].lo.rotation.x = 1.4 * k; legs[1].up.rotation.x = -0.9 * k - 0.3 * Math.sin(a * 12) * k; legs[1].lo.rotation.x = 1.2 * k;
        legs[2].up.rotation.x = 0.35 * k; legs[3].up.rotation.x = 0.35 * k;
      }
      fade(st.alpha ?? 1, t);
      root.visible = (st.alpha ?? 1) > 0.01;
      const gl = st.glow ?? 0;
      glowM.emissiveIntensity = gl * (0.85 + 0.15 * Math.sin(t * 7));
      glowM.color.setHex(gl > 0.05 ? 0x7af0ff : 0x1a2a30);
    },
  };
}

// ------------------------------------------------------------------ ERIC'S CAT FORM
export function buildCat() {
  const root = new THREE.Group();
  const tabby = canvasTex(128, 64, (c, w, h) => {
    c.fillStyle = '#b07a44'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#6a4224';
    for (let i = 0; i < 10; i++) { const y = (i / 10) * h + 2; c.fillRect(0, y, w * 0.42, 3); c.fillRect(w * 0.58, y + 1, w * 0.42, 3); }
    c.fillStyle = '#f0e0c8'; c.fillRect(w * 0.44, 0, w * 0.12, h);
  });
  const fur = new THREE.MeshStandardMaterial({ map: tabby, roughness: 0.9 });
  const furPlain = mat(0xb07a44, { r: 0.9 }), cream = mat(0xf0e0c8, { r: 0.9 }), dark = mat(0x2a1a10, { r: 0.6 });
  const body = grp(root, 0, 0.17, 0);
  mk(new THREE.CapsuleGeometry(0.085, 0.2, 6, 12), fur, body, [0, 0, 0], [P / 2, 0, 0]);
  const headG = grp(body, 0, 0.09, 0.17);
  mk(new THREE.SphereGeometry(0.08, 16, 12), fur, headG, [0, 0, 0], [P / 2, 0, 0], [1.05, 0.95, 0.95]);
  mk(new THREE.SphereGeometry(0.04, 10, 8), cream, headG, [0, -0.025, 0.06], [0, 0, 0], [1.2, 0.8, 0.8]);
  mk(new THREE.SphereGeometry(0.01, 8, 6), mat(0xe07a8a), headG, [0, -0.008, 0.083]);
  for (const sd of [1, -1]) {
    mk(new THREE.ConeGeometry(0.03, 0.06, 4), furPlain, headG, [sd * 0.045, 0.07, -0.005], [0, 0, sd * -0.25]);
    mk(new THREE.ConeGeometry(0.018, 0.035, 4), mat(0xe8a0a0), headG, [sd * 0.045, 0.066, 0.006], [0, 0, sd * -0.25]);
    mk(new THREE.SphereGeometry(0.019, 10, 8), mat(0x6dd86a, { e: 0x1a4a10, ei: 0.4 }), headG, [sd * 0.032, 0.015, 0.068], [0, 0, 0], [1, 1.1, 0.6]);
    mk(new THREE.SphereGeometry(0.008, 6, 5), mat(0x050505), headG, [sd * 0.033, 0.015, 0.079], [0, 0, 0], [0.5, 1.4, 0.5]);
    for (const dy of [-0.02, -0.03]) mk(new THREE.BoxGeometry(0.07, 0.002, 0.002), mat(0xffffff), headG, [sd * 0.06, dy, 0.065], [0, sd * 0.25, sd * 0.1], null, false);
  }
  const jaw = grp(headG, 0, -0.04, 0.05);
  mk(new THREE.SphereGeometry(0.022, 8, 6), cream, jaw, [0, -0.008, 0.012], [0, 0, 0], [1.2, 0.5, 1]);
  const mouthIn = mk(new THREE.SphereGeometry(0.018, 8, 6), mat(0x7a2a30), headG, [0, -0.045, 0.06], [0, 0, 0], [1.2, 0.6, 0.6]);
  const pizza = grp(headG, 0, -0.05, 0.1);
  mk(new THREE.CircleGeometry(0.07, 3, -P / 6 + P / 2, P / 3), mat(0xe0602a, { side: THREE.DoubleSide }), pizza, [0, 0, 0], [-P / 2 + 0.3, 0, 0]);
  const legs = [];
  for (const [x, z] of [[0.05, 0.1], [-0.05, 0.1], [0.05, -0.1], [-0.05, -0.1]]) {
    const l = grp(body, x, -0.03, z);
    mk(new THREE.CapsuleGeometry(0.022, 0.1, 4, 8), furPlain, l, [0, -0.07, 0]);
    mk(new THREE.SphereGeometry(0.026, 8, 6), cream, l, [0, -0.13, 0.008]);
    legs.push({ l, front: z > 0 });
  }
  const tail = [];
  let parent = grp(body, 0, 0.03, -0.17);
  for (let i = 0; i < 8; i++) { const g = grp(parent, 0, 0, i === 0 ? 0 : -0.035); mk(new THREE.SphereGeometry(0.02 - i * 0.0012, 8, 6), i > 5 ? dark : furPlain, g, [0, 0, -0.018], [0, 0, 0], [1, 1, 1.6]); tail.push(g); parent = g; }
  return {
    root, headG,
    // st: { t, act, a, speed, phase, talk, pizza }
    update(st) {
      const { t, a } = st, act = st.act ?? 'idle';
      const run = clamp((st.speed ?? 0) / 1.5), ph = (st.phase ?? 0) * 2.2;
      body.position.y = 0.17 + Math.abs(Math.sin(ph)) * 0.025 * run; body.rotation.set(0, 0, 0);
      headG.rotation.set(0, 0, 0);
      legs.forEach((L, i) => { L.l.rotation.set(Math.sin(ph + (L.front ? 0 : P) + (i % 2) * 0.5) * 0.8 * run, 0, 0); });
      tail.forEach((g, i) => { g.rotation.set(-0.35 + 0.05 * i * (run > 0.3 ? -1 : 1), 0.3 * Math.sin(t * 3 - i * 0.6), 0); });
      if (act === 'sit' || act === 'play' || act === 'meow' || act === 'swipe' || act === 'laugh') {
        body.rotation.x = -0.55; body.position.y = 0.15;
        legs[2].l.rotation.x = 0.55 - 1.4; legs[3].l.rotation.x = 0.55 - 1.4; legs[0].l.rotation.x = 0.55; legs[1].l.rotation.x = 0.55;
        headG.rotation.x = 0.45;
      }
      if (act === 'play') { legs[0].l.rotation.x = -0.4 + 0.15 * Math.sin(t * 14); legs[1].l.rotation.x = -0.4 + 0.15 * Math.sin(t * 17 + 1); headG.rotation.x = 0.55; }
      if (act === 'swipe') { const k = smoothstep(0, 0.15, a) * (1 - smoothstep(0.4, 0.7, a)); legs[0].l.rotation.x = 0.55 - 2.2 * k; }
      if (act === 'laugh') { body.position.y = 0.15 + 0.012 * Math.abs(Math.sin(a * 14)); headG.rotation.x = 0.2 - 0.15 * Math.abs(Math.sin(a * 14)); }
      if (act === 'meow') headG.rotation.x = 0.25;
      if (act === 'sad') { headG.rotation.x = 0.35; tail.forEach((g) => { g.rotation.x = 0.15; }); }
      const talk = clamp((st.talk ?? 0) * 1.6 + (act === 'meow' || act === 'laugh' ? 0.5 + 0.3 * Math.sin(a * 20) : 0));
      jaw.rotation.x = talk * 0.6; mouthIn.visible = talk > 0.1;
      pizza.visible = (st.pizza ?? 0) > 0.5;
    },
  };
}

// ------------------------------------------------------------------ THE SOUL STEALER'S LAIR
function stoneTex(seed, base, line) {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    const R = rng(seed);
    for (let i = 0; i < 600; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + R() * 0.06})`; c.fillRect(R() * w, R() * h, 2 + R() * 6, 2 + R() * 6); }
    c.strokeStyle = line; c.lineWidth = 2;
    for (let i = 0; i < 14; i++) { c.beginPath(); let x = R() * w, y = R() * h; c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 50; c.lineTo(x, y); } c.stroke(); }
  }, { repeat: [8, 8] });
}
export function buildLair() {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0x8a7ac0, 0x18102a, 1.0); g.add(hemi);
  const key = new THREE.DirectionalLight(0xb0a8ff, 1.6); key.position.set(10, 18, 14); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 }); g.add(key);
  const glowA = new THREE.PointLight(0x4a8aff, 60, 40, 1.4); glowA.position.set(0, 6, -6); g.add(glowA);
  const front = new THREE.PointLight(0xc0b0ff, 40, 30, 1.3); front.position.set(2, 7, 10); g.add(front);
  plane(g, 70, 70, new THREE.MeshStandardMaterial({ map: stoneTex(4, '#2a2432', 'rgba(10,8,14,0.6)'), roughness: 0.95 }), [0, 0, 0]);
  const wallM = new THREE.MeshStandardMaterial({ map: stoneTex(9, '#241e2c', 'rgba(8,6,10,0.7)'), roughness: 1, side: THREE.BackSide });
  mk(new THREE.CylinderGeometry(26, 28, 20, 40, 1, true), wallM, g, [0, 10, -4], [0, 0, 0], null, false);
  mk(new THREE.CircleGeometry(27, 40), mat(0x120e16, { r: 1 }), g, [0, 19.5, -4], [P / 2, 0, 0], null, false);
  const R = rng(66);
  const rock = mat(0x2e2636, { r: 1 });
  for (let i = 0; i < 40; i++) { const a = R() * P * 2, r = 20 + R() * 5; mk(new THREE.IcosahedronGeometry(1.5 + R() * 3, 0), rock, g, [Math.cos(a) * r, R() * 2, Math.sin(a) * r - 4], [R(), R(), R()]); }
  for (let i = 0; i < 30; i++) { const a = R() * P * 2, r = 4 + R() * 20; mk(new THREE.ConeGeometry(0.4 + R() * 0.8, 2 + R() * 5, 6), rock, g, [Math.cos(a) * r, 18 - R() * 2, Math.sin(a) * r - 4], [P, 0, 0], null, false); }
  // glowing crystals
  const crystals = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * P * 2 + R() * 0.2, r = 18 + R() * 4;
    const m = mat(i % 3 ? 0x6a3ad0 : 0x3a7aff, { e: i % 3 ? 0x8a40ff : 0x3a8aff, ei: 1.2 });
    const c = mk(new THREE.OctahedronGeometry(0.6 + R() * 1.0, 0), m, g, [Math.cos(a) * r, 0.6 + R() * 3, Math.sin(a) * r - 4], [R(), R(), R()], [0.6, 1.8, 0.6]);
    crystals.push(c);
  }
  // braziers with fire light
  const braz = [];
  for (const [x, z] of [[-9, 6], [9, 6], [-12, -8], [12, -8]]) {
    mk(new THREE.CylinderGeometry(0.5, 0.3, 1.2, 10), mat(0x2a2a30, { m: 0.6, r: 0.4 }), g, [x, 0.6, z]);
    const fl = mk(new THREE.ConeGeometry(0.35, 0.9, 8), mat(0x8a40ff, { e: 0xa060ff, ei: 2.0 }), g, [x, 1.6, z], [0, 0, 0], null, false);
    const l = new THREE.PointLight(0xa060ff, 30, 16, 1.4); l.position.set(x, 2.2, z); g.add(l);
    braz.push({ fl, l });
  }
  // the cage
  const cage = grp(g, 0, 0, -6);
  const W = 16, H = 10, Dp = 20;
  const ironM = mat(0x3a3a44, { m: 0.75, r: 0.35 });
  const bar = new THREE.CylinderGeometry(0.12, 0.12, H, 8);
  for (let x = -W / 2; x <= W / 2 + 0.01; x += 1.1) { mk(bar, ironM, cage, [x, H / 2, -Dp / 2]); }
  for (let z = -Dp / 2; z <= Dp / 2 + 0.01; z += 1.1) { mk(bar, ironM, cage, [-W / 2, H / 2, z]); mk(bar, ironM, cage, [W / 2, H / 2, z]); }
  for (const y of [0.3, H / 2, H]) {
    box(cage, W + 0.6, 0.4, 0.4, 0, [0, y, -Dp / 2], { material: ironM }); box(cage, W + 0.6, 0.4, 0.4, 0, [0, y, Dp / 2], { material: ironM });
    box(cage, 0.4, 0.4, Dp + 0.6, 0, [-W / 2, y, 0], { material: ironM }); box(cage, 0.4, 0.4, Dp + 0.6, 0, [W / 2, y, 0], { material: ironM });
  }
  for (let x = -W / 2; x <= W / 2 + 0.01; x += 2.2) box(cage, 0.25, 0.25, Dp, 0, [x, H, 0], { material: ironM });
  // front: fixed side sections + two swinging doors
  for (const sd of [-1, 1]) for (let x = 3.3; x <= W / 2 + 0.01; x += 1.1) mk(bar, ironM, cage, [sd * x, H / 2, Dp / 2]);
  const doors = [];
  for (const sd of [-1, 1]) {
    const pv = grp(cage, sd * 3.2, 0, Dp / 2);
    for (let i = 0; i < 3; i++) mk(bar, ironM, pv, [-sd * (0.5 + i * 1.0), H / 2, 0]);
    for (const y of [0.6, H / 2, H - 0.6]) box(pv, 3.2, 0.3, 0.3, 0, [-sd * 1.6, y, 0], { material: ironM });
    doors.push({ pv, sd });
  }
  const lock = grp(g, 0, 4.6, -6 + Dp / 2 + 0.35);
  box(lock, 0.9, 0.8, 0.35, 0, [0, 0, 0], { material: mat(0x5a4a3a, { m: 0.7, r: 0.35 }), round: 0.06 });
  mk(new THREE.TorusGeometry(0.3, 0.07, 8, 18, P), ironM, lock, [0, 0.4, 0]);
  const lockGlow = mk(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb050ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), lock, [0, 0, 0], [0, 0, 0], null, false);
  return {
    name: 'lair', group: g, bg: new THREE.Color(0x07050c), fog: [0x0c0814, 18, 60], exposure: 1.05,
    update(t, X) {
      const v = X.val;
      const o = v('cage.open', 0);
      for (const d of doors) d.pv.rotation.y = d.sd * o * 1.7;
      const lf = v('lock.float', 0);
      lock.position.set(0, 4.6 + lf * 3.0 + 0.1 * Math.sin(t * 3) * lf, -6 + Dp / 2 + 0.35 + lf * 1.0);
      lock.rotation.set(0.3 * lf * Math.sin(t * 2), lf * t * 2, 0);
      lock.visible = v('lock.gone', 0) < 0.5;
      lockGlow.material.opacity = lf * (0.4 + 0.2 * Math.sin(t * 8));
      braz.forEach((b, i) => { const f = 0.8 + 0.2 * Math.sin(t * 11 + i * 2) + 0.1 * Math.sin(t * 23 + i); b.fl.scale.set(1, f, 1); b.l.intensity = 30 * f; });
      crystals.forEach((c, i) => { c.material.emissiveIntensity = 1.0 + 0.4 * Math.sin(t * 1.5 + i); });
      glowA.intensity = 60 + 40 * v('lair.glow', 0);
    },
  };
}

// ------------------------------------------------------------------ THE NIGHT ALLEY
function brickTex() {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#2a1a16'; c.fillRect(0, 0, w, h);
    const R = rng(21);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < w; x += 32) {
      const k = 0.7 + R() * 0.3;
      c.fillStyle = `rgb(${Math.floor(110 * k)},${Math.floor(48 * k)},${Math.floor(36 * k)})`;
      c.fillRect(x + 1, y + 1, 30, 14);
    }
  }, { repeat: [10, 4] });
}
export function buildAlley() {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0x4a5a8a, 0x08090e, 0.7); g.add(hemi);
  const moon = new THREE.DirectionalLight(0x8aa0ff, 0.6);
  const backGlow = new THREE.PointLight(0x3a5aaa, 30, 26, 1.2); backGlow.position.set(0, 4, -20); g.add(backGlow); moon.position.set(-6, 20, 10); g.add(moon);
  const lamp = new THREE.SpotLight(0xffc880, 60, 18, 0.9, 0.5, 1.3); lamp.position.set(1.7, 4.3, -1.0); lamp.target.position.set(0.2, 0, -1.6); lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024);
  g.add(lamp); g.add(lamp.target);
  const entrance = new THREE.PointLight(0x7a8aff, 8, 14, 1.4); entrance.position.set(0, 3, 9); g.add(entrance);
  const wet = new THREE.MeshStandardMaterial({ color: 0x15161c, roughness: 0.35, metalness: 0.3 });
  plane(g, 6, 60, wet, [0, 0, -14]);
  for (const [x, z, s] of [[0.6, -2.2, 1.2], [-0.8, -6, 0.9], [0.3, -11, 1.4], [-0.4, 3, 1.0]]) mk(new THREE.CircleGeometry(0.6, 20), new THREE.MeshStandardMaterial({ color: 0x20283a, roughness: 0.05, metalness: 0.7 }), g, [x, 0.006, z], [-P / 2, 0, 0], [s * 1.4, s, 1], false).receiveShadow = true;
  const bricks = new THREE.MeshStandardMaterial({ map: brickTex(), roughness: 0.9 });
  for (const sd of [-1, 1]) {
    box(g, 0.5, 9, 60, 0, [sd * 2.6, 4.5, -14], { material: bricks, noShadow: true });
    // doors, dark windows, pipes
    box(g, 0.08, 2.2, 1.1, 0x1a1a20, [sd * 2.33, 1.1, sd > 0 ? -5 : 1], { m: 0.4 });
    for (let i = 0; i < 6; i++) box(g, 0.06, 1.0, 0.8, 0x0a0c14, [sd * 2.33, 4.0 + (i % 2) * 2.4, -2 - i * 3.5], { e: i === 2 && sd > 0 ? 0x403010 : 0x000000, ei: 0.6 });
    mk(new THREE.CylinderGeometry(0.06, 0.06, 9, 8), mat(0x3a3a40, { m: 0.6, r: 0.4 }), g, [sd * 2.28, 4.5, sd > 0 ? -8 : -3]);
  }
  // fire escape on the left wall
  const fe = mat(0x1e1e24, { m: 0.6, r: 0.5 });
  for (const y of [3.2, 6.0]) { box(g, 0.9, 0.06, 3.2, 0, [-1.9, y, -7], { material: fe }); box(g, 0.04, 0.8, 3.2, 0, [-1.48, y + 0.4, -7], { material: fe }); }
  box(g, 0.06, 2.9, 0.7, 0, [-1.9, 4.6, -5.6], { material: fe, rot: [0.9, 0, 0] });
  // dumpster, crates, bags
  const dmp = grp(g, 1.75, 0, -6.5);
  box(dmp, 1.1, 1.2, 2.0, 0x1f3a2a, [0, 0.62, 0], { round: 0.04 });
  box(dmp, 1.15, 0.08, 2.05, 0x16281e, [0, 1.25, 0], { rot: [0, 0, 0.1] });
  for (const [x, z, s] of [[-1.7, -3.5, 0.6], [-1.75, -4.2, 0.5], [1.8, -10, 0.7]]) box(g, s, s, s, 0x5a4026, [x, s / 2, z], { rot: [0, 0.4, 0] });
  for (const [x, z] of [[1.8, -4.6], [1.6, -5.0], [-1.9, -9]]) mk(new THREE.SphereGeometry(0.35, 10, 8), mat(0x101012, { r: 0.4 }), g, [x, 0.28, z], [0, 0, 0], [1, 0.8, 1]);
  // the street light on its wall bracket
  box(g, 0.9, 0.06, 0.06, 0x2a2a30, [2.1, 4.5, -1.0], { m: 0.6 });
  const bulbM = mat(0xffe0a0, { e: 0xffc880, ei: 2.0 });
  const bulb = mk(new THREE.ConeGeometry(0.22, 0.25, 12, 1, true), mat(0x2a2a30, { m: 0.6, side: THREE.DoubleSide }), g, [1.7, 4.4, -1.0], [P, 0, 0]);
  const glass = mk(new THREE.SphereGeometry(0.1, 10, 8), bulbM, g, [1.7, 4.3, -1.0]);
  // night sky strip
  mk(new THREE.PlaneGeometry(5, 60), new THREE.MeshBasicMaterial({ color: 0x0a1028 }), g, [0, 9.2, -14], [P / 2, 0, 0], null, false);
  // the two small lights in the darkness at the end of the alley
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0 });
  const eyes = [];
  for (const sd of [-1, 1]) eyes.push(mk(new THREE.SphereGeometry(0.11, 10, 8), eyeM, g, [sd * 0.32, 1.4, -24], [0, 0, 0], [1.4, 0.7, 1], false));
  eyeM.fog = false;
  const eyeLight = new THREE.PointLight(0xffa030, 0, 5, 1.6); eyeLight.position.set(0, 1.4, -25.6); g.add(eyeLight);
  // the clay figure on the ground
  const clay = buildClayFigure(1.6); g.add(clay);
  const clayLight = new THREE.PointLight(0x3a8aff, 0, 1.4, 1.6); g.add(clayLight);
  return {
    name: 'alley', group: g, bg: new THREE.Color(0x0a1022), fog: [0x0a1226, 8, 30], exposure: 1.35,
    update(t, X) {
      const v = X.val;
      const fl = v('alley.flicker', 1);
      const on = fl < 0.5 || hash(Math.floor(t * 12)) > 0.18 || (Math.floor(t * 0.7) % 3 !== 0);
      const k = on ? 1 : 0.15;
      lamp.intensity = 60 * k; bulbM.emissiveIntensity = 2.0 * k;
      const ey = v('alley.eyes', 0);
      eyeM.opacity = ey * (Math.sin(t * 0.9) > 0.93 ? 0.1 : 1); eyeLight.intensity = ey * 2.5;
      clay.visible = v('clay.ground', 1) > 0.5;
      clay.position.set(v('clay.x', 0.35), 0.01, v('clay.z', -1.6)); clay.rotation.y = 0.6;
      const cg = v('clay.glow', 0);
      clayMat.emissiveIntensity = cg * (0.7 + 0.3 * Math.sin(t * 3));
      clayLight.position.set(clay.position.x, 0.15, clay.position.z); clayLight.intensity = clay.visible ? cg * 1.2 : 0;
      for (const l of clayLights) l.intensity = cg * (0.7 + 0.3 * Math.sin(t * 3)) * 0.9;
    },
  };
}
