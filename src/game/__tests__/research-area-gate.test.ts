import { describe, expect, it } from 'vitest';
import {
  evaluateCatch,
  reconcileResearchUnlocks,
  isResearchGatedUnlock,
  isBiomeGateMet,
} from '../Missions';
import { startResearch, evaluateResearch, researchState } from '../Research';
import { addCredits } from '../Economy';
import { createJournal } from '../../state/Journal';
import { unlockLines } from '../../rendering/unlockLines';
import { RESEARCH_PROJECTS } from '../../utils/constants';

/**
 * R2 (the Research Spine finale) — the §4.1c Wetland->Highlands gate, WRAPPED in research.
 * ⚠️ This gates CORE PROGRESSION on the educational core, so the cardinal pins are:
 * KNOWLEDGE-BY-PLAY (double-enforced — credits/activity can't bypass the mastery challenge),
 * ANTI-WALL (cost 0, activity starter-reachable, win reachable), and LEGIBILITY (the #37
 * block shows BOTH requirements). The win-reachability is pinned in l1-guards (Guard 3).
 */
type J = ReturnType<typeof createJournal>;
const ev = (s: string, b: string, p: string) => ({ species: s, biome: b, phase: p }) as Parameters<typeof evaluateCatch>[1];

/** Faithfully mirror main's catch boundary: missions + research + the research unlock reconcile. */
const boundaryCatch = (j: J, s: string, b: string, p: string): void => {
  const e = ev(s, b, p);
  evaluateCatch(j, e);
  evaluateResearch(j, e);
  reconcileResearchUnlocks(j);
};
const completeSets = (j: J): void => {
  for (let i = 0; i < 5; i++) boundaryCatch(j, 'fieldmouse', 'meadow', 'day');
  for (let i = 0; i < 2; i++) boundaryCatch(j, 'quail', 'meadow', 'dawn');
  for (let i = 0; i < 2; i++) boundaryCatch(j, 'hedgehog', 'meadow', 'dusk');
  for (let i = 0; i < 4; i++) boundaryCatch(j, 'redsquirrel', 'woodland', 'day');
  boundaryCatch(j, 'robin', 'woodland', 'dawn');
  boundaryCatch(j, 'roedeer', 'woodland', 'dusk');
  boundaryCatch(j, 'badger', 'woodland', 'night');
  for (let i = 0; i < 3; i++) boundaryCatch(j, 'mallard', 'wetland', 'day');
  boundaryCatch(j, 'frog', 'wetland', 'dawn');
};

describe('R2 — ⚠️ KNOWLEDGE-BY-PLAY on CORE progression (the cardinal pin, double-enforced)', () => {
  it('the Highlands does NOT unlock via activity + credits alone — research-mouse-night (by play) is still required', () => {
    const j = createJournal();
    completeSets(j); // wetland set done (but NOT the night mastery challenge)
    addCredits(j, 1000); // flush with credits — must NOT be able to buy past the gate
    startResearch(j, 'unlock-the-highlands');
    for (let i = 0; i < 4; i++) boundaryCatch(j, 'frog', 'wetland', 'day'); // the FULL activity ×4

    expect(researchState(j, 'unlock-the-highlands').progress).toBe(4); // activity complete
    expect(j.missions['research-mouse-night']?.completed ?? false).toBe(false); // mastery NOT demonstrated
    expect(researchState(j, 'unlock-the-highlands').completed).toBe(false); // the knowledgeRequirement blocks it
    expect(j.unlockedBiomes).not.toContain('highlands'); // STILL gated — credits/activity cannot substitute

    // The ONLY way through: the mastery challenge, BY PLAY.
    boundaryCatch(j, 'fieldmouse', 'meadow', 'night'); // research-mouse-night
    expect(j.unlockedBiomes).toContain('highlands'); // now the project completes + reconciles -> unlock
  });
});

describe('R2 — the wrap preserves the §4.1c gate (the project alone is not enough)', () => {
  it('the project completing WITHOUT the wetland set (isBiomeGateMet false) does NOT unlock — double-enforced', () => {
    const j = createJournal();
    boundaryCatch(j, 'fieldmouse', 'meadow', 'night'); // research-mouse-night (a meadow catch — no wetland set)
    startResearch(j, 'unlock-the-highlands');
    for (let i = 0; i < 4; i++) boundaryCatch(j, 'frog', 'wetland', 'day'); // activity ×4

    expect(researchState(j, 'unlock-the-highlands').completed).toBe(true); // the PROJECT is complete...
    expect(isBiomeGateMet(j, 'wetland')).toBe(false); // ...but the §4.1c gate (the wetland set) is NOT met
    expect(j.unlockedBiomes).not.toContain('highlands'); // so NO unlock — the wrap re-checks the gate
  });

  it('the Highlands is research-gated (evaluateCatch no longer auto-unlocks it); the gentle gates are not', () => {
    expect(isResearchGatedUnlock('highlands')).toBe(true);
    expect(isResearchGatedUnlock('woodland')).toBe(false);
    expect(isResearchGatedUnlock('wetland')).toBe(false);
  });
});

describe('R2 — ⚠️ ANTI-WALL (no paywall / no new wall on core progression)', () => {
  it('the gate costs 0 credits (zero wall risk) and a broke player can start + do the activity', () => {
    expect(RESEARCH_PROJECTS['unlock-the-highlands'].cost).toBe(0); // ZERO wall risk on core progression
    const j = createJournal(); // 0 credits
    expect(startResearch(j, 'unlock-the-highlands')).toBe(true); // no credit gate to start
    for (let i = 0; i < 4; i++) evaluateResearch(j, ev('frog', 'wetland', 'day')); // starter-reachable activity
    expect(researchState(j, 'unlock-the-highlands').progress).toBe(4); // completable with no credits, starter net
  });
});

describe('R2 — ⚠️ LEGIBILITY (#37 shows BOTH requirements — never a silent wall)', () => {
  it('the wetland unlock line shows the mastery challenge AND the research project + its live state', () => {
    const j = createJournal();
    const line = unlockLines(j).find((l) => l.setBiome === 'wetland')!;
    expect(line.requiredChallenges.map((c) => c.id)).toEqual(['research-mouse-night']); // the mastery gate
    expect(line.requiredResearch?.id).toBe('unlock-the-highlands'); // AND the research wrap
    expect(line.requiredResearch?.started).toBe(false);
    expect(line.requiredResearch?.completed).toBe(false);
    // gentle gates carry no research wrap:
    expect(unlockLines(j).find((l) => l.setBiome === 'meadow')!.requiredResearch).toBeNull();

    // the shown state tracks play: start it -> "started"; the activity advances the count.
    startResearch(j, 'unlock-the-highlands');
    evaluateResearch(j, ev('frog', 'wetland', 'day'));
    const after = unlockLines(j).find((l) => l.setBiome === 'wetland')!;
    expect(after.requiredResearch?.started).toBe(true);
    expect(after.requiredResearch?.progress).toBe(1);
  });
});

describe('R2 — the transition (existing saves stay coherent)', () => {
  it('a save already in the Highlands stays unlocked (the reconcile only adds — never re-locks)', () => {
    const j = createJournal();
    j.unlockedBiomes.push('highlands'); // a pre-R2 save that already reached it
    boundaryCatch(j, 'fieldmouse', 'meadow', 'day'); // a fresh catch re-evaluates everything
    expect(j.unlockedBiomes).toContain('highlands'); // still there — no re-lock
  });

  it('a mid-gate save (set + mastery done, not yet unlocked) re-evaluates cleanly via the research wrap', () => {
    const j = createJournal();
    completeSets(j);
    boundaryCatch(j, 'fieldmouse', 'meadow', 'night'); // §4.1c gate met, highlands NOT yet unlocked
    expect(j.unlockedBiomes).not.toContain('highlands'); // no stuck state — just needs the research

    startResearch(j, 'unlock-the-highlands');
    for (let i = 0; i < 4; i++) boundaryCatch(j, 'frog', 'wetland', 'day');
    expect(j.unlockedBiomes).toContain('highlands'); // re-evaluates + unlocks — clean
  });
});
