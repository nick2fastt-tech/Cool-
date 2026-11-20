// Sky dome, sun, ambient light and image-based lighting. The sun follows the real
// local time: daytime sun patches through the windows, a starry sky at night.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DEG = Math.PI / 180;

const SKY_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FS = /* glsl */ `
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uNight;
uniform float uTime;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.6)) : mix(uHorizon, uBottom, clamp(-h * 5.0, 0.0, 1.0));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 1200.0) * 8.0 + pow(sd, 14.0) * 0.28 + pow(sd, 3.0) * 0.06);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.16) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
    float c = smoothstep(0.58, 0.86, fbm(uv));
    vec3 cc = mix(vec3(1.0), uHorizon, 0.18) * (1.0 - 0.9 * uNight);
    cc += uSunColor * pow(sd, 6.0) * 0.35;
    col = mix(col, cc, c * (0.75 - 0.4 * uNight) * smoothstep(0.0, 0.18, h));
    if (uNight > 0.01) {
      vec2 sp = d.xz / (h + 0.35) * 260.0;
      float s = step(0.9972, hash(floor(sp)));
      col += vec3(s) * uNight * smoothstep(0.02, 0.3, h) * (1.0 - c);
    }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const KEYS = [
  { el: -20, top: 0x040814, hor: 0x0e1730, bot: 0x080c18, sun: 0x000000, sunI: 0, hemiSky: 0xb8c6ff, hemiGround: 0x3a3428, hemiI: 1.05, night: 1 },
  { el: -6, top: 0x0e1838, hor: 0x2c3866, bot: 0x151a2c, sun: 0x000000, sunI: 0, hemiSky: 0xc4ceff, hemiGround: 0x3e3628, hemiI: 1.1, night: 0.85 },
  { el: 0, top: 0x2a4a8c, hor: 0xf2955f, bot: 0x3a3f4f, sun: 0xff8f52, sunI: 0.5, hemiSky: 0xffe1c8, hemiGround: 0x4a3c2c, hemiI: 1.15, night: 0.15 },
  { el: 8, top: 0x3d78cc, hor: 0xffc994, bot: 0x6a7886, sun: 0xffc084, sunI: 1.9, hemiSky: 0xfff1e0, hemiGround: 0x5a4a38, hemiI: 1.2, night: 0 },
  { el: 25, top: 0x3a83db, hor: 0xc2e2ff, bot: 0x8b9fb0, sun: 0xfff2dc, sunI: 2.8, hemiSky: 0xf4f8ff, hemiGround: 0x5e5244, hemiI: 1.25, night: 0 },
  { el: 70, top: 0x2f7fe0, hor: 0xb8ddff, bot: 0x8b9fb0, sun: 0xffffff, sunI: 3.0, hemiSky: 0xf4f8ff, hemiGround: 0x5e5244, hemiI: 1.25, night: 0 },
];

export function sunPosition(date) {
  const h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const rise = 6.5, set = 18.75;
  let el, az;
  if (h >= rise && h <= set) {
    const f = (h - rise) / (set - rise);
    el = Math.sin(Math.PI * f) * 58;
    az = 90 + 180 * f;
  } else {
    const nightLen = 24 - (set - rise);
    let g = h > set ? (h - set) / nightLen : (h + 24 - set) / nightLen;
    el = -Math.sin(Math.PI * g) * 40;
    az = 270 + 180 * g;
  }
  return { el, az };
}

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
function lerpHex(a, b, t, out) {
  tmpA.setHex(a);
  tmpB.setHex(b);
  return out.copy(tmpA).lerp(tmpB, t);
}

export class Env {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.envMap = pmrem.fromScene(room, 0.035).texture;
    room.dispose();
    pmrem.dispose();
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.62;

    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uNight: { value: 0 },
      uTime: { value: 0 },
    };
    const skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false });
    skyMat.name = 'sky';
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const sc = this.sun.shadow;
    sc.mapSize.set(2048, 2048);
    sc.camera.left = -46;
    sc.camera.right = 46;
    sc.camera.top = 46;
    sc.camera.bottom = -46;
    sc.camera.near = 1;
    sc.camera.far = 260;
    sc.bias = -0.0004;
    sc.normalBias = 0.035;
    sc.radius = 2.5;
    this.sunTarget = new THREE.Object3D();
    this.sunTarget.position.set(30, 0, 12);
    scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
    scene.add(this.sun);

    this.night = 0;
    this.lastEl = null;
    this.lastAz = null;
    this.outdoorGlow = null;
    this.outdoorMats = [];
    this.time = 0;
  }

  /** Apply the sky + lights for a real date/time. Returns true if shadows need an update. */
  setTime(date) {
    const { el, az } = sunPosition(date);
    let i = 0;
    while (i < KEYS.length - 2 && el > KEYS[i + 1].el) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = THREE.MathUtils.clamp((el - a.el) / (b.el - a.el), 0, 1);
    const U = this.uniforms;
    lerpHex(a.top, b.top, t, U.uTop.value);
    lerpHex(a.hor, b.hor, t, U.uHorizon.value);
    lerpHex(a.bot, b.bot, t, U.uBottom.value);
    lerpHex(a.sun, b.sun, t, U.uSunColor.value);
    this.night = a.night + (b.night - a.night) * t;
    U.uNight.value = this.night;
    const dir = new THREE.Vector3(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG)).normalize();
    U.uSunDir.value.copy(dir);
    const sunI = a.sunI + (b.sunI - a.sunI) * t;
    this.sun.color.copy(U.uSunColor.value);
    this.sun.intensity = sunI;
    this.sun.visible = sunI > 0.01;
    this.sun.position.copy(this.sunTarget.position).addScaledVector(dir, 120);
    lerpHex(a.hemiSky, b.hemiSky, t, this.hemi.color);
    lerpHex(a.hemiGround, b.hemiGround, t, this.hemi.groundColor);
    this.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * t;
    if (this.outdoorGlow) this.outdoorGlow.emissiveIntensity = this.night > 0.3 ? 2.6 : 0.0;
    // Outdoor surfaces get darker at night (indoor lights stay on, so windows glow).
    const k = 1 - 0.68 * this.night;
    for (const m of this.outdoorMats) {
      if (!m.userData.baseColor) m.userData.baseColor = m.color.clone();
      m.color.copy(m.userData.baseColor).multiplyScalar(k);
    }
    const changed = this.lastEl === null || Math.abs(el - this.lastEl) > 0.6 || Math.abs(az - this.lastAz) > 0.6;
    if (changed) {
      this.lastEl = el;
      this.lastAz = az;
    }
    return changed;
  }

  update(dt, camera) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    this.sky.position.copy(camera.position);
  }
}
