# Roadmap v2 — "Games Inside the Game" (DRAFT — awaiting owner approval)

> Drafted 2026-08-28 from the owner's instructions. Supersedes Roadmap v1 (archived at the bottom — its phases 0–8 are all built and live).
> **Nothing here is implemented until the owner approves this roadmap.**

## The Vision (owner's words, consolidated)

The game becomes a **phased campaign**: as it progresses, the *feeling* of the game changes — games inside the game. It starts as strategy survival & supply-chain management (**Banished / Settlers / Manor Lords**) and ends as grand strategy (**Total War**). The tiers of [SKILL_TREE.md](SKILL_TREE.md) (T0 "Hello World!" → T8 "Full Metal Century" + Epilogue) are the phases. Content is progressively unlocked; primitive content is progressively replaced.

## Recorded Decisions (owner, 2026-08-28)

1. **Research loop:** knowledge points (KP) are earned **from actions villagers complete**. The player selects a tech to research; each tech has a KP cost. When a research completes, a **popup pauses the game**: it announces the completed research and shows the **recommended next research the game auto-picked**, already running. A button opens the **tech tree** to pick a different one. Both the completed and the proposed research display **info, explanation, KP cost, and an image** as popups.
2. **Tree size:** prune SKILL_TREE.md's ~330 nodes to **~120–150 playable nodes** (done together with the owner).
3. **Era gate:** advancing to the next tier requires **completing ALL techs of the current tier**. (Consequence: every tier's node list must be small and all-meaningful — roughly 12–17 nodes, no filler.)
4. **Era intros:** each tier advance plays a chapter intro like "Hello World!". **For now: same text, same voice-over, only the header/title shows the new era name.** The owner supplies per-era text, art, and voice later.
5. **Obsolescence:** when a tier replaces primitive buildings/jobs, existing ones **keep working at their worse rates but vanish from the build menu**; the player upgrades or demolishes at their own pace. Resources that cease to exist **auto-convert in storage at a fair rate**.
6. **T6 → T7 transition: clean cut.** The settlement chapter ends (final stats / chronicle farewell); T7 starts as a new game on the strategic map. The town is not simulated further.
7. **Code strategy: evolve & gate.** Keep the engine and sim; add a tier system that hides/unlocks/replaces buildings, jobs, and resources. Existing content is redistributed across T1–T6.
8. **Pacing: grow with depth.** T0–T1 short (~2–3 in-game years each), T2–T6 longer (~4–6 years), T7–T8 measured in objectives, not years. Target campaign length ~15–20 hours.
9. **Start screen (classic menu):** game title, **surprised statue of Aristo** — funny face, open hands, "What can I do?" — center; **four corner artworks** from four phases of the game: top-left *cavemen hunting*, top-right *tribes hunting each other*, bottom-left *musketed Spanish soldiers fighting Aztecs*, bottom-right *World War 1*. Buttons: **New Game** (→ "Hello World!" chapter intro → T0), **Continue** (latest save), **Load Game**, later Settings. **All artwork arrives from the owner as PNGs** — statue & art style screen, no 3D scene needed.

## The Player's Arc (tier by tier)

| Tier | Era | ~Years | The game it feels like | Headline content |
|---|---|---|---|---|
| T0 | Hello World! | 2 | Tutorial survival | Forage, collect sticks, keep the fire alive, first crude tools, slightly better gathering. Very few jobs. Easy, cheap researches teach the tech tree. |
| T1 | Bloody Roots | 3 | Harsh survival | Hunting, fishing, hides, firewood chain, first real shelters. Staying alive is the whole game. |
| T2 | Domesticated | 4 | Banished | Houses, families, professions, farming, clay/pottery, storage. End of T2 closes the "mainly strategic survival" chapters. |
| T3 | Civilization! | 4–5 | Banished + pressure | Bronze, writing. **Raiding attacks begin** — defend. **Unknown merchants** arrive regularly for basic barter. |
| T4 | Iron Age, Golden Price | 5 | Settlers | **Gold (money)** replaces barter. **Trade & diplomacy with the tribes.** Attack and defend. Iron. |
| T5 | Shepherds & Sheep | 5 | Manor Lords | **Manor**, full-time soldiers — recruit, train, arm. **Taxation.** |
| T6 | The Kindling | 5 | Manor Lords, armed | Advanced soldiers, **upgrade to castle**, fortify the town. Settlement chapter finale. |
| T7 | Golden Age, Iron Price | objectives | Total War (campaign map) | **Clean cut** → strategic map of a generated mainland. A few cities and armies; conquer the region. **Abstract battles:** rectangles of troops with text numbers dropping as they fight. |
| T8 | Full Metal Century | objectives | Total War (world) | Map zooms out again. You are an empire holding substantial land; conquer the rest of the world (or reach objectives). |
| — | Epilogue: Are We There Yet, Aristo? | — | Reading & reckoning | The Epilogue text of SKILL_TREE.md, presented. Campaign end. |

## Implementation Phases

Each phase ends playable. Order is buildable order, not tier order, because the tech-tree machinery must exist before any tier can be gated.

### Phase A — Start Screen & Chapter Shell
Start screen per decision 9 (waits on owner's PNGs — layout can be built with placeholders). New Game / Continue / Load wiring; "Hello World!" intro moves behind New Game. **Era-intro framework**: tier advance plays the chapter screen with the era's header (same text & voice for now — decision 4).
**Playable result:** boot → menu → intro → game; era intros triggerable.

### Phase B — Tech Tree Foundation
The heart of the conversion, in three parts:
1. **Pruning workshop (with the owner):** cut ~330 nodes to ~120–150 across T0–T6; every node gets a gameplay effect (unlocks building / job / resource / mechanic / bonus), KP cost, image, and a tone-rule description. Because of decision 3 (ALL techs required), each tier's list is curated to be all-mandatory.
2. **Data & sim:** tech data model (tier, prereqs, KP cost, unlock effects); KP earned from villager actions (per completed work cycle, per building milestone…); tier state machine (all techs done → era advance → intro → new tier's tree opens).
3. **UI:** full tech-tree window (branches × tiers, zoom/pan), research-complete popup (pauses game, shows completed + auto-picked recommendation, "change" opens the tree), research info popups with image/explanation/KP, current-research HUD widget.
**Playable result:** the complete research loop running on the pruned tree, even before content is re-gated.

### Phase C — Tier Gating Engine + T0 "Hello World!"
The gating machinery (decision 7): every building, profession, and resource declares its tier window (appears at / replaced at). Obsolescence rules per decision 5. Then the first real chapter: a new game starts in T0 with almost nothing — forage, sticks, campfire upkeep, crude tools, a handful of villagers. Existing content redistributed across tiers (first pass, refined in later phases). Old saves: broken by the conversion (see open question 6).
**Playable result:** New Game lands in a true T0; ~2 years of play reaches T1.

### Phase D — T1 & T2 Content Pass
Redistribute and rebalance the existing survival game into Bloody Roots (hunting/fishing/hides/shelters) and Domesticated (houses, families, professions, farming, clay). Replacement moments designed (what obsoletes what). Balance the two-tier arc ≈ 7 years.
**Playable result:** T0→T2 plays as an escalating survival campaign.

### Phase E — T3 "Civilization!" — Raids & Unknown Merchants
Raider attacks begin (hostile bands; defense with what T3 offers — militia, walls). **Unknown merchants**: neutral traders arrive at the town regularly for basic barter — no relations, no map camps, no identity yet. Bronze & writing content lands here.
**Playable result:** survival now includes defending and opportunistic barter.

### Phase F — T4 "Iron Age, Golden Price" — Money, Trade & Diplomacy
**Gold as currency** — barter values become prices; the money economy arrives. The four tribes appear (decision 10: new named factions with fresh relations — not T3's anonymous raiders/merchants): camps, relations, diplomacy, caravans, attack/defend (evolved from the existing tribes/war systems). Iron tier tools/weapons.
**Playable result:** the full economic-political middle game.

### Phase G — T5 "Shepherds & Sheep" — Manor, Soldiers, Taxation
The **manor** (new centerpiece building), full-time professional soldiers (recruit, train, equip — evolved from the existing training-ground system), **taxation** of the population (gold income vs. happiness).
**Playable result:** you rule subjects now, not neighbors.

### Phase H — T6 "The Kindling" — Castle & Fortification
Manor **upgrades to castle**; town fortification (stone walls era), advanced soldiers. Settlement-chapter finale: closing chronicle and the clean-cut handoff to T7 (decision 6).
**Playable result:** the settlement game complete, T0→T6.

### Phase I — T7 — The Strategic Layer (a new game)
Per decision 11, this phase starts with a **design workshop**: T7's own tech tree is decided with the owner first, then the gameplay decisions, then the build. The build itself is the biggest single item: a **generated mainland map** (provinces, cities, armies as counters), turn/tick strategy sim, army movement, **abstract battles** — rectangles of troops with numbers dropping as they fight — city capture, simple strategic economy. Player starts with a few cities and armies.
**Playable result:** T7 as a self-contained grand-strategy game reachable from T6.

### Phase J — T8 "Full Metal Century" — World Conquest
Same workflow (decision 11): T8's own tech tree designed first, then gameplay, then build. The map zooms out to the whole generated world; the player is now a major empire. More empires, bigger armies, objectives (conquer all / reach goals). Reuses Phase I machinery at world scale.
**Playable result:** the campaign can be finished.

### Phase K — Epilogue & Campaign Polish
The Epilogue presentation ("Are We There Yet, Aristo?"), campaign-wide balance pass, tone-rule rewrite of all remaining player-facing text, save/load across every chapter boundary, performance.
**Playable result:** the full 15–20 h campaign, start screen to epilogue.

## Cross-cutting rules (apply to every phase)

- **Tone rule** on all new player-facing text (GAME_VISION.md §Tone & Writing).
- **Visual style guide** consulted before any new building/visual ([VISUAL_STYLE_GUIDE.md](VISUAL_STYLE_GUIDE.md)).
- Every phase ships playable at http://localhost:5180 and is recorded in [CONVERSATION_LOG.md](CONVERSATION_LOG.md).

## Recorded Decisions, round 2 (owner, 2026-08-28 — all former open questions answered)

10. **Tribes are separate entities from T3's threats.** T3's raiders and unknown merchants are their own nameless factions (bandit bands, wandering traders) — NOT the 4 tribes in disguise. The 4 tribes only appear in T4, with fresh relations.
11. **T7 and T8 are NOT built now, and each gets its OWN separate tech tree.** Workflow per chapter: first decide its tech tree together, *then* make the gameplay decisions, then build. Phases I/J each begin with that design workshop. The Phase B pruning workshop covers T0–T6 only.
12. **Next era's techs stay locked** until the current era is completed (T0–T6) — the tree only ever shows/offers the running tier's research (future tiers visible but locked).
13. **School = KP multiplier.** Unlocked in a later tier; it multiplies the KP villagers earn from actions (educated villagers learn more from what they do). Teachers/students keep their sim behavior.
14. **Year length stays 20 real minutes** for all of T0–T6 (≈ 9–10 h settlement play before T7).
15. **Campaign only — no sandbox mode.** The tiered campaign is the game.
16. **Old saves are wiped** when Phase C ships; no migration or legacy mode.
17. **Start screen art:** Phase A builds with placeholder art so layout/menus aren't blocked; the owner's 5 PNGs (statue ideally transparent-background, ≥ ~1024 px long edge) drop in when ready.
18. **Game font (owner, 2026-08-28): Inter** (Google Fonts — popular, available everywhere) is the game's ONLY typeface, **everywhere** — all UI, the tech tree, and the chapter/intro screens included (IM Fell English removed same day). Loaded in `index.html` (regular/semibold/bold + italic) with `"Segoe UI", system-ui, sans-serif` fallbacks for offline dev.

---

# Roadmap v1 (2026-08-19) — COMPLETE, archived

All eight phases were built between 2026-08-20 and 2026-08-27 (sessions 2–63): 0 Foundation · 1 World Generation · 2 Villagers & Work · 3 Survival · 4 Primitive Economy · 5 Settled Era + Knowledge · 6 Tribes: Trade & Diplomacy · 7 Bronze, Iron & War · 8 Depth & Polish (save/load, chronicle, disasters, tailor, day/night, soundscape…). See [CONVERSATION_LOG.md](CONVERSATION_LOG.md) for the session-by-session record. That flat game is the codebase Roadmap v2 now restructures.
