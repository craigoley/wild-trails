/**
 * Renders the dynamic entities. Phase 0 is just the PLAYER, drawn as a
 * placeholder box marker so the iso height read and the follow-cam are visible.
 * Animals, catch VFX and the encounter UI arrive in later phased PRs — they'll
 * extend this same pooled approach (meshes created ONCE, only moved/shown/hidden
 * each frame; nothing allocates geometry or materials in the loop).
 *
 * The marker's position INTERPOLATES between the player's previous and current
 * sim-step position by the frame `alpha`, so motion is smooth at any refresh
 * rate. Game (x, y) maps to three (x, z); the ground is y = 0. This layer never
 * mutates game state.
 */

import { BoxGeometry, Mesh, MeshStandardMaterial, type Scene } from 'three';
import type { GameState } from '../game/GameState';
import { PALETTE, PLAYER } from '../utils/constants';
import { lerp } from '../utils/math';

export class EntityRenderer {
  private readonly marker: Mesh;

  constructor(scene: Scene) {
    const s = PLAYER.radius * 2;
    const mat = new MeshStandardMaterial({ color: PALETTE.player, roughness: 0.7 });
    // A cube one body-size tall, resting ON the ground (origin lifted by half its
    // height) so it sits on y = 0 rather than half-sunk into it.
    this.marker = new Mesh(new BoxGeometry(s, s, s), mat);
    scene.add(this.marker);
  }

  /** Sync the marker to the interpolated player position. Reads only. */
  sync(state: GameState, alpha: number): void {
    const p = state.player;
    const x = lerp(p.prevX, p.x, alpha);
    const y = lerp(p.prevY, p.y, alpha);
    this.marker.position.set(x, PLAYER.radius, y);
  }
}
