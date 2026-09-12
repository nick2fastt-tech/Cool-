import {
  DOORWAYS,
  INTERACTABLES,
  INTERACT_BY_ID,
  INTERACT_RANGE,
  NAV_BY_ID,
  ROOMS,
  findPath,
  hasLineOfSight,
  nearestNode,
  roomAt,
  roomName,
  type Interactable,
} from './map';
import { MOVE } from './matchSim';
import type { MatchSim } from './matchSim';

/**
 * AI teammates.
 *
 * These are not scripted props: a crew bot is an ordinary player entity that
 * happens to be driven by code instead of a phone. Every move it makes goes
 * through `sim.applyInput` and every interaction through `sim.setInteract` -
 * the same authoritative, validated path a human uses. A bot cannot walk
 * through a wall or reach a breaker from across the map for exactly the same
 * reason you cannot.
 *
 * "Human-like" here means three specific things:
 *
 *  - **They are late.** Every decision waits out a reaction time, so they do
 *    not snap onto a new objective the instant the server changes it.
 *  - **They are imprecise.** They aim at a point near their target rather than
 *    at it, they stop to look around, and they do not walk perfect lines.
 *  - **They are limited.** They react to animatronics they can see or that are
 *    close enough to hear - not to the whole world state they technically have
 *    access to.
 *
 * They also call out what they are doing, which is most of what makes a
 * teammate feel present.
 */

export type CrewIntent = 'idle' | 'follow' | 'objective' | 'revive' | 'flee' | 'explore' | 'recharge';

interface CrewMember {
  id: string;
  /** 0..1 - how quickly they react and how tidily they move. */
  skill: number;
  /** 0..1 - how close they will get to an animatronic before bailing. */
  nerve: number;
  intent: CrewIntent;
  /** Seconds before this bot may reconsider its intent. */
  think: number;
  /** Current nav path and index. */
  path: string[];
  pathIndex: number;
  /** World-space goal, if not following a path. */
  goal: { x: number; z: number } | null;
  /** Interactable being held, if any. */
  holding: string | null;
  /** Teammate being revived, if any. */
  reviving: string | null;
  /** Seconds left of a deliberate pause. */
  pause: number;
  /** Keeps a bolt going for a moment so they do not dither in a doorway. */
  fleeUntil: number;
  /**
   * Time left during which a merely-nearby animatronic will not spook them
   * again. Somebody who has just stepped around a patrol gets on with the job
   * rather than flinching at it every two seconds.
   */
  calm: number;
  /** Which main switch this bot has claimed, during that step. */
  claimedSwitch: string | null;
  /** Debounce so callouts do not spam. */
  lastCallout: string;
  calloutCooldown: number;
  seq: number;
  torch: boolean;
  /** What this bot has called dibs on, so two never chase the same job. */
  claim: string | null;
  /** This one is watching the room while somebody else works. */
  lookout: boolean;
  /** Phase of the idle head movement. */
  scan: number;
  /** Seconds of looking round a doorway before stepping through. */
  peek: number;
  /** Doorway they have already peeked at, so they do it once. */
  peeked: string | null;
  /** Cached each tick: what this bot currently knows is near it. */
  threat: Threat | null;
  /** Clock time before which a chosen escape is not reconsidered. */
  goalUntil: number;
  /** Somebody to thank, once they are back on their feet. */
  thanks: string | null;
  /** Were they on the floor last tick? Used to notice a rescue. */
  wasDowned: boolean;
}

interface Threat {
  x: number;
  z: number;
  distance: number;
  hunting: boolean;
}

/** Where a teammate last reported something, and when. */
interface ThreatMemory {
  x: number;
  z: number;
  at: number;
}

const NAMES = ['RILEY', 'SAM', 'JUNO', 'MAX', 'CASS', 'DEV', 'ARI', 'NOOR'];

/** Distance at which a bot notices an animatronic it cannot see. */
const HEARING = 7;

export function crewBotName(index: number): string {
  return NAMES[index % NAMES.length];
}

export class CrewAI {
  private readonly members: CrewMember[] = [];
  /**
   * What the crew has called out to each other.
   *
   * When one of them shouts about an animatronic, everybody remembers roughly
   * where it was for a few seconds - which is what a real crew does, and what
   * makes them stop walking one at a time into the same room.
   */
  private readonly reported = new Map<string, ThreatMemory>();
  private clock = 0;

  constructor(
    private readonly sim: MatchSim,
    ids: string[],
    private readonly random: () => number = Math.random,
  ) {
    for (const id of ids) {
      this.members.push({
        id,
        skill: 0.55 + this.random() * 0.4,
        nerve: 0.4 + this.random() * 0.5,
        intent: 'idle',
        think: this.random() * 0.6,
        path: [],
        pathIndex: 0,
        goal: null,
        holding: null,
        reviving: null,
        pause: 0,
        fleeUntil: 0,
        calm: 0,
        claimedSwitch: null,
        lastCallout: '',
        calloutCooldown: 0,
        seq: 0,
        torch: false,
        claim: null,
        lookout: false,
        scan: this.random() * Math.PI * 2,
        peek: 0,
        peeked: null,
        threat: null,
        goalUntil: 0,
        thanks: null,
        wasDowned: false,
      });
    }
  }

  get ids(): string[] {
    return this.members.map((m) => m.id);
  }

  /** What each teammate believes it is doing. For the debug overlay and tests. */
  get intents(): Record<string, CrewIntent> {
    const out: Record<string, CrewIntent> = {};
    for (const member of this.members) out[member.id] = member.intent;
    return out;
  }

  /** Full per-teammate state, for the debug overlay and for diagnosis. */
  debug(): {
    id: string; intent: CrewIntent; holding: string | null; claim: string | null;
    path: number; step: number; calm: number; lookout: boolean;
  }[] {
    return this.members.map((m) => ({
      id: m.id,
      intent: m.intent,
      holding: m.holding,
      claim: m.claim,
      path: m.path.length,
      step: m.pathIndex,
      calm: Math.round(m.calm),
      lookout: m.lookout,
    }));
  }

  step(dt: number): void {
    this.clock += dt;
    // Sightings decay: nobody acts on "it was over there" a minute later.
    for (const [id, memory] of [...this.reported]) {
      if (this.clock - memory.at > 14) this.reported.delete(id);
    }
    this.assignLookout();

    for (const bot of this.members) {
      const player = this.sim.players.get(bot.id);
      if (!player) continue;
      bot.calloutCooldown = Math.max(0, bot.calloutCooldown - dt);
      bot.fleeUntil = Math.max(0, bot.fleeUntil - dt);
      bot.calm = Math.max(0, bot.calm - dt);
      bot.peek = Math.max(0, bot.peek - dt);
      bot.scan += dt * (0.8 + bot.nerve);

      if (player.status !== 'alive') {
        // Downed or gone: drop everything and stop sending input.
        if (player.status === 'downed' && !bot.wasDowned) {
          bot.wasDowned = true;
          const rescuer = [...this.sim.players.values()].find((p) => p.reviving === bot.id);
          if (rescuer) bot.thanks = rescuer.id;
        }
        this.release(bot);
        bot.claim = null;
        bot.intent = 'idle';
        if (player.status === 'downed' && bot.calloutCooldown <= 0) {
          this.callout(bot, this.random() < 0.5 ? 'I AM DOWN - HELP' : 'DOWN OVER HERE');
        }
        continue;
      }

      // Look once, use it everywhere this tick.
      bot.threat = this.nearestThreat(bot);
      if (bot.threat?.hunting) this.report(bot, bot.threat);

      if (bot.wasDowned) {
        bot.wasDowned = false;
        const rescuer = bot.thanks ? this.sim.players.get(bot.thanks) : null;
        bot.thanks = null;
        this.callout(bot, rescuer ? `THANKS ${rescuer.name}` : 'BACK UP - GIVE ME A SECOND');
        // A shaken teammate sticks close for a moment rather than sprinting off.
        bot.pause = 0.6 + this.random() * 0.8;
      }

      // Being hunted is an interrupt, not something you get round to on your
      // next think. Waiting out a reaction timer while something closes from
      // fourteen metres is how a crew gets wiped, and it is not what a person
      // does when they hear it coming.
      if (bot.threat?.hunting && bot.threat.distance < 14 && bot.intent !== 'flee') {
        this.release(bot);
        bot.claim = null;
        bot.goal = null;
        bot.intent = 'flee';
        bot.fleeUntil = 1.4 + this.random() * 0.6;
        bot.path = [];
        bot.pause = 0;
        bot.think = 0.25;
        this.callout(bot, this.random() < 0.5 ? 'IT IS ON ME' : 'MOVING - IT SAW ME');
      }

      bot.think -= dt;
      if (bot.think <= 0) {
        // Reaction time: better players re-plan more often, but nobody is instant.
        bot.think = 0.35 + (1 - bot.skill) * 0.9 + this.random() * 0.25;
        this.decide(bot);
      }

      this.act(bot, dt);
    }
  }

  /* ------------------------------------------------------------- deciding */

  private decide(bot: CrewMember): void {
    const me = this.sim.players.get(bot.id);
    if (!me) return;

    // 1. Something is coming for *them*. This overrides everything else.
    //
    //
    // The distinction that matters: an animatronic actually hunting you is
    // worth bolting from across a room, while one patrolling past at eight
    // metres is not. Without that, a bot spends the whole match flinching at
    // traffic and never finishes a job - which is both useless and nothing
    // like how a person plays.
    const threat = bot.threat ?? this.nearestThreat(bot);
    const panicRange = 3.2 + bot.nerve * 2.5;
    const bolt = threat
      ? threat.hunting
        ? threat.distance < 13
        : threat.distance < panicRange && bot.calm <= 0
      : false;
    if (bolt && threat) {
      if (bot.intent !== 'flee') {
        this.callout(bot, this.random() < 0.5 ? 'RUN' : 'IT SEES ME');
        this.release(bot);
      }
      bot.intent = 'flee';
      bot.pause = 0;
      // Note: the escape target is deliberately NOT cleared here. `decide` runs
      // several times a second, and wiping the goal each time meant re-picking
      // an exit mid-stride and setting off back the way they came.
      // Commit to the bolt briefly, so they do not dither on the threshold.
      bot.fleeUntil = 1.1 + this.random() * 0.8;
      // Having reacted once, give the same bystander a wide berth instead of
      // re-panicking at it on every think.
      if (!threat.hunting) bot.calm = 6 + this.random() * 4;
      bot.path = [];
      return;
    }
    if (bot.intent === 'flee' && bot.fleeUntil > 0) return;

    // 2. A teammate is down. Going for them is the whole point of a crew -
    // but running into the thing that downed them helps nobody, so a casualty
    // with a hunter standing over them is left until it wanders off.
    const downed = this.nearestDowned(bot);
    if (downed && downed.distance < 30 && !this.guardedByHunter(downed.x, downed.z)) {
      if (bot.intent !== 'revive') {
        this.callout(bot, downed.urgent ? `${downed.name} IS FADING - GOING NOW` : `ON MY WAY TO ${downed.name}`);
        this.release(bot);
        bot.path = [];
      }
      bot.intent = 'revive';
      bot.claim = `revive:${downed.id}`;
      bot.goal = { x: downed.x, z: downed.z };
      return;
    }

    // 2b. One of the crew watches the room while the others work a fixture.
    if (bot.lookout && this.sim.snapshot().obj.step !== 'none') {
      const worker = this.nearestWorkingMate(bot);
      if (worker) {
        if (bot.intent !== 'follow') {
          this.release(bot);
          bot.path = [];
          this.callout(bot, 'I WILL WATCH THE DOOR');
        }
        bot.intent = 'follow';
        bot.claim = null;
        bot.goal = { x: worker.x, z: worker.z };
        return;
      }
    }

    // 3. The objective, when there is one.
    const step = this.sim.snapshot().obj.step;
    if (step !== 'none') {
      if (bot.intent !== 'objective') {
        this.release(bot);
        bot.path = [];
      }
      bot.intent = 'objective';
      return;
    }
    bot.claim = null;

    // 4. Free roam: go and open a room nobody has been in.
    if (this.sim.mode === 'free-roam') {
      const room = this.unexploredRoom(bot);
      if (room) {
        const changed = bot.intent !== 'explore' || roomAt(bot.goal?.x ?? 0, bot.goal?.z ?? 0) !== room.id;
        if (changed) {
          this.release(bot);
          bot.path = [];
          if (bot.intent !== 'explore') this.callout(bot, `CHECKING ${roomName(room.id).toUpperCase()}`);
        }
        bot.intent = 'explore';
        bot.goal = room.point;
        return;
      }
    }

    // 5. Torch running low with nothing urgent on: top it up.
    if (me.battery < 25) {
      const station = this.nearestInteractable(bot, 'battery');
      if (station) {
        if (bot.intent !== 'recharge') {
          this.release(bot);
          bot.path = [];
        }
        bot.intent = 'recharge';
        bot.goal = { x: station.x, z: station.z };
        return;
      }
    }

    // 6. Otherwise stay with the crew.
    if (bot.intent !== 'follow') {
      this.release(bot);
      bot.path = [];
    }
    bot.intent = 'follow';
  }

  /* --------------------------------------------------------------- acting */

  private act(bot: CrewMember, dt: number): void {
    const me = this.sim.players.get(bot.id);
    if (!me) return;

    // Pauses are for looking round corners and catching your breath. Nobody
    // stands still to check a doorway with something sprinting at them, and a
    // pause that outlives the reason for it gets the bot killed.
    if (bot.intent === 'flee') bot.pause = 0;
    if (bot.pause > 0) {
      bot.pause -= dt;
      this.sendInput(bot, 0, 0, me.yaw, false, dt);
      return;
    }

    switch (bot.intent) {
      case 'flee': {
        const threat = this.nearestThreat(bot);
        // Nothing hunting and the bolt has run its course: back to work.
        if (!threat || (!threat.hunting && bot.fleeUntil <= 0)) {
          bot.intent = 'follow';
          bot.fleeUntil = 0;
          bot.think = 0;
          return;
        }
        // Away from it, and toward open space rather than into a corner.
        const away = Math.atan2(me.x - threat.x, me.z - threat.z);
        const node = this.fleeNode(bot, threat);
        if (node) this.moveTo(bot, node.x, node.z, dt, true);
        else this.sendInput(bot, Math.sin(away), Math.cos(away), away, true, dt);
        return;
      }

      case 'revive': {
        const target = this.nearestDowned(bot);
        if (!target) {
          bot.intent = 'follow';
          this.release(bot);
          return;
        }
        const distance = Math.hypot(target.x - me.x, target.z - me.z);
        if (distance > 1.7) {
          // Worth the noise only when somebody is actually running out of time.
          this.moveTo(bot, target.x, target.z, dt, target.urgent && distance > 8);
          return;
        }
        this.sendInput(bot, 0, 0, Math.atan2(target.x - me.x, target.z - me.z), false, dt);
        if (bot.reviving !== target.id) {
          bot.reviving = target.id;
          this.sim.setRevive(bot.id, target.id, true);
          this.callout(bot, `HOLD ON ${target.name}`);
        }
        return;
      }

      case 'objective':
        this.workObjective(bot, dt);
        return;

      case 'recharge': {
        const station = this.nearestInteractable(bot, 'battery');
        if (!station || me.battery > 95) {
          this.release(bot);
          bot.intent = 'follow';
          return;
        }
        this.useOrApproach(bot, station, dt);
        return;
      }

      case 'explore': {
        if (!bot.goal) {
          bot.intent = 'follow';
          return;
        }
        const distance = Math.hypot(bot.goal.x - me.x, bot.goal.z - me.z);
        if (distance < 1.6) {
          bot.goal = null;
          bot.think = 0;
          // A beat of standing and looking, like somebody actually checking.
          bot.pause = 0.4 + this.random() * 0.8;
          return;
        }
        this.moveTo(bot, bot.goal.x, bot.goal.z, dt, false);
        return;
      }

      default: {
        // Follow the nearest human, hanging back a few metres.
        const leader = this.nearestHuman(bot);
        if (!leader) {
          this.sendInput(bot, 0, 0, me.yaw, false, dt);
          return;
        }
        // Do not walk straight back past the thing you just ran from. Holding
        // position until it moves on is what a person does; strolling past it
        // because a timer expired is what a state machine does.
        // Only worth waiting out at a safe distance. Anything closer than
        // that and standing still is the worst possible choice.
        if (bot.threat && bot.threat.distance > 7 && this.inTheWay(me.x, me.z, leader.x, leader.z, bot.threat)) {
          const face = Math.atan2(bot.threat.x - me.x, bot.threat.z - me.z);
          this.sendInput(bot, 0, 0, face, false, dt);
          return;
        }
        const distance = Math.hypot(leader.x - me.x, leader.z - me.z);
        if (distance < 3.2) {
          if (this.random() < 0.01) bot.pause = 0.5 + this.random();
          this.sendInput(bot, 0, 0, Math.atan2(leader.x - me.x, leader.z - me.z), false, dt);
          return;
        }
        // Only break into a run when genuinely left behind.
        this.moveTo(bot, leader.x, leader.z, dt, distance > 18);
      }
    }
  }

  /**
   * Work the power-restoration chain.
   *
   * The interesting part is the last step: it needs two people on two switches
   * in different rooms at the same time, so bots claim a switch each and leave
   * the one a human is standing at alone.
   */
  private workObjective(bot: CrewMember, dt: number): void {
    const snapshot = this.sim.snapshot();
    const me = this.sim.players.get(bot.id);
    if (!me) return;
    const step = snapshot.obj.step;

    if (step === 'mainSwitch') {
      const claimed = bot.claimedSwitch ?? this.claimSwitch(bot);
      bot.claimedSwitch = claimed;
      const target = INTERACT_BY_ID.get(claimed);
      if (target) {
        this.useOrApproach(bot, target, dt, 'I HAVE MY SWITCH');
        return;
      }
    } else {
      bot.claimedSwitch = null;
    }

    if (step === 'fuses' && me.carrying) {
      const panel = INTERACT_BY_ID.get('panel');
      if (panel) {
        this.useOrApproach(bot, panel, dt, 'FITTING IT NOW');
        return;
      }
    }

    // Otherwise take whichever live target nobody else has claimed.
    const targets = snapshot.obj.targets
      .map((id) => INTERACT_BY_ID.get(id))
      .filter((item): item is Interactable => Boolean(item))
      .filter((item) => !this.claimedByAnotherBot(bot, item.id))
      .filter((item) => !this.members.some((other) => other.id !== bot.id && other.claim === item.id))
      // The panel is only a target for whoever is actually carrying a fuse.
      .filter((item) => item.kind !== 'fusePanel' || me.carrying);
    if (!targets.length) {
      // Nothing to do on this step - stay close and out of the way.
      const leader = this.nearestHuman(bot);
      if (leader) this.moveTo(bot, leader.x, leader.z, dt, false);
      else this.sendInput(bot, 0, 0, me.yaw, false, dt);
      return;
    }

    // Pick the cheapest job that is not somebody else's, counting a recent
    // sighting nearby as extra distance rather than a hard no.
    let best = targets[0];
    let bestCost = Infinity;
    for (const item of targets) {
      const distance = Math.hypot(item.x - me.x, item.z - me.z);
      const danger = this.reportedDanger(item.x, item.z) * 18;
      const mine = bot.claim === item.id ? -6 : 0; // stick to your own job
      const cost = distance + danger + mine;
      if (cost < bestCost) {
        bestCost = cost;
        best = item;
      }
    }
    if (bot.claim !== best.id) bot.claim = best.id;
    const shout = best.kind === 'fuse' ? 'GOT A FUSE' : best.kind === 'breaker' ? 'BREAKER ON ME' : 'I HAVE THIS';
    this.useOrApproach(bot, best, dt, shout);
  }

  private useOrApproach(bot: CrewMember, target: Interactable, dt: number, shout?: string): void {
    const me = this.sim.players.get(bot.id);
    if (!me) return;
    // Nobody finishes wiring a breaker with something coming for them - but
    // one shuffling past the doorway is just the job. Abandoning a fixture
    // for any animatronic within six metres means never finishing anything,
    // because they patrol through the electrical room.
    const loomingBystander = Boolean(bot.threat && !bot.threat.hunting && bot.threat.distance < 2.6 && bot.calm <= 0);
    if (loomingBystander) bot.calm = 7 + this.random() * 4;
    if (bot.threat && ((bot.threat.hunting && bot.threat.distance < 9) || loomingBystander)) {
      this.release(bot);
      this.moveAwayFrom(bot, bot.threat, dt);
      return;
    }
    const distance = Math.hypot(target.x - me.x, target.z - me.z);
    if (distance > INTERACT_RANGE - 0.5) {
      if (bot.holding) this.release(bot);
      // Never sprint to a job. Sprinting roughly doubles the noise you make,
      // and noise is the single strongest thing these animatronics hunt on -
      // running errands at a flat sprint is what was getting the crew killed
      // within fifteen seconds of a blackout.
      this.moveTo(bot, target.x, target.z, dt, false);
      return;
    }
    this.sendInput(bot, 0, 0, Math.atan2(target.x - me.x, target.z - me.z), false, dt);
    if (bot.holding !== target.id) {
      bot.holding = target.id;
      this.sim.setInteract(bot.id, target.id, true);
      if (shout) this.callout(bot, shout);
    }
  }

  /* ------------------------------------------------------------ movement */

  private moveTo(bot: CrewMember, x: number, z: number, dt: number, sprint: boolean): void {
    const me = this.sim.players.get(bot.id);
    if (!me) return;
    if (bot.holding || bot.reviving) this.release(bot);

    // Check the corner before stepping through it - once per doorway, and not
    // while something is actually after them.
    if (bot.intent !== 'flee' && bot.peek <= 0) {
      for (const door of DOORWAYS) {
        const key = `${door.x},${door.z}`;
        if (bot.peeked === key) continue;
        if (Math.hypot(door.x - me.x, door.z - me.z) > 2.2) continue;
        bot.peeked = key;
        bot.peek = 4;
        bot.pause = 0.25 + (1 - bot.skill) * 0.7;
        break;
      }
    }

    let targetX = x;
    let targetZ = z;
    if (!hasLineOfSight(me.x, me.z, x, z)) {
      const goalNode = nearestNode(x, z).id;
      if (!bot.path.length || bot.path[bot.path.length - 1] !== goalNode || bot.pathIndex >= bot.path.length) {
        bot.path = findPath(nearestNode(me.x, me.z).id, goalNode);
        bot.pathIndex = 1;
      }
      const node = NAV_BY_ID.get(bot.path[bot.pathIndex] ?? bot.path[bot.path.length - 1]);
      if (node) {
        targetX = node.x;
        targetZ = node.z;
        if (Math.hypot(me.x - node.x, me.z - node.z) < 1.1) bot.pathIndex++;
      }
    } else {
      bot.path = [];
    }

    // Aim slightly off, so they do not glide along perfect lines.
    const sloppiness = (1 - bot.skill) * 0.9;
    targetX += Math.sin(this.sim.tick * 0.06 + bot.id.charCodeAt(0)) * sloppiness;
    targetZ += Math.cos(this.sim.tick * 0.05 + bot.id.charCodeAt(1 % bot.id.length)) * sloppiness;

    const dx = targetX - me.x;
    const dz = targetZ - me.z;
    const length = Math.hypot(dx, dz) || 1;
    const yaw = Math.atan2(dx, dz);
    // Face where you are going, but turn at a human speed rather than snapping.
    const turn = shortestAngle(me.yaw, Math.atan2(dx, dz));
    const facing = me.yaw + turn * Math.min(1, dt * (4 + bot.skill * 4));
    this.sendInput(bot, dx / length, dz / length, facing, sprint && me.stamina > 0.6, dt);
    void yaw;
  }

  private sendInput(bot: CrewMember, mx: number, mz: number, yaw: number, sprint: boolean, dt: number): void {
    const me = this.sim.players.get(bot.id);
    if (!me) return;

    // Heads move. A person walking a dark building sweeps their light around
    // and glances behind them; a bot that stares dead ahead reads as a robot
    // from twenty metres away, which is the whole problem with AI teammates.
    const sweep = Math.sin(bot.scan) * (0.3 + bot.nerve * 0.3);
    const glance = bot.threat && !bot.threat.hunting && bot.threat.distance < 12
      ? Math.sin(bot.scan * 2.3) * 0.5
      : 0;
    const facing = yaw + sweep + glance;

    // Torch discipline: on in the dark, but off when something is hunting
    // close - a light is exactly what it is looking for.
    const hunted = Boolean(bot.threat?.hunting && bot.threat.distance < 12);
    const wantTorch = this.sim.blackout && me.battery > 6 && !hunted;
    bot.torch = wantTorch;

    // Breath is a resource, and the way a crew dies is by arriving at the
    // danger already out of it. Casual sprinting stops well short of empty so
    // there is always a few seconds in reserve; only something actually
    // hunting them is worth the last of it.
    const reserve = hunted || bot.intent === 'flee' ? 0 : 3.2;
    const nearSomething = Boolean(bot.threat && !bot.threat.hunting && bot.threat.distance < 10);
    // Sprinting is loud, and loud is what these things hunt by. Nobody with
    // any sense pelts down a corridor with one of them standing in it - you
    // slow down, and if it is close you move quietly.
    const canSprint = sprint && me.stamina > reserve && !nearSomething;
    const sneak = Boolean(bot.threat && !bot.threat.hunting && bot.threat.distance < 6.5);

    this.sim.applyInput(bot.id, {
      seq: ++bot.seq,
      mx,
      mz,
      yaw: facing,
      sprint: canSprint,
      crouch: sneak,
      flashlight: wantTorch,
      dt: Math.min(MOVE.maxInputDt, dt),
    });
  }

  private release(bot: CrewMember): void {
    if (bot.holding) {
      this.sim.setInteract(bot.id, null, false);
      bot.holding = null;
    }
    if (bot.reviving) {
      this.sim.setRevive(bot.id, null, false);
      bot.reviving = null;
    }
  }

  /* -------------------------------------------------------------- senses */

  /**
   * The nearest animatronic this bot could plausibly know about, and whether
   * it is actually coming for them. Anything it can neither see nor hear does
   * not exist as far as the bot is concerned.
   */
  private nearestThreat(bot: CrewMember): { x: number; z: number; distance: number; hunting: boolean } | null {
    const me = this.sim.players.get(bot.id);
    if (!me) return null;
    let best: { x: number; z: number; distance: number; hunting: boolean } | null = null;
    for (const animatronic of this.sim.bots) {
      const distance = Math.hypot(animatronic.x - me.x, animatronic.z - me.z);
      const hunting =
        animatronic.target === bot.id && (animatronic.state === 'chase' || animatronic.state === 'attack');
      const noticed = hunting || distance < HEARING || hasLineOfSight(me.x, me.z, animatronic.x, animatronic.z);
      if (!noticed) continue;
      // A hunter always outranks a bystander, however close the bystander is.
      const better = !best || (hunting && !best.hunting) || (hunting === best.hunting && distance < best.distance);
      if (better) best = { x: animatronic.x, z: animatronic.z, distance, hunting };
    }
    return best;
  }

  /**
   * Somewhere worth running to: far from the threat, not so far that they
   * cross the building, and out of the room they are currently sharing with
   * it. Fleeing to the other end of the same hall is not fleeing.
   */
  /** Back off from something, using the flee route if there is a good one. */
  private moveAwayFrom(bot: CrewMember, threat: Threat, dt: number): void {
    const me = this.sim.players.get(bot.id);
    if (!me) return;
    const node = this.fleeNode(bot, threat);
    if (node) {
      this.moveTo(bot, node.x, node.z, dt, true);
      return;
    }
    const away = Math.atan2(me.x - threat.x, me.z - threat.z);
    this.sendInput(bot, Math.sin(away), Math.cos(away), away, true, dt);
  }

  private fleeNode(bot: CrewMember, threat: { x: number; z: number }): { x: number; z: number } | null {
    const me = this.sim.players.get(bot.id);
    if (!me) return null;
    const threatRoom = roomAt(threat.x, threat.z);
    let best: { x: number; z: number } | null = null;
    let bestScore = -Infinity;
    for (const node of NAV_BY_ID.values()) {
      const fromMe = Math.hypot(node.x - me.x, node.z - me.z);
      if (fromMe > 26 || fromMe < 3) continue;
      const fromThreat = Math.hypot(node.x - threat.x, node.z - threat.z);
      if (fromThreat < 9) continue;
      const differentRoom = node.room !== threatRoom ? 6 : 0;
      const reported = this.reportedDanger(node.x, node.z) * 14;
      const score = fromThreat + differentRoom - fromMe * 0.3 - reported;
      if (score > bestScore) {
        bestScore = score;
        best = { x: node.x, z: node.z };
      }
    }
    return best;
  }

  /**
   * Who to pick up first.
   *
   * Not simply the nearest: somebody thirty seconds from bleeding out beats
   * somebody with a minute left, even if they are further away. A casualty
   * another bot has already claimed is left to them.
   */
  private nearestDowned(
    bot: CrewMember,
  ): { id: string; name: string; x: number; z: number; distance: number; urgent: boolean } | null {
    const me = this.sim.players.get(bot.id);
    if (!me) return null;
    let best: { id: string; name: string; x: number; z: number; distance: number; urgent: boolean } | null = null;
    let bestScore = -Infinity;
    for (const [, player] of this.sim.players) {
      if (player.id === bot.id || player.status !== 'downed') continue;
      if (this.members.some((other) => other.id !== bot.id && other.claim === `revive:${player.id}`)) continue;
      const distance = Math.hypot(player.x - me.x, player.z - me.z);
      const urgent = player.bleedOut < 20;
      // Urgency first, distance second.
      const score = (urgent ? 40 : 0) - distance;
      if (score > bestScore) {
        bestScore = score;
        best = { id: player.id, name: player.name, x: player.x, z: player.z, distance, urgent };
      }
    }
    return best;
  }

  /**
   * Is the threat sitting on the line between here and where we want to be?
   * Distance from a point to the segment, with a generous radius.
   */
  private inTheWay(x: number, z: number, goalX: number, goalZ: number, threat: Threat): boolean {
    const dx = goalX - x;
    const dz = goalZ - z;
    const lengthSq = dx * dx + dz * dz;
    const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((threat.x - x) * dx + (threat.z - z) * dz) / lengthSq)) : 0;
    const nearestX = x + dx * t;
    const nearestZ = z + dz * t;
    return Math.hypot(threat.x - nearestX, threat.z - nearestZ) < 5.5;
  }

  /**
   * Is it still standing over them?
   *
   * Checking only for an active chase is not enough: an animatronic that has
   * just put somebody down goes into a cooldown, which read as "safe" and sent
   * the rest of the crew in one at a time to be knocked over in turn. Anything
   * loitering near a body is a reason to wait.
   */
  private guardedByHunter(x: number, z: number): boolean {
    return this.sim.bots.some((animatronic) => Math.hypot(animatronic.x - x, animatronic.z - z) < 7.5);
  }

  /** A teammate currently holding a fixture, for the lookout to stand near. */
  private nearestWorkingMate(bot: CrewMember): { x: number; z: number } | null {
    const me = this.sim.players.get(bot.id);
    if (!me) return null;
    let best: { x: number; z: number; distance: number } | null = null;
    for (const [, player] of this.sim.players) {
      if (player.id === bot.id || player.status !== 'alive' || !player.holding) continue;
      const distance = Math.hypot(player.x - me.x, player.z - me.z);
      if (!best || distance < best.distance) best = { x: player.x, z: player.z, distance };
    }
    return best;
  }

  /**
   * One of the crew hangs back and watches while the others work.
   *
   * The job goes to whoever is least useful on the fixtures - the one not
   * carrying anything - and only when there are enough of them to spare
   * somebody.
   */
  private assignLookout(): void {
    const alive = this.members.filter((m) => this.sim.players.get(m.id)?.status === 'alive');
    if (alive.length < 3) {
      for (const member of this.members) member.lookout = false;
      return;
    }
    if (alive.some((m) => m.lookout)) return;
    const candidate =
      alive.find((m) => !this.sim.players.get(m.id)?.carrying && m.intent !== 'revive') ?? alive[alive.length - 1];
    for (const member of this.members) member.lookout = member === candidate;
  }

  /** Tell the rest of the crew where something is. */
  private report(bot: CrewMember, threat: Threat): void {
    this.reported.set(`${Math.round(threat.x)},${Math.round(threat.z)}`, {
      x: threat.x,
      z: threat.z,
      at: this.clock,
    });
    if (threat.distance < 9) {
      this.callout(bot, this.random() < 0.5 ? 'ONE OF THEM IS HERE' : 'CONTACT - WATCH OUT');
    }
  }

  /** How risky a spot is, given what the crew has recently called out. */
  private reportedDanger(x: number, z: number): number {
    let worst = 0;
    for (const [, memory] of this.reported) {
      const distance = Math.hypot(memory.x - x, memory.z - z);
      const freshness = Math.max(0, 1 - (this.clock - memory.at) / 14);
      worst = Math.max(worst, freshness * Math.max(0, 1 - distance / 12));
    }
    return worst;
  }

  private nearestHuman(bot: CrewMember): { x: number; z: number } | null {
    const me = this.sim.players.get(bot.id);
    if (!me) return null;
    const botIds = new Set(this.members.map((m) => m.id));
    let best: { x: number; z: number; distance: number } | null = null;
    for (const [, player] of this.sim.players) {
      if (botIds.has(player.id) || player.status !== 'alive') continue;
      const distance = Math.hypot(player.x - me.x, player.z - me.z);
      if (!best || distance < best.distance) best = { x: player.x, z: player.z, distance };
    }
    if (best) return best;
    // No humans left standing: fall back to another bot so they still group up.
    for (const [, player] of this.sim.players) {
      if (player.id === bot.id || player.status !== 'alive') continue;
      return { x: player.x, z: player.z };
    }
    return null;
  }

  private nearestInteractable(bot: CrewMember, kind: Interactable['kind']): Interactable | null {
    const me = this.sim.players.get(bot.id);
    if (!me) return null;
    const snapshot = this.sim.snapshot();
    let best: Interactable | null = null;
    let bestDistance = Infinity;
    for (const item of INTERACTABLES) {
      if (item.kind !== kind) continue;
      if (kind === 'battery' && snapshot.ints[item.id] === 0) continue; // on cooldown
      const distance = Math.hypot(item.x - me.x, item.z - me.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = item;
      }
    }
    return best;
  }

  private unexploredRoom(bot: CrewMember): { id: string; point: { x: number; z: number } } | null {
    const me = this.sim.players.get(bot.id);
    if (!me) return null;
    const explored = new Set(this.sim.exploredRooms);
    // Claim different rooms so a crew of bots fans out instead of convoying.
    const claimed = new Set(
      this.members
        .filter((other) => other.id !== bot.id && other.intent === 'explore' && other.goal)
        .map((other) => roomAt(other.goal!.x, other.goal!.z)),
    );
    let best: { id: string; point: { x: number; z: number } } | null = null;
    let bestDistance = Infinity;
    for (const room of ROOMS) {
      if (explored.has(room.id) || claimed.has(room.id)) continue;
      const point = { x: (room.rect.x1 + room.rect.x2) / 2, z: (room.rect.z1 + room.rect.z2) / 2 };
      const distance = Math.hypot(point.x - me.x, point.z - me.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { id: room.id, point };
      }
    }
    return best;
  }

  private claimSwitch(bot: CrewMember): string {
    const humanNear = (id: string): boolean => {
      const target = INTERACT_BY_ID.get(id);
      if (!target) return false;
      const botIds = new Set(this.members.map((m) => m.id));
      for (const [, player] of this.sim.players) {
        if (botIds.has(player.id) || player.status !== 'alive') continue;
        if (Math.hypot(player.x - target.x, player.z - target.z) < 6) return true;
      }
      return false;
    };
    const takenByBot = new Set(this.members.filter((m) => m.id !== bot.id).map((m) => m.claimedSwitch));
    for (const id of ['mainA', 'mainB']) {
      if (!takenByBot.has(id) && !humanNear(id)) return id;
    }
    return takenByBot.has('mainA') ? 'mainB' : 'mainA';
  }

  private claimedByAnotherBot(bot: CrewMember, id: string): boolean {
    return this.members.some((other) => other.id !== bot.id && other.holding === id);
  }

  private callout(bot: CrewMember, text: string): void {
    if (bot.calloutCooldown > 0 || bot.lastCallout === text) return;
    bot.calloutCooldown = 4 + this.random() * 4;
    bot.lastCallout = text;
    this.sim.pushCrewCallout(bot.id, text);
  }
}

function shortestAngle(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
