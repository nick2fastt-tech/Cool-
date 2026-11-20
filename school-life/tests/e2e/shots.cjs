// End-to-end walkthrough + screenshots. Fails if the page logs any error or warning.
// Usage: node tests/e2e/shots.cjs [baseUrl] [outDir] [step...]
function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    return require(process.env.PW_PATH || '/opt/node-tools/node_modules/playwright');
  }
}
const { chromium } = loadPlaywright();
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'http://localhost:5173/';
const outDir = process.argv[3] || path.resolve(__dirname, '../../screenshots/tmp');
const only = new Set(process.argv.slice(4));
fs.mkdirSync(outDir, { recursive: true });

const want = (k) => only.size === 0 || only.has(k);

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const problems = [];
  // Headless Chromium's software compositor prints this for ANY WebGL page (even an empty one).
  const IGNORE = [/GPU stall due to ReadPixels/];
  page.on('console', (m) => {
    const t = m.type();
    if ((t === 'error' || t === 'warning') && !IGNORE.some((r) => r.test(m.text()))) problems.push(`[console.${t}] ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  // Media elements abort their first request and re-request with a Range header (normal browser behavior).
  page.on('requestfailed', (r) => { const err = r.failure() && r.failure().errorText; if (/\.mp3$/.test(r.url()) && err === 'net::ERR_ABORTED') return; problems.push(`[requestfailed] ${r.url()} ${err}`); });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`[http ${r.status()}] ${r.url()}`); });

  const shot = async (name) => {
    const f = path.join(outDir, name + '.png');
    await page.screenshot({ path: f });
    console.log('shot', f);
  };
  const t0 = Date.now();
  await page.goto(base + (base.includes('?') ? '&' : '?') + 'fixedres&debug', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  if (want('loading')) await shot('01-loading');
  await page.waitForSelector('#tapStart:not(.hidden)', { timeout: 180000 });
  console.log('loaded in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  if (want('loading')) await shot('02-tap-to-start');
  await page.tap('#screen-loading');
  await page.waitForSelector('#screen-auth:not(.hidden) .idcard', { timeout: 10000 });
  await page.waitForTimeout(700);
  if (want('auth')) await shot('03-create-account');
  // validation error example
  await page.fill('#authEmail', 'student@yahoo.com');
  await page.tap('#authSubmit');
  await page.waitForTimeout(500);
  if (want('auth')) await shot('04-auth-error');
  await page.fill('#authEmail', 'nick.student.' + Date.now() + '@gmail.com');
  await page.fill('#authPass', 'schoollife1');
  await page.fill('#authConfirm', 'schoollife1');
  await page.tap('[data-gender="male"]');
  await page.waitForTimeout(250);
  if (want('auth')) await shot('05-auth-filled');
  await page.tap('#authSubmit');
  await page.waitForSelector('#lockContinue', { timeout: 20000 });
  await page.waitForTimeout(1300);
  if (want('auth')) await shot('06-account-locked-in');
  await page.tap('#lockContinue');
  await page.waitForSelector('#letterOk, #screen-menu:not(.hidden)', { timeout: 5000 });
  if (await page.$('#letterOk')) {
    await page.waitForTimeout(500);
    if (want('auth')) await shot('07-welcome-letter');
    await page.tap('#letterOk');
  }
  await page.waitForSelector('#screen-menu:not(.hidden)');
  await page.waitForTimeout(650);
  if (want('menu')) await shot('08-menu-title-dropping');
  await page.waitForTimeout(2600);
  if (want('menu')) await shot('09-main-menu');
  if (want('menu')) {
    await page.tap('#btnCharacter');
    await page.waitForTimeout(400);
    await shot('10-character-locked');
    await page.waitForTimeout(2600);
    await page.tap('#btnSettings');
    await page.waitForTimeout(500);
    await shot('11-settings');
    await page.tap('#setClose');
    await page.waitForTimeout(300);
  }
  await page.tap('#btnPlay', { force: true });
  await page.waitForTimeout(800);
  if (want('menu')) await shot('12-grade-select');
  fs.writeFileSync(path.join(outDir, 'problems.txt'), problems.join('\n'));
  console.log('PROBLEMS:', problems.length);
  for (const p of problems.slice(0, 40)) console.log('  ', p);
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch((e) => {
  console.error('E2E FAILED', e);
  process.exit(2);
});
