import * as THREE from 'three';
import type { Terrain } from '../world/terrain';
import type { WarSystem } from '../sim/war';

/**
 * Raider bands and your marching war party, rendered as instanced figures
 * clustered around each group's position. Raiders are blood-red; your
 * soldiers steel-blue.
 */

const CAPACITY = 128;
const RAIDER_COLOR = new THREE.Color(0x8a2a2a);
const SOLDIER_COLOR = new THREE.Color(0x4a5a7a);

export class WarRenderer {
  private bodies: THREE.InstancedMesh;
  private matrix = new THREE.Matrix4();
  private pos = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private scale = new THREE.Vector3(1, 1, 1);

  constructor(
    scene: THREE.Scene,
    private readonly war: WarSystem,
    private readonly terrain: Terrain,
  ) {
    const geom = new THREE.CylinderGeometry(0.16, 0.22, 0.65, 6);
    geom.translate(0, 0.33, 0);
    this.bodies = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial(), CAPACITY);
    this.bodies.castShadow = true;
    this.bodies.frustumCulled = false;
    scene.add(this.bodies);
  }

  update(alpha: number, timeSec: number): void {
    let i = 0;
    const place = (cx: number, cz: number, count: number, color: THREE.Color, agitated: boolean) => {
      for (let k = 0; k < count && i < CAPACITY; k++) {
        // Loose cluster formation around the group position.
        const angle = (k / count) * Math.PI * 2 + k;
        const radius = 0.4 + (k % 3) * 0.45;
        const x = cx + Math.cos(angle) * radius;
        const z = cz + Math.sin(angle) * radius;
        const bob = agitated ? Math.abs(Math.sin(timeSec * 14 + k * 2.1)) * 0.15 : Math.abs(Math.sin(timeSec * 9 + k)) * 0.06;
        this.pos.set(x, this.terrain.heightAt(x, z) + bob, z);
        this.matrix.compose(this.pos, this.quat, this.scale);
        this.bodies.setMatrixAt(i, this.matrix);
        this.bodies.setColorAt(i, color);
        i++;
      }
    };

    for (const raid of this.war.raids) {
      const x = raid.prevX + (raid.x - raid.prevX) * alpha;
      const z = raid.prevZ + (raid.z - raid.prevZ) * alpha;
      place(x, z, raid.size, RAIDER_COLOR, raid.state === 'fight');
    }
    const p = this.war.party;
    if (p) {
      const alive = p.soldiers.filter((s) => !s.dead).length;
      const x = p.prevX + (p.x - p.prevX) * alpha;
      const z = p.prevZ + (p.z - p.prevZ) * alpha;
      place(x, z, alive, SOLDIER_COLOR, false);
    }
    this.bodies.count = i;
    this.bodies.instanceMatrix.needsUpdate = true;
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
  }
}
