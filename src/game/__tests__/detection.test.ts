import { describe, expect, it } from 'vitest';
import { computeStealthFactor, effectiveDetectionRadius, isSneaking } from '../Detection';
import { createWorld, isInCover } from '../World';
import { createPlayer } from '../Player';
import { SPECIES, STEALTH, TUNING, HIDING_SPOTS, SPECIES_ORDER } from '../../utils/constants';

const allSpecies = SPECIES_ORDER.map((id) => SPECIES[id]);

describe('Detection — the load-bearing invariant (layer is a no-op at rest)', () => {
  it('stealthFactor === 1 => effectiveDetectionRadius === baseDetectionRadius for EVERY species', () => {
    for (const s of allSpecies) {
      expect(effectiveDetectionRadius(s, 1)).toBe(s.detectionRadius);
    }
  });

  it('computeStealthFactor(false, false) === 1 (no cover, not sneaking)', () => {
    expect(computeStealthFactor(false, false)).toBe(1);
  });
});

describe('Detection — cover shrinks the radius by exactly the constant', () => {
  it('in cover => radius * STEALTH.coverFactor', () => {
    const s = SPECIES.quail;
    const f = computeStealthFactor(true, false);
    expect(f).toBeCloseTo(STEALTH.coverFactor, 12);
    expect(effectiveDetectionRadius(s, f)).toBeCloseTo(s.detectionRadius * STEALTH.coverFactor, 12);
    expect(effectiveDetectionRadius(s, f)).toBeLessThan(s.detectionRadius);
  });
});

describe('Detection — slow movement shrinks vs sprinting; cover+slow stacks', () => {
  it('sneaking < sprinting, and cover*slow is the product', () => {
    const sprint = computeStealthFactor(false, false); // 1
    const slow = computeStealthFactor(false, true);
    const coverSlow = computeStealthFactor(true, true);
    expect(slow).toBeLessThan(sprint);
    expect(slow).toBeCloseTo(STEALTH.movementFactor, 12);
    // Multiplicative stack.
    expect(coverSlow).toBeCloseTo(STEALTH.coverFactor * STEALTH.movementFactor, 12);
    expect(coverSlow).toBeLessThan(slow);
  });

  it('isSneaking is derived from current speed vs maxSpeed', () => {
    const slow = createPlayer(0, 0);
    slow.vx = TUNING.maxSpeed * STEALTH.sneakSpeedFrac * 0.5; // well under the threshold
    slow.vy = 0;
    expect(isSneaking(slow)).toBe(true);

    const fast = createPlayer(0, 0);
    fast.vx = TUNING.maxSpeed; // full tilt
    fast.vy = 0;
    expect(isSneaking(fast)).toBe(false);

    const still = createPlayer(0, 0); // vx=vy=0
    expect(isSneaking(still)).toBe(true);
  });
});

describe('Detection — wariness ordering preserved at equal stealth', () => {
  it('quail (wary) keeps a larger effective radius than hedgehog (docile)', () => {
    expect(SPECIES.quail.detectionRadius).toBeGreaterThan(SPECIES.hedgehog.detectionRadius); // sanity
    for (const f of [1, computeStealthFactor(true, false), computeStealthFactor(true, true)]) {
      expect(effectiveDetectionRadius(SPECIES.quail, f)).toBeGreaterThan(
        effectiveDetectionRadius(SPECIES.hedgehog, f),
      );
    }
  });
});

describe('Detection — clamps and boundaries', () => {
  it('stealthFactor clamps to [0,1]; radius never negative, never above base', () => {
    const s = SPECIES.rabbit;
    expect(effectiveDetectionRadius(s, -5)).toBe(0); // clamped low
    expect(effectiveDetectionRadius(s, 5)).toBe(s.detectionRadius); // clamped high => base
    expect(effectiveDetectionRadius(s, 0)).toBe(0);
  });

  it('computeStealthFactor result is always within [0,1]', () => {
    for (const inCover of [false, true]) {
      for (const sneaking of [false, true]) {
        const f = computeStealthFactor(inCover, sneaking);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Detection — hiding-spot geometry boundary (inclusive)', () => {
  const world = createWorld();
  const spot = HIDING_SPOTS[0];

  it('centre is in cover; a point exactly ON the radius is INCLUSIVE', () => {
    expect(isInCover(world, spot.x, spot.y)).toBe(true);
    expect(isInCover(world, spot.x + spot.radius, spot.y)).toBe(true); // boundary inclusive
  });

  it('just outside the radius is NOT in cover; far away is not', () => {
    expect(isInCover(world, spot.x + spot.radius + 1e-6, spot.y)).toBe(false);
    expect(isInCover(world, spot.x + 999, spot.y)).toBe(false);
  });
});

// NOTE: Line-of-sight (a cover prop BETWEEN animal and player blocking sight) is
// DEFERRED to a follow-up — radius-only stealth ships in v1 (see PR description),
// so there is intentionally no LOS test here.
