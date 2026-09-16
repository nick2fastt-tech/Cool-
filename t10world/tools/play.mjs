import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve('.');
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
const server = http.createServer((req,res)=>{
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, u === '/' ? '/index.html' : u);
  fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end('404');}
    res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'}); res.end(d); });
});
await new Promise(r=>server.listen(0,r)); const port=server.address().port;

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport:{ width:1280, height:760 } });
const errors=[], warns=[];
page.on('pageerror', e => { const m='PAGEERROR: ' + (e.stack||e.message); errors.push(m); console.log('>>> '+m.slice(0,900)); });
page.on('console', m => {
  const t=m.text();
  if (m.type()==='error' && !/favicon|404/i.test(t)) { errors.push('CONSOLE: '+t); console.log('>>> CONSOLE: '+t.slice(0,500)); }
  if (m.type()==='warning' && /three|shader|program/i.test(t)) warns.push('WARN: '+t);
});
const SHOT = process.env.SHOTDIR || '/tmp/shots';
fs.mkdirSync(SHOT, { recursive:true });

const log = (...a)=>console.log(...a);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'load' });
await page.waitForTimeout(1200);
log('--- splash loaded ---');
await page.screenshot({ path: SHOT+'/01-splash.png' });

await page.click('#t10-start');
await page.waitForTimeout(2500);
const creatorOk = await page.evaluate(()=>window.__t10 && window.__t10.phase==='creator');
log('creator phase:', creatorOk);
await page.screenshot({ path: SHOT+'/02-creator.png' });

// Poke around the creator
await page.evaluate(()=>{ const t=[...document.querySelectorAll('.t10-creator-tab')]; if(t[1]) t[1].click(); });
await page.waitForTimeout(900);
await page.screenshot({ path: SHOT+'/03-creator-face.png' });
await page.evaluate(()=>{ const t=[...document.querySelectorAll('.t10-creator-tab')]; if(t[3]) t[3].click(); });
await page.waitForTimeout(700);

// Enter the world
await page.evaluate(()=>{ const b=[...document.querySelectorAll('.t10-creator-btn')].find(x=>x.classList.contains('primary')); b.click(); });
log('entering world...');
try {
  await page.waitForFunction(()=>window.__t10 && window.__t10.phase==='playing', { timeout: 180000 });
} catch(e) {
  log('TIMEOUT entering world. phase=', await page.evaluate(()=>window.__t10 && window.__t10.phase));
}
log('phase:', await page.evaluate(()=>window.__t10 && window.__t10.phase));
await page.waitForTimeout(6000);
await page.screenshot({ path: SHOT+'/04-world.png' });

const stats = await page.evaluate(()=>{
  const g = window.__t10;
  if (!g || !g.world || !g.t10) return { phase: g && g.phase, hasWorld: !!(g&&g.world), hasT10: !!(g&&g.t10) };
  return {
    commands: g.t10.commandCount(),
    categories: g.t10.registry.categoryNames().length,
    chunks: g.world.chunks.size,
    npcs: g.npcs.count(), cars: g.traffic.count(), animals: g.animals.count(),
    interactables: g.world.interactables.length,
    time: g.atmosphere.clockString(),
    weather: g.atmosphere.weatherName(),
    pos: [Math.round(g.player.position.x), Math.round(g.player.position.z)],
    where: g.world.city.describeLocation(g.player.position.x, g.player.position.z),
    draws: (g.lastRenderInfo||g.renderer.info.render).calls,
    tris: g.renderer.info.render.triangles,
  };
});
log('--- WORLD STATS ---');
log(JSON.stringify(stats, null, 1));

// Let the intro get-up animation finish and the city populate
await page.waitForTimeout(9000);
await page.screenshot({ path: SHOT+'/05-awake.png' });

// --- Drive the player with keys ---
log('--- walking ---');
const alive = await page.evaluate(()=>!!(window.__t10 && window.__t10.player));
if (!alive) { log('ABORT: player never built'); log('--- ERRORS ---'); for(const e of errors.slice(0,10)) log('  '+e.slice(0,600)); await browser.close(); server.close(); process.exit(1); }
const moved = await page.evaluate(async ()=>{
  const g = window.__t10;
  const before = { x: g.player.position.x, z: g.player.position.z };
  g.input.keys.add('KeyW');
  // Software GL runs about a frame a second, so pump frames rather than wait.
  for (let f = 0; f < 12; f++) await new Promise(r=>requestAnimationFrame(()=>r()));
  const after = { x: g.player.position.x, z: g.player.position.z };
  g.input.keys.delete('KeyW');
  return {
    distance: +Math.hypot(after.x - before.x, after.z - before.z).toFixed(2),
    pos: [Math.round(after.x), Math.round(after.z)],
    state: g.player.human.animator.state,
  };
});
await page.screenshot({ path: SHOT+'/06-walked.png' });
log('after walking:', JSON.stringify(moved));

// Forest draw-call check: trees are instanced per chunk, so a dense forest
// should not cost two draws per tree.
const forest = await page.evaluate(async ()=>{
  const g = window.__t10;
  g.t10.handle('T10 take me to the forest');
  for (let f = 0; f < 20; f++) await new Promise(r=>requestAnimationFrame(()=>r()));
  let trees = 0, instanced = 0;
  g.world.root.traverse((o)=>{ if (o.userData && o.userData.isTree) { trees++; if (o.isInstancedMesh) instanced += o.count; } });
  return { treeNodes: trees, instancedTrees: instanced, draws: (g.lastRenderInfo||g.renderer.info.render).calls };
});
log('forest:', JSON.stringify(forest));

// --- T10 commands ---
log('--- T10 commands ---');
const cmds = [
  'T10 how many commands do you have',
  'T10 spawn 3 benches',
  'T10 take me to the beach',
  'T10 take me to the forest',
  'T10 what is the t10 tower',
  'T10 make everyone salute',
  'T10 plant 2 pine trees',
  'T10 give me heavy rain',
  'T10 spawn a flock of birds',
  'T10 skip forward 5 hours',
  'T10 set my height to 175 cm',
  'T10 what should i do',
  'T10 remove all the dogs',
  'T10 what can you do',
  'T10 how many commands do you have',
  'T10 how much money do I have',
  'T10 give me a million dollars',
  'T10 how much money do I have',
  'T10 I wanna wear something new',
  'T10 make my hair blue',
  'T10 spawn a dog',
  'T10 spawn 3 benches',
  'T10 make it rain',
  'T10 set the time to 21',
  'T10 give me a sports car',
  'T10 take me to the beach',
  'T10 where am I',
  'T10 make everyone dance',
  'T10 who is that',
  'T10 make me 6 foot 8',
  'T10 night vision',
  'T10 ultra quality',
  'make it rain',
  'T10 where is the nearest gas station',
  'T10 take me to the nearest hospital',
  'T10 show me the map',
  'T10 zoom in on the map',
  'T10 close the map',
  'T10 remember this place as the good spot',
  'T10 list my places',
  'T10 take me back to the good spot',
  'T10 this is my home',
  'T10 take me home',
  'T10 make it snow',
  'T10 what is the weather',
  'T10 stop the snow',
  'T10 what is this world called',
  'T10 what is the tallest building',
  'T10 how far is the harbour stadium',
  'T10 park all the cars',
  'T10 get the traffic moving',
  'T10 make me look like them',
  'T10 show me the controls',
  'T10 go third person',
  'T10 go first person',
  'T10 how is it running',
  'T10 show all commands',
  'T10',
  'T10 what apocalypses are there',
  'T10 start a zombie apocalypse',
  'T10 how bad is it',
  'T10 infect that person',
  'T10 how many are infected',
  'T10 cure the virus',
  'T10 start a riot apocalypse',
  'T10 i never want to die',
  'T10 am i safe',
  'T10 make everyone attack me',
  'T10 stop the apocalypse',
  'T10 send a ufo',
  'T10 drop a meteor',
  'T10 control everyones mind',
  'T10 let them go',
  'T10 make everyone fall in love with me',
  'T10 nobody loves me',
  'T10 let me fly like superman',
  'T10 stop flying',
  'T10 let me die',
  'T10 calm everyone down',
  'T10 flurbulate the widget',
];
const replies = [];
for (const c of cmds) {
  const r = await page.evaluate((cmd)=>{
    const res = window.__t10.t10.handle(cmd);
    return { cmd, reply: res.reply, id: res.command ? res.command.id : null, unknown: !!res.unknown, ok: res.ok };
  }, c);
  replies.push(r);
  log(`  ${r.ok ? (r.unknown?'?':'✓') : '✗'} "${c}"\n     → ${r.reply}${r.id ? '   ['+r.id+']' : ''}`);
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1500);
// T10 asking a follow-up question, and the answer landing without a wake word.
const askFlow = await page.evaluate(()=>{
  const g = window.__t10;
  const q = g.t10.handle('T10 start an apocalypse');
  const pending = !!g.t10.pending;
  const a = g.t10.handle('alien');
  return { asked: q.reply.slice(0, 60), pending, answered: !!a.answered, reply: a.reply.slice(0, 70),
    kind: g.apocalypse.kind };
});
log('ask flow:', JSON.stringify(askFlow));
await page.evaluate(()=>{ window.__t10.t10.handle('T10 stop the apocalypse'); });

const bookOpen = await page.evaluate(()=>!!(window.__t10.book && window.__t10.book.visible));
log('command book opened by bare "T10":', bookOpen);
await page.screenshot({ path: SHOT+'/07a-book.png' });
await page.evaluate(()=>{ window.__t10.book.hide(); window.__t10.map.show(); window.__t10.map.setZoom(1.4); });
await page.waitForTimeout(1200);
await page.screenshot({ path: SHOT+'/07b-map.png' });
await page.evaluate(()=>{ window.__t10.map.setZoom(0.35); });
await page.waitForTimeout(900);
await page.screenshot({ path: SHOT+'/07c-map-wide.png' });
await page.evaluate(()=>{ window.__t10.map.hide(); });
await page.waitForTimeout(1500);
await page.screenshot({ path: SHOT+'/07-after-commands.png' });

// --- touch joystick + drag-to-look ---
log('--- touch input ---');
await page.evaluate(()=>{ window.__t10.t10.handle('T10 low quality'); });
await page.waitForTimeout(2000);
const touchMoved = await page.evaluate(async ()=>{
  const g = window.__t10;
  const el = g.renderer.domElement;
  // The harness is a desktop browser, so bind the touch path explicitly.
  if (!g.input.isTouch) { g.input.isTouch = true; g.input.bindTouch(); }
  const before = { x: g.player.position.x, z: g.player.position.z, yaw: g.player.yaw };
  const T = (id, x, y) => new Touch({ identifier: id, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
  const fire = (type, touches) => window.dispatchEvent(new TouchEvent(type, {
    touches, changedTouches: touches, targetTouches: touches, bubbles: true, cancelable: true }));
  // Finger 1: left stick, pushed forward.
  fire('touchstart', [T(1, 140, 600)]);
  fire('touchmove', [T(1, 140, 540)]);
  // Finger 2: drag the right half of the screen to look.
  fire('touchstart', [T(2, 900, 380)]);
  for (let i = 1; i <= 8; i++) fire('touchmove', [T(2, 900 + i * 14, 380)]);
  // Input-layer truth, before any frame consumes it.
  const rawLook = +g.input.look.x.toFixed(4);
  const stickRole = g.input.touches.get(1) && g.input.touches.get(1).role;
  const lookRole = g.input.touches.get(2) && g.input.touches.get(2).role;
  // Pump real frames so the player actually acts on it.
  for (let f = 0; f < 6; f++) await new Promise(r=>requestAnimationFrame(()=>r()));
  const mid = { x: g.player.position.x, z: g.player.position.z, yaw: g.player.yaw };
  const stickMove = +g.input.move.y.toFixed(3);
  fire('touchend', [T(1, 140, 540)]);
  fire('touchend', [T(2, 1012, 380)]);
  await new Promise(r=>setTimeout(r, 400));
  g.input.isTouch = false;
  await new Promise(r=>requestAnimationFrame(()=>r()));
  return {
    roles: [stickRole, lookRole],
    rawLookDelta: rawLook,
    stickForward: stickMove,
    walked: +Math.hypot(mid.x - before.x, mid.z - before.z).toFixed(2),
    turned: +(mid.yaw - before.yaw).toFixed(3),
    stickReleasedTo: [g.input.stick.x, g.input.stick.y],
    moveAfterRelease: +Math.hypot(g.input.move.x, g.input.move.y).toFixed(3),
  };
});
log('touch:', JSON.stringify(touchMoved));

// --- desktop drag-to-look (no pointer lock) ---
const dragLook = await page.evaluate(async ()=>{
  const g = window.__t10;
  const el = g.renderer.domElement;
  const yaw0 = g.player.yaw;
  el.dispatchEvent(new MouseEvent('mousedown', { clientX: 640, clientY: 380, bubbles: true }));
  for (let i = 1; i <= 10; i++) {
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 640 + i * 12, clientY: 380, bubbles: true }));
  }
  const raw = +g.input.look.x.toFixed(4);
  for (let f = 0; f < 3; f++) await new Promise(r=>requestAnimationFrame(()=>r()));
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: 760, clientY: 380, bubbles: true }));
  return { rawLookDelta: raw, yawDelta: +(g.player.yaw - yaw0).toFixed(3) };
});
log('drag-to-look:', JSON.stringify(dragLook));

// Open the chat to see T10 vision
await page.evaluate(()=>{ window.__t10.hud.setChatOpen(true); });
await page.waitForTimeout(2000);
await page.screenshot({ path: SHOT+'/08-t10-vision.png' });
await page.evaluate(()=>{ window.__t10.hud.setChatOpen(false); });
await page.waitForTimeout(1500);

// Settings panel
await page.evaluate(()=>{ window.__t10.hud.setSettingsOpen(true); });
await page.waitForTimeout(1200);
await page.screenshot({ path: SHOT+'/09-settings.png' });
await page.evaluate(()=>{ window.__t10.hud.setSettingsOpen(false); });

// Daytime again + drive a car
await page.evaluate(()=>{
  const g=window.__t10;
  g.t10.handle('T10 set the time to 14');
  g.t10.handle('T10 clear the sky');
  g.t10.handle('T10 normal vision');
  g.t10.handle('T10 give me a sports car');
});
await page.waitForTimeout(2500);
await page.evaluate(()=>{ window.__t10.doVehicleToggle(); });
await page.waitForTimeout(500);
const inCar = await page.evaluate(()=>!!window.__t10.player.inVehicle);
log('in vehicle:', inCar);
await page.evaluate(()=>{ window.__t10.input.keys.add('KeyW'); });
await page.waitForTimeout(3500);
await page.screenshot({ path: SHOT+'/10-driving.png' });
const drove = await page.evaluate(()=>{
  const v=window.__t10.player.inVehicle;
  return v ? { speed: +v.speed.toFixed(1), pos:[Math.round(v.position.x),Math.round(v.position.z)] } : null;
});
log('driving:', JSON.stringify(drove));
await page.evaluate(()=>{ window.__t10.input.keys.delete('KeyW'); window.__t10.doVehicleToggle(); });
await page.waitForTimeout(1200);

// Final perf sample
const perf = await page.evaluate(async ()=>{
  const g=window.__t10;
  const t0=performance.now(); let n=0;
  await new Promise(r=>{ const f=()=>{ n++; if(performance.now()-t0<3000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  return { fps: +(n/((performance.now()-t0)/1000)).toFixed(1), draws: (g.lastRenderInfo||g.renderer.info.render).calls,
    tris: (g.lastRenderInfo||g.renderer.info.render).triangles, npcs: g.npcs.count(), cars: g.traffic.count(), animals: g.animals.count() };
});
log('--- PERF (software GL, so treat as a floor) ---');
log(JSON.stringify(perf));
await page.screenshot({ path: SHOT+'/11-final.png' });

log('--- ERRORS ---');
if (!errors.length) log('  none');
for (const e of errors.slice(0,25)) log('  '+e.slice(0,400));
log('RESULT: ' + (errors.length ? 'FAIL ('+errors.length+' errors)' : 'PASS'));
await browser.close(); server.close();
process.exit(errors.length?1:0);
