import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAutosaver,
  createJournal,
  loadJournal,
  saveJournal,
  setBaitCounts,
  type Journal,
} from '../Journal';
import { createBaitState, restoreBaitCounts } from '../../game/Bait';
import { createGameState } from '../../game/GameState';

/** A Map-backed in-memory localStorage mock (matches Journal.test.ts). */
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

afterEach(() => vi.unstubAllGlobals());

describe('Bait round-trip — counts -> store -> parse -> rehydrate', () => {
  it('persists bait counts and restores them to the same values', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const j = createJournal();
    setBaitCounts(j, { seeds: 2, greens: 5, insects: 8 });
    saveJournal(j);

    const loaded = loadJournal();
    expect(loaded.bait).toEqual({ seeds: 2, greens: 5, insects: 8 });

    const bait = createBaitState(); // a fresh (full) bait state
    restoreBaitCounts(bait, loaded.bait);
    expect(bait.counts).toEqual({ seeds: 2, greens: 5, insects: 8 });
  });
});

describe('loadJournal — corrupt store degrades to a fresh v4 (no throw)', () => {
  it('returns a fresh v4 journal on unparseable JSON', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => 'not valid json {{{',
      setItem: () => undefined,
    });
    expect(() => loadJournal()).not.toThrow();
    const loaded = loadJournal();
    expect(loaded).toEqual(createJournal());
    expect(loaded.schemaVersion).toBe(4);
  });
});

describe('Rehydrate restores DURABLE bait but recomputes TRANSIENT world state', () => {
  it('only bait carries across; position/clock/biome are fresh from createGameState', () => {
    const journalBait = { seeds: 1, greens: 2, insects: 3 };
    const game = createGameState(123);
    restoreBaitCounts(game.bait, journalBait);

    // Durable — restored from the store.
    expect(game.bait.counts).toEqual(journalBait);
    // Transient — recomputed fresh (NOT persisted): entrance + fresh clock.
    expect(game.player.x).toBe(0);
    expect(game.player.y).toBe(0); // meadow entrance, not a saved position
    expect(game.timeSec).toBe(0); // fresh clock, not a saved time
    expect(game.currentBiome).toBe('meadow');
    expect(game.animals.some((a) => a.active)).toBe(false); // animals respawn fresh
  });
});

describe('Autosave — dedup guard', () => {
  it('writes on change, SKIPS an unchanged write, writes again after a change', () => {
    const writes: Journal[] = [];
    const autosave = createAutosaver((j) => void writes.push(structuredClone(j)));
    const j = createJournal();

    expect(autosave(j)).toBe(true); // first write
    expect(autosave(j)).toBe(false); // identical -> skipped (the dedup)
    expect(writes).toHaveLength(1);

    j.rankPoints = 10; // the store actually changed
    expect(autosave(j)).toBe(true);
    expect(writes).toHaveLength(2);
  });
});
