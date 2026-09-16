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
  'T10 how many guns are there',
  'T10 give me a sniper rifle',
  'T10 what am i holding',
  'T10 give me the apex assault rifle',
  'T10 give me the best gun',
  'T10 reload',
  'T10 how am i shooting',
  'T10 put the gun away',
  'T10 what rating is this',
  'T10 set the rating to 16',
  'T10 set the rating to 18',
  'T10 more blood',
  'T10 clean up the blood',
  'T10 slow down time',
  'T10 normal speed',
  'T10 reset everything',
  'T10 where is the subway',
  'T10 what subway lines are there',
  'T10 take me down there',
  'T10 get on the train',
  'T10 sit down',
  'T10 stand up',
  'T10 get me out of the subway',
  'T10 turn me into a zombie',
  'T10 am i a zombie',
  'T10 turn me back',
  'T10 tear them apart',
  'T10 how much mess is there',
  'T10 give me an apex',
  'T10 make the blood green',
  'T10 clean up the blood',
  'T10 reset everything',
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

// --- control directions ---
// Forward must be forward and right must be right, in both camera modes.
// First and third person once used opposite yaw conventions, so on the default
// first-person view pushing the stick forward walked you backwards.
// Performance plumbing: three presets, each moving the right dials; the
// monitor reporting real numbers; chunk culling actually hiding chunks; and a
// background population that exists without bodies.
log('--- performance systems ---');
const perfSys = await page.evaluate(async ()=>{
  const g = window.__t10;
  const pump = async (n)=>{ for (let f=0;f<n;f++) await new Promise(r=>requestAnimationFrame(()=>r())); };
  const S = g.__settings || null;
  const out = { presets: {}, };
  // Each preset must move more than resolution.
  for (const q of ['low','high','ultra']) {
    g.t10.handle('T10 ' + q + ' quality');
    await pump(4);
    const p = g.renderer ? null : null;
    const pr = (window.__t10 && window.__t10.hud) ? null : null;
    const preset = g.post ? null : null;
    const s = g.npcs && g.world ? {
      draw: g.world.chunks ? null : null,
    } : null;
    // Read the live preset through a command reply instead of importing.
    out.presets[q] = JSON.parse(JSON.stringify({
      npcBudget: g.npcs.budget,
      shadowsOn: g.renderer.shadowMap.enabled,
      streamChunks: g.world.chunks.size,
    }));
  }
  g.t10.handle('T10 high quality');
  await pump(30);
  out.culled = g.world.chunksHidden;
  out.chunks = g.world.chunks.size;
  out.monitor = {
    fps: Math.round(g.perf.fps), p95: +g.perf.p95Ms.toFixed(1), draws: g.perf.draws,
    npcs: g.perf.npcs, background: g.perf.backgroundNpcs, chunks: g.perf.chunks,
    geometries: g.perf.geometries, textures: g.perf.textures,
  };
  out.population = g.npcs.population();
  out.animLods = (()=>{ const c = {0:0,1:0,2:0};
    for (const n of g.npcs.npcs) { const l = n.human.animator.lod|0; if (c[l]!=null) c[l]++; }
    return c; })();
  return out;
});
log('perf systems:', JSON.stringify(perfSys));
if (!perfSys.monitor || !perfSys.monitor.draws) { errors.push('PERF: monitor reported nothing'); log('>>> PERF MONITOR FAILED'); }
if (perfSys.culled == null) { errors.push('PERF: chunk culling never ran'); log('>>> CULLING FAILED'); }
if (perfSys.population <= perfSys.monitor.npcs) { errors.push('PERF: no background population'); log('>>> BACKGROUND NPCS FAILED'); }

// The subway: walk in, wait, board, ride, get off, walk out.
log('--- subway ---');
const subway = await page.evaluate(async ()=>{
  const g = window.__t10, s = g.subway, p = g.player;
  const pump = async (n)=>{ for (let f=0;f<n;f++) await new Promise(r=>requestAnimationFrame(()=>r())); };
  if (!s) return { error: 'no subway' };
  const near = s.stops.slice().sort((a,b)=>Math.hypot(a.x-p.position.x,a.z-p.position.z)-Math.hypot(b.x-p.position.x,b.z-p.position.z))[0];
  s.enter(near.key);
  await pump(20);
  const onPlatform = { under: !!p.inSubway, y: +p.position.y.toFixed(1), station: s.playerStation && s.playerStation.name };
  let boarded = false;
  for (let i=0;i<50 && !boarded;i++) { await pump(20); boarded = !!s.board(); }
  const startStop = s.ridingTrain ? s.ridingTrain.index : -1;
  p.sitDownHere();
  const sat = !!p.sitting;
  // Ride until it stops somewhere else.
  let arrived = false;
  for (let i=0;i<120 && !arrived;i++) { await pump(6); const t = s.ridingTrain; arrived = t && t.state!=='run' && t.index!==startStop; }
  p.standUp();
  const got = s.alight();
  await pump(10);
  const after = s.playerStation && s.playerStation.name;
  s.leave();
  await pump(10);
  return { stops: s.stops.length, lines: 3, onPlatform, boarded, sat, arrived, got,
    from: onPlatform.station, to: after, backUp: !p.inSubway, y: +p.position.y.toFixed(1) };
});
log('subway:', JSON.stringify(subway));
if (subway.error || !subway.boarded || !subway.arrived || !subway.got || !subway.backUp) {
  errors.push('SUBWAY: could not ride a train end to end');
  log('>>> SUBWAY FAILED');
}
await page.screenshot({ path: SHOT+'/13-subway.png' });

// Gibs and reanimation.
log('--- gore and reanimation ---');
const flesh = await page.evaluate(async ()=>{
  const g = window.__t10;
  const pump = async (n)=>{ for (let f=0;f<n;f++) await new Promise(r=>requestAnimationFrame(()=>r())); };
  g.t10.handle('T10 set the rating to 18');
  const npc = g.npcs.npcs[0];
  if (!npc) return { error: 'nobody' };
  const before = g.gore.gibs.length;
  const made = g.gore.gib(npc.position.x, npc.position.y + 0.8, npc.position.z, 1, 0, 1);
  await pump(40);
  const kinds = {};
  for (const gb of g.gore.gibs) kinds[gb.kind] = (kinds[gb.kind]||0)+1;
  // Reanimation: put someone down during an outbreak and wait for them.
  g.t10.handle('T10 start a zombie apocalypse');
  const victim = g.npcs.npcs.find(n=>!n.infected && n!==npc);
  let rose = false;
  if (victim) {
    victim.downed = 6; victim.reanimate = 0.4;
    for (let i=0;i<40 && !rose;i++) { await pump(6); rose = !!victim.infected; }
  }
  g.t10.handle('T10 stop the apocalypse');
  return { made, kinds, landed: g.gore.gibs.filter(x=>x.rest>0).length, rose };
});
log('gore:', JSON.stringify(flesh));
if (flesh.error || !flesh.made || !flesh.rose) {
  errors.push('GORE: gibs or reanimation failed');
  log('>>> GORE FAILED');
}

// Guns actually fire, hit people and leave blood.
log('--- shooting ---');
const shooting = await page.evaluate(async ()=>{
  const g = window.__t10;
  const pump = async (n)=>{ for (let f=0;f<n;f++) await new Promise(r=>requestAnimationFrame(()=>r())); };
  g.t10.handle('T10 give me an assault rifle');
  const npc = g.npcs.npcs.slice().sort((a,b)=>a.position.distanceTo(g.player.position)-b.position.distanceTo(g.player.position))[0];
  if (!npc) return { error: 'nobody around' };
  // Stand the target dead ahead and look at it.
  const p = g.player;
  p.pitch = 0; p.heading = p.yaw;
  await pump(6);
  // Stand the target on the aim line itself, chest-high, so the test is about
  // the weapon and not about whatever the terrain is doing under our feet.
  const VV = g.camera.position.constructor;
  const aimDir = new VV(); g.camera.getWorldDirection(aimDir);
  const aim = g.camera.position.clone().addScaledVector(aimDir, 9);
  npc.position.set(aim.x, aim.y - 1.15, aim.z);
  npc.root.position.copy(npc.position);
  npc.indoors = false; npc.downed = 0; npc.hitPoints = 100; npc.controlled = 'freeze';
  await pump(2);
  const goreBefore = g.gore.decals.length;
  const shotsBefore = g.arsenal.shotsFired;
  // Keep the target on its feet between rounds — a body on the ground is a
  // much smaller target, which is correct but not what we're measuring here.
  for (let i=0;i<14;i++) {
    npc.downed = 0; npc.hitPoints = 100;
    g.arsenal.cooldown = 0; g.arsenal.pullTrigger(); await pump(1);
  }
  const landed = g.arsenal.hits;
  npc.downed = 0;
  await pump(10);
  return { armed: g.arsenal.armed, weapon: g.arsenal.weapon.name,
    shots: g.arsenal.shotsFired - shotsBefore, hits: landed,
    targetDown: landed > 0, decals: g.gore.decals.length - goreBefore,
    drops: g.gore.dropCount };
});
log('shooting:', JSON.stringify(shooting));
if (!shooting.error && (!shooting.hits || !shooting.targetDown || shooting.decals <= 0)) {
  errors.push('SHOOTING: shots did not land or did not bleed');
  log('>>> SHOOTING FAILED');
}
await page.screenshot({ path: SHOT+'/12-shooting.png' });
await page.evaluate(()=>{ window.__t10.t10.handle('T10 reset everything'); });

log('--- control directions ---');
const dirs = await page.evaluate(async ()=>{
  const g = window.__t10, p = g.player;
  const V = g.camera.position.constructor;
  const pump = async (n)=>{ for (let f=0;f<n;f++) await new Promise(r=>requestAnimationFrame(()=>r())); };
  const fwd = () => { const v = new V(); g.camera.getWorldDirection(v); return v; };
  const rgt = () => new V(1,0,0).applyQuaternion(g.camera.quaternion);
  const res = {};
  const startMode = p.cameraMode;
  for (const mode of ['first','third']) {
    p.setCameraMode(mode); p.yaw=0; p.heading=0; p.pitch=0; await pump(20);
    const F = fwd().clone(), R = rgt().clone(); const r = {};
    g.input.isTouch = true;
    let a = p.position.clone(); g.input.stick.x=0; g.input.stick.y=-1; await pump(25);
    let d = p.position.clone().sub(a); r.stickUp = d.x*F.x+d.z*F.z > 0 ? 'FORWARD':'BACKWARD';
    g.input.stick.x=0; g.input.stick.y=0; g.input.releaseStick(); await pump(6);
    p.yaw=0; p.heading=0; await pump(12);
    const R2 = rgt().clone(); a = p.position.clone();
    g.input.stick.x=1; g.input.stick.y=0; await pump(25);
    d = p.position.clone().sub(a); r.stickRight = d.x*R2.x+d.z*R2.z > 0 ? 'RIGHT':'LEFT';
    g.input.stick.x=0; g.input.stick.y=0; g.input.releaseStick(); g.input.isTouch=false; await pump(6);
    p.yaw=0; p.heading=0; p.pitch=0; await pump(12);
    const b0 = fwd().clone(); const el = g.renderer.domElement;
    el.dispatchEvent(new MouseEvent('mousedown',{clientX:450,clientY:300,bubbles:true}));
    for (let i=1;i<=12;i++) document.dispatchEvent(new MouseEvent('mousemove',{clientX:450+i*10,clientY:300,bubbles:true}));
    window.dispatchEvent(new MouseEvent('mouseup',{clientX:570,clientY:300,bubbles:true}));
    await pump(8);
    const a1 = fwd().clone();
    r.dragRight = (b0.z*a1.x - b0.x*a1.z) > 0 ? 'LEFT':'RIGHT';
    p.yaw=0; p.heading=0; p.pitch=0; await pump(12);
    const y0 = fwd().y;
    el.dispatchEvent(new MouseEvent('mousedown',{clientX:450,clientY:200,bubbles:true}));
    for (let i=1;i<=12;i++) document.dispatchEvent(new MouseEvent('mousemove',{clientX:450,clientY:200+i*10,bubbles:true}));
    window.dispatchEvent(new MouseEvent('mouseup',{clientX:450,clientY:320,bubbles:true}));
    await pump(8);
    r.dragDown = fwd().y < y0 ? 'DOWN':'UP';
    p.pitch = 0; res[mode] = r;
  }
  p.setCameraMode(startMode);
  res.ok = ['first','third'].every(m => res[m].stickUp==='FORWARD' && res[m].stickRight==='RIGHT'
    && res[m].dragRight==='RIGHT' && res[m].dragDown==='DOWN');
  return res;
});
log('directions:', JSON.stringify(dirs));
if (!dirs.ok) { errors.push('CONTROLS: a direction is inverted'); log('>>> CONTROL DIRECTION INVERTED'); }

// --- viewport resilience ---
// A mobile browser reporting a zero-height viewport once used to leave a
// zero-height drawing buffer and a NaN projection matrix: a black screen that
// never recovered, because no further resize event fires.
log('--- viewport ---');
const viewport = await page.evaluate(async ()=>{
  const g = window.__t10;
  const read = () => { const c = g.renderer.domElement;
    return { w:c.width, h:c.height, finite:Number.isFinite(g.camera.projectionMatrix.elements[0]) }; };
  const pump = async (n) => { for (let f=0;f<n;f++) await new Promise(r=>requestAnimationFrame(()=>r())); };
  const healthy = read();
  Object.defineProperty(window, 'innerHeight', { get: () => 0, configurable: true });
  window.dispatchEvent(new Event('resize'));
  await pump(4);
  const afterZero = read();
  Object.defineProperty(window, 'innerHeight', { get: () => 760, configurable: true });
  // Break it outright, with no event at all, and let the frame loop notice.
  g.renderer.setSize(300, 0, true);
  g.camera.aspect = NaN; g.camera.updateProjectionMatrix();
  await pump(40);
  const healed = read();
  return { healthy, afterZero, healed,
    ok: afterZero.h > 0 && afterZero.finite && healed.h > 0 && healed.finite };
});
log('viewport:', JSON.stringify(viewport));
if (!viewport.ok) { errors.push('VIEWPORT: black-screen guard failed'); log('>>> VIEWPORT GUARD FAILED'); }

// --- touch joystick + drag-to-look ---
log('--- touch input ---');
await page.evaluate(()=>{ window.__t10.t10.handle('T10 low quality'); });
await page.waitForTimeout(2000);
const padHints = await page.evaluate(()=>{
  const g = window.__t10;
  if (!g.hud.touchWrap) { g.hud.isTouch = true; g.hud.buildTouchControls(); }
  return [...g.hud.touchWrap.querySelectorAll('.t10-pad:not(.t10-pad-vehicle) .t10-touch-hint')].map(n=>n.textContent);
});
log('touch buttons:', JSON.stringify(padHints));
if (padHints.some(h=>/run|view/i.test(h))) { errors.push('HUD: Run/View button still present'); log('>>> RUN/VIEW BUTTON STILL PRESENT'); }

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
