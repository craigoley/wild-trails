/**
 * Character Juice CJ1+CJ2 — the procedural GAIT math. PURE + Node-testable: NO three,
 * NO DOM — just numbers. Given a SPEED + a small persisted accumulator state + a
 * per-archetype PROFILE, it advances the cycle and returns the VISUAL transform (bob /
 * squash-stretch / lean) the renderer applies to an entity Group, AROUND its logical
 * position. Cosmetic by construction — the sim never sees it.
 *
 * CJ1 (player) uses the 'walk' PLAYER_GAIT profile (= CHARACTER_JUICE); CJ2 (animals)
 * use GAIT_PROFILES (walk / hop / bird / swim), differing in MAGNITUDES + the BOB CURVE.
 * `stepWalkCycle` is a thin byte-identical delegate so the CJ1 player walk is unchanged.
 *
 * Two phase sources, crossfaded by speed: walkPhase (DISTANCE-driven — stops dead when
 * not moving / frozen) + idleClock (dt-driven breathing). FREEZE → NEUTRAL rest pose.
 */

import { CHARACTER_JUICE as CJ, type GaitKind } from '../utils/constants';
import { clamp } from '../utils/math';

const TAU = Math.PI * 2;

/** A gait archetype's tunable params (structurally GAIT_PROFILES / PLAYER_GAIT). */
export interface GaitProfile {
  kind: GaitKind;
  strideRate: number;
  walkSpeedRef: number;
  bobAmplitude: number;
  squashAmplitude: number;
  leanMaxRad: number;
  leanSpringRate: number;
  idleAmplitude: number;
  idleFreqHz: number;
  /** Multipliers applied while FLEEING (cadence + bob) — a more urgent gait. */
  fleeStrideMult: number;
  fleeBobMult: number;
  /** CJ3 — hip-swing amplitude (radians) for ARTICULATED legs. The renderer rotates each leg's
   *  hip by ±legSwing about the lateral axis. PLAYER-only: the animal profiles set 0 (no leg
   *  articulation yet), so CJ2 is byte-identical. A gentle stride (~0.3); a high-kick is jank. */
  legSwingAmplitude: number;
  /** CJ3b — shoulder-swing amplitude (radians) for the ARMS. Same phase as the legs, but the arm
   *  COUNTER-swings its same-side leg (contralateral) and SUBTLER (smaller than legSwing) — a gentle
   *  counter-balance, not a march. PLAYER-only (animals 0). */
  armSwingAmplitude: number;
}

/** The persisted accumulators (one per entity; mutated in place — no alloc). */
export interface WalkState {
  /** Distance-driven cycle phase, radians (kept in [0, 2π)). */
  walkPhase: number;
  /** Breathing clock, seconds. */
  idleClock: number;
  /** Smoothed lean angle, radians. */
  lean: number;
}

/** The per-frame visual transform applied to an entity Group (written into `out`). */
export interface WalkTransform {
  bobY: number;
  scaleXZ: number;
  scaleY: number;
  leanX: number;
  /** CJ3 — the hip-swing angle (radians) for one (the "reference") leg; the opposite leg uses
   *  −legSwing. 0 at idle/freeze (still legs). The renderer applies it to the player's leg pivots. */
  legSwing: number;
  /** CJ3b — the shoulder-swing magnitude (radians) for the arms; the renderer applies it
   *  CONTRALATERALLY (each arm opposite its same-side leg). 0 at idle/freeze (still arms). */
  armSwing: number;
}

export function createWalkState(): WalkState {
  return { walkPhase: 0, idleClock: 0, lean: 0 };
}

export function createWalkTransform(): WalkTransform {
  return { bobY: 0, scaleXZ: 1, scaleY: 1, leanX: 0, legSwing: 0, armSwing: 0 };
}

/** The CJ1 player gait — the 'walk' archetype at the CHARACTER_JUICE magnitudes. Flee
 *  mults are 1 (the player never "flees"), so stepWalkCycle is byte-identical to CJ1. */
export const PLAYER_GAIT: GaitProfile = {
  kind: 'walk',
  strideRate: CJ.strideRate,
  walkSpeedRef: CJ.walkSpeedRef,
  bobAmplitude: CJ.bobAmplitude,
  squashAmplitude: CJ.squashAmplitude,
  leanMaxRad: CJ.leanMaxRad,
  leanSpringRate: CJ.leanSpringRate,
  idleAmplitude: CJ.idleAmplitude,
  idleFreqHz: CJ.idleFreqHz,
  fleeStrideMult: 1,
  fleeBobMult: 1,
  legSwingAmplitude: CJ.legSwingAmplitude, // CJ3 — the player's legs articulate
  armSwingAmplitude: CJ.armSwingAmplitude, // CJ3b — …and the arms counter-swing
};

/** Reset to the neutral rest pose (bob 0, scale 1, lean 0, limbs straight). */
function neutral(out: WalkTransform): WalkTransform {
  out.bobY = 0;
  out.scaleXZ = 1;
  out.scaleY = 1;
  out.leanX = 0;
  out.legSwing = 0; // CJ3 — frozen/neutral = straight legs (the L2 capture is unchanged)
  out.armSwing = 0; // CJ3b — …and straight arms
  return out;
}

/** smoothstep(0,1,t) — a soft idle↔move crossfade (no pop at start/stop). */
function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Advance `state` by `dt` at `speed` (world units/sec) under `profile`, writing the
 * visual transform into `out`. The only effects are mutating `state` + `out` (pure).
 * `fleeing` applies the profile's flee multipliers (a more urgent gait). Frozen →
 * neutral pose, accumulators zeroed (the byte-stable L2 capture).
 *
 * The BOB CURVE varies by `profile.kind`: walk = a 2-dip footfall; hop = an arc'd bound
 * with a grounded pause (squash on land, stretch at apex); bird = a tiny quick bob; swim
 * = a smooth low glide (no squash). The phase/idle/lean machinery is shared.
 */
export function stepGait(
  state: WalkState,
  speed: number,
  profile: GaitProfile,
  dt: number,
  frozen: boolean,
  fleeing: boolean,
  out: WalkTransform,
): WalkTransform {
  if (frozen) {
    state.walkPhase = 0;
    state.idleClock = 0;
    state.lean = 0;
    return neutral(out);
  }

  const strideMult = fleeing ? profile.fleeStrideMult : 1;
  const bobMult = fleeing ? profile.fleeBobMult : 1;

  state.walkPhase = (state.walkPhase + speed * dt * profile.strideRate * strideMult) % TAU;
  state.idleClock += dt;

  const blend = smoothstep(speed / profile.walkSpeedRef); // 0 = idle, 1 = full gait
  const phi = state.walkPhase;

  // LEAN: ease toward speed·max, spring back to 0 when stopped.
  const leanTarget = blend * profile.leanMaxRad;
  state.lean += (leanTarget - state.lean) * clamp(profile.leanSpringRate * dt, 0, 1);

  const idleBob = profile.idleAmplitude * Math.sin(TAU * profile.idleFreqHz * state.idleClock);
  const sQ = blend * profile.squashAmplitude;

  let moveBob: number;
  switch (profile.kind) {
    case 'hop': {
      // An arc'd bound: up over half the cycle, GROUNDED (paused) the other half.
      const arc = Math.max(0, Math.sin(phi));
      moveBob = profile.bobAmplitude * bobMult * arc;
      // Squash on the ground (arc low), stretch at the apex (arc high).
      out.scaleY = 1 + sQ * (2 * arc - 1);
      break;
    }
    case 'swim': {
      // A smooth low glide — one gentle undulation per cycle, no squash.
      moveBob = profile.bobAmplitude * bobMult * Math.sin(phi);
      out.scaleY = 1; // sQ is 0 for swim, but be explicit
      break;
    }
    case 'walk':
    case 'bird':
    default: {
      // A 2-dip footfall: 0.5(1 - cos 2φ) is 0 at footfall (low) and 1 mid-stride (high).
      moveBob = profile.bobAmplitude * bobMult * 0.5 * (1 - Math.cos(2 * phi));
      out.scaleY = 1 - sQ * Math.cos(2 * phi);
      break;
    }
  }

  out.bobY = blend * moveBob + (1 - blend) * idleBob;
  out.scaleXZ = 1 / Math.sqrt(out.scaleY); // VOLUME-PRESERVING (scaleY · scaleXZ² = 1)
  out.leanX = state.lean;

  // CJ3 — the FK leg hip-swing. Reuses THIS SAME walkPhase, so it's synced to the bob with no
  // second phase: cos(φ) puts the legs at their fore/aft EXTREME exactly at the bob's low (the
  // footfall / double-support, body lowest) and VERTICAL at the bob's high (mid-stance). Scaled by
  // `blend` so it crossfades out at idle (still legs at rest). The renderer applies +legSwing to one
  // leg and −legSwing to the other (opposition). 0 for the animals (legSwingAmplitude 0 → CJ2 same).
  out.legSwing = blend * profile.legSwingAmplitude * Math.cos(phi);
  // CJ3b — the arm shoulder-swing: the SAME phase + shape, a SUBTLER amplitude. The renderer applies
  // it CONTRALATERALLY (each arm opposite its same-side leg), so it's auto-synced to the legs/bob.
  out.armSwing = blend * profile.armSwingAmplitude * Math.cos(phi);
  return out;
}

/**
 * CJ1 — the player walk. A byte-identical delegate to stepGait under the PLAYER_GAIT
 * ('walk') profile, never fleeing — so the player walk is unchanged through the CJ2
 * generalization (pinned in a test).
 */
export function stepWalkCycle(
  state: WalkState,
  speed: number,
  dt: number,
  frozen: boolean,
  out: WalkTransform,
): WalkTransform {
  return stepGait(state, speed, PLAYER_GAIT, dt, frozen, false, out);
}
