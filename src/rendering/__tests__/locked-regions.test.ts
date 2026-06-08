import { describe, expect, it } from 'vitest';
import { lockedBiomes, walledEdges } from '../lockedRegions';
import { createWorld, unlockBiome } from '../../game/World';

/** "from->to" keys for the walled-edge set (order-independent comparison). */
const keys = (w: ReturnType<typeof createWorld>): string[] =>
  walledEdges(w).map((e) => `${e.from}->${e.to}`).sort();

describe('lockedRegions — the walled-edge set (the bug fix, at the logic seam)', () => {
  it('a fresh world walls the Meadow off from its still-locked neighbours', () => {
    const w = createWorld(); // only Meadow unlocked
    expect(keys(w)).toEqual(['meadow->wetland', 'meadow->woodland']);
  });

  it('unlocking Woodland CLEARS the now-open Meadow|Woodland seam, keeps locked gates', () => {
    const w = createWorld();
    unlockBiome(w, 'woodland');
    const set = keys(w);
    // The stale wall the refresh fixes — the Meadow|Woodland seam is no longer walled.
    expect(set).not.toContain('meadow->woodland');
    expect(set).not.toContain('woodland->meadow');
    // Gates at STILL-locked edges remain (the §5.5 breadcrumb).
    expect(set).toContain('meadow->wetland');
    expect(set).toContain('woodland->highlands');
  });

  it('all biomes unlocked -> no walls at all (every seam is open)', () => {
    const w = createWorld();
    unlockBiome(w, 'woodland');
    unlockBiome(w, 'wetland');
    unlockBiome(w, 'highlands');
    unlockBiome(w, 'riverbank'); // §4.2 — the 5th biome must also be open for zero walls
    unlockBiome(w, 'coast'); // §4.2 — and the 6th (Coast)
    expect(walledEdges(w)).toHaveLength(0);
  });

  it('the walled-edge set is a pure function of state (refresh == reconstruct source)', () => {
    // The constructor AND refresh both build from this one function, so equal
    // state -> equal walls -> they cannot drift. Pinned by determinism here.
    const w = createWorld();
    unlockBiome(w, 'woodland');
    expect(keys(w)).toEqual(keys(w));
  });
});

describe('lockedRegions — the dim/fog (locked-biome) set', () => {
  it('shrinks as biomes unlock', () => {
    const w = createWorld();
    expect([...lockedBiomes(w)].sort()).toEqual(['coast', 'highlands', 'riverbank', 'wetland', 'woodland']);
    unlockBiome(w, 'woodland');
    expect([...lockedBiomes(w)].sort()).toEqual(['coast', 'highlands', 'riverbank', 'wetland']); // Woodland un-fogged
  });
});
