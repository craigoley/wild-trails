/**
 * §4.6 D1c-ii — the SEASONAL AMBIENT particle layer. A NEW bounded pool (there was no TL2 ambient to
 * extend — the recon's headline finding). A SINGLE `Points` cloud of a FIXED size (`SEASONAL_AMBIENT.
 * maxCount`); the position buffer is allocated ONCE and seeded deterministically from the scene seed.
 * Each frame `update` only MUTATES floats in the existing buffer (a fall + sway + wrap) — ⚠️ ZERO
 * per-frame allocation (the iPhone hot-loop rule). `setDrawRange` varies the rendered count per season
 * (density without re-alloc). ⚠️ Under `?freeze` the buffer is seeded-but-NOT-advanced → the frozen
 * scene is byte-stable (the L2 gate). READS game state; never mutates it. No `three` in `src/game/`.
 *
 * Modest by design: the D1a snow GROUND overlay does winter's heavy lifting; this adds a gentle drift in
 * the air so the two compose into one calm wintry read (never a blizzard). The FEEL is Craig's gate.
 */

import { BufferAttribute, BufferGeometry, Points, PointsMaterial, type Scene } from 'three';
import type { GameState } from '../game/GameState';
import { lerp } from '../utils/math';
import { createRng } from '../utils/rng';
import { SEASONAL_AMBIENT, SNOW_BIOMES, type BiomeId, type Season } from '../utils/constants';

/** One season's drift configuration (a member of SEASONAL_AMBIENT). */
type AmbientConfig = (typeof SEASONAL_AMBIENT)[Season];

/** The biomes whose autumn drops LEAVES (they have trees) — elsewhere autumn has no falling leaves. */
const TREE_BIOMES = new Set<BiomeId>(['woodland', 'pineforest']);

/**
 * The active ambient config for a (season, biome), or null for "no ambient here". PURE — the honest
 * per-biome map: ⚠️ the CAVE never has ambient (underground — no weather); autumn LEAVES only where
 * there are trees; winter SNOW only in the cold SURFACE biomes (SNOW_BIOMES); spring/summer everywhere
 * above ground. Exported for the L1 pins.
 */
export function ambientConfigFor(season: Season, biome: BiomeId): AmbientConfig | null {
  if (biome === 'cave') return null; // ⚠️ underground — no weather, ever
  if (season === 'autumn') return TREE_BIOMES.has(biome) ? SEASONAL_AMBIENT.autumn : null; // leaves need trees
  if (season === 'winter') return SNOW_BIOMES[biome] ? SEASONAL_AMBIENT.winter : null; // snow on the cold surface
  return SEASONAL_AMBIENT[season]; // spring / summer — all surface biomes
}

export class AmbientRenderer {
  private readonly points: Points;
  /** The fixed position buffer (maxCount × 3), allocated ONCE and mutated in place — never re-allocated. */
  private readonly positions: Float32Array;
  private readonly mat: PointsMaterial;
  private readonly box = SEASONAL_AMBIENT.box;

  constructor(scene: Scene, seed: number) {
    const n = SEASONAL_AMBIENT.maxCount;
    this.positions = new Float32Array(n * 3);
    // Seed the particle box deterministically from the scene seed → a frozen capture is byte-stable.
    const rng = createRng(seed);
    for (let i = 0; i < n; i++) {
      this.positions[i * 3 + 0] = (rng.next() - 0.5) * this.box.width;
      this.positions[i * 3 + 1] = rng.next() * this.box.height;
      this.positions[i * 3 + 2] = (rng.next() - 0.5) * this.box.depth;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.mat = new PointsMaterial({ size: SEASONAL_AMBIENT.summer.size, transparent: true, opacity: 0.85, depthWrite: false });
    this.points = new Points(geo, this.mat);
    this.points.visible = false; // until update picks a season config
    scene.add(this.points);
  }

  /**
   * Advance the ambient for the current (interpolated) frame. Reads game.season + game.currentBiome to
   * pick the config (null → hidden). ⚠️ Frozen → set the look but DON'T advance the buffer (deterministic
   * capture). Otherwise mutate the buffer in place (fall + sway + wrap) — NO allocation.
   */
  update(state: GameState, alpha: number, dt: number, frozen: boolean): void {
    const cfg = ambientConfigFor(state.season, state.currentBiome);
    if (!cfg) {
      this.points.visible = false;
      return;
    }
    this.points.visible = true;
    // Follow the view: the cloud rides the player so the local box always fills the frame. The vertical
    // FALL (driftY) is the dominant, world-correct motion; the x/z re-centre keeps particles in view.
    const p = state.player;
    this.points.position.set(lerp(p.prevX, p.x, alpha), 0, lerp(p.prevY, p.y, alpha));
    this.mat.color.setHex(cfg.color);
    this.mat.size = cfg.size;
    this.points.geometry.setDrawRange(0, cfg.count); // density per season — no re-alloc

    if (frozen) return; // ⚠️ freeze → static: seeded positions, never advanced (byte-stable baseline)

    // Advance in place — ZERO allocation (only float writes into the existing buffer).
    const pos = this.positions;
    const hw = this.box.width / 2;
    const hd = this.box.depth / 2;
    for (let i = 0; i < cfg.count; i++) {
      const j = i * 3;
      pos[j + 1] -= cfg.driftY * dt; // fall
      pos[j + 0] += Math.sin(pos[j + 1] * 0.6 + i) * cfg.sway * dt; // a cheap deterministic sway
      // Wrap within the box (a torus) so the fixed pool never empties.
      if (pos[j + 1] < 0) pos[j + 1] += this.box.height;
      if (pos[j + 0] > hw) pos[j + 0] -= this.box.width;
      else if (pos[j + 0] < -hw) pos[j + 0] += this.box.width;
      if (pos[j + 2] > hd) pos[j + 2] -= this.box.depth;
      else if (pos[j + 2] < -hd) pos[j + 2] += this.box.depth;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
