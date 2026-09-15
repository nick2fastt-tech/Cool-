// T10 World - unified input: keyboard/mouse, touch joystick + drag look, gamepad
import { settings } from './settings.js';
import { clampv } from './math.js';

const DEADZONE = 0.14;

export class InputManager {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.pressedThisFrame = new Set();
    this.releasedThisFrame = new Set();

    // Normalized intent, consumed by player/vehicle controllers.
    this.move = { x: 0, y: 0 };        // x = strafe, y = forward
    this.look = { x: 0, y: 0 };        // delta this frame, radians-ish
    this.buttons = {
      jump: false, sprint: false, crouch: false, interact: false,
      enterVehicle: false, handbrake: false, horn: false, walk: false,
    };
    this.edges = {};                    // one-frame rising edges of the above

    this.pointerLocked = false;
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.lastInputKind = this.isTouch ? 'touch' : 'kbm';
    this.gamepadIndex = null;

    // Touch state
    this.touchStick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, radius: 62 };
    this.touchLook = { active: false, id: null, lx: 0, ly: 0 };
    this.uiTouches = new Set();         // touches that started on a UI button — never steer the camera

    this._suspended = false;
    this.bind();
  }

  /** Suspended while a menu/chat owns the input (movement stops, typing works). */
  setSuspended(v) {
    if (this._suspended === v) return;
    this._suspended = v;
    if (v) {
      this.keys.clear();
      this.move.x = this.move.y = 0;
      for (const k in this.buttons) this.buttons[k] = false;
      this.touchStick.active = false; this.touchStick.id = null;
      this.touchLook.active = false; this.touchLook.id = null;
      this.exitPointerLock();
    }
  }
  get suspended() { return this._suspended; }

  bind() {
    const kb = settings.get('keyBindings');
    this._onKeyDown = (e) => {
      if (this.isTypingTarget(e.target)) return;
      this.lastInputKind = 'kbm';
      if (!this.keys.has(e.code)) this.pressedThisFrame.add(e.code);
      this.keys.add(e.code);
      // Don't let the page scroll or the browser steal common game keys.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      this.releasedThisFrame.add(e.code);
    };
    this._onBlur = () => { this.keys.clear(); };

    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);

    // ---- Mouse look (pointer lock on PC) ----
    this._onMouseMove = (e) => {
      if (!this.pointerLocked || this._suspended) return;
      const s = settings.get('lookSensitivity') * 0.0022;
      this.look.x += e.movementX * s;
      this.look.y += e.movementY * s * (settings.get('invertY') ? -1 : 1);
      this.lastInputKind = 'kbm';
    };
    document.addEventListener('mousemove', this._onMouseMove);

    this._onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
      if (this.onPointerLockChange) this.onPointerLockChange(this.pointerLocked);
    };
    document.addEventListener('pointerlockchange', this._onPointerLockChange);

    this._onMouseDown = (e) => {
      if (this._suspended) return;
      if (e.button === 0) this.mouseLeft = true;
      if (e.button === 2) this.mouseRight = true;
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseLeft = false;
      if (e.button === 2) this.mouseRight = false;
    };
    this.dom.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());

    this._onWheel = (e) => {
      if (this._suspended) return;
      this.wheel = (this.wheel || 0) + Math.sign(e.deltaY);
    };
    this.dom.addEventListener('wheel', this._onWheel, { passive: true });

    // ---- Touch ----
    if (this.isTouch) this.bindTouch();
  }

  bindTouch() {
    const halfSplit = () => (settings.get('leftHandedTouch') ? 0.5 : 0.5);

    const start = (e) => {
      if (this._suspended) return;
      this.lastInputKind = 'touch';
      for (const t of e.changedTouches) {
        if (this.uiTouches.has(t.identifier)) continue;
        const leftSide = t.clientX < window.innerWidth * halfSplit();
        const stickSide = settings.get('leftHandedTouch') ? !leftSide : leftSide;
        if (stickSide && !this.touchStick.active) {
          this.touchStick.active = true;
          this.touchStick.id = t.identifier;
          this.touchStick.ox = t.clientX; this.touchStick.oy = t.clientY;
          this.touchStick.x = 0; this.touchStick.y = 0;
          if (this.onStickShow) this.onStickShow(t.clientX, t.clientY);
        } else if (!this.touchLook.active) {
          this.touchLook.active = true;
          this.touchLook.id = t.identifier;
          this.touchLook.lx = t.clientX; this.touchLook.ly = t.clientY;
        }
      }
    };

    const move = (e) => {
      if (this._suspended) return;
      for (const t of e.changedTouches) {
        if (this.touchStick.active && t.identifier === this.touchStick.id) {
          let dx = t.clientX - this.touchStick.ox;
          let dy = t.clientY - this.touchStick.oy;
          const r = this.touchStick.radius;
          const len = Math.hypot(dx, dy);
          if (len > r) { dx = (dx / len) * r; dy = (dy / len) * r; }
          this.touchStick.x = dx / r;
          this.touchStick.y = dy / r;
          if (this.onStickMove) this.onStickMove(dx, dy);
        } else if (this.touchLook.active && t.identifier === this.touchLook.id) {
          const s = settings.get('touchLookSensitivity') * 0.0052;
          this.look.x += (t.clientX - this.touchLook.lx) * s;
          this.look.y += (t.clientY - this.touchLook.ly) * s * (settings.get('invertY') ? -1 : 1);
          this.touchLook.lx = t.clientX;
          this.touchLook.ly = t.clientY;
        }
      }
      if (e.cancelable) e.preventDefault();
    };

    const end = (e) => {
      for (const t of e.changedTouches) {
        this.uiTouches.delete(t.identifier);
        if (t.identifier === this.touchStick.id) {
          this.touchStick.active = false; this.touchStick.id = null;
          this.touchStick.x = 0; this.touchStick.y = 0;
          if (this.onStickHide) this.onStickHide();
        }
        if (t.identifier === this.touchLook.id) {
          this.touchLook.active = false; this.touchLook.id = null;
        }
      }
    };

    window.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }

  /** UI buttons call this so their touches never double as camera drags. */
  claimTouch(id) { this.uiTouches.add(id); }

  isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  requestPointerLock() {
    if (this.isTouch || this._suspended) return;
    if (document.pointerLockElement !== this.dom && this.dom.requestPointerLock) {
      const p = this.dom.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    }
  }
  exitPointerLock() {
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  }

  keyFor(action) { return settings.get('keyBindings')[action]; }
  isDown(action) { return this.keys.has(this.keyFor(action)); }
  justPressed(action) { return this.pressedThisFrame.has(this.keyFor(action)); }

  /** Virtual button pressed by an on-screen control. */
  setVirtual(name, value) {
    this._virtual = this._virtual || {};
    this._virtual[name] = value;
  }
  virtual(name) { return !!(this._virtual && this._virtual[name]); }

  pollGamepad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    let pad = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) { pad = pads[i]; this.gamepadIndex = i; break; }
    }
    if (!pad) { this.gamepadIndex = null; return null; }
    const ax = (v) => (Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE));
    const lx = ax(pad.axes[0] || 0), ly = ax(pad.axes[1] || 0);
    const rx = ax(pad.axes[2] || 0), ry = ax(pad.axes[3] || 0);
    if (Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0.05) this.lastInputKind = 'gamepad';
    return { pad, lx, ly, rx, ry };
  }

  /** Fold every source into one intent. Call once per frame, before controllers. */
  update(dt) {
    this.look.x = 0; this.look.y = 0;
    let mx = 0, my = 0;

    if (!this._suspended) {
      // Keyboard
      if (this.isDown('forward') || this.keys.has('ArrowUp')) my += 1;
      if (this.isDown('back') || this.keys.has('ArrowDown')) my -= 1;
      if (this.isDown('left') || this.keys.has('ArrowLeft')) mx -= 1;
      if (this.isDown('right') || this.keys.has('ArrowRight')) mx += 1;

      // Touch stick
      if (this.touchStick.active) {
        mx += this.touchStick.x;
        my -= this.touchStick.y;
      }
    }

    // Gamepad
    const gp = this.pollGamepad();
    if (gp && !this._suspended) {
      mx += gp.lx; my -= gp.ly;
      const ls = settings.get('lookSensitivity') * 2.6 * dt;
      this.look.x += gp.rx * ls;
      this.look.y += gp.ry * ls * (settings.get('invertY') ? -1 : 1);
    }

    // Mouse look already accumulated in this.look by the move handler.
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx; this.move.y = my;

    const prev = Object.assign({}, this.buttons);
    const b = this.buttons;
    if (this._suspended) {
      for (const k in b) b[k] = false;
    } else {
      b.jump = this.isDown('jump') || this.virtual('jump') || !!(gp && gp.pad.buttons[0] && gp.pad.buttons[0].pressed);
      b.sprint = this.isDown('sprint') || this.virtual('sprint') || !!(gp && gp.pad.buttons[10] && gp.pad.buttons[10].pressed);
      b.crouch = this.isDown('crouch') || this.virtual('crouch') || !!(gp && gp.pad.buttons[1] && gp.pad.buttons[1].pressed);
      b.interact = this.isDown('interact') || this.virtual('interact') || !!(gp && gp.pad.buttons[2] && gp.pad.buttons[2].pressed);
      b.enterVehicle = this.isDown('enterVehicle') || this.virtual('enterVehicle') || !!(gp && gp.pad.buttons[3] && gp.pad.buttons[3].pressed);
      b.handbrake = this.virtual('handbrake') || !!(gp && gp.pad.buttons[0] && gp.pad.buttons[0].pressed);
      b.horn = this.isDown('horn') || this.virtual('horn');
      b.walk = this.keys.has(this.keyFor('walkToggle'));
    }
    for (const k in b) this.edges[k] = b[k] && !prev[k];

    this.gamepadEdges = {};
    if (gp) {
      this._prevPad = this._prevPad || {};
      for (let i = 0; i < gp.pad.buttons.length; i++) {
        const now = gp.pad.buttons[i].pressed;
        this.gamepadEdges[i] = now && !this._prevPad[i];
        this._prevPad[i] = now;
      }
    }
  }

  /** Call at the very end of the frame. */
  endFrame() {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.wheel = 0;
    if (this._virtual) for (const k in this._virtual) { if (this._virtual[k] === 'once') this._virtual[k] = false; }
  }

  vibrate(ms) {
    if (!settings.get('hapticFeedback')) return;
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }
}
