import {
  MAP_SIZE,
  MOUNTAIN_LINE,
  SNOW_LINE,
  WATER_LEVEL,
  slopeAt,
  terrainNoise,
  type Terrain,
} from './terrain';

/**
 * Gameplay tile layer: every tile of the grid gets a type derived from the
 * heightfield. This is the data the simulation will run on (pathfinding,
 * resource gathering, building placement) — visuals are derived from it, not
 * the other way round.
 *
 * Owner resource rules encoded here:
 *  - Straw fields form near rivers/lakes on low flat ground.
 *  - Clay deposits hug the waterline.
 *  - Forests cluster; mountains/rock carry stone & future ore.
 */

export enum TileType {
  Grass = 0,
  Water = 1,
  Forest = 2,
  Straw = 3,
  Clay = 4,
  Rock = 5,
  Snow = 6,
}

export enum OreType {
  None = 0,
  Copper = 1,
  Tin = 2,
  Iron = 3,
  Coal = 4,
}

export interface TileMap {
  size: number;
  types: Uint8Array;
  /** Manhattan-ish BFS distance (in tiles) to the nearest water tile. */
  distToWater: Uint16Array;
  /** Ore deposits on rock tiles (OreType values). */
  ores: Uint8Array;
  /** Shallow pond water (forest clay ponds) — no fish, no fishing huts. */
  shallow: Uint8Array;
}

export function tileIndex(x: number, z: number): number {
  return z * MAP_SIZE + x;
}

export function classifyTiles(terrain: Terrain, seed: number): TileMap {
  const size = terrain.size;
  const V = size + 1;
  const count = size * size;
  const types = new Uint8Array(count);
  const distToWater = new Uint16Array(count).fill(0xffff);

  // Tile height = average of its 4 corners.
  const tileH = new Float32Array(count);
  const tileSlope = new Float32Array(count);
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const i = tileIndex(x, z);
      const a = terrain.heights[z * V + x];
      const b = terrain.heights[z * V + x + 1];
      const c = terrain.heights[(z + 1) * V + x];
      const d = terrain.heights[(z + 1) * V + x + 1];
      tileH[i] = (a + b + c + d) * 0.25;
      tileSlope[i] = slopeAt(terrain.heights, x, z);
    }
  }

  // Water BFS — run again after the forest ponds are carved.
  const runWaterBFS = (): void => {
    distToWater.fill(0xffff);
    const queue: number[] = [];
    for (let i = 0; i < count; i++) {
      if (types[i] === TileType.Water) {
        distToWater[i] = 0;
        queue.push(i);
      }
    }
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      const x = i % size;
      const z = (i / size) | 0;
      const d = distToWater[i] + 1;
      if (x > 0 && distToWater[i - 1] > d) { distToWater[i - 1] = d; queue.push(i - 1); }
      if (x < size - 1 && distToWater[i + 1] > d) { distToWater[i + 1] = d; queue.push(i + 1); }
      if (z > 0 && distToWater[i - size] > d) { distToWater[i - size] = d; queue.push(i - size); }
      if (z < size - 1 && distToWater[i + size] > d) { distToWater[i + size] = d; queue.push(i + size); }
    }
  };

  // Pass 1: water.
  for (let i = 0; i < count; i++) {
    if (tileH[i] < WATER_LEVEL - 0.05) types[i] = TileType.Water;
  }
  runWaterBFS();

  // Pass 2: everything else, most specific first.
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const i = tileIndex(x, z);
      if (types[i] === TileType.Water) continue;
      const h = tileH[i];
      const slope = tileSlope[i];
      const dist = distToWater[i];

      if (h > SNOW_LINE) {
        types[i] = TileType.Snow;
      } else if (h > MOUNTAIN_LINE || slope > 1.0) {
        types[i] = TileType.Rock;
      } else if (
        dist <= 3 && h < 3.5 && slope < 0.6 &&
        terrainNoise(x / 16, z / 16, seed ^ 0xc1a4, 2) > 0.6
      ) {
        types[i] = TileType.Clay;
      } else if (
        dist <= 10 && h < 5 && slope < 0.5 &&
        terrainNoise(x / 28, z / 28, seed ^ 0x57aa, 3) > 0.53
      ) {
        types[i] = TileType.Straw;
      } else if (
        h > 0.6 && h < MOUNTAIN_LINE && slope < 0.85 &&
        terrainNoise(x / 64, z / 64, seed ^ 0xf07e57, 3) > 0.52
      ) {
        types[i] = TileType.Forest;
      } else {
        types[i] = TileType.Grass;
      }
    }
  }

  // Owner rule (session 28): small clay ponds hide in the forests — shallow
  // puddles ringed with clay. No fish live in them (no fishing huts), but
  // they open clay digging far from the rivers.
  const shallow = new Uint8Array(count);
  {
    const hash = (a: number, b: number) => {
      let h = (seed | 0) ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const forestTiles: number[] = [];
    for (let i = 0; i < count; i++) {
      const x = i % size;
      const z = (i / size) | 0;
      if (x < 4 || z < 4 || x >= size - 4 || z >= size - 4) continue;
      if (types[i] === TileType.Forest && tileH[i] > 1.5 && tileH[i] < 12 && tileSlope[i] < 0.5) forestTiles.push(i);
    }
    const PONDS = 30;
    const V2 = size + 1;
    for (let p = 0; p < PONDS && forestTiles.length > 0; p++) {
      const center = forestTiles[Math.floor(hash(p, 0x90d) * forestTiles.length)];
      const cx = center % size;
      const cz = (center / size) | 0;
      // 2×2 shallow water core: sink the bed just under the waterline.
      for (let dz = 0; dz <= 1; dz++) {
        for (let dx = 0; dx <= 1; dx++) {
          const i = (cz + dz) * size + (cx + dx);
          types[i] = TileType.Water;
          shallow[i] = 1;
        }
      }
      for (let gz = 0; gz <= 2; gz++) {
        for (let gx = 0; gx <= 2; gx++) {
          terrain.heights[(cz + gz) * V2 + (cx + gx)] = WATER_LEVEL - 0.55;
        }
      }
      // Clay ring around the pond, banks blended down toward the water.
      for (let dz = -1; dz <= 2; dz++) {
        for (let dx = -1; dx <= 2; dx++) {
          const onEdge = dx === -1 || dz === -1 || dx === 2 || dz === 2;
          if (!onEdge) continue;
          const i = (cz + dz) * size + (cx + dx);
          if (types[i] !== TileType.Water) types[i] = TileType.Clay;
        }
      }
      for (let gz = -1; gz <= 3; gz++) {
        for (let gx = -1; gx <= 3; gx++) {
          const onEdge = gx === -1 || gz === -1 || gx === 3 || gz === 3;
          if (!onEdge) continue;
          const ci = (cz + gz) * V2 + (cx + gx);
          terrain.heights[ci] = (terrain.heights[ci] + (WATER_LEVEL + 0.5)) / 2;
        }
      }
    }
  }
  runWaterBFS();

  const ores = seedOres(types, size, seed);
  return { size, types, distToWater, ores, shallow };
}

/**
 * Ore deposits: blob-shaped patches on rock tiles. Copper/tin power the
 * bronze age, iron and coal the iron age.
 */
function seedOres(types: Uint8Array, size: number, seed: number): Uint8Array {
  const ores = new Uint8Array(size * size);
  const rockTiles: number[] = [];
  for (let i = 0; i < types.length; i++) {
    if (types[i] === TileType.Rock) rockTiles.push(i);
  }
  if (rockTiles.length === 0) return ores;

  const hash = (a: number, b: number) => {
    let h = (seed | 0) ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  const patches: [OreType, number][] = [
    [OreType.Copper, 6],
    [OreType.Tin, 5],
    [OreType.Iron, 7],
    [OreType.Coal, 6],
  ];
  let salt = 0;
  for (const [ore, count] of patches) {
    for (let p = 0; p < count; p++) {
      const center = rockTiles[Math.floor(hash(salt++, ore) * rockTiles.length)];
      const cx = center % size;
      const cz = (center / size) | 0;
      const radius = 2 + Math.floor(hash(salt++, ore) * 3);
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = cx + dx;
          const z = cz + dz;
          if (x < 0 || z < 0 || x >= size || z >= size) continue;
          if (dx * dx + dz * dz > radius * radius) continue;
          const i = z * size + x;
          if (types[i] === TileType.Rock && hash(i, salt) > 0.35) ores[i] = ore;
        }
      }
    }
  }
  return ores;
}
