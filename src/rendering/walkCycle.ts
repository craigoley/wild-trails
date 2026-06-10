/**
 * Character Juice CJ1 — the procedural player WALK CYCLE math. PURE + Node-testable:
 * NO three, NO DOM — just numbers. Given the player's SPEED and a small persisted
 * accumulator state, it advances the cycle and returns the VISUAL transform (bob /
 * squash-stretch / lean) the renderer applies to the player Group. The logical
 * position is untouched (the renderer transforms the mesh AROUND it) — so this is
 * cosmetic by construction (the sim never sees it).
 *
 * Two phase sources, crossfaded by speed:
 *  - walkPhase: DISTANCE-driven (advanced by speed·dt) — the bob/squash/lean rhythm
 *    tracks pace and stops dead when not moving (and when frozen).
 *  - idleClock: dt-driven — the slow breathing bob at rest.
 *
 * FREEZE → NEUTRAL: when `frozen`, no clock advances and the transform is the rest
 * pose (bob 0, scale 1, lean 0) — so an L2 capture is identical to the static capsule.
 */

import { CHARACTER_JUICE as CJ } from '../utils/constants';
import { clamp } from '../utils/math';

const TAU = Math.PI * 2;

/** The persisted walk accumulators (held by the renderer; mutated in place — no alloc). */
export interface WalkState {
  /** Distance-driven cycle phase, radians (kept in [0, 2π)). */
  walkPhase: number;
  /** Breathing clock, seconds. */
  idleClock: number;
  /** Smoothed lean angle, radians (springs toward its speed target). */
  lean: number;
}

/** The per-frame visual transform applied to the player Group (written into `out`). */
export interface WalkTransform {
  bobY: number;
  scaleXZ: number;
  scaleY: number;
  leanX: number;
}

export function createWalkState(): WalkState {
  return { walkPhase: 0, idleClock: 0, lean: 0 };
}

export function createWalkTransform(): WalkTransform {
  return { bobY: 0, scaleXZ: 1, scaleY: 1, leanX: 0 };
}

/** Reset to the neutral rest pose (bob 0, scale 1, lean 0). */
function neutral(out: WalkTransform): WalkTransform {
  out.bobY = 0;
  out.scaleXZ = 1;
  out.scaleY = 1;
  out.leanX = 0;
  return out;
}

/** smoothstep(0,1,t) — a soft idle↔walk crossfade (no pop at start/stop). */
function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Advance the walk state by `dt` at `speed` (world units/sec) and write the visual
 * transform into `out`. Pure given (state, speed, dt, frozen): the only effect is
 * mutating `state` (the accumulators) and `out`. Returns `out`.
 *
 * Frozen → neutral pose, accumulators zeroed (the byte-stable L2 capture).
 */
export function stepWalkCycle(
  state: WalkState,
  speed: number,
  dt: number,
  frozen: boolean,
  out: WalkTransform,
): WalkTransform {
  if (frozen) {
    state.walkPhase = 0;
    state.idleClock = 0;
    state.lean = 0;
    return neutral(out);
  }

  // Advance the accumulators. walkPhase by DISTANCE (speed·dt) so the cadence is
  // per-stride, not per-second; wrapped to stay bounded.
  state.walkPhase = (state.walkPhase + speed * dt * CJ.strideRate) % TAU;
  state.idleClock += dt;

  const blend = smoothstep(speed / CJ.walkSpeedRef); // 0 = idle, 1 = full walk

  // LEAN: ease toward speed·max, spring back to 0 when stopped.
  const leanTarget = blend * CJ.leanMaxRad;
  state.lean += (leanTarget - state.lean) * clamp(CJ.leanSpringRate * dt, 0, 1);

  // BOB: walk bob dips twice per cycle (a footfall at each dip); crossfade with the
  // idle breathing. 0.5·(1 - cos 2φ) is 0 at footfall (low) and 1 mid-stride (high).
  const walkBob = CJ.bobAmplitude * 0.5 * (1 - Math.cos(2 * state.walkPhase));
  const idleBob = CJ.idleAmplitude * Math.sin(TAU * CJ.idleFreqHz * state.idleClock);
  out.bobY = blend * walkBob + (1 - blend) * idleBob;

  // SQUASH & STRETCH (only while walking): squash at footfall (scaleY < 1), stretch at
  // the rise (scaleY > 1). VOLUME-PRESERVING — scaleXZ = 1/√scaleY so scaleY·scaleXZ² = 1.
  const sQ = blend * CJ.squashAmplitude;
  out.scaleY = 1 - sQ * Math.cos(2 * state.walkPhase);
  out.scaleXZ = 1 / Math.sqrt(out.scaleY);

  // LEAN (forward pitch — the renderer composes it with the facing yaw).
  out.leanX = state.lean;

  return out;
}
