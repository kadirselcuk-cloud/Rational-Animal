import * as THREE from 'three';
import type { Terrain } from '../world/terrain';
import type { Caravan, TradeSystem, Tribe } from '../sim/tribes';

/**
 * Tribe camps (static tent clusters with a banner in the tribe's color) and
 * traveling ox-cart caravans.
 */

function buildCamp(tribe: Tribe, terrain: Terrain): THREE.Group {
  const g = new THREE.Group();
  const tentMat = new THREE.MeshLambertMaterial({ color: 0xb0a58c });
  const trimMat = new THREE.MeshLambertMaterial({ color: tribe.color });

  const spots: [number, number, number][] = [
    [0, 0, 1.1], [2.2, 0.6, 0.9], [-2.0, 0.8, 0.95], [1.2, -1.9, 0.85], [-1.4, -1.8, 0.8],
  ];
  for (const [dx, dz, s] of spots) {
    const tent = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 1.3 * s, 6), tentMat);
    tent.position.set(dx, (1.3 * s) / 2, dz);
    tent.castShadow = true;
    g.add(tent);
    const trim = new THREE.Mesh(new THREE.ConeGeometry(0.92 * s, 0.3 * s, 6), trimMat);
    trim.position.set(dx, 1.3 * s - 0.5 * s, dz);
    g.add(trim);
  }
  // Campfire.
  const fire = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0xe08a3c, emissive: 0xa04a10 }),
  );
  fire.position.set(0.6, 0.15, -0.6);
  g.add(fire);
  // Banner.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), new THREE.MeshLambertMaterial({ color: 0x6b4a2f }));
  pole.position.set(0, 1.3, 2.0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), trimMat);
  flag.position.set(0.45, 2.25, 2.0);
  g.add(pole, flag);

  g.position.set(tribe.x, terrain.heightAt(tribe.x, tribe.z), tribe.z);
  return g;
}

function buildCart(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.55), new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
  body.position.y = 0.42;
  body.castShadow = true;
  const wheelGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 8);
  wheelGeom.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x4a3626 });
  for (const [x, z] of [[-0.3, 0.32], [0.3, 0.32], [-0.3, -0.32], [0.3, -0.32]]) {
    const w = new THREE.Mesh(wheelGeom, wheelMat);
    w.position.set(x, 0.2, z);
    g.add(w);
  }
  // Ox.
  const ox = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.4, 3, 6), new THREE.MeshLambertMaterial({ color: 0x6e5844 }));
  ox.geometry.rotateZ(Math.PI / 2);
  ox.position.set(0.85, 0.35, 0);
  ox.castShadow = true;
  g.add(body, ox);
  return g;
}

export class TribeRenderer {
  private carts = new Map<Caravan, THREE.Group>();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(
    private readonly scene: THREE.Scene,
    private readonly trade: TradeSystem,
    private readonly terrain: Terrain,
  ) {
    for (const tribe of trade.tribes) scene.add(buildCamp(tribe, terrain));
  }

  update(alpha: number): void {
    // Add carts for new caravans, drop finished ones.
    for (const c of this.trade.caravans) {
      if (!this.carts.has(c)) {
        const cart = buildCart();
        this.scene.add(cart);
        this.carts.set(c, cart);
      }
    }
    for (const [c, cart] of this.carts) {
      if (!this.trade.caravans.includes(c)) {
        this.scene.remove(cart);
        this.carts.delete(c);
        continue;
      }
      const x = c.prevX + (c.x - c.prevX) * alpha;
      const z = c.prevZ + (c.z - c.prevZ) * alpha;
      cart.position.set(x, this.terrain.heightAt(x, z), z);
      if (c.moving) {
        const heading = Math.atan2(-(c.z - c.prevZ), c.x - c.prevX);
        cart.quaternion.setFromAxisAngle(this.up, heading);
      }
    }
  }
}
