import { describe, expect, it } from 'vitest';
import { unlockLines } from '../unlockLines';
import { createJournal } from '../../state/Journal';

const complete = (j: ReturnType<typeof createJournal>, ...ids: string[]) => {
  for (const id of ids) j.missions[id] = { progress: 99, completed: true };
};
const line = (j: ReturnType<typeof createJournal>, biome: string) =>
  unlockLines(j).find((l) => l.setBiome === biome)!;

describe('unlockLines — the set→biome-unlock legibility (pure, §17.1)', () => {
  it('emits one line per gating-set × successor in chain order (the Woodland FORKS to the Pine Forest)', () => {
    const lines = unlockLines(createJournal());
    // §4.2 — the Woodland now forks (Wetland + Pine Forest), so it emits TWO lines (both breadcrumbs).
    expect(lines.map((l) => l.setBiome)).toEqual(['meadow', 'woodland', 'woodland', 'wetland']);
    expect(lines.filter((l) => l.setBiome === 'woodland').map((l) => l.unlocks)).toEqual(['wetland', 'pineforest']);
    expect(line(createJournal(), 'meadow').unlocks).toBe('woodland');
    expect(line(createJournal(), 'meadow').unlocksName).toBe('Woodland');
    expect(line(createJournal(), 'woodland').unlocks).toBe('wetland'); // .find → the first (Wetland) arm
    expect(line(createJournal(), 'wetland').unlocks).toBe('highlands');
  });

  it('the terminal Highlands is NOT a gating set (no line); every emitted line unlocks something', () => {
    const lines = unlockLines(createJournal());
    expect(lines.some((l) => l.setBiome === 'highlands')).toBe(false);
    expect(lines.every((l) => l.unlocks !== null)).toBe(true);
  });

  it('in-progress: alreadyUnlocked=false with the live done/total', () => {
    const j = createJournal();
    const m = line(j, 'meadow');
    expect(m.alreadyUnlocked).toBe(false);
    expect([m.done, m.total]).toEqual([0, 3]);
  });

  it('count comes from the gating-set RULE, not a hardcode: Woodland is X of 4 (incl. track-badger)', () => {
    const j = createJournal();
    complete(j, 'woodland-survey', 'track-badger'); // 2 of the 4 gating woodland missions
    const w = line(j, 'woodland');
    expect(w.total).toBe(4); // survey + dawn + dusk + track-badger (now non-standalone)
    expect(w.done).toBe(2);
    expect(w.alreadyUnlocked).toBe(false);
  });

  it('already-unlocked via the earned flag → a quiet ✓ (alreadyUnlocked=true)', () => {
    const j = createJournal();
    j.unlockedBiomes = ['woodland'];
    expect(line(j, 'meadow').alreadyUnlocked).toBe(true);
  });

  it('already-unlocked via set-completion too (the same isBiomeSetComplete authority)', () => {
    const j = createJournal();
    complete(j, 'meadow-survey', 'meadow-dawn', 'meadow-dusk'); // the whole meadow set
    const m = line(j, 'meadow');
    expect(m.alreadyUnlocked).toBe(true);
    expect([m.done, m.total]).toEqual([3, 3]);
  });
});
