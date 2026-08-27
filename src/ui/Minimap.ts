import { MAP_SIZE, type Terrain } from '../world/terrain';
import { OreType, TileType, type TileMap } from '../world/tiles';
import type { Village } from '../sim/village';

const ORE_COLORS: Record<number, [number, number, number]> = {
  [OreType.Copper]: [0xb8, 0x73, 0x33],
  [OreType.Tin]: [0xa8, 0xa8, 0xb4],
  [OreType.Iron]: [0x9a, 0x4f, 0x3a],
  [OreType.Coal]: [0x22, 0x20, 0x1e],
};

/**
 * Corner minimap rendered once from the tile layer (with height shading),
 * plus a per-frame camera marker. Click anywhere on it to jump the camera.
 */

const TILE_COLORS: Record<TileType, [number, number, number]> = {
  [TileType.Grass]: [0x64, 0x78, 0x46],
  [TileType.Water]: [0x39, 0x62, 0x7f],
  [TileType.Forest]: [0x33, 0x4d, 0x2d],
  [TileType.Straw]: [0xc9, 0xb4, 0x58],
  [TileType.Clay]: [0xa3, 0x62, 0x3b],
  [TileType.Rock]: [0x76, 0x72, 0x68],
  [TileType.Snow]: [0xe8, 0xec, 0xee],
};

export class Minimap {
  private base: HTMLCanvasElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private village: Village | null = null;
  private refreshTimer = 0;

  constructor(
    private readonly tiles: TileMap,
    private readonly terrain: Terrain,
    onJump: (x: number, z: number) => void,
  ) {
    const size = tiles.size;
    this.base = document.createElement('canvas');
    this.base.width = size;
    this.base.height = size;
    this.rebuildBase();

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap';
    this.canvas.width = size;
    this.canvas.height = size;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * MAP_SIZE;
      const z = ((e.clientY - rect.top) / rect.height) * MAP_SIZE;
      onJump(x, z);
    });
  }

  private markers: { x: number; z: number; color: string }[] = [];

  /** Static points of interest (tribe camps, etc.). */
  setMarkers(markers: { x: number; z: number; color: string }[]): void {
    this.markers = markers;
  }

  /** Bind the village so roads & buildings appear (owner rule, session 29). */
  bindVillage(v: Village): void {
    this.village = v;
    this.rebuildBase();
  }

  /** Repaint tile colors + roads + buildings. Called every few seconds so
   *  depleted clay, cut straw, quarried rock, and new construction show up. */
  private rebuildBase(): void {
    const size = this.tiles.size;
    const baseCtx = this.base.getContext('2d')!;
    const img = baseCtx.createImageData(size, size);
    const V = size + 1;
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const t = this.tiles.types[z * size + x] as TileType;
        const ore = this.tiles.ores[z * size + x];
        const [r, g, b] = ore !== OreType.None ? ORE_COLORS[ore] : TILE_COLORS[t];
        let shade = 1;
        if (t !== TileType.Water) {
          const hw = this.terrain.heights[z * V + Math.max(x - 1, 0)];
          const he = this.terrain.heights[z * V + Math.min(x + 1, V - 1)];
          shade = Math.min(1.25, Math.max(0.6, 1 - (he - hw) * 0.06));
        }
        const o = (z * size + x) * 4;
        img.data[o] = Math.min(255, r * shade);
        img.data[o + 1] = Math.min(255, g * shade);
        img.data[o + 2] = Math.min(255, b * shade);
        img.data[o + 3] = 255;
      }
    }
    // City layer: roads and buildings painted over the terrain.
    if (this.village) {
      const paint = (tile: number, r: number, g: number, b: number) => {
        const o = tile * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
      };
      for (const [tile, kind] of this.village.roads) {
        if (kind === 'stone') paint(tile, 0xb4, 0xb0, 0xa4);
        else paint(tile, 0x8a, 0x70, 0x4a);
      }
      for (const [tile] of this.village.walls) paint(tile, 0x55, 0x52, 0x4a);
      for (const b of this.village.buildings) {
        const done = b.state === 'complete';
        for (const tile of b.footprintTiles()) {
          if (done) paint(tile, 0xe8, 0xdc, 0xc0);
          else paint(tile, 0xc9, 0xb8, 0x8a);
        }
      }
    }
    baseCtx.putImageData(img, 0, 0);
  }

  /** Call once per frame with the camera's ground target. */
  update(targetX: number, targetZ: number, frameDt = 0): void {
    this.refreshTimer += frameDt;
    if (this.refreshTimer > 10) {
      this.refreshTimer = 0;
      this.rebuildBase();
    }
    const s = this.canvas.width / MAP_SIZE;
    this.ctx.drawImage(this.base, 0, 0);
    for (const m of this.markers) {
      this.ctx.fillStyle = m.color;
      this.ctx.beginPath();
      this.ctx.arc(m.x * s, m.z * s, 5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#00000088';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(targetX * s, targetZ * s, 6, 0, Math.PI * 2);
    this.ctx.stroke();
  }
}
