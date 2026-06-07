import { describe, expect, it } from 'vitest';
import { createJournal, JOURNAL_SCHEMA_VERSION, migrate } from '../Journal';
import { BAIT } from '../../utils/constants';

/**
 * The load-bearing persistence proof: the fleet's real-data migrations. Old stores
 * UPGRADE step by step (v1 -> v2 -> v3 -> v4 -> v5 -> v6) and lose NOTHING. v3 added
 * durable bait; v4 added the `won` flag; v5 (§12) added `credits`; v6 (Nets & Gear)
 * adds the owned/active catch nets. This pins the full chain + the v5->v6 hop + sanitize.
 */
const FULL_BAIT = { seeds: BAIT.startingCount, greens: BAIT.startingCount, insects: BAIT.startingCount };

describe('Journal — schema version', () => {
  it('is now 6, and a fresh journal owns + equips exactly the starter net', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(6);
    expect(createJournal().schemaVersion).toBe(6);
    expect(createJournal().bait).toEqual(FULL_BAIT);
    expect(createJournal().won).toBe(false);
    expect(createJournal().credits).toBe(0);
    expect(createJournal().ownedTools).toEqual(['net']);
    expect(createJournal().activeTool).toBe('net');
  });
});

describe('Journal — v1 -> v6 chain (species only, flows through every hop)', () => {
  it('preserves every caught species and adds all newer fields at safe defaults', () => {
    const v1Store = {
      schemaVersion: 1,
      species: {
        fieldmouse: { caught: true, catchCount: 3, firstCaughtAt: 1000 },
        hedgehog: { caught: true, catchCount: 1, firstCaughtAt: 2000 },
      },
    };
    const out = migrate(v1Store);

    expect(out.schemaVersion).toBe(6); // v1 -> v2 -> v3 -> v4 -> v5 -> v6
    expect(out.species.fieldmouse).toEqual({ caught: true, catchCount: 3, firstCaughtAt: 1000 });
    expect(out.species.hedgehog).toEqual({ caught: true, catchCount: 1, firstCaughtAt: 2000 });
    expect(out.missions).toEqual({});
    expect(out.rankPoints).toBe(0);
    expect(out.unlockedBiomes).toEqual([]);
    expect(out.bait).toEqual(FULL_BAIT);
    expect(out.won).toBe(false);
    expect(out.credits).toBe(0);
    expect(out.ownedTools).toEqual(['net']); // the new v6 fields, default
    expect(out.activeTool).toBe('net');
  });
});

describe('Journal — v2 -> v6 (keeps all v2 data, adds bait + won + credits + nets at defaults)', () => {
  it('preserves species/missions/rank/unlocks', () => {
    const v2Store = {
      schemaVersion: 2,
      species: { rabbit: { caught: true, catchCount: 2, firstCaughtAt: 5 } },
      missions: { 'meadow-survey': { progress: 4, completed: true } },
      rankPoints: 30,
      unlockedBiomes: ['woodland'],
    };
    const out = migrate(v2Store);

    expect(out.schemaVersion).toBe(6);
    expect(out.species.rabbit).toEqual({ caught: true, catchCount: 2, firstCaughtAt: 5 });
    expect(out.missions['meadow-survey']).toEqual({ progress: 4, completed: true });
    expect(out.rankPoints).toBe(30);
    expect(out.unlockedBiomes).toEqual(['woodland']);
    expect(out.bait).toEqual(FULL_BAIT);
    expect(out.won).toBe(false);
    expect(out.credits).toBe(0);
    expect(out.ownedTools).toEqual(['net']);
    expect(out.activeTool).toBe('net');
  });
});

describe('Journal — v5 -> v6 (the new hop: add the starter net, keep ALL v5 data)', () => {
  it('preserves bait/species/progress/rank/unlocks/won/credits and grants the starter net', () => {
    const v5Store = {
      schemaVersion: 5,
      species: { rabbit: { caught: true, catchCount: 2, firstCaughtAt: 5 } },
      missions: { 'meadow-survey': { progress: 4, completed: true } },
      rankPoints: 30,
      unlockedBiomes: ['woodland'],
      bait: { seeds: 2, greens: 5, insects: 9 },
      won: true,
      credits: 42,
    };
    const out = migrate(v5Store);

    expect(out.schemaVersion).toBe(6);
    expect(out.bait).toEqual({ seeds: 2, greens: 5, insects: 9 }); // v3/v4 data kept
    expect(out.species.rabbit).toBeDefined();
    expect(out.rankPoints).toBe(30);
    expect(out.unlockedBiomes).toEqual(['woodland']);
    expect(out.won).toBe(true); // win flag survives (no reset post-win)
    expect(out.credits).toBe(42); // §12 economy survives the hop
    expect(out.ownedTools).toEqual(['net']); // a returning player gets exactly today's net
    expect(out.activeTool).toBe('net');
  });
});

describe('Journal — a current v6 store round-trips exactly', () => {
  it('keeps credits + won + nets through a round-trip', () => {
    const v6Store = {
      schemaVersion: 6,
      species: { rabbit: { caught: true, catchCount: 2, firstCaughtAt: 5 } },
      missions: { 'meadow-survey': { progress: 4, completed: true } },
      rankPoints: 30,
      unlockedBiomes: ['woodland'],
      bait: { seeds: 2, greens: 5, insects: 9 },
      won: true,
      credits: 42,
      ownedTools: ['net'],
      activeTool: 'net',
    };
    expect(migrate(v6Store)).toEqual(v6Store);
  });
});

describe('Journal — sanitize (bad bait/won/credits/nets -> safe defaults)', () => {
  const base = { schemaVersion: 6, species: {}, missions: {}, rankPoints: 0, unlockedBiomes: [] };

  it('falls back bad bait values to startingCount and clamps over-cap to maxCount', () => {
    const out = migrate({ ...base, bait: { seeds: -3, greens: 'x', insects: 999 }, won: false, credits: 0 });
    expect(out.bait.seeds).toBe(BAIT.startingCount);
    expect(out.bait.greens).toBe(BAIT.startingCount);
    expect(out.bait.insects).toBe(BAIT.maxCount);
  });

  it('a non-boolean / missing won sanitizes to false', () => {
    expect(migrate({ ...base, bait: FULL_BAIT, won: 'yes', credits: 0 }).won).toBe(false);
    expect(migrate({ ...base, bait: FULL_BAIT }).won).toBe(false);
  });

  it('bad/missing credits sanitize to 0; a valid value is kept (floored, never negative)', () => {
    expect(migrate({ ...base, bait: FULL_BAIT, credits: -5 }).credits).toBe(0);
    expect(migrate({ ...base, bait: FULL_BAIT, credits: 'lots' }).credits).toBe(0);
    expect(migrate({ ...base, bait: FULL_BAIT }).credits).toBe(0); // missing
    expect(migrate({ ...base, bait: FULL_BAIT, credits: 17 }).credits).toBe(17);
    expect(migrate({ ...base, bait: FULL_BAIT, credits: 4.8 }).credits).toBe(4); // floored
  });

  it('the net inventory sanitizes: unknown ids dropped, starter always owned, active clamped', () => {
    // Unknown owned ids dropped, starter force-included.
    const a = migrate({ ...base, bait: FULL_BAIT, ownedTools: ['ghost-net', 'net'], activeTool: 'net' });
    expect(a.ownedTools).toEqual(['net']);
    // A non-owned / unknown active net clamps back to the starter.
    const b = migrate({ ...base, bait: FULL_BAIT, ownedTools: ['net'], activeTool: 'ghost-net' });
    expect(b.activeTool).toBe('net');
    // Missing fields default to the starter owned + equipped.
    const c = migrate({ ...base, bait: FULL_BAIT });
    expect(c.ownedTools).toEqual(['net']);
    expect(c.activeTool).toBe('net');
  });
});

describe('Journal — corrupt / off-version resets to a fresh store (no throw)', () => {
  it('handles garbage', () => {
    expect(migrate({ schemaVersion: 0, species: {} })).toEqual(createJournal());
    expect(migrate({ schemaVersion: 99 })).toEqual(createJournal());
    expect(migrate(null)).toEqual(createJournal());
    expect(migrate('garbage')).toEqual(createJournal());
  });

  it('drops malformed species/mission/unlock entries during migration', () => {
    const out = migrate({
      schemaVersion: 6,
      species: { good: { caught: true, catchCount: 1, firstCaughtAt: 1 }, bad: { x: 1 } },
      missions: { ok: { progress: 1, completed: false }, broken: { progress: 'no' } },
      rankPoints: -5,
      unlockedBiomes: ['woodland', 42, null],
      bait: FULL_BAIT,
      won: false,
      credits: 0,
      ownedTools: ['net'],
      activeTool: 'net',
    });
    expect(out.species.good).toBeDefined();
    expect(out.species.bad).toBeUndefined();
    expect(out.missions.ok).toBeDefined();
    expect(out.missions.broken).toBeUndefined();
    expect(out.rankPoints).toBe(0);
    expect(out.unlockedBiomes).toEqual(['woodland']);
  });
});
