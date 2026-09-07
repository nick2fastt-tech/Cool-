/**
 * Touch and pointer input.
 *
 * Pointer events cover touch, pen and mouse in one path, so the game plays the
 * same on a phone and in a desktop browser. Two rules matter for a horror game
 * on a phone: a button must fire on *press*, never on click (a slam door needs
 * to move before your thumb lifts), and a drag must never scroll the page.
 */

export interface LookHandler {
  (dxNormalised: number, dyNormalised: number): void;
}

export class TouchInput {
  private lookPointer: number | null = null;
  private lastX = 0;
  private lastY = 0;
  /** Set false while the tablet is up - the office view is not draggable then. */
  lookEnabled = true;
  haptics = true;

  constructor(surface: HTMLElement, private readonly onLook: LookHandler) {
    surface.addEventListener('pointerdown', this.down, { passive: false });
    surface.addEventListener('pointermove', this.move, { passive: false });
    surface.addEventListener('pointerup', this.up, { passive: true });
    surface.addEventListener('pointercancel', this.up, { passive: true });
    // Kill the browser gestures that would otherwise fight the game.
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  private down = (e: PointerEvent): void => {
    if (!this.lookEnabled || this.lookPointer !== null) return;
    if ((e.target as HTMLElement).closest('button')) return;
    this.lookPointer = e.pointerId;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private move = (e: PointerEvent): void => {
    if (e.pointerId !== this.lookPointer) return;
    e.preventDefault();
    const dx = (e.clientX - this.lastX) / window.innerWidth;
    const dy = (e.clientY - this.lastY) / window.innerHeight;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.onLook(dx, dy);
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId === this.lookPointer) this.lookPointer = null;
  };

  /** Fire once on press. */
  bindTap(node: HTMLElement, fn: () => void): void {
    node.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.buzz(8);
      fn();
    });
  }

  /** Hold-to-activate: down and up are both meaningful (lights, hand crank). */
  bindHold(node: HTMLElement, onDown: () => void, onUp: () => void): void {
    let active = false;
    const start = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (active) return;
      active = true;
      node.classList.add('held');
      // Capture keeps the hold alive if the thumb slides off the button.
      // It throws when the pointer is already gone, which must not swallow
      // the press itself - a dropped door light gets somebody killed.
      try {
        node.setPointerCapture?.(e.pointerId);
      } catch {
        /* pointer already released */
      }
      this.buzz(6);
      onDown();
    };
    const end = () => {
      if (!active) return;
      active = false;
      node.classList.remove('held');
      onUp();
    };
    node.addEventListener('pointerdown', start);
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.addEventListener('pointerleave', end);
  }

  buzz(ms: number): void {
    if (!this.haptics) return;
    navigator.vibrate?.(ms);
  }
}
