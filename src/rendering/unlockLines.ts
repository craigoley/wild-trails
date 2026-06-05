/**
 * PURE legibility transform for the Mission panel (§17.1): make the
 * mission-set → biome-unlock relationship visible. The unlock fires when a biome's
 * whole non-standalone mission SET completes (BIOME_SET_UNLOCK is keyed per-SET) —
 * so this emits ONE line per gating set: "complete these → reach that", with
 * progress. No DOM/three (like missionGroups.ts) — unit-testable. No state change;
 * BIOME_SET_UNLOCK is READ, never mutated.
 */

import {
  BIOME_SET_UNLOCK,
  BIOMES,
  MISSIONS,
  MISSION_ORDER,
  type BiomeId,
} from '../utils/constants';
import { isBiomeSetComplete } from '../game/Missions';
import type { Journal } from '../state/Journal';

export interface UnlockLine {
  /** The gating set's biome (whose missions you complete). */
  setBiome: BiomeId;
  setName: string;
  /** The biome this set unlocks, or null if the set unlocks nothing (terminal). */
  unlocks: BiomeId | null;
  unlocksName: string | null;
  /** Gating missions completed / total — STANDALONE excluded (the unlock rule). */
  done: number;
  total: number;
  /** Is the unlocked biome already reached? (a quiet ✓ rather than the carrot.) */
  alreadyUnlocked: boolean;
}

/** The biomes that have a gating mission set (≥1 non-standalone mission), in
 *  MISSION_ORDER's first-appearance order — the chain order. Mirrors
 *  Missions.missionSetBiomes(); kept local so the helper stays a pure presentation
 *  transform that reads the same data. */
function gatingSetBiomes(): BiomeId[] {
  const seen: BiomeId[] = [];
  for (const id of MISSION_ORDER) {
    const def = MISSIONS[id];
    if (!def.standalone && !seen.includes(def.biome)) seen.push(def.biome);
  }
  return seen;
}

/** Count a biome's gating (non-standalone) missions: total + completed. The SAME
 *  rule isBiomeSetComplete uses, so the "X of N" can never drift from the actual
 *  gate (no hardcoded counts — track-badger, now non-standalone, is counted). */
function gatingProgress(journal: Journal, biome: BiomeId): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const id of MISSION_ORDER) {
    const def = MISSIONS[id];
    if (def.biome !== biome || def.standalone) continue;
    total += 1;
    if (journal.missions[id]?.completed) done += 1;
  }
  return { done, total };
}

/** One UnlockLine per gating set, in chain order. The panel renders the ones whose
 *  `unlocks !== null` (terminal sets — no onward biome — are still returned with
 *  unlocks: null so callers/tests can see them, but produce no carrot line). */
export function unlockLines(journal: Journal): UnlockLine[] {
  return gatingSetBiomes().map((setBiome) => {
    const unlocks = BIOME_SET_UNLOCK[setBiome] ?? null;
    const { done, total } = gatingProgress(journal, setBiome);
    return {
      setBiome,
      setName: BIOMES[setBiome].displayName,
      unlocks,
      unlocksName: unlocks ? BIOMES[unlocks].displayName : null,
      done,
      total,
      // Consistency: isBiomeSetComplete is the authority on "set done"; the target
      // is unlocked once earned (tracked in the journal).
      alreadyUnlocked: unlocks
        ? journal.unlockedBiomes.includes(unlocks) || isBiomeSetComplete(journal, setBiome)
        : false,
    };
  });
}
