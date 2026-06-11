import { describe, expect, it } from 'vitest';
import {
  SPECIES,
  SPECIES_INFO,
  SPECIES_MODEL,
  SPECIES_ORDER,
  BIOMES,
  WATER,
  HIDING_SPOTS,
  BAIT_ORDER,
  BAIT_DISPLAY,
  RESEARCH_GATED_BAITS,
  BIOME_SET_UNLOCK,
  RESEARCH_PROJECTS,
  MISSIONS,
  GAIT_PROFILES,
  startingBaitCount,
  type SpeciesId,
} from '../../utils/constants';
import { finalCatchChance } from '../Catch';
import { isCorrectBaitFor, createBaitState, deployBait } from '../Bait';
import { evaluateCatch, reconcileResearchUnlocks, isResearchGatedUnlock } from '../Missions';
import { startResearch, evaluateResearch, researchState } from '../Research';
import { addCredits } from '../Economy';
import { createJournal, JOURNAL_SCHEMA_VERSION } from '../../state/Journal';

/**
 * World Expansion — TIDAL / SALTMARSH / ESTUARY (§4.2): the 5th SHELLFISH diet + the oystercatcher home.
 * The diet is the only catch-adjacent part — these pins lock that it's the CLEAN fish-diet ENUM pattern
 * (the catch formula is diet-agnostic; ZERO re-pins; shellfish ONLY on the true mollusc-eaters) and the
 * anti-lockout bait valve, plus the biome/branch/#92-gate/Tier-widen. The marsh look is Craig's device gate.
 */
const TIDAL = ['dunlin', 'oystercatcher', 'redshank', 'avocet', 'knot'] as const;
const ev = (s: string, b: string, p: string) => ({ species: s, biome: b, phase: p }) as Parameters<typeof evaluateCatch>[1];
const baitlessStarter = (id: string) =>
  finalCatchChance(SPECIES[id as keyof typeof SPECIES], { dist: 0.5, tool: 'net', biome: 'tidal', correctBait: false, fleeing: false });

describe('Tidal — ⚠️ THE 5th DIET is the CLEAN fish-diet ENUM pattern (zero catch-core change, zero re-pins)', () => {
  it('shellfish is a BaitId in the order, research-gated (starts 0), and DISPLAY/icon complete', () => {
    expect(BAIT_ORDER).toContain('shellfish');
    expect(RESEARCH_GATED_BAITS).toContain('shellfish'); // gated like fish — never required
    expect(startingBaitCount('shellfish')).toBe(0); // a fresh player has none (until researched)
    expect(BAIT_DISPLAY.shellfish).toEqual({ label: 'Shellfish', icon: 'shell' }); // TS-forced completeness
  });

  it('the catch formula is DIET-AGNOSTIC — correct shellfish bait calms exactly like correct fish bait', () => {
    // finalCatchChance reads a `correctBait` BOOLEAN, never the diet. So a correct-bait bonus is the
    // SAME regardless of which diet — proof shellfish needed no formula change. (oystercatcher = shellfish,
    // greyseal = fish; both at the same base would calm identically — here we just pin the boolean path.)
    const shellfishSp = SPECIES.oystercatcher;
    const withBait = finalCatchChance(shellfishSp, { dist: 0.5, tool: 'net', biome: 'tidal', correctBait: true, fleeing: false });
    const without = finalCatchChance(shellfishSp, { dist: 0.5, tool: 'net', biome: 'tidal', correctBait: false, fleeing: false });
    expect(withBait).toBeGreaterThan(without); // the generic calm bonus applies to the new diet
    // isCorrectBaitFor is a generic equality — shellfish bait matches a shellfish-eater, nothing else.
    const s = createBaitState();
    s.counts.shellfish = 1;
    s.selected = 'shellfish';
    deployBait(s, 0, 0);
    expect(isCorrectBaitFor(SPECIES.oystercatcher, s)).toBe(true); // the shellfish-eater
    expect(isCorrectBaitFor(SPECIES.dunlin, s)).toBe(false); // an insect-eater — wrong bait, no bonus
  });

  it('⚠️ ZERO re-pins — every PRE-tidal species keeps its diet; shellfish appears ONLY on the new eaters', () => {
    // Representative anchors across the 4 existing diets are byte-identical (the fish-diet discipline).
    expect(SPECIES.fieldmouse.bait).toBe('seeds');
    expect(SPECIES.ptarmigan.bait).toBe('greens');
    expect(SPECIES.dipper.bait).toBe('insects');
    expect(SPECIES.kingfisher.bait).toBe('fish');
    expect(SPECIES.turnstone.bait).toBe('insects'); // the coast wader stays insects (its gate diet)
    // The ONLY shellfish species in the whole roster are the two true mollusc-eaters:
    const shellfishEaters = SPECIES_ORDER.filter((id) => SPECIES[id as SpeciesId].bait === 'shellfish').sort();
    expect(shellfishEaters).toEqual(['knot', 'oystercatcher']);
  });
});

describe('Tidal — the biome + roster (honest estuary waders; shellfish only on the true eaters)', () => {
  it('a tier-6 cell east of the Coast (the Tier widen), olive-mud saltmarsh, water-heavy', () => {
    expect(BIOMES.tidal.tier).toBe(6); // ⚠️ past the tier-5 Coast — the Tier widen
    expect(BIOMES.tidal.prereq).toBe('coast');
    expect(BIOMES.tidal.bounds).toEqual({ minX: 60, minY: 100, maxX: 100, maxY: 140 });
    expect(BIOMES.tidal.adjacent).toEqual(['coast']);
    expect(BIOMES.coast.adjacent).toContain('tidal'); // symmetric
    expect(WATER.filter((w) => w.biome === 'tidal').length).toBeGreaterThanOrEqual(2); // tidal pools (#55 reused)
    expect(HIDING_SPOTS.filter((h) => h.biome === 'tidal')).toHaveLength(2);
  });

  it('5 honest waders; shellfish ONLY on oystercatcher + knot; the worm-eaters stay insects', () => {
    for (const id of TIDAL) {
      expect(SPECIES[id].biome).toBe('tidal');
      expect(SPECIES[id].gait).toBe('bird'); // all waders fly
      expect(GAIT_PROFILES[SPECIES[id].gait]).toBeDefined();
      expect(SPECIES_INFO[id].fieldNote.length).toBeGreaterThan(20);
      expect(SPECIES_MODEL[id]).toBeDefined();
      expect(!!SPECIES[id].fleesToWater).toBe(false); // waders fly to flee — they don't dive into the pools
    }
    expect(SPECIES.oystercatcher.bait).toBe('shellfish'); // the real cockle/mussel diet — home at last
    expect(SPECIES.knot.bait).toBe('shellfish');
    for (const id of ['dunlin', 'redshank', 'avocet'] as const) expect(SPECIES[id].bait).toBe('insects'); // honest
  });

  it('honest status: the avocet recovery; the declining redshank + the near-threatened knot', () => {
    expect(SPECIES_INFO.avocet.status.toLowerCase()).toContain('success'); // back from British extinction
    expect(SPECIES_INFO.redshank.status.toLowerCase()).toContain('declining');
    expect(SPECIES_INFO.knot.status.toLowerCase()).toContain('threatened'); // ⚠️ near-threatened
    expect(SPECIES_INFO.oystercatcher.status.toLowerCase()).toContain('decline'); // amber-listed, recent decline
  });
});

describe('Tidal — ⚠️ anti-lockout (the fish-bait rule: shellfish NEVER required)', () => {
  it('the dunlin valve + the shellfish-eaters are ALL catchable bait-less; shellfish bait starts locked', () => {
    expect(baitlessStarter('dunlin')).toBeGreaterThan(0.3); // the bait-less valve
    for (const id of TIDAL) expect(baitlessStarter(id)).toBeGreaterThan(0);
    // ⚠️ the shellfish-eaters are catchable WITHOUT shellfish bait (it eases, never gates):
    expect(baitlessStarter('oystercatcher')).toBeGreaterThan(0);
    expect(baitlessStarter('knot')).toBeGreaterThan(0); // the apex (~0.2), still > 0
    // a fresh player has zero shellfish bait (research-gated) — yet is never locked out (above).
    expect(createJournal().bait.shellfish ?? startingBaitCount('shellfish')).toBe(0);
  });

  it('the study-the-shellfish-eaters project unlocks the bait (OPTIONAL, a cost sink — never required)', () => {
    const p = RESEARCH_PROJECTS['study-the-shellfish-eaters'];
    expect(p.reward).toEqual({ kind: 'bait-access', bait: 'shellfish' });
    expect(p.cost).toBeGreaterThan(0); // an OPTIONAL credit sink (not core-progression)
    expect('knowledgeRequirement' in p ? p.knowledgeRequirement : undefined).toBeUndefined(); // no knowledge gate
  });
});

describe('Tidal — the branch + the #92 gate (the Coast extension; species+bait, no phase)', () => {
  it('the Coast (a former TERMINUS) gains its FIRST arm — coast → [tidal] (a single-successor extension)', () => {
    expect(BIOME_SET_UNLOCK.coast).toEqual(['tidal']); // additive — the Coast was terminal
    expect(isResearchGatedUnlock('tidal')).toBe(true);
    // Every other link unchanged (the earlier forks intact):
    expect(BIOME_SET_UNLOCK.riverbank).toEqual(['coast', 'cave']);
    expect(BIOME_SET_UNLOCK.highlands).toEqual(['riverbank', 'moor']);
  });

  it('the gate is research-turnstone-insects (species+bait, NO phase) + a cost-0 unlock-the-tidal', () => {
    const p = RESEARCH_PROJECTS['unlock-the-tidal'];
    expect(p.reward).toEqual({ kind: 'biome-access', biome: 'tidal' });
    expect(p.cost).toBe(0);
    expect(p.knowledgeRequirement).toBe('research-turnstone-insects');
    const req = MISSIONS['research-turnstone-insects'].requirement as { kind: string; phase?: unknown; species?: string; bait?: string };
    expect(req).toEqual({ kind: 'research', species: 'turnstone', bait: 'insects', count: 1 });
    expect(req.phase).toBeUndefined(); // species + bait, no phase
  });

  it('⚠️ the #48 inverse — a bait-LESS turnstone AND a wrong-bait one fail; the real diet completes it', () => {
    const baitless = createJournal();
    evaluateCatch(baitless, ev('turnstone', 'coast', 'day'));
    expect(baitless.missions['research-turnstone-insects']?.completed ?? false).toBe(false);
    const wrong = createJournal();
    evaluateCatch(wrong, { species: 'turnstone', biome: 'coast', phase: 'day', bait: 'fish' } as Parameters<typeof evaluateCatch>[1]);
    expect(wrong.missions['research-turnstone-insects']?.completed ?? false).toBe(false);
    const right = createJournal();
    evaluateCatch(right, { species: 'turnstone', biome: 'coast', phase: 'day', bait: 'insects' } as Parameters<typeof evaluateCatch>[1]);
    expect(right.missions['research-turnstone-insects']?.completed).toBe(true);
  });

  it('the activity + a flush wallet do NOT unlock it without the mastery (by play)', () => {
    const j = createJournal();
    addCredits(j, 1000);
    startResearch(j, 'unlock-the-tidal');
    for (let i = 0; i < 4; i++) evaluateResearch(j, ev('linnet', 'coast', 'day')); // activity done
    reconcileResearchUnlocks(j);
    expect(researchState(j, 'unlock-the-tidal').completed).toBe(false);
    expect(j.unlockedBiomes).not.toContain('tidal');
    evaluateCatch(j, { species: 'turnstone', biome: 'coast', phase: 'day', bait: 'insects' } as Parameters<typeof evaluateCatch>[1]);
    evaluateResearch(j, ev('linnet', 'coast', 'day'));
    reconcileResearchUnlocks(j);
    expect(j.unlockedBiomes).toContain('tidal');
  });
});

describe('Tidal — no schema bump (the diet ENUM is forward/back compatible, like fish)', () => {
  it('the schema version is UNCHANGED — a 5th bait + a biome are purely additive data', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(7); // bait counts are a Record<BaitId,number>; a missing key defaults to 0
  });
});
