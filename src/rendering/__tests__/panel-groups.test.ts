import { describe, expect, it } from 'vitest';
import { groupMissions } from '../missionGroups';
import { groupSpeciesByBiome } from '../journalGroups';
import { createJournal, recordCatch, foundCount } from '../../state/Journal';
import { BIOME_ORDER, MISSION_ORDER, SPECIES_ORDER } from '../../utils/constants';

describe('groupMissions — Active vs Completed (pure)', () => {
  it('splits by completed-state, preserving MISSION_ORDER; every mission appears once', () => {
    const j = createJournal();
    j.missions['meadow-survey'] = { progress: 5, completed: true };
    j.missions['woodland-survey'] = { progress: 2, completed: false };
    const g = groupMissions(j);
    expect(g.completed).toContain('meadow-survey');
    expect(g.active).toContain('woodland-survey');
    // Every mission in exactly one group; nothing dropped or duplicated.
    expect(g.active.length + g.completed.length).toBe(MISSION_ORDER.length);
    expect([...g.active, ...g.completed].sort()).toEqual([...MISSION_ORDER].sort());
    // Order preserved within each group.
    expect(g.active).toEqual(MISSION_ORDER.filter((id) => g.active.includes(id)));
  });

  it('handles the standalone tracking mission like any other (shown in a group)', () => {
    const g = groupMissions(createJournal());
    expect([...g.active, ...g.completed]).toContain('track-badger');
  });

  it('a fresh journal -> all Active, Completed empty (the empty-section case)', () => {
    const g = groupMissions(createJournal());
    expect(g.completed).toEqual([]);
    expect(g.active).toEqual([...MISSION_ORDER]);
  });
});

describe('groupSpeciesByBiome — by biome in world order (pure)', () => {
  it('groups in BIOME_ORDER with correct per-biome found/total', () => {
    const j = createJournal();
    recordCatch(j, 'redsquirrel', 1);
    recordCatch(j, 'robin', 1); // 2 of the 4 woodland species
    const groups = groupSpeciesByBiome(j);
    expect(groups.map((g) => g.biome)).toEqual([...BIOME_ORDER]);

    const wood = groups.find((g) => g.biome === 'woodland')!;
    expect([wood.found, wood.total]).toEqual([2, 4]);
    const hi = groups.find((g) => g.biome === 'highlands')!;
    expect([hi.found, hi.total]).toEqual([0, 3]);
  });

  it('per-biome totals sum to the roster (13); found sums to foundCount', () => {
    const j = createJournal();
    recordCatch(j, 'fieldmouse', 1);
    recordCatch(j, 'mallard', 1);
    const groups = groupSpeciesByBiome(j);
    expect(groups.reduce((s, g) => s + g.total, 0)).toBe(SPECIES_ORDER.length); // 13
    expect(groups.reduce((s, g) => s + g.found, 0)).toBe(foundCount(j)); // 2
  });

  it('marks unlock state: Meadow always unlocked; un-earned biomes locked', () => {
    const groups = groupSpeciesByBiome(createJournal());
    expect(groups.find((g) => g.biome === 'meadow')!.unlocked).toBe(true);
    expect(groups.find((g) => g.biome === 'highlands')!.unlocked).toBe(false);
  });
});
