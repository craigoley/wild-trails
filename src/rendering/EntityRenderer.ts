/**
 * Renders the dynamic entities — the PLAYER and the ANIMALS — as procedural
 * low-poly MODELS (Groups of primitives), pooled exactly like the placeholder
 * cubes were: every model is built ONCE and then only moved / rotated / scaled /
 * shown / hidden each frame from the (read-only) game state. Nothing allocates
 * geometry or materials in the loop.
 *
 * Because each species has a distinct silhouette, the animal pool is keyed BY
 * SPECIES: a fixed array of `SPAWN.maxAnimals` models per species (built once,
 * hidden). Each frame the active animals claim models of their own species; the
 * rest stay hidden. Models are built foot-origin (y = 0 at the feet) so they sit
 * on the ground, rotate to face their travel direction, and squash toward the
 * ground during a catch (feet planted). Positions INTERPOLATE between prev and
 * current sim-step position by the frame `alpha`. Game (x, y) maps to three
 * (x, z). This layer never mutates game state.
 */

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  TorusGeometry,
  type Scene,
} from 'three';
import type { GameState } from '../game/GameState';
import type { Encounter } from '../game/Encounter';
import { buildAnimalModel, buildPlayerModel } from './models/builders';
import { CATCH, CATCH_FX, HIDE, PALETTE, SPAWN, SPECIES, SPECIES_ORDER, type SpeciesId } from '../utils/constants';
import { clamp, lerp } from '../utils/math';

export class EntityRenderer {
  private readonly player: Group;
  /** A pool of built models per species (claimed by active animals each frame). */
  private readonly animalPools: Record<SpeciesId, Group[]>;
  /** Per-frame claim counter per species (reset each sync). */
  private readonly claimed: Record<SpeciesId, number>;
  /** Ring under the current catch target ("who am I catching"). */
  private readonly targetRing: Mesh;
  private readonly targetRingMat: MeshBasicMaterial;
  /** Flat scent-circle under an active bait deployment. */
  private readonly baitMarker: Mesh;
  /** Flat footprint ring marking the deployed portable hide (slice C). */
  private readonly hideMarker: Mesh;

  constructor(scene: Scene) {
    this.player = buildPlayerModel();
    scene.add(this.player);

    // Per-species model pools — built once, hidden until claimed.
    this.animalPools = {} as Record<SpeciesId, Group[]>;
    this.claimed = {} as Record<SpeciesId, number>;
    for (const id of SPECIES_ORDER) {
      const pool: Group[] = [];
      for (let i = 0; i < SPAWN.maxAnimals; i++) {
        const model = buildAnimalModel(SPECIES[id]);
        model.visible = false;
        pool.push(model);
        scene.add(model);
      }
      this.animalPools[id] = pool;
      this.claimed[id] = 0;
    }

    // Target ring — a flat torus that lies on the ground under the target.
    const ringR = (CATCH_FX.ringInner + CATCH_FX.ringOuter) / 2;
    const ringTube = (CATCH_FX.ringOuter - CATCH_FX.ringInner) / 2;
    this.targetRingMat = new MeshBasicMaterial({ color: PALETTE.targetArmed });
    this.targetRing = new Mesh(new TorusGeometry(ringR, ringTube, 8, 32), this.targetRingMat);
    this.targetRing.rotation.x = -Math.PI / 2;
    this.targetRing.visible = false;
    scene.add(this.targetRing);

    // Bait scent-circle — a flat ring marking an active lure on the ground.
    this.baitMarker = new Mesh(
      new RingGeometry(CATCH_FX.baitMarkerRadius * 0.8, CATCH_FX.baitMarkerRadius, 24),
      new MeshBasicMaterial({ color: PALETTE.baitMarker, transparent: true, opacity: 0.7 }),
    );
    this.baitMarker.rotation.x = -Math.PI / 2;
    this.baitMarker.visible = false;
    scene.add(this.baitMarker);

    // Portable-hide footprint — a flat khaki ring on the ground marking the deployed
    // hide's cover radius (slice C). Procedural, zero-asset.
    this.hideMarker = new Mesh(
      new RingGeometry(HIDE.radius * 0.86, HIDE.radius, 28),
      new MeshBasicMaterial({ color: 0x8a9a5b, transparent: true, opacity: 0.5 }),
    );
    this.hideMarker.rotation.x = -Math.PI / 2;
    this.hideMarker.visible = false;
    scene.add(this.hideMarker);
  }

  /** Sync all entity models to the interpolated game state. Reads only. */
  sync(state: GameState, alpha: number): void {
    const p = state.player;
    this.player.position.set(lerp(p.prevX, p.x, alpha), 0, lerp(p.prevY, p.y, alpha));
    EntityRenderer.faceTravel(this.player, p.facingX, p.facingY);

    // Claim a model of each active animal's species; squash the encounter target.
    for (const id of SPECIES_ORDER) this.claimed[id] = 0;
    const enc = state.encounter;
    for (let idx = 0; idx < state.animals.length; idx++) {
      const a = state.animals[idx];
      if (!a.active) continue;
      const model = this.animalPools[a.species][this.claimed[a.species]++];
      model.position.set(lerp(a.prevX, a.x, alpha), 0, lerp(a.prevY, a.y, alpha));
      EntityRenderer.faceTravel(model, a.facingX, a.facingY);
      if (enc && enc.animalIndex === idx) {
        EntityRenderer.applySquash(model, enc);
      } else {
        model.scale.set(1, 1, 1);
      }
      model.visible = true;
    }
    // Hide every unclaimed model in each species pool.
    for (const id of SPECIES_ORDER) {
      const pool = this.animalPools[id];
      for (let i = this.claimed[id]; i < pool.length; i++) pool[i].visible = false;
    }

    this.syncTargetRing(state, alpha);
    this.syncBaitMarker(state);
    this.syncHideMarker(state);
  }

  /** Show the hide footprint at the deployed position (slice C). */
  private syncHideMarker(state: GameState): void {
    const h = state.hide;
    if (!h.deployed) {
      this.hideMarker.visible = false;
      return;
    }
    this.hideMarker.position.set(h.x, CATCH_FX.baitMarkerY, h.y);
    this.hideMarker.visible = true;
  }

  /** Yaw a model to face its travel direction (game facing -> three +z forward). */
  private static faceTravel(g: Group, fx: number, fy: number): void {
    if (fx !== 0 || fy !== 0) g.rotation.y = Math.atan2(fx, fy);
  }

  /** Ring under the current target — colour shows baited vs armed, with a gentle
   *  pulse so it reads as live. Driven entirely by game state. */
  private syncTargetRing(state: GameState, alpha: number): void {
    const idx = state.targetIndex;
    if (idx < 0 || !state.animals[idx]?.active) {
      this.targetRing.visible = false;
      return;
    }
    const a = state.animals[idx];
    const pulse = 1 + Math.sin(state.timeSec * Math.PI * 2 * CATCH_FX.ringPulseHz) * CATCH_FX.ringPulseAmp;
    this.targetRing.position.set(lerp(a.prevX, a.x, alpha), CATCH_FX.ringY, lerp(a.prevY, a.y, alpha));
    this.targetRing.scale.set(pulse, pulse, pulse);
    this.targetRingMat.color.setHex(state.targetBaited ? PALETTE.targetBaited : PALETTE.targetArmed);
    this.targetRing.visible = true;
  }

  /** Scent-circle under an active bait deployment, so "I dropped bait" is visible.
   *  Reads bait state directly to avoid the per-frame allocation activeLure() makes. */
  private syncBaitMarker(state: GameState): void {
    const b = state.bait;
    if (b.activeType === null || b.timer <= 0) {
      this.baitMarker.visible = false;
      return;
    }
    this.baitMarker.position.set(b.x, CATCH_FX.baitMarkerY, b.y);
    this.baitMarker.visible = true;
  }

  /**
   * Squash the target model to match the encounter's CURRENT beat — a scale
   * FACTOR around 1 applied to the foot-origin Group (so it compresses toward the
   * ground), driven purely by the resolved data (phase / beatTimer), never by a
   * separate animation that could diverge from the odds.
   */
  private static applySquash(g: Group, enc: Encounter): void {
    if (enc.phase === 'shaking') {
      const progress = clamp(1 - enc.beatTimer / CATCH.shakeBeatSec, 0, 1);
      const pulse = Math.sin(progress * Math.PI); // 0 -> 1 -> 0 across the beat
      const s = pulse * CATCH.squashIntensity;
      g.scale.set(1 + s * CATCH.squashWidthRatio, 1 - s, 1 + s * CATCH.squashWidthRatio);
    } else if (enc.phase === 'resolving' && enc.caught) {
      // Caught: shrink into the net over the settle beat.
      g.scale.setScalar(clamp(enc.beatTimer / CATCH.resolveBeatSec, 0, 1)); // 1 -> 0
    } else if (enc.phase === 'resolving') {
      // Escape: a break-out POP that peaks early then settles ("it lunged free").
      const progress = clamp(1 - enc.beatTimer / CATCH.resolveBeatSec, 0, 1); // 0 -> 1
      const pop = Math.sin(progress * Math.PI); // 0 -> 1 -> 0
      g.scale.setScalar(1 + pop * (CATCH_FX.escapePop - 1));
    } else {
      g.scale.set(1, 1, 1);
    }
  }
}
