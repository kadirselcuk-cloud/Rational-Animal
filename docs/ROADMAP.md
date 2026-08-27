# Roadmap (DRAFT — for discussion, not approved)

A proposal based on the decisions recorded in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). Each phase ends with something playable/testable in the browser. Reorder, merge, or cut — nothing starts until the owner approves.

## Phase 0 — Foundation
Project scaffold: Vite + TypeScript + three.js. RTS orbit camera (pan/zoom/rotate). Fixed-timestep sim loop decoupled from rendering, with pause/1×/2×/4×. Instanced-rendering groundwork (the 500+ villager target means instancing and LOD are baked in from the first mesh).
**Playable result:** fly the camera over a flat test grid at 60 fps.

## Phase 1 — World Generation
Random tile-grid map: elevation, river(s), lake, forests, straw fields near rivers, mountains with stone/ore areas, clay near water, fertile soil bands. Mid-northern biome look (procedural low-poly pines, birches, oaks, rocks, grass). Map seed input; minimap.
**Playable result:** generate and explore endless varied maps.

## Phase 2 — Villagers & Work
Villagers as individuals (name, age, sex, needs: hunger/warmth/health/happiness). Profession assignment UI ("5 woodcutters") — workers claim jobs automatically. A* pathfinding on the grid with crowd-scale optimizations. First production chains: woodcutter, stone gatherer, forager, firewood, stockpile, hauling. Low-poly villager models with instanced animation.
**Playable result:** assign workers, watch them chop/haul/store autonomously.

## Phase 3 — Survival
Four seasons with visual change (snow shaders, bare trees). Winter pressure: firewood consumption, no growth, cold damage. Food consumption, starvation, freezing, death, burial. Houses (shelter → wooden hut) with warmth radius. Health & happiness effects. Families, births, children growing into workers, aging. Colony-collapse fail state.
**Playable result:** the core survival loop — make it through winters or die.

## Phase 4 — Primitive Economy (🪵 era complete)
Hunter (game animals roaming the map), fisher, trapper, herbalist + medicine, gatherer. Tools: wooden/stone tiers affecting work speed; toolmaker. Fibre → string; basic clothing from pelts. Storage buildings (shed, firewood shed) with capacity and spoilage.
**Playable result:** a self-sustaining primitive village with ~10 production chains.

## Phase 5 — Settled Era (🏺) + Knowledge
School + knowledge points + visible tech tree (the civilization-development spine). Farming: fields, vegetable gardens, orchards, crop seasons. Livestock: chickens, pigs, sheep, cattle; pasture, barn, winter feed. Clay pit, brick oven (brick/tiles), pottery, well, cistern. Food processing: mill, bakery, smokehouse, dairy, tavern. Weaver/tailor: linen, wool, winter clothing. Housing upgrades to log/timber houses.
**Playable result:** village → town with education-driven progression.

## Phase 6 — Tribes: Trade & Diplomacy
Four tribes at map edges with distinct personalities and growing settlements (simplified off-map simulation + visible edge camps). Relations system that remembers your actions. Trading post + player caravans with travel time; barter ratios driven by relations and tribe needs. Tribe demands, gifts, envoys.
**Playable result:** a living political map you can profit from.

## Phase 7 — Bronze, Iron & War
Mines (copper/tin/iron/coal), smelter, charcoal burner; bronze then iron tool tiers. Weaponsmith/armorsmith/fletcher; weapon/armor/shield tiers. Militia & soldiers, training ground, barracks, armory, equipment system. Defense: palisades, gates, towers; live raid defense on your map (group command). Offense: send-army-and-auto-resolve attacks on tribes; subjugation/destruction outcomes. War affects trade (raided caravans).
**Playable result:** the full war/trade/survival sandbox.

## Phase 8 — Depth & Polish
Remaining catalog breadth (brewery, apiary, chandler, glassworks, jewelry…). Disasters (fire, disease, wolves, brutal winters). Milestones, statistics, chronicle of colony history. Save/load (IndexedDB, multiple slots). Audio, UI polish, performance passes, difficulty settings.

---

**Discussion points for the owner:**
1. Is this phase order right? (e.g. tribes before metal, so trade can bootstrap bronze?)
2. Should trade (Phase 6) come *before* the settled era completes, so early trading matters?
3. Anything here you'd cut from v1 entirely?
