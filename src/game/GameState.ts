/**
 * The pure game-state container and its single `update` entry point. Owns the
 * player, the finite biome World, the player's current biome, and the run clock.
 * Imports NOTHING from three and never touches the DOM, so the whole simulation
 * runs and is unit-tested in Node. The rendering layer READS a GameState; it
 * must never mutate one.
 *
 * This is the roaming PR: `update` steps the player (clamped to the unlocked
 * region) and tracks which biome they're standing in. The creature-catching loop
 * —
 *   spawn -> roam -> encounter -> catch-attempt -> resolve
 * — and its state (animals, species, tools/bait, the Field Journal write-back)
 * lands in later phased PRs, each extending this container.
 *
 * `update` is the only mutation path.
 */

import { updatePlayer, type PlayerState, createPlayer } from './Player';
import { createWorld, currentBiome, type BiomeId, type World } from './World';
import type { InputIntent } from './Input';

export interface GameState {
  player: PlayerState;
  /** The finite biome graph (Meadow unlocked; neighbours locked-but-visible). */
  world: World;
  /** The biome the player is currently standing in (drives the HUD label and,
   *  later, biome-specific spawns). */
  currentBiome: BiomeId;
  /** Wall-clock time simulated this session, seconds (advances by SIM_DT each
   *  step). Drives time-of-day and spawn cadence in later PRs. */
  timeSec: number;
}

export function createGameState(): GameState {
  const world = createWorld();
  // Spawn at the Meadow's centre (the origin).
  return {
    player: createPlayer(0, 0),
    world,
    currentBiome: 'meadow',
    timeSec: 0,
  };
}

/** Advance the simulation one fixed step. The ONLY mutation path. */
export function update(game: GameState, intent: InputIntent, dt: number): void {
  game.timeSec += dt;
  updatePlayer(game.player, intent, dt, game.world);
  // Track the biome under the player. The player is clamped to the unlocked
  // region, so this stays defined; keep the last known biome if ever outside.
  const here = currentBiome(game.world, game.player.x, game.player.y);
  if (here) game.currentBiome = here;
}
