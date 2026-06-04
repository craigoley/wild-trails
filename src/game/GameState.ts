/**
 * The pure game-state container and its single `update` entry point. Owns the
 * player, the finite biome World, the day-night clock, the animal POOL, and the
 * deterministic RNG. Imports NOTHING from three and never touches the DOM, so the
 * whole simulation runs and is unit-tested in Node. The rendering layer READS a
 * GameState; it must never mutate one.
 *
 * This PR adds the FIRST pipeline — spawn -> roam — so it carries funnel
 * telemetry from the start (the black-box-prevention rule): per-step counts of
 * eligible species, spawn attempts, spawns, active animals, flee events and
 * despawns, surfaced in the `?debug=1` readout. The catch loop
 * (encounter -> catch-attempt -> resolve) extends this in PR #5+.
 *
 * `update` is the only mutation path. RNG is the only source of nondeterminism,
 * and it's seeded — same seed + same inputs => same run.
 */

import { updatePlayer, type PlayerState, createPlayer } from './Player';
import { createWorld, currentBiome, type BiomeId, type World } from './World';
import {
  activeAnimalCount,
  createAnimalPool,
  despawnAnimal,
  updateAnimal,
  type Animal,
} from './Animal';
import { trySpawn } from './Spawn';
import { dayPhaseAt, type DayPhase } from './Time';
import { createRng, type Rng } from '../utils/rng';
import { SPAWN } from '../utils/constants';
import type { InputIntent } from './Input';

/** Default seed when none is supplied (keeps no-arg callers/tests deterministic;
 *  the live game passes a fresh boot seed). */
export const DEFAULT_SEED = 0x5eed;

/** Funnel telemetry for the spawn -> roam pipeline. `eligible` is the latest
 *  spawn-attempt's eligible-species count; the rest are cumulative. */
export interface Telemetry {
  eligible: number;
  attempts: number;
  spawned: number;
  fled: number;
  despawned: number;
}

export interface GameState {
  player: PlayerState;
  /** The finite biome graph (Meadow unlocked; neighbours locked-but-visible). */
  world: World;
  /** The biome the player is currently standing in (drives the HUD label and
   *  biome-specific spawns). */
  currentBiome: BiomeId;
  /** Current day phase (gates which species are out). */
  dayPhase: DayPhase;
  /** Wall-clock time simulated this session, seconds (advances by SIM_DT each
   *  step). Drives the day-night cycle and the spawn cadence. */
  timeSec: number;
  /** Seeded RNG — the only source of nondeterminism in the sim. */
  rng: Rng;
  /** Fixed-size animal pool (active + inactive slots). */
  animals: Animal[];
  /** Countdown to the next spawn attempt, seconds. */
  spawnTimer: number;
  telemetry: Telemetry;
}

export function createGameState(seed: number = DEFAULT_SEED): GameState {
  const world = createWorld();
  // Spawn at the Meadow's centre (the origin).
  return {
    player: createPlayer(0, 0),
    world,
    currentBiome: 'meadow',
    dayPhase: dayPhaseAt(0),
    timeSec: 0,
    rng: createRng(seed),
    animals: createAnimalPool(),
    spawnTimer: 0, // first attempt fires promptly so the world has life at boot
    telemetry: { eligible: 0, attempts: 0, spawned: 0, fled: 0, despawned: 0 },
  };
}

/** Advance the simulation one fixed step. The ONLY mutation path. */
export function update(game: GameState, intent: InputIntent, dt: number): void {
  game.timeSec += dt;
  updatePlayer(game.player, intent, dt, game.world);

  // Track the biome under the player (clamped to the unlocked region, so this
  // stays defined; keep the last known biome if ever outside) and the day phase.
  const here = currentBiome(game.world, game.player.x, game.player.y);
  if (here) game.currentBiome = here;
  game.dayPhase = dayPhaseAt(game.timeSec);

  // --- Spawn cadence -------------------------------------------------------
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    game.spawnTimer += SPAWN.intervalSec;
    const result = trySpawn(
      game.animals,
      game.world,
      game.currentBiome,
      game.dayPhase,
      game.player.x,
      game.player.y,
      game.rng,
    );
    game.telemetry.eligible = result.eligibleCount;
    // An "attempt" = we had eligible species and tried to place one.
    if (result.outcome !== 'no-eligible') game.telemetry.attempts++;
    if (result.outcome === 'spawned') game.telemetry.spawned++;
  }

  // --- Roam + despawn ------------------------------------------------------
  for (const a of game.animals) {
    if (!a.active) continue;
    const r = updateAnimal(a, game.player, game.world, game.rng, dt);
    if (r.fledNow) game.telemetry.fled++;
    // Off-screen cleanup: recycle animals that have wandered/fled far away.
    if (Math.hypot(a.x - game.player.x, a.y - game.player.y) > SPAWN.despawnRadius) {
      despawnAnimal(a);
      game.telemetry.despawned++;
    }
  }
}

/** Number of active animals (for the HUD readout). */
export function liveAnimalCount(game: GameState): number {
  return activeAnimalCount(game.animals);
}
