// ============================================================================
// Subway trains. R142 cars on the IRT (2 3 4 5: 15.56 m x 2.62 m, 3 door pairs a side) and R160
// cars on the Brighton line (B Q: 18.35 m x 2.98 m, 4 door pairs a side), built hollow - bucket
// seats along the walls, poles and grab bars, lit ceiling, car-card ads, glass, sliding doors - and
// drawn as instanced meshes. Every track runs one 10-car train round a loop: arrive and brake, open
// the platform-side doors, chime, close, pull out into the tunnel, and come round again. Ragdolls
// and loose objects inside a car are carried with it; riders are placed by the transit system.
// ============================================================================
const CAR_TYPES = {
  R142: { name: 'R142', L: 15.56, W: 2.62, doors: [-5.18, 0, 5.18], doorW: 1.37, seat: 0x41617f, seatEdge: 0x2f4a63, inner: 0xe9e7df, sign: '#ffb02e' },
  R160: { name: 'R160', L: 18.35, W: 2.98, doors: [-6.88, -2.29, 2.29, 6.88], doorW: 1.27, seat: 0x5b6d82, seatEdge: 0x3e4c5e, inner: 0xe3e6e7, sign: '#ffc34d' }
};
const CAR = { ceil: 2.15, roof: 2.58, winBot: 0.95, winTop: 1.85, doorH: 1.93, seatH: 0.45, gap: 0.42, N: 10 };
const TRAIN_DEST = {
  '2': { n: 'Wakefield–241 St', s: 'Flatbush Av–Brooklyn College' }, '3': { n: 'Harlem–148 St', s: 'New Lots Av' },
  '4': { n: 'Woodlawn', s: 'Crown Hts–Utica Av' }, '5': { n: 'Eastchester–Dyre Av', s: 'Flatbush Av–Brooklyn College' },
  'B': { n: 'Bedford Park Blvd', s: 'Brighton Beach' }, 'Q': { n: '96 St–2 Av', s: 'Coney Island–Stillwell Av' }
};
const _tm = new M4(), _tq = new QT(), _tp = new V3(), _ts = new V3(1, 1, 1), _tv = new V3();

const TrainTex = {
  steel() {
    return Tex.make('car-steel', 256, 256, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, n = hash2(x, y >> 4) * 22 + hash2(x >> 1, 7) * 10;
        d[i] = 180 + n; d[i + 1] = 184 + n; d[i + 2] = 189 + n; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  },
  floor() {
    return Tex.make('car-floor', 256, 256, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, r = hash2(x, y), v = r > 0.985 ? 150 : r > 0.95 ? 92 : 44 + r * 12;
        d[i] = v; d[i + 1] = v; d[i + 2] = v + 3; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  },
  // a band of 11" x 28" car cards (made-up advertisers)
  ads() {
    return Tex.make('car-ads', 1024, 128, (g, w, h) => {
      const cards = [
        ['#1d2f5a', '#ffffff', 'INJURED?', 'Call 1-800-555-0199', '#ffd84a'], ['#f4c430', '#1a1a1a', 'Learn Spanish', 'Classes start Monday', '#1a1a1a'],
        ['#efe7d2', '#2b2b2b', 'Poetry in Motion', '"The city hums beneath our feet."', '#7a2a2a'], ['#e8642c', '#ffffff', 'Fresh Bagels', 'Atlantic Av · since 1962', '#fff3c4']];
      cards.forEach((c, i) => {
        const x = i * 256;
        g.fillStyle = c[0]; g.fillRect(x + 4, 4, 248, h - 8);
        g.fillStyle = c[1]; g.font = 'bold 34px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c[2], x + 128, 46, 230);
        g.fillStyle = c[4]; g.font = '20px Helvetica, Arial, sans-serif'; g.fillText(c[3], x + 128, 88, 230);
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4; g.strokeRect(x + 2, 2, 252, h - 4);
      });
    });
  },
  // the lit route map strip over the doors
  strip() {
    return Tex.make('car-strip', 512, 64, (g, w, h) => {
      g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7d8184'; g.fillRect(20, 30, w - 40, 5);
      for (let i = 0; i < 12; i++) { const x = 28 + i * 41; g.fillStyle = i === 6 ? '#ff4c3a' : '#e8eaec'; g.beginPath(); g.arc(x, 32, i === 6 ? 7 : 5, 0, TAU); g.fill(); }
      g.fillStyle = '#ffffff'; g.font = 'bold 13px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('Atlantic Av–Barclays Ctr', 274, 16);
    });
  },
  // the car end: stainless, black windshield band, storm door, headlights
  front(type) {
    return Tex.make('car-front-' + type.name, 256, 256, (g, w, h) => {
      const W = type.W, sx = w / W, sy = h / 3.2, Y = (y) => h - (y + 0.62) * sy;   // texture covers y -0.62..2.58
      g.fillStyle = '#b8bdc2'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#9ea3a8'; for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 1, h);
      g.fillStyle = '#16181b'; g.fillRect(0, Y(1.9), w, (1.9 - 0.95) * sy);                         // windshield band
      g.fillStyle = '#2b3640'; g.fillRect(w * 0.08, Y(1.85), w * 0.3, 0.85 * sy); g.fillRect(w * 0.62, Y(1.85), w * 0.3, 0.85 * sy);
      g.fillStyle = '#c7ccd1'; g.fillRect(w / 2 - 0.36 * sx, Y(2.05), 0.72 * sx, 2.05 * sy);              // storm door
      g.fillStyle = '#1f2a33'; g.fillRect(w / 2 - 0.22 * sx, Y(1.8), 0.44 * sx, 0.7 * sy);
      g.fillStyle = '#20232a'; g.fillRect(0, Y(-0.1), w, 0.52 * sy);                                   // anticlimber / coupler shadow
      for (const s of [-1, 1]) { const x = w / 2 + s * 0.85 * sx; g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(x, Y(0.55), 0.09 * sx, 0, TAU); g.fill(); g.fillStyle = '#ff3b2b'; g.beginPath(); g.arc(x + s * 0.2 * sx, Y(0.55), 0.05 * sx, 0, TAU); g.fill(); }
    }, { clamp: true });
  }
};

// builds a car's geometry (per-material batches in car-local metres: x along, y up from the floor,
// z across) together with its seats and collision boxes
function buildCarModelInner(type, seats) {
  const L = type.L, hw = type.W / 2, t = 0.07, iw = hw - t, dw = type.doorW, B = new Map();
  const bat = (k) => { let b = B.get(k); if (!b) B.set(k, b = new SubBatch()); return b; };
  const TM = { skin: 1.5, inner: 1.2, floor: 1.0, seat: 1, seatEdge: 1, pole: 1, glass: 1, light: 1, dark: 1, roof: 2, ads: 2.84, strip: 1 };
  const box = (k, x0, y0, z0, x1, y1, z1, skip = '') => {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, tm = TM[k] || 1, b = bat(k);
    const F = (f, o, U, V) => { if (skip.indexOf(f) < 0) b.quad(o, U, V, tm); };
    F('px', new V3(x1, y0, z1), new V3(0, 0, -dz), new V3(0, dy, 0)); F('nx', new V3(x0, y0, z0), new V3(0, 0, dz), new V3(0, dy, 0));
    F('pz', new V3(x0, y0, z1), new V3(dx, 0, 0), new V3(0, dy, 0)); F('nz', new V3(x1, y0, z0), new V3(-dx, 0, 0), new V3(0, dy, 0));
    F('py', new V3(x0, y1, z1), new V3(dx, 0, 0), new V3(0, 0, -dz)); F('ny', new V3(x0, y0, z0), new V3(dx, 0, 0), new V3(0, 0, dz));
  };
  // vertical side rectangle at z (facing +z if n>0), x0..x1, y0..y1
  const side = (k, z, x0, x1, y0, y1, n) => {
    if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3) return;
    const b = bat(k), tm = TM[k] || 1;
    if (n > 0) b.quad(new V3(x0, y0, z), new V3(x1 - x0, 0, 0), new V3(0, y1 - y0, 0), tm);
    else b.quad(new V3(x1, y0, z), new V3(x0 - x1, 0, 0), new V3(0, y1 - y0, 0), tm);
  };
  const poleV = (x, z, y0, y1, r = 0.019) => { const b = bat('pole'); for (let i = 0; i < 6; i++) { const a0 = i / 6 * TAU, a1 = (i + 1) / 6 * TAU; b.quad(new V3(x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r), new V3((Math.cos(a0) - Math.cos(a1)) * r, 0, (Math.sin(a0) - Math.sin(a1)) * r), new V3(0, y1 - y0, 0), 1); } };
  const barX = (x0, x1, y, z, r = 0.016) => { const b = bat('pole'); for (let i = 0; i < 6; i++) { const a0 = i / 6 * TAU, a1 = (i + 1) / 6 * TAU; b.quad(new V3(x0, y + Math.sin(a0) * r, z + Math.cos(a0) * r), new V3(x1 - x0, 0, 0), new V3(0, (Math.sin(a1) - Math.sin(a0)) * r, (Math.cos(a1) - Math.cos(a0)) * r), 1); } };
  // openings along the side: doors (full height) and windows
  const doorsX = type.doors.map(c => [c - dw / 2, c + dw / 2]);
  const solid = (from, to, cuts) => { let segs = [[from, to]]; for (const [a, c] of cuts) { const nx = []; for (const [s, e] of segs) { if (c <= s || a >= e) { nx.push([s, e]); continue; } if (a > s) nx.push([s, a]); if (c < e) nx.push([c, e]); } segs = nx; } return segs; };
  const sections = solid(-L / 2, L / 2, doorsX);           // wall stretches between the doorways
  const windows = [];
  for (const [a, c] of sections) {
    const end = Math.abs(a + L / 2) < 1e-3 || Math.abs(c - L / 2) < 1e-3, a0 = a + (Math.abs(a + L / 2) < 1e-3 ? 0.9 : 0.28), c0 = c - (Math.abs(c - L / 2) < 1e-3 ? 0.9 : 0.28);
    const len = c0 - a0, n = Math.max(1, Math.round(len / (end ? 1.25 : 1.32))), gapW = 0.16, ww = (len - gapW * (n - 1)) / n;
    for (let i = 0; i < n; i++) windows.push([a0 + i * (ww + gapW), a0 + i * (ww + gapW) + ww]);
  }
  for (const s of [-1, 1]) {
    const zo = s * hw, zi = s * iw;
    // skin and inner lining, row by row around the openings
    const rows = [[-0.25, 0, []], [0, CAR.winBot, doorsX], [CAR.winBot, CAR.winTop, doorsX.concat(windows)], [CAR.winTop, CAR.doorH, doorsX], [CAR.doorH, CAR.ceil, []]];
    for (const [y0, y1, cuts] of rows) for (const [a, c] of solid(-L / 2, L / 2, cuts)) {
      side('skin', zo, a, c, y0, y1, s);
      if (y0 >= 0) side('inner', zi, a, c, y0, y1, -s);
    }
    for (const [a, c] of windows) { side('glass', s * (hw - 0.02), a, c, CAR.winBot, CAR.winTop, s); side('dark', s * (hw + 0.004), a - 0.03, c + 0.03, CAR.winTop, CAR.winTop + 0.035, s); }
    // eave up to the roof
    bat('skin').quad(new V3(-s * L / 2, CAR.ceil, zo), new V3(s * L, 0, 0), new V3(0, CAR.roof - CAR.ceil - 0.06, -s * 0.3), 1.5);
    // car-card band, slanted above the windows inside
    bat('ads').quadV(new V3(s * (L / 2 - 0.25), 1.9, zi - s * 0.005), new V3(-s * (L - 0.5), 0, 0), new V3(0, 0.25, -s * 0.28), 2.84, 0, 1);
    // seats: molded buckets along each wall between the doorways, on a recessed base
    for (const [a, c] of sections) {
      const a0 = a + (Math.abs(a + L / 2) < 1e-3 ? 0.5 : 0.22), c0 = c - (Math.abs(c - L / 2) < 1e-3 ? 0.5 : 0.22), len = c0 - a0;
      const n = Math.floor(len / 0.465); if (n < 1) continue;
      const pitch = len / n;
      box('dark', a0, 0, Math.min(zi, zi - s * 0.36), c0, 0.38, Math.max(zi, zi - s * 0.36), 'ny');
      for (let i = 0; i < n; i++) {
        const cx = a0 + (i + 0.5) * pitch, h = pitch * 0.46;
        box('seat', cx - h, 0.38, Math.min(zi, zi - s * 0.46), cx + h, CAR.seatH, Math.max(zi, zi - s * 0.46), 'ny');
        box('seatEdge', cx - h, CAR.seatH - 0.02, Math.min(zi - s * 0.46, zi - s * 0.49), cx + h, CAR.seatH + 0.01, Math.max(zi - s * 0.46, zi - s * 0.49), 'ny');
        box('seat', cx - h, CAR.seatH, Math.min(zi, zi - s * 0.07), cx + h, 1.0, Math.max(zi, zi - s * 0.07), 'ny');
        seats.push({ lx: cx, lz: zi - s * 0.25, side: s, h: CAR.seatH });
      }
      // seat-end partitions with stanchions at the doorway side, and the grab bar above the seats
      for (const [x, inside] of [[a0 - 0.03, Math.abs(a + L / 2) > 1e-3], [c0 + 0.03, Math.abs(c - L / 2) > 1e-3]]) {
        if (!inside) continue;
        box('inner', x - 0.02, 0.2, Math.min(zi, zi - s * 0.56), x + 0.02, 1.45, Math.max(zi, zi - s * 0.56));
        poleV(x, zi - s * 0.58, 0, CAR.ceil);
      }
      barX(a0, c0, 1.92, zi - s * 0.5);
    }
  }
  // doorway poles, strip maps over the doors (inside), thresholds
  for (const c of type.doors) {
    poleV(c, 0, 0, CAR.ceil, 0.021);
    for (const s of [-1, 1]) {
      bat('strip').quadExact(new V3(s > 0 ? c + dw / 2 - 0.05 : c - dw / 2 + 0.05, CAR.doorH + 0.02, s * (iw - 0.006)), new V3(s > 0 ? -(dw - 0.1) : dw - 0.1, 0, 0), new V3(0, 0.16, 0), 0, 1, 0, 1);
      box('dark', c - dw / 2, -0.01, Math.min(s * iw, s * hw), c + dw / 2, 0.005, Math.max(s * iw, s * hw), 'ny');
    }
  }
  // floor, ceiling with two light strips, roof, underframe and trucks
  box('floor', -L / 2 + 0.05, -0.04, -iw, L / 2 - 0.05, 0, iw, 'nxpxnzpzny');
  bat('inner').quad(new V3(-L / 2, CAR.ceil, -iw), new V3(L, 0, 0), new V3(0, 0, 2 * iw), 1.2); // faces down
  for (const z of [-0.45, 0.45]) bat('light').quad(new V3(-L / 2 + 0.4, CAR.ceil - 0.012, z - 0.11), new V3(L - 0.8, 0, 0), new V3(0, 0, 0.22), 1);
  box('roof', -L / 2, CAR.roof - 0.06, -hw + 0.3, L / 2, CAR.roof, hw - 0.3, 'ny');
  box('dark', -L / 2 + 0.4, -0.85, -hw + 0.12, L / 2 - 0.4, -0.25, hw - 0.12, 'py');
  for (const tx of [-(L / 2 - 2.3), L / 2 - 2.3]) {
    box('dark', tx - 1.25, -0.98, -1.0, tx + 1.25, -0.6, 1.0);
    for (const wx of [-0.95, 0.95]) for (const s of [-1, 1]) box('dark', tx + wx - 0.43, -1.08, s * 0.72 - 0.07, tx + wx + 0.43, -0.25, s * 0.72 + 0.07);
  }
  // end walls (inside lining and outside skin around the storm door)
  for (const e of [-1, 1]) {
    const x = e * L / 2;
    const b = bat('skin'), bi = bat('inner');
    if (e > 0) { b.quad(new V3(x, -0.25, hw), new V3(0, 0, -2 * hw), new V3(0, CAR.roof + 0.25, 0), 1.5); bi.quad(new V3(x - t, 0, -iw), new V3(0, 0, 2 * iw), new V3(0, CAR.ceil, 0), 1.2); }
    else { b.quad(new V3(x, -0.25, -hw), new V3(0, 0, 2 * hw), new V3(0, CAR.roof + 0.25, 0), 1.5); bi.quad(new V3(x + t, 0, iw), new V3(0, 0, -2 * iw), new V3(0, CAR.ceil, 0), 1.2); }
    box('dark', x - 0.02 * e - 0.01, 0.95, -0.24, x - 0.02 * e + 0.01, 1.8, 0.24);   // storm-door window
  }
  // collision boxes (car-local): floor slab, roof, end walls, side walls between doorways, door plugs, seat banks
  const boxes = [];
  const add = (x0, y0, z0, x1, y1, z1, o) => boxes.push(Object.assign({ l: [x0, y0, z0, x1, y1, z1], min: new V3(), max: new V3(), on: true }, o || {}));
  add(-L / 2, -0.7, -hw, L / 2, 0, hw);
  add(-L / 2, CAR.ceil, -hw, L / 2, CAR.roof, hw);
  add(L / 2 - 0.09, 0, -hw, L / 2, CAR.ceil, hw, { end: 1 }); add(-L / 2, 0, -hw, -L / 2 + 0.09, CAR.ceil, hw, { end: -1 });
  for (const s of [-1, 1]) {
    const z0 = s > 0 ? hw - 0.09 : -hw, z1 = s > 0 ? hw : -hw + 0.09;
    for (const [a, c] of sections) add(a, 0, z0, c, CAR.ceil, z1);
    type.doors.forEach((c, i) => add(c - dw / 2, 0, z0, c + dw / 2, CAR.doorH, z1, { door: i, side: s }));
    for (const [a, c] of sections) { const a0 = a + (Math.abs(a + L / 2) < 1e-3 ? 0.5 : 0.22), c0 = c - (Math.abs(c - L / 2) < 1e-3 ? 0.5 : 0.22); if (c0 - a0 > 0.4) add(a0, 0, s > 0 ? iw - 0.49 : -iw, c0, CAR.seatH, s > 0 ? iw : -iw + 0.49); }
  }
  return { batches: B, seats, boxes, iw, hw };
}

// --- environment methods: build, run and dispose the trains -------------------------------------
Object.assign(SubwayEnvironment.prototype, {
  buildTrains(Y) {
    const I = this.IRT, M = this.BMT;
    const defs = [
      { key: 'nl', type: 'R142', axis: 'x', c: I.tracks.nl, dir: -1, stop: I.stop, floorY: Y.irt, lines: ['2', '3'], bound: 'n', plat: 1, D: 360, wait: 0 },
      { key: 'ne', type: 'R142', axis: 'x', c: I.tracks.ne, dir: -1, stop: I.stop, floorY: Y.irt, lines: ['4', '5'], bound: 'n', plat: -1, D: 360, wait: 18 },
      { key: 'se', type: 'R142', axis: 'x', c: I.tracks.se, dir: 1, stop: I.stop, floorY: Y.irt, lines: ['5', '4'], bound: 's', plat: 1, D: 360, wait: 8 },
      { key: 'sl', type: 'R142', axis: 'x', c: I.tracks.sl, dir: 1, stop: I.stop, floorY: Y.irt, lines: ['3', '2'], bound: 's', plat: -1, D: 360, wait: 30 },
      { key: 'w', type: 'R160', axis: 'z', c: M.tracks.w, dir: 1, stop: M.stop, floorY: Y.bmt, lines: ['Q', 'B'], bound: 'n', plat: 1, D: 400, wait: 4 },
      { key: 'e', type: 'R160', axis: 'z', c: M.tracks.e, dir: -1, stop: M.stop, floorY: Y.bmt, lines: ['B', 'Q'], bound: 's', plat: -1, D: 400, wait: 22 }
    ];
    // one model + instanced meshes per car type
    this.carModels = {};
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.55, metalness: 0 }, o));
    for (const tn of ['R142', 'R160']) {
      const type = CAR_TYPES[tn], model = buildCarModelWithSeats(type), count = defs.filter(d => d.type === tn).length * CAR.N;
      const mats = {
        skin: std({ map: TrainTex.steel(), color: 0xf2f4f6, metalness: 0.42, roughness: 0.36, envMapIntensity: 1.0 }),
        roof: std({ color: 0x74787d, metalness: 0.45, roughness: 0.6 }),
        inner: std({ color: type.inner, roughness: 0.5 }),
        floor: std({ map: TrainTex.floor(), roughness: 0.32, envMapIntensity: 0.8 }),
        seat: std({ color: type.seat, roughness: 0.32, metalness: 0.05, envMapIntensity: 0.9 }),
        seatEdge: std({ color: type.seatEdge, roughness: 0.35 }),
        pole: std({ color: 0xe2e6e9, metalness: 0.95, roughness: 0.16, envMapIntensity: 1.3 }),
        glass: std({ color: 0x1d2a33, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
        light: new THREE.MeshBasicMaterial({ color: 0xf6fbff }),
        dark: std({ color: 0x17191c, roughness: 0.75 }),
        ads: std({ map: TrainTex.ads(), roughness: 0.45, emissive: 0xffffff, emissiveMap: TrainTex.ads(), emissiveIntensity: 0.18 }),
        strip: new THREE.MeshBasicMaterial({ map: TrainTex.strip() })
      };
      const parts = [];
      for (const [k, b] of model.batches) if (b.P.length && mats[k]) parts.push({ k, geo: b.geometry(), mat: mats[k] });
      // door leaves: stainless with a window; and the cab ends
      const lb = new SubBatch(), lg = new SubBatch(), lw = type.doorW / 2 - 0.01;
      const leafBox = (bb, x0, y0, z0, x1, y1, z1) => { const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0; bb.quad(new V3(x0, y0, z1), new V3(dx, 0, 0), new V3(0, dy, 0), 1.5); bb.quad(new V3(x1, y0, z0), new V3(-dx, 0, 0), new V3(0, dy, 0), 1.5); bb.quad(new V3(x1, y0, z1), new V3(0, 0, -dz), new V3(0, dy, 0), 1.5); bb.quad(new V3(x0, y0, z0), new V3(0, 0, dz), new V3(0, dy, 0), 1.5); bb.quad(new V3(x0, y1, z1), new V3(dx, 0, 0), new V3(0, 0, -dz), 1.5); };
      const wx0 = -lw / 2 + 0.09, wx1 = lw / 2 - 0.09, wy0 = 0.98, wy1 = 1.83, d2 = 0.02;
      leafBox(lb, -lw / 2, 0, -d2, lw / 2, wy0, d2); leafBox(lb, -lw / 2, wy1, -d2, lw / 2, CAR.doorH, d2);
      leafBox(lb, -lw / 2, wy0, -d2, wx0, wy1, d2); leafBox(lb, wx1, wy0, -d2, lw / 2, wy1, d2);
      lg.quad(new V3(wx0, wy0, 0), new V3(wx1 - wx0, 0, 0), new V3(0, wy1 - wy0, 0), 1);
      const frontGeo = new THREE.PlaneGeometry(type.W, 3.2); frontGeo.translate(0, 3.2 / 2 - 0.62, 0);
      this.carModels[tn] = { type, model, parts, mats, leafGeo: lb.geometry(), leafGlassGeo: lg.geometry(), frontGeo, frontMat: std({ map: TrainTex.front(type), metalness: 0.5, roughness: 0.4 }) };
    }
    // the trains
    this.trains = []; this.trainsByKey = {}; this.movers = [];
    for (const d of defs) {
      const cm = this.carModels[d.type], type = cm.type, theta = d.axis === 'x' ? (d.dir > 0 ? 0 : Math.PI) : (d.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      const lz = new V3(Math.sin(theta), 0, Math.cos(theta)), plat = d.axis === 'x' ? new V3(0, 0, d.plat) : new V3(d.plat, 0, 0);
      const tr = Object.assign({}, d, { type, theta, cos: Math.cos(theta), sin: Math.sin(theta), doorSide: Math.sign(lz.dot(plat)), pitch: type.L + CAR.gap,
        s: -d.D, v: 0, state: 'away', t: 0, door: 0, lineIdx: 0, cycle: 0, cars: [], moved: true, visible: true, lvl: d.axis === 'x' ? 'irt' : 'bmt' });
      // its own instanced meshes (10 cars), so a train out of sight costs nothing
      tr.group = new THREE.Group(); tr.group.name = 'train-' + d.key; this.group.add(tr.group);
      const inst = (geo, mat, n, ro) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = false; if (ro) m.renderOrder = ro; tr.group.add(m); return m; };
      tr.meshes = cm.parts.map(p => { const m = inst(p.geo, p.mat, CAR.N, p.k === 'glass' ? 2 : 0); m.receiveShadow = p.k === 'floor' || p.k === 'seat' || p.k === 'inner'; return m; });
      tr.leafM = inst(cm.leafGeo, cm.mats.skin, CAR.N * type.doors.length * 4); tr.leafG = inst(cm.leafGlassGeo, cm.mats.glass, CAR.N * type.doors.length * 4, 2);
      tr.fronts = inst(cm.frontGeo, cm.frontMat, 2);
      // the sign texture: route bullet and destination in LEDs
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
      tr.signCv = cv; tr.signTex = new THREE.CanvasTexture(cv); tr.signTex.colorSpace = THREE.SRGBColorSpace; tr.signTex.anisotropy = 4;
      const sg = new THREE.PlaneGeometry(1.5, 0.19);
      tr.signMesh = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ map: tr.signTex }), 2 + CAR.N * 2); tr.signMesh.frustumCulled = false; tr.group.add(tr.signMesh);
      for (let k = 0; k < CAR.N; k++) {
        const car = { train: tr, k, idx: k, leaf0: k * type.doors.length * 4, pos: new V3(), floorY: d.floorY, yaw: theta, iw: cm.model.iw, hw: cm.model.hw, L: type.L,
          end: k === CAR.N - 1 ? 1 : (k === 0 ? -1 : 0), seats: cm.model.seats.map(q => Object.assign({}, q, { occupant: null, car: null, kind: 'train' })), mover: { min: new V3(), max: new V3(), boxes: cm.model.boxes.map(b => ({ l: b.l, door: b.door, side: b.side, end: b.end, min: new V3(), max: new V3(), on: true })) } };
        for (const q of car.seats) q.car = car;
        // the end cars have a driver's cab across the end: riders stay out of it
        car.x0 = -type.L / 2 + (car.end === -1 ? 1.25 : 0.55); car.x1 = type.L / 2 - (car.end === 1 ? 1.25 : 0.55);
        if (car.end) { const e = car.end, x0 = e > 0 ? type.L / 2 - 1.2 : -type.L / 2, x1 = e > 0 ? type.L / 2 : -type.L / 2 + 1.2; car.mover.boxes.push({ l: [x0, -1.0, -car.hw, x1, CAR.roof, car.hw], min: new V3(), max: new V3(), on: true }); car.seats = car.seats.filter(q => q.lx > car.x0 && q.lx < car.x1); }
        tr.cars.push(car); this.movers.push(car.mover);
      }
      this.trains.push(tr); this.trainsByKey[d.key] = tr;
      this.drawTrainSign(tr);
    }
    // start: one train already standing at the Manhattan-bound 2 3 platform, the rest on their way
    const t0 = this.trainsByKey.nl; t0.state = 'dwell'; t0.s = 0; t0.t = 3; t0.door = 1;
    this.trainsByKey.w.state = 'arriving'; this.trainsByKey.w.s = -150;
    for (const tr of this.trains) this.placeTrain(tr, true);
  },
  attachPhysics(ph) { ph.movers = this.movers || null; },
  drawTrainSign(tr) {
    const g = tr.signCv.getContext('2d'), W = 512, H = 64, line = tr.lines[tr.lineIdx % tr.lines.length];
    g.fillStyle = '#050505'; g.fillRect(0, 0, W, H);
    g.fillStyle = SUB_LINES[line] || '#888'; g.beginPath(); g.arc(34, 32, 24, 0, TAU); g.fill();
    g.fillStyle = line === 'Q' ? '#111' : '#fff'; g.font = 'bold 34px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(line, 34, 34);
    g.fillStyle = tr.type.sign; g.textAlign = 'left'; g.font = 'bold 30px Helvetica, Arial, sans-serif';
    g.fillText(TRAIN_DEST[line][tr.bound], 70, 34, W - 84);
    tr.signTex.needsUpdate = true; tr.line = line; tr.dest = TRAIN_DEST[line][tr.bound];
  },
  // seconds until the next train on this track is standing at the platform
  trainEta(tr) {
    const vmax = 12, a = 1.15, tArr = (dist) => dist > vmax * vmax / (2 * a) ? (dist - vmax * vmax / (2 * a)) / vmax + vmax / a : Math.sqrt(2 * dist / a);
    let eta, next = false;
    if (tr.state === 'dwell') eta = 0;
    else if (tr.state === 'arriving') eta = tArr(-tr.s);
    else if (tr.state === 'away') { eta = Math.max(0, tr.wait - tr.t) + tArr(tr.D); next = true; }
    else { eta = (tr.D - tr.s) / 13 + 12 + tArr(tr.D); next = true; }
    const line = next ? tr.lines[(tr.lineIdx + 1) % tr.lines.length] : tr.line;
    return { line, dest: TRAIN_DEST[line][tr.bound], eta, boarding: tr.state === 'dwell' };
  },
  // car-local -> world (x, z) and back
  carToWorld(car, lx, lz, out) { return out.set(car.pos.x + car.train.cos * lx + car.train.sin * lz, car.floorY, car.pos.z - car.train.sin * lx + car.train.cos * lz); },
  worldToCar(car, x, z, out) { const dx = x - car.pos.x, dz = z - car.pos.z, c = car.train.cos, s = car.train.sin; return out.set(c * dx - s * dz, 0, s * dx + c * dz); },
  // the car whose interior holds x,z at height y (standing on its floor)
  carAt(x, z, y) {
    for (const tr of this.trains) {
      const half = CAR.N * tr.pitch / 2, cx = tr.axis === 'x' ? tr.center.x : tr.center.z, along = tr.axis === 'x' ? x : z, lat = tr.axis === 'x' ? z - tr.c : x - tr.c;
      if (Math.abs(along - cx) > half || Math.abs(lat) > tr.type.W / 2 || (y != null && (y < tr.floorY - 0.6 || y > tr.floorY + 2.3))) continue;
      for (const car of tr.cars) { this.worldToCar(car, x, z, _tv); if (Math.abs(_tv.x) <= car.L / 2 && Math.abs(_tv.z) <= car.iw + 0.02) return car; }
    }
    return null;
  },
  placeTrain(tr, snap) {
    const mm = tr.meshes;
    tr.center = tr.center || new V3();
    const along = tr.stop + tr.dir * tr.s;
    if (tr.axis === 'x') tr.center.set(along, tr.floorY, tr.c); else tr.center.set(tr.c, tr.floorY, along);
    _tq.setFromAxisAngle(UP, tr.theta);
    const leafOpen = tr.door, dw = tr.type.doorW;
    for (const car of tr.cars) {
      const off = (car.k - (CAR.N - 1) / 2) * tr.pitch * tr.dir;
      const nx = tr.axis === 'x' ? tr.center.x + off : tr.c, nz = tr.axis === 'x' ? tr.c : tr.center.z + off;
      car.dx = snap ? 0 : nx - car.pos.x; car.dz = snap ? 0 : nz - car.pos.z;
      car.pos.set(nx, tr.floorY, nz);
      _tm.compose(car.pos, _tq, _ts.set(1, 1, 1));
      for (const m of mm) m.setMatrixAt(car.idx, _tm);
      // door leaves: the platform side slides open into the wall pockets
      let li = car.leaf0;
      for (const c of tr.type.doors) for (const s of [-1, 1]) for (const e of [-1, 1]) {
        const open = s === tr.doorSide ? leafOpen : 0, lx = c + e * (dw / 4 + open * dw / 2 * 0.96), lz = s * (car.hw - 0.04);
        this.carToWorld(car, lx, lz, _tp);
        _tm.compose(_tp, _tq, _ts.set(1, 1, 1));
        tr.leafM.setMatrixAt(li, _tm); tr.leafG.setMatrixAt(li, _tm); li++;
      }
      // collision boxes in world space; door plugs open with the doors
      const mv = car.mover; mv.min.set(1e9, 1e9, 1e9); mv.max.set(-1e9, -1e9, -1e9);
      for (const b of mv.boxes) {
        const l = b.l;
        this.carToWorld(car, l[0], l[2], _tp); const ax = _tp.x, az = _tp.z;
        this.carToWorld(car, l[3], l[5], _tp);
        b.min.set(Math.min(ax, _tp.x), car.floorY + l[1], Math.min(az, _tp.z)); b.max.set(Math.max(ax, _tp.x), car.floorY + l[4], Math.max(az, _tp.z));
        b.on = b.door == null || b.side !== tr.doorSide || leafOpen < 0.45;
        mv.min.min(b.min); mv.max.max(b.max);
      }
    }
    // cab ends and signs (front/rear ends, a sign on each car side)
    const head = tr.cars[CAR.N - 1], tail = tr.cars[0];
    for (const [car, e, slot] of [[head, 1, 0], [tail, -1, 1]]) {
      this.carToWorld(car, e * (car.L / 2 + 0.006), 0, _tp); _tq.setFromAxisAngle(UP, tr.theta + (e > 0 ? Math.PI / 2 : -Math.PI / 2));
      _tm.compose(_tp, _tq, _ts.set(1, 1, 1)); tr.fronts.setMatrixAt(slot, _tm);
      this.carToWorld(car, e * (car.L / 2 + 0.012), 0, _tp); _tp.y += 2.24; _tm.compose(_tp, _tq, _ts.set(0.8, 1, 1)); tr.signMesh.setMatrixAt(slot, _tm);
    }
    let si = 2;
    for (const car of tr.cars) for (const s of [-1, 1]) {
      this.carToWorld(car, car.L / 2 - 2.3, s * (car.hw + 0.006), _tp); _tp.y += CAR.winTop + 0.12;
      _tq.setFromAxisAngle(UP, tr.theta + (s > 0 ? 0 : Math.PI)); _tm.compose(_tp, _tq, _ts.set(1, 1, 1)); tr.signMesh.setMatrixAt(si++, _tm);
    }
    _tq.setFromAxisAngle(UP, tr.theta);
    for (const m of mm) m.instanceMatrix.needsUpdate = true;
    tr.leafM.instanceMatrix.needsUpdate = true; tr.leafG.instanceMatrix.needsUpdate = true; tr.fronts.instanceMatrix.needsUpdate = true; tr.signMesh.instanceMatrix.needsUpdate = true;
  },
  updateTrains(dt) {
    if (!this.trains) return;
    const vmax = 12, a = 1.15, vdep = 13.5, adep = 1.0, DW = 26;
    this.anyOpen = false;
    for (const tr of this.trains) {
      tr.t += dt;
      const s0 = tr.s, door0 = tr.door;
      let teleport = 0;
      if (tr.state === 'away') {
        if (tr.t > tr.wait) { tr.state = 'arriving'; tr.t = 0; tr.s = -tr.D; tr.v = vmax; this.trainSound(tr, 'arrive'); }
      } else if (tr.state === 'arriving') {
        const dist = -tr.s;
        tr.v = Math.min(vmax, Math.sqrt(2 * a * Math.max(dist, 0)) + 0.05);
        tr.s = Math.min(0, tr.s + tr.v * dt);
        if (tr.s >= -0.004) { tr.s = 0; tr.v = 0; tr.state = 'dwell'; tr.t = 0; this.trainSound(tr, 'stop'); }
      } else if (tr.state === 'dwell') {
        tr.door = tr.t < 1.0 ? 0 : (tr.t < DW - 4 ? smoothstep(1.0, 2.6, tr.t) : 1 - smoothstep(DW - 4, DW - 2.6, tr.t));
        if (tr.t > 1.0 && !tr.opened) { tr.opened = true; this.trainSound(tr, 'open'); this.announce(tr, 'arrive'); tr.cycle++; }
        if (tr.t > DW - 6.5 && !tr.closing) { tr.closing = true; this.trainSound(tr, 'chime'); this.announce(tr, 'close'); }
        if (tr.t > DW) { tr.state = 'departing'; tr.t = 0; tr.door = 0; tr.closing = false; tr.opened = false; tr.v = 0.3; this.trainSound(tr, 'depart'); }
      } else if (tr.state === 'departing') {
        tr.v = Math.min(vdep, tr.v + adep * dt); tr.s += tr.v * dt;
        if (tr.s >= tr.D) { // round the loop: back to the far end of the line, next service
          teleport = -2 * tr.D; tr.s = -tr.D; tr.state = 'away'; tr.t = 0; tr.wait = 6 + Math.random() * 30; tr.v = 0;
          tr.lineIdx = (tr.lineIdx + 1) % tr.lines.length; this.drawTrainSign(tr);
        }
      }
      if (tr.state === 'dwell' && tr.door > 0.3) this.anyOpen = true;
      const moved = tr.s !== s0 || teleport !== 0, doorMoved = tr.door !== door0;
      if (!moved && !doorMoved && !tr.moved) continue;
      tr.moved = false;
      // carry loose bodies (ragdolls, props) that are inside the cars before they move
      if (moved) this.carryBodies(tr, tr.dir * (tr.s - s0));
      this.placeTrain(tr, false);
    }
    if (this.game.physics) this.game.physics.movers = this.movers;
  },
  // draw only the trains on the camera's level and short of the fog
  updateTrainVis() {
    if (!this.trains) return;
    const cam = this.game.camera.position, cr = this.volumeAt(cam.x, cam.z, cam.y), lvl = cr ? cr.lvl : null;
    for (const tr of this.trains) {
      const ax = tr.axis === 'x', half = CAR.N * tr.pitch / 2, c = ax ? tr.center.x : tr.center.z, a = ax ? cam.x : cam.z;
      const along = clamp(a - c, -half, half), dl = a - c - along, dw = (ax ? cam.z : cam.x) - tr.c;
      tr.group.visible = lvl === tr.lvl && Math.hypot(dl, dw) < 175;
    }
  },
  // ragdolls and props inside a train move with it
  carryBodies(tr, d) {
    if (Math.abs(d) < 1e-6) return;
    const ph = this.game.physics; if (!ph) return;
    const dx = tr.axis === 'x' ? d : 0, dz = tr.axis === 'z' ? d : 0;
    const half = CAR.N * tr.pitch / 2 + 0.5, cx = tr.axis === 'x' ? tr.center.x : tr.center.z, hw = tr.type.W / 2 - 0.03;
    const inside = (P) => { const along = tr.axis === 'x' ? P.x : P.z, lat = tr.axis === 'x' ? P.z - tr.c : P.x - tr.c; return Math.abs(along - cx) <= half && Math.abs(lat) <= hw && P.y >= tr.floorY - 0.25 && P.y <= tr.floorY + CAR.ceil; };
    for (const b of ph.bodies) {
      if (b.kinematic || b.invMass === 0 || !inside(b.pos)) continue;
      b.pos.x += dx; b.pos.z += dz; b.prevPos.x += dx; b.prevPos.z += dz;
    }
    // standing in a car with the camera: you ride along
    const cam = this.game.camera.position;
    if (inside(cam)) { cam.x += dx; cam.z += dz; const pc = this.game.player && this.game.player._prevCam; if (pc) { pc.x += dx; pc.z += dz; } }
  },
  trainSound(tr, kind) {
    const a = this.game.audio, stop = tr.axis === 'x' ? new V3(tr.stop, tr.floorY + 1.5, tr.c) : new V3(tr.c, tr.floorY + 1.5, tr.stop);
    if (kind === 'arrive') a.play('trainArrive', { pos: stop, gain: 1.0, ref: 12, important: true });
    else if (kind === 'depart') a.play('trainDepart', { pos: stop, gain: 0.9, ref: 12, important: true });
    else if (kind === 'chime') a.play('doorChime', { pos: stop, gain: 0.8, ref: 10, vary: false });
    else if (kind === 'open') a.play('doorSlide', { pos: stop, gain: 0.6, ref: 8 });
  },
  // platform announcements through the browser's speech synthesis, when available and nearby
  announce(tr, kind) {
    try {
      if (Settings.data.audio.muted || !this.game.audio.unlocked || typeof speechSynthesis === 'undefined') return;
      const cam = this.game.camera.position, sp = tr.axis === 'x' ? new V3(tr.stop, tr.floorY, tr.c) : new V3(tr.c, tr.floorY, tr.stop);
      if (cam.distanceTo(sp) > 60) return;
      const text = kind === 'arrive'
        ? `This is Atlantic Avenue, Barclays Center. This is a ${tr.line} train to ${tr.dest.replace('–', ', ')}. Transfer is available to the 2, 3, 4, 5, B, D, N, Q, R, and the Long Island Rail Road.`
        : 'Stand clear of the closing doors, please.';
      const u = new SpeechSynthesisUtterance(text); u.rate = 1.02; u.pitch = 0.95; u.volume = clamp(Settings.data.audio.master * Settings.data.audio.ambience * 1.2, 0, 1);
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* speech is optional */ }
  },
  disposeTrains() {
    if (this.game.physics) this.game.physics.movers = null;
    if (this.trains) for (const tr of this.trains) { tr.signTex.dispose(); }
    this.trains = null; this.movers = null;
  }
});

// the car model with its seat list (kept separate so the batches can be built once per type)
function buildCarModelWithSeats(type) {
  const seats = [];
  const m = buildCarModelInner(type, seats);
  m.seats = seats;
  return m;
}
