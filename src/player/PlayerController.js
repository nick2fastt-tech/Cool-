/**
 * PlayerController.js
 * -------------------
 * The local player: turns input into camera-relative movement, runs it through
 * the PhysicsWorld, drives the avatar + animator, and orbits the third-person
 * camera. Registered as an engine system.
 *
 * Physics runs in fixedUpdate for determinism; camera + animation in update for
 * smoothness. The visual avatar is interpolated toward the physics position so
 * rendering stays buttery even when the sim steps at a fixed rate.
 */

import * as THREE from 'three';
import { Config } from '../core/Config.js';
import { bus } from '../core/EventBus.js';
import { Vibration } from '../input/Vibration.js';

export class PlayerController {
  /**
   * @param {Engine} engine
   * @param {TouchControls} input
   * @param {PhysicsWorld} physics
   * @param {Avatar} avatar
   * @param {Animator} animator
   * @param {Lighting} [lighting]
   */
  constructor(engine, input, physics, avatar, animator, lighting = null) {
    this.engine = engine;
    this.input = input;
    this.physics = physics;
    this.avatar = avatar;
    this.animator = animator;
    this.lighting = lighting;

    this.position = new THREE.Vector3(0, 2, 0);
    this.velocity = new THREE.Vector3();
    this.grounded = false;
    this.speedMultiplier = 1; // buffed by speed boosts/nitro pads
    this.frozen = false; // e.g. during countdowns

    // Camera orbit state.
    this.yaw = 0;
    this.pitch = 0.4;
    this.distance = Config.camera.defaultDistance;

    this._visualYaw = 0;
    this._wasGrounded = true;
    this._netAccumulator = 0;

    engine.scene.add(avatar.root);
  }

  /** Teleport the player (spawn, checkpoint, portal). */
  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.avatar.root.position.copy(this.position);
  }

  fixedUpdate(dt) {
    if (this.frozen) {
      this.velocity.x = this.velocity.z = 0;
      return;
    }
    const cfg = Config.player;
    const mv = this.input.state.move;

    // Camera-relative movement basis (flattened onto the XZ plane).
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const wish = new THREE.Vector3();
    wish.addScaledVector(forward, mv.y);
    wish.addScaledVector(right, mv.x);
    if (wish.lengthSq() > 1) wish.normalize();

    const sprinting = this.input.state.sprint && mv.y > 0.1;
    let speed = cfg.walkSpeed * this.speedMultiplier;
    if (sprinting) speed *= cfg.sprintMultiplier;

    this.velocity.x = wish.x * speed;
    this.velocity.z = wish.z * speed;

    // Jump (edge-triggered, only when grounded).
    if (this.input.consumeJump() && this.grounded) {
      this.velocity.y = cfg.jumpVelocity;
      this.grounded = false;
    }

    // Gravity with terminal velocity.
    this.velocity.y = Math.max(this.velocity.y + cfg.gravity * dt, cfg.maxFallSpeed);

    // Resolve against the world.
    const res = this.physics.resolveCapsule(this.position, this.velocity, cfg.radius, cfg.height, dt);
    this.grounded = res.grounded;

    // Landing haptic + particles hook.
    if (this.grounded && !this._wasGrounded && this.velocity.y === 0) {
      Vibration.play('land');
      bus.emit('player:land', this.position.clone());
    }
    this._wasGrounded = this.grounded;

    // Face the movement direction.
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > 0.5) {
      this._targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
    }

    // Animation state selection.
    if (!this.grounded) this.animator.setAirborne(true);
    else {
      this.animator.setAirborne(false);
      if (horizSpeed < 0.5) this.animator.setState('idle');
      else this.animator.setState(sprinting ? 'run' : 'walk');
    }
  }

  update(dt) {
    // --- Camera look/zoom from touch ---------------------------------------
    const look = this.input.consumeLook();
    const sens = Config.camera.lookSensitivity;
    this.yaw -= look.dx * sens;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - look.dy * sens,
      Config.camera.minPitch,
      Config.camera.maxPitch
    );
    this.distance = THREE.MathUtils.clamp(
      this.distance + this.input.consumeZoom(),
      Config.camera.minDistance,
      Config.camera.maxDistance
    );

    // --- Emotes -------------------------------------------------------------
    const emote = this.input.consumeEmote();
    if (emote) this.animator.playEmote(emote);

    // --- Smoothly move the visual avatar toward the physics position --------
    this.avatar.root.position.lerp(this.position, Math.min(1, dt * 18));

    // Smooth turn toward the target heading.
    if (this._targetYaw != null) {
      let diff = this._targetYaw - this._visualYaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // wrap to [-π, π]
      this._visualYaw += diff * Math.min(1, dt * Config.player.turnLerp);
      this.avatar.root.rotation.y = this._visualYaw;
    }

    this.animator.update(dt);

    // --- Position the orbit camera behind the player ------------------------
    const cam = this.engine.camera;
    const target = this.avatar.root.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const cp = Math.cos(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cp
    ).multiplyScalar(this.distance);
    cam.position.copy(target).add(offset);
    cam.lookAt(target);

    // Keep dynamic shadows centred on the player.
    this.lighting?.followTarget(this.avatar.root.position);

    // --- Emit state for the network at the configured send rate -------------
    this._netAccumulator += dt;
    const interval = 1 / Config.net.sendRateHz;
    if (this._netAccumulator >= interval) {
      this._netAccumulator = 0;
      bus.emit('player:state', {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z,
        yaw: this._visualYaw,
        anim: this.animator.state,
        air: !this.grounded,
      });
    }
  }
}
