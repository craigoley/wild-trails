import { describe, expect, it } from 'vitest';
import { lockedBiomes, walledEdges } from '../lockedRegions';
import { createWorld, unlockBiome } from '../../game/World';

/** "from->to" keys for the walled-edge set (order-independent comparison). */
const keys = (w: ReturnType<typeof createWorld>): string[] =>
  walledEdges(w).map((e) => `${e.from}->${e.to}`).sort();

describe('lockedRegions — the walled-edge set (the bug fix, at the logic seam)', () => {
  it('a fresh world walls the Meadow off from its still-locked neighbours', () => {
    const w = createWorld(); // only Meadow unlocked
    expect(keys(w)).toEqual(['meadow->hedgerow', 'meadow->wetland', 'meadow->woodland']); // §hedgerow — the corridor is the 3rd locked meadow neighbour
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
    unlockBiome(w, 'moor'); // §4.2 — and the 7th (Moor, the 1st branched biome)
    unlockBiome(w, 'pineforest'); // §4.2 — and the 8th (Pine Forest, the closed-woods branch off the Woodland)
    unlockBiome(w, 'cave'); // §4.2 — and the 9th (Cave, the always-dark branch off the Riverbank)
    unlockBiome(w, 'tidal'); // §4.2 — and the 10th (Tidal/Saltmarsh, the Coast's estuary arm)
    unlockBiome(w, 'alpine'); // §4.2 — and the 11th (Alpine Summit, the Moor's first arm)
    unlockBiome(w, 'hedgerow'); // §hedgerow — the corridor
    unlockBiome(w, 'copse'); // §hedgerow — the copse it links to
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
    expect([...lockedBiomes(w)].sort()).toEqual(['alpine', 'cave', 'coast', 'copse', 'hedgerow', 'highlands', 'moor', 'pineforest', 'riverbank', 'tidal', 'wetland', 'woodland']);
    unlockBiome(w, 'woodland');
    expect([...lockedBiomes(w)].sort()).toEqual(['alpine', 'cave', 'coast', 'copse', 'hedgerow', 'highlands', 'moor', 'pineforest', 'riverbank', 'tidal', 'wetland']); // Woodland un-fogged
  });
});
