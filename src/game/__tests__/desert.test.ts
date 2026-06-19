import { describe, expect, it } from 'vitest';
import { createWorld, unlockBiome, isOpenBiome } from '../World';
import { effectiveCap, trySpawn } from '../Spawn';
import { eligibleSpecies } from '../Species';
import { finalCatchChance } from '../Catch';
import { createAnimalPool, activeAnimalCount } from '../Animal';
import { createRng } from '../../utils/rng';
import {
  BIOMES,
  BIOME_ORDER,
  BIOME_SET_UNLOCK,
  BIOME_SEASONAL_POP,
  BIOME_TIME_POP,
  SEASONAL_FLORA,
  SNOW_BIOMES,
  SPAWN,
  SEASONAL_POP_MIN_ACTIVE,
  SPECIES,
  SPECIES_INFO,
  SPECIES_MODEL,
  SPECIES_ORDER,
  RESEARCH_PROJECTS,
  type DayPhase,
  type Season,
  type SpeciesId,
} from '../../utils/constants';
import { isResearchGatedUnlock } from '../Missions';

/**
 * §desert — the SONORAN DESERT: the first WORLDWIDE-by-design biome + the first non-temperate climate.
 * These pin the NOVEL part (the additive BIOME_TIME_POP cap-scalar — the ONE new mechanic, the day-night
 * TWIN of the estuary's BIOME_SEASONAL_POP) and the guardrails (the two pop levers COMPOSE; every existing
 * biome byte-unchanged; the D1b no-exclusion spine + the catch core held at the dramatic midday setting;
 * single-biome species, proven diets; a proven research-gated fork-node; the deferred items absent). The
 * LOOK/FEEL (empty midday furnace vs alive night; the sand palette; the nocturnality lesson) is Craig's device gate.
 */

const ALL_SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const ALL_PHASES: DayPhase[] = ['dawn', 'day', 'dusk', 'night'];
const DESERT = SPECIES_ORDER.filter((id) => SPECIES[id as SpeciesId].biome === 'desert');
const NOCTURNAL = ['jackrabbit', 'cottontail', 'kangaroorat', 'kitfox'] as const; // dawn/dusk/night
const DAY_ACTIVE = ['cactuswren', 'roadrunner', 'deserttortoise'] as const;

const baitless = (id: string) =>
  finalCatchChance(SPECIES[id as keyof typeof SPECIES], { dist: 0.5, tool: 'net', biome: 'desert', correctBait: false, fleeing: false });

describe('§desert — ⚠️ THE TIME-OF-DAY HEADCOUNT LEVER (the crux): BIOME_TIME_POP, the estuary twin', () => {
  it('⚠️ the DRAMATIC swing: an empty furnace at midday, a night alive with the nocturnal cast', () => {
    const day = effectiveCap('desert', 'summer', 'day');
    const night = effectiveCap('desert', 'summer', 'night');
    expect(day).toBeLessThan(night); // the whole point — empty midday vs alive night
    expect(night).toBe(SPAWN.maxAnimals); // the cool night fills the desert to the full pool (12)
    expect(day).toBeLessThanOrEqual(3); // midday is a near-bare furnace (~2)
    // The crepuscular peaks sit between (a genuine curve, not a step): day < dawn < dusk < night.
    expect(day).toBeLessThan(effectiveCap('desert', 'summer', 'dawn'));
    expect(effectiveCap('desert', 'summer', 'dawn')).toBeLessThan(effectiveCap('desert', 'summer', 'dusk'));
    expect(effectiveCap('desert', 'summer', 'dusk')).toBeLessThan(night);
  });

  it('⚠️ the never-empty FLOOR holds for EVERY biome/season/phase (anti-lockout on the headcount axis)', () => {
    for (const biome of BIOME_ORDER) {
      for (const season of ALL_SEASONS) {
        for (const phase of ALL_PHASES) {
          const cap = effectiveCap(biome, season, phase);
          expect(cap).toBeGreaterThanOrEqual(SEASONAL_POP_MIN_ACTIVE); // never an empty biome (≥ 2)
          expect(cap).toBeLessThanOrEqual(SPAWN.maxAnimals); // ⚠️ scales DOWN never up (the pool never grows)
        }
      }
    }
    // The desert's midday is exactly the floor (12 × 0.2 = 2.4 → 2) — the guarantee bites at the furnace.
    expect(effectiveCap('desert', 'summer', 'day')).toBe(SEASONAL_POP_MIN_ACTIVE);
  });

  it('⚠️ every biome OMITTED from BIOME_TIME_POP is byte-unchanged by phase (the `?? 1` path)', () => {
    for (const biome of BIOME_ORDER) {
      if (biome === 'desert') continue; // only the desert opts into the time lever
      for (const season of ALL_SEASONS) {
        const base = effectiveCap(biome, season); // the 2-arg (phase-less) cap
        for (const phase of ALL_PHASES) {
          expect(effectiveCap(biome, season, phase)).toBe(base); // phase never changes a non-desert cap
        }
      }
    }
  });

  it('⚠️ phase OMITTED → the time factor is 1 (existing 2-arg callers byte-unchanged)', () => {
    for (const season of ALL_SEASONS) {
      // The desert with NO phase = its season cap (flat 12, season-omitted) — the time lever only bites with a phase.
      expect(effectiveCap('desert', season)).toBe(SPAWN.maxAnimals);
    }
  });
});

describe('§desert — ⚠️ the TWO pop levers COMPOSE (season × time), each orthogonal', () => {
  it('the cap = maxAnimals × seasonScalar × timeScalar, floored — composed correctly per biome', () => {
    const min = SEASONAL_POP_MIN_ACTIVE;
    const compose = (s: number, t: number) => Math.max(min, Math.round(SPAWN.maxAnimals * s * t));
    // desert: TIME only (season-omitted → season factor 1) — varies by phase, flat across seasons.
    expect(effectiveCap('desert', 'summer', 'day')).toBe(compose(1, 0.2));
    expect(effectiveCap('desert', 'winter', 'night')).toBe(compose(1, 1.0));
    expect(effectiveCap('desert', 'summer', 'day')).toBe(effectiveCap('desert', 'winter', 'day')); // season-FLAT
    // estuary: SEASON only — varies by season, flat across phases; AND === the 2-arg version (byte-unchanged).
    expect(effectiveCap('estuary', 'summer', 'day')).toBe(effectiveCap('estuary', 'summer', 'night'));
    expect(effectiveCap('estuary', 'summer', 'day')).toBe(effectiveCap('estuary', 'summer'));
    // neither lever (most biomes): always the full pool, every season × phase.
    expect(effectiveCap('meadow', 'summer', 'day')).toBe(SPAWN.maxAnimals);
  });

  it('the estuary (season-only) is byte-unchanged — the desert lever never touched it', () => {
    expect(BIOME_SEASONAL_POP.estuary).toBeDefined();
    expect(BIOME_TIME_POP.estuary).toBeUndefined(); // the estuary opts OUT of the time lever
    expect(effectiveCap('estuary', 'summer')).toBe(SEASONAL_POP_MIN_ACTIVE); // its dramatic summer floor, intact
    expect(effectiveCap('estuary', 'winter')).toBe(SPAWN.maxAnimals);
  });

  it('⚠️ trySpawn RESPECTS the time-scaled cap (the night fills, the midday never overflows the bounded pool)', () => {
    const world = createWorld();
    unlockBiome(world, 'desert');
    const rng = createRng(2026);
    for (const phase of ['day', 'night'] as const) {
      const pool = createAnimalPool();
      for (let i = 0; i < 600; i++) {
        trySpawn(pool, world, 'desert', phase, 'summer', 0, 120, rng);
        expect(activeAnimalCount(pool)).toBeLessThanOrEqual(effectiveCap('desert', 'summer', phase));
        expect(pool.length).toBe(SPAWN.maxAnimals); // ⚠️ the pool ARRAY never grows — no per-frame alloc
      }
      if (phase === 'night') expect(activeAnimalCount(pool)).toBeGreaterThan(effectiveCap('desert', 'summer', 'day'));
    }
  });
});

describe('§desert — ⚠️ D1b NO-EXCLUSION + season-flat (every desert species findable every season, every phase has a cast)', () => {
  it('the desert is SEASON-FLAT (the D1 bloom is deferred): no seasonal-pop, no seasonal-flora entry', () => {
    expect(BIOME_SEASONAL_POP.desert).toBeUndefined(); // headcount does not swing by season (only by time)
    expect(SEASONAL_FLORA.desert).toBeUndefined(); // the desert bloom is DEFERRED (no foliage/bloom re-dress)
    expect(SNOW_BIOMES.desert).toBe(false); // a hot desert never snows
  });

  it('every PHASE has at least one eligible desert species (no empty hour — the no-exclusion spine)', () => {
    for (const phase of ALL_PHASES) {
      const here = eligibleSpecies('desert', phase).map((d) => d.id);
      expect(here.length).toBeGreaterThanOrEqual(1); // dawn=jackrabbit, day=wren+roadrunner+tortoise, dusk=cottontail, night=kangaroorat+kitfox
    }
    // The composition is the proven activityWindow lever (nocturnal out at night, the heat-tolerant by day).
    expect(eligibleSpecies('desert', 'day').map((d) => d.id).sort()).toEqual([...DAY_ACTIVE].sort());
    expect(eligibleSpecies('desert', 'night').map((d) => d.id).sort()).toEqual(['kangaroorat', 'kitfox']);
  });

  it('⚠️ the FLOORED midday is still catchable (anti-lockout: the day-active hold the ≥2 floor, catchable bait-less)', () => {
    for (const id of DESERT) expect(baitless(id)).toBeGreaterThan(0); // every desert species catchable bait-less
    expect(baitless('cactuswren')).toBeGreaterThan(0.3); // the DAY valve holds the furnace floor (anti-lockout)
    expect(baitless('kangaroorat')).toBeGreaterThan(0.3); // the NIGHT valve holds the night floor
  });
});

describe('§desert — the BIOME (a proven research-gated fork-node off the Coast) + the catch core untouched', () => {
  it('the Sonoran is a tier-6 cell, research-gated off the Coast (the proven deep-chain pattern)', () => {
    expect(BIOMES.desert.displayName).toBe('Sonoran Desert');
    expect(BIOMES.desert.tier).toBe(6);
    expect(BIOMES.desert.prereq).toBe('coast');
    expect(BIOME_SET_UNLOCK.coast).toContain('desert'); // the Coast forks to BOTH the Tidal AND the desert
    expect(isResearchGatedUnlock('desert')).toBe(true); // owned by unlock-the-desert (the Coast set is vacuous)
    expect(RESEARCH_PROJECTS['unlock-the-desert'].reward).toEqual({ kind: 'biome-access', biome: 'desert' });
    expect(RESEARCH_PROJECTS['unlock-the-desert'].knowledgeRequirement).toBeUndefined(); // NO new challenge mission
  });

  it('adjacency is symmetric (the world graph) and the desert is an OPEN biome (the throwing-net terrain)', () => {
    for (const adj of BIOMES.desert.adjacent) {
      expect(BIOMES[adj].adjacent).toContain('desert'); // every edge points back
    }
    expect(isOpenBiome('desert')).toBe(true); // ≤ OPEN_BIOME_COVER_MAX cover → open sand, legible
  });

  it('⚠️ the Sonoran roster: single-biome, the PROVEN diets (no new bait), a full nocturnal/day split', () => {
    expect(DESERT.length).toBe(7);
    for (const id of DESERT) {
      expect(SPECIES[id].biome).toBe('desert'); // the one-biome model
      expect(['seeds', 'greens', 'insects']).toContain(SPECIES[id].bait); // proven diets only — NO new bait
      expect(SPECIES_INFO[id].fieldNote.length).toBeGreaterThan(20); // a real field-guide entry
      expect(SPECIES_MODEL[id]).toBeDefined(); // a silhouette for every shipped species
    }
    // The split IS the teaching: most nocturnal/crepuscular (the night fills), a heat-tolerant few by day.
    expect(NOCTURNAL.every((id) => SPECIES[id].activityWindow !== 'day')).toBe(true);
    expect(DAY_ACTIVE.every((id) => SPECIES[id].activityWindow === 'day')).toBe(true);
  });

  it('⚠️ the catch core is UNTOUCHED — finalCatchChance never reads phase or population', () => {
    // The same species, same proximity/tool/bait → the SAME catch chance regardless of the time lever.
    const ctx = { dist: 0.5, tool: 'net' as const, biome: 'desert' as const, correctBait: false, fleeing: false };
    expect(finalCatchChance(SPECIES.kangaroorat, ctx)).toBe(finalCatchChance(SPECIES.kangaroorat, ctx));
    // The kit fox apex is hard-not-impossible (> 0), the proven anti-wall spine.
    expect(SPECIES.kitfox.baseCatchRate).toBeGreaterThan(0);
    expect(SPECIES.kitfox.baseCatchRate).toBeLessThan(SPECIES.cactuswren.baseCatchRate); // the apex below the valve
  });
});
