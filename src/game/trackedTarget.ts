/**
 * §HUD catch-target (ii) — the PLAY-SCREEN chip's tracked-target selection + the near-player scan. PURE,
 * Node-testable. ⚠️ DISPLAY-ONLY + session-only: the tracked override lives in memory at the boundary
 * (no schema bump, no persistence — re-computed each load); these are the pure resolvers it uses. No
 * `three` here — the chip render is src/rendering; this is the data half (reuses slice (i)'s targetFor).
 */

import { MISSIONS, MISSION_ORDER, SPECIES, type BiomeId, type SpeciesId } from '../utils/constants';
import type { Journal } from '../state/Journal';
import type { Animal } from './Animal';
import { speciesForChallenge } from './catchTarget';

/** Is a mission a live, trackable goal — incomplete AND a progression (non-standalone) mission? */
function isTrackable(id: string, journal: Journal): boolean {
  return !journal.missions[id]?.completed && !MISSIONS[id]?.standalone;
}

/**
 * The DEFAULT tracked mission (no override): the current biome's first active progression goal (the goal
 * for WHERE YOU ARE), falling back to the first active goal overall. Null when nothing's left (all done).
 */
export function defaultTrackedMission(journal: Journal, biome: BiomeId): string | null {
  // ⚠️ A single pass — NO array allocation (this runs from the render loop via resolveTracked). Prefer
  // the current biome's first active goal; else the first active goal overall.
  let first: string | null = null;
  for (const id of MISSION_ORDER) {
    if (!isTrackable(id, journal)) continue;
    if (first === null) first = id;
    if (SPECIES[speciesForChallenge(MISSIONS[id].requirement)].biome === biome) return id; // the biome's goal
  }
  return first; // else the first active goal (or null when all done)
}

/**
 * The mission the chip tracks: the session OVERRIDE (a tap-to-track choice) while it's still active, else
 * the auto default. Pure — the override is held in memory by the boundary (no schema bump).
 */
export function resolveTracked(override: string | null, journal: Journal, biome: BiomeId): string | null {
  if (override && MISSIONS[override] && !journal.missions[override]?.completed) return override;
  return defaultTrackedMission(journal, biome);
}

/**
 * ⚠️ Is an active instance of `species` within `radius` of (px, py)? A simple distance scan over the
 * BOUNDED animal pool — NO allocation (scalars only, squared distance, no sqrt). Drives the chip's
 * gentle near-player pulse ("oh, there it is"). Reads the pool; never mutates.
 */
export function isTargetNear(animals: readonly Animal[], species: SpeciesId, px: number, py: number, radius: number): boolean {
  const r2 = radius * radius;
  for (const a of animals) {
    if (!a.active || a.species !== species) continue;
    const dx = a.x - px;
    const dy = a.y - py;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}
