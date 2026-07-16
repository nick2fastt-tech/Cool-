/**
 * Lighting.js
 * -----------
 * Builds the scene light rig: a directional "sun" that casts dynamic shadows,
 * a hemisphere light for soft sky/ground bounce, and a low ambient fill so
 * shadowed areas never go fully black. The DayNightCycle animates these.
 */

import * as THREE from 'three';
import { Config } from '../core/Config.js';

export class Lighting {
  constructor(scene) {
    this.scene = scene;

    // Sky/ground bounce — cheap, gives natural ambient colour.
    this.hemi = new THREE.HemisphereLight(0xaecbff, 0x4a4033, 0.6);
    scene.add(this.hemi);

    // Flat ambient fill so shadow interiors keep a little detail.
    this.ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(this.ambient);

    // The sun: primary directional light + shadow caster.
    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
    this.sun.position.set(40, 60, 20);
    this.sun.castShadow = Config.graphics.shadows;
    this._configureShadow(this.sun);
    scene.add(this.sun);
    scene.add(this.sun.target);

    // Subtle exponential fog ties distant geometry into the sky colour and
    // hides far-plane pop-in (also a cheap occlusion aid).
    this.scene.fog = new THREE.FogExp2(0x9fc0e8, 0.0025);
  }

  _configureShadow(light) {
    const s = Config.graphics.shadowMapSize;
    light.shadow.mapSize.set(s, s);
    const cam = light.shadow.camera;
    cam.near = 1;
    cam.far = 200;
    cam.left = -60;
    cam.right = 60;
    cam.top = 60;
    cam.bottom = -60;
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.02;
  }

  /**
   * Keep the shadow frustum centred on a target (usually the player) so we get
   * crisp shadows nearby without a huge, low-res shadow map.
   */
  followTarget(pos) {
    this.sun.target.position.copy(pos);
    // Maintain the sun's relative offset while re-anchoring over the player.
    this.sun.position.copy(pos).add(this._sunOffset || new THREE.Vector3(40, 60, 20));
  }

  /** Store the current sun direction as an offset (used by the day/night cycle). */
  setSunDirection(offset) {
    this._sunOffset = offset.clone();
  }
}
