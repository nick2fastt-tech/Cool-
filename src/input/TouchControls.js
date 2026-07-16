/**
 * TouchControls.js
 * ----------------
 * The unified input layer for touchscreens (with keyboard/mouse fallback for
 * desktop development). It owns:
 *   - a floating left-side virtual joystick (movement)
 *   - Jump and Sprint buttons (bottom-right)
 *   - right-side drag to orbit the camera (single finger)
 *   - two-finger pinch to zoom
 *   - customizable button layout/size (persisted in Storage)
 *
 * It exposes a small, engine-friendly input state:
 *   state.move        {x,y}  normalised movement (-1..1)
 *   state.sprint      bool   sprint held
 *   consumeJump()     bool   true once per jump press (edge-triggered)
 *   consumeLook()     {dx,dy} accumulated look delta since last call
 *   consumeZoom()     number accumulated zoom delta since last call
 *   consumeEmote()    string|null selected emote id
 */

import { Storage } from '../core/Storage.js';
import { Joystick } from './Joystick.js';
import { Vibration } from './Vibration.js';
import { bus } from '../core/EventBus.js';

export class TouchControls {
  constructor(root) {
    this.state = { move: { x: 0, y: 0 }, sprint: false };
    this._jumpQueued = false;
    this._look = { dx: 0, dy: 0 };
    this._zoom = 0;
    this._emote = null;
    this._enabled = true;

    // Track camera/look touches by identifier so multi-touch stays coherent.
    this._lookTouches = new Map(); // id -> {x,y}
    this._pinchDist = null;

    // --- Full-screen touch capture layer (movement + camera) ----------------
    this.layer = document.createElement('div');
    this.layer.className = 'touch-layer';
    root.appendChild(this.layer);

    this.joystick = new Joystick(this.layer, this._pref('joystickRadius', 60));

    // --- On-screen buttons --------------------------------------------------
    this.buttons = document.createElement('div');
    this.buttons.className = 'touch-buttons';
    root.appendChild(this.buttons);

    this.jumpBtn = this._makeButton('⭡', 'btn-jump', () => {
      this._jumpQueued = true;
      Vibration.play('jump');
    });
    this.sprintBtn = this._makeButton('»', 'btn-sprint');
    this._bindHold(this.sprintBtn, (held) => (this.state.sprint = held));

    this._applyLayout();
    this._bindTouch();
    this._bindKeyboard();
  }

  // ---- Public input accessors ---------------------------------------------

  consumeJump() {
    const j = this._jumpQueued;
    this._jumpQueued = false;
    return j;
  }
  consumeLook() {
    const l = { dx: this._look.dx, dy: this._look.dy };
    this._look.dx = 0;
    this._look.dy = 0;
    return l;
  }
  consumeZoom() {
    const z = this._zoom;
    this._zoom = 0;
    return z;
  }
  consumeEmote() {
    const e = this._emote;
    this._emote = null;
    return e;
  }
  triggerEmote(id) {
    this._emote = id;
  }

  /** Enable/disable gameplay input (e.g. while a menu is open). */
  setEnabled(v) {
    this._enabled = v;
    this.layer.style.pointerEvents = v ? 'auto' : 'none';
    this.buttons.style.display = v ? 'flex' : 'none';
    if (!v) {
      this.joystick.end();
      this.state.move.x = this.state.move.y = 0;
      this.state.sprint = false;
    }
  }

  // ---- Settings / layout ---------------------------------------------------

  _pref(key, dflt) {
    return Storage.get('controls.' + key, dflt);
  }
  setPref(key, value) {
    Storage.set('controls.' + key, value);
    this._applyLayout();
  }

  _applyLayout() {
    const scale = this._pref('buttonScale', 1);
    this.buttons.style.setProperty('--btn-scale', scale);
    const side = this._pref('leftHanded', false);
    // Left-handed: put action buttons on the left, joystick zone on the right.
    this.buttons.style.left = side ? '0' : 'auto';
    this.buttons.style.right = side ? 'auto' : '0';
    this._leftHanded = side;
  }

  // ---- Construction helpers ------------------------------------------------

  _makeButton(label, cls, onPress) {
    const b = document.createElement('button');
    b.className = `touch-btn ${cls}`;
    b.textContent = label;
    if (onPress) {
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this._enabled) onPress();
      };
      b.addEventListener('touchstart', handler, { passive: false });
      b.addEventListener('mousedown', handler);
    }
    this.buttons.appendChild(b);
    return b;
  }

  /** Wire a button to report held/released for continuous actions (sprint). */
  _bindHold(btn, onChange) {
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._enabled) {
        onChange(true);
        btn.classList.add('active');
      }
    };
    const up = (e) => {
      e.stopPropagation();
      onChange(false);
      btn.classList.remove('active');
    };
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('touchend', up);
    btn.addEventListener('touchcancel', up);
    btn.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
  }

  // ---- Touch handling ------------------------------------------------------

  _bindTouch() {
    const el = this.layer;
    el.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    el.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    el.addEventListener('touchend', (e) => this._onTouchEnd(e));
    el.addEventListener('touchcancel', (e) => this._onTouchEnd(e));

    // Mouse fallback for desktop testing (drag = look, wheel = zoom).
    let dragging = false;
    let last = null;
    el.addEventListener('mousedown', (e) => {
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging || !this._enabled) return;
      this._look.dx += e.clientX - last.x;
      this._look.dy += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => (dragging = false));
    el.addEventListener('wheel', (e) => {
      if (this._enabled) this._zoom += e.deltaY * 0.01;
    }, { passive: true });
  }

  /** Is this X coordinate in the movement (joystick) half of the screen? */
  _isMoveZone(x) {
    const mid = window.innerWidth / 2;
    return this._leftHanded ? x > mid : x < mid;
  }

  _onTouchStart(e) {
    if (!this._enabled) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this._isMoveZone(t.clientX) && !this.joystick.active) {
        this.joystick.begin(t.identifier, t.clientX, t.clientY);
      } else {
        this._lookTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
    this._updatePinchBaseline();
  }

  _onTouchMove(e) {
    if (!this._enabled) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joystick.touchId) {
        this.joystick.move(t.clientX, t.clientY);
        this.state.move.x = this.joystick.value.x;
        this.state.move.y = this.joystick.value.y;
      } else if (this._lookTouches.has(t.identifier)) {
        const prev = this._lookTouches.get(t.identifier);
        // Only feed single-finger drags to look; pinch handled separately.
        if (this._lookTouches.size < 2) {
          this._look.dx += t.clientX - prev.x;
          this._look.dy += t.clientY - prev.y;
        }
        prev.x = t.clientX;
        prev.y = t.clientY;
      }
    }
    this._handlePinch();
  }

  _onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.joystick.touchId) {
        this.joystick.end();
        this.state.move.x = 0;
        this.state.move.y = 0;
      }
      this._lookTouches.delete(t.identifier);
    }
    this._pinchDist = null;
    this._updatePinchBaseline();
  }

  _updatePinchBaseline() {
    if (this._lookTouches.size === 2) {
      const [a, b] = [...this._lookTouches.values()];
      this._pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  _handlePinch() {
    if (this._lookTouches.size !== 2) return;
    const [a, b] = [...this._lookTouches.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (this._pinchDist != null) {
      // Spread fingers -> zoom in (negative distance).
      this._zoom -= (d - this._pinchDist) * 0.02;
    }
    this._pinchDist = d;
  }

  // ---- Keyboard fallback (desktop dev) ------------------------------------

  _bindKeyboard() {
    const keys = new Set();
    const sync = () => {
      let x = 0;
      let y = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      const len = Math.hypot(x, y) || 1;
      this.state.move.x = x / len;
      this.state.move.y = y / len;
      this.state.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    };
    window.addEventListener('keydown', (e) => {
      if (!this._enabled) return;
      if (e.code === 'Space') this._jumpQueued = true;
      keys.add(e.code);
      sync();
    });
    window.addEventListener('keyup', (e) => {
      keys.delete(e.code);
      sync();
    });
  }
}
