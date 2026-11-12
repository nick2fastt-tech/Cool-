// ============================================================================
// Game: boot/loading sequence, main loop, global controls, scene management
// ============================================================================
const INITIAL_SEEDS = [1000 + 7919 * 0, 20231, 4100, 31337, 2000 + 7919 * 3, 777123];

class LoadingScreen {
  constructor() {
    this.cats = ['3D Models', 'Textures', 'Shaders', 'Animations', 'Physics', 'Sound Effects', 'Weapons', 'Environment'];
    const list = document.getElementById('ldList');
    this.items = this.cats.map(c => { const li = document.createElement('li'); li.textContent = c; list.appendChild(li); return li; });
    this.fill = document.getElementById('ldFill'); this.pct = document.getElementById('ldPct'); this.task = document.getElementById('ldTask'); this.tip = document.getElementById('ldTip');
    this.tipI = Math.floor(Math.random() * TIPS.length);
    this.showTip();
    this.tipTimer = setInterval(() => this.showTip(), 3400);
    this.shown = 0;
  }
  showTip() { this.tip.style.opacity = '0'; setTimeout(() => { this.tip.innerHTML = 'TIP: ' + TIPS[this.tipI++ % TIPS.length]; this.tip.style.opacity = '1'; }, 300); }
  set(p, task, cat, state) {
    this.fill.style.width = (p * 100).toFixed(1) + '%';
    this.pct.textContent = Math.round(p * 100) + '%';
    if (task) this.task.textContent = task;
    if (cat != null) { const li = this.items[this.cats.indexOf(cat)]; if (li) { li.classList.remove('active', 'done'); li.classList.add(state || 'active'); } }
  }
  done() {
    clearInterval(this.tipTimer);
    const el = document.getElementById('loading'); el.classList.add('fade');
    setTimeout(() => el.remove(), 1000);
  }
}
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// the nearest usual display rate to a measured one
function snapHz(hz) { let b = hz, bd = 1e9; for (const r of [60, 72, 75, 90, 100, 120, 144, 165, 240]) { const d = Math.abs(hz - r) / r; if (d < 0.06 && d < bd) { bd = d; b = r; } } return b; }
class Game {
  constructor() {
    this.time = 0; this.frame = 0; this.timeScale = 1; this.loaded = false; this.acc = 0; this.fixed = 1 / 60;
    this.prof = new Profiler();
    HT.game = this;
  }
  async boot() {
    Settings.load();
    detectGfx();
    this.presetValues('highmax'); // always HIGH MAX
    const L = this.loading = new LoadingScreen();
    document.addEventListener('pointerdown', () => this.audio && this.audio.unlock(), { once: false });
    const steps = [
      ['Initializing renderer & shader pipeline', 'Shaders', () => this.initRenderer()],
      ['Generating procedural textures', 'Textures', () => this.initTextures()],
      ['Starting XPBD physics engine', 'Physics', () => this.initPhysics()],
      ['Synthesizing weapon audio', 'Sound Effects', () => this.initAudio(0)],
      ['Synthesizing mechanical & impact audio', 'Sound Effects', () => { this.audio.synthesizeGroup(1); this.audio.synthesizeGroup(2); }],
      ['Synthesizing vocal & ambient audio', 'Sound Effects', () => { this.audio.synthesizeGroup(3); this.audio.synthesizeGroup(4); this.audio.synthesizeGroup(5); this.audio.synthesizeGroup(6); this.audio.synthesizeGroup(7); this.audio.startLoadingDrone && this.audio.unlocked && this.audio.startLoadingDrone(); }],
      ['Building weapon models & viewmodels', 'Weapons', () => this.initWeapons()],
      ['Building environment', 'Environment', () => this.initEnvironment()],
      ['Generating test subjects (procedural humans)', '3D Models', () => this.initNPCs()],
      ['Calibrating animation rigs & IK', 'Animations', () => this.warmAnimations()],
      ['Compiling materials', 'Shaders', () => this.compile()],
      ['Building interface', null, () => this.initUI()]
    ];
    const t0 = performance.now();
    try {
      for (let i = 0; i < steps.length; i++) {
        const [task, cat] = steps[i];
        L.set(i / steps.length, task, cat, 'active');
        await nextFrame(); await nextFrame();
        await steps[i][2]();
        const nextCat = steps[i + 1] ? steps[i + 1][1] : null;
        if (cat && cat !== nextCat) L.set((i + 1) / steps.length, null, cat, 'done');
        this.audio && this.audio.unlocked && this.audio.play('tick', { bus: 'ui', gain: 0.4, vary: false });
      }
    } catch (e) {
      reportError(e, 'boot');
      L.set(1, 'Error during loading: ' + (e && e.message ? e.message : e), null);
      document.getElementById('ldTask').style.color = '#ff5a5f';
      return;
    }
    for (const c of L.cats) L.set(1, null, c, 'done');
    // cinematic minimum
    const el = performance.now() - t0;
    if (el < 2600) { L.set(1, 'Ready', null); await sleep(2600 - el); }
    L.set(1, 'Entering test facility...', null);
    await sleep(350);
    this.loaded = true;
    document.getElementById('hud').classList.remove('hidden');
    L.done();
    this.audio.stopLoadingDrone();
    if (this.audio.unlocked) { this.audio.startAmbience(); this.audio.play('ready', { bus: 'ui', gain: 0.5 }); }
    HT.log('sys', 'HUMAN TEST 3D initialized. ' + this.npcs.list.length + ' test subjects ready.');
    this.ui.updatePlayHint();
    this.lastT = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }
  // --- init steps ---------------------------------------------------------------------
  initRenderer() {
    const canvas = document.getElementById('view');
    const G = Settings.data.graphics;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = G.shadowQuality !== 'off'; r.shadowMap.type = THREE.PCFSoftShadowMap;
    // V1.16 phones: the soft shadow filter with four depth reads instead of thirteen (the same smooth
    // edge, one texel wide), and the shadow map redrawn every other frame (see step) - shadows are the
    // costliest part of every lit pixel on a phone's graphics chip
    if (GFX.mobile) {
      const C = THREE.ShaderChunk, k = 'shadowmap_pars_fragment', src = C[k];
      const a = src.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )'), b = src.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )', a);
      if (a > 0 && b > a) C[k] = src.slice(0, a) + `#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			vec2 st = shadowCoord.xy * shadowMapSize - 0.5;
			vec2 f = fract( st );
			vec2 uv = ( floor( st ) + 0.5 ) * texelSize;
			shadow = mix(
				mix( texture2DCompare( shadowMap, uv, shadowCoord.z ), texture2DCompare( shadowMap, uv + vec2( texelSize.x, 0.0 ), shadowCoord.z ), f.x ),
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, texelSize.y ), shadowCoord.z ), texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ), f.x ),
				f.y );
		` + src.slice(b);
      r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = true;
    }
    this.renderer = r;
    this.maxAniso = Math.min(GFX.mobile ? 4 : 8, r.capabilities.getMaxAnisotropy());
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(Settings.data.controls.fov, innerWidth / innerHeight, 0.05, 2500);
    this.scene.add(this.camera);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.pace) { this.pace.probe = 16; this.pace.pd.length = 0; } });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); HT.toast && HT.toast('Graphics context lost - attempting recovery', 'bad'); reportError('WebGL context lost', 'renderer'); });
    canvas.addEventListener('webglcontextrestored', () => { HT.toast && HT.toast('Graphics context restored'); });
  }
  initTextures() { Tex.tile('floor'); Tex.tile('panel'); Tex.tile('ceiling'); Tex.grass(); Tex.smoke(); Tex.bulletHole(); Tex.scorch(); for (let i = 0; i < 6; i++) Tex.cloud(i); }
  initPhysics() {
    this.physics = new PhysicsWorld();
    this.applyPhysicsSettings();
    // self-test: drop a box and verify it settles
    const tw = new PhysicsWorld(); tw.planes = [{ n: new V3(0, 1, 0), d: 0 }];
    const b = new RBody({ type: SHAPE.BOX, he: new V3(0.3, 0.3, 0.3) }, 10); b.pos.set(0, 2, 0); b.prevPos.copy(b.pos);
    const own = { physKind: 'prop', bodies: [b], canSleep: true }; b.owner = own; tw.addBody(b); tw.owners.add(own);
    for (let i = 0; i < 180; i++) tw.step(1 / 60);
    this.physicsSelfTest = Math.abs(b.pos.y - 0.3) < 0.03 ? 'pass' : 'warn (' + b.pos.y.toFixed(3) + ')';
  }
  initAudio(group) {
    this.audio = new AudioEngine(this);
    this.audio.init();
    this.audio.synthesizeGroup(group);
  }
  initWeapons() {
    this.input = new Input(this);
    this.player = new Player(this);
    this.fx = new FX(this);
    this.hits = new HitSystem(this);
    this.props = new Props(this); this.props.build();
    this.weapons = new Weapons(this); this.weapons.build();
    this.gore = new GoreSystem(this);
    this.contact = new ContactShadows(this);
  }
  initEnvironment() {
    this.transit = new TransitSystem(this);
    this.env = new EnvironmentManager(this);
    const last = Settings.data.environment.current;
    this.switchEnvironment(last === 'field' || last === 'subway' || last === 'playground' ? last : 'room', true, true);
  }
  initNPCs() {
    this.ai = new AISystem(this);
    this.npcs = new NPCManager(this);
    this.zombies = new ReincarnationSystem(this);
    this.vampires = new VampireSystem(this);
    this.horror = new HorrorSystem(this);
    this.store = new SceneStore(this);
    this.accessories = new AccessorySystem(this);
    this.diag = new Diagnostics(this);
    this.spawnDefaultSet();
  }
  spawnDefaultSet() {
    const n = INITIAL_SEEDS.length, env = this.env.current;
    if (env && env.cameraStart) { // maps with their own start: people on the spawn spots, the camera at the start view
      const c = env.cameraStart;
      this.camera.position.copy(c.pos); this.player.yaw = c.yaw; this.player.pitch = c.pitch;
      for (let i = 0; i < n; i++) {
        const sp = env.spawnPoints[i % env.spawnPoints.length], p = new V3(sp.x + (Math.random() - 0.5), sp.y, sp.z + (Math.random() - 0.5));
        env.clampToBounds(p, 0.6);
        this.npcs.spawn({ seed: INITIAL_SEEDS[i], pos: p, yaw: Math.atan2(c.pos.x - p.x, c.pos.z - p.z) });
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * 0.32;
      const p = new V3(Math.sin(a) * 6.5, 0, -Math.cos(a) * 6.5 + 7);
      const yaw = Math.atan2(this.camera.position.x - p.x, this.camera.position.z - p.z) + (i % 2 ? 0.25 : -0.2);
      this.npcs.spawn({ seed: INITIAL_SEEDS[i], pos: p, yaw });
    }
    this.camera.position.set(0, 1.65, 7.5);
    this.player.yaw = 0; this.player.pitch = -0.08;
  }
  warmAnimations() {
    for (let i = 0; i < 20; i++) { for (const n of this.npcs.list) n.update(1 / 60); }
    this.physics.step(1 / 60);
    this.npcs.postPhysics(1 / 60);
  }
  // compile every material of a freshly loaded map up front (into the target the frame really uses),
  // so walking into a new area never stalls on shader compilation
  warmShaders() {
    try {
      const r = this.renderer, post = this.post && this.post.enabled ? this.post : null;
      if (post) { if (!post.rt) post.makeTargets(); r.setRenderTarget(post.rt); r.compile(this.scene, this.camera); r.setRenderTarget(null); }
      else r.compile(this.scene, this.camera);
    } catch (e) { reportError(e, 'warm shaders'); }
  }
  compile() {
    this.player.update(0.016);
    try { this.renderer.compile(this.scene, this.camera); this.renderer.compile(this.weapons.vmScene, this.weapons.vmCam); } catch (e) { reportError(e, 'compile'); }
    this.renderer.render(this.scene, this.camera);
  }
  initUI() {
    this.ui = new UI(this); this.ui.build();
    this.input.setupTouch();
    this.audio.setEnvironment(this.env.current.kind);
    this.bindKeys();
    if (typeof PostFX !== 'undefined') { this.post = new PostFX(this); this.post.setEnabled(Settings.data.graphics.ssao); }
  }
  // --- settings helpers -----------------------------------------------------------------
  presetValues() {
    // HIGH MAX for everyone; phones get the same look with internally lighter costs
    const G = Settings.data.graphics, m = GFX.mobile;
    Object.assign(G, { preset: 'highmax', resolutionScale: 1.0, shadowQuality: m ? 'high' : 'ultra', textureQuality: m ? 'high' : 'ultra', characterDetail: m ? 'high' : 'ultra', ssao: !m, antialias: true });
    Settings.save();
  }
  applyPreset() {
    this.presetValues();
    this.resize(); this.applyShadows();
    Tex.cache.clear();
    this.switchEnvironment(this.env.current.kind, true);
    if (this.post) this.post.setEnabled(Settings.data.graphics.ssao);
    Events.emit('settings', { path: 'graphics.preset', value: 'highmax' });
  }
  applyShadows() {
    const sq = Settings.data.graphics.shadowQuality;
    this.renderer.shadowMap.enabled = sq !== 'off';
    this.switchEnvironment(this.env.current.kind, true);
    this.scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => x.needsUpdate = true); } });
  }
  applyPhysicsSettings(massChanged) {
    const P = Settings.data.physics, ph = this.physics;
    ph.gravity.set(0, -P.gravity, 0); ph.friction = P.friction; ph.restitution = P.bounciness; ph.substeps = P.substeps | 0;
    ph.npcCollisions = P.npcCollisions; ph.selfCollisions = P.selfCollisions; ph.propCollisions = P.propCollisions;
    ph.wakeAll && this.npcs && ph.wakeAll();
    if (massChanged && this.npcs) {
      for (const n of this.npcs.list) { const tot = n.rig.mass * P.massScale; n.rag.totalMass = tot; n.rag.bodies.forEach((b, i) => b.setMass(tot * RAG_MASS[i])); }
    }
  }
  // internal dynamic resolution: keeps HIGH MAX smooth on slower devices without changing the preset
  adaptResolution(rdt) {
    // V1.16: reacts within a second, drops in proportion to how far behind it is, takes back a raise
    // that did not hold and waits longer before trying it again, so it settles instead of bouncing.
    // The rate it aims for is the one the frame pacer runs at (see loop), which follows the display.
    // The level it settles on is remembered per map on this device, so the next visit starts there.
    const D = this.dynRes || (this.dynRes = this.newDynRes());
    if (document.hidden || (this.ui && this.ui.drawerOpen)) { D.acc = 0; D.n = 0; D.slow = 0; return; }
    D.acc += rdt; D.n++; D.cool -= rdt; D.ceilT -= rdt; D.sinceRaise += rdt; D.stableT += rdt;
    const P = this.pace, target = this.fpsTarget || Settings.data.graphics.fpsCap || 60;
    if (rdt > 1.75 / target) D.slow++;
    if (D.acc < 1.0) return;
    const fps = D.n / D.acc, slowK = D.slow / D.n, floor = GFX.mobile ? 0.5 : 0.55, win = D.acc;
    D.acc = 0; D.n = 0; D.slow = 0;
    if (D.cool > 0) return;
    if (D.ceilT <= 0) D.ceil = 1;
    let s = D.scale;
    const behind = fps < target * 0.88 || slowK > 0.25;
    if (behind && P && s < 0.78 && target > 62 && P.hz / (P.skip + 1) >= 40) {
      // a fast display that cannot be kept up with even at a lower resolution: every other refresh
      // instead (a steady 45 on a 90 Hz screen beats an uneven 60-70), at a fuller picture again
      P.extra++; D.retryT = D.retryGap; D.retryGap = Math.min(600, D.retryGap * 2);
      s = Math.min(1, s * 1.25); D.ceil = 1; D.ceilT = 0; D.good = 0; D.sinceRaise = 99;
    } else if (behind && D.sinceRaise < 6 && D.prev < s) {
      // the raise just tried did not hold: back to where it did, and leave it longer each time
      s = D.prev; D.ceil = s; D.ceilT = D.ceilGap; D.ceilGap = Math.min(240, D.ceilGap * 2); D.good = 0; D.sinceRaise = 99;
    } else if (behind && s > floor) {
      D.ceil = Math.max(floor, s - 0.04); D.ceilT = Math.max(D.ceilT, 30); D.good = 0;
      // pixels drawn go with the square of the scale
      s = Math.max(floor, s * clamp(Math.sqrt(Math.max(0.3, fps / target)) * 0.97, 0.8, 0.94));
    } else if (!behind && fps > target * 0.96 && slowK < 0.05 && s < D.ceil) { if (++D.good >= 3) { D.prev = s; s = Math.min(D.ceil, s + 0.05); D.good = 0; D.sinceRaise = 0; } }
    else D.good = 0;
    // now and then try the display's full rate again (less and less often if it keeps failing)
    if (P && P.extra > 0 && !behind && s >= 0.99) { D.retryT -= win; if (D.retryT <= 0) { P.extra--; D.retryT = D.retryGap; D.cool = 2.5; } }
    if (Math.abs(s - D.scale) > 0.004) { D.scale = s; D.cool = Math.max(D.cool, 1.2); D.stableT = 0; this.resize(); }
    else if (D.stableT > 12 && D.sinceRaise > 8) this.rememberScale();
  }
  newDynRes() { return { scale: 1, acc: 0, n: 0, cool: 2, good: 0, ceil: 1, ceilT: 0, ceilGap: 30, slow: 0, retryT: 0, retryGap: 45, prev: 1, sinceRaise: 99, stableT: 0 }; }
  // the settled resolution of each map, kept on the device
  rememberScale() {
    const D = this.dynRes, k = this.env.current && this.env.current.kind; if (!D || !k) return;
    const M = this.dynMem || (this.dynMem = {});
    if (Math.abs((M[k] != null ? M[k] : -1) - D.scale) < 0.03) return;
    M[k] = +D.scale.toFixed(2);
    try { localStorage.setItem('ht3d.dyn', JSON.stringify(M)); } catch (e) { }
  }
  recallScale(kind) {
    if (!this.dynMem) { this.dynMem = {}; try { const v = JSON.parse(localStorage.getItem('ht3d.dyn') || '{}'); if (v && typeof v === 'object') this.dynMem = v; } catch (e) { } }
    const D = this.dynRes || (this.dynRes = this.newDynRes()), m = +this.dynMem[kind];
    // a phone that has not seen this map yet starts a little under full and climbs if it can
    const s = m >= 0.5 && m <= 1 ? m : (GFX.mobile ? 0.85 : 1);
    Object.assign(D, { acc: 0, n: 0, slow: 0, cool: 2.5, good: 0, ceil: 1, ceilT: 0, ceilGap: 30, prev: s, sinceRaise: 99, stableT: 0 });
    if (Math.abs(s - D.scale) > 0.004) { D.scale = s; this.resize(); }
  }
  resize() {
    if (!this.renderer) return;
    const G = Settings.data.graphics;
    const cap = GFX.mobile ? 1.6 : 2;
    const pr = Math.min(window.devicePixelRatio || 1, cap) * clamp(G.resolutionScale, 0.3, 1) * (this.dynRes ? this.dynRes.scale : 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    if (this.post) this.post.resize();
  }
  switchEnvironment(kind, rebuild, initial) {
    if (!rebuild && this.env.current && this.env.current.kind === kind) return;
    const env = this.env.load(kind);
    const ph = this.physics;
    ph.planes = env.planes;
    ph.heightfield = env.heightfield ? terrainHeight : null;
    ph.heightNormalFn = env.heightfield ? (x, z, out) => env.groundNormal(x, z, out) : null;
    if (env.floorAt) { ph.heightfield = (x, z, y) => env.floorAt(x, z, y); ph.heightNormalFn = (x, z, out, y) => env.groundNormal(x, z, out, y); }
    ph.setStaticBoxes(env.boxes || null);
    ph.movers = null;
    this.shadowDirty = true;
    this.recallScale(kind);
    if (env.attachPhysics) env.attachPhysics(ph);
    document.getElementById('envName') && (document.getElementById('envName').textContent = env.name);
    if (!initial) {
      // re-place everything onto the new ground (maps with spawn areas spread people over them)
      let si = 0;
      for (const n of this.npcs.list) {
        const p = n.root.pos.clone();
        if (env.spawnPoints && (env.kind === 'subway' || env.spreadSpawn)) { const sp = env.spawnPoints[si++ % env.spawnPoints.length]; p.set(sp.x + (Math.random() - 0.5) * 2, sp.y, sp.z + (Math.random() - 0.5) * 2); }
        this.env.clampToBounds(p, 0.6);
        // a body in the middle of getting up (or turning) falls back to the ground and restarts safely
        if (n.physMode === 'getup') { n.anim.clip = null; n.goRagdoll('Moved', !n.active); }
        if (n.anim.action) n.anim.action = null;
        if (n.brain) { this.ai.endGrab(n); this.ai.endFeed(n); }
        if (n.physMode === 'ragdoll') { const pel = n.rag.bodies[RAG.PELVIS].pos; const dy = this.env.groundHeight(pel.x, pel.z, pel.y) + 0.4 - pel.y; for (const b of n.rag.bodies) { b.pos.y += Math.max(0, dy); b.prevPos.copy(b.pos); } }
        else n.teleport(p);
        // a reset brings them back here, not to where they stood on the old map
        n.spawn.pos.set(p.x, this.env.groundHeight(p.x, p.z, p.y + 0.1), p.z);
      }
      for (const pr of this.props.list) { const b = pr.body; this.env.clampToBounds(b.pos, 0.5); b.pos.y = this.env.groundHeight(b.pos.x, b.pos.z, b.pos.y) + pr.radius + 0.3; b.prevPos.copy(b.pos); }
      this.accessories.restoreAll();
      this.physics.wakeAll();
      if (env.cameraStart) { this.camera.position.copy(env.cameraStart.pos); this.player.yaw = env.cameraStart.yaw; this.player.pitch = env.cameraStart.pitch; }
      else if (this.camera.position.y < -1 || Math.abs(this.camera.position.x) > 30 || Math.abs(this.camera.position.z) > 30) { this.camera.position.set(0, 1.65, 7.5); this.player.yaw = 0; this.player.pitch = -0.08; }
      this.env.clampToBounds(this.camera.position, 0.5);
      this.camera.position.y = Math.max(this.camera.position.y, this.env.groundHeight(this.camera.position.x, this.camera.position.z, this.camera.position.y) + 1.4);
      this.audio.setEnvironment(kind);
      this.warmShaders();
      if (this.ui && this.ui.drawerOpen) this.ui.renderDrawer();
      this.fx.clear(); if (this.gore) this.gore.clear();
    }
  }
  // --- scene control ------------------------------------------------------------------
  togglePause() {
    Settings.set('physics.paused', !Settings.data.physics.paused);
    HT.log('sys', Settings.data.physics.paused ? 'Physics paused' : 'Physics resumed');
    this.ui.sound('toggle');
  }
  stepOnce() { this.pendingStep = true; }
  revive(npc) {
    if (npc.gore && (npc.gore.anyCut || npc.gore.headGone)) {
      const n2 = this.npcs.regenerate(npc, {});
      if (n2) HT.log('sys', `${n2.idStr} ${n2.name} rebuilt`);
      return n2;
    }
    if (npc.gore) this.gore.releaseNPC(npc);
    // release grapples / meals in both directions before the state reset
    if (npc.brain) { this.ai.endGrab(npc); this.ai.endFeed(npc); this.ai.endPile(npc); }
    if (npc.grabbedBy && npc.grabbedBy.brain) this.ai.endGrab(npc.grabbedBy);
    for (const o of this.npcs.list) if (o.brain && o.brain.state === 'zPile' && o.brain.victim2 === npc) this.ai.endPile(o);
    npc.pilers = 0;
    npc.infection = null; npc.anim.crawl = 0; npc.anim.setAction(null);
    if (this.vampires) this.vampires.onRevive(npc); if (this.accessories) this.accessories.restore(npc);
    if (npc.lifeState !== 'alive') {
      if (npc.lifeState === 'reanimating') npc.lifeState = 'dead';
      npc.setLife('alive', 'revived');
    }
    npc.health = npc.maxHealth = 100; npc.regionDamage.fill(0); npc.hitCounts.fill(0); npc.criticalHead = false;
    npc.cond.state = 'ok'; npc.cond.t = 0; npc.helpedBy = npc.calledBy = null; if (npc.downTimer > 1e6) npc.downTimer = 0; npc.dirt = 0;
    npc.isZombie = false; npc.zombieTarget = null; npc.material.userData.u.uZombie.value = 0; npc.anim.zombie = 0; npc.fear = 0;
    { const u = npc.material.userData.u; if (u.uSick) { u.uSick.value = 0; u.uSweat.value = 0; } npc.anim.sick = 0; npc.infection = null; npc.zlook = null; if (u.uZTint) { u.uZTint.value.set(0.78, 0.9, 0.7); u.uZLook.value.set(0, 0, 0, 0); } }
    npc.reinc = { state: 'none', timer: 0, delay: 0, eligible: false, reason: '' };
    npc.anim.limp[0] = npc.anim.limp[1] = 0; npc.anim.setPosture('stand'); npc.anim.setUpper('hang');
    if (npc.brain) { npc.brain.state = 'idle'; npc.brain.pending.length = 0; }
    if (npc.physMode === 'ragdoll') npc.startGetUp(false);
    npc.lastReaction = 'Revived';
    HT.log('sys', `${npc.idStr} ${npc.name} revived`);
    return npc;
  }
  resetPhysics() {
    // restore all subjects to their original spawn state and props to rest
    this.weapons.clearAll();
    for (const n0 of this.npcs.list.slice()) {
      let n = n0;
      if (n.lifeState !== 'alive' || n.gore) n = this.revive(n) || n;
      if (n !== n0) { n.spawn.pos.copy(n0.spawn.pos); n.spawn.yaw = n0.spawn.yaw; n.spawnKind = n0.spawnKind; }
      if (n.vamp && n.vamp.state !== 'none' && n.lifeState === 'alive') this.vampires.cure(n);
      n.health = 100; n.regionDamage.fill(0); n.hitCounts.fill(0);
      n.cond.state = 'ok'; n.cond.t = 0; n.helpedBy = n.calledBy = null; n.downTimer = 0;
      n.anim.clip = null; n.anim.snapshot = null; n.anim.action = null;
      if (this.transit) this.transit.release(n, true);
      if (n.physMode !== 'anim') { n.rag.setDynamic(false); n.physMode = 'anim'; }
      n.root.pos.copy(n.spawn.pos); n.root.yaw = n.spawn.yaw;
      n.anim.resetFeet(n.root.pos, n.root.yaw, this.env);
      if (n.brain) { n.brain.state = 'idle'; n.brain.vel.set(0, 0, 0); n.brain.stagger.set(0, 0, 0); }
      n.update(0.016); n.computeWorldBones(); n.rag.setFromBones(n.boneWPos, n.boneWRot, true);
      if (n.spawnKind === 'vampire' && Settings.data.vampires.enabled) this.vampires.makeVampire(n, { instant: true, why: 'reset', keepStyle: true });
      if (n.spawnKind === 'zombie') this.zombies.zombifyInstant(n);
      if (n.horror) { n.health = n.maxHealth = n.horror.def.health; if (n.brain) { n.brain.state = 'hIdle'; n.brain.hTarget = null; } }
    }
    this.vampires.restoreAshes(); this.vampires.curePlayer(); this.accessories.restoreAll();
    this.physics.wakeAll();
    this.hits.clear(); this.gore.clear();
    HT.log('sys', 'Physics reset: all subjects restored to their original state');
    HT.toast('Physics reset');
  }
  resetScene() {
    this.weapons.clearAll();
    this.npcs.removeAll(); this.props.clear(); this.fx.clear(); this.hits.clear(); this.gore.clear();
    this.vampires.ashes.length = 0; this.vampires.curePlayer();
    this.weapons.resetAmmo(); this.timeScale = 1;
    if (Settings.data.physics.paused) Settings.set('physics.paused', false);
    this.spawnDefaultSet();
    HT.log('sys', 'Scene reset to default test set');
    HT.toast('Scene reset');
  }
  focusOn(npc) {
    const p = npc.boneWPos[B.chest], c = this.camera.position;
    const d = _v1.subVectors(p, c);
    this.player.yaw = Math.atan2(-d.x, -d.z); this.player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  }
  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (!this.loaded) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      const k = e.code;
      if (k === 'Tab') { e.preventDefault(); this.ui.toggleDrawer(this.ui.drawerOpen && this.ui.mode === 'sandbox' ? false : true, 'sandbox'); }
      else if (k === 'KeyO') this.ui.toggleDrawer(this.ui.drawerOpen && this.ui.mode === 'settings' ? false : true, 'settings');
      else if (k === 'Escape' && this.ui.drawerOpen) this.ui.toggleDrawer(false);
      else if (k === 'KeyP') this.togglePause();
      else if (k === 'KeyL') Settings.set('diagnostics.labels', !Settings.data.diagnostics.labels);
      else if (k === 'F3' || k === 'Backquote') Settings.set('diagnostics.debugPanel', !Settings.data.diagnostics.debugPanel);
      else if (k === 'KeyT') { this.timeScale = this.timeScale < 1 ? 1 : 0.25; HT.toast('Time scale ' + this.timeScale + 'x'); }
      else if (k === 'KeyM') { Settings.set('audio.muted', !Settings.data.audio.muted); this.audio.applyVolumes(); HT.toast(Settings.data.audio.muted ? 'Muted' : 'Sound on'); }
      else if (k === 'KeyZ') { this.npcs.spawnMany(1, { gender: 'random' }); this.ui.sound('spawn'); }
      else if (k === 'KeyX') { const h = this.weapons.pickNPC(60); if (h && h.npc.physMode !== 'ragdoll') { h.npc.goRagdoll('Knockdown (Sandbox)', !h.npc.active); h.npc.rag.applyImpulseAt(RAG.CHEST, this.camera.getWorldDirection(new V3()).multiplyScalar(30), null); } }
      else if (k === 'Delete' || k === 'Backspace') { if (this.npcs.selected) this.npcs.remove(this.npcs.selected); }
      else if (k === 'KeyH') { Settings.set('ui.hints', !Settings.data.ui.hints); this.ui.updatePlayHint(); }
      else if (k === 'KeyB') { const p = this.player.groundTarget(6); p.y += 1.2; this.props.spawn(['crate', 'ball', 'barrel'][Math.floor(Math.random() * 3)], p); }
    });
  }
  // --- main loop ------------------------------------------------------------------------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    if (this.manual) { this.lastT = now; return; } // externally stepped (tests / capture)
    // V1.16 frame pacing by the display: the refresh rate is measured from the gaps between refreshes,
    // and frames are drawn on every refresh, every second, every third... - never at a rate the screen
    // cannot show evenly (a 60 cap on a 90 Hz phone used to give a juddering 45 and a needlessly low
    // resolution). 60 Hz: 60 (or 30); 90 Hz: 90; 120 Hz: 60; 144 Hz: 72.
    const P = this.pace || (this.pace = { prev: now, d: [], hz: 60, skip: 1, extra: 0, probe: 24, pd: [] });
    const gap = now - P.prev; P.prev = now;
    if (P.probe > 0) {
      // a quarter of a second without drawing (at the start, and when the page comes back): the bare
      // rhythm of the display, which a busy frame would hide
      if (gap > 3 && gap < 60) P.pd.push(gap);
      if (--P.probe === 0) { if (P.pd.length > 8) { P.pd.sort((x, y) => x - y); const hz = snapHz(1000 / P.pd[P.pd.length >> 1]); if (hz >= 40 && hz <= 260) P.hz = Math.max(48, hz); } P.pd.length = 0; }
      this.lastT = now; return;
    }
    if (gap > 3 && gap < 60) {
      P.d.push(gap);
      if (P.d.length >= 40) { P.d.sort((x, y) => x - y); const hz = snapHz(1000 / P.d[6]); P.d.length = 0; if (hz > P.hz + 3 && hz <= 260) P.hz = hz; }   // otherwise only ever learned upward
    }
    const cap = Settings.data.graphics.fpsCap;
    P.skip = (cap > 0 ? Math.max(1, Math.floor(P.hz / cap + 0.2)) : 1) + P.extra;
    this.fpsTarget = P.hz / P.skip;
    if (now - this.lastT < (P.skip - 0.5) * 1000 / P.hz) return;
    let rdt = Math.min((now - this.lastT) / 1000, 0.1);
    this.lastT = now;
    this.adaptResolution(rdt);
    const t0 = performance.now();
    try { this.step(rdt); } catch (e) { reportError(e, 'frame'); }
    this.prof.frame(performance.now() - t0);
  }
  step(rdt) {
    const P = this.prof;
    this.frame++;
    const dt = rdt * this.timeScale;
    this.time += dt;
    CharShared.uTime.value = this.time;
    // input / player (real time)
    this.player.update(rdt);
    this.env.preStep(dt); // moving parts of the map (trains) and whatever rides them
    P.begin('ai'); this.ai.update(dt); this.zombies.update(dt); this.vampires.update(dt); P.end('ai');
    P.begin('anim'); this.npcs.update(dt); P.end('anim');
    P.begin('physics');
    const paused = Settings.data.physics.paused;
    let nSteps = 0;
    if (this.pendingStep) { nSteps = 1; this.pendingStep = false; }
    else if (!paused) {
      this.acc += dt;
      nSteps = Math.floor(this.acc / this.fixed);
      if (nSteps > 4) { nSteps = 4; this.acc = 0; } else this.acc -= nSteps * this.fixed;
    }
    if (nSteps > 0) {
      this.physics.beginFrame(nSteps, this.fixed);
      for (let i = 0; i < nSteps; i++) this.physics.step(this.fixed);
    }
    this.handleImpacts();
    this.npcs.postPhysics(dt);
    this.accessories.updateAll(dt);
    this.props.update();
    P.end('physics');
    P.begin('fx');
    this.weapons.update(rdt);
    this.fx.update(dt);
    this.gore.update(dt);
    this.contact.update();
    this.hits.update(rdt);
    this.env.update(dt, this.camera);
    this.audio.update(rdt, this.camera);
    this.footsteps(dt);
    P.end('fx');
    this.ui.update(rdt);
    this.diag.update(rdt);
    P.begin('render');
    // phones: the shadow map every other frame (every frame when frames are already few)
    if (GFX.mobile && ((this.frame & 1) === 0 || this.shadowDirty || (this.fpsTarget || 60) < 50)) { this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = false; }
    if (this.post && this.post.enabled) this.post.render(); else this.renderer.render(this.scene, this.camera);
    this.weapons.render(this.renderer);
    P.end('render');
    this.input.endFrame();
  }
  // physics impacts -> sounds + reactions of animated NPCs hit by flying bodies/props
  handleImpacts() {
    for (const b of this.physics.bodies) {
      if (b.impact > 0) {
        const imp = b.impact;
        if (imp > 1.6 && !b.kinematic && (b.lastSound == null || this.time - b.lastSound > 0.25)) {
          b.lastSound = this.time;
          if (b.tag === 'npc') {
            this.audio.play(imp > 4 ? 'thud' : 'thudLight', { pos: b.impactPoint.clone(), gain: clamp(imp / 8, 0.15, 1) });
            // surface effect at the actual contact point when a body part hits the ground
            const ip = b.impactPoint, gy = this.env.groundHeight(ip.x, ip.z, ip.y + 0.2);
            if (imp > 2.6 && ip.y < gy + 0.15) {
              const gn = this.env.groundNormal(ip.x, ip.z, _v3);
              this.fx.bodyDust(_v2.set(ip.x, gy, ip.z), gn, this.env.current.surface, clamp((imp - 2) / 5, 0.3, 1));
              const npc = b.owner && b.owner.npc, G = npc && npc.gore;
              if (npc && !npc.horror) npc.dirt = Math.min(0.85, (npc.dirt || 0) + 0.025 * (imp - 2) * (1 + (this.env.current.wetness || 0)));   // V1.15: falls leave clothes dirty
              if (G && this.gore.on && G.blood > 0.3 && Settings.data.gore.pools && Math.random() < 0.6) this.gore.decals.add(_v2.set(ip.x, gy, ip.z), gn, 0.18 + Math.random() * 0.12, 'drop');
            }
          }
          else if (b.tag === 'prop') this.audio.play(b.owner.type === 'ball' ? 'thudLight' : 'hitWood', { pos: b.impactPoint.clone(), gain: clamp(imp / 8, 0.1, 0.8) });
        }
        // V1.15: a hard knock to the head (falling onto it, a heavy blow) leaves someone out cold
        if (b.tag === 'npc' && !b.kinematic && b.index === RAG.HEAD && imp > 5.2) {
          const npc = b.owner && b.owner.npc;
          if (npc && npc.physMode === 'ragdoll' && npc.cond && npc.cond.state === 'ok' && (npc.lifeState === 'alive' || npc.lifeState === 'zombie')) npc.knockOut({ cause: 'head injury', severity: clamp((imp - 5.2) / 6, 0.1, 1) });
        }
        // a kinematic (animated) NPC struck by something heavy and fast -> knockdown
        if (b.kinematic && b.tag === 'npc' && imp > 3.2 && b.impactOther && !b.impactOther.kinematic && b.impactOther.mass > 4) {
          const npc = b.owner.npc;
          const busy = npc.brain && (npc.brain.victim || npc.brain.corpse || npc.grabbedBy);
          if (npc.active && npc.physMode === 'anim' && !busy) {
            const m = b.impactOther.mass * imp;
            if (m > 70 * npc.personality.toughness) {
              npc.goRagdoll('Knockdown (Impact)');
              const dir = _v1.subVectors(b.pos, b.impactOther.pos).setY(0.2).normalize();
              npc.rag.applyImpulseAt(b.index, dir.multiplyScalar(m * 0.3), null);
              HT.log('hit', `${npc.idStr} knocked down by impact (${m.toFixed(0)} kg·m/s)`);
            } else if (this.ai) this.ai.onHit(npc, { region: REGION.TORSO, dir: _v1.subVectors(b.pos, b.impactOther.pos).setY(0).normalize().clone(), force: 4, threatPos: b.impactOther.pos.clone() });
          }
        }
        b.impact = 0; b.impactOther = null;
      }
    }
  }
  surfaceAt(p, n) {
    const env = this.env.current;
    if (env.kind === 'field') return (env.rainK || 0) > 0.35 ? 'stepWet' : 'stepGrass';
    if (env.surfaceAt) { const s = env.surfaceAt(p); return (env.rainK || 0) > 0.35 && s !== 'metal' ? 'stepWet' : s === 'grass' ? 'stepGrass' : s === 'rubber' ? 'stepRubber' : s === 'metal' ? 'stepMetal' : 'stepHard'; }
    if (env.kind === 'subway') {
      if (n.riding || (env.carAt && env.carAt(p.x, p.z, p.y + 0.3))) return 'stepMetal';
      return p.y > -1 ? 'stepHard' : 'stepTile';
    }
    return 'stepHard';
  }
  footsteps(dt) {
    const env = this.env.current; if (!env) return;
    const grass = env.surface === 'grass';
    const cam = this.camera.position;
    for (const n of this.npcs.list) {
      if (n.physMode !== 'anim') continue;
      if (n.root.pos.distanceToSquared(cam) > 400) continue;
      for (let s = 0; s < 2; s++) {
        const f = n.anim.feet[s];
        const landed = !f.swing && f._wasSwing;
        f._wasSwing = f.swing;
        if (landed) {
          const sp = n.anim.speed;
          const hk = n.horror ? n.horror.kind : null;
          if (hk === 'slasher') this.audio.play('heavyStep', { pos: f.pos.clone(), gain: 0.9, ref: 3, reverbAmt: 0.7 });
          else {
            // the surface underfoot: wet or dry grass, station tile, street concrete, a train's metal floor
            const zs = n.isZombie ? n.anim.zstyle : null, drag = zs && zs.drag && zs.drag[s] > 0.5;
            const surf = drag && Math.random() < 0.7 ? 'scuff' : this.surfaceAt(f.pos, n);
            this.audio.play(surf + Math.floor(Math.random() * (surf === 'scuff' ? 2 : 4)), { pos: f.pos.clone(), gain: clamp(0.25 + sp * 0.18, 0.2, 0.9) * (n.isZombie ? 1.3 : (hk === 'doll' ? 0.45 : (n.lifeState === 'vampire' ? 0.55 : 1))), rate: hk === 'doll' ? 1.6 : 1, ref: 2, reverbAmt: 0.5 });
            // clothes rustle when someone runs past
            if (sp > 2.6 && s === 0 && Math.random() < 0.6) this.audio.play('rustle' + (Math.random() < 0.5 ? 0 : 1), { pos: n.boneWPos[B.hips].clone(), gain: 0.22, ref: 1.5, reverbAmt: 0.2 });
          }
        }
      }
    }
  }
}

function bootGame() {
  const game = new Game();
  HT.game = game;
  game.boot();
}
if (typeof window !== 'undefined' && !window.HT3D_NO_BOOT) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootGame); else bootGame();
}
