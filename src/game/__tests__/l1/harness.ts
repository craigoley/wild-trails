/**
 * L1 validation harness (Validation stack — L1). A THIN, PURE driver over the real
 * seeded sim: it adds NO game behavior — it just runs the existing createGameState +
 * update headlessly (no renderer, no DOM) and mirrors main's catch boundary so
 * progression can be driven from catch events. Enabled by the pure/seeded split (S2).
 *
 * Not a test file (no `.test`), so Vitest imports it but never runs it directly.
 */

import { createGameState, update, type GameState } from '../../GameState';
import { createIntent, type InputIntent } from '../../Input';
import { evaluateCatch, reconcileResearchUnlocks, type CatchEvent, type MissionEval } from '../../Missions';
import { startResearch, evaluateResearch } from '../../Research';
import { recordCatch, type Journal } from '../../../state/Journal';
import { SIM_DT } from '../../../utils/constants';

/** A per-frame input source: given the frame index + live state, return the intent
 *  fields to set this frame (the rest default to neutral). */
export type InputScript = (frame: number, game: GameState) => Partial<InputIntent>;

/**
 * Drive the REAL sim headlessly: seed -> `frames` fixed-timestep `update()` steps,
 * applying the scripted intent each frame. Same seed + same script -> identical state
 * (the determinism the guards rely on). Returns the final GameState.
 */
export function runFrames(seed: number, script: InputScript, frames: number): GameState {
  const game = createGameState(seed);
  for (let f = 0; f < frames; f++) {
    update(game, { ...createIntent(), ...script(f, game) }, SIM_DT);
  }
  return game;
}

/**
 * Mirror main's catch boundary (main.ts: recordCatch + evaluateCatch) so missions /
 * unlocks / the win can be driven headlessly from synthesized catch events. `nowMs` is
 * fixed (the pure layer never reads the clock). Returns the MissionEval (completions /
 * unlocks / hints).
 */
export function applyCatch(journal: Journal, ev: CatchEvent, nowMs = 0): MissionEval {
  recordCatch(journal, ev.species, nowMs);
  return evaluateCatch(journal, ev);
}

const ev = (species: string, biome: string, phase: string): CatchEvent =>
  ({ species, biome, phase }) as CatchEvent;

// --- Scenario helpers: the catch events that complete each biome's gating SET. ---
// (These are normal progression — they do NOT include the standalone night-forager
// research challenges, which is exactly what the auto-satisfaction guard checks.)

export function completeMeadowSet(j: Journal): void {
  for (let i = 0; i < 5; i++) applyCatch(j, ev('fieldmouse', 'meadow', 'day')); // survey ×5
  for (let i = 0; i < 2; i++) applyCatch(j, ev('quail', 'meadow', 'dawn')); // meadow-dawn ×2
  for (let i = 0; i < 2; i++) applyCatch(j, ev('hedgehog', 'meadow', 'dusk')); // meadow-dusk ×2
}

export function completeWoodlandSet(j: Journal): void {
  for (let i = 0; i < 4; i++) applyCatch(j, ev('redsquirrel', 'woodland', 'day')); // survey ×4
  applyCatch(j, ev('robin', 'woodland', 'dawn')); // woodland-dawn
  applyCatch(j, ev('roedeer', 'woodland', 'dusk')); // woodland-dusk
  applyCatch(j, ev('badger', 'woodland', 'night')); // track-badger
}

export function completeWetlandSet(j: Journal): void {
  for (let i = 0; i < 3; i++) applyCatch(j, ev('mallard', 'wetland', 'day')); // survey ×3 (+ wetland-day)
  applyCatch(j, ev('frog', 'wetland', 'dawn')); // wetland-dawn
}

/** The §4.1c gating research challenge: research-mouse-night (fieldmouse@night). */
export function completeNightForagerGate(j: Journal): MissionEval {
  return applyCatch(j, ev('fieldmouse', 'meadow', 'night'));
}

/**
 * R2 (§4.1.4): complete the Highlands-access research that WRAPS the §4.1c gate — start the
 * project (cost 0), do its wetland activity ×4, and reconcile. The Highlands unlocks only if
 * the §4.1c gate (the wetland set + research-mouse-night, by play) ALSO holds — so this is a
 * no-op until the mastery challenge is done (double-enforced knowledge-by-play). Mirrors
 * main's catch-boundary reconcile.
 */
export function completeHighlandsResearch(j: Journal): void {
  startResearch(j, 'unlock-the-highlands'); // cost 0 — no credit gate on core progression
  for (let i = 0; i < 4; i++) evaluateResearch(j, ev('frog', 'wetland', 'day')); // catch-in-wetland ×4
  reconcileResearchUnlocks(j);
}

/**
 * §4.2 — unlock the RIVERBANK (the first new biome, R2's gate generalized). Its access is a
 * research project gated on a NON-FORCED mastery challenge by play (research-rabbit-dawn — a
 * rabbit at DAWN; the rabbit is any-window so dawn is a deliberate choice) + the highlands
 * activity. cost 0 (win-required → anti-wall). Mirrors completeHighlandsResearch.
 */
export function completeRiverbankGate(j: Journal): void {
  applyCatch(j, ev('rabbit', 'meadow', 'dawn')); // research-rabbit-dawn (the non-forced mastery)
  startResearch(j, 'unlock-the-riverbank');
  for (let i = 0; i < 4; i++) evaluateResearch(j, ev('ptarmigan', 'highlands', 'day')); // catch-in-highlands ×4
  reconcileResearchUnlocks(j);
}

/**
 * §4.2 — unlock the COAST (the 2nd new biome, R2's gate again). Gated on a NON-FORCED mastery
 * challenge by play (research-mouse-dusk — a fieldmouse at DUSK; the mouse is any-window so dusk
 * is a deliberate choice) + the riverbank activity. cost 0 (win-required → anti-wall).
 */
export function completeCoastGate(j: Journal): void {
  applyCatch(j, ev('fieldmouse', 'meadow', 'dusk')); // research-mouse-dusk (the non-forced mastery)
  startResearch(j, 'unlock-the-coast');
  for (let i = 0; i < 4; i++) evaluateResearch(j, ev('reedbunting', 'riverbank', 'day')); // catch-in-riverbank ×4
  reconcileResearchUnlocks(j);
}

/** Catch the remaining roster (rabbit + the alpine three + the Riverbank four) so the dex
 *  fills for the win. rabbit@night doubles as the second night-forager challenge. */
export function catchRemainingSpecies(j: Journal): void {
  applyCatch(j, ev('rabbit', 'meadow', 'night')); // research-rabbit-night + finds rabbit
  applyCatch(j, ev('ptarmigan', 'highlands', 'day'));
  applyCatch(j, ev('mountainhare', 'highlands', 'dusk'));
  applyCatch(j, ev('dotterel', 'highlands', 'day'));
  // §4.2 — the Riverbank roster (caught once it's unlocked).
  applyCatch(j, ev('reedbunting', 'riverbank', 'day'));
  applyCatch(j, ev('watervole', 'riverbank', 'day'));
  applyCatch(j, ev('greywagtail', 'riverbank', 'day'));
  applyCatch(j, ev('dipper', 'riverbank', 'day'));
  // §4.1.5 — the fish-eaters. Caught here WITHOUT researching fish bait (applyCatch records a
  // catch; no bait deployed) — proving the win is reachable bait-less (fish bait is convenience).
  applyCatch(j, ev('kingfisher', 'riverbank', 'day'));
  applyCatch(j, ev('otter', 'riverbank', 'dusk'));
  // §4.2 — the Coast roster (caught once it's unlocked; the gull + seal bait-less too).
  applyCatch(j, ev('linnet', 'coast', 'day'));
  applyCatch(j, ev('brentgoose', 'coast', 'day'));
  applyCatch(j, ev('turnstone', 'coast', 'day'));
  applyCatch(j, ev('herringgull', 'coast', 'day'));
  applyCatch(j, ev('greyseal', 'coast', 'day'));
}
