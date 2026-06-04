import { describe, expect, it } from 'vitest';
import { clampActive, clampToUnlocked, createWorld, unlockBiome, type World } from '../World';
import { BIOMES, PLAYER, type BiomeId } from '../../utils/constants';
import type { Vec2 } from '../../utils/math';

const M = PLAYER.radius;

/** A world with the given biomes unlocked (Meadow is always unlocked). */
function worldWith(...unlocked: BiomeId[]): World {
  const w = createWorld();
  for (const id of unlocked) unlockBiome(w, id);
  return w;
}

/** Clamp a point and return the result (fresh Vec2). */
function clamp(w: World, x: number, y: number): Vec2 {
  const out: Vec2 = { x: 0, y: 0 };
  return clampToUnlocked(w, x, y, M, out);
}

const meadow = BIOMES.meadow.bounds;
const woodland = BIOMES.woodland.bounds; // north of Meadow, shares y = 20
const wetland = BIOMES.wetland.bounds; // east of Meadow, shares x = 20

describe('per-rect clamp — Meadow only (regression: identical to the old bbox)', () => {
  const w = worldWith();
  it('leaves an interior point untouched', () => {
    const p = clamp(w, 3, -4);
    expect(p.x).toBeCloseTo(3, 10);
    expect(p.y).toBeCloseTo(-4, 10);
  });
  it('confines to the Meadow, inset by the radius', () => {
    expect(clamp(w, 1000, 0).x).toBeCloseTo(meadow.maxX - M, 10);
    expect(clamp(w, 0, 1000).y).toBeCloseTo(meadow.maxY - M, 10); // locked Woodland denied
  });
});

describe('per-rect clamp — Meadow + Woodland (contiguous, the shipped state)', () => {
  const w = worldWith('woodland');
  it('the player reaches Woodland interior (1x2 region opened northward)', () => {
    const p = clamp(w, 0, 40); // deep in Woodland
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(40, 10); // untouched — reachable
  });
  it('still confined to the 1x2 column (east into locked Wetland is denied)', () => {
    expect(clamp(w, 1000, 0).x).toBeCloseTo(meadow.maxX - M, 10); // east edge of Meadow
    expect(clamp(w, 1000, 40).x).toBeCloseTo(woodland.maxX - M, 10); // east edge of Woodland
    expect(clamp(w, 0, 1000).y).toBeCloseTo(woodland.maxY - M, 10); // north cap
    expect(clamp(w, 0, -1000).y).toBeCloseTo(meadow.minY + M, 10); // south cap
  });
});

describe('per-rect clamp — the SEAM is free (no internal wall)', () => {
  const w = worldWith('woodland');
  it('a point exactly on the shared y=20 border is VALID (not walled)', () => {
    const p = clamp(w, 0, 20); // the Meadow|Woodland seam
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(20, 10); // unchanged — a naive per-rect clamp would wall this
    expect(clampActive(w, 0, 20, M)).toBe(false);
  });
  it('moving vertically across the seam is unobstructed', () => {
    // Both sides of the seam (within the body radius) are valid — no margin gap.
    expect(clampActive(w, 0, 20 - M / 2, M)).toBe(false);
    expect(clampActive(w, 0, 20 + M / 2, M)).toBe(false);
  });
});

describe('per-rect clamp — Meadow + Woodland + Wetland (the L: deny the empty corner)', () => {
  const w = worldWith('woodland', 'wetland');
  it('all three unlocked cells are reachable', () => {
    expect(clampActive(w, 0, 0, M)).toBe(false); // Meadow
    expect(clampActive(w, 0, 40, M)).toBe(false); // Woodland
    expect(clampActive(w, 40, 0, M)).toBe(false); // Wetland
  });
  it('the locked Highlands corner is DENIED and clamps back to the union edge', () => {
    expect(clampActive(w, 40, 40, M)).toBe(true); // (40,40) is in no unlocked rect
    const p = clamp(w, 40, 40);
    // Clamped onto the inset edge of Woodland (x=20-M) or Wetland (y=20-M) — out of Highlands.
    const onWoodlandEdge = Math.abs(p.x - (woodland.maxX - M)) < 1e-9;
    const onWetlandEdge = Math.abs(p.y - (wetland.maxY - M)) < 1e-9;
    expect(onWoodlandEdge || onWetlandEdge).toBe(true);
    expect(clampActive(w, p.x, p.y, M)).toBe(false); // the clamped point is now valid
  });
});

describe('per-rect clamp — all four unlocked (full 2x2, nothing falsely denied)', () => {
  const w = worldWith('woodland', 'wetland', 'highlands');
  it('every cell incl. the former corner is reachable', () => {
    expect(clampActive(w, 40, 40, M)).toBe(false); // Highlands now open
    expect(clamp(w, 40, 40).x).toBeCloseTo(40, 10);
    expect(clamp(w, 40, 40).y).toBeCloseTo(40, 10);
  });
  it('clamps only at the OUTER bound of the full square', () => {
    expect(clamp(w, 1000, 1000).x).toBeCloseTo(BIOMES.highlands.bounds.maxX - M, 10);
  });
});

describe('per-rect clamp — clampActive agrees with clampToUnlocked', () => {
  const w = worldWith('woodland', 'wetland');
  it('clampActive is true exactly when the clamp moves the point', () => {
    for (const [x, y] of [[0, 0], [0, 40], [40, 40], [1000, 0], [20, 20], [0, 20]]) {
      const moved = (() => {
        const p = clamp(w, x, y);
        return Math.abs(p.x - x) > 1e-9 || Math.abs(p.y - y) > 1e-9;
      })();
      expect(clampActive(w, x, y, M)).toBe(moved);
    }
  });
});

describe('per-rect clamp — boundary inclusivity (edges are INCLUSIVE)', () => {
  const w = worldWith();
  it('a point exactly on the inset edge is inside; just past it is clamped', () => {
    expect(clampActive(w, meadow.maxX - M, 0, M)).toBe(false); // exactly on inset edge -> inside
    expect(clampActive(w, meadow.maxX - M + 1e-6, 0, M)).toBe(true); // a hair past -> moved
  });
});
