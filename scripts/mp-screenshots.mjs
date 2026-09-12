/**
 * Dev tool: boots the server, opens one co-op client and walks it around,
 * writing screenshots to artifacts/. Used to review how the map actually
 * looks without a device in hand.
 *
 *   node scripts/mp-screenshots.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const PORT = Number(process.env.P ?? 4477);
const SHOTS = '/home/user/Cool-/artifacts/';
const server = spawn(process.execPath, ['server-dist/server.mjs'], {
  env: { ...process.env, PORT: String(PORT), STATIC_DIR: 'dist', HOLLOW_TEST_AI_LEVEL: '1' },
  stdio: ['ignore', 'pipe', 'pipe'], cwd: '/home/user/Cool-',
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) break; } catch {} await sleep(250); }
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 420 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('hollow-shift.save.v1', JSON.stringify({
  version: 1, nightsCompleted: 1, unlockedNight: 2, multiplayerUnlocked: true, seenHusk: false,
  stats: { nightsAttempted: 1, deaths: 0, blackoutsSurvived: 0, totalSeconds: 0 },
  settings: { quality: 'high', sensitivity: 1, buttonScale: 1, uiOpacity: 0.85, leftHanded: false,
    masterVolume: 0, sfxVolume: 0, classicPacing: false, haptics: false, subtitles: false } })));
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => window.__hollow?.state() === 'menu', null, { timeout: 25000 });
await page.locator('.menu-list .btn', { hasText: 'Co-op Shift' }).click();
await page.waitForFunction(() => window.__hollowMp.connection() === 'online', null, { timeout: 15000 });
await page.locator('.mp-host-btn').click();
await page.locator('.mp-create-btn').click();
await page.waitForFunction(() => !!window.__hollowMp.lobby()?.code, null, { timeout: 10000 });
await page.locator('.mp-start-btn').click();
await page.waitForFunction(() => window.__hollowMp.state() === 'mp-match', null, { timeout: 15000 });
await sleep(1200);
// A turn on the spot, so the office can actually be reviewed rather than
// guessed at from one arbitrary heading.
for (const [i, yaw] of [0, Math.PI / 2, Math.PI, -Math.PI / 2].entries()) {
  await page.evaluate((y) => window.__hollowMp.setYaw(y), yaw);
  await sleep(500);
  const p = await page.evaluate(() => window.__hollowMp.pos());
  console.log(`shot ${i}: asked ${yaw.toFixed(2)} got yaw ${p.yaw.toFixed(2)} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
  await page.screenshot({ path: `${SHOTS}mp-look-01-office-${i}.png` });
}
// Back off to the door end, then look across the whole office.
await page.evaluate(() => window.__hollowMp.setYaw(Math.PI));
await page.evaluate(() => window.__hollowMp.setStick(0, -1));
await sleep(900);
await page.evaluate(() => window.__hollowMp.setStick(0, 0));
await sleep(500);
const deskPos = await page.evaluate(() => window.__hollowMp.pos());
console.log(`at desk: ${deskPos.x.toFixed(1)},${deskPos.z.toFixed(1)} yaw ${deskPos.yaw.toFixed(2)}`);
await page.screenshot({ path: SHOTS + 'mp-look-01b-desk.png' });
await page.evaluate(() => window.__hollowMp.setYaw(0));
await sleep(300);
// Walk out into the corridor and look around.
for (const [x, z, ms] of [[0, -1, 2600]]) {
  await page.evaluate(([a, b]) => window.__hollowMp.setStick(a, b), [x, z]);
  await sleep(ms);
}
await page.evaluate(() => window.__hollowMp.setStick(0, 0));
await sleep(400);
await page.screenshot({ path: SHOTS + 'mp-look-02-corridor.png' });
await page.evaluate(() => window.__hollowMp.setYaw(Math.PI / 2));
await sleep(600);
await page.screenshot({ path: SHOTS + 'mp-look-03-corridor-east.png' });
// Torch on, in the dark.
await page.evaluate(() => { window.__hollowMp.setStick(0, -1); });
await sleep(2600);
await page.evaluate(() => window.__hollowMp.setStick(0, 0));
await page.locator('.mp-btn', { hasText: 'TORCH' }).click();
await sleep(700);
await page.screenshot({ path: SHOTS + 'mp-look-04-dining.png' });
await browser.close();
server.kill('SIGTERM');
console.log('shots written');
