/**
 * Owns the three.js scene, the OrthographicCamera, and the WebGL renderer. The
 * camera views its focus from a classic ISOMETRIC offset (equal offsetX/offsetZ
 * for a 45° yaw, +offsetY for the downward pitch) — so it looks down the body
 * diagonal: the ground renders as a 45° DIAMOND and boxes show three faces (top
 * + two sides), i.e. true 3D height, not flat top-down. PORTED from the
 * rogue-descent setup — do not reinvent the angle.
 *
 * The focus smoothly FOLLOWS the player: each frame it eases toward the player's
 * interpolated position at TUNING.camLerp, but only once the player leaves a
 * dead-zone (so the marker has its own on-screen motion). This layer only READS
 * game state; world coordinates map to three.js as (game x -> three x, game y ->
 * three z).
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { GameState } from '../game/GameState';
import { CAMERA, KEY_LIGHT_POS, PALETTE, TUNING } from '../utils/constants';
import { deadZoneFollow, lerp, type Vec2 } from '../utils/math';

export class SceneManager {
  readonly scene = new Scene();
  readonly camera: OrthographicCamera;
  private readonly renderer: WebGLRenderer;
  private readonly container: HTMLElement;
  private readonly target = new Vector3(0, 0, 0);
  /** Camera focus point on the ground plane (game x, game y). */
  private focusX = 0;
  private focusY = 0;
  /** Reused scratch for the dead-zone follow result (no per-frame allocation). */
  private readonly _focusOut: Vec2 = { x: 0, y: 0 };

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene.background = new Color(PALETTE.background);

    const { offsetX, offsetY, offsetZ, near, far } = CAMERA;
    this.camera = new OrthographicCamera(-1, 1, 1, -1, near, far);
    this.camera.position.set(offsetX, offsetY, offsetZ);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Slightly directional lighting so the marker's top reads against the
    // ground. Lit from above and to one side so iso boxes cast readable shading.
    this.scene.add(new AmbientLight(0xffffff, 0.85));
    const key = new DirectionalLight(0xffffff, 0.6);
    key.position.set(KEY_LIGHT_POS.x, KEY_LIGHT_POS.y, KEY_LIGHT_POS.z);
    this.scene.add(key);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  /** Jump the focus to a world position with no easing (use at init so the
   *  first frame isn't a slide-in from the origin). */
  snapFocus(worldX: number, worldY: number): void {
    this.focusX = worldX;
    this.focusY = worldY;
    this.place();
  }

  /** Ease the focus toward the player's interpolated position, but only once the
   *  player leaves the dead-zone — within it the focus holds still so the marker
   *  drifts on screen. `dt` is the real frame delta (camera smoothing is a
   *  render-side effect, not a sim step). */
  updateFollow(state: GameState, alpha: number, dt: number): void {
    const p = state.player;
    const px = lerp(p.prevX, p.x, alpha);
    const py = lerp(p.prevY, p.y, alpha);
    const k = 1 - Math.exp(-TUNING.camLerp * dt);
    const f = deadZoneFollow(this.focusX, this.focusY, px, py, TUNING.deadZone, k, this._focusOut);
    this.focusX = f.x;
    this.focusY = f.y;
    this.place();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Reposition the camera so it views the current focus from the iso offset
   *  (equal x/z for the 45° yaw, +y above for the downward pitch). */
  private place(): void {
    const { offsetX, offsetY, offsetZ } = CAMERA;
    this.target.set(this.focusX, 0, this.focusY);
    this.camera.position.set(this.focusX + offsetX, offsetY, this.focusY + offsetZ);
    this.camera.lookAt(this.target);
  }

  private resize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / h;
    const v = CAMERA.viewSize;
    // Shift the frustum window up by frameBiasY*v so the focus (player) renders
    // BELOW screen centre — a pure vertical pan of the orthographic image. The
    // view direction / up vector are untouched, so the iso ANGLE is preserved.
    const bias = CAMERA.frameBiasY * v;
    this.camera.left = -v * aspect;
    this.camera.right = v * aspect;
    this.camera.top = v + bias;
    this.camera.bottom = -v + bias;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
