/**
 * §4.6 D2 (ii) — the SIGNATURE render motion (the signature beat). A small, characterful idle motion layered
 * on the gait: the dipper BOBS (a gentle vertical bob), the wagtail WAGS (a lateral tail-wag roll). PURE +
 * Node-testable: NO three, NO DOM — just numbers, like walkCycle. The EntityRenderer applies the result on
 * top of the gait transform (bob → +y, wag → rotation.z).
 *
 * ⚠️ It plays only while the animal is CALM/active (not fleeing); FROZEN, an inactive/fleeing animal, or a
 * 'none' species → NEUTRAL (zeroed), so the L2 freeze capture is byte-stable (the same rule as stepGait).
 * One small accumulator per animal (reused from a pool) — ZERO per-frame allocation.
 */

import { SIGNATURE, type SignatureKind } from '../utils/constants';

const TAU = Math.PI * 2;

/** The persisted signature accumulator (one per animal; mutated in place — no alloc). */
export interface SignatureState {
  /** The beat clock, seconds. */
  clock: number;
}

/** The per-frame signature transform, layered on the gait (written into `out`). */
export interface SignatureTransform {
  /** Extra vertical bob (world units) — the dipper's bob; added to the gait bob. */
  bobY: number;
  /** Lateral roll (radians, about the forward axis) — the wagtail's tail-wag. */
  rollZ: number;
}

export function createSignatureState(): SignatureState {
  return { clock: 0 };
}

export function createSignatureTransform(): SignatureTransform {
  return { bobY: 0, rollZ: 0 };
}

/** Reset to the neutral pose (no bob, no roll) — frozen / not active / 'none'. */
function neutral(state: SignatureState, out: SignatureTransform): SignatureTransform {
  state.clock = 0;
  out.bobY = 0;
  out.rollZ = 0;
  return out;
}

/**
 * Advance `state` by `dt` and write the signature transform into `out`. `active` is "the animal is calm"
 * (the renderer passes `aiState !== 'flee'`) — a bolting animal doesn't bob/wag. FROZEN or 'none' or
 * inactive → neutral (accumulator zeroed), so the byte-stable L2 capture is unchanged. Pure (mutates
 * `state` + `out` only).
 */
export function stepSignature(
  state: SignatureState,
  kind: SignatureKind,
  active: boolean,
  dt: number,
  frozen: boolean,
  out: SignatureTransform,
): SignatureTransform {
  if (frozen || !active || kind === 'none') return neutral(state, out);

  state.clock += dt;
  const phase = state.clock * SIGNATURE.freqHz * TAU;
  switch (kind) {
    case 'bob':
      out.bobY = SIGNATURE.bobAmplitude * Math.sin(phase); // a rhythmic vertical bob
      out.rollZ = 0;
      break;
    case 'wag':
      out.bobY = 0;
      out.rollZ = SIGNATURE.wagAmplitude * Math.sin(phase); // a lateral tail-wag flick
      break;
  }
  return out;
}
