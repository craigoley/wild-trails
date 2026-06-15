import { describe, expect, it } from 'vitest';
import { speciesBudget, speciesSignature } from '../Species';
import { createAnimalPool, spawnAnimal, updateAnimal, type AnimalBehavior } from '../Animal';
import { createWorld } from '../World';
import { createPlayer } from '../Player';
import { createRng } from '../../utils/rng';
import { ETHOGRAM, SPECIES_ORDER, SPECIES, SIM_DT, type SpeciesId } from '../../utils/constants';

/**
 * §4.6 D2 (ii) — the PER-SPECIES character: distinct time-budget weights + signature behaviours on the
 * proven slice-(i) engine. These pin the DATA contract + that the weighting actually shapes the dwell
 * distribution (a wader stand-scans more than a darter), with the catch still byte-unchanged. The FEEL
 * (species read as themselves; the bob/wag land) is Craig's device gate.
 */

/** Run a calm animal (player far) and return the fraction of calm steps spent in each behavior. */
function behaviorMix(species: SpeciesId, seed: number, steps = 4000): Record<AnimalBehavior, number> {
  const world = createWorld();
  const far = createPlayer(900, 900); // never flees
  const pool = createAnimalPool();
  const b = SPECIES[species].biome;
  const r = world.biomes[b].def.bounds;
  const a = spawnAnimal(pool, species, (r.minX + r.maxX) / 2, (r.minY + r.maxY) / 2)!;
  const rng = createRng(seed);
  const count: Record<AnimalBehavior, number> = { rest: 0, forage: 0, vigilance: 0, locomote: 0 };
  for (let i = 0; i < steps; i++) {
    updateAnimal(a, far, world, rng, SIM_DT);
    if (a.aiState === 'wander') count[a.behavior]++;
  }
  const total = count.rest + count.forage + count.vigilance + count.locomote;
  return { rest: count.rest / total, forage: count.forage / total, vigilance: count.vigilance / total, locomote: count.locomote / total };
}

describe('per-species budget — distinct character, default fallback', () => {
  it('a tagged species returns its archetype budget; an untagged one falls back to the default', () => {
    expect(speciesBudget('curlew')).toBe(ETHOGRAM.budgets.wader); // tagged → its archetype
    expect(speciesBudget('fieldmouse')).toBe(ETHOGRAM.budgets.darter);
    expect(speciesBudget('badger')).toBe(ETHOGRAM.defaultBudget); // untagged → the default
  });

  it('⚠️ the weighting SHAPES the live dwell distribution (a wader stand-scans; a darter roams)', () => {
    const wader = behaviorMix('curlew', 11); // budget: vigilance 0.40, locomote 0.10
    const darter = behaviorMix('fieldmouse', 11); // budget: vigilance 0.15, locomote 0.30
    // The wader spends MORE of its calm time vigilant than the darter...
    expect(wader.vigilance).toBeGreaterThan(darter.vigilance);
    // ...and the darter spends MORE time on the move (locomote) than the wader.
    expect(darter.locomote).toBeGreaterThan(wader.locomote);
  });

  it('is seeded-deterministic (same seed → same distribution)', () => {
    expect(behaviorMix('roedeer', 3)).toEqual(behaviorMix('roedeer', 3));
  });
});

describe('per-species signatures — honest + species-level', () => {
  it('only the dipper bobs and the wagtail wags; everything else is none', () => {
    expect(speciesSignature('dipper')).toBe('bob');
    expect(speciesSignature('greywagtail')).toBe('wag');
    expect(speciesSignature('robin')).toBe('none');
    expect(speciesSignature('roedeer')).toBe('none');
  });

  it('⚠️ signatures are RARE — most species are honestly signature-less (no invented quirks)', () => {
    const tagged = SPECIES_ORDER.filter((id) => speciesSignature(id) !== 'none');
    expect(tagged.sort()).toEqual(['dipper', 'greywagtail']); // exactly the two honest ones
    expect(tagged.length).toBeLessThan(SPECIES_ORDER.length / 4); // a small minority
  });
});

describe('per-species character — the catch stays byte-unchanged (orthogonal to aiState)', () => {
  it('⚠️ a heavy-vigilance species is still aiState "wander" when calm → ctx.fleeing stays false', () => {
    const world = createWorld();
    const far = createPlayer(900, 900);
    const pool = createAnimalPool();
    const r = world.biomes[SPECIES.curlew.biome].def.bounds;
    const a = spawnAnimal(pool, 'curlew', (r.minX + r.maxX) / 2, (r.minY + r.maxY) / 2)!;
    const rng = createRng(7);
    for (let i = 0; i < 1500; i++) {
      updateAnimal(a, far, world, rng, SIM_DT);
      expect(a.aiState).toBe('wander'); // calm in every behavior (incl. vigilance) → fleeing === false
    }
  });
});
