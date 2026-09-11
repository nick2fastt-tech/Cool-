import { describe, expect, it } from 'vitest';
import { CrewAI } from '../src/mp/crewAI';
import { LocalHost } from '../src/mp/localHost';
import { MatchSim } from '../src/mp/matchSim';
import { PROTOCOL_VERSION, type LobbyState, type MatchSnapshot, type ServerMessage } from '../src/net/protocol';
import { ROOMS } from '../src/mp/map';

/**
 * AI teammates, and the in-page host that lets you play co-op with them
 * without a server.
 *
 * The bots are driven through `sim.applyInput` and `sim.setInteract` - the
 * same validated path a human client uses - so these tests are also a test of
 * that path being usable by something other than a phone.
 */

function crewMatch(options: { bots: number; humans?: number; aiLevel?: number; mode?: 'coop-survival' | 'free-roam'; power?: number }) {
  const humans = options.humans ?? 1;
  const sim = new MatchSim({
    seed: 4242,
    difficulty: 'standard',
    mode: options.mode ?? 'coop-survival',
    aiLevel: options.aiLevel ?? 1,
    ...(options.power !== undefined ? { startPower: options.power } : {}),
    players: Array.from({ length: humans }, (_, i) => ({ id: `human${i}`, name: `HUMAN${i}` })),
  });
  const botIds: string[] = [];
  for (let i = 0; i < options.bots; i++) {
    const id = `bot-${i}`;
    sim.addPlayer(id, `CREW${i}`, true);
    botIds.push(id);
  }
  let seed = 99;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const crew = new CrewAI(sim, botIds, random);
  const run = (seconds: number) => {
    const step = 1 / 30;
    for (let i = 0; i < Math.round(seconds / step); i++) {
      crew.step(step);
      sim.step(step);
      if (sim.finished) break;
    }
  };
  return { sim, crew, botIds, run };
}

describe('AI teammates', () => {
  it('actually walk the building instead of standing at spawn', () => {
    const { sim, botIds, run } = crewMatch({ bots: 3 });
    const start = botIds.map((id) => ({ ...sim.players.get(id)! }));
    run(20);
    const moved = botIds.map((id, i) => {
      const now = sim.players.get(id)!;
      return Math.hypot(now.x - start[i].x, now.z - start[i].z);
    });
    expect(moved.every((d) => d > 1)).toBe(true);
    // And they stay inside the building, because they move like a client does.
    for (const id of botIds) {
      const bot = sim.players.get(id)!;
      expect(Math.abs(bot.x)).toBeLessThan(24);
      expect(Math.abs(bot.z)).toBeLessThan(21);
    }
  });

  it('come and pick you up when you go down', () => {
    const { sim, run } = crewMatch({ bots: 2 });
    const human = sim.players.get('human0')!;
    human.status = 'downed';
    human.bleedOut = 60;

    run(45);
    expect(sim.players.get('human0')!.status).toBe('alive');
  });

  it('restore the power on their own when the grid dies', () => {
    // A blackout with nobody but the AI crew to fix it. This is the whole
    // restoration chain - generator, three fuses from three corners of the
    // map, three breakers, then two switches held together in two rooms.
    const { sim, crew } = crewMatch({ bots: 3, power: 1 });
    const steps: string[] = [];
    let restoredAt = -1;
    let restoredPower = 0;

    const dt = 1 / 30;
    for (let t = 0; t < 30 * 240 && restoredAt < 0; t++) {
      crew.step(dt);
      sim.step(dt);
      const step = sim.snapshot().obj.step;
      if (steps[steps.length - 1] !== step) steps.push(step);
      if (t > 60 && !sim.blackout) {
        restoredAt = t / 30;
        restoredPower = sim.power;
      }
    }

    // A restore only buys a minute or so, so what matters is that they got
    // there at all - not the state of the grid at some arbitrary later moment.
    expect(restoredAt).toBeGreaterThan(0);
    expect(restoredPower).toBeGreaterThan(20);
    // ...and that they did it by working the chain, not by some shortcut.
    expect(steps).toEqual([
      'none', 'findElectrical', 'generator', 'fuses', 'breakers', 'mainSwitch', 'spinUp', 'none',
    ]);
  }, 30000);

  it('get out of the way when something is coming for them', () => {
    const { sim, crew, botIds } = crewMatch({ bots: 1, aiLevel: 1 });
    const bot = sim.players.get(botIds[0])!;
    const bear = sim.bots.find((b) => b.id === 'bear')!;
    // Put the bear right on top of them, in the open.
    bot.x = 0;
    bot.z = -8;
    bear.x = 1.5;
    bear.z = -8;
    const before = Math.hypot(bear.x - bot.x, bear.z - bot.z);

    for (let i = 0; i < 30 * 4; i++) {
      crew.step(1 / 30);
      // Hold the animatronic still: this is a test of the bot's reaction, not
      // of whether it can outrun a chase.
      bear.x = 1.5;
      bear.z = -8;
      sim.step(1 / 30);
    }
    const after = Math.hypot(bear.x - bot.x, bear.z - bot.z);
    expect(after).toBeGreaterThan(before + 2);
  });

  it('fan out and explore in free roam', () => {
    const { sim, run } = crewMatch({ bots: 3, mode: 'free-roam' });
    run(10);
    const early = sim.exploredRooms.length;
    run(120);
    expect(sim.exploredRooms.length).toBeGreaterThan(early + 2);
    expect(sim.exploredRooms.length).toBeLessThanOrEqual(ROOMS.length);
  }, 30000);

  it('call out what they are doing', () => {
    const { sim, run } = crewMatch({ bots: 2, power: 1 });
    run(30);
    // Events are drained by the room each tick in a real match; here we just
    // look at what has accumulated.
    const events = sim.drainEvents();
    const callouts = events.filter((e) => e.e === 'crew');
    expect(callouts.length).toBeGreaterThan(0);
    expect((callouts[0] as { text: string }).text.length).toBeGreaterThan(0);
  });

  it('are not a win condition on their own', () => {
    const { sim, run } = crewMatch({ bots: 3 });
    const human = sim.players.get('human0')!;
    human.status = 'eliminated';
    run(2);
    expect(sim.finished).toEqual({ win: false, reason: 'Every guard was taken.' });
  });

  it('do not stop a real player from taking a seat', () => {
    // Bots fill what humans have not: the cap counts people first.
    const { sim } = crewMatch({ bots: 3, humans: 2 });
    expect(sim.humanCount).toBe(2);
    expect(sim.players.size).toBe(5); // the sim itself does not cap; the room does
  });
});

describe('the host that runs inside the page', () => {
  /** Drive the in-page host exactly as the browser client does. */
  function localSession() {
    const received: ServerMessage[] = [];
    const host = new LocalHost((message) => received.push(message));
    const state = {
      lobby: (): LobbyState | undefined => [...received].reverse().find((m) => m.t === 'lobby')?.state,
      snapshot: (): MatchSnapshot | undefined => [...received].reverse().find((m): m is MatchSnapshot => m.t === 'snap'),
      received,
    };
    return { host, ...state };
  }

  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 30));

  it('hosts a real lobby with no network at all', async () => {
    const session = localSession();
    session.host.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'SOLO' });
    await settle();
    expect(session.received.some((m) => m.t === 'welcome')).toBe(true);

    session.host.send({ t: 'host', settings: { bots: 3, requireReady: false, isPublic: false } });
    await settle();
    const lobby = session.lobby();
    expect(lobby?.code).toMatch(/^DEPOT-[A-Z2-9]{4}$/);
    // One person, three AI teammates listed alongside them.
    expect(lobby?.players.filter((p) => p.isBot)).toHaveLength(3);
    expect(lobby?.players.filter((p) => !p.isBot)).toHaveLength(1);
    session.host.close();
  });

  it('runs a full match locally, with the bots in it', async () => {
    const session = localSession();
    session.host.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'SOLO' });
    session.host.send({ t: 'host', settings: { bots: 2, requireReady: false, isPublic: false } });
    await settle();
    session.host.send({ t: 'start' });
    await new Promise<void>((resolve) => setTimeout(resolve, 900));

    const snapshot = session.snapshot();
    expect(snapshot).toBeTruthy();
    expect(snapshot!.players).toHaveLength(3); // one human, two bots
    expect(snapshot!.bots).toHaveLength(4);    // and the four animatronics
    expect(snapshot!.k).toBeGreaterThan(5);    // the match loop is really running

    // The world is live: the animatronics patrol whether or not anybody moves.
    // (The crew bots gather around an idle human and stand there, correctly.)
    const first = snapshot!.bots.map((b) => `${b.x},${b.z}`).join('|');
    const firstTick = snapshot!.k;
    await new Promise<void>((resolve) => setTimeout(resolve, 900));
    const after = session.snapshot()!;
    expect(after.bots.map((b) => `${b.x},${b.z}`).join('|')).not.toBe(first);
    expect(after.k).toBeGreaterThan(firstTick);

    session.host.close();
  }, 15000);

  it('stops cleanly and delivers nothing afterwards', async () => {
    const session = localSession();
    session.host.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'SOLO' });
    session.host.send({ t: 'host', settings: { bots: 1, requireReady: false } });
    await settle();
    session.host.close();
    const count = session.received.length;
    session.host.send({ t: 'start' });
    await settle();
    expect(session.received.length).toBe(count);
  });
});
