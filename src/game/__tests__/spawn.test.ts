import { describe, expect, it } from 'vitest';
import { pickSpecies, trySpawn } from '../Spawn';
import { eligibleSpecies } from '../Species';
import { createAnimalPool, activeAnimalCount } from '../Animal';
import { createWorld, isInsideBiome } from '../World';
import { createRng } from '../../utils/rng';
import { SPAWN, SPECIES } from '../../utils/constants';

describe('Spawn — eligibility gating (biome + time of day)', () => {
  it('gates by activity window: hedgehog (DUSK) is out at dusk, not at day', () => {
    const day = eligibleSpecies('meadow', 'day').map((s) => s.id);
    const dusk = eligibleSpecies('meadow', 'dusk').map((s) => s.id);
    expect(day).not.toContain('hedgehog');
    expect(dusk).toContain('hedgehog');
    // The ANY-window species are out at every phase.
    expect(day).toContain('fieldmouse');
    expect(day).toContain('rabbit');
    // quail forages at dawn only.
    expect(eligibleSpecies('meadow', 'dawn').map((s) => s.id)).toContain('quail');
    expect(day).not.toContain('quail');
  });

  it('gates by biome: locked biomes have no species yet', () => {
    expect(eligibleSpecies('woodland', 'day')).toHaveLength(0);
    expect(eligibleSpecies('wetland', 'dawn')).toHaveLength(0);
  });
});

describe('Spawn — weighted pick tracks spawnWeight (the rarity axis)', () => {
  it('over many seeded picks, distribution follows the weights (6:3)', () => {
    const eligible = eligibleSpecies('meadow', 'day'); // fieldmouse(6) + rabbit(3)
    const rng = createRng(12345);
    const counts: Record<string, number> = { fieldmouse: 0, rabbit: 0 };
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const s = pickSpecies(eligible, rng);
      counts[s!.id]++;
    }
    const total = SPECIES.fieldmouse.spawnWeight + SPECIES.rabbit.spawnWeight; // 9
    const expectMouse = SPECIES.fieldmouse.spawnWeight / total; // 6/9 ≈ 0.667
    const gotMouse = counts.fieldmouse / N;
    expect(gotMouse).toBeGreaterThan(expectMouse - 0.04);
    expect(gotMouse).toBeLessThan(expectMouse + 0.04);
    // The rarer species really is rarer.
    expect(counts.fieldmouse).toBeGreaterThan(counts.rabbit);
  });

  it('returns null for an empty eligible list', () => {
    expect(pickSpecies([], createRng(1))).toBeNull();
  });
});

describe('Spawn — biome containment', () => {
  it('a DUSK-only species never spawns at DAY (over many attempts)', () => {
    const world = createWorld();
    const pool = createAnimalPool();
    const rng = createRng(999);
    for (let i = 0; i < 500; i++) {
      const r = trySpawn(pool, world, 'meadow', 'day', 0, 0, rng);
      if (r.animal) expect(r.animal.species).not.toBe('hedgehog');
    }
  });

  it('every spawned animal lands inside the Meadow, even near the edge', () => {
    const world = createWorld();
    const pool = createAnimalPool();
    const rng = createRng(77);
    // Player near the +x Meadow edge: some ring points fall outside and must be
    // rejected (out-of-bounds), never spawned past the boundary.
    const edge = world.biomes.meadow.def.bounds.maxX - 1;
    let spawned = 0;
    let rejected = 0;
    for (let i = 0; i < 800; i++) {
      const r = trySpawn(pool, world, 'meadow', 'day', edge, 0, rng);
      if (r.outcome === 'spawned') {
        spawned++;
        expect(isInsideBiome(world, 'meadow', r.animal!.x, r.animal!.y)).toBe(true);
        // Free the slot so we keep getting fresh attempts (not pool-full).
        r.animal!.active = false;
      } else if (r.outcome === 'out-of-bounds') {
        rejected++;
      }
    }
    // The edge placement should exercise BOTH paths.
    expect(spawned).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  });
});

describe('Spawn — bounded population', () => {
  it('never exceeds the pool cap; a full pool refuses to spawn', () => {
    const world = createWorld();
    const pool = createAnimalPool();
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      trySpawn(pool, world, 'meadow', 'day', 0, 0, rng);
      expect(activeAnimalCount(pool)).toBeLessThanOrEqual(SPAWN.maxAnimals);
      expect(pool.length).toBe(SPAWN.maxAnimals); // pool never grows
    }
    expect(activeAnimalCount(pool)).toBe(SPAWN.maxAnimals); // filled up
    const r = trySpawn(pool, world, 'meadow', 'day', 0, 0, rng);
    expect(r.outcome).toBe('pool-full');
    expect(r.animal).toBeNull();
  });
});
