import { describe, expect, it } from 'vitest';
import {
  startResearch,
  evaluateResearch,
  completeResearch,
  isResearchReady,
  researchState,
} from '../../Research';
import { addCredits } from '../../Economy';
import { createJournal } from '../../../state/Journal';

/**
 * L1 — the TWO CARDINAL research guards. These permanently enforce the spine's
 * non-negotiables (§4.1.4 / P8 / P1-3): research advances by ACTIVITY not time, and a
 * knowledge requirement is met by PLAY, never bought. Pure (no sim/render needed).
 */
const ev = (species: string, biome: string, phase: string) =>
  ({ species, biome, phase }) as Parameters<typeof evaluateResearch>[1];

describe('L1 Research Guard 1 — ⚠️ ACTIVITY, never time (the P8 dark-pattern guard)', () => {
  it('a started project advances ONLY on a matching catch — never from time/non-catch events', () => {
    const j = createJournal();
    addCredits(j, 50);
    startResearch(j, 'study-hedgehog'); // catch-species hedgehog ×3
    expect(researchState(j, 'study-hedgehog').progress).toBe(0);

    // A NON-matching catch does not advance it.
    evaluateResearch(j, ev('fieldmouse', 'meadow', 'day'));
    expect(researchState(j, 'study-hedgehog').progress).toBe(0);

    // ⚠️ "Time passing" with NO catches cannot advance it — the engine has NO time/dt
    // path AT ALL (its only advance is evaluateResearch on a catch event). Simulate a
    // long idle (many "frames"/cycles, no catches): progress stays 0.
    for (let i = 0; i < 1000; i++) {
      /* time elapses; nothing is caught — there is deliberately no time-based advance to call */
    }
    expect(researchState(j, 'study-hedgehog').progress).toBe(0);

    // Only the matching ACTION advances it.
    evaluateResearch(j, ev('hedgehog', 'meadow', 'dusk'));
    expect(researchState(j, 'study-hedgehog').progress).toBe(1);
  });
});

describe('L1 Research Guard 2 — ⚠️ KNOWLEDGE by PLAY, never bought (P1/P2/P3)', () => {
  it('a project with a knowledgeRequirement completes ONLY once the mastery-challenge is met by play', () => {
    const j = createJournal();
    addCredits(j, 100); // plenty of credits — must NOT be able to buy past the knowledge gate
    startResearch(j, 'study-after-dark'); // activity: 3 night catches; knowledge: research-mouse-night

    // Do the full activity (3 night catches) — and the player is flush with credits.
    for (let i = 0; i < 3; i++) evaluateResearch(j, ev('fieldmouse', 'meadow', 'night'));

    // Activity done + credits available, but the knowledge requirement (a §4.1c mastery
    // challenge) is NOT met -> the project is NOT ready and CANNOT be completed. Credits +
    // activity cannot substitute for demonstrated knowledge.
    expect(isResearchReady(j, 'study-after-dark')).toBe(false);
    expect(completeResearch(j, 'study-after-dark')).toBeNull();
    expect(researchState(j, 'study-after-dark').completed).toBe(false);

    // The ONLY way through: complete the mastery-challenge BY PLAY (as evaluateCatch sets it).
    j.missions['research-mouse-night'] = { progress: 1, completed: true };
    expect(isResearchReady(j, 'study-after-dark')).toBe(true);
    expect(completeResearch(j, 'study-after-dark')).not.toBeNull(); // now it completes
  });
});
