/**
 * Economy currency (§12 slice 1a) — PURE earn/spend over the Journal (no three/DOM/
 * Math.random; Node-testable, like Missions.ts). Credits are SEPARATE from rank:
 * earning/spending here never touches `rankPoints`. The balance is never negative.
 *
 * Slice 1a is the currency PRIMITIVE only: earn (catches + research milestones),
 * a spend guard (nothing spends yet — the shop is 1b), and persistence (v5). No
 * shop, no premium bait, no catch-rate effect — credits buy lateral enrichment later.
 */

import { CREDITS, SPECIES, SPECIES_ORDER, type SpeciesId } from '../utils/constants';
import { isFound, type Journal } from '../state/Journal';

/** Add credits. A non-positive delta is a no-op; the balance only ever grows here. */
export function addCredits(journal: Journal, n: number): void {
  if (n <= 0) return;
  journal.credits += Math.floor(n);
}

/** Spend credits. Returns false and leaves the balance UNCHANGED when there isn't
 *  enough (or n <= 0) — the overspend guard. The balance is never negative. */
export function spendCredits(journal: Journal, n: number): boolean {
  const cost = Math.floor(n);
  if (cost <= 0 || journal.credits < cost) return false;
  journal.credits -= cost;
  return true;
}

export interface CatchCredits {
  total: number;
  newSpecies: boolean;
  biomeComplete: boolean;
}

/**
 * Credits a catch earns — computed from the PRE-catch journal (call before
 * recordCatch). +perCatch always (skill); +perNewSpecies on a first catch
 * (discovery); +perBiomeComplete when this catch fills the last gap in its biome's
 * journal (research milestone). Pure — reads the journal, never mutates it.
 */
export function creditsForCatch(journal: Journal, speciesId: SpeciesId): CatchCredits {
  const newSpecies = !isFound(journal, speciesId);
  const biome = SPECIES[speciesId].biome;
  // This catch completes the biome iff it's a NEW species and every OTHER species
  // native to that biome is already found (so it's the last gap).
  const biomeComplete =
    newSpecies &&
    SPECIES_ORDER.filter((id) => SPECIES[id].biome === biome).every(
      (id) => id === speciesId || isFound(journal, id),
    );
  const total =
    CREDITS.perCatch +
    (newSpecies ? CREDITS.perNewSpecies : 0) +
    (biomeComplete ? CREDITS.perBiomeComplete : 0);
  return { total, newSpecies, biomeComplete };
}
