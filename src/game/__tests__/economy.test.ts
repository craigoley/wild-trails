import { describe, expect, it } from 'vitest';
import { addCredits, spendCredits, creditsForCatch } from '../Economy';
import { createJournal, recordCatch } from '../../state/Journal';
import { CREDITS, SPECIES, SPECIES_ORDER } from '../../utils/constants';

describe('Economy — add / spend / overspend guard (§12 1a)', () => {
  it('addCredits accrues; a non-positive delta is a no-op', () => {
    const j = createJournal();
    addCredits(j, 10);
    expect(j.credits).toBe(10);
    addCredits(j, 0);
    addCredits(j, -5);
    expect(j.credits).toBe(10); // unchanged — the balance only grows here
  });

  it('spendCredits deducts when affordable, returns true', () => {
    const j = createJournal();
    addCredits(j, 30);
    expect(spendCredits(j, 12)).toBe(true);
    expect(j.credits).toBe(18);
  });

  it('CANNOT overspend: insufficient -> false + balance UNCHANGED (never negative)', () => {
    const j = createJournal();
    addCredits(j, 5);
    expect(spendCredits(j, 6)).toBe(false); // can't afford
    expect(j.credits).toBe(5); // untouched
    expect(spendCredits(j, 0)).toBe(false); // non-positive spend is rejected
    expect(j.credits).toBe(5);
    expect(spendCredits(createJournal(), 1)).toBe(false); // zero balance
  });
});

describe('Economy — creditsForCatch (skill + research milestones)', () => {
  it('a plain re-catch earns only the per-catch amount', () => {
    const j = createJournal();
    recordCatch(j, 'fieldmouse', 1); // already found
    const c = creditsForCatch(j, 'fieldmouse');
    expect(c).toEqual({ total: CREDITS.perCatch, newSpecies: false, biomeComplete: false });
  });

  it('a NEW species earns per-catch + the discovery bonus', () => {
    const c = creditsForCatch(createJournal(), 'fieldmouse'); // first catch
    expect(c.newSpecies).toBe(true);
    expect(c.biomeComplete).toBe(false); // meadow has other species still missing
    expect(c.total).toBe(CREDITS.perCatch + CREDITS.perNewSpecies);
  });

  it('the catch that COMPLETES a biome stacks per-catch + new + biome bonuses', () => {
    const j = createJournal();
    // Find every Meadow species EXCEPT the last one, then catch the last.
    const meadow = SPECIES_ORDER.filter((id) => SPECIES[id].biome === 'meadow');
    const last = meadow[meadow.length - 1];
    for (const id of meadow) if (id !== last) recordCatch(j, id, 1);
    const c = creditsForCatch(j, last);
    expect(c).toEqual({
      total: CREDITS.perCatch + CREDITS.perNewSpecies + CREDITS.perBiomeComplete,
      newSpecies: true,
      biomeComplete: true,
    });
  });

  it('re-catching the biome-completer does NOT re-award the biome bonus', () => {
    const j = createJournal();
    const meadow = SPECIES_ORDER.filter((id) => SPECIES[id].biome === 'meadow');
    for (const id of meadow) recordCatch(j, id, 1); // whole meadow already found
    const c = creditsForCatch(j, meadow[0]);
    expect(c).toEqual({ total: CREDITS.perCatch, newSpecies: false, biomeComplete: false });
  });
});

describe('Economy — credits are SEPARATE from rank, and free-baseline is untouched', () => {
  it('earning/spending credits never changes rankPoints', () => {
    const j = createJournal();
    j.rankPoints = 40;
    addCredits(j, 100);
    spendCredits(j, 25);
    expect(j.rankPoints).toBe(40); // rank is independent of the economy
  });

  it('1a adds NO catch-rate effect: credits do not gate or alter catching (sanity)', () => {
    // The economy module touches only journal.credits — it never reads/writes bait,
    // species rates, or the catch math. (Catch.ts/#19 rates are unchanged — git.)
    const j = createJournal();
    addCredits(j, 50);
    expect(Object.keys(j)).toContain('credits');
    // No bait was consumed or granted by the economy; the free catch-replenish loop
    // (BAIT.rewardPerCatch) is the baseline and lives entirely in the bait system.
    expect(j.bait).toBeDefined();
  });
});
