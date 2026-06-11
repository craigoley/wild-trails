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
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  GridHelper,
  Group,
  InstancedMesh,
  Matrix4,
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
  BIOMES,
  HIDING_RENDER,
  FERN_RENDER,
  PINE_RENDER,
  REED_RENDER,
  ROCK_RENDER,
  SIGN_RENDER,
  SUPPLY_POSTS,
  SUPPLY_RENDER,
  TRACK_SIGNS,
  WATER_RENDER,
  THRIVING,
  type HidingSpotDef,
  type SupplyPostDef,
  type WaterDef,
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

/**
 * The through-line warmth GRADE (§4.3 TL1) — sibling to `dim`. Lerp a biome's ground colour from
 * a SUBTLE muted/cooler baseline at `thriving=0` (saturation + lightness scaled down) to its full,
 * rich colour at `thriving=1`. ⚠️ The t=0 baseline is CALM (≈0.82 sat), NOT the 0.45 locked-dim —
 * an unstudied biome still looks good, just stiller, with room to warm as you study it. Cosmetic.
 */
export function warmthGrade(hex: number, thriving: number): number {
  const t = Math.max(0, Math.min(1, thriving));
  const c = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const satScale = THRIVING.grade.minSaturation + (1 - THRIVING.grade.minSaturation) * t;
  const lightScale = THRIVING.grade.minLightness + (1 - THRIVING.grade.minLightness) * t;
  c.setHSL(hsl.h, hsl.s * satScale, hsl.l * lightScale);
  return c.getHex();
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

  /** §4.3 TL1 — per-biome "thriving" 0..1 (the warmth grade input). Set by `setThriving` from
   *  the journal; defaults to 0 (the muted baseline) until the first update. Cosmetic only. */
  private thriving: Record<string, number> = {};
  /** Unlocked biomes' ground materials + base colours, so `setThriving` can re-grade them in
   *  place (no rebuild) when thriving changes on a catch. */
  private readonly groundMats = new Map<string, { mat: MeshStandardMaterial; base: number }>();

  constructor(scene: Scene, world: World) {
    this.group.add(this.dynamic);

    // Static props — built ONCE (unlock-independent): water, cover, signs, grid, the pine scatter.
    for (const w of world.water) this.addWater(w);
    for (const spot of world.hidingSpots) this.addCover(spot);
    this.addTrackSigns();
    this.addPineForest(); // §4.2 — the dense pine scatter (instanced; the locked fog veils it until open)
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

  /**
   * §4.3 TL1 — update the per-biome warmth grade (cosmetic). Called when thriving changes (a
   * catch newly catalogues a species), it re-grades each unlocked biome's ground colour IN PLACE
   * — no dispose/rebuild, cheap enough per catch. The full `refresh` is reserved for unlock
   * changes (seam/fog/wall rebuilds). READS the passed values; the renderer never reads the journal.
   */
  setThriving(thriving: Record<string, number>): void {
    this.thriving = thriving;
    for (const [id, { mat, base }] of this.groundMats) {
      mat.color.setHex(warmthGrade(base, thriving[id] ?? 0));
    }
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
    this.groundMats.clear(); // the old ground materials are disposed above; rebuild the map

    for (const id of world.order) {
      const biome = world.biomes[id];
      const r = biome.def.bounds;

      // Ground plane. Locked biomes are darkened (out of reach); UNLOCKED biomes carry the §4.3
      // warmth grade (muted when unstudied -> rich as it thrives) — a sibling to the locked dim.
      const color = biome.unlocked
        ? warmthGrade(biome.def.color, this.thriving[id] ?? 0)
        : dim(biome.def.color, BIOME_RENDER.lockedDim);
      const groundMat = new MeshStandardMaterial({ color, roughness: 1 });
      const ground = new Mesh(new PlaneGeometry(rectW(r), rectH(r)), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(rectCX(r), 0, rectCY(r));
      this.dynamic.add(ground);
      if (biome.unlocked) this.groundMats.set(id, { mat: groundMat, base: biome.def.color });

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

    // Field Supply posts — one per UNLOCKED biome. Rebuilt here (the dynamic group),
    // so a mid-session unlock makes the new biome's post appear via refresh (#24 path).
    for (const post of SUPPLY_POSTS) {
      if (world.biomes[post.biome].unlocked) this.addSupplyPost(post);
    }
  }

  /** A procedural zero-asset supply hut: timber walls (a doorway gap in the front)
   *  under a pyramid roof. A walk-in marker — it's a proximity zone, not collision. */
  private addSupplyPost(post: SupplyPostDef): void {
    const s = SUPPLY_RENDER;
    const half = s.size / 2;
    const cx = post.x;
    const cz = post.y; // game y -> three z
    const wallMat = new MeshStandardMaterial({ color: s.wallColor, roughness: 1 });
    const wall = (w: number, d: number, dx: number, dz: number): void => {
      const m = new Mesh(new BoxGeometry(w, s.wallHeight, d), wallMat);
      m.position.set(cx + dx, s.wallHeight / 2, cz + dz);
      this.dynamic.add(m);
    };
    // Back + the two side walls (full).
    wall(s.size, s.wallThickness, 0, half);
    wall(s.wallThickness, s.size, -half, 0);
    wall(s.wallThickness, s.size, half, 0);
    // Front wall (-z, facing the approach) with a centred doorway gap: two segments.
    const seg = (s.size - s.doorWidth) / 2;
    const off = s.doorWidth / 2 + seg / 2;
    wall(seg, s.wallThickness, -off, -half);
    wall(seg, s.wallThickness, off, -half);
    // Pyramid roof (a 4-sided cone, rotated 45° so its faces align with the walls).
    const roof = new Mesh(
      new ConeGeometry(s.size * s.roofRadiusFactor + s.roofOverhang, s.roofHeight, 4),
      new MeshStandardMaterial({ color: s.roofColor, roughness: 1 }),
    );
    roof.position.set(cx, s.wallHeight + s.roofHeight / 2, cz);
    roof.rotation.y = Math.PI / 4;
    this.dynamic.add(roof);
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

  /** A WATER region (slice W) — a flat translucent teal disc on the ground (zero-asset).
   *  Static, built once like cover; the locked-region fog veils it until the wetland opens. */
  private addWater(w: WaterDef): void {
    const disc = new Mesh(
      new CircleGeometry(w.radius, 40),
      new MeshBasicMaterial({ color: WATER_RENDER.color, transparent: true, opacity: WATER_RENDER.opacity }),
    );
    disc.rotation.x = -Math.PI / 2; // lay it flat on the ground plane
    disc.position.set(w.x, WATER_RENDER.y, w.y);
    this.group.add(disc);
  }

  /** §4.2 — the PINE FOREST scatter: a deterministic jittered grid of zero-asset pines (a thin trunk
   *  + a canopy cone) across the Pine cell, with a CLEARING kept at the centre (the play space), built
   *  as TWO InstancedMeshes → ~2 draw calls for the whole forest (mobile-safe; matrices set once, no
   *  per-frame cost). Static like cover; the locked fog veils it until the forest opens. ⚠️ ATMOSPHERE
   *  ONLY — not cover, not collision; the sim never sees it. Entities draw OVER it (the legibility fix),
   *  so a pine can never hide a catch. Deterministic (a sin-hash, no RNG) → the L2 capture is stable. */
  private addPineForest(): void {
    const P = PINE_RENDER;
    const r = BIOMES.pineforest.bounds;
    const cx = (r.minX + r.maxX) / 2;
    const cz = (r.minY + r.maxY) / 2;
    const w = r.maxX - r.minX;
    const d = r.maxY - r.minY;
    const hash = (a: number, b: number): number => {
      const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    // Collect the kept placements on a jittered grid, skipping the central clearing.
    const trees: { x: number; z: number; h: number }[] = [];
    for (let gx = 0; gx < P.gridN; gx++) {
      for (let gz = 0; gz < P.gridN; gz++) {
        const x = r.minX + ((gx + 0.5 + (hash(gx + 1, gz + 1) - 0.5) * P.jitter) / P.gridN) * w;
        const z = r.minY + ((gz + 0.5 + (hash(gx + 7, gz + 3) - 0.5) * P.jitter) / P.gridN) * d;
        if (Math.hypot(x - cx, z - cz) < P.clearingRadius) continue; // keep the play centre clear
        trees.push({ x, z, h: P.minHeight + hash(gx + 11, gz + 13) * (P.maxHeight - P.minHeight) });
      }
    }
    const n = trees.length;
    if (n === 0) return;

    // Unit-height geometries, scaled per instance → two draw calls for the grove.
    const trunkGeo = new CylinderGeometry(P.trunkRadius, P.trunkRadius, 1, 5);
    const canopyGeo = new ConeGeometry(P.canopyRadius, 1, 6);
    const trunkMat = new MeshStandardMaterial({ color: P.trunkColor, roughness: 1 });
    const canopyMat = new MeshStandardMaterial({ color: P.canopyColor, roughness: 1, flatShading: true });
    const trunks = new InstancedMesh(trunkGeo, trunkMat, n);
    const canopies = new InstancedMesh(canopyGeo, canopyMat, n);
    const m = new Matrix4();
    for (let i = 0; i < n; i++) {
      const t = trees[i];
      const trunkH = t.h * P.trunkFraction;
      const canopyH = t.h - trunkH;
      m.makeScale(1, trunkH, 1);
      m.setPosition(t.x, trunkH / 2, t.z);
      trunks.setMatrixAt(i, m);
      m.makeScale(1, canopyH, 1);
      m.setPosition(t.x, trunkH + canopyH / 2, t.z);
      canopies.setMatrixAt(i, m);
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    this.group.add(trunks);
    this.group.add(canopies);
  }

  /** Build a cover prop in the shape that fits its biome (the kind dispatch). The
   *  stealth mechanic treats every kind identically — only the look differs. */
  private addCover(spot: HidingSpotDef): void {
    switch (spot.kind) {
      case 'grass':
        this.addGrassCluster(spot);
        break;
      case 'ferns':
        this.addFernCluster(spot);
        break;
      case 'reeds':
        this.addReedCluster(spot);
        break;
      case 'rocks':
        this.addRockCluster(spot);
        break;
    }
  }

  /** Even golden-angle spiral radius for the i-th of n props in a spot (shared
   *  placement so every cover kind fills its radius the same deterministic way). */
  private static spiral(spot: HidingSpotDef, spread: number, n: number, i: number): { x: number; z: number } {
    const fill = spot.radius * spread;
    const r = fill * Math.sqrt((i + 0.5) / n);
    const a = i * (Math.PI * (3 - Math.sqrt(5))); // golden angle
    return { x: spot.x + Math.cos(a) * r, z: spot.y + Math.sin(a) * r };
  }

  /** Woodland bracken — low arching fronds (cones tilted outward so they read as
   *  understory, not upright grass). Same deterministic spiral fill. */
  private addFernCluster(spot: HidingSpotDef): void {
    const geo = new ConeGeometry(FERN_RENDER.frondRadius, FERN_RENDER.frondHeight, 5);
    const mat = new MeshStandardMaterial({ color: FERN_RENDER.color, roughness: 1 });
    for (let i = 0; i < FERN_RENDER.frondCount; i++) {
      const p = WorldRenderer.spiral(spot, FERN_RENDER.spread, FERN_RENDER.frondCount, i);
      const a = i * (Math.PI * (3 - Math.sqrt(5)));
      const frond = new Mesh(geo, mat);
      frond.position.set(p.x, FERN_RENDER.frondHeight / 2, p.z);
      frond.rotation.z = Math.cos(a) * FERN_RENDER.tiltRad; // arch outward from centre
      frond.rotation.x = Math.sin(a) * FERN_RENDER.tiltRad;
      this.group.add(frond);
    }
  }

  /** Wetland reeds — tall thin vertical blades, a brown cattail head on every Nth. */
  private addReedCluster(spot: HidingSpotDef): void {
    const bladeGeo = new CylinderGeometry(REED_RENDER.bladeRadius, REED_RENDER.bladeRadius, REED_RENDER.bladeHeight, 5);
    const bladeMat = new MeshStandardMaterial({ color: REED_RENDER.color, roughness: 1 });
    const headGeo = new CylinderGeometry(REED_RENDER.cattailRadius, REED_RENDER.cattailRadius, REED_RENDER.cattailHeight, 6);
    const headMat = new MeshStandardMaterial({ color: REED_RENDER.cattailColor, roughness: 1 });
    for (let i = 0; i < REED_RENDER.bladeCount; i++) {
      const p = WorldRenderer.spiral(spot, REED_RENDER.spread, REED_RENDER.bladeCount, i);
      const blade = new Mesh(bladeGeo, bladeMat);
      blade.position.set(p.x, REED_RENDER.bladeHeight / 2, p.z);
      this.group.add(blade);
      if (i % REED_RENDER.cattailEvery === 0) {
        const head = new Mesh(headGeo, headMat);
        head.position.set(p.x, REED_RENDER.bladeHeight + REED_RENDER.cattailHeight / 2, p.z);
        this.group.add(head);
      }
    }
  }

  /** Highlands boulders — a ground-hugging cluster of low grey rocks whose sizes
   *  vary deterministically with index (no RNG). */
  private addRockCluster(spot: HidingSpotDef): void {
    const mat = new MeshStandardMaterial({ color: ROCK_RENDER.color, roughness: 1 });
    for (let i = 0; i < ROCK_RENDER.rockCount; i++) {
      const p = WorldRenderer.spiral(spot, ROCK_RENDER.spread, ROCK_RENDER.rockCount, i);
      const t = (i % 3) / 2; // 0, 0.5, 1 — deterministic size variation across the cluster
      const size = ROCK_RENDER.minSize + (ROCK_RENDER.maxSize - ROCK_RENDER.minSize) * t;
      const rock = new Mesh(new BoxGeometry(size, size * ROCK_RENDER.heightRatio, size), mat);
      rock.position.set(p.x, (size * ROCK_RENDER.heightRatio) / 2, p.z);
      rock.rotation.y = i * (Math.PI * (3 - Math.sqrt(5))); // vary facing
      this.group.add(rock);
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
