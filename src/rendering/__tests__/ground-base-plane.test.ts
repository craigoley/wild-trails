import { describe, expect, it } from 'vitest';
import { Scene, Mesh, PlaneGeometry, type MeshStandardMaterial } from 'three';
import { WorldRenderer } from '../WorldRenderer';
import { createWorld, type World } from '../../game/World';
import { BIOME_RENDER, PALETTE } from '../../utils/constants';

/**
 * §ground-seam — the static BASE-GROUND plane fix. CAUSE (recon): a biome ground plane ENDS at an edge
 * with no neighbour (the meadow's west/south), and the camera saw the bare dark `PALETTE.background`
 * past it → a hard diagonal void-seam at the 45° iso yaw. FIX: one static base plane under the WHOLE
 * world, a hair below the biome planes, so the void shows a calm ground tone instead of the void. These
 * pin: the plane exists, spans the world bbox + margin, layers BELOW the biome planes (no z-fight, shows
 * only in the void), and is built ONCE (unlock-independent). The LOOK is Craig's device gate.
 */

function worldBBox(world: World): { minX: number; minY: number; maxX: number; maxY: number } {
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
  return { minX, minY, maxX, maxY };
}

/** Every mesh whose material is the base-ground tone (the base plane's unique fingerprint). */
function baseGroundMeshes(scene: Scene): Mesh[] {
  const out: Mesh[] = [];
  scene.traverse((o) => {
    const mat = (o as Mesh).material as MeshStandardMaterial | undefined;
    if (mat && 'color' in mat && mat.color.getHex() === PALETTE.groundBase) out.push(o as Mesh);
  });
  return out;
}

describe('§ground-seam — the base-ground plane (kills the void-seam)', () => {
  it('the tuning lives in constants (no magic numbers): groundBase tone + a below-ground y + a margin', () => {
    expect(typeof PALETTE.groundBase).toBe('number');
    expect(BIOME_RENDER.baseY).toBeLessThan(0); // BELOW the biome ground planes (y=0)
    expect(BIOME_RENDER.baseMargin).toBeGreaterThan(0); // extends past the world bbox
  });

  it('builds exactly ONE static base plane, in the groundBase tone', () => {
    const scene = new Scene();
    new WorldRenderer(scene, createWorld());
    const bases = baseGroundMeshes(scene);
    expect(bases.length).toBe(1);
    expect(bases[0].geometry).toBeInstanceOf(PlaneGeometry);
  });

  it('lays the base plane flat, a hair BELOW the biome planes (no z-fight; shows only in the void)', () => {
    const scene = new Scene();
    new WorldRenderer(scene, createWorld());
    const base = baseGroundMeshes(scene)[0];
    expect(base.rotation.x).toBeCloseTo(-Math.PI / 2); // flat on the ground, like the biome planes
    expect(base.position.y).toBe(BIOME_RENDER.baseY);
    expect(base.position.y).toBeLessThan(0); // strictly under the biome ground planes (which sit at y=0)
  });

  it('spans the whole world bounding box PLUS a generous margin on every side', () => {
    const world = createWorld();
    const scene = new Scene();
    new WorldRenderer(scene, world);
    const base = baseGroundMeshes(scene)[0];
    const bb = worldBBox(world);
    const geo = base.geometry as PlaneGeometry;
    expect(geo.parameters.width).toBeCloseTo(bb.maxX - bb.minX + 2 * BIOME_RENDER.baseMargin);
    expect(geo.parameters.height).toBeCloseTo(bb.maxY - bb.minY + 2 * BIOME_RENDER.baseMargin);
    // Centred on the world bbox, so the margin is symmetric (no edge ever near the view).
    expect(base.position.x).toBeCloseTo((bb.minX + bb.maxX) / 2);
    expect(base.position.z).toBeCloseTo((bb.minY + bb.maxY) / 2);
  });

  it('is unlock-INDEPENDENT: still exactly one after a refresh (it lives under everything, never rebuilt)', () => {
    const world = createWorld();
    const scene = new Scene();
    const wr = new WorldRenderer(scene, world);
    wr.refresh(world); // an unlock rebuilds the dynamic group — the base plane must survive untouched
    expect(baseGroundMeshes(scene).length).toBe(1);
  });

  it('adds NO fog (the base plane is the whole fix — no fog/vignette softening here)', () => {
    const scene = new Scene();
    new WorldRenderer(scene, createWorld());
    expect(scene.fog).toBeNull();
  });
});
