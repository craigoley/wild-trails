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

import {
  SPAWN,
  SEASONAL_ABUNDANCE,
  SEASONAL_ABUNDANCE_FLOOR,
  BIOME_SEASONAL_POP,
  SEASONAL_POP_MIN_ACTIVE,
  type BiomeId,
  type DayPhase,
  type Season,
  type SpeciesDef,
  type SpeciesId,
} from '../utils/constants';
import { eligibleSpecies } from './Species';
import { isInsideBiome, type World } from './World';
import { spawnAnimal, activeAnimalCount, type Animal } from './Animal';
import { lerp } from '../utils/math';
import type { Rng } from '../utils/rng';

/**
 * §4.6 D1b — the SEASONAL ABUNDANCE multiplier on a species' spawn weight. PURE. A RESIDENT (no
 * seasonTag) is flat 1.0 every season; a tagged migrant follows its SEASONAL_ABUNDANCE curve. ⚠️ THE
 * SPINE: the result is ALWAYS ≥ SEASONAL_ABUNDANCE_FLOOR (> 0), so a tagged species is NEVER weighted
 * to zero — it stays findable in EVERY season (rare-but-present), never season-gated. This weights the
 * spawn LOTTERY only; eligibility (eligibleSpecies) + the catch odds (finalCatchChance) are untouched.
 */
export function seasonalAbundance(species: SpeciesDef, season: Season): number {
  if (!species.seasonTag) return 1; // residents — flat, no seasonal weighting (most of the roster)
  return Math.max(SEASONAL_ABUNDANCE_FLOOR, SEASONAL_ABUNDANCE[species.seasonTag][season]);
}

/**
 * §migration — THE HEADCOUNT LEVER (the estuary's crux). The EFFECTIVE active-population cap for a biome
 * in a season: the fixed pool cap (SPAWN.maxAnimals) scaled by the per-biome seasonal scalar
 * (BIOME_SEASONAL_POP), floored at SEASONAL_POP_MIN_ACTIVE. PURE. ⚠️ THE SPINE: every scalar is ≤ 1, so
 * this only ever scales the cap DOWN (≤ SPAWN.maxAnimals — the pool ARRAY never needs to grow, no new
 * allocation); the floor keeps it ≥ 2 (never an empty biome → catch never locked out). A biome OMITTED
 * from BIOME_SEASONAL_POP reads `?? 1` → its cap is EXACTLY SPAWN.maxAnimals (byte-unchanged behaviour).
 * This is ORTHOGONAL to seasonalAbundance: that weights WHICH species (composition); this caps HOW MANY
 * (headcount). The estuary uses both — a thronged winter of Arctic migrants, a near-bare summer of residents.
 */
export function effectiveCap(biome: BiomeId, season: Season): number {
  const mult = BIOME_SEASONAL_POP[biome]?.[season] ?? 1;
  return Math.max(SEASONAL_POP_MIN_ACTIVE, Math.round(SPAWN.maxAnimals * mult));
}

/**
 * Weighted pick from `eligible` by `spawnWeight × seasonalAbundance(season)` (§4.6 D1b — the season
 * EMPHASIS). Returns null for an empty list. Deterministic given `rng`. ⚠️ The season weights ABUNDANCE
 * only — `eligible` is unchanged (the season never gates the list), and every effective weight is > 0
 * (the floor), so every eligible species stays pickable in every season (the anti-lockout spine).
 */
export function pickSpecies(eligible: SpeciesDef[], season: Season, rng: Rng): SpeciesDef | null {
  if (eligible.length === 0) return null;
  let total = 0;
  for (const s of eligible) total += s.spawnWeight * seasonalAbundance(s, season);
  let roll = rng.next() * total;
  for (const s of eligible) {
    roll -= s.spawnWeight * seasonalAbundance(s, season);
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
  season: Season,
  playerX: number,
  playerY: number,
  rng: Rng,
): SpawnResult {
  // ⚠️ §4.6 D1b THE SPINE: eligibility is biome + PHASE only — the SEASON is NOT in this gate, so it
  // never removes a species from the list (every species stays findable in every season). The season
  // weights the pick BELOW (abundance), never here.
  const eligible = eligibleSpecies(biome, phase);
  if (eligible.length === 0) {
    return { outcome: 'no-eligible', eligibleCount: 0, animal: null };
  }
  // §migration — the pool-full gate reads the EFFECTIVE (season-scaled) cap, not the raw maxAnimals: this
  // is the HEADCOUNT lever (a near-bare summer estuary stops filling at ~2; a thronged winter fills to 12).
  // ⚠️ effectiveCap ≤ SPAWN.maxAnimals always (it only scales DOWN), so the pool array never overflows; an
  // OMITTED biome gets exactly SPAWN.maxAnimals (every existing biome byte-unchanged).
  if (activeAnimalCount(pool) >= effectiveCap(biome, season)) {
    return { outcome: 'pool-full', eligibleCount: eligible.length, animal: null };
  }

  const species = pickSpecies(eligible, season, rng);
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
