// T10 World - the performance monitor. Everything the frame governor and the
// stats readout need, sampled once a frame and summarised without allocating.
//
// This is the thing that decides the game is in trouble; the governor is what
// does something about it.
export class PerfMonitor {
  constructor() {
    this.frames = new Float32Array(120);   // frame times, ms
    this.head = 0;
    this.count = 0;
    this.frame = 0;

    this.fps = 60;
    this.frameMs = 16.7;
    this.p95Ms = 16.7;
    this.worstMs = 16.7;

    this.draws = 0;
    this.tris = 0;
    this.programs = 0;
    this.geometries = 0;
    this.textures = 0;

    this.npcs = 0;
    this.backgroundNpcs = 0;
    this.vehicles = 0;
    this.animals = 0;
    this.chunks = 0;
    this.streaming = 0;      // chunks queued but not yet built
    this.gibs = 0;
    this.decals = 0;

    this.heapMB = 0;
    this.heapLimitMB = 0;
    this.heapPressure = 0;   // 0..1 of the limit

    // A long-run sample, so "it got hot and started dropping frames" is
    // visible rather than just the last second and a half.
    this.stutters = 0;       // frames over 2x the target
    this.sampled = 0;
    this._sorted = new Float32Array(120);
    this._heapAt = 0;
  }

  /** Call once per frame with the real elapsed time, before anything trims. */
  sample(dtSeconds, game) {
    const ms = dtSeconds * 1000;
    this.frames[this.head] = ms;
    this.head = (this.head + 1) % this.frames.length;
    if (this.count < this.frames.length) this.count++;
    this.frame++;
    this.sampled++;
    if (ms > 33.4) this.stutters++;

    // Summarise a few times a second, not every frame.
    if ((this.frame & 15) !== 0) return this;

    let sum = 0, worst = 0;
    for (let i = 0; i < this.count; i++) {
      const v = this.frames[i];
      sum += v;
      if (v > worst) worst = v;
      this._sorted[i] = v;
    }
    const mean = sum / Math.max(1, this.count);
    this.frameMs = mean;
    this.fps = 1000 / Math.max(0.001, mean);
    this.worstMs = worst;
    // 95th percentile: the number that actually tells you whether it stutters.
    const slice = this._sorted.subarray(0, this.count);
    Array.prototype.sort.call(slice, (a, b) => a - b);
    this.p95Ms = slice[Math.min(this.count - 1, Math.floor(this.count * 0.95))] || mean;

    if (!game) return this;

    const r = game.renderer;
    if (r) {
      const info = game.lastRenderInfo || r.info.render;
      this.draws = info.calls;
      this.tris = info.triangles;
      this.programs = r.info.programs ? r.info.programs.length : 0;
      this.geometries = r.info.memory.geometries;
      this.textures = r.info.memory.textures;
    }
    if (game.npcs) {
      this.npcs = game.npcs.npcs.length;
      this.backgroundNpcs = game.npcs.background ? game.npcs.background.length : 0;
    }
    if (game.traffic) this.vehicles = game.traffic.vehicles.length;
    if (game.animals && game.animals.count) this.animals = game.animals.count();
    if (game.world) {
      this.chunks = game.world.chunks.size;
      this.streaming = game.world.buildQueue.length;
    }
    if (game.gore) { this.gibs = game.gore.gibs.length; this.decals = game.gore.decals.length; }

    // Heap, where the browser will tell us. Chrome only, and only every second
    // — reading it is not free.
    const now = performance.now();
    if (performance.memory && now - this._heapAt > 1000) {
      this._heapAt = now;
      this.heapMB = performance.memory.usedJSHeapSize / 1048576;
      this.heapLimitMB = performance.memory.jsHeapSizeLimit / 1048576;
      this.heapPressure = this.heapLimitMB ? this.heapMB / this.heapLimitMB : 0;
    }
    return this;
  }

  /** True when the device is struggling badly enough to act on. */
  get overloaded() { return this.p95Ms > 26 || this.heapPressure > 0.82; }

  /** One line for the stats readout. */
  summary(quality, load, scale) {
    return Math.round(this.fps) + ' fps  ·  ' + this.frameMs.toFixed(1) + 'ms (p95 ' + this.p95Ms.toFixed(1) + ')\n' +
      quality + '  ·  load ' + load.toFixed(2) + '  ·  res ' + scale.toFixed(2) + '\n' +
      this.draws + ' draws  ·  ' + (this.tris / 1000).toFixed(0) + 'k tris  ·  ' +
      this.geometries + ' geo  ·  ' + this.textures + ' tex\n' +
      this.npcs + ' people (+' + this.backgroundNpcs + ' background)  ·  ' +
      this.vehicles + ' cars  ·  ' + this.animals + ' animals\n' +
      this.chunks + ' chunks' + (this.streaming ? ' (' + this.streaming + ' loading)' : '') +
      '  ·  ' + this.decals + ' decals  ·  ' + this.gibs + ' gibs' +
      (this.heapMB ? '\n' + this.heapMB.toFixed(0) + ' MB of ' + this.heapLimitMB.toFixed(0) +
        ' (' + Math.round(this.heapPressure * 100) + '%)' : '');
  }
}
