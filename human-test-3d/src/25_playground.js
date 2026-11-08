// ============================================================================
// PLAYGROUND (V1.12): a neighbourhood park with a playground in the middle.
// Built on the grassy field's sky, sun, weather, grass and trees, on flat ground. Posts, decks,
// bars, fences and benches are solid boxes; the slide chutes and the seesaw boards are sloped
// surfaces the physics treats as floors. The swings, seesaws and spring riders move: the wind,
// shots, blasts and bodies push them. People walk round the equipment on a navigation grid and
// sit on the benches and at the picnic tables; birds peck on the paths and fly off when someone
// comes near or a shot is fired. +X east, -Z north (the street and the houses are to the north).
// V1.15: the street became real - a sunken road with kerbs, a zebra crossing, parking lanes and
// traffic (26_traffic.js); houses with garages and driveways across it; hedges, flowers, a sandbox,
// a rope climber and more round the park.
// ============================================================================
const PG = {
  bx0: -34.5, bx1: 34.5, bz0: -48.3, bz1: 31.5,   // walkable: the park, both sidewalks and the street between them
  play: { x0: -14, x1: 14, z0: -10, z1: 10 },     // rubber safety flooring inside the fence
  deckH: 1.5
};
// the street (V1.15): sidewalks at the park's level, the road 12.5 cm lower between kerbs, ramps at the crossing
const PG_ST = { roadY: -0.125, walkY: 0.012, kerbY: 0.03, kw: 0.15, ramp: 1.2, far: -48.6 };
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
    this.planHouses();
    // flat ground with the meadow material (cut open for the sunken road); paths, rubber, the street on top
    const T = 1000, tg = this.groundGeometry(T);
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
    this.buildExtras();
    this.buildFurniture();
    this.buildFences();
    this.buildStreet();
    this.buildHouses();
    this.buildHedges();
    this.flushBatches();
    this.buildTrees(q);
    this.buildFlowers(q);
    this.buildStreetLightPools();
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
    // the traffic on the street (parked cars wait in the spaces, the rest drive by)
    this.traffic = new TrafficSystem(this.game, this, { driveways: this.driveways });
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
    // road signs (V1.15): pedestrian crossing, speed limit, children at play, bus stop - one atlas
    const signs = Tex.make('pgSigns', 512, 128, (g2, w, h) => {
      g2.clearRect(0, 0, w, h);
      const diamond = (ox, col) => { g2.fillStyle = col; g2.beginPath(); g2.moveTo(ox + 64, 2); g2.lineTo(ox + 126, 64); g2.lineTo(ox + 64, 126); g2.lineTo(ox + 2, 64); g2.closePath(); g2.fill(); g2.strokeStyle = '#111'; g2.lineWidth = 4; g2.beginPath(); g2.moveTo(ox + 64, 9); g2.lineTo(ox + 119, 64); g2.lineTo(ox + 64, 119); g2.lineTo(ox + 9, 64); g2.closePath(); g2.stroke(); };
      const figure = (x, y, sc, stride) => { g2.strokeStyle = '#111'; g2.fillStyle = '#111'; g2.lineWidth = 6 * sc; g2.lineCap = 'round'; g2.beginPath(); g2.arc(x, y, 7 * sc, 0, TAU); g2.fill(); g2.beginPath(); g2.moveTo(x, y + 9 * sc); g2.lineTo(x - 3 * sc, y + 36 * sc); g2.lineTo(x - 3 * sc - 12 * sc * stride, y + 60 * sc); g2.moveTo(x - 3 * sc, y + 36 * sc); g2.lineTo(x + 9 * sc * stride, y + 60 * sc); g2.moveTo(x - 1 * sc, y + 16 * sc); g2.lineTo(x - 14 * sc, y + 30 * sc); g2.moveTo(x - 1 * sc, y + 16 * sc); g2.lineTo(x + 13 * sc, y + 27 * sc); g2.stroke(); };
      diamond(0, '#f2cf1d'); figure(64, 30, 1, 1);
      g2.fillStyle = '#f6f6f2'; g2.fillRect(141, 2, 102, 124); g2.strokeStyle = '#111'; g2.lineWidth = 4; g2.strokeRect(146, 7, 92, 114);
      g2.fillStyle = '#111'; g2.textAlign = 'center'; g2.font = 'bold 19px Helvetica, Arial, sans-serif'; g2.fillText('SPEED', 192, 32); g2.fillText('LIMIT', 192, 54); g2.font = 'bold 52px Helvetica, Arial, sans-serif'; g2.fillText('25', 192, 106);
      diamond(256, '#f2cf1d'); figure(300, 40, 0.8, 0.9); figure(330, 52, 0.62, 1.1);
      g2.fillStyle = '#f6f6f2'; g2.fillRect(400, 2, 96, 124); g2.fillStyle = '#1d4f9a'; g2.fillRect(400, 2, 96, 34);
      g2.fillStyle = '#fff'; g2.font = 'bold 17px Helvetica, Arial, sans-serif'; g2.fillText('BUS', 448, 26);
      g2.fillStyle = '#1d4f9a'; g2.beginPath(); g2.roundRect ? g2.roundRect(414, 48, 68, 44, 7) : g2.rect(414, 48, 68, 44); g2.fill();
      g2.fillStyle = '#f6f6f2'; for (let k = 0; k < 3; k++) g2.fillRect(420 + k * 20, 54, 15, 14); g2.fillStyle = '#111'; g2.beginPath(); g2.arc(428, 94, 6, 0, TAU); g2.arc(468, 94, 6, 0, TAU); g2.fill();
      g2.fillStyle = '#1d4f9a'; g2.font = 'bold 15px Helvetica, Arial, sans-serif'; g2.fillText('STOP', 448, 120);
    });
    signs.anisotropy = an;
    const hedge = tex('pgHedge', 256, (g2, w, h) => {
      g2.fillStyle = 'rgb(38,62,28)'; g2.fillRect(0, 0, w, h);
      const r = new RNG(61);
      // clumps of small leaves: dark gaps between them, sunlit tops
      for (let i = 0; i < 140; i++) { const x = r.next() * w, y = r.next() * h, rr = 8 + r.next() * 14; const gr = g2.createRadialGradient(x, y - rr * 0.3, 1, x, y, rr); gr.addColorStop(0, 'rgba(120,160,70,0.55)'); gr.addColorStop(1, 'rgba(30,50,22,0)'); g2.fillStyle = gr; g2.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      for (let i = 0; i < 4200; i++) { const g = 70 + r.next() * 95, x = r.next() * w, y = r.next() * h; g2.fillStyle = `rgba(${Math.round(g * 0.5)},${Math.round(g)},${Math.round(g * 0.3)},${0.55 + r.next() * 0.45})`; g2.beginPath(); g2.ellipse(x, y, 1.5 + r.next() * 2.5, 0.8 + r.next() * 1.4, r.next() * 3, 0, TAU); g2.fill(); }
      for (let i = 0; i < 900; i++) { g2.fillStyle = 'rgba(10,20,8,0.5)'; g2.fillRect(r.next() * w, r.next() * h, 1 + r.next() * 2, 1 + r.next() * 2); }
    });
    const sand = tex('pgSand', 256, (g2, w, h) => {
      g2.fillStyle = 'rgb(214,196,156)'; g2.fillRect(0, 0, w, h);
      const r = new RNG(71);
      for (let i = 0; i < 14000; i++) { const c = 150 + r.next() * 90; g2.fillStyle = `rgba(${Math.round(c)},${Math.round(c * 0.9)},${Math.round(c * 0.7)},0.6)`; g2.fillRect(r.next() * w, r.next() * h, 1, 1); }
      for (let i = 0; i < 26; i++) { g2.fillStyle = `rgba(120,100,70,${0.06 + r.next() * 0.08})`; g2.beginPath(); g2.ellipse(r.next() * w, r.next() * h, 8 + r.next() * 20, 4 + r.next() * 10, r.next() * 3, 0, TAU); g2.fill(); }
    });
    const parkSign = Tex.make('pgParkSign', 512, 128, (g2, w, h) => {
      g2.fillStyle = '#4a3220'; g2.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 3) { g2.fillStyle = `rgba(30,18,10,${0.15 + 0.15 * Math.sin(y * 0.7)})`; g2.fillRect(0, y, w, 1); }
      g2.strokeStyle = '#d8c69a'; g2.lineWidth = 4; g2.strokeRect(10, 10, w - 20, h - 20);
      g2.fillStyle = '#efe2bc'; g2.textAlign = 'center'; g2.font = 'bold 52px Georgia, serif'; g2.fillText('ELM STREET PARK', w / 2, 72);
      g2.font = 'italic 22px Georgia, serif'; g2.fillText('Playground  ·  Open dawn to dusk', w / 2, 104);
    });
    parkSign.anisotropy = an;
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
    M.window2 = std({ map: win, emissiveMap: winGlow, emissive: new THREE.Color(0, 0, 0), roughness: 0.18, metalness: 0.1, envMapIntensity: 1.2 });
    M.sign = std({ map: signs, alphaTest: 0.5, roughness: 0.45, metalness: 0.1 });
    M.sand = std({ map: sand, roughness: 0.97, metalness: 0, envMapIntensity: 0.25 });
    M.parkSign = std({ map: parkSign, roughness: 0.8, metalness: 0 });
    M.hedge = std({ map: hedge, roughness: 0.95, metalness: 0, envMapIntensity: 0.3, color: 0xe6f0dc });
    M.tactile = std({ map: deck, roughness: 0.7, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    M.glassPG = new THREE.MeshPhysicalMaterial({ color: 0xdde8ee, vertexColors: true, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, depthWrite: false, envMapIntensity: 1.2 });
    M.lamp = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: new THREE.Color(0xffe0a0), emissiveIntensity: 0, roughness: 0.3 });
    M.seat = std({ roughness: 0.75, metalness: 0 });
    M.mark = std({ roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    for (const k of ['rubber', 'concrete', 'asphalt']) { M[k].polygonOffset = true; M[k].polygonOffsetFactor = -1; M[k].polygonOffsetUnits = -1; }
    // texture scale per material (metres per repeat) for boxes and ground quads
    this.tm = { rubber: 2, concrete: 1.5, asphalt: 6, wood: 1.2, deck: 0.5, siding: 2.4, roof: 3, brick: 2.4, mark: 1, tactile: 0.5, hedge: 1.4, sand: 1.2 };
    // what each material looks like dry (the rain darkens and polishes the hard surfaces, see update)
    this.dryState = {};
    for (const k of ['rubber', 'concrete', 'asphalt', 'wood', 'paint', 'deck', 'mark', 'tactile', 'brick', 'roof', 'siding']) this.dryState[k] = { r: M[k].roughness, e: M[k].envMapIntensity };
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
      m.castShadow = !(mat === 'rubber' || mat === 'concrete' || mat === 'asphalt' || mat === 'mark' || mat === 'tactile' || mat === 'glassPG');
      if (mat === 'glassPG') m.renderOrder = 3;
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
      [17.4, -32.1, 21.8, -30.4],                       // the bus shelter
      ...this.yardRects(),                              // walkways and driveways across the street
      [-200, PG_ST.far, 200, -32]                       // the sidewalks, kerbs and the road (last)
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
    this._rk = 0;
    const SB = this.sandbox; if (SB && x > SB.x0 && x < SB.x1 && z > SB.z0 && z < SB.z1) return SB.y;
    if (x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1) return 0.02;
    if (z < -32 && z > PG_ST.far) return this.streetY(x, z);
    return this.onPath(x, z) ? 0.012 : 0;
  }
  // the street's floor for the physics: the kerbs are solid boxes (their tops are stood on through
  // this.tops), so inside them this is the road; the ramps at the crossing slope (this._rk = dy/dz)
  streetY(x, z) {
    const S = PG_ST, k1 = TR.kerb1, k0 = TR.kerb0, cx = x > TR.cross.x0 && x < TR.cross.x1, k = (S.walkY - S.roadY) / S.ramp;
    if (z >= k1 + S.kw) { if (cx && z < k1 + S.ramp) { this._rk = k; return S.roadY + (z - k1) * k; } return S.walkY; }
    if (z > k0 - S.kw) { if (cx && z >= k1) { this._rk = k; return S.roadY + (z - k1) * k; } if (cx && z <= k0) { this._rk = -k; return S.roadY + (k0 - z) * k; } return S.roadY; }
    if (cx && z > k0 - S.ramp) { this._rk = -k; return S.roadY + (k0 - z) * k; }
    return S.walkY;
  }
  onRoad(x, z) { return z > TR.kerb0 && z < TR.kerb1; }
  onPath(x, z) {
    if (z < -32 && z > PG_ST.far) return true;
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
    for (let i = 1; i < R.length - 1; i++) { const r = R[i]; this.quad('concrete', r[0], r[1], r[2], r[3], 0.012, i >= 15 ? 0xc9c6bd : 0xd5d2ca); }
  }
  // the ground plane, cut open where the road lies (and at the crossing ramps) so the road can sit lower
  groundGeometry(T) {
    const S = PG_ST, k0 = TR.kerb0, k1 = TR.kerb1, c0 = TR.cross.x0, c1 = TR.cross.x1, h = T / 2, b = new PGBatch();
    const rect = (x0, z0, x1, z1) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.max(1, Math.round((x1 - x0) / 125)), Math.max(1, Math.round((z1 - z0) / 125)));
      g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + h) / T, (-p.getZ(i) + h) / T);
      b.push(g, _pgM.identity(), _pgC.set(0xffffff));
    };
    rect(-h, k1 + S.ramp, h, h); rect(-h, k1, c0, k1 + S.ramp); rect(c1, k1, h, k1 + S.ramp);
    rect(-h, -h, h, k0 - S.ramp); rect(-h, k0 - S.ramp, c0, k0); rect(c1, k0 - S.ramp, h, k0);
    return b.geometry();
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
    this._bench = bench; this.bin = bin; this.lamp = lamp;
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
  // ------------------------------------------------------------- street (V1.15) ---
  // The sidewalks lie at the park's level; the road is 12.5 cm lower between kerbs that bodies stop
  // against and feet step up onto, with ramps at the zebra crossing. Two lanes with parking along both
  // kerbs, gutters, drains and manholes; signs, a hydrant, a bus shelter, wooden utility poles with
  // wires and street lights. The traffic system (26_traffic.js) drives on it.
  buildStreet() {
    const S = PG_ST, k0 = TR.kerb0, k1 = TR.kerb1, c0 = TR.cross.x0, c1 = TR.cross.x1, ry = S.roadY, X = 170, my = ry + 0.004;
    this.quad('concrete', -X, k1 + S.kw, X, -32, S.walkY, 0xcfccc4);
    this.quad('concrete', -X, S.far, X, k0 - S.kw, S.walkY, 0xcbc8c0);
    this.quad('asphalt', -X, k0, X, k1, ry, 0xffffff);
    this.quad('concrete', -X, k1 - 0.42, X, k1, ry + 0.002, 0xa9a69f);     // gutters
    this.quad('concrete', -X, k0, X, k0 + 0.42, ry + 0.002, 0xa9a69f);
    for (const [a, b] of [[-X, c0], [c1, X]]) for (const [z0, z1] of [[k1, k1 + S.kw], [k0 - S.kw, k0]]) {
      this.box('concrete', a, ry - 0.05, z0, b, S.kerbY, z1, 0xbdbab2);
      const a2 = Math.max(a, -130), b2 = Math.min(b, 130);
      this.collider(a2, ry - 0.05, z0, b2, S.kerbY, z1);
      this.tops.push({ x0: a2, x1: b2, z0, z1, h: S.kerbY });
    }
    this.ramp(c0, c1, k1, 1); this.ramp(c0, c1, k0, -1);
    // markings: a double yellow centre line, white lines along the parking lanes, the crossing, stop bars
    const strip = (z0, z1, col) => { this.quad('mark', -X, z0, c0 - 0.4, z1, my, col); this.quad('mark', c1 + 0.4, z0, X, z1, my, col); };
    strip(TR.center + 0.06, TR.center + 0.16, 0xe0b53c); strip(TR.center - 0.16, TR.center - 0.06, 0xe0b53c);
    strip(-36.86, -36.76, 0xe8e8e2); strip(-43.54, -43.44, 0xe8e8e2);
    for (let z = k1 - 0.6; z > k0 + 0.3; z -= 1.0) this.quad('mark', c0, z - 0.5, c1, z, my + 0.0005, 0xeeeee8);
    this.quad('mark', c0 - 2.0, -40.05, c0 - 1.6, -36.9, my, 0xeeeee8);
    this.quad('mark', c1 + 1.6, -43.4, c1 + 2.0, -40.25, my, 0xeeeee8);
    // drains in the gutters, manholes in the lanes (cast iron)
    for (const x of [-62, -24, 22, 58]) { this.quad('deck', x - 0.45, k1 - 0.38, x + 0.45, k1 - 0.06, ry + 0.004, 0x2c2d2e); this.quad('deck', x + 3 - 0.45, k0 + 0.06, x + 3 + 0.45, k0 + 0.38, ry + 0.004, 0x2c2d2e); }
    for (const [x, z] of [[14, -38.7], [-31, -41.6], [47, -41.9], [-58, -38.2]]) { const g = new THREE.CircleGeometry(0.34, 20); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.4, uv.getY(i) * 1.4); _pgM.makeTranslation(x, ry + 0.005, z); this.geo('deck', g, _pgM, 0x3a3b3d); }
    this.buildStreetFurniture();
  }
  // a curb ramp at the crossing: the sidewalk slopes down to the road (dir +1: up toward +z)
  ramp(x0, x1, zk, dir) {
    const S = PG_ST, z1 = zk + dir * S.ramp, ya = S.roadY + 0.003, yb = S.walkY;
    const P = [], push = (...v) => P.push(...v);
    // top slope, then the two side flares down to the road
    push(x0, ya, zk, x1, ya, zk, x1, yb, z1, x0, ya, zk, x1, yb, z1, x0, yb, z1);
    const zc = zk + dir * S.ramp * (0 - ya) / (yb - ya);
    push(x0, ya, zk, x0, 0, zc, x0, 0, zk); push(x1, ya, zk, x1, 0, zk, x1, 0, zc);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    if (dir > 0) { const p = g.attributes.position; for (let i = 0; i < p.count; i += 3) { const ax = p.getX(i + 1), ay = p.getY(i + 1), az = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, ax, ay, az); } }
    const uv = []; const p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.push(p.getX(i) / 1.5, -p.getZ(i) / 1.5 + p.getY(i));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    this.geo('concrete', g, _pgM.identity(), 0xc9c6be);
    // the yellow warning tiles at the bottom of the ramp
    const tg = new THREE.PlaneGeometry(x1 - x0 - 0.2, 0.6); tg.rotateX(-Math.PI / 2);
    const k = (yb - ya) / S.ramp; tg.rotateX(-dir * Math.atan(k));
    const tuv = tg.attributes.uv; for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getX(i) * (x1 - x0) / 0.5, tuv.getY(i) * 1.2);
    _pgM.makeTranslation((x0 + x1) / 2, ya + k * 0.32 + 0.004, zk + dir * 0.32);
    this.geo('tactile', tg, _pgM, 0xd8b020);
  }
  buildStreetFurniture() {
    const S = PG_ST, k0 = TR.kerb0, k1 = TR.kerb1, c0 = TR.cross.x0, c1 = TR.cross.x1, C = PG_COL;
    // fire hydrant by the crossing
    { const x = 6.8, z = k1 + 0.55, b = this.baseHeight(x, z);
      const body = new THREE.CylinderGeometry(0.13, 0.15, 0.62, 14); _pgM.makeTranslation(x, b + 0.31, z); this.geo('paint', body, _pgM, 0xb8261c);
      const cap = new THREE.SphereGeometry(0.135, 14, 8, 0, TAU, 0, Math.PI / 2); _pgM.makeTranslation(x, b + 0.62, z); this.geo('paint', cap, _pgM, 0xb8261c);
      const nut = new THREE.CylinderGeometry(0.035, 0.045, 0.06, 5); _pgM.makeTranslation(x, b + 0.77, z); this.geo('paint', nut, _pgM, 0xd8d2c0);
      for (const a of [0, Math.PI, Math.PI / 2]) { const n = new THREE.CylinderGeometry(a === Math.PI / 2 ? 0.07 : 0.05, a === Math.PI / 2 ? 0.07 : 0.05, 0.12, 10); n.rotateZ(Math.PI / 2); n.rotateY(a); _pgM.makeTranslation(x + Math.cos(a) * 0.15, b + 0.44, z - Math.sin(a) * 0.15); this.geo('paint', n, _pgM, 0xd8d2c0); }
      const fl = new THREE.CylinderGeometry(0.19, 0.19, 0.05, 14); _pgM.makeTranslation(x, b + 0.03, z); this.geo('paint', fl, _pgM, 0xb8261c);
      this.collider(x - 0.15, b, z - 0.15, x + 0.15, b + 0.75, z + 0.15); this.obstacle(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
    }
    // signs: pedestrian crossing at both ramps, children at play, the speed limit, the bus stop
    this.sign(0, c0 - 0.6, k1 + 0.35, -Math.PI / 2, 0.76, 0.76, 2.1);
    this.sign(0, c1 + 0.6, k0 - 0.35, Math.PI / 2, 0.76, 0.76, 2.1);
    this.sign(2, -26, k1 + 0.35, -Math.PI / 2, 0.76, 0.76, 2.1);
    this.sign(2, 30, k0 - 0.35, Math.PI / 2, 0.76, 0.76, 2.1);
    this.sign(1, -52, k1 + 0.35, -Math.PI / 2, 0.6, 0.76, 2.0);
    this.sign(1, 60, k0 - 0.35, Math.PI / 2, 0.6, 0.76, 2.0);
    this.sign(3, 16.6, k1 + 0.35, -Math.PI / 2, 0.45, 0.6, 2.2);
    // the bus shelter: glass back and sides on a steel frame, a roof, a bench and a lit advert
    { const x0 = 17.6, x1 = 21.6, zf = -32.05, zb = -30.55, h = 2.45, st = 0x3d4146;
      for (const [x, z] of [[x0, zb], [x1, zb], [x0, zf + 0.12], [x1, zf + 0.12]]) this.box('paint', x - 0.04, 0, z - 0.04, x + 0.04, h, z + 0.04, st);
      this.box('paint', x0 - 0.15, h, zf - 0.15, x1 + 0.15, h + 0.12, zb + 0.12, st);
      this.box('glassPG', x0 + 0.04, 0.12, zb - 0.015, x1 - 0.04, h - 0.05, zb + 0.015, 0xffffff);
      this.box('glassPG', x0 - 0.015, 0.12, zb + 0.04, x0 + 0.015, h - 0.05, zf + 0.5, 0xffffff);
      this.box('lamp', x1 - 0.03, 0.4, zb + 0.08, x1 + 0.03, 2.0, zf + 0.5, 0xffffff);
      this.collider(x0 - 0.05, 0, zb - 0.06, x1 + 0.05, h + 0.12, zb + 0.06); this.obstacle(x0 - 0.05, zb - 0.06, x1 + 0.05, zb + 0.06);
      this.collider(x0 - 0.05, 0, zb, x0 + 0.05, h, zf + 0.55); this.obstacle(x0 - 0.05, zb, x0 + 0.05, zf + 0.55);
      this.collider(x1 - 0.05, 0, zb, x1 + 0.05, h, zf + 0.55); this.obstacle(x1 - 0.05, zb, x1 + 0.05, zf + 0.55);
      this.collider(x0 - 0.15, h, zf - 0.15, x1 + 0.15, h + 0.12, zb + 0.12);
      this._bench((x0 + x1) / 2, -30.98, Math.PI);
      this.bin(x1 + 0.55, -32.4);
    }
    // wooden utility poles on the far verge: crossarms, wires, and street lights over the road
    const poles = [];
    for (let x = -84; x <= 84; x += 32) {
      let px = x;
      for (let k = 0; k < 8; k++) { if (!this.housePlan.some(H => (px > H.drive[0] - 1.2 && px < H.drive[1] + 1.2) || (px > H.walk[0] - 1.2 && px < H.walk[1] + 1.2) || Math.abs(px - H.mail) < 1)) break; px += 1.6; }
      poles.push(px);
    }
    this.streetLamps = [];
    const pz = S.far - 0.75;
    for (const x of poles) {
      this.bar('wood', new V3(x, 0, pz), new V3(x, 9.6, pz), 0.14, 0x6e5a44, 10);
      this.box('wood', x - 0.07, 8.85, pz - 1.05, x + 0.07, 8.97, pz + 1.05, 0x6a5640);
      for (const dz of [-0.9, 0, 0.9]) { const ins = new THREE.CylinderGeometry(0.035, 0.05, 0.14, 8); _pgM.makeTranslation(x, 9.04, pz + dz); this.geo('plastic', ins, _pgM, 0x6d8c6a); }
      // the street light: an arm out over the parking lane, a cobra head with its lens down
      this.bar('paint', new V3(x, 7.3, pz), new V3(x, 7.62, pz + 2.3), 0.035, 0x8a9096, 8);
      const head = new THREE.SphereGeometry(0.3, 12, 6); head.scale(0.75, 0.32, 1.25); _pgM.makeTranslation(x, 7.62, pz + 2.55); this.geo('paint', head, _pgM, 0x9aa0a6);
      const lens = new THREE.CircleGeometry(0.22, 14); lens.rotateX(Math.PI / 2); lens.scale(0.8, 1, 1.2); _pgM.makeTranslation(x, 7.53, pz + 2.6); this.geo('lamp', lens, _pgM, 0xffffff);
      this.streetLamps.push(new V3(x, 7.5, pz + 2.6));
      this.collider(x - 0.14, 0, pz - 0.14, x + 0.14, 9.6, pz + 0.14); this.obstacle(x - 0.2, pz - 0.2, x + 0.2, pz + 0.2);
    }
    for (let i = 0; i + 1 < poles.length; i++) for (const [dz, y, sag] of [[-0.9, 8.97, 0.55], [0, 8.97, 0.6], [0.9, 8.97, 0.55], [0, 6.9, 0.45]]) {
      const a = poles[i], b = poles[i + 1], n = 10;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, y0 = y - sag * 4 * t0 * (1 - t0), y1 = y - sag * 4 * t1 * (1 - t1);
        this.bar('paint', new V3(lerp(a, b, t0), y0, pz + dz), new V3(lerp(a, b, t1), y1, pz + dz), 0.011, 0x1e2022, 4);
      }
    }
    // more lanterns along the park-side sidewalk beyond the park
    for (const x of [-70, -50, 50, 70]) this.lamp(x, -33.4);
    for (const p of this.lampPosts) if (p.z < -32) this.streetLamps.push(p);
  }
  // a road sign: tile of the sign atlas, on a grey post, the face looking along yaw
  sign(tile, x, z, yaw, w, h, postH) {
    const b = this.baseHeight(x, z);
    this.bar('paint', new V3(x, b, z), new V3(x, b + postH + h * 0.5, z), 0.03, 0x8e9499, 8);
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    const u0 = tile * 0.25 + (0.25 - 0.25 * w / Math.max(w, h)) / 2, u1 = u0 + 0.25 * w / Math.max(w, h), v0 = (1 - h / Math.max(w, h)) / 2, v1 = 1 - v0;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
    _pgQ.setFromAxisAngle(UP, yaw);
    _pgM.compose(_pgV.set(x + Math.sin(yaw) * 0.045, b + postH, z + Math.cos(yaw) * 0.045), _pgQ, _pgS); this.geo('sign', g, _pgM, 0xffffff);
    const bk = new THREE.PlaneGeometry(w * 0.98, h * 0.98); _pgQ.setFromAxisAngle(UP, yaw + Math.PI);
    if (tile === 0 || tile === 2) { bk.rotateZ(Math.PI / 4); bk.scale(0.7, 0.7, 1); }
    _pgM.compose(_pgV.set(x + Math.sin(yaw) * 0.035, b + postH, z + Math.cos(yaw) * 0.035), _pgQ, _pgS); this.geo('paint', bk, _pgM, 0x8e9499);
    this.collider(x - 0.04, b, z - 0.04, x + 0.04, b + postH, z + 0.04); this.obstacle(x - 0.1, z - 0.1, x + 0.1, z + 0.1);
  }
  // ------------------------------------------------------------- houses (V1.15) ---
  // planned before anything is built: the grass, the paths and the parking spaces need the driveways
  planHouses() {
    const r = new RNG(2024);
    this.housePlan = []; this.driveways = []; this.lots = [];
    const xs = [-54, -36, -18, 0, 18, 36, 54];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i], w = 9.2 + r.range(0, 1.6), d = 8.4 + r.range(0, 0.8), gs = i % 2 ? 1 : -1, gw = 3.6;
      const cx = x - gs * (gw / 2 + 0.2) + r.range(-0.5, 0.5), cz = -63 - r.range(0, 1.0), front = cz + d / 2;
      const gx0 = gs > 0 ? cx + w / 2 + 0.05 : cx - w / 2 - 0.05 - gw, gx1 = gx0 + gw;
      const H = { i, x, cx, cz, w, d, gs, gw, gx0, gx1, front, drive: [gx0 + 0.25, gx1 - 0.25], walk: [cx - 0.65, cx + 0.65] };
      H.mail = gs > 0 ? H.drive[1] + 0.5 : H.drive[0] - 0.5;
      this.housePlan.push(H); this.driveways.push(H.drive.slice());
      this.lots.push([x - 9, cz - d / 2 - 1.5, x + 9, PG_ST.far]);
    }
  }
  yardRects() {
    const out = [];
    for (const H of this.housePlan) { out.push([H.drive[0], H.front - 0.4, H.drive[1], PG_ST.far]); out.push([H.walk[0], H.front + 2.2, H.walk[1], PG_ST.far]); }
    return out;
  }
  buildHouses() {
    const r = new RNG(2024), sid = [0xe8e2d4, 0xc9d6dc, 0xd7c49e, 0xb8c9b0, 0xe6d3c3, 0xa9b7c6, 0xd9d9d9, 0xc4a98c], roofs = [0x4a4d52, 0x5a3b30, 0x3d4a5a, 0x6b6b66];
    this.yardBushes = []; this.flowerBeds = []; this.streetTrees = [];
    for (const H of this.housePlan) this.house(r, H.cx, H.cz, 1, H.w, H.d, sid, roofs, H);
    for (const x of [-36, -18, 18, 36]) this.house(r, x + r.range(-1, 1), 50, -1, 9.5 + r.range(0, 1.5), 8.5, sid, roofs, null);
    this.apartment(-62, -24, -48, 6, 4, 1, 0xb46a52, r);
    this.apartment(48, -27, 61, 9, 5, -1, 0xd9d2c6, r);
    // street trees on the verge between the driveways
    for (const H of this.housePlan) for (const dx of [-6.2, 6.2]) {
      const x = H.x + dx;
      if ((x > H.drive[0] - 2 && x < H.drive[1] + 2) || Math.abs(x - H.cx) < 2.2) continue;
      this.streetTrees.push([x, PG_ST.far - 1.6]);
    }
  }
  house(r, cx, cz, face, w, d, sid, roofs, H) { // face: the way the front door looks (+1: south/+z, -1: north)
    const rot = face === 1 ? 0 : Math.PI, c = Math.cos(rot), s = Math.sin(rot);
    const T = (lx, ly, lz) => new V3(cx + lx * c + lz * s, ly, cz - lx * s + lz * c);
    const Bx = (mat, x0, y0, z0, x1, y1, z1, col) => { const a = T(x0, y0, z0), b = T(x1, y1, z1); this.box(mat, Math.min(a.x, b.x), y0, Math.min(a.z, b.z), Math.max(a.x, b.x), y1, Math.max(a.z, b.z), col); };
    const wallH = 5.8, sc = sid[Math.floor(r.next() * sid.length)], rc = roofs[Math.floor(r.next() * roofs.length)];
    const shut = [0x2b3d5c, 0x2f4a33, 0x3a3a3a, 0x6b2a24, 0xf4f2ec][Math.floor(r.next() * 5)];
    Bx('brick', -w / 2 - 0.05, 0, -d / 2 - 0.05, w / 2 + 0.05, 0.6, d / 2 + 0.05, 0xb0a8a0);
    Bx('siding', -w / 2, 0.6, -d / 2, w / 2, wallH, d / 2, sc);
    Bx('trim', -w / 2 - 0.04, 0.6, d / 2 - 0.08, -w / 2 + 0.08, wallH, d / 2 + 0.04, 0xf4f2ec); Bx('trim', w / 2 - 0.08, 0.6, d / 2 - 0.08, w / 2 + 0.04, wallH, d / 2 + 0.04, 0xf4f2ec);
    const rh = 2.6 + r.next() * 0.6, over = 0.45;
    for (const sg of [-1, 1]) {
      const g = new THREE.BoxGeometry(w + over * 2, 0.12, Math.hypot(d / 2 + over, rh)); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w + 1) / 3, uv.getY(i) * (d / 2 + over) / 3);
      _pgQ.setFromAxisAngle(new V3(1, 0, 0), sg * Math.atan2(rh, d / 2 + over)).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, rot));
      _pgM.compose(T(0, wallH + rh / 2 - 0.05, sg * (d / 2 + over) / 2), _pgQ, _pgS); this.geo('roof', g, _pgM, rc);
      // gutter along the eave and a downpipe at the corner
      Bx('paint', -w / 2 - over, wallH - 0.12, sg * (d / 2 + over) - 0.06, w / 2 + over, wallH - 0.02, sg * (d / 2 + over) + 0.06, 0xe8e8e2);
      Bx('paint', sg * (w / 2 + 0.02) - 0.04, 0, sg * (d / 2 + over) - 0.04 * sg - 0.03, sg * (w / 2 + 0.02) + 0.04, wallH - 0.1, sg * (d / 2 + over) - 0.04 * sg + 0.03, 0xe8e8e2);
    }
    for (const sg of [-1, 1]) {
      const sh = new THREE.Shape(); sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(0, rh); sh.lineTo(-d / 2, 0);
      const g = new THREE.ShapeGeometry(sh); g.rotateY(sg * Math.PI / 2);
      _pgQ.setFromAxisAngle(UP, rot); _pgM.compose(T(sg * w / 2, wallH, 0), _pgQ, _pgS); this.geo('siding', g, _pgM, sc);
    }
    if (r.next() < 0.7) Bx('brick', w * 0.25, wallH, -0.4, w * 0.25 + 0.7, wallH + rh + 0.6, 0.3, 0x8a5a48);
    // windows (with sills and shutters), the door, the porch and its steps on the front (+z local)
    const fz = d / 2 + 0.03;
    for (const y of [1.3, 3.9]) for (const x of [-w * 0.33, w * 0.33]) {
      Bx(r.next() < 0.45 ? 'window2' : 'window', x - 0.55, y, fz - 0.02, x + 0.55, y + 1.3, fz, 0xffffff);
      Bx('trim', x - 0.65, y - 0.12, fz - 0.01, x + 0.65, y - 0.02, fz + 0.06, 0xf4f2ec);
      for (const sx of [-1, 1]) Bx('trim', x + sx * 0.62 - 0.17, y - 0.02, fz - 0.01, x + sx * 0.62 + 0.17, y + 1.32, fz + 0.03, shut);
    }
    Bx('window', -0.5, 3.9, fz - 0.02, 0.5, 5.1, fz, 0xffffff);
    Bx('trim', -0.5, 0.6, fz - 0.02, 0.5, 2.7, fz + 0.03, [0x7a2420, 0x2b3d5c, 0x2f4a33, 0x3a3a3a][Math.floor(r.next() * 4)]);
    Bx('steel', 0.3, 1.55, fz + 0.03, 0.36, 1.62, fz + 0.06, 0xd8c070);
    Bx('wood', -1.6, 0.4, fz, 1.6, 0.6, fz + 1.8, 0x9c7a5a);
    Bx('concrete', -0.75, 0, fz + 1.8, 0.75, 0.2, fz + 2.2, 0xc4c1b9); Bx('concrete', -0.75, 0.2, fz + 1.8, 0.75, 0.4, fz + 2.0, 0xc4c1b9);
    for (const x of [-1.5, 1.5]) Bx('trim', x - 0.08, 0.6, fz + 1.62, x + 0.08, 3.0, fz + 1.78, 0xf4f2ec);
    Bx('trim', -1.7, 3.0, fz, 1.7, 3.15, fz + 1.9, 0xf4f2ec);
    for (const x of [-w * 0.33, w * 0.33]) Bx('window', x - 0.55, 1.3, -d / 2 - 0.03, x + 0.55, 2.6, -d / 2 - 0.01, 0xffffff);
    for (const sg of [-1, 1]) Bx('window2', sg * (w / 2 + 0.02) - 0.01, 1.4, -0.6, sg * (w / 2 + 0.02) + 0.01, 2.6, 0.6, 0xffffff);
    if (!H) {
      // the houses behind the park: a walkway and a white picket fence along the lot front
      const lot = 6.0, wa = T(-0.6, 0, fz), wb = T(0.6, 0, fz + lot);
      this.quad('concrete', Math.min(wa.x, wb.x), Math.min(wa.z, wb.z), Math.max(wa.x, wb.x), Math.max(wa.z, wb.z), 0.012, 0xd0cdc5);
      const n = Math.round(w + 3) * 6;
      for (let k = 0; k <= n; k++) { const t = k / n, x = lerp(-w / 2 - 1.5, w / 2 + 1.5, t); if (Math.abs(x) < 0.7) continue; Bx('trim', x - 0.03, 0, fz + lot - 0.015, x + 0.03, 0.9, fz + lot + 0.015, 0xf6f6f2); }
      for (const y of [0.25, 0.7]) { Bx('trim', -w / 2 - 1.5, y, fz + lot - 0.03, -0.7, y + 0.06, fz + lot - 0.015, 0xf6f6f2); Bx('trim', 0.7, y, fz + lot - 0.03, w / 2 + 1.5, y + 0.06, fz + lot - 0.015, 0xf6f6f2); }
      return;
    }
    // the houses across the street: an attached garage, a driveway, a mailbox, shrubs and flowers
    const g0 = H.gx0 - cx, g1 = H.gx1 - cx, gz0 = fz - 6.6, gz1 = fz - 0.4, gh = 3.0;
    Bx('brick', g0, 0, gz0, g1, 0.35, gz1, 0xb0a8a0);
    Bx('siding', g0, 0.35, gz0, g1, gh, gz1, sc);
    for (const sg of [-1, 1]) { // a low gable roof, ridge toward the street
      const half = (g1 - g0) / 2 + 0.3, rr2 = 1.1, g = new THREE.BoxGeometry(Math.hypot(half, rr2), 0.1, gz1 - gz0 + 0.6); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.2, uv.getY(i) * 2);
      _pgQ.setFromAxisAngle(new V3(0, 0, 1), -sg * Math.atan2(rr2, half));
      _pgM.compose(T((g0 + g1) / 2 + sg * half / 2, gh + rr2 / 2, (gz0 + gz1) / 2), _pgQ, _pgS); this.geo('roof', g, _pgM, rc);
    }
    { const sh = new THREE.Shape(), hw = (g1 - g0) / 2; sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, 1.05); sh.lineTo(-hw, 0); const gg = new THREE.ShapeGeometry(sh); _pgM.makeTranslation(cx + (g0 + g1) / 2, gh, cz + gz1 + 0.005); this.geo('siding', gg, _pgM, sc); }
    Bx('trim', g0 + 0.3, 0, gz1, g1 - 0.3, 2.3, gz1 + 0.03, 0xf2f1ec);
    for (let k = 1; k < 4; k++) Bx('trim', g0 + 0.3, k * 0.575 - 0.012, gz1 + 0.03, g1 - 0.3, k * 0.575 + 0.012, gz1 + 0.04, 0xc8c7c2);
    Bx('trim', g0 + 0.22, 2.3, gz1, g1 - 0.22, 2.42, gz1 + 0.06, 0xf4f2ec);
    { const lx = H.gs > 0 ? g0 + 0.12 : g1 - 0.12; Bx('lamp', lx - 0.06, 2.0, gz1 + 0.02, lx + 0.06, 2.22, gz1 + 0.12, 0xffffff); }
    // lot fence along the yard front, open for the walkway and the driveway
    const zf = PG_ST.far - 3.0, gaps = [[H.walk[0] - 0.1, H.walk[1] + 0.1], [H.drive[0] - 0.3, H.drive[1] + 0.3]].sort((a, b) => a[0] - b[0]);
    let x = H.x - 9;
    for (const [ga, gb] of gaps.concat([[H.x + 9, H.x + 9]])) {
      if (ga - x > 0.3) {
        for (let t = x + 0.02; t < ga - 0.02; t += 0.16) this.box('trim', t - 0.028, 0, zf - 0.015, t + 0.028, 0.9, zf + 0.015, 0xf6f6f2);
        for (const y of [0.25, 0.7]) this.box('trim', x, y, zf - 0.035, ga, y + 0.06, zf - 0.015, 0xf6f6f2);
        this.collider(x, 0, zf - 0.08, ga, 0.92, zf + 0.08); this.obstacle(x, zf - 0.05, ga, zf + 0.05);
      }
      x = gb;
    }
    // the mailbox on its post by the driveway
    { const mx = H.mail, mz = PG_ST.far - 0.45;
      this.box('wood', mx - 0.045, 0, mz - 0.045, mx + 0.045, 1.0, mz + 0.045, 0x5d4a36);
      this.box('paint', mx - 0.12, 1.0, mz - 0.25, mx + 0.12, 1.16, mz + 0.25, 0x2a2c2f);
      const top = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 12, 1, false, 0, Math.PI); top.rotateX(Math.PI / 2); top.rotateZ(-Math.PI / 2); _pgM.makeTranslation(mx, 1.16, mz); this.geo('paint', top, _pgM, 0x2a2c2f);
      this.box('paint', mx + 0.12, 1.12, mz - 0.1, mx + 0.135, 1.36, mz - 0.04, 0xc0281e);
      this.collider(mx - 0.13, 0, mz - 0.26, mx + 0.13, 1.28, mz + 0.26); this.obstacle(mx - 0.15, mz - 0.28, mx + 0.15, mz + 0.28);
    }
    // shrubs along the front wall and a flower bed before them
    for (let bx2 = -w / 2 + 0.7; bx2 < w / 2 - 0.5; bx2 += 1.25) if (Math.abs(bx2) > 2.0) this.yardBushes.push([cx + bx2, cz + fz + 0.75, 0.55 + r.next() * 0.25]);
    this.flowerBeds.push([cx - w / 2 + 0.3, cz + fz + 1.25, cx - 2.0, cz + fz + 1.75, 9], [cx + 2.0, cz + fz + 1.25, cx + w / 2 - 0.3, cz + fz + 1.75, 9]);
  }
  // an apartment block: floors of windows on the side facing the park, balconies with railings on every
  // other bay, an entrance under a canopy, a parapet and plant on the roof (face +1: the facade looks east)
  apartment(x0, z0, x1, z1, floors, face, col, r) {
    const fh = 3.1, base = 0.9, H = base + floors * fh, fx = face > 0 ? x1 : x0, o = face;
    const X = (a, b) => [Math.min(fx + a * o, fx + b * o), Math.max(fx + a * o, fx + b * o)];
    const bx = (mat, a, b, y0, y1, za, zb, colr) => { const [xa, xb] = X(a, b); this.box(mat, xa, y0, za, xb, y1, zb, colr); };
    this.box('brick', x0, 0, z0, x1, H, z1, col);
    this.box('concrete', x0 - 0.12, 0, z0 - 0.12, x1 + 0.12, base, z1 + 0.12, 0x9d9a92);
    this.box('trim', x0 - 0.3, H, z0 - 0.3, x1 + 0.3, H + 0.5, z1 + 0.3, 0x9c9a94);
    for (let f = 1; f < floors; f++) bx('concrete', -0.02, 0.06, base + f * fh - 0.1, base + f * fh + 0.08, z0, z1, 0xb9b5ac);   // floor bands
    const bays = Math.floor((z1 - z0 - 1.0) / 3.0), bz = z0 + (z1 - z0 - bays * 3.0) / 2, mid = Math.floor(bays / 2);
    for (let f = 0; f < floors; f++) for (let k = 0; k < bays; k++) {
      const zc = bz + 1.5 + k * 3.0, yf = base + f * fh;
      if (f === 0 && k === mid) { // the entrance
        bx('window', -0.02, 0.03, 0.02, 2.5, zc - 1.0, zc + 1.0, 0xffffff);
        bx('concrete', 0, 1.7, 2.75, 2.95, zc - 1.6, zc + 1.6, 0xc8c4bb);
        bx('lamp', 1.2, 1.3, 2.72, 2.75, zc - 0.25, zc + 0.25, 0xffffff);
        continue;
      }
      const balc = f > 0 && k % 2 === 1;
      bx(r.next() < 0.45 ? 'window2' : 'window', -0.02, 0.03, balc ? yf + 0.08 : yf + 0.85, yf + 2.35, zc - (balc ? 0.75 : 0.65), zc + (balc ? 0.75 : 0.65), 0xffffff);
      if (!balc) { bx('trim', -0.02, 0.09, yf + 0.74, yf + 0.84, zc - 0.75, zc + 0.75, 0xd6d2c8); continue; }
      // the balcony: slab, railing (posts, bars, top rail) and sometimes a chair and a plant
      bx('concrete', 0, 1.35, yf - 0.12, yf + 0.06, zc - 1.35, zc + 1.35, 0xc2beb5);
      bx('paint', 1.27, 1.33, yf + 0.98, yf + 1.04, zc - 1.33, zc + 1.33, 0x2f3235);
      for (const zz of [zc - 1.31, zc + 1.31]) bx('paint', 0.02, 1.33, yf + 0.98, yf + 1.04, zz - 0.025, zz + 0.025, 0x2f3235);
      for (let t = zc - 1.2; t <= zc + 1.21; t += 0.15) bx('paint', 1.285, 1.305, yf + 0.08, yf + 0.98, t - 0.009, t + 0.009, 0x2f3235);
      for (const zz of [zc - 1.31, zc + 1.31]) for (let t = 0.15; t < 1.25; t += 0.15) bx('paint', t - 0.009, t + 0.009, yf + 0.08, yf + 0.98, zz - 0.009, zz + 0.009, 0x2f3235);
      if (r.next() < 0.5) { bx('plastic', 0.3, 0.75, yf + 0.06, yf + 0.5, zc + 0.5, zc + 0.95, [0xf2f2ee, 0x2e6b4a, 0x9a3a2a][Math.floor(r.next() * 3)]); bx('plastic', 0.68, 0.75, yf + 0.5, yf + 0.95, zc + 0.5, zc + 0.95, 0xf2f2ee); }
      if (r.next() < 0.6) { const p = new THREE.CylinderGeometry(0.16, 0.12, 0.3, 10); const [xa, xb] = X(1.0, 1.0); _pgM.makeTranslation(xa, yf + 0.21, zc - 0.9); this.geo('plastic', p, _pgM, 0xa0583a); const lf = new THREE.IcosahedronGeometry(0.26, 1); lf.scale(1, 0.8, 1); _pgM.makeTranslation(xa, yf + 0.55, zc - 0.9); this.geo('seat', lf, _pgM, 0x3f6e34); void xb; }
    }
    // rooftop: air handlers and the stair housing
    for (let k = 0; k < 3; k++) { const zc = lerp(z0 + 3, z1 - 3, (k + 0.5) / 3) + r.range(-1, 1), xc = lerp(x0, x1, 0.35 + r.next() * 0.3); this.box('paint', xc - 0.9, H, zc - 0.7, xc + 0.9, H + 1.2, zc + 0.7, 0x9aa0a4); this.box('paint', xc - 0.5, H + 1.2, zc - 0.5, xc + 0.5, H + 1.3, zc + 0.5, 0x3a3e42); }
    this.box('brick', lerp(x0, x1, 0.3), H, z0 + 2, lerp(x0, x1, 0.6), H + 2.6, z0 + 5, col);
  }
  // V1.15: more to the park - a sandbox with toys, a rope net climber, a drinking fountain, a bike
  // rack with bikes, the park's name board at the north entrance
  buildExtras() {
    const C = PG_COL, SB = this.sandbox = { x0: 5.2, z0: 4.4, x1: 8.3, z1: 8.8, y: 0.075 };
    // the sandbox: a timber frame people step over, sand a little below its top
    for (const [x0, z0, x1, z1] of [[SB.x0 - 0.12, SB.z0 - 0.12, SB.x1 + 0.12, SB.z0], [SB.x0 - 0.12, SB.z1, SB.x1 + 0.12, SB.z1 + 0.12], [SB.x0 - 0.12, SB.z0, SB.x0, SB.z1], [SB.x1, SB.z0, SB.x1 + 0.12, SB.z1]]) {
      this.box('wood', x0, 0, z0, x1, 0.2, z1, 0xa77a50); this.tops.push({ x0, x1, z0, z1, h: 0.2 }); this.collider(x0, 0, z0, x1, 0.2, z1);
    }
    this.quad('sand', SB.x0, SB.z0, SB.x1, SB.z1, SB.y, 0xffffff);
    { const b = new THREE.CylinderGeometry(0.11, 0.085, 0.17, 12, 1, true); _pgM.makeTranslation(6.1, SB.y + 0.085, 5.3); this.geo('plastic', b, _pgM, 0xd8342a);
      const bb = new THREE.CircleGeometry(0.085, 12); bb.rotateX(-Math.PI / 2); _pgM.makeTranslation(6.1, SB.y + 0.003, 5.3); this.geo('plastic', bb, _pgM, 0xd8342a);
      this.box('plastic', 6.5, SB.y, 5.05, 6.56, SB.y + 0.02, 5.4, 0x2a6ad0); this.box('plastic', 6.48, SB.y, 5.38, 6.6, SB.y + 0.02, 5.55, 0x2a6ad0);
      for (const [x, z, r, h] of [[7.2, 7.6, 0.26, 0.22], [7.45, 7.75, 0.14, 0.3], [6.95, 7.85, 0.13, 0.26], [7.25, 8.05, 0.12, 0.24]]) { const c = new THREE.ConeGeometry(r, h, 10); _pgM.makeTranslation(x, SB.y + h / 2, z); this.geo('sand', c, _pgM, 0xd9c49a); }
    }
    // a rope pyramid on the lawn: a steel mast, ropes from its top to a ring of anchors, rings of rope between
    { const cx = -24.5, cz = 15.5, R = 2.3, H = 4.2, n = 10, rc = 0xb3262a;
      this.bar('steel', new V3(cx, 0, cz), new V3(cx, H + 0.25, cz), 0.06, 0xc0c4c8, 10);
      const cap = new THREE.SphereGeometry(0.11, 10, 8); _pgM.makeTranslation(cx, H + 0.28, cz); this.geo('paint', cap, _pgM, C.yellow);
      const top = new V3(cx, H, cz), pts = [];
      for (let k = 0; k < n; k++) { const a = k / n * TAU; pts.push(new V3(cx + Math.cos(a) * R, 0.12, cz + Math.sin(a) * R)); this.box('paint', pts[k].x - 0.06, 0, pts[k].z - 0.06, pts[k].x + 0.06, 0.16, pts[k].z + 0.06, 0x3a3e42); }
      for (const p of pts) this.bar('paint', p, top, 0.02, rc, 5);
      for (let r = 1; r <= 4; r++) { const t = r / 5; for (let k = 0; k < n; k++) { const a = pts[k].clone().lerp(top, t), b = pts[(k + 1) % n].clone().lerp(top, t); this.bar('paint', a, b, 0.017, rc, 4); } }
      this.collider(cx - 0.08, 0, cz - 0.08, cx + 0.08, H + 0.3, cz + 0.08);
      this.obstacle(cx - R * 0.8, cz - R * 0.8, cx + R * 0.8, cz + R * 0.8);
    }
    // the drinking fountain by the south gate
    { const x = 2.4, z = 12.9;
      this.box('concrete', x - 0.2, 0, z - 0.2, x + 0.2, 0.82, z + 0.2, 0x9ea3a8);
      const bowl = new THREE.CylinderGeometry(0.24, 0.17, 0.1, 16); _pgM.makeTranslation(x, 0.87, z); this.geo('steel', bowl, _pgM, 0xd0d4d8);
      this.bar('steel', new V3(x + 0.05, 0.9, z), new V3(x - 0.04, 0.98, z), 0.012, 0xd0d4d8, 6);
      this.collider(x - 0.24, 0, z - 0.24, x + 0.24, 0.92, z + 0.24); this.obstacle(x - 0.28, z - 0.28, x + 0.28, z + 0.28);
    }
    // a bike rack with two bikes by the north entrance
    { const x0 = 3.0, z = -29.6;
      for (let k = 0; k < 3; k++) { const x = x0 + k * 0.8; this.bar('steel', new V3(x, 0, z - 0.3), new V3(x, 0.75, z - 0.3), 0.025, 0xb8bcc0, 8); this.bar('steel', new V3(x, 0, z + 0.3), new V3(x, 0.75, z + 0.3), 0.025, 0xb8bcc0, 8); this.bar('steel', new V3(x, 0.75, z - 0.3), new V3(x, 0.75, z + 0.3), 0.025, 0xb8bcc0, 8); }
      const bike = (x, col) => {
        for (const dz of [-0.52, 0.52]) { const w = new THREE.TorusGeometry(0.31, 0.022, 6, 22); w.rotateY(Math.PI / 2); _pgM.makeTranslation(x, 0.33, z + dz); this.geo('seat', w, _pgM, 0x151617); }
        const P = (dy, dz) => new V3(x, dy, z + dz);
        for (const [a, b] of [[P(0.33, -0.52), P(0.62, -0.12)], [P(0.62, -0.12), P(0.33, 0.12)], [P(0.33, 0.12), P(0.33, -0.52)], [P(0.62, -0.12), P(0.66, 0.38)], [P(0.33, 0.12), P(0.66, 0.38)], [P(0.66, 0.38), P(0.33, 0.52)], [P(0.62, -0.12), P(0.74, -0.18)]]) this.bar('paint', a, b, 0.016, col, 5);
        this.box('seat', x - 0.04, 0.74, z - 0.26, x + 0.04, 0.78, z - 0.1, 0x1a1a1a);
        this.bar('steel', P(0.66, 0.38), P(0.86, 0.33), 0.014, 0xc0c4c8, 5); this.bar('steel', new V3(x - 0.24, 0.88, z + 0.33), new V3(x + 0.24, 0.88, z + 0.33), 0.013, 0x2a2a2a, 5);
      };
      bike(x0 + 0.4, 0x1f6fb8); bike(x0 + 1.2, 0xd84a2a);
      this.collider(x0 - 0.1, 0, z - 0.6, x0 + 1.75, 0.95, z + 0.6); this.obstacle(x0 - 0.15, z - 0.62, x0 + 1.8, z + 0.62);
    }
    // the park's name board at the north entrance, facing the street
    { const x = -3.4, z = -30.5;
      for (const dx of [-0.9, 0.9]) this.box('wood', x + dx - 0.06, 0, z - 0.06, x + dx + 0.06, 1.7, z + 0.06, 0x6b4f35);
      this.box('wood', x - 1.05, 0.95, z - 0.05, x + 1.05, 1.55, z + 0.03, 0x7a5a3c);
      const g = new THREE.PlaneGeometry(1.94, 0.52); _pgM.makeTranslation(x, 1.25, z - 0.056); _pgQ.setFromAxisAngle(UP, Math.PI); _pgM.compose(_pgV.set(x, 1.25, z - 0.056), _pgQ, _pgS); this.geo('parkSign', g, _pgM, 0xffffff);
      this.collider(x - 1.0, 0, z - 0.08, x + 1.0, 1.6, z + 0.08); this.obstacle(x - 1.05, z - 0.1, x + 1.05, z + 0.1);
    }
  }
  // clipped hedges along the park's street edge (open at the path and the bus shelter)
  buildHedges() {
    const z0 = -31.85, z1 = -31.05, h = 0.78, rt = (z1 - z0) / 2;
    for (const [a, b] of [[-34.2, -1.7], [1.7, 16.9], [22.4, 34.2]]) {
      this.box('hedge', a, 0, z0, b, h, z1, 0xffffff);
      const top = new THREE.CylinderGeometry(rt, rt, b - a, 10, 1, false, 0, Math.PI); top.rotateZ(Math.PI / 2);
      const uv = top.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.9, uv.getY(i) * (b - a) / 1.4);
      // an irregular, slightly rounded top (clipped, not a tube)
      const pp = top.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i); pp.setY(i, y * 0.32 + (y > 0.05 ? (Math.sin(x * 3.1) * 0.5 + Math.sin(x * 7.3 + 1) * 0.3) * 0.025 : 0)); }
      top.computeVertexNormals();
      _pgM.makeTranslation((a + b) / 2, h, (z0 + z1) / 2); this.geo('hedge', top, _pgM, 0xffffff);
      this.collider(a, 0, z0, b, h + rt * 0.32, z1); this.obstacle(a, z0, b, z1);
    }
  }
  // flowers: beds round the playground fence, by the paths and in front of the houses; each a stem
  // with leaves and a blossom of its own colour, swaying with the wind
  buildFlowers(q) {
    const beds = [
      [-15.45, -9.6, -14.15, -1.6, 7], [-15.45, 1.6, -14.15, 9.6, 7], [14.15, -9.6, 15.45, -1.6, 7], [14.15, 1.6, 15.45, 9.6, 7],
      [-13.6, 10.15, -1.7, 11.4, 6], [1.7, 10.15, 13.6, 11.4, 6], [-13.6, -11.4, -1.7, -10.15, 6], [1.7, -11.4, 13.6, -10.15, 6],
      [-1.9, -30.9, -1.3, -14, 3], [1.3, -30.9, 1.9, -14, 3], [-4.5, -31.0, -1.9, -30.5, 9], [1.9, -31.0, 4.5, -30.5, 9]
    ].concat(this.flowerBeds || []);
    const rr = new RNG(5151), pts = [];
    for (const [x0, z0, x1, z1, dens] of beds) {
      const n = Math.round((x1 - x0) * (z1 - z0) * dens * (q === 'low' ? 0.5 : 1));
      for (let i = 0; i < n; i++) {
        const x = rr.range(x0, x1), z = rr.range(z0, z1);
        if (this.onPath(x, z) || this.obstacles.some(o => x > o.x0 - 0.1 && x < o.x1 + 0.1 && z > o.z0 - 0.1 && z < o.z1 + 0.1)) continue;
        pts.push([x, z]);
      }
    }
    if (!pts.length) return;
    // geometry: stem + two leaves (green), blossom (white, tinted per instance)
    const stem = new PGBatch(), bl = new PGBatch();
    { const s = new THREE.CylinderGeometry(0.005, 0.007, 0.3, 4); s.translate(0, 0.15, 0); stem.push(s, _pgM.identity(), _pgC.set(0x3f7a2c));
      for (const [a, y] of [[0.4, 0.08], [2.6, 0.13]]) { const l = new THREE.PlaneGeometry(0.035, 0.09); l.translate(0, 0.045, 0); l.rotateX(-0.9); l.rotateY(a); l.translate(0, y, 0); stem.push(l, _pgM.identity(), _pgC.set(0x4a8a34)); }
      const sh = new THREE.Shape(); for (let k = 0; k <= 40; k++) { const a = k / 40 * TAU, r = 0.03 * (0.55 + 0.45 * Math.abs(Math.cos(a * 2.5))); if (k) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(r, 0); }
      const b = new THREE.ShapeGeometry(sh, 1); b.rotateX(-Math.PI / 2 + 0.25); b.translate(0, 0.305, 0); bl.push(b, _pgM.identity(), _pgC.set(0xffffff));
      const c = new THREE.SphereGeometry(0.008, 6, 4); c.translate(0, 0.31, 0); bl.push(c, _pgM.identity(), _pgC.set(0xf2c22a)); }
    const mat = (sway) => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.4 });
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, this.treeU);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vec4 ipF = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float hf = clamp(position.y / 0.3, 0.0, 1.0) * hf0;
            float gF = sin(uTime * 2.1 + ipF.x * 1.7 + ipF.z * 1.3) * 0.6 + sin(uTime * 3.7 + ipF.z * 2.1) * 0.25;
            transformed.x += hf * (0.012 + 0.03 * uWind) * gF + hf * 0.02 * uWind;
            transformed.z += hf * (0.01 + 0.02 * uWind) * cos(uTime * 1.9 + ipF.x * 2.3);`).replace('#include <common>', '#include <common>\nconst float hf0 = ' + sway.toFixed(2) + ';');
      };
      m.customProgramCacheKey = () => 'ht3d-flower';
      return m;
    };
    const stemM = new THREE.InstancedMesh(stem.geometry(), mat(1), pts.length), blM = new THREE.InstancedMesh(bl.geometry(), mat(1), pts.length);
    const cols = [0xd8263a, 0xf4c21c, 0xf6f2ea, 0x8a4fc8, 0xf08ab2, 0xe86a1e, 0x4e6fd8, 0xc01e5a];
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), c = new THREE.Color();
    pts.forEach(([x, z], i) => {
      const s = rr.range(0.75, 1.3), y = this.baseHeight(x, z);
      qq.setFromAxisAngle(UP, rr.range(0, TAU)); m4.compose(_pgV.set(x, y, z), qq, _pgW.set(s, s * rr.range(0.8, 1.25), s));
      stemM.setMatrixAt(i, m4); blM.setMatrixAt(i, m4);
      blM.setColorAt(i, c.set(cols[Math.floor(rr.next() * cols.length)]).multiplyScalar(rr.range(0.85, 1.1)));
    });
    for (const m of [stemM, blM]) { m.castShadow = false; m.receiveShadow = true; this.group.add(m); }
    blM.instanceColor.needsUpdate = true;
    this.flowers = [stemM, blM];
  }
  // pools of light on the sidewalks and the road under the street lights at night (lit in applyTimeWeather)
  buildStreetLightPools() {
    const tex = Tex.make('pgLampPool', 128, 128, (g2, w, h) => { const gr = g2.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h); });
    const b = new PGBatch();
    for (const p of this.streetLamps || []) {
      const road = p.y > 6, r = road ? 6.5 : 3.2, cz = road ? p.z + 1.2 : p.z, y = this.baseHeight(p.x, cz) + 0.03;
      const g = new THREE.PlaneGeometry(r * 2, r * (road ? 2.4 : 2)); g.rotateX(-Math.PI / 2);
      _pgM.makeTranslation(p.x, y, cz); b.push(g, _pgM, _pgC.set(road ? 0xd9c09a : 0xc8a678));
    }
    if (!b.count) return;
    this.poolMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, opacity: 0 });
    const m = new THREE.Mesh(b.geometry(), this.poolMat); m.renderOrder = 2; m.name = 'pg-lamppools'; this.group.add(m);
  }
  // ------------------------------------------------------------- trees ---
  buildTrees(q) {
    const rr = new RNG(9191);
    this.treeU = { uTime: { value: 0 }, uWind: { value: 0.4 } };
    const n = { b: 58, c: 14, s: q === 'low' ? 100 : 140, f: q === 'low' ? 200 : 360 };
    const built = (x, z, r) => (this.lots || []).some(L => x > L[0] - r && x < L[2] + r && z > L[1] - r && z < L[3] + r) || (x > -63 - r && x < -47 + r && z > -25 - r && z < 7 + r) || (x > 47 - r && x < 62 + r && z > -28 - r && z < 10 + r);
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
    // street trees on the far verge, shrubs in the front yards
    for (const [x, z] of this.streetTrees || []) place('b', x, z, rr.range(0.62, 0.82), rr.range(0.95, 1.1));
    for (const [x, z, s] of this.yardBushes || []) place('s', x, z, s, rr.range(0.7, 0.95));
    // trees in the yards behind the houses and further off
    guard = 0;
    while (cnt.b < n.b && guard++ < 3000) { const a = rr.range(0, TAU), d = rr.range(62, 95), x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(z + 40) < 9 || built(x, z, 2.5)) continue; place('b', x, z, rr.range(0.9, 1.5), rr.range(0.9, 1.2)); }
    guard = 0;
    while (cnt.c < n.c && guard++ < 2000) { const a = rr.range(0, TAU), d = rr.range(62, 110), x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(z + 40) < 9 || built(x, z, 2.5)) continue; place('c', x, z, rr.range(0.9, 1.4), rr.range(0.9, 1.2)); }
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
    const cand = [[-6, 12.5, 0.8], [7, -12.4, 1.0], [16.4, 6, 0.7], [-16.5, -8, 0.9], [0.2, 20, 1.0], [0.1, -25, 0.8], [-3, -33.2, 1.1], [14, -33.3, 0.9], [9, -38, 1.8], [-14, -40, 2.2], [26, 0.3, 0.8], [-4, 2.5, 1.0], [-11.5, 0, 0.7],
      [-19, -35.1, 1.1], [24, -35.05, 0.9], [11, -45.55, 1.2], [-27, -45.6, 1.0], [4.5, -47.6, 0.7]];   // water along the gutters
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
    this.mats.window2.emissive.setRGB(1, 1, 1).multiplyScalar(smoothstep(0.5, 0.95, night) * 0.28);
    this._poolLit = smoothstep(0.35, 0.85, night) * 0.3;
    this._wetDone = null;
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
    let best = this.baseHeight(x, z), slope = this._rk ? this._rk : null, ax = this._rk ? 'z' : 'x';
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
    const SB = this.sandbox; if (SB && p.x > SB.x0 && p.x < SB.x1 && p.z > SB.z0 && p.z < SB.z1 && p.y < 0.3) return 'grass';   // soft sand
    if (p.x > P.x0 && p.x < P.x1 && p.z > P.z0 && p.z < P.z1) return p.y > 0.3 ? 'metal' : 'rubber';
    if (p.z < -32 && p.z > PG_ST.far) return p.y > 0.3 ? 'metal' : 'hard';
    return this.onPath(p.x, p.z) ? 'hard' : 'grass';
  }
  impactSurface(p) { return p.y - this.baseHeight(p.x, p.z) > 0.08 ? 'metal' : this.surfaceAt(p) === 'grass' ? 'grass' : 'hard'; }
  // keep roots on the park, out of the equipment (people on their way to a seat may step in)
  clampToBounds(p, m = 0) {
    p.x = clamp(p.x, PG.bx0 + m, PG.bx1 - m); p.z = clamp(p.z, PG.bz0 + m, PG.bz1 - m);
    if (m <= 0) return p;
    if (this.traffic && p.z < -33 && p.z > PG_ST.far) this.traffic.pushOut(p, Math.min(m, 0.3));
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
    if (this.traffic && p.z < -33 && p.z > PG_ST.far - 0.5) this.traffic.pushCamera(p);
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
    N.cost = new Float32Array(nx * nz).fill(1);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const cx = x0 + (i + 0.5) * c, cz = z0 + (j + 0.5) * c; if (cz > TR.kerb0 - 0.1 && cz < TR.kerb1 + 0.1) N.cost[j * nx + i] = cx > TR.cross.x0 + 0.25 && cx < TR.cross.x1 - 0.25 ? 1.05 : 9; }
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
  // a straight walk that does not cross the road away from the crossing (from the kerb on one side to the other)
  crossesRoad(ax, az, bx, bz) {
    const k0 = TR.kerb0, k1 = TR.kerb1;
    if (Math.max(az, bz) < k0 || Math.min(az, bz) > k1) return false;
    if ((az > k0 && az < k1) || (bz > k0 && bz < k1)) return false;          // already on the road: straight off it
    const t0 = (k1 - az) / (bz - az), t1 = (k0 - az) / (bz - az), xa = ax + (bx - ax) * t0, xb = ax + (bx - ax) * t1;
    return !(Math.min(xa, xb) > TR.cross.x0 + 0.2 && Math.max(xa, xb) < TR.cross.x1 - 0.2);
  }
  losWalk(ax, az, bx, bz) { return this.losClear(ax, az, bx, bz) && !this.crossesRoad(ax, az, bx, bz); }
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
    while (heap.length && it++ < 16000) {
      const k = pop(); if (closed[k] === run) continue; closed[k] = run;
      if (k === goal) { found = true; break; }
      const ki = k % nx, kj = (k / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = ki + di, b = kj + dj; if (a < 0 || b < 0 || a >= nx || b >= N.nz) continue;
        const q = b * nx + a; if (N.block[q] || closed[q] === run) continue;
        if (di && dj && (N.block[kj * nx + a] || N.block[b * nx + ki])) continue; // no corner cutting
        const g = G[k] + (di && dj ? 1.414 : 1) * N.cost[q];
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
    for (let k = 2; k < pts.length; k++) if (!this.losWalk(pts[a].x, pts[a].z, pts[k].x, pts[k].z)) { a = k - 1; out.push(pts[a]); }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // the next point to steer to: straight at the goal when nothing is in the way, else along a path
  navGoal(p, dest, npc) {
    this._navNpc = npc || null;
    if (!npc) return dest;
    const N = npc._pgNav || (npc._pgNav = { path: null, i: 0, t: -9, dx: 1e9, dz: 1e9, losT: -9, los: true, g: new V3(), cw: new V3() });
    // into the road from a sidewalk (to someone lying there): through a gap between the parked cars
    if (this.traffic) {
      const pk = p.z > TR.kerb1 ? 1 : p.z < TR.kerb0 ? -1 : 0, dk = dest.z > TR.kerb1 ? 1 : dest.z < TR.kerb0 ? -1 : 0;
      if (pk !== 0 && dk === 0) {
        const lz = pk > 0 ? TR.lanes[0].park : TR.lanes[1].park, t = clamp((lz - p.z) / ((dest.z - p.z) || 1e-6), 0, 1), xl = p.x + (dest.x - p.x) * t;
        const gx = this.traffic.kerbGap(xl, pk);
        if (Math.abs(gx - xl) > 0.3) {
          const kz = pk > 0 ? TR.kerb1 + 0.45 : TR.kerb0 - 0.45;
          if (Math.abs(p.x - gx) > 0.35) return N.cw.set(gx, p.y, kz);
          return N.cw.set(gx, p.y, pk > 0 ? lz - 1.3 : lz + 1.3);
        }
      }
    }
    // across the street: by the zebra crossing - to the kerb at the crossing, then straight over;
    // anyone standing in the road off the crossing leaves it the shortest way
    { const k0 = TR.kerb0, k1 = TR.kerb1, mid = TR.center, sD = dest.z > mid ? 1 : -1, onRoad = p.z < k1 && p.z > k0, destOnRoad = dest.z < k1 && dest.z > k0;
      if ((onRoad && !destOnRoad) || (Math.sign(p.z - mid) !== sD && this.crossesRoad(p.x, p.z, dest.x, dest.z))) {
        const cx0 = TR.cross.x0 + 0.5, cx1 = TR.cross.x1 - 0.5, xc = clamp((p.x + dest.x) / 2, cx0, cx1);
        if (onRoad) {
          if (p.x > cx0 - 0.4 && p.x < cx1 + 0.4) N.cw.set(clamp(p.x, cx0, cx1), p.y, sD > 0 ? k1 + 0.8 : k0 - 0.8);
          else {
            // off the crossing: to the nearer kerb, round the end of any car parked in the way
            const side = p.z > mid ? 1 : -1, gx = this.traffic ? this.traffic.kerbGap(p.x, side) : p.x, lz = side > 0 ? TR.lanes[0].park : TR.lanes[1].park;
            if (Math.abs(gx - p.x) > 0.3 && (side > 0 ? p.z < lz + 1.15 : p.z > lz - 1.15)) N.cw.set(gx, p.y, side > 0 ? Math.min(p.z, lz - 1.25) : Math.max(p.z, lz + 1.25));
            else N.cw.set(gx, p.y, side > 0 ? k1 + 0.8 : k0 - 0.8);
          }
          if (Math.abs(N.cw.z - dest.z) > 0.5 || Math.abs(N.cw.x - dest.x) > 0.5) return N.cw;
        } else {
          const ez = p.z > mid ? k1 + 0.75 : k0 - 0.75;
          if (Math.hypot(p.x - xc, p.z - ez) > 0.55) dest = N.cw.set(xc, p.y, ez);
          else return N.cw.set(clamp(p.x, cx0, cx1), p.y, p.z > mid ? k0 - 0.8 : k1 + 0.8);
        }
      }
    }
    const now = this.game.time;
    const moved = Math.hypot(dest.x - N.dx, dest.z - N.dz) > 0.8;
    if (moved || now - N.losT > 0.3) { N.los = this.losWalk(p.x, p.z, dest.x, dest.z) || Math.hypot(dest.x - p.x, dest.z - p.z) < 0.8; N.losT = now; }
    if (N.los) { N.path = null; N.dx = dest.x; N.dz = dest.z; return dest; }
    if (!N.path || moved || now - N.t > 4 || N.i >= N.path.length) { N.path = this.findPath(p.x, p.z, dest.x, dest.z); N.i = 1; N.t = now; N.dx = dest.x; N.dz = dest.z; }
    if (!N.path) return dest;
    while (N.i < N.path.length - 1) {
      const w = N.path[N.i];
      if (Math.hypot(w.x - p.x, w.z - p.z) < 0.55 || this.losWalk(p.x, p.z, N.path[N.i + 1].x, N.path[N.i + 1].z)) N.i++; else break;
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
      if (Math.random() < 0.06) { x = P.x + (Math.random() - 0.5) * 30; z = -47.4 + (Math.random() - 0.5) * 1.2; }
      x = clamp(x, PG.bx0 + 1, PG.bx1 - 1); z = clamp(z, PG.bz0 + 0.6, PG.bz1 - 1);
      if (this.blockedAt(x, z) || (z > TR.kerb0 - 0.4 && z < TR.kerb1 + 0.4)) continue;
      b.dest.set(x, this.baseHeight(x, z), z); return;
    }
    b.dest.set(clamp(P.x + (Math.random() - 0.5) * 6, PG.bx0 + 1, PG.bx1 - 1), 0, clamp(P.z + (Math.random() - 0.5) * 6, PG.bz0 + 1, PG.bz1 - 1));
    if (this.onRoad(b.dest.x, b.dest.z)) b.dest.z = b.dest.z > TR.center ? TR.kerb1 + 1.0 : TR.kerb0 - 1.0;
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
      if (this.traffic) this.traffic.blast(p, 12);
    }
    void radius;
  }
  attachPhysics(ph) { ph.movers = this.traffic ? this.traffic.movers : null; }
  preStep(dt) { if (this.traffic) { try { this.traffic.update(dt); } catch (e) { reportError(e, 'traffic'); } } }
  update(dt, cam) {
    super.update(dt, cam);
    this.updateSwings(dt); this.updateSeesaws(dt); this.updateRiders(dt); this.updateSlides(dt);
    if (this.birds) this.birds.update(dt, cam);
    if (this.traffic) this.traffic.updateVisuals(dt, cam);
    this.updateWetSurfaces();
  }
  // rain darkens and polishes the hard surfaces (the road and the sidewalks shine; the rubber and wood soak)
  updateWetSurfaces() {
    const w = this.wetness || 0;
    if (Math.abs(w - (this._wetDone == null ? -1 : this._wetDone)) < 0.01) return;
    this._wetDone = w;
    const M = this.mats, D = this.dryState;
    const set = (k, rWet, dark, env) => { const m = M[k], d = D[k]; if (!m || !d) return; m.roughness = lerp(d.r, rWet, w); m.envMapIntensity = d.e * (1 + env * w); m.color.setScalar(1 - dark * w); };
    set('asphalt', 0.22, 0.32, 1.6); set('concrete', 0.38, 0.22, 1.0); set('tactile', 0.4, 0.15, 0.8); set('mark', 0.3, 0.12, 0.8);
    set('rubber', 0.6, 0.25, 0.5); set('wood', 0.5, 0.28, 0.3); set('deck', 0.35, 0.15, 0.6); set('paint', 0.25, 0.06, 0.5);
    set('brick', 0.6, 0.22, 0.4); set('roof', 0.55, 0.2, 0.5); set('siding', 0.5, 0.08, 0.4);
    if (this.poolMat) this.poolMat.opacity = (this._poolLit || 0) * (1 + 0.6 * w);
  }
  dispose() { if (this.birds) this.birds.dispose(); if (this.traffic) this.traffic.dispose(); this.traffic = null; super.dispose(); }
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
