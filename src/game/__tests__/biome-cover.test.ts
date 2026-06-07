import { describe, expect, it } from 'vitest';
import { createWorld, isInCover, biomeCoverDensity } from '../World';
import { computeStealthFactor, effectiveDetectionRadius } from '../Detection';
import { HIDING_SPOTS, SPECIES, STEALTH, type BiomeId, type CoverKind } from '../../utils/constants';

/**
 * Biome cover gap fix: cover (HIDING_SPOTS) existed only in the Meadow, so the
 * hide-in-cover stealth lever (×0.45) was unavailable in Woodland/Wetland/Highlands.
 * This adds ecology-appropriate cover to all three. The stealth LOGIC (isInCover →
 * computeStealthFactor) is unchanged — these tests pin that it now has cover to read
 * in every biome, and that the meadow is untouched.
 *
 * (Whether each biome now PLAYS fair / sneakable is Craig's post-merge playtest —
 * jsdom can't judge feel; this pins the mechanic is wired everywhere.)
 */
const firstSpot = (biome: BiomeId) => HIDING_SPOTS.find((s) => s.biome === biome)!;
const NEW_BIOMES: BiomeId[] = ['woodland', 'wetland', 'highlands'];

describe('biome cover — the gap is filled in every biome', () => {
  it('all four biomes now have cover (was Meadow-only)', () => {
    for (const biome of ['meadow', ...NEW_BIOMES] as BiomeId[]) {
      expect(HIDING_SPOTS.some((s) => s.biome === biome)).toBe(true);
    }
  });

  it('each biome cover is its ecology-appropriate KIND (what the renderer dispatches on)', () => {
    const expected: Record<string, CoverKind> = {
      meadow: 'grass',
      woodland: 'ferns',
      wetland: 'reeds',
      highlands: 'rocks',
    };
    for (const [biome, kind] of Object.entries(expected)) {
      const spots = HIDING_SPOTS.filter((s) => s.biome === biome);
      expect(spots.length).toBeGreaterThan(0);
      for (const s of spots) expect(s.kind).toBe(kind);
    }
  });

  it('cover spots sit inside their biome cell (static placement, no RNG)', () => {
    const cell: Record<string, { x: [number, number]; y: [number, number] }> = {
      woodland: { x: [-20, 20], y: [20, 60] },
      wetland: { x: [20, 60], y: [-20, 20] },
      highlands: { x: [20, 60], y: [20, 60] },
    };
    for (const [biome, b] of Object.entries(cell)) {
      for (const s of HIDING_SPOTS.filter((sp) => sp.biome === biome)) {
        expect(s.x).toBeGreaterThanOrEqual(b.x[0]);
        expect(s.x).toBeLessThanOrEqual(b.x[1]);
        expect(s.y).toBeGreaterThanOrEqual(b.y[0]);
        expect(s.y).toBeLessThanOrEqual(b.y[1]);
        expect(s.radius).toBeGreaterThan(0);
      }
    }
  });
});

describe('biome cover — the stealth mechanic now WORKS in the new biomes', () => {
  it('isInCover returns true at a cover spot in each newly-covered biome', () => {
    const w = createWorld();
    for (const biome of NEW_BIOMES) {
      const spot = firstSpot(biome);
      expect(spot, `${biome} should have cover`).toBeDefined();
      expect(isInCover(w, spot.x, spot.y)).toBe(true);
    }
  });

  it('standing in cover applies the ×0.45 lever + drops detection in each new biome', () => {
    const w = createWorld();
    const sp = SPECIES.frog; // a representative warier species
    for (const biome of NEW_BIOMES) {
      const spot = firstSpot(biome);
      const inCover = isInCover(w, spot.x, spot.y);
      expect(inCover).toBe(true);
      const f = computeStealthFactor(inCover, false);
      expect(f).toBe(STEALTH.coverFactor); // the same 0.45 benefit the Meadow gets
      expect(effectiveDetectionRadius(sp, f)).toBeCloseTo(sp.detectionRadius * STEALTH.coverFactor);
      expect(effectiveDetectionRadius(sp, f)).toBeLessThan(sp.detectionRadius);
    }
  });
});

describe('biome cover — slice C reduced FREE baseline + Highlands openness', () => {
  const count = (b: BiomeId) => HIDING_SPOTS.filter((s) => s.biome === b).length;

  it('a smaller free baseline per biome, but cover NEVER drops to zero (stealth stays possible)', () => {
    expect(count('meadow')).toBe(3);
    expect(count('woodland')).toBe(3);
    expect(count('wetland')).toBe(3);
    expect(count('highlands')).toBe(2);
    for (const b of ['meadow', 'woodland', 'wetland', 'highlands'] as BiomeId[]) {
      expect(count(b)).toBeGreaterThanOrEqual(2); // the anti-lockout floor — never barren
    }
  });

  it('Highlands is the OPENEST biome — fewest spots (the throwing-net condition), not zero', () => {
    for (const b of ['meadow', 'woodland', 'wetland'] as BiomeId[]) {
      expect(count('highlands')).toBeLessThan(count(b));
    }
    expect(count('highlands')).toBeGreaterThan(0);
  });

  it('biomeCoverDensity exposes openness (Highlands lowest) — the B1 throwing-net hook', () => {
    const w = createWorld();
    expect(biomeCoverDensity(w, 'highlands')).toBe(2);
    for (const b of ['meadow', 'woodland', 'wetland'] as BiomeId[]) {
      expect(biomeCoverDensity(w, 'highlands')).toBeLessThan(biomeCoverDensity(w, b));
    }
  });
});
