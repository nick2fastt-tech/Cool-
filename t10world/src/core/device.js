// T10 World - what this device can actually do.
//
// The three presets say what the game should look like. This says how much of
// it this machine can carry, so ULTRA on a phone is still ULTRA — every effect
// on, every system running — at numbers a phone can hold at sixty frames,
// rather than a desktop's numbers that would melt it.
//
// Nothing here is a brand check. It reads the things browsers actually report:
// touch, screen size, cores, memory and what the GL driver will admit to.

export const TIERS = ['phone', 'tablet', 'laptop', 'desktop'];

/**
 * Per-tier multipliers, by what the number is for. A new preset field only
 * needs adding to FIELD_GROUP below; the scaling comes for free.
 *
 *   distance   how far you can see and how far the world streams
 *   counts     how many people, cars, animals are simulated
 *   shadow     shadow map size and distance
 *   texture    texture resolution and anisotropy
 *   particles  rain, blood, anything spawned in bulk
 *   lights     simultaneous dynamic lights
 *   mesh       how many segments a body is built from
 *   density    props, trees, grass
 */
export const TIER_SCALE = {
  desktop: { distance: 1.00, counts: 1.00, shadow: 1.00, texture: 1.00, particles: 1.00, lights: 1.00, mesh: 1.00, density: 1.00 },
  laptop:  { distance: 0.84, counts: 0.74, shadow: 0.70, texture: 1.00, particles: 0.70, lights: 0.85, mesh: 0.90, density: 0.92 },
  tablet:  { distance: 0.66, counts: 0.48, shadow: 0.50, texture: 0.50, particles: 0.42, lights: 0.60, mesh: 0.78, density: 0.80 },
  phone:   { distance: 0.54, counts: 0.32, shadow: 0.38, texture: 0.50, particles: 0.26, lights: 0.46, mesh: 0.70, density: 0.72 },
};

/** Which multiplier each preset field takes. Anything unlisted is left alone. */
export const FIELD_GROUP = {
  drawDistance: 'distance', streamDistance: 'distance', fogStart: 'distance',
  npcDetailDistance: 'distance', npcSimDistance: 'distance',

  npcBudget: 'counts', backgroundNpcs: 'counts', vehicleBudget: 'counts', animalBudget: 'counts',

  shadowMapSize: 'shadow', shadowDistance: 'shadow',

  textureSize: 'texture', anisotropy: 'texture',

  rainParticles: 'particles', goreBudget: 'particles',

  maxDynamicLights: 'lights',

  humanSegments: 'mesh',

  propDensity: 'density', treeDensity: 'density', grassDensity: 'density',
};

/** Fields that must stay a power of two. */
const POW2 = { shadowMapSize: 512, textureSize: 128, anisotropy: 1 };
/** Fields that must stay whole numbers, with a floor. */
const INTEGER = {
  npcBudget: 8, backgroundNpcs: 0, vehicleBudget: 4, animalBudget: 2,
  maxDynamicLights: 2, humanSegments: 5, rainParticles: 200, cascades: 1,
  physicsRate: 1, interiorDetail: 0,
};

/** The nearest power of two, measured the way sizes are felt: on a log scale. */
function nearPow2(v, min) {
  if (!(v > 0)) return min;
  const p = Math.pow(2, Math.round(Math.log2(v)));
  return Math.max(min, p);
}

function pow2Down(v, min) {
  let p = 1;
  while (p * 2 <= v) p *= 2;
  return Math.max(min, p);
}

/**
 * How hard the device scaling bites, per preset. LOW was already written for a
 * phone, so scaling it again would gut it; ULTRA was written for a desktop, so
 * it takes the full adjustment. This is what lets ULTRA mean "everything on,
 * sized for what you're holding" instead of "everything on, good luck".
 */
export const PRESET_SENSITIVITY = { low: 0.25, high: 0.70, ultra: 1.00 };

/**
 * Read the device once. Everything is optional — a browser that reports
 * nothing lands on 'laptop', which is the safe middle.
 */
export function detectDevice() {
  const nav = typeof navigator === 'undefined' ? {} : navigator;
  const win = typeof window === 'undefined' ? {} : window;
  const scr = typeof screen === 'undefined' ? {} : screen;

  const touch = (nav.maxTouchPoints || 0) > 0 || ('ontouchstart' in win);
  const w = scr.width || win.innerWidth || 1280;
  const h = scr.height || win.innerHeight || 720;
  const shortSide = Math.min(w, h);
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || (touch ? 4 : 8);
  const dpr = win.devicePixelRatio || 1;

  let tier;
  if (touch && shortSide <= 540) tier = 'phone';
  else if (touch) tier = 'tablet';
  else if (cores <= 4 || memory <= 4) tier = 'laptop';
  else tier = 'desktop';

  // A flagship phone and a budget one are both phones, but not the same phone.
  // 0 is the weakest thing in the tier, 1 the strongest.
  const power = Math.max(0, Math.min(1,
    (Math.min(cores, 12) / 12) * 0.55 + (Math.min(memory, 12) / 12) * 0.45));

  let maxTexture = 4096;
  try {
    const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    if (gl) {
      maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const r = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
        // Software rendering is the one case worth naming: it is never fast.
        if (/swiftshader|llvmpipe|software/i.test(r)) tier = 'phone';
      }
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  } catch (e) { /* no WebGL yet; the defaults are fine */ }

  return { tier, power, touch, cores, memory, dpr, screenW: w, screenH: h, maxTexture };
}

/**
 * Apply a device to a preset. Booleans are untouched — every effect the preset
 * turns on stays on — and only the budgets move.
 * @param base one of QUALITY_PRESETS
 * @param device from detectDevice()
 */
export function effectivePreset(base, device, presetName) {
  const dev = device || { tier: 'desktop', power: 1, dpr: 1, maxTexture: 4096 };
  const scale = TIER_SCALE[dev.tier] || TIER_SCALE.desktop;
  // Within a tier, a stronger device gets more of everything countable.
  const nudge = 0.78 + 0.44 * (dev.power == null ? 1 : dev.power);
  const name = presetName || (base.label ? String(base.label).toLowerCase() : 'high');
  const bite = PRESET_SENSITIVITY[name] == null ? 0.7 : PRESET_SENSITIVITY[name];
  const out = {};

  for (const key in base) {
    const v = base[key];
    const group = FIELD_GROUP[key];
    if (typeof v !== 'number' || !group) { out[key] = v; continue; }
    let k = scale[group];
    if (group === 'counts' || group === 'particles') k *= nudge;
    // Blend toward 1 by how much this preset should feel the device, and never
    // above it: what the preset says is the ceiling, and the device only ever
    // takes away. A strong machine gets the preset as written, not more.
    k = Math.min(1, 1 + (k - 1) * bite);
    let next = v * k;
    if (POW2[key] != null) next = nearPow2(next, POW2[key]);
    else if (INTEGER[key] != null) next = Math.max(INTEGER[key], Math.round(next));
    else next = Math.round(next * 100) / 100;
    out[key] = next;
  }

  // Things that are not a simple multiply.
  if (dev.tier === 'phone' || dev.tier === 'tablet') {
    // Cascades cost a full shadow pass each.
    out.cascades = Math.min(base.cascades, 2);
    // One full-screen pass for a blur you cannot see at arm's length.
    out.motionBlur = false;
  }
  if (dev.tier === 'phone') {
    out.physicsRate = Math.max(1, Math.min(base.physicsRate, 2));
    out.interiorDetail = Math.max(0, Math.min(base.interiorDetail, 2));
  }
  // Never ask for a texture the driver will refuse.
  if (out.textureSize > dev.maxTexture) out.textureSize = pow2Down(dev.maxTexture, 128);
  if (out.shadowMapSize > dev.maxTexture) out.shadowMapSize = pow2Down(dev.maxTexture, 512);
  // Rendering at three times the pixels of a phone screen buys nothing.
  if (dev.dpr && out.pixelRatioCap) out.pixelRatioCap = Math.min(out.pixelRatioCap, dev.tier === 'phone' ? 1.5 : dev.tier === 'tablet' ? 1.75 : out.pixelRatioCap);

  out.deviceTier = dev.tier;
  return out;
}

/**
 * All three presets at once, with their order guaranteed. Scaling each one on
 * its own can invert a pair — HIGH's gentler adjustment beating ULTRA's harder
 * one on a field where their base numbers are close — and ULTRA quietly being
 * worse than HIGH is the kind of thing nobody reports and everybody feels.
 * Every field the device touches is one where more is better, so a running
 * maximum up the order is the whole fix.
 * @param bases { low, high, ultra }
 */
export function effectivePresets(bases, device, order) {
  const names = order || ['low', 'high', 'ultra'];
  const out = {};
  let previous = null;
  for (const name of names) {
    const base = bases[name];
    if (!base) continue;
    const next = effectivePreset(base, device, name);
    if (previous) {
      for (const key in FIELD_GROUP) {
        if (typeof next[key] !== 'number' || typeof previous[key] !== 'number') continue;
        if (next[key] < previous[key]) next[key] = previous[key];
      }
    }
    out[name] = next;
    previous = next;
  }
  return out;
}

/** One line for the settings panel and the stats readout. */
export function describeDevice(device) {
  if (!device) return '';
  const names = { phone: 'phone', tablet: 'tablet', laptop: 'laptop', desktop: 'desktop' };
  return names[device.tier] + ' · ' + device.cores + ' cores · ' + device.memory + 'GB';
}
