// T10 World - application entry point. Boots the renderer, runs the creator,
// then builds and drives the living world.
import * as THREE from '../vendor/three.module.js';
import { settings, QUALITY_PRESETS, PerformanceGovernor, perf } from './core/settings.js';
import { PerfMonitor } from './core/perfmon.js';
import { InputManager } from './core/input.js';
import { audio } from './core/audio.js';
import { saveGame, loadGame, hasSave, clearSave, saveInfo } from './core/save.js';
import { clamp01, clampv, lerpv, hashString, makeRng, TAU } from './core/math.js';
import { World, CHUNK_SIZE } from './world/world.js';
import { Subway } from './world/subway.js';
import { Atmosphere } from './render/atmosphere.js';
import { PostProcessor } from './render/post.js';
import { Player } from './player/player.js';
import { NPCManager } from './entities/npc.js';
import { TrafficManager } from './entities/traffic.js';
import { AnimalManager } from './entities/animals.js';
import { Apocalypse } from './entities/apocalypse.js';
import { Gore } from './entities/gore.js';
import { Arsenal } from './player/arsenal.js';
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
    this.perf = new PerfMonitor();
    this.accumTime = 0;
    this.frame = 0;
    this.gravityScale = 1;
    this.timeScale = 1;
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
    window.addEventListener('orientationchange', () => {
      // Safari reports the old size until after the rotation settles.
      this.onResize();
      setTimeout(() => this.onResize(), 120);
      setTimeout(() => this.onResize(), 500);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.onResize());
      window.visualViewport.addEventListener('scroll', () => this.onResize());
    }
    // A lost context is otherwise a silent black screen.
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      if (this.hud) this.hud.say('Graphics context lost. Reload the page to carry on.', 't10');
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.onResize();
    });
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

  /**
   * The viewport, never zero. Mobile browsers report a zero height while the
   * URL bar animates or the device rotates, and one zero reading used to leave
   * a zero-height drawing buffer and a non-finite projection matrix — a black
   * screen that never came back, because no further resize event fires.
   */
  viewportSize() {
    const vv = window.visualViewport;
    const candidatesW = [vv && vv.width, window.innerWidth,
      document.documentElement && document.documentElement.clientWidth,
      this.container && this.container.clientWidth];
    const candidatesH = [vv && vv.height, window.innerHeight,
      document.documentElement && document.documentElement.clientHeight,
      this.container && this.container.clientHeight];
    const pick = (list, fallback) => {
      for (const v of list) if (Number.isFinite(v) && v > 0) return Math.round(v);
      return fallback;
    };
    return { w: Math.max(1, pick(candidatesW, 360)), h: Math.max(1, pick(candidatesH, 640)) };
  }

  onResize() {
    const { w, h } = this.viewportSize();
    const dpr = Math.min(window.devicePixelRatio || 1, settings.preset.pixelRatioCap);
    const scale = settings.preset.renderScale * (this.governor ? this.governor.scale : 1);
    this.renderer.setPixelRatio(dpr * scale);
    this.renderer.setSize(w, h, true);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (this.post) this.post.setSize(Math.max(1, Math.round(w * dpr * scale)), Math.max(1, Math.round(h * dpr * scale)));
    this._viewW = w;
    this._viewH = h;
  }

  /**
   * Cheap insurance, run a few times a second: if the drawing buffer has lost
   * its size or the projection matrix has gone non-finite, put it back. Nothing
   * else notices a broken viewport, because the browser only tells you once.
   */
  checkViewport() {
    const canvas = this.renderer.domElement;
    const bad = !canvas.width || !canvas.height ||
      !Number.isFinite(this.camera.projectionMatrix.elements[0]) ||
      !Number.isFinite(this.camera.aspect) || this.camera.aspect <= 0;
    if (bad) { this.onResize(); return true; }
    // A pixel of drift while the URL bar moves isn't worth reallocating render
    // targets for; a real change is.
    const { w, h } = this.viewportSize();
    if (Math.abs(w - this._viewW) > 2 || Math.abs(h - this._viewH) > 2) { this.onResize(); return true; }
    return false;
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

  /** Options chosen on the creation screen, applied as the world is built. */
  applyWorldOptions(opts) {
    this.worldOptions = Object.assign({
      where: 'downtown', time: 9.5, weather: 'fair', busy: 1, quality: 'high', maturity: 18,
    }, opts || {});
    if (this.worldOptions.quality) { settings.setQuality(this.worldOptions.quality); this.applyQuality(); }
    if (this.worldOptions.maturity) settings.setMaturity(this.worldOptions.maturity);
    return this.worldOptions;
  }

  /** A point inside a named district, for the creation screen's start choice. */
  findDistrictPoint(key, rng) {
    for (let i = 0; i < 1200; i++) {
      const a = (i * 2.399963) % (Math.PI * 2);
      const r = ((i + (rng ? rng() : 0)) / 1200) * 1100;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.world.city.districtAt(x, z) !== key) continue;
      if (this.world.isWater(x, z)) continue;
      return { x, z };
    }
    return null;
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
        this.gore = new Gore(this);
        this.arsenal = new Arsenal(this);
        this.subway = new Subway(this);
        this.subway.buildEntrances(this.world);
        this.apocalypse = new Apocalypse(this);
        this.npcs.apocalypse = this.apocalypse;
        // People only get to lay a hand on you when the world is ending.
        this.npcs.onPlayerAttacked = (npc, how) => this.onPlayerAttacked(npc, how);
        this.npcs.gore = this.gore;
      }],
      ['Bringing T10 online…', () => {
        this.t10 = new T10Brain(this);
      }],
      ['Finding you a street…', () => {
        const o = this.worldOptions || {};
        // Different worlds wake you up on different streets, and the option
        // chosen on the creation screen decides which part of town.
        const rng = makeRng(this.worldSeed ^ 0x5f3a7);
        let sx, sz;
        const district = o.where && o.where !== 'random' ? o.where : null;
        if (district) {
          const spot = this.findDistrictPoint(district, rng);
          if (spot) { sx = spot.x; sz = spot.z; }
        }
        if (sx == null) {
          const a = rng() * Math.PI * 2;
          const r = 90 + rng() * 380;
          sx = Math.cos(a) * r; sz = Math.sin(a) * r;
        }
        if (o.time != null) this.atmosphere.timeOfDay = o.time;
        if (o.weather) this.atmosphere.setWeather(o.weather, true);
        if (o.busy != null) {
          this.npcs.densityScale = o.busy;
          this.traffic.densityScale = o.busy;
          this.animals.densityScale = o.busy;
        }
        const spawn = this.world.findSpawnPoint(sx, sz);
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
    // timeScale drives bullet time; the governor still samples real frame time.
    const dt = Math.min(rawDt, 0.1) * (this.timeScale == null ? 1 : this.timeScale);
    this.frame++;
    if (this.phase === 'playing') this.perf.sample(rawDt, this);

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
      const prevScale = this.governor.scale;
      const prevLoad = this.governor.load;
      const s = this.governor.update(rawDt, this.perf);
      perf.load = this.governor.load;
      if (Math.abs(s - prevScale) > 0.001) this.onResize();
      // Shadows are the single most expensive thing left when the load has
      // already been cut in half, so they go before the picture gets soft.
      if (Math.abs(this.governor.load - prevLoad) > 0.001) {
        const wantShadows = settings.preset.shadows && this.governor.load > 0.45;
        if (wantShadows !== this._shadowsOn) { this._shadowsOn = wantShadows; this.setShadows(wantShadows); }
      }
    }

    // A few times a second is plenty, and it costs nothing when all is well.
    if ((this.frame & 15) === 0) this.checkViewport();

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
    this.world.cullCamera = this.camera;
    this.world.update(dt, focus.x, focus.z, this.frame < 120 ? 10 : 5);

    p.update(dt, this.input, this.npcs, this.traffic);
    this.npcs.update(dt, p.position);
    this.traffic.update(dt, focus, p.inVehicle, this.npcs.npcs);
    this.animals.update(dt, p.position, this.traffic.vehicles);
    if (this.npcs) this.npcs.playerIsZombie = p.isZombie;
    if (this.apocalypse) this.apocalypse.update(dt, p.position);
    if (this.gore) this.gore.update(dt, focus);
    if (this.subway) this.subway.update(dt, focus);
    if (this.arsenal) {
      this.arsenal.aiming = !!this.input.buttons.aim;
      // Holding USE keeps an automatic firing.
      this.arsenal.triggerHeld = !!this.input.buttons.interact;
      this.arsenal.update(dt, this.input);
      if (this.input.edges.reload) this.arsenal.reload();
      this.hud.setArmed(this.arsenal.armed);
    }
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
  /**
   * USE is the whole game in one button. Armed, it fires; in a seat, it gets
   * you up; on a train platform, it gets you on; otherwise it does whatever
   * you're standing next to.
   */
  doInteract() {
    if (this.phase !== 'playing' || this.hud.chatOpen) return;
    if (this.arsenal && this.arsenal.armed) { this.arsenal.pullTrigger(); return; }
    if (this.subway && this.doSubway()) return;
    if (this.player.isZombie && this.doZombieBite()) return;
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
        this.player.human.animator.setState(STATES.DOOR);
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
    if (this.gore) {
      const dx = p.position.x - npc.position.x, dz = p.position.z - npc.position.z;
      const len = Math.hypot(dx, dz) || 1;
      this.gore.hit(p.position.x, p.position.y, p.position.z, how === 'infect' ? 0.85 : 0.6, dx / len, dz / len);
    }
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

  /**
   * USE, underground. Board a waiting train, get off one, or climb back out
   * to the street. @returns true if it did something.
   */
  doSubway() {
    const sub = this.subway;
    const p = this.player;
    if (sub.ridingTrain) {
      if (p.sitting) { p.standUp(); return true; }
      if (sub.alight()) { this.t10Say('Off at ' + (sub.playerStation ? sub.playerStation.name : 'the platform') + '.'); return true; }
      // Moving: sit down instead.
      if (p.sitDownHere()) { this.t10Say('Take a seat.'); return true; }
      return true;
    }
    if (p.inSubway) {
      if (p.sitting) { p.standUp(); return true; }
      const t = sub.board();
      if (t) { this.t10Say('Aboard the ' + t.line.name + '. Use again to sit down.'); return true; }
      // Near the stairs? Back up to the street.
      const st = sub.playerStation;
      if (st && Math.hypot(p.position.x - st.x, p.position.z - st.z) > 12) {
        sub.leave();
        this.t10Say('Back on the street.');
        return true;
      }
      if (p.sitDownHere()) { this.t10Say('Waiting.'); return true; }
      return false;
    }
    // Street level: the nearest entrance.
    const t = p.interactTarget;
    if (t && t.action === 'subway') {
      const stop = sub.enter(t.stopKey);
      if (stop) { this.t10Say(stop.line.name + ', ' + stop.name + '. Trains every minute or so.'); return true; }
    }
    return false;
  }

  /** Reach for whoever is closest and take a bite. @returns true if you did. */
  doZombieBite() {
    const p = this.player;
    const npc = this.npcs.nearestNPC(p.position, 2.6);
    if (!npc || npc.infected) return false;
    const dx = npc.position.x - p.position.x, dz = npc.position.z - p.position.z;
    const len = Math.hypot(dx, dz) || 1;
    if (this.gore) {
      this.gore.hit(npc.position.x, npc.position.y, npc.position.z, 1, dx / len, dz / len);
      this.gore.gib(npc.position.x, npc.position.y + 0.6, npc.position.z, 0.6, dx / len, dz / len);
      this.gore.pool(npc.position.x, npc.position.z, 1.7);
    }
    npc.downed = 8;
    npc.reanimate = 4 + Math.random() * 6;
    npc.controlled = 'apocalypse';
    if (this.apocalypse) this.apocalypse.casualties++;
    p.camShake = Math.min(1.2, p.camShake + 0.5);
    audio.spawnPop();
    this.t10Say(npc.appearance.firstName + '. They\'ll be up again shortly, and they won\'t be themselves.');
    return true;
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
    this.hud.updateStats(
      this.perf.summary(settings.preset.label, this.governor.load, this.governor.scale) +
      '\n' + this.atmosphere.clockString() + '  ·  ' + this.atmosphere.weatherName()
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

  // ---- Option chips -----------------------------------------------------
  // Each group is a row of buttons where one is on; the chosen values are
  // handed to the game when the world is created.
  const options = { where: 'downtown', time: 9.5, weather: 'fair', busy: 1, quality: 'high', maturity: 18 };
  const numeric = { time: true, busy: true, maturity: true };
  for (const key of Object.keys(options)) {
    const row = document.getElementById('t10-opt-' + key);
    if (!row) continue;
    const chips = [...row.querySelectorAll('.world-chip')];
    for (const chip of chips) {
      chip.addEventListener('click', () => {
        for (const c of chips) c.classList.toggle('on', c === chip);
        const raw = chip.getAttribute('data-v');
        options[key] = numeric[key] ? parseFloat(raw) : raw;
        audio.init();
        audio.ui('tick');
      });
    }
  }

  const advToggle = document.getElementById('t10-adv-toggle');
  const advBody = document.getElementById('t10-adv');
  if (advToggle && advBody) {
    advToggle.addEventListener('click', () => {
      const open = advBody.classList.toggle('open');
      advToggle.innerHTML = open ? 'Fewer options \u25b4' : 'More options \u25be';
      if (open) setTimeout(() => advBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    });
  }

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
      game.applyWorldOptions(options);
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
