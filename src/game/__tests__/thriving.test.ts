import { describe, expect, it } from 'vitest';
import { thrivingForBiome, thrivingByBiome, thrivingWord } from '../Thriving';
import { createJournal, recordCatch } from '../../state/Journal';
import { startResearch, evaluateResearch } from '../Research';
import { addCredits } from '../Economy';
import { finalCatchChance } from '../Catch';
import { SPECIES, SPECIES_ORDER, BIOME_ORDER, THRIVING, type BiomeId } from '../../utils/constants';

/**
 * The through-line (§4.3 TL1) — the biome "thriving" derivation. PURE, field-free (a fold over
 * journal.species + SPECIES[].biome, with a GUARDED research bonus). ⚠️ COSMETIC: it can NOT touch
 * gameplay (finalCatchChance takes no thriving). These pin the derivation + the guard + the
 * structural no-behaviour-change.
 */
const speciesIn = (b: BiomeId) => SPECIES_ORDER.filter((s) => SPECIES[s].biome === b);

describe('Thriving — the derivation (caught-in-biome / total)', () => {
  it('rises from 0 (none caught) to 1 (all caught) for a NO-PROJECT biome (woodland — the guard)', () => {
    const j = createJournal();
    // Woodland has NO research project -> species-catalogued is used ALONE (no division by zero).
    expect(thrivingForBiome(j, 'woodland')).toBe(0); // nothing caught
    const wood = speciesIn('woodland');
    expect(wood.length).toBeGreaterThan(0);
    wood.forEach((id, i) => recordCatch(j, id, i + 1));
    expect(thrivingForBiome(j, 'woodland')).toBe(1); // every species -> fully thriving
  });

  it('⚠️ the GUARD: a no-project biome never divides by zero (finite, 0..1, for EVERY biome)', () => {
    const j = createJournal();
    for (const b of BIOME_ORDER) {
      const t = thrivingForBiome(j, b);
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });

  it('a PROJECT biome blends species (primary) + a guarded research bonus (meadow)', () => {
    const j = createJournal();
    speciesIn('meadow').forEach((id, i) => recordCatch(j, id, i + 1)); // all meadow species, no research
    const speciesOnly = thrivingForBiome(j, 'meadow');
    // species maxed but research not done -> caps below 1 by the research weight (the bonus is real).
    expect(speciesOnly).toBeCloseTo(THRIVING.speciesWeight, 5); // 0.85
    expect(speciesOnly).toBeLessThan(1);

    // Complete a meadow research project -> thriving rises (the guarded bonus).
    addCredits(j, 50);
    startResearch(j, 'study-hedgehog'); // a catch-species (hedgehog -> meadow) project
    for (let i = 0; i < 3; i++) evaluateResearch(j, { species: 'hedgehog', biome: 'meadow', phase: 'dusk' } as Parameters<typeof evaluateResearch>[1]);
    expect(thrivingForBiome(j, 'meadow')).toBeGreaterThan(speciesOnly);
  });

  it('thrivingByBiome returns a value for every biome', () => {
    const map = thrivingByBiome(createJournal());
    for (const b of BIOME_ORDER) expect(map[b]).toBe(0);
  });
});

describe('Thriving — the qualitative word (no number, no meter)', () => {
  it('maps thriving to quiet / waking / alive / flourishing', () => {
    expect(thrivingWord(0)).toBe('quiet');
    expect(thrivingWord(0.1)).toBe('quiet');
    expect(thrivingWord(0.25)).toBe('waking');
    expect(thrivingWord(0.5)).toBe('waking');
    expect(thrivingWord(0.6)).toBe('alive');
    expect(thrivingWord(0.89)).toBe('alive');
    expect(thrivingWord(0.9)).toBe('flourishing');
    expect(thrivingWord(1)).toBe('flourishing');
  });
});

describe('Thriving — ⚠️ COSMETIC / structural no-behaviour-change', () => {
  it('the catch chance is journal-INDEPENDENT — thriving cannot affect it (structural)', () => {
    const ctx = { dist: 0.5, tool: 'net' as const, biome: 'meadow' as const, correctBait: false, fleeing: false };
    const chance = finalCatchChance(SPECIES.hedgehog, ctx);
    // finalCatchChance takes NO journal / thriving — so maxing thriving leaves it identical.
    const maxed = createJournal();
    SPECIES_ORDER.forEach((id, i) => recordCatch(maxed, id, i + 1)); // every biome fully thriving
    expect(thrivingForBiome(maxed, 'meadow')).toBeGreaterThan(0);
    expect(finalCatchChance(SPECIES.hedgehog, ctx)).toBe(chance); // unchanged — cosmetic
  });

  it('deriving thriving is a PURE READ — it never mutates the journal', () => {
    const j = createJournal();
    recordCatch(j, 'hedgehog', 1);
    const before = JSON.stringify(j);
    thrivingByBiome(j);
    thrivingForBiome(j, 'meadow');
    thrivingWord(thrivingForBiome(j, 'meadow'));
    expect(JSON.stringify(j)).toBe(before); // no side effects on game state
  });
});
