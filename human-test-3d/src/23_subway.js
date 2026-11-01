// ============================================================================
// ATLANTIC AV–BARCLAYS CTR (Brooklyn): the street corner, the fare-control mezzanine, the IRT
// Eastern Parkway platforms laid out as at the real station - side platform, two tracks, island,
// two tracks, side platform (2 3 on the local tracks, 4 5 express) - an underpass below the
// tracks, and the deep BMT Brighton platform (one island, two tracks, B Q) under a bridge.
// Levels: street 0 · IRT + fare control -6.1 (≈20 ft) · underpass -10.5 · Brighton -18 (≈60 ft).
// Collision: walkable floor regions (levels stack; every lookup takes a height hint), static
// AABB colliders, and moving train cars (24_subwaytrains.js).
// ============================================================================
const SUB_LINES = {
  '2': '#EE352E', '3': '#EE352E', '4': '#00933C', '5': '#00933C', 'B': '#FF6319', 'D': '#FF6319', 'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A'
};
const _sv1 = new V3(), _sv2 = new V3(), _sv3 = new V3();

// --- procedural textures ----------------------------------------------------------
const SubTex = {
  // glazed 3x6 subway tile, running bond: 1 texture = 1 m
  tile(key = 'white', base = [236, 236, 230], var_ = 8) {
    return Tex.make('sub-tile-' + key, 512, 512, (g, w, h) => {
      g.fillStyle = '#b9b9b2'; g.fillRect(0, 0, w, h);
      const cols = 8, rows = 16, tw = w / cols, th = h / rows;
      for (let r = 0; r < rows; r++) for (let c = -1; c < cols; c++) {
        const x = c * tw + (r % 2 ? tw / 2 : 0), y = r * th, n = (hash2(c * 7 + r * 13, r) - 0.5) * var_;
        const gr = g.createLinearGradient(x, y, x, y + th);
        gr.addColorStop(0, `rgb(${base[0] + n + 8},${base[1] + n + 8},${base[2] + n + 8})`);
        gr.addColorStop(1, `rgb(${base[0] + n - 6},${base[1] + n - 6},${base[2] + n - 6})`);
        g.fillStyle = gr; g.fillRect(x + 1.5, y + 1.5, tw - 3, th - 3);
      }
    });
  },
  terrazzo() { // chips stamped straight into the pixel buffer (canvas path fills are slow on some devices)
    return Tex.make('sub-terrazzo', 512, 512, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] = 184 + n; d[i + 1] = 180 + n; d[i + 2] = 171 + n; d[i + 3] = 255; }
      const chips = [[239, 236, 230], [58, 56, 54], [141, 138, 132], [214, 209, 198], [110, 106, 100], [160, 74, 58], [63, 106, 85]];
      for (let k = 0; k < 2600; k++) {
        const c = chips[Math.random() < 0.94 ? Math.floor(Math.random() * 5) : 5 + Math.floor(Math.random() * 2)];
        const cx = Math.random() * w, cy = Math.random() * h, r = 0.7 + Math.random() * 2.2, r2 = r * r;
        for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > r2) continue;
          const i = (((y + h) % h) * w + ((x + w) % w)) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        }
      }
      g.putImageData(img, 0, 0);
      g.strokeStyle = 'rgba(80,78,72,0.5)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    });
  },
  concrete(key = 'c', base = 150) {
    return Tex.make('sub-concrete-' + key, 256, 256, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = fbm2(x / w * 6, y / h * 6, 4) * 40 + (hash2(x, y) - 0.5) * 14 - 20, v = clamp(base + n, 0, 255), i = (y * w + x) * 4;
        d[i] = v; d[i + 1] = v; d[i + 2] = v * 1.02; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  },
  glassBlock() {
    return Tex.make('sub-glassblock', 256, 256, (g, w, h) => {
      g.fillStyle = '#9aa5a8'; g.fillRect(0, 0, w, h);
      const n = 5, s = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = i * s + 4, y = j * s + 4, gr = g.createRadialGradient(x + s / 2, y + s / 2, 2, x + s / 2, y + s / 2, s * 0.7);
        gr.addColorStop(0, '#f4fbff'); gr.addColorStop(0.6, '#cfe0e6'); gr.addColorStop(1, '#9fb5bd');
        g.fillStyle = gr; g.fillRect(x, y, s - 8, s - 8);
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 4, y + 10 + k * 14); g.bezierCurveTo(x + s * 0.3, y + 2 + k * 14, x + s * 0.6, y + 18 + k * 14, x + s - 12, y + 8 + k * 14); g.stroke(); }
      }
    });
  },
  tactile() {
    return Tex.make('sub-tactile', 128, 128, (g, w, h) => {
      g.fillStyle = '#e8b81c'; g.fillRect(0, 0, w, h);
      const n = 6, s = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = (i + 0.5) * s, y = (j + 0.5) * s, gr = g.createRadialGradient(x - 2, y - 2, 1, x, y, s * 0.36);
        gr.addColorStop(0, '#fff2a8'); gr.addColorStop(0.7, '#e2ae12'); gr.addColorStop(1, '#a67c06');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, s * 0.33, 0, TAU); g.fill();
      }
    });
  },
  asphalt() {
    return Tex.make('sub-asphalt', 512, 512, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = (hash2(x, y) - 0.5) * 30 + fbm2(x / w * 5, y / h * 5, 4) * 26, v = clamp(58 + n, 0, 255), i = (y * w + x) * 4;
        d[i] = v; d[i + 1] = v; d[i + 2] = v * 1.03; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      g.strokeStyle = 'rgba(20,20,20,0.5)'; g.lineWidth = 2;
      for (let k = 0; k < 6; k++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
    });
  },
  pavers() {
    return Tex.make('sub-pavers', 256, 256, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data, s2 = w / 2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, gx = x % s2, gy = y % s2, joint = gx < 2 || gy < 2 || gx > s2 - 3 || gy > s2 - 3;
        const v = joint ? 150 : 168 + (hash2(Math.floor(x / s2), Math.floor(y / s2)) - 0.5) * 18, n = (Math.random() - 0.5) * 16;
        d[i] = v + n; d[i + 1] = v - 2 + n; d[i + 2] = v - 6 + n; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  },
  // brick facade with windows (1 texture = 8 m x 8 m, three storeys)
  facade(key, brick, trim) {
    return Tex.make('sub-facade-' + key, 512, 512, (g, w, h) => {
      const bc = new THREE.Color(brick), img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, mortar = y % 6 === 0 || (x + (Math.floor(y / 6) % 2) * 6) % 12 === 0, nn = (Math.random() - 0.5) * 22, k = mortar ? 0.82 : 1;
        d[i] = bc.r * 255 * k + nn; d[i + 1] = bc.g * 255 * k + nn * 0.8; d[i + 2] = bc.b * 255 * k + nn * 0.7; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      for (let fl = 0; fl < 3; fl++) for (let c = 0; c < 4; c++) {
        const x = c * 128 + 30, y = fl * 170 + 34, ww = 68, hh = 100;
        g.fillStyle = trim; g.fillRect(x - 6, y - 8, ww + 12, hh + 16);
        const gr = g.createLinearGradient(x, y, x + ww, y + hh); gr.addColorStop(0, '#2c3a48'); gr.addColorStop(0.5, '#5d7488'); gr.addColorStop(1, '#22303c');
        g.fillStyle = gr; g.fillRect(x, y, ww, hh);
        g.fillStyle = trim; g.fillRect(x + ww / 2 - 2, y, 4, hh); g.fillRect(x, y + hh * 0.45, ww, 4);
      }
    });
  },
  // the arena's weathered-steel bands
  rust() {
    return Tex.make('sub-rust', 512, 512, (g, w, h) => {
      g.fillStyle = '#1d1a18'; g.fillRect(0, 0, w, h);
      for (let b = 0; b < 8; b++) {
        const y = b * 64 + 6, hh = 40 + (b % 3) * 6;
        const img = g.createImageData(w, hh), d = img.data;
        for (let yy = 0; yy < hh; yy++) for (let x = 0; x < w; x++) {
          const n = fbm2(x / 70 + b * 3.1, yy / 30 + b, 4), i = (yy * w + x) * 4;
          d[i] = 120 + n * 70; d[i + 1] = 58 + n * 34; d[i + 2] = 30 + n * 14; d[i + 3] = 255;
        }
        g.putImageData(img, 0, y);
      }
    });
  },
  ballast() {
    return Tex.make('sub-ballast', 256, 256, (g, w, h) => {
      g.fillStyle = '#2a2826'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) { const v = 30 + Math.random() * 50; g.fillStyle = `rgb(${v},${v - 3},${v - 6})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 0, TAU); g.fill(); }
    });
  },
  // station name / direction signs: white Helvetica on black, with line bullets
  sign(key, text, lines, opts = {}) {
    const W = opts.w || 1024, H = opts.h || 128;
    return Tex.make('sub-sign-' + key, W, H, (g) => {
      g.fillStyle = opts.bg || '#111214'; g.fillRect(0, 0, W, H);
      if (!opts.noStripe) { g.fillStyle = '#ffffff'; g.fillRect(0, 8, W, 3); }
      let x = 24;
      for (const l of lines || []) {
        const r = H * 0.3, cy = H * 0.56;
        g.fillStyle = SUB_LINES[l] || '#808183'; g.beginPath(); g.arc(x + r, cy, r, 0, TAU); g.fill();
        g.fillStyle = (l === 'N' || l === 'Q' || l === 'R') ? '#111' : '#fff';
        g.font = `bold ${Math.round(r * 1.45)}px Helvetica, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(l, x + r, cy + r * 0.06);
        x += r * 2 + 10;
      }
      g.fillStyle = opts.fg || '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.font = `bold ${Math.round(H * (opts.size || 0.42))}px Helvetica, Arial, sans-serif`;
      g.fillText(text, x + (lines && lines.length ? 14 : 0), H * 0.56, W - x - 30);
    }, { clamp: true, aniso: 8 });
  },
  // vertical column sign (white on black, reads top to bottom)
  columnSign(key, text) {
    return Tex.make('sub-csign-' + key, 128, 1024, (g, w, h) => {
      g.fillStyle = '#111214'; g.fillRect(0, 0, w, h);
      g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 2);
      g.fillStyle = '#fff'; g.font = 'bold 64px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 0, 4, h - 60); g.restore();
    }, { clamp: true, aniso: 8 });
  },
  // mosaic helpers: per-tessera tint + grout grid over whatever was painted (no pixel read-back)
  tesserae(g, w, h, cell, k = 0.07, grout = 'rgba(70,64,56,0.5)') {
    for (let y = 0, j = 0; y < h; y += cell, j++) for (let x = 0, i = 0; x < w; x += cell, i++) {
      const n = hash2(i * 3 + 17, j * 5 + 3) - 0.5;
      g.fillStyle = n > 0 ? `rgba(255,255,255,${(n * 2 * k).toFixed(3)})` : `rgba(0,0,0,${(-n * 2 * k).toFixed(3)})`;
      g.fillRect(x, y, cell, cell);
    }
    g.fillStyle = grout;
    for (let y = 0; y < h; y += cell) g.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += cell) g.fillRect(x, 0, 1, h);
  },
  // the 1908 IRT name tablet: cream roman capitals on a blue-green field in a terra-cotta frame
  tabletIRT() {
    return Tex.make('sub-tab-irt', 1024, 256, (g, w, h) => {
      const c = 8;
      g.fillStyle = '#c9a77c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#a4502f'; g.fillRect(c * 2, c * 2, w - c * 4, h - c * 4);
      g.fillStyle = '#efe4c8';
      for (let x = c * 3; x < w - c * 3; x += c * 3) { g.fillRect(x, c * 3, c, c); g.fillRect(x, h - c * 4, c, c); }
      for (let y = c * 6; y < h - c * 5; y += c * 3) { g.fillRect(c * 3, y, c, c); g.fillRect(w - c * 4, y, c, c); }
      g.fillRect(c * 5, c * 5, w - c * 10, h - c * 10);
      g.fillStyle = '#2d6c6f'; g.fillRect(c * 6, c * 6, w - c * 12, h - c * 12);
      g.fillStyle = '#f2ead4'; g.font = 'bold 112px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ATLANTIC AVENUE', w / 2, h / 2 + 6, w - c * 18);
      this.tesserae(g, w, h, c);
    }, { aniso: 8 });
  },
  // terra-cotta "A" relief plaque (alpha cut-out)
  medallion() {
    return Tex.make('sub-medal-a', 256, 320, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const ell = (rx, ry, fill) => { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fillStyle = fill; g.fill(); };
      ell(122, 154, '#6f3220');
      const gr = g.createRadialGradient(cx - 30, cy - 40, 10, cx, cy, 150); gr.addColorStop(0, '#dd9065'); gr.addColorStop(1, '#94462a');
      ell(112, 144, gr);
      ell(94, 124, '#b5633e');
      g.font = 'bold 190px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(58,22,10,0.85)'; g.fillText('A', cx + 6, cy + 18);
      g.fillStyle = 'rgba(255,214,170,0.8)'; g.fillText('A', cx - 4, cy + 7);
      g.fillStyle = '#c4703f'; g.fillText('A', cx, cy + 12);
    }, { clamp: true });
  },
  // IRT mosaic frieze: terra-cotta fillets, blue-green lines, diamonds on cream (1 tex = 0.8 m x band)
  friezeIRT() {
    return Tex.make('sub-frieze-irt', 512, 256, (g, w, h) => {
      const c = 8, cols = w / c, rows = h / c, mid = (rows - 1) / 2;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        let col = '#ece2c6';
        if (j < 3 || j >= rows - 3) col = '#a4502f';
        else if (j === 3 || j === rows - 4) col = '#2d6c6f';
        else {
          const u = i % 16, dd = Math.abs(u - 7.5) + Math.abs(j - mid);
          if (dd < 3.2) col = '#a4502f'; else if (dd < 5.6) col = '#2d6c6f'; else if (dd < 6.6) col = '#c9a77c';
          else if ((u === 0 || u === 15) && Math.abs(j - mid) < 1.2) col = '#2d6c6f';
        }
        g.fillStyle = col; g.fillRect(i * c, j * c, c, c);
      }
      this.tesserae(g, w, h, c, 0.06);
    });
  },
  // terra-cotta cornice, egg and dart (1 tex = 1 m x band)
  terra() {
    return Tex.make('sub-terra', 512, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#c97a52'); gr.addColorStop(0.15, '#a85a37'); gr.addColorStop(0.5, '#b4633f'); gr.addColorStop(1, '#7e3d22');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 64) {
        const eg = g.createRadialGradient(x + 26, 50, 4, x + 32, 64, 34); eg.addColorStop(0, '#e6a07a'); eg.addColorStop(0.7, '#b0603c'); eg.addColorStop(1, '#6f341d');
        g.fillStyle = eg; g.beginPath(); g.ellipse(x + 32, 66, 22, 34, 0, 0, TAU); g.fill();
        g.fillStyle = '#5e2c18'; g.beginPath(); g.moveTo(x, 34); g.lineTo(x + 4, 100); g.lineTo(x - 4, 100); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(255,220,190,0.35)'; g.fillRect(0, 6, w, 4); g.fillStyle = 'rgba(60,25,10,0.5)'; g.fillRect(0, h - 10, w, 6);
    });
  },
  // BMT "dual contracts" mosaic trim line: green borders, maroon lines, green diamonds on ochre
  trimBMT() {
    return Tex.make('sub-trim-bmt', 512, 128, (g, w, h) => {
      const c = 8, cols = w / c, rows = h / c, mid = (rows - 1) / 2;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        let col = '#d6b13c';
        if (j < 2 || j >= rows - 2) col = '#1f5135';
        else if (j === 2 || j === rows - 3) col = '#7a2a2a';
        else { const u = i % 8; if (Math.abs(u - 3.5) + Math.abs(j - mid) < 2.7) col = '#1f5135'; }
        g.fillStyle = col; g.fillRect(i * c, j * c, c, c);
      }
      this.tesserae(g, w, h, c, 0.06);
    });
  },
  tabletBMT() {
    return Tex.make('sub-tab-bmt', 1024, 256, (g, w, h) => {
      const c = 8;
      g.fillStyle = '#1f5135'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#d6b13c'; g.fillRect(c * 2, c * 2, w - c * 4, h - c * 4);
      g.fillStyle = '#7a2a2a'; g.fillRect(c * 4, c * 4, w - c * 8, h - c * 8);
      g.fillStyle = '#f1ead8'; g.font = 'bold 100px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ATLANTIC AVENUE', w / 2, h / 2 + 4, w - c * 16);
      this.tesserae(g, w, h, c);
    }, { aniso: 8 });
  },
  // wave-topped granite wainscot under white tile (1 tex = 1.2 m x 1.2 m from the floor up)
  wave() {
    return Tex.make('sub-wave', 512, 512, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, edge = h * 0.42 + Math.sin(x / w * TAU) * h * 0.07;
        if (y > edge) { const n = hash2(x, y) * 34 + hash2(x >> 3, y >> 3) * 22; d[i] = 104 + n; d[i + 1] = 102 + n; d[i + 2] = 101 + n * 1.05; }
        else { const gx = x % 64, gy = y % 32, grout = gx < 2 || gy < 2, v = grout ? 182 : 238 - hash2(x >> 6, y >> 5) * 8; d[i] = v; d[i + 1] = v; d[i + 2] = v - 4; }
        d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      g.strokeStyle = '#3a3d40'; g.lineWidth = 6; g.beginPath();
      for (let x = 0; x <= w; x += 4) { const yy = h * 0.42 + Math.sin(x / w * TAU) * h * 0.07; if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy); }
      g.stroke();
    });
  },
  wood() {
    return Tex.make('sub-wood', 256, 256, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, grain = Math.sin((y + Math.sin(x * 0.03 + y * 0.01) * 6) * 0.45) * 0.5 + 0.5, n = hash2(x, y) * 14;
        d[i] = 148 + grain * 40 + n; d[i + 1] = 96 + grain * 28 + n * 0.8; d[i + 2] = 52 + grain * 16 + n * 0.5; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  }
};

// geometry batches: one merged mesh per material, UVs in world metres / texture size
class SubBatch {
  constructor() { this.P = []; this.N = []; this.U = []; this.I = []; }
  quad(o, U, V, tm, uOff = 0, vOff = 0) {
    const lu = U.length(), lv = V.length();
    const uh = _sv1.copy(U).multiplyScalar(1 / lu), vh = _sv2.copy(V).multiplyScalar(1 / lv);
    const u0 = (o.x * uh.x + o.y * uh.y + o.z * uh.z) / tm + uOff, v0 = (o.x * vh.x + o.y * vh.y + o.z * vh.z) / tm + vOff;
    this.quadExact(o, U, V, u0, u0 + lu / tm, v0, v0 + lv / tm);
  }
  // u continues along the wall (world metres / tmU), v given explicitly (bands, tablets)
  quadV(o, U, V, tmU, v0, v1) {
    const lu = U.length(), uh = _sv1.copy(U).multiplyScalar(1 / lu), u0 = (o.x * uh.x + o.y * uh.y + o.z * uh.z) / tmU;
    this.quadExact(o, U, V, u0, u0 + lu / tmU, v0, v1);
  }
  quadExact(o, U, V, u0, u1, v0, v1) {
    const n = _sv3.crossVectors(U, V); const len = n.length(); if (len < 1e-9) return; n.multiplyScalar(1 / len);
    const b = this.P.length / 3;
    const pts = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const [a, c] of pts) {
      this.P.push(o.x + U.x * a + V.x * c, o.y + U.y * a + V.y * c, o.z + U.z * a + V.z * c);
      this.N.push(n.x, n.y, n.z);
      this.U.push(lerp(u0, u1, a), lerp(v0, v1, c));
    }
    this.I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setIndex(this.I); g.computeBoundingSphere();
    return g;
  }
}

// wall finishes: layers of [from, to (metres above the reference floor), material, band?]
const WALL_STYLES = {
  irt: [[-9, 0.22, 'tileDark'], [0.22, 2.5, 'tile'], [2.5, 2.9, 'frieze', true], [2.9, 3.15, 'terra', true], [3.15, 99, 'tile']],
  mezz: [[-9, 2.55, 'tileCream'], [2.55, 2.87, 'tileBand'], [2.87, 99, 'tileCream']],
  pass: [[-9, 0, 'tileDark'], [0, 1.2, 'wave', true], [1.2, 2.2, 'tile'], [2.2, 2.4, 'frieze', true], [2.4, 99, 'tile']],
  bmt: [[-9, 2.6, 'tile'], [2.6, 2.9, 'trimBMT', true], [2.9, 4.2, 'tile'], [4.2, 99, 'paint']],
  tunnel: [[-9, 99, 'tunnel']],
  plain: [[-9, 99, 'tile']]
};

class SubwayEnvironment {
  constructor(game) {
    this.game = game; this.kind = 'subway'; this.name = 'Atlantic Av–Barclays Ctr'; this.surface = 'hard';
    this.group = new THREE.Group(); this.group.name = 'subway';
    this.planes = [{ n: new V3(0, 1, 0), d: -60 }];
    this.regions = []; this.boxes = []; this.obstacles = []; this.spawnPoints = []; this.benchSeats = [];
    this.batches = new Map(); this.matDefs = {}; this.clocks = [];
    this.reverb = 'room'; this.time = 0; this.under = 1;
    this._near = [];
  }
  // ---------------------------------------------------------------- regions -----
  // r: { id, x0, x1, z0, z1, y (floor) | slope: {axis, a, b, ya, yb}, ceil | ceilRel, walk, pit, street }
  region(r) {
    r.id = this.regions.length; r.open = { x0: [], x1: [], z0: [], z1: [] };
    if (r.slope) { const s = r.slope; r.floor = (x, z) => { const t = clamp(((s.axis === 'x' ? x : z) - s.a) / (s.b - s.a), 0, 1); return lerp(s.ya, s.yb, t); }; }
    else { const y = r.y; r.floor = () => y; }
    if (r.ceilRel != null) { const cr = r.ceilRel; r.ceilAt = (x, z) => r.floor(x, z) + cr; } else { const c = r.ceil; r.ceilAt = () => c; }
    if (r.refY == null) r.refY = r.pit ? r.y + 1.4 : (r.slope ? null : r.y);
    this.regions.push(r); return r;
  }
  inR(r, x, z, e = 0) { return x >= r.x0 - e && x <= r.x1 + e && z >= r.z0 - e && z <= r.z1 + e; }
  linkRegions() {
    const R = this.regions;
    this.adj = R.map(() => []);
    for (const a of R) for (const b of R) {
      if (a === b) continue;
      const ox0 = Math.max(a.x0, b.x0), ox1 = Math.min(a.x1, b.x1), oz0 = Math.max(a.z0, b.z0), oz1 = Math.min(a.z1, b.z1);
      // floors must meet where the two touch: walkways within a step, platform edges over their tracks
      const mx = clamp((a.x0 + a.x1) / 2, Math.max(a.x0, b.x0), Math.min(a.x1, b.x1)), mz = clamp((a.z0 + a.z1) / 2, Math.max(a.z0, b.z0), Math.min(a.z1, b.z1));
      const df = Math.abs(a.floor(clamp(mx, a.x0, a.x1), clamp(mz, a.z0, a.z1)) - b.floor(clamp(mx, b.x0, b.x1), clamp(mz, b.z0, b.z1)));
      const connect = (a.walk && b.walk && df < 0.6) || ((a.pit || b.pit) && !(a.pit && b.pit) && df < 2.2);
      if (!connect) continue;
      const sa = a.sealed || {}, sb = b.sealed || {};
      const cut = (side, lo, hi) => { const rr = (a.restrict && a.restrict[side]) || null; if (!rr) return [[lo, hi]]; const out = []; for (const [p, q] of rr) { const l = Math.max(lo, p), h = Math.min(hi, q); if (h - l > 0.4) out.push([l, h]); } return out; };
      const lk = (side, lo, hi, mk) => { for (const [l, h] of cut(side, lo, hi)) { a.open[side].push([l, h]); if (a.walk && b.walk) { const e = mk(l, h); e.lanes = a.lanes && a.lanes[side]; this.adj[a.id].push(e); } } };
      if (Math.abs(a.x1 - b.x0) < 1e-3 && oz1 - oz0 > 0.4 && !sa.x1 && !sb.x0) lk('x1', oz0, oz1, (l, h) => ({ to: b.id, p: new V3(a.x1, 0, (l + h) / 2), axis: 'x', dir: 1, lo: l, hi: h }));
      if (Math.abs(a.x0 - b.x1) < 1e-3 && oz1 - oz0 > 0.4 && !sa.x0 && !sb.x1) lk('x0', oz0, oz1, (l, h) => ({ to: b.id, p: new V3(a.x0, 0, (l + h) / 2), axis: 'x', dir: -1, lo: l, hi: h }));
      if (Math.abs(a.z1 - b.z0) < 1e-3 && ox1 - ox0 > 0.4 && !sa.z1 && !sb.z0) lk('z1', ox0, ox1, (l, h) => ({ to: b.id, p: new V3((l + h) / 2, 0, a.z1), axis: 'z', dir: 1, lo: l, hi: h }));
      if (Math.abs(a.z0 - b.z1) < 1e-3 && ox1 - ox0 > 0.4 && !sa.z0 && !sb.z1) lk('z0', ox0, ox1, (l, h) => ({ to: b.id, p: new V3((l + h) / 2, 0, a.z0), axis: 'z', dir: -1, lo: l, hi: h }));
    }
    // next-hop routing table (BFS from every region)
    const n = R.length;
    this.hop = R.map(() => new Int16Array(n).fill(-1));
    for (const s of R) {
      if (!s.walk) continue;
      const prev = new Int16Array(n).fill(-2); prev[s.id] = s.id;
      const q = [s.id];
      while (q.length) { const u = q.shift(); for (const e of this.adj[u]) if (prev[e.to] === -2) { prev[e.to] = u; q.push(e.to); } }
      for (let t = 0; t < n; t++) {
        if (prev[t] === -2 || t === s.id) continue;
        let c = t; while (prev[c] !== s.id) c = prev[c];
        this.hop[s.id][t] = c;
      }
    }
    // spatial hash: 4 m cells -> regions (big tunnel regions are only hashed once per cell row)
    this.rgrid = new Map();
    for (const r of R) for (let ix = Math.floor(r.x0 / 4); ix <= Math.floor(r.x1 / 4); ix++) for (let iz = Math.floor(r.z0 / 4); iz <= Math.floor(r.z1 / 4); iz++) {
      const k = ix * 4099 + iz; let l = this.rgrid.get(k); if (!l) this.rgrid.set(k, l = []); l.push(r);
    }
  }
  regionsAt(x, z) { return this.rgrid.get(Math.floor(x / 4) * 4099 + Math.floor(z / 4)) || []; }
  // the region under x,z. With a height y: the nearest floor at or below it (stacked levels);
  // without: walkable first, then the highest floor
  regionAt(x, z, walkOnly, y) {
    let best = null, bs = 1e9;
    for (const r of this.regionsAt(x, z)) {
      if (!this.inR(r, x, z) || (walkOnly && !r.walk)) continue;
      const f = r.floor(x, z);
      let s;
      if (y == null) s = (r.walk ? 0 : 1000) - f;
      else { const d = y - f; if (d < -0.6 || d > 2.4) continue; s = d < 0 ? -d * 2 : d; if (!r.walk) s += 0.05; }
      if (s < bs) { bs = s; best = r; }
    }
    return best;
  }
  nearestRegion(x, z, walkOnly, y) {
    let best = null, bd = 1e18;
    for (const r of this.regions) {
      if (walkOnly && !r.walk) continue;
      const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
      let d = dx * dx + dz * dz;
      if (y != null) { const dy = (y - r.floor(clamp(x, r.x0, r.x1), clamp(z, r.z0, r.z1))) * 2; d += dy * dy; }
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  // the open volume (between floor and ceiling) holding a point
  volumeAt(x, z, y) {
    let best = null, bd = 1e9;
    for (const r of this.regionsAt(x, z)) {
      if (!this.inR(r, x, z)) continue;
      const f = r.floor(x, z);
      if (y > f - 0.6 && y < r.ceilAt(x, z) - 0.15 && y - f < bd) { bd = y - f; best = r; }
    }
    return best;
  }
  // physics heightfield: a floor only counts from above (bodies below it are inside a slab)
  floorAt(x, z, y) {
    if (y == null) { const r = this.regionAt(x, z) || this.nearestRegion(x, z); return r.floor(clamp(x, r.x0, r.x1), clamp(z, r.z0, r.z1)); }
    let best = -1e9;
    for (const r of this.regionsAt(x, z)) {
      if (!this.inR(r, x, z)) continue;
      const f = r.floor(x, z);
      if (y > f - 0.45 && f > best) best = f;
    }
    return best;
  }
  groundHeight(x, z, y) {
    if (y == null) return this.floorAt(x, z);
    if (this.trains) { const c = this.carAt(x, z, y); if (c) return c.floorY; }
    const r = this.regionAt(x, z, false, y) || this.nearestRegion(x, z, false, y);
    return r.floor(clamp(x, r.x0, r.x1), clamp(z, r.z0, r.z1));
  }
  groundNormal(x, z, out) {
    const r = this.regionAt(x, z);
    if (r && r.slope) { const s = r.slope, k = (s.yb - s.ya) / (s.b - s.a); return s.axis === 'x' ? out.set(-k, 1, 0).normalize() : out.set(0, 1, -k).normalize(); }
    return out.set(0, 1, 0);
  }
  // NPC roots (p.y = the floor they stand on): stay on walkable floor, slide along walls, pass through
  // portals, keep out of fixtures
  clampToBounds(p, m = 0) {
    const y = p.y;
    let r = this.regionAt(p.x, p.z, true, y);
    if (!r) { // off the walkable floor (e.g. up from the tracks): onto the nearest walkway, at its height
      r = this.nearestRegion(p.x, p.z, true, y);
      p.x = clamp(p.x, r.x0 + Math.min(m, (r.x1 - r.x0) / 2), r.x1 - Math.min(m, (r.x1 - r.x0) / 2)); p.z = clamp(p.z, r.z0 + Math.min(m, (r.z1 - r.z0) / 2), r.z1 - Math.min(m, (r.z1 - r.z0) / 2));
      p.y = r.floor(p.x, p.z);
    }
    const inOpen = (list, v) => { for (const [a, b] of list) if (v > a + m && v < b - m) return true; return false; };
    const mx = Math.min(m, (r.x1 - r.x0) / 2), mz = Math.min(m, (r.z1 - r.z0) / 2);
    if (p.x < r.x0 + mx && !inOpen(r.open.x0, p.z)) p.x = r.x0 + mx;
    if (p.x > r.x1 - mx && !inOpen(r.open.x1, p.z)) p.x = r.x1 - mx;
    if (p.z < r.z0 + mz && !inOpen(r.open.z0, p.x)) p.z = r.z0 + mz;
    if (p.z > r.z1 - mz && !inOpen(r.open.z1, p.x)) p.z = r.z1 - mz;
    if (m > 0) for (const o of this.obstaclesNear(p.x, p.z, r.floor(clamp(p.x, r.x0, r.x1), clamp(p.z, r.z0, r.z1)))) {
      const ex = Math.max(o.x0 - m - p.x, 0, p.x - (o.x1 + m)), ez = Math.max(o.z0 - m - p.z, 0, p.z - (o.z1 + m));
      if (ex > 0 || ez > 0) continue;
      const dl = p.x - (o.x0 - m), dr = (o.x1 + m) - p.x, dn = p.z - (o.z0 - m), df = (o.z1 + m) - p.z, mn = Math.min(dl, dr, dn, df);
      if (mn === dl) p.x = o.x0 - m; else if (mn === dr) p.x = o.x1 + m; else if (mn === dn) p.z = o.z0 - m; else p.z = o.z1 + m;
    }
    return p;
  }
  // fixtures near x,z on the level of height y
  obstaclesNear(x, z, y) {
    const l = this.ogrid.get(Math.floor(x / 4) * 4099 + Math.floor(z / 4)); const out = this._near; out.length = 0;
    if (!l) return out;
    for (const o of l) if (y == null || (y > o.y0 - 0.6 && y < o.y1)) out.push(o);
    return out;
  }
  // next point to steer to on the way to dest (through the portals between regions)
  navGoal(p, dest) {
    const a = this.regionAt(p.x, p.z, true, p.y), b = this.regionAt(dest.x, dest.z, true, dest.y) || this.nearestRegion(dest.x, dest.z, true, dest.y);
    if (!a || !b || a === b) return dest;
    const nx = this.hop[a.id][b.id]; if (nx < 0) return dest;
    let e = null, ed = 1e9;
    for (const q of this.adj[a.id]) { if (q.to !== nx) continue; const d = Math.hypot(q.p.x - p.x, q.p.z - p.z) + Math.hypot(q.p.x - dest.x, q.p.z - dest.z); if (d < ed) { ed = d; e = q; } }
    if (!e) return dest;
    const g = this._goal || (this._goal = new V3());
    g.copy(e.p); g.y = p.y;
    // aim through the portal: a little past its edge, at the point closest to the walker
    const lane = (v) => { if (!e.lanes) return v; let best = e.lanes[0]; for (const L of e.lanes) if (Math.abs(L - v) < Math.abs(best - v)) best = L; return best; };
    if (e.axis === 'x') { g.x += e.dir * 0.9; g.z = lane(clamp(p.z, e.lo + 0.7, e.hi - 0.7)); }
    else { g.z += e.dir * 0.9; g.x = lane(clamp(p.x, e.lo + 0.7, e.hi - 0.7)); }
    // in a lane, approach straight on so the walker lines up with the gap before stepping through
    const lat = e.axis === 'x' ? Math.abs(p.z - g.z) : Math.abs(p.x - g.x), dist = e.axis === 'x' ? Math.abs(p.x - e.p.x) : Math.abs(p.z - e.p.z);
    if (e.lanes && lat > 0.15 && dist < 1.6) { if (e.axis === 'x') g.x = e.p.x - e.dir * 1.2; else g.z = e.p.z - e.dir * 1.2; }
    return g;
  }
  pickWander(npc, b) {
    const P = npc.root.pos, here = this.regionAt(P.x, P.z, true, P.y) || this.nearestRegion(P.x, P.z, true, P.y);
    let r = here;
    if (Math.random() < 0.3 && this.adj[here.id].length) { const nb = this.regions[this.adj[here.id][Math.floor(Math.random() * this.adj[here.id].length)].to]; if (!nb.noWander) r = nb; }
    if (r.noWander) r = this.regions[this.adj[r.id].length ? this.adj[r.id][Math.floor(Math.random() * this.adj[r.id].length)].to : r.id];
    for (let i = 0; i < 8; i++) {
      const x = lerp(r.x0 + 0.8, r.x1 - 0.8, Math.random()), z = lerp(r.z0 + 0.8, r.z1 - 0.8, Math.random());
      if (Math.hypot(x - P.x, z - P.z) > 16 && r === here) continue;
      b.dest.set(x, r.floor(x, z), z); this.clampToBounds(b.dest, 0.6); return;
    }
    const x = clamp(P.x + (Math.random() - 0.5) * 12, r.x0 + 0.8, r.x1 - 0.8), z = clamp(P.z + (Math.random() - 0.5) * 12, r.z0 + 0.8, r.z1 - 0.8);
    b.dest.set(x, r.floor(x, z), z); this.clampToBounds(b.dest, 0.6);
  }
  // free-fly camera: inside the open volumes, under the ceilings, out of the walls and slabs
  constrainCamera(p, prev) {
    const ok = (x, z, y) => !!this.volumeAt(x, z, y);
    if (!ok(p.x, p.z, p.y)) {
      if (ok(p.x, prev.z, p.y)) p.z = prev.z;
      else if (ok(prev.x, p.z, p.y)) p.x = prev.x;
      else if (ok(prev.x, prev.z, p.y)) { p.x = prev.x; p.z = prev.z; }
      else { p.x = prev.x; p.z = prev.z; if (!ok(p.x, p.z, p.y)) p.y = prev.y; }
    }
    const r = this.volumeAt(p.x, p.z, p.y) || this.regionAt(p.x, p.z, false, p.y) || this.nearestRegion(p.x, p.z, false, p.y);
    const f = r.floor(clamp(p.x, r.x0, r.x1), clamp(p.z, r.z0, r.z1)), c = r.ceilAt(p.x, p.z);
    p.y = clamp(p.y, f + 0.25, Math.max(f + 0.3, c - 0.2));
  }
  // ---------------------------------------------------------------- building helpers ----
  mat(key) {
    let b = this.batches.get(key); if (!b) { b = new SubBatch(); this.batches.set(key, b); } return b;
  }
  def(key, tm, mat) { this.matDefs[key] = { tm, mat }; return mat; }
  // axis-aligned box: faces into material batches (mk = key or {px,nx,py,ny,pz,nz,all}), optional collider
  box(mk, x0, y0, z0, x1, y1, z1, o = {}) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, key = (f) => typeof mk === 'string' ? mk : (mk[f] !== undefined ? mk[f] : mk.all);
    const tm = (k) => (this.matDefs[k] || { tm: 1 }).tm;
    const skip = o.skip || '';
    const F = (f, oo, U, V) => { if (skip.indexOf(f) >= 0) return; const k = key(f); if (!k) return; this.mat(k).quad(oo, U, V, tm(k)); };
    F('px', new V3(x1, y0, z1), new V3(0, 0, -dz), new V3(0, dy, 0));
    F('nx', new V3(x0, y0, z0), new V3(0, 0, dz), new V3(0, dy, 0));
    F('pz', new V3(x0, y0, z1), new V3(dx, 0, 0), new V3(0, dy, 0));
    F('nz', new V3(x1, y0, z0), new V3(-dx, 0, 0), new V3(0, dy, 0));
    F('py', new V3(x0, y1, z1), new V3(dx, 0, 0), new V3(0, 0, -dz));
    F('ny', new V3(x0, y0, z0), new V3(dx, 0, 0), new V3(0, 0, dz));
    if (o.collide) this.collider(x0, y0, z0, x1, y1, z1);
    if (o.obstacle) this.obstacles.push({ x0, x1, z0, z1, y0, y1 });
  }
  collider(x0, y0, z0, x1, y1, z1) { this.boxes.push({ min: new V3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)), max: new V3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)) }); }
  // vertical rectangle on the plane axis=fixed, spanning [a,c] along the other axis, facing nSign
  // (u runs along the wall in world metres; v is 0..1 over the rectangle for bands, else world height)
  vrect(key, axis, fixed, a, c, y0, y1, nSign, band, uv) {
    if (c - a < 1e-3 || y1 - y0 < 1e-3) return;
    const L = c - a, V = new V3(0, y1 - y0, 0);
    let o, U;
    if (axis === 'x') { if (nSign > 0) { o = new V3(fixed, y0, c); U = new V3(0, 0, -L); } else { o = new V3(fixed, y0, a); U = new V3(0, 0, L); } }
    else { if (nSign > 0) { o = new V3(a, y0, fixed); U = new V3(L, 0, 0); } else { o = new V3(c, y0, fixed); U = new V3(-L, 0, 0); } }
    const b = this.mat(key), tm = (this.matDefs[key] || { tm: 1 }).tm;
    if (uv) b.quadExact(o, U, V, uv[0], uv[1], uv[2], uv[3]);
    else if (band) b.quadV(o, U, V, tm, 0, 1);
    else b.quadV(o, U, V, tm, y0 / tm, y1 / tm);
  }
  // a flat textured panel (sign, tablet) with its own batch: centre, size, facing ('px','nx','pz','nz')
  sign(key, tex, cx, cy, cz, w, h, face, o = {}) {
    if (!this.matDefs[key]) this.def(key, 1, new THREE.MeshStandardMaterial({ map: tex, roughness: o.rough != null ? o.rough : 0.45, metalness: 0, emissive: o.glow ? 0xffffff : 0x000000, emissiveMap: o.glow ? tex : null, emissiveIntensity: o.glow || 0, alphaTest: o.alpha ? 0.5 : 0, side: o.double ? THREE.DoubleSide : THREE.FrontSide }));
    const axis = face[1], n = face[0] === 'p' ? 1 : -1;
    if (axis === 'x') this.vrect(key, 'x', cx, cz - w / 2, cz + w / 2, cy - h / 2, cy + h / 2, n, false, [0, 1, 0, 1]);
    else this.vrect(key, 'z', cz, cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, n, false, [0, 1, 0, 1]);
  }
  // a hanging sign: two faces back to back, on rods from the ceiling
  hangSign(key, tex, cx, cy, cz, w, h, axis, ceilY, keyB, texB) {
    if (axis === 'z') { this.sign(key, tex, cx, cy, cz + 0.031, w, h, 'pz'); this.sign(keyB || key, texB || tex, cx, cy, cz - 0.031, w, h, 'nz'); this.box('signBox', cx - w / 2, cy - h / 2, cz - 0.03, cx + w / 2, cy + h / 2, cz + 0.03, { skip: 'pznz' }); }
    else { this.sign(key, tex, cx + 0.031, cy, cz, w, h, 'px'); this.sign(keyB || key, texB || tex, cx - 0.031, cy, cz, w, h, 'nx'); this.box('signBox', cx - 0.03, cy - h / 2, cz - w / 2, cx + 0.03, cy + h / 2, cz + w / 2, { skip: 'pxnx' }); }
    if (ceilY != null) for (const s of [-1, 1]) {
      const rx = axis === 'z' ? cx + s * w * 0.35 : cx, rz = axis === 'z' ? cz : cz + s * w * 0.35;
      this.box('steel', rx - 0.012, cy + h / 2, rz - 0.012, rx + 0.012, ceilY, rz + 0.012);
    }
  }
  // --------------------------------------------------------------------------- build -----
  build() {
    const g = this.game, Y = { street: 0, mezz: -6.1, irt: -6.1, irtPit: -7.5, under: -10.5, bmt: -18.0, bmtPit: -19.4 };
    this.Y = Y;
    // ---- materials (tm = texture size in metres)
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0 }, o));
    const def = (key, tm, mat) => this.def(key, tm, mat);
    def('tile', 1, std({ map: SubTex.tile(), roughness: 0.28, envMapIntensity: 0.6 }));
    def('tileDark', 1, std({ map: SubTex.tile('dark', [96, 84, 70], 10), roughness: 0.3 }));
    def('tileBand', 1, std({ map: SubTex.tile('band', [52, 120, 116], 10), roughness: 0.3 }));
    def('tileCream', 1, std({ map: SubTex.tile('cream', [228, 218, 196], 10), roughness: 0.3 }));
    def('frieze', 0.8, std({ map: SubTex.friezeIRT(), roughness: 0.32 }));
    def('terra', 1, std({ map: SubTex.terra(), roughness: 0.75 }));
    def('trimBMT', 1, std({ map: SubTex.trimBMT(), roughness: 0.32 }));
    def('wave', 1.2, std({ map: SubTex.wave(), roughness: 0.3, envMapIntensity: 0.7 }));
    def('paint', 2, std({ map: SubTex.concrete('paint', 200), color: 0xe9e6dc, roughness: 0.85 }));
    def('tunnel', 3, std({ map: SubTex.concrete('tun', 78), roughness: 0.95 }));
    def('terrazzo', 2, std({ map: SubTex.terrazzo(), roughness: 0.32, envMapIntensity: 0.7 }));
    def('concrete', 2, std({ map: SubTex.concrete('c', 160), roughness: 0.9 }));
    def('ceiling', 2, std({ map: SubTex.concrete('ceil', 196), color: 0xd8dadb, roughness: 0.95 }));
    def('green', 1, std({ color: 0x2f6b4c, roughness: 0.45, metalness: 0.25 }));
    def('colIRT', 1, std({ color: 0x1d2a23, roughness: 0.42, metalness: 0.35 }));
    def('colBMT', 1, std({ color: 0x27354a, roughness: 0.42, metalness: 0.35 }));
    def('glassBlock', 1, std({ map: SubTex.glassBlock(), roughness: 0.2, emissive: 0xffffff, emissiveMap: SubTex.glassBlock(), emissiveIntensity: 0.32 }));
    def('tactile', 0.6, std({ map: SubTex.tactile(), roughness: 0.55 }));
    def('edge', 1, std({ color: 0xd9d6cf, roughness: 0.5 }));
    def('ballast', 2, std({ map: SubTex.ballast(), roughness: 0.95 }));
    def('rail', 1, std({ color: 0x8c8f93, roughness: 0.3, metalness: 0.7 }));
    def('tie', 1, std({ color: 0x2b2420, roughness: 0.9 }));
    def('board', 1, std({ color: 0x6b5a3a, roughness: 0.85 }));
    def('dark', 1, std({ color: 0x0d0e10, roughness: 0.95 }));
    def('steel', 1, std({ color: 0xb8bec4, roughness: 0.3, metalness: 0.65 }));
    def('blackSteel', 1, std({ color: 0x1a1b1d, roughness: 0.4, metalness: 0.5 }));
    def('signBox', 1, std({ color: 0x141517, roughness: 0.5, metalness: 0.3 }));
    def('wood', 0.5, std({ map: SubTex.wood(), roughness: 0.55 }));
    def('machine', 1, std({ color: 0x29323d, roughness: 0.4, metalness: 0.3 }));
    def('booth', 1, std({ color: 0x3d4a3f, roughness: 0.5, metalness: 0.2 }));
    def('light', 1, new THREE.MeshBasicMaterial({ color: 0xf4f8ff }));
    def('lampWarm', 1, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    def('asphalt', 8, std({ map: SubTex.asphalt(), roughness: 0.92 }));
    def('pavers', 2, std({ map: SubTex.pavers(), roughness: 0.85 }));
    def('curb', 1, std({ color: 0x9a978f, roughness: 0.8 }));
    def('paintW', 1, std({ color: 0xf2f0e8, roughness: 0.7 }));
    def('paintY', 1, std({ color: 0xe0b52a, roughness: 0.7 }));
    def('brickA', 8, std({ map: SubTex.facade('a', '#8a4632', '#d8d2c4'), roughness: 0.9 }));
    def('brickB', 8, std({ map: SubTex.facade('b', '#6e5a4a', '#cfc8b8'), roughness: 0.9 }));
    def('brickC', 8, std({ map: SubTex.facade('c', '#a05a3c', '#e6e0d2'), roughness: 0.9 }));
    def('rust', 8, std({ map: SubTex.rust(), roughness: 0.85, metalness: 0.15 }));
    def('glass', 1, std({ color: 0x8fb4c8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false }));
    def('glassDark', 2, std({ color: 0x2a3640, roughness: 0.12, metalness: 0.4, envMapIntensity: 1.2 }));
    def('roof', 2, std({ color: 0x4d7a3a, roughness: 0.95 }));
    def('pole', 1, std({ color: 0x22382c, roughness: 0.5, metalness: 0.4 }));
    def('screen', 1, new THREE.MeshBasicMaterial({ color: 0x5aa8ff }));
    def('rubber', 1, std({ color: 0x111111, roughness: 0.6 }));
    def('tabletIRT', 1, std({ map: SubTex.tabletIRT(), roughness: 0.35 }));
    def('tabletBMT', 1, std({ map: SubTex.tabletBMT(), roughness: 0.35 }));
    def('medallion', 1, std({ map: SubTex.medallion(), roughness: 0.7, alphaTest: 0.5 }));
    this.matDefs.medallion.mat.userData.cast = false;

    // ---- regions --------------------------------------------------------------------------
    const R = (o) => this.region(o);
    const S = { y: 0, ceil: 60, walk: true, street: true };
    // street
    this.rAtl = R(Object.assign({ name: 'Atlantic Av', x0: -10, x1: 110, z0: 16, z1: 40 }, S));
    this.rFlat = R(Object.assign({ name: 'Flatbush Av', x0: 24, x1: 40, z0: -50, z1: 16 }, S));
    this.rPlazaW = R(Object.assign({ name: 'Arena Plaza', x0: 40, x1: 54, z0: -10, z1: 16 }, S));
    this.rPlazaN = R(Object.assign({ name: 'Arena Plaza', x0: 54, x1: 60, z0: 4, z1: 16 }, S));
    this.rPlazaE = R(Object.assign({ name: 'Arena Plaza', x0: 60, x1: 74, z0: -10, z1: 16 }, S));
    // entrance stairs (with an escalator lane) down to fare control
    this.rStairE = R({ name: 'Entrance Stairs', x0: 54, x1: 60, z0: -12, z1: 4, slope: { axis: 'z', a: -12, b: 4, ya: Y.mezz, yb: 0 }, ceilRel: 3.6, walk: true, sealed: { x0: 1, x1: 1 }, noWalls: true, noWander: true });
    { const r = this.rStairE; r.ceilAt = (x, z) => z > -10 ? 3.3 : r.floor(x, z) + 3.6; r.ceilZ = [-12, -10]; } // open to the pavilion roof above the plaza
    // fare control: the turnstile line splits the mezzanine; the paid side opens onto the Manhattan-bound 2 3 platform
    const lanes = []; for (let k = 0; k < 24; k++) lanes.push(44.5 + k * 1.25 + 0.625);
    const openN = this.openN = [[46, 54], [62, 70]];
    this.rMezzFree = R({ name: 'Fare Control', x0: 40, x1: 84, z0: -24, z1: -12, y: Y.mezz, ceil: Y.mezz + 3.6, walk: true, restrict: { z0: [[44.4, 75.6]] }, lanes: { z0: lanes }, noWallSide: { z0: 1 }, style: 'mezz' });
    this.rMezz = R({ name: 'Fare Control (paid)', x0: 40, x1: 84, z0: -40, z1: -24, y: Y.mezz, ceil: Y.mezz + 3.6, walk: true, restrict: { z1: [[44.4, 75.6]], z0: openN }, lanes: { z1: lanes }, noWallSide: { z1: 1, z0: 1 }, style: 'mezz' });
    // IRT Eastern Parkway platforms (north to south): side - local - express - island - express - local - side
    const I = this.IRT = { x0: -80, x1: 76, stop: -2, ceil: Y.irt + 3.8, tracks: { nl: -46.45, ne: -50.25, se: -61.15, sl: -64.95 } };
    this.rIrtN = R({ name: '2 3 Manhattan-bound Platform', x0: I.x0, x1: I.x1, z0: -45, z1: -40, y: Y.irt, ceil: I.ceil, walk: true, restrict: { z1: openN }, style: 'irt', wallOuter: { z1: 'mezz' } });
    this.rIrtPitA = R({ name: 'IRT Tracks 1-2', x0: -450, x1: 450, z0: -51.7, z1: -45, y: Y.irtPit, ceil: I.ceil, pit: true, style: 'tunnel' });
    this.rIrtIsl = R({ name: '4 5 Express Platform', x0: I.x0, x1: I.x1, z0: -59.7, z1: -51.7, y: Y.irt, ceil: I.ceil, walk: true, style: 'irt' });
    this.rIrtPitB = R({ name: 'IRT Tracks 3-4', x0: -450, x1: 450, z0: -66.4, z1: -59.7, y: Y.irtPit, ceil: I.ceil, pit: true, style: 'tunnel' });
    this.rIrtS = R({ name: '2 3 Brooklyn-bound Platform', x0: I.x0, x1: I.x1, z0: -71.4, z1: -66.4, y: Y.irt, ceil: I.ceil, walk: true, style: 'irt' });
    // stairs from the platform ends down to the underpass below the tracks
    const st = (name, z0, z1) => R({ name, x0: 76, x1: 84, z0, z1, slope: { axis: 'x', a: 76, b: 84, ya: Y.irt, yb: Y.under }, ceilRel: 3.0, walk: true, noWander: true, style: 'plain' });
    this.rStN = st('Stairs to Underpass', -44.6, -41.4); this.rStI = st('Stairs to Underpass', -57.3, -54.1); this.rStS = st('Stairs to Underpass', -70.5, -67.3);
    this.rUnder = R({ name: 'Underpass', x0: 84, x1: 88, z0: -70.5, z1: -30, y: Y.under, ceil: Y.under + 2.6, walk: true, style: 'pass' });
    this.rPassB = R({ name: 'Passage to B Q', x0: 88, x1: 151, z0: -34, z1: -30, y: Y.under, ceil: Y.under + 2.6, walk: true, style: 'pass' });
    // BMT Brighton: a deep hall with one island; a bridge crosses the double-height end, a stair drops to the island
    const M = this.BMT = { x0: 156, x1: 164, z0: -36, z1: 152, stop: 58, well: -12, ceilHall: Y.bmt + 4.4, ceilWell: -8.0, ceilTunnel: -14.5, tracks: { w: 154.38, e: 165.62 } };
    const hallCeil = (z) => z < M.z0 || z > M.z1 ? M.ceilTunnel : (z < M.well ? M.ceilWell : M.ceilHall);
    this.rBridge = R({ name: 'Brighton Mezzanine Bridge', x0: 151, x1: 169, z0: -34, z1: -30, y: Y.under, ceil: M.ceilWell, walk: true, noWallSide: { z0: 1, z1: 1, x1: 1 }, style: 'bmt' });
    this.rStB = R({ name: 'Stairs to B Q', x0: 158.5, x1: 161.5, z0: -30, z1: -15, slope: { axis: 'z', a: -30, b: -15, ya: Y.under, yb: Y.bmt }, ceil: M.ceilWell, walk: true, noWalls: true, noWander: true });
    this.rStB.ceilAt = () => M.ceilWell;
    const isl = (name, x0, x1, z0, z1, o) => { const r = R(Object.assign({ name, x0, x1, z0, z1, y: Y.bmt, ceil: M.ceilHall, walk: true, style: 'bmt' }, o || {})); r.ceilAt = (x, z) => hallCeil(z); return r; };
    this.rBmtW = isl('B Q Platform', 156, 158.5, M.z0, M.z1, { noWallSide: { x1: 1 } });
    this.rBmtE = isl('B Q Platform', 161.5, 164, M.z0, M.z1, { noWallSide: { x0: 1 } });
    this.rBmtC0 = isl('B Q Platform', 158.5, 161.5, M.z0, -30, { holes: [{ side: 'z1', lo: 158.5, hi: 161.5, y0: Y.under - 0.3, y1: 99 }] });
    this.rBmtC1 = isl('B Q Platform', 158.5, 161.5, -15, M.z1);
    this.rBmtPitW = R({ name: 'Brighton Tracks', x0: 151, x1: 156, z0: -440, z1: 560, y: Y.bmtPit, ceil: M.ceilWell, pit: true, style: 'tunnel', styleSplit: [[M.z0, M.z1, 'bmt']], holes: [{ side: 'x0', lo: -34, hi: -30, y0: Y.under - 0.05, y1: Y.under + 2.6 }] });
    this.rBmtPitE = R({ name: 'Brighton Tracks', x0: 164, x1: 169, z0: -440, z1: 560, y: Y.bmtPit, ceil: M.ceilWell, pit: true, style: 'tunnel', styleSplit: [[M.z0, M.z1, 'bmt']] });
    this.rBmtPitW.ceilAt = (x, z) => hallCeil(z); this.rBmtPitE.ceilAt = (x, z) => hallCeil(z);
    this.rBmtPitW.refY = this.rBmtPitE.refY = Y.bmt;
    for (const r of [this.rMezzFree, this.rMezz, this.rIrtN, this.rIrtPitA, this.rIrtIsl, this.rIrtPitB, this.rIrtS, this.rStN, this.rStI, this.rStS]) r.lvl = 'irt';
    for (const r of [this.rBridge, this.rStB, this.rBmtW, this.rBmtE, this.rBmtC0, this.rBmtC1, this.rBmtPitW, this.rBmtPitE]) r.lvl = 'bmt';
    this.linkRegions();
    this.bounds = { minX: -450, maxX: 450, minZ: -440, maxZ: 560 };

    this.buildStreet(Y);
    this.buildStation(Y);
    this.buildWalls();
    if (this.buildTrains) this.buildTrains(Y);

    // ---- merge batches into meshes
    for (const [key, b] of this.batches) {
      const d = this.matDefs[key]; if (!d || !b.P.length) continue;
      const m = new THREE.Mesh(b.geometry(), d.mat);
      m.receiveShadow = true; m.castShadow = !!(d.mat.userData && d.mat.userData.cast); m.name = 'sub-' + key;
      this.group.add(m);
    }
    // ---- obstacle grid
    this.ogrid = new Map();
    for (const o of this.obstacles) for (let ix = Math.floor((o.x0 - 1) / 4); ix <= Math.floor((o.x1 + 1) / 4); ix++) for (let iz = Math.floor((o.z0 - 1) / 4); iz <= Math.floor((o.z1 + 1) / 4); iz++) {
      const k = ix * 4099 + iz; let l = this.ogrid.get(k); if (!l) this.ogrid.set(k, l = []); l.push(o);
    }
    // ---- lights: daylight on the street, cool fluorescent below; blended by where the camera is
    this.hemi = new THREE.HemisphereLight(0xdfe8f0, 0x5d5a55, 0.8); this.group.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffffff, 1.6); this.key.castShadow = true;
    const sq = Settings.data.graphics.shadowQuality, size = sq === 'ultra' ? 4096 : 2048;
    this.key.shadow.mapSize.set(size, size);
    const sc = this.key.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
    this.key.shadow.bias = -0.0005; this.key.shadow.normalBias = 0.03;
    this.group.add(this.key); this.group.add(this.key.target);
    this.fill = new THREE.DirectionalLight(0xcfe0ff, 0.25); this.fill.position.set(-30, 40, 20); this.group.add(this.fill);
    this.buildEnvMap();
    this.skyCol = new THREE.Color(0x9fc4e6); this.darkCol = new THREE.Color(0x07080a);
    g.scene.background = new THREE.Color().copy(this.darkCol);
    g.scene.fog = new THREE.Fog(0x07080a, 40, 160);
    g.renderer.toneMappingExposure = 1.0;
    // ---- spawn points & camera start (people spread over the platforms, fare control and street)
    const sp = (x, y, z) => this.spawnPoints.push(new V3(x, y, z));
    for (const x of [-56, -30, -6, 18, 40, 60]) sp(x, Y.irt, -42.6);
    for (const x of [-44, -12, 22, 52]) sp(x, Y.irt, -53.6);
    for (const x of [-40, 0, 36]) sp(x, Y.irt, -68.8);
    sp(60, Y.mezz, -30); sp(50, Y.mezz, -18); sp(70, Y.mezz, -34);
    sp(157.2, Y.bmt, 10); sp(162.8, Y.bmt, 40); sp(160, Y.bmt, 80); sp(86, Y.under, -50);
    sp(50, 0, 6); sp(66, 0, 10);
    this.cameraStart = { pos: new V3(24, Y.irt + 1.7, -41.0), yaw: 0.42, pitch: -0.06 };
    this.updateLighting(1);
  }
  // ------------------------------------------------------------------------- street ------
  buildStreet(Y) {
    const b = (k, x0, y0, z0, x1, y1, z1, o) => this.box(k, x0, y0, z0, x1, y1, z1, o);
    // roads (asphalt) and sidewalks (raised 15 cm, but walkable as one floor)
    b('asphalt', -10, -0.3, 20, 110, 0, 36, { skip: 'nxpxnzpz' });                      // Atlantic Av
    b('asphalt', 27, -0.3, -50, 37, 0, 20, { skip: 'nxpxnzpz' });                       // Flatbush Av
    b('pavers', -10, -0.3, 16, 27, 0.02, 20, { skip: 'nxpxnz' }); b('pavers', 37, -0.3, 16, 110, 0.02, 20, { skip: 'pxnz' });
    b('pavers', -10, -0.3, 36, 110, 0.02, 40, { skip: 'nxpxpz' });
    b('pavers', 24, -0.3, -50, 27, 0.02, 16, { skip: 'nxnz' }); b('pavers', 37, -0.3, -50, 40, 0.02, 16, { skip: 'pxnz' });
    b('pavers', 40, -0.3, -10, 54, 0.02, 16, { skip: 'nxnz' }); b('pavers', 54, -0.3, 4, 60, 0.02, 16, { skip: '' }); b('pavers', 60, -0.3, -10, 74, 0.02, 16, { skip: 'nz' });
    for (const [x0, z0, x1, z1] of [[-10, 19.85, 27, 20.15], [37, 19.85, 110, 20.15], [-10, 35.85, 110, 36.15], [26.85, -50, 27.15, 20], [36.85, -50, 37.15, 20]]) b('curb', x0, -0.05, z0, x1, 0.06, z1, { skip: 'ny' });
    const mk = (k, x0, z0, x1, z1) => b(k, x0, 0.004, z0, x1, 0.008, z1, { skip: 'nxpxnzpzny' });
    mk('paintY', -10, 27.85, 27, 27.97); mk('paintY', -10, 28.03, 27, 28.15); mk('paintY', 37, 27.85, 110, 27.97); mk('paintY', 37, 28.03, 110, 28.15);
    mk('paintY', 31.85, -50, 31.97, 20); mk('paintY', 32.03, -50, 32.15, 20);
    for (let x = -8; x < 108; x += 6) { if (x > 22 && x < 40) continue; mk('paintW', x, 23.9, x + 3, 24.05); mk('paintW', x, 31.9, x + 3, 32.05); }
    for (let z = -48; z < 14; z += 6) { mk('paintW', 29.4, z, 29.55, z + 3); mk('paintW', 34.4, z, 34.55, z + 3); }
    for (let i = 0; i < 9; i++) { mk('paintW', 21 + 0.1, 20.5 + i * 1.7, 24.4, 21.4 + i * 1.7); mk('paintW', 40.6, 20.5 + i * 1.7, 43.9, 21.4 + i * 1.7); }
    for (let i = 0; i < 5; i++) { mk('paintW', 27.6 + i * 1.95, 11.6, 28.6 + i * 1.95, 14.8); mk('paintW', 27.6 + i * 1.95, -6.8, 28.6 + i * 1.95, -3.6); }
    const bld = (k, x0, z0, x1, z1, h) => b(k, x0, 0, z0, x1, h, z1, { collide: true, skip: 'ny' });
    bld('brickA', -10, 40, 22, 52, 18); bld('brickB', 22, 40, 52, 52, 26); bld('brickC', 52, 40, 82, 52, 14); bld('brickA', 82, 40, 110, 52, 22);
    bld('brickB', -22, 16, -10, 40, 16); bld('brickC', 110, 16, 122, 40, 20);
    bld('brickC', 12, -50, 24, 16, 15); bld('brickB', 0, -50, 12, 16, 20);
    bld('brickA', 12, -62, 40, -50, 16);
    // the arena: weathered-steel bands over a glass base, wrapping the plaza
    b({ all: 'rust', ny: null }, 40, 6, -50, 110, 26, -10, { collide: true });
    b({ all: 'rust', ny: null }, 74, 6, -10, 110, 26, 16, { collide: true });
    b({ all: 'glassDark' }, 40.2, 0, -49.8, 109.8, 6, -10.2, { skip: 'ny' });
    b({ all: 'glassDark' }, 74.2, 0, -10, 109.8, 6, 15.8, { skip: 'ny' });
    this.collider(40, 0, -50, 110, 6, -10); this.collider(74, 0, -10, 110, 6, 16);
    // the oculus: a big oval canopy over the plaza with a ring screen around the opening
    const oc = new THREE.Group();
    const ring = new THREE.Shape(); ring.absellipse(0, 0, 21, 15, 0, TAU, false, 0);
    const hole = new THREE.Path(); hole.absellipse(0, 0, 8, 5.6, 0, TAU, true, 0); ring.holes.push(hole);
    const cg = new THREE.ExtrudeGeometry(ring, { depth: 1.6, bevelEnabled: false, curveSegments: 48 }); cg.rotateX(-Math.PI / 2);
    const can = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: SubTex.rust(), roughness: 0.85 }));
    can.position.set(0, 11.4, 0); can.castShadow = true; oc.add(can);
    const scr = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1.3, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0x3a8cff, side: THREE.DoubleSide }));
    scr.scale.set(1, 1, 5.6 / 8); scr.position.set(0, 12.2, 0); oc.add(scr); this.oculusScreen = scr;
    const nameTex = SubTex.sign('arena', 'BARCLAYS CENTER', null, { w: 1024, h: 128, bg: '#1d1a18', noStripe: true, size: 0.55 });
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.4), new THREE.MeshStandardMaterial({ map: nameTex, roughness: 0.7 })); nm.position.set(0, 12.2, 15.05); oc.add(nm);
    oc.position.set(60, 0, 2); oc.rotation.y = -0.15; this.group.add(oc);
    // the entrance pavilion: glass walls, a sloping green roof facing the arena, the station sign
    const pv = { x0: 53.6, x1: 60.4, z0: -12, z1: 4 };
    b('glass', pv.x0 - 0.2, 0, -10, pv.x0, 3.4, 4, { collide: true }); b('glass', pv.x1, 0, -10, pv.x1 + 0.2, 3.4, 4, { collide: true });
    b({ all: 'pole', py: 'roof' }, pv.x0 - 0.6, 3.4, -11, pv.x1 + 0.6, 3.8, 5.5, {});
    this.sign('sg-pavilion', SubTex.sign('pavilion', 'Atlantic Av–Barclays Ctr', ['2', '3', '4', '5', 'B', 'D', 'N', 'Q', 'R'], { w: 2048, h: 128 }), 57, 3.6, 5.52, 7.6, 0.45, 'pz');
    for (const x of [52.6, 61.4]) { // subway globes on posts
      b('pole', x - 0.06, 0, 5.4, x + 0.06, 2.6, 5.52, { collide: true, obstacle: true });
      const gl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0x3fbf60, emissive: 0x2a9a40, emissiveIntensity: 0.9, roughness: 0.3 }));
      gl.position.set(x, 2.8, 5.46); this.group.add(gl);
    }
    // wooden benches on the plaza, gray pavers around the entrance
    this.bench(46, 0, 11.5, 'pz', 'street'); this.bench(68, 0, 11.5, 'pz', 'street'); this.bench(44, 0, -2, 'px', 'street');
    // street lights, corner street-name signs, traffic signals
    const lamp = (x, z) => { b('pole', x - 0.08, 0, z - 0.08, x + 0.08, 7.2, z + 0.08, { collide: true, obstacle: true }); b('pole', x - 0.08, 7.1, z - 0.08, x + 1.6, 7.25, z + 0.08); b('light', x + 1.2, 6.98, z - 0.18, x + 1.7, 7.1, z + 0.18, { skip: 'py' }); };
    for (let x = -4; x < 108; x += 16) { lamp(x, 17.2); lamp(x + 8, 38.6); }
    for (let z = -54; z < 14; z += 16) { lamp(25.2, z); }
    b('pole', 38.6, 0, 18.4, 38.8, 4.2, 18.6, { collide: true, obstacle: true });
    this.sign('sg-stA', SubTex.sign('stA', 'Atlantic Av', null, { w: 512, h: 96, bg: '#0f6b3a', noStripe: true, size: 0.6 }), 38.7, 4.0, 18.72, 1.6, 0.3, 'pz');
    this.sign('sg-stF', SubTex.sign('stF', 'Flatbush Av', null, { w: 512, h: 96, bg: '#0f6b3a', noStripe: true, size: 0.6 }), 38.92, 3.65, 18.5, 1.6, 0.3, 'px');
    for (const [x, z, f] of [[38.3, 21.5, 'nx'], [25.7, 34.5, 'px']]) {
      b('pole', x - 0.08, 0, z - 0.08, x + 0.08, 5, z + 0.08, { collide: true, obstacle: true });
      b('rubber', x - 0.22, 3.6, z - 0.22, x + 0.22, 4.8, z + 0.22);
      const lt = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial({ color: 0x40ff70 }));
      lt.position.set(x + (f === 'px' ? 0.23 : -0.23), 3.85, z); lt.rotation.y = f === 'px' ? Math.PI / 2 : -Math.PI / 2; this.group.add(lt);
    }
  }
  // ------------------------------------------------------------------------ furniture ----
  // a wooden subway bench (5 seats with steel dividers) against cx,cz facing 'px'|'nx'|'pz'|'nz';
  // its seats join the sitting spots
  bench(cx, y, cz, face, region) {
    const ax = face[1] === 'x' ? 'z' : 'x', fs = face[0] === 'p' ? 1 : -1;
    // local frame: along = the bench length, out = facing direction
    const P = (a, o) => ax === 'x' ? [cx + a, cz + o * fs] : [cx + o * fs, cz + a];
    const bx = (k, a0, a1, o0, o1, y0, y1, opt) => {
      const [x0, z0] = P(a0, o0), [x1, z1] = P(a1, o1);
      this.box(k, Math.min(x0, x1), y + y0, Math.min(z0, z1), Math.max(x0, x1), y + y1, Math.max(z0, z1), opt);
    };
    const half = 1.5;
    bx('wood', -half, half, -0.2, 0.22, 0.41, 0.445);                                   // seat boards
    bx('blackSteel', -half, half, -0.21, 0.2, 0.36, 0.41);                              // seat rail
    bx('wood', -half, half, -0.29, -0.25, 0.52, 0.66); bx('wood', -half, half, -0.31, -0.27, 0.72, 0.86); // back boards
    for (const a of [-half + 0.04, 0, half - 0.04]) { bx('blackSteel', a - 0.03, a + 0.03, -0.25, 0.18, 0, 0.36); bx('blackSteel', a - 0.03, a + 0.03, -0.32, -0.26, 0, 0.9); }
    for (const a of [-0.9, -0.3, 0.3, 0.9]) bx('blackSteel', a - 0.02, a + 0.02, -0.22, 0.14, 0.445, 0.64); // dividers (no lying down)
    // collider + footprint obstacle so walkers step round it
    const [x0, z0] = P(-half, -0.33), [x1, z1] = P(half, 0.24);
    this.collider(Math.min(x0, x1), y, Math.min(z0, z1), Math.max(x0, x1), y + 0.445, Math.max(z0, z1));
    this.obstacles.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: y, y1: y + 0.9, bench: true });
    // seats: hips over the seat, the sitter faces out
    const yaw = face === 'px' ? Math.PI / 2 : face === 'nx' ? -Math.PI / 2 : face === 'pz' ? 0 : Math.PI;
    for (const a of [-1.2, -0.6, 0, 0.6, 1.2]) { const [sx, sz] = P(a, -0.06); this.benchSeats.push({ x: sx, y, z: sz, yaw, h: 0.445, occupant: null, kind: 'bench', region }); }
  }
  trashCan(x, y, z) {
    this.box({ all: 'blackSteel', py: 'dark' }, x - 0.27, y, z - 0.27, x + 0.27, y + 0.86, z + 0.27, { collide: true, obstacle: true });
    this.box('steel', x - 0.29, y + 0.82, z - 0.29, x + 0.29, y + 0.88, z + 0.29);
  }
  // I-beam column (flanges across 'axis'), pit floor to ceiling; obstacle for walkers on that level
  column(k, x, z, y0, y1, flangeAxis, obstacleY) {
    const b = (x0, z0, x1, z1) => this.box(k, x0, y0, z0, x1, y1, z1, { skip: 'pyny' });
    if (flangeAxis === 'z') { b(x - 0.15, z + 0.12, x + 0.15, z + 0.15); b(x - 0.15, z - 0.15, x + 0.15, z - 0.12); b(x - 0.016, z - 0.12, x + 0.016, z + 0.12); }
    else { b(x + 0.12, z - 0.15, x + 0.15, z + 0.15); b(x - 0.15, z - 0.15, x - 0.12, z + 0.15); b(x - 0.12, z - 0.016, x + 0.12, z + 0.016); }
    this.collider(x - 0.15, y0, z - 0.15, x + 0.15, y1, z + 0.15);
    if (obstacleY != null) this.obstacles.push({ x0: x - 0.16, x1: x + 0.16, z0: z - 0.16, z1: z + 0.16, y0: obstacleY, y1: y1 });
  }
  // a countdown clock: two lines of next trains, redrawn every few seconds from the train schedule
  clock(x, y, z, axis, tracks, ceilY) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const geo = new THREE.PlaneGeometry(1.5, 0.375);
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(geo, mat);
      if (axis === 'z') { m.position.set(x, y, z + s * 0.06); m.rotation.y = s > 0 ? 0 : Math.PI; }
      else { m.position.set(x + s * 0.06, y, z); m.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; }
      this.group.add(m);
    }
    if (axis === 'z') this.box('signBox', x - 0.8, y - 0.21, z - 0.055, x + 0.8, y + 0.21, z + 0.055); else this.box('signBox', x - 0.055, y - 0.21, z - 0.8, x + 0.055, y + 0.21, z + 0.8);
    if (ceilY != null) this.box('steel', x - 0.015, y + 0.21, z - 0.015, x + 0.015, ceilY, z + 0.015);
    this.clocks.push({ cv, tex, tracks, t: Math.random() * 2 });
  }
  drawClock(c) {
    const g = c.cv.getContext('2d'), W = c.cv.width, H = c.cv.height;
    g.fillStyle = '#060606'; g.fillRect(0, 0, W, H);
    const rows = [];
    for (const k of c.tracks) { const tr = this.trainsByKey && this.trainsByKey[k]; if (tr) rows.push(this.trainEta(tr)); }
    rows.sort((a, b) => a.eta - b.eta);
    rows.slice(0, 2).forEach((r, i) => {
      const cy = 34 + i * 60, rr = 22;
      g.fillStyle = SUB_LINES[r.line] || '#888'; g.beginPath(); g.arc(34, cy, rr, 0, TAU); g.fill();
      g.fillStyle = r.line === 'Q' ? '#111' : '#fff'; g.font = 'bold 30px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(r.line, 34, cy + 2);
      g.fillStyle = '#f2a33a'; g.textAlign = 'left'; g.font = 'bold 28px Helvetica, Arial, sans-serif'; g.fillText(r.dest, 68, cy + 2, 330);
      g.textAlign = 'right'; g.fillText(r.eta < 30 ? (r.boarding ? 'Now' : 'Arriving') : Math.max(1, Math.round(r.eta / 60)) + ' min', W - 14, cy + 2);
    });
    c.tex.needsUpdate = true;
  }
  // ------------------------------------------------------------------------ station ------
  buildStation(Y) {
    const b = (k, x0, y0, z0, x1, y1, z1, o) => this.box(k, x0, y0, z0, x1, y1, z1, o);
    const I = this.IRT, M = this.BMT, openN = this.openN;
    // ---- floors
    const floor = (r, k) => { if (r.slope) return; b(k, r.x0, r.y - 0.4, r.z0, r.x1, r.y, r.z1, { skip: 'nxpxnzpzny' }); };
    for (const r of [this.rMezz, this.rMezzFree, this.rIrtN, this.rIrtIsl, this.rIrtS, this.rUnder, this.rPassB, this.rBmtW, this.rBmtE, this.rBmtC0, this.rBmtC1]) floor(r, 'terrazzo');
    b({ all: 'concrete', py: 'terrazzo' }, this.rBridge.x0, Y.under - 0.45, this.rBridge.z0, this.rBridge.x1, Y.under, this.rBridge.z1, { collide: true });
    // ---- platform slabs (concrete faces toward the tracks) and the edge: white coping + yellow tactile strip
    const slab = (x0, z0, x1, z1, top, bot) => b({ all: 'concrete', py: null }, x0, bot, z0, x1, top, z1, { collide: true });
    slab(I.x0, -45, I.x1, -40, Y.irt, Y.irtPit); slab(I.x0, -59.7, I.x1, -51.7, Y.irt, Y.irtPit); slab(I.x0, -71.4, I.x1, -66.4, Y.irt, Y.irtPit);
    slab(M.x0, M.z0, M.x1, M.z1, Y.bmt, Y.bmtPit);
    const edgeZ = (x0, x1, zEdge, dir) => { // dir: +1 platform lies toward +z of the edge
      b('edge', x0, Y.irt, Math.min(zEdge, zEdge + dir * 0.3), x1, Y.irt + 0.012, Math.max(zEdge, zEdge + dir * 0.3), { skip: 'ny' });
      b('tactile', x0, Y.irt, Math.min(zEdge + dir * 0.3, zEdge + dir * 0.91), x1, Y.irt + 0.01, Math.max(zEdge + dir * 0.3, zEdge + dir * 0.91), { skip: 'ny' });
    };
    edgeZ(I.x0, I.x1, -45, 1); edgeZ(I.x0, I.x1, -51.7, -1); edgeZ(I.x0, I.x1, -59.7, 1); edgeZ(I.x0, I.x1, -66.4, -1);
    const edgeX = (z0, z1, xEdge, dir) => {
      b('edge', Math.min(xEdge, xEdge + dir * 0.3), Y.bmt, z0, Math.max(xEdge, xEdge + dir * 0.3), Y.bmt + 0.012, z1, { skip: 'ny' });
      b('tactile', Math.min(xEdge + dir * 0.3, xEdge + dir * 0.91), Y.bmt, z0, Math.max(xEdge + dir * 0.3, xEdge + dir * 0.91), Y.bmt + 0.01, z1, { skip: 'ny' });
    };
    edgeX(M.z0, M.z1, M.x0, 1); edgeX(M.z0, M.z1, M.x1, -1);
    // ---- stairs: treads + risers over the ramp; an escalator lane on the entrance stair
    const stairs = (r, k, axis, lane) => {
      const s = r.slope, n = Math.max(6, Math.round(Math.abs(s.yb - s.ya) / 0.18)), L = s.b - s.a;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n, ya = lerp(s.ya, s.yb, t0), yb = lerp(s.ya, s.yb, t1), c0 = s.a + L * t0, c1 = s.a + L * t1;
        const top = Math.max(ya, yb);
        if (axis === 'z') b(k, r.x0, top - 0.18, Math.min(c0, c1), lane ? r.x1 - lane : r.x1, top, Math.max(c0, c1), { skip: 'nxpxny' });
        else b(k, Math.min(c0, c1), top - 0.18, r.z0, Math.max(c0, c1), top, r.z1, { skip: 'nzpzny' });
      }
    };
    stairs(this.rStairE, 'terrazzo', 'z', 1.9); stairs(this.rStN, 'terrazzo', 'x'); stairs(this.rStI, 'terrazzo', 'x'); stairs(this.rStS, 'terrazzo', 'x'); stairs(this.rStB, 'terrazzo', 'z');
    { const r = this.rStairE, s = r.slope, x0 = r.x1 - 1.8, x1 = r.x1 - 0.1;
      const geo = new THREE.PlaneGeometry(x1 - x0, Math.hypot(s.b - s.a, s.yb - s.ya), 1, 1);
      const tex = Tex.make('sub-escal', 64, 256, (gg, w, h) => { gg.fillStyle = '#4a4e52'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#8d9297'; for (let y = 0; y < h; y += 16) gg.fillRect(0, y, w, 4); gg.fillStyle = '#e0b52a'; gg.fillRect(0, 0, 4, h); gg.fillRect(w - 4, 0, 4, h); });
      tex.repeat.set(1, 16); this.escTex = tex;
      const em = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.5 }));
      const ang = Math.atan2(s.yb - s.ya, s.b - s.a);
      em.rotation.x = -Math.PI / 2 - ang;
      em.position.set((x0 + x1) / 2, (s.ya + s.yb) / 2 + 0.03, (s.a + s.b) / 2); this.group.add(em);
      for (const x of [x0 - 0.1, x1]) {
        const bal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, Math.hypot(s.b - s.a, s.yb - s.ya)), this.matDefs.steel.mat);
        bal.rotation.x = -ang; bal.position.set(x + 0.05, (s.ya + s.yb) / 2 + 0.5, (s.a + s.b) / 2); this.group.add(bal);
        const hr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, Math.hypot(s.b - s.a, s.yb - s.ya)), this.matDefs.rubber.mat);
        hr.rotation.x = -ang; hr.position.set(x + 0.05, (s.ya + s.yb) / 2 + 1.04, (s.a + s.b) / 2); this.group.add(hr);
      }
      this.obstacles.push({ x0: x0 - 0.15, x1: x0 + 0.05, z0: s.a + 1, z1: s.b - 1, y0: Y.mezz, y1: 0.5 });
    }
    // the Brighton stair: a solid parapet each side that follows the flight down to the island
    { const r = this.rStB, s = r.slope, n = 10;
      for (let i = 0; i < n; i++) {
        const z0 = lerp(s.a, s.b, i / n), z1 = lerp(s.a, s.b, (i + 1) / n), top = r.floor(0, z0) + 1.0;
        for (const [x0, x1] of [[r.x0 - 0.12, r.x0], [r.x1, r.x1 + 0.12]]) b({ all: 'tile', py: 'steel' }, x0, Y.bmt, z0, x1, top, z1, { collide: true });
      }
      this.obstacles.push({ x0: r.x0 - 0.15, x1: r.x1 + 0.15, z0: s.a, z1: s.b - 1.2, y0: Y.bmt, y1: Y.bmt + 2 });
    }
    // bridge railings: glass panels between steel posts
    { const r = this.rBridge, y = Y.under;
      for (const [z0, z1, gaps] of [[r.z0, r.z0 + 0.06, []], [r.z1 - 0.06, r.z1, [[this.rStB.x0, this.rStB.x1]]]]) {
        let x = r.x0;
        const segs = []; let a = r.x0; for (const [p, q] of gaps) { segs.push([a, p]); a = q; } segs.push([a, r.x1]);
        for (const [a0, a1] of segs) {
          b('glass', a0, y, z0, a1, y + 1.05, z1, { collide: true });
          b('steel', a0, y + 1.05, z0 - 0.02, a1, y + 1.12, z1 + 0.02);
          for (x = a0; x <= a1 + 1e-3; x += 1.5) b('steel', Math.min(x, a1 - 0.05), y, z0 - 0.02, Math.min(x, a1 - 0.05) + 0.05, y + 1.1, z1 + 0.02);
        }
      }
    }
    // ---- ceilings with fluorescent strips; ceiling slabs are colliders
    const lightsX = (x0, x1, z, y) => { for (let x = x0 + 1.5; x < x1 - 1.5; x += 3.2) b('light', x, y - 0.08, z - 0.09, x + 2.4, y, z + 0.09, { skip: 'py' }); };
    const lightsZ = (z0, z1, x, y) => { for (let z = z0 + 1.5; z < z1 - 1.5; z += 3.2) b('light', x - 0.09, y - 0.08, z, x + 0.09, y, z + 2.4, { skip: 'py' }); };
    const flat = (r) => b('ceiling', r.x0 - 0.3, r.ceil, r.z0 - 0.3, r.x1 + 0.3, r.ceil + 0.3, r.z1 + 0.3, { collide: true });
    for (const r of [this.rMezz, this.rMezzFree]) { flat(r); for (let z = r.z0 + 2; z < r.z1; z += 4) lightsX(r.x0, r.x1, z, r.ceil); }
    for (const r of [this.rIrtN, this.rIrtS]) { flat(r); lightsX(r.x0, r.x1, (r.z0 + r.z1) / 2 - 0.9, r.ceil); lightsX(r.x0, r.x1, (r.z0 + r.z1) / 2 + 0.9, r.ceil); }
    flat(this.rIrtIsl); lightsX(I.x0, I.x1, -54.2, I.ceil); lightsX(I.x0, I.x1, -57.2, I.ceil);
    b('ceiling', -450, I.ceil, -51.7, 450, I.ceil + 0.3, -45, { collide: true }); b('ceiling', -450, I.ceil, -66.4, 450, I.ceil + 0.3, -59.7, { collide: true });
    for (const r of [this.rUnder, this.rPassB]) { flat(r); if (r === this.rUnder) lightsZ(r.z0, r.z1, 86, r.ceil); else lightsX(r.x0, r.x1, -32, r.ceil); }
    for (const r of [this.rStN, this.rStI, this.rStS]) { const s = r.slope, n = 8; for (let i = 0; i < n; i++) { const c0 = lerp(s.a, s.b, i / n), c1 = lerp(s.a, s.b, (i + 1) / n), y = Math.max(r.floor(c0, 0), r.floor(c1, 0)) + r.ceilRel; b('ceiling', c0, y, r.z0 - 0.3, c1, y + 0.3, r.z1 + 0.3, { collide: true }); } }
    { const r = this.rStairE, s = r.slope, n = 8;
      for (let i = 0; i < n; i++) { let c0 = lerp(s.a, s.b, i / n), c1 = lerp(s.a, s.b, (i + 1) / n); const lo = Math.max(c0, r.ceilZ[0]), hi = Math.min(c1, r.ceilZ[1]); if (hi <= lo) continue; const y = r.floor(0, hi) + r.ceilRel; b('ceiling', r.x0 - 0.3, y, lo, r.x1 + 0.3, y + 0.3, hi, { collide: true }); } }
    // Brighton hall: low ceiling over most of the platform, double height at the bridge end, tunnels beyond
    const hallC = (x0, x1) => {
      b('ceiling', x0, M.ceilWell, M.z0, x1, M.ceilWell + 0.3, M.well, { collide: true });
      b('ceiling', x0, M.ceilHall, M.well, x1, M.ceilHall + 0.3, M.z1, { collide: true });
    };
    hallC(151, 169);
    for (const [x0, x1] of [[151, 156], [164, 169]]) { b('tunnel', x0, M.ceilTunnel, -440, x1, M.ceilTunnel + 0.3, M.z0, { collide: true }); b('tunnel', x0, M.ceilTunnel, M.z1, x1, M.ceilTunnel + 0.3, 560, { collide: true }); }
    b('paint', 151, M.ceilHall, M.well - 0.3, 169, M.ceilWell, M.well, { collide: true });                            // fascia where the ceiling steps up
    for (const [x0, x1] of [[151, 156], [164, 169]]) { b('paint', x0, M.ceilTunnel, M.z0 - 0.3, x1, M.ceilWell, M.z0, { collide: true }); b('paint', x0, M.ceilTunnel, M.z1, x1, M.ceilHall, M.z1 + 0.3, { collide: true }); }
    lightsZ(M.well, M.z1, 158.2, M.ceilHall); lightsZ(M.well, M.z1, 161.8, M.ceilHall);
    for (const x of [154.4, 165.6]) lightsZ(M.well, M.z1, x, M.ceilHall);
    // pendant lamps under the bridge-end well
    for (let z = M.z0 + 3; z < M.well - 1; z += 4) for (const x of [157.2, 162.8]) { b('light', x - 0.5, -12.5, z - 0.09, x + 0.5, -12.42, z + 0.09, { skip: 'py' }); b('steel', x - 0.01, -12.42, z - 0.01, x + 0.01, M.ceilWell, z + 0.01); }
    // ---- track beds: ballast, ties near the platforms, running rails, third rail with its board
    const track = (axis, c, from, to, tieFrom, tieTo, pitY, thirdSide) => {
      for (const off of [-0.7175, 0.7175]) {
        if (axis === 'x') b('rail', from, pitY + 0.16, c + off - 0.035, to, pitY + 0.32, c + off + 0.035, { skip: 'nxpxny' });
        else b('rail', c + off - 0.035, pitY + 0.16, from, c + off + 0.035, pitY + 0.32, to, { skip: 'nzpzny' });
      }
      for (let t = tieFrom; t < tieTo; t += 0.75) {
        if (axis === 'x') b('tie', t, pitY + 0.02, c - 1.25, t + 0.22, pitY + 0.16, c + 1.25, { skip: 'ny' });
        else b('tie', c - 1.25, pitY + 0.02, t, c + 1.25, pitY + 0.16, t + 0.22, { skip: 'ny' });
      }
      const o = thirdSide * 1.5;
      if (axis === 'x') { b('steel', from, pitY + 0.2, c + o - 0.04, to, pitY + 0.36, c + o + 0.04, { skip: 'nxpxny' }); b('board', from, pitY + 0.42, c + o - 0.1, to, pitY + 0.45, c + o + 0.12, { skip: 'nxpx' }); }
      else { b('steel', c + o - 0.04, pitY + 0.2, from, c + o + 0.04, pitY + 0.36, to, { skip: 'nzpzny' }); b('board', c + o - 0.1, pitY + 0.42, from, c + o + 0.12, pitY + 0.45, to, { skip: 'nzpz' }); }
    };
    for (const r of [this.rIrtPitA, this.rIrtPitB]) b('ballast', r.x0, Y.irtPit - 0.3, r.z0, r.x1, Y.irtPit, r.z1, { skip: 'nxpxnzpzny' });
    track('x', I.tracks.nl, -450, 450, I.x0 - 40, I.x1 + 40, Y.irtPit, -1); track('x', I.tracks.ne, -450, 450, I.x0 - 40, I.x1 + 40, Y.irtPit, 1);
    track('x', I.tracks.se, -450, 450, I.x0 - 40, I.x1 + 40, Y.irtPit, -1); track('x', I.tracks.sl, -450, 450, I.x0 - 40, I.x1 + 40, Y.irtPit, 1);
    for (const r of [this.rBmtPitW, this.rBmtPitE]) b('ballast', r.x0, Y.bmtPit - 0.3, r.z0, r.x1, Y.bmtPit, r.z1, { skip: 'nxpxnzpzny' });
    track('z', M.tracks.w, -440, 560, M.z0 - 40, M.z1 + 40, Y.bmtPit, -1); track('z', M.tracks.e, -440, 560, M.z0 - 40, M.z1 + 40, Y.bmtPit, 1);
    // ---- columns: steel I-beams between the local and express tracks and down the island
    for (let x = I.x0 - 30 + 2.3; x < I.x1 + 30; x += 4.6) for (const z of [-48.35, -63.05]) this.column('colIRT', x, z, Y.irtPit, I.ceil, 'z');
    let ci = 0;
    for (let x = I.x0 + 4.6; x < I.x1 - 2; x += 4.6, ci++) {
      this.column('colIRT', x, -55.7, Y.irt, I.ceil, 'x', Y.irt);
      if (ci % 3 === 1) { this.sign('sg-col', SubTex.columnSign('abc', 'Atlantic Av–Barclays Ctr'), x, Y.irt + 1.9, -55.7 + 0.155, 0.16, 1.3, 'pz'); this.sign('sg-col', SubTex.columnSign('abc', 'Atlantic Av–Barclays Ctr'), x, Y.irt + 1.9, -55.7 - 0.155, 0.16, 1.3, 'nz'); }
    }
    ci = 0;
    for (let z = M.z0 + 2.3; z < M.z1 - 1; z += 4.6, ci++) for (const x of [157.6, 162.4]) {
      const top = z < M.well ? M.ceilWell : M.ceilHall;
      if (z > this.rStB.z0 - 1 && z < this.rStB.z1 + 0.5 && Math.abs(x - 160) < 2) continue;
      this.column('colBMT', x, z, Y.bmt, top, 'z', Y.bmt);
      if (ci % 2 === 0) { const f = x < 160 ? 'nx' : 'px', o = x < 160 ? -0.155 : 0.155; this.sign('sg-colb', SubTex.columnSign('bc', 'Barclays Center'), x + o, Y.bmt + 1.9, z, 0.16, 1.3, f); }
    }
    // ---- fare control: turnstiles, emergency gate, booth, vending machines
    for (let x = 44.5; x <= 75.5; x += 1.25) {
      b('steel', x - 0.16, Y.mezz, -24.45, x + 0.16, Y.mezz + 1.0, -23.55, { collide: true, obstacle: true });
      b('machine', x - 0.12, Y.mezz + 1.0, -24.2, x + 0.12, Y.mezz + 1.06, -23.8);
      b('steel', x + 0.16, Y.mezz + 0.82, -24.06, x + 0.62, Y.mezz + 0.86, -24.02);
      b('screen', x - 0.08, Y.mezz + 1.06, -24.1, x + 0.08, Y.mezz + 1.08, -23.95); // OMNY reader
    }
    b('steel', 40, Y.mezz, -24.1, 44.2, Y.mezz + 1.1, -23.9, { collide: true, obstacle: true }); b('steel', 76, Y.mezz, -24.1, 84, Y.mezz + 1.1, -23.9, { collide: true, obstacle: true });
    b({ all: 'glass', py: 'booth', ny: 'booth' }, 40.3, Y.mezz, -30, 43.6, Y.mezz + 2.6, -25.2, { collide: true, obstacle: true });
    for (const x of [40, 42.2, 44.4, 66.5, 68.7, 70.9]) {
      b('machine', x - 0.95, Y.mezz, -12.75, x + 0.95, Y.mezz + 1.9, -12.0, { collide: true, obstacle: true });
      b('screen', x - 0.45, Y.mezz + 1.05, -12.77, x + 0.15, Y.mezz + 1.5, -12.74, { skip: 'nxpxnzpyny' });
      b('paintY', x + 0.35, Y.mezz + 0.9, -12.77, x + 0.7, Y.mezz + 1.25, -12.74, { skip: 'nxpxnzpyny' });
    }
    // ---- benches, trash cans, countdown clocks
    for (const x of [-70, -54, -38, -22, -6, 10, 26, 40, 58, 73]) this.bench(x, Y.irt, -40.32, 'nz', this.rIrtN);
    for (const x of [-70, -50, -30, -10, 10, 30, 50, 70]) this.bench(x, Y.irt, -71.08, 'pz', this.rIrtS);
    for (let k = 1; k * 4.6 + 2.3 < I.x1 - I.x0 - 4; k += 3) { const x = I.x0 + k * 4.6 + 2.3; this.bench(x, Y.irt, -55.38, 'pz', this.rIrtIsl); this.bench(x, Y.irt, -56.02, 'nz', this.rIrtIsl); }
    for (const z of [2, 22, 44, 66, 88, 110, 132]) { this.bench(160.32, Y.bmt, z, 'px', this.rBmtC1); this.bench(159.68, Y.bmt, z, 'nx', this.rBmtC1); }
    for (const x of [-62, -14, 18, 33]) this.trashCan(x, Y.irt, -40.5);
    for (const x of [-60, -20, 20, 60]) this.trashCan(x, Y.irt, -70.9);
    for (const z of [12, 56, 100]) this.trashCan(160, Y.bmt, z + 9);
    this.clock(14, Y.irt + 2.7, -42.8, 'z', ['nl'], I.ceil); this.clock(-30, Y.irt + 2.7, -53.4, 'z', ['ne'], I.ceil);
    this.clock(-30, Y.irt + 2.7, -58.0, 'z', ['se'], I.ceil); this.clock(14, Y.irt + 2.7, -68.8, 'z', ['sl'], I.ceil);
    this.clock(160, Y.bmt + 2.75, 30, 'x', ['w', 'e'], M.ceilHall);
    // ---- signs: mosaic name tablets and terra-cotta "A" plaques on the IRT walls, modern signs over the platforms
    let ti = 0;
    for (let x = I.x0 + 9; x < I.x1 - 4; x += 15, ti++) {
      for (const [z, f] of [[-40.012, 'nz'], [-71.388, 'pz']]) {
        const blocked = (xx, w) => f === 'nz' && openN.some(([a, c]) => xx + w > a - 0.4 && xx - w < c + 0.4);
        if (!blocked(x, 1.4)) this.sign('tabletIRT', null, x, Y.irt + 1.95, z, 2.8, 0.7, f);
        if (!blocked(x + 7.5, 0.3) && x + 7.5 < I.x1 - 1) this.sign('medallion', null, x + 7.5, Y.irt + 2.05, z + (f === 'nz' ? -0.004 : 0.004), 0.55, 0.69, f);
        // the glass-block "Atlantic Avenue" wall panels on the Manhattan-bound side
        if (f === 'nz' && ti % 2 === 0 && !blocked(x + 3.9, 2)) b({ all: null, nz: 'glassBlock' }, x + 1.9, Y.irt + 0.95, -40.03, x + 5.9, Y.irt + 2.2, -40.01);
      }
    }
    for (let z = M.z0 + 12; z < M.z1 - 4; z += 20) { this.sign('tabletBMT', null, 151.012, Y.bmt + 1.9, z, 2.6, 0.65, 'px'); this.sign('tabletBMT', null, 168.988, Y.bmt + 1.9, z, 2.6, 0.65, 'nx'); }
    const nameIRT = SubTex.sign('nm23', 'Atlantic Av–Barclays Ctr', ['2', '3'], { w: 1536, h: 128 });
    const nameIsl = SubTex.sign('nm45', 'Atlantic Av–Barclays Ctr', ['4', '5'], { w: 1536, h: 128 });
    const nameBQ = SubTex.sign('nmBQ', 'Atlantic Av–Barclays Ctr', ['B', 'Q'], { w: 1536, h: 128 });
    for (let x = I.x0 + 12; x < I.x1 - 6; x += 24) {
      this.hangSign('sg-nm23', nameIRT, x, Y.irt + 2.95, -44.0, 4.6, 0.38, 'z', I.ceil);
      this.hangSign('sg-nm45', nameIsl, x + 12, Y.irt + 2.95, (x / 24 | 0) % 2 ? -54.3 : -57.1, 4.6, 0.38, 'z', I.ceil);
      this.hangSign('sg-nm23', nameIRT, x, Y.irt + 2.95, -67.4, 4.6, 0.38, 'z', I.ceil);
    }
    for (let z = M.well + 8; z < M.z1 - 6; z += 24) this.hangSign('sg-nmBQ', nameBQ, 160, Y.bmt + 3.2, z, 4.6, 0.38, 'x', M.ceilHall);
    this.hangSign('sg-dirN', SubTex.sign('dirN', 'Manhattan & the Bronx  ←', ['2', '3'], { w: 1536, h: 128 }), 30, Y.irt + 2.95, -42.2, 4.6, 0.38, 'z', I.ceil);
    this.hangSign('sg-dirIn', SubTex.sign('dirIn', 'Manhattan & the Bronx  ←', ['4', '5'], { w: 1536, h: 128 }), -8, Y.irt + 2.95, -53.6, 4.6, 0.38, 'z', I.ceil,
      'sg-dirIs', SubTex.sign('dirIs', 'Crown Hts · Flatbush Av  →', ['4', '5'], { w: 1536, h: 128 }));
    this.hangSign('sg-dirS', SubTex.sign('dirS', 'Flatbush Av · New Lots Av  →', ['2', '3'], { w: 1536, h: 128 }), 30, Y.irt + 2.95, -69.4, 4.6, 0.38, 'z', I.ceil);
    this.sign('sg-down', SubTex.sign('toUnder', 'Underpass · 4 5 · 2 3 Brooklyn · B Q  →', ['4', '5', 'B', 'Q'], { w: 2048, h: 128, size: 0.34 }), 73, Y.irt + 2.9, -40.012, 4.8, 0.32, 'nz');
    this.sign('sg-exit', SubTex.sign('exit', 'Exit · Atlantic Av · Flatbush Av · Barclays Center  ↑', null, { w: 2048, h: 128, size: 0.36 }), 57, Y.mezz + 3.1, -12.2, 6, 0.38, 'nz');
    this.sign('sg-to23', SubTex.sign('to23', 'Manhattan-bound  ↓', ['2', '3'], { w: 1024, h: 128 }), 50, Y.mezz + 2.9, -39.988, 3.6, 0.42, 'pz');
    this.sign('sg-to23', SubTex.sign('to23', 'Manhattan-bound  ↓', ['2', '3'], { w: 1024, h: 128 }), 66, Y.mezz + 2.9, -39.988, 3.6, 0.42, 'pz');
    this.sign('sg-uBQ', SubTex.sign('uBQ', 'B Q  Brighton Line  →', ['B', 'Q'], { w: 1536, h: 128 }), 87.988, Y.under + 2.1, -40, 3.6, 0.32, 'nx');
    this.sign('sg-pBQ', SubTex.sign('pBQ', 'B Q  Manhattan · Coney Island', ['B', 'Q'], { w: 2048, h: 128, size: 0.36 }), 120, Y.under + 2.15, -33.988, 5.4, 0.36, 'pz');
    this.hangSign('sg-bridge', SubTex.sign('bridge', 'B Q  to all trains  ↓', ['B', 'Q'], { w: 1536, h: 128 }), 160, Y.under + 2.22, -32.6, 3.6, 0.3, 'z', M.ceilWell);
    // lintels over the two openings between fare control and the platform
    for (const [a, c] of openN) b({ all: 'concrete', nz: 'tile', pz: 'tileCream' }, a, Y.irt + 2.7, -40, c, I.ceil, -39.7, { collide: true });
    // tunnel lamps along the track walls beyond the platforms
    for (let x = -440; x < 440; x += 18) { if (x > I.x0 - 4 && x < I.x1 + 4) continue; for (const z of [-45.25, -59.95, -66.15]) b('lampWarm', x, Y.irtPit + 2.6, z - 0.08, x + 0.25, Y.irtPit + 2.75, z + 0.08); }
    for (let z = -430; z < 550; z += 18) { if (z > M.z0 - 4 && z < M.z1 + 4) continue; for (const x of [151.15, 168.85]) b('lampWarm', x - 0.08, Y.bmtPit + 2.6, z, x + 0.08, Y.bmtPit + 2.75, z + 0.25); }
  }
  // walls along every region edge that is not open to a neighbour, finished by style (tile, mosaic
  // frieze, terra-cotta, wave wainscot, BMT trim line, tunnel concrete)
  buildWalls() {
    const T = 0.3;
    const gaps = (lo, hi, open) => { let segs = [[lo, hi]]; for (const [a, c] of open) { const nx = []; for (const [s, e] of segs) { if (c <= s || a >= e) { nx.push([s, e]); continue; } if (a > s) nx.push([s, a]); if (c < e) nx.push([c, e]); } segs = nx; } return segs.filter(([s, e]) => e - s > 0.05); };
    for (const r of this.regions) {
      if (r.street || r.noWalls) continue;
      const nw = r.noWallSide || {};
      for (const side of ['x0', 'x1', 'z0', 'z1']) {
        if (nw[side]) continue;
        const lo = side[0] === 'x' ? r.z0 : r.x0, hi = side[0] === 'x' ? r.z1 : r.x1;
        for (const [a, c] of gaps(lo, hi, r.open[side])) {
          // style splits (e.g. the Brighton hall inside a long tunnel wall)
          let runs = [[a, c, r.style || 'plain']];
          for (const [p, q, sty] of r.styleSplit || []) { const nx = []; for (const [s, e, st] of runs) { if (q <= s || p >= e) { nx.push([s, e, st]); continue; } if (p > s) nx.push([s, p, st]); nx.push([Math.max(s, p), Math.min(e, q), sty]); if (q < e) nx.push([q, e, st]); } runs = nx; }
          for (const [s, e, sty] of runs) this.wallRun(r, side, s, e, sty, T);
        }
      }
    }
  }
  wallRun(r, side, a, c, sty, T) {
    const ax = side[0] === 'x' ? 'x' : 'z', fixed = side === 'x0' ? r.x0 : side === 'x1' ? r.x1 : side === 'z0' ? r.z0 : r.z1;
    const nSign = side[1] === '0' ? 1 : -1; // the inner face looks into the region
    const at = (u) => ax === 'x' ? [fixed, u] : [u, fixed];
    const f0 = r.floor(...at(a)), f1 = r.floor(...at(c));
    const yb = Math.min(f0, f1) - (r.pit ? 0.1 : 0.2);
    let yt = Math.max(r.ceilAt(...at(a)), r.ceilAt(...at(c)), r.ceilAt(...at((a + c) / 2))) + 0.3;
    if (r.slope) yt = Math.max(f0, f1) + (r.ceilRel || 3) + 0.3;
    // holes cut through this side (a passage entering a hall)
    const pieces = [];
    const holes = (r.holes || []).filter(h => h.side === side && h.hi > a && h.lo < c);
    let u = a;
    for (const h of holes.sort((p, q) => p.lo - q.lo)) {
      if (h.lo > u) pieces.push([u, h.lo, yb, yt]);
      pieces.push([Math.max(u, h.lo), Math.min(c, h.hi), yb, h.y0]); pieces.push([Math.max(u, h.lo), Math.min(c, h.hi), h.y1, yt]);
      u = Math.min(c, h.hi);
    }
    if (u < c) pieces.push([u, c, yb, yt]);
    const layers = WALL_STYLES[sty] || WALL_STYLES.plain, ref = r.refY != null ? r.refY : Math.min(f0, f1);
    for (const [p, q, y0, y1] of pieces) {
      if (y1 - y0 < 0.02 || q - p < 0.02) continue;
      // collider + rough concrete outside, finished inner face
      const inner = ax === 'x' ? (nSign > 0 ? 'px' : 'nx') : (nSign > 0 ? 'pz' : 'nz'), outer = ax === 'x' ? (nSign > 0 ? 'nx' : 'px') : (nSign > 0 ? 'nz' : 'pz');
      const mk = { all: 'concrete' }; mk[inner] = null;
      const outSty = r.wallOuter && r.wallOuter[side];
      if (outSty) {
        mk[outer] = null;
        const ox = fixed - nSign * (T + 0.002);
        for (const [l0, l1, key, band] of WALL_STYLES[outSty]) { const ya = Math.max(y0, ref + l0), yb2 = Math.min(y1, ref + l1); if (yb2 - ya < 0.01) continue; this.vrect(key, ax, ox, p, q, ya, yb2, -nSign, band); }
      }
      if (ax === 'x') this.box(mk, nSign > 0 ? fixed - T : fixed, y0, p, nSign > 0 ? fixed : fixed + T, y1, q, { collide: true });
      else this.box(mk, p, y0, nSign > 0 ? fixed - T : fixed, q, y1, nSign > 0 ? fixed : fixed + T, { collide: true });
      const fx = fixed + nSign * 0.002;
      for (const [l0, l1, key, band] of layers) {
        const ya = Math.max(y0, ref + l0), yb2 = Math.min(y1, ref + l1);
        if (yb2 - ya < 0.01) continue;
        const full = band && ya <= ref + l0 + 1e-3 && yb2 >= ref + l1 - 1e-3;
        this.vrect(band && !full ? 'tile' : key, ax, fx, p, q, ya, yb2, nSign, band && full);
      }
    }
  }
  // ------------------------------------------------------------------------ lighting -----
  buildEnvMap() {
    const r = this.game.renderer, es = new THREE.Scene();
    const box = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 40), new THREE.MeshBasicMaterial({ color: 0x8c8f92, side: THREE.BackSide })); box.position.y = 3; es.add(box);
    const pm = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = -3; i <= 3; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.4), pm); p.rotation.x = Math.PI / 2; p.position.set(0, 5.9, i * 4); es.add(p); }
    const pmrem = new THREE.PMREMGenerator(r);
    this.envRT = pmrem.fromScene(es, 0.04, 0.1, 100);
    this.game.scene.environment = this.envRT.texture;
    pmrem.dispose();
    es.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
  updateLighting(snap, dt = 1 / 60) {
    const cam = this.game.camera.position, r = this.volumeAt(cam.x, cam.z, cam.y) || this.regionAt(cam.x, cam.z, false, cam.y);
    const target = r && r.street && cam.y > -1.5 ? 0 : 1;
    this.under = snap ? target : damp(this.under, target, 3, dt);
    const u = this.under, sc = this.game.scene;
    this.hemi.color.setRGB(lerp(0.78, 0.92, u), lerp(0.86, 0.95, u), lerp(0.98, 1.0, u));
    this.hemi.groundColor.setRGB(lerp(0.42, 0.42, u), lerp(0.4, 0.41, u), lerp(0.36, 0.42, u));
    this.hemi.intensity = lerp(1.0, 1.05, u);
    this.key.color.setRGB(lerp(1.0, 0.95, u), lerp(0.94, 0.98, u), lerp(0.84, 1.0, u));
    this.key.intensity = lerp(2.4, 1.15, u);
    this.fill.intensity = lerp(0.35, 0.12, u);
    const snapD = 2, tx = Math.round(cam.x / snapD) * snapD, tz = Math.round(cam.z / snapD) * snapD, ty = Math.round(cam.y / snapD) * snapD;
    this.key.target.position.set(tx, ty - 1.6, tz);
    this.key.position.set(tx + lerp(-18, -2, u), ty + 30, tz + lerp(14, 3, u));
    if (sc.background && sc.background.isColor) sc.background.copy(this.darkCol).lerp(this.skyCol, 1 - u);
    if (sc.fog) { sc.fog.color.copy(sc.background); sc.fog.near = lerp(90, 40, u); sc.fog.far = lerp(420, 160, u); }
  }
  // start of a frame (before AI and physics): trains move, carry what is aboard
  preStep(dt) {
    if (this.updateTrains) this.updateTrains(dt);
    if (this.game.transit) this.game.transit.update(dt);
  }
  update(dt, cam) {
    this.time += dt;
    this.updateLighting(0, dt);
    if (this.escTex) this.escTex.offset.y = (this.escTex.offset.y + dt * 0.5) % 1;
    if (this.oculusScreen) this.oculusScreen.material.color.setHSL((this.time * 0.02) % 1, 0.6, 0.55);
    for (const c of this.clocks) { c.t -= dt; if (c.t <= 0) { c.t = 2.5; this.drawClock(c); } }
    if (this.updateTrainVis) this.updateTrainVis();
  }
  dispose() {
    if (this.disposeTrains) this.disposeTrains();
    if (this.game.transit) this.game.transit.reset();
    this.game.scene.remove(this.group);
    disposeObject(this.group);
    for (const c of this.clocks) c.tex.dispose();
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
    this.game.scene.environment = null; this.game.scene.fog = null;
    this.group = new THREE.Group();
    try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (e) { }
  }
}
HT.SubwayEnvironment = SubwayEnvironment; HT.SubTex = SubTex;
