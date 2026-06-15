import { describe, expect, it } from 'vitest';
import { currentSignature, dominantBehavior } from '../behavioralSignature';
import { speciesBudget, speciesSignature } from '../Species';
import { createAnimalPool, spawnAnimal, type AnimalBehavior } from '../Animal';
import { SPECIES, ETHOGRAM } from '../../utils/constants';

/**
 * §4.6 D2 (iii) — the READABLE behavioural-signature seam (the D3 identify-by-behavior readout). PURE. These pin: the
 * signal COMPOSES the live behaviour + the species signature/budget/descriptors (a read, no new
 * behaviour), the dominant-activity derivation, and that DISTINCT species carry DISTINCT behavioural signatures.
 */

const animalOf = (species: Parameters<typeof spawnAnimal>[1]) => {
  const pool = createAnimalPool();
  return spawnAnimal(pool, species, 0, 0)!;
};

describe('currentSignature — composes the existing behavioural data into one readable signal', () => {
  it('reflects the LIVE behaviour + the species signature / budget / descriptors', () => {
    const a = animalOf('dipper');
    a.behavior = 'vigilance'; // the live state, right now
    const s = currentSignature(a);
    expect(s.behavior).toBe('vigilance'); // LIVE
    expect(s.signature).toBe(speciesSignature('dipper')); // 'bob'
    expect(s.budget).toBe(speciesBudget('dipper')); // the species weighting
    expect(s.habitat).toBe(SPECIES.dipper.biome);
    expect(s.activity).toBe(SPECIES.dipper.activityWindow);
    expect(s.gait).toBe(SPECIES.dipper.gait);
  });

  it('the live behaviour tracks the animal (a read, not a fixed tag)', () => {
    const a = animalOf('fieldmouse');
    for (const b of ['rest', 'forage', 'vigilance', 'locomote'] as AnimalBehavior[]) {
      a.behavior = b;
      expect(currentSignature(a).behavior).toBe(b);
    }
  });

  it('the dominant activity is the budget argmax (first-wins on a tie)', () => {
    expect(dominantBehavior(ETHOGRAM.budgets.grazer)).toBe('forage'); // forage 0.50
    expect(dominantBehavior(ETHOGRAM.budgets.songbird)).toBe('rest'); // rest 0.40
    expect(dominantBehavior(ETHOGRAM.budgets.darter)).toBe('forage'); // forage 0.45
    // wader ties forage (0.40) = vigilance (0.40) → forage wins (earlier in the order). Documented.
    expect(dominantBehavior(ETHOGRAM.budgets.wader)).toBe('forage');
    expect(currentSignature(animalOf('curlew')).dominant).toBe('forage');
  });

  it('⚠️ DISTINCT species carry DISTINCT behavioural signatures (the seam carries the character)', () => {
    const wader = currentSignature(animalOf('curlew')); // wader budget, vigilance-heavy, no signature
    const mouse = currentSignature(animalOf('fieldmouse')); // darter budget, locomote-heavy, no signature
    const dipper = currentSignature(animalOf('dipper')); // ambusher budget + the 'bob' signature
    // The budgets differ → the behavioural signature differs.
    expect(wader.budget).not.toBe(mouse.budget);
    expect(wader.budget.vigilance).toBeGreaterThan(mouse.budget.vigilance);
    expect(mouse.budget.locomote).toBeGreaterThan(wader.budget.locomote);
    // The signature distinguishes the dipper.
    expect(dipper.signature).toBe('bob');
    expect(wader.signature).toBe('none');
  });

  it('an untagged species reads the default budget + none (honest fallback)', () => {
    const s = currentSignature(animalOf('badger'));
    expect(s.budget).toBe(ETHOGRAM.defaultBudget);
    expect(s.signature).toBe('none');
  });
});
