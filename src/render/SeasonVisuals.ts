import * as THREE from 'three';
import { WATER_LEVEL, type Terrain } from '../world/terrain';

/**
 * Applies seasonal snow to the world: terrain vertex colors blend toward
 * snow, tree canopies frost over, water turns icy pale.
 *
 * The terrain has ~270k vertices, so recoloring is spread across frames in
 * fixed-size chunks — a full snow sweep takes a fraction of a second without
 * ever spiking a frame.
 */

const CHUNK = 24000; // vertices recolored per frame while snow level changes
const SNOW_RATE = 0.12; // snow amount change per second
const SNOW_COLOR = new THREE.Color(0xdfe6ea);
const CANOPY_FROST = new THREE.Color(0xc9d6d2);
const WATER_BASE = new THREE.Color(0x39627f);
const WATER_ICE = new THREE.Color(0x8fb0c2);

export class SeasonVisuals {
  private terrainColors: THREE.BufferAttribute;
  private baseColors: Float32Array;
  private canopyBase: Float32Array;
  private current = 0; // snow amount currently being applied
  private applied = -1; // snow amount the buffer fully reflects
  private sweep = 0;
  private appliedCanopy = -1;

  constructor(
    private readonly terrain: Terrain,
    terrainMesh: THREE.Mesh,
    private readonly canopyMesh: THREE.InstancedMesh,
    private readonly waterMesh: THREE.Mesh,
  ) {
    this.terrainColors = (terrainMesh.geometry.getAttribute('color') as THREE.BufferAttribute);
    this.baseColors = new Float32Array(this.terrainColors.array as Float32Array);
    this.canopyBase = new Float32Array(canopyMesh.instanceColor!.array as Float32Array);
  }

  update(target: number, dt: number): void {
    // Ease the actual snow level toward the calendar's target.
    if (this.current < target) this.current = Math.min(target, this.current + SNOW_RATE * dt);
    else if (this.current > target) this.current = Math.max(target, this.current - SNOW_RATE * dt);

    this.sweepTerrain();
    this.frostCanopy();
    this.freezeWater();
  }

  private sweepTerrain(): void {
    if (Math.abs(this.applied - this.current) < 0.004 && this.sweep === 0) return;
    const colors = this.terrainColors.array as Float32Array;
    const total = colors.length / 3;
    const end = Math.min(this.sweep + CHUNK, total);
    const s = this.current;
    for (let i = this.sweep; i < end; i++) {
      // No snow on lake/river beds (they sit under the water plane).
      const h = this.terrain.heights[i];
      const blend = h < WATER_LEVEL + 0.2 ? 0 : s * 0.85;
      const o = i * 3;
      colors[o] = this.baseColors[o] + (SNOW_COLOR.r - this.baseColors[o]) * blend;
      colors[o + 1] = this.baseColors[o + 1] + (SNOW_COLOR.g - this.baseColors[o + 1]) * blend;
      colors[o + 2] = this.baseColors[o + 2] + (SNOW_COLOR.b - this.baseColors[o + 2]) * blend;
    }
    this.terrainColors.needsUpdate = true;
    this.sweep = end >= total ? 0 : end;
    if (this.sweep === 0) this.applied = this.current;
  }

  private frostCanopy(): void {
    if (Math.abs(this.appliedCanopy - this.current) < 0.02) return;
    this.appliedCanopy = this.current;
    const arr = this.canopyMesh.instanceColor!.array as Float32Array;
    const blend = this.current * 0.55;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = this.canopyBase[i] + (CANOPY_FROST.r - this.canopyBase[i]) * blend;
      arr[i + 1] = this.canopyBase[i + 1] + (CANOPY_FROST.g - this.canopyBase[i + 1]) * blend;
      arr[i + 2] = this.canopyBase[i + 2] + (CANOPY_FROST.b - this.canopyBase[i + 2]) * blend;
    }
    this.canopyMesh.instanceColor!.needsUpdate = true;
  }

  private freezeWater(): void {
    const mat = this.waterMesh.material as THREE.MeshLambertMaterial;
    mat.color.copy(WATER_BASE).lerp(WATER_ICE, this.current);
    mat.opacity = 0.82 + this.current * 0.1;
  }
}
