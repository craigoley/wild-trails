import { describe, expect, it } from 'vitest';
import { computeStealthFactor, effectiveDetectionRadius } from '../../Detection';
import { finalCatchChance } from '../../Catch';
import { SPECIES, CATCH, type SpeciesId } from '../../../utils/constants';

/**
 * L1 — the cover→approach→catch ANTI-LOCKOUT guard (Nets & Gear slice C).
 *
 * THE GAP THIS CLOSES: the #52 balance-band guard computes the catch chance at a FIXED
 * dist 0.5 — it tests close-range catch MATH, not whether you can APPROACH to 0.5
 * WITHOUT cover. The real anti-lockout valve IS the approach: cover → reduced detection
 * radius → sneak into catch range → catchable bait-less. So #52 is blind to a cover
 * reduction. This guard models the FULL chain and permanently guards every future
 * cover/stealth change (slice C reduced the cover baseline).
 */

// The easiest (highest base rate) species in each EARLY biome — the floor a broke,
// bait-less player relies on. `comfortable`: the STARTING biome must be generously
// catchable (the new player); later biomes need only be catchable (never locked out).
const EASIEST: { id: SpeciesId; comfortable: boolean }[] = [
  { id: 'hedgehog', comfortable: true }, // meadow — the broke new player's biome
  { id: 'redsquirrel', comfortable: false }, // woodland
  { id: 'mallard', comfortable: false }, // wetland
];

describe('L1 Guard — cover→approach→catch (the real valve #52 cannot see)', () => {
  // The free-baseline cover-stealth a bait-less player leans on: in cover + sneaking.
  const coverStealth = computeStealthFactor(true, true);

  it('cover lets you APPROACH each early-biome easiest species to within catch range while CALM', () => {
    for (const { id } of EASIEST) {
      const reach = effectiveDetectionRadius(SPECIES[id], coverStealth);
      expect(reach).toBeLessThanOrEqual(CATCH.attemptRadius); // in range before it flees
    }
  });

  it('the bait-less catch is then in the anti-lockout band (meadow comfortable; never locked out)', () => {
    for (const { id, comfortable } of EASIEST) {
      const sp = SPECIES[id];
      // The calm-approach limit (the FARTHEST you'd attempt; sneaking closer only helps).
      const calmDist = effectiveDetectionRadius(sp, coverStealth);
      const chance = finalCatchChance(sp, {
        dist: calmDist,
        tool: 'net',
        biome: sp.biome,
        correctBait: false,
        fleeing: false,
      });
      expect(chance).toBeGreaterThan(0.2); // catchable bait-less — never a hard lockout
      if (comfortable) expect(chance).toBeGreaterThanOrEqual(0.5); // the starting-biome valve
    }
  });

  it('cover is LOAD-BEARING: without it the warier species flee before catch range', () => {
    // redsquirrel/mallard detection (4.2) exceeds attemptRadius (2.6) at full alert — so
    // WITHOUT cover you can't reach catch range calm. This is exactly what reducing cover
    // threatens and the free baseline protects; #52's fixed-dist band can't see it.
    for (const id of ['redsquirrel', 'mallard'] as SpeciesId[]) {
      expect(effectiveDetectionRadius(SPECIES[id], 1.0)).toBeGreaterThan(CATCH.attemptRadius);
      expect(effectiveDetectionRadius(SPECIES[id], coverStealth)).toBeLessThanOrEqual(CATCH.attemptRadius);
    }
  });
});
