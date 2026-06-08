import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { warmthGrade } from '../WorldRenderer';
import { BIOMES, THRIVING } from '../../utils/constants';

/**
 * The through-line warmth GRADE (§4.3 TL1) — a sibling to `dim`. The biome ground colour lerps
 * from a SUBTLE muted/cooler baseline at thriving=0 to its full/rich colour at thriving=1. These
 * pin the lerp (muted -> warm) and ⚠️ that the t=0 baseline is CALM (≈0.82 sat), NOT the 0.45
 * locked-dim — the world looks good at zero, just stiller.
 */
const sat = (hex: number) => {
  const hsl = { h: 0, s: 0, l: 0 };
  new Color(hex).getHSL(hsl);
  return hsl.s;
};
const luma = (hex: number) => {
  const c = new Color(hex);
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
};
const MEADOW = BIOMES.meadow.color;

describe('warmthGrade — a muted -> warm lerp by thriving', () => {
  it('thriving=0 is MORE muted (lower saturation) than thriving=1', () => {
    expect(sat(warmthGrade(MEADOW, 0))).toBeLessThan(sat(warmthGrade(MEADOW, 1)));
  });

  it('thriving=1 returns the biome colour essentially unchanged (full, rich)', () => {
    const full = new Color(warmthGrade(MEADOW, 1));
    const base = new Color(MEADOW);
    // HSL round-trip -> within a tiny rounding delta per channel.
    expect(Math.abs(full.r - base.r)).toBeLessThan(0.02);
    expect(Math.abs(full.g - base.g)).toBeLessThan(0.02);
    expect(Math.abs(full.b - base.b)).toBeLessThan(0.02);
  });

  it('the grade is monotonic — saturation rises with thriving', () => {
    expect(sat(warmthGrade(MEADOW, 0.25))).toBeLessThanOrEqual(sat(warmthGrade(MEADOW, 0.75)) + 1e-9);
    expect(sat(warmthGrade(MEADOW, 0))).toBeLessThan(sat(warmthGrade(MEADOW, 0.5)));
  });

  it('⚠️ the muted baseline is SUBTLE — far brighter than the 0.45 locked-dim (calm, not drab)', () => {
    const baseline = luma(warmthGrade(MEADOW, 0));
    const lockedDim = luma(
      // the locked-dim transform (the distinct, much darker locked-biome look):
      ((Math.round(((MEADOW >> 16) & 0xff) * 0.45) << 16) |
        (Math.round(((MEADOW >> 8) & 0xff) * 0.45) << 8) |
        Math.round((MEADOW & 0xff) * 0.45)) >>> 0,
    );
    expect(baseline).toBeGreaterThan(lockedDim * 1.5); // the unstudied baseline is nowhere near locked-dark
    // and it retains MOST of the colour's brightness (a subtle mute, not a wash-out):
    expect(baseline).toBeGreaterThan(luma(MEADOW) * 0.8);
    // sanity: the baseline saturation ≈ the configured floor (≈0.82 of full); precision 2 since
    // the graded colour round-trips through 8-bit RGB (small quantization).
    expect(sat(warmthGrade(MEADOW, 0))).toBeCloseTo(sat(MEADOW) * THRIVING.grade.minSaturation, 2);
  });
});
