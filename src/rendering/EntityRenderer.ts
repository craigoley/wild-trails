/**
 * Renders the dynamic entities: the PLAYER marker and the ANIMALS. Both follow
 * the same pooled pattern — meshes created ONCE, then only moved / shown / hidden
 * / recoloured each frame from the (read-only) game state. Nothing allocates
 * geometry or materials in the loop.
 *
 * The animal mesh pool is sized to the animal POOL (SPAWN.maxAnimals); each frame
 * the active animals claim the first N meshes (positioned + scaled + tinted from
 * their species) and the rest are hidden. Positions INTERPOLATE between each
 * entity's previous and current sim-step position by the frame `alpha`, so motion
 * is smooth at any refresh rate. Game (x, y) maps to three (x, z); the ground is
 * y = 0. This layer never mutates game state.
 */

import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  TorusGeometry,
  type Scene,
} from 'three';
import type { GameState } from '../game/GameState';
import type { Encounter } from '../game/Encounter';
import { getSpecies } from '../game/Species';
import { activeLure } from '../game/Bait';
import { CATCH, CATCH_FX, PALETTE, PLAYER, SPAWN } from '../utils/constants';
import { clamp, lerp } from '../utils/math';

export class EntityRenderer {
  private readonly marker: Mesh;
  /** One reusable unit-cube mesh per pool slot (scaled per-animal each frame). */
  private readonly animalMeshes: Mesh[] = [];
  /** Ring under the current catch target ("who am I catching"). */
  private readonly targetRing: Mesh;
  private readonly targetRingMat: MeshBasicMaterial;
  /** Flat scent-circle under an active bait deployment. */
  private readonly baitMarker: Mesh;

  constructor(scene: Scene) {
    const s = PLAYER.radius * 2;
    const mat = new MeshStandardMaterial({ color: PALETTE.player, roughness: 0.7 });
    // A cube one body-size tall, resting ON the ground (origin lifted by half its
    // height) so it sits on y = 0 rather than half-sunk into it.
    this.marker = new Mesh(new BoxGeometry(s, s, s), mat);
    scene.add(this.marker);

    // Animal mesh pool — a shared unit-cube geometry, one material per slot (so
    // each animal can carry its own species tint). Hidden until claimed.
    const unitCube = new BoxGeometry(1, 1, 1);
    for (let i = 0; i < SPAWN.maxAnimals; i++) {
      const m = new Mesh(unitCube, new MeshStandardMaterial({ roughness: 0.8 }));
      m.visible = false;
      this.animalMeshes.push(m);
      scene.add(m);
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
  }

  /** Sync all entity meshes to the interpolated game state. Reads only. */
  sync(state: GameState, alpha: number): void {
    const p = state.player;
    this.marker.position.set(
      lerp(p.prevX, p.x, alpha),
      PLAYER.radius,
      lerp(p.prevY, p.y, alpha),
    );

    // Active animals claim meshes in order; leftovers are hidden. (Pool sizes
    // match, so this never runs short.)
    const enc = state.encounter;
    let mi = 0;
    for (let idx = 0; idx < state.animals.length; idx++) {
      const a = state.animals[idx];
      if (!a.active) continue;
      const mesh = this.animalMeshes[mi++];
      const def = getSpecies(a.species);
      const size = def.size;
      mesh.position.set(
        lerp(a.prevX, a.x, alpha),
        size / 2,
        lerp(a.prevY, a.y, alpha),
      );
      // The animal in the active encounter plays back the resolved shake DATA as
      // a squash per beat (settle on catch). Everyone else is a plain cube.
      if (enc && enc.animalIndex === idx) {
        EntityRenderer.applySquash(mesh, enc, size);
      } else {
        mesh.scale.set(size, size, size);
      }
      (mesh.material as MeshStandardMaterial).color.setHex(def.color);
      mesh.visible = true;
    }
    for (; mi < this.animalMeshes.length; mi++) this.animalMeshes[mi].visible = false;

    this.syncTargetRing(state, alpha);
    this.syncBaitMarker(state);
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

  /** Scent-circle under an active bait deployment, so "I dropped bait" is visible. */
  private syncBaitMarker(state: GameState): void {
    const lure = activeLure(state.bait);
    if (!lure) {
      this.baitMarker.visible = false;
      return;
    }
    this.baitMarker.position.set(lure.x, CATCH_FX.baitMarkerY, lure.y);
    this.baitMarker.visible = true;
  }

  /**
   * Squash the target's mesh to match the encounter's CURRENT beat — driven
   * purely by the resolved data (phase / shakeIndex / beatTimer), never by a
   * separate animation that could diverge from the odds. Each shake wobbles
   * (squash down, bulge out); a caught animal shrinks into the net on the settle
   * beat; an escapee stays full-size (it bolts once the encounter clears).
   */
  private static applySquash(mesh: Mesh, enc: Encounter, size: number): void {
    if (enc.phase === 'shaking') {
      const progress = clamp(1 - enc.beatTimer / CATCH.shakeBeatSec, 0, 1);
      const pulse = Math.sin(progress * Math.PI); // 0 -> 1 -> 0 across the beat
      const s = pulse * CATCH.squashIntensity;
      mesh.scale.set(size * (1 + s * CATCH.squashWidthRatio), size * (1 - s), size * (1 + s * CATCH.squashWidthRatio));
    } else if (enc.phase === 'resolving' && enc.caught) {
      // Caught: shrink into the net over the settle beat.
      const shrink = clamp(enc.beatTimer / CATCH.resolveBeatSec, 0, 1); // 1 -> 0
      const s = size * shrink;
      mesh.scale.set(s, s, s);
    } else if (enc.phase === 'resolving') {
      // Escape: a break-out POP that peaks early then settles — reads as "it
      // lunged free" (the AI flee carries it away once the encounter clears).
      const progress = clamp(1 - enc.beatTimer / CATCH.resolveBeatSec, 0, 1); // 0 -> 1
      const pop = Math.sin(progress * Math.PI); // 0 -> 1 -> 0
      const s = size * (1 + pop * (CATCH_FX.escapePop - 1));
      mesh.scale.set(s, s, s);
    } else {
      mesh.scale.set(size, size, size);
    }
  }
}
