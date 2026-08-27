import * as THREE from 'three';
import { MAP_SIZE, type Terrain } from '../world/terrain';
import { BUILDING_SPECS, specFor, type BuildingKind } from '../sim/buildings';
import { WALL_DEFS, type Village, type WallKind } from '../sim/village';
import { buildBuildingPreview } from '../render/BuildingRenderer';
import { onKitReady } from '../render/kit';

/**
 * Placement modes:
 *  - Buildings: ghost follows the cursor, click places.
 *  - Roads & walls: click sets the line start, a preview line follows the
 *    cursor, second click commits; Esc/right-click cancels the line first,
 *    then the mode. Road lines cut-and-fill the terrain to a level grade.
 *  - Gates: single click.
 */

export type PlacementMode = BuildingKind | WallKind | 'road' | 'stoneRoad';

const LINE_MODES: PlacementMode[] = ['road', 'stoneRoad', 'woodWall', 'stoneWall'];
const PREVIEW_CAPACITY = 512;

export class PlacementController {
  active: PlacementMode | null = null;
  onChanged: (() => void) | null = null;

  private ghost: THREE.Group;
  private ghostMat = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.55 });
  private linePreview: THREE.InstancedMesh;
  private lineStart: { x: number; z: number } | null = null;
  private lineTiles: number[] = [];
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private anchor = { x: -1, z: -1 };
  private valid = false;
  /** Building rotation in quarter turns, cycled with R while placing. */
  private rot = 0;
  private lastPoint: THREE.Vector3 | null = null;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    private readonly terrainMesh: THREE.Mesh,
    private readonly terrain: Terrain,
    private readonly village: Village,
    private readonly scene: THREE.Scene,
  ) {
    // Ghost: the real building composition, semi-transparent (owner rule).
    // Built per kind on activation; starts as an empty placeholder.
    this.ghost = new THREE.Group();
    this.ghost.visible = false;
    scene.add(this.ghost);
    // If the model kit finishes loading mid-placement, upgrade the ghost.
    onKitReady(() => {
      if (this.isBuildingMode()) this.buildGhostFor(this.active as BuildingKind);
    });

    const quad = new THREE.PlaneGeometry(0.95, 0.95);
    quad.rotateX(-Math.PI / 2);
    this.linePreview = new THREE.InstancedMesh(quad, this.ghostMat, PREVIEW_CAPACITY);
    this.linePreview.count = 0;
    // Instances are placed far from the mesh origin — never frustum-cull.
    this.linePreview.frustumCulled = false;
    scene.add(this.linePreview);

    // Live hint bar: what's being placed, its cost, and WHY a spot is invalid.
    this.hint = document.createElement('div');
    this.hint.id = 'place-hint';
    this.hint.style.display = 'none';
    document.body.appendChild(this.hint);

    dom.addEventListener('pointermove', (e) => this.onMove(e));
    dom.addEventListener('pointerdown', (e) => this.onDown(e), { capture: true });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.cancel();
      // R rotates the pending building (owner rule).
      if (e.code === 'KeyR' && this.isBuildingMode()) {
        this.rot = (this.rot + 1) % 4;
        this.ghost.rotation.y = -this.rot * (Math.PI / 2);
        if (this.lastPoint) this.updateBuildingGhost(this.lastPoint);
      }
    });
  }

  private hint: HTMLElement;

  private setHint(text: string, tone: 'ok' | 'warn' | 'bad'): void {
    this.hint.style.display = 'block';
    this.hint.innerHTML = text;
    this.hint.className = tone;
  }

  private isLineMode(): boolean {
    return this.active !== null && LINE_MODES.includes(this.active);
  }

  private isGateMode(): boolean {
    return this.active === 'woodGate' || this.active === 'stoneGate';
  }

  private isBuildingMode(): boolean {
    return this.active !== null && !this.isLineMode() && !this.isGateMode();
  }

  toggle(mode: PlacementMode): void {
    const isBuilding = (Object.keys(BUILDING_SPECS) as string[]).includes(mode);
    if (this.active !== mode && isBuilding && !this.village.isBuildingUnlocked(mode as BuildingKind)) return;
    this.active = this.active === mode ? null : mode;
    this.rot = 0;
    this.resetVisuals();
    if (this.isBuildingMode()) this.buildGhostFor(this.active as BuildingKind);
    this.onChanged?.();
  }

  cancel(): void {
    if (this.lineStart) {
      // First Esc/right-click only abandons the current line.
      this.lineStart = null;
      this.linePreview.count = 0;
      this.linePreview.instanceMatrix.needsUpdate = true;
      return;
    }
    if (!this.active) return;
    this.active = null;
    this.resetVisuals();
    this.onChanged?.();
  }

  /** Swap the ghost for the given kind's real look, faded out. */
  private buildGhostFor(kind: BuildingKind): void {
    this.scene.remove(this.ghost);
    const wasVisible = this.ghost.visible;
    this.ghost = buildBuildingPreview(kind);
    this.ghost.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[];
      const cloned = mats.map((m) => {
        const c = m.clone();
        c.transparent = true;
        c.opacity = 0.55;
        c.depthWrite = false;
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
    });
    // Validity plate under the ghost — green/red via the shared ghost material.
    const spec = BUILDING_SPECS[kind];
    const plateGeom = new THREE.PlaneGeometry(spec.w, spec.d);
    plateGeom.rotateX(-Math.PI / 2);
    const plate = new THREE.Mesh(plateGeom, this.ghostMat);
    plate.position.y = 0.04;
    this.ghost.add(plate);
    // Entrance arrow (owner rule): points at the main door — the south side
    // in building-local space, so it turns with R along with the ghost.
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, -0.45); // tip, toward the door
    arrowShape.lineTo(0.26, 0);
    arrowShape.lineTo(0.1, 0);
    arrowShape.lineTo(0.1, 0.45);
    arrowShape.lineTo(-0.1, 0.45);
    arrowShape.lineTo(-0.1, 0);
    arrowShape.lineTo(-0.26, 0);
    arrowShape.closePath();
    const arrowGeom = new THREE.ShapeGeometry(arrowShape);
    arrowGeom.rotateX(-Math.PI / 2); // lay flat, facing up
    arrowGeom.rotateY(Math.PI); // tip toward -z: at the door north of the arrow
    const arrow = new THREE.Mesh(
      arrowGeom,
      new THREE.MeshBasicMaterial({ color: 0xffd44a, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    arrow.position.set(0, 0.06, spec.d / 2 + 0.75);
    arrow.renderOrder = 10;
    this.ghost.add(arrow);
    this.ghost.rotation.y = -this.rot * (Math.PI / 2);
    this.ghost.visible = wasVisible;
    this.scene.add(this.ghost);
  }

  private resetVisuals(): void {
    this.ghost.visible = false;
    this.lastPoint = null;
    this.lineStart = null;
    this.lineTiles = [];
    this.linePreview.count = 0;
    this.linePreview.instanceMatrix.needsUpdate = true;
    this.hint.style.display = 'none';
  }

  private hitPoint(e: PointerEvent): THREE.Vector3 | null {
    this.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.terrainMesh, false)[0];
    return hit ? hit.point : null;
  }

  private showLinePreview(tiles: number[], valid: boolean): void {
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const n = Math.min(tiles.length, PREVIEW_CAPACITY);
    for (let i = 0; i < n; i++) {
      const x = (tiles[i] % MAP_SIZE) + 0.5;
      const z = ((tiles[i] / MAP_SIZE) | 0) + 0.5;
      pos.set(x, this.terrain.heightAt(x, z) + 0.06, z);
      matrix.setPosition(pos);
      this.linePreview.setMatrixAt(i, matrix);
    }
    this.linePreview.count = n;
    this.linePreview.instanceMatrix.needsUpdate = true;
    this.ghostMat.color.setHex(valid ? 0x5fae52 : 0xc75454);
  }

  private onMove(e: PointerEvent): void {
    if (!this.active) return;
    const point = this.hitPoint(e);
    if (!point) return;
    const tx = Math.floor(point.x);
    const tz = Math.floor(point.z);

    if (this.isLineMode() || this.isGateMode()) {
      const from = this.isLineMode() ? (this.lineStart ?? { x: tx, z: tz }) : { x: tx, z: tz };
      this.lineTiles = this.isLineMode() ? this.village.roadLine(from.x, from.z, tx, tz) : [tz * MAP_SIZE + tx];
      if (!this.isLineMode()) {
        this.anchor.x = tx;
        this.anchor.z = tz;
      }

      // Diagnose separately: terrain-blocked vs can't afford — and say so.
      const isRoad = this.active === 'road' || this.active === 'stoneRoad';
      const tilesOk = isRoad
        ? this.lineTiles.every((t) => this.village.roadTileOk(t % MAP_SIZE, (t / MAP_SIZE) | 0))
        : this.lineTiles.every((t) => this.village.wallTileOk(t % MAP_SIZE, (t / MAP_SIZE) | 0));
      const n = this.lineTiles.length;
      let affordable = true;
      let costText = 'free — terrain is levelled along the way';
      if (this.active === 'stoneRoad') {
        affordable = this.village.canAffordStoneRoad(n);
        costText = `${n} stone (have ${Math.floor(this.village.resources.stone)})`;
      } else if (!isRoad) {
        const kind = this.active as WallKind;
        const def = WALL_DEFS[kind];
        affordable = this.village.canAffordWalls(kind, n);
        const parts: string[] = [];
        if (def.cost.wood) parts.push(`${def.cost.wood * n} wood (have ${Math.floor(this.village.resources.wood)})`);
        if (def.cost.stone) parts.push(`${def.cost.stone * n} stone (have ${Math.floor(this.village.resources.stone)})`);
        costText = parts.join(' + ');
      }
      this.valid = tilesOk && affordable;
      this.showLinePreview(this.lineTiles, this.valid);

      const name =
        this.active === 'road' ? '🛤 Dirt road'
        : this.active === 'stoneRoad' ? '🛤 Stone road'
        : WALL_DEFS[this.active as WallKind].label;
      const action = this.isGateMode() ? 'click to place' : this.lineStart ? 'click to finish · Esc to restart' : 'click to set the start point';
      if (!tilesOk) this.setHint(`${name} · ${n} tile${n > 1 ? 's' : ''} — ❌ blocked by water, buildings, or walls`, 'bad');
      else if (!affordable) this.setHint(`${name} · ${n} tile${n > 1 ? 's' : ''} — ⚠ not enough materials: ${costText}`, 'warn');
      else this.setHint(`${name} · ${n} tile${n > 1 ? 's' : ''} · ${costText} — ${action}`, 'ok');
      return;
    }

    this.updateBuildingGhost(point);
  }

  private updateBuildingGhost(point: THREE.Vector3): void {
    if (!this.isBuildingMode()) return;
    this.lastPoint = point.clone();
    const kind = this.active as BuildingKind;
    const spec = specFor(kind, this.rot);
    this.anchor.x = Math.round(point.x - spec.w / 2);
    this.anchor.z = Math.round(point.z - spec.d / 2);
    const cx = this.anchor.x + spec.w / 2;
    const cz = this.anchor.z + spec.d / 2;
    this.valid = this.village.canPlace(kind, this.anchor.x, this.anchor.z, this.rot);
    this.ghost.position.set(cx, this.terrain.heightAt(cx, cz), cz);
    this.ghost.visible = true;
    this.ghostMat.color.setHex(this.valid ? 0x5fae52 : 0xc75454);
    const name = spec.label;
    if (this.valid) this.setHint(`${name} — click to place · R to rotate`, 'ok');
    else if (kind === 'fishingHut') this.setHint(`${name} — ❌ the dock (R rotates it) must reach open water`, 'bad');
    else this.setHint(`${name} — ❌ blocked terrain, buildings, or missing deposit · R to rotate`, 'bad');
  }

  private onDown(e: PointerEvent): void {
    if (!this.active) return;
    if (e.button === 2) {
      e.stopImmediatePropagation();
      e.preventDefault();
      this.cancel();
      return;
    }
    if (e.button !== 0) return;

    if (this.isLineMode()) {
      const point = this.hitPoint(e);
      if (!point) return;
      if (!this.lineStart) {
        this.lineStart = { x: Math.floor(point.x), z: Math.floor(point.z) };
        return;
      }
      if (!this.valid) return;
      if (this.active === 'road') this.village.layRoadLine(this.lineTiles, 'dirt');
      else if (this.active === 'stoneRoad') this.village.layRoadLine(this.lineTiles, 'stone');
      else this.village.layWallLine(this.lineTiles, this.active as WallKind);
      // Stay in the mode for the next line, starting fresh.
      this.lineStart = null;
      this.linePreview.count = 0;
      this.linePreview.instanceMatrix.needsUpdate = true;
      return;
    }
    if (this.isGateMode()) {
      if (this.valid) this.village.layWallLine(this.lineTiles, this.active as WallKind);
      return;
    }
    if (!this.valid) return;
    if (this.village.placeBuilding(this.active as BuildingKind, this.anchor.x, this.anchor.z, this.rot)) {
      this.cancel();
    }
  }
}
