import { describe, expect, it } from 'vitest';
import { createJournal, JOURNAL_SCHEMA_VERSION, migrate } from '../Journal';
import { BAIT } from '../../utils/constants';

/**
 * The load-bearing persistence proof: the fleet's real-data migrations. Old stores
 * UPGRADE step by step (v1 -> v2 -> v3) and lose NOTHING. v3 (Plan #13.3) adds
 * durable bait counts; this pins the full chain + the bait sanitize.
 */
const FULL_BAIT = { seeds: BAIT.startingCount, greens: BAIT.startingCount, insects: BAIT.startingCount };

describe('Journal — schema version', () => {
  it('is now 3', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(3);
    expect(createJournal().schemaVersion).toBe(3);
    expect(createJournal().bait).toEqual(FULL_BAIT); // a fresh journal starts with full bait
  });
});

describe('Journal — v1 -> v3 chain (species only, flows through v2)', () => {
  it('preserves every caught species and adds all newer fields at safe defaults', () => {
    // A real v1 store: ONLY schemaVersion + species (no progression, no bait).
    const v1Store = {
      schemaVersion: 1,
      species: {
        fieldmouse: { caught: true, catchCount: 3, firstCaughtAt: 1000 },
        hedgehog: { caught: true, catchCount: 1, firstCaughtAt: 2000 },
      },
    };
    const out = migrate(v1Store);

    expect(out.schemaVersion).toBe(3); // flowed v1 -> up_1to2 -> v2 -> up_2to3 -> v3
    // Caught species — every one — survive the whole chain intact.
    expect(out.species.fieldmouse).toEqual({ caught: true, catchCount: 3, firstCaughtAt: 1000 });
    expect(out.species.hedgehog).toEqual({ caught: true, catchCount: 1, firstCaughtAt: 2000 });
    // Everything added since v1 at safe defaults.
    expect(out.missions).toEqual({});
    expect(out.rankPoints).toBe(0);
    expect(out.unlockedBiomes).toEqual([]);
    expect(out.bait).toEqual(FULL_BAIT);
  });
});

describe('Journal — v2 -> v3 (the new hop: add bait, keep all v2 data)', () => {
  it('preserves species/missions/rank/unlocks and adds bait at the safe default', () => {
    // A real v2 store: progression present, NO bait field.
    const v2Store = {
      schemaVersion: 2,
      species: { rabbit: { caught: true, catchCount: 2, firstCaughtAt: 5 } },
      missions: { 'meadow-survey': { progress: 4, completed: true } },
      rankPoints: 30,
      unlockedBiomes: ['woodland'],
    };
    const out = migrate(v2Store);

    expect(out.schemaVersion).toBe(3);
    expect(out.species.rabbit).toEqual({ caught: true, catchCount: 2, firstCaughtAt: 5 });
    expect(out.missions['meadow-survey']).toEqual({ progress: 4, completed: true });
    expect(out.rankPoints).toBe(30);
    expect(out.unlockedBiomes).toEqual(['woodland']);
    expect(out.bait).toEqual(FULL_BAIT); // a v2 player isn't punished — full bait on upgrade
  });
});

describe('Journal — a current v3 store round-trips exactly', () => {
  it('keeps its persisted bait counts', () => {
    const v3Store = {
      schemaVersion: 3,
      species: { rabbit: { caught: true, catchCount: 2, firstCaughtAt: 5 } },
      missions: { 'meadow-survey': { progress: 4, completed: true } },
      rankPoints: 30,
      unlockedBiomes: ['woodland'],
      bait: { seeds: 2, greens: 5, insects: 9 },
    };
    expect(migrate(v3Store)).toEqual(v3Store);
  });
});

describe('Journal — bait sanitize (missing / negative / non-number -> startingCount)', () => {
  const base = { schemaVersion: 3, species: {}, missions: {}, rankPoints: 0, unlockedBiomes: [] };

  it('falls back bad values to startingCount and clamps over-cap to maxCount', () => {
    const out = migrate({ ...base, bait: { seeds: -3, greens: 'x', insects: 999 } });
    expect(out.bait.seeds).toBe(BAIT.startingCount); // negative -> default
    expect(out.bait.greens).toBe(BAIT.startingCount); // non-number -> default
    expect(out.bait.insects).toBe(BAIT.maxCount); // over cap -> clamped
  });

  it('fills missing keys with startingCount, keeps valid ones', () => {
    const out = migrate({ ...base, bait: { seeds: 3 } });
    expect(out.bait.seeds).toBe(3); // valid -> kept
    expect(out.bait.greens).toBe(BAIT.startingCount); // missing -> default
    expect(out.bait.insects).toBe(BAIT.startingCount);
  });

  it('a missing bait field entirely yields full default bait', () => {
    const out = migrate(base);
    expect(out.bait).toEqual(FULL_BAIT);
  });
});

describe('Journal — corrupt / off-version resets to a fresh v3 store (no throw)', () => {
  it('handles garbage', () => {
    expect(migrate({ schemaVersion: 0, species: {} })).toEqual(createJournal());
    expect(migrate({ schemaVersion: 99 })).toEqual(createJournal());
    expect(migrate(null)).toEqual(createJournal());
    expect(migrate('garbage')).toEqual(createJournal());
  });

  it('drops malformed species/mission/unlock entries during migration', () => {
    const out = migrate({
      schemaVersion: 3,
      species: { good: { caught: true, catchCount: 1, firstCaughtAt: 1 }, bad: { x: 1 } },
      missions: { ok: { progress: 1, completed: false }, broken: { progress: 'no' } },
      rankPoints: -5,
      unlockedBiomes: ['woodland', 42, null],
      bait: FULL_BAIT,
    });
    expect(out.species.good).toBeDefined();
    expect(out.species.bad).toBeUndefined();
    expect(out.missions.ok).toBeDefined();
    expect(out.missions.broken).toBeUndefined();
    expect(out.rankPoints).toBe(0);
    expect(out.unlockedBiomes).toEqual(['woodland']);
  });
});
