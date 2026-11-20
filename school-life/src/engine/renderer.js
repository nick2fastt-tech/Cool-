// WebGL renderer with MAX graphics settings + dynamic resolution (keeps it lag-free).
import * as THREE from 'three';

export class GameRenderer {
  constructor(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false, alpha: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    r.setClearColor(0x0d1626, 1);
    this.r = r;
    this.canvas = canvas;
    this.maxPR = Math.min(window.devicePixelRatio || 1, 2);
    this.scale = 1;
    this.minScale = 0.55;
    this.dynamic = true;
    this.ema = 16.7;
    this.evalTimer = 0;
    this.cooldown = 0;
    this.width = 0;
    this.height = 0;
    this.contextLost = false;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      r.shadowMap.needsUpdate = true;
    });
  }

  resize(camera) {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.maxPR = Math.min(window.devicePixelRatio || 1, 2);
    this.width = w;
    this.height = h;
    this.r.setPixelRatio(this.maxPR * this.scale);
    this.r.setSize(w, h, false);
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  /** Feed the real frame time (ms). Lowers/raises resolution to hold a smooth frame rate. */
  adapt(frameMs, camera) {
    if (!this.dynamic) return;
    if (frameMs > 250) return; // tab was hidden / paused
    this.ema += (frameMs - this.ema) * 0.08;
    this.evalTimer += frameMs;
    this.cooldown -= frameMs;
    if (this.evalTimer < 1000 || this.cooldown > 0) return;
    this.evalTimer = 0;
    let next = this.scale;
    if (this.ema > 24) next = Math.max(this.minScale, this.scale - 0.1);
    else if (this.ema > 19.5) next = Math.max(this.minScale, this.scale - 0.05);
    else if (this.ema < 15.5 && this.scale < 1) next = Math.min(1, this.scale + 0.05);
    if (Math.abs(next - this.scale) > 0.001) {
      this.scale = next;
      this.cooldown = 1500;
      this.resize(camera);
    }
  }
}
