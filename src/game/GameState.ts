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
import { createWorld, currentBiome, isInCover, type BiomeId, type World } from './World';
import { computeStealthFactor, isSneaking } from './Detection';
import {
  activeAnimalCount,
  createAnimalPool,
  despawnAnimal,
  nearestActiveAnimal,
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
import {
  activeLure,
  addBait,
  clearActiveBait,
  createBaitState,
  cycleSelectedBait,
  setSelectedBait,
  deployBait,
  isCorrectBaitFor,
  tickBait,
  type BaitState,
} from './Bait';
import { finalCatchChance } from './Catch';
import { getSpecies } from './Species';
import { STARTER_TOOL, type ToolId } from './Tools';
import { createRng, type Rng } from '../utils/rng';
import { BAIT, BAIT_ORDER, CATCH, CATCH_FX, SPAWN, type BaitId } from '../utils/constants';
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

/** A lingering "Got it!" / "It got away!" flash anchored at the animal, ticking
 *  down so the renderer can fade it out. PR #5.1 legibility. */
export interface ResultFlash {
  outcome: 'caught' | 'escaped';
  x: number;
  y: number;
  timer: number;
}

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
  /** A lingering result flash (caught/escaped), or null. */
  resultFlash: ResultFlash | null;
  // --- Targeting (PR #5.1 — "who am I catching") ---------------------------
  /** Pool index of the current catch target (nearest in-range animal, or the
   *  encounter's animal while one is in flight); -1 if none. */
  targetIndex: number;
  /** True when there's a target AND no encounter — i.e. CATCH would fire. */
  catchArmed: boolean;
  /** Live finalCatchChance for the current target (0 when none) — a preview that
   *  jumps when the player baits, so the diet loop is legible. */
  targetChance: number;
  /** Is the correct bait active on the current target's species? */
  targetBaited: boolean;
  /** Has the player ever deployed bait? Gates the first-time "try bait" hint. */
  usedBaitEver: boolean;
  /** Bait was deployed THIS step (one-shot; for the deploy confirmation fx). */
  baitJustDeployed: boolean;
  /** A deploy was BLOCKED this step because that bait was empty (one-shot). */
  baitDeployFailed: boolean;
  /** Whether the last deploy's bait MATCHED a nearby animal's diet (debug); null
   *  before the first deploy. */
  lastDeployMatched: boolean | null;
  /** A lingering bait message ("Out of …" / "Wrong bait — ignored"), or null. */
  baitNotice: { text: string; timer: number } | null;
  // --- Stealth (PR #6 — derived each step from the player + world) ---------
  /** Player stealth this step: the detection-radius factor (1 = fully visible),
   *  and which inputs are active. Read by the AI (via the factor) and the
   *  ?debug overlay. */
  stealth: { factor: number; inCover: boolean; sneaking: boolean };
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
    resultFlash: null,
    targetIndex: -1,
    catchArmed: false,
    targetChance: 0,
    targetBaited: false,
    usedBaitEver: false,
    baitJustDeployed: false,
    baitDeployFailed: false,
    lastDeployMatched: null,
    baitNotice: null,
    stealth: { factor: 1, inCover: false, sneaking: false },
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
  game.lastOutcome = null; // one-shot fx flags, fresh each step
  game.baitJustDeployed = false;
  game.baitDeployFailed = false;
  game.timeSec += dt;
  updatePlayer(game.player, intent, dt, game.world);

  const here = currentBiome(game.world, game.player.x, game.player.y);
  if (here) game.currentBiome = here;
  game.dayPhase = dayPhaseAt(game.timeSec);

  // --- Stealth (one global factor; depends on the player + world, not the
  // animal, so compute it ONCE here and feed it to every animal's detection). --
  const inCover = isInCover(game.world, game.player.x, game.player.y);
  const sneaking = isSneaking(game.player);
  game.stealth.inCover = inCover;
  game.stealth.sneaking = sneaking;
  game.stealth.factor = computeStealthFactor(inCover, sneaking);

  // --- Bait actions (independent of the encounter) -------------------------
  // Direct selection (the tray): a no-op if that bait is empty; surface a notice
  // so the scarcity reads (reusing the #5.3 bait-notice channel).
  if (intent.baitSelect >= 0) {
    const id = BAIT_ORDER[intent.baitSelect];
    intent.baitSelect = -1;
    if (id !== undefined && !setSelectedBait(game.bait, id)) {
      game.baitNotice = { text: `Out of ${id}`, timer: BAIT.noticeSec };
    }
  }
  if (intent.baitCycle) {
    intent.baitCycle = false;
    cycleSelectedBait(game.bait);
  }
  if (intent.baitDeploy) {
    intent.baitDeploy = false;
    const selected = game.bait.selected;
    if (deployBait(game.bait, game.player.x, game.player.y)) {
      game.usedBaitEver = true;
      game.baitJustDeployed = true; // one-shot: drives the deploy confirmation fx
      // Did it match a nearby animal's diet? Drives the "wrong bait" teaching cue.
      const matched = deployMatchesNearby(game, selected);
      game.lastDeployMatched = matched;
      if (matched === false) {
        game.baitNotice = { text: 'Wrong bait — ignored', timer: BAIT.noticeSec };
      }
    } else {
      // Out of that bait — blocked.
      game.baitDeployFailed = true;
      game.baitNotice = { text: `Out of ${selected}!`, timer: BAIT.noticeSec };
    }
  }
  tickBait(game.bait, dt);

  // Tick down the lingering flashes.
  if (game.resultFlash) {
    game.resultFlash.timer -= dt;
    if (game.resultFlash.timer <= 0) game.resultFlash = null;
  }
  if (game.baitNotice) {
    game.baitNotice.timer -= dt;
    if (game.baitNotice.timer <= 0) game.baitNotice = null;
  }

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
    const fledNow = updateAnimal(a, game.player, game.world, game.rng, dt, lure, game.stealth.factor);
    if (fledNow) game.telemetry.fled++;
    if (Math.hypot(a.x - game.player.x, a.y - game.player.y) > SPAWN.despawnRadius) {
      despawnAnimal(a);
      game.telemetry.despawned++;
    }
  }

  // --- Targeting (computed last, from final positions) ---------------------
  updateTarget(game);
}

/**
 * Did a just-deployed bait match the diet of an animal near the deploy point?
 * Used only to drive the "wrong bait — ignored" teaching cue (and the debug
 * readout). Checks animals within the lure radius of the player. PURE read.
 */
function deployMatchesNearby(game: GameState, baitId: BaitId): boolean | null {
  const idx = nearestActiveAnimal(game.animals, game.player.x, game.player.y, BAIT.lureRadius);
  if (idx < 0) return null;
  return getSpecies(game.animals[idx].species).bait === baitId;
}

/**
 * Recompute the catch target + its live preview chance. During an encounter the
 * target is locked to the encounter's animal; otherwise it's the nearest active
 * animal within reach (the same proximity gate startEncounter uses). PURE read.
 */
function updateTarget(game: GameState): void {
  if (game.encounter) {
    const a = game.animals[game.encounter.animalIndex];
    game.targetIndex = game.encounter.animalIndex;
    game.catchArmed = false; // already mid-attempt
    game.targetChance = game.encounter.chance;
    game.targetBaited = isCorrectBaitFor(getSpecies(a.species), game.bait);
    return;
  }
  const idx = nearestActiveAnimal(
    game.animals,
    game.player.x,
    game.player.y,
    CATCH.attemptRadius,
  );
  game.targetIndex = idx;
  game.catchArmed = idx >= 0;
  if (idx < 0) {
    game.targetChance = 0;
    game.targetBaited = false;
    return;
  }
  const a = game.animals[idx];
  const def = getSpecies(a.species);
  const dist = Math.hypot(a.x - game.player.x, a.y - game.player.y);
  game.targetBaited = isCorrectBaitFor(def, game.bait);
  game.targetChance = finalCatchChance(def, {
    dist,
    tool: game.tool,
    biome: game.currentBiome,
    correctBait: game.targetBaited,
    fleeing: a.aiState === 'flee',
  });
}

/** Apply a resolved encounter's outcome and clear it. */
function resolveOutcome(game: GameState, outcome: 'caught' | 'escaped'): void {
  const enc = game.encounter!;
  const animal = game.animals[enc.animalIndex];
  game.telemetry.shakesSurvived = shakesSurvived(enc);
  // Anchor the lingering result flash at the animal before anything moves it.
  game.resultFlash = { outcome, x: animal.x, y: animal.y, timer: CATCH_FX.resultFlashSec };
  if (outcome === 'caught') {
    despawnAnimal(animal);
    game.sessionCatches++;
    game.telemetry.caught++;
    // Replenish the caught species' diet bait (you learned what it eats), and
    // spend the active lure — it was "used up" on the catch, so it disappears.
    addBait(game.bait, getSpecies(enc.species).bait, BAIT.rewardPerCatch);
    clearActiveBait(game.bait);
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
