import * as THREE from 'three';
import type { Terrain } from '../world/terrain';
import type { Villager, Profession } from '../sim/village';

/**
 * Instanced villager rendering: one InstancedMesh for bodies, one for heads.
 * Positions interpolate between the sim's prev/cur tick positions (alpha from
 * the game loop) so 10 Hz simulation looks smooth at any frame rate.
 * Capacity is pre-allocated well above current population for later phases.
 */

const CAPACITY = 1024;

const PROFESSION_COLORS: Record<Profession, number> = {
  woodcutter: 0xb06a35,
  stonecutter: 0x8d8d90,
  strawcutter: 0xc9b04f,
  forager: 0x5f7d3a,
  firewoodmaker: 0xa3542e,
  builder: 0xc19a3d,
  hunter: 0x704838,
  fisher: 0x4a6d8c,
  herbalist: 0x3f7d5f,
  toolmaker: 0x9a8c5f,
  teacher: 0x6a5a8c,
  farmer: 0xa8973a,
  clayDigger: 0x8a5a3a,
  brickmaker: 0xb05a42,
  forester: 0x2f5d3a,
  miner: 0x5a5a66,
  smelter: 0x8c5a2a,
  weaponsmith: 0x6e5252,
  soldier: 0x4a5a7a,
  tailor: 0x7a5a8c,
  baker: 0xc9a86a,
  weaver: 0x9c8ab0,
  potter: 0xb07a52,
  leatherworker: 0x7a5230,
  cobbler: 0x5b4636,
};
const IDLE_COLOR = 0xc9bfa8;
const HEAD_COLOR = 0xd9b08c;
const BARON_COLOR = 0xd9a520; // the baron stands out in cloth-of-gold
const HAIR_COLOR = 0x5a4028;

export class VillagerRenderer {
  private bodies: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh;
  /** Long hair worn by female villagers (owner rule: women look different). */
  private hair: THREE.InstancedMesh;
  private matrix = new THREE.Matrix4();
  private pos = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private scale = new THREE.Vector3(1, 1, 1);
  private color = new THREE.Color();

  constructor(
    scene: THREE.Scene,
    private readonly villagers: Villager[],
    private readonly terrain: Terrain,
  ) {
    const bodyGeom = new THREE.CylinderGeometry(0.16, 0.22, 0.55, 6);
    bodyGeom.translate(0, 0.275, 0);
    const headGeom = new THREE.SphereGeometry(0.13, 6, 5);
    // A soft-sided drape around the head falling toward the shoulders.
    const hairGeom = new THREE.CylinderGeometry(0.15, 0.175, 0.3, 6, 1, true);
    hairGeom.translate(0, -0.05, 0);

    this.bodies = new THREE.InstancedMesh(bodyGeom, new THREE.MeshLambertMaterial(), CAPACITY);
    this.heads = new THREE.InstancedMesh(headGeom, new THREE.MeshLambertMaterial({ color: HEAD_COLOR }), CAPACITY);
    this.hair = new THREE.InstancedMesh(
      hairGeom,
      new THREE.MeshLambertMaterial({ color: HAIR_COLOR, side: THREE.DoubleSide }),
      CAPACITY,
    );
    this.bodies.castShadow = true;
    this.heads.castShadow = true;
    this.bodies.frustumCulled = false;
    this.heads.frustumCulled = false;
    this.hair.frustumCulled = false;
    scene.add(this.bodies, this.heads, this.hair);
  }

  update(alpha: number, timeSec: number): void {
    let i = 0;
    let h = 0;
    for (const v of this.villagers) {
      if (i >= CAPACITY) break;
      if (v.state === 'campaign') continue; // marching with the war party
      const x = v.prevX + (v.x - v.prevX) * alpha;
      const z = v.prevZ + (v.z - v.prevZ) * alpha;
      const ground = this.terrain.heightAt(x, z);
      // Walk bob / work bounce.
      let bob = 0;
      if (v.moving) bob = Math.abs(Math.sin(timeSec * 9 + i * 1.7)) * 0.08;
      else if (v.working) bob = Math.abs(Math.sin(timeSec * 13 + i)) * 0.12;

      const size = v.isBaby ? 0.35 : v.isChild ? 0.55 : 1;
      const female = v.sex === 'female';
      this.pos.set(x, ground + bob, z);
      // Women are drawn slimmer (owner rule: distinct body shape).
      this.scale.set(female ? size * 0.82 : size, size, female ? size * 0.82 : size);
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.bodies.setMatrixAt(i, this.matrix);
      this.pos.y += 0.68 * size;
      this.scale.setScalar(size);
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.heads.setMatrixAt(i, this.matrix);
      if (female && !v.isBaby) {
        this.hair.setMatrixAt(h, this.matrix);
        h++;
      }

      this.color.setHex(v.isBaron ? BARON_COLOR : v.profession ? PROFESSION_COLORS[v.profession] : IDLE_COLOR);
      this.bodies.setColorAt(i, this.color);
      i++;
    }
    this.bodies.count = i;
    this.heads.count = i;
    this.hair.count = h;
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    this.hair.instanceMatrix.needsUpdate = true;
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
  }
}
