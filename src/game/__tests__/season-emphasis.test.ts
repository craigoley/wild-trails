import { describe, expect, it } from 'vitest';
import { pickSpecies, seasonalAbundance } from '../Spawn';
import { eligibleSpecies } from '../Species';
import { createRng } from '../../utils/rng';
import {
  SPECIES,
  SPECIES_ORDER,
  SEASONAL_ABUNDANCE_FLOOR,
  SEASONAL_NOTE,
  type Season,
  type SpeciesId,
} from '../../utils/constants';

/**
 * §4.6 D1b — SEASONAL EMPHASIS: honest phenology as ABUNDANCE, NEVER a gate. ⚠️⚠️ THE SPINE (the prime
 * directive): the season weights the spawn LOTTERY, never ELIGIBILITY; every seasonalAbundance is > 0
 * (the floor), so EVERY species is findable in EVERY season — nothing is ever season-locked. A MINORITY
 * of genuinely-migratory species are tagged; the rest are flat residents. The catch FORMULA is untouched
 * (abundance ≠ catch odds). The FEEL (winter quieter-not-empty; the note reads honest) is Craig's gate.
 */
const ALL_SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const SUMMER_VISITORS = ['quail', 'dotterel', 'wheatear'] as const;
// §migration — the estuary's dramatic Arctic-flyway winter visitors join the proven brentgoose/knot.
const WINTER_VISITORS = [
  'brentgoose',
  'knot',
  'bartailedgodwit',
  'greyplover',
  'wigeon',
  'pintail',
  'sanderling',
] as const;
const TAGGED = [...SUMMER_VISITORS, ...WINTER_VISITORS] as const;

describe('§4.6 D1b — ⚠️⚠️ THE SPINE: anti-lockout holds in EVERY season (nothing is ever missable)', () => {
  it('every species, every season: seasonalAbundance is > 0 (the hard floor — never weighted out)', () => {
    for (const id of SPECIES_ORDER) {
      for (const season of ALL_SEASONS) {
        const a = seasonalAbundance(SPECIES[id as SpeciesId], season);
        expect(a).toBeGreaterThan(0); // ⚠️ never zero — always findable
        expect(a).toBeGreaterThanOrEqual(SEASONAL_ABUNDANCE_FLOOR); // the structural floor holds
      }
    }
  });

  it('the season NEVER gates eligibility — eligibleSpecies takes no season, so its list is season-blind', () => {
    // A tagged species is in its biome+phase eligible list — and that list is computed WITHOUT any
    // season (the spine: the season can only weight the pick below, never remove a species from the list).
    expect(eligibleSpecies('meadow', 'dawn').map((s) => s.id)).toContain('quail'); // a summer visitor — still eligible
    expect(eligibleSpecies('coast', 'day').map((s) => s.id)).toContain('brentgoose'); // a winter visitor — still eligible
    expect(eligibleSpecies('alpine', 'day').map((s) => s.id)).toContain('wheatear');
    expect(eligibleSpecies('tidal', 'day').map((s) => s.id)).toContain('knot');
    expect(eligibleSpecies('highlands', 'day').map((s) => s.id)).toContain('dotterel');
  });

  it('⚠️ a WINTER run STILL finds the summer visitor (rare-but-present — the anti-lockout pin)', () => {
    // meadow + dawn: quail (summer-visitor) competes with the resident mice/rabbit. In WINTER quail is
    // rarer (0.3×) but a seeded run still yields it — a winter player can always complete a summer species.
    const eligible = eligibleSpecies('meadow', 'dawn');
    const rng = createRng(20260612);
    let quailInWinter = 0;
    for (let i = 0; i < 4000; i++) {
      if (pickSpecies(eligible, 'winter', rng)!.id === 'quail') quailInWinter++;
    }
    expect(quailInWinter).toBeGreaterThan(0); // ⚠️ STILL FINDABLE in winter — never season-locked
  });
});

describe('§4.6 D1b — the abundance EMPHASIS direction (honest phenology)', () => {
  it('a summer visitor is MORE common in summer than winter, but PRESENT in both', () => {
    const eligible = eligibleSpecies('meadow', 'dawn');
    const count = (season: Season): number => {
      const rng = createRng(7);
      let n = 0;
      for (let i = 0; i < 4000; i++) if (pickSpecies(eligible, season, rng)!.id === 'quail') n++;
      return n;
    };
    const summer = count('summer');
    const winter = count('winter');
    expect(summer).toBeGreaterThan(winter); // the emphasis: summer-characteristic
    expect(winter).toBeGreaterThan(0); // but never gone
  });

  it('seasonalAbundance: summer visitors peak in summer, winter visitors peak in winter', () => {
    for (const id of SUMMER_VISITORS) {
      const s = SPECIES[id];
      expect(seasonalAbundance(s, 'summer')).toBeGreaterThan(seasonalAbundance(s, 'winter'));
    }
    for (const id of WINTER_VISITORS) {
      const s = SPECIES[id];
      expect(seasonalAbundance(s, 'winter')).toBeGreaterThan(seasonalAbundance(s, 'summer'));
    }
  });
});

describe('§4.6 D1b — the HONEST roster (a minority migratory, most flat — the omission discipline)', () => {
  it('residents are FLAT 1.0 every season (no seasonal weighting — most of the roster)', () => {
    const residents = SPECIES_ORDER.filter((id) => !SPECIES[id as SpeciesId].seasonTag);
    // §migration — 10 tagged migrants now (5 estuary winter-visitors join the proven 5); still the vast majority flat.
    expect(residents.length).toBeGreaterThan(SPECIES_ORDER.length - 13); // the vast majority are flat
    for (const id of residents) {
      for (const season of ALL_SEASONS) {
        expect(seasonalAbundance(SPECIES[id as SpeciesId], season)).toBe(1); // flat — byte 1.0
      }
    }
  });

  it('exactly the genuinely-migratory species are tagged (each consistent with its own card text)', () => {
    const tagged = SPECIES_ORDER.filter((id) => SPECIES[id as SpeciesId].seasonTag).sort();
    expect(tagged).toEqual([...TAGGED].sort());
    for (const id of SUMMER_VISITORS) expect(SPECIES[id].seasonTag).toBe('summer-visitor');
    for (const id of WINTER_VISITORS) expect(SPECIES[id].seasonTag).toBe('winter-visitor');
  });
});

describe('§4.6 D1b — the journal TEACHING note (the honest payload)', () => {
  it('each tag has an honest "scarce, never quite gone" note (the spine, taught not gated)', () => {
    expect(SEASONAL_NOTE['summer-visitor'].toLowerCase()).toContain('summer visitor');
    expect(SEASONAL_NOTE['winter-visitor'].toLowerCase()).toContain('winter visitor');
    for (const tag of ['summer-visitor', 'winter-visitor'] as const) {
      expect(SEASONAL_NOTE[tag].toLowerCase()).toContain('never quite gone'); // reinforces never-missable
    }
  });
});
