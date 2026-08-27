# Open Design Questions

Comprehensive question list. **Blocking** questions shape the architecture and must be answered before the roadmap. Answer inline under each question or tell Claude in chat — answers get recorded here and in [CONVERSATION_LOG.md](CONVERSATION_LOG.md).

## A. Blocking — Technical Foundation

1. **Tech stack:** Plain three.js + Vite? TypeScript or JavaScript? (Recommendation: TypeScript + Vite + three.js, no game engine framework.)
2. **Camera / view:** Classic RTS top-down-angled orbit camera (rotate/zoom/pan)? Or fixed isometric-style angle?
3. **World representation:** Tile/grid-based map (like Banished/Anno — simpler pathfinding, snapped buildings) or freeform terrain with free placement? Grid size if grid?
4. **Map size:** Roughly how big? (e.g. 256×256 tiles) One island/region per game?
5. **Save games:** Browser localStorage / IndexedDB is the natural choice — acceptable? Multiple save slots?
6. **Target performance:** How many villagers should the game handle late-game? 50? 200? 1000? (This decides animation/instancing architecture from day one.)

## B. Blocking — Core Loop

7. **Time model:** Real-time with pause and speed controls (1×/2×/4×)? How long is one in-game year in real minutes?
8. **Seasons:** Full four seasons with harsh winter (no crops, high firewood/food drain)? Day/night cycle too, or seasons only?
9. **Survival pressure:** How punishing? Villagers can starve/freeze to death and the colony can collapse (Banished-style)? Or softer (workers just stop working)?
10. **Villager simulation depth:** Do villagers have individual needs (hunger, warmth, health, happiness), age, families, and children who grow into workers? Or are they a simpler abstract labor pool?
11. **Worker assignment:** Assign counts per profession ("5 woodcutters") and they self-organize? Or assign specific individuals to specific buildings?

## C. Blocking — Progression & Tribes

12. **Era progression trigger:** What advances you from wood/stone → bronze → iron? A research/knowledge system (school produces knowledge points)? Building milestones? Population thresholds? Trade for the first metal recipes?
13. **The 4 tribes:** Are they simulated colonies that also grow, or scripted entities with trade inventories and periodic raids/demands? Do they have distinct personalities (e.g. aggressive north, merchant south)?
14. **War — how does combat actually play?** Options: (a) auto-resolved battles from army strength, (b) real-time battles on the map where you point your army, (c) tower-defense style — you defend, and attacks on tribes are send-and-resolve.
15. **Can you conquer/destroy a tribe?** Win condition at all, or endless sandbox survival?
16. **Trade mechanics:** Caravans traveling to map edges? Barter ratios that shift with relations, or fixed prices with a currency later (bronze/silver coins)?

## D. Important — Not Blocking

17. Difficulty settings / map generation options (river count, forest density, ore richness)?
18. Disasters: fires, disease outbreaks, wolf attacks, harsh-winter events, droughts?
19. Morale/happiness system affecting work speed and emigration?
20. Education effect: what exactly does the school do mechanically?
21. Religion/shrine: include or cut?
22. Sound/music: procedural minimal audio, free asset packs, or silent for v1?
23. UI style: diegetic minimal or classic panel-heavy strategy UI? (Will draft mockups.)
24. Language: English only for v1?
25. Name of the game?
26. Git: initialize a repository in this folder? (Recommended before any code.)
27. Roads: do haulers/villagers actually pathfind along roads for speed bonus, or is it cosmetic?
28. Water: is drinking water a tracked need, or is water only a crafting/firefighting input?

## Answers Recorded

Answered by the owner on 2026-08-19 (session 1):

| # | Question | Decision |
|---|---|---|
| 1 | Tech stack | **TypeScript + Vite + three.js**, no engine framework |
| 4 | Map size | **512×512 tiles** (owner tried 1024×1024 in session 3, then settled on 512×512) |
| 2 | Camera | **Free RTS orbit** — angled top-down, pan/zoom/rotate freely |
| 3 | World representation | **Tile grid** (Banished/Anno style, snapped buildings) |
| 6 | Scale | **500+ villagers** late-game — instancing/LOD architecture required from day one |
| 7 | Time model | Real-time, pause/1×/2×/4× |
| 8 | Seasons | **Four seasons with harsh winter, no day/night cycle**; ~20–30 real min per year (tune later) |
| 9–10 | Survival & sim depth | **Full sim**: individual villagers with hunger, warmth, health, happiness; aging, families, children; starvation/freezing kills; colony can collapse |
| 12 | Era progression | **Knowledge system** — school/elders generate knowledge points spent on a visible tech tree |
| 13, 15 | Tribes & goal | **Living tribes, open-ended**: personalities, grow over time, remember your actions; can be subjugated/destroyed; endless sandbox with milestones, no win screen |
| 14 | Combat | **Defend live on your map, attacks on tribes are send-army-and-auto-resolve** |
| 16 | Trade | **Player caravans + barter**: dispatch from Trading Post, travel time, raidable in war; ratios shift with relations; coins as late-era convenience |
| 26 | Git | **Not yet** — revisit when code starts |

Still open: map size (#4), saves (#5, recommend IndexedDB), difficulty options (#17), disasters (#18), morale details (#19), school mechanics (#20), religion (#21), audio (#22), UI style (#23), language (#24), game name (#25), roads mechanics (#27), drinking water (#28).
