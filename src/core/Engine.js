/**
 * Engine.js
 * ---------
 * The rendering + main-loop core, wrapping Three.js. Responsibilities:
 *   - own the WebGLRenderer, Scene, and main PerspectiveCamera
 *   - run a fixed-timestep update loop with a variable-rate render
 *   - drive registered "systems" (anything with update(dt) / lateUpdate(dt))
 *   - handle resize, pixel-ratio clamping, and an adaptive quality tuner
 *
 * Everything visual mounts into `engine.scene`. Gameplay systems register with
 * `engine.addSystem(system)` and get ticked every frame.
 */

import * as THREE from 'three';
import { Config } from './Config.js';
import { createLogger } from './Logger.js';
import { bus } from './EventBus.js';

const log = createLogger('Engine');

/** Fixed simulation step (seconds). Physics/gameplay run at this cadence. */
const FIXED_DT = 1 / 60;
/** Never simulate more than this many seconds in one frame (spiral-of-death guard). */
const MAX_FRAME_DT = 0.25;

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;

    // --- Renderer -----------------------------------------------------------
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: Config.graphics.antialias,
      powerPreference: 'high-performance',
      // No alpha: opaque clear is cheaper and avoids compositing overhead.
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, Config.graphics.maxPixelRatio));
    this.renderer.shadowMap.enabled = Config.graphics.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // --- Scene & camera -----------------------------------------------------
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      Config.camera.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      Config.graphics.farPlane
    );
    this.camera.position.set(0, 5, 10);

    // --- Timing -------------------------------------------------------------
    this.clock = new THREE.Clock();
    this._accumulator = 0;
    this._running = false;
    this._rafId = 0;

    /** Registered systems, ticked in insertion order. */
    this._systems = [];

    // --- Adaptive quality ---------------------------------------------------
    this._fpsSamples = [];
    this._qualityLevel = 3; // 3=high, 2=med, 1=low, 0=potato
    this._lastTuneAt = 0;

    this._onResize = this._onResize.bind(this);
    this._loop = this._loop.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    this._onResize();

    log.info('initialised', {
      pixelRatio: this.renderer.getPixelRatio(),
      shadows: Config.graphics.shadows,
    });
  }

  /** Register a system object. Optional hooks: update(dt), lateUpdate(dt), fixedUpdate(dt). */
  addSystem(system) {
    this._systems.push(system);
    return system;
  }

  /** Remove a previously-registered system. */
  removeSystem(system) {
    const i = this._systems.indexOf(system);
    if (i >= 0) this._systems.splice(i, 1);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.clock.start();
    this._rafId = requestAnimationFrame(this._loop);
    log.info('render loop started');
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._rafId);
  }

  _loop() {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._loop);

    let dt = this.clock.getDelta();
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT; // avoid huge catch-up after tab sleep

    // Fixed-timestep updates for deterministic physics/gameplay.
    this._accumulator += dt;
    let steps = 0;
    while (this._accumulator >= FIXED_DT && steps < 5) {
      for (const s of this._systems) s.fixedUpdate?.(FIXED_DT);
      this._accumulator -= FIXED_DT;
      steps++;
    }

    // Variable-rate updates (animation, camera, interpolation).
    for (const s of this._systems) s.update?.(dt);
    for (const s of this._systems) s.lateUpdate?.(dt);

    this.renderer.render(this.scene, this.camera);
    this._sampleAndTune(dt);
  }

  /** Track FPS and step quality down/up to protect the 60 FPS target. */
  _sampleAndTune(dt) {
    this._fpsSamples.push(1 / Math.max(dt, 1e-4));
    if (this._fpsSamples.length > 120) this._fpsSamples.shift();

    const now = performance.now();
    if (now - this._lastTuneAt < 3000 || this._fpsSamples.length < 60) return;
    this._lastTuneAt = now;

    const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
    if (avg < 50 && this._qualityLevel > 0) this._setQuality(this._qualityLevel - 1, avg);
    else if (avg > 58 && this._qualityLevel < 3) this._setQuality(this._qualityLevel + 1, avg);
  }

  _setQuality(level, avgFps) {
    this._qualityLevel = level;
    const pr = window.devicePixelRatio;
    // Progressively trade resolution + shadows for frame time.
    const ratios = [0.6, 0.8, 1.0, Math.min(pr, Config.graphics.maxPixelRatio)];
    this.renderer.setPixelRatio(Math.min(pr, ratios[level]));
    this.renderer.shadowMap.enabled = Config.graphics.shadows && level >= 2;
    this._onResize();
    log.info(`quality -> ${['potato', 'low', 'medium', 'high'][level]} (avg ${avgFps.toFixed(0)} fps)`);
    bus.emit('engine:quality', level);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    this.renderer.dispose();
  }
}
