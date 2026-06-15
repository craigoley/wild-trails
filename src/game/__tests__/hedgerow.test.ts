import { describe, expect, it } from 'vitest';
import { createWorld, unlockBiome, clampToUnlocked, currentBiome, isOpenBiome } from '../World';
import { finalCatchChance } from '../Catch';
import { BIOMES, BIOME_SET_UNLOCK, BIOME_ORDER, SPECIES, SPECIES_ORDER, PLAYER } from '../../utils/constants';
import type { Vec2 } from '../../utils/math';

/**
 * §hedgerow — the CONNECTOR chain (meadow → a thin FULL-WIDTH traversable ribbon → the isolated Hazel
 * Copse). These pin the NOVEL part (the ribbon topology + the seamless traversal + the copse reachable
 * ONLY via the corridor) and the guardrails (single-biome species; the catch core untouched). The LOOK /
 * connectivity FEEL is Craig's device gate.
 */

const out: Vec2 = { x: 0, y: 0 };
const m = PLAYER.radius;

/** Unlock the whole chain (meadow starts unlocked). */
function openChain() {
  const w = createWorld();
  unlockBiome(w, 'hedgerow');
  unlockBiome(w, 'copse');
  return w;
}

describe('hedgerow topology — the full-width ribbon + seamless traversal', () => {
  it('the ribbon is THIN on travel + FULL-WIDTH on the shared axis (so the full-edge clamp holds)', () => {
    const h = BIOMES.hedgerow.bounds;
    const meadow = BIOMES.meadow.bounds;
    const copse = BIOMES.copse.bounds;
    // Full-width: the ribbon's x-extent equals the meadow's AND the copse's (whole-edge adjacency).
    expect([h.minX, h.maxX]).toEqual([meadow.minX, meadow.maxX]);
    expect([h.minX, h.maxX]).toEqual([copse.minX, copse.maxX]);
    // Thin on the travel (y) axis: shallower than a full cell.
    expect(h.maxY - h.minY).toBeLessThan(meadow.maxY - meadow.minY);
    // Edge-adjacent end to end: meadow.minY === hedgerow.maxY, hedgerow.minY === copse.maxY.
    expect(h.maxY).toBe(meadow.minY);
    expect(h.minY).toBe(copse.maxY);
  });

  it('⚠️ the chain TRAVERSES seamlessly meadow → hedgerow → copse (the clamp permits the whole strip)', () => {
    const w = openChain();
    // A point in each segment is INSIDE the unlocked union (clamp returns it unchanged).
    for (const [x, y] of [[0, 0], [0, -24], [0, -48]] as const) {
      clampToUnlocked(w, x, y, m, out);
      expect([out.x, out.y]).toEqual([x, y]); // reachable — not clamped
    }
    // The seams between segments are OPEN (a point on the shared edge is valid in the union).
    clampToUnlocked(w, 0, -20, m, out); // meadow|hedgerow seam
    expect(out.y).toBeCloseTo(-20);
    clampToUnlocked(w, 0, -28, m, out); // hedgerow|copse seam
    expect(out.y).toBeCloseTo(-28);
  });

  it('⚠️ NO over-permit: a point off the ribbon’s side (beyond its x) is clamped back (the full-edge assumption)', () => {
    const w = openChain();
    clampToUnlocked(w, 30, -24, m, out); // east of the corridor (x=30 > 20) — the void, must be denied
    expect(out.x).toBeLessThanOrEqual(20 - m + 1e-9); // pulled back onto the ribbon
  });

  it('currentBiome resolves the ribbon and the copse correctly', () => {
    const w = createWorld();
    expect(currentBiome(w, 0, -24)).toBe('hedgerow');
    expect(currentBiome(w, 0, -48)).toBe('copse');
    expect(currentBiome(w, 0, 0)).toBe('meadow');
  });
});

describe('hedgerow — the unlock chain is a LINEAR tree (no cycle); the copse is corridor-gated', () => {
  it('meadow forks to the corridor; the hedgerow set opens the copse (and the copse is terminal)', () => {
    expect(BIOME_SET_UNLOCK.meadow).toContain('hedgerow'); // the fork (alongside the woodland)
    expect(BIOME_SET_UNLOCK.hedgerow).toEqual(['copse']); // the corridor's set opens the copse
    expect(BIOME_SET_UNLOCK.copse).toBeUndefined(); // terminal — unlocks nothing (no cycle)
  });

  it('⚠️ the copse is reachable ONLY via the hedgerow (its prereq IS the corridor)', () => {
    expect(BIOMES.hedgerow.prereq).toBe('meadow');
    expect(BIOMES.copse.prereq).toBe('hedgerow'); // you MUST traverse the corridor to reach it
    // Each new biome appears exactly once as a successor (a tree, not a graph).
    const allSuccessors = BIOME_ORDER.flatMap((b) => [...(BIOME_SET_UNLOCK[b] ?? [])]);
    expect(allSuccessors.filter((s) => s === 'hedgerow')).toHaveLength(1);
    expect(allSuccessors.filter((s) => s === 'copse')).toHaveLength(1);
  });
});

describe('hedgerow — the edge species (single-biome, honest diets, anti-lockout)', () => {
  it('every new species is SINGLE-biome (the one-biome model untouched)', () => {
    const hedgerow = SPECIES_ORDER.filter((id) => SPECIES[id].biome === 'hedgerow');
    const copse = SPECIES_ORDER.filter((id) => SPECIES[id].biome === 'copse');
    expect(hedgerow.sort()).toEqual(['bankvole', 'harvestmouse', 'whitethroat', 'yellowhammer']);
    expect(copse.sort()).toEqual(['blackcap', 'dormouse']);
    // Proven diets only — no new bait type.
    for (const id of [...hedgerow, ...copse]) {
      expect(['seeds', 'greens', 'insects', 'fish', 'shellfish']).toContain(SPECIES[id].bait);
    }
  });

  it('the dense hedge/copse are NOT "open" biomes (the corridor is cover, not exposure)', () => {
    expect(isOpenBiome('hedgerow')).toBe(false);
    expect(isOpenBiome('copse')).toBe(false);
  });

  it('⚠️ anti-lockout: the bank vole is the easiest — catchable BAIT-LESS', () => {
    // The hedgerow's floor valve has the highest base rate of the new roster (a reliable bare catch).
    const newRates = ['bankvole', 'harvestmouse', 'yellowhammer', 'whitethroat', 'dormouse', 'blackcap']
      .map((id) => SPECIES[id as keyof typeof SPECIES].baseCatchRate);
    expect(Math.max(...newRates)).toBe(SPECIES.bankvole.baseCatchRate);
    // A bare (no bait, in-biome, point-blank) bank-vole attempt has real, non-trivial odds.
    const chance = finalCatchChance(SPECIES.bankvole, { dist: 0.5, tool: 'net', biome: 'hedgerow', correctBait: false, fleeing: false });
    expect(chance).toBeGreaterThan(0.4);
  });
});
