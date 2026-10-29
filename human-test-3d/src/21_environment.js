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
    const tiles = { floor: Tex.tile('floor'), wall: Tex.tile('wall'), ceiling: Tex.tile('ceiling') };
    const mk = (kind, w, h, tileSize, rough) => {
      const t = tiles[kind];
      const map = t.map.clone(); map.needsUpdate = true; map.repeat.set(w / tileSize, h / tileSize);
      const rm = t.rough.clone(); rm.needsUpdate = true; rm.repeat.copy(map.repeat);
      map.anisotropy = rm.anisotropy = this.game.maxAniso || 4;
      return new THREE.MeshStandardMaterial({ map, roughnessMap: rm, roughness: rough, metalness: 0, envMapIntensity: 0.55 });
    };
    // floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mk('floor', W, D, 2, 0.55));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'floor';
    g.add(floor);
    // walls
    const wallMat = mk('wall', W, Ht, 2, 1.0);
    const wallMatD = mk('wall', D, Ht, 2, 1.0);
    const addWall = (w, mat, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, Ht), mat);
      m.position.set(x, Ht / 2, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m);
    };
    addWall(W, wallMat, 0, -D / 2, 0);
    addWall(W, wallMat, 0, D / 2, Math.PI);
    addWall(D, wallMatD, -W / 2, 0, Math.PI / 2);
    addWall(D, wallMatD, W / 2, 0, -Math.PI / 2);
    // ceiling
    const ceilMat = mk('ceiling', W, D, 2, 1.0);
    ceilMat.emissive = new THREE.Color(0xffffff); ceilMat.emissiveMap = ceilMat.map; ceilMat.emissiveIntensity = 0.42;
    this.ceilMat = ceilMat;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = Ht; g.add(ceil);
    // skirting shadow strip (fake AO at wall base) + corner AO
    const aoTex = Tex.make('aoStrip', 8, 64, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }, { clamp: true });
    const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, toneMapped: false });
    const addAO = (len, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), aoMat);
      m.rotation.order = 'YXZ'; m.rotation.y = ry; m.rotation.x = -Math.PI / 2; m.position.set(x, 0.003, z);
      g.add(m);
    };
    addAO(W, 0, -D / 2 + 0.45, 0); addAO(W, 0, D / 2 - 0.45, Math.PI); addAO(D, -W / 2 + 0.45, 0, -Math.PI / 2); addAO(D, W / 2 - 0.45, 0, Math.PI / 2);
    // light panels on ceiling
    const lightCol = kelvinToRGB(P.colorTemp);
    const panelGeo = new THREE.PlaneGeometry(1.6, 0.5);
    const panelMat = new THREE.MeshBasicMaterial({ color: lightCol.clone().multiplyScalar(2.2 * clamp(P.light, 0.2, 2)), toneMapped: true });
    this.panelMat = panelMat;
    const nx = Math.max(2, Math.floor(W / 4)), nz = Math.max(2, Math.floor(D / 4));
    const panels = new THREE.InstancedMesh(panelGeo, panelMat, nx * nz);
    let k = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(LEFT, Math.PI / 2);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = (i + 0.5) / nx * W - W / 2, z = (j + 0.5) / nz * D - D / 2;
      m4.compose(new V3(x, Ht - 0.01, z), q, new V3(1, 1, 1)); panels.setMatrixAt(k++, m4);
    }
    g.add(panels);
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
    sunPosition: { value: new V3() }, up: { value: new V3(0, 1, 0) }, uCloud: { value: 0 }, uNight: { value: 0 }, uTime: { value: 0 }, uGain: { value: 1 }, uSat: { value: 1 }
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
      L0 += (vSunE * 19000.0 * Fex) * sundisk * (1.0 - uCloud * 0.95);
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
    }`
};

class FieldEnvironment {
  constructor(game) {
    this.game = game; this.kind = 'field'; this.name = 'Sunny Grassy Field'; this.surface = 'grass';
    this.group = new THREE.Group(); this.group.name = 'field';
    this.planes = []; this.spawnPoints = []; this.reverb = 'field';
    this.half = 95;
    this.bounds = { minX: -this.half + 2, maxX: this.half - 2, minZ: -this.half + 2, maxZ: this.half - 2 };
    this.time = 0; this.windDir = new V3(1, 0, 0.3).normalize();
    this.sunDir = new V3(0, 1, 0);
  }
  build() {
    const g = this.group;
    const P = Settings.data.environment.field;
    const q = Settings.data.graphics.preset;
    // sky
    const skyMat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms), vertexShader: SkyShader.vertexShader, fragmentShader: SkyShader.fragmentShader, side: THREE.BackSide, depthWrite: false });
    this.sky = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), skyMat);
    this.sky.scale.setScalar(4000); this.sky.frustumCulled = false;
    g.add(this.sky);
    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 3.0);
    this.sun.castShadow = true;
    const sq = Settings.data.graphics.shadowQuality;
    const size = sq === 'ultra' ? 4096 : sq === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    const sc = this.sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 220;
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 2.5;
    this.sun.castShadow = sq !== 'off';
    g.add(this.sun); g.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x55683a, 0.9);
    g.add(this.hemi);
    // terrain
    const T = 640, seg = q === 'low' ? 96 : 160;
    const tg = new THREE.PlaneGeometry(T, T, seg, seg);
    tg.rotateX(-Math.PI / 2);
    const pos = tg.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
      const n = fbm2(x * 0.02 + 40, z * 0.02, 3);
      cols[i * 3] = 0.85 + n * 0.3; cols[i * 3 + 1] = 0.95 + n * 0.15; cols[i * 3 + 2] = 0.85 + n * 0.2;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    tg.computeVertexNormals();
    const gt = Tex.grass().clone(); gt.needsUpdate = true; gt.repeat.set(T / 6, T / 6); gt.anisotropy = this.game.maxAniso || 4;
    this.groundMat = new THREE.MeshStandardMaterial({ map: gt, vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.4 });
    this.terrain = new THREE.Mesh(tg, this.groundMat);
    this.terrain.receiveShadow = true; this.terrain.name = 'terrain';
    g.add(this.terrain);
    // grass blades
    this.buildGrass(q);
    // trees + distant hills
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
    // rain
    this.buildRain();
    // physics: heightfield ground + invisible boundary walls
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
  buildGrass(q) {
    const count = q === 'low' ? 15000 : q === 'ultra' ? 72000 : 38000;
    const R = q === 'low' ? 14 : q === 'ultra' ? 26 : 19;
    this.grassR = R;
    const blade = new THREE.BufferGeometry();
    const segs = 4, verts = [], uvs = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, w = 0.026 * (1 - t * 0.8);
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
    this.grassU = { uCenter: { value: new THREE.Vector2() }, uTime: { value: 0 }, uWind: { value: 0.4 }, uWindDir: { value: new THREE.Vector2(1, 0.3) }, uR: { value: R }, uBlade: { value: 0.27 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.grassU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        attribute vec4 aOff; uniform vec2 uCenter; uniform float uTime; uniform float uWind; uniform vec2 uWindDir; uniform float uR; uniform float uBlade;
        varying float vGrassT; varying float vGrassShade;
        ${GLSL_TERRAIN}`)
        .replace('#include <begin_vertex>', `
          vec2 base = aOff.xy;
          vec2 wp = base + 2.0 * uR * floor((uCenter - base) / (2.0 * uR) + 0.5);
          float dist = length(wp - uCenter);
          float fade = 1.0 - smoothstep(uR * 0.72, uR, dist);
          float hgt = uBlade * aOff.w * fade;
          float c = cos(aOff.z), s = sin(aOff.z);
          vec3 lp = vec3(position.x * c, position.y * hgt, position.x * s);
          float t = position.y;
          float sway = sin(uTime * 1.7 + wp.x * 0.35 + wp.y * 0.28) * 0.5 + sin(uTime * 3.1 + wp.x * 1.3) * 0.18 + 0.35;
          float bend = (0.08 + uWind * 0.32) * sway * t * t;
          lp.xz += uWindDir * bend * hgt * 2.2;
          lp.y -= bend * bend * hgt * 0.8;
          vec3 transformed = vec3(wp.x, htTerrain(wp), wp.y) + lp;
          vGrassT = t;
          vGrassShade = fract(sin(dot(base, vec2(12.9898, 78.233))) * 43758.5453);
        `)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGrassT; varying float vGrassShade;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 gBase = mix(vec3(0.10, 0.20, 0.045), vec3(0.20, 0.32, 0.08), vGrassShade);
          gBase = mix(gBase, vec3(0.30, 0.30, 0.10), step(0.86, vGrassShade) * 0.6);
          diffuseColor.rgb = mix(gBase * 0.62, gBase * 1.2 + vec3(0.03, 0.05, 0.0), vGrassT);`);
    };
    mat.customProgramCacheKey = () => 'ht3d-grass';
    this.grass = new THREE.Mesh(ig, mat);
    this.grass.frustumCulled = false; this.grass.receiveShadow = true;
    this.group.add(this.grass);
  }
  buildTrees(q) {
    const rr = new RNG(4242);
    // merged low-poly tree geometry with vertex colors
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.18, 0.32, 4.2, 7, 1); trunk.translate(0, 2.1, 0);
    paintGeo(trunk, new THREE.Color(0x4a3524));
    parts.push(trunk);
    for (let i = 0; i < 4; i++) {
      const ico = new THREE.IcosahedronGeometry(1.6 + i * 0.25 - (i === 3 ? 0.6 : 0), 1);
      const p = ico.attributes.position;
      for (let k = 0; k < p.count; k++) { const n = 1 + (hash2(k * 3 + i, k * 7) - 0.5) * 0.35; p.setXYZ(k, p.getX(k) * n, p.getY(k) * n * 0.85, p.getZ(k) * n); }
      const nrm = new Float32Array(p.count * 3);
      for (let k = 0; k < p.count; k++) { _v1.set(p.getX(k), p.getY(k) / 0.85, p.getZ(k)).normalize(); nrm[k * 3] = _v1.x; nrm[k * 3 + 1] = _v1.y; nrm[k * 3 + 2] = _v1.z; }
      ico.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      const off = [[0, 5.0, 0], [0.9, 4.2, 0.4], [-0.8, 4.4, -0.5], [0.1, 6.0, 0.1]][i];
      ico.translate(off[0], off[1], off[2]);
      paintGeo(ico, new THREE.Color().setHSL(0.27 + i * 0.012, 0.45, 0.19 + i * 0.02));
      { // fake canopy occlusion: darker underneath and inside the crown
        const c = ico.attributes.color, pp = ico.attributes.position;
        for (let k = 0; k < c.count; k++) { const ao = 0.55 + 0.45 * smoothstep(off[1] - 1.4, off[1] + 1.2, pp.getY(k)); c.setXYZ(k, c.getX(k) * ao, c.getY(k) * ao, c.getZ(k) * ao); }
      }
      parts.push(ico);
    }
    const geo = mergeGeos(parts);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const count = q === 'low' ? 90 : q === 'ultra' ? 260 : 170;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
    this.treeU = { uTime: { value: 0 }, uWind: { value: 0.4 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.treeU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float hh = max(position.y - 2.5, 0.0);
          vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          transformed.x += sin(uTime * 1.3 + ip.x * 0.1) * hh * 0.025 * (0.4 + uWind);
          transformed.z += cos(uTime * 1.1 + ip.z * 0.13) * hh * 0.018 * (0.4 + uWind);`);
    };
    mat.customProgramCacheKey = () => 'ht3d-tree';
    const im = new THREE.InstancedMesh(geo, mat, count);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
    let n = 0, guard = 0;
    // clusters
    const clusters = [];
    for (let i = 0; i < 18; i++) { const a = rr.range(0, TAU), d = rr.range(55, 210); clusters.push([Math.cos(a) * d, Math.sin(a) * d]); }
    while (n < count && guard++ < count * 10) {
      const c = clusters[n % clusters.length];
      const x = c[0] + rr.normal(0, 9), z = c[1] + rr.normal(0, 9);
      if (Math.hypot(x, z) < 45) continue;
      const s = rr.range(0.8, 1.6);
      qq.setFromAxisAngle(UP, rr.range(0, TAU));
      m4.compose(new V3(x, terrainHeight(x, z) - 0.2, z), qq, new V3(s, s * rr.range(0.85, 1.3), s));
      im.setMatrixAt(n++, m4);
    }
    im.count = n;
    im.castShadow = false; im.receiveShadow = true;
    this.trees = im;
    this.group.add(im);
  }
  buildHills() {
    const g = new THREE.CylinderGeometry(900, 900, 1, 96, 6, true);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
      const a = Math.atan2(z, x);
      const h = 40 + 55 * fbm2(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10, 4) + 25 * Math.sin(a * 5.0);
      p.setY(i, y > 0 ? h : -20);
    }
    g.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({ color: 0x5f7a55, side: THREE.BackSide });
    this.hills = new THREE.Mesh(g, m);
    this.group.add(this.hills);
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
    this.hemi.intensity = lerp(0.95, 1.3, cloud) * lerp(1, 0.35, night);
    const fogCol = new THREE.Color(0xc4d6ea).lerp(new THREE.Color(0xb3b8bf), cloud).lerp(new THREE.Color(0xe0a070), warm * day * 0.35 * (1 - cloud)).lerp(new THREE.Color(0x0a0e16), night);
    const dens = W === 'fog' ? 0.035 : W === 'rain' ? 0.012 : W === 'overcast' ? 0.006 : 0.0022;
    this.game.scene.fog = new THREE.FogExp2(fogCol, dens);
    this.game.scene.background = null;
    this.hills.material.color.set(0x5f7a55).lerp(fogCol, 0.55);
    for (const c of this.clouds.children) {
      c.material.opacity = clamp(0.25 + cloud * 0.9, 0, 0.95) * (W === 'clear' ? 0.6 : 1);
      c.material.color.set(0xffffff).lerp(new THREE.Color(0x8d939b), cloud * 0.7).lerp(new THREE.Color(0x202634), night);
    }
    this.rain.visible = W === 'rain';
    this.wet = W === 'rain' ? 1 : 0;
    this.groundMat.roughness = W === 'rain' ? 0.55 : 0.95;
    this.game.renderer.toneMappingExposure = lerp(0.82, 1.05, cloud) * lerp(1, 1.8, night);
    this.windStrength = P.wind;
  }
  groundHeight(x, z) { return terrainHeight(x, z); }
  groundNormal(x, z, out) {
    const e = 0.15;
    const hx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
    const hz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }
  update(dt, cam) {
    this.time += dt;
    const w = Settings.data.environment.field.wind;
    if (this.grassU) {
      this.grassU.uTime.value = this.time; this.grassU.uWind.value = w;
      this.grassU.uCenter.value.set(cam.position.x, cam.position.z);
      this.grassU.uWindDir.value.set(this.windDir.x, this.windDir.z);
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
