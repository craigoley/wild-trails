import { describe, expect, it } from 'vitest';
import {
  clampActive,
  clampToUnlocked,
  createWorld,
  currentBiome,
  isInsideBiome,
  isUnlocked,
  sharedBorder,
} from '../World';
import { BIOMES, PLAYER } from '../../utils/constants';
import type { Vec2 } from '../../utils/math';

const MARGIN = PLAYER.radius;

/** Allocate a fresh clamp target per call (tests don't care about reuse). */
function clamp(x: number, y: number): Vec2 {
  const out: Vec2 = { x: 0, y: 0 };
  return clampToUnlocked(createWorld(), x, y, MARGIN, out);
}

describe('World — biome graph state', () => {
  it('starts with only the Meadow unlocked', () => {
    const w = createWorld();
    expect(isUnlocked(w, 'meadow')).toBe(true);
    expect(isUnlocked(w, 'woodland')).toBe(false);
    expect(isUnlocked(w, 'wetland')).toBe(false);
    expect(isUnlocked(w, 'highlands')).toBe(false);
  });

  it('wires adjacency symmetrically (every edge points back)', () => {
    const w = createWorld();
    for (const id of w.order) {
      for (const adj of w.biomes[id].def.adjacent) {
        expect(w.biomes[adj].def.adjacent).toContain(id);
      }
    }
  });
});

describe('World — containment geometry', () => {
  it('isInsideBiome matches the Meadow footprint', () => {
    const w = createWorld();
    expect(isInsideBiome(w, 'meadow', 0, 0)).toBe(true); // centre
    const b = BIOMES.meadow.bounds;
    expect(isInsideBiome(w, 'meadow', b.maxX, b.maxY)).toBe(true); // corner (inclusive)
    expect(isInsideBiome(w, 'meadow', b.maxX + 1, 0)).toBe(false); // just outside
  });

  it('currentBiome resolves the cell under a point, null when outside all', () => {
    const w = createWorld();
    expect(currentBiome(w, 0, 0)).toBe('meadow');
    // A point deep inside the (locked) Woodland cell still resolves to woodland.
    const wood = BIOMES.woodland.bounds;
    const cx = (wood.minX + wood.maxX) / 2;
    const cy = (wood.minY + wood.maxY) / 2;
    expect(currentBiome(w, cx, cy)).toBe('woodland');
    // Far outside every cell.
    expect(currentBiome(w, 9999, 9999)).toBeNull();
  });
});

describe('World — clampToUnlocked keeps the player in the Meadow', () => {
  it('leaves an interior point untouched', () => {
    const p = clamp(3, -4);
    expect(p.x).toBeCloseTo(3, 10);
    expect(p.y).toBeCloseTo(-4, 10);
  });

  it('clamps a point shoved past the Meadow edge back to the inset bound', () => {
    const b = BIOMES.meadow.bounds;
    const p = clamp(1000, 0);
    expect(p.x).toBeCloseTo(b.maxX - MARGIN, 10);
  });

  it('pulls a point that lies in a LOCKED neighbour back into the Meadow', () => {
    // A point inside the locked Woodland (north of the Meadow) must be clamped
    // out of it — back onto the shared Meadow edge, inset by the body radius.
    const wood = BIOMES.woodland.bounds;
    const cy = (wood.minY + wood.maxY) / 2; // deep in Woodland
    const p = clamp(0, cy);
    const meadow = BIOMES.meadow.bounds;
    expect(p.y).toBeCloseTo(meadow.maxY - MARGIN, 10);
    expect(isInsideBiome(createWorld(), 'woodland', p.x, p.y)).toBe(false);
  });

  it('clampActive is true at the boundary and false in the interior', () => {
    const w = createWorld();
    expect(clampActive(w, 0, 0, MARGIN)).toBe(false);
    expect(clampActive(w, 1000, 0, MARGIN)).toBe(true);
  });
});

describe('World — sharedBorder geometry', () => {
  it('finds the horizontal edge Meadow shares with Woodland', () => {
    const e = sharedBorder(BIOMES.meadow.bounds, BIOMES.woodland.bounds);
    expect(e).not.toBeNull();
    // Horizontal edge => constant y at the Meadow's far edge.
    expect(e!.y1).toBe(e!.y2);
    expect(e!.y1).toBe(BIOMES.meadow.bounds.maxY);
  });

  it('returns null for non-touching cells (Meadow vs Highlands, diagonal)', () => {
    expect(sharedBorder(BIOMES.meadow.bounds, BIOMES.highlands.bounds)).toBeNull();
  });
});
