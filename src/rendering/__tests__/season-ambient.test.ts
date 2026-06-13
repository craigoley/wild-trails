import { describe, expect, it } from 'vitest';
import { Scene, Points } from 'three';
import { AmbientRenderer, ambientConfigFor } from '../AmbientRenderer';
import { createGameState } from '../../game/GameState';
import { SEASONAL_AMBIENT, type BiomeId, type Season } from '../../utils/constants';

/**
 * §4.6 D1c-ii — the SEASONAL AMBIENT particle layer. A NEW bounded pool. ⚠️ The LAWS these pin: (1) the
 * per-biome honest map (no ambient in the cave; leaves only where there are trees; snow on the cold
 * surface); (2) ZERO per-frame allocation (the buffer is fixed + reused — the iPhone hot-loop rule);
 * (3) freeze → static (seeded, not advanced — the L2 gate is deterministic). The FEEL (modest-not-busy;
 * each season's life; the winter compose) is Craig's device gate, not a test.
 */
const points = (scene: Scene): Points => scene.children.find((c): c is Points => c instanceof Points)!;
const posArray = (scene: Scene): Float32Array => points(scene).geometry.attributes.position.array as Float32Array;
const game = (season: Season, biome: BiomeId) => {
  const g = createGameState(7);
  g.season = season;
  g.currentBiome = biome;
  return g;
};

describe('ambientConfigFor — the per-biome HONEST map (pure)', () => {
  it('⚠️ the CAVE has NO ambient in any season (underground — no weather)', () => {
    for (const s of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
      expect(ambientConfigFor(s, 'cave')).toBeNull();
    }
  });

  it('autumn LEAVES fall only where there are trees (woodland / pineforest), not the open biomes', () => {
    expect(ambientConfigFor('autumn', 'woodland')).toBe(SEASONAL_AMBIENT.autumn);
    expect(ambientConfigFor('autumn', 'pineforest')).toBe(SEASONAL_AMBIENT.autumn);
    expect(ambientConfigFor('autumn', 'meadow')).toBeNull(); // no trees → no falling leaves
    expect(ambientConfigFor('autumn', 'coast')).toBeNull();
  });

  it('winter SNOW falls on the cold SURFACE biomes, never the cave', () => {
    expect(ambientConfigFor('winter', 'meadow')).toBe(SEASONAL_AMBIENT.winter);
    expect(ambientConfigFor('winter', 'alpine')).toBe(SEASONAL_AMBIENT.winter);
    expect(ambientConfigFor('winter', 'cave')).toBeNull(); // underground — no snow
  });

  it('spring/summer drift on every surface biome (not the cave)', () => {
    expect(ambientConfigFor('spring', 'meadow')).toBe(SEASONAL_AMBIENT.spring);
    expect(ambientConfigFor('summer', 'moor')).toBe(SEASONAL_AMBIENT.summer);
    expect(ambientConfigFor('summer', 'cave')).toBeNull();
  });

  it('⚠️ winter density is MODEST (count < the pool max — composes with the ground overlay, not a blizzard)', () => {
    expect(SEASONAL_AMBIENT.winter.count).toBeLessThan(SEASONAL_AMBIENT.maxCount);
    for (const s of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
      expect(SEASONAL_AMBIENT[s].count).toBeLessThanOrEqual(SEASONAL_AMBIENT.maxCount);
    }
  });
});

describe('AmbientRenderer — ⚠️ ZERO per-frame allocation (the bounded pool, mutated in place)', () => {
  it('the position buffer is FIXED-size and the SAME reference across updates (never re-allocated)', () => {
    const scene = new Scene();
    const ar = new AmbientRenderer(scene, 7);
    const before = posArray(scene);
    expect(before.length).toBe(SEASONAL_AMBIENT.maxCount * 3); // fixed pool

    const g = game('winter', 'meadow');
    ar.update(g, 1, 0.016, false);
    ar.update(g, 1, 0.016, false);
    expect(posArray(scene)).toBe(before); // ⚠️ identical reference — no per-frame re-alloc
  });

  it('no ambient (cave) hides the cloud — and the buffer is still the same object', () => {
    const scene = new Scene();
    const ar = new AmbientRenderer(scene, 7);
    const buf = posArray(scene);
    ar.update(game('winter', 'cave'), 1, 0.016, false);
    expect(points(scene).visible).toBe(false); // hidden underground
    expect(posArray(scene)).toBe(buf);
  });
});

describe('AmbientRenderer — ⚠️ freeze → static (deterministic), play → drifts', () => {
  it('frozen: the positions are seeded and DO NOT advance (byte-stable capture)', () => {
    const scene = new Scene();
    const ar = new AmbientRenderer(scene, 7);
    const g = game('winter', 'meadow');
    ar.update(g, 1, 0.016, true); // frozen
    const snap = Array.from(posArray(scene));
    ar.update(g, 1, 0.5, true); // frozen again, a big dt — must NOT move
    expect(Array.from(posArray(scene))).toEqual(snap); // ⚠️ unchanged → deterministic baseline
  });

  it('playing: the drift advances the buffer in place (the particles live)', () => {
    const scene = new Scene();
    const ar = new AmbientRenderer(scene, 7);
    const g = game('winter', 'meadow');
    const before = Array.from(posArray(scene));
    ar.update(g, 1, 0.5, false); // play, a big dt
    expect(Array.from(posArray(scene))).not.toEqual(before); // it drifted
  });

  it('a fixed seed → a deterministic initial layout (two renderers seeded alike match)', () => {
    const a = new Scene();
    const b = new Scene();
    new AmbientRenderer(a, 7);
    new AmbientRenderer(b, 7);
    expect(Array.from(posArray(a))).toEqual(Array.from(posArray(b))); // seed → byte-stable
  });
});
