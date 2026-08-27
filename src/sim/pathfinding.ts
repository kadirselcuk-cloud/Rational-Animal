import { MAP_SIZE } from '../world/terrain';
import { TileType, type TileMap } from '../world/tiles';

/**
 * A* pathfinding on the tile grid. 8-directional with corner-cut prevention.
 * Water is unwalkable; everything else is walkable for now (steep rock is
 * already classified Rock and stays passable so gatherers can reach it).
 *
 * Reusable scratch arrays with a generation stamp keep repeated searches
 * allocation-free — important once hundreds of villagers path at once.
 */

const DIAG = Math.SQRT2;
const MAX_EXPANSIONS = 60000;

const ROAD_COST = 0.6; // roads are preferred routes

export class PathGrid {
  readonly walkable: Uint8Array;
  private readonly road: Uint8Array;

  private g = new Float32Array(MAP_SIZE * MAP_SIZE);
  private stamp = new Int32Array(MAP_SIZE * MAP_SIZE);
  private cameFrom = new Int32Array(MAP_SIZE * MAP_SIZE);
  private closed = new Uint8Array(MAP_SIZE * MAP_SIZE);
  private generation = 0;

  // Binary min-heap of [f, index] pairs stored flat.
  private heapF: number[] = [];
  private heapI: number[] = [];

  constructor(tiles: TileMap) {
    this.walkable = new Uint8Array(tiles.types.length);
    this.road = new Uint8Array(tiles.types.length);
    for (let i = 0; i < tiles.types.length; i++) {
      this.walkable[i] = tiles.types[i] === TileType.Water ? 0 : 1;
    }
  }

  setRoad(tile: number, isRoad: boolean): void {
    this.road[tile] = isRoad ? 1 : 0;
  }

  isRoad(tile: number): boolean {
    return this.road[tile] === 1;
  }

  /** Buildings claim/release their footprint tiles through this. */
  setWalkable(tile: number, walkable: boolean): void {
    this.walkable[tile] = walkable ? 1 : 0;
  }

  isWalkable(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < MAP_SIZE && z < MAP_SIZE && this.walkable[z * MAP_SIZE + x] === 1;
  }

  /**
   * Returns a list of tile indices from start to goal (inclusive), or null.
   */
  findPath(sx: number, sz: number, gx: number, gz: number): number[] | null {
    if (!this.isWalkable(sx, sz) || !this.isWalkable(gx, gz)) return null;
    const start = sz * MAP_SIZE + sx;
    const goal = gz * MAP_SIZE + gx;
    if (start === goal) return [start];

    this.generation++;
    const gen = this.generation;
    this.heapF.length = 0;
    this.heapI.length = 0;

    const octile = (x: number, z: number) => {
      const dx = Math.abs(x - gx);
      const dz = Math.abs(z - gz);
      return dx > dz ? dx + (DIAG - 1) * dz : dz + (DIAG - 1) * dx;
    };

    this.g[start] = 0;
    this.stamp[start] = gen;
    this.closed[start] = 0;
    this.cameFrom[start] = -1;
    this.heapPush(octile(sx, sz), start);

    let expansions = 0;
    while (this.heapI.length > 0 && expansions < MAX_EXPANSIONS) {
      const current = this.heapPop();
      if (current === goal) return this.reconstruct(goal);
      if (this.closed[current] === 1 && this.stamp[current] === gen) continue;
      this.closed[current] = 1;
      expansions++;

      const cx = current % MAP_SIZE;
      const cz = (current / MAP_SIZE) | 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (!this.isWalkable(nx, nz)) continue;
          // No cutting corners diagonally past an unwalkable tile.
          if (dx !== 0 && dz !== 0 && (!this.isWalkable(cx + dx, cz) || !this.isWalkable(cx, cz + dz))) continue;
          const ni = nz * MAP_SIZE + nx;
          if (this.stamp[ni] === gen && this.closed[ni] === 1) continue;
          const step = (dx !== 0 && dz !== 0 ? DIAG : 1) * (this.road[ni] === 1 ? ROAD_COST : 1);
          const cost = this.g[current] + step;
          if (this.stamp[ni] !== gen || cost < this.g[ni]) {
            this.stamp[ni] = gen;
            this.closed[ni] = 0;
            this.g[ni] = cost;
            this.cameFrom[ni] = current;
            this.heapPush(cost + octile(nx, nz), ni);
          }
        }
      }
    }
    return null;
  }

  private reconstruct(goal: number): number[] {
    const path: number[] = [];
    let node = goal;
    while (node !== -1) {
      path.push(node);
      node = this.cameFrom[node];
    }
    path.reverse();
    return path;
  }

  private heapPush(f: number, i: number): void {
    this.heapF.push(f);
    this.heapI.push(i);
    let c = this.heapF.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.heapF[p] <= this.heapF[c]) break;
      [this.heapF[p], this.heapF[c]] = [this.heapF[c], this.heapF[p]];
      [this.heapI[p], this.heapI[c]] = [this.heapI[c], this.heapI[p]];
      c = p;
    }
  }

  private heapPop(): number {
    const top = this.heapI[0];
    const lastF = this.heapF.pop()!;
    const lastI = this.heapI.pop()!;
    if (this.heapI.length > 0) {
      this.heapF[0] = lastF;
      this.heapI[0] = lastI;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1;
        const r = l + 1;
        let m = p;
        if (l < this.heapF.length && this.heapF[l] < this.heapF[m]) m = l;
        if (r < this.heapF.length && this.heapF[r] < this.heapF[m]) m = r;
        if (m === p) break;
        [this.heapF[p], this.heapF[m]] = [this.heapF[m], this.heapF[p]];
        [this.heapI[p], this.heapI[m]] = [this.heapI[m], this.heapI[p]];
        p = m;
      }
    }
    return top;
  }
}
