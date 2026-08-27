import { MAP_SIZE } from '../world/terrain';
import { TileType } from '../world/tiles';
import type { World } from '../world/worldScene';
import type { ResourceKind, Village } from './village';
import type { Calendar, Season } from './calendar';
import type { Events } from '../ui/Events';

/**
 * The four tribes at the map edges. Each has a personality, a camp, and a
 * relation score the player's actions move. Trade runs through caravans the
 * player dispatches from a trading post — barter rates depend on what the
 * tribe needs, what it has plenty of, and how much it likes you.
 * War comes in a later phase; relations groundwork lives here.
 */

export type TribeSide = 'north' | 'east' | 'south' | 'west';
export type Personality = 'merchant' | 'proud' | 'fierce' | 'reclusive';

const PERSONALITY_META: Record<Personality, { label: string; baseline: number; icon: string }> = {
  merchant: { label: 'Merchant', baseline: 30, icon: '🪙' },
  proud: { label: 'Proud', baseline: 10, icon: '🪶' },
  fierce: { label: 'Fierce', baseline: -20, icon: '⚔️' },
  reclusive: { label: 'Reclusive', baseline: 0, icon: '🌫️' },
};

/** Barter values per unit. */
export const TRADE_VALUES: Partial<Record<ResourceKind, number>> = {
  wood: 1, stone: 1.5, straw: 0.8, clayTiles: 3,
  berries: 1, mushrooms: 1.2, roots: 1, meat: 1.4, fish: 1.2, firewood: 1.3, clay: 1, brick: 3,
  seeds: 2, wheat: 1.1, rye: 1.1, oat: 1, barley: 1,
  potatoes: 1, tomatoes: 1.2, peppers: 1.5, strawberries: 1.5, carrots: 1, melons: 1.3, watermelons: 1.3,
  flour: 2, bread: 2.5, animalFeed: 1,
  hides: 2.5, herbs: 1.5, medicine: 4, woodenTools: 3, stoneTools: 5,
  fur: 2, string: 1.5, linen: 3, leather: 3.5, clothes: 6, fineClothes: 10, luxuryClothes: 18, pottery: 3,
  sandals: 1.5, hideShoes: 3, boots: 5, luxuryBoots: 8,
  copperOre: 2, tinOre: 2.2, ironOre: 2.5, coal: 1.8,
  bronzeBar: 8, ironBar: 10, bronzeTools: 9, ironTools: 12,
  spears: 4, bronzeWeapons: 9, ironWeapons: 12, leatherArmor: 6,
};
export const TRADE_GOODS = Object.keys(TRADE_VALUES) as ResourceKind[];

const NAME_A = ['Var', 'Osk', 'Tur', 'Bral', 'Kel', 'Dra', 'Mor', 'Hesk'];
const NAME_B = ['drin', 'arn', 'mak', 'vory', 'gard', 'nick', 'sla', 'heim'];

function hash(i: number, seed: number): number {
  let h = (seed | 0) ^ Math.imul(i | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Tribe {
  relation: number;
  /** Subdued by a successful attack: never raids, trades at good will. */
  defeated = false;

  constructor(
    readonly name: string,
    readonly side: TribeSide,
    readonly personality: Personality,
    readonly x: number,
    readonly z: number,
    readonly color: number,
    readonly sells: ResourceKind[],
    readonly needs: ResourceKind[],
  ) {
    this.relation = PERSONALITY_META[personality].baseline;
  }

  get personaLabel(): string {
    const m = PERSONALITY_META[this.personality];
    return `${m.icon} ${m.label}`;
  }

  shiftRelation(delta: number): void {
    this.relation = Math.max(-100, Math.min(100, this.relation + delta));
  }
}

export type CaravanState = 'outbound' | 'trading' | 'returning';

export class Caravan {
  state: CaravanState = 'outbound';
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  private waypoints: { x: number; z: number }[] = [];
  private timer = 0;
  received = 0;

  constructor(
    readonly tribe: Tribe,
    readonly give: { kind: ResourceKind; amount: number },
    readonly receiveKind: ResourceKind | null, // null = gift
    private readonly outPath: number[],
  ) {
    this.setPath(outPath);
    const first = this.waypoints[0] ?? { x: 0, z: 0 };
    this.x = first.x;
    this.z = first.z;
    this.prevX = this.x;
    this.prevZ = this.z;
  }

  private setPath(path: number[]): void {
    this.waypoints = path.map((i) => ({ x: (i % MAP_SIZE) + 0.5, z: ((i / MAP_SIZE) | 0) + 0.5 }));
  }

  get moving(): boolean {
    return this.waypoints.length > 0;
  }

  /** Returns true when the caravan is finished (arrived home). */
  tick(dt: number, system: TradeSystem): boolean {
    this.prevX = this.x;
    this.prevZ = this.z;
    const SPEED = 3.2;
    if (this.state === 'trading') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'returning';
        this.setPath([...this.outPath].reverse());
      }
      return false;
    }
    let budget = SPEED * dt;
    while (budget > 0 && this.waypoints.length > 0) {
      const wp = this.waypoints[0];
      const dx = wp.x - this.x;
      const dz = wp.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= budget) {
        this.x = wp.x;
        this.z = wp.z;
        budget -= dist;
        this.waypoints.shift();
      } else {
        this.x += (dx / dist) * budget;
        this.z += (dz / dist) * budget;
        budget = 0;
      }
    }
    if (this.waypoints.length === 0) {
      if (this.state === 'outbound') {
        this.state = 'trading';
        this.timer = 8;
        system.resolveTrade(this);
        return false;
      }
      return true; // returned home
    }
    return false;
  }
}

export class TradeSystem {
  readonly tribes: Tribe[] = [];
  readonly caravans: Caravan[] = [];
  private lastSeason: Season | null = null;

  constructor(
    world: World,
    private readonly village: Village,
    private readonly calendar: Calendar,
    private readonly events: Events,
    seed: number,
  ) {
    const personalities: Personality[] = ['merchant', 'proud', 'fierce', 'reclusive'];
    // Seeded shuffle of personalities across sides.
    for (let i = personalities.length - 1; i > 0; i--) {
      const j = Math.floor(hash(i, seed) * (i + 1));
      [personalities[i], personalities[j]] = [personalities[j], personalities[i]];
    }
    const sides: TribeSide[] = ['north', 'east', 'south', 'west'];
    const colors = [0xc0503c, 0x3f6db0, 0xc9a227, 0x6a4a8c];
    sides.forEach((side, i) => {
      const spot = this.findCampSpot(world, side, seed + i * 977);
      const name = NAME_A[Math.floor(hash(i * 3 + 1, seed) * NAME_A.length)] +
        NAME_B[Math.floor(hash(i * 3 + 2, seed) * NAME_B.length)];
      // Two goods they sell cheap, two they pay well for (distinct).
      const pool = [...TRADE_GOODS];
      const pick = (): ResourceKind => pool.splice(Math.floor(hash(pool.length + i * 17, seed ^ 0x7ab) * pool.length), 1)[0];
      const sells = [pick(), pick()];
      const needs = [pick(), pick()];
      this.tribes.push(new Tribe(name, side, personalities[i], spot.x, spot.z, colors[i], sells, needs));
    });
  }

  private findCampSpot(world: World, side: TribeSide, seed: number): { x: number; z: number } {
    const M = MAP_SIZE;
    for (let attempt = 0; attempt < 300; attempt++) {
      const along = 40 + Math.floor(hash(attempt, seed) * (M - 80));
      const depth = 8 + Math.floor(hash(attempt * 7 + 1, seed) * 14);
      const x = side === 'west' ? depth : side === 'east' ? M - depth : along;
      const z = side === 'north' ? depth : side === 'south' ? M - depth : along;
      let ok = true;
      for (let dz = -3; dz <= 3 && ok; dz++) {
        for (let dx = -3; dx <= 3 && ok; dx++) {
          const t = world.tiles.types[(z + dz) * M + (x + dx)];
          if (t === TileType.Water || t === TileType.Rock || t === TileType.Snow) ok = false;
        }
      }
      if (ok) return { x: x + 0.5, z: z + 0.5 };
    }
    // Fallback: mid-edge regardless of terrain.
    return side === 'north' ? { x: M / 2, z: 10 } : side === 'south' ? { x: M / 2, z: M - 10 }
      : side === 'west' ? { x: 10, z: M / 2 } : { x: M - 10, z: M / 2 };
  }

  /** Barter estimate: how much `receive` the tribe would give for the offer. */
  estimate(tribe: Tribe, give: ResourceKind, amount: number, receive: ResourceKind): number {
    let value = (TRADE_VALUES[give] ?? 1) * amount;
    if (tribe.needs.includes(give)) value *= 1.5;
    if (tribe.sells.includes(give)) value *= 0.6;
    value *= 0.7 + ((tribe.relation + 100) / 200) * 0.5; // 0.7 .. 1.2
    let unit = TRADE_VALUES[receive] ?? 1;
    if (tribe.sells.includes(receive)) unit *= 0.75;
    if (tribe.needs.includes(receive)) unit *= 1.6;
    return Math.floor(value / unit);
  }

  /** Dispatch a caravan. Returns an error string or null on success. */
  sendCaravan(tribe: Tribe, give: ResourceKind, amount: number, receive: ResourceKind | null): string | null {
    const post = this.village.tradingPostTile();
    if (post === null) return 'Build a trading post first.';
    if (amount <= 0 || this.village.resources[give] < amount) return 'Not enough goods in store.';
    const goal = Math.floor(tribe.z) * MAP_SIZE + Math.floor(tribe.x);
    const path = this.village.findPathTiles(post, goal);
    if (!path) return 'No route to this tribe.';
    this.village.resources[give] -= amount;
    this.caravans.push(new Caravan(tribe, { kind: give, amount }, receive, path));
    this.events.push(`🐂 Caravan departed for ${tribe.name} (${amount} ${give}).`);
    return null;
  }

  /** Called when a caravan reaches the tribe. */
  resolveTrade(c: Caravan): void {
    if (c.receiveKind === null) {
      const value = (TRADE_VALUES[c.give.kind] ?? 1) * c.give.amount;
      const delta = Math.max(1, Math.round(value / 8));
      c.tribe.shiftRelation(delta);
      this.events.push(`🎁 ${c.tribe.name} accepts your gift (+${delta} relations).`);
    } else {
      c.received = this.estimate(c.tribe, c.give.kind, c.give.amount, c.receiveKind);
      c.tribe.shiftRelation(2);
      this.events.push(`🤝 Traded with ${c.tribe.name}: ${c.received} ${c.receiveKind} coming home.`);
    }
  }

  tick(dt: number): void {
    // Seasonal relation drift toward each tribe's temperament.
    const season = this.calendar.season;
    if (season !== this.lastSeason) {
      if (this.lastSeason !== null) {
        for (const t of this.tribes) {
          if (t.defeated) continue; // the subdued hold no grudges — or hopes
          const base = PERSONALITY_META[t.personality].baseline;
          if (t.relation > base) t.shiftRelation(-2);
          else if (t.relation < base) t.shiftRelation(2);
        }
      }
      this.lastSeason = season;
    }

    for (let i = this.caravans.length - 1; i >= 0; i--) {
      const c = this.caravans[i];
      if (c.tick(dt, this)) {
        if (c.receiveKind && c.received > 0) this.village.deposit(c.receiveKind, c.received);
        this.events.push(`🏠 Caravan returned from ${c.tribe.name}.`);
        this.caravans.splice(i, 1);
      }
    }
  }
}
