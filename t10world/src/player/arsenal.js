// T10 World - holding a gun and using it. Equip, fire, reload, and what the
// bullet does when it arrives.
//
// Bullets are hitscan: one ray from the camera, cone spread from the weapon's
// accuracy, tested against people first and then the world. Heavy weapons add
// a blast radius. Everything you can see — flash, tracer, shells — lives in
// one small pool so firing a minigun doesn't allocate.
import * as THREE from '../../vendor/three.module.js';
import { weaponById, weaponMesh, WEAPONS } from '../entities/weapons.js';
import { clamp01, clampv, lerpv, makeRng, TAU } from '../core/math.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';

const TRACERS = 24;

export class Arsenal {
  constructor(game) {
    this.game = game;
    this.rng = makeRng(0x7c1a99);
    this.weapon = null;
    this.ammo = 0;
    this.reserve = 0;
    this.cooldown = 0;
    this.reloading = 0;
    this.spin = 0;
    this.burstLeft = 0;
    this.shotsFired = 0;
    this.hits = 0;
    this.infiniteAmmo = true;   // T10 is not going to make you count rounds.

    this.group = new THREE.Group();
    this.group.name = 'arsenal';
    game.scene.add(this.group);

    this.buildEffects();
  }

  get armed() { return !!this.weapon; }

  buildEffects() {
    // Muzzle flash: two crossed additive quads.
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.flashMat = flashMat;
    this.flash = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), flashMat);
      q.rotation.x = i * Math.PI / 2;
      this.flash.add(q);
    }
    this.flash.visible = false;
    this.group.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffc478, 0, 14, 2);
    this.group.add(this.flashLight);

    // Tracers: a pool of thin stretched boxes.
    const tracerGeo = new THREE.BoxGeometry(1, 0.016, 0.016);
    tracerGeo.translate(0.5, 0, 0);
    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffd489, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.tracerMesh = new THREE.InstancedMesh(tracerGeo, tracerMat, TRACERS);
    this.tracerMesh.count = 0;
    this.tracerMesh.frustumCulled = false;
    this.tracerMesh.matrixAutoUpdate = false;
    this.group.add(this.tracerMesh);
    this.tracers = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  // -------------------------------------------------------------------------

  /** Put a gun in your hands. Accepts an id or a weapon record. */
  equip(w) {
    const weapon = typeof w === 'string' ? weaponById(w) : w;
    if (!weapon) return null;
    this.unequip();
    this.weapon = weapon;
    this.ammo = weapon.mag;
    this.reserve = weapon.mag * 6;
    this.reloading = 0;
    this.spin = 0;

    this.view = weaponMesh(weapon).clone(true);
    this.muzzleLocal = weaponMesh(weapon).userData.muzzle.clone();
    this.game.scene.add(this.view);
    this.updateViewModel(0, true);
    return weapon;
  }

  unequip() {
    if (this.view) { this.game.scene.remove(this.view); this.view = null; }
    const p = this.game.player;
    if (p && p.human && p.human.animator) p.human.animator.weaponAim = null;
    this.weapon = null;
    this.flash.visible = false;
    this.flashLight.intensity = 0;
    return true;
  }

  /** Where the muzzle is in the world right now. */
  muzzleWorld(out) {
    out = out || new THREE.Vector3();
    if (this.view) out.copy(this.muzzleLocal).applyMatrix4(this.view.matrixWorld);
    else out.copy(this.game.camera.position);
    return out;
  }

  /**
   * The gun is carried on the camera: down and to the right in first person,
   * pulled in beside the shoulder in third. That keeps it pointing exactly
   * where the shot goes, which matters more than where the hands are.
   */
  updateViewModel(dt, snap) {
    if (!this.view) return;
    const cam = this.game.camera;
    const p = this.game.player;
    const first = p.cameraMode === 'first';
    const kick = this.kick || 0;

    const right = this._v.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = this._v2.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const fwd = this._dir.set(0, 0, -1).applyQuaternion(cam.quaternion);

    const sway = Math.sin(p.human.animator.phase * TAU) * clamp01(p.speed / p.walkSpeed) * 0.012;

    // Tell the body it's holding something, so the arms come up and the chest
    // squares to the target. In first person nobody sees the body, so skip it.
    p.human.animator.weaponAim = first ? null : {
      weight: 1, pitch: p.pitch, aiming: !!this.aiming,
    };

    let target;
    if (first) {
      target = cam.position.clone()
        .addScaledVector(right, 0.17)
        .addScaledVector(up, -0.16 + sway)
        .addScaledVector(fwd, 0.26 - kick * 0.09);
    } else {
      // Third person puts the gun in the hand that is holding it. The pose
      // above has already put that hand out in front of the chest.
      const handBone = p.human.boneMap && p.human.boneMap.handR;
      if (handBone) {
        handBone.updateWorldMatrix(true, false);
        target = new THREE.Vector3().setFromMatrixPosition(handBone.matrixWorld);
        target.addScaledVector(fwd, 0.12 - kick * 0.06).addScaledVector(up, -0.02);
      } else {
        target = new THREE.Vector3(p.position.x, p.position.y + p.eyeHeight * 0.74 + sway, p.position.z)
          .addScaledVector(right, 0.30)
          .addScaledVector(fwd, 0.30 - kick * 0.09);
      }
    }

    if (snap) this.view.position.copy(target);
    else this.view.position.lerp(target, clamp01(dt * (first ? 22 : 30)));
    this.view.quaternion.copy(cam.quaternion);
    // The model points down its own +X and the camera looks down -Z, so the
    // gun's frame turns +90° about Y: R_y(90°)·(1,0,0) = (0,0,-1). Turning it
    // the other way pointed the barrel out of the back of your head.
    this.view.rotateY(Math.PI / 2);
    this.view.rotateZ(kick * 0.5);
    this.view.updateMatrixWorld();
  }

  // -------------------------------------------------------------------------

  /** @returns a short string for T10 to say, or null if nothing happened. */
  pullTrigger() {
    const w = this.weapon;
    if (!w) return null;
    if (this.reloading > 0) return null;
    if (this.cooldown > 0) return null;
    if (this.ammo <= 0) {
      if (this.infiniteAmmo) { this.reload(); return null; }
      audio.dryFire();
      this.cooldown = 0.35;
      return 'Empty. Say "T10 reload".';
    }
    // A minigun has to wind up before it will do anything.
    if (w.spinUp && this.spin < 1) return null;

    this.fireOnce();
    if (w.burst) this.burstLeft = w.burst - 1;
    return null;
  }

  fireOnce() {
    const w = this.weapon;
    const g = this.game;
    const cam = g.camera;
    this.ammo--;
    this.shotsFired++;
    this.cooldown = 60 / Math.max(1, w.rpm);

    const origin = cam.position.clone();
    const base = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);

    let anyHit = null;
    for (let p = 0; p < w.pellets; p++) {
      const dir = base.clone();
      if (w.spread > 0) {
        const a = this.rng() * TAU;
        const r = Math.sqrt(this.rng()) * w.spread * (this.aiming ? 0.45 : 1);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
        dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      }
      const hit = this.castBullet(origin, dir, w.range);
      if (hit && !anyHit) anyHit = hit;
      this.addTracer(this.muzzleWorld(), hit ? hit.point : origin.clone().addScaledVector(dir, w.range));
    }

    if (w.blast && anyHit) this.explode(anyHit.point, w.blast, w.damage);

    // Flash, kick, noise.
    this.flashTimer = w.quiet ? 0.02 : 0.055;
    this.kick = Math.min(1.4, (this.kick || 0) + w.recoil * 0.12);
    const p = g.player;
    p.pitch = clampv(p.pitch + w.recoil * 0.0075 * (this.aiming ? 0.6 : 1), -1.32, 1.28);
    p.yaw += (this.rng() - 0.5) * w.recoil * 0.004;
    p.camShake = Math.min(1.4, p.camShake + w.recoil * 0.04);
    audio.gunshot({ heft: clamp01(w.damage / 160), quiet: w.quiet });
  }

  /** One ray: people first, then the world. */
  castBullet(origin, dir, maxDist) {
    const g = this.game;
    let best = null, bestT = maxDist;

    // People. Each is a 0.42m capsule from the ground to the top of the head.
    if (g.npcs) {
      for (const npc of g.npcs.npcs) {
        if (npc.indoors) continue;
        // Someone on the ground is still there to hit — just a lot flatter.
        const t = raySegment(origin, dir, npc.position, npc.downed > 0 ? 0.55 : 1.75, npc.downed > 0 ? 0.6 : 0.42, bestT);
        if (t != null && t < bestT) {
          bestT = t;
          best = { npc, t, point: origin.clone().addScaledVector(dir, t) };
        }
      }
    }

    // World: march the collider hash. Coarse, but the city is boxes.
    const step = 0.55;
    const probe = new THREE.Vector3();
    for (let t = 0.6; t < Math.min(bestT, maxDist); t += step) {
      probe.copy(origin).addScaledVector(dir, t);
      const ground = g.world.groundAt(probe.x, probe.z);
      if (probe.y <= ground) {
        if (t < bestT) { bestT = t; best = { world: true, t, point: probe.clone().setY(ground + 0.01), surface: g.world.surfaceAt(probe.x, probe.z) }; }
        break;
      }
      const c = probe.clone();
      if (g.world.resolveCollision(c, 0.05)) {
        if (t < bestT) { bestT = t; best = { world: true, t, point: probe.clone(), surface: 'concrete' }; }
        break;
      }
    }

    if (best && best.npc) this.hitPerson(best.npc, dir, best.point);
    else if (best) this.hitWorld(best);
    return best;
  }

  hitPerson(npc, dir, point) {
    const w = this.weapon;
    this.hits++;
    const g = this.game;
    // A head shot is anything in the top 22cm.
    const head = point.y > npc.position.y + 1.45;
    const dmg = w.damage * (head ? 2.2 : 1) * (g.player.strength || 1);
    npc.hitPoints = (npc.hitPoints == null ? 100 : npc.hitPoints) - dmg;
    if (g.gore) {
      g.gore.hit(point.x, point.y - 0.9, point.z, clamp01(dmg / 90) * (head ? 1 : 0.8), dir.x, dir.z);
      if (head) g.gore.spray(point.x, point.y, point.z, 30, dir.x, dir.z, 1);
    }
    if (npc.hitPoints <= 0) {
      npc.hitPoints = 100;
      npc.downed = head ? 999 : 14 + this.rng() * 10;
      npc.combatTarget = null;
      if (g.gore) g.gore.pool(npc.position.x, npc.position.z, head ? 2.1 : 1.5);
      if (g.apocalypse) g.apocalypse.casualties++;
    } else {
      npc.downed = Math.max(npc.downed, 1.2);
    }
  }

  hitWorld(hit) {
    if (this.game.gore) {
      // Dust and chips, reusing the droplet pool with a grey tint would need a
      // second buffer; a small mark is enough and costs nothing.
    }
    audio.bulletImpact(hit.surface);
  }

  explode(point, radius, damage) {
    const g = this.game;
    audio.explosion(radius);
    if (g.atmosphere) g.atmosphere.lightning = Math.max(g.atmosphere.lightning || 0, 0.7);
    if (g.npcs) {
      for (const npc of g.npcs.npcs) {
        const d = npc.position.distanceTo(point);
        if (d > radius) continue;
        npc.downed = Math.max(npc.downed, lerpv(16, 4, d / radius));
        if (g.gore) {
          g.gore.hit(npc.position.x, npc.position.y, npc.position.z, 1, (npc.position.x - point.x) / (d || 1), (npc.position.z - point.z) / (d || 1));
          g.gore.pool(npc.position.x, npc.position.z, 1.8);
        }
        if (g.apocalypse) g.apocalypse.casualties++;
      }
    }
    const p = g.player;
    const pd = p.position.distanceTo(point);
    if (pd < radius) { p.camShake = 1.5; p.knockDown(4, 'blast'); }
  }

  reload() {
    const w = this.weapon;
    if (!w || this.reloading > 0 || this.ammo >= w.mag) return false;
    this.reloading = w.reload;
    audio.reloadClick('out');
    return true;
  }

  addTracer(from, to) {
    if (this.tracers.length >= TRACERS) this.tracers.shift();
    this.tracers.push({ from: from.clone(), to: to.clone(), life: 0.07 });
  }

  // -------------------------------------------------------------------------
  update(dt, input) {
    // Tracers fade fast.
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }
    const n = this.tracers.length;
    for (let i = 0; i < n; i++) {
      const t = this.tracers[i];
      const d = this._dir.copy(t.to).sub(t.from);
      const len = d.length() || 0.001;
      d.divideScalar(len);
      this._q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d);
      this._m.compose(t.from, this._q, new THREE.Vector3(len, 1, 1));
      this.tracerMesh.setMatrixAt(i, this._m);
    }
    this.tracerMesh.count = n;
    if (n) this.tracerMesh.instanceMatrix.needsUpdate = true;

    if (!this.weapon) { this.flash.visible = false; this.flashLight.intensity = 0; return; }
    const w = this.weapon;

    if (this.cooldown > 0) this.cooldown -= dt;
    this.kick = Math.max(0, (this.kick || 0) - dt * 6);

    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const want = w.mag - this.ammo;
        const take = this.infiniteAmmo ? want : Math.min(want, this.reserve);
        this.ammo += take;
        if (!this.infiniteAmmo) this.reserve -= take;
        audio.reloadClick('in');
      }
    }

    // Trigger. Touch uses a dedicated button; on desktop it's the left mouse.
    // USE doubles as the trigger, so one button covers shooting, sitting,
    // talking and doors — which is what it has to be on a phone.
    const held = this.triggerHeld || (input && input.buttons.fire);
    if (w.spinUp) {
      this.spin = clamp01(this.spin + (held ? dt / w.spinUp : -dt / (w.spinUp * 0.7)));
    }
    if (this.burstLeft > 0 && this.cooldown <= 0) {
      this.burstLeft--;
      this.fireOnce();
    } else if (held && (w.auto || !this.firedThisPress)) {
      if (this.pullTrigger() === null && !w.auto) this.firedThisPress = true;
    }
    if (!held) this.firedThisPress = false;
    if (!this.infiniteAmmo && this.ammo <= 0 && this.reloading <= 0) this.reload();

    // Muzzle flash.
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const m = this.muzzleWorld();
      this.flash.position.copy(m);
      this.flash.visible = true;
      this.flash.rotation.z += 1.1;
      const k = clamp01(this.flashTimer / 0.055);
      this.flashMat.opacity = k * 0.9;
      const s = lerpv(0.6, 1.5, clamp01(w.damage / 140)) * (0.7 + k * 0.6);
      this.flash.scale.setScalar(s);
      this.flashLight.position.copy(m);
      this.flashLight.intensity = k * lerpv(3, 14, clamp01(w.damage / 160));
    } else {
      this.flash.visible = false;
      this.flashLight.intensity = 0;
    }

    this.updateViewModel(dt, false);
  }

  status() {
    if (!this.weapon) return 'You\'re empty-handed.';
    const w = this.weapon;
    return w.name + ' — ' + w.damage + ' damage, ' + w.rpm + ' rpm, ' + w.mag + ' round magazine, ' +
      w.range + 'm, ' + (w.auto ? 'automatic' : w.burst ? w.burst + '-round burst' : 'semi-automatic') +
      (w.quiet ? ', suppressed' : '') + '. ' + this.ammo + ' loaded.';
  }
}

/**
 * Ray against an upright capsule, returned as the distance along the ray.
 * Cheap enough to run against every person on screen for every pellet.
 */
function raySegment(origin, dir, base, height, radius, maxT) {
  // Work in the horizontal plane first, then check the height band.
  const ox = origin.x - base.x, oz = origin.z - base.z;
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a < 1e-6) return null;
  const b = 2 * (ox * dir.x + oz * dir.z);
  const c = ox * ox + oz * oz - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < 0.4) t = (-b + sq) / (2 * a);
  if (t < 0.4 || t > maxT) return null;
  const y = origin.y + dir.y * t;
  if (y < base.y - 0.1 || y > base.y + height) return null;
  return t;
}
