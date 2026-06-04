/**
 * Bait — PURE, Node-testable. The diet-learning lure: the player deploys a bait
 * type at a spot; the CORRECT bait for a species' diet calms it (a catch-chance
 * bonus) AND lures matching-diet animals to APPROACH instead of flee for a short
 * window. The WRONG bait does nothing — that's the mechanic that teaches diets.
 *
 * Bait is a consumable with an in-memory count per type (no persistence until
 * PR #7). All deltas / durations live in constants.
 */

import { BAIT, BAIT_ORDER, type BaitId, type SpeciesDef } from '../utils/constants';

export type { BaitId } from '../utils/constants';

export interface BaitState {
  /** The currently deployed bait type, or null if none is active. */
  activeType: BaitId | null;
  /** Seconds remaining on the active deployment. */
  timer: number;
  /** Where the active bait was deployed (the lure point). */
  x: number;
  y: number;
  /** The bait type the player will deploy next. */
  selected: BaitId;
  /** Remaining count per bait type. */
  counts: Record<BaitId, number>;
}

export function createBaitState(): BaitState {
  const counts = {} as Record<BaitId, number>;
  for (const id of BAIT_ORDER) counts[id] = BAIT.startingCount;
  return { activeType: null, timer: 0, x: 0, y: 0, selected: BAIT_ORDER[0], counts };
}

/** Cycle the selected bait type to the next in order. */
export function cycleSelectedBait(state: BaitState): void {
  const i = BAIT_ORDER.indexOf(state.selected);
  state.selected = BAIT_ORDER[(i + 1) % BAIT_ORDER.length];
}

/** Can the player SELECT this bait? Only if some remains (count > 0). Drives the
 *  tray's greyed/non-selectable state, so the #5.3 economy is visible. */
export function isBaitSelectable(state: BaitState, id: BaitId): boolean {
  return state.counts[id] > 0;
}

/**
 * Directly select a bait type (the tray's one-tap selector). A no-op if that
 * bait is EMPTY — the previously-selected bait stays selected. Returns whether
 * the selection changed (false = blocked because it was empty).
 */
export function setSelectedBait(state: BaitState, id: BaitId): boolean {
  if (!isBaitSelectable(state, id)) return false;
  state.selected = id;
  return true;
}

/**
 * Deploy the SELECTED bait at (x, y) if any remain. Decrements the count, sets
 * the active deployment + timer. Returns true on success, false if out of that
 * bait. (Deploying replaces any currently-active bait.)
 */
export function deployBait(state: BaitState, x: number, y: number): boolean {
  const id = state.selected;
  if (state.counts[id] <= 0) return false;
  state.counts[id] -= 1;
  state.activeType = id;
  state.timer = BAIT.activeWindowSec;
  state.x = x;
  state.y = y;
  return true;
}

/** Replenish a bait type by `n`, capped at BAIT.maxCount (never negative). The
 *  catch loop calls this to reward the caught species' diet bait. */
export function addBait(state: BaitState, id: BaitId, n: number): void {
  state.counts[id] = Math.min(BAIT.maxCount, Math.max(0, state.counts[id] + n));
}

/** Clear any active deployment immediately (e.g. the lure was "spent" on a
 *  successful catch, so it visibly disappears rather than lingering its window). */
export function clearActiveBait(state: BaitState): void {
  state.activeType = null;
  state.timer = 0;
}

/** Tick the active-bait timer; clears the deployment when it lapses. */
export function tickBait(state: BaitState, dt: number): void {
  if (state.activeType === null) return;
  state.timer -= dt;
  if (state.timer <= 0) {
    state.timer = 0;
    state.activeType = null;
  }
}

/** The active lure point + type, or null if no bait is active. */
export function activeLure(state: BaitState): { baitId: BaitId; x: number; y: number } | null {
  if (state.activeType === null || state.timer <= 0) return null;
  return { baitId: state.activeType, x: state.x, y: state.y };
}

/** Is the active bait the CORRECT bait for this species' diet? Drives the catch
 *  calm bonus. False if no bait is active or it's the wrong diet. */
export function isCorrectBaitFor(species: SpeciesDef, state: BaitState): boolean {
  return state.activeType !== null && state.timer > 0 && species.bait === state.activeType;
}
