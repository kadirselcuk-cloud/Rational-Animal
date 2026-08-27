import * as THREE from 'three';
import type { Calendar, Season } from '../sim/calendar';
import { MAP_SIZE } from '../world/terrain';

/**
 * Day & night cycle (owner rules, session 39): ONE day and ONE night per
 * season. The light share depends on the season — summer 10 of 15 days,
 * spring 9, autumn 8, winter 7 — so summers are long and bright and winters
 * long and dark. The sun (then the moon) rises in the east, arcs over the
 * map, and sets in the west; sky, fog, and light color follow.
 */

const LIGHT_SHARE: Record<Season, number> = {
  summer: 10 / 15,
  spring: 9 / 15,
  autumn: 8 / 15,
  winter: 7 / 15,
};

const SKY_DAY = new THREE.Color(0x9db4c0);
const SKY_DAWN = new THREE.Color(0xcf9868);
const SKY_NIGHT = new THREE.Color(0x10151f);
const SUN_WARM = new THREE.Color(0xffd9a8); // near the horizon
const SUN_NOON = new THREE.Color(0xfff2dd);
const MOON_COL = 0xaebfdd;

export class DayNight {
  private readonly moon: THREE.DirectionalLight;
  private readonly sunDisc: THREE.Mesh;
  private readonly moonDisc: THREE.Mesh;
  private readonly sky = new THREE.Color();
  /** Night state for other systems (window lights, torches): t runs 0..1
   *  across the night, so t > 0.5 is "late night". */
  readonly night = { active: false, t: 0 };

  constructor(
    private readonly scene: THREE.Scene,
    private readonly sun: THREE.DirectionalLight,
    private readonly hemi: THREE.HemisphereLight,
  ) {
    this.moon = new THREE.DirectionalLight(MOON_COL, 0);
    this.moon.target.position.set(MAP_SIZE / 2, 0, MAP_SIZE / 2);
    scene.add(this.moon, this.moon.target);
    // Visible discs so the player watches them climb and sink.
    this.sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(26, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
    );
    this.moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(19, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe8eef8, fog: false }),
    );
    scene.add(this.sunDisc, this.moonDisc);
  }

  update(calendar: Calendar): void {
    const share = LIGHT_SHARE[calendar.season];
    const p = calendar.seasonProgress;
    const isDay = p < share;
    const t = isDay ? p / share : (p - share) / (1 - share);
    this.night.active = !isDay;
    this.night.t = isDay ? 0 : t;
    const arc = Math.sin(Math.PI * t); // 0 at the horizons, 1 at the zenith
    const az = Math.PI * (1 - t); // east → west sweep
    const c = MAP_SIZE / 2;
    const R = 1000;
    const bx = c + Math.cos(az) * R;
    const by = 90 + arc * 640;
    const bz = c + 180 + Math.sin(az) * R * 0.35; // shallow southern arc

    if (isDay) {
      this.sun.position.set(bx, by, bz);
      this.sun.intensity = 1.6 * Math.min(1, arc * 3);
      (this.sun.color as THREE.Color).copy(SUN_WARM).lerp(SUN_NOON, Math.min(1, arc * 1.8));
      this.moon.intensity = 0;
      this.hemi.intensity = 0.28 + 0.62 * Math.min(1, arc * 2.2);
      this.sky.copy(SKY_DAWN).lerp(SKY_DAY, Math.min(1, arc * 2));
      this.sunDisc.position.set(bx, by, bz);
      this.sunDisc.visible = arc > 0.01;
      this.moonDisc.visible = false;
    } else {
      this.moon.position.set(bx, by, bz);
      this.moon.intensity = 0.3 * Math.min(1, arc * 3);
      this.sun.intensity = 0;
      this.hemi.intensity = 0.22;
      // Night edges glow with the leftover dawn/dusk, matching the day edge.
      const glow = Math.max(0, 1 - arc * 4);
      this.sky.copy(SKY_NIGHT).lerp(SKY_DAWN, glow);
      this.moonDisc.position.set(bx, by, bz);
      this.moonDisc.visible = arc > 0.01;
      this.sunDisc.visible = false;
    }

    (this.scene.background as THREE.Color).copy(this.sky);
    if (this.scene.fog) this.scene.fog.color.copy(this.sky);
  }
}
