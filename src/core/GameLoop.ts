/**
 * Fixed-timestep simulation loop, decoupled from rendering.
 *
 * The simulation always advances in constant TICK_SECONDS steps so game logic
 * is deterministic regardless of frame rate. Speed controls (pause/1x/2x/4x)
 * scale how much simulated time accumulates per real second; rendering runs
 * every animation frame regardless.
 */

export const TICK_RATE = 10; // simulation ticks per second at 1x speed
export const TICK_SECONDS = 1 / TICK_RATE;

/** Cap so a background tab or hitch never triggers a spiral of catch-up ticks. */
const MAX_TICKS_PER_FRAME = 30;

export type SpeedSetting = 0 | 1 | 2 | 4;

export class GameLoop {
  speed: SpeedSetting = 1;
  /** Total simulation ticks since start (survives speed changes). */
  tickCount = 0;

  private accumulator = 0;
  private lastTime = 0;
  private rafHandle = 0;
  private lastSpeedBeforePause: SpeedSetting = 1;

  constructor(
    private readonly tick: (dt: number) => void,
    private readonly render: (frameDt: number) => void,
  ) {}

  start(): void {
    this.lastTime = performance.now();
    const frame = (now: number) => {
      this.rafHandle = requestAnimationFrame(frame);
      const frameDt = Math.min((now - this.lastTime) / 1000, 0.25);
      this.lastTime = now;

      this.accumulator += frameDt * this.speed;
      let ticksThisFrame = 0;
      while (this.accumulator >= TICK_SECONDS && ticksThisFrame < MAX_TICKS_PER_FRAME) {
        this.tick(TICK_SECONDS);
        this.tickCount++;
        this.accumulator -= TICK_SECONDS;
        ticksThisFrame++;
      }
      if (ticksThisFrame === MAX_TICKS_PER_FRAME) this.accumulator = 0;

      this.render(frameDt);
    };
    this.rafHandle = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.rafHandle);
  }

  /** Fraction [0,1) of the way to the next tick — for render interpolation. */
  getAlpha(): number {
    return Math.min(this.accumulator / TICK_SECONDS, 1);
  }

  setSpeed(speed: SpeedSetting): void {
    if (speed === 0 && this.speed !== 0) this.lastSpeedBeforePause = this.speed;
    this.speed = speed;
  }

  togglePause(): void {
    this.setSpeed(this.speed === 0 ? this.lastSpeedBeforePause : 0);
  }
}
