import './ui/styles.css';
import * as THREE from 'three';
import { AudioEngine } from './audio/audioEngine';
import { CoopScene } from './mp/mpScene';
import { MpHud } from './ui/mpHud';
import { MpScreens } from './ui/mpScreens';
import { NetClient } from './mp/netClient';
import { Effects } from './ui/effects';
import { Hud } from './ui/hud';
import { NightSession } from './game/nightManager';
import { OfficeScene } from './render/scene';
import { ROOM_ANCHORS } from './render/world';
import { SaveSystem } from './game/saveSystem';
import { Screens } from './ui/screens';
import { Ticker } from './core/ticker';
import { TouchInput } from './ui/touch';
import { NIGHTS, Room, TIME, type CharacterId } from './game/config';
import { probeDevice } from './core/device';
import type { AudioCue } from './game/animatronic';
import type { MatchEvent } from './net/protocol';
import type { Settings } from './game/saveSystem';

/**
 * Application shell.
 *
 * Owns the app state machine (loading -> menu -> shift -> result), wires the
 * simulation's events to sound and picture, and drives the fixed-step ticker.
 * Nothing in here contains game rules - if a number matters, it lives in
 * game/config.ts and the simulation applies it.
 */

type AppState =
  | 'loading'
  | 'menu'
  | 'intro'
  | 'playing'
  | 'result'
  | 'paused'
  /** Multiplayer menus, host setup, join and lobby. */
  | 'mp-menu'
  /** Inside a co-op match. */
  | 'mp-match';

const OFFICE_POS = new THREE.Vector3(0, 0, 9.6);

class App {
  private readonly device = probeDevice();
  private readonly save = new SaveSystem(this.device.recommended);
  private readonly audio = new AudioEngine();
  private readonly canvas = document.getElementById('stage') as HTMLCanvasElement;
  private readonly uiRoot = document.getElementById('ui-root') as HTMLElement;

  private scene!: OfficeScene;
  private effects!: Effects;
  private input!: TouchInput;
  private hud!: Hud;
  private screens!: Screens;
  private ticker!: Ticker;

  private state: AppState = 'loading';
  private session: NightSession | null = null;
  private now = 0;
  private jumpscareTimer = 0;
  private tutorialQueue: { at: number; text: string }[] = [];

  /* --- multiplayer, created on first use so single player pays nothing --- */
  private net: NetClient | null = null;
  private mpScreens: MpScreens | null = null;
  private mpHud: MpHud | null = null;
  private coopScene: CoopScene | null = null;
  private mpHeld: { kind: 'interact' | 'revive'; id: string } | null = null;
  private mpDebugTaps = 0;
  private mpDebugTapAt = 0;

  async boot(): Promise<void> {
    this.effects = new Effects(this.uiRoot, this.save.settings.quality);
    this.input = new TouchInput(document.getElementById('app') as HTMLElement, (dx, dy) => {
      if (this.state === 'playing' && this.session && !this.session.monitor.up) {
        this.scene.look(dx, dy, this.save.settings.sensitivity);
      }
    });
    this.input.haptics = this.save.settings.haptics;

    this.screens = new Screens(this.uiRoot, this.input, {
      startNight: (night) => this.startNight(night),
      openMultiplayer: () => this.openMultiplayer(),
      updateSettings: (patch) => this.applySettings(patch),
      resetProgress: () => {
        this.save.reset();
        this.screens.showMenu(this.save.value);
      },
    });

    const progress = this.screens.showLoading();
    progress(0.1, 'WAKING THE BUILDING');
    await frame();

    this.scene = new OfficeScene(this.canvas, this.save.settings.quality);
    progress(0.6, 'HANGING THE CAMERAS');
    await frame();

    this.hud = new Hud(this.uiRoot, this.input, {
      toggleDoor: (side) => this.session?.toggleDoor(side),
      setLight: (side, on) => this.session?.setLight(side, on),
      toggleMonitor: () => this.session?.toggleMonitor(),
      selectCamera: (index) => this.session?.selectCamera(index),
      setCrank: (held) => this.session?.setCrank(held),
      glance: (side) => this.scene.glance(side),
    });
    this.hud.applySettings(this.save.settings);
    progress(1, 'READY');
    await frame();

    // Look-drag inside a co-op match is handled by the multiplayer HUD, which
    // has to ignore the stick and the buttons.
    const app = document.getElementById('app') as HTMLElement;
    for (const [type, kind] of [['pointerdown', 'down'], ['pointermove', 'move'], ['pointerup', 'up'], ['pointercancel', 'up']] as const) {
      app.addEventListener(type, (e) => {
        if (this.state !== 'mp-match' || !this.mpHud || !this.coopScene || !this.net) return;
        this.mpHud.handleLookPointer(kind, e as PointerEvent, (dx, dy) =>
          this.coopScene!.look(dx, dy, this.save.settings.sensitivity, this.net!),
        );
      });
    }

    window.addEventListener('resize', () => this.scene.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.scene.resize(), 250));
    window.addEventListener('resize', () => this.coopScene?.resize());
    document.addEventListener('visibilitychange', () => this.onVisibility());
    // Audio contexts only start inside a gesture, so arm it on the first touch.
    const unlock = () => {
      this.audio.unlock();
      this.audio.setVolumes(this.save.settings.masterVolume, this.save.settings.sfxVolume);
    };
    document.addEventListener('pointerdown', unlock, { once: true });

    this.ticker = new Ticker(
      (dt) => this.fixedUpdate(dt),
      (_alpha, frameDt) => this.render(frameDt),
      30,
    );
    this.ticker.start();
    this.toMenu();
  }

  /* ----------------------------------------------------------- app states */

  private toMenu(): void {
    this.state = 'menu';
    this.session = null;
    this.hud.setVisible(false);
    this.hud.clearTransient();
    this.effects.setDark(0);
    this.effects.setStatic(0);
    this.scene.resetForNewNight();
    this.audio.startAmbience();
    this.audio.stopLoop('musicbox');
    this.screens.showMenu(this.save.value);
  }

  private startNight(night: number): void {
    const config = NIGHTS[Math.max(0, Math.min(NIGHTS.length - 1, night - 1))];
    const secondsPerHour = this.save.settings.classicPacing
      ? TIME.classicSecondsPerHour
      : TIME.secondsPerHour;
    const session = new NightSession(config, { secondsPerHour });
    this.session = session;
    this.wireSession(session);
    this.save.recordAttempt();
    this.scene.resetForNewNight();
    this.hud.clearTransient();
    this.effects.setDark(0);
    this.audio.unlock();
    this.audio.startAmbience();

    this.tutorialQueue = config.tutorial
      ? [
          { at: 4, text: 'THE TABLET SHOWS THE BUILDING. IT ALSO BURNS POWER.' },
          { at: 20, text: 'HOLD A HALL LIGHT TO SEE WHO IS AT YOUR DOOR.' },
          { at: 42, text: 'TAP A DOOR TO SEAL IT. NOTHING GETS THROUGH A SEALED DOOR.' },
          { at: 75, text: 'EVERY SYSTEM YOU LEAVE ON IS ANOTHER BAR OF POWER.' },
          { at: 120, text: 'SURVIVE UNTIL 6 AM.' },
        ]
      : [];

    this.state = 'intro';
    this.screens.showNightIntro(night, () => {
      this.screens.hide();
      this.hud.setVisible(true);
      this.state = 'playing';
    });
  }

  private wireSession(session: NightSession): void {
    session.events.on('cue', ({ cue, room, id }) => this.playCue(cue, room, id));

    session.events.on('impact', ({ side }) => {
      this.audio.doorImpact(side === 'left' ? -0.8 : 0.8);
      this.scene.shake(0.4, this.now);
      this.input.buzz(30);
    });

    session.events.on('hour', ({ hour }) => {
      this.audio.hourChime();
      this.hud.toast(`${hour} AM`, 2);
    });

    session.events.on('blackout', () => {
      this.audio.stopLoop('ambience');
      this.audio.startMusicBox();
      this.effects.setDark(0.55);
      this.effects.setStatic(0);
      this.hud.toast('POWER FAILURE - GET ON THE CRANK', 4);
      this.input.buzz(120);
    });

    session.events.on('restored', ({ power }) => {
      this.audio.stopLoop('musicbox');
      this.audio.startAmbience();
      this.effects.setDark(0);
      this.effects.flashOnce(0.35);
      this.save.recordBlackoutSurvived();
      this.hud.toast(`BREAKER RESET - ${Math.round(power)}% RESERVE`, 3);
    });

    session.events.on('husk', () => this.save.markHuskSeen());

    session.events.on('win', ({ night }) => {
      this.save.completeNight(night);
      this.save.addPlaytime(session.elapsed);
      this.audio.stopLoop('musicbox');
      this.audio.win();
      this.state = 'result';
      this.hud.setVisible(false);
      const unlockedCoop = night === 1;
      this.screens.showWin(night, session.power.percent, () => {
        if (unlockedCoop) this.hud.toast('CO-OP SHIFT UNLOCKED', 4);
        this.toMenu();
      });
    });

    session.events.on('lose', ({ id }) => this.onDeath(id));

    session.monitor.events.on('opened', () => {
      this.audio.cameraFlip();
      this.effects.setStatic(1);
    });
    session.monitor.events.on('switched', () => {
      this.audio.cameraSwitch();
      this.effects.setStatic(1);
    });
    session.monitor.events.on('closed', () => {
      this.audio.cameraFlip();
      this.effects.setStatic(0);
    });
    session.doors.events.on('doorToggled', ({ side }) => {
      this.audio.doorSlam(side === 'left' ? -0.7 : 0.7);
      this.scene.shake(0.2, this.now);
    });
    session.doors.events.on('lightToggled', ({ side, on }) => {
      if (on) this.audio.lightSwitch(side === 'left' ? -0.6 : 0.6);
    });
  }

  private onDeath(id: CharacterId): void {
    const session = this.session;
    if (!session) return;
    this.save.recordDeath();
    this.save.addPlaytime(session.elapsed);
    this.audio.stopLoop('musicbox');
    this.audio.stopLoop('ambience');
    this.audio.jumpscare();
    this.effects.flashOnce(0.25);
    this.effects.setStatic(0.8);
    this.effects.setDark(0);
    this.scene.startJumpscare(id);
    this.input.buzz(400);
    this.hud.setVisible(false);
    this.state = 'result';
    this.jumpscareTimer = 1.5;
  }

  private playCue(cue: AudioCue, room: Room, _id: CharacterId): void {
    const anchor = ROOM_ANCHORS[room];
    const pan = Math.max(-1, Math.min(1, anchor.pos.x / 7));
    const distance = anchor.pos.distanceTo(OFFICE_POS);
    switch (cue) {
      case 'step': this.audio.footstep(pan, distance); break;
      case 'knock': this.audio.knock(pan); break;
      case 'kitchen': this.audio.kitchenClatter(pan); break;
      case 'curtain': this.audio.curtainRustle(pan); break;
      case 'run': this.audio.running(pan); break;
      case 'breath': this.audio.breath(pan); break;
      case 'laugh': this.audio.laugh(pan, distance); break;
      case 'doorImpact': this.audio.doorImpact(pan); break;
    }
    if (this.save.settings.subtitles) {
      const text: Record<AudioCue, string> = {
        step: '[ footsteps ]',
        knock: '[ knocking ]',
        kitchen: '[ pans clattering ]',
        curtain: '[ curtain rings ]',
        run: '[ running, west hall ]',
        breath: '[ breathing, close ]',
        laugh: '[ laughter ]',
        doorImpact: '[ something hits the door ]',
      };
      this.hud.subtitle(text[cue]);
    }
  }

  private applySettings(patch: Partial<Settings>): void {
    const settings = this.save.updateSettings(patch);
    if (patch.quality) {
      this.scene.setQuality(patch.quality);
      this.effects.setQuality(patch.quality);
    }
    if (patch.masterVolume !== undefined || patch.sfxVolume !== undefined) {
      this.audio.setVolumes(settings.masterVolume, settings.sfxVolume);
    }
    if (patch.haptics !== undefined) this.input.haptics = settings.haptics;
    if (patch.quality) this.coopScene?.setQuality(patch.quality);
    this.hud.applySettings(settings);
    this.mpHud?.applySettings(settings);
  }

  private onVisibility(): void {
    if (document.hidden) {
      this.audio.suspend();
      // A co-op match is not pausable - the server never stops - so the most
      // useful thing to do is drop the controls and stop drawing.
      if (this.state === 'mp-match') this.mpHud?.banner('BACKGROUNDED - THE SHIFT CONTINUES');
      if (this.state === 'playing') {
        this.state = 'paused';
        this.session?.setCrank(false);
        this.hud.toast('PAUSED', 60);
      }
    } else {
      this.audio.resume();
      if (this.state === 'mp-match') this.mpHud?.banner(null);
      if (this.state === 'paused') {
        this.state = 'playing';
        this.hud.clearTransient();
      }
    }
  }


  /* ------------------------------------------------------- multiplayer */

  /** Built the first time the player opens co-op, then reused. */
  private ensureMultiplayer(): void {
    if (this.net) return;

    const net = new NetClient();
    this.net = net;
    this.coopScene = new CoopScene(this.scene.renderer, this.save.settings.quality);

    this.mpScreens = new MpScreens(this.uiRoot, {
      back: () => {
        net.leave();
        net.disconnect();
        this.mpScreens?.hide();
        this.toMenu();
      },
      host: (settings) => net.host(settings),
      join: (code) => net.join(code),
      quickJoin: () => net.quickJoin(),
      refreshPublic: () => net.listPublic(),
      setSettings: (settings) => net.setSettings(settings),
      ready: (ready) => net.setReady(ready),
      start: () => net.startMatch(),
      leave: () => {
        net.leave();
        this.mpScreens?.showMenu();
      },
    });

    this.mpHud = new MpHud(this.uiRoot, net, () => {
      net.leave();
      this.exitMatch();
    });
    this.mpHud.applySettings(this.save.settings);
    // Debug overlay: hidden unless asked for, by ?debug=1 or three taps on the
    // match clock. Never on by default in a shipped build.
    if (new URLSearchParams(location.search).get('debug') === '1') this.mpHud.toggleDebug();
    this.mpHud.root.addEventListener('pointerdown', (e) => {
      if (!(e.target as HTMLElement).classList.contains('mp-clock')) return;
      const now = performance.now();
      this.mpDebugTaps = now - this.mpDebugTapAt < 600 ? this.mpDebugTaps + 1 : 1;
      this.mpDebugTapAt = now;
      if (this.mpDebugTaps >= 3) {
        this.mpDebugTaps = 0;
        this.mpHud?.toggleDebug();
      }
    });

    this.wireNet(net);
  }

  private wireNet(net: NetClient): void {
    net.events.on('connection', ({ state, detail }) => {
      this.mpScreens?.setConnection(state, detail);
      if (this.state !== 'mp-match') return;
      if (state === 'reconnecting') this.mpHud?.banner(detail ?? 'CONNECTION LOST - RECONNECTING');
      else if (state === 'online') this.mpHud?.banner(null);
      else if (state === 'failed') {
        this.exitMatch();
        this.mpScreens?.showError(detail ?? 'CONNECTION LOST', () => this.mpScreens?.showMenu());
      }
    });

    net.events.on('lobby', (state) => {
      if (state.phase === 'match' && this.state !== 'mp-match') this.enterMatch();
      else if (state.phase !== 'match' && this.state === 'mp-match') this.exitMatch();
      if (this.state !== 'mp-match') this.mpScreens?.showLobby(state, net.playerId);
    });

    net.events.on('publicRooms', (rooms) => {
      if (this.mpScreens?.screen === 'join') this.mpScreens.showJoin(rooms);
    });

    net.events.on('error', ({ code, message }) => {
      // Fatal problems get a screen with a way out; the rest are just toasts.
      if (code === 'BAD_VERSION' || code === 'INTERNAL') {
        this.mpScreens?.showError(message, () => this.mpScreens?.showMenu());
      } else if (this.state === 'mp-match') {
        this.mpHud?.toast(message);
      } else {
        this.mpScreens?.toast(message);
      }
    });

    net.events.on('matchStart', () => this.enterMatch());

    net.events.on('matchEnd', ({ win, reason }) => {
      this.audio.stopLoop('musicbox');
      if (win) this.audio.win();
      this.mpHud?.toast(`${win ? '6 AM - SHIFT COMPLETE' : 'SHIFT ENDED'} - ${reason}`, 6);
      window.setTimeout(() => this.exitMatch(), 2600);
    });

    net.events.on('matchEvents', (list) => this.playMatchEvents(list));

    net.events.on('kicked', ({ reason }) => {
      this.exitMatch();
      this.mpScreens?.showError(reason.toUpperCase(), () => this.mpScreens?.showMenu());
    });
  }

  private openMultiplayer(): void {
    this.ensureMultiplayer();
    this.state = 'mp-menu';
    this.screens.hide();
    this.hud.setVisible(false);
    this.audio.unlock();
    this.audio.startAmbience();
    const name = (this.save.value.stats.nightsAttempted > 0 ? 'GUARD' : 'ROOKIE') + Math.floor(Math.random() * 90 + 10);
    this.net?.connect(name);
    this.mpScreens?.showMenu();
  }

  private enterMatch(): void {
    const net = this.net;
    if (!net || this.state === 'mp-match') return;
    this.state = 'mp-match';
    this.mpScreens?.hide();
    this.mpHud?.setVisible(true);
    this.mpHud?.banner(null);
    this.input.lookEnabled = false;
    this.mpHeld = null;
    const mine = net.me;
    if (mine) {
      net.predicted.x = mine.x;
      net.predicted.z = mine.z;
      net.predicted.yaw = mine.r;
    }
  }

  private exitMatch(): void {
    if (this.state !== 'mp-match') return;
    this.state = 'mp-menu';
    this.mpHud?.setVisible(false);
    this.mpHeld = null;
    const lobby = this.net?.lobby;
    if (lobby && this.net) this.mpScreens?.showLobby(lobby, this.net.playerId);
    else this.mpScreens?.showMenu();
  }

  /** Turn server events into sound, haptics and text. */
  private playMatchEvents(list: MatchEvent[]): void {
    const net = this.net;
    if (!net) return;
    const nameOf = (id: string): string =>
      net.lobby?.players.find((p) => p.id === id)?.name ?? 'A GUARD';

    for (const event of list) {
      switch (event.e) {
        case 'down':
          if (event.player === net.playerId) {
            this.audio.jumpscare();
            this.effects.flashOnce(0.25);
            this.coopScene?.shake(0.8, this.now);
            this.input.buzz(400);
          } else {
            this.audio.laugh(0, 12);
            this.mpHud?.toast(`${nameOf(event.player).toUpperCase()} IS DOWN`, 4);
            this.input.buzz(60);
          }
          break;
        case 'revived':
          this.audio.lightSwitch(0);
          this.mpHud?.toast(`${nameOf(event.player).toUpperCase()} IS BACK UP`, 3);
          break;
        case 'eliminated':
          this.mpHud?.toast(`${nameOf(event.player).toUpperCase()} DID NOT MAKE IT`, 4);
          break;
        case 'blackout':
          this.audio.doorImpact(0);
          this.audio.startMusicBox();
          this.mpHud?.toast('THE GRID IS DOWN', 5);
          this.input.buzz(120);
          break;
        case 'restored':
          this.audio.stopLoop('musicbox');
          this.audio.win();
          this.effects.flashOnce(0.4);
          this.mpHud?.toast(`POWER BACK - ${Math.round(event.power)}%`, 4);
          break;
        case 'step':
          this.audio.cameraSwitch();
          this.mpHud?.toast(event.label, 4);
          break;
        case 'hour':
          this.audio.hourChime();
          break;
        case 'pickup':
          if (event.player === net.playerId) this.mpHud?.toast('FUSE COLLECTED - TAKE IT TO THE PANEL', 4);
          break;
        case 'attack':
          this.audio.knock(0);
          break;
        default:
          break;
      }
    }
  }

  /** One frame of co-op: sample the controls, predict, draw. */
  private renderMatch(frameDt: number): void {
    const net = this.net;
    const hud = this.mpHud;
    const scene = this.coopScene;
    if (!net || !hud || !scene) return;

    const control = hud.refreshControl(net.predicted.yaw);
    const action = hud.currentAction();
    const wanted = control.interact ? action : null;
    // Edge-detect the USE button so the server gets one hold, not a stream.
    if (wanted?.id !== this.mpHeld?.id || wanted?.kind !== this.mpHeld?.kind) {
      if (this.mpHeld?.kind === 'interact') net.interact(null, false);
      if (this.mpHeld?.kind === 'revive') net.revive(null, false);
      if (wanted?.kind === 'interact') net.interact(wanted.id, true);
      if (wanted?.kind === 'revive') net.revive(wanted.id, true);
      this.mpHeld = wanted;
    }

    const anchored = wanted !== null;
    net.pushInput(
      frameDt,
      {
        mx: control.mx,
        mz: control.mz,
        yaw: net.predicted.yaw,
        sprint: control.sprint,
        crouch: control.crouch,
        flashlight: control.flashlight,
      },
      anchored,
    );

    hud.focus = scene.update(net, frameDt, this.now, {
      crouch: control.crouch,
      flashlight: control.flashlight,
      moving: control.moving && !anchored,
    });
    scene.render();
    hud.update(net.latestSnapshot, frameDt, 60);
  }

  /* ------------------------------------------------------------ main loop */

  private fixedUpdate(dt: number): void {
    if (this.state !== 'playing' || !this.session) return;
    this.session.tick(dt);

    if (this.tutorialQueue.length && this.session.elapsed >= this.tutorialQueue[0].at) {
      this.hud.toast(this.tutorialQueue.shift()!.text, 4);
    }
    if (this.session.isCranking) {
      // A tick of crank noise every other frame - it should sound like work.
      if (Math.random() < 0.4) this.audio.crankTurn();
    }
  }

  private render(frameDt: number): void {
    this.now += frameDt;
    this.effects.update(this.now);

    if (this.state === 'mp-match') {
      this.renderMatch(frameDt);
      return;
    }

    if (this.state === 'menu' || this.state === 'mp-menu') {
      this.scene.renderMenu(this.now, this.device.recommended !== 'low');
      return;
    }

    const session = this.session;
    if (!session) return;

    if (this.state === 'result' && this.jumpscareTimer > 0) {
      this.jumpscareTimer -= frameDt;
      this.scene.sync(session, frameDt, this.now);
      this.scene.render(session, this.now);
      if (this.jumpscareTimer <= 0) {
        this.effects.setStatic(0);
        const name = session.killer ?? 'something';
        this.screens.showLose(
          name,
          session.clock.label,
          () => this.startNight(session.config.night),
          () => this.toMenu(),
        );
      }
      return;
    }

    this.scene.sync(session, frameDt, this.now);
    this.scene.render(session, this.now);

    if (this.state === 'playing' || this.state === 'paused') {
      this.hud.update(session, frameDt);
      // Feed static clears as the tablet settles.
      if (session.monitor.up) {
        this.effects.setStatic(session.monitor.staticTimer > 0 ? 0.85 : 0.05);
      }
      this.input.lookEnabled = !session.monitor.up;
    }
  }
}

/**
 * QA hook.
 *
 * Exposes the running app to automated tests so the smoke suite can drive a
 * real shift in a real browser (skip the clock, force a blackout, read the
 * simulation back) instead of only checking that pixels appeared.
 */
/** Multiplayer QA surface - see DebugApi. */
export interface MpDebugApi {
  state: () => string;
  connection: () => string;
  id: () => string;
  lobby: () => unknown;
  snapshot: () => unknown;
  pos: () => { x: number; z: number; yaw: number };
  remote: (id: string) => unknown;
  ping: () => number;
  snapshotRate: () => number;
  /** Drive the movement stick, in world space. */
  setStick: (x: number, z: number) => void;
  setYaw: (yaw: number) => void;
  /** Hold or release the USE button. */
  use: (held: boolean) => void;
  focus: () => unknown;
}

export interface DebugApi {
  state: () => string;
  session: () => NightSession | null;
  startNight: (n: number) => void;
  skipToHour: (h: number) => void;
  forceBlackout: () => void;
  power: () => number;
  /** Teleport a character, so QA can stage a scene without waiting for rolls. */
  place: (id: CharacterId, room: Room) => void;
}

function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

const app = new App();
void app.boot();

const debug: DebugApi = {
  state: () => app['state'],
  session: () => app['session'],
  startNight: (n) => app['startNight'](n),
  skipToHour: (h) => app['session']?.debugSkipToHour(h),
  forceBlackout: () => {
    const session = app['session'];
    if (session) session.power.forceBlackout();
  },
  power: () => app['session']?.power.percent ?? -1,
  place: (id, room) => {
    const character = app['session']?.director.roster.find((c) => c.id === id);
    if (character) character.room = room;
  },
};
(window as unknown as { __hollow: DebugApi }).__hollow = debug;

const mpDebug: MpDebugApi = {
  state: () => app['state'],
  connection: () => app['net']?.state ?? 'offline',
  id: () => app['net']?.playerId ?? '',
  lobby: () => app['net']?.lobby ?? null,
  snapshot: () => app['net']?.latestSnapshot ?? null,
  pos: () => {
    const net = app['net'];
    return net ? { x: net.predicted.x, z: net.predicted.z, yaw: net.predicted.yaw } : { x: 0, z: 0, yaw: 0 };
  },
  remote: (id) => app['net']?.sample(id, 'player') ?? null,
  ping: () => app['net']?.ping ?? -1,
  snapshotRate: () => app['net']?.snapshotRate ?? 0,
  setStick: (x, z) => {
    const hud = app['mpHud'];
    const net = app['net'];
    if (!hud || !net) return;
    // Convert a world-space direction into stick axes for the current yaw.
    const yaw = net.predicted.yaw;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const magnitude = Math.hypot(x, z) || 1;
    const nx = x / magnitude;
    const nz = z / magnitude;
    hud.scriptedStick = x === 0 && z === 0
      ? { x: 0, y: 0 }
      : { x: nx * rightX + nz * rightZ, y: nx * forwardX + nz * forwardZ };
  },
  setYaw: (yaw) => {
    const net = app['net'];
    if (net) net.predicted.yaw = yaw;
  },
  use: (held) => {
    const hud = app['mpHud'];
    if (hud) hud.scriptedUse = held;
  },
  focus: () => app['mpHud']?.focus ?? null,
};
(window as unknown as { __hollowMp: MpDebugApi }).__hollowMp = mpDebug;
