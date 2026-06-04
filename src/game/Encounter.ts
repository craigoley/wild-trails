/**
 * The catch ENCOUNTER — PURE, Node-testable. Bridges a catch attempt to its
 * playback: it builds the CatchContext from the live game, resolves the attempt
 * ONCE (deterministic, via the seeded rng), and then walks a beat clock through
 * the resolved shake DATA so the renderer can animate each beat. The outcome
 * (caught / escaped) was decided at attempt time — the playback only reveals it.
 *
 * Nothing here touches three or the DOM.
 */

import { CATCH, type BiomeId, type SpeciesId } from '../utils/constants';
import {
  finalCatchChance,
  resolveCatch,
  shakeCountForTier,
  type ShakeOutcome,
} from './Catch';
import { getSpecies } from './Species';
import { isCorrectBaitFor, type BaitState } from './Bait';
import { nearestActiveAnimal, type Animal } from './Animal';
import type { ToolId } from './Tools';
import type { PlayerState } from './Player';
import type { Rng } from '../utils/rng';

/** Which beat of the playback we're on. */
export type EncounterPhase = 'shaking' | 'resolving' | 'done';

export interface Encounter {
  /** Pool index of the animal being caught (frozen during the encounter). */
  animalIndex: number;
  species: SpeciesId;
  /** The computed [0,1] chance this was resolved against (for the debug overlay). */
  chance: number;
  /** The resolved shake sequence — the DATA the renderer plays back. */
  shakes: ShakeOutcome[];
  caught: boolean;
  critical: boolean;
  /** Beat currently playing (index into `shakes` while phase === 'shaking'). */
  shakeIndex: number;
  /** Seconds left in the current beat. */
  beatTimer: number;
  phase: EncounterPhase;
}

/** Inputs needed to start an encounter (read-only view of the game). */
export interface AttemptInputs {
  animals: Animal[];
  player: PlayerState;
  biome: BiomeId;
  tool: ToolId;
  bait: BaitState;
  rng: Rng;
}

/**
 * Try to start a catch on the nearest animal within reach. Returns the new
 * Encounter, or null if no animal is close enough. The resolution is rolled here
 * (once) so the rest is pure playback.
 */
export function startEncounter(input: AttemptInputs): Encounter | null {
  const idx = nearestActiveAnimal(input.animals, input.player.x, input.player.y, CATCH.attemptRadius);
  if (idx < 0) return null;

  const animal = input.animals[idx];
  const def = getSpecies(animal.species);
  const dist = Math.hypot(animal.x - input.player.x, animal.y - input.player.y);
  const chance = finalCatchChance(def, {
    dist,
    tool: input.tool,
    biome: input.biome,
    correctBait: isCorrectBaitFor(def, input.bait),
    fleeing: animal.aiState === 'flee',
  });
  const res = resolveCatch(chance, shakeCountForTier(def.tier), input.rng);

  return {
    animalIndex: idx,
    species: animal.species,
    chance,
    shakes: res.shakes,
    caught: res.caught,
    critical: res.critical,
    shakeIndex: 0,
    beatTimer: CATCH.shakeBeatSec,
    phase: 'shaking',
  };
}

/**
 * Advance the encounter playback by `dt`. Returns the OUTCOME ('caught' /
 * 'escaped') on the step the playback finishes, or null while it's still
 * playing. The caller applies the outcome (despawn / flee) when it's returned.
 */
export function advanceEncounter(enc: Encounter, dt: number): 'caught' | 'escaped' | null {
  enc.beatTimer -= dt;
  if (enc.beatTimer > 0) return null;

  if (enc.phase === 'shaking') {
    enc.shakeIndex += 1;
    if (enc.shakeIndex < enc.shakes.length) {
      enc.beatTimer += CATCH.shakeBeatSec; // next shake beat
    } else {
      enc.phase = 'resolving'; // settle / break-out beat
      enc.beatTimer += CATCH.resolveBeatSec;
    }
    return null;
  }

  // phase === 'resolving' -> the playback is done; reveal the outcome.
  enc.phase = 'done';
  return enc.caught ? 'caught' : 'escaped';
}

/** Count of shakes that passed (for telemetry). */
export function shakesSurvived(enc: Encounter): number {
  let n = 0;
  for (const s of enc.shakes) if (s.passed) n++;
  return n;
}
