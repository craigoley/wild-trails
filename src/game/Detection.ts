/**
 * Stealth + detection — PURE, Node-testable, ZERO three/DOM. The wariness layer
 * that lets the player REDUCE how soon an animal notices them, sitting strictly
 * ON TOP of the PR #4 detection values.
 *
 * The load-bearing invariant: `effectiveDetectionRadius(species, 1) ===
 * species.detectionRadius` for every species — with no cover and full-speed
 * movement the stealth factor is 1 and this layer is a no-op, so PR #4 behaviour
 * is reproduced exactly. Stealth only ever SHRINKS the radius (factors < 1).
 *
 * "Sneaking" is derived from the player's CURRENT speed — there is no separate
 * movement mode in the game (see PR #6 recon); a slow/partial-deflection or
 * standing-still player sneaks, a full-tilt one does not.
 */

import { STEALTH, TUNING, type SpeciesDef } from '../utils/constants';
import { clamp } from '../utils/math';
import type { PlayerState } from './Player';

/** Is the player moving slowly enough to count as sneaking? Pure read of the
 *  existing velocity vs maxSpeed — no new movement mode. */
export function isSneaking(player: PlayerState): boolean {
  const speed = Math.hypot(player.vx, player.vy);
  return speed <= TUNING.maxSpeed * STEALTH.sneakSpeedFrac;
}

/**
 * The player's stealth factor in [0,1]: the product of the active multipliers
 * (cover, sneaking), each < 1. 1 = fully visible (no cover, full speed) =
 * exact PR #4 behaviour. Always clamped to [0,1].
 */
export function computeStealthFactor(inCover: boolean, sneaking: boolean): number {
  let f = 1;
  if (inCover) f *= STEALTH.coverFactor;
  if (sneaking) f *= STEALTH.movementFactor;
  return clamp(f, 0, 1);
}

/**
 * A species' EFFECTIVE detection radius under a given stealth factor:
 * baseDetectionRadius * stealthFactor. `stealthFactor === 1` reproduces the base
 * radius exactly (the invariant); the factor is clamped to [0,1] so the result
 * is never negative and never larger than the base.
 */
export function effectiveDetectionRadius(species: SpeciesDef, stealthFactor: number): number {
  return species.detectionRadius * clamp(stealthFactor, 0, 1);
}
