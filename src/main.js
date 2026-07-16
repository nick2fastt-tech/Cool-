/**
 * main.js
 * -------
 * Application bootstrap. Wires the engine, graphics, input, player, economy,
 * social, networking, world, and UI into a single running game, then drives the
 * boot → login → play flow.
 *
 * Everything downstream talks through the EventBus + GameState singletons, so
 * this file is mostly construction and dependency wiring.
 */

import * as THREE from 'three';

import { Engine } from './core/Engine.js';
import { PhysicsWorld } from './core/Physics.js';
import { GameState } from './core/GameState.js';
import { bus } from './core/EventBus.js';
import { createLogger, setLogLevel } from './core/Logger.js';

import { Lighting } from './graphics/Lighting.js';
import { Sky } from './graphics/Sky.js';
import { DayNightCycle } from './graphics/DayNightCycle.js';
import { ParticleBurst } from './graphics/Particles.js';

import { TouchControls } from './input/TouchControls.js';
import { Vibration } from './input/Vibration.js';

import { Avatar } from './player/Avatar.js';
import { Animator } from './player/Animations.js';
import { PlayerController } from './player/PlayerController.js';

import { AccountSystem } from './account/AccountSystem.js';
import { LocalCloudProvider, CloudSync } from './account/CloudSave.js';
import { NetworkClient } from './net/NetworkClient.js';
import { Invites } from './social/Invites.js';
import { Friends } from './account/Friends.js';

// Import side-effecting singletons so their bus wiring is active.
import './economy/Achievements.js';
import './social/Notifications.js';
import './social/Chat.js';

import { GameManager } from './games/GameManager.js';
import { UIManager } from './ui/UIManager.js';

const log = createLogger('Main');

/** Update the boot progress bar. */
function boot(pct, hint) {
  const fill = document.getElementById('boot-bar-fill');
  const h = document.getElementById('boot-hint');
  if (fill) fill.style.width = pct + '%';
  if (hint && h) h.textContent = hint;
}

async function start() {
  setLogLevel('info');
  boot(10, 'Starting engine…');

  // --- Engine + physics ----------------------------------------------------
  const canvas = document.getElementById('game-canvas');
  const engine = new Engine(canvas);
  const physics = new PhysicsWorld();

  // --- Graphics systems ----------------------------------------------------
  boot(30, 'Lighting the world…');
  const lighting = new Lighting(engine.scene);
  const sky = new Sky(engine.scene);
  const dayNight = new DayNightCycle(lighting, sky, 600);
  engine.addSystem({ update: (dt) => { dayNight.update(dt); sky.update(dt); } });

  const particles = new ParticleBurst(engine.scene, 400);
  engine.addSystem({ update: (dt) => particles.update(dt) });
  // Kick up dust when the local player lands.
  bus.on('player:land', (pos) => particles.burst(pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xcfc0a8, 10, 3, 0.5));

  // --- Input ---------------------------------------------------------------
  boot(45, 'Calibrating controls…');
  const input = new TouchControls(document.getElementById('ui-root'));
  input.setEnabled(false); // enabled once we enter the world

  // --- Local player --------------------------------------------------------
  boot(60, 'Building your avatar…');
  let avatar = new Avatar(GameState.get('avatar'));
  let animator = new Animator(avatar);
  const player = new PlayerController(engine, input, physics, avatar, animator, lighting);
  engine.addSystem(player);
  if (new URLSearchParams(location.search).has('debug')) {
    window.__nova = { engine, player, get cam() { return engine.camera.position.toArray().map((n) => +n.toFixed(2)); }, get av() { return player.avatar.root.position.toArray().map((n) => +n.toFixed(2)); }, get pos() { return player.position.toArray().map((n) => +n.toFixed(2)); } };
  }

  // Rebuild the local avatar when customization changes.
  bus.on('avatar:changed', (custom) => {
    engine.scene.remove(avatar.root);
    avatar.dispose();
    avatar = new Avatar(custom);
    animator = new Animator(avatar);
    player.avatar = avatar;
    player.animator = animator;
    engine.scene.add(avatar.root);
    avatar.root.position.copy(player.position);
  });

  // --- Cloud save ----------------------------------------------------------
  const cloud = new CloudSync(new LocalCloudProvider(), GameState);

  // --- Networking (created lazily on first world entry) --------------------
  let network = null;
  const account = GameState.get('account');

  // --- Game manager --------------------------------------------------------
  boot(75, 'Assembling the lobby…');
  const gameManager = new GameManager({ engine, scene: engine.scene, physics, player, particles, network: null });

  // --- App context shared with the UI --------------------------------------
  const app = { engine, physics, player, input, vibration: Vibration, gameManager, network: null, cloud };

  // --- UI ------------------------------------------------------------------
  const ui = new UIManager(app);

  // Apply persisted control preferences.
  input.setPref('leftHanded', GameState.get('settings').leftHanded);
  Vibration.setEnabled(GameState.get('settings').vibration);
  bus.on('settings:changed', (key, value) => {
    if (key === 'vibration') Vibration.setEnabled(value);
    if (key === 'quality' && value !== 'auto') log.info('quality set to', value);
  });

  // Track playtime for stats/achievements.
  setInterval(() => {
    GameState.patch('stats', { playtimeSec: GameState.get('stats').playtimeSec + 5 });
  }, 5000);

  // --- Play entry point (fired by the login screen) ------------------------
  bus.once('app:enter', async () => {
    boot(95, 'Syncing your save…');
    await cloud.syncOnLogin();

    // Connect multiplayer (falls back to single-player automatically).
    network = new NetworkClient(engine, GameState.get('account'), GameState.get('avatar'));
    app.network = network;
    gameManager.ctx.network = network;

    gameManager.enterLobby();
    network.connect('lobby');

    // Handle inbound invite/join deep links.
    const launch = Invites.parseLaunchParams();
    if (launch.invite) {
      Friends.add({ id: 'f_' + launch.invite, username: 'Player_' + launch.invite, code: launch.invite });
      ui.toast({ icon: '🤝', title: 'Friend added', text: launch.invite });
    }
    if (launch.join) {
      network.connect(launch.join);
      ui.toast({ icon: '🚪', title: 'Joining server', text: launch.join });
    }

    ui.closeScreens(); // reveal the world + HUD
  });

  // --- Start rendering + show the first screen -----------------------------
  boot(100, 'Ready!');
  gameManager.enterLobby(); // build a world to render behind the login screen
  engine.start();

  setTimeout(() => document.getElementById('boot')?.classList.add('hide'), 300);
  ui.showScreen('login');

  // Re-show login after an explicit sign-out.
  bus.on('account:logout', () => ui.showScreen('login'));

  log.info('NovaVerse ready');
}

start().catch((e) => {
  const el = document.getElementById('boot-error');
  if (el) el.textContent = 'Fatal: ' + (e?.message || e);
  console.error(e);
});
