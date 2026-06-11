import { describe, expect, it } from 'vitest';
import {
  createWorld,
  isInWater,
  resolveWaterSlide,
  unlockBiome,
} from '../World';
import { createGameState, update } from '../GameState';
import { createIntent } from '../Input';
import { createAnimalPool, spawnAnimal, updateAnimal } from '../Animal';
import type { PlayerState } from '../Player';
import { createRng } from '../../utils/rng';
import { JOURNAL_SCHEMA_VERSION } from '../../state/Journal';
import {
  WATER,
  BIOMES,
  SUPPLY_POSTS,
  HIDING_SPOTS,
  SPECIES,
  SPECIES_ORDER,
  PLAYER,
  SIM_DT,
} from '../../utils/constants';

/**
 * Nets & Gear slice W — water terrain + the player barrier + frog flee-to-water.
 * The arc's first player collision: pinned tightly (the novel risk).
 */
const pond = WATER[0];
const out = { x: 0, y: 0 };

describe('W #1 — the wetland pond exists, sited clear', () => {
  it('one pond in the wetland, inside the cell, clear of supply/reeds/the x=20 entry', () => {
    expect(WATER.filter((w) => w.biome === 'wetland')).toHaveLength(1); // exactly one wetland pond (Riverbank adds its own river, §4.2)
    expect(pond.biome).toBe('wetland');
    const b = BIOMES.wetland.bounds;
    expect(pond.x - pond.radius).toBeGreaterThanOrEqual(b.minX);
    expect(pond.x + pond.radius).toBeLessThanOrEqual(b.maxX);
    expect(pond.y - pond.radius).toBeGreaterThanOrEqual(b.minY);
    expect(pond.y + pond.radius).toBeLessThanOrEqual(b.maxY);
    const supply = SUPPLY_POSTS.find((p) => p.biome === 'wetland')!;
    expect(Math.hypot(pond.x - supply.x, pond.y - supply.y)).toBeGreaterThan(pond.radius + supply.radius);
    for (const s of HIDING_SPOTS.filter((s) => s.biome === 'wetland')) {
      expect(Math.hypot(pond.x - s.x, pond.y - s.y)).toBeGreaterThan(pond.radius);
    }
    expect(pond.x - pond.radius).toBeGreaterThan(20); // doesn't block the meadow->wetland seam
    // A real gap for B1's dip-net: a centre-fled frog is beyond the hand net's reach 2.6.
    expect(pond.radius).toBeGreaterThan(2.6);
  });
});

describe('W #2 — ⚠️ the player WATER barrier (the collision, pinned)', () => {
  const w = createWorld();
  const M = PLAYER.radius;

  it('a straight move INTO the pond is rejected — the player stays out of water', () => {
    const fromX = pond.x - (pond.radius + 2); // due west, clear
    resolveWaterSlide(w, fromX, pond.y, pond.x, pond.y, M, out); // target = centre (in water)
    expect(isInWater(w, out.x, out.y, M)).toBe(false);
    expect(out.x).toBe(fromX); // blocked on X, no Y move available -> stays put (no stick)
    expect(out.y).toBe(pond.y);
  });

  it('a DIAGONAL move into water GLIDES along the open axis (no stick)', () => {
    const fromX = pond.x - (pond.radius + 2); // due west, clear
    const fromY = pond.y;
    // Aim NE into the pond: +x is blocked by water, +y is open -> slide in Y.
    resolveWaterSlide(w, fromX, fromY, pond.x, pond.y + 4, M, out);
    expect(isInWater(w, out.x, out.y, M)).toBe(false);
    expect(out.y).not.toBe(fromY); // it slid on the open Y axis (didn't fully stick)
  });

  it('via updatePlayer: pushing into the pond from EVERY side never enters water (composes with the clamp)', () => {
    const starts = [
      [pond.x - pond.radius - 1, pond.y],
      [pond.x + pond.radius + 1, pond.y],
      [pond.x, pond.y - pond.radius - 1],
      [pond.x, pond.y + pond.radius + 1],
    ];
    const intents = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
    ];
    for (const [sx, sy] of starts) {
      for (const [mx, my] of intents) {
        const g = createGameState(3);
        unlockBiome(g.world, 'woodland');
        unlockBiome(g.world, 'wetland');
        g.player.x = sx;
        g.player.y = sy;
        for (let i = 0; i < 60; i++) {
          update(g, { ...createIntent(), moveX: mx, moveY: my }, SIM_DT);
          expect(isInWater(g.world, g.player.x, g.player.y, PLAYER.radius)).toBe(false);
        }
      }
    }
  });
});

describe('W #3 — isInWater + the per-animal inWater flag (the B1 hook)', () => {
  it('isInWater is correct (centre in, far out); animals enter water, the player cannot', () => {
    const w = createWorld();
    expect(isInWater(w, pond.x, pond.y)).toBe(true); // centre
    expect(isInWater(w, pond.x + pond.radius + 1, pond.y)).toBe(false); // outside
    // Asymmetry: a point in the pond is water for the animal (margin 0) but barred for
    // the player body (margin = PLAYER.radius) — animals enter, the player can't.
    const edge = pond.x + pond.radius - 0.1;
    expect(isInWater(w, edge, pond.y, 0)).toBe(true); // the animal's point is in
    expect(isInWater(w, pond.x + pond.radius + 0.1, pond.y, PLAYER.radius)).toBe(true); // the body still overlaps
  });

  it('an animal sitting in the pond gets the inWater flag set', () => {
    const w = createWorld();
    const pool = createAnimalPool();
    const frog = spawnAnimal(pool, 'frog', pond.x, pond.y)!; // spawn in the pond
    const player = { x: pond.x + 30, y: pond.y } as PlayerState; // far — no flee
    updateAnimal(frog, player, w, createRng(1), SIM_DT);
    expect(frog.inWater).toBe(true);
  });
});

describe('W #4 — frog flees TO water; mallard (+ all others) flee straight away', () => {
  it('only the frog + the water vole + the otter have fleesToWater (the water-dive species)', () => {
    const divers = new Set(['frog', 'watervole', 'otter', 'greyseal', 'eel']); // + the Coast grey seal + the Cave eel
    for (const id of SPECIES_ORDER) {
      // The dip-net call-back: these three leap/slip INTO the water. Every other species
      // flees straight away (the anti-lockout bound).
      expect(!!SPECIES[id].fleesToWater).toBe(divers.has(id));
    }
  });

  it('a fleeing frog steers toward the pond; a fleeing mallard flees straight away', () => {
    const w = createWorld();
    const pool = createAnimalPool();
    // Player NORTH of the animal (away = +y, south); pond is EAST (toward-water = +x).
    const player = { x: 30, y: 4 } as PlayerState;

    const frog = spawnAnimal(pool, 'frog', 30, 8)!;
    updateAnimal(frog, player, w, createRng(1), SIM_DT);
    expect(frog.x).toBeGreaterThan(30); // blended toward the pond (+x)
    expect(frog.y).toBeGreaterThan(8); // still also fleeing away (+y)

    const mallard = spawnAnimal(pool, 'mallard', 30, 8)!;
    updateAnimal(mallard, player, w, createRng(1), SIM_DT);
    expect(mallard.y).toBeGreaterThan(8); // fled straight away (+y)
    expect(mallard.x).toBeCloseTo(30, 5); // NO water-ward steering
  });
});

describe('W #5/#6 — anti-lockout + no schema bump', () => {
  it('the wetland easiest species (mallard) flees normally -> bait-less catchable, not water-locked', () => {
    // mallard never steers to water and never gets the water-locked treatment; the #53
    // approach-guard (which uses the mallard) is unaffected. Its behaviour is unchanged.
    expect(SPECIES.mallard.fleesToWater).toBeUndefined();
  });

  it('no schema bump — water is static, inWater/flee are transient (v7)', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(7);
  });
});
