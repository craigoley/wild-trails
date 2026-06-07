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
import { evaluateCatch, type CatchEvent, type MissionEval } from '../../Missions';
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

/** Catch the remaining roster (rabbit + the alpine three) so the dex fills for the win.
 *  rabbit@night doubles as the second night-forager challenge. */
export function catchRemainingSpecies(j: Journal): void {
  applyCatch(j, ev('rabbit', 'meadow', 'night')); // research-rabbit-night + finds rabbit
  applyCatch(j, ev('ptarmigan', 'highlands', 'day'));
  applyCatch(j, ev('mountainhare', 'highlands', 'dusk'));
  applyCatch(j, ev('dotterel', 'highlands', 'day'));
}
