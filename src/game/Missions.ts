/**
 * The mission engine — PURE, Node-testable, ZERO three/DOM/Date.now. Missions are
 * DATA (the MISSIONS table in constants); this is the behaviour over them. The
 * two requirement KINDS (catch-in-timephase, catch-in-biome) share ONE code path
 * — they differ only in which catch-context field `meets` reads.
 *
 * Missions evaluate on a CATCH EVENT (species, biome, phase — all passed in, no
 * clock read here). Progress + completion + rank points + biome unlocks all live
 * in the persistent Journal (so they survive reload); the engine mutates that
 * state and returns the per-event deltas for telemetry + the boundary's reward
 * application (e.g. flipping the World's unlock flag).
 *
 * Completion fires EXACTLY ONCE: a completed mission is skipped on later events,
 * and a set-unlock is added only if not already present. No grind / recall trivia
 * — every mission gates on knowledge the player APPLIES (§6.5).
 */

import {
  BIOME_SET_UNLOCK,
  MISSIONS,
  MISSION_ORDER,
  RANK,
  RANKS,
  type BiomeId,
  type DayPhase,
  type MissionRequirement,
  type RankDef,
  type SpeciesId,
} from '../utils/constants';
import { foundCount, type Journal } from '../state/Journal';

/** The context a catch carries to the mission engine. */
export interface CatchEvent {
  species: SpeciesId;
  biome: BiomeId;
  phase: DayPhase;
}

/** Per-event deltas (for telemetry + applying rewards at the boundary). */
export interface MissionEval {
  /** Mission ids that progressed this event. */
  progressed: string[];
  /** Mission ids that COMPLETED this event. */
  completed: string[];
  /** Biomes unlocked this event (a set just finished). */
  unlocked: BiomeId[];
  /** Rank points awarded this event. */
  pointsAwarded: number;
}

/** Does a catch event satisfy a requirement? The ONLY place the kinds differ. */
function meets(req: MissionRequirement, ev: CatchEvent): boolean {
  switch (req.kind) {
    case 'catch-in-timephase':
      return ev.phase === req.phase;
    case 'catch-in-biome':
      return ev.biome === req.biome;
    case 'track-and-catch':
      return ev.species === req.species; // the target only appears via tracking
  }
}

/** Are all of a biome's SET missions completed? Standalone side-quests (Plan #8b
 *  tracking) are optional and don't count toward set-completion / the unlock. */
export function isBiomeSetComplete(journal: Journal, biome: BiomeId): boolean {
  for (const id of MISSION_ORDER) {
    const def = MISSIONS[id];
    if (def.biome !== biome || def.standalone) continue;
    if (!journal.missions[id]?.completed) return false;
  }
  return true;
}

/**
 * Evaluate a catch against every active mission, mutating the journal's mission /
 * rank / unlock state and returning the deltas. Idempotent w.r.t. already-done
 * missions (the double-fire guard).
 */
export function evaluateCatch(journal: Journal, ev: CatchEvent): MissionEval {
  const result: MissionEval = { progressed: [], completed: [], unlocked: [], pointsAwarded: 0 };
  const completedSets = new Set<BiomeId>();

  for (const id of MISSION_ORDER) {
    const def = MISSIONS[id];
    const prog = journal.missions[id] ?? { progress: 0, completed: false };
    journal.missions[id] = prog;
    if (prog.completed) continue; // already done — never re-progress / re-award
    if (!meets(def.requirement, ev)) continue;

    prog.progress += 1;
    result.progressed.push(id);
    if (prog.progress >= def.requirement.count) {
      prog.completed = true;
      result.completed.push(id);
      journal.rankPoints += def.rewardPoints;
      result.pointsAwarded += def.rewardPoints;
      completedSets.add(def.biome);
    }
  }

  // A finished set unlocks its mapped biome (once).
  for (const biome of completedSets) {
    if (!isBiomeSetComplete(journal, biome)) continue;
    const target = BIOME_SET_UNLOCK[biome];
    if (target && !journal.unlockedBiomes.includes(target)) {
      journal.unlockedBiomes.push(target);
      result.unlocked.push(target);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Rank (pure computation over the journal)
// ---------------------------------------------------------------------------

/** Total rank points = mission rewards (persisted) + a bonus per species found. */
export function rankPointsTotal(journal: Journal): number {
  return journal.rankPoints + foundCount(journal) * RANK.perSpeciesFound;
}

/** The current Field-Researcher rank: the highest whose minPoints the total meets. */
export function currentRank(journal: Journal): RankDef {
  const total = rankPointsTotal(journal);
  let rank = RANKS[0];
  for (const r of RANKS) if (total >= r.minPoints) rank = r;
  return rank;
}
