// Season 2 character builder: realistic-but-cartoon bodies, sculpted heads with eyelids,
// detailed strand-clump hair that bounces, fingers with hand poses, and the remade Season 2 suits.
// Same joint layout and API as buildHero (characters.js) so every action, prop and episode tool keeps working.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, mk, grp, rng, clamp, lerp, smoothstep, noise1, canvasTex } from './util.js';
import { emblemTex } from './textures.js';

const P = Math.PI, S = Math.sin, C = Math.cos;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- geometry helpers
function lathe(profile, seg = 28, phiStart = 0, phiLen = P * 2) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), seg, phiStart, phiLen);
}

// tapered tube along a curve, flattened across `out` (the direction away from `center`), like a lock of hair
function taperTube(pts, r0, o = {}) {
  const { flat = 0.55, radial = 8, segs = 14, rTip = 0.0, center = null, swell = 0.25 } = o;
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const pos = [], uv = [], idx = [];
  const T = new THREE.Vector3(), out = new THREE.Vector3(), side = new THREE.Vector3(), n2 = new THREE.Vector3(), p = new THREE.Vector3();
  let prevSide = null;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, T);
    if (center) out.copy(p).add(center).normalize(); else out.set(0, 1, 0);
    side.crossVectors(T, out);
    if (side.lengthSq() < 1e-6) side.copy(prevSide ?? V3(1, 0, 0));
    side.normalize();
    if (prevSide && side.dot(prevSide) < 0) side.negate();
    prevSide = side.clone();
    n2.crossVectors(side, T).normalize();
    // thick just after the root, tapering to a point
    const rr = lerp(r0, rTip, Math.pow(u, 1.25)) * (1 + swell * S(Math.min(1, u * 2.2) * P));
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * P * 2;
      const cx = C(a) * rr, cy = S(a) * rr * flat;
      pos.push(p.x + side.x * cx + n2.x * cy, p.y + side.y * cx + n2.y * cy, p.z + side.z * cx + n2.z * cy);
      uv.push(j / radial, u);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// sculpted head: narrower jaw, small chin, rounder back of the skull
function headGeo(r, o = {}) {
  const g = new THREE.SphereGeometry(r, 48, 36);
  const a = g.attributes.position;
  const jaw = o.jaw ?? 0.2, chin = o.chin ?? 0.06;
  for (let i = 0; i < a.count; i++) {
    let x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    const ny = y / r, nz = z / r;
    if (ny < 0) {
      const k = Math.pow(-ny, 1.3);
      x *= 1 - jaw * k;
      z *= 1 - jaw * 0.35 * k;
      if (nz > 0.2 && ny < -0.45) z += chin * r * smoothstep(-0.45, -0.85, ny) * smoothstep(0.2, 0.7, nz);
    }
    if (nz < -0.1 && ny > -0.4) z *= 1.06;
    if (ny > -0.45 && ny < 0.15 && nz > 0.35) x *= 1.03; // cheeks
    a.setXYZ(i, x * 0.93, y * 1.07, z * 1.0);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- textures
const texCache = {};
function hairTex(hex) {
  const key = 'hair' + hex;
  if (texCache[key]) return texCache[key];
  const base = new THREE.Color(hex);
  const css = (c) => `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
  const R = rng(hex % 9973 + 5);
  const map = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = css(base); ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = R() * w, k = R();
      const c = base.clone().lerp(k > 0.55 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000), k > 0.55 ? 0.08 + 0.14 * R() : 0.15 + 0.3 * R());
      ctx.strokeStyle = css(c); ctx.globalAlpha = 0.35 + 0.4 * R(); ctx.lineWidth = 0.6 + R() * 1.4;
      ctx.beginPath(); ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (R() - 0.5) * 10, h * 0.33, x + (R() - 0.5) * 10, h * 0.66, x + (R() - 0.5) * 8, h); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, { repeat: [3, 1] });
  const bump = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const x = R() * w; ctx.strokeStyle = R() > 0.5 ? '#c8c8c8' : '#3a3a3a'; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.8 + R();
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (R() - 0.5) * 8, h); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, { repeat: [3, 1] });
  bump.colorSpace = THREE.NoColorSpace;
  return (texCache[key] = { map, bump });
}

function irisTex(hex) {
  const key = 'iris' + hex;
  if (texCache[key]) return texCache[key];
  const c = new THREE.Color(hex);
  const css = (k, a = 1) => `rgba(${Math.round(Math.min(1, c.r * k) * 255)},${Math.round(Math.min(1, c.g * k) * 255)},${Math.round(Math.min(1, c.b * k) * 255)},${a})`;
  const R = rng(hex % 7919 + 3);
  return (texCache[key] = canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, css(1.9)); g.addColorStop(0.45, css(1.25)); g.addColorStop(0.85, css(0.8)); g.addColorStop(1, css(0.35));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(64, 64, 63, 0, P * 2); ctx.fill();
    for (let i = 0; i < 70; i++) {
      const a = R() * P * 2; ctx.strokeStyle = R() > 0.5 ? css(2.2, 0.35) : css(0.5, 0.35); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(64 + C(a) * 18, 64 + S(a) * 18); ctx.lineTo(64 + C(a) * 58, 64 + S(a) * 58); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(64, 64, 61, 0, P * 2); ctx.stroke();
  }));
}

function fabricTex(hex, seams = true) {
  const key = 'fab' + hex + seams;
  if (texCache[key]) return texCache[key];
  const c = new THREE.Color(hex);
  const css = (k) => `rgb(${Math.round(Math.min(1, c.r * k) * 255)},${Math.round(Math.min(1, c.g * k) * 255)},${Math.round(Math.min(1, c.b * k) * 255)})`;
  return (texCache[key] = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = css(1); ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.18;
    for (let y = 0; y < h; y += 4) { ctx.fillStyle = css(y % 8 ? 1.25 : 0.75); ctx.fillRect(0, y, w, 2); }
    for (let x = 0; x < w; x += 4) { ctx.fillStyle = css(x % 8 ? 1.2 : 0.8); ctx.fillRect(x, 0, 2, h); }
    ctx.globalAlpha = 1;
    if (seams) { ctx.strokeStyle = css(0.55); ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2); }
  }, { repeat: [3, 3] }));
}

// ---------------------------------------------------------------- face
function buildFaceS2(head, cfg, hc, r) {
  const F = { eyes: [], brows: [] };
  const skinM = mat(cfg.skin, { r: 0.5 });
  const lidM = mat(cfg.skinDark ?? cfg.skin, { r: 0.5 });
  const white = mat(0xfbfbfb, { r: 0.18 }).clone();
  F.whiteM = white;
  const iris = new THREE.MeshStandardMaterial({ map: irisTex(cfg.eyeColor), roughness: 0.2, color: 0xffffff });
  const pupil = mat(0x050507, { r: 0.1 });
  const shine = mat(0xffffff, { basic: true });
  const lash = mat(0x140c08, { r: 0.6 });
  const es = cfg.eyeSize ?? 1;
  for (const s of [1, -1]) {
    const eg = grp(head, s * r * 0.36, hc + r * 0.1, r * 0.8);
    eg.rotation.y = s * 0.32;
    const eye = grp(eg);
    const er = r * 0.21 * es;
    mk(new THREE.SphereGeometry(er, 24, 18), white, eye, [0, 0, 0], [0, 0, 0], [0.92, 1.0, 0.55], false);
    const ir = grp(eye, 0, 0, er * 0.565);
    mk(new THREE.CircleGeometry(er * 0.62, 28), iris, ir, [0, 0, 0], [0, 0, 0], null, false);
    mk(new THREE.CircleGeometry(er * 0.27, 20), pupil, ir, [0, 0, 0.0008], [0, 0, 0], null, false);
    mk(new THREE.CircleGeometry(er * 0.13, 12), shine, ir, [er * 0.2, er * 0.2, 0.0016], [0, 0, 0], null, false);
    mk(new THREE.CircleGeometry(er * 0.06, 10), shine, ir, [-er * 0.18, -er * 0.16, 0.0016], [0, 0, 0], null, false);
    // upper lid (rotates down to blink / squint) with a lash line, and a small lower lid
    const lidP = grp(eye);
    mk(new THREE.SphereGeometry(er * 1.08, 24, 12, 0, P * 2, 0, P * 0.5), lidM, lidP, [0, 0, 0], [0, 0, 0], [0.95, 1.0, 0.62], false);
    mk(new THREE.TorusGeometry(er * 1.02, er * 0.075, 6, 24, P), lash, lidP, [0, 0, 0], [P / 2, 0, 0], [0.95, 0.62, 1], false);
    const loP = grp(eye);
    mk(new THREE.SphereGeometry(er * 1.05, 20, 8, 0, P * 2, P * 0.72, P * 0.28), lidM, loP, [0, 0, 0], [0, 0, 0], [0.95, 1.0, 0.6], false);
    F.eyes.push({ eg, eye, ir, lidP, loP, er });
  }
  const browM = mat(cfg.browColor ?? cfg.hairColor ?? 0x2a1a10, { r: 0.8 });
  for (const s of [1, -1]) {
    const bg = grp(head, s * r * 0.37, hc + r * 0.4, r * 0.86);
    bg.rotation.y = s * 0.34;
    const pts = [V3(-s * r * 0.17, -r * 0.02, 0), V3(-s * r * 0.05, r * 0.035, r * 0.01), V3(s * r * 0.08, r * 0.03, 0), V3(s * r * 0.18, -r * 0.03, -r * 0.02)];
    mk(taperTube(pts, r * 0.048 * (cfg.browThick ?? 1), { flat: 0.45, rTip: r * 0.015, swell: 0.1, segs: 10 }), browM, bg, [0, 0, 0], [0, 0, 0], null, false);
    F.brows.push({ bg, s });
  }
  // nose: bridge + rounded tip + nostrils
  const noseM = mat(cfg.skinDark ?? cfg.skin, { r: 0.5 });
  mk(new THREE.CapsuleGeometry(r * 0.055, r * 0.22, 4, 10), skinM, head, [0, hc - r * 0.02, r * 0.93], [-0.32, 0, 0], [1, 1, 0.9]);
  mk(new THREE.SphereGeometry(r * 0.1, 16, 12), noseM, head, [0, hc - r * 0.16, r * 1.0], [0, 0, 0], [1.15, 0.9, 0.95]);
  for (const s of [1, -1]) {
    mk(new THREE.SphereGeometry(r * 0.065, 12, 10), noseM, head, [s * r * 0.08, hc - r * 0.2, r * 0.95], [0, 0, 0], [1, 0.8, 0.9]);
    mk(new THREE.SphereGeometry(r * 0.025, 8, 6), mat(0x3a1a12, { r: 0.8 }), head, [s * r * 0.055, hc - r * 0.235, r * 0.985], [0, 0, 0], [1, 0.6, 1], false);
  }
  // ears with an inner ridge
  for (const s of [1, -1]) {
    const eg = grp(head, s * r * 0.9, hc + r * 0.02, -r * 0.06);
    eg.rotation.y = s * 0.25;
    mk(new THREE.SphereGeometry(r * 0.2, 14, 12), skinM, eg, [0, 0, 0], [0, 0, 0], [0.32, 1, 0.72]);
    mk(new THREE.TorusGeometry(r * 0.1, r * 0.025, 6, 14, P * 1.5), noseM, eg, [s * r * 0.05, 0, 0.0], [0, s * P / 2, -0.8], null, false);
  }
  // cheeks: soft blush
  for (const s of [1, -1]) mk(new THREE.CircleGeometry(r * 0.14, 16), new THREE.MeshBasicMaterial({ color: 0xff6a6a, transparent: true, opacity: 0.12, depthWrite: false }), head, [s * r * 0.5, hc - r * 0.2, r * 0.83], [0, s * 0.55, 0], null, false);
  // mouth: smile line + lips; open mouth with teeth and tongue
  const mg = grp(head, 0, hc - r * 0.46, r * 0.86);
  mg.rotation.x = -0.3;
  const lipC = new THREE.Color(cfg.lip ?? 0xb0584e);
  F.smile = mk(new THREE.TorusGeometry(r * 0.22, r * 0.03, 6, 20, P), mat(lipC.clone().multiplyScalar(0.7).getHex(), { r: 0.5 }), mg, [0, 0, 0.006], [0, 0, P], null, false);
  F.lowerLip = mk(new THREE.SphereGeometry(r * 0.13, 16, 10), mat(lipC.getHex(), { r: 0.4 }), mg, [0, -r * 0.075, -r * 0.03], [0, 0, 0], [1.15, 0.35, 0.5], false);
  F.open = grp(mg, 0, r * 0.03, 0.008);
  mk(new THREE.CircleGeometry(r * 0.27, 24), mat(0x3a0e14, { r: 0.7 }), F.open, [0, 0, 0], [0, 0, 0], [1, 0.62, 1], false);
  mk(new RoundedBoxGeometry(r * 0.38, r * 0.08, r * 0.02, 2, r * 0.02), mat(0xfafafa, { r: 0.25 }), F.open, [0, r * 0.11, 0.002], [0, 0, 0], null, false);
  mk(new THREE.CircleGeometry(r * 0.14, 16, P, P), mat(0xd86a72, { r: 0.6 }), F.open, [0, -r * 0.1, 0.003], [0, 0, 0], [1.25, 0.65, 1], false);
  mk(new THREE.TorusGeometry(r * 0.27, r * 0.035, 6, 24), mat(lipC.getHex(), { r: 0.4 }), F.open, [0, 0, 0.004], [0, 0, 0], [1, 0.62, 1], false);
  F.mg = mg; F.iris = iris;
  return F;
}

// Greg: smooth glossy white head, two black line eyes (no mouth), as always
function buildGregFaceS2(head, hc, r) {
  const black = mat(0x050505, { r: 0.25 }).clone();
  const eyes = [];
  for (const sd of [1, -1]) {
    const eg = grp(head, sd * r * 0.3, hc + r * 0.12, r * 0.95);
    eg.rotation.y = sd * 0.3;
    const eye = grp(eg);
    mk(new THREE.CapsuleGeometry(r * 0.065, r * 0.34, 6, 12), black, eye, [0, 0, 0], [0, 0, 0], [1.05, 1, 1.4], false);
    mk(new THREE.SphereGeometry(r * 0.02, 8, 6), mat(0xffffff, { basic: true }), eye, [r * 0.02, r * 0.12, r * 0.07], [0, 0, 0], null, false);
    eyes.push({ eg, eye, ir: new THREE.Group() });
  }
  const dummy = () => new THREE.Group();
  return { eyes, brows: [], smile: dummy(), open: dummy(), mg: dummy(), iris: black, greg: true };
}

// ---------------------------------------------------------------- hair
const sph = (az, el) => V3(S(az) * C(el), S(el), C(az) * C(el));

function hairStyleSpecs(style, R) {
  const L = [];
  const add = (o) => L.push(o);
  const j = (a) => (R() - 0.5) * a;
  if (style === 'spiky') { // Aaron: swept-up anime spikes, forward fringe that flicks up
    for (let k = 0; k < 8; k++) { const az = -0.82 + k * 0.235 + j(0.08); add({ az, el: 0.95 + j(0.1), dir: [S(az) * 0.5, -0.35, 1], lift: 0.28, len: 0.7 + R() * 0.2, w: 0.21, curl: [0, 0.55, 0.0], stiff: 0.55 }); }
    for (let k = 0; k < 11; k++) { const az = 0.7 + R() * (P * 2 - 1.4); add({ az, el: 1.12 + R() * 0.35, dir: [S(az) * 0.55, 1.0, C(az) * 0.5 - 0.55], lift: 0.6, len: 0.75 + R() * 0.32, w: 0.2, curl: [0, 0.18, -0.28], stiff: 0.65 }); }
    for (let k = 0; k < 5; k++) { const az = j(0.9); add({ az, el: 1.3 + R() * 0.2, dir: [S(az) * 0.3, 1, 0.25], lift: 0.7, len: 0.7 + R() * 0.25, w: 0.2, curl: [0, 0.2, -0.3], stiff: 0.65 }); }
    for (let k = 0; k < 16; k++) { const az = 1.0 + (k / 15) * (P * 2 - 2.0) + j(0.15); add({ az, el: 0.25 + R() * 0.6, dir: [S(az), -0.05, C(az) - 0.45], lift: 0.25, len: 0.45 + R() * 0.3, w: 0.19, curl: [0, 0.45, -0.25], stiff: 0.55 }); }
    return { L, hairline: [0.52, 0.2, -0.5] };
  }
  if (style === 'tall') { // Flare: tall black spikes standing up
    for (let k = 0; k < 18; k++) { const az = R() * P * 2; add({ az, el: 1.05 + R() * 0.45, dir: [S(az) * 0.28, 1, C(az) * 0.28 - 0.12], lift: 0.85, len: 0.95 + R() * 0.55, w: 0.19, curl: [0, 0.12, -0.08], stiff: 0.7 }); }
    for (let k = 0; k < 6; k++) { const az = -0.7 + k * 0.28 + j(0.08); add({ az, el: 0.95, dir: [S(az) * 0.3, 1, 0.5], lift: 0.6, len: 0.8 + R() * 0.3, w: 0.18, curl: [0, 0.3, -0.1], stiff: 0.7 }); }
    for (let k = 0; k < 12; k++) { const az = 0.9 + (k / 11) * (P * 2 - 1.8); add({ az, el: 0.35 + R() * 0.5, dir: [S(az) * 0.8, 0.9, C(az) * 0.8 - 0.3], lift: 0.4, len: 0.55 + R() * 0.3, w: 0.18, curl: [0, 0.35, -0.1], stiff: 0.65 }); }
    return { L, hairline: [0.62, 0.22, -0.45] };
  }
  if (style === 'wavy') { // Eric: soft brown waves, bangs swept to one side
    for (let k = 0; k < 34; k++) { const az = 0.75 + R() * (P * 2 - 1.5); const el = 0.3 + R() * 1.15; add({ az, el, dir: [S(az) * 0.75, -0.3 + el * 0.25, C(az) * 0.75 - 0.3], lift: 0.32, len: 0.5 + R() * 0.28, w: 0.22, wave: 0.55, flat: 0.55, stiff: 0.35 }); }
    for (let k = 0; k < 9; k++) { const az = -0.7 + R() * 1.4; add({ az, el: 1.15 + R() * 0.35, dir: [0.5, 0.5, -0.3], lift: 0.45, len: 0.5 + R() * 0.25, w: 0.23, wave: 0.5, stiff: 0.35 }); }
    for (let k = 0; k < 6; k++) { const az = -0.65 + k * 0.2; add({ az, el: 0.95 + j(0.08), dir: [0.85, -0.25, 0.55], lift: 0.3, len: 0.55 + R() * 0.15, w: 0.2, wave: 0.35, curl: [0.1, -0.15, 0], stiff: 0.35 }); }
    return { L, hairline: [0.6, 0.18, -0.55] };
  }
  if (style === 'swept') { // Leon: slicked back with volume, gray streak
    for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) { const az = -0.95 + k * 0.32 + j(0.1); add({ az, el: 0.85 + row * 0.22 + j(0.06), dir: [S(az) * 0.2, 0.35 - row * 0.1, -1], lift: 0.18, len: 0.6 + R() * 0.25, w: 0.23, curl: [0, -0.1, -0.15], stiff: 0.6, streak: row === 0 && k === 4 }); }
    for (let k = 0; k < 12; k++) { const az = 1.1 + (k / 11) * (P * 2 - 2.2); add({ az, el: 0.25 + R() * 0.55, dir: [S(az) * 0.4, -0.25, -1], lift: 0.15, len: 0.42 + R() * 0.2, w: 0.2, stiff: 0.6 }); }
    return { L, hairline: [0.65, 0.2, -0.5] };
  }
  if (style === 'short') {
    for (let k = 0; k < 26; k++) { const az = R() * P * 2, el = 0.3 + R() * 1.2; if (C(az) > 0.6 && el < 0.85) continue; add({ az, el, dir: [S(az) * 0.5, 0.4, C(az) * 0.5 - 0.3], lift: 0.4, len: 0.22 + R() * 0.12, w: 0.2, stiff: 0.8 }); }
    return { L, hairline: [0.62, 0.0, -0.55] };
  }
  if (style === 'long' || style === 'ponytail' || style === 'bun') {
    for (let k = 0; k < 16; k++) { const az = -0.9 + R() * 1.8; add({ az, el: 1.05 + R() * 0.45, dir: [S(az) * 0.7 + (az > 0 ? 0.4 : -0.4), -0.3, -0.7], lift: 0.1, len: 0.55 + R() * 0.2, w: 0.24, flat: 0.4, stiff: 0.4 }); }
    if (style === 'long') for (let k = 0; k < 36; k++) { const az = 0.95 + (k / 35) * (P * 2 - 1.9); add({ az, el: 0.3 + R() * 0.75, dir: [S(az) * 0.25, -1, C(az) * 0.25 - 0.1], lift: 0.08, len: 1.5 + R() * 0.5, w: 0.27, flat: 0.4, grav: 0.25, wave: 0.15, stiff: 0.25, tip: 0.45 }); }
    return { L, hairline: [0.58, -0.05, -0.6], extra: style };
  }
  if (style === 'curly') {
    return { L, hairline: [0.6, 0.0, -0.55], extra: 'curly' };
  }
  if (style === 'fringe') { // bald on top, a ring of hair around the sides (Gus)
    for (let k = 0; k < 20; k++) { const az = 1.2 + (k / 19) * (P * 2 - 2.4); add({ az, el: 0.15 + R() * 0.3, dir: [S(az) * 0.4, -0.2, C(az) * 0.4 - 0.5], lift: 0.25, len: 0.25 + R() * 0.1, w: 0.2, stiff: 0.8 }); }
    return { L, hairline: null, extra: 'fringe' };
  }
  return { L, hairline: [0.6, 0.0, -0.55] };
}

function buildHairS2(head, cfg, hc, r) {
  const R = rng(cfg.seed * 131 + 7);
  const tx = hairTex(cfg.hairColor);
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tx.map, bumpMap: tx.bump, bumpScale: 0.6, roughness: 0.48, metalness: 0.05 });
  cfg._hairMat = m;
  const g = grp(head, 0, hc, 0);
  const style = cfg.hair;
  const spec = hairStyleSpecs(style, R);
  // scalp shell with a real hairline: vertices below the hairline sink inside the head
  if (spec.hairline) {
    const [front, sides, back] = spec.hairline;
    const cap = new THREE.SphereGeometry(r * 1.035, 56, 40);
    const a = cap.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      const az = Math.atan2(x, z);
      const f = (C(az) + 1) / 2; // 1 front, 0 back
      const hl = f > 0.5 ? lerp(sides, front, smoothstep(0.5, 0.92, f)) : lerp(back, sides, smoothstep(0, 0.5, f));
      const ny = y / (r * 1.035);
      const k = smoothstep(hl - 0.1, hl + 0.06, ny);
      const sc = lerp(0.84, 1.0 + (cfg.volume ?? 0.05), k);
      a.setXYZ(i, x * 0.93 * sc, y * 1.07 * sc, z * 1.0 * sc);
    }
    cap.computeVertexNormals();
    mk(cap, m, g, [0, 0, -r * 0.01]);
  }
  const streakM = cfg.streakColor ? new THREE.MeshStandardMaterial({ color: 0xffffff, map: hairTex(cfg.streakColor).map, roughness: 0.45 }) : null;
  const clumps = [];
  const center = V3(0, 0, 0);
  for (const c of spec.L) {
    const root = sph(c.az, c.el).multiply(V3(0.93, 1.07, 1.0)).multiplyScalar(r * 0.97);
    const n = root.clone().normalize();
    const want = V3(...c.dir).normalize();
    const tang = want.clone().sub(n.clone().multiplyScalar(want.dot(n)));
    if (tang.lengthSq() < 1e-4) tang.set(0, 0, -1);
    let d = tang.normalize().multiplyScalar(1 - c.lift).add(n.clone().multiplyScalar(c.lift)).normalize();
    const len = c.len * r, steps = 6, seg = len / steps;
    const pts = [root.clone().sub(n.clone().multiplyScalar(r * 0.06)), root.clone()];
    let p = root.clone();
    const sideAx = V3().crossVectors(d, n).normalize();
    for (let i = 1; i <= steps; i++) {
      p = p.clone().add(d.clone().multiplyScalar(seg));
      if (c.curl) d.add(V3(...c.curl).multiplyScalar(0.35));
      if (c.grav) d.add(V3(0, -c.grav, 0));
      if (c.wave) d.add(sideAx.clone().multiplyScalar(S(i * 1.7 + c.az * 3) * c.wave * 0.5));
      d.normalize();
      const ell = V3(p.x / 0.93, p.y / 1.07, p.z);
      if (ell.length() < r * 1.03) { const k = (r * 1.03) / ell.length(); p.set(p.x * k, p.y * k, p.z * k); }
      pts.push(p.clone());
    }
    const local = pts.map((q) => q.clone().sub(root));
    const geo = taperTube(local, c.w * r * (cfg.lockW ?? 1.45), { flat: c.flat ?? 0.5, center: root, segs: 14, swell: 0.35, rTip: c.w * r * (cfg.lockW ?? 1.45) * (c.tip ?? 0) });
    const piv = grp(g, root.x, root.y, root.z);
    mk(geo, c.streak && streakM ? streakM : m, piv);
    clumps.push({ piv, flex: clamp((c.len) * (1 - (c.stiff ?? 0.5)), 0, 1.4), ph: R() * 6 });
  }
  if (spec.extra === 'curly') {
    for (let k = 0; k < 70; k++) {
      const az = R() * P * 2, el = 0.15 + R() * 1.35; if (C(az) > 0.55 && el < 0.85) continue;
      const q = sph(az, el).multiply(V3(0.93, 1.07, 1)).multiplyScalar(r * (1.08 + R() * 0.08));
      mk(new THREE.SphereGeometry(r * (0.17 + R() * 0.07), 10, 8), m, g, [q.x, q.y, q.z]);
    }
  }
  if (spec.extra === 'bun') { mk(new THREE.SphereGeometry(r * 0.36, 18, 14), m, g, [0, r * 0.75, -r * 0.7], [0.5, 0, 0], [1, 0.85, 0.85]); mk(new THREE.TorusGeometry(r * 0.22, r * 0.05, 6, 16), m, g, [0, r * 0.62, -r * 0.62], [0.9, 0, 0]); }
  if (spec.extra === 'ponytail') {
    mk(new THREE.TorusGeometry(r * 0.1, r * 0.04, 6, 12), mat(cfg.tie ?? 0xd03a5a, { r: 0.5 }), g, [0, r * 0.35, -r * 1.0], [0.4, 0, 0]);
    const piv = grp(g, 0, r * 0.35, -r * 1.02);
    mk(taperTube([V3(0, 0, 0), V3(0, -r * 0.3, -r * 0.25), V3(0, -r * 0.8, -r * 0.3), V3(0, -r * 1.4, -r * 0.15)], r * 0.16, { flat: 0.7, swell: 0.4 }), m, piv);
    clumps.push({ piv, flex: 1.2, ph: 1 });
  }
  return { g, clumps };
}

// ---------------------------------------------------------------- hand with fingers
const HAND = {
  relaxed: { c1: 0.35, c2: 0.45, th: 0.25, idx: null },
  fist: { c1: 1.45, c2: 1.6, th: 1.0, idx: null },
  open: { c1: 0.04, c2: 0.06, th: -0.15, idx: null },
  point: { c1: 1.45, c2: 1.6, th: 0.9, idx: [0.0, 0.05] },
  grip: { c1: 0.95, c2: 1.05, th: 0.6, idx: null },
  thumb: { c1: 1.45, c2: 1.6, th: -0.5, idx: null },
  spread: { c1: 0.0, c2: 0.0, th: -0.35, idx: null, spread: 1 },
};

function buildHand(el, s, gloveM, skinM, o = {}) {
  const hand = grp(el, 0, -0.27, 0);
  const palmM = o.bare ? skinM : gloveM;
  mk(new RoundedBoxGeometry(0.03, 0.082, 0.072, 3, 0.012), palmM, hand, [0, -0.045, 0]);
  if (o.knuckleGlow) mk(new THREE.BoxGeometry(0.012, 0.008, 0.062), o.knuckleGlow, hand, [s * 0.016, -0.08, 0]);
  const fingers = [];
  const zs = [0.026, 0.009, -0.008, -0.025], lens = [0.03, 0.033, 0.031, 0.025];
  for (let i = 0; i < 4; i++) {
    const f1 = grp(hand, 0, -0.086, zs[i]);
    mk(new THREE.CapsuleGeometry(0.0105, lens[i], 3, 8), palmM, f1, [0, -lens[i] / 2, 0]);
    const f2 = grp(f1, 0, -lens[i] - 0.004, 0);
    mk(new THREE.CapsuleGeometry(0.0095, lens[i] * 0.8, 3, 8), palmM, f2, [0, -lens[i] * 0.4, 0]);
    fingers.push({ f1, f2, i });
  }
  const th = grp(hand, -s * 0.004, -0.035, 0.036);
  th.rotation.set(0.5, 0, s * 0.35);
  mk(new THREE.CapsuleGeometry(0.012, 0.026, 3, 8), palmM, th, [0, -0.016, 0]);
  const th2 = grp(th, 0, -0.034, 0);
  mk(new THREE.CapsuleGeometry(0.0105, 0.02, 3, 8), palmM, th2, [0, -0.012, 0]);
  return { hand, fingers, th, th2, s };
}

function poseHand(H, hp) {
  const s = H.s;
  for (const f of H.fingers) {
    let c1 = hp.c1, c2 = hp.c2;
    if (hp.idx && f.i === 0) { c1 = hp.idx[0]; c2 = hp.idx[1]; }
    const fan = (hp.spread ?? 0) * (f.i - 1.5) * 0.12;
    f.f1.rotation.set(fan, 0, -s * c1);
    f.f2.rotation.set(0, 0, -s * c2);
  }
  H.th.rotation.set(0.5 + hp.th * 0.4, 0, s * (0.35 + hp.th * 0.6));
  H.th2.rotation.set(0, 0, s * hp.th * 0.5);
}

// which hand shape goes with which action
const FIST = ['punch', 'powerFist', 'fistPump', 'fistsClench', 'ready', 'brace', 'struggle', 'groundPound', 'yell', 'cheer', 'cheerJump', 'taunt', 'dodge', 'tug', 'sprintS2', 'determinedS2'];
const OPEN = ['wave', 'armsOut', 'welcome', 'shrug', 'shrugBig', 'gasp', 'jumpScare', 'stumble', 'boo', 'blastPose', 'oneHandBlast', 'pushHeat', 'catchItem', 'catchS2', 'stop', 'stopS2', 'tumble', 'fly', 'conjure', 'holdUpBoth', 'highFive', 'slipS2', 'flailS2', 'facepalm', 'handsHips', 'heartS2', 'presentS2'];
const GRIP = ['holdCase', 'carryS2', 'carryBig', 'pushCart', 'holdDevice', 'phone', 'mic', 'eatBar', 'readBook', 'showItem', 'raiseItem', 'giveItem', 'toastS2', 'eatS2', 'carveS2', 'tugS2', 'grabS2', 'hugTurkey'];
export function handShapeFor(act, side, hasProp) {
  if (hasProp) return HAND.grip;
  if (act === 'point' || act === 'pointUp' || act === 'pointS2') return side === 'R' ? HAND.point : HAND.relaxed;
  if (act === 'thumbsUp') return side === 'R' ? HAND.thumb : HAND.relaxed;
  if (FIST.includes(act)) return HAND.fist;
  if (OPEN.includes(act)) return HAND.open;
  if (GRIP.includes(act)) return HAND.grip;
  return HAND.relaxed;
}
const blendHand = (a, b, w) => ({ c1: lerp(a.c1, b.c1, w), c2: lerp(a.c2, b.c2, w), th: lerp(a.th, b.th, w), idx: (w > 0.5 ? b : a).idx, spread: lerp(a.spread ?? 0, b.spread ?? 0, w) });

// ---------------------------------------------------------------- the hero
export function buildHeroS2(cfg) {
  const root = new THREE.Group();
  root.name = cfg.name;
  const J = {};
  const casual = !!cfg.casual;
  const glowC = cfg.glow ?? 0x4ad8ff;
  const suitM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: fabricTex(cfg.suit ?? 0x111a46, false), roughness: 0.62 });
  const plateM = mat(cfg.plate ?? 0x2453d6, { r: 0.32, m: 0.25 });
  const plateDark = mat(cfg.plateDark ?? 0x0d1648, { r: 0.4, m: 0.2 });
  const trimM = mat(cfg.trim ?? 0xe9eef7, { r: 0.3, m: 0.1 });
  const accent = new THREE.MeshStandardMaterial({ color: glowC, emissive: glowC, emissiveIntensity: 1.4, roughness: 0.3 });
  const gloveM = (casual && !cfg.glove) ? mat(cfg.skin, { r: 0.5 }) : mat(cfg.glove ?? 0x10173f, { r: 0.55 }).clone();
  const skinM = mat(cfg.skin, { r: 0.5 });
  const bootM = mat(cfg.boot ?? 0x1c3fb8, { r: 0.35, m: 0.2 });
  const soleM = mat(cfg.sole ?? 0x0a0c18, { r: 0.85 });
  const shirtC = cfg.shirt ?? 0x3a6ad0, pantsC = cfg.pants ?? 0x2a3550;
  const shirtM = casual ? new THREE.MeshStandardMaterial({ color: 0xffffff, map: fabricTex(shirtC, false), roughness: 0.8 }) : suitM;
  const pantsM = casual ? new THREE.MeshStandardMaterial({ color: 0xffffff, map: fabricTex(pantsC, false), roughness: 0.8 }) : suitM;
  const bulk = cfg.bulk ?? 1; // body width (1 normal, 1.25 heavy)
  const emb = (!casual && cfg.emblem !== false) ? new THREE.MeshBasicMaterial({ map: emblemTex('#' + new THREE.Color(glowC).getHexString(), '#ffffff'), transparent: true }) : null;

  const body = grp(root);
  body.scale.setScalar(cfg.scale ?? 0.86);
  const hips = grp(body, 0, 0.95, 0); J.hips = hips;
  // pelvis
  mk(lathe([[0.001, -0.12], [0.1, -0.11], [0.15, -0.06], [0.165, 0.02], [0.155, 0.1], [0.001, 0.1]], 24), pantsM, hips, [0, -0.02, 0], [0, 0, 0], [1.12 * bulk, 1, 0.78 * Math.sqrt(bulk)]);
  // belt
  mk(new THREE.TorusGeometry(0.165, 0.028, 8, 30), mat(cfg.belt ?? (casual ? 0x1a1410 : 0x0b0f26), { r: 0.45, m: casual ? 0 : 0.4 }), hips, [0, 0.07, 0], [P / 2, 0, 0], [1.12 * bulk, 0.8 * Math.sqrt(bulk), 1]);
  if (!casual) {
    mk(new RoundedBoxGeometry(0.11, 0.075, 0.03, 2, 0.012), trimM, hips, [0, 0.07, 0.135]);
    if (emb) mk(new THREE.CircleGeometry(0.03, 20), emb, hips, [0, 0.07, 0.152], [0, 0, 0], null, false);
    for (const s of [1, -1]) {
      mk(new RoundedBoxGeometry(0.075, 0.085, 0.055, 2, 0.015), plateDark, hips, [s * 0.15, 0.04, 0.08], [0, s * 0.5, 0]);
      mk(new THREE.BoxGeometry(0.006, 0.05, 0.004), accent, hips, [s * 0.15 + s * 0.012, 0.04, 0.11], [0, s * 0.5, 0]);
    }
  } else mk(new RoundedBoxGeometry(0.05, 0.04, 0.015, 2, 0.006), mat(0xb8b8b8, { m: 0.8, r: 0.3 }), hips, [0, 0.07, 0.13]);

  // torso
  const spine = grp(hips, 0, 0.1, 0); J.spine = spine;
  const tProf = [[0.001, -0.02], [0.145, -0.01], [0.15, 0.1], [0.172, 0.22], [0.192, 0.33], [0.19, 0.42], [0.155, 0.49], [0.09, 0.53], [0.001, 0.54]];
  const torsoScale = [1.2 * bulk, 1, 0.78 * Math.sqrt(bulk)];
  mk(lathe(tProf, 32), shirtM, spine, [0, 0, 0], [0, 0, 0], torsoScale);
  if (!casual) {
    // sculpted chest plate (front half), white trim, glowing V lines meeting at the emblem
    mk(lathe([[0.176, 0.2], [0.2, 0.3], [0.2, 0.41], [0.165, 0.48], [0.12, 0.505]], 28, -P * 0.42, P * 0.84), plateM, spine, [0, 0, 0.004], [0, 0, 0], [torsoScale[0] * 1.04, 1, torsoScale[2] * 1.08]);
    mk(lathe([[0.168, 0.196], [0.18, 0.2]], 28, -P * 0.42, P * 0.84), trimM, spine, [0, 0, 0.004], [0, 0, 0], [torsoScale[0] * 1.05, 1, torsoScale[2] * 1.1]);
    for (const s of [1, -1]) {
      mk(new THREE.BoxGeometry(0.012, 0.2, 0.008), accent, spine, [s * 0.085, 0.38, 0.17], [0.15, 0, s * 0.62]);
      mk(new THREE.BoxGeometry(0.01, 0.2, 0.008), accent, spine, [s * 0.2, 0.18, 0.06], [0, s * 0.35, s * 0.04]);
      // abs: two columns of armor segments
      for (let k = 0; k < 3; k++) mk(new RoundedBoxGeometry(0.075, 0.045, 0.02, 2, 0.008), plateDark, spine, [s * 0.045, 0.06 + k * 0.055, 0.14 + k * 0.006]);
    }
    mk(new THREE.BoxGeometry(0.006, 0.17, 0.006), accent, spine, [0, 0.11, 0.152]);
    if (emb) mk(new THREE.CircleGeometry(0.045, 24), emb, spine, [0, 0.305, 0.205], [-0.1, 0, 0], null, false);
    mk(new THREE.TorusGeometry(0.05, 0.007, 6, 24), trimM, spine, [0, 0.305, 0.203], [-0.1, 0, 0], null, false);
    // back plate and spine ridge
    mk(lathe([[0.176, 0.18], [0.198, 0.3], [0.196, 0.42], [0.16, 0.48]], 20, P * 0.7, P * 0.6), plateDark, spine, [0, 0, -0.004], [0, 0, 0], [torsoScale[0] * 1.03, 1, torsoScale[2] * 1.06]);
    mk(new THREE.BoxGeometry(0.008, 0.26, 0.006), accent, spine, [0, 0.32, -0.158]);
    // collar
    mk(new THREE.TorusGeometry(0.075, 0.022, 8, 24), plateM, spine, [0, 0.52, 0], [P / 2, 0, 0], [1.15, 1, 1]);
    mk(new THREE.CylinderGeometry(0.085, 0.09, 0.07, 20, 1, true, P * 0.6, P * 0.8), plateDark, spine, [0, 0.56, 0]);
  } else if (cfg.top === 'hoodie') {
    mk(new THREE.TorusGeometry(0.1, 0.045, 8, 24), shirtM, spine, [0, 0.5, -0.03], [P / 2 + 0.3, 0, 0], [1.2, 1, 1]);
    mk(new RoundedBoxGeometry(0.2, 0.09, 0.03, 2, 0.012), shirtM, spine, [0, 0.13, 0.15]);
  } else if (cfg.top === 'sweater') {
    mk(new THREE.TorusGeometry(0.085, 0.025, 8, 24), shirtM, spine, [0, 0.51, 0], [P / 2, 0, 0], [1.15, 1, 1]);
    for (let k = 0; k < 3; k++) mk(new THREE.TorusGeometry(0.16, 0.006, 4, 30, P * 0.9), mat(cfg.stripe ?? 0xf2f2f2, { r: 0.8 }), spine, [0, 0.2 + k * 0.05, 0], [P / 2, 0, -P * 0.45 + P * 0.5], [torsoScale[0] * 1.06, torsoScale[2] * 1.1, 1]);
  } else {
    mk(new THREE.TorusGeometry(0.08, 0.016, 6, 24), shirtM, spine, [0, 0.515, 0], [P / 2, 0, 0], [1.15, 1, 1]);
  }
  if (cfg.jacket) {
    const jm = mat(cfg.jacket, { r: 0.7 });
    mk(lathe(tProf.slice(1, 7).map(([rr, y]) => [rr + 0.012, y]), 28, P * 0.12, P * 1.76), jm, spine, [0, 0, 0], [0, 0, 0], [torsoScale[0] * 1.04, 1, torsoScale[2] * 1.06]);
    for (const s of [1, -1]) mk(new THREE.BoxGeometry(0.06, 0.2, 0.015), jm, spine, [s * 0.07, 0.4, 0.15], [-0.2, 0, s * 0.3]);
  }
  if (cfg.apron) {
    mk(new RoundedBoxGeometry(0.3, 0.55, 0.02, 2, 0.01), mat(cfg.apron, { r: 0.85 }), spine, [0, 0.08, 0.158 * Math.sqrt(bulk)]);
    mk(new RoundedBoxGeometry(0.12, 0.08, 0.008, 2, 0.004), mat(0xffffff, { r: 0.6 }), spine, [0.07, 0.36, 0.172 * Math.sqrt(bulk)]);
  }
  if (cfg.dress) {
    mk(lathe([[0.17, 0.12], [0.2, 0], [0.27, -0.25], [0.32, -0.55]], 28), mat(cfg.dress, { r: 0.8, side: THREE.DoubleSide }), hips, [0, -0.02, 0], [0, 0, 0], [1.05, 1, 0.85]);
  }
  // neck + head
  const neck = grp(spine, 0, 0.52, 0);
  mk(new THREE.CylinderGeometry(0.06, 0.068, 0.11, 16), skinM, neck, [0, 0.01, 0]);
  const head = grp(neck, 0, 0.06, 0); J.head = head;
  const hs = cfg.headScale ?? 1;
  const headG = grp(head); headG.scale.setScalar(hs);
  const isGreg = cfg.face === 'greg';
  const r = isGreg ? 0.19 : 0.18, hc = 0.17;
  const headMat = isGreg ? new THREE.MeshPhysicalMaterial({ color: cfg.skin, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.3 }) : skinM;
  mk(isGreg ? new THREE.SphereGeometry(r, 48, 36) : headGeo(r, cfg), headMat, headG, [0, hc, 0]);
  const face = isGreg ? buildGregFaceS2(headG, hc, r) : buildFaceS2(headG, cfg, hc, r);
  const hair = cfg.hair ? buildHairS2(headG, cfg, hc, r) : { clumps: [] };
  const ex = { clumps: hair.clumps, panels: [] };
  if (cfg.mustache) for (const s of [1, -1]) mk(taperTube([V3(0, 0, 0), V3(s * r * 0.15, -r * 0.02, -r * 0.02), V3(s * r * 0.3, -r * 0.1, -r * 0.08)], r * 0.07, { flat: 0.6, rTip: r * 0.02 }), mat(cfg.mustacheColor ?? cfg.hairColor ?? 0x6a6a6a, { r: 0.8 }), headG, [0, hc - r * 0.33, r * 0.95], [0, 0, 0], null, false);
  if (cfg.glasses) {
    const gm = mat(cfg.glasses, { r: 0.3, m: 0.6 });
    for (const s of [1, -1]) { mk(new THREE.TorusGeometry(r * 0.2, r * 0.025, 6, 20), gm, headG, [s * r * 0.35, hc + r * 0.1, r * 0.98], [0, s * 0.25, 0], null, false); mk(new THREE.CylinderGeometry(r * 0.015, r * 0.015, r * 0.75, 6), gm, headG, [s * r * 0.82, hc + r * 0.12, r * 0.5], [P / 2, 0, 0], null, false); }
    mk(new THREE.CylinderGeometry(r * 0.015, r * 0.015, r * 0.28, 6), gm, headG, [0, hc + r * 0.13, r * 1.03], [0, 0, P / 2], null, false);
  }
  if (cfg.cap) { const cm = mat(cfg.cap, { r: 0.7 }); mk(new THREE.SphereGeometry(r * 1.07, 24, 14, 0, P * 2, 0, P * 0.5), cm, headG, [0, hc + r * 0.12, -r * 0.02]); mk(new THREE.CylinderGeometry(r * 0.65, r * 0.65, r * 0.05, 20, 1, false, -P * 0.5, P), cm, headG, [0, hc + r * 0.2, r * 0.7], [0.1, 0, 0], [1, 1, 1.1]); }
  if (cfg.beanie) { const bm = mat(cfg.beanie, { r: 0.9 }); mk(new THREE.SphereGeometry(r * 1.09, 24, 14, 0, P * 2, 0, P * 0.55), bm, headG, [0, hc + r * 0.1, -r * 0.02]); mk(new THREE.TorusGeometry(r * 1.0, r * 0.09, 8, 28), bm, headG, [0, hc + r * 0.18, -r * 0.02], [P / 2 + 0.1, 0, 0]); mk(new THREE.SphereGeometry(r * 0.2, 10, 8), mat(0xffffff, { r: 0.9 }), headG, [0, hc + r * 1.2, -r * 0.05]); }
  if (cfg.scarf) mk(new THREE.TorusGeometry(0.085, 0.035, 8, 22), mat(cfg.scarf, { r: 0.9 }), neck, [0, -0.01, 0], [P / 2, 0, 0], [1.2, 1, 1]);

  // arms
  J.sh = {}; J.el = {}; J.hand = {};
  const hands = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const sh = grp(spine, s * 0.255 * Math.sqrt(bulk), 0.42, 0); sh.rotation.order = 'ZXY';
    mk(new THREE.SphereGeometry(0.082, 18, 14), shirtM, sh, [0, -0.01, 0], [0, 0, 0], [1, 1, 1]);
    const arm = cfg.sleeves === 'short' ? null : shirtM;
    mk(lathe([[0.001, 0], [0.074, -0.02], [0.077, -0.1], [0.07, -0.2], [0.058, -0.28], [0.001, -0.3]], 18), cfg.sleeves === 'short' ? skinM : shirtM, sh, [0, 0, 0], [0, 0, 0], [1, 1, 0.95]);
    if (cfg.sleeves === 'short') mk(lathe([[0.084, 0.02], [0.085, -0.06], [0.08, -0.12]], 18), shirtM, sh);
    if (!casual) {
      // layered shoulder armor with trim
      mk(new THREE.SphereGeometry(0.105, 18, 10, 0, P * 2, 0, P * 0.45), plateM, sh, [0, 0.005, 0], [0, 0, s * -0.5], [1, 0.8, 1.05]);
      mk(new THREE.SphereGeometry(0.098, 18, 6, 0, P * 2, P * 0.36, P * 0.12), trimM, sh, [0, 0.0, 0], [0, 0, s * -0.5], [1.03, 0.8, 1.08]);
      mk(new THREE.SphereGeometry(0.092, 16, 8, 0, P * 2, 0, P * 0.42), plateDark, sh, [s * 0.012, -0.045, 0], [0, 0, s * -0.65], [1, 0.75, 1.0]);
      mk(new THREE.BoxGeometry(0.006, 0.18, 0.006), accent, sh, [s * 0.075, -0.16, 0.0]);
    }
    const el = grp(sh, 0, -0.29, 0);
    mk(new THREE.SphereGeometry(0.058, 14, 10), cfg.sleeves === 'short' ? skinM : shirtM, el, [0, 0, 0]);
    mk(lathe([[0.001, 0.0], [0.058, -0.01], [0.064, -0.07], [0.052, -0.17], [0.042, -0.24], [0.001, -0.25]], 18), cfg.sleeves === 'short' ? skinM : shirtM, el, [0, 0, 0], [0, 0, 0], [1, 1, 0.92]);
    if (!casual) {
      // gauntlet with a glowing band, a wrist display on the left
      mk(lathe([[0.062, -0.08], [0.068, -0.12], [0.06, -0.2], [0.05, -0.25]], 18), plateM, el);
      mk(lathe([[0.069, -0.115], [0.069, -0.13]], 18), accent, el);
      mk(lathe([[0.061, -0.2], [0.063, -0.215]], 18), trimM, el);
      if (side === 'L') { mk(new RoundedBoxGeometry(0.05, 0.07, 0.02, 2, 0.006), mat(0x08101e, { r: 0.2 }), el, [0, -0.16, 0.06]); mk(new THREE.PlaneGeometry(0.038, 0.055), new THREE.MeshBasicMaterial({ color: glowC }), el, [0, -0.16, 0.0715], [0, 0, 0], null, false); }
    } else if (cfg.cuffs) mk(lathe([[0.048, -0.2], [0.05, -0.245]], 16), mat(cfg.cuffs, { r: 0.7 }), el);
    const H = buildHand(el, s, gloveM, skinM, { bare: casual && !cfg.glove, knuckleGlow: casual ? null : accent });
    hands[side] = H;
    J.sh[side] = sh; J.el[side] = el; J.hand[side] = H.hand;
  }
  // legs
  J.hip = {}; J.kn = {}; J.an = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const hp = grp(hips, s * 0.1 * Math.sqrt(bulk), -0.06, 0); hp.rotation.order = 'ZXY';
    mk(lathe([[0.001, 0.04], [0.098, 0.02], [0.1, -0.1], [0.09, -0.26], [0.07, -0.4], [0.001, -0.43]], 18), pantsM, hp, [0, 0, 0], [0, 0, 0], [Math.sqrt(bulk), 1, Math.sqrt(bulk)]);
    if (!casual) {
      mk(new RoundedBoxGeometry(0.035, 0.16, 0.1, 2, 0.012), plateM, hp, [s * 0.088, -0.2, 0.0]);
      mk(new THREE.BoxGeometry(0.006, 0.14, 0.006), accent, hp, [s * 0.107, -0.2, 0.0]);
    }
    const kn = grp(hp, 0, -0.42, 0);
    mk(new THREE.SphereGeometry(0.068, 14, 10), pantsM, kn, [0, 0, 0]);
    mk(lathe([[0.001, 0.0], [0.068, -0.01], [0.076, -0.11], [0.06, -0.25], [0.048, -0.37], [0.001, -0.4]], 18), pantsM, kn, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
    if (!casual) {
      mk(new THREE.SphereGeometry(0.068, 14, 8, -P * 0.5, P, 0, P * 0.6), plateM, kn, [0, 0.0, 0.012], [0.3, 0, 0], [1.05, 1, 1.15]);
      mk(new RoundedBoxGeometry(0.075, 0.2, 0.03, 2, 0.012), plateM, kn, [0, -0.2, 0.06], [-0.08, 0, 0]);
      mk(new THREE.BoxGeometry(0.008, 0.16, 0.006), accent, kn, [0, -0.2, 0.077], [-0.08, 0, 0]);
    }
    const an = grp(kn, 0, -0.42, 0);
    // boots / shoes
    if (!casual) mk(lathe([[0.062, 0.16], [0.064, 0.05], [0.07, 0.0]], 18), bootM, an, [0, 0, 0]);
    mk(new RoundedBoxGeometry(0.125, 0.11, 0.25, 3, 0.045), bootM, an, [0, 0.03, 0.045]);
    mk(new THREE.SphereGeometry(0.066, 16, 10, 0, P * 2, 0, P * 0.5), casual ? bootM : trimM, an, [0, -0.01, 0.13], [P / 2 - 0.15, 0, 0], [0.95, 0.85, 0.7]);
    mk(new RoundedBoxGeometry(0.135, 0.04, 0.27, 2, 0.015), soleM, an, [0, -0.028, 0.048]);
    if (!casual) mk(new THREE.BoxGeometry(0.137, 0.008, 0.24), accent, an, [0, -0.008, 0.048]);
    else if (cfg.laces !== false) mk(new THREE.BoxGeometry(0.06, 0.006, 0.08), mat(0xf4f4f4, { r: 0.8 }), an, [0, 0.087, 0.07], [0.35, 0, 0]);
    J.hip[side] = hp; J.kn[side] = kn; J.an[side] = an;
  }
  // long coat (Greg): coat over the torso, lapels, double row of buttons, belt, and three tail panels that swing
  if (cfg.coat) {
    const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, map: fabricTex(cfg.coat, false), roughness: 0.75, side: THREE.DoubleSide });
    const dark = mat(cfg.coatDark ?? 0x050506, { r: 0.7 });
    mk(lathe(tProf.slice(1, 8).map(([rr, y]) => [rr + 0.018, y]), 32), cm, spine, [0, 0, 0], [0, 0, 0], [torsoScale[0] * 1.05, 1, torsoScale[2] * 1.08]);
    for (const s of [1, -1]) {
      mk(new THREE.BoxGeometry(0.075, 0.24, 0.018), dark, spine, [s * 0.075, 0.38, 0.165], [-0.18, 0, s * 0.42]);
      mk(new THREE.BoxGeometry(0.11, 0.16, 0.02), cm, spine, [s * 0.11, 0.58, -0.04], [-0.35, 0, s * -0.4]); // popped collar
      for (let k = 0; k < 3; k++) mk(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 12), mat(0x2a2a2e, { r: 0.3, m: 0.6 }), spine, [s * 0.065, 0.12 + k * 0.08, 0.168], [P / 2, 0, 0], null, false);
      // sleeves over the arms + cuffs
      mk(lathe([[0.086, 0.0], [0.084, -0.12], [0.075, -0.27]], 18), cm, J.sh[s > 0 ? 'L' : 'R'], [0, 0, 0]);
      mk(lathe([[0.07, 0.0], [0.07, -0.12], [0.062, -0.22]], 18), cm, J.el[s > 0 ? 'L' : 'R'], [0, 0, 0]);
      mk(lathe([[0.066, -0.17], [0.067, -0.23]], 16), dark, J.el[s > 0 ? 'L' : 'R']);
    }
    mk(new THREE.TorusGeometry(0.168, 0.02, 6, 30), dark, spine, [0, 0.03, 0], [P / 2, 0, 0], [torsoScale[0] * 1.08, torsoScale[2] * 1.12, 1]);
    mk(new RoundedBoxGeometry(0.05, 0.045, 0.012, 2, 0.006), mat(0x9a9aa2, { m: 0.8, r: 0.3 }), spine, [0, 0.03, 0.172], [0, 0, 0], null, false);
    if (cfg.armband) mk(new THREE.CylinderGeometry(0.087, 0.087, 0.06, 18), new THREE.MeshStandardMaterial({ color: cfg.armband, emissive: cfg.armband, emissiveIntensity: 0.5, roughness: 0.4 }), J.sh.L, [0, -0.16, 0]);
    const tail = (x, z, w, ry) => {
      const piv = grp(hips, x, 0.04, z); piv.rotation.y = ry;
      mk(lathe([[0.2, 0.0], [0.215, -0.25], [0.235, -0.55], [0.25, -0.72]], 10, -w / 2, w), cm, piv, [0, 0, 0], [0, 0, 0], [1, 1, 0.9]);
      return piv;
    };
    ex.panels.push({ piv: tail(0, 0, P * 0.62, P), k: 'back' }, { piv: tail(0.01, 0, P * 0.55, P * 0.36), k: 'L' }, { piv: tail(-0.01, 0, P * 0.55, -P * 0.36), k: 'R' });
    for (const pn of ex.panels) pn.piv.children[0].position.set(0, 0, 0);
  }
  if (cfg.cane) { const cn = grp(J.hand.R, 0, -0.07, 0.02); mk(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 8), mat(0x5a3a1e, { r: 0.6 }), cn, [0, -0.42, 0]); mk(new THREE.TorusGeometry(0.04, 0.012, 6, 12, P), mat(0x5a3a1e, { r: 0.6 }), cn, [0.04, 0.03, 0]); ex.cane = cn; }

  const base = { accentI: accent.emissiveIntensity, hair: cfg._hairMat ? cfg._hairMat.color.clone() : null, iris: face.iris.color.clone(), glove: gloveM.color.clone() };
  const BLUE = new THREE.Color(0x4aa8ff), PURPLE = new THREE.Color(0xb050ff), REDEYE = new THREE.Color(0xff1a1a);
  let curHand = { L: HAND.relaxed, R: HAND.relaxed };
  const hero = {
    name: cfg.name, root, J, face, cfg, seed: cfg.seed ?? 1, extras: ex, props: {}, s2: true,
    applyGlow(g) {
      accent.emissiveIntensity = base.accentI * (1 + g.suit * 1.2) * (1 - 0.85 * (g.dim ?? 0));
      if (cfg._hairMat && base.hair) { cfg._hairMat.color.copy(base.hair).lerp(BLUE, g.hair * 0.8); cfg._hairMat.emissive.copy(BLUE).multiplyScalar(g.hair * 0.4); }
      if (!face.greg) { face.iris.emissive.copy(PURPLE).multiplyScalar(g.eyes * 1.2); if (g.red > 0) face.iris.emissive.copy(REDEYE).multiplyScalar(g.red * 2); }
      gloveM.emissive?.copy(PURPLE).multiplyScalar(g.glove * 0.6);
    },
    applyExtras() {},
    applyPose(p) {
      J.hips.position.y = 0.95 + p.y;
      J.hips.rotation.set(p.lean, p.twist, p.tilt);
      J.spine.rotation.set(p.spF, p.spT, p.spS);
      J.head.rotation.set(p.hdN, p.hdY, p.hdT);
      J.sh.L.rotation.set(-p.aLF, -p.aLT, p.aLO);
      J.sh.R.rotation.set(-p.aRF, p.aRT, -p.aRO);
      J.el.L.rotation.x = -p.eL; J.el.R.rotation.x = -p.eR;
      J.hip.L.rotation.set(-p.lLF, 0, p.lLO);
      J.hip.R.rotation.set(-p.lRF, 0, -p.lRO);
      J.kn.L.rotation.x = p.kL; J.kn.R.rotation.x = p.kR;
      J.an.L.rotation.x = p.fL; J.an.R.rotation.x = p.fR;
      hero._p = p;
    },
    applyFace(e, talk, blink, look) {
      if (face.greg) {
        const lid = clamp(1 - e.lid * 0.45 - blink, 0.08, 1.2);
        for (const ey of face.eyes) ey.eye.scale.set(e.wide, lid * e.wide, 1);
        return;
      }
      const open = clamp((1 - e.lid - blink) * e.wide, 0, 1.25);
      for (const ey of face.eyes) {
        ey.lidP.rotation.x = lerp(0.32, -0.95, clamp(open, 0, 1)) - Math.max(0, open - 1) * 0.6;
        ey.loP.rotation.x = lerp(-0.25, 0.1, clamp(open, 0, 1)) + (e.smile > 0.6 ? -0.12 * (e.smile - 0.6) : 0);
        ey.ir.position.x = (look?.x ?? 0) * ey.er * 0.32;
        ey.ir.position.y = (look?.y ?? 0) * ey.er * 0.25;
        ey.ir.scale.setScalar(e.wide > 1.05 ? 0.9 : 1);
      }
      for (const b of face.brows) {
        b.bg.position.y = 0.17 + 0.18 * 0.4 + e.brow * 0.9 + (talk > 0.2 ? 0.004 : 0);
        b.bg.rotation.z = b.s * e.tilt * 0.9;
      }
      const op = clamp(e.open + talk, 0, 1);
      face.open.visible = op > 0.06;
      face.open.scale.set((0.78 + 0.25 * Math.max(0, e.smile) - 0.08 * op) * (look?.mw ?? 1), op * 1.05 + 0.05, 1);
      face.open.position.y = 0.18 * 0.03 - op * 0.012;
      face.smile.visible = op < 0.3;
      face.lowerLip.visible = op < 0.3;
      const sm = e.smile;
      face.smile.rotation.z = sm >= 0 ? P : 0;
      face.smile.position.y = sm >= 0 ? 0.01 : -0.016;
      face.smile.scale.set(0.55 + 0.38 * Math.abs(sm), 0.1 + 0.5 * Math.abs(sm), 1);
      face.lowerLip.position.y = -0.18 * 0.075 + (sm < 0 ? -0.006 : 0);
    },
    // secondary motion and hands, called every frame after applyPose (everything is a function of time)
    tick(t, info) {
      const p = hero._p ?? {};
      const sp = info.speed ?? 0, ph = info.phase ?? 0, since = info.since ?? 9;
      const step = Math.min(1, sp / 3) * Math.abs(S(ph));
      const settle = Math.exp(-since * 4.5) * S(since * 15) * (since < 1.6 ? 1 : 0);
      const fly = info.act === 'fly' ? 1 : 0;
      for (const c of ex.clumps) {
        const f = c.flex;
        c.piv.rotation.x = f * (-0.07 * step - 0.06 * (info.accel ?? 0) + 0.05 * settle - 0.18 * fly * (1 + 0.15 * S(t * 18 + c.ph)) + 0.012 * noise1(t * 0.8 + c.ph));
        c.piv.rotation.z = f * (0.05 * (p.tilt ?? 0) + 0.04 * settle * S(c.ph) + 0.015 * noise1(t * 0.6 + c.ph * 2) + 0.03 * Math.min(1, sp / 3) * S(ph + c.ph));
      }
      for (const pn of ex.panels) {
        const lL = p.lLF ?? 0, lR = p.lRF ?? 0;
        if (pn.k === 'back') pn.piv.rotation.x = Math.max(lL, lR, 0) * 0.55 + 0.25 * Math.min(1, sp / 3) + fly * (1.1 + 0.12 * S(t * 14)) + 0.04 * settle;
        else { const l = pn.k === 'L' ? lL : lR; pn.piv.rotation.x = -Math.max(0, l) * 0.75 + fly * 0.2 - 0.03 * settle; }
      }
      // fingers
      const w = smoothstep(0, 0.22, since);
      for (const side of ['L', 'R']) {
        const target = handShapeFor(info.act, side, info.prop?.[side]);
        const prevT = handShapeFor(info.prevAct, side, info.prop?.[side]);
        curHand[side] = blendHand(prevT, target, w);
        poseHand(hands[side], curHand[side]);
      }
    },
  };
  return hero;
}

// ---------------------------------------------------------------- Season 2 cast
const TEAM_SUIT = { suit: 0x0f1842, plate: 0x2556dc, plateDark: 0x0c1546, trim: 0xe9eef7, boot: 0x2556dc, glove: 0x0f1636 };
export const S2CAST = {
  aaron: { name: 'aaron', seed: 1, hair: 'spiky', hairColor: 0x8a4a22, browColor: 0x5a2c12, skin: 0xe8b38c, skinDark: 0xd99c74, eyeColor: 0x6a3c18, ...TEAM_SUIT, glow: 0xffc23a },
  flare: { name: 'flare', seed: 2, hair: 'tall', hairColor: 0x151110, browColor: 0x110c0a, skin: 0xe5b089, skinDark: 0xd69c74, eyeColor: 0x3b2414, ...TEAM_SUIT, glow: 0xff6a1a, plate: 0x2a4fcf },
  eric: { name: 'eric', seed: 3, hair: 'wavy', hairColor: 0x7a4c2c, browColor: 0x4a2a18, skin: 0xe8b28c, skinDark: 0xd99e78, eyeColor: 0x4a7a3a, ...TEAM_SUIT, glow: 0x3ae06a, scale: 0.84 },
  leon: { name: 'leon', seed: 5, scale: 0.92, hair: 'swept', hairColor: 0x2a211c, streakColor: 0xc4c4c8, browColor: 0x1e1612, skin: 0xd8a079, skinDark: 0xc78c66, eyeColor: 0x3a2412, suit: 0x0d1236, plate: 0x1a2468, plateDark: 0x0a0f2e, trim: 0xf2b632, boot: 0x1a2468, glove: 0x0a0f2e, glow: 0xf2b632 },
  greg: { name: 'greg', seed: 6, scale: 0.9, face: 'greg', skin: 0xf4f4f6, eyeColor: 0x000000, casual: true, glove: 0xf4f4f6, shirt: 0x151518, pants: 0x111114, boot: 0x0c0c10, belt: 0x0a0a0a, coat: 0x1a1a1e, coatDark: 0x060607, armband: 0x3fa8ff },
  // Gus, owner of Gus's Market: bald on top, gray mustache, glasses, green apron
  gus: { name: 'gus', seed: 31, scale: 0.9, bulk: 1.25, hair: 'fringe', hairColor: 0x9a9a9a, browColor: 0x7a7a7a, skin: 0xe2a882, skinDark: 0xcf9470, eyeColor: 0x3a5a7a, casual: true, shirt: 0xf2efe6, pants: 0x3a3a44, boot: 0x2a1a10, apron: 0x2f8a4a, mustache: true, mustacheColor: 0x8a8a8a, glasses: 0x2a2a2a, sleeves: 'short' },
  // Grandma Rose and her grandkids
  rose: { name: 'rose', seed: 32, scale: 0.8, hair: 'bun', hairColor: 0xe8e8ec, browColor: 0xbababa, skin: 0xf0c4a4, skinDark: 0xe0ae8c, eyeColor: 0x4a6a8a, casual: true, top: 'sweater', shirt: 0xb0485a, stripe: 0xf6e7c0, pants: 0x4a3a5a, dress: 0x5a3a6a, boot: 0x3a2a2a, glasses: 0xb08a3a, scarf: 0xe8a23a, lip: 0xc0606a },
  kid1: { name: 'kid1', seed: 33, scale: 0.6, headScale: 1.2, hair: 'curly', hairColor: 0x1a1210, browColor: 0x120c0a, skin: 0x8a5a3c, skinDark: 0x7a4a30, eyeColor: 0x2a1a10, casual: true, top: 'hoodie', shirt: 0x3a9ae0, pants: 0x2a2a3a, boot: 0xe04040 },
  kid2: { name: 'kid2', seed: 34, scale: 0.56, headScale: 1.22, hair: 'ponytail', hairColor: 0x8a4a1a, browColor: 0x5a2a10, skin: 0x8a5a3c, skinDark: 0x7a4a30, eyeColor: 0x2a1a10, casual: true, top: 'sweater', shirt: 0xf2c84a, stripe: 0xe05a3a, pants: 0x5a3a8a, boot: 0xf2f2f2, tie: 0xe05a8a },
  // shoppers
  shop1: { name: 'shop1', seed: 41, scale: 0.92, bulk: 1.3, hair: 'short', hairColor: 0x2a1a10, browColor: 0x1a0e08, skin: 0xc48a62, skinDark: 0xb07a52, eyeColor: 0x2a1a10, casual: true, shirt: 0xd0453a, pants: 0x2a3550, boot: 0x2a2a2a, beanie: 0x2a6ad0, mustache: true, mustacheColor: 0x2a1a10 },
  shop2: { name: 'shop2', seed: 42, scale: 0.86, hair: 'long', hairColor: 0xe0b060, browColor: 0x9a7040, skin: 0xf2caa4, skinDark: 0xe2b490, eyeColor: 0x3a6a9a, casual: true, shirt: 0x8a3ad0, jacket: 0x2a2a30, pants: 0x1e2a4a, boot: 0x1a1a1a, lip: 0xc04a5a },
  shop3: { name: 'shop3', seed: 43, scale: 0.9, hair: 'short', hairColor: 0x15100c, browColor: 0x15100c, skin: 0x6a4028, skinDark: 0x5a3420, eyeColor: 0x1a100a, casual: true, top: 'hoodie', shirt: 0x3aa86a, pants: 0x3a3a40, boot: 0xf2f2f2, cap: 0xd04a2a },
  shop4: { name: 'shop4', seed: 44, scale: 0.88, hair: 'ponytail', hairColor: 0x1a1210, browColor: 0x120c0a, skin: 0xe6b48c, skinDark: 0xd6a07a, eyeColor: 0x2a1a10, casual: true, top: 'sweater', shirt: 0xf27a3a, stripe: 0xffffff, pants: 0x2a3a5a, boot: 0x6a3a1a, tie: 0x2a6ad0 },
  shop5: { name: 'shop5', seed: 45, scale: 0.94, hair: 'swept', hairColor: 0x6a6a6a, browColor: 0x4a4a4a, skin: 0xd8a07a, skinDark: 0xc48c66, eyeColor: 0x3a2412, casual: true, shirt: 0xf2f2f2, jacket: 0x3a4a3a, pants: 0x2a2a2a, boot: 0x1a1a1a, glasses: 0x1a1a1a },
  shop6: { name: 'shop6', seed: 46, scale: 0.84, hair: 'curly', hairColor: 0x3a2214, browColor: 0x2a160c, skin: 0xa8734f, skinDark: 0x966442, eyeColor: 0x2a1a10, casual: true, shirt: 0xf2d84a, pants: 0x4a6a9a, boot: 0x3a3a3a, scarf: 0xd03a3a, lip: 0xa04a4a },
};
