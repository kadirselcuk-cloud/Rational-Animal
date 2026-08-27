import { MAP_SIZE } from '../world/terrain';
import type { Village, Villager, ResourceKind } from './village';
import type { TradeSystem, Tribe } from './tribes';
import type { Calendar, Season } from './calendar';
import type { Events } from '../ui/Events';

/**
 * War: hostile tribes raid your village (defended live on your map by your
 * soldiers' strength); you can send your soldiers to attack a tribe's camp
 * (marched there visibly, battle auto-resolved — the owner's chosen model).
 */

const RAID_RELATION_THRESHOLD = -25;
const RAID_TRIGGER_DIST = 14;
const FIGHT_SECONDS = 10;

interface Mover {
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
}

function makeWaypoints(path: number[]): { x: number; z: number }[] {
  return path.map((i) => ({ x: (i % MAP_SIZE) + 0.5, z: ((i / MAP_SIZE) | 0) + 0.5 }));
}

function walk(m: Mover, waypoints: { x: number; z: number }[], speed: number, dt: number): boolean {
  m.prevX = m.x;
  m.prevZ = m.z;
  let budget = speed * dt;
  while (budget > 0 && waypoints.length > 0) {
    const wp = waypoints[0];
    const dx = wp.x - m.x;
    const dz = wp.z - m.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= budget) {
      m.x = wp.x;
      m.z = wp.z;
      budget -= dist;
      waypoints.shift();
    } else {
      m.x += (dx / dist) * budget;
      m.z += (dz / dist) * budget;
      budget = 0;
    }
  }
  return waypoints.length === 0;
}

export class Raid implements Mover {
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  state: 'approach' | 'fight' = 'approach';
  fightTimer = FIGHT_SECONDS;
  private waypoints: { x: number; z: number }[];

  constructor(
    readonly tribe: Tribe,
    readonly size: number,
    path: number[],
  ) {
    this.waypoints = makeWaypoints(path);
    const first = this.waypoints[0] ?? { x: tribe.x, z: tribe.z };
    this.x = first.x;
    this.z = first.z;
    this.prevX = this.x;
    this.prevZ = this.z;
  }

  get strength(): number {
    return this.size * 1.5;
  }

  tick(dt: number, home: { x: number; z: number }): 'moving' | 'fighting' | 'resolve' {
    if (this.state === 'approach') {
      const done = walk(this, this.waypoints, 2.6, dt);
      if (done || Math.hypot(this.x - home.x, this.z - home.z) < RAID_TRIGGER_DIST) {
        this.state = 'fight';
        return 'fighting';
      }
      return 'moving';
    }
    this.prevX = this.x;
    this.prevZ = this.z;
    this.fightTimer -= dt;
    return this.fightTimer <= 0 ? 'resolve' : 'fighting';
  }
}

export class WarParty implements Mover {
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  state: 'outbound' | 'returning' = 'outbound';
  loot: Partial<Record<ResourceKind, number>> = {};
  private waypoints: { x: number; z: number }[];

  constructor(
    readonly tribe: Tribe,
    readonly soldiers: Villager[],
    private readonly outPath: number[],
  ) {
    this.waypoints = makeWaypoints(outPath);
    const first = this.waypoints[0] ?? { x: 0, z: 0 };
    this.x = first.x;
    this.z = first.z;
    this.prevX = this.x;
    this.prevZ = this.z;
  }

  startReturn(): void {
    this.state = 'returning';
    this.waypoints = makeWaypoints([...this.outPath].reverse());
  }

  tick(dt: number): boolean {
    return walk(this, this.waypoints, 2.6, dt);
  }
}

export class WarSystem {
  readonly raids: Raid[] = [];
  party: WarParty | null = null;
  private lastSeason: Season | null = null;

  constructor(
    private readonly village: Village,
    private readonly trade: TradeSystem,
    private readonly calendar: Calendar,
    private readonly events: Events,
  ) {}

  /** Strength you'd face attacking this tribe right now. */
  tribeStrength(tribe: Tribe): number {
    const base = tribe.personality === 'fierce' ? 16 : tribe.personality === 'proud' ? 13 : tribe.personality === 'reclusive' ? 10 : 8;
    return Math.round(base + this.calendar.year * 2);
  }

  /** March all soldiers on a tribe. Returns error text or null. */
  attackTribe(tribe: Tribe): string | null {
    if (this.party) return 'Your war party is already in the field.';
    if (tribe.defeated) return 'This tribe is already subdued.';
    const soldiers = this.village.soldiers();
    if (soldiers.length < 3) return 'You need at least 3 soldiers.';
    const home = this.village.rallyTile(); // the home tile sits under the stockpile now
    const goal = Math.floor(tribe.z) * MAP_SIZE + Math.floor(tribe.x);
    const path = this.village.findPathTiles(home, goal);
    if (!path) return 'No route to this tribe.';
    for (const s of soldiers) s.navigate(null, 'campaign');
    this.party = new WarParty(tribe, soldiers, path);
    tribe.shiftRelation(-40);
    this.events.push(`⚔️ ${soldiers.length} soldiers march on ${tribe.name}!`);
    return null;
  }

  tick(dt: number): void {
    this.maybeSpawnRaids();
    this.tickRaids(dt);
    this.tickParty(dt);
  }

  private maybeSpawnRaids(): void {
    const season = this.calendar.season;
    if (season === this.lastSeason) return;
    const first = this.lastSeason === null;
    this.lastSeason = season;
    if (first || this.calendar.year === 1) return; // grace period: year 1 is safe
    for (const tribe of this.trade.tribes) {
      if (tribe.defeated || tribe.relation > RAID_RELATION_THRESHOLD) continue;
      const chance = tribe.personality === 'fierce' ? 0.6 : 0.35;
      if (Math.random() > chance) continue;
      const size = 3 + Math.floor(this.calendar.year * 1.5) + (tribe.personality === 'fierce' ? 2 : 0);
      const start = Math.floor(tribe.z) * MAP_SIZE + Math.floor(tribe.x);
      const goal = this.village.rallyTile();
      const path = this.village.findPathTiles(start, goal);
      if (!path) {
        // Fully walled in: raiders can't reach the village and turn back angry.
        this.events.push(`🧱 Raiders from ${tribe.name} found no way through your walls and turned back!`);
        tribe.shiftRelation(-5);
        continue;
      }
      this.raids.push(new Raid(tribe, size, path));
      if (this.village.watchtowerCount() > 0) {
        this.events.push(`🗼 Watchtower warning: ${size} raiders from ${tribe.name} are on their way!`);
      }
    }
  }

  private tickRaids(dt: number): void {
    for (let i = this.raids.length - 1; i >= 0; i--) {
      const raid = this.raids[i];
      const prev = raid.state;
      const status = raid.tick(dt, this.village.home);
      if (status === 'fighting' && prev === 'approach') {
        this.events.push(`⚔️ ${raid.size} raiders from ${raid.tribe.name} attack the village!`);
      }
      if (status !== 'resolve') continue;
      this.raids.splice(i, 1);
      this.resolveRaid(raid);
    }
  }

  private resolveRaid(raid: Raid): void {
    const v = this.village;
    const defense = v.defenseStrength();
    const attack = raid.strength * (0.8 + Math.random() * 0.4);
    const soldiers = v.soldiers();
    if (defense >= attack) {
      // Victory — but battles cost blood.
      const lossChance = Math.min(0.4, attack / (defense * 3));
      let losses = 0;
      for (const s of soldiers) {
        if (Math.random() < lossChance) {
          s.dead = true;
          losses++;
        }
      }
      this.events.push(`🛡️ The raid from ${raid.tribe.name} was beaten back! ${losses > 0 ? `${losses} soldier(s) fell.` : 'No losses.'}`);
      raid.tribe.shiftRelation(-10);
    } else {
      // Defeat: losses and plunder.
      let losses = 0;
      for (const s of soldiers) {
        if (Math.random() < 0.5) {
          s.dead = true;
          losses++;
        }
      }
      let stolenFood = 0;
      for (const kind of ['berries', 'meat', 'fish', 'bread', 'potatoes'] as const) {
        const taken = Math.floor(v.resources[kind] * 0.3);
        v.resources[kind] -= taken;
        stolenFood += taken;
      }
      const stolenFirewood = Math.floor(v.resources.firewood * 0.2);
      v.resources.firewood -= stolenFirewood;
      this.events.push(`🔥 ${raid.tribe.name} raiders overran the village — ${losses} dead, ${stolenFood} food and ${stolenFirewood} firewood stolen!`);
    }
  }

  private tickParty(dt: number): void {
    const p = this.party;
    if (!p) return;
    const arrived = p.tick(dt);
    if (!arrived) return;

    if (p.state === 'outbound') {
      // Battle at the tribe's camp — auto-resolved (owner's model).
      const armyStr = p.soldiers.reduce((s, x) => s + x.combatStrength, 0);
      const tribeStr = this.tribeStrength(p.tribe) * (0.8 + Math.random() * 0.4);
      if (armyStr >= tribeStr) {
        p.tribe.defeated = true;
        p.tribe.relation = 50;
        p.loot = { meat: 15, berries: 10, hides: 6, stone: 10 };
        const lossChance = Math.min(0.35, tribeStr / (armyStr * 3));
        let losses = 0;
        for (const s of p.soldiers) {
          if (Math.random() < lossChance) {
            s.dead = true;
            losses++;
          }
        }
        this.events.push(`🏆 ${p.tribe.name} is subdued! ${losses} soldier(s) fell. The survivors return with plunder.`);
      } else {
        let losses = 0;
        for (const s of p.soldiers) {
          if (Math.random() < 0.6) {
            s.dead = true;
            losses++;
          }
        }
        p.tribe.shiftRelation(-20);
        this.events.push(`☠️ The attack on ${p.tribe.name} failed — ${losses} soldier(s) lost.`);
      }
      // Dead soldiers stay on the field; survivors march home.
      p.startReturn();
      return;
    }

    // Home again.
    for (const s of p.soldiers) {
      if (s.dead) continue;
      s.x = p.x;
      s.z = p.z;
      s.prevX = p.x;
      s.prevZ = p.z;
      s.goIdle();
    }
    for (const [kind, n] of Object.entries(p.loot)) {
      this.village.deposit(kind as ResourceKind, n ?? 0);
    }
    this.party = null;
  }
}
