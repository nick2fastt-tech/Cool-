// Procedural textures, drawn with Canvas 2D at load time (no image downloads).
import * as THREE from 'three';

const TAU = Math.PI * 2;
const FONT_HAND = '"Patrick Hand", "Comic Sans MS", cursive';
const FONT_TITLE = '"Luckiest Guy", Impact, sans-serif';
const FONT_UI = 'Fredoka, "Trebuchet MS", sans-serif';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cvs(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  // CPU-backed canvases: we read pixels back for normal maps, and textures upload once.
  c.getContext('2d', { willReadFrequently: true });
  return c;
}

/** Tileable fBm value noise as a grayscale canvas. */
function noiseCanvas(size, basePeriod, octaves, seed, contrast = 1) {
  const rand = mulberry32(seed);
  const data = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const P = basePeriod << o;
    const lat = new Float32Array(P * P);
    for (let i = 0; i < lat.length; i++) lat[i] = rand();
    const cell = size / P;
    for (let y = 0; y < size; y++) {
      const fy = y / cell;
      const y0 = Math.floor(fy);
      let ty = fy - y0;
      ty = ty * ty * (3 - 2 * ty);
      const r0 = (y0 % P) * P;
      const r1 = ((y0 + 1) % P) * P;
      for (let x = 0; x < size; x++) {
        const fx = x / cell;
        const x0 = Math.floor(fx);
        let tx = fx - x0;
        tx = tx * tx * (3 - 2 * tx);
        const c0 = x0 % P;
        const c1 = (x0 + 1) % P;
        const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * tx;
        const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * tx;
        data[y * size + x] += (a + (b - a) * ty) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  const c = cvs(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < data.length; i++) {
    let v = data[i] / total;
    v = 0.5 + (v - 0.5) * contrast;
    const g = Math.max(0, Math.min(255, v * 255)) | 0;
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Overlay a tileable noise canvas on ctx using a blend mode. */
function overlayNoise(ctx, noise, w, h, mode = 'overlay', alpha = 0.5, scale = 1) {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  const pat = ctx.createPattern(noise, 'repeat');
  if (scale !== 1 && pat.setTransform) pat.setTransform(new DOMMatrix().scale(scale, scale));
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Height canvas -> tangent-space normal map canvas (Sobel). */
function normalFromHeight(hc, strength = 2) {
  const w = hc.width;
  const h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cvs(w, h);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = H(x - 1, y - 1), t = H(x, y - 1), tr = H(x + 1, y - 1);
      const l = H(x - 1, y), r = H(x + 1, y);
      const bl = H(x - 1, y + 1), b = H(x, y + 1), br = H(x + 1, y + 1);
      const dx = (tr + 2 * r + br - tl - 2 * l - bl) * strength;
      const dy = (bl + 2 * b + br - tl - 2 * t - tr) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function hsl(h, s, l, a = 1) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxW, size, font, weight = '') {
  let s = size;
  ctx.font = `${weight} ${s}px ${font}`;
  while (ctx.measureText(text).width > maxW && s > 8) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${font}`;
  }
  return s;
}

function chalkText(ctx, text, x, y, size, color = 'rgba(245,245,238,0.92)', align = 'left', maxW = 0) {
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (maxW) fitText(ctx, text, maxW, size, FONT_HAND);
  else ctx.font = `${size}px ${FONT_HAND}`;
  const rand = mulberry32(text.length * 97 + Math.round(x + y));
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = i === 0 ? 0.9 : 0.25;
    ctx.fillStyle = color;
    ctx.fillText(text, x + (rand() - 0.5) * 2.2, y + (rand() - 0.5) * 2.2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
export class TextureLib {
  constructor(renderer) {
    this.renderer = renderer;
    this.maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;
    this.cache = new Map();
    this.noise = {};
  }

  tex(canvas, { srgb = true, repeat = null, aniso = true, wrap = true } = {}) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (wrap) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
    }
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = aniso ? Math.min(8, this.maxAniso) : 1;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }

  /** world size in meters -> repeat */
  set(name, maps, worldW, worldH = worldW) {
    for (const k of Object.keys(maps)) maps[k].repeat.set(1 / worldW, 1 / worldH);
    this.cache.set(name, maps);
    return maps;
  }

  get(name) {
    return this.cache.get(name);
  }

  initNoise() {
    this.noise.fine = noiseCanvas(256, 32, 3, 11, 1.4);
    this.noise.mid = noiseCanvas(256, 8, 4, 23, 1.3);
    this.noise.large = noiseCanvas(256, 2, 4, 37, 1.2);
    this.noise.grain = noiseCanvas(256, 64, 2, 41, 1.6);
  }

  // -------------------------------------------------------------- floors
  floorTile() {
    const S = 1024, N = 8, T = S / N;
    const rand = mulberry32(5);
    const c = cvs(S, S), ctx = c.getContext('2d');
    const h = cvs(S, S), hx = h.getContext('2d');
    const r = cvs(S, S), rx = r.getContext('2d');
    hx.fillStyle = '#fff'; hx.fillRect(0, 0, S, S);
    rx.fillStyle = 'rgb(70,70,70)'; rx.fillRect(0, 0, S, S);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const l = 86 + rand() * 4;
      ctx.fillStyle = hsl(42 + rand() * 6, 22 + rand() * 6, l);
      ctx.fillRect(i * T, j * T, T, T);
    }
    overlayNoise(ctx, this.noise.mid, S, S, 'soft-light', 0.35, 2);
    for (let k = 0; k < 16000; k++) {
      const x = rand() * S, y = rand() * S, s = 1 + rand() * 2.6;
      const p = rand();
      ctx.fillStyle = p < 0.4 ? 'rgba(150,135,110,.55)' : p < 0.7 ? 'rgba(120,120,125,.45)' : p < 0.9 ? 'rgba(255,255,250,.6)' : 'rgba(170,110,80,.45)';
      ctx.fillRect(x, y, s, s * (0.6 + rand() * 0.8));
    }
    ctx.strokeStyle = 'rgba(150,140,118,.85)'; ctx.lineWidth = 2.2;
    hx.strokeStyle = '#000'; hx.lineWidth = 4;
    rx.strokeStyle = 'rgb(200,200,200)'; rx.lineWidth = 4;
    for (let i = 0; i <= N; i++) {
      for (const g of [ctx, hx, rx]) {
        g.beginPath(); g.moveTo(i * T, 0); g.lineTo(i * T, S); g.stroke();
        g.beginPath(); g.moveTo(0, i * T); g.lineTo(S, i * T); g.stroke();
      }
    }
    overlayNoise(rx, this.noise.large, S, S, 'overlay', 0.5, 2);
    return this.set('floorTile', {
      map: this.tex(c),
      normalMap: this.tex(normalFromHeight(h, 1.2), { srgb: false }),
      roughnessMap: this.tex(r, { srgb: false }),
    }, 2.4);
  }

  terrazzo() {
    const S = 1024;
    const rand = mulberry32(9);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#d9d6cf'; ctx.fillRect(0, 0, S, S);
    overlayNoise(ctx, this.noise.large, S, S, 'soft-light', 0.4, 2);
    const cols = ['#8d8a84', '#f4f1ea', '#b9a58a', '#6d7b86', '#c97b5a', '#3e4a52', '#e9e4d6'];
    for (let k = 0; k < 9000; k++) {
      const x = rand() * S, y = rand() * S, s = 2 + rand() * 7;
      ctx.fillStyle = cols[(rand() * cols.length) | 0];
      ctx.globalAlpha = 0.65 + rand() * 0.35;
      ctx.beginPath();
      const n = 5 + ((rand() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, rr = s * (0.5 + rand() * 0.5);
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const r = cvs(256, 256), rx = r.getContext('2d');
    rx.fillStyle = 'rgb(40,40,40)'; rx.fillRect(0, 0, 256, 256);
    overlayNoise(rx, this.noise.mid, 256, 256, 'overlay', 0.35);
    return this.set('terrazzo', { map: this.tex(c), roughnessMap: this.tex(r, { srgb: false }) }, 3);
  }

  concrete(name = 'concrete', base = '#a3a29d', world = 2) {
    const S = 512;
    const rand = mulberry32(13);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
    overlayNoise(ctx, this.noise.large, S, S, 'soft-light', 0.55, 2);
    overlayNoise(ctx, this.noise.fine, S, S, 'overlay', 0.25, 2);
    for (let k = 0; k < 4000; k++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(60,60,60,.35)' : 'rgba(240,240,235,.3)';
      const s = 0.6 + rand() * 1.6;
      ctx.fillRect(rand() * S, rand() * S, s, s);
    }
    for (let k = 0; k < 6; k++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60 + rand() * 80);
      g.addColorStop(0, 'rgba(70,65,55,.12)'); g.addColorStop(1, 'rgba(70,65,55,0)');
      ctx.save(); ctx.translate(rand() * S, rand() * S); ctx.fillStyle = g; ctx.fillRect(-150, -150, 300, 300); ctx.restore();
    }
    const n = this.tex(normalFromHeight(this.noise.fine, 0.6), { srgb: false });
    return this.set(name, { map: this.tex(c), normalMap: n }, world);
  }

  asphalt() {
    const S = 512;
    const rand = mulberry32(17);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#3d3e41'; ctx.fillRect(0, 0, S, S);
    overlayNoise(ctx, this.noise.large, S, S, 'soft-light', 0.5, 2);
    for (let k = 0; k < 14000; k++) {
      const v = 60 + rand() * 90;
      ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.4 + rand() * 0.5})`;
      const s = 0.8 + rand() * 1.8;
      ctx.fillRect(rand() * S, rand() * S, s, s);
    }
    return this.set('asphalt', { map: this.tex(c), normalMap: this.tex(normalFromHeight(this.noise.fine, 0.9), { srgb: false }) }, 3);
  }

  grass() {
    const S = 512;
    const rand = mulberry32(19);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#5b8a37'; ctx.fillRect(0, 0, S, S);
    overlayNoise(ctx, this.noise.large, S, S, 'soft-light', 0.7, 2);
    overlayNoise(ctx, this.noise.mid, S, S, 'overlay', 0.3, 2);
    ctx.lineCap = 'round';
    for (let k = 0; k < 14000; k++) {
      const x = rand() * S, y = rand() * S, len = 3 + rand() * 6, a = -Math.PI / 2 + (rand() - 0.5) * 0.9;
      ctx.strokeStyle = hsl(88 + rand() * 22, 40 + rand() * 25, 26 + rand() * 24, 0.75);
      ctx.lineWidth = 0.8 + rand() * 0.9;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    }
    return this.set('grass', { map: this.tex(c) }, 3);
  }

  carpet() {
    const S = 512;
    const rand = mulberry32(23);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#b8b8b8'; ctx.fillRect(0, 0, S, S);
    overlayNoise(ctx, this.noise.grain, S, S, 'overlay', 0.6, 1);
    overlayNoise(ctx, this.noise.mid, S, S, 'soft-light', 0.3, 2);
    for (let k = 0; k < 20000; k++) {
      const v = rand() < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.16)';
      ctx.fillStyle = v; ctx.fillRect(rand() * S, rand() * S, 1.2, 1.2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(S, i * 128); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(i * 128 + 64, j * 128 + 64); ctx.rotate(Math.PI / 4); ctx.fillRect(-10, -10, 20, 20); ctx.restore();
    }
    return this.set('carpet', { map: this.tex(c), normalMap: this.tex(normalFromHeight(this.noise.grain, 0.8), { srgb: false }) }, 1.2);
  }

  fabric(name = 'fabric', velvet = false) {
    const S = 256;
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(0, 0, S, S);
    if (!velvet) {
      for (let i = 0; i < S; i += 4) {
        ctx.fillStyle = 'rgba(0,0,0,.07)'; ctx.fillRect(i, 0, 2, S);
        ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(0, i, S, 2);
      }
    }
    overlayNoise(ctx, velvet ? this.noise.mid : this.noise.grain, S, S, 'soft-light', velvet ? 0.5 : 0.4, 1);
    const n = this.tex(normalFromHeight(this.noise.grain, velvet ? 0.5 : 1.0), { srgb: false });
    return this.set(name, { map: this.tex(c), normalMap: n }, velvet ? 0.6 : 0.4);
  }

  // -------------------------------------------------------------- walls
  wallBlock() {
    const S = 1024, cols = 4, rows = 8, bw = S / cols, bh = S / rows, m = 7;
    const rand = mulberry32(29);
    const c = cvs(S, S), ctx = c.getContext('2d');
    const h = cvs(S, S), hx = h.getContext('2d');
    ctx.fillStyle = '#cfcac0'; ctx.fillRect(0, 0, S, S);
    hx.fillStyle = '#000'; hx.fillRect(0, 0, S, S);
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * bw / 2;
      for (let i = -1; i <= cols; i++) {
        const x = i * bw + off, y = j * bh;
        const l = 93 + rand() * 3;
        ctx.fillStyle = hsl(45, 12, l);
        ctx.fillRect(x + m / 2, y + m / 2, bw - m, bh - m);
        const g = hx.createLinearGradient(0, y, 0, y + bh);
        g.addColorStop(0, '#9a9a9a'); g.addColorStop(0.12, '#fff'); g.addColorStop(0.88, '#f4f4f4'); g.addColorStop(1, '#9a9a9a');
        hx.fillStyle = g;
        hx.fillRect(x + m / 2, y + m / 2, bw - m, bh - m);
      }
    }
    overlayNoise(ctx, this.noise.fine, S, S, 'soft-light', 0.35, 2);
    overlayNoise(hx, this.noise.fine, S, S, 'overlay', 0.25, 2);
    for (let k = 0; k < 5000; k++) {
      ctx.fillStyle = 'rgba(120,115,105,.18)';
      ctx.fillRect(rand() * S, rand() * S, 1.5, 1.5);
    }
    return this.set('wallBlock', {
      map: this.tex(c),
      normalMap: this.tex(normalFromHeight(h, 1.4), { srgb: false }),
    }, 1.6);
  }

  plaster() {
    const S = 512;
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#e9e6de'; ctx.fillRect(0, 0, S, S);
    overlayNoise(ctx, this.noise.mid, S, S, 'soft-light', 0.25, 2);
    overlayNoise(ctx, this.noise.fine, S, S, 'soft-light', 0.2, 2);
    return this.set('plaster', { map: this.tex(c), normalMap: this.tex(normalFromHeight(this.noise.fine, 0.35), { srgb: false }) }, 2);
  }

  brick() {
    const S = 1024, courses = 32, perRow = 10, ch = S / courses, bw = S / perRow, m = 4;
    const rand = mulberry32(31);
    const c = cvs(S, S), ctx = c.getContext('2d');
    const h = cvs(S, S), hx = h.getContext('2d');
    ctx.fillStyle = '#b5ada0'; ctx.fillRect(0, 0, S, S);
    hx.fillStyle = '#202020'; hx.fillRect(0, 0, S, S);
    for (let j = 0; j < courses; j++) {
      const off = (j % 2) * bw / 2;
      for (let i = -1; i <= perRow; i++) {
        const x = i * bw + off, y = j * ch;
        const hue = 8 + rand() * 12, sat = 38 + rand() * 22, l = 30 + rand() * 14;
        ctx.fillStyle = hsl(hue, sat, l);
        ctx.fillRect(x + m / 2, y + m / 2, bw - m, ch - m);
        if (rand() < 0.3) {
          ctx.fillStyle = hsl(hue, sat - 10, l - 8, 0.5);
          ctx.fillRect(x + m / 2, y + m / 2 + (ch - m) * 0.55, bw - m, (ch - m) * 0.45);
        }
        hx.fillStyle = '#fff';
        hx.fillRect(x + m / 2 + 1, y + m / 2 + 1, bw - m - 2, ch - m - 2);
      }
    }
    overlayNoise(ctx, this.noise.fine, S, S, 'soft-light', 0.5, 2);
    overlayNoise(hx, this.noise.fine, S, S, 'overlay', 0.3, 2);
    return this.set('brick', {
      map: this.tex(c),
      normalMap: this.tex(normalFromHeight(h, 1.6), { srgb: false }),
    }, 2.4);
  }

  ceilingTile() {
    const S = 512, N = 2, T = S / N;
    const rand = mulberry32(37);
    const c = cvs(S, S), ctx = c.getContext('2d');
    const h = cvs(S, S), hx = h.getContext('2d');
    ctx.fillStyle = '#f1f0ec'; ctx.fillRect(0, 0, S, S);
    hx.fillStyle = '#fff'; hx.fillRect(0, 0, S, S);
    overlayNoise(ctx, this.noise.fine, S, S, 'soft-light', 0.3, 1);
    for (let k = 0; k < 2600; k++) {
      ctx.strokeStyle = `rgba(150,145,135,${0.15 + rand() * 0.25})`;
      ctx.lineWidth = 0.8 + rand();
      const x = rand() * S, y = rand() * S;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (rand() - 0.5) * 8, y + (rand() - 0.5) * 8, x + (rand() - 0.5) * 10, y + (rand() - 0.5) * 10); ctx.stroke();
    }
    ctx.fillStyle = '#d4d6d8'; hx.fillStyle = '#000';
    for (let i = 0; i <= N; i++) {
      ctx.fillRect(i * T - 4, 0, 8, S); ctx.fillRect(0, i * T - 4, S, 8);
      hx.fillRect(i * T - 5, 0, 10, S); hx.fillRect(0, i * T - 5, S, 10);
    }
    return this.set('ceiling', { map: this.tex(c), normalMap: this.tex(normalFromHeight(h, 1.5), { srgb: false }) }, 1.2);
  }

  // -------------------------------------------------------------- wood + metal
  wood(name = 'wood', base = [30, 45, 62], world = 1.2, seed = 43) {
    const S = 1024;
    const rand = mulberry32(seed);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = hsl(base[0], base[1], base[2]); ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 420; k++) {
      const y = rand() * S, amp = 2 + rand() * 7, f = 0.004 + rand() * 0.01, ph = rand() * TAU;
      ctx.strokeStyle = hsl(base[0] - 4 + rand() * 6, base[1] + rand() * 10, base[2] - 18 + rand() * 26, 0.12 + rand() * 0.22);
      ctx.lineWidth = 0.8 + rand() * 3.5;
      ctx.beginPath();
      for (let x = -10; x <= S + 10; x += 16) ctx.lineTo(x, y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.3);
      ctx.stroke();
    }
    const knots = 3;
    for (let k = 0; k < knots; k++) {
      const x = rand() * S, y = rand() * S;
      for (let r = 26; r > 2; r -= 3) {
        ctx.strokeStyle = hsl(base[0] - 6, base[1] + 6, base[2] - 22, 0.25);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(x, y, r * 2.4, r * 0.7, 0, 0, TAU); ctx.stroke();
      }
    }
    ctx.save(); ctx.scale(1, 0.08);
    overlayNoise(ctx, this.noise.fine, S, S / 0.08, 'soft-light', 0.4, 2);
    ctx.restore();
    const hctx = cvs(256, 256);
    const hx = hctx.getContext('2d');
    hx.drawImage(c, 0, 0, 256, 256);
    const n = this.tex(normalFromHeight(hctx, 0.5), { srgb: false });
    return this.set(name, { map: this.tex(c), normalMap: n }, world);
  }

  planks() {
    const S = 1024, pw = 77;
    const rand = mulberry32(47);
    const src = this.get('wood').map.image;
    const c = cvs(S, S), ctx = c.getContext('2d');
    const h = cvs(S, S), hx = h.getContext('2d');
    hx.fillStyle = '#000'; hx.fillRect(0, 0, S, S);
    for (let x = 0, col = 0; x < S; x += pw, col++) {
      let y = -rand() * 400;
      while (y < S) {
        const len = 260 + rand() * 420;
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, pw, len); ctx.clip();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(src, rand() * 400, rand() * 900, 600, 120, 0, -pw, len + 2, pw);
        ctx.restore();
        ctx.fillStyle = `rgba(${rand() < 0.5 ? '0,0,0' : '255,240,220'},${rand() * 0.12})`;
        ctx.fillRect(x, y, pw, len);
        hx.fillStyle = '#fff'; hx.fillRect(x + 2, y + 2, pw - 4, len - 4);
        y += len;
      }
    }
    ctx.fillStyle = 'rgba(40,25,10,.6)';
    for (let x = 0; x < S; x += pw) ctx.fillRect(x - 1, 0, 2, S);
    return this.set('planks', { map: this.tex(c), normalMap: this.tex(normalFromHeight(h, 1.2), { srgb: false }) }, 2);
  }

  metal(name = 'metal', brushed = false) {
    const S = 256;
    const rand = mulberry32(53);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#d0d0d0'; ctx.fillRect(0, 0, S, S);
    if (brushed) {
      for (let k = 0; k < 900; k++) {
        ctx.strokeStyle = `rgba(${rand() < 0.5 ? 255 : 90},${rand() < 0.5 ? 255 : 90},${rand() < 0.5 ? 255 : 90},.08)`;
        const y = rand() * S;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y + (rand() - 0.5) * 2); ctx.stroke();
      }
    } else {
      overlayNoise(ctx, this.noise.mid, S, S, 'soft-light', 0.25, 1);
    }
    for (let k = 0; k < 40; k++) {
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      const x = rand() * S, y = rand() * S;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - 0.5) * 30, y + (rand() - 0.5) * 6); ctx.stroke();
    }
    return this.set(name, { map: this.tex(c) }, 1);
  }

  lockerFront() {
    const W = 256, H = 1024;
    const c = cvs(W, H), ctx = c.getContext('2d');
    const h = cvs(W, H), hx = h.getContext('2d');
    ctx.fillStyle = '#e6e6e6'; ctx.fillRect(0, 0, W, H);
    hx.fillStyle = '#808080'; hx.fillRect(0, 0, W, H);
    overlayNoise(ctx, this.noise.mid, W, H, 'soft-light', 0.2, 1);
    // door panel edges
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, W - 20, H - 20);
    hx.fillStyle = '#ffffff'; hx.fillRect(14, 14, W - 28, H - 28);
    // vents
    const vent = (y) => {
      for (let i = 0; i < 5; i++) {
        const yy = y + i * 22;
        ctx.fillStyle = 'rgba(20,20,25,.85)'; roundRect(ctx, 52, yy, W - 104, 10, 5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(56, yy + 10, W - 112, 2);
        hx.fillStyle = '#000'; roundRect(hx, 50, yy - 1, W - 100, 13, 6); hx.fill();
      }
    };
    vent(60);
    vent(H - 190);
    // handle recess
    ctx.fillStyle = 'rgba(30,30,35,.8)'; roundRect(ctx, W - 92, H * 0.47, 44, 110, 12); ctx.fill();
    ctx.fillStyle = 'rgba(200,200,205,1)'; roundRect(ctx, W - 86, H * 0.47 + 40, 32, 18, 5); ctx.fill();
    hx.fillStyle = '#202020'; roundRect(hx, W - 94, H * 0.47 - 2, 48, 114, 12); hx.fill();
    // number plate
    ctx.fillStyle = 'rgba(245,245,240,1)'; roundRect(ctx, W / 2 - 34, 200, 68, 30, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; roundRect(ctx, W / 2 - 34, 200, 68, 30, 5); ctx.stroke();
    return { map: this.tex(c, { wrap: false }), normalMap: this.tex(normalFromHeight(h, 2.2), { srgb: false, wrap: false }) };
  }

  blob() {
    const S = 128;
    const c = cvs(S, S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    return this.tex(c, { wrap: false, srgb: false });
  }

  // -------------------------------------------------------------- boards + signs
  board(kind, title, lines, opts = {}) {
    const W = 1536, H = 512;
    const c = cvs(W, H), ctx = c.getContext('2d');
    const rand = mulberry32(title.length * 13 + 7);
    const white = kind === 'white';
    if (white) {
      ctx.fillStyle = '#f6f7f6'; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = `rgba(120,130,150,${0.03 + rand() * 0.03})`;
        ctx.save(); ctx.translate(rand() * W, rand() * H); ctx.rotate((rand() - 0.5) * 0.2); ctx.fillRect(-200, -20, 400, 40); ctx.restore();
      }
    } else {
      ctx.fillStyle = '#2a4637'; ctx.fillRect(0, 0, W, H);
      overlayNoise(ctx, this.noise.mid, W, H, 'soft-light', 0.35, 3);
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = `rgba(255,255,255,${0.025 + rand() * 0.04})`;
        ctx.save(); ctx.translate(rand() * W, rand() * H); ctx.rotate((rand() - 0.5) * 0.15);
        roundRect(ctx, -180 - rand() * 120, -30, 360 + rand() * 240, 60 + rand() * 40, 30); ctx.fill(); ctx.restore();
      }
    }
    const ink = white ? ['#1d4ed8', '#b91c1c', '#111827', '#15803d'] : ['rgba(248,248,240,.95)', 'rgba(255,236,150,.95)', 'rgba(255,190,200,.95)', 'rgba(190,230,255,.95)'];
    const write = (txt, x, y, size, col, align = 'left', maxW = 0) => {
      if (white) {
        ctx.save(); ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
        if (maxW) fitText(ctx, txt, maxW, size, FONT_HAND); else ctx.font = `${size}px ${FONT_HAND}`;
        ctx.fillText(txt, x, y); ctx.restore();
      } else chalkText(ctx, txt, x, y, size, col, align, maxW);
    };
    write(title, W / 2, 104, 92, ink[1], 'center', W - 120);
    ctx.strokeStyle = white ? ink[0] : 'rgba(255,236,150,.7)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(W / 2 - 300, 128); ctx.quadraticCurveTo(W / 2, 118, W / 2 + 300, 130); ctx.stroke();
    let y = 210;
    const lx = opts.drawing ? 90 : 110;
    const maxW = opts.drawing ? W * 0.56 : W - 200;
    for (const ln of lines) {
      write(ln.t, lx, y, ln.s || 64, ink[ln.c || 0], 'left', maxW);
      y += (ln.s || 64) * 1.25;
    }
    if (opts.drawing) opts.drawing(ctx, W, H, ink, white);
    if (opts.date) write(opts.date, W - 60, H - 30, 40, ink[0], 'right');
    return this.tex(c, { wrap: false });
  }

  sign(text, sub, { w = 512, h = 192, bg = '#1b1f3b', fg = '#ffffff', accent = '#ffc72c', font = FONT_TITLE, border = true, size = 0 } = {}) {
    const c = cvs(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (border) { ctx.strokeStyle = accent; ctx.lineWidth = Math.max(6, h * 0.05); roundRect(ctx, h * 0.07, h * 0.07, w - h * 0.14, h - h * 0.14, h * 0.1); ctx.stroke(); }
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const main = size || (sub ? h * 0.42 : h * 0.5);
    fitText(ctx, text, w * 0.86, main, font);
    ctx.fillText(text, w / 2, sub ? h * 0.42 : h * 0.54);
    if (sub) {
      ctx.fillStyle = accent;
      fitText(ctx, sub, w * 0.8, h * 0.2, FONT_UI, '600');
      ctx.fillText(sub, w / 2, h * 0.76);
    }
    return this.tex(c, { wrap: false });
  }

  roomPlate(num, name, color) {
    const w = 512, h = 256;
    const c = cvs(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#1b1f3b'; roundRect(ctx, 0, 0, w, h, 26); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(0, h - 46, w, 46);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `128px ${FONT_TITLE}`; ctx.fillText(String(num), w / 2, 92);
    fitText(ctx, name.toUpperCase(), w - 60, 50, FONT_UI, '700');
    ctx.fillText(name.toUpperCase(), w / 2, 168);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) if ((i * 7 + j * 3 + num) % 3) { ctx.beginPath(); ctx.arc(w / 2 - 80 + i * 20, h - 30 + j * 12, 3.2, 0, TAU); ctx.fill(); }
    return this.tex(c, { wrap: false });
  }

  flagSign(num, name, color) {
    const w = 512, h = 160;
    const c = cvs(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#1b1f3b'; roundRect(ctx, 0, 0, w, h, 20); ctx.fill();
    ctx.fillStyle = color; roundRect(ctx, 10, 10, 150, h - 20, 14); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `76px ${FONT_TITLE}`; ctx.fillText(String(num), 85, h / 2 + 6);
    ctx.textAlign = 'left';
    fitText(ctx, name.toUpperCase(), w - 200, 58, FONT_TITLE);
    ctx.fillText(name.toUpperCase(), 182, h / 2 + 6);
    return this.tex(c, { wrap: false });
  }

  exitSign() {
    const w = 256, h = 96;
    const c = cvs(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#f7f7f7'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e11d2a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 70px ${FONT_UI}`; ctx.fillText('EXIT', w / 2, h / 2 + 4);
    return this.tex(c, { wrap: false });
  }

  hazard() {
    const w = 256, h = 64;
    const c = cvs(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#ffc400'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#151515';
    for (let x = -h; x < w + h; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 32, h); ctx.lineTo(x + 32 + h, 0); ctx.lineTo(x + h, 0); ctx.closePath(); ctx.fill();
    }
    overlayNoise(ctx, this.noise.fine, w, h, 'soft-light', 0.25, 1);
    const t = this.tex(c);
    return t;
  }

  constructionSign() {
    const w = 512, h = 512;
    const c = cvs(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#ffc400'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#151515';
    for (let x = -80; x < w + 80; x += 80) { ctx.beginPath(); ctx.moveTo(x, 70); ctx.lineTo(x + 40, 70); ctx.lineTo(x + 110, 0); ctx.lineTo(x + 70, 0); ctx.fill(); }
    for (let x = -80; x < w + 80; x += 80) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 40, h); ctx.lineTo(x + 110, h - 70); ctx.lineTo(x + 70, h - 70); ctx.fill(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `92px ${FONT_TITLE}`; ctx.fillText('UNDER', w / 2, 160);
    fitText(ctx, 'CONSTRUCTION', w - 50, 92, FONT_TITLE); ctx.fillText('CONSTRUCTION', w / 2, 250);
    ctx.font = `600 40px ${FONT_UI}`; ctx.fillText('2nd floor coming soon!', w / 2, 340);
    ctx.font = `600 30px ${FONT_UI}`; ctx.fillText('Hard hat area — no students', w / 2, 390);
    return this.tex(c, { wrap: false });
  }

  plastic() {
    const S = 256;
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#dfe7ea'; ctx.fillRect(0, 0, S, S);
    const rand = mulberry32(61);
    for (let k = 0; k < 30; k++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.2 + rand() * 0.3})`; ctx.lineWidth = 2 + rand() * 6;
      const x = rand() * S;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + (rand() - 0.5) * 60, S / 3, x + (rand() - 0.5) * 60, (S * 2) / 3, x + (rand() - 0.5) * 30, S); ctx.stroke();
    }
    overlayNoise(ctx, this.noise.mid, S, S, 'soft-light', 0.3, 1);
    return this.set('plastic', { map: this.tex(c) }, 2.5);
  }

  cork() {
    const S = 512;
    const rand = mulberry32(67);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#b98a57'; ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 9000; k++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(90,55,25,.4)' : 'rgba(230,190,140,.35)';
      ctx.fillRect(rand() * S, rand() * S, 1 + rand() * 2.5, 1 + rand() * 2.5);
    }
    return this.set('cork', { map: this.tex(c) }, 0.8);
  }

  bulletin(seed) {
    const W = 1024, H = 512;
    const rand = mulberry32(seed);
    const c = cvs(W, H), ctx = c.getContext('2d');
    const cork = this.get('cork').map.image;
    for (let x = 0; x < W; x += 512) ctx.drawImage(cork, x, 0, 512, 512);
    const papers = [
      ['Science Fair', 'Fri in the Library!', '#fef08a'],
      ['Drama Club', 'Auditorium 102', '#bfdbfe'],
      ['Book Club', 'Every Tuesday', '#fecaca'],
      ['Lost & Found', 'Ask the office', '#ffffff'],
      ['Math Team', 'Room 101', '#bbf7d0'],
      ['Spirit Week', 'Wear school colors!', '#e9d5ff'],
      ['Be Kind', 'Every day :)', '#fed7aa'],
    ];
    for (let i = 0; i < 6; i++) {
      const p = papers[(i + seed) % papers.length];
      const w = 210 + rand() * 40, h = 190 + rand() * 60;
      const x = 30 + i * 165 + (rand() - 0.5) * 20, y = 40 + (i % 2) * 200 + (rand() - 0.5) * 30;
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate((rand() - 0.5) * 0.18);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-w / 2 + 5, -h / 2 + 6, w, h);
      ctx.fillStyle = p[2]; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#1b1f3b'; ctx.textAlign = 'center';
      fitText(ctx, p[0], w - 24, 40, FONT_TITLE); ctx.fillText(p[0], 0, -h / 2 + 56);
      ctx.font = `30px ${FONT_HAND}`; ctx.fillText(p[1], 0, -h / 2 + 106);
      ctx.strokeStyle = 'rgba(27,31,59,.35)'; ctx.lineWidth = 3;
      for (let l = 0; l < 2; l++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 24, -h / 2 + 140 + l * 24); ctx.lineTo(w / 2 - 24 - rand() * 50, -h / 2 + 140 + l * 24); ctx.stroke(); }
      ctx.fillStyle = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b'][i % 4];
      ctx.beginPath(); ctx.arc(0, -h / 2 + 12, 9, 0, TAU); ctx.fill();
      ctx.restore();
    }
    return this.tex(c, { wrap: false });
  }

  poster(kind) {
    const W = 512, H = 704;
    const c = cvs(W, H), ctx = c.getContext('2d');
    const P = POSTERS[kind];
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    P.draw(ctx, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, W, H);
    return this.tex(c, { wrap: false });
  }

  banner(text, sub, { w = 2048, h = 256, bg = '#1b1f3b', fg = '#ffc72c' } = {}) {
    const c = cvs(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg; ctx.lineWidth = 8; ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    fitText(ctx, text, w - 160, sub ? h * 0.46 : h * 0.56, FONT_TITLE);
    ctx.fillText(text, w / 2, sub ? h * 0.42 : h * 0.54);
    if (sub) { ctx.fillStyle = '#ffffff'; fitText(ctx, sub, w - 300, h * 0.2, FONT_UI, '600'); ctx.fillText(sub, w / 2, h * 0.76); }
    return this.tex(c, { wrap: false });
  }

  letters(text, { w = 2048, h = 256, fg = '#ffc72c', stroke = '#1b1f3b' } = {}) {
    const c = cvs(w, h), ctx = c.getContext('2d');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, text, w - 40, h * 0.8, FONT_TITLE);
    ctx.lineJoin = 'round';
    ctx.lineWidth = h * 0.09; ctx.strokeStyle = stroke; ctx.strokeText(text, w / 2, h * 0.56);
    ctx.fillStyle = fg; ctx.fillText(text, w / 2, h * 0.56);
    return this.tex(c, { wrap: false });
  }

  emblem() {
    const S = 1024;
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2);
    ctx.fillStyle = '#1b1f3b'; ctx.beginPath(); ctx.arc(0, 0, 500, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffc72c'; ctx.beginPath(); ctx.arc(0, 0, 470, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2d6cdf'; ctx.beginPath(); ctx.arc(0, 0, 330, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1f3b'; ctx.font = `76px ${FONT_TITLE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const txt = 'SCHOOL LIFE ACADEMY • EST. 2026 • ';
    const chars = [...txt];
    for (let i = 0; i < chars.length; i++) {
      const a = (i / chars.length) * TAU - Math.PI / 2;
      ctx.save(); ctx.rotate(a + Math.PI / 2); ctx.fillText(chars[i], 0, -398); ctx.restore();
    }
    // book
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-200, -70); ctx.quadraticCurveTo(-90, -120, 0, -60); ctx.quadraticCurveTo(90, -120, 200, -70);
    ctx.lineTo(200, 130); ctx.quadraticCurveTo(90, 80, 0, 140); ctx.quadraticCurveTo(-90, 80, -200, 130); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1b1f3b'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, 140); ctx.stroke();
    ctx.lineWidth = 6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-170, -30 + i * 38); ctx.quadraticCurveTo(-90, -60 + i * 38, -30, -20 + i * 38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(170, -30 + i * 38); ctx.quadraticCurveTo(90, -60 + i * 38, 30, -20 + i * 38); ctx.stroke();
    }
    // star
    ctx.fillStyle = '#ffc72c';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 40 : 95; const a = (i / 10) * TAU - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, -200 + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    return this.tex(c, { wrap: false });
  }

  directory() {
    const W = 512, H = 768;
    const c = cvs(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = '#1b1f3b'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffc72c'; ctx.font = `60px ${FONT_TITLE}`; ctx.textAlign = 'center'; ctx.fillText('DIRECTORY', W / 2, 90);
    const rows = [['101', 'Math', '←'], ['102', 'Auditorium', '←'], ['103', 'Algebra I', '←'], ['104', 'Photosynthesis', '→'], ['105', 'English', '→'], ['106', 'Library', '→'], ['2F', 'Coming soon', '↑']];
    ctx.textAlign = 'left';
    rows.forEach((r, i) => {
      const y = 170 + i * 82;
      ctx.fillStyle = r[0] === '2F' ? '#e4572e' : '#2d6cdf'; roundRect(ctx, 30, y - 46, 96, 62, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `40px ${FONT_TITLE}`; ctx.fillText(r[0], 44, y);
      ctx.font = `600 40px ${FONT_UI}`; ctx.fillText(r[1], 146, y - 4);
      ctx.fillStyle = '#ffc72c'; ctx.font = `bold 46px ${FONT_UI}`; ctx.textAlign = 'right'; ctx.fillText(r[2], W - 30, y - 2); ctx.textAlign = 'left';
    });
    return this.tex(c, { wrap: false });
  }

  clockFace() {
    const S = 256;
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#fbfbf8'; ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.fillStyle = '#111';
    for (let i = 0; i < 60; i++) {
      ctx.save(); ctx.rotate((i / 60) * TAU);
      if (i % 5 === 0) ctx.fillRect(-3, -118, 6, 18); else ctx.fillRect(-1, -118, 2, 8);
      ctx.restore();
    }
    ctx.font = `bold 34px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * TAU - Math.PI / 2;
      ctx.fillText(String(i), Math.cos(a) * 82, Math.sin(a) * 82 + 2);
    }
    ctx.font = `600 13px ${FONT_UI}`; ctx.fillStyle = '#666'; ctx.fillText('SCHOOL LIFE', 0, 36);
    return this.tex(c, { wrap: false });
  }

  bookSpine() {
    const W = 64, H = 256;
    const c = cvs(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    overlayNoise(ctx, this.noise.fine, W, H, 'multiply', 0.15, 1);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 22, W, 8); ctx.fillRect(0, H - 34, W, 8);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(14, 70, W - 28, 6); ctx.fillRect(18, 86, W - 36, 4); ctx.fillRect(16, 100, W - 32, 4);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, 5, H); ctx.fillRect(W - 5, 0, 5, H);
    return this.tex(c);
  }

  face() {
    const W = 512, H = 256;
    const c = cvs(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    const cx = 128, cy = 128;
    // blush
    for (const s of [-1, 1]) {
      const g = ctx.createRadialGradient(cx + s * 34, cy + 16, 0, cx + s * 34, cy + 16, 16);
      g.addColorStop(0, 'rgba(255,140,140,.32)'); g.addColorStop(1, 'rgba(255,140,140,0)');
      ctx.fillStyle = g; ctx.fillRect(cx + s * 34 - 20, cy - 4, 40, 40);
    }
    // eyes
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(cx + s * 22, cy - 6, 9, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3b2414'; ctx.beginPath(); ctx.ellipse(cx + s * 22, cy - 5, 5.6, 6.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0d0806'; ctx.beginPath(); ctx.arc(cx + s * 22, cy - 5, 2.8, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(cx + s * 22 - 1.8, cy - 7.5, 1.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx + s * 22, cy - 6, 9.5, 7.4, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      // brows
      ctx.strokeStyle = '#4a2e1a'; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx + s * 13, cy - 19); ctx.quadraticCurveTo(cx + s * 22, cy - 24, cx + s * 31, cy - 19); ctx.stroke();
    }
    // nose
    ctx.strokeStyle = 'rgba(120,70,50,.45)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(cx - 2, cy + 2); ctx.quadraticCurveTo(cx - 5, cy + 12, cx, cy + 13); ctx.stroke();
    // mouth
    ctx.strokeStyle = '#8a3b33'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 11, cy + 24); ctx.quadraticCurveTo(cx, cy + 31, cx + 11, cy + 24); ctx.stroke();
    const t = this.tex(c, { wrap: false });
    t.anisotropy = 4;
    return t;
  }

  hair() {
    const S = 256;
    const rand = mulberry32(71);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#b0b0b0'; ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 1400; k++) {
      ctx.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.2)'; ctx.lineWidth = 0.8 + rand();
      const x = rand() * S, y = rand() * S;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - 0.5) * 6, y + 20 + rand() * 30); ctx.stroke();
    }
    return this.set('hair', { map: this.tex(c) }, 0.25);
  }

  denim() {
    const S = 256;
    const rand = mulberry32(73);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#d0d4dc'; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.5;
    for (let i = -S; i < S * 2; i += 5) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + S, S); ctx.stroke(); }
    for (let k = 0; k < 3000; k++) { ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.12)'; ctx.fillRect(rand() * S, rand() * S, 1.5, 1.5); }
    return this.set('denim', { map: this.tex(c) }, 0.2);
  }

  blinds() {
    const W = 128, H = 256;
    const c = cvs(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = '#e9e7e1'; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 8) {
      const g = ctx.createLinearGradient(0, y, 0, y + 8);
      g.addColorStop(0, '#fbfaf6'); g.addColorStop(0.7, '#dcd9d1'); g.addColorStop(1, '#a8a49a');
      ctx.fillStyle = g; ctx.fillRect(0, y, W, 8);
    }
    return this.set('blinds', { map: this.tex(c) }, 1, 0.6);
  }

  osb() {
    const S = 512;
    const rand = mulberry32(79);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#c9a46b'; ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 2200; k++) {
      ctx.save(); ctx.translate(rand() * S, rand() * S); ctx.rotate(rand() * TAU);
      ctx.fillStyle = hsl(30 + rand() * 10, 40 + rand() * 20, 45 + rand() * 25, 0.55); ctx.fillRect(-12, -3, 24 + rand() * 20, 6 + rand() * 4);
      ctx.restore();
    }
    return this.set('osb', { map: this.tex(c) }, 1.2);
  }

  leaves() {
    const S = 256;
    const rand = mulberry32(83);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#6f9a45'; ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 2500; k++) {
      ctx.fillStyle = hsl(85 + rand() * 30, 35 + rand() * 30, 22 + rand() * 30, 0.8);
      ctx.beginPath(); ctx.ellipse(rand() * S, rand() * S, 2 + rand() * 4, 1 + rand() * 2, rand() * TAU, 0, TAU); ctx.fill();
    }
    return this.set('leaves', { map: this.tex(c) }, 1.5);
  }

  windowDecal(kind) {
    // facade window for floors that aren't built yet (plastic sheeting) or closed blinds
    const W = 256, H = 256;
    const c = cvs(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = '#c9d1d6'; ctx.fillRect(0, 0, W, H);
    if (kind === 'plastic') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#9fb3bf'); g.addColorStop(1, '#6f8592');
      ctx.fillStyle = g; ctx.fillRect(10, 10, W - 20, H - 20);
      const rand = mulberry32(89);
      for (let k = 0; k < 18; k++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.15 + rand() * 0.25})`; ctx.lineWidth = 3 + rand() * 8;
        const x = 10 + rand() * (W - 20);
        ctx.beginPath(); ctx.moveTo(x, 10); ctx.bezierCurveTo(x + 30, 90, x - 30, 170, x + 10, H - 10); ctx.stroke();
      }
      ctx.fillStyle = '#ffc400'; ctx.fillRect(10, H / 2 - 8, W - 20, 16);
      ctx.fillStyle = '#151515';
      for (let x = 10; x < W - 10; x += 24) ctx.fillRect(x, H / 2 - 8, 12, 16);
    } else {
      for (let y = 10; y < H - 10; y += 8) { ctx.fillStyle = y % 16 ? '#ece9e1' : '#d6d2c8'; ctx.fillRect(10, y, W - 20, 8); }
    }
    ctx.strokeStyle = '#5f6a72'; ctx.lineWidth = 14; ctx.strokeRect(7, 7, W - 14, H - 14);
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    return this.tex(c, { wrap: false });
  }
}

// ---------------------------------------------------------------------------
// Posters
function title(ctx, W, text, y, color = '#1b1f3b', size = 74) {
  ctx.save(); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  fitText(ctx, text, W - 50, size, FONT_TITLE); ctx.fillText(text, W / 2, y); ctx.restore();
}
function body(ctx, text, x, y, size = 34, color = '#1b1f3b', align = 'center') {
  ctx.save(); ctx.fillStyle = color; ctx.textAlign = align; ctx.font = `600 ${size}px ${FONT_UI}`; ctx.fillText(text, x, y); ctx.restore();
}
function hand(ctx, text, x, y, size = 40, color = '#1b1f3b', align = 'center') {
  ctx.save(); ctx.fillStyle = color; ctx.textAlign = align; ctx.font = `${size}px ${FONT_HAND}`; ctx.fillText(text, x, y); ctx.restore();
}

const POSTERS = {
  shapes: {
    bg: '#fff7e0',
    draw(ctx, W, H) {
      title(ctx, W, 'SHAPES!', 92, '#e4572e');
      const cells = [
        ['Circle', (x, y) => { ctx.beginPath(); ctx.arc(x, y, 62, 0, TAU); ctx.fill(); }, '#2d6cdf'],
        ['Triangle', (x, y) => { ctx.beginPath(); ctx.moveTo(x, y - 66); ctx.lineTo(x + 70, y + 54); ctx.lineTo(x - 70, y + 54); ctx.fill(); }, '#3bb273'],
        ['Square', (x, y) => ctx.fillRect(x - 58, y - 58, 116, 116), '#f2a541'],
        ['Hexagon', (x, y) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.lineTo(x + Math.cos(a) * 66, y + Math.sin(a) * 66); } ctx.fill(); }, '#8e44ad'],
      ];
      cells.forEach(([n, f, col], i) => {
        const x = i % 2 ? W * 0.72 : W * 0.28, y = 230 + Math.floor(i / 2) * 250;
        ctx.fillStyle = col; f(x, y);
        body(ctx, n, x, y + 110, 34);
      });
    },
  },
  times: {
    bg: '#e8f4ff',
    draw(ctx, W, H) {
      title(ctx, W, 'TIMES TABLE', 84, '#2d6cdf', 60);
      const n = 9, cell = (W - 60) / (n + 1);
      ctx.font = `600 26px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let r = 0; r <= n; r++) for (let q = 0; q <= n; q++) {
        const x = 30 + q * cell, y = 120 + r * cell * 1.15;
        ctx.fillStyle = r === 0 || q === 0 ? '#2d6cdf' : (r + q) % 2 ? '#ffffff' : '#dbeafe';
        ctx.fillRect(x, y, cell - 2, cell * 1.15 - 2);
        ctx.fillStyle = r === 0 || q === 0 ? '#fff' : '#1b1f3b';
        const v = r === 0 && q === 0 ? '×' : r === 0 ? q : q === 0 ? r : r * q;
        ctx.fillText(String(v), x + cell / 2, y + cell * 0.58);
      }
    },
  },
  graph: {
    bg: '#ffffff',
    draw(ctx, W, H) {
      title(ctx, W, 'y = mx + b', 92, '#2d6cdf', 70);
      const ox = W / 2, oy = 400, s = 34;
      ctx.strokeStyle = '#cfe0f5'; ctx.lineWidth = 2;
      for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(ox + i * s, oy - 6 * s); ctx.lineTo(ox + i * s, oy + 6 * s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ox - 6 * s, oy + i * s); ctx.lineTo(ox + 6 * s, oy + i * s); ctx.stroke(); }
      ctx.strokeStyle = '#1b1f3b'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(ox - 6.3 * s, oy); ctx.lineTo(ox + 6.3 * s, oy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy - 6.3 * s); ctx.lineTo(ox, oy + 6.3 * s); ctx.stroke();
      ctx.strokeStyle = '#e4572e'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(ox - 3.5 * s, oy + 6 * s); ctx.lineTo(ox + 2.5 * s, oy - 6 * s); ctx.stroke();
      body(ctx, 'slope = rise / run', W / 2, H - 50, 34, '#1b1f3b');
    },
  },
  photosynthesis: {
    bg: '#effae8',
    draw(ctx, W, H) {
      title(ctx, W, 'PHOTOSYNTHESIS', 80, '#2f7d32', 56);
      // sun
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(100, 190, 52, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 8;
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ctx.beginPath(); ctx.moveTo(100 + Math.cos(a) * 64, 190 + Math.sin(a) * 64); ctx.lineTo(100 + Math.cos(a) * 88, 190 + Math.sin(a) * 88); ctx.stroke(); }
      // plant
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(W / 2 - 60, H - 150, 120, 80);
      ctx.strokeStyle = '#2f7d32'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(W / 2, H - 150); ctx.lineTo(W / 2, 330); ctx.stroke();
      ctx.fillStyle = '#4caf50';
      for (const [dx, dy, r] of [[-70, 360, -0.6], [70, 400, 0.6], [-60, 460, -0.5], [60, 500, 0.5], [0, 300, 0]]) {
        ctx.save(); ctx.translate(W / 2 + dx, dy); ctx.rotate(r); ctx.beginPath(); ctx.ellipse(0, 0, 60, 26, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
      // arrows + labels
      const arrow = (x1, y1, x2, y2, col) => {
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const a = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(a - 0.4) * 22, y2 - Math.sin(a - 0.4) * 22); ctx.lineTo(x2 - Math.cos(a + 0.4) * 22, y2 - Math.sin(a + 0.4) * 22); ctx.fill();
      };
      arrow(150, 230, 210, 300, '#f59e0b'); hand(ctx, 'light', 200, 240, 36, '#b45309');
      arrow(W - 40, 260, W / 2 + 90, 350, '#475569'); body(ctx, 'CO₂ in', W - 90, 240, 32, '#334155');
      arrow(W / 2 - 90, 420, 40, 360, '#0ea5e9'); body(ctx, 'O₂ out', 90, 420, 32, '#0369a1');
      arrow(W / 2 + 140, H - 80, W / 2 + 70, H - 180, '#2563eb'); body(ctx, 'H₂O', W / 2 + 170, H - 60, 32, '#1d4ed8');
    },
  },
  cell: {
    bg: '#f0fdf4',
    draw(ctx, W, H) {
      title(ctx, W, 'PLANT CELL', 86, '#15803d', 64);
      ctx.fillStyle = '#bbf7d0'; ctx.strokeStyle = '#15803d'; ctx.lineWidth = 10;
      roundRect(ctx, 70, 140, W - 140, H - 260, 40); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c4b5fd'; ctx.beginPath(); ctx.arc(W / 2 + 60, 300, 60, 0, TAU); ctx.fill();
      ctx.fillStyle = '#93c5fd'; roundRect(ctx, 120, 360, 200, 150, 30); ctx.fill();
      ctx.fillStyle = '#16a34a';
      for (const [x, y] of [[150, 200], [330, 450], [380, 210], [170, 560], [360, 560]]) { ctx.beginPath(); ctx.ellipse(x, y, 34, 16, 0.4, 0, TAU); ctx.fill(); }
      body(ctx, 'chloroplasts make food!', W / 2, H - 60, 30, '#14532d');
    },
  },
  parts: {
    bg: '#fff1f2',
    draw(ctx, W, H) {
      title(ctx, W, 'PARTS OF SPEECH', 82, '#be123c', 54);
      const rows = [['Noun', 'person, place, thing', '#e4572e'], ['Verb', 'action word', '#2d6cdf'], ['Adjective', 'describes a noun', '#3bb273'], ['Adverb', 'describes a verb', '#8e44ad'], ['Pronoun', 'he, she, they', '#f2a541']];
      rows.forEach(([a, b, col], i) => {
        const y = 150 + i * 106;
        ctx.fillStyle = col; roundRect(ctx, 30, y, W - 60, 88, 18); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = `46px ${FONT_TITLE}`; ctx.fillText(a, 52, y + 50);
        ctx.font = `600 24px ${FONT_UI}`; ctx.fillText(b, 54, y + 76);
      });
    },
  },
  read: {
    bg: '#fef9c3',
    draw(ctx, W, H) {
      title(ctx, W, 'READ!', 130, '#1b1f3b', 130);
      const cols = ['#e4572e', '#2d6cdf', '#3bb273', '#8e44ad', '#f2a541', '#0ea5e9'];
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = cols[i];
        const w = 56, h = 200 + (i % 3) * 30;
        ctx.save(); ctx.translate(70 + i * 64, H - 140); ctx.rotate(i === 5 ? 0.25 : 0);
        ctx.fillRect(0, -h, w, h); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(10, -h + 30, w - 20, 8); ctx.restore();
      }
      body(ctx, 'Open a book, open your mind', W / 2, 230, 30);
    },
  },
  kind: {
    bg: '#2d6cdf',
    draw(ctx, W, H) {
      title(ctx, W, 'BE KIND', 160, '#ffc72c', 110);
      ctx.fillStyle = '#ffc72c';
      ctx.beginPath(); ctx.moveTo(W / 2, 540); ctx.bezierCurveTo(W / 2 - 200, 420, W / 2 - 150, 250, W / 2, 330); ctx.bezierCurveTo(W / 2 + 150, 250, W / 2 + 200, 420, W / 2, 540); ctx.fill();
      body(ctx, 'It\'s cool to be kind', W / 2, H - 70, 36, '#fff');
    },
  },
  spirit: {
    bg: '#1b1f3b',
    draw(ctx, W, H) {
      title(ctx, W, 'GO', 190, '#ffc72c', 160);
      title(ctx, W, 'OWLS!', 330, '#ffffff', 130);
      ctx.fillStyle = '#ffc72c';
      ctx.beginPath(); ctx.ellipse(W / 2, 500, 90, 110, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(W / 2 - 38, 470, 30, 0, TAU); ctx.arc(W / 2 + 38, 470, 30, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b1f3b'; ctx.beginPath(); ctx.arc(W / 2 - 38, 472, 13, 0, TAU); ctx.arc(W / 2 + 38, 472, 13, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e4572e'; ctx.beginPath(); ctx.moveTo(W / 2 - 12, 505); ctx.lineTo(W / 2 + 12, 505); ctx.lineTo(W / 2, 530); ctx.fill();
      body(ctx, 'School Life Academy', W / 2, H - 40, 30, '#ffc72c');
    },
  },
  periodic: {
    bg: '#f8fafc',
    draw(ctx, W, H) {
      title(ctx, W, 'ELEMENTS', 84, '#1b1f3b', 64);
      const cols = ['#fca5a5', '#fdba74', '#fde68a', '#bbf7d0', '#a5f3fc', '#c4b5fd'];
      const sy = ['H', 'He', 'C', 'N', 'O', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'K', 'Ca', 'Fe', 'Cu', 'Zn', 'Ag', 'Au', 'Hg', 'Pb', 'Ne', 'Ar', 'Li'];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < 24; i++) {
        const x = 40 + (i % 4) * 110, y = 130 + Math.floor(i / 4) * 92;
        ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(x, y, 100, 82);
        ctx.fillStyle = '#1b1f3b'; ctx.font = `600 40px ${FONT_UI}`; ctx.fillText(sy[i], x + 50, y + 46);
        ctx.font = `500 16px ${FONT_UI}`; ctx.fillText(String(i + 1), x + 16, y + 14);
      }
    },
  },
  quiet: {
    bg: '#ecfeff',
    draw(ctx, W, H) {
      title(ctx, W, 'QUIET', 170, '#0e7490', 130);
      title(ctx, W, 'PLEASE', 300, '#0e7490', 100);
      ctx.fillStyle = '#0e7490'; ctx.beginPath(); ctx.arc(W / 2, 480, 90, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 8, 400, 16, 120);
      body(ctx, 'Shh... people are reading', W / 2, H - 60, 30, '#155e75');
    },
  },
  showcase: {
    bg: '#4c1d95',
    draw(ctx, W, H) {
      title(ctx, W, 'DRAMA', 150, '#fde68a', 110);
      title(ctx, W, 'CLUB', 270, '#ffffff', 100);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.ellipse(W / 2 - 60, 450, 70, 85, -0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f9a8d4'; ctx.beginPath(); ctx.ellipse(W / 2 + 60, 470, 70, 85, 0.2, 0, TAU); ctx.fill();
      body(ctx, 'Auditorium • Room 102', W / 2, H - 50, 30, '#fde68a');
    },
  },
};
