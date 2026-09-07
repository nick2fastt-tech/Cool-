/**
 * Fixed-timestep simulation driver.
 *
 * Gameplay (AI rolls, power drain, the clock) runs at a fixed 30 Hz so results
 * never depend on the device's frame rate - a phone dropping to 24 fps must not
 * make the animatronics slower or the power last longer. Rendering runs as fast
 * as the device allows and interpolates nothing critical.
 */
export class Ticker {
  readonly stepSeconds: number;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  /** Guard against huge catch-up loops after a tab/app suspend. */
  private readonly maxStepsPerFrame = 6;

  constructor(
    private readonly onFixed: (dt: number) => void,
    private readonly onRender: (alpha: number, frameDt: number) => void,
    hz = 30,
  ) {
    this.stepSeconds = 1 / hz;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(frame);
      const frameDt = Math.min((now - this.lastTime) / 1000, 0.25);
      this.lastTime = now;
      this.accumulator += frameDt;
      let steps = 0;
      while (this.accumulator >= this.stepSeconds && steps < this.maxStepsPerFrame) {
        this.onFixed(this.stepSeconds);
        this.accumulator -= this.stepSeconds;
        steps++;
      }
      if (steps === this.maxStepsPerFrame) this.accumulator = 0;
      this.onRender(this.accumulator / this.stepSeconds, frameDt);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
