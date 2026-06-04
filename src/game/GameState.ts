/**
 * The pure game-state container and its single `update` entry point. Owns the
 * player, the finite biome World, the day-night clock, the animal POOL, the
 * deterministic RNG, and now the CATCH loop (tools, bait, the active encounter,
 * an in-memory session catch count). Imports NOTHING from three and never touches
 * the DOM, so the whole simulation runs and is unit-tested in Node. The rendering
 * layer READS a GameState; it must never mutate one.
 *
 * The pipeline is now spawn -> roam -> encounter -> catch-attempt -> resolve, and
 * the `?debug=1` funnel telemetry covers all of it (the black-box-prevention
 * rule): eligible / attempts / spawned, flee / despawn, and catch attempts,
 * the last computed chance, shakes survived, caught, escaped. The encounter is
 * resolved as DATA (Catch.resolveCatch); the renderer plays it back, so the
 * animation can never diverge from the odds.
 *
 * Catches are in-memory only this PR (sessionCatches); Journal persistence is
 * PR #7. `update` is the only mutation path; RNG is the only nondeterminism, and
 * it's seeded.
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
import {
  advanceEncounter,
  shakesSurvived,
  startEncounter,
  type Encounter,
} from './Encounter';
import { activeLure, createBaitState, cycleSelectedBait, deployBait, tickBait, type BaitState } from './Bait';
import { STARTER_TOOL, type ToolId } from './Tools';
import { createRng, type Rng } from '../utils/rng';
import { SPAWN } from '../utils/constants';
import type { InputIntent } from './Input';

/** Default seed when none is supplied (keeps no-arg callers/tests deterministic;
 *  the live game passes a fresh boot seed). */
export const DEFAULT_SEED = 0x5eed;

/** Funnel telemetry for the spawn -> roam -> catch pipeline. `eligible` and
 *  `lastChance` are latest-value; the rest are cumulative counts. */
export interface Telemetry {
  eligible: number;
  attempts: number;
  spawned: number;
  fled: number;
  despawned: number;
  catchAttempts: number;
  /** The finalCatchChance of the most recent attempt (for tuning feel). */
  lastChance: number;
  /** Shakes survived on the most recent resolved encounter. */
  shakesSurvived: number;
  caught: number;
  escaped: number;
}

/** A just-resolved encounter outcome, for one frame, so the renderer/audio can
 *  fire the settle/break cue. Consumed (cleared) by the renderer. */
export type EncounterOutcome = 'caught' | 'escaped' | null;

export interface GameState {
  player: PlayerState;
  world: World;
  currentBiome: BiomeId;
  dayPhase: DayPhase;
  timeSec: number;
  rng: Rng;
  animals: Animal[];
  spawnTimer: number;
  /** The tool in hand (NET until tool unlocks in PR #8). */
  tool: ToolId;
  /** Bait inventory + the active deployment (the lure). */
  bait: BaitState;
  /** The in-flight catch encounter, or null. */
  encounter: Encounter | null;
  /** Outcome of the encounter that resolved THIS step (one-shot; for fx). */
  lastOutcome: EncounterOutcome;
  /** In-memory catches this session (Journal persistence is PR #7). */
  sessionCatches: number;
  telemetry: Telemetry;
}

export function createGameState(seed: number = DEFAULT_SEED): GameState {
  const world = createWorld();
  return {
    player: createPlayer(0, 0),
    world,
    currentBiome: 'meadow',
    dayPhase: dayPhaseAt(0),
    timeSec: 0,
    rng: createRng(seed),
    animals: createAnimalPool(),
    spawnTimer: 0,
    tool: STARTER_TOOL,
    bait: createBaitState(),
    encounter: null,
    lastOutcome: null,
    sessionCatches: 0,
    telemetry: {
      eligible: 0,
      attempts: 0,
      spawned: 0,
      fled: 0,
      despawned: 0,
      catchAttempts: 0,
      lastChance: 0,
      shakesSurvived: 0,
      caught: 0,
      escaped: 0,
    },
  };
}

/** Advance the simulation one fixed step. The ONLY mutation path. */
export function update(game: GameState, intent: InputIntent, dt: number): void {
  game.lastOutcome = null; // one-shot fx flag, fresh each step
  game.timeSec += dt;
  updatePlayer(game.player, intent, dt, game.world);

  const here = currentBiome(game.world, game.player.x, game.player.y);
  if (here) game.currentBiome = here;
  game.dayPhase = dayPhaseAt(game.timeSec);

  // --- Bait actions (independent of the encounter) -------------------------
  if (intent.baitCycle) {
    intent.baitCycle = false;
    cycleSelectedBait(game.bait);
  }
  if (intent.baitDeploy) {
    intent.baitDeploy = false;
    deployBait(game.bait, game.player.x, game.player.y);
  }
  tickBait(game.bait, dt);

  // --- Catch encounter -----------------------------------------------------
  if (game.encounter) {
    intent.catchPressed = false; // can't start another mid-encounter
    const outcome = advanceEncounter(game.encounter, dt);
    if (outcome) resolveOutcome(game, outcome);
  } else if (intent.catchPressed) {
    intent.catchPressed = false;
    const enc = startEncounter({
      animals: game.animals,
      player: game.player,
      biome: game.currentBiome,
      tool: game.tool,
      bait: game.bait,
      rng: game.rng,
    });
    if (enc) {
      game.encounter = enc;
      game.telemetry.catchAttempts++;
      game.telemetry.lastChance = enc.chance;
    }
  }

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
    if (result.outcome !== 'no-eligible') game.telemetry.attempts++;
    if (result.outcome === 'spawned') game.telemetry.spawned++;
  }

  // --- Roam + despawn ------------------------------------------------------
  const lure = activeLure(game.bait);
  const encounterIdx = game.encounter ? game.encounter.animalIndex : -1;
  for (let i = 0; i < game.animals.length; i++) {
    const a = game.animals[i];
    if (!a.active) continue;
    if (i === encounterIdx) continue; // the caught animal is frozen in the net
    const fledNow = updateAnimal(a, game.player, game.world, game.rng, dt, lure);
    if (fledNow) game.telemetry.fled++;
    if (Math.hypot(a.x - game.player.x, a.y - game.player.y) > SPAWN.despawnRadius) {
      despawnAnimal(a);
      game.telemetry.despawned++;
    }
  }
}

/** Apply a resolved encounter's outcome and clear it. */
function resolveOutcome(game: GameState, outcome: 'caught' | 'escaped'): void {
  const enc = game.encounter!;
  const animal = game.animals[enc.animalIndex];
  game.telemetry.shakesSurvived = shakesSurvived(enc);
  if (outcome === 'caught') {
    despawnAnimal(animal);
    game.sessionCatches++;
    game.telemetry.caught++;
  } else {
    animal.aiState = 'flee'; // a spooked escapee bolts
    game.telemetry.escaped++;
  }
  game.lastOutcome = outcome;
  game.encounter = null;
}

/** Number of active animals (for the HUD readout). */
export function liveAnimalCount(game: GameState): number {
  return activeAnimalCount(game.animals);
}
