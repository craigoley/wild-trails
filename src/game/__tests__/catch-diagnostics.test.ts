import { describe, expect, it } from 'vitest';
import {
  accumulateAvg,
  breakdownChance,
  catchSuccessRate,
  computeBreakdown,
  createDiagnostics,
  recordAttempt,
  recordCatchSuccess,
  recordOutOfBait,
  type CatchBreakdown,
} from '../catchDiagnostics';
import { finalCatchChance } from '../Catch';
import { getSpecies } from '../Species';
import type { BiomeId, ToolId } from '../../utils/constants';

const B = (over: Partial<CatchBreakdown> = {}): CatchBreakdown => ({
  base: 0.5,
  tool: 1,
  proximity: 1.2,
  calm: 1,
  biome: 1,
  ...over,
});

describe('catchDiagnostics — the recompute stays faithful to Catch.ts (the key test)', () => {
  // The whole diagnostic is only trustworthy if its recomputed product equals the
  // REAL chance for the same inputs. If Catch.ts ever changes, this fails first.
  const cases: { species: string; dist: number; tool: ToolId; biome: BiomeId; bait: boolean; flee: boolean }[] = [
    { species: 'fieldmouse', dist: 1.2, tool: 'net', biome: 'meadow', bait: true, flee: false },
    { species: 'fieldmouse', dist: 2.4, tool: 'net', biome: 'meadow', bait: false, flee: true },
    { species: 'robin', dist: 0.5, tool: 'net', biome: 'meadow', bait: false, flee: false }, // out of home biome
    { species: 'hedgehog', dist: 0, tool: 'net', biome: 'meadow', bait: true, flee: false }, // point-blank + bait => clamps to 1
  ];

  for (const c of cases) {
    it(`breakdown product == finalCatchChance for ${c.species} (bait:${c.bait} flee:${c.flee})`, () => {
      const species = getSpecies(c.species as Parameters<typeof getSpecies>[0]);
      const ctx = {
        dist: c.dist,
        tool: c.tool,
        biome: c.biome,
        correctBait: c.bait,
        fleeing: c.flee,
      };
      const real = finalCatchChance(species, ctx);
      const recomputed = breakdownChance(computeBreakdown({ species, ...ctx }));
      expect(recomputed).toBe(real); // exact — same factor functions, same order, same clamp
    });
  }
});

describe('catchDiagnostics — attempt counters + per-target chain (cause c)', () => {
  it('chains presses on the same animal, resets on a different one, tracks the max', () => {
    const d = createDiagnostics();
    recordAttempt(d, 3, B(), true, 1);
    expect(d.attemptsThisTarget).toBe(1);
    recordAttempt(d, 3, B(), true, 2); // same animal -> spam
    expect(d.attemptsThisTarget).toBe(2);
    recordAttempt(d, 3, B(), true, 3);
    expect(d.attemptsThisTarget).toBe(3);
    expect(d.maxAttemptsPerTarget).toBe(3);
    recordAttempt(d, 7, B(), true, 4); // different animal -> reset
    expect(d.attemptsThisTarget).toBe(1);
    expect(d.maxAttemptsPerTarget).toBe(3); // max retained
  });

  it('a catch CLOSES the chain so a reused pool index starts fresh', () => {
    const d = createDiagnostics();
    recordAttempt(d, 3, B(), false, 1);
    recordAttempt(d, 3, B(), false, 2);
    expect(d.attemptsThisTarget).toBe(2);
    recordCatchSuccess(d); // engagement over (animal despawned)
    recordAttempt(d, 3, B(), false, 3); // a NEW animal happens to reuse index 3
    expect(d.attemptsThisTarget).toBe(1); // not 3 — the chain was closed
  });
});

describe('catchDiagnostics — bait-on/off success (cause a vs b)', () => {
  it('buckets a success by whether the last attempt had the correct bait', () => {
    const d = createDiagnostics();
    recordAttempt(d, 1, B(), true, 1); // bait ON
    recordCatchSuccess(d);
    expect(d.caughtBaitOn).toBe(1);
    expect(d.caughtBaitOff).toBe(0);

    recordAttempt(d, 2, B(), false, 2); // bait OFF
    recordCatchSuccess(d);
    expect(d.caughtBaitOff).toBe(1);
    expect(d.caughtBaitOn).toBe(1);
  });
});

describe('catchDiagnostics — running average + derived rate + out-of-bait', () => {
  it('avgBreakdown is the running mean of the samples', () => {
    const d = createDiagnostics();
    recordAttempt(d, 1, B({ calm: 1 }), false, 1);
    recordAttempt(d, 2, B({ calm: 3.5 }), true, 2);
    expect(d.avgBreakdown.calm).toBeCloseTo((1 + 3.5) / 2, 6);
    expect(d.lastBreakdown.calm).toBe(3.5); // last sample
  });

  it('accumulateAvg folds a sample into the mean', () => {
    const mean = accumulateAvg(B({ base: 0.4 }), B({ base: 0.8 }), 2);
    expect(mean.base).toBeCloseTo(0.6, 6);
  });

  it('catchSuccessRate = caught/attempts, 0 with no attempts', () => {
    expect(catchSuccessRate(0, 0)).toBe(0);
    expect(catchSuccessRate(3, 6)).toBe(0.5);
  });

  it('recordOutOfBait counts blocked deploys', () => {
    const d = createDiagnostics();
    recordOutOfBait(d);
    recordOutOfBait(d);
    expect(d.outOfBaitDeploys).toBe(2);
  });
});
