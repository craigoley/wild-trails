import { describe, expect, it } from 'vitest';
import {
  arcAngleDeg,
  cycleFraction,
  dotPosition,
  phaseIcon,
  phaseIsNight,
  phaseLabel,
} from '../timeOfDayDisplay';
import { DAY_PHASE_DISPLAY, TIME, type DayPhase } from '../../utils/constants';

const PHASES: DayPhase[] = ['dawn', 'day', 'dusk', 'night'];

describe('phase -> display mapping', () => {
  it('maps each phase to its label + icon from the data table', () => {
    for (const p of PHASES) {
      expect(phaseLabel(p)).toBe(DAY_PHASE_DISPLAY[p].label);
      expect(phaseIcon(p)).toBe(DAY_PHASE_DISPLAY[p].icon);
    }
    expect(phaseLabel('dusk')).toBe('Dusk');
    expect(phaseIcon('night')).toBe('🌙');
  });

  it('only night is the dark half (moon dot)', () => {
    expect(phaseIsNight('night')).toBe(true);
    expect(phaseIsNight('dawn')).toBe(false);
    expect(phaseIsNight('day')).toBe(false);
    expect(phaseIsNight('dusk')).toBe(false);
  });
});

describe('cycleFraction — progress through the cycle, derived render-side', () => {
  it('is 0 at the start, 0.5 at half a period, and wraps at the period', () => {
    const P = TIME.cyclePeriodSec; // 120
    expect(cycleFraction(0)).toBe(0);
    expect(cycleFraction(P / 2)).toBeCloseTo(0.5, 6);
    expect(cycleFraction(P)).toBe(0); // wraps
    expect(cycleFraction(P + P / 4)).toBeCloseTo(0.25, 6);
  });

  it('is negative-safe (wraps backwards correctly)', () => {
    const P = TIME.cyclePeriodSec;
    expect(cycleFraction(-P / 4)).toBeCloseTo(0.75, 6);
  });
});

describe('arc geometry — angle + dot position', () => {
  it('arcAngleDeg sweeps 180° (start) -> 0° (end), clamped', () => {
    expect(arcAngleDeg(0)).toBe(180);
    expect(arcAngleDeg(0.5)).toBe(90);
    expect(arcAngleDeg(1)).toBe(0);
    expect(arcAngleDeg(-1)).toBe(180); // clamped
    expect(arcAngleDeg(2)).toBe(0); // clamped
  });

  it('dotPosition rises from the left horizon, peaks at the top, sets at the right', () => {
    const start = dotPosition(0);
    expect(start.leftPct).toBe(0);
    expect(start.topPct).toBeCloseTo(100, 5); // bottom-left

    const noon = dotPosition(0.5);
    expect(noon.leftPct).toBe(50);
    expect(noon.topPct).toBeCloseTo(0, 5); // apex

    const end = dotPosition(1);
    expect(end.leftPct).toBe(100);
    expect(end.topPct).toBeCloseTo(100, 5); // bottom-right
  });

  it('clamps out-of-range fractions', () => {
    expect(dotPosition(-0.5).leftPct).toBe(0);
    expect(dotPosition(5).leftPct).toBe(100);
  });
});
