import { MAP_SIZE } from '../world/terrain';
import { TileType, type TileMap } from '../world/tiles';

/**
 * Wild game (owner rules, session 25): three species.
 *  - Deer packs (4-6) anchored where forest meets water: 4 meat + 4 hides.
 *  - Boar packs — LARGER than deer packs (7-11): 2 meat + 2 hides.
 *  - Rabbits: small groups spawning near forests frequently, up to a cap:
 *    1 meat + 1 fur.
 * Deer and boar packs include young that yield half meat/hide; young mature
 * after two seasons.
 */

export type Species = 'deer' | 'boar' | 'rabbit';

export interface SpeciesDef {
  meat: number;
  hide: number;
  hideKind: 'hides' | 'fur';
  speed: number;
  packMin: number;
  packMax: number;
  cap: number;
  /** Share of newly spawned pack members that are young (0 = none). */
  youngShare: number;
  startPacks: number;
}

export const SPECIES: Record<Species, SpeciesDef> = {
  deer: { meat: 4, hide: 4, hideKind: 'hides', speed: 1.1, packMin: 4, packMax: 6, cap: 120, youngShare: 0.3, startPacks: 10 },
  boar: { meat: 2, hide: 2, hideKind: 'hides', speed: 1.0, packMin: 7, packMax: 11, cap: 100, youngShare: 0.3, startPacks: 6 },
  rabbit: { meat: 1, hide: 1, hideKind: 'fur', speed: 1.6, packMin: 2, packMax: 3, cap: 80, youngShare: 0, startPacks: 8 },
};

const PACK_RADIUS = 9; // animals graze around their pack anchor
const YOUNG_MATURE_SECONDS = 600; // two seasons
const RABBIT_SPAWN_INTERVAL = 12; // owner: rabbits appear frequently

export class Animal {
  alive = true;
  prevX: number;
  prevZ: number;
  /** Young yield half meat/hide until they mature. */
  young: boolean;
  private matureTimer: number;
  private targetX: number;
  private targetZ: number;
  private restTimer = Math.random() * 4;

  constructor(
    readonly species: Species,
    public x: number,
    public z: number,
    /** Pack anchor — wandering stays near it. */
    readonly anchorX: number,
    readonly anchorZ: number,
    young = false,
  ) {
    this.prevX = x;
    this.prevZ = z;
    this.targetX = x;
    this.targetZ = z;
    this.young = young;
    this.matureTimer = young ? YOUNG_MATURE_SECONDS * (0.5 + Math.random() * 0.5) : 0;
  }

  tick(dt: number, tiles: TileMap): void {
    this.prevX = this.x;
    this.prevZ = this.z;
    if (this.young) {
      this.matureTimer -= dt;
      if (this.matureTimer <= 0) this.young = false;
    }
    const dx = this.targetX - this.x;
    const dz = this.targetZ - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) {
      this.restTimer -= dt;
      if (this.restTimer <= 0) {
        this.restTimer = 1 + Math.random() * 5;
        const radius = this.species === 'rabbit' ? PACK_RADIUS * 0.6 : PACK_RADIUS;
        for (let attempt = 0; attempt < 6; attempt++) {
          const nx = this.anchorX + (Math.random() - 0.5) * 2 * radius;
          const nz = this.anchorZ + (Math.random() - 0.5) * 2 * radius;
          if (nx < 1 || nz < 1 || nx >= MAP_SIZE - 1 || nz >= MAP_SIZE - 1) continue;
          const t = tiles.types[Math.floor(nz) * MAP_SIZE + Math.floor(nx)];
          if (t === TileType.Water || t === TileType.Rock || t === TileType.Snow) continue;
          this.targetX = nx;
          this.targetZ = nz;
          break;
        }
      }
    } else {
      const step = Math.min(SPECIES[this.species].speed * dt, dist);
      this.x += (dx / dist) * step;
      this.z += (dz / dist) * step;
    }
  }

  get moving(): boolean {
    return Math.hypot(this.targetX - this.x, this.targetZ - this.z) >= 0.1;
  }
}

/** Legacy alias — hunters used to chase only deer. */
export type Deer = Animal;

export class AnimalSystem {
  /** ALL wildlife (deer, boar, rabbits) — name kept from the deer-only era. */
  readonly deer: Animal[] = [];
  /** Good habitat: forest tiles near water (deer/boar); any forest for rabbits. */
  private habitat: number[] = [];
  private forestTiles: number[] = [];
  private rabbitTimer = 0;

  constructor(private readonly tiles: TileMap, seed: number) {
    for (let i = 0; i < tiles.types.length; i++) {
      if (tiles.types[i] === TileType.Forest) {
        this.forestTiles.push(i);
        if (tiles.distToWater[i] <= 25) this.habitat.push(i);
      }
    }
    if (this.habitat.length === 0) this.habitat = this.forestTiles;
    let s = seed >>> 0;
    const rand = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (const species of Object.keys(SPECIES) as Species[]) {
      for (let p = 0; p < SPECIES[species].startPacks; p++) this.spawnPack(species, rand);
    }
  }

  count(species: Species): number {
    let n = 0;
    for (const a of this.deer) {
      if (a.alive && a.species === species) n++;
    }
    return n;
  }

  private spawnPack(species: Species, rand: () => number = Math.random): void {
    const def = SPECIES[species];
    const pool = species === 'rabbit' ? this.forestTiles : this.habitat;
    if (pool.length === 0) return;
    const tile = pool[Math.floor(rand() * pool.length)];
    const ax = (tile % MAP_SIZE) + 0.5;
    const az = ((tile / MAP_SIZE) | 0) + 0.5;
    const size = def.packMin + Math.floor(rand() * (def.packMax - def.packMin + 1));
    for (let i = 0; i < size; i++) {
      const young = rand() < def.youngShare;
      this.deer.push(new Animal(species, ax + rand() * 4 - 2, az + rand() * 4 - 2, ax, az, young));
    }
  }

  tick(dt: number): void {
    for (const a of this.deer) {
      if (a.alive) a.tick(dt, this.tiles);
    }
    // Rabbits breed like… rabbits: frequent small spawns near forest (owner rule).
    this.rabbitTimer += dt;
    if (this.rabbitTimer >= RABBIT_SPAWN_INTERVAL) {
      this.rabbitTimer = 0;
      if (this.count('rabbit') < SPECIES.rabbit.cap) this.spawnPack('rabbit');
    }
  }

  /** Each season: fresh deer/boar packs while below their caps + a few births. */
  reproduce(): void {
    for (let i = this.deer.length - 1; i >= 0; i--) {
      if (!this.deer[i].alive) this.deer.splice(i, 1);
    }
    for (const species of ['deer', 'boar'] as Species[]) {
      if (this.count(species) < SPECIES[species].cap) this.spawnPack(species);
      // Established packs also grow a little — the newborns are young.
      const alive = this.deer.filter((a) => a.alive && a.species === species);
      const births = Math.min(SPECIES[species].cap - alive.length, Math.round(alive.length * 0.05));
      for (let i = 0; i < births && alive.length > 0; i++) {
        const parent = alive[Math.floor(Math.random() * alive.length)];
        this.deer.push(new Animal(species, parent.x, parent.z, parent.anchorX, parent.anchorZ, true));
      }
    }
  }

  /** Exact wildlife restore (owner rule, session 38): every animal comes back
   *  at its saved spot with its pack anchor — no regeneration on load. */
  restoreExact(list: { sp: Species; x: number; z: number; ax: number; az: number; young: boolean }[]): void {
    this.deer.length = 0;
    for (const a of list) {
      if (!SPECIES[a.sp]) continue;
      this.deer.push(new Animal(a.sp, a.x, a.z, a.ax, a.az, a.young));
    }
  }

  /** Restore a species' population from a save (packs re-seeded in habitat).
   *  Legacy path for saves that only stored head counts. */
  setPopulation(species: Species, n: number): void {
    const trim = () => {
      for (let i = this.deer.length - 1; i >= 0 && this.count(species) > n; i--) {
        if (this.deer[i].species === species) this.deer.splice(i, 1);
      }
    };
    trim();
    let guard = 200;
    while (this.count(species) < n && guard-- > 0) this.spawnPack(species);
    trim();
  }

  nearest(x: number, z: number, maxDist = 120): Animal | null {
    let best: Animal | null = null;
    let bestD = maxDist * maxDist;
    for (const a of this.deer) {
      if (!a.alive) continue;
      const dd = (a.x - x) ** 2 + (a.z - z) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = a;
      }
    }
    return best;
  }
}
