// T10 World - procedural human textures (skin, faces, irises, hair, fabric).
// Everything is painted to a canvas at runtime, so characters get unique skin,
// freckles, brows and lips without shipping a single image file.
import * as THREE from '../../vendor/three.module.js';
import { makeRng, clamp01, lerpv, TAU } from '../core/math.js';
import { settings } from '../core/settings.js';

const texCache = new Map();

function hexToRgb(hex) { return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 }; }
function rgbStr(c, a) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (a == null ? 1 : a) + ')'; }
function shadeHex(hex, amt) {
  const c = shade(hex, amt);
  return (c.r << 16) | (c.g << 8) | c.b;
}
function shade(hex, amt) {
  const c = hexToRgb(hex);
  return {
    r: Math.max(0, Math.min(255, Math.round(c.r * (1 + amt)))),
    g: Math.max(0, Math.min(255, Math.round(c.g * (1 + amt)))),
    b: Math.max(0, Math.min(255, Math.round(c.b * (1 + amt)))),
  };
}

function canvas(size, h) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h || size;
  return c;
}

function finishTexture(c, opts) {
  opts = opts || {};
  const t = new THREE.CanvasTexture(c);
  t.wrapS = opts.wrapS || THREE.RepeatWrapping;
  t.wrapT = opts.wrapT || THREE.RepeatWrapping;
  t.anisotropy = Math.min(settings.preset.anisotropy, 16);
  t.colorSpace = opts.linear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  t.needsUpdate = true;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  return t;
}

const TEX_CACHE_LIMIT = 220;

/**
 * Cached texture builder — identical parameters reuse one GPU texture.
 * LRU-evicted so a long session with hundreds of unique NPCs can't grow
 * unbounded on the GPU.
 */
function cached(key, builder) {
  if (texCache.has(key)) {
    const hit = texCache.get(key);
    texCache.delete(key);           // reinsert to mark as recently used
    texCache.set(key, hit);
    return hit;
  }
  const t = builder();
  texCache.set(key, t);
  if (texCache.size > TEX_CACHE_LIMIT) {
    const oldest = texCache.keys().next().value;
    const victim = texCache.get(oldest);
    texCache.delete(oldest);
    if (victim && victim.dispose) victim.dispose();
  }
  return t;
}

// ---------------------------------------------------------------------------
// Shared detail tiles. Per-pixel JS loops over a 1024x1024 face are far too
// slow to run per character, so grain/pores/stubble are pre-rendered once into
// small tiles and composited with drawImage instead.
// ---------------------------------------------------------------------------
const tileCache = new Map();

function grainTile(strength, seed) {
  const key = 'grain' + strength + '_' + seed;
  if (tileCache.has(key)) return tileCache.get(key);
  const S = 128;
  const c = canvas(S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const rng = makeRng(seed || 1234);
  for (let i = 0; i < d.length; i += 4) {
    const n = 128 + (rng() - 0.5) * strength;
    d[i] = d[i + 1] = d[i + 2] = n;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tileCache.set(key, c);
  return c;
}

function speckleTile(count, radius, color, alphaLo, alphaHi, seed) {
  const key = 'speck' + count + '_' + radius + '_' + color + '_' + seed;
  if (tileCache.has(key)) return tileCache.get(key);
  const S = 128;
  const c = canvas(S);
  const ctx = c.getContext('2d');
  const rng = makeRng(seed || 99);
  const col = hexToRgb(color);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rgbStr(col, rng.range(alphaLo, alphaHi));
    const r = rng.range(radius * 0.4, radius);
    ctx.beginPath(); ctx.arc(rng() * S, rng() * S, r, 0, TAU); ctx.fill();
  }
  tileCache.set(key, c);
  return c;
}

/** Tile a small canvas across a region with a blend mode — one drawImage per step. */
function tileOver(ctx, tile, w, h, alpha, blend, scale) {
  const prevAlpha = ctx.globalAlpha;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalAlpha = alpha;
  if (blend) ctx.globalCompositeOperation = blend;
  const size = tile.width * (scale || 1);
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) ctx.drawImage(tile, x, y, size, size);
  }
  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevOp;
}

export function clearTextureCache() {
  for (const t of texCache.values()) { if (t && t.dispose) t.dispose(); }
  texCache.clear();
}

// ---------------------------------------------------------------------------
// Skin tones — a broad, realistic range (Fitzpatrick-ish spread).
// ---------------------------------------------------------------------------
export const SKIN_TONES = [
  { name: 'Porcelain',   hex: 0xf6ded2, undertone: 0xe8b9a8 },
  { name: 'Ivory',       hex: 0xf2d5c0, undertone: 0xdfae96 },
  { name: 'Fair',        hex: 0xecc6ac, undertone: 0xd49e82 },
  { name: 'Light',       hex: 0xe5b795, undertone: 0xc98f6e },
  { name: 'Light Warm',  hex: 0xdcaa84, undertone: 0xc08462 },
  { name: 'Beige',       hex: 0xd09c74, undertone: 0xb27a56 },
  { name: 'Sand',        hex: 0xc68f66, undertone: 0xa66f4c },
  { name: 'Honey',       hex: 0xba7f56, undertone: 0x97603f },
  { name: 'Golden',      hex: 0xad7149, undertone: 0x8a5334 },
  { name: 'Caramel',     hex: 0x9d6440, undertone: 0x7c4a2d },
  { name: 'Tan',         hex: 0x8f5936, undertone: 0x6f4128 },
  { name: 'Bronze',      hex: 0x7f4e2f, undertone: 0x613824 },
  { name: 'Umber',       hex: 0x6e4227, undertone: 0x522f1c },
  { name: 'Chestnut',    hex: 0x5f3921, undertone: 0x46281699 & 0xffffff },
  { name: 'Mahogany',    hex: 0x52301c, undertone: 0x3b2114 },
  { name: 'Espresso',    hex: 0x452817, undertone: 0x2f1b10 },
  { name: 'Deep',        hex: 0x392012, undertone: 0x26150c },
  { name: 'Onyx',        hex: 0x2c190e, undertone: 0x1c1008 },
];

export const EYE_COLORS = [
  { name: 'Dark Brown', hex: 0x3a2317 }, { name: 'Brown', hex: 0x6b4423 },
  { name: 'Hazel', hex: 0x8e6b3a }, { name: 'Amber', hex: 0xb07c2a },
  { name: 'Green', hex: 0x4c7a4a }, { name: 'Olive', hex: 0x6f7a44 },
  { name: 'Blue', hex: 0x4a7fa8 }, { name: 'Ice Blue', hex: 0x86b4cc },
  { name: 'Steel Grey', hex: 0x6f7a80 }, { name: 'Violet', hex: 0x6a5590 },
  { name: 'Emerald', hex: 0x2f7a5c }, { name: 'Copper', hex: 0x92552a },
];

export const HAIR_COLORS = [
  { name: 'Jet Black', hex: 0x110d0b }, { name: 'Black', hex: 0x1c1512 },
  { name: 'Soft Black', hex: 0x2a201b }, { name: 'Dark Brown', hex: 0x3a2a1e },
  { name: 'Brown', hex: 0x543823 }, { name: 'Chestnut', hex: 0x6b4526 },
  { name: 'Auburn', hex: 0x7c3f22 }, { name: 'Ginger', hex: 0x9c4f1e },
  { name: 'Copper', hex: 0xb5621f }, { name: 'Dark Blonde', hex: 0x8a6a3c },
  { name: 'Blonde', hex: 0xb9944f }, { name: 'Light Blonde', hex: 0xd6bb7d },
  { name: 'Platinum', hex: 0xe3ddc8 }, { name: 'Ash Grey', hex: 0x9a958d },
  { name: 'Silver', hex: 0xc4c2bd }, { name: 'White', hex: 0xe8e6e0 },
  { name: 'Blue', hex: 0x2b4a7a }, { name: 'Teal', hex: 0x1f6a6a },
  { name: 'Purple', hex: 0x5a2f6e }, { name: 'Pink', hex: 0xb04a78 },
  { name: 'Red', hex: 0x8e2020 }, { name: 'Green', hex: 0x2f6b34 },
];

// ---------------------------------------------------------------------------
// Body skin: base tone + pores + subtle mottling + optional freckles/tan lines.
// ---------------------------------------------------------------------------
export function skinTexture(desc) {
  const size = Math.min(settings.preset.textureSize, 512);
  const key = 'skin|' + desc.toneIndex + '|' + (desc.freckles > 0.3 ? 1 : 0) + '|' + size + '|' + (desc.age > 0.6 ? 1 : 0);
  return cached(key, () => {
    const c = canvas(size);
    const ctx = c.getContext('2d');
    const tone = SKIN_TONES[desc.toneIndex % SKIN_TONES.length];
    const base = hexToRgb(tone.hex);
    const rng = makeRng(desc.toneIndex * 7717 + 13);

    ctx.fillStyle = rgbStr(base);
    ctx.fillRect(0, 0, size, size);

    // Large-scale mottling so skin isn't a flat plastic colour.
    for (let i = 0; i < 48; i++) {
      const r = rng.range(size * 0.06, size * 0.24);
      const x = rng() * size, y = rng() * size;
      const col = shade(tone.hex, rng.range(-0.075, 0.075));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgbStr(col, 0.5));
      g.addColorStop(1, rgbStr(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }

    // Pores: a pre-rendered grain tile blended over the whole sheet.
    tileOver(ctx, grainTile(26, 4242), size, size, 0.42, 'overlay', 1);

    if (desc.freckles > 0.3) {
      tileOver(ctx, speckleTile(70, 2.0, shadeHex(tone.hex, -0.35), 0.10, 0.34, 771),
        size, size, 0.35 * desc.freckles, 'multiply', 1);
    }
    if (desc.age > 0.6) {
      tileOver(ctx, speckleTile(22, 4.5, shadeHex(tone.hex, -0.25), 0.05, 0.16, 553), size, size, 0.3, 'multiply', 2);
    }
    return finishTexture(c);
  });
}

/** Roughness map: skin is oilier on the forehead/nose, drier on limbs. */
export function skinRoughnessTexture(desc) {
  const size = 256;
  const key = 'skinrough|' + (desc.oiliness > 0.5 ? 1 : 0);
  return cached(key, () => {
    const c = canvas(size);
    const ctx = c.getContext('2d');
    const base = desc.oiliness > 0.5 ? 108 : 140;
    ctx.fillStyle = 'rgb(' + base + ',' + base + ',' + base + ')';
    ctx.fillRect(0, 0, size, size);
    tileOver(ctx, grainTile(64, 991), size, size, 0.55, 'overlay', 1);
    return finishTexture(c, { linear: true });
  });
}

// ---------------------------------------------------------------------------
// Face. The head mesh uses a known cylindrical UV: u=0.5 is dead centre of the
// face, v runs 0 (chin) -> 1 (crown). Features are painted against that layout.
// ---------------------------------------------------------------------------
/**
 * Face atlas.
 *
 * The head mesh maps the face onto u = 0.5 +/- FACE_U (0.229 in body.js) and a
 * remapped v, so every feature below is positioned in that same space:
 *   u offset = FACE_U * sin(theta)   v: lips .315  nostrils .392  eyes .578  brow .625
 * Offsets are derived from real facial measurements (6.3cm interpupillary
 * distance, 5cm mouth, brow from 1.2cm to 4.8cm off centre).
 */
export function faceTexture(desc) {
  // NPC faces are painted at a fraction of the player's resolution: the sculpted
  // head geometry carries the recognisable variation, not the texture.
  const cap = desc.tier === 'player' ? 1024 : 384;
  const size = Math.min(settings.preset.textureSize, cap);
  const key = ['face', desc.toneIndex, desc.browShape, desc.browThickness.toFixed(2), desc.lipColor,
    desc.lipFullness.toFixed(2), desc.stubble.toFixed(2), desc.freckles.toFixed(2), desc.makeup.toFixed(2),
    desc.age.toFixed(2), desc.gender, size].join('|');
  return cached(key, () => {
    const S = size;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const tone = SKIN_TONES[desc.toneIndex % SKIN_TONES.length];
    const base = hexToRgb(tone.hex);
    const rng = makeRng(desc.seed || 4242);
    const female = desc.gender === 'female';

    ctx.fillStyle = rgbStr(base);
    ctx.fillRect(0, 0, S, S);

    const px = (u) => u * S;
    const py = (v) => (1 - v) * S;

    // Feature anchors (u offset from centre, v height).
    const EYE_U = 0.090, EYE_V = 0.578;
    const BROW_U = 0.087, BROW_V = 0.625;
    const NOSTRIL_U = 0.023, NOSE_V = 0.392;
    const LIP_V = 0.315;

    // --- Base shading: cheeks warm, temples and jaw cooler, sockets darker ---
    const dark = shade(tone.hex, -0.20);
    const deep = shade(tone.hex, -0.36);

    for (const side of [-1, 1]) {
      // Cheek warmth / blush
      const cg = ctx.createRadialGradient(px(0.5 + side * 0.150), py(0.44), 0, px(0.5 + side * 0.150), py(0.44), S * 0.125);
      const warm = shade(tone.hex, 0.10);
      cg.addColorStop(0, rgbStr({ r: Math.min(255, warm.r + 26), g: warm.g, b: warm.b }, 0.30 + desc.makeup * 0.28));
      cg.addColorStop(1, rgbStr(warm, 0));
      ctx.fillStyle = cg; ctx.fillRect(0, 0, S, S);

      // Eye socket depth
      const sg = ctx.createRadialGradient(px(0.5 + side * EYE_U), py(EYE_V + 0.012), 0, px(0.5 + side * EYE_U), py(EYE_V + 0.012), S * 0.075);
      sg.addColorStop(0, rgbStr(dark, 0.42));
      sg.addColorStop(0.6, rgbStr(dark, 0.16));
      sg.addColorStop(1, rgbStr(dark, 0));
      ctx.fillStyle = sg; ctx.fillRect(0, 0, S, S);

      // Under-eye shadow
      const ug = ctx.createRadialGradient(px(0.5 + side * EYE_U), py(EYE_V - 0.036), 0, px(0.5 + side * EYE_U), py(EYE_V - 0.036), S * 0.055);
      ug.addColorStop(0, rgbStr(dark, 0.20 + desc.age * 0.24));
      ug.addColorStop(1, rgbStr(dark, 0));
      ctx.fillStyle = ug; ctx.fillRect(0, 0, S, S);

      // Nose side shading — this is what makes the nose read in flat light.
      const ng = ctx.createLinearGradient(px(0.5 + side * 0.012), 0, px(0.5 + side * 0.062), 0);
      ng.addColorStop(0, rgbStr(dark, 0));
      ng.addColorStop(0.45, rgbStr(dark, 0.30));
      ng.addColorStop(1, rgbStr(dark, 0));
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(px(0.5 + side * 0.034), py(0.470), S * 0.034, S * 0.105, 0, 0, TAU);
      ctx.clip();
      ctx.fillStyle = ng; ctx.fillRect(0, 0, S, S);
      ctx.restore();

      // Temple / jaw shading
      const tg = ctx.createRadialGradient(px(0.5 + side * 0.260), py(0.60), 0, px(0.5 + side * 0.260), py(0.60), S * 0.12);
      tg.addColorStop(0, rgbStr(dark, 0.22));
      tg.addColorStop(1, rgbStr(dark, 0));
      ctx.fillStyle = tg; ctx.fillRect(0, 0, S, S);
    }

    // Brow-bone highlight and nose bridge highlight.
    const lightC = shade(tone.hex, 0.16);
    const bh = ctx.createLinearGradient(0, py(0.70), 0, py(0.44));
    bh.addColorStop(0, rgbStr(lightC, 0));
    bh.addColorStop(0.5, rgbStr(lightC, 0.30));
    bh.addColorStop(1, rgbStr(lightC, 0));
    ctx.save();
    ctx.beginPath(); ctx.ellipse(px(0.5), py(0.545), S * 0.022, S * 0.13, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = bh; ctx.fillRect(0, 0, S, S);
    ctx.restore();

    // --- Eyebrows: many short tapered strokes so they read as hair ----------
    const browCol = hexToRgb(desc.browColor);
    for (const side of [-1, 1]) {
      ctx.save();
      const cx = px(0.5 + side * BROW_U);
      const cy = py(BROW_V);
      const w = S * 0.050 * (0.92 + desc.browThickness * 0.30);
      const h = S * 0.013 * (0.70 + desc.browThickness * 0.85);
      ctx.translate(cx, cy);
      const strokes = 110;
      for (let i = 0; i < strokes; i++) {
        const t = i / (strokes - 1);
        const arch = desc.browShape === 'arched' ? Math.sin(t * Math.PI) * h * 1.35
          : desc.browShape === 'straight' ? 0
          : desc.browShape === 'angled' ? Math.min(t, 0.55) * h * 2.0
          : Math.sin(t * Math.PI) * h * 0.75;
        const x = (t - 0.5) * w * 2 * side;
        const y = -arch + (rng() - 0.5) * h * 0.85;
        // Brows are densest at the inner third and taper to a point outward.
        const taper = t < 0.18 ? 0.45 + t * 3.0 : 1 - Math.pow((t - 0.18) / 0.82, 2.0) * 0.82;
        ctx.strokeStyle = rgbStr(browCol, (0.65 + rng() * 0.35) * taper);
        ctx.lineWidth = S * 0.0026 * (0.7 + desc.browThickness * 0.8) * taper;
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.55);
        ctx.lineTo(x + side * S * 0.006, y - h * 0.60);
        ctx.stroke();
      }
      ctx.restore();
    }

    // --- Eyelids / lash line ------------------------------------------------
    for (const side of [-1, 1]) {
      const cx = px(0.5 + side * EYE_U);
      const cy = py(EYE_V);
      const w = S * 0.042, h = S * 0.019;
      ctx.save();
      ctx.translate(cx, cy);
      // Crease above the lid
      ctx.strokeStyle = rgbStr(deep, 0.34);
      ctx.lineWidth = S * 0.0022;
      ctx.beginPath();
      ctx.moveTo(-w * 0.95, -h * 0.55);
      ctx.quadraticCurveTo(0, -h * 1.75, w * 0.95, -h * 0.60);
      ctx.stroke();
      // Upper lash line — the strongest line on the whole face.
      ctx.strokeStyle = 'rgba(26,18,14,' + (0.82 + desc.makeup * 0.18) + ')';
      ctx.lineWidth = S * 0.0042 * (1 + desc.makeup * 1.1);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-w, h * 0.12);
      ctx.quadraticCurveTo(0, -h * 1.05, w, 0);
      ctx.stroke();
      // Lower lash line, softer.
      ctx.strokeStyle = 'rgba(40,28,22,' + (0.42 + desc.makeup * 0.30) + ')';
      ctx.lineWidth = S * 0.0022;
      ctx.beginPath();
      ctx.moveTo(-w * 0.92, h * 0.16);
      ctx.quadraticCurveTo(0, h * 1.30, w * 0.92, h * 0.04);
      ctx.stroke();
      // Inner corner (tear duct)
      ctx.fillStyle = rgbStr(shade(0xb06a60, 0), 0.5);
      ctx.beginPath(); ctx.ellipse(-side * w * 0.94, h * 0.35, S * 0.005, S * 0.004, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // --- Nose: nostrils, columella, tip shading -----------------------------
    ctx.fillStyle = rgbStr(shade(tone.hex, -0.66), 0.85);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(px(0.5 + side * NOSTRIL_U), py(NOSE_V), S * 0.0085, S * 0.0052, side * 0.42, 0, TAU);
      ctx.fill();
    }
    // Shadow under the nose tip
    const nu = ctx.createRadialGradient(px(0.5), py(NOSE_V - 0.006), 0, px(0.5), py(NOSE_V - 0.006), S * 0.035);
    nu.addColorStop(0, rgbStr(deep, 0.34));
    nu.addColorStop(1, rgbStr(deep, 0));
    ctx.fillStyle = nu; ctx.fillRect(0, 0, S, S);
    // Nostril wing creases
    ctx.strokeStyle = rgbStr(deep, 0.35);
    ctx.lineWidth = S * 0.0020;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(px(0.5 + side * 0.040), py(NOSE_V + 0.012));
      ctx.quadraticCurveTo(px(0.5 + side * 0.047), py(NOSE_V - 0.004), px(0.5 + side * 0.032), py(NOSE_V - 0.012));
      ctx.stroke();
    }

    // --- Lips ---------------------------------------------------------------
    const lip = hexToRgb(desc.lipColor);
    const lw = S * 0.068 * (0.86 + desc.lipFullness * 0.30);
    const lh = S * 0.016 * (0.62 + desc.lipFullness * 0.95);
    ctx.save();
    ctx.translate(px(0.5), py(LIP_V));
    const lipAlpha = female ? 0.80 + desc.makeup * 0.20 : 0.58;
    ctx.fillStyle = rgbStr(lip, lipAlpha);
    ctx.beginPath();
    ctx.moveTo(-lw, 0);
    ctx.quadraticCurveTo(-lw * 0.52, -lh * 1.30, -lw * 0.15, -lh * 0.34);
    ctx.quadraticCurveTo(0, -lh * 0.80, lw * 0.15, -lh * 0.34);
    ctx.quadraticCurveTo(lw * 0.52, -lh * 1.30, lw, 0);
    ctx.quadraticCurveTo(lw * 0.56, lh * 1.62, 0, lh * 1.78);
    ctx.quadraticCurveTo(-lw * 0.56, lh * 1.62, -lw, 0);
    ctx.fill();
    // The mouth opening line — the single most important mark for reading a face.
    ctx.strokeStyle = rgbStr(shade(desc.lipColor, -0.62), 0.80);
    ctx.lineWidth = S * 0.0034;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-lw * 0.99, -lh * 0.04);
    ctx.quadraticCurveTo(-lw * 0.45, lh * 0.30, 0, lh * 0.16);
    ctx.quadraticCurveTo(lw * 0.45, lh * 0.30, lw * 0.99, -lh * 0.04);
    ctx.stroke();
    // Vermillion border + lower-lip highlight
    ctx.strokeStyle = rgbStr(shade(desc.lipColor, 0.35), 0.35);
    ctx.lineWidth = S * 0.0016;
    ctx.beginPath();
    ctx.moveTo(-lw, 0);
    ctx.quadraticCurveTo(-lw * 0.52, -lh * 1.30, -lw * 0.15, -lh * 0.34);
    ctx.quadraticCurveTo(0, -lh * 0.80, lw * 0.15, -lh * 0.34);
    ctx.quadraticCurveTo(lw * 0.52, -lh * 1.30, lw, 0);
    ctx.stroke();
    const hg = ctx.createLinearGradient(0, -lh, 0, lh * 1.8);
    hg.addColorStop(0.55, 'rgba(255,255,255,0)');
    hg.addColorStop(0.78, 'rgba(255,255,255,' + (0.13 + desc.makeup * 0.16) + ')');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(0, lh * 0.75, lw * 0.72, lh * 0.95, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // Shadow under the lower lip
    const lg = ctx.createRadialGradient(px(0.5), py(LIP_V - 0.030), 0, px(0.5), py(LIP_V - 0.030), S * 0.040);
    lg.addColorStop(0, rgbStr(dark, 0.30));
    lg.addColorStop(1, rgbStr(dark, 0));
    ctx.fillStyle = lg; ctx.fillRect(0, 0, S, S);

    // --- Stubble / beard shadow --------------------------------------------
    if (desc.stubble > 0.02) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(px(0.5), py(0.255), S * 0.185, S * 0.125, 0, 0, TAU);
      ctx.clip();
      const tile = speckleTile(900, 1.1, desc.browColor, 0.18, 0.55, 8181);
      const step = tile.width * 0.55;
      ctx.globalAlpha = 0.40 + desc.stubble * 0.55;
      for (let y = py(0.255) - S * 0.14; y < py(0.255) + S * 0.14; y += step) {
        for (let x = px(0.5) - S * 0.20; x < px(0.5) + S * 0.20; x += step) {
          ctx.drawImage(tile, x, y, step, step);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // --- Freckles across the nose and cheeks --------------------------------
    if (desc.freckles > 0.05) {
      const fc = shade(tone.hex, -0.32);
      for (let i = 0; i < 260 * desc.freckles; i++) {
        const ang = rng() * TAU, r = Math.pow(rng(), 0.6);
        const x = px(0.5) + Math.cos(ang) * r * S * 0.19;
        const y = py(0.47) + Math.sin(ang) * r * S * 0.075;
        ctx.fillStyle = rgbStr(fc, rng.range(0.14, 0.40));
        ctx.beginPath(); ctx.arc(x, y, rng.range(1.0, 2.4) * (S / 512), 0, TAU); ctx.fill();
      }
    }

    // --- Age: forehead lines, nasolabial folds, crow's feet -----------------
    if (desc.age > 0.42) {
      const a = (desc.age - 0.42) / 0.58;
      ctx.strokeStyle = rgbStr(deep, 0.20 * a);
      ctx.lineWidth = S * 0.0020;
      for (let i = 0; i < 3; i++) {
        const y = py(0.700 + i * 0.026);
        ctx.beginPath();
        ctx.moveTo(px(0.40), y);
        ctx.quadraticCurveTo(px(0.5), y - S * 0.009, px(0.60), y);
        ctx.stroke();
      }
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(px(0.5 + side * 0.046), py(0.392));
        ctx.quadraticCurveTo(px(0.5 + side * 0.082), py(0.350), px(0.5 + side * 0.072), py(0.300));
        ctx.stroke();
        // Crow's feet
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(px(0.5 + side * 0.132), py(EYE_V + (k - 1) * 0.011));
          ctx.lineTo(px(0.5 + side * 0.168), py(EYE_V + (k - 1) * 0.020));
          ctx.stroke();
        }
      }
    }

    // Fine pore noise over the whole head.
    tileOver(ctx, grainTile(20, 1717), S, S, 0.34, 'overlay', 1);

    return finishTexture(c, { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
  });
}

// ---------------------------------------------------------------------------
// Eyes
// ---------------------------------------------------------------------------
export function irisTexture(colorHex) {
  return cached('iris|' + colorHex, () => {
    const S = 256;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rng = makeRng(colorHex);

    // Sclera with faint vessels.
    ctx.fillStyle = '#f2efe9';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(190,90,80,0.22)';
    for (let i = 0; i < 26; i++) {
      ctx.lineWidth = rng.range(0.4, 1.3);
      ctx.beginPath();
      let x = rng() * S, y = rng() * S;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += rng.range(-22, 22); y += rng.range(-22, 22); ctx.lineTo(x, y); }
      ctx.stroke();
    }

    // Iris disc, centred — the eye mesh maps this to the front of the eyeball.
    const cx = S * 0.5, cy = S * 0.5, R = S * 0.30;
    const base = hexToRgb(colorHex);
    const g = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
    g.addColorStop(0, rgbStr(shade(colorHex, 0.45)));
    g.addColorStop(0.55, rgbStr(base));
    g.addColorStop(1, rgbStr(shade(colorHex, -0.55)));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

    // Radial fibres give the iris real depth.
    for (let i = 0; i < 260; i++) {
      const a = rng() * TAU;
      const r0 = R * rng.range(0.16, 0.4);
      const r1 = R * rng.range(0.65, 0.99);
      const light = rng() < 0.5;
      ctx.strokeStyle = rgbStr(shade(colorHex, light ? rng.range(0.2, 0.75) : rng.range(-0.6, -0.2)), rng.range(0.15, 0.6));
      ctx.lineWidth = rng.range(0.6, 2.0);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
    // Collarette ring
    ctx.strokeStyle = rgbStr(shade(colorHex, 0.5), 0.35);
    ctx.lineWidth = R * 0.07;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.44, 0, TAU); ctx.stroke();
    // Limbal ring
    ctx.strokeStyle = 'rgba(22,16,12,0.65)';
    ctx.lineWidth = R * 0.10;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.96, 0, TAU); ctx.stroke();
    // Pupil
    ctx.fillStyle = '#080607';
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.36, 0, TAU); ctx.fill();
    // Catchlight sells the eye as wet and alive.
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath(); ctx.arc(cx - R * 0.26, cy - R * 0.28, R * 0.14, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(cx + R * 0.22, cy + R * 0.24, R * 0.07, 0, TAU); ctx.fill();

    return finishTexture(c, { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
  });
}

// ---------------------------------------------------------------------------
// Hair — strand-streaked texture applied to hair shells and cards.
// ---------------------------------------------------------------------------
export function hairTexture(colorHex, style) {
  return cached('hair|' + colorHex + '|' + style, () => {
    const S = 256;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rng = makeRng(colorHex + style.length * 31);
    const base = hexToRgb(colorHex);
    ctx.fillStyle = rgbStr(base);
    ctx.fillRect(0, 0, S, S);
    // Vertical strand streaks, lighter and darker.
    for (let i = 0; i < 300; i++) {
      const x = rng() * S;
      const light = rng() < 0.45;
      ctx.strokeStyle = rgbStr(shade(colorHex, light ? rng.range(0.15, 0.75) : rng.range(-0.55, -0.1)), rng.range(0.12, 0.5));
      ctx.lineWidth = rng.range(0.6, 3.2);
      ctx.beginPath();
      ctx.moveTo(x, -10);
      let cx = x;
      for (let y = 0; y < S + 10; y += 18) {
        cx += rng.range(-3.5, 3.5);
        ctx.lineTo(cx, y);
      }
      ctx.stroke();
    }
    // Sheen band.
    const g = ctx.createLinearGradient(0, S * 0.12, 0, S * 0.45);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.13)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return finishTexture(c);
  });
}

/** Alpha mask for hair cards: strands that fade out at the tips. */
export function hairAlphaTexture() {
  return cached('hairalpha', () => {
    const S = 128;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    const rng = makeRng(5150);
    for (let i = 0; i < 46; i++) {
      const x = rng() * S;
      const w = rng.range(1.5, 6);
      const g = ctx.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.62, 'rgba(255,255,255,0.92)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w * 0.2 + rng.range(-8, 8), S);
      ctx.lineTo(x - w * 0.2 + rng.range(-8, 8), S);
      ctx.closePath();
      ctx.fill();
    }
    return finishTexture(c, { linear: true });
  });
}

// ---------------------------------------------------------------------------
// Fabrics
// ---------------------------------------------------------------------------
export function fabricTexture(kind, colorHex) {
  return cached('fabric|' + kind + '|' + colorHex, () => {
    const S = 256;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rng = makeRng((colorHex | 0) + kind.length * 977);
    const base = hexToRgb(colorHex);
    ctx.fillStyle = rgbStr(base);
    ctx.fillRect(0, 0, S, S);

    if (kind === 'denim') {
      // Diagonal twill + faded highlights + stitch lines.
      for (let i = -S; i < S * 2; i += 3) {
        ctx.strokeStyle = rgbStr(shade(colorHex, rng.range(-0.30, 0.22)), 0.45);
        ctx.lineWidth = rng.range(0.8, 2.0);
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + S, S); ctx.stroke();
      }
      for (let i = 0; i < 60; i++) {
        const g = ctx.createRadialGradient(rng() * S, rng() * S, 0, rng() * S, rng() * S, rng.range(10, 60));
        g.addColorStop(0, 'rgba(255,255,255,0.09)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      }
      ctx.strokeStyle = 'rgba(226,190,120,0.85)';
      ctx.lineWidth = 2.1;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(S * 0.06, 0); ctx.lineTo(S * 0.06, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(S * 0.94, 0); ctx.lineTo(S * 0.94, S); ctx.stroke();
      ctx.setLineDash([]);
    } else if (kind === 'knit') {
      for (let y = 0; y < S; y += 6) {
        for (let x = 0; x < S; x += 6) {
          ctx.fillStyle = rgbStr(shade(colorHex, ((x / 6 + y / 6) % 2 ? 0.08 : -0.08) + rng.range(-0.05, 0.05)), 0.7);
          ctx.beginPath(); ctx.ellipse(x + 3, y + 3, 3.1, 2.3, 0, 0, TAU); ctx.fill();
        }
      }
    } else if (kind === 'leather') {
      for (let i = 0; i < 1400; i++) {
        ctx.fillStyle = rgbStr(shade(colorHex, rng.range(-0.3, 0.25)), rng.range(0.1, 0.4));
        ctx.beginPath();
        ctx.ellipse(rng() * S, rng() * S, rng.range(1.5, 6), rng.range(1.5, 6), rng() * TAU, 0, TAU);
        ctx.fill();
      }
    } else if (kind === 'nylon') {
      for (let i = 0; i < S; i += 2) {
        ctx.strokeStyle = rgbStr(shade(colorHex, i % 4 ? 0.05 : -0.05), 0.4);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke();
      }
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.0)');
      g.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    } else {
      // Plain cotton weave.
      const img = ctx.createImageData(S, S);
      const d = img.data;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = (y * S + x) * 4;
          const weave = ((x % 4 < 2) !== (y % 4 < 2)) ? 6 : -6;
          const n = (rng() - 0.5) * 10 + weave;
          d[i] = Math.max(0, Math.min(255, base.r + n));
          d[i + 1] = Math.max(0, Math.min(255, base.g + n));
          d[i + 2] = Math.max(0, Math.min(255, base.b + n));
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    return finishTexture(c);
  });
}

/** Normal-ish bump from a fabric kind (cheap: derived greyscale). */
export function fabricRoughness(kind) {
  const table = { denim: 0.88, cotton: 0.92, knit: 0.95, leather: 0.42, nylon: 0.58, lycra: 0.55 };
  return table[kind] != null ? table[kind] : 0.9;
}
