import { describe, expect, it } from 'vitest';
import {
  createAnimalPool,
  spawnAnimal,
  updateAnimal,
  pickBehavior,
  behaviorDwell,
  behaviorSpeed,
  type AnimalBehavior,
} from '../Animal';
import { createWorld } from '../World';
import { createPlayer } from '../Player';
import { getSpecies } from '../Species';
import { createRng } from '../../utils/rng';
import { ANIMAL, ETHOGRAM, SIM_DT } from '../../utils/constants';

/**
 * §4.6 D2 (i) — the ETHOGRAM behavior engine (pure, seeded, L1). A calm animal cycles rest/forage/
 * vigilance/locomote; the state sets the step SPEED (the speed-driven gait responds for free). ⚠️ The
 * engine is ORTHOGONAL to aiState — flee/approach OVERRIDE it, and the CATCH input (aiState === 'flee')
 * is never touched by behavior. The FEEL of the motion is Craig's device gate; these pin the contract.
 */

const meadowSpot = { x: 0, y: 0 };

/** Run a calm animal (player far away) N steps, collecting its behavior each step. */
function runCalm(seed: number, steps: number): { behaviors: AnimalBehavior[]; xs: number[] } {
  const world = createWorld();
  const far = createPlayer(500, 500); // way outside any detectionRadius → never flees
  const pool = createAnimalPool();
  const a = spawnAnimal(pool, 'fieldmouse', meadowSpot.x, meadowSpot.y)!;
  const rng = createRng(seed);
  const behaviors: AnimalBehavior[] = [];
  const xs: number[] = [];
  for (let i = 0; i < steps; i++) {
    updateAnimal(a, far, world, rng, SIM_DT);
    behaviors.push(a.behavior);
    xs.push(a.x);
  }
  return { behaviors, xs };
}

describe('ethogram — the pure behavior SM (seeded, deterministic)', () => {
  it('a calm animal CYCLES the ethogram states (not stuck in one)', () => {
    const { behaviors } = runCalm(7, 1200);
    const seen = new Set(behaviors);
    expect(seen.size).toBeGreaterThan(1); // it actually transitions through states over time
    for (const b of seen) expect(['rest', 'forage', 'vigilance', 'locomote']).toContain(b);
  });

  it('is SEEDED-deterministic: same seed → identical behavior sequence + path', () => {
    const a = runCalm(42, 400);
    const b = runCalm(42, 400);
    expect(a.behaviors).toEqual(b.behaviors);
    expect(a.xs).toEqual(b.xs);
    // A different seed diverges (the RNG genuinely drives it).
    const c = runCalm(43, 400);
    expect(c.behaviors).not.toEqual(a.behaviors);
  });

  it('pickBehavior is a weighted seeded pick over the four states; behaviorDwell sits in range', () => {
    const rng = createRng(1);
    const seen = new Set<AnimalBehavior>();
    for (let i = 0; i < 500; i++) seen.add(pickBehavior(rng, ETHOGRAM.defaultBudget));
    expect(seen).toEqual(new Set(['rest', 'forage', 'vigilance', 'locomote'])); // all reachable
    const r2 = createRng(2);
    for (const b of ['rest', 'forage', 'vigilance', 'locomote'] as AnimalBehavior[]) {
      const [lo, hi] = ETHOGRAM.dwell[b];
      const d = behaviorDwell(b, r2);
      expect(d).toBeGreaterThanOrEqual(lo);
      expect(d).toBeLessThanOrEqual(hi);
    }
  });

  it('the state → SPEED mapping (rest/vigilance hold still; forage ambles; locomote walks)', () => {
    expect(behaviorSpeed('rest')).toBe(0);
    expect(behaviorSpeed('vigilance')).toBe(0);
    expect(behaviorSpeed('forage')).toBe(ETHOGRAM.forageSpeed);
    expect(behaviorSpeed('locomote')).toBe(ANIMAL.wanderSpeed);
    expect(ETHOGRAM.forageSpeed).toBeLessThan(ANIMAL.wanderSpeed); // a slow potter, not a stroll
  });

  it('a rest/vigilance step holds the animal still (zero movement that step)', () => {
    const world = createWorld();
    const far = createPlayer(500, 500);
    const pool = createAnimalPool();
    const a = spawnAnimal(pool, 'fieldmouse', 0, 0)!;
    const rng = createRng(11);
    let sawStill = false;
    for (let i = 0; i < 1500; i++) {
      updateAnimal(a, far, world, rng, SIM_DT);
      if (a.behavior === 'rest' || a.behavior === 'vigilance') {
        expect(a.x).toBe(a.prevX); // held still this step
        expect(a.y).toBe(a.prevY);
        sawStill = true;
      }
    }
    expect(sawStill).toBe(true);
  });
});

describe('ethogram — orthogonal to aiState (flee/approach override; the CATCH input untouched)', () => {
  it('⚠️ a calm animal is NEVER aiState "flee" in any behavior → the catch input stays calm', () => {
    const { behaviors } = runCalm(5, 800);
    expect(behaviors.length).toBe(800);
    // Re-run, asserting aiState every step (the value the catch reads via ctx.fleeing).
    const world = createWorld();
    const far = createPlayer(500, 500);
    const pool = createAnimalPool();
    const a = spawnAnimal(pool, 'fieldmouse', 0, 0)!;
    const rng = createRng(5);
    for (let i = 0; i < 800; i++) {
      updateAnimal(a, far, world, rng, SIM_DT);
      expect(a.aiState).toBe('wander'); // calm in every behavior → fleeing === false, catch unchanged
    }
  });

  it('⚠️ flee OVERRIDES + SUSPENDS the ethogram (behaviorTimer held), and it RESUMES on return to calm', () => {
    const world = createWorld();
    const pool = createAnimalPool();
    const a = spawnAnimal(pool, 'fieldmouse', 0, 0)!;
    const rng = createRng(3);
    const far = createPlayer(500, 500);
    // Settle into a calm behavior with a running dwell.
    for (let i = 0; i < 20; i++) updateAnimal(a, far, world, rng, SIM_DT);
    const heldTimer = a.behaviorTimer;
    const heldBehavior = a.behavior;

    // Player steps right on top → the animal flees; the ethogram must NOT advance.
    const near = createPlayer(a.x, a.y);
    updateAnimal(a, near, world, rng, SIM_DT);
    expect(a.aiState).toBe('flee');
    expect(a.behaviorTimer).toBe(heldTimer); // suspended — not decremented during flee
    expect(a.behavior).toBe(heldBehavior); // held

    // Player retreats far → back to calm; the SM resumes ticking (timer decrements again).
    for (let i = 0; i < 5; i++) updateAnimal(a, far, world, rng, SIM_DT);
    expect(a.aiState).toBe('wander');
    expect(a.behaviorTimer).toBeLessThan(heldTimer); // resumed advancing
  });
});

describe('ethogram — freeze / spawn determinism', () => {
  it('a fresh spawn starts calm at a deterministic initial behavior (locomote, timer 0)', () => {
    const pool = createAnimalPool();
    const a = spawnAnimal(pool, getSpecies('fieldmouse').id, 0, 0)!;
    expect(a.behavior).toBe('locomote');
    expect(a.behaviorTimer).toBe(0);
    expect(a.aiState).toBe('wander');
    // ⚠️ no updateAnimal is called under ?freeze (the accumulator never advances), so the frozen
    // capture keeps this seeded-initial state; at spawn prevX === x → speed 0 → the idle gait.
    expect(a.x).toBe(a.prevX);
  });
});
