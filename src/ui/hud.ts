import { CAMERAS, POWER, VENUE_NAME } from '../game/config';
import { button, clear, el, show } from './dom';
import type { NightSession } from '../game/nightManager';
import type { Settings } from '../game/saveSystem';
import type { Side } from '../game/doorSystem';
import type { TouchInput } from './touch';

export interface HudCallbacks {
  toggleDoor: (side: Side) => void;
  setLight: (side: Side, on: boolean) => void;
  toggleMonitor: () => void;
  selectCamera: (index: number) => void;
  setCrank: (held: boolean) => void;
  glance: (side: 'left' | 'right' | 'center') => void;
}

/**
 * The in-shift interface: clock, power, door and light controls, the camera
 * tablet, and the blackout crank.
 *
 * Layout rule for mobile: the two things you reach for under pressure - the
 * doors - sit at the bottom outer corners where thumbs already are, and
 * nothing else is ever placed within a thumb's width of them.
 */
export class Hud {
  readonly root: HTMLElement;
  private clockEl: HTMLElement;
  private nightEl: HTMLElement;
  private powerEl: HTMLElement;
  private powerValue: HTMLElement;
  private usageEl: HTMLElement;
  private officeLayer: HTMLElement;
  private padLeft: HTMLElement;
  private padRight: HTMLElement;
  private doorBtns: Record<Side, HTMLButtonElement>;
  private lightBtns: Record<Side, HTMLButtonElement>;
  private monitorBtn: HTMLButtonElement;

  private monitorLayer: HTMLElement;
  private feedLabel: HTMLElement;
  private camMap: HTMLElement;
  private camButtons: HTMLButtonElement[] = [];
  private audioOnlyEl: HTMLElement;

  private blackoutLayer: HTMLElement;
  private crankFill: HTMLElement;
  private crankBtn: HTMLButtonElement;

  private toastEl: HTMLElement;
  private subtitleEl: HTMLElement;
  private toastTimer = 0;
  private subtitleTimer = 0;

  constructor(parent: HTMLElement, private readonly input: TouchInput, private readonly cb: HudCallbacks) {
    this.root = el('div', 'hidden');
    this.root.id = 'hud';

    /* ---- top bars ---- */
    const top = el('div', 'hud-top');
    this.clockEl = el('div', 'hud-clock', '12 AM');
    this.nightEl = el('div', 'hud-night', 'NIGHT 1');
    top.append(this.clockEl, this.nightEl);

    this.powerEl = el('div', 'hud-power');
    const powerLabel = el('div', undefined, 'POWER LEFT');
    this.powerValue = el('div', 'value', '100%');
    this.usageEl = el('div', 'usage');
    for (let i = 0; i < POWER.maxUsage; i++) this.usageEl.appendChild(el('i'));
    this.powerEl.append(powerLabel, this.powerValue, this.usageEl);

    /* ---- office controls ---- */
    this.officeLayer = el('div', 'hud-office');
    this.doorBtns = {
      left: button('Door', 'left'),
      right: button('Door', 'right'),
    };
    this.lightBtns = {
      left: button('Light', 'hold'),
      right: button('Light', 'hold'),
    };
    this.padLeft = el('div', 'pad left');
    this.padRight = el('div', 'pad right');
    this.padLeft.append(this.doorBtns.left, this.lightBtns.left);
    this.padRight.append(this.lightBtns.right, this.doorBtns.right);

    this.monitorBtn = button('Cameras', 'tap');
    this.monitorBtn.classList.add('monitor-toggle', 'wide');
    this.officeLayer.append(this.padLeft, this.padRight, this.monitorBtn);

    /* ---- camera tablet ---- */
    this.monitorLayer = el('div', 'hidden');
    this.monitorLayer.id = 'monitor';
    const frame = el('div', 'feed-frame');
    this.feedLabel = el('div', 'feed-label');
    this.audioOnlyEl = el('div', 'audio-only hidden', 'FEED DEAD - AUDIO ONLY');
    this.camMap = el('div', 'cam-map');
    CAMERAS.forEach((cam, i) => {
      const b = el('button', undefined, cam.id.replace('CAM_', ''));
      b.style.left = `${cam.map.x * 100}%`;
      b.style.top = `${cam.map.y * 100}%`;
      b.title = cam.label;
      this.input.bindTap(b, () => this.cb.selectCamera(i));
      this.camButtons.push(b);
      this.camMap.appendChild(b);
    });
    const closeBtn = button('Close', 'tap');
    closeBtn.classList.add('monitor-toggle', 'wide');
    this.input.bindTap(closeBtn, () => this.cb.toggleMonitor());
    this.monitorLayer.append(frame, this.feedLabel, this.audioOnlyEl, this.camMap, closeBtn);

    /* ---- blackout ---- */
    this.blackoutLayer = el('div', 'hidden');
    this.blackoutLayer.id = 'blackout';
    const hint = el('div', 'crank-hint', 'BREAKER TRIPPED - HOLD THE CRANK');
    const bar = el('div', 'crank-bar');
    this.crankFill = el('i');
    bar.appendChild(this.crankFill);
    this.crankBtn = button('Crank', 'hold');
    this.crankBtn.classList.add('crank-btn');
    this.blackoutLayer.append(hint, bar, this.crankBtn);

    this.toastEl = el('div', 'toast hidden');
    this.subtitleEl = el('div', 'subtitle-line hidden');

    this.root.append(top, this.powerEl, this.officeLayer, this.monitorLayer, this.blackoutLayer, this.toastEl, this.subtitleEl);
    parent.appendChild(this.root);

    this.bindControls();
  }

  private bindControls(): void {
    for (const side of ['left', 'right'] as const) {
      this.input.bindTap(this.doorBtns[side], () => this.cb.toggleDoor(side));
      this.input.bindHold(
        this.lightBtns[side],
        () => {
          this.cb.setLight(side, true);
          this.cb.glance(side);
        },
        () => {
          this.cb.setLight(side, false);
          this.cb.glance('center');
        },
      );
    }
    this.input.bindTap(this.monitorBtn, () => this.cb.toggleMonitor());
    this.input.bindHold(
      this.crankBtn,
      () => this.cb.setCrank(true),
      () => this.cb.setCrank(false),
    );
  }

  applySettings(settings: Readonly<Settings>): void {
    this.root.style.setProperty('--ui-scale', String(settings.buttonScale));
    this.root.style.setProperty('--ui-opacity', String(settings.uiOpacity));
    // Left-handed players get the door controls mirrored.
    const l = settings.leftHanded;
    this.padLeft.style.order = l ? '2' : '1';
    this.padRight.style.order = l ? '1' : '2';
    this.padLeft.style.flexDirection = l ? 'row-reverse' : 'row';
    this.padRight.style.flexDirection = l ? 'row-reverse' : 'row';
  }

  setVisible(visible: boolean): void {
    show(this.root, visible);
  }

  toast(message: string, seconds = 3.5): void {
    this.toastEl.textContent = message;
    show(this.toastEl, true);
    this.toastTimer = seconds;
  }

  subtitle(message: string, seconds = 2): void {
    this.subtitleEl.textContent = message;
    show(this.subtitleEl, true);
    this.subtitleTimer = seconds;
  }

  clearTransient(): void {
    this.toastTimer = 0;
    this.subtitleTimer = 0;
    show(this.toastEl, false);
    show(this.subtitleEl, false);
  }

  /** Called every rendered frame. Only touches the DOM when a value changed. */
  update(session: NightSession, dt: number): void {
    const clock = session.clock.label;
    if (this.clockEl.textContent !== clock) this.clockEl.textContent = clock;
    const nightText = `NIGHT ${session.config.night} - ${VENUE_NAME.toUpperCase()}`;
    if (this.nightEl.textContent !== nightText) this.nightEl.textContent = nightText;

    const pct = Math.ceil(session.power.percent);
    const powerText = `${pct}%`;
    if (this.powerValue.textContent !== powerText) this.powerValue.textContent = powerText;
    this.powerEl.classList.toggle('low', pct <= 20);

    const usage = session.power.usage;
    for (let i = 0; i < this.usageEl.children.length; i++) {
      const bar = this.usageEl.children[i] as HTMLElement;
      const on = i < usage;
      bar.classList.toggle('on', on);
      bar.classList.toggle('hot', on && usage >= 4);
    }

    for (const side of ['left', 'right'] as const) {
      this.doorBtns[side].classList.toggle('on', session.doors.isClosed(side));
      this.lightBtns[side].classList.toggle('on', session.doors.isLightOn(side));
    }

    const monitorUp = session.monitor.up;
    const blackout = session.phase === 'blackout';
    show(this.monitorLayer, monitorUp);
    // With no power the door and light switches are dead metal, so they come
    // off the screen entirely and the crank gets the space.
    show(this.officeLayer, !monitorUp && !blackout);
    this.root.classList.toggle('blind', monitorUp);
    if (monitorUp) {
      const cam = session.monitor.camera;
      this.feedLabel.innerHTML = '';
      this.feedLabel.append(
        el('span', 'rec', 'REC '),
        el('b', undefined, cam.id.replace('_', ' ')),
        el('span', undefined, `  ${cam.label.toUpperCase()}`),
      );
      show(this.audioOnlyEl, !!cam.audioOnly);
      this.camButtons.forEach((b, i) => b.classList.toggle('active', i === session.monitor.index));
    }

    show(this.blackoutLayer, blackout);
    if (blackout) {
      this.crankFill.style.width = `${Math.round(session.power.crankProgress * 100)}%`;
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) show(this.toastEl, false);
    }
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) show(this.subtitleEl, false);
    }
  }

  destroy(): void {
    clear(this.root);
    this.root.remove();
  }
}
