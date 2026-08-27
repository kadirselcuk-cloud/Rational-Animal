import { MAP_SIZE } from '../world/terrain';
import type { Villager } from './village';

/**
 * Buildings: placed as a site (land is cleared and flattened), supplied with
 * materials by builders, constructed, then functional. Footprints are w×d
 * tiles — many workplaces include a yard (woodcutting area, school garden).
 */

export type BuildingKind =
  | 'house' | 'stoneHouse' | 'brickHouse'
  | 'woodcutterLodge' | 'huntingLodge' | 'foresterHut'
  | 'fishingHut' | 'herbalistHut' | 'toolmaker' | 'storageShed'
  | 'school' | 'cropField' | 'clayPit' | 'brickOven' | 'tradingPost'
  | 'mine' | 'smelter' | 'trainingGround' | 'weaponsmith' | 'watchtower' | 'tailor'
  | 'barn' | 'bakery' | 'manor' | 'temple' | 'weaver' | 'pottery' | 'stockpile'
  | 'leatherworker' | 'cobbler';

export type BuildMaterial = 'wood' | 'stone' | 'straw' | 'brick' | 'clayTiles';
export const BUILD_MATERIALS: BuildMaterial[] = ['wood', 'stone', 'straw', 'brick', 'clayTiles'];

export interface BuildingSpec {
  kind: BuildingKind;
  label: string;
  /** Footprint in tiles: width (x) × depth (z). */
  w: number;
  d: number;
  cost: Partial<Record<BuildMaterial, number>>;
  buildSeconds: number;
  /** Residents for houses. */
  capacity: number;
  /** Worker slots the completed building provides for its profession. */
  workerSlots: number;
  needsWater: boolean;
  needsClay?: boolean;
  /** Must touch an ore deposit (mine). */
  needsOre?: boolean;
  desc: string;
}

export const BUILDING_SPECS: Record<BuildingKind, BuildingSpec> = {
  house: {
    kind: 'house', label: 'House', w: 2, d: 2, cost: { wood: 8, straw: 4 }, buildSeconds: 20,
    capacity: 4, workerSlots: 0, needsWater: false,
    desc: '4 beds under a thatched roof. Holds 10 firewood and 5 pots.',
  },
  stoneHouse: {
    kind: 'stoneHouse', label: 'Stone house', w: 2, d: 2, cost: { wood: 4, stone: 8 }, buildSeconds: 22,
    capacity: 6, workerSlots: 0, needsWater: false,
    desc: '6 beds; never burns. Uses 25% less firewood, holds 16 firewood and 8 pots.',
  },
  brickHouse: {
    kind: 'brickHouse', label: 'Brick house', w: 2, d: 2, cost: { wood: 4, brick: 12, clayTiles: 6 }, buildSeconds: 25,
    capacity: 8, workerSlots: 0, needsWater: false,
    desc: '8 beds under a clay-tile roof. Warmth lasts 1.5× per firewood; holds 20 firewood and 10 pots; fireproof.',
  },
  woodcutterLodge: {
    kind: 'woodcutterLodge', label: "Woodcutter's lodge", w: 4, d: 2, cost: { wood: 4, straw: 2 }, buildSeconds: 10,
    capacity: 0, workerSlots: 2, needsWater: false,
    desc: 'Log yard where firewood is split (2 wood → 4 firewood). Enables 2 firewood splitters.',
  },
  huntingLodge: {
    kind: 'huntingLodge', label: 'Hunting lodge', w: 4, d: 2, cost: { wood: 6, straw: 2 }, buildSeconds: 14,
    capacity: 0, workerSlots: 2, needsWater: false,
    desc: 'Drying racks and hunting gear. Enables 2 hunters (meat + hides).',
  },
  foresterHut: {
    kind: 'foresterHut', label: "Forester's hut", w: 4, d: 2, cost: { wood: 6, straw: 2 }, buildSeconds: 14,
    capacity: 0, workerSlots: 2, needsWater: false,
    desc: 'Foresters replant felled forest. Saplings mature in 2 years.',
  },
  fishingHut: {
    kind: 'fishingHut', label: 'Fishing hut', w: 4, d: 2, cost: { wood: 6, straw: 2 }, buildSeconds: 15,
    capacity: 0, workerSlots: 2, needsWater: true,
    desc: 'Must stand at the waterline. 2 fishers bring food in every season.',
  },
  herbalistHut: {
    kind: 'herbalistHut', label: 'Herbalist hut', w: 4, d: 2, cost: { wood: 6, straw: 2 }, buildSeconds: 15,
    capacity: 0, workerSlots: 1, needsWater: false,
    desc: 'The herbalist gathers forest herbs and prepares medicine.',
  },
  toolmaker: {
    kind: 'toolmaker', label: 'Workshop', w: 3, d: 2, cost: { wood: 8, straw: 2, stone: 2 }, buildSeconds: 18,
    capacity: 0, workerSlots: 1, needsWater: false,
    desc: 'Crafts stone tools (2 stone + 1 wood → 2) or wooden tools (2 wood → 2).',
  },
  storageShed: {
    kind: 'storageShed', label: 'Storage shed', w: 3, d: 2, cost: { wood: 10, straw: 4, stone: 2 }, buildSeconds: 15,
    capacity: 0, workerSlots: 0, needsWater: false,
    desc: 'Open-sided shelter holding 250 goods of its own. Villagers fetch goods from the storage that holds them.',
  },
  stockpile: {
    kind: 'stockpile', label: 'Camp stockpile', w: 3, d: 3, cost: {}, buildSeconds: 12,
    capacity: 0, workerSlots: 0, needsWater: false,
    desc: 'The founding stockpile (200 goods). Can be demolished once another storage stands — its goods are moved out first.',
  },
  school: {
    kind: 'school', label: 'School', w: 5, d: 5, cost: { wood: 8, brick: 8, clayTiles: 6 }, buildSeconds: 24,
    capacity: 0, workerSlots: 1, needsWater: false,
    desc: 'Brick schoolhouse under clay tiles, with a garden. Doubles knowledge output; children speed it further.',
  },
  cropField: {
    kind: 'cropField', label: 'Crop field', w: 5, d: 5, cost: { wood: 6 }, buildSeconds: 10,
    capacity: 0, workerSlots: 3, needsWater: false,
    desc: 'Sown in spring only; grows by itself over summer (+50% with a farmer tending); harvested in autumn — before the frost.',
  },
  clayPit: {
    kind: 'clayPit', label: 'Clay pit', w: 5, d: 3, cost: { wood: 6 }, buildSeconds: 12,
    capacity: 0, workerSlots: 2, needsWater: false, needsClay: true,
    desc: 'Must touch a clay deposit. 2 diggers extract clay for the brick oven.',
  },
  brickOven: {
    kind: 'brickOven', label: 'Brick oven', w: 4, d: 2, cost: { wood: 4, stone: 6 }, buildSeconds: 20,
    capacity: 0, workerSlots: 1, needsWater: false,
    desc: 'Fires 2 clay + 1 firewood into 3 bricks.',
  },
  tradingPost: {
    kind: 'tradingPost', label: 'Trading post', w: 3, d: 3, cost: { wood: 10, straw: 4, stone: 4 }, buildSeconds: 18,
    capacity: 0, workerSlots: 0, needsWater: false,
    desc: 'Caravans depart here to trade with the four tribes (🏕 Tribes window).',
  },
  mine: {
    kind: 'mine', label: 'Mine', w: 2, d: 3, cost: { wood: 8, stone: 4 }, buildSeconds: 22,
    capacity: 0, workerSlots: 2, needsWater: false, needsOre: true,
    desc: 'Must touch an ore deposit. 2 miners extract whatever the vein holds (copper, tin, iron, or coal).',
  },
  smelter: {
    kind: 'smelter', label: 'Smelter', w: 3, d: 2, cost: { wood: 4, stone: 8, brick: 4, clayTiles: 4 }, buildSeconds: 25,
    capacity: 0, workerSlots: 2, needsWater: false,
    desc: 'Bronze: 1 copper + 1 tin + 1 firewood → 1 bar. Iron (needs Iron working): 2 iron ore + 1 coal → 1 bar.',
  },
  trainingGround: {
    kind: 'trainingGround', label: 'Training ground', w: 4, d: 4, cost: { wood: 8 }, buildSeconds: 16,
    capacity: 0, workerSlots: 6, needsWater: false,
    desc: 'Villagers train as soldiers here (up to 6). Soldiers defend against raids and can attack tribes.',
  },
  weaponsmith: {
    kind: 'weaponsmith', label: 'Weaponsmith', w: 3, d: 2, cost: { wood: 6, stone: 4, brick: 4, clayTiles: 4 }, buildSeconds: 20,
    capacity: 0, workerSlots: 1, needsWater: false,
    desc: 'Forges the best weapons your materials allow (spear → bronze → iron) and leather armor from hides.',
  },
  watchtower: {
    kind: 'watchtower', label: 'Watchtower', w: 2, d: 2, cost: { wood: 8, stone: 2 }, buildSeconds: 18,
    capacity: 0, workerSlots: 0, needsWater: false,
    desc: '+2 defense strength and early warning when raiders set out.',
  },
  tailor: {
    kind: 'tailor', label: "Tailor's shop", w: 4, d: 2, cost: { wood: 6, straw: 2 }, buildSeconds: 15,
    capacity: 0, workerSlots: 1, needsWater: false,
    desc: 'Sews warm clothes from hides (2 hides → 1). Clothed villagers endure the cold longer.',
  },
  barn: {
    kind: 'barn', label: 'Barn', w: 4, d: 3, cost: { wood: 10, straw: 6, stone: 4 }, buildSeconds: 20,
    capacity: 0, workerSlots: 2, needsWater: false,
    desc: 'Winter workplace for farmers: threshing grain into flour or animal feed, with straw as a byproduct.',
  },
  bakery: {
    kind: 'bakery', label: 'Bakery', w: 3, d: 2, cost: { wood: 6, stone: 2, brick: 6, clayTiles: 4 }, buildSeconds: 20,
    capacity: 0, workerSlots: 1, needsWater: false,
    desc: 'Bakes bread from flour and firewood (2 flour + 1 firewood → 3 bread).',
  },
  pottery: {
    kind: 'pottery', label: "Potter's workshop", w: 4, d: 2, cost: { wood: 6, straw: 2, stone: 2 }, buildSeconds: 16,
    capacity: 0, workerSlots: 1, needsWater: false,
    desc: 'Throws 2 clay + 1 firewood into 2 pottery. A household with a pot is happier (+5); one without grumbles (−5).',
  },
  weaver: {
    kind: 'weaver', label: "Weaver's cottage", w: 4, d: 2, cost: { wood: 6, straw: 2 }, buildSeconds: 15,
    capacity: 0, workerSlots: 1, needsWater: false,
    desc: 'Twists 2 straw into 1 string and weaves 2 string into 1 linen — the cloth the tailor cuts. Needs Looming & weaving.',
  },
  leatherworker: {
    kind: 'leatherworker', label: 'Tannery', w: 4, d: 2, cost: { wood: 6, straw: 2, stone: 2 }, buildSeconds: 16,
    capacity: 0, workerSlots: 1, needsWater: true,
    desc: 'Must stand at the waterline. Tans 2 hides into 2 leather — the stuff of fine clothing and boots.',
  },
  cobbler: {
    kind: 'cobbler', label: "Cobbler's shop", w: 4, d: 2, cost: { wood: 6, straw: 2, stone: 2 }, buildSeconds: 16,
    capacity: 0, workerSlots: 1, needsWater: false,
    desc: 'Makes footwear: sandals, hide shoes, boots, luxury boots. The unshod walk 10% slower and grumble.',
  },
  manor: {
    kind: 'manor', label: 'Manor', w: 4, d: 4, cost: { wood: 10, stone: 16, clayTiles: 6 }, buildSeconds: 40,
    capacity: 8, workerSlots: 0, needsWater: false,
    desc: 'Seat of the baron (needs Feudalism). One citizen is raised to baron and moves in with his family; his oldest son inherits the title.',
  },
  temple: {
    kind: 'temple', label: 'Temple', w: 4, d: 4, cost: { wood: 8, stone: 16, clayTiles: 6 }, buildSeconds: 35,
    capacity: 0, workerSlots: 0, needsWater: false,
    desc: 'A place of worship (needs Religion). Grants +10 happiness to up to 100 villagers.',
  },
};

/** Extra storage each completed shed adds to the base stockpile capacity. */
export const SHED_CAPACITY = 250;
export const BASE_CAPACITY = 200;

/** Workshop upgrade (owner rule, session 26): brick/tile/stone/wood refit → +20% productivity. */
export const WORKSHOP_UPGRADE_COST: Partial<Record<BuildMaterial, number>> = {
  wood: 4, stone: 4, brick: 4, clayTiles: 4,
};
/** Speed factor for workers at an upgraded workshop. */
export const UPGRADE_TIME_FACTOR = 1 / 1.2;

/** Which buildings can take the workshop upgrade. */
export function isUpgradableWorkshop(kind: BuildingKind): boolean {
  const spec = BUILDING_SPECS[kind];
  // Hunters roam and never work AT the lodge; fields/training have no output cycle.
  return spec.workerSlots > 0 && kind !== 'cropField' && kind !== 'trainingGround' && kind !== 'huntingLodge';
}

export type BuildingState = 'awaitingMaterials' | 'underConstruction' | 'complete';

const swappedSpecs = new Map<BuildingKind, BuildingSpec>();

/** Spec for a placement rotation: odd quarter-turns get a w/d-swapped clone
 *  (cached, so identity stays stable across calls). */
export function specFor(kind: BuildingKind, rot: number): BuildingSpec {
  const spec = BUILDING_SPECS[kind];
  if (rot % 2 === 0 || spec.w === spec.d) return spec;
  let swapped = swappedSpecs.get(kind);
  if (!swapped) {
    swapped = { ...spec, w: spec.d, d: spec.w };
    swappedSpecs.set(kind, swapped);
  }
  return swapped;
}

export class Building {
  delivered: Partial<Record<BuildMaterial, number>> = {};
  workRemaining: number;
  /** Player-adjustable worker cap (0..spec.workerSlots). */
  maxWorkers: number;
  /** For workshops with a choice of product ('auto' unless the player picks). */
  productionMode = 'auto';
  /** Workshop refit bought (brick/tile/stone/wood): workers 20% faster. */
  upgraded = false;
  /** Marked for tear-down: builders dismantle it, half the materials return. */
  demolition = false;
  demoWork = 0;
  occupants: Villager[] = [];
  warmTimer = 30 + Math.random() * 30;
  coldStrikes = 0;
  /** Crop fields: 0..1 sowing/growing progress, harvested down in autumn. */
  growth = 0;
  /** Clay pits: total clay dug from the surrounding deposit (depletes at 1000). */
  clayTaken = 0;
  /** Houses: pots on the shelf (+5 happiness with, −5 without) and their wear. */
  potteryCount = 0;
  potteryTimer = 0;
  /** Houses: firewood carried home from storage — the hearth burns THIS. */
  firewoodStore = 0;
  /** Fresh move-in grace: house cold/hunger states held off (owner rule). */
  graceTimer = 0;
  /** Houses: food the family keeps at home (eaten and enjoyed there). */
  pantry: Partial<Record<string, number>> = {};
  /** Storages: this building's OWN inventory (owner rule, session 28). */
  store: Partial<Record<string, number>> = {};
  /** Mines: the OreType of the vein this mine sits on. */
  oreType = 0;
  /** Set when the visual state changes so the renderer rebuilds the mesh. */
  visualDirty = true;
  /** Placement rotation in quarter turns (0..3). Odd values swap w/d — the
   *  spec passed in is already the swapped clone (see specFor). */
  rot = 0;

  constructor(
    readonly spec: BuildingSpec,
    /** North-west tile of the footprint. */
    readonly anchorX: number,
    readonly anchorZ: number,
    /** Walkable tile next to the footprint that workers path to.
     *  Mutable: the village repairs it if something later blocks the tile. */
    public entranceTile: number,
  ) {
    this.workRemaining = spec.buildSeconds;
    this.maxWorkers = spec.workerSlots;
    if (spec.kind === 'cropField') this.productionMode = 'wheat';
  }

  pantryTotal(): number {
    let sum = 0;
    for (const n of Object.values(this.pantry)) sum += n ?? 0;
    return sum;
  }

  storeTotal(): number {
    let sum = 0;
    for (const n of Object.values(this.store)) sum += n ?? 0;
    return sum;
  }

  totalDelivered(): number {
    let sum = 0;
    for (const m of BUILD_MATERIALS) sum += this.delivered[m] ?? 0;
    return sum;
  }

  get centerX(): number {
    return this.anchorX + this.spec.w / 2;
  }

  get centerZ(): number {
    return this.anchorZ + this.spec.d / 2;
  }

  needed(material: BuildMaterial): number {
    return Math.max(0, (this.spec.cost[material] ?? 0) - (this.delivered[material] ?? 0));
  }

  totalNeeded(): number {
    let sum = 0;
    for (const m of BUILD_MATERIALS) sum += this.needed(m);
    return sum;
  }

  totalCost(): number {
    let sum = 0;
    for (const m of BUILD_MATERIALS) sum += this.spec.cost[m] ?? 0;
    return sum;
  }

  /** Overall construction progress 0..1 (half materials, half work). */
  progress(): number {
    const mat = this.totalCost() > 0 ? 1 - this.totalNeeded() / this.totalCost() : 1;
    const work = 1 - this.workRemaining / this.spec.buildSeconds;
    return mat * 0.5 + work * 0.5;
  }

  deliver(material: BuildMaterial, amount: number): number {
    const used = Math.min(amount, this.needed(material));
    this.delivered[material] = (this.delivered[material] ?? 0) + used;
    this.visualDirty = true;
    return amount - used; // refund
  }

  get state(): BuildingState {
    if (this.workRemaining <= 0) return 'complete';
    return this.totalNeeded() > 0 ? 'awaitingMaterials' : 'underConstruction';
  }

  containsTile(tile: number): boolean {
    const x = tile % MAP_SIZE;
    const z = (tile / MAP_SIZE) | 0;
    return x >= this.anchorX && x < this.anchorX + this.spec.w && z >= this.anchorZ && z < this.anchorZ + this.spec.d;
  }

  footprintTiles(): number[] {
    const tiles: number[] = [];
    for (let dz = 0; dz < this.spec.d; dz++) {
      for (let dx = 0; dx < this.spec.w; dx++) {
        tiles.push((this.anchorZ + dz) * MAP_SIZE + (this.anchorX + dx));
      }
    }
    return tiles;
  }
}
