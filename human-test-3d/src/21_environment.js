// ============================================================================
// Environments: White Testing Room + Sunny Grassy Field, and the manager.
// Interface: build(), dispose(), update(dt), groundHeight(x,z), groundNormal(x,z,out),
//            planes (physics), bounds, spawnPoints, surface ('hard'|'grass'), name
// ============================================================================
function kelvinToRGB(k) {
  const t = k / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  return new THREE.Color(clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255).convertSRGBToLinear();
}
function disposeObject(obj) {
  const cached = new Set(Tex.cache.values());
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const k of ['map', 'roughnessMap', 'normalMap', 'emissiveMap', 'alphaMap']) {
          if (m[k] && !cached.has(m[k])) m[k].dispose();
        }
        m.dispose();
      }
    }
  });
}

// ----------------------------------------------------------------------------
class RoomEnvironment {
  constructor(game) {
    this.game = game; this.kind = 'room'; this.name = 'White Testing Room'; this.surface = 'hard';
    this.group = new THREE.Group(); this.group.name = 'room';
    this.planes = []; this.spawnPoints = []; this.bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
    this.reverb = 'room';
  }
  build() {
    const P = Settings.data.environment.room;
    const W = this.W = clamp(P.width, 12, 80), D = this.D = clamp(P.depth, 12, 80), Ht = this.Ht = clamp(P.height, 4, 20);
    const g = this.group;
    const tiles = { floor: Tex.tile('floor'), wall: Tex.tile('panel'), ceiling: Tex.tile('ceiling') };
    const mk = (kind, rx, ry, rough, envI) => {
      const t = tiles[kind];
      const map = t.map.clone(); map.needsUpdate = true; map.repeat.set(rx, ry);
      const rm = t.rough.clone(); rm.needsUpdate = true; rm.repeat.copy(map.repeat);
      map.anisotropy = rm.anisotropy = this.game.maxAniso || 4;
      return new THREE.MeshStandardMaterial({ map, roughnessMap: rm, roughness: rough, metalness: 0, envMapIntensity: envI, vertexColors: true });
    };
    // ceiling panel layout (also drives the baked light pools on the floor)
    const nx = Math.max(2, Math.floor(W / 4)), nz = Math.max(2, Math.floor(D / 4));
    const panelXZ = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) panelXZ.push([(i + 0.5) / nx * W - W / 2, (j + 0.5) / nz * D - D / 2]);
    // baked shading: ambient occlusion where surfaces meet, soft light pools under the panels
    const edgeAO = (d, k, r) => 1 - k * Math.exp(-d / r);
    const shade = (geo, fn) => {
      const p = geo.attributes.position, c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = v; c[i * 3 + 1] = v; c[i * 3 + 2] = v * 1.004; }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    };
    // floor (glossy sealed tiles: soft reflections of the ceiling panels, no hard glints)
    const floorGeo = new THREE.PlaneGeometry(W, D, Math.min(110, Math.round(W * 3)), Math.min(110, Math.round(D * 3)));
    floorGeo.rotateX(-Math.PI / 2);
    shade(floorGeo, (x, y, z) => {
      const dx = Math.min(x + W / 2, W / 2 - x), dz = Math.min(z + D / 2, D / 2 - z);
      let v = edgeAO(dx, 0.3, 0.3) * edgeAO(dz, 0.3, 0.3) * edgeAO(dx, 0.08, 1.8) * edgeAO(dz, 0.08, 1.8);
      let pool = 0;
      for (const q of panelXZ) pool += Math.exp(-((x - q[0]) ** 2 + (z - q[1]) ** 2) / 4.5);
      return v * (0.9 + 0.1 * Math.min(1, pool));
    });
    const floorMat = mk('floor', W / 2, D / 2, 1.45, 0.85);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true; floor.name = 'floor';
    g.add(floor);
    // walls: large matte panels with fine seams; darker where they meet floor, ceiling and each other
    const wallShade = (w) => (x, y) => {
      const u = x + w / 2, v = y + Ht / 2, du = Math.min(u, w - u);
      return edgeAO(du, 0.24, 0.42) * edgeAO(v, 0.3, 0.24) * edgeAO(Ht - v, 0.16, 0.32) * (0.92 + 0.08 * smoothstep(0, Ht * 0.7, v));
    };
    const addWall = (w, x, z, ry) => {
      const geo = new THREE.PlaneGeometry(w, Ht, Math.min(96, Math.round(w * 2)), Math.max(8, Math.round(Ht * 3)));
      shade(geo, wallShade(w));
      const m = new THREE.Mesh(geo, mk('wall', w / 1.25, Ht / 2.5, 1.0, 0.45));
      m.position.set(x, Ht / 2, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m);
    };
    addWall(W, 0, -D / 2, 0);
    addWall(W, 0, D / 2, Math.PI);
    addWall(D, -W / 2, 0, Math.PI / 2);
    addWall(D, W / 2, 0, -Math.PI / 2);
    // ceiling
    const ceilMat = mk('ceiling', W / 2, D / 2, 1.0, 0.4);
    ceilMat.emissive = new THREE.Color(0xffffff); ceilMat.emissiveMap = ceilMat.map; ceilMat.emissiveIntensity = 0.42;
    this.ceilMat = ceilMat;
    const ceilGeo = new THREE.PlaneGeometry(W, D, Math.min(64, Math.round(W * 1.5)), Math.min(64, Math.round(D * 1.5)));
    shade(ceilGeo, (x, y) => { const dx = Math.min(x + W / 2, W / 2 - x), dz = Math.min(y + D / 2, D / 2 - y); return edgeAO(dx, 0.25, 0.45) * edgeAO(dz, 0.25, 0.45); });
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = Ht; g.add(ceil);
    // skirting boards: a thin satin strip where walls meet the floor
    const bbMat = new THREE.MeshStandardMaterial({ color: 0xe4e6e9, roughness: 0.32, metalness: 0, envMapIntensity: 0.7 });
    const bbH = 0.11, bbT = 0.016;
    const addBB = (len, x, z, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(len, bbH, bbT), bbMat); m.position.set(x, bbH / 2, z); m.rotation.y = ry; m.receiveShadow = true; m.castShadow = false; g.add(m); };
    addBB(W, 0, -D / 2 + bbT / 2, 0); addBB(W, 0, D / 2 - bbT / 2, 0); addBB(D - 2 * bbT, -W / 2 + bbT / 2, 0, Math.PI / 2); addBB(D - 2 * bbT, W / 2 - bbT / 2, 0, Math.PI / 2);
    // light panels on the ceiling, each in a thin frame
    const lightCol = kelvinToRGB(P.colorTemp);
    const panelGeo = new THREE.PlaneGeometry(1.6, 0.5);
    const panelMat = new THREE.MeshBasicMaterial({ color: lightCol.clone().multiplyScalar(2.2 * clamp(P.light, 0.2, 2)), toneMapped: true });
    this.panelMat = panelMat;
    const panels = new THREE.InstancedMesh(panelGeo, panelMat, panelXZ.length);
    const frames = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.74, 0.64), new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.45, metalness: 0.1 }), panelXZ.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(LEFT, Math.PI / 2);
    panelXZ.forEach((pz, k) => {
      m4.compose(new V3(pz[0], Ht - 0.012, pz[1]), q, new V3(1, 1, 1)); panels.setMatrixAt(k, m4);
      m4.compose(new V3(pz[0], Ht - 0.006, pz[1]), q, new V3(1, 1, 1)); frames.setMatrixAt(k, m4);
    });
    g.add(frames); g.add(panels);
    // lights
    const L = clamp(P.light, 0.1, 2.0);
    this.hemi = new THREE.HemisphereLight(lightCol, 0xd6d8dc, 0.75 * L);
    g.add(this.hemi);
    this.key = new THREE.DirectionalLight(lightCol, 2.1 * L);
    this.key.position.set(W * 0.1, Ht + 10, D * 0.16);
    this.key.target.position.set(0, 0, 0);
    this.key.castShadow = true;
    this.setupShadow(this.key, Math.max(W, D) * 0.55);
    g.add(this.key); g.add(this.key.target);
    this.fill = new THREE.DirectionalLight(lightCol, 0.35 * L);
    this.fill.position.set(-W * 0.3, Ht, -D * 0.25);
    g.add(this.fill);
    // bounce light from the white floor (lights ceiling + undersides)
    this.bounce = new THREE.DirectionalLight(lightCol, 0.55 * L);
    this.bounce.position.set(W * 0.05, -10, D * 0.08);
    g.add(this.bounce);
    // measurement grid
    this.grid = this.buildGrid(W, D);
    this.grid.visible = !!P.grid;
    g.add(this.grid);
    // spawn markers
    this.spawnPoints = [];
    const ringR = Math.min(W, D) * 0.18;
    this.spawnPoints.push(new V3(0, 0, 0));
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; this.spawnPoints.push(new V3(Math.sin(a) * ringR, 0, Math.cos(a) * ringR)); }
    this.markers = this.buildMarkers(this.spawnPoints);
    this.markers.visible = !!P.markers;
    g.add(this.markers);
    // physics planes (n . p - d >= 0 inside)
    this.planes = [
      { n: new V3(0, 1, 0), d: 0, ground: true },
      { n: new V3(0, -1, 0), d: -Ht },
      { n: new V3(1, 0, 0), d: -W / 2 }, { n: new V3(-1, 0, 0), d: -W / 2 },
      { n: new V3(0, 0, 1), d: -D / 2 }, { n: new V3(0, 0, -1), d: -D / 2 }
    ];
    this.bounds = { minX: -W / 2 + 0.6, maxX: W / 2 - 0.6, minZ: -D / 2 + 0.6, maxZ: D / 2 - 0.6 };
    // environment map (reflections / IBL)
    this.buildEnvMap(W, D, Ht, lightCol, L);
    const scene = this.game.scene;
    scene.background = new THREE.Color(0xf2f2f2);
    scene.fog = null;
    this.game.renderer.toneMappingExposure = 0.92;
  }
  setupShadow(light, half) {
    const sq = Settings.data.graphics.shadowQuality;
    const size = sq === 'ultra' ? 4096 : sq === 'high' ? 2048 : 1024;
    light.shadow.mapSize.set(size, size);
    const c = light.shadow.camera;
    c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 1; c.far = 80;
    light.shadow.bias = -0.0004; light.shadow.normalBias = 0.025; light.shadow.radius = 3;
    light.castShadow = sq !== 'off';
  }
  buildGrid(W, D) {
    const grp = new THREE.Group();
    const minor = [], major = [];
    for (let x = Math.ceil(-W / 2); x <= W / 2; x++) (x % 5 === 0 ? major : minor).push(x, 0.004, -D / 2, x, 0.004, D / 2);
    for (let z = Math.ceil(-D / 2); z <= D / 2; z++) (z % 5 === 0 ? major : minor).push(-W / 2, 0.004, z, W / 2, 0.004, z);
    const mkL = (arr, col, op) => {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false }));
    };
    grp.add(mkL(minor, 0x6aa8d0, 0.22));
    grp.add(mkL(major, 0x2f7fb5, 0.45));
    // labels
    const lblGeo = new THREE.PlaneGeometry(0.8, 0.4);
    for (let x = Math.ceil(-W / 2 / 5) * 5; x <= W / 2; x += 5) {
      const mat = new THREE.MeshBasicMaterial({ map: Tex.text('m' + x, x + 'm'), transparent: true, depthWrite: false });
      const m = new THREE.Mesh(lblGeo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x + 0.45, 0.006, 0.3); grp.add(m);
    }
    for (let z = Math.ceil(-D / 2 / 5) * 5; z <= D / 2; z += 5) {
      if (z === 0) continue;
      const mat = new THREE.MeshBasicMaterial({ map: Tex.text('m' + z, z + 'm'), transparent: true, depthWrite: false });
      const m = new THREE.Mesh(lblGeo, mat); m.rotation.x = -Math.PI / 2; m.position.set(0.45, 0.006, z + 0.3); grp.add(m);
    }
    return grp;
  }
  buildMarkers(points) {
    const grp = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.42, 0.5, 40);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x24a7e0, transparent: true, opacity: 0.55, depthWrite: false });
    const dotGeo = new THREE.CircleGeometry(0.05, 16);
    points.forEach((p, i) => {
      const r = new THREE.Mesh(ringGeo, ringMat); r.rotation.x = -Math.PI / 2; r.position.set(p.x, 0.005, p.z); grp.add(r);
      const d = new THREE.Mesh(dotGeo, ringMat); d.rotation.x = -Math.PI / 2; d.position.set(p.x, 0.005, p.z); grp.add(d);
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: Tex.text('sp' + i, 'S' + (i + 1), { color: 'rgba(20,120,180,0.9)' }), transparent: true, depthWrite: false }));
      lbl.rotation.x = -Math.PI / 2; lbl.position.set(p.x, 0.006, p.z + 0.68); grp.add(lbl);
    });
    return grp;
  }
  buildEnvMap(W, D, Ht, lightCol, L) {
    const r = this.game.renderer;
    const es = new THREE.Scene();
    const box = new THREE.Mesh(new THREE.BoxGeometry(W, Ht, D), new THREE.MeshBasicMaterial({ color: 0xbdbfc2, side: THREE.BackSide }));
    box.position.y = Ht / 2; es.add(box);
    const pg = new THREE.PlaneGeometry(1.6, 0.5);
    const pm = new THREE.MeshBasicMaterial({ color: lightCol.clone().multiplyScalar(14 * L) });
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const p = new THREE.Mesh(pg, pm); p.rotation.x = Math.PI / 2; p.position.set(i * W / 5, Ht - 0.05, j * D / 5); es.add(p);
    }
    const flo = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: 0x9a9ca0 }));
    flo.rotation.x = -Math.PI / 2; flo.position.y = 0.01; es.add(flo);
    const pmrem = new THREE.PMREMGenerator(r);
    if (this.envRT) this.envRT.dispose();
    this.envRT = pmrem.fromScene(es, 0.035, 0.1, 100);
    this.game.scene.environment = this.envRT.texture;
    pmrem.dispose();
    es.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
  applyLighting() {
    const P = Settings.data.environment.room;
    const col = kelvinToRGB(P.colorTemp), L = clamp(P.light, 0.1, 2);
    this.hemi.color.copy(col); this.hemi.intensity = 0.75 * L;
    this.key.color.copy(col); this.key.intensity = 2.1 * L;
    this.fill.color.copy(col); this.fill.intensity = 0.35 * L;
    this.bounce.color.copy(col); this.bounce.intensity = 0.55 * L;
    this.ceilMat.emissiveIntensity = 0.42 * L;
    this.panelMat.color.copy(col).multiplyScalar(2.2 * L);
  }
  setGrid(v) { if (this.grid) this.grid.visible = v; }
  setMarkers(v) { if (this.markers) this.markers.visible = v; }
  groundHeight() { return 0; }
  groundNormal(x, z, out) { return out.set(0, 1, 0); }
  update(dt) { }
  dispose() {
    this.game.scene.remove(this.group);
    disposeObject(this.group);
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
    this.group = new THREE.Group();
  }
}

// ----------------------------------------------------------------------------
// Terrain height (shared by JS physics + GLSL grass) -- keep formulas identical
function terrainHeight(x, z) {
  const r = Math.sqrt(x * x + z * z);
  const fl = smoothstep(38, 115, r);
  let h = 0.12 * Math.sin(x * 0.21 + 1.3) * Math.sin(z * 0.17 + 0.4) + 0.07 * Math.sin(x * 0.53 - z * 0.41);
  h += fl * (4.0 * Math.sin(x * 0.031 + 0.5) * Math.sin(z * 0.027 + 1.1) + 2.2 * Math.sin(x * 0.067 - 1.0) * Math.cos(z * 0.059 + 0.3) + 3.2);
  return h;
}
const GLSL_TERRAIN = /* glsl */`
float htTerrain(vec2 p) {
  float r = length(p);
  float fl = smoothstep(38.0, 115.0, r);
  float h = 0.12 * sin(p.x * 0.21 + 1.3) * sin(p.y * 0.17 + 0.4) + 0.07 * sin(p.x * 0.53 - p.y * 0.41);
  h += fl * (4.0 * sin(p.x * 0.031 + 0.5) * sin(p.y * 0.027 + 1.1) + 2.2 * sin(p.x * 0.067 - 1.0) * cos(p.y * 0.059 + 0.3) + 3.2);
  return h;
}`;

const SkyShader = {
  uniforms: {
    turbidity: { value: 2 }, rayleigh: { value: 1 }, mieCoefficient: { value: 0.005 }, mieDirectionalG: { value: 0.8 },
    sunPosition: { value: new V3() }, up: { value: new V3(0, 1, 0) }, uCloud: { value: 0 }, uNight: { value: 0 }, uTime: { value: 0 }, uGain: { value: 1 }, uSat: { value: 1 },
    uFogCol: { value: new THREE.Color(0xc4d6ea) }, uHorizon: { value: 0.85 }, uDisk: { value: 1 }
  },
  vertexShader: /* glsl */`
    uniform vec3 sunPosition; uniform float rayleigh; uniform float turbidity; uniform float mieCoefficient; uniform vec3 up;
    varying vec3 vWorldPosition; varying vec3 vSunDirection; varying float vSunfade; varying vec3 vBetaR; varying vec3 vBetaM; varying float vSunE;
    const float e = 2.71828182845904523536028747135266249775724709369995957;
    const float pi = 3.141592653589793238462643383279502884197169;
    const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);
    const float v = 4.0;
    const vec3 K = vec3(0.686, 0.678, 0.666);
    const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);
    const float cutoffAngle = 1.6110731556870734;
    const float steepness = 1.5;
    const float EE = 1000.0;
    float sunIntensity(float zenithAngleCos) { zenithAngleCos = clamp(zenithAngleCos, -1.0, 1.0); return EE * max(0.0, 1.0 - pow(e, -((cutoffAngle - acos(zenithAngleCos)) / steepness))); }
    vec3 totalMie(float T) { float c = (0.2 * T) * 10E-18; return 0.434 * c * MieConst; }
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position.z = gl_Position.w;
      vSunDirection = normalize(sunPosition);
      vSunE = sunIntensity(dot(vSunDirection, up));
      vSunfade = 1.0 - clamp(1.0 - exp((sunPosition.y / 450000.0)), 0.0, 1.0);
      float rayleighCoefficient = rayleigh - (1.0 * (1.0 - vSunfade));
      vBetaR = totalRayleigh * rayleighCoefficient;
      vBetaM = totalMie(turbidity) * mieCoefficient;
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vWorldPosition; varying vec3 vSunDirection; varying float vSunfade; varying vec3 vBetaR; varying vec3 vBetaM; varying float vSunE;
    uniform float mieDirectionalG; uniform vec3 up; uniform float uCloud; uniform float uNight; uniform float uTime; uniform float uGain; uniform float uSat;
    uniform vec3 uFogCol; uniform float uHorizon; uniform float uDisk;
    const float pi = 3.141592653589793238462643383279502884197169;
    const float rayleighZenithLength = 8.4E3;
    const float mieZenithLength = 1.25E3;
    const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;
    const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
    const float ONE_OVER_FOURPI = 0.07957747154594767;
    float rayleighPhase(float cosTheta) { return THREE_OVER_SIXTEENPI * (1.0 + pow(cosTheta, 2.0)); }
    float hgPhase(float cosTheta, float g) { float g2 = pow(g, 2.0); float inverse = 1.0 / pow(1.0 - 2.0 * g * cosTheta + g2, 1.5); return ONE_OVER_FOURPI * ((1.0 - g2) * inverse); }
    float sh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main() {
      vec3 direction = normalize(vWorldPosition - cameraPosition);
      float zenithAngle = acos(max(0.0, dot(up, direction)));
      float inverse = 1.0 / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));
      float sR = rayleighZenithLength * inverse;
      float sM = mieZenithLength * inverse;
      vec3 Fex = exp(-(vBetaR * sR + vBetaM * sM));
      float cosTheta = dot(direction, vSunDirection);
      float rPhase = rayleighPhase(cosTheta * 0.5 + 0.5);
      vec3 betaRTheta = vBetaR * rPhase;
      float mPhase = hgPhase(cosTheta, mieDirectionalG);
      vec3 betaMTheta = vBetaM * mPhase;
      vec3 Lin = pow(vSunE * ((betaRTheta + betaMTheta) / (vBetaR + vBetaM)) * (1.0 - Fex), vec3(1.5));
      Lin *= mix(vec3(1.0), pow(vSunE * ((betaRTheta + betaMTheta) / (vBetaR + vBetaM)) * Fex, vec3(1.0 / 2.0)), clamp(pow(1.0 - dot(up, vSunDirection), 5.0), 0.0, 1.0));
      vec3 L0 = vec3(0.1) * Fex;
      float sundisk = smoothstep(sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta);
      L0 += (vSunE * 19000.0 * Fex) * sundisk * (1.0 - uCloud * 0.95) * uDisk;
      vec3 texColor = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);
      vec3 retColor = pow(texColor, vec3(1.0 / (1.2 + (1.2 * vSunfade))));
      retColor *= uGain;
      retColor = max(mix(vec3(dot(retColor, vec3(0.2126, 0.7152, 0.0722))), retColor, uSat), 0.0);
      // overcast: blend toward grey
      float lum = dot(retColor, vec3(0.3, 0.59, 0.11));
      retColor = mix(retColor, vec3(lum) * vec3(0.92, 0.95, 1.0) * 0.9 + 0.02, uCloud * 0.85);
      // night sky + stars
      float h = max(direction.y, 0.0);
      vec3 night = mix(vec3(0.006, 0.01, 0.025), vec3(0.002, 0.004, 0.012), h);
      vec2 sp = floor(direction.xz / max(0.15, direction.y + 0.2) * 220.0);
      float star = step(0.9975, sh(sp)) * smoothstep(0.02, 0.2, direction.y) * (0.6 + 0.4 * sin(uTime * 3.0 + sp.x));
      night += vec3(star) * 0.9 * (1.0 - uCloud);
      retColor = mix(retColor, night, uNight);
      gl_FragColor = vec4(retColor, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      // the horizon dissolves into exactly the fog colour (applied where three applies fog)
      float hz = 1.0 - smoothstep(-0.03, 0.2, direction.y);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogCol, hz * hz * (3.0 - 2.0 * hz) * uHorizon);
    }`
};

// meadow patches shared by grass blades and ground: value noise, dry/lush patches, grass length
const GLSL_FIELD = /* glsl */`
float htHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float htNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(htHash(i), htHash(i + vec2(1.0, 0.0)), u.x), mix(htHash(i + vec2(0.0, 1.0)), htHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float htDry(vec2 p) { return smoothstep(0.56, 0.86, htNoise(p * 0.035 + 3.1) * 0.65 + htNoise(p * 0.11 + 7.7) * 0.35); }
float htLen(vec2 p) { return 0.62 + 0.72 * smoothstep(0.3, 0.75, htNoise(p * 0.07 + 11.3) * 0.7 + htNoise(p * 0.29 + 2.0) * 0.3); }`;

// --- vegetation geometry (merged, vertex coloured; displacement keyed on position so faces stay closed) ---
function lumpyIco(radius, detail, seed, squash) {
  const ico = new THREE.IcosahedronGeometry(radius, detail);
  const p = ico.attributes.position, nrm = new Float32Array(p.count * 3);
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
    const h = hash2(Math.round(x * 41 + y * 13 + seed * 7 + 500), Math.round(z * 37 - y * 29 + seed * 3 + 500));
    const n = 0.82 + 0.36 * h;
    p.setXYZ(k, x * n, y * n * squash, z * n);
    _v1.set(x, y / Math.max(0.3, squash), z).normalize(); nrm[k * 3] = _v1.x; nrm[k * 3 + 1] = _v1.y; nrm[k * 3 + 2] = _v1.z;
  }
  ico.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return ico;
}
function shadeCrown(geo, col, y0, y1, cx, cz, rad) {
  paintGeo(geo, col);
  const c = geo.attributes.color, p = geo.attributes.position;
  for (let k = 0; k < c.count; k++) { // darker underneath and toward the inside of the crown
    const ao = (0.5 + 0.5 * smoothstep(y0, y1, p.getY(k))) * (0.75 + 0.25 * smoothstep(0, rad, Math.hypot(p.getX(k) - cx, p.getZ(k) - cz)));
    c.setXYZ(k, c.getX(k) * ao, c.getY(k) * ao, c.getZ(k) * ao);
  }
}
function makeBroadleaf(seed) {
  const r = new RNG(seed), parts = [];
  const trunk = new THREE.CylinderGeometry(0.15, 0.3, 4.2, 7, 2); trunk.translate(0, 2.1, 0);
  paintGeo(trunk, new THREE.Color(0x4a3829)); parts.push(trunk);
  const br = new THREE.CylinderGeometry(0.05, 0.11, 1.8, 5, 1); br.rotateZ(0.8); br.translate(0.55, 3.6, 0); paintGeo(br, new THREE.Color(0x4a3829)); parts.push(br);
  const br2 = new THREE.CylinderGeometry(0.05, 0.1, 1.6, 5, 1); br2.rotateX(-0.75); br2.translate(0, 3.8, 0.5); paintGeo(br2, new THREE.Color(0x4a3829)); parts.push(br2);
  for (let i = 0; i < 6; i++) {
    const rad = (i === 0 ? 1.85 : r.range(1.05, 1.6));
    const ico = lumpyIco(rad, 1, seed * 10 + i, 0.82);
    const a = r.range(0, TAU), d = i === 0 ? 0 : r.range(0.9, 1.6), y = i === 0 ? 5.2 : r.range(4.3, 6.3);
    ico.translate(Math.cos(a) * d, y, Math.sin(a) * d);
    shadeCrown(ico, new THREE.Color().setHSL(0.25 + r.range(-0.02, 0.03), 0.48, r.range(0.17, 0.24)), 3.6, 6.8, 0, 0, 2.4);
    parts.push(ico);
  }
  return mergeGeos(parts);
}
function makeConifer(seed) {
  const r = new RNG(seed), parts = [];
  const trunk = new THREE.CylinderGeometry(0.1, 0.22, 3.2, 6, 1); trunk.translate(0, 1.6, 0);
  paintGeo(trunk, new THREE.Color(0x3d2e22)); parts.push(trunk);
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const rad = lerp(2.1, 0.55, i / (tiers - 1)), h = lerp(2.4, 1.5, i / (tiers - 1));
    const cone = new THREE.ConeGeometry(rad, h, 10, 1, false);
    const p = cone.attributes.position;
    for (let k = 0; k < p.count; k++) { // ragged, drooping branch tips
      const y = p.getY(k);
      if (y < 0) { const x = p.getX(k), z = p.getZ(k); const n = 0.85 + 0.3 * hash2(Math.round(x * 23 + 300 + i * 17), Math.round(z * 23 + 300)); p.setXYZ(k, x * n, y - (n - 0.85) * 0.5, z * n); }
    }
    cone.computeVertexNormals();
    cone.translate(0, 2.2 + i * 1.25 + h * 0.5, 0);
    shadeCrown(cone, new THREE.Color().setHSL(0.36 + r.range(-0.02, 0.02), 0.42, 0.12 + i * 0.012), 2, 8.5, 0, 0, 2);
    parts.push(cone);
  }
  return mergeGeos(parts);
}
function makeBush(seed) {
  const r = new RNG(seed), parts = [];
  for (let i = 0; i < 4; i++) {
    const rad = r.range(0.45, 0.8);
    const ico = lumpyIco(rad, 1, seed * 5 + i, 0.72);
    const a = r.range(0, TAU), d = i === 0 ? 0 : r.range(0.35, 0.7);
    ico.translate(Math.cos(a) * d, rad * 0.55, Math.sin(a) * d);
    shadeCrown(ico, new THREE.Color().setHSL(0.24 + r.range(-0.02, 0.04), 0.45, r.range(0.15, 0.21)), 0, 1.1, 0, 0, 0.9);
    parts.push(ico);
  }
  return mergeGeos(parts);
}
function makeFarTree() {
  const trunk = new THREE.CylinderGeometry(0.2, 0.3, 3, 4, 1); trunk.translate(0, 1.5, 0); paintGeo(trunk, new THREE.Color(0x3b3026));
  const crown = lumpyIco(2.3, 0, 77, 1.15); crown.translate(0, 5, 0); paintGeo(crown, new THREE.Color().setHSL(0.27, 0.4, 0.2));
  return mergeGeos([trunk, crown]);
}

class FieldEnvironment {
  constructor(game) {
    this.game = game; this.kind = 'field'; this.name = 'Sunny Grassy Field'; this.surface = 'grass';
    this.group = new THREE.Group(); this.group.name = 'field';
    this.planes = []; this.spawnPoints = []; this.reverb = 'field';
    this.half = 95;
    this.bounds = { minX: -this.half + 2, maxX: this.half - 2, minZ: -this.half + 2, maxZ: this.half - 2 };
    this.time = 0; this.windDir = new V3(1, 0, 0.3).normalize();
    this.sunDir = new V3(0, 1, 0);
    this.fogColor = new THREE.Color();
  }
  build() {
    const g = this.group;
    const q = Settings.data.graphics.preset;
    const R = q === 'low' ? 14 : q === 'ultra' ? 26 : 19;
    this.fieldU = { uCenter: { value: new THREE.Vector2() }, uR: { value: R } };
    // sky (its horizon takes the fog colour exactly, so distant terrain melts into it)
    const su = THREE.UniformsUtils.clone(SkyShader.uniforms);
    const skyMat = new THREE.ShaderMaterial({ uniforms: su, vertexShader: SkyShader.vertexShader, fragmentShader: SkyShader.fragmentShader, side: THREE.BackSide, depthWrite: false });
    this.sky = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), skyMat);
    this.sky.scale.setScalar(4000); this.sky.frustumCulled = false;
    this.sky.onBeforeRender = (r) => this.syncSkyFog(r);
    g.add(this.sky);
    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 3.0);
    const sq = Settings.data.graphics.shadowQuality;
    const size = sq === 'ultra' ? 4096 : sq === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    const sc = this.sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 220;
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 2.5;
    this.sun.castShadow = sq !== 'off';
    g.add(this.sun); g.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x55683a, 0.9);
    g.add(this.hemi);
    // terrain: broad flat test area in the middle, rolling hills further out
    const T = 1000, seg = q === 'low' ? 110 : 180;
    const tg = new THREE.PlaneGeometry(T, T, seg, seg);
    tg.rotateX(-Math.PI / 2);
    const pos = tg.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
      const n = fbm2(x * 0.02 + 40, z * 0.02, 3);
      cols[i * 3] = 0.88 + n * 0.24; cols[i * 3 + 1] = 0.95 + n * 0.12; cols[i * 3 + 2] = 0.88 + n * 0.16;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    tg.computeVertexNormals();
    const gt = Tex.grass().clone(); gt.needsUpdate = true; gt.repeat.set(T / 6, T / 6); gt.anisotropy = this.game.maxAniso || 4;
    this.groundMat = new THREE.MeshStandardMaterial({ map: gt, vertexColors: true, roughness: 0.93, metalness: 0, envMapIntensity: 0.35 });
    this.groundMat.onBeforeCompile = (sh) => {
      sh.uniforms.uCenter = this.fieldU.uCenter; sh.uniforms.uR = this.fieldU.uR;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW; uniform vec2 uCenter; uniform float uR;\n' + GLSL_FIELD)
        .replace('#include <map_fragment>', `#include <map_fragment>
          // break up texture tiling with a second rotated, rescaled sample
          vec3 htT2 = texture2D(map, vec2(vMapUv.y, -vMapUv.x) * 0.37 + 0.21).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * htT2, 0.45);
          // dry and lush patches (same pattern as the blades) and slow large-scale variation
          float htDG = htDry(vTW.xz);
          diffuseColor.rgb *= mix(vec3(0.9, 1.0, 0.88), vec3(1.28, 1.1, 0.74), htDG) * (0.88 + 0.24 * htNoise(vTW.xz * 0.018 + 5.0));
          // soil under the blades reads darker; past the blade radius the ground carries the meadow tone
          diffuseColor.rgb *= mix(0.72, 0.98, smoothstep(uR * 0.45, uR * 1.02, length(vTW.xz - uCenter)));`);
    };
    this.groundMat.customProgramCacheKey = () => 'ht3d-ground';
    this.terrain = new THREE.Mesh(tg, this.groundMat);
    this.terrain.receiveShadow = true; this.terrain.name = 'terrain';
    g.add(this.terrain);
    this.buildGrass(q, R);
    this.buildTrees(q);
    this.buildHills();
    // clouds
    this.clouds = new THREE.Group();
    const cr = new RNG(1234);
    for (let i = 0; i < 26; i++) {
      const mat = new THREE.SpriteMaterial({ map: Tex.cloud(i % 6), transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
      const s = new THREE.Sprite(mat);
      const a = cr.range(0, TAU), d = cr.range(150, 900);
      s.position.set(Math.cos(a) * d, cr.range(140, 320), Math.sin(a) * d);
      const w = cr.range(160, 380); s.scale.set(w, w * 0.42, 1);
      s.userData.speed = cr.range(0.6, 1.4);
      this.clouds.add(s);
    }
    g.add(this.clouds);
    this.buildRain();
    // physics: heightfield ground + invisible boundary walls (vegetation never blocks movement)
    const h = this.half;
    this.planes = [
      { n: new V3(1, 0, 0), d: -h }, { n: new V3(-1, 0, 0), d: -h }, { n: new V3(0, 0, 1), d: -h }, { n: new V3(0, 0, -1), d: -h }
    ];
    this.heightfield = true;
    this.spawnPoints = [new V3(0, 0, 0)];
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; this.spawnPoints.push(new V3(Math.sin(a) * 6, 0, Math.cos(a) * 6)); }
    this.game.scene.environment = null;
    this.applyTimeWeather();
  }
  syncSkyFog(r) {
    const su = this.sky.material.uniforms;
    this.fogColor.getRGB(su.uFogCol.value, r.getRenderTarget() === null ? r.outputColorSpace : THREE.ColorManagement.workingColorSpace);
  }
  buildGrass(q, R) {
    const count = q === 'low' ? 16000 : q === 'ultra' ? 76000 : 40000;
    this.grassR = R;
    const segs = 5, verts = [], uvs = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, w = 0.03 * (1 - t * 0.85);
      if (i < segs) { verts.push(-w, t, 0, w, t, 0); uvs.push(0, t, 1, t); }
      else { verts.push(0, 1, 0); uvs.push(0.5, 1); }
    }
    for (let i = 0; i < segs - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    const a = (segs - 1) * 2; idx.push(a, a + 1, a + 2);
    const ig = new THREE.InstancedBufferGeometry();
    ig.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    ig.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    ig.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(verts.length).fill(0).map((v, i) => (i % 3 === 1 ? 1 : 0)), 3));
    ig.setIndex(idx);
    const off = new Float32Array(count * 4);
    const rr = new RNG(777);
    for (let i = 0; i < count; i++) {
      off[i * 4] = rr.range(-R, R); off[i * 4 + 1] = rr.range(-R, R);
      off[i * 4 + 2] = rr.range(0, TAU); off[i * 4 + 3] = rr.range(0.55, 1.25);
    }
    ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    ig.instanceCount = count;
    ig.boundingSphere = new THREE.Sphere(new V3(), 1e5);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.pushMax = q === 'low' ? 6 : q === 'ultra' ? 16 : 12; // grass pressure points (vertex cost scales with this)
    const push = []; for (let i = 0; i < this.pushMax; i++) push.push(new THREE.Vector4(0, 0, 0, 0));
    this.grassU = {
      uCenter: this.fieldU.uCenter, uR: this.fieldU.uR, uTime: { value: 0 }, uWind: { value: 0.4 }, uWindDir: { value: new THREE.Vector2(1, 0.3) },
      uBlade: { value: 0.3 }, uPush: { value: push }, uPushN: { value: 0 }, uSunView: { value: new V3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0, 0, 0) }
    };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.grassU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        #define HT_PUSH ${this.pushMax}
        attribute vec4 aOff; uniform vec2 uCenter; uniform float uTime; uniform float uWind; uniform vec2 uWindDir; uniform float uR; uniform float uBlade; uniform vec4 uPush[HT_PUSH]; uniform int uPushN;
        varying float vGrassT; varying float vGrassShade; varying float vDry; varying float vFlower; varying float vPushAO; varying float vGust;
        ${GLSL_TERRAIN}
        ${GLSL_FIELD}`)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(vec3(-sin(aOff.z) * 0.5, 1.0, cos(aOff.z) * 0.5));')
        .replace('#include <begin_vertex>', `
          vec2 base = aOff.xy;
          vec2 wp = base + 2.0 * uR * floor((uCenter - base) / (2.0 * uR) + 0.5);
          float fade = 1.0 - smoothstep(uR * 0.7, uR, length(wp - uCenter));
          float rnd = htHash(base * 7.13 + 0.5);
          float dry = htDry(wp);
          float flower = step(0.975, htHash(base * 3.71 + 9.2)) * step(dry, 0.6);
          float t = position.y;
          // feet and bodies press the blades down and aside
          float press = 0.0; vec2 away = vec2(0.0);
          for (int i = 0; i < HT_PUSH; i++) {
            if (i >= uPushN) break;
            vec4 P = uPush[i];
            if (P.w <= 0.0) continue;
            vec2 d = wp - P.xy; float dl = length(d);
            float k = (1.0 - smoothstep(P.z * 0.5, P.z, dl)) * P.w;
            if (k > press) { press = k; away = d / max(dl, 0.001); }
          }
          float hgt = uBlade * aOff.w * fade * htLen(wp) * mix(1.0, 0.72, flower) * (1.0 - press * 0.6);
          float c = cos(aOff.z), s = sin(aOff.z);
          float wid = 1.0 + flower * smoothstep(0.7, 0.85, t) * 2.6;
          vec3 lp = vec3(position.x * wid * c, t * hgt, position.x * wid * s);
          float arc = (0.12 + 0.3 * rnd) * t * t * hgt;
          lp.x -= s * arc; lp.z += c * arc;
          // wind: local flutter plus gust fronts rolling across the meadow
          float gust = smoothstep(0.45, 1.0, 0.5 + 0.5 * sin(dot(wp, uWindDir) * 0.21 - uTime * (1.0 + uWind * 1.5)) + (htNoise(wp * 0.06 - uWindDir * uTime * 0.5) - 0.5) * 0.7);
          float sway = sin(uTime * 1.7 + wp.x * 0.35 + wp.y * 0.28) * 0.5 + sin(uTime * 3.1 + wp.x * 1.3) * 0.18 + 0.35;
          float bend = ((0.06 + uWind * 0.26) * sway + gust * uWind * 0.6) * t * t * (1.0 - press);
          lp.xz += uWindDir * bend * hgt * 2.2 + away * press * t * hgt * 1.1;
          lp.y -= (bend * bend * 0.8 + press * 0.25 * t) * hgt;
          vec3 transformed = vec3(wp.x, htTerrain(wp), wp.y) + lp;
          vGrassT = t; vGrassShade = rnd; vDry = dry; vPushAO = press; vGust = gust * uWind;
          vFlower = flower * (0.05 + 0.95 * htHash(base * 1.37 + 4.4));
        `);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying float vGrassT; varying float vGrassShade; varying float vDry; varying float vFlower; varying float vPushAO; varying float vGust;
        uniform vec3 uSunView; uniform vec3 uSunCol;`)
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal); // both blade faces take the sky light')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 lush = mix(vec3(0.095, 0.22, 0.04), vec3(0.165, 0.315, 0.058), vGrassShade);
          vec3 dryc = mix(vec3(0.29, 0.32, 0.095), vec3(0.39, 0.38, 0.15), vGrassShade);
          vec3 gBase = mix(lush, dryc, vDry * (0.45 + 0.4 * vGrassShade));
          vec3 tipC = gBase * 1.2 + vec3(0.03, 0.04, 0.0) + vGust * vec3(0.03, 0.04, 0.015);
          diffuseColor.rgb = mix(gBase * 0.55, tipC, smoothstep(0.0, 0.9, vGrassT)) * (1.0 - vPushAO * 0.35);
          if (vFlower > 0.0 && vGrassT > 0.72) diffuseColor.rgb = vFlower < 0.45 ? vec3(0.92, 0.9, 0.82) : (vFlower < 0.8 ? vec3(0.93, 0.74, 0.12) : vec3(0.6, 0.4, 0.82));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // sunlight through the blades when looking toward the sun
          totalEmissiveRadiance += diffuseColor.rgb * uSunCol * pow(max(0.0, dot(normalize(-vViewPosition), uSunView)), 4.0) * smoothstep(0.2, 1.0, vGrassT);`);
    };
    mat.customProgramCacheKey = () => 'ht3d-grass2-' + this.pushMax;
    this.grass = new THREE.Mesh(ig, mat);
    this.grass.frustumCulled = false; this.grass.receiveShadow = true;
    this.group.add(this.grass);
  }
  vegMaterial(sway) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, envMapIntensity: 0.45 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.treeU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float hh = max(position.y - ${sway < 1 ? '0.2' : '2.5'}, 0.0) * ${sway.toFixed(2)};
          vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float gst = 0.6 + 0.4 * sin(uTime * 0.7 + ip.x * 0.02 + ip.z * 0.015);
          transformed.x += (sin(uTime * 1.3 + ip.x * 0.1) * 0.025 + 0.02 * uWind) * hh * (0.4 + uWind) * gst;
          transformed.z += cos(uTime * 1.1 + ip.z * 0.13) * hh * 0.018 * (0.4 + uWind) * gst;
          transformed.y += sin(uTime * 2.3 + position.x * 3.0 + ip.z) * hh * 0.004 * uWind;`);
    };
    mat.customProgramCacheKey = () => 'ht3d-veg' + sway;
    return mat;
  }
  buildTrees(q) {
    const rr = new RNG(4242);
    this.treeU = { uTime: { value: 0 }, uWind: { value: 0.4 } };
    const n = q === 'low' ? { b: 60, c: 26, s: 50, f: 220 } : q === 'ultra' ? { b: 180, c: 80, s: 170, f: 560 } : { b: 120, c: 52, s: 110, f: 380 };
    const meshes = {
      b: new THREE.InstancedMesh(makeBroadleaf(11), this.vegMaterial(1), n.b),
      c: new THREE.InstancedMesh(makeConifer(23), this.vegMaterial(1), n.c),
      s: new THREE.InstancedMesh(makeBush(37), this.vegMaterial(0.45), n.s),
      f: new THREE.InstancedMesh(makeFarTree(), this.vegMaterial(1), n.f)
    };
    const cnt = { b: 0, c: 0, s: 0, f: 0 };
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), col = new THREE.Color();
    const place = (kind, x, z, s, sy) => {
      if (cnt[kind] >= n[kind]) return false;
      qq.setFromAxisAngle(UP, rr.range(0, TAU));
      m4.compose(new V3(x, terrainHeight(x, z) - 0.15, z), qq, new V3(s, s * sy, s));
      const i = cnt[kind]++;
      meshes[kind].setMatrixAt(i, m4);
      // per-plant tint: a few yellower or bluer individuals among the greens
      col.setHSL(rr.range(-0.025, 0.035), rr.range(0, 0.18), 1).lerp(new THREE.Color(1, 1, 1), 0.55);
      col.multiplyScalar(rr.range(0.85, 1.12));
      meshes[kind].setColorAt(i, col);
      return true;
    };
    // tree clusters around the open testing ground (nothing within 46 m of the centre)
    const clusters = [];
    for (let i = 0; i < 17; i++) { const a = rr.range(0, TAU), d = rr.range(54, 200); clusters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, sp: rr.range(6, 13), con: rr.next() < 0.35 ? rr.range(0.4, 0.8) : rr.range(0, 0.2) }); }
    let guard = 0;
    while ((cnt.b < n.b * 0.88 || cnt.c < n.c) && guard++ < 4000) {
      const c = clusters[guard % clusters.length];
      const x = c.x + rr.normal(0, c.sp), z = c.z + rr.normal(0, c.sp);
      if (Math.hypot(x, z) < 46) continue;
      if (rr.next() < c.con) place('c', x, z, rr.range(0.8, 1.35), rr.range(0.9, 1.25));
      else place('b', x, z, rr.range(0.75, 1.5), rr.range(0.85, 1.25));
      if (rr.next() < 0.45) { const a = rr.range(0, TAU), d = c.sp * rr.range(0.9, 1.6); const bx = c.x + Math.cos(a) * d, bz = c.z + Math.sin(a) * d; if (Math.hypot(bx, bz) > 44) place('s', bx, bz, rr.range(0.7, 1.4), rr.range(0.7, 1.1)); }
    }
    guard = 0;
    while (cnt.b < n.b && guard++ < 2000) { const a = rr.range(0, TAU), d = rr.range(60, 260); place('b', Math.cos(a) * d, Math.sin(a) * d, rr.range(0.9, 1.6), rr.range(0.9, 1.2)); }
    guard = 0;
    while (cnt.s < n.s && guard++ < 2000) { const a = rr.range(0, TAU), d = rr.range(48, 230); place('s', Math.cos(a) * d, Math.sin(a) * d, rr.range(0.6, 1.3), rr.range(0.7, 1.1)); }
    // distant tree line in bands with gaps (cheap single-lump trees, mostly lost in the haze)
    guard = 0;
    while (cnt.f < n.f && guard++ < 20000) {
      const a = rr.range(0, TAU);
      if (fbm2(Math.cos(a) * 2.5 + 20, Math.sin(a) * 2.5 + 20, 3) < 0.45) continue;
      const d = rr.range(250, 430);
      place('f', Math.cos(a) * d, Math.sin(a) * d, rr.range(1.0, 1.9), rr.range(0.8, 1.3));
    }
    for (const k of Object.keys(meshes)) {
      const im = meshes[k];
      im.count = cnt[k]; im.castShadow = false; im.receiveShadow = false;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.group.add(im);
    }
    this.trees = meshes.b; this.vegMeshes = meshes;
  }
  buildHills() {
    const ring = (radius, base, amp, freq, seed) => {
      const g = new THREE.CylinderGeometry(radius, radius, 1, 128, 6, true);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
        const a = Math.atan2(z, x);
        const h = base + amp * fbm2(Math.cos(a) * freq + seed, Math.sin(a) * freq + seed, 4) + amp * 0.35 * Math.sin(a * 5.0 + seed);
        p.setY(i, y > 0 ? h : -25);
      }
      g.computeVertexNormals();
      return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x5f7a55, side: THREE.BackSide }));
    };
    this.hills = ring(900, 40, 60, 3, 10);
    this.hillsNear = ring(520, 8, 30, 4.5, 31);
    this.group.add(this.hills); this.group.add(this.hillsNear);
  }
  buildRain() {
    const N = 2400;
    const pos = new Float32Array(N * 6);
    const rr = new RNG(99);
    this.rainData = [];
    for (let i = 0; i < N; i++) this.rainData.push([rr.range(-25, 25), rr.range(0, 22), rr.range(-25, 25), rr.range(14, 20)]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xa8b8c8, transparent: true, opacity: 0.45, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = false;
    this.group.add(this.rain);
  }
  // sky-lit ambient + reflections: the current sky (and a dark ground) captured into a prefiltered env map
  buildSkyEnv(day) {
    const r = this.game.renderer;
    if (!this.envScene) {
      this.envScene = new THREE.Scene();
      this.envSky = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.sky.material);
      this.envSky.scale.setScalar(200); this.envSky.frustumCulled = false;
      this.envSky.onBeforeRender = (rr) => this.syncSkyFog(rr);
      this.envScene.add(this.envSky);
      this.envGround = new THREE.Mesh(new THREE.CircleGeometry(150, 24), new THREE.MeshBasicMaterial({ color: 0x3b4a2a }));
      this.envGround.rotation.x = -Math.PI / 2; this.envGround.position.y = -2;
      this.envScene.add(this.envGround);
    }
    this.envGround.material.color.set(0x41522c).multiplyScalar(lerp(0.06, 1, day));
    const su = this.sky.material.uniforms, disk = su.uDisk.value;
    su.uDisk.value = 0.03; // keep the sun disk from blowing out the prefiltered map
    try {
      const pm = new THREE.PMREMGenerator(r);
      const rt = pm.fromScene(this.envScene, 0, 0.5, 600);
      pm.dispose();
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt;
      this.game.scene.environment = rt.texture;
    } catch (e) { reportError(e, 'sky env'); this.game.scene.environment = null; }
    su.uDisk.value = disk;
  }
  applyTimeWeather() {
    const P = Settings.data.environment.field;
    const t = clamp(P.timeOfDay, 0, 24);
    const W = P.weather;
    // astronomical sun path for a mid-latitude summer day (+X east, -Z north):
    // sunrise ~04:35, sun high in the south at noon (behind the default view), sunset ~19:25
    const ha = (t - 12) / 12 * Math.PI, lat = 45 * DEG, dec = 20 * DEG;
    const dir = new V3(
      -Math.cos(dec) * Math.sin(ha),
      Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(ha) * Math.cos(lat),
      -(Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.cos(ha) * Math.sin(lat))).normalize();
    this.sunDir.copy(dir);
    const cloud = { clear: 0.0, cloudy: 0.35, overcast: 0.85, rain: 0.92, fog: 0.6 }[W] || 0;
    this.cloudCover = cloud;
    const day = smoothstep(-0.05, 0.15, dir.y);
    const night = 1 - smoothstep(-0.21, -0.02, dir.y); // civil -> nautical twilight
    this.dayK = day;
    const su = this.sky.material.uniforms;
    su.sunPosition.value.copy(dir).multiplyScalar(400000);
    const warmSky = 1 - smoothstep(0.05, 0.45, dir.y);
    su.turbidity.value = lerp(2.2, 9, cloud); su.rayleigh.value = lerp(1.0, 0.6, cloud) + (1 - day) * 1.0 + warmSky * 0.8;
    su.uGain.value = 0.58; su.uSat.value = lerp(2.1, 1.0, cloud);
    su.mieCoefficient.value = lerp(0.004, 0.02, cloud); su.mieDirectionalG.value = 0.82;
    su.uCloud.value = cloud; su.uNight.value = night;
    const warm = 1 - smoothstep(0.05, 0.45, dir.y);
    const sunCol = new THREE.Color(0xfff4e6).lerp(new THREE.Color(0xff9a50), warm * 0.85);
    const sunI = day * lerp(3.2, 0.5, cloud);
    if (night > 0.5) { // moonlight
      this.sun.color.set(0x8fa6d6); this.sun.intensity = 0.28 * (1 - cloud * 0.7);
      this.sun.position.copy(dir).multiplyScalar(-1); this.sun.position.y = Math.abs(this.sun.position.y) + 0.4;
    } else {
      this.sun.color.copy(sunCol); this.sun.intensity = sunI;
      this.sun.position.copy(dir);
    }
    this.sun.position.normalize().multiplyScalar(90);
    this.sunOffset = this.sun.position.clone();
    const skyCol = new THREE.Color(0x9ec6ff).lerp(new THREE.Color(0xb7bcc4), cloud).lerp(new THREE.Color(0x1a2438), night);
    this.hemi.color.copy(skyCol); this.hemi.groundColor.set(0x4d5f33).lerp(new THREE.Color(0x10140c), night);
    // the sky env map now carries much of the ambient; the hemisphere fill stays for the grass
    this.hemi.intensity = lerp(0.95, 1.3, cloud) * lerp(1, 0.35, night) * 0.72;
    const fogCol = new THREE.Color(0xc4d6ea).lerp(new THREE.Color(0xb3b8bf), cloud).lerp(new THREE.Color(0xe0a070), warm * day * 0.35 * (1 - cloud)).lerp(new THREE.Color(0x0a0e16), night);
    const dens = W === 'fog' ? 0.035 : W === 'rain' ? 0.012 : W === 'overcast' ? 0.006 : 0.0024;
    this.game.scene.fog = new THREE.FogExp2(fogCol, dens);
    this.fogColor.copy(fogCol);
    su.uHorizon.value = W === 'fog' ? 1.0 : 0.88;
    this.game.scene.background = null;
    // layered haze: near hills keep more colour than the far range
    this.hillsNear.material.color.set(0x56724a).lerp(fogCol, 0.42);
    this.hills.material.color.set(0x5f7a55).lerp(fogCol, 0.62);
    for (const c of this.clouds.children) {
      c.material.opacity = clamp(0.25 + cloud * 0.9, 0, 0.95) * (W === 'clear' ? 0.6 : 1);
      c.material.color.set(0xffffff).lerp(new THREE.Color(0x8d939b), cloud * 0.7).lerp(new THREE.Color(0x202634), night);
    }
    this.rain.visible = W === 'rain';
    this.wet = W === 'rain' ? 1 : 0;
    this.groundMat.roughness = W === 'rain' ? 0.55 : 0.93;
    this.game.renderer.toneMappingExposure = lerp(0.82, 1.05, cloud) * lerp(1, 1.8, night);
    this.windStrength = P.wind;
    // blades glow when back-lit by a low, clear sun
    this.sunGlow = sunCol.clone().multiplyScalar(day * (1 - cloud * 0.85) * 0.55);
    this.buildSkyEnv(day);
  }
  groundHeight(x, z) { return terrainHeight(x, z); }
  groundNormal(x, z, out) {
    const e = 0.15;
    const hx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
    const hz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }
  // nearest bodies / feet flatten the grass around them (6-16 pressure points by quality)
  updateGrassPush(cam) {
    const P = this.grassU.uPush.value, R = this.grassR;
    const cand = this._cand || (this._cand = []); cand.length = 0;
    const add = (x, z, r, w) => { const d = Math.hypot(x - cam.position.x, z - cam.position.z); if (d < R + 1 && w > 0.02) cand.push(x, z, r, w, d); };
    for (const npc of this.game.npcs.list) {
      if (npc.removed) continue;
      const S = npc.rig.H / 1.75;
      if (npc.physMode === 'ragdoll') {
        for (const bi of [RAG.CHEST, RAG.PELVIS, RAG.HEAD, RAG.SHIN_L, RAG.SHIN_R]) {
          const b = npc.rag.bodies[bi]; const h = b.pos.y - terrainHeight(b.pos.x, b.pos.z);
          add(b.pos.x, b.pos.z, (bi === RAG.CHEST || bi === RAG.PELVIS ? 0.42 : 0.26) * S, 1 - smoothstep(0.2, 0.7, h));
        }
      } else {
        for (const fb of [B.foot_L, B.foot_R]) { const f = npc.boneWPos[fb]; add(f.x, f.z, 0.2 * S, 0.85 * (1 - smoothstep(0.12, 0.4, f.y - terrainHeight(f.x, f.z)))); }
      }
    }
    for (const p of this.game.props.list) { const b = p.body; if (b) add(b.pos.x, b.pos.z, (p.radius || 0.3) * 1.3, 1 - smoothstep(0.3, 1.0, b.pos.y - terrainHeight(b.pos.x, b.pos.z) - (p.radius || 0.3))); }
    const n = cand.length / 5;
    // keep the closest to the camera when there are too many
    const order = this._ord || (this._ord = []); order.length = 0;
    for (let i = 0; i < n; i++) order.push(i);
    const M = this.pushMax;
    if (n > M) order.sort((a, b) => cand[a * 5 + 4] - cand[b * 5 + 4]);
    for (let i = 0; i < M; i++) {
      if (i < n) { const k = order[i] * 5; P[i].set(cand[k], cand[k + 1], cand[k + 2], cand[k + 3]); } else P[i].set(0, 0, 0, 0);
    }
    this.grassU.uPushN.value = Math.min(n, M);
  }
  update(dt, cam) {
    this.time += dt;
    const w = Settings.data.environment.field.wind;
    if (this.grassU) {
      this.grassU.uTime.value = this.time; this.grassU.uWind.value = w;
      this.fieldU.uCenter.value.set(cam.position.x, cam.position.z);
      this.grassU.uWindDir.value.set(this.windDir.x, this.windDir.z);
      this.grassU.uSunView.value.copy(this.sunDir).transformDirection(cam.matrixWorldInverse);
      if (this.sunGlow) this.grassU.uSunCol.value.copy(this.sunGlow);
      this.updateGrassPush(cam);
    }
    if (this.treeU) { this.treeU.uTime.value = this.time; this.treeU.uWind.value = w; }
    this.sky.material.uniforms.uTime.value = this.time;
    this.sky.position.copy(cam.position);
    // shadow follows camera focus
    const fx = cam.position.x, fz = cam.position.z;
    const snap = 2;
    const tx = Math.round(fx / snap) * snap, tz = Math.round(fz / snap) * snap;
    this.sun.target.position.set(tx, 0, tz);
    this.sun.position.set(tx + this.sunOffset.x, this.sunOffset.y, tz + this.sunOffset.z);
    // clouds drift
    for (const c of this.clouds.children) {
      c.position.x += this.windDir.x * dt * (2 + w * 8) * c.userData.speed;
      c.position.z += this.windDir.z * dt * (2 + w * 8) * c.userData.speed;
      if (c.position.x > 950) c.position.x -= 1900; if (c.position.z > 950) c.position.z -= 1900;
    }
    if (this.rain.visible) {
      const arr = this.rain.geometry.attributes.position.array;
      const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
      const slant = 0.15 + w * 0.5;
      for (let i = 0; i < this.rainData.length; i++) {
        const r = this.rainData[i];
        r[1] -= r[3] * dt;
        if (r[1] < -2) r[1] += 24;
        const x = cx + r[0], y = cy + r[1] - 8, z = cz + r[2];
        arr[i * 6] = x; arr[i * 6 + 1] = y; arr[i * 6 + 2] = z;
        arr[i * 6 + 3] = x - this.windDir.x * slant * 0.6; arr[i * 6 + 4] = y + 0.55; arr[i * 6 + 5] = z - this.windDir.z * slant * 0.6;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
  }
  dispose() {
    this.game.scene.remove(this.group);
    disposeObject(this.group);
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
    if (this.envScene) { this.envSky.geometry.dispose(); this.envGround.geometry.dispose(); this.envGround.material.dispose(); this.envScene = null; }
    this.game.scene.environment = null;
    this.group = new THREE.Group();
    this.game.scene.fog = null;
  }
}
function paintGeo(geo, color) {
  const n = geo.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = 0.9 + 0.2 * hash2(i, 3); c[i * 3] = color.r * v; c[i * 3 + 1] = color.g * v; c[i * 3 + 2] = color.b * v; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
}
function mergeGeos(geos) {
  let vCount = 0, iCount = 0;
  const gs = geos.map(g => g.index ? g.toNonIndexed() : g);
  for (const g of gs) vCount += g.attributes.position.count;
  const pos = new Float32Array(vCount * 3), col = new Float32Array(vCount * 3);
  const hasN = gs.every(g => g.attributes.normal), nor = hasN ? new Float32Array(vCount * 3) : null;
  let o = 0;
  for (const g of gs) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    if (hasN) nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (hasN) out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// ----------------------------------------------------------------------------
class EnvironmentManager {
  constructor(game) { this.game = game; this.current = null; this.envs = {}; }
  get() { return this.current; }
  load(kind) {
    if (this.current) { this.current.dispose(); }
    const env = kind === 'field' ? new FieldEnvironment(this.game) : new RoomEnvironment(this.game);
    env.build();
    this.game.scene.add(env.group);
    this.current = env;
    Settings.set('environment.current', env.kind, true);
    Events.emit('environment', env);
    return env;
  }
  groundHeight(x, z) { return this.current ? this.current.groundHeight(x, z) : 0; }
  groundNormal(x, z, out) { return this.current ? this.current.groundNormal(x, z, out) : out.set(0, 1, 0); }
  clampToBounds(p, margin = 0) {
    const b = this.current.bounds;
    p.x = clamp(p.x, b.minX + margin, b.maxX - margin); p.z = clamp(p.z, b.minZ + margin, b.maxZ - margin);
    return p;
  }
  update(dt, cam) { if (this.current) this.current.update(dt, cam); }
}
HT.EnvironmentManager = EnvironmentManager;
