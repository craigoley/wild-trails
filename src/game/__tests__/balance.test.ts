import { describe, expect, it } from 'vitest';
import { finalCatchChance, type CatchContext } from '../Catch';
import { addBait, clearActiveBait, createBaitState, deployBait, isCorrectBaitFor } from '../Bait';
import { createGameState, update, type GameState } from '../GameState';
import { spawnAnimal } from '../Animal';
import { createIntent } from '../Input';
import { BAIT, SPECIES, SIM_DT } from '../../utils/constants';

// ===========================================================================
// FINDING 3 — difficulty spread (slow/docile easy, fast/wary hard)
// ===========================================================================
describe('Balance — baseCatchRate spread correlates with flee speed', () => {
  it('orders easy -> hard: hedgehog > fieldmouse > rabbit > quail', () => {
    expect(SPECIES.hedgehog.baseCatchRate).toBeGreaterThan(SPECIES.fieldmouse.baseCatchRate);
    expect(SPECIES.fieldmouse.baseCatchRate).toBeGreaterThan(SPECIES.rabbit.baseCatchRate);
    expect(SPECIES.rabbit.baseCatchRate).toBeGreaterThan(SPECIES.quail.baseCatchRate);
  });

  it('the spread is meaningful (easiest clearly beats hardest)', () => {
    const easiest = SPECIES.hedgehog.baseCatchRate;
    const hardest = SPECIES.quail.baseCatchRate;
    expect(easiest - hardest).toBeGreaterThan(0.3);
  });

  it('the slowest flee is the easiest, the fastest flee is the hardest', () => {
    const all = [SPECIES.fieldmouse, SPECIES.rabbit, SPECIES.quail, SPECIES.hedgehog];
    const slowest = [...all].sort((a, b) => a.baseFleeSpeed - b.baseFleeSpeed)[0];
    const fastest = [...all].sort((a, b) => b.baseFleeSpeed - a.baseFleeSpeed)[0];
    const easiest = [...all].sort((a, b) => b.baseCatchRate - a.baseCatchRate)[0];
    const hardest = [...all].sort((a, b) => a.baseCatchRate - b.baseCatchRate)[0];
    expect(easiest.id).toBe(slowest.id);
    expect(hardest.id).toBe(fastest.id);
  });
});

// ===========================================================================
// FINDING 1 — wrong bait does NOTHING (the diet mechanic, pinned end to end)
// ===========================================================================
describe('Balance — only the CORRECT diet bait helps the catch chance', () => {
  const mouse = SPECIES.fieldmouse; // diet = seeds
  const base = (correctBait: boolean): CatchContext => ({
    dist: 0.5,
    tool: 'net',
    biome: 'meadow',
    correctBait,
    fleeing: false,
  });

  it('correct bait raises the chance; WRONG bait equals NO bait', () => {
    // Correct: seeds on the seed-eating mouse.
    const correct = createBaitState();
    correct.selected = 'seeds';
    deployBait(correct, 0, 0);
    expect(isCorrectBaitFor(mouse, correct)).toBe(true);

    // Wrong: greens on the mouse — must be a no-op.
    const wrong = createBaitState();
    wrong.selected = 'greens';
    deployBait(wrong, 0, 0);
    expect(isCorrectBaitFor(mouse, wrong)).toBe(false);

    const withCorrect = finalCatchChance(mouse, base(isCorrectBaitFor(mouse, correct)));
    const withWrong = finalCatchChance(mouse, base(isCorrectBaitFor(mouse, wrong)));
    const withNone = finalCatchChance(mouse, base(false));

    expect(withCorrect).toBeGreaterThan(withWrong);
    expect(withWrong).toBe(withNone); // wrong bait changed nothing
  });
});

// ===========================================================================
// FINDING 2 — bait is a consumed + replenished resource
// ===========================================================================
describe('Balance — bait economy (consume, block at 0, replenish, cap)', () => {
  it('deploying consumes one; an empty type blocks the deploy', () => {
    const s = createBaitState();
    const before = s.counts[s.selected];
    expect(deployBait(s, 0, 0)).toBe(true);
    expect(s.counts[s.selected]).toBe(before - 1);

    s.counts[s.selected] = 0;
    expect(deployBait(s, 0, 0)).toBe(false); // blocked
    expect(s.counts[s.selected]).toBe(0); // never goes negative
  });

  it('addBait replenishes, capped at maxCount and never negative', () => {
    const s = createBaitState();
    s.counts.seeds = 0;
    addBait(s, 'seeds', 2);
    expect(s.counts.seeds).toBe(2);
    addBait(s, 'seeds', 999);
    expect(s.counts.seeds).toBe(BAIT.maxCount); // capped
    addBait(s, 'seeds', -999);
    expect(s.counts.seeds).toBe(0); // floored
  });

  it('clearActiveBait removes an active deployment', () => {
    const s = createBaitState();
    deployBait(s, 1, 2);
    expect(s.activeType).not.toBeNull();
    clearActiveBait(s);
    expect(s.activeType).toBeNull();
    expect(s.timer).toBe(0);
  });
});

describe('Balance — a catch NO LONGER refills bait (§12 scarcity: catch -> credits, bait shop-only)', () => {
  /** A game with spawning paused and one test animal at (x, y). */
  function gameWithAnimalAt(species: 'hedgehog', x: number, y: number): GameState {
    const g = createGameState(7);
    for (const a of g.animals) a.active = false;
    g.spawnTimer = 1e9;
    spawnAnimal(g.animals, species, x, y);
    return g;
  }

  it('catching a hedgehog does NOT change any bait count (the refill loop is gone)', () => {
    const g = gameWithAnimalAt('hedgehog', 0.5, 0); // easy: point-blank net catches bait-less
    const before = { ...g.bait.counts };

    update(g, { ...createIntent(), catchPressed: true }, SIM_DT); // start encounter (no bait deployed)
    expect(g.encounter).not.toBeNull();
    for (let i = 0; i < 400 && g.encounter; i++) update(g, createIntent(), SIM_DT);

    expect(g.sessionCatches).toBe(1); // caught it BAIT-LESS (the anti-lockout valve)
    expect(g.bait.counts).toEqual(before); // catching added NO bait — bait is shop-only now
  });
});
