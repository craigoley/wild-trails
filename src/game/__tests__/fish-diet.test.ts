import { describe, expect, it } from 'vitest';
import {
  SPECIES,
  SPECIES_ORDER,
  BAIT,
  BAIT_ORDER,
  RESEARCH_GATED_BAITS,
  RESEARCH_PROJECTS,
  startingBaitCount,
} from '../../utils/constants';
import { finalCatchChance, calmMultiplier } from '../Catch';
import { isCorrectBaitFor, type BaitState } from '../Bait';
import { isBaitUnlocked, researchProjectForBait, startResearch, evaluateResearch } from '../Research';
import { addCredits } from '../Economy';
import { createJournal, JOURNAL_SCHEMA_VERSION } from '../../state/Journal';

/**
 * Diet expansion §4.1.5 — the FISH diet. A 4th diet/bait, research-gated, bringing the
 * held-back kingfisher + otter into Riverbank. The catch FORMULA + the diet→bait MATCH are
 * untouched (fish is a pure enum addition); zero re-pins of shipped species; fish bait is a
 * ×3.5 multiplier, never required (anti-lockout); the unlock derives from journal.research.
 */
const baitlessStarter = (id: string) =>
  finalCatchChance(SPECIES[id as keyof typeof SPECIES], { dist: 0.5, tool: 'net', biome: 'riverbank', correctBait: false, fleeing: false });

describe('Fish diet — a 4th diet; the catch formula + the match are untouched', () => {
  it('fish is a BaitId; the kingfisher + otter eat it (the new fish-eaters)', () => {
    expect(BAIT_ORDER).toContain('fish');
    expect(SPECIES.kingfisher.bait).toBe('fish');
    expect(SPECIES.otter.bait).toBe('fish');
  });

  it('the diet→bait match works GENERICALLY for fish (isCorrectBaitFor unchanged)', () => {
    const fishOnTarget = { activeType: 'fish', timer: 5 } as unknown as BaitState;
    expect(isCorrectBaitFor(SPECIES.kingfisher, fishOnTarget)).toBe(true); // fish-eater + fish bait
    expect(isCorrectBaitFor(SPECIES.hedgehog, fishOnTarget)).toBe(false); // insectivore + fish bait = no match
    // the calm is the SAME ×3.5 boolean input — no new formula value:
    expect(calmMultiplier(true, false)).toBe(BAIT.correctCalm);
    expect(calmMultiplier(false, false)).toBe(1.0);
  });
});

describe('Fish diet — ⚠️ ZERO re-pins (every shipped diet was already correct)', () => {
  it('the fish-eaters are kingfisher + otter (Riverbank) + herring gull + grey seal (Coast); shipped diets unchanged', () => {
    const fishEaters = SPECIES_ORDER.filter((id) => SPECIES[id].bait === 'fish').sort();
    expect(fishEaters).toEqual(['eel', 'greyseal', 'herringgull', 'kingfisher', 'otter']); // + the §4.2 Cave eel
    // the species fish would be WRONG for keep their correct diets:
    expect(SPECIES.mallard.bait).toBe('greens'); // dabbles for plants — not a fish-diver
    expect(SPECIES.dipper.bait).toBe('insects'); // eats aquatic insect LARVAE — not fish
    expect(SPECIES.frog.bait).toBe('insects');
  });
});

describe('Fish diet — ⚠️ anti-lockout (fish bait is convenience, never required)', () => {
  it('the kingfisher + otter are catchable BAIT-LESS with the starter (fish bait eases, never gates)', () => {
    expect(baitlessStarter('kingfisher')).toBeGreaterThan(0);
    expect(baitlessStarter('otter')).toBeGreaterThan(0); // the apex catch — hard, but catchable bait-less
  });

  it('fish bait is the SAME ×3.5 force-multiplier as any correct bait (no/wrong bait still catchable)', () => {
    expect(calmMultiplier(true, false)).toBe(BAIT.correctCalm); // 3.5 — the reward for the right diet
    expect(calmMultiplier(false, false)).toBe(1.0); // bait-less is never blocked
  });
});

describe('Fish diet — the research gate (bait-access, the 4th reward kind)', () => {
  it('fish starts at 0 (research-gated); the study-aquatic-life project rewards bait-access:fish', () => {
    expect(RESEARCH_GATED_BAITS).toContain('fish');
    expect(startingBaitCount('fish')).toBe(0);
    expect(startingBaitCount('seeds')).toBe(BAIT.startingCount); // the 3 originals stocked
    const p = RESEARCH_PROJECTS['study-aquatic-life'];
    expect(p.reward).toEqual({ kind: 'bait-access', bait: 'fish' });
    expect(p.knowledgeRequirement).toBeUndefined(); // optional convenience — no mastery gate
    expect(researchProjectForBait('fish')?.id).toBe('study-aquatic-life');
  });

  it('fish bait unlocks when the study project completes (derived from journal.research — no extra state)', () => {
    const j = createJournal();
    expect(isBaitUnlocked(j, 'fish')).toBe(false); // locked initially
    expect(isBaitUnlocked(j, 'seeds')).toBe(true); // the 3 originals always unlocked

    addCredits(j, RESEARCH_PROJECTS['study-aquatic-life'].cost);
    startResearch(j, 'study-aquatic-life');
    for (let i = 0; i < 4; i++) evaluateResearch(j, { species: 'reedbunting', biome: 'riverbank', phase: 'day' } as Parameters<typeof evaluateResearch>[1]);

    expect(isBaitUnlocked(j, 'fish')).toBe(true); // now buyable in the Field Supply
  });

  it('no schema bump — fish-starts-at-0 needs no migration (still v7; a fresh journal has fish 0)', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(7);
    expect(createJournal().bait.fish).toBe(0);
  });
});
