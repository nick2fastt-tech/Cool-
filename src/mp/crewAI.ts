import {
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
}

const NAMES = ['RILEY', 'SAM', 'JUNO', 'MAX', 'CASS', 'DEV', 'ARI', 'NOOR'];

/** Distance at which a bot notices an animatronic it cannot see. */
const HEARING = 7;

export function crewBotName(index: number): string {
  return NAMES[index % NAMES.length];
}

export class CrewAI {
  private readonly members: CrewMember[] = [];

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
  debug(): { id: string; intent: CrewIntent; holding: string | null; path: number; step: number; calm: number }[] {
    return this.members.map((m) => ({
      id: m.id,
      intent: m.intent,
      holding: m.holding,
      path: m.path.length,
      step: m.pathIndex,
      calm: Math.round(m.calm),
    }));
  }

  step(dt: number): void {
    for (const bot of this.members) {
      const player = this.sim.players.get(bot.id);
      if (!player) continue;
      bot.calloutCooldown = Math.max(0, bot.calloutCooldown - dt);
      bot.fleeUntil = Math.max(0, bot.fleeUntil - dt);
      bot.calm = Math.max(0, bot.calm - dt);

      if (player.status !== 'alive') {
        // Downed or gone: drop everything and stop sending input.
        this.release(bot);
        bot.intent = 'idle';
        continue;
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
    // The distinction that matters: an animatronic actually hunting you is
    // worth bolting from across a room, while one patrolling past at eight
    // metres is not. Without that, a bot spends the whole match flinching at
    // traffic and never finishes a job - which is both useless and nothing
    // like how a person plays.
    const threat = this.nearestThreat(bot);
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
      // Commit to the bolt briefly, so they do not dither on the threshold.
      bot.fleeUntil = 1.1 + this.random() * 0.8;
      // Having reacted once, give the same bystander a wide berth instead of
      // re-panicking at it on every think.
      if (!threat.hunting) bot.calm = 6 + this.random() * 4;
      bot.path = [];
      return;
    }
    if (bot.intent === 'flee' && bot.fleeUntil > 0) return;

    // 2. A teammate is down. Going for them is the whole point of a crew.
    const downed = this.nearestDowned(bot);
    if (downed && downed.distance < 30) {
      if (bot.intent !== 'revive') {
        this.callout(bot, `ON MY WAY TO ${downed.name}`);
        this.release(bot);
        bot.path = [];
      }
      bot.intent = 'revive';
      bot.goal = { x: downed.x, z: downed.z };
      return;
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
          this.moveTo(bot, target.x, target.z, dt, distance > 8);
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
        const distance = Math.hypot(leader.x - me.x, leader.z - me.z);
        if (distance < 3.2) {
          if (this.random() < 0.01) bot.pause = 0.5 + this.random();
          this.sendInput(bot, 0, 0, Math.atan2(leader.x - me.x, leader.z - me.z), false, dt);
          return;
        }
        this.moveTo(bot, leader.x, leader.z, dt, distance > 12);
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
      // The panel is only a target for whoever is actually carrying a fuse.
      .filter((item) => item.kind !== 'fusePanel' || me.carrying);
    if (!targets.length) {
      // Nothing to do on this step - stay close and out of the way.
      const leader = this.nearestHuman(bot);
      if (leader) this.moveTo(bot, leader.x, leader.z, dt, false);
      else this.sendInput(bot, 0, 0, me.yaw, false, dt);
      return;
    }

    let best = targets[0];
    let bestDistance = Infinity;
    for (const item of targets) {
      const distance = Math.hypot(item.x - me.x, item.z - me.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = item;
      }
    }
    const shout = best.kind === 'fuse' ? 'GOT A FUSE' : best.kind === 'breaker' ? 'BREAKER ON ME' : 'I HAVE THIS';
    this.useOrApproach(bot, best, dt, shout);
  }

  private useOrApproach(bot: CrewMember, target: Interactable, dt: number, shout?: string): void {
    const me = this.sim.players.get(bot.id);
    if (!me) return;
    const distance = Math.hypot(target.x - me.x, target.z - me.z);
    if (distance > INTERACT_RANGE - 0.5) {
      if (bot.holding) this.release(bot);
      this.moveTo(bot, target.x, target.z, dt, distance > 10);
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
    // Torch discipline: on when it is dark, off when the lights are up.
    const wantTorch = this.sim.blackout && me.battery > 6;
    bot.torch = wantTorch;
    this.sim.applyInput(bot.id, {
      seq: ++bot.seq,
      mx,
      mz,
      yaw,
      sprint,
      crouch: false,
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
      const score = fromThreat + differentRoom - fromMe * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = { x: node.x, z: node.z };
      }
    }
    return best;
  }

  private nearestDowned(bot: CrewMember): { id: string; name: string; x: number; z: number; distance: number } | null {
    const me = this.sim.players.get(bot.id);
    if (!me) return null;
    let best: { id: string; name: string; x: number; z: number; distance: number } | null = null;
    for (const [, player] of this.sim.players) {
      if (player.id === bot.id || player.status !== 'downed') continue;
      // Do not all pile onto the same casualty.
      if (this.members.some((other) => other.id !== bot.id && other.reviving === player.id)) continue;
      const distance = Math.hypot(player.x - me.x, player.z - me.z);
      if (!best || distance < best.distance) {
        best = { id: player.id, name: player.name, x: player.x, z: player.z, distance };
      }
    }
    return best;
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
