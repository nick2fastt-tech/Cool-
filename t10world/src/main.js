// T10 World - application entry point. Boots the renderer, runs the creator,
// then builds and drives the living world.
import * as THREE from '../vendor/three.module.js';
import { settings, QUALITY_PRESETS, PerformanceGovernor } from './core/settings.js';
import { InputManager } from './core/input.js';
import { audio } from './core/audio.js';
import { saveGame, loadGame, hasSave, clearSave, saveInfo } from './core/save.js';
import { clamp01, clampv, lerpv, hashString, makeRng, TAU } from './core/math.js';
import { World, CHUNK_SIZE } from './world/world.js';
import { Atmosphere } from './render/atmosphere.js';
import { PostProcessor } from './render/post.js';
import { Player } from './player/player.js';
import { NPCManager } from './entities/npc.js';
import { TrafficManager } from './entities/traffic.js';
import { AnimalManager } from './entities/animals.js';
import { Apocalypse } from './entities/apocalypse.js';
import { T10Brain } from './t10/brain.js';
import { HUD } from './ui/hud.js';
import { MapOverlay } from './ui/map.js';
import { CommandBook } from './ui/commandbook.js';
import { CharacterCreator } from './ui/creator.js';
import { defaultPlayerAppearance } from './human/appearance.js';
import { STATES } from './human/animator.js';
import { setWetness } from './world/materials.js';

const DEFAULT_WORLD_NAME = 'Nightfall';

const WORLD_NAME_PARTS = [
  ['Iron', 'Silver', 'Amber', 'Hollow', 'Crimson', 'Quiet', 'Salt', 'Ember', 'North', 'Glass',
   'Low', 'Far', 'Pale', 'Storm', 'Copper', 'Long', 'New', 'Old', 'Grey', 'Bright'],
  ['haven', 'reach', 'fall', 'gate', 'harbour', 'ridge', 'shore', 'crest', 'point', 'vale',
   'water', 'hollow', 'field', 'bay', 'run', 'stone', 'mere', 'cross', 'wick', 'moor'],
];

export function randomWorldName() {
  const a = WORLD_NAME_PARTS[0][Math.floor(Math.random() * WORLD_NAME_PARTS[0].length)];
  const b = WORLD_NAME_PARTS[1][Math.floor(Math.random() * WORLD_NAME_PARTS[1].length)];
  return a + b;
}

export class Game {
  constructor(container) {
    this.container = container;
    this.running = false;
    this.phase = 'boot';
    this.clock = new THREE.Clock();
    this.governor = new PerformanceGovernor();
    this.accumTime = 0;
    this.frame = 0;
    this.gravityScale = 1;
    this.statsVisible = false;
    this.worldName = DEFAULT_WORLD_NAME;
    this.worldSeed = hashString(DEFAULT_WORLD_NAME);

    this.setupRenderer();
    this.setupScene();

    this.input = new InputManager(this.renderer.domElement);
    this.hud = new HUD(this, this.uiRoot);
    this.map = new MapOverlay(this, this.uiRoot);
    this.book = new CommandBook(this, this.uiRoot);
    this.creator = new CharacterCreator(this.renderer, this.uiRoot, (appearance) => this.startWorld(appearance));

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) audio.suspend(); else audio.resume();
    });

    this.bindGlobalKeys();
  }

  // -------------------------------------------------------------------------
  setupRenderer() {
    const canvas = document.createElement('canvas');
    canvas.id = 't10-canvas';
    this.container.appendChild(canvas);
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: settings.preset.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = settings.preset.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x0b0d10, 1);

    this.uiRoot = document.createElement('div');
    this.uiRoot.id = 't10-ui';
    this.container.appendChild(this.uiRoot);

    this.onResize();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9ec4e8);
    this.camera = new THREE.PerspectiveCamera(settings.get('fov'), 1, 0.12, 2400);
    this.camera.position.set(0, 2, 6);
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, settings.preset.pixelRatioCap);
    const scale = settings.preset.renderScale * (this.governor ? this.governor.scale : 1);
    this.renderer.setPixelRatio(dpr * scale);
    this.renderer.setSize(w, h, true);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (this.post) this.post.setSize(Math.round(w * dpr * scale), Math.round(h * dpr * scale));
  }

  bindGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (e.code === 'Escape') {
        if (this.book.visible) { this.book.hide(); e.preventDefault(); return; }
        if (this.map.visible) { this.map.hide(); e.preventDefault(); return; }
        if (this.hud.chatOpen) { this.hud.setChatOpen(false); e.preventDefault(); return; }
        this.hud.toggleSettings();
        e.preventDefault();
        return;
      }
      if (typing) return;
      if (this.phase !== 'playing') return;
      if (e.code === settings.get('keyBindings').t10) { this.hud.toggleChat(); e.preventDefault(); }
      else if (e.code === settings.get('keyBindings').map) { this.map.toggle(); e.preventDefault(); }
      else if (e.code === settings.get('keyBindings').camera) { this.player.toggleCameraMode(); this.hud.refreshSettings(); }
      else if (e.code === settings.get('keyBindings').interact) this.doInteract();
      else if (e.code === settings.get('keyBindings').enterVehicle) this.doVehicleToggle();
    });
    this.canvas.addEventListener('mousedown', () => {
      if (this.phase === 'playing' && !this.hud.chatOpen && !this.hud.settingsOpen && !this.input.isTouch) {
        this.input.requestPointerLock();
      }
    });
  }

  // -------------------------------------------------------------------------
  // Boot flow
  // -------------------------------------------------------------------------
  setWorldIdentity(name) {
    const clean = String(name || '').trim().slice(0, 28);
    this.worldName = clean || DEFAULT_WORLD_NAME;
    // The name is the seed: two players typing the same word get the same city.
    this.worldSeed = hashString(this.worldName.toLowerCase());
    return this.worldName;
  }

  showCreator() {
    this.phase = 'creator';
    this.creator.open();
    this.hud.orb.style.display = 'none';
    this.hud.settingsBtn.style.display = 'none';
    this.start();
  }

  startWorld(appearance) {
    this.phase = 'loading';
    this.appearance = appearance;
    audio.init();

    if (this.loadingEl) this.loadingEl.remove();
    this.loadingEl = document.createElement('div');
    this.loadingEl.className = 't10-loading';
    this.loadingEl.innerHTML = '<div class="t10-loading-inner"><div class="t10-loading-orb"></div>' +
      '<div class="t10-loading-title">T10 WORLD</div>' +
      '<div class="t10-loading-text">Building the city…</div></div>';
    this.uiRoot.appendChild(this.loadingEl);
    this.loadingText = this.loadingEl.querySelector('.t10-loading-text');

    // Build across a few frames so the loading screen actually paints.
    setTimeout(() => this.buildWorld(), 60);
  }

  buildWorld() {
    const steps = [
      ['Laying out streets…', () => {
        this.world = new World(this.scene, this.worldSeed);
      }],
      ['Raising the skyline…', () => {
        this.atmosphere = new Atmosphere(this.scene, this.renderer);
        this.post = new PostProcessor(this.renderer, this.scene, this.camera);
        this.post.applySettings();
      }],
      ['Waking the city…', () => {
        this.player = new Player(this.world, this.scene, this.camera, this.appearance);
        this.npcs = new NPCManager(this.world, this.scene, this.atmosphere);
        this.traffic = new TrafficManager(this.world, this.scene);
        this.animals = new AnimalManager(this.world, this.scene, this.atmosphere);
        this.apocalypse = new Apocalypse(this);
        this.npcs.apocalypse = this.apocalypse;
        // People only get to lay a hand on you when the world is ending.
        this.npcs.onPlayerAttacked = (npc, how) => this.onPlayerAttacked(npc, how);
      }],
      ['Bringing T10 online…', () => {
        this.t10 = new T10Brain(this);
      }],
      ['Finding you a street…', () => {
        // Different worlds wake you up on different streets.
        const rng = makeRng(this.worldSeed ^ 0x5f3a7);
        const a = rng() * Math.PI * 2;
        const r = 90 + rng() * 380;
        const spawn = this.world.findSpawnPoint(Math.cos(a) * r, Math.sin(a) * r);
        this.player.spawnOnStreet(spawn.x, spawn.z);
        this.player.setCameraMode(settings.get('cameraMode'));
        // Pre-stream the chunks around the spawn so you don't wake into a void.
        for (let i = 0; i < 90; i++) {
          this.world.update(1 / 60, spawn.x, spawn.z, 40);
          if (!this.world.buildQueue.length) break;
        }
      }],
    ];
    let i = 0;
    const next = () => {
      if (i >= steps.length) return this.finishBoot();
      const [label, fn] = steps[i++];
      if (this.loadingText) this.loadingText.textContent = label;
      setTimeout(() => { fn(); next(); }, 30);
    };
    next();
  }

  finishBoot() {
    this.phase = 'playing';
    if (this.loadingEl) {
      this.loadingEl.classList.add('fade');
      setTimeout(() => { if (this.loadingEl) { this.loadingEl.remove(); this.loadingEl = null; } }, 700);
    }
    this.hud.orb.style.display = '';
    this.hud.settingsBtn.style.display = '';
    this.applyQuality();
    this.onResize();

    // T10's first words — the only instruction the game ever gives you.
    setTimeout(() => {
      this.t10Say('You\'re awake. This is ' + this.worldName + ' \u2014 you\'re on ' +
        this.world.city.describeLocation(this.player.position.x, this.player.position.z) +
        ', and it\'s ' + this.atmosphere.clockString() + '.');
    }, 2600);
    setTimeout(() => {
      this.t10Say('Nothing here needs doing. Tap the orb and say my name if you want something \u2014 "T10 make it rain", "T10 I wanna wear something new". ' +
        'Say just "T10" on its own to see everything I know: ' + this.t10.commandCount() + ' commands.');
    }, 8000);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.tick();
    };
    requestAnimationFrame(loop);
  }

  // -------------------------------------------------------------------------
  tick() {
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.1);
    this.frame++;

    if (this.phase === 'creator') {
      this.creator.update(dt);
      this.renderer.setRenderTarget(null);
      this.renderer.clear();
      this.creator.render();
      return;
    }
    if (this.phase !== 'playing') {
      this.renderer.setRenderTarget(null);
      this.renderer.clear();
      return;
    }

    // --- Adaptive resolution ---
    if (settings.get('autoQuality')) {
      const prev = this.governor.scale;
      const s = this.governor.update(rawDt);
      if (Math.abs(s - prev) > 0.001) this.onResize();
    }

    this.input.update(dt);
    this.updateGameplay(dt);
    this.render(dt);
    this.input.endFrame();
  }

  updateGameplay(dt) {
    const p = this.player;

    // World streaming follows the camera, not the player, so driving fast
    // doesn't outrun the city.
    const focus = p.inVehicle ? p.inVehicle.position : p.position;
    this.atmosphere.update(dt, focus);
    this.world.setNightFactor(this.t10.forceStreetLights != null ? this.t10.forceStreetLights : this.atmosphere.nightFactor);
    // Snow doesn't make the road shine — it covers it.
    const snow = clamp01(this.atmosphere.current.snow || 0);
    const wet = clamp01(this.atmosphere.current.rain * 1.2) * (1 - snow * 0.85);
    this.world.setWetness(wet);
    this.world.setSnow(snow * clamp01(this.atmosphere.current.rain * 1.6));
    if (this.post) this.post.wetness = wet;
    this.world.update(dt, focus.x, focus.z, this.frame < 120 ? 10 : 5);

    p.update(dt, this.input, this.npcs, this.traffic);
    this.npcs.update(dt, p.position);
    this.traffic.update(dt, focus, p.inVehicle, this.npcs.npcs);
    this.animals.update(dt, p.position, this.traffic.vehicles);
    if (this.apocalypse) this.apocalypse.update(dt, p.position);
    this.t10.update(dt);

    // Interaction prompt.
    const t = p.interactTarget;
    if (t && settings.get('showInteractPrompts')) {
      this.hud.setPrompt(t.label, this.input.isTouch ? '' : keyLabel(settings.get('keyBindings').interact));
    } else {
      this.hud.setPrompt(null);
    }
    this.hud.setVehicleMode(!!p.inVehicle);
    this.map.update();

    // Touch interact button maps to the contextual action.
    if (this.input.edges.interact) this.doInteract();
    if (this.input.edges.enterVehicle) this.doVehicleToggle();

    // Ambience follows where you are and what the sky is doing.
    audio.updateAmbience(this.atmosphere.ambientState(p.position, this.world), dt);

    if (this.statsVisible && this.frame % 12 === 0) this.updateStats();
  }

  render(dt) {
    this.renderer.setRenderTarget(null);
    if (this.post) {
      this.post.render(dt);
      // renderer.info reflects the last pass (a fullscreen blit), so keep the
      // scene numbers the post processor captured for the stats readout.
      this.lastRenderInfo = this.post.sceneInfo;
    } else {
      this.renderer.render(this.scene, this.camera);
      this.lastRenderInfo = { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles };
    }
  }

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------
  doInteract() {
    if (this.phase !== 'playing' || this.hud.chatOpen) return;
    const result = this.player.interact(this);
    if (!result) return;
    switch (result.kind) {
      case 'vehicle': this.t10.lastVehicle = result.vehicle; break;
      case 'talk': {
        const npc = result.npc;
        const line = npc.pickLine();
        npc.say(line, 2.4);
        this.hud.say(npc.appearance.firstName + ': ' + line);
        break;
      }
      case 'door': {
        const name = result.lot && result.lot.name;
        this.hud.say(name ? 'The door to ' + name + ' is locked from the inside.' : 'Locked.');
        audio.doorClose();
        break;
      }
      case 'atm':
        this.hud.say('Balance: $' + this.player.money.toLocaleString() + '. Ask T10 for more.');
        audio.cash();
        break;
      case 'search': {
        const found = Math.random() < 0.45 ? Math.floor(Math.random() * 40) + 5 : 0;
        if (found) { this.player.addMoney(found); this.hud.say('Found $' + found + '.'); audio.cash(); }
        else this.hud.say('Nothing in there.');
        break;
      }
      case 'sit': this.hud.say(this.player.sitting ? 'Sitting.' : 'Standing.'); break;
      case 'bus': this.hud.say('No bus due for a while.'); break;
      case 'play': this.hud.say('Nice court. Ask T10 for a ball.'); break;
      default: break;
    }
  }

  doVehicleToggle() {
    if (this.phase !== 'playing') return;
    if (this.player.inVehicle) { this.player.exitVehicle(); return; }
    const v = this.traffic.nearest(this.player.position.x, this.player.position.z, 6.5, (vv) => !vv.isPlayerVehicle);
    if (v) { this.player.enterVehicle(v, 0); this.t10.lastVehicle = v; }
  }

  // -------------------------------------------------------------------------
  // T10 plumbing
  // -------------------------------------------------------------------------
  sendToT10(text) {
    if (!this.t10) return;
    this.hud.addChatMessage('you', text);
    const res = this.t10.handle(text);
    this.hud.addChatMessage('t10', res.reply);
    this.hud.pulseOrb();
    audio.t10Blip(res.unknown || !res.ok ? 'error' : 'reply');
    this.hud.say(res.reply, 't10');
  }

  t10Say(text) {
    if (!this.hud) return;
    this.hud.addChatMessage('t10', text);
    this.hud.pulseOrb();
    this.hud.say(text, 't10');
    audio.t10Blip('reply');
  }

  /** Any full-screen panel takes the controls away from the world. */
  syncInputSuspend() {
    this.input.setSuspended(this.hud.chatOpen || this.hud.settingsOpen ||
      (this.map && this.map.visible) || (this.book && this.book.visible));
  }

  /** A hostile or an infected person reached you. */
  onPlayerAttacked(npc, how) {
    const p = this.player;
    if (p.immortal || p.godMode) {
      if (!this._untouchableSaid || performance.now() - this._untouchableSaid > 20000) {
        this._untouchableSaid = performance.now();
        this.t10Say(npc.appearance.firstName + ' went for you and bounced off. You asked to never die.');
      }
      return;
    }
    if (!p.knockDown(how === 'infect' ? 5 : 4, how)) return;
    audio.t10Blip('error');
    // Being floored repeatedly is the point of a purge; being told about it
    // every four seconds is not.
    const now = performance.now();
    if (this._downSaid && now - this._downSaid < 25000) return;
    this._downSaid = now;
    this.t10Say(how === 'infect'
      ? npc.appearance.firstName + ' got hold of you. You\'re down — I\'ll have you up in a moment. Say "T10 never let me die" if you want that to stop happening.'
      : npc.appearance.firstName + ' put you on the pavement. Say "T10 I never want to die" and nobody touches you again.');
  }

  onChatToggled(open) {
    this.syncInputSuspend();
    // Opening the chat switches you into T10's machine sight.
    if (this.post) this.post.setVisionMode(open ? (this.t10 && this.t10.visionMode !== 'off' ? this.t10.visionMode : 't10') : (this.t10 && this.t10.visionMode !== 'off' ? this.t10.visionMode : 'off'));
    this.hud.setOrbActive(open);
  }

  onMenuToggled(open) {
    this.syncInputSuspend();
  }

  onMapToggled() {
    this.syncInputSuspend();
  }

  onBookToggled() {
    this.syncInputSuspend();
  }

  setVisionMode(mode) {
    if (this.post) this.post.setVisionMode(mode === 'off' && this.hud.chatOpen ? 't10' : mode);
  }

  setGravity(scale) {
    this.gravityScale = scale;
    if (this.player) {
      this.player.jumpVelocity = 5.4 / Math.max(0.15, Math.sqrt(scale));
    }
  }

  setShadows(on) {
    this.renderer.shadowMap.enabled = on;
    if (this.atmosphere) this.atmosphere.sun.castShadow = on;
    this.scene.traverse((o) => { if (o.isMesh) o.castShadow = on && o.userData.wantsShadow !== false; });
  }

  applyQuality() {
    const p = settings.preset;
    this.renderer.shadowMap.enabled = p.shadows;
    if (this.atmosphere) this.atmosphere.applySettings();
    if (this.post) this.post.applySettings();
    this.onResize();
    if (this.hud) this.hud.refreshSettings();
  }

  setStatsVisible(v) {
    this.statsVisible = v;
    this.hud.setStatsVisible(v);
  }

  updateStats() {
    const w = this.world.stats();
    const fps = Math.round(this.governor.fps);
    const info = this.lastRenderInfo || this.renderer.info.render;
    this.hud.updateStats(
      fps + ' fps  ·  ' + settings.preset.label +
      '\n' + info.calls + ' draws  ·  ' + Math.round(info.triangles / 1000) + 'k tris' +
      '\n' + this.npcs.count() + ' people  ·  ' + this.traffic.count() + ' cars  ·  ' + this.animals.count() + ' animals' +
      '\n' + w.chunks + ' chunks  ·  ' + this.atmosphere.clockString() + '  ·  ' + this.atmosphere.weatherName()
    );
  }

  // -------------------------------------------------------------------------
  save() {
    if (this.phase !== 'playing') return false;
    return saveGame({
      worldName: this.worldName,
      worldSeed: this.worldSeed,
      player: this.player.serialize(),
      time: this.atmosphere.timeOfDay,
      day: this.atmosphere.day,
      weather: this.atmosphere.weather,
      markers: this.t10.markers,
      quality: settings.get('quality'),
    });
  }

  load() {
    const d = loadGame();
    if (!d || this.phase !== 'playing') return false;
    if (d.player) {
      Object.assign(this.player.appearance, d.player.appearance || {});
      this.player.human.appearance = this.player.appearance;
      this.player.human.rebuildBody();
      this.player.rebuildAppearance();
      this.player.teleport(d.player.x, d.player.z, d.player.y);
      this.player.heading = d.player.heading || 0;
      this.player.yaw = d.player.yaw || 0;
      this.player.setMoney(d.player.money || 0);
      if (d.player.cameraMode) this.player.setCameraMode(d.player.cameraMode);
    }
    if (d.time != null) this.atmosphere.setTimeOfDay(d.time);
    if (d.day != null) this.atmosphere.day = d.day;
    if (d.weather) this.atmosphere.setWeather(d.weather, true);
    if (d.markers) { this.t10.markers.length = 0; for (const m of d.markers) this.t10.markers.push(m); }
    return true;
  }

  confirmLeave() {
    const ok = window.confirm('Leave the world? Your position and look will be saved.');
    if (!ok) return false;
    this.save();
    window.location.reload();
    return true;
  }
}

function keyLabel(code) {
  if (!code) return '';
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R');
}

// ---------------------------------------------------------------------------
export function boot() {
  const container = document.getElementById('t10-root') || document.body;
  const game = new Game(container);
  window.__t10 = game;

  const splash = document.getElementById('t10-splash');
  const startBtn = document.getElementById('t10-start');
  const continueBtn = document.getElementById('t10-continue');
  const nameInput = document.getElementById('t10-worldname');
  const diceBtn = document.getElementById('t10-dice');
  const seedHint = document.getElementById('t10-seedhint');

  const suggested = randomWorldName();
  if (nameInput) nameInput.placeholder = suggested;

  const refreshHint = () => {
    if (!seedHint || !nameInput) return;
    const name = nameInput.value.trim() || nameInput.placeholder;
    seedHint.innerHTML = 'The name shapes the city &mdash; <b>' + escapeHtml(name) +
      '</b> builds one layout, anything else builds another.';
  };
  if (nameInput) {
    nameInput.addEventListener('input', refreshHint);
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startBtn.click(); });
  }
  if (diceBtn) {
    diceBtn.addEventListener('click', () => {
      nameInput.value = randomWorldName();
      refreshHint();
      audio.init();
      audio.ui('tick');
    });
  }
  refreshHint();

  const saved = saveInfo();
  if (continueBtn && saved) {
    continueBtn.style.display = '';
    continueBtn.textContent = saved.worldName ? 'Continue: ' + saved.worldName : 'Continue';
  }

  const hideSplash = () => {
    if (!splash) return;
    splash.classList.add('gone');
    setTimeout(() => { splash.style.display = 'none'; }, 700);
  };

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      audio.init();
      game.setWorldIdentity((nameInput && nameInput.value) || (nameInput && nameInput.placeholder) || suggested);
      hideSplash();
      game.showCreator();
    });
  }
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      audio.init();
      const d = loadGame();
      if (!d) return;
      game.setWorldIdentity(d.worldName || DEFAULT_WORLD_NAME);
      if (d.worldSeed) game.worldSeed = d.worldSeed;
      const a = (d.player && d.player.appearance) || defaultPlayerAppearance('male');
      hideSplash();
      game.startWorld(a);
      game.start();
      const check = setInterval(() => {
        if (game.phase === 'playing') { clearInterval(check); game.load(); }
      }, 200);
    });
  }
  return game;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
