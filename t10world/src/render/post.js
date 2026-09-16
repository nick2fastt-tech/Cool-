// T10 World - post-processing. Bloom, screen-space reflections, ambient
// occlusion and the T10 vision modes, composited in as few passes as the
// quality preset allows.
import * as THREE from '../../vendor/three.module.js';
import { settings, perf } from '../core/settings.js';
import { clamp01, lerpv } from '../core/math.js';

const QUAD_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform float uThreshold;
uniform float uSoft;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(uThreshold, uThreshold + uSoft, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

const BLUR_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 uDir;
void main() {
  // 9-tap gaussian, separable.
  vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;
  vec2 o1 = uDir * 1.3846153846;
  vec2 o2 = uDir * 3.2307692308;
  sum += texture2D(tDiffuse, vUv + o1) * 0.3162162162;
  sum += texture2D(tDiffuse, vUv - o1) * 0.3162162162;
  sum += texture2D(tDiffuse, vUv + o2) * 0.0702702703;
  sum += texture2D(tDiffuse, vUv - o2) * 0.0702702703;
  gl_FragColor = sum;
}`;

const SSAO_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uStrength;
uniform float uNear;
uniform float uFar;

float linearDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x;
  float ndc = z * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
}

void main() {
  float d = linearDepth(vUv);
  if (d > uFar * 0.6) { gl_FragColor = vec4(1.0); return; }
  float occ = 0.0;
  // Fixed 8-tap ring; cheap but enough to darken contact points.
  const int N = 8;
  for (int i = 0; i < N; i++) {
    float a = float(i) * 0.7853981634;
    vec2 off = vec2(cos(a), sin(a)) * uTexel * uRadius * (1.0 + mod(float(i), 3.0) * 0.6);
    float sd = linearDepth(vUv + off);
    float diff = d - sd;
    occ += clamp(diff / max(0.35, d * 0.06), 0.0, 1.0) * step(0.02, diff);
  }
  occ = 1.0 - clamp(occ / float(N) * uStrength, 0.0, 0.85);
  gl_FragColor = vec4(vec3(occ), 1.0);
}`;

/** Screen-space reflections on near-horizontal surfaces — the "RTX" look. */
const SSR_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uStrength;
uniform float uWet;
uniform float uSteps;
uniform mat4 uProj;
uniform mat4 uInvProj;

float rawDepth(vec2 uv) { return texture2D(tDepth, uv).x; }

float linearDepth(float z) {
  float ndc = z * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
}

/** View-space position from a UV and its depth sample. */
vec3 viewPos(vec2 uv, float z) {
  vec4 clip = vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
  vec4 v = uInvProj * clip;
  return v.xyz / v.w;
}

void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  float z = rawDepth(vUv);
  // Sky: nothing to reflect off.
  if (z >= 0.9999 || uStrength < 0.01) { gl_FragColor = base; return; }

  vec3 P = viewPos(vUv, z);
  // Rebuild the surface normal from neighbouring depth, picking the smaller
  // difference on each axis so we don't smear across silhouettes.
  vec3 px = viewPos(vUv + vec2(uTexel.x, 0.0), rawDepth(vUv + vec2(uTexel.x, 0.0))) - P;
  vec3 mx = P - viewPos(vUv - vec2(uTexel.x, 0.0), rawDepth(vUv - vec2(uTexel.x, 0.0)));
  vec3 py = viewPos(vUv + vec2(0.0, uTexel.y), rawDepth(vUv + vec2(0.0, uTexel.y))) - P;
  vec3 my = P - viewPos(vUv - vec2(0.0, uTexel.y), rawDepth(vUv - vec2(0.0, uTexel.y)));
  vec3 dx = length(px) < length(mx) ? px : mx;
  vec3 dy = length(py) < length(my) ? py : my;
  vec3 N = normalize(cross(dx, dy));
  if (N.y < 0.0) N = -N;

  // Only near-horizontal surfaces reflect: roads, pavements, water, glass
  // that happens to be lying flat. Wetness decides how much.
  float flatness = smoothstep(0.55, 0.92, N.y);
  float amount = flatness * uStrength * (0.22 + uWet * 0.78);
  if (amount < 0.012) { gl_FragColor = base; return; }

  vec3 V = normalize(P);
  vec3 R = reflect(V, N);
  // Grazing angles reflect far more than head-on ones.
  float fresnel = pow(1.0 - max(dot(-V, N), 0.0), 3.0);
  amount *= mix(0.25, 1.0, fresnel);

  // March the reflected ray in view space, projecting to screen each step.
  float steps = max(6.0, uSteps);
  float stride = mix(0.55, 2.2, clamp(-P.z / 60.0, 0.0, 1.0));
  vec3 hitColor = vec3(0.0);
  float hit = 0.0;
  vec2 hitUv = vUv;
  vec3 march = P;
  for (int i = 0; i < 32; i++) {
    if (float(i) >= steps) break;
    march += R * stride;
    if (march.z > -uNear) break;
    vec4 clip = uProj * vec4(march, 1.0);
    vec2 uv = (clip.xy / clip.w) * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
    float sceneZ = linearDepth(rawDepth(uv));
    float rayZ = -march.z;
    float diff = rayZ - sceneZ;
    // In front of the surface, but not so far behind it that we've punched
    // through a foreground object.
    if (diff > 0.02 && diff < stride * 2.4) {
      // One binary refinement so the hit doesn't stair-step.
      vec3 a = march - R * stride, bpt = march;
      for (int k = 0; k < 4; k++) {
        vec3 mid = (a + bpt) * 0.5;
        vec4 mc = uProj * vec4(mid, 1.0);
        vec2 muv = (mc.xy / mc.w) * 0.5 + 0.5;
        if (linearDepth(rawDepth(muv)) < -mid.z) bpt = mid; else a = mid;
      }
      vec4 fc = uProj * vec4((a + bpt) * 0.5, 1.0);
      hitUv = (fc.xy / fc.w) * 0.5 + 0.5;
      hitColor = texture2D(tDiffuse, hitUv).rgb;
      hit = 1.0;
      break;
    }
  }

  // Ripple the sample a little when the ground is wet.
  if (hit > 0.5 && uWet > 0.01) {
    vec2 ripple = vec2(sin(vUv.y * 140.0 + vUv.x * 30.0), cos(vUv.x * 120.0)) * 0.0022 * uWet;
    hitColor = mix(hitColor, texture2D(tDiffuse, clamp(hitUv + ripple, 0.001, 0.999)).rgb, 0.6);
  }

  // Nothing found: mirror the horizon, which is what the cheap version did and
  // is still better than a flat surface.
  if (hit < 0.5) {
    float horizon = 0.62;
    vec2 ruv = vec2(vUv.x, horizon + (horizon - vUv.y) * 0.92);
    ruv.x += sin(vUv.y * 90.0) * 0.0016 * uWet;
    if (ruv.y > 0.0 && ruv.y < 1.0) {
      hitColor = texture2D(tDiffuse, ruv).rgb;
      hit = smoothstep(0.0, 0.25, ruv.y) * 0.55;
    }
  }

  // Fade out at the edges of the screen, where there is nothing to sample.
  vec2 edge = smoothstep(vec2(0.0), vec2(0.14), hitUv) * smoothstep(vec2(0.0), vec2(0.14), 1.0 - hitUv);
  float border = edge.x * edge.y;

  float k = clamp(amount * hit * border, 0.0, 0.55);
  gl_FragColor = vec4(mix(base.rgb, hitColor, k), base.a);
}`;

const COMPOSITE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform sampler2D tAO;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform vec2 uResolution;
uniform float uBloom;
uniform float uAO;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform float uMotionBlur;
uniform vec2 uMotion;
uniform float uVision;       // 0 off, 1 t10, 2 night, 3 thermal, 4 scan, 5 wire
uniform float uVisionMix;
uniform float uWet;
uniform float uFXAA;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// The scene is rendered into a linear HDR target, so this final pass owns the
// sRGB transfer function that a direct-to-canvas render would have applied.
vec3 linearToSRGB(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// Sobel edge strength from luminance — drives the robotic outlines.
float edge(vec2 uv) {
  float tl = luma(texture2D(tDiffuse, uv + uTexel * vec2(-1.0, 1.0)).rgb);
  float t  = luma(texture2D(tDiffuse, uv + uTexel * vec2( 0.0, 1.0)).rgb);
  float tr = luma(texture2D(tDiffuse, uv + uTexel * vec2( 1.0, 1.0)).rgb);
  float l  = luma(texture2D(tDiffuse, uv + uTexel * vec2(-1.0, 0.0)).rgb);
  float r  = luma(texture2D(tDiffuse, uv + uTexel * vec2( 1.0, 0.0)).rgb);
  float bl = luma(texture2D(tDiffuse, uv + uTexel * vec2(-1.0,-1.0)).rgb);
  float b  = luma(texture2D(tDiffuse, uv + uTexel * vec2( 0.0,-1.0)).rgb);
  float br = luma(texture2D(tDiffuse, uv + uTexel * vec2( 1.0,-1.0)).rgb);
  float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
  float gy =  tl + 2.0*t + tr - bl - 2.0*b - br;
  return sqrt(gx*gx + gy*gy);
}

void main() {
  vec2 uv = vUv;
  vec3 col = texture2D(tDiffuse, uv).rgb;

  // Camera motion blur.
  if (uMotionBlur > 0.001) {
    vec2 dir = uMotion * uMotionBlur;
    vec3 acc = col;
    for (int i = 1; i < 5; i++) {
      acc += texture2D(tDiffuse, uv - dir * (float(i) / 5.0)).rgb;
    }
    col = acc / 5.0;
  }

  // Ambient occlusion.
  if (uAO > 0.001) {
    float ao = texture2D(tAO, uv).r;
    col *= mix(1.0, ao, uAO);
  }

  // Bloom.
  if (uBloom > 0.001) {
    col += texture2D(tBloom, uv).rgb * uBloom;
  }

  // ---- Vision modes -------------------------------------------------------
  if (uVisionMix > 0.001) {
    vec3 v = col;
    float e = edge(uv);
    float l = luma(col);
    if (uVision < 1.5) {
      // T10 vision: green machine sight. Desaturated base, green cast,
      // scanlines, edge outlines and a subtle sensor grid.
      float g = l;
      v = vec3(g * 0.18, g * 1.06, g * 0.42);
      v += vec3(0.02, 0.24, 0.10) * clamp(e * 2.4, 0.0, 1.6);
      float scan = sin((uv.y * uResolution.y) * 1.6 + uTime * 5.0) * 0.5 + 0.5;
      v *= 0.86 + scan * 0.14;
      // Faint measurement grid.
      vec2 grid = abs(fract(uv * vec2(28.0, 16.0)) - 0.5);
      float gridLine = smoothstep(0.49, 0.5, max(grid.x, grid.y));
      v += vec3(0.0, 0.10, 0.04) * gridLine;
      // Horizon sweep.
      float sweep = smoothstep(0.012, 0.0, abs(fract(uTime * 0.14) - uv.y));
      v += vec3(0.0, 0.32, 0.12) * sweep;
      v *= 1.0 - 0.18 * hash(uv * uResolution.xy + uTime);
    } else if (uVision < 2.5) {
      float g = pow(l + 0.08, 0.62) * 1.5;
      v = vec3(g * 0.25, g, g * 0.32);
      v *= 0.9 + 0.1 * hash(uv * uResolution.xy + uTime * 3.0);
    } else if (uVision < 3.5) {
      float t = clamp(l * 1.4, 0.0, 1.0);
      v = vec3(smoothstep(0.35, 0.95, t), smoothstep(0.15, 0.7, t) * 0.75, smoothstep(0.0, 0.4, 1.0 - t) * 0.9);
      v = mix(vec3(0.03, 0.0, 0.18), v, clamp(t * 1.6, 0.0, 1.0));
    } else if (uVision < 4.5) {
      v = col * 0.35 + vec3(0.0, 0.7, 1.0) * clamp(e * 2.0, 0.0, 1.0);
      float bands = sin(uv.y * 240.0 + uTime * 9.0) * 0.5 + 0.5;
      v += vec3(0.0, 0.10, 0.16) * bands;
    } else {
      v = vec3(clamp(e * 1.6, 0.0, 1.0)) * vec3(0.7, 0.95, 1.0);
    }
    col = mix(col, v, uVisionMix);
  }

  // Wet-street contrast lift.
  col = mix(col, col * vec3(0.94, 0.98, 1.06), uWet * 0.35);

  // Vignette.
  if (uVignette > 0.001) {
    vec2 d = uv - 0.5;
    float vig = 1.0 - dot(d, d) * uVignette * 2.1;
    col *= clamp(vig, 0.0, 1.0);
  }

  // Film grain.
  if (uGrain > 0.001) {
    float n = hash(uv * uResolution.xy + fract(uTime) * 1000.0);
    col += (n - 0.5) * uGrain;
  }

  gl_FragColor = vec4(linearToSRGB(col), 1.0);
}`;

function makeMaterial(frag, uniforms) {
  return new THREE.RawShaderMaterial({
    vertexShader: 'attribute vec3 position;\nattribute vec2 uv;\n' + QUAD_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

export class PostProcessor {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;

    this.bloomEnabled = settings.preset.bloom;
    this.ssrEnabled = settings.preset.ssr;
    this.ssaoEnabled = settings.preset.ssao;
    this.motionBlurEnabled = settings.preset.motionBlur;

    this.visionMode = 'off';
    this.visionMix = 0;
    this.visionTarget = 0;
    this.wetness = 0;
    this.time = 0;
    this.prevCamDir = new THREE.Vector3(0, 0, -1);
    this.motion = new THREE.Vector2();

    this.quadGeo = new THREE.BufferGeometry();
    this.quadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -1, -1, 0, 3, -1, 0, -1, 3, 0,
    ]), 3));
    this.quadGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();
    this.quadMesh = new THREE.Mesh(this.quadGeo, null);
    this.quadMesh.frustumCulled = false;
    this.quadScene.add(this.quadMesh);

    this.buildTargets(1, 1);
    this.buildMaterials();
  }

  buildTargets(w, h) {
    const disposeRT = (rt) => { if (rt) rt.dispose(); };
    disposeRT(this.rtScene); disposeRT(this.rtBrightA); disposeRT(this.rtBrightB);
    disposeRT(this.rtAO); disposeRT(this.rtSSR);

    const type = THREE.HalfFloatType;
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type, depthBuffer: true };
    this.rtScene = new THREE.WebGLRenderTarget(w, h, opts);
    this.rtScene.depthTexture = new THREE.DepthTexture(w, h);
    this.rtScene.depthTexture.type = THREE.UnsignedShortType;

    const bw = Math.max(1, Math.round(w * 0.35)), bh = Math.max(1, Math.round(h * 0.35));
    this.rtBrightA = new THREE.WebGLRenderTarget(bw, bh, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type, depthBuffer: false });
    this.rtBrightB = new THREE.WebGLRenderTarget(bw, bh, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type, depthBuffer: false });
    this.rtAO = new THREE.WebGLRenderTarget(Math.round(w * 0.6), Math.round(h * 0.6), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.rtSSR = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type, depthBuffer: false });
    this.width = w; this.height = h;
  }

  buildMaterials() {
    this.matBright = makeMaterial(BRIGHT_FRAG, {
      tDiffuse: { value: null }, uThreshold: { value: 1.05 }, uSoft: { value: 0.6 },
    });
    this.matBlur = makeMaterial(BLUR_FRAG, {
      tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() },
    });
    this.matAO = makeMaterial(SSAO_FRAG, {
      tDepth: { value: null }, uTexel: { value: new THREE.Vector2() },
      uRadius: { value: 5.0 }, uStrength: { value: 1.0 },
      uNear: { value: 0.1 }, uFar: { value: 1000 },
    });
    this.matSSR = makeMaterial(SSR_FRAG, {
      tDiffuse: { value: null }, tDepth: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uSteps: { value: 20 },
      uProj: { value: new THREE.Matrix4() },
      uInvProj: { value: new THREE.Matrix4() },
      uNear: { value: 0.1 }, uFar: { value: 1000 },
      uStrength: { value: 0.8 }, uWet: { value: 0 },
    });
    this.matComposite = makeMaterial(COMPOSITE_FRAG, {
      tDiffuse: { value: null }, tBloom: { value: null }, tAO: { value: null }, tDepth: { value: null },
      uTexel: { value: new THREE.Vector2() }, uResolution: { value: new THREE.Vector2() },
      uBloom: { value: 0.55 }, uAO: { value: 0.65 }, uVignette: { value: 0.42 },
      uGrain: { value: 0.022 }, uTime: { value: 0 },
      uMotionBlur: { value: 0 }, uMotion: { value: new THREE.Vector2() },
      uVision: { value: 0 }, uVisionMix: { value: 0 }, uWet: { value: 0 },
      uFXAA: { value: 1 },
    });
  }

  setSize(w, h) {
    if (w === this.width && h === this.height) return;
    this.buildTargets(Math.max(1, w), Math.max(1, h));
  }

  setVisionMode(mode) {
    this.visionMode = mode;
    const map = { off: 0, t10: 1, night: 2, thermal: 3, scan: 4, wire: 5 };
    this.visionIndex = map[mode] != null ? map[mode] : 0;
    this.visionTarget = mode === 'off' ? 0 : 1;
  }

  applySettings() {
    const p = settings.preset;
    this.bloomEnabled = p.bloom;
    this.ssrEnabled = p.ssr;
    this.ssaoEnabled = p.ssao;
    this.motionBlurEnabled = p.motionBlur;
  }

  blit(material, target) {
    this.quadMesh.material = material;
    this.renderer.setRenderTarget(target || null);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(dt) {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    this.setSize(size.x, size.y);
    this.time += dt;

    // Ease the vision overlay in and out instead of snapping.
    this.visionMix = lerpv(this.visionMix, this.visionTarget, clamp01(dt * 6));

    const needsPost = this.enabled && (this.bloomEnabled || this.ssaoEnabled || this.ssrEnabled ||
      this.visionMix > 0.001 || this.motionBlurEnabled);
    if (!needsPost) {
      r.setRenderTarget(null);
      r.render(this.scene, this.camera);
      this.sceneInfo = { calls: r.info.render.calls, triangles: r.info.render.triangles };
      return;
    }

    // 1) Scene into the HDR target.
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, this.camera);
    this.sceneInfo = { calls: r.info.render.calls, triangles: r.info.render.triangles };

    let sourceTex = this.rtScene.texture;

    // 2) Screen-space reflections.
    if (this.ssrEnabled) {
      this.matSSR.uniforms.tDiffuse.value = sourceTex;
      this.matSSR.uniforms.tDepth.value = this.rtScene.depthTexture;
      this.matSSR.uniforms.uTexel.value.set(1 / this.width, 1 / this.height);
      this.matSSR.uniforms.uNear.value = this.camera.near;
      this.matSSR.uniforms.uFar.value = this.camera.far;
      this.matSSR.uniforms.uWet.value = this.wetness;
      // Ray count follows the frame governor, so a phone on ULTRA gets shorter
      // rays rather than a slideshow.
      this.matSSR.uniforms.uSteps.value = Math.round(lerpv(7, 28, perf.load));
      this.matSSR.uniforms.uProj.value.copy(this.camera.projectionMatrix);
      this.matSSR.uniforms.uInvProj.value.copy(this.camera.projectionMatrixInverse);
      this.blit(this.matSSR, this.rtSSR);
      sourceTex = this.rtSSR.texture;
    }

    // 3) Bloom.
    if (this.bloomEnabled) {
      this.matBright.uniforms.tDiffuse.value = sourceTex;
      this.blit(this.matBright, this.rtBrightA);
      const bw = this.rtBrightA.width, bh = this.rtBrightA.height;
      for (let i = 0; i < 2; i++) {
        this.matBlur.uniforms.tDiffuse.value = this.rtBrightA.texture;
        this.matBlur.uniforms.uDir.value.set((1 / bw) * (1 + i), 0);
        this.blit(this.matBlur, this.rtBrightB);
        this.matBlur.uniforms.tDiffuse.value = this.rtBrightB.texture;
        this.matBlur.uniforms.uDir.value.set(0, (1 / bh) * (1 + i));
        this.blit(this.matBlur, this.rtBrightA);
      }
    }

    // 4) Ambient occlusion.
    if (this.ssaoEnabled) {
      this.matAO.uniforms.tDepth.value = this.rtScene.depthTexture;
      this.matAO.uniforms.uTexel.value.set(1 / this.rtAO.width, 1 / this.rtAO.height);
      this.matAO.uniforms.uNear.value = this.camera.near;
      this.matAO.uniforms.uFar.value = this.camera.far;
      this.blit(this.matAO, this.rtAO);
    }

    // 5) Camera motion for the blur direction.
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.motion.set(
      (dir.x - this.prevCamDir.x) * 0.5,
      (dir.y - this.prevCamDir.y) * 0.5
    );
    this.prevCamDir.copy(dir);

    // 6) Composite.
    const u = this.matComposite.uniforms;
    u.tDiffuse.value = sourceTex;
    u.tBloom.value = this.bloomEnabled ? this.rtBrightA.texture : null;
    u.tAO.value = this.ssaoEnabled ? this.rtAO.texture : null;
    u.tDepth.value = this.rtScene.depthTexture;
    u.uTexel.value.set(1 / this.width, 1 / this.height);
    u.uResolution.value.set(this.width, this.height);
    u.uBloom.value = this.bloomEnabled ? 0.32 : 0;
    u.uAO.value = this.ssaoEnabled ? 0.42 : 0;
    u.uVignette.value = 0.38 + this.visionMix * 0.42;
    u.uGrain.value = 0.018 + this.visionMix * 0.03;
    u.uTime.value = this.time;
    u.uMotionBlur.value = this.motionBlurEnabled ? Math.min(0.35, this.motion.length() * settings.get('motionBlurAmount') * 2.2) : 0;
    u.uMotion.value.copy(this.motion).multiplyScalar(4);
    u.uVision.value = this.visionIndex || 0;
    u.uVisionMix.value = this.visionMix;
    u.uWet.value = this.wetness;
    this.blit(this.matComposite, null);
  }

  dispose() {
    for (const rt of [this.rtScene, this.rtBrightA, this.rtBrightB, this.rtAO, this.rtSSR]) if (rt) rt.dispose();
    for (const m of [this.matBright, this.matBlur, this.matAO, this.matSSR, this.matComposite]) if (m) m.dispose();
    this.quadGeo.dispose();
  }
}
