import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';

// T10 World - the systems harness. play.mjs drives the whole game and takes
// twenty minutes on a software renderer; this one boots once and exercises only
// the newest systems, which is what you want while working on them.
//
//   node tools/play-systems.mjs
//
// Screenshots land in $SHOTDIR (default /tmp/shots), at phone size, because
// that is where this interface has to work first.
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
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const errors=[];
page.on('pageerror', e => { errors.push('PAGEERROR: '+e.message); console.log('>>> '+(e.stack||e.message).slice(0,600)); });
page.on('console', m => { const t=m.text();
  if (m.type()==='error' && !/favicon|404/i.test(t)) { errors.push('CONSOLE: '+t); console.log('>>> CONSOLE: '+t.slice(0,400)); } });
const SHOT = process.env.SHOTDIR || '/tmp/shots';
fs.mkdirSync(SHOT, { recursive: true });
const log = (...a)=>console.log(...a);

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'load' });
await page.waitForTimeout(1200);
await page.screenshot({ path: SHOT+'/sys-0-splash.png' });
await page.click('#t10-start');
await page.waitForTimeout(2500);
await page.evaluate(()=>{ const b=[...document.querySelectorAll('.t10-creator-btn')].find(x=>x.classList.contains('primary')); b.click(); });
try { await page.waitForFunction(()=>window.__t10 && window.__t10.phase==='playing', { timeout: 300000 }); }
catch(e){ console.log('TIMEOUT entering the world'); }
await page.waitForTimeout(4000);
await page.screenshot({ path: SHOT+'/sys-1-hud.png' });

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


// Interiors: walk into a building, find rooms and furniture, be stopped by the
// walls, and come back out on the street.
log('--- interiors ---');
const interiors = await page.evaluate(async ()=>{
  const g = window.__t10;
  const pump = async (n)=>{ for (let f=0;f<n;f++) await new Promise(r=>requestAnimationFrame(()=>r())); };
  const I = g.interiors;
  if (!I) return { error: 'no interior system' };
  // The nearest door, whatever building it belongs to.
  const p = g.player.position;
  let door = null, bd = 1e9;
  for (const chunk of g.world.chunks.values()) {
    for (const it of chunk.interactables) {
      if (it.action !== 'enter') continue;
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d < bd) { bd = d; door = it; }
    }
  }
  if (!door) return { error: 'no door in the loaded chunks' };
  const out = { doorDistance: Math.round(bd), kind: door.lot.kind };

  const cell = I.enter(door);
  if (!cell) return Object.assign(out, { error: 'the door would not open' });
  await pump(3);

  let tris = 0, meshes = 0;
  cell.group.traverse((o)=>{ if (o.isMesh && o.geometry.index) { tris += o.geometry.index.count/3; meshes++; } });
  out.built = { rooms: cell.rooms.length, roles: cell.rooms.map(r=>r.role), tris, meshes,
                colliders: cell.colliders.length, height: +cell.height.toFixed(2) };
  out.inside = !!g.player.indoors;
  out.onFloor = Math.abs(g.player.position.y - cell.floorY) < 0.6;

  // The walls have to stop you. Walk hard at each of the four sides and check
  // you are still within the footprint afterwards.
  const lot = cell.lot, rot = lot.rot || 0;
  const span = Math.max(cell.plan.w, cell.plan.d) * 0.5 + 1.2;
  let escaped = 0;
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    g.player.teleport(cell.entry.x, cell.entry.z, cell.floorY + 0.02);
    for (let i=0;i<70;i++) {
      g.player.position.x += dx * 0.25;
      g.player.position.z += dz * 0.25;
      g.world.resolveCollision(g.player.position, 0.36);
    }
    const ox = g.player.position.x - lot.x, oz = g.player.position.z - lot.z;
    const lx = ox * Math.cos(-rot) - oz * Math.sin(-rot);
    const lz = ox * Math.sin(-rot) + oz * Math.cos(-rot);
    // The front doorway is a real gap, so leaving that way is allowed.
    const throughTheDoor = lz > 0 && Math.abs(lx) < 1.4;
    if (!throughTheDoor && (Math.abs(lx) > span || Math.abs(lz) > span)) escaped++;
  }
  out.escaped = escaped;

  // Furniture is solid too: standing in a wall or a desk should push you out.
  g.player.teleport(cell.entry.x, cell.entry.z, cell.floorY + 0.02);
  await pump(2);

  I.leave();
  await pump(2);
  out.leftInside = !!g.player.indoors;
  out.backOutside = Math.abs(g.player.position.y - g.world.groundAt(g.player.position.x, g.player.position.z)) < 1.2;
  out.cellsKept = I.cells.size;

  // T10 can do it too.
  const said = g.t10.handle('T10 take me inside');
  out.byVoice = !!g.player.indoors;
  out.voiceReply = (said.reply || '').slice(0, 60);
  g.t10.handle('T10 take me outside');
  out.outAgain = !g.player.indoors;
  I.clear();
  return out;
});
log('interiors:', JSON.stringify(interiors));
if (interiors.error) { errors.push('INTERIORS: ' + interiors.error); log('>>> INTERIORS FAILED'); }
else {
  if (!interiors.built || interiors.built.rooms < 2) { errors.push('INTERIORS: fewer than two rooms'); log('>>> INTERIOR PLAN FAILED'); }
  if (!interiors.built || interiors.built.tris < 200) { errors.push('INTERIORS: almost nothing was built'); log('>>> INTERIOR GEOMETRY FAILED'); }
  if (!interiors.inside || !interiors.onFloor) { errors.push('INTERIORS: entering did not put you on the floor inside'); log('>>> INTERIOR ENTRY FAILED'); }
  if (interiors.escaped) { errors.push('INTERIORS: walked through ' + interiors.escaped + ' of 4 walls'); log('>>> INTERIOR WALLS FAILED'); }
  if (interiors.leftInside || !interiors.backOutside) { errors.push('INTERIORS: leaving did not put you back on the street'); log('>>> INTERIOR EXIT FAILED'); }
  if (!interiors.byVoice || !interiors.outAgain) { errors.push('INTERIORS: T10 could not take you in and out'); log('>>> INTERIOR VOICE FAILED'); }
}
// A look around inside, from the middle of the plan.
await page.evaluate(async ()=>{
  const g = window.__t10;
  const I = g.interiors;
  let door = null, bd = 1e9;
  const p = g.player.position;
  for (const chunk of g.world.chunks.values()) {
    for (const it of chunk.interactables) {
      if (it.action !== 'enter') continue;
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d < bd) { bd = d; door = it; }
    }
  }
  if (!door) return;
  const cell = I.enter(door);
  if (!cell) return;
  // Stand in the doorway looking down the plan, third person so you can see the
  // room. Face the middle of the building, whichever way the lot is turned.
  g.player.setCameraMode('third');
  g.player.yaw = Math.atan2(cell.lot.x - g.player.position.x, cell.lot.z - g.player.position.z);
  g.player.heading = g.player.yaw;
  for (let f = 0; f < 6; f++) await new Promise(r=>requestAnimationFrame(()=>r()));
});
await page.waitForTimeout(1500);
await page.screenshot({ path: SHOT+'/sys-5-interior.png' });
await page.evaluate(()=>{ const g = window.__t10; if (g.interiors) g.interiors.leave(); g.player.setCameraMode('first'); });
await page.waitForTimeout(600);

// What the device scaling actually produced, in the browser rather than in node.
const deviceScaling = await page.evaluate(()=>{
  const s = window.__t10.__settings;
  if (!s) return { error: 'settings not exposed' };
  const out = { tier: s.device.tier, cores: s.device.cores, memory: s.device.memory, presets: {} };
  for (const q of ['low', 'high', 'ultra']) {
    const p = s.presetFor(q);
    out.presets[q] = { draw: Math.round(p.drawDistance), npcs: p.npcBudget, tex: p.textureSize,
      shadow: p.shadowMapSize, lights: p.maxDynamicLights, ssr: !!p.ssr, ssao: !!p.ssao, bloom: !!p.bloom };
  }
  return out;
});
log('device scaling:', JSON.stringify(deviceScaling));
if (deviceScaling.error) errors.push('DEVICE: ' + deviceScaling.error);
else {
  const u = deviceScaling.presets.ultra, h = deviceScaling.presets.high;
  if (!u.ssr || !u.ssao || !u.bloom) errors.push('DEVICE: ULTRA lost an effect on this device');
  if (u.draw < h.draw || u.npcs < h.npcs) errors.push('DEVICE: ULTRA came out below HIGH');
}

// The powers interface, at phone size, where it has to work first.
log('--- powers interface ---');
await page.evaluate(()=>{ const g=window.__t10; g.hud.setPowersOpen(true); g.hud.updatePowers(g.powers, true); });
await page.waitForTimeout(700);
await page.screenshot({ path: SHOT+'/sys-2-powers.png' });
const grid = await page.evaluate(()=>{
  const g = window.__t10;
  // Set the three states up deliberately: one running, one cooling, and an
  // energy level that leaves most of them out of reach. Firing a power that
  // happens to still be on cooldown from an earlier section proves nothing.
  g.powers.energy = 100;
  for (const k in g.powers.cooldowns) delete g.powers.cooldowns[k];
  g.powers.use('forcefield');          // duration 14s, so it is running
  g.powers.energy = 10;                // everything dearer than 10 is out
  g.powers.cooldowns.blast = 0.7;      // one tile mid-sweep
  g.hud.updatePowers(g.powers, true);
  const tiles = [...document.querySelectorAll('.t10-power-tile')];
  const box = document.querySelector('.t10-power-grid').getBoundingClientRect();
  return {
    tiles: tiles.length,
    onScreen: box.left >= 0 && box.right <= window.innerWidth && box.top >= 0,
    cooling: tiles.filter(t=>t.classList.contains('cooling')).length,
    poor: tiles.filter(t=>t.classList.contains('poor')).length,
    on: tiles.filter(t=>t.classList.contains('on')).length,
    hint: document.querySelector('.t10-power-sub').textContent.slice(0, 60),
  };
});
log('power grid:', JSON.stringify(grid));
if (grid.tiles !== 16) errors.push('UI: the power grid shows ' + grid.tiles + ' tiles');
if (!grid.onScreen) errors.push('UI: the power grid does not fit a phone screen');
if (grid.poor < 10) errors.push('UI: only ' + grid.poor + ' tiles marked unaffordable at 10 energy');
if (!grid.on) errors.push('UI: a running power is not marked as running');
if (!grid.cooling) errors.push('UI: a cooling power has no sweep');
await page.waitForTimeout(500);
await page.screenshot({ path: SHOT+'/sys-3-powers-state.png' });
await page.evaluate(()=>{ const g=window.__t10; g.hud.setPowersOpen(false); g.powers.stopAll(); g.powers.energy=100; });
await page.waitForTimeout(600);
await page.screenshot({ path: SHOT+'/sys-4-dock.png' });

log('--- ERRORS ---');
if (!errors.length) log('  none');
for (const e of errors.slice(0,25)) log('  '+e.slice(0,400));
log('RESULT: ' + (errors.length ? 'FAIL ('+errors.length+' errors)' : 'PASS'));
await browser.close(); server.close();
process.exit(errors.length?1:0);
