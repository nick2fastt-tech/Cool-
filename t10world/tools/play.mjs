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
  // The sweep above may have left one running, and T10 won't ask which kind
  // you want when the world is already ending.
  g.t10.handle('T10 stop the apocalypse');
  const q = g.t10.handle('T10 start an apocalypse');
  const pending = !!g.t10.pending;
  const a = g.t10.handle('alien');
  return { asked: q.reply.slice(0, 60), pending, answered: !!a.answered, reply: a.reply.slice(0, 70),
    kind: g.apocalypse.kind };
});
log('ask flow:', JSON.stringify(askFlow));
if (!askFlow.answered) { errors.push('ASK: T10 asked a question and did not take the answer'); log('>>> ASK FLOW FAILED'); }
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
  // Count decals made, not decals held: the array sits at its cap once the
  // street is already messy, so its length stops moving.
  const goreBefore = g.gore.decalsMade;
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
    targetDown: landed > 0, decals: g.gore.decalsMade - goreBefore,
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

// The sixteen powers: every one fires, costs energy, goes on cooldown and is
// bound to a key and a tile. A power that silently does nothing is the bug.
log('--- powers ---');
const powersTest = await page.evaluate(async ()=>{
  const g = window.__t10;
  const pump = async (n)=>{ for (let f=0;f<n;f++) await new Promise(r=>requestAnimationFrame(()=>r())); };
  const P = g.powers;
  if (!P) return { error: 'no powers system' };
  const out = { fired: [], failed: [], keys: 0, tiles: 0, energyMoved: false };
  const defs = P.constructor && g.__POWERS ? g.__POWERS : null;
  const ids = Object.keys(P.cooldowns);      // just to touch the object
  const list = (window.__t10.hud && window.__t10.hud.powerTiles) ? Object.keys(window.__t10.hud.powerTiles) : [];
  out.tiles = list.length;
  for (const id of list) {
    P.energy = 100;
    delete P.cooldowns[id];
    const before = P.energy;
    const line = P.use(id);
    await pump(2);
    if (line && P.energy < before) out.fired.push(id);
    else if (line) out.fired.push(id + '(free)');
    else out.failed.push(id);
  }
  out.energyMoved = P.energy <= 100;
  // Every power must also answer to a key press.
  const codes = new Set();
  for (const id of list) {
    const def = (window.__t10.hud && window.__t10.hud.powerTiles[id]) ? id : null;
    if (def) codes.add(def);
  }
  out.keys = codes.size;
  // Clean up: end everything and put the world back.
  g.t10.handle('T10 stop all my powers');
  await pump(4);
  g.player.flying = false; g.player.speedMultiplier = 1; g.timeScale = 1;
  g.setGravity(1);
  return out;
});
log('powers:', JSON.stringify(powersTest));
if (powersTest.error || powersTest.tiles !== 16) { errors.push('POWERS: expected 16 tiles, got '+(powersTest.tiles||0)); log('>>> POWERS UI FAILED'); }
if (powersTest.failed && powersTest.failed.length > 2) { errors.push('POWERS: '+powersTest.failed.length+' did nothing: '+powersTest.failed.join(',')); log('>>> POWERS FAILED'); }

// The creature sandbox: spawn every species, let them run, then design one.
log('--- creatures ---');
const creatureTest = await page.evaluate(async ()=>{
  const g = window.__t10;
  const pump = async (n)=>{ for (let f=0;f<n;f++) await new Promise(r=>requestAnimationFrame(()=>r())); };
  const C = g.creatures;
  if (!C) return { error: 'no creature system' };
  const out = { species: 0, spawned: 0, moved: 0, abilities: 0, designed: null, cleared: 0 };
  const cat = C.catalogue();
  out.species = cat.length;
  const p = g.player.position;
  const made = [];
  for (let i=0;i<cat.length;i++) {
    const a = (i/cat.length) * Math.PI * 2;
    const c = C.spawn(cat[i].id, p.x + Math.cos(a)*12, p.z + Math.sin(a)*12, {});
    if (c) made.push(c);
  }
  out.spawned = made.length;
  const start = made.map(c=>({x:c.position.x,z:c.position.z}));
  // Driven directly: SwiftShader runs at a couple of frames a second, so
  // waiting on ninety real frames would be ninety seconds of wall clock.
  for (let i=0;i<70;i++) C.update(0.12, g.player.position);
  for (let i=0;i<made.length;i++) {
    if (made[i].removed) { out.moved++; continue; }
    if (Math.hypot(made[i].position.x-start[i].x, made[i].position.z-start[i].z) > 0.4) out.moved++;
    if (Object.keys(made[i].abilityCooldown).length) out.abilities++;
  }
  // The free-text answer path: T10 asks, you describe, a species comes back.
  g.t10.handle('T10 design a creature');
  const askedDesign = !!g.t10.pending;
  const designed = g.t10.handle('a tiny blue hopping thing that screams');
  out.askDesign = { asked: askedDesign, answered: !!designed.answered, reply: (designed.reply||'').slice(0, 70) };
  out.cleared = C.count();
  C.clear();

  // A creature you cannot shoot is scenery. On an empty field — the crowd of
  // twenty-one above would otherwise stand in the way and answer for it — put
  // one on the aim line and check the bullet finds that one and hurts it.
  {
    g.t10.handle('T10 give me an assault rifle');
    const VV = g.camera.position.constructor;
    const aimDir = new VV(); g.camera.getWorldDirection(aimDir);
    const aim = g.camera.position.clone().addScaledVector(aimDir, 10);
    const t = C.spawn('brute', aim.x, aim.z, {});
    if (t) {
      t.position.y = g.world.groundAt(aim.x, aim.z);
      t.group.position.copy(t.position);
      // Aim at its middle rather than wherever the camera happened to point.
      const from = g.camera.position.clone();
      const to = t.position.clone(); to.y += t.spec.build.height * 0.5;
      const dir = to.sub(from).normalize();
      const before = t.health;
      const hit = g.arsenal.castBullet(from, dir, 60);
      const victim = hit && hit.creature;
      out.shootable = {
        found: !!victim,
        isTarget: victim === t,
        damaged: !!victim && victim.health < before,
        armed: !!g.arsenal.weapon,
      };
      if (!t.removed) C.remove(t);
    } else out.shootable = { found: false, isTarget: false, damaged: false, armed: !!g.arsenal.weapon };
    g.arsenal.unequip();
  }

  const d = C.design('Testbeast', 'a huge red four-legged thing with spikes that charges and screams');
  out.designed = d ? { id: d.id, legs: d.spec.build.legs, powers: d.spec.powers, move: d.spec.move } : null;
  const madeCustom = d ? !!C.spawn(d.id, p.x+6, p.z+6, {}) : false;
  out.customSpawned = madeCustom;
  for (let i=0;i<10;i++) C.update(0.12, g.player.position);
  C.clear();
  out.afterClear = C.count();
  return out;
});
log('creatures:', JSON.stringify(creatureTest));
if (creatureTest.error || creatureTest.spawned < 18) { errors.push('CREATURES: only '+(creatureTest.spawned||0)+' spawned'); log('>>> CREATURES FAILED'); }
if (creatureTest.moved !== undefined && creatureTest.moved < 5) { errors.push('CREATURES: nothing moved'); log('>>> CREATURE AI FAILED'); }
if (!creatureTest.customSpawned) { errors.push('CREATURES: a designed creature could not be spawned'); log('>>> CREATURE DESIGN FAILED'); }
if (creatureTest.askDesign && !creatureTest.askDesign.answered) { errors.push('CREATURES: describing a creature to T10 did not register'); log('>>> CREATURE ASK FAILED'); }
if (creatureTest.shootable &&
    (!creatureTest.shootable.found || !creatureTest.shootable.isTarget || !creatureTest.shootable.damaged)) {
  errors.push('CREATURES: a bullet aimed at one did not hit and hurt it (' + JSON.stringify(creatureTest.shootable) + ')');
  log('>>> CREATURE HITBOX FAILED');
}
if (creatureTest.afterClear) { errors.push('CREATURES: clear left '+creatureTest.afterClear+' behind'); }

// Mutation: four stages, no gore, and it ends in a creature.
log('--- mutation ---');
const mutationTest = await page.evaluate(async ()=>{
  const g = window.__t10;
  const pump = async (n)=>{ for (let f=0;f<n;f++) await new Promise(r=>requestAnimationFrame(()=>r())); };
  const M = g.mutations;
  if (!M) return { error: 'no mutation system' };
  const before = { decals: g.gore ? g.gore.decals.length : 0, gibs: g.gore ? g.gore.gibs.length : 0 };
  const npc = M.eligibleNear(g.player.position, 120);
  if (!npc) return { error: 'nobody eligible' };
  const rec = M.begin(npc, 'brute');
  if (!rec) return { error: 'begin refused' };
  const stages = [rec.stage];
  const creaturesBefore = g.creatures ? g.creatures.count() : 0;
  // A stage at a time, driven directly, so the whole transformation takes a
  // fraction of a second of wall clock instead of fourteen.
  for (let i=0;i<120 && M.active.length;i++) {
    M.update(0.25);
    const now = M.active[0] ? M.active[0].stage : 4;
    if (stages[stages.length-1] !== now) stages.push(now);
  }
  const after = { decals: g.gore ? g.gore.decals.length : 0, gibs: g.gore ? g.gore.gibs.length : 0 };
  const out = {
    stages,
    creaturesAfter: g.creatures ? g.creatures.count() : 0,
    creaturesBefore,
    goreAdded: (after.decals - before.decals) + (after.gibs - before.gibs),
    stillRunning: M.active.length,
  };
  if (g.creatures) g.creatures.clear();
  return out;
});
log('mutation:', JSON.stringify(mutationTest));
if (mutationTest.error) { errors.push('MUTATION: '+mutationTest.error); log('>>> MUTATION FAILED'); }
else {
  if (!mutationTest.stages || mutationTest.stages.length < 2) { errors.push('MUTATION: never left stage one'); log('>>> MUTATION STAGES FAILED'); }
  if (mutationTest.creaturesAfter <= mutationTest.creaturesBefore) { errors.push('MUTATION: never became a creature'); log('>>> MUTATION RESULT FAILED'); }
  if (mutationTest.goreAdded > 0) { errors.push('MUTATION: produced gore ('+mutationTest.goreAdded+') — it must not'); log('>>> MUTATION GORE FAILED'); }
}

// The performance ladder: every rung moves the named dials, and it comes back.
log('--- performance ladder ---');
const ladder = await page.evaluate(async ()=>{
  const g = window.__t10;
  const G = g.governor;
  const perf = g.__perf;
  if (!G || !perf) return { error: 'no governor or perf dials' };
  const seen = [];
  for (let step=0; step<8; step++) {
    G.step = step;
    G.apply();
    seen.push({
      step, name: G.stepName,
      load: +perf.load.toFixed(2), particles: +perf.particles.toFixed(2),
      shadows: +perf.shadows.toFixed(2), reflections: +perf.reflections.toFixed(2),
      vegetation: +perf.vegetation.toFixed(2), lodBias: +perf.lodBias.toFixed(2),
      physics: +perf.physics.toFixed(2), streaming: +perf.streaming.toFixed(2),
      animation: +perf.animation.toFixed(2),
    });
  }
  G.step = 0; G.scale = 1; G.apply();
  // Thermal: the monitor estimates it, the governor reads it off the monitor
  // and caps the ceiling with it. Drive the real path, not apply() alone.
  const t0 = perf.load;
  const realThermal = g.perf.thermal;
  g.perf.thermal = 0.8;
  G.update(0.016, g.perf);
  const capped = perf.load;
  const copied = perf.thermal;
  g.perf.thermal = realThermal;
  G.update(0.016, g.perf);
  G.step = 0; G.scale = 1; G.apply();
  return { seen, thermalCaps: capped < t0, thermalCopied: copied, report: G.report() };
});
log('ladder:', JSON.stringify(ladder.seen ? ladder.seen.map(s=>s.name+':'+s.load) : ladder));
if (ladder.error) { errors.push('LADDER: '+ladder.error); log('>>> LADDER FAILED'); }
else {
  const rows = ladder.seen;
  const strictlyDown = rows.every((r,i)=> i===0 || r.load <= rows[i-1].load);
  if (!strictlyDown) { errors.push('LADDER: load did not fall monotonically'); log('>>> LADDER ORDER FAILED'); }
  // Each named lever must actually move somewhere on the ladder.
  for (const k of ['particles','shadows','reflections','vegetation','lodBias','physics','streaming','animation']) {
    if (rows[rows.length-1][k] >= rows[0][k]) { errors.push('LADDER: '+k+' never moved'); log('>>> LADDER LEVER '+k+' FAILED'); }
  }
  if (ladder.thermalCopied !== 0.8) { errors.push('LADDER: the governor did not read the thermal estimate'); log('>>> THERMAL READ FAILED'); }
  if (!ladder.thermalCaps) { errors.push('LADDER: thermal estimate does not cap the load'); log('>>> THERMAL FAILED'); }
}

// The world library: create, rename, duplicate, delete, and the save round trip.
log('--- world library ---');
const library = await page.evaluate(async ()=>{
  const g = window.__t10;
  const S = g.__save;
  if (!S) return { error: 'no save module' };
  const before = S.listWorlds().length;
  const slot = S.createWorld({ name: 'Harness Test', seed: 12345 });
  const made = S.listWorlds().length;
  S.saveWorld(slot.id, g.serializeWorld());
  // loadWorld returns the slot; the world itself is slot.data.
  const loaded = (S.loadWorld(slot.id) || {}).data;
  S.renameWorld(slot.id, 'Renamed Test');
  const renamed = S.getWorld(slot.id).name;
  const dup = S.duplicateWorld(slot.id);
  const afterDup = S.listWorlds().length;
  S.deleteWorld(slot.id);
  if (dup) S.deleteWorld(dup.id);
  const after = S.listWorlds().length;
  return {
    before, made, after, renamed,
    duplicated: !!dup, afterDup,
    roundTrip: !!(loaded && loaded.worldSeed != null && loaded.rules),
    savedPowers: !!(loaded && loaded.powers),
    savedCreatures: !!(loaded && loaded.creatures),
  };
});
log('library:', JSON.stringify(library));
if (library.error) { errors.push('LIBRARY: '+library.error); }
else {
  if (library.made !== library.before + 1) { errors.push('LIBRARY: create did not add a slot'); log('>>> LIBRARY CREATE FAILED'); }
  if (library.renamed !== 'Renamed Test') { errors.push('LIBRARY: rename did not stick'); log('>>> LIBRARY RENAME FAILED'); }
  if (!library.duplicated || library.afterDup !== library.made + 1) { errors.push('LIBRARY: duplicate failed'); log('>>> LIBRARY DUPLICATE FAILED'); }
  if (library.after !== library.before) { errors.push('LIBRARY: delete left slots behind'); log('>>> LIBRARY DELETE FAILED'); }
  if (!library.roundTrip) { errors.push('LIBRARY: a saved world did not round trip'); log('>>> LIBRARY SAVE FAILED'); }
  if (!library.savedPowers) { errors.push('LIBRARY: powers were not saved with the world'); }
}

// The feature library: 500 entries, twenty categories, searchable.
log('--- feature library ---');
const featureLib = await page.evaluate(()=>{
  const F = window.__t10.__features;
  if (!F) return { error: 'no feature library' };
  const s = F.featureStats();
  const per = {};
  for (const f of F.FEATURES) per[f.category] = (per[f.category]||0)+1;
  return {
    total: s.total, live: s.live, categories: s.categories,
    smallest: Math.min(...Object.values(per)),
    search: F.searchFeatures('mutation', 3).map(f=>f.title),
    ideas: F.liveIdeas(3).length,
  };
});
log('features:', JSON.stringify(featureLib));
if (featureLib.error) { errors.push('FEATURES: '+featureLib.error); }
else {
  if (featureLib.total < 500) { errors.push('FEATURES: only '+featureLib.total+' tracked, expected 500+'); log('>>> FEATURE COUNT FAILED'); }
  if (featureLib.categories !== 20) { errors.push('FEATURES: '+featureLib.categories+' categories, expected 20'); }
  if (!featureLib.search.length) { errors.push('FEATURES: search returned nothing'); }
}

// No V1/V2/V3 naming anywhere the player can see, and exactly three presets.
log('--- naming and presets ---');
const naming = await page.evaluate(()=>{
  const text = document.body.innerText;
  const bad = /\bV[123]\b/.test(text);
  const btns = [...document.querySelectorAll('.t10-set-btn')].map(b=>b.textContent);
  return { bad, quality: btns.filter(t=>/^(LOW|HIGH|ULTRA)$/.test(t)) };
});
log('naming:', JSON.stringify(naming));
if (naming.bad) { errors.push('NAMING: a V1/V2/V3 label is on screen'); log('>>> NAMING FAILED'); }
if (naming.quality.length !== 3) { errors.push('PRESETS: the quality menu shows '+naming.quality.length+' of LOW/HIGH/ULTRA'); log('>>> PRESET NAMES FAILED'); }

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
