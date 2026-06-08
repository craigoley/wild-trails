import { describe, expect, it } from 'vitest';
import {
  SPECIES,
  SPECIES_INFO,
  BIOMES,
  WATER,
  BIOME_SET_UNLOCK,
  RESEARCH_PROJECTS,
} from '../../utils/constants';
import { finalCatchChance } from '../Catch';
import { evaluateCatch, reconcileResearchUnlocks, isResearchGatedUnlock } from '../Missions';
import { startResearch, evaluateResearch, researchState } from '../Research';
import { addCredits } from '../Economy';
import { createJournal } from '../../state/Journal';

/**
 * World Expansion — RIVERBANK, the first NEW biome (§4.2). A DATA slice: a new tiled cell +
 * 4 species (existing 3 diets) + a research gate (R2 generalized). Reuses the #55 water (the
 * water vole flees in — the dip-net call-back) + the rectangular clamp (unchanged). These pin
 * the anti-lockout valve, the research gate (knowledge-by-play), and the NON-FORCED challenge.
 */
const RIVERBANK = ['reedbunting', 'watervole', 'greywagtail', 'dipper'] as const;
const ev = (s: string, b: string, p: string) => ({ species: s, biome: b, phase: p }) as Parameters<typeof evaluateCatch>[1];
const baitlessStarter = (id: string) =>
  finalCatchChance(SPECIES[id as keyof typeof SPECIES], { dist: 0.5, tool: 'net', biome: 'riverbank', correctBait: false, fleeing: false });

describe('Riverbank — the biome + the roster (a data slice, no new mechanic)', () => {
  it('a tier-4 cell north of the Highlands, with a river (the reused #55 water discs)', () => {
    expect(BIOMES.riverbank.tier).toBe(4);
    expect(BIOMES.riverbank.prereq).toBe('highlands');
    expect(BIOMES.riverbank.bounds).toEqual({ minX: 20, minY: 60, maxX: 60, maxY: 100 }); // a new equal cell
    expect(WATER.filter((w) => w.biome === 'riverbank').length).toBeGreaterThanOrEqual(1); // the river reuses the disc mechanic
  });

  it('4 species on the EXISTING 3 diets (NO fish), each tier 4-5 with a field-guide card', () => {
    for (const id of RIVERBANK) {
      expect(SPECIES[id].biome).toBe('riverbank');
      expect(['seeds', 'greens', 'insects']).toContain(SPECIES[id].bait); // existing diets only
      expect(SPECIES[id].tier).toBeGreaterThanOrEqual(4); // harder roster
      expect(SPECIES_INFO[id].fieldNote.length).toBeGreaterThan(20); // the #45 teaching card
    }
    expect(new Set(RIVERBANK.map((id) => SPECIES[id].bait))).toEqual(new Set(['seeds', 'greens', 'insects'])); // all 3 diets covered
  });

  it('the water vole flees INTO the water (the dip-net call-back); the other three do not', () => {
    expect(SPECIES.watervole.fleesToWater).toBe(true);
    for (const id of ['reedbunting', 'greywagtail', 'dipper'] as const) {
      expect(!!SPECIES[id].fleesToWater).toBe(false);
    }
  });
});

describe('Riverbank — ⚠️ anti-lockout (the easiest catchable bait-less with the starter)', () => {
  it('the reed bunting (the valve) is comfortably catchable bait-less; ALL four are catchable (no lockout)', () => {
    expect(baitlessStarter('reedbunting')).toBeGreaterThan(0.3); // the comfortable valve
    for (const id of RIVERBANK) expect(baitlessStarter(id)).toBeGreaterThan(0); // every species catchable bait-less
    // the reed bunting is the easiest of the Riverbank roster:
    for (const id of ['watervole', 'greywagtail', 'dipper'] as const) {
      expect(SPECIES.reedbunting.baseCatchRate).toBeGreaterThan(SPECIES[id].baseCatchRate);
    }
  });
});

describe('Riverbank — ⚠️ the research gate (R2 generalized, knowledge-by-play double-enforced)', () => {
  it('wired by DATA only: BIOME_SET_UNLOCK extended + a cost-0 biome-access project', () => {
    expect(BIOME_SET_UNLOCK.highlands).toBe('riverbank');
    expect(isResearchGatedUnlock('riverbank')).toBe(true);
    const p = RESEARCH_PROJECTS['unlock-the-riverbank'];
    expect(p.reward).toEqual({ kind: 'biome-access', biome: 'riverbank' });
    expect(p.cost).toBe(0); // Riverbank is win-required -> zero wall risk (anti-wall)
    expect(p.knowledgeRequirement).toBe('research-rabbit-dawn');
  });

  it('the activity + a flush wallet do NOT unlock it without the mastery challenge (by play)', () => {
    const j = createJournal();
    addCredits(j, 1000); // flush — must NOT buy past the knowledge gate
    startResearch(j, 'unlock-the-riverbank');
    for (let i = 0; i < 4; i++) evaluateResearch(j, ev('ptarmigan', 'highlands', 'day')); // activity done
    reconcileResearchUnlocks(j);

    expect(j.missions['research-rabbit-dawn']?.completed ?? false).toBe(false);
    expect(researchState(j, 'unlock-the-riverbank').completed).toBe(false); // the knowledgeRequirement blocks it
    expect(j.unlockedBiomes).not.toContain('riverbank'); // STILL gated — knowledge by play

    // The ONLY way through: the mastery challenge, by play.
    evaluateCatch(j, ev('rabbit', 'meadow', 'dawn')); // research-rabbit-dawn
    evaluateResearch(j, ev('ptarmigan', 'highlands', 'day')); // a catch re-evaluates -> auto-complete
    reconcileResearchUnlocks(j);
    expect(j.unlockedBiomes).toContain('riverbank');
  });
});

describe('Riverbank — ⚠️ the NON-FORCED mastery challenge (the #48 inverse)', () => {
  it('normal progression does NOT auto-satisfy research-rabbit-dawn — the player must CHOOSE dawn', () => {
    const j = createJournal();
    // The meadow set (normal play): fieldmouse@day, quail@dawn, hedgehog@dusk — none is a rabbit@dawn.
    for (let i = 0; i < 5; i++) evaluateCatch(j, ev('fieldmouse', 'meadow', 'day'));
    for (let i = 0; i < 2; i++) evaluateCatch(j, ev('quail', 'meadow', 'dawn'));
    for (let i = 0; i < 2; i++) evaluateCatch(j, ev('hedgehog', 'meadow', 'dusk'));
    evaluateCatch(j, ev('rabbit', 'meadow', 'night')); // a normal rabbit catch — NOT at dawn
    expect(j.missions['research-rabbit-dawn']?.completed ?? false).toBe(false); // NON-FORCED — not auto-satisfied

    // The deliberate field-craft: a rabbit AT DAWN completes it (the rabbit is any-window, so this is a choice).
    evaluateCatch(j, ev('rabbit', 'meadow', 'dawn'));
    expect(j.missions['research-rabbit-dawn']?.completed).toBe(true);
  });

  it('is reliably completable — a rabbit caught at dawn in the always-open meadow (anti-wall)', () => {
    const j = createJournal();
    evaluateCatch(j, ev('rabbit', 'meadow', 'dawn'));
    expect(j.missions['research-rabbit-dawn']?.completed).toBe(true);
  });
});
