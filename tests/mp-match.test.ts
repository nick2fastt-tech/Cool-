import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, type ServerHandle } from '../server/main';
import { TestClient, sleep } from './mpClient';
import { MatchSim } from '../src/mp/matchSim';
import { INTERACT_BY_ID, ROOMS, hasLineOfSight } from '../src/mp/map';
import type { Room } from '../server/room';

/**
 * Match behaviour: downs, revives, elimination, the power-restoration chain
 * and target selection.
 *
 * Where a condition is hard to reach by playing (an animatronic happening to
 * corner someone), the *server's* simulation is nudged directly and the
 * assertions are then made on what the CLIENTS receive. Nudging the server is
 * not the same as faking the feature: the AI, the revive timer and the
 * objective chain all run for real, and the test only decides where everyone
 * is standing when they do.
 */

let server: ServerHandle;
const open: TestClient[] = [];

async function client(name: string): Promise<TestClient> {
  const c = new TestClient(name);
  await c.connect(server.port);
  await c.hello();
  open.push(c);
  return c;
}

/** Host a room with two clients and start the match. Returns everything. */
async function twoPlayerMatch(
  label: string,
  aiLevel = 1,
  extra: Partial<{ mode: 'coop-survival' | 'free-roam' }> = {},
): Promise<{ host: TestClient; guest: TestClient; room: Room }> {
  const host = await client(`${label}_H`);
  host.send({ t: 'host', settings: { requireReady: false, aiLevel, ...extra } });
  await host.waitFor((m) => m.t === 'lobby');
  const code = host.lastLobby!.code;
  const guest = await client(`${label}_G`);
  guest.send({ t: 'join', code });
  await guest.waitFor((m) => m.t === 'lobby');
  host.send({ t: 'start' });
  await Promise.all([host.waitFor((m) => m.t === 'matchStart'), guest.waitFor((m) => m.t === 'matchStart')]);
  await host.waitUntil(() => !!host.lastSnapshot, 3000, 'snapshots');
  await guest.waitUntil(() => !!guest.lastSnapshot, 3000, 'snapshots');
  return { host, guest, room: server.rooms.get(code)! };
}

beforeAll(async () => {
  server = await startServer({ port: 0, staticDir: 'dist' });
});

afterAll(async () => {
  for (const c of open) c.terminate();
  await server.close();
});

describe('being caught, and being rescued', () => {
  it('an animatronic that reaches a player downs them, and both clients see it', async () => {
    const { host, guest, room } = await twoPlayerMatch('DOWN', 20);
    const sim = room.sim!;

    // Put the bear on top of the host. The chase, the attack decision and the
    // consequences are all the real code path.
    const victim = sim.players.get(host.id)!;
    const bear = sim.bots.find((b) => b.id === 'bear')!;
    bear.x = victim.x + 0.8;
    bear.z = victim.z;
    bear.attackCooldown = 0;
    bear.thinkTimer = 0;

    await guest.waitUntil(
      () => guest.lastSnapshot?.players.find((p) => p.id === host.id)?.s === 1,
      6000,
      'the other client sees the down',
    );
    const seenByHost = host.lastSnapshot!.players.find((p) => p.id === host.id)!;
    expect(seenByHost.s).toBe(1);

    const downEvent = guest.received.find(
      (m) => m.t === 'events' && m.list.some((e) => e.e === 'down' && e.player === host.id),
    );
    expect(downEvent).toBeTruthy();

    // A downed player's inputs are ignored entirely.
    const before = { ...sim.players.get(host.id)! };
    await host.move(0.5, 0, -1);
    const after = sim.players.get(host.id)!;
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(0.05);

    room.dispose();
    server.rooms.delete(room.code);
  });

  it('a teammate standing over you can bring you back', async () => {
    const { host, guest, room } = await twoPlayerMatch('REVIVE');
    const sim = room.sim!;
    const victim = sim.players.get(host.id)!;
    victim.status = 'downed';
    victim.bleedOut = 45;

    const rescuer = sim.players.get(guest.id)!;
    rescuer.x = victim.x + 1;
    rescuer.z = victim.z;

    // Wait for the down to actually reach the clients first - otherwise the
    // check below passes against a snapshot taken before the down happened.
    await guest.waitUntil(
      () => guest.lastSnapshot?.players.find((p) => p.id === host.id)?.s === 1,
      5000,
      'down is visible',
    );

    guest.send({ t: 'revive', target: host.id, held: true });
    await host.waitUntil(
      () => host.lastSnapshot?.players.find((p) => p.id === host.id)?.s === 0,
      20000,
      'revived',
    );
    const revivedEvent = host.received.find(
      (m) => m.t === 'events' && m.list.some((e) => e.e === 'revived' && e.player === host.id),
    );
    expect(revivedEvent).toBeTruthy();

    room.dispose();
    server.rooms.delete(room.code);
  }, 30000);

  it('a revive from across the room is refused', async () => {
    const { host, guest, room } = await twoPlayerMatch('RANGE');
    const sim = room.sim!;
    const victim = sim.players.get(host.id)!;
    victim.status = 'downed';
    victim.bleedOut = 45;
    const rescuer = sim.players.get(guest.id)!;
    rescuer.x = victim.x + 12;

    guest.send({ t: 'revive', target: host.id, held: true });
    await sleep(600);
    expect(sim.players.get(guest.id)!.reviving).toBeNull();
    expect(sim.players.get(host.id)!.status).toBe('downed');

    room.dispose();
    server.rooms.delete(room.code);
  });

  it('nobody comes for you and you bleed out', async () => {
    const { host, guest, room } = await twoPlayerMatch('BLEED');
    const sim = room.sim!;
    const victim = sim.players.get(host.id)!;
    victim.status = 'downed';
    victim.bleedOut = 0.6;

    await guest.waitUntil(
      () => guest.lastSnapshot?.players.find((p) => p.id === host.id)?.s === 2,
      6000,
      'eliminated',
    );
    const event = guest.received.find(
      (m) => m.t === 'events' && m.list.some((e) => e.e === 'eliminated' && e.player === host.id),
    );
    expect(event).toBeTruthy();

    room.dispose();
    server.rooms.delete(room.code);
  });

  it('losing the whole crew ends the match for everyone', async () => {
    const { host, guest, room } = await twoPlayerMatch('WIPE');
    const sim = room.sim!;
    for (const [, player] of sim.players) {
      player.status = 'downed';
      player.bleedOut = 0.4;
    }
    const ending = await guest.waitFor((m) => m.t === 'matchEnd', 8000);
    expect((ending as { win: boolean }).win).toBe(false);
    await host.waitFor((m) => m.t === 'matchEnd', 4000);

    room.dispose();
    server.rooms.delete(room.code);
  });
});

describe('power restoration as a shared objective', () => {
  it('runs the whole chain, and every step is visible to both clients', async () => {
    const { host, guest, room } = await twoPlayerMatch('CHAIN');
    const sim = room.sim!;
    sim.power = 0.01;
    await guest.waitUntil(() => guest.lastSnapshot?.blackout === true, 4000, 'blackout reaches the client');
    expect(host.lastSnapshot!.blackout).toBe(true);
    expect(guest.lastSnapshot!.obj.step).toBe('findElectrical');

    /** Stand a player next to a fixture and hold it until the step moves on. */
    const useUntil = async (who: TestClient, id: string, done: () => boolean, timeout = 9000): Promise<void> => {
      const def = INTERACT_BY_ID.get(id)!;
      const player = sim.players.get(who.id)!;
      player.x = def.x + 0.5;
      player.z = def.z;
      who.send({ t: 'interact', id, held: true });
      const deadline = Date.now() + timeout;
      while (!done()) {
        if (Date.now() > deadline) throw new Error(`timed out using ${id}`);
        await sleep(60);
      }
      who.send({ t: 'interact', id: '', held: false });
    };

    // Walking into the electrical room is itself the first step.
    const host1 = sim.players.get(host.id)!;
    host1.x = -20;
    host1.z = -2;
    await guest.waitUntil(() => guest.lastSnapshot?.obj.step === 'generator', 5000, 'arrival advances the step');

    await useUntil(host, 'gen', () => sim.snapshot().obj.step === 'fuses');
    await guest.waitUntil(() => guest.lastSnapshot?.obj.step === 'fuses', 4000, 'guest sees the generator step');

    // Three fuses, fetched and fitted - one of them by the other player, so the
    // test also covers two clients working the same objective.
    for (const [carrier, fuseId] of [[host, 'fuseA'], [guest, 'fuseB'], [host, 'fuseC']] as const) {
      const before = sim.snapshot().obj.label;
      await useUntil(carrier, fuseId, () => sim.players.get(carrier.id)!.carrying === fuseId);
      await useUntil(carrier, 'panel', () => sim.snapshot().obj.label !== before);
    }
    await guest.waitUntil(() => guest.lastSnapshot?.obj.step === 'breakers', 6000, 'fuses complete');

    for (const breaker of ['brk1', 'brk2', 'brk3']) {
      await useUntil(host, breaker, () => sim.snapshot().ints[breaker] === 1);
    }
    await guest.waitUntil(() => guest.lastSnapshot?.obj.step === 'mainSwitch', 6000, 'breakers complete');

    // The last step needs two people at once, in two different rooms.
    const a = INTERACT_BY_ID.get('mainA')!;
    const b = INTERACT_BY_ID.get('mainB')!;
    Object.assign(sim.players.get(host.id)!, { x: a.x + 0.4, z: a.z });
    Object.assign(sim.players.get(guest.id)!, { x: b.x + 0.4, z: b.z });

    // One switch alone is not enough.
    host.send({ t: 'interact', id: 'mainA', held: true });
    await sleep(1200);
    expect(sim.snapshot().obj.step).toBe('mainSwitch');

    guest.send({ t: 'interact', id: 'mainB', held: true });
    await guest.waitUntil(() => guest.lastSnapshot?.obj.step === 'spinUp', 8000, 'both switches together');
    host.send({ t: 'interact', id: '', held: false });
    guest.send({ t: 'interact', id: '', held: false });

    await guest.waitUntil(() => guest.lastSnapshot?.blackout === false, 15000, 'power comes back');
    expect(host.lastSnapshot!.blackout).toBe(false);
    expect(host.lastSnapshot!.power).toBeGreaterThan(20);
    expect(guest.lastSnapshot!.power).toBeCloseTo(host.lastSnapshot!.power, 0);

    room.dispose();
    server.rooms.delete(room.code);
  }, 60000);

  it('a fuse carried by someone who drops out goes back on the map', async () => {
    const { host, guest, room } = await twoPlayerMatch('DROP');
    const sim = room.sim!;
    sim.power = 0.01;
    await sleep(200);
    const gen = INTERACT_BY_ID.get('gen')!;
    Object.assign(sim.players.get(guest.id)!, { x: gen.x + 0.4, z: gen.z });
    guest.send({ t: 'interact', id: 'gen', held: true });
    await guest.waitUntil(() => guest.lastSnapshot?.obj.step === 'fuses', 9000, 'fuses step');

    const fuse = INTERACT_BY_ID.get('fuseA')!;
    Object.assign(sim.players.get(guest.id)!, { x: fuse.x + 0.4, z: fuse.z });
    guest.send({ t: 'interact', id: 'fuseA', held: true });
    await guest.waitUntil(() => sim.players.get(guest.id)?.carrying === 'fuseA', 5000, 'fuse picked up');
    await host.waitUntil(() => host.lastSnapshot?.ints.fuseA === 0, 5000, 'the crate empties for everyone');

    guest.terminate();
    await host.waitUntil(() => host.lastSnapshot?.ints.fuseA === 1, 8000, 'the fuse comes back');

    room.dispose();
    server.rooms.delete(room.code);
  }, 40000);
});

describe('animatronic behaviour in co-op', () => {
  const twoPlayers = () =>
    new MatchSim({
      seed: 5,
      difficulty: 'standard',
      aiLevel: 12,
      players: [{ id: 'near', name: 'NEAR' }, { id: 'far', name: 'FAR' }],
    });

  it('does not simply lock on to whoever is closest', () => {
    // A silent player right next to the rabbit, and a sprinting one across the
    // dining hall. Noise should be able to win that contest.
    const sim = twoPlayers();
    const rabbit = sim.bots.find((b) => b.id === 'rabbit')!;
    const near = sim.players.get('near')!;
    const far = sim.players.get('far')!;
    near.x = rabbit.x + 1.5;
    near.z = rabbit.z;
    near.noise = 0;
    far.x = rabbit.x + 9;
    far.z = rabbit.z + 1;
    far.noise = 1;

    let chasedFar = 0;
    for (let i = 0; i < 40; i++) {
      rabbit.thinkTimer = 0;
      far.noise = 1;
      near.noise = 0;
      sim.step(1 / 30);
      if (rabbit.target === 'far') chasedFar++;
    }
    expect(chasedFar).toBeGreaterThan(0);
  });

  it('investigates a noise it cannot see rather than ignoring it', () => {
    const sim = twoPlayers();
    const hen = sim.bots.find((b) => b.id === 'hen')!;
    const noisy = sim.players.get('far')!;
    // Behind a wall in the next room along - audible, but not visible. Noise
    // deliberately does not carry across the entire building.
    noisy.x = hen.x - 4;
    noisy.z = hen.z + 9;
    sim.players.get('near')!.x = 0;
    sim.players.get('near')!.z = 6;
    expect(hasLineOfSight(hen.x, hen.z, noisy.x, noisy.z)).toBe(false);

    let investigated = false;
    for (let i = 0; i < 200; i++) {
      noisy.noise = 1;
      hen.thinkTimer = 0;
      sim.step(1 / 30);
      if (hen.state === 'investigate' || hen.target === 'far') investigated = true;
    }
    expect(investigated).toBe(true);
  });

  it('a caught player is not instantly caught again', () => {
    const sim = twoPlayers();
    const bear = sim.bots.find((b) => b.id === 'bear')!;
    const victim = sim.players.get('near')!;
    bear.x = victim.x + 0.5;
    bear.z = victim.z;
    bear.attackCooldown = 0;
    bear.thinkTimer = 0;
    for (let i = 0; i < 30 * 3; i++) sim.step(1 / 30);
    expect(victim.status).toBe('downed');
    // It backs off rather than camping the body: a long attack cooldown, and
    // its attention has moved off the player it just downed.
    expect(bear.attackCooldown).toBeGreaterThan(4);
    expect(bear.target).not.toBe('near');
  });

  it('the torch is a resource, not a light switch', () => {
    // Aggression 0: this test is about the battery, and a player who gets
    // downed halfway through stops draining it.
    const sim = new MatchSim({
      seed: 5,
      difficulty: 'standard',
      aiLevel: 0,
      players: [{ id: 'near', name: 'NEAR' }, { id: 'far', name: 'FAR' }],
    });
    const player = sim.players.get('near')!;
    const seconds = 60; // a full charge is ~53s of light
    for (let i = 0; i < 30 * seconds; i++) {
      sim.applyInput('near', {
        seq: i + 1, mx: 0, mz: 0, yaw: 0, sprint: false, crouch: false, flashlight: true, dt: 1 / 30,
      });
      sim.step(1 / 30);
    }
    expect(player.status).toBe('alive');
    expect(player.battery).toBeLessThan(1);
    expect(player.flashlight).toBe(false);

    // And it stays off until there is a real charge behind it, rather than
    // strobing as the trickle regen crosses zero.
    for (let i = 0; i < 30; i++) {
      sim.applyInput('near', {
        seq: 30 * seconds + i + 1, mx: 0, mz: 0, yaw: 0, sprint: false, crouch: false, flashlight: true, dt: 1 / 30,
      });
      sim.step(1 / 30);
      expect(player.flashlight).toBe(false);
    }
  });
});

describe('free roam mode', () => {
  const freeRoamSim = (aiLevel = 10) =>
    new MatchSim({
      seed: 11,
      mode: 'free-roam',
      difficulty: 'standard',
      aiLevel,
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    });

  it('leaves the grid alone - the building is not the threat here', () => {
    // Aggression 0: this test is about the grid and the clock, and a crew that
    // gets wiped would end the match for an unrelated reason.
    const sim = freeRoamSim(0);
    // Well past a full six-hour shift.
    for (let i = 0; i < 30 * 400; i++) sim.step(1 / 30);
    expect(sim.power).toBe(100);
    expect(sim.blackout).toBe(false);
    // The clock reaches 6 AM and keeps going: free roam does not end there the
    // way a survival shift does.
    expect(sim.hour).toBe(6);
    expect(sim.finished).toBeNull();
  });

  it('credits a room the moment somebody stands in it', () => {
    const sim = freeRoamSim(1);
    const player = sim.players.get('a')!;
    sim.step(1 / 30);
    const startCount = sim.exploredRooms.length;
    expect(sim.exploredRooms).toContain('office');

    player.x = 0;
    player.z = -8; // dining hall
    sim.step(1 / 30);
    expect(sim.exploredRooms).toContain('dining');
    expect(sim.exploredRooms.length).toBe(startCount + 1);

    // Standing there longer does not credit it twice.
    for (let i = 0; i < 30; i++) sim.step(1 / 30);
    expect(sim.exploredRooms.length).toBe(startCount + 1);
  });

  it('gets more dangerous the further and longer you go', () => {
    const early = freeRoamSim();
    early.step(1 / 30);
    const earlyLabel = early.snapshot().obj.detail;

    const late = freeRoamSim();
    const player = late.players.get('a')!;
    for (const room of ROOMS) {
      player.x = (room.rect.x1 + room.rect.x2) / 2;
      player.z = (room.rect.z1 + room.rect.z2) / 2;
      late.step(1 / 30);
    }
    for (let i = 0; i < 30 * 90; i++) late.step(1 / 30);
    const lateLabel = late.snapshot().obj.detail;

    const value = (text: string) => Number(text.replace(/[^0-9.]/g, ''));
    expect(value(lateLabel)).toBeGreaterThan(value(earlyLabel));
    expect(value(lateLabel)).toBeLessThanOrEqual(2.4);
  });

  it('walking the whole building is the win, and both clients get it', async () => {
    const { host, guest, room } = await twoPlayerMatch('ROAM', 1, { mode: 'free-roam' });
    const sim = room.sim!;
    expect(sim.mode).toBe('free-roam');

    await guest.waitUntil(
      () => (guest.lastSnapshot?.obj.label ?? '').startsWith('EXPLORE THE DEPOT'),
      4000,
      'the free roam objective reaches the client',
    );

    // Walk the crew through every room. The rule under test is the sim's, so
    // placing them is fair game; the assertion is on what the clients receive.
    const player = sim.players.get(host.id)!;
    for (const roomDef of ROOMS) {
      // Only living players credit a room, and this test is about exploration
      // rather than survival - so if the cast catches them on the way round,
      // put them back on their feet and carry on.
      if (player.status !== 'alive') {
        player.status = 'alive';
        player.bleedOut = 0;
      }
      player.x = (roomDef.rect.x1 + roomDef.rect.x2) / 2;
      player.z = (roomDef.rect.z1 + roomDef.rect.z2) / 2;
      await sleep(70);
    }

    const ending = await guest.waitFor((m) => m.t === 'matchEnd', 8000);
    expect((ending as { win: boolean }).win).toBe(true);
    await host.waitFor((m) => m.t === 'matchEnd', 4000);

    room.dispose();
    server.rooms.delete(room.code);
  }, 30000);

  it('a mode that is not implemented is refused by the server', async () => {
    const host = await client('MODEHOST');
    host.send({ t: 'host', settings: { mode: 'objective' as never, requireReady: false } });
    await host.waitFor((m) => m.t === 'lobby');
    // Falls back to the default rather than starting something that does not exist.
    expect(host.lastLobby!.settings.mode).toBe('coop-survival');

    host.send({ t: 'setSettings', settings: { mode: 'night-survival' as never } });
    await sleep(250);
    expect(host.lastLobby!.settings.mode).toBe('coop-survival');

    // ...but free roam is accepted, because it exists.
    host.send({ t: 'setSettings', settings: { mode: 'free-roam' } });
    await host.waitUntil(() => host.lastLobby?.settings.mode === 'free-roam', 3000, 'free roam accepted');
  });
});
