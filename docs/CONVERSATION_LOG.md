# Conversation Log

Chronological record of design sessions, so any new console/session can catch up quickly. Newest entries at the bottom.

---

## Session 1 — 2026-08-19

**What happened:**
- Owner described the game: strategy survival browser game in three.js; harsh mid-northern setting (Germany/Romania/Ukraine latitude); randomly generated map; tribes on all 4 sides (war or trade); indirect worker assignment; civilization-development progression (wood/stone → bronze → iron); low-poly semi-realistic art built entirely by Claude in code.
- Owner defined 9 seed resources (Wood, Stone, Straw, Iron, Firewood, Clay, Brick, Brick Tiles, Fibre) with the efficient-source / inefficient-fallback pattern, and asked Claude to generate the rest of the resource catalog for review — "I want many."
- Owner asked for all building types (stockpiles, warehouses, water storage, pottery, woodcutter, blacksmith, school, herbalist, hunter, etc.).
- Claude created: [GAME_VISION.md](GAME_VISION.md), [RESOURCES.md](RESOURCES.md) (draft catalog, ~90 items), [BUILDINGS.md](BUILDINGS.md) (draft catalog), [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md), this log, and a root `CLAUDE.md` pointer.
- Claude asked three rounds of blocking questions; the owner answered all of them. Decisions (full table in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)): **TypeScript + Vite + three.js**, free RTS orbit camera, **tile-grid world**, **500+ villagers** late-game (instancing/LOD from day one), real-time with pause/speeds, **four seasons + harsh winter, no day/night**, **full villager sim** (needs, families, death, colony collapse), **knowledge-point tech tree** via school/elders, **living open-ended tribes** (no win screen, milestones), **live raid defense + auto-resolved offense**, **player caravans + barter trade**, git **not yet**.
- Claude drafted [ROADMAP.md](ROADMAP.md) (Phases 0–8) as a discussion draft — **not approved yet**.

**State at end of session:** No code written. Catalogs (RESOURCES.md ~95 items, BUILDINGS.md ~70 buildings) and ROADMAP.md all await owner review.

**Next steps:**
1. Owner reviews RESOURCES.md and BUILDINGS.md (strike/add/defer).
2. Owner reviews ROADMAP.md phase order (3 discussion points at its bottom).
3. Answer remaining non-blocking questions when convenient (map size, saves, disasters, audio, game name…).
4. On approval → Phase 0 begins.

---

## Session 2 — 2026-08-20

**What happened:**
- Owner said "let's build" → roadmap treated as approved; **Phase 0 implemented**.
- New standing instruction recorded: **always start the game on a localhost dev server** at the end of every session (added to CLAUDE.md working rules + memory).
- Scaffolded Vite + TypeScript + three.js (three 0.185, TS 7, Vite 6). Placeholder name **"Northreach"** used in package.json/HUD — owner has not chosen a name yet (open question #25).
- Built: fixed-timestep sim loop with pause/1×/2×/4× ([GameLoop.ts](../src/core/GameLoop.ts)), free RTS orbit camera — WASD/arrows pan, Q/E + right-drag rotate, wheel zoom, middle-drag pan ([RtsCameraController.ts](../src/camera/RtsCameraController.ts)), debug HUD with FPS/speed buttons ([Hud.ts](../src/core/Hud.ts)), and a 256×256 flat test grid with ~6,000 instanced low-poly pines + 1,200 rocks proving the instancing architecture ([testScene.ts](../src/world/testScene.ts)).
- `npm run build` (tsc + vite) passes. Dev server first ran on 5173, but that port is used by another app on the owner's machine — game port is now **pinned to 5180** (`vite.config.ts`, strictPort). Verified HTTP 200 at **http://localhost:5180**.

**State at end of session:** Phase 0 code complete pending owner's in-browser check (FPS target 60). Catalogs still awaiting owner review.

**Next steps:**
1. Owner tests Phase 0 in browser (camera feel, FPS with 7k+ instances).
2. Phase 1 — World Generation: heightmap on tile grid, rivers, forests, straw fields, mountains, clay; biome look; map seed + minimap.
3. Owner review of RESOURCES.md / BUILDINGS.md still open, plus remaining questions (map size matters for Phase 1 — currently 256×256).

---

## Session 3 — 2026-08-20 (later)

**What happened:**
- **Owner camera feedback (standing control rules):** Q must always rotate left, **R** (not E) always rotate right; **WASD must pan along fixed world axes regardless of camera rotation**; mouse controls were fine as they were. Implemented in [RtsCameraController.ts](../src/camera/RtsCameraController.ts) — keyboard pan is now world-axis-fixed, mouse middle-drag pan stays camera-relative, default yaw is 0 so WASD matches the screen at startup.
- **Map size decided by owner: 1024×1024 tiles** (open question #4 resolved).
- Phase 1 terrain generation (first pass) built in [terrain.ts](../src/world/terrain.ts) + [worldScene.ts](../src/world/worldScene.ts): seeded value-noise fBm heightfield, **mountain ranges** (ridged noise masked to regions, snow above y≈42), **lakes** (basins below water level y=0), and **6 rivers** that start in foothills and walk downhill carving channels with soft banks until they hit a lake or the map edge. Vertex-colored terrain (bed/shore/grass/rock/snow), semi-transparent water plane, ~30k pines clustered into forests by density noise + ~6k rocks concentrated near mountains, all terrain-aware (nothing spawns in water/on peaks).
- Map seed logged to browser console; replay a map with `?seed=NUMBER` in the URL.
- Old flat test scene deleted. Build passes; dev server live at http://localhost:5180.

**State at end of session:** Camera per owner's rules; 1024×1024 world with mountains/rivers/lakes awaiting owner's look + FPS check (terrain is ~2M triangles + ~30k instanced trees — if FPS dips on the owner's machine, add chunked terrain + per-chunk frustum culling next).

**Next steps:**
1. Owner tests: camera rules correct? Map look? FPS at 1024×1024?
2. Phase 1 remainder: straw fields near rivers, clay deposits, forest/soil data layers for gameplay, minimap, seed UI.
3. Catalogs (RESOURCES/BUILDINGS) still awaiting owner review.

**Addendum:** Owner immediately resized the map to **512×512 tiles** (question #4 updated). Terrain mesh drops to ~520k triangles; tree/rock counts scaled to area (~8k trees, ~1.6k rocks). Noise frequencies are map-relative so the look is unchanged.

---

## Session 4 — 2026-08-20 (continue: Phase 1 remainder)

**What happened:**
- **Gameplay tile layer** ([tiles.ts](../src/world/tiles.ts)): every tile classified as Grass / Water / Forest / Straw / Clay / Rock / Snow, plus a BFS distance-to-water field. This is the data layer the simulation (pathfinding, gathering, building placement) will run on from Phase 2.
- **Straw fields**: patches on low flat ground within ~10 tiles of water — golden ground tint + ~9k instanced straw tufts.
- **Clay deposits**: reddish-brown patches hugging the waterline (≤3 tiles from water).
- Visuals now derive from the tile layer: trees spawn on Forest tiles, rocks dense on Rock tiles with strays on grass — what the player sees is what the sim will use.
- **Minimap** ([Minimap.ts](../src/ui/Minimap.ts)): bottom-right, tile colors + slope shading, camera marker, **click to jump** the camera.
- **Seed UI in HUD**: shows current seed, type a seed + Enter to load it, 🎲 button for a random map. Typing in the input no longer triggers camera/speed hotkeys.
- Build passes; dev server live at http://localhost:5180.

**State at end of session:** Phase 1 essentially complete (world gen + data layers + minimap + seed UI). Iron/copper/tin/coal ore *locations* not yet marked — deferred until mining exists (Phase 5/7); can be added to the Rock-tile data easily.

**Next steps:**
1. Owner look-over: straw field / clay deposit density and placement, minimap feel.
2. **Phase 2 — Villagers & Work**: villager entities, profession assignment UI, A* pathfinding on the tile grid, first production chains (woodcutter, stone gatherer, forager), hauling + stockpile, instanced villager rendering.
3. Catalogs (RESOURCES/BUILDINGS) still awaiting owner review.

---

## Session 5 — 2026-08-20 (camera revision)

**Owner revised the camera rules (these supersede session 3):**
- Rotation keys are **Q (left) / E (right)** again — R is dropped.
- **WASD pans relative to the CURRENT camera direction** (W = toward the top of the screen however the view is rotated) — NOT world-fixed as recorded in session 3.
- While fixing this, found and fixed a sign bug in the shared pan math: it rotated pan vectors mirrored (correct only at the starting angle), which also affected middle-drag pan after rotating. Keys and middle-drag now use the same correct camera-relative mapping.

**State:** build passes, live at http://localhost:5180. Next: Phase 2 (unchanged).

---

## Session 6 — 2026-08-20 (Phase 2: Villagers & Work)

**What happened — first playable simulation:**
- **A\* pathfinding** on the tile grid ([pathfinding.ts](../src/sim/pathfinding.ts)): 8-directional, corner-cut prevention, allocation-free scratch arrays sized for hundreds of villagers later. Water is unwalkable.
- **Village + villagers** ([village.ts](../src/sim/village.ts)): a camp site auto-selected on flat grass near map center with a wooden **stockpile platform**; **12 villagers** spawn around it, each with a name. Work cycle: pick profession from quotas → find nearest target tile (random among nearest 12 to spread out) → A* there → work → carry yield home → deposit → repeat.
- **Professions** (assign counts in HUD with +/−): 🪓 Woodcutter (5s → 3 wood, **fells a real tree** — the instance disappears from the forest), ⛏ Stone gatherer (6s → 2 stone, rock tiles), 🧺 Forager (4s → 2 food, forest tiles). Defaults 3/2/2, rest idle. Stone/berries don't deplete yet.
- **Villager rendering** ([VillagerRenderer.ts](../src/render/VillagerRenderer.ts)): instanced body+head (capacity 1024 pre-allocated), body color by profession, walk-bob/work-bounce, positions interpolated between 10 Hz sim ticks via loop alpha so movement is smooth at any FPS and any game speed.
- **HUD**: resource counters (wood/stone/food/population), job quota rows, idle count. Camera now starts zoomed in on the stockpile camp.

**State at end of session:** Phase 2 core loop working — assign workers, watch them walk out, chop/gather, haul back; counters climb; trees actually disappear. Build passes, live at http://localhost:5180.

**Known simplifications (future phases):** no dedicated haulers (workers carry their own yield), stone/berry nodes don't deplete, no villager selection/inspection UI, idle villagers stand still.

**Next steps:**
1. Owner playtest: pacing (work times/yields), villager look, speed controls at 2×/4×.
2. Phase 3 — Survival: seasons, winter, food/firewood consumption, houses, families, death.
3. Catalogs (RESOURCES/BUILDINGS) still awaiting owner review.

---

## Session 7 — 2026-08-20 (stone icon + Phase 3a: Seasons & Survival)

**What happened:**
- **Stone icon**: 🪨 looked like a crystal on the owner's platform → replaced with a hand-drawn inline-SVG boulder in the HUD (resource row + job label). Recorded as owner feedback.
- **Calendar** ([calendar.ts](../src/sim/calendar.ts)): 4 seasons × 5 real min = 20 min/year (owner's decision range), 15 "days"/season, HUD shows `🌱 Spring · Day N · Year N`.
- **Seasonal visuals** ([SeasonVisuals.ts](../src/render/SeasonVisuals.ts)): snow builds over the first quarter of winter and melts through early spring — terrain vertex colors sweep in 24k-vertex chunks per frame (no frame spikes), canopies frost, water turns icy pale. Lake/river beds stay snow-free.
- **Survival needs**: each villager eats 1 food/60s year-round; in winter each burns 1 firewood/60s at the camp fire. Empty stores → warning event, then **death by starvation (4 missed meals) or freezing (3 missed warm-ups)**. Village starts with a small buffer (20 food, 10 firewood, 6 wood). "The village has perished" if everyone dies.
- **Firewood chain**: new resource 🔥 + new profession **Firewood splitter** (works at the stockpile, 2 wood → 4 firewood). Default quotas now 3 woodcutter / 1 stone / 3 forager / 1 firewood.
- **Winter pressure**: foraging is disabled in winter (nothing to gather under snow) — you must stockpile food in autumn.
- **Event feed** (bottom-left, [Events.ts](../src/ui/Events.ts)): season changes, hunger/freezing warnings, deaths.

**State at end of session:** The survival loop is real — 3 seasons to prepare, then winter tests the stores. Build passes, live at http://localhost:5180.

**Balance notes for playtesting:** 12 villagers ≈ 12 food/min consumption; a forager nets ~6-9/min. Winter needs ~12 firewood/min ≈ 6-7 wood/min upstream. Tune after owner playtest.

**Next steps:**
1. Owner playtest: survive year 1 with default assignments? Season length feel? Snow look?
2. Phase 3b: houses (warmth radius, less firewood), families/children/aging, health & happiness.
3. Then Phase 4 (hunter/fisher/herbalist/tools) or building placement UI first — owner's call.
4. Catalogs (RESOURCES/BUILDINGS) still awaiting owner review.

---

## Session 8 — 2026-08-20 (Phase 3b: Houses, Builders, Families, Aging)

**What happened:**
- **Building placement UI** ([Placement.ts](../src/ui/Placement.ts)): "🏠 Build house (8 🪵)" button → ghost house follows cursor snapped to the grid, green/red validity tint (needs flat grass/straw, no water/rock/overlap). Left-click places, right-click/Escape cancels. This pipeline will serve every future building.
- **Builder profession** ([village.ts](../src/sim/village.ts)): builders haul 4 wood per trip from the stockpile to the site, then construct (20s). Sites render as staked outlines → timber frame → finished house (pyramid-roof low-poly, [BuildingRenderer.ts](../src/render/BuildingRenderer.ts)). Footprint tiles become unwalkable.
- **Houses** (4 beds): homeless villagers move in automatically. A housed group shares ONE fire — 1 firewood/60s per house vs 1 per person at the camp fire (~4× cheaper). A house that runs out of firewood chills its occupants (freeze deaths).
- **Families & births**: each season change, a house with 2+ non-elder adults, a free bed, and food surplus (>15) has a 40% chance of a baby. Children render at 0.55 scale, eat half rations, don't work, and mature into workers at age 10.
- **Aging**: villagers age 1 "life-year" per season (~4–6 game years lifespan ≈ 1.5–2h real time), die of old age at 50–70. Starting villagers are 16–40.
- HUD: 🏠 house count + homeless count row; builder job quota (default 1).

**State at end of session:** Full settlement loop: gather → build houses → families grow → generations turn over, under seasonal survival pressure. Build passes, live at http://localhost:5180.

**Next steps:**
1. Owner playtest: house placement feel, builder flow, birth/aging pacing.
2. Phase 4 — Primitive economy: hunter (roaming game animals), fisher, herbalist+medicine, tools (wood/stone tiers affecting speed), storage buildings via the new placement pipeline.
3. Catalogs (RESOURCES/BUILDINGS) still awaiting owner review.

---

## Session 9 — 2026-08-20 (Phase 4a: Hunter, Fisher, Herbalist, Sickness)

**What happened:**
- **Wild deer** ([animals.ts](../src/sim/animals.ts)): ~50 low-poly deer wander forests/meadows (instanced, [AnimalRenderer.ts](../src/render/AnimalRenderer.ts)), graze-and-move behavior, herd regrows ~10%/season up to 80 — overhunting empties the woods.
- **🏹 Hunter** (no building needed): stalks the nearest deer, re-paths up to 4 times as it wanders, kills at close range → carries **5 food** home + **1 hide** banked. New resource **hides** (stretched-pelt SVG icon; future: leather/clothing/trade).
- **🎣 Fisher**: works at a **Fishing hut** (6 wood, must be within 2 tiles of water, supports 2 fishers) → 3 food/cycle. Reliable food that works in any season — including winter (ice fishing), making it the survival alternative to foraging.
- **🌿 Herbalist**: works from a **Herbalist hut** (6 wood, 1 slot), gathers herbs in the forest → 2 medicine/cycle.
- **🤒 Winter sickness**: villagers can fall ill in winter; 1 medicine treats (quick recovery), untreated cases are 40% fatal. Events feed announces illness/treatment/recovery/death. Start with 2 medicine.
- **Build menu** is now a row of three buttons (🏠 🎣 🌿) with cost/requirement tooltips; workplace buildings have distinct roof colors (blue fishing, green herbalist).
- Profession quotas for hunter/fisher/herbalist default to 0 — fisher/herbalist jobs only exist once their hut is built (worker-slot gating via building specs).

**State at end of session:** Build passes, live at http://localhost:5180.

**Next steps:**
1. Owner playtest: hunt chase behavior, fishing/herbalist balance, illness frequency.
2. Phase 4b: tools (wooden/stone tiers, toolmaker, work-speed effects), storage buildings (shed capacity/spoilage), or jump to Phase 5 (knowledge/school/farming) — owner's call.
3. Catalogs (RESOURCES/BUILDINGS) still awaiting owner review.

---

## Session 10 — 2026-08-20 (Phase 4b: Tools & Storage)

**What happened — Phase 4 complete:**
- **Tool tiers** ([village.ts](../src/sim/village.ts)): none / wooden / stone. Work speed ×1.5 (no tool, slower) / ×1.0 / ×0.75. Villagers auto-equip the best tool in store when taking a job; a tool wears out after **15 work cycles** (builders also get a build-speed bonus from tools). Start stock: 4 wooden tools.
- **🛠 Toolmaker's workshop** (8 wood, 1 slot): crafts **stone tools** (2 stone + 1 wood → 2) when materials allow, else **wooden tools** (2 wood → 2). Rests when the stock covers population + 4 spares or materials run out. Toolmaker quota defaults to 1 — kicks in when the workshop is built.
- **📦 Storage shed** (10 wood, +250 capacity): the stockpile now has a **capacity limit** (base 200, all goods counted). Overflow is lost with a throttled warning event. HUD shows `📦 used/capacity`.
- New resources **woodenTools/stoneTools** with hatchet SVG icons (tan/grey blades); build menu now 5 buttons (🏠 🎣 🌿 🛠️ 📦).
- Stone finally matters: it feeds stone tools — the first step of the tech ladder (wood → stone → bronze → iron).

**State at end of session:** Roadmap **Phase 4 is complete** (hunter/fisher/herbalist/medicine/tools/storage). Build passes, live at http://localhost:5180.

**Next steps:**
1. Owner playtest: tool pacing (15 uses? speed spread?), storage pressure.
2. **Phase 5 — Settled era**: school + knowledge points + tech tree, farming (fields, crop seasons), livestock, clay→brick chain, food processing, housing upgrades. Suggest starting with school/knowledge + farming.
3. Catalogs (RESOURCES/BUILDINGS) still awaiting owner review.

---

## Session 11 — 2026-08-20 (Phase 5a: School, Knowledge, Tech Tree, Farming)

**What happened — the civilization spine is in:**
- **📖 School** (12 wood, 1 teacher slot) + **Teacher** profession: generates 1 knowledge point per 8s work cycle. On-site professions (teacher/farmer) now repeat cycles at their building and only walk home for a break every 6th cycle.
- **Tech tree** ([techs.ts](../src/sim/techs.ts)) + research panel UI (📖 Research button → panel, top-right): first batch — **Agriculture** (15 KP, unlocks crop field), **Crop rotation** (25 KP, requires Agriculture, +50% harvest), **Herb lore** (15 KP, +1 medicine/trip). Locked techs show their prerequisite; buildings can be tech-gated (`isBuildingUnlocked`).
- **🌾 Farming** with real crop seasons: Crop field (3×3, 4 wood, 2 farmer slots). Farmers **sow/tend in spring & summer** (field growth 0→1, crop rows visibly rise and turn from green to gold), **harvest in autumn** (6 food/cycle, 9 with crop rotation, draining growth), idle in winter. **Unharvested crops are lost to the first frost** (event warning) — harvest labor in autumn matters.
- Field visuals: soil bed + 4 crop-row meshes rebuilt as growth crosses thresholds.
- Placement ghost now scales to the building footprint (fields are 3×3).

**State at end of session:** Knowledge → research → unlock → build → seasonal farming loop closes. Build passes, live at http://localhost:5180.

**Next steps:**
1. Owner playtest: KP pacing (school → Agriculture takes ~2 seasons with 1 teacher), field yields, autumn harvest crunch.
2. Phase 5b: clay→brick chain (clay pit, brick oven), food processing, housing upgrades, livestock — plus more techs (Masonry, Pottery). Or begin Phase 6 (tribes & trade).
3. Catalogs (RESOURCES/BUILDINGS) still awaiting owner review.

---

## Session 12 — 2026-08-20 (Phase 5b: Clay → Brick chain, Brick houses)

**What happened:**
- **Multi-material construction**: building costs are now `{wood, stone, brick}` ([buildings.ts](../src/sim/buildings.ts) rewritten). Builders haul whichever material the site still needs; sites show per-material progress. Brick oven costs 4 wood + 6 stone; brick house 4 wood + 12 brick.
- **Techs added**: 🏺 **Clay working** (20 KP, unlocks clay pit), 🧱 **Brick making** (30 KP, requires Clay working, unlocks brick oven + brick house).
- **Clay chain**: Clay pit (6 wood, must touch a clay deposit, 2 digger slots) → clay. Brick oven (1 brickmaker) fires **2 clay + 1 firewood → 3 bricks**. New resources clay (SVG lump icon) + brick 🧱, new professions Clay digger + Brickmaker.
- **🏘️ Brick house**: 6 beds and its fire lasts **1.5× longer per firewood** — the era-2 housing upgrade. Clay pit renders as a dug bed with clay mounds; brick buildings get terracotta walls / dark red roofs.
- Placement validity now also scans the 1-ring around the footprint (for the clay-adjacency rule).

**State at end of session:** Full second production ladder: clay deposit → pit → oven (+firewood) → bricks → better housing. Build passes, live at http://localhost:5180.

**Next steps:**
1. Owner playtest: brick chain pacing, clay pit placement UX near deposits.
2. Options: Phase 5c (livestock, food processing/smokehouse, pottery for food storage) or **Phase 6 (tribes: settlements at 4 edges, relations, caravan trade)** — recommend tribes next for a big gameplay beat.
3. Catalogs (RESOURCES/BUILDINGS) still awaiting owner review.

---

## Session 13 — 2026-08-20 (Owner refinement pass: UI windows, buildings, forester, balance)

**Owner instructions implemented (all recorded as standing decisions):**
- **UI restructure**: main HUD (top-left) keeps only title, season/day/year, speed. **FPS/sim time/seed moved to a technical box bottom-right** (above minimap). Menu buttons under the HUD open **draggable windows** ([Window.ts](../src/ui/Window.ts), [Panels.ts](../src/ui/Panels.ts)):
  - **ℹ️ Info**: population, adults ♂/♀, children + students, food & firewood with estimated days left (color-coded), housing/beds/homeless, tools, clothes, medicine, knowledge.
  - **📦 Resources**: all resources + a **storage fill bar** (green→yellow→red).
  - **👷 Workers**: profession quota rows (moved from HUD).
  - **🔨 Build**: full building list with footprint, multi-material cost, description, lock state, Place/Cancel.
  - **📖 Research**: tech tree (moved from fixed panel into a window).
  - **Building info on click**: click any building → window shows construction % + per-material delivery while building; when complete: houses show occupants/warmth, school shows teachers/students/knowledge rate, hunting lodge shows game nearby + efficiency %, fields show growth, sheds show capacity.
- **Building footprints now w×d** (non-square allowed): house 2×2, school **5×5** (2×3 schoolhouse + fenced flower garden), hunting lodge **2×3** (NEW — hunters now require it, drying rack visual), woodcutter's lodge **3×3** (NEW — woodcutters now require it, log pile + stump), forester's hut 2×2 (NEW), toolmaker 3×2 (anvil + bench), storage shed 3×2 (open-sided roof + crates), clay pit 3×3, brick oven = domed kiln with chimney. All buildings rebuilt as composed low-poly shapes that resemble their function.
- **🌲 Forester** (new profession + hut): replants felled forest tiles. **Saplings → mid-size at 1 year → mature (choppable) at 2 years.** Tree instancing got +4000 spare capacity and slot reuse.
- **Builders clear land and flatten terrain** at site placement: trees removed from footprint, ground leveled to average height (terrain mesh updated live). Forest tiles are now buildable.
- **Balance (owner)**: firewood production 50% slower (8s cycle); firewood burns **spring/autumn at base rate, winter at 2×, summer none** (freeze deaths only in winter); **food eaten 2× as fast** (1 per 30s per adult). Starting stock raised to 12 wood / 40 food / 14 firewood.
- Sex added to villagers (♂/♀); births now require an adult man + woman in the house. Children count as **students** (up to 12/school) and speed up knowledge generation (+5% per student). `clothes` resource added (display only — production comes with tailor later).
- Startup hint event: gathering professions need their buildings; woodcutter's lodge costs only 4 wood.

**State at end of session:** Build passes, live at http://localhost:5180. Note: early game now begins with building a woodcutter's lodge.

**Next steps:**
1. Owner playtest of the new UI + balance (food at 2× is much tighter — fishing hut early is nearly mandatory).
2. Then Phase 5c (livestock/food processing/tailor for clothes) or Phase 6 (tribes & trade).

**Addendum (bug report follow-up):** Owner saw woodcutters at 0/5 with "green guys" visiting trees. Diagnosis: not a sim bug — woodcutters were gated on the (unbuilt) woodcutter's lodge, and the green villagers were foragers gathering food. The real problem was UI silence. Fix: Workers window now shows per-profession **slot counts** and a red `🔒 needs Woodcutter's lodge` note when the workplace is missing (yellow ⚠ when desired > slots), and raising a quota with no workplace fires an event explaining what to build.

**Owner redesign (same day):** Wood chopping must NOT require a building — any villager (woodcutter profession) collects wood and hauls it to storage from the start. The **woodcutter's lodge is now the firewood workshop**: firewood splitters (2 slots) work there instead of at the stockpile. Implemented; workplace gating refactored to a single `workplaceOf(profession)` mapping.

---

## Session 14 — 2026-08-20 (Phase 6: Tribes & Caravan Trade)

**What happened:**
- **Four tribes** ([tribes.ts](../src/sim/tribes.ts)) spawn at the N/E/S/W map edges with seeded names (e.g. Vardrin, Oskheim), colors, and **personalities** (🪙 Merchant / 🪶 Proud / ⚔️ Fierce / 🌫️ Reclusive) that set their starting relations (-20..+30) and the baseline relations drift back toward each season.
- **Visible camps**: tent clusters with tribe-colored trim, campfire, and banner ([TribeRenderer.ts](../src/render/TribeRenderer.ts)); colored **markers on the minimap**.
- **Barter economy**: each tribe sells 2 goods cheap and pays 1.5× for 2 goods it needs; exchange rate also scales with relations (0.7×–1.2×). Trade values per good in `TRADE_VALUES`.
- **🏕 Trading post** building (10 wood) + **caravans**: from the new Tribes window pick a tribe, choose goods → amount → what to receive (or 🎁 gift), see a live estimate, and send. An **ox-cart caravan** travels the real pathfinding route to the camp (visible on the map), trades for ~8s, and hauls the goods home. Gifts buy relations (~value/8); each trade +2.
- **Tribes window** (🏕 menu button): per tribe — name/side/personality, color-coded relations bar, sells/needs icons, trade form with estimate, and a live list of caravans on the road.
- Relations groundwork (shiftRelation, personalities) is the foundation Phase 7 war/raids will build on.

**State at end of session:** Build passes, live at http://localhost:5180.

**Next steps:**
1. Owner playtest: caravan pacing (edge trips take a couple of minutes), barter rates, tribe camp looks.
2. **Phase 7 — Bronze, Iron & War**: mines/smelter/metal tiers, weapons/armor, militia, palisades, live raid defense (fierce tribes at low relations), auto-resolved attacks on tribes. Or Phase 5c (livestock/food processing/tailor) first.
3. Catalogs (RESOURCES/BUILDINGS) still awaiting owner review.

---

## Session 15 — 2026-08-20 (Phase 7a: The Metal Age)

**What happened:**
- **Ore deposits** ([tiles.ts](../src/world/tiles.ts)): seeded blob patches of **copper, tin, iron, coal** on mountain rock — visible in-world as tinted rock clusters and color-coded on the minimap.
- **Techs**: ⛏️ **Mining** (25 KP) → 🥉 **Bronze working** (35, requires Mining) → ⚔️ **Iron working** (50, requires Bronze).
- **⛏️ Mine** (2×3, 8 wood + 4 stone, must touch a deposit, buildable on rock): its vein is the majority ore under/around it (shown in the click-info); 2 miners extract that ore.
- **⚒️ Smelter** (3×2, 4 wood + 8 stone): 1 copper + 1 tin + 1 firewood → 1 bronze bar; with Iron working, 2 iron ore + 1 coal → 1 iron bar (iron takes priority).
- **Tool tiers extended**: toolmaker crafts the best available — iron > bronze > stone > wooden (bar + wood → 2 tools). Speeds: none ×1.5, wood ×1.0, stone ×0.75, **bronze ×0.65, iron ×0.55**. Villagers auto-equip best-first.
- New resources (ore/bar/tool SVG icons): copperOre, tinOre, ironOre, coal, bronzeBar, ironBar, bronzeTools, ironTools — all tradeable with tribes (iron tools = top trade good at value 12).
- New professions: ⛏️ Miner, ⚒️ Smelter. Mine/smelter meshes: timbered portal in a rock mound; stone furnace with glowing mouth + chimney. Trading post also got a proper hall + hitching post mesh.

**State at end of session:** Wood→stone→bronze→iron progression complete for TOOLS. Build passes, live at http://localhost:5180.

**Next steps:**
1. Owner playtest: ore patch density/visibility, mine placement, smelter throughput.
2. **Phase 7b — War**: weaponsmith (weapons/armor from bronze/iron), militia + training, palisades/towers, fierce-tribe raids (live defense), auto-resolved attacks on tribes, conquest outcomes.
3. Catalogs still awaiting owner review.

---

## Session 16 — 2026-08-20 (Phase 7b: War)

**What happened:**
- **🛡️ Warcraft tech** (20 KP) unlocks: **Training ground** (4×4 sparring yard w/ dummies, 6 soldier slots), **Weaponsmith** (forges best-tier weapons: spear ← 2 wood+1 stone / bronze ← bar+wood / iron ← bar+wood, then **leather armor** from 2 hides once soldiers are armed), **Watchtower** (+2 defense, early raid warning).
- **Soldiers** ([village.ts](../src/sim/village.ts)): profession trained at the training ground; auto-equip best weapon + armor from store. Combat strength = 1 + weapon (1/2/3) + armor (1).
- **Raids** ([war.ts](../src/sim/war.ts)): from year 2, hostile tribes (relation < −25; fierce most likely) send raider bands each season that **march visibly across the map** to your village (red figures, [WarRenderer.ts](../src/render/WarRenderer.ts)). On arrival: 10s fight, then resolution vs your defense strength (soldiers + towers, or desperate militia). Lose → soldier deaths + 30% food / 20% firewood stolen. Win → light casualties, relations drop further.
- **Attacking tribes** (⚔ Attack button per tribe in the Tribes window, needs ≥3 soldiers): your war party marches to their camp (steel-blue squad), battle **auto-resolves** vs tribe strength (personality + year-scaled; shown in the window next to yours). Victory → tribe **permanently subdued** (never raids, friendly trade, loot); defeat → heavy losses. Attacking tanks relations −40 regardless.
- Info window gained a military section (soldiers, defense strength, weapon/armor stocks). New weapon/armor resources tradeable.

**State at end of session:** ROADMAP PHASES 0–7 CORE ALL PLAYABLE: survival → farming → knowledge → brick → metal → trade → war. Build passes, live at http://localhost:5180.

**Next steps:**
1. Owner playtest: raid difficulty curve, attack risk/reward, watchtower value.
2. Remaining roadmap: Phase 8 polish (save/load!, statistics, disasters, audio, more catalog breadth: livestock/tailor/pottery/brewery), walls/palisades (deferred), soldiers physically rushing to raid battles (deferred polish).
3. Catalogs still awaiting owner review.

---

## Session 17 — 2026-08-20 (Phase 8a: Save & Load)

**What happened:**
- **Save system** ([save.ts](../src/sim/save.ts)): since the world regenerates deterministically from the seed, saves store only mutable state — calendar, resources/knowledge/researched/quotas, villagers (identity, age, position, gear, home), buildings (kind, position, materials, progress, growth, ore vein), **forest change logs** (every felled tree + every planted sapling with plant time, replayed onto the regenerated map), tribe relations/defeated, deer count. localStorage, ~tens of KB.
- **Loading** stashes the save in sessionStorage and reloads the page on the save's seed; on boot the fresh systems get the state layered on (`applySave`). Villagers resume as idle and re-pick jobs from quotas. In-flight caravans/raids/war parties are not saved (noted in UI).
- **💾 Save window** (menu button): 3 manual slots + autosave slot, each showing `Year X · 👥 pop · timestamp`, with Save/Load/Delete. **Autosave fires at every new year.**
- Restore hooks added: `Calendar.load`, `Village.restoreBuilding`/`reclearFootprints`, `AnimalSystem.setPopulation`, ForestView `removedLog`/`plantLog`.

**State at end of session:** Progress is now persistent. Build passes, live at http://localhost:5180.

**Next steps:**
1. Owner test: save → change things → load; autosave after a year rollover.
2. Phase 8 continues: statistics/chronicle, disasters (fire/wolves/harsh winters), economy breadth (livestock, tailor→clothes, pottery, brewery — pending catalog review), walls, audio.

---

## Session 18 — 2026-08-20 (Owner feature pass: Families, Roads, Character info, Storage)

**Owner instructions implemented (all standing rules):**
- **Marriage & family system** ([village.ts](../src/sim/village.ts)), checked daily (20s): **1%** chance an unmarried adult couple marries **if an empty house exists** (they move in); **2%** for two unmarried adults sharing a house (marry in place); singles lodging in a married couple's house get relocated to an empty house or one with only unmarried folk. **Married cohabiting couples: 1%/day pregnancy; birth after 3 seasons** (🤰 event → 👶 birth event). Widowhood clears the marriage.
- **Life stages**: baby until **age 5** (tiny model, stays put), then school-age child (attends school if built — students = age 5-10), adult at 10.
- **Starting population**: 3 married couples (2 with a child + baby each) + 4 unmarried adults = 14. Housing assignment is family-aware (couples move in together).
- **House capacity 6** (brick house 8).
- **Forester** now plants starting from the tile **closest to the forester's hut**.
- **🛤 Roads**: Build window entry; click-**drag paints** road tiles at 1 stone each. Villagers walk **40% faster** on roads and pathfinding prefers them (A* cost 0.6). Flat quad visuals; saved/restored.
- **Character window**: click any villager on the map (or a name inside a house's info window) → gender, age & life stage, occupation, current activity, **health & happiness** (derived stats), tool + wear, weapon/armor, clothing (villagers now auto-equip clothes from store), family status (spouse/expecting), home.
- **Storage**: clicking a storage shed lists **everything in the town stores** with a fill bar; the stockpile and every shed now **visually fill with crates/sacks** as storage fills (refreshed 1/s).
- Save format extended (spouse links, pregnancy, clothes, roads) — old saves load with defaults.

**State at end of session:** Build passes, live at http://localhost:5180.

**Next steps:**
1. Owner playtest: marriage pacing (1%/2% per day), road feel, character window.
2. Phase 8 continues: statistics, disasters, tailor (clothes production — now visibly needed), livestock, walls, audio.

---

## Session 19 — 2026-08-21 (Owner fixes: family cohesion, road lines + leveling, school roof, walls & gates)

**Owner instructions implemented:**
- **Family relations tracked**: villagers have mother/father links (set at spawn and birth; shown in the character window with children lists). **Children live with their parents until adulthood** — housing moves take minor children along; the singles-relocation rule only ever moves grown (adult) children out of the family home.
- **Housing bug fixed** ("built 3 houses, nobody moved in"): root causes — housing was only re-evaluated on completion/death, and families never split up. Now the daily family tick runs a **housing sweep** (homeless housed daily) and **1b: when two couples share a roof, the second family (with its children) claims an empty house** — new houses actually fill. Family-aware reassignment: couples+children together, homeless minors rejoin housed parents.
- **Roads reworked**: click start → live line preview (Bresenham) → click end commits, Esc/right-click cancels the line (then the mode). **Terrain no longer blocks roads: the roadbed is cut/filled to a straight levelled grade between the endpoints**, shoulder corners blended halfway (owner rule). 1 stone/tile, existing road tiles free.
- **School roof fixed**: rectangular buildings (school 2×3 house, toolmaker, hunting lodge, storage shed...) now get a proper **gabled roof** along their long axis instead of the stretched pyramid.
- **Walls & gates**: 🪵 wooden wall (2 wood), stone wall (3 stone) — drawn as lines like roads; 🚪 wooden gate (4 wood), 🏰 stone gate (6 stone) — single click, arch orients to adjacent walls. Walls block all movement (including raiders — a **fully-walled village turns raids back** with an event + small relations hit); gates let villagers through. Every segment adds to defense strength ([WallRenderer.ts](../src/render/WallRenderer.ts)).
- Save format: parent links + walls added.

**Incident:** a PowerShell bulk-replace from session 18 had mojibake'd all emoji in village.ts; repaired via byte-reversal script; lesson saved to memory (never round-trip UTF-8 through PowerShell string pipelines).

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 20 — 2026-08-21 (Phase 8b: Tailor, Chronicle, Disasters)

**What happened:**
- **🧥 Tailor's shop** (6 wood, 1 tailor): sews clothes from **2 hides → 1**; rests when everyone's clothed (+2 spare). Clothed villagers survive **one extra freeze strike** in winter; clothes **wear out** (25% chance each spring). Closes the loop that made everyone show "ragged" in the character window.
- **📊 Chronicle window** (new menu button): canvas line chart of **population / food / firewood** over time (daily samples, year gridlines) + totals: births, deaths, houses/beds, techs researched.
- **Disasters** (daily rolls): ☀️ **summer fires** (~1.5%/day) — a random wooden building burns back to partial construction (half its materials lost, occupants evicted; builders repair it); 🐺 **wolves** in spring/autumn (~1%/day) — harmless if you employ a hunter, otherwise they take a villager working outdoors; 🌨️ **harsh winters** (25% of winters, announced) — firewood burns half again as fast.
- Dev server had died with the previous console session — restarted per standing rule.

**State at end of session:** Build passes, live at http://localhost:5180.

**Remaining Phase 8 backlog:** livestock/pasture, pottery (food storage), brewery/morale, audio, minimap building markers, demolish tool, soldiers physically defending raid battles.

---

## Session 21 — 2026-08-22 (Owner fix pass: 13 items)

**All 13 owner instructions implemented:**
1. **Forester spread**: random direction + exponentially-distributed distance from the hut (near likely, far rare); target must be treeless with ≤2 trees in its 3×3 neighbourhood.
2. **Roads/walls invisible — root cause found**: three.js InstancedMesh frustum-culling used a stale bounding sphere for dynamically-placed instances, so road/wall/preview quads were culled. `frustumCulled = false` applied to all dynamic instanced meshes (preview, roads, walls, storage crates, war bands, villagers, animals).
3. **Babies/children play at home**: idle children move to the front of their own house (school-age kids also visit the schoolyard) instead of loitering on the stockpile.
4. **Housing integrity**: families NEVER split — `moveFamilyIn` refuses houses that can't fit the whole family (couple + minor children); couples-, single-parent-, orphan- and singles-passes in that order; final bed-filling only takes dependents-free singles.
5. **Marriage from age 16**; pregnancy only 16–50 with linearly fading fertility.
6. **Nearest storage logistics**: workers drop off and pick up at the closest storage point (stockpile or any finished shed).
7. **Animal packs**: deer now live in packs (10 starting packs of 4-6) anchored where forest meets water; each season forests/waters spawn a new pack up to a 120 cap; deer graze near their anchor so hunting grounds stay huntable.
8. **Event log**: bottom-left, latest 6 always visible (no fade), click header to expand full scrollable history (200 entries).
9. **Tools**: start with 20 wooden; efficiency none 50% / wood 100% / stone 125% / bronze 165% / iron 200%.
10. **Build entries**: requirement text removed; locked buildings show 🔒 whose tooltip names the required research.
11. **School costs bricks** (8 wood + 10 brick); knowledge now generates **passively at 25%** of the old rate, a teacher adds **50%** (plus student bonus).

12+13. **Tabs & food/happiness**: Resources window tabbed (Food/Materials/Goods with storage bar); Build window tabbed (Housing/Food/Industry/Civic/Military). **Food split into berries/meat/fish/crops** (forager/hunter/fisher/farmer respectively); eating draws from the largest stock; **diet variety grants up to +15 happiness**; **happiness drives productivity: 0%→20%, 100%→120%** (applied to all work timers together with tool tier). Info window shows food total, variety, and avg happiness → productivity. Old saves fold 'food' into berries.

**Follow-up fixes (same day):**
1. **Forager variety**: forest trips now bring back berries, mushrooms, or wild roots (two new food types — diet variety is x/6).
2. **Work window lock**: the `needs X` text removed; the 🔒 alone carries a tooltip naming the required building.
3. **Crop fields are 5×5** (6 wood, 3 farmer slots) with strict seasons: **sowing only in spring** (work fills growth to 40%), **summer growth automatic** toward 100% (+50% while a farmer attends; unsown fields stay barren), **harvest only in autumn**.

**"Everything red" placement bug (owner report #2):** the red previews were affordability failures with no explanation — the player starts with 0 stone, and roads cost 1 stone/tile (stone walls/gates likewise). Fixes: **dirt roads are now free**; a **placement hint bar** (bottom-center) always shows what's being placed, tile count, total cost vs. stock, and the exact reason when invalid — ❌ red only for water/buildings/walls in the way, ⚠ yellow for "not enough materials: N wood (have M)".

---

## Session 22 — 2026-08-23 (Owner fix pass: 17 items)

1. **Walking**: off-road speed cut 25% (1.8 t/s); roads restore the old 2.4 t/s.
2. **Builders build roads & walls**: laying a line creates pending tile-jobs (grey plots); builders walk out and pave/raise each tile (road 3s, wall 4s, gate 8s of builder work). Wall materials still paid at placement.
3. **Construction slowed**: builders work at 50% rate; haul capacity 3 / 4 (wooden tool) / 5 (better).
4. **Illness**: daily per-villager roll — 0.1% summer, 0.3% spring/autumn, 0.5% winter (replaces winter-only).
5. **Per-building worker caps**: every workplace has an adjustable "Workers allowed" (0..slots) in its click-info; job assignment respects it (all workplace professions now bind to a specific building).
6. **Demolish/cancel**: unstarted sites can be cancelled free; anything with materials (or complete) must be demolished by builders — half the invested materials come back.
7+8. **House upgrades & stone house**: new Stone house (4 wood + 8 stone, 6 beds, 1.25× warmth); house→stone/brick and stone→brick upgrade buttons — occupants move out as families and are rehoused where possible while builders rebuild.
9. **Straw is a build material**: straw resource + Straw cutter profession (harvests straw-field tiles); houses now cost 8 wood + 4 straw.
10. **Clay tiles**: new material fired in the brick oven (mode toggle: bricks/clay tiles); required by school (8w+8b+6t) and brick house (4w+12b+6t).
11. **Production modes**: brick oven (bricks/tiles), smelter (auto/bronze/iron), toolmaker (best/wood/stone/bronze/iron), weaponsmith (auto/weapons/armor) — chosen per building in its info window.
12. **Foresters** now split 50/50 between felling nearby mature trees (3 wood) and planting; both at the slower 8s cycle (13: builders & foresters 50% slower ✓).
14. **All professions start at 0/0** — the workforce is built from scratch.
15. **20 firewood at the start.**
16. **Custom tooltips**: styled instant tooltip for everything with data-tip (menu, locks, upgrade/demolish buttons) — no more native title popups.
17. **Roads render as paved stone** (procedural cobblestone texture, quarter-turn variation per tile).
Save format: building maxWorkers/productionMode + pendingWorks persisted.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 23 — 2026-08-23 (Owner batch: terrain, farming depth, household food)

1. **Gentler terrain**: ridge amplitude 62→28, broader hill masks, base relief 26→22; MOUNTAIN_LINE 26→18, SNOW_LINE 42→30 — soft hills instead of jagged peaks.
2. **Soft lake shores**: post-gen relaxation pass limits bank slope wherever ground meets low/under-water terrain — no more cliffs into lakes.
3. Straw collection already existed (Straw cutter, session 22) — confirmed.
4. **Barn** (4×3, 10 wood + 6 straw, 2 slots, needs Agriculture): **farmers work here in winter**, threshing grain — 2 wheat/rye → 2 flour + 1 straw; 2 oat/barley → 2 animal feed + 1 straw.
5. **Crop variety & seeds**: fields select their crop (11: wheat/rye/oat/barley/potatoes/tomatoes/peppers/strawberries/carrots/melons/watermelons) via the Produces buttons; **sowing a fresh field costs 2 seeds — bought from tribes** (seeds tradeable, value 2). Grains aren't edible raw; vegetables/fruits are foods.
6. **Bakery** (🍞 Baking tech, 25 KP, requires Agriculture): baker turns 2 flour + 1 firewood → 3 bread.
7+8. **Household food economy**: houses have **pantries**. Residents fetch groceries from the nearest storage (one shopper per household; diverse baskets preferred), families **eat from their own pantry**, and **each distinct food at home gives +1 happiness**. Pantry cap = **1.5 × total food reserve / house count**; fetching stops at cap−4 and always happens when the pantry is empty. Homeless eat from central storage (max +1 diet happiness). House click-info shows the pantry; Resources window shows storage vs pantry split. Saves carry pantries; old 'crops' → wheat.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 24 — 2026-08-23 (Owner batch: society — baron, religion, medicine, names)

**Owner instructions (verbatim intent, 10 items):**
1. Worker tab must not count the unworkable (babies, school-age children) as idle.
2. Dangerous jobs: woodcutting, mining, hunting can kill — ultra rare, 0.005% per person per day.
3. A family member's death gives the family −20 happiness for one season.
4. Stone walls & Manor unlock with **Feudalism** research.
5. Once the Manor is built, one citizen becomes the **baron**; on his death his oldest male son inherits.
6. English names — male names for men, female for women; **1000 of each recorded in game files**.
7. Farmer pacing: 1 farmer = 100% of one field per season (plow/fertilize/sow in spring, tend in summer, harvest in autumn). Free time → barn work if materials exist; in winter always the barn.
8. Female villagers look different (long hair, body shape).
9. **Religion** research → Temple: +10 happiness for up to 100 villagers.
10. **Medicine** research (10 📖). Illness lasts 5 days; without medicine or herbs it lasts 100% longer and each sick day has 1% death chance. Herbalist collects herbs; herbs (with an assigned herbalist) shorten illness 50%. After Medicine research the herbalist brews 1 medicine from 2 herbs.

**Numbers Claude filled in (owner may override):** Feudalism 40 📖; Religion 30 📖; Medicine 10 📖 (requires Herb lore). Manor 4×4, 10 wood + 16 stone + 6 clay tiles, houses 8 (baron's family moves in), warmth like brick. Temple 4×4, 8 wood + 16 stone + 6 clay tiles, passive. Baron chosen as the oldest adult man; succession = oldest male son (any age), fallback oldest adult man. Illness model: untreated 10 days + 1%/day death; medicine (1 dose) or 1 herb + assigned herbalist halves the remaining course and removes the death risk (≈5 days when treated at once). Herbalist now gathers **herbs** (new resource, 2/trip, +50% with Herb lore); brews medicine at the hut once Medicine is researched. Grief hits spouse, parents, children, and siblings.

**Implemented (all 10):**
1. Work window "Idle" counts only working-age villagers (`idleCount()` filters `isAdult`).
2. `dailyDangerRoll()`: woodcutter/miner/hunter on the job — 0.005%/person/day fatal accident, with per-trade event text.
3. `mournFamilyOf()` on burial: spouse, parents, children, and siblings get `griefTimer = 1 season` → −20 happiness (shown as "🖤 in mourning" in the character window).
4. Feudalism tech (40 📖) gates Manor + stone wall/stone gate (village `isWallUnlocked` + Build-panel lock tooltips).
5. Manor completion → `crownFirstBaron()` (oldest adult man; family moves into the manor). Baron death → `succeedBaron()` (oldest male son, fallback oldest adult man). Baron shown with 👑 in the character window and a gold body in the world. Saved by villager index.
6. `src/data/maleNames.ts` + `femaleNames.ts` — exactly 1000 unique English names each (verified by script); `randomName(sex)` matches name to sex.
7. Farmer pacing retuned: sow 0.4/60 per cycle, summer rate needs tending (untended fields peak ~2/3), harvest 1/15 per trip at 4 crops (~60/field/autumn) — 1 farmer ≈ 1 field per season. Farmers with no field work thresh in the barn in ANY season; in winter always.
8. Female villagers render slimmer with long hair (third InstancedMesh, frustumCulled=false).
9. Religion tech (30 📖) → Temple (4×4, 8w+16s+6tiles): +10 happiness for up to 100 villagers per temple, refreshed daily.
10. Medicine tech (10 📖, req Herb lore). Herbalist gathers **herbs** (new resource; +50% with Herb lore) and brews 1 medicine from 2 herbs once researched. Illness: 10 days untreated with 1%/sick-day death; medicine (alone) or herbs (needs assigned herbalist) halve the remaining course and remove the death risk. Illness/grief now persisted in saves.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 25 — 2026-08-23 (Owner batch: wildlife, weaving, clothing tiers)

**Owner instructions (6 items):**
1. BUG: herbalist/forester can start working before their building is finished — must not happen.
2. Starting stock: 10 herbs, 20 wood, 10 stone, 20 straw, 20 firewood; all starting villagers wear basic clothes.
3. Rabbits + boars as game. Deer: 4 hides + 4 meat; rabbit: 1 fur + 1 meat; boar: 2 hides + 2 meat. Rabbits spawn near forests frequently up to a population cap. Boar packs bigger than deer packs. Deer/boar packs have young that yield half meat/hide.
4. Weaver: 2 straw → 1 string; 2 string → 1 linen.
5. Tailor tiers: basic clothing (1 linen), fine (2 linen + 2 hides, +10 happiness, better winter protection), luxury (2 linen + 2 hides + 2 fur, much better winter protection).
6. Fisherman: 4 string → 1 fishing net, his ultimate tool (+100% efficiency). Crafts one from string only when out of tools; without string he takes regular tools.

**Numbers Claude filled in (owner may override):** Weaver's cottage 2×2, 6 wood + 2 straw, 1 slot, no research needed; auto mode keeps a ~6-string buffer then weaves linen. Clothing happiness basic +5 / fine +10 / luxury +15; winter protection = extra freeze strikes basic +1 / fine +2 / luxury +4. Boar packs 7–11 (deer 4–6), caps deer 120 / boar 100 / rabbit 80; ~30% of new pack members are young, maturing in 2 seasons; rabbit spawner ticks every ~12 s near forest. Fishing net = tool tier at iron speed (200% of wooden). Tailor auto mode sews the best garment materials allow.

**Implemented (all 6):**
1. Herbalists and foresters are now bound to a COMPLETED hut with a free worker slot before any work starts (`findTargetTile` requires it and sets `v.site`; the herbalist forages the woods nearest the hut, the forester plants/fells around it).
2. Starting stock 20 wood / 10 stone / 20 straw / 10 herbs / 20 firewood; every starting villager wears basic clothes.
3. `animals.ts` reworked to three species (deer/boar/rabbit) with per-species packs, caps (120/100/80), speeds, and yields — deer 4 meat + 4 hides, boar 2+2, rabbit 1 meat + 1 fur (new resource); young animals (30% of new deer/boar pack members, mature in 2 seasons, drawn at 60% size) yield half. Rabbits spawn near forest every ~12 s below their cap. Renderer distinguishes species by scale/color; hunter takes the nearest game of any kind.
4. Weaver's cottage (2×2, 6 wood + 2 straw, 1 slot) + weaver profession: 2 straw → 1 string, 2 string → 1 linen; auto mode holds a ~6-string buffer for nets, or pin String/Linen on the building.
5. Tailor tiers: basic (1 linen, +5 happy, +1 freeze strike), fine (2 linen + 2 hides, +10 happy, +2), luxury (2 linen + 2 hides + 2 fur, +15 happy, +4). Villagers upgrade to the best garment in store; spring wear-out unchanged. Old saves: `hasClothes` → basic.
6. Fishermen out of tools knot a net from 4 string (200% efficiency, = iron speed); without string they take regular tools.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 26 — 2026-08-23 (Owner batch: demographics, job stability, straw economy, UI fixes)

**Owner instructions (8 items) and what was done:**
1. **Younger founders**: starting men 16–28 (median 22), women 17–25 (median 21). Birth chance now peaks by mother's age: ramp 16→20, full 20–30, fading to 0 at 50.
2. **School locked behind new Education research (30 📖)** — lock + tooltip in the build panel.
3. **Occupation stickiness**: workers never switch trades while theirs is within its limits; over quota/slots they are laid off into the unemployed pool, which alone fills new occupations. `countByProfession` now counts *employment* (a worker resting between trips keeps their slot); Idle row = unemployed working-age only.
4. **Pantry courtesy**: a household above half its food limit is only 25% willing to shop; below half, normal rules (stop at cap−4, always fetch at 0).
5. **Straw depletes**: a cut straw tile goes bare (tufts hidden via new `StrawView`) and regrows after 3 years; a second cutter arriving late gets half yield. Saved as `strawCut` list.
6. **Straw in building costs** (lodges, huts, toolmaker, storage shed, trading post, tailor +2–4 straw) and a **workshop refit**: 4 wood + 4 stone + 4 brick + 4 clay tiles → +20% worker productivity (button in the building window; brick chimney marks refitted shops; excluded: crop field, training ground, hunting lodge since hunters work afield).
7. **Hunter/fisher over-limit bug fixed**: the flapping came from counting only *non-idle* workers — the moment worker A rested, B was hired, so both showed up. Employment-based counts + lay-offs enforce desired counts and per-building "Workers allowed"; building windows now show the real per-building limit.
8. **Production mode buttons fixed**: the building window rebuilt its HTML every frame, so clicks landed on freshly replaced elements and were swallowed. It now re-renders only when content changes; mode switching (brick oven → clay tiles, toolmaker tiers, etc.) works.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 27 — 2026-08-23 (Owner batch: pottery, finite stone & clay, builder crews, info tooltips)

**Owner instructions (8 items):**
1. Pottery & potter — consumed by households; household with pottery +5 happiness, without −5; tradeable.
2. Destroy stones after they are collected.
3. Clay pits deplete after 1000 clay; clay in a 5-tile radius is consumed; warn in building info + event log; depleted pit works at 20% speed.
4. Add stone to some building costs; bricks & tiles to advanced buildings.
5. More builders on the same building = faster construction.
6. Builders should move around the building while constructing, not stand on a corner.
7. Clicking a person in the house window must open their info box.
8. "i" tooltip on the person window detailing what affects health and happiness.

**Numbers Claude filled in (owner may override):** Potter's workshop 2×2 (6 wood + 2 straw + 2 stone, 1 slot, needs Clay working); recipe 2 clay + 1 firewood → 2 pottery; a household keeps one pot which wears out in ~1 year and is replaced on grocery runs; pottery trade value 3. Stone tiles yield ONE harvest then are bare forever (no regrow). Builder crews: each extra builder on a site adds +15% synergy on top of their own work. Cost changes: toolmaker/storage shed/bakery +2 stone, trading post/barn +4 stone, smelter & weaponsmith +4 brick +4 clay tiles, bakery +4 clay tiles.

**Implemented (all 8):**
1. Pottery chain: Potter's workshop + potter profession (2 clay + 1 firewood → 2 pottery, needs Clay working); households fetch a pot on grocery runs, it wears out in ~1 year; happiness ±5 shown in the house window; pottery tradeable (value 3); potter rests once stock ≥ houses + 4.
2. Stone tiles are quarried bare: one harvest each, boulder visuals removed (`rocks` StrawView), late arrivals get half-yield rubble; persisted as `rocksCut`.
3. Clay pits track `clayTaken`; at 1000 the Clay tiles within 5 radius turn to grass (blocks future pits), an event fires, the pit info shows "Deposit left N / 1000" / "exhausted", and digging continues at ×0.2. Depletion replayed on load.
4. Costs: toolmaker/storage shed/bakery +2 stone, trading post/barn +4 stone, smelter & weaponsmith +4 brick +4 clay tiles, bakery +4 clay tiles.
5. Builder crews: parallel work already stacked; now each extra builder on the same site adds +15% synergy per man.
6. Builders roam the footprint while building/dismantling (new roam target every 2–5 s, walk at 1.1 t/s), stepping back to the entrance tile before pathfinding away (footprints are unwalkable).
7. House-occupant clicks were fixed by the session-26 render-diff (click delegation was losing targets to per-frame innerHTML rebuilds); wiring verified (`buildingInfo.onSelectVillager → characterPanel.open`).
8. Character window: ℹ️ tooltips on Health and Happiness itemizing every contribution (base, home, marriage, clothes tier, tool, diet variety, temple, pottery, hunger, cold, sickness, mourning / sick, hunger, cold, old age). CharacterPanel also re-renders only on change so tooltips don't flicker.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 28 — 2026-08-23 (Owner batch: storage logistics, forest clay ponds, click priority)

**Owner instructions:**
1. Person click-boxes are too big — can't click anything else near a person.
2. Random clay areas with unfishable shallows (no fishing buildings) scattered in forests.
3. Starting storage must be demolishable (option to demolish it).
4. Storage areas have their OWN inventory — no storing in one place and taking from another.
5. Demolishing a storage first empties it into another storage area.
6. Rename "Research" to "Knowledge".

**Design decisions (Claude, owner may override):** The starting stockpile becomes a real 3×3 'Camp stockpile' building (prebuilt, free) so it can be clicked and demolished like any other; the last remaining storage can never be demolished. Each storage keeps a ledger of its contents; villagers deposit into the storage they walk to and fetch only from storages that actually hold the item; workshop crafting/eating still draws on the village total, and a daily reconciliation keeps ledgers matched to it. Demolition of a storage transfers its goods to other storages (needs free space) before dismantling starts.

**Implemented (session 28):**
1. Villager click hitbox 1.6 → 0.55 tiles — buildings near people are clickable again; a person only wins a near-dead-on click.
2. `classifyTiles` carves ~30 forest clay ponds per map: 2×2 shallow water (new `tiles.shallow` flag) ringed by clay, banks blended; water BFS re-run after. Fishing huts now require NON-shallow water within 2 tiles (`hasFishableWaterNear`). Ponds show on the minimap and open clay digging deep in the woods.
3-6. Storage overhaul: the camp stockpile is a real prebuilt 3×3 'stockpile' building (clickable, demolishable; BuildingRenderer draws it; old `buildStockpileMesh` retired; old saves auto-migrate). Every storage keeps its OWN ledger (`Building.store`, persisted): deposits credit the storage walked to, builders/shoppers path to a storage that HOLDS the wanted goods and draw from its ledger (with a stale-ledger fallback so nothing deadlocks), crafting/meals use village totals and a daily `reconcileStorages()` trues everything up. Storage windows show their own inventory; the storage-fill crates now reflect each ledger. Demolishing a storage: refused for the last one; otherwise builders first transfer its goods to storages with room (warning if all full), then dismantle. Raids/armies rally at the stockpile entrance (home tile is under the platform now).
7. "Research" renamed to "Knowledge" (HUD button + window).

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 29 — 2026-08-23 (Owner batch: roads, clothing survival, firewood logistics, house tiers)

**Owner instructions (24 items, verbatim intent):** dirt road free +25% speed; stone road 1 stone +50%; clothing lifetimes basic 90 / fine 150 / luxury 240 days; ragged happiness −40 winter / −20 spring+autumn / −10 summer; ragged illness ×3 winter, ×2 autumn+spring; basic clothes neutral to illness, fine −25%, luxury −50%; stone houses burn 25% less firewood; firewood carried home from storage; school-age children not attending school do house chores (carry food & firewood); warm house +50% pregnancy chance, cold −50%; recipe tooltips in workshop screens; pantry capped at 50; pottery 10/house max (per-tier below), 1 consumed per season; bricks & tiles 2 clay each (already true); Pottery research 20 📖 gating the potter; rename Toolmaker's workshop → Workshop; ill villagers keep their job at 50% productivity; minimap shows buildings & roads and refreshes daily; house tiers — wooden 4 pop / 5 pottery / 10 firewood, stone +2 pop / +3 pottery / 16 firewood, brick +2 pop more / +2 pottery / 20 firewood; pregnancy only with house space (already enforced).

**Implemented (all 24):** two road tiers (dirt free ×1.25, stone 1 stone/tile ×1.5, dirt upgradeable in place, own dirt texture, saves split roads/stoneRoads); clothing wear timers 1800/3000/4800 s replacing the spring 25% roll (staggered on founders, persisted as `cw`); ragged seasonal happiness penalty (daily `raggedPenalty`) + illness multipliers (ragged ×3/×2, fine ×0.75, luxury ×0.5); ill villagers keep working at ×2 work time; stone house hearth interval ×4/3 (25% less wood); hearths burn `Building.firewoodStore` ONLY — firewood is hauled home on grocery runs (topping off the basket after food), caps 10/16/20 by house tier; pottery caps 5/8/10, consumed 1/season, fetched to cap; pantry hard cap 50; house capacities 4/6/8; pregnancy ×1.5 warm hearth / ×0.5 cold (space rule already existed); fertility peak curve retained; chore-duty children (school-age beyond school seats, assigned daily) run household errands; workshop mode buttons carry recipe tooltips; Pottery research (20 📖, req Clay working) gates the potter; toolmaker renamed "Workshop"; minimap binds the village, repaints every 10 s with roads (tan/grey), walls, buildings (parchment) and current tile state (depleted clay, cut straw, quarried rock).

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 30 — 2026-08-24 (Owner batch: shop shelves, leather & shoes, pantry statics, move-in grace)

**Owner instructions:** no building over roads/walls; tailor & Workshop always produce the best the materials allow; craftsmen stock output on their own shop shelves first (tailor ≤30 / ≤10 per kind, woodcutter's lodge 20 wood[=firewood], others at Claude's discretion); Tannery (leatherworker, must be near water) turns hides into leather — fine/luxury clothing now needs leather, basic from 1 hide OR 1 linen; new Knowledge: Leatherworking 10 (tannery), Looming & Weaving 10 (weaver's cottage), Cobbling 10 (cobbler); cobbler shoes — sandals 1 string+1 straw / 90 days, hide shoes 1 hide / +5 😊 / 120 d, boots 1 leather / +10 😊 / 180 d, luxury boots 1 leather+1 fur / 240 d (Claude set +15 😊); no shoes = −10% walking speed and −5 happiness, sandals neutral; house pantry limit shown as a static 50 with the dynamic limit hidden underneath (lowest applies) and a guaranteed minimum want of 10 food; moving into a house grants a 2-day grace before its cold/hunger states apply.

**Implemented (session 30):** canPlace rejects footprints over roads, walls, and pending road/wall jobs; tailor & Workshop auto modes confirmed best-first (and cobbler follows suit); shop shelves — SHOP_STORE_CAPS (lodge 20, workshop 12/6, weaver 20/10, tailor 30/10, pottery 12, bakery 15, brick oven 24/12, smelter & weaponsmith 10/5, tannery 20, cobbler 20/10, herbalist 10/5), craftsmen `shopStash` output at their shop (still village-owned; reconcile counts shelves; consumption drains storages then shelves), building windows show the shelf; Tannery (needsWater) + leatherworker (2 hides → 2 leather) behind Leatherworking 10; tailor fine/luxury now need LEATHER, basic takes 1 linen OR 1 hide; weaver gated behind Looming & weaving 10; Cobbler behind Cobbling 10 with four shoe tiers (sandals 90 d, hide +5 😊 120 d, boots +10 😊 180 d, luxury boots +15 😊 240 d), villagers lace up the best pair in store, barefoot = −10% speed −5 😊 (shoes shown in the character window and in the ℹ️ breakdown, persisted in saves); pantry UI shows the static 50 while the hidden dynamic limit applies underneath, min-want 10 keeps hungry households shopping; 2-day move-in grace (no cold strikes, central-storage meals) for freshly occupied houses.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 31 — 2026-08-24 (Bug fix: runaway cold happiness)

**Owner report:** children (then confirmed: adults too) showing "cold −90" happiness while housed, fed, with firewood at home.

**Root cause:** cold strikes could only be cleared when a house's fire actually burned a log — and in SUMMER the hearth logic skipped houses entirely, resetting the house's counter but never the occupants'. Anyone who picked up strikes (typically newborns/movers at the campfire while central firewood was empty, where strikes also grew without limit outside winter) kept them frozen all summer: 9 stale strikes = −90.

**Fixes:** summer pass clears all occupants' cold strikes; cold strikes are capped at 6 (MAX_COLD_STRIKES) everywhere; moving into any house sheds previous strikes. Also per owner's follow-up: a newly BUILT house starts with the 2-day warmth grace (in addition to the first-move-in grace), then goes cold if no firewood was carried in.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 32 — 2026-08-24 (Bug fixes: marriage, stuck villagers, dismantling)

**Owner reports & fixes:**
1. Odd-age marriages → matchmaking now pairs each bachelor with the CLOSEST-aged eligible woman, hard-capped at a 10-year gap (both directions).
2. Singles cohabiting 2 years unwed despite empty houses → the old 1%/2% random rules replaced by one daily matchmaking pass: each bachelor 4%/day, one wedding a day max; newlyweds take an empty house that fits, else move into either partner's home. Cohabit rule folded in (housemates are each other's closest match).
3. Grown child (11-12) stayed unemployed → root cause: villagers standing on UNWALKABLE tiles (e.g. born inside a construction site while their builder mother roamed the footprint) fail every pathfind silently. New `unstick()` steps them to the nearest open tile whenever they idle.
4. Dismantling looped forever ("goes to the corner, waits, 'going to work' flashes") → `builderArrived` treated the (complete) demolition target as a finished job and sent the builder home; now completeness only ends the trip when the building is NOT marked for demolition.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 33 - 2026-08-24 (Trade research, blocked storage corner, pregnancy table)

**Owner instructions:**
1. Make trade researchable (30 points).
2. Bug: a tree stood at the gathering corner of the storage and a builder was stuck getting materials.
3. Simulate and show pregnancy chances per year as a table.

**Implemented:**
1. **Trade research** (🤝 30 📖) — the trading post is now gated behind it (`isBuildingUnlocked`, build-menu lock tooltip). Caravans only ever visit a completed trading post, so trade as a whole is research-gated. Existing saves keep any already-built post.
2. **Gathering-corner fix** — trees never blocked walkability, so the tree the owner saw stood ON the storage's entrance tile while the real stall was a stale/blocked entrance. Three-part fix: (a) `entranceOf(b)` — every path to a building's entrance now verifies the tile, fells any tree standing on it, and RE-PICKS a walkable perimeter tile if a later wall/building covered it (self-heals old saves); (b) placement & load clear trees off the entrance tile (`flattenAndClear`, `reclearFootprints`); (c) foresters never plant on any building's entrance tile.
3. **Pregnancy table** — Monte-Carlo of the live formula (1%/day × age fertility × hearth ×1.5/×0.5, 45-day term, 60-day year) delivered to the owner; peak years 20–30: ~60% chance/year warm, ~0.54 births/year sustained.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 34 - 2026-08-24 (Owner batch: perimeter logistics, cobbler shelf, window positions)

**Owner instructions:**
1. Materials should be picked up from ANYWHERE around storages (including the starting storage), not one corner.
2. Materials should be delivered anywhere around build zones.
3. Cobbler seemed to keep goods on his shelf instead of delivering to storage - people took shoes from there? (investigate/confirm)
4. Window positions (Town info, Resources, etc.) are not remembered - they should persist so the owner does not have to re-drag them every time.

**Implemented:**
1+2. New `pathToBuilding()` — trips to storages (drop-offs AND pickups, groceries included) and to build sites now target the closest reachable tile ANYWHERE around the footprint instead of the single entrance corner; `stepOffSite` steps builders out on the nearest open side. Deposits/pickups already credit/draw the nearest storage's ledger, so the per-storage economy is unaffected. Entrance tiles remain for houses, workplaces, rally, and caravans.
3. Cobbler shelf: confirmed WORKING AS DESIGNED (owner's session-30 shelf rule) — shoes are equipped from village totals, shelf goods count in the totals, and the daily reconcile drains the biggest holder (the shelf) first, so people effectively buy off the shelf; the cobbler only hauls when the shelf (20 total / 10 per kind) is full. Explained to owner; stale comment in reconcileStorages corrected.
4. Window layout persistence via localStorage ('northreach-windows'): every UI window remembers its dragged position, and the eight town windows (Town info, Resources, Workers, Build, Knowledge, Tribes, Chronicle, Save & Load) also remember open/closed and reopen on page load. Villager/Building windows keep only their position (they open on selection). Lives in the browser, so it applies across all saves.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 35 - 2026-08-24 (Graphics upgrade: Kenney asset pack analysis)

**Owner instructions:**
1. Building & road graphics are bad and should be upgraded (environment is fine for now).
2. Analyze `C:\Users\geylan.selcuk\Desktop\Kadir\Temp\kenney-assets` and check whether those models can be used. NOTE: this supersedes the earlier "all 3D assets built by Claude in code" rule for buildings/roads — external Kenney models are now allowed if suitable.

**Analysis result:** 10 Kenney packs, all CC0 (free, no attribution needed), all with GLB files ready for three.js GLTFLoader.
- **Fantasy Town Kit 2.0 is the winner** — 168 modular medieval pieces, EXACTLY 1×1-unit tile scale matching our grid, one shared texture per kit (instancing-friendly), tiny (2.9 MB total). Full road tile set (straight/corner/bend/curb/edge/slope) replaces the flat textured quads; walls/roofs/doors/windows/props (windmill, watermill, carts, stalls, fountains) can compose our ~30 building kinds.
- Useful extras: mini-forest (tents/rocks, early-game camp), watercraft-pack (boats for fishing later), furniture-kit (interiors, someday).
- Not relevant: mini-market & food-kit (modern supermarket), mini-dungeon, pirate-kit, building-kit (2×2.4 wall scale, style mismatch), prototype-kit.

**Owner approved; implemented same session:**
1. **Assets:** all 168 kit GLBs + `Textures/colormap.png` copied to `public/models/fantasy-town/` (2.9 MB, license included). Gotcha discovered: the GLBs are NOT self-contained — they reference the external colormap, which must ship alongside or everything renders white.
2. **`src/render/kit.ts`** (new): async GLB loader with Lambert material conversion (matches scene lighting), piece cache, and prefab helpers. Kit conventions decoded from vertex data: wall pieces are 0.1-thick panels on a tile's +X edge with the decorated face at x=0.4 pointing inward (placeEdgePiece rotates/offsets them face-out, flush with the footprint edge); roof pieces are 1-tile slopes (eave −X with overhang, ridge +X) scaled across the short axis so wider buildings get taller roofs, with custom wall-tone gable triangles filling the open ends; `kitHouse` composes walls (door/shuttered-window/plain panels), stories, and gable/pyramid/high roofs.
3. **RoadRenderer** rewritten: stone roads are auto-tiled kit road tiles via three InstancedMeshes — plain pavement inside, `road-edge` (raised curb band) where one side faces grass, `road-corner` (rounded) on outer bends; 2-wide avenues get sidewalk-like curbs both sides, plazas get full curbed boundaries. Dirt roads keep the trodden-earth quads; procedural cobble quads remain as pre-load fallback.
4. **BuildingRenderer**: ~24 building kinds rebuilt as kit compositions (houses, workshops, barn, school with fenced garden, trading post with market stall + cart, 2-story watchtower with banner + slate pyramid roof, 2-story manor with steep roof + banners + lantern, temple on plinth with stone pillars + tall red roof). House roofs vary per instance (teal/red/green by position hash); brick houses get terracotta-tinted walls + red roof + kit chimney; upgraded workshops get the kit chimney. Identity props (log piles, anvils, ovens, drying racks…) kept as primitives, moved to building fronts. Pits/kilns/mounds/fields/stockpile stay all-primitive. Primitives remain the fallback until the kit loads, then everything rebuilds.
5. **`showcase.html` + `src/showcase.ts`** (new dev tool): http://localhost:5180/showcase.html renders every building kind + a road network (plaza, 2-wide avenue, 1-wide path, dirt path) on flat ground, no sim — camera via `?x=&z=&zoom=`. Verified via headless-Edge screenshots.
6. Docs updated: CLAUDE.md + GAME_VISION.md art-direction rule now records the Kenney kit decision.

**State at end of session:** `tsc` + `npm run build` pass, live at http://localhost:5180 (showcase at /showcase.html).

---

## Session 36 - 2026-08-24 (Graphics round 2: material textures, crafter yards, reeds)

**Owner instructions:**
1. Straw roofs must be yellow with a straw texture; clay-tile roofs get a red-brownish tile texture.
2. Walls must show their material: wood texture on wooden buildings, stone on stone, brick on brick.
3. Crafters (pottery, cobbler, tailor, weaver, tannery) become **4×2**: a 2×2 house + a 2×2 open workshop with the craft's tools and a stall facing the long edge.
4. Straw tufts are no longer cones — thin cylinders with rounded brown tops, like reeds (cattails).

**Implemented:**
1+2. Procedural canvas textures in `kit.ts` (straw thatch, clay tiles, wood planks, stone courses, brick courses) applied via **box-projected UVs** (`kitPatternedMesh`) because kit UVs point at palette cells. Plain wall panels carry the pattern; decorated panels (doors/windows) keep kit trim; gable triangles match the wall pattern. Roof material now follows build cost: straw-cost housing (house, barn, trading post, weaver, storage shed, crafter canopies) = thatch; clayTiles-cost buildings (brick house, school, bakery, weaponsmith, manor, temple) = clay tiles; stone house keeps slate, colored workshop roofs keep their identity colors.
3. Specs changed to w:4,d:2 in `buildings.ts` for pottery/weaver/leatherworker/cobbler/tailor (NOTE: existing saves keep the old center — the wider footprint may overlap neighbors on old saves). New `crafterYard()` prefab in BuildingRenderer: west 2×2 dwelling, east open workshop (4 kit posts + straw canopy), kit `stall` counter on the south edge with goods on it (pots, boots, cloth bolt), craft tools under the canopy.
4. `makeReedGeometry()` in worldScene: two cattail reeds per tuft (thin tapered stalks + rounded brown capsule heads) with per-vertex colors; local `mergeGeometries` extended to carry color attributes; instance jitter kept via near-white instance colors.

**State at end of session:** `tsc` + `npm run build` pass, live at http://localhost:5180 (showcase at /showcase.html). Verified by headless-Edge screenshots: brick/stone/plank walls, thatch + tile roofs, crafter yards with stalls, reeds by the lakes.

---

## Session 37 - 2026-08-24 (Graphics round 3: owner feedback on materials)

**Owner instructions (all implemented):**
1. Crafter open workshops must have NO roof → canopy removed; the open yard keeps a rear work frame (two posts + crossbeam) that the craft's hanging tools (hide, cloth, warping threads) attach to, plus the stall.
2. Wood houses: vertical pattern, logs not planks → wood wall texture redrawn as vertical round logs (cylindrical shading per log, groove between logs).
3. Stone houses: stone tile roof → new `stoneTile` pattern (grey slate courses), replacing the flat slate color.
4. Stone wall pattern felt wrong → redrawn as irregular rubble masonry: uneven course heights, varied stone widths, jittered outlines, occasional warm-toned stones, top-light bevel.
5. Main storage (stockpile) gets a straw roof → kit-composed stockpile: plank deck + corner posts + straw gable roof at y=1.3 (clears the 2-layer goods stack, which now sits ON the deck — StorageFillRenderer lifts raised: stockpile 0.56, sheds 0.3).
6. Storage sheds get a wooden plank floor → new `planks` pattern (boards with staggered end joints), used for the shed floor AND the stockpile deck; `patternedBox()` helper added in kit.ts for world-scaled pattern boxes.

**State at end of session:** `tsc` + `npm run build` pass, live at http://localhost:5180 (showcase at /showcase.html). Screenshot-verified: slate-tiled stone house, log walls, roofless crafter yards, thatched stockpile/shed with plank floors.

---

## Session 38 - 2026-08-24 (Graphics round 4 + building rotation)

**Owner instructions (all implemented):**
1. **R rotates buildings while placing.** `Building.rot` (0..3 quarter turns) + `specFor(kind, rot)` (cached w/d-swapped spec clones, so all sim footprint code works unchanged); canPlace/placeBuilding/restoreBuilding/upgradeHouse take rot; saved per building (`rot` in save data, old saves default 0); renderer composes buildings for the BASE footprint and turns the finished group by −rot·90°.
2. **Roads no longer stair-step on slopes** — every road tile (stone, dirt, fallback) is tilted to the plane through its four corner heights, positioned at their average, and oversized 4% to close corner cracks (`conformTile` in RoadRenderer).
3. **Forester 4×2**: hut west + fenced sapling garden east. 4. **Herbalist 4×2**: hut + herb bed, cauldron on a fire ring, work table. 5. **Hunter 4×2**: straw-roofed hut + fenced skinning yard (rack with stretched hide, table with a skin). 6. **Fisher 4×2**: straw-roofed hut + plank dock on posts; placement requires the DOCK side (rotates with R) to reach open water — hint explains when it doesn't.
7. Stone texture lighter with ~12% near-black stones; stone-tile roof darker.
8. Craftsmen (5 crafter yards + toolmaker) roofs: straw normally, clay tile once the workshop is upgraded.
9. Per-building shade variants: 5 quantized tints (VARIANT_TINTS in kit.ts) applied to pattern materials and flat roof colors via a position hash — neighbours no longer look like clones.
10. Log pattern is horizontal now (was vertical).
11. Floating goods at storages fixed — the goods box geometry is bottom-anchored, so the lifts are surface heights: stockpile deck 0.36, shed floor 0.1.
12. Door/window wall panels now carry the wall pattern on their slab: kit palette UVs are classified per triangle against the plain wall's dominant palette color (`kitWallPieceMesh` — pattern on the slab via box UVs, kit trim kept on a second UV channel/material group).

**Owner batch mid-session (all implemented):**
13. Dwellings (house/stone/brick) are 20% smaller, centered in their plot, with 2–3 random props around them (kit rocks/lanterns, barrels, log piles, crates, bushes — position-hashed).
14. Houses have random roofs (thatch / kit shingles / green / brown by hash) and every dwelling got a chimney: it **smokes when the home has firewood and the season isn't summer** (3 animated puffs; season+time passed into BuildingRenderer.update from main).
15. Placement ghost is now the REAL building, semi-transparent (buildBuildingPreview + cloned faded materials), over a green/red validity plate; rebuilt when the kit finishes loading; rotates with R.

**State at end of session:** `tsc` + `npm run build` pass, live at http://localhost:5180 (showcase at /showcase.html, incl. two rotated examples at x≈226). Screenshot-verified.

---

## Session 39 - 2026-08-24 (Graphics round 5: straw houses, woodcutter yard, doors, platforms)

**Owner instructions (all implemented):**
1. All plain houses wear straw (the random teal/green/brown roof pick removed; stone house keeps stone tile, brick house clay tile).
2. **Woodcutter 4×2** (spec was 3×3): straw-roofed hut west + fenced log yard east with woodpile, stump, and an axe buried in the stump.
3. **Closed doors + platforms.** The kit's own door leaf is wood-toned and vanished against the wall patterns, so every doorway now gets an explicit dark closed door (panel + rounded top + braces + knob, `doorLeaf()` in kit.ts); palette classification tolerance also tightened 24→8. Dwellings stand on a full-plot platform matching their material: plank platform for wood houses, stone for stone AND brick/tile houses; props and smoke raised accordingly.
4. House clutter is now everyday objects: kit stall-bench and stall-stool, hay piles, barrels, firewood piles, crates, lanterns (rocks/bushes removed).

**State at end of session:** `tsc` + `npm run build` pass, live at http://localhost:5180 (showcase at /showcase.html). Screenshot-verified: closed doors on all houses, straw roofs everywhere on plain houses, woodcutter yard with axe-in-stump, platforms with benches/hay.

---

## Session 40 - 2026-08-24 (Fishing hut dock placement over water)

**Owner instruction:** the fishing hut must be buildable only when the DOCK half touches water and the HUT half is on ground — previously any water tile in the footprint made it unbuildable.

**Implemented (canPlace/flatten/remove in village.ts):**
1. The dock half's tiles (local +X half, rotation-aware via `isDockTile`) may be Water: they skip the land/walkability/road checks; overlap with other buildings on water is guarded via `containsTile` (water is never "walkable" so the normal occupancy check can't see it).
2. Placement requires `dockTouchesWater`: a dock tile IS water, or a land dock tile borders water on any side. The hut half obeys all normal land rules, and the generic fishable-water-within-2 rule stays.
3. `flattenAndClear` levels only the hut half for fishing huts — the shore/lakebed under the dock keeps its shape.
4. `removeBuilding` restores walkability from the tile type, so water under a demolished dock stays unwalkable.

**State at end of session:** `tsc` + `npm run build` pass, live at http://localhost:5180.

---

## Session 42 - 2026-08-24 (Graphics round 7: shop platforms, house yards, oven & clay pit yards)

**Owner instructions (all implemented):**
1. **Brick oven 4×2** (spec was 2×2): brickmaker's hut west (platformed, straw→clay-tile on upgrade), kiln yard east with the dome 30% smaller plus fired-brick stacks.
2. Herbalist roof darkened (0x3a5f3c).
3. **All shop huts 20% smaller on a material platform** like houses (`shopHut()` helper): crafters, woodcutter, hunter, forester, fisher, herbalist, toolmaker, weaponsmith (stone), bakery, brick oven.
4. No more street lights at houses (lantern removed from the prop pool).
5. Houses pushed back in their plot (~5% back / 15% front margins); 1–2 everyday objects stand on the FRONT yard beside the door (never blocking it, hash-jittered positions instead of fixed corners).
6. **Clay pit 5×3** (mid-session addition; spec was 3×3): the 3×3 digging pit west, hand cart + stacked clay slabs + shovel stuck in the ground on the eastern strip.

**State at end of session:** `tsc` + `npm run build` pass, live at http://localhost:5180. Screenshot-verified. - 2026-08-24 (Graphics round 6: brick oven, chimneys, stall, wall gaps, entrance arrow)

**Owner instructions (all implemented):**
1. **Brick oven** rebuilt: brick-patterned dome on a stone base, brick flue, dark mouth, and two fired-brick stacks (large + small) stored beside it.
2. **House chimneys** fixed: shortened (0.75×), patterned to match the walls (brick chimney on brick houses, stone otherwise), and re-centered — the kit chimney's body is offset ~0.32 from its origin, which is why smoke rose "over the roof" instead of from the flue. Smoke now aligns with the chimney top (CHIMNEY_POS in kit.ts, SMOKE_POS recomputed).
3. **Trading post stall** awning re-covered in dark-yellow thatch to match the hall: palette classification against `banner-green` (whose dominant color IS the awning green) patterns exactly the green triangles; frame keeps kit wood.
4. **Wall pattern gaps above doors/windows** fixed: the kit palette cells are gradients, so the slab match now accepts ALL significant shades of the plain wall piece (`pieceBaseColors`, ≥8% area, top 3) instead of only the dominant one.
5. **Entrance arrow while placing**: the ghost shows a yellow arrow pointing at the building's main door (south side in local space, turns with R).

**State at end of session:** `tsc` + `npm run build` pass, live at http://localhost:5180.

---

## Session 43 - 2026-08-24 (Meadow patchwork + house-yard overlap fix)

**Owner instructions (all implemented):**
1. Grass environment visual complexity: two extra noise layers on the terrain vertex colors — mid-scale (/17, 3 octaves) patches lerping toward lush-dark (0x40522f) and sun-bleached-light (0x74814b) greens, plus a fine per-vertex brightness shimmer (/4.5, +-4.5%). Applied before the rock/snow lerps; SeasonVisuals snapshots base colors at startup so snow blending still works.
2. House front-yard objects no longer overlap the house/door/each other: yard strip moved fully in front of the house face (z 0.79-0.87), door corridor |x|<~0.35 kept clear, two objects forced to OPPOSITE sides, rotations constrained to +-0.4 rad, props scaled x0.8.

(Note: session 42's entry was accidentally inserted above session 41 in this file — content is complete, order is off by one.)

**State at end of session:** `tsc` + `npm run build` pass, live at http://localhost:5180. Screenshot-verified.

---

## Session 44 - 2026-08-24 (Dark stone platforms + dark wood props)

**Owner instructions (all implemented):**
1. Stone platforms under houses are dark stone: new 'darkStone' pattern (makeStoneTexture now takes a brightness level; 0.55 for pavement) used for the stone/brick house platforms and the weaponsmith's platform.
2. Kit wooden props (bench, stool, stall counter, carts) no longer pinkish: multiplied down to one of four random dark wood tones per prop (DARK_WOOD_TINTS via kitTinted).

**State at end of session:** `tsc` + `npm run build` pass, live at http://localhost:5180. Screenshot-verified.

---

## Session 45 - 2026-08-24 (Visual style guide)

**Owner instruction:** save all graphics rules from sessions 35-44 as a .md instruction file to be consulted whenever creating a new building or visual element.

**Implemented:** `docs/VISUAL_STYLE_GUIDE.md` — assets/pipeline (Kenney kit, colormap gotcha, box-projected patterns, palette classification), material table (which pattern for what; roof-follows-cost; upgrade straw->clayTile; dark wood props; shade variants), building layout formulas (dwellings on platforms with front yards; hut+yard workshops; fisher dock rule; identity props), placement/interaction (R rotation, real ghost, entrance arrow), roads/environment (auto-tiling + slope conform, reeds, meadow patchwork), and the verification workflow (tsc/build, showcase.html, headless-Edge screenshots). Added to CLAUDE.md's session-start reading list as MANDATORY before building/visual work.

**State at end of session:** live at http://localhost:5180.

---

## Session 35 - 2026-08-24 (Bug fix: village-wide "Fetching materials" freeze)

**Owner report:** after building a second pottery, EVERY villager flashes "fetching material" for a split second, then rests - forever.

**Root cause:** the idle loop runs "groceries before work" every ~2 s. With a potter stocking his shop shelf, `resources.pottery >= 1` while NO storage ledger holds a pot (shelf goods count in the total only; the reconcile drains the biggest holder - the shelf - so ledgers sit at 0). Every household below its pottery cap therefore "needed a pot", started a shopping trip, and the pot line in `foodPickup` - unlike food, which has a stale-ledger fallback - REQUIRED the depot's own ledger to hold one. Every trip came home empty, retried 2 s later, and `startJob` was never reached: the whole village looped Fetching->Resting.

**Fixes:** (1) the pot now uses the same fallback as food - taken from the village total, depot ledger clamped at 0, reconcile trues the shelf up; (2) new `nextShopTry` cooldown - any empty-handed shopping trip pauses that villager's shopping for a full day, so no future want-mismatch can ever crowd out job-taking again.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 36 - 2026-08-24 (Workers window explains why nobody works)

**Owner report:** assigned farmers and a leatherworker - none work.

**Diagnosis:** not a regression - the "rest when there is nothing to do" hiring gates were blocking silently. Farmers only take the field when the season offers work (spring sowing needs 2 SEEDS - sold only by caravans, which now require Trade research; summer needs a growing crop; autumn something to harvest; winter/free time a barn plus 2 grain). Leatherworkers need 2 hides in store (and rest at 24+ leather). The Workers window gave no hint.

**Implemented:** new `Village.hiringBlockReason(prof)` mirrors every startJob gate (farmer seasons/seeds, leatherworker hides, baker, smelter, tailor, weaver, cobbler, potter, toolmaker, brickmaker, firewood, forager-winter, weaponsmith); the Workers window now shows an orange "paused" note on any assigned profession, e.g. "no seeds - caravans sell them", "needs 2 hides - hunters bring them".

**State at end of session:** Build passes, live at http://localhost:5180.

**Follow-up (same session):** owner has 80+ leather - the tannery's hard "rest at 24 leather" cap (Claude's arbitrary number from s30) was the blocker and would never clear. Replaced it: NO cap on leather output (player staffed the shop; surplus is tradeable), the tannery instead keeps a 4-hide reserve untouched for the tailor/cobbler/weaponsmith - it works whenever hides >= 6 and the Workers note reads "needs 6 hides (4 stay in reserve)". Gate updated in startJob, hiringBlockReason, and applyWorkEffect. Build passes, live at http://localhost:5180.

**Correction from owner:** it was 80+ HIDES (no leather) - so even the old material gate passed and the real blocker was the last silent step in hiring: the pathfind to the workplace entrance. The tannery stands at the waterline; its single entrance tile (picked at placement) can sit on a cut-off strip of bank - walkable but unreachable - and `startJob` just `continue`d on a failed path, forever and invisibly. Fix: when the path to a workplace entrance fails, hiring falls back to `pathToBuilding` (any reachable perimeter tile). Fishing huts shared the same risk. The hide-reserve rework from the previous entry stands. Build passes, live at http://localhost:5180.

---

## Session 37 - 2026-08-24 (Owner batch: UI scales with the player window)

**Owner instruction:** adjust all menus and texts according to the player's window size - one menu should be 12.5% of the total window size.

**Implemented:** CSS scale unit on :root - `--menu-w: clamp(200px, 12.5vw, 520px)` and `--u: calc(--menu-w / 260)` (1u = 1px at the old 260px design width). EVERY UI size in index.html now rides `--u`: window fonts/padding/radii, HUD, tech info, tooltips, place-hint, events feed, minimap (220u square), storage bars, tribe dots. UIWindow widths become `calc(var(--u) * width)` so the standard 260-design window is exactly 12.5% of the viewport and wider ones (Build 310, Tribes 330) keep their ratio; cascade offsets scale too. JS inline px converted (worker counters, trade amount input, canvas radius, shelf note); all 12 inline SVG icons converted from fixed width/height attributes to `--u`-based CSS so they scale with the text (done via Node script - PowerShell rewrite ban respected). Clamp keeps sub-1600px and ultrawide screens readable. Saved window positions still restore in px and clamp to the viewport.

**State at end of session:** Build passes, live at http://localhost:5180.

**Follow-up (same session):** owner tuned the menu ratio down - standard menu is now 10% of the window width (`--menu-w: clamp(190px, 10vw, 460px)`); everything else scales from it unchanged. Build passes, live at http://localhost:5180.

---

## Session 38 - 2026-08-24 (Owner batch: save/load keeps full state)

**Owner instructions:** saves should keep more state - hunted animals regenerate on load and all villagers are idled. Keep everything needed as state and continue exactly from where the game was left.

**Implemented:**
1. **Wildlife saved exactly** - `animalsList` records every living animal (species, position, pack anchor, young flag); `AnimalSystem.restoreExact()` puts each one back in place on load. Head counts kept as the legacy path for old saves.
2. **Professions saved** - the root cause of "all villagers idled": `profession` was never in the save, so everyone lost their trade. Now `prof` persists and occupation stickiness re-hires each worker into their own trade (from their saved position) within seconds of loading.
3. **Mid-haul loads saved** - `carry` {kind, amount} persists; after roads/walls restore, carriers path straight to a storage and deliver (goods in hand are no longer lost).
4. Also now persisted: villager cold strikes; house warmth (graceTimer, hearth warmTimer, house cold strikes) and pottery wear timer; village stats (births/deaths) and the full Chronicle history graph. All fields optional - old saves still load.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 39 - 2026-08-24 (Owner batch: day/night cycle, soft map edges)

**Owner instructions:**
1. Day & night cycle with sun & moon rising and setting. ONE day and ONE night per season; split depends on season - summer 10 days light / 5 days night, spring 9/6, autumn 8/7, winter 7/8 (of the 15-day season).
2. Map limits should not feel like a hard cut - edges gradually disappear: map 550x550 with only the central 512x512 playable.

**Implemented:**
1. **DayNight** (src/render/DayNight.ts): LIGHT_SHARE per season (10/15, 9/15, 8/15, 7/15). One sunrise->sunset arc spans the whole light phase, one moon arc the night. Sun: east->west sweep, warm color near the horizon, intensity/hemisphere follow elevation; visible sun disc. Night: dim bluish moon light + moon disc, hemisphere 0.22. Sky/fog/background blend day-dawn-night continuously (dawn glow bleeds into the night edges so there is no color pop). Purely visual - the sim is untouched. buildWorldScene exposes sun+hemi via visualRefs.
2. **EdgeSkirt** (worldScene): the world draws 550x550 - a 19-tile rim ring (2-tile cells) continues the edge terrain heights, smoothstep-sinking to below water level and blending vertex colors into the fog color. refresh() re-samples the terrain's live vertex colors 4x/s so the rim follows snow repaints AND day/night fog. Water plane widened to cover the rim. Playable area, camera bounds, and sim stay 512x512.

**State at end of session:** Build passes, live at http://localhost:5180.

---

## Session 40 - 2026-08-24 (Owner batch: night lights & torches)

**Owner instructions:** at night, add light sources inside houses and shops; in late night randomly remove the lights; villagers carry torches at night. Owner asked whether this creates performance issues.

**Implemented:** NightLights (src/render/NightLights.ts) - NO real dynamic lights (hundreds of PointLights would cripple the forward renderer). Three InstancedMeshes: warm lantern cubes at each occupied house/shop door, additive light pools on the ground beneath them, and hand torch flames on every villager out at night (babies excluded, interpolated positions, flicker via instance scale). Late night: each building has a stable random bed-time (shops from night-t 0.45-0.80, homes 0.55-0.90, hashed from the entrance tile) after which its light winks out. DayNight exposes `night {active, t}`. Cost: 3 draw calls, zero extra shading - no performance concern.

**State at end of session:** Build passes, live at http://localhost:5180.

**Follow-up (session 41, same day):** torches remade as real torches - long wooden shaft (Lambert, tilted in the hand) with a cone flame on the tip; building lights moved INTO the doorway at floor height (positioned from the entrance tile toward the building center, straddling the wall - never hovering above the roof); temple + trading post now also light up at night; the gold sphere finial on both temple variants (the "yellow ball above the church") removed. Still zero real dynamic lights - 4 instanced draw calls. Build passes, live at http://localhost:5180.

---

## Session 46 — 2026-08-25 (Design doc: full skill & knowledge tree to the 1600s)

**Owner instruction (recorded verbatim intent):** the owner is *thinking about* converting the game into a more **research & knowledge based game** — the tribe would start from nothing and discover everything on the way. Claude was asked to produce a **detailed treeview of the skills & knowledge humanity learned up to the 1600s** as an .md file. **Explicitly: do NOT change anything in the game yet.** This is exploration, not a decision.

**Delivered:** [SKILL_TREE.md](SKILL_TREE.md) — ~330 nodes across 11 branches (Survival & Food, Agriculture & Husbandry, Crafts & Materials, Mining & Metallurgy, Construction & Engineering, Machines & Power, Transport & Navigation, Language/Knowledge/Science, Medicine, Warfare, Society/Economy/Governance), each node tagged with an era tier T0–T6 (Paleolithic → Renaissance/Discovery, cap ~1650) and cross-branch prerequisites; ⭐ marks era-gateway techs; includes a single-spine "main quest" summary and 6 discussion points for the conversion (target size 80–150 nodes, discovery-by-doing vs KP-purchase vs hybrid, era gates, fit with the existing 15 in-game techs, northern-climate emphasis, out-of-scope items).

**No game code touched.**

**Next steps:**
1. Owner reads SKILL_TREE.md and decides: convert to research-driven design or not.
2. If yes → answer the discussion points at the bottom of SKILL_TREE.md (especially the discovery model), then prune the tree together to a playable size before any implementation.

---

## Session 47 — 2026-08-25 (Owner direction: tech-tree foundation approved, game tone defined)

**Owner instructions (all recorded, NOTHING implemented):**
1. **Build freeze**: do not build anything until the owner explicitly says it is OK to go. (Recorded in CLAUDE.md + GAME_VISION.md.)
2. **Tech tree later**: SKILL_TREE.md looks nice as the **foundation** for the future tech tree.
3. Owner renamed tiers in SKILL_TREE.md directly (**T0 = "Hello World!"**, T3 "Civilization!", T4 "Classical World", T5 "Medieval World"); Claude propagated the names through the era-ladder diagram.
4. **Game tone (standing rule)**: all game text — explanations, buildings, etc. — must be **humorous & black-humorous, almost insulting to the player**. The aim is NOT insult: the player should think "the more they face their ancestral instincts, the more they get away from the virtues of humanity and become no different from animals." Recorded in GAME_VISION.md §Tone & Writing + CLAUDE.md working rules.
5. **T0 introduction written** into SKILL_TREE.md as the definition of the first stage — 3 paragraphs in the new voice, starting exactly as the owner dictated: "Hello World! / Human is a rational animal, says Aristo. You are not there yet..." (little more than a group of animals; eat, sleep, survive slightly smarter than the wolves; develop or be scavenged by other animals... much like yourself).

**No game code touched.** Dev server still live at http://localhost:5180.

**Next steps:**
1. Owner reviews the T0 intro voice — it calibrates ALL future in-game text.
2. When owner says "OK to go": prune SKILL_TREE.md to a playable tech tree together (discussion points at its bottom: node count, discovery model, era gates), then plan the conversion.

**Addendum 1 (same day):** Owner renamed **T1 to "Bloody Roots"** and asked for its era introduction in the same voice — angle: the player is proud of the ancestors' survival skills, but there is nothing to be proud of; yes it was hard, but they were still wild. Written into SKILL_TREE.md (§ T1 — Bloody Roots): legends vs. reality (a career in droppings), difficulty ≠ virtue (the salmon/bear comparison), and the skills being sharper ways to kill — "the wolf's trick, minus the fur." Tier renamed in the table + era ladder. Era intros are now jointly the tone reference.

**Addendum 2 (same day):** Owner picked **"Domesticated"** for T2 from a 20-name list, with the angle: not the animals — you tamed *yourself* and settled in; houses, professions, families now possible; "officially promoted from ape to primate." Era intro written into SKILL_TREE.md (§ T2 — Domesticated): the sheep barely noticed, the tamed animal is you; the perks (a door as "a wall's way of pretending you have a choice", professions as "the same ape, sorted by chore", the granary meaning tomorrow exists — and everything stealable in one building); closing on the promotion ceremony held daily at dawn in the field — "the sheep obey the shepherd, and you obey the harvest." Tier renamed in table + era ladder. (Owner later hand-polished the T2 text directly in the file.)

**Addendum 3 (same day):** Owner confirmed **T3 stays "Civilization!"** — the "!" is sarcastic. Angle: you master fire, forge metals, carve large stones with self-made tools and build houses from them — but is this the beginning of a "Civilized" world, or will the knowledge be used for destruction? Era intro written into SKILL_TREE.md (§ T3 — Civilization!): the genuine achievements (furnaces that make stone weep metal, carved stone, writing that *remembers*), then the first bronze casting being a sword — "history's first invention with no purpose at all except ending members of your own species" — and walls built not against wolves but against neighbors; closing on the neutral forge ("the knowledge is neutral — the primate holding it is not") and "you will spend the rest of history trying to earn that punctuation mark."

**Addendum 4 (same day):** Owner named **T4 "Iron Age, Golden Price"** (own twist on Claude's 20-name list). Angle: acknowledge the development, but criticize how replacing barter with gold/coinage made people extremely greedy. Era intro written into SKILL_TREE.md (§ T4): the era's real glories (cheap iron, roads, aqueducts, geometry — and Aristo declaring you a "rational animal", a callback to the game's opening line); the core critique — barter kept greed honest because wealth "mooed, molted, rotted", while the coin created "the first appetite in the history of life that has no bottom" (the squirrel stops hoarding when winter is covered; you found a way not to); consequences — ten fields wanting a hundred, armies marching past full granaries for treasure, the mine slave digging gold he'll never touch; closing: carve *know thyself* over the temple door — "Just glance down at your hands while you read it. They're counting." Tier renamed in table + era ladder.

**Addendum 5 (2026-08-26):** Owner named **T5 "Shepherds & Sheep"** (from Claude's 20-name list). Angle: people now use *people* — treated as property and subjects — with religion supporting the arrangement; education appears as a new concept tied to religion, but since it threatens lords and priests, they wield it in their own interests. Era intro written into SKILL_TREE.md (§ T5): serfdom as husbandry-of-you ("entered in the ledger one line below the oxen... You did exactly this to the sheep. Try to appreciate the symmetry" — callback to Domesticated); religion as the self-repairing fence inside the head ("chains cost iron... a fence built *inside the head* costs one sermon a week"), wages paid in heaven, non-refundable; education rationed like winter grain (Latin contracts the flock can't read, chained books, schools producing "precisely enough clerks to count the tithe, and not one thinker more" — learning bred like a sheepdog, pointed at the sheep); closing: "the wolf, at least, was honest about dinner. The shepherd calls it salvation." Tier renamed in table + era ladder.

**Addendum 6 (2026-08-26):** Owner named **T6 "The Kindling"** (from Claude's list — the owner's own "a few kindles was enough to start a fire" metaphor). Angle: nobles can no longer hide behind castle walls (cannon) — grow and become the ruler, kneel as a noble-but-subject, or be destroyed; controlled reading was a dangerous beast — the flock still can't read but some kindled shepherds + the press started the fire; religion still sacred but now questionable; arts find new expression; power shifts from Church to Kings. Era intro written into SKILL_TREE.md (§ T6): the cannon "does not vote either. It subtracts" and the three seats at the table (grow / kneel as "livestock with a coat of arms" / be a lesson in somebody else's chronicle); the press as "the spark made contagious" (burning a book advertises it; sacred *and questionable*); power sliding from altar to throne ("the crowns have decided to keep the change" — same pyramid, new landlord, but now there's a pamphlet in your water-hand); closes the whole game frame with the Aristo callback — "Are you there *now*? The kindling is stacked, animal, and the spark is yours." **All 7 era intros (T0–T6) are now complete.** Tier renamed in table + era ladder.

**Addendum 7 (2026-08-26):** Owner extended the timeline beyond 1650: **T7 "The Golden Age" (Age of Discovery, ~1650–1800)** and **T8 "Age of Great Wars" (Napoleonic Era → end of WW2, ~1800–1945)** added as real game tiers with NO descriptions/nodes yet (stub sections in SKILL_TREE.md await the owner's angle); **T9 "Democracy & Cold War", T10 "Technology", T11 "AI"** added as **titles only**, reserved for the game's epilogue — they will never carry skill nodes. Tier table, era ladder, and document header updated accordingly.

**Addendum 8 (2026-08-26):** Owner named **T7 "Golden Age, Iron Price"** (the deliberate mirror of T4 "Iron Age, Golden Price") and gave the angle: discovery in science and geography does not equal civilization — greed for gold never stops and slavery fuels the new world; nuance that some nations were more tolerant (slave Grand Viziers, servants in family portraits, home-soil bans) but mostly it was extremely cruel — and the cruelty *paid*: the age of empires, where the most cruel empire generally wins; the winnings aren't shared with the now-dangerously-literate flock (the Marie Antoinette joke: unconfirmed "let them eat cake", confirmed two-feet-tall hair in her "modest days" → French Revolution); religion loses more power, science grows "and it will have outcomes — remember what you first did with bronze ;)". Era intro written into SKILL_TREE.md (§ T7): the astronomer's ship carrying chains ("no wolf ever farmed wolves... the greed acquired a navy. Notice who is paying the iron price"); the bitter arithmetic ("the cruelty *pays*"), the hair-vs-bread accounting and the guillotine as "the era's most honest machine: one blade, one purpose, no sermon attached"; closing altar-shrinks-laboratory-grows with the bronze-sword callback — "You remember. Science will remember too. Wink at that, if you can still manage one." Only T8's intro remains.

**Addendum 9 (2026-08-26):** Owner named **T8 "Full Metal Century"** (from Claude's list; the era angle was given in the naming request: science created engines and perfected ballistics, world empires at peak power fight for supremacy, whoever wins the player is crushed at the bottom, bloodiest era in history — "Aristo, did you say something about rational?"). Era intro written into SKILL_TREE.md (§ T8): science delivering ("every shell certain of its address", the fight for the best branch "now scheduled by railway timetable"); the crushed bottom ("the factory that wove your shirt has retooled to weave shrapnel around you", casualty lists "printed in a font small enough to fit the numbers", "the wolf kills by the sheep. You have learned to kill by the trainload... No beast ever built a factory for it. That required reason."); the finale as the bronze bill paid in full — the T3 furnace "has finally learned to make cities weep" — ending on the owner's line "*Aristo, did you say something about rational?*" and the fire "big enough to burn every branch of the tree at once". Owner also renamed **T11 to "Are We There Yet, Aristo?" (AI)** — table, ladder, and epilogue list updated. **All era intros T0–T8 are now complete**; only T7–T8 skill nodes and the epilogue texts remain unwritten.

**Addendum 10 (2026-08-26):** Owner merged **T9–T11 into a single "Epilogue" titled "Are We There Yet, Aristo?"** (covering Democracy & Cold War → Technology → AI, no skill nodes) and allowed longer content (5–6 paragraphs). Owner's beats, all written into SKILL_TREE.md (§ Epilogue): no lesson learned after the war — an arms race instead ("You did not learn the lesson. You memorized the recipe"); is democracy a better order or flock-keeping after the age of empires, with companies as the new empires ("the new empires fly no flags; they file quarterly reports... the shepherd rebranded as a brand"); technology as the race's one true gift — the flock is paid, sometimes well, some living better than old emperors, still sheared/milked/herded but "the shepherds might think twice before slaughtering you now... ten thousand years of progress, and that sentence is the trophy"; feudalism returned as techno-feudalism ("It returned in a hoodie... you plow their fields with your attention, pay your tithe in data"; pyramid callback ends "They're scrolling."); the age of AI with the owner's open questions verbatim in spirit (a new "useless" class, liberal democracy vs "feudalism with better fonts", blind greedy classic capitalism as "defender of democracy" vs capitalized socialism / eastern autocracy); final paragraph closes the Aristo frame — the question was never his to answer: "It is yours, animal... Are you there yet? You tell me. You're the one driving." **The full narrative frame (T0–T8 + Epilogue) is now complete.**

---

## Sessions 46–47 wrap-up (2026-08-25 → 27) — consolidated record of owner instructions

Owner asked for this consolidated record. Everything below is already reflected in GAME_VISION.md, CLAUDE.md, and SKILL_TREE.md; this is the one-place summary.

**Standing instructions given this session:**
1. **Build freeze** — implement NOTHING of the new direction until the owner explicitly says "OK to go". (CLAUDE.md + GAME_VISION.md §Planned Direction)
2. **Direction** — convert the game into a **research & knowledge based game**: the tribe starts from nothing and discovers everything on the way. A tech tree will be built later; **SKILL_TREE.md is its approved foundation**.
3. **Tone rule (permanent)** — all player-facing text is **humorous / black-humorous, almost insulting to the player**; the aim is not insult but the mirror: facing ancestral instincts = drifting from humanity's virtues toward the animal. Voice reference: the SKILL_TREE.md era intros. (GAME_VISION.md §Tone & Writing + CLAUDE.md)
4. **Era naming workflow** — Claude offers ~20 humorous name candidates (names only, no explanations); the owner picks or coins the final name, then gives the story's angle; Claude writes the intro; the owner may hand-polish the text directly in the file afterwards.

**What was produced (all in SKILL_TREE.md, no game code touched):**
- The full skill tree: ~330 nodes, 11 branches, tiers T0–T6 with cross-branch prerequisites, ⭐ gateway techs, main-quest spine, and 6 conversion discussion points (node budget 80–150, discovery model KP/by-doing/hybrid, era gates, fit with existing 15 in-game techs, northern-climate emphasis).
- Timeline later extended: T7–T8 as real tiers (era intros written, **skill nodes still unwritten**), T9–T11 first as epilogue titles, then **merged into a single Epilogue**.
- **The complete era frame, all intros written and owner-approved:**
  - T0 **Hello World!** — game intro; opens "Human is a rational animal, says Aristo. You are not there yet..."
  - T1 **Bloody Roots** — ancestors' skills: hard, but nothing to be proud of; still wild.
  - T2 **Domesticated** — you tamed yourself, not the animals; promoted "from ape to primate".
  - T3 **Civilization!** — the "!" is sarcastic; mastery of fire/metal/stone vs. the first bronze sword.
  - T4 **Iron Age, Golden Price** — coinage replacing barter made greed bottomless.
  - T5 **Shepherds & Sheep** — people as property; religion as the fence inside the head; education rationed by lords & priests.
  - T6 **The Kindling** — cannon ends castle walls (grow / kneel / be destroyed); kindled readers + the press; power shifts Church → Kings.
  - T7 **Golden Age, Iron Price** — discovery ≠ civilized: slavery fuels the new world, cruelty pays, the age of empires; Marie Antoinette / French Revolution; science grows as religion shrinks.
  - T8 **Full Metal Century** — engines + perfected ballistics; bloodiest era; the bronze bill paid in full (the Bomb); "Aristo, did you say something about rational?"
  - **Epilogue: Are We There Yet, Aristo?** (Democracy & Cold War → Technology → AI, no skill nodes) — arms race ("memorized the recipe"), democracy vs. flock-with-paperwork, technology's real gains ("they might think twice"), techno-feudalism ("returned in a hoodie... They're scrolling."), the AI questions, and the closing hand-back to the player: "You tell me. You're the one driving."

**Open work, in order:** ① owner's OK to go → ② T7/T8 skill nodes (steam, electricity, industry, flight...) if wanted → ③ prune ~330 nodes to a playable tech tree together (decide the discovery model) → ④ plan the conversion → ⑤ rewrite all in-game text in the tone.

---

## Session 42 - 2026-08-27 (Owner batch: "Hello World!" chapter intro)

**Owner instructions:** whenever the game starts, open the cavemen campfire image in a window titled "Hello World!"; the "rational animal" narration text (full text preserved in src/ui/Intro.ts) flows in while the Jessica voice-over plays (assets from Desktop/Kadir/Temp/RationalAnimal); it should feel like a new chapter in Baldur's Gate 2.

**Implemented:** assets copied to public/intro/ (cavemen.jpg + hello-world-jessica.mp3, served from the game). src/ui/Intro.ts: dark full-screen overlay with a BG2-style chapter panel - serif amber-on-black, "Hello World!" title bar, the campfire image, and the narration revealed word by word, paced against the mp3's real duration so the last words land with the voice. Autoplay-blocked browsers show "click to hear the tale" and start on first click. Skip button; after the voice ends the chapter lingers ~3.5 s then fades out. Shown on every fresh start; skipped when a save is being loaded (chapter intros belong to new beginnings). Wired in main.ts via loadedFromSave flag.

**State at end of session:** Build passes, live at http://localhost:5180.

**Follow-up (session 43, same day):** intro reworked per owner - (1) no word-by-word reveal: the whole narration renders at once and slowly scrolls top-to-bottom through a fixed text window, paced to the voice-over duration; (2) the campfire in the picture now burns - flickering radial glow (screen-blended, keyframed), gentle brightness breathing on the whole image, and 7 embers drifting upward on randomized loops; (3) background fire-crackle bed synthesized with the Web Audio API (looped brown-noise rumble through a lowpass + random highpass pop bursts) - no audio file needed; starts with the voice, fades out on close/skip. Build passes, live at http://localhost:5180.

**Follow-up (session 44, same day):** crackle bed rumble lowered substantially (base gain 0.35 -> 0.05, pops untouched); text crawl switched from scrollTop (integer-quantized -> visible stepping) to sub-pixel translateY for a fluid flow; main flame glow moved 10% down / 10% right (57%/76%), made vertical (22% x 32%), rounded (border-radius 50%), tinted deeper red-orange; four dimmer wall glows added near the image borders (left/right/top/bottom) with different durations and phase offsets so the firelight breathes like a real fire. Build passes, live at http://localhost:5180.

**Follow-up (session 45, same day):** central glow 3% left (54%/76%); ember glitter 3% right (47-54% band); four corner fire glows added with distinct durations/phases (8 wall/corner patches total); wind bed -30% (0.05 -> 0.035); crackle pops -20% (peak 0.2-0.88). Build passes, live at http://localhost:5180.

**Follow-up (session 46, same day) - intro polish batch:** central glow 2% left (52%); embers spawn as a tight vertical column 1% right / 3% down, invisible at rest (base opacity 0 + negative animation delays) and wander upward on per-ember randomized crooked keyframe paths; crackle bed continues after narration until Continue is pressed (no auto-close); historic double-gilt frame with corner brackets; ornamental gradient-rule + fleuron divider between picture and text; fire sound starts FIRST, narrator joins after 2.6 s; Skip removed - centered fleuron header, Replay/Continue historic buttons at the foot; font switched to IM Fell English (Google Fonts, Palatino fallback offline); narration rises from below the window like credits with gradient masks, timed so the last sentences slip out the top exactly as the voice ends; wall/corner glows slowed (3.8-5.5 s), centers moved ONTO the edges, and 4 more glows added on the top/bottom quarters (12 patches total); game now starts PAUSED (loop.setSpeed(0) after start). Build passes, live at http://localhost:5180.

**Follow-up (session 47, same day):** click-to-play gate removed - the intro starts immediately; if the browser blocks pre-gesture audio, the first click/keypress anywhere silently wakes the fire and narrator (no hint shown). Narration shifted +3 s (fire alone for 5.6 s, so it also ends 3 s later); text flow lengthened by 10 s (crawl duration = voice + 10). Build passes, live at http://localhost:5180.

---

## Session 48 - 2026-08-27 (Generative background music in the intro)

**Owner asked:** can background music be generated too?

**Implemented:** EmberSong class in Intro.ts - fully synthesized, no audio file. Drone: root+fifth in D (triangle oscillators, slow independent breathing LFOs, lowpassed). Melody: random walk over D dorian (mostly stepwise, occasional leaps, drawn back toward home between phrases), flute-like voices (paired detuned sines, vibrato, slow attack / long release), occasional soft companion a third below, phrases separated by breaths. Space via two staggered feedback delays. Starts with the fire, sits QUIET (0.055) under the narration, swells (0.13) once the voice ends, keeps playing with the crackle until Continue; ducks again on Replay. Cost same class as the crackle: a dozen native audio nodes, ~0.1% of a core, zero files.

**State at end of session:** Build passes, live at http://localhost:5180.

**Follow-up (session 49, same day):** (1) F5 bug - after a refresh the browser blocks pre-gesture audio, so the text scrolled silently while narrator+fire sat muted (Replay worked because the click was the unlocking gesture). Fixed: the WHOLE sequence now waits until sound is allowed - a play() probe runs it immediately when permitted, otherwise fire+voice+text all start together on the first input. (2) Music moved out of the intro into src/ui/Music.ts (SpringSong) and starts only when Continue closes the chapter - it is the game background music now. (3) Character reworked for spring/rebirth/happiness: D major pentatonic (no sad intervals), up an octave (D4), lighter faster phrases with an upward lean, brighter drone, lighter echo, and a frame-drum heartbeat (~88 bpm pitch-dropping thumps with occasional grace taps), 4 s fade-in. Build passes, live at http://localhost:5180.

**Follow-up (session 50, same day):** the organ-like drone in SpringSong softened - level 0.11 -> 0.05 and lowpass 700 -> 420 Hz so it hums underneath instead of singing along. Build passes, live at http://localhost:5180.

**Follow-up (session 51, same day):** drone rebuilt against shrillness - triangle waves (odd harmonics = the shrill edge) replaced with PURE SINES in detuned pairs (+-3 cents, two-singers thickness), dropped ANOTHER octave (D2 ~73 Hz + A2), gain 0.05 -> 0.035, lowpass 420 -> 260 Hz, gentler breathing. Build passes, live at http://localhost:5180.

**Follow-up (session 52, same day):** drone removed entirely from SpringSong - the music is now just flute melody + frame drum. Owner plans to layer richer sound in as the civilisation develops (good hook: the existing tech tree can gate future instruments - e.g. drone/strings after certain eras). Build passes, live at http://localhost:5180.

**Follow-up (session 53, same day):** flute melody removed - the soundscape is now just the frame-drum heartbeat plus synthesized DISTANT WOLF HOWLS at long random intervals (first 8-23 s in, then every 25-90 s; 40% chance the pack answers with 1-2 more staggered howls). Each howl: sine pair with rise-quaver-long fall pitch contour, per-wolf random key, 5.5-7 Hz vibrato, lowpassed to 900 Hz and echo-heavy for distance. Owner will layer music back in as the civilisation develops. Build passes, live at http://localhost:5180.

---

## Session 54 - 2026-08-27 (Season-aware soundscape: winter wolves, spring guitar)

**Owner instructions:** the drum+wolves soundscape becomes the WINTER sound; SPRING gets drums and percussion plus a primitive guitar.

**Implemented:** Music.ts reworked into season-aware `GameMusic` (singleton `gameMusic`), bound to `calendar.season` in main.ts. Winter: bare drum heartbeat + distant wolf howls. Spring: livelier drum (more grace taps), woody STICK clicks (bandpassed noise knocks), and a primitive guitar - Karplus-Strong plucked-string synthesis (noise burst rung through a damped delay ring, lowpassed to gut-string roundness), short pentatonic phrases on D3 with occasional low open-string notes. Summer/autumn: drums only for now (awaiting owner). Wolves silent outside winter; guitar dozes outside spring; schedulers check the season at fire time so transitions are automatic. Save-loads (which skip the chapter screen) now start the soundscape immediately, unlocked by first input if the browser demands a gesture. Build passes, live at http://localhost:5180.

**Follow-up (same session):** songbirds added to spring - four synthesized species (rising whistles, hurried falling notes, fast two-note trill, mellow cuckoo pair), each melody at a random pitch range and distance, every 5-19 s during spring only. Build passes, live at http://localhost:5180.

**Follow-up (session 55, same day):** guitar melody removed (Karplus-Strong pluck code deleted; the doc comment notes instruments return with civilisation progress). Spring is now drums + stick percussion + songbirds; winter drums + wolves. Build passes, live at http://localhost:5180.

**Follow-up (session 56, same day):** the remaining click after F5 is the BROWSER autoplay gate (one real user gesture required before sound; synthetic events do not count) - cannot be removed from page code. Added play-northreach.bat in the project root: launches Chrome (or Edge) with --autoplay-policy=no-user-gesture-required on a dedicated profile pointing at http://localhost:5180 - in that window the intro autoplays fully, including after every F5. Alternatives recorded for the owner: Firefox per-site "Allow Audio and Video"; Edge per-site media autoplay Allow.

**Follow-up (session 57, same day):** repo initialized (main), .gitignore (node_modules/dist), full project committed as "Northreach: strategy survival colony sim (sessions 1-56)", remote origin = https://github.com/kgselcuk/Rational-Animal.git. PUSH BLOCKED: this machine's stored GitHub credential is account "kadirselcuk-cloud", which has no write access to kgselcuk/Rational-Animal (403). Waiting for owner: either add kadirselcuk-cloud as a collaborator (repo Settings -> Collaborators) or update the Windows-stored GitHub credential to the kgselcuk account - then `git push -u origin main`.

**Follow-up (session 58, same day):** owner corrected the target - origin now https://github.com/kadirselcuk-cloud/Rational-Animal.git (the account this machine is authenticated as). Log commit + push of everything.

**Follow-up (session 59, same day):** GitHub Pages deployment configured - .github/workflows/deploy.yml (build on every push to main: npm ci, npm run build, upload dist, actions/deploy-pages; configure-pages with enablement:true so Pages self-enables); vite base = /Rational-Animal/ under GITHUB_ACTIONS only (local dev/build unaffected); intro asset paths now use import.meta.env.BASE_URL; tsconfig gains vite/client types. Game URL: https://kadirselcuk-cloud.github.io/Rational-Animal/

**Deployment verified:** the Actions workflow completed successfully and the game is LIVE at https://kadirselcuk-cloud.github.io/Rational-Animal/ (checked: HTTP 200). Every push to main now redeploys automatically.

**Follow-up (session 61, same day):** (1) "Press any key to continue..." shown centered in the text field whenever the browser is holding the tale for a gesture (autoplay-allowed starts skip it entirely); (2) the text crawl now begins 1 s after the tale starts instead of waiting for the narrator - pacing recomputed (voice + 10 s extra + the 4.6 s head start) so the ending timing is unchanged; Replay uses the same 1 s / 5.6 s schedule. Build passes; pushed - auto-deploys to https://kadirselcuk-cloud.github.io/Rational-Animal/

**Follow-up (session 62, same day):** waiting prompt reworded to "Press any key to play..."; Continue renamed "Skip >>" (same close behavior); both Replay and Skip start DISABLED (dimmed historic style) and enable the moment the tale begins playing. Build passes; pushed - auto-deploys.

---

## Session 63 - 2026-08-27 (Project renamed Rational Animal; random town names)

**Owner instructions:** rename the project from Northreach to Rational Animal; in-game, give the town a random name - 200 town names in a data file, one picked at game start.

**Implemented:** page/showcase titles, package name (rational-animal), HUD header, and the launcher (play-rational-animal.bat) all renamed - localStorage keys deliberately KEPT as northreach-* so existing saves and window layouts survive. New src/data/townNames.ts with exactly 200 unique medieval-English town names + randomTownName(); Village.townName drawn at founding, persisted in saves (data.town), shown in the HUD header and atop the Town information window. (Two PowerShell text-rewrite mishaps en route - showcase.html mojibake and a BOM in package.json - both caught and fixed; the no-PowerShell-rewrites rule stands re-learned.) Build passes; pushed - auto-deploys.

---

## Session 64 — 2026-08-28 (Roadmap v2: the phased campaign — "games inside the game")

**Owner direction (recorded, NO code touched):** substantial changes ahead — the game becomes a **phased campaign** whose feel evolves from Banished/Settlers/Manor Lords into Total War as it progresses. The SKILL_TREE.md tiers are the phases: T0 tutorial-survival (forage/sticks/fire/first tools, ~3 years) → survival through T2 → T3 raids + unknown merchants → T4 gold/trade/diplomacy → T5 manor/soldiers/taxation → T6 castle/fortification → T7–T8 clean cut into grand strategy on an abstracted map (cities + armies, battles as troop rectangles with dropping numbers; T8 zooms out to world conquest) → Epilogue. Plus a **start screen**: surprised Aristo statue (funny face, open hands) center, 4 corner artworks (cavemen hunting / tribes hunting each other / Spanish vs Aztecs / WW1) — all PNGs to come from the owner.

**Owner decisions (via Q&A, all recorded in ROADMAP.md):**
1. Research loop: KP from villager actions; player picks research; completion popup pauses game, shows auto-picked recommended next research, button opens tech tree to change; info/KP/image popups everywhere.
2. Tree pruned to ~120–150 nodes (workshop with owner).
3. Era gate: **ALL techs of a tier must be completed** to advance → tiers must be curated small (12–17) with zero filler.
4. Era intros: same "Hello World!" text + voice for every tier for now, header shows era name; owner supplies per-era assets later.
5. Obsolescence: old buildings keep working but leave the build menu; vanished resources auto-convert.
6. T6→T7 is a **clean cut** (settlement chapter ends; strategic map is a new game).
7. Code: **evolve & gate** the existing sim; content redistributed across tiers.
8. Pacing: grow with depth (T0–T1 ~2–3y, T2–T6 ~4–6y, T7–T8 objective-based; ~15–20 h campaign).
9. Start screen: classic menu (New Game → Hello World intro → T0, Continue, Load, Settings later).

**Delivered:** [ROADMAP.md](ROADMAP.md) fully rewritten as **Roadmap v2** — vision, the 9 decisions, tier-by-tier player arc table, implementation Phases A–K (A start screen/chapter shell, B tech-tree foundation, C gating engine + T0, D T1–T2, E T3 raids/merchants, F T4 money/diplomacy, G T5 manor/tax, H T6 castle, I T7 strategic layer, J T8 world, K epilogue/polish), cross-cutting rules, 7 open questions (tribes timeline, T7/T8 research, school role, year length, sandbox mode, old saves, PNG specs). v1 roadmap archived at the bottom as COMPLETE. GAME_VISION.md §Planned Direction updated; freeze now reads "until the owner explicitly approves Roadmap v2".

**State at end of session:** docs only — no code changed. Roadmap v2 awaits owner review.

**Next steps:**
1. Owner reviews Roadmap v2 (esp. the 7 open questions + phase order).
2. On approval → Phase A (start screen; placeholders until the owner's PNGs arrive) and the Phase B pruning workshop can start in parallel.

**Addendum (same day) — all 7 open questions answered by the owner** (recorded as decisions 10–17 in ROADMAP.md):
1. T3 raiders/merchants are **separate nameless factions** (bandits, wandering traders) — NOT the 4 tribes; tribes debut fresh in T4.
2. **T7/T8 not built now; each gets its own separate tech tree** — per chapter: decide the tree together first, then gameplay decisions, then build. Phase B pruning covers T0–T6 only. Also: **next era's techs stay locked until the current era completes** (T0–T6).
3. School becomes a **KP multiplier** on action-earned knowledge (later tier).
4. **Year length stays 20 min** for T0–T6.
5. **Campaign only** — no sandbox mode.
6. **Old saves wiped** at Phase C; no migration.
7. Phase A uses **placeholder art** until the owner's 5 PNGs arrive (statue transparent bg, ≥1024 px preferred).
Phase F and Phases I/J descriptions updated to match. Roadmap v2 now has zero open questions — awaiting the owner's overall approval.

---

## Session 65 — 2026-08-28 (GO: Phase B begins — the tech tree, designed and explorable in-game)

**Owner instruction:** Roadmap v2 approved — GO. Design the tech tree first; add a button in the game to open it; **double-click any tech to complete it as if played** (dev preview).

**Delivered:**
1. **The playable tree designed**: SKILL_TREE.md (~330 nodes) pruned to **125 nodes**, T0–T6, 10 branches — recorded in [TECH_TREE.md](TECH_TREE.md) (tier tables: name/branch/KP/prereqs/effect). Node counts 8/20/20/21/20/20/16; KP bands 5→420 (placeholder costs until action-KP exists). Every tier-mechanic from the roadmap has its gateway node (Passing Merchants T3, Coinage+Diplomacy T4, Manor+Taxation+Men-at-Arms T5, Castle+Star Forts+Musketry T6; Scientific Method closes the tree). Every node carries a **tone-rule flavor line** (drafted, reviewable in-game by hover).
2. **`src/sim/techtree.ts`** — data (125 nodes: id, tier, branch, prereqs, KP, ⭐ flags, effect, flavor) + `TechTreeState`: current era = lowest unfinished tier (decision 3), later tiers locked (decision 12), `completeAsPlayed()` dev-completes a node plus all earlier tiers and its prereq chain; state persists in localStorage (`ra-techtree-v1`), separate from saves until Phase C.
3. **`src/ui/TechTreeUI.ts`** — full-screen tree chart: tier columns with era names, branch rows, SVG prereq curves, drag-pan + wheel-zoom (cursor-anchored), hover **info card** (big emoji as placeholder image, era, branch, KP, status, effect, flavor, prereq checklist), states (researched gold / available green-glow / locked dim 🔒), T7/T8/Epilogue as locked plaques at the right edge, Reset (dev), Esc closes.
4. **Wiring**: 🌳 menu button in the HUD; double-click completes (events-feed messages); completing a tier fires the **era chapter intro — same text & voice, new era header** (decision 4) with the game paused, resuming on close. `showIntro(title, onClose)` parameterized. Dev flag `?techtree=1` opens the tree directly (skips the chapter) for headless screenshots.
5. The old 15-tech 📖 window still runs current gameplay — it retires in Phase C when unlock wiring moves to the new tree.

**Verified:** `tsc` + `npm run build` pass; headless-Edge screenshot of `?techtree=1` shows the chart (T0 green, columns, curves, plaques). Live at http://localhost:5180.

**Next steps:**
1. Owner explores the tree in-game (🌳), reviews node picks & flavor lines (TECH_TREE.md for the tables).
2. Phase B remainder: real research loop — action-KP earning, current-research selection, completion popup with auto-recommended next research (decision 1).
3. Then Phase C: tier-gating engine + T0 start; merge tree state into saves.

**Follow-up (same session) — tree layout per owner:** tiers **T0–T8 down the Y axis**, the ten
tech types **across the X axis**; **no connection lines** — prerequisites live only on the
mouseover info card ("Requires:" list with ✓/· and each prereq's tier); the **bonus is shown
clearly** on every card (green text, 3-line clamp) and as a labeled "Bonus:" row on the hover
card. Cards grew to 188×92 to fit the bonus text; T7/T8/Epilogue are full-width locked rows at
the bottom. Screenshot-verified; build passes; pushed.

**Follow-up (same session) — UI font decision (recorded as ROADMAP.md decision 18):** the UI
font was bad (the tech tree overlay fell back to the browser default). Owner rule: use a good,
popular, everywhere-available Google Font → **Inter** is now the game-wide UI typeface
(`index.html`: Google Fonts link + `body` rule + all former "Segoe UI" declarations, fallbacks
kept for offline dev). Chapter screens keep IM Fell English by design. Build passes; pushed.

**Follow-up (same session) — age-column polish (owner batch):** (1) age titles vertically
centered in their rows; (2) **T0–T8 codes removed from the whole UI** — they are dev shorthand
only (docs/code); the player sees era names alone (header, hover cards, prereq lists, stub rows);
(3) each age carries a **2–3 sentence humorous description** under its title (`TIER_BLURBS` in
techtree.ts, condensed from the era intros; stub-row notes upgraded to the same voice);
(4) age column widened 132→258 px so the blurbs sit naturally; (5) **per-age background shades**
(cold-dawn blue, blood red, field green, bronze, gold, clergy purple, kindling orange; neutral
for the locked late ages); (6) drag-panning no longer selects text (user-select:none on the
overlay); (7) font consistency audited — all UI is Inter now, chapter screens intentionally
IM Fell English, no other font declarations exist. Build passes; screenshot-verified; pushed.

**Follow-up (same session) — intro font mismatch (owner report):** header, flowing text and
buttons looked like different fonts. Cause: the IM Fell English stylesheet was injected only when
the chapter opened, so on a slow/blocked font fetch the intro rendered in fallback Palatino —
whose letter-spaced header vs. italic prompt vs. small buttons read as three different faces.
Fix: IM Fell English now loads up front from index.html in the same Google Fonts request as
Inter (dynamic injection removed); the "Press any key" prompt got an explicit font-family too.
Verified at 2× headless zoom: all intro text is one face. If the owner still sees a mismatch,
Google Fonts is blocked on that network → next step would be self-hosting the font files in
public/fonts. Build passes; pushed.

**Follow-up (same session) — owner overrules the chapter-screen exception: Inter EVERYWHERE.**
IM Fell English removed entirely (index.html loads only Inter, now incl. the italic 400 variant
for the intro's italics; Intro.ts FONT is the Inter stack). ROADMAP.md decision 18 updated: Inter
is the game's ONLY typeface, chapter screens included. Verified by 2× screenshot; build passes;
pushed.

---

## Session 66 — 2026-08-30 (Phase A: the main menu — owner art delivered)

**Owner delivered the 5 menu PNGs** (Desktop/Kadir/Temp/RationalAnimal: aristo, top-left,
top-right, bottom-left, bottom-right — copied to `public/menu/`) **and the layout instruction:**
Aristo at the top of the main menu, not knowing what to do; RATIONAL ANIMAL beneath him in all
caps in Greek-architecture style with columns; the four artworks in the corners.

**Implemented — `src/ui/MainMenu.ts`, shown on every fresh start (before the chapter):**
- Full-screen menu on a dark radial-vignette ground; **Aristo statue top center** with a deep
  drop shadow; beneath him a **temple front**: architrave line, **RATIONAL ANIMAL** in stone-
  gradient carved caps (Inter, wide tracking — decision 18 holds), flanked by two inline-SVG
  **Doric columns**, standing on a three-step stylobate.
- **Corner artworks** (top-left cavemen hunt, top-right tribes/hoplites, bottom-left Spanish vs
  Aztecs, bottom-right WW1) anchored to their corners with radial fade masks toward screen
  center. Masks are deliberately tight: the bottom two PNGs have a checkerboard "transparency"
  pattern baked into their pixels — the fade hides it. **If the owner re-exports those two with
  real transparency, the masks can widen.**
- **Buttons:** NEW GAME (→ closes menu → "Hello World!" chapter → game), CONTINUE (newest save
  across slots incl. autosave, tooltip shows its summary; disabled when no saves), LOAD GAME
  (in-menu slot list with summaries + Back; disabled when no saves). Settings later, per
  decision 9. Continue/Load reload the page into the save (existing pending-load flow), which
  correctly skips menu and chapter.
- Flow wiring in main.ts: fresh start → menu; save-load boot → straight into the game;
  ?techtree=1 dev flag unchanged.

**Verified:** build passes; headless screenshots of the menu (disabled-state buttons, masks).
Live at http://localhost:5180; pushed — auto-deploys.

**Phase A remainder:** era-intro framework already done (session 65); Settings menu later.
Next: Phase B remainder (action-KP research loop + completion popup) or owner feedback on menu.

**Follow-up (same session) — owner sizing pass on the menu:** (1) corner fade masks removed —
the owner adjusted the PNGs' own transparency to carry the blend; (2) RATIONAL ANIMAL title at
60% of its size, columns shrunk to match (96→58); (3) Aristo 20% smaller; (4) corner images
first +20%, then −10% of that; (5) **both bottom corner images removed** — only the top corners
carry art now (bottom PNGs stay in public/menu for a possible return). Screenshot-verified;
build passes; pushed. Later same session: columns 1.5× (58→87).

**Follow-up (2026-09-02) — bottom corners return:** owner delivered re-exported bottom-left
(conquistadors vs Aztecs) and bottom-right (WW1) PNGs with real transparency; copied to
public/menu and both bottom corners restored in MainMenu.ts at the same sizing as the top ones.
All four corners now blend cleanly with no masks. Screenshot-verified; build passes; pushed.
