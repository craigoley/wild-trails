import { describe, expect, it } from 'vitest';
import {
  activeAnimalCount,
  createAnimalPool,
  despawnAnimal,
  spawnAnimal,
  updateAnimal,
  type Animal,
} from '../Animal';
import { createPlayer } from '../Player';
import { createWorld } from '../World';
import { createRng } from '../../utils/rng';
import { ANIMAL, SPAWN, SPECIES } from '../../utils/constants';

const world = createWorld();
const rng = () => createRng(7);

/** Spawn one animal of `species` at (x, y) for a test. */
function one(species: 'fieldmouse' | 'rabbit' | 'quail' | 'hedgehog', x: number, y: number): Animal {
  const pool = createAnimalPool();
  const a = spawnAnimal(pool, species, x, y);
  if (!a) throw new Error('pool unexpectedly full');
  return a;
}

describe('Animal — flee triggers at detectionRadius, not before', () => {
  const det = SPECIES.fieldmouse.detectionRadius; // 2.5

  it('stays in WANDER when the player is just outside detectionRadius', () => {
    const player = createPlayer(0, 0);
    const a = one('fieldmouse', det + 0.5, 0); // 3.0 from player
    const fledNow = updateAnimal(a, player, world, rng(), 0.1);
    expect(fledNow).toBe(false);
    expect(a.aiState).toBe('wander');
  });

  it('enters FLEE when the player is within detectionRadius and moves away', () => {
    const player = createPlayer(0, 0);
    const startX = det - 0.5; // 2.0 from player, inside detection
    const a = one('fieldmouse', startX, 0);
    const fledNow = updateAnimal(a, player, world, rng(), 0.1);
    expect(fledNow).toBe(true);
    expect(a.aiState).toBe('flee');
    // Flees directly away from the player (+x here), so it gets farther.
    expect(a.x).toBeGreaterThan(startX);
  });

  it('does not re-fire fledNow on a second step while already fleeing', () => {
    const player = createPlayer(0, 0);
    const a = one('fieldmouse', 2.0, 0);
    updateAnimal(a, player, world, rng(), 0.1); // -> flee (fledNow true)
    const fledNow2 = updateAnimal(a, player, world, rng(), 0.1);
    expect(fledNow2).toBe(false);
    expect(a.aiState).toBe('flee');
  });

  it('warier species flee from farther away (data-driven detectionRadius)', () => {
    // quail (det 4.0) flees at a distance where the hedgehog (det 2.0) wouldn't.
    const player = createPlayer(0, 0);
    const d = 3.5;
    const quailFled = updateAnimal(one('quail', d, 0), player, world, rng(), 0.1);
    const hedgehogFled = updateAnimal(one('hedgehog', d, 0), player, world, rng(), 0.1);
    expect(quailFled).toBe(true);
    expect(hedgehogFled).toBe(false);
  });
});

describe('Animal — wander stays inside the home biome', () => {
  it('never leaves the Meadow over a long random walk', () => {
    const player = createPlayer(1000, 1000); // far away: never detected, pure wander
    const a = one('rabbit', 0, 0);
    const r = createRng(3);
    const b = world.biomes.meadow.def.bounds;
    for (let i = 0; i < 1500; i++) {
      updateAnimal(a, player, world, r, 0.1);
      expect(a.aiState).toBe('wander');
      expect(a.x).toBeGreaterThanOrEqual(b.minX + ANIMAL.radius - 1e-9);
      expect(a.x).toBeLessThanOrEqual(b.maxX - ANIMAL.radius + 1e-9);
      expect(a.y).toBeGreaterThanOrEqual(b.minY + ANIMAL.radius - 1e-9);
      expect(a.y).toBeLessThanOrEqual(b.maxY - ANIMAL.radius + 1e-9);
    }
  });
});

describe('Animal — fixed pool is reused, never reallocated', () => {
  it('keeps the same slot objects across spawn/despawn/spawn', () => {
    const pool = createAnimalPool();
    expect(pool.length).toBe(SPAWN.maxAnimals);
    const before = [...pool]; // snapshot the slot object references

    // Fill, free some, refill.
    const spawned: Animal[] = [];
    for (let i = 0; i < SPAWN.maxAnimals; i++) {
      const a = spawnAnimal(pool, 'fieldmouse', i, 0);
      expect(a).not.toBeNull();
      spawned.push(a!);
      expect(before).toContain(a); // the returned animal IS a pool slot
    }
    expect(spawnAnimal(pool, 'rabbit', 0, 0)).toBeNull(); // full -> no new object
    expect(activeAnimalCount(pool)).toBe(SPAWN.maxAnimals);

    despawnAnimal(spawned[0]);
    despawnAnimal(spawned[1]);
    expect(activeAnimalCount(pool)).toBe(SPAWN.maxAnimals - 2);
    spawnAnimal(pool, 'quail', 5, 5);

    // Same array, same length, same slot identities — nothing was reallocated.
    expect(pool.length).toBe(SPAWN.maxAnimals);
    const after = [...pool];
    for (let i = 0; i < pool.length; i++) expect(after[i]).toBe(before[i]);
  });
});
