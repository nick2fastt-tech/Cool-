// T10 World - the mutation system. A fictional strain takes hold of one person
// and works through four stages until they are something else entirely.
//
// Deliberately not gory: no blood, no wounds, nothing torn. What you see is a
// colour shift, a change in the way they stand and move, a faint light under
// the skin, and finally the body being replaced by the creature it became.
import { clamp01, clampv, lerpv, makeRng } from '../core/math.js';
import { audio } from '../core/audio.js';
import { STATES } from '../human/animator.js';

/** The four stages, in order. Stage 0 is simply "not mutating". */
export const STAGES = ['Normal', 'Mutation beginning', 'Partially transformed', 'Fully transformed'];

/**
 * Strains. Each one ends in a species from the bestiary, and decides what the
 * change looks like on the way there.
 */
export const STRAINS = {
  tendril: {
    name: 'Tendril strain', becomes: 'tendril',
    tint: 0x8f6dcf, eyes: 0xff5ad0, grow: 1.16,
    blurb: 'The arms go first — they get longer, and then they keep going.',
  },
  brute: {
    name: 'Brute strain', becomes: 'brute',
    tint: 0x7f9a58, eyes: 0xff7a3c, grow: 1.42,
    blurb: 'Everything thickens. Shoulders first, then the rest of them.',
  },
  stalker: {
    name: 'Stalker strain', becomes: 'stalker',
    tint: 0x536049, eyes: 0xbf5aff, grow: 1.02,
    blurb: 'They get quieter, then harder to look at, then gone.',
  },
  hive: {
    name: 'Hive strain', becomes: 'hive',
    tint: 0x7a5a8f, eyes: 0xd45aff, grow: 1.6,
    blurb: 'They stop being one thing and start being several.',
  },
  crawler: {
    name: 'Crawler strain', becomes: 'crawler',
    tint: 0x6f8a52, eyes: 0xd4ff5a, grow: 0.72,
    blurb: 'They fold down toward the pavement and stay there.',
  },
  splitter: {
    name: 'Splitter strain', becomes: 'splitter',
    tint: 0x59836f, eyes: 0x5affd0, grow: 0.94,
    blurb: 'A seam appears. It does not close again.',
  },
  gargoyle: {
    name: 'Stone strain', becomes: 'gargoyle',
    tint: 0x6f6e6a, eyes: 0xffb45a, grow: 1.08,
    blurb: 'The skin goes grey and hard, and something unfolds off the back.',
  },
  wisp: {
    name: 'Light strain', becomes: 'wisp',
    tint: 0x9fd8ff, eyes: 0x8fe8ff, grow: 0.6,
    blurb: 'They get brighter and lighter until there is nothing left to hold down.',
  },
};

export const STRAIN_IDS = Object.keys(STRAINS);

const STAGE_SECONDS = [0, 7, 7, 0];   // how long stage 1 and stage 2 last

export class Mutations {
  constructor(game) {
    this.game = game;
    this.active = [];          // { npc, strain, stage, t }
    this.rng = makeRng(0x4ab13f);
    this.rate = 1;             // T10 can make the whole thing faster or slower
  }

  strainFor(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return null;
    if (STRAINS[q]) return q;
    for (const id of STRAIN_IDS) {
      if (STRAINS[id].name.toLowerCase().indexOf(q) >= 0 || q.indexOf(id) >= 0) return id;
    }
    // A species name works too: "mutate him into a golem".
    const creatures = this.game.creatures;
    if (creatures) {
      const species = creatures.find(q);
      if (species) return { becomes: species, name: creatures.specFor(species).name + ' strain', tint: 0x7a7f6a, eyes: 0xd4ff5a, grow: 1.1, blurb: 'One of yours.' };
    }
    return null;
  }

  /** Someone this can be done to: an ordinary person, on their feet, outside. */
  eligible(npc) {
    if (!npc || npc.indoors || npc.removed) return false;
    if (npc.mutation) return false;
    if (npc.downed > 0 || npc.turning > 0) return false;
    if (npc.infected) return false;
    return true;
  }

  eligibleNear(pos, radius) {
    const npcs = this.game.npcs;
    if (!npcs) return null;
    let best = null, bd = radius || 30;
    for (const n of npcs.npcs) {
      if (!this.eligible(n)) continue;
      const d = n.position.distanceTo(pos);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  /**
   * Start one. `strainId` may be a strain, a species name, or nothing at all
   * for a random strain.
   * @returns the record, or null if that person can't be mutated.
   */
  begin(npc, strainId) {
    if (!this.eligible(npc)) return null;
    let strain = strainId ? this.strainFor(strainId) : null;
    if (!strain) strain = this.rng.pick(STRAIN_IDS);
    const def = typeof strain === 'string' ? STRAINS[strain] : strain;
    if (!def) return null;

    const rec = {
      npc, def, stage: 1, t: 0,
      baseHeight: npc.human.appearance.body.height,
      id: typeof strain === 'string' ? strain : def.becomes,
    };
    npc.mutation = rec;
    // They stop whatever they were doing. They do not run, and they do not
    // fight — the change takes all of their attention.
    npc.controlled = 'mutating';
    npc.panicking = false;
    npc.talkTimer = 0;
    npc.destination = null;
    npc.path = [];
    this.active.push(rec);
    this.enterStage(rec, 1);
    return rec;
  }

  cure(npc) {
    const rec = npc && npc.mutation;
    if (!rec) return false;
    this.finishRecord(rec, false);
    return true;
  }

  cureAll() {
    const n = this.active.length;
    while (this.active.length) this.finishRecord(this.active[0], false);
    return n;
  }

  // ---------------------------------------------------------------------------
  enterStage(rec, stage) {
    rec.stage = stage;
    rec.t = 0;
    const npc = rec.npc;
    const d = rec.def;
    if (!npc || npc.removed) return;

    if (stage === 1) {
      // Beginning: a wash of colour under the skin and a light behind the eyes.
      npc.human.setSkinTint(mix(0xffffff, d.tint, 0.4), d.eyes);
      npc.human.animator.setState(STATES.IDLE);
      this.shimmer(npc, 0.8);
      audio.creature('shift', 1.2, this.pan(npc));
      this.say(npc.name + ' has stopped walking. Something is starting.');
    } else if (stage === 2) {
      // Partial: full colour, a change in build, and they stop moving about.
      npc.human.setSkinTint(d.tint, d.eyes);
      const target = clampv(rec.baseHeight * lerpv(1, d.grow, 0.55), 1.2, 2.4);
      npc.human.setHeight(target);
      npc.controlled = 'freeze';
      this.shimmer(npc, 1.4);
      audio.creature('shift', 0.9, this.pan(npc));
      this.say(npc.name + ' is halfway to something else.');
    } else if (stage === 3) {
      this.complete(rec);
    }
  }

  complete(rec) {
    const npc = rec.npc;
    const creatures = this.game.creatures;
    if (!npc || npc.removed) { this.drop(rec); return; }
    const x = npc.position.x, z = npc.position.z;
    const name = npc.name;
    this.shimmer(npc, 2.2);
    audio.creature('shift', 0.7, this.pan(npc));

    // The person is replaced, not opened up: they go, the creature arrives.
    npc.mutation = null;
    if (this.game.npcs) this.game.npcs.remove(npc);
    let made = null;
    if (creatures) made = creatures.spawn(rec.def.becomes, x, z, { scale: 1 });
    if (made) {
      made.say('roar');
      if (this.game.powers) this.game.powers.burst({ x, y: this.game.world.groundAt(x, z), z }, 0xbf6dff, 1.8);
    }
    this.drop(rec);
    this.say(name + ' is gone. That is a ' + (made ? made.name : 'creature') + ' now.');
  }

  /** Put the person back the way they were. */
  finishRecord(rec, transformed) {
    const npc = rec.npc;
    if (npc && !npc.removed) {
      npc.mutation = null;
      npc.human.setSkinTint(null, null);
      // Undo the tremor: nothing else resets the roll.
      npc.root.position.copy(npc.position);
      npc.root.rotation.z = 0;
      if (npc.human.appearance.body.height !== rec.baseHeight) npc.human.setHeight(rec.baseHeight);
      if (npc.controlled === 'freeze' || npc.controlled === 'mutating') npc.controlled = null;
      npc.pickSchedule();
    }
    this.drop(rec);
    if (!transformed && npc) this.say(npc.name + ' is themselves again.');
  }

  drop(rec) {
    const i = this.active.indexOf(rec);
    if (i >= 0) this.active.splice(i, 1);
  }

  // ---------------------------------------------------------------------------
  update(dt) {
    if (!this.active.length) return;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const rec = this.active[i];
      const npc = rec.npc;
      if (!npc || npc.removed || npc.downed > 0) { this.drop(rec); continue; }
      rec.t += dt * this.rate;

      // The tell: a tremor that gets worse the further along they are, and a
      // slow lean. Nothing about it is bloody — it just looks wrong.
      const k = clamp01(rec.t / (STAGE_SECONDS[rec.stage] || 1));
      const shake = (rec.stage === 1 ? 0.012 : 0.03) * (0.4 + k);
      npc.root.position.x = npc.position.x + Math.sin(rec.t * 34) * shake;
      npc.root.position.z = npc.position.z + Math.cos(rec.t * 29) * shake;
      npc.root.rotation.z = Math.sin(rec.t * 6) * shake * 3;
      if (rec.stage === 2) {
        npc.human.animator.setState(k > 0.6 ? STATES.CROUCH : STATES.IDLE);
      }
      if (rec.t > (STAGE_SECONDS[rec.stage] || 1)) this.enterStage(rec, rec.stage + 1);
      else if (this.game.frame % 30 === 0 && rec.stage >= 1) this.shimmer(npc, 0.4 + rec.stage * 0.3);
    }
  }

  // ---------------------------------------------------------------------------
  shimmer(npc, scale) {
    const p = this.game.powers;
    if (!p) return;
    p.burst({ x: npc.position.x, y: npc.position.y, z: npc.position.z }, npc.mutation ? npc.mutation.def.eyes : 0xbf6dff, scale);
  }

  pan(npc) {
    const l = this.game.player ? this.game.player.position : null;
    if (!l) return 0;
    return clampv((npc.position.x - l.x) / 24, -1, 1);
  }

  say(line) {
    if (this.game && this.game.t10Say) this.game.t10Say(line);
  }

  status() {
    if (!this.active.length) return 'Nobody is changing.';
    return this.active.map((r) => r.npc.name + ' — ' + STAGES[r.stage] + ' (' + r.def.name + ')').join('; ') + '.';
  }
}

function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(lerpv(ar, br, t)) << 16) | (Math.round(lerpv(ag, bg, t)) << 8) | Math.round(lerpv(ab, bb, t));
}
