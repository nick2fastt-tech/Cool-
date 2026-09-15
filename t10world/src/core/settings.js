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
    blurb: 'Runs on almost anything. Simple lighting, short draw distance.',
    pixelRatioCap: 1.0,
    renderScale: 0.72,
    shadows: false,
    shadowMapSize: 512,
    shadowDistance: 40,
    cascades: 1,
    drawDistance: 240,
    fogStart: 90,
    npcBudget: 26,
    npcDetailDistance: 22,
    vehicleBudget: 14,
    animalBudget: 8,
    propDensity: 0.45,
    treeDensity: 0.4,
    grassDensity: 0.0,
    bloom: false,
    ssr: false,
    ssao: false,
    motionBlur: false,
    contactShadows: false,
    reflectionProbe: false,
    rainParticles: 900,
    puddles: false,
    anisotropy: 2,
    textureSize: 256,
    humanSegments: 6,     // radial segments on limbs
    humanLodBias: 1.6,
    fingerBones: false,
    facialAnimation: false,
    interiorDetail: 0,
    volumetricLight: false,
    windowLights: 0.5,
    maxDynamicLights: 2,
    antialias: false,
  },
  medium: {
    label: 'MEDIUM',
    blurb: 'Balanced. Soft shadows, full crowd life, decent distance.',
    pixelRatioCap: 1.35,
    renderScale: 0.9,
    shadows: true,
    shadowMapSize: 1024,
    shadowDistance: 70,
    cascades: 1,
    drawDistance: 420,
    fogStart: 160,
    npcBudget: 55,
    npcDetailDistance: 34,
    vehicleBudget: 26,
    animalBudget: 16,
    propDensity: 0.75,
    treeDensity: 0.7,
    grassDensity: 0.35,
    bloom: true,
    ssr: false,
    ssao: true,
    motionBlur: false,
    contactShadows: true,
    reflectionProbe: false,
    rainParticles: 2200,
    puddles: true,
    anisotropy: 4,
    textureSize: 512,
    humanSegments: 8,
    humanLodBias: 1.0,
    fingerBones: true,
    facialAnimation: true,
    interiorDetail: 1,
    volumetricLight: false,
    windowLights: 0.75,
    maxDynamicLights: 5,
    antialias: true,
  },
  high: {
    label: 'HIGH',
    blurb: 'Full detail world. Crisp shadows, ambient occlusion, dense crowds.',
    pixelRatioCap: 1.75,
    renderScale: 1.0,
    shadows: true,
    shadowMapSize: 2048,
    shadowDistance: 110,
    cascades: 2,
    drawDistance: 700,
    fogStart: 280,
    npcBudget: 95,
    npcDetailDistance: 48,
    vehicleBudget: 44,
    animalBudget: 28,
    propDensity: 1.0,
    treeDensity: 1.0,
    grassDensity: 0.7,
    bloom: true,
    ssr: false,
    ssao: true,
    motionBlur: true,
    contactShadows: true,
    reflectionProbe: true,
    rainParticles: 4200,
    puddles: true,
    anisotropy: 8,
    textureSize: 1024,
    humanSegments: 12,
    humanLodBias: 0.7,
    fingerBones: true,
    facialAnimation: true,
    interiorDetail: 2,
    volumetricLight: true,
    windowLights: 1.0,
    maxDynamicLights: 9,
    antialias: true,
  },
  ultra: {
    label: 'ULTRA',
    blurb: 'RTX renders. Screen-space ray-traced reflections, volumetric light, full crowds.',
    pixelRatioCap: 2.0,
    renderScale: 1.0,
    shadows: true,
    shadowMapSize: 4096,
    shadowDistance: 165,
    cascades: 3,
    drawDistance: 1100,
    fogStart: 420,
    npcBudget: 150,
    npcDetailDistance: 70,
    vehicleBudget: 70,
    animalBudget: 44,
    propDensity: 1.0,
    treeDensity: 1.0,
    grassDensity: 1.0,
    bloom: true,
    ssr: true,
    ssao: true,
    motionBlur: true,
    contactShadows: true,
    reflectionProbe: true,
    rainParticles: 7000,
    puddles: true,
    anisotropy: 16,
    textureSize: 1024,
    humanSegments: 16,
    humanLodBias: 0.5,
    fingerBones: true,
    facialAnimation: true,
    interiorDetail: 3,
    volumetricLight: true,
    windowLights: 1.0,
    maxDynamicLights: 14,
    antialias: true,
  },
};

export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];

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
  hapticFeedback: true,
  leftHandedTouch: false,
  keyBindings: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    jump: 'Space', crouch: 'ControlLeft',
    interact: 'KeyE', enterVehicle: 'KeyF', t10: 'KeyT',
    camera: 'KeyV', settings: 'Escape', map: 'KeyM',
    handbrake: 'Space', horn: 'KeyH', lights: 'KeyL', signalLeft: 'KeyQ', signalRight: 'KeyR',
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

  setQuality(name) {
    if (!QUALITY_PRESETS[name]) return false;
    this.data.quality = name;
    this.data.autoQuality = false;
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
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const small = Math.min(screen.width, screen.height) < 820;
    let q = 'high';
    if (touch && small) q = mem >= 6 && cores >= 8 ? 'medium' : 'low';
    else if (cores >= 12 && mem >= 8) q = 'ultra';
    else if (cores <= 4 || mem <= 4) q = 'medium';
    this.data.quality = q;
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
 * Adaptive resolution. Nudges render scale between 0.55 and the preset ceiling so a
 * mid-range phone keeps a playable framerate instead of dropping to a slideshow.
 */
export class PerformanceGovernor {
  constructor() {
    this.samples = [];
    this.scale = 1;
    this.cooldown = 2;
    this.targetMs = 1000 / 55;
    this.enabled = true;
  }
  update(dt) {
    if (!this.enabled) return this.scale;
    this.samples.push(dt * 1000);
    if (this.samples.length > 90) this.samples.shift();
    this.cooldown -= dt;
    if (this.cooldown > 0 || this.samples.length < 60) return this.scale;
    this.cooldown = 1.5;
    const sorted = this.samples.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length * 0.5)];
    if (median > this.targetMs * 1.28) this.scale = Math.max(0.55, this.scale - 0.08);
    else if (median < this.targetMs * 0.82) this.scale = Math.min(1, this.scale + 0.05);
    return this.scale;
  }
  get fps() {
    if (!this.samples.length) return 60;
    let s = 0; for (const v of this.samples) s += v;
    return 1000 / (s / this.samples.length);
  }
}
