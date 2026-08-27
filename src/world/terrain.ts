/**
 * Random terrain generation for the 1024x1024 tile grid.
 *
 * Heights live on tile corners: a (size+1)^2 Float32Array, row-major
 * (index = z * (size+1) + x). World water level is y = 0 — anything below is
 * lake/river bed. Mountains come from ridged noise masked to a few regions;
 * rivers start in foothills and walk downhill, carving a channel below water
 * level with soft banks, until they reach a lake or the map edge.
 */

export const MAP_SIZE = 512; // tiles per side, 1 tile = 1 world unit
export const WATER_LEVEL = 0;
// Owner rule: gentle hills rather than extreme peaks — relief is much softer.
export const SNOW_LINE = 30;
export const MOUNTAIN_LINE = 18;

const V = MAP_SIZE + 1; // corners per side

export interface Terrain {
  size: number;
  heights: Float32Array;
  /** Bilinear height sample at any world position. */
  heightAt(x: number, z: number): number;
}

// ---------------------------------------------------------------- noise

function hash(x: number, z: number, seed: number): number {
  let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const tx = smooth(x - xi);
  const tz = smooth(z - zi);
  const a = hash(xi, zi, seed);
  const b = hash(xi + 1, zi, seed);
  const c = hash(xi, zi + 1, seed);
  const d = hash(xi + 1, zi + 1, seed);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}

/** Fractal noise, normalized to [0, 1]. */
function fbm(x: number, z: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, z * freq, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Ridged fractal noise in [0, 1] — sharp crests for mountain ranges. */
function ridged(x: number, z: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(2 * valueNoise(x * freq, z * freq, seed + o * 101) - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------- rivers

const RIVER_COUNT = 6;
const RIVER_DEPTH = 1.8; // channel floor below water level
const RIVER_CORE = 2; // tiles of full-depth channel
const RIVER_BANK = 7; // tiles where banks blend back to terrain

function carveRivers(heights: Float32Array, seed: number): void {
  for (let r = 0; r < RIVER_COUNT; r++) {
    // Source: a foothill point (not a peak, not a lake).
    let sx = -1;
    let sz = -1;
    for (let attempt = 0; attempt < 400; attempt++) {
      const x = 20 + Math.floor(hash(r * 1000 + attempt, 1, seed) * (MAP_SIZE - 40));
      const z = 20 + Math.floor(hash(r * 1000 + attempt, 2, seed) * (MAP_SIZE - 40));
      const h = heights[z * V + x];
      if (h > 4 && h < 16) {
        sx = x;
        sz = z;
        break;
      }
    }
    if (sx < 0) continue;

    let cx = sx;
    let cz = sz;
    let channel = heights[cz * V + cx]; // running minimum — keeps the bed descending
    let dirX = 0;
    let dirZ = 0;
    const visited = new Set<number>();

    for (let step = 0; step < 5000; step++) {
      visited.add(cz * V + cx);
      channel = Math.min(channel, heights[cz * V + cx]);
      const bed = Math.min(channel, 0) - RIVER_DEPTH;

      // Carve a channel with soft banks.
      for (let dz = -RIVER_BANK; dz <= RIVER_BANK; dz++) {
        for (let dx = -RIVER_BANK; dx <= RIVER_BANK; dx++) {
          const px = cx + dx;
          const pz = cz + dz;
          if (px < 0 || pz < 0 || px >= V || pz >= V) continue;
          const d = Math.hypot(dx, dz);
          if (d > RIVER_BANK) continue;
          const i = pz * V + px;
          const t = smoothstep(RIVER_CORE, RIVER_BANK, d);
          const target = bed + t * (heights[i] - bed);
          if (target < heights[i]) heights[i] = target;
        }
      }

      // Reached a lake (well below water level) — stop.
      if (channel < -1.2) break;

      // Step to the most-downhill unvisited neighbor, with momentum + jitter.
      let bestScore = Infinity;
      let bx = 0;
      let bz = 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const px = cx + dx * 2;
          const pz = cz + dz * 2;
          if (px < 1 || pz < 1 || px >= V - 1 || pz >= V - 1) continue;
          const i = pz * V + px;
          if (visited.has(i)) continue;
          const momentum = (dx * dirX + dz * dirZ) * -1.5;
          const jitter = (hash(px, pz, seed ^ (r * 31)) - 0.5) * 2.5;
          const score = heights[i] + momentum + jitter;
          if (score < bestScore) {
            bestScore = score;
            bx = dx;
            bz = dz;
          }
        }
      }
      if (bestScore === Infinity) break; // boxed in
      dirX = bx;
      dirZ = bz;
      cx += bx * 2;
      cz += bz * 2;
      if (cx <= 1 || cz <= 1 || cx >= V - 2 || cz >= V - 2) break; // left the map
    }
  }
}

/**
 * Owner rule: no cliffs plunging into lakes. Wherever ground meets low/under-
 * water terrain, the bank is relaxed to a gentle grade over a few passes —
 * so one lake shore can sit against hills yet still slope softly in.
 */
function softenShores(heights: Float32Array): void {
  const MAX_STEP = 1.1;
  for (let pass = 0; pass < 4; pass++) {
    for (let z = 1; z < V - 1; z++) {
      for (let x = 1; x < V - 1; x++) {
        const i = z * V + x;
        const nMin = Math.min(heights[i - 1], heights[i + 1], heights[i - V], heights[i + V]);
        if (nMin < 3 && heights[i] > nMin + MAX_STEP) {
          heights[i] = nMin + MAX_STEP;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- terrain

export function generateTerrain(seed: number): Terrain {
  const heights = new Float32Array(V * V);

  const sBase = seed;
  const sMask = seed ^ 0x9e3779b9;
  const sRidge = seed ^ 0x51ab7f11;

  for (let z = 0; z < V; z++) {
    const nz = z / MAP_SIZE;
    for (let x = 0; x < V; x++) {
      const nx = x / MAP_SIZE;

      // Rolling lowlands with occasional lake basins.
      const e = fbm(nx * 4, nz * 4, sBase, 5);
      let h = (e - 0.42) * 22;

      // Highlands: broad, gentle hills instead of jagged ranges (owner rule).
      const mask = smoothstep(0.5, 0.85, fbm(nx * 2.2 + 13.7, nz * 2.2 + 5.1, sMask, 3));
      if (mask > 0) {
        const ridge = ridged(nx * 5, nz * 5, sRidge, 3);
        h += ridge * ridge * 28 * mask;
      }

      heights[z * V + x] = h;
    }
  }

  carveRivers(heights, seed);
  softenShores(heights);

  const heightAt = (x: number, z: number): number => {
    const cx = Math.min(Math.max(x, 0), MAP_SIZE - 1e-4);
    const cz = Math.min(Math.max(z, 0), MAP_SIZE - 1e-4);
    const xi = Math.floor(cx);
    const zi = Math.floor(cz);
    const tx = cx - xi;
    const tz = cz - zi;
    const a = heights[zi * V + xi];
    const b = heights[zi * V + xi + 1];
    const c = heights[(zi + 1) * V + xi];
    const d = heights[(zi + 1) * V + xi + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  };

  return { size: MAP_SIZE, heights, heightAt };
}

/** Approximate slope (rise per unit run) at a corner — used for coloring and placement. */
export function slopeAt(heights: Float32Array, x: number, z: number): number {
  const x0 = Math.max(x - 1, 0);
  const x1 = Math.min(x + 1, V - 1);
  const z0 = Math.max(z - 1, 0);
  const z1 = Math.min(z + 1, V - 1);
  const dx = (heights[z * V + x1] - heights[z * V + x0]) / (x1 - x0);
  const dz = (heights[z1 * V + x] - heights[z0 * V + x]) / (z1 - z0);
  return Math.hypot(dx, dz);
}

export { fbm as terrainNoise };
