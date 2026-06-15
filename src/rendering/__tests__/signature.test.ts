import { describe, expect, it } from 'vitest';
import {
  createSignatureState,
  createSignatureTransform,
  stepSignature,
} from '../signature';
import { SIGNATURE } from '../../utils/constants';

/**
 * §4.6 D2 (ii) — the SIGNATURE render motion (the jizz beat). Pure, like walkCycle. These pin: bob moves
 * the vertical only, wag rolls the lateral only, and — the L2 rule — FROZEN / inactive / 'none' collapse to
 * NEUTRAL with the accumulator zeroed (byte-stable capture) and ZERO per-frame allocation (the out scratch
 * is reused). The on-device LOOK of the bob/wag is Craig's gate.
 */

const ST = () => createSignatureState();
const OUT = createSignatureTransform();

describe('stepSignature — the per-species jizz beat', () => {
  it('bob moves the vertical (bobY) only; wag rolls the lateral (rollZ) only', () => {
    const bob = stepSignature(ST(), 'bob', true, 0.2, false, OUT);
    expect(Math.abs(bob.bobY)).toBeGreaterThan(0);
    expect(bob.rollZ).toBe(0);
    expect(Math.abs(bob.bobY)).toBeLessThanOrEqual(SIGNATURE.bobAmplitude + 1e-9);

    const wag = stepSignature(ST(), 'wag', true, 0.2, false, OUT);
    expect(Math.abs(wag.rollZ)).toBeGreaterThan(0);
    expect(wag.bobY).toBe(0);
    expect(Math.abs(wag.rollZ)).toBeLessThanOrEqual(SIGNATURE.wagAmplitude + 1e-9);
  });

  it("a 'none' species is neutral (no motion)", () => {
    const t = stepSignature(ST(), 'none', true, 0.2, false, OUT);
    expect(t.bobY).toBe(0);
    expect(t.rollZ).toBe(0);
  });

  it('⚠️ FROZEN → neutral, accumulator zeroed (the L2 freeze capture stays byte-stable)', () => {
    const s = ST();
    stepSignature(s, 'bob', true, 0.2, false, OUT); // advance the clock a bit
    expect(s.clock).toBeGreaterThan(0);
    const t = stepSignature(s, 'bob', true, 0.2, true, OUT); // …then freeze
    expect(t.bobY).toBe(0);
    expect(t.rollZ).toBe(0);
    expect(s.clock).toBe(0); // reset → the next unfrozen frame starts from neutral, deterministically
  });

  it('⚠️ an INACTIVE (fleeing) animal is neutral — it bolts, it doesn’t bob/wag', () => {
    const t = stepSignature(ST(), 'bob', false, 0.2, false, OUT);
    expect(t.bobY).toBe(0);
    expect(t.rollZ).toBe(0);
  });

  it('⚠️ reuses the `out` scratch (no per-frame allocation in the render loop)', () => {
    const s = ST();
    const a = stepSignature(s, 'bob', true, 0.1, false, OUT);
    const b = stepSignature(s, 'bob', true, 0.1, false, OUT);
    expect(a).toBe(OUT); // filled the SAME object
    expect(b).toBe(a); // every call reuses it
  });
});
