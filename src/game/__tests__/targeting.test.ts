import { describe, expect, it } from 'vitest';
import { createGameState, update, type GameState } from '../GameState';
import { spawnAnimal } from '../Animal';
import { createIntent } from '../Input';
import { CATCH, SIM_DT } from '../../utils/constants';

/** A game with spawning paused and no boot animals — place our own. */
function quietGame(): GameState {
  const g = createGameState(123);
  for (const a of g.animals) a.active = false;
  g.spawnTimer = 1e9; // pause spawning so only our test animals exist
  return g;
}

/** Step once with an optional partial intent. */
function step(g: GameState, intent: Partial<ReturnType<typeof createIntent>> = {}): void {
  update(g, { ...createIntent(), ...intent }, SIM_DT);
}

describe('Targeting — selecting the catch target', () => {
  it('no animal in range => no target, disarmed, zero chance', () => {
    const g = quietGame();
    spawnAnimal(g.animals, 'fieldmouse', 100, 0); // far away
    step(g);
    expect(g.targetIndex).toBe(-1);
    expect(g.catchArmed).toBe(false);
    expect(g.targetChance).toBe(0);
  });

  it('an animal in range arms the target with a real chance', () => {
    const g = quietGame();
    const a = spawnAnimal(g.animals, 'fieldmouse', 1, 0)!; // within attemptRadius
    step(g);
    expect(g.targetIndex).toBe(g.animals.indexOf(a));
    expect(g.catchArmed).toBe(true);
    expect(g.targetChance).toBeGreaterThan(0);
    expect(g.targetChance).toBeLessThanOrEqual(1);
  });

  it('an animal just beyond reach is not targeted', () => {
    const g = quietGame();
    spawnAnimal(g.animals, 'hedgehog', CATCH.attemptRadius + 0.5, 0);
    step(g);
    expect(g.targetIndex).toBe(-1);
    expect(g.catchArmed).toBe(false);
  });

  it('the NEAREST in-range animal is chosen', () => {
    const g = quietGame();
    spawnAnimal(g.animals, 'fieldmouse', 2.0, 0); // farther
    const near = spawnAnimal(g.animals, 'rabbit', 0.8, 0)!; // nearer
    step(g);
    expect(g.targetIndex).toBe(g.animals.indexOf(near));
  });
});

describe('Targeting — bait makes the chance jump (legible diet loop)', () => {
  it('correct bait raises targetChance and flags baited', () => {
    const g = quietGame();
    spawnAnimal(g.animals, 'fieldmouse', 1.2, 0); // diet = seeds (the default)
    step(g); // no bait yet
    const unbaited = g.targetChance;
    expect(g.targetBaited).toBe(false);

    // Deploy the default (seeds) bait — correct for the field mouse.
    step(g, { baitDeploy: true });
    expect(g.usedBaitEver).toBe(true);
    expect(g.targetBaited).toBe(true);
    expect(g.targetChance).toBeGreaterThan(unbaited); // the visible jump
  });
});

describe('Targeting — locks to the encounter target', () => {
  it('while an encounter is in flight the target is its animal and disarmed', () => {
    const g = quietGame();
    const a = spawnAnimal(g.animals, 'fieldmouse', 0.6, 0)!;
    step(g, { catchPressed: true }); // starts an encounter
    expect(g.encounter).not.toBeNull();
    expect(g.targetIndex).toBe(g.animals.indexOf(a));
    expect(g.catchArmed).toBe(false); // can't start another attempt
  });
});
