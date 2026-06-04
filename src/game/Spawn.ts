/**
 * Spawning — PURE, Node-testable. Picks a species by `spawnWeight` (the rarity
 * axis), gated to the current biome AND the species' activity window for the
 * current day phase, then places it on a ring around the player INSIDE its home
 * biome. Population is bounded by the fixed pool (SPAWN.maxAnimals): a full pool
 * simply refuses to spawn.
 *
 * Everything is driven by a seeded Rng, so spawn weighting / gating is
 * deterministic and unit-testable.
 */

import { SPAWN, type BiomeId, type DayPhase, type SpeciesDef, type SpeciesId } from '../utils/constants';
import { eligibleSpecies } from './Species';
import { isInsideBiome, type World } from './World';
import { spawnAnimal, activeAnimalCount, type Animal } from './Animal';
import { lerp } from '../utils/math';
import type { Rng } from '../utils/rng';

/**
 * Weighted pick from `eligible` by `spawnWeight`. Returns null for an empty
 * list. Deterministic given `rng`.
 */
export function pickSpecies(eligible: SpeciesDef[], rng: Rng): SpeciesDef | null {
  if (eligible.length === 0) return null;
  let total = 0;
  for (const s of eligible) total += s.spawnWeight;
  let roll = rng.next() * total;
  for (const s of eligible) {
    roll -= s.spawnWeight;
    if (roll < 0) return s;
  }
  return eligible[eligible.length - 1]; // float guard
}

/** Outcome of one spawn attempt (drives the funnel telemetry). */
export type SpawnOutcome = 'spawned' | 'no-eligible' | 'pool-full' | 'out-of-bounds';

export interface SpawnResult {
  outcome: SpawnOutcome;
  /** How many species were eligible this attempt (biome + time gated). */
  eligibleCount: number;
  /** The spawned animal, if any. */
  animal: Animal | null;
}

/**
 * Attempt one spawn near (playerX, playerY). Order of gates: eligibility (biome +
 * time) -> population cap -> a placement on the spawn ring that lands inside the
 * species' home biome. A point that rolls outside the home biome is rejected for
 * this attempt rather than clamped, so animals never appear pinned to a wall.
 */
export function trySpawn(
  pool: Animal[],
  world: World,
  biome: BiomeId,
  phase: DayPhase,
  playerX: number,
  playerY: number,
  rng: Rng,
): SpawnResult {
  const eligible = eligibleSpecies(biome, phase);
  if (eligible.length === 0) {
    return { outcome: 'no-eligible', eligibleCount: 0, animal: null };
  }
  if (activeAnimalCount(pool) >= SPAWN.maxAnimals) {
    return { outcome: 'pool-full', eligibleCount: eligible.length, animal: null };
  }

  const species = pickSpecies(eligible, rng);
  if (!species) {
    return { outcome: 'no-eligible', eligibleCount: eligible.length, animal: null };
  }

  // Place on a ring around the player.
  const ang = rng.next() * Math.PI * 2;
  const r = lerp(SPAWN.spawnRadiusMin, SPAWN.spawnRadiusMax, rng.next());
  const x = playerX + Math.cos(ang) * r;
  const y = playerY + Math.sin(ang) * r;

  if (!isInsideBiome(world, species.biome, x, y)) {
    return { outcome: 'out-of-bounds', eligibleCount: eligible.length, animal: null };
  }

  const animal = spawnAnimal(pool, species.id, x, y);
  if (!animal) {
    // Race with the cap (shouldn't happen — checked above), treat as full.
    return { outcome: 'pool-full', eligibleCount: eligible.length, animal: null };
  }
  return { outcome: 'spawned', eligibleCount: eligible.length, animal };
}

/**
 * Spawn the tracking TARGET at a SEEDED point inside the sett region (Plan #8b).
 * Reuses the seeded rng + spawnAnimal — NO new Math.random. The position is
 * deterministic for a given rng state, and always inside the sett radius, so the
 * signs (which cluster around the sett) actually lead to the animal. Returns the
 * spawned animal, or null if the pool is full.
 */
export function spawnTrackingTarget(
  pool: Animal[],
  sett: { x: number; y: number; radius: number },
  species: SpeciesId,
  rng: Rng,
): Animal | null {
  if (activeAnimalCount(pool) >= SPAWN.maxAnimals) return null;
  const ang = rng.next() * Math.PI * 2;
  const r = rng.next() * sett.radius;
  return spawnAnimal(pool, species, sett.x + Math.cos(ang) * r, sett.y + Math.sin(ang) * r);
}
