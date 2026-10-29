// ============================================================================
// Procedural textures (canvas based)
// ============================================================================
const Tex = {
  cache: new Map(),
  size(base) {
    const q = Settings.data.graphics.textureQuality;
    return q === 'low' ? base / 2 : q === 'ultra' ? base * 2 : base;
  },
  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
  make(key, w, h, draw, opts = {}) {
    const k = key + ':' + w + 'x' + h;
    if (this.cache.has(k)) return this.cache.get(k);
    const c = this.canvas(w, h);
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    if (opts.color !== false) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = opts.aniso || 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    this.cache.set(k, t);
    return t;
  },
  // white tile with grout lines; tiles x tiles per texture
  tile(kind) {
    const S = this.size(512);
    const tiles = kind === 'floor' ? 1 : 2;
    return {
      map: this.make('tile-' + kind, S, S, (g, w, h) => {
        const base = kind === 'ceiling' ? 236 : kind === 'wall' ? 240 : 238;
        g.fillStyle = `rgb(${base},${base},${base + 1})`; g.fillRect(0, 0, w, h);
        // subtle mottling
        const img = g.getImageData(0, 0, w, h), d = img.data;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const n = (fbm2(x / w * 6, y / h * 6, 3) - 0.5) * 7 + (hash2(x, y) - 0.5) * 3;
          const i = (y * w + x) * 4; d[i] += n; d[i + 1] += n; d[i + 2] += n;
        }
        g.putImageData(img, 0, 0);
        const step = w / tiles, gw = Math.max(1.5, w / 300);
        g.strokeStyle = 'rgba(150,154,160,0.85)'; g.lineWidth = gw;
        for (let i = 0; i <= tiles; i++) {
          g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, h); g.stroke();
          g.beginPath(); g.moveTo(0, i * step); g.lineTo(w, i * step); g.stroke();
        }
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1;
        for (let i = 0; i <= tiles; i++) { g.beginPath(); g.moveTo(i * step + gw, 0); g.lineTo(i * step + gw, h); g.stroke(); }
      }),
      rough: this.make('tileR-' + kind, S / 2, S / 2, (g, w, h) => {
        g.fillStyle = kind === 'floor' ? 'rgb(70,70,70)' : 'rgb(150,150,150)'; g.fillRect(0, 0, w, h);
        const img = g.getImageData(0, 0, w, h), d = img.data;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const n = (fbm2(x / w * 9 + 3, y / h * 9, 3) - 0.5) * 40;
          const i = (y * w + x) * 4; d[i] += n; d[i + 1] += n; d[i + 2] += n;
        }
        g.putImageData(img, 0, 0);
        const step = w / tiles; g.strokeStyle = 'rgb(235,235,235)'; g.lineWidth = Math.max(2, w / 150);
        for (let i = 0; i <= tiles; i++) {
          g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, h); g.stroke();
          g.beginPath(); g.moveTo(0, i * step); g.lineTo(w, i * step); g.stroke();
        }
      }, { color: false })
    };
  },
  grass() {
    const S = this.size(512);
    return this.make('grassGround', S, S, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = fbm2(x / w * 8, y / h * 8, 4), n2 = hash2(x * 3, y * 7);
        const dry = smoothstep(0.55, 0.8, fbm2(x / w * 3 + 9, y / h * 3, 3));
        const i = (y * w + x) * 4;
        d[i] = lerp(52, 112, dry) + n * 30 + n2 * 18;
        d[i + 1] = lerp(92, 110, dry) + n * 40 + n2 * 22;
        d[i + 2] = lerp(34, 52, dry) + n * 12 + n2 * 8;
        d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  },
  radial(key, inner, outer, size = 128) {
    return this.make('rad-' + key, size, size, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, inner); gr.addColorStop(1, outer);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, { clamp: true });
  },
  smoke() {
    return this.make('smoke', 128, 128, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = x / w - 0.5, dy = y / h - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
        const n = fbm2(x / w * 5, y / h * 5, 4);
        const a = clamp((1 - r) * (0.55 + n * 0.9) - 0.15, 0, 1);
        const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * 255;
      }
      g.putImageData(img, 0, 0);
    }, { clamp: true });
  },
  bulletHole() {
    return this.make('hole', 64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(10,10,10,1)'); gr.addColorStop(0.18, 'rgba(25,25,25,0.95)');
      gr.addColorStop(0.32, 'rgba(70,70,70,0.6)'); gr.addColorStop(0.6, 'rgba(90,90,90,0.15)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(30,30,30,0.5)'; g.lineWidth = 1;
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 6, h / 2 + Math.sin(a) * 6); g.lineTo(w / 2 + Math.cos(a) * (13 + (i % 3) * 4), h / 2 + Math.sin(a) * (13 + (i % 3) * 4)); g.stroke(); }
    }, { clamp: true });
  },
  scorch() {
    return this.make('scorch', 128, 128, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = x / w - 0.5, dy = y / h - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
        const n = fbm2(x / w * 6, y / h * 6, 4);
        const a = clamp((1 - r * (0.85 + n * 0.4)) * 1.3, 0, 1);
        const i = (y * w + x) * 4; d[i] = 20; d[i + 1] = 18; d[i + 2] = 16; d[i + 3] = a * 210;
      }
      g.putImageData(img, 0, 0);
    }, { clamp: true });
  },
  text(key, text, opts = {}) {
    const w = opts.w || 128, h = opts.h || 64;
    return this.make('txt-' + key, w, h, (g) => {
      g.clearRect(0, 0, w, h);
      g.font = `${opts.weight || 700} ${opts.size || 36}px ui-monospace, Menlo, Consolas, monospace`;
      g.fillStyle = opts.color || 'rgba(70,110,140,0.85)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2);
    }, { clamp: true });
  },
  cloud(i) {
    return this.make('cloud' + i, 256, 128, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x / w - 0.5) * 2, dy = (y / h - 0.55) * 2;
        const r = Math.sqrt(dx * dx * 0.9 + dy * dy * 2.2);
        const n = fbm2(x / w * 5 + i * 7.3, y / h * 3 + i * 3.1, 5);
        const a = clamp((1 - r) * 1.6 * (n * 1.4 - 0.25), 0, 1);
        const shade = 235 + (1 - y / h) * 20 - n * 25;
        const k = (y * w + x) * 4; d[k] = shade; d[k + 1] = shade; d[k + 2] = shade + 6; d[k + 3] = a * 255;
      }
      g.putImageData(img, 0, 0);
    }, { clamp: true });
  }
};
HT.Tex = Tex;
