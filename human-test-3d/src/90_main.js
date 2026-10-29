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

class Game {
  constructor() {
    this.time = 0; this.frame = 0; this.timeScale = 1; this.loaded = false; this.acc = 0; this.fixed = 1 / 60;
    this.prof = new Profiler();
    HT.game = this;
  }
  async boot() {
    const firstRun = !localStorage.getItem || (() => { try { return !localStorage.getItem(SETTINGS_KEY); } catch (e) { return true; } })();
    Settings.load();
    if (firstRun) {
      const mobile = (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && Math.min(screen.width, screen.height) < 900;
      this.presetValues(mobile ? 'low' : 'high');
    }
    const L = this.loading = new LoadingScreen();
    document.addEventListener('pointerdown', () => this.audio && this.audio.unlock(), { once: false });
    const steps = [
      ['Initializing renderer & shader pipeline', 'Shaders', () => this.initRenderer()],
      ['Generating procedural textures', 'Textures', () => this.initTextures()],
      ['Starting XPBD physics engine', 'Physics', () => this.initPhysics()],
      ['Synthesizing weapon audio', 'Sound Effects', () => this.initAudio(0)],
      ['Synthesizing mechanical & impact audio', 'Sound Effects', () => { this.audio.synthesizeGroup(1); this.audio.synthesizeGroup(2); }],
      ['Synthesizing vocal & ambient audio', 'Sound Effects', () => { this.audio.synthesizeGroup(3); this.audio.synthesizeGroup(4); this.audio.synthesizeGroup(5); this.audio.startLoadingDrone && this.audio.unlocked && this.audio.startLoadingDrone(); }],
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
    const r = new THREE.WebGLRenderer({ canvas, antialias: G.antialias && G.preset !== 'low', powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = G.shadowQuality !== 'off'; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.maxAniso = Math.min(8, r.capabilities.getMaxAnisotropy());
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(Settings.data.controls.fov, innerWidth / innerHeight, 0.05, 2500);
    this.scene.add(this.camera);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); HT.toast && HT.toast('Graphics context lost - attempting recovery', 'bad'); reportError('WebGL context lost', 'renderer'); });
    canvas.addEventListener('webglcontextrestored', () => { HT.toast && HT.toast('Graphics context restored'); });
  }
  initTextures() { Tex.tile('floor'); Tex.tile('wall'); Tex.tile('ceiling'); Tex.grass(); Tex.smoke(); Tex.bulletHole(); Tex.scorch(); for (let i = 0; i < 6; i++) Tex.cloud(i); }
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
  }
  initEnvironment() {
    this.env = new EnvironmentManager(this);
    this.switchEnvironment(Settings.data.environment.current === 'field' ? 'field' : 'room', true, true);
  }
  initNPCs() {
    this.ai = new AISystem(this);
    this.npcs = new NPCManager(this);
    this.zombies = new ReincarnationSystem(this);
    this.diag = new Diagnostics(this);
    this.spawnDefaultSet();
  }
  spawnDefaultSet() {
    const n = INITIAL_SEEDS.length;
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
  presetValues(p) {
    const G = Settings.data.graphics;
    G.preset = p;
    if (p === 'low') Object.assign(G, { resolutionScale: 0.7, shadowQuality: 'low', textureQuality: 'low', characterDetail: 'low', ssao: false, antialias: false });
    if (p === 'high') Object.assign(G, { resolutionScale: 1.0, shadowQuality: 'high', textureQuality: 'high', characterDetail: 'high', ssao: false, antialias: true });
    if (p === 'ultra') Object.assign(G, { resolutionScale: 1.0, shadowQuality: 'ultra', textureQuality: 'ultra', characterDetail: 'ultra', ssao: true, antialias: true });
    Settings.save();
  }
  applyPreset(p) {
    this.presetValues(p);
    this.resize(); this.applyShadows();
    Tex.cache.clear();
    this.switchEnvironment(this.env.current.kind, true);
    if (this.post) this.post.setEnabled(Settings.data.graphics.ssao);
    HT.toast('Graphics preset: ' + p.toUpperCase() + ' (character detail applies to new subjects)');
    Events.emit('settings', { path: 'graphics.preset', value: p });
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
  resize() {
    if (!this.renderer) return;
    const G = Settings.data.graphics;
    const cap = G.preset === 'ultra' ? 2 : 1.5;
    const pr = Math.min(window.devicePixelRatio || 1, cap) * clamp(G.resolutionScale, 0.3, 1);
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
    document.getElementById('envName') && (document.getElementById('envName').textContent = env.name);
    if (!initial) {
      // re-place everything onto the new ground
      for (const n of this.npcs.list) {
        const p = n.root.pos.clone(); this.env.clampToBounds(p, 0.6);
        if (n.physMode === 'ragdoll') { const pel = n.rag.bodies[RAG.PELVIS].pos; const dy = this.env.groundHeight(pel.x, pel.z) + 0.4 - pel.y; for (const b of n.rag.bodies) { b.pos.y += Math.max(0, dy); b.prevPos.copy(b.pos); } }
        else n.teleport(p);
      }
      for (const pr of this.props.list) { const b = pr.body; this.env.clampToBounds(b.pos, 0.5); b.pos.y = this.env.groundHeight(b.pos.x, b.pos.z) + pr.radius + 0.3; b.prevPos.copy(b.pos); }
      this.physics.wakeAll();
      this.env.clampToBounds(this.camera.position, 0.5);
      this.camera.position.y = Math.max(this.camera.position.y, this.env.groundHeight(this.camera.position.x, this.camera.position.z) + 1.4);
      this.audio.setEnvironment(kind);
      if (this.ui && this.ui.drawerOpen) this.ui.renderDrawer();
      this.fx.clear();
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
    if (npc.lifeState !== 'alive') {
      if (npc.lifeState === 'reanimating') npc.lifeState = 'dead';
      npc.setLife('alive', 'revived');
    }
    npc.health = npc.maxHealth = 100; npc.regionDamage.fill(0); npc.hitCounts.fill(0); npc.criticalHead = false;
    npc.isZombie = false; npc.zombieTarget = null; npc.material.userData.u.uZombie.value = 0; npc.anim.zombie = 0; npc.fear = 0;
    npc.reinc = { state: 'none', timer: 0, delay: 0, eligible: false, reason: '' };
    npc.anim.limp[0] = npc.anim.limp[1] = 0; npc.anim.setPosture('stand'); npc.anim.setUpper('hang');
    if (npc.brain) { npc.brain.state = 'idle'; npc.brain.pending.length = 0; }
    if (npc.physMode === 'ragdoll') npc.startGetUp(false);
    npc.lastReaction = 'Revived';
    HT.log('sys', `${npc.idStr} ${npc.name} revived`);
  }
  resetPhysics() {
    // restore all subjects to their original spawn state and props to rest
    this.weapons.clearAll();
    for (const n of this.npcs.list) {
      if (n.lifeState !== 'alive') this.revive(n);
      n.health = 100; n.regionDamage.fill(0); n.hitCounts.fill(0);
      n.anim.clip = null; n.anim.snapshot = null;
      if (n.physMode !== 'anim') { n.rag.setDynamic(false); n.physMode = 'anim'; }
      n.root.pos.copy(n.spawn.pos); n.root.yaw = n.spawn.yaw;
      n.anim.resetFeet(n.root.pos, n.root.yaw, this.env);
      if (n.brain) { n.brain.state = 'idle'; n.brain.vel.set(0, 0, 0); n.brain.stagger.set(0, 0, 0); }
      n.update(0.016); n.computeWorldBones(); n.rag.setFromBones(n.boneWPos, n.boneWRot, true);
    }
    this.physics.wakeAll();
    this.hits.clear();
    HT.log('sys', 'Physics reset: all subjects restored to their original state');
    HT.toast('Physics reset');
  }
  resetScene() {
    this.weapons.clearAll();
    this.npcs.removeAll(); this.props.clear(); this.fx.clear(); this.hits.clear();
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
      if (k === 'Tab') this.ui.toggleDrawer();
      else if (k === 'Escape' && this.ui.drawerOpen) this.ui.toggleDrawer(false);
      else if (k === 'KeyP') this.togglePause();
      else if (k === 'KeyL') Settings.set('diagnostics.labels', !Settings.data.diagnostics.labels);
      else if (k === 'F3' || k === 'Backquote') Settings.set('diagnostics.debugPanel', !Settings.data.diagnostics.debugPanel);
      else if (k === 'KeyT') { this.timeScale = this.timeScale < 1 ? 1 : 0.25; HT.toast('Time scale ' + this.timeScale + 'x'); }
      else if (k === 'KeyM') { Settings.set('audio.muted', !Settings.data.audio.muted); this.audio.applyVolumes(); HT.toast(Settings.data.audio.muted ? 'Muted' : 'Sound on'); }
      else if (k === 'KeyZ') { this.npcs.spawnMany(1, { gender: 'random' }); this.ui.sound('spawn'); }
      else if (k === 'KeyX') { const h = this.weapons.pickNPC(60); if (h && h.npc.physMode !== 'ragdoll') { h.npc.goRagdoll('Knockdown (Sandbox)', h.npc.lifeState !== 'alive' && h.npc.lifeState !== 'zombie'); h.npc.rag.applyImpulseAt(RAG.CHEST, this.camera.getWorldDirection(new V3()).multiplyScalar(30), null); } }
      else if (k === 'Delete' || k === 'Backspace') { if (this.npcs.selected) this.npcs.remove(this.npcs.selected); }
      else if (k === 'KeyH') { Settings.set('ui.hints', !Settings.data.ui.hints); this.ui.updatePlayHint(); }
      else if (k === 'KeyB') { const p = this.player.groundTarget(6); p.y += 1.2; this.props.spawn(['crate', 'ball', 'barrel'][Math.floor(Math.random() * 3)], p); }
    });
  }
  // --- main loop ------------------------------------------------------------------------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    if (this.manual) { this.lastT = now; return; } // externally stepped (tests / capture)
    const cap = Settings.data.graphics.fpsCap;
    if (cap > 0 && now - this.lastT < 1000 / cap - 2) return;
    let rdt = Math.min((now - this.lastT) / 1000, 0.1);
    this.lastT = now;
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
    P.begin('ai'); this.ai.update(dt); this.zombies.update(dt); P.end('ai');
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
    this.props.update();
    P.end('physics');
    P.begin('fx');
    this.weapons.update(rdt);
    this.fx.update(dt);
    this.hits.update(rdt);
    this.env.update(dt, this.camera);
    this.audio.update(rdt, this.camera);
    this.footsteps(dt);
    P.end('fx');
    this.ui.update(rdt);
    this.diag.update(rdt);
    P.begin('render');
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
          if (b.tag === 'npc') this.audio.play(imp > 4 ? 'thud' : 'thudLight', { pos: b.impactPoint.clone(), gain: clamp(imp / 8, 0.15, 1) });
          else if (b.tag === 'prop') this.audio.play(b.owner.type === 'ball' ? 'thudLight' : 'hitWood', { pos: b.impactPoint.clone(), gain: clamp(imp / 8, 0.1, 0.8) });
        }
        // a kinematic (animated) NPC struck by something heavy and fast -> knockdown
        if (b.kinematic && b.tag === 'npc' && imp > 3.2 && b.impactOther && !b.impactOther.kinematic && b.impactOther.mass > 4) {
          const npc = b.owner.npc;
          if ((npc.lifeState === 'alive' || npc.lifeState === 'zombie') && npc.physMode === 'anim') {
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
          this.audio.play((grass ? 'stepGrass' : 'stepHard') + Math.floor(Math.random() * 4), { pos: f.pos.clone(), gain: clamp(0.25 + sp * 0.18, 0.2, 0.9) * (n.isZombie ? 1.3 : 1), ref: 2, reverbAmt: 0.5 });
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
