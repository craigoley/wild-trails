import { describe, expect, it } from 'vitest';
import { dayPhaseAt } from '../Time';
import { TIME } from '../../utils/constants';

const P = TIME.cyclePeriodSec;
/** A time at fraction `f` of the cycle. */
const at = (f: number): number => f * P;

describe('Time — day phase from the run clock', () => {
  it('maps each phase window to the right phase', () => {
    expect(dayPhaseAt(at(0))).toBe('dawn');
    expect(dayPhaseAt(at(TIME.dayStart - 0.01))).toBe('dawn');
    expect(dayPhaseAt(at(TIME.dayStart))).toBe('day');
    expect(dayPhaseAt(at(TIME.duskStart - 0.01))).toBe('day');
    expect(dayPhaseAt(at(TIME.duskStart))).toBe('dusk');
    expect(dayPhaseAt(at(TIME.nightStart - 0.01))).toBe('dusk');
    expect(dayPhaseAt(at(TIME.nightStart))).toBe('night');
    expect(dayPhaseAt(at(0.999))).toBe('night');
  });

  it('loops every cycle period (next cycle matches this one)', () => {
    expect(dayPhaseAt(at(TIME.dayStart) + P)).toBe('day');
    expect(dayPhaseAt(at(TIME.duskStart) + 5 * P)).toBe('dusk');
  });

  it('wraps negative times correctly', () => {
    // -0.01 of a cycle is the very end => night.
    expect(dayPhaseAt(-0.01 * P)).toBe('night');
  });
});
