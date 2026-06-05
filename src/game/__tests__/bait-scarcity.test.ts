import { describe, expect, it } from 'vitest';
import { createBaitState, deployBait, clearActiveBait } from '../Bait';
import { JOURNAL_SCHEMA_VERSION } from '../../state/Journal';

/**
 * §12 bait scarcity: catching no longer refills bait (it grants credits — see
 * balance.test "a catch NO LONGER refills bait" + the 1a creditsForCatch tests).
 * Bait is now consumed by play and the ONLY source is the Field Supply shop
 * (shop-buy.test), so it can run out. Easy animals stay catchable bait-less (the
 * anti-lockout valve — balance.test catches a hedgehog bait-less). These pin the
 * depletion + that bait consumption is intact + no schema change.
 */

describe('Bait scarcity — bait depletes through play, nothing refills it but the shop', () => {
  it('deploying bait spends exactly 1 of the selected type', () => {
    const bait = createBaitState();
    const before = bait.counts[bait.selected];
    expect(deployBait(bait, 0, 0)).toBe(true);
    expect(bait.counts[bait.selected]).toBe(before - 1); // consumption intact
  });

  it('repeated deploys drain a type to 0; an empty type can no longer deploy (it can run out)', () => {
    const bait = createBaitState();
    bait.selected = 'seeds';
    bait.counts.seeds = 3;
    for (let i = 0; i < 3; i++) expect(deployBait(bait, 0, 0)).toBe(true);
    expect(bait.counts.seeds).toBe(0); // depleted — and nothing refills it on catch
    expect(deployBait(bait, 0, 0)).toBe(false); // out of seeds
  });

  it('clearActiveBait still clears the deployed lure (used up on the catch)', () => {
    const bait = createBaitState();
    deployBait(bait, 1, 2);
    expect(bait.activeType).not.toBeNull();
    clearActiveBait(bait);
    expect(bait.activeType).toBeNull(); // the lure is consumed/cleared
  });

  it('no schema change — the loop is redirected (catch -> credits), no new persisted state (v5)', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(5);
  });
});
