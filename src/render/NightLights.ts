import * as THREE from 'three';
import type { Terrain } from '../world/terrain';
import { MAP_SIZE } from '../world/terrain';
import type { Village, Villager } from '../sim/village';

/**
 * Night lighting (owner rules, sessions 40-41) — done WITHOUT real dynamic
 * lights. Hundreds of THREE.PointLights would cripple the forward renderer,
 * so every "light" is an instanced emissive fake: a warm window/doorway glow
 * set INTO each building at ground-floor height (not floating above it), an
 * additive pool of light at the door, and hand-held torches — a long wooden
 * handle with a bright flame on top. Four draw calls total, flicker via
 * instance scale.
 *
 * Late night (second half of the night) windows go dark one by one: each
 * building gets a stable random bed-time derived from its entrance tile.
 */

const CAPACITY = 1024;
const WINDOW_COLOR = 0xffc46a;
const GLOW_COLOR = 0xff9a3c;
const FLAME_COLOR = 0xffb347;
const HANDLE_COLOR = 0x5a4028;

/** Stable 0..1 hash per building (its bed-time in night-t). */
function hash01(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class NightLights {
  private readonly windows: THREE.InstancedMesh;
  private readonly glows: THREE.InstancedMesh;
  private readonly handles: THREE.InstancedMesh;
  private readonly flames: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly pos = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.22);
  private readonly scale = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    private readonly village: Village,
    private readonly villagers: Villager[],
    private readonly terrain: Terrain,
  ) {
    // Lit doorway/window: a squat block sunk into the wall at floor height.
    const windowGeom = new THREE.BoxGeometry(0.42, 0.5, 0.42);
    const glowGeom = new THREE.CircleGeometry(1.7, 12);
    glowGeom.rotateX(-Math.PI / 2);
    // Torch: long wooden shaft, flame sitting on its tip.
    const handleGeom = new THREE.CylinderGeometry(0.025, 0.035, 0.55, 5);
    handleGeom.translate(0, 0.275, 0);
    const flameGeom = new THREE.ConeGeometry(0.07, 0.22, 6);
    flameGeom.translate(0, 0.62, 0);

    this.windows = new THREE.InstancedMesh(
      windowGeom,
      new THREE.MeshBasicMaterial({ color: WINDOW_COLOR }),
      CAPACITY,
    );
    this.glows = new THREE.InstancedMesh(
      glowGeom,
      new THREE.MeshBasicMaterial({
        color: GLOW_COLOR,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      CAPACITY,
    );
    this.handles = new THREE.InstancedMesh(
      handleGeom,
      new THREE.MeshLambertMaterial({ color: HANDLE_COLOR }),
      CAPACITY,
    );
    this.flames = new THREE.InstancedMesh(
      flameGeom,
      new THREE.MeshBasicMaterial({ color: FLAME_COLOR }),
      CAPACITY,
    );
    for (const m of [this.windows, this.glows, this.handles, this.flames]) {
      m.frustumCulled = false;
      m.count = 0;
    }
    scene.add(this.glows, this.windows, this.handles, this.flames);
  }

  /** Complete buildings that light a fire at night. */
  private isLit(kind: string, capacity: number, slots: number): boolean {
    return capacity > 0 || slots > 0 || kind === 'temple' || kind === 'tradingPost';
  }

  update(night: { active: boolean; t: number }, alpha: number, timeSec: number): void {
    if (!night.active) {
      this.windows.count = 0;
      this.glows.count = 0;
      this.handles.count = 0;
      this.flames.count = 0;
      return;
    }

    let n = 0;
    for (const b of this.village.buildings) {
      if (n >= CAPACITY) break;
      if (b.state !== 'complete' || b.demolition) continue;
      if (!this.isLit(b.spec.kind, b.spec.capacity, b.spec.workerSlots)) continue;
      if (b.spec.capacity > 0 && b.occupants.length === 0) continue; // nobody home
      // Bed-time: shops go dark from mid-night on, homes a bit later —
      // spread randomly so windows wink out one by one (owner rule).
      const isShop = b.spec.capacity === 0;
      const bedTime = (isShop ? 0.45 : 0.55) + 0.35 * hash01(b.entranceTile);
      if (night.t > bedTime) continue;
      const ex = (b.entranceTile % MAP_SIZE) + 0.5;
      const ez = ((b.entranceTile / MAP_SIZE) | 0) + 0.5;
      // The glow sits IN the doorway: from the entrance tile toward the
      // building's heart, straddling the wall at floor height (owner rule:
      // inside the building, never hovering above it).
      const dx = b.centerX - ex;
      const dz = b.centerZ - ez;
      const dl = Math.hypot(dx, dz) || 1;
      const wx = ex + (dx / dl) * 0.55;
      const wz = ez + (dz / dl) * 0.55;
      const y = this.terrain.heightAt(ex, ez);
      const flicker = 1 + 0.1 * Math.sin(timeSec * 9 + b.entranceTile);

      this.pos.set(wx, y + 0.42, wz);
      this.scale.setScalar(flicker);
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.windows.setMatrixAt(n, this.matrix);

      this.pos.set(ex, y + 0.05, ez);
      this.scale.setScalar(flicker);
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.glows.setMatrixAt(n, this.matrix);
      n++;
    }
    this.windows.count = n;
    this.glows.count = n;
    this.windows.instanceMatrix.needsUpdate = true;
    this.glows.instanceMatrix.needsUpdate = true;

    // Hand torches for everyone still out in the dark: wooden shaft held at
    // a slight tilt, flame riding the tip.
    let k = 0;
    for (const v of this.villagers) {
      if (k >= CAPACITY) break;
      if (v.state === 'campaign' || v.isBaby) continue;
      const x = v.prevX + (v.x - v.prevX) * alpha;
      const z = v.prevZ + (v.z - v.prevZ) * alpha;
      const size = v.isChild ? 0.55 : 1;
      const y = this.terrain.heightAt(x, z) + 0.3 * size;
      this.pos.set(x + 0.24 * size, y, z);
      this.scale.setScalar(size);
      this.matrix.compose(this.pos, this.tilt, this.scale);
      this.handles.setMatrixAt(k, this.matrix);
      const flicker = 1 + 0.22 * Math.sin(timeSec * 12 + k * 2.3);
      this.scale.set(size, size * flicker, size);
      this.matrix.compose(this.pos, this.tilt, this.scale);
      this.flames.setMatrixAt(k, this.matrix);
      k++;
    }
    this.handles.count = k;
    this.flames.count = k;
    this.handles.instanceMatrix.needsUpdate = true;
    this.flames.instanceMatrix.needsUpdate = true;
  }
}
