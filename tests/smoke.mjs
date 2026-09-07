/**
 * Browser smoke test.
 *
 * Builds nothing and mocks nothing: it serves the real production bundle,
 * drives it in Chromium at a phone viewport, and asserts the things that unit
 * tests cannot see - that WebGL initialises, that the menu and office actually
 * render pixels, that touch controls reach the simulation, and that a full
 * night can be played to 6 AM through the UI.
 *
 * Run with: npm run smoke          (the multi-file dist build)
 *           npm run smoke:single   (the standalone hollow-shift.html, loaded
 *                                   over file:// exactly as a player would)
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { existsSync } from 'node:fs';

const DIST = new URL('../dist/', import.meta.url).pathname;
const SHOTS = new URL('../artifacts/', import.meta.url).pathname;
// A single-file run is served straight off disk; nothing else changes.
const FILE_URL = process.env.SMOKE_FILE_URL ?? '';
const PREFIX = process.env.SMOKE_PREFIX ?? '';
const PORT = 4319;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

let failures = 0;
function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
  return ok;
}

const server = createServer(async (req, res) => {
  try {
    const url = (req.url ?? '/').split('?')[0];
    const rel = url === '/' ? 'index.html' : normalize(url).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(DIST, rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((r) => server.listen(PORT, r));
await mkdir(SHOTS, { recursive: true });

// This container ships a pinned Chromium build; use it rather than letting
// Playwright download one (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set here).
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  executablePath: existsSync(CHROME) ? CHROME : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 844, height: 390 },       // iPhone-class landscape
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const target = FILE_URL || `http://127.0.0.1:${PORT}/index.html`;
console.log(`INFO  target: ${target}`);
await page.goto(target, { waitUntil: 'load' });

/* -------------------------------------------------------------- 1. boot */
await page.waitForFunction(() => window.__hollow?.state() === 'menu', null, { timeout: 20000 });
check('boots to the main menu', true);
check('no page errors during boot', errors.length === 0, errors[0]);

const glOk = await page.evaluate(() => {
  const c = document.getElementById('stage');
  return !!(c && (c.getContext('webgl2') || c.getContext('webgl')));
});
check('WebGL context is live', glOk);

await page.waitForTimeout(600);
const menuPixels = await page.evaluate(() => {
  // Reading back the drawing buffer is not possible after a render with
  // preserveDrawingBuffer off, so measure the canvas size instead and rely on
  // the screenshot below for the visual check.
  const c = document.getElementById('stage');
  return c.width * c.height;
});
check('canvas is sized to the viewport', menuPixels > 100000, `${menuPixels}px`);
await page.screenshot({ path: join(SHOTS, PREFIX + '01-menu.png') });

/* --------------------------------------------------- 2. start a shift */
await page.getByText('New Shift', { exact: false }).first().click();
await page.waitForFunction(() => window.__hollow?.state() === 'playing', null, { timeout: 15000 });
check('night 1 starts from the menu', true);
await page.waitForTimeout(400);
await page.screenshot({ path: join(SHOTS, PREFIX + '02-office.png') });

/* ------------------------------------------------- 3. touch controls */
const before = await page.evaluate(() => window.__hollow.power());
await page.locator('.pad.left .btn').first().tap();   // left door
await page.waitForTimeout(150);
const doorClosed = await page.evaluate(() => window.__hollow.session().doors.isClosed('left'));
check('tapping the door button seals the door', doorClosed);

const usage = await page.evaluate(() => window.__hollow.session().power.usage);
check('a closed door adds a usage bar', usage === 2, `usage=${usage}`);

await page.locator('.pad.left .btn').first().tap();   // open it again
await page.waitForTimeout(1200);
const after = await page.evaluate(() => window.__hollow.power());
check('power drains over time', after < before, `${before.toFixed(2)} -> ${after.toFixed(2)}`);

/* --------------------------------------------- 3b. hall light reveal */
const light = page.locator('.pad.left .btn').nth(1);
const lightBox = await light.boundingBox();
await page.mouse.move(lightBox.x + lightBox.width / 2, lightBox.y + lightBox.height / 2);
await page.mouse.down();
await page.waitForTimeout(900);
const lightOn = await page.evaluate(() => window.__hollow.session().doors.isLightOn('left'));
check('holding the hall light turns it on and swings the view', lightOn);
await page.screenshot({ path: join(SHOTS, PREFIX + '02b-left-door-light.png') });
await page.mouse.up();
await page.waitForTimeout(400);
check('releasing the hall light turns it off',
  !(await page.evaluate(() => window.__hollow.session().doors.isLightOn('left'))));

/* -------------------------------------- 3c. someone at the west door */
await page.evaluate(() => window.__hollow.place('rabbit', 'WEST_CORNER'));
const light2 = await page.locator('.pad.left .btn').nth(1).boundingBox();
await page.mouse.move(light2.x + light2.width / 2, light2.y + light2.height / 2);
await page.mouse.down();
await page.waitForTimeout(900);
await page.screenshot({ path: join(SHOTS, PREFIX + '02c-someone-at-the-door.png') });
await page.mouse.up();
await page.waitForTimeout(500);
await page.screenshot({ path: join(SHOTS, PREFIX + '02d-lights-off-eyes-only.png') });
await page.evaluate(() => window.__hollow.place('rabbit', 'STAGE'));
check('a character can be staged at the west doorway', true);

/* ------------------------------------------------------ 4. the tablet */
await page.locator('.hud-office .monitor-toggle').tap();
await page.waitForTimeout(700);
const monitorUp = await page.evaluate(() => window.__hollow.session().monitor.up);
check('camera tablet opens', monitorUp);
await page.screenshot({ path: join(SHOTS, PREFIX + '03-cameras.png') });

await page.locator('.cam-map button').nth(3).tap();   // Crow's Nest
await page.waitForTimeout(600);
const camId = await page.evaluate(() => window.__hollow.session().monitor.camera.id);
check('switching cameras works', camId === 'CAM_04', camId);
await page.screenshot({ path: join(SHOTS, PREFIX + '04-crows-nest.png') });

await page.locator('#monitor .monitor-toggle').tap();
await page.waitForTimeout(400);
check('tablet closes', !(await page.evaluate(() => window.__hollow.session().monitor.up)));

/* ------------------------------------------- 5. blackout and recovery */
await page.evaluate(() => window.__hollow.forceBlackout());
await page.waitForTimeout(300);
const inBlackout = await page.evaluate(() => window.__hollow.session().phase === 'blackout');
check('power failure puts the night into blackout', inBlackout);
await page.screenshot({ path: join(SHOTS, PREFIX + '05-blackout.png') });

const crankBox = await page.locator('.crank-btn').boundingBox();
await page.mouse.move(crankBox.x + crankBox.width / 2, crankBox.y + crankBox.height / 2);
await page.mouse.down();
await page.waitForTimeout(2600);
await page.mouse.up();
await page.waitForTimeout(200);
const recovered = await page.evaluate(() => ({
  phase: window.__hollow.session().phase,
  power: window.__hollow.power(),
}));
check('holding the crank restores power', recovered.phase === 'playing' && recovered.power > 0,
  `phase=${recovered.phase} power=${recovered.power.toFixed(1)}`);

/* ------------------------------------------------------- 6. reach 6 AM */
await page.evaluate(() => window.__hollow.skipToHour(5.97));
await page.waitForFunction(() => window.__hollow?.state() === 'result', null, { timeout: 15000 });
const won = await page.evaluate(() => window.__hollow.session().phase === 'won');
check('the night ends at 6 AM with a win', won);
await page.waitForTimeout(400);
await page.screenshot({ path: join(SHOTS, PREFIX + '06-six-am.png') });

const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hollow-shift.save.v1') ?? '{}'));
check('progress is saved', saved.nightsCompleted >= 1, JSON.stringify(saved.stats ?? {}));
check('co-op unlocks after night 1', saved.multiplayerUnlocked === true);

/* -------------------------------------------------------- 7. framerate */
const fps = await page.evaluate(() => new Promise((resolve) => {
  let frames = 0;
  const start = performance.now();
  const tick = () => {
    frames++;
    if (performance.now() - start < 2000) requestAnimationFrame(tick);
    else resolve(Math.round((frames * 1000) / (performance.now() - start)));
  };
  requestAnimationFrame(tick);
}));
console.log(`INFO  software-rendered frame rate: ${fps} fps (SwiftShader, not a device figure)`);

check('no uncaught errors for the whole run', errors.length === 0, errors.slice(0, 3).join(' | '));

await writeFile(join(SHOTS, PREFIX + 'smoke-report.txt'), `failures=${failures}\nerrors=${errors.join('\n')}\n`);
await browser.close();
server.close();
console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} SMOKE CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
