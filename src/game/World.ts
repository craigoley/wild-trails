/**
 * The finite biome world — PURE TypeScript, ZERO three.js / DOM imports, fully
 * Node-testable. Holds the biome GRAPH (nodes = biomes, edges = adjacency) and
 * the player-containment helpers the sim and the renderers read.
 *
 * All biome geometry, names and adjacency live in `utils/constants.ts`; this
 * module is the behaviour over that data. The starting Meadow is unlocked; the
 * other biomes are present in the graph but locked (no unlock MECHANISM yet —
 * missions land in a later PR; this is just the state + shape so the
 * locked-but-visible rendering and the containment clamp have something real to
 * read).
 */

import { BIOMES, BIOME_ORDER, type BiomeDef, type BiomeId } from '../utils/constants';
import { clamp, rectContains, type Rect, type Vec2 } from '../utils/math';

export type { BiomeId } from '../utils/constants';

/** Per-biome runtime state: its static definition plus the (mutable-in-a-later-
 *  PR) unlocked flag. */
export interface BiomeRuntime {
  def: BiomeDef;
  unlocked: boolean;
}

export interface World {
  biomes: Record<BiomeId, BiomeRuntime>;
  /** Deterministic iteration order (mirrors BIOME_ORDER). */
  order: readonly BiomeId[];
  /**
   * Bounding box of the union of all UNLOCKED biome rects, cached so the
   * per-step containment clamp allocates nothing and iterates no biomes. Recompute
   * via `recomputeUnlockedBounds` whenever an unlock flag changes (a later PR).
   */
  unlockedBounds: Rect;
}

/** Bounding box of every unlocked biome's rect. Falls back to the Meadow if —
 *  defensively — nothing is unlocked, so the world is never zero-sized. */
function computeUnlockedBounds(world: Pick<World, 'biomes' | 'order'>): Rect {
  let found = false;
  const out: Rect = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  for (const id of world.order) {
    const b = world.biomes[id];
    if (!b.unlocked) continue;
    const r = b.def.bounds;
    if (!found) {
      out.minX = r.minX;
      out.minY = r.minY;
      out.maxX = r.maxX;
      out.maxY = r.maxY;
      found = true;
    } else {
      out.minX = Math.min(out.minX, r.minX);
      out.minY = Math.min(out.minY, r.minY);
      out.maxX = Math.max(out.maxX, r.maxX);
      out.maxY = Math.max(out.maxY, r.maxY);
    }
  }
  if (!found) {
    const r = world.biomes.meadow.def.bounds;
    return { minX: r.minX, minY: r.minY, maxX: r.maxX, maxY: r.maxY };
  }
  return out;
}

/** Recompute the cached unlocked bounding box (call after flipping any unlock
 *  flag). */
export function recomputeUnlockedBounds(world: World): void {
  world.unlockedBounds = computeUnlockedBounds(world);
}

/** Build a fresh world from the static biome graph. */
export function createWorld(): World {
  const biomes = {} as Record<BiomeId, BiomeRuntime>;
  for (const id of BIOME_ORDER) {
    biomes[id] = { def: BIOMES[id], unlocked: BIOMES[id].unlocked };
  }
  const world: World = {
    biomes,
    order: BIOME_ORDER,
    unlockedBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  };
  recomputeUnlockedBounds(world);
  return world;
}

/** Is the biome enterable? */
export function isUnlocked(world: World, id: BiomeId): boolean {
  return world.biomes[id].unlocked;
}

/** Is (x, y) inside the given biome's footprint? */
export function isInsideBiome(world: World, id: BiomeId, x: number, y: number): boolean {
  return rectContains(world.biomes[id].def.bounds, x, y);
}

/** Which biome contains (x, y), or null if the point is outside every biome.
 *  Biomes don't overlap, so the first match (in graph order) is the only one. */
export function currentBiome(world: World, x: number, y: number): BiomeId | null {
  for (const id of world.order) {
    if (rectContains(world.biomes[id].def.bounds, x, y)) return id;
  }
  return null;
}

/**
 * Clamp (x, y) into the UNLOCKED region, inset by `margin` (the player's radius)
 * so the body never pokes past the edge. Writes into `out` and returns it — no
 * allocation, safe to call every sim step with a reused scratch.
 *
 * The unlocked region is treated as the bounding box of all unlocked biome
 * rects. That is EXACT for a single unlocked biome (the current state) and for
 * contiguous unlocked cells that tile into a rectangle. Non-contiguous unlocks
 * (e.g. a diagonal pair) would over-permit the gap; when missions unlock biomes
 * (PR 8) the unlock order is adjacency-gated, but if free-form unlocks ever
 * land this needs per-rect containment instead of a single bbox.
 */
export function clampToUnlocked(
  world: World,
  x: number,
  y: number,
  margin: number,
  out: Vec2,
): Vec2 {
  const b = world.unlockedBounds;
  out.x = clamp(x, b.minX + margin, b.maxX - margin);
  out.y = clamp(y, b.minY + margin, b.maxY - margin);
  return out;
}

/** Would (x, y) be moved by `clampToUnlocked` — i.e. is the point at/over the
 *  unlocked boundary? DIAGNOSTIC (the ?debug readout); not read by the sim. */
export function clampActive(world: World, x: number, y: number, margin: number): boolean {
  const b = world.unlockedBounds;
  return x < b.minX + margin || x > b.maxX - margin || y < b.minY + margin || y > b.maxY - margin;
}

/** The line segment two biome rects share, or null if they don't touch on an
 *  edge. Used by the renderer to place a boundary wall between the unlocked
 *  region and a locked neighbour. Returns segment endpoints in world units; a
 *  vertical edge has x1 === x2, a horizontal edge has y1 === y2. */
export function sharedBorder(
  a: Rect,
  b: Rect,
): { x1: number; y1: number; x2: number; y2: number } | null {
  // Vertical shared edge: a's right touches b's left (or vice versa), with a
  // non-zero overlap in y.
  if (a.maxX === b.minX || a.minX === b.maxX) {
    const x = a.maxX === b.minX ? a.maxX : a.minX;
    const y1 = Math.max(a.minY, b.minY);
    const y2 = Math.min(a.maxY, b.maxY);
    if (y2 > y1) return { x1: x, y1, x2: x, y2 };
  }
  // Horizontal shared edge: a's far touches b's near (or vice versa), with a
  // non-zero overlap in x.
  if (a.maxY === b.minY || a.minY === b.maxY) {
    const y = a.maxY === b.minY ? a.maxY : a.minY;
    const x1 = Math.max(a.minX, b.minX);
    const x2 = Math.min(a.maxX, b.maxX);
    if (x2 > x1) return { x1, y1: y, x2, y2: y };
  }
  return null;
}
