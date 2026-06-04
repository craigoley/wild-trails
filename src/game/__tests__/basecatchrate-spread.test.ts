import { describe, expect, it } from 'vitest';
import { SPECIES, SPECIES_ORDER } from '../../utils/constants';

/**
 * Plan #12 tuning — baseCatchRate spread DOWN one notch (the #18 funnel named
 * cause (a): base rate carried the catch). Every rate scaled by ~0.82; the
 * RELATIVE ordering is preserved and the hardest species stays catchable (> 0).
 * This pins both so a future careless retune can't silently break the spread or
 * clamp a species to uncatchable.
 */
describe('baseCatchRate spread (Plan #12 rebalance)', () => {
  it('preserves the full easy -> hard ordering across all six species', () => {
    const order = ['hedgehog', 'fieldmouse', 'rabbit', 'redsquirrel', 'quail', 'robin'] as const;
    for (let i = 0; i < order.length - 1; i++) {
      expect(SPECIES[order[i]].baseCatchRate).toBeGreaterThan(SPECIES[order[i + 1]].baseCatchRate);
    }
  });

  it('keeps the hardest species catchable (> 0, not clamped to uncatchable)', () => {
    const min = Math.min(...SPECIES_ORDER.map((id) => SPECIES[id].baseCatchRate));
    expect(min).toBeGreaterThan(0);
    expect(SPECIES.robin.baseCatchRate).toBe(min); // robin is the floor
  });

  it('lands the new spread values (the rebalance, reviewable as data)', () => {
    expect(SPECIES.hedgehog.baseCatchRate).toBe(0.7);
    expect(SPECIES.fieldmouse.baseCatchRate).toBe(0.62);
    expect(SPECIES.rabbit.baseCatchRate).toBe(0.41);
    expect(SPECIES.redsquirrel.baseCatchRate).toBe(0.34);
    expect(SPECIES.quail.baseCatchRate).toBe(0.26);
    expect(SPECIES.robin.baseCatchRate).toBe(0.25);
  });

  it('shifted the floor down: even the easiest is no longer a guaranteed bare tap', () => {
    // hedgehog 0.70 at point-blank (proximityMax 1.3) ~= 0.91 < 1 — so even the
    // confidence-builder now needs the player to actually close + (ideally) bait.
    expect(SPECIES.hedgehog.baseCatchRate).toBeLessThan(0.77); // was 0.85
  });
});
