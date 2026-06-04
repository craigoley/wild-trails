import { describe, expect, it } from 'vitest';
import {
  createJournal,
  isBiomeUnlockedInJournal,
  JOURNAL_SCHEMA_VERSION,
  migrate,
} from '../Journal';

/**
 * The load-bearing persistence proof: the fleet's FIRST real-data migration. A v1
 * store (caught species, no progression) loaded by v2 code must keep every caught
 * species and gain empty mission/rank/unlock state — NO data loss.
 */
describe('Journal — v1 -> v2 migration (no data loss)', () => {
  it('schema version is now 2', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(2);
    expect(createJournal().schemaVersion).toBe(2);
  });

  it('preserves caught species and adds empty progression at v2 defaults', () => {
    // A real v1 store: only schemaVersion + species (no mission/rank/unlock fields).
    const v1Store = {
      schemaVersion: 1,
      species: {
        fieldmouse: { caught: true, catchCount: 3, firstCaughtAt: 1000 },
        hedgehog: { caught: true, catchCount: 1, firstCaughtAt: 2000 },
      },
    };
    const out = migrate(v1Store);

    expect(out.schemaVersion).toBe(2);
    // Caught species — every one — survive intact.
    expect(out.species.fieldmouse).toEqual({ caught: true, catchCount: 3, firstCaughtAt: 1000 });
    expect(out.species.hedgehog).toEqual({ caught: true, catchCount: 1, firstCaughtAt: 2000 });
    // New progression state at safe defaults.
    expect(out.missions).toEqual({});
    expect(out.rankPoints).toBe(0);
    expect(out.unlockedBiomes).toEqual([]);
  });

  it('a current (v2) store round-trips its progression fields', () => {
    const v2Store = {
      schemaVersion: 2,
      species: { rabbit: { caught: true, catchCount: 2, firstCaughtAt: 5 } },
      missions: { meadowSurvey: { progress: 4, completed: true } },
      rankPoints: 30,
      unlockedBiomes: ['woodland'],
    };
    const out = migrate(v2Store);
    expect(out).toEqual(v2Store);
    expect(isBiomeUnlockedInJournal(out, 'woodland')).toBe(true);
  });

  it('an off-version / garbage store resets to a fresh v2 store (no throw)', () => {
    expect(migrate({ schemaVersion: 0, species: {} })).toEqual(createJournal());
    expect(migrate({ schemaVersion: 99 })).toEqual(createJournal());
    expect(migrate(null)).toEqual(createJournal());
    expect(migrate('garbage')).toEqual(createJournal());
  });

  it('drops malformed mission/species/unlock entries during migration', () => {
    const out = migrate({
      schemaVersion: 2,
      species: { good: { caught: true, catchCount: 1, firstCaughtAt: 1 }, bad: { x: 1 } },
      missions: { ok: { progress: 1, completed: false }, broken: { progress: 'no' } },
      rankPoints: -5, // invalid -> clamped to 0
      unlockedBiomes: ['woodland', 42, null],
    });
    expect(out.species.good).toBeDefined();
    expect(out.species.bad).toBeUndefined();
    expect(out.missions.ok).toBeDefined();
    expect(out.missions.broken).toBeUndefined();
    expect(out.rankPoints).toBe(0);
    expect(out.unlockedBiomes).toEqual(['woodland']); // non-strings dropped
  });
});
