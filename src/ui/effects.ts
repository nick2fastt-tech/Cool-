import { QUALITY, type QualityPreset } from '../game/config';

/**
 * Full-screen post effects, done in the DOM rather than in WebGL.
 *
 * Scanlines and the vignette are static CSS - free. The camera static is a
 * tiny noise canvas (64x64 at the lowest preset) stretched over the screen
 * with pixelated scaling and a screen blend, which costs a fraction of what a
 * real post-processing pass would on a mid-range phone.
 */
export class Effects {
  private staticCanvas: HTMLCanvasElement;
  private staticCtx: CanvasRenderingContext2D;
  private dark: HTMLElement;
  private flash: HTMLElement;
  private staticTarget = 0;
  private staticCurrent = 0;
  private nextNoise = 0;
  private size = 64;

  constructor(parent: HTMLElement, quality: QualityPreset) {
    const scan = document.createElement('div');
    scan.className = 'fx fx-scanlines';
    const vig = document.createElement('div');
    vig.className = 'fx fx-vignette';
    this.staticCanvas = document.createElement('canvas');
    this.staticCanvas.id = 'static-canvas';
    this.dark = document.createElement('div');
    this.dark.className = 'fx fx-dark';
    this.flash = document.createElement('div');
    this.flash.className = 'fx fx-flash';
    parent.append(scan, vig, this.staticCanvas, this.dark, this.flash);

    const ctx = this.staticCanvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.staticCtx = ctx;
    this.setQuality(quality);
  }

  setQuality(quality: QualityPreset): void {
    // Lower presets get chunkier, cheaper noise.
    this.size = Math.max(32, Math.round(256 / QUALITY[quality].staticDivisor));
    this.staticCanvas.width = this.size;
    this.staticCanvas.height = this.size;
  }

  /** 0 = clean feed, 1 = full snow. */
  setStatic(amount: number): void {
    this.staticTarget = amount;
  }

  setDark(amount: number): void {
    this.dark.style.opacity = String(amount);
  }

  flashOnce(duration = 0.12): void {
    this.flash.style.transition = 'none';
    this.flash.style.opacity = '0.85';
    requestAnimationFrame(() => {
      this.flash.style.transition = `opacity ${duration}s ease-out`;
      this.flash.style.opacity = '0';
    });
  }

  update(now: number): void {
    this.staticCurrent += (this.staticTarget - this.staticCurrent) * 0.25;
    const visible = this.staticCurrent > 0.01;
    this.staticCanvas.style.opacity = visible ? String(this.staticCurrent * 0.4) : '0';
    if (!visible || now < this.nextNoise) return;
    // 20 Hz is plenty for snow and saves a third of the fill cost at 60 fps.
    this.nextNoise = now + 0.05;
    const img = this.staticCtx.createImageData(this.size, this.size);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
    this.staticCtx.putImageData(img, 0, 0);
  }
}
