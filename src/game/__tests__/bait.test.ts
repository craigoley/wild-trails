import { describe, expect, it } from 'vitest';
import {
  activeLure,
  createBaitState,
  cycleSelectedBait,
  deployBait,
  isCorrectBaitFor,
  tickBait,
} from '../Bait';
import { createAnimalPool, spawnAnimal, updateAnimal } from '../Animal';
import { createPlayer } from '../Player';
import { createWorld } from '../World';
import { createRng } from '../../utils/rng';
import { BAIT, BAIT_ORDER, SPECIES } from '../../utils/constants';

describe('Bait — inventory + deployment', () => {
  it('starts with full counts of every bait, none active', () => {
    const s = createBaitState();
    for (const id of BAIT_ORDER) expect(s.counts[id]).toBe(BAIT.startingCount);
    expect(s.activeType).toBeNull();
    expect(activeLure(s)).toBeNull();
  });

  it('cycles the selected bait through the order and wraps', () => {
    const s = createBaitState();
    expect(s.selected).toBe(BAIT_ORDER[0]);
    cycleSelectedBait(s);
    expect(s.selected).toBe(BAIT_ORDER[1]);
    // cycle the rest of the way round (length-robust — now 4 baits with fish) -> wraps to the first.
    for (let i = 1; i < BAIT_ORDER.length; i++) cycleSelectedBait(s);
    expect(s.selected).toBe(BAIT_ORDER[0]); // wrapped
  });

  it('deploy consumes one of the selected bait and activates a lure', () => {
    const s = createBaitState();
    const before = s.counts[s.selected];
    expect(deployBait(s, 3, 4)).toBe(true);
    expect(s.counts[BAIT_ORDER[0]]).toBe(before - 1);
    const lure = activeLure(s);
    expect(lure).toEqual({ baitId: BAIT_ORDER[0], x: 3, y: 4 });
  });

  it('deploy fails (returns false) when out of that bait', () => {
    const s = createBaitState();
    s.counts[s.selected] = 0;
    expect(deployBait(s, 0, 0)).toBe(false);
    expect(s.activeType).toBeNull();
  });

  it('the active lure expires after its window', () => {
    const s = createBaitState();
    deployBait(s, 0, 0);
    tickBait(s, BAIT.activeWindowSec - 0.1);
    expect(activeLure(s)).not.toBeNull();
    tickBait(s, 0.2); // past the window
    expect(activeLure(s)).toBeNull();
    expect(s.activeType).toBeNull();
  });
});

describe('Bait — diet matching (the learning mechanic)', () => {
  it('isCorrectBaitFor is true only for the species’ diet', () => {
    const s = createBaitState();
    // fieldmouse eats seeds; rabbit eats greens.
    s.selected = 'seeds';
    deployBait(s, 0, 0);
    expect(isCorrectBaitFor(SPECIES.fieldmouse, s)).toBe(true);
    expect(isCorrectBaitFor(SPECIES.rabbit, s)).toBe(false); // wrong diet
  });

  it('no bait active => never correct', () => {
    const s = createBaitState();
    expect(isCorrectBaitFor(SPECIES.fieldmouse, s)).toBe(false);
  });
});

describe('Bait — correct bait lures matching animals to APPROACH', () => {
  const world = createWorld();

  it('correct-diet bait makes an otherwise-fleeing animal approach it', () => {
    const player = createPlayer(0, 0);
    const pool = createAnimalPool();
    // fieldmouse just inside detection (would flee) — but bait is its diet.
    const a = spawnAnimal(pool, 'fieldmouse', 2, 0)!;
    const lure = { baitId: 'seeds' as const, x: 2.6, y: 0 };
    updateAnimal(a, player, world, createRng(1), 0.1, lure);
    expect(a.aiState).toBe('approach');
    expect(a.x).toBeGreaterThan(2); // moved toward the lure at +x
  });

  it('wrong-diet bait is ignored — the animal still flees', () => {
    const player = createPlayer(0, 0);
    const pool = createAnimalPool();
    const a = spawnAnimal(pool, 'fieldmouse', 2, 0)!;
    const wrong = { baitId: 'greens' as const, x: 2.6, y: 0 }; // not a mouse's diet
    updateAnimal(a, player, world, createRng(1), 0.1, wrong);
    expect(a.aiState).toBe('flee');
  });
});
