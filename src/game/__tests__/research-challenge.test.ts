import { describe, expect, it } from 'vitest';
import { evaluateCatch, isBiomeSetComplete } from '../Missions';
import { createJournal, JOURNAL_SCHEMA_VERSION } from '../../state/Journal';
import { MISSIONS, CREDITS, RESEARCH } from '../../utils/constants';

const ev = (species: string, biome: string, phase: string) =>
  ({ species, biome, phase }) as Parameters<typeof evaluateCatch>[1];

// research-night-digger: badger, woodland, night.
const NIGHT = 'research-night-digger';

describe('research challenge — completes ONLY on the right species AT the right phase', () => {
  it('the target species at the correct phase completes it', () => {
    const j = createJournal();
    const r = evaluateCatch(j, ev('badger', 'woodland', 'night'));
    expect(j.missions[NIGHT].completed).toBe(true);
    expect(r.completed).toContain(NIGHT);
  });

  it('the target species at the WRONG phase does NOT complete it (the phase is required)', () => {
    const j = createJournal();
    evaluateCatch(j, ev('badger', 'woodland', 'dusk')); // right species, wrong condition
    expect(j.missions[NIGHT]?.completed ?? false).toBe(false);
  });

  it('the WRONG species at the right phase does NOT complete it (the species is required)', () => {
    const j = createJournal();
    evaluateCatch(j, ev('robin', 'woodland', 'night')); // right condition, wrong species
    expect(j.missions[NIGHT]?.completed ?? false).toBe(false);
  });

  // ↑↑ Together these pin the ANTI-ACCIDENT core: BOTH dimensions are required, so
  // completing PROVES the player applied the time + species knowledge.
});

describe('warm-miss teaching hint — teaches, never punishes', () => {
  it('a non-completing catch IN the challenge biome pushes the hint (and destroys no progress)', () => {
    const j = createJournal();
    const r = evaluateCatch(j, ev('redsquirrel', 'woodland', 'day')); // a woodland catch, not a target
    expect(r.hints).toContain(MISSIONS[NIGHT].hint);
    expect(j.missions[NIGHT]?.completed ?? false).toBe(false); // not completed, not reset (count-1)
  });

  it('a catch in a DIFFERENT biome does NOT push the woodland challenge hint', () => {
    const j = createJournal();
    const r = evaluateCatch(j, ev('fieldmouse', 'meadow', 'day'));
    expect(r.hints).not.toContain(MISSIONS[NIGHT].hint);
  });

  it('actually completing the challenge does NOT also hint it (only warm misses do)', () => {
    const j = createJournal();
    const r = evaluateCatch(j, ev('badger', 'woodland', 'night'));
    expect(r.hints).not.toContain(MISSIONS[NIGHT].hint);
  });
});

describe('reward — meaningful but ONE-TIME and bounded (P4)', () => {
  it('completion grants rank points + the one-time credit bonus', () => {
    const j = createJournal();
    const r = evaluateCatch(j, ev('badger', 'woodland', 'night'));
    expect(r.pointsAwarded).toBeGreaterThanOrEqual(RESEARCH.rewardPoints);
    expect(r.creditsAwarded).toBe(RESEARCH.creditReward); // the one challenge's bonus
  });

  it('the credit bonus is BOUNDED below the biome-complete reward (discovery stays bigger)', () => {
    expect(RESEARCH.creditReward).toBeLessThan(CREDITS.perBiomeComplete); // 18 < 25
  });

  it('one-time: a re-catch after completion re-pays NOTHING (count-1, farm-proof)', () => {
    const j = createJournal();
    evaluateCatch(j, ev('badger', 'woodland', 'night')); // complete
    const r2 = evaluateCatch(j, ev('badger', 'woodland', 'night')); // again
    expect(r2.completed).not.toContain(NIGHT);
    expect(r2.creditsAwarded).toBe(0); // never re-pays
  });
});

describe('standalone — optional (no unlock / no win impact); no schema change', () => {
  it('all 3 research challenges are standalone, and completing one unlocks nothing', () => {
    for (const id of ['research-dawn-songbird', NIGHT, 'research-dusk-browser']) {
      expect(MISSIONS[id].standalone).toBe(true);
    }
    const j = createJournal();
    const r = evaluateCatch(j, ev('badger', 'woodland', 'night'));
    expect(r.unlocked).toEqual([]); // a research challenge never gates a biome
    expect(isBiomeSetComplete(j, 'woodland')).toBe(false); // standalone excluded from the set
  });

  it('no schema bump — research challenges ride journal.missions (v5 intact)', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(5);
  });
});
