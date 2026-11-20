/**
 * Sound, synthesised live with the Web Audio API (no audio files, no dependencies).
 *
 *   engine     two detuned saw oscillators + a sub, pitch from a simple gearbox model of the speed
 *   road/tyres filtered noise rising with speed; a squeal when cornering or braking hard
 *   wind       noise that grows with speed
 *   ambience   a bed per environment (city rumble, countryside wind + birds, desert wind), crossfaded
 *   one-shots  crash, wall thud, speed-bump thump, landing
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is created in unlock(), which the
 * game calls on the first key press or click. Where Web Audio is missing (or fails) every method is a no-op.
 * A fake context can be injected through `contextFactory`, which is how the tests run it.
 */
import { AUDIO, C } from './config.js';
import { isDesert, isHwy } from './world/zones.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Which ambience belongs at a grid position: 'city', 'country' or 'desert'. */
export function zoneAt(gx, gz) {
  const i = Math.floor(gx / C), j = Math.floor(gz / C);
  return !isHwy(i, j) ? 'city' : isDesert(i, j) ? 'desert' : 'country';
}

/**
 * The engine note for a speed: a five-speed box, so the pitch climbs through each gear and drops at the shift.
 * Returns { gear (1-5), rpm (0..1), freq (Hz), cutoff (Hz), gain (0..1) }.
 */
export function engineModel(speed, throttle) {
  const v = Math.abs(speed), g = AUDIO.gearSpeeds;
  let gear = 0;
  while (gear < g.length - 2 && v >= g[gear + 1]) gear++;
  const frac = clamp((v - g[gear]) / (g[gear + 1] - g[gear]), 0, 1);
  const rpm = gear === 0 ? 0.12 + 0.88 * frac : 0.4 + 0.6 * frac;
  const load = throttle > 0 ? 1 : 0;
  return {
    gear: gear + 1,
    rpm,
    freq: AUDIO.engineIdleHz + rpm * AUDIO.engineRangeHz,
    cutoff: 320 + rpm * 1700 * (0.55 + 0.45 * load),
    gain: 0.35 + 0.65 * load,
  };
}

export class AudioManager {
  /** @param {{contextFactory?: () => AudioContext, doc?: Document}} [opts] */
  constructor({ contextFactory, doc = globalThis.document } = {}) {
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    this.factory = contextFactory || (Ctor ? () => new Ctor() : null);
    this.supported = !!this.factory;
    this.enabled = true;
    this.volume = AUDIO.volume;
    this.ctx = null;
    this.zone = 'city';
    this.birdTimer = 2;
    this.lastEvent = {};
    this.doc = doc;
    this._onVisibility = () => {
      if (!this.ctx) return;
      if (this.doc.hidden) this.ctx.suspend?.();
      else if (this.enabled) this.ctx.resume?.();
    };
  }

  /** Create (or resume) the audio context. Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.supported) return;
    try {
      if (!this.ctx) {
        this.ctx = this.factory();
        this._build();
        this.doc?.addEventListener?.('visibilitychange', this._onVisibility);
      }
      if (this.enabled && this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      console.warn('Audio unavailable:', e);
      this.supported = false;
      this.ctx = null;
    }
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!this.ctx) return;
    this._master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.05);
    if (this.enabled) this.ctx.resume?.();
    else setTimeout(() => { if (!this.enabled) this.ctx.suspend?.(); }, 300);   // after the fade, stop using the CPU
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.ctx && this.enabled) this._master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  dispose() {
    this.doc?.removeEventListener?.('visibilitychange', this._onVisibility);
    try { this.ctx?.close?.(); } catch { /* already closed */ }
    this.ctx = null;
  }

  /** An analyser on the output, for measuring what is actually being played (used by the browser test). */
  tap() {
    if (!this.ctx) return null;
    if (!this._analyser) {
      this._analyser = this.ctx.createAnalyser();
      this._analyser.fftSize = 4096;
      this._master.connect(this._analyser);
    }
    return this._analyser;
  }

  /**
   * Per-frame update.
   * @param {number} dt
   * @param {{speed:number, throttle:number, brake:number, steer:number, airborne:boolean, gx:number, gz:number}} s
   */
  update(dt, s) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime, smooth = 0.06, v = Math.abs(s.speed), vf = clamp(v / 58, 0, 1);

    const e = engineModel(s.speed, s.throttle);
    this._engine.saw1.frequency.setTargetAtTime(e.freq, t, smooth);
    this._engine.saw2.frequency.setTargetAtTime(e.freq * 1.006, t, smooth);
    this._engine.sub.frequency.setTargetAtTime(e.freq * 0.5, t, smooth);
    this._engine.filter.frequency.setTargetAtTime(e.cutoff, t, smooth);
    this._engine.gain.gain.setTargetAtTime(AUDIO.engineGain * e.gain, t, smooth);

    const grounded = s.airborne ? 0 : 1;
    this._road.gain.gain.setTargetAtTime(AUDIO.roadGain * vf * grounded, t, smooth);
    this._road.filter.frequency.setTargetAtTime(250 + v * 22, t, smooth);
    this._wind.gain.gain.setTargetAtTime(AUDIO.windGain * vf * vf, t, smooth);

    const lateral = clamp((Math.abs(s.steer) * v - 14) / 28, 0, 1);
    const skid = s.brake > 0 ? clamp((v - 14) / 30, 0, 1) : 0;
    this._squeal.gain.gain.setTargetAtTime(AUDIO.squealGain * Math.max(lateral, skid) * grounded, t, 0.04);

    const zone = zoneAt(s.gx, s.gz);
    if (zone !== this.zone) this.zone = zone;
    for (const name of ['city', 'country', 'desert']) {
      this._beds[name].setTargetAtTime(name === zone ? AUDIO.ambienceGain : 0, t, AUDIO.ambienceFadeSeconds / 3);
    }
    if (zone === 'country') {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) { this._chirps(); this.birdTimer = 1.5 + Math.random() * 4; }
    }
  }

  // ---- one-shot sounds ------------------------------------------------------------------------------------

  /** A collision that restarts the run. */
  crash() {
    if (!this._ready('crash')) return;
    this._noise({ dur: 0.9, from: 3200, to: 160, gain: 0.7 });
    this._thump({ f0: 130, f1: 35, dur: 0.6, gain: 0.9 });
    this._clank(0.45);
  }

  /** Scraping or thumping a building: louder with impact speed. */
  thud(speed) {
    if (!this._ready('thud')) return;
    const k = clamp(Math.abs(speed) / 30, 0.2, 1);
    this._noise({ dur: 0.35, from: 1600, to: 200, gain: 0.45 * k });
    this._thump({ f0: 110, f1: 40, dur: 0.3, gain: 0.7 * k });
  }

  /** Driving over a speed bump. */
  bump(speed) {
    if (!this._ready('bump')) return;
    const k = clamp(Math.abs(speed) / 25, 0.3, 1);
    this._thump({ f0: 85, f1: 45, dur: 0.18, gain: 0.55 * k });
    this._noise({ dur: 0.08, from: 900, to: 300, gain: 0.2 * k });
  }

  /** Coming down after a hop; `vy` is the downward speed. */
  landing(vy) {
    if (!this._ready('landing')) return;
    const k = clamp(Math.abs(vy) / 6, 0.2, 1);
    this._thump({ f0: 95, f1: 40, dur: 0.22, gain: 0.6 * k });
    this._noise({ dur: 0.12, from: 1200, to: 250, gain: 0.25 * k });
  }

  // ---- internals ------------------------------------------------------------------------------------------

  _ready(name) {
    if (!this.ctx || !this.enabled) return false;
    const t = this.ctx.currentTime;
    if (t - (this.lastEvent[name] ?? -9) < AUDIO.minEventGap) return false;
    this.lastEvent[name] = t;
    return true;
  }

  _build() {
    const ctx = this.ctx;
    this._master = ctx.createGain();
    this._master.gain.value = this.enabled ? this.volume : 0;
    this._master.connect(ctx.destination);

    // one second of white noise, shared by every noise source
    const len = ctx.sampleRate;
    this._noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // engine
    const filter = this._biquad('lowpass', 600, 1.2), gain = this._gain(0);
    const mk = (type, hz, g) => {
      const o = ctx.createOscillator(), og = this._gain(g);
      o.type = type; o.frequency.value = hz;
      o.connect(og); og.connect(filter); o.start();
      return o;
    };
    this._engine = { saw1: mk('sawtooth', 50, 0.5), saw2: mk('sawtooth', 50, 0.35), sub: mk('triangle', 25, 0.6), filter, gain };
    filter.connect(gain); gain.connect(this._master);

    // road, wind, squeal
    this._road = this._noiseLoop('lowpass', 400, 0.7);
    this._wind = this._noiseLoop('highpass', 1300, 0.5);
    this._squeal = this._noiseLoop('bandpass', 2300, 9);

    // ambience beds, each behind its own fade gain
    this._beds = {};
    this._beds.city = this._bed(this._noiseLoop('lowpass', 260, 0.5, 0.9), { rate: 0.11, depth: 0.25 }, this._noiseLoop('bandpass', 850, 0.6, 0.18));
    this._beds.country = this._bed(this._noiseLoop('bandpass', 520, 0.7, 0.8), { rate: 0.17, depth: 0.45 });
    this._beds.desert = this._bed(this._noiseLoop('bandpass', 760, 0.45, 1), { rate: 0.07, depth: 0.5 }, this._noiseLoop('highpass', 2400, 0.4, 0.12));
  }

  _gain(v) { const g = this.ctx.createGain(); g.gain.value = v; return g; }

  _biquad(type, freq, q) {
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
  }

  /** A looping noise source -> filter -> gain. Returns { filter, gain, out } (out = the gain node). */
  _noiseLoop(type, freq, q, level = 0) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf; src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = this._biquad(type, freq, q), gain = this._gain(level);
    src.connect(filter); filter.connect(gain);
    src.start(0, Math.random());
    if (level === 0) gain.connect(this._master);   // the speed-driven sources go straight to the output
    return { filter, gain, out: gain };
  }

  /** Mix noise layers into one bed with a slow wobble, behind a fade gain; returns the fade's gain param. */
  _bed(main, wobble, ...extra) {
    const fade = this._gain(0), mod = this._gain(1);
    main.out.connect(mod); mod.connect(fade);
    for (const x of extra) x.out.connect(fade);
    const lfo = this.ctx.createOscillator(), depth = this._gain(wobble.depth);
    lfo.frequency.value = wobble.rate; lfo.connect(depth); depth.connect(mod.gain); lfo.start();
    fade.connect(this._master);
    return fade.gain;
  }

  _noise({ dur, from, to, gain }) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf; src.loop = true;
    const f = this._biquad('lowpass', from, 0.8), g = this._gain(0);
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this._master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  _thump({ f0, f1, dur, gain }) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = this._gain(0);
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this._master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** Crunching metal: a few detuned square waves falling in pitch. */
  _clank(gain) {
    const ctx = this.ctx, t = ctx.currentTime;
    for (const hz of [310, 470, 710]) {
      const o = ctx.createOscillator(), g = this._gain(0), f = this._biquad('bandpass', hz * 2, 3);
      o.type = 'square';
      o.frequency.setValueAtTime(hz, t);
      o.frequency.exponentialRampToValueAtTime(hz * 0.55, t + 0.4);
      g.gain.setValueAtTime(gain * 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(f); f.connect(g); g.connect(this._master);
      o.start(t); o.stop(t + 0.45);
    }
  }

  /** A short burst of two or three bird chirps. */
  _chirps() {
    const ctx = this.ctx, base = ctx.currentTime, n = 2 + (Math.random() * 3 | 0), pitch = 2400 + Math.random() * 1400;
    for (let k = 0; k < n; k++) {
      const t = base + k * 0.13, o = ctx.createOscillator(), g = this._gain(0);
      o.type = 'sine';
      o.frequency.setValueAtTime(pitch, t);
      o.frequency.exponentialRampToValueAtTime(pitch * 1.35, t + 0.07);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g); g.connect(this._master);
      o.start(t); o.stop(t + 0.1);
    }
  }
}
