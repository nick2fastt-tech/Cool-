// ============================================================================
// Traffic (V1.15): the street beside the playground.
// Cars of six kinds and many colours drive both ways in their own lanes, each at its own pace, and
// keep their distance (the Intelligent Driver Model). They stop for anything in the road - people,
// bodies, props, the player - give way at the crosswalk, overtake a blocked lane when the other side
// is clear, park in free spaces and pull out again. Suspension (dive, squat, roll, road shake),
// spinning and steering wheels, headlights at night and in bad weather (with light on the road),
// brake lights, indicators and hazards, engine and tyre sounds. A car that cannot stop in time hits:
// the person is thrown with the car's speed (capped, never launched), hurt and often knocked out;
// the car brakes hard (skid marks), takes a dent and waits with its hazards on. Every car is a
// moving box collider for the physics, so bodies and props never pass through one.
// Car frame: +x forward, +y up, +z to the driver's right.
// ============================================================================
const TR = {
  lanes: [{ dir: 1, z: -38.45, park: -35.75 }, { dir: -1, z: -41.85, park: -44.85 }],  // eastbound (park side), westbound
  kerb0: -46.0, kerb1: -34.6, center: -40.15,
  y: -0.125,                      // the road surface (PG_ST.roadY): 12.5 cm below the sidewalks
  cross: { x0: -2.4, x1: 2.8 },
  end: 165
};
const CAR_MODELS = {
  sedan: { L: 4.72, W: 1.82, wb: 2.78, wr: 0.33, clr: 0.17, belt: 0.95, roof: 1.44, c0: -1.12, c1: 0.96, rr: 0.62, fr: 0.74, nose: 0.66, tail: 0.92, w: 3.2 },
  hatch: { L: 4.08, W: 1.77, wb: 2.56, wr: 0.31, clr: 0.16, belt: 0.93, roof: 1.47, c0: -1.9, c1: 0.62, rr: 0.2, fr: 0.72, nose: 0.66, tail: 0.98, hatch: true, w: 2.6 },
  suv: { L: 4.78, W: 1.9, wb: 2.84, wr: 0.37, clr: 0.23, belt: 1.08, roof: 1.76, c0: -2.12, c1: 0.86, rr: 0.14, fr: 0.64, nose: 0.86, tail: 1.08, hatch: true, rails: true, w: 2.4 },
  pickup: { L: 5.45, W: 1.98, wb: 3.36, wr: 0.39, clr: 0.25, belt: 1.13, roof: 1.87, c0: -0.62, c1: 1.18, rr: 0.1, fr: 0.64, nose: 0.94, tail: 1.13, bed: true, w: 1.5 },
  van: { L: 5.12, W: 1.96, wb: 3.06, wr: 0.34, clr: 0.18, belt: 1.05, roof: 1.88, c0: -2.44, c1: 1.42, rr: 0.08, fr: 0.98, nose: 0.82, tail: 1.1, hatch: true, w: 1.4 },
  taxi: { L: 4.72, W: 1.82, wb: 2.78, wr: 0.33, clr: 0.17, belt: 0.95, roof: 1.44, c0: -1.12, c1: 0.96, rr: 0.62, fr: 0.74, nose: 0.66, tail: 0.92, sign: true, w: 0.45 }
};
const CAR_PAINTS = [0xf2f2f0, 0xc9cbcd, 0x8a8e93, 0x3b3e43, 0x111214, 0x7a1418, 0xb32422, 0x1d3a6b, 0x2d5d9a, 0x23442e, 0x5b6b3a, 0xc6b79a, 0x6e4b2e, 0x9aa5ad, 0xf2f2f0, 0x4a2a5e, 0x8a8e93, 0x111214, 0x0f5c6e, 0xd06a1a];
const _trF = new THREE.Frustum(), _trS = new THREE.Sphere();
const _tv1 = new V3(), _tv2 = new V3(), _tv3 = new V3(), _tq1 = new THREE.Quaternion(), _tq2 = new THREE.Quaternion(), _tm1 = new THREE.Matrix4(), _tm2 = new THREE.Matrix4(), _tE = new THREE.Euler(), _tS = new V3(1, 1, 1), _tC = new THREE.Color();

class TrafficSystem {
  constructor(game, env, opts = {}) {
    this.game = game; this.env = env; this.group = env.group;
    this.cars = []; this.movers = []; this.skidN = 0; this.time = 0; this.seq = 0;
    this.maxCars = 30;
    this.driveways = opts.driveways || [];
    this.buildModels();
    this.buildShared();
    this.modelList = Object.values(this.models);
    this.slots = [];
    for (let li = 0; li < 2; li++) {
      const L = TR.lanes[li];
      for (let x = -96; x <= 96; x += 6.4) {
        if (x > -10 && x < 10) continue;                                        // the crosswalk and the hydrant
        if (li === 1 && this.driveways.some(([a, b]) => x > a - 3.2 && x < b + 3.2)) continue;   // never across a driveway
        this.slots.push({ li, x: x + (li ? 0.7 : -0.4), z: L.park, car: null });
      }
    }
    const rr = new RNG(1515);
    for (const s of this.slots) if (rr.next() < 0.55) this.spawnParked(s, rr);
    // a few cars already on the road
    for (let li = 0; li < 2; li++) for (let k = 0; k < 3; k++) this.spawnMoving(li, (-120 + k * 85 + rr.range(-12, 12)) * TR.lanes[li].dir, rr);
    this.spawnT = [2, 5];
  }
  // ----------------------------------------------------------------- models ---
  buildModels() {
    this.models = {};
    for (const key of Object.keys(CAR_MODELS)) {
      const M = CAR_MODELS[key], paint = new PGBatch(), trim = new PGBatch(), glass = new PGBatch();
      const W = M.W, h = M.L / 2, bt = 0.07;
      const col = (c) => _tC.set(c);
      // lower body: the side profile with wheel arches, extruded across the width with rounded edges
      const s = new THREE.Shape(), aR = M.wr + 0.065, xf = M.wb / 2, xr = -M.wb / 2;
      s.moveTo(-h + 0.12, M.clr + 0.05);
      s.lineTo(xr - aR, M.clr); s.lineTo(xr - aR, M.wr); s.absarc(xr, M.wr, aR, Math.PI, 0, true); s.lineTo(xr + aR, M.clr);
      s.lineTo(xf - aR, M.clr); s.lineTo(xf - aR, M.wr); s.absarc(xf, M.wr, aR, Math.PI, 0, true); s.lineTo(xf + aR, M.clr);
      s.lineTo(h - 0.12, M.clr + 0.06);
      s.quadraticCurveTo(h + 0.02, M.clr + 0.1, h, M.nose * 0.72);
      s.quadraticCurveTo(h - 0.01, M.nose, h - 0.16, M.nose + 0.035);
      s.quadraticCurveTo((h + M.c1) / 2, M.belt - 0.03, M.c1, M.belt);
      s.lineTo(M.c0, M.belt);
      if (M.hatch) s.quadraticCurveTo(-h + 0.02, M.belt - 0.01, -h, M.belt - 0.12);
      else { s.lineTo(-h + 0.38, M.tail); s.quadraticCurveTo(-h + 0.02, M.tail, -h, M.tail - 0.14); }
      s.lineTo(-h, M.clr + 0.28);
      s.quadraticCurveTo(-h, M.clr + 0.06, -h + 0.12, M.clr + 0.05);
      const body = new THREE.ExtrudeGeometry(s, { depth: W - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: 0.045, bevelSegments: 3, curveSegments: 10 });
      body.translate(0, 0, -(W - 2 * bt) / 2);
      paint.push(body, _tm1.identity(), col(0xffffff));
      // the cabin: glass all round, with a painted roof and pillars
      const cs = new THREE.Shape(), r0 = M.c0 + M.rr, f0 = M.c1 - M.fr;
      cs.moveTo(M.c0, M.belt - 0.03); cs.lineTo(r0, M.roof - 0.06);
      cs.quadraticCurveTo(r0 + 0.04, M.roof, r0 + 0.16, M.roof); cs.lineTo(f0 - 0.14, M.roof);
      cs.quadraticCurveTo(f0 + 0.02, M.roof, f0 + 0.06, M.roof - 0.05); cs.lineTo(M.c1, M.belt - 0.03); cs.lineTo(M.c0, M.belt - 0.03);
      const gw = W * 0.84, cab = new THREE.ExtrudeGeometry(cs, { depth: gw - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2, curveSegments: 6 });
      cab.translate(0, 0, -(gw - 0.08) / 2);
      glass.push(cab, _tm1.identity(), col(0xffffff));
      const bx = (B, x0, y0, z0, x1, y1, z1, c) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); _tm1.makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); B.push(g, _tm1, col(c)); };
      const rod = (B, a, b, w, d, c) => { _tv1.subVectors(b, a); const len = _tv1.length(); const g = new THREE.BoxGeometry(w, len, d); _tq1.setFromUnitVectors(UP, _tv1.normalize()); _tm1.compose(_tv2.addVectors(a, b).multiplyScalar(0.5), _tq1, _tS); B.push(g, _tm1, col(c)); };
      bx(paint, r0 + 0.02, M.roof - 0.045, -gw / 2 - 0.005, f0 - 0.02, M.roof + 0.012, gw / 2 + 0.005, 0xffffff);   // roof panel
      for (const sz of [-1, 1]) {
        const zz = sz * (gw / 2 - 0.012);
        rod(paint, new V3(M.c1, M.belt, zz), new V3(f0 + 0.02, M.roof - 0.02, zz), 0.075, 0.05, 0xffffff);          // A-pillars
        rod(paint, new V3(M.c0, M.belt, zz), new V3(r0 - 0.01, M.roof - 0.02, zz), M.hatch ? 0.16 : 0.12, 0.05, 0xffffff);  // C-pillars
        const xb = (r0 + f0) / 2 + (M.hatch ? 0.25 : 0.05);
        rod(trim, new V3(xb, M.belt, zz), new V3(xb - 0.03, M.roof - 0.03, zz), 0.075, 0.055, 0x15171a);         // B-pillars (black)
        if (M.hatch && M.L > 4.5) { const xd = (M.c0 + xb) / 2 - 0.1; rod(trim, new V3(xd, M.belt, zz), new V3(xd - 0.02, M.roof - 0.03, zz), 0.06, 0.055, 0x15171a); }
        bx(trim, M.c0 + 0.02, M.belt - 0.035, zz - 0.012 * sz - 0.012, M.c1 - 0.02, M.belt - 0.005, zz - 0.012 * sz + 0.012, 0x101113);   // window sill trim
        // mirrors, door handles
        bx(trim, M.c1 - 0.2, M.belt + 0.06, sz > 0 ? W / 2 - 0.02 : -W / 2 - 0.13, M.c1 - 0.06, M.belt + 0.17, sz > 0 ? W / 2 + 0.13 : -W / 2 + 0.02, 0x1a1c1f);
        for (const xh of [M.c1 - 0.62, (M.c0 + M.c1) / 2 - 0.2]) bx(trim, xh - 0.09, M.belt - 0.13, sz * W / 2 - 0.012, xh + 0.09, M.belt - 0.1, sz * W / 2 + 0.012, 0xb8bcc2);
      }
      // bumpers, grille, number plates, lights' housings, wheel-arch liners
      bx(trim, h - 0.07, M.clr - 0.01, -W / 2 * 0.97, h + 0.035, M.clr + 0.2, W / 2 * 0.97, 0x2a2c30);
      bx(trim, -h - 0.035, M.clr - 0.01, -W / 2 * 0.97, -h + 0.07, M.clr + 0.22, W / 2 * 0.97, 0x2a2c30);
      bx(trim, h - 0.03, M.clr + 0.26, -W * 0.27, h + 0.012, M.nose - 0.04, W * 0.27, 0x0e0f11);
      bx(trim, h + 0.03, M.clr + 0.06, -0.26, h + 0.045, M.clr + 0.18, 0.26, 0xeeeeea);
      bx(trim, -h - 0.045, M.clr + 0.12, -0.26, -h - 0.03, M.clr + 0.24, 0.26, 0xeeeeea);
      for (const [x, y, nx] of [[h - 0.03, M.nose - 0.09, 1], [-h + 0.02, (M.hatch ? M.belt : M.tail) - 0.14, -1]]) for (const sz of [-1, 1]) bx(trim, x - 0.03, y - 0.06, sz * W * 0.36 - 0.17, x + 0.025, y + 0.06, sz * W * 0.36 + 0.17, nx > 0 ? 0xd8dde2 : 0x5a0c0c);
      for (const xa of [xf, xr]) for (const sz of [-1, 1]) { const g = new THREE.CylinderGeometry(aR - 0.01, aR - 0.01, 0.3, 14, 1, true, -Math.PI / 2, Math.PI); g.rotateX(Math.PI / 2); _tm1.makeTranslation(xa, M.wr, sz * (W / 2 - 0.17)); trim.push(g, _tm1, col(0x0c0d0e)); }
      if (M.bed) { // the open load bed of a pickup
        bx(trim, -h + 0.12, M.belt - 0.03, -W / 2 + 0.12, M.c0 - 0.1, M.belt + 0.004, W / 2 - 0.12, 0x1b1c1e);
        bx(paint, M.c0 - 0.1, M.belt, -W / 2 + 0.05, M.c0 - 0.02, M.belt + 0.12, W / 2 - 0.05, 0xffffff);
      }
      if (M.rails) for (const sz of [-1, 1]) bx(trim, r0 + 0.1, M.roof + 0.012, sz * gw * 0.42 - 0.025, f0 - 0.15, M.roof + 0.05, sz * gw * 0.42 + 0.025, 0x1d1f22);
      if (M.sign) { bx(trim, -0.35, M.roof + 0.01, -0.16, 0.25, M.roof + 0.2, 0.16, 0xffd23a); }
      // lights (quads drawn by the shared light mesh): [x, y, z, facing, kind]
      M.lights = [];
      for (const sz of [-1, 1]) {
        M.lights.push([h + 0.012, M.nose - 0.09, sz * W * 0.36, 1, 'head', 0.3, 0.1]);
        M.lights.push([-h - 0.002, (M.hatch ? M.belt : M.tail) - 0.14, sz * W * 0.36, -1, 'tail', 0.3, 0.11]);
        M.lights.push([h + 0.01, M.nose - 0.2, sz * W * 0.44, 1, 'ind' + (sz > 0 ? 'R' : 'L'), 0.08, 0.05]);
        M.lights.push([-h - 0.003, (M.hatch ? M.belt : M.tail) - 0.27, sz * W * 0.4, -1, 'ind' + (sz > 0 ? 'R' : 'L'), 0.1, 0.05]);
      }
      if (M.sign) M.lights.push([0.252, M.roof + 0.11, 0, 1, 'sign', 0.26, 0.12], [-0.352, M.roof + 0.11, 0, -1, 'sign', 0.26, 0.12]);
      M.key = key;
      M.wheels = [[xf, M.wr, -(W / 2 - 0.13)], [xf, M.wr, W / 2 - 0.13], [xr, M.wr, -(W / 2 - 0.13)], [xr, M.wr, W / 2 - 0.13]];
      M.geo = { paint: paint.geometry(), trim: trim.geometry(), glass: glass.geometry() };
      this.models[key] = M;
    }
  }
  buildShared() {
    const cap = this.maxCars, g = this.group;
    this.paintMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.45, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.0 });
    this.trimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.2, roughness: 0.55, envMapIntensity: 0.7 });
    this.glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1a2128, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4 });
    for (const M of Object.values(this.models)) {
      M.inst = {};
      for (const part of ['paint', 'trim', 'glass']) {
        const im = new THREE.InstancedMesh(M.geo[part], part === 'paint' ? this.paintMat : part === 'trim' ? this.trimMat : this.glassMat, cap);
        im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.name = 'car-' + M.key + '-' + part;
        if (part === 'paint') im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
        g.add(im); M.inst[part] = im;
      }
      M.used = [];
    }
    // wheels: tyre (rounded profile, sidewall lettering ring) and a five-spoke rim
    const wparts = new PGBatch();
    const prof = []; const tr = 0.33, tw = 0.115;
    for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + Math.PI * k / 5; prof.push(new THREE.Vector2(tr - 0.055 + Math.cos(a) * 0.055, Math.sin(a) * tw)); }
    prof.unshift(new THREE.Vector2(0.21, -tw)); prof.push(new THREE.Vector2(0.21, tw));
    const tyre = new THREE.LatheGeometry(prof, 18); tyre.rotateX(Math.PI / 2);
    wparts.push(tyre, _tm1.identity(), _tC.set(0x141516));
    const rim = new THREE.CylinderGeometry(0.215, 0.215, 0.2, 14); rim.rotateX(Math.PI / 2); wparts.push(rim, _tm1.identity(), _tC.set(0x6c7076));
    for (let k = 0; k < 5; k++) { const sp = new THREE.BoxGeometry(0.035, 0.19, 0.03); sp.translate(0, 0.1, 0.105); sp.rotateZ(k / 5 * TAU); wparts.push(sp, _tm1.identity(), _tC.set(0xb7bcc2)); }
    const hub = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8); hub.rotateX(Math.PI / 2); hub.translate(0, 0, 0.11); wparts.push(hub, _tm1.identity(), _tC.set(0xc7ccd2));
    this.wheelMesh = new THREE.InstancedMesh(wparts.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4, envMapIntensity: 0.6 }), cap * 4);
    this.wheelMesh.count = 0; this.wheelMesh.castShadow = false; this.wheelMesh.frustumCulled = false; g.add(this.wheelMesh);
    // lights: emissive quads, and pools of headlight on the road
    const lq = new THREE.PlaneGeometry(1, 1); lq.rotateY(Math.PI / 2);
    this.lightMesh = new THREE.InstancedMesh(lq, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), cap * 10);
    this.lightMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 10 * 3), 3);
    this.lightMesh.count = 0; this.lightMesh.frustumCulled = false; g.add(this.lightMesh);
    const poolTex = Tex.make('carPool', 128, 128, (g2, w, h) => { const gr = g2.createRadialGradient(w * 0.5, h * 0.62, 2, w * 0.5, h * 0.62, w * 0.5); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h); });
    const pq = new THREE.PlaneGeometry(1, 1); pq.rotateX(-Math.PI / 2);
    this.poolMesh = new THREE.InstancedMesh(pq, new THREE.MeshBasicMaterial({ map: poolTex, color: 0xfff1d6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }), cap);
    this.poolMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.poolMesh.count = 0; this.poolMesh.frustumCulled = false; this.poolMesh.renderOrder = 2; g.add(this.poolMesh);
    // damage marks on cars (scrape and dent, a cracked windscreen, bullet holes)
    const dTex = Tex.make('carDamage', 256, 128, (g2, w, h) => {
      g2.clearRect(0, 0, w, h);
      const r = new RNG(3);
      // 0: scrapes and a dented patch
      for (let i = 0; i < 60; i++) { g2.strokeStyle = `rgba(${150 + r.next() * 60},${150 + r.next() * 60},${150 + r.next() * 60},${0.25 + r.next() * 0.4})`; g2.lineWidth = 0.5 + r.next() * 1.5; g2.beginPath(); const x = 10 + r.next() * 100, y = 20 + r.next() * 90; g2.moveTo(x, y); g2.lineTo(x + 10 + r.next() * 30, y + (r.next() - 0.5) * 8); g2.stroke(); }
      const gr = g2.createRadialGradient(64, 64, 4, 64, 64, 56); gr.addColorStop(0, 'rgba(10,10,12,0.45)'); gr.addColorStop(0.6, 'rgba(10,10,12,0.18)'); gr.addColorStop(1, 'rgba(10,10,12,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
      // 1: a crack web in glass
      g2.strokeStyle = 'rgba(230,236,240,0.85)'; g2.lineWidth = 1;
      for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + r.next() * 0.3; let x = 192, y = 64; g2.beginPath(); g2.moveTo(x, y); for (let s2 = 0; s2 < 5; s2++) { x += Math.cos(a + (r.next() - 0.5) * 0.6) * (8 + r.next() * 6); y += Math.sin(a + (r.next() - 0.5) * 0.6) * (8 + r.next() * 6); g2.lineTo(x, y); } g2.stroke(); }
      for (let ring = 1; ring <= 3; ring++) { g2.beginPath(); for (let k = 0; k <= 16; k++) { const a = k / 16 * TAU, rr2 = ring * 13 + r.next() * 5; g2.lineTo(192 + Math.cos(a) * rr2, 64 + Math.sin(a) * rr2); } g2.stroke(); }
    });
    const dq = new THREE.PlaneGeometry(1, 1);
    this.dmgMesh = new THREE.InstancedMesh(dq, new THREE.MeshStandardMaterial({ map: dTex, transparent: true, depthWrite: false, roughness: 0.5, metalness: 0.3, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), cap * 6);
    this.dmgMesh.count = 0; this.dmgMesh.frustumCulled = false; g.add(this.dmgMesh);
    this.dmgMesh.geometry.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(cap * 6), 1));
    this.dmgMesh.material.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTile;').replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * vec2(0.5, 1.0) + vec2(aTile * 0.5, 0.0);\n#endif');
    };
    this.dmgMesh.material.customProgramCacheKey = () => 'ht3d-cardmg';
    // skid marks left on the road by hard braking
    const sq = new THREE.PlaneGeometry(1, 1); sq.rotateX(-Math.PI / 2);
    const sTex = Tex.make('skid', 64, 64, (g2, w, h) => { const gr = g2.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.25, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g2.fillStyle = 'rgba(0,0,0,0.3)'; g2.fillRect(Math.random() * w, 0, 1, h); } });
    this.skidMesh = new THREE.InstancedMesh(sq, new THREE.MeshBasicMaterial({ map: sTex, color: 0x0b0b0c, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), 360);
    this.skidMesh.count = 0; this.skidMesh.frustumCulled = false; this.skidMesh.renderOrder = 1; g.add(this.skidMesh);
  }
  // ----------------------------------------------------------------- cars ---
  pickModel(rr) {
    const keys = Object.keys(CAR_MODELS), tot = keys.reduce((a, k) => a + CAR_MODELS[k].w, 0);
    let x = (rr ? rr.next() : Math.random()) * tot;
    for (const k of keys) { x -= CAR_MODELS[k].w; if (x <= 0) return k; }
    return 'sedan';
  }
  makeCar(key, li, x, z, rr) {
    if (this.cars.length >= this.maxCars) return null;
    const M = this.models[key], rnd = () => (rr ? rr.next() : Math.random());
    const paint = key === 'taxi' ? 0xf2c21a : CAR_PAINTS[Math.floor(rnd() * CAR_PAINTS.length)];
    const c = {
      id: ++this.seq, key, M, li, dir: TR.lanes[li].dir, x, z, zT: z, v: 0, a: 0, mode: 'drive',
      v0: 8.5 + rnd() * 5.5, aMax: 1.3 + rnd() * 0.9, bComf: 2.4 + rnd() * 0.9, T: 1.0 + rnd() * 0.6, s0: 2.0 + rnd() * 0.8,
      yaw: 0, vz: 0, steer: 0, spin: rnd() * TAU, pitch: 0, pv: 0, roll: 0, rv: 0, heave: 0, hv: 0,
      head: 0, brake: 0, ind: 0, hazard: false, blockT: 0, hornT: 0, overtake: null, damage: [], dmgK: 0, hitT: -99, stopT: 0,
      paint: new THREE.Color(paint), slot: null, wantsPark: rnd() < 0.12, rpm: 800, mover: { min: new V3(), max: new V3(), boxes: [{ min: new V3(), max: new V3(), on: true }, { min: new V3(), max: new V3(), on: true }] }
    };
    c.inst = M.used.length; M.used.push(c);
    for (const part of ['paint', 'trim', 'glass']) M.inst[part].count = M.used.length;
    M.inst.paint.instanceColor.setXYZ(c.inst, c.paint.r, c.paint.g, c.paint.b); M.inst.paint.instanceColor.needsUpdate = true;
    this.cars.push(c); this.movers.push(c.mover);
    this.placeCar(c);
    return c;
  }
  spawnParked(slot, rr) {
    const c = this.makeCar(this.pickModel(rr), slot.li, slot.x, slot.z, rr);
    if (!c) return null;
    c.mode = 'parked'; c.slot = slot; slot.car = c; c.parkT = 20 + (rr ? rr.next() : Math.random()) * 140;
    return c;
  }
  spawnMoving(li, x, rr) {
    const L = TR.lanes[li], c = this.makeCar(this.pickModel(rr), li, x, L.z, rr);
    if (c) c.v = c.v0 * 0.85;
    return c;
  }
  removeCar(c) {
    const M = c.M, last = M.used[M.used.length - 1];
    if (last !== c) { last.inst = c.inst; M.used[c.inst] = last; M.inst.paint.instanceColor.setXYZ(last.inst, last.paint.r, last.paint.g, last.paint.b); M.inst.paint.instanceColor.needsUpdate = true; this.placeCar(last); }
    M.used.pop();
    for (const part of ['paint', 'trim', 'glass']) M.inst[part].count = M.used.length;
    this.cars.splice(this.cars.indexOf(c), 1); this.movers.splice(this.movers.indexOf(c.mover), 1);
    if (c.slot) c.slot.car = null;
  }
  // world matrix of a car (heading, pitch from braking/accelerating, roll, heave)
  carMatrix(c, out) {
    _tE.set(c.roll, (c.dir > 0 ? 0 : Math.PI) + c.yaw, c.pitch, 'YZX');
    _tq1.setFromEuler(_tE);
    return out.compose(_tv1.set(c.x, TR.y + c.heave, c.z), _tq1, _tS);
  }
  placeCar(c) {
    const M = c.M;
    // collision boxes (world AABBs of the lower body and the cabin)
    const cy = Math.cos(c.yaw) * c.dir, sy = Math.sin(c.yaw) * c.dir;
    const box = (b, x0, y0, x1, y1, hw) => {
      const ex = Math.abs(cy) * (x1 - x0) / 2 + Math.abs(sy) * hw, ez = Math.abs(sy) * (x1 - x0) / 2 + Math.abs(cy) * hw, cx = c.x + cy * (x0 + x1) / 2, cz = c.z - sy * (x0 + x1) / 2;
      b.min.set(cx - ex, TR.y + y0 + c.heave, cz - ez); b.max.set(cx + ex, TR.y + y1 + c.heave, cz + ez);
    };
    box(c.mover.boxes[0], -M.L / 2, M.clr, M.L / 2, M.belt, M.W / 2);
    box(c.mover.boxes[1], M.c0, M.belt, M.c1, M.roof + 0.02, M.W * 0.42);
    c.mover.min.copy(c.mover.boxes[0].min).min(c.mover.boxes[1].min); c.mover.max.copy(c.mover.boxes[0].max).max(c.mover.boxes[1].max);
  }
  // ----------------------------------------------------------------- driving ---
  laneCarsAhead(c, zc, wHalf) {
    let best = null, bg = 1e9;
    for (const o of this.cars) {
      if (o === c || Math.abs(o.z - zc) > (o.M.W / 2 + wHalf + 0.15)) continue;
      const dx = (o.x - c.x) * c.dir; if (dx <= 0) continue;
      const gap = dx - (o.M.L + c.M.L) / 2;
      if (gap < bg) { bg = gap; best = o; }
    }
    return { car: best, gap: bg };
  }
  // anything in the corridor ahead: people (standing or down), props, the player
  obstacleAhead(c, zc, range) {
    const g = this.game, front = c.x + c.dir * c.M.L / 2, hw = c.M.W / 2 + 0.5;
    let bg = 1e9, who = null, person = false;
    const test = (x, y, z, r, o, isPerson) => {
      if (y > TR.y + 2.6 || Math.abs(z - zc) > hw + r) return;
      const d = (x - front) * c.dir - r;
      if (d < -c.M.L || d > range) return;
      if (d < bg) { bg = d; who = o; person = isPerson; }
    };
    for (const n of g.npcs.list) {
      if (n.removed) continue;
      if (n.physMode === 'ragdoll') { for (const bi of [RAG.PELVIS, RAG.CHEST, RAG.HEAD, RAG.SHIN_L, RAG.SHIN_R]) { const b = n.rag.bodies[bi]; if (!n.rag.detached[bi]) test(b.pos.x, b.pos.y, b.pos.z, 0.2, n, false); } }
      else test(n.root.pos.x, n.root.pos.y, n.root.pos.z, 0.3, n, true);
    }
    for (const p of g.props.list) { const b = p.body; if (b) test(b.pos.x, b.pos.y - p.radius, b.pos.z, p.radius, p, false); }
    const cam = g.camera.position;
    if (cam.y < TR.y + 2.4 && cam.z < TR.kerb1 + 0.5 && cam.z > TR.kerb0 - 0.5) test(cam.x, cam.y - 1.6, cam.z, 0.35, 'player', true);
    return { gap: bg - 1.1, who, person };
  }
  // someone on the crosswalk, or waiting right at its kerb to cross
  crosswalkBusy() {
    if (this._cwT === this.time) return this._cw;
    this._cwT = this.time; this._cw = false;
    for (const n of this.game.npcs.list) {
      if (n.removed || !n.active || n.physMode !== 'anim') continue;
      const p = n.root.pos;
      if (p.x < TR.cross.x0 - 0.3 || p.x > TR.cross.x1 + 0.3) continue;
      if ((p.z > TR.kerb0 && p.z < TR.kerb1) || (n._wantsCross && n._wantsCross > this.game.time - 0.6 && p.z > TR.kerb0 - 1.6 && p.z < TR.kerb1 + 1.6)) { this._cw = true; break; }
    }
    return this._cw;
  }
  idm(c, gap, dv) {
    const v = c.v, sStar = c.s0 + Math.max(0, v * c.T + v * dv / (2 * Math.sqrt(c.aMax * c.bComf)));
    const free = c.aMax * (1 - Math.pow(v / Math.max(0.1, c.v0Now || c.v0), 4));
    if (gap > 900) return free;
    return free - c.aMax * Math.pow(sStar / Math.max(0.05, gap), 2);
  }
  clearBehind(c, d) {
    for (const o of this.cars) { if (o === c || Math.abs(o.z - c.z) > (o.M.W + c.M.W) / 2) continue; const rel = (c.x - o.x) * c.dir - (o.M.L + c.M.L) / 2; if (rel > -0.5 && rel < d) return false; }
    const back = c.x - c.dir * c.M.L / 2;
    for (const n of this.game.npcs.list) { if (n.removed) continue; const p = n.root.pos, rel = (back - p.x) * c.dir; if (rel > -0.3 && rel < d + 0.5 && Math.abs(p.z - c.z) < c.M.W / 2 + 0.5) return false; }
    const cam = this.game.camera.position, rel = (back - cam.x) * c.dir;
    if (rel > -0.3 && rel < d + 0.5 && Math.abs(cam.z - c.z) < c.M.W / 2 + 0.6 && cam.y < TR.y + 2.4) return false;
    return true;
  }
  oppositeClear(c, from, to) { // the other lane free between x=from and x=to (in c's direction), oncoming cars counted by their reach
    const oz = TR.lanes[1 - c.li].z;
    for (const o of this.cars) {
      if (o === c || Math.abs(o.z - oz) > 2.2 || o.mode === 'parked') continue;
      const rel = (o.x - c.x) * c.dir, reach = o.dir === c.dir ? 0 : o.v * 4.5;
      if (rel > from - reach - o.M.L && rel < to + reach + o.M.L) return false;
    }
    return true;
  }
  update(dt) {
    this.time += dt;
    const g = this.game;
    // new cars come in at the ends of each lane, now and then
    for (let li = 0; li < 2; li++) {
      this.spawnT[li] -= dt;
      if (this.spawnT[li] > 0) continue;
      this.spawnT[li] = 3 + Math.random() * 9;
      const L = TR.lanes[li], x0 = -L.dir * TR.end;
      let moving = 0, clear = true;
      for (const o of this.cars) { if (o.li === li && o.mode !== 'parked') moving++; if (Math.abs(o.x - x0) < 30 && Math.abs(o.z - L.z) < 2) clear = false; }
      if (clear && moving < 6) this.spawnMoving(li, x0);
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      try { this.drive(c, dt); } catch (e) { reportError(e, 'traffic'); }
      if ((c.mode !== 'parked' && c.x * c.dir > TR.end + 5) || c.tow) { this.removeCar(c); continue; }
    }
    // parked cars pull out now and then (when nobody watches them closely)
    this.departT = (this.departT == null ? 25 : this.departT) - dt;
    if (this.departT <= 0) {
      this.departT = 20 + Math.random() * 40;
      const parked = this.cars.filter(o => o.mode === 'parked' && !o.dmgK && this.time > (o.parkT || 0));
      if (parked.length) { const c = parked[Math.floor(Math.random() * parked.length)]; c.mode = 'depart'; c.departT = 0; }
    }
    this.collide(dt);
  }
  drive(c, dt) {
    const g = this.game, L = TR.lanes[c.li], M = c.M;
    if (c.mode === 'parked') { c.v = 0; c.a = 0; c.head = 0; c.brake = 0; c.ind = 0; this.settle(c, dt); this.placeCar(c); return; }
    let aTarget = 0, wantStop = false;
    c.v0Now = c.v0 * (c.mode === 'disabled' ? 0 : 1) * (this.env.rainK > 0.4 ? 0.85 : 1);
    if (c.mode === 'parking') c.v0Now = Math.min(c.v0Now, (c.parkSlot.x - c.x) * c.dir < 30 ? 4.2 : 7);
    if (c.mode === 'depart') {
      // indicator toward the lane, wait for a gap behind, then pull out
      c.ind = -1; c.departT += dt;
      const clearBehind = !this.cars.some(o => o !== c && o.li === c.li && o.mode !== 'parked' && Math.abs(o.z - L.z) < 2 && (c.x - o.x) * c.dir > -6 && (c.x - o.x) * c.dir < 26 + o.v * 2);
      const roomAhead = !this.cars.some(o => o !== c && Math.abs(o.z - c.z) < 1.6 && (o.x - c.x) * c.dir > 0 && (o.x - c.x) * c.dir < 9.5);
      if (!roomAhead && c.departT > 8) { c.mode = 'parked'; c.ind = 0; c.parkT = this.time + 30 + Math.random() * 60; }
      else if (c.departT > 1.6 && clearBehind && roomAhead) { c.mode = 'drive'; c.zT = L.z; c.v0Park = 0; if (c.slot) { c.slot.car = null; c.slot = null; } }
      else { this.settle(c, dt); this.placeCar(c); return; }
    }
    // the corridor: where the car is, plus where it is steering to
    const zc = c.z;
    const lead = this.laneCarsAhead(c, zc, M.W / 2);
    const range = c.v * c.v / (2 * c.bComf) + 22;
    const obs = this.obstacleAhead(c, zc, range);
    let gap = lead.gap, dv = lead.car ? c.v - lead.car.v * (lead.car.dir === c.dir ? 1 : -1) : 0;
    if (obs.gap < gap) { gap = obs.gap; dv = c.v; }
    // give way at the crosswalk (if it can still stop comfortably there)
    const stopX = c.dir > 0 ? TR.cross.x0 - 2.2 : TR.cross.x1 + 2.2, front = c.x + c.dir * M.L / 2, toLine = (stopX - front) * c.dir;
    if (toLine > -0.5 && toLine < 45 && this.crosswalkBusy() && (c.yielding || toLine > c.v * c.v / (2 * 3.2) - 1)) { c.yielding = true; if (toLine < gap) { gap = Math.max(0.05, toLine); dv = c.v; } }
    else c.yielding = false;
    // parking: slow to the space and slide into it
    if (c.mode === 'drive' && c.wantsPark && !c.parkSlot && Math.abs(c.x) < 110) {
      const s = this.slots.find(q => q.li === c.li && !q.car && (q.x - c.x) * c.dir > 25 && (q.x - c.x) * c.dir < 60 && !this.slots.some(o => o.li === q.li && o.car && Math.abs(o.x - (q.x - 6.4 * c.dir)) < 1));
      if (s) { c.parkSlot = s; s.car = c; c.mode = 'parking'; }
    }
    if (c.mode === 'parking') {
      const s = c.parkSlot, toSlot = (s.x - c.x) * c.dir;
      c.ind = 1;
      if (toSlot < 9) c.zT = s.z;
      const lag = Math.abs(c.z - s.z) > 0.3 ? 1.0 : 0;   // still swinging in: roll a little further
      if (toSlot + lag < gap + 0.1) { gap = Math.max(0.05, toSlot + lag); dv = c.v; }
      if (toSlot < 0.6 && c.v < 0.3 && Math.abs(c.z - s.z) < 0.45) { c.mode = 'parked'; c.slot = s; c.parkSlot = null; c.wantsPark = false; c.ind = 0; c.parkT = this.time + 40 + Math.random() * 120; c.v = 0; c.vz = 0; }
      else if (toSlot < -1.5 || (c.blockT > 6 && toSlot > 1)) { s.car = null; c.parkSlot = null; c.wantsPark = false; c.mode = 'drive'; c.zT = L.z; }
    }
    // after hitting someone, or disabled: hazards on, stay put a while
    if (c.mode === 'stopped' || c.mode === 'disabled') {
      c.hazard = true; wantStop = true;
      c.stopT -= dt;
      if (c.mode === 'stopped' && c.stopT <= 0 && obs.gap > 6) { c.mode = 'drive'; c.hazard = false; c.v0 = Math.min(c.v0, 7); }
      else if (c.mode === 'stopped' && c.stopT < -20) { c.mode = 'drive'; c.hazard = false; c.v0 = Math.min(c.v0, 6); c.blockT = 5; }
      if (c.mode === 'disabled') {
        c.wreckT = (c.wreckT || 0) + dt;
        const cam = g.camera.position;
        if (c.wreckT > 90 && Math.hypot(cam.x - c.x, cam.z - c.z) > 35) c.tow = true;
      }
    }
    let a = this.idm(c, gap, dv);
    if (wantStop) a = Math.min(a, -c.bComf * 1.6);
    // emergency: something right ahead it cannot stop for comfortably
    const need = gap < 900 && c.v > 0.5 ? (c.v * c.v) / (2 * Math.max(0.3, gap)) : 0;
    if (need > c.bComf * 1.4) a = Math.min(a, -Math.min(9, need * 1.2));
    c.emergency = need > 5.5;
    // blocked by someone standing in the road: honk, then go round them when the other side is clear
    const blocked = c.v < 0.4 && gap < 8 && (obs.who || (lead.car && lead.car.v < 0.3)) && c.mode === 'drive';
    c.blockT = blocked ? c.blockT + dt : Math.max(0, c.blockT - dt * 2);
    const onCrossing = obs.who && obs.who !== 'player' && obs.who.root && obs.who.root.pos.x > TR.cross.x0 - 0.6 && obs.who.root.pos.x < TR.cross.x1 + 0.6;
    if (blocked && !c.yielding && !onCrossing && obs.person && obs.who && (obs.who === 'player' || obs.who.lifeState === 'alive' || obs.who.lifeState === 'zombie') && c.blockT > 2 && this.time > c.hornT) {
      c.hornT = this.time + 4 + Math.random() * 4; this.honk(c);
    }
    if (!c.overtake && c.mode === 'drive' && c.blockT > 4.5) {
      const blocker = lead.gap <= obs.gap ? lead.car : null, until = (blocker ? (blocker.x - c.x) * c.dir + blocker.M.L : Math.max(obs.gap, 0) + 4) + 9;
      if (this.oppositeClear(c, -12, until + 20)) {
        c.overtake = { until: c.x + c.dir * until }; c.zT = TR.lanes[1 - c.li].z; c.blockT = 0;
        const room = Math.min(lead.gap, obs.gap);
        if (room < 5.5 && this.clearBehind(c, 2)) c.reverseT = Math.min(2.6, (5.5 - room) / 1.1);
      }
    }
    if (c.reverseT > 0) {
      // backing up (white reversing lights), then the pull-out below takes over
      c.reverseT -= dt;
      if (!this.clearBehind(c, 1.2)) c.reverseT = 0;
      c.v = 0; c.a = 0; c.x -= c.dir * 1.1 * dt; c.spin -= 1.1 / M.wr * dt; c.reversing = c.reverseT > 0;
      c.brake = 0; c.head = (this.env.dayK != null ? this.env.dayK : 1) < 0.55 ? 1 : 0; c.ind = -1;
      if (this.carOverlap(c)) { c.x += c.dir * 1.1 * dt; c.reverseT = 0; }
      this.settle(c, dt); this.placeCar(c);
      return;
    }
    c.reversing = false;
    if (c.overtake) {
      c.ind = -1;
      const done = (c.x - c.overtake.until) * c.dir > 0;
      const ownClear = !this.cars.some(o => o !== c && Math.abs(o.z - L.z) < 2 && Math.abs((o.x - c.x) * c.dir) < (o.M.L + M.L) / 2 + 3);
      if ((done && ownClear) || !this.oppositeClear(c, 0, 25)) { c.overtake = null; c.zT = L.z; }
    } else if (c.mode === 'drive') { c.ind = 0; if (!c.parkSlot) c.zT = L.z; }
    c.a = clamp(a, -9.5, c.aMax);
    c.v = Math.max(0, c.v + c.a * dt);
    if (lead.car && lead.gap < 0.25 && lead.car.dir === c.dir) c.v = Math.min(c.v, lead.car.v);   // never into the car ahead
    const ox = c.x, oz = c.z;
    c.x += c.dir * c.v * dt;
    // steering: ease toward the target lateral position (lane changes, parking)
    const latCap = c.mode === 'parking' || c.mode === 'depart' || c.overtake && c.v < 5 ? 1.6 : 1.1;
    const dz = c.zT - c.z, vzT = clamp(dz * 1.2, -latCap, latCap) * clamp(c.v / 2, 0, 1);
    c.vz = damp(c.vz, vzT, 3, dt);
    c.vz = clamp(c.vz, -0.85 * c.v, 0.85 * c.v);
    c.z += c.vz * dt;
    if (this.carOverlap(c)) { c.x = ox; c.z = oz; c.v = 0; c.vz = 0; c.a = 0; }
    c.yaw = Math.atan2(c.vz * c.dir, Math.max(1, c.v)) * (c.dir > 0 ? -1 : -1);
    c.steer = damp(c.steer, clamp(c.yaw * 3 + (vzT - c.vz) * 0.4, -0.5, 0.5), 6, dt);
    // skid marks under a hard stop
    if (c.a < -5.5 && c.v > 3.5) this.skid(c, dt);
    // lights
    const env = this.env, dark = (env.dayK != null ? env.dayK : 1) < 0.55, gloomy = (env.cloudCover || 0) > 0.8 || (env.rainK || 0) > 0.3;
    c.head = c.mode === 'disabled' ? 0.3 * (Math.random() < 0.95 ? 1 : 0) : (dark || gloomy ? 1 : 0);
    c.brake = c.a < -0.7 || c.v < 0.15 ? 1 : 0;
    // engine: revs rise through each gear and drop at the change
    const gear = Math.min(4, Math.floor(c.v / 4.2)), inGear = (c.v - gear * 4.2) / 4.2;
    c.rpm = damp(c.rpm, 850 + (c.v < 0.3 ? 0 : 900 + inGear * 2200 + Math.max(0, c.a) * 300), 5, dt);
    this.settle(c, dt);
    this.placeCar(c);
  }
  // suspension: dive and squat with the acceleration, roll with the steering, a little road shake
  settle(c, dt) {
    const kp = 38, cp = 6.5;
    const pT = clamp(c.a * 0.006, -0.05, 0.03), rT = clamp(-c.vz * c.v * 0.006, -0.03, 0.03), hT = c.v > 0.5 ? Math.sin(c.x * 1.7 + c.id) * 0.004 * Math.min(1, c.v / 8) + Math.sin(c.x * 0.37 + c.id * 3) * 0.003 : 0;
    c.pv += (kp * (pT - c.pitch) - cp * c.pv) * dt; c.pitch += c.pv * dt;
    c.rv += (kp * (rT - c.roll) - cp * c.rv) * dt; c.roll += c.rv * dt;
    c.hv += (kp * 1.5 * (hT - c.heave) - cp * c.hv) * dt; c.heave += c.hv * dt;
    c.spin += c.v / c.M.wr * dt;
  }
  skid(c, dt) {
    const step = 0.35;
    c.skidAcc = (c.skidAcc || 0) + c.v * dt;
    if (c.skidAcc < step) return;
    c.skidAcc = 0;
    const m = this.carMatrix(c, _tm2);
    for (const w of [c.M.wheels[2], c.M.wheels[3]]) {
      _tv1.set(w[0], 0, w[2]).applyMatrix4(m);
      const i = this.skidN % this.skidMesh.instanceMatrix.count; this.skidN++;
      _tq1.setFromAxisAngle(UP, c.dir > 0 ? 0 : Math.PI);
      _tm1.compose(_tv2.set(_tv1.x, TR.y + 0.012, _tv1.z), _tq1, _tv3.set(0.62, 1, 0.2));
      this.skidMesh.setMatrixAt(i, _tm1);
    }
    this.skidMesh.count = Math.min(this.skidMesh.instanceMatrix.count, this.skidN);
    this.skidMesh.instanceMatrix.needsUpdate = true;
    if (!c.squealT || this.time > c.squealT) { c.squealT = this.time + 1.2; if (this.game.audio) this.game.audio.play('skid', { pos: _tv2.set(c.x, 0.3, c.z), gain: 0.55, ref: 6 }); }
  }
  honk(c) {
    const g = this.game;
    if (g.audio) g.audio.play('horn', { pos: _tv1.set(c.x, 1, c.z), gain: 0.7, ref: 8, rate: 0.92 + (c.id % 5) * 0.04 });
    if (g.ai) g.ai.emit('horn', _tv1.set(c.x, 0.5, c.z), { radius: 18 });
  }
  // ----------------------------------------------------------------- impacts ---
  localOf(c, p, out) { // world -> car frame
    const dx = p.x - c.x, dz = p.z - c.z, h = (c.dir > 0 ? 0 : Math.PI) + c.yaw, co = Math.cos(h), si = Math.sin(h);
    return out.set(dx * co - dz * si, p.y - TR.y, dx * si + dz * co);
  }
  insideCar(c, p, pad) {
    const l = this.localOf(c, p, _tv3), M = c.M;
    return Math.abs(l.x) < M.L / 2 + pad && Math.abs(l.z) < M.W / 2 + pad && l.y > -0.5 && l.y < M.roof + 0.4;
  }
  collide(dt) {
    const g = this.game;
    for (const c of this.cars) {
      this.sweep(c);
      for (const n of g.npcs.list) {
        if (n.removed || n.carried) continue;
        if (n.physMode === 'anim' || n.physMode === 'getup') {
          if (Math.abs(n.root.pos.x - c.x) > c.M.L / 2 + 1 || Math.abs(n.root.pos.z - c.z) > c.M.W / 2 + 1) continue;
          if (!this.insideCar(c, n.root.pos, 0.28)) continue;
          if (c.v > 1.3 && this.time - (n._carHitT || -9) > 1.5) this.hitPerson(c, n);
          else this.pushOut(n.root.pos, 0.3);
        } else if (n.physMode === 'ragdoll' && c.v > 2 && this.time - (n._carHitT || -9) > 1.5) {
          const b = n.rag.bodies[RAG.PELVIS];
          if (this.insideCar(c, b.pos, 0.25)) this.hitBody(c, n);
        }
      }
    }
    // near misses: people on the road jump clear of a car that cannot stop for them
    for (const c of this.cars) {
      if (c.v < 3 || c.mode === 'parked') continue;
      const front = c.x + c.dir * c.M.L / 2, stopD = c.v * c.v / (2 * 7.5);
      for (const n of g.npcs.list) {
        if (n.removed || n.lifeState !== 'alive' || n.physMode !== 'anim' || n.grabbedBy || n.horror && n.horror.kind === 'slasher') continue;
        const d = (n.root.pos.x - front) * c.dir;
        if (d < -0.5 || d > c.v * 1.8 + 3 || Math.abs(n.root.pos.z - c.z) > c.M.W / 2 + 0.45) continue;
        if (stopD < d - 1) continue;   // it will stop in time
        if (this.time - (n._dodgeT || -9) < 2.5) continue;
        n._dodgeT = this.time;
        if (g.ai && g.ai.carDanger) g.ai.carDanger(n, c);
      }
    }
  }
  // a car runs into someone on their feet
  hitPerson(c, n) {
    const g = this.game, v = c.v, M = c.M;
    n._carHitT = this.time;
    const fwd = _tv1.set(c.dir * Math.cos(c.yaw), 0, -c.dir * Math.sin(c.yaw));
    // the driver slams the brakes; the car takes a dent where it struck
    c.mode = 'stopped'; c.stopT = 7 + Math.random() * 6; c.hitT = this.time; c.a = -9;
    const lp = this.localOf(c, n.root.pos, _tv2);
    this.addDamage(c, 0, M.L / 2 + 0.02, Math.min(M.nose, 0.55), clamp(lp.z, -M.W * 0.4, M.W * 0.4), 1, 0.35 + v * 0.03);
    if (v > 8.5) this.addDamage(c, 1, M.c1 - M.fr * 0.45, (M.belt + M.roof) / 2, clamp(lp.z * 0.6, -0.4, 0.4), 2, 0.5);
    c.pv -= v * 0.012; c.hv += v * 0.01;
    if (g.audio) { g.audio.play('carCrash', { pos: n.boneWPos[B.chest].clone(), gain: clamp(0.35 + v * 0.06, 0.4, 1), ref: 6, important: true }); }
    if (g.fx && g.fx.impactDust) g.fx.impactDust(n.boneWPos[B.hips].clone(), fwd.clone().negate(), 'hard', 0.8);
    const sev = clamp((v - 2) / 11, 0, 1);
    if (v <= 3.2) {
      // a slow bump: a stumble, maybe a fall
      if (g.ai) g.ai.onHit(n, { region: REGION.L_THIGH, dir: fwd.clone(), force: 6, threatPos: _tv3.set(c.x, 0, c.z).clone() });
      if (Math.random() < 0.45) { n.goRagdoll('Knocked Over (Car)'); for (const b of n.rag.bodies) b.vel.addScaledVector(fwd, v * 0.8); }
      n.applyHit({ region: REGION.L_THIGH, damage: 4 + v * 2, weapon: 'vehicle', dir: fwd.clone(), force: 3 });
    } else {
      const res = n.applyHit({ region: Math.random() < 0.5 ? REGION.L_THIGH : REGION.R_THIGH, damage: (5 + v * 3.6) / (REGION_DAMAGE_MUL[REGION.L_THIGH] || 1), weapon: 'vehicle', dir: fwd.clone(), force: 6, threatPos: _tv3.set(c.x, 0, c.z).clone() });
      n._carThrowT = this.game.time;   // the landing that follows is part of this hit (see the impact damage)
      if (!res.killed && n.lifeState !== 'dead' && n.lifeState !== 'destroyed') {
        if (n.lifeState !== 'alive' || Math.random() < 0.25 + sev * 0.9) n.knockOut({ cause: 'hit by a car', severity: sev });
        else n.goRagdoll('Hit by a Car');
      } else if (n.physMode !== 'ragdoll') n.goRagdoll('Hit by a Car', true);
      // the throw: legs taken by the bumper, the upper body tips over the bonnet (capped, never a launch)
      this.throwBody(n, fwd, v);
      HT.log('hit', `${n.idStr} ${n.name} was hit by a car at ${(v * 3.6).toFixed(0)} km/h`);
    }
    if (g.ai) g.ai.emit('crash', n.boneWPos[B.chest].clone(), { radius: 30, threatPos: _tv3.set(c.x, 0, c.z).clone() });
    Events.emit('carHit', { car: c, npc: n, speed: v });
  }
  throwBody(n, fwd, v) {
    if (n.physMode !== 'ragdoll') return;
    const k = Math.min(v, 13), R = n.rag.bodies, ph = this.game.physics;
    for (const b of R) {
      if (n.rag.detached[b.index]) continue;
      const lowK = b.index === RAG.SHIN_L || b.index === RAG.SHIN_R || b.index === RAG.FOOT_L || b.index === RAG.FOOT_R ? 0.95 : b.index === RAG.THIGH_L || b.index === RAG.THIGH_R || b.index === RAG.PELVIS ? 0.85 : 0.62;
      b.vel.copy(fwd).multiplyScalar(k * lowK);
      b.vel.y = (b.index === RAG.CHEST || b.index === RAG.HEAD ? 0.2 : 0.1) * k + (k > 8 ? 0.6 : 0);
      b.angVel && b.angVel.set(0, 0, 0);
    }
    const o = R[0].owner; if (o) { o.allowV = k + 3; o.allowT = ph.time; }
    if (n.rag.asleep && ph.wakeOwner) ph.wakeOwner(o);
  }
  // bodies against a moving car's nose, bonnet or windscreen are carried along at its speed and kept
  // out of it here, before the physics step, so the step never has to push them out of a deep overlap
  // (which would throw them); the physics handles what touches a standing car
  sweep(c) {
    if (c.v < 0.4) return;
    const g = this.game, M = c.M, fx = c.dir * Math.cos(c.yaw), fz = -c.dir * Math.sin(c.yaw);
    const h = (c.dir > 0 ? 0 : Math.PI) + c.yaw, co = Math.cos(h), si = Math.sin(h);
    let woke = null;
    const touch = (b, r, owner) => {
      const l = this.localOf(c, b.pos, _tv3);
      if (l.x < -M.L / 2 - r || l.x > M.L / 2 + r || Math.abs(l.z) > M.W / 2 + r || l.y < -0.3 || l.y > M.roof + r) return;
      // which part: the lower body (to the belt) or the cabin; how deep, and the way out
      const inLow = l.y < M.belt + r, inCab = l.y >= M.belt - r && l.x > M.c0 - r && l.x < M.c1 + r && Math.abs(l.z) < M.W * 0.42 + r;
      if (!inLow && !inCab) return;
      const fx0 = inLow ? M.L / 2 : M.c1, top = inLow && !(l.x > M.c0 - r && l.x < M.c1 + r) ? M.belt : M.roof, hz = inLow ? M.W / 2 : M.W * 0.42;
      const pf = fx0 + r - l.x, pt = top + r - l.y, ps = hz + r - Math.abs(l.z);
      if (pf <= 0 || pt <= 0 || ps <= 0) return;
      if (pf < pt && pf < ps) { l.x += pf; const vf = b.vel.x * fx + b.vel.z * fz; if (vf < c.v) { b.vel.x += fx * (c.v - vf); b.vel.z += fz * (c.v - vf); } }
      else if (pt < ps) { l.y += pt; if (b.vel.y < 0) b.vel.y = 0; const vf = b.vel.x * fx + b.vel.z * fz; b.vel.x += fx * (c.v - vf) * 0.08; b.vel.z += fz * (c.v - vf) * 0.08; }
      else { l.z = Math.sign(l.z || 1) * (hz + r); const vf = b.vel.x * fx + b.vel.z * fz; if (vf < c.v) { b.vel.x += fx * (c.v - vf) * 0.15; b.vel.z += fz * (c.v - vf) * 0.15; } }
      const wx = c.x + l.x * co + l.z * si, wz = c.z - l.x * si + l.z * co, wy = l.y + TR.y;
      const dx = wx - b.pos.x, dy = wy - b.pos.y, dz = wz - b.pos.z;
      b.pos.x = wx; b.pos.y = wy; b.pos.z = wz; b.prevPos.x += dx; b.prevPos.y += dy; b.prevPos.z += dz;
      if (owner) woke = owner;
    };
    for (const n of g.npcs.list) {
      if (n.removed || n.physMode !== 'ragdoll' || n.carried) continue;
      const p = n.rag.bodies[RAG.PELVIS].pos;
      if (Math.abs(p.x - c.x) > M.L / 2 + 2 || Math.abs(p.z - c.z) > M.W / 2 + 2) continue;
      woke = null;
      for (const b of n.rag.bodies) if (!n.rag.detached[b.index]) touch(b, b.shape.r || 0.1, b.owner);
      if (woke) { woke.allowV = Math.max(woke.allowV || 0, c.v + 3); woke.allowT = g.physics.time; if (woke.asleep && g.physics.wakeOwner) g.physics.wakeOwner(woke); }
    }
    for (const pr of g.props.list) {
      const b = pr.body; if (!b || Math.abs(b.pos.x - c.x) > M.L / 2 + 1.5 || Math.abs(b.pos.z - c.z) > M.W / 2 + 1.5) continue;
      woke = null; touch(b, pr.radius || 0.3, b.owner);
      if (woke) { woke.allowV = Math.max(woke.allowV || 0, c.v + 3); woke.allowT = g.physics.time; if (woke.asleep && g.physics.wakeOwner) g.physics.wakeOwner(woke); }
    }
  }
  carOverlap(c) {
    for (const o of this.cars) {
      if (o === c) continue;
      if (Math.abs(o.x - c.x) < (o.M.L + c.M.L) / 2 + 0.1 && Math.abs(o.z - c.z) < (o.M.W + c.M.W) / 2 - 0.05) {
        // only if this move made it worse (two cars already touching may still part)
        return (o.x - c.x) * c.dir > 0 || Math.abs(o.z - c.z) < (o.M.W + c.M.W) / 2 - 0.4 && (o.x - c.x) * c.dir > -0.5;
      }
    }
    return false;
  }
  // the player's eye never passes through a car (pushed out to the nearest side)
  pushCamera(p) {
    for (const c of this.cars) {
      if (Math.abs(p.x - c.x) > c.M.L / 2 + 1 || Math.abs(p.z - c.z) > c.M.W / 2 + 1) continue;
      const l = this.localOf(c, p, _tv3), M = c.M, m = 0.32;
      if (l.y - 1.55 > M.roof) continue;   // above it
      const hx = M.L / 2 + m, hz = M.W / 2 + m;
      if (Math.abs(l.x) >= hx || Math.abs(l.z) >= hz) continue;
      if (hx - Math.abs(l.x) < hz - Math.abs(l.z)) l.x = Math.sign(l.x || 1) * hx; else l.z = Math.sign(l.z || 1) * hz;
      const h = (c.dir > 0 ? 0 : Math.PI) + c.yaw, co = Math.cos(h), si = Math.sin(h);
      p.x = c.x + l.x * co + l.z * si; p.z = c.z - l.x * si + l.z * co;
    }
  }
  // a car running into a body already on the ground (it should have stopped): a shove, it stops
  hitBody(c, n) {
    n._carHitT = this.time;
    const fwd = _tv1.set(c.dir, 0, 0);
    c.mode = 'stopped'; c.stopT = 8; c.v = Math.min(c.v, 2);
    for (const b of n.rag.bodies) if (!n.rag.detached[b.index]) b.vel.addScaledVector(fwd, Math.min(c.v + 1, 3));
    if (n.lifeState === 'alive') n.applyHit({ region: REGION.TORSO, damage: 6, weapon: 'vehicle', dir: fwd.clone(), force: 2 });
    if (this.game.audio) this.game.audio.play('thud', { pos: n.rag.bodies[RAG.PELVIS].pos.clone(), gain: 0.6 });
  }
  addDamage(c, kind, x, y, z, nx, size) {
    if (c.damage.length >= 6) c.damage.shift();
    c.damage.push({ kind, x, y, z, nx, size });
    c.dmgK = Math.min(3, c.dmgK + (kind === 2 ? 0.2 : 0.6));
  }
  // bullets: a hole and a spark, the driver puts their foot down (or stops if the car is wrecked)
  raycast(o, d, maxD) {
    let best = null;
    for (const c of this.cars) {
      // slab test in the car frame against the lower body and the cabin
      const lo = this.localOf(c, o, _tv1).clone(), h = (c.dir > 0 ? 0 : Math.PI) + c.yaw, co = Math.cos(h), si = Math.sin(h);
      const ld = _tv2.set(d.x * co - d.z * si, d.y, d.x * si + d.z * co);
      const M = c.M;
      for (const [x0, y0, z0, x1, y1, z1] of [[-M.L / 2, M.clr, -M.W / 2, M.L / 2, M.belt, M.W / 2], [M.c0, M.belt, -M.W * 0.42, M.c1, M.roof, M.W * 0.42]]) {
        let t0 = 0, t1 = best ? best.dist : maxD, ax = -1, sg = 0;
        const lo3 = [lo.x, lo.y, lo.z], ld3 = [ld.x, ld.y, ld.z], mn = [x0, y0, z0], mx = [x1, y1, z1];
        let ok = true;
        for (let k = 0; k < 3; k++) {
          if (Math.abs(ld3[k]) < 1e-9) { if (lo3[k] < mn[k] || lo3[k] > mx[k]) { ok = false; break; } continue; }
          let ta = (mn[k] - lo3[k]) / ld3[k], tb = (mx[k] - lo3[k]) / ld3[k], s = -1;
          if (ta > tb) { const tt = ta; ta = tb; tb = tt; s = 1; }
          if (ta > t0) { t0 = ta; ax = k; sg = s; }
          if (tb < t1) t1 = tb;
          if (t0 > t1) { ok = false; break; }
        }
        if (!ok || ax < 0 || t0 <= 0) continue;
        const ln = [0, 0, 0]; ln[ax] = sg;
        best = { dist: t0, car: c, local: new V3(lo.x + ld.x * t0, lo.y + ld.y * t0, lo.z + ld.z * t0), lnormal: new V3(ln[0], ln[1], ln[2]), glass: y0 >= M.belt - 0.01 };
      }
    }
    if (best) {
      best.point = o.clone().addScaledVector(d, best.dist);
      const c = best.car, h = (c.dir > 0 ? 0 : Math.PI) + c.yaw, co = Math.cos(h), si = Math.sin(h), n = best.lnormal;
      best.normal = new V3(n.x * co + n.z * si, n.y, -n.x * si + n.z * co);
    }
    return best;
  }
  onShot(hit, power) {
    const c = hit.car, l = hit.local, n = hit.lnormal, g = this.game;
    const kind = hit.glass ? 1 : 2;
    this.addDamage(c, kind, l.x + n.x * 0.003, l.y + n.y * 0.003, l.z + n.z * 0.003, n.x !== 0 ? n.x : n.z !== 0 ? (n.z > 0 ? 3 : -3) : 0, hit.glass ? 0.32 : 0.05 * power);
    c.dmgK += 0.1 * power;
    if (g.fx && g.fx.sparks) g.fx.sparks(hit.point, hit.normal, hit.glass ? 4 : 10);
    if (g.audio) g.audio.play(hit.glass ? 'glassHit' : 'clink', { pos: hit.point, gain: 0.7 });
    if (c.mode === 'drive' || c.mode === 'parking') { c.v0 = Math.min(18, c.v0 * 1.35); c.hornT = 0; this.honk(c); }
    if (c.dmgK > 2.4 && c.mode !== 'parked') { c.mode = 'disabled'; c.stopT = 1e9; }
  }
  blast(p, r) {
    for (const c of this.cars) {
      const d = Math.hypot(c.x - p.x, c.z - p.z); if (d > r) continue;
      const k = 1 - d / r;
      c.hv += k * 1.4; c.rv += (c.z > p.z ? 1 : -1) * k * 1.2; c.pv += (c.x > p.x ? -1 : 1) * k * 0.6 * c.dir;
      if (k > 0.35) { this.addDamage(c, 0, (p.x - c.x) * c.dir > 0 ? c.M.L / 2 : -c.M.L / 2, 0.6, 0, 1, 0.8 * k); c.dmgK += k * 1.5; }
      if (c.dmgK > 2.4 && c.mode !== 'parked') { c.mode = 'disabled'; c.stopT = 1e9; }
      else if (c.mode === 'drive') { c.mode = 'stopped'; c.stopT = 4 + k * 6; }
    }
  }
  // people never stand inside a car (parked or moving): out to the nearest side
  pushOut(p, m) {
    for (const c of this.cars) {
      if (Math.abs(p.x - c.x) > c.M.L / 2 + 1.2 || Math.abs(p.z - c.z) > c.M.W / 2 + 1.2) continue;
      const l = this.localOf(c, p, _tv3), hx = c.M.L / 2 + m, hz = c.M.W / 2 + m;
      if (Math.abs(l.x) >= hx || Math.abs(l.z) >= hz || l.y > c.M.roof) continue;
      const px = hx - Math.abs(l.x), pz = hz - Math.abs(l.z);
      if (px < pz) l.x = Math.sign(l.x || 1) * hx; else l.z = Math.sign(l.z || 1) * hz;
      const h = (c.dir > 0 ? 0 : Math.PI) + c.yaw, co = Math.cos(h), si = Math.sin(h);
      p.x = c.x + l.x * co + l.z * si; p.z = c.z - l.x * si + l.z * co;
    }
    return p;
  }
  // steering: walkers bend round cars (moving ones from further away)
  avoid(npc, desired) {
    const p = npc.root.pos;
    for (const c of this.cars) {
      if (Math.abs(p.x - c.x) > c.M.L / 2 + 2 || Math.abs(p.z - c.z) > c.M.W / 2 + 2) continue;
      const l = this.localOf(c, p, _tv3), qx = clamp(l.x, -c.M.L / 2, c.M.L / 2), qz = clamp(l.z, -c.M.W / 2, c.M.W / 2);
      const ex = l.x - qx, ez = l.z - qz, d = Math.hypot(ex, ez), R = c.v > 1 ? 1.3 : 0.75;
      if (d > R || d < 1e-4) continue;
      const k = (R - d) / R * 2.8, h = (c.dir > 0 ? 0 : Math.PI) + c.yaw, co = Math.cos(h), si = Math.sin(h);
      desired.x += (ex * co + ez * si) / d * k; desired.z += (-ex * si + ez * co) / d * k;
    }
  }
  // for walkers: is it safe to step across the lanes at x (between z0 and z1)? cars that are stopping
  // for the crosswalk (or stopped) do not count; the others must be further than the crossing takes
  crossingClear(x, z0, z1, crossT) {
    const zl = Math.min(z0, z1) - 1.8, zh = Math.max(z0, z1) + 1.8, atCross = x > TR.cross.x0 - 0.3 && x < TR.cross.x1 + 0.3;
    for (const c of this.cars) {
      if (c.mode === 'parked' || c.z < zl || c.z > zh) continue;
      const rel = (x - c.x) * c.dir - c.M.L / 2;   // distance the car still has to travel to reach x
      if (rel < -c.M.L - 1) continue;              // already past
      if (c.v < 0.3 && (c.yielding || c.mode !== 'drive' || rel > 4)) continue;   // standing still (stopped, giving way, queued)
      if (rel < 1.5) return false;                 // right there
      if (c.yielding && rel > 3) continue;
      // at the zebra crossing a driver who can still stop comfortably will give way: not a danger
      if (atCross && c.mode === 'drive' && rel - 2.2 > c.v * c.v / (2 * 2.6) + 2) continue;
      const eta = rel / Math.max(0.5, c.v);
      if (eta < crossT + 1.8) return false;
    }
    return true;
  }
  nearestApproaching(x, z, r) {
    let best = null, bd = r;
    for (const c of this.cars) { if (c.mode === 'parked' || c.v < 0.5) continue; const rel = (x - c.x) * c.dir; if (rel < 0) continue; const d = Math.hypot(x - c.x, z - c.z); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  onRoad(x, z) { return z > TR.kerb0 && z < TR.kerb1; }
  // where someone in the road can reach the kerb on a side without walking into a parked car:
  // x itself, or just past the nearer end of the car(s) parked there
  kerbGap(x, side) {
    const lane = TR.lanes[side > 0 ? 0 : 1], list = this.cars.filter(c => (c.mode === 'parked' || c.mode === 'depart' || c.mode === 'disabled' || c.v < 0.3) && Math.abs(c.z - lane.park) < 1.2).sort((a, b) => a.x - b.x);
    const blockedAt = (q) => list.some(c => Math.abs(q - c.x) < c.M.L / 2 + 0.45);
    if (!blockedAt(x)) return x;
    for (let d = 0.5; d < 20; d += 0.5) { if (!blockedAt(x - d)) return x - d; if (!blockedAt(x + d)) return x + d; }
    return x;
  }
  // cover for people hiding: parked cars
  coverSpots(out) { for (const c of this.cars) if (c.mode === 'parked') out.push({ x: c.x, z: c.z, r: c.M.L / 2 }); return out; }
  // ----------------------------------------------------------------- visuals & sound ---
  updateVisuals(dt, cam) {
    let wi = 0, li = 0, pi = 0, di = 0;
    const blink = (this.time % 0.8) < 0.42;
    const W = this.wheelMesh, LM = this.lightMesh, PM = this.poolMesh, DM = this.dmgMesh, aTile = DM.geometry.attributes.aTile;
    // V1.16: only the cars in view (or close enough for their shadow to be) are drawn at all
    _trF.setFromProjectionMatrix(_tm1.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const cp = cam.position, far2 = (GFX.mobile ? 120 : 170) ** 2;
    for (const M of this.modelList) M.vis = 0;
    for (const c of this.cars) {
      const M = c.M;
      const d2 = (c.x - cp.x) ** 2 + (c.z - cp.z) ** 2;
      c.inView = d2 < far2 && _trF.intersectsSphere(_trS.set(_tv1.set(c.x, 0.8, c.z), d2 < 900 ? 9 : 3.5));
      if (!c.inView) continue;
      const m = this.carMatrix(c, _tm2), k = M.vis++;
      M.inst.paint.setMatrixAt(k, m); M.inst.trim.setMatrixAt(k, m); M.inst.glass.setMatrixAt(k, m);
      M.inst.paint.instanceColor.setXYZ(k, c.paint.r, c.paint.g, c.paint.b);
      for (let k = 0; k < 4; k++) {
        const w = M.wheels[k], front = k < 2;
        _tE.set(0, front ? c.steer : 0, -c.spin, 'YXZ'); _tq1.setFromEuler(_tE);
        if (w[2] < 0) _tq1.multiply(_tq2.setFromAxisAngle(UP, Math.PI));
        _tm1.compose(_tv1.set(w[0], w[1] - c.heave * 0.6, w[2]), _tq1, _tv2.set(M.wr / 0.33, M.wr / 0.33, 1));
        _tm1.premultiply(m); W.setMatrixAt(wi++, _tm1);
      }
      for (const L of M.lights) {
        const kind = L[4];
        let r = 0, gg = 0, b = 0;
        if (kind === 'head') { const k = c.head ? 2.4 : 0.12; r = k; gg = k * 0.96; b = k * 0.86; }
        else if (kind === 'tail') { if (c.reversing) { r = 1.9; gg = 1.85; b = 1.75; } else { const k = c.brake ? 2.2 : (c.head ? 0.9 : 0.12); r = k; gg = k * 0.05; b = k * 0.04; } }
        else if (kind === 'sign') { const k = c.head ? 1.6 : 0.5; r = k; gg = k * 0.8; b = k * 0.2; }
        else { const side = kind === 'indL' ? -1 : 1, on = blink && (c.hazard || c.ind === side || (c.ind === -1 && side === -1) || (c.ind === 1 && side === 1)); const k = on ? 2.2 : 0.06; r = k; gg = k * 0.55; b = 0; }
        _tq1.setFromAxisAngle(UP, L[3] > 0 ? 0 : Math.PI);
        _tm1.compose(_tv1.set(L[0], L[1], L[2]), _tq1, _tv2.set(1, L[6], L[5])); _tm1.premultiply(m);
        LM.setMatrixAt(li, _tm1); LM.instanceColor.setXYZ(li, r, gg, b); li++;
      }
      // spray off the tyres on a wet road
      const wet = this.env.wetness || 0, fx = this.game.fx;
      if (wet > 0.3 && c.v > 4 && fx && fx.smoke && Math.random() < wet * Math.min(1, c.v / 12) * 0.9) {
        const w = M.wheels[2 + (Math.random() < 0.5 ? 0 : 1)]; _tv1.set(w[0] - 0.3, 0.05, w[2]).applyMatrix4(m);
        fx.smoke.emit(_tv1.x, _tv1.y, _tv1.z, -c.dir * c.v * 0.18 + (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6, 0.45 + Math.random() * 0.3, 0.06, 0.45, 0.78, 0.8, 0.84, 0.22 * wet, 2, 2.2);
      }
      if (c.head > 0.5) {
        _tq1.setFromAxisAngle(UP, (c.dir > 0 ? -Math.PI / 2 : Math.PI / 2) + c.yaw);
        _tm1.compose(_tv1.set(c.x + c.dir * (M.L / 2 + 5.5) * Math.cos(c.yaw), TR.y + 0.02, c.z - c.dir * (M.L / 2 + 5.5) * Math.sin(c.yaw)), _tq1, _tv2.set(4.2, 1, 10));
        PM.setMatrixAt(pi, _tm1); const k = 0.55 * c.head; PM.instanceColor.setXYZ(pi, k, k, k); pi++;
      }
      for (const d of c.damage) {
        if (di >= DM.instanceMatrix.count) break;
        const n = d.nx;
        if (n === 1 || n === -1) _tq1.setFromAxisAngle(UP, n > 0 ? Math.PI / 2 : -Math.PI / 2);
        else if (n === 3 || n === -3) _tq1.setFromAxisAngle(UP, n > 0 ? 0 : Math.PI);
        else if (n === 2) _tq1.setFromAxisAngle(new V3(0, 0, 1), Math.PI / 2 - Math.atan2(M.roof - M.belt, M.fr)).premultiply(_tq2.setFromAxisAngle(UP, Math.PI / 2));
        else _tq1.setFromAxisAngle(new V3(1, 0, 0), -Math.PI / 2);
        _tm1.compose(_tv1.set(d.x, d.y, d.z), _tq1, _tv2.set(d.size, d.size, 1)); _tm1.premultiply(m);
        DM.setMatrixAt(di, _tm1); aTile.setX(di, d.kind === 1 ? 1 : 0); di++;
      }
    }
    for (const M of this.modelList) { for (const part of ['paint', 'trim', 'glass']) { const im = M.inst[part]; im.count = M.vis; im.instanceMatrix.needsUpdate = true; } M.inst.paint.instanceColor.needsUpdate = true; }
    W.count = wi; LM.count = li; PM.count = pi; DM.count = di;
    W.instanceMatrix.needsUpdate = true; LM.instanceMatrix.needsUpdate = true; LM.instanceColor.needsUpdate = true;
    PM.instanceMatrix.needsUpdate = true; PM.instanceColor.needsUpdate = true; DM.instanceMatrix.needsUpdate = true; aTile.needsUpdate = true;
    this.updateAudio(dt, cam);
  }
  // engines and tyres of the nearest cars: a looping engine note that follows the revs, tyre roar
  // with the speed (a wet hiss in the rain), each placed where its car is
  updateAudio(dt, cam) {
    const A = this.game.audio;
    if (!A || !A.ctx || !A.unlocked || !A.buffers.engineLoop) return;
    const c0 = A.ctx, t = c0.currentTime;
    if (!this.voices) {
      this.voices = [];
      for (let i = 0; i < 3; i++) {
        const mk = (name) => { const src = c0.createBufferSource(); src.buffer = A.buffers[name]; src.loop = true; const g = c0.createGain(); g.gain.value = 0; const lp = c0.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; src.connect(lp); lp.connect(g); src.start(t + i * 0.13); return { src, g, lp }; };
        const p = c0.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 5; p.rolloffFactor = 1.3; p.maxDistance = 180;
        const eng = mk('engineLoop'), tyre = mk('tireLoop');
        eng.g.connect(p); tyre.g.connect(p); p.connect(A.bus.effects);
        this.voices.push({ eng, tyre, p, car: null });
      }
    }
    this.nearT = (this.nearT || 0) - dt;
    if (this.nearT <= 0 || !this.nearCars) { this.nearT = 0.25; const px = cam.position.x, pz = cam.position.z; this.nearCars = this.cars.filter(c => c.mode !== 'parked').sort((a, b) => ((a.x - px) ** 2 + (a.z - pz) ** 2) - ((b.x - px) ** 2 + (b.z - pz) ** 2)).slice(0, 3); }
    const near = this.nearCars;
    for (let i = 0; i < near.length; i++) if (this.cars.indexOf(near[i]) < 0) { near.splice(i--, 1); }
    const wet = this.env.rainK || 0;
    for (let i = 0; i < 3; i++) {
      const V = this.voices[i], c = near[i];
      if (!c || Math.hypot(c.x - cam.position.x, c.z - cam.position.z) > 90) { V.eng.g.gain.setTargetAtTime(0, t, 0.3); V.tyre.g.gain.setTargetAtTime(0, t, 0.3); continue; }
      if (V.p.positionX) { V.p.positionX.setTargetAtTime(c.x, t, 0.04); V.p.positionY.setTargetAtTime(0.6, t, 0.04); V.p.positionZ.setTargetAtTime(c.z, t, 0.04); } else V.p.setPosition(c.x, 0.6, c.z);
      const thr = clamp(c.a / c.aMax, 0, 1);
      V.eng.src.playbackRate.setTargetAtTime(clamp(c.rpm / 1400, 0.45, 2.6) * (0.9 + (c.id % 7) * 0.03), t, 0.08);
      V.eng.lp.frequency.setTargetAtTime(500 + thr * 2400 + c.v * 60, t, 0.1);
      V.eng.g.gain.setTargetAtTime(c.mode === 'disabled' ? 0 : 0.16 + thr * 0.22 + Math.min(0.15, c.v * 0.01), t, 0.12);
      V.tyre.src.playbackRate.setTargetAtTime(0.7 + c.v * 0.04, t, 0.1);
      V.tyre.lp.frequency.setTargetAtTime(700 + c.v * 120 + wet * 2500, t, 0.1);
      V.tyre.g.gain.setTargetAtTime(Math.min(0.5, c.v * 0.028) * (1 + wet * 0.8), t, 0.12);
    }
  }
  dispose() {
    if (this.voices) for (const V of this.voices) { try { V.eng.src.stop(); V.tyre.src.stop(); V.p.disconnect(); } catch (e) { } }
    this.voices = null;
    for (const M of Object.values(this.models)) for (const k of ['paint', 'trim', 'glass']) M.geo[k].dispose();
  }
}
HT.TrafficSystem = TrafficSystem;
