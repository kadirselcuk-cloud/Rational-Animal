import * as THREE from 'three';
import type { Terrain } from '../world/terrain';
import { BUILDING_SPECS, type Building, type BuildingKind } from '../sim/buildings';
import {
  VARIANT_COUNT, kit, kitFencePerimeter, kitHouse, kitReady, kitRoof, kitTinted, kitWallPieceMesh,
  loadKit, onKitReady, patternedBox, patternedMesh, placeEdgePiece,
  type KitHouseOptions,
} from './kit';

/**
 * Composed low-poly meshes per building kind — each building should read as
 * what it does: log piles at the woodcutter, drying racks at the hunter,
 * a garden at the school, a dome for the brick oven.
 *
 * Buildings are few and change state rarely; each gets a plain mesh group
 * rebuilt when its state changes (site stakes → timber frame → finished).
 */

const FRAME_MAT = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
const WOOD_DARK = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
const WOOD_MID = new THREE.MeshLambertMaterial({ color: 0x9a7b52 });
const ROOF_BROWN = new THREE.MeshLambertMaterial({ color: 0x6e4a33 });
const ROOF_BLUE = new THREE.MeshLambertMaterial({ color: 0x46617a });
const ROOF_GREEN = new THREE.MeshLambertMaterial({ color: 0x4d7a4f });
const ROOF_RED = new THREE.MeshLambertMaterial({ color: 0x8a3a30 });
const ROOF_SLATE = new THREE.MeshLambertMaterial({ color: 0x565248 });
const ROOF_STRAW = new THREE.MeshLambertMaterial({ color: 0xb7a14f });
const BRICK_MAT = new THREE.MeshLambertMaterial({ color: 0x9a5a42 });
const DOOR_MAT = new THREE.MeshLambertMaterial({ color: 0x4a3626 });
const GRASS_MAT = new THREE.MeshLambertMaterial({ color: 0x5f7d44 });
const CLAY_MAT = new THREE.MeshLambertMaterial({ color: 0x96603a });

function shadow<T extends THREE.Mesh>(m: T): T {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Gabled roof: ridge along the z axis, with a small overhang. */
function gableRoofGeometry(w: number, d: number, h: number): THREE.BufferGeometry {
  const hw = w / 2 + 0.15;
  const hd = d / 2 + 0.15;
  // Two slopes + two gable triangles, ridge along z.
  const positions = [
    // left slope
    -hw, 0, -hd, -hw, 0, hd, 0, h, hd, -hw, 0, -hd, 0, h, hd, 0, h, -hd,
    // right slope
    hw, 0, hd, hw, 0, -hd, 0, h, -hd, hw, 0, hd, 0, h, -hd, 0, h, hd,
    // front gable (z = +hd)
    -hw, 0, hd, hw, 0, hd, 0, h, hd,
    // back gable (z = -hd)
    hw, 0, -hd, -hw, 0, -hd, 0, h, -hd,
  ];
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Walls + roof + door, centered at origin. Square-ish buildings get a pyramid
 * roof; clearly rectangular ones a proper gabled roof along their long axis.
 */
function hut(w: number, d: number, wallH: number, wallMat: THREE.Material, roofMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const walls = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat));
  walls.position.y = wallH / 2;
  g.add(walls);
  if (Math.abs(w - d) > 0.35) {
    const roofH = 0.35 + Math.min(w, d) * 0.3;
    const geom = w > d ? gableRoofGeometry(d, w, roofH) : gableRoofGeometry(w, d, roofH);
    const roof = shadow(new THREE.Mesh(geom, roofMat));
    if (w > d) roof.rotation.y = Math.PI / 2; // ridge along the longer side
    roof.position.y = wallH;
    g.add(roof);
  } else {
    const roof = shadow(new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), roofMat));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w * 0.78, 0.4 + Math.max(w, d) * 0.28, d * 0.78);
    roof.position.y = wallH + roof.scale.y / 2;
    g.add(roof);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.35, Math.min(0.7, wallH * 0.55), 0.06), DOOR_MAT);
  door.position.set(0, door.geometry.parameters.height / 2, d / 2 + 0.03);
  g.add(door);
  return g;
}

function post(h: number, r = 0.06): THREE.Mesh {
  const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 5), WOOD_DARK));
  m.position.y = h / 2;
  return m;
}

function logPile(): THREE.Group {
  const g = new THREE.Group();
  const geom = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 6);
  geom.rotateX(Math.PI / 2);
  const positions: [number, number][] = [[-0.13, 0.12], [0.13, 0.12], [0, 0.33]];
  for (const [x, y] of positions) {
    const log = shadow(new THREE.Mesh(geom, WOOD_MID));
    log.position.set(x, y, 0);
    g.add(log);
  }
  return g;
}

function stakesAndOutline(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const stakeGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 4);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const stake = new THREE.Mesh(stakeGeom, FRAME_MAT);
    stake.position.set((sx * (w - 0.3)) / 2, 0.3, (sz * (d - 0.3)) / 2);
    g.add(stake);
  }
  const outline = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.08, d - 0.2), FRAME_MAT);
  outline.position.y = 0.04;
  g.add(outline);
  return g;
}

function timberFrame(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const postGeom = new THREE.CylinderGeometry(0.08, 0.08, 1.3, 5);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = shadow(new THREE.Mesh(postGeom, FRAME_MAT));
    p.position.set((sx * (w - 0.3)) / 2, 0.65, (sz * (d - 0.3)) / 2);
    g.add(p);
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.15, d - 0.2), FRAME_MAT);
  floor.position.y = 0.1;
  g.add(floor);
  return g;
}

function fencePerimeter(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const geom = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4);
  const step = 0.8;
  for (let x = -w / 2; x <= w / 2; x += step) {
    for (const z of [-d / 2, d / 2]) {
      const p = new THREE.Mesh(geom, WOOD_DARK);
      p.position.set(x, 0.25, z);
      g.add(p);
    }
  }
  for (let z = -d / 2 + step; z <= d / 2 - step; z += step) {
    for (const x of [-w / 2, w / 2]) {
      const p = new THREE.Mesh(geom, WOOD_DARK);
      p.position.set(x, 0.25, z);
      g.add(p);
    }
  }
  return g;
}

// Flat-color roof overrides for the kit's red-shingle default.
const ROOF_C = {
  slate: 0x6b6577,
  green: 0x4d7a4f,
  blue: 0x46617a,
  straw: 0xb7a14f,
  brown: 0x8a5a3c,
  purple: 0x6a4a72,
  schoolRed: 0x7a4a52,
};
/** Stable per-building hash for shade variants and prop picks. */
function buildingHash(b: Building): number {
  return Math.abs(Math.floor(b.centerX) * 92821 + Math.floor(b.centerZ) * 31337) | 0;
}

/** Kit wooden props are pinkish out of the box — multiply them down to one
 *  of a few dark wood tones, picked per prop (owner rule). */
const DARK_WOOD_TINTS = [0x96755a, 0x86644a, 0x775640, 0xa07f62];

function darkWoodProp(name: string, seed: number): THREE.Group {
  return kitTinted(name, DARK_WOOD_TINTS[seed % DARK_WOOD_TINTS.length]);
}

const SMOKE_MAT = new THREE.MeshLambertMaterial({ color: 0xcfcfd4, transparent: true, opacity: 0.45, depthWrite: false });

/** Chimney smoke: three puffs animated by update() while visible. */
function makeSmoke(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.07 + i * 0.02, 6, 5), SMOKE_MAT);
    puff.position.set(x, y, z);
    g.add(puff);
  }
  g.visible = false;
  return g;
}

/**
 * Everyday clutter in FRONT of a dwelling (owner rules: 1–2 objects on the
 * front yard, beside the door — never blocking it, never at stiff corners,
 * and no street lights).
 */
function houseProps(hash: number): THREE.Group {
  const g = new THREE.Group();
  const makers: ((px: number, pz: number, r: number) => THREE.Object3D)[] = [
    (px, pz, r) => {
      const bench = darkWoodProp('stall-bench', Math.abs(Math.floor(px * 73 + pz * 131)));
      bench.position.set(px, 0, pz);
      bench.rotation.y = r;
      return bench;
    },
    (px, pz, r) => {
      const stool = darkWoodProp('stall-stool', Math.abs(Math.floor(px * 91 + pz * 57)));
      stool.position.set(px, 0, pz);
      stool.rotation.y = r;
      return stool;
    },
    (px, pz, r) => {
      // hay pile
      const hay = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), ROOF_STRAW));
      hay.scale.y = 0.5;
      hay.position.set(px, 0.09, pz);
      hay.rotation.y = r;
      return hay;
    },
    (px, pz, r) => {
      const barrel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.3, 7), WOOD_DARK));
      barrel.position.set(px, 0.15, pz);
      barrel.rotation.y = r;
      return barrel;
    },
    (px, pz, r) => {
      // firewood pile
      const pile = logPile();
      pile.scale.setScalar(0.55);
      pile.position.set(px, 0, pz);
      pile.rotation.y = r;
      return pile;
    },
    (px, pz, r) => {
      const crate = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), WOOD_MID));
      crate.position.set(px, 0.13, pz);
      crate.rotation.y = r;
      return crate;
    },
  ];
  // The yard is the strip in front of the house face (z > 0.7 with the house
  // pushed back); the door corridor |x| < ~0.35 stays clear, two objects go
  // on OPPOSITE sides, and rotations stay small so long props (benches) never
  // swing into the corridor or the house.
  const count = 1 + (hash % 2);
  const sides = count === 2 ? [1, -1] : [((hash >> 1) & 1) === 0 ? 1 : -1];
  for (let i = 0; i < count; i++) {
    const px = sides[i] * (0.55 + ((hash >> (i * 3)) % 3) * 0.1);
    const pz = 0.79 + ((hash >> (i * 4 + 2)) % 2) * 0.08;
    const rot = (((hash >> (i * 5)) % 5) - 2) * 0.2;
    const maker = makers[(hash >> (i * 4 + 3)) % makers.length];
    const prop = maker(px, pz, rot);
    prop.scale.multiplyScalar(0.8);
    g.add(prop);
  }
  return g;
}

/**
 * A workshop's dwelling hut, 20% smaller on a 2×2 material platform — same
 * treatment as houses (owner rule). Centered on its own 2×2; position it
 * where the hut half of the building goes.
 */
function shopHut(opts: KitHouseOptions, floorPattern: 'planks' | 'darkStone', variant: number): THREE.Group {
  const g = new THREE.Group();
  const floor = patternedBox(1.94, 0.12, 1.94, floorPattern, variant);
  floor.position.y = 0.06;
  g.add(floor);
  const hut = kitHouse(2, 2, { ...opts, variant });
  hut.scale.setScalar(0.8);
  hut.position.y = 0.12;
  g.add(hut);
  return g;
}

/**
 * Crafter yard (owner rule): 4×2 footprint — a 2×2 dwelling on the west half,
 * and a 2×2 roofless open-air workshop on the east half: a rear work frame
 * (two posts + crossbeam to hang things from), the craft's tools, and a sales
 * stall facing the south (long) edge. Tools are added by the caller into the
 * east half (x ≈ 0.4..1.6).
 */
function crafterYard(houseOpts: KitHouseOptions): THREE.Group {
  const g = new THREE.Group();
  const house = shopHut(houseOpts, 'planks', houseOpts.variant ?? 0);
  house.position.set(-1, 0, 0);
  g.add(house);
  for (const px of [0.35, 1.65]) {
    const p = kit('pillar-wood');
    p.position.set(px, 0, -0.65);
    g.add(p);
  }
  const beam = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, 0.07), WOOD_DARK));
  beam.position.set(1, 0.97, -0.65);
  g.add(beam);
  const stall = darkWoodProp('stall', houseOpts.variant ?? 0);
  stall.rotation.y = Math.PI / 2;
  stall.position.set(1, 0, 0.62);
  g.add(stall);
  return g;
}

/**
 * Kenney-kit versions of the building kinds. Structures (walls/roofs) come
 * from the kit; identity props (log piles, anvils, ovens…) stay as the
 * existing primitives, moved to the building's front where the full-footprint
 * kit walls would now swallow them. Returns null for kinds that keep their
 * all-primitive look (pits, kilns, mounds, fields).
 */
function buildCompleteKit(b: Building): THREE.Group | null {
  const g = new THREE.Group();
  // Layouts are authored for the base footprint; placement rotation is
  // applied to the finished group by the renderer.
  const { w, d } = BUILDING_SPECS[b.spec.kind];
  const hash = buildingHash(b);
  const v = hash % VARIANT_COUNT;

  /** small identity props parked just outside the south (door) wall */
  const front = d / 2 + 0.25;

  /**
   * Dwellings sit 20% smaller in their plot on a full-plot platform matching
   * their material, pushed back so the front yard is three times the back
   * margin (owner rule: 5% back, 15% front), with 1–2 everyday objects on
   * the front yard beside the door.
   */
  const dwelling = (opts: KitHouseOptions, floorPattern: 'planks' | 'darkStone'): void => {
    const floor = patternedBox(w - 0.06, 0.12, d - 0.06, floorPattern, v);
    floor.position.y = 0.06;
    g.add(floor);
    const house = kitHouse(2, 2, { ...opts, chimney: true, variant: v });
    house.scale.setScalar(0.8);
    house.position.set(0, 0.12, -0.1);
    const props = houseProps(hash);
    props.position.y = 0.12; // clutter stands on the platform
    g.add(house, props);
  };

  switch (b.spec.kind) {
    // All plain houses wear thatch (owner rule) on a plank platform.
    case 'house':
      dwelling({ wood: true, roofPattern: 'straw' }, 'planks');
      break;
    case 'stoneHouse':
      dwelling({ roofPattern: 'stoneTile' }, 'darkStone');
      break;
    case 'brickHouse':
      dwelling({ wallPattern: 'brick', roofPattern: 'clayTile' }, 'darkStone');
      break;
    case 'woodcutterLodge': {
      // 4×2: hut west, fenced log yard east — woodpile, stump with an axe in it.
      const lodge = shopHut({ wood: true, roofPattern: 'straw' }, 'planks', v);
      lodge.position.set(-1, 0, 0);
      g.add(lodge);
      const yard = kitFencePerimeter(2, 2, { skip: (side) => side === 'W' });
      yard.position.set(1, 0, 0);
      g.add(yard);
      const pile = logPile();
      pile.position.set(1.4, 0, 0.4);
      pile.rotation.y = Math.PI / 2;
      g.add(pile);
      const stump = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.35, 7), WOOD_MID));
      stump.position.set(0.6, 0.17, -0.35);
      g.add(stump);
      // Axe buried in the stump: angled handle + head.
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 5), WOOD_DARK);
      handle.rotation.z = -0.7;
      handle.position.set(0.78, 0.55, -0.35);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.04), ROOF_SLATE);
      head.rotation.z = -0.7;
      head.position.set(0.63, 0.42, -0.35);
      g.add(handle, head);
      break;
    }
    case 'huntingLodge': {
      // 4×2: hut west, fenced skinning yard east (owner rule). Straw roof.
      const lodge = shopHut({ wood: true, roofPattern: 'straw' }, 'planks', v);
      lodge.position.set(-1, 0, 0);
      g.add(lodge);
      const yard = kitFencePerimeter(2, 2, { skip: (side) => side === 'W' });
      yard.position.set(1, 0, 0);
      g.add(yard);
      // Skinning: drying rack with a stretched hide + work table.
      const p1 = post(1.1);
      p1.position.set(0.5, 0.55, -0.55);
      const p2 = post(1.1);
      p2.position.set(1.5, 0.55, -0.55);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 4), WOOD_DARK);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(1, 1.05, -0.55);
      const hide = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.6, 0.03),
        new THREE.MeshLambertMaterial({ color: 0xb3855a }),
      );
      hide.position.set(1, 0.7, -0.55);
      const table = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.45), WOOD_DARK));
      table.position.set(1, 0.17, 0.25);
      const skin = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.03, 0.3),
        new THREE.MeshLambertMaterial({ color: 0xc79a6b }),
      );
      skin.position.set(1, 0.37, 0.25);
      g.add(p1, p2, bar, hide, table, skin);
      break;
    }
    case 'foresterHut': {
      // 4×2: hut west, fenced sapling garden east (owner rule).
      const hut = shopHut({ wood: true, roofColor: ROOF_C.green }, 'planks', v);
      hut.position.set(-1, 0, 0);
      g.add(hut);
      const garden = kitFencePerimeter(2, 2, { skip: (side) => side === 'W' });
      garden.position.set(1, 0, 0);
      g.add(garden);
      for (const [x, z, s] of [[0.5, -0.5, 0.5], [1.4, -0.4, 0.38], [0.6, 0.45, 0.42], [1.45, 0.5, 0.55]]) {
        const sapling = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.13, s, 5), ROOF_GREEN));
        sapling.position.set(x, s / 2 + 0.05, z);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.1, 4), WOOD_DARK);
        trunk.position.set(x, 0.05, z);
        g.add(sapling, trunk);
      }
      break;
    }
    case 'fishingHut': {
      // 4×2: hut west, plank dock east reaching the water (owner rule). Straw roof.
      const hut = shopHut({ wood: true, roofPattern: 'straw' }, 'planks', v);
      hut.position.set(-1, 0, 0);
      g.add(hut);
      const dock = patternedBox(2.4, 0.1, 1.5, 'planks', v);
      dock.position.set(1.15, 0.3, 0);
      g.add(dock);
      for (const [px, pz] of [[0.35, -0.6], [0.35, 0.6], [2.2, -0.6], [2.2, 0.6]]) {
        const p = post(1.0, 0.06);
        p.position.set(px, 0.5 - 0.35, pz); // driven low — the shore drops toward the water
        g.add(p);
      }
      const barrel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.35, 7), WOOD_DARK));
      barrel.position.set(0.6, 0.35 + 0.17, -0.4);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 4), WOOD_DARK);
      rod.rotation.z = Math.PI / 5;
      rod.position.set(1.9, 0.9, 0.4);
      g.add(barrel, rod);
      break;
    }
    case 'herbalistHut': {
      // 4×2: hut west; herb garden with cauldron and work table east (owner rule).
      const hut = shopHut({ wood: true, roofColor: 0x3a5f3c }, 'planks', v);
      hut.position.set(-1, 0, 0);
      g.add(hut);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.8), GRASS_MAT);
      bed.position.set(0.75, 0.04, 0.4);
      bed.receiveShadow = true;
      g.add(bed);
      const herbColors = [0x6f9a4a, 0x89a83f, 0x557f3a, 0x9ab04e];
      for (let i = 0; i < 6; i++) {
        const herb = new THREE.Mesh(
          new THREE.SphereGeometry(0.07 + (i % 3) * 0.02, 5, 4),
          new THREE.MeshLambertMaterial({ color: herbColors[i % herbColors.length] }),
        );
        herb.position.set(0.4 + (i % 3) * 0.35, 0.12, 0.2 + Math.floor(i / 3) * 0.4);
        g.add(herb);
      }
      // Cauldron on three legs over a fire ring.
      const pot = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshLambertMaterial({ color: 0x2e3236 })));
      pot.scale.y = 0.8;
      pot.position.set(1.55, 0.3, -0.35);
      const brew = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.03, 8),
        new THREE.MeshLambertMaterial({ color: 0x5f8f4a }),
      );
      brew.position.set(1.55, 0.44, -0.35);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.08, 8), ROOF_SLATE);
      ring.position.set(1.55, 0.04, -0.35);
      const table = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.4), WOOD_DARK));
      table.position.set(0.6, 0.17, -0.5);
      g.add(pot, brew, ring, table);
      break;
    }
    case 'brickOven': {
      // 4×2 (owner rule): brickmaker's hut west, kiln yard east — the dome
      // 30% smaller than before, with fired-brick stacks beside it.
      const hut = shopHut({ wood: true, roofPattern: b.upgraded ? 'clayTile' : 'straw' }, 'planks', v);
      hut.position.set(-1, 0, 0);
      g.add(hut);
      const base = patternedBox(1.05, 0.2, 1.05, 'stone', v);
      base.position.set(0.9, 0.1, -0.15);
      g.add(base);
      const dome = patternedMesh(new THREE.SphereGeometry(0.48, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'brick', v);
      dome.position.set(0.9, 0.2, -0.15);
      g.add(dome);
      const flue = patternedBox(0.15, 0.55, 0.15, 'brick', v);
      flue.position.set(1.1, 0.6, -0.3);
      g.add(flue);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.08), DOOR_MAT);
      mouth.position.set(0.9, 0.3, 0.35);
      g.add(mouth);
      const bigStack = patternedBox(0.4, 0.3, 0.3, 'brick', v);
      bigStack.position.set(1.55, 0.15, 0.55);
      const smallStack = patternedBox(0.24, 0.16, 0.22, 'brick', v);
      smallStack.position.set(1.15, 0.08, 0.62);
      g.add(bigStack, smallStack);
      break;
    }
    case 'clayPit': {
      // 5×3 (owner rule): the 3×3 digging pit west; hand cart, stacked clay,
      // and a shovel on the eastern strip.
      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 2.8), CLAY_MAT);
      bed.position.set(-1, 0.06, 0);
      bed.receiveShadow = true;
      g.add(bed);
      for (const [dx, dz, s] of [[-1.7, 0.5, 0.3], [-0.25, -0.45, 0.22], [-0.85, 0.85, 0.18]]) {
        const mound = shadow(new THREE.Mesh(new THREE.SphereGeometry(s, 6, 4), new THREE.MeshLambertMaterial({ color: 0xa86c42 })));
        mound.position.set(dx, 0.1, dz);
        mound.scale.y = 0.5;
        g.add(mound);
      }
      const cart = darkWoodProp('cart', v + 1);
      cart.rotation.y = -0.35;
      cart.position.set(1.7, 0, -0.55);
      g.add(cart);
      // stacked clay slabs
      const slab1 = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.36), CLAY_MAT));
      slab1.position.set(1.15, 0.09, 0.55);
      const slab2 = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.3), CLAY_MAT));
      slab2.position.set(1.17, 0.26, 0.53);
      slab2.rotation.y = 0.2;
      g.add(slab1, slab2);
      // shovel stuck in the ground
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.7, 5), WOOD_DARK);
      shaft.rotation.z = 0.5;
      shaft.position.set(1.85, 0.4, 0.5);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.03), ROOF_SLATE);
      blade.rotation.z = 0.5;
      blade.position.set(1.68, 0.1, 0.5);
      g.add(shaft, blade);
      break;
    }
    case 'toolmaker': {
      const shop = shopHut({ wood: true, roofPattern: b.upgraded ? 'clayTile' : 'straw' }, 'planks', v);
      shop.position.set(-0.5, 0, 0);
      g.add(shop);
      const anvil = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.2), ROOF_SLATE));
      anvil.position.set(w / 2 - 0.4, 0.2, 0.3);
      const bench = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.35), WOOD_DARK));
      bench.position.set(w / 2 - 0.5, 0.17, -0.4);
      g.add(anvil, bench);
      break;
    }
    case 'storageShed': {
      // Open-sided shelter: plank floor, kit posts, big straw kit roof, crates.
      const floor = patternedBox(w - 0.1, 0.1, d - 0.1, 'planks', v);
      floor.position.y = 0.05;
      g.add(floor);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const p = kit('pillar-wood');
        p.position.set(sx * (w / 2 - 0.5), 0.1, sz * (d / 2 - 0.5));
        g.add(p);
      }
      g.add(kitRoof(w, d, 1.1, { pattern: 'straw', gablePattern: 'wood', variant: v }));
      const crate1 = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), WOOD_MID));
      crate1.position.set(-0.4, 0.35, 0);
      const crate2 = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), WOOD_DARK));
      crate2.position.set(0.35, 0.3, 0.2);
      g.add(crate1, crate2);
      break;
    }
    case 'stockpile': {
      // The founding platform: plank deck, corner posts, straw roof overhead
      // (goods stack on the deck via the storage-fill renderer).
      const deck = patternedBox(w - 0.2, 0.35, d - 0.2, 'planks', v);
      deck.position.y = 0.18;
      g.add(deck);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const p = post(1.3, 0.11);
        p.position.set((sx * (w - 0.5)) / 2, 0.65, (sz * (d - 0.5)) / 2);
        g.add(p);
      }
      g.add(kitRoof(w, d, 1.3, { pattern: 'straw', gablePattern: 'wood', variant: v }));
      break;
    }
    case 'school': {
      // 2×3 stone schoolhouse in the NW corner, fenced garden on the rest.
      const house = kitHouse(2, 3, { roofPattern: 'clayTile', doorSide: 'E', variant: v });
      house.position.set(-1.5, 0, -1);
      g.add(house);
      const garden = new THREE.Mesh(new THREE.BoxGeometry(w - 2.4, 0.06, d - 0.4), GRASS_MAT);
      garden.position.set(w / 2 - (w - 2.4) / 2 - 0.2, 0.03, 0);
      garden.receiveShadow = true;
      g.add(garden);
      const flowerColors = [0xc75454, 0xd8c25a, 0xffffff, 0x8a5aa8];
      for (let i = 0; i < 7; i++) {
        const f = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 5, 4),
          new THREE.MeshLambertMaterial({ color: flowerColors[i % flowerColors.length] }),
        );
        f.position.set(w / 2 - 0.6 - (i % 3) * 0.7, 0.12, -(d / 2) + 0.8 + ((i * 1.3) % (d - 1.6)));
        g.add(f);
      }
      // Fence skips the tiles the schoolhouse itself borders.
      g.add(kitFencePerimeter(w, d, {
        skip: (side, i) => (side === 'W' && i < 3) || (side === 'N' && i < 2),
      }));
      break;
    }
    case 'tradingPost': {
      const hall = kitHouse(3, 2, { wood: true, roofPattern: 'straw', variant: v });
      hall.position.set(0, 0, -0.5);
      g.add(hall);
      // Stall awning re-covered in dark-yellow thatch to match the hall
      // (the kit's green awning clashed — owner rule); frame keeps kit wood.
      // banner-green's dominant color IS the awning green, so classifying
      // against it patterns exactly the green triangles.
      const stallP = kitWallPieceMesh('stall-green', 'banner-green', 'straw', v);
      stallP.position.set(0.9, 0, d / 2 - 0.4);
      g.add(stallP);
      const cart = darkWoodProp('cart', v);
      cart.rotation.y = Math.PI / 2 + 0.3;
      cart.position.set(-0.9, 0, d / 2 - 0.4);
      g.add(cart);
      break;
    }
    case 'trainingGround': {
      g.add(kitFencePerimeter(w, d));
      for (const [dx, dz] of [[-0.9, -0.6], [0.8, 0.4], [0, -1.2]]) {
        const postM = post(0.9, 0.07);
        postM.position.set(dx, 0.45, dz);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 5, 4), ROOF_STRAW);
        head.position.set(dx, 1.0, dz);
        const arms = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), WOOD_MID);
        arms.position.set(dx, 0.75, dz);
        g.add(postM, head, arms);
      }
      const rack = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.12), WOOD_DARK));
      rack.position.set(w / 2 - 0.7, 0.35, d / 2 - 0.4);
      g.add(rack);
      break;
    }
    case 'weaponsmith': {
      const shop = shopHut({ roofPattern: 'clayTile' }, 'darkStone', v);
      shop.position.set(-0.5, 0, 0);
      g.add(shop);
      const anvil = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.22), ROOF_SLATE));
      anvil.position.set(w / 2 - 0.5, 0.22, 0.25);
      const forge = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.4, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x767268 }),
      );
      forge.position.set(w / 2 - 0.5, 0.2, -0.4);
      const ember = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.1, 0.3),
        new THREE.MeshLambertMaterial({ color: 0xe08a3c, emissive: 0xc04a10 }),
      );
      ember.position.set(w / 2 - 0.5, 0.45, -0.4);
      g.add(anvil, forge, ember);
      break;
    }
    case 'watchtower': {
      // Two-story stone tower, pyramid roof, banner over the door.
      const tower = kitHouse(2, 2, { stories: 2, pyramidRoof: true, roofColor: ROOF_C.slate, variant: v });
      g.add(tower);
      g.add(placeEdgePiece(kit('banner-red'), 'S', 0, 2, 2, 1));
      break;
    }
    case 'barn': {
      g.add(kitHouse(w, d, { wood: true, roofPattern: 'straw', variant: v }));
      const strawPile = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 4), ROOF_STRAW));
      strawPile.position.set(w / 2 - 0.6, 0.22, front + 0.1);
      strawPile.scale.y = 0.55;
      g.add(strawPile);
      break;
    }
    case 'bakery': {
      const shop = shopHut({ wood: true, roofPattern: b.upgraded ? 'clayTile' : 'straw' }, 'planks', v);
      shop.position.set(-0.5, 0, 0);
      g.add(shop);
      const oven = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), BRICK_MAT));
      oven.position.set(w / 2 - 0.5, 0.1, 0);
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.22, 0.08),
        new THREE.MeshLambertMaterial({ color: 0xe08a3c, emissive: 0xc04a10 }),
      );
      glow.position.set(w / 2 - 0.5, 0.22, 0.47);
      g.add(oven, glow);
      break;
    }
    case 'manor': {
      // Two-story stone hall with a steep roof, banners, and a lantern-lit court.
      const hall = kitHouse(4, 3, { stories: 2, highRoof: true, roofPattern: 'clayTile', variant: v });
      hall.position.set(0, 0, -0.5);
      g.add(hall);
      const b1 = placeEdgePiece(kit('banner-red'), 'S', 1, 4, 3, 1);
      const b2 = placeEdgePiece(kit('banner-green'), 'S', 2, 4, 3, 1);
      b1.position.z += -0.5;
      b2.position.z += -0.5;
      g.add(b1, b2);
      const lantern = kit('lantern');
      lantern.position.set(1.5, 0, 1.6);
      g.add(lantern);
      break;
    }
    case 'temple': {
      // Columned stone shrine on a plinth, tall roof, gilded finial.
      const stoneMat = new THREE.MeshLambertMaterial({ color: 0x9a9588 });
      const plinth = shadow(new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 0.3, d - 0.5), stoneMat));
      plinth.position.y = 0.15;
      g.add(plinth);
      const hall = kitHouse(2, 3, { highRoof: true, roofPattern: 'clayTile', variant: v });
      hall.position.set(0, 0.3, -0.5);
      g.add(hall);
      for (const sx of [-1, 0, 1]) {
        const col = kit('pillar-stone');
        col.scale.y = 1.6;
        col.position.set(sx * 1.1, 0.3, d / 2 - 0.7);
        g.add(col);
      }
      break;
    }
    case 'leatherworker': {
      g.add(crafterYard({ wood: true, roofPattern: b.upgraded ? 'clayTile' : 'straw', variant: v }));
      const tub = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.22, 7), WOOD_MID));
      tub.position.set(1.4, 0.11, -0.2);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.02, 7),
        new THREE.MeshLambertMaterial({ color: 0x5a4a30 }),
      );
      water.position.set(1.4, 0.22, -0.2);
      // stretched hide between the rear posts
      const hide = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.5, 0.03),
        new THREE.MeshLambertMaterial({ color: 0x8a5a32 }),
      );
      hide.position.set(1, 0.6, -0.62);
      g.add(tub, water, hide);
      break;
    }
    case 'cobbler': {
      g.add(crafterYard({ wood: true, roofPattern: b.upgraded ? 'clayTile' : 'straw', variant: v }));
      const bench = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.3), WOOD_DARK));
      bench.position.set(0.7, 0.15, -0.3);
      const last = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.3), new THREE.MeshLambertMaterial({ color: 0x5b4636 })));
      last.position.set(0.7, 0.41, -0.3);
      // pair of boots on the stall counter
      const bootMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
      for (const bx of [0.85, 1.1]) {
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.18), bootMat);
        boot.position.set(bx, 0.45, 0.62);
        g.add(boot);
      }
      g.add(bench, last);
      break;
    }
    case 'pottery': {
      g.add(crafterYard({ wood: true, roofPattern: b.upgraded ? 'clayTile' : 'straw', variant: v }));
      const kiln = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.35, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), CLAY_MAT));
      kiln.position.set(1.5, 0.08, -0.3);
      g.add(kiln);
      // wheel bench inside, finished pots on the stall counter
      const bench = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.45), WOOD_DARK));
      bench.position.set(0.6, 0.15, -0.2);
      g.add(bench);
      const potMat = new THREE.MeshLambertMaterial({ color: 0xb0703f });
      for (const [px, s] of [[0.75, 0.1], [1.0, 0.08], [1.25, 0.09]] as [number, number][]) {
        const pot = shadow(new THREE.Mesh(new THREE.SphereGeometry(s, 6, 5), potMat));
        pot.position.set(px, 0.38 + s, 0.62);
        pot.scale.y = 1.25;
        g.add(pot);
      }
      break;
    }
    case 'weaver': {
      g.add(crafterYard({ wood: true, roofPattern: b.upgraded ? 'clayTile' : 'straw', variant: v }));
      // warping frame strung between the rear posts
      const threads = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.55, 0.03),
        new THREE.MeshLambertMaterial({ color: 0xe8ddc4 }),
      );
      threads.position.set(1, 0.55, -0.62);
      const basket = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.22, 7), WOOD_MID));
      basket.position.set(0.6, 0.11, 0.1);
      g.add(threads, basket);
      break;
    }
    case 'tailor': {
      g.add(crafterYard({ wood: true, roofPattern: b.upgraded ? 'clayTile' : 'straw', variant: v }));
      // cloth line between the rear posts, bolt of cloth on the counter
      const cloth = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.45, 0.04),
        new THREE.MeshLambertMaterial({ color: 0xb0a58c }),
      );
      cloth.position.set(1, 0.6, -0.62);
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6),
        new THREE.MeshLambertMaterial({ color: 0x8a6a92 }),
      );
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(1, 0.44, 0.62);
      const table = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.4), WOOD_DARK));
      table.position.set(0.65, 0.17, -0.2);
      g.add(cloth, bolt, table);
      break;
    }
    default:
      // Kinds that keep their all-primitive look (pits, kilns, mounds, fields).
      return null;
  }
  // Refitted workshops show a chimney (owner rule: +20% upgrade).
  if (b.upgraded) {
    const chimney = kit('chimney');
    chimney.scale.y = 1.7;
    chimney.position.set(w / 2 - 0.5, 0, -(d / 2) + 0.5);
    g.add(chimney);
  }
  return g;
}

function buildComplete(b: Building): THREE.Group {
  if (kitReady) {
    const kitGroup = buildCompleteKit(b);
    if (kitGroup) return kitGroup;
  }
  const g = new THREE.Group();
  // Base footprint — placement rotation is applied to the finished group.
  const { w, d } = BUILDING_SPECS[b.spec.kind];

  switch (b.spec.kind) {
    case 'house':
      g.add(hut(w - 0.2, d - 0.2, 1.4, WOOD_MID, ROOF_BROWN));
      break;
    case 'stoneHouse': {
      g.add(hut(w - 0.2, d - 0.2, 1.5, new THREE.MeshLambertMaterial({ color: 0x8a8578 }), ROOF_SLATE));
      break;
    }
    case 'brickHouse': {
      g.add(hut(w - 0.2, d - 0.2, 1.7, BRICK_MAT, ROOF_RED));
      const chimney = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.25), BRICK_MAT));
      chimney.position.set(w / 2 - 0.5, 2.4, 0);
      g.add(chimney);
      break;
    }
    case 'woodcutterLodge': {
      const lodge = hut(1.8, 1.8, 1.2, WOOD_DARK, ROOF_BROWN);
      lodge.position.set(-(w / 2) + 1.05, 0, -(d / 2) + 1.05);
      g.add(lodge);
      const pile = logPile();
      pile.position.set(w / 2 - 0.8, 0, d / 2 - 0.7);
      g.add(pile);
      const stump = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.35, 7), WOOD_MID));
      stump.position.set(w / 2 - 0.7, 0.17, -(d / 2) + 0.8);
      g.add(stump);
      break;
    }
    case 'huntingLodge': {
      const lodge = hut(1.7, 1.7, 1.2, WOOD_DARK, ROOF_BROWN);
      lodge.position.set(0, 0, -(d / 2) + 1.0);
      g.add(lodge);
      // Drying rack with a hide.
      const p1 = post(1.2);
      p1.position.set(-0.6, 0.6, d / 2 - 0.5);
      const p2 = post(1.2);
      p2.position.set(0.6, 0.6, d / 2 - 0.5);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 4), WOOD_DARK);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 1.15, d / 2 - 0.5);
      const hide = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.65, 0.03),
        new THREE.MeshLambertMaterial({ color: 0xb3855a }),
      );
      hide.position.set(0, 0.78, d / 2 - 0.5);
      g.add(p1, p2, bar, hide);
      break;
    }
    case 'foresterHut': {
      g.add(hut(w - 0.4, d - 0.4, 1.2, WOOD_MID, ROOF_GREEN));
      for (const [x, z] of [[w / 2 - 0.25, d / 2 - 0.25], [-(w / 2) + 0.25, d / 2 - 0.3]]) {
        const sapling = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 5), ROOF_GREEN));
        sapling.position.set(x, 0.25, z);
        g.add(sapling);
      }
      break;
    }
    case 'fishingHut': {
      g.add(hut(w - 0.3, d - 0.3, 1.2, WOOD_MID, ROOF_BLUE));
      const barrel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 7), WOOD_DARK));
      barrel.position.set(w / 2 - 0.25, 0.2, d / 2 - 0.15);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 4), WOOD_DARK);
      rod.rotation.z = Math.PI / 5;
      rod.position.set(-(w / 2) + 0.3, 0.7, d / 2 - 0.1);
      g.add(barrel, rod);
      break;
    }
    case 'herbalistHut': {
      g.add(hut(w - 0.3, d - 0.3, 1.2, WOOD_MID, ROOF_GREEN));
      const patch = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.4), GRASS_MAT);
      patch.position.set(w / 2 - 0.45, 0.05, d / 2 - 0.25);
      g.add(patch);
      break;
    }
    case 'toolmaker': {
      const shop = hut(1.8, 1.6, 1.3, WOOD_MID, ROOF_SLATE);
      shop.position.set(-(w / 2) + 1.05, 0, 0);
      g.add(shop);
      const anvil = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.2), ROOF_SLATE));
      anvil.position.set(w / 2 - 0.6, 0.2, 0.3);
      const bench = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.35), WOOD_DARK));
      bench.position.set(w / 2 - 0.6, 0.17, -0.4);
      g.add(anvil, bench);
      break;
    }
    case 'stockpile': {
      // The founding platform: low deck with corner posts (goods stack on it
      // via the storage-fill renderer).
      const deck = shadow(new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.35, d - 0.2), WOOD_MID));
      deck.position.y = 0.18;
      deck.receiveShadow = true;
      g.add(deck);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const p = post(1.3, 0.11);
        p.position.set((sx * (w - 0.5)) / 2, 0.65, (sz * (d - 0.5)) / 2);
        g.add(p);
      }
      break;
    }
    case 'storageShed': {
      // Open-sided shelter: posts + big roof + crates.
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const p = post(1.4, 0.08);
        p.position.set((sx * (w - 0.5)) / 2, 0.7, (sz * (d - 0.5)) / 2);
        g.add(p);
      }
      const roof = shadow(new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), ROOF_STRAW));
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(w * 0.85, 0.6, d * 0.85);
      roof.position.y = 1.4 + 0.3;
      g.add(roof);
      const crate1 = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), WOOD_MID));
      crate1.position.set(-0.4, 0.25, 0);
      const crate2 = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), WOOD_DARK));
      crate2.position.set(0.35, 0.2, 0.2);
      g.add(crate1, crate2);
      break;
    }
    case 'school': {
      // 2×3 schoolhouse in one corner, garden with flowers + fence on the rest.
      const house = hut(1.9, 2.8, 1.6, WOOD_MID, new THREE.MeshLambertMaterial({ color: 0x7a4a52 }));
      house.position.set(-(w / 2) + 1.15, 0, -(d / 2) + 1.6);
      g.add(house);
      const garden = new THREE.Mesh(new THREE.BoxGeometry(w - 2.4, 0.06, d - 0.4), GRASS_MAT);
      garden.position.set(w / 2 - (w - 2.4) / 2 - 0.2, 0.03, 0);
      garden.receiveShadow = true;
      g.add(garden);
      const flowerColors = [0xc75454, 0xd8c25a, 0xffffff, 0x8a5aa8];
      for (let i = 0; i < 7; i++) {
        const f = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 5, 4),
          new THREE.MeshLambertMaterial({ color: flowerColors[i % flowerColors.length] }),
        );
        f.position.set(w / 2 - 0.6 - (i % 3) * 0.7, 0.12, -(d / 2) + 0.8 + ((i * 1.3) % (d - 1.6)));
        g.add(f);
      }
      g.add(fencePerimeter(w - 0.2, d - 0.2));
      break;
    }
    case 'brickOven': {
      // Domed kiln with chimney.
      const dome = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), BRICK_MAT));
      dome.position.y = 0.1;
      const base = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.25, 8), ROOF_SLATE));
      base.position.y = 0.12;
      const chimney = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), BRICK_MAT));
      chimney.position.set(0.3, 1.0, -0.2);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.1), DOOR_MAT);
      mouth.position.set(0, 0.35, 0.76);
      g.add(base, dome, chimney, mouth);
      break;
    }
    case 'clayPit': {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.12, d - 0.2), CLAY_MAT);
      bed.position.y = 0.06;
      bed.receiveShadow = true;
      g.add(bed);
      for (const [dx, dz, s] of [[-0.7, 0.5, 0.3], [0.75, -0.45, 0.22], [0.15, 0.85, 0.18]]) {
        const mound = shadow(new THREE.Mesh(new THREE.SphereGeometry(s, 6, 4), new THREE.MeshLambertMaterial({ color: 0xa86c42 })));
        mound.position.set(dx, 0.1, dz);
        mound.scale.y = 0.5;
        g.add(mound);
      }
      break;
    }
    case 'mine': {
      // Timbered mine portal set into a rock mound.
      const mound = shadow(new THREE.Mesh(new THREE.SphereGeometry(1.1, 7, 5), new THREE.MeshLambertMaterial({ color: 0x767268 })));
      mound.position.set(0, 0.1, -(d / 2) + 0.9);
      mound.scale.set(1, 0.75, 0.9);
      g.add(mound);
      const postGeom = new THREE.BoxGeometry(0.16, 1.0, 0.16);
      const left = shadow(new THREE.Mesh(postGeom, WOOD_DARK));
      left.position.set(-0.45, 0.5, 0.1);
      const right = shadow(new THREE.Mesh(postGeom, WOOD_DARK));
      right.position.set(0.45, 0.5, 0.1);
      const lintel = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.2), WOOD_DARK));
      lintel.position.set(0, 1.0, 0.1);
      const entrance = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.1), DOOR_MAT);
      entrance.position.set(0, 0.45, 0.02);
      const cartCrate = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.35), WOOD_MID));
      cartCrate.position.set(0.6, 0.15, d / 2 - 0.5);
      g.add(left, right, lintel, entrance, cartCrate);
      break;
    }
    case 'smelter': {
      // Stone furnace with tall chimney and ember glow.
      const body = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.2), new THREE.MeshLambertMaterial({ color: 0x767268 })));
      body.position.set(-(w / 2) + 0.9, 0.55, 0);
      const chimney = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0x5c5852 })));
      chimney.position.set(-(w / 2) + 0.9, 1.9, 0);
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.4, 0.08),
        new THREE.MeshLambertMaterial({ color: 0xe08a3c, emissive: 0xc04a10 }),
      );
      glow.position.set(-(w / 2) + 0.9, 0.35, 0.62);
      const bench = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.5), WOOD_DARK));
      bench.position.set(w / 2 - 0.7, 0.17, 0.2);
      g.add(body, chimney, glow, bench);
      break;
    }
    case 'tradingPost': {
      const hall = hut(2.2, 1.9, 1.4, WOOD_MID, ROOF_STRAW);
      hall.position.set(0, 0, -(d / 2) + 1.1);
      g.add(hall);
      // Hitching post + crates for waiting caravans.
      const p = post(1.0);
      p.position.set(-0.8, 0.5, d / 2 - 0.6);
      const crate = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), WOOD_MID));
      crate.position.set(0.5, 0.25, d / 2 - 0.6);
      g.add(p, crate);
      break;
    }
    case 'trainingGround': {
      // Sparring yard: fence, straw training dummies, weapon rack.
      g.add(fencePerimeter(w - 0.3, d - 0.3));
      for (const [dx, dz] of [[-0.9, -0.6], [0.8, 0.4], [0, -1.2]]) {
        const postM = post(0.9, 0.07);
        postM.position.set(dx, 0.45, dz);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 5, 4), ROOF_STRAW);
        head.position.set(dx, 1.0, dz);
        const arms = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), WOOD_MID);
        arms.position.set(dx, 0.75, dz);
        g.add(postM, head, arms);
      }
      const rack = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.12), WOOD_DARK));
      rack.position.set(w / 2 - 0.7, 0.35, d / 2 - 0.4);
      g.add(rack);
      break;
    }
    case 'weaponsmith': {
      const shop = hut(1.8, 1.6, 1.3, WOOD_DARK, ROOF_SLATE);
      shop.position.set(-(w / 2) + 1.05, 0, 0);
      g.add(shop);
      const anvil = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.22), ROOF_SLATE));
      anvil.position.set(w / 2 - 0.7, 0.22, 0.25);
      const forge = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.4, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x767268 }),
      );
      forge.position.set(w / 2 - 0.7, 0.2, -0.4);
      const ember = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.1, 0.3),
        new THREE.MeshLambertMaterial({ color: 0xe08a3c, emissive: 0xc04a10 }),
      );
      ember.position.set(w / 2 - 0.7, 0.45, -0.4);
      g.add(anvil, forge, ember);
      break;
    }
    case 'watchtower': {
      // Tall legs, platform, roof.
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = post(2.6, 0.09);
        leg.position.set(sx * 0.55, 1.3, sz * 0.55);
        g.add(leg);
      }
      const platform = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 1.6), WOOD_MID));
      platform.position.y = 2.6;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.6), FRAME_MAT);
      rail.position.y = 2.9;
      const railInner = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.4, 1.35), new THREE.MeshBasicMaterial({ visible: false }));
      void railInner;
      const roof = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.7, 4), ROOF_BROWN));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 3.7;
      g.add(platform, rail, roof);
      break;
    }
    case 'barn': {
      // Big gabled barn with a straw pile and hay door.
      g.add(hut(w - 0.5, d - 0.4, 1.8, WOOD_DARK, ROOF_STRAW));
      const strawPile = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 4), ROOF_STRAW));
      strawPile.position.set(w / 2 - 0.6, 0.22, d / 2 - 0.45);
      strawPile.scale.y = 0.55;
      g.add(strawPile);
      break;
    }
    case 'bakery': {
      const shop = hut(1.8, 1.6, 1.3, WOOD_MID, ROOF_RED);
      shop.position.set(-(w / 2) + 1.05, 0, 0);
      g.add(shop);
      const oven = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), BRICK_MAT));
      oven.position.set(w / 2 - 0.6, 0.1, 0);
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.22, 0.08),
        new THREE.MeshLambertMaterial({ color: 0xe08a3c, emissive: 0xc04a10 }),
      );
      glow.position.set(w / 2 - 0.6, 0.22, 0.47);
      g.add(oven, glow);
      break;
    }
    case 'manor': {
      // Stone hall with a corner tower, banner, and fenced court.
      const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a8578 });
      const hall = hut(w - 1.2, d - 1.6, 2.2, stoneMat, ROOF_SLATE);
      hall.position.set(0.3, 0, -(d / 2) + (d - 1.6) / 2 + 0.3);
      g.add(hall);
      const tower = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 3.0, 7), stoneMat));
      tower.position.set(-(w / 2) + 0.7, 1.5, -(d / 2) + 0.7);
      const towerRoof = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.8, 7), ROOF_SLATE));
      towerRoof.position.set(-(w / 2) + 0.7, 3.4, -(d / 2) + 0.7);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 4), FRAME_MAT);
      pole.position.set(-(w / 2) + 0.7, 4.2, -(d / 2) + 0.7);
      const banner = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.3, 0.03),
        new THREE.MeshLambertMaterial({ color: 0x9c2f2f }),
      );
      banner.position.set(-(w / 2) + 0.95, 4.45, -(d / 2) + 0.7);
      g.add(tower, towerRoof, pole, banner);
      g.add(fencePerimeter(w - 0.2, d - 0.2));
      break;
    }
    case 'temple': {
      // Columned stone shrine on a plinth, gilded finial on the roof.
      const stoneMat = new THREE.MeshLambertMaterial({ color: 0x9a9588 });
      const plinth = shadow(new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 0.3, d - 0.5), stoneMat));
      plinth.position.y = 0.15;
      g.add(plinth);
      const hall = hut(w - 1.6, d - 1.8, 1.9, stoneMat, ROOF_SLATE);
      hall.position.set(0, 0.3, -(d / 2) + (d - 1.8) / 2 + 0.5);
      g.add(hall);
      const colGeom = new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6);
      for (const sx of [-1, 0, 1]) {
        const col = shadow(new THREE.Mesh(colGeom, stoneMat));
        col.position.set(sx * ((w - 1.6) / 2 - 0.1), 1.1, d / 2 - 0.7);
        g.add(col);
      }
      break;
    }
    case 'leatherworker': {
      g.add(hut(w - 0.4, d - 0.4, 1.2, WOOD_DARK, ROOF_BROWN));
      // Tanning tub and a stretched hide.
      const tub = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.22, 7), WOOD_MID));
      tub.position.set(w / 2 - 0.3, 0.11, d / 2 - 0.25);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.02, 7),
        new THREE.MeshLambertMaterial({ color: 0x5a4a30 }),
      );
      water.position.set(w / 2 - 0.3, 0.22, d / 2 - 0.25);
      const hide = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.6, 0.03),
        new THREE.MeshLambertMaterial({ color: 0x8a5a32 }),
      );
      hide.position.set(-(w / 2) + 0.35, 0.7, d / 2 - 0.12);
      g.add(tub, water, hide);
      break;
    }
    case 'cobbler': {
      g.add(hut(w - 0.3, d - 0.3, 1.25, WOOD_MID, ROOF_BROWN));
      // Cobbler's bench with a last (boot form).
      const bench = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.3), WOOD_DARK));
      bench.position.set(w / 2 - 0.4, 0.15, d / 2 - 0.2);
      const last = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.3), new THREE.MeshLambertMaterial({ color: 0x5b4636 })));
      last.position.set(w / 2 - 0.4, 0.41, d / 2 - 0.2);
      g.add(bench, last);
      break;
    }
    case 'pottery': {
      g.add(hut(w - 0.3, d - 0.3, 1.25, WOOD_MID, ROOF_RED));
      // Kiln mound and a rack of pots out front.
      const kiln = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.35, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), CLAY_MAT));
      kiln.position.set(w / 2 - 0.35, 0.08, d / 2 - 0.3);
      g.add(kiln);
      const potMat = new THREE.MeshLambertMaterial({ color: 0xb0703f });
      for (const [px, s] of [[-0.55, 0.12], [-0.3, 0.09], [-0.05, 0.11]] as [number, number][]) {
        const pot = shadow(new THREE.Mesh(new THREE.SphereGeometry(s, 6, 5), potMat));
        pot.position.set(px, s + 0.02, d / 2 - 0.18);
        pot.scale.y = 1.25;
        g.add(pot);
      }
      break;
    }
    case 'weaver': {
      g.add(hut(w - 0.3, d - 0.3, 1.25, WOOD_MID, ROOF_STRAW));
      // Warping frame with threads out front.
      const f1 = post(0.9, 0.05);
      f1.position.set(-(w / 2) + 0.25, 0.45, d / 2 - 0.15);
      const f2 = post(0.9, 0.05);
      f2.position.set(w / 2 - 0.25, 0.45, d / 2 - 0.15);
      const threads = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.55, 0.5, 0.03),
        new THREE.MeshLambertMaterial({ color: 0xe8ddc4 }),
      );
      threads.position.set(0, 0.6, d / 2 - 0.15);
      g.add(f1, f2, threads);
      break;
    }
    case 'tailor': {
      g.add(hut(w - 0.3, d - 0.3, 1.25, WOOD_MID, new THREE.MeshLambertMaterial({ color: 0x6a4a72 })));
      // Cloth hanging on a line.
      const p1 = post(1.0, 0.05);
      p1.position.set(-(w / 2) + 0.2, 0.5, d / 2 - 0.15);
      const p2 = post(1.0, 0.05);
      p2.position.set(w / 2 - 0.2, 0.5, d / 2 - 0.15);
      const cloth = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.45, 0.04),
        new THREE.MeshLambertMaterial({ color: 0xb0a58c }),
      );
      cloth.position.set(0, 0.72, d / 2 - 0.15);
      g.add(p1, p2, cloth);
      break;
    }
    case 'cropField': {
      const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.18, d - 0.3), new THREE.MeshLambertMaterial({ color: 0x5c4a33 }));
      soil.position.y = 0.09;
      soil.receiveShadow = true;
      g.add(soil);
      const color = new THREE.Color(0x6b7a3a).lerp(new THREE.Color(0xbfa53a), Math.max(0, b.growth - 0.5) * 2);
      const height = 0.08 + b.growth * 0.4;
      const rowMat = new THREE.MeshLambertMaterial({ color });
      for (let r = 0; r < 4; r++) {
        const row = new THREE.Mesh(new THREE.BoxGeometry((w - 0.3) * 0.9, height, (d - 0.3) * 0.14), rowMat);
        row.position.set(0, 0.18 + height / 2, -(d - 0.3) / 2 + (r + 0.5) * ((d - 0.3) / 4));
        row.castShadow = b.growth > 0.3;
        g.add(row);
      }
      break;
    }
  }
  // Refitted workshops show a brick chimney (owner rule: +20% upgrade).
  if (b.upgraded) {
    const chimney = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.7, 0.26), BRICK_MAT));
    chimney.position.set(w / 2 - 0.4, 0.85, -(d / 2) + 0.4);
    g.add(chimney);
  }
  return g;
}

/** Housing kinds that show chimney smoke when the hearth burns. */
const SMOKING_KINDS = new Set<BuildingKind>(['house', 'stoneHouse', 'brickHouse']);
/** Chimney-top in dwelling local coords (0.8-scale kitHouse on its platform,
 *  pushed back 0.1): CHIMNEY_POS (0.35,-0.4)·0.8 − (0,0,0.1),
 *  top = (1 story + 0.75 chimney)·0.8 + 0.12. */
const SMOKE_POS = { x: 0.28, y: 1.53, z: -0.42 };

/**
 * The finished look of a building for the placement ghost — same composition
 * the renderer uses, built from a stand-in Building.
 */
export function buildBuildingPreview(kind: BuildingKind): THREE.Group {
  const fake = {
    spec: BUILDING_SPECS[kind],
    state: 'complete',
    upgraded: false,
    growth: 0.6,
    rot: 0,
    centerX: 0,
    centerZ: 0,
    firewoodStore: 0,
  } as unknown as Building;
  return buildComplete(fake);
}

export class BuildingRenderer {
  private root = new THREE.Group();
  private meshes = new Map<Building, { group: THREE.Group; stage: string; smoke: THREE.Group | null }>();

  constructor(
    scene: THREE.Scene,
    private readonly buildings: Building[],
    private readonly terrain: Terrain,
  ) {
    scene.add(this.root);
    loadKit();
    onKitReady(() => {
      // Swap every primitive stand-in for its kit version on the next update.
      for (const entry of this.meshes.values()) this.root.remove(entry.group);
      this.meshes.clear();
    });
  }

  /**
   * `smokeSeason` — hearth smoke is shown outside summer (owner rule);
   * `time` in seconds drives the smoke animation.
   */
  update(smokeSeason = false, time = 0): void {
    // Drop meshes of demolished/cancelled buildings.
    for (const [b, entry] of this.meshes) {
      if (!this.buildings.includes(b)) {
        this.root.remove(entry.group);
        this.meshes.delete(b);
      }
    }
    for (const b of this.buildings) {
      const stage = b.state === 'complete' ? 'complete' : b.state === 'underConstruction' ? 'frame' : 'site';
      let entry = this.meshes.get(b);
      if (!entry || entry.stage !== stage || b.visualDirty) {
        if (entry) this.root.remove(entry.group);
        const group =
          stage === 'site' ? stakesAndOutline(b.spec.w, b.spec.d)
          : stage === 'frame' ? timberFrame(b.spec.w, b.spec.d)
          : buildComplete(b);
        // Finished buildings are composed for the base footprint and turned
        // to their placement rotation; the site/frame stages already use the
        // rotated (swapped) footprint directly.
        if (stage === 'complete') group.rotation.y = -(b.rot ?? 0) * (Math.PI / 2);
        let smoke: THREE.Group | null = null;
        if (stage === 'complete' && SMOKING_KINDS.has(b.spec.kind)) {
          smoke = makeSmoke(SMOKE_POS.x, SMOKE_POS.y, SMOKE_POS.z);
          group.add(smoke);
        }
        group.position.set(b.centerX, this.terrain.heightAt(b.centerX, b.centerZ), b.centerZ);
        this.root.add(group);
        entry = { group, stage, smoke };
        this.meshes.set(b, entry);
        b.visualDirty = false;
      }
      // Hearth smoke: firewood at home and a season that calls for a fire.
      if (entry.smoke) {
        const on = smokeSeason && b.firewoodStore > 0;
        entry.smoke.visible = on;
        if (on) {
          entry.smoke.children.forEach((puff, i) => {
            const phase = (time * 0.35 + i * 0.33) % 1;
            puff.position.y = SMOKE_POS.y + phase * 0.55;
            const s = 0.6 + phase * 1.1;
            puff.scale.setScalar(s);
          });
        }
      }
    }
  }
}
