import { describe, expect, it } from 'vitest';
import { Scene, Mesh, SphereGeometry, type MeshStandardMaterial } from 'three';
import { WorldRenderer, seasonalGrade } from '../WorldRenderer';
import { createWorld } from '../../game/World';
import { BIOMES, SEASONAL_FLORA, SEASONAL_DRESSING, type Season } from '../../utils/constants';

/**
 * §4.6 D1c-i — the SEASONAL COVER/FLORA re-dress: the cover props re-tint by season (reusing the D1a
 * seasonalGrade), the meadow blooms in spring, winter thins the grass. ⚠️ summer = identity (the props
 * return to today's look → the 10 summer baselines don't move). The per-biome map is HONEST: the
 * rock/cave/alpine props stay austere; only the meadow blooms. The LOOK is Craig's device gate.
 */

// All ground/prop material hex colours in the scene, sorted (a stable fingerprint of the re-grade).
const matHexes = (scene: Scene): string[] => {
  const out: string[] = [];
  scene.traverse((o) => {
    const m = (o as Mesh).material as MeshStandardMaterial | undefined;
    if (m && 'color' in m && o.visible) out.push(m.color.getHexString());
  });
  return out.sort();
};
// Count the VISIBLE bloom accents (the only SphereGeometry props the re-dress adds).
const visibleBlooms = (scene: Scene): number => {
  let n = 0;
  scene.traverse((o) => {
    if (o instanceof Mesh && o.geometry instanceof SphereGeometry && o.visible) n++;
  });
  return n;
};

describe('§4.6 D1c-i — the per-biome HONEST map (austere where it should be)', () => {
  it('⚠️ the alpine is AUSTERE (no foliage re-tint, NO bloom) — bare scree is its character', () => {
    expect(SEASONAL_FLORA.alpine).toEqual({ foliage: false, bloom: false });
  });

  it('⚠️ the cave has NO seasonal dressing (underground — no season)', () => {
    expect(SEASONAL_FLORA.cave).toEqual({ foliage: false, bloom: false });
  });

  it('bloom is the MEADOW’s alone (sparse + tasteful), and the foliage biomes re-tint', () => {
    const bloomers = (Object.keys(SEASONAL_FLORA) as (keyof typeof SEASONAL_FLORA)[]).filter((b) => SEASONAL_FLORA[b]!.bloom);
    expect(bloomers).toEqual(['meadow']); // only the meadow blooms — not a flower riot everywhere
    expect(SEASONAL_DRESSING.bloom.count).toBeLessThanOrEqual(6); // sparse
    // The rock biomes are austere; the grass/fern/reed biomes re-tint.
    for (const b of ['highlands', 'cave', 'alpine'] as const) expect(SEASONAL_FLORA[b]!.foliage).toBe(false);
    for (const b of ['meadow', 'woodland', 'wetland', 'pineforest'] as const) expect(SEASONAL_FLORA[b]!.foliage).toBe(true);
  });
});

describe('§4.6 D1c-i — ⚠️ summer is the IDENTITY (props stay today; the 10 baselines don’t move)', () => {
  it('a foliage base re-tints in autumn/winter but NOT in summer (the seasonalGrade props use)', () => {
    const base = BIOMES.meadow.color;
    expect(seasonalGrade(base, 'summer')).not.toBe(seasonalGrade(base, 'winter'));
    expect(seasonalGrade(base, 'summer')).not.toBe(seasonalGrade(base, 'autumn'));
    // summer is the no-op (pinned in seasonal-grade.test) — so summer props == today's colour.
  });
});

describe('§4.6 D1c-i — the renderer re-dresses the props in place (reuse, no rebuild)', () => {
  it('setSeason re-tints the cover props — the winter scene differs from summer; summer is stable', () => {
    const scene = new Scene();
    const wr = new WorldRenderer(scene, createWorld()); // meadow unlocked → its grass + bloom built

    wr.setSeason('summer');
    const summerA = matHexes(scene);
    wr.setSeason('winter');
    const winter = matHexes(scene);
    wr.setSeason('summer');
    const summerB = matHexes(scene);

    expect(winter).not.toEqual(summerA); // ⚠️ the cover/ground re-tinted for winter (the re-dress fired)
    expect(summerB).toEqual(summerA); // ⚠️ summer is stable + reversible (back to today's look)
  });

  it('⚠️ bloom is SPRING-ONLY — visible in spring, HIDDEN in summer (so summer == today)', () => {
    const scene = new Scene();
    const wr = new WorldRenderer(scene, createWorld());

    const bloomIn = (season: Season): number => {
      wr.setSeason(season);
      return visibleBlooms(scene);
    };
    expect(bloomIn('spring')).toBeGreaterThan(0); // the meadow blooms in spring
    expect(bloomIn('summer')).toBe(0); // ⚠️ NOT in summer (the baseline-stability pin)
    expect(bloomIn('autumn')).toBe(0);
    expect(bloomIn('winter')).toBe(0);
  });
});
