/**
 * The Research Spine engine (§4.1.4, R0a) — PURE, Node-testable (no three/DOM/clock).
 * Research projects START for credits, ADVANCE through in-game ACTIVITY (catches — the
 * fun thing), and COMPLETE to unlock capability.
 *
 * ⚠️ Two cardinal invariants, structural here:
 *  - ACTIVITY, never time (P8): advancement is driven ONLY by catch events
 *    (evaluateResearch). There is NO time/day-cycle path — research is a reward for
 *    PLAYING, never a passive timer.
 *  - KNOWLEDGE by PLAY (P1/P2/P3): a project's `knowledgeRequirement` (R2's §4.1c wrap) is
 *    satisfied ONLY by the mastery-challenge's `journal.missions` completion. Credits and
 *    activity CANNOT satisfy it — research wraps a knowledge gate it cannot bypass.
 *
 * R0a is the ENGINE: it READS the same CatchEvent stream evaluateCatch does (the catch
 * core is untouched). The boundary wiring, the UI, and the reward EFFECTS are R0b+.
 */

import {
  RESEARCH_ORDER,
  RESEARCH_PROJECTS,
  type ResearchActivity,
  type ResearchProject,
  type ResearchReward,
} from '../utils/constants';
import type { Journal, ResearchState } from '../state/Journal';
import { spendCredits } from './Economy';
import type { CatchEvent } from './Missions';

/** Per-event research deltas (for the boundary to apply rewards). */
export interface ResearchEval {
  /** Project ids that progressed this event. */
  progressed: string[];
  /** Project ids that COMPLETED this event. */
  completed: string[];
  /** Rewards from the completed projects — the consumer (R0b+) dispatches them. */
  rewards: ResearchReward[];
}

/** Get (creating if needed) the mutable state for a project. */
function state(journal: Journal, id: string): ResearchState {
  let s = journal.research[id];
  if (!s) {
    s = { started: false, progress: 0, completed: false };
    journal.research[id] = s;
  }
  return s;
}

/** Read-only snapshot of a project's state (defaults to "untouched"). */
export function researchState(journal: Journal, id: string): ResearchState {
  return journal.research[id] ?? { started: false, progress: 0, completed: false };
}

/**
 * ⚠️ Is the project's KNOWLEDGE requirement met? Satisfied ONLY by the mastery-challenge's
 * `journal.missions` completion (by PLAY, #48) — credits/activity CANNOT satisfy it.
 */
export function knowledgeMet(journal: Journal, project: ResearchProject): boolean {
  if (!project.knowledgeRequirement) return true;
  return journal.missions[project.knowledgeRequirement]?.completed === true;
}

/** Are all of this project's prerequisite projects complete? */
function prereqMet(journal: Journal, project: ResearchProject): boolean {
  for (const id of project.prereq ?? []) {
    if (!journal.research[id]?.completed) return false;
  }
  return true;
}

/** Can the player START this project (not started/done, prereqs met, affordable)? */
export function canStartResearch(journal: Journal, id: string): boolean {
  const p = RESEARCH_PROJECTS[id];
  if (!p) return false;
  const s = journal.research[id];
  if (s?.started || s?.completed) return false;
  return prereqMet(journal, p) && journal.credits >= p.cost;
}

/** Start a project: spend the start cost, mark started. Returns false (no spend) if it can't. */
export function startResearch(journal: Journal, id: string): boolean {
  if (!canStartResearch(journal, id)) return false;
  spendCredits(journal, RESEARCH_PROJECTS[id].cost);
  state(journal, id).started = true;
  return true;
}

/** Does a catch event match the project's activity requirement? */
function activityMatches(activity: ResearchActivity, ev: CatchEvent): boolean {
  switch (activity.kind) {
    case 'catch-species':
      return ev.species === activity.species;
    case 'catch-in-biome':
      return ev.biome === activity.biome;
    case 'catch-in-phase':
      return ev.phase === activity.phase;
  }
}

/** Is the project READY to complete (started, activity count met, knowledge + prereqs met)? */
export function isResearchReady(journal: Journal, id: string): boolean {
  const p = RESEARCH_PROJECTS[id];
  const s = journal.research[id];
  if (!p || !s?.started || s.completed) return false;
  return s.progress >= p.activityRequirement.count && knowledgeMet(journal, p) && prereqMet(journal, p);
}

function markComplete(journal: Journal, p: ResearchProject): ResearchReward {
  state(journal, p.id).completed = true;
  return p.reward;
}

/**
 * Explicitly complete a READY project, charging the optional credit top-up. Returns the
 * reward, or null if not ready / the top-up is unaffordable. (No-top-up projects
 * auto-complete in evaluateResearch; this is the top-up path — R0b's "Complete" button.)
 */
export function completeResearch(journal: Journal, id: string): ResearchReward | null {
  if (!isResearchReady(journal, id)) return null;
  const p = RESEARCH_PROJECTS[id];
  if (p.creditTopUp !== undefined && !spendCredits(journal, p.creditTopUp)) return null;
  return markComplete(journal, p);
}

/**
 * Advance research on a catch event — runs alongside evaluateCatch at the SAME boundary.
 * Each STARTED, incomplete project whose activity matches progresses (capped at the count);
 * any that becomes ready with NO top-up auto-completes. Top-up projects stay ready for an
 * explicit completeResearch. Returns the deltas; the consumer dispatches the rewards. This
 * is the ONLY way research advances — there is deliberately no time/day-cycle path (P8).
 */
export function evaluateResearch(journal: Journal, ev: CatchEvent): ResearchEval {
  const result: ResearchEval = { progressed: [], completed: [], rewards: [] };
  for (const id of RESEARCH_ORDER) {
    const p = RESEARCH_PROJECTS[id];
    const s = journal.research[id];
    if (!s?.started || s.completed) continue;
    if (activityMatches(p.activityRequirement, ev) && s.progress < p.activityRequirement.count) {
      s.progress += 1;
      result.progressed.push(id);
    }
    if (p.creditTopUp === undefined && isResearchReady(journal, id)) {
      result.completed.push(id);
      result.rewards.push(markComplete(journal, p));
    }
  }
  return result;
}

/**
 * The set of journal-knowledge LAYERS the player has unlocked — the `reward.layer` of
 * every COMPLETED `journal-layer` project (R0b's reward effect; `layer` is a species id).
 * The dex card reads this to reveal a species' deeper `researchNote`. Pure, derived (no
 * extra persisted state).
 */
export function unlockedResearchLayers(journal: Journal): Set<string> {
  const layers = new Set<string>();
  for (const id of RESEARCH_ORDER) {
    const p = RESEARCH_PROJECTS[id];
    if (p.reward.kind === 'journal-layer' && journal.research[id]?.completed) {
      layers.add(p.reward.layer);
    }
  }
  return layers;
}

/**
 * The research project whose completion grants `toolId` (R1 — the net is research-gated),
 * or null if none. The shop reads this to show "Research to unlock: <name>" for an un-owned
 * biome net (research is the single acquisition path; the shop-buy retired). Pure.
 */
export function researchProjectForTool(toolId: string): ResearchProject | null {
  for (const id of RESEARCH_ORDER) {
    const p = RESEARCH_PROJECTS[id];
    if (p.reward.kind === 'grant-tool' && p.reward.toolId === toolId) return p;
  }
  return null;
}
