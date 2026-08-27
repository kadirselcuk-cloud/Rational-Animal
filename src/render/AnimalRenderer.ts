import * as THREE from 'three';
import type { Terrain } from '../world/terrain';
import type { AnimalSystem } from '../sim/animals';

/**
 * Instanced low-poly wildlife: shared body + head geometry, told apart by
 * per-instance scale and color — deer tall and warm brown, boars low, wide
 * and near-black, rabbits tiny in grey/white/sand. Young run at 60% size.
 */

const CAPACITY = 400;

const BODY_COLORS = { deer: 0x9c7a4f, boar: 0x453527, rabbit: 0xb8b0a4 } as const;
const RABBIT_TINTS = [0xb8b0a4, 0xd8d2c8, 0xa08a6c];

export class AnimalRenderer {
  private bodies: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh;
  private matrix = new THREE.Matrix4();
  private pos = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private scale = new THREE.Vector3(1, 1, 1);
  private color = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(
    scene: THREE.Scene,
    private readonly animals: AnimalSystem,
    private readonly terrain: Terrain,
  ) {
    const bodyGeom = new THREE.CapsuleGeometry(0.22, 0.5, 3, 6);
    bodyGeom.rotateZ(Math.PI / 2); // capsule along X = animal length
    bodyGeom.translate(0, 0.45, 0);
    const headGeom = new THREE.ConeGeometry(0.12, 0.4, 5);
    headGeom.rotateZ(-Math.PI / 2.6);
    headGeom.translate(0.42, 0.78, 0);

    this.bodies = new THREE.InstancedMesh(bodyGeom, new THREE.MeshLambertMaterial(), CAPACITY);
    this.heads = new THREE.InstancedMesh(headGeom, new THREE.MeshLambertMaterial({ color: 0xffffff }), CAPACITY);
    this.bodies.castShadow = true;
    this.bodies.frustumCulled = false;
    this.heads.frustumCulled = false;
    scene.add(this.bodies, this.heads);
  }

  update(alpha: number, timeSec: number): void {
    let i = 0;
    for (const a of this.animals.deer) {
      if (!a.alive || i >= CAPACITY) continue;
      const x = a.prevX + (a.x - a.prevX) * alpha;
      const z = a.prevZ + (a.z - a.prevZ) * alpha;
      const hop = a.species === 'rabbit' ? 0.14 : 0.06;
      const bob = a.moving ? Math.abs(Math.sin(timeSec * (a.species === 'rabbit' ? 12 : 8) + i * 2.3)) * hop : 0;
      // Face movement direction.
      const heading = a.moving ? Math.atan2(-(a.z - a.prevZ), a.x - a.prevX) : i * 1.3;
      this.quat.setFromAxisAngle(this.up, heading);
      this.pos.set(x, this.terrain.heightAt(x, z) + bob, z);

      const grow = a.young ? 0.6 : 1;
      if (a.species === 'deer') this.scale.set(grow, grow, grow);
      else if (a.species === 'boar') this.scale.set(0.95 * grow, 0.7 * grow, 1.15 * grow);
      else this.scale.set(0.34 * grow, 0.34 * grow, 0.34 * grow);
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.bodies.setMatrixAt(i, this.matrix);
      this.heads.setMatrixAt(i, this.matrix);

      if (a.species === 'rabbit') this.color.setHex(RABBIT_TINTS[i % RABBIT_TINTS.length]);
      else this.color.setHex(BODY_COLORS[a.species]).multiplyScalar(0.9 + ((i * 37) % 10) * 0.02);
      this.bodies.setColorAt(i, this.color);
      this.heads.setColorAt(i, this.color.multiplyScalar(0.85));
      i++;
    }
    this.bodies.count = i;
    this.heads.count = i;
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
  }
}
