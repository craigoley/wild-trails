import { describe, expect, it } from 'vitest';
import {
  biomeMatch,
  calmMultiplier,
  finalCatchChance,
  proximityMultiplier,
  resolveCatch,
  shakeCountForTier,
  type CatchContext,
} from '../Catch';
import { SPECIES, CATCH, BAIT, type BiomeId } from '../../utils/constants';
import { createRng } from '../../utils/rng';

const mouse = SPECIES.fieldmouse;

/** A baseline attempt: NET, point-blank, no bait, calm, home biome. */
function ctx(over: Partial<CatchContext> = {}): CatchContext {
  return { dist: 0, tool: 'net', biome: 'meadow', correctBait: false, fleeing: false, ...over };
}

describe('Catch — finalCatchChance composition', () => {
  it('always clamps to [0, 1]', () => {
    // Everything stacked beyond 1.
    const hi = finalCatchChance(mouse, ctx({ tool: 'tranq', correctBait: true }));
    expect(hi).toBe(1);
    // A deliberately tiny base can't go negative.
    const lo = finalCatchChance({ ...mouse, baseCatchRate: 0 }, ctx());
    expect(lo).toBe(0);
  });

  it('each factor moves the chance in the right direction', () => {
    const base = finalCatchChance(mouse, ctx());
    // Stronger tool -> higher (compare a low-base species so neither clamps).
    const weak = { ...mouse, baseCatchRate: 0.3 };
    expect(finalCatchChance(weak, ctx({ tool: 'tranq' }))).toBeGreaterThan(
      finalCatchChance(weak, ctx({ tool: 'net' })),
    );
    // Farther -> lower.
    expect(finalCatchChance(weak, ctx({ dist: CATCH.attemptRadius }))).toBeLessThan(
      finalCatchChance(weak, ctx({ dist: 0 })),
    );
    // Fleeing -> lower.
    expect(finalCatchChance(weak, ctx({ fleeing: true }))).toBeLessThan(
      finalCatchChance(weak, ctx({ fleeing: false })),
    );
    // Wrong biome -> lower.
    expect(finalCatchChance(weak, ctx({ biome: 'woodland' as BiomeId }))).toBeLessThan(
      finalCatchChance(weak, ctx({ biome: 'meadow' })),
    );
    // Correct bait -> higher.
    expect(finalCatchChance(weak, ctx({ correctBait: true }))).toBeGreaterThan(
      finalCatchChance(weak, ctx({ correctBait: false })),
    );
    expect(base).toBeGreaterThan(0);
  });

  it('correct bait + close + tranq stacks toward 1', () => {
    const v = finalCatchChance(mouse, ctx({ tool: 'tranq', correctBait: true, dist: 0 }));
    expect(v).toBeGreaterThan(0.95);
  });

  it('component curves: proximity, calm, biome', () => {
    expect(proximityMultiplier(0)).toBeCloseTo(CATCH.proximityMax, 10);
    expect(proximityMultiplier(CATCH.attemptRadius)).toBeCloseTo(CATCH.proximityMin, 10);
    expect(calmMultiplier(true, false)).toBeCloseTo(BAIT.correctCalm, 10);
    expect(calmMultiplier(false, true)).toBeCloseTo(CATCH.fleePenalty, 10);
    expect(calmMultiplier(false, false)).toBe(1);
    expect(biomeMatch(mouse, 'meadow')).toBe(CATCH.biomeMatchBonus);
    expect(biomeMatch(mouse, 'woodland')).toBe(CATCH.biomeMismatchPenalty);
  });
});

describe('Catch — resolveCatch outcomes', () => {
  const N = 20000;

  it('empirical catch rate tracks the chance (statistical)', () => {
    for (const chance of [0.3, 0.7]) {
      const rng = createRng(1234 + Math.round(chance * 100));
      let caught = 0;
      for (let i = 0; i < N; i++) if (resolveCatch(chance, 3, rng).caught) caught++;
      // The rare crit path nudges the rate slightly ABOVE chance; tolerance covers it.
      expect(caught / N).toBeGreaterThan(chance - 0.04);
      expect(caught / N).toBeLessThan(chance + 0.05);
    }
  });

  it('chance 0 never catches, chance 1 always catches', () => {
    const rng = createRng(5);
    for (let i = 0; i < 2000; i++) {
      expect(resolveCatch(0, 3, rng).caught).toBe(false);
      expect(resolveCatch(1, 3, rng).caught).toBe(true);
    }
  });

  it('shake sequence length is correct (caught = full, escape = ends at failure)', () => {
    const rng = createRng(99);
    let sawCaughtNormal = false;
    let sawEscapeNormal = false;
    for (let i = 0; i < 5000; i++) {
      const r = resolveCatch(0.5, 3, rng);
      if (r.critical) {
        expect(r.shakes).toHaveLength(1);
        continue;
      }
      if (r.caught) {
        expect(r.shakes).toHaveLength(3);
        expect(r.shakes.every((s) => s.passed)).toBe(true);
        sawCaughtNormal = true;
      } else {
        // Ends exactly at the first failed shake; all earlier shakes passed.
        expect(r.shakes.length).toBeGreaterThanOrEqual(1);
        expect(r.shakes.length).toBeLessThanOrEqual(3);
        expect(r.shakes[r.shakes.length - 1].passed).toBe(false);
        expect(r.shakes.slice(0, -1).every((s) => s.passed)).toBe(true);
        sawEscapeNormal = true;
      }
    }
    expect(sawCaughtNormal).toBe(true);
    expect(sawEscapeNormal).toBe(true);
  });

  it('shakeCountForTier reads the table (tier 1 -> 3 shakes)', () => {
    expect(shakeCountForTier(1)).toBe(CATCH.shakesByTier[0]);
    expect(shakeCountForTier(5)).toBe(CATCH.shakesByTier[4]);
  });
});

describe('Catch — critical path', () => {
  const N = 40000;

  it('fires at about its constant rate', () => {
    const rng = createRng(2024);
    let crits = 0;
    for (let i = 0; i < N; i++) if (resolveCatch(0.5, 3, rng).critical) crits++;
    expect(crits / N).toBeGreaterThan(CATCH.critChance - 0.01);
    expect(crits / N).toBeLessThan(CATCH.critChance + 0.01);
  });

  it('improves the odds: crit catches at the higher fourth-root rate', () => {
    const rng = createRng(31);
    const chance = 0.5;
    let critTotal = 0;
    let critCaught = 0;
    for (let i = 0; i < N; i++) {
      const r = resolveCatch(chance, 3, rng);
      if (r.critical) {
        critTotal++;
        if (r.caught) critCaught++;
      }
    }
    const critRate = critCaught / critTotal;
    const expected = Math.pow(chance, 1 / CATCH.critRoot); // ~0.84
    expect(critRate).toBeGreaterThan(chance + 0.1); // clearly better than the base
    expect(critRate).toBeGreaterThan(expected - 0.05);
    expect(critRate).toBeLessThan(expected + 0.05);
  });
});

describe('Catch — determinism', () => {
  it('same seed + same inputs => identical resolution', () => {
    const a = resolveCatch(0.6, 3, createRng(777));
    const b = resolveCatch(0.6, 3, createRng(777));
    expect(b).toEqual(a);
  });

  it('different seeds can diverge', () => {
    const seqs = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5]) {
      seqs.add(JSON.stringify(resolveCatch(0.5, 3, createRng(seed))));
    }
    expect(seqs.size).toBeGreaterThan(1);
  });
});
