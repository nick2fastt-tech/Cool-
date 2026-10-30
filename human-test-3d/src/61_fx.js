// ============================================================================
// Effects: particles (pooled point sprites), decals, tracers, shell casings,
// explosion flash/shockwave. Non-graphic by design (dust/fabric puffs only).
// ============================================================================
class ParticleSystem {
  constructor(scene, max, additive, tex) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max); this.col = new Float32Array(max * 3);
    this.g = new Float32Array(max); this.drag = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos); geo.setAttribute('aCol', this.aCol); geo.setAttribute('aSize', this.aSize); geo.setAttribute('aAlpha', this.aAlpha);
    geo.boundingSphere = new THREE.Sphere(new V3(), 1e5);
    this.uniforms = { map: { value: tex }, uScale: { value: 400 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec3 aCol; attribute float aSize; attribute float aAlpha; uniform float uScale; varying vec3 vCol; varying float vA;
        void main() { vCol = aCol; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uScale / max(0.05, -mv.z), 1.0, 512.0); }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vCol; varying float vA;
        void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vCol * t.rgb, t.a * vA); if (gl_FragColor.a < 0.004) discard;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false; this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag) {
    let i;
    if (this.n < this.max) i = this.n++;
    else { i = Math.floor(Math.random() * this.max); }
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; this.a0[i] = a; this.g[i] = grav || 0; this.drag[i] = drag || 0;
  }
  update(dt, groundFn) {
    let w = 0;
    const P = this.aPos.array, Cc = this.aCol.array, S = this.aSize.array, A = this.aAlpha.array;
    for (let i = 0; i < this.n; i++) {
      let l = this.life[i] - dt;
      if (l <= 0) continue;
      const k = i * 3;
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.v[k] *= dr; this.v[k + 1] = this.v[k + 1] * dr - this.g[i] * dt; this.v[k + 2] *= dr;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      if (groundFn && this.g[i] > 0) { const gy = groundFn(this.p[k], this.p[k + 2]) + 0.01; if (this.p[k + 1] < gy) { this.p[k + 1] = gy; this.v[k + 1] *= -0.3; this.v[k] *= 0.6; this.v[k + 2] *= 0.6; } }
      // compact
      const t = 1 - l / this.maxLife[i];
      const o = w * 3;
      this.p[o] = this.p[k]; this.p[o + 1] = this.p[k + 1]; this.p[o + 2] = this.p[k + 2];
      this.v[o] = this.v[k]; this.v[o + 1] = this.v[k + 1]; this.v[o + 2] = this.v[k + 2];
      this.col[o] = this.col[k]; this.col[o + 1] = this.col[k + 1]; this.col[o + 2] = this.col[k + 2];
      this.life[w] = l; this.maxLife[w] = this.maxLife[i]; this.s0[w] = this.s0[i]; this.s1[w] = this.s1[i]; this.a0[w] = this.a0[i]; this.g[w] = this.g[i]; this.drag[w] = this.drag[i];
      P[o] = this.p[o]; P[o + 1] = this.p[o + 1]; P[o + 2] = this.p[o + 2];
      Cc[o] = this.col[o]; Cc[o + 1] = this.col[o + 1]; Cc[o + 2] = this.col[o + 2];
      S[w] = lerp(this.s0[w], this.s1[w], t);
      A[w] = this.a0[w] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
      w++;
    }
    this.n = w;
    this.points.geometry.setDrawRange(0, w);
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true; this.aAlpha.needsUpdate = true;
  }
  clear() { this.n = 0; this.points.geometry.setDrawRange(0, 0); }
}

class FX {
  constructor(game) {
    this.game = game; const sc = game.scene;
    this.smoke = new ParticleSystem(sc, 900, false, Tex.smoke());
    this.glow = new ParticleSystem(sc, 700, true, Tex.radial('glow', 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
    this.decals = []; this.maxDecals = 90;
    this.decalGeo = new THREE.PlaneGeometry(1, 1);
    this.holeMat = new THREE.MeshStandardMaterial({ map: Tex.bulletHole(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.9 });
    this.scorchMat = new THREE.MeshBasicMaterial({ map: Tex.scorch(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.tracers = [];
    for (let i = 0; i < 24; i++) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false }));
      l.frustumCulled = false; l.visible = false; sc.add(l);
      this.tracers.push({ line: l, life: 0, a: new V3(), b: new V3(), dir: new V3(), speed: 0, len: 0 });
    }
    // shells
    this.shellMax = 40;
    const sg = new THREE.CylinderGeometry(0.0045, 0.0045, 0.019, 8); sg.rotateZ(Math.PI / 2);
    this.shells = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ color: 0xc9a043, metalness: 0.9, roughness: 0.3 }), this.shellMax);
    this.shells.count = 0; this.shells.castShadow = false; this.shells.frustumCulled = false; sc.add(this.shells);
    this.shellData = [];
    // shockwave rings
    this.rings = [];
    const rg = new THREE.RingGeometry(0.85, 1.0, 48); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; sc.add(m); this.rings.push({ mesh: m, t: 0, max: 0 });
    }
    // shared flash light
    this.light = new THREE.PointLight(0xffc27a, 0, 12, 2);
    this.light.position.set(0, -100, 0);
    if (Settings.data.graphics.preset !== 'low') sc.add(this.light);
    this.lightT = 0; this.lightMax = 0;
  }
  ground(x, z) { return this.game.env.groundHeight(x, z); }
  flash(pos, intensity, dur, color) {
    this.light.position.copy(pos); this.light.color.set(color || 0xffc27a);
    this.lightMax = intensity; this.lightT = dur; this.lightDur = dur; this.light.intensity = intensity;
  }
  impactDust(p, n, surface, scale = 1) {
    const grass = surface === 'grass';
    const c = grass ? [0.42, 0.36, 0.26] : [0.78, 0.78, 0.8];
    for (let i = 0; i < 9 * scale; i++) {
      const d = _v1.set(n.x + (Math.random() - 0.5) * 1.2, n.y + (Math.random() - 0.5) * 1.2 + 0.2, n.z + (Math.random() - 0.5) * 1.2).normalize();
      const sp = 0.6 + Math.random() * 1.8;
      this.smoke.emit(p.x + n.x * 0.02, p.y + n.y * 0.02, p.z + n.z * 0.02, d.x * sp, d.y * sp, d.z * sp, 0.5 + Math.random() * 0.7, 0.04 * scale, (0.25 + Math.random() * 0.2) * scale, c[0], c[1], c[2], 0.55, 0.6, 2.5);
    }
    for (let i = 0; i < 5 * scale; i++) {
      const d = _v1.set(n.x + (Math.random() - 0.5) * 1.6, n.y + Math.random() * 0.8, n.z + (Math.random() - 0.5) * 1.6).normalize();
      const sp = 2 + Math.random() * 4;
      this.glow.emit(p.x, p.y, p.z, d.x * sp, d.y * sp, d.z * sp, 0.12 + Math.random() * 0.15, 0.02, 0.005, 1.0, 0.75, 0.45, 0.9, 9.8, 1);
    }
  }
  // soft dust where a falling body meets the ground (no sparks): dirt and grass bits outdoors, faint dust indoors
  bodyDust(p, n, surface, k) {
    const grass = surface === 'grass';
    const c = grass ? [0.4, 0.35, 0.25] : [0.86, 0.86, 0.88];
    const cnt = Math.round((grass ? 8 : 5) * k);
    for (let i = 0; i < cnt; i++) {
      const a = Math.random() * TAU, sp = 0.35 + Math.random() * 0.9 * k;
      this.smoke.emit(p.x + Math.cos(a) * 0.05, p.y + 0.02, p.z + Math.sin(a) * 0.05, Math.cos(a) * sp, 0.15 + Math.random() * 0.35, Math.sin(a) * sp, 0.6 + Math.random() * 0.6, 0.05, (0.22 + Math.random() * 0.18) * (0.6 + k * 0.6), c[0], c[1], c[2], grass ? 0.45 : 0.22, 0.25, 2.2);
    }
    if (grass) for (let i = 0; i < Math.round(4 * k); i++) { // flicked grass blades
      const a = Math.random() * TAU, sp = 0.8 + Math.random() * 1.4;
      this.smoke.emit(p.x, p.y + 0.03, p.z, Math.cos(a) * sp, 1 + Math.random() * 1.5, Math.sin(a) * sp, 0.5 + Math.random() * 0.4, 0.012, 0.012, 0.22, 0.36, 0.12, 0.9, 6, 1.2);
    }
  }
  fabricPuff(p, n, color) {
    const c = color || new THREE.Color(0.7, 0.7, 0.72);
    for (let i = 0; i < 7; i++) {
      const d = _v1.set(n.x + (Math.random() - 0.5), n.y + (Math.random() - 0.5) + 0.3, n.z + (Math.random() - 0.5)).normalize();
      const sp = 0.4 + Math.random() * 1.2;
      this.smoke.emit(p.x, p.y, p.z, d.x * sp, d.y * sp, d.z * sp, 0.4 + Math.random() * 0.4, 0.03, 0.14, lerp(c.r, 0.8, 0.5), lerp(c.g, 0.8, 0.5), lerp(c.b, 0.8, 0.5), 0.45, 0.2, 3);
    }
  }
  decal(p, n, size, kind) {
    let d;
    if (this.decals.length >= this.maxDecals) { d = this.decals.shift(); }
    else { d = new THREE.Mesh(this.decalGeo, this.holeMat); d.renderOrder = 1; this.game.scene.add(d); }
    d.material = kind === 'scorch' ? this.scorchMat : this.holeMat;
    d.position.copy(p).addScaledVector(n, 0.004);
    d.lookAt(_v1.copy(p).add(n));
    d.rotateZ(Math.random() * TAU);
    d.scale.set(size, size, 1);
    d.visible = true;
    this.decals.push(d);
  }
  tracer(from, dir, speed, len, color) {
    const t = this.tracers.find(x => x.life <= 0) || this.tracers[0];
    t.a.copy(from); t.dir.copy(dir); t.speed = speed; t.len = len; t.life = 0.35; t.dist = 0;
    t.line.material.color.set(color || 0xffe2a0); t.line.visible = true; t.maxDist = 400;
    return t;
  }
  stopTracer(t, at) { if (t) t.maxDist = Math.min(t.maxDist, at); }
  shell(pos, vel) {
    let s;
    if (this.shellData.length >= this.shellMax) s = this.shellData.shift();
    else s = { p: new V3(), v: new V3(), q: new QT(), w: new V3(), life: 0 };
    s.p.copy(pos); s.v.copy(vel); s.q.setFromEuler(new THREE.Euler(Math.random(), Math.random(), Math.random())); s.w.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30); s.life = 5; s.bounces = 0;
    this.shellData.push(s);
  }
  shockwave(pos, radius) {
    const r = this.rings.find(x => x.t <= 0) || this.rings[0];
    r.mesh.position.copy(pos); r.mesh.position.y += 0.05; r.t = 0.45; r.max = radius; r.mesh.visible = true;
  }
  explosion(pos, radius) {
    const g = this.ground(pos.x, pos.z);
    this.flash(_v1.copy(pos).setY(pos.y + 0.5), 60, 0.35, 0xffb35a);
    for (let i = 0; i < 46; i++) {
      const d = _v2.set(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize();
      const sp = 3 + Math.random() * 9;
      this.glow.emit(pos.x, pos.y + 0.2, pos.z, d.x * sp, d.y * sp, d.z * sp, 0.25 + Math.random() * 0.35, 0.5, 1.6, 1.0, 0.55 + Math.random() * 0.25, 0.18, 0.95, 2, 4);
    }
    for (let i = 0; i < 40; i++) {
      const d = _v2.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize();
      const sp = 1 + Math.random() * 4;
      const sh = 0.25 + Math.random() * 0.2;
      this.smoke.emit(pos.x, pos.y + 0.3, pos.z, d.x * sp, d.y * sp, d.z * sp, 2.2 + Math.random() * 2.2, 0.6, 2.6 + Math.random() * 1.5, sh, sh, sh * 1.02, 0.7, -0.25, 1.4);
    }
    for (let i = 0; i < 30; i++) {
      const d = _v2.set(Math.random() - 0.5, Math.random() * 0.7 + 0.3, Math.random() - 0.5).normalize();
      const sp = 6 + Math.random() * 10;
      this.glow.emit(pos.x, pos.y + 0.1, pos.z, d.x * sp, d.y * sp, d.z * sp, 0.6 + Math.random() * 0.6, 0.05, 0.02, 1, 0.7, 0.3, 1, 9.8, 0.5);
    }
    this.shockwave(_v1.set(pos.x, g, pos.z), radius * 0.9);
    this.decal(_v1.set(pos.x, g + 0.005, pos.z), UP, radius * 0.45, 'scorch');
  }
  // rocket blast: bigger fireball, smoke column and flying debris
  bigExplosion(pos, radius) {
    this.flash(_v1.copy(pos).setY(pos.y + 1), 120, 0.5, 0xffa040);
    for (let i = 0; i < 70; i++) {
      const d = _v2.set(Math.random() - 0.5, Math.random() * 1.1, Math.random() - 0.5).normalize();
      const sp = 4 + Math.random() * 12;
      this.glow.emit(pos.x, pos.y + 0.3, pos.z, d.x * sp, d.y * sp, d.z * sp, 0.35 + Math.random() * 0.45, 0.9, 2.6, 1.0, 0.5 + Math.random() * 0.3, 0.15, 1, 1.5, 3.5);
    }
    for (let i = 0; i < 45; i++) {
      const d = _v2.set((Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6).normalize();
      const sp = 1.5 + Math.random() * 4;
      const sh = 0.16 + Math.random() * 0.14;
      this.smoke.emit(pos.x, pos.y + 0.5, pos.z, d.x * sp, d.y * sp, d.z * sp, 3.5 + Math.random() * 3, 1.0, 4 + Math.random() * 2.5, sh, sh * 0.96, sh * 0.92, 0.75, -0.35, 0.9);
    }
    const gore = this.game.gore;
    if (gore) gore.gibs.burst(pos, UP, 18, 'dirt', 9, 1.2, 1.1);
  }
  muzzle(pos, dir) {
    this.flash(pos, 6, 0.06, 0xffc070);
  }
  update(dt) {
    const gfn = (x, z) => this.ground(x, z);
    this.smoke.update(dt, gfn); this.glow.update(dt, gfn);
    const h = this.game.renderer.domElement.height, fov = this.game.camera.fov;
    const sc = h / (2 * Math.tan(fov * DEG / 2));
    this.smoke.uniforms.uScale.value = sc; this.glow.uniforms.uScale.value = sc;
    // light
    if (this.lightT > 0) { this.lightT -= dt; this.light.intensity = this.lightMax * Math.max(0, this.lightT / this.lightDur); }
    else this.light.intensity = 0;
    // tracers
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt; t.dist += t.speed * dt;
      const head = Math.min(t.dist, t.maxDist), tail = Math.max(0, head - t.len);
      const arr = t.line.geometry.attributes.position.array;
      arr[0] = t.a.x + t.dir.x * tail; arr[1] = t.a.y + t.dir.y * tail; arr[2] = t.a.z + t.dir.z * tail;
      arr[3] = t.a.x + t.dir.x * head; arr[4] = t.a.y + t.dir.y * head; arr[5] = t.a.z + t.dir.z * head;
      t.line.geometry.attributes.position.needsUpdate = true;
      t.line.material.opacity = Math.min(1, t.life / 0.2) * 0.85;
      if (t.life <= 0 || tail >= t.maxDist) { t.life = 0; t.line.visible = false; }
    }
    // shells
    const m4 = _m1;
    let k = 0;
    for (const s of this.shellData) {
      s.life -= dt;
      if (s.life <= 0) continue;
      s.v.y -= 9.8 * dt; s.p.addScaledVector(s.v, dt);
      const gy = this.ground(s.p.x, s.p.z) + 0.005;
      if (s.p.y < gy) { s.p.y = gy; if (s.v.y < -0.5 && s.bounces < 3) { s.bounces++; Events.emit('shellBounce', s.p); } s.v.y *= -0.35; s.v.x *= 0.5; s.v.z *= 0.5; s.w.multiplyScalar(0.5); }
      quatFromRotVec(_v1.copy(s.w).multiplyScalar(dt), _q1); s.q.premultiply(_q1);
      m4.compose(s.p, s.q, _v2.set(1, 1, 1));
      this.shells.setMatrixAt(k++, m4);
    }
    this.shells.count = k; this.shells.instanceMatrix.needsUpdate = true;
    // rings
    for (const r of this.rings) {
      if (r.t <= 0) continue;
      r.t -= dt;
      const f = 1 - r.t / 0.45;
      const s = 0.3 + f * r.max;
      r.mesh.scale.set(s, 1, s); r.mesh.material.opacity = (1 - f) * 0.5;
      if (r.t <= 0) r.mesh.visible = false;
    }
  }
  clear() {
    this.smoke.clear(); this.glow.clear();
    for (const d of this.decals) { this.game.scene.remove(d); }
    this.decals.length = 0; this.shellData.length = 0; this.shells.count = 0;
    for (const t of this.tracers) { t.life = 0; t.line.visible = false; }
  }
}
HT.FX = FX;
