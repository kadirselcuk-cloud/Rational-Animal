import * as THREE from 'three';
import type { Terrain } from '../world/terrain';
import type { Village } from '../sim/village';

/**
 * Goods stacking up visibly at the stockpile and storage sheds: the fuller
 * the stores, the more crates, sacks, and log piles appear.
 */

const CAPACITY = 220;
const COLORS = [0x8a6a42, 0xb3a06c, 0x9a7b52, 0x767268]; // crate, sack, timber, stone

export class StorageFillRenderer {
  private mesh: THREE.InstancedMesh;
  private timer = 0;
  private matrix = new THREE.Matrix4();
  private pos = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private scl = new THREE.Vector3();
  private color = new THREE.Color();

  constructor(
    scene: THREE.Scene,
    private readonly village: Village,
    private readonly terrain: Terrain,
  ) {
    const geom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    geom.translate(0, 0.2, 0);
    this.mesh = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial(), CAPACITY);
    this.mesh.castShadow = true;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.rebuild();
  }

  update(dt: number): void {
    this.timer += dt;
    if (this.timer < 1) return;
    this.timer = 0;
    this.rebuild();
  }

  private rebuild(): void {
    const v = this.village;
    // Each storage stacks goods for ITS OWN ledger (per-storage inventories).
    const sites: { x: number; z: number; max: number; lift: number; frac: number }[] = [];
    for (const b of v.storages()) {
      const frac = Math.min(1, b.storeTotal() / v.storageCapacityOf(b));
      // The box geometry is bottom-anchored, so lift = height of the surface
      // the goods stand on: stockpile plank deck top / shed floor top.
      if (b.spec.kind === 'stockpile') sites.push({ x: b.centerX, z: b.centerZ, max: 14, lift: 0.36, frac });
      else sites.push({ x: b.centerX, z: b.centerZ, max: 8, lift: 0.1, frac });
    }
    let i = 0;
    for (const site of sites) {
      const count = Math.round(site.frac * site.max);
      const ground = this.terrain.heightAt(site.x, site.z);
      for (let k = 0; k < count && i < CAPACITY; k++) {
        const col = k % 3;
        const row = Math.floor(k / 3) % 3;
        const layer = Math.floor(k / 9);
        this.pos.set(
          site.x - 1.0 + col * 0.55 + (layer % 2) * 0.2,
          ground + site.lift + layer * 0.42,
          site.z - 0.8 + row * 0.55,
        );
        this.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (k * 37 % 10) * 0.06);
        this.scl.setScalar(0.85 + ((k * 13) % 5) * 0.06);
        this.matrix.compose(this.pos, this.quat, this.scl);
        this.mesh.setMatrixAt(i, this.matrix);
        this.color.setHex(COLORS[k % COLORS.length]);
        this.mesh.setColorAt(i, this.color);
        i++;
      }
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
