import type { Profession, ResourceKind } from '../sim/village';
import type { BuildingKind } from '../sim/buildings';

/** Shared icon set. SVGs replace emoji that render poorly (owner feedback: 🪨 looks like a crystal). */

export const STONE_ICON =
  '<svg viewBox="0 0 16 14" style="width:calc(var(--u)*14);height:calc(var(--u)*12);vertical-align:-1px">' +
  '<path d="M3 13 L1 9 L4 4 L9 2 L13 5 L15 10 L13 13 Z" fill="#8f8b81" stroke="#55524a" stroke-width="1"/>' +
  '<path d="M4 4 L9 2 L13 5 L8.5 6.5 Z" fill="#a8a49a"/>' +
  '</svg>';

export const HIDE_ICON =
  '<svg viewBox="0 0 16 14" style="width:calc(var(--u)*14);height:calc(var(--u)*12);vertical-align:-1px">' +
  '<path d="M4 1 L12 1 L14 4 L13 9 L11 13 L5 13 L3 9 L2 4 Z" fill="#b3855a" stroke="#6e4f33" stroke-width="1"/>' +
  '<path d="M6 4 L10 4 L11 8 L8 11 L5 8 Z" fill="#c9a06f"/>' +
  '</svg>';

function toolIcon(blade: string): string {
  return (
    '<svg viewBox="0 0 14 14" style="width:calc(var(--u)*13);height:calc(var(--u)*13);vertical-align:-1px">' +
    '<rect x="6" y="4" width="2" height="9" rx="0.5" fill="#8a6a42"/>' +
    `<path d="M4 1 L10 1 L11 5 L3 5 Z" fill="${blade}" stroke="#4a463c" stroke-width="0.8"/>` +
    '</svg>'
  );
}
export const TOOL_WOOD_ICON = toolIcon('#b3855a');
export const TOOL_STONE_ICON = toolIcon('#9a968c');
export const TOOL_BRONZE_ICON = toolIcon('#c08a50');
export const TOOL_IRON_ICON = toolIcon('#c9ccd4');

function oreIcon(color: string): string {
  return (
    '<svg viewBox="0 0 14 13" style="width:calc(var(--u)*13);height:calc(var(--u)*12);vertical-align:-1px">' +
    `<path d="M2 11 L4 5 L7 3 L10 5 L12 11 Z" fill="#8f8b81" stroke="#55524a" stroke-width="0.8"/>` +
    `<circle cx="6" cy="7" r="1.4" fill="${color}"/>` +
    `<circle cx="9" cy="9" r="1.1" fill="${color}"/>` +
    `<circle cx="5" cy="9.6" r="0.9" fill="${color}"/>` +
    '</svg>'
  );
}
export const COPPER_ICON = oreIcon('#b87333');
export const TIN_ICON = oreIcon('#c8c8d4');
export const IRON_ORE_ICON = oreIcon('#a04a30');
export const COAL_ICON = oreIcon('#26221e');

function barIcon(color: string, edge: string): string {
  return (
    '<svg viewBox="0 0 16 12" style="width:calc(var(--u)*14);height:calc(var(--u)*11);vertical-align:-1px">' +
    `<path d="M3 4 L13 4 L15 10 L1 10 Z" fill="${color}" stroke="${edge}" stroke-width="1"/>` +
    `<path d="M3 4 L13 4 L12 6 L4 6 Z" fill="${edge}" opacity="0.35"/>` +
    '</svg>'
  );
}
export const BRONZE_BAR_ICON = barIcon('#c08a50', '#7a5226');
export const IRON_BAR_ICON = barIcon('#aeb4bd', '#5c6169');

export const SPEAR_ICON =
  '<svg viewBox="0 0 14 14" style="width:calc(var(--u)*13);height:calc(var(--u)*13);vertical-align:-1px">' +
  '<rect x="6.3" y="4" width="1.4" height="10" rx="0.5" fill="#8a6a42"/>' +
  '<path d="M7 0 L9 4 L7 5.5 L5 4 Z" fill="#9a968c" stroke="#55524a" stroke-width="0.7"/>' +
  '</svg>';

function swordIcon(blade: string): string {
  return (
    '<svg viewBox="0 0 14 14" style="width:calc(var(--u)*13);height:calc(var(--u)*13);vertical-align:-1px">' +
    `<path d="M6.2 1 L7.8 1 L7.6 8.5 L6.4 8.5 Z" fill="${blade}" stroke="#4a463c" stroke-width="0.5"/>` +
    '<rect x="4.5" y="8.5" width="5" height="1.3" rx="0.5" fill="#8a6a42"/>' +
    '<rect x="6.3" y="9.8" width="1.4" height="3.4" rx="0.5" fill="#6b4a2f"/>' +
    '</svg>'
  );
}
export const BRONZE_WEAPON_ICON = swordIcon('#c08a50');
export const IRON_WEAPON_ICON = swordIcon('#c9ccd4');

export const STRAW_ICON =
  '<svg viewBox="0 0 14 14" style="width:calc(var(--u)*13);height:calc(var(--u)*13);vertical-align:-1px">' +
  '<path d="M3 13 L6 2 L7 2 L5.4 13 Z" fill="#d8c25a"/>' +
  '<path d="M6.5 13 L7.5 1.5 L8.5 1.6 L8.2 13 Z" fill="#c9b04f"/>' +
  '<path d="M9 13 L8 2.2 L9 2 L11 13 Z" fill="#d8c25a"/>' +
  '<rect x="4" y="8" width="7" height="1.4" rx="0.7" fill="#8a6a42"/>' +
  '</svg>';

export const CLAY_TILES_ICON =
  '<svg viewBox="0 0 16 14" style="width:calc(var(--u)*14);height:calc(var(--u)*12);vertical-align:-1px">' +
  '<path d="M1 6 Q4 2 8 6 Q12 2 15 6 L15 8 Q12 4 8 8 Q4 4 1 8 Z" fill="#b06a42" stroke="#6e3f26" stroke-width="0.8"/>' +
  '<path d="M1 10 Q4 6 8 10 Q12 6 15 10 L15 12 Q12 8 8 12 Q4 8 1 12 Z" fill="#9a5a38" stroke="#6e3f26" stroke-width="0.8"/>' +
  '</svg>';

export const CLAY_ICON =
  '<svg viewBox="0 0 16 14" style="width:calc(var(--u)*14);height:calc(var(--u)*12);vertical-align:-1px">' +
  '<ellipse cx="8" cy="10" rx="6.5" ry="3.2" fill="#96603a" stroke="#5f3c24" stroke-width="1"/>' +
  '<ellipse cx="6.5" cy="6.5" rx="4" ry="2.6" fill="#a86c42" stroke="#5f3c24" stroke-width="1"/>' +
  '</svg>';

export const FUR_ICON =
  '<svg viewBox="0 0 16 14" style="width:calc(var(--u)*14);height:calc(var(--u)*12);vertical-align:-1px">' +
  '<path d="M4 1 L12 1 L14 4 L13 9 L11 13 L5 13 L3 9 L2 4 Z" fill="#d8d2c8" stroke="#8a8478" stroke-width="1"/>' +
  '<path d="M6 4 L10 4 L11 8 L8 11 L5 8 Z" fill="#efeae2"/>' +
  '</svg>';

export const LINEN_ICON =
  '<svg viewBox="0 0 16 14" style="width:calc(var(--u)*14);height:calc(var(--u)*12);vertical-align:-1px">' +
  '<path d="M2 4 L14 4 L14 12 L2 12 Z" fill="#e8ddc4" stroke="#a89468" stroke-width="1"/>' +
  '<path d="M2 6.5 L14 6.5 M2 9 L14 9" stroke="#cbbb96" stroke-width="0.8"/>' +
  '<ellipse cx="8" cy="4" rx="6" ry="1.6" fill="#f2ead6" stroke="#a89468" stroke-width="1"/>' +
  '</svg>';

export const RESOURCE_ICONS: Record<ResourceKind | 'pop', string> = {
  wood: '🪵',
  stone: STONE_ICON,
  straw: STRAW_ICON,
  clayTiles: CLAY_TILES_ICON,
  berries: '🍒',
  mushrooms: '🍄',
  roots: '🫚',
  meat: '🍖',
  fish: '🐟',
  seeds: '🌱',
  wheat: '🌾',
  rye: '🌾',
  oat: '🌾',
  barley: '🌾',
  potatoes: '🥔',
  tomatoes: '🍅',
  peppers: '🌶️',
  strawberries: '🍓',
  carrots: '🥕',
  melons: '🍈',
  watermelons: '🍉',
  flour: '🥡',
  bread: '🍞',
  animalFeed: '🫘',
  firewood: '🔥',
  herbs: '🌿',
  medicine: '💊',
  hides: HIDE_ICON,
  woodenTools: TOOL_WOOD_ICON,
  stoneTools: TOOL_STONE_ICON,
  clay: CLAY_ICON,
  brick: '🧱',
  fur: FUR_ICON,
  string: '🧵',
  linen: LINEN_ICON,
  leather: '🟫',
  sandals: '🩴',
  hideShoes: '👞',
  boots: '🥾',
  luxuryBoots: '👢',
  clothes: '🧥',
  fineClothes: '👔',
  luxuryClothes: '👘',
  pottery: '🏺',
  copperOre: COPPER_ICON,
  tinOre: TIN_ICON,
  ironOre: IRON_ORE_ICON,
  coal: COAL_ICON,
  bronzeBar: BRONZE_BAR_ICON,
  ironBar: IRON_BAR_ICON,
  bronzeTools: TOOL_BRONZE_ICON,
  ironTools: TOOL_IRON_ICON,
  spears: SPEAR_ICON,
  bronzeWeapons: BRONZE_WEAPON_ICON,
  ironWeapons: IRON_WEAPON_ICON,
  leatherArmor: '🛡️',
  pop: '👥',
};

export const RESOURCE_LABELS: Record<ResourceKind, string> = {
  wood: 'Wood',
  stone: 'Stone',
  straw: 'Straw',
  clayTiles: 'Clay tiles',
  berries: 'Berries',
  mushrooms: 'Mushrooms',
  roots: 'Wild roots',
  meat: 'Meat',
  fish: 'Fish',
  seeds: 'Seeds',
  wheat: 'Wheat',
  rye: 'Rye',
  oat: 'Oat',
  barley: 'Barley',
  potatoes: 'Potatoes',
  tomatoes: 'Tomatoes',
  peppers: 'Peppers',
  strawberries: 'Strawberries',
  carrots: 'Carrots',
  melons: 'Melons',
  watermelons: 'Watermelons',
  flour: 'Flour',
  bread: 'Bread',
  animalFeed: 'Animal feed',
  firewood: 'Firewood',
  herbs: 'Herbs',
  medicine: 'Medicine',
  hides: 'Hides',
  woodenTools: 'Wooden tools',
  stoneTools: 'Stone tools',
  clay: 'Clay',
  brick: 'Bricks',
  fur: 'Fur',
  string: 'String',
  linen: 'Linen',
  leather: 'Leather',
  sandals: 'Sandals',
  hideShoes: 'Hide shoes',
  boots: 'Boots',
  luxuryBoots: 'Luxury boots',
  clothes: 'Basic clothes',
  fineClothes: 'Fine clothes',
  luxuryClothes: 'Luxury clothes',
  pottery: 'Pottery',
  copperOre: 'Copper ore',
  tinOre: 'Tin ore',
  ironOre: 'Iron ore',
  coal: 'Coal',
  bronzeBar: 'Bronze bars',
  ironBar: 'Iron bars',
  bronzeTools: 'Bronze tools',
  ironTools: 'Iron tools',
  spears: 'Spears',
  bronzeWeapons: 'Bronze weapons',
  ironWeapons: 'Iron weapons',
  leatherArmor: 'Leather armor',
};

export const PROFESSION_LABELS: Record<Profession, string> = {
  woodcutter: '🪓 Woodcutter',
  stonecutter: `${STONE_ICON} Stone gatherer`,
  strawcutter: `${STRAW_ICON} Straw cutter`,
  forager: '🧺 Forager',
  firewoodmaker: '🔥 Firewood splitter',
  builder: '🔨 Builder',
  hunter: '🏹 Hunter',
  fisher: '🎣 Fisher',
  herbalist: '🌿 Herbalist',
  toolmaker: `${TOOL_STONE_ICON} Toolmaker`,
  teacher: '📖 Teacher',
  farmer: '🌾 Farmer',
  clayDigger: `${CLAY_ICON} Clay digger`,
  brickmaker: '🧱 Brickmaker',
  forester: '🌲 Forester',
  miner: '⛏️ Miner',
  smelter: '⚒️ Smelter',
  weaponsmith: `${IRON_WEAPON_ICON} Weaponsmith`,
  soldier: '🛡️ Soldier',
  tailor: '🧥 Tailor',
  baker: '🍞 Baker',
  weaver: '🧶 Weaver',
  potter: '🏺 Potter',
  leatherworker: `${HIDE_ICON} Leatherworker`,
  cobbler: '👞 Cobbler',
};

export const BUILDING_ICONS: Record<BuildingKind, string> = {
  house: '🏠',
  stoneHouse: '🛖',
  brickHouse: '🏘️',
  woodcutterLodge: '🪓',
  huntingLodge: '🏹',
  foresterHut: '🌲',
  fishingHut: '🎣',
  herbalistHut: '🌿',
  toolmaker: '🛠️',
  storageShed: '📦',
  school: '📖',
  cropField: '🌾',
  clayPit: CLAY_ICON,
  brickOven: '🧱',
  tradingPost: '🏕',
  mine: '⛏️',
  smelter: '⚒️',
  trainingGround: '🛡️',
  weaponsmith: IRON_WEAPON_ICON,
  watchtower: '🗼',
  tailor: '🧥',
  barn: '🐄',
  bakery: '🍞',
  manor: '🏰',
  temple: '⛪',
  weaver: '🧶',
  pottery: '🏺',
  stockpile: '⛺',
  leatherworker: '💼',
  cobbler: '👞',
};
