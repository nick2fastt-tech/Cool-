// ============================================================================
// Post-processing: HDR scene target -> SSAO (half res) -> blur -> composite with
// ACES tone mapping + sRGB output. Enabled by the Ultra preset / SSAO toggle.
// ============================================================================
class PostFX {
  constructor(game) {
    this.game = game; this.enabled = false;
    const r = game.renderer;
    this.isGL2 = r.capabilities.isWebGL2;
    this.quadScene = new THREE.Scene(); this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quadScene.add(this.quad);
    const kernel = [];
    const rr = new RNG(99);
    for (let i = 0; i < 12; i++) {
      const v = new V3(rr.range(-1, 1), rr.range(-1, 1), rr.range(0.15, 1)).normalize();
      let s = i / 12; s = lerp(0.12, 1.0, s * s); v.multiplyScalar(s);
      kernel.push(v);
    }
    this.aoMat = new THREE.ShaderMaterial({
      uniforms: { tDepth: { value: null }, uProj: { value: new M4() }, uInvProj: { value: new M4() }, uRes: { value: new THREE.Vector2() }, uRadius: { value: 0.55 }, uPower: { value: 1.6 }, uKernel: { value: kernel } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uInvProj; uniform vec2 uRes; uniform float uRadius; uniform float uPower; uniform vec3 uKernel[12];
        varying vec2 vUv;
        vec3 viewPos(vec2 uv) { float d = texture2D(tDepth, uv).x; vec4 ndc = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vec4 v = uInvProj * ndc; return v.xyz / v.w; }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          float d0 = texture2D(tDepth, vUv).x;
          if (d0 >= 0.9999) { gl_FragColor = vec4(1.0); return; }
          vec3 P = viewPos(vUv);
          vec3 N = normalize(cross(dFdx(P), dFdy(P)));
          float a = hash(floor(vUv * uRes)) * 6.2831853;
          vec3 rv = vec3(cos(a), sin(a), 0.0);
          vec3 T = normalize(rv - N * dot(rv, N)); vec3 Bt = cross(N, T);
          mat3 TBN = mat3(T, Bt, N);
          float rad = uRadius * clamp(-P.z * 0.08 + 0.6, 0.6, 2.0);
          float occ = 0.0;
          for (int i = 0; i < 12; i++) {
            vec3 S = P + TBN * uKernel[i] * rad;
            vec4 q = uProj * vec4(S, 1.0); q.xy /= q.w;
            vec2 suv = q.xy * 0.5 + 0.5;
            float sz = viewPos(suv).z;
            float range = smoothstep(0.0, 1.0, rad / max(abs(P.z - sz), 1e-4));
            occ += (sz >= S.z + 0.025 * rad ? 1.0 : 0.0) * range;
          }
          float ao = clamp(1.0 - occ / 12.0, 0.0, 1.0);
          gl_FragColor = vec4(vec3(pow(ao, uPower)), 1.0);
        }`,
      depthTest: false, depthWrite: false
    });
    this.aoMat.extensions = { derivatives: true };
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tAO: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tAO; uniform sampler2D tDepth; uniform vec2 uTexel; varying vec2 vUv;
        void main() { float d0 = texture2D(tDepth, vUv).x; float s = 0.0, w = 0.0;
          for (int x = -2; x <= 2; x++) for (int y = -2; y <= 2; y++) { vec2 o = vec2(float(x), float(y)) * uTexel; float d = texture2D(tDepth, vUv + o).x; float wt = 1.0 / (1.0 + abs(d - d0) * 4000.0); s += texture2D(tAO, vUv + o).x * wt; w += wt; }
          gl_FragColor = vec4(vec3(s / w), 1.0); }`,
      depthTest: false, depthWrite: false
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tAO: { value: null }, uStrength: { value: 0.85 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tColor; uniform sampler2D tAO; uniform float uStrength; varying vec2 vUv;
        void main() { vec4 c = texture2D(tColor, vUv); float ao = texture2D(tAO, vUv).x; c.rgb *= mix(1.0, ao, uStrength); gl_FragColor = c;
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false, toneMapped: true
    });
    this.resize();
  }
  makeTargets() {
    const r = this.game.renderer, w = Math.max(2, Math.floor(r.domElement.width)), h = Math.max(2, Math.floor(r.domElement.height));
    if (this.rt) { this.rt.dispose(); this.aoRT.dispose(); this.blurRT.dispose(); }
    const dt = new THREE.DepthTexture(w, h); dt.type = THREE.UnsignedIntType;
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: this.isGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType, depthTexture: dt, samples: this.isGL2 && this.game.renderer.getContextAttributes().antialias ? 4 : 0 });
    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    this.aoRT = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false });
    this.blurRT = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false });
    this.aoMat.uniforms.uRes.value.set(hw, hh);
    this.blurMat.uniforms.uTexel.value.set(1 / hw, 1 / hh);
  }
  resize() { if (this.enabled) this.makeTargets(); }
  setEnabled(v) {
    this.enabled = !!v;
    if (this.enabled && !this.rt) this.makeTargets();
    if (!this.enabled && this.rt) { this.rt.dispose(); this.aoRT.dispose(); this.blurRT.dispose(); this.rt = null; }
  }
  render() {
    const g = this.game, r = g.renderer, cam = g.camera;
    if (!this.rt) this.makeTargets();
    const w = r.domElement.width, h = r.domElement.height;
    if (this.rt.width !== w || this.rt.height !== h) this.makeTargets();
    r.setRenderTarget(this.rt); r.render(g.scene, cam);
    this.aoMat.uniforms.tDepth.value = this.rt.depthTexture;
    this.aoMat.uniforms.uProj.value.copy(cam.projectionMatrix);
    this.aoMat.uniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
    this.quad.material = this.aoMat; r.setRenderTarget(this.aoRT); r.render(this.quadScene, this.quadCam);
    this.blurMat.uniforms.tAO.value = this.aoRT.texture; this.blurMat.uniforms.tDepth.value = this.rt.depthTexture;
    this.quad.material = this.blurMat; r.setRenderTarget(this.blurRT); r.render(this.quadScene, this.quadCam);
    this.compMat.uniforms.tColor.value = this.rt.texture; this.compMat.uniforms.tAO.value = this.blurRT.texture;
    this.quad.material = this.compMat; r.setRenderTarget(null); r.render(this.quadScene, this.quadCam);
  }
}
HT.PostFX = PostFX;
