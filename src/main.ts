import './ui/styles.css';
import * as THREE from 'three';
import { AudioEngine } from './audio/audioEngine';
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
import type { Settings } from './game/saveSystem';

/**
 * Application shell.
 *
 * Owns the app state machine (loading -> menu -> shift -> result), wires the
 * simulation's events to sound and picture, and drives the fixed-step ticker.
 * Nothing in here contains game rules - if a number matters, it lives in
 * game/config.ts and the simulation applies it.
 */

type AppState = 'loading' | 'menu' | 'intro' | 'playing' | 'result' | 'paused';

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
      openMultiplayer: () => this.screens.showMultiplayerPreview(this.save.value),
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

    window.addEventListener('resize', () => this.scene.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.scene.resize(), 250));
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
    this.hud.applySettings(settings);
  }

  private onVisibility(): void {
    if (document.hidden) {
      this.audio.suspend();
      if (this.state === 'playing') {
        this.state = 'paused';
        this.session?.setCrank(false);
        this.hud.toast('PAUSED', 60);
      }
    } else {
      this.audio.resume();
      if (this.state === 'paused') {
        this.state = 'playing';
        this.hud.clearTransient();
      }
    }
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

    if (this.state === 'menu') {
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
