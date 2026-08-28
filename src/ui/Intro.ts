/**
 * "Hello World!" chapter intro (owner rules, sessions 42-46): on every fresh
 * start a Baldur's-Gate-style chapter screen opens — the campfire image alive
 * with firelight, the narration rising from below the window like end
 * credits, timed so the last sentences slip away as the narrator finishes.
 * The fire-crackle bed starts first, the voice joins a few beats later, and
 * the crackle keeps burning until the player leaves through the Continue
 * button. Browsers block audio without a user gesture, so if play() is
 * refused the tale waits for the first click.
 */

import { gameMusic } from './Music';

const PARAGRAPHS: string[] = [
  `Human is a rational animal, says Aristo. You are not there yet...`,
  `What you are, right now, is a damp huddle of upright mammals with an ambitious agenda: eat, sleep, and don't get eaten. Congratulations — that is the exact same agenda as the wolves watching you from the treeline, the crows waiting politely behind them, and the worms who are, frankly, the most patient of the lot. You do it all a <em>little</em> smarter, yes. You have thumbs. You have complaints. The wolves would trade neither for their teeth.`,
  `Take an honest look at your achievements so far. Your fire? Found, not made — you keep it alive like a pet you don't understand, and when it dies you will sit in the dark thinking about what you've done. Your shelter is a pile of brush. Dinner is whatever died recently enough. And those noble human virtues you're so sure separate you from the beasts — love, courage, loyalty? For now they are pair-bonding, adrenaline, and pack instinct. Don't feel insulted. The wolves don't.`,
  `So here is the deal, animal. Develop. Learn. Discover. Every skill you master is one small step away from the beast — though do watch, on your way up, how much of the beast you pack for the journey. Or don't develop, and die, and be scavenged by other animals... much like yourself. The forest is fine with either outcome. Welcome to the world — it wasn't waiting for you.`,
];

const FONT = `'IM Fell English', 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif`;
const VOICE_DELAY_MS = 5600; // the fire burns alone before the narrator speaks
const FLOW_EXTRA_SECONDS = 10; // the tale scrolls a little longer than the voice

/** Soft campfire bed: looped low noise + random filtered pops. */
class FireCrackle {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private popTimer = 0;
  private stopped = false;

  start(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    this.master = master;

    // Base: gentle low rumble from looped noise through a lowpass.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.02) * 0.998;
      data[i] = last * 12;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 380;
    const baseGain = ctx.createGain();
    baseGain.gain.value = 0.035; // owner-tuned: barely-there rumble
    src.connect(low).connect(baseGain).connect(master);
    src.start();

    // Pops: short bright noise bursts at random intervals.
    const pop = () => {
      if (this.stopped || !this.ctx) return;
      const t = ctx.currentTime;
      const len = 0.01 + Math.random() * 0.035;
      const burst = ctx.createBufferSource();
      burst.buffer = noise;
      burst.playbackRate.value = 0.7 + Math.random() * 0.8;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1200 + Math.random() * 2400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2 + Math.random() * 0.68, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      burst.connect(hp).connect(g).connect(master);
      burst.start(t, Math.random() * 1.5, len + 0.02);
      this.popTimer = window.setTimeout(pop, 25 + Math.random() * 280);
    };
    pop();
  }

  /** Wake a context the browser opened suspended (pre-gesture autoplay). */
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  stop(): void {
    this.stopped = true;
    window.clearTimeout(this.popTimer);
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
      const ctx = this.ctx;
      window.setTimeout(() => void ctx.close(), 800);
    }
    this.ctx = null;
  }
}

/**
 * Chapter screen. `title` defaults to the T0 chapter; era advances reuse the
 * same screen, text and voice with only the header changed (owner decision,
 * 2026-08-28 — per-era text/art/voice arrive later).
 */
export function showIntro(title = 'Hello World!', onClose?: () => void): void {
  // The old-book face (IM Fell English) is loaded up front by index.html
  // together with Inter, so the chapter never opens on the Palatino fallback
  // while the webfont is still on its way (owner report, 2026-08-28: header,
  // flowing text and buttons looked like different fonts — that was the
  // fallback rendering on a slow font fetch).

  // Keyframes: fire glow, image breathing, per-ember wandering paths.
  let emberFrames = '';
  const emberSpecs: { left: number; top: number; dur: number }[] = [];
  for (let i = 0; i < 7; i++) {
    // Sparks are born in a tight VERTICAL column just right of the flames
    // (owner: group starts 1% right, 3% down) and wander upward on their own
    // crooked paths, invisible until the animation carries them.
    emberSpecs.push({ left: 51 + Math.random() * 2, top: 67 + Math.random() * 6, dur: 3 + Math.random() * 2.5 });
    const w = () => (Math.random() * 36 - 18).toFixed(0);
    emberFrames += `
    @keyframes intro-ember-${i} {
      0% { transform: translate(0, 0) scale(1); opacity: 0; }
      10% { opacity: 0.9; }
      30% { transform: translate(calc(var(--u) * ${w()}), calc(var(--u) * -42)) scale(0.8); opacity: 0.85; }
      60% { transform: translate(calc(var(--u) * ${w()}), calc(var(--u) * -82)) scale(0.5); opacity: 0.7; }
      100% { transform: translate(calc(var(--u) * ${w()}), calc(var(--u) * -126)) scale(0.15); opacity: 0; }
    }`;
  }
  const style = document.createElement('style');
  style.textContent = `
    @keyframes intro-fire-glow {
      0% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
      18% { opacity: 0.85; transform: translate(-50%, -52%) scale(1.12); }
      37% { opacity: 0.6; transform: translate(-51%, -49%) scale(0.95); }
      54% { opacity: 0.95; transform: translate(-49%, -53%) scale(1.18); }
      71% { opacity: 0.65; transform: translate(-50%, -50%) scale(1.02); }
      86% { opacity: 0.9; transform: translate(-51%, -52%) scale(1.1); }
      100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes intro-image-breathe {
      0% { filter: brightness(1); }
      23% { filter: brightness(1.07); }
      41% { filter: brightness(0.97); }
      66% { filter: brightness(1.1); }
      84% { filter: brightness(1.02); }
      100% { filter: brightness(1); }
    }
    ${emberFrames}
    .intro-btn {
      font-family: ${FONT}; font-size: calc(var(--u) * 14); letter-spacing: 0.12em;
      color: #d8b872; cursor: pointer;
      padding: calc(var(--u) * 6) calc(var(--u) * 26);
      background: linear-gradient(#2a2013, #14100a);
      border: 1px solid #8a6d3b; border-radius: calc(var(--u) * 3);
      box-shadow: inset 0 0 calc(var(--u) * 8) rgba(216, 184, 114, 0.15);
      transition: box-shadow 0.25s, color 0.25s;
    }
    .intro-btn:hover:not(:disabled) {
      color: #f4dda2;
      box-shadow: inset 0 0 calc(var(--u) * 14) rgba(216, 184, 114, 0.35), 0 0 calc(var(--u) * 10) rgba(216, 184, 114, 0.25);
    }
    .intro-btn:disabled {
      color: #5a4d33; border-color: #3a2f1c; cursor: default; box-shadow: none;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:60;background:rgba(4,5,7,0.9);' +
    'display:flex;align-items:center;justify-content:center;';

  // Historic frame: a dark panel wrapped in a double gilt border with
  // corner brackets, like the plate of an old illuminated book.
  const panel = document.createElement('div');
  panel.style.cssText =
    'width:min(calc(var(--u) * 720), 94vw);max-height:96vh;' +
    'background:#0d0b09;border:1px solid #8a6d3b;border-radius:calc(var(--u) * 4);' +
    'padding:calc(var(--u) * 7);box-shadow:0 0 calc(var(--u) * 70) rgba(0,0,0,0.95);';
  const frame = document.createElement('div');
  frame.style.cssText =
    'position:relative;display:flex;flex-direction:column;overflow:hidden;' +
    'border:3px double #8a6d3b;border-radius:calc(var(--u) * 3);background:#0d0b09;';
  for (const [h, v] of [['left', 'top'], ['right', 'top'], ['left', 'bottom'], ['right', 'bottom']]) {
    const corner = document.createElement('div');
    corner.style.cssText =
      `position:absolute;${h}:calc(var(--u) * 3);${v}:calc(var(--u) * 3);z-index:3;` +
      `width:calc(var(--u) * 16);height:calc(var(--u) * 16);pointer-events:none;` +
      `border-${v}:2px solid #b8944f;border-${h}:2px solid #b8944f;` +
      `border-${v}-${h}-radius:calc(var(--u) * 4);`;
    frame.appendChild(corner);
  }

  const bar = document.createElement('div');
  bar.style.cssText =
    'text-align:center;padding:calc(var(--u) * 9) calc(var(--u) * 12);color:#d8b872;' +
    `font-family:${FONT};font-size:calc(var(--u) * 19);letter-spacing:0.22em;` +
    'border-bottom:1px solid #4a3d24;background:#151009;';
  bar.innerHTML = `<span style="color:#8a6d3b">❦&nbsp;&nbsp;</span>${title}<span style="color:#8a6d3b">&nbsp;&nbsp;❦</span>`;

  // The picture with a LIVING fire.
  const stage = document.createElement('div');
  stage.style.cssText = 'position:relative;overflow:hidden;';
  const img = document.createElement('img');
  img.src = `${import.meta.env.BASE_URL}intro/cavemen.jpg`;
  img.alt = '';
  img.style.cssText = 'width:100%;display:block;animation:intro-image-breathe 3.7s infinite;';
  const glow = document.createElement('div');
  glow.style.cssText =
    'position:absolute;left:52%;top:76%;width:22%;height:32%;border-radius:50%;' +
    'transform:translate(-50%,-50%);pointer-events:none;mix-blend-mode:screen;' +
    'background:radial-gradient(closest-side, rgba(255,120,40,0.85), rgba(230,70,20,0.4) 55%, transparent 78%);' +
    'animation:intro-fire-glow 1.9s infinite;';
  stage.append(img, glow);
  // Firelight on the cave walls: centers ON the edges/corners, slow, each on
  // its own rhythm; extra pairs on top and bottom between center and corners.
  const wallGlows: [string, string, string, string, number, number][] = [
    // left, top, width, height, duration s, delay s
    ['0%', '48%', '26%', '52%', 4.6, -0.9],
    ['100%', '44%', '28%', '56%', 4.1, -1.6],
    ['50%', '0%', '60%', '26%', 5.3, -0.4],
    ['46%', '100%', '70%', '22%', 4.4, -2.1],
    ['0%', '0%', '26%', '30%', 5.1, -1.2],
    ['100%', '0%', '28%', '28%', 4.0, -0.5],
    ['0%', '100%', '30%', '26%', 4.8, -1.9],
    ['100%', '100%', '26%', '30%', 3.8, -2.6],
    ['25%', '0%', '30%', '22%', 4.9, -3.0],
    ['75%', '0%', '30%', '22%', 4.3, -1.4],
    ['25%', '100%', '32%', '22%', 5.5, -0.7],
    ['75%', '100%', '32%', '22%', 4.2, -2.3],
  ];
  for (const [left, top, w, h, dur, delay] of wallGlows) {
    const wall = document.createElement('div');
    wall.style.cssText =
      `position:absolute;left:${left};top:${top};width:${w};height:${h};border-radius:50%;` +
      'transform:translate(-50%,-50%);pointer-events:none;mix-blend-mode:screen;' +
      'background:radial-gradient(closest-side, rgba(235,90,30,0.28), rgba(200,60,15,0.14) 55%, transparent 80%);' +
      `animation:intro-fire-glow ${dur}s infinite;animation-delay:${delay}s;`;
    stage.appendChild(wall);
  }
  emberSpecs.forEach((s, i) => {
    const ember = document.createElement('div');
    ember.style.cssText =
      `position:absolute;left:${s.left.toFixed(1)}%;top:${s.top.toFixed(1)}%;` +
      'width:calc(var(--u) * 3);height:calc(var(--u) * 3);opacity:0;' +
      'border-radius:50%;background:#ffb347;pointer-events:none;mix-blend-mode:screen;' +
      `animation:intro-ember-${i} ${s.dur.toFixed(2)}s linear ${(-Math.random() * s.dur).toFixed(2)}s infinite;`;
    stage.appendChild(ember);
  });

  // An ornamental rule parts the picture from the tale.
  const divider = document.createElement('div');
  divider.style.cssText =
    'display:flex;align-items:center;gap:calc(var(--u) * 10);' +
    'padding:calc(var(--u) * 7) calc(var(--u) * 24) calc(var(--u) * 2);color:#8a6d3b;';
  const line = 'flex:1;height:1px;background:linear-gradient(90deg, transparent, #8a6d3b, transparent);';
  divider.innerHTML =
    `<div style="${line}"></div><span style="font-size:calc(var(--u) * 12)">❖</span><div style="${line}"></div>`;

  // The narration rises from beneath the window like closing credits.
  const textBox = document.createElement('div');
  textBox.style.cssText =
    'height:calc(var(--u) * 150);overflow:hidden;position:relative;' +
    'padding:0 calc(var(--u) * 24);color:#d8b872;' +
    `font-family:${FONT};font-size:calc(var(--u) * 14);line-height:1.7;` +
    '-webkit-mask-image:linear-gradient(transparent, black 12%, black 88%, transparent);' +
    'mask-image:linear-gradient(transparent, black 12%, black 88%, transparent);';
  const crawl = document.createElement('div');
  crawl.innerHTML = PARAGRAPHS.map((t) => `<p style="margin:0 0 calc(var(--u) * 11) 0">${t}</p>`).join('');
  crawl.style.cssText = 'will-change:transform;';
  textBox.appendChild(crawl);

  // Historic buttons at the foot of the plate.
  const foot = document.createElement('div');
  foot.style.cssText =
    'display:flex;justify-content:center;gap:calc(var(--u) * 16);' +
    'padding:calc(var(--u) * 9) 0 calc(var(--u) * 12);border-top:1px solid #4a3d24;background:#151009;';
  // Both buttons sleep until the tale actually starts (owner rule, s62).
  const replayBtn = document.createElement('button');
  replayBtn.className = 'intro-btn';
  replayBtn.textContent = '⟲ Replay';
  replayBtn.disabled = true;
  const continueBtn = document.createElement('button');
  continueBtn.className = 'intro-btn';
  continueBtn.textContent = 'Skip ≫';
  continueBtn.disabled = true;
  foot.append(replayBtn, continueBtn);

  frame.append(bar, stage, divider, textBox, foot);
  panel.appendChild(frame);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Waiting prompt, shown in the middle of the text field until the tale may
  // begin (owner rule, s61) — only when the browser demands a gesture first.
  const pressKey = document.createElement('div');
  pressKey.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
    `color:#9a8558;font-family:${FONT};font-style:italic;background:#0d0b09;`;
  pressKey.textContent = 'Press any key to play…';

  const audio = new Audio(`${import.meta.env.BASE_URL}intro/hello-world-jessica.mp3`);
  const crackle = new FireCrackle();
  let raf = 0;
  let voiceTimer = 0;
  let flowTimer = 0;

  // The text begins its climb ONE second in (owner rule, s61) and is paced so
  // the last sentences still slip out the top a while after the voice ends.
  const startFlow = () => {
    cancelAnimationFrame(raf);
    const voiceDur = isFinite(audio.duration) && audio.duration > 10 ? audio.duration : 95;
    const duration = voiceDur + FLOW_EXTRA_SECONDS + VOICE_DELAY_MS / 1000 - 1;
    const boxH = textBox.clientHeight;
    const total = boxH + crawl.offsetHeight;
    const t0 = performance.now();
    const scroll = () => {
      const t = (performance.now() - t0) / 1000;
      const y = boxH - Math.min(1, t / duration) * total;
      crawl.style.transform = `translateY(${y}px)`;
      if (t < duration) raf = requestAnimationFrame(scroll);
    };
    raf = requestAnimationFrame(scroll);
  };

  const beginTale = () => {
    // Owner rule: the fire is heard first, the text starts climbing after a
    // second, and the narrator joins a few beats later.
    pressKey.remove();
    replayBtn.disabled = false;
    continueBtn.disabled = false;
    crackle.start();
    crawl.style.transform = `translateY(${textBox.clientHeight}px)`;
    flowTimer = window.setTimeout(startFlow, 1000);
    voiceTimer = window.setTimeout(() => {
      void audio.play().catch(() => undefined);
    }, VOICE_DELAY_MS);
  };

  const begin = () => {
    // The tale only starts once the browser will actually let sound play —
    // otherwise text scrolled silently after an F5 while the audio sat
    // blocked (owner bug, s49). Probe with the media element: if it may
    // play, run the sequence now; if not, the WHOLE sequence (fire, voice,
    // text together) waits for the first input of any kind.
    crawl.style.transform = `translateY(${textBox.clientHeight}px)`;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        beginTale();
      })
      .catch(() => {
        textBox.appendChild(pressKey);
        const unlock = () => {
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
          beginTale();
        };
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', unlock);
      });
  };

  const close = () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(voiceTimer);
    window.clearTimeout(flowTimer);
    audio.pause();
    crackle.stop();
    overlay.remove();
    style.remove();
    // Owner rule (s49): the music belongs to the game, not the chapter —
    // spring begins once the book is closed.
    gameMusic.start();
    onClose?.();
  };
  continueBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  replayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.clearTimeout(voiceTimer);
    window.clearTimeout(flowTimer);
    cancelAnimationFrame(raf);
    audio.pause();
    audio.currentTime = 0;
    crawl.style.transform = `translateY(${textBox.clientHeight}px)`;
    crackle.start(); // no-op if already burning
    flowTimer = window.setTimeout(startFlow, 1000);
    voiceTimer = window.setTimeout(() => void audio.play(), VOICE_DELAY_MS);
  });
  // When the narrator finishes, the fire keeps burning and the screen stays
  // until the player chooses to Continue.

  begin();
}
