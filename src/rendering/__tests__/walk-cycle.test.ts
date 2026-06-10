import { describe, expect, it } from 'vitest';
import {
  createWalkState,
  createWalkTransform,
  stepWalkCycle,
} from '../walkCycle';
import { CHARACTER_JUICE as CJ } from '../../utils/constants';

const T = () => createWalkTransform();

describe('walkCycle — pure (no three/DOM), Node-testable cosmetic math', () => {
  it('⚠️ FREEZE → NEUTRAL: frozen returns the rest pose and zeroes the accumulators (L2 baselines unchanged)', () => {
    const s = createWalkState();
    // Pre-load some accumulated motion, then freeze at full speed — must still be neutral.
    s.walkPhase = 1.2;
    s.idleClock = 9.9;
    s.lean = 0.1;
    const out = stepWalkCycle(s, CJ.walkSpeedRef, 0.016, true, T());
    expect(out).toEqual({ bobY: 0, scaleXZ: 1, scaleY: 1, leanX: 0 }); // identical to the static capsule
    expect(s).toEqual({ walkPhase: 0, idleClock: 0, lean: 0 });
  });

  it('IDLE (speed 0): the walk phase does NOT advance; a gentle breathing bob; no squash; lean eases to 0', () => {
    const s = createWalkState();
    s.lean = CJ.leanMaxRad; // pretend we just stopped — lean should spring back down
    let out = stepWalkCycle(s, 0, 0.5, false, T());
    expect(s.walkPhase).toBe(0); // distance-driven: 0 speed -> no advance
    expect(s.idleClock).toBe(0.5); // breathing clock still ticks
    expect(out.scaleY).toBe(1); // no squash at rest (blend 0)
    expect(out.scaleXZ).toBe(1);
    expect(out.leanX).toBeLessThan(CJ.leanMaxRad); // springing back toward upright
    // The idle bob is bounded by the idle amplitude (a whisper).
    out = stepWalkCycle(s, 0, 0.5, false, T());
    expect(Math.abs(out.bobY)).toBeLessThanOrEqual(CJ.idleAmplitude + 1e-9);
  });

  it('WALKING: walkPhase advances by DISTANCE (speed·dt·strideRate); bob + squash engage', () => {
    const s = createWalkState();
    const speed = CJ.walkSpeedRef;
    const dt = 0.1;
    stepWalkCycle(s, speed, dt, false, T());
    expect(s.walkPhase).toBeCloseTo((speed * dt * CJ.strideRate) % (Math.PI * 2), 6);
    // Step to a phase where squash is active and check it's non-trivial.
    let sawSquash = false;
    for (let i = 0; i < 50; i++) {
      const out = stepWalkCycle(s, speed, dt, false, T());
      if (Math.abs(out.scaleY - 1) > 1e-3) sawSquash = true;
    }
    expect(sawSquash).toBe(true);
  });

  it('⚠️ SQUASH is VOLUME-PRESERVING across the cycle (scaleY · scaleXZ² ≈ 1)', () => {
    const s = createWalkState();
    for (let i = 0; i < 64; i++) {
      const out = stepWalkCycle(s, CJ.walkSpeedRef, 0.05, false, T());
      expect(out.scaleY * out.scaleXZ * out.scaleXZ).toBeCloseTo(1, 6);
    }
  });

  it('LEAN springs toward speed·maxRad while moving and is capped at maxRad', () => {
    const s = createWalkState();
    for (let i = 0; i < 200; i++) stepWalkCycle(s, CJ.walkSpeedRef * 5, 0.016, false, T()); // way over ref
    expect(s.lean).toBeGreaterThan(0);
    expect(s.lean).toBeLessThanOrEqual(CJ.leanMaxRad + 1e-9); // blend clamps speed/ref to 1 -> cap
  });

  it('CONSERVATIVE bounds: bob/scale/lean stay within the subtle knob limits at any phase', () => {
    const s = createWalkState();
    for (let i = 0; i < 400; i++) {
      const out = stepWalkCycle(s, CJ.walkSpeedRef, 0.02, false, T());
      expect(Math.abs(out.bobY)).toBeLessThanOrEqual(CJ.bobAmplitude + CJ.idleAmplitude + 1e-9);
      expect(out.scaleY).toBeGreaterThanOrEqual(1 - CJ.squashAmplitude - 1e-9);
      expect(out.scaleY).toBeLessThanOrEqual(1 + CJ.squashAmplitude + 1e-9);
      expect(Math.abs(out.leanX)).toBeLessThanOrEqual(CJ.leanMaxRad + 1e-9);
    }
  });
});
