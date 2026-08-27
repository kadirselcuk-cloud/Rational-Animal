import { Villager, type Village, type Profession, type ResourceKind, type ToolTier, type WeaponTier, type WallKind } from './village';
import type { Calendar } from './calendar';
import type { TradeSystem, TribeSide } from './tribes';
import type { AnimalSystem, Species } from './animals';
import type { World } from '../world/worldScene';
import type { BuildingKind, BuildMaterial } from './buildings';
import { SEASON_SECONDS } from './calendar';

/**
 * Save/load. The world (terrain, tiles, ores, tribes' camps) regenerates
 * deterministically from the seed, so a save stores only mutable state and
 * replays forest changes onto the freshly generated map.
 *
 * Loading works by stashing the save in sessionStorage and reloading the page
 * with the save's seed — every system then boots fresh and applySave() layers
 * the state on top. In-flight caravans, raids, and war parties are not saved.
 */

export interface SaveData {
  version: number;
  savedAt: number;
  seed: number;
  elapsed: number;
  resources: Record<ResourceKind, number>;
  knowledge: number;
  researched: string[];
  desired: Record<Profession, number>;
  villagers: {
    name: string;
    sex: 'male' | 'female';
    age: number;
    lifespan: number;
    x: number;
    z: number;
    tool: ToolTier;
    toolUses: number;
    weapon: WeaponTier;
    hasArmor: boolean;
    home: number; // building index or -1
    spouse: number; // villager index or -1
    mother: number;
    father: number;
    pregnantTimer: number;
    /** Legacy boolean (pre-clothing-tiers saves). */
    hasClothes?: boolean;
    clothing?: string;
    /** Seconds left on the worn garment. */
    cw?: number;
    shoes?: string;
    sw?: number;
    grief?: number;
    ill?: boolean;
    illTimer?: number;
    illTreated?: boolean;
    /** Trade held when saved — without it every villager idled on load. */
    prof?: string;
    /** Goods in hand mid-haul (delivered to a storage right after load). */
    carry?: { kind: string; amount: number };
    cold?: number;
  }[];
  /** Villager index of the baron, or -1. */
  baron?: number;
  /** Dirt road tiles (legacy saves: all roads). */
  roads: number[];
  stoneRoads?: number[];
  walls: [number, string][];
  buildings: {
    kind: BuildingKind;
    ax: number;
    az: number;
    /** Placement rotation in quarter turns (0..3); absent in old saves. */
    rot?: number;
    delivered: Partial<Record<BuildMaterial, number>>;
    workRemaining: number;
    growth: number;
    oreType: number;
    maxWorkers?: number;
    mode?: string;
    pantry?: Record<string, number>;
    up?: boolean;
    clay?: number;
    pot?: number;
    /** Storage buildings: their own inventory ledger. */
    store?: Record<string, number>;
    /** Houses: firewood carried home. */
    fw?: number;
    /** Houses: warmth grace, hearth timer, cold strikes (session 38). */
    grace?: number;
    warm?: number;
    cold?: number;
    potT?: number;
  }[];
  /** Harvested straw tiles awaiting regrowth. */
  strawCut?: { tile: number; at: number }[];
  /** Quarried-out rock tiles (stone destroyed for good). */
  rocksCut?: number[];
  pendingWorks?: { tile: number; kind: string; work: number }[];
  forest: {
    removed: number[];
    planted: { tile: number; x: number; y: number; z: number; at: number }[];
  };
  tribes: { side: TribeSide; relation: number; defeated: boolean }[];
  /** Legacy head counts (old saves regenerate herds from these). */
  deer: number;
  boars?: number;
  rabbits?: number;
  /** Exact wildlife (session 38): every animal at its saved spot. */
  animalsList?: { sp: string; x: number; z: number; ax: number; az: number; young: boolean }[];
  stats?: { births: number; deaths: number };
  history?: { t: number; pop: number; food: number; firewood: number }[];
}

export function captureSave(
  seed: number,
  calendar: Calendar,
  village: Village,
  trade: TradeSystem,
  animals: AnimalSystem,
  world: World,
): SaveData {
  return {
    version: 1,
    savedAt: Date.now(),
    seed,
    elapsed: calendar.elapsedSeconds,
    resources: { ...village.resources },
    knowledge: village.knowledge,
    researched: [...village.researched],
    desired: { ...village.desired },
    villagers: village.villagers.map((v) => ({
      name: v.name,
      sex: v.sex,
      age: v.ageYears,
      lifespan: v.lifespan,
      x: v.x,
      z: v.z,
      tool: v.tool,
      toolUses: v.toolUses,
      weapon: v.weapon,
      hasArmor: v.hasArmor,
      home: v.home ? village.buildings.indexOf(v.home) : -1,
      spouse: v.spouse ? village.villagers.indexOf(v.spouse) : -1,
      mother: v.mother ? village.villagers.indexOf(v.mother) : -1,
      father: v.father ? village.villagers.indexOf(v.father) : -1,
      pregnantTimer: v.pregnantTimer,
      clothing: v.clothing,
      cw: v.clothingTimer,
      shoes: v.shoes,
      sw: v.shoeTimer,
      grief: v.griefTimer,
      ill: v.ill,
      illTimer: v.illTimer,
      illTreated: v.illTreated,
      prof: v.profession ?? undefined,
      carry: v.carrying ? { ...v.carrying } : undefined,
      cold: v.coldStrikes,
    })),
    baron: village.baron ? village.villagers.indexOf(village.baron) : -1,
    roads: [...village.roads.entries()].filter(([, k]) => k === 'dirt').map(([t]) => t),
    stoneRoads: [...village.roads.entries()].filter(([, k]) => k === 'stone').map(([t]) => t),
    walls: [...village.walls.entries()],
    buildings: village.buildings.map((b) => ({
      kind: b.spec.kind,
      ax: b.anchorX,
      az: b.anchorZ,
      rot: b.rot,
      delivered: { ...b.delivered },
      workRemaining: b.workRemaining,
      growth: b.growth,
      oreType: b.oreType,
      maxWorkers: b.maxWorkers,
      mode: b.productionMode,
      pantry: { ...b.pantry } as Record<string, number>,
      up: b.upgraded,
      clay: b.clayTaken,
      pot: b.potteryCount,
      store: { ...b.store } as Record<string, number>,
      fw: b.firewoodStore,
      grace: b.graceTimer,
      warm: b.warmTimer,
      cold: b.coldStrikes,
      potT: b.potteryTimer,
    })),
    strawCut: village.strawRegrow.map((s) => ({ ...s })),
    rocksCut: [...village.rocksRemoved],
    pendingWorks: village.pendingWorks.map((p) => ({ ...p })),
    forest: {
      removed: [...world.forest.removedLog],
      planted: [...world.forest.plantLog],
    },
    tribes: trade.tribes.map((t) => ({ side: t.side, relation: t.relation, defeated: t.defeated })),
    deer: animals.count('deer'),
    boars: animals.count('boar'),
    rabbits: animals.count('rabbit'),
    animalsList: animals.deer
      .filter((a) => a.alive)
      .map((a) => ({ sp: a.species, x: a.x, z: a.z, ax: a.anchorX, az: a.anchorZ, young: a.young })),
    stats: { ...village.stats },
    history: village.history.map((h) => ({ ...h })),
  };
}

export function applySave(
  data: SaveData,
  calendar: Calendar,
  village: Village,
  trade: TradeSystem,
  animals: AnimalSystem,
  world: World,
): void {
  calendar.load(data.elapsed);

  // Old saves used a single 'food' pool — fold it into berries.
  const res = { ...data.resources } as Record<string, number>;
  if (res.food !== undefined) {
    res.berries = (res.berries ?? 0) + res.food;
    delete res.food;
  }
  if (res.crops !== undefined) {
    res.wheat = (res.wheat ?? 0) + res.crops; // pre-crop-variety saves
    delete res.crops;
  }
  for (const [k, n] of Object.entries(res)) {
    if (k in village.resources) village.resources[k as ResourceKind] = n;
  }
  village.knowledge = data.knowledge;
  village.researched.clear();
  for (const id of data.researched) village.researched.add(id);
  Object.assign(village.desired, data.desired);

  // Buildings first (their placement flattens terrain and clears footprints).
  village.buildings.length = 0;
  const buildings = data.buildings.map((sb) => {
    const b = village.restoreBuilding(sb.kind, sb.ax, sb.az, sb.delivered, sb.workRemaining, sb.growth, sb.oreType, sb.rot ?? 0);
    if (b) {
      if (sb.maxWorkers !== undefined) b.maxWorkers = sb.maxWorkers;
      if (sb.mode) b.productionMode = sb.mode;
      if (sb.pantry) b.pantry = { ...sb.pantry };
      if (sb.up) b.upgraded = true;
      if (sb.clay) {
        b.clayTaken = sb.clay;
        if (b.clayTaken >= 1000) village.depleteClayPit(b); // re-spend the deposit
      }
      if (sb.pot) b.potteryCount = sb.pot;
      if (sb.store) b.store = { ...sb.store };
      if (sb.fw) b.firewoodStore = sb.fw;
      if (sb.grace) b.graceTimer = sb.grace;
      if (sb.warm) b.warmTimer = sb.warm;
      if (sb.cold) b.coldStrikes = sb.cold;
      if (sb.potT) b.potteryTimer = sb.potT;
    }
    return b;
  });
  for (const p of data.pendingWorks ?? []) {
    village.pendingWorks.push({ tile: p.tile, kind: p.kind as 'road', work: p.work });
  }
  // Saves from before the stockpile was a real building: recreate it.
  village.placePrebuiltStockpile();

  // Forest: replay planting, mature what has grown, replay felling.
  for (const p of data.forest.planted) world.forest.plantAt(p.tile, p.x, p.y, p.z, p.at);
  world.forest.tickGrowth(data.elapsed);
  for (const tile of data.forest.removed) world.forest.removeTreeAt(tile);
  village.reclearFootprints();
  // Replace the replay-polluted logs with the saved truth.
  world.forest.removedLog = [...data.forest.removed];
  world.forest.plantLog = [...data.forest.planted];

  // Villagers.
  village.villagers.length = 0;
  for (const sv of data.villagers) {
    const v = new Villager(sv.x, sv.z, sv.age);
    v.name = sv.name;
    v.sex = sv.sex;
    v.lifespan = sv.lifespan;
    v.tool = sv.tool;
    v.toolUses = sv.toolUses;
    v.weapon = sv.weapon;
    v.hasArmor = sv.hasArmor;
    v.pregnantTimer = sv.pregnantTimer ?? 0;
    v.clothing = (sv.clothing as typeof v.clothing) ?? (sv.hasClothes ? 'basic' : 'none');
    v.clothingTimer = sv.cw ?? (v.clothing !== 'none' ? 900 : 0); // legacy: half a basic garment left
    v.shoes = (sv.shoes as typeof v.shoes) ?? 'none';
    v.shoeTimer = sv.sw ?? 0;
    v.griefTimer = sv.grief ?? 0;
    v.ill = sv.ill ?? false;
    v.illTimer = sv.illTimer ?? 0;
    v.illTreated = sv.illTreated ?? false;
    // Everyone keeps their trade (owner rule, session 38): the idle tick
    // re-hires them into it within seconds via occupation stickiness.
    v.profession = (sv.prof as Profession) ?? null;
    v.coldStrikes = sv.cold ?? 0;
    if (sv.carry && sv.carry.amount > 0) v.carrying = { kind: sv.carry.kind as ResourceKind, amount: sv.carry.amount };
    const home = sv.home >= 0 ? buildings[sv.home] : null;
    if (home) {
      v.home = home;
      home.occupants.push(v);
    }
    village.villagers.push(v);
  }
  // Family links by index once everyone exists.
  data.villagers.forEach((sv, i) => {
    const vs = village.villagers;
    if (sv.spouse >= 0 && sv.spouse < vs.length) vs[i].spouse = vs[sv.spouse];
    if ((sv.mother ?? -1) >= 0 && sv.mother < vs.length) vs[i].mother = vs[sv.mother];
    if ((sv.father ?? -1) >= 0 && sv.father < vs.length) vs[i].father = vs[sv.father];
  });

  const baronIdx = data.baron ?? -1;
  if (baronIdx >= 0 && baronIdx < village.villagers.length) {
    village.baron = village.villagers[baronIdx];
    village.baron.isBaron = true;
  }

  village.restoreStrawCut(data.strawCut ?? []);
  village.restoreRocksCut(data.rocksCut ?? []);

  for (const tile of data.roads ?? []) village.restoreRoad(tile, 'dirt');
  for (const tile of data.stoneRoads ?? []) village.restoreRoad(tile, 'stone');
  for (const [tile, kind] of data.walls ?? []) village.restoreWall(tile, kind as WallKind);

  // Mid-haul loads resume their trip to storage (paths need roads/walls set).
  for (const v of village.villagers) {
    if (v.carrying) v.navigate(village.pathToHome(v), 'toHome');
  }

  if (data.stats) Object.assign(village.stats, data.stats);
  if (data.history) {
    village.history.length = 0;
    for (const h of data.history) village.history.push({ ...h });
  }

  for (const st of data.tribes) {
    const tribe = trade.tribes.find((t) => t.side === st.side);
    if (tribe) {
      tribe.relation = st.relation;
      tribe.defeated = st.defeated;
    }
  }

  if (data.animalsList) {
    // Exact restore: every animal back at its saved spot (owner rule, s38).
    animals.restoreExact(data.animalsList.map((a) => ({ ...a, sp: a.sp as Species })));
  } else {
    // Legacy saves only stored head counts — herds re-seed in habitat.
    animals.setPopulation('deer', data.deer);
    if (data.boars !== undefined) animals.setPopulation('boar', data.boars);
    if (data.rabbits !== undefined) animals.setPopulation('rabbit', data.rabbits);
  }
}

// ---------------------------------------------------------------- slots

export const SAVE_SLOTS = ['1', '2', '3', 'auto'] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

const KEY = (slot: SaveSlot) => `northreach-save-${slot}`;
const PENDING_KEY = 'northreach-pending-load';

export function writeSlot(slot: SaveSlot, data: SaveData): void {
  localStorage.setItem(KEY(slot), JSON.stringify(data));
}

export function readSlot(slot: SaveSlot): SaveData | null {
  const raw = localStorage.getItem(KEY(slot));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

export function deleteSlot(slot: SaveSlot): void {
  localStorage.removeItem(KEY(slot));
}

export function slotSummary(slot: SaveSlot): string | null {
  const data = readSlot(slot);
  if (!data) return null;
  const year = Math.floor(data.elapsed / (SEASON_SECONDS * 4)) + 1;
  const when = new Date(data.savedAt).toLocaleString();
  return `Year ${year} · 👥 ${data.villagers.length} · ${when}`;
}

/** Begin loading: stash the save and reload the page on the right seed. */
export function requestLoad(data: SaveData): void {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
  const url = new URL(location.href);
  url.searchParams.set('seed', String(data.seed));
  location.href = url.toString();
}

/** On boot: the save waiting to be applied, if any. */
export function takePendingLoad(): SaveData | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(PENDING_KEY);
  try {
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}
