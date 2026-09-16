// T10 World - quality presets, user settings, persistence
import { clamp01, clampv } from './math.js';

const STORAGE_KEY = 't10world.settings.v1';

/**
 * Quality presets. Every renderer/world/AI budget in the game reads from here,
 * so switching preset at runtime rescales the entire simulation, not just pixels.
 */
export const QUALITY_PRESETS = {
  low: {
    label: 'LOW',
    blurb: 'Built for phones. Short view, simple light, small crowds — and it stays smooth.',
    // ---- Render ----
    pixelRatioCap: 1.0,
    renderScale: 0.70,
    antialias: false,
    // ---- Shadows ----
    shadows: false,
    shadowMapSize: 512,
    shadowDistance: 35,
    cascades: 1,
    contactShadows: false,
    // ---- World detail ----
    drawDistance: 260,
    streamDistance: 300,
    fogStart: 95,
    propDensity: 0.45,
    treeDensity: 0.40,
    grassDensity: 0.0,
    interiorDetail: 0,
    lodBias: 1.7,           // multiplies every LOD switch distance down
    // ---- Simulation ----
    npcBudget: 24,
    npcDetailDistance: 20,
    npcSimDistance: 90,     // full AI inside this, cheap steering beyond
    backgroundNpcs: 40,     // people tracked with no body at all
    vehicleBudget: 12,
    animalBudget: 6,
    physicsRate: 1,         // vehicle substeps
    // ---- Effects ----
    bloom: false,
    ssr: false,
    ssao: false,
    motionBlur: false,
    reflectionProbe: false,
    volumetricLight: false,
    rainParticles: 700,
    goreBudget: 0.45,       // scales decals, droplets and gibs
    puddles: false,
    // ---- Textures and characters ----
    anisotropy: 2,
    textureSize: 256,
    humanSegments: 6,
    humanLodBias: 1.7,
    fingerBones: false,
    facialAnimation: false,
    animationRate: 22,      // full-quality animation updates per second
    windowLights: 0.5,
    maxDynamicLights: 2,
  },

  high: {
    label: 'HIGH',
    blurb: 'Balanced. Real shadows, wet-road reflections, busy streets, detailed people.',
    pixelRatioCap: 1.75,
    renderScale: 1.0,
    antialias: true,

    shadows: true,
    shadowMapSize: 2048,
    shadowDistance: 120,
    cascades: 2,
    contactShadows: true,

    drawDistance: 700,
    streamDistance: 620,
    fogStart: 300,
    propDensity: 1.0,
    treeDensity: 1.0,
    grassDensity: 0.7,
    interiorDetail: 2,
    lodBias: 1.0,

    npcBudget: 90,
    npcDetailDistance: 46,
    npcSimDistance: 220,
    backgroundNpcs: 160,
    vehicleBudget: 42,
    animalBudget: 18,
    physicsRate: 2,

    bloom: true,
    ssr: true,
    ssao: true,
    motionBlur: false,
    reflectionProbe: true,
    volumetricLight: false,
    rainParticles: 4200,
    goreBudget: 1.0,
    puddles: true,

    anisotropy: 8,
    textureSize: 512,
    humanSegments: 10,
    humanLodBias: 1.0,
    fingerBones: true,
    facialAnimation: true,
    animationRate: 60,
    windowLights: 1.0,
    maxDynamicLights: 8,
  },

  ultra: {
    label: 'ULTRA',
    blurb: 'Everything on. Ray-marched reflections, deep shadows, dense crowds, the longest view.',
    pixelRatioCap: 2.0,
    renderScale: 1.0,
    antialias: true,

    shadows: true,
    shadowMapSize: 4096,
    shadowDistance: 180,
    cascades: 3,
    contactShadows: true,

    drawDistance: 1100,
    streamDistance: 820,
    fogStart: 480,
    propDensity: 1.35,
    treeDensity: 1.4,
    grassDensity: 1.0,
    interiorDetail: 3,
    lodBias: 0.62,

    npcBudget: 150,
    npcDetailDistance: 72,
    npcSimDistance: 340,
    backgroundNpcs: 300,
    vehicleBudget: 64,
    animalBudget: 30,
    physicsRate: 3,

    bloom: true,
    ssr: true,
    ssao: true,
    motionBlur: true,
    reflectionProbe: true,
    volumetricLight: true,
    rainParticles: 9000,
    goreBudget: 1.6,
    puddles: true,

    anisotropy: 16,
    textureSize: 1024,
    humanSegments: 14,
    humanLodBias: 0.6,
    fingerBones: true,
    facialAnimation: true,
    animationRate: 60,
    windowLights: 1.0,
    maxDynamicLights: 14,
  },
};

export const QUALITY_ORDER = ['low', 'high', 'ultra'];

const DEFAULTS = {
  quality: 'high',
  masterVolume: 0.8,
  musicVolume: 0.35,
  sfxVolume: 0.9,
  fov: 62,
  cameraMode: 'first',       // 'first' | 'third' — changed in Settings
  invertY: false,
  lookSensitivity: 1.0,
  touchLookSensitivity: 1.0,
  showInteractPrompts: true,
  motionBlurAmount: 0.5,
  autoQuality: true,
  qualityPinned: false,
  // Content rating. 18 is the default and shows the violence in full; 16
  // tones the blood down. Nothing here is hidden behind a paywall or a
  // prompt — it is one switch in Settings.
  maturity: 18,
  goreLevel: 1,
  hapticFeedback: true,
  leftHandedTouch: false,
  keyBindings: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    jump: 'Space', crouch: 'ControlLeft',
    interact: 'KeyE', enterVehicle: 'KeyF', t10: 'KeyT',
    camera: 'KeyV', settings: 'Escape', map: 'KeyM',
    handbrake: 'Space', horn: 'KeyH', lights: 'KeyL', signalLeft: 'KeyQ', signalRight: 'KeyR',
    reload: 'KeyR', holster: 'KeyG',
  },
};

class SettingsStore {
  constructor() {
    this.data = JSON.parse(JSON.stringify(DEFAULTS));
    this.listeners = new Set();
    this.load();
  }

  get preset() { return QUALITY_PRESETS[this.data.quality] || QUALITY_PRESETS.high; }
  get(key) { return this.data[key]; }

  set(key, value) {
    if (this.data[key] === value) return;
    this.data[key] = value;
    this.save();
    this.emit(key, value);
  }

  setKeyBinding(action, code) {
    this.data.keyBindings[action] = code;
    this.save();
    this.emit('keyBindings', this.data.keyBindings);
  }

  setMaturity(age) {
    const a = age >= 18 ? 18 : 16;
    this.data.maturity = a;
    this.data.goreLevel = a >= 18 ? 1 : 0.35;
    this.save();
    this.emit('maturity', a);
    return a;
  }

  setQuality(name) {
    if (!QUALITY_PRESETS[name]) return false;
    this.data.quality = name;
    this.data.qualityPinned = true;
    this.save();
    this.emit('quality', name);
    return true;
  }

  stepQuality(dir) {
    const i = QUALITY_ORDER.indexOf(this.data.quality);
    const next = QUALITY_ORDER[clampv(i + dir, 0, QUALITY_ORDER.length - 1)];
    this.setQuality(next);
    return next;
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(key, value) { for (const fn of this.listeners) { try { fn(key, value); } catch (e) { console.warn('settings listener', e); } } }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { this.detectDefaults(); return; }
      const parsed = JSON.parse(raw);
      Object.assign(this.data, parsed);
      this.data.keyBindings = Object.assign({}, DEFAULTS.keyBindings, parsed.keyBindings || {});
      if (!QUALITY_PRESETS[this.data.quality]) this.data.quality = 'high';
    } catch (e) { this.detectDefaults(); }
  }

  /** First launch: guess a sane preset from the device instead of dumping ULTRA on a phone. */
  detectDefaults() {
    // Everyone starts on HIGH, phone or desktop. The frame governor trims the
    // load to hold the frame rate rather than handing anyone a downgraded
    // world up front, and it gives the detail back as soon as there's headroom.
    this.data.quality = 'high';
    this.data.autoQuality = true;
    this.save();
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULTS));
    this.detectDefaults();
    this.emit('*', this.data);
  }
}

export const settings = new SettingsStore();

/**
 * The live load multiplier, 0.3–1, published by the frame governor so every
 * system can trim itself without reaching into the game object.
 */
export const perf = { load: 1 };

/**
 * Adaptive resolution. Nudges render scale between 0.55 and the preset ceiling so a
 * mid-range phone keeps a playable framerate instead of dropping to a slideshow.
 */
/**
 * Holds the frame rate without changing the preset you chose.
 *
 * Two dials. `load` trims how much world is simulated and streamed — crowd
 * size, traffic, draw distance — and `scale` trims render resolution. Load
 * goes first, because forty people on a sharp screen reads better than
 * ninety on a blurry one, and it comes back last for the same reason.
 */
export class PerformanceGovernor {
  constructor() {
    this.samples = [];
    this.scale = 1;
    this.load = 1;
    this.cooldown = 2;
    this.targetMs = 1000 / 55;
    this.enabled = true;
  }
  update(dt, monitor) {
    if (!this.enabled) return this.scale;
    this.samples.push(dt * 1000);
    if (this.samples.length > 90) this.samples.shift();
    this.cooldown -= dt;
    if (this.cooldown > 0 || this.samples.length < 60) return this.scale;
    this.cooldown = 1.2;
    const sorted = this.samples.slice().sort((a, b) => a - b);
    // Judge on the median, but let the monitor's 95th percentile and its heap
    // pressure force a cut too: a good average with a stutter every second is
    // worse to play than a slightly lower ceiling.
    let median = sorted[Math.floor(sorted.length * 0.5)];
    if (monitor) {
      if (monitor.p95Ms > this.targetMs * 1.9) median = Math.max(median, this.targetMs * 1.4);
      if (monitor.heapPressure > 0.85) median = Math.max(median, this.targetMs * 1.4);
    }
    if (median > this.targetMs * 1.28) {
      if (this.load > 0.3) this.load = Math.max(0.3, this.load - 0.12);
      else this.scale = Math.max(0.55, this.scale - 0.08);
    } else if (median < this.targetMs * 0.82) {
      if (this.scale < 1) this.scale = Math.min(1, this.scale + 0.05);
      else this.load = Math.min(1, this.load + 0.05);
    }
    return this.scale;
  }
  get fps() {
    if (!this.samples.length) return 60;
    let s = 0; for (const v of this.samples) s += v;
    return 1000 / (s / this.samples.length);
  }
}
