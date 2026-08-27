/**
 * Game calendar: four seasons, harsh winter. One season is 5 real minutes at
 * 1x speed (20 min/year, per the owner's decision), split into 15 "days" for
 * flavor. Winter is the survival squeeze: no foraging, firewood burns.
 */

export const SEASON_SECONDS = 300;
export const DAYS_PER_SEASON = 15;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_META: Record<Season, { label: string; icon: string }> = {
  spring: { label: 'Spring', icon: '🌱' },
  summer: { label: 'Summer', icon: '☀️' },
  autumn: { label: 'Autumn', icon: '🍂' },
  winter: { label: 'Winter', icon: '❄️' },
};

export class Calendar {
  /** Total simulated seconds elapsed. Starts at early spring, year 1. */
  private elapsed = 0;

  tick(dt: number): void {
    this.elapsed += dt;
  }

  get elapsedSeconds(): number {
    return this.elapsed;
  }

  /** Restore from a save. */
  load(seconds: number): void {
    this.elapsed = seconds;
  }

  get season(): Season {
    return SEASONS[Math.floor(this.elapsed / SEASON_SECONDS) % 4];
  }

  /** 0..1 within the current season. */
  get seasonProgress(): number {
    return (this.elapsed % SEASON_SECONDS) / SEASON_SECONDS;
  }

  get dayOfSeason(): number {
    return Math.floor(this.seasonProgress * DAYS_PER_SEASON) + 1;
  }

  get year(): number {
    return Math.floor(this.elapsed / (SEASON_SECONDS * 4)) + 1;
  }

  get isWinter(): boolean {
    return this.season === 'winter';
  }

  /**
   * How much snow should cover the world right now (0..1): builds through the
   * first quarter of winter, melts through the first third of spring.
   */
  get snowTarget(): number {
    const s = this.season;
    const p = this.seasonProgress;
    if (s === 'winter') return Math.min(1, p / 0.25);
    if (s === 'spring') return Math.max(0, 1 - p / 0.33);
    return 0;
  }
}
