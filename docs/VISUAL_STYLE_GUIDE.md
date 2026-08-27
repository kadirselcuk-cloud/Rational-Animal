# Visual Style Guide (owner-approved rules, sessions 35–44)

**Read this BEFORE creating or changing any building or visual element.** Every rule here
was set by the owner during the graphics overhaul of 2026-08-24. When adding a new
building kind or prop, follow these rules by default; ask only when a new case genuinely
isn't covered.

## 1. Assets & rendering pipeline

- Buildings & roads use the **Kenney Fantasy Town Kit** (CC0) in `public/models/fantasy-town/`.
  The GLBs are **not self-contained**: `Textures/colormap.png` must stay next to them or
  everything renders white.
- All loading/composition helpers live in [`src/render/kit.ts`](../src/render/kit.ts):
  - Kit conventions: 1×1-tile modular pieces; wall panels are 0.1-thick slabs on a tile's
    +X edge with the decorated face at x=0.4 pointing INWARD (use `placeEdgePiece`);
    roof pieces are 1-tile slopes (eave −X with overhang, ridge +X); road pieces are full
    tiles with center pivot. The chimney piece's body is offset ~0.32 from its origin.
  - Kit UVs point at **palette gradient cells** — you cannot re-texture via kit UVs.
    Patterned surfaces use **box-projected UVs** (`kitPatternedMesh`, `patternedBox`,
    `patternedMesh`). Door/window panels split pattern-vs-trim by palette color
    (`kitWallPieceMesh` + `pieceBaseColors`: all shades ≥8% area of the plain piece).
  - Scene lighting is Lambert-tuned: loader materials are converted to MeshLambertMaterial.

## 2. Materials & textures (procedural, in kit.ts)

| Pattern | Use |
|---|---|
| `straw` | thatch roofs (yellow, layered strands) |
| `clayTile` | red-brown tile roofs |
| `stoneTile` | dark grey slate roofs (stone houses) |
| `wood` | walls: **horizontal round logs** (never vertical, never planks) |
| `planks` | floors/decks/docks (boards with staggered joints) |
| `stone` | walls: irregular rubble, light with ~12% near-black stones |
| `darkStone` | **platforms/pavement** (same rubble at 0.55 brightness) |
| `brick` | brick walls, kilns, brick stacks |

- **Roof follows build cost**: straw-cost → `straw`; clayTiles-cost → `clayTile`;
  stone house → `stoneTile`. **Upgradable workshops wear straw, switching to clayTile
  when upgraded** (`b.upgraded`).
- **Walls show their material** (logs / stone / brick) on plain panels AND the slab part
  of door/window panels; kit trim (frames, shutters) stays.
- **Shade variants**: every building passes `variant: v` (position hash % VARIANT_COUNT)
  so neighbours never look identical. Flat colors go through `applyVariant`.
- **Kit wooden props are pinkish** — always run them through `darkWoodProp(name, seed)`
  (four random dark wood tones). Never place a raw pink kit prop.
- Gable-end triangles match the wall pattern.

## 3. Building layout rules

- **Dwellings (house/stoneHouse/brickHouse)** — `dwelling()` in BuildingRenderer:
  - 20% smaller (scale 0.8), on a **full-plot platform**: `planks` for wood houses,
    `darkStone` for stone/brick.
  - Pushed BACK in the plot: ~5% margin behind, ~15% front yard.
  - **1–2 everyday objects** (bench, stool, hay, barrel, firewood, crate — NO street
    lights/lanterns) on the front yard, opposite sides of the door, never blocking the
    door corridor (|x| < ~0.35), small rotations only, not pinned to corners.
  - Chimney: shortened (0.75×), pattern matches walls (brick→brick, else stone),
    re-centered via `CHIMNEY_POS`. **Smoke** (3 animated puffs) when the home has
    firewood and season ≠ summer; `SMOKE_POS` must track any layout change.
  - Every doorway gets the explicit dark **closed door leaf** (`doorLeaf()` — automatic
    in `kitHouse`).
  - All plain houses wear straw. Stone house = stoneTile roof, brick house = clayTile.
- **Workshops ("shops") follow the yard pattern** — hut + work yard on a wide footprint:
  - The hut is a 2×2 `shopHut()`: 20% smaller on a 2×2 material platform, like houses.
  - 4×2 yards: crafters (pottery/weaver/tannery/cobbler/tailor: roofless workshop with
    rear work frame + tools + a **stall counter facing the long/south edge** with goods
    on it), woodcutter (fenced log yard, woodpile, stump with axe), hunter (fenced
    skinning yard: rack + hide + table), forester (fenced sapling garden), herbalist
    (herb beds + cauldron + table; dark green roof 0x3a5f3c), fisher (plank dock on
    posts), brick oven (kiln dome 30% small + brick stacks).
  - 5×3: clay pit (3×3 pit + cart, stacked clay, shovel).
  - New production buildings should follow this hut+yard formula with identity props.
- **Fisher dock rule**: only the dock half may stand on/over water; the hut half must be
  on land; placement requires the dock side to touch water; `flattenAndClear` levels only
  the hut half. See `isDockTile` in village.ts.
- **Identity props** stay as primitives where no kit piece fits (anvils, ovens, kilns,
  tubs, dummies) — always in the yard/front, never inside the hut footprint.

## 4. Placement & interaction

- **R rotates** the pending building (quarter turns; `specFor(kind, rot)` swaps w/d, the
  renderer composes for the BASE footprint and rotates the finished group by −rot·90°).
- The placement **ghost is the real building**, semi-transparent, over a green/red plate,
  with a **yellow entrance arrow** pointing at the main door (south side, turns with R).
- Buildings persist `rot` in saves. Footprint changes break old-save layouts — warn the
  owner whenever a spec's w/d changes.

## 5. Roads & environment

- Stone roads: kit tiles auto-tiled by neighbors (plain inside, `road-edge` curbs,
  `road-corner` on bends); dirt roads keep trodden-earth quads. Every tile is **tilted to
  the terrain plane** through its four corner heights (`conformTile`) so slopes never
  stair-step; slight 1.04 oversize closes seams.
- Straw resource = **cattail reeds** (thin tapered yellow stalks + rounded brown heads,
  per-vertex colors), not cones.
- Terrain grass has **meadow patchwork**: broad dry-grass tint + mid-scale lush-dark /
  sun-bleached-light patches + fine per-vertex shimmer. Rock/snow/straw/clay tints layer
  on top; SeasonVisuals snapshots base colors at startup.

## 6. Verification workflow (do this after visual changes)

- `npx tsc --noEmit` and `npm run build` must pass.
- Visual check on **http://localhost:5180/showcase.html** (`showcase.html` +
  `src/showcase.ts`): renders every building kind + a road network on flat ground,
  camera via `?x=&z=&zoom=` (grid starts at x=236, z=236, spacing 8; rotated examples at
  x≈226). Screenshot with headless Edge (see memory note / CLAUDE.md):
  `msedge --headless=new --window-size=1600,900 --virtual-time-budget=35000 --screenshot=<png> <url>`
  — a ~6 KB PNG is a blank frame (race), retake; primitives instead of kit models means
  the GLBs hadn't loaded within the budget.
- End every session with the dev server running on **http://localhost:5180**.
