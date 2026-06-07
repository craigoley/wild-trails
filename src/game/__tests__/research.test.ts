import { describe, expect, it } from 'vitest';
import {
  startResearch,
  canStartResearch,
  evaluateResearch,
  completeResearch,
  isResearchReady,
  researchState,
} from '../Research';
import { addCredits } from '../Economy';
import { createJournal } from '../../state/Journal';
import { RESEARCH_PROJECTS, RESEARCH_ORDER } from '../../utils/constants';

/** A catch event of the given shape (the stream evaluateResearch reads). */
const ev = (species: string, biome: string, phase: string) =>
  ({ species, biome, phase }) as Parameters<typeof evaluateResearch>[1];
const dusk = (species: string) => ev(species, 'meadow', 'dusk');

describe('Research engine — the lifecycle (start -> advance by activity -> complete)', () => {
  it('starting spends the cost; a no-top-up project auto-completes when its activity is done', () => {
    const j = createJournal();
    addCredits(j, 20);
    expect(startResearch(j, 'study-hedgehog')).toBe(true); // cost 8
    expect(j.credits).toBe(12);
    expect(researchState(j, 'study-hedgehog').started).toBe(true);

    evaluateResearch(j, dusk('hedgehog'));
    evaluateResearch(j, dusk('hedgehog'));
    expect(researchState(j, 'study-hedgehog').completed).toBe(false); // 2/3
    const result = evaluateResearch(j, dusk('hedgehog')); // 3/3 -> auto-complete
    expect(researchState(j, 'study-hedgehog').completed).toBe(true);
    expect(result.completed).toContain('study-hedgehog');
    expect(result.rewards.some((r) => r.kind === 'journal-layer')).toBe(true);
  });

  it('a project only advances while STARTED (no progress before start)', () => {
    const j = createJournal();
    evaluateResearch(j, dusk('hedgehog')); // not started -> ignored
    expect(researchState(j, 'study-hedgehog').progress).toBe(0);
  });

  it("can't start when broke (a START gate, never a spend when unaffordable)", () => {
    const j = createJournal(); // 0 credits
    expect(canStartResearch(j, 'study-hedgehog')).toBe(false);
    expect(startResearch(j, 'study-hedgehog')).toBe(false);
    expect(researchState(j, 'study-hedgehog').started).toBe(false);
    expect(j.credits).toBe(0);
  });

  it('the top-up is charged at COMPLETION (a sink), not before', () => {
    const j = createJournal();
    addCredits(j, 100);
    startResearch(j, 'study-after-dark'); // cost 10
    expect(j.credits).toBe(90);
    for (let i = 0; i < 3; i++) evaluateResearch(j, ev('fieldmouse', 'meadow', 'night'));
    j.missions['research-mouse-night'] = { progress: 1, completed: true }; // knowledge met (by play)
    expect(j.credits).toBe(90); // top-up NOT charged by the activity / auto-complete
    expect(completeResearch(j, 'study-after-dark')).not.toBeNull();
    expect(j.credits).toBe(80); // top-up 10 charged at completion
    expect(researchState(j, 'study-after-dark').completed).toBe(true);
  });
});

describe('Research engine — anti-grind / anti-wall', () => {
  it('every project requirement is SMALL (<= 5) — a reward for playing, not a farm', () => {
    for (const id of RESEARCH_ORDER) {
      expect(RESEARCH_PROJECTS[id].activityRequirement.count).toBeLessThanOrEqual(5);
    }
  });

  it('a simple project is reliably completable by doing its activity (no wall)', () => {
    const j = createJournal();
    addCredits(j, RESEARCH_PROJECTS['study-hedgehog'].cost);
    startResearch(j, 'study-hedgehog');
    for (let i = 0; i < RESEARCH_PROJECTS['study-hedgehog'].activityRequirement.count; i++) {
      evaluateResearch(j, dusk('hedgehog'));
    }
    expect(isResearchReady(j, 'study-hedgehog')).toBe(false); // already completed (auto)
    expect(researchState(j, 'study-hedgehog').completed).toBe(true);
  });
});
