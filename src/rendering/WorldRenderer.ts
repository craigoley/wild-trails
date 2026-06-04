/**
 * Builds the static world geometry: a flat ground plane plus a faint grid so the
 * iso angle and the player's motion across the ground read clearly. PLACEHOLDER
 * for Phase 0 — a single flat square sized to WORLD.halfSize. Biome tiles,
 * height/terrain, foliage and spawn-zone shading land in later phased PRs, all
 * still driven from (read-only) game state.
 *
 * Built ONCE: the ground is static, so nothing here runs per frame and no
 * geometry/material is allocated in the loop. READ-ONLY with respect to game
 * state.
 */

import {
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Scene,
} from 'three';
import { PALETTE, WORLD } from '../utils/constants';

export class WorldRenderer {
  private readonly group = new Group();

  constructor(scene: Scene) {
    const size = WORLD.halfSize * 2;

    // Ground plane on y = 0. PlaneGeometry is created in the XY plane facing +z;
    // rotate it flat so it lies in the XZ ground plane the iso camera looks down on.
    const groundMat = new MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 });
    const ground = new Mesh(new PlaneGeometry(size, size), groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);

    // Faint grid for spatial reference / scale read. One line per world unit.
    const grid = new GridHelper(size, size, PALETTE.groundLine, PALETTE.groundLine);
    this.group.add(grid);

    scene.add(this.group);
  }
}
