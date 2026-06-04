/**
 * Which biome edges get a boundary WALL, and which biomes get the locked
 * treatment (dim + fog) — derived PURELY from the current unlock state. No three,
 * no DOM. This is the SAME condition the renderer always used (every unlocked ->
 * LOCKED adjacency gets a wall; unlocked|unlocked seams do NOT); extracting it so
 * the constructor AND `WorldRenderer.refresh` share ONE source of truth — they
 * can't drift, and the rule is unit-testable without instantiating WebGL.
 *
 * The fix this enables (Plan #9 follow-up): the renderer was build-once, so a
 * mid-session unlock left a STALE wall at the now-open seam. Recomputing this set
 * on unlock clears it, while gates at still-locked edges remain.
 */

import { isUnlocked, sharedBorder, type World } from '../game/World';
import type { BiomeId } from '../utils/constants';

export interface BorderEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface WalledEdge {
  /** The unlocked biome the wall belongs to. */
  from: BiomeId;
  /** The still-LOCKED neighbour it walls off. */
  to: BiomeId;
  edge: BorderEdge;
}

/** Every unlocked -> LOCKED adjacency, with its shared edge — the §5.5 gate set.
 *  Unlocked|unlocked seams are excluded (the per-rect clamp makes them seamless). */
export function walledEdges(world: World): WalledEdge[] {
  const out: WalledEdge[] = [];
  for (const id of world.order) {
    if (!isUnlocked(world, id)) continue;
    for (const adj of world.biomes[id].def.adjacent) {
      if (isUnlocked(world, adj)) continue;
      const edge = sharedBorder(world.biomes[id].def.bounds, world.biomes[adj].def.bounds);
      if (edge) out.push({ from: id, to: adj, edge });
    }
  }
  return out;
}

/** The biomes that get the locked-region ground dim + fog veil (every locked one). */
export function lockedBiomes(world: World): BiomeId[] {
  return world.order.filter((id) => !isUnlocked(world, id));
}
