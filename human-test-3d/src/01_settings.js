// ============================================================================
// Settings — defaults, persistence (localStorage), change notifications
// ============================================================================
const SETTINGS_KEY = 'humantest3d.settings.v3';

const DEFAULT_SETTINGS = {
  graphics: {
    preset: 'high',            // low | high | ultra | custom
    resolutionScale: 1.0,      // multiplier of device pixel ratio (capped)
    shadowQuality: 'high',     // off | low | high | ultra
    textureQuality: 'high',    // low | high | ultra
    fpsCap: 60,                // 30 | 60 | 0 (unlimited)
    ssao: false,
    antialias: true,
    showFps: false,
    characterDetail: 'high'    // low | high | ultra
  },
  audio: { master: 0.8, effects: 0.9, ambience: 0.55, ui: 0.6, muted: false },
  physics: {
    gravity: 9.81, forceScale: 1.0, massScale: 1.0, friction: 0.65, bounciness: 0.1,
    npcCollisions: true, selfCollisions: true, propCollisions: true, substeps: 8, muscleTone: 0.35, paused: false
  },
  ai: { enabled: true, reactions: true, flee: true, wander: true, lookAt: true, reactionVariance: 1.0, wanderRate: 0.5 },
  zombies: {
    reincarnation: true, delayPreset: 'short', delay: 5, headTraumaPrevents: true,
    aggression: true, targetNPCs: true, detection: 18, speed: 1.0, targetMode: 'nearest',
    attackDamage: 18, vocalize: true, infection: true, infectionTime: 12, feeding: true, biteDamage: 24
  },
  gore: { level: 'extreme', dismember: true, gibs: true, pools: true, screenBlood: true, blood: 1.0 },
  weapons: {
    enabled: { pistol: true, sniper: true, knife: true, grenade: true, bazooka: true, hand: true, move: true },
    infiniteAmmo: true, autoReload: true, damageScale: 1.0, simulatedDamage: true,
    pistolAuto: false, grenadeFuse: 3.0, grenadeRadius: 7.5, bulletPenetration: true,
    pistolMag: 15, sniperMag: 5, reserveMags: 6
  },
  diagnostics: { labels: false, hitOverlay: true, debugPanel: false, colliders: false, eventLog: false, npcNames: false },
  environment: {
    current: 'room',
    room: { width: 32, depth: 32, height: 9, grid: true, markers: true, light: 1.0, colorTemp: 5600 },
    field: { timeOfDay: 14.0, weather: 'clear', wind: 0.45 }
  },
  spawn: {
    count: 1, mode: 'crosshair', pose: 'idle', gender: 'random',
    heightMinM: 1.62, heightMaxM: 1.95, heightMinF: 1.50, heightMaxF: 1.80
  },
  controls: { sensitivity: 1.0, invertY: false, touch: 'auto', fov: 70 },
  ui: { hints: true }
};

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function deepMerge(base, over) {
  if (!over || typeof over !== 'object') return base;
  for (const k of Object.keys(over)) {
    if (!(k in base)) continue; // ignore unknown keys from older versions
    const bv = base[k], ov = over[k];
    if (bv && typeof bv === 'object' && !Array.isArray(bv)) deepMerge(bv, ov);
    else if (typeof ov === typeof bv) base[k] = ov;
  }
  return base;
}

const Settings = {
  data: deepClone(DEFAULT_SETTINGS),
  _saveTimer: 0,
  storageOk: true,
  load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) deepMerge(this.data, JSON.parse(raw));
    } catch (e) { this.storageOk = false; }
    return this.data;
  },
  save() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data)); } catch (e) { this.storageOk = false; }
    }, 250);
  },
  get(path) {
    let o = this.data; for (const p of path.split('.')) { if (o == null) return undefined; o = o[p]; } return o;
  },
  set(path, value, silent) {
    const parts = path.split('.'); let o = this.data;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    const old = o[parts[parts.length - 1]];
    o[parts[parts.length - 1]] = value;
    this.save();
    if (!silent && old !== value) Events.emit('settings', { path, value, old });
  },
  resetAll() {
    this.data = deepClone(DEFAULT_SETTINGS);
    this.save();
    Events.emit('settings', { path: '*', value: null });
  }
};
HT.Settings = Settings;
