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
 * Static props (grid, cover, tracking signs) are built ONCE; the
 * unlock-dependent visuals (ground dim, fog veil, boundary walls) are rebuilt
 * on biome unlock via `refresh` — rare, never per frame. READ-ONLY with
 * respect to game state.
 */

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  GridHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Scene,
} from 'three';
import type { World } from '../game/World';
import { walledEdges } from './lockedRegions';
import {
  BIOME_RENDER,
  HIDING_RENDER,
  SIGN_RENDER,
  TRACK_SIGNS,
  type HidingSpotDef,
  PALETTE,
} from '../utils/constants';
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
  /** Unlock-DEPENDENT visuals (per-biome ground dim + fog veil + boundary walls).
   *  Rebuilt by `refresh` when a biome unlocks; static props (grid, cover, signs)
   *  live in `group` and are built once. */
  private readonly dynamic = new Group();

  constructor(scene: Scene, world: World) {
    this.group.add(this.dynamic);

    // Static props — built ONCE (unlock-independent): cover, tracking signs, grid.
    for (const spot of world.hidingSpots) this.addGrassCluster(spot);
    this.addTrackSigns();
    this.addGrid(world);

    // The locked-region visuals — built from the current unlock state, and
    // rebuilt on unlock (see refresh) so a mid-session unlock can't leave them stale.
    this.rebuildDynamic(world);

    scene.add(this.group);
  }

  /**
   * Regenerate the locked-region visuals (ground dim + fog veil + boundary walls)
   * from the CURRENT unlock state. Call after a biome unlocks (rare — not per
   * frame) so the stale wall/fog/dim at the now-open seam clears while gates at
   * still-locked edges remain. The constructor calls the SAME builder, so refresh
   * and a fresh construct can't drift.
   */
  refresh(world: World): void {
    this.rebuildDynamic(world);
  }

  /** Dispose the old dynamic meshes (no GPU leak on repeated unlocks) and rebuild
   *  the ground/fog/walls for the current unlock state. The shared build step. */
  private rebuildDynamic(world: World): void {
    for (const child of this.dynamic.children) {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        (child.material as MeshBasicMaterial | MeshStandardMaterial).dispose();
      }
    }
    this.dynamic.clear();

    for (const id of world.order) {
      const biome = world.biomes[id];
      const r = biome.def.bounds;

      // Ground plane. Locked biomes are darkened so they read as out of reach.
      const color = biome.unlocked
        ? biome.def.color
        : dim(biome.def.color, BIOME_RENDER.lockedDim);
      const ground = new Mesh(
        new PlaneGeometry(rectW(r), rectH(r)),
        new MeshStandardMaterial({ color, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(rectCX(r), 0, rectCY(r));
      this.dynamic.add(ground);

      // Fog veil over locked biomes — a translucent dark plane above the ground.
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
        this.dynamic.add(veil);
      }
    }

    // Boundary walls: one per unlocked -> LOCKED adjacency (the shared edge set).
    for (const w of walledEdges(world)) this.addWall(w.edge);
  }

  /** A little cluster of flat dark dug-earth marks per track sign (zero-asset,
   *  deterministic golden-angle spread — matches the hiding-spot prop pattern). */
  private addTrackSigns(): void {
    const markGeo = new CylinderGeometry(SIGN_RENDER.markRadius, SIGN_RENDER.markRadius, SIGN_RENDER.markHeight, 6);
    const markMat = new MeshStandardMaterial({ color: SIGN_RENDER.color, roughness: 1 });
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (const sign of TRACK_SIGNS) {
      const fill = sign.radius * SIGN_RENDER.spread;
      for (let i = 0; i < SIGN_RENDER.markCount; i++) {
        const r = fill * Math.sqrt((i + 0.5) / SIGN_RENDER.markCount);
        const a = i * golden;
        const mark = new Mesh(markGeo, markMat);
        mark.position.set(sign.x + Math.cos(a) * r, SIGN_RENDER.markHeight / 2, sign.y + Math.sin(a) * r);
        this.group.add(mark);
      }
    }
  }

  /** A cluster of thin tall-grass blades filling a hiding spot's radius. The
   *  blades are placed deterministically (golden-angle spiral) so the cover
   *  reads as a soft tuft without any RNG. */
  private addGrassCluster(spot: HidingSpotDef): void {
    const bladeGeo = new ConeGeometry(HIDING_RENDER.bladeRadius, HIDING_RENDER.bladeHeight, 5);
    const bladeMat = new MeshStandardMaterial({ color: HIDING_RENDER.color, roughness: 1 });
    const fill = spot.radius * HIDING_RENDER.spread;
    const golden = Math.PI * (3 - Math.sqrt(5)); // golden angle
    for (let i = 0; i < HIDING_RENDER.bladeCount; i++) {
      // Even radial spread: r grows as sqrt(i/n) so blades aren't bunched centre.
      const r = fill * Math.sqrt((i + 0.5) / HIDING_RENDER.bladeCount);
      const a = i * golden;
      const blade = new Mesh(bladeGeo, bladeMat);
      blade.position.set(spot.x + Math.cos(a) * r, HIDING_RENDER.bladeHeight / 2, spot.y + Math.sin(a) * r);
      this.group.add(blade);
    }
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
    this.dynamic.add(wall);
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
