/**
 * Procedural audio.
 *
 * Every sound in the game is synthesised at runtime from noise and oscillators
 * - there is not a single audio file in the build. That keeps the download
 * tiny, makes every sound original work, and lets the game pitch and pan a cue
 * per event instead of replaying the same clip.
 *
 * The context is created lazily on the first user gesture, which is what mobile
 * browsers require, and everything is routed through master -> sfx gains so
 * Settings can duck it without touching the graph.
 */

type LoopHandle = { stop: () => void; setGain: (v: number) => void };

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private loops = new Map<string, LoopHandle>();

  masterVolume = 0.9;
  sfxVolume = 1;
  private muted = false;

  /** Must be called from inside a user gesture handler. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.masterVolume;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVolume;
    this.sfx.connect(this.master);
    this.noiseBuffer = makeNoise(ctx, 2);
    void ctx.resume();
  }

  setVolumes(master: number, sfx: number): void {
    this.masterVolume = master;
    this.sfxVolume = sfx;
    if (this.master) this.master.gain.value = this.muted ? 0 : master;
    if (this.sfx) this.sfx.gain.value = sfx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.masterVolume;
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  /* ------------------------------------------------------------ primitives */

  private tone(
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; gain?: number; pan?: number; sweepTo?: number; delay?: number } = {},
  ): void {
    const ctx = this.ctx;
    const dest = this.sfx;
    if (!ctx || !dest) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.sweepTo), t0 + duration);
    const gain = ctx.createGain();
    const peak = opts.gain ?? 0.2;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp(opts.pan ?? 0, -1, 1);
    osc.connect(gain).connect(pan).connect(dest);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private noise(
    duration: number,
    opts: { gain?: number; pan?: number; type?: BiquadFilterType; freq?: number; q?: number; delay?: number } = {},
  ): void {
    const ctx = this.ctx;
    const dest = this.sfx;
    if (!ctx || !dest || !this.noiseBuffer) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.frequency.value = opts.freq ?? 800;
    filter.Q.value = opts.q ?? 1;
    const gain = ctx.createGain();
    const peak = opts.gain ?? 0.2;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp(opts.pan ?? 0, -1, 1);
    src.connect(filter).connect(gain).connect(pan).connect(dest);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  /* ----------------------------------------------------------------- cues */

  /** Distant footstep. `pan` places it left/right, `distance` dulls it. */
  footstep(pan: number, distance: number): void {
    const near = clamp(1 - distance / 22, 0.08, 1);
    this.noise(0.16, { gain: 0.16 * near, pan, type: 'lowpass', freq: 220 + 500 * near, q: 0.8 });
    this.tone(58, 0.14, { gain: 0.1 * near, pan, type: 'sine', sweepTo: 40 });
  }

  doorSlam(pan: number): void {
    this.noise(0.35, { gain: 0.5, pan, type: 'lowpass', freq: 700, q: 0.6 });
    this.tone(88, 0.34, { gain: 0.34, pan, type: 'square', sweepTo: 42 });
    this.tone(180, 0.12, { gain: 0.12, pan, type: 'triangle', sweepTo: 90, delay: 0.02 });
  }

  doorImpact(pan: number): void {
    for (let i = 0; i < 3; i++) {
      this.noise(0.14, { gain: 0.45, pan, type: 'bandpass', freq: 260, q: 1.4, delay: i * 0.13 });
      this.tone(70, 0.16, { gain: 0.3, pan, type: 'square', sweepTo: 45, delay: i * 0.13 });
    }
  }

  lightSwitch(pan: number): void {
    this.noise(0.05, { gain: 0.3, pan, type: 'highpass', freq: 2600 });
    this.tone(1400, 0.04, { gain: 0.06, pan, type: 'square' });
  }

  cameraFlip(): void {
    this.noise(0.22, { gain: 0.3, type: 'bandpass', freq: 1500, q: 0.7 });
    this.tone(320, 0.16, { gain: 0.09, type: 'sawtooth', sweepTo: 620 });
  }

  cameraSwitch(): void {
    this.noise(0.13, { gain: 0.26, type: 'highpass', freq: 2200 });
  }

  kitchenClatter(pan: number): void {
    for (let i = 0; i < 5; i++) {
      this.tone(420 + Math.random() * 900, 0.09, {
        gain: 0.09,
        pan,
        type: 'triangle',
        delay: i * (0.05 + Math.random() * 0.09),
      });
    }
    this.noise(0.3, { gain: 0.08, pan, type: 'highpass', freq: 3000, delay: 0.05 });
  }

  curtainRustle(pan: number): void {
    this.noise(0.5, { gain: 0.14, pan, type: 'bandpass', freq: 1800, q: 0.5 });
  }

  running(pan: number): void {
    for (let i = 0; i < 9; i++) {
      this.noise(0.09, { gain: 0.24, pan: pan * (1 - i / 12), type: 'lowpass', freq: 900, delay: i * 0.11 });
    }
    this.tone(240, 0.9, { gain: 0.07, pan, type: 'sawtooth', sweepTo: 120 });
  }

  laugh(pan: number, distance: number): void {
    const near = clamp(1 - distance / 22, 0.1, 1);
    const base = 150;
    for (let i = 0; i < 6; i++) {
      this.tone(base + i * 6, 0.12, {
        gain: 0.11 * near,
        pan,
        type: 'sawtooth',
        sweepTo: base - 20,
        delay: i * 0.14,
      });
    }
  }

  breath(pan: number): void {
    this.noise(0.9, { gain: 0.1, pan, type: 'bandpass', freq: 520, q: 0.4 });
  }

  knock(pan: number): void {
    this.tone(120, 0.1, { gain: 0.24, pan, type: 'square', sweepTo: 70 });
    this.noise(0.08, { gain: 0.2, pan, type: 'lowpass', freq: 500 });
  }

  hourChime(): void {
    for (const [i, f] of [392, 466, 587].entries()) {
      this.tone(f, 1.1, { gain: 0.09, type: 'sine', delay: i * 0.14 });
    }
  }

  win(): void {
    for (const [i, f] of [523, 659, 784, 1047].entries()) {
      this.tone(f, 0.7, { gain: 0.12, type: 'triangle', delay: i * 0.16 });
    }
  }

  /** The one moment the game is allowed to be loud. */
  jumpscare(): void {
    this.noise(1.1, { gain: 0.85, type: 'bandpass', freq: 1400, q: 0.25 });
    this.noise(1.1, { gain: 0.6, type: 'highpass', freq: 3200 });
    this.tone(90, 1.0, { gain: 0.5, type: 'sawtooth', sweepTo: 1800 });
    this.tone(1600, 0.8, { gain: 0.28, type: 'square', sweepTo: 180 });
  }

  crankTurn(): void {
    this.noise(0.11, { gain: 0.2, type: 'bandpass', freq: 900, q: 2.5 });
    this.tone(190, 0.1, { gain: 0.09, type: 'square', sweepTo: 150 });
  }

  /* ---------------------------------------------------------------- loops */

  /** Room tone: mains hum, a distant compressor, and the desk fan. */
  startAmbience(): void {
    const ctx = this.ctx;
    const dest = this.sfx;
    if (!ctx || !dest || !this.noiseBuffer || this.loops.has('ambience')) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;

    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 60;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 180;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.022;

    // Slow tremolo on the fan so the room never sits perfectly still.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain).connect(gain.gain);

    src.connect(lp).connect(gain).connect(dest);
    hum.connect(humFilter).connect(humGain).connect(dest);
    src.start();
    hum.start();
    lfo.start();

    this.loops.set('ambience', {
      stop: () => {
        src.stop();
        hum.stop();
        lfo.stop();
      },
      setGain: (v) => {
        gain.gain.value = 0.05 * v;
        humGain.gain.value = 0.022 * v;
      },
    });
  }

  /**
   * The music box. An original eight-note figure in a minor key, played on a
   * detuned triangle with a long decay, looping until the lights come back.
   */
  startMusicBox(): void {
    const ctx = this.ctx;
    const dest = this.sfx;
    if (!ctx || !dest || this.loops.has('musicbox')) return;
    const notes = [659, 587, 494, 587, 659, 784, 659, 494];
    let step = 0;
    let stopped = false;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    gain.connect(dest);

    const timer = window.setInterval(() => {
      if (stopped || !this.ctx) return;
      const f = notes[step % notes.length];
      step++;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f * (step % 16 === 0 ? 0.5 : 1);
      osc.detune.value = -12 + Math.random() * 24;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      osc.connect(env).connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 1);
    }, 430);

    this.loops.set('musicbox', {
      stop: () => {
        stopped = true;
        clearInterval(timer);
        gain.disconnect();
      },
      setGain: (v) => (gain.gain.value = v),
    });
  }

  stopLoop(name: 'ambience' | 'musicbox'): void {
    const loop = this.loops.get(name);
    if (!loop) return;
    loop.stop();
    this.loops.delete(name);
  }

  stopAll(): void {
    for (const [, loop] of this.loops) loop.stop();
    this.loops.clear();
  }
}

function makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
