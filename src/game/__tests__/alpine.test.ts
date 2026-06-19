import { describe, expect, it } from 'vitest';
import {
  SPECIES,
  SPECIES_INFO,
  SPECIES_MODEL,
  SPECIES_ORDER,
  BIOMES,
  WATER,
  HIDING_SPOTS,
  SUPPLY_POSTS,
  BIOME_SET_UNLOCK,
  RESEARCH_PROJECTS,
  MISSIONS,
  GAIT_PROFILES,
  TUNING,
  type SpeciesId,
} from '../../utils/constants';
import { finalCatchChance } from '../Catch';
import { createBaitState, deployBait, isCorrectBaitFor } from '../Bait';
import { evaluateCatch, reconcileResearchUnlocks, isResearchGatedUnlock, isBiomeSetComplete } from '../Missions';
import { startResearch, evaluateResearch, researchState } from '../Research';
import { addCredits } from '../Economy';
import { createJournal, JOURNAL_SCHEMA_VERSION } from '../../state/Journal';

/**
 * World Expansion — ALPINE / MONTANE SUMMIT (§4.2): the difficulty CEILING. A PURE DATA slice — the
 * difficulty is TUNING existing knobs (baseCatchRate / detectionRadius / baseFleeSpeed + the biome's LOW
 * cover), the catch FORMULA untouched. These pins lock the crux (a TAME snow-bunting valve keeps the
 * anti-lockout FLOOR fair DESPITE zero cover — wariness, not cover, is the dial), the wary apex CEILING
 * (hard-not-impossible — base rate > 0), the honest climate-pressured roster (no raptor), the Moor
 * extension (additive — the Moor's prior terminus behaviour unchanged), and the #92 gate. The summit
 * LOOK + the difficulty FEEL are Craig's device call.
 */
const ALPINE = ['snowbunting', 'meadowpipit', 'wheatear', 'goldenplover', 'ringouzel'] as const;
const ev = (s: string, b: string, p: string) => ({ species: s, biome: b, phase: p }) as Parameters<typeof evaluateCatch>[1];
// The bait-less, calm, point-blank-ish starter attempt (net, no bait, NOT fleeing) — the anti-lockout read.
const baitlessStarter = (id: string) =>
  finalCatchChance(SPECIES[id as keyof typeof SPECIES], { dist: 0.5, tool: 'net', biome: 'alpine', correctBait: false, fleeing: false });

describe('Alpine — the biome (the bare summit; tier 5, low cover, dry; the Moor extension)', () => {
  it('a tier-5 cell E of the Moor (NOT a Tier widen), bare cold-grey scree, dry, 1 sparse boulder', () => {
    expect(BIOMES.alpine.tier).toBe(5); // ⚠️ moor(4)+1 — the access depth, NOT the catch difficulty (no Tier widen)
    expect(BIOMES.alpine.prereq).toBe('moor');
    expect(BIOMES.alpine.bounds).toEqual({ minX: 100, minY: 20, maxX: 140, maxY: 60 }); // east of the Moor
    expect(BIOMES.alpine.adjacent).toEqual(['moor']);
    expect(BIOMES.moor.adjacent).toContain('alpine'); // symmetric
    // ⚠️ The exposure IS the difficulty: the LOWEST cover in the game — exactly ONE 'rocks' boulder.
    const cover = HIDING_SPOTS.filter((h) => h.biome === 'alpine');
    expect(cover).toHaveLength(1);
    expect(cover[0].kind).toBe('rocks');
    expect(WATER.filter((w) => w.biome === 'alpine')).toHaveLength(0); // a dry summit — no dip-net here
    expect(SUPPLY_POSTS.filter((p) => p.biome === 'alpine')).toHaveLength(1);
  });

  it('5 honest summit specialists, all BIRD gait, full field-guide entries + models', () => {
    for (const id of ALPINE) {
      expect(SPECIES[id].biome).toBe('alpine');
      expect(SPECIES[id].gait).toBe('bird'); // reuses the bird model — NO new render character
      expect(GAIT_PROFILES[SPECIES[id].gait]).toBeDefined();
      expect(SPECIES[id].tier).toBe(5);
      expect(SPECIES_INFO[id].fieldNote.length).toBeGreaterThan(40);
      expect(SPECIES_MODEL[id].kind).toBe('bird');
      expect(SPECIES[id].baseFleeSpeed).toBeLessThan(TUNING.maxSpeed); // catchable on foot
    }
    // ⚠️ NO raptor — the roster is insect-leaning + the one seed-eating valve (the eagle/raven dropped).
    expect(SPECIES.snowbunting.bait).toBe('seeds');
    for (const id of ['meadowpipit', 'wheatear', 'goldenplover', 'ringouzel'] as const) {
      expect(SPECIES[id].bait).toBe('insects');
    }
    expect(SPECIES_ORDER.length).toBe(69); // +5 Alpine +6 §hedgerow chain
  });

  it('honest climate-pressured status: the snow bunting "nowhere higher"; the declining apex ouzel', () => {
    expect(SPECIES_INFO.snowbunting.status.toLowerCase()).toContain('nowhere higher');
    expect(SPECIES_INFO.goldenplover.status.toLowerCase()).toContain('declining');
    expect(SPECIES_INFO.ringouzel.status.toLowerCase()).toContain('declining'); // the climate casualty
  });
});

describe('Alpine — ⚠️ THE ANTI-LOCKOUT FLOOR (the crux: a TAME valve, not cover)', () => {
  it('the snow bunting is the LEAST wary in the game + the highest summit base rate (the tame dial)', () => {
    // ⚠️ Wariness, not cover, is the dial: the lowest detectionRadius in the WHOLE roster means it never
    // spooks even approached exposed → it stays calm → no flee penalty → catchable with zero cover.
    const minDetection = Math.min(...SPECIES_ORDER.map((id) => SPECIES[id as SpeciesId].detectionRadius));
    expect(SPECIES.snowbunting.detectionRadius).toBe(minDetection);
    // It carries the highest base rate on the summit (the fair floor).
    for (const id of ALPINE) {
      if (id === 'snowbunting') continue;
      expect(SPECIES.snowbunting.baseCatchRate).toBeGreaterThan(SPECIES[id].baseCatchRate);
    }
  });

  it('the snow bunting clears anti-lockout BAIT-LESS, calm, with ZERO cover (the floor stays fair)', () => {
    // The valve bar: a comfortable bait-less catch (the dunlin/twite valve precedent), DESPITE the
    // low-cover biome — because its TAMENESS (not a stealth route) carries it.
    expect(baitlessStarter('snowbunting')).toBeGreaterThan(0.3);
    // Every summit species is catchable bait-less (> 0) — bait eases, it NEVER gates.
    for (const id of ALPINE) expect(baitlessStarter(id)).toBeGreaterThan(0);
  });
});

describe('Alpine — ⚠️ THE CEILING (the wary apex: hard, never a wall)', () => {
  it('the ring ouzel is the WARIEST (highest detectionRadius) + the global hardest base rate, still > 0', () => {
    const maxDetection = Math.max(...SPECIES_ORDER.map((id) => SPECIES[id as SpeciesId].detectionRadius));
    expect(SPECIES.ringouzel.detectionRadius).toBe(maxDetection); // the wariest in the game (spooks at range)
    const minRate = Math.min(...SPECIES_ORDER.map((id) => SPECIES[id as SpeciesId].baseCatchRate));
    expect(SPECIES.ringouzel.baseCatchRate).toBe(minRate); // the genuine ceiling
    expect(SPECIES.ringouzel.baseCatchRate).toBeLessThan(SPECIES.dotterel.baseCatchRate); // below the old highlands floor (0.12)
    expect(SPECIES.ringouzel.baseCatchRate).toBeGreaterThan(0); // ⚠️ catchable — NOT clamped to a wall
  });

  it('the apex is catchable WITH MASTERY: the net + a calm, correct-bait, point-blank attempt', () => {
    // Hard-not-impossible: at point-blank (dist 0) with the calm correct-bait bonus, the apex gives a
    // real, repeatable chance (the throwing-net + the one boulder + patience is the design answer).
    const mastery = finalCatchChance(SPECIES.ringouzel, { dist: 0, tool: 'net', biome: 'alpine', correctBait: true, fleeing: false });
    expect(mastery).toBeGreaterThan(0.3); // a real chance, earned — never a wall
    // The strictly-descending difficulty band: snowbunting (valve) → ring ouzel (apex), all > 0.
    for (let i = 0; i < ALPINE.length - 1; i++) {
      expect(SPECIES[ALPINE[i]].baseCatchRate).toBeGreaterThan(SPECIES[ALPINE[i + 1]].baseCatchRate);
    }
  });
});

describe('Alpine — the diet gate holds (the catch formula is untouched — it tunes INPUTS)', () => {
  for (const id of ALPINE) {
    it(`${id}: its diet bait helps; a wrong bait does nothing`, () => {
      const species = SPECIES[id];
      const ctx = (correctBait: boolean) => ({ dist: 0.5, tool: 'net' as const, biome: 'alpine' as const, correctBait, fleeing: false });
      const right = createBaitState();
      right.selected = species.bait;
      deployBait(right, 0, 0);
      expect(isCorrectBaitFor(species, right)).toBe(true);

      const wrongId = (['seeds', 'insects'] as const).find((b) => b !== species.bait)!;
      const wrong = createBaitState();
      wrong.selected = wrongId;
      deployBait(wrong, 0, 0);
      expect(isCorrectBaitFor(species, wrong)).toBe(false);

      expect(finalCatchChance(species, ctx(true))).toBeGreaterThan(finalCatchChance(species, ctx(false)));
    });
  }
});

describe('Alpine — the Moor extension + the #92 gate (additive; species+bait, no phase)', () => {
  it('the Moor (a former TERMINUS) gains its FIRST arm — moor → [alpine] (a single-successor extension)', () => {
    expect(BIOME_SET_UNLOCK.moor).toEqual(['alpine']); // additive — the Moor was terminal
    expect(isResearchGatedUnlock('alpine')).toBe(true);
    // ⚠️ Every OTHER link unchanged (the earlier forks intact — the branch is purely additive):
    expect(BIOME_SET_UNLOCK.coast).toEqual(['tidal', 'desert']);
    expect(BIOME_SET_UNLOCK.highlands).toEqual(['riverbank', 'moor']);
    expect(BIOME_SET_UNLOCK.riverbank).toEqual(['coast', 'cave']);
    // The Moor has no mission SET of its own (the Moor/Cave pattern) → its set is trivially complete.
    expect(isBiomeSetComplete(createJournal(), 'moor')).toBe(true);
  });

  it('the gate is research-grouse-greens (species+bait, NO phase) + a cost-0 unlock-the-alpine', () => {
    const p = RESEARCH_PROJECTS['unlock-the-alpine'];
    expect(p.reward).toEqual({ kind: 'biome-access', biome: 'alpine' });
    expect(p.cost).toBe(0);
    expect(p.knowledgeRequirement).toBe('research-grouse-greens');
    const req = MISSIONS['research-grouse-greens'].requirement as { kind: string; phase?: unknown; species?: string; bait?: string };
    expect(req).toEqual({ kind: 'research', species: 'redgrouse', bait: 'greens', count: 1 });
    expect(req.phase).toBeUndefined(); // species + bait, no phase
    expect(MISSIONS['research-grouse-greens'].biome).toBe('moor'); // the breadcrumb lives in the prereq
  });

  it('⚠️ the #48 inverse — a bait-LESS grouse AND a wrong-bait one fail; the real diet completes it', () => {
    const baitless = createJournal();
    evaluateCatch(baitless, ev('redgrouse', 'moor', 'day'));
    expect(baitless.missions['research-grouse-greens']?.completed ?? false).toBe(false);
    const wrong = createJournal();
    evaluateCatch(wrong, { species: 'redgrouse', biome: 'moor', phase: 'day', bait: 'insects' } as Parameters<typeof evaluateCatch>[1]);
    expect(wrong.missions['research-grouse-greens']?.completed ?? false).toBe(false);
    const right = createJournal();
    evaluateCatch(right, { species: 'redgrouse', biome: 'moor', phase: 'day', bait: 'greens' } as Parameters<typeof evaluateCatch>[1]);
    expect(right.missions['research-grouse-greens']?.completed).toBe(true);
  });

  it('the activity + a flush wallet do NOT unlock it without the mastery (knowledge by play)', () => {
    const j = createJournal();
    addCredits(j, 1000);
    startResearch(j, 'unlock-the-alpine');
    for (let i = 0; i < 4; i++) evaluateResearch(j, ev('twite', 'moor', 'day')); // activity done (catch-in-moor)
    reconcileResearchUnlocks(j);
    expect(researchState(j, 'unlock-the-alpine').completed).toBe(false);
    expect(j.unlockedBiomes).not.toContain('alpine');
    // The mastery (the real diet) + one more activity tick → the unlock fires (double-enforced).
    evaluateCatch(j, { species: 'redgrouse', biome: 'moor', phase: 'day', bait: 'greens' } as Parameters<typeof evaluateCatch>[1]);
    evaluateResearch(j, ev('twite', 'moor', 'day'));
    reconcileResearchUnlocks(j);
    expect(j.unlockedBiomes).toContain('alpine');
  });
});

describe('Alpine — no schema bump (pure data: no new diet, no Tier widen, no state change)', () => {
  it('the journal schema version is UNCHANGED — a biome + 5 species are purely additive data', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(7); // no new bait, no journal-shape change
  });
});
