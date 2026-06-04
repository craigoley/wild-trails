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
 * The world now has CREATURES you can CATCH: approach an animal, press catch, and
 * watch the multi-shake resolution play out. The shake animation + audio are
 * driven by the DATA that GameState resolved (Catch.resolveCatch) — feel reflects
 * the real odds, never faked over them. The spawn -> roam -> catch pipeline
 * carries `?debug=1` funnel telemetry.
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
// Catch-audio bookkeeping: blip once per shake beat as it begins, and fire the
// settle/break tone on resolution — all read from the resolved encounter DATA.
let prevEncounterActive = false;
let prevShakeIndex = 0;

function frame(nowMs: number): void {
  let dt = (nowMs - lastMs) / 1000;
  lastMs = nowMs;
  dt = Math.min(dt, MAX_FRAME_DT);

  // Step the sim in fixed slices; the remainder interpolates the render.
  accumulator += dt;
  while (accumulator >= SIM_DT) {
    update(game, controls.intent, SIM_DT);
    accumulator -= SIM_DT;

    // Audio cues from this sim step (checked per-step so none are missed when a
    // frame runs several steps).
    const enc = game.encounter;
    if (enc) {
      if (!prevEncounterActive) {
        audio.shakeBlip(0, enc.shakes[0].passed); // first shake begins
      } else if (
        enc.phase === 'shaking' &&
        enc.shakeIndex > prevShakeIndex &&
        enc.shakeIndex < enc.shakes.length
      ) {
        audio.shakeBlip(enc.shakeIndex, enc.shakes[enc.shakeIndex].passed);
      }
      prevShakeIndex = enc.shakeIndex;
      prevEncounterActive = true;
    } else {
      prevEncounterActive = false;
      prevShakeIndex = 0;
    }
    if (game.lastOutcome === 'caught') audio.catchTone();
    else if (game.lastOutcome === 'escaped') audio.escapeTone();
    if (game.baitJustDeployed) {
      audio.baitBlip();
      controls.pulseBait();
    }
    if (game.baitDeployFailed) audio.denyBlip();
  }
  const alpha = accumulator / SIM_DT;

  // Reflect the catch target on the UI: arm the CATCH button + show the live
  // chance, and surface the first-time "try bait" hint.
  controls.setCatchState(game.catchArmed, game.targetChance);
  controls.setBaitHint(game.catchArmed && !game.targetBaited && !game.usedBaitEver);

  // Render the interpolated state. Renderers read prev+current; never mutate.
  entities.sync(game, alpha);
  scene.updateFollow(game, alpha, dt);
  scene.render();
  hud.update(game);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
