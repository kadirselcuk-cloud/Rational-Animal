import * as THREE from 'three';

/**
 * Free RTS orbit camera.
 *
 * The camera orbits a target point on the ground plane (y = 0):
 *  - Pan: WASD / arrow keys or middle-mouse drag — camera-relative (owner
 *    rule: W is always toward the top of the screen, however the view is
 *    currently rotated).
 *  - Rotate: Q rotates left, E rotates right (owner rule), or right-mouse
 *    drag (yaw + clamped pitch).
 *  - Zoom: mouse wheel (exponential).
 *
 * Movement is smoothed toward goal values each frame so controls feel weighty
 * without input lag. Simulation speed does not affect the camera.
 */

const PITCH_MIN = THREE.MathUtils.degToRad(25);
const PITCH_MAX = THREE.MathUtils.degToRad(70);
const DIST_MIN = 12;
const DIST_MAX = 700;
const PAN_SPEED = 0.9; // world units per second per unit of distance
const KEY_ROTATE_SPEED = 1.8; // radians per second
const SMOOTHING = 12; // higher = snappier

export class RtsCameraController {
  private target = new THREE.Vector3(0, 0, 0);
  private goalTarget = new THREE.Vector3(0, 0, 0);
  private yaw = 0;
  private goalYaw = 0;
  private pitch = THREE.MathUtils.degToRad(50);
  private goalPitch = THREE.MathUtils.degToRad(50);
  private distance = 90;
  private goalDistance = 90;
  private bounds: { minX: number; minZ: number; maxX: number; maxZ: number } | null = null;

  private keys = new Set<string>();
  private dragButton: number | null = null;
  private lastPointer = { x: 0, y: 0 };
  private disposers: (() => void)[] = [];

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
  ) {
    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement | Window,
      type: K | string,
      fn: (e: never) => void,
      opts?: AddEventListenerOptions,
    ) => {
      el.addEventListener(type as string, fn as EventListener, opts);
      this.disposers.push(() => el.removeEventListener(type as string, fn as EventListener));
    };

    on(window, 'keydown', (e: KeyboardEvent) => {
      // Don't steal keys while the user types in a UI field (e.g. seed input).
      if ((e.target as HTMLElement | null)?.tagName !== 'INPUT') this.keys.add(e.code);
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());

    on(domElement, 'contextmenu', (e: MouseEvent) => e.preventDefault());
    on(domElement, 'pointerdown', (e: PointerEvent) => {
      if (e.button === 1 || e.button === 2) {
        this.dragButton = e.button;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        domElement.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    });
    on(domElement, 'pointerup', (e: PointerEvent) => {
      if (e.button === this.dragButton) this.dragButton = null;
    });
    on(domElement, 'pointermove', (e: PointerEvent) => {
      if (this.dragButton === null) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };

      if (this.dragButton === 2) {
        this.goalYaw -= dx * 0.005;
        this.goalPitch = THREE.MathUtils.clamp(this.goalPitch + dy * 0.004, PITCH_MIN, PITCH_MAX);
      } else if (this.dragButton === 1) {
        const panScale = (this.distance / window.innerHeight) * 1.4;
        this.panCameraRelative(-dx * panScale, -dy * panScale);
      }
    });
    on(
      domElement,
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const factor = Math.exp(e.deltaY * 0.0012);
        this.goalDistance = THREE.MathUtils.clamp(this.goalDistance * factor, DIST_MIN, DIST_MAX);
      },
      { passive: false },
    );

    this.snapToGoals();
    this.apply();
  }

  /** Current ground point the camera is looking at. */
  getTargetXZ(): { x: number; z: number } {
    return { x: this.target.x, z: this.target.z };
  }

  /** Instantly center the view on a ground position. */
  centerOn(x: number, z: number): void {
    this.goalTarget.set(x, 0, z);
    this.target.copy(this.goalTarget);
    this.apply();
  }

  /** Keep the camera target inside the map. */
  setPanBounds(minX: number, minZ: number, maxX: number, maxZ: number): void {
    this.bounds = { minX, minZ, maxX, maxZ };
  }

  setDistance(d: number): void {
    this.goalDistance = THREE.MathUtils.clamp(d, DIST_MIN, DIST_MAX);
    this.distance = this.goalDistance;
    this.apply();
  }

  /**
   * Pan in camera-relative ground directions (rotates with the view).
   * `right` > 0 moves toward screen-right, `forward` > 0 toward screen-bottom.
   */
  private panCameraRelative(right: number, forward: number): void {
    const sin = Math.sin(this.goalYaw);
    const cos = Math.cos(this.goalYaw);
    this.goalTarget.x += right * cos + forward * sin;
    this.goalTarget.z += -right * sin + forward * cos;
    this.clampTarget();
  }

  private clampTarget(): void {
    if (!this.bounds) return;
    this.goalTarget.x = THREE.MathUtils.clamp(this.goalTarget.x, this.bounds.minX, this.bounds.maxX);
    this.goalTarget.z = THREE.MathUtils.clamp(this.goalTarget.z, this.bounds.minZ, this.bounds.maxZ);
  }

  update(dt: number): void {
    // Keyboard pan: relative to the current camera direction (owner rule) —
    // W is always "screen up", A "screen left", however the view is rotated.
    const panStep = PAN_SPEED * this.distance * dt;
    let panX = 0;
    let panZ = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) panZ -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) panZ += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) panX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) panX += 1;
    if (panX !== 0 || panZ !== 0) {
      const inv = panStep / Math.hypot(panX, panZ);
      this.panCameraRelative(panX * inv, panZ * inv);
    }
    // Q rotates left, E rotates right (owner rule, session 5).
    if (this.keys.has('KeyQ')) this.goalYaw += KEY_ROTATE_SPEED * dt;
    if (this.keys.has('KeyE')) this.goalYaw -= KEY_ROTATE_SPEED * dt;

    const t = 1 - Math.exp(-SMOOTHING * dt);
    this.target.lerp(this.goalTarget, t);
    this.yaw += (this.goalYaw - this.yaw) * t;
    this.pitch += (this.goalPitch - this.pitch) * t;
    this.distance += (this.goalDistance - this.distance) * t;

    this.apply();
  }

  private snapToGoals(): void {
    this.target.copy(this.goalTarget);
    this.yaw = this.goalYaw;
    this.pitch = this.goalPitch;
    this.distance = this.goalDistance;
  }

  private apply(): void {
    const horiz = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horiz,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horiz,
    );
    this.camera.lookAt(this.target);
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }
}
