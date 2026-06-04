import { describe, expect, it } from 'vitest';
import { eligibleSpecies } from '../Species';
import { SPECIES, SPECIES_ORDER } from '../../utils/constants';

const WOODLAND = ['redsquirrel', 'robin'] as const;
const MEADOW = ['fieldmouse', 'rabbit', 'quail', 'hedgehog'] as const;

describe('Woodland species — spawn gating (biome + time of day)', () => {
  it('Woodland species are eligible in Woodland at their activity window only', () => {
    const woodDay = eligibleSpecies('woodland', 'day').map((s) => s.id);
    const woodDawn = eligibleSpecies('woodland', 'dawn').map((s) => s.id);
    expect(woodDay).toContain('redsquirrel'); // squirrel = day
    expect(woodDay).not.toContain('robin'); // robin = dawn only
    expect(woodDawn).toContain('robin');
    expect(woodDawn).not.toContain('redsquirrel');
  });

  it('Woodland species never spawn in the Meadow', () => {
    for (const phase of ['dawn', 'day', 'dusk', 'night'] as const) {
      const meadowIds = eligibleSpecies('meadow', phase).map((s) => s.id);
      for (const w of WOODLAND) expect(meadowIds).not.toContain(w);
    }
  });
});

describe('Woodland species — tier-2 difficulty (harder than the Meadow band)', () => {
  it('every Woodland species is tier 2, with lower catch rate + faster flee than Meadow', () => {
    const meadowRates = MEADOW.map((id) => SPECIES[id].baseCatchRate);
    const meadowAvg = meadowRates.reduce((a, b) => a + b, 0) / meadowRates.length;
    const meadowMaxFlee = Math.max(...MEADOW.map((id) => SPECIES[id].baseFleeSpeed));

    for (const id of WOODLAND) {
      const s = SPECIES[id];
      expect(s.tier).toBe(2);
      expect(s.biome).toBe('woodland');
      expect(s.baseCatchRate).toBeLessThan(meadowAvg); // harder to catch
      expect(s.baseFleeSpeed).toBeGreaterThan(meadowMaxFlee); // faster than any Meadow animal
    }
  });
});

describe('Woodland species — roster count is data-driven', () => {
  it('the species roster grew to 10 (the journal header reads this, not a literal)', () => {
    expect(SPECIES_ORDER.length).toBe(10); // Plan #9 added Badger, Roe Deer, Mallard, Frog
    for (const id of WOODLAND) expect(SPECIES_ORDER).toContain(id);
    // Each shipped species has a profile + a model config (cards + silhouettes).
    for (const id of WOODLAND) {
      expect(typeof SPECIES[id].profile).toBe('string');
      expect(SPECIES[id].profile.length).toBeGreaterThan(20);
    }
  });
});
