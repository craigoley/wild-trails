/**
 * Real-world season — PURE, Node-testable. The sibling of `dayPhaseAt` (Time.ts): a clean lookup
 * mapping a DATE onto one of four seasons. ⚠️ The one difference from the day-phase: the phase derives
 * from the PURE run clock (game.timeSec) inside the sim, but the season derives from the REAL-WORLD
 * wall-clock date — which is IMPURE. So `seasonOf(date)` itself is pure (date → season, L1-testable,
 * lives here), but the DATE is read at the BOUNDARY (main.ts, like the Date.now() boot seed) and passed
 * into the sim as `game.season` — never read inside src/game/. The pure layer reads game.season, the
 * way it reads game.dayPhase; the sim stays deterministic.
 *
 * §4.6 D1: the season is ATMOSPHERE + TEACHING, NEVER a gate. D1a uses it for the seasonal re-grade
 * (render); the spawn EMPHASIS (abundance weighting, still never exclusion) is the D1b slice.
 */

import type { Hemisphere, Season } from '../utils/constants';

export type { Hemisphere, Season } from '../utils/constants';

/** The meteorological season for a date (boundary-by-month). Northern: spring Mar–May, summer
 *  Jun–Aug, autumn Sep–Nov, winter Dec–Feb. Southern is the half-year flip (a data swap, never a
 *  rewrite). Reads only the month, so it's deterministic + timezone-agnostic for the day. */
export function seasonOf(date: Date, hemisphere: Hemisphere = 'northern'): Season {
  const month = date.getMonth(); // 0 = January … 11 = December
  const northern = NORTHERN_BY_MONTH[month];
  return hemisphere === 'northern' ? northern : OPPOSITE[northern];
}

/** Northern-hemisphere season per month index (0=Jan … 11=Dec). */
const NORTHERN_BY_MONTH: readonly Season[] = [
  'winter', // Jan
  'winter', // Feb
  'spring', // Mar
  'spring', // Apr
  'spring', // May
  'summer', // Jun
  'summer', // Jul
  'summer', // Aug
  'autumn', // Sep
  'autumn', // Oct
  'autumn', // Nov
  'winter', // Dec
];

/** The opposite season (the Southern-hemisphere flip). */
const OPPOSITE: Record<Season, Season> = {
  spring: 'autumn',
  summer: 'winter',
  autumn: 'spring',
  winter: 'summer',
};
