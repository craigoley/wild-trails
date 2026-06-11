import { describe, expect, it } from 'vitest';
import {
  completeMeadowSet,
  completeWoodlandSet,
  completeWetlandSet,
  completeNightForagerGate,
  completeHighlandsResearch,
  completeRiverbankGate,
  completeCoastGate,
  completeMoorGate,
  completePineforestGate,
  completeCaveGate,
  completeTidalGate,
  catchRemainingSpecies,
} from './l1/harness';
import { createJournal } from '../../state/Journal';
import { worldThriving, thrivingWord } from '../Thriving';
import { isGameComplete, shouldCelebrateWin } from '../Missions';
import { THRIVING } from '../../utils/constants';

/**
 * §4.3 CAPSTONE — the win reframed to "the world is known, and it flourishes." These pins guard the
 * HONESTY of that claim (the world-state read genuinely lands in the flourishing band at a real
 * completion — earned, not asserted) and that the TRIGGER is unchanged (the same win condition + moment
 * — only the framing shifted).
 */

const FLOURISHING = THRIVING.bands[THRIVING.bands.length - 1].min; // 0.9

/** Drive the realistic full playthrough (every gate + every species) — a true winner's journal. */
function realisticWin() {
  const j = createJournal();
  completeMeadowSet(j);
  completeWoodlandSet(j);
  completeWetlandSet(j);
  completeNightForagerGate(j);
  completeHighlandsResearch(j);
  completeRiverbankGate(j);
  completeCoastGate(j);
  completeMoorGate(j);
  completePineforestGate(j);
  completeCaveGate(j);
  completeTidalGate(j);
  catchRemainingSpecies(j);
  return j;
}

describe('capstone — ⚠️ "and it flourishes" is HONEST (the world-state read, not a claim)', () => {
  it('at a real completion the WORLD thriving lands in the flourishing band → the word is earned', () => {
    const j = realisticWin();
    expect(isGameComplete(j)).toBe(true); // a genuine winner
    const wt = worldThriving(j);
    expect(wt).toBeGreaterThanOrEqual(FLOURISHING); // ≈ 0.95 — every creature recorded across every place
    expect(thrivingWord(wt)).toBe('flourishing'); // the fixed copy "flourishes" is the computed truth
  });

  it('worldThriving READS the real state — it is low on an empty world, climbs with the playthrough', () => {
    expect(worldThriving(createJournal())).toBeLessThan(FLOURISHING); // a fresh world is not "flourishing"
    const partial = createJournal();
    completeMeadowSet(partial);
    completeWoodlandSet(partial);
    // A partway world thrives LESS than a finished one — the read is genuine, not a constant.
    expect(worldThriving(partial)).toBeLessThan(worldThriving(realisticWin()));
  });

  it('worldThriving is bounded [0,1] and never NaN (the always-open Meadow keeps the fold non-empty)', () => {
    const wt = worldThriving(createJournal());
    expect(wt).toBeGreaterThanOrEqual(0);
    expect(wt).toBeLessThanOrEqual(1);
    expect(Number.isFinite(wt)).toBe(true);
  });
});

describe('capstone — ⚠️ the TRIGGER is UNCHANGED (same win condition + moment; only the framing shifted)', () => {
  it('the win still fires exactly at a complete journal, and not before', () => {
    const j = realisticWin();
    expect(shouldCelebrateWin(j)).toBe(true); // fires at completion

    const notYet = createJournal();
    completeMeadowSet(notYet);
    expect(isGameComplete(notYet)).toBe(false);
    expect(shouldCelebrateWin(notYet)).toBe(false); // never before the condition is met
  });

  it('the `won` flag still guards re-firing (a one-shot celebration)', () => {
    const j = realisticWin();
    j.won = true;
    expect(shouldCelebrateWin(j)).toBe(false); // already celebrated — the reframe didn't touch this
  });
});
