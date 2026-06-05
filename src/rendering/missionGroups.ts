/**
 * PURE presentation grouping for the Mission panel (no DOM/three — like
 * missionBanners.ts / timeOfDayDisplay.ts, so it's unit-testable). Splits the
 * existing missions into Active (incomplete) vs Completed by their journal
 * completed-state, preserving MISSION_ORDER. No game logic, no state mutation.
 */

import { MISSION_ORDER } from '../utils/constants';
import type { Journal } from '../state/Journal';

export interface MissionGroups {
  /** Incomplete missions, in MISSION_ORDER — "what you can do now". */
  active: string[];
  /** Completed missions, in MISSION_ORDER — the done pile. */
  completed: string[];
}

/** Split missions into active/completed by `journal.missions[id].completed`,
 *  keeping MISSION_ORDER. Every mission appears in exactly one group — standalone
 *  (track-badger) and gating missions alike (standalone-ness affects the unlock
 *  gate, not whether the mission is shown). */
export function groupMissions(journal: Journal): MissionGroups {
  const active: string[] = [];
  const completed: string[] = [];
  for (const id of MISSION_ORDER) {
    if (journal.missions[id]?.completed) completed.push(id);
    else active.push(id);
  }
  return { active, completed };
}
