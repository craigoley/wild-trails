/**
 * Species accessor — PURE, Node-testable. The species themselves are DATA in
 * `constants.ts` (the `SPECIES` table); this module is the typed lookup +
 * eligibility queries over it. Same discipline the mission table will use.
 *
 * The two design axes stay independent here: `spawnWeight` (rarity) drives
 * `eligibleSpecies` / the spawn lottery; `baseCatchRate` (difficulty) is
 * untouched until PR #5.
 */

import {
  ETHOGRAM,
  SPECIES,
  SPECIES_BEHAVIOR,
  SPECIES_ORDER,
  type ActivityWindow,
  type BiomeId,
  type DayPhase,
  type EthogramBudget,
  type SignatureKind,
  type SpeciesDef,
  type SpeciesId,
} from '../utils/constants';

/** The full definition for a species id. */
export function getSpecies(id: SpeciesId): SpeciesDef {
  return SPECIES[id];
}

/** §4.6 D2 (ii) — a species' ethogram TIME-BUDGET (its character weighting), or the default when the
 *  species isn't tagged in SPECIES_BEHAVIOR. PURE data read; drives the slice-(i) behaviour SM. */
export function speciesBudget(id: SpeciesId): EthogramBudget {
  return SPECIES_BEHAVIOR[id]?.budget ?? ETHOGRAM.defaultBudget;
}

/** §4.6 D2 (ii) — a species' SIGNATURE behaviour (the signature beat the render plays + D3 reads), or 'none'
 *  (the honest default — most species have no signature). PURE data read. */
export function speciesSignature(id: SpeciesId): SignatureKind {
  return SPECIES_BEHAVIOR[id]?.signature ?? 'none';
}

/** Is a species with `window` out during `phase`? ANY is always out. */
export function isActiveAt(window: ActivityWindow, phase: DayPhase): boolean {
  return window === 'any' || window === phase;
}

/** All species whose home biome is `biome`, in table order. */
export function speciesInBiome(biome: BiomeId): SpeciesDef[] {
  const out: SpeciesDef[] = [];
  for (const id of SPECIES_ORDER) {
    const def = SPECIES[id];
    if (def.biome === biome) out.push(def);
  }
  return out;
}

/**
 * Species that can spawn right now in `biome` at `phase`: home biome matches AND
 * the activity window includes the phase. This is the gate that makes time of
 * day matter — wrong time, and a species simply isn't eligible.
 */
export function eligibleSpecies(biome: BiomeId, phase: DayPhase): SpeciesDef[] {
  const out: SpeciesDef[] = [];
  for (const id of SPECIES_ORDER) {
    const def = SPECIES[id];
    if (def.biome === biome && isActiveAt(def.activityWindow, phase)) out.push(def);
  }
  return out;
}
