import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { warmthGrade, seasonalGrade, gradedGround } from '../WorldRenderer';
import { BIOMES, SEASONAL } from '../../utils/constants';

/**
 * §4.6 D1a — the SEASONAL re-grade. seasonalGrade(base, season) shifts a biome's ground colour by
 * season; it COMPOSES with the warmth grade — gradedGround = warmthGrade(seasonalGrade(base), thriving)
 * — so the world is BOTH seasonal AND thriving (never one replacing the other). These pin: ⚠️ SUMMER is
 * the IDENTITY (so the existing L2 baselines don't move), winter is a cold/desaturated wash, the grades
 * compose, and the seasonal grade is COSMETIC (it never touches the catch/spawn — that discipline is
 * git-pinned; D1a is render-only). The seasonal LOOK is Craig's device gate, not a test.
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

describe('seasonalGrade — ⚠️ summer is the IDENTITY (the L2 baselines never move)', () => {
  it('summer returns the base colour essentially unchanged (no tint, no sat change)', () => {
    const out = new Color(seasonalGrade(MEADOW, 'summer'));
    const base = new Color(MEADOW);
    // HSL round-trip → within a tiny per-channel rounding delta.
    expect(Math.abs(out.r - base.r)).toBeLessThan(0.02);
    expect(Math.abs(out.g - base.g)).toBeLessThan(0.02);
    expect(Math.abs(out.b - base.b)).toBeLessThan(0.02);
  });

  it('the summer grade config is a true no-op (tintAmount 0, satScale 1)', () => {
    expect(SEASONAL.grade.summer.tintAmount).toBe(0);
    expect(SEASONAL.grade.summer.satScale).toBe(1);
  });

  it('⚠️ a summer-pinned scene composes to today: gradedGround(base, summer, t) === warmthGrade(base, t)', () => {
    for (const t of [0, 0.5, 1]) {
      expect(gradedGround(MEADOW, 'summer', t)).toBe(warmthGrade(MEADOW, t));
    }
  });
});

describe('seasonalGrade — each season reads as its mood', () => {
  it('winter is COOLER + more DESATURATED + lighter than summer (the snow wash)', () => {
    const summer = seasonalGrade(MEADOW, 'summer');
    const winter = seasonalGrade(MEADOW, 'winter');
    expect(sat(winter)).toBeLessThan(sat(summer)); // washed out
    expect(luma(winter)).toBeGreaterThan(luma(summer)); // lightened toward snow-grey
    const wc = new Color(winter);
    expect(wc.b).toBeGreaterThan(new Color(summer).b); // cooler (more blue)
  });

  it('autumn is WARMER (more red than blue) than summer', () => {
    const autumn = new Color(seasonalGrade(MEADOW, 'autumn'));
    expect(autumn.r).toBeGreaterThan(autumn.b); // amber/gold lean
    expect(autumn.r).toBeGreaterThan(new Color(MEADOW).r * 0.9); // warmed up
  });

  it('every season returns a valid colour, and only summer is the exact identity', () => {
    for (const s of ['spring', 'summer', 'autumn', 'winter'] as const) {
      const g = seasonalGrade(MEADOW, s);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(0xffffff);
    }
    expect(seasonalGrade(MEADOW, 'spring')).not.toBe(seasonalGrade(MEADOW, 'summer'));
    expect(seasonalGrade(MEADOW, 'winter')).not.toBe(seasonalGrade(MEADOW, 'summer'));
  });
});

describe('gradedGround — composes BOTH (seasonal AND thriving), never replacing', () => {
  it('thriving still raises saturation WITHIN a season (the thriving grade survives the seasonal one)', () => {
    // Winter at thriving 1 is richer than winter at thriving 0 — the thriving grade still applies.
    expect(sat(gradedGround(MEADOW, 'winter', 1))).toBeGreaterThan(sat(gradedGround(MEADOW, 'winter', 0)));
    expect(sat(gradedGround(MEADOW, 'autumn', 1))).toBeGreaterThan(sat(gradedGround(MEADOW, 'autumn', 0)));
  });

  it('the season still shifts the colour AT a fixed thriving (the seasonal grade survives the thriving one)', () => {
    // At full thriving, winter is still cooler/lighter than summer — both axes compose.
    expect(luma(gradedGround(MEADOW, 'winter', 1))).toBeGreaterThan(luma(gradedGround(MEADOW, 'summer', 1)));
  });
});
