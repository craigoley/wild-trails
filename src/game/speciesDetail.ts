/**
 * §chip-detail — PURE assembly of the target-chip detail sheet's data (the where / how / why for the
 * species the chip names). Display-only: READS the species def + mission/research defs + the journal;
 * never mutates anything (no spawn/catch/mission change). No `three`/DOM here — the bottom sheet RENDER
 * and the cached thumbnail live in src/rendering; this is the data half, mirroring catchTarget.ts.
 *
 * Keyed by the CHIP'S tracked mission id (the same `trackedId` the chip resolves), so the sheet details
 * EXACTLY what the chip shows — including a biome/phase REPRESENTATIVE (the signature species) when the
 * tracked challenge is a biome/phase kind. The HOW "approach" tip is DERIVED from existing mechanical
 * data (the diet's bait + a wary/bold split on detectionRadius) — no authored lore.
 */

import {
  ACTIVITY_LABEL,
  BAIT_DISPLAY,
  BIOMES,
  CAVE_ACTIVITY_LABEL,
  MISSIONS,
  MISSION_ORDER,
  RESEARCH_PROJECTS,
  RESEARCH_ORDER,
  SPECIES,
  SPECIES_DETAIL,
  type SpeciesId,
} from '../utils/constants';
import type { Journal } from '../state/Journal';
import { speciesForChallenge, speciesForResearch, targetForMission } from './catchTarget';

/** The WHY block — the tracked challenge (prominent) + the names of OTHER active challenges served. */
export interface SpeciesDetailWhy {
  /** The chip's tracked mission — name · progress · reward points. Null only if the id is unknown. */
  tracked: { title: string; progress: number; count: number; points: number } | null;
  /** Names of OTHER active challenges (missions + in-flight research) whose target is THIS species —
   *  the "Also serves: X, Y" line (names only). Empty when the species serves only the tracked goal. */
  alsoServes: string[];
}

/** Everything the bottom sheet renders (the lead + the three tight sections), pure data. */
export interface SpeciesDetail {
  species: SpeciesId;
  displayName: string;
  /** LEAD — the catch progress toward the tracked challenge (the chip's exact numbers). */
  progress: number;
  count: number;
  /** WHERE — habitat (biome display name) + the activity-window label. */
  habitat: string;
  activity: string;
  /** HOW — the diet's bait label + the derived wary/bold approach tip. */
  baitLabel: string;
  wary: boolean;
  warinessTip: string;
  /** WHY — the tracked goal + the "also serves" names. */
  why: SpeciesDetailWhy;
}

/** Is a mission an ACTIVE progression goal — incomplete AND non-standalone (the trackedTarget rule)? */
function isActiveMission(id: string, journal: Journal): boolean {
  return !!MISSIONS[id] && !journal.missions[id]?.completed && !MISSIONS[id].standalone;
}

/** Is a research project IN-FLIGHT (started, not completed)? Only then does catching advance it. */
function isActiveResearch(id: string, journal: Journal): boolean {
  const s = journal.research[id];
  return !!s?.started && !s.completed;
}

/** The activity label for a species — the cave's "round the clock in the dark" override for cave
 *  species (matching the journal), else the generic ACTIVITY_LABEL for its window. */
function activityLabel(species: SpeciesId): string {
  const def = SPECIES[species];
  return def.biome === 'cave' ? CAVE_ACTIVITY_LABEL : ACTIVITY_LABEL[def.activityWindow];
}

/**
 * Assemble the detail for the chip's tracked mission. Null if the id is unknown (the sheet then stays
 * closed). The species is resolved from the SAME `targetForMission` the chip uses → guaranteed match.
 */
export function speciesDetailFor(trackedId: string, journal: Journal): SpeciesDetail | null {
  const t = targetForMission(trackedId, journal);
  if (!t) return null;
  const species = t.species;
  const def = SPECIES[species];

  // HOW — derived (no lore): a wary species genuinely bolts from further (a real detectionRadius read).
  const wary = def.detectionRadius >= SPECIES_DETAIL.waryThreshold;

  // WHY — the tracked mission, prominent; plus OTHER active challenges whose target species is the SAME
  // (reverse the speciesForChallenge / speciesForResearch mapping over the active set; exclude the tracked).
  const alsoServes: string[] = [];
  for (const id of MISSION_ORDER) {
    if (id === trackedId || !isActiveMission(id, journal)) continue;
    if (speciesForChallenge(MISSIONS[id].requirement) === species) alsoServes.push(MISSIONS[id].title);
  }
  for (const id of RESEARCH_ORDER) {
    if (!isActiveResearch(id, journal)) continue;
    if (speciesForResearch(id) === species) alsoServes.push(RESEARCH_PROJECTS[id].name);
  }

  return {
    species,
    displayName: def.displayName,
    progress: t.progress,
    count: t.count,
    habitat: BIOMES[def.biome].displayName,
    activity: activityLabel(species),
    baitLabel: BAIT_DISPLAY[def.bait].label,
    wary,
    warinessTip: wary ? SPECIES_DETAIL.waryTip : SPECIES_DETAIL.boldTip,
    why: {
      tracked: {
        title: MISSIONS[trackedId].title,
        progress: t.progress,
        count: t.count,
        points: MISSIONS[trackedId].rewardPoints,
      },
      alsoServes,
    },
  };
}
