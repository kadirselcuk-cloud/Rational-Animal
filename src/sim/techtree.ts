/**
 * The playable tech tree (Roadmap v2, Phase B) — SKILL_TREE.md pruned to 125
 * nodes across tiers T0–T6. Advancing to the next era requires completing ALL
 * techs of the current tier (owner decision 3); later tiers stay locked until
 * then (decision 12). This module is data + progression state only — the
 * gameplay wiring of each unlock lands in Phase C. Until then the tree is
 * explorable in-game (🌳 button) and, as a dev aid, any node can be completed
 * by double-click "as if played": its prerequisite chain and every earlier
 * tier complete with it.
 */

export type TechBranch =
  | 'food' | 'farm' | 'craft' | 'metal' | 'build'
  | 'mach' | 'know' | 'med' | 'war' | 'civ';

export const BRANCH_ORDER: TechBranch[] = [
  'food', 'farm', 'craft', 'metal', 'build', 'mach', 'know', 'med', 'war', 'civ',
];

export const BRANCH_LABELS: Record<TechBranch, string> = {
  food: '🍖 Food',
  farm: '🌾 Farm & Herd',
  craft: '🧶 Crafts',
  metal: '⛏️ Metals',
  build: '🏠 Building',
  mach: '⚙️ Machines',
  know: '📖 Knowledge',
  med: '⚕️ Medicine',
  war: '⚔️ War',
  civ: '🏛️ Society',
};

/** Era names for the tiers that carry nodes (internally T0–T6 — the T-codes
 * are dev shorthand only and never shown to the player). */
export const TIER_NAMES = [
  'Hello World!',
  'Bloody Roots',
  'Domesticated',
  'Civilization!',
  'Iron Age, Golden Price',
  'Shepherds & Sheep',
  'The Kindling',
];

/** Short humorous age descriptions shown under the era title in the tree
 * (tone rule; condensed from the SKILL_TREE.md era intros). */
export const TIER_BLURBS = [
  'A damp huddle of upright mammals with thumbs, complaints, and a borrowed fire. ' +
    "The agenda: eat, sleep, don't get eaten. The wolves are taking bets.",
  'The legendary ancestors, live and unwashed: sharper sticks, cleverer traps, and a scholarly ' +
    "devotion to animal droppings. Hard? Enormously. So was the salmon's year, and nobody sings about the salmon.",
  'You fenced the grass, roofed the mud, and called it home — the animal you finally tamed is you. ' +
    'Promoted from ape to primate; the ceremony is held daily, at dawn, in the field.',
  'Furnaces make stone weep metal and marks in clay remember — no wolf ever managed either. ' +
    "The first thing you cast, though, was a spear. And the walls aren't for wolves; they're for neighbors... much like yourself.",
  'Iron in every hand, roads that run straight, a bearded optimist declaring you rational. ' +
    'Then you minted the coin — the first appetite in the history of life with no bottom. ' +
    'The squirrel stops hoarding when winter is covered. You found a way not to.',
  'Castles on the hills, mills on the streams, and you in the ledger one line below the oxen. ' +
    'Chains cost iron; a fence inside the head costs one sermon a week. Wages for obedience are paid in heaven — non-refundable.',
  'The cannon has opinions about your walls, and the press makes sparks contagious. ' +
    "Grow, kneel, or become a lesson in somebody else's chronicle. The kindling is stacked, animal — the spark is yours.",
];

/** The chapters after the settlement game — separate tech trees, designed later. */
export const STUB_TIERS = [
  {
    name: 'Golden Age, Iron Price',
    note: "The astronomer's ship carries chains: discovery pays, cruelty pays better. A different game, with its own tree — later.",
  },
  {
    name: 'Full Metal Century',
    note: 'Science delivers — by the trainload, around the clock, in shifts. A different game, with its own tree — later.',
  },
  {
    name: 'Are We There Yet, Aristo?',
    note: 'The ashes cool and the question falls due. No tree here — just you, answering it.',
  },
];

export interface TechNode {
  id: string;
  name: string;
  icon: string;
  tier: number;
  branch: TechBranch;
  prereqs: string[];
  kp: number;
  /** Era-defining gateway tech — gets a ⭐ badge. */
  star?: boolean;
  /** What it does in the game (mechanic wiring comes in Phase C). */
  effect: string;
  /** Player-facing description in the game's voice (tone rule). */
  flavor: string;
}

const N = (
  tier: number, branch: TechBranch, id: string, icon: string, name: string,
  kp: number, prereqs: string[], effect: string, flavor: string, star = false,
): TechNode => ({ id, name, icon, tier, branch, prereqs, kp, star, effect, flavor });

export const TECH_NODES: TechNode[] = [
  // ------------------------------------------------------------- T0 · Hello World!
  N(0, 'food', 'foraging', '🫐', 'Foraging', 5, [],
    'Foragers gather berries, roots and eggs from the forest.',
    'Pick it up, sniff it, eat it. The squirrels invented this first, and better.'),
  N(0, 'food', 'scavenging', '🦴', 'Scavenging', 5, [],
    'A little meat from small game and fresh carcasses.',
    'Whatever died recently enough is dinner. The crows leave you the leftovers — out of pity.'),
  N(0, 'food', 'fire-keeping', '🏕️', 'Fire Keeping', 6, [],
    'The camp fire stays lit and burns gathered sticks for warmth.',
    "You didn't make it. You found it. Now you fuss over it like a nervous parent."),
  N(0, 'craft', 'stick-gathering', '🪵', 'Stick Gathering', 5, [],
    'Villagers collect fallen branches — a slow trickle of wood.',
    'Bend down. Grab stick. Repeat for a hundred thousand years.'),
  N(0, 'craft', 'stone-picking', '🪨', 'Stone Picking', 5, [],
    'Found stones serve as crude hammers and choppers.',
    'Some rocks are sharper than others. Savor this insight; it took millennia.'),
  N(0, 'know', 'spoken-language', '💬', 'Spoken Language', 8, [],
    'Workers can be assigned to jobs — coordination exists.',
    'Grunts, with grammar. At last you can be misunderstood precisely.'),
  N(0, 'civ', 'the-band', '👥', 'The Band', 8, ['spoken-language'],
    'Food and goods are shared at the camp stockpile.',
    "Everything is shared, because owning things hasn't been invented to fight about yet."),
  N(0, 'build', 'brush-shelter', '🛖', 'Brush Shelters', 10, ['stick-gathering'],
    'Windbreaks at the camp — a little warmth at night.',
    'A pile of brush between you and the sky. The sky remains unimpressed.'),

  // ------------------------------------------------------------- T1 · Bloody Roots
  N(1, 'food', 'plant-lore', '🌿', 'Plant Lore', 15, ['foraging'],
    'Foragers find more, and know mushrooms and roots from poison.',
    'Learn which plants feed you and which turn you into a cautionary tale.'),
  N(1, 'war', 'wooden-spear', '🍢', 'Wooden Spear', 15, ['stick-gathering'],
    'Spears craftable — hunters and defenders hit harder.',
    'A long stick with an opinion at one end. Your first invention is stabbing from further away.'),
  N(1, 'food', 'hunting', '🦌', 'Hunting', 18, ['wooden-spear'],
    'Hunters stalk deer for meat and hides.',
    'Follow the droppings, throw the stick, drag home the proof of your genius.'),
  N(1, 'food', 'fishing', '🎣', 'Fishing', 18, ['cordage'],
    'Fishers work the waters from a fishing hut.',
    'The river is a pantry that occasionally drowns you.'),
  N(1, 'food', 'trapping', '🪤', 'Trapping & Snares', 18, ['cordage'],
    'Snares catch small game while everyone sleeps — hunters yield more.',
    'Food that catches itself. The laziest idea you ever had, and among the best.'),
  N(1, 'food', 'fire-making', '🔥', 'Fire Making', 25, ['fire-keeping'],
    'Fire on demand — hearths can be lit and relit anywhere.',
    'Rub sticks until smoke appears. The single greatest trick your species will ever perform.', true),
  N(1, 'food', 'cooking', '🍖', 'Cooking', 18, ['fire-making'],
    'Cooked meals nourish more — food goes further.',
    'Burned meat beats raw meat. Cuisine will take another forty thousand years.'),
  N(1, 'food', 'smoking-drying', '🥓', 'Smoking & Drying', 20, ['cooking'],
    'Smoked stores — food keeps through the winter.',
    'Hang dinner in the smoke and winter loses its favorite argument.'),
  N(1, 'craft', 'knapping', '🔨', 'Stone Knapping', 20, ['stone-picking'],
    'Flint blades — stone tools become craftable.',
    'Hit the rock at the correct angle. Congratulations: manufacturing.', true),
  N(1, 'craft', 'cordage', '🪢', 'Cordage', 15, ['foraging'],
    'String and rope from twisted fibre — quietly essential.',
    'Twisted grass that holds the world together. Nobody will ever write songs about it.'),
  N(1, 'craft', 'hafting', '🪓', 'Hafting', 20, ['knapping', 'cordage'],
    'Blade meets handle — wooden and stone tools work faster.',
    'Tie the sharp rock to the stick. Two mediocre objects, one respectable axe.'),
  N(1, 'craft', 'hide-working', '🦫', 'Hide Working', 18, ['hunting'],
    'Hides scraped and dried into usable pelts.',
    'Wear the deer. It objected earlier; it has stopped.'),
  N(1, 'craft', 'sewn-clothing', '🧥', 'Sewn Clothing', 22, ['hide-working'],
    'Fitted fur clothes — villagers endure the cold longer.',
    'The needle turns carcasses into fashion. Winter starts losing.'),
  N(1, 'build', 'pit-houses', '⛺', 'Pit Houses', 25, ['brush-shelter'],
    'Dug shelters with pole roofs — warmer nights, fewer frozen relatives.',
    'Dig a hole, roof the hole, live in the hole. Property values: one hole.'),
  N(1, 'know', 'oral-tradition', '🗣️', 'Oral Tradition', 15, ['spoken-language'],
    'Elders pass knowledge on — knowledge points accrue faster.',
    'Grandmother remembers everything. Knowledge now survives its knower — mostly intact, mostly.'),
  N(1, 'know', 'tally-marks', '🔢', 'Tally Marks', 18, ['spoken-language'],
    'Counting on bone and cord — stores show exact numbers.',
    'Scratch a mark for every deer. Now you know precisely how little you have.'),
  N(1, 'know', 'sky-lore', '🌌', 'Sky Lore', 20, ['oral-tradition'],
    'Reading moon and stars — the seasons announce themselves.',
    'The stars repeat themselves. You noticed. The frost stops being a surprise.'),
  N(1, 'med', 'herbal-remedies', '🌱', 'Herbal Remedies', 20, ['plant-lore'],
    'The herbalist brews medicine from gathered herbs.',
    'A leaf your aunt is fairly confident about. Medicine has begun.'),
  N(1, 'med', 'wound-care', '🩹', 'Wound Care', 18, ['herbal-remedies'],
    'Wounds washed and bound — the hurt and sick recover sooner.',
    'Wash it, bind it, hope. Two of the three actually help.'),
  N(1, 'war', 'warband', '🛡️', 'The Warband', 22, ['wooden-spear', 'the-band'],
    'Every able adult defends the camp when trouble comes.',
    "Everyone grabs a spear and stands together. Courage, or arithmetic — attackers can't tell."),

  // ------------------------------------------------------------- T2 · Domesticated
  N(2, 'farm', 'seed-selection', '🌾', 'Seed Selection & Sowing', 50, ['plant-lore'],
    'Agriculture — crop fields can be laid out and sown.',
    'Keep the best seed. Plant it. Wait. You just invented staying put.', true),
  N(2, 'farm', 'hoe-cultivation', '🧑‍🌾', 'Hoe Cultivation', 35, ['seed-selection', 'hafting'],
    'Farmers till faster with proper hoes.',
    'Scratch the dirt with a stick — professionally now.'),
  N(2, 'farm', 'grain-storage', '🧺', 'Grain Storage', 35, ['seed-selection'],
    'The granary — food stores keep longer. Mice apply within the hour.',
    'Tomorrow exists now, stacked in baskets. Everything worth stealing, under one convenient roof.'),
  N(2, 'farm', 'querns-threshing', '🥣', 'Querns & Threshing', 40, ['seed-selection'],
    'Flail and quern turn grain into flour.',
    'Beat the grain, crush the grain, breathe the dust. Bread is close.'),
  N(2, 'farm', 'herding', '🐑', 'Herding', 50, ['hunting'],
    'Sheep, goats and cattle in pastures — wool, milk, meat on legs.',
    'Walking wealth that feeds itself. The sheep barely noticed the arrangement.', true),
  N(2, 'farm', 'dairying', '🥛', 'Dairying', 35, ['herding'],
    'Milk from the herd — another food on the table.',
    'Steal breakfast from a lamb, daily. It forgives you, daily.'),
  N(2, 'food', 'net-fishing', '🕸️', 'Net Fishing', 40, ['fishing', 'cordage'],
    'Nets and traps — fishers haul far more.',
    'Why catch one fish when the string can catch forty while you nap?'),
  N(2, 'craft', 'pottery', '🏺', 'Pottery', 50, ['fire-making'],
    "The potter's craft — pots for cooking, storing and carrying.",
    'Mud, spun and burned, holds soup now. Civilization smells like wet clay.', true),
  N(2, 'craft', 'spinning', '🧵', 'Spinning', 40, ['cordage'],
    'Fibre spun to thread — the start of every fabric.',
    'Twist fluff into thread until your thumbs learn the trick. Everything wearable begins here.'),
  N(2, 'craft', 'loom-weaving', '🧶', 'Loom Weaving', 45, ['spinning'],
    'The loom — cloth from linen and, later, wool.',
    'Thread crossed with thread, ten thousand times. Patience, renamed clothing.'),
  N(2, 'craft', 'tanning', '🪣', 'Tanning', 45, ['hide-working'],
    'The tannery turns raw hides into durable leather.',
    'Soak skins in bark juice until they stop rotting. The smell is the tuition.', true),
  N(2, 'craft', 'polished-stone', '🪓', 'Polished Stone Tools', 40, ['knapping'],
    'Ground stone axes — woodcutters fell real trees.',
    'Grind the axe smooth and whole forests become furniture-in-waiting.'),
  N(2, 'build', 'log-building', '🏠', 'Log Building', 50, ['polished-stone'],
    'Log houses — real homes with hearths.',
    'Stack the trees you murdered into a box that keeps you warm. Poetic.'),
  N(2, 'build', 'thatching', '🏚️', 'Thatching', 35, ['seed-selection'],
    'Straw cut and bundled — warm roofs, and straw for building.',
    "The field's leftovers keep the rain out. Waste not; leak not."),
  N(2, 'build', 'wells', '⛲', 'Wells', 40, ['log-building'],
    'Wells — water without walking to the river.',
    'Dig until the ground weeps. Now the river comes to you.'),
  N(2, 'build', 'palisades', '🚧', 'Palisades', 45, ['log-building'],
    'Wooden walls and gates around the village.',
    "Sharpened logs, pointed outward. A fence that answers a question nobody asked politely."),
  N(2, 'know', 'calendar', '📅', 'The Calendar', 40, ['sky-lore'],
    'Season markers — days counted, harvests forewarned.',
    'Notch the solstice. Time is now a grid you argue with.'),
  N(2, 'know', 'arithmetic', '🧮', 'Arithmetic', 45, ['tally-marks'],
    'Sums for herds and harvests — ledgers and fair shares.',
    'Add the sheep. Subtract the eaten ones. Weep at the remainder.'),
  N(2, 'civ', 'the-village', '🏘️', 'The Village', 55, ['seed-selection', 'the-band'],
    'Permanent settlement — families, homes, neighbors, disputes.',
    'You fenced the grass and named it home. The tamed animal is you.', true),
  N(2, 'med', 'herb-gardens', '🌼', 'Herb Gardens', 40, ['herbal-remedies'],
    'Herbs grown at the hut — steady medicine.',
    "Grow the leaf instead of finding it. Your aunt's confidence rises measurably."),

  // ------------------------------------------------------------- T3 · Civilization!
  N(3, 'metal', 'prospecting', '🔍', 'Prospecting', 60, ['polished-stone'],
    'Ore recognized — copper, tin and iron deposits show on the map.',
    'The pretty green rocks are more than pretty. The mountains have been hiding things.'),
  N(3, 'metal', 'charcoal-burning', '⚫', 'Charcoal Burning', 65, ['fire-making', 'polished-stone'],
    'Charcoal kilns — the fuel of every furnace.',
    'Burn the forest slowly to burn other things fast. The trees call it betrayal.'),
  N(3, 'metal', 'copper-smelting', '🔶', 'Copper Smelting', 80, ['prospecting', 'charcoal-burning', 'kiln-firing'],
    'Mines and the smelter — rock becomes metal.',
    'Cook the mountain until it bleeds. First metal on demand; first industrial secret.', true),
  N(3, 'metal', 'bronze-working', '🥉', 'Bronze Working', 90, ['copper-smelting'],
    'Bronze bars and bronze tools.',
    'Copper plus tin: the first recipe with an arms race in it.', true),
  N(3, 'craft', 'kiln-firing', '♨️', 'Kiln Firing', 65, ['pottery'],
    'Closed kilns — stronger ware, hotter fires.',
    'Trap the fire in a clay box and it learns discipline. Every furnace descends from this.'),
  N(3, 'craft', 'brickmaking', '🧱', 'Brickmaking', 75, ['kiln-firing'],
    'Brick ovens — bricks and roof tiles.',
    "Mud, standardized. Houses your grandchildren's grandchildren will still be arguing over.", true),
  N(3, 'craft', 'leatherworking', '👞', 'Leatherworking', 60, ['tanning'],
    "The cobbler's goods — shoes, belts, bags.",
    'Shoes. Your feet file a formal thank-you after two hundred thousand barefoot years.'),
  N(3, 'craft', 'wool-cloth', '🐏', 'Wool Cloth', 70, ['loom-weaving', 'herding'],
    'Wool fabric — warm clothes for northern winters.',
    'Wear the sheep. Unlike the deer, it survives the donation — and resents nothing.'),
  N(3, 'food', 'baking', '🍞', 'Baking', 70, ['querns-threshing', 'kiln-firing'],
    'The bakery — flour becomes bread.',
    "Crushed grass seeds, wet, burned. Somehow the best thing you've ever made."),
  N(3, 'farm', 'ox-and-plow', '🐂', 'Oxen & the Ard Plow', 85, ['herding'],
    'Oxen yoked to the ard — fields at scale.',
    'Convince a ton of beef to drag a stick. Farming stops being gardening.', true),
  N(3, 'mach', 'wheel-and-cart', '🛞', 'The Wheel & Cart', 90, ['ox-and-plow'],
    'Carts — bulk hauling; the wheel changes everything with an axle.',
    'A circle, with commitment. Everything that ever rolls starts rolling here.', true),
  N(3, 'build', 'mortared-masonry', '🏗️', 'Mortared Masonry', 75, ['brickmaking'],
    'Lime mortar — stone houses and lasting walls.',
    'Burned limestone glues rocks forever. Permanence, at last, and its maintenance costs.'),
  N(3, 'build', 'carpentry', '🪚', 'Carpentry & Joinery', 80, ['polished-stone', 'bronze-working'],
    'Joinery — bigger buildings, workshop refits.',
    'Wood joined without hope as the fastener. The pegs actually hold.'),
  N(3, 'know', 'writing', '📜', 'Writing', 95, ['arithmetic'],
    'Marks that remember — records, laws and schooling become possible.',
    'Scratches in wet clay that outlive the scratcher. Memory, jailbroken.', true),
  N(3, 'know', 'formal-schooling', '🏫', 'Formal Schooling', 80, ['writing'],
    'The school — children taught; what villagers learn by doing multiplies.',
    'Sit the children down and pour the tribe into them. They wiggle, but it sticks.'),
  N(3, 'know', 'weights-measures', '⚖️', 'Weights & Measures', 65, ['arithmetic'],
    'Standard measures — honest markets, better barter.',
    'A fair scale, so everyone can be cheated by exactly the same amount.'),
  N(3, 'war', 'bronze-weapons', '⚔️', 'Bronze Weapons', 85, ['bronze-working'],
    'The weaponsmith casts bronze arms.',
    'The first thing you poured when the bronze cooled. Not a sickle. History noticed.', true),
  N(3, 'war', 'ramparts', '🗼', 'Ramparts & Watchtowers', 75, ['palisades'],
    'Gatehouses and watchtowers — earlier warning, stronger gates.',
    "Higher walls, against neighbors who climb. Wolves, for the record, don't."),
  N(3, 'civ', 'passing-merchants', '🧳', 'Passing Merchants', 90, ['weights-measures'],
    'Unknown merchants begin visiting the town to barter.',
    'Strangers with sacks and arithmetic. They know your prices better than you do.', true),
  N(3, 'civ', 'organized-cult', '🕯️', 'The Shrine', 70, ['the-village'],
    'The shrine — festivals, comfort, a calendar of duties.',
    'Someone explains the thunder for a fee of grain. The grain keeps the explanations coming.'),
  N(3, 'med', 'suturing-cautery', '🪡', 'Suturing & Cautery', 70, ['wound-care', 'bronze-working'],
    'Wounds closed by needle and iron — raid casualties survive.',
    'Sew the warrior shut or burn him closed. He thanks you later. Later.'),

  // ------------------------------------------------------------- T4 · Iron Age, Golden Price
  N(4, 'metal', 'iron-bloomery', '⛏️', 'Iron Bloomery', 120, ['bronze-working'],
    'Iron smelting — ore that lies everywhere becomes metal for everyone.',
    'Uglier than bronze, cheaper than bronze, everywhere. Democracy, but for sharp edges.', true),
  N(4, 'metal', 'smithing', '🛠️', 'Smithing & Forging', 110, ['iron-bloomery'],
    'The smithy — iron tools, fittings, horseshoes, hinges.',
    'The village anvil: where iron learns its trades and neighbors learn the noise.'),
  N(4, 'metal', 'quenching-tempering', '🫗', 'Quenching & Tempering', 115, ['smithing'],
    'Steel edges — tools and blades that stay sharp.',
    'Plunge hot iron in water at the exact right moment. Wrong moment: expensive gravel.'),
  N(4, 'civ', 'coinage', '🪙', 'Coinage', 150, ['weights-measures', 'iron-bloomery'],
    'Money. Prices replace barter; gold enters the ledgers.',
    "Wealth that doesn't rot, moo, or end. The first bottomless appetite — yours.", true),
  N(4, 'civ', 'trade-caravans', '🐫', 'Trade Caravans', 130, ['wheel-and-cart', 'passing-merchants'],
    'The trading post — your own caravans go out to deal.',
    'Now you take the sacks to the strangers. The road eats a margin; greed pays the toll.'),
  N(4, 'civ', 'diplomacy', '🤝', 'Diplomacy', 140, ['writing', 'trade-caravans'],
    'The tribes have names now — envoys, gifts, relations, treaties.',
    'The neighbors were always there. Now you exchange compliments before the stabbing.'),
  N(4, 'civ', 'law-codes', '📋', 'Law Codes', 120, ['writing'],
    'Written law — order, fewer quarrels, happier queues.',
    'The rules, carved where everyone can see them. Ignorance loses its charm as a defense.'),
  N(4, 'know', 'alphabet', '🔤', 'The Alphabet', 110, ['writing'],
    'Thirty signs anyone can learn — literacy spreads, knowledge accelerates.',
    'Writing escapes the scribes. Now anyone can misspell anything.', true),
  N(4, 'know', 'philosophy', '🧔', 'Philosophy', 135, ['alphabet'],
    'Aristo declares you a rational animal — wisdom, and its audit, begin.',
    'A bearded optimist calls you rational. The rest of the game is the fact-check.'),
  N(4, 'farm', 'two-field-rotation', '🔁', 'Two-Field Rotation', 115, ['ox-and-plow'],
    'Half planted, half rested — fields yield more.',
    'Let the dirt nap in shifts. The dirt, unlike you, is grateful.'),
  N(4, 'farm', 'scythe', '🌙', 'The Scythe', 105, ['smithing'],
    'The long blade — faster harvests, hay possible.',
    "Death's favorite tool, borrowed for grass. He wants it back eventually."),
  N(4, 'food', 'salt-preserves', '🧂', 'Salt & Preserves', 110, ['smoking-drying'],
    'Salt won and packed — food that keeps for seasons.',
    'White sand that stops time inside a fish. Worth wars, apparently.'),
  N(4, 'build', 'the-arch', '🌉', 'The Arch', 120, ['mortared-masonry'],
    'The arch — stone spans, great gates, bigger buildings.',
    'Stones leaning on each other so hard they refuse to fall. Committee architecture that works.'),
  N(4, 'build', 'paved-roads', '🛣️', 'Paved Roads', 125, ['the-arch'],
    'Paved roads — all-weather speed for feet, carts and armies.',
    'Flat stones, all the way there. Mud files an appeal every spring; the road wins.', true),
  N(4, 'mach', 'watermill', '🌊', 'The Watermill', 150, ['wheel-and-cart', 'carpentry'],
    'The watermill — the river grinds your flour.',
    'The river works the night shift now, unpaid, uncomplaining. Your first employee without a stomach.', true),
  N(4, 'war', 'iron-weapons', '🗡️', 'Iron Weapons', 130, ['smithing'],
    'Iron arms for everyone — armies grow.',
    'Every farmhand can afford a blade now. Sleep accordingly.', true),
  N(4, 'war', 'mail-armor', '⛓️', 'Mail Armor', 125, ['smithing'],
    'Iron cloth — soldiers shrug off blows.',
    'A shirt of ten thousand rings. Heavy, expensive, and extremely convincing.'),
  N(4, 'war', 'stone-walls', '🗿', 'Stone Walls', 135, ['ramparts', 'mortared-masonry'],
    'Stone walls and gates — the town becomes a hard target.',
    'Measure the fear in them honestly: built against neighbors, not wolves.'),
  N(4, 'med', 'physician', '⚕️', 'The Physician', 115, ['suturing-cautery', 'philosophy'],
    'Physicians — illness diagnosed, treated, recorded.',
    'He has read Galen, he has theories about your fluids, and he means well. Survive him.'),
  N(4, 'med', 'sanitation', '🚰', 'Sanitation', 120, ['wells', 'the-arch'],
    'Drains and clean water — sickness visits less often.',
    'Put the waste downhill from the well, not up. Genius takes surprising forms.'),

  // ------------------------------------------------------------- T5 · Shepherds & Sheep
  N(5, 'civ', 'feudal-manor', '🏤', 'The Manor', 240, ['law-codes', 'coinage'],
    "THE MANOR — a lord's seat; the village becomes a holding.",
    "A big house on the hill, and suddenly everyone else's house owes it something.", true),
  N(5, 'civ', 'taxation', '💰', 'Taxation', 220, ['feudal-manor'],
    'Taxes — the population pays gold into your coffers.',
    "Their harvest, your cut, everyone's tradition. Collected with a smile and a ledger.", true),
  N(5, 'civ', 'guilds', '🏪', 'Guilds & Charters', 200, ['coinage', 'carpentry'],
    'Guilds and town charters — craftsmen organize, quality rises.',
    'The craftsmen unionize, set prices, and gatekeep apprentices. Progress, with membership fees.'),
  N(5, 'civ', 'banking', '🏦', 'Banking', 210, ['coinage'],
    'Moneylenders — coin breeds coin; trade income grows.',
    'Money that makes money while sitting still. The squirrel could never.'),
  N(5, 'farm', 'three-field-rotation', '🔄', 'Three-Field Rotation', 220, ['two-field-rotation'],
    'Three fields in rotation — half again more land in use.',
    'Spring crop, winter crop, nap. The dirt accepts the new shift schedule.', true),
  N(5, 'farm', 'heavy-plow', '🏋️', 'The Heavy Plow', 230, ['iron-bloomery', 'ox-and-plow'],
    'The moldboard plow — the wet northern clays finally submit.',
    'Iron shoulders through soil that broke every wooden stick. The north becomes a breadbasket.', true),
  N(5, 'farm', 'hay-making', '🍂', 'Hay Making', 180, ['scythe', 'herding'],
    'Hay stored — herds survive the winter indoors.',
    'Cut summer, dry it, feed it to February. The cows applaud with their survival.'),
  N(5, 'mach', 'horse-power', '🐎', 'Horse Collar & Shoe', 200, ['wheel-and-cart', 'herding'],
    'Horses in collar and shoe — faster plowing, faster hauling, cavalry possible.',
    'The collar stops choking the horse; the horse forgives you and doubles your speed.'),
  N(5, 'mach', 'windmill', '🌬️', 'The Windmill', 230, ['watermill'],
    'Windmills — power wherever the wind bothers to blow.',
    "You've harnessed the sky's bad mood. It grinds flour now.", true),
  N(5, 'metal', 'blast-furnace', '🌋', 'The Blast Furnace', 250, ['iron-bloomery', 'watermill'],
    'The blast furnace — molten iron by the ton; iron gets cheap.',
    'A furnace so hungry the river pumps its bellows. Iron becomes as common as complaints.', true),
  N(5, 'craft', 'spinning-wheel', '🌀', 'The Spinning Wheel', 190, ['spinning'],
    'The spinning wheel — thread five times faster; cloth for everyone.',
    'Five times the thread, same thumbs. The sheep can barely keep up.'),
  N(5, 'mach', 'mechanical-clock', '🕰️', 'The Mechanical Clock', 240, ['quenching-tempering'],
    'The town clock — the day divided; work runs on the hour.',
    'A machine that chops the day into pieces and sells you the schedule. Tick.', true),
  N(5, 'know', 'paper', '📄', 'Paper', 210, ['alphabet', 'watermill'],
    'Paper mills — records get cheap; knowledge accelerates.',
    'Rags, pulped and pressed. Cheap enough to write down even your bad ideas.', true),
  N(5, 'know', 'universities', '🎓', 'Universities', 230, ['formal-schooling', 'paper'],
    'Universities — scholars multiply what every worker learns.',
    'Professional thinkers, licensed to argue. Some of it even helps.'),
  N(5, 'war', 'men-at-arms', '💂', 'Men-at-Arms', 220, ['feudal-manor', 'iron-weapons'],
    'Full-time soldiers — recruited, trained, armed and paid.',
    "Farming's over for these lads. Their only crop is you-know-what, and it's always harvest season.", true),
  N(5, 'war', 'crossbow', '🏹', 'The Crossbow', 200, ['carpentry', 'smithing'],
    'Crossbows — a week of training, armor-piercing results.',
    'Machine archery. Skill, mass-produced and sold by the dozen.'),
  N(5, 'war', 'knighthood', '🐴', 'Knighthood', 240, ['horse-power', 'mail-armor'],
    'Knights — stirrup, lance and plate; shock cavalry rules the field.',
    'A man, a horse, and a metal suit worth a village. The village paid for it, naturally.'),
  N(5, 'war', 'gunpowder', '🧨', 'Gunpowder', 260, ['universities'],
    "Black powder — alchemy's loudest accident; guns come next era.",
    'The alchemists sought eternal life and found the opposite. Sales are excellent.', true),
  N(5, 'med', 'hospitals', '🏥', 'Hospitals', 190, ['physician', 'organized-cult'],
    'Hospitals — the sick tended in numbers.',
    "A building for the ailing, run on prayer and soup. Both help; one's measurable."),
  N(5, 'med', 'quarantine', '🚪', 'Quarantine', 210, ['hospitals'],
    'Quarantine — plagues held at the gates for forty days.',
    'Lock the door for forty days and let the plague starve outside it. Rude. Effective.', true),

  // ------------------------------------------------------------- T6 · The Kindling
  N(6, 'build', 'castle', '🏰', 'The Castle', 400, ['feudal-manor', 'the-arch'],
    'The manor becomes a CASTLE — keep, curtain wall, moat.',
    "The biggest stones, stacked highest. History's last unbeatable argument — briefly.", true),
  N(6, 'war', 'cannon', '💣', 'Cannon', 380, ['gunpowder', 'blast-furnace'],
    'Cannon — walls stop being facts and start being suggestions.',
    'It does not vote. It subtracts.', true),
  N(6, 'war', 'star-fortification', '✴️', 'Star Fortification', 360, ['cannon', 'stone-walls'],
    'Star forts — low, thick, angled; the town answers the cannon.',
    'Geometry versus gunpowder. The walls duck.'),
  N(6, 'war', 'musketry', '🔫', 'Musketry', 340, ['gunpowder'],
    'Muskets — soldiers of the new age.',
    "Point the loud stick. Anyone can learn it in a week; that's precisely the horror."),
  N(6, 'war', 'volley-drill', '🥁', 'Volley Fire & Drill', 320, ['musketry'],
    'Drilled ranks and volley fire — armies become machines.',
    'March, kneel, fire, repeat. War, choreographed to a drumbeat.'),
  N(6, 'know', 'printing-press', '🖨️', 'The Printing Press', 420, ['paper', 'mechanical-clock'],
    'The press — knowledge duplicated faster than it can be burned.',
    'A thousand copies before the ink of the ban is dry. The spark, made contagious.', true),
  N(6, 'know', 'pamphlets', '🗞️', 'Pamphlets & News', 300, ['printing-press'],
    'Cheap print — news, ideas and complaints travel at press speed.',
    "Everyone's opinion, everywhere, daily. You were warned."),
  N(6, 'craft', 'glassworks', '🫙', 'Glassworks', 320, ['kiln-firing'],
    'Glassworks — clear glass, windows, lenses.',
    'Melted sand you can see through. Your house gets eyes; your scholars get spectacles.'),
  N(6, 'know', 'telescope', '🔭', 'The Telescope', 360, ['glassworks', 'mechanical-clock'],
    'The telescope — the heavens examined; watchmen see raiders sooner.',
    "Point the glass tube at Jupiter. It's keeping moons. Heaven files no comment.", true),
  N(6, 'know', 'heliocentrism', '☀️', 'Heliocentrism', 340, ['telescope'],
    'The sky rearranged — the Earth moves; certain robes disapprove.',
    'You are not the center of the universe. Take it as practice.'),
  N(6, 'med', 'anatomy', '💀', 'Anatomy', 340, ['universities'],
    'Anatomy — the body actually looked at; medicine leaps.',
    "Open the book of you. Galen was guessing; the corpse isn't.", true),
  N(6, 'know', 'scientific-method', '⚗️', 'The Scientific Method', 420, ['heliocentrism', 'anatomy'],
    "THE METHOD — a machine for making more knowledge. The settlement game's final page.",
    "Measure, doubt, repeat. You've invented the tool that invents the rest.", true),
  N(6, 'civ', 'centralized-state', '👑', 'The Centralized State', 380, ['taxation', 'printing-press'],
    "The crown's bureaucracy — taxes flow, lords kneel, the state stands.",
    'The pyramid gets a single tip. Grow, kneel, or become a lesson.'),
  N(6, 'civ', 'bookkeeping', '📚', 'Double-Entry Books', 310, ['banking', 'paper'],
    'Double-entry books — trade and taxes audited to the last coin.',
    'Every coin gets two lines and no excuses. Fraud sheds a professional tear.'),
  N(6, 'farm', 'new-world-crops', '🥔', 'New World Crops', 330, ['trade-caravans'],
    "Potatoes and maize arrive from a world you didn't know existed.",
    'A lumpy miracle from across the ocean. The frost hates it; plant accordingly.'),
  N(6, 'civ', 'renaissance-arts', '🎨', 'Renaissance Arts', 300, ['pamphlets'],
    'Perspective, paint and marble — beauty; the town stands taller.',
    'The animal caught itself in a mirror and found the view interesting.'),
];

export const techNodeById = new Map(TECH_NODES.map((n) => [n.id, n]));

const STORE_KEY = 'ra-techtree-v1';

/**
 * Progression state for the new tree. Persisted separately from game saves
 * for now (localStorage) — merged into the save format in Phase C.
 */
export class TechTreeState {
  readonly researched = new Set<string>();

  constructor() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) for (const id of JSON.parse(raw) as string[]) {
        if (techNodeById.has(id)) this.researched.add(id);
      }
    } catch { /* fresh tree */ }
  }

  isResearched(id: string): boolean {
    return this.researched.has(id);
  }

  /** Lowest tier with unfinished techs = the current era (7 = tree complete). */
  currentTier(): number {
    for (let t = 0; t <= 6; t++) {
      if (TECH_NODES.some((n) => n.tier === t && !this.researched.has(n.id))) return t;
    }
    return 7;
  }

  tierProgress(tier: number): { done: number; total: number } {
    let done = 0;
    let total = 0;
    for (const n of TECH_NODES) {
      if (n.tier !== tier) continue;
      total++;
      if (this.researched.has(n.id)) done++;
    }
    return { done, total };
  }

  prereqsMet(id: string): boolean {
    const n = techNodeById.get(id);
    return !!n && n.prereqs.every((p) => this.researched.has(p));
  }

  /**
   * Dev completion "as if played": completing a node implies every tech of all
   * earlier tiers (era gate = ALL tier techs) plus its prerequisite chain
   * within its own tier. Returns the ids newly completed, in completion order.
   */
  completeAsPlayed(id: string): string[] {
    const target = techNodeById.get(id);
    if (!target || this.researched.has(id)) return [];
    const added: string[] = [];
    const take = (nid: string) => {
      if (!this.researched.has(nid)) {
        this.researched.add(nid);
        added.push(nid);
      }
    };
    for (const n of TECH_NODES) if (n.tier < target.tier) take(n.id);
    const chain = (nid: string) => {
      const n = techNodeById.get(nid);
      if (!n) return;
      for (const p of n.prereqs) if (!this.researched.has(p)) chain(p);
      take(nid);
    };
    chain(id);
    this.persist();
    return added;
  }

  reset(): void {
    this.researched.clear();
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...this.researched]));
    } catch { /* storage unavailable */ }
  }
}
