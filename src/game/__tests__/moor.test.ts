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
} from '../../utils/constants';
import { finalCatchChance } from '../Catch';
import { evaluateCatch, reconcileResearchUnlocks, isResearchGatedUnlock, missionSetBiomes } from '../Missions';
import { startResearch, evaluateResearch, researchState, canStartResearch } from '../Research';
import { addCredits } from '../Economy';
import { unlockLines } from '../../rendering/unlockLines';
import { createJournal, JOURNAL_SCHEMA_VERSION } from '../../state/Journal';

/**
 * World Expansion — HEATHLAND/MOOR, the 1st BRANCHED biome (§4.2). The world goes 2D: the
 * Highlands set now forks to BOTH the Riverbank AND the Moor (BIOME_SET_UNLOCK successor arrays).
 * Proven Riverbank/Coast DATA-slice pattern (a new cell + 5 honest declining uplanders + an R2
 * gate) PLUS the branch (additive — the existing linear arms are unchanged) + a MULTI-CONDITION
 * access gate (the #92 unblock: catch the ptarmigan over its real GREENS diet, non-forced).
 */
const MOOR = ['twite', 'stonechat', 'redgrouse', 'curlew', 'reddeer'] as const;
const ev = (s: string, b: string, p: string) => ({ species: s, biome: b, phase: p }) as Parameters<typeof evaluateCatch>[1];
const baitlessStarter = (id: string) =>
  finalCatchChance(SPECIES[id as keyof typeof SPECIES], { dist: 0.5, tool: 'net', biome: 'moor', correctBait: false, fleeing: false });

describe('Moor — the biome (a new EAST cell, the world goes 2D)', () => {
  it('a tier-4 cell EAST of the Highlands, heather purple', () => {
    expect(BIOMES.moor.tier).toBe(4);
    expect(BIOMES.moor.prereq).toBe('highlands');
    expect(BIOMES.moor.bounds).toEqual({ minX: 60, minY: 20, maxX: 100, maxY: 60 }); // a new equal cell, east of [20,60]
    expect(BIOMES.moor.adjacent).toContain('highlands');
    expect(BIOMES.highlands.adjacent).toContain('moor'); // symmetric — the branch edge
  });

  it('a DRY moor: NO water, cover-SPARSE (2 spots) so the throwing net shines (no new mechanic)', () => {
    expect(WATER.filter((w) => w.biome === 'moor')).toHaveLength(0); // dry — no dip-net here
    expect(HIDING_SPOTS.filter((h) => h.biome === 'moor')).toHaveLength(2); // open biome, like the Highlands/Coast
    for (const id of MOOR) expect(!!SPECIES[id].fleesToWater).toBe(false); // nothing flees to water on a dry moor
  });
});

describe('Moor — the roster (honest diets + HONEST conservation status)', () => {
  it('5 species on the EXISTING diets (no new diet); honest, no fish on a dry moor', () => {
    for (const id of MOOR) {
      expect(SPECIES[id].biome).toBe('moor');
      expect(['seeds', 'greens', 'insects']).toContain(SPECIES[id].bait); // no fish — honest dry-moor diets
      expect(SPECIES[id].tier).toBeGreaterThanOrEqual(4);
      expect(SPECIES_INFO[id].fieldNote.length).toBeGreaterThan(20);
      expect(SPECIES_MODEL[id]).toBeDefined(); // a silhouette for every shipped species
    }
    expect(new Set(MOOR.map((id) => SPECIES[id].bait))).toEqual(new Set(['seeds', 'greens', 'insects'])); // all 3 honest diets
  });

  it('honest status: the declining hero (curlew) + the red-listed twite say so; the recovery (stonechat) too', () => {
    expect(SPECIES_INFO.curlew.status.toLowerCase()).toContain('threatened'); // the hero card — near-threatened
    expect(SPECIES_INFO.twite.status.toLowerCase()).toContain('declining'); // red-listed, declining
    expect(SPECIES_INFO.stonechat.status.toLowerCase()).toContain('recovery'); // a genuine recovery
    expect(SPECIES_INFO.redgrouse.fieldNote.toLowerCase()).toContain('nowhere else'); // British endemic
  });

  it('CJ2 gaits by tag: the four moor birds are BIRD, the red deer WALKs (each a real profile)', () => {
    for (const id of ['twite', 'stonechat', 'redgrouse', 'curlew'] as const) {
      expect(SPECIES[id].gait).toBe('bird');
    }
    expect(SPECIES.reddeer.gait).toBe('walk');
    for (const id of MOOR) expect(GAIT_PROFILES[SPECIES[id].gait]).toBeDefined(); // every tag resolves to a profile
  });
});

describe('Moor — ⚠️ anti-lockout (the twite valve catchable bait-less; ALL five catchable)', () => {
  it('the twite (the moorland linnet) is comfortably catchable bait-less; every species > 0', () => {
    expect(baitlessStarter('twite')).toBeGreaterThan(0.3); // the bait-less valve (no lockout)
    for (const id of MOOR) expect(baitlessStarter(id)).toBeGreaterThan(0); // every species catchable bait-less
    expect(baitlessStarter('reddeer')).toBeGreaterThan(0); // the apex (~0.14), still > 0
  });
});

describe('Moor — ⚠️ the BRANCH (additive: the existing linear arms are UNCHANGED)', () => {
  it('the Highlands set forks to BOTH the Riverbank AND the Moor; every OTHER link is unchanged', () => {
    expect(BIOME_SET_UNLOCK.highlands).toEqual(['riverbank', 'moor']); // the fork (order: existing arm first)
    // The linear chain is unchanged EXCEPT the Woodland, which the Pine Forest build forks (a 2nd arm,
    // additive — the Woodland→Wetland successor stays first). The Highlands fork (this slice) is intact.
    expect(BIOME_SET_UNLOCK.meadow).toEqual(['woodland']);
    expect(BIOME_SET_UNLOCK.woodland).toEqual(['wetland', 'pineforest']); // §4.2 — the pine fork (Wetland arm unchanged)
    expect(BIOME_SET_UNLOCK.wetland).toEqual(['highlands']);
    expect(BIOME_SET_UNLOCK.riverbank).toEqual(['coast', 'cave']); // §4.2 — the cave fork (Coast arm unchanged)
  });

  it('unlockLines is REGRESSION-free: the existing chain still emits exactly one line per gating set', () => {
    // The Highlands is a RESEARCH-gated source (no mission SET), so its fork is surfaced by the
    // research-area panel (next test), not the mission unlock-lines. The flatMap generalization
    // (one line PER successor) must leave the existing single-successor chain byte-for-byte: one
    // line for each gating set (meadow/woodland/wetland), so nothing the player sees regresses.
    const lines = unlockLines(createJournal());
    // The DISTINCT gating sets are exactly missionSetBiomes(), in chain order — no sets dropped. (The
    // Woodland now emits TWO lines — the Pine Forest fork — but that's an ADDED breadcrumb, not a drop;
    // the moor's own fork is off the Highlands, which has no mission set, so it isn't here.)
    const distinctSets = [...new Set(lines.map((l) => l.setBiome))];
    expect(distinctSets).toEqual(missionSetBiomes());
    const arms = lines.map((l) => `${l.setBiome}->${l.unlocks}`);
    expect(arms).toContain('meadow->woodland'); // the existing arms all still emit (no regression)
    expect(arms).toContain('woodland->wetland');
    expect(arms).toContain('wetland->highlands');
    for (const l of lines) expect(BIOME_SET_UNLOCK[l.setBiome]).toContain(l.unlocks); // each line's target is a real successor
  });

  it('⚠️ BOTH breadcrumbs show at the branch — each fork arm has its OWN research-area project (#37)', () => {
    const j = createJournal();
    // At the branch, BOTH reachable next-biomes surface a "how to reach" research breadcrumb — the
    // #37 research-area grouping. NOT one, NOT a silent wall on the second arm: each fork target has
    // its own biome-access project, area-tagged to itself, with activity in the (accessed) Highlands.
    for (const target of ['riverbank', 'moor'] as const) {
      const id = `unlock-the-${target}`;
      const p = RESEARCH_PROJECTS[id];
      expect(p.reward).toEqual({ kind: 'biome-access', biome: target }); // the breadcrumb's destination
      expect(p.area).toBe(target); // grouped under its OWN area in the research panel (#37)
      // The activity is in the (accessed) Highlands — doable from the branch point, never a silent wall.
      expect(p.activityRequirement).toEqual({ kind: 'catch-in-biome', biome: 'highlands', count: 4 });
      expect(canStartResearch(j, id)).toBe(true); // both arms are STARTABLE from the start (visible choice)
    }
  });
});

describe('Moor — ⚠️ the MULTI-CONDITION research gate (the #92 unblock in action)', () => {
  it('wired by DATA only: the fork extended + a cost-0 biome-access project, multi-condition mastery', () => {
    expect(BIOME_SET_UNLOCK.highlands).toContain('moor');
    expect(isResearchGatedUnlock('moor')).toBe(true);
    const p = RESEARCH_PROJECTS['unlock-the-moor'];
    expect(p.reward).toEqual({ kind: 'biome-access', biome: 'moor' });
    expect(p.cost).toBe(0); // win-required -> anti-wall
    expect(p.knowledgeRequirement).toBe('research-ptarmigan-greens');
    // The challenge is genuinely MULTI-condition: species AND bait (the #92 composition).
    expect(MISSIONS['research-ptarmigan-greens'].requirement).toEqual({
      kind: 'research',
      species: 'ptarmigan',
      bait: 'greens',
      count: 1,
    });
  });

  it('the activity + a flush wallet do NOT unlock it without the multi-condition mastery (by play)', () => {
    const j = createJournal();
    // Pre-meet the SHARED source gate (research-rabbit-dawn) so only the moor-specific challenge is left.
    evaluateCatch(j, ev('rabbit', 'meadow', 'dawn'));
    addCredits(j, 1000); // flush — must NOT buy past the knowledge gate
    startResearch(j, 'unlock-the-moor');
    for (let i = 0; i < 4; i++) evaluateResearch(j, ev('ptarmigan', 'highlands', 'day')); // activity done
    reconcileResearchUnlocks(j);
    expect(researchState(j, 'unlock-the-moor').completed).toBe(false); // the knowledge gate blocks it
    expect(j.unlockedBiomes).not.toContain('moor'); // STILL gated — knowledge by play

    // The multi-condition catch: ptarmigan over GREENS bait (its real diet).
    evaluateCatch(j, { species: 'ptarmigan', biome: 'highlands', phase: 'day', bait: 'greens' } as Parameters<typeof evaluateCatch>[1]);
    evaluateResearch(j, ev('ptarmigan', 'highlands', 'day')); // re-evaluate -> auto-complete
    reconcileResearchUnlocks(j);
    expect(j.unlockedBiomes).toContain('moor');
  });

  it('⚠️ the #48 inverse — BOTH failure modes: a bait-LESS ptarmigan AND a wrong-bait one fail', () => {
    // Failure mode 1: the right species, NO bait (bait-less) — never satisfies the bait condition.
    const baitless = createJournal();
    evaluateCatch(baitless, ev('ptarmigan', 'highlands', 'day')); // no bait field -> bait-less
    expect(baitless.missions['research-ptarmigan-greens']?.completed ?? false).toBe(false);

    // Failure mode 2: the right species, the WRONG bait (insects, not its greens diet) — fails too.
    const wrong = createJournal();
    evaluateCatch(wrong, { species: 'ptarmigan', biome: 'highlands', phase: 'day', bait: 'insects' } as Parameters<typeof evaluateCatch>[1]);
    expect(wrong.missions['research-ptarmigan-greens']?.completed ?? false).toBe(false);

    // The deliberate, knowledge-applying choice — the right species over its REAL diet — DOES satisfy it.
    const right = createJournal();
    evaluateCatch(right, { species: 'ptarmigan', biome: 'highlands', phase: 'day', bait: 'greens' } as Parameters<typeof evaluateCatch>[1]);
    expect(right.missions['research-ptarmigan-greens']?.completed).toBe(true);
  });
});

describe('Moor — no schema bump (the data slice is forward/back compatible)', () => {
  it('the journal schema version is UNCHANGED — a new biome is purely additive data', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(7); // unlockedBiomes is an unbounded string[]; no migration
  });
});
