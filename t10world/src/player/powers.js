// T10 World - sixteen powers. Each one is a definition: what it looks like,
// what it costs, how long before you can use it again, what key and what
// on-screen button fire it, and what it actually does to the world.
//
// The list is data, so adding a seventeenth is a definition and nothing else.
import * as THREE from '../../vendor/three.module.js';
import { clamp01, clampv, lerpv, makeRng, TAU } from '../core/math.js';
import { audio } from '../core/audio.js';

// Keys: the number row, then the free letters. V is the camera toggle and M is
// the map, so the bottom row skips both — a power on a key the game already
// uses is a power that never fires. tools/check-commands.mjs enforces this.
export const ENERGY_MAX = 100;
const REGEN = 11;          // energy per second

/**
 * Every power. `run(ctx)` does the work and returns a line for T10 to say;
 * returning null means it didn't fire and the cost isn't taken.
 */
export const POWERS = [
  {
    id: 'telekinesis', name: 'Telekinesis', glyph: '✥', key: 'Digit1',
    cost: 18, cooldown: 0.8, color: 0x8f6dff, pose: 'raise', sound: ['hum', 1.0],
    blurb: 'Lift everything loose in front of you and throw it.',
    run: (ctx) => {
      const hits = ctx.nearbyProps(16);
      const people = ctx.nearbyPeople(14);
      if (!hits.length && !people.length) return null;
      const dir = ctx.aim();
      for (const rec of hits) {
        ctx.launchProp(rec, dir.x * 16 + (ctx.rng() - 0.5) * 6, 11 + ctx.rng() * 7, dir.z * 16 + (ctx.rng() - 0.5) * 6);
      }
      for (const npc of people) { npc.downed = Math.max(npc.downed, 3.5); }
      ctx.burst(ctx.aimPoint(6), 0x8f6dff, 1.3);
      return 'Up they go — ' + (hits.length + people.length) + ' things off the ground.';
    },
  },
  {
    id: 'superjump', name: 'Super Jump', glyph: '⇡', key: 'Digit2',
    cost: 12, cooldown: 0.5, color: 0x5ad6ff, pose: 'self', sound: ['whoosh', 1.3],
    blurb: 'Launch straight up, and land without it hurting.',
    run: (ctx) => {
      const p = ctx.player;
      p.verticalVel = 19;
      p.grounded = false;
      p.godLanding = 3;
      ctx.burst(p.position, 0x5ad6ff, 1.0);
      return 'Up.';
    },
  },
  {
    id: 'superspeed', name: 'Super Speed', glyph: '≫', key: 'Digit3',
    cost: 26, cooldown: 1.2, duration: 10, color: 0x4ff0b0, pose: 'self', sound: ['whoosh', 0.8],
    blurb: 'Move four times as fast for ten seconds.',
    start: (ctx) => { ctx.player.speedMultiplier = 4; },
    end: (ctx) => { ctx.player.speedMultiplier = 1; },
    run: () => 'Four times the pace, for ten seconds.',
  },
  {
    id: 'flight', name: 'Flight', glyph: '⌃', key: 'Digit4',
    cost: 8, cooldown: 0.6, toggle: true, drain: 4, color: 0xa8d8ff, pose: 'raise', sound: ['hum', 1.4],
    blurb: 'Fly. Look where you want to go.',
    start: (ctx) => { ctx.player.flying = true; ctx.player.flySpeed = 3.2; },
    end: (ctx) => { ctx.player.flying = false; },
    run: (ctx) => (ctx.player.flying ? 'Flying. Jump to climb, crouch to drop.' : 'Back on the ground.'),
  },
  {
    id: 'forcefield', name: 'Force Field', glyph: '◯', key: 'Digit5',
    cost: 30, cooldown: 3, duration: 14, color: 0x63b9ff, pose: 'self', sound: ['hum', 0.7],
    blurb: 'A shell nothing gets through, and everything nearby gets pushed out of.',
    start: (ctx) => {
      ctx.player.immortal = true;
      ctx.showShield(true, 0x63b9ff);
    },
    tick: (ctx, dt) => {
      // Shove anyone who walks into it.
      for (const npc of ctx.nearbyPeople(3.4)) {
        const dx = npc.position.x - ctx.player.position.x, dz = npc.position.z - ctx.player.position.z;
        const d = Math.hypot(dx, dz) || 1;
        npc.position.x += (dx / d) * 4.5 * dt;
        npc.position.z += (dz / d) * 4.5 * dt;
        npc.root.position.copy(npc.position);
      }
    },
    end: (ctx) => { ctx.player.immortal = false; ctx.showShield(false); },
    run: () => 'Shield up. Nothing gets through for fourteen seconds.',
  },
  {
    id: 'timeslow', name: 'Time Slow', glyph: '◷', key: 'Digit6',
    cost: 34, cooldown: 4, duration: 8, color: 0xffd45a, pose: 'raise', sound: ['warp', 0.6],
    blurb: 'Slow the world to a quarter speed. You keep your own pace.',
    start: (ctx) => { ctx.game.timeScale = 0.25; ctx.player.speedMultiplier = 3.2; },
    end: (ctx) => { ctx.game.timeScale = 1; ctx.player.speedMultiplier = 1; },
    run: () => 'Everything else slows down.',
  },
  {
    id: 'teleport', name: 'Teleportation', glyph: '⤳', key: 'Digit7',
    cost: 20, cooldown: 1.0, color: 0xc86dff, pose: 'push', sound: ['warp', 1.2],
    blurb: 'Jump to wherever you are looking, up to forty metres.',
    run: (ctx) => {
      const to = ctx.aimPoint(40, true);
      if (!to) return null;
      ctx.burst(ctx.player.position, 0xc86dff, 1.1);
      ctx.player.teleport(to.x, to.z, to.y);
      ctx.player.verticalVel = 0;
      ctx.burst(to, 0xc86dff, 1.1);
      return 'There.';
    },
  },
  {
    id: 'gravity', name: 'Gravity Control', glyph: '⇵', key: 'Digit8',
    cost: 22, cooldown: 2, duration: 16, color: 0x7a8cff, pose: 'raise', sound: ['hum', 0.55],
    blurb: 'Cut gravity to a fifth. Everything falls like it is underwater.',
    start: (ctx) => { ctx.game.setGravity(0.2); },
    end: (ctx) => { ctx.game.setGravity(1); },
    run: () => 'Gravity at a fifth. Try jumping.',
  },
  {
    id: 'blast', name: 'Energy Blast', glyph: '✹', key: 'Digit9',
    cost: 24, cooldown: 0.9, color: 0xff7a3c, pose: 'push', sound: ['boom', 1.0],
    blurb: 'A shockwave out of your hands that flattens everything in front of you.',
    run: (ctx) => {
      const dir = ctx.aim();
      const at = ctx.aimPoint(12);
      let n = 0;
      for (const npc of ctx.nearbyPeople(16)) {
        const dx = npc.position.x - ctx.player.position.x, dz = npc.position.z - ctx.player.position.z;
        if (dx * dir.x + dz * dir.z < 0) continue;   // behind you
        npc.downed = Math.max(npc.downed, 5);
        n++;
      }
      for (const rec of ctx.nearbyProps(14)) ctx.launchProp(rec, dir.x * 22, 8, dir.z * 22);
      for (const c of ctx.nearbyCreatures(16)) {
        const dx = c.position.x - ctx.player.position.x, dz = c.position.z - ctx.player.position.z;
        if (dx * dir.x + dz * dir.z < 0) continue;
        if (!c.damage(70, 'player')) { c.freeze(1.2); n++; }
        else n++;
      }
      ctx.burst(at, 0xff7a3c, 2.2);
      ctx.player.camShake = 1.1;
      audio.explosion(4);
      return n ? n + ' knocked flat.' : 'Nothing in the way.';
    },
  },
  {
    id: 'invisible', name: 'Invisibility', glyph: '◌', key: 'Digit0',
    cost: 26, cooldown: 2, duration: 18, color: 0xbfe6ff, pose: 'self', sound: ['warp', 1.6],
    blurb: 'Nobody can see you. Not even the infected.',
    start: (ctx) => {
      ctx.player.invisible = true;
      ctx.setPlayerOpacity(0.18);
      if (ctx.game.npcs) ctx.game.npcs.playerHidden = true;
    },
    end: (ctx) => {
      ctx.player.invisible = false;
      ctx.setPlayerOpacity(1);
      if (ctx.game.npcs) ctx.game.npcs.playerHidden = false;
    },
    run: () => 'Gone. Eighteen seconds.',
  },
  {
    id: 'duplicate', name: 'Object Duplication', glyph: '⧉', key: 'KeyZ',
    cost: 16, cooldown: 1.2, color: 0x6dffc8, pose: 'push', sound: ['pop', 1.0],
    blurb: 'Copy whatever you are looking at, several times over.',
    run: (ctx) => {
      const rec = ctx.nearbyProps(9)[0];
      if (!rec) return null;
      let made = 0;
      for (let i = 0; i < 4; i++) {
        const a = ctx.rng() * TAU;
        const r = 2 + ctx.rng() * 3;
        if (ctx.game.world.spawnProp(rec.kind, rec.x + Math.cos(a) * r, rec.z + Math.sin(a) * r, { rot: ctx.rng() * TAU })) made++;
      }
      ctx.burst(rec, 0x6dffc8, 1.0);
      return made ? made + ' more of those.' : null;
    },
  },
  {
    id: 'freeze', name: 'Freeze', glyph: '❄', key: 'KeyX',
    cost: 28, cooldown: 2.5, color: 0x8fe8ff, pose: 'push', sound: ['chime', 1.5],
    blurb: 'Everyone in sight stops where they stand, for a while.',
    run: (ctx) => {
      let n = 0;
      for (const npc of ctx.nearbyPeople(45)) {
        npc.controlled = 'freeze';
        npc.frozenUntil = performance.now() + 12000;
        npc.human.setSkinTint(0x9fe0ff, 0x7fd8ff);
        n++;
      }
      for (const c of ctx.nearbyCreatures(45)) { c.freeze(12); n++; }
      ctx.burst(ctx.player.position, 0x8fe8ff, 2.4);
      return n ? n + ' frozen where they stand.' : 'Nothing close enough.';
    },
  },
  {
    id: 'heal', name: 'Healing', glyph: '✚', key: 'KeyC',
    cost: 20, cooldown: 2, color: 0x6dff8f, pose: 'raise', sound: ['chime', 1.0],
    blurb: 'Everyone on the ground nearby gets back up, cured of whatever had them.',
    run: (ctx) => {
      let n = 0;
      const apo = ctx.game.apocalypse;
      for (const npc of ctx.nearbyPeople(22)) {
        if (npc.downed > 0 || npc.infected || npc.hostile) {
          if (apo) apo.clearNpc(npc);
          npc.downed = 0;
          npc.reanimate = 0;
          npc.hitPoints = 100;
          n++;
        }
      }
      ctx.player.getUp();
      ctx.player.setZombie(false);
      ctx.burst(ctx.player.position, 0x6dff8f, 2.0);
      return n ? n + ' back on their feet, and clean.' : 'Nobody needed it.';
    },
  },
  {
    id: 'resize', name: 'Size Change', glyph: '⤢', key: 'KeyJ',
    cost: 14, cooldown: 1.0, color: 0xffa8d8, pose: 'self', sound: ['pop', 0.7],
    blurb: 'Cycle your own size: normal, small, huge.',
    run: (ctx) => {
      const p = ctx.player;
      const steps = [1, 0.45, 2.4];
      p.sizeStep = ((p.sizeStep || 0) + 1) % steps.length;
      const k = steps[p.sizeStep];
      p.human.setHeight(clampv(1.78 * k, 0.5, 5));
      p.rebuildAppearance();
      ctx.burst(p.position, 0xffa8d8, 1.2);
      return k === 1 ? 'Normal size.' : k < 1 ? 'Small. Everything is enormous now.' : 'Huge. Mind the wires.';
    },
  },
  {
    id: 'lightning', name: 'Lightning', glyph: '⚡', key: 'KeyB',
    cost: 32, cooldown: 1.6, color: 0xfff27a, pose: 'raise', sound: ['crackle', 1.0],
    blurb: 'Call a strike down on whatever you are looking at.',
    run: (ctx) => {
      const at = ctx.aimPoint(60, true) || ctx.aimPoint(30);
      ctx.bolt(at);
      if (ctx.game.atmosphere) ctx.game.atmosphere.lightning = 1;
      audio.thunder(0.1);
      let n = 0;
      for (const npc of ctx.game.npcs.npcs) {
        if (npc.position.distanceTo(at) > 7) continue;
        npc.downed = Math.max(npc.downed, 8);
        n++;
      }
      if (ctx.game.creatures) {
        const list = ctx.game.creatures.creatures;
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].position.distanceTo(at) > 7) continue;
          list[i].damage(180, 'player');
          n++;
        }
      }
      return n ? 'Struck. ' + n + ' down.' : 'Struck.';
    },
  },
  {
    id: 'summon', name: 'Creature Summon', glyph: '☾', key: 'KeyN',
    cost: 36, cooldown: 3, color: 0xff5ad0, pose: 'push', sound: ['boom', 0.6],
    blurb: 'Call something up out of the ground in front of you.',
    run: (ctx) => {
      const at = ctx.aimPoint(8);
      const made = ctx.summonCreature(at);
      ctx.burst(at, 0xff5ad0, 1.8);
      return made ? made + ' — it came up out of the pavement.' : 'Nothing answered.';
    },
  },
];

export const POWER_BY_ID = new Map(POWERS.map((p) => [p.id, p]));

/**
 * Runs the powers: energy, cooldowns, durations, and the effects pool the
 * definitions draw on.
 */
export class Powers {
  constructor(game) {
    this.game = game;
    this.rng = makeRng(0x31f9a2);
    this.energy = ENERGY_MAX;
    this.cooldowns = {};        // id -> seconds remaining
    this.active = {};           // id -> seconds remaining of a duration
    this.unlocked = true;

    this.group = new THREE.Group();
    this.group.name = 'powers';
    game.scene.add(this.group);
    this.buildEffects();
  }

  buildEffects() {
    // A pool of expanding rings — every visual effect in the list is one or
    // more of these, which keeps the whole system to two draw calls.
    this.rings = [];
    const geo = new THREE.RingGeometry(0.55, 0.72, 28);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.ringMesh = new THREE.InstancedMesh(geo, mat, 48);
    this.ringMesh.count = 0;
    this.ringMesh.frustumCulled = false;
    this.ringMesh.matrixAutoUpdate = false;
    this.ringMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(48 * 3).fill(1), 3);
    this.group.add(this.ringMesh);

    // The shield.
    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 20, 14),
      new THREE.MeshBasicMaterial({
        color: 0x63b9ff, transparent: true, opacity: 0.16, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      })
    );
    this.shield.visible = false;
    this.group.add(this.shield);

    // A lightning bolt, drawn as a stretched column.
    this.boltMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.34, 1, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.boltMesh.visible = false;
    this.group.add(this.boltMesh);
    this.boltT = 0;

    this.light = new THREE.PointLight(0xffffff, 0, 24, 2);
    this.group.add(this.light);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._dir = new THREE.Vector3();
  }

  // -------------------------------------------------------------------------
  // The context the definitions are handed
  // -------------------------------------------------------------------------
  get ctx() {
    const g = this.game;
    const self = this;
    return {
      game: g,
      player: g.player,
      rng: () => self.rng(),
      /** Horizontal aim direction. */
      aim: () => {
        const c = g.camera;
        const v = self._dir.set(0, 0, -1).applyQuaternion(c.quaternion);
        v.y = 0;
        return v.normalize();
      },
      /** A point along the view, optionally dropped onto the ground. */
      aimPoint: (dist, toGround) => {
        const c = g.camera;
        const v = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
        const p = c.position.clone().addScaledVector(v, dist);
        if (toGround) {
          const ground = g.world.groundAt(p.x, p.z);
          if (p.y < ground || toGround === true) p.y = ground;
        }
        return p;
      },
      nearbyPeople: (r) => g.npcs.within(g.player.position, r),
      nearbyCreatures: (r) => {
        if (!g.creatures) return [];
        const p = g.player.position;
        return g.creatures.creatures.filter((c) => c.position.distanceTo(p) <= r);
      },
      nearbyProps: (r) => {
        const out = [];
        const p = g.player.position;
        for (const rec of g.world.spawnedProps) {
          if (Math.hypot(rec.x - p.x, rec.z - p.z) < r) out.push(rec);
        }
        return out;
      },
      launchProp: (rec, vx, vy, vz) => self.launchProp(rec, vx, vy, vz),
      burst: (at, color, scale) => self.burst(at, color, scale),
      bolt: (at) => self.bolt(at),
      showShield: (on, color) => self.showShield(on, color),
      setPlayerOpacity: (a) => self.setPlayerOpacity(a),
      summonCreature: (at) => (g.creatures ? g.creatures.summon(null, at) : null),
    };
  }

  // -------------------------------------------------------------------------
  /** @returns a line for T10, or a reason it didn't fire. */
  use(id) {
    const def = POWER_BY_ID.get(id);
    if (!def) return null;
    if (this.game.phase !== 'playing') return null;

    // A toggle that's already on just turns off, free.
    if (def.toggle && this.active[id]) {
      delete this.active[id];
      if (def.end) def.end(this.ctx);
      return def.run ? def.run(this.ctx) : 'Off.';
    }
    if ((this.cooldowns[id] || 0) > 0) {
      return def.name + ' needs ' + this.cooldowns[id].toFixed(1) + ' more seconds.';
    }
    if (this.energy < def.cost) {
      return 'Not enough left. ' + Math.round(this.energy) + ' of ' + def.cost + '.';
    }

    const ctx = this.ctx;
    if (def.start) def.start(ctx);
    const reply = def.run ? def.run(ctx) : 'Done.';
    if (reply === null) {
      // Nothing to act on — refund it.
      if (def.end) def.end(ctx);
      return 'Nothing for ' + def.name.toLowerCase() + ' to work on.';
    }

    this.energy = Math.max(0, this.energy - def.cost);
    this.cooldowns[id] = def.cooldown || 0;
    // Every power is cast, not just wished for.
    if (this.game.player && this.game.player.castPose) this.game.player.castPose(def.pose);
    if (def.duration || def.toggle) this.active[id] = def.duration || Infinity;
    this.flash(def.color);
    // Each power has its own voice, not a shared interface blip.
    if (def.sound) audio.power(def.sound[0], def.sound[1]);
    else audio.t10Blip('open');
    return reply;
  }

  /** End a power that is running. @returns true if one was. */
  stop(id) {
    if (this.active[id] == null) return false;
    const def = POWER_BY_ID.get(id);
    delete this.active[id];
    if (def && def.end) def.end(this.ctx);
    return true;
  }

  /** End everything that is running. @returns how many. */
  stopAll() {
    const ids = Object.keys(this.active);
    for (const id of ids) this.stop(id);
    return ids.length;
  }

  status() {
    const ready = POWERS.filter((p) => (this.cooldowns[p.id] || 0) <= 0 && this.energy >= p.cost).length;
    const on = Object.keys(this.active);
    return Math.round(this.energy) + ' of ' + ENERGY_MAX + ' energy, ' + ready + ' of ' +
      POWERS.length + ' ready' + (on.length ? ', running: ' + on.map((id) => POWER_BY_ID.get(id).name).join(', ') : '') + '.';
  }

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------
  burst(at, color, scale) {
    if (this.rings.length > 40) this.rings.shift();
    this.rings.push({ x: at.x, y: at.y + 0.1, z: at.z, t: 0, life: 0.85, scale: scale || 1, color: new THREE.Color(color) });
  }

  bolt(at) {
    this.boltMesh.visible = true;
    this.boltT = 0.35;
    this.boltMesh.position.set(at.x, at.y + 30, at.z);
    this.boltMesh.scale.set(1, 60, 1);
    this.burst(at, 0xfff27a, 2.4);
  }

  showShield(on, color) {
    this.shield.visible = !!on;
    if (color) this.shield.material.color.setHex(color);
  }

  setPlayerOpacity(a) {
    const p = this.game.player;
    if (!p || !p.human) return;
    for (const k in p.human.parts) {
      const part = p.human.parts[k];
      if (!part) continue;
      part.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { m.transparent = a < 1; m.opacity = a; m.needsUpdate = true; }
      });
    }
  }

  flash(color) {
    this.light.color.setHex(color || 0xffffff);
    this.lightT = 0.3;
  }

  /** Throw a spawned prop. It arcs, lands, and stays where it lands. */
  launchProp(rec, vx, vy, vz) {
    if (!this.thrown) this.thrown = [];
    if (this.thrown.some((t) => t.rec === rec)) return;
    this.thrown.push({ rec, vx, vy, vz, spin: (this.rng() - 0.5) * 8, y: rec.y });
  }

  // -------------------------------------------------------------------------
  update(dt) {
    // Energy regenerates unless something is draining it.
    let drain = 0;
    for (const id in this.active) {
      const def = POWER_BY_ID.get(id);
      if (def && def.drain) drain += def.drain;
    }
    this.energy = clampv(this.energy + (REGEN - drain) * dt, 0, ENERGY_MAX);

    for (const id in this.cooldowns) {
      this.cooldowns[id] -= dt;
      if (this.cooldowns[id] <= 0) delete this.cooldowns[id];
    }
    for (const id in this.active) {
      const def = POWER_BY_ID.get(id);
      if (def && def.tick) def.tick(this.ctx, dt);
      if (this.active[id] === Infinity) {
        // A toggle runs until the energy is gone.
        if (this.energy <= 0.5) { delete this.active[id]; if (def.end) def.end(this.ctx); }
        continue;
      }
      this.active[id] -= dt;
      if (this.active[id] <= 0) {
        delete this.active[id];
        if (def && def.end) def.end(this.ctx);
      }
    }

    // Frozen people thaw.
    if (this.game.npcs) {
      const now = performance.now();
      for (const npc of this.game.npcs.npcs) {
        if (!npc.frozenUntil) continue;
        if (now >= npc.frozenUntil) {
          npc.frozenUntil = 0;
          if (npc.controlled === 'freeze') npc.controlled = null;
          npc.human.setSkinTint(null, null);
        }
      }
    }

    // Thrown props.
    if (this.thrown && this.thrown.length) {
      for (let i = this.thrown.length - 1; i >= 0; i--) {
        const t = this.thrown[i];
        t.vy -= 17 * dt;
        t.rec.x += t.vx * dt;
        t.rec.z += t.vz * dt;
        t.y += t.vy * dt;
        const ground = this.game.world.groundAt(t.rec.x, t.rec.z);
        if (t.y <= ground) {
          t.y = ground;
          this.thrown.splice(i, 1);
        }
        t.rec.y = t.y;
        t.rec.group.position.set(t.rec.x, t.y, t.rec.z);
        t.rec.group.rotation.y += t.spin * dt;
        if (t.rec.interactable) { t.rec.interactable.x = t.rec.x; t.rec.interactable.z = t.rec.z; t.rec.interactable.y = t.y; }
      }
    }

    // Rings.
    let n = 0;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t > r.life) { this.rings.splice(i, 1); continue; }
      const k = r.t / r.life;
      this._p.set(r.x, r.y + k * 0.8, r.z);
      this._q.setFromAxisAngle(this._up, 0);
      this._s.setScalar(lerpv(0.4, 7 * r.scale, k));
      this._m.compose(this._p, this._q, this._s);
      this.ringMesh.setMatrixAt(n, this._m);
      const fade = 1 - k;
      this.ringMesh.instanceColor.setXYZ(n, r.color.r * fade, r.color.g * fade, r.color.b * fade);
      n++;
      if (n >= 48) break;
    }
    this.ringMesh.count = n;
    if (n) { this.ringMesh.instanceMatrix.needsUpdate = true; this.ringMesh.instanceColor.needsUpdate = true; }

    // Shield follows you.
    if (this.shield.visible) {
      const p = this.game.player.position;
      this.shield.position.set(p.x, p.y + 0.95, p.z);
      this.shield.rotation.y += dt * 0.6;
      this.shield.material.opacity = 0.12 + Math.sin(performance.now() * 0.004) * 0.05;
    }

    if (this.boltT > 0) {
      this.boltT -= dt;
      this.boltMesh.material.opacity = clamp01(this.boltT / 0.35) * 0.9;
      if (this.boltT <= 0) this.boltMesh.visible = false;
    }
    if (this.lightT > 0) {
      this.lightT -= dt;
      this.light.position.copy(this.game.player.position).y += 1.4;
      this.light.intensity = clamp01(this.lightT / 0.3) * 16;
    } else if (this.light.intensity) {
      this.light.intensity = 0;
    }
  }

  serialize() {
    return { energy: this.energy, active: Object.keys(this.active) };
  }

  /** Put a saved world's powers back: the energy pool and whatever was running. */
  restore(data) {
    if (!data) return;
    if (typeof data.energy === 'number') this.energy = clampv(data.energy, 0, ENERGY_MAX);
    if (!Array.isArray(data.active)) return;
    for (const id of data.active) {
      const def = POWER_BY_ID.get(id);
      if (!def) continue;
      if (def.start) def.start(this.ctx);
      this.active[id] = def.duration || Infinity;
    }
  }
}
