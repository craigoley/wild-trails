import { describe, expect, it } from 'vitest';
import { evaluateCatch, isBiomeGateMet, isBiomeSetComplete, reconcileResearchUnlocks } from '../Missions';
import { startResearch, evaluateResearch } from '../Research';
import { createJournal } from '../../state/Journal';
import { unlockLines } from '../../rendering/unlockLines';
import { BIOME_GATE_CHALLENGES } from '../../utils/constants';

const ev = (species: string, biome: string, phase: string) =>
  ({ species, biome, phase }) as Parameters<typeof evaluateCatch>[1];

type J = ReturnType<typeof createJournal>;

// R2: the Highlands is research-WRAPPED — the §4.1c gate (wetland set + the mastery
// challenge) is necessary but no longer sufficient; the unlock-the-highlands project
// (its activity + the SAME mastery challenge as its knowledgeRequirement) must also
// complete, then the order-independent reconcile fires the unlock. This drives that step.
const doHighlandsResearch = (j: J): string[] => {
  startResearch(j, 'unlock-the-highlands'); // cost 0 — no credit gate
  for (let i = 0; i < 4; i++) evaluateResearch(j, ev('frog', 'wetland', 'day')); // catch-in-wetland ×4
  return reconcileResearchUnlocks(j);
};
const completeMeadowSet = (j: J) => {
  for (let i = 0; i < 5; i++) evaluateCatch(j, ev('fieldmouse', 'meadow', 'day')); // survey (NOT night)
  for (let i = 0; i < 2; i++) evaluateCatch(j, ev('quail', 'meadow', 'dawn'));
  for (let i = 0; i < 2; i++) evaluateCatch(j, ev('hedgehog', 'meadow', 'dusk'));
};
const completeWoodlandSet = (j: J) => {
  for (let i = 0; i < 4; i++) evaluateCatch(j, ev('redsquirrel', 'woodland', 'day'));
  evaluateCatch(j, ev('robin', 'woodland', 'dawn'));
  evaluateCatch(j, ev('roedeer', 'woodland', 'dusk'));
  evaluateCatch(j, ev('badger', 'woodland', 'night'));
};
const completeWetlandSet = (j: J) => {
  for (let i = 0; i < 3; i++) evaluateCatch(j, ev('mallard', 'wetland', 'day'));
  evaluateCatch(j, ev('frog', 'wetland', 'dawn'));
};
const doNightGate = (j: J) => evaluateCatch(j, ev('fieldmouse', 'meadow', 'night')); // research-mouse-night

describe('§4.1c — the EARLIER gates stay gentle (catch-set alone, unchanged)', () => {
  it('Meadow->Woodland unlocks on the catch-set alone (no challenge)', () => {
    const j = createJournal();
    completeMeadowSet(j);
    expect(j.unlockedBiomes).toContain('woodland');
  });

  it('Woodland->Wetland unlocks on the catch-set alone', () => {
    const j = createJournal();
    completeMeadowSet(j);
    completeWoodlandSet(j);
    expect(j.unlockedBiomes).toContain('wetland');
  });

  it('gentle biomes have NO gate challenge; isBiomeGateMet reduces to isBiomeSetComplete', () => {
    expect(BIOME_GATE_CHALLENGES.meadow).toBeUndefined();
    expect(BIOME_GATE_CHALLENGES.woodland).toBeUndefined();
    const j = createJournal();
    completeMeadowSet(j);
    expect(isBiomeGateMet(j, 'meadow')).toBe(isBiomeSetComplete(j, 'meadow'));
  });
});

describe('§4.1c — the ESCALATED Wetland->Highlands gate (catch-set AND research)', () => {
  it('the wetland catch-set ALONE does NOT unlock Highlands — the escalation', () => {
    const j = createJournal();
    completeMeadowSet(j);
    completeWoodlandSet(j);
    completeWetlandSet(j);
    expect(isBiomeSetComplete(j, 'wetland')).toBe(true); // set done...
    expect(isBiomeGateMet(j, 'wetland')).toBe(false); // ...but the gate also needs the research
    expect(j.unlockedBiomes).not.toContain('highlands');
  });

  it('the §4.1c gate (set + mastery) is necessary but NOT sufficient — the research wrap also completes (R2)', () => {
    const j = createJournal();
    completeMeadowSet(j);
    completeWoodlandSet(j);
    completeWetlandSet(j);
    doNightGate(j);
    expect(isBiomeGateMet(j, 'wetland')).toBe(true); // the §4.1c gate is met...
    expect(j.unlockedBiomes).not.toContain('highlands'); // ...but the Highlands is research-wrapped
    const unlocked = doHighlandsResearch(j); // start + activity ×4 -> project completes -> reconcile
    expect(j.unlockedBiomes).toContain('highlands');
    expect(unlocked).toContain('highlands');
  });
});

describe('§4.1c — ORDER-INDEPENDENCE (the re-check-all-gates fix — THE correctness core)', () => {
  it('(a) wetland-set THEN research-mouse-night THEN the research wrap -> Highlands unlocks', () => {
    const j = createJournal();
    completeMeadowSet(j);
    completeWoodlandSet(j);
    completeWetlandSet(j); // set first — no unlock yet
    expect(j.unlockedBiomes).not.toContain('highlands');
    doNightGate(j); // §4.1c gate now met — but the Highlands is research-wrapped
    expect(j.unlockedBiomes).not.toContain('highlands');
    doHighlandsResearch(j); // research last -> unlock
    expect(j.unlockedBiomes).toContain('highlands');
  });

  it('(b) research-mouse-night THEN wetland-set THEN the research wrap -> Highlands unlocks', () => {
    const j = createJournal();
    completeMeadowSet(j);
    completeWoodlandSet(j);
    doNightGate(j); // challenge first — no unlock yet (wetland set incomplete)
    expect(j.unlockedBiomes).not.toContain('highlands');
    completeWetlandSet(j); // set complete — §4.1c gate met, but still research-wrapped
    expect(j.unlockedBiomes).not.toContain('highlands');
    doHighlandsResearch(j); // research last -> unlock
    expect(j.unlockedBiomes).toContain('highlands');
  });
});

describe('§4.1c — ANTI-WALL: reliably completable, no one-way trap', () => {
  it('research-mouse-night completes from a fieldmouse@night catch (easiest species, always-open meadow)', () => {
    const j = createJournal();
    const r = doNightGate(j);
    expect(j.missions['research-mouse-night'].completed).toBe(true);
    expect(r.completed).toContain('research-mouse-night');
  });

  it('the player can RETURN to the meadow at night after the wetland — the gate then flips open', () => {
    const j = createJournal();
    completeMeadowSet(j);
    completeWoodlandSet(j);
    completeWetlandSet(j);
    expect(isBiomeGateMet(j, 'wetland')).toBe(false); // stuck only until you go back at night
    doNightGate(j); // the meadow is always accessible — no one-way progression trap
    expect(isBiomeGateMet(j, 'wetland')).toBe(true);
  });
});

describe('§4.1c — LEGIBILITY (#37 tells the player what is required — not a silent gate)', () => {
  it('the Wetland unlock line shows the required research challenge + its done state', () => {
    const j = createJournal();
    const wetland = unlockLines(j).find((l) => l.setBiome === 'wetland')!;
    expect(wetland.requiredChallenges.map((c) => c.id)).toEqual(['research-mouse-night']);
    expect(wetland.requiredChallenges[0].done).toBe(false);
    // gentle gates list none:
    const meadow = unlockLines(j).find((l) => l.setBiome === 'meadow')!;
    expect(meadow.requiredChallenges).toEqual([]);
    // completing it flips the shown state:
    doNightGate(j);
    const after = unlockLines(j).find((l) => l.setBiome === 'wetland')!;
    expect(after.requiredChallenges[0].done).toBe(true);
  });
});

describe('§4.1c — WIN reachable via the gated path (no impossible state)', () => {
  it('the full gated path opens every biome (so all species become catchable)', () => {
    const j = createJournal();
    completeMeadowSet(j);
    completeWoodlandSet(j);
    completeWetlandSet(j);
    doNightGate(j);
    doHighlandsResearch(j); // R2: the research wrap is part of the win path
    for (const b of ['woodland', 'wetland', 'highlands']) expect(j.unlockedBiomes).toContain(b);
  });
});
