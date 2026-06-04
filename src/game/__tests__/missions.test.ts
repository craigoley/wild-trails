import { describe, expect, it } from 'vitest';
import {
  currentRank,
  evaluateCatch,
  isBiomeSetComplete,
  rankPointsTotal,
  type CatchEvent,
} from '../Missions';
import { unlockBiome, isUnlocked, clampToUnlocked, createWorld } from '../World';
import { createJournal } from '../../state/Journal';
import { MISSIONS, BIOMES } from '../../utils/constants';
import type { Vec2 } from '../../utils/math';

/** A meadow catch at a given phase. */
const ev = (phase: CatchEvent['phase'], biome: CatchEvent['biome'] = 'meadow'): CatchEvent => ({
  species: 'fieldmouse',
  biome,
  phase,
});

/** Fire the same event n times against a journal. */
function fire(journal: ReturnType<typeof createJournal>, e: CatchEvent, n: number) {
  let last;
  for (let i = 0; i < n; i++) last = evaluateCatch(journal, e);
  return last!;
}

describe('Missions — eval per requirement kind', () => {
  it('catch-in-biome progresses only on a matching biome', () => {
    const j = createJournal();
    evaluateCatch(j, ev('day', 'woodland')); // wrong biome -> no meadow-survey progress
    expect(j.missions['meadow-survey']?.progress ?? 0).toBe(0);
    evaluateCatch(j, ev('day', 'meadow')); // right biome
    expect(j.missions['meadow-survey'].progress).toBe(1);
  });

  it('catch-in-timephase progresses only at the matching phase', () => {
    const j = createJournal();
    evaluateCatch(j, ev('day')); // not dusk
    expect(j.missions['meadow-dusk']?.progress ?? 0).toBe(0);
    evaluateCatch(j, ev('dusk'));
    expect(j.missions['meadow-dusk'].progress).toBe(1);
  });

  it('completes a mission when its count is reached (and not before)', () => {
    const j = createJournal();
    const dusk = MISSIONS['meadow-dusk'].requirement.count; // 2
    fire(j, ev('dusk'), dusk - 1);
    expect(j.missions['meadow-dusk'].completed).toBe(false);
    const r = evaluateCatch(j, ev('dusk'));
    expect(j.missions['meadow-dusk'].completed).toBe(true);
    expect(r.completed).toContain('meadow-dusk');
    expect(r.pointsAwarded).toBe(MISSIONS['meadow-dusk'].rewardPoints);
  });

  it('one catch can progress multiple missions (survey + the phase mission)', () => {
    const j = createJournal();
    evaluateCatch(j, ev('dawn', 'meadow'));
    expect(j.missions['meadow-survey'].progress).toBe(1);
    expect(j.missions['meadow-dawn'].progress).toBe(1);
  });
});

describe('Missions — completion fires exactly once (double-fire guard)', () => {
  it('re-meeting a completed mission does not re-progress or re-award IT', () => {
    const j = createJournal();
    fire(j, ev('dusk'), MISSIONS['meadow-dusk'].requirement.count); // complete meadow-dusk
    const duskPoints = MISSIONS['meadow-dusk'].rewardPoints;
    expect(j.rankPoints).toBe(duskPoints);

    const r = evaluateCatch(j, ev('dusk')); // fire a dusk catch again
    // The completed mission is untouched (no re-progress, no re-award, not re-listed).
    expect(j.missions['meadow-dusk'].progress).toBe(MISSIONS['meadow-dusk'].requirement.count);
    expect(r.progressed).not.toContain('meadow-dusk');
    expect(r.completed).not.toContain('meadow-dusk');
    expect(j.rankPoints).toBe(duskPoints); // no extra dusk reward
    // (A meadow catch still legitimately progresses the incomplete survey mission.)
    expect(r.progressed).toContain('meadow-survey');
  });
});

describe('Missions — Woodland unlock end-to-end', () => {
  /** Complete the whole Meadow set and return the unlock-event result. */
  function completeMeadowSet(j: ReturnType<typeof createJournal>) {
    fire(j, ev('day', 'meadow'), MISSIONS['meadow-survey'].requirement.count); // survey
    fire(j, ev('dawn', 'meadow'), MISSIONS['meadow-dawn'].requirement.count); // dawn
    return fire(j, ev('dusk', 'meadow'), MISSIONS['meadow-dusk'].requirement.count); // dusk (last)
  }

  it('completing the Meadow set unlocks Woodland in the journal, exactly once', () => {
    const j = createJournal();
    const last = completeMeadowSet(j);
    expect(isBiomeSetComplete(j, 'meadow')).toBe(true);
    expect(j.unlockedBiomes).toContain('woodland');
    expect(last.unlocked).toContain('woodland');

    // Further catches don't re-unlock.
    const again = evaluateCatch(j, ev('dusk', 'meadow'));
    expect(again.unlocked).toEqual([]);
    expect(j.unlockedBiomes.filter((b) => b === 'woodland')).toHaveLength(1);
  });

  it('applying the unlock flips World.woodland and clampToUnlocked now permits it', () => {
    const j = createJournal();
    const world = createWorld();
    const wood = BIOMES.woodland.bounds;
    const px = (wood.minX + wood.maxX) / 2;
    const py = (wood.minY + wood.maxY) / 2; // deep in Woodland

    // Before: Woodland is locked, the point clamps OUT of it.
    expect(isUnlocked(world, 'woodland')).toBe(false);
    const out1: Vec2 = { x: 0, y: 0 };
    clampToUnlocked(world, px, py, 0.4, out1);
    expect(out1.y).toBeLessThan(wood.minY); // pulled back into the Meadow

    // Complete the set + apply the reward to the world (as main does).
    const last = completeMeadowSet(j);
    for (const id of last.unlocked) unlockBiome(world, id);

    expect(isUnlocked(world, 'woodland')).toBe(true);
    const out2: Vec2 = { x: 0, y: 0 };
    clampToUnlocked(world, px, py, 0.4, out2);
    expect(out2.x).toBeCloseTo(px, 6);
    expect(out2.y).toBeCloseTo(py, 6); // now permitted, unchanged
  });
});

describe('Missions — rank thresholds', () => {
  it('maps total points to the right rank at the boundaries', () => {
    const at = (points: number) => {
      const j = createJournal();
      j.rankPoints = points; // 0 species => total === rankPoints
      return currentRank(j).name;
    };
    expect(at(0)).toBe('Novice');
    expect(at(29)).toBe('Novice');
    expect(at(30)).toBe('Field Hand');
    expect(at(69)).toBe('Field Hand');
    expect(at(70)).toBe('Naturalist');
    expect(at(120)).toBe('Field Researcher');
  });

  it('found species add to the rank total (journal completion feeds rank)', () => {
    const j = createJournal();
    j.rankPoints = 20;
    j.species.fieldmouse = { caught: true, catchCount: 1, firstCaughtAt: 1 };
    j.species.rabbit = { caught: true, catchCount: 1, firstCaughtAt: 1 };
    expect(rankPointsTotal(j)).toBe(20 + 2 * 8); // perSpeciesFound = 8
  });
});

describe('Missions — telemetry deltas', () => {
  it('eval returns progressed/completed/unlocked deltas at the right stages', () => {
    const j = createJournal();
    const p1 = evaluateCatch(j, ev('dusk'));
    expect(p1.progressed).toContain('meadow-dusk');
    expect(p1.completed).toEqual([]); // count is 2, not done yet
    const p2 = evaluateCatch(j, ev('dusk'));
    expect(p2.completed).toContain('meadow-dusk');
  });
});
