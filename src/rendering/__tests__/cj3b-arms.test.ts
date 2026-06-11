import { describe, expect, it } from 'vitest';
import {
  PLAYER_GAIT,
  createWalkState,
  createWalkTransform,
  stepWalkCycle,
  stepGait,
  type GaitProfile,
} from '../walkCycle';
import { buildPlayerModel } from '../models/builders';
import { CHARACTER_JUICE as CJ, GAIT_PROFILES, PLAYER_MODEL, type GaitKind } from '../../utils/constants';

/**
 * CJ3b — arm swing. The player's EXISTING arms counter-swing at the shoulder on the SAME walkPhase
 * as the legs/bob (FK, the CJ3 pattern). These pins guard the formula + sync, the CONTRALATERAL sign
 * (each arm opposite its same-side leg), that arms swing SUBTLER than legs, that idle/freeze = still
 * arms, that CJ1/CJ2/CJ3 are byte-identical (additive + player-only), and that the shoulder-pivot
 * re-parent renders the arm in its ORIGINAL position at rest. The FEEL is Craig's device gate.
 */

const T = () => createWalkTransform();
const smoothstep = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

// The renderer's limb mapping (mirrored here so the contralateral relationship is pinned):
const legLapplied = (legSwing: number) => legSwing; // EntityRenderer: playerLegL.rotation.x = +legSwing
const armLapplied = (armSwing: number) => -armSwing; // EntityRenderer: playerArmL.rotation.x = −armSwing

describe('CJ3b — the arm shoulder-swing (pure walkCycle): formula, sync, subtle amplitude', () => {
  it('armSwing = blend · armA · cos(walkPhase) — the SAME phase as the legs/bob (auto-synced)', () => {
    const s = createWalkState();
    const speed = CJ.walkSpeedRef * 0.5;
    const dt = 0.1;
    for (let i = 0; i < 7; i++) {
      const out = stepWalkCycle(s, speed, dt, false, T());
      const blend = smoothstep(speed / CJ.walkSpeedRef);
      expect(out.armSwing).toBeCloseTo(blend * CJ.armSwingAmplitude * Math.cos(s.walkPhase), 9);
      // In phase with the legs (same cos, same blend) — the ratio is exactly the amplitude ratio.
      if (Math.abs(out.legSwing) > 1e-9) {
        expect(out.armSwing / out.legSwing).toBeCloseTo(CJ.armSwingAmplitude / CJ.legSwingAmplitude, 9);
      }
    }
  });

  it('SUBTLE: the arm amplitude is smaller than the legs (a counter-balance, not a march)', () => {
    expect(CJ.armSwingAmplitude).toBeLessThan(CJ.legSwingAmplitude); // 0.15 < 0.3
    expect(CJ.armSwingAmplitude).toBeGreaterThan(0); // …but present
  });

  it('⚠️ CONTRALATERAL: the left arm opposes the left leg (cross-body, not same-side Frankenstein)', () => {
    const s = createWalkState();
    let sawMotion = false;
    for (let i = 0; i < 40; i++) {
      const out = stepWalkCycle(s, CJ.walkSpeedRef, 0.05, false, T());
      const leftLeg = legLapplied(out.legSwing); // +legSwing
      const leftArm = armLapplied(out.armSwing); // −armSwing
      if (Math.abs(leftLeg) > 1e-6 && Math.abs(leftArm) > 1e-6) {
        sawMotion = true;
        expect(Math.sign(leftArm)).toBe(-Math.sign(leftLeg)); // OPPOSITE — the natural cross-body swing
      }
    }
    expect(sawMotion).toBe(true); // the assertion actually ran
  });
});

describe('CJ3b — ⚠️ idle/freeze = STILL, STRAIGHT arms', () => {
  it('at idle (speed 0) armSwing is 0 (blend 0 → the crossfade holds the arms straight)', () => {
    const s = createWalkState();
    for (let i = 0; i < 5; i++) expect(stepWalkCycle(s, 0, 0.2, false, T()).armSwing).toBe(0);
  });

  it('frozen → armSwing 0 (straight arms in the L2 capture, like the rest pose)', () => {
    const s = createWalkState();
    s.walkPhase = 2.1;
    expect(stepWalkCycle(s, CJ.walkSpeedRef, 0.016, true, T()).armSwing).toBe(0);
  });
});

describe('CJ3b — ⚠️ additive: CJ1 bob/lean + CJ3 legs unchanged; CJ2 animals do NOT swing arms', () => {
  it('armSwingAmplitude does NOT affect bob/squash/lean OR the leg swing (additive)', () => {
    const withArms: GaitProfile = { ...PLAYER_GAIT, armSwingAmplitude: 0.15 };
    const noArms: GaitProfile = { ...PLAYER_GAIT, armSwingAmplitude: 0 };
    const a = createWalkState();
    const b = createWalkState();
    for (let i = 0; i < 60; i++) {
      const oa = stepGait(a, 3, withArms, 0.016, false, false, T());
      const ob = stepGait(b, 3, noArms, 0.016, false, false, T());
      expect(oa.bobY).toBe(ob.bobY);
      expect(oa.scaleY).toBe(ob.scaleY);
      expect(oa.leanX).toBe(ob.leanX);
      expect(oa.legSwing).toBe(ob.legSwing); // CJ3 legs untouched by the arm knob
      expect(Math.abs(ob.armSwing)).toBe(0); // A=0 → no arm swing
    }
  });

  it('every CJ2 animal profile has armSwingAmplitude 0 → animals never swing arms (player-only)', () => {
    for (const kind of Object.keys(GAIT_PROFILES) as GaitKind[]) {
      expect(GAIT_PROFILES[kind].armSwingAmplitude).toBe(0);
    }
    expect(Math.abs(stepGait(createWalkState(), 5, GAIT_PROFILES.walk, 0.016, false, false, T()).armSwing)).toBe(0);
  });
});

describe('CJ3b — the shoulder-pivot re-parent is faithful (the L2 baselines stay put)', () => {
  it('buildPlayerModel returns two distinct arm pivots AT the shoulder, hand hanging, straight at rest', () => {
    const pm = buildPlayerModel();
    const shoulderY = PLAYER_MODEL.legHeight + PLAYER_MODEL.bodyHeight;
    expect(pm.armL).not.toBe(pm.armR);
    for (const arm of [pm.armL, pm.armR]) {
      expect(arm.position.y).toBeCloseTo(shoulderY, 9); // pivot AT the shoulder
      expect(arm.rotation.x).toBe(0); // straight at build (a still player looks unchanged)
      // The mesh hangs down armLength/2 → its centre is at the OLD fixed-arm centre (shoulder − len/2).
      const armCentreY = arm.position.y + arm.children[0].position.y;
      expect(armCentreY).toBeCloseTo(shoulderY - PLAYER_MODEL.armLength / 2, 9);
    }
    expect(pm.armL.position.x).toBeCloseTo(-(PLAYER_MODEL.bodyRadiusTop + PLAYER_MODEL.armRadius * 1.4), 9);
    expect(pm.armR.position.x).toBeCloseTo(PLAYER_MODEL.bodyRadiusTop + PLAYER_MODEL.armRadius * 1.4, 9);
  });
});
