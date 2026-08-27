import { MAP_SIZE, type Terrain } from '../world/terrain';
import { OreType, TileType, type TileMap } from '../world/tiles';
import type { World } from '../world/worldScene';
import { PathGrid } from './pathfinding';
import { randomName } from './names';
import { SEASON_META, SEASON_SECONDS, type Calendar, type Season } from './calendar';
import type { Events } from '../ui/Events';
import {
  BASE_CAPACITY, BUILD_MATERIALS, Building, BUILDING_SPECS, SHED_CAPACITY,
  UPGRADE_TIME_FACTOR, WORKSHOP_UPGRADE_COST, isUpgradableWorkshop, specFor,
  type BuildingKind, type BuildMaterial,
} from './buildings';
import type { Tech } from './techs';
import { SPECIES, type Animal, type AnimalSystem } from './animals';

/**
 * Phase 2 simulation: a camp of villagers who are assigned professions by
 * count ("3 woodcutters") and then work autonomously — find a target tile,
 * walk there (A*), work, carry the yield back to the stockpile, repeat.
 *
 * Runs on the fixed 10 Hz tick. Rendering interpolates between prev/cur
 * positions, so movement stays smooth at any frame rate.
 */

export type Profession =
  | 'woodcutter' | 'stonecutter' | 'forager' | 'firewoodmaker' | 'builder'
  | 'hunter' | 'fisher' | 'herbalist' | 'toolmaker' | 'teacher' | 'farmer'
  | 'clayDigger' | 'brickmaker' | 'forester' | 'miner' | 'smelter'
  | 'weaponsmith' | 'soldier' | 'tailor' | 'strawcutter' | 'baker' | 'weaver' | 'potter'
  | 'leatherworker' | 'cobbler';
export const PROFESSIONS: Profession[] = [
  'woodcutter', 'stonecutter', 'strawcutter', 'forager', 'firewoodmaker', 'builder',
  'hunter', 'fisher', 'herbalist', 'toolmaker', 'teacher', 'farmer',
  'clayDigger', 'brickmaker', 'potter', 'forester', 'miner', 'smelter',
  'weaponsmith', 'soldier', 'weaver', 'leatherworker', 'tailor', 'cobbler', 'baker',
];

export type ResourceKind =
  | 'wood' | 'stone' | 'straw' | 'clayTiles' | 'firewood' | 'herbs' | 'medicine' | 'hides'
  | 'berries' | 'meat' | 'fish' | 'mushrooms' | 'roots'
  | 'seeds' | 'wheat' | 'rye' | 'oat' | 'barley'
  | 'potatoes' | 'tomatoes' | 'peppers' | 'strawberries' | 'carrots' | 'melons' | 'watermelons'
  | 'flour' | 'bread' | 'animalFeed'
  | 'woodenTools' | 'stoneTools' | 'clay' | 'brick'
  | 'fur' | 'string' | 'linen' | 'leather' | 'clothes' | 'fineClothes' | 'luxuryClothes' | 'pottery'
  | 'sandals' | 'hideShoes' | 'boots' | 'luxuryBoots'
  | 'copperOre' | 'tinOre' | 'ironOre' | 'coal'
  | 'bronzeBar' | 'ironBar' | 'bronzeTools' | 'ironTools'
  | 'spears' | 'bronzeWeapons' | 'ironWeapons' | 'leatherArmor';

/** Edible types — each distinct food AT HOME gives +1 happiness (owner rule). */
export const FOOD_KINDS: ResourceKind[] = [
  'berries', 'mushrooms', 'roots', 'meat', 'fish', 'bread',
  'potatoes', 'tomatoes', 'peppers', 'strawberries', 'carrots', 'melons', 'watermelons',
];

/** What crop fields can grow (selected per field; sowing needs 2 seeds). */
export const CROP_KINDS: ResourceKind[] = [
  'wheat', 'rye', 'oat', 'barley',
  'potatoes', 'tomatoes', 'peppers', 'strawberries', 'carrots', 'melons', 'watermelons',
];
/** Grains aren't eaten raw — the barn threshes them in winter. */
export const GRAIN_KINDS: ResourceKind[] = ['wheat', 'rye', 'oat', 'barley'];
const SOW_SEED_COST = 2;

export type WeaponTier = 'none' | 'spear' | 'bronze' | 'iron';
const WEAPON_STRENGTH: Record<WeaponTier, number> = { none: 0, spear: 1, bronze: 2, iron: 3 };
const WEAPON_STORE: [WeaponTier, ResourceKind][] = [
  ['iron', 'ironWeapons'],
  ['bronze', 'bronzeWeapons'],
  ['spear', 'spears'],
];
export type Resources = Record<ResourceKind, number>;

// Tools: villagers grab the best available tool when taking a job. A tool
// survives TOOL_USES work cycles; better tools work faster.
// Owner efficiency curve: no tool 50%, wooden 100%, stone 125%, bronze 165%,
// iron 200% (stored as time multipliers = 1/efficiency).
// 'net' is the fisherman's own craft: 4 string → 1 net, 200% efficiency.
export type ToolTier = 'none' | 'wood' | 'stone' | 'bronze' | 'iron' | 'net';
const TOOL_USES = 15;
const TOOL_SPEED: Record<ToolTier, number> = { none: 2.0, wood: 1.0, stone: 0.8, bronze: 0.6, iron: 0.5, net: 0.5 };
const NET_STRING_COST = 4;
/** Equip priority + which store resource each tier comes from. */
const TOOL_STORE: [ToolTier, ResourceKind][] = [
  ['iron', 'ironTools'],
  ['bronze', 'bronzeTools'],
  ['stone', 'stoneTools'],
  ['wood', 'woodenTools'],
];
const TOOL_STOCK_CAP_EXTRA = 4; // toolmaker rests once everyone could be equipped, plus spares

interface JobSpec {
  workSeconds: number;
  yields: ResourceKind;
  amount: number;
}

const JOBS: Record<Profession, JobSpec> = {
  woodcutter: { workSeconds: 5, yields: 'wood', amount: 3 },
  stonecutter: { workSeconds: 6, yields: 'stone', amount: 2 },
  strawcutter: { workSeconds: 5, yields: 'straw', amount: 3 },
  forager: { workSeconds: 4, yields: 'berries', amount: 3 },
  // Splits wood into firewood at the stockpile (2 wood → 4 firewood).
  // Owner balance: 50% slower than the original 4s cycle.
  firewoodmaker: { workSeconds: 8, yields: 'firewood', amount: 4 },
  // Foresters split their time: half planting, half felling nearby trees.
  // 50% slower than regular work (owner rule).
  forester: { workSeconds: 8, yields: 'wood', amount: 3 },
  // Builders don't yield resources; their flow is pickup → deliver → build.
  builder: { workSeconds: 0, yields: 'wood', amount: 0 },
  // Meat/hides per kill depend on the animal (applyWorkEffect): deer 4+4,
  // boar 2+2, rabbit 1 meat + 1 fur; young yield half (owner rules).
  hunter: { workSeconds: 3, yields: 'meat', amount: 1 },
  fisher: { workSeconds: 6, yields: 'fish', amount: 3 },
  // Gathers herbs in the forest; brews medicine at the hut once researched.
  herbalist: { workSeconds: 5, yields: 'herbs', amount: 2 },
  // Actual output kind decided in applyWorkEffect (stone tools if materials allow).
  toolmaker: { workSeconds: 6, yields: 'woodenTools', amount: 2 },
  // Teacher generates knowledge directly (no hauling); farmer yield is seasonal
  // and depends on the field's selected crop.
  teacher: { workSeconds: 8, yields: 'berries', amount: 0 },
  // ~15 harvest trips per field per autumn × 4 = ~60 crops from a full field.
  farmer: { workSeconds: 5, yields: 'wheat', amount: 4 },
  baker: { workSeconds: 7, yields: 'bread', amount: 3 },
  clayDigger: { workSeconds: 6, yields: 'clay', amount: 3 },
  // Fires 2 clay + 1 firewood into 3 bricks at the oven.
  brickmaker: { workSeconds: 6, yields: 'brick', amount: 3 },
  // Actual ore kind comes from the mine's vein (applyWorkEffect).
  miner: { workSeconds: 6, yields: 'ironOre', amount: 2 },
  // Bronze or iron bars depending on materials/tech (applyWorkEffect).
  smelter: { workSeconds: 7, yields: 'bronzeBar', amount: 1 },
  // Crafts weapons/armor by priority (applyWorkEffect).
  weaponsmith: { workSeconds: 7, yields: 'spears', amount: 1 },
  // Soldiers train (no yield); the war system commands them in battle.
  soldier: { workSeconds: 6, yields: 'berries', amount: 0 },
  // Actual garment tier decided in applyWorkEffect (basic/fine/luxury).
  tailor: { workSeconds: 7, yields: 'clothes', amount: 1 },
  // 2 straw → 1 string, or 2 string → 1 linen (applyWorkEffect).
  weaver: { workSeconds: 6, yields: 'string', amount: 1 },
  // 2 clay + 1 firewood → 2 pottery for the households.
  potter: { workSeconds: 7, yields: 'pottery', amount: 2 },
  // Tans 2 hides → 2 leather at the waterline.
  leatherworker: { workSeconds: 6, yields: 'leather', amount: 2 },
  // Footwear tier decided in applyWorkEffect.
  cobbler: { workSeconds: 6, yields: 'sandals', amount: 1 },
};

// The tannery never dips into the last hides — the tailor (basic clothes),
// cobbler (hide shoes), and weaponsmith (leather armor) use them raw. No cap
// on leather itself: the player staffed the tannery, surplus is tradeable
// (owner report, session 36: 80+ leather is not a reason to stand idle).
const TANNERY_HIDE_RESERVE = 4;

// Owner rules (session 30): footwear. The unshod walk 10% slower and lose 5
// happiness; better shoes please their wearer and last longer.
export type ShoeTier = 'none' | 'sandals' | 'hide' | 'boots' | 'luxury';
const SHOE_RANK: Record<ShoeTier, number> = { none: 0, sandals: 1, hide: 2, boots: 3, luxury: 4 };
const SHOE_JOY: Record<ShoeTier, number> = { none: -5, sandals: 0, hide: 5, boots: 10, luxury: 15 };
/** Lifetime in seconds (a day is 20 s): 90 / 120 / 180 / 240 days. */
const SHOE_LIFE: Record<ShoeTier, number> = { none: 0, sandals: 1800, hide: 2400, boots: 3600, luxury: 4800 };
const SHOE_STORE: [ShoeTier, ResourceKind][] = [
  ['luxury', 'luxuryBoots'],
  ['boots', 'boots'],
  ['hide', 'hideShoes'],
  ['sandals', 'sandals'],
];
const BAREFOOT_SPEED = 0.9;

// Owner rule (session 30): craftsmen stock their output on the shop's own
// shelves first; only when the shelf is full do they haul to storage.
// Tailor 30/10 and woodcutter's lodge 20 are the owner's numbers; the rest
// are Claude's.
export const SHOP_STORE_CAPS: Partial<Record<BuildingKind, { total: number; perKind: number }>> = {
  woodcutterLodge: { total: 20, perKind: 20 },
  toolmaker: { total: 12, perKind: 6 },
  weaver: { total: 20, perKind: 10 },
  tailor: { total: 30, perKind: 10 },
  pottery: { total: 12, perKind: 12 },
  bakery: { total: 15, perKind: 15 },
  brickOven: { total: 24, perKind: 12 },
  smelter: { total: 10, perKind: 5 },
  weaponsmith: { total: 10, perKind: 5 },
  leatherworker: { total: 20, perKind: 20 },
  cobbler: { total: 20, perKind: 10 },
  herbalistHut: { total: 10, perKind: 5 },
};

const POTTER_CLAY_COST = 2;
const POTTER_FIREWOOD_COST = 1;
/** Owner rule (session 29): a household consumes 1 pottery every season. */
const POTTERY_LIFE = SEASON_SECONDS;

// Owner rule (session 27): a clay pit is exhausted after 1000 clay — the
// deposit within 5 tiles is spent and digging drops to 20% pace.
const CLAY_PIT_CAPACITY = 1000;
const CLAY_DEPLETE_RADIUS = 5;

// Clothing tiers (owner rules, session 25): tailor sews basic (1 linen),
// fine (2 linen + 2 hides, +10 happiness, warmer), and luxury
// (2 linen + 2 hides + 2 fur, much warmer).
export type ClothingTier = 'none' | 'basic' | 'fine' | 'luxury';
const CLOTHING_RANK: Record<ClothingTier, number> = { none: 0, basic: 1, fine: 2, luxury: 3 };
const CLOTHING_JOY: Record<ClothingTier, number> = { none: 0, basic: 5, fine: 10, luxury: 15 };
/** Extra freeze strikes a garment endures — winter protection. */
const CLOTHING_WARMTH: Record<ClothingTier, number> = { none: 0, basic: 1, fine: 2, luxury: 4 };
const CLOTHING_STORE: [ClothingTier, ResourceKind][] = [
  ['luxury', 'luxuryClothes'],
  ['fine', 'fineClothes'],
  ['basic', 'clothes'],
];
// Owner rule (session 29): garments wear out — basic 90 days, fine 150,
// luxury 240 (a day is 20 real seconds).
const CLOTHING_LIFE: Record<ClothingTier, number> = { none: 0, basic: 1800, fine: 3000, luxury: 4800 };
// Ragged villagers fall ill more (× per season); good cloth protects.
const ILLNESS_CLOTHING_FACTOR: Record<ClothingTier, number> = { none: 1, basic: 1, fine: 0.75, luxury: 0.5 };

const WEAVER_STRING_BUFFER = 6; // auto mode keeps string for fishing nets

const BRICK_CLAY_COST = 2;
const BRICK_FIREWOOD_COST = 1;

// Owner pacing (session 24): ONE farmer handles ONE 5×5 field per season —
// fully sows it over spring, fully tends it over summer (untended fields only
// reach ~2/3 growth), and brings in the whole harvest over autumn.
const FIELD_SOWN_CAP = 0.4;
const FIELD_SOW_PER_CYCLE = FIELD_SOWN_CAP / 60; // ~60 five-second cycles per season
const FIELD_SUMMER_RATE = (1 - FIELD_SOWN_CAP) / SEASON_SECONDS / 1.5; // tended (×1.5) finishes exactly
const FIELD_HARVEST_DRAIN = 1 / 15; // ~15 harvest round-trips empty a full field in one autumn
const STAY_CYCLES = 6; // on-site professions head home for a break after this many cycles

// Owner rule (session 26): a cut straw tile is bare and regrows after 3 years.
const STRAW_REGROW_SECONDS = 3 * 4 * SEASON_SECONDS;

/** One calendar day in real seconds (daily rolls: family, illness, danger). */
const DAY_SECONDS = 20;

// Illness (owner rules, session 24): untreated sickness runs 10 days and each
// sick day carries a 1% death chance. Medicine (1 dose) or 1 herb + an
// assigned herbalist halves the remaining course and removes the death risk —
// a promptly treated illness lasts ~5 days.
const ILLNESS_UNTREATED_SECONDS = 10 * DAY_SECONDS;
const ILLNESS_DAILY_DEATH_CHANCE = 0.01;

// Dangerous trades (owner rule): woodcutting, mining, and hunting can kill —
// ultra rare, 0.005% per person per day on the job.
const DANGEROUS_JOBS: Partial<Record<Profession, string>> = {
  woodcutter: 'was crushed by a falling tree',
  miner: 'was lost in a mine collapse',
  hunter: 'was gored by a wounded stag',
};
const DANGER_DAILY_CHANCE = 0.00005;

// Grief (owner rule): losing a family member costs −20 happiness for a season.
const GRIEF_SECONDS = SEASON_SECONDS;

/** Materials per haul trip: 3 bare-handed, 4 with wooden tools, 5 with better. */
function haulCapacity(tool: ToolTier): number {
  return tool === 'none' ? 3 : tool === 'wood' ? 4 : 5;
}

// Walls & gates: instant fortifications paid from the store. Walls block
// movement entirely; gates are passable. Every segment adds to defense.
export type WallKind = 'woodWall' | 'stoneWall' | 'woodGate' | 'stoneGate';
export const WALL_DEFS: Record<WallKind, { label: string; cost: Partial<Record<'wood' | 'stone', number>>; gate: boolean; defense: number }> = {
  woodWall: { label: 'Wooden wall', cost: { wood: 2 }, gate: false, defense: 0.06 },
  stoneWall: { label: 'Stone wall', cost: { stone: 3 }, gate: false, defense: 0.12 },
  woodGate: { label: 'Wooden gate', cost: { wood: 4 }, gate: true, defense: 0.5 },
  stoneGate: { label: 'Stone gate', cost: { stone: 6 }, gate: true, defense: 1 },
};

const FIREWOOD_WOOD_COST = 2;

// Owner rules (session 29): dirt roads are free and give +25% speed; stone
// roads cost 1 stone per tile and give +50%.
export type RoadKind = 'dirt' | 'stone';
const WALK_SPEED = 1.8; // tiles per second off-road
const ROAD_FACTOR: Record<RoadKind, number> = { dirt: 1.25, stone: 1.5 };
const STONE_ROAD_COST = 1;
const IDLE_RETRY_SECONDS = 2;
// Builders work at half pace (owner rule) — construction takes real time.
const BUILD_RATE = 0.5;
const NEAREST_POOL = 12; // pick randomly among the K nearest targets to spread workers

// Survival needs (owner balance): food is eaten twice as fast as the original
// tuning; firewood burns in spring/autumn at base rate, in winter at 2x, and
// not at all in summer. Missing several meals or warm-ups in a row kills
// (freezing only kills in winter).
const EAT_INTERVAL = 30;
const WARM_INTERVAL = 60;
const NEED_RETRY = 20;
const STARVE_STRIKES = 4;
const FREEZE_STRIKES = 3;
/** Cold misery is capped — outside winter strikes used to climb without end. */
const MAX_COLD_STRIKES = 6;

// Life cycle: villagers age one "life-year" per season. Babies until BABY_AGE,
// then school-age children; adults from ADULT_AGE; old age past OLD_AGE_MIN.
export const BABY_AGE = 5;
const ADULT_AGE = 10;
const OLD_AGE_MIN = 50;
const OLD_AGE_SPAN = 20;

// Family rules (owner): checked once per day (20s). 1% chance an unmarried
// couple marries IF an empty house awaits them; 2% for two unmarried people
// sharing a house; singles lodging with married couples get moved out.
// Married couples: 1%/day pregnancy; birth after 3 seasons.
// Owner fixes (session 32): singles married far too slowly (couples shared a
// house 2 years unwed) and pairings ignored age. One matchmaking pass per
// day: each bachelor has a 4% chance, always to the closest-aged woman,
// never more than 10 years apart.
const MARRIAGE_DAILY_CHANCE = 0.04;
const MARRIAGE_MAX_AGE_GAP = 10;
const PREGNANCY_CHANCE = 0.01;
const PREGNANCY_SECONDS = 3 * SEASON_SECONDS;
// Owner rules: marriage from 16; childbearing 16-50 with fading fertility.
const MARRIAGE_AGE = 16;
const FERTILITY_MAX_AGE = 50;
// Knowledge: generated passively at 25% of the old teacher rate; a working
// teacher adds 50% of the old rate on top.
const KNOWLEDGE_PASSIVE_PER_SEC = 0.25 / 8;

type VillagerState = 'idle' | 'toWork' | 'working' | 'toHome' | 'toPickup' | 'campaign';
type BuildPhase = 'pickup' | 'deliver' | 'build';

export class Villager {
  sex: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female';
  name: string;
  profession: Profession | null = null;
  state: VillagerState = 'idle';
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  dead = false;

  // Survival needs (managed by Village.tickNeeds).
  fedTimer = EAT_INTERVAL * (0.5 + Math.random() * 0.5);
  warmTimer = WARM_INTERVAL * (0.5 + Math.random() * 0.5);
  hungerStrikes = 0;
  coldStrikes = 0;

  // Life cycle & family.
  ageYears = 16 + Math.random() * 24;
  lifespan = OLD_AGE_MIN + Math.random() * OLD_AGE_SPAN;
  home: Building | null = null;
  spouse: Villager | null = null;
  mother: Villager | null = null;
  father: Villager | null = null;
  /** Seconds until birth; 0 = not pregnant. */
  pregnantTimer = 0;
  /** Worn garment tier: warmth + happiness scale with quality (owner rule). */
  clothing: ClothingTier = 'none';
  /** Seconds until the current garment wears out. */
  clothingTimer = 0;
  /** Footwear (owner rules, session 30): none = slower and unhappier. */
  shoes: ShoeTier = 'none';
  shoeTimer = 0;
  /** Seasonal misery for going ragged (set daily by the village). */
  raggedPenalty = 0;
  /** School-age child assigned to house chores (no school seat). */
  choreDuty = false;
  /** Happiness bonus from food variety; refreshed daily by the village. */
  dietBonus = 0;
  /** Happiness bonus from a temple (+10 for up to 100 villagers); refreshed daily. */
  templeBonus = 0;
  /** Seconds of mourning left after a family member's death (−20 happiness). */
  griefTimer = 0;
  /** The lord of the manor (title assigned by the village). */
  isBaron = false;

  // Builder task state.
  site: Building | null = null;
  buildPhase: BuildPhase | null = null;
  buildCarry: { material: BuildMaterial; amount: number } | null = null;
  /** Road/wall tile job (builders). */
  pendingWork: { tile: number; kind: 'road' | 'stoneRoad' | WallKind; work: number } | null = null;
  /** Builders roam the works while constructing (owner rule, session 27). */
  buildMoveTimer = 0;
  buildMoveX = 0;
  buildMoveZ = 0;

  /** Food run: fetching groceries from storage to the family pantry. */
  foodRun = false;
  foodCarry: Partial<Record<ResourceKind, number>> | null = null;
  /** Sim time before which shopping is skipped — set after an empty-handed
   *  trip so a stuck want can never crowd out job-taking (owner bug, s35). */
  nextShopTry = 0;

  // Hunter task state.
  targetAnimal: Animal | null = null;
  chaseTries = 0;

  // Equipped tool.
  tool: ToolTier = 'none';
  toolUses = 0;

  // Soldier gear.
  weapon: WeaponTier = 'none';
  hasArmor = false;

  get combatStrength(): number {
    return 1 + WEAPON_STRENGTH[this.weapon] + (this.hasArmor ? 1 : 0);
  }
  /** Consecutive on-site work cycles (teacher/farmer stay at their building). */
  stayCycles = 0;

  // Illness.
  ill = false;
  illTreated = false;
  illTimer = 0;

  private waypoints: { x: number; z: number }[] = [];
  private timer = Math.random() * IDLE_RETRY_SECONDS;
  targetTile = -1;
  /** Load in hand mid-haul — public so saves can capture and restore it. */
  carrying: { kind: ResourceKind; amount: number } | null = null;

  constructor(x: number, z: number, age?: number) {
    this.x = x;
    this.z = z;
    this.prevX = x;
    this.prevZ = z;
    if (age !== undefined) this.ageYears = age;
    this.name = randomName(this.sex);
  }

  get moving(): boolean {
    return this.waypoints.length > 0;
  }

  get isChild(): boolean {
    return this.ageYears < ADULT_AGE;
  }

  get isBaby(): boolean {
    return this.ageYears < BABY_AGE;
  }

  get isAdult(): boolean {
    return this.ageYears >= ADULT_AGE;
  }

  /** Displayed health 0-100, from current hardship. */
  get health(): number {
    let h = 100;
    if (this.ill) h -= 35;
    h -= this.hungerStrikes * 15;
    h -= this.coldStrikes * 15;
    if (this.ageYears > this.lifespan - 5) h -= 20;
    return Math.max(5, Math.min(100, h));
  }

  /** Displayed happiness 0-100, from living conditions, diet variety, faith, and grief. */
  get happiness(): number {
    let h = 50;
    h += this.home ? 20 : -15;
    if (this.spouse) h += 10;
    h += CLOTHING_JOY[this.clothing];
    if (this.tool !== 'none') h += 5;
    h += this.dietBonus;
    h += this.templeBonus;
    // Owner rule: a household with pottery +5, without −5 (homeless count as without).
    h += this.home && this.home.potteryCount > 0 ? 5 : -5;
    h -= this.hungerStrikes * 10 + this.coldStrikes * 10;
    if (this.ill) h -= 15;
    if (this.griefTimer > 0) h -= 20; // mourning a family member (one season)
    h -= this.raggedPenalty; // no clothes: −40 winter / −20 spring+autumn / −10 summer
    h += SHOE_JOY[this.shoes]; // barefoot −5; hide shoes +5, boots +10, luxury +15
    return Math.max(0, Math.min(100, h));
  }

  /** Owner rule: 0% happy → 20% productive, 100% happy → 120% productive. */
  get productivity(): number {
    return 0.2 + this.happiness / 100;
  }

  /** Total work-time multiplier: tool tier / morale. The sick keep working
   *  at 50% productivity (owner rule) instead of dropping their job. */
  get workTimeFactor(): number {
    return (this.toolSpeed / this.productivity) * (this.ill ? 2 : 1);
  }

  /** What this villager is doing right now, for the character window. */
  get activity(): string {
    switch (this.state) {
      case 'idle': return this.isBaby ? 'Being looked after' : this.isChild ? 'Playing' : 'Resting';
      case 'toWork': return 'Walking to work';
      case 'working': return 'Working';
      case 'toHome': return 'Carrying goods to the stockpile';
      case 'toPickup': return 'Fetching materials';
      case 'campaign': return 'Marching with the war party';
    }
  }

  get toolSpeed(): number {
    return TOOL_SPEED[this.tool];
  }

  /** Wear the equipped tool by one work cycle. */
  wearTool(): void {
    if (this.tool === 'none') return;
    if (--this.toolUses <= 0) this.tool = 'none';
  }

  get working(): boolean {
    return this.state === 'working';
  }

  tick(dt: number, village: Village): void {
    this.prevX = this.x;
    this.prevZ = this.z;

    switch (this.state) {
      case 'campaign': {
        // Marching with the war party — the war system moves and returns them.
        break;
      }
      case 'idle': {
        this.timer -= dt;
        if (this.timer <= 0) {
          // Stranded on an unwalkable tile (e.g. born on a construction
          // site)? Step off first or every pathfind fails forever.
          village.unstick(this);
          if (this.isChild) {
            // Chore-duty children (no school seat) haul food and firewood home;
            // the rest play (babies out front; pupils visit the school).
            if (this.choreDuty && !this.isBaby && village.maybeStartFoodRun(this)) break;
            village.sendChildToPlay(this);
            this.timer = 3 + Math.random() * 5;
          } else if (village.maybeStartFoodRun(this)) {
            break; // groceries before work
          } else if (!village.startJob(this)) {
            this.timer = IDLE_RETRY_SECONDS;
          }
        }
        break;
      }
      case 'toPickup': {
        // Walking to storage: builders for materials, residents for groceries.
        this.move(dt, village);
        if (!this.moving) {
          if (this.foodRun) village.foodPickup(this);
          else village.builderPickup(this);
        }
        break;
      }
      case 'toWork': {
        this.move(dt, village);
        if (!this.moving) {
          if (this.profession === 'builder') {
            village.builderArrived(this);
          } else if (this.profession === 'hunter') {
            village.hunterArrived(this);
          } else {
            this.state = 'working';
            // Upgraded workshops shave 20% off every work cycle.
            this.timer = JOBS[this.profession!].workSeconds * this.workTimeFactor * (this.site?.upgraded ? UPGRADE_TIME_FACTOR : 1);
          }
        }
        break;
      }
      case 'working': {
        if (this.profession === 'builder') {
          village.builderWork(this, dt);
          break;
        }
        this.timer -= dt;
        if (this.timer <= 0) {
          const spec = JOBS[this.profession!];
          const result = village.applyWorkEffect(this.profession!, this.targetTile, this);
          this.carrying = result.mult > 0 ? { kind: result.kind ?? spec.yields, amount: spec.amount * result.mult } : null;
          if (result.mult > 0) this.wearTool();
          // Owner rule: craftsmen stock their shop's own shelves first; only
          // a full shelf sends them hauling to storage.
          if (this.carrying && this.site && village.shopStash(this.site, this.carrying.kind, this.carrying.amount)) {
            this.carrying = null;
          }
          // On-site professions repeat cycles without walking home each time.
          const staysOnSite = this.profession === 'teacher' || this.profession === 'farmer' || this.profession === 'soldier';
          if (staysOnSite && !this.carrying && ++this.stayCycles < STAY_CYCLES && village.hasOnSiteWork(this)) {
            this.timer = spec.workSeconds * this.workTimeFactor * (this.site?.upgraded ? UPGRADE_TIME_FACTOR : 1);
            break;
          }
          this.stayCycles = 0;
          if (!this.carrying) {
            // Nothing to haul — rest on the spot and take the next job from here.
            this.goIdle(0.5);
            break;
          }
          this.setPath(village.pathToHome(this));
          this.state = 'toHome';
        }
        break;
      }
      case 'toHome': {
        this.move(dt, village);
        if (!this.moving) {
          if (this.foodCarry) {
            village.deliverPantry(this);
            break;
          }
          if (this.carrying) {
            village.deposit(this.carrying.kind, this.carrying.amount, this.x, this.z);
            this.carrying = null;
          }
          this.state = 'idle';
          this.timer = 0.3;
        }
        break;
      }
    }
  }

  beginWorkTrip(path: number[], targetTile: number): void {
    this.setPath(path);
    this.targetTile = targetTile;
    this.state = 'toWork';
  }

  /** Used by the Village to drive builder task transitions. */
  navigate(path: number[] | null, state: VillagerState): void {
    this.setPath(path);
    this.state = state;
  }

  goIdle(delay = IDLE_RETRY_SECONDS): void {
    this.site = null;
    this.buildPhase = null;
    this.targetAnimal = null;
    this.pendingWork = null;
    this.foodRun = false;
    this.foodCarry = null;
    this.state = 'idle';
    this.timer = delay;
  }

  startWorking(seconds: number): void {
    this.state = 'working';
    this.timer = seconds;
  }

  private setPath(path: number[] | null): void {
    this.waypoints = (path ?? []).map((i) => ({
      x: (i % MAP_SIZE) + 0.5,
      z: ((i / MAP_SIZE) | 0) + 0.5,
    }));
  }

  private move(dt: number, village?: Village): void {
    // Barefoot villagers walk 10% slower (owner rule).
    const shoeFactor = this.shoes === 'none' ? BAREFOOT_SPEED : 1;
    let budget = WALK_SPEED * shoeFactor * (village?.roadFactorAt(this.x, this.z) ?? 1) * dt;
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
  }
}

export class Village {
  readonly resources: Resources = {
    // Starting stock per owner (session 25): 20 wood, 10 stone, 20 straw,
    // 10 herbs, 20 firewood.
    wood: 20, stone: 10, straw: 20, clayTiles: 0,
    berries: 20, mushrooms: 5, roots: 5, meat: 10, fish: 10,
    seeds: 0, wheat: 0, rye: 0, oat: 0, barley: 0,
    potatoes: 0, tomatoes: 0, peppers: 0, strawberries: 0, carrots: 0, melons: 0, watermelons: 0,
    flour: 0, bread: 0, animalFeed: 0,
    firewood: 20, herbs: 10, medicine: 2, hides: 0,
    woodenTools: 20, stoneTools: 0, clay: 0, brick: 0,
    fur: 0, string: 0, linen: 0, leather: 0, clothes: 0, fineClothes: 0, luxuryClothes: 0, pottery: 0,
    sandals: 0, hideShoes: 0, boots: 0, luxuryBoots: 0,
    copperOre: 0, tinOre: 0, ironOre: 0, coal: 0,
    bronzeBar: 0, ironBar: 0, bronzeTools: 0, ironTools: 0,
    spears: 0, bronzeWeapons: 0, ironWeapons: 0, leatherArmor: 0,
  };
  readonly villagers: Villager[] = [];
  // Owner rule: every profession starts unassigned — the player builds the
  // workforce from zero.
  readonly desired: Record<Profession, number> = {
    woodcutter: 0, stonecutter: 0, strawcutter: 0, forager: 0, firewoodmaker: 0, builder: 0,
    hunter: 0, fisher: 0, herbalist: 0, toolmaker: 0, teacher: 0, farmer: 0,
    clayDigger: 0, brickmaker: 0, potter: 0, forester: 0, miner: 0, smelter: 0,
    weaponsmith: 0, soldier: 0, tailor: 0, baker: 0, weaver: 0, leatherworker: 0, cobbler: 0,
  };
  knowledge = 0;
  readonly researched = new Set<string>();
  readonly roads = new Map<number, RoadKind>();
  /** Wall/gate segments by tile. Walls block movement; gates let villagers through. */
  readonly walls = new Map<number, WallKind>();
  /** Lord of the manor (owner rule): raised when the Manor completes; the
   *  oldest male son inherits, falling back to the oldest adult man. */
  baron: Villager | null = null;
  private lastFullWarning = -Infinity;
  private familyTimer = 0;
  private newborns: Villager[] = [];
  private harshWinter = false;

  // Chronicle: counters + daily samples for the statistics window.
  readonly stats = { births: 0, deaths: 0 };
  readonly history: { t: number; pop: number; food: number; firewood: number }[] = [];
  readonly home: { x: number; z: number };
  readonly buildings: Building[] = [];

  private grid: PathGrid;
  private rockTiles: number[] = [];
  private forestTiles: number[] = [];
  private strawTiles: number[] = [];
  /** Harvested straw tiles waiting to regrow (3 years). */
  readonly strawRegrow: { tile: number; at: number }[] = [];
  /** Quarried-out rock tiles — the stone is gone for good (owner rule). */
  readonly rocksRemoved: number[] = [];
  /** Roads/walls awaiting a builder (materials already paid for walls). */
  readonly pendingWorks: { tile: number; kind: 'road' | 'stoneRoad' | WallKind; work: number }[] = [];
  private lastSeason: Season | null = null;

  constructor(
    private readonly world: World,
    private readonly calendar: Calendar,
    private readonly events: Events,
    private readonly animals: AnimalSystem,
    populationCount = 12,
  ) {
    this.grid = new PathGrid(world.tiles);
    this.home = this.findVillageSite(world.tiles, world.terrain);

    for (let i = 0; i < world.tiles.types.length; i++) {
      const t = world.tiles.types[i];
      if (t === TileType.Rock) this.rockTiles.push(i);
      else if (t === TileType.Forest) this.forestTiles.push(i);
      else if (t === TileType.Straw) this.strawTiles.push(i);
    }

    this.events.push("🪓 Villagers can chop wood right away — build a woodcutter's lodge (4 wood) to split firewood.");
    void populationCount;

    // The founding stockpile is a real (prebuilt) building so it can be
    // inspected and demolished like any other (owner rule, session 28).
    this.placePrebuiltStockpile();

    // Starting population (owner): 3 married couples — two of them with a
    // child and a baby each — plus 4 unmarried adults.
    const spawnSpots: { x: number; z: number }[] = [];
    const hx = Math.floor(this.home.x);
    const hz = Math.floor(this.home.z);
    for (let ring = 1; ring <= 8 && spawnSpots.length < 20; ring++) {
      for (let dz = -ring; dz <= ring && spawnSpots.length < 20; dz++) {
        for (let dx = -ring; dx <= ring && spawnSpots.length < 20; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          if (!this.grid.isWalkable(hx + dx, hz + dz)) continue;
          spawnSpots.push({ x: hx + dx + 0.5, z: hz + dz + 0.5 });
        }
      }
    }
    let spot = 0;
    const nextSpot = () => spawnSpots[spot++ % spawnSpots.length] ?? { x: this.home.x, z: this.home.z };
    const addAdult = (sex: 'male' | 'female'): Villager => {
      const s = nextSpot();
      // Owner rule (session 26): young founders — men 16-28 (median 22),
      // women 17-25 (median 21).
      const age = sex === 'male' ? 16 + Math.random() * 12 : 17 + Math.random() * 8;
      const v = new Villager(s.x, s.z, age);
      v.sex = sex;
      v.name = randomName(sex); // keep the name matched to the forced sex
      this.villagers.push(v);
      return v;
    };
    for (let c = 0; c < 3; c++) {
      const husband = addAdult('male');
      const wife = addAdult('female');
      husband.spouse = wife;
      wife.spouse = husband;
      if (c < 2) {
        const s1 = nextSpot();
        const child = new Villager(s1.x, s1.z, BABY_AGE + Math.random() * (10 - BABY_AGE - 0.5));
        const s2 = nextSpot();
        const baby = new Villager(s2.x, s2.z, 1 + Math.random() * 2);
        child.mother = wife;
        child.father = husband;
        baby.mother = wife;
        baby.father = husband;
        this.villagers.push(child, baby);
      }
    }
    for (let i = 0; i < 4; i++) addAdult(i % 2 === 0 ? 'male' : 'female');
    // Everyone arrives dressed in basic clothes (owner rule, session 25).
    for (const v of this.villagers) {
      v.clothing = 'basic';
      v.clothingTimer = CLOTHING_LIFE.basic * (0.4 + Math.random() * 0.6); // staggered wear
    }
  }

  tick(dt: number): void {
    // Season-change announcements.
    const season = this.calendar.season;
    if (season !== this.lastSeason) {
      if (this.lastSeason !== null) {
        const meta = SEASON_META[season];
        this.events.push(`${meta.icon} ${meta.label} has come (year ${this.calendar.year})`);
        if (season === 'winter') this.events.push('❄️ Foraging stops — the camp fire burns firewood!');
        this.animals.reproduce();
        // Harsh winters strike every few years.
        if (season === 'winter') {
          this.harshWinter = Math.random() < 0.25;
          if (this.harshWinter) this.events.push('🌨️ A HARSH winter descends — fires devour firewood half again as fast!');
        } else if (season === 'spring') {
          this.harshWinter = false;
          // (Clothes now wear out on their own fixed timers — see tickNeeds.)
        }
        if (season === 'winter') {
          // Unharvested crops die under the snow.
          for (const b of this.buildings) {
            if (b.spec.kind === 'cropField' && b.growth > 0.05) {
              this.events.push('🥀 A crop field was lost to the frost.');
            }
            if (b.spec.kind === 'cropField') {
              b.growth = 0;
              b.visualDirty = true;
            }
          }
        }
      }
      this.lastSeason = season;
    }

    for (const v of this.villagers) {
      v.tick(dt, this);
      this.tickNeeds(dt, v);
      this.tickIllness(dt, v);
    }
    this.tickHouses(dt);
    this.tickFields(dt);
    this.world.forest.tickGrowth(this.calendar.elapsedSeconds);
    // Ideas brew even without a school (25% of the old teacher rate).
    this.knowledge += KNOWLEDGE_PASSIVE_PER_SEC * dt;

    // Daily checks: family life, disasters, chronicle sampling.
    this.familyTimer += dt;
    if (this.familyTimer >= DAY_SECONDS) {
      this.familyTimer = 0;
      this.familyTick();
      this.disasterTick();
      this.dailyIllnessRoll();
      this.dailyDangerRoll();
      this.regrowStraw();
      this.reconcileStorages();
      this.history.push({
        t: this.calendar.elapsedSeconds,
        pop: this.villagers.length,
        food: Math.floor(this.foodTotal()),
        firewood: Math.floor(this.resources.firewood),
      });
      if (this.history.length > 400) this.history.shift();
    }

    // Welcome the newborns (queued so the villager loop isn't mutated mid-pass).
    if (this.newborns.length > 0) {
      this.villagers.push(...this.newborns);
      this.newborns.length = 0;
    }

    // Bury the dead.
    let anyDied = false;
    for (let i = this.villagers.length - 1; i >= 0; i--) {
      const v = this.villagers[i];
      if (!v.dead) continue;
      this.mournFamilyOf(v);
      if (v.home) v.home.occupants.splice(v.home.occupants.indexOf(v), 1);
      if (v.spouse) v.spouse.spouse = null; // widowed
      this.villagers.splice(i, 1);
      this.stats.deaths++;
      anyDied = true;
      if (v === this.baron) this.succeedBaron(v);
    }
    if (anyDied) this.reassignHousing();
    if (this.villagers.length === 0 && this.lastSeason !== null) {
      this.events.push('💀 The village has perished.');
      this.lastSeason = null; // announce only once
    }
  }

  private tickNeeds(dt: number, v: Villager): void {
    if (v.griefTimer > 0) v.griefTimer -= dt;
    // Clothes wear out on a fixed clock (owner: 90/150/240 days by tier).
    if (v.clothing !== 'none') {
      v.clothingTimer -= dt;
      if (v.clothingTimer <= 0) v.clothing = 'none';
    }
    // So do shoes (90/120/180/240 days by tier).
    if (v.shoes !== 'none') {
      v.shoeTimer -= dt;
      if (v.shoeTimer <= 0) v.shoes = 'none';
    }
    // Aging: one life-year per season.
    v.ageYears += dt / SEASON_SECONDS;
    if (v.ageYears > v.lifespan) {
      v.dead = true;
      this.events.push(`⚰️ ${v.name} died of old age (${Math.floor(v.ageYears)}).`);
      return;
    }

    // Pregnancy runs its course.
    if (v.pregnantTimer > 0) {
      v.pregnantTimer -= dt;
      if (v.pregnantTimer <= 0) {
        v.pregnantTimer = 0;
        const baby = new Villager(v.x, v.z, 0);
        baby.mother = v;
        baby.father = v.spouse;
        if (v.home && v.home.occupants.length < v.home.spec.capacity) {
          baby.home = v.home;
          v.home.occupants.push(baby);
        }
        this.newborns.push(baby);
        this.stats.births++;
        this.events.push(`👶 ${v.name} gave birth to ${baby.name}!`);
      }
    }

    v.fedTimer -= dt;
    if (v.fedTimer <= 0) {
      const meal = v.isChild ? 0.5 : 1;
      // Housed villagers eat at home from the family pantry (owner rule);
      // the homeless eat straight from central storage. During a new house's
      // 2-day grace, an empty pantry falls back to central storage too.
      let central = !v.home || v.home.state !== 'complete';
      let fed = false;
      if (!central) {
        fed = this.pantryTake(v.home!, meal);
        if (!fed && v.home!.graceTimer > 0) central = true;
      }
      if (central) fed = this.foodTotal() >= meal;
      if (fed) {
        if (central) this.consumeFood(meal);
        v.fedTimer = EAT_INTERVAL;
        v.hungerStrikes = 0;
      } else {
        v.fedTimer = NEED_RETRY;
        v.hungerStrikes++;
        if (v.hungerStrikes === 1) this.events.push(`🍒 ${v.name} is going hungry — no food in store!`);
        if (v.hungerStrikes >= STARVE_STRIKES) {
          v.dead = true;
          this.events.push(`💀 ${v.name} starved to death.`);
          return;
        }
      }
    }

    // Housed villagers are warmed by their house (tickHouses); the homeless
    // huddle at the camp fire, each burning their own firewood.
    if (v.home) return;
    const interval = this.firewoodInterval();
    if (interval !== null) {
      v.warmTimer -= dt;
      if (v.warmTimer <= 0) {
        if (this.resources.firewood >= 1) {
          this.resources.firewood -= 1;
          v.warmTimer = interval;
          v.coldStrikes = 0;
        } else {
          v.warmTimer = NEED_RETRY;
          v.coldStrikes = Math.min(v.coldStrikes + 1, MAX_COLD_STRIKES);
          if (v.coldStrikes === 1) this.events.push(`🥶 ${v.name} is freezing — no firewood!`);
          if (v.coldStrikes >= FREEZE_STRIKES + CLOTHING_WARMTH[v.clothing] && this.calendar.isWinter) {
            v.dead = true;
            this.events.push(`💀 ${v.name} froze to death.`);
          }
        }
      }
    } else {
      v.coldStrikes = 0;
      v.warmTimer = Math.max(v.warmTimer, WARM_INTERVAL * 0.5);
    }
  }

  /** Owner balance: no fires in summer, base rate spring/autumn, double in
   *  winter — and half again during a harsh winter. */
  private firewoodInterval(): number | null {
    const s = this.calendar.season;
    if (s === 'summer') return null;
    if (s === 'winter') return this.harshWinter ? WARM_INTERVAL / 3 : WARM_INTERVAL / 2;
    return WARM_INTERVAL;
  }

  /** Summer: sown fields grow on their own — 50% faster with a farmer on site. */
  private tickFields(dt: number): void {
    if (this.calendar.season !== 'summer') return;
    for (const b of this.buildings) {
      if (b.spec.kind !== 'cropField' || b.state !== 'complete') continue;
      if (b.growth <= 0 || b.growth >= 1) continue; // unsown fields stay barren
      const attended = this.villagers.some((v) => v.site === b && v.state === 'working');
      const before = b.growth;
      b.growth = Math.min(1, b.growth + FIELD_SUMMER_RATE * (attended ? 1.5 : 1) * dt);
      // Rebuild the field mesh only when growth crosses a visible step.
      if (Math.floor(before * 12) !== Math.floor(b.growth * 12)) b.visualDirty = true;
    }
  }

  /** What field work exists in the current season? */
  fieldHasWork(b: Building, season: Season): boolean {
    if (season === 'spring') {
      // Fresh sowing needs seeds in store; a part-sown field can be finished.
      if (b.growth === 0) return this.resources.seeds >= SOW_SEED_COST;
      return b.growth < FIELD_SOWN_CAP;
    }
    if (season === 'summer') return b.growth > 0 && b.growth < 1; // tending boost
    if (season === 'autumn') return b.growth > 0;
    return false;
  }

  /** Owner rates: daily illness chance 0.1% summer, 0.3% spring/autumn, 0.5% winter.
   *  Each UNTREATED sick day also carries a 1% death chance (owner rule). */
  private dailyIllnessRoll(): void {
    const season = this.calendar.season;
    const chance = season === 'summer' ? 0.001 : season === 'winter' ? 0.005 : 0.003;
    for (const v of this.villagers) {
      if (v.dead) continue;
      if (v.ill) {
        if (!v.illTreated && Math.random() < ILLNESS_DAILY_DEATH_CHANCE) {
          v.dead = true;
          this.events.push(`💀 ${v.name} died of untreated sickness.`);
        }
        continue;
      }
      // Clothing matters (owner rules): ragged ×3 in winter / ×2 in spring
      // and autumn; fine clothes −25% risk, luxury −50%; basic is neutral.
      let personal = chance * ILLNESS_CLOTHING_FACTOR[v.clothing];
      if (v.clothing === 'none') {
        personal *= season === 'winter' ? 3 : season === 'summer' ? 1 : 2;
      }
      if (Math.random() < personal) {
        v.ill = true;
        v.illTreated = false;
        v.illTimer = ILLNESS_UNTREATED_SECONDS;
        this.events.push(`🤒 ${v.name} has fallen ill.`);
      }
    }
  }

  /** Dangerous trades: an ultra-rare fatal accident per day on the job. */
  private dailyDangerRoll(): void {
    for (const v of this.villagers) {
      if (v.dead || v.isChild || !v.profession) continue;
      const fate = DANGEROUS_JOBS[v.profession];
      if (!fate) continue;
      if ((v.state === 'toWork' || v.state === 'working' || v.state === 'toHome') && Math.random() < DANGER_DAILY_CHANCE) {
        v.dead = true;
        this.events.push(`⚰️ ${v.name} ${fate}.`);
      }
    }
  }

  /** Sickness runs its course. Medicine works on its own; herbs need an
   *  assigned herbalist. Either halves the remaining illness and removes the
   *  death risk (owner rules). */
  private tickIllness(dt: number, v: Villager): void {
    if (v.dead || !v.ill) return;
    if (!v.illTreated) {
      if (this.resources.medicine >= 1) {
        this.resources.medicine -= 1;
        v.illTreated = true;
        this.events.push(`💊 ${v.name} is being treated with medicine.`);
      } else if (this.resources.herbs >= 1 && this.desired.herbalist > 0) {
        this.resources.herbs -= 1;
        v.illTreated = true;
        this.events.push(`🌿 The herbalist treats ${v.name} with herbs.`);
      }
      if (v.illTreated) v.illTimer /= 2;
    }
    v.illTimer -= dt;
    if (v.illTimer <= 0) {
      this.events.push(`💚 ${v.name} recovered.`);
      v.ill = false;
      v.illTreated = false;
    }
  }

  /** Cut straw fields come back after three years. */
  private regrowStraw(): void {
    for (let i = this.strawRegrow.length - 1; i >= 0; i--) {
      if (this.calendar.elapsedSeconds >= this.strawRegrow[i].at) {
        const { tile } = this.strawRegrow[i];
        this.strawRegrow.splice(i, 1);
        this.strawTiles.push(tile);
        this.world.straw.showTile(tile);
      }
    }
  }

  /** Re-apply quarried-out rock tiles from a save. */
  restoreRocksCut(tiles: number[]): void {
    for (const tile of tiles) {
      const i = this.rockTiles.indexOf(tile);
      if (i >= 0) this.rockTiles.splice(i, 1);
      this.rocksRemoved.push(tile);
      this.world.rocks.hideTile(tile);
    }
  }

  /** The deposit around an exhausted clay pit is spent (5-tile radius). */
  depleteClayPit(b: Building): void {
    const cx = Math.floor(b.centerX);
    const cz = Math.floor(b.centerZ);
    for (let dz = -CLAY_DEPLETE_RADIUS; dz <= CLAY_DEPLETE_RADIUS; dz++) {
      for (let dx = -CLAY_DEPLETE_RADIUS; dx <= CLAY_DEPLETE_RADIUS; dx++) {
        if (dx * dx + dz * dz > CLAY_DEPLETE_RADIUS * CLAY_DEPLETE_RADIUS) continue;
        const tx = cx + dx;
        const tz = cz + dz;
        if (tx < 0 || tz < 0 || tx >= MAP_SIZE || tz >= MAP_SIZE) continue;
        const t = tz * MAP_SIZE + tx;
        if (this.world.tiles.types[t] === TileType.Clay) this.world.tiles.types[t] = TileType.Grass;
      }
    }
  }

  /** Re-apply harvested straw tiles from a save. */
  restoreStrawCut(entries: { tile: number; at: number }[]): void {
    for (const e of entries) {
      const i = this.strawTiles.indexOf(e.tile);
      if (i >= 0) this.strawTiles.splice(i, 1);
      this.strawRegrow.push({ ...e });
      this.world.straw.hideTile(e.tile);
    }
  }

  /** Owner rule: a death costs the whole family −20 happiness for one season. */
  private mournFamilyOf(dead: Villager): void {
    for (const v of this.villagers) {
      if (v === dead || v.dead) continue;
      const isFamily =
        v === dead.spouse || v === dead.mother || v === dead.father ||
        v.mother === dead || v.father === dead ||
        (dead.mother !== null && v.mother === dead.mother) ||
        (dead.father !== null && v.father === dead.father);
      if (isFamily) v.griefTimer = GRIEF_SECONDS;
    }
  }

  // ---------------------------------------------------------------- baron

  /** The Manor is finished: raise the oldest adult man to baron (owner rule). */
  private crownFirstBaron(manor: Building): void {
    if (this.baron) return; // a second manor changes nothing
    const men = this.villagers
      .filter((v) => !v.dead && v.sex === 'male' && v.isAdult)
      .sort((a, b) => b.ageYears - a.ageYears);
    const chosen = men[0] ?? null;
    if (!chosen) return;
    this.makeBaron(chosen, manor);
    this.events.push(`👑 ${chosen.name} is raised to Baron and takes the manor!`);
  }

  /** Succession: the oldest male son inherits; fallback, the oldest adult man. */
  private succeedBaron(dead: Villager): void {
    this.baron = null;
    dead.isBaron = false;
    const sons = this.villagers
      .filter((v) => !v.dead && v !== dead && v.sex === 'male' && v.father === dead)
      .sort((a, b) => b.ageYears - a.ageYears);
    let heir = sons[0] ?? null;
    if (!heir) {
      heir = this.villagers
        .filter((v) => !v.dead && v !== dead && v.sex === 'male' && v.isAdult)
        .sort((a, b) => b.ageYears - a.ageYears)[0] ?? null;
    }
    if (!heir) return;
    const manor = this.buildings.find((b) => b.spec.kind === 'manor' && b.state === 'complete') ?? null;
    this.makeBaron(heir, manor);
    this.events.push(
      sons.length > 0
        ? `👑 Baron ${dead.name} is dead — his son ${heir.name} inherits the title.`
        : `👑 Baron ${dead.name} died without a male heir — ${heir.name} is raised to Baron.`,
    );
  }

  private makeBaron(v: Villager, manor: Building | null): void {
    this.baron = v;
    v.isBaron = true;
    if (manor) {
      // The baron's family takes the manor if it fits them.
      const head = v.spouse && v.sex === 'female' ? v.spouse : v;
      this.moveFamilyIn(head, head.spouse, manor);
    }
  }

  /** One house fire warms all occupants — 1 firewood per interval per house. */
  private tickHouses(dt: number): void {
    for (const b of this.buildings) {
      if (b.spec.capacity === 0 || b.state !== 'complete' || b.occupants.length === 0) continue;
      // Fresh move-ins get a 2-day grace before cold can bite (owner rule).
      if (b.graceTimer > 0) {
        b.graceTimer -= dt;
        b.coldStrikes = 0;
        b.warmTimer = Math.max(b.warmTimer, 5);
        for (const o of b.occupants) o.coldStrikes = 0;
        continue;
      }
      // Owner rule: a household consumes 1 pottery every season.
      if (b.potteryCount > 0) {
        b.potteryTimer -= dt;
        if (b.potteryTimer <= 0) {
          b.potteryCount--;
          b.potteryTimer = POTTERY_LIFE;
        }
      }
      const base = this.firewoodInterval();
      if (base === null) {
        // Summer: nobody is cold — clear the OCCUPANTS' strikes too (bug:
        // stale strikes froze at their spring value all summer, e.g. −90).
        b.coldStrikes = 0;
        b.warmTimer = Math.max(b.warmTimer, WARM_INTERVAL * 0.5);
        for (const o of b.occupants) o.coldStrikes = 0;
        continue;
      }
      // Better walls hold warmth longer per firewood; stone burns 25% less.
      const interval =
        b.spec.kind === 'brickHouse' || b.spec.kind === 'manor' ? base * 1.5
        : b.spec.kind === 'stoneHouse' ? base * (4 / 3)
        : base;
      b.warmTimer -= dt;
      if (b.warmTimer > 0) continue;
      // Owner rule (session 29): the hearth burns the firewood CARRIED HOME.
      if (b.firewoodStore >= 1) {
        b.firewoodStore -= 1;
        b.warmTimer = interval;
        b.coldStrikes = 0;
        for (const o of b.occupants) o.coldStrikes = 0;
      } else {
        b.warmTimer = NEED_RETRY;
        b.coldStrikes++;
        if (b.coldStrikes === 1) this.events.push('🥶 A house has gone cold — no firewood!');
        for (const o of b.occupants) {
          o.coldStrikes = Math.min(o.coldStrikes + 1, MAX_COLD_STRIKES);
          if (o.coldStrikes >= FREEZE_STRIKES + CLOTHING_WARMTH[o.clothing] && !o.dead && this.calendar.isWinter) {
            o.dead = true;
            this.events.push(`💀 ${o.name} froze to death.`);
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- family

  private completeHouses(): Building[] {
    return this.buildings.filter((b) => b.spec.capacity > 0 && b.state === 'complete');
  }

  private moveIn(v: Villager, house: Building): void {
    if (v.home) {
      const i = v.home.occupants.indexOf(v);
      if (i >= 0) v.home.occupants.splice(i, 1);
    }
    // Owner rule (session 30): a freshly occupied house gets 2 days of grace
    // before its cold/hunger states bite — time to stock wood and food.
    if (house.occupants.length === 0 && v.home !== house) {
      house.graceTimer = 2 * DAY_SECONDS;
    }
    // Strikes from the old campfire/house don't follow anyone into a new home.
    v.coldStrikes = 0;
    v.home = house;
    house.occupants.push(v);
  }

  private marry(a: Villager, b: Villager): void {
    a.spouse = b;
    b.spouse = a;
    this.events.push(`💍 ${a.name} and ${b.name} are married!`);
  }

  /** A villager's children below adulthood — they stay with their parents. */
  minorChildrenOf(a: Villager, b: Villager | null = null): Villager[] {
    return this.villagers.filter(
      (v) => !v.isAdult && (v.mother === a || v.father === a || (b !== null && (v.mother === b || v.father === b))),
    );
  }

  /** Beds a family needs: the couple plus every minor child. */
  private familySize(a: Villager, b: Villager | null): number {
    return (b ? 2 : 1) + this.minorChildrenOf(a, b).length;
  }

  /**
   * Move a couple and their minor children into a house together.
   * Owner rule: a family never moves into a house it doesn't fit — returns
   * false (and moves nobody) if the whole family can't live there.
   */
  private moveFamilyIn(a: Villager, b: Villager | null, house: Building): boolean {
    const need = this.familySize(a, b);
    const membersAlready = [a, b, ...this.minorChildrenOf(a, b)].filter((m) => m && m.home === house).length;
    if (house.spec.capacity - house.occupants.length + membersAlready < need) return false;
    this.moveIn(a, house);
    if (b) this.moveIn(b, house);
    for (const child of this.minorChildrenOf(a, b)) this.moveIn(child, house);
    return true;
  }

  private eligible(v: Villager): boolean {
    return v.ageYears >= MARRIAGE_AGE && !v.spouse && v.ageYears < OLD_AGE_MIN && v.state !== 'campaign';
  }

  /** Daily marriage / relocation / pregnancy pass (owner's rules). */
  private familyTick(): void {
    const houses = this.completeHouses();
    const emptyHouses = houses.filter((h) => h.occupants.length === 0);

    // 1) Daily matchmaking (owner fixes, session 32): each bachelor has a
    //    chance to wed the CLOSEST-AGED eligible woman — never more than 10
    //    years apart, so no strange pairings. Newlyweds claim an empty house
    //    that fits; failing that they squeeze into either partner's home.
    {
      const men = this.villagers.filter((v) => this.eligible(v) && v.sex === 'male');
      const women = this.villagers.filter((v) => this.eligible(v) && v.sex === 'female');
      for (const groom of men) {
        if (women.length === 0) break;
        if (Math.random() >= MARRIAGE_DAILY_CHANCE) continue;
        let bride: Villager | null = null;
        let bestGap = MARRIAGE_MAX_AGE_GAP + 0.001;
        for (const w of women) {
          const gap = Math.abs(w.ageYears - groom.ageYears);
          if (gap < bestGap) {
            bestGap = gap;
            bride = w;
          }
        }
        if (!bride) continue;
        this.marry(groom, bride);
        const target = emptyHouses.find((e) => e.spec.capacity >= this.familySize(groom, bride));
        if (target) {
          this.moveFamilyIn(groom, bride, target);
        } else if (groom.home && groom.home !== bride.home && groom.home.occupants.length < groom.home.spec.capacity) {
          this.moveIn(bride, groom.home);
        } else if (bride.home && bride.home !== groom.home && bride.home.occupants.length < bride.home.spec.capacity) {
          this.moveIn(groom, bride.home);
        }
        break; // one wedding a day is plenty
      }
    }

    // 1b) Two families under one roof: one couple (with its children) claims
    //     an empty house it actually fits. This is how new houses fill up.
    if (emptyHouses.length > 0) {
      outer: for (const h of houses) {
        const couples: Villager[] = [];
        for (const o of h.occupants) {
          if (o.sex === 'male' && o.spouse && o.spouse.home === h) couples.push(o);
        }
        if (couples.length >= 2) {
          const mover = couples[1];
          const target = emptyHouses.find((e) => e.spec.capacity >= this.familySize(mover, mover.spouse));
          if (target && this.moveFamilyIn(mover, mover.spouse, target)) {
            this.events.push(`🏠 ${mover.name}'s family moved into their own house.`);
          }
          break outer;
        }
      }
    }

    // (The old separate cohabit rule is folded into the matchmaker above —
    // housemates of marriageable age are simply each other's closest match.)

    // 3) Grown singles lodging in a married couple's house move out — but a
    //    couple's own children stay home until they become adults.
    for (const h of houses) {
      const coupleMembers = h.occupants.filter((o) => o.spouse && o.spouse.home === h);
      if (coupleMembers.length === 0) continue;
      // eligible() = unmarried adult, so a couple's minor children never leave;
      // grown children move out like any other single lodger.
      const lodger = h.occupants.find((o) => this.eligible(o));
      if (!lodger) continue;
      const target = houses.find(
        (t) => t !== h && t.occupants.length < t.spec.capacity && !t.occupants.some((o) => o.spouse),
      );
      if (target) {
        this.moveIn(lodger, target);
        break;
      }
    }

    // 5) Daily housing sweep so empty beds never linger while people camp outside.
    this.reassignHousing();

    // 4) Married couples living together: pregnancy chance fades with the
    //    mother's age (full at 16, zero at 50 — owner rule).
    for (const v of this.villagers) {
      if (v.sex !== 'female' || !v.spouse || v.pregnantTimer > 0) continue;
      if (!v.home || v.spouse.home !== v.home) continue;
      if (v.ageYears < MARRIAGE_AGE || v.ageYears >= FERTILITY_MAX_AGE) continue;
      if (v.home.occupants.length >= v.home.spec.capacity) continue;
      // Owner rule: birth chance depends on the mother's age — ramps up to a
      // peak from 20 to 30, then fades toward 50.
      const age = v.ageYears;
      const fertility =
        age < 20 ? 0.5 + (age - MARRIAGE_AGE) / 8
        : age <= 30 ? 1
        : Math.max(0, (FERTILITY_MAX_AGE - age) / (FERTILITY_MAX_AGE - 30));
      // Owner rule (session 29): a warm hearth raises the chance 50%, a cold
      // house halves it.
      const hearth = v.home.coldStrikes > 0 ? 0.5 : 1.5;
      if (Math.random() < PREGNANCY_CHANCE * fertility * hearth) {
        v.pregnantTimer = PREGNANCY_SECONDS;
        this.events.push(`🤰 ${v.name} is expecting a child.`);
      }
    }

    // 5) Daily diet refresh: +1 happiness per distinct food AT HOME (owner rule).
    for (const v of this.villagers) {
      if (v.home && v.home.state === 'complete') {
        v.dietBonus = Object.values(v.home.pantry).filter((n) => (n ?? 0) >= 1).length;
      } else {
        v.dietBonus = this.foodTotal() > 0 ? 1 : 0;
      }
    }

    // 6) Temple blessing: +10 happiness for up to 100 villagers per temple (owner rule).
    const templeCap =
      this.buildings.filter((b) => b.spec.kind === 'temple' && b.state === 'complete').length * 100;
    this.villagers.forEach((v, i) => {
      v.templeBonus = i < templeCap ? 10 : 0;
    });

    // 7) Going ragged hurts by season: −40 winter, −20 spring/autumn, −10 summer.
    const season2 = this.calendar.season;
    const raggedNow = season2 === 'winter' ? 40 : season2 === 'summer' ? 10 : 20;
    for (const v of this.villagers) {
      v.raggedPenalty = v.clothing === 'none' ? raggedNow : 0;
    }

    // 8) School-age children without a school seat run house chores (owner rule).
    const seats =
      this.buildings.filter((b) => b.spec.kind === 'school' && b.state === 'complete').length * 12;
    let seated = 0;
    for (const v of this.villagers) {
      if (!v.isChild || v.isBaby) continue;
      v.choreDuty = seated >= seats;
      if (seated < seats) seated++;
    }
  }

  /** Daily disaster roll: summer fires, wolves in the shoulder seasons. */
  private disasterTick(): void {
    const season = this.calendar.season;
    if (season === 'summer' && Math.random() < 0.015) {
      // A wooden building catches fire and must be partially rebuilt.
      const flammable = this.buildings.filter(
        (b) =>
          b.state === 'complete' && b.spec.kind !== 'brickHouse' && b.spec.kind !== 'brickOven' &&
          b.spec.kind !== 'clayPit' && b.spec.kind !== 'manor' && b.spec.kind !== 'temple',
      );
      if (flammable.length > 0) {
        const b = flammable[Math.floor(Math.random() * flammable.length)];
        b.workRemaining = b.spec.buildSeconds * 0.6;
        for (const m of Object.keys(b.delivered) as (keyof typeof b.delivered)[]) {
          b.delivered[m] = Math.floor((b.delivered[m] ?? 0) / 2);
        }
        for (const o of [...b.occupants]) {
          o.home = null;
        }
        b.occupants.length = 0;
        b.visualDirty = true;
        this.events.push(`🔥 Fire! The ${b.spec.label.toLowerCase()} burned — builders must repair it.`);
      }
    }
    if ((season === 'spring' || season === 'autumn') && Math.random() < 0.01) {
      const hunters = this.countByProfession().hunter;
      if (hunters > 0) {
        this.events.push('🐺 Wolves prowled the woods — your hunters drove them off.');
      } else {
        const outdoors = this.villagers.filter((v) => (v.state === 'toWork' || v.state === 'working') && !v.isChild);
        if (outdoors.length > 0) {
          const victim = outdoors[Math.floor(Math.random() * outdoors.length)];
          victim.dead = true;
          this.events.push(`🐺 Wolves! ${victim.name} was taken in the forest. Hunters would keep them at bay.`);
        }
      }
    }
  }

  /** Fill empty beds — families stay together: couples with their minor
   *  children first, then homeless children join a housed parent, then the
   *  rest oldest-first. */
  reassignHousing(): void {
    const houses = this.completeHouses();
    // Homeless couples (with children) into houses with room for the WHOLE
    // family — a family that doesn't fit somewhere stays together outside.
    for (const v of this.villagers) {
      if (v.home || !v.spouse || v.spouse.home || v.sex !== 'male') continue;
      const need = this.familySize(v, v.spouse);
      const house = houses.find((h) => h.spec.capacity - h.occupants.length >= need);
      if (!house) continue;
      this.moveFamilyIn(v, v.spouse, house);
    }
    // Homeless single parents (widows/widowers) with their children.
    for (const v of this.villagers) {
      if (v.home || v.spouse || !v.isAdult) continue;
      const kids = this.minorChildrenOf(v);
      if (kids.length === 0) continue;
      const need = this.familySize(v, null);
      const house = houses.find((h) => h.spec.capacity - h.occupants.length >= need);
      if (house) this.moveFamilyIn(v, null, house);
    }
    // Homeless minors reunite with a housed parent when there's a bed.
    for (const v of this.villagers) {
      if (v.home || v.isAdult) continue;
      const parentHome = v.mother?.home ?? v.father?.home ?? null;
      if (parentHome && parentHome.occupants.length < parentHome.spec.capacity) {
        this.moveIn(v, parentHome);
      }
    }
    // Remaining singles without dependents fill leftover beds (families are
    // never split across houses).
    const homeless = this.villagers
      .filter((v) => !v.home && !v.spouse && (v.isAdult ? this.minorChildrenOf(v).length === 0 : true))
      .sort((a, b) => b.ageYears - a.ageYears);
    for (const b of houses) {
      while (b.occupants.length < b.spec.capacity && homeless.length > 0) {
        const v = homeless.shift()!;
        this.moveIn(v, b);
      }
    }
  }

  houseCount(): number {
    return this.buildings.filter((b) => b.spec.capacity > 0 && b.state === 'complete').length;
  }

  /** Owner house tiers: wooden 10 / stone 16 / brick & manor 20 firewood. */
  houseFirewoodCap(b: Building): number {
    if (b.spec.kind === 'house') return 10;
    if (b.spec.kind === 'stoneHouse') return 16;
    if (b.spec.kind === 'brickHouse' || b.spec.kind === 'manor') return 20;
    return 0;
  }

  /** Owner house tiers: wooden 5 / stone 8 / brick & manor 10 pots. */
  housePotteryCap(b: Building): number {
    if (b.spec.kind === 'house') return 5;
    if (b.spec.kind === 'stoneHouse') return 8;
    if (b.spec.kind === 'brickHouse' || b.spec.kind === 'manor') return 10;
    return 0;
  }

  bedCount(): number {
    let beds = 0;
    for (const b of this.buildings) {
      if (b.spec.capacity > 0 && b.state === 'complete') beds += b.spec.capacity;
    }
    return beds;
  }

  homelessCount(): number {
    return this.villagers.filter((v) => !v.home).length;
  }

  // ---------------------------------------------------------------- demographics

  childrenCount(): number {
    return this.villagers.filter((v) => v.isChild).length;
  }

  adultCount(sex?: 'male' | 'female'): number {
    return this.villagers.filter((v) => !v.isChild && (!sex || v.sex === sex)).length;
  }

  /** School-age children (past baby age) attending, up to 12 per school. */
  studentCount(): number {
    const schools = this.buildings.filter((b) => b.spec.kind === 'school' && b.state === 'complete').length;
    const schoolAge = this.villagers.filter((v) => v.isChild && !v.isBaby).length;
    return Math.min(schoolAge, schools * 12);
  }

  // ---------------------------------------------------------------- food

  foodTotal(): number {
    return FOOD_KINDS.reduce((s, k) => s + this.resources[k], 0);
  }

  /** Central storage + every home pantry (owner formula base). */
  totalFoodReserve(): number {
    let sum = this.foodTotal();
    for (const b of this.completeHouses()) sum += b.pantryTotal();
    return sum;
  }

  /** The STATIC pantry limit shown to the player (owner rule, session 30). */
  static readonly PANTRY_LIMIT = 50;
  /** Minimum food every household keeps wanting (owner rule). */
  static readonly PANTRY_MIN_WANT = 10;

  /** Effective (hidden) pantry limit: the dynamic share of the reserve,
   *  never above the static 50 — but a household always wants at least 10. */
  houseFoodCap(): number {
    const homes = this.completeHouses().length;
    if (homes === 0) return 0;
    const dynamic = (1.5 * this.totalFoodReserve()) / homes;
    return Math.max(Village.PANTRY_MIN_WANT, Math.min(Village.PANTRY_LIMIT, dynamic));
  }

  /** Should this villager fetch food, firewood, or a pot for the household?
   *  Chore-duty children (school-age, no school seat) may run errands too. */
  maybeStartFoodRun(v: Villager): boolean {
    const home = v.home;
    if (!home || home.state !== 'complete') return false;
    if (v.isChild && (v.isBaby || !v.choreDuty)) return false;
    if (this.calendar.elapsedSeconds < v.nextShopTry) return false; // last trip came home empty
    const needsPot = home.potteryCount < this.housePotteryCap(home) && this.resources.pottery >= 1;
    const needsFuel = home.firewoodStore < this.houseFirewoodCap(home) / 2 && this.resources.firewood >= 1;
    if (this.foodTotal() < 1 && !needsPot && !needsFuel) return false; // nothing to fetch
    // One shopper per household at a time.
    if (home.occupants.some((o) => o !== v && o.foodRun)) return false;
    const pantry = home.pantryTotal();
    const cap = this.houseFoodCap();
    // Owner rule: below 10 food the household keeps wanting more, no excuses.
    const starvedShelf = pantry < Village.PANTRY_MIN_WANT && this.foodTotal() >= 1;
    if (!needsPot && !needsFuel && !starvedShelf) {
      // Carry until cap − 4; with an empty pantry always fetch whatever exists.
      if (pantry > 0 && pantry >= cap - 4) return false;
      // Owner rule (session 26): a household already above half its limit is
      // only 25% willing to shop — the rest is left for hungrier families.
      if (pantry >= cap / 2 && Math.random() > 0.25) return false;
    }
    v.foodRun = true;
    // Head for a storage that actually HOLDS what we want (owner rule).
    const wanted: ResourceKind[] = [...FOOD_KINDS];
    if (needsPot) wanted.push('pottery');
    if (needsFuel) wanted.push('firewood');
    v.navigate(this.pathToSupply(v, wanted), 'toPickup');
    return true;
  }

  /** At the storage: load a diverse basket for the pantry. */
  foodPickup(v: Villager): void {
    const home = v.home;
    if (!home || home.state !== 'complete') {
      v.foodRun = false;
      return v.goIdle();
    }
    // Everything is taken from THIS storage's own ledger (owner rule).
    const depot = this.nearestStorage(v.x, v.z);
    // Missing household pot rides along in the basket (owner rule, session 27).
    // No ledger requirement: pots usually sit on the potter's SHELF, which
    // counts in the village total but in no storage ledger — demanding one
    // from this depot locked every shopper into an endless empty-handed loop
    // (owner bug, session 35). Reconcile trues the shelf up afterwards.
    let pot = 0;
    if (home.potteryCount < this.housePotteryCap(home) && this.resources.pottery >= 1) {
      this.resources.pottery -= 1;
      if (depot) depot.store.pottery = Math.max(0, (depot.store.pottery ?? 0) - 1);
      pot = 1;
    }
    const fuelNeed = Math.max(0, this.houseFirewoodCap(home) - home.firewoodStore);
    const pantry = home.pantryTotal();
    let budget = haulCapacity(v.tool);
    if (pantry > 0) {
      budget = Math.min(budget, Math.max(0, Math.ceil(this.houseFoodCap() - pantry)));
    }
    if (budget <= 0 && pot === 0 && (fuelNeed <= 0 || this.resources.firewood < 1)) {
      v.foodRun = false;
      v.nextShopTry = this.calendar.elapsedSeconds + DAY_SECONDS;
      return v.goIdle();
    }
    // Prefer kinds the pantry lacks (diversity = happiness), then abundance.
    const ranked = [...FOOD_KINDS].sort((a, b) => {
      const aHas = (home.pantry[a] ?? 0) > 0 ? 1 : 0;
      const bHas = (home.pantry[b] ?? 0) > 0 ? 1 : 0;
      if (aHas !== bHas) return aHas - bHas;
      return this.resources[b] - this.resources[a];
    });
    const basket: Partial<Record<ResourceKind, number>> = {};
    let picked = 0;
    // First pass takes only what THIS storage holds; if its shelves are bare
    // (stale ledger), a second pass falls back to the village total.
    for (const strict of [true, false]) {
      while (picked < budget) {
        let took = false;
        for (const kind of ranked) {
          if (picked >= budget) break;
          if (this.resources[kind] < 1) continue;
          if (strict && depot && (depot.store[kind] ?? 0) < 1) continue;
          this.resources[kind] -= 1;
          if (depot) depot.store[kind] = Math.max(0, (depot.store[kind] ?? 0) - 1);
          basket[kind] = (basket[kind] ?? 0) + 1;
          picked++;
          took = true;
        }
        if (!took) break;
      }
      if (picked > 0) break;
    }
    // Firewood tops off the load — the hearth only burns what's carried home
    // (owner rule, session 29).
    const fuelSlots = Math.max(0, haulCapacity(v.tool) - picked);
    const fuelTake = Math.min(fuelSlots, fuelNeed, Math.floor(this.resources.firewood));
    if (fuelTake > 0) {
      this.resources.firewood -= fuelTake;
      if (depot) depot.store.firewood = Math.max(0, (depot.store.firewood ?? 0) - fuelTake);
      basket.firewood = fuelTake;
    }
    if (picked === 0 && pot === 0 && fuelTake === 0) {
      v.foodRun = false;
      v.nextShopTry = this.calendar.elapsedSeconds + DAY_SECONDS;
      return v.goIdle();
    }
    if (pot > 0) basket.pottery = pot;
    v.foodCarry = basket;
    v.navigate(this.pathToTile(v, this.entranceOf(home)), 'toHome');
  }

  /** At the front door: stock the pantry. */
  deliverPantry(v: Villager): void {
    const home = v.home;
    if (home && home.state === 'complete' && v.foodCarry) {
      for (const [kind, n] of Object.entries(v.foodCarry)) {
        if (kind === 'pottery') {
          // The new pot goes on the shelf, not in the pantry.
          if (home.potteryCount === 0) home.potteryTimer = POTTERY_LIFE;
          home.potteryCount = Math.min(this.housePotteryCap(home), home.potteryCount + (n ?? 0));
          continue;
        }
        if (kind === 'firewood') {
          home.firewoodStore = Math.min(this.houseFirewoodCap(home), home.firewoodStore + (n ?? 0));
          continue;
        }
        home.pantry[kind] = (home.pantry[kind] ?? 0) + (n ?? 0);
      }
    } else if (v.foodCarry) {
      // House vanished mid-trip: back to central storage.
      for (const [kind, n] of Object.entries(v.foodCarry)) this.deposit(kind as ResourceKind, n ?? 0);
    }
    v.foodCarry = null;
    v.foodRun = false;
    v.goIdle(0.3);
  }

  /** Eat one meal from a home pantry (largest stock first). */
  private pantryTake(home: Building, amount: number): boolean {
    if (home.pantryTotal() < amount) return false;
    while (amount > 0) {
      let best: string | null = null;
      for (const [kind, n] of Object.entries(home.pantry)) {
        if ((n ?? 0) > 0 && (best === null || (home.pantry[kind] ?? 0) > (home.pantry[best] ?? 0))) best = kind;
      }
      if (!best) return false;
      const take = Math.min(1, amount, home.pantry[best] ?? 0);
      home.pantry[best] = (home.pantry[best] ?? 0) - take;
      amount -= take;
    }
    return true;
  }

  /** Eat from the largest stock first. */
  consumeFood(amount: number): void {
    while (amount > 0) {
      let best: ResourceKind | null = null;
      for (const k of FOOD_KINDS) {
        if (this.resources[k] > 0 && (best === null || this.resources[k] > this.resources[best])) best = k;
      }
      if (!best) return;
      const take = Math.min(amount, this.resources[best], 1);
      this.resources[best] -= take;
      amount -= take;
    }
  }

  /** How many different foods the stores hold (1 unit+). Variety = happiness. */
  foodDiversity(): number {
    return FOOD_KINDS.filter((k) => this.resources[k] >= 1).length;
  }

  /** Days of food left at the current population's eating rate. */
  foodDaysLeft(): number {
    const perSecond = this.villagers.reduce((s, v) => s + (v.isChild ? 0.5 : 1), 0) / EAT_INTERVAL;
    if (perSecond <= 0) return Infinity;
    return this.totalFoodReserve() / perSecond / 20; // 20s per calendar day
  }

  /** Days of firewood left at winter burn rate (storage + home stores). */
  firewoodDaysLeft(): number {
    const houses = this.buildings.filter((b) => b.spec.capacity > 0 && b.state === 'complete' && b.occupants.length > 0).length;
    const homeless = this.homelessCount();
    const perSecond = (houses + homeless) / (WARM_INTERVAL / 2);
    if (perSecond <= 0) return Infinity;
    let wood = this.resources.firewood;
    for (const b of this.buildings) wood += b.firewoodStore;
    return wood / perSecond / 20;
  }

  /** Entrance tile of the first completed trading post, or null. */
  tradingPostTile(): number | null {
    for (const b of this.buildings) {
      if (b.spec.kind === 'tradingPost' && b.state === 'complete') return this.entranceOf(b);
    }
    return null;
  }

  /** Public pathfinding between two tiles (used by caravans). */
  findPathTiles(from: number, to: number): number[] | null {
    return this.grid.findPath(from % MAP_SIZE, (from / MAP_SIZE) | 0, to % MAP_SIZE, (to / MAP_SIZE) | 0);
  }

  // ---------------------------------------------------------------- roads

  isRoadAt(x: number, z: number): boolean {
    return this.roads.has(Math.floor(z) * MAP_SIZE + Math.floor(x));
  }

  /** Movement speed multiplier from the road under (x,z): dirt ×1.25, stone ×1.5. */
  roadFactorAt(x: number, z: number): number {
    const kind = this.roads.get(Math.floor(z) * MAP_SIZE + Math.floor(x));
    return kind ? ROAD_FACTOR[kind] : 1;
  }

  /** Terrain never blocks roads — builders cut and fill — only water/buildings do. */
  roadTileOk(tx: number, tz: number): boolean {
    if (tx < 1 || tz < 1 || tx >= MAP_SIZE - 1 || tz >= MAP_SIZE - 1) return false;
    const tile = tz * MAP_SIZE + tx;
    return this.roads.has(tile) || this.grid.isWalkable(tx, tz);
  }

  /** Bresenham line of tiles between two points. */
  roadLine(x0: number, z0: number, x1: number, z1: number): number[] {
    const tiles: number[] = [];
    let x = x0;
    let z = z0;
    const dx = Math.abs(x1 - x0);
    const dz = Math.abs(z1 - z0);
    const sx = x0 < x1 ? 1 : -1;
    const sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;
    for (;;) {
      tiles.push(z * MAP_SIZE + x);
      if (x === x1 && z === z1) break;
      const e2 = 2 * err;
      if (e2 > -dz) {
        err -= dz;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        z += sz;
      }
    }
    return tiles;
  }

  /** Dirt roads cost no materials — only water and buildings block them. */
  canLayRoadLine(tiles: number[]): boolean {
    return !tiles.some((t) => !this.roadTileOk(t % MAP_SIZE, (t / MAP_SIZE) | 0));
  }

  private setCornerHeight(cx: number, cz: number, h: number): void {
    const V = MAP_SIZE + 1;
    const i = cz * V + cx;
    this.world.terrain.heights[i] = h;
    (this.world.visualRefs.terrainMesh.geometry.getAttribute('position')).setY(i, h);
  }

  /**
   * Lay a road line: terrain along it is cut/filled to a straight, levelled
   * grade between the endpoints, with the flanking tiles blended halfway
   * (owner rule). 1 stone per new tile.
   */
  layRoadLine(tiles: number[], kind: RoadKind = 'dirt'): boolean {
    if (tiles.length === 0 || !this.canLayRoadLine(tiles)) return false;

    // Levelled grade from start height to end height.
    const t0 = tiles[0];
    const t1 = tiles[tiles.length - 1];
    const h0 = this.world.terrain.heightAt((t0 % MAP_SIZE) + 0.5, ((t0 / MAP_SIZE) | 0) + 0.5);
    const h1 = this.world.terrain.heightAt((t1 % MAP_SIZE) + 0.5, ((t1 / MAP_SIZE) | 0) + 0.5);
    const targets = new Map<number, number>(); // corner index -> height
    const V = MAP_SIZE + 1;
    tiles.forEach((tile, i) => {
      const grade = tiles.length === 1 ? h0 : h0 + ((h1 - h0) * i) / (tiles.length - 1);
      const tx = tile % MAP_SIZE;
      const tz = (tile / MAP_SIZE) | 0;
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const ci = (tz + dz) * V + (tx + dx);
        // Where road tiles meet, average their grades for a smooth joint.
        targets.set(ci, targets.has(ci) ? (targets.get(ci)! + grade) / 2 : grade);
      }
    });
    for (const [ci, h] of targets) this.setCornerHeight(ci % V, (ci / V) | 0, h);
    // Blend the shoulder corners halfway toward the roadbed.
    for (const tile of tiles) {
      const tx = tile % MAP_SIZE;
      const tz = (tile / MAP_SIZE) | 0;
      for (let dz = -1; dz <= 2; dz++) {
        for (let dx = -1; dx <= 2; dx++) {
          const cx = tx + dx;
          const cz = tz + dz;
          if (cx < 0 || cz < 0 || cx > MAP_SIZE || cz > MAP_SIZE) continue;
          const ci = cz * V + cx;
          if (targets.has(ci)) continue;
          const near = this.world.terrain.heights[ci];
          const roadH = targets.get((tz + Math.max(0, Math.min(1, dz))) * V + (tx + Math.max(0, Math.min(1, dx))));
          if (roadH !== undefined) this.setCornerHeight(cx, cz, (near + roadH) / 2);
        }
      }
    }
    (this.world.visualRefs.terrainMesh.geometry.getAttribute('position')).needsUpdate = true;

    // Builders do the paving (owner rule): each tile becomes a pending job.
    // Stone roads cost 1 stone per NEW stone tile; dirt is free. Dirt roads
    // can be upgraded to stone.
    const jobKind = kind === 'stone' ? 'stoneRoad' : 'road';
    const newTiles = tiles.filter(
      (tile) => this.roads.get(tile) !== kind && !this.pendingWorks.some((p) => p.tile === tile),
    );
    if (kind === 'stone') {
      const cost = newTiles.length * STONE_ROAD_COST;
      if (this.resources.stone < cost) return false;
      this.resources.stone -= cost;
    }
    for (const tile of newTiles) {
      this.pendingWorks.push({ tile, kind: jobKind, work: kind === 'stone' ? 4 : 3 });
    }
    return true;
  }

  canAffordStoneRoad(count: number): boolean {
    return this.resources.stone >= count * STONE_ROAD_COST;
  }

  /** Called by a builder when a pending road/wall tile is finished. */
  completePendingWork(pw: { tile: number; kind: 'road' | 'stoneRoad' | WallKind }): void {
    if (pw.kind === 'road' || pw.kind === 'stoneRoad') {
      this.roads.set(pw.tile, pw.kind === 'stoneRoad' ? 'stone' : 'dirt');
      this.grid.setRoad(pw.tile, true);
    } else {
      this.walls.set(pw.tile, pw.kind);
      if (!WALL_DEFS[pw.kind].gate) this.grid.setWalkable(pw.tile, false);
    }
    const i = this.pendingWorks.findIndex((p) => p.tile === pw.tile && p.kind === pw.kind);
    if (i >= 0) this.pendingWorks.splice(i, 1);
  }

  /** Restore a road from a save (no cost). */
  restoreRoad(tile: number, kind: RoadKind = 'dirt'): void {
    this.roads.set(tile, kind);
    this.grid.setRoad(tile, true);
  }

  // ---------------------------------------------------------------- walls

  wallTileOk(tx: number, tz: number): boolean {
    if (tx < 1 || tz < 1 || tx >= MAP_SIZE - 1 || tz >= MAP_SIZE - 1) return false;
    const tile = tz * MAP_SIZE + tx;
    return (
      !this.walls.has(tile) && !this.roads.has(tile) &&
      !this.pendingWorks.some((p) => p.tile === tile) &&
      this.grid.isWalkable(tx, tz)
    );
  }

  canAffordWalls(kind: WallKind, count: number): boolean {
    const cost = WALL_DEFS[kind].cost;
    return (this.resources.wood >= (cost.wood ?? 0) * count) && (this.resources.stone >= (cost.stone ?? 0) * count);
  }

  /** Stone fortifications need Feudalism (owner rule); timber is always open. */
  isWallUnlocked(kind: WallKind): boolean {
    if (kind === 'stoneWall' || kind === 'stoneGate') return this.researched.has('feudalism');
    return true;
  }

  canLayWallLine(tiles: number[], kind: WallKind): boolean {
    if (!this.isWallUnlocked(kind)) return false;
    if (tiles.some((t) => !this.wallTileOk(t % MAP_SIZE, (t / MAP_SIZE) | 0))) return false;
    return this.canAffordWalls(kind, tiles.length);
  }

  layWallLine(tiles: number[], kind: WallKind): boolean {
    if (tiles.length === 0 || !this.canLayWallLine(tiles, kind)) return false;
    const cost = WALL_DEFS[kind].cost;
    this.resources.wood -= (cost.wood ?? 0) * tiles.length;
    this.resources.stone -= (cost.stone ?? 0) * tiles.length;
    // Builders raise the walls (owner rule); gates take longest.
    const work = WALL_DEFS[kind].gate ? 8 : 4;
    for (const tile of tiles) {
      if (this.pendingWorks.some((p) => p.tile === tile)) continue;
      this.pendingWorks.push({ tile, kind, work });
    }
    return true;
  }

  restoreWall(tile: number, kind: WallKind): void {
    this.walls.set(tile, kind);
    if (!WALL_DEFS[kind].gate) this.grid.setWalkable(tile, false);
  }

  fortificationBonus(): number {
    let sum = 0;
    for (const kind of this.walls.values()) sum += WALL_DEFS[kind].defense;
    return Math.min(14, sum);
  }

  deerNear(x: number, z: number, radius: number): number {
    let n = 0;
    for (const d of this.animals.deer) {
      if (d.alive && (d.x - x) ** 2 + (d.z - z) ** 2 < radius * radius) n++;
    }
    return n;
  }

  buildingAtTile(tile: number): Building | null {
    for (const b of this.buildings) {
      if (b.containsTile(tile)) return b;
    }
    return null;
  }

  /** Active workers assigned to a specific building (by entrance/site match). */
  workersAt(b: Building): Villager[] {
    return this.villagers.filter(
      (v) => v.state !== 'idle' && (v.site === b || v.targetTile === b.entranceTile),
    );
  }

  // ---------------------------------------------------------------- placement

  /** Is footprint tile (dx,dz) part of the fishing hut's dock half?
   *  The dock is the local +X half; rotation maps it to E/S/W/N. */
  private static isDockTile(rot: number, w: number, d: number, dx: number, dz: number): boolean {
    const r = rot % 4;
    return r === 0 ? dx >= w - 2 : r === 1 ? dz >= d - 2 : r === 2 ? dx <= 1 : dz <= 1;
  }

  canPlace(kind: BuildingKind, ax: number, az: number, rot = 0): boolean {
    if (!this.isBuildingUnlocked(kind)) return false;
    const spec = specFor(kind, rot);
    if (ax < 1 || az < 1 || ax + spec.w >= MAP_SIZE - 1 || az + spec.d >= MAP_SIZE - 1) return false;
    const fishing = kind === 'fishingHut';
    let nearWater = false;
    let nearClay = false;
    let nearOre = false;
    let dockTouchesWater = false;
    for (let dz = -1; dz <= spec.d; dz++) {
      for (let dx = -1; dx <= spec.w; dx++) {
        const x = ax + dx;
        const z = az + dz;
        if (x < 0 || z < 0 || x >= MAP_SIZE || z >= MAP_SIZE) continue;
        const t = this.world.tiles.types[z * MAP_SIZE + x];
        const onEdge = dx === -1 || dz === -1 || dx === spec.w || dz === spec.d;
        if (t === TileType.Clay) nearClay = true;
        if (this.world.tiles.ores[z * MAP_SIZE + x] !== OreType.None) nearOre = true;
        if (onEdge) continue;
        // Fishing needs REAL water — the shallow forest clay ponds hold no fish.
        if (this.hasFishableWaterNear(x, z, 2)) nearWater = true;
        // Owner rule: the fishing hut's dock half may stand ON the water
        // (that's the point of a dock) — the hut half obeys the land rules.
        if (fishing && Village.isDockTile(rot, spec.w, spec.d, dx, dz)) {
          if (t === TileType.Water) {
            dockTouchesWater = true;
            // Water is never walkable, so guard against overlapping another dock.
            if (this.buildings.some((ob) => ob.containsTile(z * MAP_SIZE + x))) return false;
            continue;
          }
          // Land dock tile: does it border water on any side?
          for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
            if (nx < 0 || nz < 0 || nx >= MAP_SIZE || nz >= MAP_SIZE) continue;
            if (this.world.tiles.types[nz * MAP_SIZE + nx] === TileType.Water) dockTouchesWater = true;
          }
        }
        // Builders clear forest, so forest tiles are buildable too.
        // Mines stand on bare rock.
        const allowed =
          t === TileType.Grass || t === TileType.Straw || t === TileType.Forest ||
          ((spec.needsWater || spec.needsClay) && t === TileType.Clay) ||
          (spec.needsOre === true && t === TileType.Rock);
        if (!allowed) return false;
        if (!this.grid.isWalkable(x, z)) return false; // occupied by another building
        // Owner rule (session 30): never build over roads, walls, or planned works.
        const t2 = z * MAP_SIZE + x;
        if (this.roads.has(t2) || this.walls.has(t2) || this.pendingWorks.some((p) => p.tile === t2)) return false;
      }
    }
    if (spec.needsWater && !nearWater) return false;
    if (fishing && !dockTouchesWater) return false;
    if (spec.needsClay && !nearClay) return false;
    if (spec.needsOre && !nearOre) return false;
    // Ground can be somewhat uneven — builders flatten it — but not a cliff.
    let min = Infinity;
    let max = -Infinity;
    const V = MAP_SIZE + 1;
    for (let dz = 0; dz <= spec.d; dz++) {
      for (let dx = 0; dx <= spec.w; dx++) {
        const h = this.world.terrain.heights[(az + dz) * V + (ax + dx)];
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
    }
    return max - min < 2.2;
  }

  /** Deep (non-shallow) water within `radius` tiles of (tx,tz)? */
  private hasFishableWaterNear(tx: number, tz: number, radius: number): boolean {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = tx + dx;
        const z = tz + dz;
        if (x < 0 || z < 0 || x >= MAP_SIZE || z >= MAP_SIZE) continue;
        const i = z * MAP_SIZE + x;
        if (this.world.tiles.types[i] === TileType.Water && !this.world.tiles.shallow[i]) return true;
      }
    }
    return false;
  }

  /** Clear trees off the footprint and entrance, level the ground (average height). */
  private flattenAndClear(b: Building): void {
    for (const tile of b.footprintTiles()) this.world.forest.clearTile(tile);
    this.world.forest.clearTile(b.entranceTile); // keep the gathering corner open

    // Fishing huts: only the hut half is levelled — the dock stands on posts
    // over the shore/water, and the lakebed must not be reshaped.
    let x0 = 0;
    let x1 = b.spec.w;
    let z0 = 0;
    let z1 = b.spec.d;
    if (b.spec.kind === 'fishingHut') {
      const r = b.rot % 4;
      if (r === 0) x1 = b.spec.w - 2;
      else if (r === 1) z1 = b.spec.d - 2;
      else if (r === 2) x0 = 2;
      else z0 = 2;
    }
    const V = MAP_SIZE + 1;
    let sum = 0;
    let n = 0;
    for (let dz = z0; dz <= z1; dz++) {
      for (let dx = x0; dx <= x1; dx++) {
        sum += this.world.terrain.heights[(b.anchorZ + dz) * V + (b.anchorX + dx)];
        n++;
      }
    }
    const avg = sum / n;
    const posAttr = this.world.visualRefs.terrainMesh.geometry.getAttribute('position');
    for (let dz = z0; dz <= z1; dz++) {
      for (let dx = x0; dx <= x1; dx++) {
        const i = (b.anchorZ + dz) * V + (b.anchorX + dx);
        this.world.terrain.heights[i] = avg;
        posAttr.setY(i, avg);
      }
    }
    posAttr.needsUpdate = true;
  }

  // ------------------------------------------------------- demolish/upgrade

  /** Cancel an unstarted site (no materials delivered yet) — free, instant. */
  cancelBuilding(b: Building): boolean {
    if (b.state === 'complete' || b.totalDelivered() > 0) return false;
    this.removeBuilding(b);
    this.events.push(`✖️ ${b.spec.label} site cancelled.`);
    return true;
  }

  /** Mark for tear-down: builders dismantle it; half the materials come back. */
  markDemolition(b: Building): void {
    if (b.demolition) return;
    // Owner rule: never demolish the LAST storage; others are emptied first.
    if ((b.spec.kind === 'stockpile' || b.spec.kind === 'storageShed') && this.storages().length <= 1) {
      this.events.push('⚠️ This is your only storage — build another one before demolishing it.');
      return;
    }
    b.demolition = true;
    b.demoWork = b.spec.buildSeconds / 2;
    this.events.push(`🧹 ${b.spec.label} marked for demolition.`);
  }

  finishDemolition(b: Building): void {
    // Refund half of what was actually put in (full cost if it was complete).
    for (const m of BUILD_MATERIALS) {
      const invested = b.state === 'complete' ? (b.spec.cost[m] ?? 0) : (b.delivered[m] ?? 0);
      if (invested > 0) this.deposit(m, Math.floor(invested / 2));
    }
    this.removeBuilding(b);
    this.events.push(`🧹 The ${b.spec.label.toLowerCase()} was torn down — half the materials recovered.`);
  }

  private removeBuilding(b: Building): void {
    for (const o of [...b.occupants]) o.home = null;
    b.occupants.length = 0;
    for (const v of this.villagers) {
      if (v.site === b) v.goIdle();
    }
    // Water under a demolished dock stays unwalkable.
    for (const tile of b.footprintTiles()) {
      this.grid.setWalkable(tile, this.world.tiles.types[tile] !== TileType.Water);
    }
    const i = this.buildings.indexOf(b);
    if (i >= 0) this.buildings.splice(i, 1);
    this.reassignHousing();
  }

  /** Swap a house for a better kind: the family moves out (rehoused if possible),
   *  and a fresh construction site takes its place. */
  upgradeHouse(b: Building, target: BuildingKind): boolean {
    if (b.state !== 'complete' || !this.isBuildingUnlocked(target)) return false;
    const spec = specFor(target, b.rot);
    if (spec.w !== b.spec.w || spec.d !== b.spec.d) return false;
    const anchorX = b.anchorX;
    const anchorZ = b.anchorZ;
    const entrance = b.entranceTile;
    const rot = b.rot;
    this.removeBuilding(b);
    const nb = new Building(spec, anchorX, anchorZ, entrance);
    nb.rot = rot;
    for (const tile of nb.footprintTiles()) this.grid.setWalkable(tile, false);
    this.buildings.push(nb);
    this.events.push(`⬆️ Upgrading to a ${spec.label.toLowerCase()} — builders will start work.`);
    return true;
  }

  // ------------------------------------------------------- workshop upgrade

  canUpgradeWorkshop(b: Building): boolean {
    if (b.state !== 'complete' || b.upgraded || b.demolition || !isUpgradableWorkshop(b.spec.kind)) return false;
    return BUILD_MATERIALS.every((m) => this.resources[m] >= (WORKSHOP_UPGRADE_COST[m] ?? 0));
  }

  /** Refit with brick, tiles, stone, and wood → workers 20% faster (owner rule). */
  upgradeWorkshop(b: Building): boolean {
    if (!this.canUpgradeWorkshop(b)) return false;
    for (const m of BUILD_MATERIALS) this.resources[m] -= WORKSHOP_UPGRADE_COST[m] ?? 0;
    b.upgraded = true;
    b.visualDirty = true;
    this.events.push(`⬆️ The ${b.spec.label.toLowerCase()} was refitted — its workers gain 20% productivity.`);
    return true;
  }

  /** Rebuild a building from a save, bypassing cost/validity (state is trusted). */
  restoreBuilding(
    kind: BuildingKind,
    ax: number,
    az: number,
    delivered: Partial<Record<BuildMaterial, number>>,
    workRemaining: number,
    growth: number,
    oreType: number,
    rot = 0,
  ): Building | null {
    const spec = specFor(kind, rot);
    let entrance = -1;
    for (let dz = -1; dz <= spec.d && entrance === -1; dz++) {
      for (let dx = -1; dx <= spec.w && entrance === -1; dx++) {
        const onEdge = dx === -1 || dz === -1 || dx === spec.w || dz === spec.d;
        if (!onEdge) continue;
        if (this.grid.isWalkable(ax + dx, az + dz)) entrance = (az + dz) * MAP_SIZE + (ax + dx);
      }
    }
    if (entrance === -1) return null;
    const b = new Building(spec, ax, az, entrance);
    b.rot = rot;
    b.delivered = { ...delivered };
    b.workRemaining = workRemaining;
    b.growth = growth;
    b.oreType = oreType;
    this.flattenAndClear(b);
    for (const tile of b.footprintTiles()) this.grid.setWalkable(tile, false);
    this.buildings.push(b);
    return b;
  }

  /** Clear trees off all building footprints and entrance tiles (used after
   *  forest replay on load — the gathering corner must stay open). */
  reclearFootprints(): void {
    for (const b of this.buildings) {
      for (const tile of b.footprintTiles()) this.world.forest.clearTile(tile);
      this.world.forest.clearTile(b.entranceTile);
    }
  }

  placeBuilding(kind: BuildingKind, ax: number, az: number, rot = 0): boolean {
    if (!this.canPlace(kind, ax, az, rot)) return false;
    const spec = specFor(kind, rot);
    // Entrance: first walkable tile on the perimeter.
    let entrance = -1;
    for (let dz = -1; dz <= spec.d && entrance === -1; dz++) {
      for (let dx = -1; dx <= spec.w && entrance === -1; dx++) {
        const onEdge = dx === -1 || dz === -1 || dx === spec.w || dz === spec.d;
        if (!onEdge) continue;
        if (this.grid.isWalkable(ax + dx, az + dz)) entrance = (az + dz) * MAP_SIZE + (ax + dx);
      }
    }
    if (entrance === -1) return false;
    const b = new Building(spec, ax, az, entrance);
    b.rot = rot;
    if (spec.needsOre) {
      // The mine's vein: majority ore across footprint + surrounding ring.
      const counts = new Map<number, number>();
      for (let dz = -1; dz <= spec.d; dz++) {
        for (let dx = -1; dx <= spec.w; dx++) {
          const x = ax + dx;
          const z = az + dz;
          if (x < 0 || z < 0 || x >= MAP_SIZE || z >= MAP_SIZE) continue;
          const ore = this.world.tiles.ores[z * MAP_SIZE + x];
          if (ore !== OreType.None) counts.set(ore, (counts.get(ore) ?? 0) + 1);
        }
      }
      let best = 0;
      let bestCount = 0;
      for (const [ore, n] of counts) {
        if (n > bestCount) {
          best = ore;
          bestCount = n;
        }
      }
      b.oreType = best;
    }
    this.flattenAndClear(b);
    for (const tile of b.footprintTiles()) this.grid.setWalkable(tile, false);
    this.buildings.push(b);
    const costText = BUILD_MATERIALS.filter((m) => (spec.cost[m] ?? 0) > 0)
      .map((m) => `${spec.cost[m]} ${m}`)
      .join(' + ');
    this.events.push(`🏗 ${spec.label} site staked out (${costText}).`);
    return true;
  }

  // ---------------------------------------------------------------- builder tasks

  private findBuildSite(v: Villager): Building | null {
    let best: Building | null = null;
    let bestD = Infinity;
    for (const b of this.buildings) {
      if (b.state === 'complete' && !b.demolition) continue;
      const d = (b.centerX - v.x) ** 2 + (b.centerZ - v.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** First material the site still needs that the store can supply. */
  private pickableMaterial(site: Building): BuildMaterial | null {
    for (const m of BUILD_MATERIALS) {
      if (site.needed(m) > 0 && this.resources[m] >= 1) return m;
    }
    return null;
  }

  /** Builder reached a storage: load materials and head for the site. */
  builderPickup(v: Villager): void {
    const s = v.site;
    if (!s || s.state === 'complete') return v.goIdle();
    if (s.totalNeeded() > 0) {
      // Take from the storage we're standing at — its own ledger (owner rule).
      const depot = this.nearestStorage(v.x, v.z);
      const material =
        BUILD_MATERIALS.find((m) => s.needed(m) > 0 && this.resources[m] >= 1 && depot && (depot.store[m] ?? 0) >= 1) ??
        this.pickableMaterial(s); // ledger stale — don't deadlock the build
      if (!material) return v.goIdle();
      const take = Math.min(haulCapacity(v.tool), Math.floor(this.resources[material]), s.needed(material));
      this.resources[material] -= take;
      if (depot) depot.store[material] = Math.max(0, (depot.store[material] ?? 0) - take);
      v.buildCarry = { material, amount: take };
      v.buildPhase = 'deliver';
    } else {
      v.buildPhase = 'build';
    }
    v.navigate(this.pathToBuilding(v, s), 'toWork');
  }

  /** Builder reached the site edge. */
  builderArrived(v: Villager): void {
    if (v.pendingWork) {
      v.state = 'working';
      return;
    }
    const s = v.site;
    // A building marked for demolition IS complete — that's no reason to
    // leave (owner bug: dismantling looped forever at the corner).
    if (!s || (s.state === 'complete' && !s.demolition)) {
      if (v.buildCarry) this.resources[v.buildCarry.material] += v.buildCarry.amount; // return undelivered
      v.buildCarry = null;
      return v.goIdle();
    }
    if (v.buildPhase === 'deliver' && v.buildCarry) {
      const refund = s.deliver(v.buildCarry.material, v.buildCarry.amount);
      if (refund > 0) this.resources[v.buildCarry.material] += refund;
      v.buildCarry = null;
      if (s.totalNeeded() > 0) {
        // More hauling needed (if the store can supply it).
        if (!this.pickableMaterial(s)) return v.goIdle();
        v.buildPhase = 'pickup';
        v.navigate(this.pathToSupply(v, this.siteMaterials(s)), 'toPickup');
        return;
      }
    }
    v.buildPhase = 'build';
    v.state = 'working';
    v.buildMoveTimer = 0; // pick a fresh spot on THIS site right away
  }

  builderWork(v: Villager, dt: number): void {
    const toolFactor = v.tool === 'none' ? 0.75 : v.tool === 'stone' ? 1.3 : v.tool === 'bronze' || v.tool === 'iron' ? 1.5 : 1;
    let rate = dt * BUILD_RATE * toolFactor * v.productivity;

    // Road/wall tile jobs.
    if (v.pendingWork) {
      const pw = v.pendingWork;
      if (!this.pendingWorks.includes(pw)) return v.goIdle(0.5); // someone finished it
      pw.work -= rate;
      if (pw.work <= 0) {
        this.completePendingWork(pw);
        v.goIdle(0.5);
      }
      return;
    }

    const s = v.site;
    if (!s) return v.goIdle();

    // Crew synergy (owner rule): every extra builder on the SAME site makes
    // each of them 15% faster on top of the parallel work itself.
    const crew = this.villagers.filter(
      (x) => x !== v && x.profession === 'builder' && x.site === s && x.state === 'working',
    ).length;
    if (crew > 0) rate *= 1 + 0.15 * crew;

    // Owner rule: builders roam the works instead of standing on one corner.
    v.buildMoveTimer -= dt;
    if (v.buildMoveTimer <= 0) {
      v.buildMoveTimer = 2 + Math.random() * 3;
      v.buildMoveX = s.anchorX + 0.2 + Math.random() * (s.spec.w - 0.4);
      v.buildMoveZ = s.anchorZ + 0.2 + Math.random() * (s.spec.d - 0.4);
    }
    const mdx = v.buildMoveX - v.x;
    const mdz = v.buildMoveZ - v.z;
    const mdist = Math.hypot(mdx, mdz);
    if (mdist > 0.05) {
      const step = Math.min(1.1 * dt, mdist);
      v.x += (mdx / mdist) * step;
      v.z += (mdz / mdist) * step;
    }

    // Demolition duty.
    if (s.demolition) {
      // Owner rule: a storage is emptied into the others before dismantling.
      if ((s.spec.kind === 'stockpile' || s.spec.kind === 'storageShed') && s.storeTotal() > 0.01) {
        if (!this.transferOut(s, rate * 6) && performance.now() - this.lastFullWarning > 30000) {
          this.lastFullWarning = performance.now();
          this.events.push('📦 The storage cannot be emptied — the other storages are full!');
        }
        return;
      }
      s.demoWork -= rate;
      if (s.demoWork <= 0) this.finishDemolition(s);
      return;
    }

    if (s.state === 'complete') {
      this.stepOffSite(v, s); // roaming happens INSIDE the footprint — step out first
      v.site = null;
      v.buildPhase = null;
      v.navigate(this.pathToHome(v), 'toHome');
      return;
    }
    if (s.totalNeeded() > 0) {
      this.stepOffSite(v, s);
      v.buildPhase = 'pickup';
      v.navigate(this.pathToSupply(v, this.siteMaterials(s)), 'toPickup');
      return;
    }
    s.workRemaining -= rate;
    if (s.workRemaining <= 0) {
      s.workRemaining = 0;
      s.visualDirty = true;
      this.events.push(`🏠 A ${s.spec.label.toLowerCase()} is finished!`);
      // Owner rule: a newly built house stays warm for 2 days, then goes cold
      // unless firewood has been carried in.
      if (s.spec.capacity > 0) s.graceTimer = 2 * DAY_SECONDS;
      if (s.spec.kind === 'manor') this.crownFirstBaron(s); // baron claims it before the housing sweep
      this.reassignHousing();
    }
  }

  /** A villager stranded on an unwalkable tile (born on a construction site,
   *  a footprint placed under their feet…) steps to the nearest open tile so
   *  pathfinding works again (owner bug: grown child stayed unemployed). */
  unstick(v: Villager): void {
    const tx = Math.floor(v.x);
    const tz = Math.floor(v.z);
    if (this.grid.isWalkable(tx, tz)) return;
    for (let ring = 1; ring <= 5; ring++) {
      for (let dz = -ring; dz <= ring; dz++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          if (!this.grid.isWalkable(tx + dx, tz + dz)) continue;
          v.x = tx + dx + 0.5;
          v.z = tz + dz + 0.5;
          v.prevX = v.x;
          v.prevZ = v.z;
          return;
        }
      }
    }
  }

  /** Builders roam inside the (unwalkable) footprint; put them back on the
   *  nearest open tile around it before any pathfinding. */
  private stepOffSite(v: Villager, s: Building): void {
    const out = this.perimeterTiles(s, v.x, v.z)[0] ?? this.entranceOf(s);
    v.x = (out % MAP_SIZE) + 0.5;
    v.z = ((out / MAP_SIZE) | 0) + 0.5;
  }

  private pathToTile(v: Villager, tile: number): number[] | null {
    return this.grid.findPath(Math.floor(v.x), Math.floor(v.z), tile % MAP_SIZE, (tile / MAP_SIZE) | 0);
  }

  /** The building's gathering tile, verified on every use. A tree that grew
   *  there is felled on the spot, and if a later wall/building blocked the
   *  tile the entrance moves to another walkable perimeter tile (owner bug:
   *  builder stuck fetching materials at a storage corner under a tree). */
  entranceOf(b: Building): number {
    let tile = b.entranceTile;
    if (!this.grid.isWalkable(tile % MAP_SIZE, (tile / MAP_SIZE) | 0)) {
      for (let dz = -1; dz <= b.spec.d && tile === b.entranceTile; dz++) {
        for (let dx = -1; dx <= b.spec.w; dx++) {
          const onEdge = dx === -1 || dz === -1 || dx === b.spec.w || dz === b.spec.d;
          if (!onEdge) continue;
          if (this.grid.isWalkable(b.anchorX + dx, b.anchorZ + dz)) {
            tile = (b.anchorZ + dz) * MAP_SIZE + (b.anchorX + dx);
            b.entranceTile = tile;
            break;
          }
        }
      }
    }
    if (this.world.forest.treeCountAt(tile) > 0) this.world.forest.clearTile(tile);
    return tile;
  }

  /** Every walkable tile ringing the footprint, nearest to (x,z) first. */
  private perimeterTiles(b: Building, x: number, z: number): number[] {
    const tiles: { tile: number; d: number }[] = [];
    for (let dz = -1; dz <= b.spec.d; dz++) {
      for (let dx = -1; dx <= b.spec.w; dx++) {
        const onEdge = dx === -1 || dz === -1 || dx === b.spec.w || dz === b.spec.d;
        if (!onEdge) continue;
        const tx = b.anchorX + dx;
        const tz = b.anchorZ + dz;
        if (!this.grid.isWalkable(tx, tz)) continue;
        tiles.push({ tile: tz * MAP_SIZE + tx, d: (tx + 0.5 - x) ** 2 + (tz + 0.5 - z) ** 2 });
      }
    }
    tiles.sort((a, c) => a.d - c.d);
    return tiles.map((t) => t.tile);
  }

  /** Path to the closest reachable tile ANYWHERE around the building —
   *  owner rule (session 34): pickups at storages and deliveries to build
   *  sites use every side, not one fixed corner. */
  pathToBuilding(v: Villager, b: Building): number[] | null {
    for (const tile of this.perimeterTiles(b, v.x, v.z)) {
      const path = this.pathToTile(v, tile);
      if (path) return path;
    }
    return null;
  }

  countByProfession(): Record<Profession, number> {
    const counts: Record<Profession, number> = {
      woodcutter: 0, stonecutter: 0, strawcutter: 0, forager: 0, firewoodmaker: 0, builder: 0,
      hunter: 0, fisher: 0, herbalist: 0, toolmaker: 0, teacher: 0, farmer: 0,
      clayDigger: 0, brickmaker: 0, potter: 0, forester: 0, miner: 0, smelter: 0,
      weaponsmith: 0, soldier: 0, tailor: 0, baker: 0, weaver: 0, leatherworker: 0, cobbler: 0,
    };
    // Employment counts: a worker resting between trips still holds their job
    // (owner rule, session 26 — stops the "2/1 workers" flapping where a
    // second hand was hired whenever the first paused for a moment).
    for (const v of this.villagers) {
      if (v.profession && !v.isChild) counts[v.profession]++;
    }
    return counts;
  }

  /** UNEMPLOYED working-age villagers — the pool that fills new occupations.
   *  Children never count; employed workers resting between trips don't either. */
  idleCount(): number {
    return this.villagers.filter((v) => v.state === 'idle' && v.isAdult && !v.profession).length;
  }

  setDesired(profession: Profession, count: number): void {
    const clamped = Math.max(0, Math.min(this.villagers.length, count));
    const increased = clamped > this.desired[profession];
    this.desired[profession] = clamped;
    // Tell the player when a quota can't be filled without its workplace.
    if (increased && this.workerSlots(profession) === 0) {
      const kind = this.workplaceOf(profession);
      if (kind) this.events.push(`⚠️ ${BUILDING_SPECS[kind].label} required — build one to employ this profession.`);
    }
  }

  /**
   * Children hang around their own house; school-age kids split time between
   * home and the schoolyard. Keeps them off the storage piles (owner fix).
   */
  sendChildToPlay(v: Villager): void {
    let ax = this.home.x;
    let az = this.home.z;
    if (v.home) {
      ax = v.home.centerX;
      az = v.home.centerZ + v.home.spec.d / 2 + 1; // out front
    }
    if (!v.isBaby && Math.random() < 0.4) {
      const school = this.buildings.find((b) => b.spec.kind === 'school' && b.state === 'complete');
      if (school) {
        ax = school.centerX;
        az = school.centerZ;
      }
    }
    // Already close enough — stay put and play.
    if ((v.x - ax) ** 2 + (v.z - az) ** 2 < 9) return;
    const tx = Math.floor(ax + (Math.random() - 0.5) * 3);
    const tz = Math.floor(az + (Math.random() - 0.5) * 3);
    if (!this.grid.isWalkable(tx, tz)) return;
    const path = this.grid.findPath(Math.floor(v.x), Math.floor(v.z), tx, tz);
    if (path) v.navigate(path, 'toHome'); // arrival just returns them to idle
  }

  /** Why nobody takes (or works) this trade right now — the material/season
   *  gates from startJob, surfaced in the Workers window (owner report, s36:
   *  farmers and leatherworkers assigned but "none work"). Null = no gate. */
  hiringBlockReason(prof: Profession): string | null {
    const r = this.resources;
    if (prof === 'forager' && this.calendar.isWinter) return 'nothing to forage under snow';
    if (prof === 'firewoodmaker' && r.wood < FIREWOOD_WOOD_COST) return 'no wood to split';
    if (prof === 'brickmaker' && (r.clay < BRICK_CLAY_COST || r.firewood < BRICK_FIREWOOD_COST))
      return 'needs clay + firewood';
    if (prof === 'farmer') {
      const season = this.calendar.season;
      const barn = this.buildings.some((b) => b.spec.kind === 'barn' && b.state === 'complete');
      const grain = GRAIN_KINDS.some((g) => r[g] >= 2);
      if (season === 'winter') {
        if (!barn) return 'winter — a barn is needed to thresh';
        if (!grain) return 'no grain to thresh';
        return null;
      }
      const fields = this.buildings.filter((b) => b.spec.kind === 'cropField' && b.state === 'complete');
      if (fields.some((b) => this.fieldHasWork(b, season)) || (barn && grain)) return null;
      if (fields.length === 0) return null; // the lock/slots notes cover this
      if (season === 'spring' && r.seeds < SOW_SEED_COST) return 'no seeds — caravans sell them';
      if (season === 'summer') return 'no growing crop to tend';
      if (season === 'autumn') return 'nothing to harvest';
      return 'fields need no work now';
    }
    if (prof === 'baker' && (r.flour < 2 || r.firewood < 1)) return 'needs 2 flour + 1 firewood';
    if (prof === 'toolmaker') {
      const canCraft =
        r.wood >= 2 || (r.wood >= 1 && (r.stone >= 2 || r.bronzeBar >= 1 || r.ironBar >= 1));
      const stocked =
        r.woodenTools + r.stoneTools + r.bronzeTools + r.ironTools >= this.villagers.length + TOOL_STOCK_CAP_EXTRA;
      if (stocked) return 'tools are well stocked';
      if (!canCraft) return 'needs wood (and stone)';
    }
    if (prof === 'smelter') {
      const canBronze = r.copperOre >= 1 && r.tinOre >= 1 && r.firewood >= 1;
      const canIron = this.researched.has('ironWorking') && r.ironOre >= 2 && r.coal >= 1;
      if (!canBronze && !canIron) return 'no ore + fuel to smelt';
    }
    if (prof === 'weaponsmith' && this.weaponsmithRecipe() === null) return 'no weapon materials';
    if (prof === 'tailor') {
      if (r.clothes + r.fineClothes + r.luxuryClothes >= this.villagers.length + 2) return 'everyone is clothed';
      if (this.tailorRecipe() === null) return 'needs linen or hides';
    }
    if (prof === 'weaver' && this.weaverRecipe() === null) return 'needs 2 straw';
    if (prof === 'leatherworker' && r.hides < 2 + TANNERY_HIDE_RESERVE)
      return `needs ${2 + TANNERY_HIDE_RESERVE} hides (${TANNERY_HIDE_RESERVE} stay in reserve)`;
    if (prof === 'cobbler') {
      if (r.sandals + r.hideShoes + r.boots + r.luxuryBoots >= this.villagers.length + 2) return 'everyone has shoes';
      if (this.cobblerRecipe() === null) return 'no shoe materials';
    }
    if (prof === 'potter') {
      if (r.pottery >= this.houseCount() + 4) return 'every house has pots to spare';
      if (r.clay < POTTER_CLAY_COST || r.firewood < POTTER_FIREWOOD_COST) return 'needs 2 clay + 1 firewood';
    }
    return null;
  }

  /** Give an idle villager a job matching the desired quotas. Returns false if none fit. */
  startJob(v: Villager): boolean {
    if (v.isChild) return false; // children don't work
    // Dress in the best garment the store offers above what's worn now.
    for (const [tier, kind] of CLOTHING_STORE) {
      if (CLOTHING_RANK[tier] > CLOTHING_RANK[v.clothing] && this.resources[kind] >= 1) {
        this.resources[kind] -= 1;
        v.clothing = tier;
        v.clothingTimer = CLOTHING_LIFE[tier];
        break;
      }
    }
    // Lace up the best footwear available above the current pair.
    for (const [tier, kind] of SHOE_STORE) {
      if (SHOE_RANK[tier] > SHOE_RANK[v.shoes] && this.resources[kind] >= 1) {
        this.resources[kind] -= 1;
        v.shoes = tier;
        v.shoeTimer = SHOE_LIFE[tier];
        break;
      }
    }
    // Grab a tool if unequipped. A fisherman out of tools knots his own net
    // from string first — only without string does he take a regular tool
    // (owner rule).
    if (v.tool === 'none') {
      if (v.profession === 'fisher' && this.resources.string >= NET_STRING_COST) {
        this.resources.string -= NET_STRING_COST;
        v.tool = 'net';
        v.toolUses = TOOL_USES;
      } else {
        for (const [tier, kind] of TOOL_STORE) {
          if (this.resources[kind] >= 1) {
            this.resources[kind] -= 1;
            v.tool = tier;
            v.toolUses = TOOL_USES;
            break;
          }
        }
      }
    }
    // Occupation stickiness (owner rule, session 26): a worker keeps their
    // trade as long as it stays within its limits — they never switch to fill
    // a new quota. Only when their trade is over quota/slots are they laid
    // off, joining the unemployed pool that fills new occupations.
    const active = this.countByProfession();
    if (v.profession) {
      active[v.profession]--; // don't count ourselves when re-checking our own job
      const overQuota = active[v.profession] >= this.desired[v.profession];
      const overSlots =
        this.workplaceOf(v.profession) !== null && active[v.profession] >= this.workerSlots(v.profession);
      if (overQuota || overSlots) v.profession = null; // laid off
    }
    const order = v.profession ? [v.profession] : PROFESSIONS;
    for (const prof of order) {
      if (active[prof] >= this.desired[prof]) continue;
      // Nothing to forage under snow; don't split wood there isn't.
      if (prof === 'forager' && this.calendar.isWinter) continue;
      if (prof === 'firewoodmaker' && this.resources.wood < FIREWOOD_WOOD_COST) continue;
      // Workplace professions need a completed building with a free slot.
      if (this.workplaceOf(prof) !== null && active[prof] >= this.workerSlots(prof)) continue;
      if (prof === 'brickmaker' && (this.resources.clay < BRICK_CLAY_COST || this.resources.firewood < BRICK_FIREWOOD_COST)) continue;
      if (prof === 'farmer') {
        const season = this.calendar.season;
        const barnWork =
          this.buildings.some((b) => b.spec.kind === 'barn' && b.state === 'complete') &&
          GRAIN_KINDS.some((g) => this.resources[g] >= 2);
        if (season === 'winter') {
          // Winter: farmers always work the barn (owner rule).
          if (!barnWork) continue;
        } else {
          const fieldWork = this.buildings.some(
            (b) => b.spec.kind === 'cropField' && b.state === 'complete' && this.fieldHasWork(b, season),
          );
          // Owner rule: farmers with free time thresh in the barn in any season.
          if (!fieldWork && !barnWork) continue;
        }
      }
      if (prof === 'baker' && (this.resources.flour < 2 || this.resources.firewood < 1)) continue;
      if (prof === 'toolmaker') {
        // Rest when materials are short or everyone is equipped with spares.
        const canCraft =
          this.resources.wood >= 2 ||
          (this.resources.wood >= 1 && (this.resources.stone >= 2 || this.resources.bronzeBar >= 1 || this.resources.ironBar >= 1));
        const stocked =
          this.resources.woodenTools + this.resources.stoneTools + this.resources.bronzeTools + this.resources.ironTools >=
          this.villagers.length + TOOL_STOCK_CAP_EXTRA;
        if (!canCraft || stocked) continue;
      }
      if (prof === 'smelter') {
        const canBronze = this.resources.copperOre >= 1 && this.resources.tinOre >= 1 && this.resources.firewood >= 1;
        const canIron = this.researched.has('ironWorking') && this.resources.ironOre >= 2 && this.resources.coal >= 1;
        if (!canBronze && !canIron) continue;
      }
      if (prof === 'weaponsmith' && this.weaponsmithRecipe() === null) continue;
      if (prof === 'tailor') {
        const stocked =
          this.resources.clothes + this.resources.fineClothes + this.resources.luxuryClothes >=
          this.villagers.length + 2;
        if (stocked || this.tailorRecipe() === null) continue;
      }
      if (prof === 'weaver' && this.weaverRecipe() === null) continue;
      if (prof === 'leatherworker' && this.resources.hides < 2 + TANNERY_HIDE_RESERVE) continue;
      if (prof === 'cobbler') {
        const shoesStocked =
          this.resources.sandals + this.resources.hideShoes + this.resources.boots + this.resources.luxuryBoots >=
          this.villagers.length + 2;
        if (shoesStocked || this.cobblerRecipe() === null) continue;
      }
      if (prof === 'potter') {
        // Rest when materials are short or every household could own a pot with spares.
        const stocked = this.resources.pottery >= this.houseCount() + 4;
        if (stocked || this.resources.clay < POTTER_CLAY_COST || this.resources.firewood < POTTER_FIREWOOD_COST) continue;
      }
      if (prof === 'fisher' && v.tool === 'none' && this.resources.string >= NET_STRING_COST) {
        // First-time fishers with no store tools still get their net.
        this.resources.string -= NET_STRING_COST;
        v.tool = 'net';
        v.toolUses = TOOL_USES;
      }
      if (prof === 'soldier') {
        // Arm up from the store when taking the post.
        if (v.weapon === 'none') {
          for (const [tier, kind] of WEAPON_STORE) {
            if (this.resources[kind] >= 1) {
              this.resources[kind] -= 1;
              v.weapon = tier;
              break;
            }
          }
        }
        if (!v.hasArmor && this.resources.leatherArmor >= 1) {
          this.resources.leatherArmor -= 1;
          v.hasArmor = true;
        }
      }
      if (prof === 'builder') {
        const site = this.findBuildSite(v);
        if (site) {
          if (site.demolition) {
            v.profession = 'builder';
            v.site = site;
            v.buildPhase = 'build';
            v.navigate(this.pathToBuilding(v, site), 'toWork');
            return true;
          }
          if (site.totalNeeded() > 0 && !this.pickableMaterial(site)) continue;
          v.profession = 'builder';
          v.site = site;
          if (site.totalNeeded() > 0) {
            v.buildPhase = 'pickup';
            v.navigate(this.pathToSupply(v, this.siteMaterials(site)), 'toPickup');
          } else {
            v.buildPhase = 'build';
            v.navigate(this.pathToBuilding(v, site), 'toWork');
          }
          return true;
        }
        // No building sites — pave roads / raise walls.
        let bestPw: (typeof this.pendingWorks)[number] | null = null;
        let bestD = Infinity;
        for (const pw of this.pendingWorks) {
          const px = (pw.tile % MAP_SIZE) + 0.5;
          const pz = ((pw.tile / MAP_SIZE) | 0) + 0.5;
          const d = (px - v.x) ** 2 + (pz - v.z) ** 2;
          if (d < bestD) {
            bestD = d;
            bestPw = pw;
          }
        }
        if (!bestPw) continue;
        const path = this.pathToTile(v, bestPw.tile);
        if (!path) continue;
        v.profession = 'builder';
        v.pendingWork = bestPw;
        v.navigate(path, 'toWork');
        return true;
      }
      let target = this.findTargetTile(prof, v);
      if (target === -1) continue;
      let path = this.grid.findPath(
        Math.floor(v.x), Math.floor(v.z),
        target % MAP_SIZE, (target / MAP_SIZE) | 0,
      );
      // Waterline workplaces (tannery, fishing hut) can have an entrance on a
      // cut-off strip of bank: walkable but unreachable, so hiring failed
      // silently forever (owner bug, s36). Any reachable side will do.
      if (!path && v.site && target === v.site.entranceTile) {
        const alt = this.pathToBuilding(v, v.site);
        if (alt && alt.length > 0) {
          path = alt;
          target = alt[alt.length - 1];
        }
      }
      if (!path) continue;
      v.profession = prof;
      v.beginWorkTrip(path, target);
      return true;
    }
    return false;
  }

  /**
   * What the weaponsmith should make next: best-tier weapons until every
   * desired soldier could carry one (plus a spare), then armor.
   */
  weaponsmithRecipe(mode = 'auto'): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null {
    const bestWeapon = (): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null => {
      if (this.resources.ironBar >= 1 && this.resources.wood >= 1) {
        return { yields: 'ironWeapons', consumes: [['ironBar', 1], ['wood', 1]] };
      }
      if (this.resources.bronzeBar >= 1 && this.resources.wood >= 1) {
        return { yields: 'bronzeWeapons', consumes: [['bronzeBar', 1], ['wood', 1]] };
      }
      if (this.resources.wood >= 2 && this.resources.stone >= 1) {
        return { yields: 'spears', consumes: [['wood', 2], ['stone', 1]] };
      }
      return null;
    };
    const armor = (): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null =>
      this.resources.hides >= 2 ? { yields: 'leatherArmor', consumes: [['hides', 2]] } : null;

    if (mode === 'weapons') return bestWeapon();
    if (mode === 'armor') return armor();
    // Auto: weapons until every desired soldier could carry one (plus a spare),
    // then armor for each of them.
    const weapons = this.resources.spears + this.resources.bronzeWeapons + this.resources.ironWeapons;
    const armedSoldiers = this.villagers.filter((v) => v.profession === 'soldier' && v.weapon !== 'none').length;
    if (weapons + armedSoldiers < this.desired.soldier + 1) {
      const w = bestWeapon();
      if (w) return w;
    }
    const armored = this.villagers.filter((v) => v.profession === 'soldier' && v.hasArmor).length;
    if (this.resources.leatherArmor + armored < this.desired.soldier) return armor();
    return null;
  }

  /**
   * What the tailor can sew right now (owner rules, session 30): basic from
   * 1 linen OR 1 hide; fine = 2 linen + 2 LEATHER; luxury = 2 linen +
   * 2 leather + 2 fur. Auto always sews the best garment materials allow.
   */
  tailorRecipe(mode = 'auto'): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null {
    const luxury = (): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null =>
      this.resources.linen >= 2 && this.resources.leather >= 2 && this.resources.fur >= 2
        ? { yields: 'luxuryClothes', consumes: [['linen', 2], ['leather', 2], ['fur', 2]] }
        : null;
    const fine = (): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null =>
      this.resources.linen >= 2 && this.resources.leather >= 2
        ? { yields: 'fineClothes', consumes: [['linen', 2], ['leather', 2]] }
        : null;
    const basic = (): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null =>
      this.resources.linen >= 1
        ? { yields: 'clothes', consumes: [['linen', 1]] }
        : this.resources.hides >= 1
          ? { yields: 'clothes', consumes: [['hides', 1]] }
          : null;
    if (mode === 'basic') return basic();
    if (mode === 'fine') return fine();
    if (mode === 'luxury') return luxury();
    return luxury() ?? fine() ?? basic();
  }

  /** Cobbler recipes (owner rules): sandals 1 string + 1 straw, hide shoes
   *  1 hide, boots 1 leather, luxury boots 1 leather + 1 fur. Auto = best. */
  cobblerRecipe(mode = 'auto'): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null {
    const luxury = (): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null =>
      this.resources.leather >= 1 && this.resources.fur >= 1
        ? { yields: 'luxuryBoots', consumes: [['leather', 1], ['fur', 1]] }
        : null;
    const boots = (): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null =>
      this.resources.leather >= 1 ? { yields: 'boots', consumes: [['leather', 1]] } : null;
    const hide = (): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null =>
      this.resources.hides >= 1 ? { yields: 'hideShoes', consumes: [['hides', 1]] } : null;
    const sandals = (): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null =>
      this.resources.string >= 1 && this.resources.straw >= 1
        ? { yields: 'sandals', consumes: [['string', 1], ['straw', 1]] }
        : null;
    if (mode === 'sandals') return sandals();
    if (mode === 'hide') return hide();
    if (mode === 'boots') return boots();
    if (mode === 'luxury') return luxury();
    return luxury() ?? boots() ?? hide() ?? sandals();
  }

  /**
   * What the weaver works on: 2 straw → 1 string, 2 string → 1 linen.
   * Auto keeps a small string buffer (fishing nets) before weaving linen.
   */
  weaverRecipe(mode = 'auto'): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null {
    const string = (): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null =>
      this.resources.straw >= 2 ? { yields: 'string', consumes: [['straw', 2]] } : null;
    const linen = (): { yields: ResourceKind; consumes: [ResourceKind, number][] } | null =>
      this.resources.string >= 2 ? { yields: 'linen', consumes: [['string', 2]] } : null;
    if (mode === 'string') return string();
    if (mode === 'linen') return linen();
    if (this.resources.string < WEAVER_STRING_BUFFER) return string() ?? linen();
    return linen() ?? string();
  }

  /** Soldiers on home duty (not children, not away on campaign). */
  soldiers(): Villager[] {
    return this.villagers.filter((v) => v.profession === 'soldier' && !v.isChild && v.state !== 'campaign');
  }

  watchtowerCount(): number {
    return this.buildings.filter((b) => b.spec.kind === 'watchtower' && b.state === 'complete').length;
  }

  /** Total defense: soldiers + towers + walls (+ desperate militia if no army). */
  defenseStrength(): number {
    const soldierStr = this.soldiers().reduce((s, v) => s + v.combatStrength, 0);
    const fixed = this.watchtowerCount() * 2 + this.fortificationBonus();
    if (soldierStr > 0) return soldierStr + fixed;
    return fixed + this.adultCount() * 0.3;
  }

  /** Can teacher/farmer keep cycling at their current site? */
  hasOnSiteWork(v: Villager): boolean {
    const b = v.site;
    if (!b || b.state !== 'complete') return false;
    if (v.profession === 'teacher' || v.profession === 'soldier') return true;
    if (v.profession === 'farmer') {
      if (b.spec.kind === 'barn') {
        // Threshing runs in any season while grain lasts (owner rule).
        return GRAIN_KINDS.some((g) => this.resources[g] >= 2);
      }
      return this.fieldHasWork(b, this.calendar.season);
    }
    return false;
  }

  // ---------------------------------------------------------------- research

  canResearch(tech: Tech): boolean {
    if (this.researched.has(tech.id)) return false;
    if (tech.requires && !this.researched.has(tech.requires)) return false;
    return this.knowledge >= tech.cost;
  }

  research(tech: Tech): boolean {
    if (!this.canResearch(tech)) return false;
    this.knowledge -= tech.cost;
    this.researched.add(tech.id);
    this.events.push(`📖 Research complete: ${tech.icon} ${tech.label}!`);
    return true;
  }

  isBuildingUnlocked(kind: BuildingKind): boolean {
    if (kind === 'school') return this.researched.has('education');
    if (kind === 'tradingPost') return this.researched.has('trade');
    if (kind === 'cropField' || kind === 'barn') return this.researched.has('agriculture');
    if (kind === 'manor') return this.researched.has('feudalism');
    if (kind === 'temple') return this.researched.has('religion');
    if (kind === 'bakery') return this.researched.has('baking');
    if (kind === 'clayPit') return this.researched.has('clayWorking');
    if (kind === 'pottery') return this.researched.has('pottery');
    if (kind === 'weaver') return this.researched.has('weaving');
    if (kind === 'leatherworker') return this.researched.has('leatherworking');
    if (kind === 'cobbler') return this.researched.has('cobbling');
    if (kind === 'brickOven' || kind === 'brickHouse') return this.researched.has('brickMaking');
    if (kind === 'mine') return this.researched.has('mining');
    if (kind === 'smelter') return this.researched.has('bronzeWorking');
    if (kind === 'trainingGround' || kind === 'weaponsmith' || kind === 'watchtower') return this.researched.has('warcraft');
    return true;
  }

  // ---------------------------------------------------------------- storages

  /** All functioning storage buildings (camp stockpile + sheds). */
  storages(): Building[] {
    return this.buildings.filter(
      (b) => (b.spec.kind === 'stockpile' || b.spec.kind === 'storageShed') && b.state === 'complete' && !b.demolition,
    );
  }

  storageCapacityOf(b: Building): number {
    return b.spec.kind === 'stockpile' ? BASE_CAPACITY : SHED_CAPACITY;
  }

  /** Place the free founding stockpile at the village site (also used when
   *  loading saves from before it was a real building). */
  placePrebuiltStockpile(): Building | null {
    if (this.buildings.some((b) => b.spec.kind === 'stockpile')) return null;
    const ax = Math.floor(this.home.x) - 1;
    const az = Math.floor(this.home.z) - 1;
    const b = this.restoreBuilding('stockpile', ax, az, {}, 0, 0, 0);
    if (b) {
      // Its ledger opens with everything the settlers carried in.
      for (const [k, n] of Object.entries(this.resources)) {
        if (n > 0) b.store[k] = n;
      }
    }
    return b;
  }

  private nearestStorage(x: number, z: number, pred?: (b: Building) => boolean): Building | null {
    let best: Building | null = null;
    let bestD = Infinity;
    for (const b of this.storages()) {
      if (pred && !pred(b)) continue;
      const d = (b.centerX - x) ** 2 + (b.centerZ - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private mostFreeStorage(exclude?: Building): Building | null {
    let best: Building | null = null;
    let bestFree = 0.5;
    for (const b of this.storages()) {
      if (b === exclude) continue;
      const free = this.storageCapacityOf(b) - b.storeTotal();
      if (free > bestFree) {
        bestFree = free;
        best = b;
      }
    }
    return best;
  }

  /** Where outsiders (raids, caravans) and homeless villagers gather. */
  rallyTile(): number {
    const s = this.storages()[0];
    return s ? this.entranceOf(s) : Math.floor(this.home.z) * MAP_SIZE + Math.floor(this.home.x);
  }

  /** Move goods out of a storage being demolished. False = nowhere to put them. */
  private transferOut(from: Building, amount: number): boolean {
    let moved = false;
    for (const [k, n] of Object.entries(from.store)) {
      if (amount <= 0) break;
      if ((n ?? 0) <= 0) continue;
      const to = this.mostFreeStorage(from);
      if (!to) return moved;
      const move = Math.min(amount, n ?? 0, this.storageCapacityOf(to) - to.storeTotal());
      if (move <= 0) return moved;
      from.store[k] = (from.store[k] ?? 0) - move;
      to.store[k] = (to.store[k] ?? 0) + move;
      amount -= move;
      moved = true;
    }
    return moved;
  }

  /** Craftsman stocks output on the shop shelf. False = shelf full (haul it). */
  shopStash(shop: Building, kind: ResourceKind, amount: number): boolean {
    const caps = SHOP_STORE_CAPS[shop.spec.kind];
    if (!caps) return false;
    if (shop.storeTotal() + amount > caps.total) return false;
    if ((shop.store[kind] ?? 0) + amount > caps.perKind) return false;
    shop.store[kind] = (shop.store[kind] ?? 0) + amount;
    this.resources[kind] += amount; // shelf goods still belong to the village
    return true;
  }

  /** Daily: keep the per-storage ledgers in step with the village totals
   *  (crafting and meals draw on the totals directly). Workshop shelves
   *  count as held stock too. */
  private reconcileStorages(): void {
    const stores = this.storages();
    if (stores.length === 0) return;
    const shops = this.buildings.filter(
      (b) => b.state === 'complete' && !b.demolition && SHOP_STORE_CAPS[b.spec.kind] !== undefined,
    );
    for (const k of Object.keys(this.resources) as ResourceKind[]) {
      let sum = 0;
      for (const b of stores) sum += b.store[k] ?? 0;
      for (const b of shops) sum += b.store[k] ?? 0;
      let diff = this.resources[k] - sum;
      if (diff > 0.01) {
        while (diff > 0.01) {
          const b = this.mostFreeStorage();
          if (!b) break;
          const add = Math.min(diff, this.storageCapacityOf(b) - b.storeTotal());
          if (add <= 0) break;
          b.store[k] = (b.store[k] ?? 0) + add;
          diff -= add;
        }
      } else if (diff < -0.01) {
        // Consumption came out of the totals: whoever holds the most of the
        // kind gives first — shop shelves included, so goods sell off the
        // shelf without a trip to storage.
        let need = -diff;
        for (const b of [...stores, ...shops].sort((a, c) => (c.store[k] ?? 0) - (a.store[k] ?? 0))) {
          const take = Math.min(need, b.store[k] ?? 0);
          b.store[k] = (b.store[k] ?? 0) - take;
          need -= take;
          if (need <= 0.01) break;
        }
      }
    }
  }

  /** Total goods vs capacity — the sum over every standing storage. */
  storageCapacity(): number {
    let cap = 0;
    for (const b of this.storages()) cap += this.storageCapacityOf(b);
    return cap;
  }

  storedTotal(): number {
    let sum = 0;
    for (const k in this.resources) sum += this.resources[k as ResourceKind];
    return sum;
  }

  /** Add goods to the stores, clamped to capacity. Overflow is lost. The
   *  ledger of the storage the goods arrive at (nearest to nx/nz) is credited. */
  deposit(kind: ResourceKind, amount: number, nx?: number, nz?: number): void {
    const space = this.storageCapacity() - this.storedTotal();
    const stored = Math.min(amount, Math.max(0, space));
    this.resources[kind] += stored;
    let rest = stored;
    let target =
      nx !== undefined && nz !== undefined
        ? this.nearestStorage(nx, nz, (b) => b.storeTotal() < this.storageCapacityOf(b))
        : this.mostFreeStorage();
    while (target && rest > 0) {
      const put = Math.min(rest, Math.max(0, this.storageCapacityOf(target) - target.storeTotal()));
      if (put <= 0) break;
      target.store[kind] = (target.store[kind] ?? 0) + put;
      rest -= put;
      target = this.mostFreeStorage();
    }
    if (stored < amount && performance.now() - this.lastFullWarning > 30000) {
      this.lastFullWarning = performance.now();
      this.events.push('📦 The stores are full — goods are going to waste! Build a storage shed.');
    }
  }

  /** World/store side effects when work completes. Returns yield multiplier and optional kind override. */
  applyWorkEffect(profession: Profession, tile: number, v?: Villager): { mult: number; kind?: ResourceKind } {
    if (profession === 'woodcutter') {
      // Tile ran out mid-trip → gather deadfall at half yield.
      return { mult: this.world.forest.removeTreeAt(tile) ? 1 : 0.5 };
    }
    if (profession === 'stonecutter') {
      // Owner rule: collected stones are destroyed — the tile is quarried bare.
      const i = this.rockTiles.indexOf(tile);
      if (i === -1) return { mult: 0.5 }; // picked-over ground — rubble only
      this.rockTiles.splice(i, 1);
      this.rocksRemoved.push(tile);
      this.world.rocks.hideTile(tile);
      return { mult: 1 };
    }
    if (profession === 'clayDigger') {
      const pit = v?.site;
      if (!pit || pit.spec.kind !== 'clayPit') return { mult: 1 };
      const wasDepleted = pit.clayTaken >= CLAY_PIT_CAPACITY;
      const mult = wasDepleted ? 0.2 : 1; // exhausted pits scrape on at 20% pace
      pit.clayTaken += JOBS.clayDigger.amount * mult;
      if (!wasDepleted && pit.clayTaken >= CLAY_PIT_CAPACITY) {
        this.depleteClayPit(pit);
        this.events.push('🏺 A clay pit is exhausted — the deposit around it is spent; digging slows to 20%.');
      }
      return { mult };
    }
    if (profession === 'potter') {
      if (this.resources.clay < POTTER_CLAY_COST || this.resources.firewood < POTTER_FIREWOOD_COST) return { mult: 0 };
      this.resources.clay -= POTTER_CLAY_COST;
      this.resources.firewood -= POTTER_FIREWOOD_COST;
      return { mult: 1 };
    }
    if (profession === 'strawcutter') {
      // Owner rule: the tile is stripped bare and regrows after 3 years.
      const i = this.strawTiles.indexOf(tile);
      if (i === -1) return { mult: 0.5 }; // someone cut it first — gleanings
      this.strawTiles.splice(i, 1);
      this.strawRegrow.push({ tile, at: this.calendar.elapsedSeconds + STRAW_REGROW_SECONDS });
      this.world.straw.hideTile(tile);
      return { mult: 1 };
    }
    if (profession === 'firewoodmaker') {
      if (this.resources.wood < FIREWOOD_WOOD_COST) return { mult: 0 };
      this.resources.wood -= FIREWOOD_WOOD_COST;
      return { mult: 1 };
    }
    if (profession === 'hunter') {
      const animal = v?.targetAnimal;
      if (v) v.targetAnimal = null;
      if (!animal?.alive || Math.hypot(animal.x - (v?.x ?? 0), animal.z - (v?.z ?? 0)) > 3) return { mult: 0 };
      animal.alive = false;
      // Owner yields: deer 4 meat + 4 hides, boar 2+2, rabbit 1 meat + 1 fur;
      // young animals give half.
      const def = SPECIES[animal.species];
      const half = animal.young ? 0.5 : 1;
      this.deposit(def.hideKind, Math.ceil(def.hide * half), v?.x, v?.z);
      return { mult: Math.ceil(def.meat * half) }; // meat carried home (amount 1 × mult)
    }
    if (profession === 'teacher') {
      // Owner rate: a teacher adds 50% of the original rate (passive thought
      // contributes another 25% village-wide); children boost it.
      this.knowledge += 0.5 * (1 + 0.05 * this.studentCount());
      return { mult: 0 };
    }
    if (profession === 'forester') {
      // A tile with a mature tree means this was a felling trip.
      if (this.world.forest.treeCountAt(tile) > 0) {
        return { mult: this.world.forest.removeTreeAt(tile) ? 1 : 0 };
      }
      const tx = (tile % MAP_SIZE) + 0.25 + Math.random() * 0.5;
      const tz = ((tile / MAP_SIZE) | 0) + 0.25 + Math.random() * 0.5;
      this.world.forest.plantAt(tile, tx, this.world.terrain.heightAt(tx, tz) - 0.05, tz, this.calendar.elapsedSeconds);
      return { mult: 0 };
    }
    if (profession === 'farmer') {
      const site = v?.site;
      if (!site || site.state !== 'complete') return { mult: 0 };
      const season = this.calendar.season;

      // Winter duty: threshing in the barn (owner rule).
      if (site.spec.kind === 'barn') {
        for (const grain of GRAIN_KINDS) {
          if (this.resources[grain] >= 2) {
            this.resources[grain] -= 2;
            const output: ResourceKind = grain === 'wheat' || grain === 'rye' ? 'flour' : 'animalFeed';
            this.resources[output] += 2;
            this.resources.straw += 1;
            return { mult: 0 }; // outputs banked directly at the barn
          }
        }
        return { mult: 0 };
      }

      if (season === 'spring') {
        // Sowing — needs trading seeds to begin a fresh field (owner rule).
        if (site.growth === 0) {
          if (this.resources.seeds < SOW_SEED_COST) return { mult: 0 };
          this.resources.seeds -= SOW_SEED_COST;
        }
        if (site.growth < FIELD_SOWN_CAP) {
          site.growth = Math.min(FIELD_SOWN_CAP, site.growth + FIELD_SOW_PER_CYCLE);
          site.visualDirty = true;
        }
        return { mult: 0 };
      }
      if (season === 'summer') {
        return { mult: 0 }; // presence alone boosts automatic growth
      }
      if (season === 'autumn' && site.growth > 0) {
        site.growth = Math.max(0, site.growth - FIELD_HARVEST_DRAIN);
        site.visualDirty = true;
        const crop = (CROP_KINDS as string[]).includes(site.productionMode) ? (site.productionMode as ResourceKind) : 'wheat';
        return { mult: this.researched.has('cropRotation') ? 1.5 : 1, kind: crop };
      }
      return { mult: 0 };
    }
    if (profession === 'baker') {
      if (this.resources.flour < 2 || this.resources.firewood < 1) return { mult: 0 };
      this.resources.flour -= 2;
      this.resources.firewood -= 1;
      return { mult: 1 };
    }
    if (profession === 'herbalist') {
      // With Medicine researched the herbalist brews doses from stored herbs;
      // otherwise (or with no herbs) they gather fresh herbs in the forest.
      if (this.researched.has('medicine') && this.resources.herbs >= 2 && this.resources.medicine < this.villagers.length) {
        this.resources.herbs -= 2;
        return { mult: 0.5, kind: 'medicine' }; // amount 2 × 0.5 = 1 dose per brew
      }
      // Herb lore: +50% herbs per trip.
      return { mult: this.researched.has('herbLore') ? 1.5 : 1 };
    }
    if (profession === 'forager') {
      // The forest offers berries, mushrooms, and edible roots by turns.
      const finds: ResourceKind[] = ['berries', 'berries', 'mushrooms', 'roots'];
      return { mult: 1, kind: finds[Math.floor(Math.random() * finds.length)] };
    }
    if (profession === 'brickmaker') {
      if (this.resources.clay < BRICK_CLAY_COST || this.resources.firewood < BRICK_FIREWOOD_COST) return { mult: 0 };
      this.resources.clay -= BRICK_CLAY_COST;
      this.resources.firewood -= BRICK_FIREWOOD_COST;
      // The oven fires whatever the player selected on it (bricks by default).
      const mode = v?.site?.productionMode;
      return mode === 'clayTiles' ? { mult: 1, kind: 'clayTiles' } : { mult: 1 };
    }
    if (profession === 'miner') {
      const oreKind: ResourceKind | null =
        v?.site?.oreType === OreType.Copper ? 'copperOre'
        : v?.site?.oreType === OreType.Tin ? 'tinOre'
        : v?.site?.oreType === OreType.Iron ? 'ironOre'
        : v?.site?.oreType === OreType.Coal ? 'coal'
        : null;
      return oreKind ? { mult: 1, kind: oreKind } : { mult: 0 };
    }
    if (profession === 'soldier') {
      return { mult: 0 }; // training
    }
    if (profession === 'weaponsmith') {
      const recipe = this.weaponsmithRecipe(v?.site?.productionMode ?? 'auto');
      if (!recipe) return { mult: 0 };
      for (const [kind, n] of recipe.consumes) this.resources[kind] -= n;
      return { mult: 1, kind: recipe.yields };
    }
    if (profession === 'tailor') {
      const recipe = this.tailorRecipe(v?.site?.productionMode ?? 'auto');
      if (!recipe) return { mult: 0 };
      for (const [kind, n] of recipe.consumes) this.resources[kind] -= n;
      return { mult: 1, kind: recipe.yields };
    }
    if (profession === 'weaver') {
      const recipe = this.weaverRecipe(v?.site?.productionMode ?? 'auto');
      if (!recipe) return { mult: 0 };
      for (const [kind, n] of recipe.consumes) this.resources[kind] -= n;
      return { mult: 1, kind: recipe.yields };
    }
    if (profession === 'leatherworker') {
      if (this.resources.hides < 2 + TANNERY_HIDE_RESERVE) return { mult: 0 };
      this.resources.hides -= 2;
      return { mult: 1 }; // 2 leather
    }
    if (profession === 'cobbler') {
      const recipe = this.cobblerRecipe(v?.site?.productionMode ?? 'auto');
      if (!recipe) return { mult: 0 };
      for (const [kind, n] of recipe.consumes) this.resources[kind] -= n;
      return { mult: 1, kind: recipe.yields };
    }
    if (profession === 'smelter') {
      const mode = v?.site?.productionMode ?? 'auto';
      // Iron first (if known), then bronze — unless the player pinned a mode.
      if (mode !== 'bronze' && this.researched.has('ironWorking') && this.resources.ironOre >= 2 && this.resources.coal >= 1) {
        this.resources.ironOre -= 2;
        this.resources.coal -= 1;
        return { mult: 1, kind: 'ironBar' };
      }
      if (mode !== 'iron' && this.resources.copperOre >= 1 && this.resources.tinOre >= 1 && this.resources.firewood >= 1) {
        this.resources.copperOre -= 1;
        this.resources.tinOre -= 1;
        this.resources.firewood -= 1;
        return { mult: 1, kind: 'bronzeBar' };
      }
      return { mult: 0 };
    }
    if (profession === 'toolmaker') {
      // Best available tier (iron > bronze > stone > wooden) — or the tier
      // the player pinned on this workshop.
      const mode = v?.site?.productionMode ?? 'auto';
      const tryTier = (tier: string): { mult: number; kind?: ResourceKind } | null => {
        if (tier === 'iron' && this.resources.ironBar >= 1 && this.resources.wood >= 1) {
          this.resources.ironBar -= 1;
          this.resources.wood -= 1;
          return { mult: 1, kind: 'ironTools' };
        }
        if (tier === 'bronze' && this.resources.bronzeBar >= 1 && this.resources.wood >= 1) {
          this.resources.bronzeBar -= 1;
          this.resources.wood -= 1;
          return { mult: 1, kind: 'bronzeTools' };
        }
        if (tier === 'stone' && this.resources.stone >= 2 && this.resources.wood >= 1) {
          this.resources.stone -= 2;
          this.resources.wood -= 1;
          return { mult: 1, kind: 'stoneTools' };
        }
        if (tier === 'wooden' && this.resources.wood >= 2) {
          this.resources.wood -= 2;
          return { mult: 1, kind: 'woodenTools' };
        }
        return null;
      };
      const order = mode === 'auto' ? ['iron', 'bronze', 'stone', 'wooden'] : [mode];
      for (const tier of order) {
        const r = tryTier(tier);
        if (r) return r;
      }
      return { mult: 0 };
    }
    return { mult: 1 }; // Stone, berries, fish, and herbs don't deplete yet.
  }

  /** Hunter reached the quarry's last known tile: strike, keep chasing, or give up. */
  hunterArrived(v: Villager): void {
    const animal = v.targetAnimal;
    if (!animal?.alive) return v.goIdle();
    const dist = Math.hypot(animal.x - v.x, animal.z - v.z);
    if (dist <= 2.5) {
      v.startWorking(JOBS.hunter.workSeconds * v.workTimeFactor);
      return;
    }
    if (++v.chaseTries > 4) return v.goIdle();
    const tx = Math.min(Math.max(Math.floor(animal.x), 0), MAP_SIZE - 1);
    const tz = Math.min(Math.max(Math.floor(animal.z), 0), MAP_SIZE - 1);
    const path = this.grid.isWalkable(tx, tz) ? this.pathToTile(v, tz * MAP_SIZE + tx) : null;
    if (!path) return v.goIdle();
    v.navigate(path, 'toWork');
  }

  /** Drop-off: the closest storage with room in its own ledger (fallback: closest).
   *  Any side of the storage will do (owner rule, session 34). */
  pathToHome(v: Villager): number[] | null {
    const target =
      this.nearestStorage(v.x, v.z, (b) => b.storeTotal() < this.storageCapacityOf(b) - 1) ??
      this.nearestStorage(v.x, v.z);
    if (target) return this.pathToBuilding(v, target);
    const tile = this.rallyTile();
    return this.grid.findPath(Math.floor(v.x), Math.floor(v.z), tile % MAP_SIZE, (tile / MAP_SIZE) | 0);
  }

  /** Pickup: the closest storage whose OWN ledger holds any of the wanted goods
   *  (owner rule: never take from a storage that doesn't hold the item). */
  private pathToSupply(v: Villager, kinds: ResourceKind[]): number[] | null {
    const target = this.nearestStorage(v.x, v.z, (b) => kinds.some((k) => (b.store[k] ?? 0) >= 1));
    if (!target) return this.pathToHome(v); // ledgers stale — reconcile will catch up
    return this.pathToBuilding(v, target);
  }

  /** Materials a build site still needs that the village can supply. */
  private siteMaterials(site: Building): ResourceKind[] {
    return BUILD_MATERIALS.filter((m) => site.needed(m) > 0 && this.resources[m] >= 1);
  }

  /** Free worker slots provided by completed buildings for a profession. */
  /**
   * Which building a profession works from (null = works without one).
   * Owner rule: chopping trees needs no building — any villager can collect
   * wood; the woodcutter's lodge is where firewood gets split.
   */
  workplaceOf(prof: Profession): BuildingKind | null {
    return prof === 'fisher' ? 'fishingHut'
      : prof === 'herbalist' ? 'herbalistHut'
      : prof === 'toolmaker' ? 'toolmaker'
      : prof === 'teacher' ? 'school'
      : prof === 'farmer' ? 'cropField'
      : prof === 'clayDigger' ? 'clayPit'
      : prof === 'brickmaker' ? 'brickOven'
      : prof === 'firewoodmaker' ? 'woodcutterLodge'
      : prof === 'hunter' ? 'huntingLodge'
      : prof === 'forester' ? 'foresterHut'
      : prof === 'miner' ? 'mine'
      : prof === 'smelter' ? 'smelter'
      : prof === 'weaponsmith' ? 'weaponsmith'
      : prof === 'soldier' ? 'trainingGround'
      : prof === 'tailor' ? 'tailor'
      : prof === 'baker' ? 'bakery'
      : prof === 'weaver' ? 'weaver'
      : prof === 'potter' ? 'pottery'
      : prof === 'leatherworker' ? 'leatherworker'
      : prof === 'cobbler' ? 'cobbler'
      : null;
  }

  workerSlots(prof: Profession): number {
    const kind = this.workplaceOf(prof);
    if (!kind) return Infinity;
    let slots = 0;
    for (const b of this.buildings) {
      if (b.state !== 'complete' || b.demolition) continue;
      if (b.spec.kind === kind) slots += b.maxWorkers;
      // Farmers also staff the barn in winter.
      else if (prof === 'farmer' && b.spec.kind === 'barn') slots += b.maxWorkers;
    }
    return slots;
  }

  /** Workers of a profession currently attached to this building. */
  activeAt(b: Building, prof: Profession): number {
    return this.villagers.filter((x) => x.site === b && x.profession === prof && x.state !== 'idle').length;
  }

  private findTargetTile(profession: Profession, v: Villager): number {
    // Workplace professions head to their building.
    if (
      profession === 'fisher' || profession === 'toolmaker' || profession === 'teacher' ||
      profession === 'farmer' || profession === 'clayDigger' || profession === 'brickmaker' ||
      profession === 'firewoodmaker' || profession === 'miner' || profession === 'smelter' ||
      profession === 'weaponsmith' || profession === 'soldier' || profession === 'tailor' ||
      profession === 'baker' || profession === 'weaver' || profession === 'potter' ||
      profession === 'leatherworker' || profession === 'cobbler'
    ) {
      const kind = this.workplaceOf(profession)!;
      // Respect each building's player-set worker cap.
      let huts = this.buildings.filter(
        (b) => b.spec.kind === kind && b.state === 'complete' && !b.demolition && this.activeAt(b, profession) < b.maxWorkers,
      );
      if (profession === 'farmer') {
        const season = this.calendar.season;
        const barns = GRAIN_KINDS.some((g) => this.resources[g] >= 2)
          ? this.buildings.filter(
              (b) => b.spec.kind === 'barn' && b.state === 'complete' && !b.demolition && this.activeAt(b, profession) < b.maxWorkers,
            )
          : [];
        if (season === 'winter') {
          huts = barns; // winter: always the barn (owner rule)
        } else {
          huts = huts.filter((b) => this.fieldHasWork(b, season));
          if (huts.length === 0) huts = barns; // free time → thresh in the barn
        }
      }
      if (huts.length === 0) return -1;
      const pick = huts[Math.floor(Math.random() * huts.length)];
      v.site = pick; // every workplace profession is attached to its building
      return this.entranceOf(pick);
    }
    // Hunters stalk the nearest game — deer, boar, or rabbit.
    if (profession === 'hunter') {
      const animal = this.animals.nearest(v.x, v.z);
      if (!animal) return -1;
      v.targetAnimal = animal;
      v.chaseTries = 0;
      const tx = Math.min(Math.max(Math.floor(animal.x), 0), MAP_SIZE - 1);
      const tz = Math.min(Math.max(Math.floor(animal.z), 0), MAP_SIZE - 1);
      return this.grid.isWalkable(tx, tz) ? tz * MAP_SIZE + tx : -1;
    }
    // Herbalists and foresters work OUT OF a finished hut (owner bug report:
    // never let them start before the building is complete). They are bound
    // to a hut with a free slot and roam from it.
    let originX = v.x;
    let originZ = v.z;
    if (profession === 'herbalist' || profession === 'forester') {
      const kind = profession === 'herbalist' ? 'herbalistHut' : 'foresterHut';
      const huts = this.buildings.filter(
        (b) => b.spec.kind === kind && b.state === 'complete' && !b.demolition && this.activeAt(b, profession) < b.maxWorkers,
      );
      if (huts.length === 0) return -1;
      const hut = huts[Math.floor(Math.random() * huts.length)];
      v.site = hut;
      originX = hut.centerX;
      originZ = hut.centerZ;
    }
    let candidates: Iterable<number>;
    if (profession === 'woodcutter') candidates = this.world.forest.treeTiles;
    else if (profession === 'stonecutter') candidates = this.rockTiles;
    else if (profession === 'strawcutter') candidates = this.strawTiles;
    else if (profession === 'forester') {
      const ox = originX;
      const oz = originZ;
      // Owner rule: half the time the forester fells a nearby mature tree.
      if (Math.random() < 0.5) {
        let best = -1;
        let bestD = 30 * 30;
        for (const t of this.world.forest.treeTiles) {
          const tx = (t % MAP_SIZE) + 0.5;
          const tz = ((t / MAP_SIZE) | 0) + 0.5;
          const d = (tx - ox) ** 2 + (tz - oz) ** 2;
          if (d < bestD && this.grid.isWalkable(t % MAP_SIZE, (t / MAP_SIZE) | 0)) {
            bestD = d;
            best = t;
          }
        }
        if (best !== -1) return best;
        // No trees close by — fall through to planting.
      }
      // Planting: random direction, near-biased random distance, sparse spot.
      for (let attempt = 0; attempt < 24; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 3 + -Math.log(1 - Math.random()) * 14; // exponential: close likely, far rare
        const tx = Math.floor(ox + Math.cos(angle) * dist);
        const tz = Math.floor(oz + Math.sin(angle) * dist);
        if (tx < 1 || tz < 1 || tx >= MAP_SIZE - 1 || tz >= MAP_SIZE - 1) continue;
        const tile = tz * MAP_SIZE + tx;
        const type = this.world.tiles.types[tile];
        if (type !== TileType.Forest && type !== TileType.Grass) continue;
        if (!this.grid.isWalkable(tx, tz) || this.roads.has(tile) || this.walls.has(tile)) continue;
        if (this.world.forest.treeCountAt(tile) > 0 || this.world.forest.growingTiles.has(tile)) continue;
        // Never plant on a building's gathering corner (owner bug: tree at the
        // storage entrance left a builder stuck fetching materials).
        if (this.buildings.some((b) => b.entranceTile === tile)) continue;
        // Density check: at most 2 trees in the 3x3 neighbourhood.
        let nearby = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            nearby += this.world.forest.treeCountAt(tile + dz * MAP_SIZE + dx);
            if (this.world.forest.growingTiles.has(tile + dz * MAP_SIZE + dx)) nearby++;
          }
        }
        if (nearby > 2) continue;
        return tile;
      }
      return -1;
    } else candidates = this.forestTiles; // forager + herbalist gather in the woods

    // Nearest-K by squared distance, then pick one at random to spread workers.
    const best: { tile: number; d: number }[] = [];
    for (const tile of candidates) {
      const tx = (tile % MAP_SIZE) + 0.5;
      const tz = ((tile / MAP_SIZE) | 0) + 0.5;
      if (!this.grid.isWalkable(tile % MAP_SIZE, (tile / MAP_SIZE) | 0)) continue;
      const d = (tx - originX) * (tx - originX) + (tz - originZ) * (tz - originZ);
      if (best.length < NEAREST_POOL) {
        best.push({ tile, d });
        best.sort((a, b) => a.d - b.d);
      } else if (d < best[best.length - 1].d) {
        best[best.length - 1] = { tile, d };
        best.sort((a, b) => a.d - b.d);
      }
    }
    if (best.length === 0) return -1;
    return best[Math.floor(Math.random() * best.length)].tile;
  }

  private findVillageSite(tiles: TileMap, terrain: Terrain): { x: number; z: number } {
    const c = MAP_SIZE / 2;
    // Spiral out from the center looking for a flat grassy 5x5 area.
    for (let radius = 0; radius < MAP_SIZE / 2 - 8; radius += 3) {
      for (let angle = 0; angle < Math.PI * 2; angle += 0.35) {
        const x = Math.floor(c + Math.cos(angle) * radius);
        const z = Math.floor(c + Math.sin(angle) * radius);
        if (x < 8 || z < 8 || x >= MAP_SIZE - 8 || z >= MAP_SIZE - 8) continue;
        let ok = true;
        for (let dz = -2; dz <= 2 && ok; dz++) {
          for (let dx = -2; dx <= 2 && ok; dx++) {
            const t = tiles.types[(z + dz) * MAP_SIZE + (x + dx)];
            if (t !== TileType.Grass && t !== TileType.Straw) ok = false;
          }
        }
        if (!ok) continue;
        const h = terrain.heightAt(x + 0.5, z + 0.5);
        if (h < 0.5) continue;
        return { x: x + 0.5, z: z + 0.5 };
      }
    }
    return { x: c, z: c };
  }
}
