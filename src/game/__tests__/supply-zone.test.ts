import { describe, expect, it } from 'vitest';
import { createWorld, unlockBiome, supplyPostAt, supplyExitPosition, clampToUnlocked } from '../World';
import { createGameState, update } from '../GameState';
import { ACTION_KEYS, createIntent } from '../Input';
import { JOURNAL_SCHEMA_VERSION } from '../../state/Journal';
import { SUPPLY_POSTS, BIOMES, HIDING_SPOTS, PLAYER, TRACKING } from '../../utils/constants';

const post = (biome: string) => SUPPLY_POSTS.find((p) => p.biome === biome)!;

describe('supplyPostAt — the walk-in zone, gated on unlock', () => {
  it('returns the biome at its post (unlocked); null away from it', () => {
    const w = createWorld(); // meadow unlocked
    const m = post('meadow');
    expect(supplyPostAt(w, m.x, m.y)).toBe('meadow');
    expect(supplyPostAt(w, 0, 0)).toBeNull();
  });

  it('a LOCKED biome has NO post; unlocking it makes the post exist', () => {
    const w = createWorld();
    const wd = post('woodland');
    expect(supplyPostAt(w, wd.x, wd.y)).toBeNull();
    unlockBiome(w, 'woodland');
    expect(supplyPostAt(w, wd.x, wd.y)).toBe('woodland');
  });
});

describe('movementFrozen — the player is ROOTED while the shop is open (§12 1b)', () => {
  it('a movement intent does NOT move a frozen player; clearing it resumes movement', () => {
    const g = createGameState(1);
    const intent = { ...createIntent(), moveX: 1, moveY: 0 };
    const before = { x: g.player.x, y: g.player.y };

    g.movementFrozen = true;
    update(g, intent, 0.1);
    expect(g.player.x).toBe(before.x); // rooted
    expect(g.player.y).toBe(before.y);

    g.movementFrozen = false;
    update(g, intent, 0.1);
    expect(g.player.x !== before.x || g.player.y !== before.y).toBe(true); // moves again
  });

  it('the WORLD still advances while the player is frozen (time progresses — not a pause)', () => {
    const g = createGameState(1);
    g.movementFrozen = true;
    const t0 = g.timeSec;
    update(g, createIntent(), 0.5);
    expect(g.timeSec).toBeGreaterThan(t0); // only the player is rooted; the world lives on
  });
});

describe('supplyExitPosition — closing steps the player OUT the door (−y), no reopen-trap', () => {
  it('every post exits south, OUTSIDE its zone, and stays outside even after clamping', () => {
    for (const p of SUPPLY_POSTS) {
      const exit = supplyExitPosition(p);
      expect(exit.y).toBeLessThan(p.y); // out the door = south (−y)
      expect(Math.hypot(exit.x - p.x, exit.y - p.y)).toBeGreaterThan(p.radius); // outside the zone

      const w = createWorld();
      unlockBiome(w, p.biome); // its post now exists
      // No-trap by POSITION: the exit point is not in the zone...
      expect(supplyPostAt(w, exit.x, exit.y)).toBeNull();
      // ...and clamping it into the unlocked region keeps it outside the zone (a valid spot).
      const c = clampToUnlocked(w, exit.x, exit.y, PLAYER.radius, { x: 0, y: 0 });
      expect(supplyPostAt(w, c.x, c.y)).toBeNull();
      // The clamped exit is inside the biome's bounds (valid).
      const b = BIOMES[p.biome].bounds;
      expect(c.x).toBeGreaterThanOrEqual(b.minX);
      expect(c.x).toBeLessThanOrEqual(b.maxX);
      expect(c.y).toBeGreaterThanOrEqual(b.minY);
      expect(c.y).toBeLessThanOrEqual(b.maxY);
    }
  });
});

describe('placement — posts sit in their cell, clear of spawn / cover / the sett', () => {
  it('every post is valid (in-cell, off spawn, not on a hiding spot or the sett); one per biome', () => {
    for (const p of SUPPLY_POSTS) {
      const b = BIOMES[p.biome].bounds;
      expect(p.x).toBeGreaterThanOrEqual(b.minX);
      expect(p.x).toBeLessThanOrEqual(b.maxX);
      expect(p.y).toBeGreaterThanOrEqual(b.minY);
      expect(p.y).toBeLessThanOrEqual(b.maxY);
      expect(Math.hypot(p.x, p.y)).toBeGreaterThan(p.radius + 2); // off spawn (0,0)
      for (const h of HIDING_SPOTS) {
        expect(Math.hypot(p.x - h.x, p.y - h.y)).toBeGreaterThan(p.radius);
      }
      expect(Math.hypot(p.x - TRACKING.sett.x, p.y - TRACKING.sett.y)).toBeGreaterThan(
        p.radius + TRACKING.sett.radius,
      );
    }
    expect(SUPPLY_POSTS.map((p) => p.biome).sort()).toEqual(['cave', 'coast', 'highlands', 'meadow', 'moor', 'pineforest', 'riverbank', 'wetland', 'woodland']);
  });
});

describe('the #41 HUD shop entry is removed; no schema change', () => {
  it('no shop key, no shopToggle intent (the building is the only way in)', () => {
    expect('shop' in ACTION_KEYS).toBe(false);
    expect('shopToggle' in createIntent()).toBe(false);
  });

  it('no schema bump from THIS feature — the post + freeze are runtime state (the v7 bump is the research PR)', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(7);
  });
});
