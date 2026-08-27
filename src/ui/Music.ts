/**
 * Generative, season-aware game soundscape (owner rules, sessions 48-54).
 * No audio files — everything is synthesized. Starts when the chapter
 * screen closes.
 *
 *  - WINTER: the frame-drum heartbeat and distant wolves in the dark.
 *  - SPRING: drums and livelier percussion, and a primitive guitar —
 *    plucked strings via Karplus-Strong synthesis — wandering the major
 *    pentatonic.
 *  - Summer and autumn currently keep just the drum, awaiting the owner's
 *    instructions (music grows as the civilisation does).
 */

export type MusicSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export class GameMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private dry: GainNode | null = null;
  private drumTimer = 0;
  private wolfTimer = 0;
  private birdTimer = 0;
  private stopped = false;
  private season: () => MusicSeason = () => 'spring';

  private static readonly LEVEL = 0.11;
  private static readonly BEAT = 0.68; // ~88 bpm heartbeat

  /** Wire the calendar in so the soundscape follows the year. */
  bindSeason(fn: () => MusicSeason): void {
    this.season = fn;
  }

  start(): void {
    if (this.ctx) return;
    this.stopped = false;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.gain.linearRampToValueAtTime(GameMusic.LEVEL, ctx.currentTime + 4); // dawn, not a light switch
    master.connect(ctx.destination);
    this.master = master;

    // Open air: two staggered feedback delays.
    const dry = ctx.createGain();
    dry.gain.value = 0.75;
    dry.connect(master);
    this.dry = dry;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    wet.connect(master);
    for (const [time, fb] of [[0.36, 0.28], [0.5, 0.22]]) {
      const delay = ctx.createDelay();
      delay.delayTime.value = time;
      const feedback = ctx.createGain();
      feedback.gain.value = fb;
      dry.connect(delay).connect(feedback).connect(delay);
      delay.connect(wet);
    }

    // Frame drum: the heartbeat of every season. Spring adds skipping
    // grace-taps and stick clicks; winter keeps it bare.
    let beatN = 0;
    const drum = () => {
      if (this.stopped || !this.ctx) return;
      const t = ctx.currentTime;
      const spring = this.season() === 'spring';
      const strong = beatN % 2 === 0;
      if (Math.random() > 0.12) this.thump(t, strong ? 0.5 : 0.28);
      const tapChance = spring ? 0.6 : 0.35;
      if (!strong && Math.random() < tapChance) this.tap(t + GameMusic.BEAT * 0.5, 0.16);
      if (spring && Math.random() < 0.3) this.stick(t + GameMusic.BEAT * (strong ? 0.75 : 0.25), 0.12);
      beatN++;
      this.drumTimer = window.setTimeout(drum, GameMusic.BEAT * 1000);
    };
    this.drumTimer = window.setTimeout(drum, 1000);

    // Wolves: winter's voice — long random intervals, sometimes answered.
    const wolves = () => {
      if (this.stopped || !this.ctx) return;
      if (this.season() === 'winter') {
        const t = ctx.currentTime + 0.1;
        const howls = Math.random() < 0.4 ? 2 + Math.floor(Math.random() * 2) : 1;
        for (let i = 0; i < howls; i++) {
          this.howl(t + i * (1.8 + Math.random() * 2.5), i === 0 ? 1 : 0.6);
        }
      }
      this.wolfTimer = window.setTimeout(wolves, 25000 + Math.random() * 65000);
    };
    this.wolfTimer = window.setTimeout(wolves, 8000 + Math.random() * 15000);

    // (Guitar removed, owner rule s55 — instruments return with progress.)

    // Songbirds (owner rule, s54): a few different species scattered through
    // spring, each singing its own kind of melody at its own distance.
    const birds = () => {
      if (this.stopped || !this.ctx) return;
      if (this.season() === 'spring') this.birdMelody(ctx.currentTime + 0.05);
      this.birdTimer = window.setTimeout(birds, 5000 + Math.random() * 14000);
    };
    this.birdTimer = window.setTimeout(birds, 2000 + Math.random() * 5000);
  }

  /** One bird sings one melody — the species decides its shape. */
  private birdMelody(t: number): void {
    const key = 0.8 + Math.random() * 0.45; // each bird sits in its own range
    const dist = 0.35 + Math.random() * 0.65; // and at its own distance
    const species = Math.floor(Math.random() * 4);
    if (species === 0) {
      // Rising whistles, evenly spaced.
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        this.chirp(t + i * 0.22, 2200 * key, 3400 * key, 0.09, 0.09 * dist);
      }
    } else if (species === 1) {
      // Quick falling notes, hurried at the end.
      const n = 4 + Math.floor(Math.random() * 4);
      let at = t;
      for (let i = 0; i < n; i++) {
        this.chirp(at, 3800 * key, 2600 * key, 0.07, 0.08 * dist);
        at += 0.16 - i * 0.012;
      }
    } else if (species === 2) {
      // A fast trill on two close notes.
      const n = 8 + Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) {
        const up = i % 2 === 0;
        this.chirp(t + i * 0.055, (up ? 2800 : 3150) * key, (up ? 3000 : 2950) * key, 0.04, 0.07 * dist);
      }
    } else {
      // Two mellow low tones, cuckoo-fashion.
      this.chirp(t, 950 * key, 900 * key, 0.19, 0.11 * dist);
      this.chirp(t + 0.34, 760 * key, 720 * key, 0.22, 0.11 * dist);
    }
  }

  /** A single chirp: a small sine sweeping between two pitches. */
  private chirp(t: number, f0: number, f1: number, dur: number, level: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.03);
    osc.connect(g).connect(this.dry!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** A distant wolf: rise, a held quavering note, and a long dying fall. */
  private howl(t: number, level: number): void {
    const ctx = this.ctx!;
    const pitch = 0.85 + Math.random() * 0.3; // every wolf sings its own key
    const rise = 0.5 + Math.random() * 0.4;
    const hold = 0.8 + Math.random() * 0.9;
    const fall = 1.1 + Math.random() * 0.6;
    const end = t + rise + hold + fall;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16 * level, t + rise);
    g.gain.setValueAtTime(0.16 * level, t + rise + hold);
    g.gain.exponentialRampToValueAtTime(0.001, end);
    // Far away: muffled, and mostly echo.
    const far = ctx.createBiquadFilter();
    far.type = 'lowpass';
    far.frequency.value = 900;
    g.connect(far).connect(this.dry!);

    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.5 + Math.random() * 1.5;
    const vibGain = ctx.createGain();
    vibGain.gain.value = 9 * pitch;
    vibrato.connect(vibGain);
    for (const detune of [0, 5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(270 * pitch, t);
      osc.frequency.linearRampToValueAtTime(510 * pitch, t + rise);
      osc.frequency.setValueAtTime(510 * pitch, t + rise + hold * 0.6);
      osc.frequency.linearRampToValueAtTime(230 * pitch, end);
      vibGain.connect(osc.frequency);
      osc.connect(g);
      osc.start(t);
      osc.stop(end + 0.1);
    }
    vibrato.start(t);
    vibrato.stop(end + 0.1);
  }

  /** Deep frame-drum hit: a sine dropping in pitch, gone in a breath. */
  private thump(t: number, level: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g).connect(this.dry!);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** Fingertip tap on the drum skin: a snip of bright noise. */
  private tap(t: number, level: number): void {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(hp).connect(g).connect(this.dry!);
    src.start(t);
  }

  /** Two sticks struck together: a woody knock for spring's dance. */
  private stick(t: number, level: number): void {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 0.018);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100 + Math.random() * 300;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.value = level * 2.2;
    src.connect(bp).connect(g).connect(this.dry!);
    src.start(t);
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  stop(): void {
    this.stopped = true;
    window.clearTimeout(this.wolfTimer);
    window.clearTimeout(this.drumTimer);
    window.clearTimeout(this.birdTimer);
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
      const ctx = this.ctx;
      window.setTimeout(() => void ctx.close(), 1200);
    }
    this.ctx = null;
  }
}

/** The one game-wide soundscape instance. */
export const gameMusic = new GameMusic();
