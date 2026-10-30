// ============================================================================
// Contact shadows: soft dark blobs where feet, bodies and props meet the ground.
// One instanced, depth-tested quad batch for the whole scene (cheap on mobile);
// works in both environments, follows terrain slope, fades with height.
// ============================================================================
class ContactShadows {
  constructor(game, max = 640) {
    this.game = game; this.max = max;
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    this.aK = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    geo.setAttribute('aK', this.aK);
    this.uniforms = { uStrength: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: `attribute float aK; varying vec2 vUv; varying float vK;
        void main() { vUv = uv; vK = aK; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uStrength; varying vec2 vUv; varying float vK;
        void main() { float r = length(vUv - 0.5) * 2.0; float a = exp(-r * r * 3.2) * (1.0 - smoothstep(0.72, 1.0, r)) * vK * uStrength;
          if (a < 0.003) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }`
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; this.mesh.name = 'contactShadows';
    game.scene.add(this.mesh);
    this._m = new M4(); this._q = new QT(); this._q2 = new QT(); this._s = new V3(); this._p = new V3(); this._n = new V3();
    this.n = 0;
  }
  // one blob: center (world), half-sizes along local x/z, yaw, darkness
  blob(x, z, sx, sz, yaw, k) {
    if (this.n >= this.max || k < 0.01) return;
    const env = this.game.env;
    const y = env.groundHeight(x, z) + 0.004;
    env.groundNormal(x, z, this._n);
    this._q.setFromUnitVectors(UP, this._n).multiply(this._q2.setFromAxisAngle(UP, yaw));
    this._m.compose(this._p.set(x, y, z), this._q, this._s.set(sx * 2, 1, sz * 2));
    this.mesh.setMatrixAt(this.n, this._m);
    this.aK.array[this.n] = Math.min(1, k);
    this.n++;
  }
  update() {
    const g = this.game, env = g.env;
    this.n = 0;
    const cam = g.camera.position;
    // brighter rooms read contact shadows more strongly than sunlit grass
    this.uniforms.uStrength.value = env.current && env.current.kind === 'field' ? 0.85 : 0.78;
    for (const npc of g.npcs.list) {
      if (npc.removed) continue;
      const dc = Math.hypot(npc.root.pos.x - cam.x, npc.root.pos.z - cam.z);
      if (dc > 60) continue;
      const S = npc.rig.H / 1.75;
      if (npc.physMode === 'ragdoll') {
        const R = npc.rag, bodies = R.bodies;
        for (let i = 0; i < bodies.length; i++) {
          const b = bodies[i], h = b.pos.y - env.groundHeight(b.pos.x, b.pos.z);
          const big = i === RAG.PELVIS || i === RAG.CHEST || i === RAG.SPINE;
          const rad = (big ? 0.27 : i === RAG.HEAD ? 0.16 : 0.12) * S;
          const k = (big ? 0.75 : 0.6) * (1 - smoothstep(0.04, 0.55, h - rad * 0.5));
          if (k > 0.02) this.blob(b.pos.x, b.pos.z, rad * 1.25, rad * 1.25, 0, k);
        }
        continue;
      }
      // standing / walking: a blob under each foot + a soft pool under the body
      for (const fb of [B.foot_L, B.foot_R]) {
        const a = npc.boneWPos[fb], r = npc.boneWRot[fb];
        if (!a || !r) continue;
        const f = this._p.set(0, 0, 1).applyQuaternion(r); f.y = 0;
        const fl = Math.hypot(f.x, f.z) || 1; f.x /= fl; f.z /= fl;
        const mx = a.x + f.x * 0.06 * S, mz = a.z + f.z * 0.06 * S;
        const h = a.y - env.groundHeight(mx, mz) - npc.rig.ankleY;
        const k = 0.9 * (1 - smoothstep(0.0, 0.3, h));
        this.blob(mx, mz, 0.12 * S, 0.21 * S, Math.atan2(f.x, f.z), k);
      }
      const hp = npc.boneWPos[B.hips];
      if (hp) {
        const h = hp.y - env.groundHeight(hp.x, hp.z);
        const k = 0.5 * (1 - smoothstep(0.3 * S, 1.3 * S, h)) + 0.3;
        this.blob(hp.x, hp.z, 0.42 * S, 0.34 * S, npc.root.yaw, k);
      }
    }
    for (const p of g.props.list) {
      const b = p.body; if (!b) continue;
      const r = p.radius || 0.3, h = b.pos.y - env.groundHeight(b.pos.x, b.pos.z);
      this.blob(b.pos.x, b.pos.z, r * 1.15, r * 1.15, 0, 0.7 * (1 - smoothstep(r * 0.6, r * 0.6 + 0.8, h)));
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true; this.aK.needsUpdate = true;
  }
}
HT.ContactShadows = ContactShadows;
