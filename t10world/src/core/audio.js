// T10 World - procedural audio engine. No sample files: everything is synthesized,
// so the whole game stays a self-contained download.
import { settings } from './settings.js';
import { clamp01, clampv, lerpv } from './math.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.buses = {};
    this.loops = {};
    this.noiseBuffer = null;
    this.impulse = null;
    this.lastFootstep = 0;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = settings.get('masterVolume');
    // Gentle limiter so synth stacks never clip on a phone speaker.
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.18;
    this.master.connect(this.limiter).connect(ctx.destination);

    for (const name of ['sfx', 'ambient', 'music', 'vehicle']) {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(this.master);
      this.buses[name] = g;
    }

    // Reverb for interiors / tunnels.
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.makeImpulse(1.9, 2.4);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.0;
    this.reverbSend.connect(this.convolver).connect(this.master);

    this.noiseBuffer = this.makeNoise(3);
    this.ready = true;
    this.applyVolumes();
    this.startAmbience();
  }

  applyVolumes() {
    if (!this.ready) return;
    this.master.gain.value = settings.get('masterVolume');
    this.buses.sfx.gain.value = settings.get('sfxVolume');
    this.buses.vehicle.gain.value = settings.get('sfxVolume') * 0.9;
    this.buses.ambient.gain.value = settings.get('sfxVolume') * 0.75;
    this.buses.music.gain.value = settings.get('musicVolume');
  }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  /** One-shot filtered noise burst — the workhorse for impacts, steps, wind. */
  noiseBurst(opts) {
    if (!this.ready) return;
    const o = Object.assign({ dur: 0.12, gain: 0.3, freq: 1200, q: 1.0, type: 'bandpass', bus: 'sfx', sweep: 0, pan: 0 }, opts);
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filt = ctx.createBiquadFilter();
    filt.type = o.type;
    filt.frequency.setValueAtTime(o.freq, t);
    if (o.sweep) filt.frequency.exponentialRampToValueAtTime(Math.max(40, o.freq * o.sweep), t + o.dur);
    filt.Q.value = o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain, t + Math.min(0.012, o.dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = clampv(o.pan, -1, 1);
    src.connect(filt).connect(g);
    if (pan) g.connect(pan).connect(this.buses[o.bus] || this.buses.sfx);
    else g.connect(this.buses[o.bus] || this.buses.sfx);
    src.start(t);
    src.stop(t + o.dur + 0.05);
  }

  tone(opts) {
    if (!this.ready) return;
    const o = Object.assign({ freq: 440, dur: 0.15, gain: 0.2, type: 'sine', bus: 'sfx', slide: 0, pan: 0, detune: 0 }, opts);
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, t);
    osc.detune.value = o.detune;
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq * o.slide), t + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.connect(g);
    if (pan) { pan.pan.value = clampv(o.pan, -1, 1); g.connect(pan).connect(this.buses[o.bus] || this.buses.sfx); }
    else g.connect(this.buses[o.bus] || this.buses.sfx);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  // ---- Specific game sounds -------------------------------------------------

  footstep(surface, speed, pan) {
    if (!this.ready) return;
    const t = this.now();
    if (t - this.lastFootstep < 0.07) return;
    this.lastFootstep = t;
    const vol = clamp01(0.1 + speed * 0.06) * 0.7;
    const table = {
      concrete: { freq: 1500, q: 1.1, dur: 0.1, sweep: 0.4 },
      asphalt:  { freq: 1250, q: 0.9, dur: 0.11, sweep: 0.4 },
      grass:    { freq: 2600, q: 0.6, dur: 0.16, sweep: 0.3 },
      sand:     { freq: 3200, q: 0.4, dur: 0.2, sweep: 0.25 },
      wood:     { freq: 700, q: 2.4, dur: 0.13, sweep: 0.5 },
      metal:    { freq: 2000, q: 5.0, dur: 0.22, sweep: 0.7 },
      water:    { freq: 1800, q: 0.5, dur: 0.26, sweep: 0.2 },
      dirt:     { freq: 1000, q: 0.7, dur: 0.14, sweep: 0.35 },
    };
    const s = table[surface] || table.concrete;
    this.noiseBurst({ dur: s.dur, gain: vol, freq: s.freq * (0.9 + Math.random() * 0.2), q: s.q, sweep: s.sweep, pan: pan || 0 });
    if (surface === 'wood' || surface === 'metal') this.tone({ freq: 90 + Math.random() * 30, dur: 0.09, gain: vol * 0.4, type: 'sine' });
  }

  jump() { this.noiseBurst({ dur: 0.18, gain: 0.16, freq: 420, q: 0.8, sweep: 1.6 }); }
  land(force) {
    const v = clamp01(force / 12);
    this.noiseBurst({ dur: 0.17, gain: 0.12 + v * 0.3, freq: 300, q: 1.2, sweep: 0.3 });
    this.tone({ freq: 62, dur: 0.14, gain: 0.1 + v * 0.2, type: 'sine', slide: 0.6 });
  }
  doorOpen() { this.noiseBurst({ dur: 0.5, gain: 0.12, freq: 340, q: 3.5, sweep: 1.7, type: 'bandpass' }); }
  doorClose() { this.noiseBurst({ dur: 0.2, gain: 0.2, freq: 220, q: 2.0, sweep: 0.4 }); this.tone({ freq: 70, dur: 0.12, gain: 0.12, type: 'sine' }); }
  carDoor(open) {
    this.noiseBurst({ dur: open ? 0.35 : 0.16, gain: 0.18, freq: open ? 500 : 260, q: 2.2, sweep: open ? 1.4 : 0.35 });
    if (!open) this.tone({ freq: 110, dur: 0.1, gain: 0.16, type: 'square', slide: 0.5 });
  }
  horn(kind) {
    const base = kind === 'truck' ? 165 : kind === 'bus' ? 210 : 340;
    this.tone({ freq: base, dur: 0.5, gain: 0.16, type: 'sawtooth', bus: 'vehicle' });
    this.tone({ freq: base * 1.26, dur: 0.5, gain: 0.12, type: 'square', bus: 'vehicle' });
  }
  siren(kind) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    const lfo = ctx.createOscillator(); lfo.type = kind === 'fire' ? 'sine' : 'triangle';
    lfo.frequency.value = kind === 'police' ? 3.2 : 0.7;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = kind === 'police' ? 260 : 420;
    osc.frequency.value = kind === 'police' ? 760 : 620;
    lfo.connect(lfoGain).connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.1);
    g.gain.setValueAtTime(0.09, t + 2.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    osc.connect(lp).connect(g).connect(this.buses.vehicle);
    osc.start(t); lfo.start(t);
    osc.stop(t + 3.1); lfo.stop(t + 3.1);
  }
  ui(kind) {
    if (kind === 'open') { this.tone({ freq: 520, dur: 0.1, gain: 0.1, type: 'sine' }); this.tone({ freq: 780, dur: 0.14, gain: 0.07, type: 'sine' }); }
    else if (kind === 'close') { this.tone({ freq: 400, dur: 0.1, gain: 0.08, type: 'sine', slide: 0.7 }); }
    else if (kind === 'confirm') { this.tone({ freq: 660, dur: 0.08, gain: 0.09, type: 'triangle' }); setTimeout(() => this.tone({ freq: 990, dur: 0.12, gain: 0.08, type: 'triangle' }), 70); }
    else if (kind === 'deny') { this.tone({ freq: 190, dur: 0.16, gain: 0.1, type: 'square', slide: 0.75 }); }
    else this.tone({ freq: 620, dur: 0.05, gain: 0.05, type: 'sine' });
  }
  /** The T10 assistant's signature blip — plays under every reply. */
  t10Blip(kind) {
    if (!this.ready) return;
    if (kind === 'open') {
      this.tone({ freq: 300, dur: 0.1, gain: 0.08, type: 'square' });
      setTimeout(() => this.tone({ freq: 600, dur: 0.09, gain: 0.07, type: 'square' }), 60);
      setTimeout(() => this.tone({ freq: 900, dur: 0.16, gain: 0.05, type: 'sine' }), 120);
    } else if (kind === 'close') {
      this.tone({ freq: 700, dur: 0.1, gain: 0.06, type: 'square', slide: 0.4 });
    } else if (kind === 'error') {
      this.tone({ freq: 240, dur: 0.1, gain: 0.08, type: 'square' });
      setTimeout(() => this.tone({ freq: 180, dur: 0.16, gain: 0.08, type: 'square' }), 90);
    } else {
      this.tone({ freq: 880, dur: 0.05, gain: 0.05, type: 'square' });
      setTimeout(() => this.tone({ freq: 1320, dur: 0.06, gain: 0.035, type: 'square' }), 45);
    }
  }
  /** A shot. Heavier guns get more low end and a longer tail. */
  gunshot(opts) {
    opts = opts || {};
    const heft = clamp01(opts.heft == null ? 0.5 : opts.heft);
    if (opts.quiet) {
      this.noiseBurst({ dur: 0.10 + heft * 0.06, gain: 0.10 + heft * 0.06, freq: 900 - heft * 380, q: 1.1, sweep: 0.35, type: 'bandpass' });
      this.tone({ freq: 160 - heft * 60, dur: 0.07, gain: 0.05, type: 'sine' });
      return;
    }
    this.noiseBurst({ dur: 0.12 + heft * 0.22, gain: 0.26 + heft * 0.22, freq: 2600 - heft * 1500, q: 0.6, sweep: 0.18 });
    this.tone({ freq: 120 - heft * 62, dur: 0.14 + heft * 0.20, gain: 0.20 + heft * 0.20, type: 'sine', sweep: 0.4 });
    // Slap-back off the buildings.
    if (heft > 0.35) setTimeout(() => this.noiseBurst({ dur: 0.30, gain: 0.05 + heft * 0.06, freq: 700, q: 1.6, sweep: 0.3, type: 'bandpass' }), 70 + heft * 60);
  }

  dryFire() { this.noiseBurst({ dur: 0.05, gain: 0.08, freq: 2400, q: 2.2, sweep: 0.5 }); }

  reloadClick(stage) {
    if (stage === 'out') this.noiseBurst({ dur: 0.08, gain: 0.10, freq: 1400, q: 2.0, sweep: 0.6 });
    else this.noiseBurst({ dur: 0.10, gain: 0.13, freq: 900, q: 1.6, sweep: 0.5 });
  }

  bulletImpact(surface) {
    const hard = surface === 'asphalt' || surface === 'concrete' || surface === 'sidewalk';
    this.noiseBurst({ dur: 0.09, gain: 0.13, freq: hard ? 3200 : 1500, q: 1.4, sweep: 0.3 });
  }

  explosion(size) {
    const k = clamp01((size || 5) / 10);
    this.noiseBurst({ dur: 0.7 + k * 0.7, gain: 0.32 + k * 0.2, freq: 900 - k * 500, q: 0.5, sweep: 0.12 });
    this.tone({ freq: 62 - k * 24, dur: 0.8 + k * 0.5, gain: 0.30 + k * 0.2, type: 'sine', sweep: 0.3 });
  }

  cash() {
    for (let i = 0; i < 3; i++) setTimeout(() => this.tone({ freq: 1200 + i * 320, dur: 0.11, gain: 0.07, type: 'triangle' }), i * 55);
  }
  spawnPop() {
    this.noiseBurst({ dur: 0.22, gain: 0.14, freq: 900, q: 0.8, sweep: 2.4 });
    this.tone({ freq: 160, dur: 0.18, gain: 0.1, type: 'sine', slide: 2.2 });
  }
  thunder(distance) {
    const d = clamp01(distance / 400);
    setTimeout(() => {
      this.noiseBurst({ dur: 1.4 + d * 2.2, gain: 0.28 * (1 - d * 0.7), freq: 90 + (1 - d) * 200, q: 0.5, sweep: 0.3, bus: 'ambient' });
    }, d * 1400);
  }
  animal(kind) {
    const t = {
      dog: () => { this.noiseBurst({ dur: 0.14, gain: 0.16, freq: 700, q: 3, sweep: 0.35 }); this.tone({ freq: 240, dur: 0.12, gain: 0.1, type: 'sawtooth', slide: 0.6 }); },
      cat: () => { this.tone({ freq: 620, dur: 0.4, gain: 0.08, type: 'sawtooth', slide: 0.7 }); },
      bird: () => { for (let i = 0; i < 3; i++) setTimeout(() => this.tone({ freq: 2400 + Math.random() * 1400, dur: 0.06, gain: 0.05, type: 'sine', slide: 1.4 }), i * 80); },
      seagull: () => { this.tone({ freq: 1400, dur: 0.3, gain: 0.07, type: 'sawtooth', slide: 0.6 }); },
      cow: () => { this.tone({ freq: 150, dur: 0.9, gain: 0.11, type: 'sawtooth', slide: 0.8 }); },
      horse: () => { this.noiseBurst({ dur: 0.5, gain: 0.12, freq: 500, q: 1.6, sweep: 0.5 }); },
      deer: () => { this.noiseBurst({ dur: 0.2, gain: 0.07, freq: 900, q: 2, sweep: 0.6 }); },
    };
    (t[kind] || t.bird)();
  }

  /**
   * Creature voices. Every species names one of these; `pitch` shifts it so a
   * brute and a crawler saying "growl" don't sound like the same animal.
   */
  creature(kind, pitch, pan) {
    const k = pitch || 1;
    const p = pan || 0;
    const v = {
      growl: () => {
        this.tone({ freq: 70 * k, dur: 0.55, gain: 0.13, type: 'sawtooth', slide: 0.7, pan: p });
        this.noiseBurst({ dur: 0.5, gain: 0.09, freq: 260 * k, q: 2.2, sweep: 0.5, pan: p });
      },
      roar: () => {
        this.tone({ freq: 55 * k, dur: 1.1, gain: 0.20, type: 'sawtooth', slide: 0.55, pan: p });
        this.tone({ freq: 82 * k, dur: 0.95, gain: 0.12, type: 'square', slide: 0.6, pan: p });
        this.noiseBurst({ dur: 1.0, gain: 0.14, freq: 420 * k, q: 1.2, sweep: 0.35, pan: p });
      },
      screech: () => {
        this.tone({ freq: 1500 * k, dur: 0.7, gain: 0.11, type: 'sawtooth', slide: 0.45, pan: p });
        this.tone({ freq: 2100 * k, dur: 0.6, gain: 0.06, type: 'square', slide: 0.6, pan: p });
        this.noiseBurst({ dur: 0.55, gain: 0.08, freq: 3200 * k, q: 3.0, sweep: 0.4, pan: p });
      },
      hiss: () => { this.noiseBurst({ dur: 0.6, gain: 0.10, freq: 5200 * k, q: 1.4, sweep: 0.35, pan: p }); },
      chitter: () => {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => this.tone({ freq: (900 + Math.random() * 700) * k, dur: 0.045, gain: 0.05, type: 'square', pan: p }), i * 55);
        }
      },
      groan: () => {
        this.tone({ freq: 108 * k, dur: 1.2, gain: 0.10, type: 'sawtooth', slide: 0.75, pan: p });
        this.noiseBurst({ dur: 1.0, gain: 0.05, freq: 520 * k, q: 3.0, sweep: 0.6, pan: p });
      },
      chime: () => {
        this.tone({ freq: 880 * k, dur: 0.9, gain: 0.06, type: 'sine', slide: 1.35, pan: p });
        this.tone({ freq: 1320 * k, dur: 0.7, gain: 0.035, type: 'sine', slide: 1.5, pan: p });
      },
      rumble: () => {
        this.tone({ freq: 40 * k, dur: 1.4, gain: 0.18, type: 'sine', slide: 0.8, pan: p });
        this.noiseBurst({ dur: 1.2, gain: 0.08, freq: 150 * k, q: 0.8, sweep: 0.5, bus: 'ambient', pan: p });
      },
      /** A soft body-change sound with nothing wet about it. */
      shift: () => {
        this.noiseBurst({ dur: 0.75, gain: 0.07, freq: 380 * k, q: 2.6, sweep: 1.7, pan: p });
        this.tone({ freq: 190 * k, dur: 0.6, gain: 0.05, type: 'triangle', slide: 1.6, pan: p });
      },
    };
    (v[kind] || v.growl)();
  }

  /**
   * Power sounds. Eight textures, pitched per power, so no two of the sixteen
   * sound the same when they go off.
   */
  power(kind, pitch) {
    const k = pitch || 1;
    const v = {
      whoosh: () => {
        this.noiseBurst({ dur: 0.45, gain: 0.14, freq: 900 * k, q: 0.9, sweep: 3.2 });
        this.tone({ freq: 180 * k, dur: 0.35, gain: 0.08, type: 'sine', slide: 2.4 });
      },
      boom: () => {
        this.tone({ freq: 74 * k, dur: 0.6, gain: 0.22, type: 'sine', slide: 0.4 });
        this.noiseBurst({ dur: 0.5, gain: 0.18, freq: 640 * k, q: 0.7, sweep: 0.2 });
      },
      chime: () => {
        this.tone({ freq: 660 * k, dur: 0.8, gain: 0.09, type: 'sine', slide: 1.5 });
        this.tone({ freq: 990 * k, dur: 0.6, gain: 0.05, type: 'triangle', slide: 1.5 });
      },
      zap: () => {
        this.noiseBurst({ dur: 0.18, gain: 0.2, freq: 3800 * k, q: 1.6, sweep: 0.2 });
        this.tone({ freq: 1400 * k, dur: 0.14, gain: 0.1, type: 'square', slide: 0.25 });
      },
      hum: () => {
        this.tone({ freq: 120 * k, dur: 1.1, gain: 0.10, type: 'triangle', slide: 1.08 });
        this.tone({ freq: 181 * k, dur: 1.0, gain: 0.05, type: 'sine', slide: 1.12 });
      },
      crackle: () => {
        for (let i = 0; i < 6; i++) {
          setTimeout(() => this.noiseBurst({ dur: 0.05, gain: 0.09, freq: (2200 + Math.random() * 2600) * k, q: 3, sweep: 0.5 }), i * 32);
        }
      },
      warp: () => {
        this.tone({ freq: 520 * k, dur: 0.32, gain: 0.12, type: 'sawtooth', slide: 0.22 });
        this.tone({ freq: 210 * k, dur: 0.4, gain: 0.08, type: 'sine', slide: 3.4 });
      },
      pop: () => {
        this.noiseBurst({ dur: 0.14, gain: 0.13, freq: 1500 * k, q: 1.2, sweep: 2.2 });
        this.tone({ freq: 300 * k, dur: 0.12, gain: 0.09, type: 'triangle', slide: 2.0 });
      },
    };
    (v[kind] || v.whoosh)();
  }

  // ---- Continuous loops -----------------------------------------------------

  startAmbience() {
    if (!this.ready || this.loops.wind) return;
    const ctx = this.ctx;

    // Wind: filtered noise with a slowly drifting cutoff.
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer; windSrc.loop = true;
    const windFilt = ctx.createBiquadFilter(); windFilt.type = 'lowpass'; windFilt.frequency.value = 420; windFilt.Q.value = 0.6;
    const windGain = ctx.createGain(); windGain.gain.value = 0.02;
    windSrc.connect(windFilt).connect(windGain).connect(this.buses.ambient);
    windSrc.start();
    this.loops.wind = { src: windSrc, filt: windFilt, gain: windGain };

    // Rain: brighter noise, gain driven by the weather system.
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = this.noiseBuffer; rainSrc.loop = true;
    const rainHp = ctx.createBiquadFilter(); rainHp.type = 'highpass'; rainHp.frequency.value = 900;
    const rainLp = ctx.createBiquadFilter(); rainLp.type = 'lowpass'; rainLp.frequency.value = 7000;
    const rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rainSrc.connect(rainHp).connect(rainLp).connect(rainGain).connect(this.buses.ambient);
    rainSrc.start();
    this.loops.rain = { src: rainSrc, gain: rainGain, lp: rainLp };

    // City hum: low rumble of distant traffic, louder downtown.
    const cityOsc = ctx.createBufferSource();
    cityOsc.buffer = this.noiseBuffer; cityOsc.loop = true;
    const cityFilt = ctx.createBiquadFilter(); cityFilt.type = 'lowpass'; cityFilt.frequency.value = 160; cityFilt.Q.value = 1.2;
    const cityGain = ctx.createGain(); cityGain.gain.value = 0;
    cityOsc.connect(cityFilt).connect(cityGain).connect(this.buses.ambient);
    cityOsc.start();
    this.loops.city = { src: cityOsc, gain: cityGain, filt: cityFilt };

    // Ocean: slower, deeper surf near the beach.
    const seaSrc = ctx.createBufferSource();
    seaSrc.buffer = this.noiseBuffer; seaSrc.loop = true; seaSrc.playbackRate.value = 0.35;
    const seaFilt = ctx.createBiquadFilter(); seaFilt.type = 'lowpass'; seaFilt.frequency.value = 900;
    const seaGain = ctx.createGain(); seaGain.gain.value = 0;
    seaSrc.connect(seaFilt).connect(seaGain).connect(this.buses.ambient);
    seaSrc.start();
    this.loops.sea = { src: seaSrc, gain: seaGain };

    // Night crickets.
    const cricketSrc = ctx.createBufferSource();
    cricketSrc.buffer = this.noiseBuffer; cricketSrc.loop = true;
    const cricketFilt = ctx.createBiquadFilter(); cricketFilt.type = 'bandpass'; cricketFilt.frequency.value = 4800; cricketFilt.Q.value = 14;
    const cricketGain = ctx.createGain(); cricketGain.gain.value = 0;
    cricketSrc.connect(cricketFilt).connect(cricketGain).connect(this.buses.ambient);
    cricketSrc.start();
    this.loops.crickets = { src: cricketSrc, gain: cricketGain };
  }

  /** Called every frame by the world so ambience tracks weather, time and place. */
  updateAmbience(state, dt) {
    if (!this.ready) return;
    const set = (loop, target, speed) => {
      if (!loop) return;
      loop.gain.gain.value = lerpv(loop.gain.gain.value, target, clamp01(dt * (speed || 1.5)));
    };
    set(this.loops.wind, 0.01 + state.wind * 0.07, 0.8);
    if (this.loops.wind) this.loops.wind.filt.frequency.value = lerpv(this.loops.wind.filt.frequency.value, 300 + state.wind * 900, clamp01(dt * 0.6));
    set(this.loops.rain, state.rain * 0.16, 1.2);
    if (this.loops.rain) this.loops.rain.lp.frequency.value = state.indoors ? 2200 : 7000;
    set(this.loops.city, state.urban * 0.08, 0.5);
    set(this.loops.sea, state.coastal * 0.1, 0.5);
    set(this.loops.crickets, state.night * state.nature * 0.05 * (1 - state.rain), 0.5);
    if (this.reverbSend) this.reverbSend.gain.value = lerpv(this.reverbSend.gain.value, state.indoors ? 0.22 : 0.02, clamp01(dt * 2));
  }

  /** Engine sound: additive oscillators tracking RPM. One per active vehicle near the player. */
  createEngine() {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const nodes = { oscs: [], gains: [] };
    const out = ctx.createGain(); out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    out.connect(lp);
    if (pan) lp.connect(pan).connect(this.buses.vehicle); else lp.connect(this.buses.vehicle);
    const harmonics = [1, 2, 3, 4.5, 6];
    for (let i = 0; i < harmonics.length; i++) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sawtooth' : i < 3 ? 'square' : 'triangle';
      o.frequency.value = 60 * harmonics[i];
      const g = ctx.createGain();
      g.gain.value = 0.5 / (i + 1.4);
      o.connect(g).connect(out);
      o.start();
      nodes.oscs.push(o); nodes.gains.push(g);
    }
    // Intake / exhaust noise layer.
    const nsrc = ctx.createBufferSource(); nsrc.buffer = this.noiseBuffer; nsrc.loop = true;
    const nfilt = ctx.createBiquadFilter(); nfilt.type = 'bandpass'; nfilt.frequency.value = 340; nfilt.Q.value = 1.4;
    const ngain = ctx.createGain(); ngain.gain.value = 0.25;
    nsrc.connect(nfilt).connect(ngain).connect(out);
    nsrc.start();
    nodes.noise = { src: nsrc, filt: nfilt, gain: ngain };
    nodes.out = out; nodes.lp = lp; nodes.pan = pan; nodes.harmonics = harmonics;
    return nodes;
  }

  updateEngine(nodes, rpm, load, volume, panValue) {
    if (!nodes || !this.ready) return;
    const base = 22 + rpm * 0.031;
    for (let i = 0; i < nodes.oscs.length; i++) {
      nodes.oscs[i].frequency.setTargetAtTime(base * nodes.harmonics[i], this.ctx.currentTime, 0.04);
    }
    nodes.noise.filt.frequency.setTargetAtTime(240 + rpm * 0.14, this.ctx.currentTime, 0.06);
    nodes.noise.gain.gain.setTargetAtTime(0.12 + load * 0.35, this.ctx.currentTime, 0.08);
    nodes.lp.frequency.setTargetAtTime(700 + rpm * 0.5 + load * 1200, this.ctx.currentTime, 0.06);
    nodes.out.gain.setTargetAtTime(volume * 0.13, this.ctx.currentTime, 0.07);
    if (nodes.pan) nodes.pan.pan.setTargetAtTime(clampv(panValue || 0, -1, 1), this.ctx.currentTime, 0.1);
  }

  disposeEngine(nodes) {
    if (!nodes) return;
    try {
      for (const o of nodes.oscs) o.stop();
      nodes.noise.src.stop();
      nodes.out.disconnect();
    } catch (e) { /* already stopped */ }
  }

  setMuted(m) { if (this.master) this.master.gain.value = m ? 0 : settings.get('masterVolume'); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}

export const audio = new AudioEngine();
