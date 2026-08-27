import * as THREE from 'three';
import { GameLoop } from './core/GameLoop';
import { Hud } from './core/Hud';
import { RtsCameraController } from './camera/RtsCameraController';
import { buildWorldScene } from './world/worldScene';
import { MAP_SIZE } from './world/terrain';
import { Minimap } from './ui/Minimap';
import { Village } from './sim/village';
import { VillagerRenderer } from './render/VillagerRenderer';
import { Calendar } from './sim/calendar';
import { Events } from './ui/Events';
import { SeasonVisuals } from './render/SeasonVisuals';
import { DayNight } from './render/DayNight';
import { NightLights } from './render/NightLights';
import { showIntro } from './ui/Intro';
import { gameMusic } from './ui/Music';
import { BuildingRenderer } from './render/BuildingRenderer';
import { PlacementController } from './ui/Placement';
import { AnimalSystem } from './sim/animals';
import { AnimalRenderer } from './render/AnimalRenderer';
import { BuildPanel, BuildingInfoPanel, CharacterPanel, InfoPanel, ResearchPanel, ResourcesPanel, SavePanel, StatsPanel, TribesPanel, WorkPanel } from './ui/Panels';
import { RoadRenderer } from './render/RoadRenderer';
import { initTooltips } from './ui/Tooltip';
import { StorageFillRenderer } from './render/StorageFillRenderer';
import { WallRenderer } from './render/WallRenderer';
import { applySave, captureSave, takePendingLoad, writeSlot } from './sim/save';
import { TradeSystem } from './sim/tribes';
import { TribeRenderer } from './render/TribeRenderer';
import { WarSystem } from './sim/war';
import { WarRenderer } from './render/WarRenderer';

const container = document.getElementById('app')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 3500);

// Map seed: ?seed=123 in the URL, otherwise random each load.
const seedParam = new URLSearchParams(location.search).get('seed');
const seed = seedParam ? Number(seedParam) >>> 0 : (Math.random() * 0xffffffff) >>> 0;
console.log(`[world] seed=${seed} (use ?seed=${seed} to replay this map)`);

const t0 = performance.now();
const world = buildWorldScene(scene, seed);
console.log(`[world] generated ${MAP_SIZE}x${MAP_SIZE} in ${(performance.now() - t0).toFixed(0)}ms`);

const calendar = new Calendar();
const events = new Events();
const animals = new AnimalSystem(world.tiles, seed);
const village = new Village(world, calendar, events, animals);
const animalRenderer = new AnimalRenderer(scene, animals, world.terrain);
// (The camp stockpile is a real prebuilt building now — drawn by BuildingRenderer.)
const villagerRenderer = new VillagerRenderer(scene, village.villagers, world.terrain);
const seasonVisuals = new SeasonVisuals(
  world.terrain,
  world.visualRefs.terrainMesh,
  world.visualRefs.canopyMesh,
  world.visualRefs.waterMesh,
);
const dayNight = new DayNight(scene, world.visualRefs.sun, world.visualRefs.hemi);
const nightLights = new NightLights(scene, village, village.villagers, world.terrain);

const controls = new RtsCameraController(camera, renderer.domElement);
controls.setPanBounds(0, 0, MAP_SIZE, MAP_SIZE);
controls.centerOn(village.home.x, village.home.z);
controls.setDistance(70);

const trade = new TradeSystem(world, village, calendar, events, seed);
const tribeRenderer = new TribeRenderer(scene, trade, world.terrain);
const war = new WarSystem(village, trade, calendar, events);
const warRenderer = new WarRenderer(scene, war, world.terrain);

// A pending load (from the Save window) layers saved state onto the fresh world.
let loadedFromSave = false;
{
  const pending = takePendingLoad();
  if (pending && pending.seed === seed) {
    applySave(pending, calendar, village, trade, animals, world);
    events.push('💾 Game loaded.');
    loadedFromSave = true;
  }
}
// The soundscape follows the calendar (owner rule, s54: wolves in winter,
// drums and the primitive guitar in spring).
gameMusic.bindSeason(() => calendar.season);
// Fresh starts open the "Hello World!" chapter screen (owner rule, s42).
if (!loadedFromSave) showIntro();
// Loads skip the chapter, so the soundscape starts right away (the first
// input wakes it if the browser held it back for want of a gesture).
else {
  gameMusic.start();
  window.addEventListener('pointerdown', () => gameMusic.resume(), { once: true });
  window.addEventListener('keydown', () => gameMusic.resume(), { once: true });
}

const minimap = new Minimap(world.tiles, world.terrain, (x, z) => controls.centerOn(x, z));
minimap.bindVillage(village);
minimap.setMarkers(
  trade.tribes.map((t) => ({ x: t.x, z: t.z, color: `#${t.color.toString(16).padStart(6, '0')}` })),
);
const buildingRenderer = new BuildingRenderer(scene, village.buildings, world.terrain);
const placement = new PlacementController(
  camera,
  renderer.domElement,
  world.visualRefs.terrainMesh,
  world.terrain,
  village,
  scene,
);

let lastAutosaveYear = 0;
const loop = new GameLoop(
  (dt) => {
    calendar.tick(dt);
    animals.tick(dt);
    village.tick(dt);
    trade.tick(dt);
    war.tick(dt);
    // Yearly autosave (skipped if the village has perished).
    if (calendar.year > lastAutosaveYear) {
      if (lastAutosaveYear > 0 && village.villagers.length > 0) {
        writeSlot('auto', captureSave(seed, calendar, village, trade, animals, world));
        events.push('💾 Autosaved.');
      }
      lastAutosaveYear = calendar.year;
    }
  },
  (frameDt) => {
    controls.update(frameDt);
    const t = controls.getTargetXZ();
    minimap.update(t.x, t.z, frameDt);
    villagerRenderer.update(loop.getAlpha(), performance.now() / 1000);
    animalRenderer.update(loop.getAlpha(), performance.now() / 1000);
    tribeRenderer.update(loop.getAlpha());
    warRenderer.update(loop.getAlpha(), performance.now() / 1000);
    roadRenderer.update();
    storageFillRenderer.update(frameDt);
    wallRenderer.update();
    seasonVisuals.update(calendar.snowTarget, frameDt);
    dayNight.update(calendar);
    nightLights.update(dayNight.night, loop.getAlpha(), performance.now() / 1000);
    world.skirt.refresh((scene.fog as THREE.Fog).color, frameDt);
    buildingRenderer.update(calendar.season !== 'summer', performance.now() / 1000);
    hud.update();
    renderer.render(scene, camera);
  },
);
const roadRenderer = new RoadRenderer(scene, village, world.terrain);
const storageFillRenderer = new StorageFillRenderer(scene, village, world.terrain);
const wallRenderer = new WallRenderer(scene, village, world.terrain);

initTooltips();
const hud = new Hud(loop, seed);
hud.bindCalendar(calendar);
hud.setTown(village.townName);
const buildingInfo = new BuildingInfoPanel(village);
const characterPanel = new CharacterPanel(village);
buildingInfo.onSelectVillager = (v) => characterPanel.open(v);
hud.bindPanels({
  info: new InfoPanel(village),
  resources: new ResourcesPanel(village),
  work: new WorkPanel(village),
  build: new BuildPanel(village, placement),
  research: new ResearchPanel(village),
  buildingInfo,
  tribes: new TribesPanel(village, trade, war),
  save: new SavePanel(() => captureSave(seed, calendar, village, trade, animals, world)),
  character: characterPanel,
  stats: new StatsPanel(village),
});

// Click a building (left click, no drag, not placing) to inspect it.
{
  let downX = 0;
  let downY = 0;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (e.button !== 0 || placement.active) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
    const ndc = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(world.visualRefs.terrainMesh, false)[0];
    if (!hit) return;
    // A villager takes priority only when clicked almost dead-on (owner fix:
    // big person hitboxes made buildings unclickable).
    let nearest = null;
    let nearestD = 0.55 * 0.55;
    for (const v of village.villagers) {
      if (v.state === 'campaign') continue;
      const d = (v.x - hit.point.x) ** 2 + (v.z - hit.point.z) ** 2;
      if (d < nearestD) {
        nearestD = d;
        nearest = v;
      }
    }
    if (nearest) {
      characterPanel.open(nearest);
      return;
    }
    const tile = Math.floor(hit.point.z) * MAP_SIZE + Math.floor(hit.point.x);
    const b = village.buildingAtTile(tile);
    if (b) buildingInfo.open(b);
  });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

loop.start();
// Owner rule (session 46): the game opens paused — press play when ready.
loop.setSpeed(0);
