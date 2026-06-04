/**
 * The catch system — PURE, Node-testable, RNG passed IN (no Math.random). Two
 * halves:
 *
 *  (a) finalCatchChance(species, ctx): the [0,1] odds, composed from independent
 *      multipliers — tool, proximity, calm (bait + spooked), biome match — over
 *      the species' baseCatchRate. All curves/factors come from constants.
 *
 *  (b) resolveCatch(chance, shakeCount, rng): runs the multi-shake resolution and
 *      returns the FULL outcome SEQUENCE as DATA. Each shake is a check against
 *      chance^(1/shakeCount); the first failure breaks free, all passes catch.
 *      A rare critical path collapses to a single check at the better
 *      chance^(1/critRoot) odds. The renderer plays this data back beat by beat —
 *      so the animation reflects the REAL computed odds and is never faked.
 *
 * The two design axes stay independent: rarity (spawnWeight) lives in spawning;
 * catch DIFFICULTY (baseCatchRate + these modifiers) lives here.
 */

import { BAIT, CATCH, type BiomeId, type SpeciesDef } from '../utils/constants';
import { clamp, lerp } from '../utils/math';
import { toolMultiplier, type ToolId } from './Tools';
import type { Rng } from '../utils/rng';

/** Everything finalCatchChance needs about the moment of the attempt. */
export interface CatchContext {
  /** Distance from the player to the animal, world units. */
  dist: number;
  /** The tool in hand. */
  tool: ToolId;
  /** The biome the attempt happens in (for the home-biome match bonus). */
  biome: BiomeId;
  /** Is the species' CORRECT bait active on it (the calm bonus)? */
  correctBait: boolean;
  /** Is the animal fleeing/spooked (the calm penalty)? */
  fleeing: boolean;
}

/** Closer = better odds: lerp from proximityMax (point-blank) to proximityMin
 *  (at attemptRadius). */
export function proximityMultiplier(dist: number): number {
  const t = clamp(dist / CATCH.attemptRadius, 0, 1);
  return lerp(CATCH.proximityMax, CATCH.proximityMin, t);
}

/** Correct bait calms the animal (a big bonus); a fleeing animal is harder to
 *  catch (a penalty). Both feed the single "calm" factor. */
export function calmMultiplier(correctBait: boolean, fleeing: boolean): number {
  const baitFactor = correctBait ? BAIT.correctCalm : 1.0;
  const fleeFactor = fleeing ? CATCH.fleePenalty : 1.0;
  return baitFactor * fleeFactor;
}

/** Full odds in the home biome, a penalty out of it. */
export function biomeMatch(species: SpeciesDef, biome: BiomeId): number {
  return species.biome === biome ? CATCH.biomeMatchBonus : CATCH.biomeMismatchPenalty;
}

/** The composed [0,1] catch chance for this attempt. */
export function finalCatchChance(species: SpeciesDef, ctx: CatchContext): number {
  const chance =
    species.baseCatchRate *
    toolMultiplier(ctx.tool) *
    proximityMultiplier(ctx.dist) *
    calmMultiplier(ctx.correctBait, ctx.fleeing) *
    biomeMatch(species, ctx.biome);
  return clamp(chance, 0, 1);
}

/** One shake beat's result. */
export interface ShakeOutcome {
  passed: boolean;
}

/** The full resolution of a catch attempt — the DATA the renderer plays back. */
export interface CatchResolution {
  /** The [0,1] chance the resolution was rolled against. */
  chance: number;
  /** Per-shake results, in order. On an escape the sequence ends at the first
   *  failed shake; on a catch every shake passed. A critical catch is one shake. */
  shakes: ShakeOutcome[];
  caught: boolean;
  /** Whether the rare single-shake critical path fired. */
  critical: boolean;
}

/**
 * Resolve a catch attempt. `shakeCount` comes from the species tier. Each shake
 * passes with probability chance^(1/shakeCount), so all-pass probability equals
 * `chance` exactly — the multi-shake drama doesn't change the underlying odds, it
 * just spreads them across beats. With CATCH.critChance the attempt instead
 * collapses to a single check at the better chance^(1/critRoot) odds.
 *
 * Deterministic given `rng`: same seed + same inputs => identical resolution.
 */
export function resolveCatch(chance: number, shakeCount: number, rng: Rng): CatchResolution {
  const c = clamp(chance, 0, 1);

  // Rare critical path: one check at fourth-root odds (much easier) => instant.
  if (rng.next() < CATCH.critChance) {
    const per = Math.pow(c, 1 / CATCH.critRoot);
    const passed = rng.next() < per;
    return { chance: c, shakes: [{ passed }], caught: passed, critical: true };
  }

  const n = Math.max(1, shakeCount);
  const per = Math.pow(c, 1 / n);
  const shakes: ShakeOutcome[] = [];
  for (let i = 0; i < n; i++) {
    const passed = rng.next() < per;
    shakes.push({ passed });
    if (!passed) return { chance: c, shakes, caught: false, critical: false };
  }
  return { chance: c, shakes, caught: true, critical: false };
}

/** How many shakes a species' tier resolves over. */
export function shakeCountForTier(tier: number): number {
  const i = clamp(tier, 1, CATCH.shakesByTier.length) - 1;
  return CATCH.shakesByTier[i];
}
