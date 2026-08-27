import * as THREE from 'three';
import {
  MAP_SIZE,
  MOUNTAIN_LINE,
  SNOW_LINE,
  WATER_LEVEL,
  generateTerrain,
  slopeAt,
  terrainNoise,
  type Terrain,
} from './terrain';
import { OreType, TileType, classifyTiles, tileIndex, type TileMap } from './tiles';

/**
 * Builds the visible world from the terrain + tile data: vertex-colored
 * terrain mesh, water plane, and instanced low-poly vegetation. Visuals are
 * always derived from the tile layer so what the player sees is exactly what
 * the simulation will use.
 */

const TREE_TARGET = 8000;
const ROCK_TARGET = 1600;
const STRAW_TUFT_TARGET = 9000;

export interface World {
  terrain: Terrain;
  tiles: TileMap;
  forest: ForestView;
  straw: StrawView;
  /** Rock boulders — hidden per tile as stone is quarried away. */
  rocks: StrawView;
  /** Visual rim past the playable map that fades into the fog (session 39). */
  skirt: EdgeSkirt;
  /** Mesh references the seasonal visuals system recolors. */
  visualRefs: {
    terrainMesh: THREE.Mesh;
    canopyMesh: THREE.InstancedMesh;
    waterMesh: THREE.Mesh;
    sun: THREE.DirectionalLight;
    hemi: THREE.HemisphereLight;
  };
}

/** The world is drawn 550×550 but only the central 512×512 is playable
 *  (owner rule, session 39): a 19-tile rim continues the edge terrain,
 *  sinking and fading into the fog so the map never ends in a cliff. */
const SKIRT_WIDTH = 19;
const SKIRT_STEP = 2;

export class EdgeSkirt {
  readonly mesh: THREE.Mesh;
  private readonly colorAttr: THREE.BufferAttribute;
  /** Terrain vertex each skirt vertex borrows its ground color from. */
  private readonly srcIdx: Uint32Array;
  /** 0 at the map edge … 1 at the outer rim (fully fog-colored). */
  private readonly fade: Float32Array;
  private readonly terrainColors: THREE.BufferAttribute;
  private cooldown = 0;

  constructor(terrain: Terrain, terrainMesh: THREE.Mesh) {
    const V = terrain.size + 1;
    const positions: number[] = [];
    const srcIdx: number[] = [];
    const fade: number[] = [];
    const indices: number[] = [];

    const corner = (x: number, z: number) => {
      const cx = Math.min(Math.max(x, 0), MAP_SIZE);
      const cz = Math.min(Math.max(z, 0), MAP_SIZE);
      const d = Math.max(-x, x - MAP_SIZE, -z, z - MAP_SIZE, 0);
      const f = Math.min(1, d / SKIRT_WIDTH);
      const cf = f * f * (3 - 2 * f); // smoothstep
      const h = terrain.heights[cz * V + cx];
      positions.push(x, h * (1 - cf) + (WATER_LEVEL - 6) * cf, z);
      srcIdx.push(cz * V + cx);
      fade.push(cf);
      return positions.length / 3 - 1;
    };

    for (let gz = -SKIRT_WIDTH; gz < MAP_SIZE + SKIRT_WIDTH; gz += SKIRT_STEP) {
      for (let gx = -SKIRT_WIDTH; gx < MAP_SIZE + SKIRT_WIDTH; gx += SKIRT_STEP) {
        if (gx >= 0 && gx + SKIRT_STEP <= MAP_SIZE && gz >= 0 && gz + SKIRT_STEP <= MAP_SIZE) continue;
        const a = corner(gx, gz);
        const b = corner(gx + SKIRT_STEP, gz);
        const c = corner(gx, gz + SKIRT_STEP);
        const d = corner(gx + SKIRT_STEP, gz + SKIRT_STEP);
        indices.push(a, c, b, b, c, d);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    this.mesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.mesh.frustumCulled = false;
    this.colorAttr = geom.getAttribute('color') as THREE.BufferAttribute;
    this.srcIdx = new Uint32Array(srcIdx);
    this.fade = new Float32Array(fade);
    this.terrainColors = terrainMesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    this.refresh(new THREE.Color(0x9db4c0), 1);
  }

  /** Blend edge-of-map ground colors into the current fog color (follows the
   *  seasons repainting the terrain AND the day/night fog). */
  refresh(fog: THREE.Color, dt: number): void {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    this.cooldown = 0.25;
    const src = this.terrainColors.array as Float32Array;
    const dst = this.colorAttr.array as Float32Array;
    for (let i = 0; i < this.fade.length; i++) {
      const f = this.fade[i];
      const s = this.srcIdx[i] * 3;
      dst[i * 3] = src[s] + (fog.r - src[s]) * f;
      dst[i * 3 + 1] = src[s + 1] + (fog.g - src[s + 1]) * f;
      dst[i * 3 + 2] = src[s + 2] + (fog.b - src[s + 2]) * f;
    }
    this.colorAttr.needsUpdate = true;
  }
}

/** Sapling → young → mature growth times (owner rule: mid at 1 year, grown at 2). */
const TREE_MID_AGE = 4 * 300; // 1 year in sim seconds (SEASON_SECONDS = 300)
const TREE_MATURE_AGE = 8 * 300;
const SCALE_SAPLING = 0.35;
const SCALE_YOUNG = 0.65;

interface GrowingTree {
  idx: number;
  tile: number;
  x: number;
  y: number;
  z: number;
  plantedAt: number;
  stage: 'sapling' | 'young';
}

/**
 * Live view over the instanced tree meshes: the sim chops mature trees and
 * foresters plant saplings through this. Removed instances free their slot
 * for replanting; extra instance capacity is pre-allocated.
 */
export class ForestView {
  /** Tiles with at least one MATURE (choppable) tree. */
  readonly treeTiles = new Set<number>();
  /** Tiles with a sapling/young tree growing. */
  readonly growingTiles = new Set<number>();
  /** Persistent logs so saves can replay forest changes onto a fresh world. */
  removedLog: number[] = [];
  plantLog: { tile: number; x: number; y: number; z: number; at: number }[] = [];
  private byTile = new Map<number, number[]>();
  private growing: GrowingTree[] = [];
  private freeIndices: number[] = [];
  private nextIndex: number;
  private readonly capacity: number;
  private static readonly ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  private tmpMatrix = new THREE.Matrix4();
  private tmpPos = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();
  private tmpScale = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(
    private readonly trunks: THREE.InstancedMesh,
    private readonly canopies: THREE.InstancedMesh,
    placements: Placement[],
  ) {
    this.nextIndex = placements.length;
    this.capacity = trunks.instanceMatrix.count;
    placements.forEach((p, i) => {
      if (p.tile === undefined) return;
      let list = this.byTile.get(p.tile);
      if (!list) {
        list = [];
        this.byTile.set(p.tile, list);
        this.treeTiles.add(p.tile);
      }
      list.push(i);
    });
  }

  treeCountAt(tile: number): number {
    return this.byTile.get(tile)?.length ?? 0;
  }

  private setInstance(idx: number, x: number, y: number, z: number, scale: number, rot: number): void {
    this.tmpPos.set(x, y, z);
    this.tmpQuat.setFromAxisAngle(this.up, rot);
    this.tmpScale.setScalar(scale);
    this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
    this.trunks.setMatrixAt(idx, this.tmpMatrix);
    this.canopies.setMatrixAt(idx, this.tmpMatrix);
    this.trunks.instanceMatrix.needsUpdate = true;
    this.canopies.instanceMatrix.needsUpdate = true;
  }

  /** Fell one mature tree on the tile. Returns false if none remain. */
  removeTreeAt(tile: number): boolean {
    const list = this.byTile.get(tile);
    if (!list || list.length === 0) return false;
    const idx = list.pop()!;
    this.trunks.setMatrixAt(idx, ForestView.ZERO);
    this.canopies.setMatrixAt(idx, ForestView.ZERO);
    this.trunks.instanceMatrix.needsUpdate = true;
    this.canopies.instanceMatrix.needsUpdate = true;
    this.freeIndices.push(idx);
    this.removedLog.push(tile);
    if (list.length === 0) {
      this.byTile.delete(tile);
      this.treeTiles.delete(tile);
    }
    return true;
  }

  /** Remove everything (mature + growing) on a tile — land clearing. */
  clearTile(tile: number): void {
    while (this.removeTreeAt(tile)) { /* fell all mature */ }
    for (let i = this.growing.length - 1; i >= 0; i--) {
      if (this.growing[i].tile !== tile) continue;
      const g = this.growing[i];
      this.trunks.setMatrixAt(g.idx, ForestView.ZERO);
      this.canopies.setMatrixAt(g.idx, ForestView.ZERO);
      this.freeIndices.push(g.idx);
      this.growing.splice(i, 1);
    }
    this.growingTiles.delete(tile);
    this.trunks.instanceMatrix.needsUpdate = true;
    this.canopies.instanceMatrix.needsUpdate = true;
  }

  /** Forester plants a sapling. Returns false when out of instance capacity. */
  plantAt(tile: number, x: number, y: number, z: number, now: number): boolean {
    let idx: number;
    if (this.freeIndices.length > 0) idx = this.freeIndices.pop()!;
    else if (this.nextIndex < this.capacity) idx = this.nextIndex++;
    else return false;
    const rot = Math.random() * Math.PI * 2;
    this.setInstance(idx, x, y, z, SCALE_SAPLING, rot);
    this.trunks.count = Math.max(this.trunks.count, idx + 1);
    this.canopies.count = Math.max(this.canopies.count, idx + 1);
    this.growing.push({ idx, tile, x, y, z, plantedAt: now, stage: 'sapling' });
    this.growingTiles.add(tile);
    this.plantLog.push({ tile, x, y, z, at: now });
    return true;
  }

  /** Advance sapling growth; call once per sim tick with calendar seconds. */
  tickGrowth(now: number): void {
    for (let i = this.growing.length - 1; i >= 0; i--) {
      const g = this.growing[i];
      const age = now - g.plantedAt;
      if (age >= TREE_MATURE_AGE) {
        this.setInstance(g.idx, g.x, g.y, g.z, 0.9 + Math.random() * 0.5, Math.random() * Math.PI * 2);
        let list = this.byTile.get(g.tile);
        if (!list) {
          list = [];
          this.byTile.set(g.tile, list);
        }
        list.push(g.idx);
        this.treeTiles.add(g.tile);
        this.growingTiles.delete(g.tile);
        this.growing.splice(i, 1);
      } else if (age >= TREE_MID_AGE && g.stage === 'sapling') {
        g.stage = 'young';
        this.setInstance(g.idx, g.x, g.y, g.z, SCALE_YOUNG, Math.random() * Math.PI * 2);
      }
    }
  }
}

/**
 * Live view over the straw-tuft instances: harvested straw tiles hide their
 * tufts and regrow them years later (owner rule, session 26).
 */
export class StrawView {
  private byTile = new Map<number, number[]>();
  private saved = new Map<number, THREE.Matrix4>();
  private static readonly ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(
    private readonly mesh: THREE.InstancedMesh,
    placements: Placement[],
  ) {
    placements.forEach((p, i) => {
      if (p.tile === undefined) return;
      let list = this.byTile.get(p.tile);
      if (!list) {
        list = [];
        this.byTile.set(p.tile, list);
      }
      list.push(i);
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(i, m);
      this.saved.set(i, m);
    });
  }

  /** Harvested: hide this tile's tufts. */
  hideTile(tile: number): void {
    for (const i of this.byTile.get(tile) ?? []) this.mesh.setMatrixAt(i, StrawView.ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Regrown: restore this tile's tufts. */
  showTile(tile: number): void {
    for (const i of this.byTile.get(tile) ?? []) {
      const m = this.saved.get(i);
      if (m) this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Simple wooden stockpile platform marking the village camp. */
export function buildStockpileMesh(x: number, z: number, terrain: Terrain): THREE.Group {
  const group = new THREE.Group();
  const y = terrain.heightAt(x, z);
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
  );
  platform.position.set(x, y + 0.2, z);
  platform.castShadow = true;
  platform.receiveShadow = true;
  group.add(platform);
  const postGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 5);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  for (const [px, pz] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) {
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.set(x + px, y + 0.7, z + pz);
    post.castShadow = true;
    group.add(post);
  }
  return group;
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- terrain mesh

const COL_DEEP = new THREE.Color(0x4a4636);
const COL_SHORE = new THREE.Color(0x8a7d58);
const COL_GRASS = new THREE.Color(0x55683d);
const COL_GRASS_DRY = new THREE.Color(0x6d7244);
const COL_GRASS_DARK = new THREE.Color(0x40522f); // lush hollows
const COL_GRASS_LIGHT = new THREE.Color(0x74814b); // sun-bleached rises
const COL_ROCK = new THREE.Color(0x767268);
const COL_SNOW = new THREE.Color(0xe8ecee);
const COL_STRAW = new THREE.Color(0xb7a14f);
const COL_CLAY = new THREE.Color(0x96603a);

function buildTerrainMesh(terrain: Terrain, tiles: TileMap, seed: number): THREE.Mesh {
  const V = terrain.size + 1;
  const positions = new Float32Array(V * V * 3);
  const colors = new Float32Array(V * V * 3);
  const c = new THREE.Color();

  for (let z = 0; z < V; z++) {
    for (let x = 0; x < V; x++) {
      const i = z * V + x;
      const h = terrain.heights[i];
      positions[i * 3] = x;
      positions[i * 3 + 1] = h;
      positions[i * 3 + 2] = z;

      const slope = slopeAt(terrain.heights, x, z);
      if (h < WATER_LEVEL - 0.6) {
        c.copy(COL_DEEP);
      } else if (h < WATER_LEVEL + 0.35) {
        c.copy(COL_SHORE);
      } else {
        const tint = terrainNoise(x / 96, z / 96, seed ^ 0x77aa, 2);
        c.copy(COL_GRASS).lerp(COL_GRASS_DRY, tint);
        // Meadow patchwork (owner rule): mid-scale darker/lighter patches and
        // a fine per-vertex shimmer so the green never reads as one flat tone.
        const patch = terrainNoise(x / 17, z / 17, seed ^ 0x1b2c, 3);
        if (patch < 0.42) c.lerp(COL_GRASS_DARK, (0.42 - patch) * 1.3);
        else if (patch > 0.6) c.lerp(COL_GRASS_LIGHT, (patch - 0.6) * 1.2);
        const micro = terrainNoise(x / 4.5, z / 4.5, seed ^ 0x99d1, 2);
        c.multiplyScalar(0.955 + micro * 0.09);
        const rockiness = Math.max(
          THREE.MathUtils.smoothstep(slope, 0.55, 1.1),
          THREE.MathUtils.smoothstep(h, MOUNTAIN_LINE * 0.8, MOUNTAIN_LINE * 1.4),
        );
        c.lerp(COL_ROCK, rockiness);
        const snow = THREE.MathUtils.smoothstep(h, SNOW_LINE, SNOW_LINE + 7) * (1 - THREE.MathUtils.smoothstep(slope, 1.4, 2.2));
        c.lerp(COL_SNOW, snow);

        // Straw/clay ground tint from the up-to-4 tiles touching this corner.
        let straw = 0;
        let clay = 0;
        for (let dz = -1; dz <= 0; dz++) {
          for (let dx = -1; dx <= 0; dx++) {
            const tx = x + dx;
            const tz = z + dz;
            if (tx < 0 || tz < 0 || tx >= tiles.size || tz >= tiles.size) continue;
            const t = tiles.types[tileIndex(tx, tz)];
            if (t === TileType.Straw) straw++;
            else if (t === TileType.Clay) clay++;
          }
        }
        if (straw > 0) c.lerp(COL_STRAW, (straw / 4) * 0.6);
        if (clay > 0) c.lerp(COL_CLAY, (clay / 4) * 0.7);
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
  }

  const quads = terrain.size * terrain.size;
  const index = new Uint32Array(quads * 6);
  let o = 0;
  for (let z = 0; z < terrain.size; z++) {
    for (let x = 0; x < terrain.size; x++) {
      const a = z * V + x;
      const b = a + 1;
      const d = a + V;
      const e = d + 1;
      index[o++] = a;
      index[o++] = d;
      index[o++] = b;
      index[o++] = b;
      index[o++] = d;
      index[o++] = e;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setIndex(new THREE.BufferAttribute(index, 1));
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

function buildWater(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    // Covers the visual rim too so water never ends in a hard line (s39).
    new THREE.PlaneGeometry(MAP_SIZE + SKIRT_WIDTH * 2, MAP_SIZE + SKIRT_WIDTH * 2),
    new THREE.MeshLambertMaterial({ color: 0x39627f, transparent: true, opacity: 0.82 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(MAP_SIZE / 2, WATER_LEVEL - 0.15, MAP_SIZE / 2);
  return mesh;
}

// ---------------------------------------------------------------- vegetation

function pineGeometries(): { trunk: THREE.BufferGeometry; canopy: THREE.BufferGeometry } {
  const trunk = new THREE.CylinderGeometry(0.08, 0.14, 0.9, 5);
  trunk.translate(0, 0.45, 0);
  const c1 = new THREE.ConeGeometry(0.85, 1.4, 6);
  c1.translate(0, 1.4, 0);
  const c2 = new THREE.ConeGeometry(0.65, 1.2, 6);
  c2.translate(0, 2.1, 0);
  const c3 = new THREE.ConeGeometry(0.42, 1.0, 6);
  c3.translate(0, 2.8, 0);
  const canopy = mergeGeometries([c1, c2, c3]);
  return { trunk, canopy };
}

function mergeGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const withColors = nonIndexed.every((g) => g.getAttribute('color'));
  for (const g of nonIndexed) {
    positions.push(...(g.getAttribute('position').array as Float32Array));
    normals.push(...(g.getAttribute('normal').array as Float32Array));
    if (withColors) colors.push(...(g.getAttribute('color').array as Float32Array));
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (withColors) merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return merged;
}

interface Placement {
  x: number;
  y: number;
  z: number;
  scale: number;
  /** Tile index this instance stands on (set by placeOnTiles). */
  tile?: number;
}

/** Paint every vertex of a geometry one color (for merged multi-part geometry). */
function withVertexColor(geom: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geom.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

/** Two cattail reeds: thin yellow stalks topped by rounded brown heads. */
function makeReedGeometry(): THREE.BufferGeometry {
  const STALK = 0xc9b458;
  const HEAD = 0x6b4a2f;
  const stalk1 = new THREE.CylinderGeometry(0.02, 0.03, 0.8, 4, 1, true);
  stalk1.translate(0, 0.4, 0);
  const head1 = new THREE.CapsuleGeometry(0.05, 0.18, 1, 5);
  head1.translate(0, 0.9, 0);
  const stalk2 = new THREE.CylinderGeometry(0.016, 0.024, 0.55, 4, 1, true);
  stalk2.translate(0.09, 0.275, 0.05);
  const head2 = new THREE.CapsuleGeometry(0.04, 0.12, 1, 5);
  head2.translate(0.09, 0.62, 0.05);
  return mergeGeometries([
    withVertexColor(stalk1, STALK),
    withVertexColor(head1, HEAD),
    withVertexColor(stalk2, STALK),
    withVertexColor(head2, HEAD),
  ]);
}

function buildInstances(
  geometry: THREE.BufferGeometry,
  placements: Placement[],
  rand: () => number,
  baseColor: THREE.Color,
  colorJitter: number,
  shadows = true,
  capacity?: number,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial(), capacity ?? placements.length);
  mesh.count = placements.length;
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;

  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();

  placements.forEach((p, i) => {
    pos.set(p.x, p.y, p.z);
    rot.setFromAxisAngle(up, rand() * Math.PI * 2);
    scl.setScalar(p.scale);
    matrix.compose(pos, rot, scl);
    mesh.setMatrixAt(i, matrix);
    color.copy(baseColor).multiplyScalar(1 + (rand() - 0.5) * 2 * colorJitter);
    mesh.setColorAt(i, color);
  });
  // Pre-color spare capacity (used later by planted saplings).
  for (let i = placements.length; i < (capacity ?? placements.length); i++) {
    color.copy(baseColor).multiplyScalar(1 + (rand() - 0.5) * 2 * colorJitter);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** Place instances on tiles of a given type, jittered, capped at `target`. */
function placeOnTiles(
  tiles: TileMap,
  terrain: Terrain,
  type: TileType,
  target: number,
  rand: () => number,
  scaleMin: number,
  scaleMax: number,
  perTile = 1,
): Placement[] {
  const candidates: number[] = [];
  for (let i = 0; i < tiles.types.length; i++) {
    if (tiles.types[i] === type) candidates.push(i);
  }
  const placements: Placement[] = [];
  if (candidates.length === 0) return placements;
  const p = Math.min(1, target / (candidates.length * perTile));
  for (const i of candidates) {
    const tx = i % tiles.size;
    const tz = (i / tiles.size) | 0;
    for (let k = 0; k < perTile; k++) {
      if (rand() > p) continue;
      const x = tx + rand();
      const z = tz + rand();
      placements.push({
        x,
        y: terrain.heightAt(x, z) - 0.05,
        z,
        scale: scaleMin + rand() * (scaleMax - scaleMin),
        tile: i,
      });
    }
  }
  return placements;
}

// ---------------------------------------------------------------- assembly

export function buildWorldScene(scene: THREE.Scene, seed: number): World {
  scene.background = new THREE.Color(0x9db4c0);
  scene.fog = new THREE.Fog(0x9db4c0, 500, 1600);

  const hemi = new THREE.HemisphereLight(0xbfd0dd, 0x4a5238, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
  const center = MAP_SIZE / 2;
  sun.position.set(center - 420, 520, center + 260);
  sun.target.position.set(center, 0, center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const span = MAP_SIZE * 0.62;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 1600;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const terrain = generateTerrain(seed);
  const tiles = classifyTiles(terrain, seed);
  const terrainMesh = buildTerrainMesh(terrain, tiles, seed);
  const waterMesh = buildWater();
  scene.add(terrainMesh, waterMesh);
  const skirt = new EdgeSkirt(terrain, terrainMesh);
  scene.add(skirt.mesh);

  const rand = seededRandom(seed ^ 0xc0ffee);
  const { trunk, canopy } = pineGeometries();

  // Trees on forest tiles (same seeded sequence for trunk + canopy alignment).
  // Extra capacity lets foresters replant beyond the initial forest.
  const trees = placeOnTiles(tiles, terrain, TileType.Forest, TREE_TARGET, seededRandom(seed ^ 0x7ee5), 0.9, 1.8);
  const treeCapacity = trees.length + 4000;
  const trunkMesh = buildInstances(trunk, trees, seededRandom(seed ^ 11), new THREE.Color(0x6b4a2f), 0.15, true, treeCapacity);
  const canopyMesh = buildInstances(canopy, trees, seededRandom(seed ^ 11), new THREE.Color(0x2f4a2a), 0.2, true, treeCapacity);
  scene.add(trunkMesh, canopyMesh);
  const forest = new ForestView(trunkMesh, canopyMesh, trees);

  // Rocks: dense on rock tiles, a few strays on grass.
  const rockPlacements = placeOnTiles(tiles, terrain, TileType.Rock, ROCK_TARGET, seededRandom(seed ^ 0x60c4), 0.5, 2.3);
  const strays = placeOnTiles(tiles, terrain, TileType.Grass, ROCK_TARGET / 8, seededRandom(seed ^ 0x60c5), 0.4, 1.2);
  const rockGeom = new THREE.DodecahedronGeometry(0.4, 0);
  rockGeom.translate(0, 0.25, 0);
  rockGeom.scale(1, 0.7, 1);
  const allRocks = rockPlacements.concat(strays);
  const rockMesh = buildInstances(rockGeom, allRocks, rand, new THREE.Color(0x7d7d78), 0.12);
  scene.add(rockMesh);
  const rockView = new StrawView(rockMesh, allRocks);

  // Ore deposit markers: tinted rock clusters so prospectors can spot them.
  {
    const oreColors: Record<number, number> = {
      [OreType.Copper]: 0xb87333,
      [OreType.Tin]: 0xa8a8b4,
      [OreType.Iron]: 0x9a4f3a,
      [OreType.Coal]: 0x2e2c2a,
    };
    const byOre = new Map<number, Placement[]>();
    const oreRand = seededRandom(seed ^ 0x03e5);
    for (let i = 0; i < tiles.ores.length; i++) {
      const ore = tiles.ores[i];
      if (ore === OreType.None) continue;
      const x = (i % MAP_SIZE) + 0.2 + oreRand() * 0.6;
      const z = ((i / MAP_SIZE) | 0) + 0.2 + oreRand() * 0.6;
      let list = byOre.get(ore);
      if (!list) {
        list = [];
        byOre.set(ore, list);
      }
      list.push({ x, y: terrain.heightAt(x, z), z, scale: 0.5 + oreRand() * 0.5 });
    }
    const oreGeom = new THREE.DodecahedronGeometry(0.28, 0);
    oreGeom.translate(0, 0.15, 0);
    for (const [ore, placements] of byOre) {
      scene.add(buildInstances(oreGeom, placements, seededRandom(seed ^ ore), new THREE.Color(oreColors[ore]), 0.15));
    }
  }

  // Straw reeds on straw-field tiles — cattail-style: thin yellow stalks with
  // rounded brown heads (owner rule). Two reeds per tuft, colored per-vertex;
  // no shadows, they're tiny and numerous.
  const tuftGeom = makeReedGeometry();
  const tufts = placeOnTiles(tiles, terrain, TileType.Straw, STRAW_TUFT_TARGET, seededRandom(seed ^ 0x57a3), 0.7, 1.3, 2);
  const tuftMesh = buildInstances(tuftGeom, tufts, seededRandom(seed ^ 0x57a4), new THREE.Color(0xffffff), 0.12, false);
  (tuftMesh.material as THREE.MeshLambertMaterial).vertexColors = true;
  scene.add(tuftMesh);
  const straw = new StrawView(tuftMesh, tufts);

  return { terrain, tiles, forest, straw, rocks: rockView, skirt, visualRefs: { terrainMesh, canopyMesh, waterMesh, sun, hemi } };
}
