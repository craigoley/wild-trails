/**
 * Entry point + the fixed-timestep game loop with render interpolation.
 *
 *   gather input -> step sim in fixed SIM_DT slices -> render(interpolated)
 *
 * Real frame time is accumulated and the sim is advanced in whole SIM_DT steps;
 * the leftover remainder becomes `alpha` (0..1), and the renderers lerp each
 * entity between its previous and current sim-step position by that alpha. So
 * the simulation stays deterministic and frame-rate independent while motion
 * looks smooth at 60 or 120 Hz. The player moves because GameState.update
 * mutates state — never because input is wired straight into this loop.
 *
 * The world now has CREATURES in it: animals spawn by biome + time of day and
 * roam (wander / flee) around the player. The spawn -> roam pipeline carries
 * `?debug=1` funnel telemetry. Catching (encounter -> catch-attempt -> resolve)
 * lands in later phased PRs.
 */

import './style.css';
import { createGameState, update } from './game/GameState';
import { Controls } from './input/Controls';
import { SceneManager } from './rendering/SceneManager';
import { WorldRenderer } from './rendering/WorldRenderer';
import { EntityRenderer } from './rendering/EntityRenderer';
import { HUD, isDebugEnabled } from './rendering/HUD';
import { AudioEngine } from './audio/AudioEngine';
import { loadJournal } from './state/Journal';
import { MAX_FRAME_DT, SIM_DT } from './utils/constants';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app container not found');

// --- State (pure) ---------------------------------------------------------
// A fresh per-load seed keeps the sim deterministic-from-seed while still
// varying run to run. Reading the clock here (the impure entry point) keeps the
// game layer itself pure.
const bootSeed = (Date.now() & 0xffffffff) >>> 0;
const game = createGameState(bootSeed);
// The persistent Field Journal — loaded once at boot (safe no-op in private mode).
// Phase 0 just proves the load path; the catch loop reads/writes it later.
const journal = loadJournal();
if (isDebugEnabled()) {
  const species = Object.keys(journal.species).length;
  console.info(`[journal] v${journal.version} loaded, ${species} species recorded`);
}

// --- Adapters & rendering (impure; read state) ----------------------------
const controls = new Controls(app);
const scene = new SceneManager(app);
new WorldRenderer(scene.scene, game.world);
const entities = new EntityRenderer(scene.scene);
const hud = new HUD(app);

// Frame the camera on the player's spawn — no slide-in on frame 1.
scene.snapFocus(game.player.x, game.player.y);

// Audio context is created now but only resumed after a user gesture (autoplay).
const audio = new AudioEngine();
audio.init();
const unlockAudio = (): void => {
  void audio.resume();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// --- Loop -----------------------------------------------------------------
let lastMs = performance.now();
let accumulator = 0;

function frame(nowMs: number): void {
  let dt = (nowMs - lastMs) / 1000;
  lastMs = nowMs;
  dt = Math.min(dt, MAX_FRAME_DT);

  // Step the sim in fixed slices; the remainder interpolates the render.
  accumulator += dt;
  while (accumulator >= SIM_DT) {
    update(game, controls.intent, SIM_DT);
    accumulator -= SIM_DT;
  }
  const alpha = accumulator / SIM_DT;

  // Render the interpolated state. Renderers read prev+current; never mutate.
  entities.sync(game, alpha);
  scene.updateFollow(game, alpha, dt);
  scene.render();
  hud.update(game);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
