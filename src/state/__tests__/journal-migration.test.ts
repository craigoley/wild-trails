import { describe, expect, it } from 'vitest';
import { createJournal, JOURNAL_SCHEMA_VERSION, migrate } from '../Journal';
import { BAIT } from '../../utils/constants';

/**
 * The load-bearing persistence proof: the fleet's real-data migrations. Old stores
 * UPGRADE step by step (v1 -> v2 -> v3 -> v4) and lose NOTHING. v3 added durable
 * bait; v4 (Plan #10) adds the `won` flag. This pins the full chain + sanitize.
 */
const FULL_BAIT = { seeds: BAIT.startingCount, greens: BAIT.startingCount, insects: BAIT.startingCount };

describe('Journal — schema version', () => {
  it('is now 4', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(4);
    expect(createJournal().schemaVersion).toBe(4);
    expect(createJournal().bait).toEqual(FULL_BAIT);
    expect(createJournal().won).toBe(false); // a fresh journal hasn't won yet
  });
});

describe('Journal — v1 -> v4 chain (species only, flows through every hop)', () => {
  it('preserves every caught species and adds all newer fields at safe defaults', () => {
    const v1Store = {
      schemaVersion: 1,
      species: {
        fieldmouse: { caught: true, catchCount: 3, firstCaughtAt: 1000 },
        hedgehog: { caught: true, catchCount: 1, firstCaughtAt: 2000 },
      },
    };
    const out = migrate(v1Store);

    expect(out.schemaVersion).toBe(4); // v1 -> v2 -> v3 -> v4
    expect(out.species.fieldmouse).toEqual({ caught: true, catchCount: 3, firstCaughtAt: 1000 });
    expect(out.species.hedgehog).toEqual({ caught: true, catchCount: 1, firstCaughtAt: 2000 });
    expect(out.missions).toEqual({});
    expect(out.rankPoints).toBe(0);
    expect(out.unlockedBiomes).toEqual([]);
    expect(out.bait).toEqual(FULL_BAIT);
    expect(out.won).toBe(false);
  });
});

describe('Journal — v2 -> v4 (keeps all v2 data, adds bait + won at defaults)', () => {
  it('preserves species/missions/rank/unlocks', () => {
    const v2Store = {
      schemaVersion: 2,
      species: { rabbit: { caught: true, catchCount: 2, firstCaughtAt: 5 } },
      missions: { 'meadow-survey': { progress: 4, completed: true } },
      rankPoints: 30,
      unlockedBiomes: ['woodland'],
    };
    const out = migrate(v2Store);

    expect(out.schemaVersion).toBe(4);
    expect(out.species.rabbit).toEqual({ caught: true, catchCount: 2, firstCaughtAt: 5 });
    expect(out.missions['meadow-survey']).toEqual({ progress: 4, completed: true });
    expect(out.rankPoints).toBe(30);
    expect(out.unlockedBiomes).toEqual(['woodland']);
    expect(out.bait).toEqual(FULL_BAIT);
    expect(out.won).toBe(false);
  });
});

describe('Journal — v3 -> v4 (the new hop: add the win flag, keep all v3 data)', () => {
  it('preserves bait/species/progress and adds won:false', () => {
    const v3Store = {
      schemaVersion: 3,
      species: { rabbit: { caught: true, catchCount: 2, firstCaughtAt: 5 } },
      missions: { 'meadow-survey': { progress: 4, completed: true } },
      rankPoints: 30,
      unlockedBiomes: ['woodland'],
      bait: { seeds: 2, greens: 5, insects: 9 },
    };
    const out = migrate(v3Store);

    expect(out.schemaVersion).toBe(4);
    expect(out.bait).toEqual({ seeds: 2, greens: 5, insects: 9 }); // v3 data kept
    expect(out.species.rabbit).toBeDefined();
    expect(out.won).toBe(false); // an existing player hasn't been celebrated yet
  });
});

describe('Journal — a current v4 store round-trips exactly (incl. a WON save)', () => {
  it('keeps won:true through a round-trip (no reset post-win)', () => {
    const v4Store = {
      schemaVersion: 4,
      species: { rabbit: { caught: true, catchCount: 2, firstCaughtAt: 5 } },
      missions: { 'meadow-survey': { progress: 4, completed: true } },
      rankPoints: 30,
      unlockedBiomes: ['woodland'],
      bait: { seeds: 2, greens: 5, insects: 9 },
      won: true,
    };
    expect(migrate(v4Store)).toEqual(v4Store);
  });
});

describe('Journal — sanitize (bad bait -> startingCount; bad won -> false)', () => {
  const base = { schemaVersion: 4, species: {}, missions: {}, rankPoints: 0, unlockedBiomes: [] };

  it('falls back bad bait values to startingCount and clamps over-cap to maxCount', () => {
    const out = migrate({ ...base, bait: { seeds: -3, greens: 'x', insects: 999 }, won: false });
    expect(out.bait.seeds).toBe(BAIT.startingCount);
    expect(out.bait.greens).toBe(BAIT.startingCount);
    expect(out.bait.insects).toBe(BAIT.maxCount);
  });

  it('a non-boolean / missing won sanitizes to false', () => {
    expect(migrate({ ...base, bait: FULL_BAIT, won: 'yes' }).won).toBe(false);
    expect(migrate({ ...base, bait: FULL_BAIT }).won).toBe(false);
  });

  it('a missing bait field entirely yields full default bait', () => {
    expect(migrate(base).bait).toEqual(FULL_BAIT);
  });
});

describe('Journal — corrupt / off-version resets to a fresh v4 store (no throw)', () => {
  it('handles garbage', () => {
    expect(migrate({ schemaVersion: 0, species: {} })).toEqual(createJournal());
    expect(migrate({ schemaVersion: 99 })).toEqual(createJournal());
    expect(migrate(null)).toEqual(createJournal());
    expect(migrate('garbage')).toEqual(createJournal());
  });

  it('drops malformed species/mission/unlock entries during migration', () => {
    const out = migrate({
      schemaVersion: 4,
      species: { good: { caught: true, catchCount: 1, firstCaughtAt: 1 }, bad: { x: 1 } },
      missions: { ok: { progress: 1, completed: false }, broken: { progress: 'no' } },
      rankPoints: -5,
      unlockedBiomes: ['woodland', 42, null],
      bait: FULL_BAIT,
      won: false,
    });
    expect(out.species.good).toBeDefined();
    expect(out.species.bad).toBeUndefined();
    expect(out.missions.ok).toBeDefined();
    expect(out.missions.broken).toBeUndefined();
    expect(out.rankPoints).toBe(0);
    expect(out.unlockedBiomes).toEqual(['woodland']);
  });
});
