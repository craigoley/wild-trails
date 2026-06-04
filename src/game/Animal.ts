/**
 * Animals — a fixed-size POOL plus the per-animal roaming AI. PURE: ZERO
 * three/DOM, fully Node-testable. The pool is allocated ONCE (SPAWN.maxAnimals);
 * spawning activates an inactive slot and despawning deactivates one — the array
 * is never grown and nothing allocates per frame (fleet rule).
 *
 * AI is a two-state machine, data-driven from the species table:
 *  - WANDER: a slow random-walk, re-picking a heading every wanderRetargetSec,
 *    clamped to the animal's HOME biome (it never leaves its biome).
 *  - FLEE:   triggered when the player comes within the species' detectionRadius;
 *    moves directly away at the species' baseFleeSpeed. Warier/faster species
 *    (bigger detectionRadius, higher baseFleeSpeed) bolt sooner and quicker.
 *    Hysteresis (ANIMAL.fleeReleaseBuffer) stops state flicker at the threshold.
 *
 * There is NO catching here yet — fleeing is just movement. For render
 * interpolation each animal keeps its previous sim-step position.
 */

import { ANIMAL, SPAWN, type SpeciesId } from '../utils/constants';
import { clampToBiome, type World } from './World';
import { getSpecies } from './Species';
import type { PlayerState } from './Player';
import type { Rng } from '../utils/rng';
import type { Vec2 } from '../utils/math';

export type AnimalAIState = 'wander' | 'flee';

export interface Animal {
  active: boolean;
  species: SpeciesId;
  x: number;
  y: number;
  /** Previous sim-step position (render interpolation). */
  prevX: number;
  prevY: number;
  /** Facing unit vector (world) — last movement direction, for the renderer. */
  facingX: number;
  facingY: number;
  aiState: AnimalAIState;
  /** Current WANDER heading (unit vector) and time until the next retarget. */
  headingX: number;
  headingY: number;
  retargetTimer: number;
}

function makeInactiveAnimal(): Animal {
  return {
    active: false,
    species: 'fieldmouse',
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    facingX: 0,
    facingY: 1,
    aiState: 'wander',
    headingX: 0,
    headingY: 0,
    retargetTimer: 0,
  };
}

/** The fixed animal pool — SPAWN.maxAnimals slots, all inactive. */
export function createAnimalPool(): Animal[] {
  return Array.from({ length: SPAWN.maxAnimals }, makeInactiveAnimal);
}

export function activeAnimalCount(pool: Animal[]): number {
  let n = 0;
  for (const a of pool) if (a.active) n++;
  return n;
}

/**
 * Activate the first inactive slot at (x, y). Returns the activated Animal, or
 * null if the pool is full (the population cap). A fresh animal starts in WANDER
 * with `retargetTimer = 0` so its first update picks a heading.
 */
export function spawnAnimal(pool: Animal[], species: SpeciesId, x: number, y: number): Animal | null {
  for (const a of pool) {
    if (a.active) continue;
    a.active = true;
    a.species = species;
    a.x = x;
    a.y = y;
    a.prevX = x;
    a.prevY = y;
    a.facingX = 0;
    a.facingY = 1;
    a.headingX = 0;
    a.headingY = 0;
    a.retargetTimer = 0;
    a.aiState = 'wander';
    return a;
  }
  return null;
}

/** Return an animal to the pool (its slot becomes reusable). */
export function despawnAnimal(animal: Animal): void {
  animal.active = false;
}

// Reused scratch for the biome containment clamp — no per-animal per-frame alloc.
const _clamp: Vec2 = { x: 0, y: 0 };

/** Pick a fresh random unit heading into `out`. */
function randomHeading(rng: Rng, out: Vec2): void {
  const ang = rng.next() * Math.PI * 2;
  out.x = Math.cos(ang);
  out.y = Math.sin(ang);
}

const _heading: Vec2 = { x: 0, y: 0 };

/**
 * Advance one animal a fixed step. Returns whether it STARTED fleeing this step
 * (a wander -> flee transition) so the caller can count flee events. The animal
 * is clamped to its home biome; on hitting the edge while wandering it re-rolls
 * its heading so it doesn't grind along the wall.
 */
export function updateAnimal(
  animal: Animal,
  player: PlayerState,
  world: World,
  rng: Rng,
  dt: number,
): { fledNow: boolean } {
  animal.prevX = animal.x;
  animal.prevY = animal.y;

  const def = getSpecies(animal.species);
  const dx = animal.x - player.x;
  const dy = animal.y - player.y;
  const dist = Math.hypot(dx, dy);

  // --- State transitions (with hysteresis) ---------------------------------
  let fledNow = false;
  if (animal.aiState === 'wander') {
    if (dist <= def.detectionRadius) {
      animal.aiState = 'flee';
      fledNow = true;
    }
  } else if (dist > def.detectionRadius + ANIMAL.fleeReleaseBuffer) {
    animal.aiState = 'wander';
    animal.retargetTimer = 0; // re-pick a wander heading next
  }

  // --- Movement (both branches set vx/vy) ----------------------------------
  let vx: number;
  let vy: number;
  if (animal.aiState === 'flee') {
    // Directly away from the player at the species' flee speed. (If exactly on
    // the player — dist 0 — keep the current facing to avoid a divide-by-zero.)
    const ux = dist > 0 ? dx / dist : animal.facingX;
    const uy = dist > 0 ? dy / dist : animal.facingY;
    vx = ux * def.baseFleeSpeed;
    vy = uy * def.baseFleeSpeed;
  } else {
    animal.retargetTimer -= dt;
    if (animal.retargetTimer <= 0) {
      randomHeading(rng, _heading);
      animal.headingX = _heading.x;
      animal.headingY = _heading.y;
      animal.retargetTimer = ANIMAL.wanderRetargetSec;
    }
    vx = animal.headingX * ANIMAL.wanderSpeed;
    vy = animal.headingY * ANIMAL.wanderSpeed;
  }

  if (vx !== 0 || vy !== 0) {
    const len = Math.hypot(vx, vy);
    animal.facingX = vx / len;
    animal.facingY = vy / len;
  }

  // Integrate, then keep the animal inside its HOME biome.
  const nx = animal.x + vx * dt;
  const ny = animal.y + vy * dt;
  clampToBiome(world, def.biome, nx, ny, ANIMAL.radius, _clamp);
  // Hit the biome edge while wandering -> re-roll heading so it turns away.
  if (animal.aiState === 'wander' && (_clamp.x !== nx || _clamp.y !== ny)) {
    animal.retargetTimer = 0;
  }
  animal.x = _clamp.x;
  animal.y = _clamp.y;

  return { fledNow };
}
