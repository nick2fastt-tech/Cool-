import { el, show } from './dom';
import type { Interactable } from '../mp/map';
import type { MatchSnapshot } from '../net/protocol';
import type { NetClient } from '../mp/netClient';
import type { SceneFocus } from '../mp/mpScene';
import type { Settings } from '../game/saveSystem';

export interface ControlState {
  /** World-space movement, already rotated by the look direction. */
  mx: number;
  mz: number;
  sprint: boolean;
  crouch: boolean;
  flashlight: boolean;
  moving: boolean;
  /** True while the interact button is held. */
  interact: boolean;
}

/**
 * In-match interface for co-op: movement stick, look area, action buttons and
 * every piece of shared state the server sends.
 *
 * The numbers here are never computed locally. Power, the clock, the objective
 * and every teammate's status are read straight out of the latest snapshot, so
 * what one player sees is by construction what everybody sees.
 */
export class MpHud {
  readonly root: HTMLElement;
  readonly control: ControlState = {
    mx: 0, mz: 0, sprint: false, crouch: false, flashlight: false, moving: false, interact: false,
  };

  /** Raw stick axes, -1..1, before the yaw rotation. */
  private stickX = 0;
  private stickY = 0;
  private stickPointer: number | null = null;
  private lookPointer: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;

  private clockEl: HTMLElement;
  private powerEl: HTMLElement;
  private powerFill: HTMLElement;
  private objectiveEl: HTMLElement;
  private objectiveFill: HTMLElement;
  private crewEl: HTMLElement;
  private batteryFill: HTMLElement;
  private staminaFill: HTMLElement;
  private promptEl: HTMLElement;
  private roomEl: HTMLElement;
  private downedEl: HTMLElement;
  private downedText: HTMLElement;
  private bannerEl: HTMLElement;
  private debugEl: HTMLElement;
  private toastEl: HTMLElement;
  private toastTimer = 0;

  private sprintBtn: HTMLButtonElement;
  private crouchBtn: HTMLButtonElement;
  private torchBtn: HTMLButtonElement;
  private actionBtn: HTMLButtonElement;

  /** Set by the app each frame from the scene's focus test. */
  focus: SceneFocus = { interactable: null, downedId: null, roomLabel: '' };
  debugVisible = false;

  /**
   * QA hooks. Automated tests drive the same control state a thumb would,
   * rather than reaching into the network layer, so a test exercises the real
   * input path. Untouched during normal play.
   */
  scriptedStick: { x: number; y: number } | null = null;
  scriptedUse: boolean | null = null;

  constructor(parent: HTMLElement, private readonly net: NetClient, private readonly onLeave: () => void) {
    this.root = el('div', 'hidden');
    this.root.id = 'mp-hud';

    /* --- shared state, top of screen --- */
    const top = el('div', 'mp-top');
    this.clockEl = el('div', 'mp-clock', '12 AM');
    const power = el('div', 'mp-power');
    this.powerEl = el('div', 'mp-power-label', 'POWER 100%');
    const powerBar = el('div', 'mp-bar');
    this.powerFill = el('i');
    powerBar.appendChild(this.powerFill);
    power.append(this.powerEl, powerBar);
    top.append(this.clockEl, power);

    const objective = el('div', 'mp-objective');
    this.objectiveEl = el('div', 'mp-objective-label', 'SURVIVE UNTIL 6 AM');
    const objectiveBar = el('div', 'mp-bar thin');
    this.objectiveFill = el('i');
    objectiveBar.appendChild(this.objectiveFill);
    objective.append(this.objectiveEl, objectiveBar);

    this.crewEl = el('div', 'mp-crew');
    this.roomEl = el('div', 'mp-room', '');

    /* --- controls --- */
    this.stickBase = el('div', 'mp-stick');
    this.stickKnob = el('div', 'mp-knob');
    this.stickBase.appendChild(this.stickKnob);

    this.sprintBtn = el('button', 'btn mp-btn', 'RUN');
    this.crouchBtn = el('button', 'btn mp-btn', 'CROUCH');
    this.torchBtn = el('button', 'btn mp-btn', 'TORCH');
    this.actionBtn = el('button', 'btn mp-btn action', 'USE');
    const buttons = el('div', 'mp-buttons');
    buttons.append(this.crouchBtn, this.sprintBtn, this.torchBtn, this.actionBtn);

    const meters = el('div', 'mp-meters');
    const battery = el('div', 'mp-meter');
    battery.appendChild(el('label', undefined, 'TORCH'));
    const batteryBar = el('div', 'mp-bar thin');
    this.batteryFill = el('i');
    this.batteryFill.style.background = '#4fd0a0';
    batteryBar.appendChild(this.batteryFill);
    battery.appendChild(batteryBar);
    const stamina = el('div', 'mp-meter');
    stamina.appendChild(el('label', undefined, 'BREATH'));
    const staminaBar = el('div', 'mp-bar thin');
    this.staminaFill = el('i');
    staminaBar.appendChild(this.staminaFill);
    stamina.appendChild(staminaBar);
    meters.append(battery, stamina);

    this.promptEl = el('div', 'mp-prompt hidden');
    this.downedEl = el('div', 'mp-downed hidden');
    this.downedText = el('div', 'mp-downed-text', 'YOU ARE DOWN');
    this.downedEl.append(this.downedText);
    this.bannerEl = el('div', 'mp-banner hidden');
    this.debugEl = el('div', 'mp-debug hidden');
    this.toastEl = el('div', 'toast hidden');

    const leave = el('button', 'btn mp-leave', 'LEAVE');
    leave.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.onLeave();
    });

    this.root.append(
      top, objective, this.crewEl, this.roomEl, this.stickBase, buttons, meters,
      this.promptEl, this.downedEl, this.bannerEl, this.debugEl, this.toastEl, leave,
    );
    parent.appendChild(this.root);
    this.bindControls();
  }

  /* ------------------------------------------------------------- input */

  private bindControls(): void {
    const hold = (node: HTMLElement, set: (v: boolean) => void) => {
      const down = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        node.classList.add('held');
        try {
          node.setPointerCapture(e.pointerId);
        } catch {
          /* pointer already gone */
        }
        set(true);
      };
      const up = () => {
        node.classList.remove('held');
        set(false);
      };
      node.addEventListener('pointerdown', down);
      node.addEventListener('pointerup', up);
      node.addEventListener('pointercancel', up);
      node.addEventListener('pointerleave', up);
    };

    hold(this.sprintBtn, (v) => (this.control.sprint = v));
    hold(this.actionBtn, (v) => (this.control.interact = v));
    // Crouch and torch are toggles: nobody wants to hold a button to stay quiet.
    this.crouchBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.control.crouch = !this.control.crouch;
      this.crouchBtn.classList.toggle('on', this.control.crouch);
    });
    this.torchBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.control.flashlight = !this.control.flashlight;
      this.torchBtn.classList.toggle('on', this.control.flashlight);
    });

    this.stickBase.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.stickPointer = e.pointerId;
      try {
        this.stickBase.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.updateStick(e);
    });
    this.stickBase.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickPointer) this.updateStick(e);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.stickX = 0;
      this.stickY = 0;
      this.stickKnob.style.transform = 'translate(-50%, -50%)';
    };
    this.stickBase.addEventListener('pointerup', release);
    this.stickBase.addEventListener('pointercancel', release);
  }

  private updateStick(e: PointerEvent): void {
    const rect = this.stickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2;
    let dx = (e.clientX - cx) / radius;
    let dy = (e.clientY - cy) / radius;
    const magnitude = Math.hypot(dx, dy);
    if (magnitude > 1) {
      dx /= magnitude;
      dy /= magnitude;
    }
    this.stickX = dx;
    this.stickY = -dy;
    this.stickKnob.style.transform = `translate(calc(-50% + ${dx * radius * 0.55}px), calc(-50% + ${dy * radius * 0.55}px))`;
  }

  /** Look-drag lives on the whole screen except the widgets above. */
  handleLookPointer(type: 'down' | 'move' | 'up', e: PointerEvent, apply: (dx: number, dy: number) => void): void {
    if (type === 'down') {
      if ((e.target as HTMLElement).closest('button, .mp-stick')) return;
      if (this.lookPointer !== null) return;
      this.lookPointer = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.pointerId !== this.lookPointer) return;
    if (type === 'up') {
      this.lookPointer = null;
      return;
    }
    apply((e.clientX - this.lookLast.x) / window.innerWidth, (e.clientY - this.lookLast.y) / window.innerHeight);
    this.lookLast = { x: e.clientX, y: e.clientY };
  }

  /** Rotate stick input into world space using the current look direction. */
  refreshControl(yaw: number): ControlState {
    if (this.scriptedStick) {
      this.stickX = this.scriptedStick.x;
      this.stickY = this.scriptedStick.y;
    }
    if (this.scriptedUse !== null) this.control.interact = this.scriptedUse;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    this.control.mx = this.stickY * forwardX + this.stickX * rightX;
    this.control.mz = this.stickY * forwardZ + this.stickX * rightZ;
    this.control.moving = Math.hypot(this.stickX, this.stickY) > 0.08;
    return this.control;
  }

  /* ------------------------------------------------------------ display */

  setVisible(visible: boolean): void {
    show(this.root, visible);
  }

  applySettings(settings: Readonly<Settings>): void {
    this.root.style.setProperty('--ui-scale', String(settings.buttonScale));
    this.root.style.setProperty('--ui-opacity', String(settings.uiOpacity));
  }

  banner(text: string | null): void {
    show(this.bannerEl, text !== null);
    if (text) this.bannerEl.textContent = text;
  }

  toast(text: string, seconds = 3): void {
    this.toastEl.textContent = text;
    show(this.toastEl, true);
    this.toastTimer = seconds;
  }

  toggleDebug(): void {
    this.debugVisible = !this.debugVisible;
    show(this.debugEl, this.debugVisible);
  }

  update(snap: MatchSnapshot | null, dt: number, secondsPerHour: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) show(this.toastEl, false);
    }
    this.roomEl.textContent = this.focus.roomLabel.toUpperCase();
    if (!snap) return;

    const hour = snap.h;
    this.clockEl.textContent = hour === 0 ? '12 AM' : `${hour} AM`;

    const power = Math.max(0, Math.round(snap.power));
    this.powerEl.textContent = snap.blackout ? 'POWER OUT' : `POWER ${power}%`;
    this.powerEl.classList.toggle('danger', snap.blackout || power < 20);
    this.powerFill.style.width = `${power}%`;
    this.powerFill.style.background = snap.blackout ? '#c8402c' : power < 25 ? '#e0a545' : '#4fd0a0';

    this.objectiveEl.textContent = snap.obj.label;
    this.objectiveEl.classList.toggle('urgent', snap.blackout);
    this.objectiveFill.style.width = `${Math.round(snap.obj.progress * 100)}%`;

    const me = snap.players.find((p) => p.id === this.net.playerId);
    this.batteryFill.style.width = `${me?.b ?? 0}%`;
    this.batteryFill.style.background = (me?.b ?? 0) < 20 ? '#c8402c' : '#4fd0a0';
    this.staminaFill.style.width = `${Math.round((this.net.predicted.stamina / 5.5) * 100)}%`;
    this.torchBtn.classList.toggle('dead', (me?.b ?? 0) <= 0);

    // Crew list: everyone's status, always visible, because knowing who is
    // down and where is the whole game.
    const rows = snap.players.map((p) => {
      const name = this.net.lobby?.players.find((lp) => lp.id === p.id)?.name ?? '???';
      const status = p.s === 1 ? 'DOWN' : p.s === 2 ? 'OUT' : p.s === 3 ? 'DC' : p.f ? 'TORCH' : 'OK';
      const cls = p.s === 1 ? 'down' : p.s === 2 ? 'out' : p.s === 3 ? 'dc' : '';
      return `<div class="mp-crew-row ${cls}"><b>${escapeHtml(name)}</b><span>${status}</span></div>`;
    });
    this.crewEl.innerHTML = rows.join('');

    // Action prompt.
    const downedTarget = this.focus.downedId;
    const interactable = this.focus.interactable;
    const wanted = new Set(snap.obj.targets);
    if (me?.s === 0 && downedTarget) {
      const name = this.net.lobby?.players.find((lp) => lp.id === downedTarget)?.name ?? 'TEAMMATE';
      this.prompt(`HOLD USE TO REVIVE ${name.toUpperCase()}`);
    } else if (me?.s === 0 && interactable) {
      const carried = me.it;
      const label = interactable.kind === 'fusePanel' && carried ? 'FIT THE FUSE' : interactable.label.toUpperCase();
      this.prompt(`HOLD USE - ${label}${wanted.has(interactable.id) ? '  *' : ''}`);
    } else {
      this.prompt(null);
    }

    // Downed / eliminated overlay.
    const downed = me?.s === 1;
    const eliminated = me?.s === 2;
    show(this.downedEl, downed || eliminated);
    if (downed) {
      const value = me?.d ?? 0;
      this.downedText.innerHTML = value > 0
        ? `<b>BEING REVIVED</b><span>${Math.round(value * 100)}%</span>`
        : `<b>YOU ARE DOWN</b><span>${Math.max(0, Math.round(-value))}s</span>`;
    } else if (eliminated) {
      this.downedText.innerHTML = '<b>ELIMINATED</b><span>SPECTATING</span>';
    }

    if (this.debugVisible) {
      const bots = snap.bots.map((b) => `${b.id}:${['patrol', 'look', 'CHASE', 'ATTACK', 'cool'][b.s]}${b.tg ? '->' + b.tg.slice(0, 4) : ''}`);
      this.debugEl.innerHTML = [
        `ping ${this.net.ping}ms   snaps ${this.net.snapshotRate}/s   tick ${snap.k}`,
        `state ${this.net.state}   id ${this.net.playerId.slice(0, 6)}   players ${snap.players.length}`,
        `pos ${this.net.predicted.x.toFixed(2)},${this.net.predicted.z.toFixed(2)}  server ${this.net.serverPosition.x.toFixed(2)},${this.net.serverPosition.z.toFixed(2)}`,
        `drift ${Math.hypot(this.net.predicted.x - this.net.serverPosition.x, this.net.predicted.z - this.net.serverPosition.z).toFixed(3)}m`,
        `power ${snap.power.toFixed(1)}  blackout ${snap.blackout}  step ${snap.obj.step}`,
        `clock ${(snap.ms / 1000).toFixed(1)}s of ${(secondsPerHour * 6).toFixed(0)}s`,
        bots.join('  '),
      ].map((line) => `<div>${escapeHtml(line)}</div>`).join('');
    }
  }

  private prompt(text: string | null): void {
    show(this.promptEl, text !== null);
    if (text) this.promptEl.textContent = text;
  }

  /** What the USE button should target this frame, if anything. */
  currentAction(): { kind: 'interact'; id: string } | { kind: 'revive'; id: string } | null {
    if (this.focus.downedId) return { kind: 'revive', id: this.focus.downedId };
    if (this.focus.interactable) return { kind: 'interact', id: this.focus.interactable.id };
    return null;
  }

  destroy(): void {
    this.root.remove();
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export type { Interactable };
