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

import {
  BIOMES,
  BIOME_ORDER,
  HIDING_SPOTS,
  type BiomeDef,
  type BiomeId,
  type HidingSpotDef,
} from '../utils/constants';
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
   * The UNLOCKED biome rects, each tagged with which sides are "open" (shared
   * with another unlocked rect). The player clamp confines to the UNION of these
   * (not their bounding box) so a non-rectangular unlocked region — e.g. the
   * L-shape of Meadow+Woodland+Wetland — doesn't over-permit the empty corner.
   * Rebuilt by `recomputeUnlockedBounds` on unlock ONLY; the per-step clamp
   * iterates this ≤4-element list with local primitives (zero allocation).
   */
  unlockedRects: UnlockedRect[];
  /** Cover props (tall grass). A player within a spot's radius is "in cover"
   *  (PR #6 stealth). Static DATA from constants. */
  hidingSpots: readonly HidingSpotDef[];
}

/**
 * An unlocked biome rect plus its OPEN sides. A side is open when another
 * unlocked rect shares that full edge; the clamp does NOT inset open sides, so
 * adjacent inset-rects meet exactly at the seam → the union is seamless (no
 * internal wall at a shared border). Closed sides (a locked neighbour or the
 * world edge) are inset by the player radius as before.
 */
export interface UnlockedRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  openMinX: boolean;
  openMaxX: boolean;
  openMinY: boolean;
  openMaxY: boolean;
}

/** Do two axis-aligned ranges overlap with positive length (a shared segment, not
 *  just a touching point)? */
function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  return a1 < b2 && b1 < a2;
}

/**
 * Build the unlocked-rect list with each rect's OPEN sides. A side is open when
 * SOME OTHER unlocked rect shares that full edge (its opposing edge is collinear
 * and the perpendicular ranges overlap).
 *
 * ASSUMPTION: biome cells are axis-aligned and adjacency is FULL-EDGE (equal-size
 * grid cells), so "ranges overlap" === "shares the whole side". This holds for the
 * biome graph today. If off-grid / partial-overlap biomes ever land, a partial
 * shared edge would be wrongly marked fully open (over-permit) — revisit here.
 */
function computeUnlockedRects(world: Pick<World, 'biomes' | 'order'>): UnlockedRect[] {
  const open: { id: BiomeId; r: Rect }[] = [];
  for (const id of world.order) {
    if (world.biomes[id].unlocked) open.push({ id, r: world.biomes[id].def.bounds });
  }
  // Defensive: never a zero-sized world — fall back to the Meadow, all sides closed.
  if (open.length === 0) {
    const r = world.biomes.meadow.def.bounds;
    open.push({ id: 'meadow', r });
  }

  return open.map(({ r }) => {
    let openMinX = false;
    let openMaxX = false;
    let openMinY = false;
    let openMaxY = false;
    for (const other of open) {
      if (other.r === r) continue;
      const o = other.r;
      // A vertical seam (shared x edge) needs overlapping y-ranges; horizontal vice versa.
      if (o.maxX === r.minX && rangesOverlap(r.minY, r.maxY, o.minY, o.maxY)) openMinX = true;
      if (o.minX === r.maxX && rangesOverlap(r.minY, r.maxY, o.minY, o.maxY)) openMaxX = true;
      if (o.maxY === r.minY && rangesOverlap(r.minX, r.maxX, o.minX, o.maxX)) openMinY = true;
      if (o.minY === r.maxY && rangesOverlap(r.minX, r.maxX, o.minX, o.maxX)) openMaxY = true;
    }
    return { minX: r.minX, minY: r.minY, maxX: r.maxX, maxY: r.maxY, openMinX, openMaxX, openMinY, openMaxY };
  });
}

/** Recompute the cached unlocked-rect list (call after flipping any unlock flag).
 *  Rebuilt on UNLOCK only — never per frame — so the small alloc here is fine. */
export function recomputeUnlockedBounds(world: World): void {
  world.unlockedRects = computeUnlockedRects(world);
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
    unlockedRects: [],
    hidingSpots: HIDING_SPOTS,
  };
  recomputeUnlockedBounds(world);
  return world;
}

/**
 * Is (x, y) inside any hiding spot (cover)? Boundary is INCLUSIVE — a point
 * exactly `radius` from a spot's centre counts as in cover (pinned in a test).
 */
export function isInCover(world: World, x: number, y: number): boolean {
  for (const s of world.hidingSpots) {
    if (Math.hypot(x - s.x, y - s.y) <= s.radius) return true;
  }
  return false;
}

/** Is the biome enterable? */
export function isUnlocked(world: World, id: BiomeId): boolean {
  return world.biomes[id].unlocked;
}

/**
 * Unlock a biome (a mission reward, Plan #8): flip its flag and recompute the
 * cached unlocked rects so `clampToUnlocked` immediately permits the new region.
 * A no-op if already unlocked. Returns whether it changed (so the caller can fire
 * fx once).
 */
export function unlockBiome(world: World, id: BiomeId): boolean {
  if (world.biomes[id].unlocked) return false;
  world.biomes[id].unlocked = true;
  recomputeUnlockedBounds(world);
  return true;
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

/** Is (x, y) inside this rect's inset bounds? Open (shared) sides aren't inset, so
 *  a point on a seam is INSIDE both neighbours. Edges are INCLUSIVE (a point
 *  exactly on an inset edge counts as inside). Zero allocation. */
function insetContains(r: UnlockedRect, m: number, x: number, y: number): boolean {
  const loX = r.openMinX ? r.minX : r.minX + m;
  const hiX = r.openMaxX ? r.maxX : r.maxX - m;
  const loY = r.openMinY ? r.minY : r.minY + m;
  const hiY = r.openMaxY ? r.maxY : r.maxY - m;
  return x >= loX && x <= hiX && y >= loY && y <= hiY;
}

/**
 * Clamp (x, y) into the UNLOCKED region — the UNION of unlocked biome rects, each
 * inset by `margin` (the player's radius) on its CLOSED sides only (open/seam
 * sides aren't inset, so the player crosses a shared border freely). Writes into
 * `out` and returns it — iterates the ≤4 cached rects with local primitives, no
 * allocation, safe every sim step.
 *
 * Confining to the union (not its bounding box) is the fix for the L-shaped
 * unlock: the empty diagonal corner is inside NO unlocked rect, so it's denied.
 * A point inside any inset rect is returned unchanged; otherwise it's clamped to
 * the NEAREST point on the union.
 */
export function clampToUnlocked(
  world: World,
  x: number,
  y: number,
  margin: number,
  out: Vec2,
): Vec2 {
  const rects = world.unlockedRects;
  let bestX = x;
  let bestY = y;
  let bestD = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const loX = r.openMinX ? r.minX : r.minX + margin;
    const hiX = r.openMaxX ? r.maxX : r.maxX - margin;
    const loY = r.openMinY ? r.minY : r.minY + margin;
    const hiY = r.openMaxY ? r.maxY : r.maxY - margin;
    const cx = x < loX ? loX : x > hiX ? hiX : x;
    const cy = y < loY ? loY : y > hiY ? hiY : y;
    if (cx === x && cy === y) {
      out.x = x; // inside this rect (incl. seams) — unchanged
      out.y = y;
      return out;
    }
    const dx = x - cx;
    const dy = y - cy;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      bestX = cx;
      bestY = cy;
    }
  }
  out.x = bestX;
  out.y = bestY;
  return out;
}

/**
 * Clamp (x, y) into a SINGLE biome's footprint, inset by `margin`. Used to keep
 * a roaming animal inside its home biome (animals stay in their biome; the
 * player's clamp is the unlocked-region one above). Writes into `out`, no alloc.
 */
export function clampToBiome(
  world: World,
  id: BiomeId,
  x: number,
  y: number,
  margin: number,
  out: Vec2,
): Vec2 {
  const r = world.biomes[id].def.bounds;
  out.x = clamp(x, r.minX + margin, r.maxX - margin);
  out.y = clamp(y, r.minY + margin, r.maxY - margin);
  return out;
}

/** Would (x, y) be moved by `clampToUnlocked` — i.e. is the point at/over the
 *  unlocked boundary? DIAGNOSTIC (the ?debug readout); not read by the sim. Uses
 *  the SAME per-rect containment as the clamp, so the readout never lies. */
export function clampActive(world: World, x: number, y: number, margin: number): boolean {
  const rects = world.unlockedRects;
  for (let i = 0; i < rects.length; i++) {
    if (insetContains(rects[i], margin, x, y)) return false; // inside → not moved
  }
  return true;
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
