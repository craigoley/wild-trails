import { describe, expect, it } from 'vitest';
import {
  SPECIES,
  SPECIES_INFO,
  SPECIES_MODEL,
  BIOMES,
  WATER,
  HIDING_SPOTS,
  BIOME_SET_UNLOCK,
  RESEARCH_PROJECTS,
  MISSIONS,
  GAIT_PROFILES,
  PINE_RENDER,
} from '../../utils/constants';
import { finalCatchChance } from '../Catch';
import { evaluateCatch, reconcileResearchUnlocks, isResearchGatedUnlock } from '../Missions';
import { startResearch, evaluateResearch, researchState } from '../Research';
import { addCredits } from '../Economy';
import { unlockLines } from '../../rendering/unlockLines';
import { createJournal, JOURNAL_SCHEMA_VERSION } from '../../state/Journal';

/**
 * World Expansion — PINE FOREST / BOREAL (§4.2): the 1st CLOSED/dense biome + the 1st tall geometry.
 * Proven data-slice pattern + a 2nd branch (the Woodland set forks to BOTH the Wetland AND the Pine
 * Forest) + a multi-condition gate (#92). The dense pines are VISUAL atmosphere — these pins lock the
 * DATA + the branch + the gate + anti-lockout + the gaits; the dense LOOK + entity visibility are
 * Craig's device gate. NOTE: unlike the Moor (off the gating-less Highlands), the Woodland HAS a
 * mission set, so the fork's BOTH breadcrumbs surface directly in the mission unlock-lines.
 */
const PINE = ['crossbill', 'coaltit', 'crestedtit', 'capercaillie', 'pinemarten'] as const;
const ev = (s: string, b: string, p: string) => ({ species: s, biome: b, phase: p }) as Parameters<typeof evaluateCatch>[1];
const baitlessStarter = (id: string) =>
  finalCatchChance(SPECIES[id as keyof typeof SPECIES], { dist: 0.5, tool: 'net', biome: 'pineforest', correctBait: false, fleeing: false });

describe('Pine Forest — the biome (a new CLOSED cell NW of the Woodland)', () => {
  it('a tier-2 cell north of the Woodland, deep needle-green', () => {
    expect(BIOMES.pineforest.tier).toBe(2);
    expect(BIOMES.pineforest.prereq).toBe('woodland');
    expect(BIOMES.pineforest.bounds).toEqual({ minX: -20, minY: 60, maxX: 20, maxY: 100 }); // a new equal cell
    expect(BIOMES.pineforest.adjacent).toEqual(['woodland', 'riverbank', 'desert']);
    expect(BIOMES.woodland.adjacent).toContain('pineforest'); // symmetric — the fork edge
    expect(BIOMES.riverbank.adjacent).toContain('pineforest');
  });

  it('a DRY forest: NO water; the dense PINES are atmosphere (its cover is the usual LOW spots)', () => {
    expect(WATER.filter((w) => w.biome === 'pineforest')).toHaveLength(0); // dry — no dip-net here
    expect(HIDING_SPOTS.filter((h) => h.biome === 'pineforest')).toHaveLength(2); // low cover spots
    // The tall pine scatter is a SEPARATE visual layer — instanced + capped (mobile-safe), not cover.
    expect(PINE_RENDER.maxHeight).toBeLessThanOrEqual(2.6); // modest height (a hint of density, not burial)
    expect(PINE_RENDER.clearingRadius).toBeGreaterThan(0); // a clearing at the play centre
  });
});

describe('Pine Forest — the roster (honest Caledonian-pinewood; the conservation stakes)', () => {
  it('5 species on the EXISTING diets (no new diet, no fish on a dry forest); no wildcat', () => {
    for (const id of PINE) {
      expect(SPECIES[id].biome).toBe('pineforest');
      expect(['seeds', 'greens', 'insects']).toContain(SPECIES[id].bait); // honest forest diets
      expect(SPECIES_INFO[id].fieldNote.length).toBeGreaterThan(20);
      expect(SPECIES_MODEL[id]).toBeDefined(); // a silhouette for every shipped species
    }
    // red squirrel is NOT reused (it stays a Woodland species).
    expect(SPECIES.redsquirrel.biome).toBe('woodland');
  });

  it('honest status: the nomadic crossbill, the on-the-brink capercaillie hero, the marten recovery', () => {
    expect(SPECIES_INFO.crossbill.status.toLowerCase()).toContain('nomadic'); // the red crossbill — worldwide, wanders the cone crops
    expect(SPECIES_INFO.capercaillie.status.toLowerCase()).toContain('brink'); // ⚠️ the hero — on the brink
    expect(SPECIES_INFO.pinemarten.status.toLowerCase()).toContain('recovery'); // a genuine recovery
    expect(SPECIES_INFO.coaltit.status.toLowerCase()).toContain('common'); // doing well
  });

  it('CJ2 gaits by tag: the four pinewood birds are BIRD, the pine marten WALKs (each a real profile)', () => {
    for (const id of ['crossbill', 'coaltit', 'crestedtit', 'capercaillie'] as const) {
      expect(SPECIES[id].gait).toBe('bird');
    }
    expect(SPECIES.pinemarten.gait).toBe('walk');
    for (const id of PINE) expect(GAIT_PROFILES[SPECIES[id].gait]).toBeDefined();
  });
});

describe('Pine Forest — ⚠️ anti-lockout (the crossbill valve catchable bait-less; ALL five catchable)', () => {
  it('the crossbill (a calm cone seed-eater) is comfortably catchable bait-less; every species > 0', () => {
    expect(baitlessStarter('crossbill')).toBeGreaterThan(0.3); // the bait-less valve (no lockout)
    for (const id of PINE) expect(baitlessStarter(id)).toBeGreaterThan(0); // every species catchable bait-less
    expect(baitlessStarter('pinemarten')).toBeGreaterThan(0); // the apex (~0.18), still > 0
  });
});

describe('Pine Forest — ⚠️ the BRANCH (additive: the existing Woodland→Wetland arm is UNCHANGED)', () => {
  it('the Woodland set forks to BOTH the Wetland AND the Pine Forest; the Wetland arm stays first', () => {
    expect(BIOME_SET_UNLOCK.woodland).toEqual(['wetland', 'pineforest']); // the fork (existing arm first)
    // Every OTHER link unchanged (the meadow→woodland source + the highlands fork from the Moor build):
    expect(BIOME_SET_UNLOCK.meadow).toEqual(['woodland', 'hedgerow']); // §hedgerow — the meadow set now forks to the corridor too
    expect(BIOME_SET_UNLOCK.wetland).toEqual(['highlands']);
    expect(BIOME_SET_UNLOCK.highlands).toEqual(['riverbank', 'moor']);
  });

  it('⚠️ BOTH breadcrumbs show at the Woodland fork — the mission unlock-lines emit a line for EACH arm', () => {
    // Unlike the Moor (off the gating-less Highlands), the WOODLAND has a mission SET, so BOTH fork arms
    // surface directly in the unlock-lines (the strongest "branching = a visible choice" — never a
    // silent wall on the 2nd). The Pine arm carries its own research breadcrumb.
    const lines = unlockLines(createJournal());
    const fromWoodland = lines.filter((l) => l.setBiome === 'woodland');
    expect(fromWoodland.map((l) => l.unlocks)).toEqual(['wetland', 'pineforest']); // BOTH, in order
    const pineLine = fromWoodland.find((l) => l.unlocks === 'pineforest')!;
    expect(pineLine.unlocksName).toBe('Pine Forest');
    expect(pineLine.requiredResearch?.id).toBe('unlock-the-pineforest'); // the pine arm's "how to reach"
    // The Wetland arm is a gentle gate (no research wrap) — its breadcrumb shows without a research step.
    expect(fromWoodland.find((l) => l.unlocks === 'wetland')!.requiredResearch).toBeNull();
  });
});

describe('Pine Forest — ⚠️ the MULTI-CONDITION research gate (the #92 unblock)', () => {
  it('wired by DATA only: the fork + a cost-0 biome-access project on a multi-condition mastery', () => {
    expect(BIOME_SET_UNLOCK.woodland).toContain('pineforest');
    expect(isResearchGatedUnlock('pineforest')).toBe(true);
    const p = RESEARCH_PROJECTS['unlock-the-pineforest'];
    expect(p.reward).toEqual({ kind: 'biome-access', biome: 'pineforest' });
    expect(p.cost).toBe(0); // win-required -> anti-wall
    expect(p.knowledgeRequirement).toBe('research-squirrel-seeds');
    expect(MISSIONS['research-squirrel-seeds'].requirement).toEqual({
      kind: 'research',
      species: 'redsquirrel',
      bait: 'seeds',
      count: 1,
    });
  });

  it('the activity + a flush wallet do NOT unlock it without the multi-condition mastery (by play)', () => {
    const j = createJournal();
    // The Woodland SOURCE set must be complete too (the fork's shared gate — the Woodland HAS a set,
    // unlike the Moor's gating-less Highlands source). Complete it, leaving only the pine challenge.
    for (let i = 0; i < 4; i++) evaluateCatch(j, ev('redsquirrel', 'woodland', 'day')); // woodland-survey
    evaluateCatch(j, ev('robin', 'woodland', 'dawn')); // woodland-dawn
    evaluateCatch(j, ev('roedeer', 'woodland', 'dusk')); // woodland-dusk
    evaluateCatch(j, ev('badger', 'woodland', 'night')); // track-badger → the Woodland set is complete
    addCredits(j, 1000); // flush — must NOT buy past the knowledge gate
    startResearch(j, 'unlock-the-pineforest');
    for (let i = 0; i < 4; i++) evaluateResearch(j, ev('redsquirrel', 'woodland', 'day')); // activity done
    reconcileResearchUnlocks(j);
    expect(researchState(j, 'unlock-the-pineforest').completed).toBe(false); // the knowledge gate blocks it
    expect(j.unlockedBiomes).not.toContain('pineforest'); // STILL gated — knowledge by play

    evaluateCatch(j, { species: 'redsquirrel', biome: 'woodland', phase: 'day', bait: 'seeds' } as Parameters<typeof evaluateCatch>[1]);
    evaluateResearch(j, ev('redsquirrel', 'woodland', 'day')); // re-evaluate -> auto-complete
    reconcileResearchUnlocks(j);
    expect(j.unlockedBiomes).toContain('pineforest');
  });

  it('⚠️ the #48 inverse — BOTH failure modes: a bait-LESS squirrel AND a wrong-bait one fail', () => {
    const baitless = createJournal();
    evaluateCatch(baitless, ev('redsquirrel', 'woodland', 'day')); // no bait → bait-less
    expect(baitless.missions['research-squirrel-seeds']?.completed ?? false).toBe(false);

    const wrong = createJournal();
    evaluateCatch(wrong, { species: 'redsquirrel', biome: 'woodland', phase: 'day', bait: 'insects' } as Parameters<typeof evaluateCatch>[1]);
    expect(wrong.missions['research-squirrel-seeds']?.completed ?? false).toBe(false);

    const right = createJournal();
    evaluateCatch(right, { species: 'redsquirrel', biome: 'woodland', phase: 'day', bait: 'seeds' } as Parameters<typeof evaluateCatch>[1]);
    expect(right.missions['research-squirrel-seeds']?.completed).toBe(true); // the real diet — the deliberate choice
  });
});

describe('Pine Forest — no schema bump (the data slice is forward/back compatible)', () => {
  it('the journal schema version is UNCHANGED — a new biome + species are purely additive data', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(7); // unlockedBiomes is an unbounded string[]; no migration
  });
});
