/**
 * Pure helpers for the time-of-day indicator — NO DOM, so the phase→display
 * mapping and the arc geometry are unit-testable. The renderer (TimeIndicator)
 * is the thin DOM shell over these.
 *
 * The cycle FRACTION is derived here from the run clock + TIME.cyclePeriodSec —
 * the same maths Time.ts uses internally, recomputed render-side so src/game/
 * stays untouched (the indicator only READS state).
 */

import { DAY_PHASE_DISPLAY, TIME, type DayPhase } from '../utils/constants';

/** Short phase label ("Dawn" / "Day" / "Dusk" / "Night"). */
export function phaseLabel(phase: DayPhase): string {
  return DAY_PHASE_DISPLAY[phase].label;
}

/** Zero-asset phase glyph (🌅 / ☀️ / 🌆 / 🌙). */
export function phaseIcon(phase: DayPhase): string {
  return DAY_PHASE_DISPLAY[phase].icon;
}

/** Is it the dark half of the cycle (drives the moon-vs-sun dot tint)? */
export function phaseIsNight(phase: DayPhase): boolean {
  return phase === 'night';
}

/** Progress through the full day-night cycle, [0, 1). Wraps; negative-safe. */
export function cycleFraction(timeSec: number): number {
  const period = TIME.cyclePeriodSec;
  return (((timeSec % period) + period) % period) / period;
}

/** The celestial dot's angle along the sky arc, degrees: 180° at the start of
 *  the cycle (sunrise, left horizon) sweeping to 0° at the end (right horizon).
 *  Clamped to [0, 180]. */
export function arcAngleDeg(frac: number): number {
  const f = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  return 180 * (1 - f);
}

/** The dot's position within the arc box as percentages (left, top). The body
 *  rises from the left horizon (0%, 100%) over the top (50%, 0%) and sets at the
 *  right horizon (100%, 100%) across the cycle. */
export function dotPosition(frac: number): { leftPct: number; topPct: number } {
  const f = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  const rad = (arcAngleDeg(f) * Math.PI) / 180;
  return {
    leftPct: 100 * f, // left horizon (0%) -> right horizon (100%) across the cycle
    topPct: 100 * (1 - Math.sin(rad)), // peaks (0%) at the top of the arc
  };
}
