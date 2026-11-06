// ============================================================================
// PLAYGROUND (V1.12): a neighbourhood park with a playground in the middle.
// Built on the grassy field's sky, sun, weather, grass and trees, on flat ground. Posts, decks,
// bars, fences and benches are solid boxes; the slide chutes and the seesaw boards are sloped
// surfaces the physics treats as floors. The swings, seesaws and spring riders move: the wind,
// shots, blasts and bodies push them. People walk round the equipment on a navigation grid and
// sit on the benches and at the picnic tables; birds peck on the paths and fly off when someone
// comes near or a shot is fired. +X east, -Z north (the street and the houses are to the north).
// ============================================================================
const PG = {
  bx0: -34.5, bx1: 34.5, bz0: -34.2, bz1: 31.5,   // walkable park (and the park-side sidewalk)
  play: { x0: -14, x1: 14, z0: -10, z1: 10 },     // rubber safety flooring inside the fence
  deckH: 1.5
};
const _pgV = new V3(), _pgW = new V3(), _pgN3 = new THREE.Matrix3(), _pgM = new THREE.Matrix4(), _pgQ = new THREE.Quaternion(), _pgS = new V3(1, 1, 1);
const _pgC = new THREE.Color();
// one merged mesh per material: geometries are baked in world space with a vertex colour each
class PGBatch {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.I = []; }
  get count() { return this.P.length / 3; }
  push(geo, m4, col) {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv, b = this.count;
    const nm = _pgN3.getNormalMatrix(m4);
    for (let i = 0; i < p.count; i++) {
      _pgV.fromBufferAttribute(p, i).applyMatrix4(m4); this.P.push(_pgV.x, _pgV.y, _pgV.z);
      _pgV.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); this.N.push(_pgV.x, _pgV.y, _pgV.z);
      if (uv) this.U.push(uv.getX(i), uv.getY(i)); else this.U.push(0, 0);
      this.C.push(col.r, col.g, col.b);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) this.I.push(b + geo.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.I.push(b + i);
    geo.dispose();
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setIndex(this.I); g.computeBoundingSphere();
    return g;
  }
}
// box UVs in metres / tm on every face (textures keep their scale whatever the box size)
function pgBoxGeo(dx, dy, dz, tm) {
  const g = new THREE.BoxGeometry(dx, dy, dz);
  if (tm) {
    const uv = g.attributes.uv, dims = [[dz, dy], [dz, dy], [dx, dz], [dx, dz], [dx, dy], [dx, dy]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tm, uv.getY(i) * dims[f][1] / tm); }
  }
  return g;
}
const PG_COL = {
  red: 0xc23a2e, yellow: 0xe9b524, blue: 0x2c64ad, green: 0x2f8a4c, teal: 0x1f8a8a, orange: 0xe2732a, purple: 0x6a4aa0,
  post: 0x2a6e3f, black: 0x1c1f22, grey: 0x8a9096, white: 0xf2f2ee
};

class PlaygroundEnvironment extends FieldEnvironment {
  constructor(game) {
    super(game);
    this.kind = 'playground'; this.name = 'Playground'; this.surface = 'grass'; this.outdoor = true;
    this.group.name = 'playground';
    this.bounds = { minX: PG.bx0, maxX: PG.bx1, minZ: PG.bz0, maxZ: PG.bz1 };
    this.flatGround = true; this.ledges = true; this.spreadSpawn = true; this.seatsOnly = true; this.seatChance = 0.35;
    this.boxes = []; this.obstacles = []; this.tops = []; this.slopes = []; this.benchSeats = [];
    this.trains = []; this.anyOpen = false;
    this.batches = new Map(); this.mats = {};
    this._near = [];
  }
  carAt() { return null; }
  // ------------------------------------------------------------------ build ---
  build() {
    const g = this.group, q = GFX.tier;
    const R = q === 'low' ? 14 : q === 'ultra' ? 26 : 19;
    this.fieldU = { uCenter: { value: new THREE.Vector2() }, uR: { value: R } };
    this.buildSkyLights();
    this.makeMaterials();
    // flat ground with the meadow material; paths, rubber and the street lie on top of it
    const T = 1000, tg = new THREE.PlaneGeometry(T, T, 8, 8);
    tg.rotateX(-Math.PI / 2);
    const cols = new Float32Array(tg.attributes.position.count * 3).fill(1);
    tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.groundMat = this.makeGroundMaterial(T);
    this.terrain = new THREE.Mesh(tg, this.groundMat); this.terrain.receiveShadow = true; this.terrain.name = 'terrain';
    g.add(this.terrain);
    this.grassMask = this.grassMaskGLSL();
    this.buildGrass(q, R);
    this.grassU.uBlade.value = 0.15;   // a mown park lawn, not a meadow
    this.buildGrounds();
    this.buildPlayStructure();
    this.buildSwings();
    this.buildClimber();
    this.buildMonkeyBars();
    this.buildTowerSlide();
    this.buildSeesaws();
    this.buildSpringRiders();
    this.buildFurniture();
    this.buildFences();
    this.buildStreet();
    this.buildHouses();
    this.flushBatches();
    this.buildTrees(q);
    this.buildHills();
    this.buildClouds();
    this.buildRain();
    this.buildPuddles();
    this.buildLampLights();
    // physics: flat ground (+ slides and seesaws as floors), solid equipment, walls at the park edge
    this.planes = [
      { n: new V3(1, 0, 0), d: PG.bx0 - 0.3 }, { n: new V3(-1, 0, 0), d: -(PG.bx1 + 0.3) },
      { n: new V3(0, 0, 1), d: PG.bz0 - 0.3 }, { n: new V3(0, 0, -1), d: -(PG.bz1 + 0.3) }
    ];
    this.heightfield = false;
    this.buildGrids();
    this.buildNav();
    this.birds = new PGBirds(this, q === 'low' ? 8 : 16);
    this.spawnPoints = [[0, 3], [-3, 1.5], [5.5, 4], [-2, 8.2], [12, -3.5], [-16.5, 0.5], [16.5, 3], [0, 16], [-6, 20], [8, 20], [0, -18], [24, 0], [-9, -11], [9, 12]].map(([x, z]) => new V3(x, this.baseHeight(x, z), z));
    this.cameraStart = { pos: new V3(0, 1.65, 17.5), yaw: 0, pitch: -0.1 };
    this.game.scene.environment = null;
    this.applyTimeWeather();
  }
  makeMaterials() {
    const M = this.mats, an = this.game.maxAniso || 4;
    const tex = (key, w, draw, rep) => { const t = Tex.make(key, w, w, draw); t.anisotropy = an; return t; };
    const rubber = tex('pgRubber', 256, (g2, w, h) => {
      g2.fillStyle = 'rgb(214,214,214)'; g2.fillRect(0, 0, w, h);
      const r = new RNG(5);
      for (let i = 0; i < 9000; i++) { const v = r.next(), c = v < 0.08 ? 60 : Math.round(170 + r.next() * 85); g2.fillStyle = `rgb(${c},${c},${c})`; const s = r.next() < 0.7 ? 1 : 2; g2.fillRect(Math.floor(r.next() * w), Math.floor(r.next() * h), s, s); }
    });
    const concrete = tex('pgConcrete', 256, (g2, w, h) => {
      g2.fillStyle = 'rgb(176,174,168)'; g2.fillRect(0, 0, w, h);
      const r = new RNG(11);
      for (let i = 0; i < 5000; i++) { const c = Math.round(140 + r.next() * 70); g2.fillStyle = `rgba(${c},${c - 2},${c - 6},0.55)`; g2.fillRect(Math.floor(r.next() * w), Math.floor(r.next() * h), 1 + Math.floor(r.next() * 2), 1); }
      for (let i = 0; i < 30; i++) { g2.fillStyle = `rgba(120,118,110,${0.05 + r.next() * 0.08})`; g2.beginPath(); g2.arc(r.next() * w, r.next() * h, 6 + r.next() * 24, 0, TAU); g2.fill(); }
      g2.fillStyle = 'rgba(70,70,66,0.55)'; g2.fillRect(0, 0, w, 2); g2.fillRect(0, 0, 2, h);   // expansion joints every 1.5 m
    });
    const asphalt = tex('pgAsphalt', 256, (g2, w, h) => {
      g2.fillStyle = 'rgb(58,60,62)'; g2.fillRect(0, 0, w, h);
      const r = new RNG(21);
      for (let i = 0; i < 9000; i++) { const c = Math.round(35 + r.next() * 70); g2.fillStyle = `rgb(${c},${c},${c + 2})`; g2.fillRect(Math.floor(r.next() * w), Math.floor(r.next() * h), 1, 1); }
      for (let i = 0; i < 14; i++) { g2.fillStyle = `rgba(30,30,32,${0.1 + r.next() * 0.15})`; g2.beginPath(); g2.arc(r.next() * w, r.next() * h, 10 + r.next() * 30, 0, TAU); g2.fill(); }
    });
    const wood = tex('pgWood', 256, (g2, w, h) => {
      g2.fillStyle = 'rgb(190,150,108)'; g2.fillRect(0, 0, w, h);
      const r = new RNG(31);
      for (let y = 0; y < h; y++) { const k = 0.5 + 0.5 * Math.sin(y * 0.21 + Math.sin(y * 0.05) * 3); g2.fillStyle = `rgba(120,80,45,${0.12 + 0.18 * k})`; g2.fillRect(0, y, w, 1); }
      for (let i = 0; i < 40; i++) { g2.fillStyle = 'rgba(90,60,35,0.25)'; g2.fillRect(r.next() * w, r.next() * h, 6 + r.next() * 30, 1); }
      for (let i = 0; i < 4; i++) { g2.fillStyle = 'rgba(70,45,25,0.5)'; g2.fillRect(0, Math.floor(i * h / 4), w, 2); }
    });
    const deck = tex('pgDeck', 128, (g2, w, h) => {
      g2.fillStyle = 'rgb(200,200,200)'; g2.fillRect(0, 0, w, h);
      g2.fillStyle = 'rgb(70,70,70)';
      for (let y = 4; y < h; y += 10) for (let x = 4 + ((y / 10) % 2) * 5; x < w; x += 10) { g2.beginPath(); g2.arc(x, y, 2.6, 0, TAU); g2.fill(); }
    });
    const siding = tex('pgSiding', 256, (g2, w, h) => {
      g2.fillStyle = 'rgb(232,232,228)'; g2.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) { const y = i * h / 16; const gr = g2.createLinearGradient(0, y, 0, y + h / 16); gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(0.18, 'rgba(0,0,0,0.04)'); gr.addColorStop(1, 'rgba(255,255,255,0.06)'); g2.fillStyle = gr; g2.fillRect(0, y, w, h / 16); }
    });
    const roof = tex('pgRoof', 256, (g2, w, h) => {
      g2.fillStyle = 'rgb(200,200,200)'; g2.fillRect(0, 0, w, h);
      const r = new RNG(41);
      for (let row = 0; row < 12; row++) { const y = row * h / 12, off = (row % 2) * 16; for (let x = -32 + off; x < w; x += 32) { const c = Math.round(150 + r.next() * 80); g2.fillStyle = `rgb(${c},${c},${c})`; g2.fillRect(x + 1, y + 1, 30, h / 12 - 2); } g2.fillStyle = 'rgba(0,0,0,0.45)'; g2.fillRect(0, y + h / 12 - 2, w, 2); }
    });
    const brick = tex('pgBrick', 256, (g2, w, h) => {
      g2.fillStyle = 'rgb(205,205,200)'; g2.fillRect(0, 0, w, h);
      const r = new RNG(51);
      for (let row = 0; row < 16; row++) { const y = row * 16, off = (row % 2) * 16; for (let x = -32 + off; x < w; x += 32) { const c = 0.75 + r.next() * 0.3; g2.fillStyle = `rgb(${Math.round(170 * c)},${Math.round(150 * c)},${Math.round(140 * c)})`; g2.fillRect(x + 1, y + 1, 30, 14); } }
    });
    const win = tex('pgWindow', 128, (g2, w, h) => {
      g2.fillStyle = 'rgb(245,245,240)'; g2.fillRect(0, 0, w, h);
      const gr = g2.createLinearGradient(0, 8, 0, h - 8); gr.addColorStop(0, 'rgb(150,178,200)'); gr.addColorStop(0.5, 'rgb(70,86,100)'); gr.addColorStop(1, 'rgb(46,52,60)');
      g2.fillStyle = gr; g2.fillRect(9, 9, w - 18, h - 18);
      g2.fillStyle = 'rgba(220,210,190,0.75)'; g2.fillRect(9, 9, 16, h - 18); g2.fillRect(w - 25, 9, 16, h - 18);   // curtains
      g2.fillStyle = 'rgb(245,245,240)'; g2.fillRect(w / 2 - 3, 9, 6, h - 18); g2.fillRect(9, h / 2 - 3, w - 18, 6);
    });
    const winGlow = tex('pgWindowGlow', 64, (g2, w, h) => {
      g2.fillStyle = 'rgb(0,0,0)'; g2.fillRect(0, 0, w, h);
      g2.fillStyle = 'rgb(255,196,120)'; g2.fillRect(5, 5, w - 10, h - 10);
      g2.fillStyle = 'rgb(0,0,0)'; g2.fillRect(w / 2 - 2, 5, 4, h - 10); g2.fillRect(5, h / 2 - 2, w - 10, 4);
    });
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMapIntensity: 0.6 }, o));
    M.rubber = std({ map: rubber, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 });
    M.concrete = std({ map: concrete, roughness: 0.9, envMapIntensity: 0.3 });
    M.asphalt = std({ map: asphalt, roughness: 0.92, envMapIntensity: 0.3 });
    M.paint = std({ roughness: 0.42, metalness: 0.35 });
    M.steel = std({ roughness: 0.3, metalness: 0.9 });
    M.plastic = std({ roughness: 0.28, metalness: 0, envMapIntensity: 0.8 });
    M.wood = std({ map: wood, roughness: 0.78, metalness: 0 });
    M.deck = std({ map: deck, roughness: 0.6, metalness: 0.25 });
    M.siding = std({ map: siding, roughness: 0.82 });
    M.roof = std({ map: roof, roughness: 0.92, envMapIntensity: 0.3 });
    M.brick = std({ map: brick, roughness: 0.9, envMapIntensity: 0.3 });
    M.window = std({ map: win, emissiveMap: winGlow, emissive: new THREE.Color(0, 0, 0), roughness: 0.18, metalness: 0.1, envMapIntensity: 1.2 });
    M.trim = std({ roughness: 0.6, metalness: 0 });
    M.lamp = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: new THREE.Color(0xffe0a0), emissiveIntensity: 0, roughness: 0.3 });
    M.seat = std({ roughness: 0.75, metalness: 0 });
    M.mark = std({ roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    for (const k of ['rubber', 'concrete', 'asphalt']) { M[k].polygonOffset = true; M[k].polygonOffsetFactor = -1; M[k].polygonOffsetUnits = -1; }
    // texture scale per material (metres per repeat) for boxes and ground quads
    this.tm = { rubber: 2, concrete: 1.5, asphalt: 6, wood: 1.2, deck: 0.5, siding: 2.4, roof: 3, brick: 2.4, mark: 1 };
    // instanced parts take their colour from the instance, not from vertex colours
    M.steelI = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.3, metalness: 0.9 });
    M.paintI = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.35 });
  }
  B(mat) { let b = this.batches.get(mat); if (!b) { b = new PGBatch(); this.batches.set(mat, b); } return b; }
  col(c) { return _pgC.set(c); }
  // axis-aligned box: o.collide (physics), o.obstacle (people walk round it), o.top (people can stand on it)
  box(mat, x0, y0, z0, x1, y1, z1, color, o = {}) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    _pgM.makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.B(mat).push(pgBoxGeo(dx, dy, dz, this.tm[mat]), _pgM, this.col(color != null ? color : 0xffffff));
    if (o.collide) this.collider(x0, y0, z0, x1, y1, z1);
    if (o.obstacle) this.obstacle(x0, z0, x1, z1, o);
    if (o.top) this.tops.push({ x0, x1, z0, z1, h: y1 });
  }
  collider(x0, y0, z0, x1, y1, z1) { this.boxes.push({ min: new V3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)), max: new V3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)) }); }
  obstacle(x0, z0, x1, z1, o = {}) { this.obstacles.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: -1, y1: 9, seat: !!o.seat }); }
  // a round bar from a to b
  bar(mat, a, b, r, color, seg = 8) {
    _pgV.subVectors(b, a); const len = _pgV.length(); if (len < 1e-4) return;
    const geo = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
    _pgQ.setFromUnitVectors(UP, _pgV.multiplyScalar(1 / len));
    _pgM.compose(_pgW.addVectors(a, b).multiplyScalar(0.5), _pgQ, _pgS);
    this.B(mat).push(geo, _pgM, this.col(color));
  }
  geo(mat, geo, m4, color) { this.B(mat).push(geo, m4 || _pgM.identity(), this.col(color)); }
  // a flat ground quad (paths, rubber, street, markings) at height y
  quad(mat, x0, z0, x1, z1, y, color) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv, t = this.tm[mat] || 1;
    for (let i = 0; i < uv.count; i++) { const p = g.attributes.position; uv.setXY(i, (p.getX(i) + (x0 + x1) / 2) / t, -(p.getZ(i) + (z0 + z1) / 2) / t); }
    _pgM.makeTranslation((x0 + x1) / 2, y, (z0 + z1) / 2);
    this.B(mat).push(g, _pgM, this.col(color));
  }
  flushBatches() {
    for (const [mat, b] of this.batches) {
      if (!b.count) continue;
      const m = new THREE.Mesh(b.geometry(), this.mats[mat]);
      m.receiveShadow = true;
      m.castShadow = !(mat === 'rubber' || mat === 'concrete' || mat === 'asphalt' || mat === 'mark');
      m.name = 'pg-' + mat;
      this.group.add(m);
    }
    this.batches.clear();
  }
  // grass grows everywhere except on the rubber, the paths, the sidewalk and the street
  noGrassRects() {
    if (this._ngr) return this._ngr;   // built once: ground lookups run thousands of times a frame
    const P = PG.play;
    return this._ngr = [
      [P.x0 - 0.1, P.z0 - 0.1, P.x1 + 0.1, P.z1 + 0.1],
      [-17.5, 11.5, 17.5, 13.5], [-17.5, -13.5, 17.5, -11.5], [-17.5, -11.5, -15.5, 11.5], [15.5, -11.5, 17.5, 11.5],
      [-1.1, 10, 1.1, 11.5], [-1.1, -11.5, 1.1, -10], [14, -1.1, 15.5, 1.1], [-15.5, -6.6, -14, -4.4],
      [-1.2, 13.5, 1.2, 40], [-1.2, -32, 1.2, -13.5], [17.5, -1.2, 40, 1.2], [-40, -1.2, -17.5, 1.2],
      [21, -8.5, 27, -2.5], [21, 2.5, 27, 8.5], [-27, -11, -21, -5],
      [-200, -200, 200, -32]
    ];
  }
  grassMaskGLSL() {
    const rects = this.noGrassRects().map(r => `m *= htOut(p, vec4(${r.map(v => v.toFixed(2)).join(', ')}));`).join('\n');
    return `float htOut(vec2 p, vec4 r) { vec2 d = max(r.xy - p, p - r.zw); return smoothstep(-0.02, 0.1, max(d.x, d.y)); }
float htGrassMask(vec2 p) { float m = 1.0; ${rects} return m; }`;
  }
  // rubber 2 cm up, paths 1.2 cm: what feet, bodies and blood stand on
  baseHeight(x, z) {
    const P = PG.play;
    if (x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1) return 0.02;
    return this.onPath(x, z) ? 0.012 : 0;
  }
  onPath(x, z) {
    if (z < -32) return z > -34.6;
    const R = this._ngr || this.noGrassRects();
    for (let i = 1; i < R.length - 1; i++) { const r = R[i]; if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return true; }
    return false;
  }
  buildGrounds() {
    const P = PG.play;
    // rubber safety surface in three colours, with a curb round it
    this.quad('rubber', P.x0, P.z0, P.x1, P.z1, 0.02, 0xa8483a);
    this.quad('rubber', -14, -0.6, -5.2, 5.8, 0.022, 0x3768a8);       // under the swings
    this.quad('rubber', -6, -10, 9, -3.6, 0.022, 0x3f8a52);           // under the play structure
    this.quad('rubber', 8.8, 2.2, 12.2, 10, 0.022, 0xd8a43a);         // under the tower slide
    this.quad('rubber', -13, -9.4, -8.6, -4.6, 0.022, 0x6a58a6);      // under the climbing frame
    for (const [x0, z0, x1, z1] of [[P.x0 - 0.18, P.z0 - 0.18, P.x1 + 0.18, P.z0], [P.x0 - 0.18, P.z1, P.x1 + 0.18, P.z1 + 0.18], [P.x0 - 0.18, P.z0, P.x0, P.z1], [P.x1, P.z0, P.x1 + 0.18, P.z1]])
      this.box('concrete', x0, 0, z0, x1, 0.06, z1, 0xd8d6d0);
    // hopscotch by the south gate
    const hs = [[0, 0], [0, 1], [-0.32, 2], [0.32, 2], [0, 3], [-0.32, 4], [0.32, 4], [0, 5]];
    for (const [ox, oz] of hs) {
      const cx = -3 + ox, cz = 9.2 - oz * 0.6;
      this.quad('mark', cx - 0.29, cz - 0.27, cx + 0.29, cz - 0.24, 0.024, PG_COL.white); this.quad('mark', cx - 0.29, cz + 0.24, cx + 0.29, cz + 0.27, 0.024, PG_COL.white);
      this.quad('mark', cx - 0.29, cz - 0.27, cx - 0.26, cz + 0.27, 0.024, PG_COL.white); this.quad('mark', cx + 0.26, cz - 0.27, cx + 0.29, cz + 0.27, 0.024, PG_COL.white);
    }
    // paths (concrete) - every rect of the grass mask but the rubber and the street
    const R = this.noGrassRects();
    for (let i = 1; i < R.length - 1; i++) { const r = R[i]; this.quad('concrete', r[0], r[1], Math.min(r[2], 40), Math.min(r[3], 40), 0.012, i >= 14 ? 0xc9c6bd : 0xd5d2ca); }
  }
  // ------------------------------------------------------------- equipment ---
  buildPlayStructure() {
    const H = PG.deckH, C = PG_COL;
    const decks = [{ x0: -3.6, x1: -1.6, roof: C.red }, { x0: 1.6, x1: 3.6, roof: C.yellow }], z0 = -8.2, z1 = -6.2;
    for (const d of decks) {
      this.box('deck', d.x0, H - 0.06, z0, d.x1, H, z1, 0x3d6b4f, { collide: true, top: true });
      for (const [px, pz] of [[d.x0, z0], [d.x1, z0], [d.x0, z1], [d.x1, z1]]) {
        const x = px + (px === d.x0 ? 0.06 : -0.06), z = pz + (pz === z0 ? 0.06 : -0.06);
        this.box('paint', x - 0.06, 0, z - 0.06, x + 0.06, 3.0, z + 0.06, C.post, { collide: true });
        this.box('paint', x - 0.08, 0, z - 0.08, x + 0.08, 0.12, z + 0.08, 0x30353a);
      }
      // a pitched canopy
      const cx = (d.x0 + d.x1) / 2, w = d.x1 - d.x0 + 0.3, dz = z1 - z0 + 0.3, ridge = 3.55, eave = 2.95;
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(w, 0.05, Math.hypot(dz / 2, ridge - eave));
        _pgQ.setFromAxisAngle(new V3(1, 0, 0), s * Math.atan2(ridge - eave, dz / 2));
        _pgM.compose(new V3(cx, (ridge + eave) / 2, (z0 + z1) / 2 + s * dz / 4), _pgQ, _pgS);
        this.geo('plastic', g, _pgM, d.roof);
      }
      this.bar('paint', new V3(d.x0 - 0.15, ridge, (z0 + z1) / 2), new V3(d.x1 + 0.15, ridge, (z0 + z1) / 2), 0.05, C.post);
    }
    // the bridge between the decks: planks on two chains, rope-like rails
    for (let i = 0; i < 11; i++) {
      const x = -1.6 + 0.05 + i * 0.29, sag = Math.sin(Math.PI * (i + 0.5) / 11) * 0.06;
      this.box('wood', x, H - 0.09 - sag, -7.75, x + 0.24, H - 0.04 - sag, -6.65, 0xb98a5c);
    }
    this.collider(-1.6, H - 0.16, -7.75, 1.6, H - 0.05, -6.65); this.tops.push({ x0: -1.6, x1: 1.6, z0: -7.75, z1: -6.65, h: H - 0.08 });
    for (const z of [-7.72, -6.68]) {
      this.bar('steel', new V3(-1.6, H + 0.75, z), new V3(1.6, H + 0.75, z), 0.025, 0xd0d4d8);
      this.collider(-1.6, H, z - 0.03, 1.6, H + 0.8, z + 0.03);
      for (let i = 0; i <= 6; i++) { const x = -1.6 + i * 3.2 / 6; this.bar('steel', new V3(x, H - 0.06, z), new V3(x, H + 0.75, z), 0.012, 0xd0d4d8, 5); }
    }
    // panels round the decks (openings: ladder west, bridge, slide east, climbing wall south of A, pole south of B)
    const panel = (x0, z0, x1, z1, col) => this.box('plastic', x0, H + 0.1, z0, x1, H + 0.85, z1, col, { collide: true });
    panel(-3.6, -8.2, -1.6, -8.16, C.blue); panel(1.6, -8.2, 3.6, -8.16, C.blue);
    panel(-3.6, -7.95, -3.56, -8.2, C.yellow); panel(-3.6, -6.45, -3.56, -6.2, C.yellow);
    panel(3.56, -8.2, 3.6, -7.5, C.red); panel(3.56, -6.9, 3.6, -6.2, C.red);
    panel(2.3, -6.24, 3.6, -6.2, C.green); panel(-1.6, -6.24, -1.9, -6.2, C.green);
    // ladder up to deck A from the west
    const lad = (xa, xb, zc, h, steps) => {
      for (const zo of [-0.27, 0.27]) {
        this.bar('paint', new V3(xa, 0, zc + zo), new V3(xb, h + 0.9, zc + zo), 0.035, C.post);
        for (let k = 0; k < 3; k++) { const t0 = k / 3, t1 = (k + 1) / 3, xx0 = lerp(xa, xb, t0), xx1 = lerp(xa, xb, t1); this.collider(Math.min(xx0, xx1) - 0.04, (h + 0.9) * t0, zc + zo - 0.04, Math.max(xx0, xx1) + 0.04, (h + 0.9) * t1, zc + zo + 0.04); }
      }
      for (let k = 1; k <= steps; k++) { const t = k / (steps + 1) * h / (h + 0.9), x = lerp(xa, xb, t), y = (h + 0.9) * t; this.box('paint', x - 0.04, y - 0.025, zc - 0.27, x + 0.04, y + 0.025, zc + 0.27, C.yellow); }
    };
    lad(-4.45, -3.62, -7.2, H, 5);
    // climbing wall below the south edge of deck A: a slanted panel with holds
    {
      const g = new THREE.BoxGeometry(1.6, 0.05, Math.hypot(0.9, H));
      _pgQ.setFromAxisAngle(new V3(1, 0, 0), -Math.atan2(0.9, H) + Math.PI / 2);
      const c = new V3(-2.6, H / 2, -6.2 + 0.45);
      _pgQ.setFromAxisAngle(new V3(1, 0, 0), Math.atan2(H, 0.9));
      _pgM.compose(c, _pgQ, _pgS); this.geo('plastic', g, _pgM, C.teal);
      const r = new RNG(7), hold = [C.red, C.yellow, C.orange, C.purple, C.blue];
      for (let i = 0; i < 12; i++) { const t = 0.12 + r.next() * 0.78, x = -3.25 + r.next() * 1.3, y = H * (1 - t), z = -6.2 + 0.9 * t + 0.035; const s = new THREE.SphereGeometry(0.045 + r.next() * 0.025, 7, 5); s.scale(1, 0.8, 0.6); _pgM.makeTranslation(x, y, z); this.geo('plastic', s, _pgM, hold[i % hold.length]); }
      for (let k = 0; k < 4; k++) { const t0 = k / 4, t1 = (k + 1) / 4; this.collider(-3.4, H * (1 - t1), -6.2 + 0.9 * t0 - 0.03, -1.8, H * (1 - t0), -6.2 + 0.9 * t1 + 0.03); }
    }
    // fireman's pole off deck B, with a hoop bar
    this.box('steel', 3.05, 0, -5.62, 3.11, 2.6, -5.56, 0xd0d4d8, { collide: true });
    this.bar('steel', new V3(3.08, 2.6, -5.59), new V3(3.08, 2.6, -6.2), 0.03, 0xd0d4d8);
    // the slide off deck B (east), with its sloped surface
    this.addSlide({ axis: 'x', a: 3.6, b: 8.0, c: -7.2, h0: H, run: 0.7, col: C.yellow, wave: 0 });
    this.obstacle(-4.7, -8.45, 8.1, -5.15);
  }
  // a slide chute along x (+ direction) or z (- direction): flat start, slope, run-out
  addSlide(S) {
    const len = Math.abs(S.b - S.a), dirS = Math.sign(S.b - S.a), hw = 0.28, y1 = 0.34;
    const yAt = (u) => { // u 0..1 along the chute
      const sl = len - S.run, d = u * len;
      if (d >= sl) return y1;
      const k = d / sl, s = k < 0.08 ? 0 : smoothstep(0.08, 1, k);
      return lerp(S.h0, y1, s) + (S.wave ? Math.sin(k * Math.PI * 3) * 0.06 * Math.sin(k * Math.PI) : 0);
    };
    S.yAt = yAt; S.hw = hw; S.len = len; S.dirS = dirS;
    this.slopes.push(S);
    // chute geometry: a U channel swept along the path
    const N = 28, P = [], Nn = [], Ix = [], prof = [[-hw - 0.03, 0.24], [-hw - 0.03, 0.02], [-hw, -0.01], [-hw * 0.6, -0.03], [0, -0.035], [hw * 0.6, -0.03], [hw, -0.01], [hw + 0.03, 0.02], [hw + 0.03, 0.24]];
    const pos = (u, o, y) => S.axis === 'x' ? [S.a + dirS * u * len, y, S.c + o] : [S.c + o, y, S.a + dirS * u * len];
    for (let i = 0; i <= N; i++) { const u = i / N, y = yAt(u) + 0.035; for (const [o, dy] of prof) P.push(...pos(u, o, y + dy)); }
    const m = prof.length;
    for (let i = 0; i < N; i++) for (let j = 0; j < m - 1; j++) { const a = i * m + j, b = a + m; Ix.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(Ix);
    if ((S.axis === 'x') === (dirS < 0)) g.index.array.reverse();
    g.computeVertexNormals();
    const g2 = g.clone(); g2.index.array.reverse(); g2.computeVertexNormals(); // outside of the channel
    this.geo('plastic', g, null, S.col); this.geo('plastic', g2, null, S.col);
    // side walls as stepped boxes; supports under the run-out
    for (let k = 0; k < 8; k++) {
      const u0 = k / 8, u1 = (k + 1) / 8, ya = Math.min(yAt(u0), yAt(u1)), yb = Math.max(yAt(u0), yAt(u1));
      for (const o of [-hw - 0.03, hw + 0.03]) {
        const p0 = pos(u0, o, 0), p1 = pos(u1, o, 0);
        this.collider(Math.min(p0[0], p1[0]) - 0.025, ya, Math.min(p0[2], p1[2]) - 0.025, Math.max(p0[0], p1[0]) + 0.025, yb + 0.27, Math.max(p0[2], p1[2]) + 0.025);
      }
    }
    for (const u of [0.55, 0.92]) for (const o of [-hw + 0.05, hw - 0.05]) { const p = pos(u, o, 0); this.box('steel', p[0] - 0.03, 0, p[2] - 0.03, p[0] + 0.03, yAt(u), p[2] + 0.03, 0xc8ccd0, { collide: true }); }
  }
  slideSurface(S, x, z) {
    const along = S.axis === 'x' ? (x - S.a) * S.dirS : (z - S.a) * S.dirS, side = S.axis === 'x' ? z - S.c : x - S.c;
    if (along < 0 || along > S.len || Math.abs(side) > S.hw) return null;
    const u = along / S.len, y = S.yAt(u), e = 0.02, dy = (S.yAt(Math.min(1, u + e / S.len)) - S.yAt(Math.max(0, u - e / S.len))) / (2 * e);
    return { y, slope: dy * S.dirS };
  }
  buildSwings() {
    const C = PG_COL, zc = 2.5, top = 2.45, xs = [-13.2, -9.5, -5.8];
    this.bar('paint', new V3(-13.4, top, zc), new V3(-5.6, top, zc), 0.055, C.red, 10);
    this.collider(-13.4, top - 0.06, zc - 0.06, -5.6, top + 0.06, zc + 0.06);
    for (const x of xs) for (const s of [-1, 1]) {
      const foot = new V3(x, 0, zc + s * 1.3), head = new V3(x, top + 0.02, zc + s * 0.06);
      this.bar('paint', foot, head, 0.045, C.red, 8);
      for (let k = 0; k < 3; k++) { const t0 = k / 3, t1 = (k + 1) / 3, za = lerp(foot.z, head.z, t0), zb = lerp(foot.z, head.z, t1); this.collider(x - 0.05, top * t0, Math.min(za, zb) - 0.05, x + 0.05, top * t1, Math.max(za, zb) + 0.05); }
      this.box('concrete', x - 0.12, 0, zc + s * 1.3 - 0.12, x + 0.12, 0.05, zc + s * 1.3 + 0.12, 0xb0aea8);
    }
    // four swings: pendulums swinging along z; seats and chains are their own meshes
    const L = 1.95;
    this.swings = [-12.3, -10.4, -8.6, -6.7].map((x, i) => ({ x, z: zc, y: top, L, th: (Math.random() - 0.5) * 0.08, w: 0, m: 4, i, creakT: 0, lastW: 0, baby: i === 3 }));
    const chainG = new THREE.CylinderGeometry(0.008, 0.008, L - 0.05, 4, 12); chainG.translate(0, -L / 2 + 0.02, 0);
    const pc = chainG.attributes.position; for (let i = 0; i < pc.count; i++) { const y = pc.getY(i); pc.setX(i, pc.getX(i) + Math.sin(y * 60) * 0.004); } // link wobble
    const parts = [];
    for (const s of [-0.22, 0.22]) { const c = chainG.clone(); c.translate(s, 0, 0); parts.push(c); }
    this.swingChain = new THREE.InstancedMesh(mergeGeoUV(parts), this.mats.steelI, 4);
    const seatG = pgBoxGeo(0.5, 0.035, 0.17); seatG.translate(0, -L, 0);
    const pseat = seatG.attributes.position; for (let i = 0; i < pseat.count; i++) { const x = pseat.getX(i); pseat.setY(i, pseat.getY(i) + x * x * 0.35); } // a sagging strap seat
    seatG.computeVertexNormals();
    const babyG = new THREE.CylinderGeometry(0.27, 0.22, 0.3, 14, 1, true); babyG.translate(0, -L + 0.1, 0);
    this.swingSeat = new THREE.InstancedMesh(seatG, new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.82 }), 4);
    this.swingBaby = new THREE.Mesh(babyG, new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.8, side: THREE.DoubleSide }));
    for (const m of [this.swingChain, this.swingSeat, this.swingBaby]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); }
    this.swingSeat.count = 3; // the fourth is the bucket seat
    this.obstacle(-13.6, zc - 1.95, -5.4, zc + 1.95);
    this.updateSwingMeshes();
  }
  buildClimber() {
    const x0 = -12.4, z0 = -8.6, n = 5, sp = 0.8, C = PG_COL;
    const cols = [C.yellow, C.blue];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const edge = i === 0 || j === 0 || i === n - 1 || j === n - 1; if (!edge) continue;
      const x = x0 + i * sp, z = z0 + j * sp;
      this.box('paint', x - 0.025, 0, z - 0.025, x + 0.025, 1.85, z + 0.025, cols[(i + j) % 2], { collide: true });
    }
    for (const y of [0.62, 1.24]) for (const [a, b] of [[[x0, z0], [x0 + 3.2, z0]], [[x0, z0 + 3.2], [x0 + 3.2, z0 + 3.2]], [[x0, z0], [x0, z0 + 3.2]], [[x0 + 3.2, z0], [x0 + 3.2, z0 + 3.2]]]) {
      this.bar('paint', new V3(a[0], y, a[1]), new V3(b[0], y, b[1]), 0.022, C.blue, 6);
      this.collider(Math.min(a[0], b[0]) - 0.025, y - 0.025, Math.min(a[1], b[1]) - 0.025, Math.max(a[0], b[0]) + 0.025, y + 0.025, Math.max(a[1], b[1]) + 0.025);
    }
    for (let i = 0; i < n; i++) {
      const x = x0 + i * sp, z = z0 + i * sp;
      this.bar('paint', new V3(x, 1.86, z0), new V3(x, 1.86, z0 + 3.2), 0.022, C.yellow, 6); this.collider(x - 0.025, 1.83, z0, x + 0.025, 1.89, z0 + 3.2);
      this.bar('paint', new V3(x0, 1.86, z), new V3(x0 + 3.2, 1.86, z), 0.022, C.yellow, 6); this.collider(x0, 1.83, z - 0.025, x0 + 3.2, 1.89, z + 0.025);
    }
    this.obstacle(x0 - 0.1, z0 - 0.1, x0 + 3.3, z0 + 3.3);
  }
  buildMonkeyBars() {
    const xa = 4.4, xb = 9.6, z0 = 0.7, z1 = 1.3, h = 2.1, C = PG_COL;
    for (const x of [xa, xb]) for (const z of [z0, z1]) this.box('paint', x - 0.04, 0, z - 0.04, x + 0.04, h, z + 0.04, C.blue, { collide: true });
    for (const x of [xa, xb]) for (let k = 1; k <= 5; k++) { const y = k * 0.34; this.bar('paint', new V3(x, y, z0), new V3(x, y, z1), 0.02, C.yellow, 6); }
    for (const z of [z0, z1]) { this.bar('paint', new V3(xa, h, z), new V3(xb, h, z), 0.035, C.blue, 8); this.collider(xa, h - 0.04, z - 0.04, xb, h + 0.04, z + 0.04); }
    for (let k = 1; k < 13; k++) { const x = lerp(xa, xb, k / 13); this.bar('steel', new V3(x, h + 0.02, z0), new V3(x, h + 0.02, z1), 0.018, 0xd0d4d8, 6); }
    this.obstacle(xa - 0.1, z0 - 0.1, xb + 0.1, z1 + 0.1);
  }
  buildTowerSlide() {
    const C = PG_COL, x0 = 9.9, x1 = 11.1, z0 = 7.0, z1 = 8.2, h = 1.8;
    this.box('deck', x0, h - 0.06, z0, x1, h, z1, 0x3d4f6b, { collide: true, top: true });
    for (const [x, z] of [[x0 + 0.05, z0 + 0.05], [x1 - 0.05, z0 + 0.05], [x0 + 0.05, z1 - 0.05], [x1 - 0.05, z1 - 0.05]]) this.box('paint', x - 0.05, 0, z - 0.05, x + 0.05, h + 0.95, z + 0.05, C.orange, { collide: true });
    for (const [a, b] of [[[x0, z0 + 0.05], [x0, z1]], [[x1, z0 + 0.05], [x1, z1]]]) { this.bar('paint', new V3(a[0], h + 0.9, a[1]), new V3(b[0], h + 0.9, b[1]), 0.03, C.orange); this.collider(a[0] - 0.03, h, a[1], a[0] + 0.03, h + 0.93, b[1]); }
    this.box('plastic', x0, h + 0.1, z0, x0 + 0.05, h + 0.75, z1, C.green, { collide: true }); this.box('plastic', x1 - 0.05, h + 0.1, z0, x1, h + 0.75, z1, C.green, { collide: true });
    // ladder from the south
    for (const xo of [-0.27, 0.27]) {
      this.bar('paint', new V3(10.5 + xo, 0, 9.3), new V3(10.5 + xo, h + 0.9, z1), 0.035, C.orange);
      for (let k = 0; k < 3; k++) { const t0 = k / 3, t1 = (k + 1) / 3; this.collider(10.5 + xo - 0.04, (h + 0.9) * t0, lerp(9.3, z1, t1) - 0.04, 10.5 + xo + 0.04, (h + 0.9) * t1, lerp(9.3, z1, t0) + 0.04); }
    }
    for (let k = 1; k <= 6; k++) { const t = k / 7 * h / (h + 0.9), z = lerp(9.3, z1, t), y = (h + 0.9) * t; this.box('paint', 10.23, y - 0.025, z - 0.04, 10.77, y + 0.025, z + 0.04, C.yellow); }
    this.addSlide({ axis: 'z', a: z0, b: 2.8, c: 10.5, h0: h, run: 0.7, col: C.red, wave: 1 });
    this.obstacle(9.75, 2.7, 11.25, 9.4);
  }
  buildSeesaws() {
    this.seesaws = [];
    for (const [px, pz, col] of [[-8, 6.6, PG_COL.green], [-8, 8.6, PG_COL.orange]]) {
      const S = { x: px, z: pz, y: 0.55, half: 1.8, phi: (Math.random() < 0.5 ? -1 : 1) * 0.25, w: 0, I: 26, col, bias: Math.random() < 0.5 ? -1 : 1 };
      S.max = Math.asin((S.y - 0.1) / S.half);
      this.seesaws.push(S);
      // the fulcrum frame and the bumper tyres stay put
      this.box('paint', px - 0.07, 0, pz - 0.2, px + 0.07, S.y - 0.05, pz - 0.14, PG_COL.black, { collide: true });
      this.box('paint', px - 0.07, 0, pz + 0.14, px + 0.07, S.y - 0.05, pz + 0.2, PG_COL.black, { collide: true });
      this.bar('steel', new V3(px, S.y - 0.04, pz - 0.22), new V3(px, S.y - 0.04, pz + 0.22), 0.05, 0xb8bcc0);
      for (const s of [-1, 1]) { const t = new THREE.TorusGeometry(0.17, 0.06, 6, 14); t.rotateY(Math.PI / 2); _pgM.makeTranslation(px + s * 1.65, 0.07, pz); this.geo('seat', t, _pgM, 0x1e1f21); }
      this.obstacle(px - 1.95, pz - 0.35, px + 1.95, pz + 0.35);
    }
    // the moving boards: plank, handles and seat pads, about the pivot
    const parts = [];
    const plank = pgBoxGeo(3.6, 0.06, 0.26); plank.translate(0, 0.03, 0); parts.push(plank);
    for (const s of [-1, 1]) {
      const h1 = new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6); h1.translate(s * 1.3, 0.22, 0); parts.push(h1);
      const h2 = new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6); h2.rotateX(Math.PI / 2); h2.translate(s * 1.3, 0.38, 0); parts.push(h2);
      const pad = pgBoxGeo(0.42, 0.05, 0.3); pad.translate(s * 1.58, 0.085, 0); parts.push(pad);
    }
    this.seesawMesh = new THREE.InstancedMesh(mergeGeoUV(parts), this.mats.paintI, this.seesaws.length);
    for (let i = 0; i < this.seesaws.length; i++) this.seesawMesh.setColorAt(i, new THREE.Color(this.seesaws[i].col));
    this.seesawMesh.castShadow = true; this.seesawMesh.receiveShadow = true; this.seesawMesh.frustumCulled = false;
    this.group.add(this.seesawMesh);
    this.updateSeesawMeshes();
  }
  seesawSurface(S, x, z) {
    if (Math.abs(z - S.z) > 0.22 || Math.abs(x - S.x) > S.half) return null;
    return { y: S.y + 0.06 - (x - S.x) * Math.sin(S.phi), slope: -Math.sin(S.phi) };
  }
  buildSpringRiders() {
    const C = PG_COL;
    this.riders = [[1.8, 5.2, 'duck', C.yellow, 0.4], [3.7, 6.6, 'horse', C.red, -0.6], [1.6, 7.9, 'bug', C.green, 2.3]].map(([x, z, kind, col, yaw]) => ({ x, z, kind, col, yaw, ax: 0, az: 0, vx: 0, vz: 0 }));
    // the coil spring and base plate (static), the figure on top (wobbles)
    for (const r of this.riders) {
      const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * TAU * 6; pts.push(new V3(r.x + Math.cos(a) * 0.1, 0.06 + t * 0.32, r.z + Math.sin(a) * 0.1)); }
      this.geo('steel', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.016, 5), null, 0xd8a03a);
      this.box('paint', r.x - 0.2, 0, r.z - 0.2, r.x + 0.2, 0.05, r.z + 0.2, 0x55595e);
      this.collider(r.x - 0.32, 0, r.z - 0.32, r.x + 0.32, 0.85, r.z + 0.32);
      this.obstacle(r.x - 0.4, r.z - 0.4, r.x + 0.4, r.z + 0.4);
    }
    this.riderMeshes = this.riders.map(r => {
      const parts = [], S = (rx, ry, rz, x, y, z, seg = 12) => { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)); g.scale(rx, ry, rz); g.translate(x, y, z); parts.push(g); return g; };
      const cyl = (r0, h, x, y, z, rx = 0, rz = 0) => { const g = new THREE.CylinderGeometry(r0, r0, h, 8); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); parts.push(g); };
      if (r.kind === 'duck') { S(0.2, 0.15, 0.3, 0, 0.12, 0); S(0.12, 0.12, 0.12, 0, 0.36, 0.22); S(0.05, 0.025, 0.08, 0, 0.34, 0.36, 8); S(0.06, 0.12, 0.08, 0, 0.18, -0.3, 8); }
      else if (r.kind === 'horse') { S(0.15, 0.14, 0.34, 0, 0.12, 0); S(0.07, 0.16, 0.08, 0, 0.32, 0.27); S(0.07, 0.07, 0.16, 0, 0.44, 0.36); S(0.03, 0.06, 0.03, 0.04, 0.53, 0.3, 6); S(0.03, 0.06, 0.03, -0.04, 0.53, 0.3, 6); }
      else { S(0.24, 0.13, 0.28, 0, 0.12, 0); S(0.12, 0.1, 0.1, 0, 0.18, 0.28); S(0.02, 0.1, 0.02, 0.06, 0.3, 0.32, 6); S(0.02, 0.1, 0.02, -0.06, 0.3, 0.32, 6); }
      cyl(0.016, 0.34, 0, 0.32, r.kind === 'horse' ? 0.2 : 0.16, 0, Math.PI / 2);
      S(0.13, 0.03, 0.12, 0, 0.26, -0.04, 10);
      const g = mergeGeoUV(parts);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: r.col, roughness: 0.3, metalness: 0.05, envMapIntensity: 0.8 }));
      m.castShadow = true; m.receiveShadow = true; this.group.add(m);
      return m;
    });
    this.updateRiderMeshes();
  }
  // benches, picnic tables, bins, lamp posts
  buildFurniture() {
    const C = PG_COL;
    this.lampPosts = [];
    const bench = (x, z, yaw) => {
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      // local frame: +f is the way the sitter faces; seat slats run along r
      const L = (a, b, c) => [x + rx * a + fx * c, b, z + rz * a + fz * c];
      const bx = (a0, b0, c0, a1, b1, c1, mat, col, o) => { const p = L(a0, b0, c0), q2 = L(a1, b1, c1); this.box(mat, Math.min(p[0], q2[0]), b0, Math.min(p[2], q2[2]), Math.max(p[0], q2[0]), b1, Math.max(p[2], q2[2]), col, o); };
      for (let k = 0; k < 4; k++) bx(-0.9, 0.42, -0.2 + k * 0.105, 0.9, 0.455, -0.11 + k * 0.105, 'wood', 0xa8754a);
      for (let k = 0; k < 3; k++) bx(-0.9, 0.55 + k * 0.12, -0.28, 0.9, 0.64 + k * 0.12, -0.25, 'wood', 0xa8754a);
      for (const a of [-0.78, 0.78]) { bx(a - 0.03, 0, -0.24, a + 0.03, 0.43, 0.2, 'paint', C.black); bx(a - 0.03, 0.43, -0.3, a + 0.03, 0.92, -0.24, 'paint', C.black); }
      const p0 = L(-0.92, 0, -0.32), p1 = L(0.92, 0, 0.24);
      this.collider(Math.min(p0[0], p1[0]), 0, Math.min(p0[2], p1[2]), Math.max(p0[0], p1[0]), 0.46, Math.max(p0[2], p1[2]));
      const b0 = L(-0.92, 0, -0.32), b1 = L(0.92, 0, -0.22);
      this.collider(Math.min(b0[0], b1[0]), 0.46, Math.min(b0[2], b1[2]), Math.max(b0[0], b1[0]), 0.92, Math.max(b0[2], b1[2]));
      const t0 = L(-0.9, 0, -0.2), t1 = L(0.9, 0, 0.2);
      this.tops.push({ x0: Math.min(t0[0], t1[0]), x1: Math.max(t0[0], t1[0]), z0: Math.min(t0[2], t1[2]), z1: Math.max(t0[2], t1[2]), h: 0.455 });
      this.obstacle(Math.min(p0[0], p1[0]), Math.min(p0[2], p1[2]), Math.max(p0[0], p1[0]), Math.max(p0[2], p1[2]), { seat: true });
      for (const a of [-0.55, 0, 0.55]) { const s = L(a, 0, -0.08); this.benchSeats.push({ x: s[0], y: this.baseHeight(s[0], s[2]), z: s[2], yaw, h: 0.455, occupant: null, kind: 'bench' }); }
    };
    bench(-8, 13.95, Math.PI); bench(8, 13.95, Math.PI); bench(-8, -13.95, 0); bench(8, -13.95, 0);
    bench(-17.95, 5, Math.PI / 2); bench(17.95, -5, -Math.PI / 2); bench(-12.6, 9.25, Math.PI); bench(6.2, 9.25, Math.PI);
    // picnic tables: the top and two benches on A-frame legs; people sit facing the table
    const picnic = (x, z) => {
      this.box('wood', x - 0.95, 0.72, z - 0.4, x + 0.95, 0.77, z + 0.4, 0xb3825a, { collide: true, obstacle: true, seat: true, top: true });
      for (const s of [-1, 1]) {
        this.box('wood', x - 0.95, 0.42, z + s * 0.58 - 0.14, x + 0.95, 0.46, z + s * 0.58 + 0.14, 0xb3825a, { collide: true, top: true });
        this.obstacle(x - 0.95, z + s * 0.58 - 0.14, x + 0.95, z + s * 0.58 + 0.14, { seat: true });
        for (const a of [-0.45, 0.45]) this.benchSeats.push({ x: x + a, y: this.baseHeight(x + a, z), z: z + s * 0.68, yaw: s > 0 ? Math.PI : 0, h: 0.46, occupant: null, kind: 'picnic' });
      }
      for (const a of [-0.72, 0.72]) {
        for (const s of [-1, 1]) this.bar('paint', new V3(x + a, 0, z + s * 0.7), new V3(x + a, 0.72, z + s * 0.12), 0.03, 0x3a3f44);
        this.bar('paint', new V3(x + a, 0.44, z - 0.72), new V3(x + a, 0.44, z + 0.72), 0.025, 0x3a3f44);
        this.collider(x + a - 0.04, 0, z - 0.72, x + a + 0.04, 0.72, z + 0.72);
      }
    };
    picnic(24, -5.5); picnic(24, 5.5); picnic(-24, -8);
    // bins
    const bin = (x, z) => {
      const g = new THREE.CylinderGeometry(0.3, 0.27, 0.92, 16, 1, true); _pgM.makeTranslation(x, 0.46, z); this.geo('paint', g, _pgM, 0x2c5a3a);
      const lid = new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16); _pgM.makeTranslation(x, 0.95, z); this.geo('paint', lid, _pgM, 0x23472f);
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; this.bar('paint', new V3(x + Math.cos(a) * 0.305, 0.08, z + Math.sin(a) * 0.305), new V3(x + Math.cos(a) * 0.285, 0.88, z + Math.sin(a) * 0.285), 0.012, 0x1f3d28, 4); }
      this.collider(x - 0.3, 0, z - 0.3, x + 0.3, 0.98, z + 0.3); this.obstacle(x - 0.32, z - 0.32, x + 0.32, z + 0.32);
    };
    for (const [x, z] of [[-6.6, 14.1], [9.4, 14.1], [18.0, -7.0], [-18.0, 7.0], [21.6, 0.0 + 2.2], [3.2, -14.0], [-22, -10.5], [-13.8, 11.2]]) bin(x, z);
    // lamp posts (a lantern on a fluted pole)
    const lamp = (x, z) => {
      this.box('paint', x - 0.11, 0, z - 0.11, x + 0.11, 0.35, z + 0.11, 0x24272a);
      this.bar('paint', new V3(x, 0.35, z), new V3(x, 4.1, z), 0.055, 0x24272a, 10);
      const head = new THREE.CylinderGeometry(0.2, 0.12, 0.42, 8, 1); _pgM.makeTranslation(x, 4.32, z); this.geo('paint', head, _pgM, 0x24272a);
      const cap = new THREE.ConeGeometry(0.28, 0.2, 8); _pgM.makeTranslation(x, 4.63, z); this.geo('paint', cap, _pgM, 0x24272a);
      const glass = new THREE.CylinderGeometry(0.17, 0.11, 0.34, 8, 1, true); _pgM.makeTranslation(x, 4.32, z); this.geo('lampG', glass, _pgM, 0xffffff);
      this.collider(x - 0.07, 0, z - 0.07, x + 0.07, 4.2, z + 0.07); this.obstacle(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
      this.lampPosts.push(new V3(x, 4.32, z));
    };
    this.mats.lampG = this.mats.lamp;
    for (const [x, z] of [[-16.5, -12.5], [16.5, -12.5], [-16.5, 12.5], [16.5, 12.5], [0, 23], [0, -22], [27, 0], [-27, 0], [-30, -33.4], [-10, -33.4], [10, -33.4], [30, -33.4]]) lamp(x, z);
  }
  buildFences() {
    const P = PG.play, gates = { s: [-1.1, 1.1], n: [-1.1, 1.1], e: [-1.1, 1.1], w: [-6.6, -4.4] }, H = 1.0, col = 0x1f2326;
    const run = (axis, fixed, a, b) => { // a fence line from a to b along axis at fixed
      const len = b - a; if (len < 0.2) return;
      const n = Math.max(1, Math.round(len / 2));
      for (let k = 0; k <= n; k++) { const t = a + len * k / n; if (axis === 'x') this.box('paint', t - 0.035, 0, fixed - 0.035, t + 0.035, H + 0.06, fixed + 0.035, col); else this.box('paint', fixed - 0.035, 0, t - 0.035, fixed + 0.035, H + 0.06, t + 0.035, col); }
      for (const y of [0.12, H - 0.04]) { if (axis === 'x') this.box('paint', a, y - 0.02, fixed - 0.015, b, y + 0.02, fixed + 0.015, col); else this.box('paint', fixed - 0.015, y - 0.02, a, fixed + 0.015, y + 0.02, b, col); }
      for (let t = a + 0.12; t < b - 0.05; t += 0.12) { if (axis === 'x') this.box('paint', t - 0.009, 0.1, fixed - 0.009, t + 0.009, H - 0.02, fixed + 0.009, col); else this.box('paint', fixed - 0.009, 0.1, t - 0.009, fixed + 0.009, H - 0.02, t + 0.009, col); }
      // a thick invisible collider so limp bodies never straddle the thin pickets
      if (axis === 'x') { this.collider(a, 0, fixed - 0.1, b, H, fixed + 0.1); this.obstacle(a, fixed - 0.05, b, fixed + 0.05); }
      else { this.collider(fixed - 0.1, 0, a, fixed + 0.1, H, b); this.obstacle(fixed - 0.05, a, fixed + 0.05, b); }
    };
    run('x', P.z1, P.x0, gates.s[0]); run('x', P.z1, gates.s[1], P.x1);
    run('x', P.z0, P.x0, gates.n[0]); run('x', P.z0, gates.n[1], P.x1);
    run('z', P.x1, P.z0, gates.e[0]); run('z', P.x1, gates.e[1], P.z1);
    run('z', P.x0, P.z0, gates.w[0]); run('z', P.x0, gates.w[1], P.z1);
  }
  // the street and sidewalks to the north
  buildStreet() {
    this.quad('concrete', -200, -34.5, 200, -32, 0.012, 0xcfccc4);
    this.box('concrete', -200, 0, -34.62, 200, 0.14, -34.5, 0xbab7ae);
    this.quad('asphalt', -200, -43.5, 200, -34.62, 0.004, 0xffffff);
    this.box('concrete', -200, 0, -43.62, 200, 0.14, -43.5, 0xbab7ae);
    this.quad('concrete', -200, -46, 200, -43.62, 0.012, 0xcfccc4);
    for (const zz of [-39.13, -38.97]) this.quad('mark', -200, zz - 0.06, 200, zz + 0.06, 0.008, 0xe2b93a);
    for (const zz of [-35.1, -43.0]) this.quad('mark', -200, zz - 0.06, 200, zz + 0.06, 0.008, 0xe6e6e0);
    for (let k = 0; k < 8; k++) this.quad('mark', -2.2 + k * 0.6, -43.4, -1.9 + k * 0.6, -34.7, 0.009, 0xe6e6e0); // crosswalk
    // parked cars along the far side (simple saloon shapes)
    const r = new RNG(77), cols = [0x8c1d18, 0x24344f, 0xd8d8d4, 0x2e3133, 0x5d6c74, 0x0f4a3a];
    for (const x of [-38, -21, -9, 12, 27, 43]) this.car(x + r.range(-1, 1), -42.2, cols[Math.floor(r.next() * cols.length)]);
  }
  car(x, z, col) {
    const L = 4.4, W = 1.8;
    this.box('paint', x - L / 2, 0.3, z - W / 2, x + L / 2, 0.85, z + W / 2, col);
    const cab = new THREE.BoxGeometry(2.3, 0.55, W - 0.12); const p = cab.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) * 0.78);
    cab.computeVertexNormals(); _pgM.makeTranslation(x - 0.2, 1.12, z); this.geo('plastic', cab, _pgM, 0x2a323a);
    for (const a of [-1.35, 1.35]) for (const s of [-1, 1]) { const t = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14); t.rotateX(Math.PI / 2); _pgM.makeTranslation(x + a, 0.32, z + s * (W / 2 - 0.08)); this.geo('seat', t, _pgM, 0x161718); }
  }
  // two-storey houses across the street, more round the park, an apartment block to the west
  buildHouses() {
    const r = new RNG(2024), sid = [0xe8e2d4, 0xc9d6dc, 0xd7c49e, 0xb8c9b0, 0xe6d3c3, 0xa9b7c6, 0xd9d9d9, 0xc4a98c], roofs = [0x4a4d52, 0x5a3b30, 0x3d4a5a, 0x6b6b66];
    const house = (cx, cz, face, w, d) => { // face: the direction the front door looks (+1: south/+z, -1: north, 2: east, -2: west)
      const rot = face === 1 ? 0 : face === -1 ? Math.PI : face === 2 ? Math.PI / 2 : -Math.PI / 2;
      const c = Math.cos(rot), s = Math.sin(rot);
      const T = (lx, ly, lz) => new V3(cx + lx * c + lz * s, ly, cz - lx * s + lz * c);
      const Bx = (mat, x0, y0, z0, x1, y1, z1, col) => { const a = T(x0, y0, z0), b = T(x1, y1, z1); this.box(mat, Math.min(a.x, b.x), y0, Math.min(a.z, b.z), Math.max(a.x, b.x), y1, Math.max(a.z, b.z), col); };
      const wallH = 5.8, sc = sid[Math.floor(r.next() * sid.length)], rc = roofs[Math.floor(r.next() * roofs.length)];
      Bx('brick', -w / 2 - 0.05, 0, -d / 2 - 0.05, w / 2 + 0.05, 0.6, d / 2 + 0.05, 0xb0a8a0);
      Bx('siding', -w / 2, 0.6, -d / 2, w / 2, wallH, d / 2, sc);
      // gable roof along the width
      const rh = 2.6 + r.next() * 0.6, over = 0.45;
      for (const sg of [-1, 1]) {
        const g = new THREE.BoxGeometry(w + over * 2, 0.12, Math.hypot(d / 2 + over, rh)); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w + 1) / 3, uv.getY(i) * (d / 2 + over) / 3);
        _pgQ.setFromAxisAngle(new V3(1, 0, 0), sg * Math.atan2(rh, d / 2 + over)).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, rot));
        _pgM.compose(T(0, wallH + rh / 2 - 0.05, sg * (d / 2 + over) / 2), _pgQ, _pgS); this.geo('roof', g, _pgM, rc);
      }
      for (const sg of [-1, 1]) { // gable ends
        const sh = new THREE.Shape(); sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(0, rh); sh.lineTo(-d / 2, 0);
        const g = new THREE.ShapeGeometry(sh); g.rotateY(sg * Math.PI / 2);
        _pgQ.setFromAxisAngle(UP, rot); _pgM.compose(T(sg * w / 2, wallH, 0), _pgQ, _pgS); this.geo('siding', g, _pgM, sc);
      }
      if (r.next() < 0.7) Bx('brick', w * 0.25, wallH, -0.4, w * 0.25 + 0.7, wallH + rh + 0.6, 0.3, 0x8a5a48);
      // windows, door, porch on the front (+z local)
      const fz = d / 2 + 0.03;
      for (const y of [1.3, 3.9]) for (const x of [-w * 0.33, w * 0.33]) { Bx('window', x - 0.55, y, fz - 0.02, x + 0.55, y + 1.3, fz, 0xffffff); Bx('trim', x - 0.65, y - 0.12, fz - 0.01, x + 0.65, y - 0.02, fz + 0.06, 0xf4f2ec); }
      for (const x of [0]) Bx('window', x - 0.5, 3.9, fz - 0.02, x + 0.5, 5.1, fz, 0xffffff);
      Bx('trim', -0.5, 0.6, fz - 0.02, 0.5, 2.7, fz + 0.03, [0x7a2420, 0x2b3d5c, 0x2f4a33, 0x3a3a3a][Math.floor(r.next() * 4)]);
      Bx('wood', -1.6, 0.4, fz, 1.6, 0.6, fz + 1.8, 0x9c7a5a);
      for (const x of [-1.5, 1.5]) Bx('trim', x - 0.08, 0.6, fz + 1.62, x + 0.08, 3.0, fz + 1.78, 0xf4f2ec);
      Bx('trim', -1.7, 3.0, fz, 1.7, 3.15, fz + 1.9, 0xf4f2ec);
      for (const x of [-w * 0.33, w * 0.33]) for (const zz of [-d / 2 - 0.03]) Bx('window', x - 0.55, 1.3, zz, x + 0.55, 2.6, zz + 0.02, 0xffffff);
      for (const sg of [-1, 1]) Bx('window', sg * (w / 2 + 0.02) - 0.01, 1.4, -0.6, sg * (w / 2 + 0.02) + 0.01, 2.6, 0.6, 0xffffff);
      // a walkway and a white picket fence along the lot front
      const lot = 6.0, fA = T(-w / 2 - 1.5, 0, fz + lot), fB = T(w / 2 + 1.5, 0, fz + lot);
      const wa = T(-0.6, 0, fz), wb = T(0.6, 0, fz + lot);
      this.quad('concrete', Math.min(wa.x, wb.x), Math.min(wa.z, wb.z), Math.max(wa.x, wb.x), Math.max(wa.z, wb.z), 0.012, 0xd0cdc5);
      const n = Math.round(w + 3) * 6;
      for (let k = 0; k <= n; k++) { const t = k / n, x = lerp(-w / 2 - 1.5, w / 2 + 1.5, t); if (Math.abs(x) < 0.7) continue; Bx('trim', x - 0.03, 0, fz + lot - 0.015, x + 0.03, 0.9, fz + lot + 0.015, 0xf6f6f2); }
      for (const y of [0.25, 0.7]) { Bx('trim', -w / 2 - 1.5, y, fz + lot - 0.03, -0.7, y + 0.06, fz + lot - 0.015, 0xf6f6f2); Bx('trim', 0.7, y, fz + lot - 0.03, w / 2 + 1.5, y + 0.06, fz + lot - 0.015, 0xf6f6f2); }
      void fA; void fB;
    };
    for (const x of [-48, -32, -16, 0, 16, 32, 48]) house(x + r.range(-1.2, 1.2), -57, 1, 9.5 + r.range(0, 2), 8.5);
    for (const z of [-18, -2, 14]) house(56, z + r.range(-1, 1), -2, 9 + r.range(0, 1.5), 8.5);
    for (const x of [-36, -18, 18, 36]) house(x + r.range(-1, 1), 50, -1, 9.5 + r.range(0, 1.5), 8.5);
    // the apartment block to the west: brick, four floors of windows
    this.box('brick', -62, 0, -24, -48, 13.2, 6, 0xb46a52);
    this.box('trim', -62.4, 13.2, -24.4, -47.6, 13.6, 6.4, 0x9c9a94);
    for (let f = 0; f < 4; f++) for (let k = 0; k < 9; k++) { const z = -21.5 + k * 3.1, y = 1.2 + f * 3.1; this.box('window', -48.02, y, z - 0.6, -47.98, y + 1.5, z + 0.6, 0xffffff); }
    this.box('trim', -47.98, 0, -10.2, -47.9, 2.6, -8.2, 0x3a3f44);
  }
  // ------------------------------------------------------------- trees ---
  buildTrees(q) {
    const rr = new RNG(9191);
    this.treeU = { uTime: { value: 0 }, uWind: { value: 0.4 } };
    const n = { b: 40, c: 14, s: q === 'low' ? 50 : 80, f: q === 'low' ? 200 : 360 };
    const meshes = { b: new THREE.InstancedMesh(makeBroadleaf(11), this.vegMaterial(1), n.b), c: new THREE.InstancedMesh(makeConifer(23), this.vegMaterial(1), n.c), s: new THREE.InstancedMesh(makeBush(37), this.vegMaterial(0.45), n.s), f: new THREE.InstancedMesh(makeFarTree(), this.vegMaterial(1), n.f) };
    const cnt = { b: 0, c: 0, s: 0, f: 0 }, m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), col = new THREE.Color();
    const clear = (x, z, r) => {
      if (Math.abs(x) < 17.5 + r && Math.abs(z) < 13.5 + r) return false;
      if (this.onPath(x, z) || this.onPath(x + r, z) || this.onPath(x - r, z) || this.onPath(x, z + r) || this.onPath(x, z - r)) return false;
      for (const o of this.obstacles) if (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) return false;
      return true;
    };
    const place = (kind, x, z, s, sy) => {
      if (cnt[kind] >= n[kind]) return false;
      qq.setFromAxisAngle(UP, rr.range(0, TAU)); m4.compose(new V3(x, -0.12, z), qq, new V3(s, s * sy, s));
      const i = cnt[kind]++; meshes[kind].setMatrixAt(i, m4);
      col.setHSL(rr.range(-0.025, 0.035), rr.range(0, 0.18), 1).lerp(new THREE.Color(1, 1, 1), 0.55).multiplyScalar(rr.range(0.85, 1.12)); meshes[kind].setColorAt(i, col);
      if (kind !== 'f') this.treeSpots.push({ x, z, r: kind === 's' ? 0.7 * s : 0.35 * s, kind });
      return true;
    };
    this.treeSpots = [];
    // shade trees in the park: in a loose ring round the playground and along the edges
    let guard = 0;
    while (cnt.b < 26 && guard++ < 3000) { const x = rr.range(-33, 33), z = rr.range(-30, 30); if (!clear(x, z, 2.2)) continue; if (this.treeSpots.some(t => Math.hypot(t.x - x, t.z - z) < 6.5)) continue; place('b', x, z, rr.range(0.75, 1.15), rr.range(0.9, 1.15)); }
    guard = 0;
    while (cnt.c < 6 && guard++ < 2000) { const x = rr.range(-33, 33), z = rr.range(-30, 30); if (!clear(x, z, 1.8) || this.treeSpots.some(t => Math.hypot(t.x - x, t.z - z) < 5)) continue; place('c', x, z, rr.range(0.7, 1.0), rr.range(0.9, 1.2)); }
    // bushes: along the park edges and at the fence corners
    guard = 0;
    while (cnt.s < n.s * 0.75 && guard++ < 6000) {
      const e = rr.next(), t = rr.range(-1, 1);
      let x, z;
      if (e < 0.3) { x = t * 33; z = 30.6 + rr.range(-0.4, 0.3); } else if (e < 0.55) { x = 33.8 + rr.range(-0.4, 0.2); z = t * 30; } else if (e < 0.8) { x = -33.8 + rr.range(-0.2, 0.4); z = t * 30; } else { const c = [[-15, -11], [15, -11], [-15, 11], [15, 11]][Math.floor(rr.next() * 4)]; x = c[0] + rr.range(-1.2, 1.2) * Math.sign(c[0]); z = c[1] + rr.range(-0.3, 0.6) * Math.sign(c[1]); }
      if (!clear(x, z, 0.4)) continue;
      place('s', x, z, rr.range(0.6, 1.0), rr.range(0.7, 1.0));
    }
    // trees in the yards behind the houses and further off
    guard = 0;
    while (cnt.b < n.b && guard++ < 3000) { const a = rr.range(0, TAU), d = rr.range(62, 95); if (Math.abs(Math.sin(a) * d + 40) < 9) continue; place('b', Math.cos(a) * d, Math.sin(a) * d, rr.range(0.9, 1.5), rr.range(0.9, 1.2)); }
    guard = 0;
    while (cnt.c < n.c && guard++ < 2000) { const a = rr.range(0, TAU), d = rr.range(62, 110); place('c', Math.cos(a) * d, Math.sin(a) * d, rr.range(0.9, 1.4), rr.range(0.9, 1.2)); }
    guard = 0;
    while (cnt.s < n.s && guard++ < 2000) { const x = rr.range(-60, 60), z = rr.range(-50, -47); place('s', x, z, rr.range(0.5, 0.8), rr.range(0.6, 0.9)); }
    guard = 0;
    while (cnt.f < n.f && guard++ < 20000) { const a = rr.range(0, TAU), d = rr.range(130, 380); if (fbm2(Math.cos(a) * 2.5 + 20, Math.sin(a) * 2.5 + 20, 3) < 0.4) continue; place('f', Math.cos(a) * d, Math.sin(a) * d, rr.range(1.0, 1.9), rr.range(0.8, 1.3)); }
    for (const k of Object.keys(meshes)) {
      const im = meshes[k]; im.count = cnt[k]; im.castShadow = k === 'b' || k === 'c'; im.receiveShadow = false;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.group.add(im);
    }
    this.trees = meshes.b; this.vegMeshes = meshes;
    // tree trunks are solid; bushes are soft
    for (const t of this.treeSpots) if (t.kind !== 's') { this.collider(t.x - t.r * 0.7, 0, t.z - t.r * 0.7, t.x + t.r * 0.7, 3.5, t.z + t.r * 0.7); this.obstacle(t.x - t.r, t.z - t.r, t.x + t.r, t.z + t.r); }
  }
  puddleSpots(rr) {
    const out = [];
    const cand = [[-6, 12.5, 0.8], [7, -12.4, 1.0], [16.4, 6, 0.7], [-16.5, -8, 0.9], [0.2, 20, 1.0], [0.1, -25, 0.8], [-3, -33.2, 1.1], [14, -33.3, 0.9], [9, -38, 1.8], [-14, -40, 2.2], [26, 0.3, 0.8], [-4, 2.5, 1.0], [6, 7.5, 0.8], [-11.5, 0, 0.7]];
    for (const c of cand) out.push(c);
    void rr; return out;
  }
  // street lamps glow and light the playground after dark
  buildLampLights() {
    this.lampLights = [];
    for (const i of [0, 1, 2, 3]) { const p = this.lampPosts[i]; const L = new THREE.PointLight(0xffd9a0, 0, 22, 1.6); L.position.copy(p).y -= 0.15; this.group.add(L); this.lampLights.push(L); }
  }
  applyTimeWeather() {
    super.applyTimeWeather();
    const night = 1 - (this.dayK || 0);
    const P = Settings.data.environment.field;
    const lit = smoothstep(0.35, 0.85, night) + (P.weather === 'rain' || P.weather === 'fog' ? 0.25 * (1 - night) : 0);
    this.mats.lamp.emissiveIntensity = lit * 2.2;
    for (const L of this.lampLights || []) L.intensity = lit * 9;
    this.mats.window.emissive.setRGB(1, 1, 1).multiplyScalar(smoothstep(0.4, 0.9, night) * 0.9);
    // a little less haze than the open field: the houses across the street stay crisp
    if (this.game.scene.fog && this.game.scene.fog.density) this.game.scene.fog.density *= P.weather === 'fog' ? 0.9 : 0.75;
  }
  // ------------------------------------------------------------- queries ---
  buildGrids() {
    const grid = (list, key) => { const G = new Map(); for (const o of list) for (let ix = Math.floor((o.x0 - 1) / 4); ix <= Math.floor((o.x1 + 1) / 4); ix++) for (let iz = Math.floor((o.z0 - 1) / 4); iz <= Math.floor((o.z1 + 1) / 4); iz++) { const k = ix * 4099 + iz; let l = G.get(k); if (!l) G.set(k, l = []); l.push(o); } return G; };
    this.ogrid = grid(this.obstacles);
    this.tgrid = grid(this.tops);
  }
  obstaclesNear(x, z, y) {
    const l = this.ogrid.get(Math.floor(x / 4) * 4099 + Math.floor(z / 4)), out = this._near; out.length = 0;
    if (l) for (const o of l) out.push(o);
    return out;
  }
  // physics floor: the ground, the slide chutes and the seesaw boards (the rest are solid boxes)
  floorAt(x, z, y) {
    let best = this.baseHeight(x, z), slope = null, ax = 'x';
    for (const S of this.slopes) { const s = this.slideSurface(S, x, z); if (s && (y == null || y > s.y - 0.45) && s.y > best) { best = s.y; slope = s.slope; ax = S.axis; } }
    for (const S of this.seesaws) { const s = this.seesawSurface(S, x, z); if (s && (y == null || y > s.y - 0.4) && s.y > best) { best = s.y; slope = s.slope; ax = 'x'; } }
    this._fn = slope; this._fax = ax;
    return best;
  }
  groundNormal(x, z, out, y) {
    if (y !== undefined) this.floorAt(x, z, y);
    const k = this._fn; this._fn = null;
    if (k == null) return out.set(0, 1, 0);
    return this._fax === 'x' ? out.set(-k, 1, 0).normalize() : out.set(0, 1, -k).normalize();
  }
  // where feet and roots stand: the floor plus decks, benches and tables (from above)
  groundHeight(x, z, y) {
    const yy = y != null ? y : null;
    let best = this.floorAt(x, z, yy == null ? 0.3 : yy);
    this._fn = null;
    if (yy == null) return best;
    const l = this.tgrid.get(Math.floor(x / 4) * 4099 + Math.floor(z / 4));
    if (l) for (const t of l) if (x > t.x0 && x < t.x1 && z > t.z0 && z < t.z1 && yy > t.h - 0.25 && t.h > best) best = t.h;
    return best;
  }
  surfaceAt(p) {
    const P = PG.play;
    if (p.x > P.x0 && p.x < P.x1 && p.z > P.z0 && p.z < P.z1) return p.y > 0.3 ? 'metal' : 'rubber';
    return this.onPath(p.x, p.z) ? 'hard' : 'grass';
  }
  impactSurface(p) { return p.y > 0.08 ? 'metal' : this.surfaceAt(p) === 'grass' ? 'grass' : 'hard'; }
  // keep roots on the park, out of the equipment (people on their way to a seat may step in)
  clampToBounds(p, m = 0) {
    p.x = clamp(p.x, PG.bx0 + m, PG.bx1 - m); p.z = clamp(p.z, PG.bz0 + m, PG.bz1 - m);
    if (m <= 0) return p;
    const npc = this._navNpc, seating = npc && npc.root.pos === p && (npc.transit || npc.seatLock || (npc.seatExitT && this.game.time - npc.seatExitT < 2.5));
    for (const o of this.obstaclesNear(p.x, p.z)) {
      if (o.seat && seating) continue;
      if (p.x < o.x0 - m || p.x > o.x1 + m || p.z < o.z0 - m || p.z > o.z1 + m) continue;
      const dl = p.x - (o.x0 - m), dr = (o.x1 + m) - p.x, dn = p.z - (o.z0 - m), df = (o.z1 + m) - p.z, mn = Math.min(dl, dr, dn, df);
      if (mn === dl) p.x = o.x0 - m; else if (mn === dr) p.x = o.x1 + m; else if (mn === dn) p.z = o.z0 - m; else p.z = o.z1 + m;
    }
    return p;
  }
  constrainCamera(p, prev) {
    p.x = clamp(p.x, PG.bx0 - 0.3, PG.bx1 + 0.3); p.z = clamp(p.z, PG.bz0 - 0.3, PG.bz1 + 0.3);
    const inside = (x, y, z) => { for (const b of this.boxes) if (x > b.min.x - 0.12 && x < b.max.x + 0.12 && y > b.min.y - 0.12 && y < b.max.y + 0.12 && z > b.min.z - 0.12 && z < b.max.z + 0.12) return true; return false; };
    if (inside(p.x, p.y, p.z)) { if (!inside(p.x, p.y, prev.z)) p.z = prev.z; else if (!inside(prev.x, p.y, p.z)) p.x = prev.x; else { p.x = prev.x; p.z = prev.z; if (inside(p.x, p.y, p.z)) p.y = prev.y; } }
    const gy = this.groundHeight(p.x, p.z, p.y) + 0.25;
    if (p.y < gy) p.y = gy;
    if (p.y > 60) p.y = 60;
  }
  // ------------------------------------------------------------- navigation ---
  buildNav() {
    const c = 0.5, x0 = PG.bx0, z0 = PG.bz0, nx = Math.ceil((PG.bx1 - x0) / c), nz = Math.ceil((PG.bz1 - z0) / c);
    const N = this.nav = { c, x0, z0, nx, nz, block: new Uint8Array(nx * nz), seat: new Uint8Array(nx * nz) };
    const pad = 0.3;
    for (const o of this.obstacles) {
      const i0 = Math.max(0, Math.floor((o.x0 - pad - x0) / c)), i1 = Math.min(nx - 1, Math.floor((o.x1 + pad - x0) / c));
      const j0 = Math.max(0, Math.floor((o.z0 - pad - z0) / c)), j1 = Math.min(nz - 1, Math.floor((o.z1 + pad - z0) / c));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const cx = x0 + (i + 0.5) * c, cz = z0 + (j + 0.5) * c; if (cx > o.x0 - pad && cx < o.x1 + pad && cz > o.z0 - pad && cz < o.z1 + pad) { N.block[j * nx + i] = 1; if (o.seat) N.seat[j * nx + i] = 1; } }
    }
    this.navG = new Float32Array(nx * nz); this.navF = new Float32Array(nx * nz); this.navFrom = new Int32Array(nx * nz); this.navStamp = new Uint32Array(nx * nz); this.navRun = 0;
  }
  cell(x, z) { const N = this.nav; return [Math.floor((x - N.x0) / N.c), Math.floor((z - N.z0) / N.c)]; }
  blockedAt(x, z) { const N = this.nav, i = Math.floor((x - N.x0) / N.c), j = Math.floor((z - N.z0) / N.c); if (i < 0 || j < 0 || i >= N.nx || j >= N.nz) return true; return N.block[j * N.nx + i] === 1; }
  losClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.22);
    let started = this.blockedAt(ax, az);
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = lerp(ax, bx, t), z = lerp(az, bz, t), b = this.blockedAt(x, z);
      if (b && !started) return false;
      if (!b) started = false; // leaving the padding round an obstacle we stand in
    }
    return true;
  }
  nearestFree(i, j) {
    const N = this.nav;
    for (let r = 0; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N.nx || b >= N.nz) continue;
      if (!N.block[b * N.nx + a]) return b * N.nx + a;
    }
    return -1;
  }
  findPath(ax, az, bx, bz) {
    const N = this.nav, nx = N.nx;
    let [i0, j0] = this.cell(ax, az), [i1, j1] = this.cell(bx, bz);
    i0 = clamp(i0, 0, nx - 1); j0 = clamp(j0, 0, N.nz - 1); i1 = clamp(i1, 0, nx - 1); j1 = clamp(j1, 0, N.nz - 1);
    let s = j0 * nx + i0, goal = j1 * nx + i1;
    if (N.block[s]) s = this.nearestFree(i0, j0);
    if (N.block[goal]) goal = this.nearestFree(i1, j1);
    if (s < 0 || goal < 0) return null;
    const G = this.navG, F = this.navF, from = this.navFrom, st = this.navStamp, run = ++this.navRun;
    const gi = goal % nx, gj = (goal / nx) | 0;
    const h = (k) => { const di = Math.abs(k % nx - gi), dj = Math.abs(((k / nx) | 0) - gj); return Math.max(di, dj) + 0.414 * Math.min(di, dj); };
    const heap = [s]; G[s] = 0; F[s] = h(s); from[s] = -1; st[s] = run;
    const closed = this._closed || (this._closed = new Uint32Array(nx * N.nz));
    const push = (k) => { heap.push(k); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (F[heap[p]] <= F[k]) break; heap[i] = heap[p]; i = p; } heap[i] = k; };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let i = 0; const n = heap.length; for (;;) { let l = i * 2 + 1, r = l + 1, m = i; if (l < n && F[heap[l]] < F[last]) m = l; if (r < n && F[heap[r]] < F[m === i ? last : heap[m]]) m = r; if (m === i) break; heap[i] = heap[m]; i = m; } heap[i] = last; } return top; };
    let it = 0, found = false;
    while (heap.length && it++ < 9000) {
      const k = pop(); if (closed[k] === run) continue; closed[k] = run;
      if (k === goal) { found = true; break; }
      const ki = k % nx, kj = (k / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = ki + di, b = kj + dj; if (a < 0 || b < 0 || a >= nx || b >= N.nz) continue;
        const q = b * nx + a; if (N.block[q] || closed[q] === run) continue;
        if (di && dj && (N.block[kj * nx + a] || N.block[b * nx + ki])) continue; // no corner cutting
        const g = G[k] + (di && dj ? 1.414 : 1);
        if (st[q] !== run || g < G[q]) { st[q] = run; G[q] = g; F[q] = g + h(q); from[q] = k; push(q); }
      }
    }
    if (!found) return null;
    const cells = []; for (let k = goal; k >= 0; k = from[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map(k => ({ x: N.x0 + (k % nx + 0.5) * N.c, z: N.z0 + (((k / nx) | 0) + 0.5) * N.c }));
    // string-pull: keep only the corners
    const out = [pts[0]];
    let a = 0;
    for (let k = 2; k < pts.length; k++) if (!this.losClear(pts[a].x, pts[a].z, pts[k].x, pts[k].z)) { a = k - 1; out.push(pts[a]); }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // the next point to steer to: straight at the goal when nothing is in the way, else along a path
  navGoal(p, dest, npc) {
    this._navNpc = npc || null;
    if (!npc) return dest;
    const N = npc._pgNav || (npc._pgNav = { path: null, i: 0, t: -9, dx: 1e9, dz: 1e9, losT: -9, los: true, g: new V3() });
    const now = this.game.time;
    const moved = Math.hypot(dest.x - N.dx, dest.z - N.dz) > 0.8;
    if (moved || now - N.losT > 0.3) { N.los = this.losClear(p.x, p.z, dest.x, dest.z) || Math.hypot(dest.x - p.x, dest.z - p.z) < 0.8; N.losT = now; }
    if (N.los) { N.path = null; N.dx = dest.x; N.dz = dest.z; return dest; }
    if (!N.path || moved || now - N.t > 4 || N.i >= N.path.length) { N.path = this.findPath(p.x, p.z, dest.x, dest.z); N.i = 1; N.t = now; N.dx = dest.x; N.dz = dest.z; }
    if (!N.path) return dest;
    while (N.i < N.path.length - 1) {
      const w = N.path[N.i];
      if (Math.hypot(w.x - p.x, w.z - p.z) < 0.55 || this.losClear(p.x, p.z, N.path[N.i + 1].x, N.path[N.i + 1].z)) N.i++; else break;
    }
    const w = N.path[Math.min(N.i, N.path.length - 1)];
    if (N.i >= N.path.length - 1) return dest;
    return N.g.set(w.x, p.y, w.z);
  }
  // somewhere to wander: an open spot, often by the playground (people like to watch and linger there)
  pickWander(npc, b) {
    const P = npc.root.pos, pois = this._pois || (this._pois = [[-9.5, -0.3], [-9.5, 5.2], [0, -4.4], [5.2, -4.3], [7, 2.4], [12.4, 4.8], [-4.5, 6.5], [3, 3.6], [-11, -4], [-1.8, -2.8], [0, 12.5], [-15.2, 0], [16.6, -1.8], [0, -12.5], [24, 0.5], [-24, -5.5], [-1.5, 28], [20, -24], [-22, 20], [24, 18], [-28, -26], [0, -33.2]]);
    for (let k = 0; k < 14; k++) {
      let x, z;
      if (Math.random() < 0.45) { const q = pois[Math.floor(Math.random() * pois.length)]; x = q[0] + (Math.random() - 0.5) * 2.4; z = q[1] + (Math.random() - 0.5) * 2.4; }
      else { x = P.x + (Math.random() - 0.5) * 26; z = P.z + (Math.random() - 0.5) * 26; }
      x = clamp(x, PG.bx0 + 1, PG.bx1 - 1); z = clamp(z, PG.bz0 + 1, PG.bz1 - 1);
      if (this.blockedAt(x, z)) continue;
      b.dest.set(x, this.baseHeight(x, z), z); return;
    }
    b.dest.set(clamp(P.x + (Math.random() - 0.5) * 6, PG.bx0 + 1, PG.bx1 - 1), 0, clamp(P.z + (Math.random() - 0.5) * 6, PG.bz0 + 1, PG.bz1 - 1));
    this.clampToBounds(b.dest, 0.6);
  }
  // ------------------------------------------------------------- moving parts ---
  // bodies near the swings, seesaws and riders (ragdolls and props); a few per frame
  bodiesNear(x, z, r, fn) {
    for (const n of this.game.npcs.list) {
      if (n.removed || n.physMode !== 'ragdoll') continue;
      const p = n.rag.bodies[RAG.PELVIS].pos; if (Math.abs(p.x - x) > r + 1.5 || Math.abs(p.z - z) > r + 1.5) continue;
      for (const bd of n.rag.bodies) if (!n.rag.detached[bd.index]) fn(bd, bd.shape.r || 0.1);
    }
    for (const pr of this.game.props.list) { const bd = pr.body; if (bd && Math.abs(bd.pos.x - x) < r + 0.6 && Math.abs(bd.pos.z - z) < r + 0.6) fn(bd, pr.radius || 0.3); }
  }
  updateSwings(dt) {
    const wind = Settings.data.environment.field.wind, t = this.time;
    for (const S of this.swings) {
      // pendulum (damped), nudged by the gusts
      const gust = wind * (0.5 + 0.5 * Math.sin(t * 0.7 + S.i * 1.9)) * (0.6 + 0.4 * Math.sin(t * 2.3 + S.i));
      S.w += (-(9.81 / S.L) * Math.sin(S.th) - 0.12 * S.w + gust * 0.35 * this.windDir.z * (S.baby ? 0.5 : 1)) * dt;
      // bodies and props bump the seat: momentum is shared, the body is pushed out
      const sy = S.y - S.L * Math.cos(S.th), sz = S.z + S.L * Math.sin(S.th), vz = S.L * S.w * Math.cos(S.th), vy = S.L * S.w * Math.sin(S.th);
      this.bodiesNear(S.x, sz, 0.4, (bd, r) => {
        const dx = bd.pos.x - S.x, dy = bd.pos.y - sy, dz = bd.pos.z - sz, rr = r + (S.baby ? 0.27 : 0.2);
        if (Math.abs(dx) > (S.baby ? 0.3 : 0.27) + r || dy * dy + dz * dz > rr * rr) return;
        const m = bd.mass, rel = bd.vel.z - vz, k = m / (m + S.m);
        S.w += rel * k / S.L * 0.9;
        bd.vel.z -= rel * (1 - k) * 0.5; if (bd.vel.y < vy) bd.vel.y += (vy - bd.vel.y) * 0.3;
        const d = Math.hypot(dy, dz) || 1, push = Math.max(0, rr - d); bd.pos.y += dy / d * push * 0.5; bd.pos.z += dz / d * push * 0.5;
        if (this.game.physics && bd.owner && bd.owner.asleep) this.game.physics.wakeOwner(bd.owner);
      });
      S.w = clamp(S.w, -4.5, 4.5);
      S.th += S.w * dt;
      if (S.th > 1.35) { S.th = 1.35; S.w = -Math.abs(S.w) * 0.3; } else if (S.th < -1.35) { S.th = -1.35; S.w = Math.abs(S.w) * 0.3; }
      // the chain hooks creak at the end of a big swing
      if (Math.sign(S.w) !== Math.sign(S.lastW) && Math.abs(S.th) > 0.22 && this.game.audio) { S.creakT = this.time; this.game.audio.play('creak', { pos: _pgV.set(S.x, S.y, S.z), gain: 0.25 + Math.min(0.5, Math.abs(S.th)), rate: 0.9 + S.i * 0.05, ref: 4 }); }
      S.lastW = S.w;
    }
    this.updateSwingMeshes();
  }
  updateSwingMeshes() {
    let k = 0;
    for (const S of this.swings) {
      _pgQ.setFromAxisAngle(new V3(1, 0, 0), S.th); _pgM.compose(_pgV.set(S.x, S.y, S.z), _pgQ, _pgS);
      this.swingChain.setMatrixAt(S.i, _pgM);
      if (S.baby) { this.swingBaby.position.set(S.x, S.y, S.z); this.swingBaby.quaternion.copy(_pgQ); }
      else this.swingSeat.setMatrixAt(k++, _pgM);
    }
    this.swingChain.instanceMatrix.needsUpdate = true; this.swingSeat.instanceMatrix.needsUpdate = true;
  }
  updateSeesaws(dt) {
    for (const S of this.seesaws) {
      // weight on the board: torque about the pivot from whatever rests on it (+x end down = +phi)
      let tq = S.bias * 6, I = S.I;
      this.bodiesNear(S.x, S.z, S.half, (bd, r) => {
        const s = this.seesawSurface(S, bd.pos.x, bd.pos.z); if (!s) return;
        const gap = bd.pos.y - r - s.y; if (gap > 0.14 || gap < -0.3) return;
        const lever = bd.pos.x - S.x;
        tq += bd.mass * 9.81 * lever; I += bd.mass * lever * lever;
        if (bd.vel.y < -1.5) S.w += -bd.vel.y * bd.mass * lever / (S.I + bd.mass * lever * lever) * 0.4; // a landing body slams its end down
      });
      S.w += (tq / I - 1.6 * S.w) * dt;
      S.w = clamp(S.w, -3, 3);
      S.phi += S.w * dt;
      if (S.phi > S.max) { S.phi = S.max; if (S.w > 0.6 && this.game.audio) this.game.audio.play('thudLight', { pos: _pgV.set(S.x + S.half, 0.1, S.z), gain: Math.min(0.6, S.w * 0.3) }); S.w = -S.w * 0.18; }
      else if (S.phi < -S.max) { S.phi = -S.max; if (S.w < -0.6 && this.game.audio) this.game.audio.play('thudLight', { pos: _pgV.set(S.x - S.half, 0.1, S.z), gain: Math.min(0.6, -S.w * 0.3) }); S.w = -S.w * 0.18; }
    }
    this.updateSeesawMeshes();
  }
  // the chutes are slick: whatever lies on one keeps sliding down (the contact friction alone would hold it)
  updateSlides(dt) {
    for (const S of this.slopes) {
      const cx = S.axis === 'x' ? (S.a + S.b) / 2 : S.c, cz = S.axis === 'x' ? S.c : (S.a + S.b) / 2;
      this.bodiesNear(cx, cz, S.len / 2 + 0.3, (bd, r) => {
        const s = this.slideSurface(S, bd.pos.x, bd.pos.z); if (!s || Math.abs(s.slope) < 0.08) return;
        if (bd.pos.y - r - s.y > 0.1) return;
        // slope = dy per metre along the world axis; downhill is against it
        const acc = -Math.sign(s.slope) * 9.81 * Math.abs(s.slope) / Math.sqrt(1 + s.slope * s.slope) * 0.7 * dt;
        if (S.axis === 'x') bd.vel.x += acc; else bd.vel.z += acc;
        if (bd.owner && bd.owner.asleep && this.game.physics) this.game.physics.wakeOwner(bd.owner);
      });
    }
  }
  updateSeesawMeshes() {
    for (let i = 0; i < this.seesaws.length; i++) {
      const S = this.seesaws[i];
      _pgQ.setFromAxisAngle(new V3(0, 0, 1), -S.phi); _pgM.compose(_pgV.set(S.x, S.y, S.z), _pgQ, _pgS);
      this.seesawMesh.setMatrixAt(i, _pgM);
    }
    this.seesawMesh.instanceMatrix.needsUpdate = true;
  }
  updateRiders(dt) {
    const wind = Settings.data.environment.field.wind;
    for (const R of this.riders) {
      this.bodiesNear(R.x, R.z, 0.5, (bd, r) => {
        const dx = bd.pos.x - R.x, dz = bd.pos.z - R.z, dy = bd.pos.y - 0.55;
        if (dx * dx + dz * dz > (0.4 + r) ** 2 || Math.abs(dy) > 0.5) return;
        R.vx += bd.vel.z * bd.mass * 0.012; R.vz -= bd.vel.x * bd.mass * 0.012;
      });
      R.vx += (-38 * R.ax - 2.2 * R.vx + Math.sin(this.time * 1.7 + R.x) * wind * 0.3) * dt;
      R.vz += (-38 * R.az - 2.2 * R.vz) * dt;
      R.ax = clamp(R.ax + R.vx * dt, -0.45, 0.45); R.az = clamp(R.az + R.vz * dt, -0.45, 0.45);
    }
    this.updateRiderMeshes();
  }
  updateRiderMeshes() {
    for (let i = 0; i < this.riders.length; i++) {
      const R = this.riders[i], m = this.riderMeshes[i];
      m.position.set(R.x, 0.4, R.z); m.rotation.set(R.ax, R.yaw, R.az, 'XYZ');
    }
  }
  // shots and blasts move the light things (the AI and the weapons call these)
  onImpact(p, dir, power) {
    for (const S of this.swings) {
      const sy = S.y - S.L * Math.cos(S.th), sz = S.z + S.L * Math.sin(S.th);
      if (Math.abs(p.x - S.x) < 0.35 && Math.hypot(p.y - sy, p.z - sz) < 0.4) S.w += dir.z * power * 0.32;
      else if (Math.abs(p.x - S.x) < 0.3 && p.y > sy && p.y < S.y && Math.abs(p.z - lerp(S.z, sz, (S.y - p.y) / S.L)) < 0.15) S.w += dir.z * power * 0.12;
    }
    for (const S of this.seesaws) if (this.seesawSurface(S, p.x, p.z) && Math.abs(p.y - S.y) < 0.5) S.w += -dir.y * power * (p.x - S.x) * 0.35;
    for (const R of this.riders) if (Math.hypot(p.x - R.x, p.z - R.z) < 0.5 && p.y < 1.1) { R.vx += dir.z * power * 1.2; R.vz -= dir.x * power * 1.2; }
  }
  onStimulus(type, p, radius) {
    if (this.birds) this.birds.alarm(p, type === 'explosion' ? 60 : type === 'gunshot' ? 45 : type === 'scream' ? 14 : 8);
    if (type === 'explosion') {
      const push = (x, y, z) => { const d = Math.hypot(x - p.x, y - p.y, z - p.z); return d < 10 ? (10 - d) / 10 : 0; };
      for (const S of this.swings) { const k = push(S.x, S.y - S.L, S.z); S.w += Math.sign(S.z - p.z || 1) * k * 4; }
      for (const S of this.seesaws) { const k = push(S.x, S.y, S.z); S.w += (Math.random() - 0.5) * k * 3; }
      for (const R of this.riders) { const k = push(R.x, 0.5, R.z); R.vx += (R.z - p.z) * k * 2; R.vz -= (R.x - p.x) * k * 2; }
    }
    void radius;
  }
  update(dt, cam) {
    super.update(dt, cam);
    this.updateSwings(dt); this.updateSeesaws(dt); this.updateRiders(dt); this.updateSlides(dt);
    if (this.birds) this.birds.update(dt, cam);
  }
  dispose() { if (this.birds) this.birds.dispose(); super.dispose(); }
}
// merge with uvs (mergeGeos keeps only position/colour/normal)
function mergeGeoUV(geos) {
  const b = new PGBatch(); for (const g of geos) b.push(g.index ? g : g, _pgM.identity(), _pgC.set(0xffffff));
  const g = b.geometry(); g.deleteAttribute('color'); return g;
}

// ----------------------------------------------------------------------------
// Birds: they peck about on the paths and the grass, perch on the lamps, the fence and the
// swing beam, and fly off in a flurry when someone comes close or something loud happens.
class PGBirds {
  constructor(env, n) {
    this.env = env; this.list = [];
    const body = [], wing = [];
    { const g = new THREE.SphereGeometry(1, 10, 7); g.scale(0.045, 0.04, 0.075); body.push(g); const h = new THREE.SphereGeometry(0.03, 8, 6); h.translate(0, 0.03, 0.06); body.push(h); const bk = new THREE.ConeGeometry(0.008, 0.025, 5); bk.rotateX(Math.PI / 2); bk.translate(0, 0.028, 0.095); body.push(bk); const t = new THREE.BoxGeometry(0.04, 0.006, 0.06); t.translate(0, 0.005, -0.09); body.push(t); }
    { const sh = new THREE.Shape(); sh.moveTo(0, 0.03); sh.lineTo(0.13, 0.0); sh.lineTo(0.11, -0.04); sh.lineTo(0, -0.03); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); wing.push(g); }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.85, side: THREE.DoubleSide });
    this.body = new THREE.InstancedMesh(mergeGeoUV(body), mat, n);
    this.wings = new THREE.InstancedMesh(mergeGeoUV(wing), mat, n * 2);
    const cols = [0x6b5a4a, 0x55504c, 0x7a6a58, 0x3b3b3e, 0x8a7a62];
    for (let i = 0; i < n; i++) {
      const c = new THREE.Color(cols[i % cols.length]); this.body.setColorAt(i, c); this.wings.setColorAt(i * 2, c); this.wings.setColorAt(i * 2 + 1, c);
      const b = { i, p: new V3(), v: new V3(), yaw: Math.random() * TAU, state: 'ground', t: Math.random() * 3, flap: 0, tgt: new V3(), hopT: Math.random(), peck: 0, sp: 3 + Math.random() * 2 };
      this.groundSpot(b.p); this.list.push(b);
    }
    for (const m of [this.body, this.wings]) { m.castShadow = true; m.frustumCulled = false; env.group.add(m); }
    this.perches = env.lampPosts.map(p => new V3(p.x, p.y + 0.42, p.z)).concat([new V3(-11, 2.52, 2.5), new V3(-8, 2.52, 2.5), new V3(6, 2.15, 1.0), new V3(-14, 1.02, 4), new V3(14, 1.02, -6), new V3(-6, 1.02, -10), new V3(9, 1.02, 10)]);
    this.alarmT = 0;
  }
  groundSpot(out) {
    for (let k = 0; k < 20; k++) {
      const x = (Math.random() - 0.5) * 60, z = (Math.random() - 0.5) * 56;
      if (Math.abs(x) < 14.3 && Math.abs(z) < 10.3) continue;
      if (this.env.blockedAt(x, z)) continue;
      return out.set(x, this.env.baseHeight(x, z), z);
    }
    return out.set(0, 0, 20);
  }
  alarm(p, r) { for (const b of this.list) if (b.state !== 'fly' && b.p.distanceTo(p) < r) this.takeOff(b, true); }
  takeOff(b, scare) {
    b.state = 'fly'; b.t = 0;
    if (scare || Math.random() < 0.5) { const q = this.perches[Math.floor(Math.random() * this.perches.length)]; b.tgt.copy(q); b.land = 'perch'; }
    else { this.groundSpot(b.tgt); b.land = 'ground'; }
    b.v.set((Math.random() - 0.5) * 2, 3 + Math.random() * 2, (Math.random() - 0.5) * 2);
    if (scare && this.env.game.audio && this.env.game.time - this.alarmT > 0.5) { this.alarmT = this.env.game.time; this.env.game.audio.play('flutter', { pos: b.p.clone(), gain: 0.55, ref: 5 }); }
  }
  update(dt, cam) {
    const g = this.env.game, F = Settings.data.environment.field, night = (this.env.dayK || 1) < 0.3;
    for (const b of this.list) {
      b.t += dt;
      if (b.state !== 'fly') {
        // someone close by: off it goes
        let near = cam.position.distanceTo(b.p) < 2.6;
        if (!near) for (const n of g.npcs.list) { if (n.removed || n.physMode === 'ragdoll' && n.lifeState === 'dead') continue; const dx = n.root.pos.x - b.p.x, dz = n.root.pos.z - b.p.z; if (dx * dx + dz * dz < (n.anim && n.anim.speed > 2 ? 12 : 5)) { near = true; break; } }
        if (near || (b.state === 'perch' && b.t > 12 + b.i * 2 && Math.random() < dt * 0.2) || (b.state === 'ground' && b.t > 18 && Math.random() < dt * 0.08)) { this.takeOff(b, near); continue; }
        if (b.state === 'ground') { // hop and peck
          b.hopT -= dt; b.peck = Math.max(0, b.peck - dt * 4);
          if (b.hopT <= 0) { b.hopT = 0.4 + Math.random() * 1.6; if (Math.random() < 0.55) { b.yaw += (Math.random() - 0.5) * 2; const s = 0.12 + Math.random() * 0.15; const nx = b.p.x + Math.sin(b.yaw) * s, nz = b.p.z + Math.cos(b.yaw) * s; if (!this.env.blockedAt(nx, nz)) { b.p.x = nx; b.p.z = nz; b.hop = 0.18; } } else b.peck = 1; }
          b.hop = Math.max(0, (b.hop || 0) - dt);
          b.p.y = this.env.baseHeight(b.p.x, b.p.z) + Math.sin(Math.min(1, (0.18 - b.hop) / 0.18) * Math.PI) * 0.04 * (b.hop > 0 ? 1 : 0);
        }
        b.flap = 0;
      } else {
        // fly toward the target, climbing first; land when close
        const to = _pgW.subVectors(b.tgt, b.p), d = to.length();
        const cruise = Math.max(b.tgt.y + 1.5, 4 + b.i % 3);
        const want = _pgV.copy(to).setY(0).normalize().multiplyScalar(Math.min(b.sp * 1.6, d * 1.5 + 1));
        want.y = d > 5 ? (cruise - b.p.y) * 1.2 : to.y * 2;
        b.v.lerp(want, 1 - Math.exp(-dt * 2.5));
        b.p.addScaledVector(b.v, dt);
        b.yaw = Math.atan2(b.v.x, b.v.z);
        b.flap += dt * (b.v.y > 0.3 || d > 3 ? 26 : 12);
        if (d < 0.25 || b.t > 25) { b.p.copy(b.tgt); b.state = b.land; b.t = 0; b.v.set(0, 0, 0); }
      }
      // matrices
      const pitch = b.state === 'fly' ? -clamp(b.v.y * 0.08, -0.4, 0.4) : (b.peck > 0 ? 0.6 * Math.sin(b.peck * Math.PI) : -0.15);
      _pgQ.setFromEuler(new THREE.Euler(pitch, b.yaw, 0, 'YXZ'));
      _pgM.compose(b.p, _pgQ, _pgS); this.body.setMatrixAt(b.i, _pgM);
      const fl = b.state === 'fly' ? Math.sin(b.flap) * 1.0 + 0.2 : -1.25;
      for (const s of [-1, 1]) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s < 0 ? Math.PI : 0, s * fl, 'YXZ'));
        const m = new THREE.Matrix4().compose(_pgV.set(0, 0.015, 0), q, _pgS);
        m.premultiply(_pgM); this.wings.setMatrixAt(b.i * 2 + (s > 0 ? 1 : 0), m);
      }
    }
    this.body.instanceMatrix.needsUpdate = true; this.wings.instanceMatrix.needsUpdate = true;
    this.body.visible = this.wings.visible = !night && F.weather !== 'rain';
  }
  dispose() { }
}
HT.PlaygroundEnvironment = PlaygroundEnvironment;
