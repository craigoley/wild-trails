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
import { getSpecies } from '../game/Species';
import { PALETTE, PLAYER, SPAWN } from '../utils/constants';
import { lerp } from '../utils/math';

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
    let mi = 0;
    for (const a of state.animals) {
      if (!a.active) continue;
      const mesh = this.animalMeshes[mi++];
      const def = getSpecies(a.species);
      const size = def.size;
      mesh.scale.set(size, size, size);
      mesh.position.set(
        lerp(a.prevX, a.x, alpha),
        size / 2,
        lerp(a.prevY, a.y, alpha),
      );
      (mesh.material as MeshStandardMaterial).color.setHex(def.color);
      mesh.visible = true;
    }
    for (; mi < this.animalMeshes.length; mi++) this.animalMeshes[mi].visible = false;
  }
}
