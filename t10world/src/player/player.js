// T10 World - the player. Character controller, first/third-person camera with
// collision, vehicle entry, and the contextual interaction probe.
import * as THREE from '../../vendor/three.module.js';
import { Human } from '../human/human.js';
import { STATES } from '../human/animator.js';
import { clamp01, clampv, lerpv, damp, dampAngle, wrapAngle, TAU, smooth01 } from '../core/math.js';
import { settings } from '../core/settings.js';
import { audio } from '../core/audio.js';
import { WATER_LEVEL } from '../world/city.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _ray = new THREE.Raycaster();

export class Player {
  constructor(world, scene, camera, appearance) {
    this.world = world;
    this.scene = scene;
    this.camera = camera;
    this.appearance = appearance;

    this.human = new Human(appearance, { tier: 'player' });
    this.root = this.human.root;
    scene.add(this.root);

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.grounded = true;
    this.verticalVel = 0;
    this.crouching = false;
    this.sprinting = false;
    this.swimming = false;
    this.inVehicle = null;
    this.seatIndex = 0;
    this.sitting = null;
    this.frozen = false;
    this.noclip = false;
    this.flying = false;
    this.godMode = false;

    this.walkSpeed = 1.55;
    this.runSpeed = 4.3;
    this.sprintSpeed = 7.0;
    this.crouchSpeed = 1.0;
    this.swimSpeed = 2.2;
    this.jumpVelocity = 5.4;
    this.speedMultiplier = 1;
    this.jumpMultiplier = 1;

    this.cameraMode = settings.get('cameraMode');
    this.yaw = 0;
    this.pitch = 0.06;
    this.camDistance = 4.0;
    this.camDistanceTarget = 4.0;
    this.camHeight = 1.5;
    this.camOffsetX = 0.55;
    this.camShake = 0;
    this.camFov = settings.get('fov');

    this.money = 5000;
    this.interactTarget = null;
    this.lastFootSurface = 'concrete';
    this.getUpTimer = 0;

    this.human.setGroundSampler((x, z) => ({
      y: this.world.supportAt(x, z, this.position.y + 0.6),
      normal: this.world.normalAt(x, z),
    }));
    this.human.animator.onFootstep = (side, spd) => {
      audio.footstep(this.lastFootSurface, spd, 0);
      if (spd > 3.5) this.camShake = Math.min(1, this.camShake + 0.12);
    };
  }

  /** The opening moment: lying on the street, then getting up. */
  spawnOnStreet(x, z) {
    const p = this.world.findSpawnPoint(x, z);
    this.position.copy(p);
    this.heading = Math.random() * TAU;
    this.yaw = this.heading;
    this.root.position.copy(this.position);
    this.human.animator.setState(STATES.LIE);
    this.getUpTimer = 2.2;
    this.frozen = true;
  }

  get eyeHeight() {
    const base = this.human.prop.measure.eyeLine;
    return this.crouching ? base * 0.62 : base;
  }

  setCameraMode(mode) {
    this.cameraMode = mode === 'first' ? 'first' : 'third';
    settings.set('cameraMode', this.cameraMode);
    this.human.parts.body.visible = this.cameraMode !== 'first';
    for (const k of ['hair', 'brows', 'beard', 'clothes', 'base']) {
      if (this.human.parts[k]) this.human.parts[k].visible = this.cameraMode !== 'first';
    }
    if (this.human.parts.shoeL) this.human.parts.shoeL.visible = this.cameraMode !== 'first';
    if (this.human.parts.shoeR) this.human.parts.shoeR.visible = this.cameraMode !== 'first';
  }
  toggleCameraMode() { this.setCameraMode(this.cameraMode === 'first' ? 'third' : 'first'); return this.cameraMode; }

  // -------------------------------------------------------------------------
  update(dt, input, npcManager, trafficManager) {
    // --- Look ---
    if (!input.suspended) {
      this.yaw = wrapAngle(this.yaw - input.look.x);
      this.pitch = clampv(this.pitch + input.look.y, -1.32, 1.28);
    }

    if (this.getUpTimer > 0) {
      this.getUpTimer -= dt;
      if (this.getUpTimer <= 1.9 && this.human.animator.state !== STATES.GETUP) {
        this.human.animator.setState(STATES.GETUP);
      }
      if (this.getUpTimer <= 0) { this.frozen = false; this.human.animator.setState(STATES.IDLE); }
      this.human.update(dt, { speed: 0, turnRate: 0, grounded: true, verticalVel: 0 });
      this.root.position.copy(this.position);
      this.updateCamera(dt);
      return;
    }

    if (this.inVehicle) { this.updateInVehicle(dt, input); return; }
    if (this.frozen) {
      this.human.update(dt, { speed: 0, turnRate: 0, grounded: true, verticalVel: 0 });
      this.updateCamera(dt);
      return;
    }

    // --- Movement intent in camera space ---
    const mx = input.move.x, my = input.move.y;
    const moveLen = Math.hypot(mx, my);
    const camForwardX = Math.sin(this.yaw), camForwardZ = Math.cos(this.yaw);
    const camRightX = Math.cos(this.yaw), camRightZ = -Math.sin(this.yaw);
    let wishX = camForwardX * my + camRightX * mx;
    let wishZ = camForwardZ * my + camRightZ * mx;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0.001) { wishX /= wishLen; wishZ /= wishLen; }

    this.crouching = input.buttons.crouch && !this.swimming;
    this.sprinting = input.buttons.sprint && moveLen > 0.55 && !this.crouching;

    const walkToggle = input.buttons.walk;
    let targetSpeed = 0;
    if (moveLen > 0.02) {
      const base = this.swimming ? this.swimSpeed
        : this.crouching ? this.crouchSpeed
        : walkToggle ? this.walkSpeed
        : this.sprinting ? this.sprintSpeed
        : lerpv(this.walkSpeed, this.runSpeed, clamp01(moveLen));
      targetSpeed = base * clamp01(moveLen * 1.15) * this.speedMultiplier;
    }

    // Turn the body toward the movement direction (or the camera in first person).
    const prevHeading = this.heading;
    if (wishLen > 0.001) {
      const want = Math.atan2(wishX, wishZ);
      this.heading = dampAngle(this.heading, want, this.cameraMode === 'first' ? 0.00002 : 0.00008, dt);
    } else if (this.cameraMode === 'first') {
      this.heading = dampAngle(this.heading, this.yaw, 0.0001, dt);
    }
    const turnRate = wrapAngle(this.heading - prevHeading) / Math.max(dt, 0.0001);

    // --- Vertical ---
    const groundY = this.world.supportAt(this.position.x, this.position.z, this.position.y);
    const waterHere = this.world.isWater(this.position.x, this.position.z);
    this.swimming = waterHere && this.position.y < WATER_LEVEL + 0.3;

    if (this.flying || this.noclip) {
      this.verticalVel = 0;
      const lift = (input.buttons.jump ? 1 : 0) - (input.buttons.crouch ? 1 : 0);
      this.position.y += lift * 8 * dt;
      this.grounded = false;
    } else if (this.swimming) {
      this.verticalVel = input.buttons.jump ? 1.6 : -0.4;
      this.position.y = clampv(this.position.y + this.verticalVel * dt, groundY + 0.3, WATER_LEVEL + 0.2);
      this.grounded = false;
    } else {
      if (this.grounded && input.edges.jump) {
        this.verticalVel = this.jumpVelocity * this.jumpMultiplier;
        this.grounded = false;
        audio.jump();
        this.human.animator.setState(STATES.JUMP);
      }
      this.verticalVel -= 19.6 * dt;
      this.position.y += this.verticalVel * dt;
      if (this.position.y <= groundY) {
        const impact = -this.verticalVel;
        this.position.y = groundY;
        if (!this.grounded && impact > 2) {
          audio.land(impact);
          this.camShake = Math.min(1.2, this.camShake + clamp01(impact / 14));
          this.human.animator.setState(STATES.LAND);
          if (impact > 17 && !this.godMode) this.onHardLanding(impact);
        }
        this.verticalVel = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    }

    // --- Horizontal integrate ---
    this.speed = damp(this.speed, targetSpeed, 0.0006, dt);
    const moveScale = this.grounded || this.swimming || this.flying ? 1 : 0.72;
    this.position.x += Math.sin(this.heading) * this.speed * moveScale * dt;
    this.position.z += Math.cos(this.heading) * this.speed * moveScale * dt;
    if (!this.noclip) this.world.resolveCollision(this.position, 0.36);

    // Keep the player inside the world.
    const LIM = 1180;
    this.position.x = clampv(this.position.x, -LIM, LIM);
    this.position.z = clampv(this.position.z, -LIM, LIM);

    this.root.position.copy(this.position);
    this.root.rotation.y = this.heading;
    this.lastFootSurface = this.world.surfaceAt(this.position.x, this.position.z);

    // --- Animation state ---
    const a = this.human.animator;
    if (this.sitting) a.setState(STATES.SIT);
    else if (this.swimming) a.setState(STATES.SWIM);
    else if (!this.grounded && !this.flying) a.setState(this.verticalVel > 0.5 ? STATES.JUMP : STATES.FALL);
    else if (a.state === STATES.LAND && a.stateTime < 0.3) { /* let the landing play */ }
    else if (this.crouching) a.setState(STATES.CROUCH);
    else if (this.speed > this.runSpeed * 1.25) a.setState(STATES.SPRINT);
    else if (this.speed > this.walkSpeed * 1.35) a.setState(STATES.RUN);
    else if (this.speed > 0.22) a.setState(STATES.WALK);
    else if (a.state !== STATES.IDLE && a.state !== STATES.WAVE && a.state !== STATES.DANCE && a.state !== STATES.PHONE) a.setState(STATES.IDLE);

    this.human.update(dt, {
      speed: this.speed, turnRate, grounded: this.grounded, verticalVel: this.verticalVel,
    });

    // --- Interaction probe ---
    this.updateInteractTarget(npcManager, trafficManager);
    this.updateCamera(dt);
  }

  onHardLanding(impact) {
    this.camShake = 1.4;
    if (this.onDamage) this.onDamage(impact);
  }

  updateInVehicle(dt, input) {
    const v = this.inVehicle;
    // Driver controls; passengers just ride.
    if (this.seatIndex === 0) {
      const throttle = input.move.y > 0 ? input.move.y : 0;
      const brake = input.move.y < 0 ? -input.move.y : 0;
      const steer = input.move.x;
      v.engineOn = true;
      v.setInput(throttle, brake, steer, input.buttons.handbrake ? 1 : 0);
      if (input.edges.horn) v.honk();
      v.signalLeft = input.keys && input.keys.has(input.keyFor('signalLeft'));
      v.signalRight = input.keys && input.keys.has(input.keyFor('signalRight'));
    }
    // Ride along in the seat.
    v.seatPosition(this.seatIndex, this.position);
    this.root.position.copy(this.position);
    this.heading = v.heading;
    this.root.rotation.y = v.heading;
    const a = this.human.animator;
    a.setState(STATES.DRIVE, { steer: v.steer / 0.5 });
    this.human.update(dt, { speed: 0, turnRate: 0, grounded: true, verticalVel: 0 });

    this.camShake = Math.max(this.camShake, clamp01(Math.abs(v.speed) / v.spec.topSpeed) * 0.10);
    this.updateCamera(dt);
  }

  enterVehicle(v, seat) {
    if (!v || this.inVehicle) return false;
    this.inVehicle = v;
    this.seatIndex = seat == null ? 0 : seat;
    v.driver = this.seatIndex === 0 ? this : v.driver;
    v.setPlayerControlled(this.seatIndex === 0);
    v.engineOn = true;
    v.openDoor(this.seatIndex === 0 ? 0 : 1, true);
    setTimeout(() => v.openDoor(this.seatIndex === 0 ? 0 : 1, false), 900);
    this.camDistanceTarget = Math.max(5.5, v.spec.l * 1.35);
    this.human.animator.footIK.enabled = false;
    audio.carDoor(true);
    return true;
  }

  exitVehicle() {
    const v = this.inVehicle;
    if (!v) return false;
    v.openDoor(this.seatIndex === 0 ? 0 : 1, true);
    setTimeout(() => v.openDoor(this.seatIndex === 0 ? 0 : 1, false), 1100);
    v.doorPosition(this.seatIndex === 0 ? 0 : 1, this.position);
    this.position.y = this.world.groundAt(this.position.x, this.position.z);
    if (this.seatIndex === 0) { v.driver = null; v.setPlayerControlled(false); v.setInput(0, 1, 0, 1); }
    this.inVehicle = null;
    this.camDistanceTarget = 4.0;
    this.human.animator.footIK.enabled = true;
    this.human.animator.setState(STATES.IDLE);
    audio.carDoor(false);
    return true;
  }

  updateInteractTarget(npcManager, trafficManager) {
    const dirX = Math.sin(this.cameraMode === 'first' ? this.yaw : this.heading);
    const dirZ = Math.cos(this.cameraMode === 'first' ? this.yaw : this.heading);
    let best = this.world.findInteractable(this.position.x, this.position.y, this.position.z, dirX, dirZ, 3.0);

    // Vehicles and people take priority when they're closer.
    if (trafficManager) {
      const v = trafficManager.nearest(this.position.x, this.position.z, 3.6, (vv) => !vv.isPlayerVehicle);
      if (v && !this.inVehicle) {
        const d = Math.hypot(v.position.x - this.position.x, v.position.z - this.position.z);
        const bd = best ? Math.hypot(best.x - this.position.x, best.z - this.position.z) : 99;
        if (d < bd) best = { type: 'vehicle', vehicle: v, x: v.position.x, y: v.position.y, z: v.position.z, label: 'Enter ' + v.spec.name, action: 'enter_vehicle' };
      }
    }
    if (npcManager) {
      const n = npcManager.nearestNPC(this.position, 2.6);
      if (n) {
        const d = n.position.distanceTo(this.position);
        const bd = best ? Math.hypot(best.x - this.position.x, best.z - this.position.z) : 99;
        if (d < bd) best = { type: 'npc', npc: n, x: n.position.x, y: n.position.y, z: n.position.z, label: 'Talk to ' + n.appearance.firstName, action: 'talk' };
      }
    }
    if (this.inVehicle) best = { type: 'exit', label: 'Exit vehicle', action: 'exit_vehicle', x: this.position.x, y: this.position.y, z: this.position.z };
    this.interactTarget = best;
    return best;
  }

  interact(ctx) {
    const t = this.interactTarget;
    if (!t) return null;
    switch (t.action) {
      case 'enter_vehicle': this.enterVehicle(t.vehicle, 0); return { kind: 'vehicle', vehicle: t.vehicle };
      case 'exit_vehicle': this.exitVehicle(); return { kind: 'exit' };
      case 'sit':
        if (this.sitting) { this.sitting = null; this.human.animator.setState(STATES.IDLE); }
        else { this.sitting = t; this.position.x = t.x; this.position.z = t.z; }
        return { kind: 'sit' };
      case 'talk': return { kind: 'talk', npc: t.npc };
      case 'enter': return { kind: 'door', lot: t.lot, door: t };
      case 'atm': return { kind: 'atm' };
      case 'search': return { kind: 'search' };
      case 'bus': return { kind: 'bus' };
      case 'play': return { kind: 'play' };
      default: return { kind: t.action || 'inspect', target: t };
    }
  }

  // -------------------------------------------------------------------------
  updateCamera(dt) {
    const cam = this.camera;
    const targetFov = settings.get('fov') + clamp01(this.speed / this.sprintSpeed) * 9 +
      (this.inVehicle ? clamp01(Math.abs(this.inVehicle.speed) / this.inVehicle.spec.topSpeed) * 16 : 0);
    this.camFov = damp(this.camFov, targetFov, 0.02, dt);
    if (Math.abs(cam.fov - this.camFov) > 0.01) { cam.fov = this.camFov; cam.updateProjectionMatrix(); }

    this.camShake = Math.max(0, this.camShake - dt * 3.2);
    const shakeX = this.camShake * Math.sin(performance.now() * 0.031) * 0.012;
    const shakeY = this.camShake * Math.sin(performance.now() * 0.043) * 0.014;

    if (this.cameraMode === 'first') {
      const headY = this.position.y + this.eyeHeight;
      // Slight head bob while moving on foot.
      const bob = this.inVehicle ? 0 : Math.sin(this.human.animator.phase * TAU * 2) * clamp01(this.speed / this.runSpeed) * 0.022;
      _v.set(this.position.x, headY + bob, this.position.z);
      if (this.inVehicle) {
        this.inVehicle.seatPosition(this.seatIndex, _v);
        _v.y += 0.62;
        _v.addScaledVector(_v2.set(Math.sin(this.inVehicle.heading), 0, Math.cos(this.inVehicle.heading)), 0.22);
      }
      cam.position.copy(_v);
      cam.rotation.set(this.pitch + shakeY, this.yaw + shakeX, 0, 'YXZ');
    } else {
      const anchor = _v.set(this.position.x, this.position.y + this.camHeight * (this.crouching ? 0.7 : 1), this.position.z);
      if (this.inVehicle) {
        anchor.copy(this.inVehicle.position);
        anchor.y += this.inVehicle.spec.h * 0.85;
      }
      this.camDistance = damp(this.camDistance, this.camDistanceTarget, 0.01, dt);
      const dist = this.camDistance;
      const offX = Math.sin(this.yaw) * Math.cos(this.pitch);
      const offY = Math.sin(this.pitch);
      const offZ = Math.cos(this.yaw) * Math.cos(this.pitch);
      _v2.set(anchor.x - offX * dist, anchor.y - offY * dist + 0.25, anchor.z - offZ * dist);
      // Shoulder offset so the character isn't dead centre.
      const rightX = Math.cos(this.yaw), rightZ = -Math.sin(this.yaw);
      const shoulder = this.inVehicle ? 0 : this.camOffsetX;
      _v2.x += rightX * shoulder;
      _v2.z += rightZ * shoulder;

      // Pull the camera in if something is between it and the player.
      const desired = _v2.clone();
      const dir = desired.clone().sub(anchor);
      const len = dir.length();
      dir.normalize();
      const blocked = this.raycastCamera(anchor, dir, len);
      if (blocked < len) desired.copy(anchor).addScaledVector(dir, Math.max(0.6, blocked - 0.25));
      const groundClear = this.world.groundAt(desired.x, desired.z) + 0.45;
      if (desired.y < groundClear) desired.y = groundClear;

      cam.position.lerp(desired, clamp01(dt * 14));
      cam.lookAt(anchor.x + shakeX * 2, anchor.y + 0.28 + shakeY * 2, anchor.z);
    }
  }

  /** Coarse camera occlusion test against world colliders. */
  raycastCamera(origin, dir, maxDist) {
    let nearest = maxDist;
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * maxDist;
      _v2.copy(origin).addScaledVector(dir, t);
      const probe = _v2.clone();
      if (this.world.resolveCollision(probe, 0.28)) {
        nearest = Math.min(nearest, t);
        break;
      }
    }
    return nearest;
  }

  // -------------------------------------------------------------------------
  teleport(x, z, y) {
    this.position.set(x, y != null ? y : this.world.groundAt(x, z), z);
    this.grounded = true;
    this.velocity.set(0, 0, 0);
    this.verticalVel = 0;
    this.root.position.copy(this.position);
    if (this.inVehicle) this.inVehicle.teleport(x, z, this.heading);
  }

  rebuildAppearance() {
    const pos = this.position.clone();
    const heading = this.heading;
    this.human.rebuildBody();
    this.human.setGroundSampler((x, z) => ({
      y: this.world.supportAt(x, z, this.position.y + 0.6),
      normal: this.world.normalAt(x, z),
    }));
    this.human.animator.onFootstep = (side, spd) => {
      audio.footstep(this.lastFootSurface, spd, 0);
      if (spd > 3.5) this.camShake = Math.min(1, this.camShake + 0.12);
    };
    if (!this.root.parent) this.scene.add(this.root);
    this.position.copy(pos);
    this.heading = heading;
    this.root.position.copy(pos);
    this.root.rotation.y = heading;
    this.setCameraMode(this.cameraMode);
  }

  addMoney(n) { this.money = Math.max(0, Math.round(this.money + n)); return this.money; }
  setMoney(n) { this.money = Math.max(0, Math.round(n)); return this.money; }

  serialize() {
    return {
      x: this.position.x, y: this.position.y, z: this.position.z,
      heading: this.heading, yaw: this.yaw, pitch: this.pitch,
      money: this.money, cameraMode: this.cameraMode,
      appearance: this.appearance,
    };
  }
}
