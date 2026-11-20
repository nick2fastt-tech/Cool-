// Game core: owns the renderer, world, camera and the main loop.
import * as THREE from 'three';
import { GameRenderer } from '../engine/renderer.js';
import { buildWorld } from '../world/world.js';
import { HUD } from '../ui/hud.js';
import { Input } from './input.js';
import { Interactions } from './interact.js';
import { NPCs } from './npcs.js';
import { PlaySession } from './play.js';

export class Game {
  constructor({ canvas, ui, audio, account, debug }) {
    this.canvas = canvas;
    this.ui = ui;
    this.audio = audio;
    this.account = account;
    this.debug = debug || {};
    this.mode = 'loading';
    this.timeOffsetMs = 0;
    this.menuT = 0;
    this.lastFrame = 0;
    this.running = false;
    this.play = null;
    if (this.debug.time) {
      const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(this.debug.time);
      if (m) {
        const d = new Date();
        d.setHours(Number(m[1]), Number(m[2]), Number(m[3] || 0), 0);
        this.timeOffsetMs = d.getTime() - Date.now();
      }
    }
  }

  now() {
    return new Date(Date.now() + this.timeOffsetMs);
  }

  async load(onProgress) {
    this.gr = new GameRenderer(this.canvas);
    if (this.debug.fixedRes) this.gr.dynamic = false;
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.1, 600);
    this.camera.rotation.order = 'YXZ';
    this.gr.resize(this.camera);
    this.world = await buildWorld(this.gr, (p, label) => onProgress(p * 0.92, label));
    this.scene = this.world.scene;
    this.world.doors.audio = this.audio;
    this.hud = new HUD(document.getElementById('ui'));
    this.input = new Input(this.canvas, document.getElementById('joystick'));
    this.interactions = new Interactions(this.world);
    this.npcs = new NPCs(this.world, this.scene);
    this.world.env.setTime(this.now());
    this.updateMenuCamera(0);
    onProgress(0.94, 'Ringing the bell…');
    await new Promise((r) => setTimeout(r, 30));
    // Pre-compile every shader so nothing hitches later (async when the GPU supports it).
    if (this.gr.r.extensions.has('KHR_parallel_shader_compile')) {
      try {
        await this.gr.r.compileAsync(this.scene, this.camera);
      } catch (e) {
        this.gr.r.compile(this.scene, this.camera);
      }
    } else {
      this.gr.r.compile(this.scene, this.camera);
    }
    this.gr.r.shadowMap.needsUpdate = true;
    onProgress(1, 'Ready for class!');
    const onResize = () => this.gr.resize(this.camera);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.frame(t);
    };
    requestAnimationFrame(loop);
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'menu') {
      for (const g of this.world.zones.values()) g.visible = true;
      this.gr.r.shadowMap.needsUpdate = true;
    }
  }

  async startPlaying(grade, user) {
    if (this.play) this.play.stop();
    this.play = new PlaySession(this, grade, user);
    this.mode = 'play';
    this.play.start(this.now());
    this.play.update(0.016, this.now());
    if (this.debug.enabled) window.__SL.play = this.play;
  }

  /** Debug: move the clock so the next bell rings in `sec` seconds. */
  skipToBell(sec = 5) {
    const now = this.now();
    const ms = 30 * 60000;
    const minsOfDay = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
    const into = ((minsOfDay - 8 * 60) % 30 + 30) % 30;
    const left = ms - into * 60000;
    this.timeOffsetMs += left - sec * 1000;
  }

  stopPlaying() {
    if (this.play) this.play.stop();
    this.play = null;
    if (this.npcs) this.npcs.hideAll();
    this.setMode('menu');
  }

  updateMenuCamera(dt) {
    this.menuT += dt;
    const t = this.menuT;
    const a = Math.sin((t * Math.PI * 2) / 80) * 0.62;
    const R = 31 + Math.sin((t * Math.PI * 2) / 53) * 3;
    const target = new THREE.Vector3(27 + Math.sin(a) * 4, 4.2, 15);
    this.camera.position.set(target.x + Math.sin(a) * R, 3.6 + Math.sin((t * Math.PI * 2) / 37) * 0.8, target.z + Math.cos(a) * R);
    this.camera.lookAt(target);
  }

  frame(t) {
    const frameMs = t - this.lastFrame;
    this.lastFrame = t;
    const dt = Math.min(0.05, Math.max(0, frameMs / 1000));
    if (this.gr.contextLost) return;
    const now = this.now();
    if (this.mode === 'menu' || this.mode === 'loading') this.updateMenuCamera(dt);
    if (this.mode === 'play' && this.play) this.play.update(dt, now);
    const w = this.world;
    if (w.env.setTime(now)) this.gr.r.shadowMap.needsUpdate = true;
    w.env.update(dt, this.camera);
    w.clocks.update(now);
    w.flag.update(dt);
    if (this.mode !== 'play') w.doors.update(dt, []);
    this.gr.r.render(this.scene, this.camera);
    this.gr.adapt(frameMs, this.camera);
  }
}
