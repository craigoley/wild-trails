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
  IcosahedronGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
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
  HEDGE_RENDER,
  COPSE_RENDER,
  REED_RENDER,
  ROCK_RENDER,
  SIGN_RENDER,
  SUPPLY_POSTS,
  SUPPLY_RENDER,
  TRACK_SIGNS,
  WATER_RENDER,
  THRIVING,
  SEASONAL,
  SNOW_BIOMES,
  SEASONAL_FLORA,
  SEASONAL_DRESSING,
  type BiomeId,
  type HidingSpotDef,
  type Season,
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

/**
 * §4.6 D1a — the SEASONAL grade: shift a biome's ground colour by season. A photographic colour grade
 * (a saturation scale + a blend toward the season's TINT) so each season reads as its mood while every
 * biome KEEPS its identity (a uniform hue rotation would wreck non-green biomes). ⚠️ SUMMER is the
 * IDENTITY (tintAmount 0, satScale 1) → byte-for-byte today's colour, so a summer-pinned scene's L2
 * baseline never moves. It COMPOSES with warmthGrade (see `gradedGround`) — the world is BOTH seasonal
 * AND thriving, never one replacing the other. Cosmetic; not per-frame (only on season change / unlock).
 */
export function seasonalGrade(hex: number, season: Season): number {
  const g = SEASONAL.grade[season];
  const c = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s * g.satScale, hsl.l); // the seasonal saturation wash (winter desaturates)
  if (g.tintAmount > 0) c.lerp(new Color(g.tint), g.tintAmount); // blend toward the seasonal tint
  return c.getHex();
}

/** The composed ground colour — BOTH seasonal AND thriving: warmthGrade(seasonalGrade(base), thriving).
 *  The single source for every ground re-grade (rebuild / setThriving / setSeason) so they can't drift. */
export function gradedGround(base: number, season: Season, thriving: number): number {
  return warmthGrade(seasonalGrade(base, season), thriving);
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
  /** §4.6 D1a — the current real-world season (the re-grade input). Defaults to 'summer' (the
   *  identity grade) until `setSeason`; the boundary sets it from the real date / the ?season= hook. */
  private season: Season = 'summer';
  /** Unlocked biomes' ground materials + base colours, so `setThriving` / `setSeason` can re-grade
   *  them in place (no rebuild) when thriving or the season changes. */
  private readonly groundMats = new Map<string, { mat: MeshStandardMaterial; base: number }>();
  /** §4.6 D1a — the winter SNOW overlay planes (one per unlocked snow-opt-in biome), built in
   *  rebuildDynamic and toggled visible by `setSeason` (visible only in winter). */
  private snowOverlays: Mesh[] = [];
  /** §4.6 D1c-i — the COVER/FLORA prop materials, tracked (like groundMats) so `setSeason` re-tints the
   *  foliage by season (gold/frost/fresh). Built ONCE with the static cover props; FOLIAGE biomes only
   *  (rocks/pines are excluded — austere/evergreen). */
  private readonly propMats: { mat: MeshStandardMaterial; base: number }[] = [];
  /** §4.6 D1c-i — the spring BLOOM accent meshes (meadow), toggled visible by `setSeason`. */
  private readonly bloomProps: Mesh[] = [];
  /** §4.6 D1c-i — the grass blades hidden in WINTER for a thinner frosted tuft (toggled by `setSeason`). */
  private readonly winterThinProps: Mesh[] = [];

  constructor(scene: Scene, world: World) {
    this.group.add(this.dynamic);

    // §ground-seam — the static BASE-GROUND plane under the WHOLE world (built FIRST, sits below
    // everything). Fills the bare void past a biome edge with a calm ground tone so the camera never
    // sees the stark dark background there (the diagonal void-seam). Unlock-independent.
    this.addBaseGround(world);

    // Static props — built ONCE (unlock-independent): water, cover, signs, grid, the pine scatter.
    for (const w of world.water) this.addWater(w);
    for (const spot of world.hidingSpots) this.addCover(spot);
    this.addTrackSigns();
    this.addPineForest(); // §4.2 — the dense pine scatter (instanced; the locked fog veils it until open)
    this.addHedgerow(); // §hedgerow — the hedge lining the corridor (a walk-through lane kept clear)
    this.addCopse(); // §hedgerow — the isolated hazel stand (a clearing kept clear)
    this.addDesert(); // §desert — the sparse Sonoran scatter (instanced; the locked fog veils it until open)
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
      mat.color.setHex(gradedGround(base, this.season, thriving[id] ?? 0));
    }
  }

  /**
   * §4.6 D1a — set the real-world SEASON (cosmetic). Re-grades every unlocked biome's ground IN PLACE
   * (the proven setThriving path) through the composed seasonal+thriving grade, and toggles the winter
   * snow overlays. Called once at boot (and on focus) from the boundary — never per frame. READS the
   * passed season; the renderer never reads the clock/date (that's the boundary's job). VISUAL ONLY —
   * the season touches nothing in the sim (spawn/catch/journal): D1a is the re-grade, the emphasis is D1b.
   */
  setSeason(season: Season): void {
    this.season = season;
    for (const [id, { mat, base }] of this.groundMats) {
      mat.color.setHex(gradedGround(base, season, this.thriving[id] ?? 0));
    }
    for (const snow of this.snowOverlays) snow.visible = season === 'winter';
    // §4.6 D1c-i — re-dress the cover/flora: re-tint the foliage (the proven seasonalGrade, in place),
    // and toggle the seasonal accents. ⚠️ summer = identity → props return to today's look (baselines
    // don't move). The per-biome map (SEASONAL_FLORA) already excluded the rock/cave/alpine props.
    for (const { mat, base } of this.propMats) mat.color.setHex(seasonalGrade(base, season));
    // ⚠️ Bloom is SPRING-ONLY (not summer): summer must stay byte-for-byte today's look so the existing
    // 10 summer baselines don't move (the pin). Spring is the iconic bloom anyway; summer = lush green.
    for (const bloom of this.bloomProps) bloom.visible = season === 'spring';
    for (const blade of this.winterThinProps) blade.visible = season !== 'winter';
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
    this.snowOverlays = []; // the old snow planes were disposed above; rebuild the list

    for (const id of world.order) {
      const biome = world.biomes[id];
      const r = biome.def.bounds;

      // Ground plane. Locked biomes are darkened (out of reach); UNLOCKED biomes carry the §4.3
      // warmth grade (muted when unstudied -> rich as it thrives) — a sibling to the locked dim.
      const color = biome.unlocked
        ? gradedGround(biome.def.color, this.season, this.thriving[id] ?? 0)
        : dim(biome.def.color, BIOME_RENDER.lockedDim);
      const groundMat = new MeshStandardMaterial({ color, roughness: 1 });
      const ground = new Mesh(new PlaneGeometry(rectW(r), rectH(r)), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(rectCX(r), 0, rectCY(r));
      this.dynamic.add(ground);
      if (biome.unlocked) this.groundMats.set(id, { mat: groundMat, base: biome.def.color });

      // §4.6 D1a — the winter SNOW overlay (a translucent white plane over the ground; the fog-veil
      // pattern). Built for every unlocked snow-opt-in biome, visible ONLY in winter (setSeason toggles).
      if (biome.unlocked && SNOW_BIOMES[id]) {
        const snow = new Mesh(
          new PlaneGeometry(rectW(r), rectH(r)),
          new MeshBasicMaterial({
            color: SEASONAL.snow.color,
            transparent: true,
            opacity: SEASONAL.snow.opacity,
            depthWrite: false,
          }),
        );
        snow.rotation.x = -Math.PI / 2;
        snow.position.set(rectCX(r), SEASONAL.snow.y, rectCY(r));
        snow.visible = this.season === 'winter';
        this.dynamic.add(snow);
        this.snowOverlays.push(snow);
      }

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

  /** §hedgerow — the HEDGE that lines the corridor: a dense scatter of low bushes across the ribbon, with
   *  a clear central LANE (|x| < laneHalf) kept bush-free so the player walks meadow ↔ copse through the
   *  gap. Instanced (one draw call), deterministic (a sin-hash). Entities draw OVER it (depthTest:false),
   *  and the lane keeps the play clear — a hedge can never hide a catch (the Pine #109 legibility). */
  private addHedgerow(): void {
    const H = HEDGE_RENDER;
    const r = BIOMES.hedgerow.bounds;
    const w = r.maxX - r.minX;
    const d = r.maxY - r.minY;
    const cx = (r.minX + r.maxX) / 2;
    const hash = (a: number, b: number): number => {
      const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    const bushes: { x: number; z: number; h: number }[] = [];
    for (let gx = 0; gx < H.gridN; gx++) {
      for (let gz = 0; gz < H.rowsN; gz++) {
        const x = r.minX + ((gx + 0.5 + (hash(gx + 1, gz + 1) - 0.5) * H.jitter) / H.gridN) * w;
        const z = r.minY + ((gz + 0.5 + (hash(gx + 5, gz + 9) - 0.5) * H.jitter) / H.rowsN) * d;
        if (Math.abs(x - cx) < H.laneHalf) continue; // keep the central walk-through lane clear
        bushes.push({ x, z, h: H.minHeight + hash(gx + 11, gz + 3) * (H.maxHeight - H.minHeight) });
      }
    }
    const n = bushes.length;
    if (n === 0) return;
    const bushGeo = new IcosahedronGeometry(H.bushRadius, 1); // a low faceted bush, scaled per instance
    const bushMat = new MeshStandardMaterial({ color: H.color, roughness: 1, flatShading: true });
    const mesh = new InstancedMesh(bushGeo, bushMat, n);
    const m = new Matrix4();
    for (let i = 0; i < n; i++) {
      const b = bushes[i];
      m.makeScale(1, b.h, 1); // squash to the hedge height (a low wall of green, not a ball)
      m.setPosition(b.x, b.h * H.bushRadius, b.z);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  /** §hedgerow — the HAZEL COPSE: a sparse stand of multi-stem hazel (a short trunk + a broad rounded
   *  deciduous canopy), with a CLEARING at the centre (the play space). A REMNANT, distinct from the
   *  conifer Pine + the dense Woodland. Instanced + deterministic; entities draw over it. */
  private addCopse(): void {
    const C = COPSE_RENDER;
    const r = BIOMES.copse.bounds;
    const cx = (r.minX + r.maxX) / 2;
    const cz = (r.minY + r.maxY) / 2;
    const w = r.maxX - r.minX;
    const d = r.maxY - r.minY;
    const hash = (a: number, b: number): number => {
      const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    const trees: { x: number; z: number; h: number }[] = [];
    for (let gx = 0; gx < C.gridN; gx++) {
      for (let gz = 0; gz < C.gridN; gz++) {
        const x = r.minX + ((gx + 0.5 + (hash(gx + 2, gz + 4) - 0.5) * C.jitter) / C.gridN) * w;
        const z = r.minY + ((gz + 0.5 + (hash(gx + 6, gz + 8) - 0.5) * C.jitter) / C.gridN) * d;
        if (Math.hypot(x - cx, z - cz) < C.clearingRadius) continue; // keep the coppice glade clear
        trees.push({ x, z, h: C.minHeight + hash(gx + 13, gz + 7) * (C.maxHeight - C.minHeight) });
      }
    }
    const n = trees.length;
    if (n === 0) return;
    const trunkGeo = new CylinderGeometry(C.trunkRadius, C.trunkRadius, 1, 5);
    const canopyGeo = new IcosahedronGeometry(C.canopyRadius, 1); // a broad faceted deciduous canopy (vs the pine cone)
    const trunkMat = new MeshStandardMaterial({ color: C.trunkColor, roughness: 1 });
    const canopyMat = new MeshStandardMaterial({ color: C.canopyColor, roughness: 1, flatShading: true });
    const trunks = new InstancedMesh(trunkGeo, trunkMat, n);
    const canopies = new InstancedMesh(canopyGeo, canopyMat, n);
    const m = new Matrix4();
    for (let i = 0; i < n; i++) {
      const t = trees[i];
      const trunkH = t.h * C.trunkFraction;
      const canopyH = t.h - trunkH;
      m.makeScale(1, trunkH, 1);
      m.setPosition(t.x, trunkH / 2, t.z);
      trunks.setMatrixAt(i, m);
      m.makeScale(1, canopyH, 1);
      m.setPosition(t.x, trunkH + canopyH * C.canopyRadius, t.z);
      canopies.setMatrixAt(i, m);
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    this.group.add(trunks);
    this.group.add(canopies);
  }

  /** §desert — the SONORAN DESERT scatter: a SPARSE deterministic jittered grid of zero-asset desert props
   *  across the Desert cell — tall saguaro cacti (a vertical green column + a couple of short side arms) and a
   *  few low tan boulders. Built as InstancedMeshes (~2 draw calls; matrices set once, no per-frame cost). Open
   *  desert reads easily, so this is FAR sparser than the pine scatter (legibility is free). Static like the pine
   *  forest; the locked fog veils it until the desert opens. ⚠️ ATMOSPHERE ONLY — not cover, not collision; the
   *  sim never sees it. Entities draw OVER it, so a saguaro can never hide a catch. Deterministic (a sin-hash,
   *  no RNG) → the L2 capture is stable. */
  private addDesert(): void {
    const r = BIOMES.desert.bounds;
    const w = r.maxX - r.minX;
    const d = r.maxY - r.minY;
    const hash = (a: number, b: number): number => {
      const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };

    // SAGUARO cacti — sparse 3×3 jittered grid, ~7 columns kept (open desert → legible). Tall green columns.
    const cactusGridN = 3;
    const cactusJitter = 0.6;
    const cactusMinHeight = 5;
    const cactusMaxHeight = 8;
    const cactusRadius = 0.4;
    const cactusColor = 0x4a7c3a;
    const cacti: { x: number; z: number; h: number }[] = [];
    for (let gx = 0; gx < cactusGridN; gx++) {
      for (let gz = 0; gz < cactusGridN; gz++) {
        const x = r.minX + ((gx + 0.5 + (hash(gx + 1, gz + 1) - 0.5) * cactusJitter) / cactusGridN) * w;
        const z = r.minY + ((gz + 0.5 + (hash(gx + 7, gz + 3) - 0.5) * cactusJitter) / cactusGridN) * d;
        // Thin the grid to ~7 saguaros (every cell where the hash clears a gate) — sparse, open desert.
        if (hash(gx + 17, gz + 19) < 0.2) continue;
        cacti.push({ x, z, h: cactusMinHeight + hash(gx + 11, gz + 13) * (cactusMaxHeight - cactusMinHeight) });
      }
    }
    const nCactus = cacti.length;
    if (nCactus > 0) {
      // One InstancedMesh for the trunks; one for the side ARMS (two short arms per saguaro) → 2 draw calls.
      const trunkGeo = new CylinderGeometry(cactusRadius, cactusRadius, 1, 7);
      const armGeo = new CylinderGeometry(cactusRadius * 0.8, cactusRadius * 0.8, 1, 7);
      const cactusMat = new MeshStandardMaterial({ color: cactusColor, roughness: 1 });
      const trunks = new InstancedMesh(trunkGeo, cactusMat, nCactus);
      const arms = new InstancedMesh(armGeo, cactusMat, nCactus * 2);
      const m = new Matrix4();
      const armLen = 1.5;
      for (let i = 0; i < nCactus; i++) {
        const c = cacti[i];
        m.makeScale(1, c.h, 1);
        m.setPosition(c.x, c.h / 2, c.z);
        trunks.setMatrixAt(i, m);
        // Two short upright arms, kicked out to opposite sides at ~60% of the trunk height (a saguaro tell).
        const armY = c.h * 0.6;
        m.makeScale(1, armLen, 1);
        m.setPosition(c.x + cactusRadius * 2, armY + armLen / 2, c.z);
        arms.setMatrixAt(i * 2, m);
        m.setPosition(c.x - cactusRadius * 2, armY + armLen / 2, c.z);
        arms.setMatrixAt(i * 2 + 1, m);
      }
      trunks.instanceMatrix.needsUpdate = true;
      arms.instanceMatrix.needsUpdate = true;
      this.group.add(trunks);
      this.group.add(arms);
    }

    // ROCKS / boulders — a few low tan boulders on a sparse jittered grid (offset seeds from the cacti).
    const rockGridN = 3;
    const rockJitter = 0.7;
    const rockMinSize = 0.8;
    const rockMaxSize = 1.6;
    const rockColor = 0x9a8a72;
    const rocks: { x: number; z: number; s: number }[] = [];
    for (let gx = 0; gx < rockGridN; gx++) {
      for (let gz = 0; gz < rockGridN; gz++) {
        const x = r.minX + ((gx + 0.5 + (hash(gx + 23, gz + 29) - 0.5) * rockJitter) / rockGridN) * w;
        const z = r.minY + ((gz + 0.5 + (hash(gx + 31, gz + 37) - 0.5) * rockJitter) / rockGridN) * d;
        // Thin to ~5 boulders.
        if (hash(gx + 41, gz + 43) < 0.45) continue;
        rocks.push({ x, z, s: rockMinSize + hash(gx + 47, gz + 53) * (rockMaxSize - rockMinSize) });
      }
    }
    const nRock = rocks.length;
    if (nRock > 0) {
      const rockGeo = new IcosahedronGeometry(1, 0); // a low faceted boulder, scaled per instance
      const rockMat = new MeshStandardMaterial({ color: rockColor, roughness: 1, flatShading: true });
      const boulders = new InstancedMesh(rockGeo, rockMat, nRock);
      const m = new Matrix4();
      for (let i = 0; i < nRock; i++) {
        const rk = rocks[i];
        m.makeScale(rk.s, rk.s * 0.6, rk.s); // squash low to the ground (a boulder, not a ball)
        m.setPosition(rk.x, rk.s * 0.3, rk.z);
        boulders.setMatrixAt(i, m);
      }
      boulders.instanceMatrix.needsUpdate = true;
      this.group.add(boulders);
    }
  }

  /** §4.6 D1c-i — register a cover material for the seasonal re-tint, but ONLY for a FOLIAGE biome
   *  (SEASONAL_FLORA): the rock/cave/alpine props stay austere; the pines are evergreen (never tracked). */
  private trackFoliage(biome: BiomeId, mat: MeshStandardMaterial, base: number): void {
    if (SEASONAL_FLORA[biome]?.foliage) this.propMats.push({ mat, base });
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
    this.trackFoliage(spot.biome, mat, FERN_RENDER.color); // §4.6 D1c-i — bracken golds in autumn
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
    this.trackFoliage(spot.biome, bladeMat, REED_RENDER.color); // §4.6 D1c-i — reeds brown-gold in autumn
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
    this.trackFoliage(spot.biome, bladeMat, HIDING_RENDER.color); // §4.6 D1c-i — re-tints by season
    const fill = spot.radius * HIDING_RENDER.spread;
    const golden = Math.PI * (3 - Math.sqrt(5)); // golden angle
    for (let i = 0; i < HIDING_RENDER.bladeCount; i++) {
      // Even radial spread: r grows as sqrt(i/n) so blades aren't bunched centre.
      const r = fill * Math.sqrt((i + 0.5) / HIDING_RENDER.bladeCount);
      const a = i * golden;
      const blade = new Mesh(bladeGeo, bladeMat);
      blade.position.set(spot.x + Math.cos(a) * r, HIDING_RENDER.bladeHeight / 2, spot.y + Math.sin(a) * r);
      this.group.add(blade);
      // §4.6 D1c-i — WINTER "bare": every Nth blade is hidden in winter for a thinner frosted tuft
      // (evenly distributed by the golden-angle order, so it thins uniformly rather than leaving a hole).
      if (SEASONAL_FLORA[spot.biome]?.foliage && i % SEASONAL_DRESSING.winterThinEvery === 0) {
        this.winterThinProps.push(blade);
      }
    }
    // §4.6 D1c-i — the spring BLOOM accents (the meadow's alone): a FEW small bright flower dots
    // among the blades, toggled visible only in spring by setSeason. Sparse + small = tasteful.
    if (SEASONAL_FLORA[spot.biome]?.bloom) {
      const B = SEASONAL_DRESSING.bloom;
      const flowerGeo = new SphereGeometry(B.radius, 5, 4);
      for (let i = 0; i < B.count; i++) {
        const r = fill * Math.sqrt((i + 0.5) / B.count) * B.tuftRadiusFactor;
        const a = i * golden + B.angleOffset;
        const mat = new MeshStandardMaterial({ color: B.colors[i % B.colors.length], roughness: B.roughness });
        const flower = new Mesh(flowerGeo, mat);
        flower.position.set(spot.x + Math.cos(a) * r, B.height, spot.y + Math.sin(a) * r);
        flower.visible = false; // setSeason reveals it in spring (built once, toggled)
        this.group.add(flower);
        this.bloomProps.push(flower);
      }
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

  /** §ground-seam — the static BASE-GROUND plane under the WHOLE world. Spans the world bounding box
   *  + a generous margin (BIOME_RENDER.baseMargin) and sits a hair BELOW the biome ground planes
   *  (BIOME_RENDER.baseY < 0), so it fills the bare VOID past a biome edge with a calm ground tone
   *  (PALETTE.groundBase) instead of the stark dark `background` — killing the diagonal void-seam at
   *  the iso yaw. Built ONCE (unlock-independent, like the grid); the opaque biome/locked planes at
   *  y=0 draw OVER it via depth, so the by-design locked dim / fog veil / boundary wall are untouched
   *  — the base shows ONLY where no plane covers it. Lit like the biome grounds (MeshStandardMaterial,
   *  flat +Y normal → uniform), so it reads as the same ground material continuing outward. */
  private addBaseGround(world: World): void {
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
    const m = BIOME_RENDER.baseMargin;
    const base = new Mesh(
      new PlaneGeometry(maxX - minX + 2 * m, maxY - minY + 2 * m),
      new MeshStandardMaterial({ color: PALETTE.groundBase, roughness: 1 }),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set((minX + maxX) / 2, BIOME_RENDER.baseY, (minY + maxY) / 2);
    this.group.add(base);
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
