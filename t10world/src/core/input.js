// T10 World - unified input: keyboard/mouse, touch joystick + screen dragging,
// gamepad. Touches are tracked by pointer id so the stick and the look-drag
// never steal each other's finger.
import { settings } from './settings.js';
import { clamp01, clampv } from './math.js';

const PAD_DEADZONE = 0.14;
const STICK_DEADZONE = 0.14;
const STICK_RADIUS = 66;          // matches the 132px ring drawn by the HUD

export class InputManager {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.pressedThisFrame = new Set();
    this.releasedThisFrame = new Set();

    // Normalized intent, consumed by the player and vehicle controllers.
    this.move = { x: 0, y: 0 };        // x = strafe, y = forward
    this.look = { x: 0, y: 0 };        // delta this frame
    this.buttons = {
      jump: false, crouch: false, interact: false,
      enterVehicle: false, handbrake: false, horn: false,
    };
    this.edges = {};

    this.pointerLocked = false;
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.lastInputKind = this.isTouch ? 'touch' : 'kbm';
    this.gamepadIndex = null;

    // One record per active finger. role: 'stick' | 'look' | 'ui'
    this.touches = new Map();
    this.stickId = null;
    this.stick = { x: 0, y: 0, ox: 0, oy: 0 };
    this.uiClaimed = new Set();

    // Desktop drag-to-look, for players who don't want pointer lock.
    this.mouseDragging = false;
    this.mouseLast = { x: 0, y: 0 };

    this._suspended = false;
    this.bind();
  }

  /** Suspended while a menu or the chat owns input. */
  setSuspended(v) {
    if (this._suspended === v) return;
    this._suspended = v;
    if (v) {
      this.keys.clear();
      this.move.x = this.move.y = 0;
      for (const k in this.buttons) this.buttons[k] = false;
      this.releaseStick();
      this.touches.clear();
      this.mouseDragging = false;
      this.look.x = this.look.y = 0;
      if (this._virtual) for (const k in this._virtual) this._virtual[k] = false;
      this.exitPointerLock();
    }
  }
  get suspended() { return this._suspended; }

  bind() {
    this._onKeyDown = (e) => {
      if (this.isTypingTarget(e.target)) return;
      this.lastInputKind = 'kbm';
      if (!this.keys.has(e.code)) this.pressedThisFrame.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      this.releasedThisFrame.add(e.code);
    };
    this._onBlur = () => { this.keys.clear(); this.mouseDragging = false; };

    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);

    // ---- Mouse: pointer lock when granted, drag-to-look otherwise ----------
    this._onMouseMove = (e) => {
      if (this._suspended) return;
      const s = settings.get('lookSensitivity') * 0.0022;
      if (this.pointerLocked) {
        this.look.x += e.movementX * s;
        this.look.y += e.movementY * s * (settings.get('invertY') ? -1 : 1);
        this.lastInputKind = 'kbm';
      } else if (this.mouseDragging) {
        const dx = e.clientX - this.mouseLast.x;
        const dy = e.clientY - this.mouseLast.y;
        this.mouseLast.x = e.clientX;
        this.mouseLast.y = e.clientY;
        this.look.x += dx * s * 1.35;
        this.look.y += dy * s * 1.35 * (settings.get('invertY') ? -1 : 1);
        this.lastInputKind = 'kbm';
      }
    };
    document.addEventListener('mousemove', this._onMouseMove);

    this._onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
      if (this.onPointerLockChange) this.onPointerLockChange(this.pointerLocked);
    };
    document.addEventListener('pointerlockchange', this._onPointerLockChange);

    this._onMouseDown = (e) => {
      if (this._suspended) return;
      if (e.button === 0) {
        this.mouseLeft = true;
        if (!this.pointerLocked) {
          this.mouseDragging = true;
          this.mouseLast.x = e.clientX;
          this.mouseLast.y = e.clientY;
        }
      }
      if (e.button === 2) this.mouseRight = true;
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) { this.mouseLeft = false; this.mouseDragging = false; }
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

    if (this.isTouch) this.bindTouch();
  }

  // -------------------------------------------------------------------------
  // Touch
  // -------------------------------------------------------------------------

  /** Which half of the screen drives the joystick. */
  stickSideTest(clientX) {
    const leftHanded = settings.get('leftHandedTouch');
    const onLeft = clientX < window.innerWidth * 0.5;
    return leftHanded ? !onLeft : onLeft;
  }

  bindTouch() {
    const start = (e) => {
      if (this._suspended) return;
      this.lastInputKind = 'touch';
      for (const t of e.changedTouches) {
        if (this.uiClaimed.has(t.identifier)) {
          this.touches.set(t.identifier, { role: 'ui' });
          continue;
        }
        // The first finger on the movement half drives the stick; every other
        // finger drags the view, wherever it lands.
        if (this.stickId === null && this.stickSideTest(t.clientX)) {
          this.stickId = t.identifier;
          this.stick.ox = t.clientX;
          this.stick.oy = t.clientY;
          this.stick.x = 0;
          this.stick.y = 0;
          this.touches.set(t.identifier, { role: 'stick' });
          if (this.onStickShow) this.onStickShow(t.clientX, t.clientY);
        } else {
          this.touches.set(t.identifier, { role: 'look', lx: t.clientX, ly: t.clientY });
        }
      }
    };

    const move = (e) => {
      if (this._suspended) return;
      for (const t of e.changedTouches) {
        const rec = this.touches.get(t.identifier);
        if (!rec || rec.role === 'ui') continue;
        if (rec.role === 'stick') {
          let dx = t.clientX - this.stick.ox;
          let dy = t.clientY - this.stick.oy;
          const len = Math.hypot(dx, dy);
          if (len > STICK_RADIUS) {
            dx = (dx / len) * STICK_RADIUS;
            dy = (dy / len) * STICK_RADIUS;
          }
          this.stick.x = dx / STICK_RADIUS;
          this.stick.y = dy / STICK_RADIUS;
          if (this.onStickMove) this.onStickMove(dx, dy);
        } else {
          const s = settings.get('touchLookSensitivity') * 0.0052;
          this.look.x += (t.clientX - rec.lx) * s;
          this.look.y += (t.clientY - rec.ly) * s * (settings.get('invertY') ? -1 : 1);
          rec.lx = t.clientX;
          rec.ly = t.clientY;
        }
      }
      if (e.cancelable) e.preventDefault();
    };

    const end = (e) => {
      for (const t of e.changedTouches) {
        this.uiClaimed.delete(t.identifier);
        const rec = this.touches.get(t.identifier);
        this.touches.delete(t.identifier);
        if (rec && rec.role === 'stick') this.releaseStick();
      }
    };

    window.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }

  releaseStick() {
    this.stickId = null;
    this.stick.x = 0;
    this.stick.y = 0;
    if (this.onStickHide) this.onStickHide();
  }

  /** On-screen buttons call this so their touch never becomes a look-drag. */
  claimTouch(id) { this.uiClaimed.add(id); }

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
    const ax = (v) => (Math.abs(v) < PAD_DEADZONE ? 0 : (v - Math.sign(v) * PAD_DEADZONE) / (1 - PAD_DEADZONE));
    const lx = ax(pad.axes[0] || 0), ly = ax(pad.axes[1] || 0);
    const rx = ax(pad.axes[2] || 0), ry = ax(pad.axes[3] || 0);
    if (Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0.05) this.lastInputKind = 'gamepad';
    return { pad, lx, ly, rx, ry };
  }

  /**
   * Fold every source into one intent. Call once per frame, before controllers.
   * `look` is NOT cleared here — mouse and touch accumulate into it between
   * frames, and clearing it now would throw that away before anyone reads it.
   * endFrame() clears it, after the player has consumed it.
   */
  update(dt) {
    let mx = 0, my = 0;

    if (!this._suspended) {
      if (this.isDown('forward') || this.keys.has('ArrowUp')) my += 1;
      if (this.isDown('back') || this.keys.has('ArrowDown')) my -= 1;
      if (this.isDown('left') || this.keys.has('ArrowLeft')) mx -= 1;
      if (this.isDown('right') || this.keys.has('ArrowRight')) mx += 1;

      // Joystick, with a dead zone and a smooth ramp out of it.
      const sx = this.stick.x, sy = this.stick.y;
      const mag = Math.hypot(sx, sy);
      if (mag > STICK_DEADZONE) {
        const scaled = (mag - STICK_DEADZONE) / (1 - STICK_DEADZONE);
        mx += (sx / mag) * scaled;
        my += (-sy / mag) * scaled;
      }
    }

    const gp = this.pollGamepad();
    if (gp && !this._suspended) {
      mx += gp.lx; my -= gp.ly;
      const ls = settings.get('lookSensitivity') * 2.6 * dt;
      this.look.x += gp.rx * ls;
      this.look.y += gp.ry * ls * (settings.get('invertY') ? -1 : 1);
    }

    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx; this.move.y = my;

    const prev = Object.assign({}, this.buttons);
    const b = this.buttons;
    if (this._suspended) {
      for (const k in b) b[k] = false;
    } else {
      b.jump = this.isDown('jump') || this.virtual('jump') || !!(gp && gp.pad.buttons[0] && gp.pad.buttons[0].pressed);
      b.crouch = this.isDown('crouch') || this.virtual('crouch') || !!(gp && gp.pad.buttons[1] && gp.pad.buttons[1].pressed);
      b.interact = this.isDown('interact') || this.virtual('interact') || !!(gp && gp.pad.buttons[2] && gp.pad.buttons[2].pressed);
      b.enterVehicle = this.isDown('enterVehicle') || this.virtual('enterVehicle') || !!(gp && gp.pad.buttons[3] && gp.pad.buttons[3].pressed);
      b.handbrake = this.virtual('handbrake') || !!(gp && gp.pad.buttons[0] && gp.pad.buttons[0].pressed);
      b.horn = this.isDown('horn') || this.virtual('horn');
      // Firing is the left mouse only once the pointer is locked, so that
      // click-and-drag to look never lets off a round.
      b.fire = (this.pointerLocked && this.mouseLeft) || this.virtual('fire');
      b.aim = (this.pointerLocked && this.mouseRight) || this.virtual('aim');
      b.reload = this.isDown('reload') || this.virtual('reload');
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

  endFrame() {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.wheel = 0;
    // The look delta is per-frame: everything accumulated since the last frame
    // has now been applied, so start the next one from zero.
    this.look.x = 0; this.look.y = 0;
  }

  vibrate(ms) {
    if (!settings.get('hapticFeedback')) return;
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }
}
