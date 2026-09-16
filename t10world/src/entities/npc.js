// T10 World - NPC life simulation. Every person has a schedule, a destination
// and a personality; they walk the sidewalk grid, use the world's furniture,
// react to the player and to weather, and keep doing it whether or not anyone
// is watching.
import * as THREE from '../../vendor/three.module.js';
import { Human } from '../human/human.js';
import { generateAppearance, describeAppearance, PERSONALITIES } from '../human/appearance.js';
import { STATES } from '../human/animator.js';
import { BLOCK_SIZE, CITY_RADIUS, ROAD_TYPES } from '../world/city.js';
import { clamp01, clampv, lerpv, damp, dampAngle, wrapAngle, makeRng, TAU, distToSeg2D } from '../core/math.js';
import { settings, perf } from '../core/settings.js';
import { audio } from '../core/audio.js';

export const ACTIVITIES = {
  commute: 'heading to work', work: 'working', shop: 'shopping', eat: 'getting food',
  home: 'heading home', relax: 'relaxing', exercise: 'exercising', socialise: 'meeting a friend',
  wander: 'wandering', phone: 'on their phone', sit: 'sitting', wait: 'waiting',
  follow: 'following you', flee: 'getting away', dance: 'dancing', frozen: 'frozen',
};

const GREETINGS = [
  'Hey.', 'Morning.', 'How\'s it going?', 'Nice day.', 'Hey there.', 'You alright?',
  'Afternoon.', 'Evening.', 'Hi.', 'Good to see someone out here.',
];
const SMALLTALK = [
  'Long day.', 'This city never slows down.', 'I love this part of town.',
  'You been down by the water lately?', 'Traffic was awful.', 'I should get going.',
  'Ever seen the towers at night? Worth it.', 'Weather\'s turning.',
  'You\'re not from around here, are you?', 'I used to live two blocks over.',
];
const RAIN_LINES = ['Ugh, rain.', 'I left my umbrella at home.', 'Typical.', 'Getting soaked out here.'];
const NIGHT_LINES = ['Late one.', 'Streets are quiet.', 'Should be asleep.', 'Can\'t sleep either?'];

export class NPC {
  constructor(manager, appearance, x, z) {
    this.manager = manager;
    this.world = manager.world;
    this.appearance = appearance;
    this.rng = makeRng(appearance.seed ^ 0x2f1d);
    this.human = new Human(appearance, { tier: 'npc' });
    this.root = this.human.root;
    this.position = new THREE.Vector3(x, 0, z);
    this.position.y = this.world.groundAt(x, z);
    this.root.position.copy(this.position);
    this.heading = this.rng() * TAU;
    this.root.rotation.y = this.heading;

    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.targetSpeed = 0;
    this.walkSpeed = lerpv(1.15, 1.75, appearance.energyTrait) * this.rng.range(0.9, 1.1);
    this.runSpeed = this.walkSpeed * 2.4;

    this.path = [];
    this.pathIndex = 0;
    this.destination = null;
    this.activity = 'wander';
    this.activityTimer = this.rng.range(4, 20);
    this.state = STATES.IDLE;
    this.lookTarget = null;
    this.talkTimer = 0;
    this.talkPartner = null;
    this.reactCooldown = 0;
    this.phoneTimer = this.rng.range(20, 180);
    this.controlled = null;      // 'follow' | 'freeze' | 'dance' | 'apocalypse' | 'mind' | 'love'
    // End-of-the-world state. All false in a normal city.
    this.infected = false;
    this.hostile = false;
    this.panicking = false;
    this.downed = 0;
    this.combatTarget = null;
    this.attackCooldown = 0;
    this.infectCooldown = 0;
    this.abducting = null;
    this.turning = 0;
    this.feeding = 0;          // a zombie at a body
    this.beingEaten = null;    // ...and the body it's at
    this.reanimate = 0;        // seconds until this corpse gets back up
    this.hitPoints = 100;
    this.vehicle = null;
    this.indoors = false;
    this.lastLine = '';
    this.mood = this.rng.range(0.35, 0.9);
    this.updateAccumulator = 0;
    this.lodLevel = 0;

    this.human.setGroundSampler((gx, gz) => ({
      y: this.world.groundAt(gx, gz),
      normal: this.world.normalAt(gx, gz),
    }));
    this.human.animator.onFootstep = (side, spd) => {
      if (this.lodLevel > 0) return;
      const d = this.manager.listener ? this.position.distanceTo(this.manager.listener) : 99;
      if (d < 16) audio.footstep(this.world.surfaceAt(this.position.x, this.position.z), spd, clampv((this.position.x - this.manager.listener.x) / 16, -1, 1));
    };

    this.pickSchedule();
  }

  get name() { return this.appearance.name; }

  // -------------------------------------------------------------------------
  // Scheduling
  // -------------------------------------------------------------------------

  /** Pick an activity appropriate to the clock and this person's job. */
  pickSchedule() {
    const hour = this.manager.atmosphere ? this.manager.atmosphere.timeOfDay : 12;
    const p = this.appearance;
    const r = this.rng;
    let act;
    if (hour >= 0 && hour < 6) act = r.chance(0.72) ? 'home' : r.pick(['wander', 'wait']);
    else if (hour < 9) act = r.chance(0.6) ? 'commute' : r.pick(['eat', 'exercise']);
    else if (hour < 12) act = r.chance(0.55) ? 'work' : r.pick(['shop', 'wander', 'relax']);
    else if (hour < 14) act = r.chance(0.5) ? 'eat' : r.pick(['work', 'shop']);
    else if (hour < 17) act = r.chance(0.5) ? 'work' : r.pick(['shop', 'wander', 'exercise']);
    else if (hour < 20) act = r.chance(0.45) ? 'home' : r.pick(['eat', 'socialise', 'shop', 'exercise']);
    else if (hour < 23) act = r.chance(0.4) ? 'relax' : r.pick(['socialise', 'eat', 'home', 'wander']);
    else act = r.chance(0.6) ? 'home' : 'wander';

    if (p.curiosity > 0.9 && r.chance(0.25)) act = 'wander';
    this.setActivity(act);
  }

  setActivity(act) {
    this.activity = act;
    this.activityTimer = this.rng.range(20, 90);
    this.destination = this.pickDestination(act);
    if (this.destination) this.buildPath(this.destination.x, this.destination.z);
  }

  pickDestination(act) {
    const city = this.world.city;
    const r = this.rng;
    const near = (radius) => {
      const a = r() * TAU, d = r() * radius;
      return { x: this.position.x + Math.cos(a) * d, z: this.position.z + Math.sin(a) * d };
    };
    let target;
    switch (act) {
      case 'work': case 'commute': {
        const lots = city.lotsNear(this.position.x, this.position.z, 420)
          .filter((l) => l.kind === 'office' || l.kind === 'tower' || l.kind === 'shop' || l.kind === 'warehouse');
        target = lots.length ? r.pick(lots) : near(180);
        break;
      }
      case 'shop': {
        const lots = city.lotsNear(this.position.x, this.position.z, 340).filter((l) => l.kind === 'shop' || l.kind === 'mall');
        target = lots.length ? r.pick(lots) : near(150);
        break;
      }
      case 'eat': {
        const lots = city.lotsNear(this.position.x, this.position.z, 340)
          .filter((l) => l.kind === 'restaurant' || l.kind === 'cafe' || l.kind === 'diner');
        target = lots.length ? r.pick(lots) : near(140);
        break;
      }
      case 'home': {
        const lots = city.lotsNear(this.position.x, this.position.z, 520).filter((l) => l.kind === 'house' || l.kind === 'apartment');
        target = lots.length ? r.pick(lots) : near(220);
        break;
      }
      case 'relax': case 'socialise': {
        const parks = city.parkAreas();
        const p = parks[r.int(0, parks.length - 1)];
        target = { x: p.x + r.range(-p.w * 0.35, p.w * 0.35), z: p.z + r.range(-p.d * 0.35, p.d * 0.35) };
        break;
      }
      case 'exercise': {
        const parks = city.parkAreas();
        const p = parks[r.int(0, parks.length - 1)];
        target = { x: p.x + r.range(-50, 50), z: p.z + r.range(-40, 40) };
        break;
      }
      default: target = near(r.range(60, 220));
    }
    const sw = city.nearestSidewalk(target.x, target.z);
    return { x: sw.x, z: sw.z, lot: target.kind ? target : null, act };
  }

  // -------------------------------------------------------------------------
  // Pathing — walk the sidewalk grid, turning corners at intersections.
  // -------------------------------------------------------------------------
  buildPath(tx, tz) {
    this.path.length = 0;
    this.pathIndex = 0;
    const sx = this.position.x, sz = this.position.z;
    // Nearest grid lines to start and end.
    const startLineX = Math.round(sx / BLOCK_SIZE) * BLOCK_SIZE;
    const startLineZ = Math.round(sz / BLOCK_SIZE) * BLOCK_SIZE;
    const endLineX = Math.round(tx / BLOCK_SIZE) * BLOCK_SIZE;
    const endLineZ = Math.round(tz / BLOCK_SIZE) * BLOCK_SIZE;
    const dStartX = Math.abs(sx - startLineX), dStartZ = Math.abs(sz - startLineZ);

    const push = (x, z) => {
      const sw = this.world.city.nearestSidewalk(x, z);
      this.path.push(new THREE.Vector3(sw.x, 0, sw.z));
    };

    // Step onto the nearer sidewalk line first, then travel in L-shapes.
    if (dStartX < dStartZ) {
      push(startLineX, sz);
      push(startLineX, endLineZ);
      push(endLineX, endLineZ);
    } else {
      push(sx, startLineZ);
      push(endLineX, startLineZ);
      push(endLineX, endLineZ);
    }
    this.path.push(new THREE.Vector3(tx, 0, tz));
    // Drop redundant waypoints.
    this.path = this.path.filter((p, i, arr) => i === 0 || p.distanceTo(arr[i - 1]) > 3);
  }

  currentWaypoint() { return this.path[this.pathIndex] || null; }

  // -------------------------------------------------------------------------
  update(dt, playerPos, lod) {
    this.lodLevel = lod;
    if (this.controlled === 'freeze') {
      this.targetSpeed = 0;
      this.speed = 0;
      this.human.animator.setState(STATES.IDLE);
      this.human.update(dt, { speed: 0, turnRate: 0, grounded: true, verticalVel: 0 });
      return;
    }

    this.activityTimer -= dt;
    if (this.reactCooldown > 0) this.reactCooldown -= dt;
    if (this.talkTimer > 0) this.talkTimer -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.infectCooldown > 0) this.infectCooldown -= dt;

    // Knocked down: lie there, then get up — or, in an outbreak, get up wrong.
    if (this.downed > 0) {
      this.downed -= dt;
      if (this.reanimate > 0) {
        this.reanimate -= dt;
        if (this.reanimate <= 0) {
          const apo = this.manager.apocalypse;
          this.downed = 0;
          this.reanimate = 0;
          if (apo) apo.infect(this);
          if (this.manager.gore) this.manager.gore.pool(this.position.x, this.position.z, 1.1);
          this.human.animator.setState(STATES.GETUP);
          this.human.update(dt, { speed: 0, turnRate: 0, grounded: true, verticalVel: 0 });
          return;
        }
        // Twitching, while whatever is in them decides.
        this.human.animator.setState(STATES.LIE);
      } else {
        this.human.animator.setState(this.downed > 0.9 ? STATES.LIE : STATES.GETUP);
      }
      this.targetSpeed = 0;
      this.speed = 0;
      this.human.update(dt, { speed: 0, turnRate: 0, grounded: true, verticalVel: 0 });
      this.root.position.copy(this.position);
      return;
    }
    // Patient zero, mid-turn. The apocalypse drives the pose; stand still.
    if (this.turning > 0) {
      this.targetSpeed = 0;
      this.speed = 0;
      this.path.length = 0;
      this.human.update(dt, { speed: 0, turnRate: 0, grounded: true, verticalVel: 0 });
      this.root.position.copy(this.position);
      return;
    }
    // Being lifted into a ship — the saucer drives the position.
    if (this.abducting) {
      this.human.update(dt, { speed: 0, turnRate: 0, grounded: false, verticalVel: 1 });
      return;
    }

    if (this.infected || this.hostile || this.panicking) {
      this.updateApocalypse(dt, playerPos);
      this.human.applyLod(playerPos ? this.position.distanceTo(playerPos) : 100);
      this.human.update(dt, { speed: this.speed, turnRate: this._turnRate || 0, grounded: true, verticalVel: 0 });
      return;
    }

    // Mind-controlled and smitten people both trail you; only the flavour
    // differs, and love keeps glancing over.
    if ((this.controlled === 'follow' || this.controlled === 'mind' || this.controlled === 'love') && playerPos) {
      if (this.controlled === 'love') {
        this.lookTarget = playerPos;
        this.loveTimer = (this.loveTimer || 0) - dt;
        if (this.loveTimer <= 0 && this.position.distanceTo(playerPos) < 4) {
          this.loveTimer = 5 + this.rng() * 7;
          this.human.animator.setState(STATES.WAVE);
        }
      }
      const d = this.position.distanceTo(playerPos);
      if (d > 3.5) {
        this.destination = { x: playerPos.x, z: playerPos.z };
        if (!this.path.length || this.pathIndex >= this.path.length ||
            this.path[this.path.length - 1].distanceTo(playerPos) > 6) {
          this.path = [playerPos.clone()];
          this.pathIndex = 0;
        }
        this.targetSpeed = d > 9 ? this.runSpeed : this.walkSpeed * 1.2;
      } else {
        this.targetSpeed = 0;
        this.path.length = 0;
      }
    } else if (this.controlled === 'dance') {
      this.targetSpeed = 0;
      this.human.animator.setState(STATES.DANCE);
      this.human.update(dt, { speed: 0, turnRate: 0, grounded: true, verticalVel: 0 });
      return;
    } else if (this.activityTimer <= 0 || (!this.path.length && !this.talkPartner)) {
      this.pickSchedule();
    }

    this.moveAlongPath(dt);
    this.updateReactions(dt, playerPos);
    this.updateAnimationState(dt);

    // Weather reactions: hunch and hurry when it rains.
    const atmo = this.manager.atmosphere;
    if (atmo) {
      const rain = atmo.current.rain;
      if (rain > 0.35 && this.controlled !== 'follow') this.targetSpeed = Math.max(this.targetSpeed, this.walkSpeed * lerpv(1, 1.9, rain));
    }

    // Integrate.
    this.speed = damp(this.speed, this.targetSpeed, 0.0015, dt);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.position.x += fx * this.speed * dt;
    this.position.z += fz * this.speed * dt;
    this.position.y = this.world.groundAt(this.position.x, this.position.z);
    this.world.resolveCollision(this.position, 0.35);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.heading;

    this.human.applyLod(playerPos ? this.position.distanceTo(playerPos) : 100);
    this.human.update(dt, {
      speed: this.speed,
      turnRate: this._turnRate || 0,
      grounded: true,
      verticalVel: 0,
    });
  }

  // -------------------------------------------------------------------------
  // The end of the world
  // -------------------------------------------------------------------------

  /** Steer straight at a point, no pathfinding — nobody is being careful now. */
  chargeAt(dt, tx, tz, speed) {
    const dx = tx - this.position.x, dz = tz - this.position.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const prev = this.heading;
    this.heading = dampAngle(this.heading, want, 0.0002, dt);
    this._turnRate = wrapAngle(this.heading - prev) / Math.max(dt, 0.001);
    this.targetSpeed = dist < 1.1 ? 0 : speed;
    return dist;
  }

  /**
   * The nearest person worth going after.
   * mode 'uninfected' — for the infected, anyone not yet turned.
   * mode 'anyone'     — for a riot, where everyone is hostile and the whole
   *                     point is that they still go for each other.
   */
  findPrey(radius, mode) {
    let best = null, bestD = radius;
    for (const other of this.manager.npcs) {
      if (other === this || other.indoors || other.abducting || other.downed > 0) continue;
      if (mode === 'uninfected' && other.infected) continue;
      const d = this.position.distanceTo(other.position);
      if (d < bestD) { bestD = d; best = other; }
    }
    return best;
  }

  updateApocalypse(dt, playerPos) {
    const apo = this.manager.apocalypse;
    this.path.length = 0;

    if (this.infected) {
      // Mid-meal: crouched over the body, and it bleeds while you do.
      if (this.feeding > 0) {
        const meal = this.beingEaten;
        this.feeding -= dt;
        this.targetSpeed = 0;
        this.speed = 0;
        this.human.animator.setState(STATES.CROUCH);
        if (meal) {
          meal.downed = Math.max(meal.downed, this.feeding + 0.5);
          this.feedTick = (this.feedTick || 0) - dt;
          if (this.feedTick <= 0) {
            this.feedTick = 0.45;
            const gore = this.manager.gore;
            if (gore) {
              gore.spray(meal.position.x, meal.position.y + 0.35, meal.position.z, 9, 0, 0, 0.7);
              if (this.rng() < 0.5) gore.gib(meal.position.x, meal.position.y + 0.3, meal.position.z, 0.32, 0, 0);
            }
          }
        }
        if (this.feeding <= 0) {
          if (meal) {
            // What's left of them gets up in a minute or so.
            meal.beingEatenBy = null;
            meal.reanimate = 4 + this.rng() * 6;
            meal.downed = Math.max(meal.downed, meal.reanimate + 0.5);
            const gore = this.manager.gore;
            if (gore) gore.gib(meal.position.x, meal.position.y + 0.4, meal.position.z, 0.75, 0, 0);
          }
          this.beingEaten = null;
        }
        return;
      }

      // Shamble toward the nearest uninfected person, or the player.
      let tx = null, tz = null, victim = null;
      const prey = this.findPrey(42, 'uninfected');
      // One of their own is not a meal.
      const playerIsOne = this.manager.playerIsZombie;
      const dPlayer = (playerPos && !playerIsOne) ? this.position.distanceTo(playerPos) : 1e9;
      const dPrey = prey ? this.position.distanceTo(prey.position) : 1e9;
      if (dPlayer < dPrey && dPlayer < 42) { tx = playerPos.x; tz = playerPos.z; }
      else if (prey) { tx = prey.position.x; tz = prey.position.z; victim = prey; }

      if (tx == null) {
        this.targetSpeed = this.walkSpeed * 0.35;
        this.heading += dt * 0.3;
        this.human.animator.setState(STATES.WALK);
      } else {
        // Locked on: a steady pursuit that closes the gap, and a lunge inside
        // eight metres. A pursuer that is always slower than a runner never
        // catches anybody in an open city, so the outbreak would never spread
        // past the people it started with. It only shambles with no target.
        const near = Math.min(dPlayer, dPrey);
        const pace = near < 8 ? this.walkSpeed * 2.9 : this.walkSpeed * 1.7;
        const dist = this.chargeAt(dt, tx, tz, pace);
        if (dist < 1.9 && this.infectCooldown <= 0) {
          this.infectCooldown = 2.5;
          if (victim && apo) {
            const gore = this.manager.gore;
            if (gore) {
              const dx = victim.position.x - this.position.x, dz = victim.position.z - this.position.z;
              const len = Math.hypot(dx, dz) || 1;
              gore.hit(victim.position.x, victim.position.y, victim.position.z, 1, dx / len, dz / len);
              gore.pool(victim.position.x, victim.position.z, 1.5);
            }
            // They don't just get tagged — they get pulled down and eaten,
            // and what's left of them gets up afterwards.
            victim.downed = 6 + this.rng() * 3;
            victim.beingEatenBy = this;
            victim.controlled = 'apocalypse';
            this.beingEaten = victim;
            this.feeding = 4 + this.rng() * 3;
            this.feedTick = 0;
          }
          else if (this.manager.onPlayerAttacked) this.manager.onPlayerAttacked(this, 'infect');
        }
        this.human.animator.setState(this.speed > this.walkSpeed * 1.1 ? STATES.RUN : STATES.WALK);
      }
    } else if (this.hostile) {
      // Pick a fight with whoever is closest and keep swinging.
      if (!this.combatTarget || this.combatTarget.downed > 0 || this.combatTarget.indoors ||
          this.position.distanceTo(this.combatTarget.position) > 55) {
        this.combatTarget = this.findPrey(50, 'anyone');
      }
      const dPlayer = playerPos ? this.position.distanceTo(playerPos) : 1e9;
      const goForPlayer = dPlayer < 14 && (!this.combatTarget || dPlayer < this.position.distanceTo(this.combatTarget.position));
      const tx = goForPlayer ? playerPos.x : (this.combatTarget ? this.combatTarget.position.x : null);
      const tz = goForPlayer ? playerPos.z : (this.combatTarget ? this.combatTarget.position.z : null);

      if (tx == null) {
        this.targetSpeed = this.runSpeed * 0.6;
        this.heading += dt * 0.6;
        this.human.animator.setState(STATES.RUN);
      } else {
        const dist = this.chargeAt(dt, tx, tz, this.runSpeed);
        if (dist < 1.9 && this.attackCooldown <= 0) {
          this.attackCooldown = 1.1 + this.rng() * 0.8;
          this.human.animator.setState(STATES.POINT);   // a swing, telegraphed
          if (goForPlayer) { if (this.manager.onPlayerAttacked) this.manager.onPlayerAttacked(this, 'hit'); }
          else if (this.combatTarget) {
            const t = this.combatTarget;
            t.downed = 4 + this.rng() * 6;
            t.combatTarget = null;
            const gore = this.manager.gore;
            if (gore) {
              const dx = t.position.x - this.position.x, dz = t.position.z - this.position.z;
              const len = Math.hypot(dx, dz) || 1;
              gore.hit(t.position.x, t.position.y, t.position.z, 0.75, dx / len, dz / len);
              gore.pool(t.position.x, t.position.z, 1.1);
            }
            if (apo) apo.casualties++;
            this.combatTarget = null;
          }
        } else if (this.attackCooldown > 0.7) {
          this.human.animator.setState(STATES.POINT);
        } else {
          this.human.animator.setState(this.speed > this.walkSpeed * 1.4 ? STATES.RUN : STATES.WALK);
        }
      }
    } else {
      // Panic: run away from the nearest threat, or just away.
      let threat = null, bestD = 60;
      if (this.manager.playerIsZombie && playerPos) {
        const d = this.position.distanceTo(playerPos);
        if (d < bestD) { bestD = d; threat = { position: playerPos }; }
      }
      for (const other of this.manager.npcs) {
        if (!other.infected && !other.hostile) continue;
        const d = this.position.distanceTo(other.position);
        if (d < bestD) { bestD = d; threat = other; }
      }
      if (apo && apo.saucers.length) {
        for (const s of apo.saucers) {
          const d = Math.hypot(s.mesh.position.x - this.position.x, s.mesh.position.z - this.position.z);
          if (d < bestD) { bestD = d; threat = { position: s.mesh.position }; }
        }
      }
      // You cannot sprint forever. Stamina drains while something is chasing
      // you and comes back when it isn't, so a crowd eventually gets caught.
      if (this.stamina == null) this.stamina = 1;
      this.stamina = clamp01(this.stamina + (threat ? -dt / 18 : dt / 14));
      const flee = this.runSpeed * lerpv(0.55, 1, this.stamina);

      if (threat) {
        this.chargeAt(dt, this.position.x * 2 - threat.position.x, this.position.z * 2 - threat.position.z, flee);
      } else {
        this.panicTimer = (this.panicTimer || 0) - dt;
        if (this.panicTimer <= 0) { this.panicTimer = 1.5 + this.rng() * 3; this.panicHeading = this.rng() * TAU; }
        const h = this.panicHeading || 0;
        this.chargeAt(dt, this.position.x + Math.sin(h) * 20, this.position.z + Math.cos(h) * 20, flee * 0.9);
      }
      this.human.animator.setState(this.speed > this.walkSpeed * 1.3 ? STATES.RUN : STATES.WALK);
    }

    this.speed = damp(this.speed, this.targetSpeed, 0.0012, dt);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.position.x += fx * this.speed * dt;
    this.position.z += fz * this.speed * dt;
    this.position.y = this.world.groundAt(this.position.x, this.position.z);
    this.world.resolveCollision(this.position, 0.35);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.heading;
  }

  moveAlongPath(dt) {
    if (this.talkPartner && this.talkTimer > 0) { this.targetSpeed = 0; return; }
    const wp = this.currentWaypoint();
    if (!wp) { this.targetSpeed = 0; return; }
    const dx = wp.x - this.position.x, dz = wp.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.4) {
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.path.length = 0;
        this.onArrive();
      }
      return;
    }
    const want = Math.atan2(dx, dz);
    const prev = this.heading;
    this.heading = dampAngle(this.heading, want, 0.0004, dt);
    this._turnRate = wrapAngle(this.heading - prev) / Math.max(dt, 0.001);

    // Slow down for tight turns; speed up on long straights.
    const turnPenalty = clamp01(1 - Math.abs(wrapAngle(want - this.heading)) * 0.8);
    const base = this.activity === 'commute' ? this.walkSpeed * 1.2 : this.walkSpeed;
    this.targetSpeed = base * lerpv(0.45, 1, turnPenalty);

    // Wait at kerbs for a gap in traffic.
    if (this.world.city.isOnRoad(this.position.x, this.position.z, -0.5)) {
      this.targetSpeed *= 1.35;   // cross briskly
    }
  }

  onArrive() {
    const r = this.rng;
    switch (this.activity) {
      case 'work': this.setState(STATES.IDLE); this.activityTimer = r.range(40, 160); break;
      case 'relax': case 'socialise': {
        const bench = this.findNearbyInteractable('bench', 8) || this.findNearbyInteractable('table', 8);
        if (bench) {
          this.position.x = bench.x; this.position.z = bench.z;
          this.setState(STATES.SIT);
        } else this.setState(STATES.IDLE);
        this.activityTimer = r.range(30, 120);
        break;
      }
      case 'exercise': this.setState(STATES.EXERCISE); this.activityTimer = r.range(25, 70); break;
      case 'eat': this.setState(STATES.EAT); this.activityTimer = r.range(25, 80); break;
      case 'home': case 'shop': {
        // Step inside — the NPC disappears for a while, then comes back out.
        const door = this.findNearbyInteractable('door', 9);
        if (door && r.chance(0.55)) { this.enterBuilding(door); return; }
        this.setState(STATES.IDLE);
        this.activityTimer = r.range(15, 50);
        break;
      }
      default: this.setState(STATES.IDLE); this.activityTimer = r.range(6, 25);
    }
  }

  enterBuilding(door) {
    this.indoors = true;
    this.root.visible = false;
    this.position.x = door.x; this.position.z = door.z;
    this.activityTimer = this.rng.range(25, 140);
    this.activity = 'work';
    this.path.length = 0;
    this._reappearAt = { x: door.x, z: door.z };
  }

  exitBuilding() {
    this.indoors = false;
    this.root.visible = true;
    if (this._reappearAt) {
      const sw = this.world.city.nearestSidewalk(this._reappearAt.x, this._reappearAt.z);
      this.position.set(sw.x, this.world.groundAt(sw.x, sw.z), sw.z);
    }
    this.pickSchedule();
  }

  findNearbyInteractable(type, radius) {
    for (const it of this.world.interactHash.get(Math.floor(this.position.x / 20) + ':' + Math.floor(this.position.z / 20)) || []) {
      if (it.type === type && Math.hypot(it.x - this.position.x, it.z - this.position.z) < radius) return it;
    }
    return null;
  }

  setState(s) {
    this.state = s;
    this.human.animator.setState(s);
  }

  updateAnimationState(dt) {
    if (this.indoors) return;
    const a = this.human.animator;
    if (this.state === STATES.SIT || this.state === STATES.EXERCISE || this.state === STATES.EAT) {
      if (this.speed > 0.4) { this.setState(STATES.WALK); }
      else { a.setState(this.state); return; }
    }
    if (this.talkPartner && this.talkTimer > 0) { a.setState(STATES.TALK); a.setTalking(this.speaking, 1); return; }
    if (this.phoneTimer > 0) this.phoneTimer -= dt;
    else if (this.rng.chance(0.002) && this.speed < 0.3) {
      a.setState(STATES.PHONE, { toEar: this.rng.chance(0.4) });
      this.phoneTimer = this.rng.range(30, 200);
      this.activityTimer = Math.min(this.activityTimer, this.rng.range(8, 24));
      return;
    }
    if (this.speed > this.walkSpeed * 1.7) a.setState(STATES.RUN);
    else if (this.speed > 0.35) a.setState(STATES.WALK);
    else if (a.state === STATES.WALK || a.state === STATES.RUN) a.setState(STATES.IDLE);
  }

  updateReactions(dt, playerPos) {
    if (!playerPos || this.lodLevel > 1) { this.human.animator.setLookTarget(null, 0); return; }
    const d = this.position.distanceTo(playerPos);

    // Look at the player when they're close and roughly in front.
    if (d < 14) {
      const dx = playerPos.x - this.position.x, dz = playerPos.z - this.position.z;
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      const dot = (dx * fx + dz * fz) / Math.max(d, 0.01);
      const interest = clamp01(this.appearance.curiosity * 1.2) * clamp01(1 - d / 14);
      if (dot > -0.35 && interest > 0.12) {
        const head = new THREE.Vector3(playerPos.x, playerPos.y + 1.5, playerPos.z);
        this.human.animator.setLookTarget(head, clamp01(interest * 1.6));
      } else {
        this.human.animator.setLookTarget(null, 0);
      }
    } else {
      this.human.animator.setLookTarget(null, 0);
    }

    // Greet.
    if (d < 4.2 && this.reactCooldown <= 0 && this.appearance.social > 0.4 && !this.talkPartner) {
      this.reactCooldown = this.rng.range(25, 90);
      if (this.rng.chance(this.appearance.social)) this.say(this.pickLine(), 1.8);
    }

    // NPC-to-NPC conversation.
    if (!this.talkPartner && this.talkTimer <= 0 && this.rng.chance(dt * 0.12) && this.speed < 0.6) {
      const other = this.manager.nearestNPC(this.position, 3.2, this);
      if (other && !other.talkPartner && other.speed < 0.6) {
        this.startConversation(other);
      }
    }
    if (this.talkPartner) {
      if (this.talkTimer <= 0 || this.talkPartner.talkTimer <= 0) {
        this.talkPartner.talkPartner = null;
        this.talkPartner = null;
        this.speaking = false;
      } else {
        const t = this.talkPartner;
        const dx = t.position.x - this.position.x, dz = t.position.z - this.position.z;
        this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 0.002, dt);
        this.human.animator.setLookTarget(new THREE.Vector3(t.position.x, t.position.y + 1.5, t.position.z), 1);
        this.human.animator.setTalking(this.speaking, 1);
      }
    }
  }

  startConversation(other) {
    const dur = this.rng.range(6, 22);
    this.talkPartner = other; other.talkPartner = this;
    this.talkTimer = dur; other.talkTimer = dur;
    this.speaking = true; other.speaking = false;
    this.path.length = 0; other.path.length = 0;
    // Alternate who's talking.
    const swap = () => {
      if (!this.talkPartner) return;
      this.speaking = !this.speaking;
      other.speaking = !this.speaking;
      this._swapTimer = setTimeout(swap, 1400 + Math.random() * 2600);
    };
    this._swapTimer = setTimeout(swap, 1800 + Math.random() * 2200);
  }

  pickLine() {
    const atmo = this.manager.atmosphere;
    const r = this.rng;
    if (atmo && atmo.current.rain > 0.4 && r.chance(0.5)) return r.pick(RAIN_LINES);
    if (atmo && atmo.nightFactor > 0.6 && r.chance(0.5)) return r.pick(NIGHT_LINES);
    if (r.chance(0.55)) return r.pick(GREETINGS);
    return r.pick(SMALLTALK);
  }

  say(text, duration) {
    this.lastLine = text;
    this.human.animator.setTalking(true, 1);
    this.speakTimer = duration || 2;
    setTimeout(() => { if (this.human && this.human.animator) this.human.animator.setTalking(false); }, (duration || 2) * 1000);
    if (this.manager.onSpeak) this.manager.onSpeak(this, text);
  }

  describe() { return describeAppearance(this.appearance); }

  dispose() {
    if (this._swapTimer) clearTimeout(this._swapTimer);
    if (this.talkPartner) { this.talkPartner.talkPartner = null; this.talkPartner = null; }
    this.human.dispose();
  }
}

// ---------------------------------------------------------------------------

export class NPCManager {
  constructor(world, scene, atmosphere) {
    this.world = world;
    this.scene = scene;
    this.atmosphere = atmosphere;
    this.npcs = [];
    this.rng = makeRng(world.seed ^ 0x9a3c);
    this.spawnTimer = 0;
    this.listener = null;
    this.enabled = true;
    this.densityScale = 1;
    this.buildBudgetPerFrame = 2;
    this.spawnCounter = 0;
  }

  get budget() { return Math.round(settings.preset.npcBudget * this.densityScale * perf.load); }

  spawnNear(px, pz, minDist, maxDist, opts) {
    opts = opts || {};
    const r = this.rng;
    let x, z;
    if (opts.x != null) { x = opts.x; z = opts.z; }
    else {
      const a = r() * TAU;
      const d = lerpv(minDist, maxDist, Math.sqrt(r()));
      x = px + Math.cos(a) * d;
      z = pz + Math.sin(a) * d;
      const sw = this.world.city.nearestSidewalk(x, z);
      x = sw.x; z = sw.z;
    }
    if (Math.abs(x) > 1150 || Math.abs(z) > 1150) return null;
    if (this.world.isWater(x, z)) return null;
    const appearance = opts.appearance || generateAppearance({ seed: (r() * 0xffffffff) >>> 0 });
    const npc = new NPC(this, appearance, x, z);
    this.scene.add(npc.root);
    this.npcs.push(npc);
    this.spawnCounter++;
    return npc;
  }

  despawnFar(px, pz, maxDist) {
    // Anyone who leaves keeps existing — they just stop having a body.
    if (!this.background) this.background = [];
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      if (n.protected || n.controlled === 'follow') continue;
      if (Math.hypot(n.position.x - px, n.position.z - pz) > maxDist) {
        this.background.push({
          x: n.position.x, z: n.position.z, tx: n.position.x, tz: n.position.z,
          speed: n.walkSpeed, retarget: 0,
        });
        n.dispose();
        this.npcs.splice(i, 1);
      }
    }
  }

  /**
   * People the city has but the renderer doesn't: a position, a destination and
   * a speed, ticked a couple of times a second with no mesh, no skeleton and no
   * animation. They're what makes the population larger than the crowd you can
   * see, and they materialise into real NPCs when you get near one.
   */
  updateBackground(dt, playerPos) {
    const preset = settings.preset;
    const want = Math.round((preset.backgroundNpcs || 0) * this.densityScale * perf.load);
    if (!this.background) this.background = [];
    const bg = this.background;

    // Top up and trim. These cost a few numbers each.
    const ring = (preset.streamDistance || 620) * 0.9;
    while (bg.length < want) {
      const a = this.rng() * TAU;
      const r = 120 + this.rng() * ring;
      const x = playerPos.x + Math.cos(a) * r;
      const z = playerPos.z + Math.sin(a) * r;
      bg.push({ x, z, tx: x, tz: z, speed: 1.1 + this.rng() * 0.8, retarget: 0 });
    }
    if (bg.length > want) bg.length = want;

    // Two ticks a second is plenty for someone you cannot see.
    this._bgAccum = (this._bgAccum || 0) + dt;
    if (this._bgAccum < 0.5) return;
    const step = this._bgAccum;
    this._bgAccum = 0;

    for (let i = bg.length - 1; i >= 0; i--) {
      const b = bg[i];
      b.retarget -= step;
      if (b.retarget <= 0) {
        b.retarget = 12 + this.rng() * 40;
        const a = this.rng() * TAU;
        const r = 40 + this.rng() * 180;
        b.tx = b.x + Math.cos(a) * r;
        b.tz = b.z + Math.sin(a) * r;
      }
      const dx = b.tx - b.x, dz = b.tz - b.z;
      const d = Math.hypot(dx, dz) || 1;
      const move = Math.min(d, b.speed * step);
      b.x += (dx / d) * move;
      b.z += (dz / d) * move;

      const pd = Math.hypot(b.x - playerPos.x, b.z - playerPos.z);
      // Walked into view: give them a body, if there's room.
      if (pd < 70 && this.npcs.length < this.budget) {
        if (this.spawnNear(0, 0, 0, 0, { x: b.x, z: b.z })) { bg.splice(i, 1); continue; }
      }
      // Wandered off the edge of the world: recycle them to the far side.
      if (pd > ring * 1.3) {
        const a = this.rng() * TAU;
        const r = 140 + this.rng() * ring * 0.6;
        b.x = playerPos.x + Math.cos(a) * r;
        b.z = playerPos.z + Math.sin(a) * r;
        b.retarget = 0;
      }
    }
  }

  /** Count of everyone the city is tracking, bodies and background together. */
  population() { return this.npcs.length + (this.background ? this.background.length : 0); }

  update(dt, playerPos) {
    if (!this.enabled) return;
    this.listener = playerPos;
    const drawD = settings.preset.drawDistance;
    const keep = Math.min(drawD * 0.6, 220) * lerpv(0.6, 1, perf.load);
    this.despawnFar(playerPos.x, playerPos.z, keep + 60);

    // When the governor cuts the budget, shed the people furthest away rather
    // than waiting for them to wander out of range — a couple at a time, so
    // nobody vanishes out of the corner of your eye in a crowd.
    if (this.npcs.length > this.budget) {
      let over = Math.min(2, this.npcs.length - this.budget);
      while (over-- > 0) {
        let worst = null, worstD = -1;
        for (const n of this.npcs) {
          if (n.controlled || n.infected || n.hostile) continue;
          const d = n.position.distanceTo(playerPos);
          if (d > worstD) { worstD = d; worst = n; }
        }
        if (!worst || worstD < 55) break;
        this.remove(worst);
      }
    }

    // Spawn a couple per frame at most so building never spikes the frame time.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.npcs.length < this.budget) {
      this.spawnTimer = 0.10;
      let made = 0;
      while (made < this.buildBudgetPerFrame && this.npcs.length < this.budget) {
        if (this.spawnNear(playerPos.x, playerPos.z, 22, keep)) made++;
        else break;
      }
    }

    this.updateBackground(dt, playerPos);

    // Update with distance-based rate limiting. Three tiers, matching what you
    // can actually make out: full AI and animation close up, simplified in the
    // middle, and out past the simulation radius just enough to keep walking.
    const near = settings.preset.npcDetailDistance;
    const simD = settings.preset.npcSimDistance || near * 5;
    for (const n of this.npcs) {
      if (n.indoors) {
        n.activityTimer -= dt;
        if (n.activityTimer <= 0) n.exitBuilding();
        continue;
      }
      const d = n.position.distanceTo(playerPos);
      let lod = 0;
      if (d > simD) lod = 3;
      else if (d > near * 2.4) lod = 2;
      else if (d > near) lod = 1;
      if (lod === 0) {
        n.update(dt, playerPos, 0);
      } else {
        // Coarser update tick for distant people; they still walk and arrive.
        n.updateAccumulator += dt;
        const interval = lod === 1 ? 1 / 20 : lod === 2 ? 1 / 8 : 1 / 3;
        if (n.updateAccumulator >= interval) {
          n.update(n.updateAccumulator, playerPos, lod);
          n.updateAccumulator = 0;
        }
      }
    }
  }

  nearestNPC(pos, maxDist, exclude) {
    let best = null, bd = maxDist;
    for (const n of this.npcs) {
      if (n === exclude || n.indoors) continue;
      const d = n.position.distanceTo(pos);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  /** Everyone within a radius — used by T10 crowd commands. */
  within(pos, radius) {
    return this.npcs.filter((n) => !n.indoors && n.position.distanceTo(pos) <= radius);
  }

  forEachNear(pos, radius, fn) {
    let count = 0;
    for (const n of this.within(pos, radius)) { fn(n); count++; }
    return count;
  }

  remove(npc) {
    const i = this.npcs.indexOf(npc);
    if (i >= 0) this.npcs.splice(i, 1);
    npc.dispose();
  }

  clear() {
    while (this.npcs.length) this.remove(this.npcs[0]);
  }

  count() { return this.npcs.length; }
}
