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
import {
  createWalkState,
  createWalkTransform,
  stepGait,
  stepWalkCycle,
  type WalkState,
  type WalkTransform,
} from './walkCycle';
import { CATCH, CATCH_FX, GAIT_PROFILES, HIDE, PALETTE, SIM_DT, SPAWN, SPECIES, SPECIES_ORDER, type SpeciesId } from '../utils/constants';
import { clamp, lerp } from '../utils/math';

export class EntityRenderer {
  private readonly player: Group;
  /** CJ3 — the player's two leg hip-pivots (children of `player`), swung in opposition each frame. */
  private readonly playerLegL: Group;
  private readonly playerLegR: Group;
  /** CJ1 walk-cycle accumulators + reused transform scratch (no per-frame alloc). */
  private readonly walk: WalkState = createWalkState();
  private readonly walkOut: WalkTransform = createWalkTransform();
  /** CJ2 — per-ANIMAL gait accumulators, a FIXED pool indexed by the animal's stable slot
   *  (state.animals), allocated ONCE (no per-frame alloc). Reset on a (re)spawn edge. The
   *  walkOut scratch above is reused across the player + every animal (applied immediately). */
  private readonly animalGait: WalkState[] = Array.from({ length: SPAWN.maxAnimals }, createWalkState);
  private readonly animalActivePrev: boolean[] = new Array(SPAWN.maxAnimals).fill(false);
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
    const pm = buildPlayerModel();
    this.player = pm.group;
    this.playerLegL = pm.legL;
    this.playerLegR = pm.legR;
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
      new MeshBasicMaterial({ color: PALETTE.hideMarker, transparent: true, opacity: 0.5 }),
    );
    this.hideMarker.rotation.x = -Math.PI / 2;
    this.hideMarker.visible = false;
    scene.add(this.hideMarker);
  }

  /** Sync all entity models to the interpolated game state. Reads only. */
  sync(state: GameState, alpha: number, dt = 0, frozen = false): void {
    const p = state.player;
    const lx = lerp(p.prevX, p.x, alpha);
    const lz = lerp(p.prevY, p.y, alpha);
    // CJ1 — the procedural walk cycle. A VISUAL transform on the player Group AROUND its
    // logical position (lx, lz): the cycle derives from the player's velocity; the logical
    // position is unchanged (the sim — and so catch/proximity — never sees the bob). Frozen
    // → neutral pose (the L2 capture is identical to the static capsule).
    const a = stepWalkCycle(this.walk, Math.hypot(p.vx, p.vy), dt, frozen, this.walkOut);
    this.player.position.set(lx, a.bobY, lz);
    this.player.scale.set(a.scaleXZ, a.scaleY, a.scaleXZ);
    EntityRenderer.faceTravel(this.player, p.facingX, p.facingY); // yaw (rotation.y)
    this.player.rotation.x = a.leanX; // lean (forward pitch) composes with the facing yaw
    // CJ3 — swing the legs at the hip in OPPOSITION (one fore, one aft), synced to the bob via the
    // shared walkPhase. 0 at idle/freeze (straight legs). The pivots ride the body's bob/lean above.
    this.playerLegL.rotation.x = a.legSwing;
    this.playerLegR.rotation.x = -a.legSwing;

    // Claim a model of each active animal's species; squash the encounter target.
    for (const id of SPECIES_ORDER) this.claimed[id] = 0;
    const enc = state.encounter;
    for (let idx = 0; idx < state.animals.length; idx++) {
      const a = state.animals[idx];
      if (!a.active) {
        this.animalActivePrev[idx] = false;
        continue;
      }
      const model = this.animalPools[a.species][this.claimed[a.species]++];
      const alx = lerp(a.prevX, a.x, alpha);
      const alz = lerp(a.prevY, a.y, alpha);
      EntityRenderer.faceTravel(model, a.facingX, a.facingY);
      if (enc && enc.animalIndex === idx) {
        // Encounter target: the catch-shake squash OWNS the transform (the gait yields).
        model.position.set(alx, 0, alz);
        model.rotation.x = 0;
        EntityRenderer.applySquash(model, enc);
      } else {
        // CJ2 — the procedural gait (a VISUAL transform AROUND the logical lerp). Velocity
        // is DERIVED prev→current (animals have no vx/vy); SWIM overrides the land gait in
        // water; flee makes it more urgent. Frozen → neutral (the L2 capture is unchanged).
        const g = this.animalGait[idx];
        if (!this.animalActivePrev[idx]) {
          // (Re)spawn edge — start this slot's gait fresh (no stale phase from a prior animal).
          g.walkPhase = 0;
          g.idleClock = 0;
          g.lean = 0;
        }
        const speed = Math.hypot(a.x - a.prevX, a.y - a.prevY) / SIM_DT;
        const profile = a.inWater ? GAIT_PROFILES.swim : GAIT_PROFILES[SPECIES[a.species].gait];
        const t = stepGait(g, speed, profile, dt, frozen, a.aiState === 'flee', this.walkOut);
        model.position.set(alx, t.bobY, alz);
        model.scale.set(t.scaleXZ, t.scaleY, t.scaleXZ);
        model.rotation.x = t.leanX;
      }
      this.animalActivePrev[idx] = true;
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
