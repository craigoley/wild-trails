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

import { ANIMAL, BAIT, ETHOGRAM, SPAWN, TOOLS, WATER_FLEE_BIAS, type BaitId, type SpeciesId, type ToolId } from '../utils/constants';
import { clampToBiome, isInWater, isOpenBiome, nearestWater, type World } from './World';
import { getSpecies } from './Species';
import { effectiveDetectionRadius } from './Detection';
import type { PlayerState } from './Player';
import type { Rng } from '../utils/rng';
import type { Vec2 } from '../utils/math';

export type AnimalAIState = 'wander' | 'flee' | 'approach';

/**
 * §4.6 D2 (i) — the ETHOGRAM behavior state, ORTHOGONAL to aiState. It runs ONLY while calm
 * (aiState 'wander'), subdividing the old single wander into the calm life: rest (hold still),
 * forage (a slow head-down amble), vigilance (hold still + scan), locomote (the onward wander).
 * flee/approach OVERRIDE it (the SM is suspended and resumes on return to calm). It is a READABLE
 * signal (the D3 "jizz" seam) and drives only the step SPEED — the speed-driven gait responds for
 * free, so there's no render change. ⚠️ NEVER feeds the catch (the catch reads aiState === 'flee').
 */
export type AnimalBehavior = 'rest' | 'forage' | 'vigilance' | 'locomote';

const BEHAVIORS: readonly AnimalBehavior[] = ['rest', 'forage', 'vigilance', 'locomote'];

/** A weighted, SEEDED pick of the next calm behavior from a budget (relative weights). Pure. */
export function pickBehavior(rng: Rng, budget: Readonly<Record<AnimalBehavior, number>>): AnimalBehavior {
  let total = 0;
  for (const b of BEHAVIORS) total += budget[b];
  let r = rng.next() * total;
  for (const b of BEHAVIORS) {
    r -= budget[b];
    if (r < 0) return b;
  }
  return BEHAVIORS[BEHAVIORS.length - 1]; // float-rounding guard — never normally hit
}

/** The SEEDED dwell (seconds) a behavior holds before the next is rolled — lerped in its [min,max]. Pure. */
export function behaviorDwell(behavior: AnimalBehavior, rng: Rng): number {
  const [lo, hi] = ETHOGRAM.dwell[behavior];
  return lo + rng.next() * (hi - lo);
}

/** The step SPEED for a calm behavior (world u/s): rest/vigilance hold still (→ the idle gait),
 *  forage ambles slowly, locomote uses the full wander speed. The speed-driven gait does the rest. */
export function behaviorSpeed(behavior: AnimalBehavior): number {
  switch (behavior) {
    case 'rest':
    case 'vigilance':
      return 0;
    case 'forage':
      return ETHOGRAM.forageSpeed;
    case 'locomote':
      return ANIMAL.wanderSpeed;
  }
}

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
  /** §D2 (i) — the calm ETHOGRAM state (readable; the D3 jizz seam). Meaningful while aiState is
   *  'wander'; suspended (held) during flee/approach. */
  behavior: AnimalBehavior;
  /** Time left (seconds) in the current behavior before the next is rolled. Ticks ONLY while calm. */
  behaviorTimer: number;
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
    behavior: 'locomote',
    behaviorTimer: 0,
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
 * The active net's GATE reach for a SPECIFIC animal (slice B1 — the lateral edge). Every
 * net's base reach is 2.6; a biome net only EXTENDS the gate IN ITS CONDITION — the dip-net
 * reaches an IN-WATER target (a fled frog across the pond), the throwing net ranges in an
 * OPEN biome. Off-condition every net is 2.6, so no net is reachable-farther everywhere.
 * This governs ONLY which animals are reachable — the proximity/odds use the base reach
 * (2.6) for every net, so the catch CHANCE at a given distance is net-independent. Pure.
 */
export function gateReach(tool: ToolId, animal: Animal): number {
  const def = TOOLS[tool];
  if (animal.inWater && def.reachInWater !== undefined) return def.reachInWater;
  if (def.reachOpen !== undefined && isOpenBiome(getSpecies(animal.species).biome)) return def.reachOpen;
  return def.reach;
}

/**
 * Pool index of the nearest ACTIVE animal within the active net's per-animal GATE reach
 * (slice B1), or -1. Replaces the fixed-radius nearestActiveAnimal at the catch gate + arm
 * so a biome net can reach its condition's animals (an in-water frog / an open-ground bird)
 * that the hand net cannot — without ever boosting the odds.
 */
export function nearestCatchable(pool: Animal[], x: number, y: number, tool: ToolId): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    if (!a.active) continue;
    const d = Math.hypot(a.x - x, a.y - y);
    if (d <= gateReach(tool, a) && d < bestDist) {
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
    // §D2 (i) — a fresh animal starts calm in 'locomote' with a 0 timer, so its first calm step rolls
    // the seeded behavior (deterministic via game.rng). Under ?freeze no step runs → it stays here
    // (speed 0 at spawn → idle gait), so the frozen capture is unchanged.
    a.behavior = 'locomote';
    a.behaviorTimer = 0;
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
    // --- §D2 (i) the ETHOGRAM: calm only (we reach here iff aiState === 'wander'). Advance the dwell;
    // on expiry roll the next state (seeded). flee/approach never reach here, so the SM is naturally
    // suspended during them and resumes (mid-dwell) on return to calm. The state sets the step SPEED;
    // the speed-driven gait does the rest (rest/vigilance → idle, forage → slow, locomote → walk).
    animal.behaviorTimer -= dt;
    if (animal.behaviorTimer <= 0) {
      animal.behavior = pickBehavior(rng, ETHOGRAM.defaultBudget);
      animal.behaviorTimer = behaviorDwell(animal.behavior, rng);
    }
    const speed = behaviorSpeed(animal.behavior);
    if (speed > 0) {
      // A moving state re-picks a wander heading on the existing cadence (the random-walk).
      animal.retargetTimer -= dt;
      if (animal.retargetTimer <= 0) {
        randomHeading(rng, _heading);
        animal.headingX = _heading.x;
        animal.headingY = _heading.y;
        animal.retargetTimer = ANIMAL.wanderRetargetSec;
      }
      vx = animal.headingX * speed;
      vy = animal.headingY * speed;
    } else {
      vx = 0; // rest / vigilance — hold still (the idle gait reads as a calm pause)
      vy = 0;
    }
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
