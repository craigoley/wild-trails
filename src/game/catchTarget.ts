/**
 * §HUD catch-target — PURE, Node-testable. Maps a challenge (a mission requirement or a research
 * project) to the SPECIES the player should be looking for + the progress, so the HUD can show a
 * portrait + a count ("Catch the hedgehog · 0/3"). ⚠️ DISPLAY-ONLY: this reads existing mission/research
 * state; it never touches catching (no spawn/catch change). No `three` here — the thumbnail RENDER lives
 * in src/rendering; this is the pure data half.
 *
 * Three of the five catch-style kinds name a SPECIES directly; the biome/phase kinds resolve to a
 * REPRESENTATIVE — the biome's SIGNATURE species (its first in SPECIES_ORDER, the pedagogical primary)
 * or the first species active in the phase. So every challenge maps to one displayable species.
 */

import {
  MISSIONS,
  RESEARCH_PROJECTS,
  SPECIES,
  SPECIES_ORDER,
  type BiomeId,
  type DayPhase,
  type SpeciesId,
} from '../utils/constants';
import type { Journal } from '../state/Journal';

/** The biome's SIGNATURE species — the first of that biome in SPECIES_ORDER (the pedagogical primary). */
export function signatureSpecies(biome: BiomeId): SpeciesId {
  for (const id of SPECIES_ORDER) if (SPECIES[id].biome === biome) return id;
  return SPECIES_ORDER[0]; // guard — never hit (every biome has species)
}

/** The phase's representative species — PREFER a specialist active exactly in that phase (a dusk
 *  challenge should portray a dusk animal), falling back to the first any-window species. */
export function phaseSpecies(phase: DayPhase): SpeciesId {
  for (const id of SPECIES_ORDER) if (SPECIES[id].activityWindow === phase) return id; // a specialist
  for (const id of SPECIES_ORDER) if (SPECIES[id].activityWindow === 'any') return id; // else any-window
  return SPECIES_ORDER[0];
}

/** A catch-style requirement or research activity (the discriminated shapes both unions share). */
export type CatchChallenge =
  | { kind: 'catch-species' | 'track-and-catch' | 'research'; species: SpeciesId }
  | { kind: 'catch-in-biome'; biome: BiomeId }
  | { kind: 'catch-in-timephase' | 'catch-in-phase'; phase: DayPhase };

/** Resolve any catch-style challenge to the species to PORTRAY. Species-kinds → their species; the
 *  biome/phase kinds → the representative. Exhaustive over both the mission + research unions. */
export function speciesForChallenge(req: CatchChallenge): SpeciesId {
  switch (req.kind) {
    case 'catch-species':
    case 'track-and-catch':
    case 'research':
      return req.species;
    case 'catch-in-biome':
      return signatureSpecies(req.biome);
    case 'catch-in-timephase':
    case 'catch-in-phase':
      return phaseSpecies(req.phase);
  }
}

/** What the HUD shows for a target: the species + the live progress. */
export interface CatchTarget {
  species: SpeciesId;
  progress: number;
  count: number;
}

/** The catch target for a MISSION (the "Catch the hedgehog · 0/3" challenge), or null if unknown. */
export function targetForMission(missionId: string, journal: Journal): CatchTarget | null {
  const def = MISSIONS[missionId];
  if (!def) return null;
  return {
    species: speciesForChallenge(def.requirement),
    progress: journal.missions[missionId]?.progress ?? 0,
    count: def.requirement.count,
  };
}

/** The species to PORTRAY for a RESEARCH project: its named mastery challenge's species (e.g. "The
 *  Cone-Hoarder" → the red squirrel) when present, else the activity's representative. Null if unknown. */
export function speciesForResearch(projectId: string): SpeciesId | null {
  const p = RESEARCH_PROJECTS[projectId];
  if (!p) return null;
  if (p.knowledgeRequirement) {
    const m = MISSIONS[p.knowledgeRequirement];
    if (m) return speciesForChallenge(m.requirement);
  }
  return speciesForChallenge(p.activityRequirement);
}
