import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Kenney Fantasy Town Kit (CC0, public/models/fantasy-town/) — loader and
 * prefab composition helpers. The kit is modular on a 1×1 tile grid, which
 * matches the game's world grid exactly:
 *  - wall pieces are 0.1-thick panels on a tile's +X edge (x 0.4..0.5),
 *    decorated face at x=0.4 pointing toward -X (into the tile);
 *  - roof pieces are one-tile slopes, eave at -X (with overhang), ridge at +X;
 *  - road pieces are full 1×1 tiles, pivot at the tile center.
 *
 * Everything loads once, asynchronously; renderers fall back to the old
 * primitive meshes until `kitReady` flips and `onKitReady` fires.
 */

const BASE = 'models/fantasy-town/';

const NAMES = [
  // stone/plaster walls
  'wall', 'wall-door', 'wall-window-shutters', 'wall-window-small',
  // timber walls
  'wall-wood', 'wall-wood-door', 'wall-wood-window-shutters', 'wall-wood-window-small',
  // roofs
  'roof', 'roof-high', 'roof-point',
  // details & props
  'chimney', 'fence', 'fence-gate', 'pillar-wood', 'pillar-stone', 'rock-small', 'hedge',
  'banner-red', 'banner-green', 'lantern', 'stall', 'stall-red', 'stall-green', 'stall-bench', 'stall-stool', 'cart',
  // roads
  'road', 'road-edge', 'road-corner',
];

const prototypes = new Map<string, THREE.Group>();
const lambertCache = new Map<string, THREE.MeshLambertMaterial>();
const overrideCache = new Map<number, THREE.MeshLambertMaterial>();
const tintCache = new Map<string, THREE.MeshLambertMaterial>();

export let kitReady = false;
let loadStarted = false;
const readyCallbacks: (() => void)[] = [];

export function onKitReady(cb: () => void): void {
  if (kitReady) cb();
  else readyCallbacks.push(cb);
}

/** Scene lights are Lambert-tuned; swap the loader's Standard materials. */
function toLambert(mat: THREE.Material): THREE.MeshLambertMaterial {
  const cached = lambertCache.get(mat.uuid);
  if (cached) return cached;
  const s = mat as THREE.MeshStandardMaterial;
  const m = new THREE.MeshLambertMaterial({ map: s.map ?? null, color: s.color?.clone() ?? new THREE.Color(0xffffff) });
  lambertCache.set(mat.uuid, m);
  return m;
}

export function loadKit(): void {
  if (loadStarted) return;
  loadStarted = true;
  const loader = new GLTFLoader();
  let pending = NAMES.length;
  for (const name of NAMES) {
    loader.load(
      `${BASE}${name}.glb`,
      (gltf) => {
        const g = new THREE.Group();
        // Reparenting while iterating a live child list skips entries; copy first.
        for (const child of [...gltf.scene.children]) g.add(child);
        g.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            const mesh = o as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.material = Array.isArray(mesh.material)
              ? mesh.material.map(toLambert)
              : toLambert(mesh.material);
          }
        });
        prototypes.set(name, g);
        if (--pending === 0) finishLoad();
      },
      undefined,
      (err) => {
        console.error(`kit: failed to load ${name}.glb`, err);
        if (--pending === 0) finishLoad();
      },
    );
  }
}

function finishLoad(): void {
  kitReady = true;
  for (const cb of readyCallbacks) cb();
  readyCallbacks.length = 0;
}

/** Clone of a kit piece (shared materials). */
export function kit(name: string): THREE.Group {
  const proto = prototypes.get(name);
  if (!proto) throw new Error(`kit piece not loaded: ${name}`);
  return proto.clone(true);
}

/** Flat single-color version of a piece (roof color variants etc.). */
export function kitColored(name: string, color: number): THREE.Group {
  const g = kit(name);
  let mat = overrideCache.get(color);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color });
    overrideCache.set(color, mat);
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat!;
  });
  return g;
}

// ---------------------------------------------------------------------------
// Procedural material textures (owner rule: straw roofs read as straw, clay
// tile roofs as tiles, and walls as wood planks / stone blocks / brick).
// Kit UVs point at palette cells, so patterned pieces get box-projected UVs
// instead (see kitPatternedMesh) with these repeating canvas textures.
// ---------------------------------------------------------------------------

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  draw(ctx, rand);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Yellow thatch: layered horizontal strands. */
function makeStrawTexture(): THREE.Texture {
  return canvasTexture(64, (ctx, rand) => {
    ctx.fillStyle = '#c2a04a';
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 260; i++) {
      const y = rand() * 64;
      const x = rand() * 64;
      const len = 6 + rand() * 14;
      const shade = rand();
      ctx.strokeStyle = shade < 0.5 ? `rgba(140,110,45,${0.25 + rand() * 0.3})` : `rgba(226,196,110,${0.25 + rand() * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + (rand() - 0.5) * 2);
      ctx.stroke();
    }
    // course shadows every few rows so the thatch reads as layered
    for (let y = 10; y < 64; y += 16) {
      ctx.fillStyle = 'rgba(90,70,30,0.18)';
      ctx.fillRect(0, y, 64, 2);
    }
  });
}

/** Red-brown clay tiles: offset courses with shadowed lower edges. */
function makeClayTileTexture(): THREE.Texture {
  return canvasTexture(64, (ctx, rand) => {
    ctx.fillStyle = '#96402f';
    ctx.fillRect(0, 0, 64, 64);
    const rowH = 16;
    const tileW = 16;
    for (let r = 0; r < 4; r++) {
      const y = r * rowH;
      const off = (r % 2) * (tileW / 2);
      for (let c = -1; c < 5; c++) {
        const x = c * tileW + off;
        const shade = 150 + Math.floor(rand() * 40);
        ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.42)},${Math.floor(shade * 0.3)})`;
        ctx.fillRect(x + 1, y, tileW - 2, rowH - 3);
      }
      // dark gap under each course
      ctx.fillStyle = 'rgba(60,20,12,0.65)';
      ctx.fillRect(0, y + rowH - 3, 64, 3);
    }
  });
}

/** Horizontal round logs (owner rule): cylindrical shading per log row. */
function makeWoodTexture(): THREE.Texture {
  return canvasTexture(64, (ctx, rand) => {
    ctx.fillStyle = '#5c3a1e';
    ctx.fillRect(0, 0, 64, 64);
    const logH = 16;
    for (let r = 0; r < 4; r++) {
      const y = r * logH;
      const shade = 150 + Math.floor(rand() * 22);
      // rounded cross-section: dark edges, light middle
      const grad = ctx.createLinearGradient(0, y, 0, y + logH);
      const mid = `rgb(${shade},${Math.floor(shade * 0.64)},${Math.floor(shade * 0.38)})`;
      const edge = `rgb(${Math.floor(shade * 0.62)},${Math.floor(shade * 0.4)},${Math.floor(shade * 0.24)})`;
      grad.addColorStop(0, edge);
      grad.addColorStop(0.45, mid);
      grad.addColorStop(0.55, mid);
      grad.addColorStop(1, edge);
      ctx.fillStyle = grad;
      ctx.fillRect(0, y + 1, 64, logH - 2);
      // sparse grain along the log
      for (let i = 0; i < 3; i++) {
        const gy = y + 3 + rand() * (logH - 6);
        ctx.strokeStyle = `rgba(80,50,25,${0.15 + rand() * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(64, gy + (rand() - 0.5) * 3);
        ctx.stroke();
      }
      // groove between logs
      ctx.fillStyle = 'rgba(45,26,12,0.9)';
      ctx.fillRect(0, y, 64, 2);
    }
  });
}

/** Clean floor planks: boards with staggered end joints and light grain. */
function makePlankTexture(): THREE.Texture {
  return canvasTexture(64, (ctx, rand) => {
    ctx.fillStyle = '#6b4a28';
    ctx.fillRect(0, 0, 64, 64);
    const boardH = 8;
    for (let r = 0; r < 8; r++) {
      const y = r * boardH;
      const shade = 155 + Math.floor(rand() * 30);
      ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.7)},${Math.floor(shade * 0.44)})`;
      ctx.fillRect(0, y + 1, 64, boardH - 2);
      // grain streaks along the board
      for (let i = 0; i < 3; i++) {
        const gy = y + 2 + rand() * (boardH - 4);
        ctx.strokeStyle = `rgba(95,60,30,${0.25 + rand() * 0.25})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(64, gy + (rand() - 0.5) * 2);
        ctx.stroke();
      }
      // staggered end joint
      const jx = Math.floor(rand() * 8) * 8;
      ctx.fillStyle = 'rgba(60,36,18,0.85)';
      ctx.fillRect(jx, y + 1, 1.5, boardH - 2);
      // board seam
      ctx.fillStyle = 'rgba(52,32,16,0.9)';
      ctx.fillRect(0, y, 64, 1.5);
    }
  });
}

/** Irregular rubble masonry: uneven courses, varied stone sizes and hues.
 *  `level` scales the overall brightness (1 = walls, lower = dark pavement). */
function makeStoneTexture(level = 1): THREE.Texture {
  return canvasTexture(64, (ctx, rand) => {
    const mortar = Math.floor(95 * level);
    ctx.fillStyle = `rgb(${mortar},${mortar - 6},${mortar + 15})`;
    ctx.fillRect(0, 0, 64, 64);
    let y = 0;
    let row = 0;
    while (y < 64) {
      const rowH = 11 + Math.floor(rand() * 7); // uneven courses
      let x = -Math.floor(rand() * 10);
      while (x < 64) {
        const w = 10 + Math.floor(rand() * 14); // varied stone widths
        // Lighter overall, with the occasional near-black stone (owner rule).
        const dark = rand() < 0.12;
        const shade = Math.floor((dark ? 70 + rand() * 20 : 170 + rand() * 40) * level);
        const warm = !dark && rand() < 0.25; // occasional warmer stone
        ctx.fillStyle = warm
          ? `rgb(${shade},${shade - 12},${shade - 4})`
          : `rgb(${shade - 8},${shade - 12},${shade + 6})`;
        // slightly irregular quad instead of a straight rect
        const j = () => (rand() - 0.5) * 3;
        ctx.beginPath();
        ctx.moveTo(x + 1 + j(), y + 1 + j());
        ctx.lineTo(x + w - 1 + j(), y + 1 + j());
        ctx.lineTo(x + w - 1 + j(), y + rowH - 1 + j());
        ctx.lineTo(x + 1 + j(), y + rowH - 1 + j());
        ctx.closePath();
        ctx.fill();
        // subtle top-light bevel
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x + 2, y + 2, w - 4, 2);
        x += w;
      }
      y += rowH;
      row++;
      if (row > 8) break;
    }
  });
}

/** Grey slate/stone roof tiles in offset courses. */
function makeStoneTileTexture(): THREE.Texture {
  return canvasTexture(64, (ctx, rand) => {
    ctx.fillStyle = '#3f3b4a';
    ctx.fillRect(0, 0, 64, 64);
    const rowH = 16;
    const tileW = 16;
    for (let r = 0; r < 4; r++) {
      const y = r * rowH;
      const off = (r % 2) * (tileW / 2);
      for (let c = -1; c < 5; c++) {
        const x = c * tileW + off;
        const shade = 72 + Math.floor(rand() * 26);
        ctx.fillStyle = `rgb(${shade - 4},${shade - 8},${shade + 8})`;
        ctx.fillRect(x + 1, y, tileW - 2, rowH - 3);
      }
      // dark gap under each course
      ctx.fillStyle = 'rgba(18,16,24,0.75)';
      ctx.fillRect(0, y + rowH - 3, 64, 3);
    }
  });
}

/** Terracotta brick courses. */
function makeBrickTexture(): THREE.Texture {
  return canvasTexture(64, (ctx, rand) => {
    ctx.fillStyle = '#b09070';
    ctx.fillRect(0, 0, 64, 64);
    const rowH = 8;
    const brickW = 16;
    for (let r = 0; r < 8; r++) {
      const y = r * rowH;
      const off = (r % 2) * (brickW / 2);
      for (let c = -1; c < 5; c++) {
        const x = c * brickW + off;
        const shade = 175 + Math.floor(rand() * 35);
        ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.52)},${Math.floor(shade * 0.38)})`;
        ctx.fillRect(x + 1, y + 1, brickW - 2, rowH - 2);
      }
    }
  });
}

export type PatternName = 'straw' | 'clayTile' | 'stoneTile' | 'wood' | 'planks' | 'stone' | 'darkStone' | 'brick';

/**
 * Per-building shade variants (owner rule: neighbours shouldn't be clones).
 * Quantized to five tints so materials stay shared and the draw-call count
 * bounded. Index with any position hash.
 */
const VARIANT_TINTS = [0xffffff, 0xf3ebdf, 0xe6eaf2, 0xdedede, 0xfdf2e4];
export const VARIANT_COUNT = VARIANT_TINTS.length;

/** A flat color nudged by a variant tint (for the flat-colored roofs). */
export function applyVariant(color: number, variant: number): number {
  const c = new THREE.Color(color).multiply(new THREE.Color(VARIANT_TINTS[variant % VARIANT_COUNT]));
  return c.getHex();
}

const patternTextures = new Map<PatternName, THREE.Texture>();
const patternMats = new Map<string, THREE.MeshLambertMaterial>();

function patternTexture(name: PatternName): THREE.Texture {
  let tex = patternTextures.get(name);
  if (!tex) {
    tex =
      name === 'straw' ? makeStrawTexture()
      : name === 'clayTile' ? makeClayTileTexture()
      : name === 'stoneTile' ? makeStoneTileTexture()
      : name === 'wood' ? makeWoodTexture()
      : name === 'planks' ? makePlankTexture()
      : name === 'stone' ? makeStoneTexture()
      : name === 'darkStone' ? makeStoneTexture(0.55)
      : makeBrickTexture();
    patternTextures.set(name, tex);
  }
  return tex;
}

export function patternMaterial(name: PatternName, variant = 0): THREE.MeshLambertMaterial {
  const v = variant % VARIANT_COUNT;
  const key = `${name}:${v}`;
  let mat = patternMats.get(key);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ map: patternTexture(name), color: VARIANT_TINTS[v] });
    patternMats.set(key, mat);
  }
  return mat;
}

/**
 * Box-projected UVs in local units (1 unit = 1 texture repeat) so a repeating
 * pattern can be applied to a kit piece regardless of its palette UVs.
 */
function boxProjectUVs(geom: THREE.BufferGeometry): void {
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    let u: number;
    let v: number;
    if (nx >= ny && nx >= nz) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else if (ny >= nx && ny >= nz) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

const patternGeomCache = new Map<string, THREE.BufferGeometry>();

/**
 * A kit piece rebuilt as a single mesh with box-projected UVs and a repeating
 * pattern material — for plain wall slabs and roof slopes, where the palette
 * texture should give way to an actual material pattern.
 */
export function kitPatternedMesh(name: string, pattern: PatternName, variant = 0): THREE.Mesh {
  let geom = patternGeomCache.get(name);
  if (!geom) {
    geom = kitGeometry(name).geometry; // already a transformed clone
    boxProjectUVs(geom);
    patternGeomCache.set(name, geom);
  }
  const mesh = new THREE.Mesh(geom, patternMaterial(pattern, variant));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Box with world-scaled pattern UVs — plank floors, decks and the like. */
export function patternedBox(w: number, h: number, d: number, pattern: PatternName, variant = 0): THREE.Mesh {
  return patternedMesh(new THREE.BoxGeometry(w, h, d), pattern, variant);
}

/** Any geometry with box-projected pattern UVs (kiln domes and the like). */
export function patternedMesh(geom: THREE.BufferGeometry, pattern: PatternName, variant = 0): THREE.Mesh {
  boxProjectUVs(geom);
  const mesh = new THREE.Mesh(geom, patternMaterial(pattern, variant));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Patterned door/window panels: the big wall slab takes the material pattern,
// while trim (door leaf, shutters, frames) keeps the kit look. Classification
// is by palette color: triangles whose UV samples match the plain wall's
// dominant palette cell are "slab", the rest are "trim".
// ---------------------------------------------------------------------------

let colormapData: ImageData | null = null;

function getColormapData(): ImageData | null {
  if (colormapData) return colormapData;
  for (const m of lambertCache.values()) {
    const img = m.map?.image as (ImageBitmap | HTMLImageElement | undefined);
    if (img && img.width) {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img as CanvasImageSource, 0, 0);
      colormapData = ctx.getImageData(0, 0, img.width, img.height);
      return colormapData;
    }
  }
  return null;
}

function sampleColormap(data: ImageData, u: number, v: number): [number, number, number] {
  // GLTF textures load with flipY=false, so v runs top-down like ImageData.
  const px = Math.min(data.width - 1, Math.max(0, Math.floor((u % 1 + 1) % 1 * data.width)));
  const py = Math.min(data.height - 1, Math.max(0, Math.floor((v % 1 + 1) % 1 * data.height)));
  const i = (py * data.width + px) * 4;
  return [data.data[i], data.data[i + 1], data.data[i + 2]];
}

/**
 * The significant palette colors of a piece (≥8% of surface area, top 3).
 * The kit palette cells are GRADIENTS, so one material spans several shades —
 * a slab match must accept all of them, not just the dominant one.
 */
const baseColorsCache = new Map<string, [number, number, number][] | null>();

function pieceBaseColors(name: string): [number, number, number][] | null {
  if (baseColorsCache.has(name)) return baseColorsCache.get(name)!;
  const data = getColormapData();
  let result: [number, number, number][] | null = null;
  if (data) {
    const { geometry } = kitGeometry(name);
    const areas = new Map<string, { area: number; c: [number, number, number] }>();
    let total = 0;
    forEachTriangle(geometry, (ax, ay, az, bx, by, bz, cx, cy, cz, u, v) => {
      const abx = bx - ax, aby = by - ay, abz = bz - az;
      const acx = cx - ax, acy = cy - ay, acz = cz - az;
      const crx = aby * acz - abz * acy;
      const cry = abz * acx - abx * acz;
      const crz = abx * acy - aby * acx;
      const area = Math.sqrt(crx * crx + cry * cry + crz * crz) / 2;
      total += area;
      const c = sampleColormap(data, u, v);
      const key = `${c[0] >> 3},${c[1] >> 3},${c[2] >> 3}`;
      const e = areas.get(key);
      if (e) e.area += area;
      else areas.set(key, { area, c });
    });
    const significant = [...areas.values()]
      .filter((e) => e.area >= total * 0.08)
      .sort((a, b) => b.area - a.area)
      .slice(0, 3)
      .map((e) => e.c);
    result = significant.length ? significant : null;
  }
  baseColorsCache.set(name, result);
  return result;
}

/** Iterate triangles with their UV centroid (works indexed or not). */
function forEachTriangle(
  geom: THREE.BufferGeometry,
  cb: (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, u: number, v: number, triIndex: number) => void,
): void {
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  const index = geom.index;
  const triCount = (index ? index.count : pos.count) / 3;
  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    const u0 = (uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3;
    const v0 = (uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3;
    cb(
      pos.getX(i0), pos.getY(i0), pos.getZ(i0),
      pos.getX(i1), pos.getY(i1), pos.getZ(i1),
      pos.getX(i2), pos.getY(i2), pos.getZ(i2),
      u0, v0, t,
    );
  }
}

interface ClassifiedGeom {
  geometry: THREE.BufferGeometry;
  hasTrim: boolean;
}

const classifiedCache = new Map<string, ClassifiedGeom>();
let trimMaterial: THREE.MeshLambertMaterial | null = null;

/** Kit-textured material reading the second UV channel (original palette UVs). */
function getTrimMaterial(): THREE.MeshLambertMaterial {
  if (!trimMaterial) {
    let src: THREE.MeshLambertMaterial | null = null;
    for (const m of lambertCache.values()) {
      if (m.map) {
        src = m;
        break;
      }
    }
    const map = src?.map ? src.map.clone() : null;
    if (map) map.channel = 1;
    trimMaterial = new THREE.MeshLambertMaterial({ map });
  }
  return trimMaterial;
}

/**
 * A wall panel whose slab faces carry a material pattern while the trim keeps
 * the kit palette. `baseFrom` names the plain piece whose dominant color
 * defines "slab" (e.g. 'wall' for 'wall-door'). Falls back to the plain kit
 * piece if the colormap is unavailable.
 */
export function kitWallPieceMesh(name: string, baseFrom: string, pattern: PatternName, variant = 0): THREE.Object3D {
  let entry = classifiedCache.get(name);
  if (!entry) {
    const bases = pieceBaseColors(baseFrom);
    const data = getColormapData();
    if (!bases || !data) return kit(name);
    const { geometry } = kitGeometry(name);
    const slabTris: number[] = [];
    const trimTris: number[] = [];
    forEachTriangle(geometry, (_ax, _ay, _az, _bx, _by, _bz, _cx, _cy, _cz, u, v, t) => {
      const c = sampleColormap(data, u, v);
      // Tolerance stays tight per shade (the door-leaf wood is close in tone
      // to the timber wall); gradients are handled by matching ANY base shade.
      const close = bases.some((base) =>
        Math.abs(c[0] - base[0]) < 12 && Math.abs(c[1] - base[1]) < 12 && Math.abs(c[2] - base[2]) < 12);
      (close ? slabTris : trimTris).push(t);
    });
    // Rebuild the index: slab triangles first, trim after, as two draw groups.
    const index = geometry.index;
    const oldIndex: number[] = [];
    const triCount = (index ? index.count : geometry.attributes.position.count) / 3;
    for (let t = 0; t < triCount; t++) {
      for (let k = 0; k < 3; k++) oldIndex.push(index ? index.getX(t * 3 + k) : t * 3 + k);
    }
    const newIndex: number[] = [];
    for (const t of slabTris) newIndex.push(oldIndex[t * 3], oldIndex[t * 3 + 1], oldIndex[t * 3 + 2]);
    for (const t of trimTris) newIndex.push(oldIndex[t * 3], oldIndex[t * 3 + 1], oldIndex[t * 3 + 2]);
    // Palette UVs move to channel 1 for the trim; channel 0 gets box-projected
    // UVs for the pattern.
    geometry.setAttribute('uv1', geometry.attributes.uv.clone());
    boxProjectUVs(geometry);
    geometry.setIndex(newIndex);
    geometry.clearGroups();
    geometry.addGroup(0, slabTris.length * 3, 0);
    geometry.addGroup(slabTris.length * 3, trimTris.length * 3, 1);
    entry = { geometry, hasTrim: trimTris.length > 0 };
    classifiedCache.set(name, entry);
  }
  const mesh = new THREE.Mesh(entry.geometry, [patternMaterial(pattern, variant), getTrimMaterial()]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Piece with the kit texture multiplied by a color (e.g. brick walls). */
export function kitTinted(name: string, tint: number): THREE.Group {
  const g = kit(name);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      const src = mesh.material as THREE.MeshLambertMaterial;
      const key = `${src.uuid}:${tint}`;
      let mat = tintCache.get(key);
      if (!mat) {
        mat = src.clone();
        mat.color.multiply(new THREE.Color(tint));
        tintCache.set(key, mat);
      }
      mesh.material = mat;
    }
  });
  return g;
}

/**
 * First mesh of a piece with node transforms baked into the geometry —
 * for InstancedMesh use (roads).
 */
export function kitGeometry(name: string): { geometry: THREE.BufferGeometry; material: THREE.Material } {
  const proto = prototypes.get(name);
  if (!proto) throw new Error(`kit piece not loaded: ${name}`);
  proto.updateMatrixWorld(true);
  let found: { geometry: THREE.BufferGeometry; material: THREE.Material } | null = null;
  proto.traverse((o) => {
    if (found || !(o as THREE.Mesh).isMesh) return;
    const mesh = o as THREE.Mesh;
    const geom = mesh.geometry.clone();
    geom.applyMatrix4(mesh.matrixWorld);
    found = { geometry: geom, material: mesh.material as THREE.Material };
  });
  if (!found) throw new Error(`kit piece has no mesh: ${name}`);
  return found;
}

// ---------------------------------------------------------------------------
// Placement math for edge pieces (walls, fences): a piece's decorated face
// sits at local x=0.4 pointing -X. Rotating and offsetting per side puts the
// face flush with the footprint edge, solid part just inside it.
// ---------------------------------------------------------------------------

export type Side = 'N' | 'E' | 'S' | 'W';

/** rotation + face-flush offset (0.4 from tile center toward outside) */
const SIDE_PLACEMENT: Record<Side, { rot: number; ox: number; oz: number }> = {
  E: { rot: Math.PI, ox: 0.4, oz: 0 },
  W: { rot: 0, ox: -0.4, oz: 0 },
  S: { rot: Math.PI / 2, ox: 0, oz: 0.4 },
  N: { rot: -Math.PI / 2, ox: 0, oz: -0.4 },
};

/**
 * Place an edge piece (wall/fence panel) on tile `i` of the given side of a
 * w×d footprint centered at origin. `y` is the story base height.
 */
export function placeEdgePiece(piece: THREE.Object3D, side: Side, i: number, w: number, d: number, y = 0): THREE.Object3D {
  const p = SIDE_PLACEMENT[side];
  const along = side === 'E' || side === 'W' ? d : w;
  const u = -along / 2 + 0.5 + i;
  const edgeX = side === 'E' ? w / 2 : side === 'W' ? -w / 2 : u;
  const edgeZ = side === 'S' ? d / 2 : side === 'N' ? -d / 2 : u;
  piece.position.set(edgeX + p.ox, y, edgeZ + p.oz);
  piece.rotation.y = p.rot;
  return piece;
}

export interface KitHouseOptions {
  wood?: boolean;
  stories?: number;
  roofColor?: number;   // flat-color roof override (default: kit shingles)
  roofPattern?: PatternName; // textured roof (straw thatch, clay tiles); wins over roofColor
  highRoof?: boolean;
  pyramidRoof?: boolean; // roof-point piece scaled to the footprint (towers)
  wallPattern?: PatternName; // wall material override (default: wood/stone from `wood`)
  doorSide?: Side;      // default 'S'
  noDoor?: boolean;
  chimney?: boolean;
  variant?: number;     // per-building shade variant (see VARIANT_TINTS)
}

const DOOR_LEAF_MAT = new THREE.MeshLambertMaterial({ color: 0x54371f });
const DOOR_BRACE_MAT = new THREE.MeshLambertMaterial({ color: 0x6b4a2c });

/**
 * Explicit closed door leaf (owner rule): the kit's own leaf is wood-toned
 * like the walls and disappears against the patterns, so every doorway gets a
 * clearly darker door. Local space matches wall pieces: face at x=0.4.
 */
function doorLeaf(): THREE.Group {
  const g = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.5, 0.4), DOOR_LEAF_MAT);
  panel.position.set(0.425, 0.25, 0);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.055, 10, 1, false, 0, Math.PI), DOOR_LEAF_MAT);
  top.rotation.z = Math.PI / 2;
  top.position.set(0.425, 0.5, 0);
  for (const y of [0.16, 0.4]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.36), DOOR_BRACE_MAT);
    brace.position.set(0.395, y, 0);
    g.add(brace);
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), DOOR_BRACE_MAT);
  knob.position.set(0.39, 0.28, -0.13);
  g.add(panel, top, knob);
  return g;
}

/** Where a dwelling's chimney body stands, in kitHouse local coords. */
export const CHIMNEY_POS = { x: 0.35, z: -0.4 };

const GABLE_STONE = 0xa9a1bc; // matches kit plaster tone
const GABLE_WOOD = 0xb07a4e; // matches kit timber tone
const gableMats = new Map<number, THREE.MeshLambertMaterial>();

function gableMaterial(color: number): THREE.MeshLambertMaterial {
  let m = gableMats.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    gableMats.set(color, m);
  }
  return m;
}

/**
 * Gabled kit roof over a w×d footprint, base at height y0. Slope pieces are
 * one tile deep and get scaled across the short axis, so wider buildings get
 * proportionally taller roofs. Gable-end triangles are filled in wall tones.
 */
export function kitRoof(
  w: number,
  d: number,
  y0: number,
  opts: { color?: number; high?: boolean; wood?: boolean; pattern?: PatternName; gablePattern?: PatternName; variant?: number } = {},
): THREE.Group {
  const g = new THREE.Group();
  const v = opts.variant ?? 0;
  const ridgeAlongX = w > d;
  const across = ridgeAlongX ? d : w;
  const along = ridgeAlongX ? w : d;
  const s = across / 2;
  const name = opts.high ? 'roof-high' : 'roof';
  const make = (): THREE.Object3D =>
    opts.pattern ? kitPatternedMesh(name, opts.pattern, v)
    : opts.color !== undefined ? kitColored(name, applyVariant(opts.color, v))
    : kit(name);
  const inner = new THREE.Group();
  for (let i = 0; i < along; i++) {
    const u = -along / 2 + 0.5 + i;
    const left = make();
    left.position.set(-s / 2, 0, u);
    left.scale.set(s, s, 1);
    inner.add(left);
    const right = make();
    right.position.set(s / 2, 0, u);
    right.rotation.y = Math.PI;
    right.scale.set(s, s, 1);
    inner.add(right);
  }
  // Gable-end triangles (the kit slopes leave the ends open).
  const apexY = (opts.high ? 1.05 : 0.55) * s;
  const hw = across / 2 - 0.02;
  const zEnd = along / 2 - 0.02;
  const positions = [
    // front (+z), facing +Z
    -hw, 0, zEnd, hw, 0, zEnd, 0, apexY, zEnd,
    // back (-z), facing -Z
    hw, 0, -zEnd, -hw, 0, -zEnd, 0, apexY, -zEnd,
  ];
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const triUV: number[] = [];
  for (let i = 0; i < positions.length; i += 3) triUV.push(positions[i], positions[i + 1]);
  tri.setAttribute('uv', new THREE.Float32BufferAttribute(triUV, 2));
  tri.computeVertexNormals();
  const gable = new THREE.Mesh(
    tri,
    opts.gablePattern ? patternMaterial(opts.gablePattern, v) : gableMaterial(opts.wood ? GABLE_WOOD : GABLE_STONE),
  );
  gable.castShadow = true;
  inner.add(gable);
  if (ridgeAlongX) inner.rotation.y = Math.PI / 2;
  inner.position.y = y0;
  g.add(inner);
  return g;
}

/**
 * A complete kit building filling a w×d tile footprint, centered at origin:
 * wall panels around the perimeter (door, shuttered windows), stacked
 * stories, gabled roof.
 */
export function kitHouse(w: number, d: number, opts: KitHouseOptions = {}): THREE.Group {
  const g = new THREE.Group();
  const prefix = opts.wood ? 'wall-wood' : 'wall';
  const stories = opts.stories ?? 1;
  const doorSide: Side = opts.doorSide ?? 'S';
  const v = opts.variant ?? 0;
  // Owner rule: walls show their material — logs, stone, or brick — on both
  // the plain slabs and the slab part of door/window panels; trim (door
  // leaves, shutters, frames) keeps the kit look.
  const wallPattern: PatternName = opts.wallPattern ?? (opts.wood ? 'wood' : 'stone');
  const wallPiece = (kind: string): THREE.Object3D => {
    if (!kind) return kitPatternedMesh(prefix, wallPattern, v);
    const piece = kitWallPieceMesh(`${prefix}-${kind}`, prefix, wallPattern, v);
    if (kind !== 'door') return piece;
    // Doorways get an explicit closed door (owner rule).
    const withLeaf = new THREE.Group();
    withLeaf.add(piece, doorLeaf());
    return withLeaf;
  };
  const sides: Side[] = ['N', 'E', 'S', 'W'];
  for (let story = 0; story < stories; story++) {
    for (const side of sides) {
      const len = side === 'E' || side === 'W' ? d : w;
      for (let i = 0; i < len; i++) {
        let kind = '';
        if (story === 0) {
          if (side === doorSide && i === Math.floor((len - 1) / 2) && !opts.noDoor) kind = 'door';
          else if ((i + (side === 'N' || side === 'W' ? 1 : 0)) % 2 === 0) kind = 'window-shutters';
        } else {
          if (i % 2 === (side === 'N' || side === 'W' ? 1 : 0)) kind = 'window-small';
        }
        const piece = wallPiece(kind);
        // Hair's-breadth inset so panels meeting at corners never z-fight.
        piece.scale.z = 0.998;
        g.add(placeEdgePiece(piece, side, i, w, d, story));
      }
    }
  }
  if (opts.pyramidRoof) {
    const s = Math.max(w, d);
    const point = opts.roofColor !== undefined ? kitColored('roof-point', applyVariant(opts.roofColor, v)) : kit('roof-point');
    point.scale.set(s, s * 1.4, s);
    point.position.y = stories;
    g.add(point);
  } else {
    g.add(kitRoof(w, d, stories, {
      color: opts.roofColor,
      high: opts.highRoof,
      wood: opts.wood,
      pattern: opts.roofPattern,
      gablePattern: wallPattern,
      variant: v,
    }));
  }
  if (opts.chimney) {
    // Chimney matches the wall material; shortened, and re-centered — the kit
    // piece's body is offset ~0.32 from its origin, which is why smoke used
    // to miss it. Body center lands at CHIMNEY_POS, top at stories + 0.75.
    const ch = kitPatternedMesh('chimney', wallPattern === 'brick' ? 'brick' : 'stone', v);
    ch.scale.y = 0.75;
    ch.position.set(CHIMNEY_POS.x - 0.319, stories, CHIMNEY_POS.z);
    g.add(ch);
  }
  return g;
}

/** Fence run along one side of a w×d footprint. */
export function kitFenceSide(side: Side, w: number, d: number, opts: { gateAt?: number; skip?: (i: number) => boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const len = side === 'E' || side === 'W' ? d : w;
  for (let i = 0; i < len; i++) {
    if (opts.skip?.(i)) continue;
    const piece = kit(i === opts.gateAt ? 'fence-gate' : 'fence');
    g.add(placeEdgePiece(piece, side, i, w, d));
  }
  return g;
}

/** Fence around the whole footprint, with a gate in the middle of the south side. */
export function kitFencePerimeter(w: number, d: number, opts: { skip?: (side: Side, i: number) => boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const sides: Side[] = ['N', 'E', 'S', 'W'];
  for (const side of sides) {
    g.add(kitFenceSide(side, w, d, {
      gateAt: side === 'S' ? Math.floor((w - 1) / 2) : undefined,
      skip: opts.skip ? (i) => opts.skip!(side, i) : undefined,
    }));
  }
  return g;
}
