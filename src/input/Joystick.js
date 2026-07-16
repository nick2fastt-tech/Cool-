/**
 * Joystick.js
 * -----------
 * A floating virtual joystick. The base appears where the player first touches
 * inside its activation zone (feels better than a fixed stick on varying hand
 * sizes) and the knob follows, clamped to a max radius. Outputs a normalised
 * vector in the range [-1, 1] on each axis.
 *
 * This is a pure UI/DOM component; it does not know about the game. The owning
 * TouchControls polls `.value`.
 */

export class Joystick {
  /**
   * @param {HTMLElement} root  container the joystick renders into
   * @param {number} radius     max knob travel in px
   */
  constructor(root, radius = 60) {
    this.radius = radius;
    this.value = { x: 0, y: 0 };
    this.active = false;
    this._touchId = null;
    this._origin = { x: 0, y: 0 };

    this.base = document.createElement('div');
    this.base.className = 'joystick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.base.appendChild(this.knob);
    this.base.style.display = 'none';
    root.appendChild(this.base);
  }

  /** Begin tracking a touch. Positions the base under the finger. */
  begin(touchId, x, y) {
    this.active = true;
    this._touchId = touchId;
    this._origin.x = x;
    this._origin.y = y;
    this.base.style.left = `${x}px`;
    this.base.style.top = `${y}px`;
    this.base.style.display = 'block';
    this._moveKnob(0, 0);
  }

  /** Update the knob from the current finger position. */
  move(x, y) {
    let dx = x - this._origin.x;
    let dy = y - this._origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.radius) {
      dx = (dx / dist) * this.radius;
      dy = (dy / dist) * this.radius;
    }
    this._moveKnob(dx, dy);
    // Screen-y is inverted relative to a forward stick, so negate y.
    this.value.x = dx / this.radius;
    this.value.y = -dy / this.radius;
  }

  end() {
    this.active = false;
    this._touchId = null;
    this.value.x = 0;
    this.value.y = 0;
    this.base.style.display = 'none';
  }

  get touchId() {
    return this._touchId;
  }

  _moveKnob(dx, dy) {
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}
