// T10 World - procedural world materials. Facades, roads, terrain, glass, water.
// Windows are baked with an emissive channel so nighttime lights up on its own.
import * as THREE from '../../vendor/three.module.js';
import { makeRng, clamp01, lerpv, TAU } from '../core/math.js';
import { settings } from '../core/settings.js';

const cache = new Map();
function cached(key, fn) {
  if (cache.has(key)) return cache.get(key);
  const v = fn();
  cache.set(key, v);
  return v;
}
export function disposeWorldMaterials() {
  for (const v of cache.values()) {
    if (v && v.dispose) v.dispose();
    else if (v && v.map) { if (v.map.dispose) v.map.dispose(); if (v.dispose) v.dispose(); }
  }
  cache.clear();
}

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
function tex(c, rx, ry, opts) {
  opts = opts || {};
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx || 1, ry || 1);
  t.anisotropy = Math.min(settings.preset.anisotropy, 16);
  t.colorSpace = opts.linear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
function noiseInto(ctx, w, h, amount, seed) {
  const rng = makeRng(seed || 7);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}
function hex(h) { return '#' + h.toString(16).padStart(6, '0'); }

// ---------------------------------------------------------------------------
// Building facades
// ---------------------------------------------------------------------------
export const FACADE_STYLES = [
  { id: 'glass_tower', wall: 0x6f7c88, frame: 0x39414a, glass: 0x2c4a63, lit: 0xffd9a0, cols: 8, rows: 6, winW: 0.82, winH: 0.72, metal: 0.55, rough: 0.22 },
  { id: 'office',      wall: 0xa9a49a, frame: 0x6d6a63, glass: 0x394f60, lit: 0xffe0b0, cols: 6, rows: 5, winW: 0.62, winH: 0.58, metal: 0.05, rough: 0.72 },
  { id: 'concrete',    wall: 0x9a988f, frame: 0x6a6860, glass: 0x33424e, lit: 0xffd9a0, cols: 5, rows: 5, winW: 0.48, winH: 0.52, metal: 0.0, rough: 0.88 },
  { id: 'brick_red',   wall: 0x8d4b38, frame: 0xd6cfc2, glass: 0x2e3b46, lit: 0xffcf92, cols: 4, rows: 4, winW: 0.42, winH: 0.56, metal: 0.0, rough: 0.92, brick: true },
  { id: 'brick_tan',   wall: 0xa8886a, frame: 0xe0d8c9, glass: 0x33414d, lit: 0xffd6a0, cols: 4, rows: 4, winW: 0.40, winH: 0.54, metal: 0.0, rough: 0.92, brick: true },
  { id: 'stucco_warm', wall: 0xd8c4a5, frame: 0xf0e7d6, glass: 0x35434f, lit: 0xffe3ba, cols: 3, rows: 3, winW: 0.42, winH: 0.50, metal: 0.0, rough: 0.9 },
  { id: 'stucco_cool', wall: 0xc9cdc6, frame: 0xf2f2ee, glass: 0x33414c, lit: 0xffe0b4, cols: 3, rows: 3, winW: 0.44, winH: 0.52, metal: 0.0, rough: 0.9 },
  { id: 'panel_blue',  wall: 0x56707f, frame: 0x2f3d46, glass: 0x28414f, lit: 0xffd7a0, cols: 6, rows: 5, winW: 0.70, winH: 0.60, metal: 0.25, rough: 0.5 },
  { id: 'warehouse',   wall: 0x8e9398, frame: 0x5c6165, glass: 0x3b4a53, lit: 0xf6e2b8, cols: 7, rows: 2, winW: 0.74, winH: 0.30, metal: 0.4, rough: 0.6, ribbed: true },
  { id: 'shop_front',  wall: 0xbcb0a0, frame: 0x51483e, glass: 0x50606b, lit: 0xfff0cc, cols: 3, rows: 2, winW: 0.80, winH: 0.66, metal: 0.05, rough: 0.78 },
  { id: 'house_siding', wall: 0xd4d8d2, frame: 0xf6f5f1, glass: 0x394652, lit: 0xffd9a4, cols: 3, rows: 2, winW: 0.34, winH: 0.46, metal: 0.0, rough: 0.85, siding: true },
  { id: 'house_wood',  wall: 0x9a7b58, frame: 0xe9e2d4, glass: 0x384450, lit: 0xffd7a0, cols: 3, rows: 2, winW: 0.34, winH: 0.46, metal: 0.0, rough: 0.9, siding: true },
];

/**
 * Facade texture: an albedo sheet plus a matching emissive sheet where each
 * window is randomly lit. One tile = one floor band, repeated up the building.
 */
function buildFacade(style, seed) {
  const S = Math.min(settings.preset.textureSize, 512);
  const c = cv(S), ctx = c.getContext('2d');
  const e = cv(S), ectx = e.getContext('2d');
  const rng = makeRng(seed);

  ctx.fillStyle = hex(style.wall);
  ctx.fillRect(0, 0, S, S);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, S, S);

  if (style.brick) {
    const bh = S / 26, bw = S / 11;
    for (let r = 0; r < 26; r++) {
      const off = (r % 2) * bw * 0.5;
      for (let col = -1; col < 12; col++) {
        const shade2 = rng.range(-0.12, 0.12);
        const base = style.wall;
        const rr = Math.min(255, ((base >> 16) & 255) * (1 + shade2));
        const gg = Math.min(255, ((base >> 8) & 255) * (1 + shade2));
        const bb = Math.min(255, (base & 255) * (1 + shade2));
        ctx.fillStyle = 'rgb(' + (rr | 0) + ',' + (gg | 0) + ',' + (bb | 0) + ')';
        ctx.fillRect(col * bw + off + 1, r * bh + 1, bw - 2, bh - 2);
      }
    }
  } else if (style.siding) {
    for (let r = 0; r < 34; r++) {
      const y = (r / 34) * S;
      ctx.fillStyle = 'rgba(0,0,0,' + (r % 2 ? 0.05 : 0.02) + ')';
      ctx.fillRect(0, y, S, S / 34);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, y, S, 1.5);
    }
  } else if (style.ribbed) {
    for (let x = 0; x < S; x += 12) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(x, 0, 5, S);
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 5, 0, 2, S);
    }
  }

  // Windows.
  const cols = style.cols, rows = style.rows;
  const cw = S / cols, ch = S / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const w = cw * style.winW, h = ch * style.winH;
      const x = col * cw + (cw - w) * 0.5;
      const y = r * ch + (ch - h) * 0.55;
      // Frame
      ctx.fillStyle = hex(style.frame);
      ctx.fillRect(x - 2.5, y - 2.5, w + 5, h + 5);
      // Glass with a vertical sky gradient reflection
      const g = ctx.createLinearGradient(x, y, x, y + h);
      const gl = style.glass;
      g.addColorStop(0, 'rgba(' + (((gl >> 16) & 255) + 40) + ',' + (((gl >> 8) & 255) + 46) + ',' + ((gl & 255) + 52) + ',1)');
      g.addColorStop(0.55, hex(gl));
      g.addColorStop(1, 'rgba(' + Math.max(0, ((gl >> 16) & 255) - 24) + ',' + Math.max(0, ((gl >> 8) & 255) - 22) + ',' + Math.max(0, (gl & 255) - 18) + ',1)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // Mullion
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x, y + h * 0.5 - 1, w, 2);
      if (!style.ribbed) { ctx.fillRect(x + w * 0.5 - 1, y, 2, h); }
      // Emissive: a share of windows are lit, with warm variation.
      if (rng() < 0.42) {
        const warm = rng.range(0.7, 1.0);
        const lit = style.lit;
        ectx.fillStyle = 'rgba(' + Math.round(((lit >> 16) & 255) * warm) + ',' +
          Math.round(((lit >> 8) & 255) * warm * 0.92) + ',' +
          Math.round((lit & 255) * warm * 0.78) + ',' + rng.range(0.55, 1) + ')';
        ectx.fillRect(x, y, w, h);
        // A blind or occupant silhouette in some windows.
        if (rng() < 0.35) {
          ectx.fillStyle = 'rgba(0,0,0,0.45)';
          ectx.fillRect(x, y, w, h * rng.range(0.15, 0.5));
        }
      }
    }
  }
  noiseInto(ctx, S, S, 14, seed + 3);
  return { albedo: c, emissive: e };
}

/**
 * Facades tile through baked UVs rather than texture.repeat, so every building
 * of a given style shares one material and the whole block merges into a single
 * draw call.
 */
export function facadeMaterial(styleIndex, seed) {
  const style = FACADE_STYLES[styleIndex % FACADE_STYLES.length];
  const variant = (seed >>> 0) % 6;
  const key = 'facade|' + style.id + '|' + variant;
  return cached(key, () => {
    const { albedo, emissive } = buildFacade(style, variant * 7919 + styleIndex * 131);
    const m = new THREE.MeshStandardMaterial({
      map: tex(albedo, 1, 1),
      emissiveMap: tex(emissive, 1, 1),
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0,
      roughness: style.rough,
      metalness: style.metal,
    });
    m.userData.isFacade = true;
    m.userData.style = style;
    return m;
  });
}

/** How many metres one facade tile covers, so UVs can be baked to world scale. */
export const FACADE_TILE = { w: 9.0, h: 3.4 };

/** All facade materials update their emissive together as night falls. */
export function setFacadeNightFactor(f) {
  for (const v of cache.values()) {
    if (v && v.userData && v.userData.isFacade) {
      v.emissiveIntensity = f * settings.preset.windowLights;
    }
  }
}

// ---------------------------------------------------------------------------
// Ground surfaces
// ---------------------------------------------------------------------------
export function asphaltMaterial() {
  return cached('asphalt', () => {
    const S = 256, c = cv(S), ctx = c.getContext('2d');
    ctx.fillStyle = '#3a3a3c'; ctx.fillRect(0, 0, S, S);
    const rng = makeRng(31);
    for (let i = 0; i < 2600; i++) {
      const g = rng.range(0.6, 1.5);
      ctx.fillStyle = 'rgba(' + Math.round(70 * g) + ',' + Math.round(70 * g) + ',' + Math.round(73 * g) + ',' + rng.range(0.15, 0.6) + ')';
      ctx.beginPath(); ctx.arc(rng() * S, rng() * S, rng.range(0.6, 2.6), 0, TAU); ctx.fill();
    }
    // Patches and cracks
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = 'rgba(28,28,30,0.55)';
      ctx.lineWidth = rng.range(0.8, 2.2);
      ctx.beginPath();
      let x = rng() * S, y = rng() * S;
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += rng.range(-40, 40); y += rng.range(-40, 40); ctx.lineTo(x, y); }
      ctx.stroke();
    }
    noiseInto(ctx, S, S, 16, 77);
    return new THREE.MeshStandardMaterial({ map: tex(c, 8, 8), roughness: 0.94, metalness: 0.0 });
  });
}

export function concreteMaterial(tint) {
  return cached('concrete|' + (tint || 0xb9b6ae), () => {
    const S = 256, c = cv(S), ctx = c.getContext('2d');
    ctx.fillStyle = hex(tint || 0xb9b6ae); ctx.fillRect(0, 0, S, S);
    const rng = makeRng(919);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(0,0,0,' + rng.range(0.02, 0.07) + ')';
      ctx.beginPath(); ctx.arc(rng() * S, rng() * S, rng.range(8, 44), 0, TAU); ctx.fill();
    }
    // Expansion joints — makes pavement read as slabs, not a sheet.
    ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, S * 0.5); ctx.lineTo(S, S * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(S * 0.5, 0); ctx.lineTo(S * 0.5, S); ctx.stroke();
    noiseInto(ctx, S, S, 13, 5);
    return new THREE.MeshStandardMaterial({ map: tex(c, 4, 4), roughness: 0.92, metalness: 0 });
  });
}

export function grassMaterial() {
  return cached('grass', () => {
    const S = 256, c = cv(S), ctx = c.getContext('2d');
    ctx.fillStyle = '#4e6b38'; ctx.fillRect(0, 0, S, S);
    const rng = makeRng(404);
    for (let i = 0; i < 5200; i++) {
      const g = rng.range(0.7, 1.35);
      ctx.strokeStyle = 'rgba(' + Math.round(78 * g) + ',' + Math.round(107 * g) + ',' + Math.round(56 * g) + ',' + rng.range(0.3, 0.9) + ')';
      ctx.lineWidth = rng.range(0.7, 1.8);
      const x = rng() * S, y = rng() * S, h = rng.range(3, 9);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng.range(-2, 2), y - h); ctx.stroke();
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = 'rgba(' + (rng() < 0.5 ? '40,58,30' : '108,132,66') + ',' + rng.range(0.10, 0.26) + ')';
      ctx.beginPath(); ctx.arc(rng() * S, rng() * S, rng.range(14, 54), 0, TAU); ctx.fill();
    }
    return new THREE.MeshStandardMaterial({ map: tex(c, 24, 24), roughness: 0.96, metalness: 0 });
  });
}

export function dirtMaterial() {
  return cached('dirt', () => {
    const S = 256, c = cv(S), ctx = c.getContext('2d');
    ctx.fillStyle = '#6b573f'; ctx.fillRect(0, 0, S, S);
    const rng = makeRng(808);
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = 'rgba(' + (rng() < 0.5 ? '90,74,54' : '58,46,33') + ',' + rng.range(0.2, 0.7) + ')';
      ctx.beginPath(); ctx.arc(rng() * S, rng() * S, rng.range(1, 5), 0, TAU); ctx.fill();
    }
    noiseInto(ctx, S, S, 20, 12);
    return new THREE.MeshStandardMaterial({ map: tex(c, 16, 16), roughness: 0.97, metalness: 0 });
  });
}

export function sandMaterial() {
  return cached('sand', () => {
    const S = 256, c = cv(S), ctx = c.getContext('2d');
    ctx.fillStyle = '#d8c69c'; ctx.fillRect(0, 0, S, S);
    const rng = makeRng(606);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = 'rgba(190,172,130,' + rng.range(0.1, 0.3) + ')';
      ctx.lineWidth = rng.range(2, 7);
      ctx.beginPath();
      const y = rng() * S;
      ctx.moveTo(0, y);
      for (let x = 0; x <= S; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 6);
      ctx.stroke();
    }
    noiseInto(ctx, S, S, 22, 99);
    return new THREE.MeshStandardMaterial({ map: tex(c, 20, 20), roughness: 0.95, metalness: 0 });
  });
}

/** Road surface with lane markings baked in; `kind` picks the marking layout. */
export function roadMaterial(kind) {
  return cached('road|' + kind, () => {
    const W = 256, H = 256, c = cv(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = '#39393b'; ctx.fillRect(0, 0, W, H);
    const rng = makeRng(kind.length * 17 + 5);
    for (let i = 0; i < 2200; i++) {
      const g = rng.range(0.7, 1.4);
      ctx.fillStyle = 'rgba(' + Math.round(66 * g) + ',' + Math.round(66 * g) + ',' + Math.round(69 * g) + ',' + rng.range(0.15, 0.5) + ')';
      ctx.beginPath(); ctx.arc(rng() * W, rng() * H, rng.range(0.6, 2.4), 0, TAU); ctx.fill();
    }
    // Tyre polish lanes
    ctx.fillStyle = 'rgba(20,20,22,0.18)';
    ctx.fillRect(W * 0.16, 0, W * 0.16, H);
    ctx.fillRect(W * 0.68, 0, W * 0.16, H);
    const paint = (x, w, dash, col) => {
      ctx.fillStyle = col || 'rgba(232,230,214,0.92)';
      if (!dash) ctx.fillRect(x - w / 2, 0, w, H);
      else for (let y = 0; y < H; y += 48) ctx.fillRect(x - w / 2, y, w, 26);
    };
    if (kind === 'two_lane') {
      paint(W * 0.5, 4, true, 'rgba(232,216,120,0.92)');
      paint(W * 0.045, 4, false); paint(W * 0.955, 4, false);
    } else if (kind === 'four_lane') {
      paint(W * 0.49, 4, false, 'rgba(232,216,120,0.92)');
      paint(W * 0.51, 4, false, 'rgba(232,216,120,0.92)');
      paint(W * 0.25, 3, true); paint(W * 0.75, 3, true);
      paint(W * 0.035, 4, false); paint(W * 0.965, 4, false);
    } else if (kind === 'highway') {
      paint(W * 0.475, 5, false, 'rgba(232,216,120,0.92)');
      paint(W * 0.525, 5, false, 'rgba(232,216,120,0.92)');
      paint(W * 0.18, 3, true); paint(W * 0.32, 3, true);
      paint(W * 0.68, 3, true); paint(W * 0.82, 3, true);
      paint(W * 0.03, 5, false); paint(W * 0.97, 5, false);
    } else if (kind === 'alley') {
      // no markings
    }
    noiseInto(ctx, W, H, 12, 3);
    return new THREE.MeshStandardMaterial({ map: tex(c, 1, 12), roughness: 0.9, metalness: 0 });
  });
}

export function sidewalkMaterial() {
  return cached('sidewalk', () => {
    const S = 256, c = cv(S), ctx = c.getContext('2d');
    ctx.fillStyle = '#b4b1a8'; ctx.fillRect(0, 0, S, S);
    const rng = makeRng(222);
    const cell = S / 4;
    for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) {
      const t = rng.range(-0.05, 0.05);
      ctx.fillStyle = 'rgba(' + Math.round(180 * (1 + t)) + ',' + Math.round(177 * (1 + t)) + ',' + Math.round(168 * (1 + t)) + ',1)';
      ctx.fillRect(col * cell + 1.5, r * cell + 1.5, cell - 3, cell - 3);
    }
    ctx.strokeStyle = 'rgba(120,118,110,0.7)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(S, i * cell); ctx.stroke();
    }
    noiseInto(ctx, S, S, 14, 44);
    return new THREE.MeshStandardMaterial({ map: tex(c, 2, 2), roughness: 0.9, metalness: 0 });
  });
}

export function roofMaterial(kind) {
  return cached('roof|' + kind, () => {
    const S = 256, c = cv(S), ctx = c.getContext('2d');
    if (kind === 'shingle') {
      ctx.fillStyle = '#4a4440'; ctx.fillRect(0, 0, S, S);
      const rng = makeRng(15);
      const rh = S / 16;
      for (let r = 0; r < 16; r++) {
        const off = (r % 2) * (S / 16);
        for (let col = -1; col < 9; col++) {
          const t = rng.range(-0.15, 0.15);
          ctx.fillStyle = 'rgb(' + Math.round(74 * (1 + t)) + ',' + Math.round(68 * (1 + t)) + ',' + Math.round(64 * (1 + t)) + ')';
          ctx.fillRect(col * (S / 8) + off, r * rh, S / 8 - 2, rh - 1.5);
        }
      }
    } else if (kind === 'tile') {
      ctx.fillStyle = '#9a4f34'; ctx.fillRect(0, 0, S, S);
      const rng = makeRng(16);
      for (let r = 0; r < 14; r++) for (let col = 0; col < 14; col++) {
        const t = rng.range(-0.12, 0.12);
        ctx.fillStyle = 'rgb(' + Math.round(158 * (1 + t)) + ',' + Math.round(82 * (1 + t)) + ',' + Math.round(54 * (1 + t)) + ')';
        ctx.beginPath();
        ctx.ellipse(col * S / 14 + S / 28, r * S / 14 + S / 28, S / 28, S / 30, 0, 0, TAU);
        ctx.fill();
      }
    } else {
      // Flat commercial roof: gravel + tar seams + AC units get added as geometry.
      ctx.fillStyle = '#5c5b57'; ctx.fillRect(0, 0, S, S);
      const rng = makeRng(17);
      for (let i = 0; i < 3000; i++) {
        const g = rng.range(0.7, 1.3);
        ctx.fillStyle = 'rgba(' + Math.round(96 * g) + ',' + Math.round(94 * g) + ',' + Math.round(88 * g) + ',' + rng.range(0.2, 0.7) + ')';
        ctx.fillRect(rng() * S, rng() * S, rng.range(1, 3), rng.range(1, 3));
      }
      ctx.strokeStyle = 'rgba(40,40,38,0.6)'; ctx.lineWidth = 3;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, i * S / 4); ctx.lineTo(S, i * S / 4); ctx.stroke();
      }
    }
    noiseInto(ctx, S, S, 12, 21);
    return new THREE.MeshStandardMaterial({ map: tex(c, 3, 3), roughness: 0.93, metalness: 0 });
  });
}

export function glassMaterial(tint, opacity) {
  return cached('glass|' + tint + '|' + opacity, () => new THREE.MeshPhysicalMaterial({
    color: tint, metalness: 0.1, roughness: 0.08,
    transmission: 0, opacity: opacity == null ? 0.45 : opacity, transparent: true,
    envMapIntensity: 1.6, reflectivity: 0.6,
  }));
}

export function metalMaterial(color, rough) {
  return cached('metal|' + color + '|' + rough, () => new THREE.MeshStandardMaterial({
    color, metalness: 0.85, roughness: rough == null ? 0.35 : rough,
  }));
}

export function paintedMaterial(color, rough) {
  return cached('painted|' + color + '|' + rough, () => new THREE.MeshStandardMaterial({
    color, metalness: 0.0, roughness: rough == null ? 0.6 : rough,
  }));
}

export function emissiveMaterial(color, intensity) {
  return cached('emis|' + color + '|' + intensity, () => new THREE.MeshStandardMaterial({
    color: 0x111111, emissive: color, emissiveIntensity: intensity == null ? 1 : intensity,
    roughness: 0.4, metalness: 0,
  }));
}

/** Tree canopy: alpha-masked leaf clusters. */
export function foliageMaterial(colorHex, seed) {
  return cached('foliage|' + colorHex, () => {
    const S = 128, c = cv(S), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    const rng = makeRng(seed || colorHex);
    const r = (colorHex >> 16) & 255, g = (colorHex >> 8) & 255, b = colorHex & 255;
    for (let i = 0; i < 240; i++) {
      const t = rng.range(0.65, 1.35);
      ctx.fillStyle = 'rgba(' + Math.min(255, r * t | 0) + ',' + Math.min(255, g * t | 0) + ',' + Math.min(255, b * t | 0) + ',' + rng.range(0.6, 1) + ')';
      const x = rng() * S, y = rng() * S;
      ctx.beginPath();
      ctx.ellipse(x, y, rng.range(3, 11), rng.range(2, 7), rng() * TAU, 0, TAU);
      ctx.fill();
    }
    const t2 = new THREE.CanvasTexture(c);
    t2.wrapS = t2.wrapT = THREE.RepeatWrapping;
    t2.colorSpace = THREE.SRGBColorSpace;
    t2.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      map: t2, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
      roughness: 0.85, metalness: 0,
    });
  });
}

export function barkMaterial(colorHex) {
  return cached('bark|' + colorHex, () => {
    const S = 128, c = cv(S), ctx = c.getContext('2d');
    ctx.fillStyle = hex(colorHex); ctx.fillRect(0, 0, S, S);
    const rng = makeRng(colorHex + 3);
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = 'rgba(0,0,0,' + rng.range(0.05, 0.3) + ')';
      ctx.lineWidth = rng.range(0.7, 3);
      const x = rng() * S;
      ctx.beginPath(); ctx.moveTo(x, 0);
      let cx2 = x;
      for (let y = 0; y < S; y += 16) { cx2 += rng.range(-3, 3); ctx.lineTo(cx2, y); }
      ctx.stroke();
    }
    return new THREE.MeshStandardMaterial({ map: tex(c, 1, 3), roughness: 0.95, metalness: 0 });
  });
}

/** Animated water. The shader is driven by World's clock uniform. */
export function waterMaterial() {
  return cached('water', () => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x18384a, roughness: 0.08, metalness: 0.25,
      transparent: true, opacity: 0.88,
    });
    m.userData.animatedWater = true;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      m.userData.shader = shader;
      shader.vertexShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 wp = modelMatrix * vec4(transformed, 1.0);
         float w1 = sin(wp.x * 0.12 + uTime * 1.1) * cos(wp.z * 0.09 - uTime * 0.8);
         float w2 = sin(wp.x * 0.31 - uTime * 1.7) * 0.4;
         transformed.y += w1 * 0.28 + w2 * 0.12;
         vWPos = wp.xyz;`
      );
      shader.fragmentShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         float rp = sin(vWPos.x * 0.55 + uTime * 2.1) * cos(vWPos.z * 0.48 - uTime * 1.6);
         normal = normalize(normal + vec3(rp * 0.09, 0.0, rp * 0.07));`
      );
    };
    return m;
  });
}

export function updateWaterTime(t) {
  const m = cache.get('water');
  if (m && m.userData.shader) m.userData.shader.uniforms.uTime.value = t;
}

/** Wet-road look when it rains: drop roughness so lights streak across asphalt. */
export function setWetness(amount) {
  const keys = ['asphalt', 'sidewalk'];
  for (const k of keys) {
    const m = cache.get(k);
    if (m) { m.roughness = lerpv(0.92, 0.22, clamp01(amount)); m.metalness = lerpv(0, 0.25, clamp01(amount)); }
  }
  for (const [k, m] of cache) {
    if (k.startsWith('road|') && m) { m.roughness = lerpv(0.9, 0.18, clamp01(amount)); m.metalness = lerpv(0, 0.3, clamp01(amount)); }
  }
}

// Snow lying on the ground. We keep each material's untouched colour the first
// time we tint it so the effect is reversible however many times it's toggled.
const FROST = new THREE.Color(0xdfe6ea);
const baseColors = new Map();
let frostAmount = 0;

function frostKey(k) {
  return k === 'asphalt' || k === 'sidewalk' || k === 'grass' || k === 'dirt' ||
    k === 'sand' || k.startsWith('road|') || k.startsWith('ground|');
}

export function setGroundFrost(amount) {
  const a = clamp01(amount);
  // Nothing to do when we're already there and no new materials have appeared.
  frostAmount = a;
  for (const [k, m] of cache) {
    if (!m || !m.color || !frostKey(k)) continue;
    let base = baseColors.get(k);
    if (!base) { base = m.color.clone(); baseColors.set(k, base); }
    m.color.copy(base).lerp(FROST, a * 0.72);
    if (a > 0.01) m.roughness = lerpv(m.roughness, 0.86, a * 0.6);
  }
}

/** Re-apply the current frost to materials created after the last call. */
export function refreshGroundFrost() {
  if (frostAmount > 0.005) setGroundFrost(frostAmount);
}
