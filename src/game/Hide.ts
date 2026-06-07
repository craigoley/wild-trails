/**
 * The portable HIDE (Nets & Gear slice C) — naturalist gear that lets the player make
 * COVER where there is none (the open Highlands especially). Deploy it at your position
 * and it acts exactly like a fixed hiding spot (the same STEALTH.coverFactor), so it's
 * LATERAL: cover where you CHOOSE it, never a catch-rate boost. The deployment is
 * TRANSIENT (re-placed each session) — owning the hide is baseline gear, so nothing new
 * persists. Pure (no three/DOM) — the renderer reads this; it never mutates it.
 */

import { HIDE } from '../utils/constants';

export interface HideState {
  /** Has the player deployed the hide this session? */
  deployed: boolean;
  /** Where it sits, world units (valid only while `deployed`). */
  x: number;
  y: number;
}

export function createHideState(): HideState {
  return { deployed: false, x: 0, y: 0 };
}

/** Plant the hide at (x, y) — typically the player's position. One hide at a time:
 *  re-deploying just moves it. */
export function deployHide(state: HideState, x: number, y: number): void {
  state.deployed = true;
  state.x = x;
  state.y = y;
}

/** Is (x, y) within the deployed hide's cover radius? (false if not deployed.) */
export function isUnderHide(state: HideState, x: number, y: number): boolean {
  return state.deployed && Math.hypot(x - state.x, y - state.y) <= HIDE.radius;
}
