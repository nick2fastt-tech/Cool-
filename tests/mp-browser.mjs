/**
 * Multi-client browser test for co-op.
 *
 * Starts the real server, opens FOUR real Chromium clients against it, and
 * plays a match through the actual UI: host, join by code, ready up, start,
 * walk around, complete an objective step, drop a client, migrate the host,
 * and reconnect. Every assertion is made from a *different* client than the
 * one that caused the change, because that is the only thing that proves
 * synchronisation rather than local optimism.
 *
 * Run with: npm run smoke:mp
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const PORT = 4433;
const SHOTS = new URL('../artifacts/', import.meta.url).pathname;
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failures = 0;
const started = Date.now();
function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures++;
  const stamp = ((Date.now() - started) / 1000).toFixed(1).padStart(5);
  console.log(`${stamp}s  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
  return ok;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 12000, label = 'condition') {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await sleep(120);
  }
}

/* ---------------------------------------------------------------- server */

await mkdir(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['server-dist/server.mjs'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    STATIC_DIR: 'dist',
    // Test-only: start each match on a sliver of power so the blackout and the
    // restoration objective are reachable in seconds rather than minutes.
    HOLLOW_TEST_START_POWER: '8',
    // Keep the cast calm while movement and objectives are under test; the
    // hunting AI has its own tests in the protocol suite.
    HOLLOW_TEST_AI_LEVEL: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => console.log('[server]', String(d).trim()));
await waitFor(async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`);
    return res.ok;
  } catch {
    return false;
  }
}, 15000, 'server health');
check('server starts and serves the build', true);

/* --------------------------------------------------------------- clients */

const browser = await chromium.launch({
  executablePath: existsSync(CHROME) ? CHROME : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const errors = [];
async function makeClient(label) {
  // A separate context per client: separate localStorage, so resume tokens
  // and save files cannot leak between "devices".
  const context = await browser.newContext({
    viewport: { width: 900, height: 420 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    // Multiplayer unlocks after Night 1; these clients have already done that.
    localStorage.setItem('hollow-shift.save.v1', JSON.stringify({
      version: 1, nightsCompleted: 1, unlockedNight: 2, multiplayerUnlocked: true,
      seenHusk: false, stats: { nightsAttempted: 1, deaths: 0, blackoutsSurvived: 0, totalSeconds: 0 },
      settings: { quality: 'low', sensitivity: 1, buttonScale: 1, uiOpacity: 0.85, leftHanded: false,
        masterVolume: 0, sfxVolume: 0, classicPacing: false, haptics: false, subtitles: false },
    }));
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label}: ${m.text()}`));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hollow?.state() === 'menu', null, { timeout: 25000 });
  return { label, page, context };
}

const host = await makeClient('HOST');
const c2 = await makeClient('C2');
const c3 = await makeClient('C3');
const c4 = await makeClient('C4');
const all = [host, c2, c3, c4];
check('four independent clients boot', true);

const mp = (c) => c.page.evaluate(() => window.__hollowMp.state());
const lobbyOf = (c) => c.page.evaluate(() => window.__hollowMp.lobby());
const snapOf = (c) => c.page.evaluate(() => window.__hollowMp.snapshot());

/* ------------------------------------------------- host creates a lobby */

await host.page.locator('.menu-list .btn', { hasText: 'Co-op Shift' }).click();
await waitFor(() => mp(host).then((s) => s === 'mp-menu'), 10000, 'multiplayer menu');
await waitFor(
  () => host.page.evaluate(() => window.__hollowMp.connection() === 'online'),
  10000,
  'socket connects',
);
check('multiplayer menu connects to the server', true);
await host.page.screenshot({ path: SHOTS + 'mp-01-menu.png' });

await host.page.locator('.mp-host-btn').click();
await host.page.locator('.mp-create-btn').click();
const lobby = await waitFor(() => lobbyOf(host).then((l) => (l?.code ? l : null)), 10000, 'lobby created');
const code = lobby.code;
check('host game creates a real session with a code', /^DEPOT-[A-Z2-9]{4}$/.test(code), code);
await host.page.screenshot({ path: SHOTS + 'mp-02-lobby-host.png' });

/* ---------------------------------------------------- three clients join */

for (const client of [c2, c3, c4]) {
  await client.page.locator('.menu-list .btn', { hasText: 'Co-op Shift' }).click();
  await waitFor(() => mp(client).then((s) => s === 'mp-menu'), 10000, `${client.label} menu`);
  await client.page.locator('.mp-join-open-btn').click();
  await client.page.locator('.mp-code-input').fill(code);
  await client.page.locator('.mp-join-btn').click();
  await waitFor(() => lobbyOf(client).then((l) => l?.code === code), 10000, `${client.label} joins`);
}

for (const client of all) {
  const state = await lobbyOf(client);
  check(`${client.label} sees all four players in the lobby`, state.players.length === 4, `${state.players.length}/4`);
}
const hostView = await lobbyOf(c4);
check('every client agrees on who the host is', hostView.hostId === (await host.page.evaluate(() => window.__hollowMp.id())));
await c2.page.screenshot({ path: SHOTS + 'mp-03-lobby-client.png' });

/* --------------------------------------------------- a fifth is refused */

const c5 = await makeClient('C5');
await c5.page.locator('.menu-list .btn', { hasText: 'Co-op Shift' }).click();
await waitFor(() => mp(c5).then((s) => s === 'mp-menu'), 10000, 'c5 menu');
await c5.page.locator('.mp-join-open-btn').click();
await c5.page.locator('.mp-code-input').fill(code);
await c5.page.locator('.mp-join-btn').click();
await sleep(700);
const c5Lobby = await lobbyOf(c5);
check('a fifth player is refused by a full lobby', !c5Lobby, c5Lobby ? 'joined anyway' : 'LOBBY FULL');
await c5.context.close();

/* ------------------------------------------------------- ready and start */

await host.page.locator('.mp-start-btn').click();
await sleep(500);
check(
  'start is refused while players are not ready',
  await host.page.evaluate(() => window.__hollowMp.state() === 'mp-menu'),
);

for (const client of [c2, c3, c4]) {
  await client.page.locator('.mp-ready-btn').click();
}
await waitFor(
  () => lobbyOf(host).then((l) => l.players.filter((p) => p.ready).length >= 3),
  8000,
  'ready state reaches the host',
);
check('ready state replicates to the host', true);

await host.page.locator('.mp-start-btn').click();
for (const client of all) {
  await waitFor(() => mp(client).then((s) => s === 'mp-match'), 12000, `${client.label} enters the match`);
}
check('every client enters the match together', true);
await sleep(900);
await host.page.screenshot({ path: SHOTS + 'mp-04-match-host.png' });
await c2.page.screenshot({ path: SHOTS + 'mp-05-match-client.png' });

/* ------------------------------------------------ movement synchronises */

const beforeOnC3 = await c3.page.evaluate((id) => window.__hollowMp.remote(id), await host.page.evaluate(() => window.__hollowMp.id()));
const hostId = await host.page.evaluate(() => window.__hollowMp.id());

await host.page.evaluate(() => window.__hollowMp.setStick(0, -1)); // walk north
await sleep(1600);
await host.page.evaluate(() => window.__hollowMp.setStick(0, 0));
await sleep(500);

const afterOnC3 = await c3.page.evaluate((id) => window.__hollowMp.remote(id), hostId);
const afterOnC4 = await c4.page.evaluate((id) => window.__hollowMp.remote(id), hostId);
const hostSelf = await host.page.evaluate(() => window.__hollowMp.pos());
const travelled = Math.hypot(afterOnC3.x - beforeOnC3.x, afterOnC3.z - beforeOnC3.z);
check('one client walking is seen moving by the others', travelled > 1.2, `${travelled.toFixed(2)}m`);
check(
  'remote view agrees with the walking client',
  Math.hypot(afterOnC3.x - hostSelf.x, afterOnC3.z - hostSelf.z) < 1.2,
  `${Math.hypot(afterOnC3.x - hostSelf.x, afterOnC3.z - hostSelf.z).toFixed(2)}m apart`,
);
check(
  'two different observers agree with each other',
  Math.hypot(afterOnC3.x - afterOnC4.x, afterOnC3.z - afterOnC4.z) < 0.5,
);

const rates = await Promise.all(all.map((c) => c.page.evaluate(() => window.__hollowMp.snapshotRate())));
check('snapshots arrive at the expected rate on every client', rates.every((r) => r >= 8 && r <= 22), rates.join('/'));

/* ------------------------------------- shared power, clock and blackout */

const snaps = await Promise.all(all.map(snapOf));
const powers = snaps.map((s) => s.power);
check('power is one shared number', Math.max(...powers) - Math.min(...powers) < 1.5, powers.map((p) => p.toFixed(1)).join(' / '));
const clocks = snaps.map((s) => s.ms);
check('the match clock is the server\'s, not each client\'s', Math.max(...clocks) - Math.min(...clocks) < 400);

await waitFor(() => snapOf(host).then((s) => s.blackout), 20000, 'blackout');
await sleep(400);
const blackoutEverywhere = await Promise.all(all.map((c) => snapOf(c).then((s) => s.blackout)));
check('the blackout hits every client at once', blackoutEverywhere.every(Boolean));
const labels = await Promise.all(all.map((c) => snapOf(c).then((s) => s.obj.label)));
check('every client is given the same objective', new Set(labels).size === 1, labels[0]);
await host.page.screenshot({ path: SHOTS + 'mp-06-blackout.png' });

/* ------------------------------------------ drive one player to a task */

/** Walk a client along waypoints by steering its stick, as a thumb would. */
async function walkTo(client, waypoints) {
  for (const [tx, tz] of waypoints) {
    const deadline = Date.now() + 22000;
    for (;;) {
      const p = await client.page.evaluate(() => window.__hollowMp.pos());
      const dx = tx - p.x;
      const dz = tz - p.z;
      if (Math.hypot(dx, dz) < 1.1) break;
      if (Date.now() > deadline) {
        await client.page.evaluate(() => window.__hollowMp.setStick(0, 0));
        const snap = await snapOf(client);
        const id = await client.page.evaluate(() => window.__hollowMp.id());
        const status = snap?.players.find((pl) => pl.id === id)?.s;
        console.log(`         (stuck at ${p.x.toFixed(1)},${p.z.toFixed(1)} heading to ${tx},${tz}; status ${status})`);
        return false;
      }
      await client.page.evaluate(([x, z]) => window.__hollowMp.setStick(x, z), [dx, dz]);
      await sleep(120);
    }
  }
  await client.page.evaluate(() => window.__hollowMp.setStick(0, 0));
  return true;
}

// Office -> main corridor -> west corridor -> electrical room.
const arrived = await walkTo(c2, [[0, 4], [0, 1.6], [-15.5, 1.6], [-15.5, -1.5], [-19.5, -2.4], [-21.2, -3.2]]);
check('a player can walk across the map through doorways', arrived);
const room = await c2.page.evaluate(() => window.__hollowMp.focus()?.roomLabel ?? '');
check('and arrives in the right room', room === 'Electrical Room', room);
await c2.page.screenshot({ path: SHOTS + 'mp-07-electrical.png' });

const stepBefore = (await snapOf(c3)).obj.step;
await c2.page.evaluate(() => window.__hollowMp.use(true));
await waitFor(() => snapOf(c3).then((s) => s.obj.step !== stepBefore), 15000, 'objective advances');
await c2.page.evaluate(() => window.__hollowMp.use(false));
const stepAfter = await Promise.all(all.map((c) => snapOf(c).then((s) => s.obj.step)));
check(
  'one player completing a step is seen by every other client',
  new Set(stepAfter).size === 1 && stepAfter[0] !== stepBefore,
  `${stepBefore} -> ${stepAfter[0]}`,
);

/* ------------------------------------------------------ disconnections */

const c4Id = await c4.page.evaluate(() => window.__hollowMp.id());
await c4.context.close();
await waitFor(
  () => snapOf(host).then((s) => s.players.find((p) => p.id === c4Id)?.s === 3),
  12000,
  'dropped player marked disconnected',
);
check('a dropped client is cleaned up for everybody', true);
const stillRunning = await snapOf(c2);
check('the match keeps running after a disconnect', stillRunning.players.length === 4 && !!stillRunning.obj.label);

// Now the host itself vanishes.
await host.context.close();
await waitFor(
  () => lobbyOf(c2).then((l) => l && l.hostId !== hostId && l.players.find((p) => p.id === l.hostId)?.status !== 'disconnected'),
  15000,
  'host migration',
);
const migrated = await lobbyOf(c2);
check('host authority migrates when the host disappears', migrated.hostId !== hostId, `${hostId.slice(0, 4)} -> ${migrated.hostId.slice(0, 4)}`);
const afterMigration = await snapOf(c3);
check('the match survives the host leaving', !!afterMigration && afterMigration.k > 0, `tick ${afterMigration.k}`);

/* -------------------------------------------------------- reconnection */

// A held slot keeps the lobby full: a brand new player cannot steal the seat
// of somebody who might still come back.
const stranger = await makeClient('STRANGER');
await stranger.page.locator('.menu-list .btn', { hasText: 'Co-op Shift' }).click();
await waitFor(() => mp(stranger).then((s) => s === 'mp-menu'), 10000, 'stranger menu');
await stranger.page.locator('.mp-join-open-btn').click();
await stranger.page.locator('.mp-code-input').fill(code);
await stranger.page.locator('.mp-join-btn').click();
await sleep(800);
check('a held slot is not handed to a new player', !(await lobbyOf(stranger)));
await stranger.context.close();

// The real reconnection path: the app is reloaded (as it would be after a
// crash or a phone unlock), reads its resume token back out of storage and
// reclaims the same slot in the running match.
const c3Id = await c3.page.evaluate(() => window.__hollowMp.id());
await c3.page.reload({ waitUntil: 'load' });
await c3.page.waitForFunction(() => window.__hollow?.state() === 'menu', null, { timeout: 25000 });
await waitFor(
  () => snapOf(c2).then((s) => s?.players.find((p) => p.id === c3Id)?.s === 3),
  15000,
  'reloaded client is seen as disconnected',
);
check('a reloading client is marked disconnected, not deleted', true);

await c3.page.locator('.menu-list .btn', { hasText: 'Co-op Shift' }).click();
await waitFor(() => mp(c3).then((s) => s === 'mp-match'), 20000, 'reconnect back into the match');
const rejoinedId = await c3.page.evaluate(() => window.__hollowMp.id());
check('a reconnecting player reclaims their own slot', rejoinedId === c3Id, `${rejoinedId.slice(0, 6)} vs ${c3Id.slice(0, 6)}`);

const finalSnap = await snapOf(c2);
check(
  'the reconnect does not duplicate the player',
  new Set(finalSnap.players.map((p) => p.id)).size === finalSnap.players.length,
  `${finalSnap.players.length} players, ${new Set(finalSnap.players.map((p) => p.id)).size} unique`,
);
// Give the observing client a snapshot or two to carry the status change.
let liveAgain = false;
try {
  await waitFor(
    () => snapOf(c2).then((s) => s?.players.find((p) => p.id === c3Id)?.s !== 3),
    5000,
    'reconnected player is live again',
  );
  liveAgain = true;
} catch {
  liveAgain = false;
}
check('and they are alive again rather than stuck as a ghost', liveAgain);
await c3.page.screenshot({ path: SHOTS + 'mp-08-reconnected.png' });

/* -------------------------------------------------------------- finish */

check('no uncaught client errors during the whole session', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
server.kill('SIGTERM');
console.log(failures === 0 ? '\nALL MULTIPLAYER BROWSER CHECKS PASSED' : `\n${failures} MULTIPLAYER CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
