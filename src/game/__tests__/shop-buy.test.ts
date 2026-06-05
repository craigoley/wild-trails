import { describe, expect, it } from 'vitest';
import { addCredits, baitBuyState, buyBait } from '../Economy';
import { createBaitState, addBait } from '../Bait';
import { createJournal, JOURNAL_SCHEMA_VERSION } from '../../state/Journal';
import { BAIT, SHOP } from '../../utils/constants';

describe('Field Supply — buyBait (the pure transaction, §12 1b)', () => {
  it("'ok' buy: spends the price, adds the quantity (balance down, bait up)", () => {
    const j = createJournal();
    addCredits(j, 10);
    const bait = createBaitState();
    bait.counts.seeds = 5;
    expect(baitBuyState(j, bait, 'seeds')).toBe('ok');
    expect(buyBait(j, bait, 'seeds')).toBe(true);
    expect(j.credits).toBe(10 - SHOP.baitPrice);
    expect(bait.counts.seeds).toBe(5 + SHOP.buyQuantity);
  });

  it('CAP-BEFORE-SPEND: at maxCount -> false, NO spend, NO add (credits NOT lost)', () => {
    const j = createJournal();
    addCredits(j, 100);
    const bait = createBaitState();
    bait.counts.seeds = BAIT.maxCount; // already full
    const before = j.credits;
    expect(baitBuyState(j, bait, 'seeds')).toBe('at-cap');
    expect(buyBait(j, bait, 'seeds')).toBe(false);
    expect(j.credits).toBe(before); // credits untouched — never spent for clamped bait
    expect(bait.counts.seeds).toBe(BAIT.maxCount); // unchanged
  });

  it("can't afford -> false, no-op (balance + bait both unchanged)", () => {
    const j = createJournal(); // 0 credits
    const bait = createBaitState();
    const seeds0 = bait.counts.seeds;
    expect(baitBuyState(j, bait, 'seeds')).toBe('cant-afford');
    expect(buyBait(j, bait, 'seeds')).toBe(false);
    expect(j.credits).toBe(0);
    expect(bait.counts.seeds).toBe(seeds0);
  });

  it('baitBuyState reports the right status for the button (ok / cant-afford / at-cap)', () => {
    const j = createJournal();
    const bait = createBaitState();
    expect(baitBuyState(j, bait, 'seeds')).toBe('cant-afford'); // 0 credits
    addCredits(j, SHOP.baitPrice);
    expect(baitBuyState(j, bait, 'seeds')).toBe('ok'); // affordable + below cap
    bait.counts.seeds = BAIT.maxCount;
    expect(baitBuyState(j, bait, 'seeds')).toBe('at-cap'); // cap beats afford
  });

  it('buying one below the cap fills exactly to the cap (no overshoot)', () => {
    const j = createJournal();
    addCredits(j, 100);
    const bait = createBaitState();
    bait.counts.greens = BAIT.maxCount - SHOP.buyQuantity;
    expect(buyBait(j, bait, 'greens')).toBe(true);
    expect(bait.counts.greens).toBe(BAIT.maxCount);
    expect(baitBuyState(j, bait, 'greens')).toBe('at-cap'); // now full
  });
});

describe('Field Supply — guardrails (separate from rank, free baseline, no schema bump)', () => {
  it('buying does NOT change rankPoints (credits are a separate currency)', () => {
    const j = createJournal();
    j.rankPoints = 40;
    addCredits(j, 10);
    const bait = createBaitState();
    bait.counts.seeds = 5;
    buyBait(j, bait, 'seeds');
    expect(j.rankPoints).toBe(40);
  });

  it('the FREE catch-replenish loop (addBait) is untouched — core bait acquisition still works', () => {
    const bait = createBaitState();
    bait.counts.seeds = 3;
    addBait(bait, 'seeds', BAIT.rewardPerCatch); // what a catch does for free
    expect(bait.counts.seeds).toBe(3 + BAIT.rewardPerCatch);
  });

  it('buying mutates existing v5 fields only — NO schema bump / migration', () => {
    const j = createJournal();
    addCredits(j, 10);
    const bait = createBaitState();
    bait.counts.seeds = 5;
    buyBait(j, bait, 'seeds');
    expect(j.schemaVersion).toBe(JOURNAL_SCHEMA_VERSION); // still 5
    expect(JOURNAL_SCHEMA_VERSION).toBe(5);
  });
});
