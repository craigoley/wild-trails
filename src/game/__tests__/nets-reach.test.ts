import { describe, expect, it } from 'vitest';
import { createGameState, update } from '../GameState';
import { createIntent } from '../Input';
import { proximityMultiplier } from '../Catch';
import { toolReach } from '../Tools';
import { spawnAnimal } from '../Animal';
import { TOOLS, CATCH, SIM_DT } from '../../utils/constants';
import { JOURNAL_SCHEMA_VERSION } from '../../state/Journal';

/**
 * Nets & Gear slice B0 — per-net REACH as a lateral catch INPUT. Behavior-neutral: the
 * starter Hand Net's reach equals the old global attemptRadius, and ALL THREE catch-path
 * reach reads (proximity, the attempt gate, the arm/targeting) route through the active
 * net's reach. B1 varies reach per biome net; B0 only establishes the mechanism.
 */

const REACH = toolReach('net'); // 2.6 — the starter net's reach

/** A fresh headless game with a single fieldmouse `d` units east of the player. */
function gameWithAnimalAt(d: number) {
  const g = createGameState(5);
  for (const a of g.animals) a.active = false; // clear any boot spawn
  g.spawnTimer = 1e9; // pause spawning
  g.player.x = 0;
  g.player.y = 0;
  spawnAnimal(g.animals, 'fieldmouse', d, 0);
  return g;
}

describe('B0 keystone — reach === the old attemptRadius (the behavior-neutral guarantee)', () => {
  it('the starter Hand Net reach is exactly the current attemptRadius', () => {
    expect(TOOLS.net.reach).toBe(2.6);
    expect(TOOLS.net.reach).toBe(CATCH.attemptRadius); // the keystone
    expect(toolReach('net')).toBe(CATCH.attemptRadius);
  });

  it('proximityMultiplier defaults to attemptRadius — isolated callers unchanged', () => {
    expect(proximityMultiplier(1.3)).toBe(proximityMultiplier(1.3, CATCH.attemptRadius));
  });

  it('no schema change — reach is a STATIC net property, not player state (v6)', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(6);
  });
});

describe('B0 — all THREE reach read sites route through the active net (the audit, permanent)', () => {
  it('SITE 1 (proximity): the curve normalizes by the net reach — min at reach, max point-blank', () => {
    expect(proximityMultiplier(REACH, REACH)).toBeCloseTo(CATCH.proximityMin, 10);
    expect(proximityMultiplier(0, REACH)).toBeCloseTo(CATCH.proximityMax, 10);
  });

  it('SITE 3 (arm/targeting): the CATCH arms only within the net reach', () => {
    const inReach = gameWithAnimalAt(REACH - 0.3);
    update(inReach, createIntent(), SIM_DT);
    expect(inReach.catchArmed).toBe(true);

    const outReach = gameWithAnimalAt(REACH + 1.0);
    update(outReach, createIntent(), SIM_DT);
    expect(outReach.catchArmed).toBe(false);
  });

  it('SITE 2 (attempt gate): a catch attempt starts only within the net reach', () => {
    const inReach = gameWithAnimalAt(REACH - 0.3);
    update(inReach, { ...createIntent(), catchPressed: true }, SIM_DT);
    expect(inReach.encounter).not.toBeNull();

    const outReach = gameWithAnimalAt(REACH + 1.0);
    update(outReach, { ...createIntent(), catchPressed: true }, SIM_DT);
    expect(outReach.encounter).toBeNull();
  });
});

describe('B0 — behavior-neutral: the starter net catches exactly as the constant did', () => {
  it('arm + gate boundaries sit at the same 2.6 the global constant gave (curve unchanged)', () => {
    // The reach the three sites use IS the old constant value, so every boundary that
    // depended on attemptRadius is byte-for-byte where it was before B0.
    expect(REACH).toBe(CATCH.attemptRadius);
    // Just outside the old radius: not armed (was true pre-B0 too — unchanged).
    const out = gameWithAnimalAt(CATCH.attemptRadius + 0.5);
    update(out, createIntent(), SIM_DT);
    expect(out.catchArmed).toBe(false);
    // Just inside: armed (unchanged).
    const inside = gameWithAnimalAt(CATCH.attemptRadius - 0.5);
    update(inside, createIntent(), SIM_DT);
    expect(inside.catchArmed).toBe(true);
  });
});
