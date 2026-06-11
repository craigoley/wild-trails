/**
 * The through-line (§4.3 TL1) — the biome "thriving" derivation. PURE + DISPLAY-ONLY: a fold over
 * `journal.species` (caught) + `SPECIES[].biome`, with a GUARDED research bonus. It reads existing
 * state and returns a 0..1 per biome — there is NO new persisted field (derived at render/display).
 *
 * ⚠️ This module is read ONLY by the renderer (the warmth grade) and the journal panel (the soft
 * word). It is NEVER imported by the sim (`GameState`/`Catch`/`Missions`/spawn) — thriving is
 * COSMETIC and cannot touch gameplay (structurally: `finalCatchChance` takes no thriving). No
 * `three`, Node-testable.
 */

import {
  BIOME_ORDER,
  RESEARCH_ORDER,
  RESEARCH_PROJECTS,
  SPECIES,
  SPECIES_ORDER,
  THRIVING,
  type BiomeId,
} from '../utils/constants';
import type { Journal } from '../state/Journal';

/** The biome a research project "belongs" to (for the guarded bonus): where its activity happens
 *  (catch-in-biome) or the studied species' home (catch-species). Phase-only projects map to none. */
function researchProjectBiome(p: (typeof RESEARCH_PROJECTS)[string]): BiomeId | null {
  const a = p.activityRequirement;
  if (a.kind === 'catch-in-biome') return a.biome;
  if (a.kind === 'catch-species') return SPECIES[a.species].biome;
  return null; // catch-in-phase — no single biome
}

/**
 * How thoroughly a biome has been STUDIED, 0..1. Primary: the fraction of its species catalogued.
 * Bonus (GUARDED): where the biome has research projects, a light research-completion term — with
 * NO projects (e.g. woodland), species-catalogued is used alone (never divides by zero).
 */
export function thrivingForBiome(journal: Journal, biome: BiomeId): number {
  const species = SPECIES_ORDER.filter((s) => SPECIES[s].biome === biome);
  const caught = species.filter((s) => journal.species[s]).length;
  const speciesScore = species.length === 0 ? 0 : caught / species.length;

  const projects = RESEARCH_ORDER.filter((id) => researchProjectBiome(RESEARCH_PROJECTS[id]) === biome);
  if (projects.length === 0) return speciesScore; // GUARD: species-catalogued alone (the universal signal)

  const done = projects.filter((id) => journal.research[id]?.completed).length;
  const researchScore = done / projects.length;
  return THRIVING.speciesWeight * speciesScore + THRIVING.researchWeight * researchScore;
}

/** Thriving per biome (0..1), for the renderer's warmth grade. A pure read — never mutates. */
export function thrivingByBiome(journal: Journal): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of BIOME_ORDER) out[b] = thrivingForBiome(journal, b);
  return out;
}

/** The soft qualitative word for a thriving value (the journal legibility) — quiet → waking →
 *  alive → flourishing. No number, no meter. */
export function thrivingWord(t: number): string {
  let word: string = THRIVING.bands[0].word;
  for (const band of THRIVING.bands) if (t >= band.min) word = band.word;
  return word;
}

/**
 * §4.3 capstone — the WHOLE WORLD's thriving (0..1): the mean of `thrivingForBiome` over the biomes
 * the player has reached (the always-open Meadow + every unlocked biome). The world-level scale of
 * the census's biome `known · flourishing` read. PURE (a fold over existing per-biome thriving) —
 * the win screen reads it so "and it flourishes" is HONEST: at a real completion (every species
 * recorded across every reached biome) the mean lands in the `flourishing` band — earned, not
 * asserted. Empty/edge → 0 (never divides by zero).
 */
export function worldThriving(journal: Journal): number {
  let sum = 0;
  let n = 0;
  for (const b of BIOME_ORDER) {
    if (b === 'meadow' || journal.unlockedBiomes.includes(b)) {
      sum += thrivingForBiome(journal, b);
      n += 1;
    }
  }
  return n === 0 ? 0 : sum / n;
}
