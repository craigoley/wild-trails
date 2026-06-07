import { describe, expect, it } from 'vitest';
import { createHideState, deployHide, isUnderHide } from '../Hide';
import { createGameState, update } from '../GameState';
import { createIntent } from '../Input';
import { isInCover } from '../World';
import { HIDE, SIM_DT, STEALTH } from '../../utils/constants';

describe('Hide — the portable cover gear (slice C)', () => {
  it('a fresh hide is undeployed; deploying plants it at a position within its radius', () => {
    const h = createHideState();
    expect(h.deployed).toBe(false);
    expect(isUnderHide(h, 0, 0)).toBe(false);

    deployHide(h, 5, -3);
    expect(h.deployed).toBe(true);
    expect(isUnderHide(h, 5, -3)).toBe(true); // at the hide
    expect(isUnderHide(h, 5, -3 + HIDE.radius - 0.01)).toBe(true); // just inside
    expect(isUnderHide(h, 5, -3 + HIDE.radius + 0.1)).toBe(false); // outside the radius
  });

  it('re-deploying just moves the single hide', () => {
    const h = createHideState();
    deployHide(h, 1, 1);
    deployHide(h, 9, 9);
    expect(isUnderHide(h, 1, 1)).toBe(false); // old spot abandoned
    expect(isUnderHide(h, 9, 9)).toBe(true);
  });
});

describe('Hide — deploying MAKES cover on open ground (LATERAL, no catch change)', () => {
  it('deploying via intent puts the player in cover where there is no fixed spot', () => {
    const g = createGameState(1);
    g.player.x = 0; // open ground — no fixed meadow hiding spot covers (0,0)
    g.player.y = 0;
    expect(isInCover(g.world, 0, 0)).toBe(false); // genuinely open before the hide

    update(g, { ...createIntent(), hideDeploy: true }, SIM_DT);

    expect(g.hide.deployed).toBe(true);
    expect(g.hide.x).toBe(0);
    expect(g.stealth.inCover).toBe(true); // now in cover — via the hide
  });

  it('the hide grants the SAME cover stealth lever (≤ ×0.45), never a >1 catch boost (lateral)', () => {
    const g = createGameState(2);
    g.player.x = 0;
    g.player.y = 0;
    update(g, { ...createIntent(), hideDeploy: true }, SIM_DT);
    // The hide only feeds the existing STEALTH input — the factor is the cover lever
    // (≤ coverFactor), and is always < 1. No catch-rate multiplier exists.
    expect(g.stealth.factor).toBeLessThanOrEqual(STEALTH.coverFactor);
    expect(g.stealth.factor).toBeLessThan(1);
  });
});
