/**
 * The mission engine — PURE, Node-testable, ZERO three/DOM/Date.now. Missions are
 * DATA (the MISSIONS table in constants); this is the behaviour over them. The
 * requirement KINDS share ONE code path — they differ only in which catch-context
 * field `meets` reads.
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
  BIOME_GATE_CHALLENGES,
  BIOME_SET_UNLOCK,
  MISSIONS,
  MISSION_ORDER,
  RANK,
  RANKS,
  RESEARCH_ORDER,
  RESEARCH_PROJECTS,
  SPECIES,
  SPECIES_ORDER,
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
  /** One-time CREDIT bonus from research challenges completed this event (§4.1b) —
   *  applied at the boundary, like creditsForCatch. */
  creditsAwarded: number;
  /** Teaching HINTS from "warm misses" on active research challenges (§4.1b) — a
   *  catch in a challenge's biome that didn't satisfy it. Banner'd; never resets. */
  hints: string[];
}

/** Does a catch event satisfy a requirement? The ONLY place the kinds differ. */
function meets(req: MissionRequirement, ev: CatchEvent): boolean {
  switch (req.kind) {
    case 'catch-in-timephase':
      return ev.phase === req.phase;
    case 'catch-in-biome':
      return ev.biome === req.biome;
    case 'catch-species':
      return ev.species === req.species; // a specific species (no tracking implied)
    case 'track-and-catch':
      return ev.species === req.species; // the target only appears via tracking
    case 'research':
      // BOTH dimensions required (§4.1b) — the right species UNDER its condition.
      return ev.species === req.species && ev.phase === req.phase;
  }
}

/** Are all of a biome's SET missions completed? Missions marked `standalone` are
 *  optional and don't count toward set-completion / the unlock. */
export function isBiomeSetComplete(journal: Journal, biome: BiomeId): boolean {
  for (const id of MISSION_ORDER) {
    const def = MISSIONS[id];
    if (def.biome !== biome || def.standalone) continue;
    if (!journal.missions[id]?.completed) return false;
  }
  return true;
}

/**
 * §4.1c — the full UNLOCK gate for a biome: its catch-set AND every required research
 * challenge (BIOME_GATE_CHALLENGES). A biome with no challenge entry reduces EXACTLY to
 * isBiomeSetComplete (the gentle gates are byte-for-byte unchanged). The escalation:
 * the Wetland gate also requires research-mouse-night (demonstrated mastery).
 */
export function isBiomeGateMet(journal: Journal, biome: BiomeId): boolean {
  if (!isBiomeSetComplete(journal, biome)) return false;
  for (const challengeId of BIOME_GATE_CHALLENGES[biome] ?? []) {
    if (!journal.missions[challengeId]?.completed) return false;
  }
  return true;
}

/**
 * R2 (§4.1.4): is reaching `target` gated behind a RESEARCH project (a biome-access
 * reward)? Such a target no longer auto-unlocks on isBiomeGateMet — its research project
 * owns the unlock (via the reward dispatch). Reads RESEARCH_PROJECTS (no Research import —
 * avoids a cycle). The gentle gates (no biome-access project) are unaffected.
 */
export function isResearchGatedUnlock(target: BiomeId): boolean {
  for (const id of RESEARCH_ORDER) {
    const r = RESEARCH_PROJECTS[id].reward;
    if (r.kind === 'biome-access' && r.biome === target) return true;
  }
  return false;
}

/**
 * R2: is the §4.1c GATE for reaching `target` met (its source set's missions + any mastery
 * challenge)? The biome-access reward dispatch re-checks this so the wrap PRESERVES the gate
 * (the wetland set + research-mouse-night) — it never replaces it. Returns false if `target`
 * isn't a set-unlock target.
 */
export function isUnlockGateMet(journal: Journal, target: BiomeId): boolean {
  for (const source of Object.keys(BIOME_SET_UNLOCK) as BiomeId[]) {
    if (BIOME_SET_UNLOCK[source] === target) return isBiomeGateMet(journal, source);
  }
  return false;
}

/**
 * R2: unlock any research-gated biome whose project is COMPLETE and whose §4.1c gate is met,
 * recording it into `journal.unlockedBiomes`. PURE (mutates the journal, returns the newly
 * unlocked biomes — like evaluateCatch's unlock loop); the boundary applies them to the live
 * world. ORDER-INDEPENDENT (runs every catch) so it fires whether the project or the §4.1c
 * gate finished last. ⚠️ DOUBLE-enforced knowledge-by-play: the project can't complete
 * without its knowledgeRequirement (the mastery challenge), AND isUnlockGateMet re-checks the
 * §4.1c gate (the wetland set + the same challenge) — credits/activity CANNOT substitute.
 */
export function reconcileResearchUnlocks(journal: Journal): BiomeId[] {
  const unlocked: BiomeId[] = [];
  for (const id of RESEARCH_ORDER) {
    const reward = RESEARCH_PROJECTS[id].reward;
    if (reward.kind !== 'biome-access') continue;
    if (!journal.research[id]?.completed) continue; // the project must be complete (activity + mastery)
    const target = reward.biome;
    if (isUnlockGateMet(journal, target) && !journal.unlockedBiomes.includes(target)) {
      journal.unlockedBiomes.push(target);
      unlocked.push(target);
    }
  }
  return unlocked;
}

/**
 * Evaluate a catch against every active mission, mutating the journal's mission /
 * rank / unlock state and returning the deltas. Idempotent w.r.t. already-done
 * missions (the double-fire guard).
 */
export function evaluateCatch(journal: Journal, ev: CatchEvent): MissionEval {
  const result: MissionEval = {
    progressed: [],
    completed: [],
    unlocked: [],
    pointsAwarded: 0,
    creditsAwarded: 0,
    hints: [],
  };

  for (const id of MISSION_ORDER) {
    const def = MISSIONS[id];
    const prog = journal.missions[id] ?? { progress: 0, completed: false };
    journal.missions[id] = prog;
    if (prog.completed) continue; // already done — never re-progress / re-award
    if (!meets(def.requirement, ev)) {
      // §4.1b teaching-moment: a "warm miss" on an active research challenge — a
      // catch in the challenge's biome that didn't satisfy it. Re-frame the clue;
      // progress is untouched (count-1 — nothing to reset).
      if (def.requirement.kind === 'research' && def.hint && ev.biome === SPECIES[def.requirement.species].biome) {
        result.hints.push(def.hint);
      }
      continue;
    }

    prog.progress += 1;
    result.progressed.push(id);
    if (prog.progress >= def.requirement.count) {
      prog.completed = true;
      result.completed.push(id);
      journal.rankPoints += def.rewardPoints;
      result.pointsAwarded += def.rewardPoints;
      // One-time research-challenge credit bonus (§4.1b) — applied at the boundary.
      if (def.creditReward) result.creditsAwarded += def.creditReward;
    }
  }

  // §4.1c: on ANY mission completion, re-check EVERY gated biome's full gate (catch-set
  // AND its required challenges). Order-independent — this is what lets a STANDALONE
  // gating challenge (research-mouse-night, a Meadow mission gating the Wetland→Highlands
  // unlock) trigger the unlock no matter whether the wetland set or the challenge
  // finished last. Cheap (a handful of gates); gentle gates behave exactly as before.
  if (result.completed.length > 0) {
    for (const biome of Object.keys(BIOME_SET_UNLOCK) as BiomeId[]) {
      if (!isBiomeGateMet(journal, biome)) continue;
      const target = BIOME_SET_UNLOCK[biome];
      // R2: a research-gated target (the Highlands) no longer auto-unlocks here — its
      // research project owns the unlock (via the biome-access reward dispatch, which
      // re-checks this same gate). The gentle gates fall through and unlock as before.
      if (target && isResearchGatedUnlock(target)) continue;
      if (target && !journal.unlockedBiomes.includes(target)) {
        journal.unlockedBiomes.push(target);
        result.unlocked.push(target);
      }
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

// ---------------------------------------------------------------------------
// Completion / win (Plan #10) — computed PURELY from journal state, no new
// mechanic, no grind counter.
// ---------------------------------------------------------------------------

/** The biomes that have a mission SET (≥1 non-standalone mission) — the ones whose
 *  completion counts toward the win. Derived from the data, so a new biome's set
 *  is auto-included. */
export function missionSetBiomes(): BiomeId[] {
  const seen = new Set<BiomeId>();
  for (const id of MISSION_ORDER) {
    const def = MISSIONS[id];
    if (!def.standalone) seen.add(def.biome);
  }
  return [...seen];
}

/**
 * Is the field guide complete (the §14 win)? Every species caught + every biome
 * mission SET complete + top rank. Pure over the journal — earned through play, no
 * grind: with the shipped content, catching all species + finishing the sets
 * already clears the top-rank threshold, so the rank check is never a separate
 * wall (see the achievability test).
 */
export function isGameComplete(journal: Journal): boolean {
  if (foundCount(journal) < SPECIES_ORDER.length) return false;
  for (const biome of missionSetBiomes()) {
    if (!isBiomeSetComplete(journal, biome)) return false;
  }
  return currentRank(journal).name === RANKS[RANKS.length - 1].name;
}

/** Should the win celebration fire NOW? Complete AND not yet celebrated — the
 *  persisted `won` flag is the double-fire guard (fires once; a won save reloading
 *  doesn't re-celebrate). The boundary sets `won = true` + saves when this is true. */
export function shouldCelebrateWin(journal: Journal): boolean {
  return !journal.won && isGameComplete(journal);
}
