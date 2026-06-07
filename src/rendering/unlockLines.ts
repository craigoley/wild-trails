/**
 * PURE legibility transform for the Mission panel (§17.1): make the
 * mission-set → biome-unlock relationship visible. The unlock fires when a biome's
 * whole non-standalone mission SET completes (BIOME_SET_UNLOCK is keyed per-SET) —
 * so this emits ONE line per gating set: "complete these → reach that", with
 * progress. No DOM/three (like missionGroups.ts) — unit-testable. No state change;
 * BIOME_SET_UNLOCK is READ, never mutated.
 */

import {
  BIOME_GATE_CHALLENGES,
  BIOME_SET_UNLOCK,
  BIOMES,
  MISSIONS,
  MISSION_ORDER,
  RESEARCH_ORDER,
  RESEARCH_PROJECTS,
  type BiomeId,
} from '../utils/constants';
import { isBiomeGateMet } from '../game/Missions';
import type { Journal } from '../state/Journal';

/** §4.1c — a research challenge a biome's unlock ALSO requires (shown so the gate is
 *  never silent). */
export interface RequiredChallenge {
  id: string;
  title: string;
  done: boolean;
}

/** §4.1.4 R2 — a research PROJECT a biome's unlock is wrapped in (its biome-access reward),
 *  with its live state, so the player sees the research step too (never a silent wall). */
export interface RequiredResearch {
  id: string;
  name: string;
  started: boolean;
  progress: number;
  count: number;
  completed: boolean;
}

/** The biome-access research project that unlocks `target` (R2), with its state — or null
 *  if the unlock isn't research-gated (the gentle gates). */
function requiredResearchFor(journal: Journal, target: BiomeId | null): RequiredResearch | null {
  if (!target) return null;
  for (const id of RESEARCH_ORDER) {
    const p = RESEARCH_PROJECTS[id];
    if (p.reward.kind === 'biome-access' && p.reward.biome === target) {
      const s = journal.research[id];
      return {
        id,
        name: p.name,
        started: s?.started ?? false,
        progress: Math.min(s?.progress ?? 0, p.activityRequirement.count),
        count: p.activityRequirement.count,
        completed: s?.completed ?? false,
      };
    }
  }
  return null;
}

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
  /** §4.1c — research challenges this unlock ALSO requires (empty for gentle gates). */
  requiredChallenges: RequiredChallenge[];
  /** §4.1.4 R2 — the research project this unlock is wrapped in (its biome-access reward),
   *  or null for the gentle gates. Shown so the research step is never a silent wall. */
  requiredResearch: RequiredResearch | null;
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
    // §4.1c — the escalated gate's required research challenge(s), each with its done
    // state, so the player is TOLD what's required (never a silent knowledge-wall).
    const requiredChallenges = (BIOME_GATE_CHALLENGES[setBiome] ?? []).map((id) => ({
      id,
      title: MISSIONS[id].title,
      done: journal.missions[id]?.completed ?? false,
    }));
    const requiredResearch = requiredResearchFor(journal, unlocks);
    return {
      setBiome,
      setName: BIOMES[setBiome].displayName,
      unlocks,
      unlocksName: unlocks ? BIOMES[unlocks].displayName : null,
      done,
      total,
      requiredChallenges,
      requiredResearch,
      // §4.1c/R2: the target is "reached" only once it's actually in the journal's unlocks.
      // For a GENTLE gate (no required research), isBiomeGateMet implies the imminent unlock,
      // so it still counts. For a RESEARCH-WRAPPED gate, the research must ALSO complete — so
      // isBiomeGateMet alone does NOT mark it reached (the carrot + the research step stay).
      alreadyUnlocked: unlocks
        ? journal.unlockedBiomes.includes(unlocks) ||
          (requiredResearch === null && isBiomeGateMet(journal, setBiome))
        : false,
    };
  });
}
