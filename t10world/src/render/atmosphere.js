// T10 World - sky, day/night cycle and weather.
// A physically-flavoured sky dome drives the sun, ambient and fog together, so
// "make it night" or "make it rain" changes the whole look of the world.
import * as THREE from '../../vendor/three.module.js';
import { clamp01, clampv, lerpv, smooth01, smoothstep, makeRng, noise1, TAU, damp } from '../core/math.js';
import { settings, perf } from '../core/settings.js';
import { audio } from '../core/audio.js';

const SKY_VERT = `
varying vec3 vWorldDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldDir = normalize(wp.xyz - cameraPosition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;   // always at the far plane
}`;

const SKY_FRAG = `
precision highp float;
varying vec3 vWorldDir;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uTurbidity;
uniform float uOvercast;
uniform float uNight;
uniform float uStarStrength;
uniform float uTime;
uniform vec3 uGroundColor;

// Cheap hash-based starfield.
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float stars(vec3 dir) {
  vec3 p = dir * 180.0;
  vec3 c = floor(p);
  float best = 0.0;
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      for (int k = -1; k <= 1; k++) {
        vec3 cell = c + vec3(float(i), float(j), float(k));
        float h = hash31(cell);
        if (h < 0.982) continue;
        vec3 off = vec3(hash31(cell + 1.7), hash31(cell + 3.1), hash31(cell + 5.9));
        float d = length(p - (cell + off));
        float tw = 0.55 + 0.45 * sin(uTime * 2.2 + h * 90.0);
        best = max(best, smoothstep(0.55, 0.0, d) * tw * (h - 0.982) / 0.018);
      }
    }
  }
  return best;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  float up = clamp(dir.y, -1.0, 1.0);
  float horizon = pow(1.0 - clamp(up, 0.0, 1.0), 3.0);

  float sunDot = clamp(dot(dir, uSunDir), -1.0, 1.0);
  float sunElev = uSunDir.y;

  // Daytime gradient: deep blue overhead fading warm at the horizon.
  vec3 zenithDay = vec3(0.16, 0.34, 0.72);
  vec3 horizonDay = vec3(0.68, 0.79, 0.92);
  // Golden hour tint tracks how low the sun is.
  float golden = smoothstep(0.30, -0.06, sunElev) * smoothstep(-0.22, 0.02, sunElev);
  vec3 zenithDusk = vec3(0.12, 0.16, 0.38);
  vec3 horizonDusk = vec3(0.94, 0.52, 0.28);
  vec3 zenithNight = vec3(0.012, 0.022, 0.055);
  vec3 horizonNight = vec3(0.05, 0.07, 0.13);

  float dayAmt = clamp(smoothstep(-0.10, 0.18, sunElev), 0.0, 1.0);
  vec3 zenith = mix(zenithNight, mix(zenithDusk, zenithDay, dayAmt), clamp(dayAmt + golden, 0.0, 1.0));
  vec3 hor = mix(horizonNight, mix(horizonDusk, horizonDay, dayAmt), clamp(dayAmt + golden, 0.0, 1.0));
  zenith = mix(zenith, zenithDusk, golden * 0.55);
  hor = mix(hor, horizonDusk, golden * 0.8);

  vec3 col = mix(zenith, hor, horizon);

  // Mie forward-scatter glow around the sun.
  float mie = pow(max(sunDot, 0.0), mix(24.0, 6.0, uTurbidity * 0.1));
  vec3 sunTint = mix(vec3(1.0, 0.94, 0.82), vec3(1.0, 0.55, 0.25), golden);
  col += sunTint * mie * (1.4 - uOvercast * 0.9) * (0.35 + dayAmt * 0.9);

  // Sun and moon discs.
  float sunDisc = smoothstep(0.99955, 0.99985, sunDot);
  col += sunTint * sunDisc * 12.0 * (1.0 - uOvercast * 0.85);
  float moonDot = clamp(dot(dir, uMoonDir), -1.0, 1.0);
  float moonDisc = smoothstep(0.9990, 0.99955, moonDot);
  col += vec3(0.92, 0.94, 1.0) * moonDisc * 2.6 * uNight * (1.0 - uOvercast * 0.8);
  col += vec3(0.5, 0.55, 0.75) * pow(max(moonDot, 0.0), 220.0) * 0.5 * uNight * (1.0 - uOvercast);

  // Stars.
  if (uStarStrength > 0.001 && up > -0.05) {
    col += vec3(0.85, 0.9, 1.0) * stars(dir) * uStarStrength * (1.0 - uOvercast * 0.95);
  }

  // Overcast flattens everything toward grey.
  vec3 overcastCol = mix(vec3(0.34, 0.36, 0.40), vec3(0.06, 0.07, 0.09), uNight);
  col = mix(col, overcastCol, uOvercast * (0.55 + horizon * 0.35));

  // Ground half of the dome.
  if (up < 0.0) {
    col = mix(col, uGroundColor, smoothstep(0.0, -0.22, up));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export const WEATHER_PRESETS = {
  clear:      { name: 'Clear',        cloud: 0.06, rain: 0,    fog: 0.00, wind: 0.18, turb: 2.0, thunder: 0,    snow: 0 },
  fair:       { name: 'Fair',         cloud: 0.26, rain: 0,    fog: 0.02, wind: 0.30, turb: 2.6, thunder: 0,    snow: 0 },
  cloudy:     { name: 'Cloudy',       cloud: 0.62, rain: 0,    fog: 0.06, wind: 0.42, turb: 3.4, thunder: 0,    snow: 0 },
  overcast:   { name: 'Overcast',     cloud: 0.92, rain: 0,    fog: 0.12, wind: 0.36, turb: 4.2, thunder: 0,    snow: 0 },
  drizzle:    { name: 'Drizzle',      cloud: 0.80, rain: 0.28, fog: 0.22, wind: 0.40, turb: 4.0, thunder: 0,    snow: 0 },
  rain:       { name: 'Rain',         cloud: 0.94, rain: 0.70, fog: 0.32, wind: 0.62, turb: 4.6, thunder: 0.04, snow: 0 },
  storm:      { name: 'Thunderstorm', cloud: 1.00, rain: 1.00, fog: 0.42, wind: 0.95, turb: 5.2, thunder: 0.55, snow: 0 },
  fog:        { name: 'Fog',          cloud: 0.55, rain: 0,    fog: 0.92, wind: 0.10, turb: 6.0, thunder: 0,    snow: 0 },
  windy:      { name: 'Windy',        cloud: 0.40, rain: 0,    fog: 0.02, wind: 1.00, turb: 2.8, thunder: 0,    snow: 0 },
  // Snow rides the same particle buffer as rain: `snow` slows the fall,
  // rounds the sprite and whitens the ground.
  snow:       { name: 'Snow',         cloud: 0.90, rain: 0.52, fog: 0.34, wind: 0.26, turb: 3.0, thunder: 0,    snow: 1 },
  blizzard:   { name: 'Blizzard',     cloud: 1.00, rain: 0.95, fog: 0.62, wind: 0.90, turb: 4.4, thunder: 0,    snow: 1 },
};

export class Atmosphere {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    // Time of day in hours [0,24). Starts mid-morning.
    this.timeOfDay = 9.5;
    this.timeScale = 60;               // 1 real second = 1 game minute
    this.day = 1;
    this.paused = false;

    this.weather = 'fair';
    this.target = { ...WEATHER_PRESETS.fair };
    this.current = { ...WEATHER_PRESETS.fair };
    this.lightning = 0;
    this.lightningTimer = 6;
    this.windPhase = 0;

    this.buildSky();
    this.buildLights();
    this.buildClouds();
    this.buildRain();
    this.update(0, new THREE.Vector3());
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(1, 32, 20);
    this.skyUniforms = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uTurbidity: { value: 2.6 },
      uOvercast: { value: 0.26 },
      uNight: { value: 0 },
      uStarStrength: { value: 0 },
      uTime: { value: 0 },
      uGroundColor: { value: new THREE.Color(0x4a4a46) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    this.sky.scale.setScalar(1);
    this.scene.add(this.sky);
  }

  buildLights() {
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true;
    this.applyShadowSettings();
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0xaebdd8, 0);
    this.moon.castShadow = false;
    this.scene.add(this.moon);
    this.scene.add(this.moon.target);

    this.hemi = new THREE.HemisphereLight(0xbcd8ff, 0x59503f, 0.6);
    this.scene.add(this.hemi);
    // A small omnidirectional floor keeps shadowed street canyons readable
    // instead of crushing to black under ACES.
    this.ambient = new THREE.AmbientLight(0xffffff, 0.12);
    this.scene.add(this.ambient);

    // A soft fill from the opposite side stops shadowed faces going pure black.
    this.fill = new THREE.DirectionalLight(0x93a8c4, 0.22);
    this.scene.add(this.fill);

    this.scene.fog = new THREE.Fog(0x9ec4e8, 120, 700);
  }

  /**
   * Indoors: the sky is still out there through the door, but the sun does not
   * reach you and the weather stops at the threshold.
   */
  setIndoors(on) {
    if (this.indoors === !!on) return;
    this.indoors = !!on;
    if (this.indoors) {
      this._inHemi = this.hemi.intensity;
      this._inAmbient = this.ambient.intensity;
      this._inSun = this.sun.intensity;
      this.hemi.intensity *= 0.35;
      this.ambient.intensity = Math.max(this.ambient.intensity, 0.22);
      this.sun.intensity *= 0.25;
    } else {
      if (this._inHemi != null) this.hemi.intensity = this._inHemi;
      if (this._inAmbient != null) this.ambient.intensity = this._inAmbient;
      if (this._inSun != null) this.sun.intensity = this._inSun;
    }
  }

  /** Underground there is no sky and no sun; the station lights do the work. */
  setUnderground(on) {
    if (this.underground === !!on) return;
    this.underground = !!on;
    if (this.sky) this.sky.visible = !this.underground;
    if (this.sun) this.sun.visible = !this.underground;
    if (this.moon) this.moon.visible = !this.underground;
    if (this.cloudGroup) this.cloudGroup.visible = !this.underground;
    if (this.rain) this.rain.visible = !this.underground;
    if (this.underground) {
      this._savedHemi = this.hemi.intensity;
      this._savedAmbient = this.ambient.intensity;
      this._savedFill = this.fill.intensity;
      this._savedFog = this.scene.fog ? { near: this.scene.fog.near, far: this.scene.fog.far, color: this.scene.fog.color.getHex() } : null;
      this.hemi.intensity = 0.12;
      this.ambient.intensity = 0.16;
      this.fill.intensity = 0.05;
      if (this.scene.fog) { this.scene.fog.near = 4; this.scene.fog.far = 90; this.scene.fog.color.setHex(0x06080a); }
      this.scene.background = new THREE.Color(0x05070a);
    } else {
      if (this._savedHemi != null) this.hemi.intensity = this._savedHemi;
      if (this._savedAmbient != null) this.ambient.intensity = this._savedAmbient;
      if (this._savedFill != null) this.fill.intensity = this._savedFill;
      if (this._savedFog && this.scene.fog) {
        this.scene.fog.near = this._savedFog.near;
        this.scene.fog.far = this._savedFog.far;
        this.scene.fog.color.setHex(this._savedFog.color);
      }
      this.scene.background = null;
    }
  }

  applyShadowSettings() {
    const p = settings.preset;
    this.sun.castShadow = p.shadows;
    if (!p.shadows) return;
    const s = this.sun.shadow;
    s.mapSize.set(p.shadowMapSize, p.shadowMapSize);
    // The governor can pull the shadow distance in without changing the preset.
    const d = p.shadowDistance * (this.shadowScale == null ? 1 : this.shadowScale);
    s.camera.left = -d; s.camera.right = d;
    s.camera.top = d; s.camera.bottom = -d;
    s.camera.near = 1;
    s.camera.far = d * 4.5;
    s.bias = -0.0006;
    s.normalBias = 0.035;
    s.camera.updateProjectionMatrix();
    if (s.map) { s.map.dispose(); s.map = null; }
  }

  /**
   * Pull the shadow cascade in or push it back out without touching the
   * preset — the fourth rung of the performance ladder.
   */
  setShadowScale(scale) {
    const k = clampv(scale == null ? 1 : scale, 0.25, 1);
    if (this.shadowScale != null && Math.abs(this.shadowScale - k) < 0.02) return;
    this.shadowScale = k;
    const p = settings.preset;
    if (!p.shadows || !this.sun.castShadow) return;
    const s = this.sun.shadow;
    const d = p.shadowDistance * k;
    s.camera.left = -d; s.camera.right = d;
    s.camera.top = d; s.camera.bottom = -d;
    s.camera.far = d * 4.5;
    s.camera.updateProjectionMatrix();
  }

  buildClouds() {
    // Two layers of soft billboarded puffs drifting at different speeds.
    this.cloudGroup = new THREE.Group();
    this.cloudGroup.name = 'clouds';
    this.scene.add(this.cloudGroup);

    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    this.cloudMat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0.6,
      color: 0xffffff, fog: false, side: THREE.DoubleSide,
    });

    const rng = makeRng(8891);
    this.clouds = [];
    const COUNT = 46;
    const plane = new THREE.PlaneGeometry(1, 1);
    const inst = new THREE.InstancedMesh(plane, this.cloudMat, COUNT * 5);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.frustumCulled = false;
    inst.renderOrder = -900;
    let n = 0;
    for (let i = 0; i < COUNT; i++) {
      const cx = rng.range(-1, 1), cz = rng.range(-1, 1);
      const layer = rng.chance(0.4) ? 1 : 0;
      const puffs = rng.int(3, 5);
      const scale = rng.range(0.7, 1.6);
      for (let j = 0; j < puffs; j++) {
        this.clouds.push({
          i: n++, bx: cx, bz: cz, layer,
          ox: rng.range(-0.06, 0.06), oz: rng.range(-0.04, 0.04),
          oy: rng.range(-0.02, 0.02),
          size: rng.range(90, 230) * scale,
          drift: rng.range(0.6, 1.4),
        });
      }
    }
    this.cloudInst = inst;
    this.cloudCount = n;
    this.cloudGroup.add(inst);
    this._cloudDummy = new THREE.Object3D();
  }

  buildRain() {
    const max = settings.preset.rainParticles;
    this.rainCount = max;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(max * 3);
    const vel = new Float32Array(max);
    const rng = makeRng(7171);
    for (let i = 0; i < max; i++) {
      pos[i * 3] = rng.range(-28, 28);
      pos[i * 3 + 1] = rng.range(0, 34);
      pos[i * 3 + 2] = rng.range(-28, 28);
      vel[i] = rng.range(0.85, 1.25);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 1));
    this.rainVel = vel;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uWind: { value: new THREE.Vector2(0, 0) },
        uColor: { value: new THREE.Color(0xbcd0e0) },
        uSnow: { value: 0 },
      },
      vertexShader: `
        attribute float aVel;
        uniform vec2 uWind;
        uniform float uSnow;
        varying float vA;
        void main(){
          vec3 p = position;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = clamp(90.0 / -mv.z, 1.0, 6.0) * (0.7 + aVel * 0.5);
          gl_PointSize = size * mix(1.0, 1.9, uSnow);
          vA = aVel;
        }`,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColor;
        uniform float uSnow;
        varying float vA;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          // Rain stretches into streaks; snow stays round and soft.
          float stretch = mix(3.2, 1.0, uSnow);
          float m = smoothstep(0.5, 0.0, length(vec2(d.x * stretch, d.y)));
          vec3 col = mix(uColor, vec3(1.0), uSnow * 0.7);
          gl_FragColor = vec4(col, m * uOpacity * (0.4 + vA * 0.5) * mix(1.0, 1.25, uSnow));
        }`,
      transparent: true, depthWrite: false, fog: false,
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 900;
    this.scene.add(this.rain);
    this.rainMat = mat;

    // Splash ring that flickers on the ground during heavy rain.
    this.splashCount = Math.min(320, Math.round(max * 0.08));
  }

  // -------------------------------------------------------------------------

  setWeather(name, instant) {
    const p = WEATHER_PRESETS[name];
    if (!p) return false;
    this.weather = name;
    this.target = { ...p };
    if (instant) this.current = { ...p };
    return true;
  }

  setTimeOfDay(hours) {
    this.timeOfDay = ((hours % 24) + 24) % 24;
  }

  /** Sun direction from time of day. Simple but with a believable arc. */
  sunDirection(out) {
    const t = (this.timeOfDay / 24) * TAU - Math.PI / 2;
    // Tilt the arc so the sun rises in the east and sets in the west.
    const elev = Math.sin(t);
    const azim = Math.cos(t);
    out = out || new THREE.Vector3();
    out.set(azim * 0.92, elev, azim * 0.28 + 0.18).normalize();
    return out;
  }

  get isNight() { return this.sunElevation < -0.05; }
  get nightFactor() { return clamp01((-this.sunElevation - 0.02) / 0.18); }

  update(dt, focus) {
    if (!this.paused) {
      this.timeOfDay += (dt * this.timeScale) / 3600;
      while (this.timeOfDay >= 24) { this.timeOfDay -= 24; this.day++; }
    }

    // Ease weather toward the target so changes are gradual, not a hard cut.
    const k = clamp01(dt * 0.35);
    for (const key of ['cloud', 'rain', 'fog', 'wind', 'turb', 'thunder', 'snow']) {
      this.current[key] = lerpv(this.current[key], this.target[key], k);
    }

    const sunDir = this.sunDirection(this._sunDir || (this._sunDir = new THREE.Vector3()));
    this.sunElevation = sunDir.y;
    const night = this.nightFactor;
    const dayAmt = clamp01(smoothstep(-0.10, 0.18, sunDir.y));
    const golden = smoothstep(0.30, -0.06, sunDir.y) * smoothstep(-0.22, 0.02, sunDir.y);

    // ---- Sky uniforms ----
    this.skyUniforms.uSunDir.value.copy(sunDir);
    this.skyUniforms.uMoonDir.value.copy(sunDir).multiplyScalar(-1);
    this.skyUniforms.uTurbidity.value = this.current.turb;
    this.skyUniforms.uOvercast.value = this.current.cloud;
    this.skyUniforms.uNight.value = night;
    this.skyUniforms.uStarStrength.value = night * (1 - this.current.cloud * 0.9);
    this.skyUniforms.uTime.value += dt;
    if (focus) this.sky.position.copy(focus);
    this.sky.scale.setScalar(Math.max(50, settings.preset.drawDistance * 1.4));

    // ---- Sun / moon lights ----
    const sunStrength = clamp01(sunDir.y * 2.2) * (1 - this.current.cloud * 0.72);
    const sunColor = this._sunColor || (this._sunColor = new THREE.Color());
    sunColor.setRGB(1, 1, 1)
      .lerp(new THREE.Color(1.0, 0.62, 0.34), golden * 0.85)
      .lerp(new THREE.Color(0.75, 0.80, 0.92), this.current.cloud * 0.5);
    this.sun.color.copy(sunColor);
    this.sun.intensity = sunStrength * 3.1;
    this.sun.visible = this.sun.intensity > 0.01;

    this.moon.intensity = night * 0.30 * (1 - this.current.cloud * 0.8);
    this.moon.visible = this.moon.intensity > 0.005;

    if (focus) {
      const d = settings.preset.shadowDistance * (this.shadowScale == null ? 1 : this.shadowScale);
      this.sun.position.copy(focus).addScaledVector(sunDir, Math.max(60, d * 1.6));
      this.sun.target.position.copy(focus);
      this.sun.target.updateMatrixWorld();
      this.moon.position.copy(focus).addScaledVector(sunDir, -Math.max(60, d * 1.6));
      this.moon.target.position.copy(focus);
      this.moon.target.updateMatrixWorld();
      this.fill.position.copy(focus).add(new THREE.Vector3(-sunDir.x * 50, 40, -sunDir.z * 50));
    }

    // ---- Ambient ----
    const skyTop = this._skyTop || (this._skyTop = new THREE.Color());
    const groundCol = this._groundCol || (this._groundCol = new THREE.Color());
    skyTop.setRGB(0.35, 0.52, 0.85)
      .lerp(new THREE.Color(0.55, 0.30, 0.22), golden * 0.7)
      .lerp(new THREE.Color(0.030, 0.045, 0.10), night)
      .lerp(new THREE.Color(0.30, 0.32, 0.36), this.current.cloud * 0.55);
    groundCol.setRGB(0.30, 0.27, 0.22)
      .lerp(new THREE.Color(0.035, 0.035, 0.045), night);
    this.hemi.color.copy(skyTop);
    this.hemi.groundColor.copy(groundCol);
    this.hemi.intensity = lerpv(0.14, 1.85, dayAmt) * (1 + this.current.cloud * 0.45) + night * 0.10;
    this.ambient.color.copy(skyTop);
    this.ambient.intensity = lerpv(0.05, 0.42, dayAmt) * (1 + this.current.cloud * 0.35);
    this.fill.intensity = lerpv(0.04, 0.46, dayAmt) * (1 - this.current.cloud * 0.4);

    // ---- Fog matched to the horizon so distance dissolves into sky ----
    const fogCol = this._fogCol || (this._fogCol = new THREE.Color());
    fogCol.setRGB(0.68, 0.79, 0.92)
      .lerp(new THREE.Color(0.92, 0.55, 0.32), golden * 0.8)
      .lerp(new THREE.Color(0.045, 0.06, 0.11), night)
      .lerp(new THREE.Color(0.55, 0.57, 0.60), this.current.cloud * 0.6);
    this.scene.fog.color.copy(fogCol);
    const drawD = settings.preset.drawDistance;
    const fogAmt = clamp01(this.current.fog);
    this.scene.fog.near = lerpv(settings.preset.fogStart, 6, fogAmt);
    this.scene.fog.far = lerpv(drawD * 1.05, 70, fogAmt);
    if (this.scene.background && this.scene.background.isColor) this.scene.background.copy(fogCol);
    this.skyUniforms.uGroundColor.value.copy(fogCol).multiplyScalar(0.55);

    // ---- Clouds ----
    this.updateClouds(dt, focus, night);

    // ---- Rain ----
    this.updateRain(dt, focus);

    // ---- Lightning ----
    this.updateLightning(dt);

    this.windPhase += dt * (0.3 + this.current.wind);
  }

  updateClouds(dt, focus, night) {
    const inst = this.cloudInst;
    if (!inst) return;
    const cover = this.current.cloud;
    const visible = Math.round(clamp01(cover * 1.15) * this.cloudCount);
    inst.count = visible;
    const d = this._cloudDummy;
    const t = this.skyUniforms.uTime.value;
    const spread = Math.max(900, settings.preset.drawDistance * 1.5);
    const fx = focus ? focus.x : 0, fz = focus ? focus.z : 0;
    for (let i = 0; i < visible; i++) {
      const c = this.clouds[i];
      const drift = t * (2.2 + this.current.wind * 9) * c.drift * (c.layer ? 0.6 : 1);
      let x = ((c.bx * spread + drift) % (spread * 2) + spread * 3) % (spread * 2) - spread;
      const z = c.bz * spread + c.oz * spread;
      const y = (c.layer ? 320 : 220) + c.oy * 400;
      d.position.set(fx + x + c.ox * spread, y, fz + z);
      d.scale.setScalar(c.size);
      d.quaternion.set(0, 0, 0, 1);
      d.lookAt(fx, y - 60, fz);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    const tint = lerpv(1, 0.16, night);
    const stormy = clamp01((cover - 0.6) / 0.4);
    this.cloudMat.color.setRGB(tint * lerpv(1, 0.55, stormy), tint * lerpv(1, 0.56, stormy), tint * lerpv(1, 0.62, stormy));
    this.cloudMat.opacity = clamp01(0.18 + cover * 0.55) * (1 - this.current.fog * 0.6);
  }

  updateRain(dt, focus) {
    const amount = clamp01(this.current.rain);
    const snow = clamp01(this.current.snow || 0);
    this.rainMat.uniforms.uOpacity.value = amount * 0.85;
    this.rainMat.uniforms.uSnow.value = snow;
    // Rain stops at the threshold: underground and indoors there is none.
    this.rain.visible = amount > 0.02 && !this.underground && !this.indoors;
    if (!this.rain.visible || !focus) return;
    const pos = this.rain.geometry.attributes.position;
    const arr = pos.array;
    // The particle dial decides how many of the buffer's drops are alive, and
    // the draw range means the rest cost nothing to skip.
    const active = Math.round(this.rainCount * amount * perf.particles);
    this.rain.geometry.setDrawRange(0, Math.max(1, active));
    const windX = Math.cos(this.windPhase * 0.3) * this.current.wind * 6;
    const windZ = Math.sin(this.windPhase * 0.23) * this.current.wind * 6;
    this.rainMat.uniforms.uWind.value.set(windX, windZ);
    // Flakes drift; drops fall. Snow also wanders sideways as it comes down.
    const fall = (26 + amount * 16) * lerpv(1, 0.13, snow);
    const drift = snow > 0.01 ? Math.sin(this.windPhase * 1.7) * 1.6 * snow : 0;
    for (let i = 0; i < active; i++) {
      const i3 = i * 3;
      arr[i3 + 1] -= fall * this.rainVel[i] * dt;
      arr[i3] += (windX + drift * Math.sin(i * 0.7)) * dt;
      arr[i3 + 2] += (windZ + drift * Math.cos(i * 1.3)) * dt;
      if (arr[i3 + 1] < -2) {
        arr[i3] = (Math.random() - 0.5) * 60;
        arr[i3 + 1] = 28 + Math.random() * 10;
        arr[i3 + 2] = (Math.random() - 0.5) * 60;
      }
    }
    pos.needsUpdate = true;
    this.rain.position.set(focus.x, focus.y, focus.z);
  }

  updateLightning(dt) {
    const chance = this.current.thunder;
    if (this.lightning > 0) {
      this.lightning = Math.max(0, this.lightning - dt * 7);
      this.hemi.intensity += this.lightning * 3.2;
      this.fill.intensity += this.lightning * 2.0;
    }
    if (chance <= 0.001) return;
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningTimer = lerpv(16, 3.5, chance) * (0.5 + Math.random());
      this.lightning = 1;
      const dist = 40 + Math.random() * 340;
      audio.thunder(dist);
      if (this.onLightning) this.onLightning(dist);
    }
  }

  /** Wind vector used by trees, rain and loose props. */
  windVector(out) {
    out = out || new THREE.Vector2();
    const w = this.current.wind;
    out.set(
      Math.cos(this.windPhase * 0.31) * w + noise1(this.windPhase * 0.8, 3) * w * 0.4,
      Math.sin(this.windPhase * 0.27) * w + noise1(this.windPhase * 0.7, 9) * w * 0.4
    );
    return out;
  }

  /** Human-readable clock, e.g. "7:42 PM". */
  clockString() {
    const h = Math.floor(this.timeOfDay);
    const m = Math.floor((this.timeOfDay - h) * 60);
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }

  partOfDay() {
    const t = this.timeOfDay;
    if (t < 5) return 'the dead of night';
    if (t < 7) return 'dawn';
    if (t < 11) return 'morning';
    if (t < 14) return 'midday';
    if (t < 17) return 'afternoon';
    if (t < 19.5) return 'evening';
    if (t < 22) return 'dusk';
    return 'night';
  }

  weatherName() { return (WEATHER_PRESETS[this.weather] || WEATHER_PRESETS.fair).name; }

  ambientState(worldPos, world) {
    const urban = world ? clamp01(1 - Math.max(Math.abs(worldPos.x), Math.abs(worldPos.z)) / 700) : 0.5;
    const coastal = clamp01((worldPos.z - 380) / 300);
    const district = world ? world.city.districtAt(worldPos.x, worldPos.z) : 'downtown';
    const nature = (district === 'park' || district === 'forest' || district === 'countryside') ? 1 : 0.15;
    return {
      wind: this.current.wind, rain: this.current.rain,
      urban, coastal, nature, night: this.nightFactor,
      indoors: false,
    };
  }

  applySettings() {
    this.applyShadowSettings();
    // Rain buffer size follows the quality preset.
    if (this.rainCount !== settings.preset.rainParticles) {
      this.scene.remove(this.rain);
      this.rain.geometry.dispose();
      this.rainMat.dispose();
      this.buildRain();
    }
  }

  dispose() {
    this.scene.remove(this.sky, this.sun, this.moon, this.hemi, this.ambient, this.fill, this.cloudGroup, this.rain);
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.rain.geometry.dispose();
    this.rainMat.dispose();
    this.cloudInst.geometry.dispose();
    this.cloudMat.dispose();
  }
}
