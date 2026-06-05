import { describe, expect, it } from 'vitest';
import { createWorld, unlockBiome, supplyPostAt } from '../World';
import { createSupplyZone, shouldOpenSupply } from '../SupplyZone';
import { ACTION_KEYS, createIntent } from '../Input';
import { JOURNAL_SCHEMA_VERSION } from '../../state/Journal';
import { SUPPLY_POSTS, BIOMES, HIDING_SPOTS, TRACKING } from '../../utils/constants';

const post = (biome: string) => SUPPLY_POSTS.find((p) => p.biome === biome)!;

describe('supplyPostAt — the walk-in zone, gated on unlock', () => {
  it('returns the biome at its post (unlocked); null away from it', () => {
    const w = createWorld(); // meadow unlocked
    const m = post('meadow');
    expect(supplyPostAt(w, m.x, m.y)).toBe('meadow');
    expect(supplyPostAt(w, 0, 0)).toBeNull(); // spawn — far from the post
  });

  it('a LOCKED biome has NO post; unlocking it makes the post exist (render-on-unlock data)', () => {
    const w = createWorld(); // woodland locked
    const wd = post('woodland');
    expect(supplyPostAt(w, wd.x, wd.y)).toBeNull(); // locked -> no post
    unlockBiome(w, 'woodland');
    expect(supplyPostAt(w, wd.x, wd.y)).toBe('woodland'); // now it exists (rebuildDynamic adds it)
  });

  it('respects the zone radius (just inside vs just outside)', () => {
    const w = createWorld();
    const m = post('meadow');
    expect(supplyPostAt(w, m.x + m.radius - 0.01, m.y)).toBe('meadow');
    expect(supplyPostAt(w, m.x + m.radius + 0.5, m.y)).toBeNull();
  });
});

describe('shouldOpenSupply — the armed / no-reopen-trap machine (THE core correctness)', () => {
  it('opens ONCE on the entry edge; staying inside does not re-fire', () => {
    const s = createSupplyZone();
    expect(shouldOpenSupply(s, true, false)).toBe(true); // entry edge -> open
    expect(shouldOpenSupply(s, true, true)).toBe(false); // still inside, panel open
  });

  it('close-while-inside does NOT reopen; leave + re-enter fires again', () => {
    const s = createSupplyZone();
    shouldOpenSupply(s, true, false); // open
    // ✕ pressed -> panel closed, but the player is STILL inside the zone:
    expect(shouldOpenSupply(s, true, false)).toBe(false); // NO reopen-trap
    expect(shouldOpenSupply(s, true, false)).toBe(false); // ...and stays closed
    shouldOpenSupply(s, false, false); // walk OUT -> re-arms
    expect(shouldOpenSupply(s, true, false)).toBe(true); // walk back IN -> opens
  });

  it('a blind walk-out WHILE open never re-arms a reopen on the eventual close', () => {
    const s = createSupplyZone();
    shouldOpenSupply(s, true, false); // open
    shouldOpenSupply(s, false, true); // walked out while the panel is OPEN -> must NOT re-arm
    shouldOpenSupply(s, true, true); // walked back in, still open
    expect(shouldOpenSupply(s, true, false)).toBe(false); // close while inside -> NO reopen
  });
});

describe('placement — posts sit in their cell, clear of spawn / cover / the sett', () => {
  it('every post is valid (inside bounds, off spawn, not overlapping a hiding spot or the sett)', () => {
    for (const p of SUPPLY_POSTS) {
      const b = BIOMES[p.biome].bounds;
      expect(p.x).toBeGreaterThanOrEqual(b.minX);
      expect(p.x).toBeLessThanOrEqual(b.maxX);
      expect(p.y).toBeGreaterThanOrEqual(b.minY);
      expect(p.y).toBeLessThanOrEqual(b.maxY);
      expect(Math.hypot(p.x, p.y)).toBeGreaterThan(p.radius + 2); // clear of spawn (0,0)
      for (const h of HIDING_SPOTS) {
        expect(Math.hypot(p.x - h.x, p.y - h.y)).toBeGreaterThan(p.radius); // clear of cover
      }
      expect(Math.hypot(p.x - TRACKING.sett.x, p.y - TRACKING.sett.y)).toBeGreaterThan(
        p.radius + TRACKING.sett.radius,
      ); // clear of the badger sett
    }
    // one post per biome.
    expect(SUPPLY_POSTS.map((p) => p.biome).sort()).toEqual(['highlands', 'meadow', 'wetland', 'woodland']);
  });
});

describe('the #41 HUD shop entry is removed; no schema change', () => {
  it('no shop key, no shopToggle intent (the building is the only way in)', () => {
    expect('shop' in ACTION_KEYS).toBe(false);
    expect('shopToggle' in createIntent()).toBe(false);
  });

  it('no schema bump — the post is world geometry from unlock state, not persisted (still v5)', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(5);
  });
});
