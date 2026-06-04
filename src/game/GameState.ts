/**
 * The pure game-state container and its single `update` entry point. Owns the
 * player and the run clock. Imports NOTHING from three and never touches the
 * DOM, so the whole simulation runs and is unit-tested in Node. The rendering
 * layer READS a GameState; it must never mutate one.
 *
 * Phase 0 (this PR) is a roaming SKELETON: `update` just advances the clock and
 * steps the player. The creature-catching loop —
 *   spawn -> roam -> encounter -> catch-attempt -> resolve
 * — and its state (animals, species, biome regions, tools/bait, the Field
 * Journal write-back) lands in later phased PRs, each extending this container.
 *
 * `update` is the only mutation path.
 */

import { updatePlayer, type PlayerState, createPlayer } from './Player';
import type { InputIntent } from './Input';

/** The biome the player is currently standing in. Phase 0 is a single starter
 *  biome; the region map + transitions arrive with the spawn/biome PR. */
export type Biome = 'meadow';

export interface GameState {
  player: PlayerState;
  /** Wall-clock time simulated this session, seconds (advances by SIM_DT each
   *  step). Drives time-of-day and spawn cadence in later PRs. */
  timeSec: number;
  /** The player's current biome (single starter biome in Phase 0). */
  biome: Biome;
}

export function createGameState(): GameState {
  return {
    player: createPlayer(0, 0),
    timeSec: 0,
    biome: 'meadow',
  };
}

/** Advance the simulation one fixed step. The ONLY mutation path. */
export function update(game: GameState, intent: InputIntent, dt: number): void {
  game.timeSec += dt;
  updatePlayer(game.player, intent, dt);
}
