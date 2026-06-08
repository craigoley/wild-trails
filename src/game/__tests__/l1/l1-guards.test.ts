import { describe, expect, it } from 'vitest';
import {
  runFrames,
  completeMeadowSet,
  completeWoodlandSet,
  completeWetlandSet,
  completeNightForagerGate,
  completeHighlandsResearch,
  completeRiverbankGate,
  completeCoastGate,
  catchRemainingSpecies,
} from './harness';
import { createJournal } from '../../../state/Journal';
import { isGameComplete, isBiomeGateMet } from '../../Missions';
import { finalCatchChance, resolveCatch, shakeCountForTier } from '../../Catch';
import { toolMultiplier, STARTER_TOOL } from '../../Tools';
import { createRng } from '../../../utils/rng';
import { SPECIES, CATCH, SPECIES_ORDER } from '../../../utils/constants';

/**
 * L1 — headless deterministic simulation guards. These verify LOGIC + BALANCE
 * automatically so manual playtesting shrinks to FEEL. Fixed seeds; float bands use
 * tolerances (never exact equality) — no flaky tests. See README.md.
 */

describe('L1 harness — deterministic + drivable', () => {
  it('same seed + same script -> identical state (determinism)', () => {
    const a = runFrames(777, () => ({}), 300);
    const b = runFrames(777, () => ({}), 300);
    expect(a.player.x).toBe(b.player.x);
    expect(a.player.y).toBe(b.player.y);
    expect(a.timeSec).toBe(b.timeSec);
  });

  it('a scripted input drives the sim (holding "right" moves the player)', () => {
    const moved = runFrames(1, () => ({ moveX: 1 }), 120);
    const still = runFrames(1, () => ({}), 120);
    expect(moved.player.x !== still.player.x || moved.player.y !== still.player.y).toBe(true);
  });
});

describe('L1 Guard 1 — the #46 auto-satisfaction regression (Craig pinned)', () => {
  it('completing the full catch-set progression does NOT auto-complete the night challenges', () => {
    const j = createJournal();
    completeMeadowSet(j);
    completeWoodlandSet(j);
    completeWetlandSet(j);
    // Normal progression never forces a meadow NIGHT catch -> the research challenges
    // stay OPEN. (The bug that cost a whole PR — now a permanent guard.)
    expect(j.missions['research-mouse-night']?.completed ?? false).toBe(false);
    expect(j.missions['research-rabbit-night']?.completed ?? false).toBe(false);
    // Run twice -> identical (no flake; pure logic).
    const j2 = createJournal();
    completeMeadowSet(j2);
    completeWoodlandSet(j2);
    completeWetlandSet(j2);
    expect(j2.missions['research-mouse-night']?.completed ?? false).toBe(false);
  });
});

describe('L1 Guard 2 — the anti-lockout catch-balance band (only automation can do this)', () => {
  it('an easy species is comfortably catchable BAIT-LESS — the valve holds', () => {
    const hedgehog = SPECIES.hedgehog; // meadow, tier 1, base 0.70
    const ctx = { dist: 0.5, tool: 'net' as const, biome: 'meadow' as const, correctBait: false, fleeing: false };
    const chance = finalCatchChance(hedgehog, ctx);

    // The deterministic chance sits in the anti-lockout valve band (~0.5–0.9).
    expect(chance).toBeGreaterThanOrEqual(0.5);
    expect(chance).toBeLessThanOrEqual(0.9);

    // 2000 SEEDED bait-less attempts: the empirical rate holds the valve AND faithfully
    // tracks the computed chance (the real multi-shake + crit resolution).
    const rng = createRng(0xb01dface);
    const N = 2000;
    let caught = 0;
    for (let i = 0; i < N; i++) {
      if (resolveCatch(chance, shakeCountForTier(hedgehog.tier), rng).caught) caught++;
    }
    const rate = caught / N;
    expect(rate).toBeGreaterThan(0.5); // never locked out
    expect(Math.abs(rate - chance)).toBeLessThan(0.06); // resolution faithful (crit raises slightly)
  });
});

describe('L1 Guard 3 — progression-to-win (the unlock chain + the win fires)', () => {
  it('the full gated path unlocks each biome in order and completes the game', () => {
    const j = createJournal();
    completeMeadowSet(j);
    expect(j.unlockedBiomes).toContain('woodland');
    completeWoodlandSet(j);
    expect(j.unlockedBiomes).toContain('wetland');
    completeWetlandSet(j);
    expect(j.unlockedBiomes).not.toContain('highlands'); // §4.1c: needs the mastery challenge too
    completeNightForagerGate(j);
    expect(j.unlockedBiomes).not.toContain('highlands'); // R2: ...AND the research wrap
    completeHighlandsResearch(j); // the §4.1.4 finale — study the wetland -> the route opens
    expect(j.unlockedBiomes).toContain('highlands');
    // §4.2 — the Riverbank (first NEW biome) is gated behind its OWN research (the non-forced
    // rabbit-dawn mastery + the highlands activity); the highlands alone don't open it.
    expect(j.unlockedBiomes).not.toContain('riverbank');
    completeRiverbankGate(j);
    expect(j.unlockedBiomes).toContain('riverbank');
    // §4.2 — the Coast (the 2nd new biome) is gated behind its OWN research (research-mouse-dusk
    // + the riverbank activity); the Riverbank alone doesn't open it.
    expect(j.unlockedBiomes).not.toContain('coast');
    completeCoastGate(j);
    expect(j.unlockedBiomes).toContain('coast');
    // Fill the dex (every roster, incl. the Coast five) -> the win fires. WIN REACHABLE through
    // every research-gated biome (the cardinal anti-wall pin: no impossible state).
    catchRemainingSpecies(j);
    expect(SPECIES_ORDER.every((id) => j.species[id])).toBe(true);
    expect(isGameComplete(j)).toBe(true);
  });

  it('BOTH Highlands gate orderings unlock it once the research wrap completes (the order-independence guard)', () => {
    // (a) wetland set THEN the gate challenge, then the research wrap.
    const a = createJournal();
    completeMeadowSet(a);
    completeWoodlandSet(a);
    completeWetlandSet(a);
    completeNightForagerGate(a);
    completeHighlandsResearch(a);
    expect(a.unlockedBiomes).toContain('highlands');

    // (b) the gate challenge THEN the wetland set, then the research wrap.
    const b = createJournal();
    completeMeadowSet(b);
    completeWoodlandSet(b);
    completeNightForagerGate(b); // challenge first (no unlock yet — set incomplete)
    expect(isBiomeGateMet(b, 'wetland')).toBe(false);
    completeWetlandSet(b); // set complete — §4.1c gate met, but still research-wrapped
    expect(b.unlockedBiomes).not.toContain('highlands');
    completeHighlandsResearch(b); // research last -> unlock
    expect(b.unlockedBiomes).toContain('highlands');
  });
});

describe('L1 Guard 4 — the catch-core invariant (a gear slice that shifts the curve FAILS here)', () => {
  it('the starter net is the neutral 1.0 multiplier and reach (attemptRadius) is 2.6', () => {
    expect(STARTER_TOOL).toBe('net');
    expect(toolMultiplier('net')).toBe(1.0); // no flat catch-rate advantage
    expect(CATCH.attemptRadius).toBe(2.6); // reach unchanged
  });
});
