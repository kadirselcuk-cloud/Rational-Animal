# Game Vision — Strategy Survival Browser Game (three.js)

> Recorded from the project owner's instructions on 2026-08-19. This is the source of truth for design intent. Nothing is built until the roadmap is agreed.

## Core Concept
A browser-based **strategy survival game** built with **three.js**, mimicking the **development of civilization** — a settlement gradually advancing from wood/stone technology through bronze to iron and beyond.

## Key Pillars (owner's words, consolidated)
1. **Setting:** Harsh mid-northern climate — think **Germany / Romania / Ukraine** latitude. Cold and demanding, but not arctic.
2. **Map:** **Randomly generated** each game.
3. **Neighbors:** **Tribes on all 4 sides** of the map. The player can **wage war or trade** with them.
4. **Worker management:** The player **assigns workers to a task** and they **work automatically** (indirect control, colony-sim style — not per-unit micromanagement).
5. **Progression:** Mimics civilization development — tools, weapons, and armor **gradually upgrade: wood → stone → bronze → iron → …**
6. **Content breadth:** *Many* resources and goods (food types, hides, pelts, string, linen, fruits, mushrooms, herbs, medicines, shields, weapons, armor…). *All types* of buildings (stockpiles, warehouses, storages, water storage, pottery, woodcutter, blacksmith, school, herbalist, hunter, etc.).

## Tone & Writing (owner instruction, 2026-08-25)
- **All player-facing text** — game intro, era/stage introductions, building & tech descriptions, events, UI flavor — is written in a **humorous, black-humorous, almost-insulting** voice toward the player.
- **The aim is NOT to insult.** The intended effect: as players face their ancestral instincts (eat, survive, hoard, raid), the writing should make them think they are drifting away from the virtues of humanity and becoming no different from animals. The humor carries that mirror.
- Reference text for the voice: the **T0 "Hello World!" introduction** in [SKILL_TREE.md](SKILL_TREE.md) ("Human is a rational animal, says Aristo. You are not there yet...").
- Existing neutral in-game descriptions get rewritten in this voice when the research-game conversion is implemented — **not before the owner's go-ahead**.

## Planned Direction (owner, 2026-08-25; expanded 2026-08-28 — NOT yet approved for implementation)
- The owner intends to convert the game toward a **research & knowledge based game**: the tribe starts from nothing ("Hello World!" stage — little more than a group of animals) and discovers everything on the way.
- [SKILL_TREE.md](SKILL_TREE.md) (tiers T0 "Hello World!" → T8, + Epilogue) is the approved foundation for the future tech tree.
- **2026-08-28 — the phased campaign ("games inside the game"):** the game becomes a tier-by-tier campaign whose *feel* evolves as it progresses — strategy survival & supply-chain management (Banished / Settlers / Manor Lords) through T0–T6, then a clean cut into grand strategy (Total War) for T7–T8, closing with the Epilogue. Full plan, tier arc, and the owner's recorded decisions (research loop, era gates, obsolescence, start screen with the surprised Aristo statue + 4 corner artworks, etc.): [ROADMAP.md](ROADMAP.md) (Roadmap v2, draft).
- **Standing freeze: do not build/implement any of this until the owner explicitly approves Roadmap v2.**

## Art Direction
- Buildings & roads use the **Kenney Fantasy Town Kit** (CC0, `public/models/fantasy-town/`) — owner-approved 2026-08-24, superseding the original all-in-code rule for those. Claude still builds remaining assets in-code (procedural low-poly) where no kit piece fits.
- **No extreme graphics** — small, **semi-realistic, low-poly** models are the target.
- Palette and shapes should read clearly at strategy-game camera distance.

## Confirmed Resource Rules (from owner)
| Resource | Role | Sources |
|---|---|---|
| Wood | Primary build resource; firewood, fences, tools | Chopping trees (efficient); foraging forest (very inefficient) |
| Stone | Primary build resource; stone tools | Mountain areas; forests (very inefficient) |
| Straw | Primary build resource; strings | Straw fields near rivers (efficient); forests (very inefficient) |
| Iron | Secondary — advanced buildings, tools, weapons, armor | Mines (efficient); harvesting from earth (very inefficient) |
| Firewood | Warming houses | Made from wood; collected in forest (inefficient) |
| Clay | Brick and pottery | Harvested from earth near water |
| Brick | Building material | Made from clay; **requires Brick Oven** |
| Brick Tiles | Building material (roofing) | Made from clay; **requires Brick Oven** |
| Fibre | Crafting input | From straw (efficient); forest (very inefficient) |

**Design pattern:** most raw resources have an *efficient dedicated source* and a *very inefficient fallback source* (usually the forest). Preserve this pattern for new resources.

- Full generated resource catalog: [RESOURCES.md](RESOURCES.md) — pending owner review.
- Full generated building catalog: [BUILDINGS.md](BUILDINGS.md) — pending owner review.
- Open design questions: [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)
- Session-by-session record: [CONVERSATION_LOG.md](CONVERSATION_LOG.md)

## Process Rules (owner's instructions to Claude)
- Record all instructions in `.md` files **before** building anything.
- Build the **roadmap together** with the owner — don't start implementation unilaterally.
- Ask questions comprehensively when information is missing.
- Keep a conversation record so a fresh session can resume with full context.
