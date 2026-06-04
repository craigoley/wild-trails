/**
 * Catch DIAGNOSTICS — Plan #12 (read-only instrumentation, no difficulty change).
 *
 * "Bait and catch work too well" has three candidate causes that need OPPOSITE
 * fixes; this module gives the ?debug funnel the counters to tell them apart:
 *   (a) baseCatchRate too HIGH   -> high success rate + catches land BAIT-OFF
 *   (b) bait too ABUNDANT/cheap  -> calm factor ~always maxed, catches BAIT-ON
 *   (c) catch too cheap to spam  -> many presses per target, low per-press rate
 *
 * PURE: no DOM, no Math.random. It OBSERVES Catch.ts's outputs by recomputing the
 * multiplier breakdown from the SAME exported factor functions (Catch.ts +
 * Encounter.ts are untouched). `breakdownChance` re-multiplies them and is pinned
 * by a test to equal `finalCatchChance` for the same context — so the diagnostic
 * can never silently drift from the real math.
 */

import { biomeMatch, calmMultiplier, proximityMultiplier } from './Catch';
import { toolMultiplier } from './Tools';
import { clamp } from '../utils/math';
import type { BiomeId, SpeciesDef, ToolId } from '../utils/constants';

/** The five independent factors that compose a catch chance. */
export interface CatchBreakdown {
  base: number;
  tool: number;
  proximity: number;
  calm: number;
  biome: number;
}

/** Everything needed to recompute the breakdown for one attempt (the same inputs
 *  Catch.finalCatchChance consumes). */
export interface BreakdownContext {
  species: SpeciesDef;
  dist: number;
  tool: ToolId;
  biome: BiomeId;
  correctBait: boolean;
  fleeing: boolean;
}

/** The session-only diagnostic counters (no persistence). */
export interface DiagnosticCounters {
  /** Successful catches WITH / WITHOUT the correct bait active (cause a vs b). */
  caughtBaitOn: number;
  caughtBaitOff: number;
  /** The most recent attempt's factor breakdown (live), + a running average over
   *  all attempts (which factor dominates — calm always ~maxed => cause b). */
  lastBreakdown: CatchBreakdown;
  avgBreakdown: CatchBreakdown;
  /** Consecutive catch presses on the SAME target before a catch closes it, +
   *  the session max (high => spam-viable => cause c). */
  attemptsThisTarget: number;
  maxAttemptsPerTarget: number;
  /** Deploys blocked because the selected bait was empty (bait scarcity signal). */
  outOfBaitDeploys: number;
  /** Internal: the last attempt's animal index (chains attemptsThisTarget) and
   *  whether its bait was correct (read when the catch resolves). */
  lastAttemptAnimal: number;
  lastAttemptBait: boolean;
}

const zeroBreakdown = (): CatchBreakdown => ({ base: 0, tool: 0, proximity: 0, calm: 0, biome: 0 });

export function createDiagnostics(): DiagnosticCounters {
  return {
    caughtBaitOn: 0,
    caughtBaitOff: 0,
    lastBreakdown: zeroBreakdown(),
    avgBreakdown: zeroBreakdown(),
    attemptsThisTarget: 0,
    maxAttemptsPerTarget: 0,
    outOfBaitDeploys: 0,
    lastAttemptAnimal: -1,
    lastAttemptBait: false,
  };
}

/** Recompute the breakdown via Catch.ts's exported factor functions (read-only). */
export function computeBreakdown(ctx: BreakdownContext): CatchBreakdown {
  return {
    base: ctx.species.baseCatchRate,
    tool: toolMultiplier(ctx.tool),
    proximity: proximityMultiplier(ctx.dist),
    calm: calmMultiplier(ctx.correctBait, ctx.fleeing),
    biome: biomeMatch(ctx.species, ctx.biome),
  };
}

/** The clamped product of the breakdown — pinned by test to equal finalCatchChance. */
export function breakdownChance(b: CatchBreakdown): number {
  return clamp(b.base * b.tool * b.proximity * b.calm * b.biome, 0, 1);
}

/** Fold one sample into a running mean (n = count INCLUDING this sample). */
export function accumulateAvg(avg: CatchBreakdown, sample: CatchBreakdown, n: number): CatchBreakdown {
  const f = (a: number, s: number): number => a + (s - a) / n;
  return {
    base: f(avg.base, sample.base),
    tool: f(avg.tool, sample.tool),
    proximity: f(avg.proximity, sample.proximity),
    calm: f(avg.calm, sample.calm),
    biome: f(avg.biome, sample.biome),
  };
}

/**
 * Record one catch ATTEMPT: store its breakdown + bait, fold the running average,
 * and advance the per-target chain (same animal as last attempt => +1, else reset
 * to 1). `attemptCount` is the cumulative attempt number incl. this one (for the
 * average).
 */
export function recordAttempt(
  d: DiagnosticCounters,
  animalIndex: number,
  breakdown: CatchBreakdown,
  correctBait: boolean,
  attemptCount: number,
): void {
  d.lastBreakdown = breakdown;
  d.lastAttemptBait = correctBait;
  d.avgBreakdown = accumulateAvg(d.avgBreakdown, breakdown, attemptCount);
  if (animalIndex === d.lastAttemptAnimal) d.attemptsThisTarget += 1;
  else {
    d.attemptsThisTarget = 1;
    d.lastAttemptAnimal = animalIndex;
  }
  if (d.attemptsThisTarget > d.maxAttemptsPerTarget) d.maxAttemptsPerTarget = d.attemptsThisTarget;
}

/** Record a SUCCESSFUL catch: bucket bait-on/off and close the per-target chain
 *  (the next attempt — possibly on a reused pool index — starts fresh). */
export function recordCatchSuccess(d: DiagnosticCounters): void {
  if (d.lastAttemptBait) d.caughtBaitOn += 1;
  else d.caughtBaitOff += 1;
  d.lastAttemptAnimal = -1;
}

/** Record a deploy blocked for lack of the selected bait. */
export function recordOutOfBait(d: DiagnosticCounters): void {
  d.outOfBaitDeploys += 1;
}

/** Per-attempt success rate (derived; 0 with no attempts). */
export function catchSuccessRate(caught: number, attempts: number): number {
  return attempts > 0 ? caught / attempts : 0;
}
