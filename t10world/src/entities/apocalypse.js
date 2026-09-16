// T10 World - the end of the world, in six flavours.
// Each kind rewrites the sky, changes what every person in the city is doing,
// and adds its own thing in the air or on the ground. Nothing here is a cutscene:
// the crowd simulation keeps running, it just runs on different rules.
import * as THREE from '../../vendor/three.module.js';
import { clamp01, clampv, lerpv, makeRng, TAU } from '../core/math.js';
import { STATES } from '../human/animator.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';

export const APOCALYPSES = {
  zombie: {
    name: 'Zombie outbreak',
    blurb: 'A virus. It spreads by touch, and it does not stop.',
    sky: { weather: 'overcast', hour: null },
    crowd: 'infect',
  },
  riot: {
    name: 'The Purge',
    blurb: 'Everyone turns on everyone. No law, no help, no reason.',
    sky: { weather: 'storm', hour: 21 },
    crowd: 'hostile',
  },
  alien: {
    name: 'Alien invasion',
    blurb: 'Ships over the city, taking people up one at a time.',
    sky: { weather: 'fog', hour: 20 },
    crowd: 'panic',
  },
  meteor: {
    name: 'Meteor strike',
    blurb: 'The sky is falling. Literally — look up.',
    sky: { weather: 'storm', hour: 17 },
    crowd: 'panic',
  },
  blackout: {
    name: 'Total blackout',
    blurb: 'Every light in the city is out, and something is wrong with the dark.',
    sky: { weather: 'fog', hour: 1 },
    crowd: 'panic',
  },
  machine: {
    name: 'Machine uprising',
    blurb: 'The cars decided they were done being driven.',
    sky: { weather: 'overcast', hour: 19 },
    crowd: 'panic',
  },
};

export const APOCALYPSE_KEYS = Object.keys(APOCALYPSES);

// A strong green multiply: the skin map is already dark, so the tint has to
// push the green channel well above red and blue to read across a street.
const INFECTED_SKIN = 0x8fe070;
const INFECTED_EYES = 0xd4ff5a;

export class Apocalypse {
  constructor(game) {
    this.game = game;
    this.kind = null;
    this.elapsed = 0;
    this.rng = makeRng(0x51f0d3);
    this.saucers = [];
    this.meteors = [];
    this.group = new THREE.Group();
    this.group.name = 'apocalypse';
    game.scene.add(this.group);
    this.saved = null;
    this.spawnTimer = 0;
  }

  get active() { return this.kind != null; }
  get info() { return this.kind ? APOCALYPSES[this.kind] : null; }

  /** @returns the human-readable name, or null if the kind is unknown. */
  start(kind) {
    const def = APOCALYPSES[kind];
    if (!def) return null;
    if (this.kind) this.stop(true);
    const g = this.game;

    this.saved = {
      weather: g.atmosphere.weatherKey || null,
      hour: g.atmosphere.timeOfDay,
      streetLights: g.t10 ? g.t10.forceStreetLights : null,
    };

    this.kind = kind;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.abducted = 0;
    this.casualties = 0;

    g.atmosphere.setWeather(def.sky.weather, true);
    if (def.sky.hour != null) g.atmosphere.timeOfDay = def.sky.hour;

    if (kind === 'blackout') {
      if (g.t10) g.t10.forceStreetLights = 0;
      for (const v of g.traffic.vehicles) { v.autoHeadlights = false; v.headlightsOn = false; }
    }
    if (kind === 'zombie') this.beginOutbreak();
    if (kind === 'riot') this.makeHostile();
    if (kind === 'machine') this.freeTheCars();

    audio.t10Blip('error');
    return def.name;
  }

  stop(quiet) {
    if (!this.kind) return false;
    const g = this.game;
    for (const npc of g.npcs.npcs) this.clearNpc(npc);
    for (const s of this.saucers) this.group.remove(s.mesh);
    this.saucers.length = 0;
    for (const m of this.meteors) this.group.remove(m.mesh);
    this.meteors.length = 0;
    for (const v of g.traffic.vehicles) {
      v.autoHeadlights = true;
      if (v.ai) { v.ai.berserk = false; if (v.ai.restoreSpeed != null) { v.ai.targetSpeed = v.ai.restoreSpeed; v.ai.restoreSpeed = null; } }
    }
    if (this.saved) {
      if (g.t10) g.t10.forceStreetLights = this.saved.streetLights;
      if (!quiet) g.atmosphere.setWeather('fair');
    }
    this.kind = null;
    this.saved = null;
    return true;
  }

  /** Put one person back to normal. */
  clearNpc(npc) {
    if (npc.infected || npc.hostile || npc.panicking) npc.human.setSkinTint(null, null);
    npc.infected = false;
    npc.hostile = false;
    npc.turning = 0;
    npc.feeding = 0;
    npc.beingEaten = null;
    npc.beingEatenBy = null;
    npc.reanimate = 0;
    npc.panicking = false;
    npc.downed = 0;
    npc.combatTarget = null;
    npc.abducting = null;
    if (npc.controlled === 'apocalypse') npc.controlled = null;
  }

  // -------------------------------------------------------------------------
  // Seeding
  // -------------------------------------------------------------------------
  /**
   * The outbreak opens on one person. They stop, double over where you can see
   * them, and come up wrong — and only then does it start spreading.
   */
  beginOutbreak() {
    const g = this.game;
    const p = g.player.position;
    let best = null, bestD = 1e9;
    for (const npc of g.npcs.npcs) {
      if (npc.indoors) continue;
      const d = npc.position.distanceTo(p);
      // Close enough to watch, far enough not to be on top of you.
      if (d < 6 || d > 40) continue;
      if (d < bestD) { bestD = d; best = npc; }
    }
    if (!best) { this.seedInfection(1); return null; }
    this.patientZero = best;
    best.controlled = 'apocalypse';
    best.panicking = false;
    best.turning = 3.2;
    best.human.animator.setState(STATES.IDLE);
    g.t10Say('Don\'t move. Watch ' + best.appearance.firstName + '.');
    return best;
  }

  seedInfection(n) {
    const pool = this.game.npcs.npcs.filter((x) => !x.infected && !x.indoors);
    for (let i = 0; i < n && pool.length; i++) {
      const npc = pool.splice(Math.floor(this.rng() * pool.length), 1)[0];
      this.infect(npc);
    }
    return n;
  }

  infect(npc) {
    if (!npc || npc.infected) return false;
    npc.infected = true;
    npc.hostile = false;
    npc.panicking = false;
    npc.controlled = 'apocalypse';
    npc.infectCooldown = 1.2;
    npc.human.setSkinTint(INFECTED_SKIN, INFECTED_EYES);
    npc.human.animator.setState(STATES.IDLE);
    return true;
  }

  makeHostile(only) {
    let n = 0;
    for (const npc of this.game.npcs.npcs) {
      if (only && npc !== only) continue;
      if (npc.infected) continue;
      npc.hostile = true;
      npc.panicking = false;
      npc.controlled = 'apocalypse';
      npc.human.setSkinTint(0xff9a8c, 0xff5a3c);
      n++;
    }
    return n;
  }

  panic(npc) {
    if (npc.infected || npc.hostile) return;
    npc.panicking = true;
    npc.controlled = 'apocalypse';
  }

  freeTheCars() {
    for (const v of this.game.traffic.vehicles) {
      if (!v.ai || v.isPlayerVehicle) continue;
      if (v.ai.restoreSpeed == null) v.ai.restoreSpeed = v.ai.targetSpeed;
      v.ai.targetSpeed *= 2.1;
      v.ai.berserk = true;
      v.autoHeadlights = false;
      v.headlightsOn = true;
      v.honk && v.honk();
    }
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------
  update(dt, playerPos) {
    if (!this.kind) return;
    this.elapsed += dt;
    const g = this.game;

    // The outbreak waits for its first victim before it goes anywhere.
    if (this.patientZero) {
      const z = this.patientZero;
      if (z.turning > 0) {
        z.turning -= dt;
        // Doubling over, then still, then up.
        z.human.animator.setState(z.turning > 2.1 ? STATES.THINK : z.turning > 0.8 ? STATES.CROUCH : STATES.GETUP);
        z.targetSpeed = 0; z.speed = 0;
        return;
      }
      this.patientZero = null;
      this.infect(z);
      if (this.game.gore) this.game.gore.pool(z.position.x, z.position.z, 1.2);
      g.t10Say(z.appearance.firstName + ' is gone. It spreads by touch — don\'t let them reach you.');
      audio.t10Blip('error');
    }

    // Anyone who streams in after it starts joins whatever is happening.
    for (const npc of g.npcs.npcs) {
      if (npc.controlled === 'apocalypse' || npc.infected || npc.hostile || npc.panicking) continue;
      if (npc.controlled === 'love' || npc.controlled === 'mind') continue;
      const crowd = this.info.crowd;
      if (crowd === 'hostile') this.makeHostile(npc);
      else if (crowd === 'panic') this.panic(npc);
      else if (crowd === 'infect' && this.rng() < 0.12) this.infect(npc);
      else this.panic(npc);
    }

    // In an outbreak the dead don't stay down. Anyone on the ground who isn't
    // already being eaten starts a clock.
    if (this.kind === 'zombie' || this.alwaysReanimate) {
      for (const npc of g.npcs.npcs) {
        if (npc.infected || npc.reanimate > 0 || npc.beingEatenBy) continue;
        if (npc.downed > 2.5) npc.reanimate = 5 + this.rng() * 9;
      }
    }

    if (this.kind === 'blackout' && g.t10) g.t10.forceStreetLights = 0;
    if (this.kind === 'alien') this.updateSaucers(dt, playerPos);
    if (this.kind === 'meteor') this.updateMeteors(dt, playerPos);
    if (this.kind === 'machine') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnTimer = 3; this.freeTheCars(); }
    }
  }

  // ---- Aliens -------------------------------------------------------------
  updateSaucers(dt, playerPos) {
    const want = Math.min(5, 2 + Math.floor(this.elapsed / 25));
    while (this.saucers.length < want && playerPos) this.addSaucer(playerPos);

    for (const s of this.saucers) {
      s.phase += dt * s.spin;
      s.angle += dt * s.orbitSpeed;
      const cx = s.centre.x + Math.cos(s.angle) * s.radius;
      const cz = s.centre.z + Math.sin(s.angle) * s.radius;
      const y = s.height + Math.sin(s.phase * 0.7) * 2.2;
      s.mesh.position.set(cx, y, cz);
      s.mesh.rotation.y += dt * 0.6;
      if (s.ring) s.ring.rotation.z += dt * 1.8;

      // Abduction: grab whoever is underneath and lift them.
      s.cooldown -= dt;
      if (!s.victim && s.cooldown <= 0) {
        const npc = this.game.npcs.npcs.find((n) =>
          !n.indoors && !n.abducting && Math.hypot(n.position.x - cx, n.position.z - cz) < 9);
        if (npc) { s.victim = npc; npc.abducting = s; npc.controlled = 'apocalypse'; s.beamT = 0; }
      }
      if (s.victim) {
        const npc = s.victim;
        s.beamT += dt * 0.35;
        npc.position.x = lerpv(npc.position.x, cx, clamp01(dt * 2.2));
        npc.position.z = lerpv(npc.position.z, cz, clamp01(dt * 2.2));
        npc.position.y = lerpv(npc.position.y, y - 2.4, clamp01(dt * 0.9));
        npc.root.position.copy(npc.position);
        npc.human.animator.setState(STATES.FALL);
        s.beam.visible = true;
        s.beam.position.set(0, -(y - npc.position.y) * 0.5, 0);
        s.beam.scale.y = Math.max(0.1, (y - npc.position.y) / 12);
        if (s.beamT >= 1 || npc.position.y > y - 3.2) {
          this.game.npcs.remove(npc);
          this.abducted++;
          s.victim = null;
          s.cooldown = 6 + this.rng() * 8;
          s.beam.visible = false;
        }
      } else {
        s.beam.visible = false;
      }
    }

    // Keep them near the player so the invasion follows you around.
    if (playerPos) {
      for (const s of this.saucers) {
        if (Math.hypot(s.centre.x - playerPos.x, s.centre.z - playerPos.z) > 220) {
          s.centre.set(playerPos.x + (this.rng() - 0.5) * 90, 0, playerPos.z + (this.rng() - 0.5) * 90);
        }
      }
    }
  }

  addSaucer(near) {
    const mesh = buildSaucer();
    const s = {
      mesh,
      ring: mesh.getObjectByName('ring'),
      beam: mesh.getObjectByName('beam'),
      centre: new THREE.Vector3(near.x + (this.rng() - 0.5) * 80, 0, near.z + (this.rng() - 0.5) * 80),
      radius: 18 + this.rng() * 40,
      angle: this.rng() * TAU,
      orbitSpeed: (this.rng() * 0.12 + 0.05) * (this.rng() < 0.5 ? -1 : 1),
      height: 34 + this.rng() * 26,
      phase: this.rng() * TAU,
      spin: 0.6 + this.rng(),
      cooldown: this.rng() * 4,
      victim: null,
      beamT: 0,
    };
    s.beam.visible = false;
    this.group.add(mesh);
    this.saucers.push(s);
    return s;
  }

  // ---- Meteors ------------------------------------------------------------
  updateMeteors(dt, playerPos) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && playerPos && this.meteors.length < 8) {
      this.spawnTimer = 0.7 + this.rng() * 1.6;
      this.addMeteor(playerPos);
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.mesh.position.addScaledVector(m.vel, dt);
      m.mesh.rotation.x += dt * 2.4;
      m.mesh.rotation.z += dt * 1.7;
      const ground = this.game.world.groundAt(m.mesh.position.x, m.mesh.position.z);
      if (m.mesh.position.y <= ground + 0.5) {
        // Impact: a flash, a bang, and everyone nearby hits the deck.
        if (this.game.atmosphere) this.game.atmosphere.lightning = 1;
        const d = playerPos ? m.mesh.position.distanceTo(playerPos) : 999;
        if (d < 180) audio.spawnPop();
        for (const npc of this.game.npcs.npcs) {
          if (npc.position.distanceTo(m.mesh.position) < 14) { npc.downed = 3 + this.rng() * 4; this.casualties++; }
        }
        this.group.remove(m.mesh);
        this.meteors.splice(i, 1);
      }
    }
  }

  addMeteor(near) {
    const geo = new THREE.IcosahedronGeometry(1.2 + this.rng() * 2.4, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x30251d, emissive: 0xff6a1e, emissiveIntensity: 2.4, roughness: 1, metalness: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const a = this.rng() * TAU;
    const r = 60 + this.rng() * 140;
    mesh.position.set(near.x + Math.cos(a) * r, 220 + this.rng() * 90, near.z + Math.sin(a) * r);
    const tx = near.x + (this.rng() - 0.5) * 220;
    const tz = near.z + (this.rng() - 0.5) * 220;
    const dir = new THREE.Vector3(tx - mesh.position.x, -mesh.position.y, tz - mesh.position.z).normalize();
    const vel = dir.multiplyScalar(48 + this.rng() * 26);
    this.group.add(mesh);
    const m = { mesh, vel };
    this.meteors.push(m);
    return m;
  }

  // -------------------------------------------------------------------------
  status() {
    if (!this.kind) return 'Nothing is ending. The city is fine.';
    const g = this.game;
    let infected = 0, hostile = 0, panicking = 0, down = 0;
    for (const n of g.npcs.npcs) {
      if (n.infected) infected++;
      else if (n.hostile) hostile++;
      else if (n.panicking) panicking++;
      if (n.downed > 0) down++;
    }
    const mins = Math.floor(this.elapsed / 60);
    const head = this.info.name + ', ' + (mins ? mins + ' minutes in' : Math.round(this.elapsed) + ' seconds in');
    const parts = [];
    if (infected) parts.push(infected + ' infected');
    if (hostile) parts.push(hostile + ' hostile');
    if (panicking) parts.push(panicking + ' running');
    if (down) parts.push(down + ' on the ground');
    if (this.casualties) parts.push(this.casualties + ' knocked down so far');
    if (this.abducted) parts.push(this.abducted + ' taken');
    return head + '. ' + (parts.length ? parts.join(', ') + '.' : 'Nobody has noticed yet.');
  }
}

// ---------------------------------------------------------------------------
// The saucer. Two lathed shells, a lit rim and a beam cone.
// ---------------------------------------------------------------------------
function buildSaucer() {
  const g = new THREE.Group();

  const hullPts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = Math.sin(t * Math.PI) * 9 + 0.4;
    hullPts.push(new THREE.Vector2(r, lerpv(-1.9, 1.9, t) * (1 - Math.abs(t - 0.5) * 0.4)));
  }
  const hull = new THREE.Mesh(
    new THREE.LatheGeometry(hullPts, 22),
    new THREE.MeshStandardMaterial({ color: 0x2b3238, metalness: 0.85, roughness: 0.28 })
  );
  g.add(hull);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 18, 10, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x3fd9c0, emissive: 0x1fa88f, emissiveIntensity: 0.9,
      metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.72,
    })
  );
  dome.position.y = 1.5;
  g.add(dome);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(7.6, 0.42, 8, 34),
    new THREE.MeshStandardMaterial({ color: 0x0c1412, emissive: 0x6dff9e, emissiveIntensity: 2.2, roughness: 0.4 })
  );
  ring.name = 'ring';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.6;
  g.add(ring);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 6.4, 12, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x8dffc4, transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  beam.name = 'beam';
  beam.renderOrder = 880;
  g.add(beam);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return g;
}
