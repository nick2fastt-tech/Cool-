import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const FILE = path.resolve(process.argv[2]);
const server = http.createServer((req,res)=>{ res.writeHead(200,{'Content-Type':'text/html'}); res.end(fs.readFileSync(FILE)); });
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport:{width:1280,height:760} });
const errors=[];
page.on('pageerror', e=>{ errors.push(e.message); console.log('>>> '+ (e.stack||e.message).slice(0,600)); });
page.on('console', m=>{ if(m.type()==='error'&&!/favicon/.test(m.text())) { errors.push(m.text()); console.log('>>> CONSOLE '+m.text().slice(0,300)); }});
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'load' });
await page.waitForTimeout(1500);
console.log('splash ok:', await page.evaluate(()=>!!document.getElementById('t10-start')));
await page.click('#t10-start');
await page.waitForTimeout(2500);
console.log('phase:', await page.evaluate(()=>window.__t10 && window.__t10.phase));
await page.evaluate(()=>{ const b=[...document.querySelectorAll('.t10-creator-btn')].find(x=>x.classList.contains('primary')); b.click(); });
try { await page.waitForFunction(()=>window.__t10 && window.__t10.phase==='playing', { timeout: 180000 }); } catch(e){ console.log('TIMEOUT'); }
await page.waitForTimeout(6000);
const info = await page.evaluate(()=>{
  const g=window.__t10; if(!g||!g.t10) return {phase:g&&g.phase};
  const tests = ['T10 how many commands do you have','T10 take me to the beach','T10 what is the t10 tower',
    'T10 spawn 3 benches','T10 make it sunset','T10 where is the nearest hospital','T10 show me the map',
    'T10 close the map','T10 make it snow','T10 this is my home','T10 take me home','T10 show all commands','T10',
    'T10 start a zombie apocalypse','T10 how bad is it','T10 i never want to die','T10 stop the apocalypse'];
  const replies = tests.map(t=>{ const r=g.t10.handle(t); return t+' -> '+r.reply.slice(0,90); });
  const askQ = g.t10.handle('T10 start an apocalypse');
  const askA = g.t10.handle('meteor');
  replies.push('ask flow -> ' + (g.t10.pending===null ? 'answered ' : 'PENDING ') + g.apocalypse.kind);
  g.t10.handle('T10 stop the apocalypse');
  const ui = { book: !!(g.book && g.book.visible), map: !!(g.map && g.map.visible), view: g.player.cameraMode,
    immortal: g.player.immortal, apocalypse: g.apocalypse.kind };
  if (g.book) g.book.hide();
  // The newest systems, checked through the bundle rather than the modules:
  // a mis-wrapped module would still boot and only fall over here.
  const systems = {
    powers: g.powers ? Object.keys(g.hud.powerTiles || {}).length : 0,
    energySpent: false,
    creatures: 0,
    mutationStages: 0,
    features: g.__features ? g.__features.featureCount() : 0,
    worlds: g.__save ? g.__save.listWorlds().length : 0,
    ladder: g.governor ? g.governor.stepName : null,
  };
  if (g.powers) {
    g.powers.energy = 100;
    const before = g.powers.energy;
    g.powers.use('blast');
    systems.energySpent = g.powers.energy < before;
    g.powers.stopAll();
  }
  // Mutation first: it needs somebody on their feet, and a monster loose in a
  // crowd this small (a software renderer cuts the budget to a handful) would
  // put all of them on the ground before we got here.
  if (g.mutations) {
    const npc = g.mutations.eligibleNear(g.player.position, 400);
    systems.mutationTarget = !!npc;
    if (npc && g.mutations.begin(npc, 'brute')) {
      const seen = new Set([1]);
      for (let i = 0; i < 120 && g.mutations.active.length; i++) {
        g.mutations.update(0.25);
        if (g.mutations.active[0]) seen.add(g.mutations.active[0].stage);
      }
      systems.mutationStages = seen.size + 1;   // plus the one it finished on
    }
    if (g.creatures) g.creatures.clear();
  }
  if (g.creatures) {
    const p = g.player.position;
    g.creatures.spawn('brute', p.x + 6, p.z + 6, {});
    g.creatures.spawn('gargoyle', p.x - 6, p.z + 6, {});
    for (let i = 0; i < 20; i++) g.creatures.update(0.1, p);
    systems.creatures = g.creatures.count();
    g.creatures.clear();
  }
  return { phase:g.phase, commands:g.t10.commandCount(), npcs:g.npcs.count(), cars:g.traffic.count(), ui, systems, replies };
});
console.log(JSON.stringify(info,null,1));
const sys = info.systems || {};
const bad = [];
if (sys.powers !== 16) bad.push('powers grid has ' + sys.powers + ' tiles, expected 16');
if (!sys.energySpent) bad.push('a power fired without costing energy');
if (sys.creatures < 2) bad.push('creatures did not survive a spawn in the bundle');
if (sys.mutationTarget && sys.mutationStages < 3) bad.push('the mutation did not run through its stages');
if (!sys.mutationTarget) console.log('note: nobody was eligible to mutate in this run, so that check was skipped');
if (sys.features < 500) bad.push('the feature library has ' + sys.features + ' entries, expected 500+');
for (const b of bad) { errors.push('SYSTEM: ' + b); console.log('>>> ' + b); }
await page.waitForTimeout(2500);
await page.screenshot({ path: process.env.SHOT || '/tmp/single.png' });
console.log(errors.length ? 'RESULT: FAIL' : 'RESULT: PASS');
await browser.close(); server.close(); process.exit(errors.length?1:0);
