import { describe, expect, it } from 'vitest';
import { isOpenBiome } from '../World';
import { eligibleSpecies } from '../Species';
import { finalCatchChance } from '../Catch';
import {
  BIOMES,
  BIOME_SET_UNLOCK,
  BIOME_SEASONAL_POP,
  BIOME_TIME_POP,
  SEASONAL_FLORA,
  SNOW_BIOMES,
  BAIT_ORDER,
  BAIT_DISPLAY,
  RESEARCH_GATED_BAITS,
  SPECIES,
  SPECIES_INFO,
  SPECIES_MODEL,
  SPECIES_ORDER,
  RESEARCH_PROJECTS,
  type BaitId,
  type DayPhase,
} from '../../utils/constants';
import { isResearchGatedUnlock } from '../Missions';

/**
 * §savanna — the AFRICAN SAVANNA (worldwide rebalance R1): the first African biome + the most iconic world
 * fauna (lion/zebra/giraffe). These pin the NOVEL part (the additive 6th MEAT diet — the proven
 * shellfish-bait pattern) and the guardrails (the existing 5 diets + every existing species' diet
 * byte-unchanged; the catch core untouched; single-biome real CO-OCCURRING Serengeti fauna, the blender
 * forbidden; a proven research-gated fork-node, zero clamp change; D1b no-exclusion). The LOOK/FEEL (iconic
 * + distinct + the food web legible + the big mammals render right) is Craig's device gate.
 */

const ALL_PHASES: DayPhase[] = ['dawn', 'day', 'dusk', 'night'];
const SAVANNA = SPECIES_ORDER.filter((id) => SPECIES[id].biome === 'savanna');
const baitless = (id: string) =>
  finalCatchChance(SPECIES[id as keyof typeof SPECIES], { dist: 0.5, tool: 'net', biome: 'savanna', correctBait: false, fleeing: false });

describe('§savanna — ⚠️ THE 6TH DIET: MEAT (the new mechanic; the proven shellfish-bait pattern)', () => {
  it('the meat diet exists across the proven bait tables, additive after shellfish', () => {
    expect(BAIT_ORDER).toContain('meat');
    expect(BAIT_ORDER[BAIT_ORDER.length - 1]).toBe('meat'); // appended last, after the 5
    expect(BAIT_DISPLAY.meat).toEqual({ label: 'Meat', icon: 'meat' });
    expect(RESEARCH_GATED_BAITS).toContain('meat'); // gated like fish/shellfish — NEVER required (anti-lockout)
  });

  it('ONLY the lion has the meat diet — the existing 5 diets + every existing species are byte-unchanged', () => {
    const meatEaters = SPECIES_ORDER.filter((id) => SPECIES[id].bait === 'meat');
    expect(meatEaters).toEqual(['lion']); // a lion eats meat (honest — the small-prey 'insects' proxy can't stretch to a lion)
    // No NON-savanna species carries the new diet (meat is additive, only on the new apex).
    for (const id of SPECIES_ORDER) {
      if (SPECIES[id].biome !== 'savanna') {
        expect((['seeds', 'greens', 'insects', 'fish', 'shellfish'] as BaitId[])).toContain(SPECIES[id].bait);
      }
    }
  });

  it('⚠️ the catch core is UNTOUCHED — finalCatchChance just READS the diet (meat is a value, not a formula term)', () => {
    const ctx = { dist: 0.5, tool: 'net' as const, biome: 'savanna' as const, correctBait: false, fleeing: false };
    // Same lion, same ctx → same chance (pure); correct bait (meat) calms it via the SAME calm factor as any diet.
    expect(finalCatchChance(SPECIES.lion, ctx)).toBe(finalCatchChance(SPECIES.lion, ctx));
    expect(finalCatchChance(SPECIES.lion, { ...ctx, correctBait: true })).toBeGreaterThan(finalCatchChance(SPECIES.lion, ctx));
  });

  it('the meat bait is acquired by the proven research project (study-the-savanna-hunters → bait-access)', () => {
    const proj = RESEARCH_PROJECTS['study-the-savanna-hunters'];
    expect(proj.reward).toEqual({ kind: 'bait-access', bait: 'meat' });
    expect(proj.activityRequirement).toEqual({ kind: 'catch-in-biome', biome: 'savanna', count: 4 }); // mirrors the shellfish project
  });
});

describe('§savanna — the BIOME (a proven research-gated fork-node off the Desert) + zero clamp change', () => {
  it('the African Savanna is a tier-7 cell, research-gated off the Desert (the proven deep-chain pattern)', () => {
    expect(BIOMES.savanna.displayName).toBe('African Savanna');
    expect(BIOMES.savanna.tier).toBe(7);
    expect(BIOMES.savanna.prereq).toBe('desert');
    expect(BIOME_SET_UNLOCK.desert).toContain('savanna'); // the Desert's arm
    expect(isResearchGatedUnlock('savanna')).toBe(true); // owned by unlock-the-savanna
    expect(RESEARCH_PROJECTS['unlock-the-savanna'].reward).toEqual({ kind: 'biome-access', biome: 'savanna' });
    expect(RESEARCH_PROJECTS['unlock-the-savanna'].knowledgeRequirement).toBeUndefined(); // NO new challenge mission
  });

  it('adjacency is symmetric, the biome is OPEN grassland, and season-flat (no new pop levers)', () => {
    for (const adj of BIOMES.savanna.adjacent) {
      expect(BIOMES[adj].adjacent).toContain('savanna'); // every edge points back (the world graph)
    }
    expect(isOpenBiome('savanna')).toBe(true); // ≤ OPEN_BIOME_COVER_MAX cover → open plain, the throwing-net biome
    expect(BIOME_SEASONAL_POP.savanna).toBeUndefined(); // no season headcount lever (the migration is copy, not a mechanic)
    expect(BIOME_TIME_POP.savanna).toBeUndefined(); // no time headcount lever (the desert's lever stays the desert's)
    expect(SEASONAL_FLORA.savanna).toBeUndefined(); // season-flat — the golden grass is the identity
    expect(SNOW_BIOMES.savanna).toBe(false); // a tropical savanna never snows
  });
});

describe('§savanna — the SERENGETI roster (real CO-OCCURRING fauna; single-biome; the food web)', () => {
  it('⚠️ real co-occurring Serengeti cast — single-biome, the iconic species, NO blender', () => {
    expect(SAVANNA.sort()).toEqual(['elephant', 'gazelle', 'giraffe', 'lion', 'ostrich', 'wildebeest', 'zebra']);
    // ⚠️ the blender forbidden: NO meerkat (Kalahari, not the Serengeti) — the recon's exclusion held.
    expect(SPECIES_ORDER).not.toContain('meerkat' as never);
    for (const id of SAVANNA) {
      expect(SPECIES[id].biome).toBe('savanna'); // the one-biome model
      expect(SPECIES_INFO[id].fieldNote.length).toBeGreaterThan(20); // a real field-guide entry
      expect(SPECIES_MODEL[id]).toBeDefined(); // a silhouette for every shipped species
    }
  });

  it('the food web: the LION apex (meat) over the grazing herds (proven greens/seeds — no new bait but the lion)', () => {
    expect(SPECIES.lion.bait).toBe('meat'); // the apex predator
    // the herbivore prey-base maps to the PROVEN diets (greens) + the granivore ostrich (seeds) — no new bait needed.
    for (const id of ['zebra', 'wildebeest', 'gazelle', 'giraffe', 'elephant'] as const) {
      expect(SPECIES[id].bait).toBe('greens');
    }
    expect(SPECIES.ostrich.bait).toBe('seeds');
  });

  it('⚠️ D1b no-exclusion: every phase has ≥1 eligible species (the elephant any-window + the night lion)', () => {
    for (const phase of ALL_PHASES) {
      expect(eligibleSpecies('savanna', phase).length).toBeGreaterThanOrEqual(1);
    }
    // the rhythm: the grazing herds by DAY, the lion hunts at NIGHT, the elephant out round the clock.
    expect(SPECIES.lion.activityWindow).toBe('night');
    expect(SPECIES.elephant.activityWindow).toBe('any');
    expect(eligibleSpecies('savanna', 'night').map((d) => d.id).sort()).toEqual(['elephant', 'lion']);
  });

  it('⚠️ anti-lockout: the zebra valve is comfortably catchable bait-less; every species catchable (the lion apex > 0)', () => {
    expect(baitless('zebra')).toBeGreaterThan(0.5); // the bait-less day valve (the prey-base)
    for (const id of SAVANNA) expect(baitless(id)).toBeGreaterThan(0); // every species catchable bait-less (meat eases the lion, never gates)
    expect(SPECIES.lion.baseCatchRate).toBeLessThan(SPECIES.zebra.baseCatchRate); // the apex below the valve
  });

  it('the iconic big mammals use the new dedicated render kinds; the grazers reuse the proven quadruped', () => {
    expect(SPECIES_MODEL.giraffe.kind).toBe('giraffe'); // the long-neck silhouette
    expect(SPECIES_MODEL.elephant.kind).toBe('elephant'); // the trunk + bulk silhouette
    expect(SPECIES_MODEL.ostrich.kind).toBe('bird');
    for (const id of ['lion', 'zebra', 'wildebeest', 'gazelle'] as const) {
      expect(SPECIES_MODEL[id].kind).toBe('mouse'); // the generic quadruped base, scaled + colored
    }
  });
});
