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

/**
 * §4.2 — unlock the MOOR (the 1st BRANCHED biome: the Highlands set forks to BOTH the Riverbank
 * AND the Moor). Gated on a NON-FORCED MULTI-CONDITION mastery challenge by play
 * (research-ptarmigan-greens — a ptarmigan over GREENS bait, its real diet; bait is never forced,
 * so this is a deliberate field-craft choice) + the highlands activity. The shared source gate
 * (research-rabbit-dawn) is already met by completeRiverbankGate. cost 0 (win-required → anti-wall).
 */
export function completeMoorGate(j: Journal): void {
  // The multi-condition challenge: ptarmigan + GREENS bait (its diet) — non-forced, in the prereq.
  applyCatch(j, { species: 'ptarmigan', biome: 'highlands', phase: 'day', bait: 'greens' } as CatchEvent);
  startResearch(j, 'unlock-the-moor');
  for (let i = 0; i < 4; i++) evaluateResearch(j, ev('ptarmigan', 'highlands', 'day')); // catch-in-highlands ×4
  reconcileResearchUnlocks(j);
}

/**
 * §4.2 — unlock the PINE FOREST (the 1st CLOSED biome: the Woodland set forks to BOTH the Wetland
 * AND the Pine Forest). Gated on a NON-FORCED MULTI-CONDITION mastery challenge by play
 * (research-squirrel-seeds — a red squirrel over SEED bait, its real diet) + the woodland activity.
 * The Woodland source set is already complete. cost 0 (win-required → anti-wall).
 */
export function completePineforestGate(j: Journal): void {
  applyCatch(j, { species: 'redsquirrel', biome: 'woodland', phase: 'day', bait: 'seeds' } as CatchEvent);
  startResearch(j, 'unlock-the-pineforest');
  for (let i = 0; i < 4; i++) evaluateResearch(j, ev('redsquirrel', 'woodland', 'day')); // catch-in-woodland ×4
  reconcileResearchUnlocks(j);
}

/**
 * §4.2 — unlock the CAVE (the always-dark biome: the Riverbank set forks to BOTH the Coast AND the
 * Cave). Gated on a NON-FORCED SPECIES+BAIT mastery challenge by play (research-dipper-insects — a
 * dipper over INSECT bait, its real diet; NO phase) + the riverbank activity. cost 0 (anti-wall).
 */
export function completeCaveGate(j: Journal): void {
  applyCatch(j, { species: 'dipper', biome: 'riverbank', phase: 'day', bait: 'insects' } as CatchEvent);
  startResearch(j, 'unlock-the-cave');
  for (let i = 0; i < 4; i++) evaluateResearch(j, ev('reedbunting', 'riverbank', 'day')); // catch-in-riverbank ×4
  reconcileResearchUnlocks(j);
}

/**
 * §4.2 — unlock the TIDAL/SALTMARSH (the 5th-diet biome: the Coast's first arm, a single-successor
 * extension off the previously-terminal shore). Gated on a NON-FORCED SPECIES+BAIT mastery challenge
 * by play (research-turnstone-insects — a turnstone over INSECT bait, its real diet; NO phase) + the
 * coast activity. cost 0 (anti-wall).
 */
export function completeTidalGate(j: Journal): void {
  applyCatch(j, { species: 'turnstone', biome: 'coast', phase: 'day', bait: 'insects' } as CatchEvent);
  startResearch(j, 'unlock-the-tidal');
  for (let i = 0; i < 4; i++) evaluateResearch(j, ev('linnet', 'coast', 'day')); // catch-in-coast ×4
  reconcileResearchUnlocks(j);
}

/**
 * §4.2 — unlock the ALPINE/MONTANE SUMMIT (the difficulty-ceiling biome: the Moor's first arm, a
 * single-successor extension off the previously-terminal heather). Gated on a NON-FORCED SPECIES+BAIT
 * mastery challenge by play (research-grouse-greens — a red grouse over GREENS bait, its real diet; NO
 * phase) + the moor activity. cost 0 (anti-wall). The climb reads Highlands → Moor → Alpine summit.
 */
export function completeAlpineGate(j: Journal): void {
  applyCatch(j, { species: 'redgrouse', biome: 'moor', phase: 'day', bait: 'greens' } as CatchEvent);
  startResearch(j, 'unlock-the-alpine');
  for (let i = 0; i < 4; i++) evaluateResearch(j, ev('twite', 'moor', 'day')); // catch-in-moor ×4
  reconcileResearchUnlocks(j);
}

/**
 * §migration — unlock the ESTUARY migration hub (the open mudflats: the Tidal's first arm, a single-
 * successor extension off the previously-terminal saltmarsh; tier 7). Gated on a NON-FORCED SPECIES+BAIT
 * mastery challenge by play (research-knot-shellfish — a knot over SHELLFISH bait, its real diet; NO
 * phase) + the tidal activity. cost 0 (anti-wall). The route reads Coast → Tidal → open Estuary.
 */
export function completeEstuaryGate(j: Journal): void {
  applyCatch(j, { species: 'knot', biome: 'tidal', phase: 'day', bait: 'shellfish' } as CatchEvent);
  startResearch(j, 'unlock-the-estuary');
  for (let i = 0; i < 4; i++) evaluateResearch(j, ev('dunlin', 'tidal', 'day')); // catch-in-tidal ×4
  reconcileResearchUnlocks(j);
}

/** Catch the remaining roster (rabbit + the alpine three + the Riverbank four + the Coast five +
 *  the Moor five) so the dex fills for the win. rabbit@night doubles as the second night-forager
 *  challenge. */
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
  // §4.2 — the Moor roster (caught once it's unlocked; the twite is the bait-less valve).
  applyCatch(j, ev('twite', 'moor', 'day'));
  applyCatch(j, ev('stonechat', 'moor', 'day'));
  applyCatch(j, ev('redgrouse', 'moor', 'day'));
  applyCatch(j, ev('curlew', 'moor', 'day'));
  applyCatch(j, ev('reddeer', 'moor', 'day'));
  // §4.2 — the Pine Forest roster (caught once it's unlocked; the crossbill is the bait-less valve).
  applyCatch(j, ev('crossbill', 'pineforest', 'day'));
  applyCatch(j, ev('coaltit', 'pineforest', 'day'));
  applyCatch(j, ev('crestedtit', 'pineforest', 'day'));
  applyCatch(j, ev('capercaillie', 'pineforest', 'day'));
  applyCatch(j, ev('pinemarten', 'pineforest', 'day'));
  // §4.2 — the Cave roster (always-dark 'any'-window species; the pipistrelle is the bait-less valve).
  applyCatch(j, ev('pipistrelle', 'cave', 'day'));
  applyCatch(j, ev('daubentonbat', 'cave', 'day'));
  applyCatch(j, ev('longearedbat', 'cave', 'day'));
  applyCatch(j, ev('horseshoebat', 'cave', 'day'));
  applyCatch(j, ev('eel', 'cave', 'day'));
  // §4.2 — the Tidal/Saltmarsh roster (the dunlin is the bait-less valve; oystercatcher + knot bait-less too).
  applyCatch(j, ev('dunlin', 'tidal', 'day'));
  applyCatch(j, ev('oystercatcher', 'tidal', 'day'));
  applyCatch(j, ev('redshank', 'tidal', 'day'));
  applyCatch(j, ev('avocet', 'tidal', 'day'));
  applyCatch(j, ev('knot', 'tidal', 'day'));
  // §4.2 — the Alpine/Montane roster (the tame snow bunting is the bait-less valve; the ring ouzel apex
  // is hard-not-impossible — caught here proves the win-path extends through the difficulty ceiling).
  applyCatch(j, ev('snowbunting', 'alpine', 'day'));
  applyCatch(j, ev('meadowpipit', 'alpine', 'day'));
  applyCatch(j, ev('wheatear', 'alpine', 'day'));
  applyCatch(j, ev('goldenplover', 'alpine', 'day'));
  applyCatch(j, ev('ringouzel', 'alpine', 'day'));
  // §hedgerow — the CONNECTOR chain roster. The 4 hedgerow catches also complete hedgerow-survey
  // (catch-in-biome ×4); the whitethroat completes hedgerow-edge; the dormouse completes copse-dormouse —
  // so the new gating sets close (the win requires them) and the dex fills.
  applyCatch(j, ev('bankvole', 'hedgerow', 'day')); // the bait-less valve
  applyCatch(j, ev('harvestmouse', 'hedgerow', 'day'));
  applyCatch(j, ev('yellowhammer', 'hedgerow', 'day'));
  applyCatch(j, ev('whitethroat', 'hedgerow', 'day')); // 4th hedgerow catch → survey; + hedgerow-edge
  applyCatch(j, ev('dormouse', 'copse', 'night')); // copse-dormouse + finds the dormouse
  applyCatch(j, ev('blackcap', 'copse', 'day'));
  // §migration — the ESTUARY hub roster. The 4 estuary catches complete estuary-survey (catch-in-biome ×4);
  // the bar-tailed godwit completes estuary-flyway (both standalone — the estuary is terminal). Fills the dex.
  applyCatch(j, ev('bartailedgodwit', 'estuary', 'day')); // + estuary-flyway (the migration-named beat)
  applyCatch(j, ev('greyplover', 'estuary', 'day'));
  applyCatch(j, ev('wigeon', 'estuary', 'day'));
  applyCatch(j, ev('pintail', 'estuary', 'day')); // 4th estuary catch → estuary-survey
  applyCatch(j, ev('sanderling', 'estuary', 'day'));
  applyCatch(j, ev('shelduck', 'estuary', 'day')); // the resident valve
  applyCatch(j, ev('ringedplover', 'estuary', 'day'));
}
