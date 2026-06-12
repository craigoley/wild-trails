import { describe, expect, it } from 'vitest';
import { seasonOf } from '../Season';
import type { Season } from '../../utils/constants';

/**
 * §4.6 D1a — the PURE real-season read (the dayPhaseAt sibling). seasonOf(date, hemisphere) maps a
 * DATE → a meteorological season. ⚠️ PURE: it takes the date as an ARGUMENT (no Date.now() inside — the
 * impure clock read lives at the boundary, main.ts, like the boot seed), so it's fully L1-testable.
 * These pin the month boundaries + the hemisphere flip. The season is ATMOSPHERE, never a gate (D1a is
 * the render re-grade; the spawn emphasis — still never exclusion — is D1b).
 */

// A date in a given month (the 15th, mid-month — getMonth round-trips local-time construction).
const inMonth = (monthIndex: number) => new Date(2026, monthIndex, 15);

describe('seasonOf — meteorological season by month (Northern default)', () => {
  const expected: Record<number, Season> = {
    0: 'winter', // Jan
    1: 'winter', // Feb
    2: 'spring', // Mar
    3: 'spring', // Apr
    4: 'spring', // May
    5: 'summer', // Jun
    6: 'summer', // Jul
    7: 'summer', // Aug
    8: 'autumn', // Sep
    9: 'autumn', // Oct
    10: 'autumn', // Nov
    11: 'winter', // Dec
  };

  for (let m = 0; m < 12; m++) {
    it(`month ${m} → ${expected[m]} (Northern)`, () => {
      expect(seasonOf(inMonth(m))).toBe(expected[m]);
    });
  }

  it('the season boundaries land on Mar / Jun / Sep / Dec (the meteorological turns)', () => {
    expect(seasonOf(inMonth(1))).toBe('winter'); // Feb — still winter
    expect(seasonOf(inMonth(2))).toBe('spring'); // Mar — spring begins
    expect(seasonOf(inMonth(4))).toBe('spring'); // May — still spring
    expect(seasonOf(inMonth(5))).toBe('summer'); // Jun — summer begins
    expect(seasonOf(inMonth(7))).toBe('summer'); // Aug — still summer
    expect(seasonOf(inMonth(8))).toBe('autumn'); // Sep — autumn begins
    expect(seasonOf(inMonth(10))).toBe('autumn'); // Nov — still autumn
    expect(seasonOf(inMonth(11))).toBe('winter'); // Dec — winter begins
  });

  it('Northern is the default (no hemisphere arg)', () => {
    expect(seasonOf(inMonth(11))).toBe(seasonOf(inMonth(11), 'northern'));
  });
});

describe('seasonOf — the hemisphere flip (a data swap, the half-year offset)', () => {
  it('Southern is the OPPOSITE season — Dec is summer down south, Jun is winter', () => {
    expect(seasonOf(inMonth(11), 'southern')).toBe('summer'); // Dec
    expect(seasonOf(inMonth(5), 'southern')).toBe('winter'); // Jun
    expect(seasonOf(inMonth(2), 'southern')).toBe('autumn'); // Mar
    expect(seasonOf(inMonth(8), 'southern')).toBe('spring'); // Sep
  });

  it('every month: Southern is the exact opposite of Northern', () => {
    const opposite: Record<Season, Season> = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };
    for (let m = 0; m < 12; m++) {
      expect(seasonOf(inMonth(m), 'southern')).toBe(opposite[seasonOf(inMonth(m), 'northern')]);
    }
  });
});

describe('seasonOf — ⚠️ PURE (the same date always gives the same season; no clock read)', () => {
  it('deterministic for a fixed date (a pure date→season map)', () => {
    const d = new Date(2026, 11, 25); // a fixed Christmas
    expect(seasonOf(d)).toBe('winter');
    expect(seasonOf(d)).toBe(seasonOf(d)); // idempotent — no hidden Date.now()
  });
});
