/**
 * DayNightCycle.js
 * ----------------
 * Drives the sun position, light colours/intensities, and sky gradient across
 * a configurable day length. Registered as an engine system (has update(dt)).
 *
 * Time of day is normalised 0..1 (0 = midnight, 0.25 = sunrise, 0.5 = noon,
 * 0.75 = sunset). Colours are interpolated between a handful of key states so
 * dawn/dusk get warm tones and night goes cool and dim.
 */

import * as THREE from 'three';
import { bus } from '../core/EventBus.js';

// Keyframes: [timeOfDay, sunColor, sunIntensity, skyTop, skyBottom, hemiIntensity]
const KEYS = [
  { t: 0.0, sun: 0x22304a, si: 0.05, top: 0x05070f, bot: 0x0a1226, hemi: 0.15 }, // midnight
  { t: 0.23, sun: 0xff7a3c, si: 0.5, top: 0x243a6b, bot: 0xffb27a, hemi: 0.35 }, // sunrise
  { t: 0.5, sun: 0xfff2d6, si: 1.4, top: 0x2a6bd6, bot: 0xbfe0ff, hemi: 0.6 }, // noon
  { t: 0.77, sun: 0xff5a2c, si: 0.5, top: 0x3a2a5b, bot: 0xff8a5a, hemi: 0.35 }, // sunset
  { t: 1.0, sun: 0x22304a, si: 0.05, top: 0x05070f, bot: 0x0a1226, hemi: 0.15 }, // midnight
];

export class DayNightCycle {
  /**
   * @param {Lighting} lighting
   * @param {Sky} sky
   * @param {number} dayLengthSec  full cycle duration in seconds (default 8 min)
   */
  constructor(lighting, sky, dayLengthSec = 480) {
    this.lighting = lighting;
    this.sky = sky;
    this.dayLength = dayLengthSec;
    this.time = 0.35; // start mid-morning

    this._c1 = new THREE.Color();
    this._c2 = new THREE.Color();
    this._top = new THREE.Color();
    this._bot = new THREE.Color();
    this._paused = false;
  }

  /** Jump to a specific time of day (0..1). */
  setTime(t) {
    this.time = ((t % 1) + 1) % 1;
  }

  pause() { this._paused = true; }
  resume() { this._paused = false; }

  update(dt) {
    if (!this._paused) {
      this.time = (this.time + dt / this.dayLength) % 1;
    }
    this._apply(this.time);
  }

  _apply(t) {
    // Find bracketing keyframes.
    let a = KEYS[0];
    let b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (t >= KEYS[i].t && t <= KEYS[i + 1].t) {
        a = KEYS[i];
        b = KEYS[i + 1];
        break;
      }
    }
    const span = b.t - a.t || 1;
    const k = (t - a.t) / span;

    // Sun colour + intensity.
    this._c1.setHex(a.sun);
    this._c2.setHex(b.sun);
    this.lighting.sun.color.copy(this._c1).lerp(this._c2, k);
    this.lighting.sun.intensity = a.si + (b.si - a.si) * k;
    this.lighting.hemi.intensity = a.hemi + (b.hemi - a.hemi) * k;

    // Sun position on an arc across the sky.
    const angle = (t - 0.25) * Math.PI * 2; // sunrise at horizon
    const radius = 120;
    const offset = new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      40
    );
    this.lighting.setSunDirection(offset);

    // Sky gradient.
    this._top.setHex(a.top).lerp(this._c2.setHex(b.top), k);
    this._bot.setHex(a.bot).lerp(this._c1.setHex(b.bot), k);
    this.sky.setColors(this._top, this._bot);

    // Fog matches the horizon so the world blends into the sky.
    if (this.lighting.scene.fog) this.lighting.scene.fog.color.copy(this._bot);

    // Broadcast phase transitions so gameplay can react (e.g. survival enemies).
    const isNight = t < 0.22 || t > 0.78;
    if (isNight !== this._wasNight) {
      this._wasNight = isNight;
      bus.emit('world:phase', isNight ? 'night' : 'day');
    }
  }
}
