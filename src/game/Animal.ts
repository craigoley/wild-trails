/**
 * Animals — a fixed-size POOL plus the per-animal roaming AI. PURE: ZERO
 * three/DOM, fully Node-testable. The pool is allocated ONCE (SPAWN.maxAnimals);
 * spawning activates an inactive slot and despawning deactivates one — the array
 * is never grown and nothing allocates per frame (fleet rule).
 *
 * AI is a small state machine, data-driven from the species table:
 *  - WANDER:  a slow random-walk, re-picking a heading every wanderRetargetSec,
 *    clamped to the animal's HOME biome (it never leaves its biome).
 *  - FLEE:    triggered when the player comes within the species' detectionRadius;
 *    moves directly away at the species' baseFleeSpeed. Warier/faster species
 *    (bigger detectionRadius, higher baseFleeSpeed) bolt sooner and quicker.
 *    Hysteresis (ANIMAL.fleeReleaseBuffer) stops state flicker at the threshold.
 *  - APPROACH: when the CORRECT bait (matching this species' diet) is active
 *    within lureRadius, the animal moves TOWARD the bait instead of fleeing —
 *    overriding skittishness. Wrong-diet bait is ignored. (Bait, PR #5.)
 *
 * Fleeing is just movement (the catch loop in GameState reacts to it). For render
 * interpolation each animal keeps its previous sim-step position.
 */

import { ANIMAL, BAIT, SPAWN, WATER_FLEE_BIAS, type BaitId, type SpeciesId } from '../utils/constants';
import { clampToBiome, isInWater, nearestWater, type World } from './World';
import { getSpecies } from './Species';
import { effectiveDetectionRadius } from './Detection';
import type { PlayerState } from './Player';
import type { Rng } from '../utils/rng';
import type { Vec2 } from '../utils/math';

export type AnimalAIState = 'wander' | 'flee' | 'approach';

/** An active bait lure the AI can be drawn to (matching diet only). */
export interface BaitLure {
  baitId: BaitId;
  x: number;
  y: number;
}

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
  /** Is the animal currently in a WATER region (slice W)? Set each step. The dip-net
   *  (B1) hook: an in-water animal is out of the hand net's reach over the water. */
  inWater: boolean;
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
    inWater: false,
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

/** Is any animal of this species currently active? (Plan #8b — avoid spawning a
 *  second tracking target while one is already out.) */
export function hasActiveSpecies(pool: Animal[], species: SpeciesId): boolean {
  for (const a of pool) if (a.active && a.species === species) return true;
  return false;
}

/** Pool index of the nearest ACTIVE animal within `maxDist` of (x, y), or -1 if
 *  none. Used to gate a catch attempt to a nearby animal. */
export function nearestActiveAnimal(pool: Animal[], x: number, y: number, maxDist: number): number {
  let best = -1;
  let bestDist = maxDist;
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    if (!a.active) continue;
    const d = Math.hypot(a.x - x, a.y - y);
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
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
    a.inWater = false;
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
 *
 * `lure` (optional) is an active bait point: if it matches this species' diet and
 * is within BAIT.lureRadius, the animal APPROACHES it instead of fleeing. Passing
 * no lure (the default) reproduces the pure wander/flee behaviour exactly.
 *
 * `stealthFactor` (optional, default 1) shrinks the species' detection radius
 * (PR #6). 1 = no stealth = exact PR #4 behaviour; only the radius the flee
 * trigger + hysteresis compare against changes — the flee/hysteresis logic and
 * flee speed are untouched.
 */
export function updateAnimal(
  animal: Animal,
  player: PlayerState,
  world: World,
  rng: Rng,
  dt: number,
  lure: BaitLure | null = null,
  stealthFactor = 1,
): boolean {
  animal.prevX = animal.x;
  animal.prevY = animal.y;

  const def = getSpecies(animal.species);
  const dx = animal.x - player.x;
  const dy = animal.y - player.y;
  const dist = Math.hypot(dx, dy);
  // Stealth-aware detection radius. With stealthFactor === 1 this equals
  // def.detectionRadius, so the trigger + hysteresis below are byte-identical
  // to PR #4 at rest.
  const detRadius = effectiveDetectionRadius(def, stealthFactor);

  // Is a matching-diet bait luring this animal (within range)?
  const lured =
    lure !== null &&
    def.bait === lure.baitId &&
    Math.hypot(animal.x - lure.x, animal.y - lure.y) <= BAIT.lureRadius;

  // --- State transitions (with hysteresis) ---------------------------------
  let fledNow = false;
  if (lured) {
    animal.aiState = 'approach';
  } else {
    // A lure that just ended leaves the animal in 'approach'; drop back to wander
    // (the detection check below may immediately re-flee if the player is close).
    if (animal.aiState === 'approach') {
      animal.aiState = 'wander';
      animal.retargetTimer = 0;
    }
    if (animal.aiState === 'wander') {
      if (dist <= detRadius) {
        animal.aiState = 'flee';
        fledNow = true;
      }
    } else if (dist > detRadius + ANIMAL.fleeReleaseBuffer) {
      animal.aiState = 'wander';
      animal.retargetTimer = 0; // re-pick a wander heading next
    }
  }

  // --- Movement (every branch sets vx/vy) ----------------------------------
  let vx: number;
  let vy: number;
  if (animal.aiState === 'approach' && lure !== null) {
    // Toward the bait point at the approach speed.
    const adx = lure.x - animal.x;
    const ady = lure.y - animal.y;
    const adist = Math.hypot(adx, ady);
    const ux = adist > 0 ? adx / adist : animal.facingX;
    const uy = adist > 0 ? ady / adist : animal.facingY;
    vx = ux * BAIT.approachSpeed;
    vy = uy * BAIT.approachSpeed;
  } else if (animal.aiState === 'flee') {
    // Directly away from the player at the species' flee speed. (If exactly on
    // the player — dist 0 — keep the current facing to avoid a divide-by-zero.)
    let ux = dist > 0 ? dx / dist : animal.facingX;
    let uy = dist > 0 ? dy / dist : animal.facingY;
    // Slice W: a water-fleer (the frog) leaps TOWARD the nearest water's centre — blend
    // the away-from-player heading with the toward-water heading. Frog only; everything
    // else flees straight away (unchanged). Pure positioning — no catch-math touch.
    if (def.fleesToWater) {
      const w = nearestWater(world, animal.x, animal.y);
      if (w) {
        const wdx = w.x - animal.x;
        const wdy = w.y - animal.y;
        const wd = Math.hypot(wdx, wdy);
        if (wd > 0) {
          ux = ux * (1 - WATER_FLEE_BIAS) + (wdx / wd) * WATER_FLEE_BIAS;
          uy = uy * (1 - WATER_FLEE_BIAS) + (wdy / wd) * WATER_FLEE_BIAS;
          const bl = Math.hypot(ux, uy);
          if (bl > 0) {
            ux /= bl;
            uy /= bl;
          }
        }
      }
    }
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
  // Slice W: track whether the animal is now in water (the B1 dip-net hook). Animals
  // (unlike the player) enter water freely — the frog leaps in, out of hand-net reach.
  animal.inWater = isInWater(world, animal.x, animal.y);

  return fledNow;
}
