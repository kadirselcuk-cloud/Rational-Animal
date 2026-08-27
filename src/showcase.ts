import * as THREE from 'three';
import { BuildingRenderer } from './render/BuildingRenderer';
import { RoadRenderer } from './render/RoadRenderer';
import { BUILDING_SPECS, specFor, type Building, type BuildingKind } from './sim/buildings';
import { MAP_SIZE, type Terrain } from './world/terrain';
import type { Village } from './sim/village';

/**
 * Dev-only graphics showcase (http://localhost:5180/showcase.html):
 * every building kind finished on flat ground, plus a road network that
 * exercises the auto-tiling — no simulation, no save. Camera can be moved
 * with ?x=&z=&zoom= query params.
 */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb6c9);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xbfd0dd, 0x4a5238, 0.9));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
sun.position.set(40, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(sun);
sun.target.position.set(256, 0, 256);
scene.add(sun.target);
sun.position.set(256 + 40, 60, 256 + 20);

const flatTerrain: Terrain = {
  size: MAP_SIZE,
  heights: new Float32Array(0),
  heightAt: () => 0,
};

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshLambertMaterial({ color: 0x6d8a4e }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(256, 0, 256);
ground.receiveShadow = true;
scene.add(ground);

// --- one of every building kind, laid out on a grid --------------------------
const kinds = Object.keys(BUILDING_SPECS) as BuildingKind[];
const buildings: Building[] = [];
const COLS = 6;
const SPACING = 8;
const originX = 256 - ((COLS - 1) * SPACING) / 2;
const originZ = 256 - 20;
kinds.forEach((kind, i) => {
  const spec = BUILDING_SPECS[kind];
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  buildings.push({
    spec,
    state: 'complete',
    centerX: originX + col * SPACING,
    centerZ: originZ + row * SPACING,
    growth: 0.8,
    upgraded: false,
    rot: 0,
    firewoodStore: 5, // so chimney smoke shows in the showcase
    visualDirty: false,
  } as unknown as Building);
});
// Two rotated examples (R-key placements) to check the quarter-turn mapping.
for (const [kind, rot, x, z] of [['fishingHut', 1, 226, 260], ['tailor', 3, 226, 268]] as [BuildingKind, number, number, number][]) {
  buildings.push({
    spec: specFor(kind, rot),
    state: 'complete',
    centerX: x,
    centerZ: z,
    growth: 0.8,
    upgraded: false,
    rot,
    firewoodStore: 0,
    visualDirty: false,
  } as unknown as Building);
}
const buildingRenderer = new BuildingRenderer(scene, buildings, flatTerrain);

// --- road network exercising the auto-tiler ---------------------------------
const roads = new Map<number, 'stone' | 'dirt'>();
const setRoad = (x: number, z: number, kind: 'stone' | 'dirt' = 'stone') =>
  roads.set(z * MAP_SIZE + x, kind);
const RZ = 256 + 24; // south of the building rows
// plaza 5×4
for (let x = 244; x < 249; x++) for (let z = RZ; z < RZ + 4; z++) setRoad(x, z);
// 2-wide avenue east from the plaza
for (let x = 249; x < 264; x++) for (let z = RZ + 1; z < RZ + 3; z++) setRoad(x, z);
// 1-wide path north from the avenue, with a bend west
for (let z = RZ - 6; z < RZ + 1; z++) setRoad(258, z);
for (let x = 252; x < 258; x++) setRoad(x, RZ - 6);
// dirt path south of the plaza
for (let x = 240; x < 252; x++) setRoad(x, RZ + 6, 'dirt');
const fakeVillage = { roads, pendingWorks: [] } as unknown as Village;
const roadRenderer = new RoadRenderer(scene, fakeVillage, flatTerrain);

// --- camera ------------------------------------------------------------------
const params = new URLSearchParams(location.search);
const cx = Number(params.get('x') ?? 256);
const cz = Number(params.get('z') ?? 256 + 6);
const zoom = Number(params.get('zoom') ?? 34);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(cx, zoom, cz + zoom * 0.85);
camera.lookAt(cx, 0, cz);

renderer.setAnimationLoop(() => {
  buildingRenderer.update(true, performance.now() / 1000);
  roadRenderer.update();
  renderer.render(scene, camera);
});
