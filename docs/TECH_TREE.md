# The Playable Tech Tree (Roadmap v2, Phase B) — v1 DRAFT, pending owner review

> Created 2026-08-28. [SKILL_TREE.md](SKILL_TREE.md) (~330 nodes) pruned to **125 nodes** across
> **T0–T6** (owner target: 120–150). Source of truth for the data — ids, KP costs, prerequisites,
> effects, and the tone-rule flavor line of every node — is **`src/sim/techtree.ts`**; this document
> is the design record. Flavor texts are best reviewed **in-game**: 🌳 button → hover any tech.

## Rules this tree obeys (owner decisions, ROADMAP.md)

- **All techs of a tier must be completed** to advance to the next era (decision 3) — so every node
  is meant to matter; there are no optional/filler nodes.
- **Later tiers are locked** (visible but dimmed) until the current era completes (decision 12).
- KP comes **from villager actions** (decision 1); the school line (Formal Schooling → Universities)
  **multiplies** action-KP (decision 13). KP generation rates are Phase C balancing work.
- Era advance plays the chapter intro — same text & voice, era name in the header (decision 4).
- T7/T8/Epilogue appear at the tree's right edge as **locked plaques** — separate trees, designed
  later (decision 11).
- **Dev mode (owner request):** double-click any tech to complete it *as if played* — all earlier
  tiers and its in-tier prerequisite chain complete with it. Completing a tier triggers the era
  intro. Reset button forgets everything. State persists in localStorage (`ra-techtree-v1`),
  separate from saves until Phase C.

## Shape

10 branches (rows) × 7 tiers (columns): 🍖 Food · 🌾 Farm & Herd · 🧶 Crafts · ⛏️ Metals ·
🏠 Building · ⚙️ Machines · 📖 Knowledge · ⚕️ Medicine · ⚔️ War · 🏛️ Society.
Node counts per tier: **T0 8 · T1 20 · T2 20 · T3 21 · T4 20 · T5 20 · T6 16 = 125.**
KP cost bands per tier: T0 5–10 · T1 15–25 · T2 35–55 · T3 60–95 · T4 105–150 · T5 180–260 ·
T6 300–420. ⭐ marks era-defining gateway techs.

## T0 — Hello World! (8 nodes)

| Tech | Branch | KP | Needs | Effect |
|---|---|---|---|---|
| Foraging | Food | 5 | — | Foragers gather berries, roots, eggs |
| Scavenging | Food | 5 | — | A little meat from small game & carcasses |
| Fire Keeping | Food | 6 | — | Camp fire stays lit, burns gathered sticks |
| Stick Gathering | Crafts | 5 | — | Fallen branches — a slow wood trickle |
| Stone Picking | Crafts | 5 | — | Found stones as crude tools |
| Spoken Language | Knowledge | 8 | — | Workers can be assigned to jobs |
| The Band | Society | 8 | Spoken Language | Shared camp stockpile |
| Brush Shelters | Building | 10 | Stick Gathering | Windbreaks — a little warmth |

## T1 — Bloody Roots (20)

| Tech | Branch | KP | Needs | Effect |
|---|---|---|---|---|
| Plant Lore | Food | 15 | Foraging | Foragers find more; mushrooms & roots |
| Wooden Spear | War | 15 | Stick Gathering | Spears — hunters & defenders hit harder |
| Hunting | Food | 18 | Wooden Spear | Hunters stalk deer (meat + hides) |
| Fishing | Food | 18 | Cordage | Fishers work from a fishing hut |
| Trapping & Snares | Food | 18 | Cordage | Passive small game — hunter yield up |
| ⭐ Fire Making | Food | 25 | Fire Keeping | Fire on demand — hearths anywhere |
| Cooking | Food | 18 | Fire Making | Food nourishes more |
| Smoking & Drying | Food | 20 | Cooking | Food keeps through winter |
| ⭐ Stone Knapping | Crafts | 20 | Stone Picking | Stone tools craftable |
| Cordage | Crafts | 15 | Foraging | String & rope — prereq to half the world |
| Hafting | Crafts | 20 | Knapping, Cordage | Tools work faster |
| Hide Working | Crafts | 18 | Hunting | Hides become usable pelts |
| Sewn Clothing | Crafts | 22 | Hide Working | Fur clothes — cold endurance |
| Pit Houses | Building | 25 | Brush Shelters | First real shelter |
| Oral Tradition | Knowledge | 15 | Spoken Language | +KP rate |
| Tally Marks | Knowledge | 18 | Spoken Language | Exact store numbers |
| Sky Lore | Knowledge | 20 | Oral Tradition | Season forecasts |
| Herbal Remedies | Medicine | 20 | Plant Lore | Herbalist brews medicine |
| Wound Care | Medicine | 18 | Herbal Remedies | Faster recovery |
| The Warband | War | 22 | Wooden Spear, The Band | Adults defend the camp |

## T2 — Domesticated (20)

| Tech | Branch | KP | Needs | Effect |
|---|---|---|---|---|
| ⭐ Seed Selection & Sowing | Farm | 50 | Plant Lore | Crop fields |
| Hoe Cultivation | Farm | 35 | Seed Selection, Hafting | Farmers till faster |
| Grain Storage | Farm | 35 | Seed Selection | Granary — food keeps longer |
| Querns & Threshing | Farm | 40 | Seed Selection | Grain → flour |
| ⭐ Herding | Farm | 50 | Hunting | Sheep/goats/cattle in pastures |
| Dairying | Farm | 35 | Herding | Milk |
| Net Fishing | Food | 40 | Fishing, Cordage | Fishers haul far more |
| ⭐ Pottery | Crafts | 50 | Fire Making | Pots — cooking & storage |
| Spinning | Crafts | 40 | Cordage | Thread |
| Loom Weaving | Crafts | 45 | Spinning | Cloth |
| ⭐ Tanning | Crafts | 45 | Hide Working | Tannery — leather |
| Polished Stone Tools | Crafts | 40 | Knapping | Real tree-felling axes |
| Log Building | Building | 50 | Polished Stone | Log houses |
| Thatching | Building | 35 | Seed Selection | Straw roofs, straw cutter |
| Wells | Building | 40 | Log Building | Water off the riverbank |
| Palisades | Building | 45 | Log Building | Wooden walls & gates |
| The Calendar | Knowledge | 40 | Sky Lore | Day counter, harvest warnings |
| Arithmetic | Knowledge | 45 | Tally Marks | Ledgers, fair shares |
| ⭐ The Village | Society | 55 | Seed Selection, The Band | Families, homes, neighbors |
| Herb Gardens | Medicine | 40 | Herbal Remedies | Steady medicine |

## T3 — Civilization! (21)

| Tech | Branch | KP | Needs | Effect |
|---|---|---|---|---|
| Prospecting | Metals | 60 | Polished Stone | Ore deposits revealed |
| Charcoal Burning | Metals | 65 | Fire Making, Polished Stone | Furnace fuel |
| ⭐ Copper Smelting | Metals | 80 | Prospecting, Charcoal, Kiln Firing | Mines + smelter |
| ⭐ Bronze Working | Metals | 90 | Copper Smelting | Bronze bars & tools |
| Kiln Firing | Crafts | 65 | Pottery | Hot closed kilns |
| ⭐ Brickmaking | Crafts | 75 | Kiln Firing | Bricks & roof tiles |
| Leatherworking | Crafts | 60 | Tanning | Cobbler — shoes, bags |
| Wool Cloth | Crafts | 70 | Loom Weaving, Herding | Warm wool clothing |
| Baking | Food | 70 | Querns, Kiln Firing | Bakery — bread |
| ⭐ Oxen & the Ard Plow | Farm | 85 | Herding | Fields at scale |
| ⭐ The Wheel & Cart | Machines | 90 | Oxen & Plow | Bulk hauling |
| Mortared Masonry | Building | 75 | Brickmaking | Stone houses & walls |
| Carpentry & Joinery | Building | 80 | Polished Stone, Bronze | Bigger buildings, refits |
| ⭐ Writing | Knowledge | 95 | Arithmetic | Records, laws, schools possible |
| Formal Schooling | Knowledge | 80 | Writing | School — action-KP multiplier |
| Weights & Measures | Knowledge | 65 | Arithmetic | Better barter rates |
| ⭐ Bronze Weapons | War | 85 | Bronze Working | Weaponsmith |
| Ramparts & Watchtowers | War | 75 | Palisades | Warning & stronger gates |
| ⭐ Passing Merchants | Society | 90 | Weights & Measures | **Unknown merchants visit (T3 mechanic)** |
| The Shrine | Society | 70 | The Village | Festivals, comfort |
| Suturing & Cautery | Medicine | 70 | Wound Care, Bronze | Raid casualties survive |

## T4 — Iron Age, Golden Price (20)

| Tech | Branch | KP | Needs | Effect |
|---|---|---|---|---|
| ⭐ Iron Bloomery | Metals | 120 | Bronze Working | Iron for everyone |
| Smithing & Forging | Metals | 110 | Iron Bloomery | Smithy — iron tools & hardware |
| Quenching & Tempering | Metals | 115 | Smithing | Steel edges |
| ⭐ Coinage | Society | 150 | Weights & Measures, Iron | **Money — gold & prices (T4 mechanic)** |
| Trade Caravans | Society | 130 | Wheel & Cart, Passing Merchants | Trading post + own caravans |
| Diplomacy | Society | 140 | Writing, Trade Caravans | **Tribes revealed — relations (T4 mechanic)** |
| Law Codes | Society | 120 | Writing | Order & happiness |
| ⭐ The Alphabet | Knowledge | 110 | Writing | Literacy spreads — KP up |
| Philosophy | Knowledge | 135 | Alphabet | Aristo's audit begins |
| Two-Field Rotation | Farm | 115 | Oxen & Plow | Yield up |
| The Scythe | Farm | 105 | Smithing | Faster harvest, hay possible |
| Salt & Preserves | Food | 110 | Smoking & Drying | Long food storage |
| The Arch | Building | 120 | Mortared Masonry | Spans, gates, big buildings |
| ⭐ Paved Roads | Building | 125 | The Arch | All-weather roads |
| ⭐ The Watermill | Machines | 150 | Wheel & Cart, Carpentry | River-powered mill |
| ⭐ Iron Weapons | War | 130 | Smithing | Armies grow |
| Mail Armor | War | 125 | Smithing | Soldier armor tier |
| Stone Walls | War | 135 | Ramparts, Masonry | Hard target town |
| The Physician | Medicine | 115 | Suturing, Philosophy | Illness treated properly |
| Sanitation | Medicine | 120 | Wells, The Arch | Less sickness |

## T5 — Shepherds & Sheep (20)

| Tech | Branch | KP | Needs | Effect |
|---|---|---|---|---|
| ⭐ The Manor | Society | 240 | Law Codes, Coinage | **THE MANOR (T5 mechanic)** |
| ⭐ Taxation | Society | 220 | The Manor | **Gold income from the population (T5)** |
| Guilds & Charters | Society | 200 | Coinage, Carpentry | Crafter productivity |
| Banking | Society | 210 | Coinage | Trade income grows |
| ⭐ Three-Field Rotation | Farm | 220 | Two-Field | +50% land in use |
| ⭐ The Heavy Plow | Farm | 230 | Iron, Oxen & Plow | Northern clays farmable |
| Hay Making | Farm | 180 | Scythe, Herding | Herds survive winter |
| Horse Collar & Shoe | Machines | 200 | Wheel & Cart, Herding | Horses — speed everywhere |
| ⭐ The Windmill | Machines | 230 | Watermill | Power without rivers |
| ⭐ The Blast Furnace | Metals | 250 | Iron, Watermill | Iron gets cheap |
| The Spinning Wheel | Crafts | 190 | Spinning | Cloth for everyone |
| ⭐ The Mechanical Clock | Machines | 240 | Quenching & Tempering | Productivity by the hour |
| ⭐ Paper | Knowledge | 210 | Alphabet, Watermill | Cheap records — KP up |
| Universities | Knowledge | 230 | Formal Schooling, Paper | Bigger KP multiplier |
| ⭐ Men-at-Arms | War | 220 | The Manor, Iron Weapons | **Full-time soldiers (T5 mechanic)** |
| The Crossbow | War | 200 | Carpentry, Smithing | Armor-piercing ranged |
| Knighthood | War | 240 | Horse Collar, Mail Armor | Shock cavalry |
| ⭐ Gunpowder | War | 260 | Universities | Guns next era |
| Hospitals | Medicine | 190 | Physician, The Shrine | Sick tended at scale |
| ⭐ Quarantine | Medicine | 210 | Hospitals | Plagues contained |

## T6 — The Kindling (16)

| Tech | Branch | KP | Needs | Effect |
|---|---|---|---|---|
| ⭐ The Castle | Building | 400 | The Manor, The Arch | **Manor → CASTLE (T6 mechanic)** |
| ⭐ Cannon | War | 380 | Gunpowder, Blast Furnace | Walls become suggestions |
| Star Fortification | War | 360 | Cannon, Stone Walls | **Fortify the town (T6 mechanic)** |
| Musketry | War | 340 | Gunpowder | Advanced soldiers |
| Volley Fire & Drill | War | 320 | Musketry | Armies as machines |
| ⭐ The Printing Press | Knowledge | 420 | Paper, Mechanical Clock | KP way up |
| Pamphlets & News | Knowledge | 300 | Printing Press | Ideas travel |
| Glassworks | Crafts | 320 | Kiln Firing | Windows & lenses |
| ⭐ The Telescope | Knowledge | 360 | Glassworks, Clock | See raiders & moons sooner |
| Heliocentrism | Knowledge | 340 | Telescope | The sky rearranged |
| ⭐ Anatomy | Medicine | 340 | Universities | Medicine leaps |
| ⭐ The Scientific Method | Knowledge | 420 | Heliocentrism, Anatomy | **The tree's final page** |
| The Centralized State | Society | 380 | Taxation, Printing Press | The door to T7 |
| Double-Entry Books | Society | 310 | Banking, Paper | Audited income |
| New World Crops | Farm | 330 | Trade Caravans | Potatoes & maize |
| Renaissance Arts | Society | 300 | Pamphlets | Beauty & happiness |

## Open (for the owner's review of this draft)

1. **Node picks**: strike/move/add anything — every change is one entry in `TECH_NODES`.
2. **KP costs** are first-guess placeholders; real balancing happens in Phase C when action-KP rates exist.
3. **The existing 15-tech system** (`src/sim/techs.ts`, 📖 window) still drives current gameplay; it
   retires in Phase C when unlock wiring moves to this tree.
4. Tech **images**: hover cards use the node's emoji large, as placeholder art (decision-1 popups
   want images — real art later, same slot).
