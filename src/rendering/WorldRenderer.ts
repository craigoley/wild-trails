/**
 * Builds the finite world from the biome graph: one ground plane per biome, a
 * faint grid, a fog veil over each LOCKED biome, and a low boundary wall along
 * each edge between the unlocked region and a locked neighbour.
 *
 * Locked-but-adjacent biomes render VISIBLY (darkened ground + a translucent
 * veil) so the player can see the Woodland / Wetland / Highlands across the
 * boundary — the metroidvania breadcrumb — while the wall makes "can't go there
 * yet" unmistakable.
 *
 * Built ONCE: every biome is static, so nothing here runs per frame and no
 * geometry/material is allocated in the loop. READ-ONLY with respect to game
 * state.
 */

import {
  BoxGeometry,
  GridHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Scene,
} from 'three';
import type { World } from '../game/World';
import { isUnlocked, sharedBorder } from '../game/World';
import { BIOME_RENDER, PALETTE } from '../utils/constants';
import type { Rect } from '../utils/math';

/** Darken a 0xRRGGBB colour by `f` (0..1), per channel. */
function dim(hex: number, f: number): number {
  const r = Math.round(((hex >> 16) & 0xff) * f);
  const g = Math.round(((hex >> 8) & 0xff) * f);
  const b = Math.round((hex & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

const rectW = (r: Rect): number => r.maxX - r.minX;
const rectH = (r: Rect): number => r.maxY - r.minY;
const rectCX = (r: Rect): number => (r.minX + r.maxX) / 2;
const rectCY = (r: Rect): number => (r.minY + r.maxY) / 2;

export class WorldRenderer {
  private readonly group = new Group();

  constructor(scene: Scene, world: World) {
    for (const id of world.order) {
      const biome = world.biomes[id];
      const r = biome.def.bounds;

      // Ground plane, sized + positioned to the biome's footprint. Locked biomes
      // are darkened so they read as out of reach.
      const color = biome.unlocked
        ? biome.def.color
        : dim(biome.def.color, BIOME_RENDER.lockedDim);
      const ground = new Mesh(
        new PlaneGeometry(rectW(r), rectH(r)),
        new MeshStandardMaterial({ color, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(rectCX(r), 0, rectCY(r));
      this.group.add(ground);

      // Fog veil over locked biomes — a translucent dark plane just above the
      // ground, so the locked land is visible but plainly "fogged".
      if (!biome.unlocked) {
        const veil = new Mesh(
          new PlaneGeometry(rectW(r), rectH(r)),
          new MeshBasicMaterial({
            color: PALETTE.fog,
            transparent: true,
            opacity: BIOME_RENDER.fogOpacity,
            depthWrite: false,
          }),
        );
        veil.rotation.x = -Math.PI / 2;
        veil.position.set(rectCX(r), BIOME_RENDER.fogY, rectCY(r));
        this.group.add(veil);
      }
    }

    // Boundary walls: for every unlocked biome, wall off each adjacent biome that
    // is still locked, along the edge the two share.
    for (const id of world.order) {
      if (!isUnlocked(world, id)) continue;
      for (const adj of world.biomes[id].def.adjacent) {
        if (isUnlocked(world, adj)) continue;
        const edge = sharedBorder(world.biomes[id].def.bounds, world.biomes[adj].def.bounds);
        if (edge) this.addWall(edge);
      }
    }

    this.addGrid(world);
    scene.add(this.group);
  }

  /** A low, semi-transparent slab standing on a shared biome edge. Axis-aligned:
   *  a horizontal edge (constant y) runs along x; a vertical edge runs along z. */
  private addWall(edge: { x1: number; y1: number; x2: number; y2: number }): void {
    const len = Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1);
    const horizontal = edge.y1 === edge.y2;
    const w = horizontal ? len : BIOME_RENDER.wallThickness;
    const d = horizontal ? BIOME_RENDER.wallThickness : len;
    const wall = new Mesh(
      new BoxGeometry(w, BIOME_RENDER.wallHeight, d),
      new MeshBasicMaterial({
        color: PALETTE.boundary,
        transparent: true,
        opacity: BIOME_RENDER.wallOpacity,
        depthWrite: false,
      }),
    );
    wall.position.set((edge.x1 + edge.x2) / 2, BIOME_RENDER.wallHeight / 2, (edge.y1 + edge.y2) / 2);
    this.group.add(wall);
  }

  /** One faint grid covering the bounding box of every biome (one line per unit). */
  private addGrid(world: World): void {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of world.order) {
      const r = world.biomes[id].def.bounds;
      minX = Math.min(minX, r.minX);
      minY = Math.min(minY, r.minY);
      maxX = Math.max(maxX, r.maxX);
      maxY = Math.max(maxY, r.maxY);
    }
    const span = Math.max(maxX - minX, maxY - minY);
    const grid = new GridHelper(span, Math.round(span), PALETTE.groundLine, PALETTE.groundLine);
    grid.position.set((minX + maxX) / 2, 0, (minY + maxY) / 2);
    this.group.add(grid);
  }
}
