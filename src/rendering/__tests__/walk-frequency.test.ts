import { describe, expect, it } from 'vitest';
import {
  PLAYER_GAIT,
  createWalkState,
  createWalkTransform,
  stepGait,
  type GaitProfile,
} from '../walkCycle';
import { CHARACTER_JUICE as CJ, GAIT_PROFILES, TUNING, ANIMAL, type GaitKind } from '../../utils/constants';

/**
 * ⚠️ The FREQUENCY GUARD (#101) — the pin the diagnostic flagged as MISSING (the gap that let the
 * ~17 Hz vibration ship). The old walk tests derived the expected phase FROM `strideRate` itself —
 * tautological: they pin the bob's SHAPE, never its FREQUENCY at a real walk speed. This file drives
 * the real cycle at the speed the character actually moves and COUNTS the bob cycles, asserting a
 * gentle footfall band (≤ 4 Hz). A regression to strideRate 9 (~17 Hz) FAILS here.
 */

const T = () => createWalkTransform();

/** Count the vertical-bob frequency (Hz) the way an eye sees it: drive the real gait at a fixed
 *  speed for `seconds`, then count local maxima of bobY (one per up-down) and divide by the window.
 *  Shape-agnostic — works for the walk/bird double-dip, the hop arc, and the swim glide alike. */
function bobFrequencyHz(profile: GaitProfile, speed: number, seconds = 3): number {
  const s = createWalkState();
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  const bob: number[] = [];
  for (let i = 0; i < steps; i++) bob.push(stepGait(s, speed, profile, dt, false, false, T()).bobY);
  const floor = Math.min(...bob);
  let peaks = 0;
  for (let i = 1; i < bob.length - 1; i++) {
    if (bob[i] > bob[i - 1] && bob[i] >= bob[i + 1] && bob[i] - floor > 1e-6) peaks++;
  }
  return peaks / seconds;
}

describe('CJ1 player walk — ⚠️ the bob is a gentle FOOTFALL at real speed, not a vibration', () => {
  it('at maxSpeed the bob frequency is in the natural-walk band (≥1, ≤4 Hz) — the #101 guard', () => {
    // The player holds the stick → ramps to and HOLDS maxSpeed (6). The shipped strideRate 9 made
    // this ~17 Hz (the violent vibration). The fix (1.5) → ~2.9 Hz. A regression to 9 fails ≤4.
    const f = bobFrequencyHz(PLAYER_GAIT, TUNING.maxSpeed);
    expect(f).toBeGreaterThanOrEqual(1); // alive — a real footfall, not frozen
    expect(f).toBeLessThanOrEqual(4); // GENTLE — not a buzz (strideRate 9 → ~17 Hz would FAIL)
  });

  it('the bob frequency tracks the strideRate constant (the cause is the rate — speed·strideRate/π)', () => {
    const f = bobFrequencyHz(PLAYER_GAIT, TUNING.maxSpeed);
    const expected = (TUNING.maxSpeed * CJ.strideRate) / Math.PI; // ≈ 2.86 Hz at the fix
    expect(Math.abs(f - expected)).toBeLessThan(0.6);
  });
});

describe('CJ1 — ⚠️ the walkSpeedRef CONSISTENCY fix (one speed scale; the 2.2-vs-6 smell is gone)', () => {
  it('walkSpeedRef equals the REAL maxSpeed — the bob, lean and idle-blend share one reference', () => {
    expect(CJ.walkSpeedRef).toBe(TUNING.maxSpeed); // DRY-bound: it can never drift from maxSpeed again
  });
});

describe('CJ2 animals — ⚠️ the gaits are gentle at roaming speed too (no buzz; the shared bug class)', () => {
  it('every animal gait bobs in the natural band (≤4 Hz) at the wander speed it actually moves at', () => {
    for (const kind of Object.keys(GAIT_PROFILES) as GaitKind[]) {
      const f = bobFrequencyHz(GAIT_PROFILES[kind], ANIMAL.wanderSpeed);
      expect(f, `${kind} @ wanderSpeed`).toBeLessThanOrEqual(4); // old walk 11 / bird 14 buzzed (~4.2 / ~5.4 Hz)
    }
  });

  it('the walk + bird rates were brought DOWN into the band (the two that buzzed); hop/swim left gentle', () => {
    expect(bobFrequencyHz(GAIT_PROFILES.walk, ANIMAL.wanderSpeed)).toBeLessThanOrEqual(2.6);
    expect(bobFrequencyHz(GAIT_PROFILES.bird, ANIMAL.wanderSpeed)).toBeLessThanOrEqual(3.0);
    // The once-per-cycle hop/swim were already gentle and are unchanged — still in band.
    expect(bobFrequencyHz(GAIT_PROFILES.hop, ANIMAL.wanderSpeed)).toBeLessThanOrEqual(2.6);
    expect(bobFrequencyHz(GAIT_PROFILES.swim, ANIMAL.wanderSpeed)).toBeLessThanOrEqual(2.6);
  });
});
