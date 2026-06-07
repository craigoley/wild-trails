import { describe, expect, it } from 'vitest';
import { createJournal, JOURNAL_SCHEMA_VERSION, migrate } from '../Journal';
import { BAIT } from '../../utils/constants';

/**
 * The load-bearing persistence proof: the fleet's real-data migrations. Old stores
 * UPGRADE step by step (v1 -> ... -> v7) and lose NOTHING. v3 added durable bait; v4 the
 * `won` flag; v5 (§12) `credits`; v6 (Nets & Gear) the owned/active nets; v7 (§4.1.4
 * Research Spine) the research map. This pins the full chain + the v6->v7 hop + sanitize.
 */
const FULL_BAIT = { seeds: BAIT.startingCount, greens: BAIT.startingCount, insects: BAIT.startingCount };

describe('Journal — schema version', () => {
  it('is now 7, and a fresh journal has an empty research map', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(7);
    expect(createJournal().schemaVersion).toBe(7);
    expect(createJournal().bait).toEqual(FULL_BAIT);
    expect(createJournal().won).toBe(false);
    expect(createJournal().credits).toBe(0);
    expect(createJournal().ownedTools).toEqual(['net']);
    expect(createJournal().activeTool).toBe('net');
    expect(createJournal().research).toEqual({}); // research is opt-in — nothing started
  });
});

describe('Journal — v1 -> v7 chain (species only, flows through every hop)', () => {
  it('preserves every caught species and adds all newer fields at safe defaults', () => {
    const v1Store = {
      schemaVersion: 1,
      species: {
        fieldmouse: { caught: true, catchCount: 3, firstCaughtAt: 1000 },
        hedgehog: { caught: true, catchCount: 1, firstCaughtAt: 2000 },
      },
    };
    const out = migrate(v1Store);

    expect(out.schemaVersion).toBe(7); // v1 -> v2 -> v3 -> v4 -> v5 -> v6 -> v7
    expect(out.species.fieldmouse).toEqual({ caught: true, catchCount: 3, firstCaughtAt: 1000 });
    expect(out.species.hedgehog).toEqual({ caught: true, catchCount: 1, firstCaughtAt: 2000 });
    expect(out.missions).toEqual({});
    expect(out.rankPoints).toBe(0);
    expect(out.unlockedBiomes).toEqual([]);
    expect(out.bait).toEqual(FULL_BAIT);
    expect(out.won).toBe(false);
    expect(out.credits).toBe(0);
    expect(out.ownedTools).toEqual(['net']);
    expect(out.activeTool).toBe('net');
    expect(out.research).toEqual({}); // the new v7 field, default
  });
});

describe('Journal — v6 -> v7 (the new hop: add empty research, keep ALL v6 data)', () => {
  it('preserves species/nets/credits/won and adds research at its empty default', () => {
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
    const out = migrate(v6Store);

    expect(out.schemaVersion).toBe(7);
    expect(out.bait).toEqual({ seeds: 2, greens: 5, insects: 9 }); // all v3-v6 data kept
    expect(out.species.rabbit).toBeDefined();
    expect(out.rankPoints).toBe(30);
    expect(out.won).toBe(true);
    expect(out.credits).toBe(42);
    expect(out.ownedTools).toEqual(['net']);
    expect(out.research).toEqual({}); // a returning player has started no research
  });
});

describe('Journal — a current v7 store round-trips exactly', () => {
  it('keeps credits + won + nets + research through a round-trip', () => {
    const v7Store = {
      schemaVersion: 7,
      species: { rabbit: { caught: true, catchCount: 2, firstCaughtAt: 5 } },
      missions: { 'meadow-survey': { progress: 4, completed: true } },
      rankPoints: 30,
      unlockedBiomes: ['woodland'],
      bait: { seeds: 2, greens: 5, insects: 9 },
      won: true,
      credits: 42,
      ownedTools: ['net'],
      activeTool: 'net',
      research: { 'study-hedgehog': { started: true, progress: 2, completed: false } },
    };
    expect(migrate(v7Store)).toEqual(v7Store);
  });
});

describe('Journal — sanitize (bad bait/won/credits/nets/research -> safe defaults)', () => {
  const base = { schemaVersion: 7, species: {}, missions: {}, rankPoints: 0, unlockedBiomes: [] };

  it('falls back bad bait values to startingCount and clamps over-cap to maxCount', () => {
    const out = migrate({ ...base, bait: { seeds: -3, greens: 'x', insects: 999 }, won: false, credits: 0 });
    expect(out.bait.seeds).toBe(BAIT.startingCount);
    expect(out.bait.greens).toBe(BAIT.startingCount);
    expect(out.bait.insects).toBe(BAIT.maxCount);
  });

  it('bad/missing credits sanitize to 0; a valid value is kept (floored, never negative)', () => {
    expect(migrate({ ...base, bait: FULL_BAIT, credits: -5 }).credits).toBe(0);
    expect(migrate({ ...base, bait: FULL_BAIT }).credits).toBe(0); // missing
    expect(migrate({ ...base, bait: FULL_BAIT, credits: 17 }).credits).toBe(17);
    expect(migrate({ ...base, bait: FULL_BAIT, credits: 4.8 }).credits).toBe(4); // floored
  });

  it('the net inventory sanitizes: unknown ids dropped, starter always owned, active clamped', () => {
    const a = migrate({ ...base, bait: FULL_BAIT, ownedTools: ['ghost-net', 'net'], activeTool: 'net' });
    expect(a.ownedTools).toEqual(['net']);
    const b = migrate({ ...base, bait: FULL_BAIT, ownedTools: ['net'], activeTool: 'ghost-net' });
    expect(b.activeTool).toBe('net');
    const c = migrate({ ...base, bait: FULL_BAIT });
    expect(c.ownedTools).toEqual(['net']);
    expect(c.activeTool).toBe('net');
  });

  it('the research map sanitizes: well-formed entries kept (progress clamped), malformed dropped, missing -> {}', () => {
    const out = migrate({
      ...base,
      bait: FULL_BAIT,
      research: {
        good: { started: true, progress: 2, completed: false },
        negative: { started: true, progress: -4, completed: false }, // progress clamped to 0
        bad: { started: 'yes', progress: 1 }, // malformed -> dropped
      },
    });
    expect(out.research.good).toEqual({ started: true, progress: 2, completed: false });
    expect(out.research.negative.progress).toBe(0);
    expect(out.research.bad).toBeUndefined();
    expect(migrate({ ...base, bait: FULL_BAIT }).research).toEqual({}); // missing -> empty
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
      schemaVersion: 7,
      species: { good: { caught: true, catchCount: 1, firstCaughtAt: 1 }, bad: { x: 1 } },
      missions: { ok: { progress: 1, completed: false }, broken: { progress: 'no' } },
      rankPoints: -5,
      unlockedBiomes: ['woodland', 42, null],
      bait: FULL_BAIT,
      won: false,
      credits: 0,
      ownedTools: ['net'],
      activeTool: 'net',
      research: {},
    });
    expect(out.species.good).toBeDefined();
    expect(out.species.bad).toBeUndefined();
    expect(out.missions.ok).toBeDefined();
    expect(out.missions.broken).toBeUndefined();
    expect(out.rankPoints).toBe(0);
    expect(out.unlockedBiomes).toEqual(['woodland']);
  });
});
