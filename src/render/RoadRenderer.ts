import * as THREE from 'three';
import { MAP_SIZE, type Terrain } from '../world/terrain';
import type { Village } from '../sim/village';
import { kitGeometry, kitReady, loadKit, onKitReady } from './kit';

/**
 * Stone roads use Kenney kit road tiles (1×1, auto-tiled by neighbors):
 * plain pavement inside, raised edge bands where road meets grass, rounded
 * corner pieces on outer bends. Dirt roads stay flat trodden-earth quads.
 * Planned-but-unbuilt tiles show as faint grey plots until built.
 * Until the kit finishes loading, stone falls back to flat cobble quads.
 */

const CAPACITY = 6000;
const EDGE_CAPACITY = 3000;
const CORNER_CAPACITY = 1000;

/** Procedural cobblestone tile texture (pre-kit fallback). */
function makePavingTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5c584e'; // grout
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Rows of offset rounded stones.
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * 8;
    for (let c = -1; c < 5; c++) {
      const x = c * 16 + offset + rand() * 2;
      const y = r * 16 + rand() * 2;
      const w = 13 + rand() * 2;
      const h = 12 + rand() * 2;
      const shade = 125 + Math.floor(rand() * 35);
      ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 12})`;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, w, h, 4);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Flat trodden-earth texture for dirt roads. */
function makeDirtTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#7a6748';
  ctx.fillRect(0, 0, size, size);
  let seed = 13;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 60; i++) {
    const shade = 100 + Math.floor(rand() * 40);
    ctx.fillStyle = `rgba(${shade},${shade - 15},${shade - 35},0.5)`;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, 2 + rand() * 4, 1.5 + rand() * 3, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const HALF_PI = Math.PI / 2;

export class RoadRenderer {
  private fallbackStone: THREE.InstancedMesh;
  private dirtMesh: THREE.InstancedMesh;
  private planned: THREE.InstancedMesh;
  /** kit piece instancers: plain tile, curb edge, curb corner */
  private plain: THREE.InstancedMesh | null = null;
  private edge: THREE.InstancedMesh | null = null;
  private corner: THREE.InstancedMesh | null = null;
  private lastKey = '';
  private matrix = new THREE.Matrix4();
  private pos = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private tilt = new THREE.Quaternion();
  private normal = new THREE.Vector3();
  private scale = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);

  /**
   * Tile transform conforming to the terrain: rotated about Y by `rot`, then
   * tilted to the plane through the tile's four corner heights, positioned at
   * their average. Keeps sloped road runs connected instead of stair-stepping.
   * Returns the matrix in this.matrix.
   */
  private conformTile(tx: number, tz: number, rot: number, yLift: number): void {
    const t = this.terrain;
    const h00 = t.heightAt(tx, tz);
    const h10 = t.heightAt(tx + 1, tz);
    const h01 = t.heightAt(tx, tz + 1);
    const h11 = t.heightAt(tx + 1, tz + 1);
    const gx = (h10 + h11 - h00 - h01) / 2; // dh/dx
    const gz = (h01 + h11 - h00 - h10) / 2; // dh/dz
    this.normal.set(-gx, 1, -gz).normalize();
    this.tilt.setFromUnitVectors(this.up, this.normal);
    this.quat.setFromAxisAngle(this.up, rot).premultiply(this.tilt);
    this.pos.set(tx + 0.5, (h00 + h10 + h01 + h11) / 4 + yLift, tz + 0.5);
    // Slight oversize closes the corner cracks between differently-tilted tiles.
    this.scale.set(1.04, 1, 1.04);
    this.matrix.compose(this.pos, this.quat, this.scale);
  }

  constructor(
    private readonly scene: THREE.Scene,
    private readonly village: Village,
    private readonly terrain: Terrain,
  ) {
    const geom = new THREE.PlaneGeometry(1, 1);
    geom.rotateX(-Math.PI / 2);
    this.fallbackStone = new THREE.InstancedMesh(
      geom,
      new THREE.MeshLambertMaterial({ map: makePavingTexture(), polygonOffset: true, polygonOffsetFactor: -1 }),
      CAPACITY,
    );
    this.fallbackStone.receiveShadow = true;
    this.fallbackStone.count = 0;
    this.fallbackStone.frustumCulled = false;
    this.dirtMesh = new THREE.InstancedMesh(
      geom,
      new THREE.MeshLambertMaterial({ map: makeDirtTexture(), polygonOffset: true, polygonOffsetFactor: -1 }),
      CAPACITY,
    );
    this.dirtMesh.receiveShadow = true;
    this.dirtMesh.count = 0;
    this.dirtMesh.frustumCulled = false;
    this.planned = new THREE.InstancedMesh(
      geom,
      new THREE.MeshLambertMaterial({ color: 0x8a867a, transparent: true, opacity: 0.35 }),
      CAPACITY,
    );
    this.planned.count = 0;
    this.planned.frustumCulled = false;
    scene.add(this.fallbackStone, this.dirtMesh, this.planned);
    loadKit();
    onKitReady(() => {
      this.plain = this.makeKitInstancer('road', CAPACITY);
      this.edge = this.makeKitInstancer('road-edge', EDGE_CAPACITY);
      this.corner = this.makeKitInstancer('road-corner', CORNER_CAPACITY);
      this.lastKey = ''; // force rebuild with kit pieces
    });
  }

  private makeKitInstancer(name: string, capacity: number): THREE.InstancedMesh {
    const { geometry, material } = kitGeometry(name);
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.receiveShadow = true;
    mesh.count = 0;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  private hasRoad(tx: number, tz: number): boolean {
    if (tx < 0 || tz < 0 || tx >= MAP_SIZE || tz >= MAP_SIZE) return false;
    return this.village.roads.has(tz * MAP_SIZE + tx);
  }

  update(): void {
    let stoneN = 0;
    for (const k of this.village.roads.values()) {
      if (k === 'stone') stoneN++;
    }
    const key = `${this.village.roads.size}:${stoneN}:${this.village.pendingWorks.length}:${kitReady ? 1 : 0}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    let fi = 0; // fallback stone quads
    let di = 0; // dirt quads
    let pi = 0; // kit plain
    let ei = 0; // kit edge
    let ci = 0; // kit corner
    this.scale.set(1, 1, 1);
    for (const [tile, kind] of this.village.roads) {
      const tx = tile % MAP_SIZE;
      const tz = (tile / MAP_SIZE) | 0;
      if (kind === 'dirt') {
        if (di >= CAPACITY) continue;
        this.conformTile(tx, tz, ((tile * 7919) % 4) * HALF_PI, 0.04);
        this.dirtMesh.setMatrixAt(di, this.matrix);
        di++;
        continue;
      }
      if (!kitReady || !this.plain || !this.edge || !this.corner) {
        if (fi >= CAPACITY) continue;
        this.conformTile(tx, tz, ((tile * 7919) % 4) * HALF_PI, 0.04);
        this.fallbackStone.setMatrixAt(fi, this.matrix);
        fi++;
        continue;
      }
      // Auto-tiling: which of the four sides face open ground?
      const openE = !this.hasRoad(tx + 1, tz);
      const openW = !this.hasRoad(tx - 1, tz);
      const openN = !this.hasRoad(tx, tz - 1);
      const openS = !this.hasRoad(tx, tz + 1);
      const openCount = +openE + +openW + +openN + +openS;
      // Piece orientation: road-edge's raised band lies on local +X;
      // road-corner's rounded band covers local +X and -Z.
      // rotY(a) maps +X → E at 0, N at π/2, W at π, S at -π/2.
      let mesh: THREE.InstancedMesh = this.plain;
      let idx = pi;
      let rot = ((tile * 7919) % 4) * HALF_PI; // plain tiles: quarter-turn variety
      if (openCount === 1) {
        mesh = this.edge;
        idx = ei;
        rot = openE ? 0 : openN ? HALF_PI : openW ? Math.PI : -HALF_PI;
      } else if (openCount === 2 && !(openE && openW) && !(openN && openS)) {
        mesh = this.corner;
        idx = ci;
        rot = openE && openN ? 0 : openN && openW ? HALF_PI : openW && openS ? Math.PI : -HALF_PI;
      }
      const cap = mesh === this.plain ? CAPACITY : mesh === this.edge ? EDGE_CAPACITY : CORNER_CAPACITY;
      if (idx >= cap) {
        mesh = this.plain;
        idx = pi;
        if (idx >= CAPACITY) continue;
      }
      this.conformTile(tx, tz, rot, 0.02);
      mesh.setMatrixAt(idx, this.matrix);
      if (mesh === this.plain) pi++;
      else if (mesh === this.edge) ei++;
      else ci++;
    }
    this.fallbackStone.count = fi;
    this.fallbackStone.instanceMatrix.needsUpdate = true;
    this.dirtMesh.count = di;
    this.dirtMesh.instanceMatrix.needsUpdate = true;
    if (this.plain) {
      this.plain.count = pi;
      this.plain.instanceMatrix.needsUpdate = true;
    }
    if (this.edge) {
      this.edge.count = ei;
      this.edge.instanceMatrix.needsUpdate = true;
    }
    if (this.corner) {
      this.corner.count = ci;
      this.corner.instanceMatrix.needsUpdate = true;
    }

    let j = 0;
    this.quat.identity();
    this.scale.set(1, 1, 1);
    for (const pw of this.village.pendingWorks) {
      if (j >= CAPACITY) break;
      const x = (pw.tile % MAP_SIZE) + 0.5;
      const z = ((pw.tile / MAP_SIZE) | 0) + 0.5;
      this.pos.set(x, this.terrain.heightAt(x, z) + 0.05, z);
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.planned.setMatrixAt(j, this.matrix);
      j++;
    }
    this.planned.count = j;
    this.planned.instanceMatrix.needsUpdate = true;
  }
}
