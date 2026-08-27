import * as THREE from 'three';
import { MAP_SIZE, type Terrain } from '../world/terrain';
import { WALL_DEFS, type Village } from '../sim/village';

/**
 * Walls as instanced full-tile segments (so neighbours join up visually);
 * gates as post-and-lintel arches you can walk through.
 */

const CAPACITY = 4000;
const WOOD_COLOR = 0x7a5a38;
const STONE_COLOR = 0x8a8578;

export class WallRenderer {
  private woodMesh: THREE.InstancedMesh;
  private stoneMesh: THREE.InstancedMesh;
  private gates = new THREE.Group();
  private lastCount = -1;
  private matrix = new THREE.Matrix4();
  private pos = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    private readonly village: Village,
    private readonly terrain: Terrain,
  ) {
    // Palisade look: main block + thinner cap.
    const wallGeom = new THREE.BoxGeometry(1.0, 1.5, 0.55);
    wallGeom.translate(0, 0.75, 0);
    this.woodMesh = new THREE.InstancedMesh(wallGeom, new THREE.MeshLambertMaterial({ color: WOOD_COLOR }), CAPACITY);
    this.stoneMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.0, 1.7, 0.65).translate(0, 0.85, 0),
      new THREE.MeshLambertMaterial({ color: STONE_COLOR }),
      CAPACITY,
    );
    this.woodMesh.castShadow = true;
    this.stoneMesh.castShadow = true;
    this.woodMesh.count = 0;
    this.stoneMesh.count = 0;
    this.woodMesh.frustumCulled = false;
    this.stoneMesh.frustumCulled = false;
    scene.add(this.woodMesh, this.stoneMesh, this.gates);
  }

  private buildGate(kind: 'woodGate' | 'stoneGate', x: number, y: number, z: number, alongX: boolean): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: kind === 'woodGate' ? WOOD_COLOR : STONE_COLOR });
    const postGeom = new THREE.BoxGeometry(0.25, 1.9, 0.25);
    for (const s of [-0.4, 0.4]) {
      const post = new THREE.Mesh(postGeom, mat);
      post.position.set(alongX ? 0 : s, 0.95, alongX ? s : 0);
      post.castShadow = true;
      g.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.3 : 1.1, 0.3, alongX ? 1.1 : 0.3), mat);
    lintel.position.y = 1.95;
    lintel.castShadow = true;
    g.add(lintel);
    g.position.set(x, y, z);
    return g;
  }

  update(): void {
    if (this.village.walls.size === this.lastCount) return;
    this.lastCount = this.village.walls.size;
    this.gates.clear();
    let wi = 0;
    let si = 0;
    for (const [tile, kind] of this.village.walls) {
      const x = (tile % MAP_SIZE) + 0.5;
      const z = ((tile / MAP_SIZE) | 0) + 0.5;
      const y = this.terrain.heightAt(x, z);
      if (WALL_DEFS[kind].gate) {
        // Orient the arch across whichever axis has neighbouring walls.
        const alongX = this.village.walls.has(tile - MAP_SIZE) || this.village.walls.has(tile + MAP_SIZE);
        this.gates.add(this.buildGate(kind as 'woodGate' | 'stoneGate', x, y, z, alongX));
        continue;
      }
      this.pos.set(x, y, z);
      this.matrix.setPosition(this.pos);
      if (kind === 'woodWall' && wi < CAPACITY) this.woodMesh.setMatrixAt(wi++, this.matrix);
      else if (kind === 'stoneWall' && si < CAPACITY) this.stoneMesh.setMatrixAt(si++, this.matrix);
    }
    this.woodMesh.count = wi;
    this.stoneMesh.count = si;
    this.woodMesh.instanceMatrix.needsUpdate = true;
    this.stoneMesh.instanceMatrix.needsUpdate = true;
  }
}
