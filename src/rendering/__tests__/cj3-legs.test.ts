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
 * CJ3 — limb articulation. The player's EXISTING legs swing at the hip on the SAME walkPhase as the
 * bob (FK, no IK). These pins guard the swing math (formula + sync + conservative amplitude), that
 * idle/freeze = straight legs, that CJ1/CJ2 are byte-identical (CJ3 is additive + player-only), and
 * that the hip-pivot re-parent renders the leg in its ORIGINAL position at rest (the L2 baselines
 * don't move). The FEEL — do the legs read as walking — is Craig's device gate, not a test.
 */

const T = () => createWalkTransform();
const smoothstep = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

describe('CJ3 — the FK leg-swing (pure walkCycle): formula, sync, conservative amplitude', () => {
  it('legSwing = blend · A · cos(walkPhase) — driven by the SAME phase as the bob (auto-synced)', () => {
    const s = createWalkState();
    const speed = CJ.walkSpeedRef * 0.5; // a mid-walk so blend ∈ (0,1) and cos varies
    const dt = 0.1;
    for (let i = 0; i < 7; i++) {
      const out = stepWalkCycle(s, speed, dt, false, T());
      const blend = smoothstep(speed / CJ.walkSpeedRef);
      const expected = blend * CJ.legSwingAmplitude * Math.cos(s.walkPhase); // s.walkPhase is THE bob's phase
      expect(out.legSwing).toBeCloseTo(expected, 9); // reads the same walkPhase → synced to the bob, no 2nd phase
    }
  });

  it('the amplitude is CONSERVATIVE: |legSwing| ≤ A at any phase, and A is in the gentle band (0.2–0.4)', () => {
    expect(CJ.legSwingAmplitude).toBeGreaterThanOrEqual(0.2); // not vanishing
    expect(CJ.legSwingAmplitude).toBeLessThanOrEqual(0.4); // not a high-kick (the jank to avoid)
    const s = createWalkState();
    for (let i = 0; i < 300; i++) {
      const out = stepWalkCycle(s, CJ.walkSpeedRef * 5, 0.02, false, T()); // way over ref → full blend
      expect(Math.abs(out.legSwing)).toBeLessThanOrEqual(CJ.legSwingAmplitude + 1e-9);
    }
  });

  it('the swing is at the bob-LOW (footfall) extremes: at full blend, legSwing peaks where the bob is low', () => {
    // The bob is 0.5(1−cos2φ) (low at φ=0,π); legSwing is A·cos(φ) (±A at φ=0,π). So |legSwing| is
    // maximal exactly when the bob is at its low (a foot planted, body lowest) — the natural sync.
    const A = CJ.legSwingAmplitude;
    for (const phi of [0, Math.PI]) {
      const bob = 0.5 * (1 - Math.cos(2 * phi));
      expect(bob).toBeCloseTo(0, 9); // bob low
      expect(Math.abs(A * Math.cos(phi))).toBeCloseTo(A, 9); // legs at fore/aft extreme
    }
    for (const phi of [Math.PI / 2, (3 * Math.PI) / 2]) {
      expect(0.5 * (1 - Math.cos(2 * phi))).toBeCloseTo(1, 9); // bob high (mid-stance)
      expect(A * Math.cos(phi)).toBeCloseTo(0, 9); // legs vertical
    }
  });
});

describe('CJ3 — ⚠️ idle/freeze = STILL, STRAIGHT legs (no twitch)', () => {
  it('at idle (speed 0) legSwing is 0 (blend 0 → the crossfade holds the legs straight)', () => {
    const s = createWalkState();
    for (let i = 0; i < 5; i++) {
      const out = stepWalkCycle(s, 0, 0.2, false, T());
      expect(out.legSwing).toBe(0);
    }
  });

  it('frozen → legSwing 0 (the L2 capture has straight legs, like the rest pose)', () => {
    const s = createWalkState();
    s.walkPhase = 1.2; // pre-loaded motion
    const out = stepWalkCycle(s, CJ.walkSpeedRef, 0.016, true, T());
    expect(out.legSwing).toBe(0);
    expect(out).toEqual({ bobY: 0, scaleXZ: 1, scaleY: 1, leanX: 0, legSwing: 0 });
  });
});

describe('CJ3 — ⚠️ additive: CJ1 bob/lean unchanged, CJ2 animals do NOT articulate (player-only)', () => {
  it('legSwingAmplitude does NOT affect bob/squash/lean — CJ1 is byte-identical (additive)', () => {
    // Same profile but A=0 vs A=0.3: the bob/scale/lean outputs must be identical (CJ3 only ADDS legSwing).
    const withSwing: GaitProfile = { ...PLAYER_GAIT, legSwingAmplitude: 0.3 };
    const noSwing: GaitProfile = { ...PLAYER_GAIT, legSwingAmplitude: 0 };
    const a = createWalkState();
    const b = createWalkState();
    for (let i = 0; i < 60; i++) {
      const oa = stepGait(a, 3, withSwing, 0.016, false, false, T());
      const ob = stepGait(b, 3, noSwing, 0.016, false, false, T());
      expect(oa.bobY).toBe(ob.bobY);
      expect(oa.scaleY).toBe(ob.scaleY);
      expect(oa.scaleXZ).toBe(ob.scaleXZ);
      expect(oa.leanX).toBe(ob.leanX);
      expect(Math.abs(ob.legSwing)).toBe(0); // A=0 → no swing (abs normalises the IEEE -0)
    }
  });

  it('every CJ2 animal profile has legSwingAmplitude 0 → animals never articulate legs (player-only)', () => {
    for (const kind of Object.keys(GAIT_PROFILES) as GaitKind[]) {
      expect(GAIT_PROFILES[kind].legSwingAmplitude).toBe(0);
    }
    // …and so an animal's legSwing output stays 0 even at full gallop.
    const s = createWalkState();
    const out = stepGait(s, 5, GAIT_PROFILES.walk, 0.016, false, false, T());
    expect(Math.abs(out.legSwing)).toBe(0); // abs normalises the IEEE -0
  });
});

describe('CJ3 — the hip-pivot re-parent is faithful (the L2 baselines stay put)', () => {
  it('buildPlayerModel returns two distinct leg pivots AT the hip, foot at y=0 at rest', () => {
    const pm = buildPlayerModel();
    expect(pm.legL).not.toBe(pm.legR);
    for (const leg of [pm.legL, pm.legR]) {
      expect(leg.position.y).toBeCloseTo(PLAYER_MODEL.legHeight, 9); // pivot AT the hip
      expect(leg.rotation.x).toBe(0); // straight at build (a still player looks unchanged)
      // The mesh hangs down legHeight/2 → its foot tip sits at world y = 0 (identical to the old leg).
      const footY = leg.position.y + leg.children[0].position.y - PLAYER_MODEL.legHeight / 2;
      expect(footY).toBeCloseTo(0, 9);
    }
    // Left/right pivots straddle the centre by legSpread.
    expect(pm.legL.position.x).toBeCloseTo(-PLAYER_MODEL.legSpread, 9);
    expect(pm.legR.position.x).toBeCloseTo(PLAYER_MODEL.legSpread, 9);
  });
});
