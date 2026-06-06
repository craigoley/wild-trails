import { describe, expect, it } from 'vitest';
import { evaluateCatch, isBiomeSetComplete } from '../Missions';
import { createJournal, JOURNAL_SCHEMA_VERSION } from '../../state/Journal';
import { MISSIONS, CREDITS, RESEARCH } from '../../utils/constants';

const ev = (species: string, biome: string, phase: string) =>
  ({ species, biome, phase }) as Parameters<typeof evaluateCatch>[1];

// research-mouse-night: fieldmouse, meadow, night (a NON-FORCED condition — §4.1b-fix).
const MOUSE = 'research-mouse-night';

describe('THE FIX — research challenges target NON-FORCED conditions (§4.1b-fix)', () => {
  it('completing the meadow catch-set does NOT auto-complete the night challenge', () => {
    const j = createJournal();
    // The FULL meadow catch-set — none of it forces a NIGHT catch:
    for (let i = 0; i < 5; i++) evaluateCatch(j, ev('fieldmouse', 'meadow', 'day')); // survey
    for (let i = 0; i < 2; i++) evaluateCatch(j, ev('quail', 'meadow', 'dawn')); // meadow-dawn
    for (let i = 0; i < 2; i++) evaluateCatch(j, ev('hedgehog', 'meadow', 'dusk')); // meadow-dusk
    expect(isBiomeSetComplete(j, 'meadow')).toBe(true); // normal progression complete...
    expect(j.missions[MOUSE]?.completed ?? false).toBe(false); // ...yet the challenge is STILL OPEN
    // ↑ The player must CHOOSE to come back at night — the "figure it out" moment.
  });

  it('even catching the target species (by day) does NOT complete it — the night is the point', () => {
    const j = createJournal();
    for (let i = 0; i < 9; i++) evaluateCatch(j, ev('fieldmouse', 'meadow', 'day')); // many day catches
    expect(j.missions[MOUSE]?.completed ?? false).toBe(false); // still open until you go at night
  });
});

describe('research challenge — completes ONLY on the right species AT the right phase (anti-accident)', () => {
  it('the target species at the non-forced phase (night) completes it', () => {
    const j = createJournal();
    const r = evaluateCatch(j, ev('fieldmouse', 'meadow', 'night'));
    expect(j.missions[MOUSE].completed).toBe(true);
    expect(r.completed).toContain(MOUSE);
  });

  it('the target species at the WRONG phase does NOT complete it (the phase is required)', () => {
    const j = createJournal();
    evaluateCatch(j, ev('fieldmouse', 'meadow', 'day'));
    expect(j.missions[MOUSE]?.completed ?? false).toBe(false);
  });

  it('the WRONG species at the right phase does NOT complete it (the species is required)', () => {
    const j = createJournal();
    evaluateCatch(j, ev('rabbit', 'meadow', 'night')); // night, but the rabbit challenge — not the mouse
    expect(j.missions[MOUSE]?.completed ?? false).toBe(false);
  });
});

describe('warm-miss teaching hint — teaches, never punishes', () => {
  it('a non-completing catch IN the challenge biome pushes the hint (and destroys no progress)', () => {
    const j = createJournal();
    const r = evaluateCatch(j, ev('hedgehog', 'meadow', 'dusk')); // a meadow catch, not the night mouse
    expect(r.hints).toContain(MISSIONS[MOUSE].hint);
    expect(j.missions[MOUSE]?.completed ?? false).toBe(false); // not completed, not reset
  });

  it('a catch in a DIFFERENT biome does NOT push the meadow challenge hint', () => {
    const j = createJournal();
    const r = evaluateCatch(j, ev('robin', 'woodland', 'dawn'));
    expect(r.hints).not.toContain(MISSIONS[MOUSE].hint);
  });

  it('actually completing the challenge does NOT also hint it (only warm misses do)', () => {
    const j = createJournal();
    const r = evaluateCatch(j, ev('fieldmouse', 'meadow', 'night'));
    expect(r.hints).not.toContain(MISSIONS[MOUSE].hint);
  });
});

describe('reward — meaningful but ONE-TIME and bounded (P4); reliably completable', () => {
  it('completion grants rank points + the one-time credit bonus', () => {
    const j = createJournal();
    const r = evaluateCatch(j, ev('fieldmouse', 'meadow', 'night'));
    expect(r.pointsAwarded).toBeGreaterThanOrEqual(RESEARCH.rewardPoints);
    expect(r.creditsAwarded).toBe(RESEARCH.creditReward);
  });

  it('the credit bonus is BOUNDED below the biome-complete reward', () => {
    expect(RESEARCH.creditReward).toBeLessThan(CREDITS.perBiomeComplete);
  });

  it('one-time: a re-catch after completion re-pays NOTHING (count-1, farm-proof)', () => {
    const j = createJournal();
    evaluateCatch(j, ev('fieldmouse', 'meadow', 'night'));
    const r2 = evaluateCatch(j, ev('fieldmouse', 'meadow', 'night'));
    expect(r2.completed).not.toContain(MOUSE);
    expect(r2.creditsAwarded).toBe(0);
  });

  it("reliably completable: the target is an 'any'-window meadow species (spawns + catchable at night)", () => {
    // fieldmouse/rabbit are activityWindow 'any' (out round the clock), the easiest
    // species, in the always-open Meadow — so the night condition is never a wall.
    const j = createJournal();
    expect(evaluateCatch(j, ev('fieldmouse', 'meadow', 'night')).completed).toContain(MOUSE);
  });
});

describe('standalone — optional (no unlock / no win impact); no schema change', () => {
  it('both research challenges are standalone, and completing one unlocks nothing', () => {
    for (const id of ['research-mouse-night', 'research-rabbit-night']) {
      expect(MISSIONS[id].standalone).toBe(true);
      expect(MISSIONS[id].requirement.kind).toBe('research');
    }
    const j = createJournal();
    expect(evaluateCatch(j, ev('fieldmouse', 'meadow', 'night')).unlocked).toEqual([]);
  });

  it('no schema bump — research challenges ride journal.missions (v5 intact)', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(5);
  });
});
