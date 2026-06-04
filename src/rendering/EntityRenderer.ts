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

import { BoxGeometry, Mesh, MeshStandardMaterial, type Scene } from 'three';
import type { GameState } from '../game/GameState';
import type { Encounter } from '../game/Encounter';
import { getSpecies } from '../game/Species';
import { CATCH, PALETTE, PLAYER, SPAWN } from '../utils/constants';
import { clamp, lerp } from '../utils/math';

export class EntityRenderer {
  private readonly marker: Mesh;
  /** One reusable unit-cube mesh per pool slot (scaled per-animal each frame). */
  private readonly animalMeshes: Mesh[] = [];

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
      mesh.scale.set(size * (1 + s * 0.5), size * (1 - s), size * (1 + s * 0.5));
    } else if (enc.phase === 'resolving' && enc.caught) {
      const shrink = clamp(enc.beatTimer / CATCH.resolveBeatSec, 0, 1); // 1 -> 0
      const s = size * shrink;
      mesh.scale.set(s, s, s);
    } else {
      mesh.scale.set(size, size, size);
    }
  }
}
