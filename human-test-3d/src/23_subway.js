// ============================================================================
// ATLANTIC AV–BARCLAYS CENTER (Brooklyn) - a connected, multi-level subway map.
//   Street (y 0):   Atlantic Av, Flatbush Av, the arena plaza under the oculus
//                   canopy, the green-roofed entrance pavilion
//   Stairs + escalator down to the fare mezzanine (y -5.5): turnstiles,
//                   vending machines, booth
//   2 3 4 5 platform (y -10) to the south; a white-tiled passageway east to
//                   the B Q platform (y -9.5). Trains arrive, open their doors
//                   and leave on all four tracks.
// Collision model: walkable floor regions (one floor per x,z; sloped stairs),
// static AABB colliders (walls, slabs, columns, fixtures), kinematic trains.
// NPCs route between regions through their shared edges (portals).
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
      g.fillText(text, x + (lines && lines.length ? 14 : 0), H * 0.56);
    }, { clamp: true, aniso: 8 });
  },
  // a train car side: stainless steel, window band, door openings showing a lit interior
  carSide() {
    return Tex.make('sub-carside', 1024, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d9dde1'); gr.addColorStop(0.5, '#b9bec4'); gr.addColorStop(1, '#8e949b');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(70,75,80,0.35)'; g.lineWidth = 2;
      for (let y = 170; y < 246; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } // corrugation
      const doors = [0.13, 0.38, 0.62, 0.87];
      for (let i = 0; i < 6; i++) { // windows between the doors
        const x = 40 + i * 168; if (doors.some(d => Math.abs((x + 50) / w - d) < 0.07)) continue;
        g.fillStyle = '#1b2530'; g.fillRect(x, 52, 100, 80); g.fillStyle = 'rgba(220,235,245,0.22)'; g.fillRect(x + 6, 58, 40, 70);
      }
      for (const d of doors) { // doorway: the lit interior (ceiling glow, far windows, seats, pole, dark floor)
        const x = d * w - 46, gi = g.createLinearGradient(0, 36, 0, 242);
        gi.addColorStop(0, '#fbfbf2'); gi.addColorStop(0.18, '#b9bdb8'); gi.addColorStop(0.7, '#7d8580'); gi.addColorStop(1, '#2d3032');
        g.fillStyle = gi; g.fillRect(x, 36, 92, 206);
        g.fillStyle = '#26323c'; g.fillRect(x + 8, 70, 76, 52);            // far-side window
        g.fillStyle = '#3d5f8f'; g.fillRect(x, 156, 92, 18); g.fillStyle = '#2b4a72'; g.fillRect(x, 174, 92, 8); // seats
        g.fillStyle = '#d7dcdf'; g.fillRect(x + 43, 36, 6, 206);             // pole
        g.fillStyle = '#1e2124'; g.fillRect(x, 226, 92, 16);
      }
      g.fillStyle = '#7d1d22'; g.fillRect(0, 22, w, 6);
    });
  },
  doorPanel() {
    return Tex.make('sub-door', 128, 256, (g, w, h) => {
      g.fillStyle = '#c3c8cd'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1b2530'; g.fillRect(18, 30, w - 36, 90);
      g.fillStyle = 'rgba(220,235,245,0.25)'; g.fillRect(24, 36, 20, 78);
      g.strokeStyle = '#2b2f33'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    });
  }
};

// geometry batches: one merged mesh per material, UVs in world metres / texture size
class SubBatch {
  constructor() { this.P = []; this.N = []; this.U = []; this.I = []; }
  quad(o, U, V, tm, uOff = 0, vOff = 0) {
    const n = _sv3.crossVectors(U, V); const len = n.length(); if (len < 1e-9) return; n.multiplyScalar(1 / len);
    const lu = U.length(), lv = V.length(), uh = _sv1.copy(U).multiplyScalar(1 / lu), vh = _sv2.copy(V).multiplyScalar(1 / lv);
    const u0 = (o.x * uh.x + o.y * uh.y + o.z * uh.z) / tm + uOff, v0 = (o.x * vh.x + o.y * vh.y + o.z * vh.z) / tm + vOff;
    const b = this.P.length / 3;
    const pts = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const [a, c] of pts) {
      this.P.push(o.x + U.x * a + V.x * c, o.y + U.y * a + V.y * c, o.z + U.z * a + V.z * c);
      this.N.push(n.x, n.y, n.z);
      this.U.push(u0 + a * lu / tm, v0 + c * lv / tm);
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

class SubwayEnvironment {
  constructor(game) {
    this.game = game; this.kind = 'subway'; this.name = 'Atlantic Av–Barclays Ctr'; this.surface = 'hard';
    this.group = new THREE.Group(); this.group.name = 'subway';
    this.planes = [{ n: new V3(0, 1, 0), d: -40 }];
    this.regions = []; this.boxes = []; this.obstacles = []; this.spawnPoints = [];
    this.batches = new Map(); this.matDefs = {};
    this.reverb = 'room'; this.time = 0; this.under = 1;
  }
  // ---------------------------------------------------------------- regions -----
  // r: { id, x0, x1, z0, z1, y (floor) | slope: {axis, a, b, ya, yb}, ceil (absolute), walk, pit, street }
  region(r) {
    r.id = this.regions.length; r.open = { x0: [], x1: [], z0: [], z1: [] };
    if (r.slope) { const s = r.slope; r.floor = (x, z) => { const t = clamp(((s.axis === 'x' ? x : z) - s.a) / (s.b - s.a), 0, 1); return lerp(s.ya, s.yb, t); }; }
    else { const y = r.y; r.floor = () => y; }
    if (r.ceilRel != null) { const cr = r.ceilRel; r.ceilAt = (x, z) => r.floor(x, z) + cr; } else { const c = r.ceil; r.ceilAt = () => c; }
    this.regions.push(r); return r;
  }
  inR(r, x, z, e = 0) { return x >= r.x0 - e && x <= r.x1 + e && z >= r.z0 - e && z <= r.z1 + e; }
  linkRegions() {
    const R = this.regions;
    this.adj = R.map(() => []);
    for (const a of R) for (const b of R) {
      if (a === b) continue;
      const ox0 = Math.max(a.x0, b.x0), ox1 = Math.min(a.x1, b.x1), oz0 = Math.max(a.z0, b.z0), oz1 = Math.min(a.z1, b.z1);
      // floors must meet: walkways within a step of each other, platform edges over their tracks
      const mx = clamp((a.x0 + a.x1) / 2, Math.max(a.x0, b.x0), Math.min(a.x1, b.x1)), mz = clamp((a.z0 + a.z1) / 2, Math.max(a.z0, b.z0), Math.min(a.z1, b.z1));
      const df = Math.abs(a.floor(clamp(mx, a.x0, a.x1), clamp(mz, a.z0, a.z1)) - b.floor(clamp(mx, b.x0, b.x1), clamp(mz, b.z0, b.z1)));
      const connect = (a.walk && b.walk && df < 0.6) || ((a.pit || b.pit) && df < 2.2);
      if (!connect) continue;
      const sa = a.sealed || {}, sb = b.sealed || {};
      const cut = (side, lo, hi) => { const rr = (a.restrict && a.restrict[side]) || null; if (!rr) return [lo, hi]; let best = null; for (const [p, q] of rr) { const l = Math.max(lo, p), h = Math.min(hi, q); if (h - l > 0.4 && (!best || h - l > best[1] - best[0])) best = [l, h]; } return best || [0, -1]; };
      const lk = (side, lo, hi, mk) => { const [l, h] = cut(side, lo, hi); if (h - l <= 0.4) return; a.open[side].push([l, h]); if (a.walk && b.walk) { const e = mk(l, h); e.lanes = a.lanes && a.lanes[side]; this.adj[a.id].push(e); } };
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
    // spatial hash: 4 m cells -> regions
    this.rgrid = new Map();
    for (const r of R) for (let ix = Math.floor(r.x0 / 4); ix <= Math.floor(r.x1 / 4); ix++) for (let iz = Math.floor(r.z0 / 4); iz <= Math.floor(r.z1 / 4); iz++) {
      const k = ix * 4099 + iz; let l = this.rgrid.get(k); if (!l) this.rgrid.set(k, l = []); l.push(r);
    }
  }
  regionsAt(x, z) { return this.rgrid.get(Math.floor(x / 4) * 4099 + Math.floor(z / 4)) || []; }
  // the walkable (or pit) region containing x,z; walkable wins on shared edges
  regionAt(x, z, walkOnly) {
    let best = null;
    for (const r of this.regionsAt(x, z)) {
      if (!this.inR(r, x, z) || (walkOnly && !r.walk)) continue;
      if (!best || (r.walk && !best.walk) || (r.walk === best.walk && r.floor(x, z) > best.floor(x, z))) best = r;
    }
    return best;
  }
  nearestRegion(x, z, walkOnly) {
    let best = null, bd = 1e9;
    for (const r of this.regions) {
      if (walkOnly && !r.walk) continue;
      const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1), d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  // floor height. With y (physics), a floor only counts from above: bodies below it are inside a slab
  // or a wall, where the static boxes take over.
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
  groundHeight(x, z) { return this.floorAt(x, z); }
  groundNormal(x, z, out) {
    const r = this.regionAt(x, z);
    if (r && r.slope) { const s = r.slope, k = (s.yb - s.ya) / (s.b - s.a); return s.axis === 'x' ? out.set(-k, 1, 0).normalize() : out.set(0, 1, -k).normalize(); }
    return out.set(0, 1, 0);
  }
  // NPC roots: stay on walkable floor, slide along walls, pass through portals, avoid fixtures
  clampToBounds(p, m = 0) {
    let r = this.regionAt(p.x, p.z, true);
    if (!r) { r = this.nearestRegion(p.x, p.z, true); p.x = clamp(p.x, r.x0 + Math.min(m, (r.x1 - r.x0) / 2), r.x1 - Math.min(m, (r.x1 - r.x0) / 2)); p.z = clamp(p.z, r.z0 + Math.min(m, (r.z1 - r.z0) / 2), r.z1 - Math.min(m, (r.z1 - r.z0) / 2)); }
    const inOpen = (list, v) => { for (const [a, b] of list) if (v > a + m && v < b - m) return true; return false; };
    const mx = Math.min(m, (r.x1 - r.x0) / 2), mz = Math.min(m, (r.z1 - r.z0) / 2);
    if (p.x < r.x0 + mx && !inOpen(r.open.x0, p.z)) p.x = r.x0 + mx;
    if (p.x > r.x1 - mx && !inOpen(r.open.x1, p.z)) p.x = r.x1 - mx;
    if (p.z < r.z0 + mz && !inOpen(r.open.z0, p.x)) p.z = r.z0 + mz;
    if (p.z > r.z1 - mz && !inOpen(r.open.z1, p.x)) p.z = r.z1 - mz;
    // fixtures (columns, turnstiles, machines): push out of their footprints
    if (m > 0) for (const o of this.obstaclesNear(p.x, p.z)) {
      const ex = Math.max(o.x0 - m - p.x, 0, p.x - (o.x1 + m)), ez = Math.max(o.z0 - m - p.z, 0, p.z - (o.z1 + m));
      if (ex > 0 || ez > 0) continue;
      const dl = p.x - (o.x0 - m), dr = (o.x1 + m) - p.x, dn = p.z - (o.z0 - m), df = (o.z1 + m) - p.z, mn = Math.min(dl, dr, dn, df);
      if (mn === dl) p.x = o.x0 - m; else if (mn === dr) p.x = o.x1 + m; else if (mn === dn) p.z = o.z0 - m; else p.z = o.z1 + m;
    }
    return p;
  }
  obstaclesNear(x, z) { return this.ogrid.get(Math.floor(x / 4) * 4099 + Math.floor(z / 4)) || []; }
  // next point to steer to on the way to dest (through the portals between regions)
  navGoal(p, dest) {
    const a = this.regionAt(p.x, p.z, true), b = this.regionAt(dest.x, dest.z, true);
    if (!a || !b || a === b) return dest;
    const nx = this.hop[a.id][b.id]; if (nx < 0) return dest;
    const e = this.adj[a.id].find(q => q.to === nx); if (!e) return dest;
    const g = this._goal || (this._goal = new V3());
    g.copy(e.p);
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
    const here = this.regionAt(npc.root.pos.x, npc.root.pos.z, true) || this.nearestRegion(npc.root.pos.x, npc.root.pos.z, true);
    let r = here;
    if (Math.random() < 0.3 && this.adj[here.id].length) r = this.regions[this.adj[here.id][Math.floor(Math.random() * this.adj[here.id].length)].to];
    for (let i = 0; i < 8; i++) {
      const x = lerp(r.x0 + 0.8, r.x1 - 0.8, Math.random()), z = lerp(r.z0 + 0.8, r.z1 - 0.8, Math.random());
      if (Math.hypot(x - npc.root.pos.x, z - npc.root.pos.z) > 14 && r === here) continue;
      b.dest.set(x, r.floor(x, z), z); this.clampToBounds(b.dest, 0.6); return;
    }
    b.dest.set(lerp(r.x0, r.x1, 0.5), 0, lerp(r.z0, r.z1, 0.5)); this.clampToBounds(b.dest, 0.6);
  }
  // free-fly camera: inside the open volumes, under the ceilings, out of the walls
  constrainCamera(p, prev) {
    const ok = (x, z, y) => { const r = this.regionAt(x, z); if (!r) return false; return y < r.ceilAt(x, z) - 0.15 && y > r.floor(x, z) - 0.6; };
    if (!ok(p.x, p.z, p.y)) {
      if (ok(p.x, prev.z, p.y)) p.z = prev.z;
      else if (ok(prev.x, p.z, p.y)) p.x = prev.x;
      else if (ok(prev.x, prev.z, p.y)) { p.x = prev.x; p.z = prev.z; }
      else { p.x = prev.x; p.z = prev.z; if (!ok(p.x, p.z, p.y)) { const r = this.regionAt(p.x, p.z) || this.nearestRegion(p.x, p.z, true); p.x = clamp(p.x, r.x0 + 0.3, r.x1 - 0.3); p.z = clamp(p.z, r.z0 + 0.3, r.z1 - 0.3); } }
    }
    const r = this.regionAt(p.x, p.z) || this.nearestRegion(p.x, p.z, true);
    const f = r.floor(clamp(p.x, r.x0, r.x1), clamp(p.z, r.z0, r.z1)), c = r.ceilAt(p.x, p.z);
    p.y = clamp(p.y, f + 0.25, Math.max(f + 0.3, c - 0.2));
  }
  // ---------------------------------------------------------------- building helpers ----
  mat(key) {
    let b = this.batches.get(key); if (!b) { b = new SubBatch(); this.batches.set(key, b); } return b;
  }
  // axis-aligned box: faces into material batches (mk = key or {px,nx,py,ny,pz,nz}), optional collider
  box(mk, x0, y0, z0, x1, y1, z1, o = {}) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, key = (f) => typeof mk === 'string' ? mk : (mk[f] || mk.all);
    const tm = (k) => (this.matDefs[k] || { tm: 1 }).tm;
    const skip = o.skip || '';
    const F = (f, oo, U, V) => { if (skip.indexOf(f) >= 0) return; const k = key(f); if (!k) return; this.mat(k).quad(oo, U, V, tm(k)); };
    F('px', new V3(x1, y0, z1), new V3(0, 0, -dz), new V3(0, dy, 0));
    F('nx', new V3(x0, y0, z0), new V3(0, 0, dz), new V3(0, dy, 0));
    F('pz', new V3(x0, y0, z1), new V3(dx, 0, 0), new V3(0, dy, 0));
    F('nz', new V3(x1, y0, z0), new V3(-dx, 0, 0), new V3(0, dy, 0));
    F('py', new V3(x0, y1, z1), new V3(dx, 0, 0), new V3(0, 0, -dz));
    F('ny', new V3(x0, y0, z0), new V3(dx, 0, 0), new V3(0, 0, dz));
    if (o.collide !== false && o.collide) this.collider(x0, y0, z0, x1, y1, z1);
    if (o.obstacle) this.obstacles.push({ x0, x1, z0, z1 });
  }
  collider(x0, y0, z0, x1, y1, z1) { this.boxes.push({ min: new V3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)), max: new V3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)) }); }
  // flat sign / panel facing +n (axis-aligned), with its own texture
  panel(tex, cx, cy, cz, w, h, face, o = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), o.mat || new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0, emissive: o.glow ? 0xffffff : 0x000000, emissiveMap: o.glow ? tex : null, emissiveIntensity: o.glow || 0 }));
    m.position.set(cx, cy, cz);
    m.rotation.y = face === 'px' ? Math.PI / 2 : face === 'nx' ? -Math.PI / 2 : face === 'nz' ? Math.PI : 0;
    if (o.ry != null) m.rotation.y = o.ry;
    this.group.add(m);
    return m;
  }
  // --------------------------------------------------------------------------- build -----
  build() {
    const g = this.game, Y = { street: 0, mezz: -5.5, irt: -10, bmt: -9.5, irtPit: -11.1, bmtPit: -10.6 };
    this.Y = Y;
    // ---- materials (tm = texture size in metres)
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0 }, o));
    const def = (key, tm, mat) => { this.matDefs[key] = { tm, mat }; };
    def('tile', 1, std({ map: SubTex.tile(), roughness: 0.28, envMapIntensity: 0.6 }));
    def('tileBand', 1, std({ map: SubTex.tile('band', [52, 120, 116], 10), roughness: 0.3 }));
    def('tileCream', 1, std({ map: SubTex.tile('cream', [228, 218, 196], 10), roughness: 0.3 }));
    def('terrazzo', 2, std({ map: SubTex.terrazzo(), roughness: 0.32, envMapIntensity: 0.7 }));
    def('concrete', 2, std({ map: SubTex.concrete('c', 160), roughness: 0.9 }));
    def('ceiling', 2, std({ map: SubTex.concrete('ceil', 120), roughness: 0.95 }));
    def('green', 1, std({ color: 0x2f6b4c, roughness: 0.45, metalness: 0.25 }));
    def('glassBlock', 1, std({ map: SubTex.glassBlock(), roughness: 0.2, emissive: 0xffffff, emissiveMap: SubTex.glassBlock(), emissiveIntensity: 0.32 }));
    def('tactile', 0.6, std({ map: SubTex.tactile(), roughness: 0.55 }));
    def('edge', 1, std({ color: 0xd9d6cf, roughness: 0.5 }));
    def('ballast', 2, std({ map: SubTex.ballast(), roughness: 0.95 }));
    def('rail', 1, std({ color: 0x8c8f93, roughness: 0.3, metalness: 0.7 }));
    def('tie', 1, std({ color: 0x2b2420, roughness: 0.9 }));
    def('dark', 1, std({ color: 0x0d0e10, roughness: 0.95 }));
    def('steel', 1, std({ color: 0xb8bec4, roughness: 0.3, metalness: 0.65 }));
    def('machine', 1, std({ color: 0x29323d, roughness: 0.4, metalness: 0.3 }));
    def('booth', 1, std({ color: 0x3d4a3f, roughness: 0.5, metalness: 0.2 }));
    def('light', 1, new THREE.MeshBasicMaterial({ color: 0xf4f8ff }));
    def('asphalt', 8, std({ map: SubTex.asphalt(), roughness: 0.92 }));
    def('pavers', 2, std({ map: SubTex.pavers(), roughness: 0.85 }));
    def('curb', 1, std({ color: 0x9a978f, roughness: 0.8 }));
    def('paint', 1, std({ color: 0xf2f0e8, roughness: 0.7 }));
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
    def('escal', 0.4, std({ color: 0x6e7378, roughness: 0.35, metalness: 0.6 }));

    // ---- regions --------------------------------------------------------------------------
    const R = (o) => this.region(o);
    // street
    const S = { y: 0, ceil: 60, walk: true, street: true };
    this.rAtl = R(Object.assign({ name: 'Atlantic Av', x0: -10, x1: 110, z0: 16, z1: 40 }, S));
    this.rFlat = R(Object.assign({ name: 'Flatbush Av', x0: 24, x1: 40, z0: -50, z1: 16 }, S));
    this.rPlazaW = R(Object.assign({ name: 'Arena Plaza', x0: 40, x1: 54, z0: -10, z1: 16 }, S));
    this.rPlazaN = R(Object.assign({ name: 'Arena Plaza', x0: 54, x1: 60, z0: 4, z1: 16 }, S));
    this.rPlazaE = R(Object.assign({ name: 'Arena Plaza', x0: 60, x1: 74, z0: -10, z1: 16 }, S));
    // entrance stairs (with an escalator lane) down to the mezzanine
    this.rStairE = R({ name: 'Entrance Stairs', x0: 54, x1: 60, z0: -12, z1: 4, slope: { axis: 'z', a: -12, b: 4, ya: Y.mezz, yb: 0 }, ceilRel: 3.6, walk: true, sealed: { x0: 1, x1: 1 }, noWalls: true });
    { const r = this.rStairE; r.ceilAt = (x, z) => z > -10 ? 3.3 : r.floor(x, z) + 3.6; r.ceilZ = [-12, -10]; } // open to the pavilion roof above the plaza
    // the fare line splits the mezzanine: you pass through the turnstiles (the gaps between the stiles)
    const lanes = []; for (let k = 0; k < 24; k++) lanes.push(44.5 + k * 1.25 + 0.625);   // gaps between the stiles
    this.rMezzFree = R({ name: 'Mezzanine', x0: 40, x1: 84, z0: -24, z1: -12, y: Y.mezz, ceil: Y.mezz + 3.9, walk: true, restrict: { z0: [[44.4, 75.6]] }, lanes: { z0: lanes }, noWallSide: { z0: 1 } });
    this.rMezz = R({ name: 'Mezzanine (paid)', x0: 40, x1: 84, z0: -40, z1: -24, y: Y.mezz, ceil: Y.mezz + 3.9, walk: true, restrict: { z1: [[44.4, 75.6]] }, lanes: { z1: lanes }, noWallSide: { z1: 1 } });
    this.rStairS = R({ name: 'Stairs to 2 3 4 5', x0: 56, x1: 62, z0: -52, z1: -40, slope: { axis: 'z', a: -52, b: -40, ya: Y.irt, yb: Y.mezz }, ceilRel: 3.3, walk: true });
    this.rIrt = R({ name: '2 3 4 5 Platform', x0: 24, x1: 96, z0: -60, z1: -52, y: Y.irt, ceil: Y.irt + 4.6, walk: true });
    this.rIrtPit = R({ name: '2 3 4 5 Tracks', x0: -60, x1: 120, z0: -74, z1: -60, y: Y.irtPit, ceil: Y.irt + 4.6, pit: true });
    this.rPass = R({ name: 'Passageway', x0: 84, x1: 112, z0: -30, z1: -24, y: Y.mezz, ceil: Y.mezz + 3.0, walk: true });
    this.rStairB = R({ name: 'Stairs to B Q', x0: 112, x1: 124, z0: -30, z1: -24, slope: { axis: 'x', a: 124, b: 112, ya: Y.bmt, yb: Y.mezz }, ceilRel: 3.2, walk: true });
    this.rBmt = R({ name: 'B Q Platform', x0: 124, x1: 132, z0: -63, z1: 9, y: Y.bmt, ceil: Y.bmt + 4.8, walk: true });
    this.rBmtPit = R({ name: 'B Q Tracks', x0: 132, x1: 146, z0: -130, z1: 80, y: Y.bmtPit, ceil: Y.bmt + 4.8, pit: true });
    this.linkRegions();
    this.bounds = { minX: -10, maxX: 146, minZ: -74, maxZ: 40 };

    this.buildStreet(Y);
    this.buildStation(Y);
    this.buildWalls();
    this.buildTrains(Y);

    // ---- merge batches into meshes
    for (const [key, b] of this.batches) {
      const d = this.matDefs[key]; if (!d) continue;
      const m = new THREE.Mesh(b.geometry(), d.mat);
      m.receiveShadow = true; m.castShadow = !!(d.mat.userData && d.mat.userData.cast); m.name = 'sub-' + key;
      this.group.add(m);
    }
    // ---- colliders / obstacle grid
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
    // ---- spawn points & camera start
    this.spawnPoints = [new V3(60, 0, -56), new V3(48, 0, -56), new V3(72, 0, -56), new V3(36, 0, -55), new V3(84, 0, -57),
      new V3(60, 0, -30), new V3(50, 0, -18), new V3(70, 0, -34), new V3(128, 0, -20), new V3(128, 0, -40), new V3(50, 0, 6), new V3(66, 0, 10)];
    for (const p of this.spawnPoints) p.y = this.floorAt(p.x, p.z);
    this.cameraStart = { pos: new V3(34, Y.irt + 1.7, -53.4), yaw: -Math.PI / 2 - 0.3, pitch: -0.05 };
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
    // curbs
    for (const [x0, z0, x1, z1] of [[-10, 19.85, 27, 20.15], [37, 19.85, 110, 20.15], [-10, 35.85, 110, 36.15], [26.85, -50, 27.15, 20], [36.85, -50, 37.15, 20]]) b('curb', x0, -0.05, z0, x1, 0.06, z1, { skip: 'ny' });
    // lane markings: double yellow centre lines, white lane dashes, crosswalks
    const mk = (k, x0, z0, x1, z1) => b(k, x0, 0.004, z0, x1, 0.008, z1, { skip: 'nxpxnzpzny' });
    mk('paintY', -10, 27.85, 27, 27.97); mk('paintY', -10, 28.03, 27, 28.15); mk('paintY', 37, 27.85, 110, 27.97); mk('paintY', 37, 28.03, 110, 28.15);
    mk('paintY', 31.85, -50, 31.97, 20); mk('paintY', 32.03, -50, 32.15, 20);
    for (let x = -8; x < 108; x += 6) { if (x > 22 && x < 40) continue; mk('paint', x, 23.9, x + 3, 24.05); mk('paint', x, 31.9, x + 3, 32.05); }
    for (let z = -48; z < 14; z += 6) { mk('paint', 29.4, z, 29.55, z + 3); mk('paint', 34.4, z, 34.55, z + 3); }
    for (let i = 0; i < 9; i++) { mk('paint', 21 + 0.1, 20.5 + i * 1.7, 24.4, 21.4 + i * 1.7); mk('paint', 40.6, 20.5 + i * 1.7, 43.9, 21.4 + i * 1.7); } // crosswalks over Atlantic
    for (let i = 0; i < 5; i++) { mk('paint', 27.6 + i * 1.95, 11.6, 28.6 + i * 1.95, 14.8); mk('paint', 27.6 + i * 1.95, -6.8, 28.6 + i * 1.95, -3.6); } // over Flatbush
    // buildings around the intersection (facades are colliders)
    const bld = (k, x0, z0, x1, z1, h) => b(k, x0, 0, z0, x1, h, z1, { collide: true, skip: 'ny' });
    bld('brickA', -10, 40, 22, 52, 18); bld('brickB', 22, 40, 52, 52, 26); bld('brickC', 52, 40, 82, 52, 14); bld('brickA', 82, 40, 110, 52, 22);
    bld('brickB', -22, 16, -10, 40, 16); bld('brickC', 110, 16, 122, 40, 20);
    bld('brickC', 12, -50, 24, 16, 15); bld('brickB', 0, -50, 12, 16, 20);
    bld('brickA', 12, -62, 40, -50, 16);
    // ---- the arena: weathered-steel bands over a glass base, wrapping the plaza
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
    // ---- the entrance pavilion: glass walls, a sloping green roof, the station sign
    const pv = { x0: 53.6, x1: 60.4, z0: -12, z1: 4 };
    b('glass', pv.x0 - 0.2, 0, -10, pv.x0, 3.4, 4, { collide: true }); b('glass', pv.x1, 0, -10, pv.x1 + 0.2, 3.4, 4, { collide: true });
    b({ all: 'pole', py: 'roof' }, pv.x0 - 0.6, 3.4, -11, pv.x1 + 0.6, 3.8, 5.5, {});
    const pvSign = SubTex.sign('pavilion', 'Atlantic Av–Barclays Ctr', ['2', '3', '4', '5', 'B', 'D', 'N', 'Q', 'R'], { w: 2048, h: 128 });
    this.panel(pvSign, 57, 3.6, 5.52, 7.6, 0.45, 'pz');
    for (const x of [52.6, 61.4]) { // subway globes on posts
      b('pole', x - 0.06, 0, 5.4, x + 0.06, 2.6, 5.52, { collide: true, obstacle: true });
      const gl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0x3fbf60, emissive: 0x2a9a40, emissiveIntensity: 0.9, roughness: 0.3 }));
      gl.position.set(x, 2.8, 5.46); this.group.add(gl);
    }
    // street lights, a corner street-name sign, traffic lights
    const lamp = (x, z) => { b('pole', x - 0.08, 0, z - 0.08, x + 0.08, 7.2, z + 0.08, { collide: true, obstacle: true }); b('pole', x - 0.08, 7.1, z - 0.08, x + 1.6, 7.25, z + 0.08); b('light', x + 1.2, 6.98, z - 0.18, x + 1.7, 7.1, z + 0.18, { skip: 'py' }); };
    for (let x = -4; x < 108; x += 16) { lamp(x, 17.2); lamp(x + 8, 38.6); }
    for (let z = -54; z < 14; z += 16) { lamp(25.2, z); }
    b('pole', 38.6, 0, 18.4, 38.8, 4.2, 18.6, { collide: true, obstacle: true });
    this.panel(SubTex.sign('stA', 'Atlantic Av', null, { w: 512, h: 96, bg: '#0f6b3a', noStripe: true, size: 0.6 }), 38.7, 4.0, 18.72, 1.6, 0.3, 'pz');
    this.panel(SubTex.sign('stF', 'Flatbush Av', null, { w: 512, h: 96, bg: '#0f6b3a', noStripe: true, size: 0.6 }), 38.92, 3.65, 18.5, 1.6, 0.3, 'px');
    // traffic signals (dark box, lit lamps)
    for (const [x, z, f] of [[38.3, 21.5, 'nx'], [25.7, 34.5, 'px']]) {
      b('pole', x - 0.08, 0, z - 0.08, x + 0.08, 5, z + 0.08, { collide: true, obstacle: true });
      b('rubber', x - 0.22, 3.6, z - 0.22, x + 0.22, 4.8, z + 0.22);
      const lt = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial({ color: 0x40ff70 }));
      lt.position.set(x + (f === 'px' ? 0.23 : -0.23), 3.85, z); lt.rotation.y = f === 'px' ? Math.PI / 2 : -Math.PI / 2; this.group.add(lt);
    }
    // a few parked cars along Atlantic (simple, solid)

  }
  // ------------------------------------------------------------------------ station ------
  buildStation(Y) {
    const b = (k, x0, y0, z0, x1, y1, z1, o) => this.box(k, x0, y0, z0, x1, y1, z1, o);
    const g = this.group;
    // ---- floors
    const floor = (r, k) => { if (r.slope) return; b(k, r.x0, r.y - 0.4, r.z0, r.x1, r.y, r.z1, { skip: 'nxpxnzpzny' }); };
    floor(this.rMezz, 'terrazzo'); floor(this.rMezzFree, 'terrazzo'); floor(this.rPass, 'terrazzo'); floor(this.rIrt, 'terrazzo'); floor(this.rBmt, 'terrazzo');
    // platform slabs (solid sides toward the tracks) + yellow tactile edge strip
    const irt = this.rIrt, bmt = this.rBmt;
    b({ all: 'concrete', py: null }, irt.x0, Y.irtPit, irt.z0, irt.x1, Y.irt, irt.z1, { collide: true });
    b('edge', irt.x0, Y.irt, irt.z0, irt.x1, Y.irt + 0.012, irt.z0 + 0.3, { skip: 'ny' }); b('tactile', irt.x0, Y.irt, irt.z0 + 0.3, irt.x1, Y.irt + 0.01, irt.z0 + 0.91, { skip: 'ny' });
    b({ all: 'concrete', py: null }, bmt.x0, Y.bmtPit, bmt.z0, bmt.x1, Y.bmt, bmt.z1, { collide: true });
    b('edge', bmt.x1 - 0.3, Y.bmt, bmt.z0, bmt.x1, Y.bmt + 0.012, bmt.z1, { skip: 'ny' }); b('tactile', bmt.x1 - 0.91, Y.bmt, bmt.z0, bmt.x1 - 0.3, Y.bmt + 0.01, bmt.z1, { skip: 'ny' });
    // ---- stairs: treads + risers over the ramp; escalator lane on the entrance stair
    const stairs = (r, k, axis, lane) => {
      const s = r.slope, n = Math.max(6, Math.round(Math.abs(s.yb - s.ya) / 0.18)), L = s.b - s.a;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n, ya = lerp(s.ya, s.yb, t0), yb = lerp(s.ya, s.yb, t1), c0 = s.a + L * t0, c1 = s.a + L * t1;
        const top = Math.max(ya, yb);
        if (axis === 'z') b(k, r.x0 + (lane ? 0 : 0), top - 0.18, Math.min(c0, c1), lane ? r.x1 - lane : r.x1, top, Math.max(c0, c1), { skip: 'nxpxny' });
        else b(k, Math.min(c0, c1), top - 0.18, r.z0, Math.max(c0, c1), top, r.z1, { skip: 'nzpzny' });
      }
    };
    stairs(this.rStairE, 'terrazzo', 'z', 1.9); stairs(this.rStairS, 'terrazzo', 'z'); stairs(this.rStairB, 'terrazzo', 'x');
    // escalator lane (moving steps texture scrolls in update) with balustrades
    { const r = this.rStairE, s = r.slope, x0 = r.x1 - 1.8, x1 = r.x1 - 0.1;
      const geo = new THREE.PlaneGeometry(x1 - x0, Math.hypot(s.b - s.a, s.yb - s.ya), 1, 1);
      const tex = Tex.make('sub-escal', 64, 256, (gg, w, h) => { gg.fillStyle = '#4a4e52'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#8d9297'; for (let y = 0; y < h; y += 16) gg.fillRect(0, y, w, 4); gg.fillStyle = '#e0b52a'; gg.fillRect(0, 0, 4, h); gg.fillRect(w - 4, 0, 4, h); });
      tex.repeat.set(1, 16); this.escTex = tex;
      const em = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.5 }));
      const ang = Math.atan2(s.yb - s.ya, s.b - s.a);
      em.rotation.x = -Math.PI / 2 - ang;
      em.position.set((x0 + x1) / 2, (s.ya + s.yb) / 2 + 0.03, (s.a + s.b) / 2); g.add(em);
      for (const x of [x0 - 0.1, x1]) {
        const bal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, Math.hypot(s.b - s.a, s.yb - s.ya)), this.matDefs.steel.mat);
        bal.rotation.x = -ang; bal.position.set(x + 0.05, (s.ya + s.yb) / 2 + 0.5, (s.a + s.b) / 2); g.add(bal);
        const hr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, Math.hypot(s.b - s.a, s.yb - s.ya)), this.matDefs.rubber.mat);
        hr.rotation.x = -ang; hr.position.set(x + 0.05, (s.ya + s.yb) / 2 + 1.04, (s.a + s.b) / 2); g.add(hr);
      }
      this.obstacles.push({ x0: x0 - 0.15, x1: x0 + 0.05, z0: s.a + 1, z1: s.b - 1 });
    }
    // ---- ceilings with fluorescent strips; ceiling slabs are colliders
    const ceil = (r, spacing, along) => {
      if (r.slope) {
        const s = r.slope, n = 8;
        for (let i = 0; i < n; i++) { let t0 = i / n, t1 = (i + 1) / n, c0 = s.a + (s.b - s.a) * t0, c1 = s.a + (s.b - s.a) * t1, y = Math.max(lerp(s.ya, s.yb, t0), lerp(s.ya, s.yb, t1)) + r.ceilRel;
          if (r.ceilZ) { const lo = Math.max(Math.min(c0, c1), r.ceilZ[0]), hi = Math.min(Math.max(c0, c1), r.ceilZ[1]); if (hi <= lo) continue; c0 = lo; c1 = hi; y = r.floor(0, hi) + r.ceilRel; }
          if (s.axis === 'z') b('ceiling', r.x0 - 0.3, y, Math.min(c0, c1), r.x1 + 0.3, y + 0.3, Math.max(c0, c1), { collide: true }); else b('ceiling', Math.min(c0, c1), y, r.z0 - 0.3, Math.max(c0, c1), y + 0.3, r.z1 + 0.3, { collide: true }); }
        return;
      }
      const y = r.ceil;
      b({ all: 'ceiling' }, r.x0 - 0.3, y, r.z0 - 0.3, r.x1 + 0.3, y + 0.3, r.z1 + 0.3, { collide: true });
      if (along === 'x') for (let z = r.z0 + spacing / 2; z < r.z1; z += spacing) for (let x = r.x0 + 1.5; x < r.x1 - 1.5; x += 3.2) b('light', x, y - 0.08, z - 0.09, x + 2.4, y, z + 0.09, { skip: 'py' });
      else for (let x = r.x0 + spacing / 2; x < r.x1; x += spacing) for (let z = r.z0 + 1.5; z < r.z1 - 1.5; z += 3.2) b('light', x - 0.09, y - 0.08, z, x + 0.09, y, z + 2.4, { skip: 'py' });
    };
    ceil(this.rMezz, 4, 'x'); ceil(this.rMezzFree, 4, 'x'); ceil(this.rPass, 3, 'x'); ceil(this.rIrt, 3.2, 'x'); ceil(this.rBmt, 3.2, 'z');
    ceil(this.rStairE); ceil(this.rStairS); ceil(this.rStairB);
    b('ceiling', this.rIrtPit.x0, this.rIrtPit.ceil, this.rIrtPit.z0, this.rIrtPit.x1, this.rIrtPit.ceil + 0.3, this.rIrtPit.z1, { collide: true });
    b('ceiling', this.rBmtPit.x0, this.rBmtPit.ceil, this.rBmtPit.z0, this.rBmtPit.x1, this.rBmtPit.ceil + 0.3, this.rBmtPit.z1, { collide: true });
    // ---- track beds, rails, ties, third rail; columns between the tracks
    const tracks = (pit, axis, centers, y) => {
      if (axis === 'x') b('ballast', pit.x0, y - 0.3, pit.z0, pit.x1, y, pit.z1, { skip: 'nxpxnzpzny' });
      else b('ballast', pit.x0, y - 0.3, pit.z0, pit.x1, y, pit.z1, { skip: 'nxpxnzpzny' });
      for (const c of centers) {
        for (const off of [-0.72, 0.72]) {
          if (axis === 'x') b('rail', pit.x0, y + 0.16, c + off - 0.04, pit.x1, y + 0.32, c + off + 0.04, { skip: 'nxpxny' });
          else b('rail', c + off - 0.04, y + 0.16, pit.z0, c + off + 0.04, y + 0.32, pit.z1, { skip: 'nzpzny' });
        }
        const L0 = axis === 'x' ? pit.x0 : pit.z0, L1 = axis === 'x' ? pit.x1 : pit.z1;
        for (let t = L0 + 0.3; t < L1; t += 0.75) {
          if (axis === 'x') b('tie', t, y + 0.02, c - 1.25, t + 0.22, y + 0.16, c + 1.25, { skip: 'ny' }); else b('tie', c - 1.25, y + 0.02, t, c + 1.25, y + 0.16, t + 0.22, { skip: 'ny' });
        }
        // third rail with its wooden cover board, on the far side of each track
        if (axis === 'x') b('tie', pit.x0, y + 0.2, c - 1.55, pit.x1, y + 0.46, c - 1.38, { skip: 'nxpxny' }); else b('tie', c + 1.38, y + 0.2, pit.z0, c + 1.55, y + 0.46, pit.z1, { skip: 'nzpzny' });
      }
    };
    tracks(this.rIrtPit, 'x', [-63.5, -70.5], Y.irtPit); tracks(this.rBmtPit, 'z', [135.5, 142.5], Y.bmtPit);
    this.irtTracks = [-63.5, -70.5]; this.bmtTracks = [135.5, 142.5];
    for (let x = this.rIrt.x0; x <= this.rIrt.x1; x += 4.5) b('green', x - 0.17, Y.irtPit, -67.17, x + 0.17, Y.irt + 4.6, -66.83, { collide: true });
    for (let z = this.rBmt.z0; z <= this.rBmt.z1; z += 4.5) b('green', 138.83, Y.bmtPit, z - 0.17, 139.17, Y.bmt + 4.8, z + 0.17, { collide: true });
    // platform columns (green steel) and benches
    for (let x = this.rIrt.x0 + 4; x < this.rIrt.x1 - 2; x += 6) b('green', x - 0.18, Y.irt, -55.18, x + 0.18, Y.irt + 4.6, -54.82, { collide: true, obstacle: true });
    for (let z = this.rBmt.z0 + 4; z < this.rBmt.z1 - 2; z += 6) b('green', 128.82, Y.bmt, z - 0.18, 129.18, Y.bmt + 4.8, z + 0.18, { collide: true, obstacle: true });
    for (let x = this.rIrt.x0 + 7; x < this.rIrt.x1 - 4; x += 12) { b('booth', x - 1.1, Y.irt + 0.42, -52.75, x + 1.1, Y.irt + 0.5, -52.3, { collide: true, obstacle: true }); b('steel', x - 1.0, Y.irt, -52.6, x - 0.9, Y.irt + 0.42, -52.4); b('steel', x + 0.9, Y.irt, -52.6, x + 1.0, Y.irt + 0.42, -52.4); }
    // mezzanine columns
    for (let x = 44; x <= 78; x += 8) for (const z of [-18, -32]) b('green', x - 0.2, Y.mezz, z - 0.2, x + 0.2, Y.mezz + 3.9, z + 0.2, { collide: true, obstacle: true });
    // ---- turnstiles: a line of stainless stiles with passage gaps, an emergency gate, the booth
    for (let x = 44.5; x <= 75.5; x += 1.25) {
      b('steel', x - 0.16, Y.mezz, -24.45, x + 0.16, Y.mezz + 1.0, -23.55, { collide: true, obstacle: true });
      b('machine', x - 0.12, Y.mezz + 1.0, -24.2, x + 0.12, Y.mezz + 1.06, -23.8);
      b('steel', x + 0.16, Y.mezz + 0.82, -24.06, x + 0.62, Y.mezz + 0.86, -24.02); // arm
    }
    b('steel', 40, Y.mezz, -24.1, 44.2, Y.mezz + 1.1, -23.9, { collide: true, obstacle: true }); b('steel', 76, Y.mezz, -24.1, 84, Y.mezz + 1.1, -23.9, { collide: true, obstacle: true });
    b({ all: 'glass', py: 'booth', ny: 'booth' }, 40.3, Y.mezz, -30, 43.6, Y.mezz + 2.6, -25.2, { collide: true, obstacle: true });
    // vending machines on the north wall, either side of the stairs
    for (const x of [40, 42.2, 44.4, 66.5, 68.7, 70.9]) {
      b('machine', x - 0.95, Y.mezz, -12.75, x + 0.95, Y.mezz + 1.9, -12.0, { collide: true, obstacle: true });
      b('screen', x - 0.45, Y.mezz + 1.05, -12.77, x + 0.15, Y.mezz + 1.5, -12.74, { skip: 'nxpxnzpyny' });
      b('paintY', x + 0.35, Y.mezz + 0.9, -12.77, x + 0.7, Y.mezz + 1.25, -12.74, { skip: 'nxpxnzpyny' });
    }
    // ---- signs
    const name = SubTex.sign('name', 'Atlantic Av–Barclays Ctr', null, { w: 1024, h: 128 });
    const irtS = SubTex.sign('irt', 'Atlantic Av–Barclays Ctr', ['2', '3', '4', '5'], { w: 1536, h: 128 });
    const bmtS = SubTex.sign('bmt', 'Atlantic Av–Barclays Ctr', ['B', 'Q'], { w: 1536, h: 128 });
    for (let x = this.rIrt.x0 + 8; x < this.rIrt.x1 - 4; x += 18) { this.panel(irtS, x, Y.irt + 3.4, -55.0 + 0.2, 4.6, 0.38, 'pz'); this.panel(irtS, x, Y.irt + 3.4, -55.0 - 0.2, 4.6, 0.38, 'nz'); }
    for (let z = this.rBmt.z0 + 8; z < this.rBmt.z1 - 4; z += 18) { this.panel(bmtS, 129.0 + 0.2, Y.bmt + 3.5, z, 4.6, 0.38, 'px'); this.panel(bmtS, 129.0 - 0.2, Y.bmt + 3.5, z, 4.6, 0.38, 'nx'); }
    this.panel(SubTex.sign('down2345', 'Downtown & Brooklyn  ↓', ['2', '3', '4', '5'], { w: 1536, h: 128 }), 59, Y.mezz + 3.2, -39.6, 5, 0.42, 'pz');
    this.panel(SubTex.sign('toBQ', 'Tracks 5 & 6 · LIRR  →', ['B', 'Q'], { w: 1536, h: 128 }), 83.6, Y.mezz + 2.6, -27, 5, 0.42, 'nx');
    this.panel(SubTex.sign('exit', 'Exit · Atlantic Av · Flatbush Av · Barclays Center  ↑', null, { w: 2048, h: 128, size: 0.36 }), 57, Y.mezz + 3.3, -12.2, 6, 0.38, 'nz');
    this.panel(SubTex.sign('pBQ', 'B Q  Manhattan  ·  LIRR Tracks 5 & 6', ['B', 'Q'], { w: 2048, h: 128, size: 0.36 }), 98, Y.mezz + 2.6, -24.25, 6, 0.38, 'nz');
    this.panel(SubTex.sign('pBQ2', 'B Q  Manhattan  ·  LIRR Tracks 5 & 6', ['B', 'Q'], { w: 2048, h: 128, size: 0.36 }), 98, Y.mezz + 2.6, -29.75, 6, 0.38, 'pz');
    this.panel(name, 60, Y.mezz + 3.2, -39.75, 4.4, 0.36, 'pz');
    // art panels along the passageway (abstract colour fields)
    const art = (k, cols) => Tex.make('sub-art-' + k, 256, 256, (gg, w, h) => { for (let i = 0; i < 40; i++) { gg.fillStyle = cols[i % cols.length]; const x = Math.random() * w, y = Math.random() * h; gg.fillRect(x, y, 20 + Math.random() * 110, 20 + Math.random() * 110); } gg.strokeStyle = '#222'; gg.lineWidth = 10; gg.strokeRect(0, 0, w, h); });
    const arts = [art('a', ['#c0392b', '#f1c40f', '#2c3e50', '#ecf0f1']), art('b', ['#16a085', '#e67e22', '#34495e', '#fdfefe']), art('c', ['#8e44ad', '#f39c12', '#1abc9c', '#2c2c2c'])];
    for (let i = 0; i < 4; i++) { const x = 88 + i * 6.5; this.panel(arts[i % 3], x, Y.mezz + 1.6, -24.25, 2.2, 1.6, 'nz'); this.panel(arts[(i + 1) % 3], x + 3, Y.mezz + 1.6, -29.75, 2.2, 1.6, 'pz'); }
  }
  // walls along every region edge that is not open to a neighbour (tiled below, bands, concrete above)
  buildWalls() {
    const b = (k, x0, y0, z0, x1, y1, z1, o) => this.box(k, x0, y0, z0, x1, y1, z1, o);
    const T = 0.3;
    const gaps = (lo, hi, open) => { let segs = [[lo, hi]]; for (const [a, c] of open) { const nx = []; for (const [s, e] of segs) { if (c <= s || a >= e) { nx.push([s, e]); continue; } if (a > s) nx.push([s, a]); if (c < e) nx.push([c, e]); } segs = nx; } return segs.filter(([s, e]) => e - s > 0.05); };
    for (const r of this.regions) {
      if (r.street || r.noWalls) continue;
      const lowY = (x, z) => r.floor(x, z);
      const wall = (x0, z0, x1, z1, side) => {
        const yb = Math.min(lowY(x0, z0), lowY(x1, z1)) - (r.pit ? 0.1 : 0.2), ytop = Math.max(r.ceilAt(x0, z0), r.ceilAt(x1, z1)) + 0.3;
        const tile = r.pit ? 'tile' : (r === this.rIrt ? 'tile' : (r === this.rPass ? 'tile' : 'tileCream'));
        const kInner = { all: 'concrete' }; kInner[side] = tile;
        b(kInner, x0, yb, z0, x1, ytop, z1, { collide: true });
        if (!r.pit && !r.slope) { // coloured tile band at frieze height on the visible face
          const yb2 = r.floor(x0, z0) + 2.55, e = 0.012;
          const kb = { all: null }; kb[side] = 'tileBand';
          const o = side === 'px' ? [x1, x1 + e] : side === 'nx' ? [x0 - e, x0] : null, q = side === 'pz' ? [z1, z1 + e] : side === 'nz' ? [z0 - e, z0] : null;
          b(kb, o ? o[0] : x0, yb2, q ? q[0] : z0, o ? o[1] : x1, yb2 + 0.32, q ? q[1] : z1);
        }
      };
      const nw = r.noWallSide || {};
      if (!nw.x0) for (const [a, c] of gaps(r.z0, r.z1, r.open.x0)) wall(r.x0 - T, a, r.x0, c, 'px');
      if (!nw.x1) for (const [a, c] of gaps(r.z0, r.z1, r.open.x1)) wall(r.x1, a, r.x1 + T, c, 'nx');
      if (!nw.z0) for (const [a, c] of gaps(r.x0, r.x1, r.open.z0)) wall(a, r.z0 - T, c, r.z0, 'pz');
      if (!nw.z1) for (const [a, c] of gaps(r.x0, r.x1, r.open.z1)) wall(a, r.z1, c, r.z1 + T, 'nz');
    }
    { const r = this.rStairE, Y = this.Y;
      b({ all: 'concrete', px: 'tileCream' }, r.x0 - 0.3, Y.mezz - 0.2, r.z0, r.x0, 0, r.z1, { collide: true });
      b({ all: 'concrete', nx: 'tileCream' }, r.x1, Y.mezz - 0.2, r.z0, r.x1 + 0.3, 0, r.z1, { collide: true });
      b('concrete', r.x0 - 0.3, -2.4, -10.3, r.x1 + 0.3, 0.02, -10, { collide: true }); // the lintel where the stairs go under the arena
    }
    // the 2 3 4 5 platform's back wall gets the glass-block panels
    for (let x = this.rIrt.x0 + 6; x < this.rIrt.x1 - 6; x += 10) b({ all: null, nz: 'glassBlock' }, x, this.Y.irt + 0.9, -52.03, x + 6, this.Y.irt + 3.1, -52.01);
  }
  // ------------------------------------------------------------------------- trains ------
  buildTrains(Y) {
    const CAR = 15.6, N = 4;
    const bodyGeo = new THREE.BoxGeometry(CAR - 0.4, 3.1, 2.8);
    // map the side texture on the long faces, plain steel elsewhere
    const side = SubTex.carSide();
    const steel = new THREE.MeshStandardMaterial({ color: 0xb4bac0, roughness: 0.35, metalness: 0.6 });
    const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.4, metalness: 0.45, emissive: 0xffffff, emissiveMap: side, emissiveIntensity: 0.08 });
    const mats = [steel, steel, steel, steel, sideMat, sideMat]; // +x -x +y -y +z -z (box faces) -> long faces are +-z
    const doorTex = SubTex.doorPanel();
    const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.4, metalness: 0.45 });
    const doorGeo = new THREE.PlaneGeometry(0.62, 1.95);
    const defs = [
      { axis: 'x', dir: 1, c: this.irtTracks[0], stop: 60, y: Y.irtPit + 0.32, line: '4', lim: [-60, 120], side: 1 },
      { axis: 'x', dir: -1, c: this.irtTracks[1], stop: 60, y: Y.irtPit + 0.32, line: '2', lim: [-60, 120], side: 1, express: true },
      { axis: 'z', dir: 1, c: this.bmtTracks[0], stop: -27, y: Y.bmtPit + 0.32, line: 'Q', lim: [-130, 80], side: -1 },
      { axis: 'z', dir: -1, c: this.bmtTracks[1], stop: -27, y: Y.bmtPit + 0.32, line: 'B', lim: [-130, 80], side: -1, express: true }
    ];
    const nDoors = defs.length * N * 4 * 2 * 2;
    this.bodyMesh = new THREE.InstancedMesh(bodyGeo, mats, defs.length * N);
    this.bodyMesh.castShadow = true; this.bodyMesh.receiveShadow = true; this.bodyMesh.frustumCulled = false;
    this.doorMesh = new THREE.InstancedMesh(doorGeo, doorMat, nDoors); this.doorMesh.frustumCulled = false;
    this.group.add(this.bodyMesh); this.group.add(this.doorMesh);
    // front signs (route bullet) on the lead car ends
    this.trains = defs.map((d, i) => {
      const tr = Object.assign({ idx: i, state: 'gone', t: 0, wait: 6 + i * 9, pos: d.stop - d.dir * 300, door: 0, cars: [], announce: false }, d);
      const bullet = Tex.make('sub-bullet-' + d.line, 128, 128, (gg, w, h) => { gg.fillStyle = '#111'; gg.fillRect(0, 0, w, h); gg.fillStyle = SUB_LINES[d.line]; gg.beginPath(); gg.arc(64, 64, 52, 0, TAU); gg.fill(); gg.fillStyle = d.line === 'Q' ? '#111' : '#fff'; gg.font = 'bold 80px Helvetica, Arial, sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(d.line, 64, 68); }, { clamp: true });
      tr.sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: bullet }));
      this.group.add(tr.sign);
      for (let k = 0; k < N; k++) {
        const body = new RBody({ type: SHAPE.BOX, he: d.axis === 'x' ? new V3(CAR / 2 - 0.2, 1.75, 1.4) : new V3(1.4, 1.75, CAR / 2 - 0.2) }, 1000);
        body.kinematic = true; body.friction = 0.8; body.tag = 'train';
        const owner = { physKind: 'train', bodies: [body], canSleep: false, asleep: false };
        body.owner = owner;
        tr.cars.push({ body, owner, off: (k - (N - 1) / 2) * CAR });
      }
      return tr;
    });
    this.CAR = CAR; this.NCARS = N;
    this._m4 = new M4(); this._q = new QT(); this._p = new V3(); this._s = new V3(1, 1, 1);
  }
  attachPhysics(ph) {
    for (const tr of this.trains) for (const c of tr.cars) { this.placeCar(tr, c, true); ph.addBody(c.body); }
  }
  placeCar(tr, c, snap) {
    const along = tr.state === 'gone' ? 9999 : tr.pos + c.off * tr.dir;
    const p = this._p;
    if (tr.axis === 'x') p.set(along, tr.y + 1.75 + 0.35, tr.c); else p.set(tr.c, tr.y + 1.75 + 0.35, along);
    if (tr.state === 'gone') p.y = -200;
    this._q.identity();
    c.body.setKinematicTarget(p, this._q);
    if (snap) { c.body.pos.copy(p); c.body.prevPos.copy(p); c.body.kinPrevPos.copy(p); c.body.rot.identity(); }
  }
  updateTrains(dt) {
    const N = this.NCARS, CAR = this.CAR, half = N * CAR / 2;
    let di = 0;
    const cam = this.game.camera.position;
    for (const tr of this.trains) {
      tr.t += dt;
      const far = tr.stop - tr.dir * 230;
      if (tr.state === 'gone') { if (tr.t > tr.wait) { tr.state = 'arriving'; tr.t = 0; tr.pos = far; tr.door = 0; this.trainSound(tr, 'arrive'); } }
      else if (tr.state === 'arriving' && tr.express) { // express: rushes straight through
        const T = 9, u = clamp(tr.t / T, 0, 1); tr.pos = lerp(far, tr.stop + tr.dir * 230, u);
        if (u >= 1) { tr.state = 'gone'; tr.t = 0; tr.wait = 25 + Math.random() * 30; }
      } else if (tr.state === 'arriving') {
        const T = 11, u = clamp(tr.t / T, 0, 1); tr.pos = lerp(far, tr.stop, 1 - Math.pow(1 - u, 2.6));
        if (u >= 1) { tr.state = 'dwell'; tr.t = 0; this.trainSound(tr, 'open'); this.announce(tr, 'arrive'); }
      } else if (tr.state === 'dwell') {
        tr.door = tr.t < 1.4 ? smoothstep(0, 1.4, tr.t) : (tr.t > 12.5 ? 1 - smoothstep(12.5, 14.2, tr.t) : 1);
        if (tr.t > 10.5 && !tr.closing) { tr.closing = true; this.trainSound(tr, 'chime'); this.announce(tr, 'close'); }
        if (tr.t > 14.6) { tr.state = 'departing'; tr.t = 0; tr.door = 0; tr.closing = false; this.trainSound(tr, 'depart'); }
      } else if (tr.state === 'departing') {
        const T = 12, u = clamp(tr.t / T, 0, 1); tr.pos = tr.stop + tr.dir * 240 * Math.pow(u, 2.2);
        if (u >= 1) { tr.state = 'gone'; tr.t = 0; tr.wait = 18 + Math.random() * 26; }
      }
      // hide cars that are inside the closed tunnel ends
      for (let k = 0; k < N; k++) {
        const c = tr.cars[k]; this.placeCar(tr, c, false);
        const along = tr.pos + c.off * tr.dir, inside = tr.state !== 'gone' && along > tr.lim[0] + CAR / 2 && along < tr.lim[1] - CAR / 2;
        const p = this._p;
        if (tr.axis === 'x') p.set(along, tr.y + 1.9, tr.c); else p.set(tr.c, tr.y + 1.9, along);
        this._q.setFromAxisAngle(UP, tr.axis === 'x' ? 0 : Math.PI / 2);
        this._m4.compose(p, this._q, inside ? this._s.set(1, 1, 1) : this._s.set(0, 0, 0));
        this.bodyMesh.setMatrixAt(tr.idx * N + k, this._m4);
        // doors: 4 pairs per side; the platform side slides open
        for (let dd = 0; dd < 4; dd++) for (const sd of [1, -1]) for (const leaf of [-1, 1]) {
          const local = (-0.37 + dd * 0.248) * (CAR - 0.4) + leaf * 0.31;
          const open = sd === tr.side ? tr.door : 0;
          const slide = local + leaf * open * 0.6;
          const q = this._q;
          if (tr.axis === 'x') { p.set(along + slide, tr.y + 1.68, tr.c + sd * 1.405); q.setFromAxisAngle(UP, sd > 0 ? 0 : Math.PI); }
          else { p.set(tr.c + sd * 1.405, tr.y + 1.68, along + slide); q.setFromAxisAngle(UP, sd > 0 ? Math.PI / 2 : -Math.PI / 2); }
          this._m4.compose(p, q, inside ? this._s.set(1, 1, 1) : this._s.set(0, 0, 0));
          this.doorMesh.setMatrixAt(di++, this._m4);
        }
      }
      // lead-car route bullet
      const lead = tr.pos + tr.dir * half + tr.dir * 0.02;
      if (tr.axis === 'x') { tr.sign.position.set(lead, tr.y + 2.9, tr.c); tr.sign.rotation.y = tr.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { tr.sign.position.set(tr.c, tr.y + 2.9, lead); tr.sign.rotation.y = tr.dir > 0 ? 0 : Math.PI; }
      tr.sign.visible = tr.state !== 'gone' && lead > tr.lim[0] && lead < tr.lim[1];
      // keep the rumble near the train
      if (tr.snd && tr.snd.panner) { const pp = tr.axis === 'x' ? [tr.pos, tr.y + 1.5, tr.c] : [tr.c, tr.y + 1.5, tr.pos]; if (tr.snd.panner.positionX) { tr.snd.panner.positionX.value = pp[0]; tr.snd.panner.positionY.value = pp[1]; tr.snd.panner.positionZ.value = pp[2]; } }
    }
    this.bodyMesh.instanceMatrix.needsUpdate = true; this.doorMesh.instanceMatrix.needsUpdate = true;
  }
  trainSound(tr, kind) {
    const a = this.game.audio, p = tr.axis === 'x' ? new V3(tr.pos, tr.y + 1.5, tr.c) : new V3(tr.c, tr.y + 1.5, tr.pos);
    const stop = tr.axis === 'x' ? new V3(tr.stop, tr.y + 1.5, tr.c) : new V3(tr.c, tr.y + 1.5, tr.stop);
    if (kind === 'arrive') a.play('trainArrive', { pos: stop, gain: 1.0, ref: 12, important: true });
    else if (kind === 'depart') a.play('trainDepart', { pos: stop, gain: 0.9, ref: 12, important: true });
    else if (kind === 'chime') a.play('doorChime', { pos: stop, gain: 0.8, ref: 10, vary: false });
    else if (kind === 'open') a.play('doorSlide', { pos: stop, gain: 0.6, ref: 8 });
  }
  // platform announcements through the browser's speech synthesis, when available and nearby
  announce(tr, kind) {
    try {
      if (Settings.data.audio.muted || !this.game.audio.unlocked || typeof speechSynthesis === 'undefined') return;
      const cam = this.game.camera.position, sp = tr.axis === 'x' ? new V3(tr.stop, tr.y, tr.c) : new V3(tr.c, tr.y, tr.stop);
      if (cam.distanceTo(sp) > 45) return;
      const text = kind === 'arrive'
        ? `This is Atlantic Avenue, Barclays Center. Transfer is available to the 2, 3, 4, 5, B, D, N, Q, R, and the Long Island Rail Road.`
        : 'Stand clear of the closing doors, please.';
      const u = new SpeechSynthesisUtterance(text); u.rate = 1.02; u.pitch = 0.95; u.volume = clamp(Settings.data.audio.master * Settings.data.audio.ambience * 1.2, 0, 1);
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* speech is optional */ }
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
    const cam = this.game.camera.position, r = this.regionAt(cam.x, cam.z);
    const target = r && r.street && cam.y > -1.5 ? 0 : 1;
    this.under = snap ? target : damp(this.under, target, 3, dt);
    const u = this.under, sc = this.game.scene;
    // street: low afternoon sun, blue sky; below: cool overhead fluorescents
    this.hemi.color.setRGB(lerp(0.78, 0.92, u), lerp(0.86, 0.95, u), lerp(0.98, 1.0, u));
    this.hemi.groundColor.setRGB(lerp(0.42, 0.42, u), lerp(0.4, 0.41, u), lerp(0.36, 0.42, u));
    this.hemi.intensity = lerp(1.0, 1.05, u);
    this.key.color.setRGB(lerp(1.0, 0.95, u), lerp(0.94, 0.98, u), lerp(0.84, 1.0, u));
    this.key.intensity = lerp(2.4, 1.15, u);
    this.fill.intensity = lerp(0.35, 0.12, u);
    const fx = cam.x, fz = cam.z, snapD = 2, tx = Math.round(fx / snapD) * snapD, tz = Math.round(fz / snapD) * snapD;
    const ty = Math.round(cam.y / snapD) * snapD;
    this.key.target.position.set(tx, ty - 1.6, tz);
    this.key.position.set(tx + lerp(-18, -2, u), ty + 30, tz + lerp(14, 3, u));
    if (sc.background && sc.background.isColor) sc.background.copy(this.darkCol).lerp(this.skyCol, 1 - u);
    if (sc.fog) { sc.fog.color.copy(sc.background); sc.fog.near = lerp(90, 40, u); sc.fog.far = lerp(420, 160, u); }
  }
  update(dt, cam) {
    this.time += dt;
    this.updateLighting(0, dt);
    if (this.escTex) this.escTex.offset.y = (this.escTex.offset.y + dt * 0.5) % 1;
    if (this.oculusScreen) this.oculusScreen.material.color.setHSL((this.time * 0.02) % 1, 0.6, 0.55);
    this.updateTrains(dt);
  }
  dispose() {
    const ph = this.game.physics;
    if (this.trains) for (const tr of this.trains) for (const c of tr.cars) { ph.removeBody(c.body); ph.removeOwner(c.owner); }
    this.game.scene.remove(this.group);
    disposeObject(this.group);
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
    this.game.scene.environment = null; this.game.scene.fog = null;
    this.group = new THREE.Group();
    try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (e) { }
  }
}
HT.SubwayEnvironment = SubwayEnvironment; HT.SubTex = SubTex;
