import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createJournal,
  foundCount,
  isFound,
  JOURNAL_SCHEMA_VERSION,
  loadJournal,
  migrate,
  recordCatch,
  saveJournal,
  type Journal,
} from '../Journal';

afterEach(() => vi.unstubAllGlobals());

/** A Map-backed in-memory localStorage mock (the happy path). */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

describe('Journal — recording catches (pure)', () => {
  it('first catch of a species creates the entry (caught, count 1, firstCaughtAt set)', () => {
    const j = createJournal();
    recordCatch(j, 'fieldmouse', 1000);
    expect(j.species.fieldmouse).toEqual({ caught: true, catchCount: 1, firstCaughtAt: 1000 });
  });

  it('second+ catch increments catchCount and does NOT change firstCaughtAt', () => {
    const j = createJournal();
    recordCatch(j, 'rabbit', 5000); // first
    recordCatch(j, 'rabbit', 9999); // later — must not re-stamp the date
    recordCatch(j, 'rabbit', 12345);
    expect(j.species.rabbit.catchCount).toBe(3);
    expect(j.species.rabbit.firstCaughtAt).toBe(5000); // unchanged
  });

  it('isFound is true for a recorded species, false otherwise', () => {
    const j = createJournal();
    expect(isFound(j, 'quail')).toBe(false);
    recordCatch(j, 'quail', 1);
    expect(isFound(j, 'quail')).toBe(true);
    expect(isFound(j, 'hedgehog')).toBe(false);
  });

  it('foundCount equals the number of distinct caught species', () => {
    const j = createJournal();
    expect(foundCount(j)).toBe(0);
    recordCatch(j, 'fieldmouse', 1);
    recordCatch(j, 'fieldmouse', 2); // same species, still 1 found
    recordCatch(j, 'rabbit', 3);
    expect(foundCount(j)).toBe(2);
  });
});

describe('Journal — schema + migration', () => {
  it('a fresh journal carries the current schema version', () => {
    expect(createJournal().schemaVersion).toBe(JOURNAL_SCHEMA_VERSION);
  });

  it('migrate accepts a current-version payload (sanitized through)', () => {
    const payload = {
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      species: { fieldmouse: { caught: true, catchCount: 4, firstCaughtAt: 42 } },
    };
    const out = migrate(payload);
    expect(out.species.fieldmouse).toEqual({ caught: true, catchCount: 4, firstCaughtAt: 42 });
  });

  it('migration hook FIRES for an older/missing version — resets to a valid fresh store', () => {
    // Older version: nothing to migrate FROM in v1, so it routes to a fresh store.
    expect(migrate({ schemaVersion: 0, species: { x: { caught: true, catchCount: 1, firstCaughtAt: 1 } } }))
      .toEqual(createJournal());
    // Missing version entirely.
    expect(migrate({ species: {} })).toEqual(createJournal());
    // Garbage shapes don't crash; they reset.
    expect(migrate(null)).toEqual(createJournal());
    expect(migrate(42)).toEqual(createJournal());
  });

  it('drops malformed per-species records during migration', () => {
    const out = migrate({
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      species: {
        good: { caught: true, catchCount: 1, firstCaughtAt: 7 },
        bad: { catchCount: 'nope' }, // malformed -> dropped
      },
    });
    expect(out.species.good).toBeDefined();
    expect(out.species.bad).toBeUndefined();
  });
});

describe('Journal — persistence round-trip + failure modes', () => {
  it('write -> read round-trips with the schema intact', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const j: Journal = createJournal();
    recordCatch(j, 'fieldmouse', 111);
    recordCatch(j, 'hedgehog', 222);
    saveJournal(j);
    expect(loadJournal()).toEqual(j); // exact same store back out
  });

  it('CORRUPT stored JSON falls back to a fresh empty store (no throw)', () => {
    const corrupt = {
      getItem: () => 'not valid json {{{',
      setItem: () => undefined,
    } as unknown as Storage;
    vi.stubGlobal('localStorage', corrupt);
    expect(() => loadJournal()).not.toThrow();
    expect(loadJournal()).toEqual(createJournal());
  });

  it('PRIVATE-MODE setItem throw is swallowed — saveJournal is a no-op, no exception escapes', () => {
    let threwInternally = false;
    const throwing = {
      getItem: () => null,
      setItem: () => {
        threwInternally = true;
        throw new DOMException('QuotaExceededError'); // Safari private mode
      },
    } as unknown as Storage;
    vi.stubGlobal('localStorage', throwing);

    const j = createJournal();
    recordCatch(j, 'rabbit', 1); // in-memory journal still updates
    expect(() => saveJournal(j)).not.toThrow(); // the throw is contained
    expect(threwInternally).toBe(true); // we really did hit the throwing path
    expect(j.species.rabbit.catchCount).toBe(1); // in-memory store unaffected
  });

  it('a missing/undefined localStorage does not crash load', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => loadJournal()).not.toThrow();
    expect(loadJournal()).toEqual(createJournal());
  });
});

describe('Journal — catch tap (GameState exposes the caught species)', () => {
  it('a resolved catch sets lastCaughtSpecies, which records into the journal', async () => {
    const { createGameState, update } = await import('../../game/GameState');
    const { spawnAnimal } = await import('../../game/Animal');
    const { createIntent } = await import('../../game/Input');
    const { SIM_DT } = await import('../../utils/constants');

    const g = createGameState(7);
    for (const a of g.animals) a.active = false;
    g.spawnTimer = 1e9; // pause spawning
    spawnAnimal(g.animals, 'hedgehog', 0.5, 0); // baseRate 0.85 -> point-blank == 1 (always caught)

    update(g, { ...createIntent(), catchPressed: true }, SIM_DT); // start the encounter
    let caughtSpecies: string | null = null;
    for (let i = 0; i < 400 && g.encounter; i++) {
      update(g, createIntent(), SIM_DT);
      if (g.lastCaughtSpecies) caughtSpecies = g.lastCaughtSpecies; // one-shot, capture it
    }
    expect(caughtSpecies).toBe('hedgehog');

    // The boundary's record step then makes it a journal entry.
    const j = createJournal();
    recordCatch(j, caughtSpecies!, 1000);
    expect(isFound(j, 'hedgehog')).toBe(true);
  });
});
