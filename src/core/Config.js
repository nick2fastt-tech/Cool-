/**
 * Config.js
 * ---------
 * Central, immutable-ish configuration for the whole client. Keeping tunables
 * in one place makes balancing and platform tuning easy and avoids magic
 * numbers scattered across systems.
 *
 * Values here are safe defaults for a mid-range Android phone targeting 60 FPS.
 */

export const Config = Object.freeze({
  /** Semantic app version, surfaced in the settings screen. */
  version: '0.1.0',

  /** Networking. Override `serverUrl` at runtime via ?server= query param. */
  net: {
    serverUrl: 'ws://localhost:8080',
    /** How often the client sends its input/state to the server (Hz). */
    sendRateHz: 20,
    /** Snapshot interpolation delay (ms). Trades latency for smoothness. */
    interpolationDelayMs: 100,
    /** Auto-reconnect attempts before giving up. */
    reconnectAttempts: 5,
  },

  /** Rendering / performance. Adjusted at runtime by the quality auto-tuner. */
  graphics: {
    /** Clamp device pixel ratio so 3x-DPI phones don't melt. */
    maxPixelRatio: 2,
    /** Shadow map resolution. Lowered automatically on weak GPUs. */
    shadowMapSize: 1024,
    /** Camera far plane; also drives fog distance. */
    farPlane: 400,
    /** Enable dynamic shadows by default. */
    shadows: true,
    /** Antialiasing. Disabled first when the auto-tuner needs headroom. */
    antialias: true,
    /** Target frame time in ms (60 FPS = 16.67ms). */
    targetFrameMs: 1000 / 60,
  },

  /** Player movement / physics feel. */
  player: {
    walkSpeed: 6.0,
    sprintMultiplier: 1.7,
    jumpVelocity: 9.0,
    gravity: -24.0,
    /** Terminal fall speed to keep physics stable. */
    maxFallSpeed: -40.0,
    /** Character capsule radius/height for collisions. */
    radius: 0.4,
    height: 1.8,
    /** Rotation smoothing (higher = snappier turns). */
    turnLerp: 12,
  },

  /** Camera behaviour (third person orbit). */
  camera: {
    minDistance: 3,
    maxDistance: 12,
    defaultDistance: 7,
    minPitch: -0.3,
    maxPitch: 1.2,
    fov: 60,
    /** Drag sensitivity for touch look. */
    lookSensitivity: 0.005,
  },

  /** Economy tuning. */
  economy: {
    /** XP required for level N follows: base * N^exp. */
    xpBase: 100,
    xpExponent: 1.35,
    dailyRewardCoins: [50, 75, 100, 150, 200, 300, 500],
    startingCoins: 100,
  },

  /** Local persistence key namespace. */
  storage: {
    prefix: 'novaverse.v1.',
  },
});
