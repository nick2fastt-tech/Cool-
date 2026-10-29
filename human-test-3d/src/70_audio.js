// ============================================================================
// Procedural audio: all sounds synthesized at load time with Web Audio buffers.
// Buses: effects (with reverb send), ambience, ui -> master -> compressor.
// ============================================================================
class Biquad {
  constructor(type, f, q, sr) {
    const w = TAU * f / sr, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
    else { b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; } // bp
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  p(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}

class AudioEngine {
  constructor(game) {
    this.game = game; this.ctx = null; this.buffers = {}; this.unlocked = false; this.voices = 0;
    this.sr = 44100; this.ambience = {}; this.birdT = 3; this.cricketT = 2;
    this.rng = new RNG(4321);
  }
  init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.disabled = true; return; }
      this.ctx = new AC();
      this.sr = this.ctx.sampleRate;
      const c = this.ctx;
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -10; this.comp.ratio.value = 6; this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
      this.master = c.createGain(); this.master.connect(this.comp); this.comp.connect(c.destination);
      this.bus = { effects: c.createGain(), ambience: c.createGain(), ui: c.createGain() };
      for (const k in this.bus) this.bus[k].connect(this.master);
      this.reverb = c.createConvolver(); this.reverbGain = c.createGain(); this.reverbGain.gain.value = 0.3;
      this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.master);
      this.reverbSend = c.createGain(); this.reverbSend.connect(this.reverb);
      this.applyVolumes();
    } catch (e) { reportError(e, 'audio-init'); this.disabled = true; }
  }
  applyVolumes() {
    if (!this.ctx) return;
    const A = Settings.data.audio;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(A.muted ? 0 : A.master, t, 0.05);
    this.bus.effects.gain.setTargetAtTime(A.effects, t, 0.05);
    this.bus.ambience.gain.setTargetAtTime(A.ambience, t, 0.05);
    this.bus.ui.gain.setTargetAtTime(A.ui, t, 0.05);
  }
  unlock() {
    if (!this.ctx || this.unlocked) return;
    this.ctx.resume().then(() => {
      this.unlocked = true;
      const h = document.getElementById('ldHint'); if (h) h.textContent = 'AUDIO ENABLED';
      if (this.game.loaded) this.startAmbience(); else this.startLoadingDrone();
    }).catch(() => { });
  }
  // --- synthesis ------------------------------------------------------------------------
  buf(dur, ch = 1) { return { L: new Float32Array(Math.ceil(dur * this.sr)), R: ch > 1 ? new Float32Array(Math.ceil(dur * this.sr)) : null, ch }; }
  finish(name, b, norm = 0.9) {
    let peak = 0;
    for (const arr of [b.L, b.R]) if (arr) for (let i = 0; i < arr.length; i++) peak = Math.max(peak, Math.abs(arr[i]));
    const k = peak > 0 ? norm / peak : 1;
    const ab = this.ctx.createBuffer(b.ch, b.L.length, this.sr);
    const d0 = ab.getChannelData(0); for (let i = 0; i < b.L.length; i++) d0[i] = b.L[i] * k;
    if (b.ch > 1) { const d1 = ab.getChannelData(1); for (let i = 0; i < b.R.length; i++) d1[i] = b.R[i] * k; }
    this.buffers[name] = ab;
  }
  noise() { return this.rng.next() * 2 - 1; }
  synthGun(name, o) {
    const sr = this.sr, b = this.buf(o.dur), L = b.L;
    const hp = new Biquad('hp', o.crackHP, 0.7, sr), lp = new Biquad('lp', o.bodyLP, 0.7, sr), lp2 = new Biquad('lp', o.tailLP, 0.6, sr);
    let ph = 0;
    for (let i = 0; i < L.length; i++) {
      const t = i / sr;
      const n = this.noise();
      const crack = hp.p(n) * Math.exp(-t / o.crackT) * o.crackG;
      const body = lp.p(n) * Math.exp(-t / o.bodyT) * o.bodyG;
      const f = o.thumpF1 + (o.thumpF0 - o.thumpF1) * Math.exp(-t / 0.03);
      ph += TAU * f / sr;
      const thump = Math.sin(ph) * Math.exp(-t / o.thumpT) * o.thumpG;
      const tail = lp2.p(n) * Math.exp(-t / o.tailT) * o.tailG * (1 - Math.exp(-t / 0.01));
      let s = crack + body + thump + tail;
      if (o.echo) { const j = i - Math.floor(o.echo * sr); if (j > 0) s += L[j] * 0.0; }
      L[i] = Math.tanh(s * 1.6);
    }
    if (o.echo) { const off = Math.floor(o.echo * sr); const lpE = new Biquad('lp', 1200, 0.7, sr); for (let i = L.length - 1; i >= off; i--) L[i] += lpE.p(L[i - off]) * 0.28; }
    this.finish(name, b);
  }
  synthExplosion() {
    const sr = this.sr, b = this.buf(3.2, 2);
    for (const [arr, seed] of [[b.L, 1], [b.R, 2]]) {
      const lp = new Biquad('lp', 260, 0.8, sr), lp2 = new Biquad('lp', 1800, 0.7, sr), lp3 = new Biquad('lp', 90, 0.9, sr);
      let ph = 0, brown = 0;
      for (let i = 0; i < arr.length; i++) {
        const t = i / sr; const n = this.noise();
        brown = (brown + n * 0.02) * 0.995;
        const boom = lp.p(n) * Math.exp(-t / 0.55) * 3.2;
        const crack = lp2.p(n) * Math.exp(-t / 0.05) * 1.6;
        ph += TAU * (38 + 30 * Math.exp(-t / 0.1)) / sr;
        const sub = Math.sin(ph) * Math.exp(-t / 0.45) * 1.4;
        const rumble = lp3.p(brown * 40) * Math.exp(-t / 1.2) * 1.2;
        const crackle = (this.rng.next() < 0.004 * Math.exp(-t / 0.4)) ? (this.noise() * 2.5) : 0;
        arr[i] = Math.tanh((boom + crack + sub + rumble + crackle) * 1.3) * (1 - Math.exp(-t / 0.002));
      }
    }
    this.finish('explosion', b);
  }
  synthClick(name, o) {
    const sr = this.sr, b = this.buf(o.dur || 0.12), L = b.L;
    const bp = new Biquad('bp', o.f || 3000, o.q || 3, sr);
    const parts = o.parts || [];
    for (let i = 0; i < L.length; i++) {
      const t = i / sr; let s = bp.p(this.noise()) * Math.exp(-t / (o.t || 0.008));
      for (const p of parts) s += Math.sin(TAU * p[0] * t) * Math.exp(-t / p[1]) * p[2];
      if (o.t2) { const t2 = t - o.t2; if (t2 > 0) s += bp.p(this.noise()) * Math.exp(-t2 / (o.t || 0.008)) * 0.8; }
      L[i] = s;
    }
    this.finish(name, b, o.norm || 0.7);
  }
  synthWhoosh(name, dur, f0, f1, g = 0.8) {
    const sr = this.sr, b = this.buf(dur), L = b.L;
    for (let i = 0; i < L.length; i++) {
      const t = i / sr, u = t / dur;
      if (i % 64 === 0) this._wbp = new Biquad('bp', lerp(f0, f1, u), 1.4, sr);
      const env = Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 2;
      L[i] = this._wbp.p(this.noise()) * env;
    }
    this.finish(name, b, g);
  }
  synthThud(name, o) {
    const sr = this.sr, b = this.buf(o.dur || 0.3), L = b.L;
    const lp = new Biquad('lp', o.lp || 400, 0.8, sr); let ph = 0;
    for (let i = 0; i < L.length; i++) {
      const t = i / sr;
      ph += TAU * (o.f || 90) * (1 + 0.6 * Math.exp(-t / 0.02)) / sr;
      L[i] = lp.p(this.noise()) * Math.exp(-t / (o.t || 0.06)) * 1.2 + Math.sin(ph) * Math.exp(-t / (o.t2 || 0.08)) * (o.sub || 0.8) + (o.click ? this.noise() * Math.exp(-t / 0.003) * o.click : 0);
    }
    this.finish(name, b, o.norm || 0.85);
  }
  synthStep(name, grass) {
    const sr = this.sr, b = this.buf(grass ? 0.22 : 0.12), L = b.L;
    const f = grass ? new Biquad('hp', 1800 + this.rng.next() * 1500, 0.7, sr) : new Biquad('bp', 1100 + this.rng.next() * 900, 1.6, sr);
    const lp = new Biquad('lp', 160, 0.7, sr);
    for (let i = 0; i < L.length; i++) {
      const t = i / sr; const n = this.noise();
      if (grass) { const grain = this.rng.next() < 0.3 ? 1 : 0.35; L[i] = f.p(n) * Math.exp(-t / 0.06) * grain * (1 - Math.exp(-t / 0.008)); }
      else L[i] = f.p(n) * Math.exp(-t / 0.018) + lp.p(n) * Math.exp(-t / 0.03) * 2.2 + (t > 0.03 ? f.p(n) * Math.exp(-(t - 0.03) / 0.012) * 0.5 : 0);
    }
    this.finish(name, b, grass ? 0.5 : 0.6);
  }
  synthVoice(name, o) {
    // source-filter: glottal pulse train (saw w/ jitter) -> formant bandpasses
    const sr = this.sr, b = this.buf(o.dur), L = b.L;
    const F = o.formants.map(f => new Biquad('bp', f[0], f[1], sr));
    let ph = 0;
    for (let i = 0; i < L.length; i++) {
      const t = i / sr, u = t / o.dur;
      const pitch = o.f0 * (1 + o.slide * u + 0.06 * Math.sin(t * 7.3 + o.seed) + 0.04 * Math.sin(t * 23 + o.seed * 2)) * (1 + (this.rng.next() - 0.5) * o.jitter);
      ph += pitch / sr; if (ph > 1) ph -= 1;
      const src = (ph * 2 - 1) * 0.7 + this.noise() * o.breath;
      let s = 0; for (let k = 0; k < F.length; k++) s += F[k].p(src) * o.formants[k][2];
      const env = Math.min(1, u * 8) * Math.pow(1 - u, 1.3) * (0.75 + 0.25 * Math.sin(t * 5 + o.seed));
      L[i] = Math.tanh(s * env * o.drive);
    }
    this.finish(name, b, o.norm || 0.75);
  }
  synthLoop(name, dur, fn, stereo) {
    const sr = this.sr, b = this.buf(dur, stereo ? 2 : 1);
    fn(b, sr);
    // crossfade loop seam
    const fade = Math.floor(sr * 0.25);
    for (const arr of [b.L, b.R]) {
      if (!arr) continue;
      const n = arr.length;
      for (let i = 0; i < fade; i++) { const w = i / fade; arr[i] = arr[i] * w + arr[n - fade + i] * (1 - w); }
      // trim tail
    }
    if (b.L) { const n = b.L.length - fade; b.L = b.L.slice(0, n); if (b.R) b.R = b.R.slice(0, n); }
    this.finish(name, b, 0.6);
  }
  synthesizeGroup(group) {
    if (!this.ctx) return;
    const sr = this.sr;
    if (group === 0) {
      this.synthGun('pistol', { dur: 0.7, crackHP: 2200, crackT: 0.01, crackG: 1.4, bodyLP: 1400, bodyT: 0.05, bodyG: 1.6, thumpF0: 190, thumpF1: 55, thumpT: 0.05, thumpG: 1.3, tailLP: 700, tailT: 0.22, tailG: 0.5 });
      this.synthGun('sniper', { dur: 1.6, crackHP: 1600, crackT: 0.018, crackG: 2.0, bodyLP: 950, bodyT: 0.12, bodyG: 2.2, thumpF0: 150, thumpF1: 38, thumpT: 0.12, thumpG: 1.8, tailLP: 500, tailT: 0.5, tailG: 0.8, echo: 0.24 });
      this.synthExplosion();
    } else if (group === 1) {
      this.synthClick('dry', { f: 3500, q: 4, t: 0.006, dur: 0.08, parts: [[2400, 0.02, 0.2]] });
      this.synthClick('magOut', { f: 2200, q: 2, t: 0.01, dur: 0.2, parts: [[1800, 0.04, 0.25], [3100, 0.03, 0.15]], t2: 0.05 });
      this.synthClick('magIn', { f: 1800, q: 2, t: 0.012, dur: 0.22, parts: [[1500, 0.05, 0.3], [2600, 0.03, 0.2]], t2: 0.07 });
      this.synthClick('slide', { f: 2600, q: 1.5, t: 0.02, dur: 0.25, parts: [[2000, 0.06, 0.25]], t2: 0.11 });
      this.synthClick('bolt', { f: 1900, q: 1.5, t: 0.025, dur: 0.4, parts: [[1400, 0.08, 0.25], [2900, 0.05, 0.15]], t2: 0.2 });
      this.synthClick('pin', { f: 5000, q: 6, t: 0.01, dur: 0.3, parts: [[4200, 0.12, 0.35], [6100, 0.08, 0.2]] });
      this.synthClick('clink', { f: 3000, q: 5, t: 0.006, dur: 0.35, parts: [[1850, 0.09, 0.5], [2650, 0.07, 0.4], [4100, 0.05, 0.3]] });
      this.synthClick('knifeWall', { f: 4000, q: 3, t: 0.01, dur: 0.3, parts: [[3300, 0.1, 0.4], [5200, 0.06, 0.25]] });
      this.synthClick('hitHard', { f: 3200, q: 1.2, t: 0.015, dur: 0.25, parts: [[2800, 0.03, 0.3]], t2: 0.04 });
      this.synthClick('equip', { f: 1500, q: 2, t: 0.02, dur: 0.25, parts: [[900, 0.05, 0.2]], t2: 0.09 });
    } else if (group === 2) {
      this.synthWhoosh('swing', 0.3, 500, 2600, 0.7);
      this.synthWhoosh('throw', 0.35, 300, 1600, 0.6);
      this.synthThud('hitBody', { lp: 420, t: 0.05, f: 85, t2: 0.06, sub: 0.7, click: 0.6, dur: 0.25 });
      this.synthThud('hitHead', { lp: 650, t: 0.04, f: 140, t2: 0.05, sub: 0.6, click: 0.9, dur: 0.22 });
      this.synthThud('stab', { lp: 500, t: 0.06, f: 100, t2: 0.06, sub: 0.6, click: 0.4, dur: 0.25 });
      this.synthThud('hitDirt', { lp: 900, t: 0.07, f: 70, t2: 0.06, sub: 0.5, click: 0.3, dur: 0.3 });
      this.synthThud('hitWood', { lp: 1400, t: 0.03, f: 320, t2: 0.08, sub: 0.8, click: 0.5, dur: 0.3 });
      this.synthThud('thud', { lp: 260, t: 0.11, f: 62, t2: 0.12, sub: 1.0, click: 0.1, dur: 0.45 });
      this.synthThud('thudLight', { lp: 500, t: 0.05, f: 110, t2: 0.05, sub: 0.6, click: 0.2, dur: 0.2 });
      for (let i = 0; i < 4; i++) { this.synthStep('stepHard' + i, false); this.synthStep('stepGrass' + i, true); }
      // ricochet
      { const b = this.buf(0.45), L = b.L; let ph = 0; for (let i = 0; i < L.length; i++) { const t = i / sr; const f = 3200 * Math.exp(-t * 2.2) + 900; ph += TAU * f * (1 + 0.02 * Math.sin(t * 90)) / sr; L[i] = Math.sin(ph) * Math.exp(-t / 0.18) * (1 - Math.exp(-t / 0.005)); } this.finish('ricochet', b, 0.5); }
    } else if (group === 3) {
      const vowels = [[[620, 4, 1], [1100, 5, 0.6], [2500, 6, 0.25]], [[480, 4, 1], [900, 5, 0.7], [2400, 6, 0.2]], [[700, 4, 1], [1250, 5, 0.5], [2600, 6, 0.2]], [[400, 4, 1], [820, 5, 0.6], [2300, 6, 0.25]], [[560, 3, 1], [1000, 4, 0.6], [2450, 6, 0.3]]];
      for (let i = 0; i < 5; i++) this.synthVoice('groan' + i, { dur: 1.0 + i * 0.22, f0: 68 + i * 9, slide: -0.25 + (i % 2) * 0.35, jitter: 0.25, breath: 0.35, formants: vowels[i], drive: 2.2, seed: i * 1.7 });
      this.synthVoice('growl', { dur: 0.55, f0: 105, slide: 0.2, jitter: 0.5, breath: 0.5, formants: [[700, 3, 1], [1300, 4, 0.7], [2700, 5, 0.3]], drive: 4, seed: 3 });
      this.synthVoice('gasp0', { dur: 0.35, f0: 210, slide: 0.3, jitter: 0.1, breath: 1.4, formants: [[800, 3, 1], [1200, 4, 0.6], [2600, 5, 0.4]], drive: 1.2, seed: 5, norm: 0.35 });
      this.synthVoice('gasp1', { dur: 0.32, f0: 290, slide: 0.35, jitter: 0.1, breath: 1.4, formants: [[850, 3, 1], [1350, 4, 0.6], [2900, 5, 0.4]], drive: 1.2, seed: 6, norm: 0.35 });
    } else if (group === 4) {
      // UI
      const tone = (name, freqs, dur, g = 0.5) => { const b = this.buf(dur), L = b.L; for (let i = 0; i < L.length; i++) { const t = i / sr; let s = 0; freqs.forEach((f, k) => { const st = k * dur / freqs.length * 0.8; if (t > st) s += Math.sin(TAU * f * (t - st)) * Math.exp(-(t - st) / (dur * 0.35)); }); L[i] = s * (1 - Math.exp(-t / 0.002)); } this.finish(name, b, g); };
      tone('click', [1400], 0.06, 0.35); tone('toggle', [900, 1350], 0.12, 0.35); tone('spawn', [520, 780, 1040], 0.32, 0.4);
      tone('select', [1200, 1600], 0.1, 0.35); tone('error', [220, 180], 0.25, 0.4); tone('grab', [600, 900], 0.15, 0.35); tone('drop', [700, 420], 0.15, 0.35);
      tone('tick', [2200], 0.03, 0.25); tone('zombieAlert', [196, 185, 174], 0.6, 0.45); tone('ready', [660, 880, 1320], 0.45, 0.45);
    } else if (group === 5) {
      // ambience loops
      this.synthLoop('roomHum', 6, (b) => { let br = 0; const lp = new Biquad('lp', 180, 0.7, sr); for (let i = 0; i < b.L.length; i++) { const t = i / sr; br = (br + this.noise() * 0.03) * 0.997; b.L[i] = lp.p(br * 8) * 0.8 + Math.sin(TAU * 120 * t) * 0.025 + Math.sin(TAU * 60 * t) * 0.04 + Math.sin(TAU * 240 * t) * 0.006; } });
      this.synthLoop('wind', 8, (b) => { for (const [arr, s] of [[b.L, 0.3], [b.R, 1.7]]) { const bp = new Biquad('bp', 380, 0.6, sr); let pk = 0; for (let i = 0; i < arr.length; i++) { const t = i / sr; pk = pk * 0.97 + this.noise() * 0.03; const m = 0.5 + 0.35 * Math.sin(t * TAU * 0.13 + s) + 0.15 * Math.sin(t * TAU * 0.41 + s * 2); arr[i] = bp.p(pk * 6) * m; } } }, true);
      this.synthLoop('rain', 4, (b) => { for (const arr of [b.L, b.R]) { const hp = new Biquad('hp', 1400, 0.6, sr); for (let i = 0; i < arr.length; i++) { arr[i] = hp.p(this.noise()) * 0.5 + (this.rng.next() < 0.0012 ? this.noise() * 2 : 0); } } }, true);
      this.synthLoop('crickets', 3, (b) => { for (let i = 0; i < b.L.length; i++) { const t = i / sr; const pulse = (Math.sin(TAU * 32 * t) > 0.6 ? 1 : 0) * (Math.sin(TAU * 0.9 * t) > -0.2 ? 1 : 0); b.L[i] = Math.sin(TAU * 4500 * t) * pulse * 0.4 + Math.sin(TAU * 4700 * t + 1) * (Math.sin(TAU * 27 * t + 2) > 0.7 ? 1 : 0) * 0.25; } });
      this.synthLoop('drone', 6, (b) => { for (const [arr, dt] of [[b.L, 0], [b.R, 0.7]]) { const lp = new Biquad('lp', 500, 1.2, sr); let p1 = 0, p2 = 0, p3 = 0; for (let i = 0; i < arr.length; i++) { const t = i / sr; p1 = (p1 + 55 / sr) % 1; p2 = (p2 + (55.4 + dt * 0.3) / sr) % 1; p3 = (p3 + 82.5 / sr) % 1; arr[i] = lp.p((p1 * 2 - 1) + (p2 * 2 - 1) * 0.8 + (p3 * 2 - 1) * 0.4) * (0.7 + 0.3 * Math.sin(t * TAU / 6 + dt)); } } }, true);
      // bird chirps
      for (let k = 0; k < 4; k++) { const b = this.buf(0.6), L = b.L; let ph = 0; const n = 2 + k; for (let i = 0; i < L.length; i++) { const t = i / sr; const seg = Math.floor(t / 0.11); const u = (t % 0.11) / 0.11; if (seg >= n) { L[i] = 0; continue; } const f = 2600 + k * 400 + Math.sin(u * Math.PI) * 1500 * (seg % 2 ? -0.5 : 1); ph += TAU * f / sr; L[i] = Math.sin(ph) * Math.sin(Math.PI * u) ** 2; } this.finish('bird' + k, b, 0.35); }
    } else if (group === 6) {
      // gore: wet splats, bone cracks, bites, chewing, arterial gush, screams
      const wet = (name, o) => {
        const b = this.buf(o.dur), L = b.L;
        const lp = new Biquad('lp', o.lp, 0.9, sr), bp = new Biquad('bp', o.bp, 1.2, sr), lp2 = new Biquad('lp', 30, 0.7, sr);
        let ph = 0;
        for (let i = 0; i < L.length; i++) {
          const t = i / sr, n = this.noise();
          const am = lp2.p(this.noise()) * 30;
          ph += TAU * (o.f * (1 + 0.5 * Math.exp(-t / 0.02))) / sr;
          const thump = Math.sin(ph) * Math.exp(-t / o.tT) * o.thump;
          const body = lp.p(n) * Math.exp(-t / o.t) * (0.6 + 0.4 * Math.min(1, Math.abs(am))) * 1.6;
          const squish = bp.p(n) * Math.exp(-t / (o.t * 1.6)) * (0.5 + Math.max(0, Math.sin(t * o.gurgle * TAU)) * 0.8) * o.sq;
          const crack = this.rng.next() < o.crackle * Math.exp(-t / 0.05) ? this.noise() * 1.5 : 0;
          L[i] = Math.tanh((thump + body + squish + crack) * 1.4) * (1 - Math.exp(-t / 0.0015));
        }
        this.finish(name, b, o.norm || 0.85);
      };
      wet('splat0', { dur: 0.35, lp: 900, bp: 1400, f: 70, tT: 0.05, thump: 0.9, t: 0.06, sq: 0.8, gurgle: 23, crackle: 0.02 });
      wet('splat1', { dur: 0.4, lp: 1200, bp: 1900, f: 85, tT: 0.04, thump: 0.7, t: 0.07, sq: 1.0, gurgle: 31, crackle: 0.03 });
      wet('splat2', { dur: 0.3, lp: 700, bp: 1100, f: 60, tT: 0.06, thump: 1.1, t: 0.05, sq: 0.7, gurgle: 17, crackle: 0.015 });
      wet('squelch', { dur: 0.7, lp: 600, bp: 900, f: 50, tT: 0.1, thump: 0.5, t: 0.22, sq: 1.3, gurgle: 9, crackle: 0.01 });
      wet('gib', { dur: 0.9, lp: 700, bp: 1300, f: 48, tT: 0.12, thump: 1.6, t: 0.16, sq: 1.2, gurgle: 14, crackle: 0.08 });
      { const b = this.buf(0.3), L = b.L; const bp = new Biquad('bp', 2600, 3, sr), hp = new Biquad('hp', 3000, 0.7, sr), lp = new Biquad('lp', 500, 0.8, sr);
        for (let i = 0; i < L.length; i++) { const t = i / sr, n = this.noise(), t2 = t - 0.012;
          L[i] = hp.p(n) * Math.exp(-t / 0.004) * 1.8 + bp.p(n) * Math.exp(-t / 0.025) * 1.4 + (t2 > 0 ? hp.p(this.noise()) * Math.exp(-t2 / 0.003) : 0) + lp.p(n) * Math.exp(-t / 0.04) * 1.2; }
        this.finish('crack', b, 0.8); }
      { const b = this.buf(0.6), L = b.L; const bp = new Biquad('bp', 1800, 1.5, sr), lp = new Biquad('lp', 800, 0.8, sr);
        for (let i = 0; i < L.length; i++) { const t = i / sr, n = this.noise(); const grain = this.rng.next() < 0.25 * Math.exp(-t / 0.15) ? 1 : 0.15;
          L[i] = bp.p(n) * grain * Math.exp(-t / 0.18) * 1.5 + lp.p(n) * Math.exp(-t / 0.05) * 1.6 + (t > 0.15 ? lp.p(n) * Math.exp(-(t - 0.15) / 0.2) * (0.5 + Math.sin(t * 40) * 0.5) : 0); }
        this.finish('bite', b, 0.85); }
      { const b = this.buf(1.4), L = b.L; const bp = new Biquad('bp', 900, 1.2, sr), lp = new Biquad('lp', 500, 0.8, sr);
        for (let i = 0; i < L.length; i++) { const t = i / sr, ph = (t * 3.2) % 1; const env = Math.exp(-ph / 0.12) * (1 - Math.exp(-ph / 0.01)); const n = this.noise();
          L[i] = (bp.p(n) * 1.2 + lp.p(n) * 1.5) * env * (0.6 + 0.4 * Math.sin(t * 7)); }
        this.finish('chew', b, 0.7); }
      { const b = this.buf(0.6), L = b.L; const hp = new Biquad('hp', 1200, 0.7, sr), bp = new Biquad('bp', 700, 1, sr);
        for (let i = 0; i < L.length; i++) { const t = i / sr; const env = Math.exp(-t / 0.25) * (1 - Math.exp(-t / 0.02)); const n = this.noise();
          L[i] = (hp.p(n) * 0.8 + bp.p(n) * 0.9 * (0.5 + 0.5 * Math.sin(t * 60))) * env; }
        this.finish('gush', b, 0.6); }
      const ah = [[850, 5, 1], [1250, 6, 0.6], [2800, 7, 0.35]], eh = [[600, 5, 1], [1900, 6, 0.55], [2700, 7, 0.3]];
      this.synthVoice('scream0', { dur: 1.3, f0: 390, slide: 0.25, jitter: 0.08, breath: 0.25, formants: ah, drive: 3.0, seed: 11, norm: 0.8 });
      this.synthVoice('scream1', { dur: 1.1, f0: 255, slide: 0.35, jitter: 0.1, breath: 0.3, formants: ah, drive: 3.5, seed: 12, norm: 0.8 });
      this.synthVoice('scream2', { dur: 1.5, f0: 330, slide: -0.2, jitter: 0.12, breath: 0.3, formants: eh, drive: 3.2, seed: 13, norm: 0.8 });
      this.synthVoice('pain0', { dur: 0.6, f0: 180, slide: -0.3, jitter: 0.15, breath: 0.5, formants: eh, drive: 2.0, seed: 14, norm: 0.6 });
      this.synthVoice('gurgle', { dur: 0.9, f0: 90, slide: -0.2, jitter: 0.6, breath: 0.9, formants: [[400, 3, 1], [900, 4, 0.5], [2200, 5, 0.2]], drive: 2.5, seed: 15, norm: 0.55 });
    }
  }
  // --- playback -------------------------------------------------------------------------
  play(name, o = {}) {
    if (!this.ctx || this.disabled || !this.unlocked) return null;
    let buf = this.buffers[name];
    if (!buf) return null;
    if (this.voices > 40 && !o.important) return null;
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (o.rate || 1) * (o.vary === false ? 1 : 1 + (Math.random() - 0.5) * 0.08);
    const g = c.createGain(); g.gain.value = o.gain != null ? o.gain : 1;
    let node = src;
    node.connect(g); node = g;
    if (o.pos) {
      const p = c.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = o.ref || 3; p.rolloffFactor = 1.1; p.maxDistance = 200;
      if (p.positionX) { p.positionX.value = o.pos.x; p.positionY.value = o.pos.y; p.positionZ.value = o.pos.z; } else p.setPosition(o.pos.x, o.pos.y, o.pos.z);
      node.connect(p); node = p;
    }
    const bus = this.bus[o.bus || 'effects'];
    node.connect(bus);
    if ((o.bus || 'effects') === 'effects' && o.reverb !== false) {
      const s = c.createGain(); s.gain.value = o.reverbAmt != null ? o.reverbAmt : 1; node.connect(s); s.connect(this.reverbSend);
    }
    this.voices++;
    src.onended = () => { this.voices--; try { g.disconnect(); node.disconnect(); } catch (e) { } };
    src.start();
    return src;
  }
  loop(name, gainV, bus = 'ambience') {
    if (!this.ctx || !this.buffers[name]) return null;
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.buffers[name]; src.loop = true;
    const g = c.createGain(); g.gain.value = 0; src.connect(g); g.connect(this.bus[bus]);
    src.start(); g.gain.setTargetAtTime(gainV, c.currentTime, 0.8);
    return { src, g, stop: () => { g.gain.setTargetAtTime(0, c.currentTime, 0.4); setTimeout(() => { try { src.stop(); } catch (e) { } }, 1600); } };
  }
  makeIR(kind) {
    const c = this.ctx, sr = this.sr;
    const dur = kind === 'room' ? 2.2 : 0.7;
    const buf = c.createBuffer(2, Math.floor(dur * sr), sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      const lp = new Biquad('lp', kind === 'room' ? 5500 : 3000, 0.7, sr);
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        let s = this.noise() * Math.exp(-t / (kind === 'room' ? 0.42 : 0.12));
        if (kind === 'room') for (const er of [0.011, 0.019, 0.027, 0.041, 0.058]) if (Math.abs(t - er - ch * 0.002) < 0.0007) s += 0.8;
        d[i] = lp.p(s) * (1 - Math.exp(-t / 0.004));
      }
    }
    return buf;
  }
  setEnvironment(kind) {
    if (!this.ctx) return;
    this.envKind = kind;
    try { this.reverb.buffer = this.makeIR(kind); } catch (e) { reportError(e, 'reverb'); }
    this.reverbGain.gain.value = kind === 'room' ? 0.42 : 0.12;
    if (this.unlocked) this.startAmbience();
  }
  startLoadingDrone() { if (!this.drone && this.buffers.drone) this.drone = this.loop('drone', 0.35, 'ui'); }
  stopLoadingDrone() { if (this.drone) { this.drone.stop(); this.drone = null; } }
  startAmbience() {
    this.stopLoadingDrone();
    for (const k in this.ambience) { this.ambience[k].stop(); }
    this.ambience = {};
    const env = this.game.env.current; if (!env) return;
    if (env.kind === 'room') this.ambience.hum = this.loop('roomHum', 0.32);
    else {
      this.ambience.wind = this.loop('wind', 0.2 + Settings.data.environment.field.wind * 0.5);
      if (Settings.data.environment.field.weather === 'rain') this.ambience.rain = this.loop('rain', 0.45);
      const t = Settings.data.environment.field.timeOfDay;
      if (t < 6 || t > 19.5) this.ambience.crickets = this.loop('crickets', 0.12);
    }
  }
  update(dt, cam) {
    if (!this.ctx || !this.unlocked) return;
    const L = this.ctx.listener;
    const f = cam.getWorldDirection(_v1);
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setTargetAtTime(cam.position.x, t, 0.02); L.positionY.setTargetAtTime(cam.position.y, t, 0.02); L.positionZ.setTargetAtTime(cam.position.z, t, 0.02);
      L.forwardX.setTargetAtTime(f.x, t, 0.02); L.forwardY.setTargetAtTime(f.y, t, 0.02); L.forwardZ.setTargetAtTime(f.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(cam.position.x, cam.position.y, cam.position.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    // birds in field daytime
    const env = this.game.env.current;
    if (env && env.kind === 'field') {
      const t = Settings.data.environment.field.timeOfDay, w = Settings.data.environment.field.weather;
      this.birdT -= dt;
      if (this.birdT <= 0 && t > 6 && t < 19 && w !== 'rain') {
        this.birdT = 2 + Math.random() * 7;
        const a = Math.random() * TAU, d = 20 + Math.random() * 40;
        this.play('bird' + Math.floor(Math.random() * 4), { bus: 'ambience', pos: _v2.set(cam.position.x + Math.cos(a) * d, 8 + Math.random() * 10, cam.position.z + Math.sin(a) * d), gain: 0.5, ref: 10, reverb: false });
      }
      if (this.ambience.wind) this.ambience.wind.g.gain.setTargetAtTime(0.2 + Settings.data.environment.field.wind * 0.6, this.ctx.currentTime, 0.5);
    }
  }
}
HT.AudioEngine = AudioEngine;
