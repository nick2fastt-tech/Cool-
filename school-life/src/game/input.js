// Touch + mouse + keyboard input. Multi-touch: the grey joystick and look-drag work at once.
export class Input {
  constructor(canvas, joystickEl) {
    this.canvas = canvas;
    this.joy = joystickEl;
    this.knob = joystickEl.querySelector('.joy-knob');
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.keys = new Set();
    this.enabled = false;
    this.joyId = null;
    this.lookId = null;
    this.lookLast = { x: 0, y: 0 };
    this.lookType = 'touch';
    this.useRequested = false;
    this.scheduleRequested = false;
    this.escapeRequested = false;
    this._joyVec = { x: 0, y: 0 };
    this._bind();
  }

  _bind() {
    const joy = this.joy;
    const setKnob = (x, y) => {
      this.knob.style.transform = `translate(${x}px, ${y}px)`;
    };
    const joyMove = (e) => {
      const r = joy.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const max = r.width * 0.36;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      setKnob(dx, dy);
      // small dead zone + smooth response curve
      let nx = dx / max;
      let ny = -dy / max;
      const m = Math.hypot(nx, ny);
      if (m < 0.12) { nx = 0; ny = 0; } else {
        const k = (m - 0.12) / 0.88 / m;
        nx *= k;
        ny *= k;
      }
      this._joyVec.x = nx;
      this._joyVec.y = ny;
    };
    const joyEnd = (e) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this._joyVec.x = 0;
      this._joyVec.y = 0;
      joy.classList.remove('active');
      this.knob.style.transition = 'transform .12s ease-out';
      setKnob(0, 0);
      setTimeout(() => { this.knob.style.transition = ''; }, 130);
    };
    joy.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.joyId !== null) return;
      e.preventDefault();
      this.joyId = e.pointerId;
      try { joy.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      joy.classList.add('active');
      joyMove(e);
    });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joyId) joyMove(e);
    });
    joy.addEventListener('pointerup', joyEnd);
    joy.addEventListener('pointercancel', joyEnd);
    joy.addEventListener('lostpointercapture', joyEnd);

    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.lookId !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      this.lookId = e.pointerId;
      this.lookType = e.pointerType;
      this.lookLast.x = e.clientX;
      this.lookLast.y = e.clientY;
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      this.look.dx += e.clientX - this.lookLast.x;
      this.look.dy += e.clientY - this.lookLast.y;
      this.lookLast.x = e.clientX;
      this.lookLast.y = e.clientY;
    });
    const lookEnd = (e) => {
      if (e.pointerId === this.lookId) this.lookId = null;
    };
    c.addEventListener('pointerup', lookEnd);
    c.addEventListener('pointercancel', lookEnd);
    c.addEventListener('lostpointercapture', lookEnd);
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        this.keys.add(k);
        e.preventDefault();
      }
      if (k === 'e' || k === 'enter' || k === ' ') { this.useRequested = true; e.preventDefault(); }
      if (k === 'q' || k === 'tab') { this.scheduleRequested = true; e.preventDefault(); }
      if (k === 'escape') this.escapeRequested = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.reset());
  }

  reset() {
    this.keys.clear();
    this.look.dx = 0;
    this.look.dy = 0;
    this._joyVec.x = 0;
    this._joyVec.y = 0;
    this.joyId = null;
    this.lookId = null;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.joy.classList.remove('active');
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.reset();
  }

  /** Call once per frame. Returns movement (x right, y forward) in -1..1. */
  poll() {
    let x = this._joyVec.x;
    let y = this._joyVec.y;
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) y += 1;
    if (k.has('s') || k.has('arrowdown')) y -= 1;
    if (k.has('d')) x += 1;
    if (k.has('a')) x -= 1;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    this.move.x = x;
    this.move.y = y;
    // arrow keys turn on desktop
    let turn = 0;
    if (k.has('arrowleft')) turn -= 1;
    if (k.has('arrowright')) turn += 1;
    return { x, y, turn, sprint: k.has('shift') };
  }

  consumeLook() {
    const d = { dx: this.look.dx, dy: this.look.dy, type: this.lookType };
    this.look.dx = 0;
    this.look.dy = 0;
    return d;
  }

  take(flag) {
    const v = this[flag];
    this[flag] = false;
    return v;
  }
}
