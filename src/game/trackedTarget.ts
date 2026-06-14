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
 * for WHERE YOU ARE). When the current biome has none left, fall back to the NEAREST-TO-COMPLETE active
 * goal overall (the most progress toward its count) rather than the first in MISSION_ORDER — so the chip
 * points at the goal you're closest to finishing, not an arbitrary far-off one in another biome. Null
 * when nothing's left (all done).
 */
export function defaultTrackedMission(journal: Journal, biome: BiomeId): string | null {
  // ⚠️ A single pass — NO array allocation (this runs from the render loop via resolveTracked). Prefer
  // the current biome's first active goal; else the active goal nearest to complete (by progress ratio).
  let fallback: string | null = null;
  let bestRatio = -1;
  for (const id of MISSION_ORDER) {
    if (!isTrackable(id, journal)) continue;
    if (SPECIES[speciesForChallenge(MISSIONS[id].requirement)].biome === biome) return id; // the biome's goal
    // Fallback: track the nearest-to-complete (highest progress/count). Strict > keeps the
    // FIRST-in-order on a tie (a stable choice), and skips zero-count guards (count is ≥1).
    const count = MISSIONS[id].requirement.count;
    const ratio = count > 0 ? Math.min(journal.missions[id]?.progress ?? 0, count) / count : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      fallback = id;
    }
  }
  return fallback; // else the active goal nearest to complete (or null when all done)
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
