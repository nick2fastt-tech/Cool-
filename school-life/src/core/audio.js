// Audio: theme music (your MP3) + synthesized sound effects (bell, steps, doors, UI).
// Everything goes through Web Audio so volume fades work on iOS too.

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicEl = null;
    this.musicNode = null;
    this.musicWanted = false;
    this.noiseBuf = null;
    this.musicVolume = 0.55;
    this.sfxVolume = 0.9;
    this._hiddenPaused = false;
    document.addEventListener('visibilitychange', () => this.onVisibility());
  }

  get ready() {
    return !!this.ctx;
  }

  /** Must be called from a user gesture (tap/click/key). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) {
        this.ctx = null;
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.master);
      // white noise buffer reused by many effects
      const len = Math.floor(this.ctx.sampleRate * 1.0);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // iOS unlock: play a tiny silent buffer inside the gesture
      const s = this.ctx.createBufferSource();
      s.buffer = this.ctx.createBuffer(1, 1, 22050);
      s.connect(this.ctx.destination);
      s.start(0);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.musicEl && !this.musicNode) this.connectMusic();
  }

  loadMusic(url) {
    const el = new Audio();
    el.src = url;
    el.loop = true;
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    this.musicEl = el;
    if (this.ctx) this.connectMusic();
  }

  connectMusic() {
    if (!this.ctx || !this.musicEl || this.musicNode) return;
    try {
      this.musicNode = this.ctx.createMediaElementSource(this.musicEl);
      this.musicNode.connect(this.musicGain);
    } catch (e) {
      this.musicNode = null;
    }
  }

  playMusic(fade = 1.6) {
    this.musicWanted = true;
    if (!this.musicEl) return;
    if (this.ctx && this.musicNode) {
      const g = this.musicGain.gain;
      const t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(this.musicVolume, t + fade);
    } else {
      this.musicEl.volume = this.musicVolume;
    }
    const p = this.musicEl.play();
    if (p && p.catch) p.catch(() => {});
  }

  stopMusic(fade = 0.8) {
    this.musicWanted = false;
    if (!this.musicEl) return;
    if (this.ctx && this.musicNode) {
      const g = this.musicGain.gain;
      const t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + fade);
      clearTimeout(this._stopTimer);
      this._stopTimer = setTimeout(() => {
        if (!this.musicWanted && this.musicEl) this.musicEl.pause();
      }, fade * 1000 + 60);
    } else {
      this.musicEl.pause();
    }
  }

  onVisibility() {
    if (document.hidden) {
      if (this.musicEl && !this.musicEl.paused) {
        this.musicEl.pause();
        this._hiddenPaused = true;
      }
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    } else {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      if (this._hiddenPaused && this.musicWanted && this.musicEl) {
        const p = this.musicEl.play();
        if (p && p.catch) p.catch(() => {});
      }
      this._hiddenPaused = false;
    }
  }

  // ---------------------------------------------------------------- helpers
  _env(gainNode, t, attack, peak, decay, sustain = 0.0001) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + attack + decay);
  }

  _noise(t, dur, { type = 'lowpass', freq = 800, q = 1, peak = 0.3, attack = 0.005, rate = 1 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this._env(g, t, attack, peak, dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    const off = Math.random() * 0.5;
    src.start(t, off, dur + attack + 0.05);
    return { src, f, g };
  }

  _tone(t, freq, dur, { type = 'sine', peak = 0.2, attack = 0.005, endFreq = null } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain();
    this._env(g, t, attack, peak, dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return { o, g };
  }

  _ok() {
    return this.ctx && this.ctx.state === 'running';
  }

  // ---------------------------------------------------------------- effects
  click() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone(t, 620, 0.07, { peak: 0.22, endFreq: 310 });
    this._noise(t, 0.02, { type: 'highpass', freq: 3000, peak: 0.05 });
  }

  pop(pitch = 1) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone(t, 380 * pitch, 0.09, { peak: 0.12, endFreq: 760 * pitch, type: 'triangle' });
  }

  stamp() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone(t, 140, 0.18, { peak: 0.5, endFreq: 50 });
    this._noise(t, 0.12, { type: 'lowpass', freq: 1200, peak: 0.35 });
  }

  whoosh() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const n = this._noise(t, 0.55, { type: 'bandpass', freq: 400, q: 1.2, peak: 0.18, attack: 0.15 });
    n.f.frequency.setValueAtTime(300, t);
    n.f.frequency.exponentialRampToValueAtTime(2600, t + 0.5);
  }

  chime() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone(t, 880, 0.5, { peak: 0.09 });
    this._tone(t + 0.09, 1318.5, 0.6, { peak: 0.08 });
  }

  error() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone(t, 220, 0.09, { type: 'square', peak: 0.06 });
    this._tone(t + 0.12, 180, 0.12, { type: 'square', peak: 0.06 });
  }

  success() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._tone(t + i * 0.08, f, 0.35, { peak: 0.09, type: 'triangle' }));
  }

  lockClick() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.03, { type: 'bandpass', freq: 2500, q: 4, peak: 0.35 });
    this._noise(t + 0.06, 0.04, { type: 'bandpass', freq: 1800, q: 4, peak: 0.4 });
    this._tone(t + 0.06, 900, 0.05, { peak: 0.08, type: 'square' });
  }

  footstep(intensity = 1) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const f = 500 + Math.random() * 400;
    this._noise(t, 0.09, { type: 'lowpass', freq: f, q: 0.8, peak: 0.16 * intensity, attack: 0.004 });
    this._tone(t, 95 + Math.random() * 20, 0.06, { peak: 0.12 * intensity, endFreq: 55 });
  }

  doorOpen() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.04, { type: 'highpass', freq: 2500, peak: 0.25 }); // latch
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t + 0.05);
    o.frequency.linearRampToValueAtTime(220, t + 0.35);
    o.frequency.linearRampToValueAtTime(170, t + 0.6);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(bp).connect(g).connect(this.sfxGain);
    o.start(t + 0.05);
    o.stop(t + 0.7);
  }

  doorClose() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone(t, 85, 0.22, { peak: 0.45, endFreq: 45 });
    this._noise(t, 0.12, { type: 'lowpass', freq: 700, peak: 0.3 });
    this._noise(t + 0.03, 0.04, { type: 'highpass', freq: 2800, peak: 0.18 });
  }

  locked() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) this._noise(t + i * 0.07, 0.045, { type: 'bandpass', freq: 1700 + i * 200, q: 5, peak: 0.32 });
    this._tone(t, 160, 0.12, { peak: 0.15, endFreq: 90 });
  }

  sit() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.28, { type: 'bandpass', freq: 900, q: 0.7, peak: 0.12, attack: 0.06 });
    this._tone(t + 0.18, 120, 0.1, { peak: 0.12, endFreq: 70 });
  }

  slurp() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const n = this._noise(t, 0.5, { type: 'bandpass', freq: 600, q: 3, peak: 0.15, attack: 0.05 });
    n.f.frequency.setValueAtTime(500, t);
    n.f.frequency.linearRampToValueAtTime(1400, t + 0.45);
  }

  piano() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 880.0, 1046.5];
    notes.forEach((f, i) => {
      const at = t + i * 0.16;
      this._tone(at, f, 0.7, { type: 'triangle', peak: 0.12, attack: 0.004 });
      this._tone(at, f * 2, 0.35, { type: 'sine', peak: 0.03, attack: 0.004 });
    });
  }

  /** Classic electric school bell (clapper striking a gong ~21 times per second). */
  bell(duration = 3.0) {
    if (!this._ok()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const ring = ctx.createGain();
    ring.gain.value = 0.55;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.28, t + 0.03);
    out.gain.setValueAtTime(0.28, t + duration);
    out.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.9);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 400;
    ring.connect(hp).connect(out).connect(this.sfxGain);
    const base = 1046;
    const partials = [
      [1, 0.5],
      [2.03, 0.22],
      [2.76, 0.28],
      [4.1, 0.1],
      [5.4, 0.08],
    ];
    const oscs = [];
    for (const [r, a] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * r * (1 + (Math.random() - 0.5) * 0.002);
      const g = ctx.createGain();
      g.gain.value = a;
      o.connect(g).connect(ring);
      o.start(t);
      o.stop(t + duration + 1.0);
      oscs.push(o);
    }
    // clapper: inverted sawtooth amplitude modulation (sharp strike, decaying ring)
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.value = 21;
    const depth = ctx.createGain();
    depth.gain.value = -0.42;
    lfo.connect(depth).connect(ring.gain);
    lfo.start(t);
    lfo.stop(t + duration + 1.0);
    // metallic strike noise
    const n = this._noise(t, duration, { type: 'bandpass', freq: 4200, q: 2, peak: 0.03, attack: 0.01 });
    n.g.gain.setValueAtTime(0.03, t + duration * 0.9);
  }
}
