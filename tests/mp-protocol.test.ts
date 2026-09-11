import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, type ServerHandle } from '../server/main';
import { TestClient, sleep } from './mpClient';
import { MAX_PLAYERS, PROTOCOL_VERSION, normaliseCode } from '../src/net/protocol';

/**
 * Multi-client networking tests.
 *
 * Every test here opens real WebSockets to a real server instance. Nothing is
 * mocked or simulated in-process: if these pass, the wire protocol, the lobby,
 * host migration, reconnection and the authoritative match loop actually work
 * between separate clients.
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

beforeAll(async () => {
  server = await startServer({ port: 0, staticDir: 'dist' });
});

afterAll(async () => {
  for (const c of open) c.terminate();
  await server.close();
});

describe('lobby and join codes', () => {
  it('hosting creates a real room with a usable code', async () => {
    const host = await client('HOST');
    host.send({ t: 'host', settings: { maxPlayers: 4, isPublic: true } });
    const lobby = await host.waitFor((m) => m.t === 'lobby');
    const state = (lobby as { state: { code: string; players: unknown[]; hostId: string } }).state;

    expect(state.code).toMatch(/^DEPOT-[A-Z2-9]{4}$/);
    expect(state.players).toHaveLength(1);
    expect(state.hostId).toBe(host.id);
    expect(server.rooms.has(state.code)).toBe(true);
  });

  it('a second client joins with the code and both see each other', async () => {
    const host = await client('HOST2');
    host.send({ t: 'host', settings: {} });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;

    const guest = await client('GUEST');
    guest.send({ t: 'join', code });
    await guest.waitFor((m) => m.t === 'lobby');

    await host.waitUntil(() => (host.lastLobby?.players.length ?? 0) === 2, 3000, 'host sees 2 players');
    expect(guest.lastLobby!.players.map((p) => p.name).sort()).toEqual(['GUEST', 'HOST2']);
    expect(guest.lastLobby!.hostId).toBe(host.id);
    expect(guest.lastLobby!.players.find((p) => p.id === guest.id)!.isHost).toBe(false);
  });

  it('accepts sloppy code input and rejects nonsense', async () => {
    const host = await client('HOST3');
    host.send({ t: 'host', settings: {} });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;
    const short = code.replace('DEPOT-', '').toLowerCase();

    expect(normaliseCode(short)).toBe(code);
    expect(normaliseCode('  ' + short + ' ')).toBe(code);
    expect(normaliseCode('nope')).toBeNull();
    expect(normaliseCode('DEPOT-IIII')).toBeNull(); // I is not in the alphabet

    const guest = await client('GUEST3');
    guest.send({ t: 'join', code: short });
    await guest.waitFor((m) => m.t === 'lobby');
    expect(guest.lastLobby!.code).toBe(code);
  });

  it('reports the right error for every bad join', async () => {
    const bad = await client('BAD');
    bad.send({ t: 'join', code: 'not-a-code' });
    await bad.waitFor((m) => m.t === 'error' && m.code === 'INVALID_CODE');

    bad.send({ t: 'join', code: 'DEPOT-ZZZZ' });
    await bad.waitFor((m) => m.t === 'error' && m.code === 'ROOM_NOT_FOUND');
  });

  it('enforces the lobby capacity the host chose', async () => {
    const host = await client('CAPHOST');
    host.send({ t: 'host', settings: { maxPlayers: 2 } });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;

    const second = await client('CAP2');
    second.send({ t: 'join', code });
    await second.waitFor((m) => m.t === 'lobby');

    const third = await client('CAP3');
    third.send({ t: 'join', code });
    const err = await third.waitFor((m) => m.t === 'error');
    expect((err as { code: string }).code).toBe('ROOM_FULL');
    expect(host.lastLobby!.players).toHaveLength(2);
  });

  it('caps player count at the tested maximum however a client asks', async () => {
    const host = await client('GREEDY');
    host.send({ t: 'host', settings: { maxPlayers: 64 } });
    await host.waitFor((m) => m.t === 'lobby');
    expect(host.lastLobby!.settings.maxPlayers).toBe(MAX_PLAYERS);
  });

  it('quick join lands in an open public room, and says so when there is none', async () => {
    const lonely = await client('LONELY');
    lonely.send({ t: 'quickJoin' });
    // Other tests may have left public rooms open, so accept either outcome
    // but require it to be a real one.
    const reply = await lonely.waitFor((m) => m.t === 'lobby' || m.t === 'error');
    if (reply.t === 'lobby') {
      expect(reply.state.players.some((p) => p.id === lonely.id)).toBe(true);
    } else if (reply.t === 'error') {
      expect(reply.code).toBe('NO_PUBLIC_ROOMS');
    } else {
      throw new Error(`unexpected reply ${reply.t}`);
    }

    const host = await client('PUBHOST');
    host.send({ t: 'host', settings: { isPublic: true, maxPlayers: 4 } });
    await host.waitFor((m) => m.t === 'lobby');

    const seeker = await client('SEEKER');
    seeker.send({ t: 'quickJoin' });
    const joined = await seeker.waitFor((m) => m.t === 'lobby');
    expect((joined as { state: { players: unknown[] } }).state.players.length).toBeGreaterThanOrEqual(2);
  });

  it('private rooms stay out of the public list', async () => {
    const host = await client('PRIVATE');
    host.send({ t: 'host', settings: { isPublic: false } });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;

    const browser = await client('BROWSER');
    browser.send({ t: 'listPublic' });
    const list = await browser.waitFor((m) => m.t === 'public');
    const rooms = (list as { rooms: { code: string }[] }).rooms;
    expect(rooms.some((r) => r.code === code)).toBe(false);

    // ...but the code still works.
    browser.send({ t: 'join', code });
    await browser.waitFor((m) => m.t === 'lobby');
    expect(browser.lastLobby!.code).toBe(code);
  });
});

describe('ready gate and starting', () => {
  it('refuses to start until everyone is ready, then starts for all clients', async () => {
    const host = await client('RHOST');
    host.send({ t: 'host', settings: { requireReady: true } });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;

    const guest = await client('RGUEST');
    guest.send({ t: 'join', code });
    await guest.waitFor((m) => m.t === 'lobby');

    host.send({ t: 'start' });
    const refused = await host.waitFor((m) => m.t === 'error');
    expect((refused as { code: string }).code).toBe('NOT_READY');

    guest.send({ t: 'ready', ready: true });
    await host.waitUntil(
      () => !!host.lastLobby?.players.find((p) => p.id === guest.id)?.ready,
      3000,
      'ready propagates to the host',
    );

    host.send({ t: 'start' });
    await host.waitFor((m) => m.t === 'matchStart');
    await guest.waitFor((m) => m.t === 'matchStart');
    expect(host.lastLobby!.phase === 'match' || guest.lastLobby!.phase === 'match').toBe(true);

    server.rooms.get(code)?.dispose();
    server.rooms.delete(code);
  });

  it('only the host may start or change settings', async () => {
    const host = await client('AUTH');
    host.send({ t: 'host', settings: { requireReady: false } });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;

    const guest = await client('NOTHOST');
    guest.send({ t: 'join', code });
    await guest.waitFor((m) => m.t === 'lobby');

    guest.send({ t: 'start' });
    const e1 = await guest.waitFor((m) => m.t === 'error');
    expect((e1 as { code: string }).code).toBe('NOT_HOST');

    guest.send({ t: 'setSettings', settings: { difficulty: 'nightmare' } });
    const e2 = await guest.waitFor((m) => m.t === 'error' && (m as { code: string }).code === 'NOT_HOST');
    expect(e2).toBeTruthy();
    expect(host.lastLobby!.settings.difficulty).toBe('standard');

    host.send({ t: 'setSettings', settings: { difficulty: 'nightmare' } });
    await guest.waitUntil(() => guest.lastLobby?.settings.difficulty === 'nightmare', 3000, 'settings sync');
  });

  it('a client cannot join a match that has already ended', async () => {
    const host = await client('ENDHOST');
    host.send({ t: 'host', settings: { requireReady: false } });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;
    host.send({ t: 'start' });
    await host.waitFor((m) => m.t === 'matchStart');

    const room = server.rooms.get(code)!;
    room.phase = 'ended';
    const late = await client('LATE');
    late.send({ t: 'join', code });
    const err = await late.waitFor((m) => m.t === 'error');
    expect((err as { code: string }).code).toBe('ALREADY_STARTED');
    room.dispose();
    server.rooms.delete(code);
  });
});

describe('host migration and disconnects', () => {
  it('promotes another player when the host leaves', async () => {
    const host = await client('MIGHOST');
    host.send({ t: 'host', settings: {} });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;

    const a = await client('MIG_A');
    a.send({ t: 'join', code });
    await a.waitFor((m) => m.t === 'lobby');
    const b = await client('MIG_B');
    b.send({ t: 'join', code });
    await b.waitFor((m) => m.t === 'lobby');

    host.terminate();
    await a.waitUntil(() => a.lastLobby?.hostId === a.id, 4000, 'host migrated to the next player');
    expect(a.lastLobby!.players.find((p) => p.id === a.id)!.isHost).toBe(true);

    // The new host can actually exercise host powers.
    a.send({ t: 'setSettings', settings: { difficulty: 'relaxed' } });
    await b.waitUntil(() => b.lastLobby?.settings.difficulty === 'relaxed', 3000, 'new host controls settings');
  });

  it('cleans up a player who leaves and keeps the room alive', async () => {
    const host = await client('LEAVEHOST');
    host.send({ t: 'host', settings: {} });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;

    const guest = await client('LEAVER');
    guest.send({ t: 'join', code });
    await guest.waitFor((m) => m.t === 'lobby');
    await host.waitUntil(() => host.lastLobby?.players.length === 2, 3000, 'guest arrives');

    guest.send({ t: 'leave' });
    await host.waitUntil(() => host.lastLobby?.players.length === 1, 3000, 'guest is removed');
    expect(server.rooms.has(code)).toBe(true);
  });

  it('holds a dropped player\'s slot and lets them reclaim it', async () => {
    const host = await client('RECHOST');
    host.send({ t: 'host', settings: {} });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;

    const guest = await client('RECONNECTOR');
    guest.send({ t: 'join', code });
    await guest.waitFor((m) => m.t === 'lobby');
    const guestId = guest.id;
    const token = guest.resume;

    guest.terminate();
    await host.waitUntil(
      () => host.lastLobby?.players.find((p) => p.id === guestId)?.status === 'disconnected',
      3000,
      'slot held as disconnected',
    );
    expect(host.lastLobby!.players).toHaveLength(2);

    const back = new TestClient('RECONNECTOR');
    open.push(back);
    await back.connect(server.port);
    await back.hello(token);
    await back.waitUntil(() => back.lastLobby?.code === code, 3000, 'reattached to the same room');

    expect(back.id).toBe(guestId);
    // Crucially, no duplicate: still two players, not three.
    expect(back.lastLobby!.players).toHaveLength(2);
    expect(back.lastLobby!.players.find((p) => p.id === guestId)!.status).not.toBe('disconnected');
  });

  it('a stale socket closing later does not knock the reconnected player offline', async () => {
    const host = await client('RACEHOST');
    host.send({ t: 'host', settings: {} });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;

    const guest = await client('RACER');
    guest.send({ t: 'join', code });
    await guest.waitFor((m) => m.t === 'lobby');
    const guestId = guest.id;
    const token = guest.resume;

    // Reconnect FIRST, then let the old socket die - the order a browser
    // reload can produce.
    const back = new TestClient('RACER');
    open.push(back);
    await back.connect(server.port);
    guest.terminate();
    await back.hello(token);
    await back.waitUntil(() => back.lastLobby?.code === code, 4000, 'reattached');
    await sleep(400); // give the stale close every chance to land

    const room = server.rooms.get(code)!;
    const state = room.lobbyState();
    expect(state.players).toHaveLength(2);
    expect(state.players.find((p) => p.id === guestId)!.status).not.toBe('disconnected');
  });

  it('tells a client with a stale token instead of hanging', async () => {
    const stale = new TestClient('STALE');
    open.push(stale);
    await stale.connect(server.port);
    stale.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'STALE', resume: 'not-a-real-token' });
    await stale.waitFor((m) => m.t === 'error' && (m as { code: string }).code === 'RESUME_EXPIRED');
    // ...and still gets a working session.
    await stale.waitFor((m) => m.t === 'welcome');
    expect(stale.id).not.toBe('');
  });

  it('rejects a client on the wrong protocol version', async () => {
    const old = new TestClient('OLD');
    open.push(old);
    await old.connect(server.port);
    old.send({ t: 'hello', v: 1, name: 'OLD' });
    const err = await old.waitFor((m) => m.t === 'error');
    expect((err as { code: string }).code).toBe('BAD_VERSION');
  });
});

describe('authoritative match', () => {
  it('runs one shared simulation that every client sees identically', async () => {
    const host = await client('SIMHOST');
    host.send({ t: 'host', settings: { requireReady: false, difficulty: 'standard' } });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;

    const a = await client('SIM_A');
    a.send({ t: 'join', code });
    await a.waitFor((m) => m.t === 'lobby');
    const b = await client('SIM_B');
    b.send({ t: 'join', code });
    await b.waitFor((m) => m.t === 'lobby');

    host.send({ t: 'start' });
    await Promise.all([
      host.waitFor((m) => m.t === 'matchStart'),
      a.waitFor((m) => m.t === 'matchStart'),
      b.waitFor((m) => m.t === 'matchStart'),
    ]);

    await host.waitUntil(() => !!host.lastSnapshot, 3000, 'snapshots arrive');
    await a.waitUntil(() => !!a.lastSnapshot, 3000, 'snapshots arrive');
    await b.waitUntil(() => !!b.lastSnapshot, 3000, 'snapshots arrive');

    // Everybody sees all three players and all four animatronics.
    expect(host.lastSnapshot!.players).toHaveLength(3);
    expect(host.lastSnapshot!.bots).toHaveLength(4);
    expect(a.lastSnapshot!.players.map((p) => p.id).sort()).toEqual(
      host.lastSnapshot!.players.map((p) => p.id).sort(),
    );

    // One client moves; the OTHER clients are the ones that must see it.
    const before = b.lastSnapshot!.players.find((p) => p.id === a.id)!;
    await a.move(1.2, 0, -1);
    await sleep(200);
    const afterOnB = b.lastSnapshot!.players.find((p) => p.id === a.id)!;
    const afterOnHost = host.lastSnapshot!.players.find((p) => p.id === a.id)!;
    const travelled = Math.hypot(afterOnB.x - before.x, afterOnB.z - before.z);
    expect(travelled).toBeGreaterThan(1.5);
    expect(Math.hypot(afterOnB.x - afterOnHost.x, afterOnB.z - afterOnHost.z)).toBeLessThan(0.6);

    // Power is one shared number, not three.
    expect(a.lastSnapshot!.power).toBeCloseTo(host.lastSnapshot!.power, 0);
    expect(b.lastSnapshot!.power).toBeCloseTo(host.lastSnapshot!.power, 0);
    expect(host.lastSnapshot!.power).toBeLessThan(100);

    // The clock is the server's, and it is the same clock for everyone.
    expect(Math.abs(a.lastSnapshot!.ms - host.lastSnapshot!.ms)).toBeLessThan(400);

    server.rooms.get(code)?.dispose();
    server.rooms.delete(code);
  });

  it('will not let a client walk through walls or teleport', async () => {
    const host = await client('CHEATHOST');
    host.send({ t: 'host', settings: { requireReady: false } });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;
    host.send({ t: 'start' });
    await host.waitFor((m) => m.t === 'matchStart');
    await host.waitUntil(() => !!host.lastSnapshot, 3000, 'snapshot');

    const sim = server.rooms.get(code)!.sim!;
    const me = sim.players.get(host.id)!;
    const startX = me.x;

    // Ask for a colossal step: an inflated dt and a huge movement vector.
    for (let i = 0; i < 10; i++) {
      host.send({
        t: 'input',
        f: { seq: ++host.seq, mx: 0, mz: 40, yaw: 0, sprint: true, crouch: false, flashlight: false, dt: 30 },
      });
    }
    await sleep(300);
    const moved = Math.abs(sim.players.get(host.id)!.z - me.z);
    // Ten inputs, each clamped to 0.2s of sprinting, is about 9 metres of
    // travel at most - and the office wall stops it well before that.
    expect(moved).toBeLessThan(9);
    expect(Math.abs(sim.players.get(host.id)!.x - startX)).toBeLessThan(2);

    server.rooms.get(code)?.dispose();
    server.rooms.delete(code);
  });

  it('ignores stale and out-of-order input instead of rewinding the player', async () => {
    const host = await client('ORDERHOST');
    host.send({ t: 'host', settings: { requireReady: false } });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;
    host.send({ t: 'start' });
    await host.waitFor((m) => m.t === 'matchStart');
    const sim = server.rooms.get(code)!.sim!;

    await host.move(0.6, 0, -1);
    await sleep(150);
    const advanced = { ...sim.players.get(host.id)! };
    expect(advanced.lastSeq).toBeGreaterThan(0);

    // A late-arriving duplicate of an old frame, as a lossy link produces.
    host.send({
      t: 'input',
      f: { seq: 1, mx: 0, mz: 20, yaw: 0, sprint: true, crouch: false, flashlight: false, dt: 0.2 },
    });
    await sleep(200);
    const after = sim.players.get(host.id)!;
    expect(after.lastSeq).toBe(advanced.lastSeq);
    expect(Math.hypot(after.x - advanced.x, after.z - advanced.z)).toBeLessThan(0.05);

    server.rooms.get(code)?.dispose();
    server.rooms.delete(code);
  });

  it('survives a client that goes quiet and comes back', async () => {
    const host = await client('STALLHOST');
    host.send({ t: 'host', settings: { requireReady: false } });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;
    host.send({ t: 'start' });
    await host.waitFor((m) => m.t === 'matchStart');
    const sim = server.rooms.get(code)!.sim!;

    await host.move(0.4, 0, -1);
    const tickBefore = sim.tick;
    // Two seconds of total silence - a phone switching from wifi to cellular.
    await sleep(2000);
    expect(sim.tick).toBeGreaterThan(tickBefore + 40);
    expect(sim.players.get(host.id)!.status).toBe('alive');

    // And it picks straight back up without a jump.
    const resumed = { ...sim.players.get(host.id)! };
    await host.move(0.5, 0, -1);
    const moved = Math.hypot(sim.players.get(host.id)!.x - resumed.x, sim.players.get(host.id)!.z - resumed.z);
    expect(moved).toBeGreaterThan(0.3);
    expect(moved).toBeLessThan(4);

    server.rooms.get(code)?.dispose();
    server.rooms.delete(code);
  });

  it('throttles a burst without punishing the player for it', async () => {
    const flooder = await client('FLOOD');
    for (let i = 0; i < 300; i++) flooder.send({ t: 'listPublic' });
    await flooder.waitFor((m) => m.t === 'error' && (m as { code: string }).code === 'RATE_LIMITED', 5000);
    // A burst is throttled, not banned: the socket still works a second later.
    await sleep(1300);
    flooder.clear();
    flooder.send({ t: 'listPublic' });
    await flooder.waitFor((m) => m.t === 'public', 4000);
  });

  it('drops a socket that will not stop flooding', async () => {
    const abuser = await client('ABUSER');
    for (let i = 0; i < 3000; i++) abuser.send({ t: 'listPublic' });
    await abuser.waitUntil(() => abuser.closed, 6000, 'server closes the connection');
    expect(abuser.closed).toBe(true);
  });

  it('refuses an interaction the player is nowhere near', async () => {
    const host = await client('RANGEHOST');
    host.send({ t: 'host', settings: { requireReady: false } });
    await host.waitFor((m) => m.t === 'lobby');
    const code = host.lastLobby!.code;
    host.send({ t: 'start' });
    await host.waitFor((m) => m.t === 'matchStart');

    const room = server.rooms.get(code)!;
    const sim = room.sim!;
    sim.power = 0.01; // force a blackout on the next tick
    await sleep(200);
    expect(sim.blackout).toBe(true);

    // The player is in the office; the generator is across the map.
    host.send({ t: 'interact', id: 'gen', held: true });
    await sleep(200);
    expect(sim.players.get(host.id)!.holding).toBeNull();

    room.dispose();
    server.rooms.delete(code);
  });
});
