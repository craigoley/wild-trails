import { describe, expect, it } from 'vitest';
import {
  PLAYER_GAIT,
  createWalkState,
  createWalkTransform,
  stepGait,
  stepWalkCycle,
  type WalkState,
  type WalkTransform,
} from '../walkCycle';
import { CHARACTER_JUICE as CJ, GAIT_PROFILES, SPECIES, SPECIES_ORDER } from '../../utils/constants';

const T = () => createWalkTransform();
const TAU = Math.PI * 2;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** A standalone re-implementation of the ORIGINAL CJ1 walk math — the byte-identical oracle. */
function cj1Ref(s: WalkState, speed: number, dt: number, frozen: boolean, out: WalkTransform): WalkTransform {
  if (frozen) {
    s.walkPhase = 0; s.idleClock = 0; s.lean = 0;
    out.bobY = 0; out.scaleXZ = 1; out.scaleY = 1; out.leanX = 0;
    return out;
  }
  s.walkPhase = (s.walkPhase + speed * dt * CJ.strideRate) % TAU;
  s.idleClock += dt;
  const ss = clamp(speed / CJ.walkSpeedRef, 0, 1);
  const blend = ss * ss * (3 - 2 * ss);
  const leanTarget = blend * CJ.leanMaxRad;
  s.lean += (leanTarget - s.lean) * clamp(CJ.leanSpringRate * dt, 0, 1);
  const walkBob = CJ.bobAmplitude * 0.5 * (1 - Math.cos(2 * s.walkPhase));
  const idleBob = CJ.idleAmplitude * Math.sin(TAU * CJ.idleFreqHz * s.idleClock);
  out.bobY = blend * walkBob + (1 - blend) * idleBob;
  const sQ = blend * CJ.squashAmplitude;
  out.scaleY = 1 - sQ * Math.cos(2 * s.walkPhase);
  out.scaleXZ = 1 / Math.sqrt(out.scaleY);
  out.leanX = s.lean;
  out.legSwing = blend * CJ.legSwingAmplitude * Math.cos(s.walkPhase); // CJ3 — additive hip-swing
  return out;
}

describe('⚠️ CJ1 BYTE-IDENTICAL: the player walk is unchanged through the stepGait generalization', () => {
  it('stepWalkCycle === the original CJ1 formula across speeds/phases (behaviour-neutral refactor)', () => {
    const a = createWalkState(); // through stepGait(PLAYER_GAIT)
    const b = createWalkState(); // through the CJ1 oracle
    const speeds = [0, 0.3, 1.1, CJ.walkSpeedRef, 5];
    for (let i = 0; i < 120; i++) {
      const speed = speeds[i % speeds.length];
      const o1 = stepWalkCycle(a, speed, 0.016, false, T());
      const oRef = cj1Ref(b, speed, 0.016, false, T());
      expect(o1).toEqual(oRef);
      expect(a).toEqual(b);
    }
    // PLAYER_GAIT carries the CHARACTER_JUICE magnitudes (the 'walk' player profile).
    expect(PLAYER_GAIT.kind).toBe('walk');
    expect(PLAYER_GAIT.bobAmplitude).toBe(CJ.bobAmplitude);
  });
});

describe('stepGait — per-archetype bob curves', () => {
  it('HOP: a grounded/squashed PAUSE (arc low) and a stretched APEX (arc high)', () => {
    const s = createWalkState();
    let sawGroundSquash = false;
    let sawApexStretch = false;
    for (let i = 0; i < 200; i++) {
      const out = stepGait(s, GAIT_PROFILES.hop.walkSpeedRef, GAIT_PROFILES.hop, 0.05, false, false, T());
      if (out.scaleY < 1 - 1e-3) sawGroundSquash = true; // squash on the ground
      if (out.scaleY > 1 + 1e-3) sawApexStretch = true; // stretch at the apex
    }
    expect(sawGroundSquash).toBe(true);
    expect(sawApexStretch).toBe(true);
  });

  it('SWIM: NO squash at any phase (a smooth low glide), still volume-consistent', () => {
    const s = createWalkState();
    for (let i = 0; i < 64; i++) {
      const out = stepGait(s, GAIT_PROFILES.swim.walkSpeedRef, GAIT_PROFILES.swim, 0.05, false, false, T());
      expect(out.scaleY).toBe(1);
      expect(out.scaleXZ).toBe(1);
    }
  });

  it('BIRD is subtler than WALK/HOP (a smaller bob amplitude — mostly still)', () => {
    expect(GAIT_PROFILES.bird.bobAmplitude).toBeLessThan(GAIT_PROFILES.walk.bobAmplitude);
    expect(GAIT_PROFILES.bird.bobAmplitude).toBeLessThan(GAIT_PROFILES.hop.bobAmplitude);
  });

  it('every archetype keeps the squash VOLUME-PRESERVING (scaleY · scaleXZ² ≈ 1)', () => {
    for (const p of Object.values(GAIT_PROFILES)) {
      const s = createWalkState();
      for (let i = 0; i < 40; i++) {
        const out = stepGait(s, p.walkSpeedRef, p, 0.05, false, false, T());
        expect(out.scaleY * out.scaleXZ * out.scaleXZ).toBeCloseTo(1, 6);
      }
    }
  });
});

describe('⚠️ the FLEE modifier — a faster, bigger gait while fleeing', () => {
  it('fleeing advances the phase faster AND bobs bigger than the same step not-fleeing', () => {
    const calm = createWalkState();
    const flee = createWalkState();
    const p = GAIT_PROFILES.walk;
    const oc = stepGait(calm, p.walkSpeedRef, p, 0.05, false, false, T());
    const of = stepGait(flee, p.walkSpeedRef, p, 0.05, false, true, T());
    expect(flee.walkPhase).toBeGreaterThan(calm.walkPhase); // fleeStrideMult > 1
    expect(Math.abs(of.bobY)).toBeGreaterThan(Math.abs(oc.bobY)); // fleeBobMult > 1
  });
});

describe('⚠️ FREEZE → NEUTRAL for every gait (the L2 baselines stay put)', () => {
  it('frozen returns the rest pose + zeroes the accumulators, for any profile', () => {
    for (const p of [PLAYER_GAIT, ...Object.values(GAIT_PROFILES)]) {
      const s: WalkState = { walkPhase: 2, idleClock: 5, lean: 0.1 };
      const out = stepGait(s, p.walkSpeedRef, p, 0.016, true, true, T());
      expect(out).toEqual({ bobY: 0, scaleXZ: 1, scaleY: 1, leanX: 0, legSwing: 0 }); // CJ3 — straight legs frozen
      expect(s).toEqual({ walkPhase: 0, idleClock: 0, lean: 0 });
    }
  });
});

describe('the species gait mapping (real locomotion — a few archetypes, not per-species)', () => {
  it('every species carries a valid land-gait tag', () => {
    for (const id of SPECIES_ORDER) {
      expect(['walk', 'hop', 'bird'], id).toContain(SPECIES[id].gait);
    }
  });

  it('the locked judgment calls + a sample of the mapping', () => {
    expect(SPECIES.redsquirrel.gait).toBe('hop'); // it bounds (the locked call)
    expect(SPECIES.roedeer.gait).toBe('walk'); // it walks; flee handles the startle (the locked call)
    expect(SPECIES.rabbit.gait).toBe('hop');
    expect(SPECIES.frog.gait).toBe('hop');
    expect(SPECIES.mountainhare.gait).toBe('hop');
    expect(SPECIES.hedgehog.gait).toBe('walk');
    expect(SPECIES.badger.gait).toBe('walk');
    expect(SPECIES.otter.gait).toBe('walk'); // SWIM is a runtime override in water
    expect(SPECIES.kingfisher.gait).toBe('bird');
    expect(SPECIES.greywagtail.gait).toBe('bird');
  });
});
