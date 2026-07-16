/**
 * BaseGame.js
 * -----------
 * Common contract every game mode implements. A game owns its own THREE.Group,
 * its colliders/triggers (registered on the shared PhysicsWorld), and its HUD
 * state. The GameManager only ever talks to a game through this interface, which
 * keeps modes fully decoupled and hot-swappable.
 *
 * Lifecycle:
 *   new Game(ctx)      -> build world + colliders
 *   getSpawn()         -> THREE.Vector3 spawn point
 *   fixedUpdate(dt)    -> physics-rate logic (moving platforms, AI)
 *   update(dt, elapsed)-> render-rate logic (animation, effects)
 *   onPlayerDeath()    -> optional; return a respawn point
 *   hud()              -> plain object of values the HUD renders
 *   dispose()          -> tear everything down, free GPU + colliders
 */

import * as THREE from 'three';

export class BaseGame {
  /** @param {object} ctx { engine, scene, physics, player, particles } */
  constructor(ctx) {
    this.ctx = ctx;
    this.scene = ctx.scene;
    this.physics = ctx.physics;
    this.player = ctx.player;
    this.group = new THREE.Group();
    this._colliderIds = [];
    this.scene.add(this.group);
  }

  /** Register a mesh as a solid collider and add it to the world group. */
  addSolid(mesh, { collide = true } = {}) {
    this.group.add(mesh);
    if (collide) this._colliderIds.push(this.physics.addSolidFromMesh(mesh));
    return mesh;
  }

  getSpawn() {
    return new THREE.Vector3(0, 2, 0);
  }

  fixedUpdate() {}
  update() {}
  hud() {
    return {};
  }

  /** Default death handler: respawn at the game's spawn point. */
  onPlayerDeath() {
    return this.getSpawn();
  }

  dispose() {
    for (const id of this._colliderIds) this.physics.removeSolid(id);
    this._colliderIds.length = 0;
    this.physics.clearTriggers();
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          m.map?.dispose?.();
          m.dispose?.();
        });
      }
    });
  }
}
